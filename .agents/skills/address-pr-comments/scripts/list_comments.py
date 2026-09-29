#!/usr/bin/env python3
"""
Collect and normalize GitHub PR feedback via gh CLI.

Usage:
  python3 scripts/list_comments.py
  python3 scripts/list_comments.py --pr 2781
  python3 scripts/list_comments.py --json
  python3 scripts/list_comments.py --include-resolved
  python3 scripts/list_comments.py --full-body
"""

from __future__ import annotations

import argparse
import json
import re
import shutil
import subprocess
import sys
from typing import Any


AI_LOGINS = frozenset(
    {
        "coderabbit",
        "coderabbitai",
        "copilot",
        "copilot-pull-request-reviewer",
        "github-actions",
        "reviewdog",
        "sonarqube",
        "deepsource",
        "changeset-bot",
        "codecov",
        "dependabot",
        "renovate",
    }
)

REVIEW_THREADS_QUERY = """
query($owner:String!, $repo:String!, $number:Int!, $cursor:String) {
  repository(owner:$owner, name:$repo) {
    pullRequest(number:$number) {
      reviewThreads(first:100, after:$cursor) {
        nodes {
          id
          isResolved
          isOutdated
          comments(first:100) {
            nodes {
              databaseId
            }
          }
        }
        pageInfo {
          hasNextPage
          endCursor
        }
      }
    }
  }
}
"""


def run_gh(args: list[str]) -> str:
    proc = subprocess.run(["gh", *args], capture_output=True, text=True)
    if proc.returncode != 0:
        raise RuntimeError(proc.stderr.strip() or f"gh {' '.join(args)} failed")
    return proc.stdout


def ensure_gh() -> None:
    if shutil.which("gh") is None:
        raise RuntimeError("gh CLI is not installed or not in PATH")
    _ = run_gh(["--version"])


def resolve_pr_number(pr: int | None) -> int:
    if pr:
        return pr
    data = json.loads(run_gh(["pr", "view", "--json", "number"]))
    return int(data["number"])


def parse_repo_from_pr_url(url: str) -> tuple[str, str]:
    match = re.search(r"github\.com/([^/]+)/([^/]+)/pull/\d+", url)
    if not match:
        raise RuntimeError(f"Could not parse owner/repo from PR URL: {url}")
    return match.group(1), match.group(2)


def is_ai_reviewer(login: str) -> bool:
    # GraphQL (`gh pr view`) returns bot logins bare ("coderabbitai"), while
    # REST (inline comments) appends "[bot]" ("coderabbitai[bot]").
    lowered = (login or "").lower()
    return lowered.endswith("[bot]") or lowered in AI_LOGINS


def body_excerpt(body: str, limit: int = 220) -> str:
    text = " ".join((body or "").split())
    return text[:limit]


def extract_ai_prompts(body: str) -> list[str]:
    if not body:
        return []

    prompts: list[str] = []

    # Common CodeRabbit section pattern.
    heading_re = re.compile(
        r"(?is)prompt for ai agents.*?```+\n(.*?)```+",
    )
    prompts.extend(m.group(1).strip() for m in heading_re.finditer(body))

    # Common generated instruction line pattern.
    instruction_re = re.compile(r"(?m)^In @.+$")
    prompts.extend(m.group(0).strip() for m in instruction_re.finditer(body))

    # De-duplicate while preserving order.
    seen: set[str] = set()
    unique: list[str] = []
    for prompt in prompts:
        if prompt and prompt not in seen:
            seen.add(prompt)
            unique.append(prompt)
    return unique


def normalize_top_level(
    comments: list[dict[str, Any]], full_body: bool
) -> list[dict[str, Any]]:
    normalized = []
    for comment in comments:
        login = comment.get("author", {}).get("login", "")
        body = comment.get("body", "")
        normalized.append(
            {
                "kind": "top_level",
                "id": comment.get("id"),
                "author": login,
                "is_ai": is_ai_reviewer(login),
                "created_at": comment.get("createdAt"),
                "url": comment.get("url"),
                "excerpt": body_excerpt(body),
                "ai_prompts": extract_ai_prompts(body),
                **({"body": body} if full_body else {}),
            }
        )
    return normalized


