// src/routes/scanner.routes.js
const express = require('express');
const router = express.Router();
const { authenticate } = require('../middlewares/auth.middleware');
const { validateBody } = require('../middlewares/validation.middleware');
const createError = require('http-errors');
const liveOrderService = require('../services/liveOrder.service');
const boldPaymentService = require('../services/boldPayment.service');

/**
 * Scanner POS Routes
 * Base path: /api/v1/scanner
 */

// Get pending orders for an event
router.get('/pos/orders/:eventId', authenticate, async (req, res, next) => {
  try {
    const { eventId } = req.params;
    const { page = 1, limit = 50 } = req.query;
    
    // TODO: Verify user has scanner permissions for this event
    
    const result = await liveOrderService.getPendingOrdersForEvent(eventId, {
      page: parseInt(page),
      limit: Math.min(parseInt(limit), 100)
    });
    
    res.json({
      success: true,
      data: result.orders,
      pagination: result.pagination
    });
  } catch (error) {
    next(error);
  }
});

// Get door sales ticket tiers for an event
router.get('/pos/ticket-tiers/:eventId', authenticate, async (req, res, next) => {
  try {
    const { eventId } = req.params;
    
    const tiers = await liveOrderService.getDoorSalesTicketTiers(eventId);
    
    res.json({
      success: true,
      data: tiers
    });
  } catch (error) {
    next(error);
  }
});

// Initiate charge for an order
router.post(
  '/pos/charge',
  authenticate,
  validateBody({
    order_id: 'required|string',
    terminal_id: 'required|string',
    event_id: 'required|string'
  }),
  async (req, res, next) => {
    try {
      const { order_id, terminal_id, event_id } = req.body;
      
      // Check terminal availability
      const isAvailable = await liveOrderService.isTerminalAvailable(terminal_id);
      if (!isAvailable) {
        throw createError(409, 'Terminal is busy or offline');
      }
      
      // Lock order for processing
      const order = await liveOrderService.lockOrderForProcessing(order_id);
      
      // Get order details
      const orderDetails = await liveOrderService.getOrderForCharging(order_id);
      
      // Set terminal as busy
      await liveOrderService.setTerminalStatus(terminal_id, 'busy', 120);
      
      try {
        // Create charge with Bold
        const charge = await boldPaymentService.createCharge({
          orderId: order_id,
          ticketTierId: orderDetails.itemsDetail[0].ticketTierId, // Use first item's tier
          amount: orderDetails.totalAmount,
          terminalId: terminal_id,
          metadata: {
            eventId: event_id,
            posClient: 'scanner-app',
            cashierId: req.user.id
          }
        });
        
        res.json({
          success: true,
          data: {
            chargeId: charge.chargeId,
            orderId: order_id,
            status: 'processing',
            amount: orderDetails.totalAmount
          }
        });
      } catch (chargeError) {
        // Release terminal on error
        await liveOrderService.setTerminalStatus(terminal_id, 'online');
        
        // Release order lock
        await liveOrderService.updateOrderPaymentStatus(order_id, 'pending');
        
        throw chargeError;
      }
    } catch (error) {
      next(error);
    }
  }
);

// Check charge status
router.get('/pos/charge/:chargeId', authenticate, async (req, res, next) => {
  try {
    const { chargeId } = req.params;
    
    const charge = await boldPaymentService.getChargeStatus(chargeId);
    
    res.json({
      success: true,
      data: charge
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;