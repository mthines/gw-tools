import { describe, it, expect } from 'vitest';
import {
  hexToRgb,
  rgbToHex,
  darken,
  lighten,
  isValidHex,
  isValidRgb,
  getContrastRatio,
  randomHex,
  rgbToHsl,
} from './colors.js';

describe('colors', () => {
  describe('hexToRgb', () => {
    it('should convert 6-digit hex to RGB', () => {
      expect(hexToRgb('#FF0000')).toEqual({ r: 255, g: 0, b: 0 });
      expect(hexToRgb('#00FF00')).toEqual({ r: 0, g: 255, b: 0 });
      expect(hexToRgb('#0000FF')).toEqual({ r: 0, g: 0, b: 255 });
      expect(hexToRgb('#FFFFFF')).toEqual({ r: 255, g: 255, b: 255 });
      expect(hexToRgb('#000000')).toEqual({ r: 0, g: 0, b: 0 });
    });

    it('should convert 3-digit hex to RGB', () => {
      expect(hexToRgb('#F00')).toEqual({ r: 255, g: 0, b: 0 });
      expect(hexToRgb('#0F0')).toEqual({ r: 0, g: 255, b: 0 });
      expect(hexToRgb('#00F')).toEqual({ r: 0, g: 0, b: 255 });
      expect(hexToRgb('#FFF')).toEqual({ r: 255, g: 255, b: 255 });
      expect(hexToRgb('#000')).toEqual({ r: 0, g: 0, b: 0 });
    });

    it('should handle hex without hash', () => {
      expect(hexToRgb('FF0000')).toEqual({ r: 255, g: 0, b: 0 });
      expect(hexToRgb('F00')).toEqual({ r: 255, g: 0, b: 0 });
    });

    it('should handle lowercase hex', () => {
      expect(hexToRgb('#ff0000')).toEqual({ r: 255, g: 0, b: 0 });
      expect(hexToRgb('#aabbcc')).toEqual({ r: 170, g: 187, b: 204 });
    });

    it('should throw error for invalid hex', () => {
      expect(() => hexToRgb('invalid')).toThrow('Invalid hex color');
      expect(() => hexToRgb('#GGGGGG')).toThrow('Invalid hex color');
      expect(() => hexToRgb('#FF')).toThrow('Invalid hex color');
      expect(() => hexToRgb('#FFFFFFF')).toThrow('Invalid hex color');
      expect(() => hexToRgb('')).toThrow('Invalid hex color');
    });
  });

  describe('rgbToHex', () => {
    it('should convert RGB to hex with separate parameters', () => {
      expect(rgbToHex(255, 0, 0)).toBe('#ff0000');
      expect(rgbToHex(0, 255, 0)).toBe('#00ff00');
      expect(rgbToHex(0, 0, 255)).toBe('#0000ff');
      expect(rgbToHex(255, 255, 255)).toBe('#ffffff');
      expect(rgbToHex(0, 0, 0)).toBe('#000000');
    });

    it('should convert RGB object to hex', () => {
      expect(rgbToHex({ r: 255, g: 0, b: 0 })).toBe('#ff0000');
      expect(rgbToHex({ r: 0, g: 255, b: 0 })).toBe('#00ff00');
      expect(rgbToHex({ r: 0, g: 0, b: 255 })).toBe('#0000ff');
    });

    it('should pad single digit hex values', () => {
      expect(rgbToHex(1, 2, 3)).toBe('#010203');
      expect(rgbToHex(15, 15, 15)).toBe('#0f0f0f');
    });

    it('should throw error for invalid RGB values', () => {
      expect(() => rgbToHex(256, 0, 0)).toThrow('Invalid RGB values');
      expect(() => rgbToHex(-1, 0, 0)).toThrow('Invalid RGB values');
      expect(() => rgbToHex(0, 0, 256)).toThrow('Invalid RGB values');
      expect(() => rgbToHex(1.5, 0, 0)).toThrow('Invalid RGB values');
      expect(() => rgbToHex({ r: 256, g: 0, b: 0 })).toThrow(
        'Invalid RGB values'
      );
    });
  });

  describe('darken', () => {
    it('should darken color by percentage', () => {
      expect(darken('#FF0000', 50)).toBe('#800000');
      expect(darken('#FFFFFF', 20)).toBe('#cccccc');
      expect(darken('#808080', 50)).toBe('#404040');
    });

    it('should handle 0% darkening', () => {
      expect(darken('#FF0000', 0)).toBe('#ff0000');
      expect(darken('#FFFFFF', 0)).toBe('#ffffff');
    });

    it('should handle 100% darkening', () => {
      expect(darken('#FF0000', 100)).toBe('#000000');
      expect(darken('#FFFFFF', 100)).toBe('#000000');
    });

    it('should handle 3-digit hex', () => {
      expect(darken('#F00', 50)).toBe('#800000');
      expect(darken('#FFF', 20)).toBe('#cccccc');
    });

    it('should throw error for invalid percentage', () => {
      expect(() => darken('#FF0000', -1)).toThrow(
        'Percent must be between 0 and 100'
      );
      expect(() => darken('#FF0000', 101)).toThrow(
        'Percent must be between 0 and 100'
      );
    });

    it('should throw error for invalid hex', () => {
      expect(() => darken('invalid', 50)).toThrow('Invalid hex color');
    });
  });

  describe('lighten', () => {
    it('should lighten color by percentage', () => {
      expect(lighten('#000000', 50)).toBe('#808080');
      expect(lighten('#800000', 50)).toBe('#c08080');
      expect(lighten('#404040', 50)).toBe('#a0a0a0');
    });

    it('should handle 0% lightening', () => {
      expect(lighten('#000000', 0)).toBe('#000000');
      expect(lighten('#FF0000', 0)).toBe('#ff0000');
    });

    it('should handle 100% lightening', () => {
      expect(lighten('#000000', 100)).toBe('#ffffff');
      expect(lighten('#FF0000', 100)).toBe('#ffffff');
    });

    it('should handle 3-digit hex', () => {
      expect(lighten('#000', 50)).toBe('#808080');
      expect(lighten('#800', 50)).toBe('#c48080');
    });

    it('should throw error for invalid percentage', () => {
      expect(() => lighten('#000000', -1)).toThrow(
        'Percent must be between 0 and 100'
      );
      expect(() => lighten('#000000', 101)).toThrow(
        'Percent must be between 0 and 100'
      );
    });

    it('should throw error for invalid hex', () => {
      expect(() => lighten('invalid', 50)).toThrow('Invalid hex color');
    });
  });

  describe('isValidHex', () => {
    it('should validate correct hex colors', () => {
      expect(isValidHex('#FF0000')).toBe(true);
      expect(isValidHex('#000000')).toBe(true);
      expect(isValidHex('#FFFFFF')).toBe(true);
      expect(isValidHex('#F00')).toBe(true);
      expect(isValidHex('#000')).toBe(true);
      expect(isValidHex('#FFF')).toBe(true);
      expect(isValidHex('FF0000')).toBe(true);
      expect(isValidHex('F00')).toBe(true);
    });

    it('should validate lowercase hex colors', () => {
      expect(isValidHex('#ff0000')).toBe(true);
      expect(isValidHex('#aabbcc')).toBe(true);
      expect(isValidHex('deadbe')).toBe(true);
    });

    it('should reject invalid hex colors', () => {
      expect(isValidHex('#GGGGGG')).toBe(false);
      expect(isValidHex('#FF')).toBe(false);
      expect(isValidHex('#FFFFFFF')).toBe(false);
      expect(isValidHex('invalid')).toBe(false);
      expect(isValidHex('')).toBe(false);
      expect(isValidHex('#12345')).toBe(false);
    });

    it('should reject non-string values', () => {
      expect(isValidHex(null)).toBe(false);
      expect(isValidHex(undefined)).toBe(false);
      expect(isValidHex(123)).toBe(false);
      expect(isValidHex({})).toBe(false);
      expect(isValidHex([])).toBe(false);
    });
  });

  describe('isValidRgb', () => {
    it('should validate correct RGB values with separate parameters', () => {
      expect(isValidRgb(0, 0, 0)).toBe(true);
      expect(isValidRgb(255, 255, 255)).toBe(true);
      expect(isValidRgb(128, 128, 128)).toBe(true);
      expect(isValidRgb(0, 128, 255)).toBe(true);
    });

    it('should validate correct RGB object', () => {
      expect(isValidRgb({ r: 0, g: 0, b: 0 })).toBe(true);
      expect(isValidRgb({ r: 255, g: 255, b: 255 })).toBe(true);
      expect(isValidRgb({ r: 128, g: 128, b: 128 })).toBe(true);
    });

    it('should reject invalid RGB values', () => {
      expect(isValidRgb(-1, 0, 0)).toBe(false);
      expect(isValidRgb(256, 0, 0)).toBe(false);
      expect(isValidRgb(0, -1, 0)).toBe(false);
      expect(isValidRgb(0, 256, 0)).toBe(false);
      expect(isValidRgb(0, 0, -1)).toBe(false);
      expect(isValidRgb(0, 0, 256)).toBe(false);
    });

    it('should reject non-integer values', () => {
      expect(isValidRgb(1.5, 0, 0)).toBe(false);
      expect(isValidRgb(0, 1.5, 0)).toBe(false);
      expect(isValidRgb(0, 0, 1.5)).toBe(false);
    });

    it('should reject incomplete RGB objects', () => {
      expect(isValidRgb({ r: 0 } as any)).toBe(false);
      expect(isValidRgb({ r: 0, g: 0 } as any)).toBe(false);
      expect(isValidRgb({} as any)).toBe(false);
    });

    it('should reject undefined values', () => {
      expect(isValidRgb(undefined as any, 0, 0)).toBe(false);
      expect(isValidRgb(0, undefined as any, 0)).toBe(false);
      expect(isValidRgb(0, 0, undefined as any)).toBe(false);
    });
  });

  describe('getContrastRatio', () => {
    it('should calculate contrast ratio between colors', () => {
      // Black and white have maximum contrast
      const blackWhite = getContrastRatio('#000000', '#FFFFFF');
      expect(blackWhite).toBeCloseTo(21, 1);

      // Same colors have minimum contrast
      const sameColor = getContrastRatio('#FF0000', '#FF0000');
      expect(sameColor).toBeCloseTo(1, 1);
    });

    it('should handle different color combinations', () => {
      const redGreen = getContrastRatio('#FF0000', '#00FF00');
      expect(redGreen).toBeGreaterThan(1);
      expect(redGreen).toBeLessThan(21);

      const blueYellow = getContrastRatio('#0000FF', '#FFFF00');
      expect(blueYellow).toBeGreaterThan(1);
      expect(blueYellow).toBeLessThan(21);
    });

    it('should be symmetric', () => {
      const ratio1 = getContrastRatio('#FF0000', '#00FF00');
      const ratio2 = getContrastRatio('#00FF00', '#FF0000');
      expect(ratio1).toBeCloseTo(ratio2, 5);
    });

    it('should handle 3-digit hex', () => {
      const ratio = getContrastRatio('#F00', '#0F0');
      expect(ratio).toBeGreaterThan(1);
      expect(ratio).toBeLessThan(21);
    });

    it('should meet WCAG AA standards for certain combinations', () => {
      // Dark gray on white should meet AA standard (>4.5)
      const darkGrayWhite = getContrastRatio('#333333', '#FFFFFF');
      expect(darkGrayWhite).toBeGreaterThan(4.5);

      // Light gray on white should not meet AA standard
      const lightGrayWhite = getContrastRatio('#CCCCCC', '#FFFFFF');
      expect(lightGrayWhite).toBeLessThan(4.5);
    });
  });

  describe('randomHex', () => {
    it('should generate valid hex color', () => {
      for (let i = 0; i < 10; i++) {
        const color = randomHex();
        expect(isValidHex(color)).toBe(true);
        expect(color).toMatch(/^#[0-9a-f]{6}$/);
      }
    });

    it('should generate different colors', () => {
      const colors = new Set();
      for (let i = 0; i < 100; i++) {
        colors.add(randomHex());
      }
      // With random generation, we should get many different colors
      expect(colors.size).toBeGreaterThan(50);
    });
  });

  describe('rgbToHsl', () => {
    it('should convert RGB to HSL with separate parameters', () => {
      // Pure red
      const red = rgbToHsl(255, 0, 0);
      expect(red.h).toBe(0);
      expect(red.s).toBe(100);
      expect(red.l).toBe(50);

      // Pure green
      const green = rgbToHsl(0, 255, 0);
      expect(green.h).toBe(120);
      expect(green.s).toBe(100);
      expect(green.l).toBe(50);

      // Pure blue
      const blue = rgbToHsl(0, 0, 255);
      expect(blue.h).toBe(240);
      expect(blue.s).toBe(100);
      expect(blue.l).toBe(50);
    });

    it('should convert RGB object to HSL', () => {
      const red = rgbToHsl({ r: 255, g: 0, b: 0 });
      expect(red.h).toBe(0);
      expect(red.s).toBe(100);
      expect(red.l).toBe(50);
    });

    it('should handle grayscale colors', () => {
      // Black
      const black = rgbToHsl(0, 0, 0);
      expect(black.h).toBe(0);
      expect(black.s).toBe(0);
      expect(black.l).toBe(0);

      // White
      const white = rgbToHsl(255, 255, 255);
      expect(white.h).toBe(0);
      expect(white.s).toBe(0);
      expect(white.l).toBe(100);

      // Gray
      const gray = rgbToHsl(128, 128, 128);
      expect(gray.h).toBe(0);
      expect(gray.s).toBe(0);
      expect(gray.l).toBeCloseTo(50, 0);
    });

    it('should handle mixed colors', () => {
      // Orange (255, 165, 0)
      const orange = rgbToHsl(255, 165, 0);
      expect(orange.h).toBeCloseTo(39, 0);
      expect(orange.s).toBe(100);
      expect(orange.l).toBe(50);

      // Purple (128, 0, 128)
      const purple = rgbToHsl(128, 0, 128);
      expect(purple.h).toBe(300);
      expect(purple.s).toBe(100);
      expect(purple.l).toBeCloseTo(25, 0);

      // Cyan (0, 255, 255)
      const cyan = rgbToHsl(0, 255, 255);
      expect(cyan.h).toBe(180);
      expect(cyan.s).toBe(100);
      expect(cyan.l).toBe(50);
    });

    it('should handle edge cases', () => {
      // Almost black
      const almostBlack = rgbToHsl(1, 1, 1);
      expect(almostBlack.l).toBeCloseTo(0, 0);

      // Almost white
      const almostWhite = rgbToHsl(254, 254, 254);
      expect(almostWhite.l).toBeCloseTo(100, 0);
    });
  });

  describe('integration tests', () => {
    it('should round-trip hex to RGB and back', () => {
      const originalHex = '#FF8040';
      const rgb = hexToRgb(originalHex);
      const convertedHex = rgbToHex(rgb);
      expect(convertedHex.toLowerCase()).toBe(originalHex.toLowerCase());
    });

    it('should darken and lighten to opposite effects', () => {
      const original = '#808080';
      const darkened = darken(original, 25);
      const lightened = lighten(original, 25);

      const darkenedRgb = hexToRgb(darkened);
      const lightenedRgb = hexToRgb(lightened);
      const originalRgb = hexToRgb(original);

      // Darkened should have lower RGB values
      expect(darkenedRgb.r).toBeLessThan(originalRgb.r);
      expect(darkenedRgb.g).toBeLessThan(originalRgb.g);
      expect(darkenedRgb.b).toBeLessThan(originalRgb.b);

      // Lightened should have higher RGB values
      expect(lightenedRgb.r).toBeGreaterThan(originalRgb.r);
      expect(lightenedRgb.g).toBeGreaterThan(originalRgb.g);
      expect(lightenedRgb.b).toBeGreaterThan(originalRgb.b);
    });

    it('should maintain color relationships through transformations', () => {
      const color1 = '#FF0000';
      const color2 = '#00FF00';

      const contrast1 = getContrastRatio(color1, color2);

      // Darken both colors by same amount
      const darkColor1 = darken(color1, 20);
      const darkColor2 = darken(color2, 20);

      const contrast2 = getContrastRatio(darkColor1, darkColor2);

      // Contrast should change but both should still be valid
      expect(contrast1).toBeGreaterThan(1);
      expect(contrast2).toBeGreaterThan(1);
    });
  });
});
