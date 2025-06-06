const createError = require('http-errors');
const TerminalAssignment = require('../models/TerminalAssignment');
const Organization = require('../models/Organization');
const User = require('../models/User');
const redisService = require('./redis.service');
const boldPaymentService = require('./boldPayment.service');

class TerminalAssignmentService {
  /**
   * Get available terminals for organization
   */
  async getAvailableTerminals(userId, eventId) {
    // Get user's organization
    const user = await User.findById(userId).populate('organization');
    if (!user || !user.organization) {
      throw createError(404, 'User or organization not found');
    }

    const organization = await Organization.findById(user.organization._id);
    if (!organization.terminals || organization.terminals.length === 0) {
      return [];
    }

    // Get all active assignments for this event
    const activeAssignments = await TerminalAssignment.find({
      eventId,
      active: true
    });

    const assignedTerminalIds = activeAssignments.map(a => a.terminalId);
    
    // Filter out assigned terminals and add status
    const availableTerminals = [];
    
    for (const terminal of organization.terminals) {
      if (!terminal.active) continue;
      
      const isAssigned = assignedTerminalIds.includes(terminal.terminalId);
      const assignment = activeAssignments.find(a => a.terminalId === terminal.terminalId);
      
      // Check status from cache or Bold
      const status = await this.getTerminalStatus(terminal.terminalId);
      
      availableTerminals.push({
        terminalId: terminal.terminalId,
        serialNumber: terminal.serialNumber,
        location: terminal.location || 'Not specified',
        status,
        available: !isAssigned || assignment?.userId.toString() === userId.toString(),
        assignedTo: isAssigned ? assignment.userId : null,
        isCurrentUser: assignment?.userId.toString() === userId.toString()
      });
    }

    return availableTerminals;
  }

  /**
   * Assign terminal to user for event
   */
  async assignTerminal(userId, eventId, terminalId, location) {
    // Verify terminal belongs to user's organization
    const user = await User.findById(userId).populate('organization');
    if (!user || !user.organization) {
      throw createError(404, 'User or organization not found');
    }

    const organization = await Organization.findById(user.organization._id);
    const terminal = organization.terminals.find(t => 
      t.terminalId === terminalId && t.active
    );

    if (!terminal) {
      throw createError(404, 'Terminal not found in organization');
    }

    // Check if terminal is already assigned to someone else
    const existingAssignment = await TerminalAssignment.findOne({
      terminalId,
      eventId,
      active: true
    });

    if (existingAssignment && existingAssignment.userId.toString() !== userId.toString()) {
      throw createError(409, 'Terminal is already assigned to another user');
    }

    // Release any current assignment for this user/event
    await TerminalAssignment.updateMany(
      { userId, eventId, active: true },
      { active: false }
    );

    // Create new assignment
    const assignment = await TerminalAssignment.create({
      organizationId: user.organization._id,
      userId,
      eventId,
      terminalId,
      location: location || terminal.location || '',
      active: true
    });

    // Clear cache
    await redisService.del(`terminal:assignment:${userId}:${eventId}`);

    return assignment;
  }

  /**
   * Get current terminal assignment
   */
  async getCurrentAssignment(userId, eventId) {
    // Check cache first
    const cacheKey = `terminal:assignment:${userId}:${eventId}`;
    const cached = await redisService.get(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }

    const assignment = await TerminalAssignment.findActiveAssignment(userId, eventId);
    if (!assignment) {
      return null;
    }

    // Get terminal details from organization
    const user = await User.findById(userId).populate('organization');
    const organization = await Organization.findById(user.organization._id);
    const terminal = organization.terminals.find(t => t.terminalId === assignment.terminalId);

    const result = {
      terminalId: assignment.terminalId,
      location: assignment.location || terminal?.location || 'Not specified',
      assignedAt: assignment.assignedAt,
      status: await this.getTerminalStatus(assignment.terminalId),
      lastStatusCheck: assignment.lastStatusCheck
    };

    // Cache for 1 minute
    await redisService.setex(cacheKey, 60, JSON.stringify(result));

    return result;
  }

