import createError from 'http-errors';
import TerminalAssignment from '../models/TerminalAssignment.model.js';
import Organization from '../models/Organization.model.js';
import User from '../models/User.model.js';
import RedisService from './redis.service.js';
import BoldPaymentService from './boldPayment.service.js';

class TerminalAssignmentService {
  /**
   * Get available terminals for organization
   */
  async getAvailableTerminals(userId, eventId) {
    // Get user's organization
    const user = await User.findById(userId).populate('_organization');
    if (!user || !user._organization) {
      throw createError(404, 'User or organization not found');
    }

    const organization = await Organization.findById(user._organization._id);
    if (!organization.terminals || organization.terminals.length === 0) {
      return [];
    }

    // Get all active assignments for this event
    const activeAssignments = await TerminalAssignment.find({
      _event: eventId,
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
        available: !isAssigned || assignment?._user.toString() === userId.toString(),
        assignedTo: isAssigned ? assignment._user : null,
        isCurrentUser: assignment?._user.toString() === userId.toString()
      });
    }

    return availableTerminals;
  }

  /**
   * Assign terminal to user for event
   */
  async assignTerminal(userId, eventId, terminalId, location) {
    // Verify terminal belongs to user's organization
    const user = await User.findById(userId).populate('_organization');
    if (!user || !user._organization) {
      throw createError(404, 'User or organization not found');
    }

    const organization = await Organization.findById(user._organization._id);
    const terminal = organization.terminals.find(t => 
      t.terminalId === terminalId && t.active
    );

    if (!terminal) {
      throw createError(404, 'Terminal not found in organization');
    }

    // Check if terminal is already assigned to someone else
    const existingAssignment = await TerminalAssignment.findOne({
      terminalId,
      _event: eventId,
      active: true
    });

    if (existingAssignment && existingAssignment._user.toString() !== userId.toString()) {
      throw createError(409, 'Terminal is already assigned to another user');
    }

    // Release any current assignment for this user/event
    await TerminalAssignment.updateMany(
      { _user: userId, _event: eventId, active: true },
      { active: false }
    );

    // Create new assignment
    const assignment = await TerminalAssignment.create({
      _organization: user._organization._id,
      _user: userId,
      _event: eventId,
      terminalId,
      location: location || terminal.location || '',
      active: true
    });

    // Clear cache
    await RedisService.del(`terminal:assignment:${userId}:${eventId}`);

    return assignment;
  }

  /**
   * Get current terminal assignment
   */
  async getCurrentAssignment(userId, eventId) {
    // Check cache first
    const cacheKey = `terminal:assignment:${userId}:${eventId}`;
    const cached = await RedisService.get(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }

    const assignment = await TerminalAssignment.findActiveAssignment(userId, eventId);
    if (!assignment) {
      return null;
    }

    // Get terminal details from organization
    const user = await User.findById(userId).populate('_organization');
    const organization = await Organization.findById(user._organization._id);
    const terminal = organization.terminals.find(t => t.terminalId === assignment.terminalId);

    const result = {
      terminalId: assignment.terminalId,
      location: assignment.location || terminal?.location || 'Not specified',
      assignedAt: assignment.assignedAt,
      status: await this.getTerminalStatus(assignment.terminalId),
      lastStatusCheck: assignment.lastStatusCheck
    };

    // Cache for 1 minute
    await RedisService.setex(cacheKey, 60, JSON.stringify(result));

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
    await RedisService.del(`terminal:assignment:${userId}:${eventId}`);

    return { message: 'Terminal released successfully' };
  }

  /**
   * Get terminal status from Bold
   */
  async getTerminalStatus(terminalId) {
    // Check cache first
    const cacheKey = `terminal:status:${terminalId}`;
    const cached = await RedisService.get(cacheKey);
    if (cached) {
      return cached;
    }

    try {
      // Check if terminal is available in Bold
      const isAvailable = await BoldPaymentService.isTerminalAvailable(terminalId);
      
      // Get terminal status from Bold (this would need to be implemented in BoldPaymentService)
      // For now, we'll use the isAvailable check
      const status = isAvailable ? 'online' : 'offline';
      
      // Cache for 30 seconds
      await RedisService.setex(cacheKey, 30, status);
      
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
    const user = await User.findById(userId).populate('_organization');
    const organization = await Organization.findById(user._organization._id);
    const terminal = organization.terminals.find(t => 
      t.terminalId === terminalId && t.active
    );

    if (!terminal) {
      throw createError(404, 'Terminal not found or not available');
    }

    try {
      // Test connection with Bold
      const testResult = await BoldPaymentService.testTerminalConnection(terminalId);
      
      // Update terminal status based on test result
      const status = testResult.success ? 'online' : 'offline';
      
      // Cache the result
      await RedisService.setex(`terminal:status:${terminalId}`, 30, status);
      
      return {
        terminalId,
        status,
        message: this.getTestResultMessage(status),
        lastTested: new Date(),
        details: testResult
      };
      
    } catch (error) {
      console.error(`Terminal test failed for ${terminalId}:`, error);
      
      // Cache offline status
      await RedisService.setex(`terminal:status:${terminalId}`, 30, 'offline');
      
      return {
        terminalId,
        status: 'offline',
        message: 'Terminal connection test failed',
        lastTested: new Date(),
        error: error.message
      };
    }
  }

  /**
   * Get user-friendly test result message
   */
  getTestResultMessage(status) {
    const messages = {
      'online': 'Terminal is online and ready to accept payments',
      'offline': 'Terminal is offline or not responding',
      'busy': 'Terminal is currently processing another transaction',
      'unknown': 'Unable to determine terminal status'
    };
    
    return messages[status] || 'Unknown terminal status';
  }

  /**
   * Cleanup old assignments (run as scheduled job)
   */
  async cleanupOldAssignments() {
    const result = await TerminalAssignment.releaseOldAssignments();
    return {
      releasedCount: result.modifiedCount,
      timestamp: new Date()
    };
  }
}

export default new TerminalAssignmentService();