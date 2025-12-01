const express = require('express');
const multer = require('multer');
const path = require('path');
const { auth, isAdmin } = require('../middleware/auth');
const {
  listOrders,
  getOrderDetail,
  validatePayment,
  rejectPayment,
  uploadFinalWork,
  expireInvoice,
} = require('../controllers/adminController');

const router = express.Router();

const workStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, path.join(__dirname, '../../uploads/trabalhos'));
  },
  filename: function (req, file, cb) {
    const unique = `${Date.now()}-${file.originalname}`;
    cb(null, unique);
  },
});

const workUpload = multer({ storage: workStorage });

router.get('/orders', auth, isAdmin, listOrders);
router.get('/orders/:id', auth, isAdmin, getOrderDetail);
router.post('/orders/:id/validate-payment', auth, isAdmin, validatePayment);
router.post('/orders/:id/reject-payment', auth, isAdmin, rejectPayment);
router.post('/orders/:id/upload-work', auth, isAdmin, workUpload.single('finalWork'), uploadFinalWork);
router.post('/orders/:id/expire', auth, isAdmin, expireInvoice);

module.exports = router;
