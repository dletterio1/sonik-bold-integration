// Add these methods to your existing boldPayment.service.js

/**
 * Check if terminal is available
 */
async isTerminalAvailable(terminalId) {
  try {
    const accessToken = await this.getAccessToken();
    
    // Check terminal status with Bold
    const response = await this.axiosInstance.get(`/terminals/${terminalId}`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`
      }
    });
    
    // Terminal is available if it exists and is online
    return response.data && response.data.status === 'ONLINE';
  } catch (error) {
    if (error.response?.status === 404) {
      console.error(`Terminal ${terminalId} not found`);
      return false;
    }
    
    console.error(`Failed to check terminal ${terminalId}:`, error.message);
    return false;
  }
}

/**
 * Get terminal status from Bold
 */
async getTerminalStatus(terminalId) {
  try {
    const accessToken = await this.getAccessToken();
    
    const response = await this.axiosInstance.get(`/terminals/${terminalId}`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`
      }
    });
    
    // Map Bold status to our status
    const boldStatus = response.data.status;
    switch (boldStatus) {
      case 'ONLINE':
        return 'online';
      case 'OFFLINE':
        return 'offline';
      case 'BUSY':
      case 'PROCESSING':
        return 'busy';
      default:
        return 'unknown';
    }
  } catch (error) {
    console.error(`Failed to get terminal status for ${terminalId}:`, error.message);
    return 'unknown';
  }
}

/**
 * Validate terminal belongs to organization
 */
async validateTerminalOwnership(terminalId, organizationId) {
  // In production, this would check with Bold's API to verify
  // the terminal is registered to your merchant account
  // For now, we'll check if it follows our naming convention
  
  // Sonik terminals should start with specific prefix
  const sonikTerminalPrefix = process.env.BOLD_TERMINAL_PREFIX || 'SONIK-';
  
  if (!terminalId.startsWith(sonikTerminalPrefix)) {
    return false;
  }
  
  // Additional validation could be added here
  return true;
}