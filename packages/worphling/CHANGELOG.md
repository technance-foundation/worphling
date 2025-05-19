# @technance/worphling

## 1.1.1

### Patch Changes

-   Fixed issue with modified keys not being detected or translated in target language files
-   Implemented snapshot-based tracking to properly identify when source text has been changed
-   Added new CLI flags to control behavior:
    -   `--skip-modified-detection`: Skip the detection of modified keys for specific use cases
    -   `--force-retranslate-all`: Force retranslation of all keys when needed

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
