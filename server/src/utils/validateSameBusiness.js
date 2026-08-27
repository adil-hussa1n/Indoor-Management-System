// ── Cross-Business FK Validator ──
// Constitution Principle III: any FK on a business-owned model that points
// to another business-owned model MUST be validated at write time to
// belong to the same business as the record being saved.

/**
 * Confirm a referenced row belongs to req.businessId before it's used as
 * an FK on another business-owned record. Throws a typed error the caller
 * can translate to a 400 response.
 *
 * @param {Object} model - Sequelize model of the referenced row (e.g. Ground)
 * @param {number|string} id - the FK value being written
 * @param {number} businessId - req.businessId
 * @param {string} fieldName - for the error message (e.g. "groundId")
 * @returns {Promise<Object>} the referenced row, if it belongs to this business
 */
export async function assertSameBusiness(model, id, businessId, fieldName) {
  if (id === null || id === undefined) return null;
  const row = await model.findOne({ where: { id, businessId } });
  if (!row) {
    const err = new Error(`${fieldName} does not belong to your business`);
    err.status = 400;
    err.isCrossBusinessViolation = true;
    throw err;
  }
  return row;
}

export default assertSameBusiness;
