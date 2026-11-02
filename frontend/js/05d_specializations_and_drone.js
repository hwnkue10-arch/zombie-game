/**
 * =========================================================================
 * BOXHEAD: THE CORE v3.6 — Frontend Module: 05d_specializations_and_drone.js
 * Tactical Drone Modules & 4-Class Specialization Active/Passive Skills
 * Zero-Loss Refactored Architecture (Shared Global Lexical Scope)
 * =========================================================================
 */
"use strict";

    // =========================================================================
    // 16. DRONE UPGRADE & SPECIALIZATION SELECTION / SKILL HANDLERS
    // =========================================================================
    function unlockDroneChassis(player) {
      if (!player || !isPlayerNearArmory(player)) {
        SoundFX.play("deny");
        return;
      }
      const cost = 600;
      if (game.bioPoints < cost) {
        SoundFX.play("deny");
        return;
      }
      game.bioPoints -= cost;
      if (!player.drone) {
        player.drone = {
          unlocked: false,
          animState: "IDLE",
          animTimer: 0,
          targetMateId: null,
          worldX: 0, worldY: 2.15, worldZ: 0,
          modules: {
            magnet: { level: 0, maxLevel: 4 },
            medi: { level: 0, maxLevel: 1, cooldown: 0, maxCooldown: 90.0, sectorRevivesUsed: 0 },
            interceptor: { level: 0, maxLevel: 4, cooldown: 0 }
          }
        };
      }
      player.drone.unlocked = true;
      if (player.visual && player.visual.droneGroup) {
        player.visual.droneGroup.visible = true;
      }
      SoundFX.play("upgrade");
      const safeBanner = document.getElementById("hud-safe-banner");
      if (safeBanner) {
        document.getElementById("hud-safe-banner-text").textContent =
          "🛸 다목적 전술 드론 프레임 해금 완료! 어깨 상공에 전술 드론이 배치되었습니다.";
        safeBanner.classList.remove("hidden");
        setTimeout(() => safeBanner.classList.add("hidden"), 3800);
      }
      renderUpgradeModal();
      updateHUD();
    }

    function upgradeDroneModule(player, key) {
      if (!player || !isPlayerNearArmory(player) || !player.drone || !player.drone.unlocked) {
        SoundFX.play("deny");
        return;
      }
      if (!player.drone.modules || !player.drone.modules[key]) return;
      const mod = player.drone.modules[key];
      if (mod.level >= mod.maxLevel) return;

      const nextLv = mod.level + 1;
      let bpCost = 0;
      let partCost = 0;
      if (key === "magnet") {
        bpCost = [0, 250, 500, 850, 1300][nextLv] || 500;
        partCost = [0, 0, 0, 1, 1][nextLv] || 0;
      } else if (key === "interceptor") {
        bpCost = [0, 350, 600, 950, 1500][nextLv] || 600;
        partCost = [0, 0, 0, 1, 1][nextLv] || 0;
      } else if (key === "medi") {
        bpCost = 700;
        partCost = 1;
      } else if (key === "supply") {
        bpCost = [0, 450, 850, 1400][nextLv] || 850;
        partCost = [0, 0, 1, 1][nextLv] || 0;
      }

      if (game.bioPoints < bpCost || (game.weaponParts || 0) < partCost) {
        SoundFX.play("deny");
        return;
      }

      game.bioPoints -= bpCost;
      if (partCost > 0) game.weaponParts = Math.max(0, (game.weaponParts || 0) - partCost);
      mod.level++;
      SoundFX.play("upgrade");
      renderUpgradeModal();
      updateHUD();
    }

    function openSpecializationModal() {
      const me = game.players[mySlotIndex];
      if (!me || me.specialization) return;
      const modal = document.getElementById("spec-modal");
      if (modal) modal.classList.remove("hidden");
      SoundFX.play("upgrade");
    }

    function closeSpecializationModal() {
      const modal = document.getElementById("spec-modal");
      if (modal) modal.classList.add("hidden");
    }

    function chooseSpecialization(specKey) {
      const me = game.players[mySlotIndex];
      if (!me) return;
      me.specialization = specKey;

      if (specKey === "JUGGERNAUT") {
        me.maxHp += 35;
        me.hp = Math.min(me.maxHp, me.hp + 35);
        me.canPassThroughZombies = true;
        me.tempShield = Math.max(me.tempShield || 0, 35);
        me.juggernautShieldTimer = 10.0;
      } else if (specKey === "MEDIC") {
        game.reviveDuration = 3.5;
      }

      const modal = document.getElementById("spec-modal");
      if (modal) modal.classList.add("hidden");
      const noticeBtn = document.getElementById("btn-open-spec-modal");
      if (noticeBtn) noticeBtn.classList.add("hidden");
      SoundFX.play("revive");
      updateHUD();

      if (wsClient && wsClient.readyState === WebSocket.OPEN) {
        try {
          wsClient.send(JSON.stringify({
            type: "SPEC_CHOSEN",
            playerId: me.id,
            specialization: specKey
          }));
        } catch (e) {}
      }
    }

    function spawnMedicHealingFieldMesh(player, hx, hz) {
      if (player.healingZoneGroup) {
        try { effectsGroup.remove(player.healingZoneGroup); } catch (e) {}
        player.healingZoneGroup = null;
      }
      // [v3.1 Z-Fighting 지글거림 완전 제거] polygonOffset 및 depthWrite: false 적용
      const grp = new THREE.Group();
      grp.position.set(hx, 0.08, hz);

      // 1. 외곽 발광 테두리 링
      const ringGeo = new THREE.RingGeometry(4.7, 5.1, 40);
      const ringMat = new THREE.MeshBasicMaterial({
        color: 0x10b981, side: THREE.DoubleSide, transparent: true, opacity: 0.85,
        depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1.0, polygonOffsetUnits: -4.0
      });
      const ringMesh = new THREE.Mesh(ringGeo, ringMat);
      ringMesh.rotation.x = -Math.PI / 2;
      grp.add(ringMesh);

      // 2. 내부 은은한 치유 안개 바닥 장판
      const discGeo = new THREE.CircleGeometry(4.7, 36);
      const discMat = new THREE.MeshBasicMaterial({
        color: 0x059669, side: THREE.DoubleSide, transparent: true, opacity: 0.28,
        depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1.0, polygonOffsetUnits: -4.0
      });
      const discMesh = new THREE.Mesh(discGeo, discMat);
      discMesh.rotation.x = -Math.PI / 2;
      grp.add(discMesh);

      // 3. 중앙 십자가(의료) 심볼
      const crossMat = new THREE.MeshBasicMaterial({
        color: 0x6ee7b7, side: THREE.DoubleSide, transparent: true, opacity: 0.9,
        depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2.0, polygonOffsetUnits: -4.0
      });
      const crossV = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 2.6), crossMat);
      crossV.rotation.x = -Math.PI / 2;
      crossV.position.y = 0.02;
      const crossH = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 0.7), crossMat);
      crossH.rotation.x = -Math.PI / 2;
      crossH.position.y = 0.02;
      grp.add(crossV, crossH);

      // 4. 공전하는 4개 나노 비트 구체
      const orbMat = new THREE.MeshBasicMaterial({ color: 0x34d399 });
      for (let i = 0; i < 4; i++) {
        const ang = (i / 4) * Math.PI * 2;
        const orb = new THREE.Mesh(new THREE.SphereGeometry(0.22, 8, 8), orbMat);
        orb.position.set(Math.cos(ang) * 4.9, 0.25, Math.sin(ang) * 4.9);
        grp.add(orb);
      }

      effectsGroup.add(grp);
      player.healingZoneGroup = grp;
      player.healingDiscMat = discMat;
      player.healingRingMat = ringMat;
    }

    function triggerSpecializationActive(player) {
      if (!player || player.downed || !player.specialization) return;
      if (player.specCooldown > 0) {
        SoundFX.play("deny");
        return;
      }
      const spec = player.specialization;
      if (spec === "JUGGERNAUT") {
        player.specCooldown = 40.0;
        player.specActiveTimer = 6.0;
        player.tempShield = (player.tempShield || 0) + 80;
        SoundFX.play("explosion");
        spawnMissionStageVFX(player.x, player.z, 0xf59e0b, 18.0, 30, false);
        game.zombies.forEach(z => {
          if (Math.hypot(z.x - player.x, z.z - player.z) <= 18.0) {
            z.targetPlayerId = player.id;
          }
        });
      } else if (spec === "STRIKER") {
        player.specCooldown = 30.0;
        player.specActiveTimer = 6.0;
        player.overclockActive = true;
        SoundFX.play("pickup");
        spawnMissionStageVFX(player.x, player.z, 0xf59e0b, 3.5, 18, true);
        spawnBloodParticles(player.x, 1.5, player.z, 0xef4444, 15);
      } else if (spec === "MEDIC") {
        player.specCooldown = 40.0;
        player.specActiveTimer = 7.0;
        player.healingMistActive = true;
        player.healingMistX = player.x;
        player.healingMistZ = player.z;
        SoundFX.play("revive");
        spawnMedicHealingFieldMesh(player, player.x, player.z);
        spawnMissionStageVFX(player.x, player.z, 0x10b981, 5.0, 25, false);
      } else if (spec === "SCOUT") {
        player.specCooldown = 35.0;
        player.specActiveTimer = 7.5;
        player.cloakActive = true;
        SoundFX.play("shotgun");
        spawnBloodParticles(player.x, 1.2, player.z, 0x64748b, 25);
        if (player.visual && player.visual.body) {
          player.visual.body.material.transparent = true;
          player.visual.body.material.opacity = 0.35;
        }
        game.zombies.forEach(z => {
          if (z.targetPlayerId === player.id) {
            z.targetPlayerId = -1;
          }
        });
      }

      if (player.id === mySlotIndex && wsClient && wsClient.readyState === WebSocket.OPEN) {
        try {
          wsClient.send(JSON.stringify({
            type: "SPEC_ACTIVE",
            playerId: player.id,
            x: player.x,
            z: player.z
          }));
        } catch (e) {}
      }
    }

    // Modal click listeners
    document.addEventListener("DOMContentLoaded", () => {
      document.getElementById("btn-spec-juggernaut")?.addEventListener("click", () => chooseSpecialization("JUGGERNAUT"));
      document.getElementById("btn-spec-striker")?.addEventListener("click", () => chooseSpecialization("STRIKER"));
      document.getElementById("btn-spec-medic")?.addEventListener("click", () => chooseSpecialization("MEDIC"));
      document.getElementById("btn-spec-scout")?.addEventListener("click", () => chooseSpecialization("SCOUT"));
      document.getElementById("btn-close-spec-modal")?.addEventListener("click", () => closeSpecializationModal());
      document.getElementById("btn-open-spec-modal")?.addEventListener("click", () => openSpecializationModal());
    });

    window.addEventListener("keydown", (e) => {
      if ((e.key === "t" || e.key === "T") && !document.getElementById("chat-input-field")?.matches(":focus")) {
        const modal = document.getElementById("spec-modal");
        if (modal) {
          if (modal.classList.contains("hidden")) {
            const me = game.players[mySlotIndex];
            if (me && !me.specialization && (game.specAvailable || game.currentRoomIndex >= 1)) {
              openSpecializationModal();
            }
          } else {
            closeSpecializationModal();
          }
        }
      } else if (e.key === "Escape") {
        closeSpecializationModal();
      }
    });
