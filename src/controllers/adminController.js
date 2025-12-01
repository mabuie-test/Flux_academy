const Order = require('../models/Order');
const Invoice = require('../models/Invoice');
const User = require('../models/User');
const ServiceRequest = require('../models/ServiceRequest');
const {
  sendMail,
  invoiceEmailTemplate,
  finalDeliveryTemplate,
  serviceRequestTemplate,
  broadcastTemplate,
} = require('../utils/mailer');
const { logAudit } = require('../utils/audit');

function addOrderHistory(order, status, note) {
  order.statusHistory.push({ status, note, changedAt: new Date() });
}

function addInvoiceHistory(invoice, status, note) {
  invoice.statusHistory.push({ status, note, changedAt: new Date() });
}

async function notifyInvoice(invoice, order, label) {
  const user = await User.findById(order.user);
  if (user) {
    await sendMail({
      to: user.email,
      subject: `Atualização da fatura #${invoice.invoiceNumber}`,
      html: invoiceEmailTemplate(invoice, order, label),
    });
  }
}

async function notifyFinalDelivery(order) {
  const user = await User.findById(order.user);
  if (user) {
    await sendMail({
      to: user.email,
      subject: 'Trabalho final disponível para download',
      html: finalDeliveryTemplate(order),
    });
  }
}

exports.listOrders = async (req, res) => {
  try {
    const orders = await Order.find().populate('user');
    const invoices = await Invoice.find();
    res.json({ orders, invoices });
  } catch (err) {
    res.status(500).json({ message: 'Erro ao listar encomendas', error: err.message });
  }
};

exports.getOrderDetail = async (req, res) => {
  try {
    const order = await Order.findById(req.params.id).populate('user');
    if (!order) return res.status(404).json({ message: 'Encomenda não encontrada' });
    const invoice = await Invoice.findOne({ order: order._id });
    res.json({ order, invoice });
  } catch (err) {
    res.status(500).json({ message: 'Erro ao carregar detalhe', error: err.message });
  }
};

exports.validatePayment = async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ message: 'Encomenda não encontrada' });
    const invoice = await Invoice.findOne({ order: order._id });
    if (!invoice) return res.status(404).json({ message: 'Fatura não encontrada' });

    if (invoice.status !== 'PENDENTE_VALIDACAO') {
      return res.status(400).json({ message: 'A fatura não está em validação' });
    }
    if (!invoice.proofFile) {
      return res.status(400).json({ message: 'Sem comprovativo submetido' });
    }

    invoice.status = 'PAGA';
    addInvoiceHistory(invoice, 'PAGA', 'Pagamento confirmado pela equipa');
    invoice.rejectionReason = undefined;
    order.status = 'EM_EXECUCAO';
    addOrderHistory(order, 'EM_EXECUCAO', 'Pagamento validado, trabalho em produção');

    await invoice.save();
    await order.save();
    await notifyInvoice(invoice, order, 'Pagamento validado');
    await logAudit({
      user: req.user._id,
      role: req.user.role,
      action: 'VALIDAR_PAGAMENTO',
      entityType: 'Order',
      entityId: order._id.toString(),
    });
    res.json({ message: 'Pagamento validado', order, invoice });
  } catch (err) {
    res.status(500).json({ message: 'Erro ao validar pagamento', error: err.message });
  }
};

exports.rejectPayment = async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ message: 'Encomenda não encontrada' });
    const invoice = await Invoice.findOne({ order: order._id });
    if (!invoice) return res.status(404).json({ message: 'Fatura não encontrada' });

    invoice.status = 'PENDENTE';
    invoice.rejectionReason = req.body?.reason || 'Comprovativo inválido ou ilegível';
    addInvoiceHistory(invoice, 'PENDENTE', `Rejeitado: ${invoice.rejectionReason}`);
    order.status = 'PENDENTE_PAGAMENTO';
    addOrderHistory(order, 'PENDENTE_PAGAMENTO', 'Pagamento rejeitado, aguardar novo comprovativo');

    await invoice.save();
    await order.save();
    await notifyInvoice(invoice, order, 'Pagamento rejeitado');
    await logAudit({
      user: req.user._id,
      role: req.user.role,
      action: 'REJEITAR_PAGAMENTO',
      entityType: 'Order',
      entityId: order._id.toString(),
      metadata: { reason: invoice.rejectionReason },
    });
    res.json({ message: 'Pagamento rejeitado; aguardando novo comprovativo', order, invoice });
  } catch (err) {
    res.status(500).json({ message: 'Erro ao rejeitar pagamento', error: err.message });
  }
};

