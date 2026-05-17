import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './AuthContext';
import ProjectSelection from './projectselection';
import Dashboard from './Dashboard';

// --- Placeholder Components (We will build these next) ---
const Login = () => {
  const { login, user } = useAuth();
  if (user) return <Navigate to="/projects" />;
  
  return (
    <div 
      className="flex flex-col items-center justify-center h-screen bg-cover bg-center relative"
      style={{ 
        backgroundImage: `url('https://images.unsplash.com/photo-1541888946425-d81bb19240f5?auto=format&fit=crop&w=1920&q=80')` 
      }}
    >
      {/* Dark overlay to make text pop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm"></div>

      {/* Login Card Container */}
      <div className="bg-white/95 p-8 rounded-3xl shadow-2xl max-w-md w-full mx-4 text-center relative z-10 border border-white/20">
        <div className="">
          <div
           img src="/PROJECTMJENGO.png" alt="Logo"/>
          {/* Simple clean construction grid icon using plain CSS shapes */}
          <div className="grid grid-cols-2 gap-1 w-6 h-6">
            <div className="border-2 border-orange-600 rounded-sm"></div>
            <div className="border-2 border-orange-600 rounded-sm"></div>
            <div className="border-2 border-orange-600 rounded-sm"></div>
            <div className="border-2 border-orange-600 rounded-sm"></div>
          </div>
        </div>

        <h1 className="text-3xl font-black mb-2 text-black tracking-tight">PROJECT MJENGO</h1>
        <p className="text-sm font-semibold text-orange-600 uppercase tracking-wider mb-4">Construction Ledger</p>
        
        <p className="mb-8 text-slate-600 text-sm leading-relaxed">
          Transparent, real-time tracking for building materials, labor costs, and site budgeting.
        </p>
        
        <button 
          onClick={login}
          className="w-full bg-orange-600 hover:bg-orange-700 text-white px-6 py-3.5 rounded-xl font-bold transition-all shadow-lg flex items-center justify-center gap-3 border border-orange-700"
        >
          {/* Simple flat multi-color Google 'G' icon placeholder using CSS background text */}
          <span className="font-black text-lg bg-gradient-to-r from-red-500 via-green-500 to-blue-500 bg-clip-text text-transparent">G</span>
          Sign in with Google Account
        </button>
        
        <p className="mt-6 text-xs text-gray-500 font-medium">
          Secure cloud authorization • Zero local footprint
        </p>
      </div>
    </div>
  );
};

const ProjectSelectionPage = () => {
  const navigate = useNavigate();

  return <ProjectSelection onSelectProject={(project) => navigate(`/dashboard/${project.id}`)} />;
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
        <div className="min-h-screen bg-white">
          <Routes>
            <Route path="/" element={<Login />} />
            <Route 
              path="/projects" 
              element={
                <ProtectedRoute>
                  <ProjectSelectionPage />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/dashboard" 
              element={<Navigate to="/projects" />} 
            />
            <Route 
              path="/dashboard/:projectId" 
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
