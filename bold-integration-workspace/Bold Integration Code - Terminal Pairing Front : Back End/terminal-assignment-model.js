import mongoose from 'mongoose';

const TerminalAssignmentSchema = new mongoose.Schema({
  _organization: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Organization',
    required: true,
    index: true
  },
  
  _user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  
  _event: {
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
TerminalAssignmentSchema.index({ _event: 1, terminalId: 1 });
TerminalAssignmentSchema.index({ _user: 1, _event: 1 });
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
    _user: userId,
    _event: eventId,
    active: true
  });
};

TerminalAssignmentSchema.statics.findTerminalAssignment = function(terminalId, eventId) {
  return this.findOne({
    terminalId,
    _event: eventId,
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

export default mongoose.model('TerminalAssignment', TerminalAssignmentSchema);