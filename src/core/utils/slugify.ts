/**
 * Turns free text into a URL-friendly slug: lowercase ASCII words joined by
 * single dashes. Accents are dropped and other symbols act as separators,
 * e.g. "Home & Garden" -> "home-garden", "Electrónica" -> "electronica".
 */
export function slugify(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/** Pattern that every slug must match: what slugify() produces. */
export const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
