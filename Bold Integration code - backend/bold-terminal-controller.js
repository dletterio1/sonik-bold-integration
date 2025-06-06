const createError = require('http-errors');
const boldPaymentService = require('../services/boldPayment.service');

class BoldTerminalController {
  /**
   * Create a new terminal charge
   * POST /api/v1/payments/bold-terminal/charge
   */
  async createCharge(req, res, next) {
    try {
      const { order_id, ticket_tier_id, amount, terminal_id } = req.body;
      
      // Validate required fields
      if (!order_id || !ticket_tier_id || !amount || !terminal_id) {
        throw createError(400, 'Missing required fields: order_id, ticket_tier_id, amount, terminal_id');
      }
      
      // Validate amount
      if (typeof amount !== 'number' || amount <= 0) {
        throw createError(400, 'Amount must be a positive number in cents');
      }
      
      // Create charge
      const charge = await boldPaymentService.createCharge({
        orderId: order_id,
        ticketTierId: ticket_tier_id,
        amount,
        terminalId: terminal_id,
        metadata: {
          ipAddress: req.ip,
          userAgent: req.get('user-agent'),
          posClient: req.get('x-pos-client') || 'unknown',
          eventId: req.body.event_id
        }
      });
      
      res.status(201).json({
        success: true,
        data: charge
      });
      
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get charge status
   * GET /api/v1/payments/bold-terminal/charge/:chargeId
   */
  async getChargeStatus(req, res, next) {
    try {
      const { chargeId } = req.params;
      
      if (!chargeId) {
        throw createError(400, 'Charge ID is required');
      }
      
      const charge = await boldPaymentService.getChargeStatus(chargeId);
      
      res.json({
        success: true,
        data: charge
      });
      
    } catch (error) {
      next(error);
    }
  }

  /**
   * Manually trigger reconciliation for a charge
   * POST /api/v1/payments/bold-terminal/reconcile/:chargeId
   */
  async reconcileCharge(req, res, next) {
    try {
      const { chargeId } = req.params;
      
      if (!chargeId) {
        throw createError(400, 'Charge ID is required');
      }
      
      // Get charge and force poll
      const charge = await boldPaymentService.getChargeStatus(chargeId);
      
      res.json({
        success: true,
        message: 'Reconciliation triggered',
        data: charge
      });
      
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new BoldTerminalController();