# @technance/worphling

## 1.4.0

### Minor Changes

-   Fix package not removing extra keys in targets file

## 1.3.0

### Minor Changes

-   Fix package not working in Windows setup

## 1.2.0

### Minor Changes

-   Upgrade all installed dependency packages to their latest versions.

## 1.1.1

### Patch Changes

-   Fixed issue with modified keys not being detected or translated in target language files
-   Implemented snapshot-based tracking to properly identify when source text has been changed
-   Modified key detection is now enabled by default for better user experience

## 1.1.0

### Minor Changes

-   Added optional automatic alphabetical sorting of keys (recursive) for all output JSON files, including the source language file. Enable this behavior via the `--with-sorting` flag.

## 1.0.2

### Patch Changes

-   Fixed a bug with incorrect prompt examples being sent to ChatGPT resulting in poor translation quality.

## 1.0.1

### Patch Changes

-   Updated the configuration file resolution logic to support multiple file extensions (.mjs, .js) dynamically.

## 1.0.0

### Major Changes

-   Initial release
