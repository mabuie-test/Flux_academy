const jwt = require('jsonwebtoken');
const User = require('../models/User');

async function auth(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Token não fornecido' });
  }
  const token = header.replace('Bearer ', '');
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id);
    if (!user) return res.status(401).json({ message: 'Utilizador não encontrado' });
    req.user = user;
    next();
  } catch (err) {
    res.status(401).json({ message: 'Token inválido' });
  }
}

function isAdmin(req, res, next) {
  if (req.user && req.user.role === 'admin') return next();
  return res.status(403).json({ message: 'Acesso restrito a administradores' });
}

module.exports = { auth, isAdmin };
