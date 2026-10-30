/**
 * =========================================================================
 * BOXHEAD: THE CORE v3.6 — Frontend Module: 06d_boss_ai.js
 * Final Boss 'The Core' AI, Invulnerability Mechanics, Patterns & Hazards
 * Zero-Loss Refactored Architecture (Shared Global Lexical Scope)
 * =========================================================================
 */
"use strict";

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
      if ((b.armorShredTimer || 0) > 0) b.armorShredTimer = Math.max(0, b.armorShredTimer - dt);

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
          b.lastPatternText = "⚡ GROGGY (2.2x DMG)";
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
                // [v3.3] 보스 고출력 회전 레이저 피격 시 감전 상태이상(causesShock = true) 부여!
                damagePlayer(p, 35 * dt, false, false, true, false);
              }
            }
          }
        });

        if (game.laserTimer <= 0) {
          b.invulnState = "NONE";
          b.shielded = false;
          b.laserGroup.visible = false;
          b.groggyTimer = 8.0;
          b.lastPatternText = "⚡ GROGGY (2.2x DMG)";
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
          b.lastPatternText = "⚡ GROGGY (2.2x DMG)";
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
        const activeSquadCount = (game.players || []).filter(p => p.role !== "EMPTY").length || 1;
        const podHp = Math.round(950 * (1.0 + Math.max(0, activeSquadCount - 1) * 0.65));
        for (let i = 0; i < 3; i++) {
          const px = bossRoom.wx + (Math.random() - 0.5) * 32;
          const pz = bossRoom.wz + (Math.random() - 0.5) * 32;
          const podMesh = new THREE.Mesh(
            new THREE.DodecahedronGeometry(1.1, 1),
            new THREE.MeshStandardMaterial({ color: 0xa3e635, emissive: 0x3f6212, roughness: 0.3 })
          );
          podMesh.position.set(px, 1.0, pz);
          entitiesGroup.add(podMesh);
          game.cystPods.push({ x: px, z: pz, hp: podHp, isMissionHive: false, timer: 8.0, mesh: podMesh });
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
        const activeSquadCount = (game.players || []).filter(p => p.role !== "EMPTY").length || 1;
        b.grappleHp = Math.round(1800 * (1.0 + Math.max(0, activeSquadCount - 1) * 0.65));
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
          spawnBloodParticles(pod.x, 1.0, pod.z, 0xa3e635, 6);
          spawnMissionStageVFX(pod.x, pod.z, 0xf43f5e, 5.8, 18, false);
          SoundFX.play("explosion");
          if (pod.isMissionHive) {
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
          if (!isRemoteClient) spawnZombie("BOOMER", pod.x, pod.z, game.rooms.length - 1);
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
