const Order = require('../models/Order');
const Invoice = require('../models/Invoice');
const User = require('../models/User');
const Audit = require('../models/Audit');
const ServiceRequest = require('../models/ServiceRequest');
const AffiliatePayout = require('../models/AffiliatePayout');
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
    try {
      await sendMail({
        to: user.email,
        subject: `Atualização da fatura #${invoice.invoiceNumber}`,
        html: invoiceEmailTemplate(invoice, order, label),
      });
    } catch (err) {
      console.error('Falha ao enviar email de fatura para cliente', err.message);
    }
  }
}

async function notifyFinalDelivery(order) {
  const user = await User.findById(order.user);
  if (user) {
    try {
      await sendMail({
        to: user.email,
        subject: 'Trabalho final disponível para download',
        html: finalDeliveryTemplate(order),
      });
    } catch (err) {
      console.error('Falha ao enviar email de entrega final', err.message);
    }
  }
}

exports.listOrders = async (req, res) => {
  try {
    const orders = await Order.find().populate('user');
    const invoices = await Invoice.find();
    const audits = await Audit.find().sort({ createdAt: -1 }).limit(40);
    const payouts = await AffiliatePayout.find().sort({ createdAt: -1 }).limit(30);
    const payoutTotalsAgg = await AffiliatePayout.aggregate([
      { $group: { _id: '$status', total: { $sum: '$amount' } } },
    ]);

    const statusCounts = orders.reduce((acc, o) => {
      acc[o.status] = (acc[o.status] || 0) + 1;
      return acc;
    }, {});
    const invoiceStatusCounts = invoices.reduce((acc, inv) => {
      acc[inv.status] = (acc[inv.status] || 0) + 1;
      return acc;
    }, {});
    const revenue = invoices
      .filter((i) => i.status === 'PAGA')
      .reduce(
        (acc, i) => ({
          total: acc.total + (i.amount || 0),
          count: acc.count + 1,
        }),
        { total: 0, count: 0 }
      );
    const affiliateTotals = orders.reduce(
      (acc, o) => {
        acc.total += o.referralCommission || 0;
        acc.paid += o.referralPaid ? o.referralCommission || 0 : 0;
        return acc;
      },
      { total: 0, paid: 0 }
    );
    const payoutTotals = payoutTotalsAgg.reduce(
      (acc, row) => {
        acc.total += row.total || 0;
        if (row._id === 'PAGO') acc.paid += row.total || 0;
        return acc;
      },
      { total: 0, paid: 0 }
    );
    const timeSeries = invoices.reduce(
      (acc, inv) => {
        const key = new Date(inv.createdAt).toISOString().slice(0, 10);
        acc[key] = acc[key] || { emitidas: 0, pagas: 0, valor: 0 };
        acc[key].emitidas += 1;
        if (inv.status === 'PAGA') {
          acc[key].pagas += 1;
          acc[key].valor += inv.amount || 0;
        }
        return acc;
      },
      {}
    );
    const auditSummary = {
      lastLogins: audits.filter((a) => ['SIGNIN', 'SIGNUP', 'SIGNUP_ADMIN'].includes(a.action)).length,
      paymentValidations: audits.filter((a) => a.action === 'VALIDAR_PAGAMENTO').length,
      uploads: audits.filter((a) => a.action && a.action.includes('UPLOAD')).length,
      resetRequests: audits.filter((a) => a.action && a.action.includes('RESET')).length,
      uniqueIps: new Set(audits.map((a) => a.metadata?.ip).filter(Boolean)).size,
      totalAudits: await Audit.countDocuments(),
    };

    res.json({
      orders,
      invoices,
      audits,
      statusCounts,
      invoiceStatusCounts,
      revenue,
      auditSummary,
      affiliateTotals,
      payoutTotals,
      timeSeries,
      payouts,
    });
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

    if (order.referrer && !order.referralPaid && order.referralCommission > 0) {
      const refUser = await User.findById(order.referrer);
      if (refUser) {
        refUser.affiliateBalance += order.referralCommission;
        refUser.affiliateTotalEarned += order.referralCommission;
        await refUser.save();
      }
      order.referralPaid = true;
    }

    await invoice.save();
    await order.save();
    await notifyInvoice(invoice, order, 'Pagamento validado');
    await logAudit(
      {
        user: req.user._id,
        role: req.user.role,
        action: 'VALIDAR_PAGAMENTO',
        entityType: 'Order',
        entityId: order._id.toString(),
        metadata: { referralPaid: order.referralPaid },
      },
      req
    );
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
    await logAudit(
      {
        user: req.user._id,
        role: req.user.role,
        action: 'REJEITAR_PAGAMENTO',
        entityType: 'Order',
        entityId: order._id.toString(),
        metadata: { reason: invoice.rejectionReason },
      },
      req
    );
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
    await logAudit(
      {
        user: req.user._id,
        role: req.user.role,
        action: 'UPLOAD_TRABALHO_FINAL',
        entityType: 'Order',
        entityId: order._id.toString(),
      },
      req
    );
    res.json({ message: 'Trabalho final carregado', order });
  } catch (err) {
    res.status(500).json({ message: 'Erro ao subir trabalho final', error: err.message });
  }
};

