import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api/v1';

class TerminalService {
  constructor() {
    this.baseURL = `${API_BASE_URL}/scanner/terminal`;
  }

  // Get auth headers
  getHeaders() {
    const token = localStorage.getItem('authToken');
    return {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    };
  }

  // Get available terminals for event
  async getAvailableTerminals(eventId) {
    try {
      const response = await axios.get(
        `${this.baseURL}/available/${eventId}`,
        { headers: this.getHeaders() }
      );
      return response.data.data;
    } catch (error) {
      console.error('Failed to get available terminals:', error);
      throw error;
    }
  }

  // Assign terminal to current user
  async assignTerminal(eventId, terminalId, location = '') {
    try {
      const response = await axios.post(
        `${this.baseURL}/assign`,
        { eventId, terminalId, location },
        { headers: this.getHeaders() }
      );
      return response.data.data;
    } catch (error) {
      console.error('Failed to assign terminal:', error);
      throw error;
    }
  }

  // Get current terminal assignment
  async getCurrentAssignment(eventId) {
    try {
      const response = await axios.get(
        `${this.baseURL}/assignment/${eventId}`,
        { headers: this.getHeaders() }
      );
      return response.data.data;
    } catch (error) {
      console.error('Failed to get terminal assignment:', error);
      throw error;
    }
  }

  // Release terminal
  async releaseTerminal(eventId) {
    try {
      const response = await axios.delete(
        `${this.baseURL}/assignment/${eventId}`,
        { headers: this.getHeaders() }
      );
      return response.data;
    } catch (error) {
      console.error('Failed to release terminal:', error);
      throw error;
    }
  }

  // Check terminal status
  async getTerminalStatus(terminalId) {
    try {
      const response = await axios.get(
        `${this.baseURL}/${terminalId}/status`,
        { headers: this.getHeaders() }
      );
      return response.data.data;
    } catch (error) {
      console.error('Failed to get terminal status:', error);
      throw error;
    }
  }

  // Test terminal connection
  async testTerminalConnection(terminalId) {
    try {
      const response = await axios.post(
        `${this.baseURL}/${terminalId}/test`,
        {},
        { headers: this.getHeaders() }
      );
      return response.data.data;
    } catch (error) {
      console.error('Failed to test terminal:', error);
      throw error;
    }
  }
}

export default new TerminalService();