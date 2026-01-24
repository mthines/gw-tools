# @org/strings

String manipulation utilities for TypeScript applications.

## 📦 Package Information

- **Version**: 0.0.1
- **Publishable**: ✅ Yes
- **Tag**: `scope:strings`
- **Module Boundaries**: Can only import from `scope:shared` packages

## 🚀 Features

This package provides essential string manipulation utilities:

- **capitalize** - Capitalizes the first letter of a string
- **slugify** - Converts strings to URL-friendly slugs

## 📝 Usage Examples

```typescript
import { capitalize, slugify } from '@org/strings';

// Capitalize strings
capitalize('hello world');  // 'Hello world'
capitalize('typescript');   // 'Typescript'

// Create URL-friendly slugs
slugify('Hello World!');           // 'hello-world'
slugify('TypeScript & JavaScript'); // 'typescript-javascript'
```

## 🛠️ Custom Commands

This package includes a custom build command to demonstrate Nx's flexibility:

```bash
# Run the custom build-base command
nx run strings:build-base

# This will output: "Running build-base for strings. This can be replaced with arbitrary commands."
```

## 🧪 Testing

```bash
# Run tests for this package
nx test strings

# Run tests in watch mode
nx test strings --watch
```

## 🏗️ Building

```bash
# Build the package
nx build strings

# The build output will be in dist/packages/strings
```

## 📋 Available Commands

```bash
nx build strings       # Build the package
nx test strings        # Run tests
nx lint strings        # Lint the package
nx run strings:build-base  # Run custom build command
```

## 🔒 Module Boundaries

This package has the tag `scope:strings` and can only import from:
- `@org/utils` (tagged with `scope:shared`)

Attempting to import from `@org/colors` or `@org/async` will result in a linting error due to module boundary constraints.