/**
 * =========================================================================
 * BOXHEAD: THE CORE v3.1 — Frontend Module: 08_network_and_main.js
 * Zero-Loss Refactored Architecture (Shared Global Lexical Scope)
 * =========================================================================
 */
"use strict";

    // =========================================================================
    // 19. SESSION START, END & HAMACHI WEBSOCKET CLIENT
    // =========================================================================
    function startNewGameSession(customSeed, fromRemotePacket) {
      SoundFX.init();
      const nickInput = document.getElementById("input-player-name");
      const optNickInput = document.getElementById("opt-nickname-input");
      const chosenNick = ((nickInput && nickInput.value) || (optNickInput && optNickInput.value) || "HOST_P1").trim();
      if (lobbySlots[mySlotIndex]) lobbySlots[mySlotIndex].name = chosenNick;
      if (optNickInput) optNickInput.value = chosenNick;

      game.pacing = document.getElementById("select-pacing").value;
      game.totalRooms = parseInt(document.getElementById("select-room-count").value, 10) || 10;
      game.collapseChance = parseFloat(document.getElementById("select-collapse-chance").value);
      game.friendlyFire = document.getElementById("select-friendly-fire").value === "1";
      game.reviveDuration = parseFloat(document.getElementById("select-revive-time").value) || 8.0;

      game.seed = customSeed || Math.floor(1000 + Math.random() * 9000);
      game.elapsedTime = 0;
      game.currentRoomIndex = 0;
      game.bioPoints = 110;
      game.weaponParts = 0;
      game.partsCrafted = 0;
      game.coreSamples = 0;
      game.shopCoresBought = 0;
      game.coresSoldCount = 0;
      game.thermiteParts = 0;
      game.totalKills = 0;
      // 첫 진입 후 14초 정비 뒤 곧바로 1차 웨이브(SURGE)가 시작되어 이를 막으면 1단계 목표가 해금됨!
      game.wavePhase = 'CALM';
      game.waveTimer = 14.0;
      game.waveNumber = 1;
      game.comboCount = 0;
      game.totalRevives = 0;
      game.totalFriendlyFireDmg = 0;
      camInitialized = false;

      document.getElementById("hud-seed-label").textContent = "#" + game.seed;
      document.getElementById("hud-ff-badge").textContent = game.friendlyFire ? "ON" : "OFF";

      generateProceduralDungeon(game.seed);
      spawnSquadPlayers();
      if (game.rooms[0]) relocateArmoryForCalmPhase(game.rooms[0]);
      updateRoomVisibility();
      updateWeaponSlotsHUD();

      document.getElementById("lobby-screen").classList.add("hidden");
      document.getElementById("result-modal").classList.add("hidden");
      document.getElementById("upgrade-modal").classList.add("hidden");
      document.getElementById("ingame-hud").classList.remove("hidden");
      document.getElementById("damage-vignette").style.opacity = "0";

      game.running = true;

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
      document.getElementById("result-modal").classList.add("hidden");
      document.getElementById("upgrade-modal").classList.add("hidden");
      document.getElementById("settings-modal").classList.add("hidden");
      document.getElementById("ingame-hud").classList.add("hidden");
      document.getElementById("lobby-screen").classList.remove("hidden");
      document.getElementById("damage-vignette").style.opacity = "0";
      renderLobbySlots();
    }

    function connectHamachiServer() {
      const url = document.getElementById("input-server-url").value.trim();
      const statusEl = document.getElementById("lobby-conn-status");
      if (!url) return;
      statusEl.textContent = "⏳ 서버 연결 시도 중...";
      try {
        if (wsClient) wsClient.close();
        wsClient = new WebSocket(url);
        wsClient.onopen = () => {
          statusEl.textContent = "🟢 하마치 WebSocket 서버 연결됨!";
          document.getElementById("hud-net-mode").textContent = "HAMACHI WS";
          wsClient.send(JSON.stringify({
            type: "JOIN_LOBBY",
            name: document.getElementById("input-player-name").value.trim() || "PLAYER"
          }));
        };
        wsClient.onmessage = (ev) => {
          try {
            const msg = JSON.parse(ev.data);
            if (msg.type === "ROOM_FULL") {
              statusEl.textContent = "⛔ 방 정원 초과 (4/4 MAN FULL) — 대기실이 가득 차 입장할 수 없습니다!";
              statusEl.className = "text-[11px] font-mono-code font-bold text-red-400";
              wsClient.close();
              return;
            } else if (msg.type === "KICKED") {
              statusEl.textContent = "🚫 방장에 의해 대기실에서 강퇴되었습니다.";
              statusEl.className = "text-[11px] font-mono-code font-bold text-red-400";
              if (game.running) returnToWaitingRoomLobby();
              wsClient.close();
              return;
            } else if (msg.type === "LOBBY_STATE" && Array.isArray(msg.slots)) {
              msg.slots.forEach((s, i) => {
                if (lobbySlots[i]) { lobbySlots[i].name = s.name; lobbySlots[i].role = s.role; }
              });
              renderLobbySlots();
            } else if (msg.type === "START_GAME") {
              if (Array.isArray(msg.slots)) {
                msg.slots.forEach((s, i) => {
                  if (lobbySlots[i]) { lobbySlots[i].name = s.name; lobbySlots[i].role = s.role; }
                });
              }
              if (msg.pacing) document.getElementById("select-pacing").value = msg.pacing;
              if (msg.totalRooms) document.getElementById("select-room-count").value = String(msg.totalRooms);
              if (msg.friendlyFire !== undefined) document.getElementById("select-friendly-fire").value = msg.friendlyFire ? "1" : "0";
              if (msg.reviveDuration) document.getElementById("select-revive-time").value = String(msg.reviveDuration);
              startNewGameSession(msg.seed, true);
            } else if (msg.type === "REVIVE_SYNC" && game.running) {
              const targetP = game.players.find(pl => pl.id === msg.targetId);
              if (targetP && targetP.downed) completeRevive(targetP);
            } else if (msg.type === "ASSIGN_SLOT" && typeof msg.slotId === "number") {
              mySlotIndex = msg.slotId;
              isRemoteClient = (msg.slotId !== 0);
              const netBadge = document.getElementById("hud-net-mode");
              if (netBadge) netBadge.textContent = isRemoteClient ? `CLIENT P${msg.slotId + 1}` : "HOST P1";
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
            } else if (msg.type === "WORLD_SNAPSHOT" && game.running && isRemoteClient) {
              // 호스트(P1) 권위 월드·좀비·웨이브·미션 스냅샷 동기화 -> 4인 화면의 좀비/보스/웨이브 오차 0%!
              game.wavePhase = msg.wavePhase || game.wavePhase;
              game.waveTimer = msg.waveTimer !== undefined ? msg.waveTimer : game.waveTimer;
              if (msg.roomIdx !== undefined && msg.roomIdx !== game.currentRoomIndex) {
                game.currentRoomIndex = msg.roomIdx;
                if (game.rooms[msg.roomIdx]) game.rooms[msg.roomIdx].unlocked = true;
                updateRoomVisibility();
              }
              const cr = game.rooms[game.currentRoomIndex];
              if (cr && msg.roomState) {
                cr.progress = msg.roomState.progress;
                cr.unlockStage = msg.roomState.unlockStage;
                cr.completedStage = msg.roomState.completedStage;
                cr.waitingForWaveDefense = msg.roomState.waitingForWaveDefense;
                cr.sectorTimer = msg.roomState.sectorTimer;
                cr.berserkActive = msg.roomState.berserkActive;
                cr.gasWaveActive = msg.roomState.gasWaveActive;
                cr.gasWaveProgress = msg.roomState.gasWaveProgress;
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
          roomState: cr ? {
            progress: cr.progress,
            unlockStage: cr.unlockStage,
            completedStage: cr.completedStage,
            waitingForWaveDefense: cr.waitingForWaveDefense,
            sectorTimer: Math.round(cr.sectorTimer),
            berserkActive: cr.berserkActive,
            gasWaveActive: cr.gasWaveActive,
            gasWaveProgress: Math.round((cr.gasWaveProgress || 0) * 1000) / 1000
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
      const v = (e.target.value || "HOST_P1").trim();
      if (lobbySlots[mySlotIndex]) lobbySlots[mySlotIndex].name = v;
      const optNick = document.getElementById("opt-nickname-input");
      if (optNick) optNick.value = v;
      if (game.players[mySlotIndex]) game.players[mySlotIndex].name = v;
      renderLobbySlots();
    });

    // Armory-Only Supply & Per-Weapon Ammo Buttons (Fixed Non-Inflating Prices!)
    document.getElementById("btn-buy-light").addEventListener("click", () => {
      const me = game.players[mySlotIndex];
      if (!me) return;
      const wIdx = me.currentWeapon === 0 ? 1 : me.currentWeapon;
      buyWeaponAmmo(me, wIdx);
    });
    document.getElementById("btn-buy-heavy").addEventListener("click", () => {
      const me = game.players[mySlotIndex];
      const toastEl = document.getElementById("upg-roll-toast");
      if (!me || !isPlayerNearArmory(me)) {
        if (toastEl) toastEl.textContent = "⛔ 무기고 반경 안에서만 탄약 보충이 가능합니다!";
        return;
      }
      const cost = getSectorSupplyCost(220);
      if (game.bioPoints >= cost) {
        game.bioPoints -= cost;
        for (let i = 1; i <= 5; i++) {
          if (me.inventory[i].unlocked) {
            const maxA = getWeaponMaxAmmo(me, i);
            me.inventory[i].ammo = Math.min(maxA, me.inventory[i].ammo + WEAPONS[i].packAmmo);
          }
        }
        SoundFX.play("pickup");
        if (toastEl) toastEl.textContent = `🔫 해금된 모든 총기에 전용 탄약 +1팩 일괄 보충 완료! (-${cost.toLocaleString()} BP)`;
        renderUpgradeModal();
        updateWeaponSlotsHUD();
      }
    });
    document.getElementById("btn-buy-energy").addEventListener("click", () => {
      const me = game.players[mySlotIndex];
      const toastEl = document.getElementById("upg-roll-toast");
      if (!me || !isPlayerNearArmory(me)) {
        if (toastEl) toastEl.textContent = "⛔ 무기고 반경 안에서만 바리케이드·폭약통 보충이 가능합니다!";
        return;
      }
      const cost = getSectorSupplyCost(120);
      if (game.bioPoints >= cost) {
        game.bioPoints -= cost;
        me.inventory[6].ammo = Math.min(getWeaponMaxAmmo(me, 6), me.inventory[6].ammo + 5);
        me.inventory[7].ammo = Math.min(getWeaponMaxAmmo(me, 7), me.inventory[7].ammo + 4);
        SoundFX.play("pickup");
        if (toastEl) toastEl.textContent = `🧱 전술 바리케이드(+5) & 적색 폭약통(+4) 보충 완료! (-${cost.toLocaleString()} BP)`;
        renderUpgradeModal();
        updateWeaponSlotsHUD();
      }
    });
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
        else if ((act === "q" || act === "h") && me) startSelfBandaging(me);
        else if ((act === "e" || act === "g") && me) useAdrenalineStim(me);
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

    window.onload = () => {
      renderLobbySlots();
      generateProceduralDungeon(2026);
      camera.position.set(0, 44, 34);
      camera.lookAt(0, 0, 0);
      lastFrameTime = performance.now();
      requestAnimationFrame(animate);
    };


    // 로컬 서버(http://[방장_하마치IP]:3000)로 접속 시 자동으로 WebSocket 주소를 해당 호스트 IP로 설정
    window.addEventListener("DOMContentLoaded", () => {
      const wsInput = document.getElementById("input-server-url");
      if (wsInput && window.location && window.location.host && window.location.protocol.startsWith("http")) {
        const wsProto = window.location.protocol === "https:" ? "wss://" : "ws://";
        wsInput.value = wsProto + window.location.host;
      }
    });
