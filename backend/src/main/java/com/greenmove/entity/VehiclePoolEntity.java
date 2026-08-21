package com.greenmove.entity;

import jakarta.persistence.*;
import java.time.LocalDateTime;

/**
 * A shared vehicle pool ("Vehicle Pool") created by a user, offering a fixed number
 * of seats to other authenticated users travelling the same route.
 */
@Entity
@Table(name = "vehicle_pool")
public class VehiclePoolEntity {

    @Id
    @Column(name = "id", length = 100, nullable = false)
    private String id;

    @Column(name = "creator_id", length = 100, nullable = false)
    private String creatorId;

    @Column(name = "creator_name", length = 255, nullable = false)
    private String creatorName;

    @Column(name = "start_location", length = 255, nullable = false)
    private String startLocation;

    @Column(name = "destination", length = 255, nullable = false)
    private String destination;

    @Column(name = "departure_time", nullable = false)
    private LocalDateTime departureTime;

    @Column(name = "total_seats", nullable = false)
    private Integer totalSeats;

    @Column(name = "available_seats", nullable = false)
    private Integer availableSeats;

    @Column(name = "cost_per_passenger", nullable = false)
    private Double costPerPassenger;

    @Column(name = "total_cost", nullable = false)
    private Double totalCost;

    @Column(name = "status", length = 50, nullable = false)
    private String status = "ACTIVE";

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt = LocalDateTime.now();

    public VehiclePoolEntity() {}

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

    public Double getCostPerPassenger() { return costPerPassenger; }
    public void setCostPerPassenger(Double costPerPassenger) { this.costPerPassenger = costPerPassenger; }

    public Double getTotalCost() { return totalCost; }
    public void setTotalCost(Double totalCost) { this.totalCost = totalCost; }

    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }

    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
}
