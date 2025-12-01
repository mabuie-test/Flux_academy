const path = require('path');
const Order = require('../models/Order');
const Invoice = require('../models/Invoice');
const { calculatePrice } = require('../utils/pricing');

const ALLOWED_LEVELS = ['tecnico', 'licenciatura', 'mestrado', 'doutoramento'];
const ALLOWED_COMPLEXITIES = ['basica', 'intermedia', 'avancada'];
const ALLOWED_URGENCIES = ['normal', '72h', '48h', '24h'];

function addOrderHistory(order, status, note) {
  order.statusHistory.push({ status, note, changedAt: new Date() });
}

function addInvoiceHistory(invoice, status, note) {
  invoice.statusHistory.push({ status, note, changedAt: new Date() });
}

function validatePayload({ workType, area, academicLevel, pages, formatting, complexity, urgency, description }) {
  if (!workType || !area || !formatting || !description) return 'Campos obrigatórios em falta';
  if (!ALLOWED_LEVELS.includes(academicLevel)) return 'Nível académico inválido';
  if (!ALLOWED_COMPLEXITIES.includes(complexity)) return 'Complexidade inválida';
  if (!ALLOWED_URGENCIES.includes(urgency)) return 'Urgência inválida';
  const pageNum = Number(pages);
  if (Number.isNaN(pageNum) || pageNum < 1) return 'Número de páginas inválido';
  return null;
}

exports.createOrder = async (req, res) => {
  try {
    const {
      workType,
      area,
      academicLevel,
      pages,
      formatting,
      complexity,
      urgency,
      description,
      deliveryDeadline,
    } = req.body;

    const validationError = validatePayload({ workType, area, academicLevel, pages, formatting, complexity, urgency, description });
    if (validationError) return res.status(400).json({ message: validationError });

    const priceBreakdown = calculatePrice({ pages, academicLevel, complexity, urgency });
    const paymentDeadline = new Date(Date.now() + 24 * 60 * 60 * 1000);

    const order = await Order.create({
      user: req.user._id,
      workType,
      area,
      academicLevel,
      pages,
      formatting,
      complexity,
      urgency,
      description,
      deliveryDeadline,
      paymentDeadline,
      priceBreakdown,
      statusHistory: [{ status: 'PENDENTE_PAGAMENTO', note: 'Pedido criado', changedAt: new Date() }],
    });

    const invoice = await Invoice.create({
      order: order._id,
      user: req.user._id,
      dueDate: paymentDeadline,
      summary: `${workType} - ${area}`,
      amount: priceBreakdown.total,
      priceFactors: {
        basePerPage: priceBreakdown.basePerPage,
        levelFactor: priceBreakdown.levelFactor,
        complexityFactor: priceBreakdown.complexityFactor,
        urgencyFactor: priceBreakdown.urgencyFactor,
      },
      statusHistory: [{ status: 'EMITIDA', note: 'Fatura criada automaticamente', changedAt: new Date() }],
    });

    res.status(201).json({ order, invoice });
  } catch (err) {
    res.status(500).json({ message: 'Erro ao criar encomenda', error: err.message });
  }
};

exports.quotePrice = (req, res) => {
  try {
    const { pages, academicLevel, complexity, urgency } = req.body;
    const validationError = validatePayload({
      workType: 'preview',
      area: 'preview',
      academicLevel,
      pages,
      formatting: 'preview',
      complexity,
      urgency,
      description: 'preview',
    });
    if (validationError) return res.status(400).json({ message: validationError });
    const breakdown = calculatePrice({ pages, academicLevel, complexity, urgency });
    res.json({ breakdown });
  } catch (err) {
    res.status(500).json({ message: 'Erro ao simular preço', error: err.message });
  }
};

exports.getOrders = async (req, res) => {
  try {
    const orders = await Order.find({ user: req.user._id }).populate('user');
    const invoices = await Invoice.find({ user: req.user._id });
    res.json({ orders, invoices });
  } catch (err) {
    res.status(500).json({ message: 'Erro ao listar encomendas', error: err.message });
  }
};

exports.getOrderById = async (req, res) => {
  try {
    const order = await Order.findOne({ _id: req.params.id, user: req.user._id });
    if (!order) return res.status(404).json({ message: 'Encomenda não encontrada' });
    const invoice = await Invoice.findOne({ order: order._id });
    res.json({ order, invoice });
  } catch (err) {
    res.status(500).json({ message: 'Erro ao obter encomenda', error: err.message });
  }
};

exports.uploadProof = async (req, res) => {
  try {
    const order = await Order.findOne({ _id: req.params.id, user: req.user._id });
    if (!order) return res.status(404).json({ message: 'Encomenda não encontrada' });
    const invoice = await Invoice.findOne({ order: order._id });
    if (!invoice) return res.status(404).json({ message: 'Fatura não encontrada' });

    if (invoice.status === 'PAGA') {
      return res.status(400).json({ message: 'Pagamento já confirmado' });
    }

    invoice.proofFile = req.file ? req.file.filename : invoice.proofFile;
    invoice.status = 'PENDENTE_VALIDACAO';
    addInvoiceHistory(invoice, 'PENDENTE_VALIDACAO', 'Comprovativo submetido pelo cliente');
    order.status = 'PAGAMENTO_EM_VALIDACAO';
    addOrderHistory(order, 'PAGAMENTO_EM_VALIDACAO', 'Aguardando validação do administrador');

    await invoice.save();
    await order.save();

    res.json({ message: 'Comprovativo enviado', order, invoice });
  } catch (err) {
    res.status(500).json({ message: 'Erro ao enviar comprovativo', error: err.message });
  }
};

exports.downloadFinal = async (req, res) => {
  try {
    const order = await Order.findOne({ _id: req.params.id, user: req.user._id });
    if (!order || !order.finalFile)
      return res.status(404).json({ message: 'Trabalho final não disponível' });
    const invoice = await Invoice.findOne({ order: order._id });
    if (!invoice || invoice.status !== 'PAGA' || order.status !== 'CONCLUIDA') {
      return res.status(403).json({ message: 'Pagamento ainda não confirmado' });
    }
    const filePath = path.join(__dirname, '../../uploads/trabalhos', order.finalFile);
    res.download(filePath);
  } catch (err) {
    res.status(500).json({ message: 'Erro ao descarregar trabalho', error: err.message });
  }
};
