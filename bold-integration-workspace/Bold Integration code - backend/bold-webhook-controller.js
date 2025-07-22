const createError = require('http-errors');
const boldPaymentService = require('../services/boldPayment.service');

class BoldWebhookController {
  /**
   * Process Bold webhook events
   * POST /api/v1/webhooks/bold
   */
  async handleWebhook(req, res, next) {
    try {
      // Get signature from header
      const signature = req.get('X-Bold-Signature');
      
      if (!signature) {
        console.error('Bold webhook received without signature');
        throw createError(401, 'Missing webhook signature');
      }
      
      // Get raw body for signature verification
      const payload = req.body;
      
      // Log webhook receipt (without sensitive data)
      console.log('Bold webhook received:', {
        eventType: payload.event_type,
        transactionId: payload.transaction_id,
        timestamp: new Date().toISOString()
      });
      
      // Process webhook
      const result = await boldPaymentService.processWebhook(signature, payload);
      
      // Bold expects 200 OK response quickly
      res.status(200).json({
        success: true,
        processed: result.processed,
        message: result.processed ? 'Webhook processed successfully' : 'Webhook acknowledged'
      });
      
    } catch (error) {
      // Log webhook processing errors
      console.error('Bold webhook processing error:', {
        error: error.message,
        body: req.body,
        headers: req.headers
      });
      
      // For security reasons, always return 401 for signature failures
      if (error.status === 401) {
        // Track repeated failures for security monitoring
        console.warn('Bold webhook signature verification failed');
        res.status(401).json({
          success: false,
          error: 'Invalid signature'
        });
      } else {
        // For other errors, return 200 to prevent Bold from retrying
        // We'll handle the error internally
        res.status(200).json({
          success: false,
          error: 'Internal processing error'
        });
      }
    }
  }
}

module.exports = new BoldWebhookController();