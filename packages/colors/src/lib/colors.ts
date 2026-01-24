/**
 * RGB color representation
 */
export interface RgbColor {
    r: number;
    g: number;
    b: number;
}

/**
 * HSL color representation
 */
export interface HslColor {
    h: number;
    s: number;
    l: number;
}

/**
 * Convert hex color to RGB
 */
export function hexToRgb(hex: string): RgbColor {
    if (!isValidHex(hex)) {
        throw new Error('Invalid hex color');
    }

    // Remove # if present
    const cleanHex = hex.replace('#', '');

    // Handle 3-digit hex
    const fullHex = cleanHex.length === 3
        ? cleanHex.split('').map(char => char + char).join('')
        : cleanHex;

    const bigint = parseInt(fullHex, 16);

    return {
        r: (bigint >> 16) & 255,
        g: (bigint >> 8) & 255,
        b: bigint & 255
    };
}

/**
 * Convert RGB to hex color
 */
export function rgbToHex(r: number, g: number, b: number): string;
export function rgbToHex(rgb: RgbColor): string;
export function rgbToHex(
    rOrRgb: number | RgbColor,
    g?: number,
    b?: number
): string {
    let r: number;

    if (typeof rOrRgb === 'object') {
        ({ r, g, b } = rOrRgb);
    } else {
        r = rOrRgb;
        g = g!;
        b = b!;
    }

    if (!isValidRgb(r, g, b)) {
        throw new Error('Invalid RGB values. Must be between 0-255');
    }

    const toHex = (n: number): string => {
        const hex = n.toString(16);
        return hex.length === 1 ? '0' + hex : hex;
    };

    return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

/**
 * Darken a color by percentage
 */
export function darken(color: string, percent: number): string {
    if (!isValidHex(color)) {
        throw new Error('Invalid hex color');
    }
    if (percent < 0 || percent > 100) {
        throw new Error('Percent must be between 0 and 100');
    }

    const rgb = hexToRgb(color);
    const factor = 1 - (percent / 100);

    return rgbToHex(
        Math.round(rgb.r * factor),
        Math.round(rgb.g * factor),
        Math.round(rgb.b * factor)
    );
}

/**
 * Lighten a color by percentage
 */
export function lighten(color: string, percent: number): string {
    if (!isValidHex(color)) {
        throw new Error('Invalid hex color');
    }
    if (percent < 0 || percent > 100) {
        throw new Error('Percent must be between 0 and 100');
    }

    const rgb = hexToRgb(color);
    const factor = percent / 100;

    return rgbToHex(
        Math.round(rgb.r + (255 - rgb.r) * factor),
        Math.round(rgb.g + (255 - rgb.g) * factor),
        Math.round(rgb.b + (255 - rgb.b) * factor)
    );
}

/**
 * Validate hex color code
 */
export function isValidHex(color: unknown): color is string {
    if (typeof color !== 'string') return false;
    return /^#?([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/.test(color);
}

/**
 * Validate RGB values
 */
export function isValidRgb(r: number, g: number, b: number): boolean;
export function isValidRgb(rgb: Partial<RgbColor>): boolean;
export function isValidRgb(
    rOrRgb: number | Partial<RgbColor>,
    g?: number,
    b?: number
): boolean {
    let r: number | undefined;

    if (typeof rOrRgb === 'object') {
        ({ r, g, b } = rOrRgb as RgbColor);
    } else {
        r = rOrRgb;
    }

    const isValid = (n: number | undefined): n is number =>
        n !== undefined && Number.isInteger(n) && n >= 0 && n <= 255;

    return isValid(r) && isValid(g) && isValid(b);
}

/**
 * Get contrast ratio between two colors
 */
export function getContrastRatio(color1: string, color2: string): number {
    const getLuminance = (rgb: RgbColor): number => {
        const toLinear = (val: number): number => {
            const normalized = val / 255;
            return normalized <= 0.03928
                ? normalized / 12.92
                : Math.pow((normalized + 0.055) / 1.055, 2.4);
        };

        const r = toLinear(rgb.r);
        const g = toLinear(rgb.g);
        const b = toLinear(rgb.b);

        return 0.2126 * r + 0.7152 * g + 0.0722 * b;
    };

    const lum1 = getLuminance(hexToRgb(color1));
    const lum2 = getLuminance(hexToRgb(color2));

    const lighter = Math.max(lum1, lum2);
    const darker = Math.min(lum1, lum2);

    return (lighter + 0.05) / (darker + 0.05);
}

/**
 * Generate a random hex color
 */
export function randomHex(): string {
    const random = (): number => Math.floor(Math.random() * 256);
    return rgbToHex(random(), random(), random());
}

/**
 * Convert RGB to HSL
 */
export function rgbToHsl(r: number, g: number, b: number): HslColor;
export function rgbToHsl(rgb: RgbColor): HslColor;
export function rgbToHsl(
    rOrRgb: number | RgbColor,
    g?: number,
    b?: number
): HslColor {
    let r: number;

    if (typeof rOrRgb === 'object') {
        ({ r, g, b } = rOrRgb);
    } else {
        r = rOrRgb;
        g = g!;
        b = b!;
    }

    r /= 255;
    g /= 255;
    b /= 255;

    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    let h = 0;
    let s = 0;
    const l = (max + min) / 2;

    if (max !== min) {
        const d = max - min;
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min);

        switch (max) {
            case r:
                h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
                break;
            case g:
                h = ((b - r) / d + 2) / 6;
                break;
            case b:
                h = ((r - g) / d + 4) / 6;
                break;
        }
    }

    return {
        h: Math.round(h * 360),
        s: Math.round(s * 100),
        l: Math.round(l * 100)
    };
}