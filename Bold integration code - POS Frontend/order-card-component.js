// src/components/scanner/OrderCard.js
import React from 'react';
import { formatCurrency } from '../../utils/format';

const OrderCard = ({ order, onCharge, isProcessing, isOffline }) => {
  const getStatusBadge = () => {
    if (isProcessing || order.status === 'processing') {
      return (
        <div className="w-8 h-8 rounded-full bg-indigo-500 flex items-center justify-center">
          <div className="w-4 h-4 border-2 border-white rounded-full border-t-transparent animate-spin"></div>
        </div>
      );
    }
    
    switch (order.status) {
      case 'paid':
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
    return order.status === 'pending' && !isProcessing && !isOffline;
  };
  
  const getChargeButtonText = () => {
    if (isProcessing) return 'Processing...';
    if (isOffline) return 'Offline';
    if (order.errorDetails) return 'Retry';
    return 'Charge';
  };
  
  return (
    <div className={`
      bg-gray-800 rounded-xl p-4 transition-all border
      ${order.status === 'paid' ? 'bg-green-900/20 border-green-500' : ''}
      ${order.status === 'declined' ? 'bg-red-900/20 border-red-500' : ''}
      ${order.status === 'pending' ? 'border-transparent hover:border-gray-700' : ''}
      ${isProcessing ? 'opacity-80' : ''}
    `}>
      <div className="flex justify-between items-start mb-3">
        <div className="flex-1">
          <h3 className="text-lg font-semibold text-white mb-1">{order.customerName}</h3>
          <div className="text-sm text-gray-400">
            {order.items.join(' • ')}
          </div>
        </div>
        {getStatusBadge()}
      </div>
      
      <div className="flex justify-between items-center">
        <div>
          <div className="text-xl font-bold text-white">
            {formatCurrency(order.totalAmount, order.currency)}
          </div>
          <div className="text-sm text-gray-400">
            {order.totalQuantity} {order.totalQuantity === 1 ? 'item' : 'items'}
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