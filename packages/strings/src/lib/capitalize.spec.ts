import { describe, it, expect } from 'vitest';
import { capitalize } from './capitalize.js';

describe('capitalize', () => {
  describe('single word capitalization (allWords = false)', () => {
    it('should capitalize first letter only', () => {
      expect(capitalize('hello', false)).toBe('Hello');
      expect(capitalize('HELLO', false)).toBe('Hello');
      expect(capitalize('hELLO', false)).toBe('Hello');
    });

    it('should handle single character strings', () => {
      expect(capitalize('a', false)).toBe('A');
      expect(capitalize('A', false)).toBe('A');
    });

    it('should handle strings with numbers', () => {
      expect(capitalize('123hello', false)).toBe('123hello');
      expect(capitalize('hello123', false)).toBe('Hello123');
    });

    it('should handle strings with special characters', () => {
      expect(capitalize('!hello', false)).toBe('!hello');
      expect(capitalize('hello!', false)).toBe('Hello!');
    });
  });

  describe('all words capitalization (allWords = true)', () => {
    it('should capitalize first letter of each word by default', () => {
      expect(capitalize('hello world')).toBe('Hello World');
      expect(capitalize('the quick brown fox')).toBe('The Quick Brown Fox');
    });

    it('should handle multiple spaces between words', () => {
      expect(capitalize('hello   world')).toBe('Hello   World');
      expect(capitalize('test  case  example')).toBe('Test  Case  Example');
    });

    it('should handle mixed case input', () => {
      expect(capitalize('hELLO wORLD')).toBe('HELLO WORLD');
      expect(capitalize('tHe QuIcK bRoWn FoX')).toBe('THe QuIcK BRoWn FoX');
    });

    it('should handle hyphenated words', () => {
      expect(capitalize('mary-jane')).toBe('Mary-Jane');
      expect(capitalize('x-ray')).toBe('X-Ray');
    });

    it('should handle apostrophes', () => {
      expect(capitalize("it's")).toBe("It'S");
      expect(capitalize("don't stop")).toBe("Don'T Stop");
    });

    it('should handle numbers in words', () => {
      expect(capitalize('test2word')).toBe('Test2word');
      expect(capitalize('2fast 2furious')).toBe('2fast 2furious');
    });
  });

  describe('edge cases', () => {
    it('should handle empty strings', () => {
      expect(capitalize('')).toBe('');
      expect(capitalize('', false)).toBe('');
    });

    it('should handle whitespace-only strings', () => {
      expect(capitalize('   ')).toBe('   ');
      expect(capitalize('   ', false)).toBe('   ');
    });

    it('should handle strings with only special characters', () => {
      expect(capitalize('!@#$%')).toBe('!@#$%');
      expect(capitalize('!@#$%', false)).toBe('!@#$%');
    });

    it('should handle strings with leading spaces', () => {
      expect(capitalize('  hello')).toBe('  Hello');
      expect(capitalize('  hello', false)).toBe('  hello');
    });

    it('should handle strings with trailing spaces', () => {
      expect(capitalize('hello  ')).toBe('Hello  ');
      expect(capitalize('hello  ', false)).toBe('Hello  ');
    });

    it('should handle newlines and tabs', () => {
      expect(capitalize('hello\nworld')).toBe('Hello\nWorld');
      expect(capitalize('hello\tworld')).toBe('Hello\tWorld');
    });
  });

  describe('type validation', () => {
    it('should throw TypeError for non-string input', () => {
      expect(() => capitalize(null as any)).toThrow(TypeError);
      expect(() => capitalize(undefined as any)).toThrow(TypeError);
      expect(() => capitalize(123 as any)).toThrow(TypeError);
      expect(() => capitalize({} as any)).toThrow(TypeError);
      expect(() => capitalize([] as any)).toThrow(TypeError);
      expect(() => capitalize(true as any)).toThrow(TypeError);
    });

    it('should handle boolean second parameter correctly', () => {
      expect(capitalize('hello world', true)).toBe('Hello World');
      expect(capitalize('hello world', false)).toBe('Hello world');
    });
  });

  describe('real-world examples', () => {
    it('should handle titles', () => {
      expect(capitalize('the lord of the rings')).toBe('The Lord Of The Rings');
      expect(capitalize('a tale of two cities')).toBe('A Tale Of Two Cities');
    });

    it('should handle names', () => {
      expect(capitalize('john doe')).toBe('John Doe');
      expect(capitalize('mcdonald')).toBe('Mcdonald');
      expect(capitalize("o'brien")).toBe("O'Brien");
    });

    it('should handle programming terms', () => {
      expect(capitalize('javascript')).toBe('Javascript');
      expect(capitalize('typeScript', false)).toBe('Typescript');
      expect(capitalize('node.js framework')).toBe('Node.Js Framework');
    });
  });
});