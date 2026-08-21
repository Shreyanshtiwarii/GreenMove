import { API_BASE_URL } from '../config';
import { setCurrentUser } from './historyService';

const TOKEN_KEY = 'greenmove_auth_token';
const USER_KEY = 'greenmove_auth_user';

/**
 * Real authentication service backed by the Spring Boot /api/v1/auth endpoints.
 * On successful sign-in/sign-up it also syncs the app's existing lightweight
 * "current user" session (see historyService.getCurrentUser/setCurrentUser) so
 * journeys, carpool matching, etc. automatically reflect the real logged-in user.
 */

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function getStoredUser() {
  try {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function persistSession(token, user) {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
  if (user?.id && user?.name) {
    setCurrentUser(user.id, user.name);
  }
}

async function parseResponse(res) {
  let body = null;
  try {
    body = await res.json();
  } catch {
    // no JSON body
  }
  if (!res.ok) {
    const message = body?.message || 'Something went wrong. Please try again.';
    throw new Error(message);
  }
  return body;
}

export async function registerUser({ name, email, password, confirmPassword }) {
  const res = await fetch(`${API_BASE_URL}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, email, password, confirmPassword })
  });
  const data = await parseResponse(res);
  persistSession(data.token, data.user);
  return data.user;
}

export async function loginUser({ email, password }) {
  const res = await fetch(`${API_BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
  });
  const data = await parseResponse(res);
  persistSession(data.token, data.user);
  return data.user;
}

export async function loginWithGoogleIdToken(idToken) {
  const res = await fetch(`${API_BASE_URL}/auth/google`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ idToken })
  });
  const data = await parseResponse(res);
  persistSession(data.token, data.user);
  return data.user;
}

export async function fetchCurrentUser() {
  const token = getToken();
  if (!token) return null;
  try {
    const res = await fetch(`${API_BASE_URL}/auth/me`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export function logoutUser() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
  // Reset the shared "current user" session helpers back to their unauthenticated default
  // so no stale identity leaks into journeys/carpool after logout.
  localStorage.removeItem('greenmove_user_id');
  localStorage.removeItem('greenmove_user_name');
}
