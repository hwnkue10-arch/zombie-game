/**
 * =========================================================================
 * BOXHEAD: THE CORE v3.6 — Frontend Module: 05c_combat_and_damage.js
 * 3D Weapon Firing Patterns, Railgun/Cryo/Explosions & Entity Damage Handlers
 * Zero-Loss Refactored Architecture (Shared Global Lexical Scope)
 * =========================================================================
 */
"use strict";

    // =========================================================================
    // 12. DISTINCT 3D WEAPON BULLET PATTERNS & AWAKENING FIRE LOGIC
    // =========================================================================
    function fireWeapon(player, dirX, dirZ, netShotSeed) {
      const wIdx = (player.downed || player.carryingPayload) ? 0 : player.currentWeapon;
      const wDef = WEAPONS[wIdx];
      const inv = player.inventory[wIdx];
      if (!inv || !inv.unlocked) return;

      // [v3.1 멀티플레이 탄도 100% 동기화] 사격 고유 시드(shotSeed)를 생성하여 모든 화면에서 산탄 각도와 탄환 궤적이 100% 일치하도록 보장!
      const shotSeed = (netShotSeed !== undefined) ? netShotSeed : Math.floor(Math.random() * 2147483600);
      const shotRng = createRNG(shotSeed);

      // [v3.1 버그 해결] 탄약 검사를 REMOTE_FIRE 패킷 송신 전으로 최우선 배치하여, 0발 상태에서 패킷이 난사되는 화염방사 버그 원천 차단!
      if (!wDef.infinite && !netShotSeed) {
        if ((inv.ammo || 0) <= 0) {
          if (player.id === mySlotIndex) {
            player.fireCooldown = Math.max(player.fireCooldown || 0, 0.28);
            SoundFX.play("deny");
          }
          return;
        }
        const freeShotChance = Math.min(0.65, inv.stats.knock * 0.065);
        if (shotRng() >= freeShotChance) {
          inv.ammo = Math.max(0, inv.ammo - 1);
        }
      }

      if (!netShotSeed && player.id === mySlotIndex && wsClient && wsClient.readyState === WebSocket.OPEN) {
        try {
          wsClient.send(JSON.stringify({
            type: "REMOTE_FIRE",
            slotId: player.id,
            wIdx,
            x: Math.round(player.x * 100) / 100,
            z: Math.round(player.z * 100) / 100,
            dirX: Math.round(dirX * 1000) / 1000,
            dirZ: Math.round(dirZ * 1000) / 1000,
            shotSeed,
            stats: inv.stats,
            totalLv: inv.totalLv,
            tier1Special: inv.tier1Special,
            awakened: inv.awakened,
            transcended: inv.transcended
          }));
        } catch (e) {}
      }

      const isDownedPistol = !!player.downed;
      const resCount = isDownedPistol ? 0 : getResonanceCount(player);
      const pure15Count = isDownedPistol ? 0 : player.inventory.filter(it => it.unlocked && !it.tier1Special && it.totalLv >= 15).length;
      const pure45Count = isDownedPistol ? 0 : player.inventory.filter(it => it.unlocked && !it.tier1Special && it.totalLv >= 45).length;
      const resMult = 1 + resCount * 0.05 + pure15Count * 0.08 + pure45Count * 0.06;
      const effAtkLv = isDownedPistol ? 0 : inv.stats.atk;
      const effSpdLv = isDownedPistol ? 0 : inv.stats.spd;
      const effAreaLv = isDownedPistol ? 0 : inv.stats.area;
      const effStunLv = isDownedPistol ? 0 : inv.stats.stun;
      const effKnockLv = isDownedPistol ? 0 : inv.stats.knock;
      const effTier1 = isDownedPistol ? false : !!inv.tier1Special;
      const effAwakened = isDownedPistol ? false : !!inv.awakened;
      const effTranscended = isDownedPistol ? false : !!inv.transcended;
      const pureBonus = isDownedPistol ? { dmgMult: 1.0, spdMult: 1.0, extraPierce: 0, armorIgnore: false, weakBonus: 0 } : getPureStatMasteryBonus(inv);
      const overdriveMult = (!isDownedPistol && effTranscended) ? 1.55 : ((!isDownedPistol && inv.totalLv >= 45) ? 1.35 : 1.0);

      const isStrikerOvercharged = Boolean(player.specialization === "STRIKER" && player.overclockActive && player.specActiveTimer > 0);
      const atkMult = (1 + effAtkLv * 0.20) * resMult * (effTier1 ? 1.15 : 1.0) * pureBonus.dmgMult * overdriveMult * (isStrikerOvercharged ? 1.25 : 1.0);
      const spdMult = isDownedPistol ? 0.85 : ((1 + effSpdLv * 0.10) * (pureBonus.spdMult || 1.0) * (effTranscended ? 1.25 : (inv.totalLv >= 45 ? 1.15 : 1.0)) * (player.stimBuffTimer > 0 ? 1.25 : 1.0) * (player.frostTimer > 0 && player.stimBuffTimer <= 0 ? 0.75 : 1.0));
      const isPierceInArea = (wIdx === 0 || wIdx === 3);
      const rangeMult = isPierceInArea ? 1.15 : (1 + effAreaLv * 0.22);
      const stunDur = isDownedPistol ? 0.15 : ((wDef.stun + effStunLv * 0.22) * (isStrikerOvercharged ? 1.35 : 1.0));
      const knockVal = isDownedPistol ? 0.35 : (wDef.knockback * (1 + effStunLv * 0.28));
      const strikerPierce = player.specialization === "STRIKER" ? (isStrikerOvercharged ? 2 : 1) : 0;
      const pierceCount = isDownedPistol ? 1 : ((wDef.piercing ? 99 : 1) + (wDef.pierceBase || 0) + (isPierceInArea ? effAreaLv : 0) + (wIdx === 0 && effTier1 ? 1 : 0) + (wIdx === 0 && effAwakened ? 2 : 0) + (pureBonus.extraPierce || 0) + strikerPierce);
      const areaMult = isPierceInArea ? 1.05 : rangeMult;

      player.fireCooldown = Math.max(0.030, (wDef.fireRate / spdMult) * (isStrikerOvercharged ? 0.74 : 1.0));

      if (player.id === mySlotIndex) {
        SoundFX.play(wDef.sound);
        updateWeaponSlotsHUD();
      }

      const len = Math.hypot(dirX, dirZ) || 1;
      const nx = dirX / len;
      const nz = dirZ / len;
      player.rotY = Math.atan2(nx, nz);

      if (wDef.placeType === "barricade") {
        spawnBarricade(player.x + nx * 2.2, player.z + nz * 2.2, effAwakened, inv.stats, nx, nz, effTier1, player.id);
        return;
      }
      if (wDef.placeType === "barrel") {
        const bx = player.x + nx * 2.2;
        const bz = player.z + nz * 2.2;
        // [v3.1] 폭약통 연쇄 유폭 낭비 방지를 위한 최소 설치 간격(1.8m) 체크
        const tooClose = game.barrels.some(b => Math.hypot(b.x - bx, b.z - bz) < 1.8);
        if (tooClose) {
          inv.ammo = Math.min(getWeaponMaxAmmo(player, wIdx), inv.ammo + 1);
          if (player.id === mySlotIndex) {
            updateWeaponSlotsHUD();
            const safeBanner = document.getElementById("hud-safe-banner");
            if (safeBanner) {
              document.getElementById("hud-safe-banner-text").textContent = "⚠️ 폭약통 최소 안전간격(1.8m) 확보 필요! (연쇄 유폭 낭비 방지)";
              safeBanner.classList.remove("hidden");
              setTimeout(() => safeBanner.classList.add("hidden"), 2200);
            }
          }
          return;
        }
        spawnBarrel(bx, bz, effAwakened, inv.stats, effTier1, player.id);
        return;
      }

      const baseAngle = Math.atan2(nx, nz);
      let calculatedDmg = Math.round(wDef.damage * atkMult);
      let effectivePierce = pierceCount + (player.specialization === "STRIKER" ? 1 : 0);

      // [척후병 암살 관통샷] 은신 중 첫 발사: 100% 확정 치명타(보스 포함 2.5배) & 방어구 무시 무한 관통!
      let isScoutAssassination = false;
      if (player.cloakActive) {
        isScoutAssassination = true;
        effectivePierce = 999;
        player.cloakActive = false;
        player.specActiveTimer = 0;
        if (player.visual && player.visual.body) {
          player.visual.body.material.transparent = false;
          player.visual.body.material.opacity = 1.0;
        }
        spawnBloodParticles(player.x, 1.3, player.z, 0x10b981, 14);
      }

      if (wIdx === 5) {
        fireRailgunBeam(player, nx, nz, calculatedDmg, stunDur, knockVal, areaMult, effAwakened, effTier1, isScoutAssassination);
        return;
      }

      let totalProjectiles = wDef.pellets;
      if (wIdx === 1) totalProjectiles += effAreaLv + (effTier1 ? 2 : 0);
      if (wIdx === 0 && effAwakened) totalProjectiles = 2;

      for (let p = 0; p < totalProjectiles; p++) {
        const spreadOffset = (shotRng() - 0.5) * wDef.spread;
        const a = baseAngle + spreadOffset;
        const bSpeed = wDef.speed * (player.overclockActive ? 1.30 : 1.0);
        const vx = Math.sin(a) * bSpeed;
        const vz = Math.cos(a) * bSpeed;

        let bGeo = SHARED_GEO.pistolTracer;
        if (wIdx === 1) bGeo = SHARED_GEO.shotgunPellet;
        else if (wIdx === 2) bGeo = SHARED_GEO.uziNeedle;
        else if (wIdx === 3) bGeo = SHARED_GEO.rifleSlug;
        else if (wIdx === 4) bGeo = SHARED_GEO.grenadeShell;

        const bulletColor = isScoutAssassination ? 0x10b981 : (effAwakened ? 0x22d3ee : (effTier1 ? 0xe879f9 : wDef.color));
        const bulletMesh = new THREE.Mesh(bGeo, new THREE.MeshBasicMaterial({ color: bulletColor }));
        const sideOffset = (wIdx === 0 && effAwakened) ? (p === 0 ? -0.28 : 0.28) : 0;
        bulletMesh.position.set(player.x + nx * 0.9 + nz * sideOffset, 1.15, player.z + nz * 0.9 - nx * sideOffset);
        bulletMesh.rotation.y = a;
        bulletMesh.scale.set(areaMult, areaMult, areaMult);
        effectsGroup.add(bulletMesh);

        // 총기별 유효 사거리(life) 정밀 확립 (피스톨은 유효사거리 스탯으로 비거리 대폭 증가)
        let baseBulletLife = 0.80;
        if (wIdx === 0) {
          baseBulletLife = 0.65 * (1 + effKnockLv * 0.12); // 권총: 기본 ~28.6m -> 풀강시 ~45.7m
        } else if (wIdx === 1) {
          baseBulletLife = 0.38; // 산탄총: 근거리 ~13.7m - 16m
        } else if (wIdx === 2) {
          baseBulletLife = 0.52; // UZI: 중거리 ~22.9m
        } else if (wIdx === 3) {
          baseBulletLife = 0.94; // 돌격소총: 원거리 ~47.0m
        } else if (wIdx === 4) {
          baseBulletLife = 0.85; // 유탄발사기: 곡사 ~22.1m
        }

        game.bullets.push({
          ownerId: player.id,
          wIdx,
          tier1Special: effTier1,
          awakened: effAwakened,
          noFriendlyFire: isDownedPistol,
          isZombieProjectile: false,
          x: bulletMesh.position.x,
          z: bulletMesh.position.z,
          originX: player.x,
          originZ: player.z,
          heavyImpact: !!wDef.heavyImpact,
          vx, vz,
          damage: calculatedDmg,
          isScoutAssassination,
          weakMult: isDownedPistol ? 1.0 : (
            isScoutAssassination ? 2.5 : ((wDef.weakMult || 1.2) + (pureBonus.weakBonus || 0) + (wIdx === 0 && effTier1 ? 0.6 : 0))
          ),
          weakCritChance: isDownedPistol ? 0.05 : (
            isScoutAssassination ? 1.0 : (
              (wDef.weakCritChance || 0) +
              (wIdx === 0 && effTier1 ? 0.15 : 0) +
              (player.specialization === "STRIKER" ? (0.10 + (player.overclockActive ? 0.15 : 0)) : 0)
            )
          ),
          stun: stunDur,
          knockback: knockVal,
          explosiveRadius: (wDef.explosiveRadius || 0) * areaMult * (wIdx === 4 && effTier1 ? 1.25 : 1.0),
          pierceLeft: effectivePierce,
          armorPen: isDownedPistol ? false : (isScoutAssassination || !!pureBonus.armorIgnore || (isPierceInArea ? effAreaLv > 0 : (effTier1 || effAwakened))),
          piercing: effectivePierce > 1,
          life: baseBulletLife * (isPierceInArea ? 1.0 : rangeMult),
          mesh: bulletMesh
        });
      }
    }

    function fireRailgunBeam(player, nx, nz, damage, stunDur, knockVal, areaMult, awakened, tier1Special, isScoutAssassination) {
      const maxBeamLen = 46;
      let beamLen = maxBeamLen;
      // [v3.2 버그 수정] 레일건 빔이 콘크리트 벽과 닫힌 격벽은 통과하지 않고 벽까지만 뻗도록 레이캐스트 거리 제한!
      for (let step = 1.5; step <= maxBeamLen; step += 1.0) {
        if (isPointBlockedByWall(player.x + nx * step, player.z + nz * step, 0.2, true)) {
          beamLen = Math.max(2.0, step);
          break;
        }
      }
      const midX = player.x + nx * (beamLen / 2);
      const midZ = player.z + nz * (beamLen / 2);
      const widthBoost = tier1Special ? 1.35 : 1.0;

      const beamGeo = new THREE.CylinderGeometry(0.28 * areaMult * widthBoost, 0.28 * areaMult * widthBoost, beamLen, 8);
      beamGeo.rotateX(Math.PI / 2);
      const beamMesh = new THREE.Mesh(
        beamGeo,
        new THREE.MeshBasicMaterial({ color: awakened ? 0xf43f5e : (tier1Special ? 0xe879f9 : 0x22d3ee), transparent: true, opacity: 0.9 })
      );
      beamMesh.position.set(midX, 1.18, midZ);
      beamMesh.rotation.y = Math.atan2(nx, nz);
      effectsGroup.add(beamMesh);
      game.particles.push({ mesh: beamMesh, life: 0.28, maxLife: 0.28 });

      // [v3.1 레일건 리빌드] 샷건 드래곤브레스와 겹치던 바닥 잔류 장판 제거!
      // 대신 순간 충격파 횡방향 넉백 압축파(15Lv) & 관통 적 전원 6초 장갑 파쇄(+35% 피해 증폭)(30Lv)로 차별화
      const beamRadius = 1.35 * areaMult * widthBoost;
      for (let i = game.zombies.length - 1; i >= 0; i--) {
        const zmb = game.zombies[i];
        const px = zmb.x - player.x;
        const pz = zmb.z - player.z;
        const proj = px * nx + pz * nz;
        if (proj > 0 && proj < beamLen) {
          const perpDist = Math.hypot(px - proj * nx, pz - proj * nz);
          const hitThresh = zmb.radius + beamRadius + (tier1Special ? 1.6 : 0);
          if (perpDist <= hitThresh) {
            // 15Lv 1차 특수: 궤적 좌우로 강하게 날려버리는 횡방향 공탄성 충격파 넉백
            let sideKnockX = nx * knockVal;
            let sideKnockZ = nz * knockVal;
            if (tier1Special) {
              const cross = px * nz - pz * nx;
              const sign = cross >= 0 ? 1 : -1;
              sideKnockX += -nz * sign * (knockVal * 1.8);
              sideKnockZ += nx * sign * (knockVal * 1.8);
            }

            // 30Lv 2차 각성: 피격된 모든 적에게 6초간 장갑 파쇄(+35% 모든 무기 피해 증폭) 부여
            if (awakened) {
              zmb.armorShredTimer = 6.0;
              zmb.armorShredMult = 1.35;
              spawnBloodParticles(zmb.x, 1.8, zmb.z, 0x22d3ee, 5);
            }

            // [v3.4 레일건 치명타 판정] 기본 0 + 돌격수(0.10/0.25) + 척후병 은신 첫발(1.0 확정)
            const railCritChance = isScoutAssassination ? 1.0 : (
              (player.specialization === "STRIKER" ? (0.10 + (player.overclockActive ? 0.15 : 0)) : 0)
            );
            const isCrit = Math.random() < railCritChance;
            const critMult = isCrit ? (isScoutAssassination ? 2.5 : 1.6) : 1.0;
            if (isCrit) {
              spawnBloodParticles(zmb.x, 1.4, zmb.z, 0xfacc15, 6);
            }

            damageZombie(i, Math.round(damage * (zmb.spec.isMidBoss ? 1.4 : 1.0) * critMult), sideKnockX, sideKnockZ, stunDur + (tier1Special ? 0.6 : 0), 5);
          }
        }
      }

      for (let i = game.cystPods.length - 1; i >= 0; i--) {
        const pod = game.cystPods[i];
        const curR = game.rooms[game.currentRoomIndex];
        const unlockStg = curR ? (curR.unlockStage || 0) : 0;
        if (pod.isMissionHive && (pod.stepOrder || 1) > unlockStg) continue;
        const px = pod.x - player.x;
        const pz = pod.z - player.z;
        const proj = px * nx + pz * nz;
        if (proj > 0 && proj < beamLen) {
          const perpDist = Math.hypot(px - proj * nx, pz - proj * nz);
          if (perpDist <= 2.4) pod.hp -= Math.min(damage * 1.4, Math.round(pod.maxHp * 0.15));
        }
      }

      for (let i = game.bloodPylons.length - 1; i >= 0; i--) {
        const pyl = game.bloodPylons[i];
        const px = pyl.x - player.x;
        const pz = pyl.z - player.z;
        const proj = px * nx + pz * nz;
        if (proj > 0 && proj < beamLen) {
          const perpDist = Math.hypot(px - proj * nx, pz - proj * nz);
          if (perpDist <= 2.4) pyl.hp -= Math.min(damage * 1.5, Math.round(pyl.maxHp * 0.15));
        }
      }

      if (game.boss && game.boss.active && !game.boss.dead) {
        const px = game.boss.x - player.x;
        const pz = game.boss.z - player.z;
        const proj = px * nx + pz * nz;
        if (proj > 0 && proj < beamLen) {
          const perpDist = Math.hypot(px - proj * nx, pz - proj * nz);
          if (perpDist <= game.boss.radius + beamRadius) {
            if (awakened) {
              game.boss.armorShredTimer = 6.0;
              game.boss.armorShredMult = 1.35;
              spawnBloodParticles(game.boss.x, 2.8, game.boss.z, 0x22d3ee, 8);
            }
            const isBossCrit = Math.random() < railCritChance;
            const critMult = isBossCrit ? (isScoutAssassination ? 2.5 : 1.6) : 1.0;
            if (isBossCrit) {
              spawnBloodParticles(game.boss.x, 2.8, game.boss.z, 0xfacc15, 8);
            }
            damageBoss(Math.round(damage * 1.5 * critMult));
          }
        }
      }
    }

    // =========================================================================
    // 13. EXPLOSIONS, STUN/KNOCKBACK, PISTOL SCAVENGE & BOSS INVULN MECHANICS
    // =========================================================================
    function spawnIceShatterFX(x, z, count) {
      SoundFX.play("ice");
      const c = count || 6;
      for (let i = 0; i < c; i++) {
        const ang = Math.random() * Math.PI * 2;
        const spd = 2.5 + Math.random() * 4.5;
        const pGeo = new THREE.BoxGeometry(0.20, 0.20, 0.20);
        const pMat = new THREE.MeshBasicMaterial({ color: i % 2 === 0 ? 0x38bdf8 : 0xe0f2fe });
        const pMesh = new THREE.Mesh(pGeo, pMat);
        pMesh.position.set(x, 0.9, z);
        effectsGroup.add(pMesh);
        game.particles.push({
          mesh: pMesh,
          life: 0.45,
          maxLife: 0.45,
          vx: Math.cos(ang) * spd,
          vy: 2.2 + Math.random() * 2.8,
          vz: Math.sin(ang) * spd
        });
      }
    }

    function detonateCryoBarrel(barrel, attackerId) {
      const idx = game.barrels.indexOf(barrel);
      if (idx !== -1) {
        entitiesGroup.remove(barrel.group);
        game.barrels.splice(idx, 1);
      } else {
        return;
      }

      // 1. 위력 및 반경 계산 (기본 고폭 드럼통 / 15Lv 코어: 광역 빙결 / 30Lv 코어: 영구동토 냉각장판)
      const secScale = 1 + (game.currentRoomIndex || 0) * 0.35;
      const baseDmg = (barrel.baseDmg || 680) * secScale;
      const finalDmg = Math.round(baseDmg * (barrel.dmgMult || 1));
      const hasFreeze = Boolean(barrel.tier1Special || barrel.awakened);
      const hasCryoField = Boolean(barrel.awakened);
      // 15Lv 냉각 폭약통(10.0m) / 30Lv 절대영도 퍼마프로스트(기존 적정 반경 10.5m 복원)
      const expRadius = (barrel.awakened ? 10.5 : (barrel.tier1Special ? 10.0 : 8.0)) + (barrel.areaLv || 0) * 0.8;
      const freezeSec = (barrel.awakened ? 7.5 : 5.5) + (barrel.stunBonus || 0);

      SoundFX.play("explosion");
      if (hasFreeze) SoundFX.play("ice");

      // 2. 폭발 구체 VFX (기본: 적황색 화염 대폭발 / 15Lv·30Lv 코어: 시안 얼음 폭풍)
      const expMesh = new THREE.Mesh(
        new THREE.SphereGeometry(expRadius * 0.88, 18, 18),
        new THREE.MeshBasicMaterial({
          color: hasFreeze ? 0x38bdf8 : 0xf97316,
          transparent: true,
          opacity: 0.88
        })
      );
      expMesh.position.set(barrel.x, 0.9, barrel.z);
      effectsGroup.add(expMesh);
      game.particles.push({ mesh: expMesh, life: 0.38, maxLife: 0.38, expand: 1.55 });

      // 충격파 링 (Ground Shockwave)
      const ringGeo = new THREE.RingGeometry(0.5, expRadius, 32);
      const ringMat = new THREE.MeshBasicMaterial({
        color: hasFreeze ? 0x00f0ff : 0xef4444,
        transparent: true,
        opacity: 0.85,
        side: THREE.DoubleSide
      });
      const ringMesh = new THREE.Mesh(ringGeo, ringMat);
      ringMesh.rotation.x = -Math.PI / 2;
      ringMesh.position.set(barrel.x, 0.08, barrel.z);
      effectsGroup.add(ringMesh);
      game.particles.push({ mesh: ringMesh, life: 0.45, maxLife: 0.45, expand: 1.4 });

      // 파편 파티클 14개 방사
      for (let p = 0; p < 14; p++) {
        const ang = (p / 14) * Math.PI * 2 + Math.random() * 0.3;
        const spd = 6.0 + Math.random() * 8.0;
        const pGeo = new THREE.BoxGeometry(0.32, 0.32, 0.32);
        const pColor = hasFreeze
          ? (p % 2 === 0 ? 0x38bdf8 : 0xe0f2fe)
          : (p % 2 === 0 ? 0xf97316 : 0xfacc15);
        const pMat = new THREE.MeshBasicMaterial({ color: pColor });
        const pMesh = new THREE.Mesh(pGeo, pMat);
        pMesh.position.set(barrel.x, 0.6, barrel.z);
        effectsGroup.add(pMesh);
        game.particles.push({
          mesh: pMesh,
          life: 0.6,
          maxLife: 0.6,
          vx: Math.cos(ang) * spd,
          vy: 3.5 + Math.random() * 4.0,
          vz: Math.sin(ang) * spd
        });
      }

      // 3. 반경 내 감염체 폭발 피해 (15Lv 코어: 완전 동결 / 30Lv 코어: 완전 동결 + 장갑 파쇄 취약화)
      for (let i = game.zombies.length - 1; i >= 0; i--) {
        const zmb = game.zombies[i];
        const dist = Math.hypot(zmb.x - barrel.x, zmb.z - barrel.z);
        if (dist <= expRadius) {
          const falloff = 1 - (dist / expRadius) * 0.35;
          const hitDmg = Math.round(finalDmg * falloff);
          const baseStun = 1.4 + (barrel.stunBonus || 0);
          damageZombie(i, hitDmg, (zmb.x - barrel.x) * 2.2, (zmb.z - barrel.z) * 2.2, baseStun, 7);

          if (game.zombies[i] && game.zombies[i].hp > 0) {
            const zTarget = game.zombies[i];
            if (hasFreeze) {
              const actualDur = zTarget.spec.isMidBoss ? Math.max(2.5, freezeSec * 0.5) : freezeSec;
              zTarget.freezeTimer = Math.max(zTarget.freezeTimer || 0, actualDur);
              zTarget.stunTimer = Math.max(zTarget.stunTimer || 0, actualDur);
              if (zTarget.iceBlock) zTarget.iceBlock.visible = true;
            }
            // [v3.4 30Lv 코어 각성: 절대영도 파쇄] 일반/엘리트 좀비 6초간 받는 총기 피해 +35% 증폭 & 장갑 무력화!
            if (barrel.awakened) {
              zTarget.armorShredTimer = 6.0;
              zTarget.armorShredMult = 1.35;
              spawnBloodParticles(zTarget.x, 1.8, zTarget.z, 0xa855f7, 3);
            }
          }
        }
      }

      // 4. 오브젝트 피해 (Cyst Pods, Blood Pylons, Boss)
      for (let i = game.cystPods.length - 1; i >= 0; i--) {
        const pod = game.cystPods[i];
        if (Math.hypot(pod.x - barrel.x, pod.z - barrel.z) <= expRadius) pod.hp -= finalDmg;
      }
      for (let i = game.bloodPylons.length - 1; i >= 0; i--) {
        const pyl = game.bloodPylons[i];
        if (Math.hypot(pyl.x - barrel.x, pyl.z - barrel.z) <= expRadius) pyl.hp -= finalDmg * 1.5;
      }
      if (game.boss && game.boss.active && !game.boss.dead) {
        if (Math.hypot(game.boss.x - barrel.x, game.boss.z - barrel.z) <= expRadius + game.boss.radius) {
          damageBoss(Math.round(finalDmg * 0.95));
          // [v3.4 30Lv 코어 각성: 보스 맞춤형 밸런스 장갑 파쇄] 6초간 받는 피해 +20% 취약 디버프 부여!
          if (barrel.awakened) {
            game.boss.armorShredTimer = 6.0;
            game.boss.armorShredMult = 1.20;
            spawnBloodParticles(game.boss.x, 2.5, game.boss.z, 0xa855f7, 8);
          }
        }
      }

      // 5. 15Lv/30Lv 코어 개조 전용 영구동토 냉각 장판 생성 (기본 폭약통은 장판 없이 순수 고폭 파편에 집중!)
      if (hasCryoField) {
        const cRad = 5.2 + (barrel.areaLv || 0) * 0.6;
        const cryoDps = Math.round((barrel.awakened ? 210 : 165) * secScale * (barrel.dmgMult || 1));
        const cryoLife = barrel.awakened ? 8.0 : 6.5;
        const cMesh = new THREE.Mesh(
          new THREE.CircleGeometry(cRad, 24),
          new THREE.MeshBasicMaterial({ color: 0x0284c7, transparent: true, opacity: 0.58 })
        );
        cMesh.rotation.x = -Math.PI / 2;
        cMesh.position.set(barrel.x, 0.06, barrel.z);
        effectsGroup.add(cMesh);
        game.flamePools.push({
          x: barrel.x,
          z: barrel.z,
          radius: cRad,
          dps: cryoDps,
          life: cryoLife,
          isCryo: true,
          wIdx: 7,
          mesh: cMesh
        });
      }

      // 6. [v3.4 신규 스탯: 고폭파편] 폭발 순간 360° 전방위로 관통 파편 탄환 12발 방사!
      const shrapnelCount = 12;
      const shrapnelDmg = Math.round((140 + (barrel.shrapnelLv || 0) * 55) * secScale * (barrel.dmgMult || 1));
      for (let s = 0; s < shrapnelCount; s++) {
        const sAng = (s / shrapnelCount) * Math.PI * 2 + (Math.random() - 0.5) * 0.15;
        const sSpd = 26.0 + (barrel.shrapnelLv || 0) * 1.5;
        const sMesh = new THREE.Mesh(
          new THREE.BoxGeometry(0.24, 0.24, 0.48),
          new THREE.MeshBasicMaterial({ color: hasFreeze ? 0x38bdf8 : 0xfacc15 })
        );
        sMesh.position.set(barrel.x, 0.8, barrel.z);
        sMesh.rotation.y = Math.atan2(Math.sin(sAng), Math.cos(sAng));
        effectsGroup.add(sMesh);
        game.bullets.push({
          ownerId: barrel.ownerId !== undefined ? barrel.ownerId : -1,
          wIdx: 7,
          tier1Special: barrel.tier1Special,
          awakened: barrel.awakened,
          noFriendlyFire: true,
          isZombieProjectile: false,
          x: barrel.x,
          z: barrel.z,
          originX: barrel.x,
          originZ: barrel.z,
          vx: Math.cos(sAng) * sSpd,
          vz: Math.sin(sAng) * sSpd,
          damage: shrapnelDmg,
          pierceLeft: 2,
          piercing: true,
          range: 16.0 + (barrel.shrapnelLv || 0) * 1.2,
          life: 0.75,
          maxLife: 0.75,
          mesh: sMesh,
          stun: 0.6,
          knockback: 2.8
        });
      }

      // 6. 팀킬 처리
      if (game.friendlyFire) {
        game.players.forEach(pl => {
          if (pl.downed) return;
          const distP = Math.hypot(pl.x - barrel.x, pl.z - barrel.z);
          if (distP <= expRadius * 0.7) {
            const ffDmg = Math.round(finalDmg * 0.22);
            game.totalFriendlyFireDmg += ffDmg;
            damagePlayer(pl, ffDmg);
          }
        });
      }

      // 7. 인접 배럴 연쇄 폭발
      for (let br = game.barrels.length - 1; br >= 0; br--) {
        const adj = game.barrels[br];
        if (adj && adj !== barrel && !adj.detonating && Math.hypot(adj.x - barrel.x, adj.z - barrel.z) <= expRadius + adj.radius) {
          adj.detonating = true;
          setTimeout(() => {
            if (game.running) detonateCryoBarrel(adj, attackerId);
          }, 85);
        }
      }
    }

    function triggerExplosion(x, z, radius, maxDamage, attackerId, isAwakenedGrenade, clusterDepth, isTier1Grenade) {
      SoundFX.play("explosion");
      const expMesh = new THREE.Mesh(
        new THREE.SphereGeometry(radius * 0.85, 14, 14),
        new THREE.MeshBasicMaterial({ color: isAwakenedGrenade ? 0x38bdf8 : 0xf97316, transparent: true, opacity: 0.85 })
      );
      expMesh.position.set(x, 1.0, z);
      effectsGroup.add(expMesh);
      game.particles.push({ mesh: expMesh, life: 0.30, maxLife: 0.30, expand: 1.35 });

      // [v3.1 빙결 배럴 연쇄 폭발 유도]
      for (let br = game.barrels.length - 1; br >= 0; br--) {
        const barrel = game.barrels[br];
        if (barrel && !barrel.detonating && Math.hypot(barrel.x - x, barrel.z - z) <= radius + barrel.radius) {
          barrel.detonating = true;
          setTimeout(() => {
            if (game.running) detonateCryoBarrel(barrel, attackerId);
          }, 70);
        }
      }

      // [v3.2 특수개조 구현] 유탄발사기 15Lv 집속 파편탄(자탄 2발) / 30Lv 확산 클러스터(자탄 4발 연쇄 폭격)
      if (!clusterDepth && (isAwakenedGrenade || isTier1Grenade)) {
        const subCount = isAwakenedGrenade ? 4 : 2;
        const subRad = radius * 0.62;
        const subDmg = Math.round(maxDamage * (isAwakenedGrenade ? 0.52 : 0.42));
        for (let sc = 0; sc < subCount; sc++) {
          const ang = (sc / subCount) * Math.PI * 2 + 0.45;
          const sx = x + Math.cos(ang) * (radius * 0.65);
          const sz = z + Math.sin(ang) * (radius * 0.65);
          setTimeout(() => {
            if (game.running) {
              triggerExplosion(sx, sz, subRad, subDmg, attackerId, isAwakenedGrenade, 1, false);
            }
          }, 110 + sc * 55);
        }
      }

      for (let i = game.zombies.length - 1; i >= 0; i--) {
        const zmb = game.zombies[i];
        const dist = Math.hypot(zmb.x - x, zmb.z - z);
        if (dist <= radius) {
          const falloff = 1 - (dist / radius) * 0.45;
          damageZombie(i, Math.round(maxDamage * falloff), (zmb.x - x) * 1.6, (zmb.z - z) * 1.6, 0.85, 4);
        }
      }

      for (let i = game.cystPods.length - 1; i >= 0; i--) {
        const pod = game.cystPods[i];
        if (Math.hypot(pod.x - x, pod.z - z) <= radius) pod.hp -= maxDamage;
      }

      for (let i = game.bloodPylons.length - 1; i >= 0; i--) {
        const pyl = game.bloodPylons[i];
        if (Math.hypot(pyl.x - x, pyl.z - z) <= radius) pyl.hp -= maxDamage * 1.4;
      }

      if (game.boss && game.boss.active && !game.boss.dead) {
        const distB = Math.hypot(game.boss.x - x, game.boss.z - z);
        if (distB <= radius + game.boss.radius) {
          damageBoss(Math.round(maxDamage * 0.85));
        }
      }

      if (game.friendlyFire) {
        game.players.forEach(pl => {
          if (pl.downed) return;
          const distP = Math.hypot(pl.x - x, pl.z - z);
          if (distP <= radius * 0.8) {
            const ffMult = isAwakenedGrenade ? 0.08 : (isTier1Grenade ? 0.18 : 0.28);
            const ffDmg = Math.round(maxDamage * ffMult);
            game.totalFriendlyFireDmg += ffDmg;
            damagePlayer(pl, ffDmg);
          }
        });
      }
    }

    function damageZombie(zIdx, dmg, knockX, knockZ, stunDur, weaponIdx) {
      const zmb = game.zombies[zIdx];
      if (!zmb) return;

      // 중간보스 무적 기믹 및 단발 피해 상한(4인 협동 1초 순삭 방지!)
      let finalDmg = dmg;
      if (zmb.spec.isMidBoss) {
        if (zmb.mbShieldActive) {
          // 50% 체력 무적 패턴 중에는 피해 0!
          return;
        }
        if (weaponIdx !== undefined && WEAPONS[weaponIdx]) {
          finalDmg = Math.round(dmg * (WEAPONS[weaponIdx].weakMult || 1.15));
        }
        const activeSquadCount = (game.players || []).filter(p => p.role !== "EMPTY").length || 1;
        if (zmb.mbGroggyTimer > 0) {
          // [v3.5] 그로기 폭딜 보너스(1.75배) 유지하되, 4인 집중 일제사격 시 1초 삭제를 방지하는 동적 상한선 (4인 기준 2.6%, 1인 5.5%)
          const groggyCapRatio = activeSquadCount >= 4 ? 0.026 : (activeSquadCount >= 2 ? 0.038 : 0.055);
          finalDmg = Math.min(Math.round(finalDmg * 1.75), Math.round(zmb.maxHp * groggyCapRatio));
        } else {
          // [v3.1 중간보스 중장갑 밸런싱] 샷건 다단히트 등에 의한 5초컷 방지: 기본 52% 피해 감쇄 + 타격당 동적 캡 강화
          const hitCapRatio = activeSquadCount >= 4 ? 0.008 : (activeSquadCount >= 2 ? 0.012 : 0.018);
          finalDmg = Math.min(Math.round(finalDmg * 0.48), Math.round(zmb.maxHp * hitCapRatio));
        }
      }

      // [v3.1 빙결 쇄빙(Shatter) 보너스] 완전 동결 상태의 감염체 피격 시 +35% 쇄빙 피해 및 얼음 파편 연출
      if ((zmb.freezeTimer || 0) > 0) {
        finalDmg = Math.round(finalDmg * 1.35);
        if (Math.random() < 0.45) {
          spawnIceShatterFX(zmb.x, zmb.z, 3);
        }
      }

      // [v3.4 30Lv 코어 각성: 장갑 파쇄 디버프 (+35% 피해 증폭 및 아머 무력화)]
      if ((zmb.armorShredTimer || 0) > 0) {
        finalDmg = Math.round(finalDmg * (zmb.armorShredMult || 1.35));
      }

      const resist = zmb.tenacity || 0;
      zmb.hp -= finalDmg;

      // 중간보스 체력 50% 이하 도달 시 1회 한정: [🛡️생체 증폭기 2기 소환 무적 패턴] 발동!
      if (zmb.spec.isMidBoss && !zmb.mbPhase2Triggered && zmb.hp > 0 && (zmb.hp / zmb.maxHp) <= 0.52) {
        zmb.mbPhase2Triggered = true;
        zmb.mbShieldActive = true;
        if (zmb.mbShieldMesh) zmb.mbShieldMesh.material.opacity = 0.65;
        SoundFX.play("alarm");
        const r = game.rooms[zmb.roomIndex] || game.rooms[game.currentRoomIndex];
        const spawnedCores = [];
        [[-11.5, -9.0], [11.5, 9.0]].forEach((off, idx) => {
          const rawX = zmb.x + off[0];
          const rawZ = zmb.z + off[1];
          const safe = getSafeBossCoreCoord(rawX, rawZ, r, spawnedCores, 14.0);
          spawnedCores.push(safe);
          const nx = safe.x;
          const nz = safe.z;
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
          pGroup.position.set(nx, 0, nz);
          entitiesGroup.add(pGroup);

          const activeSquadCount = (game.players || []).filter(p => p.role !== "EMPTY").length || 1;
          const squadNodeScale = 1.0 + Math.max(0, activeSquadCount - 1) * 0.70;
          // [v3.1 중간보스 증폭핵 밸런스 개선] 0.5초 순삭 방지를 위해 기본 체력 상향 (5500 + 2600*섹터)
          const nodeHp = Math.round((5500 + (zmb.roomIndex || game.currentRoomIndex || 0) * 2600) * squadNodeScale);
          const nodePod = {
            x: nx, z: nz,
            hp: nodeHp,
            maxHp: nodeHp,
            isMissionHive: false,
            isMidBossShieldNode: true,
            parentMidBoss: zmb,
            roomIndex: r.index,
            timer: 9999,
            mesh: pGroup
          };
          game.cystPods.push(nodePod);
          registerWorldSymbol(
            nx, 3.2, nz,
            `🔗중간보스증폭핵#${idx + 1}(파괴필수)`,
            "bg-cyan-950/95 border-cyan-400 text-cyan-200 animate-pulse",
            nodePod, r.index
          );
        });
      }

      // [v3.1 중간보스 위엄 확립] 중간보스는 일반 사격에 의한 기절과 넉백에 완전 면역! (오직 [V] 패링 성공 시에만 4.2초 대그로기 허용)
      if (stunDur && stunDur > 0 && !zmb.mbShieldActive && !zmb.spec.isMidBoss) {
        const effStun = stunDur * Math.max(0.25, 1 - resist);
        zmb.stunTimer = Math.max(zmb.stunTimer, effStun);
      }

      if (!zmb.spec.isMidBoss) {
        const kScale = 0.16 * Math.max(0.3, 1 - resist);
        moveEntityWithCollision(zmb, (knockX || 0) * kScale, (knockZ || 0) * kScale, zmb.radius);
      }
      spawnBloodParticles(zmb.x, 1.1, zmb.z, 0xdc2626, 2);

      if (zmb.hp <= 0) {
        const curR = game.rooms[game.currentRoomIndex];
        const wasStunned = zmb.stunTimer > 0;
        const wasFrozen = (zmb.freezeTimer || 0) > 0;
        const zx = zmb.x, zz = zmb.z;
        const isMB = zmb.spec.isMidBoss;
        const isExp = zmb.spec.explosive;

        if (zmb.iceBlock) {
          try { zmb.group.remove(zmb.iceBlock); } catch (e) {}
        }
        if (wasFrozen) {
          spawnIceShatterFX(zx, zz, 8);
        }

        entitiesGroup.remove(zmb.group);
        game.zombies.splice(zIdx, 1);
        if (isMB && game.midBoss === zmb) {
          game.midBoss = null;
          // 중간보스 처치 시 🧬변이 코어 1개 + ⚙️무기 부품 2개 + 탄약팩 + 구급키트 확정 드랍!
          spawnPickup(zx, zz, "CORE");
          spawnPickup(zx - 1.5, zz, "PART");
          spawnPickup(zx, zz - 1.5, "PART");
          spawnPickup(zx + 1.5, zz, "AMMO_PACK");
          spawnPickup(zx, zz + 1.5, "MEDKIT");
          SoundFX.play("revive");
          if (curR && curR.hasMidBoss) {
            curR.midBossKilled = true;
            curR.progress = curR.targetVal;
            checkRoomClear(curR);
          }
        }

        game.totalKills++;
        game.comboCount++;
        game.comboTimer = 5.5;
        const envMult = (curR && curR.envType === 'BLOOD_RAIN') ? 1.35 : 1.0;

        if (curR) {
          curR.sectorKills = (curR.sectorKills || 0) + 1;
          // 후방 격벽이 닫히기 전까지는 이전 섹터의 BP 획득 배율 유지 (격벽 미폐쇄 파밍 어뷰징 방지)
          // 후방 격벽을 완전히 폐쇄(curR.lockedBehind)해야만 신규 섹터의 온전한 BP 배율 적용
          const effectiveBpSecIdx = (curR.index > 0 && !curR.lockedBehind) ? (curR.index - 1) : curR.index;
          const secScale = 1 + effectiveBpSecIdx * 0.45;
          const prevRoom = (curR.index > 0 && !curR.lockedBehind) ? game.rooms[curR.index - 1] : null;
          const isBerserkNow = curR.berserkActive || (prevRoom && prevRoom.berserkActive);
          const berserkPenalty = isBerserkNow ? 0.20 : 1.0;

          if (isMB) {
            const grantBp = Math.max(1, Math.round(zmb.spec.bp * secScale * berserkPenalty));
            curR.bpEarned += grantBp;
            game.bioPoints += grantBp;
          } else {
            // 제한시간 초과 광폭화(berserkActive) 상태에서 0.20배 BP 페널티 적용
            const grantBp = Math.max(1, Math.round(zmb.spec.bp * secScale * envMult * berserkPenalty));
            curR.bpEarned += grantBp;
            game.bioPoints += grantBp;
          }
        }

        if (game.comboCount === 100 || game.comboCount === 200) {
          spawnPickup(zx, zz, "AMMO_PACK");
        }

        const mePlayer = game.players[mySlotIndex];
        const unlockedWeapons = [];
        if (mePlayer && mePlayer.inventory) {
          for (let w = 1; w < WEAPONS.length; w++) {
            if (mePlayer.inventory[w] && mePlayer.inventory[w].unlocked) {
              unlockedWeapons.push(w);
            }
          }
        }
        const getDropWeapon = () => (unlockedWeapons.length > 0) ? unlockedWeapons[Math.floor(Math.random() * unlockedWeapons.length)] : undefined;

        if (weaponIdx === 0 && wasStunned && Math.random() < 0.05) {
          spawnPickup(zx, zz, "AMMO_PACK", getDropWeapon());
        }

        if (isExp) {
          triggerExplosion(zx, zz, 4.0, 58, -1, false);
          if (zmb.spec.leavesAcidPool) {
            // [v3.4 산성 봄버] 폭발 지점에 5.5초간 부식 산성 웅덩이 잔류
            const aMesh = new THREE.Mesh(
              new THREE.CircleGeometry(3.2, 24),
              new THREE.MeshBasicMaterial({ color: 0x84cc16, side: THREE.DoubleSide, transparent: true, opacity: 0.65, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1.0 })
            );
            aMesh.rotation.x = -Math.PI / 2;
            aMesh.position.set(zx, 0.07, zz);
            effectsGroup.add(aMesh);
            game.acidPools.push({ x: zx, z: zz, radius: 3.2, life: 5.5, roomIndex: zmb.roomIndex, mesh: aMesh });
          }
        }

        // [v3.2 탄약 드랍 개편] 보유(해금) 무기 전용 탄약팩 드랍 + [바이오 탄약 재활용기 보너스 반영]
        const recyclerBonus = (typeof getPlayerAmmoDropBonus === "function" && mePlayer) ? getPlayerAmmoDropBonus(mePlayer) : 0;
        const isElite = (zmb.typeKey === "GOLIATH" || zmb.typeKey === "DEVIL");
        const partChance = isElite ? 0.001 : 0.0;
        const bpBoxChance = 0.008; // 0.8% 드랍율 (0.5% ~ 1.0% 지정 범위)
        const ammoDropChance = 0.010 * (1 + recyclerBonus * 2.0) + (recyclerBonus > 0 ? 0.015 : 0); // 기본 1.0% ➔ 바이오 재활용기 시 대폭 증강
        const r = Math.random();
        if (r < ammoDropChance) {
          spawnPickup(zx, zz, "AMMO_PACK", getDropWeapon());
        } else if (r < ammoDropChance + partChance) {
          spawnPickup(zx, zz, "PART");
        } else if (r < ammoDropChance + partChance + bpBoxChance) {
          spawnPickup(zx, zz, "BP_BOX");
        } else if (r < ammoDropChance + partChance + bpBoxChance + 0.0018) {
          spawnPickup(zx, zz, "MEDKIT");
        } else if (r < ammoDropChance + partChance + bpBoxChance + 0.0032) {
          spawnPickup(zx, zz, "STIM");
        }
      }
    }

    function damageBoss(dmg) {
      const b = game.boss;
      if (!b || b.dead || !b.active) return;

      // Invulnerability Check!
      if (b.invulnState !== "NONE") {
        b.shielded = true;
        return;
      }
      b.shielded = false;

      const activeSquadCount = (game.players || []).filter(p => p.role !== "EMPTY").length || 1;
      let bossHitDmg = dmg;

      // [v3.5 4인 레이드 밸런스 오버홀]
      // 평시: 생체 외피 감쇄(32% 방어) + 4인 기준 타격당 1.2% (1인 2.5%) 상한선으로 순간 순삭 방지!
      // 그로기: 2.2배 그로기 폭딜 보너스를 부여하되, 4인 기준 타격당 2.8% (1인 5.5%) 상한선으로 레이드 보스의 품격 유지!
      if (b.groggyTimer > 0) {
        const groggyCapRatio = activeSquadCount >= 4 ? 0.028 : (activeSquadCount >= 2 ? 0.040 : 0.055);
        bossHitDmg = Math.min(Math.round(bossHitDmg * 2.2), Math.round(b.maxHp * groggyCapRatio));
      } else {
        const hitCapRatio = activeSquadCount >= 4 ? 0.012 : (activeSquadCount >= 2 ? 0.018 : 0.025);
        bossHitDmg = Math.min(Math.round(bossHitDmg * 0.68), Math.round(b.maxHp * hitCapRatio));
      }

      // [v3.4 30Lv 코어 각성: 보스 맞춤형 장갑 파쇄 (+20% 취약 디버프)]
      if ((b.armorShredTimer || 0) > 0) {
        bossHitDmg = Math.round(bossHitDmg * (b.armorShredMult || 1.20));
      }

      const finalDmg = Math.max(1, bossHitDmg);
      b.hp = Math.max(0, b.hp - finalDmg);
      spawnBloodParticles(b.x + (Math.random() - 0.5) * 3.5, 2.5, b.z + (Math.random() - 0.5) * 3.5, 0xf43f5e, 3);

      if (b.grappleTarget) {
        b.grappleHp -= finalDmg;
        if (b.grappleHp <= 0) clearBossGrapple();
      }

      const ratio = b.hp / b.maxHp;

      // Trigger 3 Forced Invulnerability Mechanics at 75%, 50%, 25% HP!
      if (ratio <= 0.75 && !b.invulnTriggered.p75) {
        b.invulnTriggered.p75 = true;
        b.invulnState = "PYLONS_75";
        b.shielded = true;
        b.lastPatternText = "🛡️ 핏빛 기둥 4개 파괴";
        SoundFX.play("alarm");
        const bossRoom = game.rooms[game.rooms.length - 1];
        const off = Math.min(bossRoom.hw || 45, bossRoom.hd || 45) - 12;
        const pylonScale = 1.0 + Math.max(0, activeSquadCount - 1) * 0.70;
        const pylonHp = Math.round(9200 * pylonScale);
        const spawnedPylons = [];
        [[-off, -off], [off, -off], [-off, off], [off, off]].forEach((co, pIdx) => {
          const safe = getSafeBossCoreCoord(bossRoom.wx + co[0], bossRoom.wz + co[1], bossRoom, spawnedPylons, 16.0);
          spawnedPylons.push(safe);
          const px = safe.x;
          const pz = safe.z;
          const pMesh = new THREE.Mesh(
            new THREE.CylinderGeometry(1.1, 1.4, 5.5, 10),
            new THREE.MeshStandardMaterial({ color: 0xf43f5e, emissive: 0xbe123c, emissiveIntensity: 0.8 })
          );
          pMesh.position.set(px, 2.75, pz);
          entitiesGroup.add(pMesh);
          const pObj = { x: px, z: pz, hp: pylonHp, maxHp: pylonHp, mesh: pMesh, isPylon: true };
          game.bloodPylons.push(pObj);
          registerWorldSymbol(
            px, 3.8, pz,
            `🩸핏빛기둥#${pIdx + 1}[집중파괴]`,
            "bg-rose-950/90 border-rose-500 text-rose-200 animate-pulse",
            pObj, bossRoom.index
          );
        });
      } else if (ratio <= 0.50 && !b.invulnTriggered.p50) {
        b.invulnTriggered.p50 = true;
        b.phase = 2;
        b.invulnState = "LASERS_50";
        b.shielded = true;
        game.laserTimer = 15.0;
        b.laserGroup.visible = true;
        b.fleshMat.color.setHex(0xbe123c);
        b.lastPatternText = "🛡️ 회전 레이저 [Space] 회피";
        SoundFX.play("alarm");
      } else if (ratio <= 0.25 && !b.invulnTriggered.p25) {
        b.invulnTriggered.p25 = true;
        b.phase = 3;
        b.invulnState = "HOSTS_25";
        b.shielded = true;
        b.fleshMat.color.setHex(0xf43f5e);
        b.lastPatternText = "🛡️ 황금 숙주 4마리 저지";
        SoundFX.play("alarm");
        const bossRoom = game.rooms[game.rooms.length - 1];
        const off = bossRoom.half - 8;
        [[-off, 0], [off, 0], [0, -off], [0, off]].forEach(co => {
          spawnZombie("HOST", bossRoom.wx + co[0], bossRoom.wz + co[1], bossRoom.index);
        });
      }

      if (b.hp <= 0) {
        b.dead = true;
        clearBossGrapple();
        triggerExplosion(b.x, b.z, 12.0, 999, -1, false);
        entitiesGroup.remove(b.group);
        finishGameSession(true);
      }
    }

    function damagePlayer(player, dmg, causesBleed, causesAcid, causesShock, causesFrost) {
      if (player.downed || player.dashActiveTimer > 0 || !game.running) return;

      // Cancel self-bandaging if hit hard
      if (player.bandagingTimer > 0 && dmg > 8) {
        player.bandagingTimer = 0;
      }

      // [선봉장 특성화] 상시 피해 -20% 경감 및 [C] 결사 요새 발동 중 추가 -50% 피해 경감
      let inDmg = dmg;
      if (player.specialization === "JUGGERNAUT") {
        inDmg *= 0.80;
        if (player.specActiveTimer > 0) {
          inDmg *= 0.50;
        }
      }

      // [v3.2 케블라 방탄 외골격] 받는 모든 피해 영구 경감 (-6%/Lv, 최대 -30%)
      const red = getPlayerDmgReduction(player);
      const isDoT = (dmg < 3.5);
      // [급사 버그 완벽 수정] 독가스/동상/출혈 등 dt 단위 지속 피해는 실수치 그대로 차감
      let rem = isDoT ? (inDmg * (1 - red)) : Math.max(1, Math.round(inDmg * (1 - red)));

      // [선봉장 고유 방어 1] 잡좀비 다구리 방어용 고정 피해 감쇄 (-4 고정 차감, 최소 1)
      if (player.specialization === "JUGGERNAUT" && !isDoT) {
        rem = Math.max(1, rem - 4);
      }

      // [선봉장 고유 방어 2] 치명적인 강타 피해 상한 캡 (최대 HP의 25% 초과 불가, 원콤 급사 방지!)
      if (player.specialization === "JUGGERNAUT" && !isDoT) {
        const maxSingleHit = Math.max(30, Math.round(player.maxHp * 0.25));
        if (rem > maxSingleHit) rem = maxSingleHit;
      }

      // [선봉장 고유 방어 3] 근접 피격 가시 반사 충격파 (2초 쿨다운, 스태미너 15 소모, 주변 2.5m 35% 반사 & 1.5m 넉백)
      if (player.specialization === "JUGGERNAUT" && !isDoT && (player.thornsCooldown || 0) <= 0 && (player.stamina || 0) >= 15) {
        player.thornsCooldown = 2.0;
        player.stamina = Math.max(0, player.stamina - 15);
        const reflectDmg = Math.max(12, Math.round(dmg * 0.35));
        spawnMissionStageVFX(player.x, player.z, 0xf59e0b, 2.5, 12, false);
        SoundFX.play("explosion");
        for (let zi = game.zombies.length - 1; zi >= 0; zi--) {
          const z = game.zombies[zi];
          const distZ = Math.hypot(z.x - player.x, z.z - player.z);
          if (distZ <= 2.5) {
            const kx = ((z.x - player.x) / (distZ || 1)) * 1.5;
            const kz = ((z.z - player.z) / (distZ || 1)) * 1.5;
            damageZombie(zi, reflectDmg, kx, kz, 0.45, -1);
          }
        }
      }

      // 피격 카운터 리셋 (키네틱 에너지 쉴드 4.5초 자동 재생 지연)
      player.timeSinceLastHit = 0;

      // [키네틱 에너지 쉴드 흡수] 외골격 자동 재생 임시 쉴드로 우선 차감!
      if ((player.shield || 0) > 0) {
        const absorbedEnergyShield = Math.min(player.shield, rem);
        player.shield -= absorbedEnergyShield;
        rem -= absorbedEnergyShield;
        if (!isDoT && absorbedEnergyShield > 0) {
          spawnBloodParticles(player.x, 1.2, player.z, 0x38bdf8, 3);
        }
      }

      // [선봉장 결사 요새 임시 쉴드] 쉴드로 먼저 흡수!
      if (player.tempShield > 0) {
        const absorbedShield = Math.min(player.tempShield, rem);
        player.tempShield -= absorbedShield;
        rem -= absorbedShield;
      }

      // Absorb with Temporary HP (Adrenaline Stim) first!
      if (player.tempHp > 0) {
        const absorbed = Math.min(player.tempHp, rem);
        player.tempHp -= absorbed;
        rem -= absorbed;
      }
      player.hp = Math.max(0, player.hp - rem);

      // [v3.2] 스팀팩 폭주 중에는 모든 상태이상 및 군중제어 완전 면역! 선봉장은 상태이상 지속시간 50% 단축!
      if (player.stimBuffTimer <= 0) {
        const durMult = player.specialization === "JUGGERNAUT" ? 0.50 : 1.0;
        if (causesBleed && Math.random() < 0.35) player.bleedingTimer = 8.0 * durMult;
        if (causesAcid) player.acidTimer = 6.0 * durMult;
        if (causesShock) player.shockTimer = 4.5 * durMult;
        if (causesFrost) player.frostTimer = 4.0 * durMult;
      }

      if (!isDoT) {
        spawnBloodParticles(player.x, 1.2, player.z, 0xef4444, 2);

        if (player.id === mySlotIndex && userSettings.damageVignette) {
          const vig = document.getElementById("damage-vignette");
          if (vig) {
            vig.style.opacity = "0.85";
            setTimeout(() => {
              if (!player.downed && vig) vig.style.opacity = "0";
            }, 240);
          }
        }
      }

      if (player.hp <= 0) {
        player.downed = true;
        console.warn(`[DOWNED] Player #${player.id} has been downed!`);
        player.bandagingTimer = 0;
        if (player.carryingPayload) {
          player.wasCarryingPayload = true;
          player.carryingPayload = false;
        }
        player.reviveProgress = 0;
        player.revivingTargetId = null;
        player.currentWeapon = 0;
        player.visual.body.rotation.x = Math.PI / 2.2;
        player.visual.body.position.y = 0.45;
        player.visual.head.position.set(0, 0.65, 0.55);
        player.visual.ringMat.opacity = 0.75;

        if (player.id === mySlotIndex) updateWeaponSlotsHUD();

        const anyAlive = game.players.some(p => !p.downed);
        if (!anyAlive) finishGameSession(false);
      }
    }

    function spawnBloodParticles(x, y, z, colorHex, count) {
      if (userSettings.gfxQuality === "fast" && game.particles.length > 20) return;
      if (game.particles.length > 65) return; // Cap particles for 60fps
      for (let i = 0; i < count; i++) {
        const m = new THREE.Mesh(SHARED_GEO.bloodParticle, new THREE.MeshBasicMaterial({ color: colorHex }));
        m.position.set(x, y, z);
        effectsGroup.add(m);
        game.particles.push({
          mesh: m,
          vx: (Math.random() - 0.5) * 6,
          vy: 2 + Math.random() * 4,
          vz: (Math.random() - 0.5) * 6,
          life: 0.35,
          maxLife: 0.35
        });
      }
    }
