package com.greenmove.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.greenmove.dto.RoutingRequest;
import com.greenmove.dto.RoutingRequest.Coordinate;
import com.greenmove.dto.RoutingResponse;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestTemplate;

import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

class GoogleRoutesServiceTest {

    private ObjectMapper objectMapper;

    static class FakeRestTemplate extends RestTemplate {
        String responseBody;
        HttpStatus status;
        String capturedUrl;
        HttpEntity<?> capturedEntity;
        boolean callMade = false;

        FakeRestTemplate(String responseBody, HttpStatus status) {
            this.responseBody = responseBody;
            this.status = status;
        }

        @Override
        @SuppressWarnings("unchecked")
        public <T> ResponseEntity<T> exchange(String url, HttpMethod method, HttpEntity<?> requestEntity, Class<T> responseType, Object... uriVariables) throws RestClientException {
            this.callMade = true;
            this.capturedUrl = url;
            this.capturedEntity = requestEntity;
            return new ResponseEntity<>((T) responseBody, status);
        }
    }

    @BeforeEach
    void setUp() {
        objectMapper = new ObjectMapper();
    }

    @Test
    @DisplayName("Should fail fast when request is null without calling external RestTemplate")
    void testComputeTrafficRoutes_nullRequest_failsFast() {
        FakeRestTemplate fakeRestTemplate = new FakeRestTemplate("", HttpStatus.OK);
        GoogleRoutesService service = new GoogleRoutesService(fakeRestTemplate, objectMapper, "test-api-key");

        RoutingResponse response = service.computeTrafficRoutes(null);

        assertNotNull(response);
        assertFalse(response.isSuccess());
        assertEquals("Origin and destination must be set.", response.getMessage());
        assertFalse(fakeRestTemplate.callMade, "RestTemplate should not have been called for null request");
    }

    @Test
    @DisplayName("Should fail fast when origin or destination object is null")
    void testComputeTrafficRoutes_missingOrigin_failsFast() {
        FakeRestTemplate fakeRestTemplate = new FakeRestTemplate("", HttpStatus.OK);
        GoogleRoutesService service = new GoogleRoutesService(fakeRestTemplate, objectMapper, "test-api-key");

        RoutingRequest request = new RoutingRequest();
        request.setDestination(new Coordinate(22.6323, 75.8038));

        RoutingResponse response = service.computeTrafficRoutes(request);

        assertNotNull(response);
        assertFalse(response.isSuccess());
        assertEquals("Origin and destination must be set.", response.getMessage());
        assertFalse(fakeRestTemplate.callMade, "RestTemplate should not have been called for missing origin");
    }

    @Test
    @DisplayName("Should fail fast when coordinate lat/lng values are null")
    void testComputeTrafficRoutes_nullCoordinateValues_failsFast() {
        FakeRestTemplate fakeRestTemplate = new FakeRestTemplate("", HttpStatus.OK);
        GoogleRoutesService service = new GoogleRoutesService(fakeRestTemplate, objectMapper, "test-api-key");

        RoutingRequest request = new RoutingRequest();
        request.setOrigin(new Coordinate(null, 75.8937));
        request.setDestination(new Coordinate(22.6323, 75.8038));

        RoutingResponse response = service.computeTrafficRoutes(request);

        assertNotNull(response);
        assertFalse(response.isSuccess());
        assertEquals("Origin and destination coordinates must be set.", response.getMessage());
        assertFalse(fakeRestTemplate.callMade, "RestTemplate should not have been called for null coordinate values");
    }

    @Test
    @DisplayName("Should fail fast when coordinates are un-geocoded zeros (0.0, 0.0)")
    void testComputeTrafficRoutes_zeroCoordinates_failsFast() {
        FakeRestTemplate fakeRestTemplate = new FakeRestTemplate("", HttpStatus.OK);
        GoogleRoutesService service = new GoogleRoutesService(fakeRestTemplate, objectMapper, "test-api-key");

        RoutingRequest request = new RoutingRequest();
        request.setOrigin(new Coordinate(0.0, 0.0));
        request.setDestination(new Coordinate(22.6323, 75.8038));

        RoutingResponse response = service.computeTrafficRoutes(request);

        assertNotNull(response);
        assertFalse(response.isSuccess());
        assertEquals("Origin and destination coordinates must be valid non-zero locations.", response.getMessage());
        assertFalse(fakeRestTemplate.callMade, "RestTemplate should not have been called for zero coordinates");
    }

    @Test
    @DisplayName("Should build correct Google Routes v2 payload with origin/destination waypoints when valid")
    @SuppressWarnings("unchecked")
    void testComputeTrafficRoutes_validCoordinates_buildsCorrectPayload() {
        String mockResponseBody = """
            {
              "routes": [
                {
                  "distanceMeters": 15000,
                  "duration": "900s",
                  "staticDuration": "900s",
                  "polyline": { "encodedPolyline": "mockPolyline" }
                }
              ]
            }
            """;

        FakeRestTemplate fakeRestTemplate = new FakeRestTemplate(mockResponseBody, HttpStatus.OK);
        GoogleRoutesService service = new GoogleRoutesService(fakeRestTemplate, objectMapper, "test-api-key");

        RoutingRequest request = new RoutingRequest();
        request.setOrigin(new Coordinate(22.7533, 75.8937));
        request.setDestination(new Coordinate(22.6323, 75.8038));
        request.setProfile("DRIVING");
        request.setAvoidTolls(true);

        RoutingResponse response = service.computeTrafficRoutes(request);

        assertNotNull(response);
        assertTrue(response.isSuccess(), "Response should be success, message: " + response.getMessage());
        assertNotNull(response.getPrimaryRoute());
        assertEquals("primary", response.getPrimaryRoute().getId());

        assertTrue(fakeRestTemplate.callMade);
        assertEquals("https://routes.googleapis.com/directions/v2:computeRoutes", fakeRestTemplate.capturedUrl);

        HttpEntity<Map<String, Object>> entity = (HttpEntity<Map<String, Object>>) fakeRestTemplate.capturedEntity;
        Map<String, Object> bodyMap = entity.getBody();
        assertNotNull(bodyMap);

        // Verify Google Routes v2 Schema origin & destination
        assertTrue(bodyMap.containsKey("origin"), "Request body must contain 'origin' field");
        assertTrue(bodyMap.containsKey("destination"), "Request body must contain 'destination' field");

        Map<String, Object> origin = (Map<String, Object>) bodyMap.get("origin");
        Map<String, Object> destination = (Map<String, Object>) bodyMap.get("destination");

        assertNotNull(origin.get("location"), "Origin must contain 'location'");
        assertNotNull(destination.get("location"), "Destination must contain 'location'");

        Map<String, Object> originLocation = (Map<String, Object>) origin.get("location");
        Map<String, Object> originLatLng = (Map<String, Object>) originLocation.get("latLng");

        assertEquals(22.7533, originLatLng.get("latitude"));
        assertEquals(75.8937, originLatLng.get("longitude"));

        Map<String, Object> destLocation = (Map<String, Object>) destination.get("location");
        Map<String, Object> destLatLng = (Map<String, Object>) destLocation.get("latLng");

        assertEquals(22.6323, destLatLng.get("latitude"));
        assertEquals(75.8038, destLatLng.get("longitude"));

        assertEquals("DRIVE", bodyMap.get("travelMode"));
        assertEquals("TRAFFIC_AWARE", bodyMap.get("routingPreference"));
    }
}
