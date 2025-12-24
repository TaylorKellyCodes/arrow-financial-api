const AuditLog = require("../models/AuditLog");

async function logAudit(entry) {
  try {
    await AuditLog.create(entry);
  } catch (err) {
    console.error("Audit log failed", err);
  }
}

module.exports = { logAudit };

