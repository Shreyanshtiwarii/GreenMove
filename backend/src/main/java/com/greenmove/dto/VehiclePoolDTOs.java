package com.greenmove.dto;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

import java.time.LocalDateTime;
import java.util.List;

/**
 * Request and response payloads for /api/v1/pools/** (the "Vehicle Pool" feature).
 * Grouped in a single file to mirror the project's existing lightweight DTO style (see AuthDTOs).
 */
public class VehiclePoolDTOs {

    public static class CreatePoolRequest {
        @NotBlank(message = "Start location is required")
        @jakarta.validation.constraints.Size(max = 255, message = "Start location is too long")
        private String startLocation;

        @NotNull(message = "Start latitude is required")
        private Double startLatitude;

        @NotNull(message = "Start longitude is required")
        private Double startLongitude;

        @NotBlank(message = "Destination is required")
        @jakarta.validation.constraints.Size(max = 255, message = "Destination is too long")
        private String destination;

        @NotNull(message = "Destination latitude is required")
        private Double destinationLatitude;

        @NotNull(message = "Destination longitude is required")
        private Double destinationLongitude;

        @NotNull(message = "Departure date/time is required")
        private LocalDateTime departureTime;

        @NotNull(message = "Available seats is required")
        @Min(value = 1, message = "A pool must offer at least 1 seat")
        @Max(value = 20, message = "A pool cannot offer more than 20 seats")
        private Integer totalSeats;

        @NotNull(message = "Cost per passenger is required")
        @DecimalMin(value = "0.0", message = "Cost per passenger cannot be negative")
        private Double costPerPassenger;

        public String getStartLocation() { return startLocation; }
        public void setStartLocation(String startLocation) { this.startLocation = startLocation; }
        public Double getStartLatitude() { return startLatitude; }
        public void setStartLatitude(Double startLatitude) { this.startLatitude = startLatitude; }
        public Double getStartLongitude() { return startLongitude; }
        public void setStartLongitude(Double startLongitude) { this.startLongitude = startLongitude; }
        public String getDestination() { return destination; }
        public void setDestination(String destination) { this.destination = destination; }
        public Double getDestinationLatitude() { return destinationLatitude; }
        public void setDestinationLatitude(Double destinationLatitude) { this.destinationLatitude = destinationLatitude; }
        public Double getDestinationLongitude() { return destinationLongitude; }
        public void setDestinationLongitude(Double destinationLongitude) { this.destinationLongitude = destinationLongitude; }
        public LocalDateTime getDepartureTime() { return departureTime; }
        public void setDepartureTime(LocalDateTime departureTime) { this.departureTime = departureTime; }
        public Integer getTotalSeats() { return totalSeats; }
        public void setTotalSeats(Integer totalSeats) { this.totalSeats = totalSeats; }
        public Double getCostPerPassenger() { return costPerPassenger; }
        public void setCostPerPassenger(Double costPerPassenger) { this.costPerPassenger = costPerPassenger; }
    }

    public static class JoinPoolRequest {
        private String pickupLocation;
        private Double pickupLatitude;
        private Double pickupLongitude;
        private String dropoffLocation;
        private Double dropoffLatitude;
        private Double dropoffLongitude;
        public String getPickupLocation() { return pickupLocation; }
        public void setPickupLocation(String pickupLocation) { this.pickupLocation = pickupLocation; }
        public Double getPickupLatitude() { return pickupLatitude; }
        public void setPickupLatitude(Double pickupLatitude) { this.pickupLatitude = pickupLatitude; }
        public Double getPickupLongitude() { return pickupLongitude; }
        public void setPickupLongitude(Double pickupLongitude) { this.pickupLongitude = pickupLongitude; }
        public String getDropoffLocation() { return dropoffLocation; }
        public void setDropoffLocation(String dropoffLocation) { this.dropoffLocation = dropoffLocation; }
        public Double getDropoffLatitude() { return dropoffLatitude; }
        public void setDropoffLatitude(Double dropoffLatitude) { this.dropoffLatitude = dropoffLatitude; }
        public Double getDropoffLongitude() { return dropoffLongitude; }
        public void setDropoffLongitude(Double dropoffLongitude) { this.dropoffLongitude = dropoffLongitude; }
    }

