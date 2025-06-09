import https from '../lib/https.js';

class TerminalService {
  constructor() {
    this.baseURL = '/api/v1/scanner/terminals';
  }

  // Get available terminals for event
  async getAvailableTerminals(eventId) {
    try {
      const response = await https.get(`${this.baseURL}/available/${eventId}`);
      return response.data.data;
    } catch (error) {
      console.error('Failed to get available terminals:', error);
      throw error;
    }
  }

  // Assign terminal to current user
  async assignTerminal(eventId, terminalId, location = '') {
    try {
      const response = await https.post(`${this.baseURL}/assign`, {
        event_id: eventId,
        terminal_id: terminalId,
        location
      });
      return response.data.data;
    } catch (error) {
      console.error('Failed to assign terminal:', error);
      throw error;
    }
  }

  // Get current terminal assignment
  async getCurrentAssignment(eventId) {
    try {
      const response = await https.get(`${this.baseURL}/assignment/${eventId}`);
      return response.data.data;
    } catch (error) {
      console.error('Failed to get terminal assignment:', error);
      throw error;
    }
  }

  // Release terminal
  async releaseTerminal(eventId) {
    try {
      const response = await https.delete(`${this.baseURL}/assignment/${eventId}`);
      return response.data;
    } catch (error) {
      console.error('Failed to release terminal:', error);
      throw error;
    }
  }

  // Check terminal status
  async getTerminalStatus(terminalId) {
    try {
      const response = await https.get(`${this.baseURL}/${terminalId}/status`);
      return response.data.data;
    } catch (error) {
      console.error('Failed to get terminal status:', error);
      throw error;
    }
  }

  // Test terminal connection
  async testTerminalConnection(terminalId) {
    try {
      const response = await https.post(`${this.baseURL}/${terminalId}/test`, {});
      return response.data.data;
    } catch (error) {
      console.error('Failed to test terminal:', error);
      throw error;
    }
  }

  // Get error message for display
  getErrorMessage(error) {
    if (error.response?.data?.message) {
      return error.response.data.message;
    }
    
    if (error.response?.status === 404) {
      return 'Terminal not found or not available';
    }
    
    if (error.response?.status === 409) {
      return 'Terminal is already assigned to another user';
    }
    
    if (error.response?.status === 403) {
      return 'Access denied to this terminal';
    }
    
    return error.message || 'An error occurred while processing your request';
  }
}

export default new TerminalService();