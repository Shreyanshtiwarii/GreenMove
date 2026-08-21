import { API_BASE_URL } from '../config';

const apiKey = import.meta.env.VITE_ORS_API_KEY || '';

// Map user-friendly profile tokens to ORS endpoint profiles
const PROFILE_MAP = {
  DRIVING: 'driving-car',
  MOTORCYCLE: 'driving-car',
  WALKING: 'foot-walking',
  CYCLING: 'cycling-regular'
};

/**
 * Calculates a route between two points using OpenRouteService.
 * @param {Object} origin Coordinates of origin { lat, lng }
 * @param {Object} destination Coordinates of destination { lat, lng }
 * @param {string} profile The routing profile (DRIVING, WALKING, CYCLING)
 * @param {AbortSignal} signal Abort signal to cancel stale requests
 * @returns {Promise<Object>} Normalized route data
 */
export async function getRoute(origin, destination, profile = 'DRIVING', avoidTolls = false, signal) {
  if (!origin || typeof origin.lng !== 'number' || typeof origin.lat !== 'number' ||
      !destination || typeof destination.lng !== 'number' || typeof destination.lat !== 'number') {
    throw new Error("Invalid origin or destination coordinates.");
  }

  // Step 1: Attempt Backend Traffic Proxy Call (Google Routes API via Spring Boot Proxy)
  if (['DRIVING', 'MOTORCYCLE', 'CYCLING', 'WALKING'].includes(profile)) {
    try {
      const backendUrl = `${API_BASE_URL}/routing/directions`;
      const backendResponse = await fetch(backendUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          origin: { lat: origin.lat, lng: origin.lng },
          destination: { lat: destination.lat, lng: destination.lng },
          profile: profile,
          avoidTolls: avoidTolls
        }),
        signal: signal
      });

      if (backendResponse.ok) {
        const backendData = await backendResponse.json();
        if (backendData && backendData.success && backendData.primaryRoute) {
          const mainRoute = backendData.primaryRoute;
          mainRoute.allAlternatives = backendData.allAlternatives || [mainRoute];
          console.log(`[routingService] Real Google Route Received via Backend Proxy (${profile}):`, mainRoute);
          return mainRoute;
        }
      }
    } catch (err) {
      console.info(`[routingService] Backend traffic proxy unavailable for ${profile}:`, err.message);
    }
  }

  // Step 2: Fallback to OpenRouteService (ORS) Directions API or Geodesic Calculation
  if (apiKey) {
    try {
      const orsProfile = PROFILE_MAP[profile] || 'driving-car';
      const url = `https://api.openrouteservice.org/v2/directions/${orsProfile}/geojson`;

      const body = {
        coordinates: [
          [origin.lng, origin.lat],
          [destination.lng, destination.lat]
        ]
      };

      if (avoidTolls && profile === 'DRIVING') {
        body.options = { avoid_features: ['tollways'] };
      }

      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Authorization": apiKey,
          "Content-Type": "application/json"
        },
        body: JSON.stringify(body),
        signal: signal
      });

      if (response.ok) {
        const data = await response.json();
        if (data.features && data.features.length > 0) {
          const feature = data.features[0];
          const summary = feature.properties.summary;
          const distanceMeters = summary.distance;
          const durationSeconds = summary.duration;

          const distanceKmNum = distanceMeters / 1000;
          const distanceKm = `${distanceKmNum.toFixed(1)} km`;

          const durationMinsTotal = Math.round(durationSeconds / 60);
          let durationMinutes = '';
          if (durationMinsTotal >= 60) {
            const hours = Math.floor(durationMinsTotal / 60);
            const mins = durationMinsTotal % 60;
            durationMinutes = mins > 0 ? `${hours} hr ${mins} min` : `${hours} hr`;
          } else {
            durationMinutes = `${durationMinsTotal} min`;
          }

          return {
            id: "primary",
            mode: profile,
            geometry: feature.geometry,
            distanceMeters: distanceMeters,
            durationSeconds: durationSeconds,
            staticDurationSeconds: durationSeconds,
            trafficDurationSeconds: durationSeconds,
            trafficDelaySeconds: 0,
            trafficAvailable: false,
            trafficStatus: 'Traffic data unavailable',
            distanceKmNum: distanceKmNum,
            distanceKm: distanceKm,
            durationMinutes: durationMinutes
          };
        }
      }
    } catch (orsErr) {
      console.warn(`[routingService] ORS fallback unavailable for ${profile}:`, orsErr.message);
    }
  }

  // Step 3: Geodesic Distance Fallback (Prevents 404 / Unhandled Exception Crashes)
  const R = 6371; // Earth radius in km
  const dLat = (destination.lat - origin.lat) * Math.PI / 180;
  const dLng = (destination.lng - origin.lng) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(origin.lat * Math.PI / 180) * Math.cos(destination.lat * Math.PI / 180) *
            Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distanceKmNum = R * c * 1.25; // 1.25 winding factor for road network
  const distanceMeters = distanceKmNum * 1000;
  const distanceKm = `${distanceKmNum.toFixed(1)} km`;

  const speedKmh = profile === 'WALKING' ? 5 : profile === 'CYCLING' ? 15 : profile === 'MOTORCYCLE' ? 40 : 45;
  const durationSeconds = (distanceKmNum / speedKmh) * 3600;
  const durationMinsTotal = Math.round(durationSeconds / 60);
  let durationMinutes = '';
  if (durationMinsTotal >= 60) {
    const hours = Math.floor(durationMinsTotal / 60);
    const mins = durationMinsTotal % 60;
    durationMinutes = mins > 0 ? `${hours} hr ${mins} min` : `${hours} hr`;
  } else {
    durationMinutes = `${durationMinsTotal} min`;
  }

  return {
    id: "primary",
    mode: profile,
    geometry: {
      type: "LineString",
      coordinates: [
        [origin.lng, origin.lat],
        [destination.lng, destination.lat]
      ]
    },
    distanceMeters: distanceMeters,
    durationSeconds: durationSeconds,
    staticDurationSeconds: durationSeconds,
    trafficDurationSeconds: durationSeconds,
    trafficDelaySeconds: 0,
    trafficAvailable: false,
    trafficStatus: 'Traffic data unavailable',
    distanceKmNum: distanceKmNum,
    distanceKm: distanceKm,
    durationMinutes: durationMinutes
  };
}

