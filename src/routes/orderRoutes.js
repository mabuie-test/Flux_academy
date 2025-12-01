const express = require('express');
const multer = require('multer');
const path = require('path');
const { auth } = require('../middleware/auth');
const { createOrder, getOrders, getOrderById, uploadProof, downloadFinal, quotePrice } = require('../controllers/orderController');

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

const proofUpload = multer({ storage: proofStorage });

router.post('/', auth, createOrder);
router.get('/', auth, getOrders);
router.post('/quote', auth, quotePrice);
router.get('/:id', auth, getOrderById);
router.post('/:id/upload-proof', auth, proofUpload.single('proof'), uploadProof);
router.get('/:id/download-work', auth, downloadFinal);

module.exports = router;
