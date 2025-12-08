const mongoose = require('mongoose');

const AffiliatePayoutSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    amount: { type: Number, required: true },
    status: { type: String, enum: ['PENDENTE', 'PAGO', 'RECUSADO'], default: 'PENDENTE' },
    note: { type: String },
    requestedAt: { type: Date, default: Date.now },
    processedAt: { type: Date },
    admin: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

module.exports = mongoose.model('AffiliatePayout', AffiliatePayoutSchema);
