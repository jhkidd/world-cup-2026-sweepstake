/**
 * Small helpers shared across fetch/build scripts.
 */

export function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export function slugify(name) {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove diacritics
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}
