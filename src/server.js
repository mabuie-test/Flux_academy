require('dotenv').config();
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const path = require('path');
const fs = require('fs');
const connectDB = require('./config/db');
const authRoutes = require('./routes/authRoutes');
const orderRoutes = require('./routes/orderRoutes');
const adminRoutes = require('./routes/adminRoutes');

const app = express();

fs.mkdirSync(path.join(__dirname, '../uploads/comprovativos'), { recursive: true });
fs.mkdirSync(path.join(__dirname, '../uploads/trabalhos'), { recursive: true });

app.use(cors());
app.use(express.json());
app.use(morgan('dev'));
app.use(express.urlencoded({ extended: true }));

app.use(express.static(path.join(__dirname, '../public')));
app.use('/uploads/comprovativos', express.static(path.join(__dirname, '../uploads/comprovativos')));
app.use('/uploads/trabalhos', express.static(path.join(__dirname, '../uploads/trabalhos')));

app.use('/api/auth', authRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/admin', adminRoutes);

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

const PORT = process.env.PORT || 4000;

async function start() {
  await connectDB(process.env.MONGODB_URI);
  app.listen(PORT, () => console.log(`Servidor a correr na porta ${PORT}`));
}

start();
