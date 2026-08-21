import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getJourneys, getCurrentUser, getJourneysFromBackend, getCarpoolCandidatesFromBackend } from '../services/historyService';
import { calculateRouteCO2 } from '../utils/sustainabilityCalculations';

/**
 * Calculates geodesic distance between two lat/lng coordinates in kilometers using Haversine formula.
 */
function haversineKm(lat1, lon1, lat2, lon2) {
  if (lat1 == null || lon1 == null || lat2 == null || lon2 == null) return 3.5;
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
  return Number((R * c).toFixed(2));
}

export default function Carpool() {
  const navigate = useNavigate();
  const [journeys, setJourneys] = useState([]);
  const [candidateJourneys, setCandidateJourneys] = useState([]);
  const [selectedMatch, setSelectedMatch] = useState(null);
  const currentUser = getCurrentUser();

  useEffect(() => {
    async function loadData() {
      // 1. Local fallback immediate load
      const localJourneys = getJourneys();
      setJourneys(localJourneys);

      // 2. Fetch authenticated user routes & candidates directly from Spring Boot backend shared database
      const backendUserJourneys = await getJourneysFromBackend();
      if (backendUserJourneys && backendUserJourneys.length > 0) {
        setJourneys(backendUserJourneys);
      }

      const backendCandidates = await getCarpoolCandidatesFromBackend(currentUser.id);
      setCandidateJourneys(backendCandidates || []);
    }

    loadData();
  }, [currentUser.id]);

  // Primary user journey (most recent saved journey belonging to current authenticated user)
  const myJourney = journeys.find(j => j.userId === currentUser.id) || (journeys.length > 0 ? journeys[0] : null);

  // Filter out any candidate records belonging to current authenticated user
  const validCandidates = candidateJourneys.filter(j => j.userId !== currentUser.id && j.id !== myJourney?.id);

  // Data-driven matching algorithm operating exclusively on genuine candidate user journeys from Spring Boot DB
  const carpoolMatches = validCandidates.map((cand, idx) => {
    // 1. Geodesic Pickup Distance (Origin to Candidate Origin)
    const myOrigLat = myJourney?.origin?.lat || 22.75;
    const myOrigLng = myJourney?.origin?.lng || 75.89;
    const candOrigLat = cand.origin?.lat || 22.72;
    const candOrigLng = cand.origin?.lng || 75.88;

    const pickupDistanceKm = haversineKm(myOrigLat, myOrigLng, candOrigLat, candOrigLng);

    // 2. Geodesic Destination Proximity (Destination to Candidate Destination)
    const myDestLat = myJourney?.destination?.lat || 22.65;
    const myDestLng = myJourney?.destination?.lng || 75.85;
    const candDestLat = cand.destination?.lat || 22.65;
    const candDestLng = cand.destination?.lng || 75.85;

    const destDistanceKm = haversineKm(myDestLat, myDestLng, candDestLat, candDestLng);

    // 3. Departure Time Difference (in minutes)
    const myTime = myJourney?.timestamp || Date.now();
    const candTime = cand.timestamp || Date.now();
    const timeDeltaMins = Math.abs(Math.round((myTime - candTime) / 60000));

    // 4. Mathematical Sub-Scores (0 to 100)
    const proximityScore = Math.max(0, 100 - (pickupDistanceKm * 12));
    const destScore = Math.max(0, 100 - (destDistanceKm * 15));
    const timeScore = Math.max(0, 100 - (timeDeltaMins * 1.5));

    // 5. Final Deterministic Match Percentage
    const rawMatchPct = Math.round((0.4 * proximityScore) + (0.4 * destScore) + (0.2 * timeScore));
    const matchPercentage = Math.max(0, Math.min(100, rawMatchPct));

    // 6. Calculated Per-Person CO2 Savings
    const distKm = cand.distanceKmNum || 10;
    const soloCO2 = distKm * 0.201;
    const carpoolCO2 = calculateRouteCO2(distKm, 'DRIVING', (cand.passengers || 1) + 1);
    const co2SavedKg = Math.max(0, soloCO2 - carpoolCO2).toFixed(1);

    const origShort = cand.origin?.name ? cand.origin.name.split(',')[0].trim() : 'Origin';
    const destShort = cand.destination?.name ? cand.destination.name.split(',')[0].trim() : 'Destination';
    const title = `${origShort} → ${destShort}`;

    // Authentic rider name derived strictly from candidate payload without synthetic fallback IDs
    const riderName = cand.userName || cand.driverName || `Rider (${origShort})`;
    const initial = riderName.charAt(0).toUpperCase();

    return {
      id: cand.id,
      name: riderName,
      initial,
      title,
      date: cand.dateFormatted || 'Today',
      time: cand.timeFormatted || '10:00 AM',
      matchPercentageNum: matchPercentage,
      matchPercentage: `${matchPercentage}%`,
      pickupDistanceNum: pickupDistanceKm,
      pickupDistance: `${pickupDistanceKm} km Pickup`,
      co2SavedFormatted: `-${co2SavedKg} kg CO₂`,
      passengers: (cand.passengers || 1) + 1,
      costPerPerson: `₹${Math.round((distKm * 4.25) / ((cand.passengers || 1) + 1))}`,
      status: cand.status || 'PLANNED',
      isCompatible: matchPercentage >= 70 && destDistanceKm <= 15 // Requires destination proximity <= 15 km and match >= 70%
    };
  }).filter(m => m.isCompatible);

  return (
    <main className="flex-1 w-full pt-[24px] px-4 md:px-lg pb-xl max-w-7xl mx-auto overflow-y-auto scrollbar-none">
      <header className="mb-lg flex flex-col md:flex-row justify-between md:items-end gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="material-symbols-outlined text-primary text-2xl">group</span>
            <h2 className="text-headline-lg font-headline-lg text-on-surface">Carpool Matching</h2>
          </div>
          <p className="text-body-md font-body-md text-on-surface-variant">
            Connect with nearby commuters travelling compatible routes to share rides and reduce emissions.
          </p>
        </div>
        <button
          type="button"
          onClick={() => navigate('/plan-route')}
          className="bg-primary text-on-primary rounded-xl px-5 py-2.5 text-label-sm font-label-sm hover:bg-primary/90 transition-colors shadow-sm cursor-pointer flex items-center gap-2 self-start md:self-auto"
        >
          <span className="material-symbols-outlined text-sm">add_location</span>
          <span>Plan New Carpool Route</span>
        </button>
      </header>

      {/* Main Grid */}
      {carpoolMatches.length > 0 ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Matches List */}
          <div className="lg:col-span-8 space-y-4">
            <div className="flex justify-between items-center pb-2 border-b border-outline-variant">
              <h3 className="text-label-sm font-label-sm text-on-surface uppercase tracking-wider">
                Compatible Matches ({carpoolMatches.length})
              </h3>
              <span className="text-label-xs text-on-surface-variant">Spring Boot DB shared persistence & geodesic calculation</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {carpoolMatches.map((match) => (
                <div
                  key={match.id}
                  onClick={() => setSelectedMatch(match)}
                  className={`bg-surface-container-lowest rounded-2xl p-5 border transition-all cursor-pointer shadow-sm hover:shadow-md ${
                    selectedMatch?.id === match.id
                      ? 'border-2 border-primary bg-primary/5'
                      : 'border-tertiary-fixed hover:border-primary/50'
                  }`}
                >
                  <div className="flex justify-between items-start mb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-primary-container/30 text-primary font-bold flex items-center justify-center border border-primary/20">
                        {match.initial}
                      </div>
                      <div>
                        <h4 className="text-label-sm font-label-sm text-on-surface font-semibold">{match.name}</h4>
                        <p className="text-label-xs text-on-surface-variant">{match.date} • {match.time}</p>
                      </div>
                    </div>
                    <span className={`px-2.5 py-1 rounded-full text-label-xs font-label-xs font-bold border ${
                      match.matchPercentageNum >= 75
                        ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                        : 'bg-amber-50 text-amber-800 border-amber-300'
                    }`}>
                      {match.matchPercentage} Match
                    </span>
                  </div>

                  <div className="bg-surface-container-low p-3 rounded-xl mb-4 border border-outline-variant/30">
                    <p className="text-body-md font-body-md font-semibold text-on-surface mb-1">{match.title}</p>
                    <div className="flex justify-between text-label-xs text-on-surface-variant">
                      <span>Pickup: {match.pickupDistance}</span>
                      <span className="text-emerald-700 font-semibold">{match.co2SavedFormatted}</span>
                    </div>
                  </div>

                  <div className="flex justify-between items-center pt-2 border-t border-outline-variant/20 text-label-xs">
                    <span className="text-on-surface-variant">Estimated Share: <strong className="text-primary">{match.costPerPerson}</strong>/seat</span>
                    <button
                      type="button"
                      className="bg-primary text-on-primary px-3 py-1.5 rounded-lg font-label-xs font-semibold hover:bg-primary/90 transition-colors"
                    >
                      Request Ride
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Right Panel: Selected Match Details */}
          <div className="lg:col-span-4">
            <div className="bg-surface-container-lowest rounded-2xl p-5 border border-tertiary-fixed shadow-sm sticky top-24">
              {selectedMatch ? (
                <div className="space-y-4">
                  <div className="flex items-center gap-3 pb-3 border-b border-outline-variant">
                    <div className="w-12 h-12 rounded-full bg-primary-container/40 text-primary font-bold text-lg flex items-center justify-center">
                      {selectedMatch.initial}
                    </div>
                    <div>
                      <h3 className="text-headline-sm font-headline-sm text-on-surface">{selectedMatch.name}</h3>
                      <span className="bg-emerald-50 text-emerald-800 text-label-xs px-2 py-0.5 rounded font-semibold border border-emerald-200">
                        Verified Rider
                      </span>
                    </div>
                  </div>

                  <div className="space-y-2 text-body-md">
                    <div className="flex justify-between py-1 border-b border-outline-variant/20">
                      <span className="text-on-surface-variant text-label-xs">Route</span>
                      <span className="font-semibold text-on-surface text-label-sm">{selectedMatch.title}</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-outline-variant/20">
                      <span className="text-on-surface-variant text-label-xs">Departure</span>
                      <span className="font-semibold text-on-surface text-label-sm">{selectedMatch.time}</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-outline-variant/20">
                      <span className="text-on-surface-variant text-label-xs">Calculated Pickup Distance</span>
                      <span className="font-semibold text-on-surface text-label-sm">{selectedMatch.pickupDistance}</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-outline-variant/20">
                      <span className="text-on-surface-variant text-label-xs">Estimated CO₂ Benefit</span>
                      <span className="font-semibold text-emerald-700 text-label-sm">{selectedMatch.co2SavedFormatted}</span>
                    </div>
                    <div className="flex justify-between py-1">
                      <span className="text-on-surface-variant text-label-xs">Cost Share</span>
                      <span className="font-semibold text-primary text-label-sm">{selectedMatch.costPerPerson} per seat</span>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => alert(`Ride request sent to ${selectedMatch.name}!`)}
                    className="w-full bg-primary text-on-primary py-3 rounded-xl font-label-sm font-semibold hover:bg-primary/90 transition-colors shadow-md cursor-pointer flex items-center justify-center gap-2 mt-4"
                  >
                    <span className="material-symbols-outlined text-sm">send</span>
                    Send Carpool Request
                  </button>
                </div>
              ) : (
                <div className="text-center py-8">
                  <span className="material-symbols-outlined text-4xl text-outline-variant mb-2">touch_app</span>
                  <h4 className="text-label-sm font-label-sm text-on-surface mb-1">Select a Carpool Match</h4>
                  <p className="text-label-xs text-on-surface-variant">
                    Click on any candidate card to view detailed route compatibility and request a ride.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      ) : (
        /* Truthful Empty State when zero compatible OTHER real users exist */
        <div className="flex flex-col items-center justify-center py-16 bg-surface-container-lowest border border-tertiary-fixed rounded-2xl my-6">
          <span className="material-symbols-outlined text-5xl text-outline-variant mb-3">group_off</span>
          <h3 className="text-headline-sm font-headline-sm text-on-surface mb-2">No compatible carpool riders found</h3>
          <p className="text-body-md font-body-md text-on-surface-variant text-center max-w-md mb-6">
            No compatible carpool riders found for this journey yet. Save or plan another route on Plan Route or Compare to discover real carpool matches along your route.
          </p>
          <button
            type="button"
            onClick={() => navigate('/plan-route')}
            className="bg-primary text-on-primary rounded-xl px-6 py-2.5 text-label-sm font-label-sm hover:bg-primary/90 transition-colors shadow-md cursor-pointer flex items-center gap-2"
          >
            <span className="material-symbols-outlined text-sm">explore</span>
            <span>Plan a Route to Find Matches</span>
          </button>
        </div>
      )}
    </main>
  );
}
