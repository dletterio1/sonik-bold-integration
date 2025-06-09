/**
 * Additional methods to add to your existing liveOrder.service.js
 * These methods support terminal status management and order processing
 */

import RedisService from './redis.service.js';
import BoldPaymentService from './boldPayment.service.js';
import createError from 'http-errors';
import TicketTransaction from '../models/TicketTransaction.model.js';
import Ticket from '../models/Ticket.model.js';
import EventService from './event.service.js';

// Inside the liveOrderService class, add these methods:

class LiveOrderServiceExtensions {
  /**
   * Check if terminal is available
   */
  async isTerminalAvailable(terminalId) {
    // Check terminal status in Redis
    const statusKey = `terminal:status:${terminalId}`;
    const busyKey = `terminal:busy:${terminalId}`;
    
    const isBusy = await RedisService.get(busyKey);
    if (isBusy) {
      return false;
    }
    
    // Check with Bold service
    try {
      const status = await BoldPaymentService.getTerminalStatus(terminalId);
      return status === 'online';
    } catch (error) {
      console.error(`Failed to check terminal availability: ${terminalId}`, error);
      return false;
    }
  }

  /**
   * Set terminal status
   */
  async setTerminalStatus(terminalId, status, ttl = 30) {
    const statusKey = `terminal:status:${terminalId}`;
    
    if (status === 'busy') {
      const busyKey = `terminal:busy:${terminalId}`;
      await RedisService.setex(busyKey, ttl, '1');
    } else if (status === 'online') {
      const busyKey = `terminal:busy:${terminalId}`;
      await RedisService.del(busyKey);
    }
    
    await RedisService.setex(statusKey, ttl, status);
  }

  /**
   * Lock transaction for processing
   */
  async lockTransactionForProcessing(transactionId) {
    const transaction = await TicketTransaction.findById(transactionId);
    if (!transaction) {
      throw createError(404, 'Transaction not found');
    }
    
    if (transaction.paymentStatus !== 'pending') {
      throw createError(409, 'Transaction is not in pending state');
    }
    
    // Set transaction as processing
    transaction.paymentStatus = 'processing';
    await transaction.save();
    
    // Set lock in Redis with 2 minute TTL
    const lockKey = `transaction:lock:${transactionId}`;
    await RedisService.setex(lockKey, 120, 'processing');
    
    return transaction;
  }

  /**
   * Update transaction payment status after Bold webhook
   */
  async updateTransactionPaymentStatus(transactionId, status, paymentDetails = {}) {
    const transaction = await TicketTransaction.findById(transactionId);
    if (!transaction) {
      throw createError(404, 'Transaction not found');
    }
    
    // Update transaction status
    transaction.paymentStatus = status;
    
    if (status === 'paid') {
      transaction.paidAt = new Date();
      transaction.paymentMethod = paymentDetails.paymentMethod || 'terminal';
      transaction.paymentDetails = {
        ...transaction.paymentDetails,
        ...paymentDetails
      };
      
      // Create tickets for the transaction
      await this.createTicketsForTransaction(transactionId);
    }
    
    await transaction.save();
    
    // Clear processing lock
    const lockKey = `transaction:lock:${transactionId}`;
    await RedisService.del(lockKey);
    
    // Emit event
    await EventService.emit('transaction.payment.updated', {
      transactionId,
      status,
      paymentDetails
    });
    
    return transaction;
  }

  /**
   * Create tickets after successful payment
   */
  async createTicketsForTransaction(transactionId) {
    const transaction = await TicketTransaction.findById(transactionId)
      .populate('_tickettier')
      .populate('_event');
      
    if (!transaction) {
      throw createError(404, 'Transaction not found');
    }
    
    const tickets = [];
    
    for (let i = 0; i < transaction.quantity; i++) {
      const ticket = await Ticket.create({
        _event: transaction._event._id,
        _tickettier: transaction._tickettier._id,
        _transaction: transaction._id,
        _user: transaction._user,
        status: 'valid',
        qrCode: await this.generateTicketQRCode(transaction._id, i),
        purchaseDate: new Date()
      });
      
      tickets.push(ticket);
    }
    
    // Update transaction with ticket references
    transaction.tickets = tickets.map(t => t._id);
    await transaction.save();
    
    return tickets;
  }

  /**
   * Generate unique QR code for ticket
   */
  async generateTicketQRCode(transactionId, index) {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substr(2, 9);
    return `TKT-${transactionId}-${index}-${timestamp}-${random}`.toUpperCase();
  }
}

export default LiveOrderServiceExtensions;