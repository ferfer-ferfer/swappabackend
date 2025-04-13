const express = require('express');
const router = express.Router();
const classController = require('../controllers/classController');
const authenticateJWT = require('../middleware/auth'); // Import auth middleware

// Routes for classroom start/stop (only accessible by authenticated users)
router.post('/class/start', authenticateJWT, classController.markUserReady);
router.post('/class/stop', authenticateJWT, classController.stopClass);

module.exports = router;
