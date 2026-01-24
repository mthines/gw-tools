# @org/utils

Shared utility functions used across all packages in the monorepo.

## 📦 Package Information

- **Version**: 0.0.1
- **Publishable**: ❌ No (Private Package)
- **Tag**: `scope:shared`
- **Module Boundaries**: Base library - no external dependencies allowed

## 🔒 Private Package

This is an **internal library** that:
- Will NOT be published to NPM
- Provides shared utilities for other packages
- Serves as the foundation layer for the monorepo

## 🚀 Features

This package provides core utilities that are shared across all other packages:

- Common helper functions
- Shared types and interfaces
- Base utilities used by `@org/strings`, `@org/async`, and `@org/colors`

## 📝 Usage

This package is automatically available to all other packages in the monorepo:

```typescript
// In any other package (strings, async, colors)
import { someUtility } from '@org/utils';

// Use the shared functionality
const result = someUtility(input);
```

## 🏗️ Building

```bash
# Build the package
nx build utils

# The build output will be in dist/packages/utils
```

## 📋 Available Commands

```bash
nx build utils    # Build the package
nx lint utils     # Lint the package
```

## 🔒 Module Boundaries

This package has the tag `scope:shared` which means:
- **Can be imported by**: All packages (`scope:strings`, `scope:async`, `scope:colors`)
- **Can import from**: Nothing (it's the base layer)

This ensures a clean dependency hierarchy where `utils` serves as the foundation without creating circular dependencies.

## 🏛️ Architecture Role

As the shared foundation of the monorepo:
1. Contains no business logic specific to strings, async, or colors
2. Provides only generic, reusable utilities
3. Has no external dependencies beyond TypeScript's standard library
4. Ensures consistency across all packages

## ⚠️ Important Notes

- This package is marked as `"private": true` in package.json
- It will be excluded from NPM publishing when running `nx release`
- Changes to this package may affect all other packages in the monorepo
- Keep utilities generic and well-tested as they form the foundation