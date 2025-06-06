// In your main scanner.routes.js file, add this at the top with other imports:
const terminalRoutes = require('./scanner.terminal.routes');

// Then add this line to include the terminal routes:
router.use('/terminal', terminalRoutes);

// This will make terminal endpoints available at:
// /api/v1/scanner/terminal/available/:eventId
// /api/v1/scanner/terminal/assign
// /api/v1/scanner/terminal/assignment/:eventId
// /api/v1/scanner/terminal/:terminalId/status
// /api/v1/scanner/terminal/:terminalId/test