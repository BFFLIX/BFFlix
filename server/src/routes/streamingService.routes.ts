import express from 'express';
const router = express.Router();
import streamingServiceController from '../controllers/streamingService.controller';
import { requireAuth } from '../middleware/auth';
import { requireAdmin } from "../middleware/requireAdmin";

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
  requireAdmin,
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

export default router;