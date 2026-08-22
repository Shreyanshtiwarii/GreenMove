import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import GreenMoveMap from '../components/map/GreenMoveMap';
import { getJourneys } from '../services/historyService';
import { getRoute } from '../services/routingService';
import { searchLocations, reverseGeocode } from '../services/geocodingService';
import { getEVStationsAlongRoute, getEVStationsNearLocation } from '../services/evChargingService';

// Safety reserve kept in the battery below what the raw distance math requires, so the
// vehicle never arrives on a razor-thin margin. Matches the existing 15km threshold this
// page already used for its simple feasibility check.
const SAFETY_MARGIN_KM = 15;

// Open Charge Map does not provide live tariff data, so charging cost is shown as a
// clearly-labelled estimate using a representative average public DC-fast rate (INR/kWh).
const AVERAGE_RATE_INR_PER_KWH = 16;

/**
 * Calculates geodesic distance between two lat/lng coordinates in kilometers using Haversine formula.
 */
function haversineKm(lat1, lon1, lat2, lon2) {
  if (lat1 == null || lon1 == null || lat2 == null || lon2 == null) return 4.5;
  const R = 6371; // Earth radius in km
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) *
      Math.cos(lat2 * (Math.PI / 180)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Number((R * c).toFixed(1));
}

/**
 * Builds cumulative distance (km) from the route origin to every coordinate in a GeoJSON
 * LineString coordinate array ([lng, lat] pairs). Used to project charging stations onto a
 * position "along the route" rather than only a straight-line distance from the origin.
 */
function buildCumulativeDistanceKm(coordinates) {
  const cum = [0];
  for (let i = 1; i < coordinates.length; i++) {
    const [lng1, lat1] = coordinates[i - 1];
    const [lng2, lat2] = coordinates[i];
    cum.push(cum[i - 1] + haversineKm(lat1, lng1, lat2, lng2));
  }
  return cum;
}

/**
 * Annotates each charging station with its approximate position along the route (distance
 * in km from the route origin to the nearest route point), so stations can be ordered and
 * evaluated sequentially for multi-stop range planning.
 */
function annotateStationsWithRoutePosition(stations, coordinates, cumDistKm) {
  return stations.map((st) => {
    const stLat = st.latitude ?? st.lat;
    const stLng = st.longitude ?? st.lng;
    let bestIdx = 0;
    let bestDistKm = Infinity;

    for (let i = 0; i < coordinates.length; i++) {
      const [lng, lat] = coordinates[i];
      const d = haversineKm(stLat, stLng, lat, lng);
      if (d < bestDistKm) {
        bestDistKm = d;
        bestIdx = i;
      }
    }

    return {
      ...st,
      distanceAlongRouteKm: Number(cumDistKm[bestIdx].toFixed(1)),
      perpendicularDistanceKm: st.distanceFromRouteKm != null ? st.distanceFromRouteKm : Number(bestDistKm.toFixed(1))
    };
  });
}

/**
 * Formats a human-readable connector/power description from an EVStationDTO's connectors.
 */
function describeStationPower(station) {
  if (station.connectors && station.connectors.length > 0) {
    return station.connectors
      .map((c) => `${c.powerKw || 22}kW${c.connectorType ? ` ${c.connectorType}` : ''}`)
      .join(', ');
  }
  return 'Fast Charger';
}

/**
 * Formats a human-readable connector-count/status description from an EVStationDTO.
 */
function describeStationAvailability(station) {
  const totalConnectors = (station.connectors || []).reduce((sum, c) => sum + (c.quantity || 1), 0);
  const status = station.status || 'Status unverified';
  return totalConnectors > 0 ? `${totalConnectors} connector${totalConnectors > 1 ? 's' : ''} • ${status}` : status;
}

/**
 * Core EV multi-stop range-planning algorithm.
 *
 * Given the total trip distance, an ascending-by-route-position list of charging stations,
 * and the vehicle's available range, determines whether the destination is reachable and,
 * if not, builds the minimal practical sequence of charging stops required to get there —
 * always choosing the farthest reachable station at each point to maximize progress and
 * minimize the number of stops (classic greedy "minimum refueling stops" strategy, assuming
 * a full recharge at each stop).
 */
function planEVChargingRoute(totalDistanceKm, stationsSortedByRoutePos, availableRangeKm) {
  const usableRangeKm = Math.max(availableRangeKm - SAFETY_MARGIN_KM, 0);

  // Case 1: Destination is directly reachable on the current charge — no stop required.
  if (totalDistanceKm <= usableRangeKm) {
    return {
      feasible: true,
      needsCharging: false,
      stops: [],
      usableRangeKm: Math.round(usableRangeKm),
      summary: `Destination is within your available range (${Math.round(usableRangeKm)} km usable after a ${SAFETY_MARGIN_KM} km safety reserve). No charging stop required.`
    };
  }

  // Case 2: One or more charging stops are required.
  let currentPosKm = 0;
  let candidates = stationsSortedByRoutePos;
  const stops = [];
  let guard = 0;

  while (totalDistanceKm - currentPosKm > usableRangeKm) {
    guard += 1;
    if (guard > 12) {
      return {
        feasible: false,
        needsCharging: true,
        stops,
        usableRangeKm: Math.round(usableRangeKm),
        summary: 'Route requires too many charging stops to plan reliably from current station data. Please review manually.'
      };
    }

    const reachable = candidates.filter(
      (s) => s.distanceAlongRouteKm > currentPosKm && (s.distanceAlongRouteKm - currentPosKm) <= usableRangeKm
    );

    if (reachable.length === 0) {
      return {
        feasible: false,
        needsCharging: true,
        stops,
        usableRangeKm: Math.round(usableRangeKm),
        summary: stops.length > 0
          ? `No further charging station is within reach after Stop ${stops.length}. Destination cannot currently be reached with available station data.`
          : 'No charging station is within reach of your available range. Destination cannot currently be reached with available station data.'
      };
    }

    // Choose the farthest reachable station to maximize onward progress (minimizes stop count).
    reachable.sort((a, b) => b.distanceAlongRouteKm - a.distanceAlongRouteKm);
    const chosen = reachable[0];
    const legDistanceKm = Number((chosen.distanceAlongRouteKm - currentPosKm).toFixed(1));
    const remainingToDestinationKm = Number((totalDistanceKm - chosen.distanceAlongRouteKm).toFixed(1));

    stops.push({
      ...chosen,
      stopNumber: stops.length + 1,
      legDistanceFromPrevKm: legDistanceKm,
      reachableRangeFromStopKm: Math.round(usableRangeKm),
      remainingToDestinationKm,
      reason: remainingToDestinationKm <= usableRangeKm
        ? `Charging here restores enough range (~${Math.round(usableRangeKm)} km) to reach the destination directly.`
        : `Farthest available station reachable on the current charge; charging here restores ~${Math.round(usableRangeKm)} km of range to continue toward the destination.`
    });

    currentPosKm = chosen.distanceAlongRouteKm;
    candidates = candidates.filter((s) => s.distanceAlongRouteKm > currentPosKm);
  }

  return {
    feasible: true,
    needsCharging: true,
    stops,
    usableRangeKm: Math.round(usableRangeKm),
    summary: `Destination is reachable after ${stops.length} charging stop${stops.length > 1 ? 's' : ''}.`
  };
}

