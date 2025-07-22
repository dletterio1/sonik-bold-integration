import express from 'express';
import AuthMiddleware from '../middlewares/auth.middlewares.js';
import GlobalMiddlewares from '../middlewares/global.middlewares.js';
import BoldTerminalController from '../controllers/boldTerminal.controller.js';

const router = express.Router();
const { authenticate } = AuthMiddleware;
const { validateBody } = GlobalMiddlewares;

/**
 * Bold Terminal Payment Routes
 * Base path: /api/v1/payments/bold-terminal
 */

// Create a new terminal charge
router.post(
  '/charge',
  authenticate,
  BoldTerminalController.createCharge
);

// Get charge status
router.get(
  '/charge/:chargeId',
  authenticate,
  BoldTerminalController.getChargeStatus
);

// Manually trigger reconciliation
router.post(
  '/reconcile/:chargeId',
  authenticate,
  BoldTerminalController.reconcileCharge
);

export default router;