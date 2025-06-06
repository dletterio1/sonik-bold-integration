const cron = require('node-cron');
const boldPaymentService = require('../services/boldPayment.service');

/**
 * Bold Payment Reconciliation Job
 * Runs every 30 seconds to check pending charges
 */
class BoldReconciliationJob {
  constructor() {
    this.isRunning = false;
  }

  start() {
    console.log('Starting Bold payment reconciliation job...');
    
    // Run every 30 seconds
    cron.schedule('*/30 * * * * *', async () => {
      if (this.isRunning) {
        console.log('Reconciliation job already running, skipping...');
        return;
      }
      
      this.isRunning = true;
      
      try {
        const result = await boldPaymentService.reconcilePendingCharges();
        
        if (result.processed > 0) {
          console.log(`Bold reconciliation completed: ${result.processed} charges processed`);
        }
        
      } catch (error) {
        console.error('Bold reconciliation job error:', error);
      } finally {
        this.isRunning = false;
      }
    });
    
    console.log('Bold payment reconciliation job started - running every 30 seconds');
  }

  stop() {
    console.log('Stopping Bold payment reconciliation job...');
    // Note: node-cron doesn't provide a direct way to stop a specific job
    // In production, you might want to use a more sophisticated job scheduler
  }
}

module.exports = new BoldReconciliationJob();