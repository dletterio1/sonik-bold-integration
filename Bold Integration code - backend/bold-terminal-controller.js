import createError from 'http-errors';
import BoldPaymentService from '../services/boldPayment.service.js';
import GlobalUtils from '../utils/global.utils.js';

class BoldTerminalController {
  /**
   * Create a new terminal charge
   * POST /api/v1/payments/bold-terminal/charge
   */
  async createCharge(req, res, next) {
    try {
      const { transaction_id, ticket_tier_id, amount, terminal_id } = req.body;
      
      // Validate required fields
      if (!transaction_id || !ticket_tier_id || !amount || !terminal_id) {
        throw createError(400, 'Missing required fields: transaction_id, ticket_tier_id, amount, terminal_id');
      }
      
      // Validate amount
      if (typeof amount !== 'number' || amount <= 0) {
        throw createError(400, 'Amount must be a positive number in cents');
      }
      
      // Create charge
      const charge = await BoldPaymentService.createCharge({
        transactionId: transaction_id,
        ticketTierId: ticket_tier_id,
        amount,
        terminalId: terminal_id,
        metadata: {
          ipAddress: req.ip,
          userAgent: req.get('user-agent'),
          posClient: req.get('x-pos-client') || 'unknown',
          _event: req.body.event_id
        }
      });
      
      res.status(201).json(
        GlobalUtils.formatResponse(
          charge,
          'Charge created successfully',
          { success: true }
        )
      );
      
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
      
      const charge = await BoldPaymentService.getChargeStatus(chargeId);
      
      res.json(
        GlobalUtils.formatResponse(
          charge,
          'Charge status retrieved successfully',
          { success: true }
        )
      );
      
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
      const charge = await BoldPaymentService.getChargeStatus(chargeId);
      
      res.json(
        GlobalUtils.formatResponse(
          charge,
          'Reconciliation triggered successfully',
          { success: true }
        )
      );
      
    } catch (error) {
      next(error);
    }
  }
}

export default new BoldTerminalController();