    public static class PoolResponse {
        private String id;
        private String creatorId;
        private String creatorName;
        private String startLocation;
        private Double startLatitude;
        private Double startLongitude;
        private String destination;
        private Double destinationLatitude;
        private Double destinationLongitude;
        private Double routeDistanceMeters;
        private Integer routeDurationSeconds;
        private Double pickupDistanceMeters;
        private Double dropoffDistanceMeters;
        private boolean candidate;
        private Double pickupRoutePosition;
        private Double dropoffRoutePosition;
        private boolean directionCompatible;
        private Double passengerRouteDistanceMeters;
        private Integer passengerRouteDurationSeconds;
        private Double driverSegmentDistanceMeters;
        private Double routeOverlapPercentage;
        private Double originalDriverDistanceMeters;
        private Double newDriverDistanceMeters;
        private Double detourDistanceMeters;
        private Double detourPercentage;
        private Integer originalDriverDurationSeconds;
        private Integer newDriverDurationSeconds;
        private Integer detourDurationSeconds;
        private boolean detourCompatible;
        private boolean routeOverlapCompatible;
                private boolean phase5Compatible;
        
        // Phase 6 Match Scoring
        private Double matchScore;
        private Integer matchRank;
        private Double overlapScore;
        private Double pickupScore;
        private Double dropoffScore;
        private Double detourScore;
        private Double timeScore;

        private LocalDateTime departureTime;
        private Integer totalSeats;
        private Integer availableSeats;
        private Integer occupiedSeats;
        private Double costPerPassenger;
        private Double totalCost;
        private String status;
        private LocalDateTime createdAt;
        private boolean full;
        private boolean past;
        private boolean own;
        private boolean joined;
        /** Whether the pool can still be manually ended (completed/terminated) by its creator. */
        private boolean canEnd;
        /**
         * Member list (name + joined time only, no user id) for the creator's own pools.
         * Left null for the public browse listing to avoid exposing passenger details to everyone.
         */
        private List<PoolMemberResponse> members;

        public PoolResponse() {}

        public String getId() { return id; }
        public void setId(String id) { this.id = id; }
        public String getCreatorId() { return creatorId; }
        public void setCreatorId(String creatorId) { this.creatorId = creatorId; }
        public String getCreatorName() { return creatorName; }
        public void setCreatorName(String creatorName) { this.creatorName = creatorName; }
        public String getStartLocation() { return startLocation; }
        public void setStartLocation(String startLocation) { this.startLocation = startLocation; }
        public Double getStartLatitude() { return startLatitude; }
        public void setStartLatitude(Double startLatitude) { this.startLatitude = startLatitude; }
        public Double getStartLongitude() { return startLongitude; }
        public void setStartLongitude(Double startLongitude) { this.startLongitude = startLongitude; }
        public String getDestination() { return destination; }
        public void setDestination(String destination) { this.destination = destination; }
        public Double getDestinationLatitude() { return destinationLatitude; }
        public void setDestinationLatitude(Double destinationLatitude) { this.destinationLatitude = destinationLatitude; }
        public Double getDestinationLongitude() { return destinationLongitude; }
        public void setDestinationLongitude(Double destinationLongitude) { this.destinationLongitude = destinationLongitude; }
        public Double getRouteDistanceMeters() { return routeDistanceMeters; }
        public void setRouteDistanceMeters(Double routeDistanceMeters) { this.routeDistanceMeters = routeDistanceMeters; }
        public Integer getRouteDurationSeconds() { return routeDurationSeconds; }
        public void setRouteDurationSeconds(Integer routeDurationSeconds) { this.routeDurationSeconds = routeDurationSeconds; }
        public Double getPickupDistanceMeters() { return pickupDistanceMeters; }
        public void setPickupDistanceMeters(Double pickupDistanceMeters) { this.pickupDistanceMeters = pickupDistanceMeters; }
        public Double getDropoffDistanceMeters() { return dropoffDistanceMeters; }
        public void setDropoffDistanceMeters(Double dropoffDistanceMeters) { this.dropoffDistanceMeters = dropoffDistanceMeters; }
        public boolean isCandidate() { return candidate; }
        public void setCandidate(boolean candidate) { this.candidate = candidate; }
        public Double getPickupRoutePosition() { return pickupRoutePosition; }
        public void setPickupRoutePosition(Double pickupRoutePosition) { this.pickupRoutePosition = pickupRoutePosition; }
        public Double getDropoffRoutePosition() { return dropoffRoutePosition; }
        public void setDropoffRoutePosition(Double dropoffRoutePosition) { this.dropoffRoutePosition = dropoffRoutePosition; }
        public boolean isDirectionCompatible() { return directionCompatible; }
        public void setDirectionCompatible(boolean directionCompatible) { this.directionCompatible = directionCompatible; }
        
