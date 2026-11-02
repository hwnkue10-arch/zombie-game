/**
 * =========================================================================
 * BOXHEAD: THE CORE v3.6 — Frontend Module: 06c_player_interactions.js
 * Player Mission/Revive/Armory Interactions, Sprint/Aim Physics & World Badges
 * Zero-Loss Refactored Architecture (Shared Global Lexical Scope)
 * =========================================================================
 */
"use strict";

    // =========================================================================
    // 16B. PLAYER INTERACTIONS, MISSION NODES, MOVEMENT & FLOATING BADGES
    // =========================================================================
    function handleMissionNodeInteraction(p, curRoom, nearMissionNode, holdingF, dt, unlockStg, interactTitle, interactDesc, interactBar) {
            const reqStep = nearMissionNode.stepOrder || 0;
            if (reqStep > 0 && unlockStg < reqStep) {
              // 엄격한 순차 웨이브 잠금 안내!
              const prevDone = (curRoom.completedStage || 0) >= (reqStep - 1);
              interactTitle.textContent = prevDone
                ? `🔒 현재 웨이브를 방어하면 [${reqStep}단계 목표]가 개방됩니다!`
                : `🔒 먼저 [${reqStep - 1}단계 목표] 완료 후 웨이브를 방어해야 개방됩니다!`;
              interactBar.style.width = "0%";
            } else if (nearMissionNode.kind === "ENV_CONTROL") {
              const isFog = nearMissionNode.envType === "TOXIC_FOG";
              if (curRoom && (curRoom.blackoutRestoredTimer || 0) > 0) {
                interactTitle.textContent = `💡 비상 조명 켜짐 (${Math.ceil(curRoom.blackoutRestoredTimer)}초 후 과부하)`;
                interactBar.style.width = "100%";
              } else {
                interactTitle.textContent = isFog ? "☣️ [F 홀드] 환기밸브 개방" : "💡 [F 홀드] 비상 조명 배전반 복구";
                if (holdingF) {
                  nearMissionNode.holdTime += dt;
                  interactBar.style.width = Math.min(100, (nearMissionNode.holdTime / 1.5) * 100) + "%";
                  if (nearMissionNode.holdTime >= 1.5) {
                    if (isFog) {
                      nearMissionNode.done = true;
                      curRoom.envCleared = true;
                      entitiesGroup.remove(nearMissionNode.mesh);
                    } else {
                      // [v3.2] 비상 조명 배전반 복구: 60초간 전력 복구 후 자동 과부하 트립 발생!
                      curRoom.envCleared = true;
                      curRoom.blackoutRestoredTimer = 60.0;
                      nearMissionNode.holdTime = 0;
                      const safeBanner = document.getElementById("hud-safe-banner");
                      if (safeBanner) {
                        document.getElementById("hud-safe-banner-text").textContent =
                          "💡 비상 조명 배전반 복구! 60초간 정상 조명 유지";
                        safeBanner.classList.remove("hidden");
                        setTimeout(() => safeBanner.classList.add("hidden"), 4000);
                      }
                    }
                    spawnMissionStageVFX(
                      nearMissionNode.x,
                      nearMissionNode.z,
                      isFog ? 0x84cc16 : 0xfacc15,
                      7.5,
                      18,
                      false
                    );
                    SoundFX.play("upgrade");
                    if (wsClient && wsClient.readyState === WebSocket.OPEN) {
                      try {
                        wsClient.send(JSON.stringify({
                          type: "MISSION_ACTION",
                          slotId: mySlotIndex,
                          roomIdx: curRoom.index,
                          action: "RESTORE_POWER",
                          envType: nearMissionNode.envType
                        }));
                      } catch (e) {}
                    }
                  }
                } else {
                  interactBar.style.width = "0%";
                }
              }
            } else if (nearMissionNode.kind === "MID_BOSS_POD") {
              interactTitle.textContent = "🔬 [F 홀드] 생체격리 해제 단말기 가동";
              interactDesc.textContent = "스쿼드 정비 완료 후 가동 권장 (1.5초)";
              if (holdingF) {
                nearMissionNode.holdTime += dt;
                interactBar.style.width = Math.min(100, (nearMissionNode.holdTime / 1.5) * 100) + "%";
                if (nearMissionNode.holdTime >= 1.5) {
                  nearMissionNode.done = true;
                  curRoom.midBossAwakened = true;
                  curRoom.midBossSpawned = true;
                  entitiesGroup.remove(nearMissionNode.mesh);
                  if (nearMissionNode.collider) {
                    game.obstacles = game.obstacles.filter(ob => ob !== nearMissionNode.collider);
                  }
                  game.obstacles = game.obstacles.filter(ob => Math.hypot(ob.x - curRoom.wx, ob.z - curRoom.wz) > 5.5);
                  spawnIceShatterFX(curRoom.wx, curRoom.wz, 15);
                  spawnBloodParticles(curRoom.wx, 2.5, curRoom.wz, 0x06b6d4, 25);
                  SoundFX.play("alarm");
                  if (!isRemoteClient) {
                    const mbPool = ["MB_JUGGERNAUT", "MB_SUMMONER", "MB_ACIDQUEEN"];
                    const mbKey = mbPool[Math.max(0, curRoom.midBossOrder) % mbPool.length];
                    const mb = spawnZombie(mbKey, curRoom.wx, curRoom.wz, curRoom.index);
                    const safeBanner = document.getElementById("hud-safe-banner");
                    if (safeBanner) {
                      document.getElementById("hud-safe-banner-text").textContent =
                        `🚨 경보: [${mb.spec.name}] 격리 해제! 즉시 격멸하십시오!`;
                      safeBanner.classList.remove("hidden");
                      setTimeout(() => safeBanner.classList.add("hidden"), 4500);
                    }
                  }
                  if (wsClient && wsClient.readyState === WebSocket.OPEN) {
                    try {
                      wsClient.send(JSON.stringify({
                        type: "MISSION_ACTION",
                        slotId: mySlotIndex,
                        roomIdx: curRoom.index,
                        action: "WAKE_MIDBOSS"
                      }));
                    } catch (e) {}
                  }
                }
              } else {
                interactBar.style.width = "0%";
              }
            } else if (nearMissionNode.kind === "BULKHEAD_CONSOLE") {
              const targetRoom = game.rooms[nearMissionNode.roomIndex];
              const livingHumans = game.players.filter(pl => !pl.downed && (pl.role === "LOCAL" || pl.role === "REMOTE"));
              const allInside = targetRoom && livingHumans.length > 0 && livingHumans.every(pl =>
                Math.abs(pl.x - targetRoom.wx) <= ((targetRoom.hw || targetRoom.half) + 3.0) &&
                Math.abs(pl.z - targetRoom.wz) <= ((targetRoom.hd || targetRoom.half) + 3.0)
              );

              if (targetRoom && targetRoom.lockedBehind) {
                interactTitle.textContent = "🔒 후방 격벽 폐쇄 완료";
                interactDesc.textContent = "이전 구역과의 통로가 영구 차단되었습니다.";
                interactBar.style.width = "0%";
              } else if (!allInside) {
                interactTitle.textContent = "⚠️ 대원 미도착: 전원 구역 진입 필요";
                interactDesc.textContent = "살아있는 모든 대원이 구역 내로 진입해야 격벽을 폐쇄할 수 있습니다.";
                interactBar.style.width = "0%";
              } else {
                interactTitle.textContent = "🔒 [F 홀드] 후방 격벽 긴급 폐쇄";
                interactDesc.textContent = "후방 통로를 영구 차단하고 S" + (targetRoom.index + 1) + " 작전을 개시합니다. (0.8초)";
                if (holdingF) {
                  nearMissionNode.holdTime = (nearMissionNode.holdTime || 0) + dt;
                  interactBar.style.width = Math.min(100, (nearMissionNode.holdTime / 0.8) * 100) + "%";
                  if (nearMissionNode.holdTime >= 0.8) {
                    closeAndLockBulkheadDoor(targetRoom);
                    nearMissionNode.holdTime = 0;
                    interactBar.style.width = "0%";
                    if (wsClient && wsClient.readyState === WebSocket.OPEN) {
                      try {
                        wsClient.send(JSON.stringify({
                          type: "MISSION_ACTION",
                          slotId: mySlotIndex,
                          roomIdx: targetRoom.index,
                          action: "LOCK_BULKHEAD"
                        }));
                      } catch (e) {}
                    }
                  }
                } else {
                  interactBar.style.width = "0%";
                  nearMissionNode.holdTime = 0;
                }
              }
            } else if (nearMissionNode.kind === "BOSS_MASTER_CONSOLE") {
              interactTitle.textContent = "🚨 [F 홀드] 최종 레이드 개시 (심장 격벽 해제)";
              interactDesc.textContent = "스쿼드 전원 정비 완료 후 가동 (1.5초)";
              if (holdingF) {
                nearMissionNode.holdTime += dt;
                interactBar.style.width = Math.min(100, (nearMissionNode.holdTime / 1.5) * 100) + "%";
                if (nearMissionNode.holdTime >= 1.5) {
                  nearMissionNode.done = true;
                  curRoom.bossPhaseStage = 1;
                  entitiesGroup.remove(nearMissionNode.mesh);
                  SoundFX.play("alarm");
                  spawnMissionStageVFX(nearMissionNode.x, nearMissionNode.z, 0xf43f5e, 10.0, 25, true);
                  const safeBanner = document.getElementById("hud-safe-banner");
                  if (safeBanner) {
                    document.getElementById("hud-safe-banner-text").textContent =
                      "🚨 격벽 해제 개시! 돔 좌·우 보조 냉각콘솔 2기를 과부하시키십시오!";
                    safeBanner.classList.remove("hidden");
                    setTimeout(() => safeBanner.classList.add("hidden"), 4500);
                  }
                  if (wsClient && wsClient.readyState === WebSocket.OPEN) {
                    try {
                      wsClient.send(JSON.stringify({
                        type: "MISSION_ACTION",
                        slotId: mySlotIndex,
                        roomIdx: curRoom.index,
                        action: "START_FINAL_BOSS"
                      }));
                    } catch (e) {}
                  }
                }
              } else {
                interactBar.style.width = "0%";
              }
            } else if (nearMissionNode.kind === "BOSS_COOLANT") {
              if ((curRoom.bossPhaseStage || 0) < 1) {
                interactTitle.textContent = "🔒 중앙 심장 격벽 콘솔을 먼저 가동해야 합니다!";
                interactBar.style.width = "0%";
              } else {
                interactTitle.textContent = `❄️ [F 홀드] ${nearMissionNode.coolantIdx}번 보조 냉각콘솔 과부하`;
                if (holdingF) {
                  nearMissionNode.holdTime += dt;
                  interactBar.style.width = Math.min(100, (nearMissionNode.holdTime / 2.0) * 100) + "%";
                  if (nearMissionNode.holdTime >= 2.0) {
                    nearMissionNode.done = true;
                    entitiesGroup.remove(nearMissionNode.mesh);
                    curRoom.coolantsDone = (curRoom.coolantsDone || 0) + 1;
                    spawnMissionStageVFX(nearMissionNode.x, nearMissionNode.z, 0x06b6d4, 8.0, 20, false);
                    SoundFX.play("upgrade");
                    if (curRoom.coolantsDone >= 2) {
                      curRoom.bossPhaseStage = 2;
                      if (!isRemoteClient) spawnSector10DefensePylons(curRoom);
                      SoundFX.play("alarm");
                      const safeBanner = document.getElementById("hud-safe-banner");
                      if (safeBanner) {
                        document.getElementById("hud-safe-banner-text").textContent =
                          "⚡ 냉각 과부하 완료! 생체 파일런 3기 파괴 (보스 일점사)";
                        safeBanner.classList.remove("hidden");
                        setTimeout(() => safeBanner.classList.add("hidden"), 4200);
                      }
                    } else {
                      const safeBanner = document.getElementById("hud-safe-banner");
                      if (safeBanner) {
                        document.getElementById("hud-safe-banner-text").textContent =
                          "❄️ 1번 콘솔 완료! 반대편 2번 냉각 콘솔을 가동하세요";
                        safeBanner.classList.remove("hidden");
                        setTimeout(() => safeBanner.classList.add("hidden"), 3800);
                      }
                    }
                    if (wsClient && wsClient.readyState === WebSocket.OPEN) {
                      try {
                        wsClient.send(JSON.stringify({
                          type: "MISSION_ACTION",
                          slotId: mySlotIndex,
                          roomIdx: curRoom.index,
                          action: "OVERLOAD_COOLANT",
                          coolantIdx: nearMissionNode.coolantIdx
                        }));
                      } catch (e) {}
                    }
                  }
                } else {
                  interactBar.style.width = "0%";
                }
              }
            } else if (nearMissionNode.kind === "CHEM_PART") {
              interactTitle.textContent = `🧪 [F] ${reqStep}번 화학원료 회수`;
              interactBar.style.width = "100%";
              if (holdingF) {
                nearMissionNode.done = true;
                entitiesGroup.remove(nearMissionNode.mesh);
                game.thermiteParts++;
                spawnMissionStageVFX(nearMissionNode.x, nearMissionNode.z, 0xf59e0b, 4.2, 14, false);
                SoundFX.play("pickup");
                advanceRoomMissionStage(
                  curRoom,
                  reqStep,
                  reqStep === 1
                    ? "✅ 1번 원료 회수 완료! 다음 웨이브를 막으면 2번 원료가 개방됩니다!"
                    : "✅ 2번 원료 회수 완료! 다음 웨이브를 막으면 중앙 합성대가 개방됩니다!"
                );
                if (wsClient && wsClient.readyState === WebSocket.OPEN) {
                  try {
                    wsClient.send(JSON.stringify({
                      type: "MISSION_ACTION",
                      slotId: mySlotIndex,
                      roomIdx: curRoom.index,
                      action: "PICKUP_CHEM_PART",
                      stepOrder: nearMissionNode.stepOrder
                    }));
                  } catch (e) {}
                }
              }
            } else if (nearMissionNode.kind === "SYNTH_TABLE") {
              interactTitle.textContent = game.thermiteParts >= 2 ? "🔬 [F 홀드] 고열 테르밋 합성" : `🧪 원료 2개 필요 (${game.thermiteParts}/2)`;
              if (holdingF && game.thermiteParts >= 2) {
                nearMissionNode.holdTime += dt;
                interactBar.style.width = Math.min(100, (nearMissionNode.holdTime / 3.0) * 100) + "%";
                if (Math.random() < 0.4) {
                  spawnBloodParticles(nearMissionNode.x, 1.8, nearMissionNode.z, 0xf97316, 1);
                }
                if (nearMissionNode.holdTime >= 3.0) {
                  nearMissionNode.done = true;
                  curRoom.subStage = 1;
                  curRoom.completedStage = 3;
                  curRoom.lastSubStageChangeTime = Date.now();
                  spawnMissionStageVFX(nearMissionNode.x, nearMissionNode.z, 0xf97316, 6.5, 22, true);
                  SoundFX.play("upgrade");
                  const nextDoor = game.doors.find(d => d.fromRoom === curRoom.index && !d.open);
                  if (nextDoor) ensureThermiteDoorVisuals(curRoom, nextDoor);
                  const safeBanner = document.getElementById("hud-safe-banner");
                  if (safeBanner) {
                    document.getElementById("hud-safe-banner-text").textContent =
                      "🔥 테르밋 폭약 합성 완료! 출구 방화벽에 부착하세요";
                    safeBanner.classList.remove("hidden");
                    setTimeout(() => safeBanner.classList.add("hidden"), 4000);
                  }
                  if (wsClient && wsClient.readyState === WebSocket.OPEN) {
                    try {
                      wsClient.send(JSON.stringify({
                        type: "MISSION_ACTION",
                        slotId: mySlotIndex,
                        roomIdx: curRoom.index,
                        action: "SYNTHESIZE_THERMITE"
                      }));
                    } catch (e) {}
                  }
                }
              } else {
                interactBar.style.width = "0%";
              }
            } else if (nearMissionNode.kind === "GENERATOR") {
              interactTitle.textContent = `⚡ [F 홀드] 발전기 #${nearMissionNode.genIndex || 1} 점화`;
              if (holdingF) {
                nearMissionNode.holdTime += dt;
                interactBar.style.width = Math.min(100, (nearMissionNode.holdTime / 2.5) * 100) + "%";
                if (Math.random() < 0.38) {
                  spawnBloodParticles(nearMissionNode.x, 2.2, nearMissionNode.z, 0x38bdf8, 1);
                }
                if (nearMissionNode.holdTime >= 2.5) {
                  nearMissionNode.done = true;
                  if (nearMissionNode.coreMat) nearMissionNode.coreMat.color.setHex(0x38bdf8);
                  curRoom.progress++;
                  spawnMissionStageVFX(nearMissionNode.x, nearMissionNode.z, 0x38bdf8, 6.8, 20, false);
                  // 발전기 점화 EMP 충격파: 반경 6.5m 내 좀비 2초 감전 스턴!
                  game.zombies.forEach(zmb => {
                    if (Math.hypot(zmb.x - nearMissionNode.x, zmb.z - nearMissionNode.z) <= 6.5) {
                      zmb.stunTimer = Math.max(zmb.stunTimer || 0, 2.0);
                    }
                  });
                  SoundFX.play("upgrade");
                  if (curRoom.progress < curRoom.targetVal) {
                    advanceRoomMissionStage(
                      curRoom,
                      reqStep,
                      `✅ 발전기 #${reqStep} 가동 완료! 다음 웨이브를 막으면 발전기 #${reqStep + 1}이 개방됩니다!`
                    );
                  }
                  checkRoomClear(curRoom);
                  if (wsClient && wsClient.readyState === WebSocket.OPEN) {
                    try {
                      wsClient.send(JSON.stringify({
                        type: "MISSION_ACTION",
                        slotId: mySlotIndex,
                        roomIdx: curRoom.index,
                        action: "IGNITE_GENERATOR",
                        stepOrder: nearMissionNode.stepOrder
                      }));
                    } catch (e) {}
                  }
                }
              } else {
                interactBar.style.width = "0%";
              }
            } else if (nearMissionNode.kind === "BLACKBOX" && !p.carryingPayload) {
              interactTitle.textContent = "📦 [F] 블랙박스 회수 (등 뒤 장착)";
              interactBar.style.width = "100%";
              if (holdingF) {
                p.carryingPayload = true;
                p.currentWeapon = 0;
                nearMissionNode.done = true;
                entitiesGroup.remove(nearMissionNode.mesh);
                spawnMissionStageVFX(nearMissionNode.x, nearMissionNode.z, 0x38bdf8, 4.5, 14, false);
                SoundFX.play("pickup");
                advanceRoomMissionStage(
                  curRoom,
                  1,
                  curRoom.reqWaves >= 3
                    ? "✅ 블랙박스 회수 완료! 다음 웨이브를 방어하면 🔐보안중계기가 출현합니다!"
                    : "✅ 블랙박스 회수 완료! 다음 웨이브를 방어하면 출구 업로드 단말기가 개방됩니다!"
                );
                updateWeaponSlotsHUD();
                if (wsClient && wsClient.readyState === WebSocket.OPEN) {
                  try {
                    wsClient.send(JSON.stringify({
                      type: "MISSION_ACTION",
                      slotId: mySlotIndex,
                      roomIdx: curRoom.index,
                      action: "PICKUP_BLACKBOX"
                    }));
                  } catch (e) {}
                }
              }
            } else if (nearMissionNode.kind === "SECURITY_RELAY") {
              interactTitle.textContent = "🔐 [F 홀드] 보안중계기 암호 해독";
              if (holdingF) {
                nearMissionNode.holdTime = (nearMissionNode.holdTime || 0) + dt;
                interactBar.style.width = Math.min(100, (nearMissionNode.holdTime / 2.2) * 100) + "%";
                if (Math.random() < 0.35) {
                  spawnBloodParticles(nearMissionNode.x, 1.8, nearMissionNode.z, 0x6366f1, 1);
                }
                if (nearMissionNode.holdTime >= 2.2) {
                  nearMissionNode.done = true;
                  entitiesGroup.remove(nearMissionNode.mesh);
                  spawnMissionStageVFX(nearMissionNode.x, nearMissionNode.z, 0x6366f1, 5.8, 18, false);
                  SoundFX.play("upgrade");
                  advanceRoomMissionStage(
                    curRoom,
                    2,
                    "✅ 보안중계기 암호 해독 완료! 다음 웨이브를 방어하면 🛰️업로드 송신기가 출현합니다!"
                  );
                  if (wsClient && wsClient.readyState === WebSocket.OPEN) {
                    try {
                      wsClient.send(JSON.stringify({
                        type: "MISSION_ACTION",
                        slotId: mySlotIndex,
                        roomIdx: curRoom.index,
                        action: "DECRYPT_RELAY"
                      }));
                    } catch (e) {}
                  }
                }
              } else {
                nearMissionNode.holdTime = 0;
                interactBar.style.width = "0%";
              }
            } else if (nearMissionNode.kind === "RADAR_CONSOLE") {
              interactTitle.textContent = "📡 [F 홀드] 통신 배전반 전력 인가";
              if (holdingF) {
                nearMissionNode.holdTime = (nearMissionNode.holdTime || 0) + dt;
                interactBar.style.width = Math.min(100, (nearMissionNode.holdTime / 2.2) * 100) + "%";
                if (Math.random() < 0.35) {
                  spawnBloodParticles(nearMissionNode.x, 1.8, nearMissionNode.z, 0x38bdf8, 1);
                }
                if (nearMissionNode.holdTime >= 2.2) {
                  nearMissionNode.done = true;
                  curRoom.progress = 1;
                  spawnMissionStageVFX(nearMissionNode.x, nearMissionNode.z, 0x38bdf8, 6.0, 18, false);
                  SoundFX.play("upgrade");
                  advanceRoomMissionStage(
                    curRoom,
                    1,
                    "✅ 통신 배전반 가동 완료! 다음 웨이브를 방어하면 🛰️레이더 안테나가 활성화됩니다!"
                  );
                  if (wsClient && wsClient.readyState === WebSocket.OPEN) {
                    try {
                      wsClient.send(JSON.stringify({
                        type: "MISSION_ACTION",
                        slotId: mySlotIndex,
                        roomIdx: curRoom.index,
                        action: "RADAR_STAGE",
                        stepOrder: 1
                      }));
                    } catch (e) {}
                  }
                }
              } else {
                nearMissionNode.holdTime = 0;
                interactBar.style.width = "0%";
              }
            } else if (nearMissionNode.kind === "RADAR_DISH") {
              interactTitle.textContent = "🛰️ [F 홀드] 대형 레이더 안테나 각도 정렬";
              if (holdingF) {
                nearMissionNode.holdTime = (nearMissionNode.holdTime || 0) + dt;
                interactBar.style.width = Math.min(100, (nearMissionNode.holdTime / 2.5) * 100) + "%";
                if (Math.random() < 0.35) {
                  spawnBloodParticles(nearMissionNode.x, 2.2, nearMissionNode.z, 0x06b6d4, 1);
                }
                if (nearMissionNode.holdTime >= 2.5) {
                  nearMissionNode.done = true;
                  curRoom.progress = 2;
                  spawnMissionStageVFX(nearMissionNode.x, nearMissionNode.z, 0x06b6d4, 6.5, 20, false);
                  SoundFX.play("upgrade");
                  advanceRoomMissionStage(
                    curRoom,
                    2,
                    "✅ 레이더 안테나 각도 정렬 완료! 다음 웨이브를 방어하면 📶위성 송신 비콘이 가동됩니다!"
                  );
                  if (wsClient && wsClient.readyState === WebSocket.OPEN) {
                    try {
                      wsClient.send(JSON.stringify({
                        type: "MISSION_ACTION",
                        slotId: mySlotIndex,
                        roomIdx: curRoom.index,
                        action: "RADAR_STAGE",
                        stepOrder: 2
                      }));
                    } catch (e) {}
                  }
                }
              } else {
                nearMissionNode.holdTime = 0;
                interactBar.style.width = "0%";
              }
            } else if (nearMissionNode.kind === "RADAR_BEACON") {
              interactTitle.textContent = "📶 [F 홀드] 고출력 위성 주파수 전송";
              if (holdingF) {
                nearMissionNode.holdTime = (nearMissionNode.holdTime || 0) + dt;
                interactBar.style.width = Math.min(100, (nearMissionNode.holdTime / 3.0) * 100) + "%";
                if (Math.random() < 0.4) {
                  spawnBloodParticles(nearMissionNode.x, 2.5, nearMissionNode.z, 0x3b82f6, 1);
                }
                if (nearMissionNode.holdTime >= 3.0) {
                  nearMissionNode.done = true;
                  curRoom.progress = 3;
                  spawnMissionStageVFX(nearMissionNode.x, nearMissionNode.z, 0x3b82f6, 9.0, 26, true);
                  // 강력한 고주파 EMP 방출: 반경 12m 내 좀비 3.5초 감전 마비!
                  game.zombies.forEach(z => {
                    if (Math.hypot(z.x - nearMissionNode.x, z.z - nearMissionNode.z) <= 12.0) {
                      z.stunTimer = Math.max(z.stunTimer || 0, 3.5);
                    }
                  });
                  SoundFX.play("upgrade");
                  checkRoomClear(curRoom);
                  if (wsClient && wsClient.readyState === WebSocket.OPEN) {
                    try {
                      wsClient.send(JSON.stringify({
                        type: "MISSION_ACTION",
                        slotId: mySlotIndex,
                        roomIdx: curRoom.index,
                        action: "RADAR_STAGE",
                        stepOrder: 3
                      }));
                    } catch (e) {}
                  }
                }
              } else {
                nearMissionNode.holdTime = 0;
                interactBar.style.width = "0%";
              }
            } else if (nearMissionNode.kind === "DECON_VALVE") {
              interactTitle.textContent = `☣️ [F 홀드] 오염 에어로졸 밸브 #${nearMissionNode.stepOrder || 1} 폐쇄`;
              if (holdingF) {
                nearMissionNode.holdTime = (nearMissionNode.holdTime || 0) + dt;
                interactBar.style.width = Math.min(100, (nearMissionNode.holdTime / 2.0) * 100) + "%";
                if (Math.random() < 0.35) {
                  spawnBloodParticles(nearMissionNode.x, 2.0, nearMissionNode.z, 0x10b981, 1);
                }
                if (nearMissionNode.holdTime >= 2.0) {
                  nearMissionNode.done = true;
                  curRoom.progress++;
                  game.bioPoints += 500;
                  spawnMissionStageVFX(nearMissionNode.x, nearMissionNode.z, 0x10b981, 6.5, 18, false);
                  SoundFX.play("upgrade");
                  if (curRoom.progress < curRoom.targetVal) {
                    advanceRoomMissionStage(
                      curRoom,
                      reqStep,
                      `✅ 오염 밸브 #${reqStep} 차단 완료 (+500 BP)! 다음 웨이브를 방어하면 밸브 #${reqStep + 1}이 개방됩니다!`
                    );
                  }
                  checkRoomClear(curRoom);
                  if (wsClient && wsClient.readyState === WebSocket.OPEN) {
                    try {
                      wsClient.send(JSON.stringify({
                        type: "MISSION_ACTION",
                        slotId: mySlotIndex,
                        roomIdx: curRoom.index,
                        action: "DECON_VALVE",
                        stepOrder: nearMissionNode.stepOrder
                      }));
                    } catch (e) {}
                  }
                }
              } else {
                nearMissionNode.holdTime = 0;
                interactBar.style.width = "0%";
              }
            } else if (nearMissionNode.kind === "SURVIVAL_CONSOLE") {
              if (curRoom.holdoutActive) {
                interactTitle.textContent = `⏱️ 방호 보안 락다운 진행 중 (생존 유지!)`;
              } else {
                interactTitle.textContent = `⏱️ [F 홀드] 방호 보안 콘솔 가동 (180초 결사 생존)`;
                if (holdingF) {
                  nearMissionNode.holdTime = (nearMissionNode.holdTime || 0) + dt;
                  interactBar.style.width = Math.min(100, (nearMissionNode.holdTime / 1.5) * 100) + "%";
                  if (nearMissionNode.holdTime >= 1.5) {
                    curRoom.holdoutActive = true;
                    nearMissionNode.done = true;
                    if (nearMissionNode.sym && nearMissionNode.sym.el) nearMissionNode.sym.el.style.display = "none";
                    if (nearMissionNode.beaconMesh) nearMissionNode.beaconMesh.visible = false;
                    SoundFX.play("alarm");
                    spawnMissionStageVFX(nearMissionNode.x, nearMissionNode.z, 0xef4444, 8.0, 24, true);
                    showToastNotification("🚨 방호 보안 락다운 발동! 시스템 무력화까지 180초 결사 생존하라!");
                  }
                } else {
                  nearMissionNode.holdTime = 0;
                  interactBar.style.width = "0%";
                }
              }
            } else if (nearMissionNode.kind === "DEFENSE_GENERATOR") {
              if (curRoom.defenseActive) {
                interactTitle.textContent = `⚡ 코어 반응로 가동 중 (체력 사수!)`;
              } else {
                interactTitle.textContent = `⚡ [F 홀드] 코어 반응로 가동 (150초 수호)`;
                if (holdingF) {
                  nearMissionNode.holdTime = (nearMissionNode.holdTime || 0) + dt;
                  interactBar.style.width = Math.min(100, (nearMissionNode.holdTime / 1.5) * 100) + "%";
                  if (nearMissionNode.holdTime >= 1.5) {
                    curRoom.defenseActive = true;
                    nearMissionNode.holdTime = 0;
                    if (nearMissionNode.sym && nearMissionNode.sym.el) nearMissionNode.sym.el.style.display = "none";
                    if (nearMissionNode.beaconMesh) nearMissionNode.beaconMesh.visible = false;
                    SoundFX.play("upgrade");
                    spawnMissionStageVFX(nearMissionNode.x, nearMissionNode.z, 0x38bdf8, 8.0, 24, true);
                    showToastNotification("⚡ 코어 반응로 가동 시작! 150초 동안 파괴되지 않도록 사수하라!");
                  }
                } else {
                  nearMissionNode.holdTime = 0;
                  interactBar.style.width = "0%";
                }
              }
            }
    }

    function handleLocalPlayerInteraction(p, curRoom, dt, unlockStg, interactTitle, interactDesc, interactBar) {
      let showPrompt = false;
          const holdingF = !!(keys["KeyF"] || touchInteractF);

          let reviveTarget = null;
          let healAllyTarget = null;
          if (!p.downed) {
            reviveTarget = game.players.find(other =>
              other.id !== p.id && other.downed && Math.hypot(other.x - p.x, other.z - p.z) < 3.0
            );
            if (!reviveTarget && p.medkits > 0) {
              healAllyTarget = game.players.find(other =>
                other.id !== p.id && !other.downed && other.hp < 85 && Math.hypot(other.x - p.x, other.z - p.z) < 2.8
              );
            }
          }

          const nearMissionNode = (!p.downed && curRoom) ? game.missionNodes.find(n =>
            n.roomIndex === curRoom.index && n.kind !== "UPLOAD_TERMINAL" && !n.done && Math.hypot(n.x - p.x, n.z - p.z) < 3.8
          ) : null;

          const nextDoor = game.doors.find(d => d.fromRoom === game.currentRoomIndex && !d.open);
          const nearThermiteDoor = (!p.downed && curRoom && curRoom.condType === "THERMITE" &&
            curRoom.subStage === 1 && nextDoor && Math.hypot(nextDoor.x - p.x, nextDoor.z - p.z) < 5.6);

          const uploadTerm = (!p.downed && curRoom && curRoom.condType === "PAYLOAD")
            ? game.missionNodes.find(n => n.roomIndex === curRoom.index && n.kind === "UPLOAD_TERMINAL" && !n.done)
            : null;
          const nearPayloadExit = (!p.downed && curRoom && curRoom.condType === "PAYLOAD" &&
            p.carryingPayload && (
              (uploadTerm && Math.hypot(uploadTerm.x - p.x, uploadTerm.z - p.z) < 4.2) ||
              (!uploadTerm && curRoom.completedStage >= (curRoom.reqWaves - 1) && nextDoor && Math.hypot(nextDoor.x - p.x, nextDoor.z - p.z) < 5.0)
            ));

          const nearVault = (!p.downed) ? game.armoryVaults.find(v =>
            (v.activeInCalm || (curRoom && curRoom.isBossRoom)) && Math.hypot(v.x - p.x, v.z - p.z) < 5.2
          ) : null;

          const nearDecon = (!p.downed) ? game.deconStations.find(ds =>
            ds.charges > 0 && Math.hypot(ds.x - p.x, ds.z - p.z) < 3.4
          ) : null;

          p.revivingTargetId = null;
          if (reviveTarget) {
            showPrompt = true;
            interactTitle.textContent = `🚑 [F] ${reviveTarget.name} 구출`;
            interactDesc.textContent = `[F] ${game.reviveDuration}초 유지`;
            if (holdingF) {
              reviveTarget.reviveProgress += dt;
              p.revivingTargetId = reviveTarget.id;
              interactBar.style.width = Math.min(100, (reviveTarget.reviveProgress / game.reviveDuration) * 100) + "%";
              if (reviveTarget.reviveProgress >= game.reviveDuration) {
                completeRevive(reviveTarget);
                p.revivingTargetId = null;
                if (wsClient && wsClient.readyState === WebSocket.OPEN) {
                  try { wsClient.send(JSON.stringify({ type: "REVIVE_SYNC", targetId: reviveTarget.id })); } catch (e) {}
                }
              }
            } else {
              interactBar.style.width = ((reviveTarget.reviveProgress / game.reviveDuration) * 100) + "%";
            }
          } else if (healAllyTarget) {
            showPrompt = true;
            const allyHealDur = getPlayerAllyHealDuration(p);
            const hasSyr = isPlayerSyringeUpgraded(p);
            interactTitle.textContent = `${hasSyr ? "💉 [F] 나노주사기" : "🩹 [F] 구급키트"} ${healAllyTarget.name} 치료 (${allyHealDur.toFixed(1)}s)`;
            if (holdingF) {
              healAllyTarget.reviveProgress = (healAllyTarget.reviveProgress || 0) + dt;
              interactBar.style.width = Math.min(100, (healAllyTarget.reviveProgress / allyHealDur) * 100) + "%";
              if (healAllyTarget.reviveProgress >= allyHealDur) {
                p.medkits--;
                healAllyTarget.hp = Math.min(healAllyTarget.maxHp, healAllyTarget.hp + 85);
                healAllyTarget.bleedingTimer = 0;
                if (hasSyr) healAllyTarget.acidTimer = 0;
                p.hp = Math.min(p.maxHp, p.hp + 25);
                healAllyTarget.reviveProgress = 0;
                SoundFX.play("revive");
              }
            } else {
              healAllyTarget.reviveProgress = 0;
              interactBar.style.width = "0%";
            }
          } else if (nearMissionNode) {
            showPrompt = true;
            handleMissionNodeInteraction(p, curRoom, nearMissionNode, holdingF, dt, unlockStg, interactTitle, interactDesc, interactBar);
          } else if (nearThermiteDoor) {
            showPrompt = true;
            interactTitle.textContent = "🧨 [F 홀드] 방화벽에 테르밋 폭약 부착";
            if (holdingF) {
              curRoom.thermiteAttachHold = (curRoom.thermiteAttachHold || 0) + dt;
              interactBar.style.width = Math.min(100, (curRoom.thermiteAttachHold / 1.4) * 100) + "%";
              if (Math.random() < 0.45 && nextDoor) {
                spawnBloodParticles(nextDoor.x, 1.8, nextDoor.z, 0xf97316, 1);
              }
              if (curRoom.thermiteAttachHold >= 1.4) {
                curRoom.subStage = 2;
                curRoom.lastSubStageChangeTime = Date.now();
                if (nextDoor) {
                  ensureThermiteDoorVisuals(curRoom, nextDoor);
                  spawnMissionStageVFX(nextDoor.x, nextDoor.z, 0xf97316, 5.0, 16, false);
                }
                SoundFX.play("alarm");
                const safeBanner = document.getElementById("hud-safe-banner");
                if (safeBanner) {
                  document.getElementById("hud-safe-banner-text").textContent =
                    "🧨 테르밋 설치 완료! 바닥 위험구역 밖으로 대피하세요";
                  safeBanner.classList.remove("hidden");
                  setTimeout(() => safeBanner.classList.add("hidden"), 4200);
                }
                if (wsClient && wsClient.readyState === WebSocket.OPEN) {
                  try {
                    wsClient.send(JSON.stringify({
                      type: "MISSION_ACTION",
                      slotId: mySlotIndex,
                      roomIdx: curRoom.index,
                      action: "ATTACH_THERMITE"
                    }));
                  } catch (e) {}
                }
              }
            } else {
              curRoom.thermiteAttachHold = 0;
              interactBar.style.width = "0%";
            }
          } else if (nearPayloadExit) {
            showPrompt = true;
            if (unlockStg < 2) {
              interactTitle.textContent = `🔒 현재 웨이브를 방어해야 업로드 송신기가 출현합니다!`;
              interactBar.style.width = "0%";
            } else {
              interactTitle.textContent = "🛰️ [F 홀드] 블랙박스 위성 데이터 업로드";
              if (holdingF) {
                curRoom.payloadUploadHold = (curRoom.payloadUploadHold || 0) + dt;
                interactBar.style.width = Math.min(100, (curRoom.payloadUploadHold / 1.5) * 100) + "%";
                if (uploadTerm && Math.random() < 0.4) {
                  spawnBloodParticles(uploadTerm.x, 2.2, uploadTerm.z, 0x38bdf8, 1);
                }
                if (curRoom.payloadUploadHold >= 1.5) {
                  p.carryingPayload = false;
                  const upX = uploadTerm ? uploadTerm.x : p.x;
                  const upZ = uploadTerm ? uploadTerm.z : p.z;
                  if (uploadTerm) {
                    uploadTerm.done = true;
                    entitiesGroup.remove(uploadTerm.mesh);
                  }
                  spawnMissionStageVFX(upX, upZ, 0x38bdf8, 7.5, 24, true);
                  curRoom.progress = 1;
                  curRoom.completedStage = 2;
                  checkRoomClear(curRoom);
                  if (wsClient && wsClient.readyState === WebSocket.OPEN) {
                    try {
                      wsClient.send(JSON.stringify({
                        type: "MISSION_ACTION",
                        slotId: mySlotIndex,
                        roomIdx: curRoom.index,
                        action: "UPLOAD_PAYLOAD"
                      }));
                    } catch (e) {}
                  }
                }
              } else {
                curRoom.payloadUploadHold = 0;
                interactBar.style.width = "0%";
              }
            }
          } else if (nearVault) {
            showPrompt = true;
            if (!nearVault.unlocked) {
              interactTitle.textContent = "🔐 [F] 무기고 잠금해제 (신규무기+정비소 개방)";
              if (holdingF) {
                nearVault.timer = (nearVault.timer || 2.0) - dt;
                interactBar.style.width = Math.min(100, ((2.0 - nearVault.timer) / 2.0) * 100) + "%";
                if (nearVault.timer <= 0) {
                  nearVault.unlocked = true;
                  if (nearVault.zoneRing) nearVault.zoneRing.material.color.setHex(0x10b981);
                  if (nearVault.sym) nearVault.sym.el.textContent = "🔧무기고·강화소[T/F]";
                  grantSupplyReward(p, true);
                  game.weaponParts++;
                  SoundFX.play("upgrade");
                  renderUpgradeModal();
                  document.getElementById("upgrade-modal").classList.remove("hidden");
                }
              } else {
                nearVault.timer = 2.0;
                interactBar.style.width = "0%";
              }
            } else {
              interactTitle.textContent = "🛠️ [F] 전진 무기고 정비 단말기 열기";
              interactBar.style.width = "100%";
              if (holdingF) {
                if (!p.fArmoryHeld) {
                  p.fArmoryHeld = true;
                  toggleUpgradeModal();
                }
              } else {
                p.fArmoryHeld = false;
              }
            }
          } else if (nearDecon) {
            showPrompt = true;
            interactTitle.textContent = `🏥 [F] 치료소(${nearDecon.charges})`;
            interactBar.style.width = "100%";
            if (holdingF) {
              if (!p.fDeconHeld) {
                p.fDeconHeld = true;
                nearDecon.charges--;
                p.hp = Math.min(p.maxHp, p.hp + 55);
                p.bleedingTimer = 0;
                p.acidTimer = 0;
                p.medkits = Math.min(getPlayerMaxMedkits(p), p.medkits + 1);
                if (nearDecon.charges <= 0) entitiesGroup.remove(nearDecon.mesh);
                SoundFX.play("revive");
              }
            } else {
              p.fDeconHeld = false;
            }
          } else {
            p.fDeconHeld = false;
            p.revivingTargetId = null;
          }
      return showPrompt;
    }

    function updateLocalPlayerMovementAndAim(p, dt) {
          // [Shift 질주 & 스태미너 시스템]
          const maxStam = getPlayerMaxStamina(p);
          const regenStam = getPlayerStaminaRegen(p);
          p.maxStamina = maxStam;
          if (p.stamina === undefined) p.stamina = maxStam;
          p.staminaExhaustTimer = Math.max(0, (p.staminaExhaustTimer || 0) - dt);

          if (p.dashActiveTimer > 0) {
            p.isSprinting = false;
            const leapSpd = 22.0 * (p.specialization === "SCOUT" ? 1.25 : 1.0); // 척후병 점프 도약 비거리 +25%
            moveEntityWithCollision(p, p.dashDirX * leapSpd * dt, p.dashDirZ * leapSpd * dt, 0.55, true);
          } else if (p.revivingTargetId === null) {
            let mx = 0, mz = 0;
            if (keys["KeyW"] || touchMove.w) mz -= 1;
            if (keys["KeyS"] || touchMove.s) mz += 1;
            if (keys["KeyA"] || touchMove.a) mx -= 1;
            if (keys["KeyD"] || touchMove.d) mx += 1;

            const isMoving = (mx !== 0 || mz !== 0);
            const holdingShift = !!(keys["ShiftLeft"] || keys["ShiftRight"] || window.touchSprintShift);
            const scoutRegenMult = (p.specialization === "SCOUT") ? 1.50 : 1.0; // 척후병 스태미너 회복속도 +50%
            if (!p.downed && isMoving && holdingShift && (p.stamina > 0 || p.stimBuffTimer > 0) && (p.staminaExhaustTimer || 0) <= 0) {
              p.isSprinting = true;
              if (p.stimBuffTimer <= 0) {
                p.stamina = Math.max(0, p.stamina - 28 * dt);
                if (p.stamina <= 0) {
                  p.staminaExhaustTimer = 1.1;
                }
              }
            } else {
              p.isSprinting = false;
              p.stamina = Math.min(maxStam, p.stamina + regenStam * scoutRegenMult * dt);
            }

            let moveSpeed = p.downed ? 2.5 : 9.2;
            if (p.specialization === "SCOUT") moveSpeed *= 1.15; // 척후병 기본 이동속도 +15%
            if (p.cloakActive) moveSpeed *= 1.20; // 척후병 은신 가동 중 이동속도 +20%
            const bootsBonus = (typeof getPlayerMoveSpeedBonus === "function") ? getPlayerMoveSpeedBonus(p) : 0;
            if (bootsBonus > 0) moveSpeed *= (1 + bootsBonus); // [기동 전술화 강화] 이동 및 질주 속도 보너스
            // 나노 주사기 개조 시에는 자가 치료 중에도 이동속도 감속이 전혀 없음!
            if (p.bandagingTimer > 0 && !isPlayerSyringeUpgraded(p)) moveSpeed *= 0.42;
            if (p.carryingPayload) moveSpeed *= 0.78;
            if (p.stimBuffTimer > 0) {
              moveSpeed *= 1.25;
            } else {
              if (p.acidTimer > 0) moveSpeed *= 0.72;
              if (p.shockTimer > 0) moveSpeed *= 0.55;
              if (p.frostTimer > 0) moveSpeed *= 0.65;
            }
            if (p.currentWeapon === 2 && !p.downed && !p.carryingPayload) moveSpeed *= 1.16; // [v3.3 UZI CQC 런앤건 기동 특화 +16%]
            if (p.isSprinting) moveSpeed *= 1.42;

            if (isMoving) {
              const mLen = Math.hypot(mx, mz);
              moveEntityWithCollision(p, (mx / mLen) * moveSpeed * dt, (mz / mLen) * moveSpeed * dt, 0.55);
              p.rotY = Math.atan2(mx, mz);
              p.walkCycle += dt * (p.isSprinting ? 17 : 12);

              // [선봉장 패시브] 일반 감염체 몸싸움 밀치기 돌파 (포위 갇힘 방지)
              if (p.specialization === "JUGGERNAUT") {
                game.zombies.forEach(z => {
                  if (!z.spec.isMidBoss && !z.spec.isGoliath) {
                    const zdx = z.x - p.x;
                    const zdz = z.z - p.z;
                    const zDist = Math.hypot(zdx, zdz);
                    if (zDist < 1.05 && zDist > 0.01) {
                      z.x += (zdx / zDist) * 1.5;
                      z.z += (zdz / zDist) * 1.5;
                    }
                  }
                });
              }
            }
          } else {
            p.isSprinting = false;
            const scoutRegenMult = (p.specialization === "SCOUT") ? 1.50 : 1.0;
            p.stamina = Math.min(maxStam, p.stamina + regenStam * scoutRegenMult * dt);
          }

          if (p.revivingTargetId === null && (p.bandagingTimer <= 0 || isPlayerSyringeUpgraded(p))) {
            let ax = 0, az = 0;
            if (keys["ArrowUp"] || touchAim.u) az -= 1;
            if (keys["ArrowDown"] || touchAim.d) az += 1;
            if (keys["ArrowLeft"] || touchAim.l) ax -= 1;
            if (keys["ArrowRight"] || touchAim.r) ax += 1;

            if (ax !== 0 || az !== 0) {
              p.rotY = Math.atan2(ax, az);
              if (p.fireCooldown <= 0) fireWeapon(p, ax, az);
            } else if (userSettings.mouseAim && mouseState.active && updateMouseWorldAim()) {
              const mdx = mouseState.worldX - p.x;
              const mdz = mouseState.worldZ - p.z;
              if (Math.hypot(mdx, mdz) > 0.25) {
                p.rotY = Math.atan2(mdx, mdz);
                if (mouseState.down && p.fireCooldown <= 0) {
                  fireWeapon(p, mdx, mdz);
                }
              }
            }
          }
    }

    function updateRemotePlayerInterpolation(p, dt) {
          // [v3.5 멀티플레이 실시간 보간] 원격 팀원의 위치와 회전각을 60FPS로 극도로 부드럽게 보간(Lerp)
          if (p.netTargetX !== undefined && p.netTargetZ !== undefined) {
            const dist = Math.hypot(p.netTargetX - p.x, p.netTargetZ - p.z);
            if (dist > 8.0) {
              p.x = p.netTargetX;
              p.z = p.netTargetZ;
            } else {
              const lerpSpd = Math.min(1.0, dt * 24);
              p.x += (p.netTargetX - p.x) * lerpSpd;
              p.z += (p.netTargetZ - p.z) * lerpSpd;
            }
          }
          if (p.netTargetRotY !== undefined) {
            let diffRot = p.netTargetRotY - p.rotY;
            while (diffRot < -Math.PI) diffRot += Math.PI * 2;
            while (diffRot > Math.PI) diffRot -= Math.PI * 2;
            p.rotY += diffRot * Math.min(1.0, dt * 24);
          }
    }

    function updatePlayersAndInteractions(dt) {
      const me = game.players[mySlotIndex];
      const interactPrompt = document.getElementById("hud-interact-prompt");
      const interactTitle = document.getElementById("hud-interact-title");
      const interactDesc = document.getElementById("hud-interact-desc");
      const interactBar = document.getElementById("hud-interact-bar");
      const downedBanner = document.getElementById("hud-downed-banner");
      const healBox = document.getElementById("hud-heal-progress-box");
      const healTitle = document.getElementById("hud-heal-title");
      const healBar = document.getElementById("hud-heal-bar");

      if (me) {
        downedBanner.classList.toggle("hidden", !me.downed);
        if (me.bandagingTimer > 0) {
          const maxDur = me.bandagingMaxTimer || getPlayerSelfHealDuration(me);
          if (healTitle) {
            healTitle.textContent = isPlayerSyringeUpgraded(me)
              ? "💉 나노 의료 주사기 고속 투여 중... (무감속)"
              : "🩹 응급 붕대 치료 중...";
          }
          healBox.classList.remove("hidden");
          healBar.style.width = Math.min(100, Math.max(0, (1 - me.bandagingTimer / maxDur) * 100)) + "%";
        } else {
          healBox.classList.add("hidden");
        }
      }

      // [v3.1 소생 진행도 거리 무관 자동 감쇄]
      // 다른 생존 플레이어가 현재 [F]를 누르고 있지 않은 모든 빈사 플레이어의 소생 게이지는 거리에 관계없이 지속 감쇄 (0%까지)
      game.players.forEach(pl => {
        if (pl.downed && (pl.reviveProgress || 0) > 0) {
          const isBeingRevived = game.players.some(reviver => !reviver.downed && reviver.revivingTargetId === pl.id);
          if (!isBeingRevived) {
            pl.reviveProgress = Math.max(0, pl.reviveProgress - dt * 1.5);
          }
        }
      });

      let showPrompt = false;
      const curRoom = game.rooms[game.currentRoomIndex];
      const unlockStg = curRoom ? (curRoom.unlockStage || 0) : 0;

      game.players.forEach(p => {
        p.fireCooldown = Math.max(0, p.fireCooldown - dt);

        if (p.id === mySlotIndex) {
          if (handleLocalPlayerInteraction(p, curRoom, dt, unlockStg, interactTitle, interactDesc, interactBar)) {
            showPrompt = true;
          }
          updateLocalPlayerMovementAndAim(p, dt);
        } else if (p.role === "REMOTE") {
          updateRemotePlayerInterpolation(p, dt);
        }

        const jumpY = p.dashActiveTimer > 0 ? Math.sin((p.dashActiveTimer / 0.34) * Math.PI) * 1.55 : 0;
        p.visual.group.position.set(p.x, jumpY, p.z);
        p.visual.group.rotation.y = p.rotY;
        if (!p.downed) {
          p.visual.leftLeg.rotation.x = Math.sin(p.walkCycle) * 0.5;
          p.visual.rightLeg.rotation.x = -Math.sin(p.walkCycle) * 0.5;
        }
        updateFloatingLabel(p);
      });

      if (interactPrompt) interactPrompt.classList.toggle("hidden", !showPrompt);
      updateWorldSymbolBadges();
    }

    function updateWorldSymbolBadges() {
      if (!game.worldSymbols) return;
      const me = game.players[mySlotIndex] || game.players[0];
      const curRoom = game.rooms[game.currentRoomIndex];
      const unlockStg = curRoom ? (curRoom.unlockStage || 0) : 0;

      game.worldSymbols.forEach(sym => {
        if (!userSettings.showWorldBadges) {
          sym.el.style.display = "none";
          return;
        }
        const ref = sym.refObj;
        const isGone = !ref || ref.done || ref.opened ||
          (ref.openedBy && ref.openedBy[mySlotIndex]) ||
          (ref.charges !== undefined && ref.charges <= 0) ||
          (ref.hp !== undefined && ref.hp <= 0) ||
          (ref.active !== undefined && !ref.active) ||
          (ref.activeInCalm !== undefined && !ref.activeInCalm && !(curRoom && curRoom.isBossRoom)) ||
          ((ref.isPickup || ref.kind === "CORE" || ref.kind === "PART" || ref.kind === "AMMO_PACK") && !game.pickups.includes(ref));

        if (isGone || (sym.roomIndex !== game.currentRoomIndex && !ref.isPickup && ref.kind !== "CORE" && ref.kind !== "PART" && ref.kind !== "AMMO_PACK")) {
          sym.el.style.display = "none";
          if (isGone && sym.el && sym.el.parentNode) {
            sym.el.remove();
          }
          return;
        }
        const isMissionObj = ref && (ref.stepOrder !== undefined || ref.kind === "GENERATOR" || ref.kind === "CHEM_PART" || ref.kind === "SYNTH_TABLE" || ref.kind === "DECON_VALVE" || ref.kind === "RADAR_CONSOLE" || ref.kind === "RADAR_DISH" || ref.kind === "RADAR_BEACON" || ref.kind === "BULKHEAD_CONSOLE" || ref.kind === "BOSS_MASTER_CONSOLE" || ref.kind === "BOSS_COOLANT" || ref.kind === "BLACKBOX" || ref.kind === "SECURITY_RELAY" || ref.kind === "UPLOAD_TERMINAL" || ref.kind === "SURVIVAL_CONSOLE" || ref.kind === "DEFENSE_GENERATOR");
        const maxDist = isMissionObj ? 180 : 44;
        if (me && Math.hypot(sym.x - me.x, sym.z - me.z) > maxDist) {
          sym.el.style.display = "none";
          return;
        }

        if (ref.stepOrder && ref.stepOrder > 0) {
          if (!sym.baseText) sym.baseText = sym.el.textContent;
          if (unlockStg < ref.stepOrder) {
            sym.el.textContent = `🔒${ref.stepOrder}단계(웨이브방어후해금)`;
          } else {
            sym.el.textContent = sym.baseText;
          }
        }

        const vec = new THREE.Vector3(sym.x, sym.y, sym.z);
        vec.project(camera);
        if (vec.z > 1) {
          sym.el.style.display = "none";
          return;
        }
        sym.el.style.display = "block";
        sym.el.style.left = ((vec.x * 0.5 + 0.5) * window.innerWidth) + "px";
        sym.el.style.top = ((-vec.y * 0.5 + 0.5) * window.innerHeight) + "px";
      });
    }

    function completeRevive(targetPlayer) {
      targetPlayer.downed = false;
      targetPlayer.hp = 60;
      targetPlayer.reviveProgress = 0;
      if (targetPlayer.wasCarryingPayload) {
        targetPlayer.carryingPayload = true;
        targetPlayer.wasCarryingPayload = false;
      }
      targetPlayer.visual.body.rotation.x = 0;
      targetPlayer.visual.body.position.y = 1.1;
      targetPlayer.visual.head.position.set(0, 2.02, 0);
      targetPlayer.visual.ringMat.opacity = 0.0;
      game.totalRevives++;
      SoundFX.play("revive");
      if (targetPlayer.id === mySlotIndex) {
        document.getElementById("damage-vignette").style.opacity = "0";
        updateWeaponSlotsHUD();
      }
    }

    function updateFloatingLabel(player) {
      if (userSettings.nicknameMode === "none" && !player.downed) {
        player.labelEl.style.display = "none";
        return;
      }
      if (userSettings.nicknameMode === "me" && player.id !== mySlotIndex && !player.downed) {
        player.labelEl.style.display = "none";
        return;
      }

      const vec = new THREE.Vector3(player.x, 2.85, player.z);
      vec.project(camera);
      if (vec.z > 1) {
        player.labelEl.style.display = "none";
        return;
      }
      player.labelEl.style.display = "block";
      player.labelEl.style.left = ((vec.x * 0.5 + 0.5) * window.innerWidth) + "px";
      player.labelEl.style.top = ((-vec.y * 0.5 + 0.5) * window.innerHeight) + "px";

      const nickEl = player.labelEl.querySelector(".char-nickname");
      if (nickEl) {
        nickEl.textContent = player.name;
        nickEl.style.display = (userSettings.nicknameMode === "none") ? "none" : "block";
      }

      const hpBar = player.labelEl.querySelector(".char-mini-hp");
      const hpPct = Math.max(0, (player.hp / player.maxHp) * 100);
      if (hpBar) {
        hpBar.style.width = hpPct + "%";
        hpBar.className = `char-mini-hp h-full transition-all duration-75 ${
          hpPct <= 30 ? "bg-red-500" : hpPct <= 60 ? "bg-amber-400" : "bg-emerald-400"
        }`;
      }

      if (player.id === mySlotIndex) {
        const tempBar = player.labelEl.querySelector(".char-mini-temp");
        const dashDot = player.labelEl.querySelector(".char-dot-dash");
        const bashDot = player.labelEl.querySelector(".char-dot-bash");
        if (tempBar) {
          tempBar.style.width = Math.min(40, (player.tempHp / player.maxHp) * 100) + "%";
        }
        if (dashDot) {
          dashDot.className = `char-dot-dash w-1.5 h-1.5 rounded-full ${
            player.dashCooldown <= 0 ? "bg-cyan-400" : "bg-slate-700"
          }`;
        }
        if (bashDot) {
          bashDot.className = `char-dot-bash w-1.5 h-1.5 rounded-full ${
            (player.bashCooldown || 0) <= 0 ? "bg-rose-400" : "bg-slate-700"
          }`;
        }
      } else {
        const revBadge = player.labelEl.querySelector(".revive-badge");
        if (revBadge) {
          if (player.downed) {
            revBadge.classList.remove("hidden");
            const pct = Math.round((player.reviveProgress / game.reviveDuration) * 100);
            revBadge.textContent = pct > 0 ? `🚑 ${pct}%` : `🚑 [F] 구출`;
          } else {
            revBadge.classList.add("hidden");
          }
        }
      }
    }
