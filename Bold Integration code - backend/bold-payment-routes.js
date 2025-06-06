const express = require('express');
const router = express.Router();
const { authenticate } = require('../middlewares/auth.middleware');
const { validateBody } = require('../middlewares/validation.middleware');
const boldTerminalController = require('../controllers/boldTerminal.controller');

/**
 * Bold Terminal Payment Routes
 * Base path: /api/v1/payments/bold-terminal
 */

// Create a new terminal charge
router.post(
  '/charge',
  authenticate,
  validateBody({
    order_id: 'required|string',
    ticket_tier_id: 'required|string',
    amount: 'required|number|min:1',
    terminal_id: 'required|string',
    event_id: 'string'
  }),
  boldTerminalController.createCharge
);

// Get charge status
router.get(
  '/charge/:chargeId',
  authenticate,
  boldTerminalController.getChargeStatus
);

// Manually trigger reconciliation
router.post(
  '/reconcile/:chargeId',
  authenticate,
  boldTerminalController.reconcileCharge
);

module.exports = router;