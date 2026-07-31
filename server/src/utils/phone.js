/**
 * Normalizes Bangladesh phone numbers to standard format: 8801XXXXXXXXX (13 digits).
 * Strips out non-digit characters and ensures correct country code prefixing.
 *
 * @param {string} phone
 * @returns {string} Normalized phone number
 */
export const normalizePhone = (phone) => {
  if (!phone) return '';
  // Remove all non-digit characters
  let cleaned = phone.replace(/\D/g, '');
  
  // Handle leading 0 (e.g., 01712345678 -> 8801712345678)
  if (cleaned.startsWith('0')) {
    cleaned = '88' + cleaned;
  }
  // Handle missing 88 prefix but starting with 17/18/19/etc (e.g. 1712345678 -> 8801712345678)
  else if (cleaned.length === 10 && cleaned.startsWith('1')) {
    cleaned = '880' + cleaned;
  }
  
  return cleaned;
};
