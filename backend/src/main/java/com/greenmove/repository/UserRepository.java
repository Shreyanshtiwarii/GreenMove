package com.greenmove.repository;

import com.greenmove.entity.UserEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface UserRepository extends JpaRepository<UserEntity, String> {
    Optional<UserEntity> findByEmail(String email);
    Optional<UserEntity> findByEmailIgnoreCase(String email);
    Optional<UserEntity> findByGoogleId(String googleId);
    boolean existsByEmailIgnoreCase(String email);
    long countByStatus(String status);
}
