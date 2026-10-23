/**
 * =========================================================================
 * BOXHEAD: THE CORE v3.1 — Frontend Module: 06_simulation_and_ai.js
 * Zero-Loss Refactored Architecture (Shared Global Lexical Scope)
 * =========================================================================
 */
"use strict";

    // =========================================================================
    // 14. ROOM PROGRESSION & PROBABILISTIC COLLAPSE
    // =========================================================================
    function checkRoomClear(room) {
      if (room.cleared || room.isBossRoom) return;
      if (room.progress < room.targetVal) return;
      // 섬멸 미션도 최소 2웨이브 이상 방어해야 클리어 인정!
      if (room.condType === "EXTERMINATE" && (room.roomWaveCount || 1) < 2) return;

      room.cleared = true;
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
      game.waveTimer = 18.0;
      SoundFX.play("pickup");

      const nextIdx = room.index + 1;
      const door = game.doors.find(d => d.fromRoom === room.index && d.toRoom === nextIdx);
      if (door) {
        door.open = true;
        door.mesh.position.y = -4.2;
      }

      if (game.rooms[nextIdx]) {
        const nextR = game.rooms[nextIdx];
        nextR.unlocked = true;
        game.currentRoomIndex = nextIdx;
        relocateArmoryForCalmPhase(nextR);
        updateRoomVisibility();

        // 정확히 지정된 3개 섹터(중간보스 I, II, III) 진입 시 중간보스 출현!
        if (nextR.hasMidBoss && !nextR.midBossSpawned) {
          nextR.midBossSpawned = true;
          const mbPool = ["MB_JUGGERNAUT", "MB_SUMMONER", "MB_ACIDQUEEN"];
          const mbKey = mbPool[Math.max(0, nextR.midBossOrder) % mbPool.length];
          spawnZombie(mbKey, nextR.wx, nextR.wz, nextIdx);
          SoundFX.play("alarm");
        }

        if (nextR.isBossRoom && game.boss) {
          game.boss.active = true;
        }
      }

      const collapseBanner = document.getElementById("hud-collapse-banner");
      const safeBanner = document.getElementById("hud-safe-banner");

      if (Math.random() < 0.75) {
        room.collapsing = true;
        game.collapseState = { active: true, roomIndex: room.index, timer: 24.0 };
        if (collapseBanner) collapseBanner.classList.remove("hidden");
        if (safeBanner) safeBanner.classList.add("hidden");
        SoundFX.play("alarm");
        if (door) {
          for (let m = 0; m < 8; m++) {
            const mType = m % 2 === 0 ? "RUNNER" : "WALKER";
            spawnZombie(mType, door.x + (Math.random() - 0.5) * 8, door.z + (Math.random() - 0.5) * 8, nextIdx);
          }
        }
      } else {
        if (safeBanner) {
          document.getElementById("hud-safe-banner-text").textContent =
            `✅ S${nextIdx + 1} 개방! 보너스 +${clearBonusBp}BP · ⚙️무기부품 +1개 · 탄약 보급`;
          safeBanner.classList.remove("hidden");
          setTimeout(() => safeBanner.classList.add("hidden"), 5000);
        }
      }
      updateWeaponSlotsHUD();
    }

    function executeRoomCollapse(room) {
      room.collapsing = false;
      room.collapsed = true;
      if (room.floorMesh) room.floorMesh.material.color.setHex(0x450a0a);
      SoundFX.play("explosion");
    }

    // =========================================================================
    // 15. BOSS 'THE CORE' AI & 3 INVULNERABILITY MECHANIC UPDATES
    // =========================================================================
    function clearBossGrapple() {
      const b = game.boss;
      if (!b) return;
      b.grappleTarget = null;
      if (b.grappleLine) {
        effectsGroup.remove(b.grappleLine);
        b.grappleLine = null;
      }
    }

    function updateBossAI(dt) {
      const b = game.boss;
      if (!b || !b.active || b.dead) return;

      b.groggyTimer = Math.max(0, b.groggyTimer - dt);

      const pulseSpeed = b.phase === 1 ? 4.0 : (b.phase === 2 ? 6.5 : 9.2);
      b.pulseTime += dt * pulseSpeed;
      const scaleMod = 1.0 + Math.sin(b.pulseTime) * 0.11;
      b.coreCluster.scale.set(scaleMod, scaleMod, scaleMod);

      // Handle 3 Forced Invulnerability Mechanics
      if (b.invulnState === "PYLONS_75") {
        // Check if all 4 Blood Pylons are destroyed
        for (let i = game.bloodPylons.length - 1; i >= 0; i--) {
          if (game.bloodPylons[i].hp <= 0) {
            entitiesGroup.remove(game.bloodPylons[i].mesh);
            game.bloodPylons.splice(i, 1);
          }
        }
        if (game.bloodPylons.length === 0) {
          b.invulnState = "NONE";
          b.shielded = false;
          b.groggyTimer = 8.0;
          b.lastPatternText = "⚡ GROGGY (2.5x DMG)";
          SoundFX.play("revive");
        }
      } else if (b.invulnState === "LASERS_50") {
        game.laserTimer -= dt;
        game.laserAngle += dt * 1.15;
        b.laserGroup.rotation.y = game.laserAngle;

        // Check Laser Beam collision against players
        game.players.forEach(p => {
          if (p.downed || p.dashActiveTimer > 0) return;
          const dx = p.x - b.x;
          const dz = p.z - b.z;
          const dist = Math.hypot(dx, dz);
          if (dist > 3.5 && dist < 35.0) {
            const pAngle = Math.atan2(dz, dx);
            for (let l = 0; l < 4; l++) {
              const beamA = game.laserAngle + (l * Math.PI) / 2;
              const diff = Math.abs(Math.atan2(Math.sin(pAngle - beamA), Math.cos(pAngle - beamA)));
              if (diff < 0.085) {
                damagePlayer(p, 35 * dt, false, false);
              }
            }
          }
        });

        if (game.laserTimer <= 0) {
          b.invulnState = "NONE";
          b.shielded = false;
          b.laserGroup.visible = false;
          b.groggyTimer = 8.0;
          b.lastPatternText = "⚡ GROGGY (2.5x DMG)";
          SoundFX.play("revive");
        }
      } else if (b.invulnState === "HOSTS_25") {
        // Check if any Golden Nutrient Host zombies remain
        const hosts = game.zombies.filter(z => z.spec.isNutrientHost);
        hosts.forEach(h => {
          // Move host toward Boss Core!
          const dx = b.x - h.x;
          const dz = b.z - h.z;
          const dist = Math.hypot(dx, dz) || 1;
          if (h.stunTimer <= 0) {
            h.x += (dx / dist) * h.speed * dt;
            h.z += (dz / dist) * h.speed * dt;
          }
          if (dist < 4.8) {
            // Host absorbed by Boss -> Heals boss 6% HP!
            h.hp = 0;
            b.hp = Math.min(b.maxHp, b.hp + Math.round(b.maxHp * 0.06));
          }
        });
        if (hosts.length === 0) {
          b.invulnState = "NONE";
          b.shielded = false;
          b.groggyTimer = 10.0;
          b.lastPatternText = "⚡ GROGGY (2.5x DMG)";
          SoundFX.play("revive");
        }
      }

      b.shieldMat.opacity = (b.invulnState !== "NONE") ? 0.55 + Math.sin(b.pulseTime * 2) * 0.15 : 0.0;

      // Active Grapple Pull
      if (b.grappleTarget) {
        if (b.grappleTarget.downed) {
          clearBossGrapple();
        } else {
          const dx = b.x - b.grappleTarget.x;
          const dz = b.z - b.grappleTarget.z;
          const dist = Math.hypot(dx, dz) || 1;
          b.grappleTarget.x += (dx / dist) * 4.2 * dt;
          b.grappleTarget.z += (dz / dist) * 4.2 * dt;
          if (dist < 5.0) damagePlayer(b.grappleTarget, 18 * dt, true, false);
          if (b.grappleLine) {
            const posAttr = b.grappleLine.geometry.attributes.position;
            posAttr.setXYZ(0, b.x, 2.8, b.z);
            posAttr.setXYZ(1, b.grappleTarget.x, 1.2, b.grappleTarget.z);
            posAttr.needsUpdate = true;
          }
        }
      }

      if (b.groggyTimer <= 0) {
        b.patternTimer -= dt;
        if (b.patternTimer <= 0) {
          b.patternTimer = b.phase === 1 ? 4.8 : (b.phase === 2 ? 3.5 : 2.6);
          triggerBossPattern(b);
        }
      }
    }

    function triggerBossPattern(b) {
      const alivePlayers = game.players.filter(p => !p.downed);
      if (alivePlayers.length === 0) return;

      const pool = ["SHOCKWAVE", "TENTACLES", "CYST_PODS", "BLOOD_RING_VOLLEY"];
      if (b.phase >= 2) pool.push("ACID_POOLS", "GRAPPLE", "BLOOD_MORTAR");
      const chosen = pool[Math.floor(Math.random() * pool.length)];

      if (chosen === "SHOCKWAVE") {
        b.lastPatternText = "💥 혈액 충격파 ([Space] 점프로 회피!)";
        SoundFX.play("explosion");
        const ringMesh = new THREE.Mesh(
          new THREE.RingGeometry(2.0, 2.8, 32),
          new THREE.MeshBasicMaterial({ color: 0xf43f5e, side: THREE.DoubleSide, transparent: true, opacity: 0.85 })
        );
        ringMesh.rotation.x = -Math.PI / 2;
        ringMesh.position.set(b.x, 0.25, b.z);
        effectsGroup.add(ringMesh);
        game.particles.push({ mesh: ringMesh, life: 0.75, maxLife: 0.75, expand: 10.5 });

        alivePlayers.forEach(p => {
          const dist = Math.hypot(p.x - b.x, p.z - b.z);
          if (dist < 17.5) {
            // [Space] 점프·회피(dashActiveTimer > 0) 중이면 바닥 혈액 충격파를 완벽히 뛰어넘어 회피하고 스태미너 +30 회복!
            if (p.dashActiveTimer > 0) {
              p.stamina = Math.min(getPlayerMaxStamina(p), (p.stamina || 0) + 30);
            } else {
              damagePlayer(p, 24, true, false);
              const nx = (p.x - b.x) / (dist || 1);
              const nz = (p.z - b.z) / (dist || 1);
              moveEntityWithCollision(p, nx * 4.5, nz * 4.5, 0.55);
            }
          }
        });
      } else if (chosen === "TENTACLES") {
        b.lastPatternText = "🦑 촉수 급습";
        alivePlayers.forEach(p => {
          const tx = p.x + (Math.random() - 0.5) * 3.0;
          const tz = p.z + (Math.random() - 0.5) * 3.0;
          const warnMesh = new THREE.Mesh(
            new THREE.CircleGeometry(2.2, 20),
            new THREE.MeshBasicMaterial({ color: 0xef4444, transparent: true, opacity: 0.55 })
          );
          warnMesh.rotation.x = -Math.PI / 2;
          warnMesh.position.set(tx, 0.08, tz);
          effectsGroup.add(warnMesh);
          game.tentacles.push({ x: tx, z: tz, timer: 1.25, erupted: false, mesh: warnMesh });
        });
      } else if (chosen === "CYST_PODS") {
        b.lastPatternText = "🥚 자폭 낭종 파괴";
        const bossRoom = game.rooms[game.rooms.length - 1];
        for (let i = 0; i < 3; i++) {
          const px = bossRoom.wx + (Math.random() - 0.5) * 32;
          const pz = bossRoom.wz + (Math.random() - 0.5) * 32;
          const podMesh = new THREE.Mesh(
            new THREE.DodecahedronGeometry(1.1, 1),
            new THREE.MeshStandardMaterial({ color: 0xa3e635, emissive: 0x3f6212, roughness: 0.3 })
          );
          podMesh.position.set(px, 1.0, pz);
          entitiesGroup.add(podMesh);
          game.cystPods.push({ x: px, z: pz, hp: 110, isMissionHive: false, timer: 8.0, mesh: podMesh });
        }
      } else if (chosen === "ACID_POOLS") {
        b.lastPatternText = "🧪 산성 웅덩이";
        alivePlayers.forEach(p => {
          const ax = p.x + (Math.random() - 0.5) * 6;
          const az = p.z + (Math.random() - 0.5) * 6;
          const poolMesh = new THREE.Mesh(
            new THREE.CircleGeometry(3.2, 20),
            new THREE.MeshBasicMaterial({ color: 0x84cc16, transparent: true, opacity: 0.65 })
          );
          poolMesh.rotation.x = -Math.PI / 2;
          poolMesh.position.set(ax, 0.05, az);
          effectsGroup.add(poolMesh);
          game.acidPools.push({ x: ax, z: az, radius: 3.2, life: 9.0, mesh: poolMesh });
        });
      } else if (chosen === "GRAPPLE") {
        const target = alivePlayers[Math.floor(Math.random() * alivePlayers.length)];
        clearBossGrapple();
        b.grappleTarget = target;
        b.grappleHp = 220;
        b.lastPatternText = `🩸 ${target.name} 견인중 ([V] 기절충격파로 절단!)`;
        const lineGeo = new THREE.BufferGeometry().setFromPoints([
          new THREE.Vector3(b.x, 2.8, b.z),
          new THREE.Vector3(target.x, 1.2, target.z)
        ]);
        b.grappleLine = new THREE.Line(lineGeo, new THREE.LineBasicMaterial({ color: 0xf43f5e }));
        effectsGroup.add(b.grappleLine);
      } else if (chosen === "BLOOD_RING_VOLLEY") {
        b.lastPatternText = "🩸 12방향 혈류 탄막 방출";
        SoundFX.play("shotgun");
        for (let k = 0; k < 12; k++) {
          const ang = (k / 12) * Math.PI * 2 + (b.pulseTime * 0.2);
          const orb = new THREE.Mesh(
            new THREE.SphereGeometry(0.45, 8, 8),
            new THREE.MeshBasicMaterial({ color: 0xf43f5e })
          );
          orb.position.set(b.x, 1.25, b.z);
          effectsGroup.add(orb);
          game.bullets.push({
            ownerId: -1,
            isZombieProjectile: true,
            causesAcid: false,
            x: b.x, z: b.z,
            vx: Math.cos(ang) * 11.0,
            vz: Math.sin(ang) * 11.0,
            damage: 20,
            explosiveRadius: 0,
            piercing: false,
            life: 3.2,
            mesh: orb
          });
        }
      } else if (chosen === "BLOOD_MORTAR") {
        b.lastPatternText = "☄️ 생체 혈액 박격포 폭격";
        SoundFX.play("alarm");
        alivePlayers.forEach(p => {
          for (let m = 0; m < 2; m++) {
            const mx = p.x + (Math.random() - 0.5) * 9.0;
            const mz = p.z + (Math.random() - 0.5) * 9.0;
            const warn = new THREE.Mesh(
              new THREE.RingGeometry(0.5, 3.4, 24),
              new THREE.MeshBasicMaterial({ color: 0xf43f5e, side: THREE.DoubleSide, transparent: true, opacity: 0.75 })
            );
            warn.rotation.x = -Math.PI / 2;
            warn.position.set(mx, 0.09, mz);
            effectsGroup.add(warn);
            game.tentacles.push({ x: mx, z: mz, timer: 1.35, erupted: false, mesh: warn });
          }
        });
      }
    }

    // =========================================================================
    // 16. MAIN 60FPS SIMULATION LOOP (Swarm Spawning, Complex Missions & Combat)
    // =========================================================================
    let lastFrameTime = performance.now();

    // 플레이어가 현재 해금된 단계의 미션 요소를 완료했을 때 호출 -> 다음 웨이브를 막아야만 그 다음 요소가 열리도록 설정!
    function advanceRoomMissionStage(room, completedStep, toastText) {
      if (!room) return;
      room.completedStage = Math.max(room.completedStage || 0, completedStep);
      room.waitingForWaveDefense = true;
      // 미션 요소를 완료했으므로 다음 웨이브가 곧바로 몰려와 템포가 늘어지지 않게 함
      if (game.wavePhase === "CALM" && game.waveTimer > 4.0) {
        game.waveTimer = 4.0;
      }
      const safeBanner = document.getElementById("hud-safe-banner");
      if (safeBanner && toastText) {
        document.getElementById("hud-safe-banner-text").textContent = toastText;
        safeBanner.classList.remove("hidden");
        setTimeout(() => safeBanner.classList.add("hidden"), 4500);
      }
    }

    let camFocusX = 0;
    let camFocusZ = 0;
    let camInitialized = false;

    function updateSimulation(dt) {
      if (!game.running) return;
      game.elapsedTime += dt;

      if (game.comboTimer > 0) {
        game.comboTimer -= dt;
        if (game.comboTimer <= 0) game.comboCount = 0;
      }

      const curRoom = game.rooms[game.currentRoomIndex];

      game.armoryVaults.forEach(v => {
        if (v.holoGun) v.holoGun.rotation.y += dt * 1.8;
      });

      // 1. Update Thermite Defense Timer if active
      if (curRoom && !curRoom.cleared && curRoom.condType === "THERMITE" && curRoom.subStage === 2) {
        curRoom.progress = Math.min(curRoom.targetVal, curRoom.progress + dt);
        checkRoomClear(curRoom);
      }

      // 1b. 이전 섹터 원웨이(One-Way) 영구 격벽 봉쇄 (비정형 hw/hd 지원):
      const mePlayer = game.players[mySlotIndex] || game.players[0];
      if (mePlayer && curRoom && curRoom.index > 0 && !curRoom.lockedBehind) {
        const insideMarginX = (curRoom.hw || curRoom.half) - 3.5;
        const insideMarginZ = (curRoom.hd || curRoom.half) - 3.5;
        if (Math.abs(mePlayer.x - curRoom.wx) < insideMarginX && Math.abs(mePlayer.z - curRoom.wz) < insideMarginZ) {
          curRoom.lockedBehind = true;
          const prevIdx = curRoom.index - 1;
          const backDoor = game.doors.find(d => d.fromRoom === prevIdx && d.toRoom === curRoom.index);
          if (backDoor) {
            backDoor.open = false;
            backDoor.lockedPermanently = true;
            backDoor.mesh.position.y = 2.0;
            backDoor.mesh.material.color.setHex(0x991b1b);
            backDoor.mesh.material.emissive.setHex(0x450a0a);
          }
          game.players.forEach((pl, idx) => {
            if (Math.abs(pl.x - curRoom.wx) >= (curRoom.hw || curRoom.half) || Math.abs(pl.z - curRoom.wz) >= (curRoom.hd || curRoom.half)) {
              pl.x = mePlayer.x + (idx - 1.5) * 1.5;
              pl.z = mePlayer.z + 1.2;
            }
          });
          for (let zi = game.zombies.length - 1; zi >= 0; zi--) {
            if (game.zombies[zi].roomIndex < curRoom.index) {
              entitiesGroup.remove(game.zombies[zi].group);
              game.zombies.splice(zi, 1);
            }
          }
          SoundFX.play("explosion");
          const collapseBanner = document.getElementById("hud-collapse-banner");
          if (collapseBanner) collapseBanner.classList.add("hidden");
          if (game.collapseState) game.collapseState.active = false;

          const safeBanner = document.getElementById("hud-safe-banner");
          if (safeBanner) {
            document.getElementById("hud-safe-banner-text").textContent =
              `🔒 후방 격벽 봉쇄! 섹터 ${curRoom.index + 1} 강화 상한(Lv.${getSectorMaxStatLv() * 5}) 해금!`;
            safeBanner.classList.remove("hidden");
            setTimeout(() => safeBanner.classList.add("hidden"), 4800);
          }
        }
      }

      // 1c. 섹터 제한시간(260~440초) 초과 시 [🚨 호드 광폭화(기존+신규 좀비 전원 폭주) + 출구 반대편 외벽 ➔ 출구 방향 지향성 독가스 확산]!
      if (curRoom && !curRoom.cleared && !curRoom.isBossRoom) {
        curRoom.sectorTimer = Math.max(0, (curRoom.sectorTimer || 260) - dt);
        if (curRoom.sectorTimer <= 0) {
          if (!curRoom.overtimeAlerted) {
            curRoom.overtimeAlerted = true;
            curRoom.berserkActive = true;
            curRoom.gasWaveActive = true;
            curRoom.gasWaveProgress = 0.05;
            while ((curRoom.spawnHoles || []).some(h => !h.active)) {
              activateAdditionalSpawnHole(curRoom);
            }
            // 현재 살아있는 모든 감염체도 즉시 광폭화(이속 +35%, 공격력 +35%, 핏빛 발광) 적용!
            game.zombies.forEach(z => {
              if (!z.berserkEnraged && !z.spec.isNutrientHost) {
                z.berserkEnraged = true;
                z.speed *= 1.35;
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
                "☣️ 독가스 살포 & 🔥호드 광폭화 (탈출 통로로 전진!)";
              collapseBanner.classList.remove("hidden");
            }
          }
          game.wavePhase = "SURGE";
          hideArmoriesDuringSurge();
          const collapseTimerEl = document.getElementById("hud-collapse-timer");
          if (collapseTimerEl && !game.collapseState.active) {
            const gasPct = Math.min(100, Math.round((curRoom.gasWaveProgress || 0) * 100));
            collapseTimerEl.textContent = `GAS ${gasPct}%`;
          }
        }

        // [v3.1] 출구(nextDir) 반대편 외벽에서 시작하여 출구 문 쪽으로 서서히 전진하는 지향성 독가스 업데이트 (최대 100% 맵 전체 잠식!)
        if (curRoom.gasWaveActive) {
          curRoom.gasWaveProgress = Math.min(1.0, (curRoom.gasWaveProgress || 0) + dt * 0.016);
          const prog = curRoom.gasWaveProgress;
          const rw = curRoom.w || curRoom.size;
          const rd = curRoom.d || curRoom.size;
          const hw = curRoom.hw || curRoom.half;
          const hd = curRoom.hd || curRoom.half;
          const exitKey = (curRoom.nextDir && curRoom.nextDir.key) || "N";

          if (curRoom.gasMesh) {
            curRoom.gasMesh.visible = true;
            if (exitKey === "N") {
              // 남쪽(S) 외벽에서 북쪽(N) 출구로 전진
              const gasLen = rd * prog;
              curRoom.gasMesh.scale.set(1, 1, Math.max(0.02, prog));
              curRoom.gasMesh.position.set(curRoom.wx, 1.8, curRoom.wz + hd - gasLen / 2);
            } else if (exitKey === "S") {
              // 북쪽(N) 외벽에서 남쪽(S) 출구로 전진
              const gasLen = rd * prog;
              curRoom.gasMesh.scale.set(1, 1, Math.max(0.02, prog));
              curRoom.gasMesh.position.set(curRoom.wx, 1.8, curRoom.wz - hd + gasLen / 2);
            } else if (exitKey === "E") {
              // 서쪽(W) 외벽에서 동쪽(E) 출구로 전진
              const gasLen = rw * prog;
              curRoom.gasMesh.scale.set(Math.max(0.02, prog), 1, 1);
              curRoom.gasMesh.position.set(curRoom.wx - hw + gasLen / 2, 1.8, curRoom.wz);
            } else {
              // 동쪽(E) 외벽에서 서쪽(W) 출구로 전진
              const gasLen = rw * prog;
              curRoom.gasMesh.scale.set(Math.max(0.02, prog), 1, 1);
              curRoom.gasMesh.position.set(curRoom.wx + hw - gasLen / 2, 1.8, curRoom.wz);
            }
          }

          // 독가스 구역 내 플레이어 지속 중독 피해
          game.players.forEach(p => {
            if (p.downed) return;
            let inGas = false;
            if (exitKey === "N" && p.z > curRoom.wz + hd - rd * prog) inGas = true;
            else if (exitKey === "S" && p.z < curRoom.wz - hd + rd * prog) inGas = true;
            else if (exitKey === "E" && p.x < curRoom.wx - hw + rw * prog) inGas = true;
            else if (exitKey === "W" && p.x > curRoom.wx + hw - rw * prog) inGas = true;
            if (inGas) {
              damagePlayer(p, 7.5 * dt, false, true);
            }
          });
        }
      }

      // 2. Room Collapse Countdown
      if (game.collapseState.active) {
        game.collapseState.timer -= dt;
        const timerEl = document.getElementById("hud-collapse-timer");
        if (timerEl) timerEl.textContent = Math.max(0, game.collapseState.timer).toFixed(1) + "s";
        if (game.collapseState.timer <= 0) {
          const cRoom = game.rooms[game.collapseState.roomIndex];
          if (cRoom) executeRoomCollapse(cRoom);
          game.collapseState.active = false;
          document.getElementById("hud-collapse-banner").classList.add("hidden");
        }
      }

      // 3. Environmental Sector Anomalies & [v3.1] 블랙아웃 정전 호러 이벤트 + 일반 섹터 손전등 완벽 비활성화 버그 수정!
      if (curRoom && (curRoom.blackoutEventTimer || 0) > 0) {
        curRoom.blackoutEventTimer = Math.max(0, curRoom.blackoutEventTimer - dt);
      }
      const isBlackoutNow = Boolean(
        curRoom && !curRoom.cleared && (
          (curRoom.envType === "BLACKOUT" && !curRoom.envCleared) ||
          (curRoom.blackoutEventTimer || 0) > 0
        )
      );

      if (isBlackoutNow) {
        const emergencyPulse = 0.10 + Math.max(0, Math.sin(game.elapsedTime * 5.5)) * 0.08;
        ambientLight.intensity = emergencyPulse;
        dirLight.intensity = 0.08;
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
        // [v3.1 버그 수정] 암전(Blackout) 상태일 때만 전술 라이트가 켜지고, 일반 밝은 섹터에서는 visible=false & intensity=0으로 완벽 차단!
        if (p.visual && p.visual.flashLight) {
          p.visual.flashLight.visible = isBlackoutNow && !p.downed;
          p.visual.flashLight.intensity = (isBlackoutNow && !p.downed) ? 2.8 : 0.0;
        }
        if (p.visual && p.visual.flashCone) {
          p.visual.flashCone.visible = isBlackoutNow && !p.downed;
        }
        if (!p.downed && curRoom && curRoom.envType === "TOXIC_FOG" && !curRoom.envCleared && !curRoom.cleared) {
          damagePlayer(p, 1.45 * dt, false, false);
        }
        p.dashActiveTimer = Math.max(0, p.dashActiveTimer - dt);
        p.stimBuffTimer = Math.max(0, p.stimBuffTimer - dt);
        p.swapOverchargeTimer = Math.max(0, p.swapOverchargeTimer - dt);

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

        if (p.bandagingTimer > 0) {
          p.bandagingTimer -= dt;
          if (p.bandagingTimer <= 0) {
            const hasSyr = isPlayerSyringeUpgraded(p);
            p.medkits = Math.max(0, p.medkits - 1);
            p.hp = Math.min(p.maxHp, p.hp + (hasSyr ? 80 : 65));
            p.bleedingTimer = 0;
            if (hasSyr) p.acidTimer = 0;
            SoundFX.play("revive");
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

      // 4. 엄격한 순차 웨이브 방어 & 미션 요소 해금 + [v3.1] 소강기(CALM) 전용 팝업 무기고 + 스폰 구멍 중반 이후 확률 개방
      game.waveTimer = (game.waveTimer || 6.0) - dt;
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
                  "🌑 비상 정전(BLACKOUT) 발생! 전술 손전등이 자동 점등됩니다 — 어둠 속 발광 안광을 경계하세요!";
                safeBanner.classList.remove("hidden");
                setTimeout(() => safeBanner.classList.add("hidden"), 4500);
              }
            }
          }
          SoundFX.play("alarm");
        } else {
          // SURGE 웨이브 방어 체크: 웨이브 방어 중(waitingForWaveDefense)일 때는:
          // 1) 웨이브 정원(Quota)이 전부 스폰 완료되어야 하고
          // 2) 생존 좀비 수가 5마리 이하로 소탕되어야 소강기(CALM)로 진입!
          const quotaFinished = curRoom ? ((curRoom.waveZombiesSpawned || 0) >= (curRoom.waveZombieQuota || 1)) : true;
          const zombiesCleared = game.zombies.length <= 5;
          if (curRoom && curRoom.waitingForWaveDefense && (!quotaFinished || !zombiesCleared)) {
            game.waveTimer = 0; // 정원 출현 및 잔당 5마리 이하 소탕 대기 상태 유지
          } else {
            game.wavePhase = "CALM";
            game.waveTimer = 18.0;

            if (curRoom) {
              relocateArmoryForCalmPhase(curRoom);
            }

            if (curRoom && !curRoom.cleared && !curRoom.isBossRoom) {
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
                    `🔓 웨이브 방어 & 잔당 소탕 성공! [${curRoom.unlockStage}단계 목표(${dirHint})] & 🔧전술 무기고 출현!`;
                  safeBanner.classList.remove("hidden");
                  setTimeout(() => safeBanner.classList.add("hidden"), 5200);
                }
              } else {
                const safeBanner = document.getElementById("hud-safe-banner");
                if (safeBanner) {
                  document.getElementById("hud-safe-banner-text").textContent =
                    `🛡️ 소강상태(18s): 🔧무기고가 출현했습니다! 먼저 [${curRoom.unlockStage}단계 목표]를 완수하세요!`;
                  safeBanner.classList.remove("hidden");
                  setTimeout(() => safeBanner.classList.add("hidden"), 4500);
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
      const isSurge = (game.wavePhase === "SURGE") || (curRoom && (curRoom.collapsing || curRoom.berserkActive));
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

      if (game.spawnTimer <= 0 && game.zombies.length < maxSwarm && !isWaveHordeFinished && !isCalmSpawningRestricted) {
        game.spawnTimer = isSurge
          ? Math.max(0.40, 0.95 - game.currentRoomIndex * 0.04 - rWave * 0.02)
          : Math.max(1.8, 2.8 - game.currentRoomIndex * 0.06);

        if (curRoom) {
          const activeHoles = (curRoom.spawnHoles || []).filter(h => h.active);
          if (activeHoles.length > 0) {
            let packSize = isSurge
              ? Math.min(10, 3 + Math.floor(secCapLv * 0.6) + Math.floor(rWave * 0.4))
              : 1;

            if (curRoom.waitingForWaveDefense) {
              packSize = Math.min(packSize, remainingQuota);
            }

            if (packSize > 0) {
              curRoom.waveZombiesSpawned = (curRoom.waveZombiesSpawned || 0) + packSize;
              const hole = activeHoles[Math.floor(Math.random() * activeHoles.length)];

              const hw = curRoom.hw || curRoom.half;
              const hd = curRoom.hd || curRoom.half;
              const inX = hole.x < curRoom.wx - (hw - 12) ? hole.x + 2.4 : (hole.x > curRoom.wx + (hw - 12) ? hole.x - 2.4 : hole.x);
              const inZ = hole.z < curRoom.wz - (hd - 12) ? hole.z + 2.4 : (hole.z > curRoom.wz + (hd - 12) ? hole.z - 2.4 : hole.z);

              for (let k = 0; k < packSize; k++) {
                if (game.zombies.length >= maxSwarm) break;
                const jitterA = (k / packSize) * Math.PI * 2 + Math.random() * 0.5;
                const zx = Math.max(curRoom.wx - hw + 2.6, Math.min(curRoom.wx + hw - 2.6, inX + Math.cos(jitterA) * 1.6));
                const zz = Math.max(curRoom.wz - hd + 2.6, Math.min(curRoom.wz + hd - 2.6, inZ + Math.sin(jitterA) * 1.6));

                // [v3.1] 섹터별 특수 좀비 계단식 순차 해금!
                // 1섹터(index 0): 무조건 100% 기본 감염체(WALKER)만 출현!
                // 2섹터(index 1): 러너 합류 | 3섹터(index 2): 스핏터·부머 합류 | 4~5섹터: 골리앗 합류 | 6섹터+: 블러드 데빌 합류
                const roll = Math.random();
                const sIdx = game.currentRoomIndex;
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

                const zSpawned = spawnZombie(zType, zx, zz, curRoom.index);
                if (curRoom.berserkActive && zSpawned) {
                  zSpawned.berserkEnraged = true;
                  zSpawned.speed *= 1.35;
                  if (zSpawned.skinMat) {
                    zSpawned.skinMat.emissive.setHex(0xef4444);
                    zSpawned.skinMat.emissiveIntensity = 0.85;
                  }
                }
              }
            }
          }
        }
      }

      updatePlayersAndInteractions(dt);
      updateZombiesAndTurrets(dt);
      updateBossAI(dt);
      updateBossHazards(dt);
      updateBullets(dt);
      updateCratesAndPickups(dt);

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

      updateHUD();
      drawMinimap();
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

      let showPrompt = false;
      const curRoom = game.rooms[game.currentRoomIndex];
      const unlockStg = curRoom ? (curRoom.unlockStage || 0) : 0;

      game.players.forEach(p => {
        p.fireCooldown = Math.max(0, p.fireCooldown - dt);

        if (p.id === mySlotIndex) {
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
            curRoom.subStage === 1 && nextDoor && Math.hypot(nextDoor.x - p.x, nextDoor.z - p.z) < 4.8);

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
              reviveTarget.reviveProgress = Math.max(0, reviveTarget.reviveProgress - dt * 1.5);
              p.revivingTargetId = null;
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
            const reqStep = nearMissionNode.stepOrder || 0;
            if (reqStep > 0 && unlockStg < reqStep) {
              // 엄격한 순차 웨이브 잠금 안내!
              const prevDone = (curRoom.completedStage || 0) >= (reqStep - 1);
              interactTitle.textContent = prevDone
                ? `🔒 현재 웨이브를 방어하면 [${reqStep}단계 목표]가 개방됩니다!`
                : `🔒 먼저 [${reqStep - 1}단계 목표] 완료 후 웨이브를 방어해야 개방됩니다!`;
              interactBar.style.width = "0%";
            } else if (nearMissionNode.kind === "ENV_CONTROL") {
              interactTitle.textContent = nearMissionNode.envType === "TOXIC_FOG" ? "☣️ [F] 환기밸브" : "💡 [F] 비상조명";
              if (holdingF) {
                nearMissionNode.holdTime += dt;
                interactBar.style.width = Math.min(100, (nearMissionNode.holdTime / 1.5) * 100) + "%";
                if (nearMissionNode.holdTime >= 1.5) {
                  nearMissionNode.done = true;
                  curRoom.envCleared = true;
                  entitiesGroup.remove(nearMissionNode.mesh);
                  SoundFX.play("upgrade");
                }
              } else {
                interactBar.style.width = "0%";
              }
            } else if (nearMissionNode.kind === "CHEM_PART") {
              interactTitle.textContent = `🧪 [F] ${reqStep}번 화학원료 회수`;
              interactBar.style.width = "100%";
              if (holdingF) {
                nearMissionNode.done = true;
                entitiesGroup.remove(nearMissionNode.mesh);
                game.thermiteParts++;
                SoundFX.play("pickup");
                advanceRoomMissionStage(
                  curRoom,
                  reqStep,
                  reqStep === 1
                    ? "✅ 1번 원료 회수 완료! 다음 웨이브를 막으면 2번 원료가 개방됩니다!"
                    : "✅ 2번 원료 회수 완료! 다음 웨이브를 막으면 중앙 합성대가 개방됩니다!"
                );
              }
            } else if (nearMissionNode.kind === "SYNTH_TABLE") {
              interactTitle.textContent = game.thermiteParts >= 2 ? "🔬 [F] 테르밋 합성" : `🧪 원료 2개 필요 (${game.thermiteParts}/2)`;
              if (holdingF && game.thermiteParts >= 2) {
                nearMissionNode.holdTime += dt;
                interactBar.style.width = Math.min(100, (nearMissionNode.holdTime / 3.0) * 100) + "%";
                if (nearMissionNode.holdTime >= 3.0) {
                  nearMissionNode.done = true;
                  curRoom.subStage = 1;
                  curRoom.completedStage = 3;
                  SoundFX.play("upgrade");
                }
              } else {
                interactBar.style.width = "0%";
              }
            } else if (nearMissionNode.kind === "GENERATOR") {
              interactTitle.textContent = `⚡ [F] 발전기 #${nearMissionNode.genIndex || 1} 점화`;
              if (holdingF) {
                nearMissionNode.holdTime += dt;
                interactBar.style.width = Math.min(100, (nearMissionNode.holdTime / 2.5) * 100) + "%";
                if (nearMissionNode.holdTime >= 2.5) {
                  nearMissionNode.done = true;
                  if (nearMissionNode.coreMat) nearMissionNode.coreMat.color.setHex(0x38bdf8);
                  curRoom.progress++;
                  SoundFX.play("upgrade");
                  if (curRoom.progress < curRoom.targetVal) {
                    advanceRoomMissionStage(
                      curRoom,
                      reqStep,
                      `✅ 발전기 #${reqStep} 가동 완료! 다음 웨이브를 막으면 발전기 #${reqStep + 1}이 개방됩니다!`
                    );
                  }
                  checkRoomClear(curRoom);
                }
              } else {
                interactBar.style.width = "0%";
              }
            } else if (nearMissionNode.kind === "BLACKBOX" && !p.carryingPayload) {
              interactTitle.textContent = "📦 [F] 블랙박스 회수";
              interactBar.style.width = "100%";
              if (holdingF) {
                p.carryingPayload = true;
                p.currentWeapon = 0;
                nearMissionNode.done = true;
                entitiesGroup.remove(nearMissionNode.mesh);
                SoundFX.play("pickup");
                advanceRoomMissionStage(
                  curRoom,
                  1,
                  curRoom.reqWaves >= 3
                    ? "✅ 블랙박스 회수 완료! 다음 웨이브를 방어하면 🔐보안중계기가 출현합니다!"
                    : "✅ 블랙박스 회수 완료! 다음 웨이브를 방어하면 출구 업로드 단말기가 개방됩니다!"
                );
                updateWeaponSlotsHUD();
              }
            } else if (nearMissionNode.kind === "SECURITY_RELAY") {
              interactTitle.textContent = "🔐 [F] 보안중계기 암호 해독";
              if (holdingF) {
                nearMissionNode.holdTime = (nearMissionNode.holdTime || 0) + dt;
                interactBar.style.width = Math.min(100, (nearMissionNode.holdTime / 2.2) * 100) + "%";
                if (nearMissionNode.holdTime >= 2.2) {
                  nearMissionNode.done = true;
                  entitiesGroup.remove(nearMissionNode.mesh);
                  SoundFX.play("upgrade");
                  advanceRoomMissionStage(
                    curRoom,
                    2,
                    "✅ 보안중계기 암호 해독 완료! 다음 웨이브를 방어하면 🛰️업로드 송신기가 출현합니다!"
                  );
                }
              } else {
                nearMissionNode.holdTime = 0;
                interactBar.style.width = "0%";
              }
            }
          } else if (nearThermiteDoor) {
            showPrompt = true;
            interactTitle.textContent = "🔥 [F] 테르밋 폭약 부착";
            interactBar.style.width = "100%";
            if (holdingF) {
              curRoom.subStage = 2;
              SoundFX.play("alarm");
            }
          } else if (nearPayloadExit) {
            showPrompt = true;
            if (unlockStg < 2) {
              interactTitle.textContent = `🔒 현재 웨이브를 방어해야 업로드 송신기가 출현합니다!`;
              interactBar.style.width = "0%";
            } else {
              interactTitle.textContent = "🛰️ [F] 블랙박스 데이터 업로드";
              interactBar.style.width = "100%";
              if (holdingF) {
                p.carryingPayload = false;
                if (uploadTerm) {
                  uploadTerm.done = true;
                  entitiesGroup.remove(uploadTerm.mesh);
                }
                curRoom.progress = 1;
                curRoom.completedStage = 2;
                checkRoomClear(curRoom);
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
              interactTitle.textContent = "🔧 무기고 정비구역 — [B / T / U] 강화·탄약보급";
              interactBar.style.width = "100%";
            }
          } else if (nearDecon) {
            showPrompt = true;
            interactTitle.textContent = `🏥 [F] 치료소(${nearDecon.charges})`;
            interactBar.style.width = "100%";
            if (holdingF) {
              nearDecon.charges--;
              p.hp = Math.min(p.maxHp, p.hp + 55);
              p.bleedingTimer = 0;
              p.acidTimer = 0;
              p.medkits = Math.min(getPlayerMaxMedkits(p), p.medkits + 1);
              if (nearDecon.charges <= 0) entitiesGroup.remove(nearDecon.mesh);
              SoundFX.play("revive");
            }
          } else {
            p.revivingTargetId = null;
          }

          // [Shift 질주 & 스태미너 시스템]
          const maxStam = getPlayerMaxStamina(p);
          const regenStam = getPlayerStaminaRegen(p);
          p.maxStamina = maxStam;
          if (p.stamina === undefined) p.stamina = maxStam;
          p.staminaExhaustTimer = Math.max(0, (p.staminaExhaustTimer || 0) - dt);

          if (p.dashActiveTimer > 0) {
            p.isSprinting = false;
            moveEntityWithCollision(p, p.dashDirX * 22.0 * dt, p.dashDirZ * 22.0 * dt, 0.55, true);
          } else if (p.revivingTargetId === null) {
            let mx = 0, mz = 0;
            if (keys["KeyW"] || touchMove.w) mz -= 1;
            if (keys["KeyS"] || touchMove.s) mz += 1;
            if (keys["KeyA"] || touchMove.a) mx -= 1;
            if (keys["KeyD"] || touchMove.d) mx += 1;

            const isMoving = (mx !== 0 || mz !== 0);
            const holdingShift = !!(keys["ShiftLeft"] || keys["ShiftRight"] || window.touchSprintShift);
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
              p.stamina = Math.min(maxStam, p.stamina + regenStam * dt);
            }

            let moveSpeed = p.downed ? 2.5 : 9.2;
            // 나노 주사기 개조 시에는 자가 치료 중에도 이동속도 감속이 전혀 없음!
            if (p.bandagingTimer > 0 && !isPlayerSyringeUpgraded(p)) moveSpeed *= 0.42;
            if (p.carryingPayload) moveSpeed *= 0.78;
            if (p.acidTimer > 0) moveSpeed *= 0.72;
            if (p.stimBuffTimer > 0) moveSpeed *= 1.25;
            if (p.isSprinting) moveSpeed *= 1.42;

            if (isMoving) {
              const mLen = Math.hypot(mx, mz);
              moveEntityWithCollision(p, (mx / mLen) * moveSpeed * dt, (mz / mLen) * moveSpeed * dt, 0.55);
              p.rotY = Math.atan2(mx, mz);
              p.walkCycle += dt * (p.isSprinting ? 17 : 12);
            }
          } else {
            p.isSprinting = false;
            p.stamina = Math.min(maxStam, p.stamina + regenStam * dt);
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
        } else if (p.role === "REMOTE") {
          // [v3.1 멀티플레이 위치 보간] 원격 팀원(REMOTE)의 좌표를 60FPS로 부드럽게 보간(Lerp)하여 끊김 없는 이동 보장!
          if (p.netTargetX !== undefined && p.netTargetZ !== undefined) {
            p.x += (p.netTargetX - p.x) * Math.min(1.0, dt * 16);
            p.z += (p.netTargetZ - p.z) * Math.min(1.0, dt * 16);
          }
          if (p.netTargetRotY !== undefined) {
            p.rotY = p.netTargetRotY;
          }
        } else if (p.role === "AI") {
          updateAISquadMember(p, dt);
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
          (ref.charges !== undefined && ref.charges <= 0) ||
          (ref.hp !== undefined && ref.hp <= 0) ||
          (ref.active !== undefined && !ref.active) ||
          (ref.activeInCalm !== undefined && !ref.activeInCalm && !(curRoom && curRoom.isBossRoom)) ||
          ((ref.kind === "CORE" || ref.kind === "PART") && !game.pickups.includes(ref));

        if (isGone || (sym.roomIndex !== game.currentRoomIndex && ref.kind !== "CORE" && ref.kind !== "PART")) {
          sym.el.style.display = "none";
          return;
        }
        if (me && Math.hypot(sym.x - me.x, sym.z - me.z) > 44) {
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

    function updateAISquadMember(ai, dt) {
      const targetRoom = game.rooms[game.currentRoomIndex];
      if (!targetRoom) return;

      // [v3.2 AI 전술 지능 대폭 강화] 섹터 진행에 맞춰 AI의 기본 무기(권총/산탄총/UZI/소총) 스탯도 자동 성장하여 후반부에 쓸모없는 짐이 되지 않도록 보정!
      const targetLv = Math.min(8, Math.floor((game.currentRoomIndex || 0) * 0.85));
      if (ai.inventory && ai.inventory[0] && ai.inventory[0].stats.atk < targetLv) {
        const wUnlockIdx = (ai.id === 1) ? 1 : (ai.id === 2 ? 2 : 3);
        if (game.currentRoomIndex >= 1 && ai.inventory[wUnlockIdx]) {
          ai.inventory[wUnlockIdx].unlocked = true;
          ai.inventory[wUnlockIdx].ammo = Math.max(ai.inventory[wUnlockIdx].ammo, WEAPONS[wUnlockIdx].startAmmo);
        }
        [0, wUnlockIdx].forEach(wi => {
          const inv = ai.inventory[wi];
          if (!inv) return;
          inv.stats.atk = targetLv;
          inv.stats.spd = Math.floor(targetLv * 0.7);
          inv.stats.stun = Math.floor(targetLv * 0.6);
          inv.totalLv = inv.stats.atk + inv.stats.spd + inv.stats.stun;
        });
      }

      if (!ai.downed) {
        // 1) 체력 위급(45 이하) 시 스스로 붕대 치료 또는 스팀팩 투여
        if (ai.hp <= 45 && ai.medkits > 0 && ai.bandagingTimer <= 0) {
          startSelfBandaging(ai);
        } else if (ai.hp <= 55 && ai.stims > 0 && ai.stimBuffTimer <= 0) {
          useAdrenalineStim(ai);
        }

        // 2) 주변에 좀비 3마리 이상 밀집 포위 시 360° 기절 밀치기(Bash) 또는 전술 회피(Dash) 자율 발동!
        let closeZombies = 0;
        game.zombies.forEach(z => {
          if (Math.hypot(z.x - ai.x, z.z - ai.z) < 3.4) closeZombies++;
        });
        if (closeZombies >= 3 && (ai.bashCooldown || 0) <= 0) {
          triggerMeleeBash(ai);
        } else if (closeZombies >= 4 && ai.dashCooldown <= 0) {
          triggerTacticalDash(ai);
        }

        // 3) 산성 장판 회피
        const onAcid = game.acidPools.find(pool => Math.hypot(ai.x - pool.x, ai.z - pool.z) < pool.radius + 0.6);
        if (onAcid) {
          const escX = ai.x - onAcid.x || 1;
          const escZ = ai.z - onAcid.z || 1;
          const escLen = Math.hypot(escX, escZ) || 1;
          moveEntityWithCollision(ai, (escX / escLen) * 8.5 * dt, (escZ / escLen) * 8.5 * dt, 0.55);
        }

        // 4) 빈사 팀원 최우선 구출 (벽 끼임 시 스마트 우회)
        const downedMate = game.players.find(m => m.id !== ai.id && m.downed);
        if (downedMate) {
          const dist = Math.hypot(downedMate.x - ai.x, downedMate.z - ai.z);
          if (dist > 2.2) {
            const nx = (downedMate.x - ai.x) / dist;
            const nz = (downedMate.z - ai.z) / dist;
            moveZombieSmart({ x: ai.x, z: ai.z, radius: 0.55, group: ai.visual.group, slideDir: ai.slideDir || 0, slideTimer: ai.slideTimer || 0 }, nx, nz, 8.4, dt, downedMate);
            ai.x = ai.visual.group.position.x;
            ai.z = ai.visual.group.position.z;
            ai.rotY = Math.atan2(nx, nz);
            ai.walkCycle += dt * 10;
            return;
          } else {
            downedMate.reviveProgress += dt * 0.95;
            if (downedMate.reviveProgress >= game.reviveDuration) completeRevive(downedMate);
            return;
          }
        }
      }

      const leader = game.players[mySlotIndex] || game.players[0];
      const anchorX = leader && !leader.downed ? leader.x : targetRoom.wx;
      const anchorZ = leader && !leader.downed ? leader.z : targetRoom.wz;
      const angle = (ai.id * Math.PI) / 2;
      const goalX = anchorX + Math.cos(angle) * 4.2;
      const goalZ = anchorZ + Math.sin(angle) * 4.2;
      const distGoal = Math.hypot(goalX - ai.x, goalZ - ai.z);

      const moveSpeed = ai.downed ? 2.2 : 8.2;
      if (distGoal > 18.0 && !ai.downed) {
        // 벽 뒤에 완전히 고립된 경우 리더 근처로 전술 합류
        ai.x = anchorX + Math.cos(angle) * 2.5;
        ai.z = anchorZ + Math.sin(angle) * 2.5;
      } else if (distGoal > 2.4) {
        const prevX = ai.x, prevZ = ai.z;
        const nx = (goalX - ai.x) / distGoal;
        const nz = (goalZ - ai.z) / distGoal;
        moveEntityWithCollision(ai, nx * moveSpeed * dt, nz * moveSpeed * dt, 0.55);
        if (Math.hypot(ai.x - prevX, ai.z - prevZ) < moveSpeed * dt * 0.35) {
          // 장애물 벽면 미끄러지기 우회
          moveEntityWithCollision(ai, -nz * moveSpeed * dt, nx * moveSpeed * dt, 0.55);
        }
        ai.walkCycle += dt * 10;
      }

      let bestTarget = null;
      let bestDist = 22.0;
      game.zombies.forEach(z => {
        const d = Math.hypot(z.x - ai.x, z.z - ai.z);
        if (d < bestDist) { bestDist = d; bestTarget = z; }
      });
      if (!bestTarget) {
        const shieldPod = game.cystPods.find(p => p.hp > 0 && p.isMidBossShieldNode);
        if (shieldPod) bestTarget = shieldPod;
      }
      if (!bestTarget && game.bloodPylons.length > 0) {
        bestTarget = game.bloodPylons[0];
      }
      if (!bestTarget && game.boss && game.boss.active && !game.boss.dead) {
        bestTarget = game.boss;
      }

      // 주무기 탄약 보유 시 주무기 장착, 소진 시 권총 전환
      if (!ai.downed && ai.inventory) {
        const prefW = (ai.id === 1) ? 1 : (ai.id === 2 ? 2 : 3);
        if (ai.inventory[prefW] && ai.inventory[prefW].unlocked && ai.inventory[prefW].ammo > 0) {
          ai.currentWeapon = prefW;
        } else {
          ai.currentWeapon = 0;
        }
      }

      if (bestTarget && ai.fireCooldown <= 0 && ai.bandagingTimer <= 0) {
        const aimAngle = Math.atan2(bestTarget.x - ai.x, bestTarget.z - ai.z);
        ai.rotY = aimAngle;
        fireWeapon(ai, Math.sin(aimAngle), Math.cos(aimAngle));
      }
    }

    function completeRevive(targetPlayer) {
      targetPlayer.downed = false;
      targetPlayer.hp = 60;
      targetPlayer.reviveProgress = 0;
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

    // =========================================================================
    // 17. SMART ZOMBIE WALL-SLIDING AI, AUTO-TURRET BARRICADES & BULLETS
    // =========================================================================
    function moveZombieSmart(z, nx, nz, speed, dt, target) {
      const step = speed * dt;
      const prevX = z.x;
      const prevZ = z.z;

      if ((z.slideTimer || 0) > 0 && z.slideDir !== 0) {
        z.slideTimer -= dt;
        const tx = -nz * z.slideDir;
        const tz = nx * z.slideDir;
        moveEntityWithCollision(z, (nx * 0.35 + tx * 0.92) * step, (nz * 0.35 + tz * 0.92) * step, z.radius);
        if (Math.hypot(z.x - prevX, z.z - prevZ) > step * 0.45) {
          z.group.rotation.y = Math.atan2(tx, tz);
          return;
        }
      }

      moveEntityWithCollision(z, nx * step, nz * step, z.radius);
      const moved = Math.hypot(z.x - prevX, z.z - prevZ);

      if (moved < step * 0.55) {
        const probeX = z.x + nx * (z.radius + 0.65);
        const probeZ = z.z + nz * (z.radius + 0.65);
        let hitOb = null;
        for (const ob of game.obstacles) {
          if (Math.abs(probeX - ob.x) < ob.hw + z.radius && Math.abs(probeZ - ob.z) < ob.hd + z.radius) {
            hitOb = ob;
            break;
          }
        }

        const t1x = -nz, t1z = nx;
        const t2x = nz, t2z = -nx;
        let pickSign = z.slideDir || 1;

        if (hitOb && target) {
          const p1x = z.x + t1x * 1.5, p1z = z.z + t1z * 1.5;
          const p2x = z.x + t2x * 1.5, p2z = z.z + t2z * 1.5;
          const b1 = isPointBlockedByWall(p1x, p1z, z.radius, false);
          const b2 = isPointBlockedByWall(p2x, p2z, z.radius, false);
          if (!b1 && b2) pickSign = 1;
          else if (b1 && !b2) pickSign = -1;
          else {
            const d1 = Math.hypot(target.x - p1x, target.z - p1z) + Math.hypot(p1x - hitOb.x, p1z - hitOb.z) * 0.25;
            const d2 = Math.hypot(target.x - p2x, target.z - p2z) + Math.hypot(p2x - hitOb.x, p2z - hitOb.z) * 0.25;
            pickSign = d1 <= d2 ? 1 : -1;
          }
        } else {
          const p1x = z.x + t1x * 1.2, p1z = z.z + t1z * 1.2;
          pickSign = !isPointBlockedByWall(p1x, p1z, z.radius, false) ? 1 : -1;
        }

        z.slideDir = pickSign;
        z.slideTimer = 0.55;
        const sx = -nz * pickSign;
        const sz = nx * pickSign;
        moveEntityWithCollision(z, sx * step * 1.05, sz * step * 1.05, z.radius);
        z.group.rotation.y = Math.atan2(sx, sz);
      }
    }

    function updateZombiesAndTurrets(dt) {
      const curRoom = game.rooms[game.currentRoomIndex];
      // [v3.1] 바리케이드 센트리 포탑: 내장 탄약 160~340발 + 기본 2마리 관통 + 탄약 소진 시 8초 자동 냉각/재장전 후 100% 재가동!
      game.barricades.forEach(bar => {
        if (!bar.hasTurret) return;
        if ((bar.reloadTimer || 0) > 0) {
          bar.reloadTimer -= dt;
          if (bar.reloadTimer <= 0) {
            bar.reloadTimer = 0;
            bar.turretAmmo = bar.maxTurretAmmo || 200;
          }
          return;
        }
        bar.turretCooldown = Math.max(0, bar.turretCooldown - dt);
        if (bar.turretCooldown <= 0 && game.zombies.length > 0) {
          let nearestIdx = -1, minD = bar.awakened ? (bar.turretRange || 14.0) : 7.5;
          game.zombies.forEach((z, idx) => {
            const d = Math.hypot(z.x - bar.x, z.z - bar.z);
            if (d < minD) { minD = d; nearestIdx = idx; }
          });
          if (nearestIdx >= 0) {
            bar.turretCooldown = bar.awakened ? 0.36 : 0.95;
            const zt = game.zombies[nearestIdx];
            const dx = zt.x - bar.x, dz = zt.z - bar.z;
            const dist = Math.hypot(dx, dz) || 1;
            const nx = dx / dist, nz = dz / dist;

            // 포탑 탄환 발사 (기본 2마리 관통!)
            const tMesh = new THREE.Mesh(
              SHARED_GEO.pistolTracer,
              new THREE.MeshBasicMaterial({ color: bar.awakened ? 0x22d3ee : 0xc084fc })
            );
            tMesh.position.set(bar.x, 1.95, bar.z);
            tMesh.rotation.y = Math.atan2(nx, nz);
            effectsGroup.add(tMesh);
            game.bullets.push({
              ownerId: bar.ownerId !== undefined ? bar.ownerId : mySlotIndex,
              wIdx: 6,
              tier1Special: bar.tier1Special,
              awakened: bar.awakened,
              noFriendlyFire: true,
              isZombieProjectile: false,
              x: bar.x, z: bar.z,
              vx: nx * 42, vz: nz * 42,
              damage: bar.turretDmg || 42,
              weakMult: 1.15,
              stun: bar.stunDur || 0.25,
              knockback: 0.65,
              explosiveRadius: 0,
              pierceLeft: 2,
              armorPen: !!bar.awakened,
              piercing: true,
              life: 0.45,
              mesh: tMesh
            });

            bar.turretAmmo = Math.max(0, (bar.turretAmmo || 160) - 1);
            if (bar.turretAmmo <= 0) {
              bar.reloadTimer = 8.0; // 8초 냉각 후 100% 탄약으로 재장전!
            }
          }
        }
      });

      for (let i = game.shockTrails.length - 1; i >= 0; i--) {
        const st = game.shockTrails[i];
        st.life -= dt;
        for (let zi = game.zombies.length - 1; zi >= 0; zi--) {
          const z = game.zombies[zi];
          if (Math.hypot(z.x - st.x, z.z - st.z) < st.radius) {
            damageZombie(zi, st.dmg * dt, 0, 0, 0.2, 5);
          }
        }
        if (st.life <= 0) {
          if (st.mesh) effectsGroup.remove(st.mesh);
          game.shockTrails.splice(i, 1);
        }
      }

      // [v3.2 특수개조 구현] 산탄총 30Lv 드래곤 브레스 화염장판 & 폭약통 30Lv 극저온 산성 장판 지속 피해 처리
      for (let i = game.flamePools.length - 1; i >= 0; i--) {
        const fp = game.flamePools[i];
        fp.life -= dt;
        fp.tickTimer = (fp.tickTimer || 0) - dt;
        if (fp.tickTimer <= 0) {
          fp.tickTimer = 0.35;
          for (let zi = game.zombies.length - 1; zi >= 0; zi--) {
            const z = game.zombies[zi];
            if (Math.hypot(z.x - fp.x, z.z - fp.z) <= fp.radius) {
              damageZombie(zi, Math.round(fp.dps * 0.35), 0, 0, fp.isCryo ? 0.65 : 0.15, fp.wIdx || 1);
              if (fp.isCryo && z) {
                z.freezeTimer = Math.max(z.freezeTimer || 0, 1.8);
                if (z.iceBlock) z.iceBlock.visible = true;
              }
            }
          }
        }
        if (fp.life <= 0) {
          if (fp.mesh) effectsGroup.remove(fp.mesh);
          game.flamePools.splice(i, 1);
        }
      }

      for (let i = game.zombies.length - 1; i >= 0; i--) {
        const z = game.zombies[i];
        z.attackCooldown = Math.max(0, z.attackCooldown - dt);
        if (z.mbGroggyTimer > 0) z.mbGroggyTimer = Math.max(0, z.mbGroggyTimer - dt);

        // [v3.2 특수개조 구현] 산탄총 15Lv 소이 산탄(3초 화상 지속피해) 처리
        if ((z.burnTimer || 0) > 0) {
          z.burnTimer -= dt;
          z.burnTick = (z.burnTick || 0) - dt;
          if (z.burnTick <= 0) {
            z.burnTick = 0.5;
            const prevLen = game.zombies.length;
            damageZombie(i, z.burnDps || 18, 0, 0, 0.05, 1);
            if (game.zombies.length < prevLen || !game.zombies[i]) continue;
          }
        }

        // [v3.1 극저온 완전 빙결 처리]
        if ((z.freezeTimer || 0) > 0) {
          z.freezeTimer -= dt;
          if (z.iceBlock) z.iceBlock.visible = true;
          z.group.position.set(z.x, 0, z.z);
          if (z.freezeTimer <= 0) {
            if (z.iceBlock) z.iceBlock.visible = false;
            if (typeof spawnIceShatterFX === "function") spawnIceShatterFX(z.x, z.z, 5);
          }
          continue;
        } else if (z.iceBlock && z.iceBlock.visible) {
          z.iceBlock.visible = false;
        }

        if (z.stunTimer > 0) {
          z.stunTimer -= dt;
          z.group.position.set(z.x, 0, z.z);
          continue;
        }
        if (z.spec.isNutrientHost) {
          z.group.position.set(z.x, 0, z.z);
          continue;
        }

        // 쓰러진(빈사) 사람에게는 좀비 어그로가 절대 끌리지 않고 오직 살아있는(!p.downed) 사람에게만 끌림!
        let target = null, minDist = 9999;
        game.players.forEach(p => {
          if (p.downed) return;
          const d = Math.hypot(p.x - z.x, p.z - z.z);
          if (d < minDist) { minDist = d; target = p; }
        });

        if (!target) {
          z.group.position.set(z.x, 0, z.z);
          continue;
        }
        const dx = target.x - z.x;
        const dz = target.z - z.z;
        const dist = Math.hypot(dx, dz) || 1;
        const nx = dx / dist, nz = dz / dist;
        z.group.rotation.y = Math.atan2(nx, nz);

        let blocked = false;
        for (let b = game.barricades.length - 1; b >= 0; b--) {
          const bar = game.barricades[b];
          if (Math.abs(z.x - bar.x) < bar.hw + z.radius + 0.45 && Math.abs(z.z - bar.z) < bar.hd + z.radius + 0.45) {
            blocked = true;
            if (z.attackCooldown <= 0) {
              bar.hp -= (z.scaledDmg || z.spec.dmg);
              z.attackCooldown = 0.85;
              // 바리케이드 피격 시 균열(Crack) 및 파손 상태 실시간 업데이트 + 파편 연출!
              updateBarricadeDamageVisual(bar);
              spawnBloodParticles(bar.x, 1.0, bar.z, 0x78716c, 2);
              damageZombie(i, bar.thornsDmg || 20, (z.x - bar.x) * 0.6, (z.z - bar.z) * 0.6, bar.stunDur || 0.22, 6);
              if (bar.hp <= 0) {
                spawnBloodParticles(bar.x, 1.0, bar.z, 0xef4444, 6);
                entitiesGroup.remove(bar.mesh);
                game.barricades.splice(b, 1);
              }
            }
            break;
          }
        }

        if (!blocked) {
          // 원거리 스핏터(SPITTER)는 플레이어와 11~19m 사거리를 유지하며 좌우로 선회(Kiting) 기동!
          if (z.spec.isSpitter && dist > 8.5 && dist < 17.5) {
            const strafeSign = (i % 2 === 0) ? 1 : -1;
            moveZombieSmart(z, -nz * strafeSign * 0.75, nx * strafeSign * 0.75, z.speed * 0.72, dt, target);
          } else if (dist > 1.35) {
            moveZombieSmart(z, nx, nz, z.speed, dt, target);
          } else if (z.attackCooldown <= 0) {
            z.attackCooldown = 0.95;
            if (z.spec.explosive) {
              damageZombie(i, 9999, 0, 0, 0, -1);
              continue;
            } else {
              const berserkDmgMult = (curRoom && curRoom.berserkActive) ? 1.35 : 1.0;
              damagePlayer(target, Math.round((z.scaledDmg || z.spec.dmg) * berserkDmgMult), !!z.spec.causesBleed, z.typeKey === "MB_ACIDQUEEN" || z.spec.isSpitter);
            }
          }
        }

        if (z.typeKey === "MB_JUGGERNAUT") {
          if ((z.chargeTimer || 0) > 0) {
            z.chargeTimer -= dt;
            moveEntityWithCollision(z, z.chargeDirX * z.speed * 3.2 * dt, z.chargeDirZ * z.speed * 3.2 * dt, z.radius);
            if (z.chargeTimer <= 0) {
              const slamRing = new THREE.Mesh(
                new THREE.RingGeometry(0.8, 7.2, 28),
                new THREE.MeshBasicMaterial({ color: 0xf97316, side: THREE.DoubleSide, transparent: true, opacity: 0.88 })
              );
              slamRing.rotation.x = -Math.PI / 2;
              slamRing.position.set(z.x, 0.2, z.z);
              effectsGroup.add(slamRing);
              game.particles.push({ mesh: slamRing, life: 0.45, maxLife: 0.45, expand: 1.5 });
              SoundFX.play("explosion");
              game.players.forEach(pl => {
                // [Space] 점프·회피(dashActiveTimer > 0) 중이면 저거넛 대지 분쇄 충격파를 점프로 무피해 회피!
                if (!pl.downed && Math.hypot(pl.x - z.x, pl.z - z.z) < 7.2) {
                  if (pl.dashActiveTimer > 0) {
                    pl.stamina = Math.min(getPlayerMaxStamina(pl), (pl.stamina || 0) + 25);
                  } else {
                    damagePlayer(pl, 32, true, false);
                  }
                }
              });
            }
          } else {
            z.specialTimer = (z.specialTimer || 4.0) - dt;
            if (z.specialTimer <= 0 && dist < 26.0) {
              z.specialTimer = 4.6;
              z.chargeTimer = 1.05; // 1.05초 돌진 중 [V] 전방위 기절기로 카운터 패링(4.2초 대그로기) 가능!
              z.chargeDirX = nx;
              z.chargeDirZ = nz;
              SoundFX.play("alarm");
            }
          }
        }

        // 중간보스 II(네크로 서모너) & III(애시드 퀸) 영창(Channeling) 패턴 — 영창 중 [V] 적중 시 카운터 패링, 발동 시 [Space] 점프로 바닥 파동 회피!
        if ((z.typeKey === "MB_SUMMONER" || z.typeKey === "MB_ACIDQUEEN") && (z.channelingTimer || 0) > 0) {
          z.channelingTimer -= dt;
          if (z.channelingTimer <= 0) {
            const isSummoner = z.typeKey === "MB_SUMMONER";
            const waveColor = isSummoner ? 0xa855f7 : 0x84cc16;
            const waveRing = new THREE.Mesh(
              new THREE.RingGeometry(1.0, 8.2, 32),
              new THREE.MeshBasicMaterial({ color: waveColor, side: THREE.DoubleSide, transparent: true, opacity: 0.85 })
            );
            waveRing.rotation.x = -Math.PI / 2;
            waveRing.position.set(z.x, 0.22, z.z);
            effectsGroup.add(waveRing);
            game.particles.push({ mesh: waveRing, life: 0.5, maxLife: 0.5, expand: 1.4 });
            SoundFX.play("explosion");

            // 바닥 충격파: [Space] 점프(dashActiveTimer > 0) 중이면 완벽 회피!
            game.players.forEach(pl => {
              if (!pl.downed && Math.hypot(pl.x - z.x, pl.z - z.z) < 8.2) {
                if (pl.dashActiveTimer > 0) {
                  pl.stamina = Math.min(getPlayerMaxStamina(pl), (pl.stamina || 0) + 25);
                } else {
                  damagePlayer(pl, 24, false, !isSummoner);
                }
              }
            });

            if (isSummoner) {
              if (game.zombies.length < 180) {
                spawnZombie("BOOMER", z.x + 2.2, z.z, z.roomIndex);
                spawnZombie("RUNNER", z.x - 2.2, z.z, z.roomIndex);
              }
              const baseA = Math.atan2(nx, nz);
              for (let f = -3; f <= 3; f++) {
                const a = baseA + f * 0.16;
                const orb = new THREE.Mesh(
                  new THREE.SphereGeometry(0.42, 8, 8),
                  new THREE.MeshBasicMaterial({ color: 0xa855f7 })
                );
                orb.position.set(z.x, 1.25, z.z);
                effectsGroup.add(orb);
                game.bullets.push({
                  ownerId: -1,
                  isZombieProjectile: true,
                  causesAcid: false,
                  x: z.x, z: z.z,
                  vx: Math.sin(a) * 10.8, vz: Math.cos(a) * 10.8,
                  damage: 19,
                  explosiveRadius: 0,
                  piercing: false,
                  life: 2.6,
                  mesh: orb
                });
              }
            } else {
              const baseA = Math.atan2(nx, nz);
              for (let f = -2; f <= 2; f++) {
                const a = baseA + f * 0.20;
                const fbMesh = new THREE.Mesh(
                  new THREE.SphereGeometry(0.45, 8, 8),
                  new THREE.MeshBasicMaterial({ color: 0x84cc16 })
                );
                fbMesh.position.set(z.x, 1.25, z.z);
                effectsGroup.add(fbMesh);
                game.bullets.push({
                  ownerId: -1,
                  isZombieProjectile: true,
                  causesAcid: true,
                  x: z.x, z: z.z,
                  vx: Math.sin(a) * 11.0, vz: Math.cos(a) * 11.0,
                  damage: 20,
                  explosiveRadius: 0,
                  piercing: false,
                  life: 2.5,
                  mesh: fbMesh
                });
              }
              const poolMesh = new THREE.Mesh(
                new THREE.CircleGeometry(3.0, 18),
                new THREE.MeshBasicMaterial({ color: 0x84cc16, transparent: true, opacity: 0.65 })
              );
              poolMesh.rotation.x = -Math.PI / 2;
              poolMesh.position.set(target.x, 0.06, target.z);
              effectsGroup.add(poolMesh);
              game.acidPools.push({ x: target.x, z: target.z, radius: 3.0, life: 6.5, mesh: poolMesh });
            }
          }
        } else if (z.spec.ranged && dist < 26.0) {
          z.rangedCooldown -= dt;
          if (z.rangedCooldown <= 0) {
            z.rangedCooldown = z.spec.isMidBoss ? 3.6 : 3.1;
            if (z.typeKey === "MB_SUMMONER" || z.typeKey === "MB_ACIDQUEEN") {
              // 1.35초 영창 예고 링 생성 (이때 접근하여 [V] 기절기를 누르면 패턴 캔슬 + 4.2초 대그로기!)
              z.channelingTimer = 1.35;
              const warnC = z.typeKey === "MB_SUMMONER" ? 0xc084fc : 0xa3e635;
              const warnRing = new THREE.Mesh(
                new THREE.RingGeometry(1.5, 4.8, 24),
                new THREE.MeshBasicMaterial({ color: warnC, side: THREE.DoubleSide, transparent: true, opacity: 0.75 })
              );
              warnRing.rotation.x = -Math.PI / 2;
              warnRing.position.set(z.x, 0.15, z.z);
              effectsGroup.add(warnRing);
              game.particles.push({ mesh: warnRing, life: 1.35, maxLife: 1.35, expand: 0.35 });
              SoundFX.play("alarm");
            } else if (z.spec.isSpitter) {
              // 맹독 스핏터(SPITTER): 청록색 맹독 산성 침 발사 (피격 시 산성 둔화 유발!)
              const spitMesh = new THREE.Mesh(
                new THREE.SphereGeometry(0.34, 8, 8),
                new THREE.MeshBasicMaterial({ color: 0x06b6d4 })
              );
              spitMesh.position.set(z.x, 1.25, z.z);
              effectsGroup.add(spitMesh);
              game.bullets.push({
                ownerId: -1,
                isZombieProjectile: true,
                causesAcid: true,
                x: z.x, z: z.z,
                vx: nx * 10.6, vz: nz * 10.6,
                damage: 14,
                explosiveRadius: 0,
                piercing: false,
                life: 2.3,
                mesh: spitMesh
              });
            } else {
              // 블러드 데빌(DEVIL): 3갈래 부채꼴 화염 혈탄 발사!
              const baseA = Math.atan2(nx, nz);
              for (let f = -1; f <= 1; f++) {
                const a = baseA + f * 0.16;
                const fbMesh = new THREE.Mesh(
                  new THREE.SphereGeometry(0.32, 8, 8),
                  new THREE.MeshBasicMaterial({ color: 0xf97316 })
                );
                fbMesh.position.set(z.x, 1.25, z.z);
                effectsGroup.add(fbMesh);
                game.bullets.push({
                  ownerId: -1,
                  isZombieProjectile: true,
                  causesAcid: false,
                  x: z.x, z: z.z,
                  vx: Math.sin(a) * 11.2, vz: Math.cos(a) * 11.2,
                  damage: 16,
                  explosiveRadius: 0,
                  piercing: false,
                  life: 2.2,
                  mesh: fbMesh
                });
              }
            }
          }
        }

        z.group.position.set(z.x, 0, z.z);
      }

      // =====================================================================
      // 좀비 간 겹침 방지 물리 충돌 분리 (Pairwise Zombie-to-Zombie Separation)
      // - 좀비끼리 서로 겹치지 않고 밀어내며 자연스러운 포위 진형을 형성하도록 보정!
      // =====================================================================
      const zCount = game.zombies.length;
      for (let i = 0; i < zCount; i++) {
        const z1 = game.zombies[i];
        for (let j = i + 1; j < zCount; j++) {
          const z2 = game.zombies[j];
          const dx = z2.x - z1.x;
          const dz = z2.z - z1.z;
          const minSep = (z1.radius + z2.radius) * 1.15;
          if (Math.abs(dx) >= minSep || Math.abs(dz) >= minSep) continue;

          const distSq = dx * dx + dz * dz;
          if (distSq < minSep * minSep) {
            const dist = Math.sqrt(distSq) || 0.01;
            const overlap = (minSep - dist) * 0.55;
            const sx = (dx / dist) * overlap;
            const sz = (dz / dist) * overlap;

            const w1 = z1.spec.isMidBoss ? 0.15 : 0.5;
            const w2 = z2.spec.isMidBoss ? 0.15 : 0.5;
            moveEntityWithCollision(z1, -sx * w1, -sz * w1, z1.radius);
            moveEntityWithCollision(z2, sx * w2, sz * w2, z2.radius);
          }
        }

        // 살아있는 플레이어와도 최소 물리 반경 유지 (좀비가 캐릭터 모델 안으로 완전히 포개지지 않도록 함)
        game.players.forEach(pl => {
          if (pl.downed) return;
          const pdx = z1.x - pl.x;
          const pdz = z1.z - pl.z;
          const pMin = z1.radius + 0.52;
          if (Math.abs(pdx) < pMin && Math.abs(pdz) < pMin) {
            const pDist = Math.hypot(pdx, pdz) || 0.01;
            if (pDist < pMin) {
              const push = (pMin - pDist) * 0.65;
              moveEntityWithCollision(z1, (pdx / pDist) * push, (pdz / pDist) * push, z1.radius);
            }
          }
        });

        z1.group.position.set(z1.x, 0, z1.z);
      }
    }

    function updateBossHazards(dt) {
      for (let i = game.tentacles.length - 1; i >= 0; i--) {
        const t = game.tentacles[i];
        t.timer -= dt;
        if (!t.erupted && t.timer <= 0) {
          t.erupted = true;
          t.timer = 0.65;
          effectsGroup.remove(t.mesh);
          const spikeMesh = new THREE.Mesh(
            new THREE.ConeGeometry(1.3, 4.6, 8),
            new THREE.MeshStandardMaterial({ color: 0x881337, roughness: 0.4 })
          );
          spikeMesh.position.set(t.x, 2.3, t.z);
          effectsGroup.add(spikeMesh);
          t.mesh = spikeMesh;
          game.players.forEach(p => {
            if (!p.downed && Math.hypot(p.x - t.x, p.z - t.z) < 2.2) damagePlayer(p, 26, true, false);
          });
        } else if (t.erupted && t.timer <= 0) {
          effectsGroup.remove(t.mesh);
          game.tentacles.splice(i, 1);
        }
      }

      for (let i = game.cystPods.length - 1; i >= 0; i--) {
        const pod = game.cystPods[i];
        pod.timer -= dt;
        if (pod.hp <= 0) {
          entitiesGroup.remove(pod.mesh);
          spawnBloodParticles(pod.x, 1.0, pod.z, 0xa3e635, 4);
          if (pod.isBioCapsule) {
            // [v3.1] 배양 캡슐 파괴 시 반경 5.8m 냉각 충격파가 터지며 주변 감염체 4초간 급속 빙결/기절!
            SoundFX.play("explosion");
            const cryoRing = new THREE.Mesh(
              new THREE.RingGeometry(0.6, 5.8, 28),
              new THREE.MeshBasicMaterial({ color: 0x22d3ee, side: THREE.DoubleSide, transparent: true, opacity: 0.85 })
            );
            cryoRing.rotation.x = -Math.PI / 2;
            cryoRing.position.set(pod.x, 0.2, pod.z);
            effectsGroup.add(cryoRing);
            game.particles.push({ mesh: cryoRing, life: 0.45, maxLife: 0.45, expand: 1.2 });
            game.zombies.forEach((z, zi) => {
              if (Math.hypot(z.x - pod.x, z.z - pod.z) <= 5.8) {
                damageZombie(zi, 145, 0, 0, 4.0, 7);
              }
            });
          } else if (pod.isMissionHive) {
            const r = game.rooms[pod.roomIndex];
            if (r && (r.condType === "HIVE_NODES" || r.condType === "EXTERMINATE")) {
              r.progress++;
              if (r.progress < r.targetVal) {
                advanceRoomMissionStage(
                  r,
                  pod.stepOrder || r.progress,
                  `✅ 목표 구조물 #${pod.stepOrder || r.progress} 수색·파괴 완료! 다음 웨이브를 막으면 새로운 무작위 위치에 다음 목표가 출현합니다!`
                );
              } else {
                r.completedStage = r.targetVal;
              }
              checkRoomClear(r);
            }
          } else if (pod.isMidBossShieldNode && pod.parentMidBoss) {
            const mb = pod.parentMidBoss;
            const remaining = game.cystPods.filter((other, idx) => idx !== i && other.isMidBossShieldNode && other.parentMidBoss === mb);
            if (remaining.length === 0) {
              mb.mbShieldActive = false;
              mb.mbGroggyTimer = 6.0;
              mb.stunTimer = 4.0;
              if (mb.mbShieldMesh) mb.mbShieldMesh.material.opacity = 0.0;
              SoundFX.play("revive");
            }
          }
          game.cystPods.splice(i, 1);
        } else if (!pod.isMissionHive && !pod.isMidBossShieldNode && pod.timer <= 0) {
          entitiesGroup.remove(pod.mesh);
          spawnZombie("BOOMER", pod.x, pod.z, game.rooms.length - 1);
          game.cystPods.splice(i, 1);
        }
      }

      for (let i = game.acidPools.length - 1; i >= 0; i--) {
        const pool = game.acidPools[i];
        pool.life -= dt;
        if (pool.life <= 0) {
          effectsGroup.remove(pool.mesh);
          game.acidPools.splice(i, 1);
        }
      }
    }

    function updateBullets(dt) {
      const curRoom = game.rooms[game.currentRoomIndex];
      const unlockStg = curRoom ? (curRoom.unlockStage || 0) : 0;

      for (let i = game.bullets.length - 1; i >= 0; i--) {
        const b = game.bullets[i];
        b.life -= dt;
        b.x += b.vx * dt;
        b.z += b.vz * dt;
        b.mesh.position.set(b.x, 1.15, b.z);

        let removeBullet = b.life <= 0;

        const canPierceBarricade = !b.isZombieProjectile && (b.piercing || (b.pierceLeft || 1) > 1);
        if (isPointBlockedByWall(b.x, b.z, 0.15, canPierceBarricade)) {
          if (b.explosiveRadius > 0) {
            triggerExplosion(b.x, b.z, b.explosiveRadius, b.damage, b.ownerId, b.awakened, 0, b.tier1Special);
          }
          removeBullet = true;
        }

        if (!removeBullet && b.isZombieProjectile) {
          for (const pl of game.players) {
            if (!pl.downed && Math.hypot(pl.x - b.x, pl.z - b.z) < 0.8) {
              damagePlayer(pl, b.damage, false, !!b.causesAcid);
              removeBullet = true;
              break;
            }
          }
        }

        if (!removeBullet && !b.isZombieProjectile) {
          for (let br = game.barrels.length - 1; br >= 0; br--) {
            const barrel = game.barrels[br];
            if (Math.hypot(barrel.x - b.x, barrel.z - b.z) < barrel.radius + 0.45) {
              detonateCryoBarrel(barrel, b.ownerId);
              removeBullet = true;
              break;
            }
          }

          if (!removeBullet && game.friendlyFire && !b.noFriendlyFire) {
            for (const pl of game.players) {
              if (pl.id !== b.ownerId && !pl.downed && Math.hypot(pl.x - b.x, pl.z - b.z) < 0.65) {
                if (b.explosiveRadius > 0) {
                  triggerExplosion(b.x, b.z, b.explosiveRadius, b.damage, b.ownerId, b.awakened, 0, b.tier1Special);
                } else {
                  const ffDmg = Math.max(4, Math.round(b.damage * 0.25));
                  game.totalFriendlyFireDmg += ffDmg;
                  damagePlayer(pl, ffDmg, false, false);
                }
                removeBullet = true;
                break;
              }
            }
          }

          if (!removeBullet) {
            for (let zIdx = game.zombies.length - 1; zIdx >= 0; zIdx--) {
              const zmb = game.zombies[zIdx];
              if (Math.hypot(zmb.x - b.x, zmb.z - b.z) < zmb.radius + 0.4) {
                if (b.explosiveRadius > 0) {
                  triggerExplosion(b.x, b.z, b.explosiveRadius, b.damage, b.ownerId, b.awakened, 0, b.tier1Special);
                  removeBullet = true;
                  break;
                } else {
                  const armorMult = (zmb.spec.armored && !b.armorPen) ? 0.62 : 1.0;
                  // [v3.2 특수개조 구현] 산탄총 15Lv 소이 산탄(3초 화상 지속피해) & 30Lv 드래곤 브레스(3.5초 고열 화염장판)
                  if (b.wIdx === 1 && (b.tier1Special || b.awakened)) {
                    zmb.burnTimer = 3.0;
                    zmb.burnDps = Math.max(12, Math.round(b.damage * 0.45));
                    if (b.awakened && game.flamePools.length < 18 && !game.flamePools.some(fp => Math.hypot(fp.x - b.x, fp.z - b.z) < 2.2)) {
                      const fMesh = new THREE.Mesh(
                        new THREE.CircleGeometry(2.6, 18),
                        new THREE.MeshBasicMaterial({ color: 0xf97316, transparent: true, opacity: 0.55 })
                      );
                      fMesh.rotation.x = -Math.PI / 2;
                      fMesh.position.set(b.x, 0.06, b.z);
                      effectsGroup.add(fMesh);
                      game.flamePools.push({
                        x: b.x,
                        z: b.z,
                        radius: 2.6,
                        dps: Math.max(25, Math.round(b.damage * 0.85)),
                        life: 3.5,
                        isCryo: false,
                        wIdx: 1,
                        mesh: fMesh
                      });
                    }
                  }
                  damageZombie(zIdx, Math.round(b.damage * armorMult), b.vx * 0.04 * b.knockback, b.vz * 0.04 * b.knockback, b.stun, b.wIdx);

                  if (b.wIdx === 2 && (b.tier1Special || b.awakened) && game.zombies.length > 1) {
                    let chains = 0;
                    const maxC = b.awakened ? 3 : 1;
                    for (let c = game.zombies.length - 1; c >= 0 && chains < maxC; c--) {
                      if (c !== zIdx && game.zombies[c] && Math.hypot(game.zombies[c].x - b.x, game.zombies[c].z - b.z) < 5.5) {
                        damageZombie(c, Math.round(b.damage * (b.awakened ? 0.65 : 0.45)), 0, 0, b.awakened ? 0.35 : 0.15, 2);
                        chains++;
                      }
                    }
                  }

                  if (b.wIdx === 3 && (b.tier1Special || b.awakened)) {
                    const rad = b.awakened ? 3.8 : 2.0;
                    for (let c = game.zombies.length - 1; c >= 0; c--) {
                      if (c !== zIdx && game.zombies[c] && Math.hypot(game.zombies[c].x - b.x, game.zombies[c].z - b.z) < rad) {
                        damageZombie(c, Math.round(b.damage * (b.awakened ? 0.55 : 0.32)), 0, 0, 0.25, 3);
                      }
                    }
                  }

                  if (b.wIdx === 0 && (b.tier1Special || b.awakened)) {
                    for (let c = game.zombies.length - 1; c >= 0; c--) {
                      if (c !== zIdx && game.zombies[c] && Math.hypot(game.zombies[c].x - b.x, game.zombies[c].z - b.z) < 2.0) {
                        damageZombie(c, Math.round(b.damage * 0.35), 0, 0, 0.25, 0);
                      }
                    }
                  }

                  b.pierceLeft = (b.pierceLeft || 1) - 1;
                  if (b.pierceLeft <= 0) {
                    removeBullet = true;
                    break;
                  }
                }
              }
            }
          }

          if (!removeBullet) {
            for (const pod of game.cystPods) {
              if (Math.hypot(pod.x - b.x, pod.z - b.z) < 1.55) {
                // 순차 웨이브 잠금된 미션 신경절은 해금 단계(unlockStage) 도달 전까지 피해 면역!
                if (pod.isMissionHive && (pod.stepOrder || 1) > unlockStg) {
                  removeBullet = true;
                  break;
                }
                pod.hp -= b.damage;
                if (!b.piercing) removeBullet = true;
                break;
              }
            }
          }
          if (!removeBullet) {
            for (const pyl of game.bloodPylons) {
              if (Math.hypot(pyl.x - b.x, pyl.z - b.z) < 1.6) {
                pyl.hp -= b.damage;
                if (!b.piercing) removeBullet = true;
                break;
              }
            }
          }

          if (!removeBullet && game.boss && game.boss.active && !game.boss.dead) {
            if (Math.hypot(game.boss.x - b.x, game.boss.z - b.z) < game.boss.radius) {
              if (b.explosiveRadius > 0) {
                triggerExplosion(b.x, b.z, b.explosiveRadius, b.damage, b.ownerId, b.awakened);
              } else {
                damageBoss(Math.round(b.damage * (b.weakMult || 1.2)));
              }
              removeBullet = true;
            }
          }
        }

        if (removeBullet) {
          effectsGroup.remove(b.mesh);
          game.bullets.splice(i, 1);
        }
      }
    }

    function updateCratesAndPickups(dt) {
      for (let i = game.crates.length - 1; i >= 0; i--) {
        const c = game.crates[i];
        if (c.opened) continue;
        const touchingPlayer = game.players.find(p => !p.downed && Math.hypot(p.x - c.x, p.z - c.z) < 2.1);
        if (touchingPlayer) {
          c.opened = true;
          entitiesGroup.remove(c.group);
          SoundFX.play("pickup");
          grantSupplyReward(touchingPlayer, false);
          // [v3.2 무기 해금 설계] 각 섹터의 1번 보급상자(청색)는 ⚙️무기 부품 +1개 100% 확정 지급, 2번 보급상자는 50% 확률 지급!
          const getsPart = (c.crateOrder === 0) || (Math.random() < 0.50);
          if (getsPart) {
            game.weaponParts = (game.weaponParts || 0) + 1;
            const safeBanner = document.getElementById("hud-safe-banner");
            if (safeBanner) {
              document.getElementById("hud-safe-banner-text").textContent =
                `📦 보급상자 개방! 전 총기 탄약 보충 + ⚙️무기 부품 1개 획득! (보유 부품: ${game.weaponParts}개)`;
              safeBanner.classList.remove("hidden");
              setTimeout(() => safeBanner.classList.add("hidden"), 4000);
            }
          }
          if (!document.getElementById("upgrade-modal").classList.contains("hidden")) renderUpgradeModal();
        }
      }

      for (let i = game.pickups.length - 1; i >= 0; i--) {
        const pk = game.pickups[i];
        pk.mesh.rotation.y += dt * 2.5;
        const tp = game.players.find(p => !p.downed && Math.hypot(p.x - pk.x, p.z - pk.z) < 1.85);
        if (tp) {
          if (pk.kind === "CORE") {
            game.coreSamples = (game.coreSamples || 0) + 1;
            SoundFX.play("revive");
            const safeBanner = document.getElementById("hud-safe-banner");
            if (safeBanner) {
              document.getElementById("hud-safe-banner-text").textContent =
                `🧬 [변이 코어] 직접 획득 완료! (보유 코어: ${game.coreSamples}개 — 무기고에서 15/30/45Lv 코어개조 가능)`;
              safeBanner.classList.remove("hidden");
              setTimeout(() => safeBanner.classList.add("hidden"), 5500);
            }
          } else {
            SoundFX.play("pickup");
            if (pk.kind === "MEDKIT") tp.medkits = Math.min(getPlayerMaxMedkits(tp), tp.medkits + 1);
            else if (pk.kind === "STIM") tp.stims = Math.min(getPlayerMaxStims(tp), tp.stims + 1);
            else if (pk.kind === "PART") game.weaponParts = (game.weaponParts || 0) + 1;
            else {
              tp.inventory.forEach((inv, wIdx) => {
                if (inv.unlocked && !WEAPONS[wIdx].infinite) {
                  const maxA = getWeaponMaxAmmo(tp, wIdx);
                  inv.ammo = Math.min(maxA, inv.ammo + Math.ceil(WEAPONS[wIdx].packAmmo * 0.5));
                }
              });
            }
          }
          entitiesGroup.remove(pk.mesh);
          game.pickups.splice(i, 1);
          if (tp.id === mySlotIndex) {
            updateWeaponSlotsHUD();
            if (!document.getElementById("upgrade-modal").classList.contains("hidden")) renderUpgradeModal();
          }
        }
      }
    }

    function grantSupplyReward(player, unlockNewWeapon) {
      if (unlockNewWeapon) {
        const lockedIndices = [];
        for (let i = 1; i < WEAPONS.length; i++) {
          if (!player.inventory[i].unlocked) lockedIndices.push(i);
        }
        if (lockedIndices.length > 0) {
          const pick = lockedIndices[Math.floor(Math.random() * lockedIndices.length)];
          player.inventory[pick].unlocked = true;
          player.inventory[pick].ammo = WEAPONS[pick].startAmmo;
          if (!player.downed && !player.carryingPayload) player.currentWeapon = pick;
        }
      }
      player.inventory.forEach((inv, wIdx) => {
        if (inv.unlocked && !WEAPONS[wIdx].infinite) {
          const maxA = getWeaponMaxAmmo(player, wIdx);
          inv.ammo = Math.min(maxA, inv.ammo + WEAPONS[wIdx].packAmmo);
        }
      });
      if (player.id === mySlotIndex) updateWeaponSlotsHUD();
    }

    function isPointBlockedByWall(x, z, r, ignoreBarricades) {
      for (const ob of game.obstacles) {
        if (Math.abs(x - ob.x) < ob.hw + r && Math.abs(z - ob.z) < ob.hd + r) return true;
      }
      for (const d of game.doors) {
        if (!d.open && Math.abs(x - d.x) < d.w / 2 + r && Math.abs(z - d.z) < d.d / 2 + r) return true;
      }
      if (!ignoreBarricades) {
        for (const bar of game.barricades) {
          if (Math.abs(x - bar.x) < bar.hw + r && Math.abs(z - bar.z) < bar.hd + r) return true;
        }
      }
      return false;
    }

    function moveEntityWithCollision(ent, dx, dz, radius, ignoreBarricades) {
      if (!isPointBlockedByWall(ent.x + dx, ent.z, radius, ignoreBarricades)) ent.x += dx;
      if (!isPointBlockedByWall(ent.x, ent.z + dz, radius, ignoreBarricades)) ent.z += dz;
    }

