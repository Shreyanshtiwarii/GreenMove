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

        @NotBlank(message = "Destination is required")
        @jakarta.validation.constraints.Size(max = 255, message = "Destination is too long")
        private String destination;

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
        public String getDestination() { return destination; }
        public void setDestination(String destination) { this.destination = destination; }
        public LocalDateTime getDepartureTime() { return departureTime; }
        public void setDepartureTime(LocalDateTime departureTime) { this.departureTime = departureTime; }
        public Integer getTotalSeats() { return totalSeats; }
        public void setTotalSeats(Integer totalSeats) { this.totalSeats = totalSeats; }
        public Double getCostPerPassenger() { return costPerPassenger; }
        public void setCostPerPassenger(Double costPerPassenger) { this.costPerPassenger = costPerPassenger; }
    }

    public static class PoolResponse {
        private String id;
        private String creatorId;
        private String creatorName;
        private String startLocation;
        private String destination;
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
        public String getDestination() { return destination; }
        public void setDestination(String destination) { this.destination = destination; }
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