def normalize_reviews(
    reviews: list[dict[str, Any]], full_body: bool
) -> list[dict[str, Any]]:
    normalized = []
    for review in reviews:
        login = review.get("author", {}).get("login", "")
        body = review.get("body", "") or ""
        normalized.append(
            {
                "kind": "review",
                "id": review.get("id"),
                "author": login,
                "is_ai": is_ai_reviewer(login),
                "state": review.get("state"),
                "submitted_at": review.get("submittedAt"),
                "excerpt": body_excerpt(body),
                "ai_prompts": extract_ai_prompts(body),
                **({"body": body} if full_body else {}),
            }
        )
    return normalized

def collect_review_thread_status(
    owner: str, repo: str, pr: int
) -> dict[int, dict[str, Any]]:
    by_comment_id: dict[int, dict[str, Any]] = {}
    cursor: str | None = None

    while True:
        args = [
            "api",
            "graphql",
            "-f",
            f"owner={owner}",
            "-f",
            f"repo={repo}",
            "-F",
            f"number={pr}",
            "-f",
            f"query={REVIEW_THREADS_QUERY}",
        ]
        if cursor:
            args.extend(["-f", f"cursor={cursor}"])

        response = json.loads(run_gh(args))
        review_threads = (
            response.get("data", {})
            .get("repository", {})
            .get("pullRequest", {})
            .get("reviewThreads", {})
        )

        for thread in review_threads.get("nodes", []):
            status = {
                "thread_id": thread.get("id"),
                "thread_resolved": bool(thread.get("isResolved")),
                "thread_outdated": bool(thread.get("isOutdated")),
            }
            for comment in thread.get("comments", {}).get("nodes", []):
                database_id = comment.get("databaseId")
                if database_id is not None:
                    by_comment_id[int(database_id)] = status

        page_info = review_threads.get("pageInfo", {})
        if not page_info.get("hasNextPage"):
            break
        cursor = page_info.get("endCursor")
        if not cursor:
            break

    return by_comment_id


def normalize_inline(
    comments: list[dict[str, Any]],
    review_thread_status: dict[int, dict[str, Any]],
    include_resolved: bool,
    full_body: bool,
) -> list[dict[str, Any]]:
    normalized = []
    for comment in comments:
        comment_id = comment.get("id")
        thread_status = (
            review_thread_status.get(int(comment_id))
            if comment_id is not None
            else None
        )
        if (
            not include_resolved
            and thread_status is not None
            and thread_status.get("thread_resolved")
        ):
            continue
        login = comment.get("user", {}).get("login", "")
        body = comment.get("body", "") or ""
        normalized.append(
            {
                "kind": "inline",
                "id": comment_id,
                "author": login,
                "is_ai": is_ai_reviewer(login),
                "created_at": comment.get("created_at"),
                "url": comment.get("html_url"),
                "path": comment.get("path"),
                "line": comment.get("line"),
                "thread_id": (
                    thread_status.get("thread_id") if thread_status else None
                ),
                "thread_resolved": (
                    thread_status.get("thread_resolved")
                    if thread_status is not None
                    else None
                ),
                "thread_outdated": (
                    thread_status.get("thread_outdated")
                    if thread_status is not None
                    else None
                ),
                "in_reply_to_id": comment.get("in_reply_to_id"),
                "excerpt": body_excerpt(body),
                "ai_prompts": extract_ai_prompts(body),
                **({"body": body} if full_body else {}),
            }
        )
    return normalized


