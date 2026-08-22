import React from 'react';
import { BrowserRouter as Router, Routes, Route, Outlet, Navigate } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import Header from './components/Header';
import LandingPage from './pages/LandingPage';
import SignIn from './pages/SignIn';
import SignUp from './pages/SignUp';
import Dashboard from './pages/Dashboard';
import PlanRoute from './pages/PlanRoute';
import CompareOptions from './pages/CompareOptions';
import JourneyHistory from './pages/JourneyHistory';
import MyImpact from './pages/MyImpact';
import VehiclePool from './pages/VehiclePool';
import EVIntelligence from './pages/EVIntelligence';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';

// Admin Imports
import AdminLayout from './components/AdminLayout';
import AdminLogin from './pages/admin/AdminLogin';
import AdminDashboard from './pages/admin/AdminDashboard';
import AdminTransportData from './pages/admin/AdminTransportData';
import AdminUsers from './pages/admin/AdminUsers';
import AdminFuelPrices from './pages/admin/AdminFuelPrices';
import AdminEmissionFactors from './pages/admin/AdminEmissionFactors';
import AdminEVData from './pages/admin/AdminEVData';
import AdminTransitData from './pages/admin/AdminTransitData';
import AdminIntegrations from './pages/admin/AdminIntegrations';
import AdminSystemHealth from './pages/admin/AdminSystemHealth';
import AdminAnalytics from './pages/admin/AdminAnalytics';
import AdminAuditLogs from './pages/admin/AdminAuditLogs';
import AdminProfile from './pages/admin/AdminProfile';

// Developer Imports
import DeveloperLanding from './pages/developer/DeveloperLanding';
import DeveloperLogin from './pages/developer/DeveloperLogin';

function AppLayout() {
  return (
    <div className="bg-background text-on-background font-body-md antialiased min-h-screen">
      <Sidebar />
      <div className="md:ml-[260px] min-h-screen flex flex-col">
        <Header />
        <main className="flex-1 flex flex-col h-[calc(100vh-64px)] min-h-0">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          {/* Public Landing Page */}
          <Route path="/" element={<LandingPage />} />

          {/* Authentication */}
          <Route path="/signin" element={<SignIn />} />
          <Route path="/signup" element={<SignUp />} />

          {/* Admin Login & Control Center */}
          <Route path="/admin/login" element={<AdminLogin />} />
          <Route element={<AdminLayout />}>
            <Route path="/admin" element={<AdminDashboard />} />
            <Route path="/admin/dashboard" element={<AdminDashboard />} />
            <Route path="/admin/transport-data" element={<AdminTransportData />} />
            <Route path="/admin/users" element={<AdminUsers />} />
            <Route path="/admin/fuel-prices" element={<AdminFuelPrices />} />
            <Route path="/admin/emission-factors" element={<AdminEmissionFactors />} />
            <Route path="/admin/ev-data" element={<AdminEVData />} />
            <Route path="/admin/transit-data" element={<AdminTransitData />} />
            <Route path="/admin/integrations" element={<AdminIntegrations />} />
            <Route path="/admin/system-health" element={<AdminSystemHealth />} />
            <Route path="/admin/analytics" element={<AdminAnalytics />} />
            <Route path="/admin/audit-logs" element={<AdminAuditLogs />} />
            <Route path="/admin/profile" element={<AdminProfile />} />
          </Route>

          {/* Developer Landing & Login Routes */}
          <Route path="/developer" element={<DeveloperLanding />} />
          <Route path="/developer/login" element={<DeveloperLogin />} />

          {/* Application User Layout Routes (require authentication) */}
          <Route element={<ProtectedRoute />}>
            <Route element={<AppLayout />}>
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/plan-route" element={<PlanRoute />} />
              <Route path="/compare" element={<CompareOptions />} />
              <Route path="/history" element={<JourneyHistory />} />
              <Route path="/impact" element={<MyImpact />} />
              <Route path="/vehicle-pool" element={<VehiclePool />} />
              <Route path="/ev-intelligence" element={<EVIntelligence />} />
              <Route path="/ev-carpool" element={<Navigate to="/vehicle-pool" replace />} />
              <Route path="/carpool" element={<Navigate to="/vehicle-pool" replace />} />

              <Route path="/notifications" element={
                <div className="p-md lg:p-lg text-on-surface">
                  <h2 className="text-headline-md font-headline-md text-primary mb-4">Notifications</h2>
                  <div className="bg-surface-container-lowest border border-outline-variant p-4 rounded-xl shadow-sm text-body-md text-on-surface-variant">
                    No new notifications. Your commute is on track!
                  </div>
                </div>
              } />
              <Route path="/profile" element={
                <div className="p-md lg:p-lg text-on-surface">
                  <h2 className="text-headline-md font-headline-md text-primary mb-4">Profile Settings</h2>
                  <div className="bg-surface-container-lowest border border-outline-variant p-4 rounded-xl shadow-sm text-body-md text-on-surface-variant">
                    Profile settings configuration panel.
                  </div>
                </div>
              } />
            </Route>
          </Route>

          {/* Catch-all Redirect */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Router>
    </AuthProvider>
  );
}

export default App;
