const Feedback = require('../models/Feedback');
const Order = require('../models/Order');
const Invoice = require('../models/Invoice');
const User = require('../models/User');
const { sendMail } = require('../utils/mailer');
const { logAudit } = require('../utils/audit');

async function ensureOwnership(orderId, userId) {
  if (!userId) return Order.findById(orderId);
  return Order.findOne({ _id: orderId, user: userId });
}

exports.getFeedback = async (req, res) => {
  try {
    const orderId = req.params.id;
    const order = await ensureOwnership(orderId, req.user.role === 'admin' ? undefined : req.user._id);
    if (!order && req.user.role !== 'admin') return res.status(404).json({ message: 'Encomenda não encontrada' });
    const feedback = await Feedback.findOne({ order: orderId }) || null;
    res.json({ feedback });
  } catch (err) {
    res.status(500).json({ message: 'Erro ao carregar feedback', error: err.message });
  }
};

exports.submitFeedback = async (req, res) => {
  try {
    const order = await Order.findOne({ _id: req.params.id, user: req.user._id });
    if (!order) return res.status(404).json({ message: 'Encomenda não encontrada' });
    const invoice = await Invoice.findOne({ order: order._id });
    if (!invoice || invoice.status !== 'PAGA' || order.status !== 'CONCLUIDA') {
      return res.status(400).json({ message: 'Só é possível avaliar trabalhos concluídos' });
    }
    const { rating, comment, gradeReceived } = req.body;
    const parsedRating = Number(rating);
    const payload = {
      order: order._id,
      user: req.user._id,
      rating: parsedRating >= 1 && parsedRating <= 5 ? parsedRating : undefined,
      comment,
      gradeReceived,
    };
    const feedback = await Feedback.findOneAndUpdate({ order: order._id }, payload, {
      new: true,
      upsert: true,
      setDefaultsOnInsert: true,
    });
    await logAudit(
      {
        user: req.user._id,
        role: req.user.role,
        action: 'FEEDBACK_CLIENTE',
        entityType: 'Order',
        entityId: order._id.toString(),
      },
      req
    );
    res.json({ feedback, message: 'Feedback registado' });
  } catch (err) {
    res.status(500).json({ message: 'Erro ao enviar feedback', error: err.message });
  }
};

exports.replyFeedback = async (req, res) => {
  try {
    const orderId = req.params.id;
    const feedback = await Feedback.findOne({ order: orderId });
    if (!feedback) return res.status(404).json({ message: 'Feedback não encontrado' });
    const from = req.user.role === 'admin' ? 'admin' : 'client';
    feedback.replies.push({ from, message: req.body.message });
    await feedback.save();
    if (from === 'admin') {
      const client = await User.findById(feedback.user);
      if (client) {
        try {
          await sendMail({
            to: client.email,
            subject: 'Resposta ao seu feedback',
            html: `<p>Recebemos uma resposta ao seu feedback: </p><p>${req.body.message}</p>`,
          });
        } catch (err) {
          console.error('Erro ao enviar email de resposta a feedback', err.message);
        }
      }
    }
    await logAudit(
      {
        user: req.user._id,
        role: req.user.role,
        action: from === 'admin' ? 'RESPOSTA_ADMIN_FEEDBACK' : 'RESPOSTA_CLIENTE_FEEDBACK',
        entityType: 'Order',
        entityId: orderId,
        metadata: { message: req.body.message },
      },
      req
    );
    res.json({ feedback });
  } catch (err) {
    res.status(500).json({ message: 'Erro ao responder', error: err.message });
  }
};

exports.getAffiliateSummary = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    const referredOrders = await Order.find({ referrer: req.user._id, referralPaid: true });
    const pendingOrders = await Order.find({ referrer: req.user._id, referralPaid: false });
    res.json({
      referralCode: user.referralCode,
      affiliateBalance: user.affiliateBalance,
      affiliateTotalEarned: user.affiliateTotalEarned,
      paidOrders: referredOrders.length,
      pendingOrders: pendingOrders.length,
    });
  } catch (err) {
    res.status(500).json({ message: 'Erro ao carregar afiliados', error: err.message });
  }
};
