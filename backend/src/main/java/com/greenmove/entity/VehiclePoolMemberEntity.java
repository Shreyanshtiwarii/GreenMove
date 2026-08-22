package com.greenmove.entity;

import jakarta.persistence.*;
import java.time.LocalDateTime;

/**
 * Records a single authenticated user's seat reservation ("join") on a
 * {@link VehiclePoolEntity}. One row = one occupied seat.
 */
@Entity
@Table(name = "vehicle_pool_member", uniqueConstraints = {
        @UniqueConstraint(name = "uk_pool_member", columnNames = {"pool_id", "user_id"})
})
public class VehiclePoolMemberEntity {

    @Id
    @Column(name = "id", length = 100, nullable = false)
    private String id;

    @Column(name = "pool_id", length = 100, nullable = false)
    private String poolId;

    @Column(name = "user_id", length = 100, nullable = false)
    private String userId;

    @Column(name = "user_name", length = 255, nullable = false)
    private String userName;

    @Column(name = "joined_at", nullable = false)
    private LocalDateTime joinedAt = LocalDateTime.now();

    @Column(name = "pickup_location", length = 255)
    private String pickupLocation;

    @Column(name = "pickup_lat")
    private Double pickupLat;

    @Column(name = "pickup_lng")
    private Double pickupLng;

    @Column(name = "pickup_geom", columnDefinition = "geometry(Point, 4326)")
    private org.locationtech.jts.geom.Point pickupGeom;

    @Column(name = "dropoff_location", length = 255)
    private String dropoffLocation;

    @Column(name = "dropoff_lat")
    private Double dropoffLat;

    @Column(name = "dropoff_lng")
    private Double dropoffLng;

    @Column(name = "dropoff_geom", columnDefinition = "geometry(Point, 4326)")
    private org.locationtech.jts.geom.Point dropoffGeom;

    public VehiclePoolMemberEntity() {}

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }

    public String getPoolId() { return poolId; }
    public void setPoolId(String poolId) { this.poolId = poolId; }

    public String getUserId() { return userId; }
    public void setUserId(String userId) { this.userId = userId; }

    public String getUserName() { return userName; }
    public void setUserName(String userName) { this.userName = userName; }

    public LocalDateTime getJoinedAt() { return joinedAt; }
    public void setJoinedAt(LocalDateTime joinedAt) { this.joinedAt = joinedAt; }

    public String getPickupLocation() { return pickupLocation; }
    public void setPickupLocation(String pickupLocation) { this.pickupLocation = pickupLocation; }
    public Double getPickupLat() { return pickupLat; }
    public void setPickupLat(Double pickupLat) { this.pickupLat = pickupLat; }
    public Double getPickupLng() { return pickupLng; }
    public void setPickupLng(Double pickupLng) { this.pickupLng = pickupLng; }
    public org.locationtech.jts.geom.Point getPickupGeom() { return pickupGeom; }
    public void setPickupGeom(org.locationtech.jts.geom.Point pickupGeom) { this.pickupGeom = pickupGeom; }

    public String getDropoffLocation() { return dropoffLocation; }
    public void setDropoffLocation(String dropoffLocation) { this.dropoffLocation = dropoffLocation; }
    public Double getDropoffLat() { return dropoffLat; }
    public void setDropoffLat(Double dropoffLat) { this.dropoffLat = dropoffLat; }
    public Double getDropoffLng() { return dropoffLng; }
    public void setDropoffLng(Double dropoffLng) { this.dropoffLng = dropoffLng; }
    public org.locationtech.jts.geom.Point getDropoffGeom() { return dropoffGeom; }
    public void setDropoffGeom(org.locationtech.jts.geom.Point dropoffGeom) { this.dropoffGeom = dropoffGeom; }
}
