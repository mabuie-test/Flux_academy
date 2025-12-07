const path = require('path');
const PDFDocument = require('pdfkit');
const Order = require('../models/Order');
const Invoice = require('../models/Invoice');
const User = require('../models/User');
const { calculatePrice } = require('../utils/pricing');
const { sendMail, invoiceEmailTemplate } = require('../utils/mailer');
const { logAudit } = require('../utils/audit');

const ALLOWED_LEVELS = ['tecnico', 'licenciatura', 'mestrado', 'doutoramento'];
const ALLOWED_COMPLEXITIES = ['basica', 'intermedia', 'avancada'];
const ALLOWED_URGENCIES = ['normal', '72h', '48h', '24h'];

function addOrderHistory(order, status, note) {
  order.statusHistory.push({ status, note, changedAt: new Date() });
}

function addInvoiceHistory(invoice, status, note) {
  invoice.statusHistory.push({ status, note, changedAt: new Date() });
}

function validatePayload({
  workType,
  area,
  academicLevel,
  pages,
  formatting,
  complexity,
  urgency,
  description,
  hasMaterials,
  materialsUsagePercent,
}) {
  if (!workType || !area || !formatting || !description) return 'Campos obrigatórios em falta';
  if (!ALLOWED_LEVELS.includes(academicLevel)) return 'Nível académico inválido';
  if (!ALLOWED_COMPLEXITIES.includes(complexity)) return 'Complexidade inválida';
  if (!ALLOWED_URGENCIES.includes(urgency)) return 'Urgência inválida';
  const pageNum = Number(pages);
  if (Number.isNaN(pageNum) || pageNum < 1) return 'Número de páginas inválido';
  if (hasMaterials === true || hasMaterials === 'true' || hasMaterials === 'sim') {
    const percent = Number(materialsUsagePercent);
    if (Number.isNaN(percent) || percent < 0 || percent > 100) return 'Percentagem de uso dos materiais inválida';
  }
  return null;
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
      console.error('Falha ao enviar email de fatura', err.message);
    }
  }
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
      hasMaterials,
      materialsUsagePercent,
    } = req.body;

    const validationError = validatePayload({
      workType,
      area,
      academicLevel,
      pages,
      formatting,
      complexity,
      urgency,
      description,
      hasMaterials,
      materialsUsagePercent,
    });
    if (validationError) return res.status(400).json({ message: validationError });

    const parsedHasMaterials = hasMaterials === true || hasMaterials === 'true' || hasMaterials === 'sim';
    const parsedMaterialsUsage = materialsUsagePercent ? Number(materialsUsagePercent) : undefined;
    const materialsFiles = Array.isArray(req.files) ? req.files.map((f) => f.filename) : [];

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
      hasMaterials: parsedHasMaterials,
      materialsUsagePercent: parsedHasMaterials ? parsedMaterialsUsage : undefined,
      materialsFiles,
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
    await notifyInvoice(invoice, order, 'Fatura emitida');
    await logAudit(
      {
        user: req.user._id,
        role: req.user.role,
        action: 'CRIACAO_ENCOMENDA',
        entityType: 'Order',
        entityId: order._id.toString(),
        metadata: { invoice: invoice.invoiceNumber },
      },
      req
    );

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
    await notifyInvoice(invoice, order, 'Comprovativo submetido');
    await logAudit(
      {
        user: req.user._id,
        role: req.user.role,
        action: 'UPLOAD_COMPROVATIVO',
        entityType: 'Invoice',
        entityId: invoice._id.toString(),
        metadata: { file: invoice.proofFile },
      },
      req
    );

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
    await logAudit(
      {
        user: req.user._id,
        role: req.user.role,
        action: 'DOWNLOAD_TRABALHO',
        entityType: 'Order',
        entityId: order._id.toString(),
      },
      req
    );
    res.download(filePath);
  } catch (err) {
    res.status(500).json({ message: 'Erro ao descarregar trabalho', error: err.message });
  }
};

exports.downloadInvoicePdf = async (req, res) => {
  try {
    const order = await Order.findOne({ _id: req.params.id, user: req.user._id });
    if (!order) return res.status(404).json({ message: 'Encomenda não encontrada' });
    const invoice = await Invoice.findOne({ order: order._id });
    if (!invoice) return res.status(404).json({ message: 'Fatura não encontrada' });

    const doc = new PDFDocument({ margin: 40 });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=fatura-${invoice.invoiceNumber}.pdf`);
    doc.pipe(res);

    doc.fontSize(18).text(`Fatura #${invoice.invoiceNumber}`, { align: 'center' });
    doc.moveDown();
    doc.fontSize(12).text(`Serviço: ${invoice.summary}`);
    doc.text(`Cliente: ${req.user.name || req.user.email}`);
    doc.text(`Valor: ${invoice.amount}`);
    doc.text(`Estado: ${invoice.status}`);
    doc.text(`Vencimento: ${new Date(invoice.dueDate).toLocaleString()}`);
    doc.moveDown();
    doc.text('Detalhes de preço:');
    doc.text(`Base por página: ${invoice.priceFactors.basePerPage}`);
    doc.text(`Fator nível: ${invoice.priceFactors.levelFactor}`);
    doc.text(`Fator complexidade: ${invoice.priceFactors.complexityFactor}`);
    doc.text(`Fator urgência: ${invoice.priceFactors.urgencyFactor}`);
    doc.moveDown();
    doc.text('Pagamento via M-Pesa:');
    doc.text('Número: 851619970');
    doc.text('Titular: Maria António Chicavele');
    doc.text('Após pagamento, submeta o comprovativo na plataforma.');
    doc.end();
  } catch (err) {
    res.status(500).json({ message: 'Erro ao gerar PDF', error: err.message });
  }
};
