/**
 * =========================================================================
 * BOXHEAD: THE CORE v3.6 — Frontend Module: 08a_session_and_net_client.js
 * Session Save/Restore, Game Start/Finish & WebSocket Client Event Handlers
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


    function handleNetworkMissionAction(msg) {
              const r = game.rooms[msg.roomIdx];
              if (r) {
                if (msg.action === "ADVANCE_STAGE") {
                  r.completedStage = Math.max(r.completedStage || 0, msg.completedStep || 0);
                  r.waitingForWaveDefense = true;
                  if (game.wavePhase === "CALM" && game.waveTimer > 4.0) {
                    game.waveTimer = 4.0;
                  }
                } else if (msg.action === "LOCK_BULKHEAD") {
                  if (r && !r.lockedBehind) {
                    closeAndLockBulkheadDoor(r);
                  }
                } else if (msg.action === "RESTORE_POWER") {
                  if (r) {
                    r.envCleared = true;
                    if (msg.envType === "TOXIC_FOG") {
                      const node = game.missionNodes.find(n => n.roomIndex === msg.roomIdx && n.kind === "ENV_CONTROL");
                      if (node) {
                        node.done = true;
                        if (node.mesh) entitiesGroup.remove(node.mesh);
                      }
                    } else {
                      r.blackoutRestoredTimer = 60.0;
                    }
                    SoundFX.play("upgrade");
                    const safeBanner = document.getElementById("hud-safe-banner");
                    if (safeBanner) {
                      document.getElementById("hud-safe-banner-text").textContent =
                        msg.envType === "TOXIC_FOG" ? "☣️ 환기밸브 개방! 독안개 정화" : "💡 비상 조명 배전반 복구! 60초간 정상 조명 유지";
                      safeBanner.classList.remove("hidden");
                      setTimeout(() => safeBanner.classList.add("hidden"), 4000);
                    }
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
                    if (podNode.collider) game.obstacles = game.obstacles.filter(ob => ob !== podNode.collider);
                  }
                  game.obstacles = game.obstacles.filter(ob => Math.hypot(ob.x - r.wx, ob.z - r.wz) > 5.5);
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
                      `✅ 오염 밸브 #${msg.stepOrder} 차단 완료 (+500 BP)! 다음 웨이브를 방어하면 밸브 #${(msg.stepOrder || 1) + 1}이 개방됩니다!`
                    );
                  }
                  checkRoomClear(r);
                }
              }
    }

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
                if (msg.specialization && p.specialization !== msg.specialization) {
                  p.specialization = msg.specialization;
                }
                if (msg.tempShield !== undefined) p.tempShield = msg.tempShield;
                if (msg.carryingPayload !== undefined) p.carryingPayload = !!msg.carryingPayload;
                if (p.drone) {
                  if (msg.droneUnlocked !== undefined) {
                    p.drone.unlocked = !!msg.droneUnlocked;
                    if (p.visual && p.visual.droneGroup) {
                      p.visual.droneGroup.visible = !!msg.droneUnlocked;
                    }
                  }
                  if (p.drone.modules) {
                    if (msg.droneMagnetLv !== undefined) p.drone.modules.magnet.level = msg.droneMagnetLv;
                    if (msg.droneIntLv !== undefined) p.drone.modules.interceptor.level = msg.droneIntLv;
                    if (msg.droneMediLv !== undefined) p.drone.modules.medi.level = msg.droneMediLv;
                  }
                }
              }
            } else if (msg.type === "SPEC_CHOSEN" && game.running) {
              const p = game.players.find(pl => pl.id === msg.playerId);
              if (p) {
                p.specialization = msg.specialization;
                if (msg.specialization === "JUGGERNAUT") {
                  p.maxHp += 35;
                  p.hp = Math.min(p.maxHp, p.hp + 35);
                  p.canPassThroughZombies = true;
                } else if (msg.specialization === "MEDIC") {
                  game.reviveDuration = 3.5;
                }
              }
            } else if (msg.type === "SPEC_ACTIVE" && game.running) {
              const p = game.players.find(pl => pl.id === msg.playerId);
              if (p && p.id !== mySlotIndex) {
                if (msg.x !== undefined) p.x = msg.x;
                if (msg.z !== undefined) p.z = msg.z;
                triggerSpecializationActive(p);
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
              handleNetworkMissionAction(msg);
            } else if (msg.type === "SECTOR_LOCK_TELEPORT" && game.running) {
              const me = game.players[mySlotIndex];
              const targetR = game.rooms[msg.roomIdx];
              if (me && targetR && (Math.abs(me.x - targetR.wx) >= (targetR.hw || targetR.half) || Math.abs(me.z - targetR.wz) >= (targetR.hd || targetR.half))) {
                me.x = msg.destX + (mySlotIndex - 1.5) * 1.5;
                me.z = msg.destZ + 1.2;
                if (me.visual && me.visual.group) me.visual.group.position.set(me.x, 0, me.z);
              }
            } else if (msg.type === "WORLD_SNAPSHOT" && game.running && isRemoteClient) {
              applyAuthoritativeWorldSnapshot(msg);
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
