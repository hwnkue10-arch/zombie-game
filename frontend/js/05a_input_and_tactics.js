/**
 * =========================================================================
 * BOXHEAD: THE CORE v3.6 — Frontend Module: 05a_input_and_tactics.js
 * Input Listeners, Mouse Raycasting, Weapon Selection & Tactical Mobility
 * Zero-Loss Refactored Architecture (Shared Global Lexical Scope)
 * =========================================================================
 */
"use strict";

    // =========================================================================
    // 10. INPUTS, MEDICAL ACTIONS ([H]/[G]), TACTICAL DASH ([SPACE]) & UPGRADE UI ([U])
    // =========================================================================
    const keys = {};
    const touchMove = { w: false, a: false, s: false, d: false };
    const touchAim = { u: false, d: false, l: false, r: false };
    let touchInteractF = false;

    // [v3.2 개선] 마우스 커서 360° 전술 조준, 좌클릭 사격 & 휠 무기 교체 지원
    const mouseState = {
      active: false,
      down: false,
      rightDown: false,
      ndcX: 0,
      ndcY: 0,
      worldX: 0,
      worldZ: 0
    };
    const mouseRaycaster = new THREE.Raycaster();
    const mouseGroundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -1.15);
    const mouseHitVec = new THREE.Vector3();

    function updateMouseWorldAim() {
      if (!mouseState.active || !camera) return false;
      mouseRaycaster.setFromCamera({ x: mouseState.ndcX, y: mouseState.ndcY }, camera);
      if (mouseRaycaster.ray.intersectPlane(mouseGroundPlane, mouseHitVec)) {
        mouseState.worldX = mouseHitVec.x;
        mouseState.worldZ = mouseHitVec.z;
        return true;
      }
      return false;
    }

    window.addEventListener("pointermove", (e) => {
      if (e.pointerType === "touch") return;
      mouseState.active = true;
      mouseState.ndcX = (e.clientX / window.innerWidth) * 2 - 1;
      mouseState.ndcY = -(e.clientY / window.innerHeight) * 2 + 1;
    });

    window.addEventListener("pointerdown", (e) => {
      if (e.pointerType === "touch") return;
      const tag = e.target && e.target.tagName ? e.target.tagName.toUpperCase() : "";
      if (tag === "BUTTON" || tag === "INPUT" || tag === "SELECT" || (e.target && e.target.closest && e.target.closest("button, input, select, #upgrade-modal, #settings-modal, #lobby-screen, #result-modal, #hamachi-modal"))) {
        return;
      }
      mouseState.active = true;
      mouseState.ndcX = (e.clientX / window.innerWidth) * 2 - 1;
      mouseState.ndcY = -(e.clientY / window.innerHeight) * 2 + 1;
      if (e.button === 0) mouseState.down = true;
      if (e.button === 2 && game.running) {
        const me = game.players[mySlotIndex];
        if (me) triggerTacticalDash(me);
      }
    });

    window.addEventListener("pointerup", (e) => {
      if (e.button === 0) mouseState.down = false;
    });

    window.addEventListener("contextmenu", (e) => {
      if (game.running) e.preventDefault();
    });

    window.addEventListener("wheel", (e) => {
      if (!game.running) return;
      const upgModal = document.getElementById("upgrade-modal");
      const setModal = document.getElementById("settings-modal");
      if ((upgModal && !upgModal.classList.contains("hidden")) || (setModal && !setModal.classList.contains("hidden"))) {
        return;
      }
      const me = game.players[mySlotIndex];
      if (!me) return;
      cycleWeapon(me, e.deltaY > 0 ? 1 : -1);
    }, { passive: true });

    window.addEventListener("blur", () => {
      Object.keys(keys).forEach(k => { keys[k] = false; });
      mouseState.down = false;
      touchInteractF = false;
    });

    window.addEventListener("keydown", (e) => {
      if (e.target && (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA" || e.target.tagName === "SELECT")) {
        if (e.code === "Escape") e.target.blur();
        return;
      }
      const code = e.code;
      keys[code] = true;

      if (!game.running) return;
      const me = game.players[mySlotIndex];
      if (!me) return;

      if (code === "KeyC") {
        if (e.repeat) return;
        triggerSpecializationActive(me);
        return;
      }
      if (code === "KeyT") {
        if (e.repeat) return;
        const revived = triggerDroneRevive(me);
        if (!revived && game.specAvailable && !me.specialization) {
          const spm = document.getElementById("spec-modal");
          if (spm) spm.classList.toggle("hidden");
        }
        return;
      }
      if (code === "KeyO") {
        const sm = document.getElementById("settings-modal");
        if (sm) sm.classList.toggle("hidden");
        return;
      }
      if (code === "Escape" || code === "KeyU") {
        const um = document.getElementById("upgrade-modal");
        if (um && !um.classList.contains("hidden")) {
          um.classList.add("hidden");
          return;
        }
        const sm = document.getElementById("settings-modal");
        if (sm && !sm.classList.contains("hidden")) {
          sm.classList.add("hidden");
          return;
        }
        const spm = document.getElementById("spec-modal");
        if (spm && !spm.classList.contains("hidden") && me.specialization) {
          spm.classList.add("hidden");
          return;
        }
      }

      if (code === "KeyQ") {
        if (e.repeat) return;
        // [v3.6 퀵스왑] Q키: 이전 무기 순차 전환
        cycleWeapon(me, -1);
        return;
      } else if (code === "KeyE") {
        if (e.repeat) return;
        // [v3.6 퀵스왑] E키: 다음 무기 순차 전환
        cycleWeapon(me, 1);
        return;
      } else if (code.startsWith("Digit")) {
        const num = parseInt(code.replace("Digit", ""), 10);
        if (num >= 1 && num <= 8) selectWeaponSlot(me, num - 1);
      } else if (code === "KeyZ") {
        if (e.repeat) return;
        // [v3.6 조작 개편] Z키: 구급키트 / 나노 주사기 치료
        startSelfBandaging(me);
      } else if (code === "KeyX") {
        if (e.repeat) return;
        // [v3.6 조작 개편] X키: 아드레날린 스팀팩 폭주
        useAdrenalineStim(me);
      } else if (code === "Space") {
        triggerTacticalDash(me);
        e.preventDefault();
      } else if (code === "KeyV") {
        triggerMeleeBash(me);
      }

      if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(code)) {
        e.preventDefault();
      }
    });

    window.addEventListener("keyup", (e) => {
      keys[e.code] = false;
    });

    function selectWeaponSlot(player, slotIdx) {
      if ((player.downed || player.carryingPayload) && slotIdx !== 0) return; // Forced Pistol when downed or carrying payload!
      if (player.inventory[slotIdx] && player.inventory[slotIdx].unlocked) {
        if (player.currentWeapon !== slotIdx) {
          player.currentWeapon = slotIdx;
        }
        updateWeaponSlotsHUD();
      }
    }

    function cycleWeapon(player, dir) {
      if (player.downed || player.carryingPayload) {
        player.currentWeapon = 0;
        return;
      }
      let next = player.currentWeapon;
      for (let i = 0; i < WEAPONS.length; i++) {
        next = (next + dir + WEAPONS.length) % WEAPONS.length;
        if (player.inventory[next].unlocked) {
          selectWeaponSlot(player, next);
          break;
        }
      }
    }

    // [Q] 구급 키트 / 나노 의료 주사기 자가 치료 (기본 2.8초 60% 감속 +65 HP / 나노 주사기 개조 시 0.6초 무감속 +80 HP & 출혈·산성 즉시 해독!)
    function startSelfBandaging(player) {
      if (player.downed || player.bandagingTimer > 0) return;
      const hasSyringe = isPlayerSyringeUpgraded(player);
      const needsHeal = player.hp < player.maxHp || player.bleedingTimer > 0 || (hasSyringe && player.acidTimer > 0);
      if (player.medkits <= 0 || !needsHeal) return;
      const dur = getPlayerSelfHealDuration(player);
      player.bandagingTimer = dur;
      player.bandagingMaxTimer = dur;
      SoundFX.play("pickup");
    }

    // [E] 아드레날린 스팀팩 즉시 투여 (+50 임시보호막 + 10.0초 폭주 + 모든 상태이상 완벽 정화 & 군중제어 면역)
    function useAdrenalineStim(player) {
      if (player.downed || player.stims <= 0) return;
      if (player.stimBuffTimer > 8.5) return; // [v3.3] 스팀팩 중복 투여 낭비 방지 (지속시간 충분 시 연타 무시)
      player.stims--;
      player.tempHp = Math.min(80, (player.tempHp || 0) + 50);
      player.stimBuffTimer = 10.0; // [v3.2] 지속 시간 대폭 상향 (기존 6.5s -> 10.0s)
      
      // [v3.2 만능 상태이상 정화 (Universal Cleanse)]
      player.bleedingTimer = 0;
      player.acidTimer = 0;
      player.shockTimer = 0;
      player.frostTimer = 0;
      
      // 스태미너 100% 즉시 완충 및 탈진 해제
      player.stamina = getPlayerMaxStamina(player);
      player.staminaExhaustTimer = 0;
      
      spawnBloodParticles(player.x, 1.2, player.z, 0xfacc15, 14);
      SoundFX.play("revive");
    }

    // [T] 의무 드론 원격 소생 수동 명령 출격 (구급키트 1개 소모, 90초 쿨타임)
    function triggerDroneRevive(p) {
      if (!p || p.downed || !p.drone || !p.drone.modules || !p.drone.modules.medi) return false;
      const medi = p.drone.modules.medi;
      if ((medi.level || 0) < 1) return false;
      if ((medi.cooldown || 0) > 0) {
        SoundFX.play("deny");
        return false;
      }
      if ((medi.sectorRevivesUsed || 0) >= 2) {
        SoundFX.play("deny");
        return false;
      }
      if ((p.medkits || 0) < 1) {
        SoundFX.play("deny");
        return false;
      }
      if (p.drone.animState && p.drone.animState !== "IDLE") return false;

      const downedMate = game.players.find(other =>
        other.id !== p.id && other.downed && Math.hypot(other.x - p.x, other.z - p.z) <= 18.0
      );
      if (!downedMate) return false;

      medi.cooldown = 90.0;
      medi.sectorRevivesUsed = (medi.sectorRevivesUsed || 0) + 1;
      p.medkits = Math.max(0, p.medkits - 1);
      p.drone.animState = "FLYING_OUT";
      p.drone.targetMateId = downedMate.id;
      p.drone.worldX = p.x + 0.92;
      p.drone.worldY = 2.15;
      p.drone.worldZ = p.z - 0.45;
      SoundFX.play("revive");

      const safeBanner = document.getElementById("hud-safe-banner");
      if (safeBanner) {
        const bText = document.getElementById("hud-safe-banner-text");
        if (bText) bText.textContent = `🛸 [의무 드론] [T] 수동 명령으로 ${downedMate.name} 구출을 위해 비행 출격!`;
        safeBanner.classList.remove("hidden");
        setTimeout(() => safeBanner.classList.add("hidden"), 3200);
      }
      return true;
    }

    // [V] 360° 전방위 기절 밀치기 & 중간보스/보스 패턴 카운터 패링!
    function triggerMeleeBash(player, fromNetwork) {
      if (player.downed || (!fromNetwork && (player.bashCooldown > 0 || player.revivingTargetId !== null))) return;
      player.bashCooldown = getPlayerBashCooldownMax(player);
      if (!fromNetwork && player.id === mySlotIndex && wsClient && wsClient.readyState === WebSocket.OPEN) {
        try { wsClient.send(JSON.stringify({ type: "REMOTE_SKILL", slotId: player.id, skill: "BASH", x: player.x, z: player.z })); } catch (e) {}
      }
      SoundFX.play("shotgun");

      const cqcLv = typeof getPlayerCqcLevel === "function" ? getPlayerCqcLevel(player) : 0;
      const bashRad = getPlayerBashRadius(player) * (cqcLv >= 1 ? 1.25 : 1.0);
      const arcMesh = new THREE.Mesh(
        new THREE.RingGeometry(0.5, bashRad, 36),
        new THREE.MeshBasicMaterial({ color: cqcLv >= 1 ? 0xf97316 : 0xfacc15, side: THREE.DoubleSide, transparent: true, opacity: 0.88 })
      );
      arcMesh.rotation.x = -Math.PI / 2;
      arcMesh.position.set(player.x, 1.0, player.z);
      effectsGroup.add(arcMesh);
      game.particles.push({ mesh: arcMesh, life: 0.28, maxLife: 0.28, expand: 0.45 });

      let bashDmg = (68 + game.currentRoomIndex * 18);
      if (cqcLv >= 1) bashDmg = Math.round(bashDmg * 2.5); // 데미지 +150%

      let anyHit = false;
      let executedAny = false;

      for (let i = game.zombies.length - 1; i >= 0; i--) {
        const zmb = game.zombies[i];
        const dx = zmb.x - player.x;
        const dz = zmb.z - player.z;
        const dist = Math.hypot(dx, dz);
        const hitRange = zmb.spec.isMidBoss ? (bashRad + 1.4) : bashRad;
        if (dist <= hitRange) {
          anyHit = true;
          // [CQC 1Lv+] 아머 파쇄(-20% 방어력 감소) 디버프 3.0초 부여
          if (cqcLv >= 1) {
            zmb.armorShredTimer = 3.0;
            zmb.armorShredMult = Math.max(zmb.armorShredMult || 1.0, 1.20);
          }
          // [CQC 2Lv+] 35% 확률 탄약 팩 즉시 드랍
          if (cqcLv >= 2 && Math.random() < 0.35) {
            spawnPickup("AMMO", zmb.x, zmb.z);
          }
          // [CQC 3Lv] 체력 25% 이하 일반 감염체 즉사 처형(Finisher)
          const isNormalZombie = !zmb.spec.isBoss && !zmb.spec.isMidBoss && !zmb.spec.isNutrientHost;
          if (cqcLv >= 3 && isNormalZombie && zmb.hp <= (zmb.maxHp || 100) * 0.25) {
            damageZombie(i, 999999, (dx / (dist || 1)) * 32, (dz / (dist || 1)) * 32, 0, 0);
            spawnBloodParticles(zmb.x, 1.2, zmb.z, 0xef4444, 12);
            executedAny = true;
            continue;
          }

          // 1) 중간보스 돌진(chargeTimer > 0) 또는 영창 패턴(channelingTimer > 0) 중 [V] 적중 시 카운터 패링!
          if (zmb.spec.isMidBoss && !zmb.mbShieldActive && (zmb.chargeTimer > 0 || zmb.channelingTimer > 0)) {
            zmb.chargeTimer = 0;
            zmb.channelingTimer = 0;
            zmb.channelingKind = "";
            zmb.mbGroggyTimer = 4.2;
            zmb.stunTimer = 4.2;
            SoundFX.play("explosion");
            spawnBloodParticles(zmb.x, 2.0, zmb.z, 0x38bdf8, 8);
            damageZombie(i, bashDmg * 3, (dx / (dist || 1)) * 28, (dz / (dist || 1)) * 28, 4.2, 0);
            const safeBanner = document.getElementById("hud-safe-banner");
            if (safeBanner) {
              document.getElementById("hud-safe-banner-text").textContent = `⚡ [V] 카운터 패링 성공! ${zmb.spec.name} 패턴을 강제 캔슬하고 4.2초 대그로기(피해 1.75배)를 유발했습니다!`;
              safeBanner.classList.remove("hidden");
              setTimeout(() => safeBanner.classList.add("hidden"), 3800);
            }
          } else if (zmb.spec.isNutrientHost) {
            // 2) 최종보스 25% 기믹 황금 영양 숙주(HOST)를 [V]로 타격 시 보스 반대 방향으로 강력 넉백 + 3.5초 기절!
            damageZombie(i, bashDmg * 1.5, (dx / (dist || 1)) * 38, (dz / (dist || 1)) * 38, 3.5, 0);
          } else {
            const knockMult = (cqcLv >= 1) ? 28 : 20;
            damageZombie(i, bashDmg, (dx / (dist || 1)) * knockMult, (dz / (dist || 1)) * knockMult, 1.65, 0);
          }
        }
      }

      // [CQC 2Lv+] 적중 시 스태미너 +30 즉시 충전 리턴
      if (cqcLv >= 2 && anyHit) {
        player.stamina = Math.min(getPlayerMaxStamina(player), (player.stamina || 0) + 30);
      }

      // [CQC 3Lv] 즉사 처형 성공 시 2.5초간 스팀팩 폭주 모드 발동
      if (cqcLv >= 3 && executedAny) {
        player.stimBuffTimer = Math.max(player.stimBuffTimer || 0, 2.5);
        SoundFX.play("revive");
        if (typeof showCombatToast === "function") {
          showCombatToast("⚡ [V] 근접 처형 성공! 2.5초간 아드레날린 폭주 모드 발동!");
        }
      }

      // 3) 최종보스(THE CORE) 포획 촉수(GRAPPLE) 절단 카운터: 포획된 아군 근처나 보스 근처에서 [V] 사용 시 즉시 촉수 절단!
      if (game.boss && game.boss.active && !game.boss.dead && game.boss.grappleTarget) {
        const gt = game.boss.grappleTarget;
        const distToTarget = Math.hypot(gt.x - player.x, gt.z - player.z);
        const distToBoss = Math.hypot(game.boss.x - player.x, game.boss.z - player.z);
        if (distToTarget <= bashRad + 2.2 || distToBoss <= game.boss.radius + bashRad) {
          clearBossGrapple();
          SoundFX.play("revive");
          const safeBanner = document.getElementById("hud-safe-banner");
          if (safeBanner) {
            document.getElementById("hud-safe-banner-text").textContent = "⚡ [V] 전방위 충격파로 더 코어의 포획 촉수를 단번에 절단했습니다!";
            safeBanner.classList.remove("hidden");
            setTimeout(() => safeBanner.classList.add("hidden"), 3000);
          }
        }
      }

      // 4) 배양 캡슐 및 생체 신경절/핏빛 기둥 근접 충격 피해
      for (let i = game.cystPods.length - 1; i >= 0; i--) {
        const pod = game.cystPods[i];
        if (Math.hypot(pod.x - player.x, pod.z - player.z) <= bashRad + 1.0) {
          pod.hp -= bashDmg * 1.5;
        }
      }
      for (let i = game.bloodPylons.length - 1; i >= 0; i--) {
        const pyl = game.bloodPylons[i];
        if (Math.hypot(pyl.x - player.x, pyl.z - player.z) <= bashRad + 1.2) {
          pyl.hp -= bashDmg * 1.8;
        }
      }
    }

    // [Space / 우클릭] 전술 대쉬 겸 점프 (0.34초간 체공 무적 회피 + 낮은 장애물 월담 + 바닥 충격파·회전 레이저 점프 회피! - 스태미너 소모형)
    function triggerTacticalDash(player, fromNetwork) {
      if (player.downed || (!fromNetwork && (player.dashCooldown > 0 || player.revivingTargetId !== null))) return;
      const jumpCost = getPlayerJumpStaminaCost(player);
      if (!fromNetwork && (player.stimBuffTimer || 0) <= 0) {
        if ((player.stamina || 0) < jumpCost) {
          return;
        }
        player.stamina = Math.max(0, player.stamina - jumpCost);
      }
      player.dashCooldown = getPlayerDashCooldownMax(player);
      if (!fromNetwork && player.id === mySlotIndex && wsClient && wsClient.readyState === WebSocket.OPEN) {
        try { wsClient.send(JSON.stringify({ type: "REMOTE_SKILL", slotId: player.id, skill: "DASH", rotY: player.rotY })); } catch (e) {}
      }
      player.dashActiveTimer = 0.34;
      const dx = Math.sin(player.rotY);
      const dz = Math.cos(player.rotY);
      player.dashDirX = dx;
      player.dashDirZ = dz;
      SoundFX.play("uzi");
    }
