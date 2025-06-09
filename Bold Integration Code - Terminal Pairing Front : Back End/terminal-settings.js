import React, { useState, useEffect } from 'react';
import TerminalStatusIndicator from './TerminalStatusIndicator';
import TerminalSelectorModal from './TerminalSelectorModal';
import terminalService from '../services/terminal.service.js';
import toast from 'react-hot-toast';

const TerminalSettings = ({ eventId }) => {
  const [assignment, setAssignment] = useState(null);
  const [loading, setLoading] = useState(true);
  const [testing, setTesting] = useState(false);
  const [showSelector, setShowSelector] = useState(false);
  const [statusInterval, setStatusInterval] = useState(null);

  useEffect(() => {
    if (eventId) {
      loadAssignment();
      
      // Set up status polling
      const interval = setInterval(() => {
        if (assignment?.terminalId) {
          updateTerminalStatus();
        }
      }, 30000); // 30 seconds
      
      setStatusInterval(interval);
      
      return () => {
        if (interval) clearInterval(interval);
      };
    }
  }, [eventId]);

  useEffect(() => {
    // Update status when assignment changes
    if (assignment?.terminalId) {
      updateTerminalStatus();
    }
  }, [assignment?.terminalId]);

  const loadAssignment = async () => {
    setLoading(true);
    try {
      const data = await terminalService.getCurrentAssignment(eventId);
      setAssignment(data);
    } catch (error) {
      console.error('Failed to load terminal assignment:', error);
    } finally {
      setLoading(false);
    }
  };

  const updateTerminalStatus = async () => {
    if (!assignment?.terminalId) return;
    
    try {
      const status = await terminalService.getTerminalStatus(assignment.terminalId);
      setAssignment(prev => ({
        ...prev,
        status: status.status,
        lastStatusCheck: status.timestamp
      }));
    } catch (error) {
      console.error('Failed to update terminal status:', error);
    }
  };

  const handleTerminalSelect = async (terminal) => {
    try {
      const result = await terminalService.assignTerminal(
        eventId,
        terminal.terminalId,
        terminal.location
      );
      
      setAssignment({
        terminalId: terminal.terminalId,
        location: terminal.location,
        status: terminal.status,
        assignedAt: result.assignedAt,
        lastStatusCheck: new Date()
      });
      
      setShowSelector(false);
      toast.success('Terminal assigned successfully');
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to assign terminal');
    }
  };

  const handleTestConnection = async () => {
    if (!assignment?.terminalId) return;
    
    setTesting(true);
    try {
      const result = await terminalService.testTerminalConnection(assignment.terminalId);
      
      if (result.success) {
        toast.success(result.message);
      } else {
        toast.error(result.message);
      }
    } catch (error) {
      toast.error('Failed to test terminal connection');
    } finally {
      setTesting(false);
    }
  };

  const handleReleaseTerminal = async () => {
    if (!assignment?.terminalId) return;
    
    try {
      await terminalService.releaseTerminal(eventId);
      setAssignment(null);
      toast.success('Terminal released');
    } catch (error) {
      toast.error('Failed to release terminal');
    }
  };

  const formatLastSync = (date) => {
    if (!date) return 'Nunca';
    
    const now = new Date();
    const lastCheck = new Date(date);
    const diffMinutes = Math.floor((now - lastCheck) / 60000);
    
    if (diffMinutes < 1) return 'Ahora';
    if (diffMinutes === 1) return 'Hace 1 minuto';
    if (diffMinutes < 60) return `Hace ${diffMinutes} minutos`;
    
    const diffHours = Math.floor(diffMinutes / 60);
    if (diffHours === 1) return 'Hace 1 hora';
    return `Hace ${diffHours} horas`;
  };

  if (loading) {
    return (
      <div className="bg-gray-800 rounded-xl p-6">
        <div className="animate-pulse">
          <div className="h-6 bg-gray-700 rounded w-1/3 mb-4"></div>
          <div className="h-4 bg-gray-700 rounded w-1/2"></div>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="bg-gray-800 rounded-xl p-6">
        <h3 className="text-lg font-semibold text-white mb-4">Terminal de Pago</h3>
        
        {!assignment ? (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-gray-400">Terminal:</span>
              <span className="text-white">No configurado</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-400">Estado:</span>
              <div className="flex items-center gap-2">
                <span className="text-yellow-500">⚠️</span>
                <span className="text-yellow-500">Sin terminal</span>
              </div>
            </div>
            <button
              onClick={() => setShowSelector(true)}
              className="w-full mt-4 px-4 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-lg transition-colors"
            >
              Configurar Terminal
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-gray-400">Terminal:</span>
              <span className="text-white font-medium">{assignment.terminalId}</span>
            </div>
            
            {assignment.location && (
              <div className="flex items-center justify-between">
                <span className="text-gray-400">Ubicación:</span>
                <span className="text-white">{assignment.location}</span>
              </div>
            )}
            
            <div className="flex items-center justify-between">
              <span className="text-gray-400">Estado:</span>
              <TerminalStatusIndicator status={assignment.status || 'unknown'} />
            </div>
            
            <div className="flex items-center justify-between">
              <span className="text-gray-400">Última sincronización:</span>
              <span className="text-gray-300 text-sm">
                {formatLastSync(assignment.lastStatusCheck)}
              </span>
            </div>
            
            <div className="flex gap-3 mt-6">
              <button
                onClick={handleTestConnection}
                disabled={testing}
                className="flex-1 px-4 py-3 bg-gray-700 hover:bg-gray-600 disabled:bg-gray-700 disabled:opacity-50 text-white font-medium rounded-lg transition-colors"
              >
                {testing ? 'Testing...' : 'Test Connection'}
              </button>
              <button
                onClick={() => setShowSelector(true)}
                className="flex-1 px-4 py-3 bg-gray-700 hover:bg-gray-600 text-white font-medium rounded-lg transition-colors"
              >
                Change Terminal
              </button>
            </div>
          </div>
        )}
      </div>

      <TerminalSelectorModal
        visible={showSelector}
        eventId={eventId}
        onSelect={handleTerminalSelect}
        onCancel={() => setShowSelector(false)}
      />
    </>
  );
};

export default TerminalSettings;