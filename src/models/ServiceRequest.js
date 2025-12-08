const mongoose = require('mongoose');

const ServiceRequestSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    type: { type: String, enum: ['TCC', 'PRATICA'], required: true },
    contactName: { type: String, required: true },
    contactEmail: { type: String, required: true },
    contactPhone: { type: String },
    details: { type: String, required: true },
    goals: { type: String },
    status: {
      type: String,
      enum: ['RECEBIDO', 'EM_ANALISE', 'FATURA_ENVIADA', 'FECHADO'],
      default: 'RECEBIDO',
    },
    invoiceAmount: { type: Number },
    invoiceNote: { type: String },
    invoiceSentAt: { type: Date },
    adminNotes: { type: String },
  },
  { timestamps: true }
);

module.exports = mongoose.model('ServiceRequest', ServiceRequestSchema);
