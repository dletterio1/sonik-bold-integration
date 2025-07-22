// src/services/liveOrder.service.js
const Order = require('../models/Order');
const TicketTier = require('../models/TicketTier');
const createError = require('http-errors');
const eventService = require('./event.service');
const redisService = require('./redis.service');

class LiveOrderService {
  /**
   * Get pending orders for POS display
   * Only returns orders with door_sales_only ticket tiers
   */
  async getPendingOrdersForEvent(eventId, options = {}) {
    try {
      const { page = 1, limit = 50 } = options;
      
      // First get all door sales ticket tiers for this event
      const doorSalesTiers = await TicketTier.find({
        event: eventId,
        door_sales_only: true,
        status: 'active'
      }).select('_id');
      
      const tierIds = doorSalesTiers.map(t => t._id);
      
      if (tierIds.length === 0) {
        return {
          orders: [],
          pagination: {
            page,
            limit,
            total: 0,
            pages: 0
          }
        };
      }
      
      // Find pending orders with these ticket tiers
      const query = {
        event: eventId,
        status: 'pending',
        'items.ticketTier': { $in: tierIds },
        // Exclude orders being processed
        $or: [
          { processingStartedAt: { $exists: false } },
          { processingStartedAt: { $lt: new Date(Date.now() - 120000) } } // 2 minute timeout
        ]
      };
      
      const total = await Order.countDocuments(query);
      
      const orders = await Order.find(query)
        .populate('items.ticketTier', 'name price')
        .sort({ createdAt: -1 })
        .limit(limit)
        .skip((page - 1) * limit)
        .lean();
      
      // Format orders for POS display
      const formattedOrders = orders.map(order => this.formatOrderForPOS(order));
      
      return {
        orders: formattedOrders,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit)
        }
      };
    } catch (error) {
      console.error('Error fetching pending orders:', error);
      throw error;
    }
  }
  
  /**
   * Get single order details for charging
   */
  async getOrderForCharging(orderId) {
    const order = await Order.findById(orderId)
      .populate('items.ticketTier', 'name price door_sales_only')
      .lean();
    
    if (!order) {
      throw createError(404, 'Order not found');
    }
    
    if (order.status !== 'pending') {
      throw createError(400, `Order is ${order.status}, cannot charge`);
    }
    
    // Verify it has door sales items
    const hasDoorSalesItems = order.items.some(item => 
      item.ticketTier && item.ticketTier.door_sales_only
    );
    
    if (!hasDoorSalesItems) {
      throw createError(400, 'Order has no door sales items');
    }
    
    return this.formatOrderForPOS(order);
  }
  
  /**
   * Mark order as being processed to prevent concurrent charging
   */
  async lockOrderForProcessing(orderId) {
    const result = await Order.findOneAndUpdate(
      {
        _id: orderId,
        status: 'pending',
        $or: [
          { processingStartedAt: { $exists: false } },
          { processingStartedAt: { $lt: new Date(Date.now() - 120000) } }
        ]
      },
      {
        processingStartedAt: new Date(),
        processingCashierId: null // Will be set when we have cashier context
      },
      { new: true }
    );
    
    if (!result) {
      throw createError(409, 'Order is already being processed');
    }
    
    // Set Redis lock as backup
    const lockKey = `order:processing:${orderId}`;
    await redisService.setex(lockKey, 120, 'locked');
    
    return result;
  }
  
  /**
   * Update order status after payment attempt
   */
  async updateOrderPaymentStatus(orderId, status, paymentDetails = {}) {
    const updateData = {
      status,
      processingStartedAt: null,
      processingCashierId: null,
      ...paymentDetails
    };
    
    if (status === 'paid') {
      updateData.paidAt = new Date();
      updateData.paymentMethod = 'terminal';
    }
    
    const order = await Order.findByIdAndUpdate(
      orderId,
      updateData,
      { new: true }
    ).populate('items.ticketTier', 'name price');
    
    if (!order) {
      throw createError(404, 'Order not found');
    }
    
    // Clear Redis lock
    const lockKey = `order:processing:${orderId}`;
    await redisService.del(lockKey);
    
    // Emit event for real-time updates
    await eventService.emit('pos:order:update', {
      orderId: order._id,
      eventId: order.event,
      status: order.status,
      order: this.formatOrderForPOS(order.toObject())
    });
    
    return order;
  }
  
  /**
   * Get door sales ticket tiers for an event
   */
  async getDoorSalesTicketTiers(eventId) {
    const tiers = await TicketTier.find({
      event: eventId,
      door_sales_only: true,
      status: 'active'
    }).select('name price currency remaining capacity').lean();
    
    return tiers.map(tier => ({
      id: tier._id,
      name: tier.name,
      price: tier.price,
      currency: tier.currency || 'COP',
      available: tier.remaining || (tier.capacity - (tier.sold || 0))
    }));
  }
  
  /**
   * Format order for POS display
   */
  formatOrderForPOS(order) {
    // Calculate totals
    const totalAmount = order.items.reduce((sum, item) => {
      return sum + (item.price * item.quantity);
    }, 0);
    
    const totalQuantity = order.items.reduce((sum, item) => {
      return sum + item.quantity;
    }, 0);
    
    // Get ticket tier names
    const itemDescriptions = order.items.map(item => {
      const tierName = item.ticketTier?.name || 'Unknown Tier';
      return `${item.quantity}x ${tierName}`;
    });
    
    return {
      id: order._id,
      orderNumber: order.orderNumber || `ORD-${order._id.toString().slice(-8).toUpperCase()}`,
      status: order.status,
      totalAmount,
      totalQuantity,
      currency: order.currency || 'COP',
      items: itemDescriptions,
      itemsDetail: order.items.map(item => ({
        ticketTierId: item.ticketTier?._id || item.ticketTier,
        name: item.ticketTier?.name || 'Unknown',
        quantity: item.quantity,
        price: item.price
      })),
      createdAt: order.createdAt,
      processingStartedAt: order.processingStartedAt,
      customerName: order.customerName || 'Walk-up Customer'
    };
  }
  
  /**
   * Check if terminal is available
   */
  async isTerminalAvailable(terminalId) {
    const terminalKey = `terminal:status:${terminalId}`;
    const status = await redisService.get(terminalKey);
    
    return status !== 'busy' && status !== 'offline';
  }
  
  /**
   * Set terminal status
   */
  async setTerminalStatus(terminalId, status, ttl = 300) {
    const terminalKey = `terminal:status:${terminalId}`;
    
    if (status === 'online') {
      await redisService.del(terminalKey);
    } else {
      await redisService.setex(terminalKey, ttl, status);
    }
  }
}

module.exports = new LiveOrderService();