package com.greenmove.repository;

import com.greenmove.entity.VehiclePoolEntity;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface VehiclePoolRepository extends JpaRepository<VehiclePoolEntity, String> {

    List<VehiclePoolEntity> findAllByOrderByDepartureTimeAsc();

    List<VehiclePoolEntity> findByCreatorIdOrderByDepartureTimeAsc(String creatorId);

    // Candidate set for route-based discovery (Phase 2): only pools that are still in
    // the ACTIVE lifecycle state and still have at least one open seat. Route (origin/
    // destination) matching is applied on top of this in VehiclePoolService, since it
    // needs case/whitespace-insensitive comparison that isn't portable across the H2
    // (dev) and Postgres (prod) dialects this project runs on.
    List<VehiclePoolEntity> findByStatusAndAvailableSeatsGreaterThanOrderByDepartureTimeAsc(
            String status, Integer availableSeats);

    // Row-level lock so concurrent join/leave requests on the same pool serialize
    // instead of racing each other and over-booking (or under-releasing) seats.
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT p FROM VehiclePoolEntity p WHERE p.id = :id")
    Optional<VehiclePoolEntity> findByIdForUpdate(@Param("id") String id);
}
