/**
 * =========================================================================
 * BOXHEAD: THE CORE v3.6 — Frontend Module: 06b_sim_core_loop.js
 * Main 60FPS Simulation Orchestrator, Wave Spawner, Environment & Camera
 * Zero-Loss Refactored Architecture (Shared Global Lexical Scope)
 * =========================================================================
 */
"use strict";

    // =========================================================================
    // 16. MAIN 60FPS SIMULATION LOOP (Decomposed Phase-1 Architecture)
    // =========================================================================
    let lastFrameTime = performance.now();
    let camFocusX = 0;
    let camFocusZ = 0;
    let camInitialized = false;

    function updateMissionPropsAndDoorAnimations(dt, curRoom) {
      game.armoryVaults.forEach(v => {
        if (v.holoGun) v.holoGun.rotation.y += dt * 1.8;
      });

      // [v3.2 미션 오브젝트 · 방화벽 테르밋 용융 · 게이트 개폐 입체 애니메이션 업데이트]
      const curExitDoor = curRoom ? game.doors.find(d => d.fromRoom === curRoom.index) : null;
      if (curRoom && curExitDoor && curRoom.condType === "THERMITE") {
        ensureThermiteDoorVisuals(curRoom, curExitDoor);
        if (curRoom.subStage === 1 && curExitDoor.targetRingMesh) {
          curExitDoor.targetRingMesh.rotation.z += dt * 2.5;
          const pulse = 1.0 + Math.sin(game.elapsedTime * 5.0) * 0.08;
          curExitDoor.targetRingMesh.scale.set(pulse, pulse, 1);
        } else if (curRoom.subStage === 2 && !curRoom.cleared) {
          const ratio = Math.min(1.0, (curRoom.progress || 0) / (curRoom.targetVal || 20));
          const remSec = Math.max(0, (curRoom.targetVal || 20) - (curRoom.progress || 0));

          // 1) 기폭 LED 고속 점멸 & 폭탄 진동
          const blinkFreq = 4.5 + ratio * 24.0;
          const blinkOn = Math.sin(game.elapsedTime * blinkFreq) > 0;
          if (curExitDoor.thermiteLedMesh) {
            curExitDoor.thermiteLedMesh.material.color.setHex(blinkOn ? 0xffffff : 0xff0000);
            curExitDoor.thermiteLedMesh.scale.setScalar(blinkOn ? 1.35 : 0.85);
          }
          if (curExitDoor.thermiteBombGroup) {
            const shake = ratio * 0.06;
            curExitDoor.thermiteBombGroup.position.y = 2.0 + (Math.random() - 0.5) * shake;
          }

          // 2) 폭발 임박(5초 이하) 경고 비프음
          if (remSec <= 5.5 && remSec > 0.1) {
            curRoom.thermiteBeepTimer = (curRoom.thermiteBeepTimer || 0) - dt;
            if (curRoom.thermiteBeepTimer <= 0) {
              curRoom.thermiteBeepTimer = Math.max(0.16, remSec * 0.11);
              SoundFX.play("empty");
            }
          }

          // 3) 방화벽 철판 고열 적열(Red-Hot Melting) 색상 변화
          if (curExitDoor.mesh && curExitDoor.mesh.material) {
            curExitDoor.mesh.material.emissive.setRGB(0.45 + ratio * 0.55, 0.12 + ratio * 0.28, 0.02);
            curExitDoor.mesh.material.emissiveIntensity = 0.45 + ratio * 1.45;
          }

          // 4) 테르밋 용융 불꽃 스파크 폭포 방출
          curRoom.thermiteSparkTimer = (curRoom.thermiteSparkTimer || 0) - dt;
          if (curRoom.thermiteSparkTimer <= 0) {
            curRoom.thermiteSparkTimer = 0.07;
            const offX = (curExitDoor.inNormX || 0) * 1.15;
            const offZ = (curExitDoor.inNormZ || 0) * 1.15;
            for (let s = 0; s < 2; s++) {
              const spMesh = new THREE.Mesh(
                new THREE.BoxGeometry(0.16, 0.16, 0.16),
                new THREE.MeshBasicMaterial({ color: Math.random() < 0.5 ? 0xfef08a : 0xf97316 })
              );
              spMesh.position.set(
                curExitDoor.x + offX + (Math.random() - 0.5) * 1.6,
                1.9 + (Math.random() - 0.5) * 0.5,
                curExitDoor.z + offZ + (Math.random() - 0.5) * 1.6
              );
              effectsGroup.add(spMesh);
              game.particles.push({
                mesh: spMesh,
                life: 0.38,
                maxLife: 0.38,
                vx: (Math.random() - 0.5) * 4.5 + offX * 2.2,
                vy: 1.5 + Math.random() * 3.5,
                vz: (Math.random() - 0.5) * 4.5 + offZ * 2.2
              });
            }
          }

          // 5) 바닥 위험 반경 장판 눈이 편안한 천천히 숨쉬는 펄스 (고속 깜빡임 완벽 제거)
          const pulseSpeed = remSec <= 4.0 ? 2.6 : 1.6;
          const pulseAlpha = 0.5 + 0.5 * Math.sin(game.elapsedTime * pulseSpeed);
          if (curExitDoor.dangerDiscMat) {
            curExitDoor.dangerDiscMat.opacity = 0.16 + pulseAlpha * 0.18;
          }
          if (curExitDoor.dangerOuterMat) {
            curExitDoor.dangerOuterMat.opacity = 0.60 + pulseAlpha * 0.35;
          }
          if (curExitDoor.dangerMidMat) {
            curExitDoor.dangerMidMat.opacity = 0.35 + pulseAlpha * 0.25;
          }
          if (curExitDoor.thermiteBombSym && curExitDoor.thermiteBombSym.el) {
            curExitDoor.thermiteBombSym.el.textContent = remSec <= 4.0
              ? `🚨 폭발 대피! [${remSec.toFixed(1)}s]`
              : `🧨 테르밋 용융 [${remSec.toFixed(0)}s]`;
          }
        }
      }

      // 방화벽(Doors) 유압식 개폐 애니메이션 및 스파크 연출
      game.doors.forEach(d => {
        if (!d.mesh) return;
        const targetY = d.open ? -4.2 : (d.closedY || 2.0);
        const diffY = targetY - d.mesh.position.y;
        if (Math.abs(diffY) > 0.02) {
          const speed = d.lockedPermanently ? 16.0 : 3.8;
          const step = Math.sign(diffY) * Math.min(Math.abs(diffY), dt * speed);
          d.mesh.position.y += step;
          if (Math.random() < 0.35) {
            const sp = new THREE.Mesh(
              new THREE.BoxGeometry(0.18, 0.18, 0.18),
              new THREE.MeshBasicMaterial({ color: d.lockedPermanently ? 0xef4444 : 0xfacc15 })
            );
            sp.position.set(d.x + (Math.random() - 0.5) * 3.2, 0.18, d.z + (Math.random() - 0.5) * 3.2);
            effectsGroup.add(sp);
            game.particles.push({
              mesh: sp,
              life: 0.32,
              maxLife: 0.32,
              vx: (Math.random() - 0.5) * 3.5,
              vy: 2.0 + Math.random() * 2.5,
              vz: (Math.random() - 0.5) * 3.5
            });
          }
        }
      });

      // 전 미션 노드(원료·합성대·발전기·블랙박스·중계기·송신기·환기밸브) 상시 3D 회전/부유 애니메이션
      game.missionNodes.forEach((n, idx) => {
        if (n.kind === "CHEM_PART" && !n.done) {
          if (n.cap) {
            n.cap.rotation.z += dt * 2.5;
            n.cap.position.y = 0.25 + Math.sin(game.elapsedTime * 3.5 + idx) * 0.12;
          }
          if (n.tank) n.tank.rotation.y += dt * 1.2;
        } else if (n.kind === "SYNTH_TABLE" && !n.done) {
          const boost = n.holdTime > 0 ? 7.5 : 1.0;
          if (n.holo) n.holo.rotation.z += dt * 2.2 * boost;
          if (n.coreCone) {
            n.coreCone.rotation.y += dt * 2.8 * boost;
            n.coreCone.rotation.x += dt * 1.4 * boost;
            n.coreCone.position.y = 2.0 + Math.sin(game.elapsedTime * 4.0) * 0.14 + (n.holdTime / 3.0) * 0.45;
          }
        } else if (n.kind === "GENERATOR") {
          const spinSpd = n.done ? 7.5 : (n.holdTime > 0 ? 2.5 + n.holdTime * 4.5 : 0.6);
          if (n.coilRing) {
            n.coilRing.rotation.z += dt * spinSpd;
            n.coilRing.position.y = 2.65 + (n.done ? Math.sin(game.elapsedTime * 8.0 + idx) * 0.08 : 0);
          }
          if (n.turbine && n.done) n.turbine.rotation.y += dt * 3.2;
        } else if (n.kind === "BLACKBOX" && !n.done && n.crystal) {
          n.crystal.rotation.y += dt * 2.4;
          n.crystal.position.y = 1.55 + Math.sin(game.elapsedTime * 3.5) * 0.18;
        } else if (n.kind === "SECURITY_RELAY" && !n.done && n.relay) {
          n.relay.rotation.y += dt * (n.holdTime > 0 ? 6.5 : 1.2);
        } else if (n.kind === "UPLOAD_TERMINAL" && !n.done && n.dish) {
          n.dish.rotation.z += dt * (n.holdTime > 0 ? 9.0 : 2.2);
        } else if (n.kind === "ENV_CONTROL" && !n.done && n.wheelMesh) {
          n.wheelMesh.rotation.z += dt * (n.holdTime > 0 ? 10.0 : 0.8);
        } else if (n.kind === "RADAR_CONSOLE" && !n.done) {
          if (n.coilRing) n.coilRing.rotation.z += dt * (n.holdTime > 0 ? 8.5 : 1.8);
        } else if (n.kind === "RADAR_DISH" && !n.done) {
          if (n.dish) n.dish.rotation.y += dt * (n.holdTime > 0 ? 6.2 : 0.9);
          if (n.ring) n.ring.rotation.z += dt * (n.holdTime > 0 ? 7.0 : 1.4);
        } else if (n.kind === "RADAR_BEACON" && !n.done) {
          if (n.halo) {
            n.halo.rotation.z += dt * (n.holdTime > 0 ? 12.0 : 3.0);
            n.halo.position.y = 3.4 + Math.sin(game.elapsedTime * 4.5) * 0.16;
          }
        } else if (n.kind === "DECON_VALVE") {
          if (n.wheel) n.wheel.rotation.z += dt * (n.holdTime > 0 ? 12.0 : (n.done ? 0 : 0.6));
          const mePlayer = game.players[mySlotIndex] || game.players[0];
          if (!n.done && mePlayer && Math.hypot(mePlayer.x - n.x, mePlayer.z - n.z) < 18.0 && Math.random() < 0.12) {
            spawnBloodParticles(n.x, 2.7, n.z, 0x10b981, 1);
          }
        } else if (n.kind === "BULKHEAD_CONSOLE" && !n.done) {
          if (n.lever) n.lever.rotation.z = (Math.PI / 4) - ((n.holdTime || 0) / 0.8) * (Math.PI / 2);
        }
      });

      // 생체 신경절(HIVE_NODES) 및 군락 증폭기(EXTERMINATE) 심장 박동 맥동 애니메이션
      game.cystPods.forEach((pod, idx) => {
        if (pod.coreMesh) {
          pod.coreMesh.rotation.y += dt * 1.5;
          pod.coreMesh.rotation.x += dt * 0.8;
          const pulse = 1.0 + Math.sin(game.elapsedTime * 5.2 + idx) * 0.11;
          pod.coreMesh.scale.set(pulse, pulse, pulse);
        }
        if (pod.bioRing) pod.bioRing.rotation.z -= dt * 2.4;
      });

      // 플레이어 등 뒤 3D 미션 장비(블랙박스 / 테르밋 폭약 팩) 장착 시각화
      game.players.forEach(p => {
        if (!p.visual) return;
        if (p.visual.payloadPack) {
          p.visual.payloadPack.visible = Boolean(p.carryingPayload && !p.downed);
          if (p.carryingPayload && p.visual.pbCrystal) p.visual.pbCrystal.rotation.y += dt * 4.0;
        }
        if (p.visual.thermitePack) {
          p.visual.thermitePack.visible = Boolean(
            curRoom && curRoom.condType === "THERMITE" && curRoom.subStage === 1 && !p.downed
          );
        }
      });
    }

    function updateRoomTransitionAndTimers(dt, curRoom, prevRoom, isAwaitingBulkhead) {
      // 1. Update Thermite Defense Timer if active
      if (curRoom && !curRoom.cleared && curRoom.condType === "THERMITE" && curRoom.subStage === 2) {
        curRoom.progress = Math.min(curRoom.targetVal, curRoom.progress + dt);
        checkRoomClear(curRoom);
      }

      // 1b. 클리어된 섹터에서 플레이어가 다음 섹터에 진입했을 때 부드러운 섹터 전환
      if (curRoom && curRoom.cleared && game.rooms[curRoom.index + 1]) {
        const nextR = game.rooms[curRoom.index + 1];
        const nextIdx = nextR.index;
        const meP = game.players[mySlotIndex] || game.players[0];
        const activeHumans = game.players.filter(pl => !pl.downed && (pl.role === "LOCAL" || pl.role === "REMOTE"));
        const humanEntered = (activeHumans.length > 0)
          ? activeHumans.some(pl => Math.abs(pl.x - nextR.wx) <= ((nextR.hw || nextR.half) + 2.0) && Math.abs(pl.z - nextR.wz) <= ((nextR.hd || nextR.half) + 2.0))
          : (meP && Math.abs(meP.x - nextR.wx) <= ((nextR.hw || nextR.half) + 2.0) && Math.abs(meP.z - nextR.wz) <= ((nextR.hd || nextR.half) + 2.0));

        if (humanEntered && game.currentRoomIndex !== nextIdx) {
          game.currentRoomIndex = nextIdx;
          nextR.unlocked = true;
          relocateArmoryForCalmPhase(nextR);
          updateRoomVisibility();

          const safeBanner = document.getElementById("hud-safe-banner");
          if (safeBanner && !nextR.lockedBehind) {
            document.getElementById("hud-safe-banner-text").textContent =
              "🚪 섹터 진입! 입구 콘솔 [F]로 후방 격벽을 폐쇄하면 섹터 작전이 개시됩니다.";
            safeBanner.classList.remove("hidden");
            setTimeout(() => safeBanner.classList.add("hidden"), 4500);
          }
        }
      }

      // 1c. 섹터 제한시간 진행 및 후방 격벽 시스템:
      // A) 현재 방이 후방 격벽 폐쇄 대기 중(isAwaitingBulkhead)인 경우:
      //    -> 신규 방(curRoom)의 타이머는 아직 시작하지 않고 대기합니다.
      //    -> 대신, 이전 방(prevRoom)의 제한시간(sectorTimer)이 0초를 향해 계속 감소합니다.
      //    -> 이전 방의 제한시간이 0초에 도달하면 기존 게임의 표준 '광폭화(Berserk Enrage)'가 정상 발동하여 스폰 구멍이 열리고 독가스가 확산됩니다.
      //    -> 플레이어가 신규 구역 입구 콘솔 [F]로 후방 격벽을 닫을 때까지 이전 구역의 광폭화 상태가 유지됩니다.
      if (isAwaitingBulkhead && prevRoom) {
        prevRoom.sectorTimer = Math.max(0, (prevRoom.sectorTimer || 260) - dt);
        if (prevRoom.sectorTimer <= 0) {
          if (!prevRoom.overtimeAlerted) {
            prevRoom.overtimeAlerted = true;
            prevRoom.berserkActive = true;
            prevRoom.gasWaveActive = true;
            prevRoom.gasWaveProgress = 0.05;
            if (prevRoom.spawnHoles) {
              prevRoom.spawnHoles.forEach(h => {
                if (!h.active) {
                  h.active = true;
                  if (h.intactWallMesh) h.intactWallMesh.visible = false;
                  if (h.breachDetailGroup) h.breachDetailGroup.visible = true;
                }
              });
            }

            // 현재 이전 방에 살아있는 감염체도 즉시 광폭화(체력 +75%, 공격력 +35%, 이속 +35%, 핏빛 발광, 15% 벌크업) 적용!
            game.zombies.forEach(z => {
              if (z.roomIndex === prevRoom.index && !z.berserkEnraged && !z.spec.isNutrientHost) {
                z.berserkEnraged = true;
                const hpMult = 1.75;
                z.maxHp = Math.round(z.maxHp * hpMult);
                z.hp = Math.round(z.hp * hpMult);
                z.speed *= 1.35;
                if (z.group) z.group.scale.multiplyScalar(1.15);
                if (z.skinMat) {
                  z.skinMat.emissive.setHex(0xef4444);
                  z.skinMat.emissiveIntensity = 0.85;
                }
              }
            });
            SoundFX.play("alarm");
            const collapseBanner = document.getElementById("hud-collapse-banner");
            if (collapseBanner) {
              document.getElementById("hud-collapse-msg").textContent =
                "☣️ 이전 구역 제한시간 초과! 독가스 확산 & 호드 광폭화! 후방 격벽을 폐쇄하십시오!";
              collapseBanner.classList.remove("hidden");
            }
          }
        }

        // [v3.5 신규 2차 광폭화 시스템]
        // 조건: 후방 격벽 미폐쇄(isAwaitingBulkhead) AND 이전 구역 광폭화(prevRoom.berserkActive) (둘 다 참일 때!)
        if (prevRoom.berserkActive) {
          if (prevRoom.phase2Timer === undefined) {
            prevRoom.phase2Timer = 30.0; // 30초 카운트다운 부여!
          }
          prevRoom.phase2Timer = Math.max(0, prevRoom.phase2Timer - dt);

          if (prevRoom.phase2Timer <= 0 && !prevRoom.phase2Berserk) {
            prevRoom.phase2Berserk = true;
            SoundFX.play("alarm");
            const collapseBanner = document.getElementById("hud-collapse-banner");
            if (collapseBanner) {
              document.getElementById("hud-collapse-msg").textContent =
                "💀 2차 광폭화 발동! 체력 8배 강화 감염체 급습! 즉시 격벽을 폐쇄하십시오!";
              collapseBanner.classList.remove("hidden");
            }

            // 현재 생존 감염체 2차 광폭화 (체력 8배 적용!)
            game.zombies.forEach(z => {
              if (!z.phase2Enraged && !z.spec.isNutrientHost && !z.spec.isMidBoss) {
                z.phase2Enraged = true;
                z.maxHp = Math.round(z.maxHp * 8);
                z.hp = Math.round(z.hp * 8);
                z.speed *= 1.15;
                if (z.group) z.group.scale.multiplyScalar(1.2);
                if (z.skinMat) {
                  z.skinMat.emissive.setHex(0x991b1b);
                  z.skinMat.emissiveIntensity = 1.0;
                }
              }
            });
          }
        }
      }

      // B) 현재 방 타이머: 후방 격벽 폐쇄 대기 중(isAwaitingBulkhead)이 아닐 때 정상적으로 0초를 향해 진행!
      if (curRoom && !curRoom.isBossRoom && !isAwaitingBulkhead) {
        curRoom.sectorTimer = Math.max(0, (curRoom.sectorTimer || 260) - dt);
        if (curRoom.sectorTimer <= 0) {
          if (!curRoom.overtimeAlerted) {
            curRoom.overtimeAlerted = true;
            curRoom.berserkActive = true;
            curRoom.gasWaveActive = true;
            curRoom.gasWaveProgress = 0.05;
            if (curRoom.spawnHoles) {
              curRoom.spawnHoles.forEach(h => {
                if (!h.active) {
                  h.active = true;
                  if (h.intactWallMesh) h.intactWallMesh.visible = false;
                  if (h.breachDetailGroup) h.breachDetailGroup.visible = true;
                }
              });
            }

            // 현재 살아있는 모든 감염체도 즉시 광폭화(체력 +75%, 공격력 +35%, 이속 +35%, 핏빛 발광, 15% 벌크업) 적용!
            game.zombies.forEach(z => {
              if (!z.berserkEnraged && !z.spec.isNutrientHost) {
                z.berserkEnraged = true;
                const hpMult = 1.75;
                z.maxHp = Math.round(z.maxHp * hpMult);
                z.hp = Math.round(z.hp * hpMult);
                z.speed *= 1.35;
                if (z.group) {
                  z.group.scale.multiplyScalar(1.15);
                }
                if (z.skinMat) {
                  z.skinMat.emissive.setHex(0xef4444);
                  z.skinMat.emissiveIntensity = 0.85;
                }
              }
            });
            SoundFX.play("alarm");
            const collapseBanner = document.getElementById("hud-collapse-banner");
            if (collapseBanner) {
              document.getElementById("hud-collapse-msg").textContent =
                "☣️ 제한시간 초과! 독가스 확산 & 호드 광폭화!";
              collapseBanner.classList.remove("hidden");
            }
          }
          game.wavePhase = "SURGE";
          hideArmoriesDuringSurge();
          const collapseTimerEl = document.getElementById("hud-collapse-timer");
          if (collapseTimerEl && !game.collapseState.active) {
            collapseTimerEl.textContent = "";
          }
        }
      }

      // [v3.2 10섹터 3단계 레이드 2단계]: 생체 방어 파일런 3기 실시간 피격/파괴 판정
      if (curRoom && curRoom.isBossRoom && curRoom.bossPhaseStage === 2) {
        for (let i = game.bloodPylons.length - 1; i >= 0; i--) {
          const pyl = game.bloodPylons[i];
          if (pyl.hp <= 0) {
            spawnBloodParticles(pyl.x, 3.0, pyl.z, 0xf43f5e, 15);
            entitiesGroup.remove(pyl.mesh);
            game.bloodPylons.splice(i, 1);
          }
        }
        if (game.bloodPylons.length === 0) {
          curRoom.bossPhaseStage = 3;
          if (game.boss) {
            game.boss.active = true;
            game.boss.shielded = false;
            if (game.boss.shieldMat) game.boss.shieldMat.opacity = 0.0;
            spawnBloodParticles(game.boss.x, 3.5, game.boss.z, 0xef4444, 30);
          }
          SoundFX.play("explosion");
          SoundFX.play("alarm");
          const safeBanner = document.getElementById("hud-safe-banner");
          if (safeBanner) {
            document.getElementById("hud-safe-banner-text").textContent =
              "⚠️ 보호 파일런 전멸! '더 코어' 완전 각성!";
            safeBanner.classList.remove("hidden");
            setTimeout(() => safeBanner.classList.add("hidden"), 4200);
          }
        }
      }

      // [v3.1] 출구(nextDir) 반대편 외벽에서 시작하여 출구 문 쪽으로 멈추지 않고 끝까지 전진하는 지향성 독가스 (100% 맵 전체 잠식!)
      // 섹터 클리어 여부나 currentRoomIndex 변경과 무관하게, 독가스가 활성화된 모든 방에서 100%까지 끝까지 쾌속 확산!
      game.rooms.forEach(r => {
        if (!r.gasWaveActive || r.collapsed) return;

        // 멈추지 않고 1.0 (100%)까지 전진 (진행 속도: dt * 0.038, 약 26초 만에 맵 100% 완전 잠식)
        const isHost = (!isRemoteClient && mySlotIndex === 0);
        const hasNet = (wsClient && wsClient.readyState === WebSocket.OPEN);
        if (isHost || !hasNet) {
          r.gasWaveProgress = Math.min(1.0, (r.gasWaveProgress || 0) + dt * 0.038);
        }
        const prog = r.gasWaveProgress || 0;
        const rw = r.w || r.size;
        const rd = r.d || r.size;
        const hw = r.hw || r.half;
        const hd = r.hd || r.half;
        const exitKey = (r.nextDir && r.nextDir.key) || "N";

        if (r.gasMesh) {
          r.gasMesh.visible = true;
          if (exitKey === "N") {
            // 남쪽(S) 외벽에서 북쪽(N) 출구로 전진 (prog=1.0이면 전체 덮음)
            const gasLen = rd * prog;
            r.gasMesh.scale.set(1, 1, Math.max(0.02, prog));
            r.gasMesh.position.set(r.wx, 1.8, r.wz + hd - gasLen / 2);
          } else if (exitKey === "S") {
            // 북쪽(N) 외벽에서 남쪽(S) 출구로 전진
            const gasLen = rd * prog;
            r.gasMesh.scale.set(1, 1, Math.max(0.02, prog));
            r.gasMesh.position.set(r.wx, 1.8, r.wz - hd + gasLen / 2);
          } else if (exitKey === "E") {
            // 서쪽(W) 외벽에서 동쪽(E) 출구로 전진
            const gasLen = rw * prog;
            r.gasMesh.scale.set(Math.max(0.02, prog), 1, 1);
            r.gasMesh.position.set(r.wx - hw + gasLen / 2, 1.8, r.wz);
          } else {
            // 동쪽(E) 외벽에서 서쪽(W) 출구로 전진
            const gasLen = rw * prog;
            r.gasMesh.scale.set(Math.max(0.02, prog), 1, 1);
            r.gasMesh.position.set(r.wx + hw - gasLen / 2, 1.8, r.wz);
          }
        }

        // 독가스 구역 내 플레이어 지속 중독 피해 (prog >= 0.98이면 방 안의 전체 플레이어가 피해)
        game.players.forEach(p => {
          if (p.downed) return;
          // 플레이어가 이 방 범위 내에 있는지 확인
          if (Math.abs(p.x - r.wx) > hw || Math.abs(p.z - r.wz) > hd) return;

          let inGas = false;
          if (prog >= 0.98) {
            inGas = true;
          } else if (exitKey === "N" && p.z > r.wz + hd - rd * prog) {
            inGas = true;
          } else if (exitKey === "S" && p.z < r.wz - hd + rd * prog) {
            inGas = true;
          } else if (exitKey === "E" && p.x < r.wx - hw + rw * prog) {
            inGas = true;
          } else if (exitKey === "W" && p.x > r.wx + hw - rw * prog) {
            inGas = true;
          }
          if (inGas) {
            damagePlayer(p, 9.5 * dt, false, true);
          }
        });
      });

      // 2. Room Collapse Countdown
      if (game.collapseState.active) {
        game.collapseState.timer -= dt;
        const timerEl = document.getElementById("hud-collapse-timer");
        if (timerEl) timerEl.textContent = Math.max(0, game.collapseState.timer).toFixed(1) + "s";
        if (game.collapseState.timer <= 0) {
          const cRoom = game.rooms[game.collapseState.roomIndex];
          if (cRoom) executeRoomCollapse(cRoom);
          game.collapseState.active = false;
          const banner = document.getElementById("hud-collapse-banner");
          if (banner) banner.classList.add("hidden");
          const msg = document.getElementById("hud-collapse-msg");
          if (msg) msg.textContent = "";
          if (timerEl) timerEl.textContent = "";
        }
      }
    }

    function updateEnvironmentAndPlayerStatuses(dt, curRoom) {
      // 3. Environmental Sector Anomalies & [v3.2] 블랙아웃 정전 호러 60초 과부하 트립 타이머
      if (curRoom && (curRoom.blackoutEventTimer || 0) > 0) {
        curRoom.blackoutEventTimer = Math.max(0, curRoom.blackoutEventTimer - dt);
      }

      // 비상 발전기 60초 전력 타이머 카운트다운: 60초 후 과부하 차단기 트립으로 재암전!
      if (curRoom && curRoom.envType === "BLACKOUT" && curRoom.envCleared && !curRoom.cleared) {
        curRoom.blackoutRestoredTimer = Math.max(0, (curRoom.blackoutRestoredTimer || 60.0) - dt);
        if (curRoom.blackoutRestoredTimer <= 0) {
          curRoom.envCleared = false;
          curRoom.blackoutRestoredTimer = 0;
          SoundFX.play("alarm");
          const genNode = game.missionNodes.find(n => n.roomIndex === curRoom.index && n.kind === "ENV_CONTROL");
          if (genNode) {
            genNode.done = false;
            genNode.holdTime = 0;
            spawnBloodParticles(genNode.x, 2.2, genNode.z, 0xf59e0b, 10);
          }
          const safeBanner = document.getElementById("hud-safe-banner");
          if (safeBanner) {
            document.getElementById("hud-safe-banner-text").textContent =
              "⚡ 비상 발전기 과부하 정전! 배전반을 다시 조작하세요";
            safeBanner.classList.remove("hidden");
            setTimeout(() => safeBanner.classList.add("hidden"), 4000);
          }
        }
      }

      const isBlackoutNow = Boolean(
        curRoom && !curRoom.cleared && (
          (curRoom.envType === "BLACKOUT" && !curRoom.envCleared) ||
          (curRoom.blackoutEventTimer || 0) > 0
        )
      );

      if (isBlackoutNow) {
        // 완전 칠흑 암전: 손전등 전방 원뿔 외에는 뒤와 주변이 완전히 어두워짐!
        ambientLight.intensity = 0.015;
        dirLight.intensity = 0.0;
      } else if (curRoom && curRoom.envType === "BLOOD_RAIN") {
        ambientLight.intensity = 0.52;
        dirLight.intensity = 0.75;
      } else {
        ambientLight.intensity = 0.72;
        dirLight.intensity = 0.95;
      }

      game.players.forEach(p => {
        p.dashCooldown = Math.max(0, p.dashCooldown - dt);
        p.bashCooldown = Math.max(0, (p.bashCooldown || 0) - dt);
        // [v3.4] 암전 시 전방 집중 탐조등 점등 (시야 방해 테두리 메쉬 제거, 순수 조명만 투사)
        if (p.visual && p.visual.flashLight) {
          p.visual.flashLight.visible = isBlackoutNow && !p.downed;
          p.visual.flashLight.intensity = (isBlackoutNow && !p.downed) ? 7.5 : 0.0;
        }
        if (p.visual && p.visual.footLight) {
          p.visual.footLight.visible = isBlackoutNow && !p.downed;
          p.visual.footLight.intensity = (isBlackoutNow && !p.downed) ? 0.35 : 0.0;
        }
        if (p.visual && p.visual.flashCone) {
          p.visual.flashCone.visible = false;
        }
        const insideCurRoom = curRoom && (
          Math.abs(p.x - curRoom.wx) <= ((curRoom.hw || curRoom.half) + 1.0) &&
          Math.abs(p.z - curRoom.wz) <= ((curRoom.hd || curRoom.half) + 1.0)
        );
        const inSafeZone = curRoom && curRoom.safeZones && curRoom.safeZones.some(sz => Math.hypot(p.x - sz.x, p.z - sz.z) <= sz.radius);
        p.inSafeZone = Boolean(inSafeZone);

        // 정화 안전지대(inSafeZone) 내에서는 독안개 및 냉각 가스 피해 100% 면역!
        if (!p.downed && insideCurRoom && !inSafeZone && curRoom.envType === "TOXIC_FOG" && !curRoom.envCleared && !curRoom.cleared) {
          damagePlayer(p, 1.45 * dt, false, false);
        }
        // [v3.3] 냉각 가스 누출(CRYO_LEAK) 섹터 환경피해 및 동상(causesFrost = true) 부여
        if (!p.downed && insideCurRoom && !inSafeZone && curRoom.envType === "CRYO_LEAK" && !curRoom.envCleared && !curRoom.cleared) {
          damagePlayer(p, 1.2 * dt, false, false, false, true);
        }
        p.dashActiveTimer = Math.max(0, p.dashActiveTimer - dt);
        p.stimBuffTimer = Math.max(0, p.stimBuffTimer - dt);
        p.swapOverchargeTimer = Math.max(0, p.swapOverchargeTimer - dt);
        p.postClearGraceTimer = Math.max(0, (p.postClearGraceTimer || 0) - dt);
        p.specCooldown = Math.max(0, (p.specCooldown || 0) - dt);

        // 선봉장(Juggernaut) 패시브: 10초마다 35 HP 결사 방어막(tempShield) 자동 재생
        if (p.specialization === "JUGGERNAUT" && !p.downed) {
          p.juggernautShieldTimer = (p.juggernautShieldTimer !== undefined ? p.juggernautShieldTimer : 10.0) - dt;
          if (p.juggernautShieldTimer <= 0) {
            p.juggernautShieldTimer = 10.0;
            if ((p.tempShield || 0) < 35) {
              p.tempShield = 35;
              spawnMissionStageVFX(p.x, p.z, 0xf59e0b, 2.5, 6, false);
            }
          }
        }

        if (p.specActiveTimer > 0) {
          p.specActiveTimer = Math.max(0, p.specActiveTimer - dt);
          // 의무관 나노 치유 안개 & 발광 치유 장판
          if (p.specialization === "MEDIC" && p.healingMistActive) {
            if (p.healingZoneGroup) {
              p.healingZoneGroup.rotation.y += dt * 0.45;
              if (p.healingDiscMat) {
                p.healingDiscMat.opacity = 0.25 + 0.12 * Math.sin(game.elapsedTime * 4.5);
              }
            }
            if (Math.random() < 0.25) {
              const ang = Math.random() * Math.PI * 2;
              const r = Math.random() * 4.5;
              spawnBloodParticles(p.healingMistX + Math.cos(ang) * r, 0.6, p.healingMistZ + Math.sin(ang) * r, 0x34d399, 1);
            }
            game.players.forEach(other => {
              if (!other.downed && Math.hypot(other.x - p.healingMistX, other.z - p.healingMistZ) <= 5.0) {
                other.hp = Math.min(other.maxHp, other.hp + 6.0 * dt);
                other.bleedingTimer = 0;
                other.acidTimer = 0;
                other.shockTimer = 0;
                other.frostTimer = 0;
              }
            });
          }
          if (p.specActiveTimer <= 0) {
            p.overclockActive = false;
            p.healingMistActive = false;
            if (p.healingZoneGroup) {
              try { effectsGroup.remove(p.healingZoneGroup); } catch (e) {}
              p.healingZoneGroup = null;
            }
            p.cloakActive = false;
            if (p.visual && p.visual.body) {
              p.visual.body.material.transparent = false;
              p.visual.body.material.opacity = 1.0;
            }
          }
        }
        if (p.tempShield > 0 && p.specActiveTimer <= 0) {
          const minShield = (p.specialization === "JUGGERNAUT") ? 35 : 0;
          if (p.tempShield > minShield) {
            p.tempShield = Math.max(minShield, p.tempShield - 18 * dt);
          }
        }

        // 다목적 전술 드론 시스템 (미해금 시 3D 모델 비활성화 & 기능 정지)
        if (p.drone && p.drone.unlocked) {
          if (p.visual && p.visual.droneGroup) {
            p.visual.droneGroup.visible = true;
          }

          if (p.drone.modules) {
            if (p.drone.modules.interceptor) {
              p.drone.modules.interceptor.cooldown = Math.max(0, (p.drone.modules.interceptor.cooldown || 0) - dt);
            }
            if (p.drone.modules.medi) {
              p.drone.modules.medi.cooldown = Math.max(0, (p.drone.modules.medi.cooldown || 0) - dt);

              // 의무 드론 원격 소생 (18m 반경, 레벨 1 이상 연구 시 가동, 구급키트 1개 소모, 90초 쿨타임, 섹터당 최대 2회)
              const mediLv = p.drone.modules.medi.level || 0;
              if (
                !p.downed &&
                mediLv >= 1 &&
                p.drone.modules.medi.cooldown <= 0 &&
                (p.drone.modules.medi.sectorRevivesUsed || 0) < 2 &&
                p.medkits >= 1 &&
                (!p.drone.animState || p.drone.animState === "IDLE")
              ) {
                const downedMate = game.players.find(other =>
                  other.id !== p.id && other.downed && Math.hypot(other.x - p.x, other.z - p.z) <= 18.0
                );
                if (downedMate) {
                  p.drone.modules.medi.cooldown = 90.0;
                  p.drone.modules.medi.sectorRevivesUsed = (p.drone.modules.medi.sectorRevivesUsed || 0) + 1;
                  p.medkits = Math.max(0, p.medkits - 1);
                  p.drone.animState = "FLYING_OUT";
                  p.drone.targetMateId = downedMate.id;
                  p.drone.worldX = p.x + 0.92;
                  p.drone.worldY = 2.15;
                  p.drone.worldZ = p.z - 0.45;

                  const safeBanner = document.getElementById("hud-safe-banner");
                  if (safeBanner) {
                    document.getElementById("hud-safe-banner-text").textContent =
                      `🛸 [의무 드론] ${downedMate.name} 구출을 위해 비행 출격!`;
                    safeBanner.classList.remove("hidden");
                    setTimeout(() => safeBanner.classList.add("hidden"), 3000);
                  }
                }
              }
            }
          }

          // 드론 시각적 위치 및 비행(원격 소생 출격/복귀) 상태 머신
          const dState = p.drone.animState || "IDLE";
          const defaultSocketX = p.x + 0.92;
          const defaultSocketY = 2.15 + Math.sin(Date.now() * 0.005 + p.id) * 0.08;
          const defaultSocketZ = p.z - 0.45;

          if (dState === "IDLE") {
            p.drone.worldX = defaultSocketX;
            p.drone.worldY = defaultSocketY;
            p.drone.worldZ = defaultSocketZ;
            if (p.visual && p.visual.droneGroup) {
              p.visual.droneGroup.position.set(0.92, 2.15 + Math.sin(Date.now() * 0.005 + p.id) * 0.08, -0.45);
            }
          } else if (dState === "FLYING_OUT") {
            const mate = game.players.find(m => m.id === p.drone.targetMateId);
            if (!mate || !mate.downed) {
              p.drone.animState = "FLYING_BACK";
            } else {
              const targetX = mate.x;
              const targetY = 1.85;
              const targetZ = mate.z;
              const dx = targetX - p.drone.worldX;
              const dy = targetY - p.drone.worldY;
              const dz = targetZ - p.drone.worldZ;
              const dist = Math.hypot(dx, dz) || 1;
              const speed = 16.5;
              const step = Math.min(dist, speed * dt);
              p.drone.worldX += (dx / dist) * step;
              p.drone.worldY += dy * Math.min(1.0, dt * 8);
              p.drone.worldZ += (dz / dist) * step;

              if (p.visual && p.visual.droneGroup) {
                p.visual.droneGroup.position.set(p.drone.worldX - p.x, p.drone.worldY, p.drone.worldZ - p.z);
              }
              if (dist <= 0.65) {
                p.drone.animState = "REVIVING";
                p.drone.animTimer = 1.1;
                SoundFX.play("empty");
              }
            }
          } else if (dState === "REVIVING") {
            const mate = game.players.find(m => m.id === p.drone.targetMateId);
            if (!mate || !mate.downed) {
              p.drone.animState = "FLYING_BACK";
            } else {
              p.drone.worldX = mate.x;
              p.drone.worldY = 1.85 + Math.sin(Date.now() * 0.01) * 0.05;
              p.drone.worldZ = mate.z;

              if (p.visual && p.visual.droneGroup) {
                p.visual.droneGroup.position.set(p.drone.worldX - p.x, p.drone.worldY, p.drone.worldZ - p.z);
              }
              // 나노 소생 빔 및 녹색 치유 파티클 방사
              if (Math.random() < 0.6) {
                spawnBloodParticles(mate.x, 1.2, mate.z, 0x10b981, 2);
              }
              p.drone.animTimer -= dt;
              if (p.drone.animTimer <= 0) {
                mate.downed = false;
                mate.hp = 35;
                mate.bleedingTimer = 0;
                mate.acidTimer = 0;
                mate.shockTimer = 0;
                mate.frostTimer = 0;
                mate.visual.body.rotation.x = 0;
                mate.visual.body.position.y = 1.0;
                mate.visual.head.position.set(0, 1.85, 0);
                SoundFX.play("revive");
                spawnBloodParticles(mate.x, 1.5, mate.z, 0x10b981, 22);

                const safeBanner = document.getElementById("hud-safe-banner");
                if (safeBanner) {
                  document.getElementById("hud-safe-banner-text").textContent =
                    `💉 [의무 드론] ${mate.name} 원격 소생 성공! (잔여 쿨타임 90초)`;
                  safeBanner.classList.remove("hidden");
                  setTimeout(() => safeBanner.classList.add("hidden"), 3800);
                }
                p.drone.animState = "FLYING_BACK";
              }
            }
          } else if (dState === "FLYING_BACK") {
            const targetX = defaultSocketX;
            const targetY = defaultSocketY;
            const targetZ = defaultSocketZ;
            const dx = targetX - p.drone.worldX;
            const dy = targetY - p.drone.worldY;
            const dz = targetZ - p.drone.worldZ;
            const dist = Math.hypot(dx, dz) || 1;
            const speed = 18.0;
            const step = Math.min(dist, speed * dt);
            p.drone.worldX += (dx / dist) * step;
            p.drone.worldY += dy * Math.min(1.0, dt * 8);
            p.drone.worldZ += (dz / dist) * step;

            if (p.visual && p.visual.droneGroup) {
              p.visual.droneGroup.position.set(p.drone.worldX - p.x, p.drone.worldY, p.drone.worldZ - p.z);
            }
            if (dist <= 0.65) {
              p.drone.animState = "IDLE";
              SoundFX.play("pickup");
            }
          }

          if (p.visual && p.visual.droneEye) {
            const isParryReady = (!p.drone.modules.interceptor || (p.drone.modules.interceptor.level || 0) === 0 || p.drone.modules.interceptor.cooldown <= 0);
            p.visual.droneEye.material.color.setHex(isParryReady ? 0x38bdf8 : 0xef4444);
          }
        } else {
          // 미해금 시 3D 모델 비표시
          if (p.visual && p.visual.droneGroup) {
            p.visual.droneGroup.visible = false;
          }
        }

        if (p.stimBuffTimer > 0) {
          p.bleedingTimer = 0;
          p.acidTimer = 0;
          p.shockTimer = 0;
          p.frostTimer = 0;
        }

        if (p.tempHp > 0 && p.stimBuffTimer <= 0) {
          p.tempHp = Math.max(0, p.tempHp - 3.5 * dt);
        }

        if (p.downed) return;

        if (p.bleedingTimer > 0) {
          p.bleedingTimer -= dt;
          damagePlayer(p, 2.2 * dt, false, false);
        }
        if (p.acidTimer > 0) {
          p.acidTimer -= dt;
        }
        if (p.shockTimer > 0) {
          p.shockTimer -= dt;
        }
        if (p.frostTimer > 0) {
          p.frostTimer -= dt;
        }

        if (p.bandagingTimer > 0) {
          p.bandagingTimer -= dt;
          if (p.bandagingTimer <= 0) {
            const hasSyr = isPlayerSyringeUpgraded(p);
            p.medkits = Math.max(0, p.medkits - 1);
            const healVal = hasSyr ? 80 : 65;
            p.hp = Math.min(p.maxHp, p.hp + healVal);
            p.bleedingTimer = 0;
            if (hasSyr) p.acidTimer = 0;
            SoundFX.play("revive");
            // [의무관 패시브] 치료 완료 시 4m 내 아군에게 회복량 25% 공유
            if (p.specialization === "MEDIC") {
              game.players.forEach(other => {
                if (other.id !== p.id && !other.downed && Math.hypot(other.x - p.x, other.z - p.z) <= 4.0) {
                  other.hp = Math.min(other.maxHp, other.hp + Math.round(healVal * 0.25));
                  other.bleedingTimer = 0;
                  spawnBloodParticles(other.x, 1.2, other.z, 0x10b981, 6);
                }
              });
            }
          }
        }

        game.rooms.forEach(r => {
          if (r.collapsed && Math.abs(p.x - r.wx) < (r.hw || r.half) && Math.abs(p.z - r.wz) < (r.hd || r.half)) {
            damagePlayer(p, 28 * dt, false, false);
          }
        });
        game.acidPools.forEach(pool => {
          if (Math.hypot(p.x - pool.x, p.z - pool.z) < pool.radius) {
            damagePlayer(p, 14 * dt, false, true);
          }
        });
      });
    }

    function updateWavePhasesAndHordeSpawner(dt, curRoom, prevRoom) {
      // 4. 엄격한 순차 웨이브 방어 & 미션 요소 해금 + [v3.1] 소강기(CALM) 전용 팝업 무기고 + 스폰 구멍 중반 이후 확률 개방
      // [신규 규칙] 1섹터 이후(curRoom.index > 0)에서는 후방 격벽 폐쇄 전까지 웨이브 카운트다운을 정지하고 소강기(CALM) 정비 상태를 유지!
      const curRoomWaitingBulkhead = curRoom && curRoom.index > 0 && !curRoom.lockedBehind;

      if (!curRoomWaitingBulkhead) {
        game.waveTimer = (game.waveTimer || 6.0) - dt;
      } else {
        game.wavePhase = "CALM";
        game.waveTimer = 15.0;
      }
      if (game.waveTimer <= 0) {
        if (game.wavePhase === "CALM") {
          game.wavePhase = "SURGE";
          game.waveTimer = 20.0 + Math.min(5.0, game.currentRoomIndex * 0.5);
          game.waveNumber = (game.waveNumber || 1) + 1;
          hideArmoriesDuringSurge();

          if (curRoom) {
            curRoom.roomWaveCount = (curRoom.roomWaveCount || 1) + 1;
            curRoom.waveZombieQuota = calculateWaveQuota(curRoom.index, curRoom.roomWaveCount);
            curRoom.waveZombiesSpawned = 0;
            // [v3.1] 스폰 구멍 추가 개방 이벤트: 타이머가 중반(50% 이하)으로 넘어간 이후에만, 배정된 확률 섹터에서 발생!
            const isPastMidTime = (curRoom.sectorTimer || 0) <= (curRoom.maxSectorTimer || 260) * 0.55;
            if (
              curRoom.willHaveExtraBreach &&
              isPastMidTime &&
              (curRoom.extraHolesOpened || 0) < (curRoom.maxExtraHoles || 1) &&
              Math.random() < 0.65
            ) {
              curRoom.extraHolesOpened = (curRoom.extraHolesOpened || 0) + 1;
              activateAdditionalSpawnHole(curRoom);
            }

            // [v3.1] 3섹터 이상에서 웨이브 시작 시 28% 확률로 16초간 돌발 비상 정전(블랙아웃) 호러 이벤트 발생!
            if (curRoom.index >= 2 && !curRoom.isBossRoom && !curRoom.blackoutTriggeredOnce && Math.random() < 0.28) {
              curRoom.blackoutTriggeredOnce = true;
              curRoom.blackoutEventTimer = 16.0;
              const safeBanner = document.getElementById("hud-safe-banner");
              if (safeBanner) {
                document.getElementById("hud-safe-banner-text").textContent =
                  "⚡ 정전(BLACKOUT) 발생! 전방 손전등 자동 점등";
                safeBanner.classList.remove("hidden");
                setTimeout(() => safeBanner.classList.add("hidden"), 4000);
              }
            }
          }
          SoundFX.play("alarm");
        } else {
          // SURGE 웨이브 방어 체크:
          // [초반 1~3섹터 완화] 1~3섹터(game.currentRoomIndex <= 2)에서는 초반 화력 부족으로 좀비가 계속 누적되는 것을 막기 위해,
          // 미션 방어 중뿐만 아니라 일반 웨이브에서도 스폰 정원이 모두 출현하고 생존 좀비가 5마리 이하로 소탕되어야 소강기(CALM)로 전환!
          // 4섹터 이후부터는 기존대로 시간 경과 시 미션 대기 상태가 아니면 계속 다음 웨이브 진행!
          const isEarlySector = (game.currentRoomIndex || 0) <= 2;
          const quotaFinished = curRoom ? ((curRoom.waveZombiesSpawned || 0) >= (curRoom.waveZombieQuota || 1)) : true;
          const zombiesCleared = game.zombies.length <= 5;
          const mustWaitForClear = curRoom && (curRoom.waitingForWaveDefense || isEarlySector);

          if (mustWaitForClear && (!quotaFinished || !zombiesCleared)) {
            game.waveTimer = 0; // 정원 출현 및 잔당 5마리 이하 소탕 대기 상태 유지
          } else {
            game.wavePhase = "CALM";
            game.waveTimer = 18.0;

            if (curRoom) {
              relocateArmoryForCalmPhase(curRoom);
            }

            if (curRoom && !curRoom.cleared && !curRoom.isBossRoom) {
              if (!isRemoteClient) {
                if (curRoom.waitingForWaveDefense) {
                  curRoom.unlockStage = (curRoom.unlockStage || 0) + 1;
                  curRoom.waitingForWaveDefense = false;
                  spawnRandomMissionStepForRoom(curRoom, curRoom.unlockStage);
                  SoundFX.play("pickup");

                  const meP = game.players[mySlotIndex] || game.players[0];
                  const dirHint = (meP && curRoom.activeMissionTargetPos)
                    ? getCompassDirectionHint(meP.x, meP.z, curRoom.activeMissionTargetPos.x, curRoom.activeMissionTargetPos.z)
                    : "섹터 내부";

                  const safeBanner = document.getElementById("hud-safe-banner");
                  if (safeBanner) {
                    document.getElementById("hud-safe-banner-text").textContent =
                      `🔓 웨이브 방어 성공! [${curRoom.unlockStage}단계 목표] 개방 (${dirHint})`;
                    safeBanner.classList.remove("hidden");
                    setTimeout(() => safeBanner.classList.add("hidden"), 4200);
                  }
                } else {
                  const safeBanner = document.getElementById("hud-safe-banner");
                  if (safeBanner) {
                    document.getElementById("hud-safe-banner-text").textContent =
                      `🛡️ 소강기(18s): [${curRoom.unlockStage}단계 목표]를 진행하세요`;
                    safeBanner.classList.remove("hidden");
                    setTimeout(() => safeBanner.classList.add("hidden"), 3800);
                  }
                }
              }
            }
          }
        }
      }

      if (curRoom && curRoom.spawnHoles) {
        curRoom.spawnHoles.forEach(h => {
          if (h.active && h.ringMesh) {
            h.pulse += dt * 4.5;
            h.ringMesh.material.opacity = 0.55 + Math.sin(h.pulse) * 0.3;
          }
        });
      }

      // [v3.1 웨이브별 확정 좀비 정원(Quota) & 섹터 스케일링 스폰 시스템]
      // 각 섹터 및 웨이브별 정해진 마리수(waveZombieQuota)만큼 확실하게 스폰되어 누적되며,
      // 정원이 모두 출현한 이후에는 스폰이 멈추고 5마리 이하 소탕 시 웨이브 방어 성공으로 판정됨!
      game.spawnTimer -= dt;
      const isSurge = (game.wavePhase === "SURGE") || (curRoom && (curRoom.collapsing || curRoom.berserkActive)) || (prevRoom && prevRoom.berserkActive);
      const rWave = curRoom ? (curRoom.roomWaveCount || 1) : 1;
      const secCapLv = getSectorMaxStatLv(); // 1 ~ 10

      if (curRoom && curRoom.waveZombieQuota === undefined) {
        curRoom.waveZombieQuota = calculateWaveQuota(curRoom.index, curRoom.roomWaveCount || 1);
        curRoom.waveZombiesSpawned = curRoom.waveZombiesSpawned || 0;
      }

      // 방어 중일 때 아직 스폰해야 할 남은 정원 계산
      const remainingQuota = curRoom ? Math.max(0, (curRoom.waveZombieQuota || 0) - (curRoom.waveZombiesSpawned || 0)) : 999;
      // 정원 스폰 완료 후에는 방어 중 추가 스폰 중단 (호드 소탕 단계)
      const isWaveHordeFinished = curRoom && curRoom.waitingForWaveDefense && remainingQuota <= 0;
      // 소강기(CALM) 중에는 정비 안전을 위해 맵에 좀비가 4마리 미만일 때만 가끔 1마리씩 정찰 스폰
      const isCalmSpawningRestricted = (game.wavePhase === "CALM") && game.zombies.length >= 4;
      const maxSwarm = 360; // 엔진 안전선

      // [v3.5] 보스 격전지 진입 시 정비 단계(스쿼드 준비 및 무기고 쇼핑) 중에는 호드 스폰 일시 정지!
      const isBossPrepState = (curRoom && curRoom.hasMidBoss && !curRoom.midBossAwakened) ||
                              (curRoom && curRoom.isBossRoom && (curRoom.bossPhaseStage || 0) === 0);

      // 후방 격벽 폐쇄 대기 중일 때는:
      // - 신규 방(curRoom)에서는 감염체가 전혀 스폰되지 않음!
      // - 이전 방(prevRoom)이 0초에 도달하여 광폭화(berserkActive)된 경우에만, 이전 방의 스폰 구멍에서 광폭화 감염체가 스폰되어 열린 문으로 난입!
      const canSpawnHorde = isBossPrepState ? false : (curRoomWaitingBulkhead
        ? (prevRoom && prevRoom.berserkActive)
        : (!isWaveHordeFinished && !isCalmSpawningRestricted));

      if (!isRemoteClient && canSpawnHorde && game.spawnTimer <= 0 && game.zombies.length < maxSwarm) {
        game.spawnTimer = isSurge
          ? Math.max(0.40, 0.95 - game.currentRoomIndex * 0.04 - rWave * 0.02)
          : Math.max(1.8, 2.8 - game.currentRoomIndex * 0.06);

        const targetRoom = curRoomWaitingBulkhead ? prevRoom : curRoom;
        if (targetRoom) {
          const activeHoles = (targetRoom.spawnHoles || []).filter(h => h.active);
          if (activeHoles.length > 0) {
            let packSize = isSurge
              ? Math.min(10, 3 + Math.floor(secCapLv * 0.6) + Math.floor(rWave * 0.4))
              : 1;

            if (curRoomWaitingBulkhead) {
              packSize = Math.min(3, packSize);
            } else if (targetRoom.waitingForWaveDefense) {
              packSize = Math.min(packSize, remainingQuota);
            }

            if (packSize > 0) {
              if (!curRoomWaitingBulkhead) {
                targetRoom.waveZombiesSpawned = (targetRoom.waveZombiesSpawned || 0) + packSize;
              }
              const hole = activeHoles[Math.floor(Math.random() * activeHoles.length)];

              const hw = targetRoom.hw || targetRoom.half;
              const hd = targetRoom.hd || targetRoom.half;
              const inX = hole.x < targetRoom.wx - (hw - 12) ? hole.x + 2.4 : (hole.x > targetRoom.wx + (hw - 12) ? hole.x - 2.4 : hole.x);
              const inZ = hole.z < targetRoom.wz - (hd - 12) ? hole.z + 2.4 : (hole.z > targetRoom.wz + (hd - 12) ? hole.z - 2.4 : hole.z);

              for (let k = 0; k < packSize; k++) {
                if (game.zombies.length >= maxSwarm) break;
                const jitterA = (k / packSize) * Math.PI * 2 + Math.random() * 0.5;
                const zx = Math.max(targetRoom.wx - hw + 2.6, Math.min(targetRoom.wx + hw - 2.6, inX + Math.cos(jitterA) * 1.6));
                const zz = Math.max(targetRoom.wz - hd + 2.6, Math.min(targetRoom.wz + hd - 2.6, inZ + Math.sin(jitterA) * 1.6));

                // [v3.1] 섹터별 특수 좀비 계단식 순차 해금!
                // 1섹터(index 0): 무조건 100% 기본 감염체(WALKER)만 출현!
                // 2섹터(index 1): 러너 합류 | 3섹터(index 2): 스핏터·부머 합류 | 4~5섹터: 골리앗 합류 | 6섹터+: 블러드 데빌 합류
                const roll = Math.random();
                const sIdx = targetRoom.index;
                let zType = "WALKER";
                if (sIdx === 0) {
                  zType = "WALKER";
                } else if (sIdx === 1) {
                  if (roll < 0.28) zType = "RUNNER";
                } else if (sIdx === 2) {
                  if (roll < 0.22) zType = "RUNNER";
                  else if (roll < 0.38) zType = "SPITTER";
                  else if (roll < 0.50) zType = "BOOMER";
                } else if (sIdx <= 4) {
                  if (roll < 0.22) zType = "RUNNER";
                  else if (roll < 0.38) zType = "SPITTER";
                  else if (roll < 0.52) zType = "BOOMER";
                  else if (roll < 0.66) zType = "GOLIATH";
                } else {
                  if (roll < 0.22) zType = "RUNNER";
                  else if (roll < 0.38) zType = "SPITTER";
                  else if (roll < 0.52) zType = "BOOMER";
                  else if (roll < 0.68) zType = "GOLIATH";
                  else if (roll < 0.82) zType = "DEVIL";
                }

                const zSpawned = spawnZombie(zType, zx, zz, targetRoom.index);
                if (targetRoom.berserkActive && zSpawned) {
                  zSpawned.berserkEnraged = true;
                  let hpMult = 1.75;
                  if (targetRoom.phase2Berserk) {
                    zSpawned.phase2Enraged = true;
                    hpMult = 1.75 * 8; // 2차 광폭화 시 기존 대비 8배 체력!
                  }
                  zSpawned.maxHp = Math.round(zSpawned.maxHp * hpMult);
                  zSpawned.hp = zSpawned.maxHp;
                  zSpawned.speed *= targetRoom.phase2Berserk ? 1.45 : 1.35;
                  if (zSpawned.group) {
                    zSpawned.group.scale.multiplyScalar(targetRoom.phase2Berserk ? 1.3 : 1.15);
                  }
                  if (zSpawned.skinMat) {
                    zSpawned.skinMat.emissive.setHex(targetRoom.phase2Berserk ? 0x991b1b : 0xef4444);
                    zSpawned.skinMat.emissiveIntensity = targetRoom.phase2Berserk ? 1.0 : 0.85;
                  }
                }
              }
            }
          }
        }
      }
    }

    function updateParticlesAndCamera(dt) {
      for (let i = game.particles.length - 1; i >= 0; i--) {
        const pt = game.particles[i];
        pt.life -= dt;
        if (pt.vx !== undefined) {
          pt.mesh.position.x += pt.vx * dt;
          pt.mesh.position.y += pt.vy * dt;
          pt.mesh.position.z += pt.vz * dt;
          pt.vy -= 14 * dt;
        }
        if (pt.expand) {
          const s = 1 + (1 - pt.life / pt.maxLife) * pt.expand;
          pt.mesh.scale.set(s, s, s);
        }
        if (pt.life <= 0) {
          effectsGroup.remove(pt.mesh);
          game.particles.splice(i, 1);
        }
      }

      // 5. 3D 멀미 방지 카메라 시스템:
      // antiMotionSickness가 켜져 있으면 camera.position과 camera.lookAt이 항상 동일한 기준점(camFocusX, camFocusZ)을 사용하여
      // 캐릭터가 이동하거나 대시할 때 카메라 각도가 단 0.1도도 기울어지지 않고 평행 이동만 수행함!
      const me = game.players[mySlotIndex];
      if (me) {
        const offset = CAMERA_OFFSETS[cameraZoomIndex];
        if (!camInitialized || !userSettings.cameraSmooth) {
          camFocusX = me.x;
          camFocusZ = me.z;
          camInitialized = true;
        } else {
          camFocusX += (me.x - camFocusX) * 0.18;
          camFocusZ += (me.z - camFocusZ) * 0.18;
        }

        if (userSettings.antiMotionSickness) {
          // 화면 기울임 0%: 카메라 위치와 시선 목표점이 정확히 동일한 (camFocusX, camFocusZ)를 공유!
          camera.position.set(camFocusX + offset.x, offset.y, camFocusZ + offset.z);
          camera.lookAt(camFocusX, 0.8, camFocusZ);
        } else {
          // 다이내믹 틸트 카메라 (기존 방식)
          camera.position.lerp(new THREE.Vector3(me.x + offset.x, offset.y, me.z + offset.z), 0.14);
          camera.lookAt(me.x, 0.8, me.z);
        }
      }
    }

    function updateSimulation(dt) {
      if (!game.running) return;
      game.elapsedTime += dt;

      if (game.comboTimer > 0) {
        game.comboTimer -= dt;
        if (game.comboTimer <= 0) game.comboCount = 0;
      }

      const curRoom = game.rooms[game.currentRoomIndex];
      const isAwaitingBulkhead = curRoom && curRoom.index > 0 && !curRoom.lockedBehind;
      const prevRoom = isAwaitingBulkhead ? game.rooms[curRoom.index - 1] : null;

      updateMissionPropsAndDoorAnimations(dt, curRoom);
      updateRoomTransitionAndTimers(dt, curRoom, prevRoom, isAwaitingBulkhead);
      updateEnvironmentAndPlayerStatuses(dt, curRoom);
      updateWavePhasesAndHordeSpawner(dt, curRoom, prevRoom);

      updatePlayersAndInteractions(dt);
      updateZombiesAndTurrets(dt);
      updateBossAI(dt);
      updateBossHazards(dt);
      updateBullets(dt);
      updateCratesAndPickups(dt);

      updateParticlesAndCamera(dt);
      updateHUD();
      drawMinimap();
    }
