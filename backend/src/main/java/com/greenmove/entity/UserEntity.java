package com.greenmove.entity;

import jakarta.persistence.*;
import java.time.Instant;

@Entity
@Table(name = "app_users")
public class UserEntity {

    @Id
    private String id;

    @Column(nullable = false)
    private String name;

    @Column(nullable = false, unique = true)
    private String email;

    @Column(nullable = false)
    private String role; // USER or ADMIN

    @Column(nullable = false)
    private String status; // ACTIVE or DISABLED

    @Column(name = "joined_date")
    private String joinedDate;

    @Column(name = "last_active")
    private String lastActive;

    @Column(name = "password_hash")
    private String passwordHash;

    @Column(name = "auth_provider", nullable = false)
    private String authProvider = "LOCAL"; // LOCAL or GOOGLE

    @Column(name = "google_id")
    private String googleId;

    public UserEntity() {}

    public UserEntity(String id, String name, String email, String role, String status, String joinedDate, String lastActive) {
        this.id = id;
        this.name = name;
        this.email = email;
        this.role = role;
        this.status = status;
        this.joinedDate = joinedDate;
        this.lastActive = lastActive;
    }

    public UserEntity(String id, String name, String email, String role, String status, String joinedDate,
                       String lastActive, String passwordHash, String authProvider, String googleId) {
        this.id = id;
        this.name = name;
        this.email = email;
        this.role = role;
        this.status = status;
        this.joinedDate = joinedDate;
        this.lastActive = lastActive;
        this.passwordHash = passwordHash;
        this.authProvider = authProvider;
        this.googleId = googleId;
    }

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }

    public String getName() { return name; }
    public void setName(String name) { this.name = name; }

    public String getEmail() { return email; }
    public void setEmail(String email) { this.email = email; }

    public String getRole() { return role; }
    public void setRole(String role) { this.role = role; }

    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }

    public String getJoinedDate() { return joinedDate; }
    public void setJoinedDate(String joinedDate) { this.joinedDate = joinedDate; }

    public String getLastActive() { return lastActive; }
    public void setLastActive(String lastActive) { this.lastActive = lastActive; }

    public String getPasswordHash() { return passwordHash; }
    public void setPasswordHash(String passwordHash) { this.passwordHash = passwordHash; }

    public String getAuthProvider() { return authProvider; }
    public void setAuthProvider(String authProvider) { this.authProvider = authProvider; }

    public String getGoogleId() { return googleId; }
    public void setGoogleId(String googleId) { this.googleId = googleId; }
}
