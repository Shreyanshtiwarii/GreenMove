package com.greenmove.controller;

import com.greenmove.dto.AuthDTOs.*;
import com.greenmove.entity.UserEntity;
import com.greenmove.repository.UserRepository;
import com.greenmove.security.JwtService;
import com.greenmove.service.GoogleTokenVerifierService;
import com.greenmove.service.GoogleTokenVerifierService.GoogleProfile;
import jakarta.validation.Valid;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/auth")
public class AuthController {

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private PasswordEncoder passwordEncoder;

    @Autowired
    private JwtService jwtService;

    @Autowired
    private GoogleTokenVerifierService googleTokenVerifierService;

    @PostMapping("/register")
    public ResponseEntity<?> register(@Valid @RequestBody RegisterRequest request) {
        if (!request.getPassword().equals(request.getConfirmPassword())) {
            return ResponseEntity.badRequest().body(Map.of("message", "Passwords do not match"));
        }
        String normalizedEmail = request.getEmail().trim().toLowerCase();

        if (userRepository.existsByEmailIgnoreCase(normalizedEmail)) {
            return ResponseEntity.status(HttpStatus.CONFLICT)
                    .body(Map.of("message", "An account with this email already exists"));
        }

        UserEntity user = new UserEntity(
                "usr_" + UUID.randomUUID().toString().replace("-", "").substring(0, 16),
                request.getName().trim(),
                normalizedEmail,
                "USER",
                "ACTIVE",
                LocalDate.now().format(DateTimeFormatter.ISO_LOCAL_DATE),
                "Just now",
                passwordEncoder.encode(request.getPassword()),
                "LOCAL",
                null
        );

        userRepository.save(user);

        String token = jwtService.generateToken(user.getId(), user.getEmail(), user.getRole());
        return ResponseEntity.status(HttpStatus.CREATED).body(new AuthResponse(token, toSummary(user)));
    }

    @PostMapping("/login")
    public ResponseEntity<?> login(@Valid @RequestBody LoginRequest request) {
        String normalizedEmail = request.getEmail().trim().toLowerCase();

        return userRepository.findByEmailIgnoreCase(normalizedEmail)
                .map(user -> {
                    if (!"LOCAL".equals(user.getAuthProvider()) || user.getPasswordHash() == null) {
                        return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                                .body((Object) Map.of("message", "This email is registered via Google Sign-In. Please continue with Google."));
                    }
                    if (!"ACTIVE".equalsIgnoreCase(user.getStatus())) {
                        return ResponseEntity.status(HttpStatus.FORBIDDEN)
                                .body((Object) Map.of("message", "This account has been disabled. Contact support for help."));
                    }
                    if (!passwordEncoder.matches(request.getPassword(), user.getPasswordHash())) {
                        return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                                .body((Object) Map.of("message", "Incorrect email or password"));
                    }

                    user.setLastActive("Just now");
                    userRepository.save(user);

                    String token = jwtService.generateToken(user.getId(), user.getEmail(), user.getRole());
                    return ResponseEntity.ok((Object) new AuthResponse(token, toSummary(user)));
                })
                .orElseGet(() -> ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                        .body(Map.of("message", "Incorrect email or password")));
    }

    @PostMapping("/google")
    public ResponseEntity<?> googleAuth(@Valid @RequestBody GoogleAuthRequest request) {
        if (!googleTokenVerifierService.isConfigured()) {
            return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE)
                    .body(Map.of("message", "Google Sign-In is not configured on the server yet. Set GOOGLE_CLIENT_ID to enable it."));
        }

        GoogleProfile profile = googleTokenVerifierService.verify(request.getIdToken());
        if (profile == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(Map.of("message", "Google sign-in failed. Please try again."));
        }
        if (!profile.emailVerified) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(Map.of("message", "Your Google email is not verified."));
        }

        String normalizedEmail = profile.email.trim().toLowerCase();

        UserEntity user = userRepository.findByGoogleId(profile.googleId)
                .or(() -> userRepository.findByEmailIgnoreCase(normalizedEmail))
                .orElse(null);

        if (user == null) {
            user = new UserEntity(
                    "usr_" + UUID.randomUUID().toString().replace("-", "").substring(0, 16),
                    profile.name != null ? profile.name : normalizedEmail,
                    normalizedEmail,
                    "USER",
                    "ACTIVE",
                    LocalDate.now().format(DateTimeFormatter.ISO_LOCAL_DATE),
                    "Just now",
                    null,
                    "GOOGLE",
                    profile.googleId
            );
        } else {
            if (!"ACTIVE".equalsIgnoreCase(user.getStatus())) {
                return ResponseEntity.status(HttpStatus.FORBIDDEN)
                        .body(Map.of("message", "This account has been disabled. Contact support for help."));
            }
            // Link Google identity to an existing account (e.g. one originally created with a password).
            user.setGoogleId(profile.googleId);
            if (user.getAuthProvider() == null) {
                user.setAuthProvider("GOOGLE");
            }
            user.setLastActive("Just now");
        }
        userRepository.save(user);

        String token = jwtService.generateToken(user.getId(), user.getEmail(), user.getRole());
        return ResponseEntity.ok(new AuthResponse(token, toSummary(user)));
    }

    @GetMapping("/me")
    public ResponseEntity<?> me(Authentication authentication) {
        if (authentication == null || authentication.getName() == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of("message", "Not authenticated"));
        }
        return userRepository.findById(authentication.getName())
                .<ResponseEntity<?>>map(user -> ResponseEntity.ok(toSummary(user)))
                .orElseGet(() -> ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of("message", "User not found")));
    }

    private UserSummary toSummary(UserEntity user) {
        return new UserSummary(user.getId(), user.getName(), user.getEmail(), user.getRole(), user.getAuthProvider());
    }
}
