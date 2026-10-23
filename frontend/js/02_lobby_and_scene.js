/**
 * =========================================================================
 * BOXHEAD: THE CORE v3.1 — Frontend Module: 02_lobby_and_scene.js
 * Zero-Loss Refactored Architecture (Shared Global Lexical Scope)
 * =========================================================================
 */
"use strict";

    // =========================================================================
    // 3. LOBBY & MULTIPLAYER STATE
    // =========================================================================
    const SQUAD_COLORS = [0x3b82f6, 0x10b981, 0xf59e0b, 0xec4899];
    const lobbySlots = [
      { id: 0, name: "HOST_P1", role: "LOCAL", ready: true, color: SQUAD_COLORS[0] },
      { id: 1, name: "ALPHA_AI", role: "AI", ready: true, color: SQUAD_COLORS[1] },
      { id: 2, name: "BRAVO_AI", role: "AI", ready: true, color: SQUAD_COLORS[2] },
      { id: 3, name: "CHARLIE_AI", role: "AI", ready: true, color: SQUAD_COLORS[3] }
    ];

    let wsClient = null;
    let isRemoteClient = false;
    let mySlotIndex = 0;

    function kickLobbySlot(idx) {
      if (idx <= 0 || idx >= lobbySlots.length) return;
      const kickedName = lobbySlots[idx].name;
      lobbySlots[idx].role = "EMPTY";
      lobbySlots[idx].name = "EMPTY_" + (idx + 1);
      if (wsClient && wsClient.readyState === WebSocket.OPEN) {
        wsClient.send(JSON.stringify({ type: "KICK_PLAYER", slotId: idx }));
      }
      const statusEl = document.getElementById("lobby-conn-status");
      if (statusEl) statusEl.textContent = `🚫 방장이 [${kickedName}] (P${idx + 1}) 인원을 강퇴했습니다.`;
      renderLobbySlots();
    }

    function renderLobbySlots() {
      const container = document.getElementById("lobby-slots-grid");
      if (!container) return;
      container.innerHTML = "";

      lobbySlots.forEach((slot, idx) => {
        const card = document.createElement("div");
        card.className = "rounded-xl px-3 py-2 bg-slate-950 border border-slate-800 flex items-center justify-between gap-2 h-[60px] overflow-hidden";
        const hexColor = "#" + slot.color.toString(16).padStart(6, "0");

        let roleBadge = "";
        if (idx === 0) {
          roleBadge = `
            <div class="flex items-center gap-1.5 shrink-0">
              <span class="h-7 px-2.5 rounded-lg text-[10px] font-black bg-amber-500 text-slate-950 flex items-center justify-center whitespace-nowrap shadow-sm">👑 방장${mySlotIndex === 0 ? " (나)" : ""}</span>
              <div class="w-7 h-7 shrink-0"></div>
            </div>
          `;
        } else if (idx === mySlotIndex) {
          roleBadge = `
            <div class="flex items-center gap-1.5 shrink-0">
              <span class="h-7 px-2.5 rounded-lg text-[10px] font-black bg-sky-500 text-slate-950 flex items-center justify-center whitespace-nowrap shadow-sm">👤 나 (P${idx + 1})</span>
              <div class="w-7 h-7 shrink-0"></div>
            </div>
          `;
        } else {
          const kickBtn = (slot.role !== "EMPTY" && !isRemoteClient && mySlotIndex === 0)
            ? `<button type="button" data-kick-slot="${idx}" title="방장 권한 추방" class="w-7 h-7 rounded-lg bg-red-950/80 hover:bg-red-800 border border-red-500/40 text-[11px] font-black text-red-200 flex items-center justify-center transition shrink-0">🚫</button>`
            : `<div class="w-7 h-7 shrink-0"></div>`;

          const canToggle = !isRemoteClient && mySlotIndex === 0 && slot.role !== "REMOTE";
          const toggleAttr = canToggle ? `data-toggle-slot="${idx}"` : "";
          const cursorClass = canToggle ? "cursor-pointer hover:opacity-90" : "cursor-default";

          roleBadge = `
            <div class="flex items-center gap-1.5 shrink-0">
              <button type="button" ${toggleAttr}
                      class="h-7 w-[76px] rounded-lg text-[10px] font-bold transition flex items-center justify-center whitespace-nowrap ${cursorClass} ${
                        slot.role === "AI"
                          ? "bg-emerald-600/25 text-emerald-300 border border-emerald-500/40"
                          : slot.role === "REMOTE"
                          ? "bg-sky-600/25 text-sky-300 border border-sky-500/40"
                          : "bg-slate-800/80 text-slate-400 border border-slate-700/60"
                      }">
                ${slot.role === "AI" ? "🤖 AI 봇" : slot.role === "REMOTE" ? "🌐 원격참가" : "➕ 비어있음"}
              </button>
              ${kickBtn}
            </div>
          `;
        }

        const roleDesc = slot.role === "LOCAL"
          ? "직접 조작 (호스트)"
          : slot.role === "AI"
          ? "AI 분대원 (지원)"
          : slot.role === "REMOTE"
          ? "원격 참가자"
          : "슬롯 비어있음";

        card.innerHTML = `
          <div class="flex items-center gap-2 min-w-0 flex-1">
            <div class="w-8 h-8 rounded-lg flex items-center justify-center font-black text-xs text-white shrink-0 shadow"
                 style="background:${hexColor}">P${idx + 1}</div>
            <div class="min-w-0 flex-1 overflow-hidden">
              <div class="text-xs font-black text-white truncate leading-tight">${slot.name}</div>
              <div class="text-[10px] text-slate-400 truncate leading-tight mt-0.5">${roleDesc}</div>
            </div>
          </div>
          ${roleBadge}
        `;
        container.appendChild(card);
      });

      container.querySelectorAll("[data-toggle-slot]").forEach(btn => {
        btn.addEventListener("click", () => {
          if (isRemoteClient) return;
          const idx = parseInt(btn.getAttribute("data-toggle-slot"), 10);
          if (lobbySlots[idx].role === "REMOTE") return;
          lobbySlots[idx].role = lobbySlots[idx].role === "AI" ? "EMPTY" : "AI";
          if (lobbySlots[idx].role === "AI") {
            const aiNames = ["HOST_P1", "ALPHA_AI", "BRAVO_AI", "CHARLIE_AI"];
            lobbySlots[idx].name = aiNames[idx];
          } else {
            lobbySlots[idx].name = "EMPTY_" + (idx + 1);
          }
          if (wsClient && wsClient.readyState === WebSocket.OPEN) {
            try { wsClient.send(JSON.stringify({ type: "TOGGLE_SLOT_ROLE", slotId: idx })); } catch (e) {}
          }
          renderLobbySlots();
        });
      });

      container.querySelectorAll("[data-kick-slot]").forEach(btn => {
        btn.addEventListener("click", () => {
          const idx = parseInt(btn.getAttribute("data-kick-slot"), 10);
          kickLobbySlot(idx);
        });
      });

      const startBtn = document.getElementById("btn-start-game");
      if (startBtn) {
        if (isRemoteClient) {
          startBtn.disabled = true;
          startBtn.className = "w-full py-3.5 rounded-2xl bg-slate-800 text-slate-400 font-bold text-sm tracking-wide shadow transition cursor-not-allowed border border-slate-700";
          startBtn.innerHTML = "⏳ 방장이 작전을 시작하기를 대기하는 중...";
        } else {
          startBtn.disabled = false;
          startBtn.className = "w-full py-3.5 rounded-2xl bg-gradient-to-r from-red-600 via-amber-500 to-red-600 hover:from-red-500 hover:to-amber-400 text-white font-black text-base tracking-wide shadow-xl transition cursor-pointer";
          startBtn.innerHTML = "🚀 작전 시작 (START EXPEDITION)";
        }
      }
    }
    // =========================================================================
    // 4. THREE.JS SCENE, CAMERA & SHARED GEOMETRY POOL
    // =========================================================================
    const container = document.getElementById("game-canvas-container");
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x07090e);
    scene.fog = new THREE.FogExp2(0x07090e, 0.0052);

    const camera = new THREE.PerspectiveCamera(42, window.innerWidth / window.innerHeight, 0.5, 290);
    let cameraZoomIndex = 1;
    const CAMERA_OFFSETS = [
      new THREE.Vector3(0, 36, 28),
      new THREE.Vector3(0, 50, 38),
      new THREE.Vector3(0, 66, 50)
    ];

    const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(renderer.domElement);

    const ambientLight = new THREE.AmbientLight(0x94a3b8, 0.72);
    scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xfffbeb, 0.95);
    dirLight.position.set(30, 58, 32);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.width = 1024;
    dirLight.shadow.mapSize.height = 1024;
    const dLightRange = 65;
    dirLight.shadow.camera.left = -dLightRange;
    dirLight.shadow.camera.right = dLightRange;
    dirLight.shadow.camera.top = dLightRange;
    dirLight.shadow.camera.bottom = -dLightRange;
    scene.add(dirLight);

    const worldGroup = new THREE.Group();
    const entitiesGroup = new THREE.Group();
    const effectsGroup = new THREE.Group();
    scene.add(worldGroup, entitiesGroup, effectsGroup);

    // Shared Geometries for 60FPS Swarm Performance
    const SHARED_GEO = {
      zBody: new THREE.BoxGeometry(0.86, 1.0, 0.52),
      zHead: new THREE.BoxGeometry(0.82, 0.82, 0.82),
      zArm: new THREE.BoxGeometry(0.24, 0.24, 0.78),
      bloodParticle: new THREE.BoxGeometry(0.2, 0.2, 0.2),
      pistolTracer: new THREE.CylinderGeometry(0.08, 0.08, 0.95, 6),
      shotgunPellet: new THREE.DodecahedronGeometry(0.16, 0),
      uziNeedle: new THREE.BoxGeometry(0.10, 0.10, 0.85),
      rifleSlug: new THREE.ConeGeometry(0.15, 0.95, 6),
      grenadeShell: new THREE.CylinderGeometry(0.22, 0.22, 0.55, 8)
    };
    SHARED_GEO.pistolTracer.rotateX(Math.PI / 2);
    SHARED_GEO.rifleSlug.rotateX(Math.PI / 2);
    SHARED_GEO.grenadeShell.rotateZ(Math.PI / 2);

    window.addEventListener("resize", () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    });

    // =========================================================================
    // 5. CORE GAME STATE (v2.0 Massive Expansion)
    // =========================================================================
    const game = {
      running: false,
      seed: 2026,
      elapsedTime: 0,
      pacing: "marathon",
      totalRooms: 10,
      collapseChance: 0.5,
      friendlyFire: true,
      reviveDuration: 8.0,

      currentRoomIndex: 0,
      bioPoints: 110,
      weaponParts: 0,
      coreSamples: 0,
      shopCoresBought: 0,
      coresSoldCount: 0,
      thermiteParts: 0,
      thermiteCrafted: false,
      totalKills: 0,
      comboCount: 0,
      comboTimer: 0,
      totalRevives: 0,
      totalFriendlyFireDmg: 0,

      rooms: [],
      doors: [],
      obstacles: [],
      crates: [],
      armoryVaults: [],
      deconStations: [],
      missionNodes: [],
      pickups: [],
      barricades: [],
      barrels: [],
      acidPools: [],
      flamePools: [],
      shockTrails: [],
      cystPods: [],
      tentacles: [],
      bloodPylons: [],
      laserAngle: 0,
      laserTimer: 0,
      players: [],
      zombies: [],
      midBoss: null,
      bullets: [],
      particles: [],

      boss: null,
      collapseState: { active: false, roomIndex: -1, timer: 0 },
      spawnTimer: 0,
      wavePhase: 'CALM', // 'CALM' (소강/정비 14s) -> 'SURGE' (대규모 웨이브 피크 18s)
      waveTimer: 10.0,
      waveNumber: 1
    };

    function createRNG(seed) {
      let s = seed % 2147483647;
      if (s <= 0) s += 2147483646;
      return function() {
        s = (s * 16807) % 2147483647;
        return (s - 1) / 2147483646;
      };
    }

    function clearThreeGroup(group) {
      while (group.children.length > 0) {
        group.remove(group.children[0]);
      }
    }

