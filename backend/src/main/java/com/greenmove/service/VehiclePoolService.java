package com.greenmove.service;

import com.greenmove.dto.VehiclePoolDTOs.CreatePoolRequest;
import com.greenmove.dto.VehiclePoolDTOs.PoolMemberResponse;
import com.greenmove.dto.VehiclePoolDTOs.PoolResponse;
import com.greenmove.entity.UserEntity;
import com.greenmove.entity.VehiclePoolEntity;
import com.greenmove.entity.VehiclePoolMemberEntity;
import com.greenmove.repository.UserRepository;
import com.greenmove.repository.VehiclePoolMemberRepository;
import com.greenmove.repository.VehiclePoolRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

/**
 * Core business logic for the "Vehicle Pool" feature: creating pools, listing them,
 * joining/leaving with safe, race-free seat accounting, and letting a pool's creator
 * manage (and manually end) the pools they created.
 *
 * Lifecycle: every pool is persisted with a lifecycle status of ACTIVE, COMPLETED, or
 * TERMINATED. "Full"/"Available" are NOT persisted lifecycle states -- they are derived
 * at read time from the live seat count, so a pool never gets stuck showing "Full" after
 * a member leaves and frees up a seat. The four statuses shown to users (Available, Full,
 * Completed, Terminated) are computed by {@link #computeDisplayStatus}.
 */
@Service
public class VehiclePoolService {

    private static final String STATUS_ACTIVE = "ACTIVE";
    private static final String STATUS_COMPLETED = "COMPLETED";
    private static final String STATUS_TERMINATED = "TERMINATED";

    /** Thrown for any client-facing failure (validation, conflict, not found, etc). */
    public static class PoolException extends RuntimeException {
        private final int status;
        public PoolException(int status, String message) {
            super(message);
            this.status = status;
        }
        public int getStatus() { return status; }
    }

    private final VehiclePoolRepository poolRepository;
    private final VehiclePoolMemberRepository memberRepository;
    private final UserRepository userRepository;

    public VehiclePoolService(VehiclePoolRepository poolRepository,
                               VehiclePoolMemberRepository memberRepository,
                               UserRepository userRepository) {
        this.poolRepository = poolRepository;
        this.memberRepository = memberRepository;
        this.userRepository = userRepository;
    }

    public UserEntity requireUser(String userId) {
        if (userId == null || userId.isBlank()) {
            throw new PoolException(401, "Not authenticated");
        }
        return userRepository.findById(userId)
                .orElseThrow(() -> new PoolException(401, "Not authenticated"));
    }

    @Transactional(readOnly = true)
    public List<PoolResponse> listPools(String currentUserId) {
        List<VehiclePoolEntity> pools = poolRepository.findAllByOrderByDepartureTimeAsc();
        Set<String> joinedPoolIds = joinedPoolIdsFor(currentUserId);

        return pools.stream()
                .filter(p -> isVisibleInBrowse(p, currentUserId, joinedPoolIds))
                .map(p -> toResponse(p, currentUserId, joinedPoolIds.contains(p.getId()), false))
                .collect(Collectors.toList());
    }

    /**
     * Public "Browse Pools" visibility rule. ACTIVE pools are visible to everyone, same
     * as before. Once a pool has been ended by its creator (COMPLETED or TERMINATED), it
     * is removed from the public browse listing for unrelated users -- but it stays
     * visible to the pool's creator and to any user who had already joined it, so they
     * keep a record of a ride they were part of. This is enforced here, server-side, so
     * it can't be bypassed by a client that skips frontend filtering.
     */
    private boolean isVisibleInBrowse(VehiclePoolEntity p, String currentUserId, Set<String> joinedPoolIds) {
        if (STATUS_ACTIVE.equals(p.getStatus())) {
            return true;
        }
        if (currentUserId == null || currentUserId.isBlank()) {
            return false;
        }
        return currentUserId.equals(p.getCreatorId()) || joinedPoolIds.contains(p.getId());
    }

    /**
     * Route-based pool discovery (Phase 2). Unlike {@link #listPools}, this does NOT
     * return the full browse list -- the caller must supply an origin and a destination,
     * and only pools that (a) are in the ACTIVE lifecycle state, (b) still have at least
     * one open seat, (c) haven't already departed, and (d) match both the origin and the
     * destination (case/whitespace-insensitive) are returned. Terminated, completed, full,
     * departed, and route-mismatched pools are never returned here, regardless of who's
     * asking -- this is a strict subset of the Phase 1 browse-visibility rules, enforced
     * entirely server-side so a client can't get unrelated-route or ended pools by calling
     * the API directly.
     */
    @Transactional(readOnly = true)
    public List<PoolResponse> searchPools(String currentUserId, String origin, String destination) {
        if (origin == null || origin.isBlank()) {
            throw new PoolException(400, "Please enter your current location / origin");
        }
        if (destination == null || destination.isBlank()) {
            throw new PoolException(400, "Please enter your destination");
        }

        String normalizedOrigin = normalizeRouteText(origin);
        String normalizedDestination = normalizeRouteText(destination);
        LocalDateTime now = LocalDateTime.now();

        List<VehiclePoolEntity> candidates =
                poolRepository.findByStatusAndAvailableSeatsGreaterThanOrderByDepartureTimeAsc(STATUS_ACTIVE, 0);
        Set<String> joinedPoolIds = joinedPoolIdsFor(currentUserId);

        return candidates.stream()
                .filter(p -> normalizeRouteText(p.getStartLocation()).equals(normalizedOrigin))
                .filter(p -> normalizeRouteText(p.getDestination()).equals(normalizedDestination))
                .filter(p -> p.getDepartureTime() != null && p.getDepartureTime().isAfter(now))
                .map(p -> toResponse(p, currentUserId, joinedPoolIds.contains(p.getId()), false))
                .collect(Collectors.toList());
    }

