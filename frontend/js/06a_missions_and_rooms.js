/**
 * =========================================================================
 * BOXHEAD: THE CORE v3.6 — Frontend Module: 06a_missions_and_rooms.js
 * Sector Clear Verification, Thermite/Mission Stage Progression & Bulkhead Lock
 * Zero-Loss Refactored Architecture (Shared Global Lexical Scope)
 * =========================================================================
 */
"use strict";

    // =========================================================================
    // 14. ROOM PROGRESSION, MISSION CINEMATICS & THERMITE DETONATION
    // =========================================================================
    function spawnMissionStageVFX(x, z, colorHex, maxRadius, particleCount, withSkyBeam) {
      // 1. 바닥 에너지 충격파 링
      const ringGeo = new THREE.RingGeometry(0.45, maxRadius || 5.0, 32);
      const ringMat = new THREE.MeshBasicMaterial({
        color: colorHex,
        transparent: true,
        opacity: 0.88,
        side: THREE.DoubleSide
      });
      const ringMesh = new THREE.Mesh(ringGeo, ringMat);
      ringMesh.rotation.x = -Math.PI / 2;
      ringMesh.position.set(x, 0.1, z);
      effectsGroup.add(ringMesh);
      game.particles.push({ mesh: ringMesh, life: 0.48, maxLife: 0.48, expand: 1.45 });

      // 2. 입체 스파크/에너지 파편 방출
      const count = particleCount || 14;
      for (let i = 0; i < count; i++) {
        const ang = (i / count) * Math.PI * 2 + Math.random() * 0.35;
        const spd = 4.0 + Math.random() * 6.5;
        const pMesh = new THREE.Mesh(
          new THREE.BoxGeometry(0.28, 0.28, 0.28),
          new THREE.MeshBasicMaterial({ color: i % 2 === 0 ? colorHex : 0xffffff })
        );
        pMesh.position.set(x, 0.8 + Math.random() * 0.8, z);
        effectsGroup.add(pMesh);
        game.particles.push({
          mesh: pMesh,
          life: 0.55,
          maxLife: 0.55,
          vx: Math.cos(ang) * spd,
          vy: 3.5 + Math.random() * 4.5,
          vz: Math.sin(ang) * spd
        });
      }

      // 3. 위성 업로드 또는 합성 완료 시 하늘로 치솟는 코어 광선 기둥
      if (withSkyBeam) {
        const beamMesh = new THREE.Mesh(
          new THREE.CylinderGeometry(0.55, 0.55, 26, 16),
          new THREE.MeshBasicMaterial({
            color: colorHex,
            transparent: true,
            opacity: 0.85
          })
        );
        beamMesh.position.set(x, 13.0, z);
        effectsGroup.add(beamMesh);
        game.particles.push({ mesh: beamMesh, life: 0.9, maxLife: 0.9, expand: 1.15 });
      }
    }

    // 테르밋 합성 완료(subStage=1) 및 방화벽 폭약 부착(subStage=2) 3D 비주얼 생성·관리
    function ensureThermiteDoorVisuals(room, door) {
      if (!room || !door || room.condType !== "THERMITE") return;

      // [Stage 1] 테르밋 합성 완료 후 방화벽 앞 부착 유도 마커 생성
      if (room.subStage === 1 && !room.cleared) {
        if (!door.targetMarkerGroup) {
          const tGroup = new THREE.Group();
          const tRing = new THREE.Mesh(
            new THREE.RingGeometry(1.3, 1.8, 28),
            new THREE.MeshBasicMaterial({
              color: 0xf97316,
              transparent: true,
              opacity: 0.85,
              side: THREE.DoubleSide
            })
          );
          tRing.rotation.x = -Math.PI / 2;
          tRing.position.y = 0.09;
          tGroup.add(tRing);
          const offX = (door.inNormX || 0) * 2.1;
          const offZ = (door.inNormZ || 0) * 2.1;
          tGroup.position.set(door.x + offX, 0, door.z + offZ);
          entitiesGroup.add(tGroup);
          door.targetMarkerGroup = tGroup;
          door.targetRingMesh = tRing;

          const markerRef = { done: false, roomIndex: room.index };
          door.thermiteMarkerRef = markerRef;
          door.thermiteMarkerSym = registerWorldSymbol(
            door.x + offX, 3.2, door.z + offZ,
            "🎯[목표] 방화벽에 테르밋 폭약 부착 [F]",
            "bg-orange-950/95 border-orange-400 text-orange-200",
            markerRef, room.index
          );
        }
      } else if (door.targetMarkerGroup) {
        entitiesGroup.remove(door.targetMarkerGroup);
        door.targetMarkerGroup = null;
        if (door.thermiteMarkerRef) door.thermiteMarkerRef.done = true;
      }

      // [Stage 2] 방화벽에 실제 3D 테르밋 폭탄 팩 부착 + 바닥 8.5m 위험 반경 경고 링 생성
      if (room.subStage === 2 && !room.cleared && !room.thermiteDetonated) {
        if (!door.thermiteBombGroup) {
          const bGroup = new THREE.Group();

          // 1) 중장갑 C4/테르밋 폭약 본체 케이스
          const chassis = new THREE.Mesh(
            new THREE.BoxGeometry(2.3, 1.35, 0.9),
            new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.7, roughness: 0.3 })
          );
          bGroup.add(chassis);

          // 2) 고열 테르밋 소이 실린더 2기
          const canGeo = new THREE.CylinderGeometry(0.34, 0.34, 2.05, 12);
          const canMat = new THREE.MeshStandardMaterial({
            color: 0xf97316,
            emissive: 0xea580c,
            emissiveIntensity: 1.15
          });
          const can1 = new THREE.Mesh(canGeo, canMat);
          can1.rotation.z = Math.PI / 2;
          can1.position.set(0, 0.32, 0.35);
          const can2 = new THREE.Mesh(canGeo, canMat);
          can2.rotation.z = Math.PI / 2;
          can2.position.set(0, -0.32, 0.35);
          bGroup.add(can1, can2);

          // 3) 중앙 점멸 기폭 LED 비콘
          const ledMat = new THREE.MeshBasicMaterial({ color: 0xff0000 });
          const ledMesh = new THREE.Mesh(new THREE.SphereGeometry(0.32, 14, 14), ledMat);
          ledMesh.position.set(0, 0, 0.55);
          bGroup.add(ledMesh);

          const offX = (door.inNormX || 0) * 1.05;
          const offZ = (door.inNormZ || 0) * 1.05;
          bGroup.position.set(door.x + offX, 2.0, door.z + offZ);
          if (door.rotY) bGroup.rotation.y = door.rotY;
          entitiesGroup.add(bGroup);

          door.thermiteBombGroup = bGroup;
          door.thermiteLedMesh = ledMesh;
          door.thermiteCanMat = canMat;

          // 4) 바닥 폭발 위험 반경(6.0m) 고시인성 경고 장판 (방 내부 방향으로 정확히 정렬)
          const blastRadius = 6.0;
          const hX = door.x + (door.inNormX || 0) * 1.5;
          const hZ = door.z + (door.inNormZ || 0) * 1.5;

          const dzGroup = new THREE.Group();
          // 외곽 점멸 경고 링
          const outerRingMat = new THREE.MeshBasicMaterial({
            color: 0xef4444,
            transparent: true,
            opacity: 0.9,
            side: THREE.DoubleSide
          });
          const outerRing = new THREE.Mesh(
            new THREE.RingGeometry(blastRadius - 0.35, blastRadius + 0.15, 48),
            outerRingMat
          );
          outerRing.rotation.x = -Math.PI / 2;
          outerRing.position.y = 0.08;
          dzGroup.add(outerRing);

          // 내부 빗살/보조 위험 링
          const midRingMat = new THREE.MeshBasicMaterial({
            color: 0xf59e0b,
            transparent: true,
            opacity: 0.75,
            side: THREE.DoubleSide
          });
          const midRing = new THREE.Mesh(
            new THREE.RingGeometry(blastRadius * 0.55 - 0.2, blastRadius * 0.55 + 0.2, 36),
            midRingMat
          );
          midRing.rotation.x = -Math.PI / 2;
          midRing.position.y = 0.07;
          dzGroup.add(midRing);

          // 바닥 붉은 위험 반투명 원판
          const innerDiscMat = new THREE.MeshBasicMaterial({
            color: 0xef4444,
            transparent: true,
            opacity: 0.28,
            side: THREE.DoubleSide
          });
          const innerDisc = new THREE.Mesh(new THREE.CircleGeometry(blastRadius, 48), innerDiscMat);
          innerDisc.rotation.x = -Math.PI / 2;
          innerDisc.position.y = 0.06;
          dzGroup.add(innerDisc);

          dzGroup.position.set(hX, 0, hZ);
          effectsGroup.add(dzGroup);
          door.dangerZoneGroup = dzGroup;
          door.dangerDiscMat = innerDiscMat;
          door.dangerOuterMat = outerRingMat;
          door.dangerMidMat = midRingMat;
          door.blastRadius = blastRadius;
          door.hazardCenterX = hX;
          door.hazardCenterZ = hZ;

          const bombRef = { done: false, roomIndex: room.index };
          door.thermiteBombRef = bombRef;
          door.thermiteBombSym = registerWorldSymbol(
            door.x + offX, 3.6, door.z + offZ,
            "🧨 테르밋 용융",
            "bg-rose-950/95 border-rose-500 text-rose-200",
            bombRef, room.index
          );
        }
      }
    }

    // 테르밋 용융 완료 시 방화벽 대폭발 애니메이션 및 근접 플레이어/좀비 심각한 폭발 데미지 판정!
    function detonateThermiteDoor(room, door) {
      if (!room || !door || room.thermiteDetonated) return;
      room.thermiteDetonated = true;

      // 부착된 폭탄 및 위험 반경 링 제거
      if (door.thermiteBombGroup) {
        entitiesGroup.remove(door.thermiteBombGroup);
        door.thermiteBombGroup = null;
      }
      if (door.dangerZoneGroup) {
        effectsGroup.remove(door.dangerZoneGroup);
        door.dangerZoneGroup = null;
      }
      if (door.targetMarkerGroup) {
        entitiesGroup.remove(door.targetMarkerGroup);
        door.targetMarkerGroup = null;
      }
      if (door.thermiteBombRef) door.thermiteBombRef.done = true;
      if (door.thermiteMarkerRef) door.thermiteMarkerRef.done = true;

      SoundFX.play("explosion");

      // 1. 다중 레이어 테르밋 화염구 & 섬광 VFX (위험 구역 중심 hX, hZ 및 경계 bRad 이내로 정확히 한정)
      const hX = door.hazardCenterX !== undefined ? door.hazardCenterX : (door.x + (door.inNormX || 0) * 1.5);
      const hZ = door.hazardCenterZ !== undefined ? door.hazardCenterZ : (door.z + (door.inNormZ || 0) * 1.5);
      const bRad = door.blastRadius || 6.0;

      const coreFlash = new THREE.Mesh(
        new THREE.SphereGeometry(2.0, 16, 16),
        new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.95 })
      );
      coreFlash.position.set(hX, 1.8, hZ);
      effectsGroup.add(coreFlash);
      game.particles.push({ mesh: coreFlash, life: 0.22, maxLife: 0.22, expand: 1.45 });

      const fireball = new THREE.Mesh(
        new THREE.SphereGeometry(3.5, 20, 20),
        new THREE.MeshBasicMaterial({ color: 0xf97316, transparent: true, opacity: 0.85 })
      );
      fireball.position.set(hX, 1.6, hZ);
      effectsGroup.add(fireball);
      game.particles.push({ mesh: fireball, life: 0.42, maxLife: 0.42, expand: 1.55 }); // 최대 반경 3.5 * 1.55 = 5.4m (장판 6.0m 안쪽에 완벽히 제한)

      // 이중 바닥 충격파 링 (장판 경계 6.0m 이내로 엄격히 제한)
      const wave1 = new THREE.Mesh(
        new THREE.RingGeometry(0.5, 4.3, 32),
        new THREE.MeshBasicMaterial({ color: 0xef4444, transparent: true, opacity: 0.88, side: THREE.DoubleSide })
      );
      wave1.rotation.x = -Math.PI / 2;
      wave1.position.set(hX, 0.12, hZ);
      effectsGroup.add(wave1);
      game.particles.push({ mesh: wave1, life: 0.45, maxLife: 0.45, expand: 1.35 }); // 최대 4.3 * 1.35 = 5.8m

      const wave2 = new THREE.Mesh(
        new THREE.RingGeometry(0.3, 3.2, 28),
        new THREE.MeshBasicMaterial({ color: 0xfacc15, transparent: true, opacity: 0.9, side: THREE.DoubleSide })
      );
      wave2.rotation.x = -Math.PI / 2;
      wave2.position.set(hX, 0.16, hZ);
      effectsGroup.add(wave2);
      game.particles.push({ mesh: wave2, life: 0.35, maxLife: 0.35, expand: 1.45 });

      // 20개의 고열 방화벽 철제 파편 및 용융 불덩이 방사 (장판 반경 내로 비산 제한)
      for (let p = 0; p < 20; p++) {
        const ang = (p / 20) * Math.PI * 2 + (Math.random() - 0.5) * 0.25;
        const spd = 4.5 + Math.random() * 5.5;
        const sz = 0.25 + Math.random() * 0.2;
        const pColor = p % 3 === 0 ? 0xf97316 : (p % 3 === 1 ? 0xfacc15 : 0x475569);
        const pMesh = new THREE.Mesh(
          new THREE.BoxGeometry(sz, sz, sz),
          new THREE.MeshBasicMaterial({ color: pColor })
        );
        pMesh.position.set(hX, 1.2 + Math.random() * 1.0, hZ);
        effectsGroup.add(pMesh);
        game.particles.push({
          mesh: pMesh,
          life: 0.52,
          maxLife: 0.52,
          vx: Math.cos(ang) * spd,
          vy: 3.2 + Math.random() * 4.0,
          vz: Math.sin(ang) * spd
        });
      }

      // 2. 바닥 위험 장판 내 플레이어 판정: 장판 외곽 안전 버퍼(0.5m) 적용 — 경계선 밖은 100% 안전 보장!
      const playerBlastRadius = Math.max(3.0, (door.blastRadius || 6.0) - 0.5);
      let localHitDmg = 0;
      game.players.forEach(p => {
        if (p.downed) return;
        const dist = Math.hypot(p.x - hX, p.z - hZ);
        if (dist <= playerBlastRadius) {
          const falloff = 1 - (dist / playerBlastRadius) * 0.5; // 중심부 100%, 외곽 50%
          const blastDmg = Math.round(30 * falloff);
          damagePlayer(p, blastDmg, false, false);
          if (p.id === mySlotIndex) localHitDmg = blastDmg;

          // 폭발 충격파 넉백 (장판 중심에서 외곽으로)
          const nx = (p.x - hX) / (dist || 1);
          const nz = (p.z - hZ) / (dist || 1);
          const kbDist = 3.6 * falloff;
          const tx = p.x + nx * kbDist;
          const tz = p.z + nz * kbDist;
          if (!isPointBlockedByWall(tx, tz, 0.75)) {
            p.x = tx;
            p.z = tz;
          }
        }
      });

      if (localHitDmg > 0) {
        const collapseBanner = document.getElementById("hud-collapse-banner");
        if (collapseBanner) {
          document.getElementById("hud-collapse-msg").textContent =
            `💥 테르밋 폭발 피해 (-${localHitDmg} HP)`;
          collapseBanner.classList.remove("hidden");
          setTimeout(() => {
            if (!game.collapseState.active) collapseBanner.classList.add("hidden");
          }, 2800);
        }
      }

      // 3. 폭발 반경(11.5m) 내 감염체 전원 폭사 데미지(2,800) 및 넉백!
      const zombieBlastRadius = 11.5;
      for (let i = game.zombies.length - 1; i >= 0; i--) {
        const zmb = game.zombies[i];
        const dist = Math.hypot(zmb.x - door.x, zmb.z - door.z);
        if (dist <= zombieBlastRadius) {
          damageZombie(i, 2800, (zmb.x - door.x) * 3.2, (zmb.z - door.z) * 3.2, 2.5, 7);
        }
      }

      // 방화벽 그을림 색상 적용
      if (door.mesh && door.mesh.material) {
        door.mesh.material.color.setHex(0x451a03);
        door.mesh.material.emissive.setHex(0x1c1917);
      }
    }

    function checkRoomClear(room) {
      if (room.cleared || room.isBossRoom) return;
      if (room.hasMidBoss && !room.midBossKilled) return;
      if (room.progress < room.targetVal) return;
      // 섬멸 미션도 최소 2웨이브 이상 방어해야 클리어 인정!
      if (room.condType === "EXTERMINATE" && (room.roomWaveCount || 1) < 2) return;

      // [v3.2 신규 격벽 비상 개방 시퀀스: Bulkhead Override Sequence]
      // 마지막 미션 목표 완료 시 문이 즉시 열리지 않고, 65초 동안 고밀도 호드 공세 유입으로 대량 BP 파밍 및 3.5~5분 체류 강제 보장!
      if (!room.bulkheadOverride) {
        room.bulkheadOverride = true;
        room.bulkheadOverrideTimer = 65.0;
        room.bulkheadOverrideMax = 65.0;
        game.wavePhase = "HORDE";
        game.waveTimer = 65.0;
        SoundFX.play("alarm");
        showToastNotification("🚨 격벽 전자 락다운 해제 시퀀스 가동: 콘덴서 충전(65초 소요)! 호드 웨이브 사냥 시작!");
        return;
      }

      if (room.bulkheadOverride && !room.bulkheadOverrideDone) {
        return;
      }

      room.cleared = true;

      // 1. [안전 보장] 클리어 즉시 해당 방의 지향성 독가스 즉시 정지 및 비활성화, 전 구역 완전 정화 안전구역화
      room.gasWaveActive = false;
      room.gasWaveProgress = 0;
      room.envCleared = true;
      if (room.gasMesh) room.gasMesh.visible = false;
      if (room.envType === "TOXIC_FOG" || room.envType === "CRYO_LEAK") {
        if (typeof addRoomSafeZone === "function") {
          addRoomSafeZone(room, room.wx, room.wz, Math.max(room.hw || room.half, room.hd || room.half) * 1.5, "전 구역 완전 정화 안전지대");
        }
      }

      // 2. 해당 방 내부 바닥 잔존 산성 장판 즉시 제거
      game.acidPools = game.acidPools.filter(a => a.roomIndex !== room.index);

      // 3. 신규 섹터 진입 시 의무 드론 사용 횟수 리셋
      game.players.forEach(p => {
        if (p.drone && p.drone.modules && p.drone.modules.medi) {
          p.drone.modules.medi.sectorRevivesUsed = 0;
        }
      });

      // 섹터 클리어 시 작전 성공 보너스 BP + ⚙️무기 부품 1개 확정 지급 + 해금된 전 무기에 탄약 보급!
      const clearBonusBp = 1500 + room.index * 1500;
      game.bioPoints += clearBonusBp;
      game.weaponParts = (game.weaponParts || 0) + 1;
      game.players.forEach(p => {
        p.inventory.forEach((inv, wIdx) => {
          if (inv.unlocked && !WEAPONS[wIdx].infinite) {
            const maxA = getWeaponMaxAmmo(p, wIdx);
            inv.ammo = Math.min(maxA, inv.ammo + Math.ceil(WEAPONS[wIdx].packAmmo * 0.45));
          }
        });
      });

      game.wavePhase = "CALM";
      game.waveTimer = 22.0;
      SoundFX.play("pickup");

      const nextIdx = room.index + 1;
      const door = game.doors.find(d => d.fromRoom === room.index && d.toRoom === nextIdx);
      if (door) {
        if (room.condType === "THERMITE") {
          detonateThermiteDoor(room, door);
        } else {
          spawnMissionStageVFX(door.x, door.z, 0x10b981, 6.0, 18, false);
        }
        door.open = true;

        // [v3.1 복도 돌파 감염체 기믹 복원]
        // 문이 개방되는 순간 다음 섹터로 이어지는 연결 통로에 밀집 매복한 감염체 무리가 쏟아져 나와 복도 돌파전 발발!
        if (!isRemoteClient && game.rooms[nextIdx]) {
          const spawnCount = Math.min(18, 10 + room.index * 2);
          const bx = door.bridgeMidX || door.x;
          const bz = door.bridgeMidZ || door.z;
          const bLen = door.bridgeLen || 12.0;
          const isNorthSouth = door.isNS !== undefined ? door.isNS : (door.w > door.d);

          for (let s = 0; s < spawnCount; s++) {
            const offset = (Math.random() - 0.5) * (bLen * 0.72);
            const lateral = (Math.random() - 0.5) * 2.2;
            const sx = isNorthSouth ? (bx + lateral) : (bx + offset);
            const sz = isNorthSouth ? (bz + offset) : (bz + lateral);
            const zType = (s % 4 === 0) ? "RUNNER" : (s % 6 === 0 ? "SPITTER" : "WALKER");
            spawnZombie(zType, sx, sz, nextIdx);
          }
          if (typeof showCombatToast === "function") {
            showCombatToast("🚨 복도 돌파 경보! 감염체 무리가 연결 통로를 봉쇄하고 있습니다!");
          }
          SoundFX.play("alarm");
        }
      }

      // [2섹터 클리어 기념] 4대 작전 특성화 해금 알림 (게임 도중 강제 팝업 방지 -> [T]로 편할 때 선택)
      if (room.index === 1) {
        game.specAvailable = true;
        const specNoticeBtn = document.getElementById("btn-open-spec-modal");
        if (specNoticeBtn) specNoticeBtn.classList.remove("hidden");
        const safeBanner = document.getElementById("hud-safe-banner");
        if (safeBanner) {
          document.getElementById("hud-safe-banner-text").textContent =
            "🎖️ [2섹터 완수] 4대 작전 특성화 해금! [T] 키를 눌러 특성을 선택하십시오.";
          safeBanner.classList.remove("hidden");
          setTimeout(() => safeBanner.classList.add("hidden"), 5000);
        }
      }

      if (game.rooms[nextIdx]) {
        const nextR = game.rooms[nextIdx];
        nextR.unlocked = true;
        // [안전 보장] 플레이어가 실제로 문을 통과해 다음 섹터로 들어설 때까지 game.currentRoomIndex를 조기 변경하지 않음!
        // 현재 방에서 무기고 이용, 잔여 파밍 및 정비를 100% 안전하게 누린 후 전진할 수 있습니다.
        updateRoomVisibility();
      }

      const collapseBanner = document.getElementById("hud-collapse-banner");
      const safeBanner = document.getElementById("hud-safe-banner");

      // 조기 구역 붕괴 및 출구 병목 감염체 기습 스폰 제거 -> 쾌적한 전진 정비 보장!
      room.collapsing = false;
      if (game.collapseState) game.collapseState.active = false;
      if (collapseBanner) collapseBanner.classList.add("hidden");

      if (safeBanner) {
        document.getElementById("hud-safe-banner-text").textContent =
          `✅ S${nextIdx + 1} 개방! 작전 성공 보너스 +${clearBonusBp}BP · 부품+1 · 탄약 보급`;
        safeBanner.classList.remove("hidden");
        setTimeout(() => safeBanner.classList.add("hidden"), 4500);
      }
      updateWeaponSlotsHUD();
    }

    function executeRoomCollapse(room) {
      room.collapsing = false;
      room.collapsed = true;
      if (room.floorMesh) room.floorMesh.material.color.setHex(0x450a0a);
      SoundFX.play("explosion");
    }

    // 플레이어가 현재 해금된 단계의 미션 요소를 완료했을 때 호출 -> 다음 웨이브를 막아야만 그 다음 요소가 열리도록 설정!
    function advanceRoomMissionStage(room, completedStep, toastText) {
      if (!room) return;
      room.completedStage = Math.max(room.completedStage || 0, completedStep);
      room.waitingForWaveDefense = true;
      // [v3.3 멀티플레이 미션 동기화] 클라이언트의 F키 상호작용 완료가 호스트 8Hz 스냅샷에 덮어씌워지지 않도록 즉각 전파!
      if (wsClient && wsClient.readyState === WebSocket.OPEN) {
        try {
          wsClient.send(JSON.stringify({
            type: "MISSION_ACTION",
            slotId: mySlotIndex,
            roomIdx: room.index,
            action: "ADVANCE_STAGE",
            completedStep,
            progress: room.progress
          }));
        } catch (e) {}
      }
      // 미션 요소를 완료했으므로 다음 웨이브가 곧바로 몰려와 템포가 늘어지지 않게 함
      if (game.wavePhase === "CALM" && game.waveTimer > 4.0) {
        game.waveTimer = 4.0;
      }

      // [미션 비콘 제거 & 환경 안전지대 확장] 완료된 미션 노드의 수직 빛기둥을 소거하고 정화 구역 확장!
      const compNode = (game.missionNodes || []).find(n => n.roomIndex === room.index && (n.stepOrder === completedStep || n.genIndex === completedStep));
      if (compNode) {
        if (compNode.beaconMesh) {
          effectsGroup.remove(compNode.beaconMesh);
          compNode.beaconMesh = null;
        }
        if (room.envType === "TOXIC_FOG" || room.envType === "CRYO_LEAK") {
          if (typeof addRoomSafeZone === "function") {
            addRoomSafeZone(room, compNode.x, compNode.z, 8.5, `목표 #${completedStep} 정화구역`);
            spawnMissionStageVFX(compNode.x, compNode.z, 0x38bdf8, 8.5, 25, false);
          }
        }
      }
      const safeBanner = document.getElementById("hud-safe-banner");
      if (safeBanner && toastText) {
        document.getElementById("hud-safe-banner-text").textContent = toastText;
        safeBanner.classList.remove("hidden");
        setTimeout(() => safeBanner.classList.add("hidden"), 4500);
      }
    }

    function closeAndLockBulkheadDoor(room) {
      if (!room || room.lockedBehind) return;
      try {
        room.lockedBehind = true;

        // 1. 후방 격벽 문 물리적 폐쇄 및 붉은색 잠금
        const prevIdx = room.index - 1;
        const backDoor = game.doors.find(d => d.fromRoom === prevIdx && d.toRoom === room.index);
        if (backDoor) {
          backDoor.open = false;
          backDoor.lockedPermanently = true;
          if (backDoor.mesh) {
            backDoor.mesh.position.y = 2.0;
            if (backDoor.mesh.material) {
              try {
                if (Array.isArray(backDoor.mesh.material)) {
                  backDoor.mesh.material.forEach(m => {
                    if (m && m.color) m.color.setHex(0x991b1b);
                    if (m && m.emissive) m.emissive.setHex(0x450a0a);
                  });
                } else {
                  if (backDoor.mesh.material.color) backDoor.mesh.material.color.setHex(0x991b1b);
                  if (backDoor.mesh.material.emissive) backDoor.mesh.material.emissive.setHex(0x450a0a);
                }
              } catch (e) {}
            }
          }
        }

        // 이전 섹터 광폭화, 2차 광폭화 및 독가스 확산 영구 정지 & 격리
        if (prevIdx >= 0 && game.rooms[prevIdx]) {
          const prevR = game.rooms[prevIdx];
          prevR.berserkActive = false;
          prevR.phase2Berserk = false;
          prevR.phase2Timer = undefined;
          prevR.gasWaveActive = false;
          if (prevR.gasMesh) prevR.gasMesh.visible = false;
        }

        // 2. 콘솔 레버 내림 & 월드 심볼 소거
        if (room.bulkheadConsole) {
          room.bulkheadConsole.done = true;
          if (room.bulkheadConsole.lever) {
            room.bulkheadConsole.lever.rotation.z = -Math.PI / 4;
          }
          if (room.bulkheadConsole.sym && room.bulkheadConsole.sym.el) {
            room.bulkheadConsole.sym.el.style.display = "none";
          }
        }

        // 3. 지연 도착 대원 안전 합류
        const meP = game.players[mySlotIndex] || game.players[0];
        game.players.forEach((pl, idx) => {
          if (pl.id !== meP.id && (Math.abs(pl.x - room.wx) >= (room.hw || room.half) || Math.abs(pl.z - room.wz) >= (room.hd || room.half))) {
            const ang = (idx / 4) * Math.PI * 2;
            pl.x = meP.x + Math.cos(ang) * 2.8;
            pl.z = meP.z + Math.sin(ang) * 2.8;
            if (pl.visual && pl.visual.group) pl.visual.group.position.set(pl.x, 0, pl.z);
          }
        });

        if (wsClient && wsClient.readyState === WebSocket.OPEN && !isRemoteClient) {
          try {
            wsClient.send(JSON.stringify({
              type: "SECTOR_LOCK_TELEPORT",
              roomIdx: room.index,
              destX: room.wx,
              destZ: room.wz
            }));
          } catch (e) {}
        }

        // 4. 이전 섹터 잔존 감염체 처리:
        // - 이미 문을 통과하여 신규 방(room) 내부에 진입한 감염체는 생존 유지!
        // - 아직 문 이전(이전 구역)에 머물러 있는 감염체만 100% 완전 소멸
        const hw = room.hw || room.half || 45;
        const hd = room.hd || room.half || 45;
        for (let zi = game.zombies.length - 1; zi >= 0; zi--) {
          const zmb = game.zombies[zi];
          if (!zmb) continue;
          if (zmb.roomIndex < room.index) {
            const hasCrossedDoor = Math.abs(zmb.x - room.wx) <= (hw + 2.0) && Math.abs(zmb.z - room.wz) <= (hd + 2.0);
            if (hasCrossedDoor) {
              zmb.roomIndex = room.index;
            } else {
              try {
                if (zmb.iceBlock && zmb.group) zmb.group.remove(zmb.iceBlock);
                if (zmb.group && entitiesGroup) entitiesGroup.remove(zmb.group);
              } catch (e) {}
              game.zombies.splice(zi, 1);
            }
          }
        }

        // 5. 폭발 효과 & 사운드 & 파티클
        try { SoundFX.play("explosion"); } catch (e) {}
        if (typeof spawnMissionStageVFX === "function") {
          spawnMissionStageVFX(room.bulkheadConsole ? room.bulkheadConsole.x : room.wx, room.bulkheadConsole ? room.bulkheadConsole.z : room.wz, 0xf59e0b, 8.5, 25, true);
        }

        // 6. 붕괴 배너 정리
        const collapseBanner = document.getElementById("hud-collapse-banner");
        if (collapseBanner) collapseBanner.classList.add("hidden");
        const collapseMsg = document.getElementById("hud-collapse-msg");
        if (collapseMsg) collapseMsg.textContent = "";
        const collapseTimerEl = document.getElementById("hud-collapse-timer");
        if (collapseTimerEl) collapseTimerEl.textContent = "";
        if (game.collapseState) game.collapseState.active = false;

        // 7. [신규 섹터 작전 개시] 타이머 작동 및 3.5초 카운트다운 후 호드 웨이브 돌입!
        game.wavePhase = "CALM";
        game.waveTimer = 3.5;
        try { SoundFX.play("alarm"); } catch (e) {}

        // 8. 1단계 미션 노드 생성 (없는 경우)
        if (room.unlockStage === 0 && !room.isBossRoom && !room.hasMidBoss && room.condType !== "THERMITE") {
          const hasNode = game.missionNodes.some(n => n.roomIndex === room.index && (n.stepOrder === 1 || n.genIndex === 1));
          if (!hasNode && typeof spawnRandomMissionStepForRoom === "function") {
            try {
              room.unlockStage = 1;
              spawnRandomMissionStepForRoom(room, 1);
            } catch (e) { console.error(e); }
          }
        }

        // 9. HUD 알림 배너
        const safeBanner = document.getElementById("hud-safe-banner");
        if (safeBanner) {
          const bannerTextEl = document.getElementById("hud-safe-banner-text");
          if (bannerTextEl) {
            if (room.hasMidBoss && !room.midBossAwakened) {
              bannerTextEl.textContent = "⚠️ 후방 격벽 폐쇄 완료! 중간보스 생체 캡슐 감지! 스쿼드 정비 후 [F] 단말기를 가동하십시오.";
            } else if (room.isBossRoom) {
              if (game.boss) {
                game.boss.active = false;
                game.boss.shielded = true;
                if (game.boss.shieldMat) game.boss.shieldMat.opacity = 0.85;
              }
              bannerTextEl.textContent = "👑 후방 격벽 폐쇄 완료! 무기고 정비 완료 후 입구의 [F] 격벽 콘솔을 가동하십시오.";
            } else {
              bannerTextEl.textContent = `🔒 후방 격벽 폐쇄 완료! 통로 영구 차단 & S${room.index + 1} 작전이 개시됩니다! (3초 후 호드 웨이브)`;
            }
          }
          safeBanner.classList.remove("hidden");
          setTimeout(() => safeBanner.classList.add("hidden"), 4500);
        }
      } catch (err) {
        console.error("Critical error in closeAndLockBulkheadDoor:", err);
      }
    }
