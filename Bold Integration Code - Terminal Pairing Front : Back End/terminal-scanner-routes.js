const express = require('express');
const router = express.Router();
const { authenticate } = require('../middlewares/auth.middleware');
const { validateBody } = require('../middlewares/validation.middleware');
const createError = require('http-errors');
const terminalAssignmentService = require('../services/terminalAssignment.service');

/**
 * Scanner Terminal Routes
 * Base path: /api/v1/scanner/terminal
 */

// Get available terminals for event
router.get('/available/:eventId', authenticate, async (req, res, next) => {
  try {
    const { eventId } = req.params;
    const userId = req.user.id;
    
    const terminals = await terminalAssignmentService.getAvailableTerminals(userId, eventId);
    
    res.json({
      success: true,
      data: terminals
    });
  } catch (error) {
    next(error);
  }
});

// Assign terminal to user
router.post(
  '/assign',
  authenticate,
  validateBody({
    eventId: 'required|string',
    terminalId: 'required|string',
    location: 'string'
  }),
  async (req, res, next) => {
    try {
      const { eventId, terminalId, location } = req.body;
      const userId = req.user.id;
      
      const assignment = await terminalAssignmentService.assignTerminal(
        userId,
        eventId,
        terminalId,
        location
      );
      
      res.json({
        success: true,
        data: {
          terminalId: assignment.terminalId,
          location: assignment.location,
          assignedAt: assignment.assignedAt
        }
      });
    } catch (error) {
      next(error);
    }
  }
);

// Get current terminal assignment
router.get('/assignment/:eventId', authenticate, async (req, res, next) => {
  try {
    const { eventId } = req.params;
    const userId = req.user.id;
    
    const assignment = await terminalAssignmentService.getCurrentAssignment(userId, eventId);
    
    if (!assignment) {
      return res.json({
        success: true,
        data: null
      });
    }
    
    res.json({
      success: true,
      data: assignment
    });
  } catch (error) {
    next(error);
  }
});

// Release terminal assignment
router.delete('/assignment/:eventId', authenticate, async (req, res, next) => {
  try {
    const { eventId } = req.params;
    const userId = req.user.id;
    
    const result = await terminalAssignmentService.releaseTerminal(userId, eventId);
    
    res.json({
      success: true,
      message: result.message
    });
  } catch (error) {
    next(error);
  }
});

// Get terminal status
router.get('/:terminalId/status', authenticate, async (req, res, next) => {
  try {
    const { terminalId } = req.params;
    
    const status = await terminalAssignmentService.getTerminalStatus(terminalId);
    
    res.json({
      success: true,
      data: {
        terminalId,
        status,
        timestamp: new Date()
      }
    });
  } catch (error) {
    next(error);
  }
});

// Test terminal connection
router.post('/:terminalId/test', authenticate, async (req, res, next) => {
  try {
    const { terminalId } = req.params;
    const userId = req.user.id;
    
    const result = await terminalAssignmentService.testTerminalConnection(userId, terminalId);
    
    res.json({
      success: result.success,
      data: result
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;