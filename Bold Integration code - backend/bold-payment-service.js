import axios from 'axios';
import crypto from 'crypto';
import createError from 'http-errors';
import BoldTerminalCharge from '../models/BoldTerminalCharge.model.js';
import RedisService from './redis.service.js';
import EventService from './event.service.js';

class BoldPaymentService {
  constructor() {
    this.baseURL = process.env.BOLD_ENVIRONMENT === 'production' 
      ? 'https://api.bold.co/v1'
      : 'https://sandbox.bold.co/v1';
    
    this.clientId = process.env.BOLD_CLIENT_ID;
    this.clientSecret = process.env.BOLD_CLIENT_SECRET;
    this.webhookSecret = process.env.BOLD_WEBHOOK_SECRET;
    
    this.axiosInstance = axios.create({
      baseURL: this.baseURL,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }
    });
    
    // Error message mappings for user-friendly responses
    this.errorMappings = {
      'insufficient_funds': 'Pago rechazado: Fondos insuficientes',
      'card_declined': 'Pago rechazado: Tarjeta declinada',
      'expired_card': 'Pago rechazado: Tarjeta expirada',
      'invalid_pin': 'PIN incorrecto',
      'timeout': 'Tiempo de espera agotado. Por favor, intente nuevamente',
      'terminal_offline': 'Terminal desconectado. Verifique la conexión',
      'terminal_busy': 'Terminal ocupado. Por favor espere',
      'duplicate_transaction': 'Transacción duplicada',
      'amount_limit_exceeded': 'Monto excede el límite permitido',
      'security_violation': 'Fallo de seguridad. Contacte a su banco',
      'issuer_unavailable': 'Banco no disponible. Intente más tarde'
    };
  }

  /**
   * Get OAuth access token from Bold
   */
  async getAccessToken() {
    const cacheKey = 'bold:token:access';
    
    // Check cached token
    const cachedToken = await RedisService.get(cacheKey);
    if (cachedToken) {
      return cachedToken;
    }
    
    try {
      const response = await axios.post(`${this.baseURL}/oauth/token`, {
        grant_type: 'client_credentials',
        client_id: this.clientId,
        client_secret: this.clientSecret,
        scope: 'payments'
      });
      
      const { access_token, expires_in } = response.data;
      
      // Cache token with TTL (subtract 60 seconds for safety)
      await RedisService.setex(cacheKey, expires_in - 60, access_token);
      
      return access_token;
    } catch (error) {
      console.error('Bold OAuth error:', error.response?.data || error.message);
      throw createError(503, 'Payment service authentication failed');
    }
  }

  /**
   * Create a charge on Bold terminal
   */
  async createCharge({ transactionId, ticketTierId, amount, terminalId, metadata }) {
    // Check idempotency
    const idempotencyKey = `bold:idempotency:${transactionId}:${amount}`;
    const existingChargeId = await RedisService.get(idempotencyKey);
    
    if (existingChargeId) {
      const existingCharge = await BoldTerminalCharge.findOne({ chargeId: existingChargeId });
      if (existingCharge) {
        return this.formatChargeResponse(existingCharge);
      }
    }
    
    // Create charge record
    const chargeId = BoldTerminalCharge.generateChargeId();
    const charge = new BoldTerminalCharge({
      chargeId,
      _transaction: transactionId,
      _tickettier: ticketTierId,
      amount,
      terminalId,
      status: 'pending',
      metadata,
      statusHistory: [{
        status: 'pending',
        timestamp: new Date(),
        reason: 'Charge initiated'
      }]
    });
    
    await charge.save();
    
    // Set idempotency key with 5 minute TTL
    await RedisService.setex(idempotencyKey, 300, chargeId);
    
    try {
      // Get access token
      const accessToken = await this.getAccessToken();
      
      // Create payment on Bold
      const boldResponse = await this.axiosInstance.post('/payments', {
        amount: amount,
        currency: 'COP',
        terminal_id: terminalId,
        reference_id: chargeId,
        description: `Transaction ${transactionId}`,
        metadata: {
          transaction_id: transactionId.toString(),
          ticket_tier_id: ticketTierId.toString(),
          charge_id: chargeId
        }
      }, {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      });
      
      // Update charge with Bold transaction ID
      charge.boldTransactionId = boldResponse.data.id;
      await charge.save();
      
      // Emit event
      await EventService.emit('payment.terminal.initiated', {
        chargeId,
        transactionId,
        amount,
        terminalId,
        boldTransactionId: boldResponse.data.id
      });
      
      return this.formatChargeResponse(charge);
      
    } catch (error) {
      // Handle Bold API errors
      const errorMessage = this.handleBoldError(error);
      
      await charge.addStatusHistory('error', errorMessage, error.response?.data);
      
      throw createError(error.response?.status || 500, errorMessage);
    }
  }

  /**
   * Get charge status
   */
  async getChargeStatus(chargeId) {
    const charge = await BoldTerminalCharge.findOne({ chargeId });
    
    if (!charge) {
      throw createError(404, 'Charge not found');
    }
    
    // If charge is pending and old enough, poll Bold
    if (charge.status === 'pending' && !charge.isTimedOut()) {
      await this.pollBoldStatus(charge);
    }
    
    return this.formatChargeResponse(charge);
  }

  /**
   * Poll Bold API for payment status
   */
  async pollBoldStatus(charge) {
    if (!charge.boldTransactionId) {
      return;
    }
    
    try {
      const accessToken = await this.getAccessToken();
      
      const response = await this.axiosInstance.get(`/payments/${charge.boldTransactionId}`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      });
      
      const boldStatus = response.data.status;
      const mappedStatus = this.mapBoldStatus(boldStatus);
      
      if (mappedStatus !== charge.status) {
        await this.updateChargeStatus(charge, response.data);
      }
      
      await charge.updateReconciliation();
      
    } catch (error) {
      console.error(`Failed to poll Bold status for ${charge.chargeId}:`, error.message);
    }
  }

  /**
   * Process webhook from Bold
   */
  async processWebhook(signature, payload) {
    // Verify webhook signature
    if (!this.verifyWebhookSignature(signature, payload)) {
      throw createError(401, 'Invalid webhook signature');
    }
    
    const { event_type, transaction_id, data } = payload;
    
    // Find charge by Bold transaction ID
    const charge = await BoldTerminalCharge.findOne({ 
      boldTransactionId: transaction_id 
    });
    
    if (!charge) {
      // Log for investigation but don't fail
      console.warn(`Webhook received for unknown transaction: ${transaction_id}`);
      return { processed: false, reason: 'Transaction not found' };
    }
    
    // Add webhook event
    await charge.addWebhookEvent(event_type, payload.event_id);
    
    // Process based on event type
    switch (event_type) {
      case 'payment.approved':
      case 'payment.declined':
      case 'payment.reversed':
      case 'payment.cancelled':
        await this.updateChargeStatus(charge, data);
        break;
      default:
        console.log(`Unhandled webhook event type: ${event_type}`);
    }
    
    return { processed: true, chargeId: charge.chargeId };
  }

  /**
   * Update charge status based on Bold response
   */
  async updateChargeStatus(charge, boldData) {
    const newStatus = this.mapBoldStatus(boldData.status);
    const oldStatus = charge.status;
    
    if (newStatus === oldStatus) {
      return;
    }
    
    // Update payment details if approved
    if (newStatus === 'approved') {
      charge.paymentDetails = {
        authorizationCode: boldData.authorization_code,
        cardBrand: boldData.card_brand,
        lastFourDigits: boldData.last_four,
        cardHolderName: boldData.cardholder_name,
        paymentMethod: boldData.payment_method
      };
    }
    
    // Update error details if declined or error
    if (newStatus === 'declined' || newStatus === 'error') {
      charge.errorDetails = {
        code: boldData.decline_code || boldData.error_code,
        message: this.getUserFriendlyError(boldData.decline_code || boldData.error_code),
        boldErrorCode: boldData.decline_code || boldData.error_code,
        boldErrorMessage: boldData.message
      };
    }
    
    // Add to status history
    await charge.addStatusHistory(
      newStatus, 
      boldData.message || `Status changed from ${oldStatus} to ${newStatus}`,
      boldData
    );
    
    // Mark as reconciled
    charge.reconciliation.reconciled = true;
    await charge.save();
    
    // Emit appropriate event
    const eventName = `payment.terminal.${newStatus}`;
    await EventService.emit(eventName, {
      chargeId: charge.chargeId,
      transactionId: charge._transaction,
      ticketTierId: charge._tickettier,
      amount: charge.amount,
      terminalId: charge.terminalId,
      status: newStatus,
      paymentDetails: charge.paymentDetails,
      errorDetails: charge.errorDetails
    });
  }

  /**
   * Reconcile pending charges
   */
  async reconcilePendingCharges() {
    const pendingCharges = await BoldTerminalCharge.findPendingForReconciliation();
    
    for (const charge of pendingCharges) {
      // Check if timed out
      if (charge.isTimedOut()) {
        await charge.addStatusHistory('timeout', 'Payment timed out after 2 minutes');
        charge.reconciliation.reconciled = true;
        await charge.save();
        
        await EventService.emit('payment.terminal.timeout', {
          chargeId: charge.chargeId,
          transactionId: charge._transaction,
          amount: charge.amount,
          terminalId: charge.terminalId
        });
        
        continue;
      }
      
      // Poll Bold for status
      await this.pollBoldStatus(charge);
    }
    
    return {
      processed: pendingCharges.length,
      timestamp: new Date()
    };
  }

  /**
   * Verify webhook signature
   */
  verifyWebhookSignature(signature, payload) {
    const expectedSignature = crypto
      .createHmac('sha256', this.webhookSecret)
      .update(JSON.stringify(payload))
      .digest('hex');
    
    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature)
    );
  }

  /**
   * Map Bold status to our status
   */
  mapBoldStatus(boldStatus) {
    const statusMap = {
      'pending': 'pending',
      'processing': 'pending',
      'approved': 'approved',
      'declined': 'declined',
      'failed': 'error',
      'cancelled': 'cancelled',
      'reversed': 'reversed',
      'timeout': 'timeout'
    };
    
    return statusMap[boldStatus.toLowerCase()] || 'error';
  }

  /**
   * Get user-friendly error message
   */
  getUserFriendlyError(errorCode) {
    return this.errorMappings[errorCode] || 'Error al procesar el pago. Intente nuevamente';
  }

  /**
   * Handle Bold API errors
   */
  handleBoldError(error) {
    if (error.response) {
      const { status, data } = error.response;
      
      // Log full error for debugging
      console.error('Bold API error:', {
        status,
        data,
        headers: error.response.headers
      });
      
      // Handle specific status codes
      switch (status) {
        case 400:
          return 'Solicitud inválida. Verifique los datos';
        case 401:
          return 'Error de autenticación con servicio de pago';
        case 403:
          return 'Operación no permitida';
        case 404:
          return 'Terminal no encontrado';
        case 409:
          return 'Transacción duplicada';
        case 503:
          return 'Servicio de pago temporalmente no disponible';
        default:
          return data.message || 'Error al procesar el pago';
      }
    }
    
    return 'Error de conexión con servicio de pago';
  }

  /**
   * Format charge response
   */
  formatChargeResponse(charge) {
    return {
      chargeId: charge.chargeId,
      status: charge.status,
      amount: charge.amount,
      terminalId: charge.terminalId,
      paymentDetails: charge.status === 'approved' ? charge.paymentDetails : undefined,
      errorDetails: charge.status === 'declined' || charge.status === 'error' ? charge.errorDetails : undefined,
      createdAt: charge.createdAt,
      updatedAt: charge.updatedAt
    };
  }
}

const boldPaymentService = new BoldPaymentService();
export default boldPaymentService;