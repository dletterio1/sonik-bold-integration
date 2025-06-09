// src/components/scanner/OrderCard.js
import React from 'react';
import { formatCurrency } from '../../utils/format';

const OrderCard = ({ order, onCharge, isProcessing, isOffline }) => {
  const getStatusBadge = () => {
    if (isProcessing || order.status === 'pending') {
      return (
        <div className="w-8 h-8 rounded-full bg-indigo-500 flex items-center justify-center">
          <div className="w-4 h-4 border-2 border-white rounded-full border-t-transparent animate-spin"></div>
        </div>
      );
    }
    
    switch (order.status) {
      case 'succeeded':
        return (
          <div className="w-8 h-8 rounded-full bg-green-500 flex items-center justify-center">
            <span className="text-white font-bold">✓</span>
          </div>
        );
      case 'declined':
        return (
          <div className="w-8 h-8 rounded-full bg-red-500 flex items-center justify-center">
            <span className="text-white font-bold">✕</span>
          </div>
        );
      case 'canceled':
        return (
          <div className="w-8 h-8 rounded-full bg-gray-500 flex items-center justify-center">
            <span className="text-white font-bold">⊘</span>
          </div>
        );
      case 'failed':
      case 'rejected':
        return (
          <div className="w-8 h-8 rounded-full bg-red-600 flex items-center justify-center">
            <span className="text-white font-bold">!</span>
          </div>
        );
      case 'refunded':
        return (
          <div className="w-8 h-8 rounded-full bg-orange-500 flex items-center justify-center">
            <span className="text-white font-bold">↩</span>
          </div>
        );
      case 'pending':
      default:
        return (
          <div className="w-8 h-8 rounded-full bg-yellow-400 flex items-center justify-center">
            <span className="w-3 h-3 bg-yellow-900 rounded-full"></span>
          </div>
        );
    }
  };
  
  const canCharge = () => {
    return ['pending', 'declined', 'canceled', 'failed'].includes(order.status) && !isProcessing && !isOffline;
  };
  
  const getChargeButtonText = () => {
    if (isProcessing) return 'Procesando...';
    if (isOffline) return 'Sin conexión';
    if (order.errorDetails) return 'Reintentar';
    if (order.status === 'declined') return 'Reintentar';
    if (order.status === 'canceled') return 'Procesar';
    if (order.status === 'failed') return 'Reintentar';
    return 'Procesar Pago';
  };
  
      // Format customer name from Sonik user data
    const getCustomerName = () => {
      if (order._user) {
        return `${order._user.firstName || ''} ${order._user.lastName || ''}`.trim() || 'Cliente';
      }
      if (order.source === 'pos') {
        return 'Venta Presencial';
      }
      return 'Cliente';
    };

    // Format ticket items from Sonik ticketItems
    const getTicketItems = () => {
      if (!order.ticketItems || order.ticketItems.length === 0) return ['Sin items'];
      return order.ticketItems.map(item => 
        `${item._tickettier?.name || 'Ticket'} x${item.quantity}`
      );
    };

    // Get total quantity from Sonik ticketItems
    const getTotalQuantity = () => {
      if (!order.ticketItems) return 0;
      return order.ticketItems.reduce((total, item) => total + item.quantity, 0);
    };

    return (
    <div className={`
      bg-gray-800 rounded-xl p-4 transition-all border
      ${order.status === 'succeeded' ? 'bg-green-900/20 border-green-500' : ''}
      ${order.status === 'declined' ? 'bg-red-900/20 border-red-500' : ''}
      ${order.status === 'canceled' ? 'bg-gray-900/20 border-gray-500' : ''}
      ${order.status === 'failed' ? 'bg-red-900/30 border-red-600' : ''}
      ${order.status === 'pending' ? 'border-transparent hover:border-gray-700' : ''}
      ${isProcessing ? 'opacity-80' : ''}
    `}>
      <div className="flex justify-between items-start mb-3">
        <div className="flex-1">
          <h3 className="text-lg font-semibold text-white mb-1">{getCustomerName()}</h3>
          <div className="text-sm text-gray-400">
            {getTicketItems().join(' • ')}
          </div>
        </div>
        {getStatusBadge()}
      </div>
      
      <div className="flex justify-between items-center">
        <div>
          <div className="text-xl font-medium text-white">
            {formatCurrency(order.priceBreakdown?.total || 0, order.priceBreakdown?.currency || 'COP')}
          </div>
          <div className="text-sm text-gray-400">
            {getTotalQuantity()} {getTotalQuantity() === 1 ? 'boleto' : 'boletos'}
          </div>
        </div>
        
        {canCharge() && (
          <button 
            className="bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-600 text-white font-semibold py-2 px-5 rounded-lg transition-all transform hover:scale-105 active:scale-95 disabled:transform-none disabled:cursor-not-allowed"
            onClick={onCharge}
            disabled={isProcessing || isOffline}
          >
            {getChargeButtonText()}
          </button>
        )}
      </div>
      
      {order.errorDetails && order.status === 'pending' && (
        <div className="mt-3 p-2 bg-red-500/10 rounded-lg flex items-center gap-2">
          <span>⚠️</span>
          <span className="text-sm text-red-400">{order.errorDetails.message}</span>
        </div>
      )}
      
      {order.status === 'declined' && order.errorDetails && (
        <div className="mt-2 text-sm text-red-400 pl-1">
          {order.errorDetails.message}
        </div>
      )}
    </div>
  );
};

export default OrderCard;