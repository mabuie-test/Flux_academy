const express = require('express');
const multer = require('multer');
const path = require('path');
const { auth } = require('../middleware/auth');
const {
  createOrder,
  getOrders,
  getOrderById,
  uploadProof,
  downloadFinal,
  quotePrice,
  downloadInvoicePdf,
} = require('../controllers/orderController');

const router = express.Router();

const proofStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, path.join(__dirname, '../../uploads/comprovativos'));
  },
  filename: function (req, file, cb) {
    const unique = `${Date.now()}-${file.originalname}`;
    cb(null, unique);
  },
});

const proofUpload = multer({
  storage: proofStorage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ['application/pdf', 'image/jpeg', 'image/png'];
    if (!allowed.includes(file.mimetype)) return cb(new Error('Formato inválido. Use pdf/jpg/png.'));
    cb(null, true);
  },
});

router.post('/', auth, createOrder);
router.get('/', auth, getOrders);
router.post('/quote', auth, quotePrice);
router.get('/:id', auth, getOrderById);
router.post('/:id/upload-proof', auth, proofUpload.single('proof'), uploadProof);
router.get('/:id/download-work', auth, downloadFinal);
router.get('/:id/invoice/pdf', auth, downloadInvoicePdf);

module.exports = router;
