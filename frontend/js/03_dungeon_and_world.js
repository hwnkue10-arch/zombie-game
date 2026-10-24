/**
 * =========================================================================
 * BOXHEAD: THE CORE v3.2 — Frontend Module: 03_dungeon_and_world.js
 * Zero-Loss Refactored Architecture (Shared Global Lexical Scope)
 * =========================================================================
 */
"use strict";

    // =========================================================================
    // 6. PROCEDURAL MEGA-SECTOR DUNGEON (96x96), SPAWN HOLES & ICONIC 3D OBJECTS
    // =========================================================================
    function calculateWaveQuota(sectorIndex, roomWaveCount) {
      const sIdx = sectorIndex !== undefined ? sectorIndex : (game.currentRoomIndex || 0);
      const wCount = roomWaveCount || 1;
      const numPlayers = (game.players && game.players.filter(p => !p.downed || p.connected).length) || 1;
      const squadScale = 1 + Math.max(0, numPlayers - 1) * 0.35;
      // 섹터별 고정 출현 정원(Quota) 스케일링:
      // 1섹터: 28마리 (솔로 기준)
      // 2섹터: 42마리
      // 3섹터: 56마리
      // 4섹터: 70마리
      // 5섹터: 84마리
      // 웨이브 회차당 + 8마리
      const baseCount = 28 + sIdx * 14 + (wCount - 1) * 8;
      return Math.round(baseCount * squadScale);
    }

    function registerWorldSymbol(x, y, z, text, badgeClass, refObj, roomIndex) {
      const cleanBadgeClass = (badgeClass || "").replace(/animate-bounce|animate-pulse/g, "");
      const el = document.createElement("div");
      el.className = `absolute transform -translate-x-1/2 -translate-y-full pointer-events-none px-2.5 py-0.5 rounded-lg text-[11px] font-extrabold whitespace-nowrap shadow-lg border backdrop-blur-xs ${cleanBadgeClass}`;
      el.textContent = text;
      el.style.display = "none";
      document.getElementById("floating-labels").appendChild(el);
      if (!game.worldSymbols) game.worldSymbols = [];
      const sym = { x, y, z, el, refObj, roomIndex };
      game.worldSymbols.push(sym);
      return sym;
    }

    function spawnBreachHole(room, x, z, rotY, initiallyActive) {
      const group = new THREE.Group();
      group.rotation.y = rotY || 0;

      const wallColor = room.isBossRoom ? 0x4c1d2e : 0x334155;
      const innerConcreteColor = room.isBossRoom ? 0x31101d : 0x1e293b;
      const wallMat = new THREE.MeshStandardMaterial({ color: wallColor, roughness: 0.78 });
      const brokenMat = new THREE.MeshStandardMaterial({ color: innerConcreteColor, roughness: 0.92 });
      const rebarMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.85, roughness: 0.35 });

      // 1. 미개방 상태일 때 외벽 빈틈을 메우고 있는 금 간 외벽 패널 (웨이브 진행으로 붕괴 시 산산조각 나며 사라짐!)
      const intactWallMesh = new THREE.Mesh(
        new THREE.BoxGeometry(6.6, 4.0, 1.6),
        wallMat
      );
      intactWallMesh.position.set(0, 2.0, 0);
      intactWallMesh.visible = !initiallyActive;
      group.add(intactWallMesh);

      // 2. 진짜 무너져 내린 외벽(Broken Outer Wall) 구조물 그룹 — 검은 수정이나 고깔이 아니라 실제 벽체가 부서진 단면과 철근, 벽돌 잔해!
      const breachDetailGroup = new THREE.Group();

      // 좌·우 계단식으로 부서진 실제 외벽 콘크리트 단면 (Jagged Stepped Wall Edges)
      const leftSteps = [
        { x: -2.75, y: 2.0, w: 1.1, h: 4.0, d: 1.62 },
        { x: -1.95, y: 1.35, w: 0.75, h: 2.7, d: 1.56 },
        { x: -1.45, y: 0.65, w: 0.55, h: 1.3, d: 1.48 }
      ];
      leftSteps.forEach((st, idx) => {
        const m = new THREE.Mesh(new THREE.BoxGeometry(st.w, st.h, st.d), idx === 0 ? wallMat : brokenMat);
        m.position.set(st.x, st.y, 0);
        m.castShadow = true;
        breachDetailGroup.add(m);
      });

      const rightSteps = [
        { x: 2.75, y: 2.0, w: 1.1, h: 4.0, d: 1.62 },
        { x: 1.90, y: 1.50, w: 0.80, h: 3.0, d: 1.56 },
        { x: 1.38, y: 0.55, w: 0.52, h: 1.1, d: 1.48 }
      ];
      rightSteps.forEach((st, idx) => {
        const m = new THREE.Mesh(new THREE.BoxGeometry(st.w, st.h, st.d), idx === 0 ? wallMat : brokenMat);
        m.position.set(st.x, st.y, 0);
        m.castShadow = true;
        breachDetailGroup.add(m);
      });

      // 상단 무너지다 남은 외벽 인방보(Top Broken Wall Lintel) 조각
      const topLintelL = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.65, 1.58), wallMat);
      topLintelL.position.set(-1.5, 3.68, 0);
      topLintelL.rotation.z = -0.14;
      const topLintelR = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.62, 1.58), wallMat);
      topLintelR.position.set(1.55, 3.66, 0);
      topLintelR.rotation.z = 0.12;
      breachDetailGroup.add(topLintelL, topLintelR);

      // 부서진 콘크리트 단면 사이로 삐져나온 휘어진 철근(Steel Rebar) 가닥들
      const rebarSpecs = [
        { x: -1.35, y: 2.15, z: 0.15, rz: 1.35, ry: 0.1 },
        { x: -1.25, y: 1.15, z: -0.2, rz: 1.52, ry: -0.15 },
        { x: 1.30, y: 2.35, z: -0.1, rz: -1.38, ry: 0.12 },
        { x: 1.22, y: 1.05, z: 0.22, rz: -1.55, ry: -0.1 },
        { x: -0.65, y: 3.35, z: 0.0, rz: 0.35, ry: 0.0 },
        { x: 0.72, y: 3.30, z: 0.1, rz: -0.28, ry: 0.0 }
      ];
      rebarSpecs.forEach(rs => {
        const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 1.25, 6), rebarMat);
        bar.position.set(rs.x, rs.y, rs.z);
        bar.rotation.z = rs.rz;
        bar.rotation.y = rs.ry;
        breachDetailGroup.add(bar);
      });

      // 바닥에 무너져 내린 직육면체 콘크리트 벽돌·슬래브 파편들 (절대 검은 수정 모양 아님!)
      const brickSpecs = [
        { x: -1.1, z: 1.1, w: 0.95, h: 0.34, d: 0.55, ry: 0.4 },
        { x: -0.2, z: 1.35, w: 0.75, h: 0.26, d: 0.48, ry: -0.3 },
        { x: 0.95, z: 1.05, w: 1.05, h: 0.36, d: 0.58, ry: 0.25 },
        { x: 0.35, z: -1.1, w: 0.85, h: 0.30, d: 0.52, ry: -0.5 },
        { x: -0.85, z: -1.0, w: 0.90, h: 0.32, d: 0.50, ry: 0.15 }
      ];
      brickSpecs.forEach((bs, idx) => {
        const brick = new THREE.Mesh(new THREE.BoxGeometry(bs.w, bs.h, bs.d), idx % 2 === 0 ? wallMat : brokenMat);
        brick.position.set(bs.x, bs.h / 2, bs.z);
        brick.rotation.y = bs.ry;
        breachDetailGroup.add(brick);
      });

      // 부서진 외벽 바닥 경계선 (비상 해저드 라인)
      const ringMesh = new THREE.Mesh(
        new THREE.PlaneGeometry(3.8, 0.24),
        new THREE.MeshBasicMaterial({ color: 0xef4444, side: THREE.DoubleSide, transparent: true, opacity: 0.85 })
      );
      ringMesh.rotation.x = -Math.PI / 2;
      ringMesh.position.set(0, 0.05, 0.95);
      breachDetailGroup.add(ringMesh);

      breachDetailGroup.visible = !!initiallyActive;
      group.add(breachDetailGroup);

      group.position.set(x, 0, z);
      entitiesGroup.add(group);

      const holeObj = {
        roomIndex: room.index,
        x, z, rotY: rotY || 0,
        active: !!initiallyActive,
        pulse: Math.random() * 6.28,
        group,
        intactWallMesh,
        breachDetailGroup,
        ringMesh
      };
      const sym = registerWorldSymbol(x, 3.8, z, "🧱무너진외벽", "bg-rose-950/90 border-rose-500/60 text-rose-200", holeObj, room.index);
      holeObj.sym = sym;
      if (!room.spawnHoles) room.spawnHoles = [];
      room.spawnHoles.push(holeObj);
      if (!game.spawnHoles) game.spawnHoles = [];
      game.spawnHoles.push(holeObj);
    }

    function activateAdditionalSpawnHole(room) {
      if (!room || !room.spawnHoles) return;
      const dormant = room.spawnHoles.filter(h => !h.active);
      if (dormant.length === 0) return;
      const pick = dormant[Math.floor(Math.random() * dormant.length)];
      pick.active = true;
      if (pick.intactWallMesh) pick.intactWallMesh.visible = false;
      if (pick.breachDetailGroup) pick.breachDetailGroup.visible = true;
      SoundFX.play("explosion");

      // 외벽이 실제로 폭파되며 콘크리트 벽돌 파편이 튀는 연출!
      spawnBloodParticles(pick.x, 2.0, pick.z, 0x475569, 8);

      const safeBanner = document.getElementById("hud-safe-banner");
      if (safeBanner) {
        document.getElementById("hud-safe-banner-text").textContent = "💥 외벽 추가 붕괴! 멀쩡하던 외벽이 무너지며 감염체가 진입합니다!";
        safeBanner.classList.remove("hidden");
        setTimeout(() => safeBanner.classList.add("hidden"), 4000);
      }
    }

    function generateProceduralDungeon(seed) {
      clearThreeGroup(worldGroup);
      clearThreeGroup(entitiesGroup);
      clearThreeGroup(effectsGroup);
      document.getElementById("floating-labels").innerHTML = "";

      const rng = createRNG(seed);
      game.rooms = [];
      game.doors = [];
      game.obstacles = [];
      game.crates = [];
      game.armoryVaults = [];
      game.deconStations = [];
      game.missionNodes = [];
      game.pickups = [];
      game.barricades = [];
      game.barrels = [];
      game.acidPools = [];
      game.flamePools = [];
      game.shockTrails = [];
      game.cystPods = [];
      game.tentacles = [];
      game.bloodPylons = [];
      game.spawnHoles = [];
      game.worldSymbols = [];
      game.players = [];
      game.zombies = [];
      game.midBoss = null;
      game.bullets = [];
      game.particles = [];
      game.boss = null;
      game.collapseState = { active: false, roomIndex: -1, timer: 0 };

      const occupiedGrid = new Map();
      let gx = 0, gz = 0;
      const GRID_STEP = 124;

      const missionPool = ["THERMITE", "GENERATORS", "PAYLOAD", "RADAR_UPLINK", "HIVE_NODES", "DECON_PURGE", "EXTERMINATE"];
      const shapePool = ["RECT_BUNKER", "TUNNEL_LONG", "L_FACILITY", "OCTAGON_REACTOR", "CROSS_WAREHOUSE"];
      const scaleMult = game.pacing === "marathon" ? 1.35 : (game.pacing === "blitz" ? 0.55 : 0.95);

      let midBossRoomIndices = [2, 5, 8];
      if (game.totalRooms <= 5) midBossRoomIndices = [1, 2, 3];
      else if (game.totalRooms <= 7) midBossRoomIndices = [1, 3, 5];

      for (let i = 0; i < game.totalRooms; i++) {
        occupiedGrid.set(`${gx},${gz}`, i);
        const isBossRoom = (i === game.totalRooms - 1);
        const shapeType = isBossRoom ? "BOSS_DOME" : shapePool[i % shapePool.length];

        let roomW = 94, roomD = 94;
        if (isBossRoom) {
          roomW = 112; roomD = 112;
        } else if (shapeType === "RECT_BUNKER") {
          roomW = 98; roomD = 82;
        } else if (shapeType === "TUNNEL_LONG") {
          roomW = (i % 2 === 1) ? 110 : 74;
          roomD = (i % 2 === 1) ? 74 : 110;
        } else if (shapeType === "L_FACILITY") {
          roomW = 96; roomD = 96;
        } else if (shapeType === "OCTAGON_REACTOR") {
          roomW = 100; roomD = 100;
        } else if (shapeType === "CROSS_WAREHOUSE") {
          roomW = 98; roomD = 98;
        }

        const roomSize = Math.max(roomW, roomD);
        const wx = gx * GRID_STEP;
        const wz = gz * GRID_STEP;

        const condType = isBossRoom ? "BOSS" : missionPool[i % missionPool.length];
        // 중반(4~6섹터) 및 후반(7~9섹터) 미션 목표 개수 확장 (3 -> 4 -> 5개)
        const stageTier = i >= 6 ? 5 : (i >= 3 ? 4 : 3);
        let targetVal = 1;
        if (condType === "THERMITE") targetVal = Math.round(22 * scaleMult);
        else if (condType === "GENERATORS") targetVal = stageTier;
        else if (condType === "PAYLOAD") targetVal = 1;
        else if (condType === "RADAR_UPLINK") targetVal = 3;
        else if (condType === "DECON_PURGE") targetVal = Math.min(4, stageTier);
        else if (condType === "HIVE_NODES") targetVal = stageTier;
        else if (condType === "EXTERMINATE") targetVal = Math.max(2, stageTier - 1);

        const mbOrder = midBossRoomIndices.indexOf(i);
        const hasMidBoss = (!isBossRoom && mbOrder !== -1);

        const envPool = ["NORMAL", "BLACKOUT", "TOXIC_FOG", "BLOOD_RAIN", "CRYO_LEAK"];
        const envType = (i === 0 || isBossRoom) ? "NORMAL" : envPool[1 + Math.floor(rng() * (envPool.length - 1))];
        const bpCap = 999999;

        const payloadSteps = (i >= 3) ? 3 : 2; // 4섹터+ 블랙박스 미션은 중간에 🔐보안중계기 해독 단계 포함!
        const totalSteps = condType === "THERMITE" ? 3
          : (condType === "PAYLOAD" ? payloadSteps
          : (condType === "RADAR_UPLINK" ? 3
          : targetVal));

        const secTimer = isBossRoom ? 999 : Math.round((260 + i * 20) * (game.pacing === "blitz" ? 0.75 : 1.0));
        // 외벽 스폰 구멍 추가 파공 이벤트: 섹터당 약 42% 확률로만 발생(안 터지는 섹터 존재), 타이머 50% 이하 중반부터만 발동!
        const willHaveExtraBreach = (i > 0 && !isBossRoom && rng() < 0.42);
        const maxExtraHoles = willHaveExtraBreach ? (rng() < 0.55 ? 1 : 2) : 0;

        const room = {
          index: i,
          gx, gz, wx, wz,
          shapeType,
          w: roomW,
          d: roomD,
          hw: roomW / 2,
          hd: roomD / 2,
          size: roomSize,
          half: Math.min(roomW, roomD) / 2,
          unlocked: i === 0,
          cleared: false,
          collapsed: false,
          collapsing: false,
          lockedBehind: false,
          berserkActive: false,
          isBossRoom,
          hasMidBoss,
          midBossOrder: mbOrder,
          midBossSpawned: false,
          envType,
          envCleared: false,
          blackoutEventTimer: 0,
          blackoutTriggeredOnce: false,
          condType,
          subStage: 0,
          progress: 0,
          targetVal,
          roomWaveCount: 1,
          reqWaves: totalSteps,
          unlockStage: 0,
          completedStage: 0,
          waitingForWaveDefense: true,
          waveZombieQuota: calculateWaveQuota(i, 1),
          waveZombiesSpawned: 0,
          activeMissionTargetPos: null,
          bpEarned: 0,
          bpCap,
          sectorKills: 0,
          sectorTimer: secTimer,
          maxSectorTimer: secTimer,
          overtimeAlerted: false,
          willHaveExtraBreach,
          maxExtraHoles,
          extraHolesOpened: 0,
          gasWaveActive: false,
          gasWaveProgress: 0,
          gasMesh: null,
          spawnHoles: [],
          connectedDirs: {},
          floorMesh: null,
          meshGroup: null
        };
        game.rooms.push(room);

        if (i < game.totalRooms - 1) {
          const dirs = [
            { key: "N", opp: "S", dx: 0, dz: -1 },
            { key: "E", opp: "W", dx: 1, dz: 0 },
            { key: "W", opp: "E", dx: -1, dz: 0 },
            { key: "S", opp: "N", dx: 0, dz: 1 }
          ];
          for (let k = dirs.length - 1; k > 0; k--) {
            const j = Math.floor(rng() * (k + 1));
            const tmp = dirs[k]; dirs[k] = dirs[j]; dirs[j] = tmp;
          }
          let chosen = dirs.find(d => !occupiedGrid.has(`${gx + d.dx},${gz + d.dz}`));
          if (!chosen) chosen = { key: "N", opp: "S", dx: 0, dz: -1 };
          room.nextDir = chosen;
          gx += chosen.dx;
          gz += chosen.dz;
        }
      }

      for (let i = 0; i < game.rooms.length; i++) {
        const r = game.rooms[i];
        if (r.nextDir && game.rooms[i + 1]) {
          const nextR = game.rooms[i + 1];
          r.connectedDirs[r.nextDir.key] = i + 1;
          nextR.connectedDirs[r.nextDir.opp] = i;
        }
        buildMassiveRoomGeometry(r, rng);
      }

      const finalRoom = game.rooms[game.rooms.length - 1];
      createOrganicHeartBoss(finalRoom);
      updateRoomVisibility();
    }

    // =========================================================================
    // [v3.1] 전장의 안개 (Fog of War) — 열리기 전까지 다음 섹터 3D & 엔티티 완벽 은폐
    // =========================================================================
    function updateRoomVisibility() {
      game.rooms.forEach(r => {
        const isVis = !!r.unlocked;
        if (r.meshGroup) r.meshGroup.visible = isVis;
      });
      game.doors.forEach(d => {
        const toR = game.rooms[d.toRoom];
        const fromR = game.rooms[d.fromRoom];
        // 연결 다리(bridgeGroup)는 다음 섹터가 열렸을 때만 보이게 하여 열리기 전에는 밖이 완벽한 어둠으로 차단됨!
        if (d.bridgeGroup) {
          d.bridgeGroup.visible = !!(toR && toR.unlocked);
        }
        if (d.mesh) {
          d.mesh.visible = !!(fromR && fromR.unlocked);
        }
      });
      game.crates.forEach(c => {
        const r = game.rooms[c.roomIndex];
        if (c.group) c.group.visible = !!(r && r.unlocked && !c.opened);
      });
      game.barrels.forEach(b => {
        if (b.roomIndex !== undefined && b.roomIndex >= 0) {
          const r = game.rooms[b.roomIndex];
          if (b.group) b.group.visible = !!(r && r.unlocked);
        }
      });
      game.deconStations.forEach(ds => {
        const r = game.rooms[ds.roomIndex];
        if (ds.mesh) ds.mesh.visible = !!(r && r.unlocked && ds.charges > 0);
      });
      game.spawnHoles.forEach(h => {
        const r = game.rooms[h.roomIndex];
        if (h.group) h.group.visible = !!(r && r.unlocked);
      });
      game.missionNodes.forEach(n => {
        const r = game.rooms[n.roomIndex];
        if (n.mesh) n.mesh.visible = !!(r && r.unlocked && !n.done);
      });
      game.cystPods.forEach(p => {
        const r = game.rooms[p.roomIndex];
        if (p.mesh) p.mesh.visible = !!(r && r.unlocked && p.hp > 0);
      });
      game.armoryVaults.forEach(v => {
        const r = game.rooms[v.roomIndex];
        const showArmory = !!(r && r.unlocked);
        v.activeInCalm = true;
        if (v.mesh) v.mesh.visible = showArmory;
      });
      if (game.boss && game.boss.group) {
        const bRoom = game.rooms[game.rooms.length - 1];
        game.boss.group.visible = !!(bRoom && bRoom.unlocked && !game.boss.dead);
      }
    }

    // 외벽에 실제 무너진 틈새(Breach Opening) 및 매립형 무기고 개구부(Armory Alcove)를 뚫어서 분할 생성하는 헬퍼
    function addOuterWallSegmentsWithBreaches(group, wx, wz, rotY, totalLen, wallHeight, wallThick, wallMat, cutIntervals) {
      const halfLen = totalLen / 2;
      let cursor = -halfLen;
      const intervals = [...cutIntervals].sort((a, b) => a[0] - b[0]);

      intervals.forEach(iv => {
        const segStart = Math.max(cursor, iv[0]);
        if (segStart > cursor + 0.4) {
          const segLen = segStart - cursor;
          const mid = (cursor + segStart) / 2;
          const segMesh = new THREE.Mesh(new THREE.BoxGeometry(segLen, wallHeight, wallThick), wallMat);
          const sx = rotY === 0 ? wx + mid : wx;
          const sz = rotY === 0 ? wz : wz + mid;
          segMesh.position.set(sx, wallHeight / 2, sz);
          segMesh.rotation.y = rotY;
          segMesh.castShadow = true;
          group.add(segMesh);
          addWallCollider(sx, sz, rotY === 0 ? segLen : wallThick, rotY === 0 ? wallThick : segLen);
        }
        cursor = Math.max(cursor, iv[1]);
      });

      if (halfLen > cursor + 0.4) {
        const segLen = halfLen - cursor;
        const mid = (cursor + halfLen) / 2;
        const segMesh = new THREE.Mesh(new THREE.BoxGeometry(segLen, wallHeight, wallThick), wallMat);
        const sx = rotY === 0 ? wx + mid : wx;
        const sz = rotY === 0 ? wz : wz + mid;
        segMesh.position.set(sx, wallHeight / 2, sz);
        segMesh.rotation.y = rotY;
        segMesh.castShadow = true;
        group.add(segMesh);
        addWallCollider(sx, sz, rotY === 0 ? segLen : wallThick, rotY === 0 ? wallThick : segLen);
      }
    }

    function buildMassiveRoomGeometry(room, rng) {
      const group = new THREE.Group();
      room.meshGroup = group;
      const rw = room.w || room.size;
      const rd = room.d || room.size;
      const hw = room.hw || (rw / 2);
      const hd = room.hd || (rd / 2);
      const s = Math.min(rw, rd);
      const h = Math.min(hw, hd);

      const floorPalette = [0x111622, 0x161d2b, 0x141e24, 0x1c1926, 0x18201c];
      const floorColor = room.isBossRoom ? 0x220911 : floorPalette[room.index % floorPalette.length];
      const floorMesh = new THREE.Mesh(
        new THREE.BoxGeometry(rw, 0.6, rd),
        new THREE.MeshStandardMaterial({ color: floorColor, roughness: 0.85 })
      );
      floorMesh.position.set(room.wx, -0.3, room.wz);
      floorMesh.receiveShadow = true;
      group.add(floorMesh);
      room.floorMesh = floorMesh;

      const gridHelper = new THREE.GridHelper(Math.max(rw, rd), Math.floor(Math.max(rw, rd) / 4), 0x2e3b4e, 0x192130);
      gridHelper.scale.set(rw / Math.max(rw, rd), 1, rd / Math.max(rw, rd));
      gridHelper.position.set(room.wx, 0.02, room.wz);
      group.add(gridHelper);

      const wallHeight = 4.0;
      const wallThick = 1.6;
      const doorWidth = 11.0;
      const breachGap = 6.4;

      const bOffX = Math.min(22, hw - 13);
      const bOffZ = Math.min(22, hd - 13);

      const sides = [
        { dir: "N", x: 0, z: -hd, len: rw, rotY: 0, breachOffsets: [-bOffX], inNormX: 0, inNormZ: 1 },
        { dir: "S", x: 0, z: hd, len: rw, rotY: 0, breachOffsets: [bOffX], inNormX: 0, inNormZ: -1 },
        { dir: "E", x: hw, z: 0, len: rd, rotY: Math.PI / 2, breachOffsets: [-bOffZ, bOffZ], inNormX: -1, inNormZ: 0 },
        { dir: "W", x: -hw, z: 0, len: rd, rotY: Math.PI / 2, breachOffsets: [-bOffZ, bOffZ], inNormX: 1, inNormZ: 0 }
      ];

      const wallMat = new THREE.MeshStandardMaterial({
        color: room.isBossRoom ? 0x4c1d2e : 0x334155,
        roughness: 0.75
      });

      const initActiveCount = room.index === 0 ? 3 : 4;
      let holeGlobalIdx = 0;

      sides.forEach(side => {
        const neighborIdx = room.connectedDirs[side.dir];
        const wx = room.wx + side.x;
        const wz = room.wz + side.z;
        const cuts = [];

        if (neighborIdx !== undefined) {
          cuts.push([-doorWidth / 2, doorWidth / 2]);
        }

        // 1. 좀비 출현용 무너진 외벽 개구부(Breach Cut)
        side.breachOffsets.forEach(bOff => {
          cuts.push([bOff - breachGap / 2, bOff + breachGap / 2]);
          const bx = side.rotY === 0 ? wx + bOff : wx;
          const bz = side.rotY === 0 ? wz : wz + bOff;
          addWallCollider(bx, bz, side.rotY === 0 ? breachGap : wallThick, side.rotY === 0 ? wallThick : breachGap);
          spawnBreachHole(room, bx, bz, side.rotY, holeGlobalIdx < initActiveCount);
          holeGlobalIdx++;
        });

        addOuterWallSegmentsWithBreaches(group, wx, wz, side.rotY, side.len + wallThick, wallHeight, wallThick, wallMat, cuts);

        if (neighborIdx !== undefined && neighborIdx > room.index) {
          const nextR = game.rooms[neighborIdx];
          const isNS = (side.dir === "N" || side.dir === "S");
          const signDir = (side.dir === "S" || side.dir === "E") ? 1 : -1;
          const startEdge = isNS ? (room.wz + signDir * hd) : (room.wx + signDir * hw);
          const endEdge = isNS ? (nextR.wz - signDir * (nextR.hd || nextR.half)) : (nextR.wx - signDir * (nextR.hw || nextR.half));
          const midX = isNS ? room.wx : (startEdge + endEdge) / 2;
          const midZ = isNS ? (startEdge + endEdge) / 2 : room.wz;
          const bridgeLen = Math.abs(endEdge - startEdge) + 1.6;

          const bridgeGroup = new THREE.Group();
          const bridgeMesh = new THREE.Mesh(
            new THREE.BoxGeometry(side.rotY === 0 ? doorWidth + 2 : bridgeLen, 0.6, side.rotY === 0 ? bridgeLen : doorWidth + 2),
            new THREE.MeshStandardMaterial({ color: 0x1e293b })
          );
          bridgeMesh.position.set(midX, -0.3, midZ);
          bridgeGroup.add(bridgeMesh);

          [-doorWidth / 2 - 0.8, doorWidth / 2 + 0.8].forEach(railOff => {
            const rMesh = new THREE.Mesh(
              new THREE.BoxGeometry(side.rotY === 0 ? 1.2 : bridgeLen, wallHeight, side.rotY === 0 ? bridgeLen : 1.2),
              wallMat
            );
            const rx = side.rotY === 0 ? midX + railOff : midX;
            const rz = side.rotY === 0 ? midZ : midZ + railOff;
            rMesh.position.set(rx, wallHeight / 2, rz);
            bridgeGroup.add(rMesh);
            addWallCollider(rx, rz, side.rotY === 0 ? 1.2 : bridgeLen, side.rotY === 0 ? bridgeLen : 1.2);
          });
          bridgeGroup.visible = false;
          worldGroup.add(bridgeGroup);

          // 격벽 게이트(doorMesh)는 현재 방의 외벽 개구부(wx, wz)에 정확히 밀착 배치하여 열리기 전까지 외부를 완전 차단!
          const doorX = wx;
          const doorZ = wz;
          const doorMesh = new THREE.Mesh(
            new THREE.BoxGeometry(side.rotY === 0 ? doorWidth : 1.8, wallHeight + 0.3, side.rotY === 0 ? 1.8 : doorWidth),
            new THREE.MeshStandardMaterial({
              color: 0xd97706,
              emissive: 0x78350f,
              emissiveIntensity: 0.45
            })
          );
          doorMesh.position.set(doorX, wallHeight / 2, doorZ);
          group.add(doorMesh);

          game.doors.push({
            fromRoom: room.index,
            toRoom: neighborIdx,
            x: doorX, z: doorZ,
            w: side.rotY === 0 ? doorWidth : 2.0,
            d: side.rotY === 0 ? 2.0 : doorWidth,
            rotY: side.rotY,
            inNormX: side.inNormX,
            inNormZ: side.inNormZ,
            closedY: wallHeight / 2,
            open: false,
            lockedPermanently: false,
            mesh: doorMesh,
            bridgeGroup
          });
        }
      });

      // 외벽 매립형 상시 무기고 위치 선정 (출입문이 없는 외벽 중앙에 매립 배치하여 내부 벽 끼임 원천 차단!)
      const armSide = sides.find(sd => room.connectedDirs[sd.dir] === undefined) || sides[0];
      const armX = room.wx + armSide.x + armSide.inNormX * 1.4;
      const armZ = room.wz + armSide.z + armSide.inNormZ * 1.4;
      const armRotY = armSide.dir === "N" ? 0 : (armSide.dir === "S" ? Math.PI : (armSide.dir === "W" ? Math.PI / 2 : -Math.PI / 2));
      room.armoryFixedPos = { x: armX, z: armZ, rotY: armRotY, inNormX: armSide.inNormX, inNormZ: armSide.inNormZ };

      if (!room.isBossRoom) {
        const subWallMat = new THREE.MeshStandardMaterial({ color: 0x475569, roughness: 0.75 });
        const pillarMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.6 });

        const partitionLayouts = [
          { dx: -22, dz: -18, w: 16, d: 1.8 },
          { dx: -30, dz: -11, w: 1.8, d: 14 },
          { dx: 22, dz: -18, w: 16, d: 1.8 },
          { dx: 30, dz: -11, w: 1.8, d: 14 },
          { dx: -22, dz: 18, w: 16, d: 1.8 },
          { dx: -30, dz: 11, w: 1.8, d: 14 },
          { dx: 22, dz: 18, w: 16, d: 1.8 },
          { dx: 30, dz: 11, w: 1.8, d: 14 },
          { dx: -16, dz: 0, w: 1.8, d: 14 },
          { dx: 16, dz: 0, w: 1.8, d: 14 },
          { dx: 0, dz: -24, w: 14, d: 1.8 },
          { dx: 0, dz: 24, w: 14, d: 1.8 }
        ];
        partitionLayouts.forEach(pl => {
          const px = room.wx + pl.dx;
          const pz = room.wz + pl.dz;
          if (Math.hypot(px - armX, pz - armZ) < 10.5) return;
          if (rng() < 0.86) {
            const pm = new THREE.Mesh(new THREE.BoxGeometry(pl.w, 3.5, pl.d), subWallMat);
            pm.position.set(px, 1.75, pz);
            pm.castShadow = true;
            group.add(pm);
            addWallCollider(px, pz, pl.w, pl.d);
          }
        });

        [[-9, -9], [9, -9], [-9, 9], [9, 9]].forEach(cp => {
          const pil = new THREE.Mesh(new THREE.BoxGeometry(3.2, 3.0, 3.2), pillarMat);
          pil.position.set(room.wx + cp[0], 1.5, room.wz + cp[1]);
          pil.castShadow = true;
          group.add(pil);
          addWallCollider(room.wx + cp[0], room.wz + cp[1], 3.2, 3.2);
        });

        // 미션 오브젝트는 시작 시 미리 깔아두지 않고, 웨이브를 막을 때마다 랜덤 위치에 스폰됨!
        spawnDeconStation(room.wx + h - 13, room.wz + 10, room.index);

        const mazeOffsets = [
          { dx: -8, dz: -h + 8, w: 11, d: 1.6 },
          { dx: 8, dz: -h + 15, w: 11, d: 1.6 },
          { dx: -8, dz: h - 8, w: 11, d: 1.6 },
          { dx: 8, dz: h - 15, w: 11, d: 1.6 }
        ];
        mazeOffsets.forEach(mo => {
          const mx = room.wx + mo.dx;
          const mz = room.wz + mo.dz;
          if (Math.hypot(mx - armX, mz - armZ) < 10.5) return;
          const mm = new THREE.Mesh(new THREE.BoxGeometry(mo.w, 3.2, mo.d), subWallMat);
          mm.position.set(mx, 1.6, mz);
          group.add(mm);
          addWallCollider(mx, mz, mo.w, mo.d);
        });

        if (room.envType === "TOXIC_FOG" || room.envType === "BLACKOUT") {
          const vGroup = new THREE.Group();
          const isFog = room.envType === "TOXIC_FOG";
          const colMesh = new THREE.Mesh(
            new THREE.CylinderGeometry(0.9, 1.1, 2.2, 12),
            new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.6 })
          );
          colMesh.position.y = 1.1;
          vGroup.add(colMesh);

          const wheelMesh = new THREE.Mesh(
            new THREE.TorusGeometry(1.05, 0.22, 8, 20),
            new THREE.MeshStandardMaterial({
              color: isFog ? 0x84cc16 : 0xfacc15,
              emissive: isFog ? 0x3f6212 : 0xa16207,
              emissiveIntensity: 0.85
            })
          );
          wheelMesh.rotation.x = Math.PI / 2;
          wheelMesh.position.y = 2.35;
          vGroup.add(wheelMesh);

          vGroup.position.set(room.wx, 0, room.wz - 13);
          entitiesGroup.add(vGroup);
          const envNode = {
            roomIndex: room.index,
            kind: "ENV_CONTROL",
            envType: room.envType,
            stepOrder: 0,
            x: room.wx, z: room.wz - 13,
            done: false,
            holdTime: 0,
            mesh: vGroup,
            wheelMesh
          };
          game.missionNodes.push(envNode);
          registerWorldSymbol(
            room.wx, 3.1, room.wz - 13,
            isFog ? "☣️환기밸브[F]" : "💡비상전원[F]",
            "bg-lime-950/90 border-lime-400 text-lime-200",
            envNode, room.index
          );
        }
      } else if (room.isBossRoom) {
        room.bossPhaseStage = 1;
        room.coolantsDone = 0;
        // 10섹터 3단계 레이드 1단계: 돔 좌·우 양측 보조 냉각 콘솔 2기 배치!
        [-26, 26].forEach((cx, idx) => {
          const cGroup = new THREE.Group();
          const pedestal = new THREE.Mesh(
            new THREE.BoxGeometry(2.4, 2.0, 2.0),
            new THREE.MeshStandardMaterial({ color: 0x0f172a, metalness: 0.8, roughness: 0.25 })
          );
          pedestal.position.y = 1.0;
          cGroup.add(pedestal);

          const coreCyl = new THREE.Mesh(
            new THREE.CylinderGeometry(0.55, 0.55, 1.4, 12),
            new THREE.MeshStandardMaterial({ color: 0x06b6d4, emissive: 0x0891b2, emissiveIntensity: 0.85 })
          );
          coreCyl.position.y = 2.1;
          cGroup.add(coreCyl);

          const pos = { x: room.wx + cx, z: room.wz };
          cGroup.position.set(pos.x, 0, pos.z);
          entitiesGroup.add(cGroup);

          const nodeObj = {
            roomIndex: room.index,
            kind: "BOSS_COOLANT",
            coolantIdx: idx + 1,
            x: pos.x,
            z: pos.z,
            done: false,
            holdTime: 0,
            mesh: cGroup
          };
          game.missionNodes.push(nodeObj);
          registerWorldSymbol(
            pos.x, 3.2, pos.z,
            `❄️냉각콘솔${idx + 1}[F]`,
            "bg-cyan-950/90 border-cyan-400 text-cyan-200",
            nodeObj, room.index
          );
        });
      }

      // [v3.1] 비정형 섹터 구조물(L자 격리동, 중앙 팔각 반응로 코어, 십자 물류창고) 및 다채로운 전술 엄폐 오브젝트 생성
      buildCustomSectorShapeAndProps(room, group, rng);

      // [v3.2 상시 활성 외벽 매립형 무기고] 웨이브와 무관하게 고정 위치에서 항상 활성화!
      spawnArmoryVault(
        armX,
        armZ,
        armRotY,
        armSide.inNormX,
        armSide.inNormZ,
        room.index,
        true
      );

      // [v3.1] 제한시간 초과 시 출구 반대편 외벽에서 출구 쪽으로 조여오는 지향성 독가스 장막(Gas Wave Mesh) 준비
      const gasGeo = new THREE.BoxGeometry(rw - 2, 3.6, rd - 2);
      const gasMat = new THREE.MeshBasicMaterial({
        color: 0x65a30d,
        transparent: true,
        opacity: 0.34,
        side: THREE.DoubleSide
      });
      const gasMesh = new THREE.Mesh(gasGeo, gasMat);
      gasMesh.position.set(room.wx, 1.8, room.wz);
      gasMesh.visible = false;
      group.add(gasMesh);
      room.gasMesh = gasMesh;

      const cOffX = hw - 8.0;
      const cOffZ = hd - 8.0;
      [[-cOffX, -cOffZ], [cOffX, cOffZ]].forEach((co, cIdx) => {
        if (!isPointBlockedByWall(room.wx + co[0], room.wz + co[1], 2.2, true)) {
          spawnSupplyCrate(room.wx + co[0], room.wz + co[1], room.index, cIdx);
        }
      });

      for (let b = 0; b < 6; b++) {
        const bx = room.wx + (rng() - 0.5) * (rw - 24);
        const bz = room.wz + (rng() - 0.5) * (rd - 24);
        if (Math.hypot(bx - room.wx, bz - room.wz) > 11.0 && !isPointBlockedByWall(bx, bz, 1.5, true)) {
          spawnBarrel(bx, bz, false, null, false, -1, room.index);
        }
      }

      worldGroup.add(group);
    }

    // [v3.1] 섹터별 비정형 레이아웃(L자 연구소, 팔각 반응로, 십자 물류창고, 터널) + 서버랙·컨테이너·지게차·바이오캡슐 프롭 배치
    function buildCustomSectorShapeAndProps(room, group, rng) {
      if (room.isBossRoom) return;
      const hw = room.hw || room.half;
      const hd = room.hd || room.half;
      const blockMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.65, metalness: 0.35 });
      const trimMat = new THREE.MeshStandardMaterial({ color: 0x0284c7, emissive: 0x0369a1, emissiveIntensity: 0.5 });

      // 1. 비정형 방 구조물 조각 (외벽 스폰 구멍과 보급상자 동선을 전혀 막지 않도록 내측 14m 이상 이격 배치!)
      if (room.shapeType === "L_FACILITY") {
        const bw = 18, bd = 18;
        const bx = room.wx + 14;
        const bz = room.wz - 14;
        const lBlock = new THREE.Mesh(new THREE.BoxGeometry(bw, 4.0, bd), blockMat);
        lBlock.position.set(bx, 2.0, bz);
        lBlock.castShadow = true;
        group.add(lBlock);
        const lTrim = new THREE.Mesh(new THREE.BoxGeometry(bw + 0.3, 0.3, bd + 0.3), trimMat);
        lTrim.position.set(bx, 3.85, bz);
        group.add(lTrim);
        addWallCollider(bx, bz, bw, bd);
      } else if (room.shapeType === "OCTAGON_REACTOR") {
        // 중앙에 대형 원자로 코어 기둥을 배치하여 빙빙 돌며 싸우는 원형 카이팅 구도 형성
        const reactorGroup = new THREE.Group();
        const coreCyl = new THREE.Mesh(
          new THREE.CylinderGeometry(5.2, 5.8, 4.2, 12),
          new THREE.MeshStandardMaterial({ color: 0x0f172a, metalness: 0.7, roughness: 0.3 })
        );
        coreCyl.position.y = 2.1;
        reactorGroup.add(coreCyl);
        const glowRing = new THREE.Mesh(
          new THREE.TorusGeometry(5.6, 0.28, 8, 24),
          new THREE.MeshBasicMaterial({ color: 0x22d3ee })
        );
        glowRing.rotation.x = Math.PI / 2;
        glowRing.position.y = 2.4;
        reactorGroup.add(glowRing);
        reactorGroup.position.set(room.wx, 0, room.wz);
        group.add(reactorGroup);
        addWallCollider(room.wx, room.wz, 9.8, 9.8);
      } else if (room.shapeType === "CROSS_WAREHOUSE") {
        // 내측 4분면에 화물 격벽 베이를 배치하여 외벽 구멍은 열어두고 내부 십자(+) 교차로 전장 구성
        [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(c => {
          const cw = 11, cd = 11;
          const cx = room.wx + c[0] * 18;
          const cz = room.wz + c[1] * 18;
          const cMesh = new THREE.Mesh(new THREE.BoxGeometry(cw, 3.8, cd), blockMat);
          cMesh.position.set(cx, 1.9, cz);
          group.add(cMesh);
          addWallCollider(cx, cz, cw, cd);
        });
      }

      // 2. 다채로운 전술 환경 오브젝트 (서버 랙, 스틸 화물 컨테이너, 지게차)
      const propSpots = [
        { dx: -19, dz: -8, kind: "CONTAINER" },
        { dx: 19, dz: 8, kind: "SERVER_RACK" },
        { dx: -14, dz: 19, kind: "FORKLIFT" },
        { dx: 14, dz: -19, kind: "CONTAINER" },
        { dx: -24, dz: 4, kind: "FORKLIFT" },
        { dx: 24, dz: -4, kind: "SERVER_RACK" }
      ];

      propSpots.forEach((sp, idx) => {
        if (rng() > 0.82) return;
        const px = room.wx + sp.dx;
        const pz = room.wz + sp.dz;
        if (Math.abs(sp.dx) > hw - 10 || Math.abs(sp.dz) > hd - 10) return;
        if (isPointBlockedByWall(px, pz, 3.2, true)) return;

        if (sp.kind === "CONTAINER") {
          const cColors = [0x991b1b, 0x1e3a8a, 0x065f46, 0xb45309];
          const contGroup = new THREE.Group();
          const box = new THREE.Mesh(
            new THREE.BoxGeometry(7.2, 2.8, 3.2),
            new THREE.MeshStandardMaterial({ color: cColors[(room.index + idx) % cColors.length], roughness: 0.6, metalness: 0.35 })
          );
          box.position.y = 1.4;
          box.castShadow = true;
          contGroup.add(box);
          const stripe = new THREE.Mesh(
            new THREE.BoxGeometry(7.3, 0.22, 3.3),
            new THREE.MeshBasicMaterial({ color: 0xfacc15 })
          );
          stripe.position.y = 2.55;
          contGroup.add(stripe);
          contGroup.position.set(px, 0, pz);
          group.add(contGroup);
          addWallCollider(px, pz, 7.2, 3.2);
        } else if (sp.kind === "SERVER_RACK") {
          const rackGroup = new THREE.Group();
          const cab = new THREE.Mesh(
            new THREE.BoxGeometry(4.2, 3.1, 1.8),
            new THREE.MeshStandardMaterial({ color: 0x0f172a, metalness: 0.75, roughness: 0.3 })
          );
          cab.position.y = 1.55;
          rackGroup.add(cab);
          [-1.2, 0, 1.2].forEach(lx => {
            const led = new THREE.Mesh(
              new THREE.BoxGeometry(0.7, 2.4, 1.88),
              new THREE.MeshBasicMaterial({ color: lx === 0 ? 0x38bdf8 : 0x10b981 })
            );
            led.position.set(lx, 1.6, 0);
            rackGroup.add(led);
          });
          rackGroup.position.set(px, 0, pz);
          group.add(rackGroup);
          addWallCollider(px, pz, 4.2, 1.8);
        } else if (sp.kind === "FORKLIFT") {
          const fkGroup = new THREE.Group();
          const body = new THREE.Mesh(
            new THREE.BoxGeometry(2.8, 1.6, 2.0),
            new THREE.MeshStandardMaterial({ color: 0xeab308, roughness: 0.5 })
          );
          body.position.y = 0.8;
          fkGroup.add(body);
          const cage = new THREE.Mesh(
            new THREE.BoxGeometry(2.0, 1.2, 1.8),
            new THREE.MeshStandardMaterial({ color: 0x1e293b, wireframe: true })
          );
          cage.position.set(-0.2, 2.1, 0);
          fkGroup.add(cage);
          fkGroup.position.set(px, 0, pz);
          group.add(fkGroup);
          addWallCollider(px, pz, 2.8, 2.0);
        }
      });
    }

    // [v3.5] 10섹터 2단계: 중앙 보스 코어를 감싸는 생체 방어 파일런 3기 기립 (스쿼드 인원수 연동)
    function spawnSector10DefensePylons(room) {
      const activeSquadCount = (game.players || []).filter(p => p.role !== "EMPTY").length || 1;
      const squadScale = 1.0 + Math.max(0, activeSquadCount - 1) * 0.55;
      const pylonHp = Math.round(13500 * squadScale);
      const angles = [0, (2 * Math.PI) / 3, (4 * Math.PI) / 3];
      angles.forEach((ang, idx) => {
        const px = room.wx + Math.cos(ang) * 16.5;
        const pz = room.wz + Math.sin(ang) * 16.5;
        const pMesh = new THREE.Mesh(
          new THREE.CylinderGeometry(1.2, 1.6, 6.2, 12),
          new THREE.MeshStandardMaterial({ color: 0xbe123c, emissive: 0x9f1239, emissiveIntensity: 0.9 })
        );
        pMesh.position.set(px, 3.1, pz);
        entitiesGroup.add(pMesh);
        const pObj = { x: px, z: pz, hp: pylonHp, maxHp: pylonHp, mesh: pMesh, isPylon: true };
        game.bloodPylons.push(pObj);
        registerWorldSymbol(
          px, 4.4, pz,
          `🛡️방어파일런${idx + 1}[집중사격]`,
          "bg-rose-950/90 border-rose-500 text-rose-200",
          pObj, room.index
        );
      });
    }

    // 섹터 내부에서 벽·기둥·플레이어와 겹치지 않는 랜덤 수색 좌표를 찾는 함수
    function getSimRandom() {
      if (!game.simRng) game.simRng = createRNG((game.seed || 2026) + 777);
      return game.simRng();
    }

    function findRandomSafeMissionPos(room) {
      const margin = 12.0;
      const spanX = Math.max(16, ((room.hw || room.half) - margin) * 2);
      const spanZ = Math.max(16, ((room.hd || room.half) - margin) * 2);
      const anchorP = game.players[0] || game.players[mySlotIndex];

      for (let attempt = 0; attempt < 90; attempt++) {
        const rx = room.wx + (getSimRandom() - 0.5) * spanX;
        const rz = room.wz + (getSimRandom() - 0.5) * spanZ;
        if (isPointBlockedByWall(rx, rz, 3.0, false)) continue;
        // 기준 플레이어(P1)로부터 최소 15m 이상 떨어진 곳을 우선 선택하여 4인 화면 모두 100% 동일한 좌표 보장!
        if (attempt < 65 && anchorP && Math.hypot(rx - anchorP.x, rz - anchorP.z) < 16.0) continue;
        const nearOther = game.missionNodes.some(n => n.roomIndex === room.index && !n.done && Math.hypot(n.x - rx, n.z - rz) < 9.0);
        if (nearOther) continue;
        return { x: Math.round(rx * 10) / 10, z: Math.round(rz * 10) / 10 };
      }
      return { x: room.wx + (getSimRandom() > 0.5 ? 18 : -18), z: room.wz + (getSimRandom() > 0.5 ? 18 : -18) };
    }

    // 방위각 텍스트 안내 헬퍼 (예: "북동쪽 28m")
    function getCompassDirectionHint(fromX, fromZ, toX, toZ) {
      const dx = toX - fromX;
      const dz = toZ - fromZ;
      const dist = Math.round(Math.hypot(dx, dz));
      const deg = (Math.atan2(dx, -dz) * 180 / Math.PI + 360) % 360;
      const dirs = ["북(N)", "북동(NE)", "동(E)", "남동(SE)", "남(S)", "남서(SW)", "서(W)", "북서(NW)"];
      const dirStr = dirs[Math.round(deg / 45) % 8];
      return `${dirStr} ${dist}m`;
    }

    // 웨이브 방어 성공 시 해당 단계(stepOrder)의 미션 목표를 섹터 내 랜덤 위치에 출현시키는 함수!
    function spawnRandomMissionStepForRoom(room, stepOrder) {
      if (!room || room.isBossRoom) return;
      const pos = findRandomSafeMissionPos(room);
      room.activeMissionTargetPos = pos;

      // 출현 위치에 하늘로 솟구치는 신호 비콘 이펙트 생성
      const beaconMesh = new THREE.Mesh(
        new THREE.CylinderGeometry(0.35, 1.4, 16, 12),
        new THREE.MeshBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.55 })
      );
      beaconMesh.position.set(pos.x, 8.0, pos.z);
      effectsGroup.add(beaconMesh);
      game.particles.push({ mesh: beaconMesh, life: 2.2, maxLife: 2.2 });

      if (room.condType === "THERMITE") {
        const isTable = (stepOrder === 3);
        const mGroup = new THREE.Group();
        let holo = null, coreCone = null, tank = null, cap = null;
        if (isTable) {
          const desk = new THREE.Mesh(
            new THREE.BoxGeometry(3.2, 1.2, 2.2),
            new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.4 })
          );
          desk.position.y = 0.6;
          mGroup.add(desk);
          holo = new THREE.Mesh(
            new THREE.TorusGeometry(1.1, 0.14, 8, 24),
            new THREE.MeshBasicMaterial({ color: 0x38bdf8 })
          );
          holo.rotation.x = Math.PI / 2;
          holo.position.y = 1.65;
          mGroup.add(holo);
          coreCone = new THREE.Mesh(
            new THREE.OctahedronGeometry(0.65, 0),
            new THREE.MeshStandardMaterial({ color: 0x38bdf8, emissive: 0x0284c7, emissiveIntensity: 0.9 })
          );
          coreCone.position.y = 2.0;
          mGroup.add(coreCone);
        } else {
          tank = new THREE.Mesh(
            new THREE.CylinderGeometry(0.8, 0.8, 2.1, 14),
            new THREE.MeshStandardMaterial({ color: 0xf59e0b, emissive: 0xb45309, emissiveIntensity: 0.7 })
          );
          tank.position.y = 1.05;
          mGroup.add(tank);
          cap = new THREE.Mesh(
            new THREE.TorusGeometry(0.95, 0.14, 8, 18),
            new THREE.MeshBasicMaterial({ color: 0xfef08a })
          );
          cap.rotation.x = Math.PI / 2;
          cap.position.y = 0.25;
          mGroup.add(cap);
        }
        mGroup.position.set(pos.x, 0, pos.z);
        entitiesGroup.add(mGroup);
        const nodeObj = {
          roomIndex: room.index,
          kind: isTable ? "SYNTH_TABLE" : "CHEM_PART",
          stepOrder,
          x: pos.x, z: pos.z,
          done: false,
          holdTime: 0,
          mesh: mGroup,
          holo,
          coreCone,
          tank,
          cap
        };
        game.missionNodes.push(nodeObj);
        nodeObj.sym = registerWorldSymbol(
          pos.x, 2.9, pos.z,
          isTable ? "🔬테르밋합성기[F]" : `🧪화학원료#${stepOrder}[F]`,
          isTable ? "bg-sky-950/90 border-sky-400 text-sky-200" : "bg-amber-950/90 border-amber-400 text-amber-200",
          nodeObj, room.index
        );
      } else if (room.condType === "GENERATORS") {
        const gGroup = new THREE.Group();
        const base = new THREE.Mesh(
          new THREE.BoxGeometry(2.4, 1.4, 2.4),
          new THREE.MeshStandardMaterial({ color: 0x1e293b })
        );
        base.position.y = 0.7;
        gGroup.add(base);
        const turbine = new THREE.Mesh(
          new THREE.CylinderGeometry(0.95, 1.1, 2.5, 12),
          new THREE.MeshStandardMaterial({ color: 0x10b981, emissive: 0x047857, emissiveIntensity: 0.75 })
        );
        turbine.position.y = 1.9;
        gGroup.add(turbine);
        const coilRing = new THREE.Mesh(
          new THREE.TorusGeometry(1.25, 0.16, 8, 20),
          new THREE.MeshBasicMaterial({ color: 0x34d399 })
        );
        coilRing.rotation.x = Math.PI / 2;
        coilRing.position.y = 2.65;
        gGroup.add(coilRing);

        gGroup.position.set(pos.x, 0, pos.z);
        entitiesGroup.add(gGroup);
        const genNode = {
          roomIndex: room.index,
          kind: "GENERATOR",
          genIndex: stepOrder,
          stepOrder,
          x: pos.x, z: pos.z,
          done: false,
          holdTime: 0,
          mesh: gGroup,
          turbine,
          coilRing,
          coreMat: turbine.material
        };
        game.missionNodes.push(genNode);
        genNode.sym = registerWorldSymbol(
          pos.x, 3.3, pos.z,
          `⚡비상발전기#${stepOrder}[F]`,
          "bg-emerald-950/90 border-emerald-400 text-emerald-200",
          genNode, room.index
        );
      } else if (room.condType === "PAYLOAD") {
        const bGroup = new THREE.Group();
        if (stepOrder === 1) {
          const ped = new THREE.Mesh(
            new THREE.CylinderGeometry(1.1, 1.3, 0.6, 8),
            new THREE.MeshStandardMaterial({ color: 0x1e293b })
          );
          ped.position.y = 0.3;
          bGroup.add(ped);
          const crystal = new THREE.Mesh(
            new THREE.OctahedronGeometry(1.05, 0),
            new THREE.MeshStandardMaterial({ color: 0x38bdf8, emissive: 0x0284c7, emissiveIntensity: 0.9 })
          );
          crystal.position.y = 1.55;
          bGroup.add(crystal);
          bGroup.position.set(pos.x, 0, pos.z);
          entitiesGroup.add(bGroup);
          const bbNode = {
            roomIndex: room.index,
            kind: "BLACKBOX",
            stepOrder: 1,
            x: pos.x, z: pos.z,
            carrierId: null,
            done: false,
            mesh: bGroup,
            crystal
          };
          game.missionNodes.push(bbNode);
          bbNode.sym = registerWorldSymbol(
            pos.x, 2.9, pos.z,
            "📡블랙박스회수[F]",
            "bg-sky-950/90 border-sky-400 text-sky-200",
            bbNode, room.index
          );
        } else if (stepOrder === 2 && room.reqWaves >= 3) {
          // 중후반(4섹터+) 2단계: 🔐보안중계기 암호 해독
          const relay = new THREE.Mesh(
            new THREE.BoxGeometry(1.8, 2.4, 1.8),
            new THREE.MeshStandardMaterial({ color: 0x4f46e5, emissive: 0x312e81, emissiveIntensity: 0.85 })
          );
          relay.position.y = 1.2;
          bGroup.add(relay);
          bGroup.position.set(pos.x, 0, pos.z);
          entitiesGroup.add(bGroup);
          const relNode = {
            roomIndex: room.index,
            kind: "SECURITY_RELAY",
            stepOrder: 2,
            x: pos.x, z: pos.z,
            done: false,
            holdTime: 0,
            mesh: bGroup,
            relay
          };
          game.missionNodes.push(relNode);
          relNode.sym = registerWorldSymbol(
            pos.x, 3.2, pos.z,
            "🔐보안중계기해독[F]",
            "bg-indigo-950/90 border-indigo-400 text-indigo-200",
            relNode, room.index
          );
        } else {
          // 최종 단계: 섹터 내 무작위 위치에 업로드 송신 단말기가 활성화되어 그곳까지 운반!
          const tower = new THREE.Mesh(
            new THREE.CylinderGeometry(0.7, 1.2, 2.8, 10),
            new THREE.MeshStandardMaterial({ color: 0x0284c7, emissive: 0x0369a1, emissiveIntensity: 0.8 })
          );
          tower.position.y = 1.4;
          bGroup.add(tower);
          const dish = new THREE.Mesh(
            new THREE.TorusGeometry(1.3, 0.16, 8, 24),
            new THREE.MeshBasicMaterial({ color: 0x38bdf8 })
          );
          dish.rotation.x = Math.PI / 2;
          dish.position.y = 2.85;
          bGroup.add(dish);
          bGroup.position.set(pos.x, 0, pos.z);
          entitiesGroup.add(bGroup);
          const upNode = {
            roomIndex: room.index,
            kind: "UPLOAD_TERMINAL",
            stepOrder,
            x: pos.x, z: pos.z,
            done: false,
            holdTime: 0,
            mesh: bGroup,
            tower,
            dish
          };
          game.missionNodes.push(upNode);
          upNode.sym = registerWorldSymbol(
            pos.x, 3.5, pos.z,
            "🛰️업로드송신기[F]",
            "bg-cyan-950/90 border-cyan-400 text-cyan-200",
            upNode, room.index
          );
        }
      } else if (room.condType === "RADAR_UPLINK") {
        const rGroup = new THREE.Group();
        if (stepOrder === 1) {
          // 1단계: 📡 통신 배전반 (Main Breaker Console)
          const base = new THREE.Mesh(
            new THREE.BoxGeometry(2.6, 2.2, 1.4),
            new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.65, roughness: 0.35 })
          );
          base.position.y = 1.1;
          rGroup.add(base);
          const screen = new THREE.Mesh(
            new THREE.PlaneGeometry(1.6, 0.9),
            new THREE.MeshBasicMaterial({ color: 0x38bdf8 })
          );
          screen.position.set(0, 1.45, 0.71);
          rGroup.add(screen);
          const coilRing = new THREE.Mesh(
            new THREE.TorusGeometry(0.7, 0.08, 8, 20),
            new THREE.MeshBasicMaterial({ color: 0x67e8f9 })
          );
          coilRing.rotation.x = Math.PI / 2;
          coilRing.position.y = 2.4;
          rGroup.add(coilRing);
          rGroup.position.set(pos.x, 0, pos.z);
          entitiesGroup.add(rGroup);
          const nodeObj = {
            roomIndex: room.index,
            kind: "RADAR_CONSOLE",
            stepOrder: 1,
            x: pos.x, z: pos.z,
            done: false,
            holdTime: 0,
            mesh: rGroup,
            coilRing,
            screen
          };
          game.missionNodes.push(nodeObj);
          nodeObj.sym = registerWorldSymbol(
            pos.x, 3.2, pos.z,
            "📡통신배전반[F]",
            "bg-sky-950/90 border-sky-400 text-sky-200",
            nodeObj, room.index
          );
        } else if (stepOrder === 2) {
          // 2단계: 🛰️ 대형 파라볼라 안테나 (Parabolic Radar Dish)
          const mount = new THREE.Mesh(
            new THREE.CylinderGeometry(0.5, 1.4, 1.6, 8),
            new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.8, roughness: 0.3 })
          );
          mount.position.y = 0.8;
          rGroup.add(mount);
          const dish = new THREE.Mesh(
            new THREE.CylinderGeometry(2.2, 0.4, 0.6, 18),
            new THREE.MeshStandardMaterial({ color: 0x0284c7, metalness: 0.7, roughness: 0.25 })
          );
          dish.position.y = 2.4;
          dish.rotation.x = Math.PI / 4;
          rGroup.add(dish);
          const ring = new THREE.Mesh(
            new THREE.TorusGeometry(2.25, 0.12, 8, 24),
            new THREE.MeshBasicMaterial({ color: 0x38bdf8 })
          );
          ring.position.y = 2.5;
          ring.rotation.x = Math.PI / 4;
          rGroup.add(ring);
          rGroup.position.set(pos.x, 0, pos.z);
          entitiesGroup.add(rGroup);
          const nodeObj = {
            roomIndex: room.index,
            kind: "RADAR_DISH",
            stepOrder: 2,
            x: pos.x, z: pos.z,
            done: false,
            holdTime: 0,
            mesh: rGroup,
            dish,
            ring
          };
          game.missionNodes.push(nodeObj);
          nodeObj.sym = registerWorldSymbol(
            pos.x, 3.6, pos.z,
            "🛰️레이더안테나[F]",
            "bg-cyan-950/90 border-cyan-400 text-cyan-200",
            nodeObj, room.index
          );
        } else {
          // 3단계: 📶 고출력 위성 송신 비콘 타워 (Satellite Uplink Beacon)
          const tower = new THREE.Mesh(
            new THREE.CylinderGeometry(0.3, 0.9, 3.4, 10),
            new THREE.MeshStandardMaterial({ color: 0x1e3a8a, emissive: 0x1d4ed8, emissiveIntensity: 0.7 })
          );
          tower.position.y = 1.7;
          rGroup.add(tower);
          const halo = new THREE.Mesh(
            new THREE.TorusGeometry(1.4, 0.14, 8, 24),
            new THREE.MeshBasicMaterial({ color: 0x60a5fa })
          );
          halo.rotation.x = Math.PI / 2;
          halo.position.y = 3.4;
          rGroup.add(halo);
          rGroup.position.set(pos.x, 0, pos.z);
          entitiesGroup.add(rGroup);
          const nodeObj = {
            roomIndex: room.index,
            kind: "RADAR_BEACON",
            stepOrder: 3,
            x: pos.x, z: pos.z,
            done: false,
            holdTime: 0,
            mesh: rGroup,
            tower,
            halo
          };
          game.missionNodes.push(nodeObj);
          nodeObj.sym = registerWorldSymbol(
            pos.x, 4.0, pos.z,
            "📶위성주파수전송[F]",
            "bg-blue-950/90 border-blue-400 text-blue-200",
            nodeObj, room.index
          );
        }
      } else if (room.condType === "DECON_PURGE") {
        // ☣️ 오염 격리구역 에어로졸 정화 밸브 폐쇄
        const vGroup = new THREE.Group();
        const baseBox = new THREE.Mesh(
          new THREE.BoxGeometry(2.0, 1.4, 2.0),
          new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.7, roughness: 0.3 })
        );
        baseBox.position.y = 0.7;
        vGroup.add(baseBox);
        const pipe = new THREE.Mesh(
          new THREE.CylinderGeometry(0.45, 0.45, 1.8, 12),
          new THREE.MeshStandardMaterial({ color: 0x059669, metalness: 0.6, roughness: 0.3 })
        );
        pipe.position.y = 1.8;
        vGroup.add(pipe);
        const wheel = new THREE.Mesh(
          new THREE.TorusGeometry(0.85, 0.12, 8, 20),
          new THREE.MeshStandardMaterial({ color: 0xfacc15, emissive: 0xd97706, emissiveIntensity: 0.8 })
        );
        wheel.rotation.x = Math.PI / 2;
        wheel.position.y = 2.65;
        vGroup.add(wheel);
        vGroup.position.set(pos.x, 0, pos.z);
        entitiesGroup.add(vGroup);
        const deconNode = {
          roomIndex: room.index,
          kind: "DECON_VALVE",
          stepOrder,
          x: pos.x, z: pos.z,
          done: false,
          holdTime: 0,
          mesh: vGroup,
          wheel,
          pipe
        };
        game.missionNodes.push(deconNode);
        deconNode.sym = registerWorldSymbol(
          pos.x, 3.3, pos.z,
          `☣️정화밸브#${stepOrder}[F]`,
          "bg-emerald-950/90 border-emerald-400 text-emerald-200",
          deconNode, room.index
        );
      } else if (room.condType === "HIVE_NODES" || room.condType === "EXTERMINATE") {
        // 생체 신경절 또는 군락 증폭기가 랜덤 위치에서 솟아오름 -> 사격으로 찾아 파괴!
        const hGroup = new THREE.Group();
        const isExterm = room.condType === "EXTERMINATE";
        const core = new THREE.Mesh(
          new THREE.DodecahedronGeometry(1.55, 1),
          new THREE.MeshStandardMaterial({
            color: isExterm ? 0xf97316 : 0xe11d48,
            emissive: isExterm ? 0xc2410c : 0x9f1239,
            emissiveIntensity: 0.8
          })
        );
        core.position.y = 1.6;
        hGroup.add(core);
        const bioRing = new THREE.Mesh(
          new THREE.TorusGeometry(1.8, 0.2, 8, 18),
          new THREE.MeshBasicMaterial({ color: isExterm ? 0xfacc15 : 0xf43f5e })
        );
        bioRing.rotation.x = Math.PI / 2;
        bioRing.position.y = 0.35;
        hGroup.add(bioRing);

        hGroup.position.set(pos.x, 0, pos.z);
        entitiesGroup.add(hGroup);
        const podObj = {
          x: pos.x, z: pos.z,
          hp: 520 + room.index * 65,
          maxHp: 520 + room.index * 65,
          stepOrder,
          isMissionHive: true,
          roomIndex: room.index,
          timer: 9999,
          mesh: hGroup,
          coreMesh: core,
          bioRing
        };
        game.cystPods.push(podObj);
        podObj.sym = registerWorldSymbol(
          pos.x, 3.3, pos.z,
          isExterm ? `☣️군락증폭기#${stepOrder}(사격파괴)` : `🧬생체신경절#${stepOrder}(사격파괴)`,
          "bg-rose-950/90 border-rose-400 text-rose-200",
          podObj, room.index
        );
      }
    }

    // 외벽에 직접 박혀 있는 매립형 무기고 제작소(Wall-Recessed Armory Bunker) 생성
    function spawnArmoryVault(x, z, rotY, inNormX, inNormZ, roomIndex, startUnlocked) {
      const vGroup = new THREE.Group();
      vGroup.rotation.y = rotY || 0;

      // 1. 매립형 벙커 강철 외곽 프레임 & 후면 장갑판 (외벽 두께에 딱 맞게 매립!)
      const frameMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.78, roughness: 0.28 });
      const goldTrimMat = new THREE.MeshStandardMaterial({
        color: 0xfacc15,
        emissive: 0xb45309,
        emissiveIntensity: 0.75
      });

      const backWall = new THREE.Mesh(
        new THREE.BoxGeometry(6.6, 4.0, 0.55),
        new THREE.MeshStandardMaterial({ color: 0x0f172a, metalness: 0.6, roughness: 0.4 })
      );
      backWall.position.set(0, 2.0, -0.55);
      vGroup.add(backWall);

      const leftPillar = new THREE.Mesh(new THREE.BoxGeometry(0.75, 4.0, 1.85), frameMat);
      leftPillar.position.set(-3.0, 2.0, 0);
      const rightPillar = new THREE.Mesh(new THREE.BoxGeometry(0.75, 4.0, 1.85), frameMat);
      rightPillar.position.set(3.0, 2.0, 0);
      const topHeader = new THREE.Mesh(new THREE.BoxGeometry(6.8, 0.75, 2.0), frameMat);
      topHeader.position.set(0, 3.65, 0.05);
      vGroup.add(leftPillar, rightPillar, topHeader);

      const neonSign = new THREE.Mesh(new THREE.BoxGeometry(5.2, 0.28, 2.08), goldTrimMat);
      neonSign.position.set(0, 3.45, 0.08);
      vGroup.add(neonSign);

      // 2. 벽면 내부에 매립된 무기 거치대 & 전술 정비 콘솔
      const bench = new THREE.Mesh(
        new THREE.BoxGeometry(5.0, 1.05, 1.35),
        new THREE.MeshStandardMaterial({ color: 0x312e81, emissive: 0x1e1b4b, emissiveIntensity: 0.65, metalness: 0.5 })
      );
      bench.position.set(0, 0.55, 0.2);
      vGroup.add(bench);

      [-1.7, 0, 1.7].forEach(rx => {
        const rack = new THREE.Mesh(
          new THREE.BoxGeometry(1.15, 1.85, 0.35),
          new THREE.MeshStandardMaterial({ color: 0x0284c7, emissive: 0x0369a1, emissiveIntensity: 0.55 })
        );
        rack.position.set(rx, 2.15, -0.18);
        vGroup.add(rack);
      });

      const holoGun = new THREE.Mesh(
        new THREE.OctahedronGeometry(0.72, 0),
        new THREE.MeshBasicMaterial({ color: 0x38bdf8, wireframe: true })
      );
      holoGun.position.set(0, 2.15, 0.65);
      vGroup.add(holoGun);

      // 3. 벽 앞쪽 실내 바닥에 펼쳐진 반원형/직사각형 정비 구역 표시 링
      const zoneRing = new THREE.Mesh(
        new THREE.RingGeometry(3.2, 3.8, 32),
        new THREE.MeshBasicMaterial({
          color: startUnlocked ? 0x10b981 : 0xf59e0b,
          side: THREE.DoubleSide,
          transparent: true,
          opacity: 0.82
        })
      );
      zoneRing.rotation.x = -Math.PI / 2;
      zoneRing.position.set(0, 0.08, 0);
      vGroup.add(zoneRing);

      vGroup.position.set(x, 0, z);
      entitiesGroup.add(vGroup);

      const interactX = x + (inNormX || 0) * 1.6;
      const interactZ = z + (inNormZ || 0) * 1.6;

      // 상공으로 뻗어 오르는 황금빛 비콘 기둥 (상시 무기고 위치를 멀리서도 즉시 식별!)
      const beaconBeam = new THREE.Mesh(
        new THREE.CylinderGeometry(0.45, 1.55, 22, 12),
        new THREE.MeshBasicMaterial({ color: 0xfacc15, transparent: true, opacity: 0.42 })
      );
      beaconBeam.position.set(0, 11.0, 0);
      vGroup.add(beaconBeam);

      const vaultObj = {
        x: interactX,
        z: interactZ,
        wallX: x,
        wallZ: z,
        roomIndex,
        unlocked: true,
        activeInCalm: true,
        hacking: false,
        timer: 2.0,
        mesh: vGroup,
        zoneRing,
        holoGun,
        beaconBeam
      };
      game.armoryVaults.push(vaultObj);
      const sym = registerWorldSymbol(
        interactX, 4.2, interactZ,
        "🔧상시무기고[R]",
        "bg-indigo-950/95 border-amber-400 text-amber-200",
        vaultObj, roomIndex
      );
      vaultObj.sym = sym;
    }

    // [v3.2 개편] 무기고는 이동하거나 숨지 않고 고정된 자리에서 웨이브와 무관하게 상시 활성화!
    function relocateArmoryForCalmPhase(room) {
      if (!room) return;
      const v = game.armoryVaults.find(av => av.roomIndex === room.index);
      if (!v) return;
      v.activeInCalm = true;
      v.unlocked = true;
      if (v.mesh) {
        v.mesh.visible = !!room.unlocked;
      }
      if (v.sym) {
        v.sym.el.textContent = "🔧상시무기고[R]";
      }
    }

    function hideArmoriesDuringSurge() {
      // 무기고 상시 활성화 유지 (웨이브 중에도 비활성화되지 않음)
      game.armoryVaults.forEach(v => {
        const r = game.rooms[v.roomIndex];
        v.activeInCalm = true;
        if (v.mesh) v.mesh.visible = !!(r && r.unlocked);
      });
    }

    function isPlayerNearArmory(player) {
      if (!player) return false;
      return game.armoryVaults.some(v => {
        const r = game.rooms[v.roomIndex];
        const isAvail = v.unlocked && r && r.unlocked;
        return isAvail && Math.hypot(v.x - player.x, v.z - player.z) <= 6.8;
      });
    }

    function spawnDeconStation(x, z, roomIndex) {
      const dGroup = new THREE.Group();
      const pillar = new THREE.Mesh(
        new THREE.CylinderGeometry(1.4, 1.5, 2.2, 16),
        new THREE.MeshStandardMaterial({ color: 0x0f766e, emissive: 0x115e59, emissiveIntensity: 0.5 })
      );
      pillar.position.y = 1.1;
      dGroup.add(pillar);

      const crossMat = new THREE.MeshBasicMaterial({ color: 0x4ade80 });
      const crossV = new THREE.Mesh(new THREE.BoxGeometry(0.42, 1.4, 0.42), crossMat);
      crossV.position.y = 2.95;
      const crossH = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.42, 0.42), crossMat);
      crossH.position.y = 2.95;
      dGroup.add(crossV, crossH);

      dGroup.position.set(x, 0, z);
      entitiesGroup.add(dGroup);
      const deconObj = { x, z, roomIndex, charges: 2, mesh: dGroup };
      game.deconStations.push(deconObj);
      registerWorldSymbol(
        x, 3.85, z,
        "🏥치료소[F]",
        "bg-teal-950/90 border-teal-400 text-teal-200",
        deconObj, roomIndex
      );
    }

    function addWallCollider(x, z, w, d) {
      game.obstacles.push({ x, z, hw: w / 2, hd: d / 2 });
    }

