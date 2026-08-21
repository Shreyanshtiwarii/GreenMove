import React, { useState, useEffect } from 'react';
import { NavLink } from 'react-router-dom';

export default function Header() {
  const [isDarkMode, setIsDarkMode] = useState(false);

  useEffect(() => {
    // Check local storage or document class for initial mode
    const isDark = document.documentElement.classList.contains('dark') || 
                   localStorage.getItem('theme') === 'dark';
    setIsDarkMode(isDark);
    if (isDark) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, []);

  const toggleDarkMode = () => {
    const nextDark = !isDarkMode;
    setIsDarkMode(nextDark);
    if (nextDark) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  };

  return (
    <header className="flex justify-between items-center h-16 px-md w-full bg-surface/80 backdrop-blur-md sticky top-0 z-40 border-b border-outline-variant shadow-sm transition-opacity hover:opacity-100">
      <div className="flex items-center gap-4">
        <h2 className="text-headline-md font-headline-md font-bold text-primary hidden md:block">Good morning, Rahul 👋</h2>
        <h2 className="text-headline-md font-headline-md font-bold text-primary md:hidden">GreenMove</h2>
      </div>
      <div className="flex items-center gap-6">
        <div className="hidden md:flex gap-6">
          <a className="text-primary border-b-2 border-primary pb-1 font-label-sm" href="#overview">Overview</a>
          <a className="text-on-surface-variant hover:text-primary transition-colors font-label-sm" href="#analytics">Analytics</a>
        </div>
        <div className="flex items-center gap-3">
          <button className="text-on-surface-variant hover:text-primary transition-colors p-2 rounded-full hover:bg-surface-variant cursor-pointer">
            <span className="material-symbols-outlined">location_on</span>
          </button>
          <button className="text-on-surface-variant hover:text-primary transition-colors p-2 rounded-full hover:bg-surface-variant cursor-pointer">
            <span className="material-symbols-outlined">notifications</span>
          </button>
          <button 
            onClick={toggleDarkMode}
            className="text-on-surface-variant hover:text-primary transition-colors p-2 rounded-full hover:bg-surface-variant cursor-pointer"
          >
            <span className="material-symbols-outlined">{isDarkMode ? 'light_mode' : 'dark_mode'}</span>
          </button>
          <div className="w-8 h-8 rounded-full bg-secondary-fixed overflow-hidden border border-outline-variant">
            <img 
              alt="User Profile Avatar" 
              className="w-full h-full object-cover" 
              src="https://lh3.googleusercontent.com/aida-public/AB6AXuA8R5LI8FlY9fApjBuKfZKCILEd1RMeqJLC4D4Em64BPBLN8MhVYI6Qh1nE_fpQA8ra1-p8SaEKl9aDFSSb1lfVXy4cMi2q-_-GiHvooWJp6hTa23TVOD5fYoxqsV2DrGeTBxNsl8rYChDVjUWmT1CAoZdaLw6O2Sdobs1DTVPii-B9sO0xNT6FbOUbAcFimWrXfMH5zy6Nl2ONOAAI5lw3UIxNqDlBkWrkIGQ-ioGj0LJ6mGYJEBaL"
            />
          </div>
        </div>
      </div>
    </header>
  );
}
