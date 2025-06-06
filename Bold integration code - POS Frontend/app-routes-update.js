// src/App.js - Updated routing to include POS
import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import EventScreen from './pages/EventScreen';
import ScanScreen from './pages/ScanScreen';
import POSScreen from './pages/POSScreen';
import QRScreen from './pages/QRScreen';
import BottomNavigation from './components/common/BottomNavigation';
import { Toaster } from 'react-hot-toast';

function App() {
  return (
    <Router>
      <div className="min-h-screen bg-gray-900">
        <Routes>
          <Route path="/" element={<Navigate to="/event/default" replace />} />
          <Route path="/event/:eventId" element={<EventScreen />} />
          <Route path="/scan/:eventId" element={<ScanScreen />} />
          <Route path="/pos/:eventId" element={<POSScreen />} />
          <Route path="/qr/:eventId" element={<QRScreen />} />
        </Routes>
        <BottomNavigation />
        <Toaster 
          position="top-center"
          toastOptions={{
            duration: 3000,
            style: {
              background: '#1f2937',
              color: '#fff',
              borderRadius: '0.5rem',
              padding: '1rem',
            },
            success: {
              iconTheme: {
                primary: '#10B981',
                secondary: '#fff',
              },
              style: {
                background: '#065F46',
              },
            },
            error: {
              iconTheme: {
                primary: '#EF4444',
                secondary: '#fff',
              },
              style: {
                background: '#7F1D1D',
              },
            },
          }}
        />
      </div>
    </Router>
  );
}

export default App;