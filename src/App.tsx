import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Terms from './pages/Terms';
import Exam from './pages/Exam';
import ResultAnalysis from './pages/ResultAnalysis';
import AdminDashboard from './pages/AdminDashboard';
import { getSession } from './api';

import './App.css';

// Simple auth guard
const RequireAuth: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const user = getSession();
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
};

const RequireAdmin: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const user = getSession();
  if (!user) return <Navigate to="/login" replace />;
  if (user.role !== 'admin') return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
};

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Navigate to="/login" />} />
        <Route path="/login" element={<Login />} />
        <Route path="/dashboard" element={<RequireAuth><Dashboard /></RequireAuth>} />
        <Route path="/terms" element={<RequireAuth><Terms /></RequireAuth>} />
        <Route path="/exam" element={<RequireAuth><Exam /></RequireAuth>} />
        <Route path="/analysis/:id" element={<RequireAuth><ResultAnalysis /></RequireAuth>} />
        <Route path="/admin" element={<RequireAdmin><AdminDashboard /></RequireAdmin>} />
        <Route path="*" element={<Navigate to="/login" />} />
      </Routes>
    </Router>
  );
}

export default App;
