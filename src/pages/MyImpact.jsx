import React, { useState, useEffect } from 'react';
import { getJourneys } from '../services/historyService';
import { SOLO_CO2_FACTOR_PER_KM, SOLO_COST_RATE_PER_KM, clamp } from '../utils/sustainabilityCalculations';

export default function MyImpact() {
  const [commuters, setCommuters] = useState(10000);
  const [percent, setPercent] = useState(30);
  const [journeys, setJourneys] = useState([]);

  useEffect(() => {
    const records = getJourneys();
    setJourneys(records || []);
  }, []);

  // CORE RULE: My Impact ONLY calculates completed journeys (status === "COMPLETED")
  const completedJourneys = journeys.filter(j => (j.status || 'PLANNED').toUpperCase() === 'COMPLETED');
  const hasJourneys = completedJourneys.length > 0;

  // 1. Eco Score: Clamped average of COMPLETED journey scores (0-100 scale)
  const totalScore = completedJourneys.reduce((sum, j) => sum + (typeof j.score === 'number' ? j.score : 80), 0);
  const rawAvgScore = hasJourneys ? totalScore / completedJourneys.length : 0;
  const ecoScoreDisplay = hasJourneys ? Math.round(clamp(rawAvgScore, 0, 100)) : '—';

  // 2. CO2 Saved (kg): Sum of max(0, distanceKm * 0.201 - journey.co2Kg) for COMPLETED journeys
  const totalCO2Saved = completedJourneys.reduce((sum, j) => {
    const distKm = j.distanceKmNum || (j.distanceMeters ? j.distanceMeters / 1000 : 0);
    const baselineCO2 = distKm * SOLO_CO2_FACTOR_PER_KM;
    const actualCO2 = typeof j.co2Kg === 'number' ? j.co2Kg : 0;
    return sum + Math.max(0, baselineCO2 - actualCO2);
  }, 0);
  const co2SavedDisplay = hasJourneys ? `${totalCO2Saved.toFixed(1)}` : '0.0';

  // 3. Money Saved (₹): Sum of max(0, distanceKm * 13.41 - journey.costInr) for COMPLETED journeys
  const totalMoneySaved = completedJourneys.reduce((sum, j) => {
    const distKm = j.distanceKmNum || (j.distanceMeters ? j.distanceMeters / 1000 : 0);
    const baselineCost = distKm * SOLO_COST_RATE_PER_KM;
    const actualCost = typeof j.costInr === 'number' ? j.costInr : (typeof j.cost === 'number' ? j.cost : 0);
    return sum + Math.max(0, baselineCost - actualCost);
  }, 0);
  const moneySavedDisplay = hasJourneys ? `₹${Math.round(totalMoneySaved).toLocaleString()}` : '₹0';

  // 4. Solo Trips Avoided: Count of COMPLETED journeys where mode is CARPOOL, CYCLING, WALKING, or TRANSIT
  const soloTripsAvoided = completedJourneys.filter(j => {
    const mode = (j.mode || '').toUpperCase();
    return mode === 'CARPOOL' || mode === 'CYCLING' || mode === 'WALKING' || mode === 'TRANSIT';
  }).length;

  // 5. Weekly Emissions & Reduction Percentage (Monday -> Sunday of current week) from COMPLETED journeys only
  const daysOfWeek = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  
  const now = new Date();
  const currentDayOfWeek = (now.getDay() + 6) % 7; // Monday = 0, Sunday = 6
  
  const mondayDate = new Date(now);
  mondayDate.setDate(now.getDate() - currentDayOfWeek);
  mondayDate.setHours(0, 0, 0, 0);

  const sundayDate = new Date(mondayDate);
  sundayDate.setDate(mondayDate.getDate() + 6);
  sundayDate.setHours(23, 59, 59, 999);

  const weeklyJourneys = completedJourneys.filter(j => {
    const t = j.timestamp || 0;
    return t >= mondayDate.getTime() && t <= sundayDate.getTime();
  });

  let totalWeeklyBaselineCO2 = 0;
  let totalWeeklyActualCO2 = 0;

  const dayEmissions = daysOfWeek.map((dayName, dayIdx) => {
    const dayStart = new Date(mondayDate);
    dayStart.setDate(mondayDate.getDate() + dayIdx);
    dayStart.setHours(0, 0, 0, 0);

    const dayEnd = new Date(dayStart);
    dayEnd.setHours(23, 59, 59, 999);

    const dayJourneys = weeklyJourneys.filter(j => {
      const t = j.timestamp || 0;
      return t >= dayStart.getTime() && t <= dayEnd.getTime();
    });

    const dayActual = dayJourneys.reduce((sum, j) => sum + (typeof j.co2Kg === 'number' ? j.co2Kg : 0), 0);
    const dayBaseline = dayJourneys.reduce((sum, j) => {
      const distKm = j.distanceKmNum || (j.distanceMeters ? j.distanceMeters / 1000 : 0);
      return sum + (distKm * SOLO_CO2_FACTOR_PER_KM);
    }, 0);

    totalWeeklyActualCO2 += dayActual;
    totalWeeklyBaselineCO2 += dayBaseline;

    return {
      day: dayName,
      actualCO2: dayActual,
      baselineCO2: dayBaseline,
      isToday: dayIdx === currentDayOfWeek
    };
  });

  const maxWeeklyCO2 = Math.max(...dayEmissions.map(d => d.actualCO2), 0.5);

  const weeklyReductionPct = totalWeeklyBaselineCO2 > 0
    ? Math.max(0, Math.round(((totalWeeklyBaselineCO2 - totalWeeklyActualCO2) / totalWeeklyBaselineCO2) * 100))
    : 0;

  // Community Simulator Math
  const co2Reduction = (commuters * (percent / 100) * 0.00613).toFixed(1);
  const rawSavings = commuters * (percent / 100) * 800;
  const savingsDisplay = rawSavings >= 100000 
    ? `₹${(rawSavings / 100000).toFixed(1)} lakh/mo`
    : `₹${rawSavings.toLocaleString()}/mo`;

  return (
    <main className="flex-1 pt-24 px-4 md:px-md pb-xl max-w-[1400px] w-full mx-auto">
      <div className="mb-lg">
        <h2 className="text-headline-lg font-headline-lg text-on-surface">Your Impact</h2>
        <p className="text-body-md font-body-md text-on-surface-variant mt-1">
          {hasJourneys 
            ? `Dynamic personal sustainability metrics calculated from ${journeys.length} saved route${journeys.length === 1 ? '' : 's'}.`
            : "Track and simulate your contribution to a sustainable future."}
        </p>
      </div>

      {/* Bento Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column (Main Metrics & Charts) */}
        <div className="col-span-1 lg:col-span-8 space-y-6">
          {/* Metrics Row */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {/* Score Card */}
            <div className="bg-white rounded-[20px] p-sm border border-tertiary-fixed card-shadow flex flex-col justify-center items-center relative overflow-hidden">
              <div className="absolute inset-0 bg-primary/5"></div>
              <span className="text-display-metrics font-display-metrics text-primary relative z-10">{ecoScoreDisplay}</span>
              <span className="text-label-sm font-label-sm text-on-surface-variant relative z-10">Eco Score</span>
            </div>

            {/* CO2 Saved */}
            <div className="bg-white rounded-[20px] p-sm border border-tertiary-fixed card-shadow flex flex-col justify-between">
              <span className="material-symbols-outlined text-primary mb-2">co2</span>
              <div>
                <div className="text-headline-md font-headline-md text-on-surface">{co2SavedDisplay}<span className="text-label-sm text-on-surface-variant">kg</span></div>
                <div className="text-label-xs font-label-xs text-on-surface-variant">CO2 Saved</div>
              </div>
            </div>

            {/* Money Saved */}
            <div className="bg-white rounded-[20px] p-sm border border-tertiary-fixed card-shadow flex flex-col justify-between">
              <span className="material-symbols-outlined text-primary mb-2">payments</span>
              <div>
                <div className="text-headline-md font-headline-md text-on-surface">{moneySavedDisplay}</div>
                <div className="text-label-xs font-label-xs text-on-surface-variant">Money Saved</div>
              </div>
            </div>

            {/* Solo Trips Avoided */}
            <div className="bg-white rounded-[20px] p-sm border border-tertiary-fixed card-shadow flex flex-col justify-between">
              <span className="material-symbols-outlined text-primary mb-2">directions_walk</span>
              <div>
                <div className="text-headline-md font-headline-md text-on-surface">{soloTripsAvoided}</div>
                <div className="text-label-xs font-label-xs text-on-surface-variant">Solo Trips Avoided</div>
              </div>
            </div>
          </div>

          {/* Weekly Emissions Chart Card */}
          <div className="bg-white rounded-[20px] p-md border border-tertiary-fixed card-shadow h-72 flex flex-col justify-between">
            <div className="flex justify-between items-center mb-4">
              <div>
                <h3 className="text-label-sm font-label-sm text-on-surface">Weekly Emissions</h3>
                <span className="text-label-xs text-on-surface-variant">Current Week (Mon – Sun)</span>
              </div>
              <span className="bg-[#F3F8E8] text-primary-container text-label-xs font-label-xs px-2.5 py-1 rounded-lg font-semibold border border-primary/20">
                Reduction: {weeklyReductionPct}%
              </span>
            </div>

            {/* Dynamic Monday to Sunday Bars */}
            <div className="flex-1 bg-surface-container-low rounded-lg border border-outline-variant flex items-end p-4 gap-3 md:gap-4 relative">
              {dayEmissions.map((d) => {
                const barHeightPct = maxWeeklyCO2 > 0 && d.actualCO2 > 0
                  ? Math.max(6, Math.round((d.actualCO2 / maxWeeklyCO2) * 100))
                  : 4;

                return (
                  <div key={d.day} className="flex-1 flex flex-col items-center h-full justify-end group relative cursor-pointer">
                    {/* Hover Tooltip */}
                    <div className="absolute -top-9 bg-surface text-on-surface text-label-xs px-2 py-1 rounded border border-outline shadow-sm opacity-0 group-hover:opacity-100 transition-opacity z-20 pointer-events-none whitespace-nowrap">
                      {d.actualCO2.toFixed(2)} kg CO₂ {d.isToday ? '(Today)' : ''}
                    </div>

                    {/* Bar */}
                    <div
                      className={`w-full max-w-[40px] rounded-t-md transition-all duration-500 ${
                        d.actualCO2 === 0
                          ? 'bg-outline-variant/40'
                          : d.isToday
                          ? 'bg-primary shadow-sm'
                          : 'bg-primary/60'
                      }`}
                      style={{ height: `${barHeightPct}%` }}
                    ></div>

                    {/* Label */}
                    <span className={`text-label-xs mt-2 font-medium ${d.isToday ? 'text-primary font-bold' : 'text-on-surface-variant'}`}>
                      {d.day}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right Column (Simulator & EV Sidebar) */}
        <div className="col-span-1 lg:col-span-4 space-y-6">
          {/* Community What-If Simulator */}
          <div className="bg-white rounded-[20px] p-md border border-tertiary-fixed card-shadow">
            <h3 className="text-label-sm font-label-sm text-on-surface mb-4">What if your community changed?</h3>
            <div className="space-y-6">
              <div>
                <div className="flex justify-between mb-2">
                  <label className="text-label-xs font-label-xs text-on-surface-variant">Daily Commuters</label>
                  <span className="text-label-sm font-label-sm text-on-surface">{commuters.toLocaleString()}</span>
                </div>
                <input 
                  className="w-full h-1 bg-tertiary-fixed rounded-lg appearance-none cursor-pointer accent-primary" 
                  max="50000" 
                  min="1000" 
                  step="500"
                  type="range" 
                  value={commuters}
                  onChange={(e) => setCommuters(Number(e.target.value))}
                />
              </div>
              <div>
                <div className="flex justify-between mb-2">
                  <label className="text-label-xs font-label-xs text-on-surface-variant">% Switching to Eco</label>
                  <span className="text-label-sm font-label-sm text-on-surface">{percent}%</span>
                </div>
                <input 
                  className="w-full h-1 bg-tertiary-fixed rounded-lg appearance-none cursor-pointer accent-primary" 
                  max="100" 
                  min="0" 
                  type="range" 
                  value={percent}
                  onChange={(e) => setPercent(Number(e.target.value))}
                />
              </div>
            </div>
            <div className="mt-6 pt-6 border-t border-outline-variant space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-label-xs font-label-xs text-on-surface-variant">Est. CO2 Reduction</span>
                <span className="text-label-sm font-label-sm text-primary">{co2Reduction} tons/mo</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-label-xs font-label-xs text-on-surface-variant">Economic Savings</span>
                <span className="text-label-sm font-label-sm text-primary">{savingsDisplay}</span>
              </div>
            </div>
          </div>

          {/* EV Intelligence Sidebar — Marked as Demo / Unconnected */}
          <div className="bg-white rounded-[20px] p-md border border-tertiary-fixed card-shadow relative overflow-hidden">
            <div className="relative z-10">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2 text-on-surface">
                  <span className="material-symbols-outlined text-primary">ev_station</span>
                  <h3 className="text-label-sm font-label-sm">EV Intelligence</h3>
                </div>
                <span className="bg-surface-container text-on-surface-variant text-[10px] px-2 py-0.5 rounded-full font-medium border border-outline-variant">
                  Demo
                </span>
              </div>
              <div className="flex items-end gap-2 mb-2">
                <span className="text-headline-lg font-headline-lg text-on-surface">23%</span>
                <span className="text-label-xs text-on-surface-variant mb-1">Battery (Sample Telemetry)</span>
              </div>
              <div className="w-full h-2 bg-surface-container-high rounded-full mb-4 overflow-hidden">
                <div className="h-full bg-error w-[23%] rounded-full"></div>
              </div>
              <div className="flex justify-between items-center mb-4">
                <span className="text-label-xs font-label-xs text-on-surface-variant">Est. Range</span>
                <span className="text-label-sm font-label-sm text-on-surface">78 km</span>
              </div>
              <div className="bg-error-container text-on-error-container text-label-xs font-label-xs p-2 rounded-lg flex items-center gap-2">
                <span className="material-symbols-outlined text-sm">warning</span>
                Vehicle data not connected
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
