// src/pages/POSScreen.js
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import OrderCard from '../components/scanner/OrderCard';
import TicketTierModal from '../components/scanner/TicketTierModal';
import LoadingSpinner from '../components/common/LoadingSpinner';
import EmptyState from '../components/common/EmptyState';
import { posService } from '../services/pos.service';
import { formatCurrency } from '../utils/format';

const POSScreen = () => {
  const { eventId } = useParams();
  const navigate = useNavigate();
  
  // State
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [showTierModal, setShowTierModal] = useState(false);
  const [ticketTiers, setTicketTiers] = useState([]);
  const [processingOrders, setProcessingOrders] = useState(new Set());
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const [terminalId, setTerminalId] = useState(null);
  
  // Refs
  const pollInterval = useRef(null);
  const chargeMonitors = useRef(new Map());
  
  // Initialize
  useEffect(() => {
    initializeScreen();
    startPolling();
    
    // Setup event listeners
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    return () => {
      stopPolling();
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      // Clear all charge monitors
      chargeMonitors.current.forEach(interval => clearInterval(interval));
    };
  }, [eventId]);
  
  const initializeScreen = async () => {
    try {
      // Load terminal config from localStorage
      const storedTerminalId = localStorage.getItem('scanner_terminal_id');
      if (!storedTerminalId) {
        toast.error('Terminal not configured. Please configure in Settings.', {
          duration: 5000,
          position: 'top-center'
        });
      }
      setTerminalId(storedTerminalId);
      
      // Load ticket tiers
      const tiers = await posService.getDoorSalesTicketTiers(eventId);
      setTicketTiers(tiers);
      
      // Load initial orders
      await fetchOrders();
    } catch (error) {
      console.error('Error initializing POS screen:', error);
      toast.error('Failed to initialize POS');
    } finally {
      setLoading(false);
    }
  };
  
  const fetchOrders = async (isRefresh = false) => {
    try {
      if (isRefresh) setRefreshing(true);
      
      const result = await posService.getPendingOrders(eventId);
      setOrders(result.orders);
      
      // Process any offline queue if we're online
      if (navigator.onLine) {
        processOfflineQueue();
      }
    } catch (error) {
      if (!isRefresh) {
        toast.error('Failed to load orders');
      }
    } finally {
      setRefreshing(false);
    }
  };
  
  const startPolling = () => {
    // Poll every 5 seconds
    pollInterval.current = setInterval(() => {
      if (!isOffline && document.visibilityState === 'visible') {
        fetchOrders(true); // Silent refresh
      }
    }, 5000);
  };
  
  const stopPolling = () => {
    if (pollInterval.current) {
      clearInterval(pollInterval.current);
      pollInterval.current = null;
    }
  };
  
  const handleOnline = () => {
    setIsOffline(false);
    toast.success('Connection restored', { position: 'top-center' });
    fetchOrders();
    processOfflineQueue();
  };
  
  const handleOffline = () => {
    setIsOffline(true);
    toast.error('Connection lost - Working offline', { position: 'top-center' });
  };
  
  const handleChargePress = (order) => {
    if (!terminalId) {
      toast.error('Terminal not configured. Please configure in Settings.', {
        duration: 4000,
        position: 'top-center'
      });
      return;
    }
    
    if (processingOrders.has(order.id)) {
      return;
    }
    
    setSelectedOrder(order);
    setShowTierModal(true);
  };
  
  const handleConfirmCharge = async () => {
    if (!selectedOrder || !terminalId) return;
    
    setShowTierModal(false);
    
    // Add to processing set
    setProcessingOrders(prev => new Set(prev).add(selectedOrder.id));
    
    // Update order status locally to show processing
    updateOrderLocally(selectedOrder.id, 'processing');
    
    try {
      if (isOffline) {
        // Queue for offline processing
        await queueOfflineCharge(selectedOrder);
        toast('Queued for processing when online', {
          icon: '⏱️',
          position: 'top-center'
        });
      } else {
        // Process charge
        const result = await posService.createCharge({
          orderId: selectedOrder.id,
          terminalId,
          eventId
        });
        
        if (result.chargeId) {
          // Start monitoring charge status
          monitorChargeStatus(result.chargeId, selectedOrder.id);
        }
      }
    } catch (error) {
      handleChargeError(error, selectedOrder.id);
    }
  };
  
  const monitorChargeStatus = (chargeId, orderId) => {
    let attempts = 0;
    const maxAttempts = 24; // 2 minutes with 5 second intervals
    
    const checkStatus = async () => {
      try {
        const status = await posService.getChargeStatus(chargeId);
        
        if (status.status === 'approved') {
          updateOrderLocally(orderId, 'paid');
          removeFromProcessing(orderId);
          
          toast.success('Payment Successful!', {
            duration: 3000,
            position: 'top-center',
            style: {
              background: '#10B981',
              color: '#fff',
            }
          });
          
          // Clear monitor
          const monitor = chargeMonitors.current.get(orderId);
          if (monitor) {
            clearInterval(monitor);
            chargeMonitors.current.delete(orderId);
          }
          return true;
          
        } else if (status.status === 'declined' || status.status === 'error') {
          updateOrderLocally(orderId, 'pending', status.errorDetails);
          removeFromProcessing(orderId);
          
          const errorMessage = status.errorDetails?.message || 'Payment declined';
          toast.error(errorMessage, {
            duration: 4000,
            position: 'top-center'
          });
          
          // Clear monitor
          const monitor = chargeMonitors.current.get(orderId);
          if (monitor) {
            clearInterval(monitor);
            chargeMonitors.current.delete(orderId);
          }
          return true;
          
        } else if (status.status === 'timeout') {
          updateOrderLocally(orderId, 'pending');
          removeFromProcessing(orderId);
          
          toast.error('Payment timeout - Check terminal', {
            duration: 4000,
            position: 'top-center'
          });
          
          // Clear monitor
          const monitor = chargeMonitors.current.get(orderId);
          if (monitor) {
            clearInterval(monitor);
            chargeMonitors.current.delete(orderId);
          }
          return true;
        }
        
        // Still processing
        attempts++;
        if (attempts >= maxAttempts) {
          updateOrderLocally(orderId, 'pending');
          removeFromProcessing(orderId);
          
          toast.error('Payment timeout - Please check terminal', {
            duration: 4000,
            position: 'top-center'
          });
          
          const monitor = chargeMonitors.current.get(orderId);
          if (monitor) {
            clearInterval(monitor);
            chargeMonitors.current.delete(orderId);
          }
          return true;
        }
        
        return false;
      } catch (error) {
        console.error('Error checking charge status:', error);
        return false;
      }
    };
    
    // Initial check after 2 seconds
    setTimeout(async () => {
      const isDone = await checkStatus();
      if (!isDone) {
        // Continue checking every 5 seconds
        const interval = setInterval(async () => {
          await checkStatus();
        }, 5000);
        
        // Store interval reference
        chargeMonitors.current.set(orderId, interval);
      }
    }, 2000);
  };
  
  const updateOrderLocally = (orderId, status, errorDetails = null) => {
    setOrders(prevOrders => 
      prevOrders.map(order => {
        if (order.id === orderId) {
          return {
            ...order,
            status,
            errorDetails,
            lastUpdated: new Date().toISOString()
          };
        }
        return order;
      })
    );
  };
  
  const removeFromProcessing = (orderId) => {
    setTimeout(() => {
      setProcessingOrders(prev => {
        const newSet = new Set(prev);
        newSet.delete(orderId);
        return newSet;
      });
    }, 1000);
  };
  
  const handleChargeError = (error, orderId) => {
    removeFromProcessing(orderId);
    updateOrderLocally(orderId, 'pending');
    
    const errorMessage = posService.getErrorMessage(error);
    
    toast.error(errorMessage, {
      duration: 4000,
      position: 'top-center'
    });
    
    // Special handling for terminal offline
    if (errorMessage.includes('Terminal offline')) {
      localStorage.setItem('scanner_terminal_status', 'offline');
    }
  };
  
  const queueOfflineCharge = async (order) => {
    try {
      const offlineQueue = JSON.parse(localStorage.getItem('pos_offline_queue') || '[]');
      
      offlineQueue.push({
        orderId: order.id,
        terminalId,
        eventId,
        amount: order.totalAmount,
        timestamp: new Date().toISOString()
      });
      
      localStorage.setItem('pos_offline_queue', JSON.stringify(offlineQueue));
    } catch (error) {
      console.error('Error queuing offline charge:', error);
    }
  };
  
  const processOfflineQueue = async () => {
    try {
      const offlineQueue = JSON.parse(localStorage.getItem('pos_offline_queue') || '[]');
      if (offlineQueue.length === 0) return;
      
      const remaining = [];
      
      for (const charge of offlineQueue) {
        try {
          const result = await posService.createCharge(charge);
          if (result.chargeId) {
            monitorChargeStatus(result.chargeId, charge.orderId);
          }
        } catch (error) {
          // Keep in queue if failed
          remaining.push(charge);
        }
      }
      
      if (remaining.length > 0) {
        localStorage.setItem('pos_offline_queue', JSON.stringify(remaining));
      } else {
        localStorage.removeItem('pos_offline_queue');
      }
    } catch (error) {
      console.error('Error processing offline queue:', error);
    }
  };
  
  const handleRefresh = () => {
    fetchOrders(true);
  };
  
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <LoadingSpinner />
      </div>
    );
  }
  
  return (
    <div className="min-h-screen bg-gray-900 pb-20">
      {isOffline && (
        <div className="bg-yellow-600 text-white px-4 py-2 flex items-center justify-center gap-2">
          <span>⚠️</span>
          <span className="font-medium">Offline Mode</span>
        </div>
      )}
      
      <div className="px-4 py-4 flex items-center justify-between border-b border-gray-800">
        <h2 className="text-xl font-semibold text-white">Live Orders</h2>
        <button 
          className="text-white p-2 rounded-lg hover:bg-gray-800 transition-colors disabled:opacity-50"
          onClick={handleRefresh}
          disabled={refreshing}
        >
          {refreshing ? <LoadingSpinner size="small" /> : (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          )}
        </button>
      </div>
      
      <div className="px-4 py-4 space-y-3">
        {orders.length === 0 ? (
          <EmptyState
            icon="📋"
            title="No pending orders"
            message="Walk-up orders will appear here"
          />
        ) : (
          orders.map(order => (
            <OrderCard
              key={order.id}
              order={order}
              onCharge={() => handleChargePress(order)}
              isProcessing={processingOrders.has(order.id)}
              isOffline={isOffline}
            />
          ))
        )}
      </div>
      
      <TicketTierModal
        visible={showTierModal}
        order={selectedOrder}
        ticketTiers={ticketTiers}
        onConfirm={handleConfirmCharge}
        onCancel={() => setShowTierModal(false)}
      />
    </div>
  );
};

export default POSScreen;