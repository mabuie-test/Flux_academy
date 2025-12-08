const mongoose = require('mongoose');

const AuditSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    role: { type: String },
    action: { type: String, required: true },
    entityType: { type: String },
    entityId: { type: String },
    metadata: { type: Object },
    createdAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Audit', AuditSchema);
