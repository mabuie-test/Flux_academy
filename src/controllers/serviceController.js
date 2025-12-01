const ServiceRequest = require('../models/ServiceRequest');
const { sendMail } = require('../utils/mailer');
const { logAudit } = require('../utils/audit');

exports.createServiceRequest = async (req, res) => {
  try {
    const { type, contactName, contactEmail, contactPhone, details, goals } = req.body;
    if (!type || !contactName || !contactEmail || !details) {
      return res.status(400).json({ message: 'Campos obrigatórios em falta' });
    }
    const request = await ServiceRequest.create({
      user: req.user._id,
      type,
      contactName,
      contactEmail,
      contactPhone,
      details,
      goals,
    });
    await sendMail({
      to: contactEmail,
      subject: 'Pedido especial recebido',
      html: `<p>Recebemos o seu pedido (${type}). Entraremos em contacto com o orçamento final.</p>`,
    });
    await logAudit({
      user: req.user._id,
      role: req.user.role,
      action: 'CRIAR_PEDIDO_ESPECIAL',
      entityType: 'ServiceRequest',
      entityId: request._id.toString(),
    });
    res.status(201).json({ request });
  } catch (err) {
    res.status(500).json({ message: 'Erro ao criar pedido especial', error: err.message });
  }
};

exports.myServiceRequests = async (req, res) => {
  try {
    const requests = await ServiceRequest.find({ user: req.user._id });
    res.json({ requests });
  } catch (err) {
    res.status(500).json({ message: 'Erro ao listar pedidos', error: err.message });
  }
};