        public Double getPassengerRouteDistanceMeters() { return passengerRouteDistanceMeters; }
        public void setPassengerRouteDistanceMeters(Double passengerRouteDistanceMeters) { this.passengerRouteDistanceMeters = passengerRouteDistanceMeters; }
        public Integer getPassengerRouteDurationSeconds() { return passengerRouteDurationSeconds; }
        public void setPassengerRouteDurationSeconds(Integer passengerRouteDurationSeconds) { this.passengerRouteDurationSeconds = passengerRouteDurationSeconds; }
        public Double getDriverSegmentDistanceMeters() { return driverSegmentDistanceMeters; }
        public void setDriverSegmentDistanceMeters(Double driverSegmentDistanceMeters) { this.driverSegmentDistanceMeters = driverSegmentDistanceMeters; }
        public Double getRouteOverlapPercentage() { return routeOverlapPercentage; }
        public void setRouteOverlapPercentage(Double routeOverlapPercentage) { this.routeOverlapPercentage = routeOverlapPercentage; }
        public Double getOriginalDriverDistanceMeters() { return originalDriverDistanceMeters; }
        public void setOriginalDriverDistanceMeters(Double originalDriverDistanceMeters) { this.originalDriverDistanceMeters = originalDriverDistanceMeters; }
        public Double getNewDriverDistanceMeters() { return newDriverDistanceMeters; }
        public void setNewDriverDistanceMeters(Double newDriverDistanceMeters) { this.newDriverDistanceMeters = newDriverDistanceMeters; }
        public Double getDetourDistanceMeters() { return detourDistanceMeters; }
        public void setDetourDistanceMeters(Double detourDistanceMeters) { this.detourDistanceMeters = detourDistanceMeters; }
        public Double getDetourPercentage() { return detourPercentage; }
        public void setDetourPercentage(Double detourPercentage) { this.detourPercentage = detourPercentage; }
        public Integer getOriginalDriverDurationSeconds() { return originalDriverDurationSeconds; }
        public void setOriginalDriverDurationSeconds(Integer originalDriverDurationSeconds) { this.originalDriverDurationSeconds = originalDriverDurationSeconds; }
        public Integer getNewDriverDurationSeconds() { return newDriverDurationSeconds; }
        public void setNewDriverDurationSeconds(Integer newDriverDurationSeconds) { this.newDriverDurationSeconds = newDriverDurationSeconds; }
        public Integer getDetourDurationSeconds() { return detourDurationSeconds; }
        public void setDetourDurationSeconds(Integer detourDurationSeconds) { this.detourDurationSeconds = detourDurationSeconds; }
        public boolean isDetourCompatible() { return detourCompatible; }
        public void setDetourCompatible(boolean detourCompatible) { this.detourCompatible = detourCompatible; }
        public boolean isRouteOverlapCompatible() { return routeOverlapCompatible; }
        public void setRouteOverlapCompatible(boolean routeOverlapCompatible) { this.routeOverlapCompatible = routeOverlapCompatible; }
        public boolean isPhase5Compatible() { return phase5Compatible; }
        public void setPhase5Compatible(boolean phase5Compatible) { this.phase5Compatible = phase5Compatible; }
        
