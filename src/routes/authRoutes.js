const express = require('express');
const router = express.Router();
const { signup, signin, requestReset, resetPassword, adminSignup } = require('../controllers/authController');

router.post('/signup', signup);
router.post('/admin/signup', adminSignup);
router.post('/signin', signin);
router.post('/forgot', requestReset);
router.post('/reset', resetPassword);

module.exports = router;
