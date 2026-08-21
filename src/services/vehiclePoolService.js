import { API_BASE_URL } from '../config';
import { getToken } from './authService';

/**
 * REST client for the "Vehicle Pool" feature backed by the Spring Boot
 * /api/v1/pools endpoints. Every mutating call requires the authenticated
 * user's JWT (see authService.getToken).
 */

function authHeaders() {
  const token = getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function parseResponse(res) {
  let body = null;
  try {
    body = await res.json();
  } catch {
    // no JSON body (e.g. plain 403 from Spring Security)
  }
  if (!res.ok) {
    const message = body?.message || 'Something went wrong. Please try again.';
    const error = new Error(message);
    error.status = res.status;
    throw error;
  }
  return body;
}

/**
 * Fetch every vehicle pool, ordered by departure time. Includes per-pool
 * `full`, `past`, `own`, and `joined` flags computed for the current user
 * (when authenticated).
 */
export async function getPools() {
  const res = await fetch(`${API_BASE_URL}/pools`, {
    headers: { ...authHeaders() }
  });
  return parseResponse(res);
}

/**
 * Route-based discovery (Phase 2). Returns ONLY pools that are ACTIVE, still have an
 * open seat, and match both `origin` and `destination` -- never the full pool list.
 * Matching, status, and seat filtering all happen server-side.
 * @param {string} origin
 * @param {string} destination
 */
export async function searchPools(origin, destination) {
  const params = new URLSearchParams({ origin, destination });
  const res = await fetch(`${API_BASE_URL}/pools/search?${params.toString()}`, {
    headers: { ...authHeaders() }
  });
  return parseResponse(res);
}

/**
 * Create a new vehicle pool. Requires authentication.
 * @param {{startLocation: string, destination: string, departureTime: string, totalSeats: number, costPerPassenger: number}} data
 */
export async function createPool(data) {
  const res = await fetch(`${API_BASE_URL}/pools`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify(data)
  });
  return parseResponse(res);
}

/**
 * Reserve a seat on a pool. Requires authentication.
 */
export async function joinPool(poolId) {
  const res = await fetch(`${API_BASE_URL}/pools/${encodeURIComponent(poolId)}/join`, {
    method: 'POST',
    headers: { ...authHeaders() }
  });
  return parseResponse(res);
}

/**
 * Release a previously reserved seat on a pool. Requires authentication.
 */
export async function leavePool(poolId) {
  const res = await fetch(`${API_BASE_URL}/pools/${encodeURIComponent(poolId)}/leave`, {
    method: 'POST',
    headers: { ...authHeaders() }
  });
  return parseResponse(res);
}

/**
 * Fetch pools created by the current user, including each pool's passenger list.
 * Requires authentication.
 */
export async function getMyPools() {
  const res = await fetch(`${API_BASE_URL}/pools/mine`, {
    headers: { ...authHeaders() }
  });
  return parseResponse(res);
}

/**
 * Creator-only: mark a pool as completed (e.g. the trip/destination was reached).
 * Requires authentication; fails if the caller isn't the pool's creator.
 */
export async function completePool(poolId) {
  const res = await fetch(`${API_BASE_URL}/pools/${encodeURIComponent(poolId)}/complete`, {
    method: 'POST',
    headers: { ...authHeaders() }
  });
  return parseResponse(res);
}

/**
 * Creator-only: terminate a pool early (e.g. it's full, or the trip is called off).
 * Requires authentication; fails if the caller isn't the pool's creator.
 */
export async function terminatePool(poolId) {
  const res = await fetch(`${API_BASE_URL}/pools/${encodeURIComponent(poolId)}/terminate`, {
    method: 'POST',
    headers: { ...authHeaders() }
  });
  return parseResponse(res);
}
