# `@technance/worphling`

Worphling is a powerful translation synchronization tool that simplifies i18n workflows. It integrates with OpenAI to automatically detect, translate, and synchronize content from a source language file into multiple target languages.

![Worphling](/assets/logo.png)

## Features

-   🔍 **Automatic Detection** - Find missing translations across all target languages
-   🔄 **Modified Key Detection** - Identify and retranslate keys that have been changed in the source file
-   🤖 **AI-Powered Translation** - Leverage OpenAI for high-quality translations
-   🧩 **Complex Pattern Support** - Handle pluralization, gender selection, and rich text
-   🔀 **Key Sorting** - Optional alphabetical sorting of keys for consistent files
-   📏 **Length Constraints** - Option to keep translations similar in length to source text
-   🔧 **Flexible Configuration** - Simple configuration for integration into any workflow

## Installation

```bash
npm install  @technance/worphling

# Using pnpm
pnpm add  @technance/worphling
```

## Configuration

Create a `worphling.config.js` or `worphling.config.mjs` file in your project root:

```javascript
// worphling.config.js
export default {
    service: {
        name: "OpenAI",
        apiKey: process.env.OPENAI_API_KEY, // Or "your-openai-api-key"
        model: "gpt-4o-2024-11-20", // Optional, defaults to gpt-4o-2024-11-20
    },
    source: {
        file: "./locales/en.json", // Source language file
        directory: "./locales", // Directory containing all language files
    },
    plugin: "next-intl", // Or "none" for basic translations
};
```

## Usage

### Basic Usage

```bash
# Run with default settings
worphling

# Generate a config file (interactive)
worphling init
```

### Advanced Options

```bash
# Run with exact length constraint
worphling --try-exact-length

# Run with key sorting
worphling --with-sorting

# Skip modified key detection
worphling --skip-modified-detection

# Force retranslation of all keys
worphling --force-retranslate-all

# Combine multiple options
worphling --try-exact-length --with-sorting
```

## How It Works

1. Worphling reads all JSON files in the specified directory
2. It identifies the source language file and analyzes all target languages
3. It detects missing translation keys in target languages
4. It also identifies keys that have been modified in the source file (using a snapshot)
5. It uses OpenAI to translate the missing and modified keys
6. It updates all target language files with the new translations
7. It maintains a snapshot of the source file for future change detection

> **Note:** The snapshot is stored in a `.worphling-snapshot` file. You can add this file to your `.gitignore` to avoid committing it to your repository.

### Example

Source file (en.json):

```json
{
    "app": {
        "title": "My Application",
        "welcome": "Welcome to {appName}"
    }
}
```

Spanish file before (es.json):

```json
{
    "app": {
        "title": "Mi Aplicación"
        // welcome key is missing
    }
}
```

After running Worphling:

```json
{
    "app": {
        "title": "Mi Aplicación",
        "welcome": "Bienvenido a {appName}"
    }
}
```

## Supported Translation Patterns

Worphling handles complex translation patterns:

-   **Basic text**: `"Hello World"`
-   **Interpolation**: `"Welcome to {appName}"`
-   **Rich Text**: `"Hello <bold>{name}</bold>"`
-   **Pluralization**: `"You have {count, plural, =0 {no followers} =1 {one follower} other {# followers}}."`
-   **Selection**: `"{gender, select, female {She} male {He} other {They}} is online."`

## Test the functionality with prompts

You can leverage AI agents (like Claude or ChatGPT) to automatically test Worphling's functionality. Simply provide the following prompt to your preferred AI assistant:

```
I want to test our project functionality. Follow @testing-playground.mdc rule to check each script functionality.
```

The AI will:

1. Examine your project structure
2. Read the testing requirements from `.cursor/rules/testing-playground.mdc`
3. Systematically test each core functionality:

    - Basic translation of missing keys
    - Modified key detection
    - Sorting functionality
    - Force retranslation
    - Skip modified detection
    - Try exact length translations

4. Document test results in a `playground-test-result.md.md` file with:
    - Test setup details
    - Commands executed
    - Output received
    - Verification status

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is licensed under the [MIT License](LICENSE).

## Credits

Developed with ❤️ by [Technance](https://technance.io).