export default function EVIntelligence() {
  const navigate = useNavigate();
  const mapSectionRef = useRef(null);
  const recenterMapRef = useRef(null);

  const [journeys, setJourneys] = useState([]);
  const [batteryPct, setBatteryPct] = useState(45); // Dynamic user battery input slider (10% to 100%)

  // Same-page EV Route Planner States
  const [selectedStops, setSelectedStops] = useState([]); // Array of selected station objects
  const [evRoute, setEvRoute] = useState(null);
  const [loadingEvRoute, setLoadingEvRoute] = useState(false);
  const [evRouteError, setEvRouteError] = useState(null);

  // User Current Location State (initialized with fallback Indore coordinates)
  const [currentLocation, setCurrentLocation] = useState({
    name: 'Current Location',
    lat: 22.7533,
    lng: 75.8937
  });

  // Destination State — user-provided trip destination (replaces reliance on the battery slider)
  const [destination, setDestination] = useState(null);

  // Origin / Destination text inputs + autocomplete UI state (mirrors PlanRoute's location input pattern)
  const [originInput, setOriginInput] = useState('Current Location');
  const [destinationInput, setDestinationInput] = useState('');
  const [originSuggestions, setOriginSuggestions] = useState([]);
  const [destinationSuggestions, setDestinationSuggestions] = useState([]);
  const [originSearching, setOriginSearching] = useState(false);
  const [destinationSearching, setDestinationSearching] = useState(false);
  const [originError, setOriginError] = useState(null);
  const [destinationError, setDestinationError] = useState(null);

  // Planned Origin -> Destination Route (drives the range feasibility calculation from user inputs)
  const [plannedRoute, setPlannedRoute] = useState(null);
  const [loadingPlannedRoute, setLoadingPlannedRoute] = useState(false);
  const [plannedRouteError, setPlannedRouteError] = useState(null);

  // Real Open Charge Map station data along the planned Origin -> Destination route
  // (used to power the EV Intelligence charging-plan calculation).
  const [routeStations, setRouteStations] = useState([]);
  const [loadingStations, setLoadingStations] = useState(false);
  const [stationsError, setStationsError] = useState(null);

  // Fallback real station data near the current location, shown when no destination has
  // been set yet so the "Optimal Charging Stops" panel still reflects real network data.
  const [nearbyStations, setNearbyStations] = useState([]);
  const [loadingNearby, setLoadingNearby] = useState(false);

  // Obtain browser geolocation on mount when available
  useEffect(() => {
    const records = getJourneys();
    setJourneys(records || []);

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          if (pos && pos.coords) {
            setCurrentLocation({
              name: 'Current Location',
              lat: pos.coords.latitude,
              lng: pos.coords.longitude
            });
          }
        },
        (err) => console.info('[EVIntelligence] Geolocation default fallback:', err.message)
      );
    }
  }, []);

  // Debounced search for Origin suggestions (mirrors PlanRoute's location autocomplete pattern)
  useEffect(() => {
    if (originInput.trim().length < 2) {
      setOriginSuggestions([]);
      setOriginError(null);
      return;
    }
    if (currentLocation && originInput === currentLocation.name) {
      setOriginSuggestions([]);
      setOriginError(null);
      return;
    }

    setOriginSearching(true);
    setOriginError(null);

    const delayDebounceFn = setTimeout(async () => {
      try {
        const results = await searchLocations(originInput);
        setOriginSuggestions(results);
        if (results.length === 0) {
          setOriginError('No locations found');
        }
      } catch (err) {
        setOriginSuggestions([]);
        setOriginError('Unable to search locations');
      } finally {
        setOriginSearching(false);
      }
    }, 450);

    return () => clearTimeout(delayDebounceFn);
  }, [originInput, currentLocation]);

  // Debounced search for Destination suggestions
  useEffect(() => {
    if (destinationInput.trim().length < 2) {
      setDestinationSuggestions([]);
      setDestinationError(null);
      return;
    }
    if (destination && destinationInput === destination.name) {
      setDestinationSuggestions([]);
      setDestinationError(null);
      return;
    }

    setDestinationSearching(true);
    setDestinationError(null);

    const delayDebounceFn = setTimeout(async () => {
      try {
        const results = await searchLocations(destinationInput);
        setDestinationSuggestions(results);
        if (results.length === 0) {
          setDestinationError('No locations found');
        }
      } catch (err) {
        setDestinationSuggestions([]);
        setDestinationError('Unable to search locations');
      } finally {
        setDestinationSearching(false);
      }
    }, 450);

    return () => clearTimeout(delayDebounceFn);
  }, [destinationInput, destination]);

  const handleSelectOrigin = (loc) => {
    setCurrentLocation(loc);
    setOriginInput(loc.name);
    setOriginSuggestions([]);
    setOriginError(null);
  };

  const handleSelectDestination = (loc) => {
    setDestination(loc);
    setDestinationInput(loc.name);
    setDestinationSuggestions([]);
    setDestinationError(null);
  };

  const handleUseCurrentLocation = () => {
    if (!navigator.geolocation) {
      alert('Geolocation is not supported by your browser.');
      return;
    }

    setOriginSearching(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords;
        try {
          const placeName = await reverseGeocode(longitude, latitude);
          const loc = { name: placeName || 'Current Location', lat: latitude, lng: longitude };
          setCurrentLocation(loc);
          setOriginInput(loc.name);
        } catch (err) {
          console.error('[EVIntelligence] Reverse geocoding failed:', err);
          const loc = { name: 'Current Location', lat: latitude, lng: longitude };
          setCurrentLocation(loc);
          setOriginInput(loc.name);
        } finally {
          setOriginSearching(false);
        }
      },
      (err) => {
        console.error('[EVIntelligence] Geolocation error:', err);
        alert('Unable to get current location.');
        setOriginSearching(false);
      }
    );
  };

  // Calculate the user's requested Origin -> Destination trip route.
  // This replaces the battery-slider-only feasibility flow: the required range for the
  // "Battery Status & Range Feasibility" card now comes from the actual trip the user typed in,
  // via the existing getRoute() calculation engine (same one used by Plan Route / EV stop routing).
  useEffect(() => {
    if (!currentLocation || typeof currentLocation.lat !== 'number' || typeof currentLocation.lng !== 'number') return;
    if (!destination || typeof destination.lat !== 'number' || typeof destination.lng !== 'number') return;

    const controller = new AbortController();
    setLoadingPlannedRoute(true);
    setPlannedRouteError(null);

    getRoute(currentLocation, destination, 'DRIVING', false, controller.signal)
      .then((r) => {
        setPlannedRoute(r);
      })
      .catch((err) => {
        if (err.name === 'AbortError') return;
        console.error('[EVIntelligence] Planned route calculation failed:', err);
        setPlannedRoute(null);
        setPlannedRouteError('Unable to calculate distance for this trip. Please try again.');
      })
      .finally(() => setLoadingPlannedRoute(false));

    return () => controller.abort();
  }, [currentLocation.lat, currentLocation.lng, destination]);

  // Fetch real charging stations along the planned Origin -> Destination route (Open Charge
  // Map via the existing backend corridor search), mirroring the same call Plan Route uses.
  useEffect(() => {
    if (!plannedRoute || !plannedRoute.geometry || !Array.isArray(plannedRoute.geometry.coordinates) || plannedRoute.geometry.coordinates.length === 0) {
      setRouteStations([]);
      setStationsError(null);
      return;
    }

    setLoadingStations(true);
    setStationsError(null);

    const waypoints = plannedRoute.geometry.coordinates.map((c) => ({ lat: c[1], lng: c[0] }));

    getEVStationsAlongRoute(waypoints, 5.0)
      .then((res) => {
        if (res.success) {
          setRouteStations(res.stations || []);
          setStationsError(null);
        } else {
          setRouteStations([]);
          setStationsError(res.message || 'Charging station data is temporarily unavailable.');
        }
      })
      .catch((err) => {
        console.warn('[EVIntelligence] EV Charging station retrieval error:', err);
        setRouteStations([]);
        setStationsError('Charging station data is temporarily unavailable.');
      })
      .finally(() => setLoadingStations(false));
  }, [plannedRoute]);

  // Fallback: fetch real charging stations near the current location when no destination has
  // been chosen yet, so the station list always reflects real (non-fabricated) network data.
  useEffect(() => {
    if (destination || typeof currentLocation.lat !== 'number' || typeof currentLocation.lng !== 'number') {
      return;
    }

    setLoadingNearby(true);
    getEVStationsNearLocation(currentLocation.lat, currentLocation.lng, 10.0)
      .then((res) => {
        setNearbyStations(res.success ? (res.stations || []) : []);
      })
      .catch(() => setNearbyStations([]))
      .finally(() => setLoadingNearby(false));
  }, [destination, currentLocation.lat, currentLocation.lng]);

  // Most recent planned or completed route
  const latestJourney = journeys.length > 0 ? journeys[0] : null;

  // Calculate distance from route origin
  const routeOriginLat = currentLocation.lat;
  const routeOriginLng = currentLocation.lng;

  // Calculate EV Battery Feasibility dynamically
  const MAX_RANGE_KM = 340;
  const currentRangeKm = Math.round((batteryPct / 100) * MAX_RANGE_KM);
  const routeDistanceKm = evRoute
    ? evRoute.distanceKmNum
    : (plannedRoute
        ? plannedRoute.distanceKmNum
        : (latestJourney
            ? (latestJourney.distanceKmNum || (latestJourney.distanceMeters ? latestJourney.distanceMeters / 1000 : 20.0))
            : 20.0));

  const requiredRangeKm = Math.round(routeDistanceKm);
  const safetyMarginKm = currentRangeKm - requiredRangeKm;
  const directFeasible = safetyMarginKm >= SAFETY_MARGIN_KM;

  // Project real charging stations onto the planned route (distance-along-route) so they can
  // be sequenced for multi-stop range planning, using the actual route geometry from getRoute().
  const routeGeometry = useMemo(() => {
    if (!plannedRoute || !plannedRoute.geometry || !Array.isArray(plannedRoute.geometry.coordinates) || plannedRoute.geometry.coordinates.length < 2) {
      return { coords: [], cumDistKm: [], totalDistanceKm: 0 };
    }
    const coords = plannedRoute.geometry.coordinates;
    const cumDistKm = buildCumulativeDistanceKm(coords);
    const totalDistanceKm = plannedRoute.distanceKmNum ?? cumDistKm[cumDistKm.length - 1];
    return { coords, cumDistKm, totalDistanceKm };
  }, [plannedRoute]);

  const annotatedRouteStations = useMemo(() => {
    if (!routeGeometry.coords.length || !routeStations.length) return [];
    return annotateStationsWithRoutePosition(routeStations, routeGeometry.coords, routeGeometry.cumDistKm)
      .sort((a, b) => a.distanceAlongRouteKm - b.distanceAlongRouteKm);
  }, [routeGeometry, routeStations]);

  // Core EV Intelligence output: whether the destination can be reached on the available
  // range and, if not, the practical sequence of charging stops required to get there.
  const evPlan = useMemo(() => {
    if (!destination || !routeGeometry.coords.length) return null;
    return planEVChargingRoute(routeGeometry.totalDistanceKm, annotatedRouteStations, currentRangeKm);
  }, [destination, routeGeometry, annotatedRouteStations, currentRangeKm]);

  // Overall feasibility now accounts for reachability via charging stops, not just direct range.
  const isFeasible = (destination && evPlan) ? evPlan.feasible : directFeasible;

  const feasibilityLabel = (destination && evPlan)
    ? (evPlan.feasible
        ? (evPlan.needsCharging ? `✓ Feasible via ${evPlan.stops.length} Charging Stop${evPlan.stops.length > 1 ? 's' : ''}` : '✓ Route Feasible')
        : '⚠️ Not Feasible — No Station In Range')
    : (directFeasible ? '✓ Route Feasible' : '⚠️ Charging Stop Recommended');

  // Station list shown in "Optimal Charging Stops": real along-route stations once a
  // destination is set, otherwise real stations near the current location.
  const displayStations = destination ? annotatedRouteStations : nearbyStations;
  const loadingStationList = destination ? loadingStations : loadingNearby;

  const chargingStations = displayStations.map((st) => {
    const lat = st.latitude ?? st.lat;
    const lng = st.longitude ?? st.lng;
    const distFromOrigin = haversineKm(routeOriginLat, routeOriginLng, lat, lng);
    const energyKwhNeeded = Math.max(2, (evRoute ? evRoute.distanceKmNum : requiredRangeKm) * 0.15);
    const estCostInr = Math.round(energyKwhNeeded * AVERAGE_RATE_INR_PER_KWH);
    const isRecommendedStop = !!(evPlan && evPlan.stops.some((s) => s.id === st.id));

    return {
      id: st.id,
      name: st.name,
      address: st.address || st.city || 'Address unavailable',
      lat,
      lng,
      power: describeStationPower(st),
      available: describeStationAvailability(st),
      distance: st.distanceAlongRouteKm != null
        ? `${st.distanceAlongRouteKm} km along route (${distFromOrigin} km direct)`
        : `${distFromOrigin} km from Origin`,
      cost: `~₹${estCostInr} est.`,
      isRecommendedStop
    };
  });

  // Toggle Charging Stop Selection (Add / Remove Stop)
  const handleToggleStop = (station) => {
    const exists = selectedStops.some(s => s.id === station.id);
    let updatedStops = [];

    if (exists) {
      updatedStops = selectedStops.filter(s => s.id !== station.id);
    } else {
      updatedStops = [...selectedStops, station];
    }

    setSelectedStops(updatedStops);

    if (updatedStops.length > 0) {
      calculateMultiStopEVRoute(currentLocation, updatedStops);
    } else {
      setEvRoute(null);
    }
  };

  // Remove single stop
  const handleRemoveStop = (stationId) => {
    const updatedStops = selectedStops.filter(s => s.id !== stationId);
    setSelectedStops(updatedStops);

    if (updatedStops.length > 0) {
      calculateMultiStopEVRoute(currentLocation, updatedStops);
    } else {
      setEvRoute(null);
    }
  };

  // Select New Route Handler: Resets stops without leaving the page
  const handleSelectNewRoute = () => {
    setSelectedStops([]);
    setEvRoute(null);
    setEvRouteError(null);
  };

  // Multi-Stop Real Routing Calculation Engine
  const calculateMultiStopEVRoute = async (originLoc, stops) => {
    if (!stops || stops.length === 0) {
      setEvRoute(null);
      return;
    }

    setLoadingEvRoute(true);
    setEvRouteError(null);

    try {
      // Build route waypoints sequence: Current Location -> Stop 1 -> Stop 2 -> ... ->
      // Destination. The final leg to the actual trip Destination (from the "destination"
      // state set above the map) is appended whenever one has been set, so the map always
      // reflects the complete Origin -> Required Charging Stop(s) -> Destination sequence
      // from the Phase 2 charging calculation — not just Origin -> last charging stop.
      const finalDestination = destination && typeof destination.lat === 'number' && typeof destination.lng === 'number'
        ? destination
        : null;

      const waypoints = [
        { name: originLoc.name, lat: originLoc.lat, lng: originLoc.lng },
        ...stops.map(s => ({ name: s.name, lat: s.lat, lng: s.lng })),
        ...(finalDestination ? [{ name: finalDestination.name, lat: finalDestination.lat, lng: finalDestination.lng }] : [])
      ];

      if (waypoints.length === 2) {
        // Single leg: Current Location -> Stop 1 (no destination set yet)
        const leg = await getRoute(waypoints[0], waypoints[1], 'DRIVING');
        setEvRoute({
          ...leg,
          stops: stops,
          title: `${originLoc.name} → ${stops[0].name}`
        });
      } else {
        // Multi leg: Current Location -> Stop 1 -> Stop 2 -> ... -> Destination
        let totalDistanceMeters = 0;
        let totalDurationSeconds = 0;
        let combinedCoords = [];

        for (let i = 0; i < waypoints.length - 1; i++) {
          const leg = await getRoute(waypoints[i], waypoints[i + 1], 'DRIVING');
          totalDistanceMeters += leg.distanceMeters || (leg.distanceKmNum * 1000);
          totalDurationSeconds += leg.durationSeconds || 600;

          if (leg.geometry && leg.geometry.coordinates) {
            if (combinedCoords.length > 0) {
              combinedCoords = combinedCoords.concat(leg.geometry.coordinates.slice(1));
            } else {
              combinedCoords = leg.geometry.coordinates;
            }
          }
        }

        const distanceKmNum = Number((totalDistanceMeters / 1000).toFixed(1));
        const durationMins = Math.round(totalDurationSeconds / 60);

        setEvRoute({
          id: `ev_multi_${Date.now()}`,
          mode: 'DRIVING',
          geometry: {
            type: 'LineString',
            coordinates: combinedCoords
          },
          distanceMeters: totalDistanceMeters,
          durationSeconds: totalDurationSeconds,
          distanceKmNum: distanceKmNum,
          distanceKm: `${distanceKmNum} km`,
          durationMinutes: `${durationMins} min`,
          stops: stops,
          title: [
            originLoc.name,
            ...stops.map(s => s.name.split('—')[0].trim()),
            ...(finalDestination ? [finalDestination.name.split('—')[0].trim()] : [])
          ].join(' → ')
        });
      }
    } catch (err) {
      console.error('[EVIntelligence] EV Route calculation failed:', err);
      setEvRouteError('Unable to calculate this EV route. Please try again.');
    } finally {
      setLoadingEvRoute(false);
    }
  };

  // Applies the auto-computed Recommended Charging Plan to the existing Route Preview /
  // map / selected-stops flow, reusing the same multi-stop routing engine used by manual
  // "Add Stop" selection so nothing about that existing flow needs to change.
  const handleApplyRecommendedPlan = () => {
    if (!evPlan || !evPlan.stops || evPlan.stops.length === 0) return;

    const stopsForRoute = evPlan.stops.map((s) => ({
      id: s.id,
      name: s.name,
      address: s.address || s.city || 'Address unavailable',
      lat: s.latitude ?? s.lat,
      lng: s.longitude ?? s.lng,
      power: describeStationPower(s),
      available: describeStationAvailability(s)
    }));

    setSelectedStops(stopsForRoute);
    calculateMultiStopEVRoute(currentLocation, stopsForRoute);
  };

  return (
    <main className="flex-1 w-full pt-[24px] px-4 md:px-lg pb-xl max-w-7xl mx-auto overflow-y-auto scrollbar-none">
      {/* Header */}
      <header className="mb-lg flex flex-col md:flex-row justify-between md:items-end gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="material-symbols-outlined text-primary text-2xl">ev_station</span>
            <h2 className="text-headline-lg font-headline-lg text-on-surface">EV Intelligence</h2>
          </div>
          <p className="text-body-md font-body-md text-on-surface-variant">
            Real-time route feasibility, battery range evaluation, and optimal charging recommendations.
          </p>
        </div>
        <button
          type="button"
          onClick={handleSelectNewRoute}
          className="bg-primary text-on-primary rounded-xl px-5 py-2.5 text-label-sm font-label-sm hover:bg-primary/90 transition-colors shadow-sm cursor-pointer flex items-center gap-2 self-start md:self-auto"
        >
          <span className="material-symbols-outlined text-sm">route</span>
          <span>Select New Route</span>
        </button>
      </header>

      {/* Main Two-Column Grid Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column (lg:col-span-8): Battery Status & Optimal Charging Stops */}
        <div className="lg:col-span-8 space-y-6">
          {/* Battery Status Section */}
          <section className="bg-surface-container-lowest rounded-2xl p-6 border border-tertiary-fixed shadow-sm">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h3 className="text-headline-md font-headline-md text-on-surface flex items-center gap-2">
                  <span className="material-symbols-outlined text-primary">battery_4_bar</span>
                  Battery Status & Range Feasibility
                </h3>
                {evRoute ? (
                  <p className="text-label-xs text-on-surface-variant mt-1">
                    Evaluated for calculated EV route: <strong className="text-on-surface">{evRoute.title}</strong> ({requiredRangeKm} km)
                  </p>
                ) : plannedRoute && destination ? (
                  <p className="text-label-xs text-on-surface-variant mt-1">
                    Evaluated for route: <strong className="text-on-surface">{currentLocation.name} → {destination.name}</strong> ({requiredRangeKm} km)
                  </p>
                ) : latestJourney ? (
                  <p className="text-label-xs text-on-surface-variant mt-1">
                    Evaluated for route: <strong className="text-on-surface">{latestJourney.title}</strong> ({requiredRangeKm} km)
                  </p>
                ) : (
                  <p className="text-label-xs text-amber-700 mt-1">
                    Enter your origin, destination, and battery level below to calculate range feasibility.
                  </p>
                )}
              </div>
              <div className={`px-3 py-1 rounded-full text-label-xs font-label-xs font-bold border ${
                isFeasible
                  ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                  : 'bg-amber-50 text-amber-800 border-amber-300'
              }`}>
                {feasibilityLabel}
              </div>
            </div>

            {/* Trip & Battery Inputs (replaces the previous battery slider) */}
            <div className="mb-6 p-4 bg-surface-container-low rounded-xl border border-outline-variant/30 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Origin Input */}
                <div className="relative">
                  <label className="text-label-xs font-label-xs text-on-surface-variant mb-1 block">Current Location / Origin</label>
                  <div className="relative">
                    <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-primary text-sm">my_location</span>
                    <input
                      type="text"
                      value={originInput}
                      onChange={(e) => setOriginInput(e.target.value)}
                      placeholder="Enter your current location..."
                      className={`w-full bg-white rounded-lg border pl-9 pr-9 py-2 text-body-md font-body-md text-on-surface text-sm outline-none focus:border-primary ${
                        originError ? 'border-error' : 'border-tertiary-fixed'
                      }`}
                    />
                    <button
                      type="button"
                      onClick={handleUseCurrentLocation}
                      title="Use Current Location"
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-on-surface-variant hover:text-primary transition-colors p-1 cursor-pointer"
                    >
                      <span className={`material-symbols-outlined text-sm ${originSearching ? 'animate-spin text-primary' : ''}`}>
                        {originSearching ? 'sync' : 'near_me'}
                      </span>
                    </button>
                  </div>

                  {originSuggestions.length > 0 && (
                    <div className="absolute top-full left-0 right-0 mt-1 bg-white rounded-lg border border-tertiary-fixed shadow-lg z-30 max-h-48 overflow-y-auto">
                      {originSuggestions.map((item, idx) => (
                        <div
                          key={idx}
                          onClick={() => handleSelectOrigin(item)}
                          className="p-2.5 hover:bg-surface-container-low cursor-pointer border-b border-outline-variant/20 last:border-0 text-body-md text-on-surface flex items-center gap-2"
                        >
                          <span className="material-symbols-outlined text-on-surface-variant text-sm">location_on</span>
                          <span className="truncate">{item.name}</span>
                        </div>
                      ))}
                    </div>
                  )}
                  {originError && <p className="text-error text-label-xs mt-1">{originError}</p>}
                </div>

                {/* Destination Input */}
                <div className="relative">
                  <label className="text-label-xs font-label-xs text-on-surface-variant mb-1 block">Destination</label>
                  <div className="relative">
                    <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-error text-sm">location_on</span>
                    <input
                      type="text"
                      value={destinationInput}
                      onChange={(e) => setDestinationInput(e.target.value)}
                      placeholder="Enter destination..."
                      className={`w-full bg-white rounded-lg border pl-9 pr-3 py-2 text-body-md font-body-md text-on-surface text-sm outline-none focus:border-primary ${
                        destinationError ? 'border-error' : 'border-tertiary-fixed'
                      }`}
                    />
                  </div>

                  {destinationSuggestions.length > 0 && (
                    <div className="absolute top-full left-0 right-0 mt-1 bg-white rounded-lg border border-tertiary-fixed shadow-lg z-30 max-h-48 overflow-y-auto">
                      {destinationSuggestions.map((item, idx) => (
                        <div
                          key={idx}
                          onClick={() => handleSelectDestination(item)}
                          className="p-2.5 hover:bg-surface-container-low cursor-pointer border-b border-outline-variant/20 last:border-0 text-body-md text-on-surface flex items-center gap-2"
                        >
                          <span className="material-symbols-outlined text-on-surface-variant text-sm">location_on</span>
                          <span className="truncate">{item.name}</span>
                        </div>
                      ))}
                    </div>
                  )}
                  {destinationError && <p className="text-error text-label-xs mt-1">{destinationError}</p>}
                </div>
              </div>

              {loadingPlannedRoute && (
                <div className="flex items-center gap-2 text-primary text-label-xs font-label-xs animate-pulse">
                  <span className="material-symbols-outlined text-xs animate-spin">sync</span>
                  <span>Calculating trip distance...</span>
                </div>
              )}
              {plannedRouteError && <p className="text-error text-label-xs">{plannedRouteError}</p>}

              {/* Battery / Range Input (replaces the previous slider control) */}
              <div>
                <div className="flex justify-between text-label-xs text-on-surface-variant mb-2">
                  <span>Current Vehicle Battery Level</span>
                  <span className="font-bold text-primary">{currentRangeKm} km available range</span>
                </div>
                <div className="flex items-center gap-3">
                  <input
                    type="number"
                    min="10"
                    max="100"
                    step="1"
                    value={batteryPct}
                    onChange={(e) => {
                      const val = Number(e.target.value);
                      if (Number.isNaN(val)) return;
                      setBatteryPct(val);
                    }}
                    onBlur={(e) => {
                      const val = Number(e.target.value);
                      const clamped = Number.isNaN(val) ? 10 : Math.min(100, Math.max(10, val));
                      setBatteryPct(clamped);
                    }}
                    className="w-24 bg-white rounded-lg border border-tertiary-fixed px-3 py-2 text-body-md font-body-md text-on-surface text-sm outline-none focus:border-primary"
                  />
                  <span className="text-label-sm font-label-sm text-on-surface-variant">% battery (10–100)</span>
                </div>
              </div>
            </div>

            {/* Range Metrics Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <div className="bg-surface-container-low p-4 rounded-xl border border-outline-variant/30">
                <p className="text-label-xs text-on-surface-variant uppercase">Current Available Range</p>
                <p className="text-headline-lg font-headline-lg text-primary font-bold">{currentRangeKm} km</p>
              </div>

              <div className="bg-surface-container-low p-4 rounded-xl border border-outline-variant/30">
                <p className="text-label-xs text-on-surface-variant uppercase">Required for Route</p>
                <p className="text-headline-lg font-headline-lg text-on-surface font-bold">{requiredRangeKm} km</p>
              </div>

              <div className="bg-surface-container-low p-4 rounded-xl border border-outline-variant/30">
                <p className="text-label-xs text-on-surface-variant uppercase">Safety Reserve Margin</p>
                <p className={`text-headline-lg font-headline-lg font-bold ${
                  safetyMarginKm >= 15 ? 'text-emerald-700' : 'text-amber-600'
                }`}>
                  {safetyMarginKm} km
                </p>
              </div>
            </div>

            {/* Battery Visual Indicator */}
            <div className="relative w-full h-6 bg-surface-container-high rounded-full overflow-hidden border border-outline-variant/50">
              <div
                className={`h-full transition-all duration-500 rounded-r-full ${
                  batteryPct < 25 ? 'bg-error' : batteryPct < 50 ? 'bg-amber-500' : 'bg-primary'
                }`}
                style={{ width: `${batteryPct}%` }}
              ></div>
            </div>
          </section>

          {/* Recommended Charging Plan Section — computed from Origin, Destination, available
              battery range, and real Open Charge Map station data along the route. */}
          {destination && (
            <section className="bg-surface-container-lowest rounded-2xl p-6 border border-tertiary-fixed shadow-sm">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-headline-sm font-headline-sm text-on-surface flex items-center gap-2">
                  <span className="material-symbols-outlined text-primary">alt_route</span>
                  Recommended Charging Plan
                </h3>
                {loadingStations && (
                  <span className="text-label-xs text-on-surface-variant flex items-center gap-1">
                    <span className="material-symbols-outlined text-xs animate-spin">sync</span>
                    Analyzing route...
                  </span>
                )}
              </div>

              {stationsError && (
                <div className="bg-amber-50 text-amber-800 border border-amber-200 rounded-lg p-3 text-label-xs mb-3">
                  {stationsError}
                </div>
              )}

              {!evPlan ? (
                <p className="text-label-xs text-on-surface-variant">Calculating route feasibility…</p>
              ) : !evPlan.needsCharging ? (
                <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 text-label-sm text-emerald-800">
                  <p className="font-semibold mb-1">✓ Destination reachable on current charge</p>
                  <p className="text-label-xs">{evPlan.summary}</p>
                </div>
              ) : evPlan.feasible ? (
                <div className="space-y-3">
                  <div className="bg-primary/5 border border-primary/20 rounded-xl p-3 text-label-xs text-on-surface">
                    {evPlan.summary}
                  </div>

                  {/* Origin -> Stop 1 -> Stop 2 -> ... -> Destination sequence */}
                  <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
                    <span className="px-2 py-1 bg-primary/10 text-primary font-semibold rounded border border-primary/20">
                      Origin: {currentLocation.name}
                    </span>
                    {evPlan.stops.map((stop) => (
                      <React.Fragment key={stop.id}>
                        <span className="text-on-surface-variant text-[10px]">→</span>
                        <span className="px-2 py-1 bg-emerald-50 text-emerald-800 font-semibold rounded border border-emerald-200">
                          Stop {stop.stopNumber}: {stop.name.split('—')[0].trim()}
                        </span>
                      </React.Fragment>
                    ))}
                    <span className="text-on-surface-variant text-[10px]">→</span>
                    <span className="px-2 py-1 bg-error/10 text-error font-semibold rounded border border-error/20">
                      Destination: {destination.name}
                    </span>
                  </div>

                  {/* Per-stop reasoning and range breakdown */}
                  <div className="space-y-2">
                    {evPlan.stops.map((stop) => (
                      <div key={stop.id} className="p-3 rounded-lg border border-outline-variant/40 bg-surface-container-low text-label-xs">
                        <div className="flex justify-between items-start mb-1 gap-2">
                          <span className="font-semibold text-on-surface">Stop {stop.stopNumber}: {stop.name}</span>
                          <span className="text-primary font-semibold whitespace-nowrap">{stop.legDistanceFromPrevKm} km leg</span>
                        </div>
                        <p className="text-on-surface-variant mb-1">{stop.address}</p>
                        <p className="text-on-surface-variant"><strong className="text-on-surface">Why this stop:</strong> {stop.reason}</p>
                        <p className="text-on-surface-variant"><strong className="text-on-surface">Reachable range after charging:</strong> ~{stop.reachableRangeFromStopKm} km</p>
                        <p className="text-on-surface-variant"><strong className="text-on-surface">Remaining to destination:</strong> {stop.remainingToDestinationKm} km</p>
                      </div>
                    ))}
                  </div>

                  <button
                    type="button"
                    onClick={handleApplyRecommendedPlan}
                    className="w-full bg-primary text-on-primary rounded-xl px-4 py-2.5 text-label-xs font-label-xs font-semibold hover:bg-primary/90 transition-colors shadow-sm cursor-pointer flex items-center justify-center gap-2"
                  >
                    <span className="material-symbols-outlined text-sm">bolt</span>
                    <span>Apply Recommended Stops to Route Preview</span>
                  </button>
                </div>
              ) : (
                <div className="bg-error-container/10 border border-error/30 rounded-xl p-4 text-label-sm text-error">
                  <p className="font-semibold mb-1">⚠️ Destination not currently reachable</p>
                  <p className="text-label-xs">{evPlan.summary}</p>
                </div>
              )}
            </section>
          )}

          {/* Optimal Charging Stops Section */}
          <section className="bg-surface-container-lowest rounded-2xl p-6 border border-tertiary-fixed shadow-sm">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-headline-sm font-headline-sm text-on-surface flex items-center gap-2">
                <span className="material-symbols-outlined text-primary">ev_station</span>
                Optimal Charging Stops
              </h3>
              <span className="text-label-xs text-on-surface-variant">Verified Open Charge Map Network</span>
            </div>

            {loadingStationList && (
              <div className="flex items-center gap-2 bg-primary-container/20 text-primary border border-primary/30 rounded-lg p-2.5 text-label-xs font-label-xs animate-pulse mb-3">
                <span className="material-symbols-outlined text-xs animate-spin">sync</span>
                <span>Finding charging stations...</span>
              </div>
            )}

            {!loadingStationList && chargingStations.length === 0 && (
              <div className="bg-surface-container-low text-on-surface-variant border border-outline-variant/30 rounded-lg p-3 text-label-xs mb-3">
                {destination ? 'No charging stations found along this route.' : 'No charging stations found near your current location.'}
              </div>
            )}

            <div className="space-y-4">
              {chargingStations.map((station) => {
                const isAdded = selectedStops.some(s => s.id === station.id);

                return (
                  <div
                    key={station.id}
                    className={`p-4 rounded-xl border transition-all ${
                      isAdded
                        ? 'border-primary bg-primary/5 shadow-sm'
                        : 'border-outline-variant/40 bg-surface-container-low hover:border-primary/50'
                    }`}
                  >
                    <div className="flex flex-col md:flex-row justify-between md:items-center gap-3">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="material-symbols-outlined text-primary text-xl">ev_station</span>
                          <h4 className="text-label-sm font-label-sm text-on-surface font-semibold">{station.name}</h4>
                          <span className="bg-emerald-50 text-emerald-800 text-[10px] px-2 py-0.5 rounded font-semibold border border-emerald-200">
                            {station.available}
                          </span>
                          {station.isRecommendedStop && (
                            <span className="bg-primary/10 text-primary text-[10px] px-2 py-0.5 rounded font-semibold border border-primary/30">
                              ⚡ Recommended Stop
                            </span>
                          )}
                        </div>
                        <p className="text-label-xs text-on-surface-variant">{station.address} • {station.distance}</p>
                      </div>

                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <p className="text-label-xs font-semibold text-primary">{station.power}</p>
                          <p className="text-label-xs text-on-surface-variant">{station.cost}</p>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleToggleStop(station)}
                          className={`px-4 py-2 rounded-xl text-label-xs font-label-xs font-semibold transition-colors cursor-pointer border ${
                            isAdded
                              ? 'bg-primary text-on-primary border-primary'
                              : 'bg-surface text-primary border-primary hover:bg-primary hover:text-on-primary'
                          }`}
                        >
                          {isAdded ? '✓ Added Stop' : 'Add Stop'}
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        </div>

        {/* Right Column (lg:col-span-4): Route Summary & Compact EV Route Preview Map Panel */}
        <div className="lg:col-span-4 space-y-6">
          {/* Top: Route & Battery Summary Card */}
          <div className="bg-surface-container-lowest rounded-2xl p-5 border border-tertiary-fixed shadow-sm space-y-4">
            <h3 className="text-headline-sm font-headline-sm text-on-surface border-b border-outline-variant pb-3">
              Route & Battery Summary
            </h3>

            <div className="space-y-3 text-body-md">
              <div className="flex justify-between py-1 border-b border-outline-variant/20">
                <span className="text-label-xs text-on-surface-variant">Active Origin</span>
                <span className="text-label-sm font-semibold text-on-surface">{currentLocation.name}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-outline-variant/20">
                <span className="text-label-xs text-on-surface-variant">Destination</span>
                <span className="text-label-sm font-semibold text-on-surface">{destination ? destination.name : '—'}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-outline-variant/20">
                <span className="text-label-xs text-on-surface-variant">Total Route Distance</span>
                <span className="text-label-sm font-semibold text-on-surface">{requiredRangeKm} km</span>
              </div>
              <div className="flex justify-between py-1 border-b border-outline-variant/20">
                <span className="text-label-xs text-on-surface-variant">Available EV Range</span>
                <span className="text-label-sm font-semibold text-primary">{currentRangeKm} km ({batteryPct}%)</span>
              </div>
              <div className="flex justify-between py-1 border-b border-outline-variant/20">
                <span className="text-label-xs text-on-surface-variant">Selected Charging Stops</span>
                <span className="text-label-sm font-semibold text-on-surface">{selectedStops.length} stops</span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-label-xs text-on-surface-variant">Feasibility Status</span>
                <span className={`text-label-sm font-bold ${isFeasible ? 'text-emerald-700' : 'text-amber-600'}`}>
                  {(destination && evPlan)
                    ? (evPlan.feasible
                        ? (evPlan.needsCharging ? `Feasible (${evPlan.stops.length} stop${evPlan.stops.length > 1 ? 's' : ''})` : 'Safe EV Route')
                        : 'Not Feasible')
                    : (isFeasible ? 'Safe EV Route' : 'Charging Needed')}
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={handleSelectNewRoute}
              className="w-full bg-primary text-on-primary rounded-xl px-4 py-2.5 text-label-xs font-label-xs font-semibold hover:bg-primary/90 transition-colors shadow-sm cursor-pointer flex items-center justify-center gap-2 mt-2"
            >
              <span className="material-symbols-outlined text-sm">route</span>
              <span>Select New Route</span>
            </button>
          </div>

          {/* Bottom: Compact Right-Side EV Route Preview Map Panel */}
          <div ref={mapSectionRef} id="ev-route-planner-map-area" className="bg-surface-container-lowest rounded-2xl p-4 border border-tertiary-fixed shadow-sm space-y-3">
            <div className="flex justify-between items-center pb-2 border-b border-outline-variant/40">
              <h4 className="text-label-sm font-label-sm text-on-surface font-semibold flex items-center gap-1.5">
                <span className="material-symbols-outlined text-primary text-base">map</span>
                <span>EV Route Preview</span>
              </h4>
              {selectedStops.length > 0 && (
                <button
                  type="button"
                  onClick={handleSelectNewRoute}
                  className="text-[11px] text-on-surface-variant hover:text-primary transition-colors flex items-center gap-0.5 cursor-pointer font-label-xs"
                >
                  <span className="material-symbols-outlined text-xs">restart_alt</span>
                  <span>Reset</span>
                </button>
              )}
            </div>

            {/* Selected Charging Stops Pills */}
            {selectedStops.length > 0 ? (
              <div className="space-y-1.5">
                <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
                  <span className="px-2 py-0.5 bg-primary/10 text-primary font-semibold rounded border border-primary/20">
                    {currentLocation.name}
                  </span>
                  {selectedStops.map((stop, idx) => (
                    <React.Fragment key={stop.id}>
                      <span className="text-on-surface-variant text-[10px]">→</span>
                      <span className="px-2 py-0.5 bg-emerald-50 text-emerald-800 font-semibold rounded border border-emerald-200 flex items-center gap-1">
                        <span>Stop {idx + 1}: {stop.name.split('—')[0].trim()}</span>
                        <button
                          type="button"
                          onClick={() => handleRemoveStop(stop.id)}
                          className="text-emerald-800 hover:text-error transition-colors ml-0.5 cursor-pointer"
                          title="Remove this stop"
                        >
                          <span className="material-symbols-outlined text-[10px]">close</span>
                        </button>
                      </span>
                    </React.Fragment>
                  ))}
                </div>
              </div>
            ) : (
              <div className="text-[11px] text-on-surface-variant bg-surface-container-low p-2 rounded-lg border border-outline-variant/20">
                Click "Add Stop" on any charging station card to preview route.
              </div>
            )}

            {/* Loading / Error States */}
            {loadingEvRoute && (
              <div className="flex items-center gap-2 bg-primary-container/20 text-primary border border-primary/30 rounded-lg p-2 text-label-xs font-label-xs animate-pulse">
                <span className="material-symbols-outlined text-xs animate-spin">sync</span>
                <span>Calculating EV route...</span>
              </div>
            )}

            {evRouteError && (
              <div className="bg-error-container/20 text-error border border-error/30 rounded-lg p-2 text-label-xs">
                {evRouteError}
              </div>
            )}

            {/* Route Summary Metrics */}
            {evRoute && (
              <div className="flex justify-between items-center bg-primary/5 p-2.5 rounded-lg border border-primary/20 text-label-xs">
                <div>
                  <span className="text-on-surface-variant text-[10px] block">Total Distance</span>
                  <span className="text-primary font-bold">{evRoute.distanceKm}</span>
                </div>
                <div>
                  <span className="text-on-surface-variant text-[10px] block">Est. Duration</span>
                  <span className="text-on-surface font-semibold">{evRoute.durationMinutes}</span>
                </div>
                <div>
                  <span className="text-on-surface-variant text-[10px] block">Stops</span>
                  <span className="text-emerald-700 font-semibold">{selectedStops.length} Included</span>
                </div>
              </div>
            )}

            {/* Compact Right-Side Map Container */}
            <div className="relative w-full h-[320px] bg-surface-container-low rounded-xl overflow-hidden border border-outline-variant/40">
              <GreenMoveMap
                origin={currentLocation}
                destination={
                  destination && typeof destination.lat === 'number' && typeof destination.lng === 'number'
                    // Real trip Destination once set, so the map always shows the actual
                    // Origin -> Stop(s) -> Destination sequence rather than stopping at the
                    // last charging stop.
                    ? { lat: destination.lat, lng: destination.lng, name: destination.name }
                    : (selectedStops.length > 0 ? { lat: selectedStops[selectedStops.length - 1].lat, lng: selectedStops[selectedStops.length - 1].lng } : null)
                }
                route={evRoute}
                evStations={selectedStops.map((s, idx) => ({
                  id: s.id,
                  name: s.name,
                  latitude: s.lat,
                  longitude: s.lng,
                  address: s.address,
                  city: 'Indore',
                  distanceFromRouteKm: 0.0,
                  // Sequence number so the map marker and popup can clearly label each
                  // required charging stop (Stop 1, Stop 2, ...), keeping the map in sync
                  // with the Origin -> Stop 1 -> Stop 2 -> Destination plan shown above.
                  stopNumber: idx + 1,
                  attribution: 'Data provided by Open Charge Map'
                }))}
                onRecenterRef={recenterMapRef}
              />
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
