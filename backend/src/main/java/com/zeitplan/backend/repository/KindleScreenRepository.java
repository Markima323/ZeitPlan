package com.zeitplan.backend.repository;

import com.zeitplan.backend.entity.KindleScreenEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface KindleScreenRepository extends JpaRepository<KindleScreenEntity, String> {

    Optional<KindleScreenEntity> findByDeviceIdAndVersion(String deviceId, int version);
}
