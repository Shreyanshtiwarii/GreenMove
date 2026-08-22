package com.greenmove.service;

import com.greenmove.dto.RoutingRequest;
import com.greenmove.dto.RoutingResponse;
import com.greenmove.dto.RoutingResponse.RouteDTO;
import com.greenmove.dto.VehiclePoolDTOs.CreatePoolRequest;
import com.greenmove.dto.VehiclePoolDTOs.PoolResponse;
import com.greenmove.entity.UserEntity;
import com.greenmove.entity.VehiclePoolEntity;
import com.greenmove.repository.UserRepository;
import com.greenmove.repository.VehiclePoolMemberRepository;
import com.greenmove.repository.VehiclePoolRepository;
import com.greenmove.repository.VehiclePoolRepository.SpatialCandidateProjection;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.locationtech.jts.geom.Coordinate;
import org.locationtech.jts.geom.GeometryFactory;
import org.locationtech.jts.geom.LineString;
import org.locationtech.jts.geom.Point;
import org.locationtech.jts.geom.PrecisionModel;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class VehiclePoolServiceTest {

    private static final GeometryFactory GF = new GeometryFactory(new PrecisionModel(), 4326);

    @Mock private VehiclePoolRepository poolRepository;
    @Mock private VehiclePoolMemberRepository memberRepository;
    @Mock private UserRepository userRepository;
    @Mock private GoogleRoutesService googleRoutesService;
    @Mock private javax.sql.DataSource dataSource;

    @InjectMocks
    private VehiclePoolService vehiclePoolService;

    private UserEntity testUser;

    @BeforeEach
    void setUp() throws Exception {
        testUser = new UserEntity();
        testUser.setId("user_123");
        testUser.setName("Test Driver");
        testUser.setEmail("driver@test.com");

        // Stub mocked DataSource to simulate an H2 database environment for fallback tests
        java.sql.Connection mockConnection = mock(java.sql.Connection.class);
        java.sql.DatabaseMetaData mockMetaData = mock(java.sql.DatabaseMetaData.class);
        when(dataSource.getConnection()).thenReturn(mockConnection);
        when(mockConnection.getMetaData()).thenReturn(mockMetaData);
        when(mockMetaData.getDatabaseProductName()).thenReturn("H2");

        // Inject @Value properties using ReflectionTestUtils
        org.springframework.test.util.ReflectionTestUtils.setField(vehiclePoolService, "maxDetourDistanceMeters", 3000.0);
        org.springframework.test.util.ReflectionTestUtils.setField(vehiclePoolService, "maxDetourPercentage", 20.0);
        org.springframework.test.util.ReflectionTestUtils.setField(vehiclePoolService, "minRouteOverlapPercentage", 50.0);
        org.springframework.test.util.ReflectionTestUtils.setField(vehiclePoolService, "routeOverlapToleranceMeters", 100.0);
        org.springframework.test.util.ReflectionTestUtils.setField(vehiclePoolService, "maxDetourCandidates", 10);
        
        // Phase 6 weights
        org.springframework.test.util.ReflectionTestUtils.setField(vehiclePoolService, "overlapWeight", 0.35);
        org.springframework.test.util.ReflectionTestUtils.setField(vehiclePoolService, "pickupWeight", 0.20);
        org.springframework.test.util.ReflectionTestUtils.setField(vehiclePoolService, "dropoffWeight", 0.15);
        org.springframework.test.util.ReflectionTestUtils.setField(vehiclePoolService, "detourWeight", 0.15);
        org.springframework.test.util.ReflectionTestUtils.setField(vehiclePoolService, "timeWeight", 0.15);
        org.springframework.test.util.ReflectionTestUtils.setField(vehiclePoolService, "maxDepartureTimeDifferenceMinutes", 30.0);

        // Mock routing for Phase 5 tests
        com.greenmove.dto.RoutingResponse.RouteDTO mockRoute = new com.greenmove.dto.RoutingResponse.RouteDTO();
        mockRoute.setDistanceMeters(1000.0);
        mockRoute.setDurationSeconds(120.0);
        java.util.Map<String, Object> geom = new java.util.HashMap<>();
        geom.put("coordinates", java.util.List.of(
            new double[]{75.8650, 22.7300}, 
            new double[]{75.8839, 22.7244},
            new double[]{75.8570, 22.7196}
        ));
        mockRoute.setGeometry(geom);
        com.greenmove.dto.RoutingResponse mockRouteResp = new com.greenmove.dto.RoutingResponse(true, "Mock", mockRoute, java.util.List.of(mockRoute));
        when(googleRoutesService.computeTrafficRoutes(any())).thenReturn(mockRouteResp);
    }

    // =========================================================================
    //  Helpers
    // =========================================================================

    private CreatePoolRequest createValidRequest() {
        CreatePoolRequest req = new CreatePoolRequest();
        req.setStartLocation("Palasia Square, Indore");
        req.setStartLatitude(22.7244);
        req.setStartLongitude(75.8839);
        req.setDestination("Vijay Nagar, Indore");
        req.setDestinationLatitude(22.7533);
        req.setDestinationLongitude(75.8937);
        req.setDepartureTime(LocalDateTime.now().plusHours(2));
        req.setTotalSeats(3);
        req.setCostPerPassenger(50.0);
        return req;
    }

    private RouteDTO createMockRouteDTO(double distanceMeters, double durationSeconds) {
        RouteDTO dto = new RouteDTO();
        dto.setDistanceMeters(distanceMeters);
        dto.setDurationSeconds(durationSeconds);
        dto.setStaticDurationSeconds(durationSeconds);
        dto.setTrafficDurationSeconds(durationSeconds);
        // Coordinates in [longitude, latitude] format
        List<double[]> coords = List.of(
                new double[]{75.8839, 22.7244},
                new double[]{75.8890, 22.7400},
                new double[]{75.8937, 22.7533}
        );
        dto.setGeometry(Map.of("type", "LineString", "coordinates", coords));
        return dto;
    }

    /** Build a minimal VehiclePoolEntity with a route LineString and future departure. */
    private VehiclePoolEntity activePool(String id, double startLat, double startLng,
                                         double destLat, double destLng,
                                         LineString routeGeom) {
        VehiclePoolEntity e = new VehiclePoolEntity();
        e.setId(id);
        e.setCreatorId("driver_1");
        e.setCreatorName("Driver One");
        e.setStartLocation("Bijasanagar, Indore");
        e.setStartLat(startLat);
        e.setStartLng(startLng);
        e.setStartGeom(VehiclePoolService.createPoint(startLat, startLng));
        e.setDestination("Rajwada, Indore");
        e.setDestinationLat(destLat);
        e.setDestinationLng(destLng);
        e.setDestinationGeom(VehiclePoolService.createPoint(destLat, destLng));
        e.setRouteGeom(routeGeom);
        e.setRouteDistanceMeters(7500.0);
        e.setRouteDurationSeconds(900);
        e.setDepartureTime(LocalDateTime.now().plusHours(3));
        e.setTotalSeats(4);
        e.setAvailableSeats(3);
        e.setCostPerPassenger(40.0);
        e.setTotalCost(160.0);
        e.setStatus("ACTIVE");
        e.setCreatedAt(LocalDateTime.now());
        return e;
    }

    private LineString sampleRouteLineString() {
        // Bijasanagar → (via Palasia) → Rajwada  (simplified 3-point polyline)
        Coordinate[] coords = {
                new Coordinate(75.8650, 22.7300), // Bijasanagar (approx lng,lat)
                new Coordinate(75.8839, 22.7244), // near Palasia
                new Coordinate(75.8570, 22.7196)  // Rajwada (approx)
        };
        LineString ls = GF.createLineString(coords);
        ls.setSRID(4326);
        return ls;
    }

    /** Stub projection returned by the repository spatial query. */
    private SpatialCandidateProjection projection(String poolId, double pickup, double dropoff) {
        return projection(poolId, pickup, dropoff, 0.2, 0.8); // Defaults for existing Phase 3 tests
    }

    private SpatialCandidateProjection projection(String poolId, double pickupDist, double dropoffDist, Double pickupPos, Double dropoffPos) {
        return new SpatialCandidateProjection() {
            @Override public String getPoolId() { return poolId; }
            @Override public Double getPickupDistanceMeters() { return pickupDist; }
            @Override public Double getDropoffDistanceMeters() { return dropoffDist; }
            @Override public Double getPickupRoutePosition() { return pickupPos; }
            @Override public Double getDropoffRoutePosition() { return dropoffPos; }
        };
    }

    // =========================================================================
    //  Phase 2 — createPool tests
    // =========================================================================

    @Test
    @DisplayName("createPool with valid coordinates and successful road routing creates pool with Point and LineString SRID 4326 geometries")
    void testCreatePool_SuccessfulRoadRouting() {
        when(userRepository.findById("user_123")).thenReturn(Optional.of(testUser));
        when(poolRepository.save(any(VehiclePoolEntity.class))).thenAnswer(i -> i.getArgument(0));
        RouteDTO mockRoute = createMockRouteDTO(5200.0, 720.0);
        when(googleRoutesService.computeTrafficRoutes(any(RoutingRequest.class)))
                .thenReturn(new RoutingResponse(true, "Success", mockRoute, List.of(mockRoute)));

        PoolResponse response = vehiclePoolService.createPool("user_123", createValidRequest());

        assertNotNull(response);
        assertEquals(5200.0, response.getRouteDistanceMeters());
        assertEquals(720, response.getRouteDurationSeconds());

        ArgumentCaptor<VehiclePoolEntity> captor = ArgumentCaptor.forClass(VehiclePoolEntity.class);
        verify(poolRepository).save(captor.capture());
        VehiclePoolEntity saved = captor.getValue();

        assertNotNull(saved.getRouteGeom());
        assertEquals(4326, saved.getRouteGeom().getSRID());
        assertEquals(3, saved.getRouteGeom().getNumPoints());
        // Start point: X = longitude
        assertEquals(75.8839, saved.getStartGeom().getX(), 0.00001);
        assertEquals(22.7244, saved.getStartGeom().getY(), 0.00001);
    }

    @Test
    @DisplayName("createPoint helper creates SRID 4326 Point with longitude=X, latitude=Y")
    void testCreatePoint_Helper() {
        Point p = VehiclePoolService.createPoint(22.7244, 75.8839);
        assertNotNull(p);
        assertEquals(4326, p.getSRID());
        assertEquals(75.8839, p.getX(), 0.00001);
        assertEquals(22.7244, p.getY(), 0.00001);
    }

    @Test
    @DisplayName("createPool when routing service throws exception fails creation and saves no pool")
    void testCreatePool_RoutingServiceException() {
        when(userRepository.findById("user_123")).thenReturn(Optional.of(testUser));
        when(googleRoutesService.computeTrafficRoutes(any()))
                .thenThrow(new RuntimeException("Connection timeout"));

        VehiclePoolService.PoolException ex = assertThrows(
                VehiclePoolService.PoolException.class,
                () -> vehiclePoolService.createPool("user_123", createValidRequest()));
        assertEquals(400, ex.getStatus());
        assertTrue(ex.getMessage().contains("Unable to calculate driver road route"));
        verify(poolRepository, never()).save(any());
    }

    @Test
    @DisplayName("createPool with invalid latitude > 90 throws 400 without calling routing service")
    void testCreatePool_InvalidLatitude_High() {
        when(userRepository.findById("user_123")).thenReturn(Optional.of(testUser));
        CreatePoolRequest req = createValidRequest();
        req.setStartLatitude(91.0);
        VehiclePoolService.PoolException ex = assertThrows(
                VehiclePoolService.PoolException.class,
                () -> vehiclePoolService.createPool("user_123", req));
        assertEquals(400, ex.getStatus());
        verify(googleRoutesService, never()).computeTrafficRoutes(any());
    }

    @Test
    @DisplayName("createPool when route distance is zero fails creation and saves no pool")
    void testCreatePool_InvalidRouteDistance() {
        when(userRepository.findById("user_123")).thenReturn(Optional.of(testUser));
        RouteDTO r = createMockRouteDTO(0.0, 300.0);
        when(googleRoutesService.computeTrafficRoutes(any()))
                .thenReturn(new RoutingResponse(true, "Success", r, List.of(r)));
        VehiclePoolService.PoolException ex = assertThrows(
                VehiclePoolService.PoolException.class,
                () -> vehiclePoolService.createPool("user_123", createValidRequest()));
        assertEquals(400, ex.getStatus());
        assertTrue(ex.getMessage().contains("non-positive distance"));
        verify(poolRepository, never()).save(any());
    }

    @Test
    @DisplayName("createPool when route duration is negative fails creation and saves no pool")
    void testCreatePool_InvalidRouteDuration() {
        when(userRepository.findById("user_123")).thenReturn(Optional.of(testUser));
        RouteDTO r = createMockRouteDTO(5000.0, -10.0);
        when(googleRoutesService.computeTrafficRoutes(any()))
                .thenReturn(new RoutingResponse(true, "Success", r, List.of(r)));
        VehiclePoolService.PoolException ex = assertThrows(
                VehiclePoolService.PoolException.class,
                () -> vehiclePoolService.createPool("user_123", createValidRequest()));
        assertEquals(400, ex.getStatus());
        assertTrue(ex.getMessage().contains("non-positive duration"));
        verify(poolRepository, never()).save(any());
    }

    @Test
    @DisplayName("createPool when geometry has fewer than 2 points fails creation")
    void testCreatePool_IncompleteRouteGeometry() {
        when(userRepository.findById("user_123")).thenReturn(Optional.of(testUser));
        RouteDTO r = createMockRouteDTO(5000.0, 300.0);
        r.setGeometry(Map.of("type", "LineString", "coordinates", List.of(new double[]{75.88, 22.72})));
        when(googleRoutesService.computeTrafficRoutes(any()))
                .thenReturn(new RoutingResponse(true, "Success", r, List.of(r)));
        VehiclePoolService.PoolException ex = assertThrows(
                VehiclePoolService.PoolException.class,
                () -> vehiclePoolService.createPool("user_123", createValidRequest()));
        assertEquals(400, ex.getStatus());
        assertTrue(ex.getMessage().contains("fewer than 2 points"));
        verify(poolRepository, never()).save(any());
    }

    @Test
    @DisplayName("Legacy pools with NULL route fields remain readable for backward compatibility")
    void testListPools_ExistingPoolsWithNullSpatialData() {
        VehiclePoolEntity legacy = new VehiclePoolEntity();
        legacy.setId("legacy_1");
        legacy.setCreatorId("user_123");
        legacy.setCreatorName("Test Driver");
        legacy.setStartLocation("Old Start");
        legacy.setDestination("Old Dest");
        legacy.setDepartureTime(LocalDateTime.now().plusHours(1));
        legacy.setTotalSeats(4);
        legacy.setAvailableSeats(4);
        legacy.setCostPerPassenger(20.0);
        legacy.setTotalCost(80.0);
        legacy.setStatus("ACTIVE");
        legacy.setCreatedAt(LocalDateTime.now());
        legacy.setRouteGeom(null);
        legacy.setRouteDistanceMeters(null);
        legacy.setRouteDurationSeconds(null);

        when(poolRepository.findAllByOrderByDepartureTimeAsc()).thenReturn(List.of(legacy));
        List<PoolResponse> pools = vehiclePoolService.listPools("user_123");

        assertEquals(1, pools.size());
        assertNull(pools.get(0).getRouteDistanceMeters());
        assertNull(pools.get(0).getRouteDurationSeconds());
    }

    // =========================================================================
    //  Phase 3 — haversineMeters helper tests
    // =========================================================================

    @Test
    @DisplayName("haversineMeters returns approximately 0 for same point")
    void testHaversine_SamePoint() {
        double d = VehiclePoolService.haversineMeters(22.7244, 75.8839, 22.7244, 75.8839);
        assertEquals(0.0, d, 1.0);
    }

    @Test
    @DisplayName("haversineMeters returns roughly 3320 m for Palasia→Rajwada (known distance)")
    void testHaversine_KnownDistance() {
        // Palasia Square: 22.7244, 75.8839   Rajwada: 22.7196, 75.8570
        double d = VehiclePoolService.haversineMeters(22.7244, 75.8839, 22.7196, 75.8570);
        assertTrue(d > 2_000 && d < 5_000,
                "Expected ~3km between Palasia and Rajwada, got " + d);
    }

    // =========================================================================
    //  Phase 3 — searchPoolsSpatial unit tests (repository mocked)
    // =========================================================================

    /**
     * A: Exact match — Driver A→B, Passenger A→B.
     * The DB mock returns the pool; result must include it as a candidate.
     */
    @Test
    @DisplayName("A: Exact route — Driver A→B, Passenger A→B → candidate returned")
    void testSpatialSearch_ExactRoute() {
        VehiclePoolEntity pool = activePool("pool_1",
                22.7300, 75.8650, 22.7196, 75.8570, sampleRouteLineString());
        when(poolRepository.findSpatialCandidates(anyDouble(), anyDouble(), anyDouble(), anyDouble(),
                anyDouble(), any(LocalDateTime.class)))
                .thenReturn(List.of(projection("pool_1", 12.5, 8.3)));
        when(poolRepository.findAllById(List.of("pool_1"))).thenReturn(List.of(pool));
        when(memberRepository.findByUserId(any())).thenReturn(List.of());

        List<PoolResponse> results = vehiclePoolService.searchPoolsSpatial(
                "user_p",
                "Bijasanagar, Indore", 22.7300, 75.8650,
                "Rajwada, Indore", 22.7196, 75.8570);


        assertEquals(1, results.size());
        PoolResponse r = results.get(0);
        assertTrue(r.isCandidate());
        
        // Phase 6 assertions
        assertNotNull(r.getMatchScore());
        assertEquals(1, r.getMatchRank());
        assertTrue(r.getMatchScore() > 0.0);
        // Overlap: 100%, Pickup: ~100%, Dropoff: ~100%, Detour: 100% -> very high score
        assertTrue(r.getMatchScore() >= 70.0);

    }

    /**
     * B: Intermediate pickup — Driver A→B, Passenger C→B; C is near route.
     */
    @Test
    @DisplayName("B: Intermediate pickup — Passenger C near driver route → candidate returned")
    void testSpatialSearch_IntermediatePickup() {
        VehiclePoolEntity pool = activePool("pool_2",
                22.7300, 75.8650, 22.7196, 75.8570, sampleRouteLineString());
        when(poolRepository.findSpatialCandidates(anyDouble(), anyDouble(), anyDouble(), anyDouble(),
                anyDouble(), any(LocalDateTime.class)))
                .thenReturn(List.of(projection("pool_2", 250.0, 8.0)));
        when(poolRepository.findAllById(List.of("pool_2"))).thenReturn(List.of(pool));
        when(memberRepository.findByUserId(any())).thenReturn(List.of());

        // C = Palasia (near driver route), B = Rajwada (driver end)
        List<PoolResponse> results = vehiclePoolService.searchPoolsSpatial(
                null,
                "Palasia, Indore", 22.7244, 75.8839,
                "Rajwada, Indore", 22.7196, 75.8570);

        assertEquals(1, results.size());
        assertTrue(results.get(0).isCandidate());
        assertEquals(250.0, results.get(0).getPickupDistanceMeters(), 0.1);
    }

    /**
     * C: Intermediate drop — Driver A→B, Passenger A→D; D is near route.
     */
    @Test
    @DisplayName("C: Intermediate drop — Passenger D near driver route → candidate returned")
    void testSpatialSearch_IntermediateDrop() {
        VehiclePoolEntity pool = activePool("pool_3",
                22.7300, 75.8650, 22.7196, 75.8570, sampleRouteLineString());
        when(poolRepository.findSpatialCandidates(anyDouble(), anyDouble(), anyDouble(), anyDouble(),
                anyDouble(), any(LocalDateTime.class)))
                .thenReturn(List.of(projection("pool_3", 5.0, 200.0)));
        when(poolRepository.findAllById(List.of("pool_3"))).thenReturn(List.of(pool));
        when(memberRepository.findByUserId(any())).thenReturn(List.of());

        List<PoolResponse> results = vehiclePoolService.searchPoolsSpatial(
                null,
                "Bijasanagar, Indore", 22.7300, 75.8650,
                "SomeMidpoint, Indore", 22.7250, 75.8700);

        assertEquals(1, results.size());
        assertTrue(results.get(0).isCandidate());
        assertEquals(200.0, results.get(0).getDropoffDistanceMeters(), 0.1);
    }

    /**
     * D: Middle-to-middle — Driver A→B, Passenger C→D; both C and D are near route.
     */
    @Test
    @DisplayName("D: Middle-to-middle — both passenger points near route → candidate returned")
    void testSpatialSearch_MiddleToMiddle() {
        VehiclePoolEntity pool = activePool("pool_4",
                22.7300, 75.8650, 22.7196, 75.8570, sampleRouteLineString());
        when(poolRepository.findSpatialCandidates(anyDouble(), anyDouble(), anyDouble(), anyDouble(),
                anyDouble(), any(LocalDateTime.class)))
                .thenReturn(List.of(projection("pool_4", 120.0, 180.0)));
        when(poolRepository.findAllById(List.of("pool_4"))).thenReturn(List.of(pool));
        when(memberRepository.findByUserId(any())).thenReturn(List.of());

        List<PoolResponse> results = vehiclePoolService.searchPoolsSpatial(
                null,
                "MidA, Indore", 22.7280, 75.8720,
                "MidB, Indore", 22.7220, 75.8640);

        assertEquals(1, results.size());
        assertTrue(results.get(0).isCandidate());
    }

    /**
     * E: Far pickup — DB returns empty because pickup > 500 m.
     */
    @Test
    @DisplayName("E: Far pickup → no candidates returned")
    void testSpatialSearch_FarPickup_NoCandidates() {
        when(poolRepository.findSpatialCandidates(anyDouble(), anyDouble(), anyDouble(), anyDouble(),
                anyDouble(), any(LocalDateTime.class)))
                .thenReturn(List.of());

        List<PoolResponse> results = vehiclePoolService.searchPoolsSpatial(
                null,
                "FarOrigin", 23.5000, 76.5000,
                "Rajwada, Indore", 22.7196, 75.8570);

        assertTrue(results.isEmpty());
    }

    /**
     * F: Far dropoff — DB returns empty because dropoff > 500 m.
     */
    @Test
    @DisplayName("F: Far dropoff → no candidates returned")
    void testSpatialSearch_FarDropoff_NoCandidates() {
        when(poolRepository.findSpatialCandidates(anyDouble(), anyDouble(), anyDouble(), anyDouble(),
                anyDouble(), any(LocalDateTime.class)))
                .thenReturn(List.of());

        List<PoolResponse> results = vehiclePoolService.searchPoolsSpatial(
                null,
                "Bijasanagar, Indore", 22.7300, 75.8650,
                "FarDest", 24.0000, 77.0000);

        assertTrue(results.isEmpty());
    }

    /**
     * G: NULL route_geom — the DB query WHERE clause excludes NULL-route pools;
     * repository returns empty to simulate this.
     */
    @Test
    @DisplayName("G: Pool with NULL route_geom is excluded by DB query (returns empty list)")
    void testSpatialSearch_NullRouteGeom_Excluded() {
        when(poolRepository.findSpatialCandidates(anyDouble(), anyDouble(), anyDouble(), anyDouble(),
                anyDouble(), any(LocalDateTime.class)))
                .thenReturn(List.of());

        List<PoolResponse> results = vehiclePoolService.searchPoolsSpatial(
                null,
                "Bijasanagar, Indore", 22.7300, 75.8650,
                "Rajwada, Indore", 22.7196, 75.8570);

        assertTrue(results.isEmpty());
    }

    /**
     * H: Full pool — DB query has WHERE available_seats > 0; repo returns empty.
     */
    @Test
    @DisplayName("H: Full pool is excluded by DB available_seats filter → no candidates returned")
    void testSpatialSearch_FullPool_Excluded() {
        when(poolRepository.findSpatialCandidates(anyDouble(), anyDouble(), anyDouble(), anyDouble(),
                anyDouble(), any(LocalDateTime.class)))
                .thenReturn(List.of());

        List<PoolResponse> results = vehiclePoolService.searchPoolsSpatial(
                null,
                "Bijasanagar, Indore", 22.7300, 75.8650,
                "Rajwada, Indore", 22.7196, 75.8570);

        assertTrue(results.isEmpty());
    }

    /**
     * I: Expired pool — DB query has WHERE departure_time > now; repo returns empty.
     */
    @Test
    @DisplayName("I: Already-departed pool is excluded by departure_time filter → empty result")
    void testSpatialSearch_DepartedPool_Excluded() {
        when(poolRepository.findSpatialCandidates(anyDouble(), anyDouble(), anyDouble(), anyDouble(),
                anyDouble(), any(LocalDateTime.class)))
                .thenReturn(List.of());

        List<PoolResponse> results = vehiclePoolService.searchPoolsSpatial(
                null,
                "Bijasanagar, Indore", 22.7300, 75.8650,
                "Rajwada, Indore", 22.7196, 75.8570);

        assertTrue(results.isEmpty());
    }

    /**
     * J: Invalid pickup coordinates → HTTP 400.
     */
    @Test
    @DisplayName("J: Invalid pickup latitude → 400 PoolException")
    void testSpatialSearch_InvalidPickupCoordinates() {
        VehiclePoolService.PoolException ex = assertThrows(
                VehiclePoolService.PoolException.class,
                () -> vehiclePoolService.searchPoolsSpatial(
                        null,
                        "Bad Origin", 95.0, 75.8839,
                        "Rajwada, Indore", 22.7196, 75.8570));
        assertEquals(400, ex.getStatus());
        assertTrue(ex.getMessage().contains("pickup latitude"));
        verify(poolRepository, never()).findSpatialCandidates(
                anyDouble(), anyDouble(), anyDouble(), anyDouble(), anyDouble(), any());
    }

    /**
     * J2: NaN longitude rejected.
     */
    @Test
    @DisplayName("J2: NaN dropoff longitude → 400 PoolException")
    void testSpatialSearch_NanLongitude() {
        VehiclePoolService.PoolException ex = assertThrows(
                VehiclePoolService.PoolException.class,
                () -> vehiclePoolService.searchPoolsSpatial(
                        null,
                        "Bijasanagar", 22.7300, 75.8650,
                        "Bad Dest", 22.7196, Double.NaN));
        assertEquals(400, ex.getStatus());
        assertTrue(ex.getMessage().contains("dropoff longitude"));
    }

    /**
     * K: Same pickup/drop (within 50 m tolerance) → 400.
     */
    @Test
    @DisplayName("K: Same pickup and dropoff location → 400 PoolException")
    void testSpatialSearch_SamePickupDropoff() {
        VehiclePoolService.PoolException ex = assertThrows(
                VehiclePoolService.PoolException.class,
                () -> vehiclePoolService.searchPoolsSpatial(
                        null,
                        "Palasia", 22.7244, 75.8839,
                        "Palasia", 22.7244, 75.8839));
        assertEquals(400, ex.getStatus());
        assertTrue(ex.getMessage().contains("effectively the same"));
        verify(poolRepository, never()).findSpatialCandidates(
                anyDouble(), anyDouble(), anyDouble(), anyDouble(), anyDouble(), any());
    }

    /**
     * K2: Very close (< 50 m) but not identical → also rejected.
     */
    @Test
    @DisplayName("K2: Nearly identical pickup/dropoff (< 50 m apart) → 400 PoolException")
    void testSpatialSearch_NearlyIdenticalLocations() {
        VehiclePoolService.PoolException ex = assertThrows(
                VehiclePoolService.PoolException.class,
                () -> vehiclePoolService.searchPoolsSpatial(
                        null,
                        "LocA", 22.7244, 75.8839,
                        "LocB", 22.72441, 75.88391)); // ~1.5 m apart
        assertEquals(400, ex.getStatus());
        assertTrue(ex.getMessage().contains("effectively the same"));
    }

    /**
     * L: Distance values are forwarded in metres from the projection.
     */
    @Test
    @DisplayName("L: pickupDistanceMeters and dropoffDistanceMeters are returned in metres")
    void testSpatialSearch_DistanceValuesInMeters() {
        VehiclePoolEntity pool = activePool("pool_L",
                22.7300, 75.8650, 22.7196, 75.8570, sampleRouteLineString());
        when(poolRepository.findSpatialCandidates(anyDouble(), anyDouble(), anyDouble(), anyDouble(),
                anyDouble(), any(LocalDateTime.class)))
                .thenReturn(List.of(projection("pool_L", 123.456, 78.9)));
        when(poolRepository.findAllById(List.of("pool_L"))).thenReturn(List.of(pool));
        when(memberRepository.findByUserId(any())).thenReturn(List.of());

        List<PoolResponse> results = vehiclePoolService.searchPoolsSpatial(
                null,
                "PickupPoint", 22.7280, 75.8700,
                "DropoffPoint", 22.7220, 75.8600);

        assertEquals(1, results.size());
        // Rounded to centimetre precision
        assertEquals(123.46, results.get(0).getPickupDistanceMeters(), 0.01);
        assertEquals(78.9, results.get(0).getDropoffDistanceMeters(), 0.01);
    }

    // =========================================================================
    //  Phase 4 — Direction Compatibility Tests
    // =========================================================================

    /**
     * M: Reverse route — Passenger dropoff is before pickup on the driver's route.
     */
    @Test
    @DisplayName("Phase 4: Reverse route (pickup > dropoff) → excluded")
    void testSpatialSearch_ReverseRoute_Excluded() {
        VehiclePoolEntity pool = activePool("pool_rev",
                22.7300, 75.8650, 22.7196, 75.8570, sampleRouteLineString());
        // pickupPos = 0.8, dropoffPos = 0.2 (reverse direction)
        when(poolRepository.findSpatialCandidates(anyDouble(), anyDouble(), anyDouble(), anyDouble(),
                anyDouble(), any(LocalDateTime.class)))
                .thenReturn(List.of(projection("pool_rev", 50.0, 50.0, 0.8, 0.2)));
        when(poolRepository.findAllById(List.of("pool_rev"))).thenReturn(List.of(pool));

        List<PoolResponse> results = vehiclePoolService.searchPoolsSpatial(
                null,
                "PickupPoint", 22.7220, 75.8600,
                "DropoffPoint", 22.7280, 75.8700);

        assertTrue(results.isEmpty(), "Reverse route should not be direction-compatible");
    }

    /**
     * N: Same projected position — Passenger pickup and dropoff map to the exact same point on route.
     */
    @Test
    @DisplayName("Phase 4: Same projected position (|pickup - dropoff| < 0.000001) → excluded")
    void testSpatialSearch_SameProjectedPosition_Excluded() {
        VehiclePoolEntity pool = activePool("pool_same",
                22.7300, 75.8650, 22.7196, 75.8570, sampleRouteLineString());
        // pickupPos = 0.5, dropoffPos = 0.5
        when(poolRepository.findSpatialCandidates(anyDouble(), anyDouble(), anyDouble(), anyDouble(),
                anyDouble(), any(LocalDateTime.class)))
                .thenReturn(List.of(projection("pool_same", 50.0, 50.0, 0.5, 0.5)));
        when(poolRepository.findAllById(List.of("pool_same"))).thenReturn(List.of(pool));

        List<PoolResponse> results = vehiclePoolService.searchPoolsSpatial(
                null,
                "PickupPoint", 22.7250, 75.8650,
                "DropoffPoint", 22.7300, 75.8700);

        assertTrue(results.isEmpty(), "Same projected position should not be direction-compatible");
    }

    /**
     * O: Forward route — Passenger pickup is before dropoff on the driver's route.
     */
    @Test
    @DisplayName("Phase 4: Forward route (pickup < dropoff) → candidate returned with directionCompatible=true")
    void testSpatialSearch_ForwardRoute_Included() {
        VehiclePoolEntity pool = activePool("pool_fwd",
                22.7300, 75.8650, 22.7196, 75.8570, sampleRouteLineString());
        // pickupPos = 0.2, dropoffPos = 0.8 (forward direction)
        when(poolRepository.findSpatialCandidates(anyDouble(), anyDouble(), anyDouble(), anyDouble(),
                anyDouble(), any(LocalDateTime.class)))
                .thenReturn(List.of(projection("pool_fwd", 50.0, 50.0, 0.2, 0.8)));
        when(poolRepository.findAllById(List.of("pool_fwd"))).thenReturn(List.of(pool));

        List<PoolResponse> results = vehiclePoolService.searchPoolsSpatial(
                null,
                "PickupPoint", 22.7280, 75.8700,
                "DropoffPoint", 22.7220, 75.8600);

        assertEquals(1, results.size());
        assertTrue(results.get(0).isDirectionCompatible());
        assertEquals(0.2, results.get(0).getPickupRoutePosition());
        assertEquals(0.8, results.get(0).getDropoffRoutePosition());
    }

    /**
     * No coordinates provided → falls back to legacy text-match searchPools.
     */
    @Test
    @DisplayName("No coordinates → falls back to legacy text-based search")
    void testSpatialSearch_NoCoordinates_FallsBackToTextSearch() {
        when(poolRepository.findByStatusAndAvailableSeatsGreaterThanOrderByDepartureTimeAsc("ACTIVE", 0))
                .thenReturn(List.of());

        // Should not throw; should delegate to searchPools
        VehiclePoolService.PoolException ex = assertThrows(
                VehiclePoolService.PoolException.class,
                () -> vehiclePoolService.searchPoolsSpatial(
                        null, null, null, null, null, null, null));
        // searchPools throws 400 because origin is blank
        assertEquals(400, ex.getStatus());
        verify(poolRepository, never()).findSpatialCandidates(
                anyDouble(), anyDouble(), anyDouble(), anyDouble(), anyDouble(), any());
    }

    /**
     * Empty candidate list → return empty list, not an error.
     */
    @Test
    @DisplayName("No candidates within 500 m → return empty list, not an error")
    void testSpatialSearch_NoCandidates_EmptyList() {
        when(poolRepository.findSpatialCandidates(anyDouble(), anyDouble(), anyDouble(), anyDouble(),
                anyDouble(), any(LocalDateTime.class)))
                .thenReturn(List.of());

        List<PoolResponse> results = vehiclePoolService.searchPoolsSpatial(
                null,
                "OriginFar", 20.0000, 72.0000,
                "DestFar", 20.0100, 72.0100);

        assertNotNull(results);
        assertTrue(results.isEmpty());
        verify(poolRepository, never()).findAllById(any());
    }

    @Test
    @DisplayName("PostgreSQL database query failure throws controlled 500 error and avoids fallback scanning")
    void testSpatialSearch_PostgresDatabaseFailure_Throws500() throws Exception {
        // Configure datasource mock to return "PostgreSQL" as database product name
        java.sql.Connection pgConnection = mock(java.sql.Connection.class);
        java.sql.DatabaseMetaData pgMetaData = mock(java.sql.DatabaseMetaData.class);
        when(dataSource.getConnection()).thenReturn(pgConnection);
        when(pgConnection.getMetaData()).thenReturn(pgMetaData);
        when(pgMetaData.getDatabaseProductName()).thenReturn("PostgreSQL");

        // Force repository spatial query to throw an exception
        when(poolRepository.findSpatialCandidates(anyDouble(), anyDouble(), anyDouble(), anyDouble(), anyDouble(), any()))
                .thenThrow(new RuntimeException("PostGIS extension missing or database connection lost"));

        VehiclePoolService.PoolException ex = assertThrows(
                VehiclePoolService.PoolException.class,
                () -> vehiclePoolService.searchPoolsSpatial(
                        null,
                        "Bijasanagar", 22.7300, 75.8650,
                        "Rajwada", 22.7196, 75.8570));

        assertEquals(500, ex.getStatus());
        assertTrue(ex.getMessage().contains("Database spatial query failed"));
        // Ensure no active pools are scanned in JTS fallback
        verify(poolRepository, never()).findByStatusAndAvailableSeatsGreaterThanOrderByDepartureTimeAsc(anyString(), anyInt());
    }
}
