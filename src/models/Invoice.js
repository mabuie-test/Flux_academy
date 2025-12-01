const mongoose = require('mongoose');

const InvoiceSchema = new mongoose.Schema(
  {
    order: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', required: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    invoiceNumber: { type: Number, unique: true },
    issueDate: { type: Date, default: Date.now },
    dueDate: { type: Date, required: true },
    summary: { type: String, required: true },
    amount: { type: Number, required: true },
    priceFactors: {
      basePerPage: { type: Number, required: true },
      levelFactor: { type: Number, required: true },
      complexityFactor: { type: Number, required: true },
      urgencyFactor: { type: Number, required: true },
    },
    status: {
      type: String,
      enum: ['EMITIDA', 'PENDENTE', 'PAGA', 'EXPIRADA', 'CANCELADA', 'PENDENTE_VALIDACAO'],
      default: 'EMITIDA',
    },
    mpesaNumber: { type: String, default: '851619970' },
    mpesaHolder: { type: String, default: 'Maria António Chicavele' },
    proofFile: { type: String },
    rejectionReason: { type: String },
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

InvoiceSchema.pre('save', async function (next) {
  if (this.invoiceNumber) return next();
  try {
    const lastInvoice = await this.constructor.findOne().sort('-invoiceNumber').exec();
    this.invoiceNumber = lastInvoice ? lastInvoice.invoiceNumber + 1 : 1;
    next();
  } catch (err) {
    next(err);
  }
});

module.exports = mongoose.model('Invoice', InvoiceSchema);
