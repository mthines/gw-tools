import { validateType } from '@org/utils';

/**
 * Capitalize first letter of each word
 */
export function capitalize(text: string, allWords = true): string {
  if (!validateType(text, 'string')) {
    throw new TypeError('Input must be a string');
  }

  if (!text) return text;

  if (allWords) {
    return text.replace(/\b\w/g, (char) => char.toUpperCase());
  }

  return text.charAt(0).toUpperCase() + text.slice(1).toLowerCase();
}
