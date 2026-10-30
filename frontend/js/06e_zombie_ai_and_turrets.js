/**
 * =========================================================================
 * BOXHEAD: THE CORE v3.6 — Frontend Module: 06e_zombie_ai_and_turrets.js
 * Smart Zombie Wall-Sliding AI, Mid-Boss Patterns, Sentry Turrets & Separation
 * Zero-Loss Refactored Architecture (Shared Global Lexical Scope)
 * =========================================================================
 */
"use strict";

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

    function updateBarricadeTurrets(dt) {
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
            const zt = game.zombies[nearestIdx];
            if (zt) {
              bar.turretCooldown = bar.awakened ? 0.36 : 0.95;
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
        }
      });
    }

    function updateShockAndFlameGroundPools(dt) {
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
    }

    function updateZombiesAIAndCombat(dt, curRoom) {
      for (let i = game.zombies.length - 1; i >= 0; i--) {
        const z = game.zombies[i];
        if (!z) continue;
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

        // [v3.4 30Lv 코어 각성: 장갑 파쇄 타이머]
        if ((z.armorShredTimer || 0) > 0) {
          z.armorShredTimer = Math.max(0, z.armorShredTimer - dt);
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

        // [v3.5 멀티플레이 클라이언트 실시간 60FPS 부드러운 위치/회전각 보간]
        // 호스트의 권위 목표 좌표 및 실제 회전 각도(netTargetRotY)를 향해 매끄럽게 Lerp 보간!
        if (isRemoteClient) {
          if (z.netTargetX !== undefined && z.netTargetZ !== undefined) {
            const zDist = Math.hypot(z.netTargetX - z.x, z.netTargetZ - z.z);
            if (zDist > 8.0) {
              z.x = z.netTargetX;
              z.z = z.netTargetZ;
            } else {
              const zLerp = Math.min(1.0, dt * 18);
              z.x += (z.netTargetX - z.x) * zLerp;
              z.z += (z.netTargetZ - z.z) * zLerp;
            }
          }
          if (z.netTargetRotY !== undefined && z.group) {
            let diffRot = z.netTargetRotY - z.group.rotation.y;
            while (diffRot < -Math.PI) diffRot += Math.PI * 2;
            while (diffRot > Math.PI) diffRot -= Math.PI * 2;
            z.group.rotation.y += diffRot * Math.min(1.0, dt * 18);
          }
          z.group.position.set(z.x, 0, z.z);
          continue;
        }

        // 쓰러진(빈사) 사람이나 은신(Phantom Scout Cloaked) 중인 대원에게는 좀비 어그로가 절대 끌리지 않음!
        let target = null, minDist = 9999;
        game.players.forEach(p => {
          if (p.downed) return;
          if (p.cloakActive && p.specActiveTimer > 0) return;
          const d = Math.hypot(p.x - z.x, p.z - z.z);
          if (d < minDist) { minDist = d; target = p; }
        });

        if (!target) {
          // 어그로 대상이 없으면 천천히 배회(Wander)
          z.wanderAngle = (z.wanderAngle || (Math.random() * Math.PI * 2)) + (Math.random() - 0.5) * dt * 2.0;
          const wx = Math.cos(z.wanderAngle);
          const wz = Math.sin(z.wanderAngle);
          moveZombieSmart(z, wx, wz, z.speed * 0.28, dt, null);
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
              // 반사딜(thornsDmg)은 중반(5섹터+) 강화 또는 15Lv 코어개조 시에만 작동!
              updateBarricadeDamageVisual(bar);
              spawnBloodParticles(bar.x, 1.0, bar.z, 0x78716c, 2);
              if ((bar.thornsDmg || 0) > 0) {
                damageZombie(i, bar.thornsDmg, (z.x - bar.x) * 0.6, (z.z - bar.z) * 0.6, bar.stunDur || 0.22, 6);
              } else {
                moveEntityWithCollision(z, (z.x - bar.x) * 0.14, (z.z - bar.z) * 0.14, z.radius);
              }
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
            if (target.cloakActive && target.specActiveTimer > 0) {
              continue;
            }
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
                  // [v3.3] 서모너 방출 파동은 감전(causesShock = true), 스피터 자폭은 산성 부식 부여!
                  damagePlayer(pl, 24, false, !isSummoner, isSummoner, false);
                }
              }
            });

            if (isSummoner) {
              if (!isRemoteClient && game.zombies.length < 180) {
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
    }

    function resolveZombieAndPlayerCollisions() {
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

        // 살아있는 플레이어와도 최소 물리 반경 유지 (선봉장 불도저 밀치기 vs 일반 대원 이동 차단)
        game.players.forEach(pl => {
          if (pl.downed) return;
          const pdx = z1.x - pl.x;
          const pdz = z1.z - pl.z;
          const pMin = z1.radius + 0.52;
          if (Math.abs(pdx) < pMin && Math.abs(pdz) < pMin) {
            const pDist = Math.hypot(pdx, pdz) || 0.01;
            if (pDist < pMin) {
              const overlap = pMin - pDist;
              if (pl.specialization === "JUGGERNAUT") {
                // 선봉장(Juggernaut)은 질주 시 좀비들을 밀치고 뚫고 나감 (불도저)
                const pushZ = overlap * 0.85;
                moveEntityWithCollision(z1, (pdx / pDist) * pushZ, (pdz / pDist) * pushZ, z1.radius);
              } else {
                // 일반 클래스는 좀비에게 진로가 막힘 (좀비를 통과할 수 없고 밀려남)
                const pushPl = overlap * 0.7;
                pl.x -= (pdx / pDist) * pushPl;
                pl.z -= (pdz / pDist) * pushPl;
                if (pl.visual && pl.visual.group) pl.visual.group.position.set(pl.x, 0, pl.z);
              }
            }
          }
        });

        z1.group.position.set(z1.x, 0, z1.z);
      }
    }

    function updateZombiesAndTurrets(dt) {
      const curRoom = game.rooms[game.currentRoomIndex];
      updateBarricadeTurrets(dt);
      updateShockAndFlameGroundPools(dt);
      updateZombiesAIAndCombat(dt, curRoom);
      resolveZombieAndPlayerCollisions();
    }
