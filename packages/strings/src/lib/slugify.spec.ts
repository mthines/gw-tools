import { describe, it, expect } from 'vitest';
import { slugify } from './slugify.js';

describe('slugify', () => {
  it('should convert text to lowercase', () => {
    expect(slugify('HELLO WORLD')).toBe('hello-world');
    expect(slugify('MixedCase')).toBe('mixedcase');
  });

  it('should replace spaces with hyphens', () => {
    expect(slugify('hello world')).toBe('hello-world');
    expect(slugify('multiple   spaces')).toBe('multiple-spaces');
  });

  it('should remove special characters', () => {
    expect(slugify('hello@world!')).toBe('helloworld');
    expect(slugify('test#$%^&*()')).toBe('test');
    expect(slugify('dots.and,commas')).toBe('dotsandcommas');
  });

  it('should replace underscores with hyphens', () => {
    expect(slugify('hello_world')).toBe('hello-world');
    expect(slugify('snake_case_text')).toBe('snake-case-text');
  });

  it('should handle multiple consecutive hyphens', () => {
    expect(slugify('hello---world')).toBe('hello-world');
    expect(slugify('test - - - case')).toBe('test-case');
  });

  it('should trim and remove leading/trailing hyphens', () => {
    expect(slugify('  hello world  ')).toBe('hello-world');
    expect(slugify('-hello-world-')).toBe('hello-world');
    expect(slugify('---test---')).toBe('test');
  });

  it('should handle empty strings', () => {
    expect(slugify('')).toBe('');
    expect(slugify('   ')).toBe('');
  });

  it('should handle strings with only special characters', () => {
    expect(slugify('!@#$%^&*()')).toBe('');
    expect(slugify('...')).toBe('');
  });

  it('should handle accented characters by removing them', () => {
    expect(slugify('café')).toBe('caf');
    expect(slugify('naïve')).toBe('nave');
  });

  it('should handle numbers', () => {
    expect(slugify('test123')).toBe('test123');
    expect(slugify('123 456')).toBe('123-456');
  });

  it('should handle complex real-world examples', () => {
    expect(slugify('The Quick Brown Fox!')).toBe('the-quick-brown-fox');
    expect(slugify('C++ Programming Language')).toBe('c-programming-language');
    expect(slugify('Node.js v18.0.0')).toBe('nodejs-v1800');
  });

  it('should throw TypeError for non-string input', () => {
    expect(() => slugify(null as any)).toThrow(TypeError);
    expect(() => slugify(undefined as any)).toThrow(TypeError);
    expect(() => slugify(123 as any)).toThrow(TypeError);
    expect(() => slugify({} as any)).toThrow(TypeError);
    expect(() => slugify([] as any)).toThrow(TypeError);
  });
});