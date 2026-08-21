import React, { useEffect, useRef, useState } from 'react';
import * as maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';

// High-reliability keyless basemap style (CartoDB Voyager GL) with OpenStreetMap fallback
const BASEMAP_STYLE = "https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json";

const OSM_FALLBACK_STYLE = {
  version: 8,
  sources: {
    'osm-tiles': {
      type: 'raster',
      tiles: [
        'https://a.tile.openstreetmap.org/{z}/{x}/{y}.png',
        'https://b.tile.openstreetmap.org/{z}/{x}/{y}.png',
        'https://c.tile.openstreetmap.org/{z}/{x}/{y}.png'
      ],
      tileSize: 256,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank">OpenStreetMap</a> contributors'
    }
  },
  layers: [
    {
      id: 'osm-tiles-layer',
      type: 'raster',
      source: 'osm-tiles',
      minzoom: 0,
      maxzoom: 19
    }
  ]
};

// Default center: Bangalore / Indore fallback
const DEFAULT_CENTER = [77.5946, 12.9716];

// fitBounds padding: the bottom results card overlays the map on desktop
// (see PlanRoute.jsx "Bottom Results Overlay", md:absolute md:bottom-5),
// so bounds need extra bottom clearance or the route/destination render
// underneath it. Keep in sync with that card's rendered height.
const FIT_BOUNDS_PADDING = { top: 60, bottom: 260, left: 60, right: 60 };

