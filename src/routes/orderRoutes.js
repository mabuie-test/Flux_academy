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
const {
  submitFeedback,
  getFeedback,
  replyFeedback,
  getAffiliateSummary,
} = require('../controllers/feedbackController');

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

const materialsStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, path.join(__dirname, '../../uploads/materiais'));
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

const orderUpload = multer({
  storage: materialsStorage,
  limits: { fileSize: 7 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = [
      'application/pdf',
      'image/jpeg',
      'image/png',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/msword',
    ];
    if (!allowed.includes(file.mimetype)) return cb(new Error('Formato inválido para materiais'));
    cb(null, true);
  },
});

router.post('/', auth, orderUpload.array('materials', 5), createOrder);
router.get('/', auth, getOrders);
router.get('/affiliate/summary', auth, getAffiliateSummary);
router.post('/quote', auth, quotePrice);
router.get('/:id/feedback', auth, getFeedback);
router.post('/:id/feedback', auth, submitFeedback);
router.post('/:id/feedback/reply', auth, replyFeedback);
router.get('/:id/invoice/pdf', auth, downloadInvoicePdf);
router.get('/:id', auth, getOrderById);
router.post('/:id/upload-proof', auth, proofUpload.single('proof'), uploadProof);
router.get('/:id/download-work', auth, downloadFinal);

module.exports = router;
