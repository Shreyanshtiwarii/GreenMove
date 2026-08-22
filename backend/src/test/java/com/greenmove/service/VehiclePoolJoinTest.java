package com.greenmove.service;

import com.greenmove.dto.VehiclePoolDTOs.JoinPoolRequest;
import com.greenmove.dto.VehiclePoolDTOs.PoolResponse;
import com.greenmove.entity.UserEntity;
import com.greenmove.entity.VehiclePoolEntity;
import com.greenmove.entity.VehiclePoolMemberEntity;
import com.greenmove.repository.UserRepository;
import com.greenmove.repository.VehiclePoolMemberRepository;
import com.greenmove.repository.VehiclePoolRepository;
import com.greenmove.service.VehiclePoolService.PoolException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

import java.time.LocalDateTime;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class VehiclePoolJoinTest {

    @Mock
    private UserRepository userRepository;
    
    @Mock
    private VehiclePoolRepository poolRepository;
    
    @Mock
    private VehiclePoolMemberRepository memberRepository;

    @InjectMocks
    private VehiclePoolService vehiclePoolService;

    private UserEntity testPassenger;
    private VehiclePoolEntity testPool;

    @BeforeEach
    void setUp() {
        testPassenger = new UserEntity();
        testPassenger.setId("user_passenger");
        testPassenger.setName("Passenger Name");

        testPool = new VehiclePoolEntity();
        testPool.setId("pool_123");
        testPool.setCreatorId("user_driver");
        testPool.setStatus("ACTIVE");
        testPool.setAvailableSeats(3);
        testPool.setTotalSeats(3);
        testPool.setDepartureTime(LocalDateTime.now().plusDays(1));
        
        ReflectionTestUtils.setField(vehiclePoolService, "maxDepartureTimeDifferenceMinutes", 30.0);
    }

    @Test
    void testSuccessfulJoin_WithSpatialData() {
        JoinPoolRequest req = new JoinPoolRequest();
        req.setPickupLocation("A");
        req.setPickupLatitude(10.0);
        req.setPickupLongitude(20.0);
        req.setDropoffLocation("B");
        req.setDropoffLatitude(30.0);
        req.setDropoffLongitude(40.0);

        when(userRepository.findById("user_passenger")).thenReturn(Optional.of(testPassenger));
        when(poolRepository.findByIdForUpdate("pool_123")).thenReturn(Optional.of(testPool));
        when(memberRepository.findByPoolIdAndUserId("pool_123", "user_passenger")).thenReturn(Optional.empty());

        PoolResponse res = vehiclePoolService.joinPool("user_passenger", "pool_123", req);

        // Verify availableSeats decreased by 1
        assertEquals(2, res.getAvailableSeats());
        assertEquals(1, res.getOccupiedSeats());
        assertEquals(3, res.getTotalSeats());
        assertEquals("AVAILABLE", res.getStatus());

        // Verify member was saved with spatial fields
        ArgumentCaptor<VehiclePoolMemberEntity> memberCaptor = ArgumentCaptor.forClass(VehiclePoolMemberEntity.class);
        verify(memberRepository).save(memberCaptor.capture());
        
        VehiclePoolMemberEntity savedMember = memberCaptor.getValue();
        assertEquals("pool_123", savedMember.getPoolId());
        assertEquals("user_passenger", savedMember.getUserId());
        assertEquals("A", savedMember.getPickupLocation());
        assertEquals(10.0, savedMember.getPickupLat());
        assertEquals(20.0, savedMember.getPickupLng());
        assertNotNull(savedMember.getPickupGeom());
        assertEquals("B", savedMember.getDropoffLocation());
        assertEquals(30.0, savedMember.getDropoffLat());
        assertEquals(40.0, savedMember.getDropoffLng());
        assertNotNull(savedMember.getDropoffGeom());
    }
    
    @Test
    void testSuccessfulJoin_LegacyNoSpatialData() {
        when(userRepository.findById("user_passenger")).thenReturn(Optional.of(testPassenger));
        when(poolRepository.findByIdForUpdate("pool_123")).thenReturn(Optional.of(testPool));
        when(memberRepository.findByPoolIdAndUserId("pool_123", "user_passenger")).thenReturn(Optional.empty());

        // Call without JoinPoolRequest (or null) to simulate legacy UI
        PoolResponse res = vehiclePoolService.joinPool("user_passenger", "pool_123", null);

        assertEquals(2, res.getAvailableSeats());
        
        ArgumentCaptor<VehiclePoolMemberEntity> memberCaptor = ArgumentCaptor.forClass(VehiclePoolMemberEntity.class);
        verify(memberRepository).save(memberCaptor.capture());
        
        VehiclePoolMemberEntity savedMember = memberCaptor.getValue();
        assertNull(savedMember.getPickupLat());
        assertNull(savedMember.getPickupGeom());
    }

    @Test
    void testJoin_PoolNotFound() {
        when(userRepository.findById("user_passenger")).thenReturn(Optional.of(testPassenger));
        when(poolRepository.findByIdForUpdate("missing_pool")).thenReturn(Optional.empty());

        PoolException ex = assertThrows(PoolException.class, () -> 
            vehiclePoolService.joinPool("user_passenger", "missing_pool", null));
        assertEquals(404, ex.getStatus());
    }

    @Test
    void testJoin_DriverAttemptsToJoinOwnPool() {
        testPassenger.setId("user_driver"); // Passenger is driver
        
        when(userRepository.findById("user_driver")).thenReturn(Optional.of(testPassenger));
        when(poolRepository.findByIdForUpdate("pool_123")).thenReturn(Optional.of(testPool));

        PoolException ex = assertThrows(PoolException.class, () -> 
            vehiclePoolService.joinPool("user_driver", "pool_123", null));
        assertEquals(400, ex.getStatus());
        assertTrue(ex.getMessage().contains("can't join a pool you created"));
    }

    @Test
    void testJoin_ZeroAvailableSeats() {
        testPool.setAvailableSeats(0);
        
        when(userRepository.findById("user_passenger")).thenReturn(Optional.of(testPassenger));
        when(poolRepository.findByIdForUpdate("pool_123")).thenReturn(Optional.of(testPool));

        PoolException ex = assertThrows(PoolException.class, () -> 
            vehiclePoolService.joinPool("user_passenger", "pool_123", null));
        assertEquals(400, ex.getStatus());
        assertTrue(ex.getMessage().contains("full"));
    }

    @Test
    void testJoin_FinalSeatConsumption() {
        testPool.setAvailableSeats(1);
        testPool.setTotalSeats(3);
        
        when(userRepository.findById("user_passenger")).thenReturn(Optional.of(testPassenger));
        when(poolRepository.findByIdForUpdate("pool_123")).thenReturn(Optional.of(testPool));
        when(memberRepository.findByPoolIdAndUserId("pool_123", "user_passenger")).thenReturn(Optional.empty());

        PoolResponse res = vehiclePoolService.joinPool("user_passenger", "pool_123", null);

        assertEquals(0, res.getAvailableSeats());
        assertEquals(3, res.getOccupiedSeats()); // 3 - 0 = 3
        assertEquals(3, res.getTotalSeats()); // total remains unchanged
        // Existing pool lifecycle says remain ACTIVE but show full
        assertTrue(res.isFull());
    }

    @Test
    void testJoin_ExpiredDepartedPool() {
        testPool.setDepartureTime(LocalDateTime.now().minusHours(1));
        
        when(userRepository.findById("user_passenger")).thenReturn(Optional.of(testPassenger));
        when(poolRepository.findByIdForUpdate("pool_123")).thenReturn(Optional.of(testPool));

        PoolException ex = assertThrows(PoolException.class, () -> 
            vehiclePoolService.joinPool("user_passenger", "pool_123", null));
        assertEquals(400, ex.getStatus());
        assertTrue(ex.getMessage().contains("departed"));
    }

    @Test
    void testJoin_DuplicateMembership() {
        when(userRepository.findById("user_passenger")).thenReturn(Optional.of(testPassenger));
        when(poolRepository.findByIdForUpdate("pool_123")).thenReturn(Optional.of(testPool));
        
        VehiclePoolMemberEntity existingMember = new VehiclePoolMemberEntity();
        when(memberRepository.findByPoolIdAndUserId("pool_123", "user_passenger")).thenReturn(Optional.of(existingMember));

        PoolException ex = assertThrows(PoolException.class, () -> 
            vehiclePoolService.joinPool("user_passenger", "pool_123", null));
        assertEquals(409, ex.getStatus());
        assertTrue(ex.getMessage().contains("already joined"));
    }

    @Test
    void testJoin_InvalidPickupCoordinates() {
        JoinPoolRequest req = new JoinPoolRequest();
        req.setPickupLatitude(91.0); // Invalid lat
        req.setPickupLongitude(20.0);

        when(userRepository.findById("user_passenger")).thenReturn(Optional.of(testPassenger));
        when(poolRepository.findByIdForUpdate("pool_123")).thenReturn(Optional.of(testPool));
        when(memberRepository.findByPoolIdAndUserId("pool_123", "user_passenger")).thenReturn(Optional.empty());

        PoolException ex = assertThrows(PoolException.class, () -> 
            vehiclePoolService.joinPool("user_passenger", "pool_123", req));
        assertEquals(400, ex.getStatus());
        assertTrue(ex.getMessage().contains("Invalid pickup"));
    }
    
    @Test
    void testJoin_InvalidDropoffCoordinates() {
        JoinPoolRequest req = new JoinPoolRequest();
        req.setDropoffLatitude(30.0);
        req.setDropoffLongitude(200.0); // Invalid lng

        when(userRepository.findById("user_passenger")).thenReturn(Optional.of(testPassenger));
        when(poolRepository.findByIdForUpdate("pool_123")).thenReturn(Optional.of(testPool));
        when(memberRepository.findByPoolIdAndUserId("pool_123", "user_passenger")).thenReturn(Optional.empty());

        PoolException ex = assertThrows(PoolException.class, () -> 
            vehiclePoolService.joinPool("user_passenger", "pool_123", req));
        assertEquals(400, ex.getStatus());
        assertTrue(ex.getMessage().contains("Invalid dropoff"));
    }
}
