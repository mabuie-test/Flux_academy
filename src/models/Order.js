const mongoose = require('mongoose');

const OrderSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    workType: { type: String, required: true },
    area: { type: String, required: true },
    academicLevel: {
      type: String,
      enum: ['tecnico', 'licenciatura', 'mestrado', 'doutoramento'],
      required: true,
    },
    pages: { type: Number, required: true, min: 1 },
    formatting: { type: String, required: true },
    complexity: { type: String, enum: ['basica', 'intermedia', 'avancada'], required: true },
    urgency: { type: String, enum: ['normal', '72h', '48h', '24h'], required: true },
    description: { type: String, required: true },
    status: {
      type: String,
      enum: [
        'PENDENTE_PAGAMENTO',
        'PAGAMENTO_EM_VALIDACAO',
        'EM_EXECUCAO',
        'CONCLUIDA',
        'CANCELADA',
      ],
      default: 'PENDENTE_PAGAMENTO',
    },
    createdAt: { type: Date, default: Date.now },
    paymentDeadline: { type: Date },
    deliveryDeadline: { type: Date },
    finalFile: { type: String },
    priceBreakdown: {
      basePerPage: { type: Number, required: true },
      levelFactor: { type: Number, required: true },
      complexityFactor: { type: Number, required: true },
      urgencyFactor: { type: Number, required: true },
      total: { type: Number, required: true },
    },
    statusHistory: [
      {
        status: { type: String, required: true },
        note: { type: String },
        changedAt: { type: Date, default: Date.now },
      },
    ],
  },
  { timestamps: true }
);

module.exports = mongoose.model('Order', OrderSchema);
