/**
 * =========================================================================
 * BOXHEAD: THE CORE v3.6 — Frontend Module: 08c_main_bootstrap.js
 * DOM UI Event Listeners, User Settings Modal, Touch Controls & Main Loop Bootstrap
 * Zero-Loss Refactored Architecture (Shared Global Lexical Scope)
 * =========================================================================
 */
"use strict";

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
      const hasSupplyDrone = me && me.drone && me.drone.unlocked && me.drone.modules && me.drone.modules.supply && (me.drone.modules.supply.level || 0) >= 1;
      if (!me || (!isPlayerNearArmory(me) && !hasSupplyDrone)) {
        if (toastEl) toastEl.textContent = "⛔ 무기고 반경 안이거나 [📦원격보급드론]이 있어야 구급키트 구매가 가능합니다!";
        return;
      }
      const maxM = getPlayerMaxMedkits(me);
      const cost = getSectorSupplyCost(160);
      if (me.medkits >= maxM) {
        if (toastEl) toastEl.textContent = `ℹ️ 구급키트 소지 한도(${me.medkits}/${maxM})입니다! [구급상자 파우치 확장]으로 늘릴 수 있습니다.`;
        return;
      }
      if (game.bioPoints >= cost) {
        game.bioPoints -= cost;
        me.medkits++;
        triggerUpgradeHighlight("supply", { supplyKey: "btn-buy-medkit" });
        SoundFX.play("pickup");
        if (hasSupplyDrone && !isPlayerNearArmory(me) && toastEl) {
          toastEl.textContent = `🛸 [드론 원격 보급] 구급키트가 공중 투하되었습니다! (-${cost.toLocaleString()} BP)`;
        }
        renderUpgradeModal();
      }
    });
    document.getElementById("btn-buy-stim").addEventListener("click", () => {
      const me = game.players[mySlotIndex];
      const toastEl = document.getElementById("upg-roll-toast");
      const hasSupplyDrone = me && me.drone && me.drone.unlocked && me.drone.modules && me.drone.modules.supply && (me.drone.modules.supply.level || 0) >= 1;
      if (!me || (!isPlayerNearArmory(me) && !hasSupplyDrone)) {
        if (toastEl) toastEl.textContent = "⛔ 무기고 반경 안이거나 [📦원격보급드론]이 있어야 스팀팩 구매가 가능합니다!";
        return;
      }
      const maxS = getPlayerMaxStims(me);
      const cost = getSectorSupplyCost(140);
      if (me.stims >= maxS) {
        if (toastEl) toastEl.textContent = `ℹ️ 스팀팩 소지 한도(${me.stims}/${maxS})입니다! [스팀팩 전술 벨트 확장]으로 늘릴 수 있습니다.`;
        return;
      }
      if (game.bioPoints >= cost) {
        game.bioPoints -= cost;
        me.stims++;
        triggerUpgradeHighlight("supply", { supplyKey: "btn-buy-stim" });
        SoundFX.play("pickup");
        if (hasSupplyDrone && !isPlayerNearArmory(me) && toastEl) {
          toastEl.textContent = `🛸 [드론 원격 보급] 스팀팩이 공중 투하되었습니다! (-${cost.toLocaleString()} BP)`;
        }
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
      if (game.running) {
        try {
          updateSimulation(dt);
        } catch (simErr) {
          console.error("Simulation error in frame:", simErr);
        }
      }
      try {
        renderer.render(scene, camera);
      } catch (rendErr) {
        console.error("Render error in frame:", rendErr);
      }
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
