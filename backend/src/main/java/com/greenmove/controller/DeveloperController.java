package com.greenmove.controller;

import com.greenmove.service.DeveloperService;
import com.greenmove.service.AdminService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.*;

@RestController
@RequestMapping("/api/v1/developer")
public class DeveloperController {

    @Autowired
    private DeveloperService developerService;

    @Autowired
    private AdminService adminService;

    public static class DeveloperLoginRequest {
        public String username;
        public String password;
    }

    @PostMapping("/login")
    public ResponseEntity<?> login(@RequestBody DeveloperLoginRequest request) {
        // Defensive null-checks: previously request.username.trim() / request.password.trim()
        // threw an unhandled NullPointerException (surfaced to the client as an opaque 500) for
        // any request missing either field, instead of the intended 401 "invalid credentials".
        String username = request != null && request.username != null ? request.username.trim() : null;
        String password = request != null && request.password != null ? request.password.trim() : null;

        if (username != null && password != null
                && ("nandni".equalsIgnoreCase(username) || "nandini".equalsIgnoreCase(username))
                && ("nandni".equals(password) || "nandini".equals(password))) {

            Map<String, Object> response = new HashMap<>();
            response.put("success", true);
            response.put("token", "dev_token_" + UUID.randomUUID().toString());
            response.put("username", username);
            response.put("role", "DEVELOPER");
            response.put("name", "GreenMove Lead Developer");

            adminService.logAudit(username, "Developer Login", "Authentication", "Developer user authenticated successfully", "SUCCESS");
            return ResponseEntity.ok(response);
        }
        return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
            .body(Map.of("success", false, "message", "Invalid developer credentials"));
    }

    @GetMapping("/diagnostics")
    public ResponseEntity<Map<String, Object>> getDiagnostics() {
        return ResponseEntity.ok(developerService.getDeveloperDiagnostics());
    }

    @GetMapping("/logs")
    public ResponseEntity<List<Map<String, String>>> getLogs() {
        return ResponseEntity.ok(developerService.getDeveloperLogs());
    }
}
