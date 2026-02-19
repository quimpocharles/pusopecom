/**
 * Converts a string to title case — first letter of each word capitalized,
 * rest lowercased. Safe for undefined/null values.
 */
export const toTitleCase = (str) =>
  str?.replace(/\S+/g, word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()) ?? '';
