package com.greenmove.controller;

import com.greenmove.dto.VehiclePoolDTOs.CreatePoolRequest;
import com.greenmove.dto.VehiclePoolDTOs.PoolResponse;
import com.greenmove.service.VehiclePoolService;
import com.greenmove.service.VehiclePoolService.PoolException;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

/**
 * REST endpoints for the "Vehicle Pool" feature: browse pools, create a pool, and
 * join/leave one as an authenticated user.
 */
@RestController
@RequestMapping("/api/v1/pools")
public class VehiclePoolController {

    private final VehiclePoolService vehiclePoolService;

    public VehiclePoolController(VehiclePoolService vehiclePoolService) {
        this.vehiclePoolService = vehiclePoolService;
    }

    @GetMapping
    public ResponseEntity<List<PoolResponse>> listPools(Authentication authentication) {
        String currentUserId = authentication != null ? authentication.getName() : null;
        return ResponseEntity.ok(vehiclePoolService.listPools(currentUserId));
    }

    /**
     * Route-based discovery (Phase 2): returns only ACTIVE pools with an open seat whose
     * origin AND destination match the supplied route. Never returns the full pool list --
     * callers must supply both {@code origin} and {@code destination}. Public, like the
     * browse listing, but the {@code joined}/{@code own} flags on each result are still
     * personalized when the caller is authenticated.
     */
    @GetMapping("/search")
    public ResponseEntity<?> searchPools(Authentication authentication,
                                          @RequestParam(name = "origin", required = false) String origin,
                                          @RequestParam(name = "destination", required = false) String destination) {
        String currentUserId = authentication != null ? authentication.getName() : null;
        try {
            return ResponseEntity.ok(vehiclePoolService.searchPools(currentUserId, origin, destination));
        } catch (PoolException ex) {
            return ResponseEntity.status(ex.getStatus()).body(Map.of("message", ex.getMessage()));
        }
    }

    /** Pools created by the current user, for their "My Pools" management view. */
    @GetMapping("/mine")
    public ResponseEntity<?> listMyPools(Authentication authentication) {
        if (authentication == null || authentication.getName() == null) {
            return unauthenticated();
        }
        try {
            return ResponseEntity.ok(vehiclePoolService.listMyPools(authentication.getName()));
        } catch (PoolException ex) {
            return ResponseEntity.status(ex.getStatus()).body(Map.of("message", ex.getMessage()));
        }
    }

    @PostMapping
    public ResponseEntity<?> createPool(Authentication authentication, @Valid @RequestBody CreatePoolRequest request) {
        if (authentication == null || authentication.getName() == null) {
            return unauthenticated();
        }
        try {
            PoolResponse pool = vehiclePoolService.createPool(authentication.getName(), request);
            return ResponseEntity.status(HttpStatus.CREATED).body(pool);
        } catch (PoolException ex) {
            return ResponseEntity.status(ex.getStatus()).body(Map.of("message", ex.getMessage()));
        }
    }

    @PostMapping("/{id}/join")
    public ResponseEntity<?> joinPool(Authentication authentication, @PathVariable("id") String id) {
        if (authentication == null || authentication.getName() == null) {
            return unauthenticated();
        }
        try {
            PoolResponse pool = vehiclePoolService.joinPool(authentication.getName(), id);
            return ResponseEntity.ok(pool);
        } catch (PoolException ex) {
            return ResponseEntity.status(ex.getStatus()).body(Map.of("message", ex.getMessage()));
        }
    }

    @PostMapping("/{id}/leave")
    public ResponseEntity<?> leavePool(Authentication authentication, @PathVariable("id") String id) {
        if (authentication == null || authentication.getName() == null) {
            return unauthenticated();
        }
        try {
            PoolResponse pool = vehiclePoolService.leavePool(authentication.getName(), id);
            return ResponseEntity.ok(pool);
        } catch (PoolException ex) {
            return ResponseEntity.status(ex.getStatus()).body(Map.of("message", ex.getMessage()));
        }
    }

    /**
     * Creator manually marks the pool as completed (e.g. they've reached the final
     * destination and the shared ride is over). Creator-only.
     */
    @PostMapping("/{id}/complete")
    public ResponseEntity<?> completePool(Authentication authentication, @PathVariable("id") String id) {
        if (authentication == null || authentication.getName() == null) {
            return unauthenticated();
        }
        try {
            PoolResponse pool = vehiclePoolService.completePool(authentication.getName(), id);
            return ResponseEntity.ok(pool);
        } catch (PoolException ex) {
            return ResponseEntity.status(ex.getStatus()).body(Map.of("message", ex.getMessage()));
        }
    }

    /**
     * Creator manually terminates the pool early (e.g. it's full and ready to depart, or
     * the trip is being called off). Terminated pools can no longer accept new members.
     * Creator-only.
     */
    @PostMapping("/{id}/terminate")
    public ResponseEntity<?> terminatePool(Authentication authentication, @PathVariable("id") String id) {
        if (authentication == null || authentication.getName() == null) {
            return unauthenticated();
        }
        try {
            PoolResponse pool = vehiclePoolService.terminatePool(authentication.getName(), id);
            return ResponseEntity.ok(pool);
        } catch (PoolException ex) {
            return ResponseEntity.status(ex.getStatus()).body(Map.of("message", ex.getMessage()));
        }
    }

    private ResponseEntity<?> unauthenticated() {
        return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of("message", "Please sign in to continue"));
    }
}
