import React from 'react';

const TerminalStatusIndicator = ({ status, size = 'small' }) => {
  const getStatusConfig = () => {
    switch (status) {
      case 'online':
        return {
          color: 'bg-green-500',
          label: 'Online',
          icon: '●'
        };
      case 'offline':
        return {
          color: 'bg-red-500',
          label: 'Offline',
          icon: '○'
        };
      case 'busy':
        return {
          color: 'bg-yellow-500',
          label: 'Processing',
          icon: '◐'
        };
      case 'unknown':
      default:
        return {
          color: 'bg-gray-500',
          label: 'Unknown',
          icon: '○'
        };
    }
  };

  const config = getStatusConfig();
  const sizeClasses = size === 'large' ? 'w-4 h-4' : 'w-3 h-3';

  return (
    <div className="flex items-center gap-2">
      <div className={`${sizeClasses} ${config.color} rounded-full animate-pulse`} />
      <span className="text-sm text-gray-300">{config.label}</span>
    </div>
  );
};

export default TerminalStatusIndicator;