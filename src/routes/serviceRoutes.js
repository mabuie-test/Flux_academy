const express = require('express');
const { auth } = require('../middleware/auth');
const { createServiceRequest, myServiceRequests } = require('../controllers/serviceController');

const router = express.Router();

router.post('/', auth, createServiceRequest);
router.get('/', auth, myServiceRequests);

module.exports = router;
