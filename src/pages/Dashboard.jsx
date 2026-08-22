import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

export default function Dashboard() {
  const navigate = useNavigate();
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [departure, setDeparture] = useState('Leave now');
  const [passengers, setPassengers] = useState('1');
  const [priority, setPriority] = useState('Eco');

  const handleSubmit = (e) => {
    e.preventDefault();
    // Navigate to Plan Route page with parameters
    navigate(`/plan-route?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}&passengers=${passengers}&priority=${priority}`);
  };

  return (
    <div className="flex-1 p-md md:p-lg lg:p-xl max-w-7xl mx-auto w-full">
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-lg">
        {/* Left Column (Plan & Recommend) */}
        <div className="xl:col-span-2 space-y-lg">
          {/* Plan Journey Card */}
          <div className="bg-surface-container-lowest rounded-[20px] border border-tertiary-fixed shadow-[0px_4px_20px_rgba(16,32,21,0.04)] p-md md:p-lg relative overflow-hidden">
            <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-br from-primary-fixed-dim/20 to-transparent rounded-bl-full pointer-events-none"></div>
            <h3 className="text-headline-md font-headline-md text-on-surface mb-6 flex items-center gap-2">
              <span className="material-symbols-outlined text-primary">route</span>
              Plan Journey
            </h3>
            <form onSubmit={handleSubmit}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-sm mb-6 relative">
                {/* Inputs */}
                <div className="space-y-sm">
                  <div>
                    <label className="block text-label-xs font-label-xs text-on-surface-variant mb-1">From</label>
                    <div className="relative">
                      <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline text-lg">my_location</span>
                      <input 
                        value={from}
                        onChange={(e) => setFrom(e.target.value)}
                        className="w-full bg-surface-container-lowest border border-tertiary-fixed rounded-lg py-2 pl-10 pr-3 text-body-md text-on-surface focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all" 
                        placeholder="Current Location" 
                        type="text"
                      />
                    </div>
                  </div>
                  <div className="relative flex justify-center -my-2 z-10 md:hidden">
                    <button 
                      type="button"
                      onClick={() => {
                        const temp = from;
                        setFrom(to);
                        setTo(temp);
                      }}
                      className="bg-surface-container border border-tertiary-fixed rounded-full p-1 text-on-surface-variant hover:text-primary transition-colors shadow-sm cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-sm">swap_vert</span>
                    </button>
                  </div>
                  <div>
                    <label className="block text-label-xs font-label-xs text-on-surface-variant mb-1">To</label>
                    <div className="relative">
                      <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline text-lg">location_on</span>
                      <input 
                        value={to}
                        onChange={(e) => setTo(e.target.value)}
                        className="w-full bg-surface-container-lowest border border-tertiary-fixed rounded-lg py-2 pl-10 pr-3 text-body-md text-on-surface focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all" 
                        placeholder="Where to?" 
                        type="text"
                        required
                      />
                    </div>
                  </div>
                </div>

                {/* Options */}
                <div className="space-y-sm">
                  <div>
                    <label className="block text-label-xs font-label-xs text-on-surface-variant mb-1">Departure</label>
                    <div className="relative">
                      <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline text-lg">schedule</span>
                      <select 
                        value={departure}
                        onChange={(e) => setDeparture(e.target.value)}
                        className="w-full bg-surface-container-lowest border border-tertiary-fixed rounded-lg py-2 pl-10 pr-3 text-body-md text-on-surface focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all appearance-none cursor-pointer"
                      >
                        <option>Leave now</option>
                        <option>Set time...</option>
                      </select>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-sm">
                    <div>
                      <label className="block text-label-xs font-label-xs text-on-surface-variant mb-1">Passengers</label>
                      <div className="relative">
                        <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline text-lg">person</span>
                        <select 
                          value={passengers}
                          onChange={(e) => setPassengers(e.target.value)}
                          className="w-full bg-surface-container-lowest border border-tertiary-fixed rounded-lg py-2 pl-10 pr-3 text-body-md text-on-surface focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all appearance-none cursor-pointer"
                        >
                          <option>1</option>
                          <option>2</option>
                          <option>3+</option>
                        </select>
                      </div>
                    </div>
                    <div>
                      <label className="block text-label-xs font-label-xs text-on-surface-variant mb-1">Priority</label>
                      <div className="relative">
                        <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline text-lg">tune</span>
                        <select 
                          value={priority}
                          onChange={(e) => setPriority(e.target.value)}
                          className="w-full bg-surface-container-lowest border border-tertiary-fixed rounded-lg py-2 pl-10 pr-3 text-body-md text-on-surface focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all appearance-none cursor-pointer"
                        >
                          <option>Eco</option>
                          <option>Balanced</option>
                          <option>Budget</option>
                          <option>Fast</option>
                        </select>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <div className="flex justify-end">
                <button 
                  type="submit"
                  className="bg-primary-container text-on-primary font-label-sm px-6 py-3 rounded-lg flex items-center gap-2 hover:bg-primary transition-colors shadow-sm cursor-pointer"
                >
                  Find Sustainable Route
                  <span className="material-symbols-outlined text-sm">arrow_forward</span>
                </button>
              </div>
            </form>
          </div>

          {/* Today's Recommendation & Suggestion Split */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-lg">
            {/* Recommendation */}
            <div className="bg-surface-container-lowest rounded-[20px] border border-tertiary-fixed shadow-[0px_4px_20px_rgba(16,32,21,0.04)] p-md flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h4 className="text-label-sm font-label-sm text-on-surface-variant uppercase tracking-wider">Today's Recommendation</h4>
                  <span className="bg-secondary-fixed/30 text-primary-container text-xs font-bold px-2 py-1 rounded">Top Match</span>
                </div>
                <div className="flex items-center gap-4 mb-4">
                  <div className="w-16 h-16 rounded-full bg-surface-container flex items-center justify-center border-2 border-primary-fixed">
                    <span className="material-symbols-outlined text-3xl text-primary">directions_bus</span>
                  </div>
                  <div>
                    <h3 className="text-headline-md font-headline-md text-on-surface">BUS</h3>
                    <p className="text-body-md text-on-surface-variant">30 min • ₹20 • 0.31 kg CO₂/person</p>
                  </div>
                </div>
                <p className="text-label-sm font-label-sm text-secondary bg-surface px-3 py-2 rounded-lg border border-tertiary-fixed-dim inline-block">
                  Taking the bus today can save 1.8 kg CO₂ compared with driving alone.
                </p>
              </div>
            </div>

            {/* Smart Suggestions */}
            <div className="bg-surface-container-lowest rounded-[20px] border border-tertiary-fixed shadow-[0px_4px_20px_rgba(16,32,21,0.04)] p-md">
              <h4 className="text-label-sm font-label-sm text-on-surface-variant uppercase tracking-wider mb-4 flex items-center gap-2">
                <span className="material-symbols-outlined text-sm">lightbulb</span>
                Smart Insights
              </h4>
              <div className="space-y-3">
                <div className="flex items-start gap-3 p-3 rounded-lg hover:bg-surface transition-colors border border-transparent hover:border-tertiary-fixed cursor-pointer">
                  <span className="material-symbols-outlined text-error mt-0.5">warning</span>
                  <div>
                    <p className="font-label-sm text-on-surface">Heavy traffic on MG Road</p>
                    <p className="text-label-xs text-on-surface-variant">Consider taking the Metro line 2 for faster transit.</p>
                  </div>
                </div>
                <div className="flex items-start gap-3 p-3 rounded-lg hover:bg-surface transition-colors border border-transparent hover:border-tertiary-fixed cursor-pointer">
                  <span className="material-symbols-outlined text-secondary mt-0.5">cloud</span>
                  <div>
                    <p className="font-label-sm text-on-surface">Pleasant weather today</p>
                    <p className="text-label-xs text-on-surface-variant">Perfect conditions for cycling to the station.</p>
                  </div>
                </div>
                <div className="flex items-start gap-3 p-3 rounded-lg hover:bg-surface transition-colors border border-transparent hover:border-tertiary-fixed cursor-pointer">
                  <span className="material-symbols-outlined text-primary mt-0.5">group</span>
                  <div>
                    <p className="font-label-sm text-on-surface">Carpool match found</p>
                    <p className="text-label-xs text-on-surface-variant">Anita is heading to Tech Park at 9:00 AM.</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column (Metrics & Charts) */}
        <div className="space-y-lg">
          {/* Impact Metrics Grid */}
          <div className="grid grid-cols-2 gap-sm">
            {/* CO2 Saved */}
            <div className="bg-surface-container-lowest border border-tertiary-fixed rounded-xl p-4 shadow-[0px_4px_20px_rgba(16,32,21,0.04)] flex flex-col items-center justify-center text-center">
              <span className="material-symbols-outlined text-primary mb-2 opacity-80" style={{ fontWeight: 300 }}>co2</span>
              <span className="text-headline-md font-headline-md text-on-surface">12.8 <span className="text-body-md text-on-surface-variant">kg</span></span>
              <span className="text-label-xs font-label-xs text-on-surface-variant uppercase mt-1">CO₂ Saved</span>
            </div>
            {/* Money Saved */}
            <div className="bg-surface-container-lowest border border-tertiary-fixed rounded-xl p-4 shadow-[0px_4px_20px_rgba(16,32,21,0.04)] flex flex-col items-center justify-center text-center">
              <span className="material-symbols-outlined text-primary mb-2 opacity-80" style={{ fontWeight: 300 }}>savings</span>
              <span className="text-headline-md font-headline-md text-on-surface">₹840</span>
              <span className="text-label-xs font-label-xs text-on-surface-variant uppercase mt-1">Money Saved</span>
            </div>
            {/* Trips Optimized */}
            <div className="bg-surface-container-lowest border border-tertiary-fixed rounded-xl p-4 shadow-[0px_4px_20px_rgba(16,32,21,0.04)] flex flex-col items-center justify-center text-center">
              <span className="material-symbols-outlined text-primary mb-2 opacity-80" style={{ fontWeight: 300 }}>moving</span>
              <span className="text-headline-md font-headline-md text-on-surface">18</span>
              <span className="text-label-xs font-label-xs text-on-surface-variant uppercase mt-1">Trips Optimized</span>
            </div>
            {/* Eco Score */}
            <div className="bg-surface-container-lowest border border-tertiary-fixed rounded-xl p-4 shadow-[0px_4px_20px_rgba(16,32,21,0.04)] flex flex-col items-center justify-center text-center relative overflow-hidden">
              <div className="absolute inset-0 bg-secondary-fixed opacity-10"></div>
              <span className="material-symbols-outlined text-secondary-container mb-2 opacity-100" style={{ fontVariationSettings: "'FILL' 1" }}>stars</span>
              <span className="text-headline-md font-headline-md text-on-surface z-10">87</span>
              <span className="text-label-xs font-label-xs text-on-surface-variant uppercase mt-1 z-10">Eco Score</span>
            </div>
          </div>

          {/* Weekly Emissions Chart */}
          <div className="bg-surface-container-lowest rounded-[20px] border border-tertiary-fixed shadow-[0px_4px_20px_rgba(16,32,21,0.04)] p-md">
            <h4 className="text-label-sm font-label-sm text-on-surface-variant uppercase tracking-wider mb-6">Weekly Emissions</h4>
            {/* Pseudo Bar Chart */}
            <div className="flex items-end justify-between h-40 gap-2 mb-4 px-2">
              <div className="flex flex-col items-center gap-2 w-full">
                <div className="w-full bg-surface-variant rounded-t-sm h-[60%] hover:bg-tertiary-fixed-dim transition-colors relative group cursor-pointer">
                  <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-inverse-surface text-inverse-on-surface text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity">12kg</div>
                </div>
                <span className="text-[10px] text-on-surface-variant">M</span>
              </div>
              <div className="flex flex-col items-center gap-2 w-full">
                <div className="w-full bg-surface-variant rounded-t-sm h-[80%] hover:bg-tertiary-fixed-dim transition-colors relative group cursor-pointer">
                  <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-inverse-surface text-inverse-on-surface text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity">16kg</div>
                </div>
                <span className="text-[10px] text-on-surface-variant">T</span>
              </div>
              <div className="flex flex-col items-center gap-2 w-full">
                <div className="w-full bg-primary-container rounded-t-sm h-[40%] hover:bg-primary transition-colors relative group cursor-pointer">
                  <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-inverse-surface text-inverse-on-surface text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity">8kg</div>
                </div>
                <span className="text-[10px] font-bold text-primary">W</span>
              </div>
              <div className="flex flex-col items-center gap-2 w-full">
                <div className="w-full bg-surface-variant rounded-t-sm h-[70%] hover:bg-tertiary-fixed-dim transition-colors relative group cursor-pointer">
                  <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-inverse-surface text-inverse-on-surface text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity">14kg</div>
                </div>
                <span className="text-[10px] text-on-surface-variant">T</span>
              </div>
              <div className="flex flex-col items-center gap-2 w-full">
                <div className="w-full bg-surface-variant rounded-t-sm h-[50%] hover:bg-tertiary-fixed-dim transition-colors relative group cursor-pointer">
                  <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-inverse-surface text-inverse-on-surface text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity">10kg</div>
                </div>
                <span className="text-[10px] text-on-surface-variant">F</span>
              </div>
              <div className="flex flex-col items-center gap-2 w-full">
                <div className="w-full bg-surface-variant rounded-t-sm h-[30%] hover:bg-tertiary-fixed-dim transition-colors relative group cursor-pointer">
                  <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-inverse-surface text-inverse-on-surface text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity">6kg</div>
                </div>
                <span className="text-[10px] text-on-surface-variant">S</span>
              </div>
              <div className="flex flex-col items-center gap-2 w-full">
                <div className="w-full bg-surface-variant rounded-t-sm h-[20%] hover:bg-tertiary-fixed-dim transition-colors relative group cursor-pointer">
                  <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-inverse-surface text-inverse-on-surface text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity">4kg</div>
                </div>
                <span className="text-[10px] text-on-surface-variant">S</span>
              </div>
            </div>
            <div className="flex items-center justify-between text-xs pt-4 border-t border-tertiary-fixed text-on-surface-variant">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-primary-container"></span>
                This Week (Est)
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-surface-variant"></span>
                Last Week
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
