import React, { useState, useEffect } from 'react';
import TerminalStatusIndicator from './TerminalStatusIndicator';
import terminalService from '../../services/terminalService';
import toast from 'react-hot-toast';

const TerminalSelectorModal = ({ visible, eventId, onSelect, onCancel }) => {
  const [terminals, setTerminals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedTerminal, setSelectedTerminal] = useState(null);

  useEffect(() => {
    if (visible && eventId) {
      loadAvailableTerminals();
    }
  }, [visible, eventId]);

  const loadAvailableTerminals = async () => {
    setLoading(true);
    try {
      const data = await terminalService.getAvailableTerminals(eventId);
      setTerminals(data);
    } catch (error) {
      toast.error('Failed to load terminals');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleSelect = () => {
    if (selectedTerminal) {
      onSelect(selectedTerminal);
    }
  };

  if (!visible) return null;

  return (
    <div 
      className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 animate-fade-in"
      onClick={onCancel}
    >
      <div 
        className="bg-gray-900 rounded-2xl w-full max-w-lg mx-4 max-h-[80vh] overflow-hidden shadow-2xl animate-slide-up"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center p-5 border-b border-gray-800">
          <h3 className="text-xl font-semibold text-white">Select Terminal</h3>
          <button 
            className="text-gray-400 hover:text-white hover:bg-gray-800 w-8 h-8 rounded-lg flex items-center justify-center transition-colors"
            onClick={onCancel}
          >
            ×
          </button>
        </div>
        
        <div className="p-5 overflow-y-auto max-h-[60vh]">
          {loading ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white mx-auto"></div>
              <p className="text-gray-400 mt-2">Loading terminals...</p>
            </div>
          ) : terminals.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-gray-400">No terminals available</p>
              <p className="text-sm text-gray-500 mt-2">Contact your supervisor to add terminals</p>
            </div>
          ) : (
            <div className="space-y-3">
              {terminals.map((terminal) => (
                <div
                  key={terminal.terminalId}
                  className={`p-4 rounded-lg border cursor-pointer transition-all ${
                    selectedTerminal?.terminalId === terminal.terminalId
                      ? 'bg-indigo-600/20 border-indigo-600'
                      : 'bg-gray-800 border-gray-700 hover:border-gray-600'
                  } ${!terminal.available && !terminal.isCurrentUser ? 'opacity-50 cursor-not-allowed' : ''}`}
                  onClick={() => {
                    if (terminal.available || terminal.isCurrentUser) {
                      setSelectedTerminal(terminal);
                    }
                  }}
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <h4 className="text-white font-medium">{terminal.terminalId}</h4>
                      <p className="text-sm text-gray-400 mt-1">{terminal.location}</p>
                      {terminal.serialNumber && (
                        <p className="text-xs text-gray-500 mt-1">S/N: {terminal.serialNumber}</p>
                      )}
                    </div>
                    <div className="text-right">
                      <TerminalStatusIndicator status={terminal.status} />
                      {!terminal.available && !terminal.isCurrentUser && (
                        <p className="text-xs text-red-400 mt-2">In use</p>
                      )}
                      {terminal.isCurrentUser && (
                        <p className="text-xs text-green-400 mt-2">Current</p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
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
            onClick={handleSelect}
            disabled={!selectedTerminal || loading}
          >
            Select Terminal
          </button>
        </div>
      </div>
    </div>
  );
};

export default TerminalSelectorModal;