        public Double getMatchScore() { return matchScore; }
        public void setMatchScore(Double matchScore) { this.matchScore = matchScore; }
        public Integer getMatchRank() { return matchRank; }
        public void setMatchRank(Integer matchRank) { this.matchRank = matchRank; }
        public Double getOverlapScore() { return overlapScore; }
        public void setOverlapScore(Double overlapScore) { this.overlapScore = overlapScore; }
        public Double getPickupScore() { return pickupScore; }
        public void setPickupScore(Double pickupScore) { this.pickupScore = pickupScore; }
        public Double getDropoffScore() { return dropoffScore; }
        public void setDropoffScore(Double dropoffScore) { this.dropoffScore = dropoffScore; }
        public Double getDetourScore() { return detourScore; }
        public void setDetourScore(Double detourScore) { this.detourScore = detourScore; }
        public Double getTimeScore() { return timeScore; }
        public void setTimeScore(Double timeScore) { this.timeScore = timeScore; }

        public LocalDateTime getDepartureTime() { return departureTime; }
        public void setDepartureTime(LocalDateTime departureTime) { this.departureTime = departureTime; }
        public Integer getTotalSeats() { return totalSeats; }
        public void setTotalSeats(Integer totalSeats) { this.totalSeats = totalSeats; }
        public Integer getAvailableSeats() { return availableSeats; }
        public void setAvailableSeats(Integer availableSeats) { this.availableSeats = availableSeats; }
        public Integer getOccupiedSeats() { return occupiedSeats; }
        public void setOccupiedSeats(Integer occupiedSeats) { this.occupiedSeats = occupiedSeats; }
        public Double getCostPerPassenger() { return costPerPassenger; }
        public void setCostPerPassenger(Double costPerPassenger) { this.costPerPassenger = costPerPassenger; }
        public Double getTotalCost() { return totalCost; }
        public void setTotalCost(Double totalCost) { this.totalCost = totalCost; }
        public String getStatus() { return status; }
        public void setStatus(String status) { this.status = status; }
        public LocalDateTime getCreatedAt() { return createdAt; }
        public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
        public boolean isFull() { return full; }
        public void setFull(boolean full) { this.full = full; }
        public boolean isPast() { return past; }
        public void setPast(boolean past) { this.past = past; }
        public boolean isOwn() { return own; }
        public void setOwn(boolean own) { this.own = own; }
        public boolean isJoined() { return joined; }
        public void setJoined(boolean joined) { this.joined = joined; }
        public boolean isCanEnd() { return canEnd; }
        public void setCanEnd(boolean canEnd) { this.canEnd = canEnd; }
        public List<PoolMemberResponse> getMembers() { return members; }
        public void setMembers(List<PoolMemberResponse> members) { this.members = members; }
    }

    /** A single passenger on a pool, as shown to the pool's creator. */
    public static class PoolMemberResponse {
        private String userName;
        private LocalDateTime joinedAt;

        public PoolMemberResponse() {}
        public PoolMemberResponse(String userName, LocalDateTime joinedAt) {
            this.userName = userName;
            this.joinedAt = joinedAt;
        }

        public String getUserName() { return userName; }
        public void setUserName(String userName) { this.userName = userName; }
        public LocalDateTime getJoinedAt() { return joinedAt; }
        public void setJoinedAt(LocalDateTime joinedAt) { this.joinedAt = joinedAt; }
    }
}
