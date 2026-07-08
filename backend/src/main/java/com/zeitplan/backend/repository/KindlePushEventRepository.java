package com.zeitplan.backend.repository;

import com.zeitplan.backend.entity.KindlePushEventEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface KindlePushEventRepository extends JpaRepository<KindlePushEventEntity, String> {

    List<KindlePushEventEntity> findTop20ByDeviceIdOrderByCreatedAtDesc(String deviceId);
}
