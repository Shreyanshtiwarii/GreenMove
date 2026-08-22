package com.greenmove.controller;

import com.greenmove.entity.VehiclePoolEntity;
import com.greenmove.entity.VehiclePoolMemberEntity;
import com.greenmove.repository.VehiclePoolMemberRepository;
import com.greenmove.repository.VehiclePoolRepository;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.time.DayOfWeek;
import java.time.LocalDateTime;
import java.time.temporal.TemporalAdjusters;
import java.util.*;

@RestController
@RequestMapping("/api/v1/impact")
public class ImpactController {

    private final VehiclePoolMemberRepository memberRepository;
    private final VehiclePoolRepository poolRepository;

    public ImpactController(VehiclePoolMemberRepository memberRepository, VehiclePoolRepository poolRepository) {
        this.memberRepository = memberRepository;
        this.poolRepository = poolRepository;
    }

    @GetMapping("/me")
    public ResponseEntity<Map<String, Object>> getMyImpact(Authentication authentication) {
        if (authentication == null || authentication.getName() == null) {
            return ResponseEntity.status(401).build();
        }
        String userId = authentication.getName();

        List<VehiclePoolMemberEntity> members = memberRepository.findByUserId(userId);
        double totalMoneySaved = 0.0;
        double totalCo2Saved = 0.0;
        int completedTrips = 0;
        double sharedDistanceKm = 0.0;
        double totalSoloCost = 0.0;
        double totalCarpoolCost = 0.0;

        LocalDateTime now = LocalDateTime.now();
        LocalDateTime monday = now.with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY)).withHour(0).withMinute(0).withSecond(0).withNano(0);
        LocalDateTime nextMonday = monday.plusDays(7);

        double[] weeklyCo2Saved = new double[7];

        for (VehiclePoolMemberEntity mem : members) {
            if ("CREDITED".equals(mem.getStatus())) {
                completedTrips++;
                if (mem.getMoneySaved() != null) totalMoneySaved += mem.getMoneySaved();
                if (mem.getCo2SavedKg() != null) totalCo2Saved += mem.getCo2SavedKg();
                if (mem.getPassengerRouteDistanceMeters() != null) sharedDistanceKm += mem.getPassengerRouteDistanceMeters() / 1000.0;
                if (mem.getSoloCost() != null) totalSoloCost += mem.getSoloCost();
                
                VehiclePoolEntity pool = poolRepository.findById(mem.getPoolId()).orElse(null);
                if (pool != null && pool.getCostPerPassenger() != null) {
                    totalCarpoolCost += pool.getCostPerPassenger();
                }

                LocalDateTime completedAt = mem.getJoinedAt();
                if (completedAt != null && !completedAt.isBefore(monday) && completedAt.isBefore(nextMonday)) {
                    int dayIndex = completedAt.getDayOfWeek().getValue() - 1;
                    if (mem.getCo2SavedKg() != null) {
                        weeklyCo2Saved[dayIndex] += mem.getCo2SavedKg();
                    }
                }
            }
        }

        double score = 0;
        if (completedTrips > 0) {
            score = 40.0 + (completedTrips * 2.0) + (totalCo2Saved * 0.5) + (totalMoneySaved * 0.01);
            if (score > 100) score = 100;
        }
        int ecoScore = (int) Math.round(score);

        List<Map<String, Object>> weeklyData = new ArrayList<>();
        String[] dayNames = {"Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"};
        int currentDayIndex = now.getDayOfWeek().getValue() - 1;
        for (int i = 0; i < 7; i++) {
            Map<String, Object> dayInfo = new HashMap<>();
            dayInfo.put("day", dayNames[i]);
            dayInfo.put("co2Saved", weeklyCo2Saved[i]);
            dayInfo.put("isToday", i == currentDayIndex);
            weeklyData.add(dayInfo);
        }

        Map<String, Object> resp = new HashMap<>();
        resp.put("moneySaved", totalMoneySaved);
        resp.put("co2SavedKg", totalCo2Saved);
        resp.put("completedTrips", completedTrips);
        resp.put("soloTripsAvoided", completedTrips);
        resp.put("sharedDistanceKm", sharedDistanceKm);
        resp.put("totalSoloCost", totalSoloCost);
        resp.put("totalCarpoolCost", totalCarpoolCost);
        resp.put("averageSavingPerTrip", completedTrips > 0 ? totalMoneySaved / completedTrips : 0.0);
        resp.put("realizedSavings", totalMoneySaved);
        resp.put("ecoScore", ecoScore);
        resp.put("weeklyData", weeklyData);
        return ResponseEntity.ok(resp);
    }
}
