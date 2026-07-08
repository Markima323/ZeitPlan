package com.zeitplan.backend.service;

import com.zeitplan.backend.dto.KindleEventResponse;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Component;
import org.springframework.web.context.request.async.DeferredResult;

import java.util.List;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.function.Supplier;

@Component
public class KindlePushChannelManager {

    private final ConcurrentHashMap<String, CopyOnWriteArrayList<Waiter>> waitersByDeviceId = new ConcurrentHashMap<>();

    public void register(
            String deviceId,
            DeferredResult<ResponseEntity<KindleEventResponse>> result,
            Supplier<ResponseEntity<KindleEventResponse>> responseSupplier
    ) {
        Waiter waiter = new Waiter(result, responseSupplier);
        waitersByDeviceId.computeIfAbsent(deviceId, ignored -> new CopyOnWriteArrayList<>()).add(waiter);

        result.onTimeout(() -> {
            remove(deviceId, waiter);
            if (!result.isSetOrExpired()) {
                result.setResult(ResponseEntity.noContent().build());
            }
        });
        result.onCompletion(() -> remove(deviceId, waiter));
    }

    public void notifyDevice(String deviceId) {
        List<Waiter> waiters = waitersByDeviceId.remove(deviceId);
        if (waiters == null) {
            return;
        }

        for (Waiter waiter : waiters) {
            if (!waiter.result().isSetOrExpired()) {
                waiter.result().setResult(waiter.responseSupplier().get());
            }
        }
    }

    private void remove(String deviceId, Waiter waiter) {
        CopyOnWriteArrayList<Waiter> waiters = waitersByDeviceId.get(deviceId);
        if (waiters == null) {
            return;
        }

        waiters.remove(waiter);
        if (waiters.isEmpty()) {
            waitersByDeviceId.remove(deviceId, waiters);
        }
    }

    private record Waiter(
            DeferredResult<ResponseEntity<KindleEventResponse>> result,
            Supplier<ResponseEntity<KindleEventResponse>> responseSupplier
    ) {
    }
}