  /**
   * Release terminal assignment
   */
  async releaseTerminal(userId, eventId) {
    const assignment = await TerminalAssignment.findActiveAssignment(userId, eventId);
    if (!assignment) {
      throw createError(404, 'No active terminal assignment found');
    }

    assignment.active = false;
    await assignment.save();

    // Clear cache
    await redisService.del(`terminal:assignment:${userId}:${eventId}`);

    return { message: 'Terminal released successfully' };
  }

  /**
   * Get terminal status from Bold
   */
  async getTerminalStatus(terminalId) {
    // Check cache first
    const cacheKey = `terminal:status:${terminalId}`;
    const cached = await redisService.get(cacheKey);
    if (cached) {
      return cached;
    }

    try {
      // Check if terminal is available in Bold
      const isAvailable = await boldPaymentService.isTerminalAvailable(terminalId);
      
      // Get terminal status from Bold (this would need to be implemented in boldPaymentService)
      // For now, we'll use the isAvailable check
      const status = isAvailable ? 'online' : 'offline';
      
      // Cache for 30 seconds
      await redisService.setex(cacheKey, 30, status);
      
      return status;
    } catch (error) {
      console.error(`Failed to check terminal status for ${terminalId}:`, error);
      return 'unknown';
    }
  }

  /**
   * Test terminal connection
   */
  async testTerminalConnection(userId, terminalId) {
    // Verify user has access to this terminal
    const user = await User.findById(userId).populate('organization');
    const organization = await Organization.findById(user.organization._id);
    const terminal = organization.terminals.find(t => 
      t.terminalId === terminalId && t.active
    );

    if (!terminal) {
      throw createError(403, 'Access denied to this terminal');
    }

    try {
      // Create a test charge of 100 COP
      const testCharge = await boldPaymentService.createCharge({
        orderId: 'TEST_' + Date.now(),
        ticketTierId: 'TEST',
        amount: 100, // 100 COP minimum
        terminalId,
        metadata: {
          test: true,
          client: 'sonik-scanner',
          organizationId: organization._id,
          userId
        }
      });

      // Wait for result (max 10 seconds)
      let attempts = 0;
      let finalStatus = null;

      while (attempts < 10 && !finalStatus) {
        await new Promise(resolve => setTimeout(resolve, 1000));
        const status = await boldPaymentService.getChargeStatus(testCharge.chargeId);
        
        if (status.status !== 'pending') {
          finalStatus = status;
          break;
        }
        attempts++;
      }

      // Auto-reverse if approved
      if (finalStatus && finalStatus.status === 'approved') {
        // Note: Bold reversal would need to be implemented
        // For now, we'll just log it
        console.log(`Test charge ${testCharge.chargeId} approved - should be reversed`);
      }

      return {
        success: finalStatus?.status === 'approved',
        status: finalStatus?.status || 'timeout',
        message: this.getTestResultMessage(finalStatus?.status || 'timeout')
      };

    } catch (error) {
      console.error('Terminal test failed:', error);
      return {
        success: false,
        status: 'error',
        message: error.message || 'Failed to test terminal connection'
      };
    }
  }

  /**
   * Get user-friendly test result message
   */
  getTestResultMessage(status) {
    const messages = {
      'approved': 'Terminal connected successfully!',
      'declined': 'Terminal is online but test was declined',
      'error': 'Terminal connection error',
      'timeout': 'Terminal did not respond - Check connection',
      'offline': 'Terminal is offline'
    };

    return messages[status] || 'Unknown terminal status';
  }

  /**
   * Clean up old assignments (to be called by a cron job)
   */
  async cleanupOldAssignments() {
    const result = await TerminalAssignment.releaseOldAssignments();
    console.log(`Released ${result.modifiedCount} old terminal assignments`);
    return result;
  }
}

module.exports = new TerminalAssignmentService();