exports.uploadFinalWork = async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ message: 'Encomenda não encontrada' });
    const invoice = await Invoice.findOne({ order: order._id });
    if (!invoice || invoice.status !== 'PAGA') {
      return res.status(400).json({ message: 'Apenas faturas pagas permitem entrega do trabalho' });
    }
    if (order.status !== 'EM_EXECUCAO') {
      return res.status(400).json({ message: 'Encomenda precisa de estar em execução para finalizar' });
    }
    order.finalFile = req.file ? req.file.filename : order.finalFile;
    order.status = 'CONCLUIDA';
    addOrderHistory(order, 'CONCLUIDA', 'Trabalho final anexado para o cliente');
    await order.save();
    await notifyFinalDelivery(order);
    await logAudit({
      user: req.user._id,
      role: req.user.role,
      action: 'UPLOAD_TRABALHO_FINAL',
      entityType: 'Order',
      entityId: order._id.toString(),
    });
    res.json({ message: 'Trabalho final carregado', order });
  } catch (err) {
    res.status(500).json({ message: 'Erro ao subir trabalho final', error: err.message });
  }
};

exports.expireInvoice = async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ message: 'Encomenda não encontrada' });
    const invoice = await Invoice.findOne({ order: order._id });
    if (!invoice) return res.status(404).json({ message: 'Fatura não encontrada' });

    if (invoice.status === 'PAGA') return res.status(400).json({ message: 'Fatura já paga' });
    if (invoice.status === 'EXPIRADA') return res.status(400).json({ message: 'Fatura já expirada' });
    if (invoice.dueDate > new Date()) return res.status(400).json({ message: 'Data de vencimento ainda não atingida' });

    invoice.status = 'EXPIRADA';
    addInvoiceHistory(invoice, 'EXPIRADA', 'Prazo de pagamento expirado');
    order.status = 'CANCELADA';
    addOrderHistory(order, 'CANCELADA', 'Pedido cancelado por falta de pagamento');
    await invoice.save();
    await order.save();
    await notifyInvoice(invoice, order, 'Fatura expirada');
    await logAudit({
      user: req.user._id,
      role: req.user.role,
      action: 'EXPIRAR_FATURA',
      entityType: 'Order',
      entityId: order._id.toString(),
    });

    res.json({ message: 'Estado de expiração avaliado', order, invoice });
  } catch (err) {
    res.status(500).json({ message: 'Erro ao marcar expiração', error: err.message });
  }
};

exports.listServiceRequests = async (req, res) => {
  try {
    const requests = await ServiceRequest.find().populate('user');
    res.json({ requests });
  } catch (err) {
    res.status(500).json({ message: 'Erro ao listar pedidos especiais', error: err.message });
  }
};

exports.updateServiceRequest = async (req, res) => {
  try {
    const request = await ServiceRequest.findById(req.params.id).populate('user');
    if (!request) return res.status(404).json({ message: 'Pedido não encontrado' });
    const { status, invoiceAmount, invoiceNote, adminNotes } = req.body;
    if (status) request.status = status;
    if (invoiceAmount) request.invoiceAmount = invoiceAmount;
    if (invoiceNote) request.invoiceNote = invoiceNote;
    if (adminNotes) request.adminNotes = adminNotes;
    if (status === 'FATURA_ENVIADA') request.invoiceSentAt = new Date();
    await request.save();

    if (status) {
      await sendMail({
        to: request.contactEmail,
        subject: 'Atualização do seu pedido especial',
        html: serviceRequestTemplate(request),
      });
    }

    await logAudit({
      user: req.user._id,
      role: req.user.role,
      action: 'ATUALIZAR_PEDIDO_ESPECIAL',
      entityType: 'ServiceRequest',
      entityId: request._id.toString(),
      metadata: { status, invoiceAmount },
    });

    res.json({ request });
  } catch (err) {
    res.status(500).json({ message: 'Erro ao atualizar pedido especial', error: err.message });
  }
};

exports.broadcastEmail = async (req, res) => {
  try {
    const { subject, message } = req.body;
    const users = await User.find();
    await Promise.all(
      users.map((u) =>
        sendMail({
          to: u.email,
          subject: subject || 'Aviso administrativo Flux Academy',
          html: broadcastTemplate(message),
        })
      )
    );
    await logAudit({
      user: req.user._id,
      role: req.user.role,
      action: 'BROADCAST_EMAIL',
      entityType: 'User',
      entityId: 'all',
    });
    res.json({ message: 'Emails enviados' });
  } catch (err) {
    res.status(500).json({ message: 'Erro ao enviar emails', error: err.message });
  }
};
