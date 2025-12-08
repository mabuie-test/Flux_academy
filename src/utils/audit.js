const Audit = require('../models/Audit');

function normalizeIp(req) {
  if (!req) return undefined;
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) return forwarded.split(',')[0].trim();
  return req.ip;
}

async function logAudit({ user, role, action, entityType, entityId, metadata }, req) {
  try {
    await Audit.create({
      user,
      role,
      action,
      entityType,
      entityId,
      metadata: {
        ...(metadata || {}),
        ip: normalizeIp(req),
        userAgent: req?.headers?.['user-agent'],
      },
    });
  } catch (err) {
    console.error('Erro ao registar auditoria', err.message);
  }
}

module.exports = { logAudit };
