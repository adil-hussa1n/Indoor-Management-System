/**
 * Lightweight HTML sanitizer for user-submitted text fields.
 * Strips all HTML tags to prevent stored XSS attacks.
 * Does NOT depend on any external library.
 */

/**
 * Strip HTML tags from a string.
 * @param {string} str - The input string
 * @returns {string} - Sanitized string with HTML tags removed
 */
export const stripHtml = (str) => {
  if (typeof str !== 'string') return str;
  return str.replace(/<[^>]*>/g, '').trim();
};

/**
 * Sanitize an object's specified keys by stripping HTML tags.
 * Returns a new object with sanitized values (does not mutate the original).
 * @param {Object} obj - The object to sanitize
 * @param {string[]} keys - The keys to sanitize
 * @returns {Object} - New object with sanitized values
 */
export const sanitizeFields = (obj, keys) => {
  if (!obj || typeof obj !== 'object') return obj;
  const sanitized = { ...obj };
  for (const key of keys) {
    if (sanitized[key] !== undefined && sanitized[key] !== null) {
      sanitized[key] = stripHtml(sanitized[key]);
    }
  }
  return sanitized;
};