exports.listUsers = async (req, res) => {
  try {
    const users = await User.find();
    const summary = users.reduce(
      (acc, u) => {
        acc[u.role] = (acc[u.role] || 0) + 1;
        if (!u.active) acc.inativos += 1;
        return acc;
      },
      { inativos: 0 }
    );
    res.json({ users, summary });
  } catch (err) {
    res.status(500).json({ message: 'Erro ao listar utilizadores', error: err.message });
  }
};

exports.updateUser = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ message: 'Utilizador não encontrado' });
    if (req.body.role) user.role = req.body.role;
    if (req.body.active !== undefined) user.active = req.body.active;
    await user.save();
    await logAudit(
      {
        user: req.user._id,
        role: req.user.role,
        action: 'ATUALIZAR_UTILIZADOR',
        entityType: 'User',
        entityId: user._id.toString(),
        metadata: { role: user.role, active: user.active },
      },
      req
    );
    res.json({ message: 'Utilizador atualizado', user });
  } catch (err) {
    res.status(500).json({ message: 'Erro ao atualizar utilizador', error: err.message });
  }
};

exports.listAffiliates = async (req, res) => {
  try {
    const affiliates = await User.find({ referralCode: { $exists: true } }).select(
      'name email affiliateBalance affiliateTotalEarned referralCode active role'
    );
    const payouts = await AffiliatePayout.find().sort({ createdAt: -1 }).limit(40).populate('user');
    res.json({ affiliates, payouts });
  } catch (err) {
    res.status(500).json({ message: 'Erro ao carregar afiliados', error: err.message });
  }
};

exports.createPayout = async (req, res) => {
  try {
    const { userId, amount, note } = req.body;
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: 'Afiliado não encontrado' });
    const pendingTotal = await AffiliatePayout.aggregate([
      { $match: { user: user._id, status: 'PENDENTE' } },
      { $group: { _id: null, total: { $sum: '$amount' } } },
    ]);
    const pending = pendingTotal[0]?.total || 0;
    const available = user.affiliateBalance - pending;
    if (amount > available) return res.status(400).json({ message: 'Saldo insuficiente para pagar este montante' });

    const payout = await AffiliatePayout.create({ user: user._id, amount, note });
    await logAudit(
      {
        user: req.user._id,
        role: req.user.role,
        action: 'CRIAR_PAGAMENTO_AFILIADO',
        entityType: 'AffiliatePayout',
        entityId: payout._id.toString(),
        metadata: { amount, note },
      },
      req
    );
    res.status(201).json({ payout });
  } catch (err) {
    res.status(500).json({ message: 'Erro ao registar pagamento de afiliado', error: err.message });
  }
};

exports.processPayout = async (req, res) => {
  try {
    const payout = await AffiliatePayout.findById(req.params.id);
    if (!payout) return res.status(404).json({ message: 'Registo não encontrado' });
    const user = await User.findById(payout.user);
    if (!user) return res.status(404).json({ message: 'Utilizador afiliado não encontrado' });

    const status = req.body.status;
    if (!['PAGO', 'RECUSADO'].includes(status)) {
      return res.status(400).json({ message: 'Estado inválido' });
    }

    if (status === 'PAGO' && user.affiliateBalance < payout.amount) {
      return res.status(400).json({ message: 'Saldo insuficiente; ajuste o valor ou valide novamente' });
    }

    payout.status = status;
    payout.note = req.body.note || payout.note;
    payout.admin = req.user._id;
    payout.processedAt = new Date();
    await payout.save();

    if (status === 'PAGO') {
      user.affiliateBalance -= payout.amount;
      await user.save();
    }

    await logAudit(
      {
        user: req.user._id,
        role: req.user.role,
        action: 'PROCESSAR_PAGAMENTO_AFILIADO',
        entityType: 'AffiliatePayout',
        entityId: payout._id.toString(),
        metadata: { status, amount: payout.amount },
      },
      req
    );

    res.json({ payout, user });
  } catch (err) {
    res.status(500).json({ message: 'Erro ao processar pagamento', error: err.message });
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
    await logAudit(
      {
        user: req.user._id,
        role: req.user.role,
        action: 'EXPIRAR_FATURA',
        entityType: 'Order',
        entityId: order._id.toString(),
      },
      req
    );

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

    await logAudit(
      {
        user: req.user._id,
        role: req.user.role,
        action: 'ATUALIZAR_PEDIDO_ESPECIAL',
        entityType: 'ServiceRequest',
        entityId: request._id.toString(),
        metadata: { status, invoiceAmount },
      },
      req
    );

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
    await logAudit(
      {
        user: req.user._id,
        role: req.user.role,
        action: 'BROADCAST_EMAIL',
        entityType: 'User',
        entityId: 'all',
      },
      req
    );
    res.json({ message: 'Emails enviados' });
  } catch (err) {
    res.status(500).json({ message: 'Erro ao enviar emails', error: err.message });
  }
};
