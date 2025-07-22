/**
 * Add this field to your existing Organization model
 * This represents the terminals available to the organization
 */

const terminalSchema = {
  terminals: [{
    terminalId: {
      type: String,
      required: true,
      unique: true
    },
    serialNumber: {
      type: String,
      required: true,
      unique: true
    },
    location: {
      type: String,
      default: ''
    },
    active: {
      type: Boolean,
      default: true
    },
    assignedTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null
    },
    lastActivity: {
      type: Date,
      default: Date.now
    },
    addedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    addedAt: {
      type: Date,
      default: Date.now
    }
  }]
};

// Add this method to Organization schema
const organizationMethods = {
  // Get active terminals for this organization
  getActiveTerminals: function() {
    return this.terminals.filter(terminal => terminal.active);
  },
  
  // Check if terminal belongs to this organization
  hasTerminal: function(terminalId) {
    return this.terminals.some(terminal => 
      terminal.terminalId === terminalId && terminal.active
    );
  }
};

export { terminalSchema, organizationMethods };