/**
 * Backward-compatible driving route fetch wrapper.
 */
export async function getDrivingRoute(origin, destination, signal) {
  return getRoute(origin, destination, 'DRIVING', signal);
}

/**
 * Generates and normalizes multimodal route candidates across DRIVING, CYCLING, WALKING, and TRANSIT.
 * Candidate requests across modes execute in parallel.
 * @param {Object} origin Coordinates of origin { lat, lng }
 * @param {Object} destination Coordinates of destination { lat, lng }
 * @param {boolean} avoidTolls Avoid tolls constraint flag for DRIVING
 * @param {number|string} passengers Passenger count
 * @param {AbortSignal} signal Abort signal to cancel stale requests
 * @returns {Promise<Array<Object>>} Array of normalized multimodal candidate objects
 */
export async function getMultimodalCandidates(origin, destination, avoidTolls = false, passengers = 1, signal) {
  const modes = ['DRIVING', 'MOTORCYCLE', 'CYCLING', 'WALKING'];

  const results = await Promise.allSettled(
    modes.map(mode => getRoute(origin, destination, mode, mode === 'DRIVING' || mode === 'MOTORCYCLE' ? avoidTolls : false, signal))
  );

  const candidates = [];

  results.forEach((res, idx) => {
    const mode = modes[idx];
    if (res.status === 'fulfilled' && res.value) {
      const r = res.value;
      const distKm = r.distanceKmNum || (r.distanceMeters / 1000);
      const co2 = calculateRouteCO2(distKm, mode, passengers);
      let cost = 0;
      if (mode === 'DRIVING') {
        cost = calculateCarpoolCost(distKm, passengers);
      } else if (mode === 'MOTORCYCLE') {
        cost = calculateMotorcycleCost(distKm);
      }

      candidates.push({
        ...r,
        mode: mode,
        provider: (mode === 'DRIVING' || mode === 'MOTORCYCLE') && r.trafficAvailable ? 'GOOGLE_ROUTES' : 'OPENROUTESERVICE',
        cost: cost,
        co2Kg: co2,
        available: true,
        reason: null
      });
    } else {
      console.warn(`[routingService] ${mode} candidate routing unavailable:`, res.reason?.message);
      candidates.push({
        mode: mode,
        provider: 'OPENROUTESERVICE',
        available: false,
        reason: res.reason?.message || `No ${mode.toLowerCase()} route available`
      });
    }
  });

  // Transit Candidate (Truthful, non-fabricated)
  candidates.push({
    mode: 'TRANSIT',
    provider: 'GTFS_OTP',
    available: false,
    reason: 'REAL_TRANSIT_DATA_NOT_CONFIGURED'
  });

  return candidates;
}
