package com.greenmove.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.greenmove.dto.RoutingRequest;
import com.greenmove.dto.RoutingResponse;
import com.greenmove.dto.RoutingResponse.RouteDTO;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.*;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@Service
public class GoogleRoutesService {

    private static final Logger logger = LoggerFactory.getLogger(GoogleRoutesService.class);
    private static final Pattern DURATION_PATTERN = Pattern.compile("^(\\d+)s$");

    @Value("${greenmove.google.routes-api-key:}")
    private String apiKey;

    private final RestTemplate restTemplate;
    private final ObjectMapper objectMapper;

    public GoogleRoutesService() {
        SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout(3000);
        factory.setReadTimeout(3000);
        this.restTemplate = new RestTemplate(factory);
        this.objectMapper = new ObjectMapper();
    }

    public GoogleRoutesService(RestTemplate restTemplate, ObjectMapper objectMapper, String apiKey) {
        this.restTemplate = restTemplate;
        this.objectMapper = objectMapper;
        this.apiKey = apiKey;
    }

    public RoutingResponse computeTrafficRoutes(RoutingRequest req) {
        if (apiKey == null || apiKey.trim().isEmpty()) {
            logger.info("Google Routes API key is not configured. Returning fallback signal.");
            return new RoutingResponse(false, "Google Routes API key is not configured.", null, null);
        }

        // Fail-fast validation 1: Null request or missing origin/destination objects
        if (req == null || req.getOrigin() == null || req.getDestination() == null) {
            logger.warn("Google Routes API request rejected: origin or destination object is missing.");
            return new RoutingResponse(false, "Origin and destination must be set.", null, null);
        }

        // Fail-fast validation 2: Null coordinate values
        Double originLat = req.getOrigin().getLat();
        Double originLng = req.getOrigin().getLng();
        Double destLat = req.getDestination().getLat();
        Double destLng = req.getDestination().getLng();

        if (originLat == null || originLng == null || destLat == null || destLng == null) {
            logger.warn("Google Routes API request rejected: origin or destination lat/lng coordinates are null.");
            return new RoutingResponse(false, "Origin and destination coordinates must be set.", null, null);
        }

        // Fail-fast validation 3: Un-geocoded zero coordinates (0, 0)
        if ((originLat == 0.0 && originLng == 0.0) || (destLat == 0.0 && destLng == 0.0)) {
            logger.warn("Google Routes API request rejected: origin or destination coordinates are 0.0/0.0 (un-geocoded).");
            return new RoutingResponse(false, "Origin and destination coordinates must be valid non-zero locations.", null, null);
        }

        // Fail-fast validation 4: Latitude and longitude range checks
        if (originLat < -90.0 || originLat > 90.0 || destLat < -90.0 || destLat > 90.0 ||
            originLng < -180.0 || originLng > 180.0 || destLng < -180.0 || destLng > 180.0) {
            logger.warn("Google Routes API request rejected: coordinates out of valid range [-90..90, -180..180].");
            return new RoutingResponse(false, "Origin or destination coordinates are out of valid range.", null, null);
        }

        try {
            String url = "https://routes.googleapis.com/directions/v2:computeRoutes";

            Map<String, Object> bodyMap = new HashMap<>();

            Map<String, Object> originLatLng = new HashMap<>();
            originLatLng.put("latitude", originLat);
            originLatLng.put("longitude", originLng);

            Map<String, Object> destLatLng = new HashMap<>();
            destLatLng.put("latitude", destLat);
            destLatLng.put("longitude", destLng);

            Map<String, Object> originMap = Map.of("location", Map.of("latLng", originLatLng));
            Map<String, Object> destMap = Map.of("location", Map.of("latLng", destLatLng));

            bodyMap.put("origin", originMap);
            bodyMap.put("destination", destMap);

            String travelMode = "DRIVE";
            if ("MOTORCYCLE".equalsIgnoreCase(req.getProfile()) || "TWO_WHEELER".equalsIgnoreCase(req.getProfile())) {
                travelMode = "TWO_WHEELER";
            } else if ("CYCLING".equalsIgnoreCase(req.getProfile()) || "BICYCLE".equalsIgnoreCase(req.getProfile())) {
                travelMode = "BICYCLE";
            } else if ("WALKING".equalsIgnoreCase(req.getProfile()) || "WALK".equalsIgnoreCase(req.getProfile())) {
                travelMode = "WALK";
            }
            bodyMap.put("travelMode", travelMode);

            if ("DRIVE".equals(travelMode) || "TWO_WHEELER".equals(travelMode)) {
                bodyMap.put("routingPreference", "TRAFFIC_AWARE");
            }
            bodyMap.put("computeAlternativeRoutes", true);

            if (req.isAvoidTolls()) {
                bodyMap.put("routeModifiers", Map.of("avoidTolls", true));
            }

            // Log exact JSON payload right before sending to Google Routes API
            String requestPayloadJson = objectMapper.writeValueAsString(bodyMap);
            logger.info("Outbound Google Routes API computeRoutes request payload: {}", requestPayloadJson);

            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);
            headers.set("X-Goog-Api-Key", apiKey.trim());
            headers.set("X-Goog-FieldMask", "routes.duration,routes.staticDuration,routes.distanceMeters,routes.polyline.encodedPolyline");

            HttpEntity<Map<String, Object>> entity = new HttpEntity<>(bodyMap, headers);
            ResponseEntity<String> response = restTemplate.exchange(url, HttpMethod.POST, entity, String.class);

            if (!response.getStatusCode().is2xxSuccessful() || response.getBody() == null) {
                logger.warn("Google Routes API returned non-2xx status: {}", response.getStatusCode());
                return new RoutingResponse(false, "Google Routes API returned non-2xx status.", null, null);
            }

            JsonNode root = objectMapper.readTree(response.getBody());
            JsonNode routesNode = root.get("routes");

            if (routesNode == null || !routesNode.isArray() || routesNode.size() == 0) {
                return new RoutingResponse(false, "No routes returned by Google Routes API.", null, null);
            }

            List<RouteDTO> routeList = new ArrayList<>();
            for (int i = 0; i < routesNode.size(); i++) {
                JsonNode rNode = routesNode.get(i);

                Double distanceMeters = rNode.has("distanceMeters") ? rNode.get("distanceMeters").asDouble() : 0.0;
                Double trafficDurationSeconds = parseGoogleDuration(rNode.has("duration") ? rNode.get("duration").asText() : "0s");
                Double staticDurationSeconds = rNode.has("staticDuration") 
                    ? parseGoogleDuration(rNode.get("staticDuration").asText()) 
                    : trafficDurationSeconds;

                Double trafficDelaySeconds = Math.max(0.0, trafficDurationSeconds - staticDurationSeconds);
                boolean trafficAvailable = true;
                String trafficSeverity = deriveTrafficSeverity(trafficDelaySeconds);
                String trafficStatus = deriveTrafficStatus(trafficDelaySeconds);

                Double distanceKmNum = distanceMeters / 1000.0;
                String distanceKm = String.format("%.1f km", distanceKmNum);

                int totalMins = (int) Math.round(trafficDurationSeconds / 60.0);
                String durationMinutes = formatDurationMinutes(totalMins);

                // Log each route's independent traffic metrics
                logger.info("Route [{}] -> Distance: {} km, Static: {}s, Traffic: {}s, Delay: {}s, Severity: {}, Status: {}",
                        i, String.format("%.1f", distanceKmNum), staticDurationSeconds, trafficDurationSeconds,
                        trafficDelaySeconds, trafficSeverity, trafficStatus);

                String encodedPolyline = "";
                if (rNode.has("polyline") && rNode.get("polyline").has("encodedPolyline")) {
                    encodedPolyline = rNode.get("polyline").get("encodedPolyline").asText();
                }

                Map<String, Object> geoJsonGeometry = new HashMap<>();
                geoJsonGeometry.put("type", "LineString");
                geoJsonGeometry.put("encodedPolyline", encodedPolyline);
                geoJsonGeometry.put("coordinates", decodePolyline(encodedPolyline));

                RouteDTO dto = new RouteDTO();
                dto.setId(i == 0 ? "primary" : "alt_" + i);
                dto.setMode(req.getProfile() != null ? req.getProfile() : "DRIVING");
                dto.setGeometry(geoJsonGeometry);
                dto.setDistanceMeters(distanceMeters);
                dto.setDurationSeconds(trafficDurationSeconds);
                dto.setStaticDurationSeconds(staticDurationSeconds);
                dto.setTrafficDurationSeconds(trafficDurationSeconds);
                dto.setTrafficDelaySeconds(trafficDelaySeconds);
                dto.setTrafficAvailable(trafficAvailable);
                dto.setTrafficSeverity(trafficSeverity);
                dto.setTrafficStatus(trafficStatus);
                dto.setDistanceKmNum(distanceKmNum);
                dto.setDistanceKm(distanceKm);
                dto.setDurationMinutes(durationMinutes);

                routeList.add(dto);
            }

            RouteDTO primary = routeList.get(0);
            return new RoutingResponse(true, "Google Routes API traffic calculations successful.", primary, routeList);

        } catch (org.springframework.web.client.HttpStatusCodeException httpEx) {
            logger.error("Google Routes API HTTP error {}: {}", httpEx.getStatusCode(), httpEx.getResponseBodyAsString());
            return new RoutingResponse(false, "Google Routes API error: " + httpEx.getStatusCode(), null, null);
        } catch (Exception e) {
            logger.error("Error executing Google Routes API request: {}", e.getMessage());
            return new RoutingResponse(false, "Traffic routing proxy exception: " + e.getMessage(), null, null);
        }
    }

    private Double parseGoogleDuration(String durationStr) {
        if (durationStr == null) return 0.0;
        Matcher m = DURATION_PATTERN.matcher(durationStr.trim());
        if (m.matches()) {
            return Double.parseDouble(m.group(1));
        }
        return 0.0;
    }

    private String deriveTrafficSeverity(Double delaySeconds) {
        if (delaySeconds == null || delaySeconds <= 180) {
            return "LOW";
        } else if (delaySeconds <= 600) {
            return "MODERATE";
        } else {
            return "HEAVY";
        }
    }

    private String deriveTrafficStatus(Double delaySeconds) {
        if (delaySeconds == null || delaySeconds <= 180) {
            return "No significant delay";
        } else if (delaySeconds <= 600) {
            int mins = (int) Math.round(delaySeconds / 60.0);
            return "Moderate delay (+" + mins + " min delay)";
        } else {
            int mins = (int) Math.round(delaySeconds / 60.0);
            return "Heavy delay (+" + mins + " min delay)";
        }
    }

    private String formatDurationMinutes(int totalMins) {
        if (totalMins >= 60) {
            int hours = totalMins / 60;
            int mins = totalMins % 60;
            return mins > 0 ? hours + " hr " + mins + " min" : hours + " hr";
        }
        return totalMins + " min";
    }

    private List<double[]> decodePolyline(String encoded) {
        List<double[]> poly = new ArrayList<>();
        if (encoded == null || encoded.isEmpty()) return poly;

        try {
            int index = 0, len = encoded.length();
            int lat = 0, lng = 0;

            while (index < len) {
                int b, shift = 0, result = 0;
                do {
                    if (index >= len) break;
                    b = encoded.charAt(index++) - 63;
                    result |= (b & 0x1f) << shift;
                    shift += 5;
                } while (b >= 0x20);
                int dlat = ((result & 1) != 0 ? ~(result >> 1) : (result >> 1));
                lat += dlat;

                shift = 0;
                result = 0;
                do {
                    if (index >= len) break;
                    b = encoded.charAt(index++) - 63;
                    result |= (b & 0x1f) << shift;
                    shift += 5;
                } while (b >= 0x20);
                int dlng = ((result & 1) != 0 ? ~(result >> 1) : (result >> 1));
                lng += dlng;

                double pLat = lat / 1E5;
                double pLng = lng / 1E5;
                poly.add(new double[]{pLng, pLat});
            }
        } catch (Exception e) {
            logger.warn("Failed to decode Google polyline string: {}", e.getMessage());
        }
        return poly;
    }
}
