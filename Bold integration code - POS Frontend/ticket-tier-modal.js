// src/components/scanner/TicketTierModal.js
import React from 'react';
import { formatCurrency } from '../../utils/format';

const TicketTierModal = ({ visible, order, ticketTiers, onConfirm, onCancel }) => {
  if (!visible || !order) return null;
  
  return (
    <div 
      className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 animate-fade-in"
      onClick={onCancel}
    >
      <div 
        className="bg-gray-900 rounded-2xl w-full max-w-lg mx-4 max-h-[90vh] overflow-hidden shadow-2xl animate-slide-up"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center p-5 border-b border-gray-800">
          <h3 className="text-xl font-semibold text-white">Confirm Charge</h3>
          <button 
            className="text-gray-400 hover:text-white hover:bg-gray-800 w-8 h-8 rounded-lg flex items-center justify-center transition-colors"
            onClick={onCancel}
          >
            ×
          </button>
        </div>
        
        <div className="p-5 overflow-y-auto max-h-[60vh]">
          <div className="bg-gray-800 rounded-xl p-4">
            <div className="flex justify-between items-center mb-3">
              <span className="text-sm text-gray-400">Customer:</span>
              <span className="text-base text-white font-medium">{order.customerName}</span>
            </div>
            
            <div className="mb-4 pb-4 border-b border-gray-700">
              <span className="text-sm text-gray-400 block mb-2">Items:</span>
              <div className="space-y-1">
                {order.itemsDetail.map((item, index) => (
                  <div key={index} className="flex justify-between items-center text-gray-300">
                    <span>{item.quantity}x {item.name}</span>
                    <span className="text-gray-400 font-medium">
                      {formatCurrency(item.price * item.quantity, order.currency)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
            
            <div className="flex justify-between items-center pt-2">
              <span className="text-base font-semibold text-gray-200">Total Amount:</span>
              <span className="text-2xl font-bold text-white">
                {formatCurrency(order.totalAmount, order.currency)}
              </span>
            </div>
          </div>
          
          {ticketTiers.length === 0 && (
            <div className="mt-4 p-4 bg-red-500/10 rounded-lg text-center">
              <span className="text-2xl block mb-2">⚠️</span>
              <p className="text-red-400 text-sm">No door sales ticket tiers available for this event.</p>
            </div>
          )}
        </div>
        
        <div className="p-5 border-t border-gray-800 flex gap-3 justify-end">
          <button 
            className="px-6 py-3 bg-gray-700 hover:bg-gray-600 text-white font-medium rounded-lg transition-colors"
            onClick={onCancel}
          >
            Cancel
          </button>
          <button 
            className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-600 text-white font-medium rounded-lg transition-colors disabled:cursor-not-allowed"
            onClick={onConfirm}
            disabled={ticketTiers.length === 0}
          >
            Charge {formatCurrency(order.totalAmount, order.currency)}
          </button>
        </div>
      </div>
    </div>
  );
};

export default TicketTierModal;