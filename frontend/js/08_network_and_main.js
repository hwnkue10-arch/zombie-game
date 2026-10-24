/**
 * =========================================================================
 * BOXHEAD: THE CORE v3.3 — Frontend Module: 08_network_and_main.js
 * Zero-Loss Refactored Architecture (Shared Global Lexical Scope)
 * =========================================================================
 */
"use strict";

    // =========================================================================
    // 19. SESSION START, END & HAMACHI WEBSOCKET CLIENT
    // =========================================================================
    function getOrCreateClientId() {
      let cid = null;
      try { cid = localStorage.getItem("boxhead_client_id"); } catch (e) {}
      if (!cid) {
        cid = "cid_" + Math.random().toString(36).slice(2, 10) + "_" + Date.now().toString(36);
        try { localStorage.setItem("boxhead_client_id", cid); } catch (e) {}
      }
      return cid;
    }

    function saveGameSessionSnapshot() {
      if (!game.running) return;
      const me = game.players[mySlotIndex];
      if (!me) return;
      const curR = game.rooms[game.currentRoomIndex];
      const snap = {
        timestamp: Date.now(),
        seed: game.seed,
        elapsedTime: game.elapsedTime || 0,
        currentRoomIndex: game.currentRoomIndex,
        totalRooms: game.totalRooms,
        wavePhase: game.wavePhase,
        waveTimer: game.waveTimer,
        waveNumber: game.waveNumber,
        bioPoints: game.bioPoints,
        weaponParts: game.weaponParts,
        partsCrafted: game.partsCrafted,
        coreSamples: game.coreSamples,
        shopCoresBought: game.shopCoresBought,
        coresSoldCount: game.coresSoldCount,
        totalKills: game.totalKills,
        totalRevives: game.totalRevives,
        friendlyFire: game.friendlyFire,
        playerX: me.x,
        playerZ: me.z,
        currentWeapon: me.currentWeapon,
        medkits: me.medkits,
        stims: me.stims,
        hp: Math.max(30, me.hp),
        suitUpgrades: me.suitUpgrades ? { ...me.suitUpgrades } : {},
        doorsState: (game.doors || []).map(d => [d.open ? 1 : 0, d.lockedPermanently ? 1 : 0]),
        roomsState: (game.rooms || []).map(r => [r.unlocked ? 1 : 0, r.cleared ? 1 : 0, r.lockedBehind ? 1 : 0]),
        curRoomState: curR ? {
          progress: curR.progress,
          unlockStage: curR.unlockStage,
          completedStage: curR.completedStage,
          waitingForWaveDefense: curR.waitingForWaveDefense,
          roomWaveCount: curR.roomWaveCount,
          sectorTimer: curR.sectorTimer
        } : null,
        inventory: me.inventory.map(inv => ({
          unlocked: inv.unlocked,
          stats: { ...inv.stats },
          totalLv: inv.totalLv,
          tier1Special: inv.tier1Special,
          awakened: inv.awakened,
          transcended: inv.transcended,
          ammo: inv.ammo
        }))
      };
      try {
        sessionStorage.setItem("boxhead_f5_ingame_state", JSON.stringify(snap));
        localStorage.removeItem("boxhead_active_session");
      } catch (e) {}
    }

    function clearSavedGameSession() {
      try {
        sessionStorage.removeItem("boxhead_f5_ingame_state");
        localStorage.removeItem("boxhead_active_session");
      } catch (e) {}
      const banner = document.getElementById("resume-banner");
      if (banner) banner.classList.add("hidden");
    }

    function getActiveRefreshSnapshot() {
      try {
        localStorage.removeItem("boxhead_active_session");
        const banner = document.getElementById("resume-banner");
        if (banner) banner.classList.add("hidden");
        const raw = sessionStorage.getItem("boxhead_f5_ingame_state");
        if (!raw) return null;
        const snap = JSON.parse(raw);
        if (!snap || !snap.seed) return null;
        // 게임 진행 중 새로고침(F5)한 경우에만 즉시 인게임 복구 (60초 이내 새로고침)
        if (Date.now() - (snap.timestamp || 0) > 60 * 1000) {
          clearSavedGameSession();
          return null;
        }
        return snap;
      } catch (e) {
        return null;
      }
    }

    function startNewGameSession(customSeed, fromRemotePacket, restoredData) {
      SoundFX.init();
      const nickInput = document.getElementById("input-player-name");
      const optNickInput = document.getElementById("opt-nickname-input");
      const chosenNick = ((nickInput && nickInput.value) || (optNickInput && optNickInput.value) || "HOST_P1").trim();
      if (lobbySlots[mySlotIndex]) lobbySlots[mySlotIndex].name = chosenNick;
      if (optNickInput) optNickInput.value = chosenNick;

      game.pacing = document.getElementById("select-pacing") ? document.getElementById("select-pacing").value : "marathon";
      game.totalRooms = parseInt(document.getElementById("select-room-count").value, 10) || 10;
      game.collapseChance = parseFloat(document.getElementById("select-collapse-chance").value);
      game.friendlyFire = document.getElementById("select-friendly-fire").value === "1";
      game.reviveDuration = parseFloat(document.getElementById("select-revive-time").value) || 8.0;

      game.seed = customSeed || (restoredData && restoredData.seed) || Math.floor(1000 + Math.random() * 9000);
      game.elapsedTime = 0;
      game.currentRoomIndex = (restoredData && restoredData.currentRoomIndex) || 0;
      game.bioPoints = (restoredData && restoredData.bioPoints !== undefined) ? restoredData.bioPoints : 110;
      game.weaponParts = (restoredData && restoredData.weaponParts) || 0;
      game.partsCrafted = (restoredData && restoredData.partsCrafted) || 0;
      game.coreSamples = (restoredData && restoredData.coreSamples) || 0;
      game.shopCoresBought = (restoredData && restoredData.shopCoresBought) || 0;
      game.coresSoldCount = (restoredData && restoredData.coresSoldCount) || 0;
      game.thermiteParts = 0;
      game.totalKills = (restoredData && restoredData.totalKills) || 0;
      game.wavePhase = 'CALM';
      game.waveTimer = (restoredData && restoredData.currentRoomIndex > 0) ? 8.0 : 14.0;
      game.waveNumber = 1;
      game.comboCount = 0;
      game.totalRevives = (restoredData && restoredData.totalRevives) || 0;
      game.totalFriendlyFireDmg = 0;
      game.collapseState = { active: false, roomIndex: -1, timer: 0 };
      camInitialized = false;

      // 이전 세션의 잔류 알림 배너 및 타이머 완전 초기화
      const collapseBanner = document.getElementById("hud-collapse-banner");
      if (collapseBanner) collapseBanner.classList.add("hidden");
      const collapseMsg = document.getElementById("hud-collapse-msg");
      if (collapseMsg) collapseMsg.textContent = "";
      const collapseTimer = document.getElementById("hud-collapse-timer");
      if (collapseTimer) collapseTimer.textContent = "";
      const safeBanner = document.getElementById("hud-safe-banner");
      if (safeBanner) safeBanner.classList.add("hidden");
      const safeText = document.getElementById("hud-safe-banner-text");
      if (safeText) safeText.textContent = "";

      document.getElementById("hud-seed-label").textContent = "#" + game.seed;
      document.getElementById("hud-ff-badge").textContent = game.friendlyFire ? "ON" : "OFF";

      generateProceduralDungeon(game.seed);
      spawnSquadPlayers();

      if (restoredData) {
        if (restoredData.elapsedTime) game.elapsedTime = restoredData.elapsedTime;
        if (restoredData.wavePhase) game.wavePhase = restoredData.wavePhase;
        if (restoredData.waveTimer !== undefined) game.waveTimer = restoredData.waveTimer;
        if (restoredData.waveNumber !== undefined) game.waveNumber = restoredData.waveNumber;

        if (Array.isArray(restoredData.roomsState)) {
          restoredData.roomsState.forEach((rs, rIdx) => {
            if (game.rooms[rIdx]) {
              game.rooms[rIdx].unlocked = !!rs[0];
              game.rooms[rIdx].cleared = !!rs[1];
              game.rooms[rIdx].lockedBehind = !!rs[2];
            }
          });
        } else {
          for (let ri = 0; ri <= game.currentRoomIndex; ri++) {
            if (game.rooms[ri]) {
              game.rooms[ri].unlocked = true;
              if (ri < game.currentRoomIndex) game.rooms[ri].cleared = true;
            }
          }
        }

        if (Array.isArray(restoredData.doorsState)) {
          restoredData.doorsState.forEach((ds, dIdx) => {
            const d = game.doors[dIdx];
            if (d) {
              d.open = !!ds[0];
              d.lockedPermanently = !!ds[1];
              if (d.mesh) {
                d.mesh.position.y = d.open ? -4.2 : 2.0;
                if (d.lockedPermanently && d.mesh.material) {
                  d.mesh.material.color.setHex(0x991b1b);
                }
              }
            }
          });
        }

        const p = game.players[mySlotIndex];
        if (p) {
          if (restoredData.suitUpgrades) p.suitUpgrades = { ...restoredData.suitUpgrades };
          if (restoredData.inventory && Array.isArray(restoredData.inventory)) {
            restoredData.inventory.forEach((invData, i) => {
              if (p.inventory[i]) {
                p.inventory[i].unlocked = !!invData.unlocked;
                if (invData.stats) p.inventory[i].stats = { ...invData.stats };
                p.inventory[i].totalLv = invData.totalLv || 0;
                p.inventory[i].tier1Special = !!invData.tier1Special;
                p.inventory[i].awakened = !!invData.awakened;
                p.inventory[i].transcended = !!invData.transcended;
                p.inventory[i].ammo = invData.ammo !== undefined ? invData.ammo : p.inventory[i].ammo;
              }
            });
          }
          if (restoredData.currentWeapon !== undefined) p.currentWeapon = restoredData.currentWeapon;
          if (restoredData.medkits !== undefined) p.medkits = restoredData.medkits;
          if (restoredData.stims !== undefined) p.stims = restoredData.stims;
          if (restoredData.hp !== undefined) p.hp = restoredData.hp;
          p.maxStamina = getPlayerMaxStamina(p);
          p.stamina = p.maxStamina;
        }

        const targetRoom = game.rooms[game.currentRoomIndex] || game.rooms[0];
        if (targetRoom) {
          targetRoom.unlocked = true;
          if (restoredData.curRoomState) {
            targetRoom.progress = restoredData.curRoomState.progress || 0;
            targetRoom.unlockStage = restoredData.curRoomState.unlockStage || 0;
            targetRoom.completedStage = restoredData.curRoomState.completedStage || 0;
            targetRoom.waitingForWaveDefense = restoredData.curRoomState.waitingForWaveDefense ?? true;
            targetRoom.roomWaveCount = restoredData.curRoomState.roomWaveCount || 1;
            if (restoredData.curRoomState.sectorTimer !== undefined) {
              targetRoom.sectorTimer = restoredData.curRoomState.sectorTimer;
            }
            if (!targetRoom.waitingForWaveDefense && targetRoom.unlockStage > (targetRoom.completedStage || 0)) {
              spawnRandomMissionStepForRoom(targetRoom, targetRoom.unlockStage);
            }
          }
          const spawnX = (restoredData.playerX !== undefined) ? restoredData.playerX : targetRoom.wx;
          const spawnZ = (restoredData.playerZ !== undefined) ? restoredData.playerZ : targetRoom.wz;
          game.players.forEach(pl => {
            pl.x = spawnX;
            pl.z = spawnZ;
            if (pl.visual && pl.visual.group) pl.visual.group.position.set(spawnX, 0, spawnZ);
          });
          camera.position.set(spawnX, 44, spawnZ + 34);
          camera.lookAt(spawnX, 0, spawnZ);
          relocateArmoryForCalmPhase(targetRoom);
        }
      } else {
        if (game.rooms[0]) relocateArmoryForCalmPhase(game.rooms[0]);
      }

      updateRoomVisibility();
      updateWeaponSlotsHUD();

      document.getElementById("lobby-screen").classList.add("hidden");
      document.getElementById("result-modal").classList.add("hidden");
      document.getElementById("upgrade-modal").classList.add("hidden");
      document.getElementById("ingame-hud").classList.remove("hidden");
      document.getElementById("damage-vignette").style.opacity = "0";

      const resumeBanner = document.getElementById("resume-banner");
      if (resumeBanner) resumeBanner.classList.add("hidden");

      game.running = true;
      saveGameSessionSnapshot();

      if (!fromRemotePacket && !isRemoteClient && wsClient && wsClient.readyState === WebSocket.OPEN) {
        wsClient.send(JSON.stringify({
          type: "START_GAME",
          seed: game.seed,
          pacing: game.pacing,
          totalRooms: game.totalRooms,
          collapseChance: game.collapseChance,
          friendlyFire: game.friendlyFire,
          reviveDuration: game.reviveDuration
        }));
      }
    }

    function finishGameSession(victory) {
      game.running = false;
      clearSavedGameSession();
      game.collapseState = { active: false, roomIndex: -1, timer: 0 };
      const collapseBanner = document.getElementById("hud-collapse-banner");
      if (collapseBanner) collapseBanner.classList.add("hidden");
      const collapseMsg = document.getElementById("hud-collapse-msg");
      if (collapseMsg) collapseMsg.textContent = "";
      const collapseTimer = document.getElementById("hud-collapse-timer");
      if (collapseTimer) collapseTimer.textContent = "";
      const safeBanner = document.getElementById("hud-safe-banner");
      if (safeBanner) safeBanner.classList.add("hidden");
      const safeText = document.getElementById("hud-safe-banner-text");
      if (safeText) safeText.textContent = "";

      const modal = document.getElementById("result-modal");
      const badge = document.getElementById("result-badge");
      const title = document.getElementById("result-title");
      const subtitle = document.getElementById("result-subtitle");
      modal.classList.remove("hidden");

      if (victory) {
        badge.textContent = "MISSION ACCOMPLISHED";
        badge.className = "inline-block px-3 py-1 rounded-full text-xs font-black uppercase bg-emerald-500 text-slate-950 mb-2";
        title.textContent = "변이 생체 심장 '더 코어' 완벽 파괴!";
        subtitle.textContent = "모든 웨이브 방어 미션과 3대 중간보스·최종보스를 돌파하고 승리했습니다!";
        SoundFX.play("revive");
      } else {
        badge.textContent = "SQUAD WIPED";
        badge.className = "inline-block px-3 py-1 rounded-full text-xs font-black uppercase bg-red-600 text-white mb-2";
        title.textContent = "전원 빈사 — 작전 실패";
        subtitle.textContent = "대기실(방)로 돌아가 전열을 재정비하고 다시 시작하세요.";
        SoundFX.play("alarm");
      }

      const mins = String(Math.floor(game.elapsedTime / 60)).padStart(2, "0");
      const secs = String(Math.floor(game.elapsedTime % 60)).padStart(2, "0");
      document.getElementById("stat-room").textContent = `Sector ${game.currentRoomIndex + 1} / ${game.totalRooms}`;
      document.getElementById("stat-time").textContent = `${mins}:${secs}`;
      document.getElementById("stat-kills").textContent = `${game.totalKills}마리`;
      document.getElementById("stat-revives").textContent = `${game.totalRevives}회`;
      document.getElementById("stat-ff").textContent = `${game.totalFriendlyFireDmg}`;
      const bossPct = game.boss ? Math.max(0, Math.round((game.boss.hp / game.boss.maxHp) * 100)) : 100;
      document.getElementById("stat-boss").textContent = `${bossPct}%`;
    }

    function returnToWaitingRoomLobby() {
      game.running = false;
      clearSavedGameSession();
      game.collapseState = { active: false, roomIndex: -1, timer: 0 };
      const collapseBanner = document.getElementById("hud-collapse-banner");
      if (collapseBanner) collapseBanner.classList.add("hidden");
      const collapseMsg = document.getElementById("hud-collapse-msg");
      if (collapseMsg) collapseMsg.textContent = "";
      const collapseTimer = document.getElementById("hud-collapse-timer");
      if (collapseTimer) collapseTimer.textContent = "";
      const safeBanner = document.getElementById("hud-safe-banner");
      if (safeBanner) safeBanner.classList.add("hidden");
      const safeText = document.getElementById("hud-safe-banner-text");
      if (safeText) safeText.textContent = "";

      document.getElementById("result-modal").classList.add("hidden");
      document.getElementById("upgrade-modal").classList.add("hidden");
      document.getElementById("settings-modal").classList.add("hidden");
      document.getElementById("ingame-hud").classList.add("hidden");
      document.getElementById("lobby-screen").classList.remove("hidden");
      document.getElementById("damage-vignette").style.opacity = "0";
      renderLobbySlots();
    }

    let reconnectTimer = null;

    function connectHamachiServer() {
      const urlInput = document.getElementById("input-server-url");
      let url = urlInput ? urlInput.value.trim() : "";
      if (!url && window.location && window.location.host && window.location.protocol.startsWith("http")) {
        const wsProto = window.location.protocol === "https:" ? "wss://" : "ws://";
        url = wsProto + window.location.host;
        if (urlInput) urlInput.value = url;
      }
      const statusEl = document.getElementById("lobby-conn-status");
      if (!url) return;
      if (statusEl) statusEl.textContent = "⏳ 서버 연결 시도 중...";
      try {
        if (wsClient) {
          try { wsClient.close(); } catch (e) {}
        }
        wsClient = new WebSocket(url);
        wsClient.onopen = () => {
          const isHostCand = (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1");
          if (statusEl) {
            statusEl.textContent = isHostCand ? "🟢 로컬 호스트 연결 완료 (방장 준비됨)" : "🟢 멀티플레이 서버 연결 완료!";
            statusEl.className = "text-[11px] font-mono-code font-bold text-emerald-400";
          }
          const connBtn = document.getElementById("btn-connect-ws");
          if (connBtn) {
            connBtn.textContent = "연결됨 ✓";
            connBtn.className = "px-2.5 py-1.5 rounded-lg bg-emerald-600/90 hover:bg-emerald-600 text-xs font-bold text-white whitespace-nowrap shadow";
          }
          const netBadge = document.getElementById("hud-net-mode");
          if (netBadge) netBadge.textContent = isHostCand ? "HOST LOCAL" : "HAMACHI WS";
          const nickInput = document.getElementById("input-player-name");
          const nick = (nickInput && nickInput.value.trim()) || (isHostCand ? "HOST_P1" : "PLAYER");
          wsClient.send(JSON.stringify({
            type: "JOIN_LOBBY",
            name: nick,
            clientId: getOrCreateClientId(),
            isHostCandidate: isHostCand
          }));
        };

        wsClient.onclose = () => {
          if (!game.running) {
            const connBtn = document.getElementById("btn-connect-ws");
            if (connBtn) {
              connBtn.textContent = "재접속";
              connBtn.className = "px-2.5 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-xs font-bold text-white whitespace-nowrap";
            }
            if (statusEl) {
              statusEl.textContent = "🟡 서버 연결 대기 중 (재연결 시도 중...)";
              statusEl.className = "text-[11px] font-mono-code font-bold text-amber-400";
            }
            if (!reconnectTimer) {
              reconnectTimer = setTimeout(() => {
                reconnectTimer = null;
                connectHamachiServer();
              }, 2000);
            }
          }
        };

        wsClient.onerror = () => {
          // Handled by onclose
        };

        wsClient.onmessage = (ev) => {
          try {
            const msg = JSON.parse(ev.data);
            if (msg.type === "ROOM_FULL") {
              if (statusEl) {
                statusEl.textContent = "⛔ 방 정원 초과 (4/4 MAN FULL) — 대기실이 가득 차 입장할 수 없습니다!";
                statusEl.className = "text-[11px] font-mono-code font-bold text-red-400";
              }
              wsClient.close();
              return;
            } else if (msg.type === "KICKED") {
              if (statusEl) {
                statusEl.textContent = "🚫 방장에 의해 대기실에서 강퇴되었습니다.";
                statusEl.className = "text-[11px] font-mono-code font-bold text-red-400";
              }
              if (game.running) returnToWaitingRoomLobby();
              wsClient.close();
              return;
            } else if (msg.type === "LOBBY_STATE" && Array.isArray(msg.slots)) {
              msg.slots.forEach((s, i) => {
                if (lobbySlots[i]) {
                  lobbySlots[i].name = s.name;
                  lobbySlots[i].role = s.role;
                }
              });
              renderLobbySlots();
            } else if (msg.type === "START_GAME") {
              if (Array.isArray(msg.slots)) {
                msg.slots.forEach((s, i) => {
                  if (lobbySlots[i]) { lobbySlots[i].name = s.name; lobbySlots[i].role = s.role; }
                });
              }
              if (msg.pacing && document.getElementById("select-pacing")) document.getElementById("select-pacing").value = msg.pacing;
              if (msg.totalRooms && document.getElementById("select-room-count")) document.getElementById("select-room-count").value = String(msg.totalRooms);
              if (msg.friendlyFire !== undefined && document.getElementById("select-friendly-fire")) document.getElementById("select-friendly-fire").value = msg.friendlyFire ? "1" : "0";
              if (msg.reviveDuration && document.getElementById("select-revive-time")) document.getElementById("select-revive-time").value = String(msg.reviveDuration);
              startNewGameSession(msg.seed, true);
            } else if (msg.type === "REVIVE_SYNC" && game.running) {
              const targetP = game.players.find(pl => pl.id === msg.targetId);
              if (targetP && targetP.downed) completeRevive(targetP);
            } else if (msg.type === "ASSIGN_SLOT" && typeof msg.slotId === "number") {
              mySlotIndex = msg.slotId;
              isRemoteClient = (msg.slotId !== 0);
              const netBadge = document.getElementById("hud-net-mode");
              if (netBadge) netBadge.textContent = isRemoteClient ? `CLIENT P${msg.slotId + 1}` : "HOST P1";
              if (statusEl) {
                statusEl.textContent = isRemoteClient
                  ? `🟢 서버 연결됨: P${msg.slotId + 1} 슬롯 참가`
                  : `🟢 로컬 리슨 호스트 연결됨 (P1 방장)`;
                statusEl.className = "text-[11px] font-mono-code font-bold text-emerald-400";
              }
              renderLobbySlots();
            } else if (msg.type === "PLAYER_STATE" && game.running) {
              const p = game.players.find(pl => pl.id === msg.slotId);
              if (p && p.id !== mySlotIndex) {
                p.role = "REMOTE";
                p.netTargetX = msg.x;
                p.netTargetZ = msg.z;
                p.netTargetRotY = msg.rotY;
                if (Math.hypot(p.x - msg.x, p.z - msg.z) > 6.0) {
                  p.x = msg.x;
                  p.z = msg.z;
                }
                p.hp = msg.hp;
                p.tempHp = msg.tempHp || 0;
                p.downed = !!msg.downed;
                p.currentWeapon = msg.currentWeapon || 0;
                p.walkCycle = msg.walkCycle || 0;
              }
            } else if (msg.type === "REMOTE_FIRE" && game.running) {
              const p = game.players.find(pl => pl.id === msg.slotId);
              if (p && p.id !== mySlotIndex) {
                p.x = msg.x !== undefined ? msg.x : p.x;
                p.z = msg.z !== undefined ? msg.z : p.z;
                p.currentWeapon = msg.wIdx !== undefined ? msg.wIdx : p.currentWeapon;
                const inv = p.inventory[p.currentWeapon];
                if (inv) {
                  inv.unlocked = true;
                  if (msg.stats) inv.stats = msg.stats;
                  if (msg.totalLv !== undefined) inv.totalLv = msg.totalLv;
                  inv.tier1Special = !!msg.tier1Special;
                  inv.awakened = !!msg.awakened;
                  inv.transcended = !!msg.transcended;
                }
                fireWeapon(p, msg.dirX, msg.dirZ, msg.shotSeed);
              }
            } else if (msg.type === "REMOTE_SKILL" && game.running) {
              const p = game.players.find(pl => pl.id === msg.slotId);
              if (p && p.id !== mySlotIndex) {
                if (msg.skill === "BASH") {
                  p.x = msg.x !== undefined ? msg.x : p.x;
                  p.z = msg.z !== undefined ? msg.z : p.z;
                  triggerMeleeBash(p, true);
                } else if (msg.skill === "DASH") {
                  if (msg.rotY !== undefined) p.rotY = msg.rotY;
                  triggerTacticalDash(p, true);
                }
              }
            } else if (msg.type === "MISSION_ACTION" && game.running) {
              const r = game.rooms[msg.roomIdx];
              if (r) {
                if (msg.action === "ADVANCE_STAGE") {
                  r.completedStage = Math.max(r.completedStage || 0, msg.completedStep || 0);
                  r.waitingForWaveDefense = true;
                  if (game.wavePhase === "CALM" && game.waveTimer > 4.0) {
                    game.waveTimer = 4.0;
                  }
                } else if (msg.action === "ATTACH_THERMITE") {
                  r.subStage = 2;
                  r.lastSubStageChangeTime = Date.now();
                  const nextDoor = game.doors.find(d => d.fromRoom === r.index && !d.open);
                  if (nextDoor) {
                    ensureThermiteDoorVisuals(r, nextDoor);
                    spawnMissionStageVFX(nextDoor.x, nextDoor.z, 0xf97316, 5.0, 16, false);
                  }
                  SoundFX.play("alarm");
                  const safeBanner = document.getElementById("hud-safe-banner");
                  if (safeBanner) {
                    document.getElementById("hud-safe-banner-text").textContent =
                      "🧨 테르밋 설치 완료! 바닥 위험구역 밖으로 대피하세요";
                    safeBanner.classList.remove("hidden");
                    setTimeout(() => safeBanner.classList.add("hidden"), 4200);
                  }
                } else if (msg.action === "SYNTHESIZE_THERMITE") {
                  const node = game.missionNodes.find(n => n.roomIndex === msg.roomIdx && n.kind === "SYNTH_TABLE" && !n.done);
                  if (node) {
                    node.done = true;
                    if (node.mesh) entitiesGroup.remove(node.mesh);
                  }
                  r.subStage = 1;
                  r.completedStage = 3;
                  r.lastSubStageChangeTime = Date.now();
                  if (node) spawnMissionStageVFX(node.x, node.z, 0xf97316, 6.5, 22, true);
                  SoundFX.play("upgrade");
                  const nextDoor = game.doors.find(d => d.fromRoom === r.index && !d.open);
                  if (nextDoor) ensureThermiteDoorVisuals(r, nextDoor);
                  const safeBanner = document.getElementById("hud-safe-banner");
                  if (safeBanner) {
                    document.getElementById("hud-safe-banner-text").textContent =
                      "🔥 테르밋 폭약 합성 완료! 출구 방화벽에 부착하세요";
                    safeBanner.classList.remove("hidden");
                    setTimeout(() => safeBanner.classList.add("hidden"), 4000);
                  }
                } else if (msg.action === "PICKUP_CHEM_PART") {
                  const node = game.missionNodes.find(n => n.roomIndex === msg.roomIdx && n.kind === "CHEM_PART" && n.stepOrder === msg.stepOrder && !n.done);
                  if (node) {
                    node.done = true;
                    if (node.mesh) entitiesGroup.remove(node.mesh);
                  }
                  game.thermiteParts = Math.max(game.thermiteParts || 0, msg.stepOrder || 1);
                  if (node) spawnMissionStageVFX(node.x, node.z, 0xf59e0b, 4.2, 14, false);
                  SoundFX.play("pickup");
                  advanceRoomMissionStage(
                    r,
                    msg.stepOrder,
                    msg.stepOrder === 1
                      ? "✅ 1번 원료 회수 완료! 다음 웨이브를 막으면 2번 원료가 개방됩니다!"
                      : "✅ 2번 원료 회수 완료! 다음 웨이브를 막으면 중앙 합성대가 개방됩니다!"
                  );
                } else if (msg.action === "IGNITE_GENERATOR") {
                  const node = game.missionNodes.find(n => n.roomIndex === msg.roomIdx && n.kind === "GENERATOR" && n.stepOrder === msg.stepOrder && !n.done);
                  if (node) {
                    node.done = true;
                    if (node.coreMat) node.coreMat.color.setHex(0x38bdf8);
                    spawnMissionStageVFX(node.x, node.z, 0x38bdf8, 6.8, 20, false);
                  }
                  r.progress++;
                  SoundFX.play("upgrade");
                  if (r.progress < r.targetVal) {
                    advanceRoomMissionStage(
                      r,
                      msg.stepOrder,
                      `✅ 발전기 #${msg.stepOrder} 가동 완료! 다음 웨이브를 막으면 발전기 #${msg.stepOrder + 1}이 개방됩니다!`
                    );
                  }
                  checkRoomClear(r);
                } else if (msg.action === "WAKE_MIDBOSS") {
                  r.midBossAwakened = true;
                  r.midBossSpawned = true;
                  const podNode = game.missionNodes.find(n => n.roomIndex === msg.roomIdx && n.kind === "MID_BOSS_POD");
                  if (podNode) {
                    podNode.done = true;
                    if (podNode.mesh) entitiesGroup.remove(podNode.mesh);
                  }
                  spawnIceShatterFX(r.wx, r.wz, 15);
                  spawnBloodParticles(r.wx, 2.5, r.wz, 0x06b6d4, 25);
                  SoundFX.play("alarm");
                  if (!isRemoteClient) {
                    const mbPool = ["MB_JUGGERNAUT", "MB_SUMMONER", "MB_ACIDQUEEN"];
                    const mbKey = mbPool[Math.max(0, r.midBossOrder) % mbPool.length];
                    const mb = spawnZombie(mbKey, r.wx, r.wz, r.index);
                    const safeBanner = document.getElementById("hud-safe-banner");
                    if (safeBanner) {
                      document.getElementById("hud-safe-banner-text").textContent =
                        `🚨 경보: [${mb.spec.name}] 격리 해제! 즉시 격멸하십시오!`;
                      safeBanner.classList.remove("hidden");
                      setTimeout(() => safeBanner.classList.add("hidden"), 4500);
                    }
                  }
                } else if (msg.action === "START_FINAL_BOSS") {
                  r.bossPhaseStage = 1;
                  const consoleNode = game.missionNodes.find(n => n.roomIndex === msg.roomIdx && n.kind === "BOSS_MASTER_CONSOLE");
                  if (consoleNode) {
                    consoleNode.done = true;
                    if (consoleNode.mesh) entitiesGroup.remove(consoleNode.mesh);
                  }
                  SoundFX.play("alarm");
                  if (consoleNode) spawnMissionStageVFX(consoleNode.x, consoleNode.z, 0xf43f5e, 10.0, 25, true);
                  const safeBanner = document.getElementById("hud-safe-banner");
                  if (safeBanner) {
                    document.getElementById("hud-safe-banner-text").textContent =
                      "🚨 격벽 해제 개시! 돔 좌·우 보조 냉각콘솔 2기를 과부하시키십시오!";
                    safeBanner.classList.remove("hidden");
                    setTimeout(() => safeBanner.classList.add("hidden"), 4500);
                  }
                } else if (msg.action === "OVERLOAD_COOLANT") {
                  const coolantNode = game.missionNodes.find(n => n.roomIndex === msg.roomIdx && n.kind === "BOSS_COOLANT" && n.coolantIdx === msg.coolantIdx);
                  if (coolantNode) {
                    coolantNode.done = true;
                    if (coolantNode.mesh) entitiesGroup.remove(coolantNode.mesh);
                    spawnMissionStageVFX(coolantNode.x, coolantNode.z, 0x06b6d4, 8.0, 20, false);
                  }
                  r.coolantsDone = (r.coolantsDone || 0) + 1;
                  SoundFX.play("upgrade");
                  if (r.coolantsDone >= 2) {
                    r.bossPhaseStage = 2;
                    if (!isRemoteClient) spawnSector10DefensePylons(r);
                    SoundFX.play("alarm");
                  }
                } else if (msg.action === "PICKUP_BLACKBOX") {
                  const bbNode = game.missionNodes.find(n => n.roomIndex === msg.roomIdx && n.kind === "BLACKBOX");
                  if (bbNode) {
                    bbNode.done = true;
                    if (bbNode.mesh) entitiesGroup.remove(bbNode.mesh);
                    spawnMissionStageVFX(bbNode.x, bbNode.z, 0x38bdf8, 4.5, 14, false);
                  }
                  SoundFX.play("pickup");
                  advanceRoomMissionStage(
                    r,
                    1,
                    r.reqWaves >= 3
                      ? "✅ 블랙박스 회수 완료! 다음 웨이브를 방어하면 🔐보안중계기가 출현합니다!"
                      : "✅ 블랙박스 회수 완료! 다음 웨이브를 방어하면 출구 업로드 단말기가 개방됩니다!"
                  );
                } else if (msg.action === "DECRYPT_RELAY") {
                  const relNode = game.missionNodes.find(n => n.roomIndex === msg.roomIdx && n.kind === "SECURITY_RELAY");
                  if (relNode) {
                    relNode.done = true;
                    if (relNode.mesh) entitiesGroup.remove(relNode.mesh);
                    spawnMissionStageVFX(relNode.x, relNode.z, 0x6366f1, 5.8, 18, false);
                  }
                  SoundFX.play("upgrade");
                  advanceRoomMissionStage(
                    r,
                    2,
                    "✅ 보안중계기 암호 해독 완료! 다음 웨이브를 방어하면 🛰️업로드 송신기가 출현합니다!"
                  );
                } else if (msg.action === "UPLOAD_PAYLOAD") {
                  const upNode = game.missionNodes.find(n => n.roomIndex === msg.roomIdx && n.kind === "UPLOAD_TERMINAL");
                  if (upNode) {
                    upNode.done = true;
                    if (upNode.mesh) entitiesGroup.remove(upNode.mesh);
                    spawnMissionStageVFX(upNode.x, upNode.z, 0x38bdf8, 7.5, 24, true);
                  }
                  r.progress = 1;
                  r.completedStage = 2;
                  checkRoomClear(r);
                } else if (msg.action === "RADAR_STAGE") {
                  const kinds = ["RADAR_CONSOLE", "RADAR_DISH", "RADAR_BEACON"];
                  const k = kinds[(msg.stepOrder || 1) - 1] || "RADAR_CONSOLE";
                  const node = game.missionNodes.find(n => n.roomIndex === msg.roomIdx && n.kind === k);
                  if (node) {
                    node.done = true;
                    spawnMissionStageVFX(node.x, node.z, 0x38bdf8, 6.0, 18, false);
                  }
                  r.progress = msg.stepOrder;
                  SoundFX.play("upgrade");
                  if (r.progress >= 3) {
                    checkRoomClear(r);
                  } else {
                    advanceRoomMissionStage(
                      r,
                      msg.stepOrder,
                      msg.stepOrder === 1
                        ? "✅ 통신 배전반 가동 완료! 다음 웨이브를 방어하면 🛰️레이더 안테나가 활성화됩니다!"
                        : "✅ 레이더 안테나 각도 정렬 완료! 다음 웨이브를 방어하면 📶위성 송신 비콘이 가동됩니다!"
                    );
                  }
                } else if (msg.action === "DECON_VALVE") {
                  const node = game.missionNodes.find(n => n.roomIndex === msg.roomIdx && n.kind === "DECON_VALVE" && n.stepOrder === msg.stepOrder);
                  if (node) {
                    node.done = true;
                    spawnMissionStageVFX(node.x, node.z, 0x10b981, 6.5, 18, false);
                  }
                  r.progress++;
                  SoundFX.play("upgrade");
                  if (r.progress < r.targetVal) {
                    advanceRoomMissionStage(
                      r,
                      msg.stepOrder,
                      `✅ 오염 밸브 #${msg.stepOrder} 차단 완료 (+500 BP)! 다음 웨이브를 방어하면 밸브 #${reqStep + 1}이 개방됩니다!`
                    );
                  }
                  checkRoomClear(r);
                }
              }
            } else if (msg.type === "SECTOR_LOCK_TELEPORT" && game.running) {
              const me = game.players[mySlotIndex];
              const targetR = game.rooms[msg.roomIdx];
              if (me && targetR && (Math.abs(me.x - targetR.wx) >= (targetR.hw || targetR.half) || Math.abs(me.z - targetR.wz) >= (targetR.hd || targetR.half))) {
                me.x = msg.destX + (mySlotIndex - 1.5) * 1.5;
                me.z = msg.destZ + 1.2;
                if (me.visual && me.visual.group) me.visual.group.position.set(me.x, 0, me.z);
              }
            } else if (msg.type === "WORLD_SNAPSHOT" && game.running && isRemoteClient) {
              // 호스트(P1) 권위 월드·좀비·웨이브·미션·격벽(Door) 스냅샷 동기화 -> 친구가 다음 섹터로 이동할 때 벽에 막히는 버그 100% 해결!
              game.wavePhase = msg.wavePhase || game.wavePhase;
              game.waveTimer = msg.waveTimer !== undefined ? msg.waveTimer : game.waveTimer;

              let needVisUpdate = false;
              if (Array.isArray(msg.roomsState)) {
                msg.roomsState.forEach((rs, rIdx) => {
                  const r = game.rooms[rIdx];
                  if (!r) return;
                  const u = !!rs[0];
                  const c = !!rs[1];
                  const lb = !!rs[2];
                  if (r.unlocked !== u || r.cleared !== c) needVisUpdate = true;
                  r.unlocked = u;
                  r.cleared = c;
                  r.lockedBehind = lb;
                });
              }

              if (Array.isArray(msg.doorsState)) {
                msg.doorsState.forEach((ds, dIdx) => {
                  const d = game.doors[dIdx];
                  if (!d) return;
                  const shouldOpen = !!ds[0];
                  const shouldLock = !!ds[1];
                  if (d.open !== shouldOpen || d.lockedPermanently !== shouldLock) {
                    const wasOpen = d.open;
                    d.open = shouldOpen;
                    d.lockedPermanently = shouldLock;
                    needVisUpdate = true;
                    if (!wasOpen && shouldOpen) {
                      const fRoom = game.rooms[d.fromRoom];
                      if (fRoom && fRoom.condType === "THERMITE") {
                        detonateThermiteDoor(fRoom, d);
                      } else {
                        spawnMissionStageVFX(d.x, d.z, 0x10b981, 6.0, 18, false);
                      }
                    }
                    if (d.mesh && d.lockedPermanently && d.mesh.material) {
                      d.mesh.material.color.setHex(0x991b1b);
                      if (d.mesh.material.emissive) d.mesh.material.emissive.setHex(0x450a0a);
                    }
                  }
                });
              }

              if (msg.roomIdx !== undefined && msg.roomIdx !== game.currentRoomIndex) {
                game.currentRoomIndex = msg.roomIdx;
                if (game.rooms[msg.roomIdx]) game.rooms[msg.roomIdx].unlocked = true;
                // 이전 섹터에서 다음 섹터로 열리는 연결 격벽도 확실히 개방 보장!
                game.doors.forEach(d => {
                  if (d.toRoom <= msg.roomIdx && !d.lockedPermanently) {
                    d.open = true;
                  }
                });
                needVisUpdate = true;
              }

              if (needVisUpdate) {
                updateRoomVisibility();
              }

              const cr = game.rooms[game.currentRoomIndex];
              if (cr && msg.roomState) {
                cr.progress = msg.roomState.progress;
                if (msg.roomState.subStage !== undefined) {
                  // 클라이언트가 테르밋 부착 완료(subStage=2) 후 호스트 스냅샷 왕복 지연(2.5초) 동안 이전 값(1)으로 롤백되는 현상 방지
                  if (cr.subStage === 2 && msg.roomState.subStage < 2 && (Date.now() - (cr.lastSubStageChangeTime || 0)) < 2500) {
                    // 호스트 수신 확인 대기 (클라이언트 상태 2 유지)
                  } else {
                    cr.subStage = msg.roomState.subStage;
                  }
                }
                cr.unlockStage = msg.roomState.unlockStage;
                cr.completedStage = msg.roomState.completedStage;
                cr.waitingForWaveDefense = msg.roomState.waitingForWaveDefense;
                if (msg.roomState.waveZombieQuota !== undefined) cr.waveZombieQuota = msg.roomState.waveZombieQuota;
                if (msg.roomState.waveZombiesSpawned !== undefined) cr.waveZombiesSpawned = msg.roomState.waveZombiesSpawned;
                cr.sectorTimer = msg.roomState.sectorTimer;
                cr.berserkActive = msg.roomState.berserkActive;
                cr.gasWaveActive = msg.roomState.gasWaveActive;
                cr.gasWaveProgress = msg.roomState.gasWaveProgress;
                if (msg.roomState.midBossAwakened !== undefined) cr.midBossAwakened = msg.roomState.midBossAwakened;
                if (msg.roomState.bossPhaseStage !== undefined) cr.bossPhaseStage = msg.roomState.bossPhaseStage;
                if (msg.roomState.thermiteDetonated !== undefined) cr.thermiteDetonated = msg.roomState.thermiteDetonated;
              }

              if (msg.thermiteParts !== undefined) {
                game.thermiteParts = msg.thermiteParts;
              }

              if (Array.isArray(msg.missionNodes)) {
                msg.missionNodes.forEach(syncMissionNodeFromNetwork);
              }

              if (Array.isArray(msg.roomsGas)) {
                msg.roomsGas.forEach((rg, idx) => {
                  if (game.rooms[idx]) {
                    game.rooms[idx].gasWaveActive = (rg[0] === 1);
                    game.rooms[idx].gasWaveProgress = rg[1];
                  }
                });
              }

              // 후방 격벽이 봉쇄(lockedBehind)되었을 때 원격 플레이어가 아직 이전 방에 남아있다면 현재 섹터 안으로 자동 합류!
              const meP = game.players[mySlotIndex];
              if (cr && cr.lockedBehind && meP) {
                const hw = cr.hw || cr.half;
                const hd = cr.hd || cr.half;
                if (Math.abs(meP.x - cr.wx) >= hw || Math.abs(meP.z - cr.wz) >= hd) {
                  meP.x = cr.wx + (mySlotIndex - 1.5) * 1.5;
                  meP.z = cr.wz + 1.2;
                }
              }

              if (Array.isArray(msg.zombies)) {
                while (game.zombies.length > msg.zombies.length) {
                  const rem = game.zombies.pop();
                  if (rem && rem.group) entitiesGroup.remove(rem.group);
                }
                msg.zombies.forEach((zs, idx) => {
                  let zObj = game.zombies[idx];
                  if (!zObj || zObj.typeKey !== zs[0]) {
                    if (zObj && zObj.group) entitiesGroup.remove(zObj.group);
                    zObj = spawnZombie(zs[0], zs[1], zs[2], game.currentRoomIndex);
                    game.zombies.pop();
                    game.zombies[idx] = zObj;
                  }
                  zObj.x += (zs[1] - zObj.x) * 0.45;
                  zObj.z += (zs[2] - zObj.z) * 0.45;
                  zObj.hp = zs[3];
                  zObj.maxHp = zs[4];
                  zObj.group.position.set(zObj.x, 0, zObj.z);
                  if (cr && cr.berserkActive && !zObj.berserkEnraged && !zObj.spec.isNutrientHost) {
                    zObj.berserkEnraged = true;
                    if (zObj.skinMat) {
                      zObj.skinMat.emissive.setHex(0xef4444);
                      zObj.skinMat.emissiveIntensity = 0.85;
                    }
                    if (zObj.group) {
                      zObj.group.scale.multiplyScalar(1.15);
                    }
                  }
                });
              }
            }
          } catch (err) {}
        };
        wsClient.onerror = () => {
          statusEl.textContent = "● 로컬 리슨 호스트 모드 활성";
        };
      } catch (e) {
        statusEl.textContent = "● 로컬 리슨 호스트 모드 활성";
      }
    }

    // [v3.1 멀티플레이 실시간 브로드캐스터]
    // 1) 모든 클라이언트: 20Hz(50ms) 주기로 내 캐릭터 좌표·회전·체력·장착무기를 서버로 전송
    setInterval(() => {
      if (!game.running || !wsClient || wsClient.readyState !== WebSocket.OPEN) return;
      const me = game.players[mySlotIndex];
      if (!me) return;
      try {
        wsClient.send(JSON.stringify({
          type: "PLAYER_STATE",
          slotId: mySlotIndex,
          x: Math.round(me.x * 100) / 100,
          z: Math.round(me.z * 100) / 100,
          rotY: Math.round(me.rotY * 100) / 100,
          hp: Math.round(me.hp),
          tempHp: Math.round(me.tempHp || 0),
          downed: !!me.downed,
          currentWeapon: me.currentWeapon,
          walkCycle: Math.round(me.walkCycle * 10) / 10
        }));
      } catch (e) {}
    }, 50);

    // 2) 호스트(P1): 8Hz(125ms) 주기로 월드 상태 및 좀비 위치 스냅샷을 브로드캐스트하여 4인 화면의 좀비/웨이브/미션 완벽 동기화!
    setInterval(() => {
      if (!game.running || isRemoteClient || !wsClient || wsClient.readyState !== WebSocket.OPEN) return;
      const cr = game.rooms[game.currentRoomIndex];
      try {
        const zSnap = game.zombies.slice(0, 120).map(z => [
          z.typeKey,
          Math.round(z.x * 10) / 10,
          Math.round(z.z * 10) / 10,
          Math.round(z.hp),
          Math.round(z.maxHp)
        ]);
        wsClient.send(JSON.stringify({
          type: "WORLD_SNAPSHOT",
          roomIdx: game.currentRoomIndex,
          wavePhase: game.wavePhase,
          waveTimer: Math.round(game.waveTimer * 10) / 10,
          doorsState: (game.doors || []).map(d => [d.open ? 1 : 0, d.lockedPermanently ? 1 : 0]),
          roomsState: (game.rooms || []).map(r => [r.unlocked ? 1 : 0, r.cleared ? 1 : 0, r.lockedBehind ? 1 : 0]),
          roomsGas: (game.rooms || []).map(r => [r.gasWaveActive ? 1 : 0, Math.round((r.gasWaveProgress || 0) * 1000) / 1000]),
          thermiteParts: game.thermiteParts || 0,
          missionNodes: (game.missionNodes || [])
            .filter(n => n.roomIndex === game.currentRoomIndex)
            .map(n => ({
              roomIndex: n.roomIndex,
              kind: n.kind,
              stepOrder: n.stepOrder || 0,
              x: Math.round(n.x * 10) / 10,
              z: Math.round(n.z * 10) / 10,
              done: !!n.done,
              genIndex: n.genIndex || 0,
              coolantIdx: n.coolantIdx || 0
            })),
          roomState: cr ? {
            progress: cr.progress,
            subStage: cr.subStage,
            unlockStage: cr.unlockStage,
            completedStage: cr.completedStage,
            waitingForWaveDefense: cr.waitingForWaveDefense,
            waveZombieQuota: cr.waveZombieQuota,
            waveZombiesSpawned: cr.waveZombiesSpawned,
            sectorTimer: Math.round(cr.sectorTimer),
            berserkActive: cr.berserkActive,
            gasWaveActive: cr.gasWaveActive,
            gasWaveProgress: Math.round((cr.gasWaveProgress || 0) * 1000) / 1000,
            midBossAwakened: !!cr.midBossAwakened,
            bossPhaseStage: cr.bossPhaseStage || 0,
            thermiteDetonated: !!cr.thermiteDetonated
          } : null,
          zombies: zSnap
        }));
      } catch (e) {}
    }, 125);

    // =========================================================================
    // 20. UI EVENT LISTENERS, SETTINGS SYNC & INITIALIZATION
    // =========================================================================
    document.getElementById("btn-start-game").addEventListener("click", () => startNewGameSession());
    document.getElementById("btn-back-to-lobby").addEventListener("click", returnToWaitingRoomLobby);
    document.getElementById("btn-return-lobby-top").addEventListener("click", returnToWaitingRoomLobby);
    document.getElementById("btn-connect-ws").addEventListener("click", connectHamachiServer);

    document.getElementById("btn-open-upgrade").addEventListener("click", toggleUpgradeModal);
    document.getElementById("btn-close-upgrade").addEventListener("click", () => {
      document.getElementById("upgrade-modal").classList.add("hidden");
    });

    // 환경설정(Settings) 모달 열기/닫기 및 실시간 적용
    function openSettingsModal() {
      const lobbyNick = document.getElementById("input-player-name");
      const optNick = document.getElementById("opt-nickname-input");
      if (optNick && lobbyNick) {
        const me = game.players[mySlotIndex];
        optNick.value = me ? me.name : (lobbyNick.value || "HOST_P1");
      }
      document.getElementById("settings-modal").classList.remove("hidden");
    }

    function applyUserSettingsFromModal() {
      userSettings.antiMotionSickness = document.getElementById("opt-anti-motion").value === "1";
      userSettings.cameraSmooth = document.getElementById("opt-cam-smooth").value === "1";
      cameraZoomIndex = parseInt(document.getElementById("opt-cam-zoom").value, 10) || 1;
      userSettings.nicknameMode = document.getElementById("opt-show-nicknames").value || "all";
      userSettings.showWorldBadges = document.getElementById("opt-world-badges").value === "1";
      userSettings.damageVignette = document.getElementById("opt-dmg-vignette").value === "1";
      userSettings.gfxQuality = document.getElementById("opt-gfx-quality").value || "high";

      const volVal = parseInt(document.getElementById("opt-master-volume").value, 10);
      userSettings.masterVolume = (isNaN(volVal) ? 80 : volVal) / 100;
      document.getElementById("opt-vol-label").textContent = `${Math.round(userSettings.masterVolume * 100)}%`;

      SoundFX.muted = document.getElementById("opt-sound-mute").value === "1";
      const sndBtn = document.getElementById("btn-toggle-sound");
      if (sndBtn) sndBtn.innerHTML = (SoundFX.muted ? "🔇" : "🔊") + '<span class="hidden">사운드</span>';

      renderer.shadowMap.enabled = (userSettings.gfxQuality === "high");
      dirLight.castShadow = (userSettings.gfxQuality === "high");

      const newNick = (document.getElementById("opt-nickname-input").value || "HOST_P1").trim();
      const lobbyNick = document.getElementById("input-player-name");
      if (lobbyNick) lobbyNick.value = newNick;
      if (lobbySlots[mySlotIndex]) lobbySlots[mySlotIndex].name = newNick;
      if (game.players[mySlotIndex]) {
        game.players[mySlotIndex].name = newNick;
      }
      renderLobbySlots();
    }

    document.getElementById("btn-open-settings").addEventListener("click", openSettingsModal);
    document.getElementById("btn-lobby-settings").addEventListener("click", openSettingsModal);
    document.getElementById("btn-close-settings").addEventListener("click", () => {
      applyUserSettingsFromModal();
      document.getElementById("settings-modal").classList.add("hidden");
    });
    document.getElementById("btn-save-settings").addEventListener("click", () => {
      applyUserSettingsFromModal();
      document.getElementById("settings-modal").classList.add("hidden");
    });
    [
      "opt-anti-motion", "opt-cam-smooth", "opt-cam-zoom", "opt-show-nicknames",
      "opt-master-volume", "opt-sound-mute", "opt-world-badges", "opt-dmg-vignette", "opt-gfx-quality"
    ].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.addEventListener("input", applyUserSettingsFromModal);
    });
    document.getElementById("opt-nickname-input").addEventListener("input", applyUserSettingsFromModal);
    document.getElementById("input-player-name").addEventListener("input", (e) => {
      const v = (e.target.value || "HOST_P1").trim().slice(0, 12);
      try { localStorage.setItem("boxhead_player_name", v); } catch (err) {}
      if (lobbySlots[mySlotIndex]) lobbySlots[mySlotIndex].name = v;
      const optNick = document.getElementById("opt-nickname-input");
      if (optNick) optNick.value = v;
      if (game.players[mySlotIndex]) game.players[mySlotIndex].name = v;
      if (wsClient && wsClient.readyState === WebSocket.OPEN) {
        try { wsClient.send(JSON.stringify({ type: "UPDATE_NAME", name: v })); } catch (err) {}
      }
      renderLobbySlots();
    });

    const ffSelectEl = document.getElementById("select-friendly-fire");
    if (ffSelectEl) {
      ffSelectEl.addEventListener("change", (e) => {
        try { localStorage.setItem("boxhead_friendly_fire", e.target.value); } catch (err) {}
      });
    }

    const resumeBtn = document.getElementById("btn-resume-session");
    if (resumeBtn) {
      resumeBtn.addEventListener("click", () => {
        try {
          const raw = localStorage.getItem("boxhead_active_session");
          if (raw) {
            const snap = JSON.parse(raw);
            startNewGameSession(snap.seed, false, snap);
          }
        } catch (e) {}
      });
    }

    const discardBtn = document.getElementById("btn-discard-session");
    if (discardBtn) {
      discardBtn.addEventListener("click", () => {
        clearSavedGameSession();
      });
    }

    setInterval(() => {
      if (game.running) saveGameSessionSnapshot();
    }, 3000);

    window.addEventListener("beforeunload", () => {
      if (game.running) saveGameSessionSnapshot();
    });

    function pollLobbyStatus() {
      if (game.running) return;
      fetch("/api/status")
        .then(r => r.json())
        .then(data => {
          if (data && Array.isArray(data.slots)) {
            let changed = false;
            data.slots.forEach((s, i) => {
              if (lobbySlots[i]) {
                if (lobbySlots[i].name !== s.name || lobbySlots[i].role !== s.role) {
                  lobbySlots[i].name = s.name;
                  lobbySlots[i].role = s.role;
                  changed = true;
                }
              }
            });
            if (changed) renderLobbySlots();
          }
        })
        .catch(() => {});
    }
    setInterval(pollLobbyStatus, 2000);

    // Armory-Only Supply Buttons: 전 총기 + 바리케이드 + 폭약통 일괄 보급 (buyAllAmmo)
    const btnBuyAllAmmo = document.getElementById("btn-buy-all-ammo");
    if (btnBuyAllAmmo) {
      btnBuyAllAmmo.addEventListener("click", () => {
        const me = game.players[mySlotIndex];
        if (me) buyAllAmmo(me);
      });
    }
    const btnBuyLight = document.getElementById("btn-buy-light");
    if (btnBuyLight) btnBuyLight.addEventListener("click", () => { const me = game.players[mySlotIndex]; if (me) buyAllAmmo(me); });
    const btnBuyHeavy = document.getElementById("btn-buy-heavy");
    if (btnBuyHeavy) btnBuyHeavy.addEventListener("click", () => { const me = game.players[mySlotIndex]; if (me) buyAllAmmo(me); });
    const btnBuyEnergy = document.getElementById("btn-buy-energy");
    if (btnBuyEnergy) btnBuyEnergy.addEventListener("click", () => { const me = game.players[mySlotIndex]; if (me) buyAllAmmo(me); });
    document.getElementById("btn-buy-medkit").addEventListener("click", () => {
      const me = game.players[mySlotIndex];
      const toastEl = document.getElementById("upg-roll-toast");
      if (!me || !isPlayerNearArmory(me)) {
        if (toastEl) toastEl.textContent = "⛔ 무기고 반경 안에서만 구급키트 구매가 가능합니다!";
        return;
      }
      const maxM = getPlayerMaxMedkits(me);
      const cost = getSectorSupplyCost(110);
      if (me.medkits >= maxM) {
        if (toastEl) toastEl.textContent = `ℹ️ 구급키트 소지 한도(${me.medkits}/${maxM})입니다! [구급상자 파우치 확장]으로 늘릴 수 있습니다.`;
        return;
      }
      if (game.bioPoints >= cost) {
        game.bioPoints -= cost;
        me.medkits++;
        triggerUpgradeHighlight("supply", { supplyKey: "btn-buy-medkit" });
        SoundFX.play("pickup");
        renderUpgradeModal();
      }
    });
    document.getElementById("btn-buy-stim").addEventListener("click", () => {
      const me = game.players[mySlotIndex];
      const toastEl = document.getElementById("upg-roll-toast");
      if (!me || !isPlayerNearArmory(me)) {
        if (toastEl) toastEl.textContent = "⛔ 무기고 반경 안에서만 스팀팩 구매가 가능합니다!";
        return;
      }
      const maxS = getPlayerMaxStims(me);
      const cost = getSectorSupplyCost(90);
      if (me.stims >= maxS) {
        if (toastEl) toastEl.textContent = `ℹ️ 스팀팩 소지 한도(${me.stims}/${maxS})입니다! [스팀팩 전술 벨트 확장]으로 늘릴 수 있습니다.`;
        return;
      }
      if (game.bioPoints >= cost) {
        game.bioPoints -= cost;
        me.stims++;
        triggerUpgradeHighlight("supply", { supplyKey: "btn-buy-stim" });
        SoundFX.play("pickup");
        renderUpgradeModal();
      }
    });
    const btnCraftPart = document.getElementById("btn-craft-part");
    if (btnCraftPart) {
      btnCraftPart.addEventListener("click", () => {
        const me = game.players[mySlotIndex];
        if (me) craftWeaponPart(me);
      });
    }
    const btnScrapPart = document.getElementById("btn-scrap-part");
    if (btnScrapPart) {
      btnScrapPart.addEventListener("click", () => {
        const me = game.players[mySlotIndex];
        if (me) scrapWeaponPartForBp(me);
      });
    }
    document.getElementById("btn-buy-core").addEventListener("click", () => {
      const me = game.players[mySlotIndex];
      if (me) buyShopCoreSample(me);
    });
    document.getElementById("btn-sell-core").addEventListener("click", () => {
      const me = game.players[mySlotIndex];
      if (me) sellCoreSampleForBp(me);
    });

        // HUD Quick Medical & Mobility Buttons
    document.getElementById("btn-use-medkit").addEventListener("click", () => {
      const me = game.players[mySlotIndex];
      if (me) startSelfBandaging(me);
    });
    document.getElementById("btn-use-stim").addEventListener("click", () => {
      const me = game.players[mySlotIndex];
      if (me) useAdrenalineStim(me);
    });
    document.getElementById("btn-dash").addEventListener("click", () => {
      const me = game.players[mySlotIndex];
      if (me) triggerTacticalDash(me);
    });
    const btnBash = document.getElementById("btn-bash");
    if (btnBash) {
      btnBash.addEventListener("click", () => {
        const me = game.players[mySlotIndex];
        if (me) triggerMeleeBash(me);
      });
    }

    document.getElementById("btn-open-hamachi-guide").addEventListener("click", () => {
      document.getElementById("hamachi-modal").classList.remove("hidden");
    });
    document.getElementById("btn-close-hamachi-guide").addEventListener("click", () => {
      document.getElementById("hamachi-modal").classList.add("hidden");
    });

    document.getElementById("btn-toggle-sound").addEventListener("click", (e) => {
      SoundFX.muted = !SoundFX.muted;
      e.currentTarget.innerHTML = (SoundFX.muted ? "🔇" : "🔊") + '<span class="hidden">사운드</span>';
    });
    document.getElementById("btn-cam-zoom").addEventListener("click", () => {
      cameraZoomIndex = (cameraZoomIndex + 1) % CAMERA_OFFSETS.length;
    });
    document.getElementById("btn-toggle-touch").addEventListener("click", () => {
      document.getElementById("touch-controls-bar").classList.toggle("hidden");
    });

    document.querySelectorAll("[data-touch-move]").forEach(btn => {
      const k = btn.getAttribute("data-touch-move");
      btn.addEventListener("pointerdown", () => { touchMove[k] = true; });
      btn.addEventListener("pointerup", () => { touchMove[k] = false; });
      btn.addEventListener("pointerleave", () => { touchMove[k] = false; });
    });

    window.touchSprintShift = false;
    document.querySelectorAll("[data-touch-action]").forEach(btn => {
      const act = btn.getAttribute("data-touch-action");
      btn.addEventListener("pointerdown", () => {
        const me = game.players[mySlotIndex];
        if (act === "f") touchInteractF = true;
        else if (act === "shift") window.touchSprintShift = true;
        else if (act === "q" && me) startSelfBandaging(me);
        else if (act === "e" && me) useAdrenalineStim(me);
        else if (act === "space" && me) triggerTacticalDash(me);
      });
      btn.addEventListener("pointerup", () => {
        if (act === "f") touchInteractF = false;
        if (act === "shift") window.touchSprintShift = false;
      });
      btn.addEventListener("pointerleave", () => {
        if (act === "f") touchInteractF = false;
        if (act === "shift") window.touchSprintShift = false;
      });
    });

    const aimMap = {
      u: ["u"], d: ["d"], l: ["l"], r: ["r"],
      ul: ["u", "l"], ur: ["u", "r"], dl: ["d", "l"], dr: ["d", "r"]
    };
    document.querySelectorAll("[data-touch-aim]").forEach(btn => {
      const code = btn.getAttribute("data-touch-aim");
      const dirs = aimMap[code] || [];
      btn.addEventListener("pointerdown", () => { dirs.forEach(d => touchAim[d] = true); });
      btn.addEventListener("pointerup", () => { dirs.forEach(d => touchAim[d] = false); });
      btn.addEventListener("pointerleave", () => { dirs.forEach(d => touchAim[d] = false); });
    });

    function animate(now) {
      requestAnimationFrame(animate);
      const dt = Math.min(0.05, (now - lastFrameTime) / 1000);
      lastFrameTime = now;
      if (game.running) updateSimulation(dt);
      renderer.render(scene, camera);
    }

    let initializedAutoConnect = false;
    function initProfileAndAutoConnect() {
      if (initializedAutoConnect) return;
      initializedAutoConnect = true;

      // 1. Nickname restore
      let savedNick = null;
      try { savedNick = localStorage.getItem("boxhead_player_name"); } catch (e) {}
      const isHost = (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1");
      const defaultNick = isHost ? "HOST_P1" : ("PLAYER_" + Math.floor(100 + Math.random() * 900));
      const nick = savedNick || defaultNick;
      const nickInput = document.getElementById("input-player-name");
      if (nickInput) nickInput.value = nick;
      const optNick = document.getElementById("opt-nickname-input");
      if (optNick) optNick.value = nick;
      if (lobbySlots[mySlotIndex]) lobbySlots[mySlotIndex].name = nick;

      // 2. Friendly Fire restore
      let savedFF = null;
      try { savedFF = localStorage.getItem("boxhead_friendly_fire"); } catch (e) {}
      const ffSelect = document.getElementById("select-friendly-fire");
      if (savedFF !== null && ffSelect) {
        ffSelect.value = savedFF;
      }

      // 3. Server URL auto-configure & Auto-Connect
      const wsInput = document.getElementById("input-server-url");
      if (wsInput && window.location && window.location.host && window.location.protocol.startsWith("http")) {
        const wsProto = window.location.protocol === "https:" ? "wss://" : "ws://";
        wsInput.value = wsProto + window.location.host;
      }

      // 4. Clean up any legacy resume banner and connect WebSocket automatically
      const banner = document.getElementById("resume-banner");
      if (banner) banner.classList.add("hidden");
      connectHamachiServer();
    }

    window.onload = () => {
      initProfileAndAutoConnect();
      renderLobbySlots();
      const refreshSnap = getActiveRefreshSnapshot();
      if (refreshSnap) {
        // 게임 도중 새로고침(F5)한 경우 로비로 튕기지 않고 진행 중이던 인게임 화면을 즉시 그대로 유지!
        startNewGameSession(refreshSnap.seed, true, refreshSnap);
      } else {
        generateProceduralDungeon(2026);
        camera.position.set(0, 44, 34);
        camera.lookAt(0, 0, 0);
      }
      lastFrameTime = performance.now();
      requestAnimationFrame(animate);
    };

    window.addEventListener("DOMContentLoaded", () => {
      initProfileAndAutoConnect();
    });
