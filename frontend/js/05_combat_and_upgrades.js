/**
 * =========================================================================
 * BOXHEAD: THE CORE v3.1 — Frontend Module: 05_combat_and_upgrades.js
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

      if (code === "KeyT" || code === "KeyU" || code === "KeyB") {
        toggleUpgradeModal();
        return;
      }
      if (code === "KeyO") {
        const sm = document.getElementById("settings-modal");
        if (sm) sm.classList.toggle("hidden");
        return;
      }
      if (code === "Escape") {
        document.getElementById("upgrade-modal").classList.add("hidden");
        const sm = document.getElementById("settings-modal");
        if (sm) sm.classList.add("hidden");
        return;
      }

      if (code.startsWith("Digit")) {
        const num = parseInt(code.replace("Digit", ""), 10);
        if (num >= 1 && num <= 8) selectWeaponSlot(me, num - 1);
      } else if (code === "KeyQ" || code === "KeyH" || code === "KeyC") {
        startSelfBandaging(me);
      } else if (code === "KeyE" || code === "KeyG" || code === "KeyR") {
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
          // Quick-Swap Overcharge Buff (2.5s of +25% fire rate & +35% stun when swapping!)
          player.swapOverchargeTimer = 2.5;
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

    // [E] 아드레날린 스팀팩 즉시 투여 (+45 임시체력 보호막 + 6.5초간 이동속도·연사력·스태미너 무한 폭주)
    function useAdrenalineStim(player) {
      if (player.downed || player.stims <= 0) return;
      player.stims--;
      player.tempHp = Math.min(60, player.tempHp + 45);
      player.stimBuffTimer = 6.5;
      player.acidTimer = 0;
      player.stamina = getPlayerMaxStamina(player);
      player.staminaExhaustTimer = 0;
      SoundFX.play("revive");
    }

    // [V] 360° 전방위 기절 밀치기 & 중간보스/보스 패턴 카운터 패링!
    function triggerMeleeBash(player, fromNetwork) {
      if (player.downed || (!fromNetwork && (player.bashCooldown > 0 || player.revivingTargetId !== null))) return;
      player.bashCooldown = getPlayerBashCooldownMax(player);
      if (!fromNetwork && player.id === mySlotIndex && wsClient && wsClient.readyState === WebSocket.OPEN) {
        try { wsClient.send(JSON.stringify({ type: "REMOTE_SKILL", slotId: player.id, skill: "BASH", x: player.x, z: player.z })); } catch (e) {}
      }
      SoundFX.play("shotgun");

      const bashRad = getPlayerBashRadius(player);
      const arcMesh = new THREE.Mesh(
        new THREE.RingGeometry(0.5, bashRad, 36),
        new THREE.MeshBasicMaterial({ color: 0xfacc15, side: THREE.DoubleSide, transparent: true, opacity: 0.88 })
      );
      arcMesh.rotation.x = -Math.PI / 2;
      arcMesh.position.set(player.x, 1.0, player.z);
      effectsGroup.add(arcMesh);
      game.particles.push({ mesh: arcMesh, life: 0.28, maxLife: 0.28, expand: 0.45 });

      const bashDmg = 68 + game.currentRoomIndex * 18;
      for (let i = game.zombies.length - 1; i >= 0; i--) {
        const zmb = game.zombies[i];
        const dx = zmb.x - player.x;
        const dz = zmb.z - player.z;
        const dist = Math.hypot(dx, dz);
        const hitRange = zmb.spec.isMidBoss ? (bashRad + 1.4) : bashRad;
        if (dist <= hitRange) {
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
            damageZombie(i, bashDmg, (dx / (dist || 1)) * 20, (dz / (dist || 1)) * 20, 1.65, 0);
          }
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

    // [Space / 우클릭] 전술 대쉬 겸 점프 (0.34초간 체공 무적 회피 + 낮은 장애물 월담 + 보스/중간보스 바닥 충격파·회전 레이저 점프 회피!)
    function triggerTacticalDash(player, fromNetwork) {
      if (player.downed || (!fromNetwork && (player.dashCooldown > 0 || player.revivingTargetId !== null))) return;
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

    // =========================================================================
    // 11. WEAPON UPGRADE (PURE RANDOM ROLL), SUIT UPGRADES & PER-WEAPON AMMO
    // =========================================================================
    function toggleUpgradeModal() {
      const modal = document.getElementById("upgrade-modal");
      const isHidden = modal.classList.contains("hidden");
      if (isHidden) {
        renderUpgradeModal();
        modal.classList.remove("hidden");
      } else {
        modal.classList.add("hidden");
      }
    }

    function isLimitBreakStep(totalLv) {
      return false; // 기본 스탯 강화(Lv.1~50)는 변이 코어 없이 오직 BP만으로 자유롭게 가능!
    }

    function rollRandomWeaponUpgrade(player, wIdx) {
      const toastEl = document.getElementById("upg-roll-toast");
      if (!isPlayerNearArmory(player)) {
        if (toastEl) toastEl.textContent = "⛔ 무기고 반경 밖입니다! 소강기 [🔧무기고] 앞(6.2m)으로 이동해 강화하세요.";
        return;
      }
      const inv = player.inventory[wIdx];
      if (!inv || !inv.unlocked) return;
      const statDefs = getWeaponStatDefs(wIdx);
      const secCap = getSectorMaxStatLv(); // 현재 섹터에서 허용되는 스탯당 최대 레벨 (1~10)
      const maxTotalHere = secCap * 5;

      const available = statDefs.filter(st => inv.stats[st.key] < secCap);
      if (available.length === 0) {
        if (toastEl) {
          toastEl.textContent = secCap >= 10
            ? `🏆 [${WEAPONS[wIdx].name}] 모든 스탯이 최종 한계(Lv.50 MAX)에 도달했습니다!`
            : `🔒 현재 섹터(${game.currentRoomIndex + 1}섹터) 강화 상한(Lv.${maxTotalHere})에 도달했습니다! 다음 섹터 진입 시 상한이 해금됩니다.`;
        }
        return;
      }

      const avgLv = Math.floor(inv.totalLv / 5);
      const cost = getUpgradeCost(wIdx, avgLv, inv.totalLv);

      if (game.bioPoints < cost) {
        if (toastEl) toastEl.textContent = `⚠️ BP가 부족합니다! (필요: ${cost.toLocaleString()} BP)`;
        return;
      }

      game.bioPoints -= cost;
      const chosen = available[Math.floor(Math.random() * available.length)];
      const canJackpot = (inv.stats[chosen.key] + 2 <= secCap);
      const isJackpot = canJackpot && (Math.random() < 0.18);
      const addLv = isJackpot ? 2 : 1;
      inv.stats[chosen.key] += addLv;
      inv.totalLv += addLv;

      SoundFX.play("upgrade");
      if (toastEl) {
        let msg = isJackpot
          ? `🎉 ★대성공! [${WEAPONS[wIdx].name}] '${chosen.label}' +2 Lv 상승! (현재 Lv.${inv.totalLv}/50 · 섹터상한 Lv.${maxTotalHere})`
          : `🎲 [${WEAPONS[wIdx].name}] '${chosen.label}' +1 Lv 랜덤 강화 완료! (현재 Lv.${inv.totalLv}/50 · 섹터상한 Lv.${maxTotalHere})`;
        if (inv.totalLv >= 15 && !inv.tier1Special) {
          msg += " ➔ 🧬[15Lv 1차 특수개조] 가능!";
        } else if (inv.totalLv >= 30 && inv.tier1Special && !inv.awakened) {
          msg += " ➔ ★[30Lv 최종각성] 가능!";
        } else if (inv.totalLv >= 45) {
          msg += " ➔ ⚡[45Lv 초월 오버드라이브] 가동 중!";
        }
        toastEl.textContent = msg;
      }
      renderUpgradeModal();
      updateWeaponSlotsHUD();
    }

    // [v3.1 4인 스쿼드 실측 경제 역산 기반 코어 상점 가격]
    // - S1~S3 누적 수입(~6만 BP)의 30% -> 1차 코어 18,000 BP
    // - S4~S6 누적 수입(~29만 BP)의 28% -> 2차 코어 82,000 BP
    // - S7~S9 누적 수입(~87만 BP)의 25% -> 3차 코어 220,000 BP (3개 풀구매 시 총 320,000 BP 소모)
    function getNextShopCoreInfo() {
      const bought = game.shopCoresBought || 0;
      if (bought === 0) return { reqRoom: 2, cost: 18000, label: "1차 코어(3S+) 18,000BP" };
      if (bought === 1) return { reqRoom: 5, cost: 82000, label: "2차 코어(6S+) 82,000BP" };
      if (bought === 2) return { reqRoom: 8, cost: 220000, label: "3차 코어(9S+) 220,000BP" };
      return { reqRoom: 99, cost: 0, label: "상점 코어 매진(3/3)" };
    }

    // [v3.1 중간보스 드랍 코어 추출 판매 환급금]
    // - 코어 전량 판매 빌드(0코어 순수 스탯 올인) 선택 시: 1차 +24,000 BP / 2차 +106,000 BP / 3차 +290,000 BP (총 +420,000 BP 환급!)
    // - 이 환급금으로 8종 전 무기를 Lv.45~50 MAX로 도배하여 '순수 무기고 과공명(Pure Arsenal Overdrive)' 달성 가능!
    function getCoreSellRefundBp() {
      const sold = game.coresSoldCount || 0;
      const table = [24000, 106000, 290000];
      return table[Math.min(2, sold)];
    }

    // [v3.1 3대 빌드 밸런스] 비코어(Pure Stat) 순수 스탯 마스터리 보너스:
    // 코어를 바르지 않은 무기는 15/30/45Lv 달성 시 강력한 깡딜+관통+공속+장갑무시 패시브가 자동 점등됨!
    function getPureStatMasteryBonus(inv) {
      if (!inv || inv.tier1Special || inv.awakened || inv.transcended) {
        return { dmgMult: 1.0, spdMult: 1.0, extraPierce: 0, armorIgnore: false, weakBonus: 0, label: "" };
      }
      if (inv.totalLv >= 45) {
        return {
          dmgMult: 2.15,
          spdMult: 1.20,
          extraPierce: 2,
          armorIgnore: true,
          weakBonus: 0.45,
          label: "💪순수45Lv(깡딜+115%·관통+2·공속+20%·장갑무시)"
        };
      }
      if (inv.totalLv >= 30) {
        return {
          dmgMult: 1.65,
          spdMult: 1.10,
          extraPierce: 1,
          armorIgnore: false,
          weakBonus: 0.25,
          label: "💪순수30Lv(깡딜+65%·관통+1·공속+10%)"
        };
      }
      if (inv.totalLv >= 15) {
        return {
          dmgMult: 1.30,
          spdMult: 1.0,
          extraPierce: 0,
          armorIgnore: false,
          weakBonus: 0,
          label: "💪순수15Lv(깡딜+30%)"
        };
      }
      return { dmgMult: 1.0, spdMult: 1.0, extraPierce: 0, armorIgnore: false, weakBonus: 0, label: "" };
    }

    function buyShopCoreSample(player) {
      const toastEl = document.getElementById("upg-roll-toast");
      if (!isPlayerNearArmory(player)) {
        if (toastEl) toastEl.textContent = "⛔ 소강기에 출현한 [🔧무기고] 반경 안에서만 변이 코어를 구매할 수 있습니다!";
        return;
      }
      const info = getNextShopCoreInfo();
      if ((game.shopCoresBought || 0) >= 3) {
        if (toastEl) toastEl.textContent = "ℹ️ 상점 한정 코어(3개)를 모두 구매했습니다!";
        return;
      }
      if (game.currentRoomIndex < info.reqRoom) {
        if (toastEl) toastEl.textContent = `🔒 이 코어는 섹터 ${info.reqRoom + 1} 진입 시 해금됩니다! (가격: ${info.cost} BP)`;
        return;
      }
      if (game.bioPoints < info.cost) {
        if (toastEl) toastEl.textContent = `⚠️ BP가 부족합니다! (필요: ${info.cost} BP)`;
        return;
      }
      game.bioPoints -= info.cost;
      game.shopCoresBought = (game.shopCoresBought || 0) + 1;
      game.coreSamples = (game.coreSamples || 0) + 1;
      SoundFX.play("revive");
      if (toastEl) {
        toastEl.textContent = `🛒 [변이 코어] 구매 완료! (-${info.cost} BP · 보유 코어: ${game.coreSamples}개)`;
      }
      renderUpgradeModal();
      updateWeaponSlotsHUD();
    }

    function sellCoreSampleForBp(player) {
      const toastEl = document.getElementById("upg-roll-toast");
      if (!isPlayerNearArmory(player)) {
        if (toastEl) toastEl.textContent = "⛔ [🔧무기고] 반경 안에서만 변이 코어 추출 판매(환급)가 가능합니다!";
        return;
      }
      if ((game.coreSamples || 0) < 1) {
        if (toastEl) toastEl.textContent = "⚠️ 판매할 [🧬변이 코어]가 없습니다! (중간보스 처치로 획득 가능)";
        return;
      }
      if ((game.shopCoresBought || 0) > 0) {
        if (toastEl) toastEl.textContent = "⛔ 상점에서 코어를 구매한 이후에는 코어 차익 되팔기(추출 판매)가 제한됩니다!";
        return;
      }
      const refund = getCoreSellRefundBp();
      game.coreSamples--;
      game.coresSoldCount = (game.coresSoldCount || 0) + 1;
      game.bioPoints += refund;
      SoundFX.play("upgrade");
      if (toastEl) {
        toastEl.textContent = `🧬 변이 코어 분해 판매 완료! 즉시 +${refund} BP 환급! (비코어 순수 스탯 강화 자금 확보)`;
      }
      renderUpgradeModal();
      updateWeaponSlotsHUD();
    }

    function unlockSpecialWeaponPerk(player, wIdx, tier) {
      const toastEl = document.getElementById("upg-roll-toast");
      if (!isPlayerNearArmory(player)) {
        if (toastEl) toastEl.textContent = "⛔ 무기고 반경 밖입니다! 소강기 [🔧무기고] 앞에서 특수강화를 진행하세요.";
        return;
      }
      const inv = player.inventory[wIdx];
      const w = WEAPONS[wIdx];
      if (!inv || !inv.unlocked) return;

      if (tier === 1) {
        if (inv.totalLv < 15 || inv.tier1Special) return;
        if ((game.coreSamples || 0) < 1) {
          if (toastEl) toastEl.textContent = "⚠️ [🧬변이 코어]가 부족합니다! 중간보스 드랍 또는 상점(3/6/9섹터)에서 확보하세요.";
          return;
        }
        game.coreSamples--;
        inv.tier1Special = true;
        SoundFX.play("revive");
        if (toastEl) toastEl.textContent = `🧬 [${w.name}] 15Lv 1차 코어개조 완료! (${w.tier1Name})`;
      } else if (tier === 2) {
        if (!inv.tier1Special) {
          if (toastEl) toastEl.textContent = "⚠️ 15Lv 1차 코어개조를 먼저 완료해야 30Lv 2차 각성을 진행할 수 있습니다!";
          return;
        }
        if (inv.totalLv < 30 || inv.awakened) return;
        if ((game.coreSamples || 0) < 1) {
          if (toastEl) toastEl.textContent = "⚠️ [🧬변이 코어]가 부족합니다!";
          return;
        }
        game.coreSamples--;
        inv.awakened = true;
        SoundFX.play("revive");
        if (toastEl) toastEl.textContent = `★ [${w.name}] 30Lv 2차 코어각성 완료! (${w.awakenName})`;
      } else if (tier === 3) {
        if (!inv.awakened) {
          if (toastEl) toastEl.textContent = "⚠️ 30Lv 2차 코어각성을 먼저 완료해야 45Lv 3차 초월을 진행할 수 있습니다!";
          return;
        }
        if (inv.totalLv < 45 || inv.transcended) return;
        if ((game.coreSamples || 0) < 1) {
          if (toastEl) toastEl.textContent = "⚠️ [🧬변이 코어]가 부족합니다!";
          return;
        }
        game.coreSamples--;
        inv.transcended = true;
        SoundFX.play("revive");
        if (toastEl) toastEl.textContent = `⚡ [${w.name}] 45Lv 3차 초월 코어각성 완료! (최종 화력 x1.55 · 공속+25% 오버클럭)`;
      }
      renderUpgradeModal();
      updateWeaponSlotsHUD();
    }

    function craftWeaponPart(player) {
      const toastEl = document.getElementById("upg-roll-toast");
      if (!isPlayerNearArmory(player)) {
        if (toastEl) toastEl.textContent = "⛔ [🔧무기고] 반경 안에서만 무기 부품 합성이 가능합니다!";
        return;
      }
      const cost = getPartCraftCost();
      if (game.bioPoints < cost) {
        if (toastEl) toastEl.textContent = `⚠️ BP가 부족합니다! (⚙️ 무기 부품 1개 합성 필요: ${cost.toLocaleString()} BP)`;
        return;
      }
      game.bioPoints -= cost;
      game.partsCrafted = (game.partsCrafted || 0) + 1;
      game.weaponParts = (game.weaponParts || 0) + 1;
      SoundFX.play("upgrade");
      if (toastEl) {
        toastEl.textContent = `⚙️ [무기 부품 합성] +1개 제작 완료! (-${cost.toLocaleString()} BP · 현재 보유 부품: ${game.weaponParts}개)`;
      }
      renderUpgradeModal();
      updateWeaponSlotsHUD();
    }

    function upgradePlayerSuitStat(player, key) {
      const toastEl = document.getElementById("upg-roll-toast");
      if (!player || !SUIT_UPGRADE_DEFS[key]) return;
      if (!isPlayerNearArmory(player)) {
        if (toastEl) toastEl.textContent = "⛔ [🔧무기고] 반경 안에서만 신체·의료·기동 강화를 진행할 수 있습니다!";
        return;
      }
      if (!player.suitUpgrades) {
        player.suitUpgrades = { medkitCap: 0, stimCap: 0, maxStamina: 0, staminaRegen: 0, dashCd: 0, bashCd: 0, syringe: 0 };
      }
      const def = SUIT_UPGRADE_DEFS[key];
      const curLv = player.suitUpgrades[key] || 0;
      if (curLv >= def.maxLv) {
        if (toastEl) toastEl.textContent = `🏆 [${def.name}] 이미 최대 레벨(Lv.${def.maxLv} MAX)입니다!`;
        return;
      }
      const reqRoom = def.reqRooms[curLv] || 0;
      if (game.currentRoomIndex < reqRoom) {
        if (toastEl) toastEl.textContent = `🔒 [${def.name} Lv.${curLv + 1}] 강화는 섹터 ${reqRoom + 1} 진입 시 해금됩니다!`;
        return;
      }
      const cost = def.costs[curLv] || 1000;
      if (game.bioPoints < cost) {
        if (toastEl) toastEl.textContent = `⚠️ BP가 부족합니다! ([${def.name}] 강화 필요: ${cost.toLocaleString()} BP)`;
        return;
      }

      game.bioPoints -= cost;
      player.suitUpgrades[key] = curLv + 1;

      if (key === "medkitCap") {
        player.medkits = Math.min(getPlayerMaxMedkits(player), player.medkits + 1);
      } else if (key === "stimCap") {
        player.stims = Math.min(getPlayerMaxStims(player), player.stims + 1);
      } else if (key === "maxStamina") {
        player.maxStamina = getPlayerMaxStamina(player);
        player.stamina = player.maxStamina;
      } else if (key === "syringe") {
        player.medkits = getPlayerMaxMedkits(player);
      }

      SoundFX.play(key === "syringe" ? "revive" : "upgrade");
      if (toastEl) {
        toastEl.textContent = key === "syringe"
          ? `💉 [나노 의료 주사기 특수개조] 완료! 이제 [Q] 자가 치료가 0.6초(무감속), [F] 아군 치료가 0.4초로 대폭 가속됩니다!`
          : `🧬 [${def.name}] Lv.${curLv + 1}/${def.maxLv} 강화 완료! (-${cost.toLocaleString()} BP)`;
      }
      renderUpgradeModal();
      updateWeaponSlotsHUD();
    }

    function buyWeaponAmmo(player, wIdx) {
      const toastEl = document.getElementById("upg-roll-toast");
      if (!isPlayerNearArmory(player)) {
        if (toastEl) toastEl.textContent = "⛔ 탄약 및 보급품 구매는 소강기 [🔧무기고] 반경 안에서만 가능합니다!";
        return;
      }
      const w = WEAPONS[wIdx];
      const inv = player.inventory[wIdx];
      if (!w || w.infinite || !inv || !inv.unlocked) return;
      const maxA = getWeaponMaxAmmo(player, wIdx);
      if (inv.ammo >= maxA) {
        if (toastEl) toastEl.textContent = `ℹ️ [${w.name}] 탄약이 이미 가득 찼습니다 (${inv.ammo}/${maxA}).`;
        return;
      }
      const scaledCost = getSectorSupplyCost(w.packCost);
      if (game.bioPoints < scaledCost) {
        if (toastEl) toastEl.textContent = `⚠️ BP가 부족합니다! (${w.name} 탄약 보충: ${scaledCost.toLocaleString()} BP)`;
        return;
      }
      game.bioPoints -= scaledCost;
      inv.ammo = Math.min(maxA, inv.ammo + w.packAmmo);
      SoundFX.play("pickup");
      if (toastEl) toastEl.textContent = `🔫 [${w.name}] 전용 탄약 +${w.packAmmo}발 보충 완료! (-${scaledCost.toLocaleString()} BP · ${inv.ammo}/${maxA})`;
      renderUpgradeModal();
      updateWeaponSlotsHUD();
    }

    function setSupplyBtnVisualState(btnId, canBuy, activeClasses) {
      const btn = document.getElementById(btnId);
      if (!btn) return;
      btn.disabled = !canBuy;
      if (canBuy) {
        btn.className = `p-2 rounded-xl ${activeClasses} text-left transition flex flex-col justify-between h-14 cursor-pointer`;
      } else {
        btn.className = "p-2 rounded-xl bg-slate-800/90 border border-slate-700 text-slate-500 text-left transition flex flex-col justify-between h-14 opacity-60 cursor-not-allowed";
      }
    }

    function renderUpgradeModal() {
      const me = game.players[mySlotIndex];
      if (!me) return;

      const nearArmory = isPlayerNearArmory(me);
      const secCap = getSectorMaxStatLv();
      const maxTotalHere = secCap * 5;

      const armoryBanner = document.getElementById("upg-armory-status");
      if (armoryBanner) {
        if (nearArmory) {
          armoryBanner.className = "h-9 px-3 rounded-xl bg-emerald-950/90 border border-emerald-400/50 text-xs font-bold text-emerald-200 flex items-center truncate";
          armoryBanner.textContent = `🟢 무기고 연결됨 — 현재 섹터(${game.currentRoomIndex + 1}섹터) 무기 강화 상한: 스탯당 Lv.${secCap} (총 Lv.${maxTotalHere}/50)`;
        } else {
          armoryBanner.className = "h-9 px-3 rounded-xl bg-rose-950/90 border border-rose-400/50 text-xs font-bold text-rose-200 flex items-center truncate";
          armoryBanner.textContent = `🔴 무기고 반경 밖 — 소강기 [🔧무기고] 앞(6.2m)에서 강화·구매 가능 (현재 상한 Lv.${maxTotalHere}/50)`;
        }
      }

      document.getElementById("upg-bp-display").textContent = game.bioPoints.toLocaleString();
      document.getElementById("upg-parts-display").textContent = game.weaponParts;
      const coreEl = document.getElementById("upg-cores-display");
      if (coreEl) coreEl.textContent = game.coreSamples || 0;

      const shopInfo = getNextShopCoreInfo();
      const buyCoreLbl = document.getElementById("upg-buy-core-label");
      if (buyCoreLbl) buyCoreLbl.textContent = shopInfo.label;

      const sellCoreLbl = document.getElementById("upg-sell-core-label");
      if (sellCoreLbl) sellCoreLbl.textContent = `+${getCoreSellRefundBp().toLocaleString()} BP 환급 (보유:${game.coreSamples || 0})`;

      const partCost = getPartCraftCost();
      const craftPartLbl = document.getElementById("upg-craft-part-label");
      if (craftPartLbl) craftPartLbl.textContent = `${partCost.toLocaleString()} BP (보유:${game.weaponParts})`;

      const resCount = getResonanceCount(me);
      const pure15Count = me.inventory.filter(inv => inv.unlocked && !inv.tier1Special && inv.totalLv >= 15).length;
      const pure45Count = me.inventory.filter(inv => inv.unlocked && !inv.tier1Special && inv.totalLv >= 45).length;
      const resPct = resCount * 10 + pure15Count * 16 + pure45Count * 12;
      document.getElementById("upg-resonance-info").textContent =
        `무기공명: ${resCount}개 · 순수시너지: ${pure15Count}개 (전체화력 +${resPct}%)`;

      // 상단 8개 보급/합성/코어 버튼 가격 및 활성(컬러)/비활성(회색) 상태 동기화
      const curW = WEAPONS[me.currentWeapon];
      const curInv = me.inventory[me.currentWeapon];
      const curMaxA = getWeaponMaxAmmo(me, me.currentWeapon);
      const curAmmoCost = (curW && !curW.infinite) ? getSectorSupplyCost(curW.packCost) : 0;
      const canBuyLight = nearArmory && curW && !curW.infinite && curInv && curInv.unlocked && curInv.ammo < curMaxA && game.bioPoints >= curAmmoCost;
      const buyLightLbl = document.getElementById("upg-buy-light-label");
      if (buyLightLbl) {
        buyLightLbl.textContent = (curW && !curW.infinite) ? `${curAmmoCost.toLocaleString()} BP [${curInv.ammo}/${curMaxA}]` : "∞ 무한탄 장착중";
      }
      setSupplyBtnVisualState("btn-buy-light", canBuyLight, "bg-slate-900 hover:bg-sky-950/80 border border-sky-400/60");

      const heavyCost = getSectorSupplyCost(220);
      const anyGunNeedsAmmo = me.inventory.some((inv, idx) => inv.unlocked && !WEAPONS[idx].infinite && idx <= 5 && inv.ammo < getWeaponMaxAmmo(me, idx));
      const btnHeavyPrice = document.querySelector("#btn-buy-heavy div:last-child");
      if (btnHeavyPrice) btnHeavyPrice.textContent = `${heavyCost.toLocaleString()} BP`;
      setSupplyBtnVisualState("btn-buy-heavy", nearArmory && anyGunNeedsAmmo && game.bioPoints >= heavyCost, "bg-slate-900 hover:bg-emerald-950/80 border border-emerald-400/60");

      const energyCost = getSectorSupplyCost(120);
      const needsTac = (me.inventory[6].ammo < getWeaponMaxAmmo(me, 6)) || (me.inventory[7].ammo < getWeaponMaxAmmo(me, 7));
      const btnEnergyPrice = document.querySelector("#btn-buy-energy div:last-child");
      if (btnEnergyPrice) btnEnergyPrice.textContent = `${energyCost.toLocaleString()} BP`;
      setSupplyBtnVisualState("btn-buy-energy", nearArmory && needsTac && game.bioPoints >= energyCost, "bg-slate-900 hover:bg-rose-950/80 border border-rose-400/60");

      const medCost = getSectorSupplyCost(110);
      const maxMed = getPlayerMaxMedkits(me);
      const hasSyr = isPlayerSyringeUpgraded(me);
      const medTitle = document.getElementById("upg-buy-medkit-title");
      if (medTitle) medTitle.textContent = `${hasSyr ? "💉나노주사기" : "🩹구급키트"} (${me.medkits}/${maxMed})`;
      const btnMedPrice = document.getElementById("upg-buy-medkit-label");
      if (btnMedPrice) btnMedPrice.textContent = me.medkits >= maxMed ? `소지 상한 (${me.medkits}/${maxMed})` : `${medCost.toLocaleString()} BP`;
      setSupplyBtnVisualState("btn-buy-medkit", nearArmory && me.medkits < maxMed && game.bioPoints >= medCost, "bg-slate-900 hover:bg-teal-950/80 border border-teal-400/60");

      const stimCost = getSectorSupplyCost(90);
      const maxStm = getPlayerMaxStims(me);
      const stimTitle = document.getElementById("upg-buy-stim-title");
      if (stimTitle) stimTitle.textContent = `💉스팀팩 (${me.stims}/${maxStm})`;
      const btnStimPrice = document.getElementById("upg-buy-stim-label");
      if (btnStimPrice) btnStimPrice.textContent = me.stims >= maxStm ? `소지 상한 (${me.stims}/${maxStm})` : `${stimCost.toLocaleString()} BP`;
      setSupplyBtnVisualState("btn-buy-stim", nearArmory && me.stims < maxStm && game.bioPoints >= stimCost, "bg-slate-900 hover:bg-yellow-950/80 border border-yellow-400/60");

      setSupplyBtnVisualState("btn-craft-part", nearArmory && game.bioPoints >= partCost, "bg-indigo-950/85 hover:bg-indigo-900 border border-indigo-400/70");

      const canBuyCore = nearArmory && (game.shopCoresBought || 0) < 3 && game.currentRoomIndex >= shopInfo.reqRoom && game.bioPoints >= shopInfo.cost;
      setSupplyBtnVisualState("btn-buy-core", canBuyCore, "bg-fuchsia-950/85 hover:bg-fuchsia-900 border border-fuchsia-400/70");

      const canSellCore = nearArmory && (game.coreSamples || 0) >= 1 && (game.shopCoresBought || 0) === 0;
      setSupplyBtnVisualState("btn-sell-core", canSellCore, "bg-cyan-950/85 hover:bg-cyan-900 border border-cyan-400/70");

      // ==================== 1) 7종 신체 · 의료 · 기동 강화 그리드 렌더링 ====================
      const suitGrid = document.getElementById("upgrade-suit-grid");
      if (suitGrid) {
        suitGrid.innerHTML = "";
        if (!me.suitUpgrades) {
          me.suitUpgrades = { medkitCap: 0, stimCap: 0, maxStamina: 0, staminaRegen: 0, dashCd: 0, bashCd: 0, syringe: 0 };
        }
        Object.keys(SUIT_UPGRADE_DEFS).forEach(sKey => {
          const def = SUIT_UPGRADE_DEFS[sKey];
          const curLv = me.suitUpgrades[sKey] || 0;
          const isMax = curLv >= def.maxLv;
          const reqRoom = isMax ? 0 : (def.reqRooms[curLv] || 0);
          const isRoomLocked = !isMax && game.currentRoomIndex < reqRoom;
          const cost = isMax ? 0 : (def.costs[curLv] || 1000);
          const canUpg = nearArmory && !isMax && !isRoomLocked && game.bioPoints >= cost;

          let statNowText = "";
          if (sKey === "medkitCap") statNowText = `최대 ${getPlayerMaxMedkits(me)}개 소지`;
          else if (sKey === "stimCap") statNowText = `최대 ${getPlayerMaxStims(me)}개 소지`;
          else if (sKey === "maxStamina") statNowText = `최대 ${getPlayerMaxStamina(me)} ST`;
          else if (sKey === "staminaRegen") statNowText = `초당 +${getPlayerStaminaRegen(me)}/s`;
          else if (sKey === "dashCd") statNowText = `쿨타임 ${getPlayerDashCooldownMax(me).toFixed(2)}s`;
          else if (sKey === "bashCd") statNowText = `쿨 ${getPlayerBashCooldownMax(me).toFixed(2)}s · 반경 ${getPlayerBashRadius(me).toFixed(1)}m`;
          else if (sKey === "syringe") statNowText = curLv > 0 ? "자가0.6s(무감속)·아군0.4s" : "기본: 자가2.8s·아군1.8s";

          const btnLabel = isMax
            ? `✔ MAX (Lv.${curLv}/${def.maxLv})`
            : isRoomLocked
              ? `🔒 ${reqRoom + 1}섹터 해금 (${cost.toLocaleString()}BP)`
              : `강화 (${cost.toLocaleString()} BP)`;

          const btnColorClass = canUpg
            ? (sKey === "syringe"
                ? "bg-emerald-500 hover:bg-emerald-400 text-slate-950 border-emerald-300 shadow-md cursor-pointer"
                : "bg-cyan-500 hover:bg-cyan-400 text-slate-950 border-cyan-300 shadow-md cursor-pointer")
            : "bg-slate-800 text-slate-500 border-slate-700 cursor-not-allowed opacity-60";

          const sCard = document.createElement("div");
          sCard.className = `rounded-xl p-2.5 border ${
            isMax ? "border-emerald-500/60 bg-emerald-950/25" :
            sKey === "syringe" ? "border-teal-400/50 bg-slate-900/95 lg:col-span-2" :
            "border-slate-800 bg-slate-900/90"
          } flex flex-col justify-between gap-1.5`;

          sCard.innerHTML = `
            <div>
              <div class="flex items-center justify-between gap-1">
                <span class="text-xs font-black text-white truncate">${def.icon} ${def.name}</span>
                <span class="px-1.5 py-0.5 rounded bg-slate-800 text-[10px] font-mono-code font-bold text-cyan-300 shrink-0">Lv.${curLv}/${def.maxLv}</span>
              </div>
              <div class="text-[11px] font-mono-code text-amber-300 font-bold mt-0.5">${statNowText}</div>
              <div class="text-[10px] text-slate-400 mt-0.5 leading-tight">${def.desc}</div>
            </div>
            <button type="button" data-suit-upg="${sKey}" ${!canUpg ? "disabled" : ""}
                    class="w-full py-1.5 px-2 rounded-lg border text-xs font-extrabold transition ${btnColorClass}">
              ${btnLabel}
            </button>
          `;
          suitGrid.appendChild(sCard);
        });

        suitGrid.querySelectorAll("[data-suit-upg]").forEach(btn => {
          btn.addEventListener("click", () => {
            const sKey = btn.getAttribute("data-suit-upg");
            upgradePlayerSuitStat(me, sKey);
          });
        });
      }

      // ==================== 2) 8종 무기 해금 및 랜덤 스탯 강화 그리드 렌더링 ====================
      const grid = document.getElementById("upgrade-weapons-grid");
      grid.innerHTML = "";

      WEAPONS.forEach((w, wIdx) => {
        const inv = me.inventory[wIdx];
        const statDefs = getWeaponStatDefs(wIdx);
        const isAllMax = statDefs.every(st => inv.stats[st.key] >= 10);
        const isSectorCapped = !isAllMax && statDefs.every(st => inv.stats[st.key] >= secCap);
        const avgLv = Math.floor(inv.totalLv / 5);
        const rollCost = getUpgradeCost(wIdx, avgLv, inv.totalLv);
        const maxA = getWeaponMaxAmmo(me, wIdx);
        const canRollStat = nearArmory && inv.unlocked && !isAllMax && !isSectorCapped && game.bioPoints >= rollCost;

        const card = document.createElement("div");
        card.className = `rounded-2xl p-3.5 border ${
          inv.awakened ? "border-cyan-400/80 bg-slate-900/95" :
          inv.tier1Special ? "border-fuchsia-400/75 bg-slate-900/95" :
          inv.unlocked ? "border-slate-700/90 bg-slate-900/90" : "border-slate-800 bg-slate-950/75 opacity-85"
        } flex flex-col justify-between gap-2.5`;

        let headerRight = "";
        if (!inv.unlocked) {
          const reqP = w.reqParts || 2;
          const reqBp = w.unlockBpCost || 0;
          const canUnlockW = nearArmory && game.weaponParts >= reqP && game.bioPoints >= reqBp;
          const unlockBtnClass = canUnlockW
            ? "bg-indigo-600 hover:bg-indigo-500 text-white border-indigo-400 shadow-md cursor-pointer"
            : "bg-slate-800 text-slate-500 border-slate-700 cursor-not-allowed opacity-60";
          headerRight = `
            <button type="button" data-unlock-weapon="${wIdx}" ${!canUnlockW ? "disabled" : ""}
                    class="px-3 py-1.5 rounded-xl border text-xs font-extrabold transition ${unlockBtnClass}">
              🔓 해금 (⚙️${reqP}개 + ${reqBp.toLocaleString()}BP)
            </button>
          `;
        } else {
          const ammoCost = getSectorSupplyCost(w.packCost);
          const canBuyThisAmmo = nearArmory && !w.infinite && inv.ammo < maxA && game.bioPoints >= ammoCost;
          const ammoBtnClass = canBuyThisAmmo
            ? "bg-sky-600 hover:bg-sky-500 text-white border-sky-400 cursor-pointer"
            : "bg-slate-800 text-slate-500 border-slate-700 cursor-not-allowed opacity-60";

          const ammoBtn = w.infinite
            ? `<span class="px-2.5 py-1 rounded-lg bg-slate-800 text-xs font-mono-code font-bold text-amber-300">∞ 무한탄</span>`
            : `<button type="button" data-buy-ammo="${wIdx}" ${!canBuyThisAmmo ? "disabled" : ""}
                       class="px-2.5 py-1 rounded-lg border text-xs font-mono-code font-extrabold transition ${ammoBtnClass}">
                 +탄약(${ammoCost.toLocaleString()}BP) [${inv.ammo}/${maxA}]
               </button>`;

          const btnLabel = isAllMax
            ? "MAX(Lv.50)"
            : (isSectorCapped ? `🔒섹터상한(Lv.${maxTotalHere})` : `🎲 랜덤강화 (${rollCost.toLocaleString()}BP)`);

          const basicBtnClass = canRollStat
            ? "bg-amber-500 hover:bg-amber-400 text-slate-950 border-amber-300 shadow-md cursor-pointer"
            : "bg-slate-800 text-slate-500 border-slate-700 cursor-not-allowed opacity-60";

          const basicBtn = `
            <button type="button" data-roll-w="${wIdx}" ${!canRollStat ? "disabled" : ""}
                    class="px-3 py-1 rounded-lg border text-xs font-extrabold transition ${basicBtnClass}">
              ${btnLabel}
            </button>
          `;

          headerRight = `
            <div class="flex flex-wrap items-center justify-end gap-1.5">
              ${ammoBtn}
              ${basicBtn}
            </div>
          `;
        }

        let specialRowHtml = "";
        if (inv.unlocked) {
          const pureBonus = getPureStatMasteryBonus(inv);
          let spBtn = "";
          if (!inv.tier1Special) {
            const canT1 = inv.totalLv >= 15 && nearArmory && (game.coreSamples || 0) >= 1;
            const t1Class = canT1
              ? "bg-fuchsia-500 hover:bg-fuchsia-400 text-slate-950 border-fuchsia-300 cursor-pointer"
              : "bg-slate-800 text-slate-500 border-slate-700 cursor-not-allowed opacity-60";
            spBtn = `
              <button type="button" data-sp1-w="${wIdx}" ${!canT1 ? "disabled" : ""}
                      class="px-2.5 py-1 rounded-lg border text-xs font-extrabold transition shrink-0 ${t1Class}">
                🧬 15Lv 1차개조 ${inv.totalLv < 15 ? `(Lv.${inv.totalLv}/15)` : "(코어1)"}
              </button>
            `;
          } else if (!inv.awakened) {
            const canT2 = inv.totalLv >= 30 && nearArmory && (game.coreSamples || 0) >= 1;
            const t2Class = canT2
              ? "bg-cyan-400 hover:bg-cyan-300 text-slate-950 border-cyan-200 cursor-pointer"
              : "bg-slate-800 text-slate-500 border-slate-700 cursor-not-allowed opacity-60";
            spBtn = `
              <button type="button" data-sp2-w="${wIdx}" ${!canT2 ? "disabled" : ""}
                      class="px-2.5 py-1 rounded-lg border text-xs font-extrabold transition shrink-0 ${t2Class}">
                ★ 30Lv 2차각성 ${inv.totalLv < 30 ? `(Lv.${inv.totalLv}/30)` : "(코어1)"}
              </button>
            `;
          } else if (!inv.transcended) {
            const canT3 = inv.totalLv >= 45 && nearArmory && (game.coreSamples || 0) >= 1;
            const t3Class = canT3
              ? "bg-amber-400 hover:bg-amber-300 text-slate-950 border-amber-200 cursor-pointer"
              : "bg-slate-800 text-slate-500 border-slate-700 cursor-not-allowed opacity-60";
            spBtn = `
              <button type="button" data-sp3-w="${wIdx}" ${!canT3 ? "disabled" : ""}
                      class="px-2.5 py-1 rounded-lg border text-xs font-extrabold transition shrink-0 ${t3Class}">
                ⚡ 45Lv 3차초월 ${inv.totalLv < 45 ? `(Lv.${inv.totalLv}/45)` : "(코어1)"}
              </button>
            `;
          } else {
            spBtn = `<span class="px-2.5 py-1 rounded-lg bg-amber-950 border border-amber-400 text-amber-200 text-xs font-extrabold shrink-0">⚡ 45Lv 3차초월 완성</span>`;
          }

          const pureBanner = pureBonus.label
            ? `<div class="text-emerald-300 font-extrabold truncate">✔ ${pureBonus.label} (비코어 패시브 가동중)</div>`
            : `<div class="text-slate-400 truncate">• 비코어 순수스탯 루트: 15Lv(+30%) · 30Lv(+65%&관통+1) · 45Lv(+115%&관통+2&공속+20%&장갑무시)</div>`;

          specialRowHtml = `
            <div class="flex items-center justify-between gap-2 pt-2 border-t border-slate-800 text-[11px]">
              <div class="space-y-0.5 min-w-0 flex-1">
                <div class="${inv.tier1Special ? 'text-fuchsia-300 font-bold' : 'text-slate-400'} truncate">
                  ${inv.tier1Special ? '✔' : '•'} <b>15Lv</b>: ${w.tier1Name}
                </div>
                <div class="${inv.awakened ? 'text-cyan-300 font-bold' : 'text-slate-400'} truncate">
                  ${inv.awakened ? '✔' : '•'} <b>30Lv</b>: ${w.awakenName} ${inv.transcended ? '(⚡45Lv 3차초월x1.55)' : ''}
                </div>
                ${pureBanner}
              </div>
              ${spBtn}
            </div>
          `;
        }

        let statsHtml = "";
        if (inv.unlocked) {
          statsHtml = `<div class="grid grid-cols-5 gap-1.5 pt-1">` + statDefs.map(st => {
            const curLv = inv.stats[st.key];
            const isSecMax = curLv >= secCap;
            const canClickStat = canRollStat && !isSecMax;
            const statBoxClass = canClickStat
              ? "border-amber-400/70 bg-slate-900 hover:bg-amber-950/40 text-slate-100 cursor-pointer"
              : "border-slate-700 bg-slate-800/80 text-slate-500 cursor-not-allowed opacity-60";
            return `
              <button type="button" data-upg-w="${wIdx}" title="${st.desc} (클릭 시 ${rollCost.toLocaleString()} BP로 랜덤 스탯 강화)" ${!canClickStat ? "disabled" : ""}
                      class="p-1.5 rounded-xl border text-center transition ${statBoxClass}">
                <div class="text-[11px] font-bold ${canClickStat ? 'text-slate-200' : 'text-slate-500'} truncate">${st.label}</div>
                <div class="text-xs font-mono-code font-black ${canClickStat ? 'text-cyan-300' : 'text-slate-400'} mt-0.5">Lv.${curLv}/${secCap}</div>
              </button>
            `;
          }).join("") + `</div>`;
        } else {
          statsHtml = `<div class="text-xs text-slate-400 py-2">${w.roleDesc}</div>`;
        }

        card.innerHTML = `
          <div class="flex flex-col gap-1.5">
            <div class="flex items-center justify-between gap-2">
              <div class="flex items-center gap-2 min-w-0">
                <span class="px-2 py-0.5 rounded-md bg-slate-800 text-amber-300 font-mono-code text-xs font-extrabold">${w.key}</span>
                <span class="text-sm font-black text-white truncate">${w.name}</span>
                <span class="px-2 py-0.5 rounded-md text-xs font-mono-code font-bold ${
                  inv.awakened ? "bg-cyan-500 text-slate-950" :
                  inv.tier1Special ? "bg-fuchsia-500 text-slate-950" : "bg-amber-500/20 text-amber-300"
                }">Lv.${inv.totalLv}/${maxTotalHere}</span>
              </div>
              ${headerRight}
            </div>
            ${specialRowHtml}
          </div>
          ${statsHtml}
        `;
        grid.appendChild(card);
      });

      grid.querySelectorAll("[data-unlock-weapon]").forEach(btn => {
        btn.addEventListener("click", () => {
          const toastEl = document.getElementById("upg-roll-toast");
          if (!isPlayerNearArmory(me)) {
            if (toastEl) toastEl.textContent = "⛔ 소강기 [🔧무기고] 반경 안에서만 신규 무기를 해금할 수 있습니다!";
            return;
          }
          const wIdx = parseInt(btn.getAttribute("data-unlock-weapon"), 10);
          const w = WEAPONS[wIdx];
          const inv = me.inventory[wIdx];
          const reqP = w.reqParts || 2;
          const reqBp = w.unlockBpCost || 0;
          if (game.weaponParts < reqP || game.bioPoints < reqBp) {
            if (toastEl) toastEl.textContent = `⚠️ 해금 자원이 부족합니다! (필요: ⚙️부품 ${reqP}개 + ${reqBp.toLocaleString()} BP)`;
            return;
          }
          game.weaponParts -= reqP;
          game.bioPoints -= reqBp;
          inv.unlocked = true;
          SoundFX.play("upgrade");
          if (toastEl) {
            toastEl.textContent = `🔓 [${w.name}] 설계도 해금 완료! (-⚙️부품 ${reqP}개, -${reqBp.toLocaleString()} BP)`;
          }
          renderUpgradeModal();
          updateWeaponSlotsHUD();
        });
      });

      grid.querySelectorAll("[data-buy-ammo]").forEach(btn => {
        btn.addEventListener("click", () => {
          const wIdx = parseInt(btn.getAttribute("data-buy-ammo"), 10);
          buyWeaponAmmo(me, wIdx);
        });
      });

      grid.querySelectorAll("[data-roll-w]").forEach(btn => {
        btn.addEventListener("click", () => {
          const wIdx = parseInt(btn.getAttribute("data-roll-w"), 10);
          rollRandomWeaponUpgrade(me, wIdx);
        });
      });

      grid.querySelectorAll("[data-upg-w]").forEach(btn => {
        btn.addEventListener("click", () => {
          const wIdx = parseInt(btn.getAttribute("data-upg-w"), 10);
          rollRandomWeaponUpgrade(me, wIdx);
        });
      });

      grid.querySelectorAll("[data-sp1-w]").forEach(btn => {
        btn.addEventListener("click", () => {
          const wIdx = parseInt(btn.getAttribute("data-sp1-w"), 10);
          unlockSpecialWeaponPerk(me, wIdx, 1);
        });
      });

      grid.querySelectorAll("[data-sp2-w]").forEach(btn => {
        btn.addEventListener("click", () => {
          const wIdx = parseInt(btn.getAttribute("data-sp2-w"), 10);
          unlockSpecialWeaponPerk(me, wIdx, 2);
        });
      });

      grid.querySelectorAll("[data-sp3-w]").forEach(btn => {
        btn.addEventListener("click", () => {
          const wIdx = parseInt(btn.getAttribute("data-sp3-w"), 10);
          unlockSpecialWeaponPerk(me, wIdx, 3);
        });
      });
    }

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

      // 모든 총기·바리케이드·드럼통은 각자의 개별 탄약(inv.ammo)을 소모! (탄약효율 스탯당 6.5%, 최대 65% 무소모)
      if (!wDef.infinite && !netShotSeed) {
        if ((inv.ammo || 0) <= 0) {
          return;
        }
        const freeShotChance = Math.min(0.65, inv.stats.knock * 0.065);
        if (shotRng() >= freeShotChance) {
          inv.ammo = Math.max(0, inv.ammo - 1);
        }
      }

      const isDownedPistol = !!player.downed;
      const resCount = isDownedPistol ? 0 : getResonanceCount(player);
      const pure15Count = isDownedPistol ? 0 : player.inventory.filter(it => it.unlocked && !it.tier1Special && it.totalLv >= 15).length;
      const pure45Count = isDownedPistol ? 0 : player.inventory.filter(it => it.unlocked && !it.tier1Special && it.totalLv >= 45).length;
      const resMult = 1 + resCount * 0.10 + pure15Count * 0.16 + pure45Count * 0.12;
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

      const atkMult = (1 + effAtkLv * 0.20) * resMult * (effTier1 ? 1.15 : 1.0) * pureBonus.dmgMult * overdriveMult;
      const spdMult = isDownedPistol ? 0.85 : ((1 + effSpdLv * 0.10) * (pureBonus.spdMult || 1.0) * (effTranscended ? 1.25 : (inv.totalLv >= 45 ? 1.15 : 1.0)) * (player.stimBuffTimer > 0 ? 1.25 : 1.0) * (player.swapOverchargeTimer > 0 ? 1.25 : 1.0));
      const isPierceInArea = (wIdx === 0 || wIdx === 3);
      const rangeMult = isPierceInArea ? 1.15 : (1 + effAreaLv * 0.22);
      const stunDur = isDownedPistol ? 0.15 : ((wDef.stun + effStunLv * 0.22) * (player.swapOverchargeTimer > 0 ? 1.35 : 1.0));
      const knockVal = isDownedPistol ? 0.35 : (wDef.knockback * (1 + effStunLv * 0.28));
      const pierceCount = isDownedPistol ? 1 : ((wDef.piercing ? 99 : 1) + (isPierceInArea ? effAreaLv : 0) + (wIdx === 0 && effTier1 ? 1 : 0) + (wIdx === 0 && effAwakened ? 2 : 0) + (pureBonus.extraPierce || 0));
      const areaMult = isPierceInArea ? 1.05 : rangeMult;

      player.fireCooldown = Math.max(0.035, wDef.fireRate / spdMult);

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
      const finalDamage = Math.round(wDef.damage * atkMult);

      if (wIdx === 5) {
        fireRailgunBeam(player, nx, nz, finalDamage, stunDur, knockVal, areaMult, effAwakened, effTier1);
        return;
      }

      let totalProjectiles = wDef.pellets;
      if (wIdx === 1) totalProjectiles += effAreaLv + (effTier1 ? 2 : 0);
      if (wIdx === 0 && effAwakened) totalProjectiles = 2;

      for (let p = 0; p < totalProjectiles; p++) {
        const spreadOffset = (shotRng() - 0.5) * wDef.spread;
        const a = baseAngle + spreadOffset;
        const vx = Math.sin(a) * wDef.speed;
        const vz = Math.cos(a) * wDef.speed;

        let bGeo = SHARED_GEO.pistolTracer;
        if (wIdx === 1) bGeo = SHARED_GEO.shotgunPellet;
        else if (wIdx === 2) bGeo = SHARED_GEO.uziNeedle;
        else if (wIdx === 3) bGeo = SHARED_GEO.rifleSlug;
        else if (wIdx === 4) bGeo = SHARED_GEO.grenadeShell;

        const bulletColor = effAwakened ? 0x22d3ee : (effTier1 ? 0xe879f9 : wDef.color);
        const bulletMesh = new THREE.Mesh(bGeo, new THREE.MeshBasicMaterial({ color: bulletColor }));
        const sideOffset = (wIdx === 0 && effAwakened) ? (p === 0 ? -0.28 : 0.28) : 0;
        bulletMesh.position.set(player.x + nx * 0.9 + nz * sideOffset, 1.15, player.z + nz * 0.9 - nx * sideOffset);
        bulletMesh.rotation.y = a;
        bulletMesh.scale.set(areaMult, areaMult, areaMult);
        effectsGroup.add(bulletMesh);

        game.bullets.push({
          ownerId: player.id,
          wIdx,
          tier1Special: effTier1,
          awakened: effAwakened,
          noFriendlyFire: isDownedPistol,
          isZombieProjectile: false,
          x: bulletMesh.position.x,
          z: bulletMesh.position.z,
          vx, vz,
          damage: finalDamage,
          weakMult: isDownedPistol ? 1.0 : ((wDef.weakMult || 1.2) + (pureBonus.weakBonus || 0) + (wIdx === 0 ? effKnockLv * 0.28 + (effTier1 ? 0.6 : 0) : 0)),
          stun: stunDur,
          knockback: knockVal,
          explosiveRadius: (wDef.explosiveRadius || 0) * areaMult * (wIdx === 4 && effTier1 ? 1.25 : 1.0),
          pierceLeft: pierceCount,
          armorPen: isDownedPistol ? false : (!!pureBonus.armorIgnore || (isPierceInArea ? effAreaLv > 0 : (effTier1 || effAwakened))),
          piercing: pierceCount > 1,
          life: (wIdx === 1 ? 0.44 : 1.05) * rangeMult,
          mesh: bulletMesh
        });
      }
    }

    function fireRailgunBeam(player, nx, nz, damage, stunDur, knockVal, areaMult, awakened, tier1Special) {
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

      // 15Lv 1차 특수(1.5초 단기 전류장) / 30Lv 최종각성(3.5초 고출력 전류장 + 3D 시각 이펙트)
      if (awakened || tier1Special) {
        const trailLife = awakened ? 3.5 : 1.5;
        const trailDmgRatio = awakened ? 0.32 : 0.16;
        const tRadius = 2.2 * areaMult * widthBoost;
        for (let s = 4; s <= beamLen; s += 6) {
          const tx = player.x + nx * s;
          const tz = player.z + nz * s;
          const ringM = new THREE.Mesh(
            new THREE.RingGeometry(tRadius * 0.35, tRadius, 16),
            new THREE.MeshBasicMaterial({ color: awakened ? 0x22d3ee : 0xe879f9, side: THREE.DoubleSide, transparent: true, opacity: 0.55 })
          );
          ringM.rotation.x = -Math.PI / 2;
          ringM.position.set(tx, 0.08, tz);
          effectsGroup.add(ringM);
          game.shockTrails.push({
            x: tx,
            z: tz,
            radius: tRadius,
            dmg: Math.round(damage * trailDmgRatio),
            life: trailLife,
            mesh: ringM
          });
        }
      }

      const beamRadius = 1.35 * areaMult * widthBoost;
      for (let i = game.zombies.length - 1; i >= 0; i--) {
        const zmb = game.zombies[i];
        const px = zmb.x - player.x;
        const pz = zmb.z - player.z;
        const proj = px * nx + pz * nz;
        if (proj > 0 && proj < beamLen) {
          const perpDist = Math.hypot(px - proj * nx, pz - proj * nz);
          if (perpDist <= zmb.radius + beamRadius) {
            damageZombie(i, Math.round(damage * (zmb.spec.isMidBoss ? (awakened ? 2.2 : 1.8) : 1.0)), nx * knockVal, nz * knockVal, stunDur, 5);
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
          if (perpDist <= 2.0) pod.hp -= damage * 1.4;
        }
      }

      for (let i = game.bloodPylons.length - 1; i >= 0; i--) {
        const pyl = game.bloodPylons[i];
        const px = pyl.x - player.x;
        const pz = pyl.z - player.z;
        const proj = px * nx + pz * nz;
        if (proj > 0 && proj < beamLen) {
          const perpDist = Math.hypot(px - proj * nx, pz - proj * nz);
          if (perpDist <= 2.2) pyl.hp -= damage * 1.5;
        }
      }

      if (game.boss && game.boss.active && !game.boss.dead) {
        const px = game.boss.x - player.x;
        const pz = game.boss.z - player.z;
        const proj = px * nx + pz * nz;
        if (proj > 0 && proj < beamLen) {
          const perpDist = Math.hypot(px - proj * nx, pz - proj * nz);
          if (perpDist <= game.boss.radius + beamRadius) {
            damageBoss(Math.round(damage * (awakened ? 2.2 : 1.8)));
          }
        }
      }
    }

    // =========================================================================
    // 13. EXPLOSIONS, STUN/KNOCKBACK, PISTOL SCAVENGE & BOSS INVULN MECHANICS
    // =========================================================================
    function triggerExplosion(x, z, radius, maxDamage, attackerId, isAwakenedGrenade, clusterDepth, isTier1Grenade) {
      SoundFX.play("explosion");
      const expMesh = new THREE.Mesh(
        new THREE.SphereGeometry(radius * 0.85, 14, 14),
        new THREE.MeshBasicMaterial({ color: isAwakenedGrenade ? 0x38bdf8 : 0xf97316, transparent: true, opacity: 0.85 })
      );
      expMesh.position.set(x, 1.0, z);
      effectsGroup.add(expMesh);
      game.particles.push({ mesh: expMesh, life: 0.30, maxLife: 0.30, expand: 1.35 });

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

      // 중간보스 무적 기믹 및 단발 피해 상한(1초 순삭 방지!)
      let finalDmg = dmg;
      if (zmb.spec.isMidBoss) {
        if (zmb.mbShieldActive) {
          // 50% 체력 무적 패턴 중에는 피해 0!
          return;
        }
        if (weaponIdx !== undefined && WEAPONS[weaponIdx]) {
          finalDmg = Math.round(dmg * (WEAPONS[weaponIdx].weakMult || 1.15));
        }
        if (zmb.mbGroggyTimer > 0) {
          finalDmg = Math.round(finalDmg * 1.75);
        } else {
          // 중화기 연사로도 1초컷이 나지 않도록 중장갑 감쇄(45%) + 타격당 최대 체력의 2.6% 캡 적용!
          finalDmg = Math.min(Math.round(finalDmg * 0.55), Math.round(zmb.maxHp * 0.026));
        }
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
        [[-9.5, -7.5], [9.5, 7.5]].forEach((off, idx) => {
          const nx = Math.max(r.wx - r.half + 8, Math.min(r.wx + r.half - 8, zmb.x + off[0]));
          const nz = Math.max(r.wz - r.half + 8, Math.min(r.wz + r.half - 8, zmb.z + off[1]));
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

          const nodePod = {
            x: nx, z: nz,
            hp: 680,
            maxHp: 680,
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

      if (stunDur && stunDur > 0 && !zmb.mbShieldActive) {
        const effStun = stunDur * Math.max(0.25, 1 - resist);
        zmb.stunTimer = Math.max(zmb.stunTimer, zmb.spec.isMidBoss ? effStun * 0.35 : effStun);
      }

      const kScale = (zmb.spec.isMidBoss ? 0.03 : 0.16) * Math.max(0.3, 1 - resist);
      moveEntityWithCollision(zmb, (knockX || 0) * kScale, (knockZ || 0) * kScale, zmb.radius);
      spawnBloodParticles(zmb.x, 1.1, zmb.z, 0xdc2626, 2);

      if (zmb.hp <= 0) {
        const wasStunned = zmb.stunTimer > 0;
        const zx = zmb.x, zz = zmb.z;
        const isMB = zmb.spec.isMidBoss;
        const isExp = zmb.spec.explosive;

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
        }

        game.totalKills++;
        game.comboCount++;
        game.comboTimer = 5.5;
        const curR = game.rooms[game.currentRoomIndex];
        const envMult = (curR && curR.envType === 'BLOOD_RAIN') ? 1.35 : 1.0;

        if (curR) {
          curR.sectorKills = (curR.sectorKills || 0) + 1;
          const secScale = 1 + curR.index * 0.45;
          if (isMB) {
            game.bioPoints += Math.round(zmb.spec.bp * secScale);
          } else {
            // 제한시간 초과 광폭화(berserkActive) 상태에서만 0.20배 BP 페널티 적용
            const berserkPenalty = curR.berserkActive ? 0.20 : 1.0;
            const grantBp = Math.max(1, Math.round(zmb.spec.bp * secScale * envMult * berserkPenalty));
            curR.bpEarned += grantBp;
            game.bioPoints += grantBp;
          }
        }

        if (game.comboCount === 65 || game.comboCount === 140 || game.comboCount === 230) {
          spawnPickup(zx, zz, "PART");
          spawnPickup(zx + 1.0, zz, "AMMO_PACK");
        }

        const mePlayer = game.players[mySlotIndex];
        const pistolExecLv = (mePlayer && !mePlayer.downed && mePlayer.inventory[0]) ? mePlayer.inventory[0].stats.knock : 0;
        if (weaponIdx === 0 && wasStunned && Math.random() < (0.05 + pistolExecLv * 0.025)) {
          spawnPickup(zx, zz, "AMMO_PACK");
        }

        if (isExp) {
          triggerExplosion(zx, zz, 4.0, 58, -1, false);
        }

        // 엘리트 감염체(골리앗·블러드 데빌)는 ⚙️무기 부품 드랍 확률 3.5배!
        const isElite = (zmb.typeKey === "GOLIATH" || zmb.typeKey === "DEVIL");
        const partChance = isElite ? 0.0085 : 0.0022;
        const r = Math.random();
        if (r < 0.0055) spawnPickup(zx, zz, "AMMO_PACK");
        else if (r < 0.0055 + partChance) spawnPickup(zx, zz, "PART");
        else if (r < 0.0055 + partChance + 0.0020) spawnPickup(zx, zz, "MEDKIT");
        else if (r < 0.0055 + partChance + 0.0036) spawnPickup(zx, zz, "STIM");
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

      // Groggy bonus damage (2.5x when groggy after stopping Nutrient Hosts!)
      const finalDmg = b.groggyTimer > 0 ? Math.round(dmg * 2.5) : dmg;
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
        const off = bossRoom.half - 10;
        [[-off, -off], [off, -off], [-off, off], [off, off]].forEach(co => {
          const pMesh = new THREE.Mesh(
            new THREE.CylinderGeometry(1.1, 1.4, 5.5, 10),
            new THREE.MeshStandardMaterial({ color: 0xf43f5e, emissive: 0xbe123c, emissiveIntensity: 0.8 })
          );
          pMesh.position.set(bossRoom.wx + co[0], 2.75, bossRoom.wz + co[1]);
          entitiesGroup.add(pMesh);
          game.bloodPylons.push({ x: bossRoom.wx + co[0], z: bossRoom.wz + co[1], hp: 950, mesh: pMesh });
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

    function damagePlayer(player, dmg, causesBleed, causesAcid) {
      if (player.downed || player.dashActiveTimer > 0 || !game.running) return;

      // Cancel self-bandaging if hit hard
      if (player.bandagingTimer > 0 && dmg > 8) {
        player.bandagingTimer = 0;
      }

      // Absorb with Temporary HP (Adrenaline Stim) first!
      let rem = dmg;
      if (player.tempHp > 0) {
        const absorbed = Math.min(player.tempHp, rem);
        player.tempHp -= absorbed;
        rem -= absorbed;
      }
      player.hp = Math.max(0, player.hp - rem);

      if (causesBleed && Math.random() < 0.35) player.bleedingTimer = 8.0;
      if (causesAcid) player.acidTimer = 6.0;

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

      if (player.hp <= 0) {
        player.downed = true;
        player.bandagingTimer = 0;
        player.carryingPayload = false;
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

