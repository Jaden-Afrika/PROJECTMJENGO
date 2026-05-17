import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './AuthContext';

// --- Placeholder Components (We will build these next) ---
const Login = () => {
  const { login, user } = useAuth();
  if (user) return <Navigate to="/dashboard" />;
  
  return (
    <div className="flex flex-col items-center justify-center h-screen bg-slate-50">
      <h1 className="text-3xl font-bold mb-6 text-slate-800">Project Mjengo</h1>
      <p className="mb-8 text-slate-600 text-center px-4">Securely manage your construction site expenses and progress.</p>
      <button 
        onClick={login}
        className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 rounded-full font-semibold transition-all shadow-lg"
      >
        Sign in with Google
      </button>
    </div>
  );
};

const Dashboard = () => {
  const { user, logout } = useAuth();
  return (
    <div className="p-6 max-w-4xl mx-auto">
      <header className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-2xl font-bold">Mjengo Dashboard</h1>
          <p className="text-gray-600">Welcome back, {user?.displayName}</p>
        </div>
        <button onClick={logout} className="text-red-500 text-sm font-medium">Logout</button>
      </header>
      
      {/* This is where your MVP features will live */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="p-6 bg-white border rounded-xl shadow-sm">
          <h2 className="font-bold mb-2">Active Project</h2>
          <p className="text-gray-500">Three Bedroom House - Lang'ata</p>
        </div>
        <div className="p-6 bg-white border rounded-xl shadow-sm">
          <h2 className="font-bold mb-2">Total Spent</h2>
          <p className="text-2xl font-bold text-green-600">KES 0.00</p>
        </div>
      </div>
    </div>
  );
};

// --- Protected Route Wrapper ---
const ProtectedRoute = ({ children }) => {
  const { user, loading } = useAuth();
  
  if (loading) return <div className="flex h-screen items-center justify-center">Loading...</div>;
  if (!user) return <Navigate to="/" />;
  
  return children;
};

// --- Main App Component ---
function App() {
  return (
    <AuthProvider>
      <Router>
        <div className="min-h-screen bg-slate-50">
          <Routes>
            <Route path="/" element={<Login />} />
            <Route 
              path="/dashboard" 
              element={
                <ProtectedRoute>
                  <Dashboard />
                </ProtectedRoute>
              } 
            />
            {/* Redirect any unknown routes to login */}
            <Route path="*" element={<Navigate to="/" />} />
          </Routes>
        </div>
      </Router>
    </AuthProvider>
  );
}

export default App;