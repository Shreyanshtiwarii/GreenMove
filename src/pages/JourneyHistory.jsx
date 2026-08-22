import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getJourneys, clearHistory, updateJourneyStatus } from '../services/historyService';

export default function JourneyHistory() {
  const navigate = useNavigate();
  const [filterMode, setFilterMode] = useState('all'); // 'all', 'DRIVING', 'MOTORCYCLE', 'CYCLING', 'WALKING', 'CARPOOL', 'TRANSIT'
  const [showDemoView, setShowDemoView] = useState(false);
  const [realJourneys, setRealJourneys] = useState([]);

  // Load real journey records from localStorage on mount & filter change
  const reloadJourneys = () => {
    const records = getJourneys();
    setRealJourneys(records || []);
  };

  useEffect(() => {
    reloadJourneys();
  }, []);

  // Demo Fallback Trips Array (Isolated for Demo View only)
  const demoTrips = [
    {
      id: 'demo_1',
      dateFormatted: 'Aug 15, 2023',
      timeFormatted: '08:30 AM',
      title: 'Downtown to Tech Hub',
      mode: 'TRANSIT',
      score: 92,
      distanceKm: '20.0 km',
      durationMinutes: '45 min',
      costFormatted: '₹25',
      co2Formatted: '0.60 kg',
      co2SavedFormatted: '4.2 kg',
      status: 'COMPLETED',
      badge: 'High Score'
    },
    {
      id: 'demo_2',
      dateFormatted: 'Aug 14, 2023',
      timeFormatted: '06:15 PM',
      title: 'Home to Grocery',
      mode: 'CYCLING',
      score: 98,
      distanceKm: '5.0 km',
      durationMinutes: '18 min',
      costFormatted: '₹0',
      co2Formatted: '0.00 kg',
      co2SavedFormatted: '1.0 kg',
      status: 'COMPLETED',
      badge: 'Active'
    },
    {
      id: 'demo_3',
      dateFormatted: 'Aug 13, 2023',
      timeFormatted: '09:00 AM',
      title: 'Office Commute',
      mode: 'CARPOOL',
      score: 75,
      distanceKm: '24.5 km',
      durationMinutes: '32 min',
      costFormatted: '₹35',
      co2Formatted: '1.20 kg',
      co2SavedFormatted: '2.1 kg',
      status: 'COMPLETED',
      badge: '3 pax'
    },
    {
      id: 'demo_4',
      dateFormatted: 'Aug 10, 2023',
      timeFormatted: '11:45 AM',
      title: 'Airport Run',
      mode: 'DRIVING',
      score: 42,
      distanceKm: '35.0 km',
      durationMinutes: '35 min',
      costFormatted: '₹220',
      co2Formatted: '7.04 kg',
      co2SavedFormatted: '0.0 kg',
      status: 'PLANNED',
      badge: 'Solo'
    }
  ];

  // Current active trips list depending on Demo Toggle
  const activeTripsList = showDemoView ? demoTrips : realJourneys;

  // Filter trips based on active mode selection
  const filteredTrips = filterMode === 'all'
    ? activeTripsList
    : activeTripsList.filter(trip => trip.mode === filterMode);

  // Icon mapping
  const modeIcons = {
    DRIVING: 'directions_car',
    MOTORCYCLE: 'two_wheeler',
    CYCLING: 'directions_bike',
    WALKING: 'directions_walk',
    CARPOOL: 'group',
    TRANSIT: 'directions_bus'
  };

  // Label mapping
  const modeLabels = {
    DRIVING: 'Driving (Solo)',
    MOTORCYCLE: 'Bike / Motorcycle',
    CYCLING: 'Cycling',
    WALKING: 'Walking',
    CARPOOL: 'Carpool',
    TRANSIT: 'Public Transit'
  };

  const handleClearRealHistory = () => {
    if (window.confirm("Are you sure you want to clear your saved journey history?")) {
      clearHistory();
      reloadJourneys();
    }
  };

  const handleUpdateStatus = (id, newStatus) => {
    updateJourneyStatus(id, newStatus);
    reloadJourneys();
  };

  return (
    <main className="flex-1 pt-16 md:pt-0 pb-20 md:pb-0 px-4 md:px-lg min-h-screen max-w-7xl mx-auto overflow-y-auto scrollbar-none">
      {/* Header & Filter Section — Clean Vertical Hierarchy */}
      <div className="py-6 border-b border-outline-variant mb-6 mt-8 md:mt-0 space-y-4">
        {/* Level 1 & Level 2: Heading & Subtitle */}
        <div>
          <h2 className="text-headline-lg-mobile md:text-headline-lg font-headline-lg-mobile md:font-headline-lg text-primary mb-1">
            Your Journey History
          </h2>
          <p className="text-body-md font-body-md text-on-surface-variant">
            {showDemoView 
              ? "Viewing demo sample journeys (Demo Mode Active)" 
              : "Review your past routes, sustainability metrics, and costs."}
          </p>
        </div>

        {/* Level 3: Dedicated Filter & Control Row below Subtitle */}
        <div className="flex flex-wrap items-center gap-2 pt-1">
          <button
            type="button"
            onClick={() => setFilterMode('all')}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-label-sm font-label-sm border transition-colors cursor-pointer ${
              filterMode === 'all'
                ? 'bg-primary text-on-primary border-primary font-semibold shadow-sm'
                : 'bg-surface-container-high text-on-surface border-outline-variant hover:border-primary'
            }`}
          >
            All Trips
          </button>
          
          <button
            type="button"
            onClick={() => setFilterMode('DRIVING')}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-label-sm font-label-sm border transition-colors cursor-pointer ${
              filterMode === 'DRIVING'
                ? 'bg-primary text-on-primary border-primary font-semibold shadow-sm'
                : 'bg-surface-container-high text-on-surface border-outline-variant hover:border-primary'
            }`}
          >
            <span className="material-symbols-outlined text-[16px]">directions_car</span>
            Driving
          </button>

          <button
            type="button"
            onClick={() => setFilterMode('MOTORCYCLE')}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-label-sm font-label-sm border transition-colors cursor-pointer ${
              filterMode === 'MOTORCYCLE'
                ? 'bg-primary text-on-primary border-primary font-semibold shadow-sm'
                : 'bg-surface-container-high text-on-surface border-outline-variant hover:border-primary'
            }`}
          >
            <span className="material-symbols-outlined text-[16px]">two_wheeler</span>
            Motorcycle
          </button>

          <button
            type="button"
            onClick={() => setFilterMode('CYCLING')}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-label-sm font-label-sm border transition-colors cursor-pointer ${
              filterMode === 'CYCLING'
                ? 'bg-primary text-on-primary border-primary font-semibold shadow-sm'
                : 'bg-surface-container-high text-on-surface border-outline-variant hover:border-primary'
            }`}
          >
            <span className="material-symbols-outlined text-[16px]">directions_bike</span>
            Cycling
          </button>

          <button
            type="button"
            onClick={() => setFilterMode('WALKING')}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-label-sm font-label-sm border transition-colors cursor-pointer ${
              filterMode === 'WALKING'
                ? 'bg-primary text-on-primary border-primary font-semibold shadow-sm'
                : 'bg-surface-container-high text-on-surface border-outline-variant hover:border-primary'
            }`}
          >
            <span className="material-symbols-outlined text-[16px]">directions_walk</span>
            Walking
          </button>

          <button
            type="button"
            onClick={() => setFilterMode('CARPOOL')}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-label-sm font-label-sm border transition-colors cursor-pointer ${
              filterMode === 'CARPOOL'
                ? 'bg-primary text-on-primary border-primary font-semibold shadow-sm'
                : 'bg-surface-container-high text-on-surface border-outline-variant hover:border-primary'
            }`}
          >
            <span className="material-symbols-outlined text-[16px]">group</span>
            Carpool
          </button>

          <button
            type="button"
            onClick={() => setShowDemoView(!showDemoView)}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-label-sm font-label-sm border transition-colors cursor-pointer ${
              showDemoView 
                ? 'bg-amber-100 text-amber-800 border-amber-300 font-semibold' 
                : 'bg-surface-container-high text-on-surface border-outline-variant hover:border-primary'
            }`}
          >
            <span className="material-symbols-outlined text-[16px]">cached</span>
            {showDemoView ? 'Demo View Active' : 'Toggle Demo View'}
          </button>

          {realJourneys.length > 0 && !showDemoView && (
            <button
              type="button"
              onClick={handleClearRealHistory}
              title="Clear Saved History"
              className="flex items-center gap-1 px-3 py-1.5 rounded-full text-label-xs font-label-xs text-error hover:bg-error-container/20 border border-error/30 transition-colors cursor-pointer ml-auto"
            >
              <span className="material-symbols-outlined text-[14px]">delete</span>
              Clear History
            </button>
          )}
        </div>
      </div>

      {/* Main Content Area */}
      {filteredTrips.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
          {filteredTrips.map((trip, idx) => {
            const isLatest = idx === 0 && !showDemoView;
            const status = (trip.status || 'PLANNED').toUpperCase();

            // Status Badge styling
            const statusBadgeConfig = {
              PLANNED: { text: '🟡 Planned', style: 'bg-amber-50 text-amber-800 border-amber-300 font-semibold' },
              IN_PROGRESS: { text: '🔵 In Progress', style: 'bg-blue-50 text-blue-800 border-blue-300 font-semibold' },
              COMPLETED: { text: '🟢 Completed', style: 'bg-emerald-50 text-emerald-800 border-emerald-300 font-semibold' }
            }[status] || { text: '🟡 Planned', style: 'bg-amber-50 text-amber-800 border-amber-300 font-semibold' };

            if (isLatest) {
              return (
                /* Primary Hero Card for Most Recent Journey */
                <div key={trip.id} className="md:col-span-12 bg-surface-container-lowest border-2 border-primary/40 rounded-2xl shadow-sm overflow-hidden flex flex-col md:flex-row cursor-pointer hover:border-primary transition-colors">
                  {/* Map / Icon Left Section */}
                  <div className="h-36 md:h-auto md:w-1/3 relative bg-surface-container-low border-b md:border-b-0 md:border-r border-outline-variant/30 flex items-center justify-center p-6">
                    <div className="flex flex-col items-center justify-center text-center">
                      <div className="w-16 h-16 rounded-2xl bg-primary-container/20 text-primary flex items-center justify-center mb-2 shadow-sm">
                        <span className="material-symbols-outlined text-3xl">
                          {modeIcons[trip.mode] || 'directions'}
                        </span>
                      </div>
                      <span className="bg-primary-container/20 text-primary px-3 py-1 rounded-full text-label-xs font-label-xs font-semibold mb-2">
                        {modeLabels[trip.mode] || trip.mode}
                      </span>
                      <span className={`px-2.5 py-0.5 rounded-full text-[11px] border ${statusBadgeConfig.style}`}>
                        {statusBadgeConfig.text}
                      </span>
                    </div>
                  </div>

                  {/* Details Section */}
                  <div className="p-5 md:p-6 flex-1 flex flex-col justify-between">
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <p className="text-label-sm font-label-sm text-on-surface-variant mb-1">
                          {trip.dateFormatted} • {trip.timeFormatted}
                        </p>
                        <h3 className="text-headline-md font-headline-md text-on-surface mb-2">{trip.title}</h3>
                        
                        {/* Lifecycle Action Buttons */}
                        {!showDemoView && (
                          <div className="mt-2 flex items-center gap-2">
                            {status === 'PLANNED' && (
                              <button
                                type="button"
                                onClick={(e) => { e.stopPropagation(); handleUpdateStatus(trip.id, 'IN_PROGRESS'); }}
                                className="bg-amber-600 text-white text-label-xs font-label-xs px-3 py-1.5 rounded-lg hover:bg-amber-700 transition-colors shadow-sm cursor-pointer flex items-center gap-1"
                              >
                                <span className="material-symbols-outlined text-xs">play_arrow</span>
                                Start Journey
                              </button>
                            )}
                            {status === 'IN_PROGRESS' && (
                              <button
                                type="button"
                                onClick={(e) => { e.stopPropagation(); handleUpdateStatus(trip.id, 'COMPLETED'); }}
                                className="bg-emerald-600 text-white text-label-xs font-label-xs px-3 py-1.5 rounded-lg hover:bg-emerald-700 transition-colors shadow-sm cursor-pointer flex items-center gap-1"
                              >
                                <span className="material-symbols-outlined text-xs">check_circle</span>
                                Complete Journey
                              </button>
                            )}
                            {status === 'COMPLETED' && (
                              <span className="text-label-xs font-label-xs text-emerald-700 font-semibold flex items-center gap-1 bg-emerald-50 px-2.5 py-1 rounded-md border border-emerald-200">
                                <span className="material-symbols-outlined text-xs">verified</span>
                                Counted in My Impact
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                      <div className="text-right">
                        <p className="text-display-metrics font-display-metrics text-primary font-bold">{trip.score || 85}</p>
                        <p className="text-label-xs font-label-xs text-on-surface-variant">Eco Score</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-auto border-t border-outline-variant/30 pt-4">
                      <div>
                        <p className="text-label-xs font-label-xs text-on-surface-variant flex items-center gap-1">
                          <span className="material-symbols-outlined text-[14px]">route</span> Distance
                        </p>
                        <p className="text-body-md font-body-md text-on-surface font-semibold">{trip.distanceKm}</p>
                      </div>

                      <div>
                        <p className="text-label-xs font-label-xs text-on-surface-variant flex items-center gap-1">
                          <span className="material-symbols-outlined text-[14px]">schedule</span> Time
                        </p>
                        <p className="text-body-md font-body-md text-on-surface font-semibold">{trip.durationMinutes}</p>
                      </div>

                      <div>
                        <p className="text-label-xs font-label-xs text-on-surface-variant flex items-center gap-1">
                          <span className="material-symbols-outlined text-[14px]">payments</span> Cost
                        </p>
                        <p className="text-body-md font-body-md text-on-surface font-semibold">{trip.costFormatted}</p>
                      </div>

                      <div>
                        <p className="text-label-xs font-label-xs text-on-surface-variant flex items-center gap-1">
                          <span className="material-symbols-outlined text-[14px]">co2</span> Emissions
                        </p>
                        <p className={`text-body-md font-body-md font-semibold ${trip.co2Kg === 0 ? 'text-emerald-600 font-bold' : 'text-on-surface'}`}>
                          {trip.co2Formatted}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              );
            }

            return (
              /* Compact Grid Cards */
              <div key={trip.id} className="md:col-span-6 lg:col-span-4 bg-surface-container-lowest border border-tertiary-fixed rounded-2xl p-4 shadow-sm hover:border-outline-variant transition-colors cursor-pointer flex flex-col justify-between">
                <div>
                  <div className="flex justify-between items-center border-b border-outline-variant/30 pb-2.5 mb-3">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-xl bg-primary-container/20 flex items-center justify-center text-primary">
                        <span className="material-symbols-outlined text-[18px]">
                          {modeIcons[trip.mode] || 'directions'}
                        </span>
                      </div>
                      <span className="text-label-sm font-label-sm text-on-surface font-medium">{trip.dateFormatted}</span>
                    </div>

                    <span className={`px-2 py-0.5 rounded-md text-[11px] border ${statusBadgeConfig.style}`}>
                      {statusBadgeConfig.text}
                    </span>
                  </div>

                  <h4 className="text-body-md font-body-md font-semibold text-on-surface mb-1">{trip.title}</h4>
                  <p className="text-label-xs text-on-surface-variant mb-3">{modeLabels[trip.mode] || trip.mode}</p>

                  {/* Lifecycle Action Buttons */}
                  {!showDemoView && (
                    <div className="mb-3">
                      {status === 'PLANNED' && (
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); handleUpdateStatus(trip.id, 'IN_PROGRESS'); }}
                          className="w-full bg-amber-600 text-white text-label-xs font-label-xs py-1 rounded-lg hover:bg-amber-700 transition-colors shadow-sm cursor-pointer flex items-center justify-center gap-1"
                        >
                          <span className="material-symbols-outlined text-xs">play_arrow</span>
                          Start Journey
                        </button>
                      )}
                      {status === 'IN_PROGRESS' && (
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); handleUpdateStatus(trip.id, 'COMPLETED'); }}
                          className="w-full bg-emerald-600 text-white text-label-xs font-label-xs py-1 rounded-lg hover:bg-emerald-700 transition-colors shadow-sm cursor-pointer flex items-center justify-center gap-1"
                        >
                          <span className="material-symbols-outlined text-xs">check_circle</span>
                          Complete Journey
                        </button>
                      )}
                      {status === 'COMPLETED' && (
                        <span className="block text-center text-label-xs text-emerald-700 font-medium bg-emerald-50 py-0.5 rounded border border-emerald-200">
                          ✓ Counted in My Impact
                        </span>
                      )}
                    </div>
                  )}
                </div>

                <div className="flex justify-between text-label-xs font-label-xs text-on-surface-variant pt-3 border-t border-outline-variant/30">
                  <span className="flex items-center gap-1 font-medium text-on-surface">
                    <span className="material-symbols-outlined text-[14px]">route</span> {trip.distanceKm}
                  </span>
                  <span className="flex items-center gap-1 font-medium text-on-surface">
                    <span className="material-symbols-outlined text-[14px]">schedule</span> {trip.durationMinutes}
                  </span>
                  <span className="flex items-center gap-1 font-medium text-primary font-semibold">
                    <span className="material-symbols-outlined text-[14px]">payments</span> {trip.costFormatted}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* Empty State */
        <div className="flex flex-col items-center justify-center py-16 bg-surface-container-lowest border border-tertiary-fixed rounded-2xl my-6">
          <span className="material-symbols-outlined text-5xl text-outline-variant mb-3">history_toggle_off</span>
          <h3 className="text-headline-sm font-headline-sm text-on-surface mb-2">No journeys yet</h3>
          <p className="text-body-md font-body-md text-on-surface-variant text-center max-w-md mb-6">
            Your saved history will appear here once you select or plan routes. Plan your first sustainable route today.
          </p>
          <button 
            type="button"
            onClick={() => navigate('/plan-route')}
            className="bg-primary text-on-primary rounded-xl px-6 py-2.5 text-label-sm font-label-sm hover:bg-primary/90 transition-colors shadow-md cursor-pointer flex items-center gap-2"
          >
            <span className="material-symbols-outlined text-sm">explore</span>
            <span>Plan First Journey</span>
          </button>
        </div>
      )}
    </main>
  );
}
