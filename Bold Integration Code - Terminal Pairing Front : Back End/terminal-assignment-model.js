const mongoose = require('mongoose');

const TerminalAssignmentSchema = new mongoose.Schema({
  organizationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Organization',
    required: true,
    index: true
  },
  
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  
  eventId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Event',
    required: true,
    index: true
  },
  
  terminalId: {
    type: String,
    required: true,
    index: true
  },
  
  location: {
    type: String,
    default: ''
  },
  
  active: {
    type: Boolean,
    default: true
  },
  
  assignedAt: {
    type: Date,
    default: Date.now
  },
  
  lastStatusCheck: {
    type: Date,
    default: Date.now
  },
  
  lastStatus: {
    type: String,
    enum: ['online', 'offline', 'busy', 'unknown'],
    default: 'unknown'
  }
}, {
  timestamps: true
});

// Compound indexes for performance
TerminalAssignmentSchema.index({ eventId: 1, terminalId: 1 });
TerminalAssignmentSchema.index({ userId: 1, eventId: 1 });
TerminalAssignmentSchema.index({ active: 1, assignedAt: 1 });

// Instance methods
TerminalAssignmentSchema.methods.updateStatus = function(status) {
  this.lastStatus = status;
  this.lastStatusCheck = new Date();
  return this.save();
};

// Static methods
TerminalAssignmentSchema.statics.findActiveAssignment = function(userId, eventId) {
  return this.findOne({
    userId,
    eventId,
    active: true
  });
};

TerminalAssignmentSchema.statics.findTerminalAssignment = function(terminalId, eventId) {
  return this.findOne({
    terminalId,
    eventId,
    active: true
  });
};

// Auto-release old assignments (24 hours)
TerminalAssignmentSchema.statics.releaseOldAssignments = function() {
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
  return this.updateMany(
    {
      active: true,
      assignedAt: { $lt: oneDayAgo }
    },
    {
      active: false
    }
  );
};

module.exports = mongoose.model('TerminalAssignment', TerminalAssignmentSchema);