def collect(
    pr: int, include_resolved: bool = False, full_body: bool = False
) -> dict[str, Any]:
    pr_view = json.loads(
        run_gh(
            [
                "pr",
                "view",
                str(pr),
                "--json",
                "number,title,url,comments,reviews",
            ]
        )
    )
    owner, repo = parse_repo_from_pr_url(pr_view["url"])
    inline = json.loads(
        run_gh(["api", f"repos/{owner}/{repo}/pulls/{pr}/comments", "--paginate"])
    )
    review_thread_status = collect_review_thread_status(owner, repo, pr)

    top_level = normalize_top_level(pr_view.get("comments", []), full_body)
    reviews = normalize_reviews(pr_view.get("reviews", []), full_body)
    inline_comments = normalize_inline(
        inline,
        review_thread_status=review_thread_status,
        include_resolved=include_resolved,
        full_body=full_body,
    )

    all_items = [*top_level, *reviews, *inline_comments]
    ai_count = sum(1 for item in all_items if item["is_ai"])
    human_count = len(all_items) - ai_count

    def safe_comment_id(inline_comment: dict[str, Any]) -> int | None:
        id_value = inline_comment.get("id")
        if id_value is None:
            return None
        try:
            return int(id_value)
        except (TypeError, ValueError):
            return None

    resolved_inline_total = sum(
        1
        for inline_comment in inline
        if (
            (comment_id := safe_comment_id(inline_comment)) is not None
            and review_thread_status.get(comment_id, {}).get("thread_resolved") is True
        )
    )
    outdated_inline_total = sum(
        1
        for inline_comment in inline
        if (
            (comment_id := safe_comment_id(inline_comment)) is not None
            and review_thread_status.get(comment_id, {}).get("thread_outdated") is True
        )
    )

    return {
        "pr": {
            "number": pr_view["number"],
            "title": pr_view["title"],
            "url": pr_view["url"],
        },
        "counts": {
            "top_level": len(top_level),
            "reviews": len(reviews),
            "inline": len(inline_comments),
            "inline_total": len(inline),
            "inline_resolved": resolved_inline_total,
            "inline_outdated": outdated_inline_total,
            "inline_filtered_out": len(inline) - len(inline_comments),
            "total_items": len(all_items),
            "ai_items": ai_count,
            "human_items": human_count,
        },
        "filters": {
            "include_resolved_inline": include_resolved,
            "full_body": full_body,
        },
        "items": all_items,
    }


def print_text_report(payload: dict[str, Any]) -> None:
    pr = payload["pr"]
    counts = payload["counts"]
    print(f"PR #{pr['number']}: {pr['title']}")
    print(pr["url"])
    print(
        "Counts: "
        f"top-level={counts['top_level']}, "
        f"reviews={counts['reviews']}, "
        f"inline={counts['inline']}, "
        f"inline-total={counts['inline_total']}, "
        f"inline-outdated={counts['inline_outdated']}, "
        f"inline-filtered-out={counts['inline_filtered_out']}, "
        f"ai={counts['ai_items']}, "
        f"human={counts['human_items']}"
    )
    print("")

    for idx, item in enumerate(payload["items"], start=1):
        marker = "AI" if item["is_ai"] else "Human"
        location = ""
        if item.get("path"):
            location = f" | {item['path']}:{item.get('line') or ''}"
        # `body` is only present with --full-body; fall back to the excerpt.
        text = item.get("body") or item.get("excerpt", "")
        text = "\n".join(f"   {line}" for line in text.splitlines()) or "   "
        print(f"{idx}. [{item['kind']}] {marker} @{item['author']}{location}\n{text}\n")


def main() -> int:
    parser = argparse.ArgumentParser(description="List and normalize PR comments")
    parser.add_argument("--pr", type=int, default=None, help="PR number")
    parser.add_argument(
        "--json",
        action="store_true",
        help="Output JSON instead of text",
    )
    parser.add_argument(
        "--include-resolved",
        action="store_true",
        help="Include resolved inline review threads (default: unresolved only)",
    )
    parser.add_argument(
        "--full-body",
        action="store_true",
        help="Include each item's full body (bot reviews often hide nitpicks there)",
    )
    args = parser.parse_args()

    try:
        ensure_gh()
        pr = resolve_pr_number(args.pr)
        payload = collect(
            pr, include_resolved=args.include_resolved, full_body=args.full_body
        )
    except Exception as exc:  # CLI utility: return readable failure
        print(f"Error: {exc}", file=sys.stderr)
        return 1

    if args.json:
        print(json.dumps(payload, indent=2, ensure_ascii=False))
    else:
        print_text_report(payload)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
