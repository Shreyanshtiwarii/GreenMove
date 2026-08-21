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
}
