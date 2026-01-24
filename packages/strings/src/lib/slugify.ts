import { validateType } from '@org/utils';

/**
 * Convert text to URL-friendly slug
 */
export function slugify(text: string): string {
  if (!validateType(text, 'string')) {
    throw new TypeError('Input must be a string');
  }

  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '') // Remove non-word chars
    .replace(/[\s_-]+/g, '-') // Replace spaces, underscores, multiple hyphens with single hyphen
    .replace(/^-+|-+$/g, ''); // Remove leading/trailing hyphens
}
