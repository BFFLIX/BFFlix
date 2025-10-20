const express = require('express');
const router = express.Router();
const streamingServiceController = require('../controllers/streamingService.controller');
const { requireAuth } = require('../middleware/auth');

// Public route - get all available streaming services
router.get('/streaming-services', streamingServiceController.getAllServices);

// Protected routes - require authentication
router.get(
  '/users/me/streaming-services',
  requireAuth,
  streamingServiceController.getUserServices
);

router.post(
  '/users/me/streaming-services',
  requireAuth,
  streamingServiceController.addUserService
);

router.delete(
  '/users/me/streaming-services/:id',
  requireAuth,
  streamingServiceController.removeUserService
);

// Admin route - seed initial data
router.post(
  '/admin/streaming-services/seed',
  streamingServiceController.seedServices
);

module.exports = router;