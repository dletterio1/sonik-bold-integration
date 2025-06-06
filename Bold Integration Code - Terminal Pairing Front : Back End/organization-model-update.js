// Add this to the Organization schema in your existing Organization model

// Inside the OrganizationSchema definition, add:
terminals: [{
  terminalId: {
    type: String,
    required: true
  },
  serialNumber: {
    type: String,
    required: true
  },
  location: {
    type: String,
    default: ''
  },
  addedAt: {
    type: Date,
    default: Date.now
  },
  active: {
    type: Boolean,
    default: true
  }
}],

// Also add this instance method to the schema:
OrganizationSchema.methods.addTerminal = function(terminalId, serialNumber, location) {
  const existing = this.terminals.find(t => t.terminalId === terminalId);
  if (existing) {
    throw new Error('Terminal already exists in organization');
  }
  
  this.terminals.push({
    terminalId,
    serialNumber,
    location: location || '',
    active: true
  });
  
  return this.save();
};

OrganizationSchema.methods.removeTerminal = function(terminalId) {
  const terminal = this.terminals.find(t => t.terminalId === terminalId);
  if (terminal) {
    terminal.active = false;
  }
  return this.save();
};