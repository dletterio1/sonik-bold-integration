// src/services/boldPayment.service.js - Addition to updateChargeStatus method
// Add this after line where charge status is updated in the existing boldPayment.service.js

// Inside the updateChargeStatus method, after emitting the payment event:
    
    // If this was a POS charge, update the order status
    if (charge.metadata?.posClient === 'scanner-app') {
      const liveOrderService = require('./liveOrder.service');
      
      try {
        if (newStatus === 'approved') {
          await liveOrderService.updateOrderPaymentStatus(
            charge.orderId, 
            'paid',
            {
              paymentMethod: 'terminal',
              paymentDetails: charge.paymentDetails,
              boldChargeId: charge.chargeId
            }
          );
        } else if (newStatus === 'declined' || newStatus === 'error' || newStatus === 'timeout') {
          await liveOrderService.updateOrderPaymentStatus(
            charge.orderId, 
            'pending',
            {
              lastPaymentAttempt: new Date(),
              lastPaymentError: charge.errorDetails
            }
          );
        }
      } catch (error) {
        console.error('Failed to update order status after payment:', error);
      }
    }