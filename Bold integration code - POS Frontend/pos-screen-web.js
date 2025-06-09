// src/pages/POSScreen.js
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { Settings } from 'lucide-react';
import OrderCard from '../components/scanner/OrderCard';
import TicketTierModal from '../components/scanner/TicketTierModal';
import LoadingSpinner from '../components/common/LoadingSpinner';
import EmptyState from '../components/common/EmptyState';
import SettingsModal from '../components/SettingsModal';
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
  const [showSettings, setShowSettings] = useState(false);
  const [showNewSale, setShowNewSale] = useState(false);
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
      
      // Updated to use Sonik API endpoint for all orders by event
      const result = await posService.getAllOrdersByEvent(eventId);
      setOrders(result.data);
      
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
  
  // Clean terminal ID display (remove Android_ and > characters)
  const cleanTerminalId = (terminalId) => {
    if (!terminalId) return '';
    return terminalId.replace(/^Android_|>/g, '').trim();
  };

  const handleChargePress = (order) => {
    if (!terminalId) {
      toast.error('Terminal no configurado. Por favor configure en Configuración.', {
        duration: 4000,
        position: 'top-center'
      });
      return;
    }
    
    if (processingOrders.has(order._id)) {
      return;
    }
    
    setSelectedOrder(order);
    setShowTierModal(true);
  };

  const handleNewSale = () => {
    if (!terminalId) {
      toast.error('Terminal no configurado. Por favor configure en Configuración.', {
        duration: 4000,
        position: 'top-center'
      });
      return;
    }
    setShowNewSale(true);
  };
  
  const handleConfirmCharge = async () => {
    if (!selectedOrder || !terminalId) return;
    
    setShowTierModal(false);
    
    // Add to processing set
    setProcessingOrders(prev => new Set(prev).add(selectedOrder._id));
    
    // Update order status locally to show processing
    updateOrderLocally(selectedOrder._id, 'pending');
    
    try {
      if (isOffline) {
        // Queue for offline processing
        await queueOfflineCharge(selectedOrder);
        toast('Queued for processing when online', {
          icon: '⏱️',
          position: 'top-center'
        });
      } else {
        // Process charge using Sonik API
        const result = await posService.createBoldCharge({
          transactionId: selectedOrder._id,
          terminalId,
          eventId,
          amount: selectedOrder.priceBreakdown.total
        });
        
        if (result.chargeId) {
          // Start monitoring charge status
          monitorChargeStatus(result.chargeId, selectedOrder._id);
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
        
        // Map Bold status to Sonik status
        const mapBoldStatus = (boldStatus) => {
          switch (boldStatus) {
            case 'approved': return 'succeeded';
            case 'declined': return 'declined';
            case 'canceled': return 'canceled';
            case 'failed': 
            case 'timeout': 
            case 'error': return 'failed';
            default: return 'pending';
          }
        };

        const sonikStatus = mapBoldStatus(status.status);
        
        if (sonikStatus === 'succeeded') {
          updateOrderLocally(orderId, 'succeeded');
          removeFromProcessing(orderId);
          
          toast.success('¡Pago exitoso!', {
            duration: 3000,
            position: 'top-center',
            style: {
              background: '#10B981',
              color: '#fff',
            }
          });
        } else if (sonikStatus === 'declined') {
          updateOrderLocally(orderId, 'declined');
          removeFromProcessing(orderId);
          
          toast.error('Pago rechazado', {
            duration: 3000,
            position: 'top-center'
          });
        } else if (sonikStatus === 'canceled') {
          updateOrderLocally(orderId, 'canceled');
          removeFromProcessing(orderId);
          
          toast.info('Pago cancelado', {
            duration: 3000,
            position: 'top-center'
          });
        } else if (sonikStatus === 'failed') {
          updateOrderLocally(orderId, 'failed');
          removeFromProcessing(orderId);
          
          toast.error('Error en el pago', {
            duration: 3000,
            position: 'top-center'
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
        if (order._id === orderId) {
          return {
            ...order,
            status,
            errorDetails,
            updatedAt: new Date().toISOString()
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
      
      {/* Header */}
      <div className="bg-gray-800 p-4 border-b border-gray-700">
        <div className="flex items-center justify-between">
          <div className="flex-1 max-w-[65%]">
            <h1 className="text-xl font-bold text-white">Terminal POS</h1>
            <p className="text-gray-400 text-sm">Event ID: {eventId}</p>
          </div>
          
          {/* Header Controls */}
          <div className="flex items-center gap-4">
            {/* Terminal Status */}
            {terminalId ? (
              <div className="flex items-center gap-2 bg-green-900/50 px-3 py-2 rounded-lg border border-green-500/30">
                <span className="text-green-400 text-sm font-medium">
                  {cleanTerminalId(terminalId)}
                </span>
              </div>
            ) : (
              <div className="flex items-center gap-2 bg-red-600 px-3 py-2 rounded-lg border border-red-500">
                <span className="text-white text-sm font-medium">Terminal no asignado</span>
              </div>
            )}
            
            {/* Refresh Button */}
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="p-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors disabled:opacity-50"
              title="Actualizar datos"
            >
              {refreshing ? <LoadingSpinner size="small" /> : (
                <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              )}
            </button>

            {/* Settings Button */}
            <button
              onClick={() => setShowSettings(true)}
              className="p-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors"
              title="Configuración"
            >
              <Settings className="h-4 w-4 text-white" />
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="p-4">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold text-white">Órdenes</h2>
          {/* New Sale Button */}
          <button
            onClick={handleNewSale}
            className="flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors"
            style={{ background: "linear-gradient(to right, #F2EFFE, #CBBEFC)", color: "black" }}
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Nueva Venta
          </button>
        </div>
      
        {/* Orders List */}
        <div className="space-y-3">
          {orders.length === 0 ? (
            <EmptyState
              icon="📋"
              title="No hay órdenes"
              message="Todas las órdenes completadas y pendientes aparecerán aquí"
            />
          ) : (
            orders.map(order => (
              <OrderCard
                key={order._id}
                order={order}
                onCharge={() => handleChargePress(order)}
                isProcessing={processingOrders.has(order._id)}
                isOffline={isOffline}
              />
            ))
          )}
        </div>
      </div>
      
      {/* Modals */}
      <TicketTierModal
        visible={showTierModal}
        order={selectedOrder}
        ticketTiers={ticketTiers}
        onConfirm={handleConfirmCharge}
        onCancel={() => setShowTierModal(false)}
      />

      <SettingsModal
        visible={showSettings}
        eventId={eventId}
        onClose={() => setShowSettings(false)}
        onTerminalUpdate={(newTerminalId) => setTerminalId(newTerminalId)}
      />
    </div>
  );
};

export default POSScreen;