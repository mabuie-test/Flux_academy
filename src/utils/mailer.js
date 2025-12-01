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

function finalDeliveryTemplate(order) {
  return `
    <h2>Trabalho final pronto para download</h2>
    <p>O seu pedido ${order.workType} (${order.area}) foi concluído.</p>
    <p>Aceda ao painel e faça download imediato do ficheiro final.</p>
    <p>Estado atual: <strong>${order.status}</strong></p>
  `;
}

function passwordResetTemplate(token) {
  return `
    <h2>Recuperação de senha</h2>
    <p>Use o token abaixo para redefinir a sua password:</p>
    <p style="font-size:20px;font-weight:bold;">${token}</p>
    <p>Se não pediu esta alteração, ignore este email.</p>
  `;
}

function serviceRequestTemplate(request) {
  return `
    <h2>Atualização do seu pedido especial</h2>
    <p>Categoria: ${request.category}</p>
    <p>Estado: <strong>${request.status}</strong></p>
    <p>${request.invoiceNote || 'A equipa irá detalhar o próximo passo em breve.'}</p>
    ${request.invoiceAmount ? `<p>Orçamento final: <strong>${request.invoiceAmount}</strong></p>` : ''}
  `;
}

function broadcastTemplate(message) {
  return `
    <h2>Comunicação da administração</h2>
    <p>${message || 'Atualização importante sobre a Flux Academy.'}</p>
  `;
}

module.exports = {
  sendMail,
  invoiceEmailTemplate,
  finalDeliveryTemplate,
  passwordResetTemplate,
  serviceRequestTemplate,
  broadcastTemplate,
};
