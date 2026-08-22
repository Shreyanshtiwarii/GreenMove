import React, { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import LogoutConfirmDialog from './LogoutConfirmDialog';

export default function Sidebar() {
  const navigate = useNavigate();
  const { logout } = useAuth();
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  const menuItems = [
    { name: 'Dashboard', path: '/dashboard', icon: 'dashboard', fillIcon: true },
    { name: 'Vehicle Pool', path: '/vehicle-pool', icon: 'group' },
    { name: 'EV Intelligence', path: '/ev-intelligence', icon: 'ev_station' },
    { name: 'Plan Route', path: '/plan-route', icon: 'route' },
    { name: 'Compare', path: '/compare', icon: 'compare_arrows' },
    { name: 'My Impact', path: '/impact', icon: 'eco' },
    { name: 'History', path: '/history', icon: 'history' },
  ];

  const handleLogout = () => {
    logout();
    navigate('/', { replace: true });
  };

  return (
    <nav className="hidden md:flex flex-col h-full py-md bg-surface-container fixed left-0 top-0 w-[260px] border-r border-outline-variant z-50">
      <div className="px-md mb-8 flex items-center gap-3">
        <span className="material-symbols-outlined text-primary text-3xl" style={{ fontVariationSettings: "'FILL' 1" }}>eco</span>
        <div>
          <h1 className="text-headline-md font-headline-md font-bold text-primary">GreenMove</h1>
          <p className="text-label-xs font-label-xs text-on-surface-variant">Sustainable Transit</p>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto">
        <div className="space-y-1">
          {menuItems.map((item) => (
            <NavLink
              key={item.name + '-' + item.path}
              to={item.path}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-lg px-4 py-3 mx-2 transition-transform duration-200 ${
                  isActive 
                    ? 'bg-secondary-container text-on-secondary-container scale-98 hover:bg-secondary-fixed-dim' 
                    : 'text-on-surface-variant hover:text-primary hover:bg-surface-variant'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <span 
                    className="material-symbols-outlined" 
                    style={{ fontVariationSettings: (isActive || item.fillIcon) ? "'FILL' 1" : "'FILL' 0" }}
                  >
                    {item.icon}
                  </span>
                  <span className="font-label-sm">{item.name}</span>
                </>
              )}
            </NavLink>
          ))}
        </div>
      </div>
      <div className="mt-auto border-t border-outline-variant pt-4 space-y-1">
        <NavLink
          to="/profile"
          className={({ isActive }) =>
            `flex items-center gap-3 rounded-lg px-4 py-3 mx-2 transition-colors duration-200 ${
              isActive ? 'bg-surface-variant text-primary' : 'text-on-surface-variant hover:text-primary hover:bg-surface-variant'
            }`
          }
        >
          <span className="material-symbols-outlined">person</span>
          <span className="font-label-sm">Profile Settings</span>
        </NavLink>
        <button
          onClick={() => setShowLogoutConfirm(true)}
          className="flex items-center gap-3 rounded-lg px-4 py-3 mx-2 w-[calc(100%-1rem)] text-left transition-colors duration-200 text-on-surface-variant hover:text-error hover:bg-surface-variant cursor-pointer"
        >
          <span className="material-symbols-outlined">logout</span>
          <span className="font-label-sm">Log Out</span>
        </button>
      </div>
      <LogoutConfirmDialog
        open={showLogoutConfirm}
        onCancel={() => setShowLogoutConfirm(false)}
        onConfirm={() => {
          setShowLogoutConfirm(false);
          handleLogout();
        }}
      />
    </nav>
  );
}
