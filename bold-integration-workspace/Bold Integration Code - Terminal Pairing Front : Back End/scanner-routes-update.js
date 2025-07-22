/**
 * Add this route registration to your main scanner routes file
 * This integrates the terminal assignment routes
 */

import terminalRoutes from './terminal-scanner-routes.js';

// Add this line to your scanner routes registration:
// app.use('/api/v1/scanner/terminals', terminalRoutes);

export { terminalRoutes };

// This will make terminal endpoints available at:
// /api/v1/scanner/terminal/available/:eventId
// /api/v1/scanner/terminal/assign
// /api/v1/scanner/terminal/assignment/:eventId
// /api/v1/scanner/terminal/:terminalId/status
// /api/v1/scanner/terminal/:terminalId/test