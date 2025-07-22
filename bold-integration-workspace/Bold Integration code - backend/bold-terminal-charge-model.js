import mongoose from 'mongoose';

const BoldTerminalChargeSchema = new mongoose.Schema({
  // Internal charge ID
  chargeId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  
  // Reference to existing transaction (Sonik uses TicketTransaction, not Order)
  _transaction: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'TicketTransaction',
    required: true,
    index: true
  },
  
  // Reference to ticket tier
  _tickettier: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'TicketTier',
    required: true
  },
  
  // Amount in COP cents
  amount: {
    type: Number,
    required: true,
    min: 0
  },
  
  // Terminal ID from scanner device
  terminalId: {
    type: String,
    required: true,
    index: true
  },
  
  // Bold's transaction ID
  boldTransactionId: {
    type: String,
    sparse: true,
    index: true
  },
  
  // Current status
  status: {
    type: String,
    enum: ['pending', 'approved', 'declined', 'error', 'timeout', 'reversed', 'cancelled'],
    default: 'pending',
    required: true,
    index: true
  },
  
  // Status history for audit trail
  statusHistory: [{
    status: {
      type: String,
      enum: ['pending', 'approved', 'declined', 'error', 'timeout', 'reversed', 'cancelled'],
      required: true
    },
    timestamp: {
      type: Date,
      default: Date.now
    },
    reason: String,
    boldResponse: mongoose.Schema.Types.Mixed
  }],
  
  // Bold-specific payment details
  paymentDetails: {
    authorizationCode: String,
    cardBrand: String,
    lastFourDigits: String,
    cardHolderName: String,
    paymentMethod: String
  },
  
  // Error information
  errorDetails: {
    code: String,
    message: String,
    boldErrorCode: String,
    boldErrorMessage: String
  },
  
  // Webhook tracking
  webhookEvents: [{
    eventType: String,
    receivedAt: Date,
    processed: Boolean,
    boldEventId: String
  }],
  
  // Reconciliation tracking
  reconciliation: {
    lastPollTimestamp: Date,
    pollAttempts: {
      type: Number,
      default: 0
    },
    reconciled: {
      type: Boolean,
      default: false
    }
  },
  
  // Metadata
  metadata: {
    ipAddress: String,
    userAgent: String,
    posClient: String, // Which POS client initiated (scanner, kiosk, etc)
    _event: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Event'
    }
  }
  
}, {
  timestamps: true
});

// Compound indexes for performance
BoldTerminalChargeSchema.index({ _transaction: 1, status: 1 });
BoldTerminalChargeSchema.index({ createdAt: 1, status: 1 }); // For reconciliation queries
BoldTerminalChargeSchema.index({ 'reconciliation.reconciled': 1, createdAt: 1 });

// Instance methods
BoldTerminalChargeSchema.methods.addStatusHistory = function(status, reason, boldResponse) {
  this.statusHistory.push({
    status,
    reason,
    boldResponse,
    timestamp: new Date()
  });
  this.status = status;
  return this.save();
};

BoldTerminalChargeSchema.methods.addWebhookEvent = function(eventType, boldEventId) {
  this.webhookEvents.push({
    eventType,
    receivedAt: new Date(),
    processed: false,
    boldEventId
  });
  return this.save();
};

BoldTerminalChargeSchema.methods.updateReconciliation = function() {
  this.reconciliation.lastPollTimestamp = new Date();
  this.reconciliation.pollAttempts += 1;
  return this.save();
};

BoldTerminalChargeSchema.methods.isTimedOut = function() {
  const twoMinutes = 2 * 60 * 1000;
  return this.status === 'pending' && 
         (Date.now() - this.createdAt.getTime()) > twoMinutes;
};

// Static methods
BoldTerminalChargeSchema.statics.generateChargeId = function() {
  const timestamp = Date.now().toString(36);
  const randomStr = Math.random().toString(36).substr(2, 9);
  return `CHG_${timestamp}_${randomStr}`.toUpperCase();
};

BoldTerminalChargeSchema.statics.findPendingForReconciliation = function() {
  const ninetySecondsAgo = new Date(Date.now() - 90 * 1000);
  return this.find({
    status: 'pending',
    createdAt: { $lt: ninetySecondsAgo },
    'reconciliation.reconciled': false
  });
};

export default mongoose.model('BoldTerminalCharge', BoldTerminalChargeSchema);