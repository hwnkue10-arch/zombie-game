/**
 * =========================================================================
 * BOXHEAD: THE CORE v3.2 — Frontend Module: 07_hud_and_minimap.js
 * Zero-Loss Refactored Architecture (Shared Global Lexical Scope)
 * =========================================================================
 */
"use strict";

    // =========================================================================
    // 18. HUD, PER-WEAPON AMMO SLOTS & MINIMAP RENDERING
    // =========================================================================
    const SHORT_W_NAMES = ["권총", "산탄총", "UZI", "소총", "유탄", "레일건", "방벽", "폭약통"];

    function updateWeaponSlotsHUD() {
      const container = document.getElementById("weapon-slots-container");
      const me = game.players[mySlotIndex];
      if (!container || !me) return;

      container.innerHTML = "";
      const activeIdx = (me.downed || me.carryingPayload) ? 0 : me.currentWeapon;
      const curW = WEAPONS[activeIdx];
      const curInv = me.inventory[activeIdx];

      const curAmmoLabel = document.getElementById("hud-cur-weapon-ammo");
      if (curAmmoLabel && curW && curInv) {
        const maxA = getWeaponMaxAmmo(me, activeIdx);
        curAmmoLabel.textContent = curW.infinite
          ? `🔫 ${curW.name} (Lv.${curInv.totalLv}) : ∞ 무한탄`
          : `🔫 ${curW.name} (Lv.${curInv.totalLv}) : ${curInv.ammo} / ${maxA}발`;
      }

      WEAPONS.forEach((w, idx) => {
        const inv = me.inventory[idx];
        const isActive = activeIdx === idx;
        const div = document.createElement("button");
        div.type = "button";
        div.className = `weapon-slot h-[60px] rounded-xl px-1.5 py-1.5 border border-slate-700/85 bg-slate-900/90 text-center flex flex-col items-center justify-between ${
          isActive ? "active" : ""
        } ${inv.awakened ? "awakened" : ""} ${!inv.unlocked ? "locked" : ""}`;

        const poolVal = w.infinite ? "∞" : (inv.ammo || 0);
        const ammoStr = inv.unlocked ? `${poolVal}` : "🔒";
        const emptyWarn = (inv.unlocked && !w.infinite && poolVal === 0) ? "text-rose-400" : "text-amber-300";
        const badgePrefix = inv.awakened ? "★" : (inv.tier1Special ? "🧬" : "");

        div.innerHTML = `
          <div class="flex items-center justify-between w-full text-[10px] font-mono-code text-slate-400 px-0.5 leading-none">
            <span class="font-extrabold text-slate-300">${w.key}</span>
            <span class="text-cyan-300 font-bold">${inv.totalLv > 0 ? "L" + inv.totalLv : ""}</span>
          </div>
          <div class="text-xs font-extrabold text-white leading-tight truncate w-full">${badgePrefix}${SHORT_W_NAMES[idx]}</div>
          <div class="text-xs font-mono-code font-extrabold leading-none ${emptyWarn}">${ammoStr}</div>
        `;
        div.addEventListener("click", () => selectWeaponSlot(me, idx));
        container.appendChild(div);
      });
    }

    function updateHUD() {
      const me = game.players[mySlotIndex];
      if (!me) return;

      const hpPct = Math.max(0, (me.hp / me.maxHp) * 100);
      const tempPct = Math.min(40, (me.tempHp / me.maxHp) * 100);
      document.getElementById("hud-my-hp-bar").style.width = hpPct + "%";
      document.getElementById("hud-my-temphp-bar").style.width = tempPct + "%";
      document.getElementById("hud-my-hp-text").textContent =
        `${Math.ceil(me.hp)}${me.tempHp > 0 ? " + " + Math.ceil(me.tempHp) : ""} / ${me.maxHp}`;

      const maxStam = getPlayerMaxStamina(me);
      const curStam = Math.max(0, Math.min(maxStam, me.stamina !== undefined ? me.stamina : maxStam));
      const stamPct = Math.max(0, (curStam / maxStam) * 100);
      const stamBarEl = document.getElementById("hud-my-stamina-bar");
      const stamTxtEl = document.getElementById("hud-my-stamina-text");
      if (stamBarEl) {
        stamBarEl.style.width = stamPct + "%";
        stamBarEl.className = (me.staminaExhaustTimer || 0) > 0
          ? "bg-rose-500 h-full transition-all duration-75"
          : (me.isSprinting ? "bg-amber-400 h-full transition-all duration-75" : "bg-cyan-400 h-full transition-all duration-75");
      }
      if (stamTxtEl) {
        stamTxtEl.textContent = `${Math.floor(curStam)}/${maxStam}`;
      }

      const stateBadge = document.getElementById("hud-player-state-badge");
      if (me.downed) {
        stateBadge.textContent = "🩸 빈사";
        stateBadge.className = "px-2 py-0.5 rounded-md text-xs font-extrabold bg-rose-600 text-white shrink-0 min-w-[54px] text-center";
      } else if (me.carryingPayload) {
        stateBadge.textContent = "📦 운반";
        stateBadge.className = "px-2 py-0.5 rounded-md text-xs font-extrabold bg-sky-500 text-slate-950 shrink-0 min-w-[54px] text-center";
      } else if (me.isSprinting) {
        stateBadge.textContent = "⚡ 질주";
        stateBadge.className = "px-2 py-0.5 rounded-md text-xs font-extrabold bg-cyan-500 text-slate-950 shrink-0 min-w-[54px] text-center";
      } else {
        stateBadge.textContent = "♥ 정상";
        stateBadge.className = "px-2 py-0.5 rounded-md text-xs font-extrabold bg-emerald-600 text-white shrink-0 min-w-[54px] text-center";
      }

      const ailEl = document.getElementById("hud-ailment-badges");
      let ailHtml = "";
      if (me.bleedingTimer > 0) ailHtml += `<span class="px-1.5 py-0.5 rounded bg-rose-600 text-[11px] font-bold text-white">🩸출혈</span>`;
      if (me.acidTimer > 0) ailHtml += `<span class="px-1.5 py-0.5 rounded bg-lime-600 text-[11px] font-bold text-slate-950">🧪산성</span>`;
      if (me.shockTimer > 0) ailHtml += `<span class="px-1.5 py-0.5 rounded bg-yellow-400 text-[11px] font-bold text-slate-950">⚡감전</span>`;
      if (me.frostTimer > 0) ailHtml += `<span class="px-1.5 py-0.5 rounded bg-cyan-400 text-[11px] font-bold text-slate-950">❄️동상</span>`;
      if (me.stimBuffTimer > 0) ailHtml += `<span class="px-1.5 py-0.5 rounded bg-amber-400 text-[11px] font-bold text-slate-950">💉면역·폭주</span>`;
      ailEl.innerHTML = ailHtml;

      document.getElementById("hud-medkit-count").textContent = me.medkits;
      const medMaxEl = document.getElementById("hud-medkit-max");
      if (medMaxEl) medMaxEl.textContent = getPlayerMaxMedkits(me);
      const medLabelEl = document.getElementById("hud-medkit-label");
      if (medLabelEl) medLabelEl.textContent = isPlayerSyringeUpgraded(me) ? "[Q] 주사기" : "[Q] 치료";

      document.getElementById("hud-stim-count").textContent = me.stims;
      const stimMaxEl = document.getElementById("hud-stim-max");
      if (stimMaxEl) stimMaxEl.textContent = getPlayerMaxStims(me);

      const jumpCost = getPlayerJumpStaminaCost(me);
      const dashEl = document.getElementById("hud-dash-status");
      if (dashEl) {
        if (me.dashCooldown > 0) {
          dashEl.textContent = "JUMP";
          dashEl.className = "text-sky-300 font-extrabold";
        } else if ((me.stamina || 0) >= jumpCost || (me.stimBuffTimer || 0) > 0) {
          dashEl.textContent = `${Math.round(jumpCost)} ST`;
          dashEl.className = "text-emerald-400 font-extrabold";
        } else {
          dashEl.textContent = `부족 (${Math.round(jumpCost)})`;
          dashEl.className = "text-rose-400 font-extrabold";
        }
      }
      const bashEl = document.getElementById("hud-bash-status");
      if (bashEl) bashEl.textContent = me.bashCooldown > 0 ? me.bashCooldown.toFixed(1) + "s" : "READY";

      const nearArm = isPlayerNearArmory(me);
      const armProxEl = document.getElementById("hud-armory-prox");
      if (armProxEl) {
        if (nearArm) {
          armProxEl.className = "px-2.5 py-0.5 rounded-md bg-emerald-950/95 border border-emerald-400/60 text-emerald-200 font-extrabold text-[11px] truncate";
          armProxEl.textContent = "🟢 소강기 무기고 연결됨 [T / U]";
        } else if (game.wavePhase === "SURGE") {
          armProxEl.className = "px-2.5 py-0.5 rounded-md bg-rose-950/90 border border-rose-500/40 text-rose-200 font-bold text-[11px] truncate";
          armProxEl.textContent = "🔒 웨이브 중 무기고 지하수납 (소강기 출현)";
        } else {
          armProxEl.className = "px-2.5 py-0.5 rounded-md bg-amber-950/90 border border-amber-500/40 text-amber-200 font-bold text-[11px] truncate";
          armProxEl.textContent = "🧭 소강기: 황금 비콘 무기고로 이동해 정비!";
        }
      }

      const resCount = getResonanceCount(me);
      const pure15Count = me.inventory.filter(inv => inv.unlocked && !inv.tier1Special && inv.totalLv >= 15).length;
      const pure45Count = me.inventory.filter(inv => inv.unlocked && !inv.tier1Special && inv.totalLv >= 45).length;
      const totalBonusPct = resCount * 10 + pure15Count * 16 + pure45Count * 12;
      document.getElementById("hud-resonance-badge").textContent = `⚡+${totalBonusPct}%`;
      document.getElementById("hud-overcharge-badge").classList.toggle("hidden", me.swapOverchargeTimer <= 0);

      const squadList = document.getElementById("squad-members-list");
      if (squadList) {
        const mates = game.players.filter(p => p.id !== mySlotIndex);
        squadList.innerHTML = mates.map(p => {
          const pct = Math.max(0, Math.round((p.hp / p.maxHp) * 100));
          const hex = "#" + p.color.toString(16).padStart(6, "0");
          return `
            <div class="flex flex-col justify-between bg-slate-900/90 px-2 py-1 rounded-lg border border-slate-800 h-[34px]">
              <div class="flex items-center justify-between gap-1">
                <div class="flex items-center gap-1 min-w-0">
                  <span class="w-2 h-2 rounded-full shrink-0" style="background:${hex}"></span>
                  <span class="text-[11px] font-bold truncate ${p.downed ? 'text-rose-400' : 'text-slate-200'}">${p.name}</span>
                </div>
                <span class="text-[10px] font-mono-code font-bold ${p.downed ? 'text-rose-400' : 'text-emerald-300'}">${p.downed ? 'DOWN' : pct + '%'}</span>
              </div>
              <div class="w-full bg-slate-950 h-1.5 rounded-full overflow-hidden">
                <div class="${p.downed ? 'bg-rose-500' : 'bg-emerald-400'} h-full transition-all duration-150" style="width:${p.downed ? 100 : pct}%"></div>
              </div>
            </div>
          `;
        }).join("");
      }

      const curRoom = game.rooms[game.currentRoomIndex];
      const mins = String(Math.floor(game.elapsedTime / 60)).padStart(2, "0");
      const secs = String(Math.floor(game.elapsedTime % 60)).padStart(2, "0");
      document.getElementById("hud-session-timer").textContent = `${mins}:${secs}`;
      document.getElementById("hud-bio-points").textContent = `${game.bioPoints}`;
      document.getElementById("hud-materials-text").textContent = `⚙️${game.weaponParts} · 🧬${game.coreSamples || 0}`;
      const wBadge = game.wavePhase === "SURGE"
        ? `🌊웨이브 ${String(Math.ceil(game.waveTimer)).padStart(2, "0")}s`
        : `🛡️정비 ${String(Math.ceil(game.waveTimer)).padStart(2, "0")}s`;
      const hordeTag = (curRoom && curRoom.waitingForWaveDefense)
        ? ` (${curRoom.waveZombiesSpawned || 0}/${curRoom.waveZombieQuota || 0})`
        : "";
      document.getElementById("hud-zombie-count").textContent = `${wBadge} · 💀${game.zombies.length}${hordeTag}`;

      // [v3.1] 화면 중앙 상단 섹터 제한시간 실시간 갱신 (명확한 대형 폰트 및 단계별 경고)
      const secTimerCont = document.getElementById("hud-sector-timer-container");
      const secTimerVal = document.getElementById("hud-sector-timer-val");
      const secTimerDot = document.getElementById("hud-sector-timer-dot");
      const secTimerTitle = document.getElementById("hud-sector-timer-title");
      if (secTimerCont && secTimerVal && curRoom) {
        if (curRoom.isBossRoom) {
          secTimerVal.textContent = "FINAL BOSS";
          secTimerVal.className = "font-mono-code font-black text-lg text-rose-400 tracking-wider";
          if (secTimerTitle) secTimerTitle.textContent = "⚔️ 코어 결전";
          if (secTimerDot) secTimerDot.className = "w-2.5 h-2.5 rounded-full bg-rose-500 animate-pulse";
        } else {
          const remSec = Math.max(0, Math.ceil(curRoom.sectorTimer || 0));
          const tMins = String(Math.floor(remSec / 60)).padStart(2, "0");
          const tSecs = String(remSec % 60).padStart(2, "0");
          secTimerVal.textContent = `${tMins}:${tSecs}`;

          if (curRoom.berserkActive || remSec <= 0) {
            secTimerVal.className = "font-mono-code font-black text-xl text-rose-500 tracking-wider animate-pulse";
            if (secTimerTitle) secTimerTitle.textContent = "☣️ 제한시간 초과 (광폭화)";
            if (secTimerDot) secTimerDot.className = "w-2.5 h-2.5 rounded-full bg-red-600 animate-ping";
            secTimerCont.className = "hud-glass-red rounded-2xl px-5 py-1.5 flex items-center justify-center gap-3 border border-red-500 shadow-2xl backdrop-blur-md pointer-events-auto";
          } else if (remSec <= 30) {
            secTimerVal.className = "font-mono-code font-black text-xl text-rose-400 tracking-wider animate-pulse";
            if (secTimerTitle) secTimerTitle.textContent = "⚠️ 시간 임박";
            if (secTimerDot) secTimerDot.className = "w-2.5 h-2.5 rounded-full bg-rose-500 animate-pulse";
            secTimerCont.className = "hud-glass rounded-2xl px-5 py-1.5 flex items-center justify-center gap-3 border border-rose-500/80 shadow-2xl backdrop-blur-md pointer-events-auto";
          } else if (remSec <= 60) {
            secTimerVal.className = "font-mono-code font-black text-xl text-amber-400 tracking-wider";
            if (secTimerTitle) secTimerTitle.textContent = "⏱️ 시간 경고";
            if (secTimerDot) secTimerDot.className = "w-2.5 h-2.5 rounded-full bg-amber-400 animate-pulse";
            secTimerCont.className = "hud-glass rounded-2xl px-5 py-1.5 flex items-center justify-center gap-3 border border-amber-500/60 shadow-2xl backdrop-blur-md pointer-events-auto";
          } else {
            secTimerVal.className = "font-mono-code font-black text-xl text-emerald-400 tracking-wider";
            if (secTimerTitle) secTimerTitle.textContent = "⏱️ 섹터 제한시간";
            if (secTimerDot) secTimerDot.className = "w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse";
            secTimerCont.className = "hud-glass rounded-2xl px-5 py-1.5 flex items-center justify-center gap-3 border border-slate-700/80 shadow-2xl backdrop-blur-md pointer-events-auto";
          }
        }
      }

      if (curRoom) {
        document.getElementById("hud-room-title").textContent =
          curRoom.isBossRoom ? `FINAL BOSS` : `섹터 ${curRoom.index + 1}/${game.totalRooms}`;
        document.getElementById("hud-SubMission-tag").textContent = curRoom.condType;
        const envEl = document.getElementById("hud-env-tag");
        if (envEl) {
          const envIcons = {
            NORMAL: "",
            BLACKOUT: curRoom.envCleared ? `💡전력 ${Math.ceil(curRoom.blackoutRestoredTimer || 0)}s` : "🌑암전",
            TOXIC_FOG: curRoom.envCleared ? "💨환기완료" : "☣️독안개",
            BLOOD_RAIN: "🩸BPx1.35",
            CRYO_LEAK: "❄️냉각"
          };
          envEl.textContent = envIcons[curRoom.envType] || "";
        }

        const objText = document.getElementById("hud-objective-text");
        const objSub = document.getElementById("hud-objective-sub");
        const objBar = document.getElementById("hud-objective-bar");
        const unlockStg = curRoom.unlockStage || 0;
        const compStg = curRoom.completedStage || 0;

        const getSequentialWaveSubText = (maxSteps) => {
          const remSec = Math.ceil(curRoom.sectorTimer || 0);
          const timerTag = curRoom.berserkActive ? `☣️독가스 확산` : `⏱️${remSec}s`;
          if (compStg >= maxSteps) {
            return `🚪 탈출로 개방 완료 (전원 진입)`;
          }
          if (curRoom.waitingForWaveDefense) {
            const quota = curRoom.waveZombieQuota || 30;
            const spawned = curRoom.waveZombiesSpawned || 0;
            if (spawned < quota) {
              return `생존 감염체: ${game.zombies.length}마리 · ${timerTag}`;
            } else {
              return `5마리 이하 소탕 시 해금 · ${timerTag}`;
            }
          }
          const hint = curRoom.activeMissionTargetPos
            ? getCompassDirectionHint(me.x, me.z, curRoom.activeMissionTargetPos.x, curRoom.activeMissionTargetPos.z)
            : "섹터 내부";
          return `🧭 ${hint} 이동 [F] · ${timerTag}`;
        };

        if (curRoom.waitingForWaveDefense) {
          const quota = curRoom.waveZombieQuota || 30;
          const spawned = curRoom.waveZombiesSpawned || 0;
          if (spawned < quota) {
            objText.textContent = `⚔️ 호드 방어 (${spawned}/${quota})`;
            objBar.style.width = Math.min(100, Math.max(0, (spawned / quota) * 100)) + "%";
          } else {
            objText.textContent = `🎯 잔당 소탕 (남은 감염체: ${game.zombies.length}마리)`;
            const clearProg = Math.max(0, 1 - Math.max(0, game.zombies.length - 5) / Math.max(1, quota * 0.4));
            objBar.style.width = Math.min(100, Math.max(0, clearProg * 100)) + "%";
          }
          if (objSub) objSub.textContent = getSequentialWaveSubText(curRoom.condType === "THERMITE" ? 3 : (curRoom.reqWaves || curRoom.targetVal || 3));
        } else if (curRoom.isBossRoom) {
          if ((curRoom.bossPhaseStage || 1) === 1) {
            objText.textContent = `❄️ 냉각 콘솔 과부하 [F] (${curRoom.coolantsDone || 0}/2)`;
            if (objSub) objSub.textContent = `돔 양쪽 콘솔 2기 조작`;
            objBar.style.width = ((curRoom.coolantsDone || 0) * 50) + "%";
          } else if (curRoom.bossPhaseStage === 2) {
            const remPyl = game.bloodPylons ? game.bloodPylons.length : 0;
            objText.textContent = `🛡️ 방어 파일런 파괴 (${Math.max(0, 3 - remPyl)}/3)`;
            if (objSub) objSub.textContent = `중앙 방어 파일런 3기 집중 사격`;
            objBar.style.width = (((3 - remPyl) / 3) * 100) + "%";
          } else if (game.boss) {
            objText.textContent = "💀 최종 보스 '더 코어' 섬멸";
            if (objSub) objSub.textContent = `보스 보호막 해제 · 총력전`;
            objBar.style.width = ((1 - game.boss.hp / game.boss.maxHp) * 100) + "%";
          }
        } else if (curRoom.condType === "THERMITE") {
          if (curRoom.subStage === 0) {
            objText.textContent = game.thermiteParts < 2
              ? `🧪 화학원료 회수 [F] (${game.thermiteParts}/2)`
              : `🔬 테르밋 합성 [F] (중앙)`;
            objBar.style.width = (game.thermiteParts * 25) + "%";
          } else if (curRoom.subStage === 1) {
            objText.textContent = `🚪 격벽에 테르밋 부착 [F]`;
            objBar.style.width = "60%";
          } else {
            const rem = Math.max(0, curRoom.targetVal - curRoom.progress).toFixed(0);
            objText.textContent = `🔥 격벽 용융 방어 (${rem}초)`;
            objBar.style.width = (60 + (curRoom.progress / curRoom.targetVal) * 40) + "%";
          }
          if (objSub) objSub.textContent = getSequentialWaveSubText(3);
        } else if (curRoom.condType === "GENERATORS") {
          objText.textContent = `⚡ 발전기 가동 [F] (${curRoom.progress}/${curRoom.targetVal})`;
          objBar.style.width = ((curRoom.progress / curRoom.targetVal) * 100) + "%";
          if (objSub) objSub.textContent = getSequentialWaveSubText(curRoom.reqWaves || curRoom.targetVal);
        } else if (curRoom.condType === "PAYLOAD") {
          if (!me.carryingPayload && compStg < 1) {
            objText.textContent = `📦 데이터 블랙박스 회수 [F]`;
            objBar.style.width = "15%";
          } else if (curRoom.reqWaves >= 3 && compStg < 2) {
            objText.textContent = `🔐 보안중계기 암호 해독 [F]`;
            objBar.style.width = "50%";
          } else {
            objText.textContent = `🛰️ 송신기에 블랙박스 업로드 [F]`;
            objBar.style.width = "80%";
          }
          if (objSub) objSub.textContent = getSequentialWaveSubText(curRoom.reqWaves || 2);
        } else if (curRoom.condType === "RADAR_UPLINK") {
          if (compStg < 1) {
            objText.textContent = `📡 통신 배전반 전력 인가 [F]`;
            objBar.style.width = "33%";
          } else if (compStg < 2) {
            objText.textContent = `🛰️ 레이더 안테나 각도 정렬 [F]`;
            objBar.style.width = "66%";
          } else {
            objText.textContent = `📶 위성 주파수 전송 [F]`;
            objBar.style.width = "90%";
          }
          if (objSub) objSub.textContent = getSequentialWaveSubText(3);
        } else if (curRoom.condType === "DECON_PURGE") {
          objText.textContent = `☣️ 오염 밸브 폐쇄 [F] (${curRoom.progress}/${curRoom.targetVal})`;
          objBar.style.width = ((curRoom.progress / curRoom.targetVal) * 100) + "%";
          if (objSub) objSub.textContent = getSequentialWaveSubText(curRoom.targetVal);
        } else if (curRoom.condType === "HIVE_NODES") {
          objText.textContent = `🧬 생체 신경절 파괴 (${curRoom.progress}/${curRoom.targetVal})`;
          objBar.style.width = ((curRoom.progress / curRoom.targetVal) * 100) + "%";
          if (objSub) objSub.textContent = getSequentialWaveSubText(curRoom.reqWaves || curRoom.targetVal);
        } else {
          objText.textContent = `💥 군락 증폭기 파괴 (${curRoom.progress}/${curRoom.targetVal})`;
          objBar.style.width = ((curRoom.progress / curRoom.targetVal) * 100) + "%";
          if (objSub) objSub.textContent = getSequentialWaveSubText(curRoom.reqWaves || curRoom.targetVal);
        }
      }

      const mbBox = document.getElementById("hud-midboss-container");
      if (game.midBoss && game.midBoss.hp > 0) {
        mbBox.classList.remove("hidden");
        const isParryable = (game.midBoss.chargeTimer || 0) > 0 || (game.midBoss.channelingTimer || 0) > 0;
        const shieldTxt = game.midBoss.mbShieldActive
          ? " 🛡️[무적: 증폭핵 2기 파괴]"
          : (game.midBoss.mbGroggyTimer > 0
              ? " ⚡[그로기 피해 1.75배!]"
              : (isParryable ? " 🔥[[V]패링 / [Space]점프 카운터!]" : " (처치시 🧬코어+⚙️부품2)"));
        document.getElementById("hud-midboss-name").textContent = `⚠️ ${game.midBoss.spec.name}${shieldTxt}`;
        document.getElementById("hud-midboss-hp-text").textContent = `${Math.ceil(game.midBoss.hp)}`;
        document.getElementById("hud-midboss-bar").style.width =
          ((game.midBoss.hp / game.midBoss.maxHp) * 100) + "%";
      } else {
        mbBox.classList.add("hidden");
      }

      const bossBox = document.getElementById("hud-boss-container");
      if (game.boss && game.boss.active && !game.boss.dead) {
        bossBox.classList.remove("hidden");
        document.getElementById("hud-boss-phase").textContent =
          game.boss.groggyTimer > 0 ? "⚡GROGGY" : `P${game.boss.phase}`;
        document.getElementById("hud-boss-hp-text").textContent = `${Math.ceil(game.boss.hp)}`;
        document.getElementById("hud-boss-bar").style.width = ((game.boss.hp / game.boss.maxHp) * 100) + "%";
        if ((game.boss.armorShredTimer || 0) > 0) {
          document.getElementById("hud-boss-pattern-alert").textContent =
            `🛡️ 장갑파쇄 취약 활성 (+20% 피해) [${game.boss.armorShredTimer.toFixed(1)}s]`;
        } else {
          document.getElementById("hud-boss-pattern-alert").textContent = game.boss.lastPatternText;
        }
        document.getElementById("hud-boss-shield-overlay").classList.toggle("hidden", game.boss.invulnState === "NONE");
      } else {
        bossBox.classList.add("hidden");
      }
    }

    function drawMinimap() {
      const cvs = document.getElementById("minimap-canvas");
      if (!cvs) return;
      const ctx = cvs.getContext("2d");
      ctx.clearRect(0, 0, cvs.width, cvs.height);

      const me = game.players[mySlotIndex] || game.players[0];
      const cx = cvs.width / 2, cy = cvs.height / 2;
      const scale = 0.38;
      const refX = me ? me.x : 0, refZ = me ? me.z : 0;

      // [v3.1 전장의 안개] 열리기 전(!r.unlocked)인 다음 섹터들은 미니맵에 절대 표시하지 않음!
      game.rooms.forEach(r => {
        if (!r.unlocked) return;
        const rx = cx + (r.wx - refX) * scale;
        const ry = cy + (r.wz - refZ) * scale;
        const rw = (r.w || r.size) * scale;
        const rd = (r.d || r.size) * scale;

        if (r.collapsed) ctx.fillStyle = "rgba(127, 29, 29, 0.75)";
        else if (r.isBossRoom) ctx.fillStyle = "rgba(159, 18, 57, 0.65)";
        else ctx.fillStyle = "rgba(30, 41, 59, 0.92)";

        ctx.strokeStyle = r.index === game.currentRoomIndex ? "#f59e0b" : "#475569";
        ctx.lineWidth = r.index === game.currentRoomIndex ? 1.8 : 1;
        ctx.fillRect(rx - rw / 2, ry - rd / 2, rw, rd);
        ctx.strokeRect(rx - rw / 2, ry - rd / 2, rw, rd);

        // 지향성 독가스 미니맵 시각화
        if (r.gasWaveActive && r.gasWaveProgress > 0) {
          ctx.fillStyle = "rgba(132, 204, 22, 0.42)";
          const exitK = (r.nextDir && r.nextDir.key) || "N";
          const p = r.gasWaveProgress;
          if (exitK === "N") ctx.fillRect(rx - rw / 2, ry + rd / 2 - rd * p, rw, rd * p);
          else if (exitK === "S") ctx.fillRect(rx - rw / 2, ry - rd / 2, rw, rd * p);
          else if (exitK === "E") ctx.fillRect(rx - rw / 2, ry - rd / 2, rw * p, rd);
          else ctx.fillRect(rx + rw / 2 - rw * p, ry - rd / 2, rw * p, rd);
        }
      });

      if (game.spawnHoles) {
        ctx.strokeStyle = "#f43f5e";
        ctx.lineWidth = 1.4;
        game.spawnHoles.forEach(h => {
          const r = game.rooms[h.roomIndex];
          if (h.active && r && r.unlocked) {
            const hx = cx + (h.x - refX) * scale;
            const hy = cy + (h.z - refZ) * scale;
            ctx.beginPath();
            ctx.arc(hx, hy, 3.2, 0, Math.PI * 2);
            ctx.stroke();
          }
        });
      }

      game.armoryVaults.forEach(v => {
        const r = game.rooms[v.roomIndex];
        if (!r || !r.unlocked || (!v.activeInCalm && !r.isBossRoom)) return;
        ctx.fillStyle = "#facc15";
        ctx.fillRect(cx + (v.x - refX) * scale - 3, cy + (v.z - refZ) * scale - 3, 6, 6);
      });

      ctx.fillStyle = "#38bdf8";
      game.missionNodes.forEach(n => {
        const r = game.rooms[n.roomIndex];
        if (!n.done && r && r.unlocked) {
          ctx.fillRect(cx + (n.x - refX) * scale - 2.5, cy + (n.z - refZ) * scale - 2.5, 5, 5);
        }
      });
      ctx.fillStyle = "#fb7185";
      game.cystPods.forEach(pod => {
        const r = game.rooms[pod.roomIndex];
        if (pod.hp > 0 && pod.isMissionHive && r && r.unlocked) {
          ctx.fillRect(cx + (pod.x - refX) * scale - 2.5, cy + (pod.z - refZ) * scale - 2.5, 5, 5);
        }
      });

      if (game.boss && !game.boss.dead) {
        ctx.fillStyle = "#f43f5e";
        ctx.beginPath();
        ctx.arc(cx + (game.boss.x - refX) * scale, cy + (game.boss.z - refZ) * scale, 4.5, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.fillStyle = "#ef4444";
      game.zombies.forEach(z => {
        const zx = cx + (z.x - refX) * scale;
        const zy = cy + (z.z - refZ) * scale;
        ctx.fillRect(zx - 1, zy - 1, z.spec.isMidBoss ? 4.5 : 2, z.spec.isMidBoss ? 4.5 : 2);
      });

      game.players.forEach(p => {
        ctx.fillStyle = p.downed ? "#ef4444" : "#" + p.color.toString(16).padStart(6, "0");
        ctx.beginPath();
        ctx.arc(cx + (p.x - refX) * scale, cy + (p.z - refZ) * scale, 3.0, 0, Math.PI * 2);
        ctx.fill();
      });
    }

