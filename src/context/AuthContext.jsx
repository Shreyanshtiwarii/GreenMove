import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import {
  getToken,
  getStoredUser,
  fetchCurrentUser,
  loginUser,
  registerUser,
  loginWithGoogleIdToken,
  logoutUser
} from '../services/authService';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => getStoredUser());
  const [initializing, setInitializing] = useState(true);

  // On mount, verify any stored token is still valid against the backend.
  useEffect(() => {
    let cancelled = false;

    async function verify() {
      const token = getToken();
      if (!token) {
        setInitializing(false);
        return;
      }
      const fresh = await fetchCurrentUser();
      if (cancelled) return;
      if (fresh) {
        setUser((prev) => ({ ...prev, ...fresh }));
      } else {
        // Token missing/expired/invalid - clear stale session.
        logoutUser();
        setUser(null);
      }
      setInitializing(false);
    }

    verify();
    return () => { cancelled = true; };
  }, []);

  const login = useCallback(async (email, password) => {
    const loggedInUser = await loginUser({ email, password });
    setUser(loggedInUser);
    return loggedInUser;
  }, []);

  const register = useCallback(async (name, email, password, confirmPassword) => {
    const newUser = await registerUser({ name, email, password, confirmPassword });
    setUser(newUser);
    return newUser;
  }, []);

  const loginWithGoogle = useCallback(async (idToken) => {
    const loggedInUser = await loginWithGoogleIdToken(idToken);
    setUser(loggedInUser);
    return loggedInUser;
  }, []);

  const logout = useCallback(() => {
    logoutUser();
    setUser(null);
  }, []);

  const value = {
    user,
    isAuthenticated: !!user,
    initializing,
    login,
    register,
    loginWithGoogle,
    logout
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return ctx;
}
