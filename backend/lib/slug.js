/**
 * Extracted from productRepository.js during the Organization-first
 * migration — Organization and Team both need slug generation too (the
 * second and third real use case, which is what earns an extraction here
 * rather than three copies of the same regex). Matches the original
 * Mongoose productSchema.pre('validate') behavior exactly; reused as-is
 * for Organization/Team rather than redesigned, since nothing about slug
 * generation is entity-specific.
 */
export function generateSlug(name) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
