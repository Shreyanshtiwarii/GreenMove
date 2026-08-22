const apiKey = import.meta.env.VITE_MAPTILER_API_KEY || '';

/**
 * Searches for locations matching the given query using MapTiler's Geocoding API.
 * @param {string} query The location search query.
 * @returns {Promise<Array<{name: string, lng: number, lat: number}>>}
 */
export async function searchLocations(query) {
  if (!query || query.trim().length < 2) return [];
  if (!apiKey) {
    throw new Error("MapTiler API key is not configured.");
  }
  //const url = `https://api.maptiler.com/geocoding/${encodeURIComponent(query)}.json?key=${apiKey}&autocomplete=true&limit=5`;
  const url = `https://api.maptiler.com/geocoding/${encodeURIComponent(query)}.json?key=${apiKey}&autocomplete=true&limit=5&country=in`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error("Unable to search locations");
  }
  const data = await response.json();
  if (!data.features) return [];
  return data.features.map(feat => ({
    name: feat.place_name,
    lng: feat.center[0],
    lat: feat.center[1]
  }));
}

/**
 * Translates longitude/latitude coordinates into a readable place name.
 * @param {number} lng Longitude.
 * @param {number} lat Latitude.
 * @returns {Promise<string>}
 */
export async function reverseGeocode(lng, lat) {
  if (!apiKey) return "Current Location";
  const url = `https://api.maptiler.com/geocoding/${lng},${lat}.json?key=${apiKey}&limit=1`;
  try {
    const response = await fetch(url);
    if (!response.ok) return "Current Location";
    const data = await response.json();
    if (data.features && data.features.length > 0) {
      return data.features[0].place_name;
    }
  } catch (error) {
    console.error("Reverse geocoding error:", error);
  }
  return "Current Location";
}
