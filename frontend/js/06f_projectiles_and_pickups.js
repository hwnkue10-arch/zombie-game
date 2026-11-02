/**
 * =========================================================================
 * BOXHEAD: THE CORE v3.6 — Frontend Module: 06f_projectiles_and_pickups.js
 * Bullet Physics, Supply Crates, Pickups & Wall/Obstacle Collision Solver
 * Zero-Loss Refactored Architecture (Shared Global Lexical Scope)
 * =========================================================================
 */
"use strict";

    function updateBullets(dt) {
      const curRoom = game.rooms[game.currentRoomIndex];
      const unlockStg = curRoom ? (curRoom.unlockStage || 0) : 0;

      for (let i = game.bullets.length - 1; i >= 0; i--) {
        const b = game.bullets[i];
        if (!b) continue;
        b.life -= dt;
        b.x += b.vx * dt;
        b.z += b.vz * dt;
        b.mesh.position.set(b.x, 1.15, b.z);

        let removeBullet = b.life <= 0;

        // 외벽 및 방폭문 충돌 검사 (바리케이드는 별도 전술 관통 로직으로 처리)
        if (isPointBlockedByWall(b.x, b.z, 0.15, true)) {
          if (b.explosiveRadius > 0) {
            triggerExplosion(b.x, b.z, b.explosiveRadius, b.damage, b.ownerId, b.awakened, 0, b.tier1Special);
          }
          removeBullet = true;
        }

        // 전술 바리케이드 충돌 & 아군 탄환 관통(화력 증폭) 판정
        if (!removeBullet) {
          if (b.isZombieProjectile) {
            for (const bar of game.barricades) {
              if (Math.abs(b.x - bar.x) < bar.hw + 0.25 && Math.abs(b.z - bar.z) < bar.hd + 0.25) {
                bar.hp -= b.damage;
                updateBarricadeDamageVisual(bar);
                spawnBloodParticles(b.x, 1.15, b.z, 0x84cc16, 3);
                removeBullet = true;
                break;
              }
            }
          } else {
            for (const bar of game.barricades) {
              if (Math.abs(b.x - bar.x) < bar.hw + 0.15 && Math.abs(b.z - bar.z) < bar.hd + 0.15) {
                if (bar.pierceLv > 0 || b.piercing) {
                  // [탄환관통 업그레이드 방벽]: 아군 탄환이 총안구를 통과하며 화력 증폭!
                  if (!b.piercedBars) b.piercedBars = [];
                  if (!b.piercedBars.includes(bar)) {
                    b.piercedBars.push(bar);
                    b.damage = Math.round(b.damage * (bar.bulletDmgBonus || 1.15));
                    spawnBloodParticles(b.x, 1.15, b.z, 0x38bdf8, 2);
                  }
                } else {
                  if (b.explosiveRadius > 0) {
                    triggerExplosion(b.x, b.z, b.explosiveRadius, b.damage, b.ownerId, b.awakened, 0, b.tier1Special);
                  }
                  removeBullet = true;
                  break;
                }
              }
            }
          }
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
              if (pl.id !== b.ownerId && !pl.downed && Math.hypot(pl.x - b.x, pl.z - b.z) < 0.75) {
                // [다목적 전술 드론: 탄약 요격 방어 모듈] 아군 오사 탄환을 착탄 직전 레이저로 즉시 요격 소멸!
                if (pl.drone && pl.drone.unlocked && pl.drone.modules && pl.drone.modules.interceptor && (pl.drone.modules.interceptor.level || 0) >= 1 && (pl.drone.modules.interceptor.cooldown || 0) <= 0) {
                  const intLv = pl.drone.modules.interceptor.level || 1;
                  const cdTable = [0, 6.0, 3.5, 1.8, 0.6];
                  pl.drone.modules.interceptor.cooldown = cdTable[intLv] || 6.0;
                  removeBullet = true;
                  SoundFX.play("pickup");
                  spawnBloodParticles(b.x, 1.2, b.z, 0x38bdf8, 8); // Cyan laser parry sparks
                  const safeBanner = document.getElementById("hud-safe-banner");
                  if (safeBanner) {
                    document.getElementById("hud-safe-banner-text").textContent = `⚡ [요격 드론] 팀킬 탄환 레이저 요격 방어!`;
                    safeBanner.classList.remove("hidden");
                    setTimeout(() => safeBanner.classList.add("hidden"), 1800);
                  }
                  break;
                }
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
                  // [v3.1 특수개조 개선] 산탄총 15Lv 소이 산탄(3초 화상 지속피해 대폭 상향) & 30Lv 드래곤 브레스(3.5초 고열 화염장판)
                  if (b.wIdx === 1 && (b.tier1Special || b.awakened)) {
                    zmb.burnTimer = 3.0;
                    zmb.burnDps = Math.max(38, Math.round(b.damage * 0.70));
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
                  let hitDmg = Math.round(b.damage * armorMult);
                  let hitKnock = b.knockback;
                  let hitStun = b.stun;
                  if (b.heavyImpact) {
                    const distFromOrigin = Math.hypot(b.x - (b.originX || b.x), b.z - (b.originZ || b.z));
                    if (distFromOrigin >= 9.0) {
                      hitDmg = Math.round(hitDmg * 1.35); // [v3.3 중화기 소총 9m 이상 원거리 타격 +35% 관통 보너스]
                      hitKnock *= 1.45;
                      hitStun = Math.max(hitStun, 0.45);
                    }
                  }

                  // [v3.4 확률적 약점(치명타) 타격 시스템] 권총/돌소 고유치확 + 돌격수 패시브(+10%) + 척후병 배후기습(+25%) / 은신첫발(100% 확정)
                  const owner = game.players[b.ownerId];
                  let isBackstab = false;
                  if (owner && owner.specialization === "SCOUT" && zmb.group) {
                    const zAngle = zmb.group.rotation.y;
                    const bAngle = Math.atan2(b.vx, b.vz);
                    let diff = Math.abs(zAngle - bAngle);
                    if (diff > Math.PI) diff = 2 * Math.PI - diff;
                    if (diff <= 1.15) { // 약 65도 이내 = 배후 기습!
                      isBackstab = true;
                    }
                  }

                  const effCritChance = (b.weakCritChance || 0) + (isBackstab ? 0.25 : 0);
                  const isWeakCrit = Math.random() < effCritChance;
                  if (isWeakCrit) {
                    const critMult = (b.weakMult || 1.25) * (isBackstab ? 1.30 : 1.0);
                    hitDmg = Math.round(hitDmg * critMult);
                    spawnBloodParticles(zmb.x, 1.2, zmb.z, isBackstab ? 0x10b981 : 0xfacc15, 6); // 배후 암살 비취빛/치명타 황금빛 파티클
                  }

                  const prevHp = zmb.hp;
                  damageZombie(zIdx, hitDmg, b.vx * 0.04 * hitKnock, b.vz * 0.04 * hitKnock, hitStun, b.wIdx);
                  if (b.isScoutAssassination && owner && prevHp > 0 && zmb.hp <= 0) {
                    owner.specCooldown = Math.max(0, (owner.specCooldown || 0) - 5.0); // 은신 첫발 처치 시 쿨타임 5초 환급!
                  }

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
              const podHitRad = pod.isMidBossShieldNode ? 2.2 : 1.85;
              if (Math.hypot(pod.x - b.x, pod.z - b.z) < podHitRad) {
                // 순차 웨이브 잠금된 미션 신경절은 해금 단계(unlockStage) 도달 전까지 피해 면역!
                if (pod.isMissionHive && (pod.stepOrder || 1) > unlockStg) {
                  removeBullet = true;
                  break;
                }
                // [v3.1 샷건 일제사격 0.5초 순삭 방지] 타격당 최대 체력의 8% 피해 상한선 적용
                const maxCap = Math.max(30, Math.round(pod.maxHp * 0.08));
                pod.hp -= Math.min(b.damage, maxCap);
                if (!b.piercing) removeBullet = true;
                break;
              }
            }
          }
          if (!removeBullet) {
            for (const pyl of game.bloodPylons) {
              if (Math.hypot(pyl.x - b.x, pyl.z - b.z) < 2.2) {
                // [v3.1 보스 파일런 순삭 방지] 타격당 최대 체력의 8% 피해 상한선 적용
                const maxCap = Math.max(35, Math.round(pyl.maxHp * 0.08));
                pyl.hp -= Math.min(b.damage, maxCap);
                if (!b.piercing) removeBullet = true;
                break;
              }
            }
          }

          if (!removeBullet && game.apexTentacles) {
            for (const tent of game.apexTentacles) {
              if (tent.hp > 0 && Math.hypot(tent.x - b.x, tent.z - b.z) < 2.2) {
                if (tent.invulnerable) {
                  // 키틴질 100% 면역: 보라색 스파크 튕김 & 총알 소멸
                  spawnBloodParticles(b.x, 1.2, b.z, 0x9333ea, 4);
                  SoundFX.play("hit");
                  removeBullet = true;
                  break;
                } else {
                  // 과열 탈진 상태: 총기 데미지 적용!
                  const maxCap = Math.max(40, Math.round(tent.maxHp * 0.08));
                  tent.hp -= Math.min(b.damage, maxCap);
                  spawnBloodParticles(tent.x, 2.2, tent.z, 0xfacc15, 6);
                  if (tent.hp <= 0) {
                    spawnMissionStageVFX(tent.x, tent.z, 0xef4444, 8.5, 30, true);
                    SoundFX.play("explosion");
                    if (tent.group) entitiesGroup.remove(tent.group);
                    if (tent.warnPlane) effectsGroup.remove(tent.warnPlane);
                    if (tent.breathMesh) effectsGroup.remove(tent.breathMesh);
                    if (tent.sym && tent.sym.el) tent.sym.el.style.display = "none";
                    game.bioPoints += 8000;
                    spawnPickupItem(tent.x, tent.z, "CORE");
                    spawnPickupItem(tent.x + 1.2, tent.z, "AMMO_PACK");
                    spawnPickupItem(tent.x - 1.2, tent.z, "MEDKIT");
                    showToastNotification("💥 생체 신경 촉수 완전 파괴! (+8,000 BP & 전술 코어 획득)");
                  }
                  if (!b.piercing) removeBullet = true;
                  break;
                }
              }
            }
          }

          if (!removeBullet && game.boss && game.boss.active && !game.boss.dead) {
            if (Math.hypot(game.boss.x - b.x, game.boss.z - b.z) < game.boss.radius) {
              if (b.explosiveRadius > 0) {
                triggerExplosion(b.x, b.z, b.explosiveRadius, b.damage, b.ownerId, b.awakened);
              } else {
                // [v3.4 보스 약점 타격 확률화] 권총/돌소 고유치확 + 돌격수 패시브 + 척후병 은신 첫발(100% 확정 크리티컬)
                const isBossCrit = Math.random() < (b.weakCritChance || 0);
                let bossDmg = isBossCrit ? Math.round(b.damage * (b.weakMult || 1.25)) : Math.round(b.damage);
                if (isBossCrit) {
                  spawnBloodParticles(game.boss.x, 2.8, game.boss.z, b.isScoutAssassination ? 0x10b981 : 0xfacc15, 8); // 보스 치명타 파티클
                }
                if (b.heavyImpact) {
                  const distFromOrigin = Math.hypot(b.x - (b.originX || b.x), b.z - (b.originZ || b.z));
                  if (distFromOrigin >= 9.0) bossDmg = Math.round(bossDmg * 1.35);
                }
                damageBoss(bossDmg);
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
      // 1. 개인 보급상자: 각 플레이어가 개별적으로 상자를 개방하여 본인 몫의 탄약/부품 보급을 받음!
      for (let i = game.crates.length - 1; i >= 0; i--) {
        const c = game.crates[i];
        if (!c.openedBy) c.openedBy = {};

        game.players.forEach(p => {
          if (p.downed || c.openedBy[p.id]) return;
          if (Math.hypot(p.x - c.x, p.z - c.z) < 2.1) {
            c.openedBy[p.id] = true;
            grantSupplyReward(p, false);

            if (p.id === mySlotIndex) {
              SoundFX.play("pickup");
              const getsPart = (c.crateOrder === 0) || (Math.random() < 0.50);
              if (getsPart) {
                game.weaponParts = (game.weaponParts || 0) + 1;
              }
              const safeBanner = document.getElementById("hud-safe-banner");
              if (safeBanner) {
                document.getElementById("hud-safe-banner-text").textContent =
                  getsPart
                    ? `📦 개인 보급상자 개방! 탄약 보급 & ⚙️무기부품 +1개 (보유: ${game.weaponParts}개)`
                    : `📦 개인 보급상자 개방! 탄약 보급 완료`;
                safeBanner.classList.remove("hidden");
                setTimeout(() => safeBanner.classList.add("hidden"), 3800);
              }
              if (!document.getElementById("upgrade-modal").classList.contains("hidden")) renderUpgradeModal();
            }
          }
        });

        // 본인(mySlotIndex)이 열었으면 로컬 시각적으로 3D 모델 즉시 숨김 (탄약 드랍과 동일하게 개인 획득 시 소거)
        if (c.openedBy[mySlotIndex]) {
          if (c.group) c.group.visible = false;
        }

        // 모든 살아있는 대원이 개방했으면 완전히 씬에서 제거
        const allLivingCrated = game.players.filter(pl => !pl.downed).every(pl => c.openedBy[pl.id]);
        if (allLivingCrated) {
          try { entitiesGroup.remove(c.group); } catch (e) {}
          game.crates.splice(i, 1);
        }
      }

      // [다목적 전술 드론: 자력 수거 모듈 - v3.1 버그 수정]
      // 개인 드랍 인스턴스 픽업이므로 내 화면에서는 오직 본인(mySlotIndex)의 자석 드론만 내 화면의 아이템을 견인해야 함! (친구한테 빨려들어가는 버그 원천 차단)
      const myPlayer = game.players[mySlotIndex];
      if (myPlayer && !myPlayer.downed && myPlayer.drone && myPlayer.drone.unlocked && myPlayer.drone.modules && myPlayer.drone.modules.magnet) {
        const magLv = myPlayer.drone.modules.magnet.level || 0;
        if (magLv > 0) {
          const magRadius = [0, 4.0, 6.0, 8.0, 10.0][magLv] || 4.0;
          game.pickups.forEach(pk => {
            if (pk.collectedBy && pk.collectedBy[myPlayer.id]) return;
            const dist = Math.hypot(myPlayer.x - pk.x, myPlayer.z - pk.z);
            if (dist <= magRadius && dist > 0.35) {
              const pullSpd = 13.5;
              pk.x += ((myPlayer.x - pk.x) / dist) * pullSpd * dt;
              pk.z += ((myPlayer.z - pk.z) / dist) * pullSpd * dt;
              if (pk.mesh) pk.mesh.position.set(pk.x, pk.mesh.position.y, pk.z);
              if (pk.sym) {
                pk.sym.x = pk.x;
                pk.sym.z = pk.z;
              }
            }
          });
        }
      }

      // 2. 개인 드랍 아이템(탄약팩, 구급키트, 스팀팩, 변이코어, BP박스): 모든 대원이 각자의 몫을 독립 수거!
      for (let i = game.pickups.length - 1; i >= 0; i--) {
        const pk = game.pickups[i];
        if (!pk.collectedBy) pk.collectedBy = {};
        if (pk.mesh) pk.mesh.rotation.y += dt * 2.5;

        // 내가 이미 수거한 아이템은 내 시야에서 숨김 처리
        if (pk.collectedBy[mySlotIndex]) {
          if (pk.mesh) pk.mesh.visible = false;
          if (pk.sym && pk.sym.el) pk.sym.el.style.display = "none";
        }

        game.players.forEach(tp => {
          if (tp.downed || pk.collectedBy[tp.id]) return;
          if (Math.hypot(tp.x - pk.x, tp.z - pk.z) < 1.85) {
            pk.collectedBy[tp.id] = true;

            if (tp.id === mySlotIndex) {
              if (pk.mesh) pk.mesh.visible = false;
              if (pk.sym && pk.sym.el) pk.sym.el.style.display = "none";
            }

            if (pk.kind === "CORE") {
              if (tp.id === mySlotIndex) {
                game.coreSamples = (game.coreSamples || 0) + 1;
                SoundFX.play("revive");
                const safeBanner = document.getElementById("hud-safe-banner");
                if (safeBanner) {
                  document.getElementById("hud-safe-banner-text").textContent =
                    `🧬 변이 코어 획득! (보유 코어: ${game.coreSamples}개)`;
                  safeBanner.classList.remove("hidden");
                  setTimeout(() => safeBanner.classList.add("hidden"), 4000);
                }
              }
            } else {
              if (tp.id === mySlotIndex) SoundFX.play("pickup");
              if (pk.kind === "MEDKIT") tp.medkits = Math.min(getPlayerMaxMedkits(tp), tp.medkits + 1);
              else if (pk.kind === "STIM") tp.stims = Math.min(getPlayerMaxStims(tp), tp.stims + 1);
              else if (pk.kind === "PART") {
                if (tp.id === mySlotIndex) game.weaponParts = (game.weaponParts || 0) + 1;
              }
              else if (pk.kind === "BP_BOX") {
                const curR = game.rooms && game.rooms[game.currentRoomIndex];
                const effIdx = (curR && curR.index > 0 && !curR.lockedBehind) ? (curR.index - 1) : (game.currentRoomIndex || 0);
                const prevRoom = (curR && curR.index > 0 && !curR.lockedBehind) ? game.rooms[curR.index - 1] : null;
                const isBerserkNow = (curR && curR.berserkActive) || (prevRoom && prevRoom.berserkActive);
                const berserkMult = isBerserkNow ? 0.20 : 1.0;
                const bpGain = Math.max(1, Math.round((75 + effIdx * 45) * berserkMult));
                if (tp.id === mySlotIndex) {
                  game.bioPoints = (game.bioPoints || 0) + bpGain;
                  const safeBanner = document.getElementById("hud-safe-banner");
                  if (safeBanner) {
                    document.getElementById("hud-safe-banner-text").textContent =
                      `🪙 개인 생체 BP 상자 수거! (+${bpGain} BP)`;
                    safeBanner.classList.remove("hidden");
                    setTimeout(() => safeBanner.classList.add("hidden"), 3000);
                  }
                }
              }
              else {
                const strikerMult = (tp.specialization === "STRIKER") ? 1.35 : 1.0;
                if (pk.wIdx !== undefined && tp.inventory[pk.wIdx]) {
                  const targetW = pk.wIdx;
                  const inv = tp.inventory[targetW];
                  const maxA = getWeaponMaxAmmo(tp, targetW);
                  const packRatio = (targetW === 2 || targetW === 3) ? 0.75 : 0.6;
                  const bonus = (targetW === 2 ? (WEAPONS[2].ammoRefillBonus || 1.5) : 1.0);
                  const gained = Math.ceil(WEAPONS[targetW].packAmmo * packRatio * bonus * strikerMult);
                  if (inv.ammo >= maxA) {
                    if (tp.id === mySlotIndex) game.bioPoints = (game.bioPoints || 0) + 20;
                  } else {
                    inv.ammo = Math.min(maxA, inv.ammo + gained);
                  }
                } else {
                  let anyRefilled = false;
                  tp.inventory.forEach((inv, wIdx) => {
                    if (inv.unlocked && !WEAPONS[wIdx].infinite) {
                      const maxA = getWeaponMaxAmmo(tp, wIdx);
                      if (inv.ammo < maxA) anyRefilled = true;
                      const packRatio = (wIdx === 2 || wIdx === 3) ? 0.75 : 0.5;
                      const bonus = (wIdx === 2 ? (WEAPONS[2].ammoRefillBonus || 1.5) : 1.0);
                      inv.ammo = Math.min(maxA, inv.ammo + Math.ceil(WEAPONS[wIdx].packAmmo * packRatio * bonus * strikerMult));
                    }
                  });
                  if (!anyRefilled && tp.id === mySlotIndex) {
                    game.bioPoints = (game.bioPoints || 0) + 40;
                  }
                }
              }
            }

            if (tp.id === mySlotIndex) {
              updateWeaponSlotsHUD();
              if (!document.getElementById("upgrade-modal").classList.contains("hidden")) renderUpgradeModal();
            }
          }
        });

        // 모든 살아있는 플레이어가 아이템을 수거했으면 메모리/씬에서 완전 삭제
        const allLivingPicked = game.players.filter(pl => !pl.downed).every(pl => pk.collectedBy[pl.id]);
        if (allLivingPicked) {
          pk.done = true;
          if (pk.sym) {
            if (pk.sym.el) pk.sym.el.remove();
            const sIdx = game.worldSymbols.indexOf(pk.sym);
            if (sIdx !== -1) game.worldSymbols.splice(sIdx, 1);
          }
          try { entitiesGroup.remove(pk.mesh); } catch (e) {}
          game.pickups.splice(i, 1);
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
        if (!d.open && Math.abs(x - d.x) < d.w / 2 + r && Math.abs(z - d.z) < d.d / 2 + r) {
          // [v3.3 문 끼임/고립 방지] 후방 격벽이 잠겼을 때 아직 이전 방에 있는 플레이어의 전진 이동은 통과 허용!
          const curRoom = game.rooms[game.currentRoomIndex];
          if (curRoom && d.toRoom === curRoom.index && d.lockedPermanently) {
            const me = game.players[mySlotIndex];
            if (me && (Math.abs(me.x - curRoom.wx) > (curRoom.hw || curRoom.half) || Math.abs(me.z - curRoom.wz) > (curRoom.hd || curRoom.half))) {
              continue;
            }
          }
          return true;
        }
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
