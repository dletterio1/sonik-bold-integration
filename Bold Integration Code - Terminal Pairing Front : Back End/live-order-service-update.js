// Add these methods to your existing liveOrder.service.js

const redisService = require('./redis.service');

// Inside the liveOrderService class, add:

/**
 * Check if terminal is available
 */
async isTerminalAvailable(terminalId) {
  // Check terminal status in Redis
  const statusKey = `terminal:status:${terminalId}`;
  const busyKey = `terminal:busy:${terminalId}`;
  
  const isBusy = await redisService.get(busyKey);
  if (isBusy) {
    return false;
  }
  
  // Check with Bold service
  try {
    const status = await boldPaymentService.getTerminalStatus(terminalId);
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
    await redisService.setex(busyKey, ttl, '1');
  } else if (status === 'online') {
    const busyKey = `terminal:busy:${terminalId}`;
    await redisService.del(busyKey);
  }
  
  await redisService.setex(statusKey, ttl, status);
}

/**
 * Lock order for processing
 */
async lockOrderForProcessing(orderId) {
  const order = await Order.findById(orderId);
  if (!order) {
    throw createError(404, 'Order not found');
  }
  
  if (order.paymentStatus !== 'pending') {
    throw createError(409, 'Order is not in pending state');
  }
  
  // Set order as processing
  order.paymentStatus = 'processing';
  await order.save();
  
  // Set lock in Redis with 2 minute TTL
  const lockKey = `order:lock:${orderId}`;
  await redisService.setex(lockKey, 120, 'processing');
  
  return order;
}

/**
 * Update order payment status after Bold webhook
 */
async updateOrderPaymentStatus(orderId, status, paymentDetails = {}) {
  const order = await Order.findById(orderId);
  if (!order) {
    throw createError(404, 'Order not found');
  }
  
  // Update order status
  order.paymentStatus = status;
  
  if (status === 'paid') {
    order.paidAt = new Date();
    order.paymentMethod = paymentDetails.paymentMethod || 'terminal';
    order.paymentDetails = {
      ...order.paymentDetails,
      ...paymentDetails
    };
    
    // Create tickets for the order
    await this.createTicketsForOrder(orderId);
  }
  
  await order.save();
  
  // Clear processing lock
  const lockKey = `order:lock:${orderId}`;
  await redisService.del(lockKey);
  
  // Emit event
  await eventService.emit('order.payment.updated', {
    orderId,
    status,
    paymentDetails
  });
  
  return order;
}

/**
 * Create tickets after successful payment
 */
async createTicketsForOrder(orderId) {
  const order = await Order.findById(orderId)
    .populate('ticketTier')
    .populate('event');
    
  if (!order) {
    throw createError(404, 'Order not found');
  }
  
  const tickets = [];
  
  for (let i = 0; i < order.quantity; i++) {
    const ticket = await Ticket.create({
      event: order.event._id,
      ticketTier: order.ticketTier._id,
      order: order._id,
      user: order.user,
      status: 'valid',
      qrCode: await this.generateTicketQRCode(order._id, i),
      purchaseDate: new Date()
    });
    
    tickets.push(ticket);
  }
  
  // Update order with ticket references
  order.tickets = tickets.map(t => t._id);
  await order.save();
  
  return tickets;
}

/**
 * Generate unique QR code for ticket
 */
async generateTicketQRCode(orderId, index) {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substr(2, 9);
  return `TKT-${orderId}-${index}-${timestamp}-${random}`.toUpperCase();
}