# @org/colors

Color conversion and manipulation utilities for TypeScript applications.

## 📦 Package Information

- **Version**: 0.0.1
- **Publishable**: ✅ Yes
- **Tag**: `scope:colors`
- **Module Boundaries**: Can only import from `scope:shared` packages

## 🚀 Features

This package provides comprehensive color utilities:

- **hexToRgb** - Convert hex color codes to RGB values
- **rgbToHex** - Convert RGB values to hex color codes
- **lighten** - Make colors lighter by a percentage
- **darken** - Make colors darker by a percentage

## 📝 Usage Examples

```typescript
import { hexToRgb, rgbToHex, lighten, darken } from '@org/colors';

// Convert hex to RGB
hexToRgb('#FF5733');  // { r: 255, g: 87, b: 51 }
hexToRgb('#000');     // { r: 0, g: 0, b: 0 }

// Convert RGB to hex
rgbToHex(255, 87, 51);  // '#FF5733'
rgbToHex(0, 0, 0);      // '#000000'

// Lighten colors
lighten('#FF5733', 20);  // Returns a 20% lighter shade
lighten('#000000', 50);  // Returns a 50% lighter shade (gray)

// Darken colors
darken('#FF5733', 20);   // Returns a 20% darker shade
darken('#FFFFFF', 30);   // Returns a 30% darker shade
```

## 🧪 Testing

```bash
# Run tests for this package
nx test colors

# Run tests in watch mode
nx test colors --watch
```

## 🏗️ Building

```bash
# Build the package
nx build colors

# The build output will be in dist/packages/colors
```

## 📋 Available Commands

```bash
nx build colors    # Build the package
nx test colors     # Run tests
nx lint colors     # Lint the package
```

## 🔒 Module Boundaries

This package has the tag `scope:colors` and can only import from:
- `@org/utils` (tagged with `scope:shared`)

Attempting to import from `@org/strings` or `@org/async` will result in a linting error due to module boundary constraints.

## 🎨 Color Format Support

The utilities support various color formats:
- **Hex**: `#RGB`, `#RRGGBB`
- **RGB**: Object with `r`, `g`, `b` properties (0-255)

All functions include proper validation and error handling for invalid color formats.