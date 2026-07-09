package com.zeitplan.backend.repository;

import com.zeitplan.backend.entity.KindleDeviceEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface KindleDeviceRepository extends JpaRepository<KindleDeviceEntity, String> {

    List<KindleDeviceEntity> findAllByOwnerUserIdOrderByCreatedAtAsc(String ownerUserId);

    List<KindleDeviceEntity> findAllByOwnerUserIdAndEnabledTrueOrderByCreatedAtAsc(String ownerUserId);

    List<KindleDeviceEntity> findAllByOwnerUserIdAndEnabledTrueAndAutoPushEnabledTrueOrderByCreatedAtAsc(String ownerUserId);

    Optional<KindleDeviceEntity> findByDeviceTokenHash(String deviceTokenHash);
}
