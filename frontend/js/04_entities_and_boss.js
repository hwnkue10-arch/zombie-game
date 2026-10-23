/**
 * =========================================================================
 * BOXHEAD: THE CORE v3.1 — Frontend Module: 04_entities_and_boss.js
 * Zero-Loss Refactored Architecture (Shared Global Lexical Scope)
 * =========================================================================
 */
"use strict";

    // =========================================================================
    // 7. ORGANIC HEART BOSS ('THE CORE') + 3 INVULNERABILITY MECHANICS
    // =========================================================================
    function createOrganicHeartBoss(room) {
      const bossGroup = new THREE.Group();
      const bx = room.wx;
      const bz = room.wz;
      bossGroup.position.set(bx, 0, bz);

      const fleshMat = new THREE.MeshStandardMaterial({
        color: 0x991b1b, emissive: 0x7f1d1d, emissiveIntensity: 0.65, roughness: 0.35
      });
      const innerCoreMat = new THREE.MeshStandardMaterial({
        color: 0xfef08a, emissive: 0xf43f5e, emissiveIntensity: 1.15, roughness: 0.2
      });

      const coreCluster = new THREE.Group();
      const mainLobe = new THREE.Mesh(new THREE.IcosahedronGeometry(3.8, 2), fleshMat);
      mainLobe.position.set(0, 3.6, 0);
      mainLobe.scale.set(1.15, 1.38, 1.0);
      coreCluster.add(mainLobe);

      const leftVentricle = new THREE.Mesh(new THREE.IcosahedronGeometry(2.7, 2), fleshMat);
      leftVentricle.position.set(-2.3, 2.8, 1.1);
      coreCluster.add(leftVentricle);

      const rightAtrium = new THREE.Mesh(new THREE.IcosahedronGeometry(2.5, 2), fleshMat);
      rightAtrium.position.set(2.4, 4.1, -0.9);
      coreCluster.add(rightAtrium);

      const nucleusMesh = new THREE.Mesh(new THREE.IcosahedronGeometry(2.0, 1), innerCoreMat);
      nucleusMesh.position.set(0, 3.8, 2.0);
      coreCluster.add(nucleusMesh);

      bossGroup.add(coreCluster);

      // Organic Arteries
      const veinMat = new THREE.MeshStandardMaterial({
        color: 0x450a0a, emissive: 0x7f1d1d, emissiveIntensity: 0.45
      });
      for (let a = 0; a < 12; a++) {
        const angle = (a / 12) * Math.PI * 2;
        const curve = new THREE.CatmullRomCurve3([
          new THREE.Vector3(0, 3.2, 0),
          new THREE.Vector3(Math.cos(angle) * 5.5, 1.6, Math.sin(angle) * 5.5),
          new THREE.Vector3(Math.cos(angle + 0.25) * 12.5, 0.4, Math.sin(angle + 0.25) * 12.5),
          new THREE.Vector3(Math.cos(angle - 0.15) * 20.0, 0.15, Math.sin(angle - 0.15) * 20.0)
        ]);
        const tubeMesh = new THREE.Mesh(new THREE.TubeGeometry(curve, 16, 0.45, 8, false), veinMat);
        bossGroup.add(tubeMesh);
      }

      // Invulnerability Shield Dome
      const shieldMat = new THREE.MeshBasicMaterial({
        color: 0x06b6d4, wireframe: true, transparent: true, opacity: 0.0
      });
      const shieldMesh = new THREE.Mesh(new THREE.SphereGeometry(6.2, 24, 18), shieldMat);
      shieldMesh.position.set(0, 3.6, 0);
      bossGroup.add(shieldMesh);

      // 4-Way Rotating Bio-Laser Beams (Used during 50% HP Invulnerability Pattern)
      const laserGroup = new THREE.Group();
      const laserMat = new THREE.MeshBasicMaterial({ color: 0xf43f5e, transparent: true, opacity: 0.88 });
      for (let l = 0; l < 4; l++) {
        const lBeam = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.45, 36, 8), laserMat);
        lBeam.rotation.z = Math.PI / 2;
        const holder = new THREE.Group();
        lBeam.position.set(18, 1.1, 0);
        holder.add(lBeam);
        holder.rotation.y = (l * Math.PI) / 2;
        laserGroup.add(holder);
      }
      laserGroup.visible = false;
      bossGroup.add(laserGroup);

      entitiesGroup.add(bossGroup);

      const maxHp = game.pacing === "marathon" ? 90000 : (game.pacing === "blitz" ? 28000 : 55000);
      game.boss = {
        x: bx, z: bz,
        radius: 4.5,
        hp: maxHp,
        maxHp,
        phase: 1,
        active: false,
        dead: false,
        invulnState: "NONE", // 'NONE', 'PYLONS_75', 'LASERS_50', 'HOSTS_25'
        invulnTriggered: { p75: false, p50: false, p25: false },
        groggyTimer: 0,
        shielded: false,
        group: bossGroup,
        coreCluster,
        fleshMat,
        shieldMat,
        laserGroup,
        pulseTime: 0,
        patternTimer: 4.0,
        lastPatternText: "심장 박동 대기 중...",
        grappleTarget: null,
        grappleLine: null,
        grappleHp: 0
      };
    }

    // =========================================================================
    // 8. SQUAD CHARACTERS, MEDICAL SYSTEM & SHARED AMMO POOLS
    // =========================================================================
    function createBoxheadCharacterMesh(colorHex) {
      const group = new THREE.Group();
      const legGeo = new THREE.BoxGeometry(0.38, 0.65, 0.38);
      const legMat = new THREE.MeshStandardMaterial({ color: 0x1e293b });
      const leftLeg = new THREE.Mesh(legGeo, legMat);
      leftLeg.position.set(-0.22, 0.32, 0);
      const rightLeg = new THREE.Mesh(legGeo, legMat);
      rightLeg.position.set(0.22, 0.32, 0);
      group.add(leftLeg, rightLeg);

      const body = new THREE.Mesh(
        new THREE.BoxGeometry(0.92, 0.95, 0.56),
        new THREE.MeshStandardMaterial({ color: colorHex, roughness: 0.5 })
      );
      body.position.set(0, 1.1, 0);
      body.castShadow = true;
      group.add(body);

      const head = new THREE.Mesh(
        new THREE.BoxGeometry(0.88, 0.88, 0.88),
        new THREE.MeshStandardMaterial({ color: 0xfde68a, roughness: 0.6 })
      );
      head.position.set(0, 2.02, 0);
      head.castShadow = true;
      group.add(head);

      const band = new THREE.Mesh(
        new THREE.BoxGeometry(0.92, 0.22, 0.92),
        new THREE.MeshStandardMaterial({ color: colorHex })
      );
      band.position.set(0, 2.25, 0);
      group.add(band);

      const gunMesh = new THREE.Mesh(
        new THREE.BoxGeometry(0.22, 0.24, 0.95),
        new THREE.MeshStandardMaterial({ color: 0xe2e8f0, metalness: 0.5 })
      );
      gunMesh.position.set(0.55, 1.18, 0.48);
      group.add(gunMesh);

      // [v3.1 버그 수정] 일반 밝은 섹터에서는 손전등 조명 및 원뿔 빔을 완전히 비활성화(visible = false, intensity = 0)
      const flashLight = new THREE.PointLight(0xfffbeb, 0.0, 26, 1.6);
      flashLight.position.set(0, 2.2, 1.1);
      flashLight.visible = false;
      group.add(flashLight);

      const coneGeo = new THREE.ConeGeometry(3.2, 11.5, 16, 1, true);
      coneGeo.rotateX(Math.PI / 2);
      const flashCone = new THREE.Mesh(
        coneGeo,
        new THREE.MeshBasicMaterial({ color: 0xfef08a, transparent: true, opacity: 0.13, side: THREE.DoubleSide, depthWrite: false })
      );
      flashCone.position.set(0, 1.15, 6.2);
      flashCone.visible = false;
      group.add(flashCone);
      const ringMat = new THREE.MeshBasicMaterial({ color: 0xef4444, side: THREE.DoubleSide, transparent: true, opacity: 0.0 });
      const sosRing = new THREE.Mesh(new THREE.RingGeometry(1.0, 1.25, 24), ringMat);
      sosRing.rotation.x = -Math.PI / 2;
      sosRing.position.y = 0.06;
      group.add(sosRing);

      return { group, body, head, leftLeg, rightLeg, gunMesh, ringMat, flashLight, flashCone };
    }

    function spawnSquadPlayers() {
      const startRoom = game.rooms[0];
      const offsets = [[0, 0], [-3.5, -3.0], [3.5, -3.0], [0, -5.0]];

      lobbySlots.forEach((slot, idx) => {
        if (slot.role === "EMPTY" || slot.role === "AI") return;
        const visual = createBoxheadCharacterMesh(slot.color);
        const sx = startRoom.wx + offsets[idx][0];
        const sz = startRoom.wz + offsets[idx][1];
        visual.group.position.set(sx, 0, sz);
        entitiesGroup.add(visual.group);

        // 모든 총기·바리케이드·폭약통이 각자의 전용 탄약(ammo, maxAmmo)과 10Lv 1차 특수강화(tier1Special), 20Lv 최종각성(awakened)을 개별 보유!
        const inventory = WEAPONS.map(w => ({
          unlocked: w.unlockedAtStart,
          stats: { atk: 0, spd: 0, area: 0, stun: 0, knock: 0 },
          totalLv: 0,
          tier1Special: false,
          awakened: false,
          transcended: false,
          ammo: w.startAmmo,
          maxAmmo: w.maxAmmo
        }));

        const labelEl = document.createElement("div");
        labelEl.className = "absolute transform -translate-x-1/2 -translate-y-full pointer-events-none text-center";
        const hexC = "#" + slot.color.toString(16).padStart(6, "0");
        if (idx === mySlotIndex) {
          labelEl.innerHTML = `
            <div class="flex flex-col items-center gap-1">
              <div class="char-nickname px-2 py-0.5 rounded-md bg-slate-950/90 border text-xs font-extrabold text-white shadow-md whitespace-nowrap" style="border-color:${hexC}">${slot.name}</div>
              <div class="w-14 h-2 bg-slate-950/95 rounded-full overflow-hidden border border-white/30 flex shadow">
                <div class="char-mini-hp bg-emerald-400 h-full transition-all duration-75" style="width:100%"></div>
                <div class="char-mini-temp bg-amber-300 h-full transition-all duration-75" style="width:0%"></div>
              </div>
              <div class="flex items-center gap-1.5">
                <span class="char-dot-dash w-2 h-2 rounded-full bg-cyan-400 shadow"></span>
                <span class="char-dot-bash w-2 h-2 rounded-full bg-rose-400 shadow"></span>
              </div>
            </div>
          `;
        } else {
          labelEl.innerHTML = `
            <div class="flex flex-col items-center gap-1">
              <div class="char-nickname px-2 py-0.5 rounded-md bg-slate-950/85 border text-[11px] font-bold text-slate-100 shadow-md whitespace-nowrap" style="border-color:${hexC}">${slot.name}</div>
              <div class="w-12 h-1.5 bg-slate-950/95 rounded-full overflow-hidden border border-white/25 flex shadow">
                <div class="char-mini-hp bg-emerald-400 h-full transition-all duration-75" style="width:100%"></div>
              </div>
              <div class="revive-badge hidden px-2 py-0.5 rounded-md bg-rose-600/95 border border-white/40 text-[11px] font-extrabold text-white shadow-lg">
                🚑 [F] 구출
              </div>
            </div>
          `;
        }
        document.getElementById("floating-labels").appendChild(labelEl);

        game.players.push({
          id: idx,
          name: slot.name,
          role: slot.role,
          color: slot.color,
          x: sx, z: sz,
          rotY: 0,
          hp: 100,
          maxHp: 100,
          tempHp: 0,
          bleedingTimer: 0,
          acidTimer: 0,
          medkits: 1,
          stims: 1,
          stamina: 50,
          maxStamina: 50,
          staminaExhaustTimer: 0,
          isSprinting: false,
          suitUpgrades: {
            medkitCap: 0,
            stimCap: 0,
            maxStamina: 0,
            staminaRegen: 0,
            dashCd: 0,
            bashCd: 0,
            syringe: 0
          },
          bandagingTimer: 0,
          stimBuffTimer: 0,
          dashCooldown: 0,
          bashCooldown: 0,
          dashActiveTimer: 0,
          dashDirX: 0,
          dashDirZ: 0,
          swapOverchargeTimer: 0,
          ammoPools: { LIGHT: 160, HEAVY: 85, ENERGY: 10 },
          downed: false,
          reviveProgress: 0,
          revivingTargetId: null,
          carryingPayload: false,
          currentWeapon: 0,
          inventory,
          fireCooldown: 0,
          walkCycle: 0,
          visual,
          labelEl
        });
      });
    }

    function getResonanceCount(player) {
      let c = 0;
      player.inventory.forEach(inv => {
        if (inv.unlocked && inv.totalLv >= 5) c++;
      });
      return c;
    }

    function getWeaponMaxAmmo(player, wIdx) {
      const w = WEAPONS[wIdx];
      if (!w || w.infinite) return 999;
      const resBonus = 1 + getResonanceCount(player) * 0.12;
      return Math.round(w.maxAmmo * resBonus);
    }

    function getMaxAmmoPool(player, type) {
      return 999;
    }

    // =========================================================================
    // 9. ZOMBIE SWARM & 3 MID-BOSSES + NUTRIENT HOSTS
    // =========================================================================
    const ZOMBIE_TYPES = {
      WALKER:   { name: "일반 감염체", hp: 74, speed: 3.55, dmg: 14, scale: 1.0, skin: 0x65a30d, clothes: 0x3f3f46, bp: 5 },
      RUNNER:   { name: "러너 감염체", hp: 56, speed: 7.25, dmg: 13, scale: 0.92, skin: 0xdc2626, clothes: 0x7f1d1d, bp: 6, causesBleed: true },
      SPITTER:  { name: "맹독 스핏터(원거리)", hp: 105, speed: 4.15, dmg: 15, scale: 1.08, skin: 0x06b6d4, clothes: 0x581c87, bp: 10, ranged: true, isSpitter: true },
      GOLIATH:  { name: "골리앗 중장갑체", hp: 360, speed: 3.10, dmg: 28, scale: 1.6, skin: 0x4d7c0f, clothes: 0x1e1b4b, bp: 16, armored: true },
      BOOMER:   { name: "맹독 자폭체", hp: 96, speed: 2.85, dmg: 42, scale: 1.22, skin: 0xa3e635, clothes: 0x365314, bp: 9, explosive: true },
      DEVIL:    { name: "블러드 데빌(3연발원거리)", hp: 230, speed: 3.45, dmg: 22, scale: 1.3, skin: 0xef4444, clothes: 0x450a0a, bp: 18, ranged: true, armored: true },
      HOST:     { name: "황금 영양 숙주", hp: 480, speed: 2.15, dmg: 0, scale: 1.35, skin: 0xfacc15, clothes: 0x854d0e, bp: 25, isNutrientHost: true },
      // 3 Raid-Boss-Tier Mid-Bosses (4인 중화기 집중포화에도 버티는 레이드급 체력 + 50% 체력 무적 기믹 + 처치 시 바닥에 🧬변이 코어 드랍!)
      MB_JUGGERNAUT: { name: "중간보스 I: 아머드 저거넛", hp: 18500, speed: 3.45, dmg: 44, scale: 2.55, skin: 0xf97316, clothes: 0x0f172a, bp: 320, isMidBoss: true, armored: true },
      MB_SUMMONER:   { name: "중간보스 II: 네크로 서모너", hp: 16500, speed: 3.15, dmg: 32, scale: 2.35, skin: 0xa855f7, clothes: 0x3b0764, bp: 350, isMidBoss: true, ranged: true },
      MB_ACIDQUEEN:  { name: "중간보스 III: 애시드 퀸", hp: 17800, speed: 3.30, dmg: 36, scale: 2.45, skin: 0x84cc16, clothes: 0x14532d, bp: 380, isMidBoss: true, ranged: true }
    };

    function spawnZombie(typeKey, x, z, roomIndex) {
      const spec = ZOMBIE_TYPES[typeKey] || ZOMBIE_TYPES.WALKER;
      const group = new THREE.Group();
      const s = spec.scale;

      const bodyMat = new THREE.MeshStandardMaterial({ color: spec.clothes });
      const skinMat = new THREE.MeshStandardMaterial({
        color: spec.skin,
        emissive: spec.isMidBoss ? spec.skin : (spec.isNutrientHost ? 0xca8a04 : 0x000000),
        emissiveIntensity: spec.isMidBoss ? 0.65 : 0.35
      });

      const body = new THREE.Mesh(SHARED_GEO.zBody, bodyMat);
      body.scale.set(s, s, s);
      body.position.y = 0.85 * s;
      group.add(body);

      const head = new THREE.Mesh(SHARED_GEO.zHead, skinMat);
      head.scale.set(s, s, s);
      head.position.y = 1.78 * s;
      group.add(head);

      // [v3.1 블랙아웃 호러 연출] 스핏터(청록 안광)·러너/데빌(핏빛 안광) 발광 눈빛 추가
      if (spec.isSpitter || typeKey === "RUNNER" || typeKey === "DEVIL" || spec.isMidBoss) {
        const eyeColor = spec.isSpitter ? 0x22d3ee : 0xef4444;
        const eyeMat = new THREE.MeshBasicMaterial({ color: eyeColor });
        const eyeGeo = new THREE.BoxGeometry(0.14 * s, 0.10 * s, 0.08 * s);
        const eyeL = new THREE.Mesh(eyeGeo, eyeMat);
        eyeL.position.set(-0.18 * s, 1.82 * s, 0.42 * s);
        const eyeR = new THREE.Mesh(eyeGeo, eyeMat);
        eyeR.position.set(0.18 * s, 1.82 * s, 0.42 * s);
        group.add(eyeL, eyeR);
      }

      const armL = new THREE.Mesh(SHARED_GEO.zArm, skinMat);
      armL.scale.set(s, s, s);
      armL.position.set(-0.52 * s, 1.15 * s, 0.35 * s);
      const armR = new THREE.Mesh(SHARED_GEO.zArm, skinMat);
      armR.scale.set(s, s, s);
      armR.position.set(0.52 * s, 1.15 * s, 0.35 * s);
      group.add(armL, armR);

      let mbShieldMesh = null;
      if (spec.isMidBoss) {
        mbShieldMesh = new THREE.Mesh(
          new THREE.SphereGeometry(2.6, 18, 14),
          new THREE.MeshBasicMaterial({ color: 0x22d3ee, wireframe: true, transparent: true, opacity: 0.0 })
        );
        mbShieldMesh.position.y = 2.2;
        group.add(mbShieldMesh);
      }

      // [v3.1 빙결 시각화] 완전 빙결 시 감염체를 감싸는 투명 극저온 얼음 결정 케이스
      const iceGeo = new THREE.BoxGeometry(1.28 * s, 2.35 * s, 1.28 * s);
      const iceMat = new THREE.MeshStandardMaterial({
        color: 0x38bdf8,
        emissive: 0x0284c7,
        emissiveIntensity: 0.45,
        transparent: true,
        opacity: 0.72,
        roughness: 0.1,
        metalness: 0.15
      });
      const iceBlock = new THREE.Mesh(iceGeo, iceMat);
      iceBlock.position.y = 1.15 * s;
      iceBlock.visible = false;
      group.add(iceBlock);

      group.position.set(x, 0, z);
      entitiesGroup.add(group);

      // [v3.1] 섹터별 강화 한계치(Lv.5->Lv.50)에 맞춘 정밀 스펙 스케일링: 체력 1.27^섹터, 공격력 +12%/섹터
      const hpScale = spec.isMidBoss ? (1 + roomIndex * 0.16) : Math.pow(1.27, roomIndex);
      const dmgScale = 1 + roomIndex * 0.12;
      const zObj = {
        typeKey,
        spec,
        x, z,
        hp: Math.round(spec.hp * hpScale),
        maxHp: Math.round(spec.hp * hpScale),
        scaledDmg: Math.round(spec.dmg * dmgScale),
        speed: spec.speed * (1 + roomIndex * 0.018) * (0.95 + Math.random() * 0.10),
        specialTimer: 3.2,
        chargeTimer: 0,
        chargeDirX: 0,
        chargeDirZ: 0,
        channelingTimer: 0,
        channelingKind: "",
        berserkEnraged: false,
        skinMat,
        mbPhase2Triggered: false,
        mbShieldActive: false,
        mbGroggyTimer: 0,
        mbShieldMesh,
        iceBlock,
        freezeTimer: 0,
        slideDir: 0,
        slideTimer: 0,
        tenacity: Math.min(0.70, roomIndex * 0.075),
        radius: 0.55 * s,
        roomIndex,
        stunTimer: 0,
        attackCooldown: 0,
        rangedCooldown: 2.0,
        group
      };
      game.zombies.push(zObj);
      if (spec.isMidBoss) {
        game.midBoss = zObj;
      }
      return zObj;
    }

    function spawnSupplyCrate(x, z, roomIndex, crateOrder) {
      const group = new THREE.Group();
      const isPartCrate = (crateOrder || 0) === 0;
      const boxMesh = new THREE.Mesh(
        new THREE.BoxGeometry(1.8, 1.2, 1.8),
        new THREE.MeshStandardMaterial({ color: isPartCrate ? 0x0284c7 : 0xd97706, roughness: 0.5 })
      );
      boxMesh.position.y = 0.6;
      group.add(boxMesh);
      const strap = new THREE.Mesh(
        new THREE.BoxGeometry(1.9, 0.25, 1.9),
        new THREE.MeshBasicMaterial({ color: 0xfef08a })
      );
      strap.position.y = 1.15;
      group.add(strap);
      group.position.set(x, 0, z);
      entitiesGroup.add(group);
      const crateObj = { x, z, roomIndex, crateOrder: crateOrder || 0, opened: false, group };
      game.crates.push(crateObj);
      registerWorldSymbol(
        x, 2.2, z,
        isPartCrate ? "📦보급상자(⚙️부품+탄약)" : "📦보급상자(탄약·부품50%)",
        isPartCrate ? "bg-sky-950/90 border-sky-400 text-sky-200" : "bg-amber-950/90 border-amber-400 text-amber-200",
        crateObj, roomIndex
      );
    }

    function spawnPickup(x, z, kind) {
      if (kind === "CORE") {
        // 바닥에 드랍되는 🧬변이 코어 — 플레이어가 직접 걸어가서 먹어야 획득됨!
        const cGroup = new THREE.Group();
        const crystal = new THREE.Mesh(
          new THREE.OctahedronGeometry(0.85, 0),
          new THREE.MeshStandardMaterial({ color: 0xe879f9, emissive: 0xc026d3, emissiveIntensity: 1.1, roughness: 0.15 })
        );
        crystal.position.y = 1.05;
        cGroup.add(crystal);

        const ring1 = new THREE.Mesh(
          new THREE.TorusGeometry(1.15, 0.10, 8, 24),
          new THREE.MeshBasicMaterial({ color: 0x22d3ee })
        );
        ring1.rotation.x = Math.PI / 2;
        ring1.position.y = 0.25;
        cGroup.add(ring1);

        const ring2 = new THREE.Mesh(
          new THREE.TorusGeometry(0.95, 0.08, 8, 20),
          new THREE.MeshBasicMaterial({ color: 0xf43f5e })
        );
        ring2.position.y = 1.05;
        cGroup.add(ring2);

        cGroup.position.set(x, 0, z);
        entitiesGroup.add(cGroup);
        const pkObj = { x, z, kind: "CORE", mesh: cGroup };
        game.pickups.push(pkObj);
        registerWorldSymbol(
          x, 2.5, z,
          "🧬변이코어[획득]",
          "bg-fuchsia-950/95 border-fuchsia-400 text-fuchsia-200 animate-bounce",
          pkObj, game.currentRoomIndex
        );
        return;
      }

      const colorMap = {
        AMMO_PACK: 0x38bdf8,
        AMMO_LIGHT: 0x38bdf8,
        AMMO_HEAVY: 0x4ade80,
        AMMO_ENERGY: 0xf43f5e,
        PART: 0xfacc15,
        MEDKIT: 0x10b981,
        STIM: 0xeab308
      };
      const c = colorMap[kind] || 0xfacc15;
      const mesh = new THREE.Mesh(
        kind === "PART" ? new THREE.OctahedronGeometry(0.65, 0) : new THREE.BoxGeometry(0.9, 0.7, 0.9),
        new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: 0.65 })
      );
      mesh.position.set(x, 0.55, z);
      entitiesGroup.add(mesh);
      const pkObj = { x, z, kind, mesh };
      game.pickups.push(pkObj);
      if (kind === "PART") {
        registerWorldSymbol(
          x, 2.0, z,
          "⚙️무기부품[획득]",
          "bg-amber-950/95 border-amber-400 text-amber-200",
          pkObj, game.currentRoomIndex
        );
      }
    }

    function spawnBarricade(x, z, awakened, stats, nx, nz, tier1Special, ownerId) {
      const st = stats || { atk: 0, spd: 0, area: 0, stun: 0, knock: 0 };
      const pid = ownerId !== undefined ? ownerId : mySlotIndex;
      // 일반 방벽은 설치 수 제한 없이 전술 배치 가능 (단, 상단 자동 센트리 포탑만 인당 최대 3기 제한 유지)
      const sizeScale = 1 + st.area * 0.18;
      const isVertical = Math.abs(nx || 0) > Math.abs(nz || 0);
      const barLen = 2.9 * sizeScale;
      const barThick = 0.95;

      const bGroup = new THREE.Group();
      const baseColor = awakened ? 0x0891b2 : (tier1Special ? 0x4f46e5 : 0x78716c);
      const baseWallMat = new THREE.MeshStandardMaterial({
        color: baseColor,
        roughness: 0.65
      });
      const baseWall = new THREE.Mesh(
        new THREE.BoxGeometry(barLen, 1.35, barThick),
        baseWallMat
      );
      baseWall.position.y = 0.68;
      bGroup.add(baseWall);

      const topRailMat = new THREE.MeshStandardMaterial({
        color: awakened ? 0x22d3ee : (tier1Special ? 0xa855f7 : 0xfacc15),
        emissive: awakened ? 0x06b6d4 : (tier1Special ? 0x7e22ce : 0x854d0e),
        emissiveIntensity: 0.55
      });
      const topRail = new THREE.Mesh(
        new THREE.BoxGeometry(barLen + 0.1, 0.26, barThick + 0.12),
        topRailMat
      );
      topRail.position.y = 1.42;
      bGroup.add(topRail);

      // 1. 3D 내구도 게이지 바 (바리케이드 상단에 직관적으로 표시)
      const hpBg = new THREE.Mesh(
        new THREE.BoxGeometry(barLen * 0.86, 0.11, 0.14),
        new THREE.MeshBasicMaterial({ color: 0x090d16 })
      );
      hpBg.position.set(0, 1.72, 0);
      bGroup.add(hpBg);

      const hpFillMat = new THREE.MeshBasicMaterial({ color: 0x10b981 });
      const hpFill = new THREE.Mesh(
        new THREE.BoxGeometry(barLen * 0.84, 0.13, 0.16),
        hpFillMat
      );
      hpFill.position.set(0, 1.72, 0);
      bGroup.add(hpFill);

      // 2. 중파(체력 65% 이하) 시각적 균열 그룹 (검은 톱니형 크랙 라인들)
      const crackGroupMed = new THREE.Group();
      const crackDarkMat = new THREE.MeshBasicMaterial({ color: 0x090d16 });
      [-0.85, -0.25, 0.35, 0.9].forEach((cx, idx) => {
        const cr = new THREE.Mesh(
          new THREE.BoxGeometry(0.08, 0.88, barThick + 0.06),
          crackDarkMat
        );
        cr.position.set(cx * sizeScale, 0.68 + (idx % 2) * 0.15, 0);
        cr.rotation.z = (idx % 2 === 0 ? 0.38 : -0.42);
        crackGroupMed.add(cr);
      });
      crackGroupMed.visible = false;
      bGroup.add(crackGroupMed);

      // 3. 대파 직전(체력 35% 이하) 심각한 균열·파손·적열 크랙 그룹
      const crackGroupLow = new THREE.Group();
      const crackRedMat = new THREE.MeshBasicMaterial({ color: 0xef4444 });
      [-0.65, 0.0, 0.65].forEach((cx, idx) => {
        const cr1 = new THREE.Mesh(
          new THREE.BoxGeometry(0.11, 1.18, barThick + 0.09),
          crackRedMat
        );
        cr1.position.set(cx * sizeScale, 0.72, 0);
        cr1.rotation.z = (idx === 1 ? -0.52 : 0.48);
        crackGroupLow.add(cr1);
      });
      crackGroupLow.visible = false;
      bGroup.add(crackGroupLow);

      if (awakened || tier1Special) {
        const turret = new THREE.Mesh(
          new THREE.CylinderGeometry(0.35, 0.45, 0.6, 8),
          new THREE.MeshBasicMaterial({ color: awakened ? 0x22d3ee : 0xc084fc })
        );
        turret.position.y = 1.95;
        bGroup.add(turret);
      }

      if (isVertical) {
        bGroup.rotation.y = Math.PI / 2;
      }
      bGroup.position.set(x, 0, z);
      entitiesGroup.add(bGroup);

      // [v3.1] 인당 동시 가동 센트리 포탑 최대 3기 제한 + 내장 탄약 160~340발 + 탄약 소진 시 8초 냉각 후 100% 재장전!
      const activeTurrets = game.barricades.filter(b => b.ownerId === pid && b.hasTurret);
      const canMountTurret = (awakened || tier1Special) && (activeTurrets.length < 3);
      const maxTurretAmmo = 160 + (st.atk || 0) * 18 + (st.area || 0) * 18;

      const maxHpVal = 380 + st.spd * 170 + (tier1Special ? 220 : 0);
      game.barricades.push({
        ownerId: pid,
        x, z,
        hw: isVertical ? (barThick / 2) : (barLen / 2),
        hd: isVertical ? (barLen / 2) : (barThick / 2),
        hp: maxHpVal,
        maxHp: maxHpVal,
        baseColor,
        baseWall,
        baseWallMat,
        topRail,
        hpFill,
        hpFillMat,
        crackGroupMed,
        crackGroupLow,
        thornsDmg: (20 + st.atk * 15) * (tier1Special ? 2.0 : 1.0),
        turretDmg: Math.round(42 * (1 + st.atk * 0.35)),
        turretRange: 14.0 * sizeScale,
        stunDur: 0.22 + st.stun * 0.22,
        tier1Special: !!tier1Special,
        awakened: !!awakened,
        hasTurret: canMountTurret,
        turretAmmo: maxTurretAmmo,
        maxTurretAmmo,
        reloadTimer: 0,
        turretCooldown: 0,
        mesh: bGroup
      });
    }

    function updateBarricadeDamageVisual(bar) {
      if (!bar || !bar.maxHp) return;
      const ratio = Math.max(0, bar.hp / bar.maxHp);
      if (bar.hpFill) {
        bar.hpFill.scale.x = Math.max(0.05, ratio);
      }
      if (ratio <= 0.35) {
        if (bar.crackGroupMed) bar.crackGroupMed.visible = true;
        if (bar.crackGroupLow) bar.crackGroupLow.visible = true;
        if (bar.hpFillMat) bar.hpFillMat.color.setHex(0xef4444);
        if (bar.baseWallMat) bar.baseWallMat.color.setHex(0x3f1d1d);
        if (bar.topRail) {
          bar.topRail.rotation.z = -0.10;
          bar.topRail.position.y = 1.32;
        }
        if (bar.baseWall) bar.baseWall.rotation.z = 0.04;
      } else if (ratio <= 0.68) {
        if (bar.crackGroupMed) bar.crackGroupMed.visible = true;
        if (bar.crackGroupLow) bar.crackGroupLow.visible = false;
        if (bar.hpFillMat) bar.hpFillMat.color.setHex(0xf59e0b);
        if (bar.baseWallMat) bar.baseWallMat.color.setHex(0x57534e);
        if (bar.topRail) {
          bar.topRail.rotation.z = -0.04;
          bar.topRail.position.y = 1.38;
        }
      } else {
        if (bar.crackGroupMed) bar.crackGroupMed.visible = false;
        if (bar.crackGroupLow) bar.crackGroupLow.visible = false;
        if (bar.hpFillMat) bar.hpFillMat.color.setHex(0x10b981);
      }
    }

    function spawnBarrel(x, z, awakened, stats, tier1Special, ownerId, roomIndex) {
      const st = (typeof stats === "object" && stats) ? stats : { atk: 0, spd: 0, area: stats || 0, stun: 0, knock: 0 };
      const pid = ownerId !== undefined ? ownerId : -1;
      if (pid >= 0) {
        // [v3.1] 인당 동시 설치 상한 8개 (4인 스쿼드 합산 최대 32개)
        const myBarrels = game.barrels.filter(b => b.ownerId === pid);
        if (myBarrels.length >= 8) {
          const oldest = myBarrels[0];
          const idxOld = game.barrels.indexOf(oldest);
          if (idxOld !== -1) {
            entitiesGroup.remove(oldest.group);
            game.barrels.splice(idxOld, 1);
          }
        }
      }
      const group = new THREE.Group();

      // [v3.1 빙결 배럴 외형 혁신] 일반 빨간 드럼통이 아닌 세련된 극저온 냉각 캡슐 외형 구현
      const tankBody = new THREE.Mesh(
        new THREE.CylinderGeometry(0.60, 0.60, 1.48, 16),
        new THREE.MeshStandardMaterial({
          color: awakened ? 0x0284c7 : (tier1Special ? 0x0369a1 : 0x0ea5e9),
          roughness: 0.25,
          metalness: 0.35
        })
      );
      tankBody.position.y = 0.74;
      group.add(tankBody);

      // 상하단 냉각 강화 림 (화이트 프로스트)
      const rimMat = new THREE.MeshStandardMaterial({ color: 0xe0f2fe, roughness: 0.45, metalness: 0.15 });
      const topRim = new THREE.Mesh(new THREE.CylinderGeometry(0.65, 0.65, 0.14, 16), rimMat);
      topRim.position.y = 1.41;
      const btmRim = new THREE.Mesh(new THREE.CylinderGeometry(0.65, 0.65, 0.14, 16), rimMat);
      btmRim.position.y = 0.07;
      group.add(topRim, btmRim);

      // 중앙 극저온 발광 코어 링 (Cyan Frost Glow)
      const coreMat = new THREE.MeshStandardMaterial({
        color: 0x38bdf8,
        emissive: awakened ? 0x00f0ff : (tier1Special ? 0x38bdf8 : 0x0284c7),
        emissiveIntensity: awakened ? 1.0 : (tier1Special ? 0.75 : 0.45),
        roughness: 0.15
      });
      const coreBand = new THREE.Mesh(new THREE.CylinderGeometry(0.63, 0.63, 0.32, 16), coreMat);
      coreBand.position.y = 0.74;
      group.add(coreBand);

      // 상단 압력 밸브
      const valve = new THREE.Mesh(
        new THREE.CylinderGeometry(0.22, 0.22, 0.20, 12),
        new THREE.MeshStandardMaterial({ color: 0x64748b, roughness: 0.4 })
      );
      valve.position.y = 1.55;
      group.add(valve);

      group.position.set(x, 0, z);
      entitiesGroup.add(group);
      game.barrels.push({
        ownerId: pid,
        roomIndex: roomIndex !== undefined ? roomIndex : game.currentRoomIndex,
        x, z, radius: 0.75,
        isCryo: true,
        baseDmg: 680,
        tier1Special: !!tier1Special,
        awakened: !!awakened,
        areaLv: st.area || 0,
        dmgMult: 1 + (st.atk || 0) * 0.35,
        stunBonus: (st.stun || 0) * 0.40,
        group
      });
    }

