const nodemailer = require('nodemailer');

function buildTransporter() {
  if (!process.env.SMTP_HOST) {
    return null;
  }
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT) || 587,
    secure: false,
    auth: process.env.SMTP_USER
      ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
      : undefined,
  });
}

const transporter = buildTransporter();
const defaultFrom = process.env.SMTP_FROM || 'Flux Academy <no-reply@flux.academy>';

async function sendMail({ to, subject, html }) {
  if (!transporter) {
    console.log('SMTP não configurado. Email simulado:', { to, subject });
    return { simulated: true };
  }
  return transporter.sendMail({ from: defaultFrom, to, subject, html });
}

function invoiceEmailTemplate(invoice, order, statusLabel) {
  return `
    <h2>Atualização da fatura #${invoice.invoiceNumber}</h2>
    <p>Estado: <strong>${statusLabel || invoice.status}</strong></p>
    <p>Resumo: ${invoice.summary}</p>
    <p>Valor: <strong>${invoice.amount}</strong></p>
    <p>Pagamento via M-Pesa: número <strong>${invoice.mpesaNumber}</strong> | titular <strong>${invoice.mpesaHolder}</strong>.</p>
    <p>Prazo: ${new Date(invoice.dueDate).toLocaleString()}</p>
    <p>Esta é uma notificação automática de estado.</p>
  `;
}

module.exports = { sendMail, invoiceEmailTemplate };
