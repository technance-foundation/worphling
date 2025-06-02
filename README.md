# `@technance/worphling`

Worphling is a powerful translation synchronization tool that simplifies i18n workflows. It integrates with OpenAI to automatically detect, translate, and synchronize content from a source language file into multiple target languages.

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
# Install using your favorite package manager as dev dependency
pnpm add @technance/worphling -D
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
```

### Advanced Options

```bash
# Run with exact length constraint
worphling --try-exact-length

# Run with key sorting
worphling --with-sorting

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

> **Note:** Snapshots are automatically stored in your project's `node_modules/.worphling/` directory, so they're automatically gitignored.

### Example

Source file (en.json):

```jsonc
{
    "app": {
        "title": "My Application",
        "welcome": "Welcome to {appName}"
    }
}
```

Spanish file before (es.json):

```jsonc
{
    "app": {
        "title": "Mi Aplicación"
        // welcome key is missing
    }
}
```

After running Worphling:

```jsonc
{
    "app": {
        "title": "Mi Aplicación",
        "welcome": "Bienvenido a {appName}"
    }
}
```

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is licensed under the [MIT License](LICENSE).

## Credits

Developed with ❤️ by [Technance](https://technance.io).
