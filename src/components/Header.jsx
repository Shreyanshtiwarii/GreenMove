import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getMyImpact } from '../services/impactService';

export default function Header() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const firstName = user?.name ? user.name.split(' ')[0] : 'there';
  const [savings, setSavings] = useState(null);

  const fetchSavings = async () => {
    if (!user) return;
    try {
      const data = await getMyImpact();
      setSavings(Math.round(data.realizedSavings || 0));
    } catch (e) {
      console.error("Failed to load navbar savings", e);
    }
  };

  useEffect(() => {
    fetchSavings();
    const handleUpdate = () => fetchSavings();
    window.addEventListener('impact-updated', handleUpdate);
    return () => window.removeEventListener('impact-updated', handleUpdate);
  }, [user]);

  return (
    <header className="flex justify-between items-center h-16 px-md w-full bg-surface/80 backdrop-blur-md sticky top-0 z-40 border-b border-outline-variant shadow-sm transition-opacity hover:opacity-100">
      <div className="flex items-center gap-4">
        <h2 className="text-headline-md font-headline-md font-bold text-primary hidden md:block">Hello, {firstName} 👋</h2>
        <h2 className="text-headline-md font-headline-md font-bold text-primary md:hidden">GreenMove</h2>
      </div>
      <div className="flex items-center gap-6">
        <div className="flex items-center gap-3">
          {savings !== null && (
            <button
              onClick={() => navigate('/impact')}
              className="bg-primary/10 text-primary hover:bg-primary/20 px-3 py-1.5 rounded-lg text-label-sm font-bold border border-primary/20 transition-colors cursor-pointer mr-2 flex items-center gap-1"
              title="Your Realized Savings"
            >
              <span className="material-symbols-outlined text-sm">savings</span>
              ₹{savings.toLocaleString()} Saved
            </button>
          )}
          <button className="text-on-surface-variant hover:text-primary transition-colors p-2 rounded-full hover:bg-surface-variant cursor-pointer">
            <span className="material-symbols-outlined">location_on</span>
          </button>
          <button className="text-on-surface-variant hover:text-primary transition-colors p-2 rounded-full hover:bg-surface-variant cursor-pointer">
            <span className="material-symbols-outlined">notifications</span>
          </button>
          <div className="w-8 h-8 rounded-full bg-secondary-fixed overflow-hidden border border-outline-variant flex items-center justify-center text-on-secondary-container font-label-sm font-bold">
            {user?.name ? user.name.charAt(0).toUpperCase() : (
              <img 
                alt="User Profile Avatar" 
                className="w-full h-full object-cover" 
                src="https://lh3.googleusercontent.com/aida-public/AB6AXuA8R5LI8FlY9fApjBuKfZKCILEd1RMeqJLC4D4Em64BPBLN8MhVYI6Qh1nE_fpQA8ra1-p8SaEKl9aDFSSb1lfVXy4cMi2q-_-GiHvooWJp6hTa23TVOD5fYoxqsV2DrGeTBxNsl8rYChDVjUWmT1CAoZdaLw6O2Sdobs1DTVPii-B9sO0xNT6FbOUbAcFimWrXfMH5zy6Nl2ONOAAI5lw3UIxNqDlBkWrkIGQ-ioGj0LJ6mGYJEBaL"
              />
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
