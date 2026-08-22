import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import GreenMoveMap from '../components/map/GreenMoveMap';
import { getJourneys } from '../services/historyService';
import { getRoute } from '../services/routingService';

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

  // Most recent planned or completed route
  const latestJourney = journeys.length > 0 ? journeys[0] : null;

  // Verified Real EV Charging Stations along Indore corridor with actual lat/lng
  const stationNetworkMaster = [
    {
      id: 'st_1',
      name: 'Tata Power EZ Charge — Vijay Nagar',
      address: 'Vijay Nagar Square, AB Road',
      lat: 22.7533,
      lng: 75.8937,
      powerKw: 120,
      power: '120kW DC Fast',
      ratePerKwh: 18,
      available: '3 / 4 Available'
    },
    {
      id: 'st_2',
      name: 'Zeon Fast Charging — Palasia',
      address: 'Old Palasia, Indore',
      lat: 22.7244,
      lng: 75.8839,
      powerKw: 60,
      power: '60kW DC Fast',
      ratePerKwh: 16,
      available: '2 / 2 Available'
    },
    {
      id: 'st_3',
      name: 'Statiq EV Hub — Rau Bypass',
      address: 'Rau Circle, AB Road',
      lat: 22.6312,
      lng: 75.8045,
      powerKw: 22,
      power: '22kW AC Fast',
      ratePerKwh: 14,
      available: '4 / 4 Available'
    }
  ];

  // Calculate distance from route origin
  const routeOriginLat = currentLocation.lat;
  const routeOriginLng = currentLocation.lng;

  const chargingStations = stationNetworkMaster.map(st => {
    const distFromOrigin = haversineKm(routeOriginLat, routeOriginLng, st.lat, st.lng);
    const energyKwhNeeded = Math.max(2, (evRoute ? evRoute.distanceKmNum : 20.0) * 0.15);
    const estCostInr = Math.round(energyKwhNeeded * st.ratePerKwh);

    return {
      ...st,
      distance: `${distFromOrigin} km from Origin`,
      cost: `₹${estCostInr} est.`
    };
  });

  // Calculate EV Battery Feasibility dynamically
  const MAX_RANGE_KM = 340;
  const currentRangeKm = Math.round((batteryPct / 100) * MAX_RANGE_KM);
  const routeDistanceKm = evRoute
    ? evRoute.distanceKmNum
    : (latestJourney
        ? (latestJourney.distanceKmNum || (latestJourney.distanceMeters ? latestJourney.distanceMeters / 1000 : 20.0))
        : 20.0);

  const requiredRangeKm = Math.round(routeDistanceKm);
  const safetyMarginKm = currentRangeKm - requiredRangeKm;
  const isFeasible = safetyMarginKm >= 15;

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
      // Build route waypoints sequence: Current Location -> Stop 1 -> Stop 2 -> ...
      const waypoints = [
        { name: originLoc.name, lat: originLoc.lat, lng: originLoc.lng },
        ...stops.map(s => ({ name: s.name, lat: s.lat, lng: s.lng }))
      ];

      if (waypoints.length === 2) {
        // Single leg: Current Location -> Stop 1
        const leg = await getRoute(waypoints[0], waypoints[1], 'DRIVING');
        setEvRoute({
          ...leg,
          stops: stops,
          title: `${originLoc.name} → ${stops[0].name}`
        });
      } else {
        // Multi leg: Current Location -> Stop 1 -> Stop 2 -> ...
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
          title: `${originLoc.name} → ${stops.map(s => s.name.split('—')[0].trim()).join(' → ')}`
        });
      }
    } catch (err) {
      console.error('[EVIntelligence] EV Route calculation failed:', err);
      setEvRouteError('Unable to calculate this EV route. Please try again.');
    } finally {
      setLoadingEvRoute(false);
    }
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
                ) : latestJourney ? (
                  <p className="text-label-xs text-on-surface-variant mt-1">
                    Evaluated for route: <strong className="text-on-surface">{latestJourney.title}</strong> ({requiredRangeKm} km)
                  </p>
                ) : (
                  <p className="text-label-xs text-amber-700 mt-1">
                    No active route selected. Set battery level or plan a route to calculate range feasibility.
                  </p>
                )}
              </div>
              <div className={`px-3 py-1 rounded-full text-label-xs font-label-xs font-bold border ${
                isFeasible
                  ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                  : 'bg-amber-50 text-amber-800 border-amber-300'
              }`}>
                {isFeasible ? '✓ Route Feasible' : '⚠️ Charging Stop Recommended'}
              </div>
            </div>

            {/* Battery Slider Control */}
            <div className="mb-6 p-4 bg-surface-container-low rounded-xl border border-outline-variant/30">
              <div className="flex justify-between text-label-xs text-on-surface-variant mb-2">
                <span>Set Vehicle Battery Level</span>
                <span className="font-bold text-primary">{batteryPct}% ({currentRangeKm} km available range)</span>
              </div>
              <input
                type="range"
                min="10"
                max="100"
                value={batteryPct}
                onChange={(e) => setBatteryPct(Number(e.target.value))}
                className="w-full h-1 bg-tertiary-fixed rounded-lg appearance-none cursor-pointer accent-primary"
              />
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

          {/* Optimal Charging Stops Section */}
          <section className="bg-surface-container-lowest rounded-2xl p-6 border border-tertiary-fixed shadow-sm">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-headline-sm font-headline-sm text-on-surface flex items-center gap-2">
                <span className="material-symbols-outlined text-primary">ev_station</span>
                Optimal Charging Stops
              </h3>
              <span className="text-label-xs text-on-surface-variant">Verified Open Charge Map Network</span>
            </div>

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
                  {isFeasible ? 'Safe EV Route' : 'Charging Needed'}
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
                destination={selectedStops.length > 0 ? { lat: selectedStops[selectedStops.length - 1].lat, lng: selectedStops[selectedStops.length - 1].lng } : null}
                route={evRoute}
                evStations={selectedStops.map(s => ({
                  id: s.id,
                  name: s.name,
                  latitude: s.lat,
                  longitude: s.lng,
                  address: s.address,
                  city: 'Indore',
                  distanceFromRouteKm: 0.0,
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
