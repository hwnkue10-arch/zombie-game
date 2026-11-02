/**
 * =========================================================================
 * BOXHEAD: THE CORE v3.6 — Frontend Module: 08b_net_snapshot_sync.js
 * Authoritative World Snapshot Sync, Entity Interpolation & 33Hz/20Hz Broadcasters
 * Zero-Loss Refactored Architecture (Shared Global Lexical Scope)
 * =========================================================================
 */
"use strict";

    // =========================================================================
    // 19B. AUTHORITATIVE WORLD SNAPSHOT RECEIVER & 33Hz/20Hz BROADCASTERS
    // =========================================================================
    function applyAuthoritativeWorldSnapshot(msg) {
              // 호스트(P1) 권위 월드·좀비·웨이브·미션·격벽(Door) 스냅샷 동기화 -> 친구가 다음 섹터로 이동할 때 벽에 막히는 버그 100% 해결!
              game.wavePhase = msg.wavePhase || game.wavePhase;
              game.waveTimer = msg.waveTimer !== undefined ? msg.waveTimer : game.waveTimer;

              let needVisUpdate = false;
              if (Array.isArray(msg.roomsState)) {
                msg.roomsState.forEach((rs, rIdx) => {
                  const r = game.rooms[rIdx];
                  if (!r) return;
                  const u = !!rs[0];
                  const c = !!rs[1];
                  const lb = !!rs[2];
                  if (r.unlocked !== u || r.cleared !== c) needVisUpdate = true;
                  const wasLocked = r.lockedBehind;
                  r.unlocked = u;
                  r.cleared = c;
                  r.lockedBehind = lb;
                  if (!wasLocked && lb) {
                    if (r.bulkheadConsole) {
                      r.bulkheadConsole.done = true;
                      if (r.bulkheadConsole.lever) r.bulkheadConsole.lever.rotation.z = -Math.PI / 4;
                      if (r.bulkheadConsole.sym && r.bulkheadConsole.sym.el) r.bulkheadConsole.sym.el.style.display = "none";
                    }
                  }
                });
              }

              if (Array.isArray(msg.doorsState)) {
                msg.doorsState.forEach((ds, dIdx) => {
                  const d = game.doors[dIdx];
                  if (!d) return;
                  const shouldOpen = !!ds[0];
                  const shouldLock = !!ds[1];
                  if (d.open !== shouldOpen || d.lockedPermanently !== shouldLock) {
                    const wasOpen = d.open;
                    d.open = shouldOpen;
                    d.lockedPermanently = shouldLock;
                    needVisUpdate = true;
                    if (!wasOpen && shouldOpen) {
                      const fRoom = game.rooms[d.fromRoom];
                      if (fRoom && fRoom.condType === "THERMITE") {
                        detonateThermiteDoor(fRoom, d);
                      } else {
                        spawnMissionStageVFX(d.x, d.z, 0x10b981, 6.0, 18, false);
                      }
                    }
                    if (d.mesh && d.lockedPermanently && d.mesh.material) {
                      d.mesh.material.color.setHex(0x991b1b);
                      if (d.mesh.material.emissive) d.mesh.material.emissive.setHex(0x450a0a);
                    }
                  }
                });
              }

              if (msg.roomIdx !== undefined && msg.roomIdx !== game.currentRoomIndex) {
                game.currentRoomIndex = msg.roomIdx;
                if (game.rooms[msg.roomIdx]) game.rooms[msg.roomIdx].unlocked = true;
                // 이전 섹터에서 다음 섹터로 열리는 연결 격벽도 확실히 개방 보장!
                game.doors.forEach(d => {
                  if (d.toRoom <= msg.roomIdx && !d.lockedPermanently) {
                    d.open = true;
                  }
                });
                needVisUpdate = true;
              }

              if (needVisUpdate) {
                updateRoomVisibility();
              }

              const cr = game.rooms[game.currentRoomIndex];
              if (cr && msg.roomState) {
                cr.progress = msg.roomState.progress;
                if (msg.roomState.subStage !== undefined) {
                  // 클라이언트가 테르밋 부착 완료(subStage=2) 후 호스트 스냅샷 왕복 지연(2.5초) 동안 이전 값(1)으로 롤백되는 현상 방지
                  if (cr.subStage === 2 && msg.roomState.subStage < 2 && (Date.now() - (cr.lastSubStageChangeTime || 0)) < 2500) {
                    // 호스트 수신 확인 대기 (클라이언트 상태 2 유지)
                  } else {
                    cr.subStage = msg.roomState.subStage;
                  }
                }
                cr.unlockStage = msg.roomState.unlockStage;
                cr.completedStage = msg.roomState.completedStage;
                cr.waitingForWaveDefense = msg.roomState.waitingForWaveDefense;
                if (msg.roomState.waveZombieQuota !== undefined) cr.waveZombieQuota = msg.roomState.waveZombieQuota;
                if (msg.roomState.waveZombiesSpawned !== undefined) cr.waveZombiesSpawned = msg.roomState.waveZombiesSpawned;
                cr.sectorTimer = msg.roomState.sectorTimer;
                cr.berserkActive = msg.roomState.berserkActive;
                cr.gasWaveActive = msg.roomState.gasWaveActive;
                cr.gasWaveProgress = msg.roomState.gasWaveProgress;
                if (msg.roomState.midBossAwakened !== undefined) cr.midBossAwakened = msg.roomState.midBossAwakened;
                if (msg.roomState.bossPhaseStage !== undefined) cr.bossPhaseStage = msg.roomState.bossPhaseStage;
                if (msg.roomState.thermiteDetonated !== undefined) cr.thermiteDetonated = msg.roomState.thermiteDetonated;
                if (msg.roomState.envCleared !== undefined) cr.envCleared = msg.roomState.envCleared;
                if (msg.roomState.blackoutRestoredTimer !== undefined) cr.blackoutRestoredTimer = msg.roomState.blackoutRestoredTimer;
              }

              if (msg.thermiteParts !== undefined) {
                game.thermiteParts = msg.thermiteParts;
              }

              if (Array.isArray(msg.missionNodes)) {
                msg.missionNodes.forEach(syncMissionNodeFromNetwork);
              }

              if (Array.isArray(msg.roomsGas)) {
                msg.roomsGas.forEach((rg, idx) => {
                  if (game.rooms[idx]) {
                    game.rooms[idx].gasWaveActive = (rg[0] === 1);
                    game.rooms[idx].gasWaveProgress = rg[1];
                  }
                });
              }


              // [v3.5 멀티플레이 안전구역 완벽 동기화] 호스트에서 생성된 모든 안전지대를 클라이언트에서도 동일하게 시각화!
              if (Array.isArray(msg.safeZones) && cr) {
                if (!cr.safeZones) cr.safeZones = [];
                msg.safeZones.forEach(szData => {
                  const existing = cr.safeZones.find(sz => Math.hypot(sz.x - szData[0], sz.z - szData[1]) < 1.0);
                  if (!existing) {
                    if (typeof addRoomSafeZone === "function") {
                      addRoomSafeZone(cr, szData[0], szData[1], szData[2], szData[3]);
                    }
                  }
                });
              }

              // [v3.5 멀티플레이 중간보스 및 50% 실드 증폭핵 동기화]
              if (msg.midBossState && game.midBoss) {
                const mb = game.midBoss;
                mb.hp = msg.midBossState.hp;
                mb.maxHp = msg.midBossState.maxHp;
                mb.mbShieldActive = msg.midBossState.shieldActive;
                mb.mbGroggyTimer = msg.midBossState.groggyTimer;
                mb.mbPhase2Triggered = msg.midBossState.phase2Triggered;
                if (mb.mbShieldMesh && mb.mbShieldMesh.material) {
                  mb.mbShieldMesh.material.opacity = mb.mbShieldActive ? 0.65 : 0.0;
                }
                if (Array.isArray(msg.midBossState.shieldNodes)) {
                  for (let pi = game.cystPods.length - 1; pi >= 0; pi--) {
                    const pod = game.cystPods[pi];
                    if (pod && pod.isMidBossShieldNode) {
                      const stillExists = msg.midBossState.shieldNodes.some(sn => Math.hypot(pod.x - sn[0], pod.z - sn[1]) < 1.0);
                      if (!stillExists) {
                        try { if (pod.mesh) entitiesGroup.remove(pod.mesh); } catch (e) {}
                        if (pod.sym && pod.sym.el) pod.sym.el.remove();
                        game.cystPods.splice(pi, 1);
                      }
                    }
                  }
                  msg.midBossState.shieldNodes.forEach((sn, idx) => {
                    let existing = game.cystPods.find(p => p.isMidBossShieldNode && Math.hypot(p.x - sn[0], p.z - sn[1]) < 1.0);
                    if (!existing) {
                      const pGroup = new THREE.Group();
                      const cMesh = new THREE.Mesh(
                        new THREE.OctahedronGeometry(1.35, 1),
                        new THREE.MeshStandardMaterial({ color: 0x06b6d4, emissive: 0x0891b2, emissiveIntensity: 0.95 })
                      );
                      cMesh.position.y = 1.6;
                      pGroup.add(cMesh);
                      const ringM = new THREE.Mesh(
                        new THREE.TorusGeometry(1.6, 0.16, 8, 20),
                        new THREE.MeshBasicMaterial({ color: 0x22d3ee })
                      );
                      ringM.rotation.x = Math.PI / 2;
                      ringM.position.y = 0.3;
                      pGroup.add(ringM);
                      pGroup.position.set(sn[0], 0, sn[1]);
                      entitiesGroup.add(pGroup);
                      const nodePod = {
                        x: sn[0], z: sn[1],
                        hp: sn[2], maxHp: sn[3],
                        isMissionHive: false,
                        isMidBossShieldNode: true,
                        parentMidBoss: mb,
                        roomIndex: mb.roomIndex,
                        timer: 9999,
                        mesh: pGroup
                      };
                      game.cystPods.push(nodePod);
                      nodePod.sym = registerWorldSymbol(
                        sn[0], 3.2, sn[1],
                        `🔗중간보스증폭핵#${idx + 1}(파괴필수)`,
                        "bg-cyan-950/95 border-cyan-400 text-cyan-200 animate-pulse",
                        nodePod, mb.roomIndex
                      );
                    } else {
                      existing.hp = sn[2];
                      existing.maxHp = sn[3];
                    }
                  });
                }
              }

              // [v3.5 멀티플레이 10섹터 코어 보스 상태 동기화]
              if (msg.bossState && game.boss) {
                game.boss.active = msg.bossState.active;
                game.boss.hp = msg.bossState.hp;
                game.boss.maxHp = msg.bossState.maxHp;
                game.boss.phase = msg.bossState.phase;
                game.boss.invulnState = msg.bossState.invulnState;
                game.boss.shielded = msg.bossState.shielded;
                game.boss.groggyTimer = msg.bossState.groggyTimer;
                game.boss.armorShredTimer = msg.bossState.armorShredTimer;
                game.boss.lastPatternText = msg.bossState.lastPatternText;
                game.boss.dead = msg.bossState.dead;
                if (game.boss.shieldMat) {
                  game.boss.shieldMat.opacity = game.boss.shielded ? 0.85 : 0.0;
                }
              }

              // [v3.5 멀티플레이 핏빛 기둥 및 방어 파일런 동기화]
              if (Array.isArray(msg.bloodPylons)) {
                while (game.bloodPylons.length > msg.bloodPylons.length) {
                  const rem = game.bloodPylons.pop();
                  try { if (rem && rem.mesh) entitiesGroup.remove(rem.mesh); } catch (e) {}
                  if (rem && rem.sym && rem.sym.el) rem.sym.el.remove();
                }
                msg.bloodPylons.forEach((ps, idx) => {
                  let pObj = game.bloodPylons[idx];
                  if (!pObj) {
                    const pMesh = new THREE.Mesh(
                      new THREE.CylinderGeometry(1.2, 1.6, 6.2, 12),
                      new THREE.MeshStandardMaterial({ color: 0xbe123c, emissive: 0x9f1239, emissiveIntensity: 0.9 })
                    );
                    pMesh.position.set(ps[0], 3.1, ps[1]);
                    entitiesGroup.add(pMesh);
                    pObj = { x: ps[0], z: ps[1], hp: ps[2], maxHp: ps[3], mesh: pMesh, isPylon: true };
                    game.bloodPylons.push(pObj);
                    pObj.sym = registerWorldSymbol(
                      ps[0], 4.4, ps[1],
                      `🛡️방어파일런${idx + 1}[집중사격]`,
                      "bg-rose-950/90 border-rose-500 text-rose-200",
                      pObj, game.currentRoomIndex
                    );
                  } else {
                    pObj.hp = ps[2];
                    pObj.maxHp = ps[3];
                  }
                });
              }

              // [v3.5 멀티플레이 군락 증폭기 및 생체 신경절(HIVE_NODES / EXTERMINATE) 미션 오브젝트 완벽 동기화]
              if (Array.isArray(msg.hiveNodes)) {
                for (let pi = game.cystPods.length - 1; pi >= 0; pi--) {
                  const pod = game.cystPods[pi];
                  if (pod && pod.isMissionHive && pod.roomIndex === game.currentRoomIndex) {
                    const stillExists = msg.hiveNodes.some(hn => Math.hypot(pod.x - hn[0], pod.z - hn[1]) < 1.0);
                    if (!stillExists) {
                      try { if (pod.mesh) entitiesGroup.remove(pod.mesh); } catch (e) {}
                      if (pod.sym && pod.sym.el) pod.sym.el.remove();
                      game.cystPods.splice(pi, 1);
                    }
                  }
                }

                msg.hiveNodes.forEach(hn => {
                  let existing = game.cystPods.find(p => p.isMissionHive && Math.hypot(p.x - hn[0], p.z - hn[1]) < 1.0);
                  if (!existing) {
                    const r = game.rooms[hn[5] !== undefined ? hn[5] : game.currentRoomIndex];
                    const isExterm = r && r.condType === "EXTERMINATE";
                    const hGroup = new THREE.Group();
                    const core = new THREE.Mesh(
                      new THREE.DodecahedronGeometry(1.55, 1),
                      new THREE.MeshStandardMaterial({
                        color: isExterm ? 0xf97316 : 0xe11d48,
                        emissive: isExterm ? 0xc2410c : 0x9f1239,
                        emissiveIntensity: 0.8
                      })
                    );
                    core.position.y = 1.6;
                    hGroup.add(core);
                    const bioRing = new THREE.Mesh(
                      new THREE.TorusGeometry(1.8, 0.2, 8, 18),
                      new THREE.MeshBasicMaterial({ color: isExterm ? 0xfacc15 : 0xf43f5e })
                    );
                    bioRing.rotation.x = Math.PI / 2;
                    bioRing.position.y = 0.35;
                    hGroup.add(bioRing);

                    hGroup.position.set(hn[0], 0, hn[1]);
                    entitiesGroup.add(hGroup);
                    const podObj = {
                      x: hn[0], z: hn[1],
                      hp: hn[2],
                      maxHp: hn[3],
                      stepOrder: hn[4],
                      isMissionHive: true,
                      roomIndex: r ? r.index : game.currentRoomIndex,
                      timer: 9999,
                      mesh: hGroup,
                      coreMesh: core,
                      bioRing
                    };
                    game.cystPods.push(podObj);
                    podObj.sym = registerWorldSymbol(
                      hn[0], 3.3, hn[1],
                      isExterm ? `☣️군락증폭기#${hn[4]}(사격파괴)` : `🧬생체신경절#${hn[4]}(사격파괴)`,
                      "bg-rose-950/90 border-rose-400 text-rose-200",
                      podObj, podObj.roomIndex
                    );
                  } else {
                    existing.hp = hn[2];
                    existing.maxHp = hn[3];
                  }
                });
              }

              // [v3.1 멀티플레이 바리케이드 100% 동기화] 호스트의 바리케이드 목록 및 내구도/위치 일치 보장
              if (Array.isArray(msg.barricades)) {
                for (let i = game.barricades.length - 1; i >= 0; i--) {
                  const b = game.barricades[i];
                  const stillExists = msg.barricades.some(nb => Math.hypot(b.x - nb.x, b.z - nb.z) < 1.0);
                  if (!stillExists) {
                    if (b.mesh) entitiesGroup.remove(b.mesh);
                    game.barricades.splice(i, 1);
                  }
                }
                msg.barricades.forEach(nb => {
                  const existing = game.barricades.find(b => Math.hypot(b.x - nb.x, b.z - nb.z) < 1.0);
                  if (existing) {
                    existing.hp = nb.hp;
                    existing.maxHp = nb.maxHp;
                    if (typeof updateBarricadeDamageVisual === "function") {
                      updateBarricadeDamageVisual(existing);
                    }
                  } else {
                    spawnBarricade(nb.x, nb.z, !!nb.hasTurret, null, nb.hw > nb.hd ? 0 : 1, nb.hw > nb.hd ? 1 : 0, false, nb.ownerId);
                  }
                });
              }

              // [v3.5 감염체 360마리 전량 위치·체력·광폭화·동결/스턴 완벽 동기화]
              if (Array.isArray(msg.zombies)) {
                const hostIds = new Set(msg.zombies.map(zs => zs[0]));

                for (let i = game.zombies.length - 1; i >= 0; i--) {
                  const z = game.zombies[i];
                  if (z && z.id !== undefined && !hostIds.has(z.id)) {
                    try {
                      if (z.iceBlock && z.group) z.group.remove(z.iceBlock);
                      if (z.group) entitiesGroup.remove(z.group);
                    } catch (e) {}
                    if (game.midBoss === z) game.midBoss = null;
                    game.zombies.splice(i, 1);
                  }
                }

                const clientMap = new Map();
                game.zombies.forEach(z => { if (z.id !== undefined) clientMap.set(z.id, z); });

                msg.zombies.forEach(zs => {
                  const [zId, typeKey, hx, hz, hrotY, hp, maxHp, enraged, fx] = zs;
                  let zObj = clientMap.get(zId);
                  if (!zObj) {
                    zObj = spawnZombie(typeKey, hx, hz, game.currentRoomIndex);
                    zObj.id = zId;
                    zObj.x = hx;
                    zObj.z = hz;
                    zObj.netTargetX = hx;
                    zObj.netTargetZ = hz;
                    zObj.netTargetRotY = hrotY;
                    if (zObj.group) {
                      zObj.group.position.set(hx, 0, hz);
                      zObj.group.rotation.y = hrotY;
                    }
                    clientMap.set(zId, zObj);
                  } else {
                    zObj.netTargetX = hx;
                    zObj.netTargetZ = hz;
                    zObj.netTargetRotY = hrotY;
                    zObj.hp = hp;
                    zObj.maxHp = maxHp;
                    if (Math.hypot(zObj.x - hx, zObj.z - hz) > 8.0) {
                      zObj.x = hx;
                      zObj.z = hz;
                      if (zObj.group) zObj.group.position.set(hx, 0, hz);
                    }
                  }

                  const enrageLvl = enraged || 0;
                  if (enrageLvl === 2 && !zObj.phase2Enraged && !zObj.spec.isNutrientHost) {
                    zObj.phase2Enraged = true;
                    zObj.berserkEnraged = true;
                    if (zObj.skinMat) {
                      zObj.skinMat.emissive.setHex(0x991b1b);
                      zObj.skinMat.emissiveIntensity = 1.0;
                    }
                    if (zObj.group) zObj.group.scale.set(1.3, 1.3, 1.3);
                  } else if (enrageLvl === 1 && !zObj.berserkEnraged && !zObj.spec.isNutrientHost) {
                    zObj.berserkEnraged = true;
                    if (zObj.skinMat) {
                      zObj.skinMat.emissive.setHex(0xef4444);
                      zObj.skinMat.emissiveIntensity = 0.85;
                    }
                    if (zObj.group) zObj.group.scale.set(1.15, 1.15, 1.15);
                  }

                  const fxState = fx || 0;
                  if (fxState === 1) {
                    if (zObj.iceBlock) zObj.iceBlock.visible = true;
                  } else if (zObj.iceBlock && zObj.iceBlock.visible) {
                    zObj.iceBlock.visible = false;
                  }
                });
              }
    }

    // [v3.5 멀티플레이 고속 실시간 브로드캐스터]
    // 1) 모든 클라이언트: 33Hz(30ms) 고속 주기로 내 캐릭터 좌표·회전·체력·장착무기를 서버로 실시간 전송
    setInterval(() => {
      if (!game.running || !wsClient || wsClient.readyState !== WebSocket.OPEN) return;
      const me = game.players[mySlotIndex];
      if (!me) return;
      try {
        wsClient.send(JSON.stringify({
          type: "PLAYER_STATE",
          slotId: mySlotIndex,
          x: Math.round(me.x * 100) / 100,
          z: Math.round(me.z * 100) / 100,
          rotY: Math.round(me.rotY * 100) / 100,
          hp: Math.round(me.hp),
          tempHp: Math.round(me.tempHp || 0),
          tempShield: Math.round(me.tempShield || 0),
          downed: !!me.downed,
          currentWeapon: me.currentWeapon,
          carryingPayload: !!me.carryingPayload,
          walkCycle: Math.round(me.walkCycle * 10) / 10,
          specialization: me.specialization || null,
          droneUnlocked: !!(me.drone && me.drone.unlocked),
          droneMagnetLv: (me.drone && me.drone.modules && me.drone.modules.magnet) ? (me.drone.modules.magnet.level || 0) : 0,
          droneIntLv: (me.drone && me.drone.modules && me.drone.modules.interceptor) ? (me.drone.modules.interceptor.level || 0) : 0,
          droneMediLv: (me.drone && me.drone.modules && me.drone.modules.medi) ? (me.drone.modules.medi.level || 0) : 0
        }));
      } catch (e) {}
    }, 30);

    // 2) 호스트(P1): 20Hz(50ms) 주기로 월드 상태 및 좀비 ID·위치·각도 스냅샷을 실시간 브로드캐스트
    setInterval(() => {
      if (!game.running || isRemoteClient || !wsClient || wsClient.readyState !== WebSocket.OPEN) return;
      const cr = game.rooms[game.currentRoomIndex];
      try {
        const zSnap = game.zombies.slice(0, 360).map(z => [
          z.id || 0,
          z.typeKey,
          Math.round(z.x * 10) / 10,
          Math.round(z.z * 10) / 10,
          Math.round((z.group ? z.group.rotation.y : 0) * 100) / 100,
          Math.round(z.hp),
          Math.round(z.maxHp),
          z.phase2Enraged ? 2 : (z.berserkEnraged ? 1 : 0),
          (z.freezeTimer > 0) ? 1 : ((z.stunTimer > 0) ? 2 : 0)
        ]);

        const szSnap = (cr && cr.safeZones) ? cr.safeZones.map(sz => [
          Math.round(sz.x * 10) / 10,
          Math.round(sz.z * 10) / 10,
          Math.round(sz.radius * 10) / 10,
          sz.name || "안전구역"
        ]) : [];

        const mbSnap = game.midBoss ? {
          hp: Math.round(game.midBoss.hp),
          maxHp: game.midBoss.maxHp,
          shieldActive: !!game.midBoss.mbShieldActive,
          groggyTimer: Math.round((game.midBoss.mbGroggyTimer || 0) * 10) / 10,
          phase2Triggered: !!game.midBoss.mbPhase2Triggered,
          shieldNodes: game.cystPods.filter(p => p.isMidBossShieldNode).map(p => [
            Math.round(p.x * 10) / 10,
            Math.round(p.z * 10) / 10,
            Math.round(p.hp),
            Math.round(p.maxHp)
          ])
        } : null;

        const bossSnap = game.boss ? {
          active: !!game.boss.active,
          hp: Math.round(game.boss.hp),
          maxHp: game.boss.maxHp,
          phase: game.boss.phase,
          invulnState: game.boss.invulnState || "NONE",
          shielded: !!game.boss.shielded,
          groggyTimer: Math.round((game.boss.groggyTimer || 0) * 10) / 10,
          armorShredTimer: Math.round((game.boss.armorShredTimer || 0) * 10) / 10,
          lastPatternText: game.boss.lastPatternText || "",
          dead: !!game.boss.dead
        } : null;

        const pylonSnap = (game.bloodPylons || []).map(p => [
          Math.round(p.x * 10) / 10,
          Math.round(p.z * 10) / 10,
          Math.round(p.hp),
          Math.round(p.maxHp)
        ]);

        const hiveSnap = game.cystPods
          .filter(p => p.isMissionHive && p.roomIndex === game.currentRoomIndex)
          .map(p => [
            Math.round(p.x * 10) / 10,
            Math.round(p.z * 10) / 10,
            Math.round(p.hp),
            Math.round(p.maxHp),
            p.stepOrder || 1,
            p.roomIndex
          ]);

        const barSnap = (game.barricades || []).map(b => ({
          ownerId: b.ownerId,
          x: Math.round(b.x * 10) / 10,
          z: Math.round(b.z * 10) / 10,
          hp: Math.round(b.hp),
          maxHp: Math.round(b.maxHp),
          hw: Math.round(b.hw * 10) / 10,
          hd: Math.round(b.hd * 10) / 10,
          hasTurret: !!b.hasTurret
        }));

        wsClient.send(JSON.stringify({
          type: "WORLD_SNAPSHOT",
          roomIdx: game.currentRoomIndex,
          wavePhase: game.wavePhase,
          waveTimer: Math.round(game.waveTimer * 10) / 10,
          doorsState: (game.doors || []).map(d => [d.open ? 1 : 0, d.lockedPermanently ? 1 : 0]),
          roomsState: (game.rooms || []).map(r => [r.unlocked ? 1 : 0, r.cleared ? 1 : 0, r.lockedBehind ? 1 : 0]),
          roomsGas: (game.rooms || []).map(r => [r.gasWaveActive ? 1 : 0, Math.round((r.gasWaveProgress || 0) * 1000) / 1000]),
          thermiteParts: game.thermiteParts || 0,
          safeZones: szSnap,
          midBossState: mbSnap,
          bossState: bossSnap,
          bloodPylons: pylonSnap,
          hiveNodes: hiveSnap,
          barricades: barSnap,
          missionNodes: (game.missionNodes || [])
            .filter(n => n.roomIndex === game.currentRoomIndex)
            .map(n => ({
              roomIndex: n.roomIndex,
              kind: n.kind,
              stepOrder: n.stepOrder || 0,
              x: Math.round(n.x * 10) / 10,
              z: Math.round(n.z * 10) / 10,
              done: !!n.done,
              genIndex: n.genIndex || 0,
              coolantIdx: n.coolantIdx || 0
            })),
          roomState: cr ? {
            progress: cr.progress,
            subStage: cr.subStage,
            unlockStage: cr.unlockStage,
            completedStage: cr.completedStage,
            waitingForWaveDefense: cr.waitingForWaveDefense,
            waveZombieQuota: cr.waveZombieQuota,
            waveZombiesSpawned: cr.waveZombiesSpawned,
            sectorTimer: Math.round(cr.sectorTimer),
            berserkActive: cr.berserkActive,
            gasWaveActive: cr.gasWaveActive,
            gasWaveProgress: Math.round((cr.gasWaveProgress || 0) * 1000) / 1000,
            midBossAwakened: !!cr.midBossAwakened,
            bossPhaseStage: cr.bossPhaseStage || 0,
            thermiteDetonated: !!cr.thermiteDetonated,
            envCleared: !!cr.envCleared,
            blackoutRestoredTimer: Math.round(cr.blackoutRestoredTimer || 0)
          } : null,
          zombies: zSnap
        }));
      } catch (e) {}
    }, 50);
