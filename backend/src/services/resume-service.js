'use strict';

function resumeCapacity(db, userId, plan) {
  const current = db.prepare('SELECT COUNT(*) AS count FROM resumes WHERE user_id=?').get(userId).count;
  const limit = Number.isInteger(plan.resumeLimit) ? plan.resumeLimit : null;
  return { current, limit, available: limit === null ? null : Math.max(0, limit - current) };
}

module.exports = { resumeCapacity };