    /** Case/whitespace-insensitive normalization used to match origin/destination text. */
    private String normalizeRouteText(String value) {
        if (value == null) {
            return "";
        }
        return value.trim().replaceAll("\\s+", " ").toLowerCase();
    }

    /**
     * Pools created by the given user, for their "My Pools" management view. Unlike the
     * public browse listing, each pool includes its passenger list so the creator can see
     * who has joined.
     */
    @Transactional(readOnly = true)
    public List<PoolResponse> listMyPools(String creatorId) {
        UserEntity creator = requireUser(creatorId);
        List<VehiclePoolEntity> pools = poolRepository.findByCreatorIdOrderByDepartureTimeAsc(creator.getId());

        return pools.stream()
                .map(p -> toResponse(p, creator.getId(), false, true))
                .collect(Collectors.toList());
    }

    @Transactional
    public PoolResponse createPool(String creatorId, CreatePoolRequest request) {
        UserEntity creator = requireUser(creatorId);

        if (request.getDepartureTime().isBefore(LocalDateTime.now())) {
            throw new PoolException(400, "Departure date/time must be in the future");
        }

        VehiclePoolEntity pool = new VehiclePoolEntity();
        pool.setId("pool_" + System.currentTimeMillis() + "_" + UUID.randomUUID().toString().substring(0, 8));
        pool.setCreatorId(creator.getId());
        pool.setCreatorName(creator.getName());
        pool.setStartLocation(request.getStartLocation().trim());
        pool.setDestination(request.getDestination().trim());
        pool.setDepartureTime(request.getDepartureTime());
        pool.setTotalSeats(request.getTotalSeats());
        pool.setAvailableSeats(request.getTotalSeats());
        pool.setCostPerPassenger(request.getCostPerPassenger());
        pool.setTotalCost(round2(request.getCostPerPassenger() * request.getTotalSeats()));
        pool.setStatus(STATUS_ACTIVE);
        pool.setCreatedAt(LocalDateTime.now());

        VehiclePoolEntity saved = poolRepository.save(pool);
        return toResponse(saved, creator.getId(), false, false);
    }

    @Transactional
    public PoolResponse joinPool(String userId, String poolId) {
        UserEntity user = requireUser(userId);

        VehiclePoolEntity pool = poolRepository.findByIdForUpdate(poolId)
                .orElseThrow(() -> new PoolException(404, "Vehicle pool not found"));

        if (pool.getCreatorId().equals(user.getId())) {
            throw new PoolException(400, "You can't join a pool you created");
        }
        requireJoinable(pool);
        if (memberRepository.findByPoolIdAndUserId(poolId, user.getId()).isPresent()) {
            throw new PoolException(409, "You've already joined this pool");
        }
        if (pool.getAvailableSeats() == null || pool.getAvailableSeats() <= 0) {
            throw new PoolException(409, "This pool is full");
        }

        pool.setAvailableSeats(pool.getAvailableSeats() - 1);
        poolRepository.save(pool);

        VehiclePoolMemberEntity member = new VehiclePoolMemberEntity();
        member.setId("poolmem_" + System.currentTimeMillis() + "_" + UUID.randomUUID().toString().substring(0, 8));
        member.setPoolId(poolId);
        member.setUserId(user.getId());
        member.setUserName(user.getName());
        member.setJoinedAt(LocalDateTime.now());
        memberRepository.save(member);

        return toResponse(pool, user.getId(), true, false);
    }

    @Transactional
    public PoolResponse leavePool(String userId, String poolId) {
        UserEntity user = requireUser(userId);

        VehiclePoolEntity pool = poolRepository.findByIdForUpdate(poolId)
                .orElseThrow(() -> new PoolException(404, "Vehicle pool not found"));

        if (!STATUS_ACTIVE.equals(pool.getStatus())) {
            throw new PoolException(409, "This pool has already ended and can no longer be modified");
        }

        VehiclePoolMemberEntity membership = memberRepository.findByPoolIdAndUserId(poolId, user.getId())
                .orElseThrow(() -> new PoolException(409, "You haven't joined this pool"));

        memberRepository.delete(membership);

        int restored = Math.min(pool.getTotalSeats(), pool.getAvailableSeats() + 1);
        pool.setAvailableSeats(restored);
        poolRepository.save(pool);

        return toResponse(pool, user.getId(), false, false);
    }

