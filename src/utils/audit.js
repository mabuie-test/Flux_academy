const Audit = require('../models/Audit');

async function logAudit({ user, role, action, entityType, entityId, metadata }) {
  try {
    await Audit.create({ user, role, action, entityType, entityId, metadata });
  } catch (err) {
    console.error('Erro ao registar auditoria', err.message);
  }
}

module.exports = { logAudit };
