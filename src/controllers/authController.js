const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const User = require('../models/User');
const { sendMail, passwordResetTemplate } = require('../utils/mailer');
const { logAudit } = require('../utils/audit');

function createToken(user) {
  return jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET, { expiresIn: '2d' });
}

exports.signup = async (req, res) => {
  try {
    const { name, email, password, role } = req.body;
    const exists = await User.findOne({ email });
    if (exists) return res.status(400).json({ message: 'Email já registado' });
    const user = await User.create({ name, email, password, role: role === 'admin' ? 'admin' : 'client' });
    const token = createToken(user);
    await logAudit(
      { user: user._id, role: user.role, action: 'SIGNUP', entityType: 'User', entityId: user._id.toString() },
      req
    );
    res.json({ token, user: { id: user._id, name: user.name, email: user.email, role: user.role } });
  } catch (err) {
    res.status(500).json({ message: 'Erro no registo', error: err.message });
  }
};

exports.adminSignup = async (req, res) => {
  try {
    if (process.env.ADMIN_SETUP_TOKEN && req.headers['x-admin-setup-token'] !== process.env.ADMIN_SETUP_TOKEN) {
      return res.status(403).json({ message: 'Token de configuração de admin inválido' });
    }

    const { name, email, password } = req.body;
    const exists = await User.findOne({ email });
    if (exists) return res.status(400).json({ message: 'Email já registado' });
    const user = await User.create({ name, email, password, role: 'admin' });
    const token = createToken(user);
    await logAudit(
      { user: user._id, role: user.role, action: 'SIGNUP_ADMIN', entityType: 'User', entityId: user._id.toString() },
      req
    );
    res.json({ token, user: { id: user._id, name: user.name, email: user.email, role: user.role } });
  } catch (err) {
    res.status(500).json({ message: 'Erro no registo de admin', error: err.message });
  }
};

exports.signin = async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ message: 'Credenciais inválidas' });
    const match = await user.comparePassword(password);
    if (!match) return res.status(400).json({ message: 'Credenciais inválidas' });
    const token = createToken(user);
    await logAudit(
      { user: user._id, role: user.role, action: 'SIGNIN', entityType: 'User', entityId: user._id.toString() },
      req
    );
    res.json({ token, user: { id: user._id, name: user.name, email: user.email, role: user.role } });
  } catch (err) {
    res.status(500).json({ message: 'Erro no login', error: err.message });
  }
};

exports.requestReset = async (req, res) => {
  try {
    const { email } = req.body;
    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ message: 'Email não encontrado' });
    const token = crypto.randomBytes(20).toString('hex');
    user.passwordResetToken = token;
    user.passwordResetExpires = new Date(Date.now() + 60 * 60 * 1000);
    await user.save();
    await sendMail({
      to: email,
      subject: 'Recuperação de senha - Flux Academy',
      html: passwordResetTemplate(token),
    });
    await logAudit(
      { user: user._id, role: user.role, action: 'PEDIDO_RESET', entityType: 'User', entityId: user._id.toString() },
      req
    );
    res.json({ message: 'Token enviado para o email. Caso não visualize em alguns minutos, verifique spam ou contacte o suporte.' });
  } catch (err) {
    res.status(500).json({ message: 'Erro ao solicitar reset', error: err.message });
  }
};

exports.resetPassword = async (req, res) => {
  try {
    const { token, password } = req.body;
    const user = await User.findOne({ passwordResetToken: token, passwordResetExpires: { $gt: new Date() } });
    if (!user) return res.status(400).json({ message: 'Token inválido ou expirado' });
    user.password = password;
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;
    await user.save();
    await logAudit(
      { user: user._id, role: user.role, action: 'RESET_PASSWORD', entityType: 'User', entityId: user._id.toString() },
      req
    );
    res.json({ message: 'Senha atualizada' });
  } catch (err) {
    res.status(500).json({ message: 'Erro ao redefinir senha', error: err.message });
  }
};
