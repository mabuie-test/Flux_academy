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
  listServiceRequests,
  updateServiceRequest,
  broadcastEmail,
} = require('../controllers/adminController');
const { getFeedback, replyFeedback } = require('../controllers/feedbackController');

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

const workUpload = multer({
  storage: workStorage,
  limits: { fileSize: 15 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ];
    if (!allowed.includes(file.mimetype)) return cb(new Error('Envie apenas pdf/doc/docx.'));
    cb(null, true);
  },
});

router.get('/orders', auth, isAdmin, listOrders);
router.get('/orders/:id', auth, isAdmin, getOrderDetail);
router.post('/orders/:id/validate-payment', auth, isAdmin, validatePayment);
router.post('/orders/:id/reject-payment', auth, isAdmin, rejectPayment);
router.post('/orders/:id/upload-work', auth, isAdmin, workUpload.single('finalWork'), uploadFinalWork);
router.post('/orders/:id/expire', auth, isAdmin, expireInvoice);
router.get('/orders/:id/feedback', auth, isAdmin, getFeedback);
router.post('/orders/:id/feedback/reply', auth, isAdmin, replyFeedback);
router.get('/services', auth, isAdmin, listServiceRequests);
router.post('/services/:id', auth, isAdmin, updateServiceRequest);
router.post('/broadcast', auth, isAdmin, broadcastEmail);

module.exports = router;
