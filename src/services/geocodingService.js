/**
 * Searches for locations matching the given query using keyless OpenStreetMap / OpenRouteService Geocoding.
 * @param {string} query The location search query.
 * @returns {Promise<Array<{name: string, lng: number, lat: number}>>}
 */
export async function searchLocations(query) {
  if (!query || query.trim().length < 2) return [];
  const orsKey = import.meta.env.VITE_OPENROUTESERVICE_API_KEY || '';

  if (orsKey) {
    try {
      const url = `https://api.openrouteservice.org/geocode/search?api_key=${orsKey}&text=${encodeURIComponent(query)}&size=5`;
      const response = await fetch(url);
      if (response.ok) {
        const data = await response.json();
        if (data.features && data.features.length > 0) {
          return data.features.map(feat => ({
            name: feat.properties.label || feat.properties.name,
            lng: feat.geometry.coordinates[0],
            lat: feat.geometry.coordinates[1]
          }));
        }
      }
    } catch (e) {
      console.warn("ORS Geocoding fallback to Photon:", e);
    }
  }

  // Keyless OpenStreetMap Photon geocoding API
  const url = `https://photon.komoot.io/api/?q=${encodeURIComponent(query)}&limit=5`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error("Unable to search locations");
  }
  const data = await response.json();
  if (!data.features) return [];
  return data.features.map(feat => {
    const p = feat.properties;
    const nameParts = [p.name, p.street, p.city || p.town || p.district, p.state, p.country].filter(Boolean);
    return {
      name: nameParts.join(', '),
      lng: feat.geometry.coordinates[0],
      lat: feat.geometry.coordinates[1]
    };
  });
}

/**
 * Translates longitude/latitude coordinates into a readable place name using keyless OpenStreetMap geocoding.
 * @param {number} lng Longitude.
 * @param {number} lat Latitude.
 * @returns {Promise<string>}
 */
export async function reverseGeocode(lng, lat) {
  try {
    const url = `https://photon.komoot.io/api/?q=${lat},${lng}&limit=1`;
    const response = await fetch(url);
    if (!response.ok) return "Current Location";
    const data = await response.json();
    if (data.features && data.features.length > 0) {
      const p = data.features[0].properties;
      const nameParts = [p.name, p.city || p.town || p.district, p.state].filter(Boolean);
      return nameParts.length > 0 ? nameParts.join(', ') : "Current Location";
    }
  } catch (error) {
    console.error("Reverse geocoding error:", error);
  }
  return "Current Location";
}
