const Order = require('../models/Order');
const Invoice = require('../models/Invoice');

function addOrderHistory(order, status, note) {
  order.statusHistory.push({ status, note, changedAt: new Date() });
}

function addInvoiceHistory(invoice, status, note) {
  invoice.statusHistory.push({ status, note, changedAt: new Date() });
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

    res.json({ message: 'Estado de expiração avaliado', order, invoice });
  } catch (err) {
    res.status(500).json({ message: 'Erro ao marcar expiração', error: err.message });
  }
};
