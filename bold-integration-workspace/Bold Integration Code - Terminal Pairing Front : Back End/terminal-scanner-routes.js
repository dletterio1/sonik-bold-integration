import express from 'express';
import AuthMiddleware from '../middlewares/auth.middlewares.js';
import createError from 'http-errors';
import TerminalAssignmentService from '../services/terminalAssignment.service.js';
import GlobalUtils from '../utils/global.utils.js';

const router = express.Router();
const { authenticate } = AuthMiddleware;

/**
 * Scanner Terminal Routes
 * Base path: /api/v1/scanner/terminals
 */

// Get available terminals for event
router.get('/available/:eventId', authenticate, async (req, res, next) => {
  try {
    const { eventId } = req.params;
    const userId = req.user._id;
    
    const terminals = await TerminalAssignmentService.getAvailableTerminals(userId, eventId);
    
    res.json(
      GlobalUtils.formatResponse(
        terminals,
        'Available terminals retrieved successfully',
        { success: true }
      )
    );
  } catch (error) {
    next(error);
  }
});

// Assign terminal to user
router.post('/assign', authenticate, async (req, res, next) => {
  try {
    const { event_id, terminal_id, location } = req.body;
    const userId = req.user._id;
    
    if (!event_id || !terminal_id) {
      throw createError(400, 'event_id and terminal_id are required');
    }
    
    const assignment = await TerminalAssignmentService.assignTerminal(
      userId,
      event_id,
      terminal_id,
      location
    );
    
    res.json(
      GlobalUtils.formatResponse(
        {
          terminalId: assignment.terminalId,
          location: assignment.location,
          assignedAt: assignment.assignedAt
        },
        'Terminal assigned successfully',
        { success: true }
      )
    );
  } catch (error) {
    next(error);
  }
});

// Get current terminal assignment
router.get('/assignment/:eventId', authenticate, async (req, res, next) => {
  try {
    const { eventId } = req.params;
    const userId = req.user._id;
    
    const assignment = await TerminalAssignmentService.getCurrentAssignment(userId, eventId);
    
    res.json(
      GlobalUtils.formatResponse(
        assignment,
        assignment ? 'Terminal assignment retrieved successfully' : 'No terminal assignment found',
        { success: true }
      )
    );
  } catch (error) {
    next(error);
  }
});

// Release terminal assignment
router.delete('/assignment/:eventId', authenticate, async (req, res, next) => {
  try {
    const { eventId } = req.params;
    const userId = req.user._id;
    
    const result = await TerminalAssignmentService.releaseTerminal(userId, eventId);
    
    res.json(
      GlobalUtils.formatResponse(
        null,
        result.message,
        { success: true }
      )
    );
  } catch (error) {
    next(error);
  }
});

// Get terminal status
router.get('/:terminalId/status', authenticate, async (req, res, next) => {
  try {
    const { terminalId } = req.params;
    
    const status = await TerminalAssignmentService.getTerminalStatus(terminalId);
    
    res.json(
      GlobalUtils.formatResponse(
        {
          terminalId,
          status,
          timestamp: new Date()
        },
        'Terminal status retrieved successfully',
        { success: true }
      )
    );
  } catch (error) {
    next(error);
  }
});

// Test terminal connection
router.post('/:terminalId/test', authenticate, async (req, res, next) => {
  try {
    const { terminalId } = req.params;
    const userId = req.user._id;
    
    const result = await TerminalAssignmentService.testTerminalConnection(userId, terminalId);
    
    res.json(
      GlobalUtils.formatResponse(
        result,
        result.status === 'online' ? 'Terminal test successful' : 'Terminal test failed',
        { success: result.status === 'online' }
      )
    );
  } catch (error) {
    next(error);
  }
});

export default router;