export default function GreenMoveMap({ origin, destination, route, evStations = [], onRecenterRef }) {
  const mapContainerRef = useRef(null);
  const mapRef = useRef(null);
  
  // Marker references
  const originMarkerRef = useRef(null);
  const destinationMarkerRef = useRef(null);
  const evStationMarkersRef = useRef([]);

  const [mapLoaded, setMapLoaded] = useState(false);
  const [mapError, setMapError] = useState(null);

  // Initialize MapLibre Map
  useEffect(() => {
    if (!mapContainerRef.current) return;
    setMapError(null);

    const map = new maplibregl.Map({
      container: mapContainerRef.current,
      style: OSM_FALLBACK_STYLE,
      center: DEFAULT_CENTER,
      zoom: 12,
    });

    mapRef.current = map;

    const triggerMapReady = () => {
      map.resize();
      setTimeout(() => map?.resize(), 100);
      setTimeout(() => map?.resize(), 500);
      setMapLoaded(true);
      setMapError(null);
    };

    map.on('style.load', () => {
      triggerMapReady();
    });

    // Attach ResizeObserver to automatically handle container dimension changes
    let resizeObserver = null;
    if (typeof ResizeObserver !== 'undefined' && mapContainerRef.current) {
      resizeObserver = new ResizeObserver(() => {
        if (mapRef.current) {
          mapRef.current.resize();
        }
      });
      resizeObserver.observe(mapContainerRef.current);
    }

    map.on('load', () => {
      triggerMapReady();
    });

    // The map is initialized directly on OSM_FALLBACK_STYLE (see `style:` above),
    // so there is no further fallback to switch to. Previously this handler called
    // map.setStyle(OSM_FALLBACK_STYLE) again on any tile error (403s from the public
    // OSM tile servers are common) — even though the style was already OSM_FALLBACK_STYLE.
    // setStyle() reconciles sources/layers against the style JSON regardless of whether
    // the style actually changed, so it silently deleted the route-source/route-layer
    // added via addSource/addLayer. Individual raster tile errors are expected/harmless
    // and must NOT trigger a style reset.
    map.on('error', (e) => {
      console.error("[GreenMoveMap] MapLibre error:", e);
    });

    return () => {
      if (resizeObserver) {
        resizeObserver.disconnect();
      }
      if (originMarkerRef.current) {
        originMarkerRef.current.remove();
        originMarkerRef.current = null;
      }
      if (destinationMarkerRef.current) {
        destinationMarkerRef.current.remove();
        destinationMarkerRef.current = null;
      }
      evStationMarkersRef.current.forEach(m => m.remove());
      evStationMarkersRef.current = [];
      map.remove();
    };
  }, []);

  // Handle Marker & Centering updates dynamically
  useEffect(() => {
    if (!mapLoaded || !mapRef.current) return;
    const map = mapRef.current;

    // 1. Manage Origin Marker
    if (!origin || typeof origin.lng !== 'number' || typeof origin.lat !== 'number') {
      if (originMarkerRef.current) {
        originMarkerRef.current.remove();
        originMarkerRef.current = null;
      }
    } else {
      const coords = [origin.lng, origin.lat];
      if (originMarkerRef.current) {
        originMarkerRef.current.setLngLat(coords);
      } else {
        const originEl = document.createElement('div');
        originEl.className = 'w-6 h-6 rounded-full bg-white border-[3px] border-primary flex items-center justify-center shadow-md';
        const originDot = document.createElement('div');
        originDot.className = 'w-2 h-2 rounded-full bg-primary';
        originEl.appendChild(originDot);

        originMarkerRef.current = new maplibregl.Marker({ element: originEl })
          .setLngLat(coords)
          .addTo(map);
      }
    }

    // 2. Manage Destination Marker
    if (!destination || typeof destination.lng !== 'number' || typeof destination.lat !== 'number') {
      if (destinationMarkerRef.current) {
        destinationMarkerRef.current.remove();
        destinationMarkerRef.current = null;
      }
    } else {
      const coords = [destination.lng, destination.lat];
      if (destinationMarkerRef.current) {
        destinationMarkerRef.current.setLngLat(coords);
      } else {
        const destEl = document.createElement('div');
        destEl.className = 'flex items-center justify-center';
        destEl.innerHTML = `
          <div class="relative drop-shadow-md">
            <span class="material-symbols-outlined text-[36px] text-error" style="font-variation-settings: 'FILL' 1;">location_on</span>
            <div class="absolute top-[7px] left-[12px] w-3 h-3 rounded-full bg-white"></div>
          </div>
        `;

        destinationMarkerRef.current = new maplibregl.Marker({ element: destEl })
          .setLngLat(coords)
          .addTo(map);
      }
    }

    // 3. Manage EV Charging Station Markers
    evStationMarkersRef.current.forEach(m => m.remove());
    evStationMarkersRef.current = [];

    if (Array.isArray(evStations) && evStations.length > 0) {
      evStations.forEach(st => {
        if (typeof st.longitude === 'number' && typeof st.latitude === 'number') {
          const evEl = document.createElement('div');
          evEl.className = 'w-8 h-8 rounded-full bg-emerald-600 border-2 border-white text-white flex items-center justify-center shadow-lg cursor-pointer hover:scale-110 transition-transform';
          evEl.innerHTML = `<span class="material-symbols-outlined text-sm">ev_station</span>`;

          const connSummary = Array.isArray(st.connectors) && st.connectors.length > 0
            ? st.connectors.map(c => `${c.powerKw || 22} kW (${c.connectorType || 'Plug'})`).join(', ')
            : 'Fast Charging Available';

          const popupContent = `
            <div style="font-family: system-ui, sans-serif; padding: 4px; max-width: 220px;">
              <div style="font-weight: bold; font-size: 13px; color: #004100; margin-bottom: 4px;">${st.name}</div>
              <div style="font-size: 11px; color: #4b5563; margin-bottom: 6px;">${st.address || st.city}</div>
              <div style="font-size: 11px; font-weight: 600; color: #059669; margin-bottom: 4px;">⚡ ${st.distanceFromRouteKm ? `${st.distanceFromRouteKm} km from route` : 'Along route'}</div>
              <div style="font-size: 10px; color: #6b7280; margin-bottom: 6px;">${connSummary}</div>
              <div style="font-size: 9px; color: #9ca3af; border-top: 1px solid #e5e7eb; pt: 4px; mt: 4px;">${st.attribution || 'Data provided by Open Charge Map'}</div>
            </div>
          `;

          const popup = new maplibregl.Popup({ offset: 15 }).setHTML(popupContent);

          const marker = new maplibregl.Marker({ element: evEl })
            .setLngLat([st.longitude, st.latitude])
            .setPopup(popup)
            .addTo(map);

          evStationMarkersRef.current.push(marker);
        }
      });
    }

    // 4. Manage Route Polyline Layers
    const sourceId = 'route-source';
    const layerId = 'route-layer';
    const outlineLayerId = 'route-outline-layer';

    const getTrafficLineColor = (r) => {
      if (!r) return '#004100';
      if (r.mode === 'CYCLING') return '#059669';
      if (r.mode === 'WALKING') return '#2563EB';

      if (r.mode === 'DRIVING' && r.trafficAvailable) {
        const severity = r.trafficSeverity || (
          r.trafficDelaySeconds > 600 ? 'HEAVY' :
          r.trafficDelaySeconds > 180 ? 'MODERATE' : 'LOW'
        );

        if (severity === 'HEAVY') return '#EF4444';      // Heavy Traffic - Red
        if (severity === 'MODERATE') return '#F59E0B';   // Moderate Traffic - Orange
        if (severity === 'LOW') return '#10B981';        // Low Traffic - Green
      }
      return '#004100'; // Standard route green line when traffic is unconfigured/unavailable
    };

    if (!route || !route.geometry) {
      console.log("[GreenMoveMap] Route prop is empty or missing geometry.");
      if (map.getLayer(layerId)) map.removeLayer(layerId);
      if (map.getLayer(outlineLayerId)) map.removeLayer(outlineLayerId);
      if (map.getSource(sourceId)) map.removeSource(sourceId);
    } else {
      const coords = route.geometry.coordinates || [];
      console.log(`[GreenMoveMap] Route received. Mode: ${route.mode}, Coords Count: ${coords.length}`);
      if (coords.length > 0) {
        console.log(`[GreenMoveMap] First coord:`, coords[0], `Last coord:`, coords[coords.length - 1]);
      }

      const geojsonSourceData = {
        type: 'Feature',
        properties: {},
        geometry: route.geometry
      };

      const lineColor = getTrafficLineColor(route);
      const existingSource = map.getSource(sourceId);

      if (existingSource) {
        console.log("[GreenMoveMap] Updating existing route-source GeoJSON data.");
        existingSource.setData(geojsonSourceData);
        if (map.getLayer(layerId)) {
          map.setPaintProperty(layerId, 'line-color', lineColor);
        }
      } else {
        console.log("[GreenMoveMap] Adding new route-source & layers to MapLibre.");
        map.addSource(sourceId, {
          type: 'geojson',
          data: geojsonSourceData
        });

        // Add subtle casing outline
        map.addLayer({
          id: outlineLayerId,
          type: 'line',
          source: sourceId,
          layout: {
            'line-join': 'round',
            'line-cap': 'round',
            'visibility': 'visible'
          },
          paint: {
            'line-color': '#FFFFFF',
            'line-width': 8
          }
        });

        // Add primary route vector line
        map.addLayer({
          id: layerId,
          type: 'line',
          source: sourceId,
          layout: {
            'line-join': 'round',
            'line-cap': 'round',
            'visibility': 'visible'
          },
          paint: {
            'line-color': lineColor,
            'line-width': 6
          }
        });
      }
    }

    // 5. Fit Bounds / Centering Behavior
    if (route && route.geometry && Array.isArray(route.geometry.coordinates) && route.geometry.coordinates.length > 0) {
      const coords = route.geometry.coordinates;
      const bounds = new maplibregl.LngLatBounds();
      coords.forEach(coord => {
        if (Array.isArray(coord) && coord.length >= 2 && typeof coord[0] === 'number' && typeof coord[1] === 'number') {
          bounds.extend(coord);
        }
      });

      if (!bounds.isEmpty()) {
        console.log("[GreenMoveMap] Executing map.fitBounds with bounds:", bounds.toString());
        map.fitBounds(bounds, { padding: FIT_BOUNDS_PADDING, duration: 1000 });
      } else {
        console.warn("[GreenMoveMap] Bounds object is empty after iteration.");
      }
    } else {
      console.log("[GreenMoveMap] No route geometry for fitBounds. Checking origin/dest markers.");
      const hasOrigin = origin && typeof origin.lng === 'number' && typeof origin.lat === 'number';
      const hasDest = destination && typeof destination.lng === 'number' && typeof destination.lat === 'number';

      if (hasOrigin && hasDest) {
        const bounds = new maplibregl.LngLatBounds()
          .extend([origin.lng, origin.lat])
          .extend([destination.lng, destination.lat]);
        console.log("[GreenMoveMap] Fitting bounds to Origin & Destination markers.");
        map.fitBounds(bounds, { padding: FIT_BOUNDS_PADDING, duration: 1000 });
      } else if (hasOrigin) {
        map.flyTo({ center: [origin.lng, origin.lat], zoom: 14, duration: 1000 });
      } else if (hasDest) {
        map.flyTo({ center: [destination.lng, destination.lat], zoom: 14, duration: 1000 });
      }
    }
  }, [mapLoaded, origin, destination, route, evStations]);

  // Wire recenter triggers to the parent
  useEffect(() => {
    if (onRecenterRef) {
      onRecenterRef.current = handleRecenterMap;
    }
  }, [onRecenterRef, origin, destination, route, mapLoaded]);

  const handleZoomIn = () => {
    mapRef.current?.zoomIn();
  };

  const handleZoomOut = () => {
    mapRef.current?.zoomOut();
  };

  const handleRecenterMap = () => {
    if (!mapRef.current || !mapLoaded) return;
    const map = mapRef.current;
    
    if (route && route.geometry && route.geometry.coordinates) {
      const coords = route.geometry.coordinates;
      const bounds = new maplibregl.LngLatBounds();
      coords.forEach(coord => bounds.extend(coord));
      map.fitBounds(bounds, { padding: FIT_BOUNDS_PADDING, duration: 1000 });
      return;
    }
    
    const hasOrigin = origin && typeof origin.lng === 'number' && typeof origin.lat === 'number';
    const hasDest = destination && typeof destination.lng === 'number' && typeof destination.lat === 'number';

    if (hasOrigin && hasDest) {
      const bounds = new maplibregl.LngLatBounds()
        .extend([origin.lng, origin.lat])
        .extend([destination.lng, destination.lat]);
      map.fitBounds(bounds, { padding: FIT_BOUNDS_PADDING, duration: 1000 });
    } else if (hasOrigin) {
      map.flyTo({ center: [origin.lng, origin.lat], zoom: 14, duration: 1000 });
    } else if (hasDest) {
      map.flyTo({ center: [destination.lng, destination.lat], zoom: 14, duration: 1000 });
    } else {
      map.flyTo({ center: DEFAULT_CENTER, zoom: 12, duration: 1000 });
    }
  };

  const handleGeolocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { longitude, latitude } = position.coords;
          mapRef.current?.flyTo({
            center: [longitude, latitude],
            zoom: 14,
            essential: true
          });
        },
        (error) => {
          console.error("Geolocation request failed:", error);
          alert("Unable to retrieve location. Please check browser permissions.");
        }
      );
    } else {
      alert("Geolocation is not supported by your browser.");
    }
  };

  return (
    <div className="absolute inset-0">
      <div ref={mapContainerRef} className="w-full h-full rounded-[24px] overflow-hidden" />

      {/* Traffic Legend Overlay */}
      {route && route.mode === 'DRIVING' && route.trafficAvailable && (
        <div className="absolute top-4 left-4 z-20 bg-white/90 backdrop-blur-sm border border-tertiary-fixed rounded-xl p-3 shadow-md text-label-xs font-label-xs flex flex-col gap-1.5 min-w-[130px]">
          <div className="flex items-center justify-between text-on-surface font-semibold border-b border-outline-variant/30 pb-1">
            <span>Traffic Status</span>
            <span className="material-symbols-outlined text-[14px] text-primary">traffic</span>
          </div>
          <div className="flex items-center gap-2 text-on-surface-variant">
            <span className="w-2.5 h-2.5 rounded-full bg-[#10B981] inline-block shadow-sm"></span>
            <span>Low Traffic</span>
          </div>
          <div className="flex items-center gap-2 text-on-surface-variant">
            <span className="w-2.5 h-2.5 rounded-full bg-[#F59E0B] inline-block shadow-sm"></span>
            <span>Moderate Traffic</span>
          </div>
          <div className="flex items-center gap-2 text-on-surface-variant">
            <span className="w-2.5 h-2.5 rounded-full bg-[#EF4444] inline-block shadow-sm"></span>
            <span>Heavy Traffic</span>
          </div>
        </div>
      )}

      {mapError && (
        <div className="absolute top-4 left-4 z-30 bg-white border border-error text-error p-3 rounded-lg flex items-center gap-2 max-w-md shadow-md text-label-xs font-label-xs">
          <span className="material-symbols-outlined text-base text-error">warning</span>
          <span>{mapError}</span>
        </div>
      )}

      {/* Floating Map Controls */}
      <div className="absolute right-4 top-4 flex flex-col gap-2 z-20">
        <button 
          onClick={handleGeolocation}
          title="Recenter to Current Location"
          className="w-10 h-10 bg-white rounded-lg shadow-sm border border-tertiary-fixed flex items-center justify-center text-on-surface-variant hover:text-primary transition-colors cursor-pointer"
        >
          <span className="material-symbols-outlined">my_location</span>
        </button>
        <button 
          onClick={handleRecenterMap}
          title="Recenter Route Map"
          className="w-10 h-10 bg-white rounded-lg shadow-sm border border-tertiary-fixed flex items-center justify-center text-on-surface-variant hover:text-primary transition-colors cursor-pointer"
        >
          <span className="material-symbols-outlined">home</span>
        </button>
        <button 
          onClick={handleZoomIn}
          title="Zoom In"
          className="w-10 h-10 bg-white rounded-lg shadow-sm border border-tertiary-fixed flex items-center justify-center text-on-surface-variant hover:text-primary transition-colors cursor-pointer"
        >
          <span className="material-symbols-outlined">add</span>
        </button>
        <button 
          onClick={handleZoomOut}
          title="Zoom Out"
          className="w-10 h-10 bg-white rounded-lg shadow-sm border border-tertiary-fixed flex items-center justify-center text-on-surface-variant hover:text-primary transition-colors cursor-pointer"
        >
          <span className="material-symbols-outlined">remove</span>
        </button>
      </div>
    </div>
  );
}
