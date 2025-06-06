// src/services/pos.service.js
import { apiClient } from '../lib/https';

class POSService {
  async getPendingOrders(eventId) {
    try {
      const response = await apiClient.get(`/scanner/pos/orders/${eventId}`);
      return response.data.data;
    } catch (error) {
      console.error('Error fetching pending orders:', error);
      throw error;
    }
  }

  async getDoorSalesTicketTiers(eventId) {
    try {
      const response = await apiClient.get(`/scanner/pos/ticket-tiers/${eventId}`);
      return response.data.data;
    } catch (error) {
      console.error('Error fetching door sales tiers:', error);
      throw error;
    }
  }

  async createCharge({ orderId, terminalId, eventId }) {
    try {
      const response = await apiClient.post('/scanner/pos/charge', {
        order_id: orderId,
        terminal_id: terminalId,
        event_id: eventId
      });
      return response.data.data;
    } catch (error) {
      console.error('Error creating charge:', error);
      throw error;
    }
  }

  async getChargeStatus(chargeId) {
    try {
      const response = await apiClient.get(`/scanner/pos/charge/${chargeId}`);
      return response.data.data;
    } catch (error) {
      console.error('Error getting charge status:', error);
      throw error;
    }
  }

  getErrorMessage(error) {
    // Check for specific error codes from Bold
    const errorCode = error.response?.data?.error?.code;
    const errorMessage = error.response?.data?.error?.message;
    
    // Map error codes to user-friendly messages
    const errorMap = {
      'insufficient_funds': 'Payment declined - Insufficient funds',
      'card_declined': 'Payment declined - Card declined',
      'expired_card': 'Payment declined - Card expired',
      'invalid_pin': 'Card error - Please try another card',
      'timeout': 'Payment timeout - Check terminal',
      'terminal_offline': 'Terminal offline - Contact supervisor',
      'terminal_busy': 'Terminal not responding - Try again',
      'duplicate_transaction': 'Processing error - Please retry',
      'amount_limit_exceeded': 'Daily limit reached for this card',
      'security_violation': 'Card error - Please try another card',
      'issuer_unavailable': 'Card error - Please try another card'
    };
    
    if (errorCode && errorMap[errorCode]) {
      return errorMap[errorCode];
    }
    
    // Check for terminal status errors
    if (error.status === 409 && errorMessage?.includes('Terminal is busy')) {
      return 'Terminal busy - Please wait';
    }
    
    if (error.status === 409 && errorMessage?.includes('already being processed')) {
      return 'Order already being processed';
    }
    
    // Default error messages
    return errorMessage || 'Processing error - Please retry';
  }
}

export const posService = new POSService();