    /**
     * Creator marks their pool as completed -- e.g. once they've reached the final
     * destination and the shared ride is over. Creator-only; can only be done once,
     * from an ACTIVE pool.
     */
    @Transactional
    public PoolResponse completePool(String userId, String poolId) {
        return endPool(userId, poolId, STATUS_COMPLETED);
    }

    /**
     * Creator terminates their pool early -- e.g. once it's full and no more passengers
     * should be able to join, or because the trip is being called off. Creator-only;
     * can only be done once, from an ACTIVE pool.
     */
    @Transactional
    public PoolResponse terminatePool(String userId, String poolId) {
        return endPool(userId, poolId, STATUS_TERMINATED);
    }

    private PoolResponse endPool(String userId, String poolId, String targetStatus) {
        UserEntity user = requireUser(userId);

        VehiclePoolEntity pool = poolRepository.findByIdForUpdate(poolId)
                .orElseThrow(() -> new PoolException(404, "Vehicle pool not found"));

        if (!pool.getCreatorId().equals(user.getId())) {
            throw new PoolException(403, "Only the pool creator can end this pool");
        }
        if (!STATUS_ACTIVE.equals(pool.getStatus())) {
            throw new PoolException(409, "This pool has already been "
                    + (STATUS_COMPLETED.equals(pool.getStatus()) ? "completed" : "terminated"));
        }

        pool.setStatus(targetStatus);
        poolRepository.save(pool);

        return toResponse(pool, user.getId(), false, true);
    }

    /** Guard shared by join: pools that are ended, departed, or otherwise closed reject new joins. */
    private void requireJoinable(VehiclePoolEntity pool) {
        if (STATUS_COMPLETED.equals(pool.getStatus())) {
            throw new PoolException(409, "This pool has already been completed");
        }
        if (STATUS_TERMINATED.equals(pool.getStatus())) {
            throw new PoolException(409, "This pool has been terminated by its creator");
        }
        if (pool.getDepartureTime().isBefore(LocalDateTime.now())) {
            throw new PoolException(400, "This pool has already departed");
        }
    }

    private Set<String> joinedPoolIdsFor(String currentUserId) {
        if (currentUserId == null || currentUserId.isBlank()) {
            return Set.of();
        }
        return memberRepository.findByUserId(currentUserId).stream()
                .map(VehiclePoolMemberEntity::getPoolId)
                .collect(Collectors.toSet());
    }

    private PoolResponse toResponse(VehiclePoolEntity p, String currentUserId, boolean joined, boolean includeMembers) {
        PoolResponse r = new PoolResponse();
        r.setId(p.getId());
        r.setCreatorId(p.getCreatorId());
        r.setCreatorName(p.getCreatorName());
        r.setStartLocation(p.getStartLocation());
        r.setDestination(p.getDestination());
        r.setDepartureTime(p.getDepartureTime());
        r.setTotalSeats(p.getTotalSeats());
        r.setAvailableSeats(p.getAvailableSeats());
        r.setOccupiedSeats(p.getTotalSeats() - p.getAvailableSeats());
        r.setCostPerPassenger(p.getCostPerPassenger());
        r.setTotalCost(p.getTotalCost());
        r.setStatus(computeDisplayStatus(p));
        r.setCreatedAt(p.getCreatedAt());
        r.setFull(p.getAvailableSeats() == null || p.getAvailableSeats() <= 0);
        r.setPast(p.getDepartureTime() != null && p.getDepartureTime().isBefore(LocalDateTime.now()));
        boolean own = currentUserId != null && currentUserId.equals(p.getCreatorId());
        r.setOwn(own);
        r.setJoined(joined);
        r.setCanEnd(own && STATUS_ACTIVE.equals(p.getStatus()));

        if (includeMembers) {
            List<PoolMemberResponse> members = memberRepository.findByPoolId(p.getId()).stream()
                    .map(m -> new PoolMemberResponse(m.getUserName(), m.getJoinedAt()))
                    .collect(Collectors.toList());
            r.setMembers(members);
        }
        return r;
    }

    /**
     * The single source of truth for the four user-facing statuses (Available / Full /
     * Completed / Terminated). Completed/Terminated are persisted lifecycle states set by
     * the creator; Full/Available are always derived live from the current seat count so
     * they can never go stale.
     */
    private String computeDisplayStatus(VehiclePoolEntity p) {
        if (STATUS_TERMINATED.equals(p.getStatus())) {
            return "TERMINATED";
        }
        if (STATUS_COMPLETED.equals(p.getStatus())) {
            return "COMPLETED";
        }
        if (p.getAvailableSeats() == null || p.getAvailableSeats() <= 0) {
            return "FULL";
        }
        return "AVAILABLE";
    }

    private double round2(double value) {
        return Math.round(value * 100.0) / 100.0;
    }
}
