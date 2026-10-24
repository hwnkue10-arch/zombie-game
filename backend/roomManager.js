/**
 * =========================================================================
 * BOXHEAD: THE CORE v3.3 — Co-op Squad Room Manager (backend/roomManager.js)
 * Manages 4-player slots, Host authority, Kick system, Seed sync & State relay
 * =========================================================================
 */
"use strict";

const { PACKET_TYPES, DEFAULT_AI_NAMES, createDefaultSlots } = require("./protocol");

class RoomManager {
  constructor() {
    this.slots = createDefaultSlots();
    this.clients = new Map(); // client -> { slotId, name, joinedAt }
    this.gameRunning = false;
    this.currentSeed = 2026;
    this.sessionConfig = {
      pacing: "marathon",
      totalRooms: 10,
      collapseChance: 0.7,
      friendlyFire: true,
      reviveDuration: 8.0
    };
  }

  getPublicSlots() {
    return this.slots.map(s => ({
      id: s.id,
      name: s.name,
      role: s.role,
      ready: s.ready,
      color: s.color
    }));
  }

  sendTo(client, payload) {
    try {
      if (client && client.readyState === 1) {
        client.send(JSON.stringify(payload));
      }
    } catch (e) {}
  }

  broadcast(payload, excludeClient = null) {
    const raw = JSON.stringify(payload);
    for (const [client] of this.clients.entries()) {
      if (client !== excludeClient && client.readyState === 1) {
        try {
          client.send(raw);
        } catch (e) {}
      }
    }
  }

  broadcastLobbyState() {
    this.broadcast({
      type: PACKET_TYPES.LOBBY_STATE,
      slots: this.getPublicSlots(),
      gameRunning: this.gameRunning
    });
  }

  findAvailableSlot() {
    // Check if Slot 0 (Host) is unoccupied by a live socket
    const occupiedSlots = new Set();
    for (const info of this.clients.values()) {
      occupiedSlots.add(info.slotId);
    }
    for (let i = 0; i < 4; i++) {
      if (!occupiedSlots.has(i)) return i;
    }
    return -1;
  }

  handleJoinLobby(client, msg) {
    const cleanName = String(msg.name || "").trim().slice(0, 12);
    const clientId = msg.clientId || null;
    let slotId = -1;

    // 1. If this clientId was previously connected to a slot, reclaim that slot (reconnect on refresh)
    if (clientId) {
      for (const [peer, info] of this.clients.entries()) {
        if (info.clientId === clientId && peer !== client) {
          slotId = info.slotId;
          try { peer.close(); } catch (e) {}
          this.clients.delete(peer);
          break;
        }
      }
    }

    // 2. If no slot reclaimed and this is the host candidate (localhost/P1), claim Slot 0 if open
    if (slotId === -1 && msg.isHostCandidate) {
      let slot0Occupied = false;
      for (const info of this.clients.values()) {
        if (info.slotId === 0) { slot0Occupied = true; break; }
      }
      if (!slot0Occupied) {
        slotId = 0;
      }
    }

    // 3. Otherwise find first available slot
    if (slotId === -1) {
      const existing = this.clients.get(client);
      slotId = existing ? existing.slotId : this.findAvailableSlot();
    }

    if (slotId === -1) {
      this.sendTo(client, {
        type: PACKET_TYPES.ROOM_FULL,
        message: "방 정원 초과 (4/4 MAN FULL)"
      });
      return;
    }

    const finalName = cleanName || (slotId === 0 ? "HOST_P1" : `PLAYER_${slotId + 1}`);
    this.clients.set(client, { slotId, name: finalName, clientId, joinedAt: Date.now() });

    this.slots[slotId].name = finalName;
    this.slots[slotId].role = slotId === 0 ? "LOCAL" : "REMOTE";
    this.slots[slotId].ready = true;

    this.sendTo(client, {
      type: PACKET_TYPES.ASSIGN_SLOT,
      slotId,
      isHost: slotId === 0
    });

    console.log(`[RoomManager] Player '${finalName}' joined Slot P${slotId + 1} (Connected: ${this.clients.size}/4)`);
    this.broadcastLobbyState();
  }

  handleUpdateName(client, msg) {
    const info = this.clients.get(client);
    if (!info) return;
    const cleanName = String(msg.name || "").trim().slice(0, 12);
    if (!cleanName) return;
    info.name = cleanName;
    this.slots[info.slotId].name = cleanName;
    console.log(`[RoomManager] Slot P${info.slotId + 1} changed nickname to '${cleanName}'`);
    this.broadcastLobbyState();
  }

  handleKickPlayer(client, msg) {
    const sender = this.clients.get(client);
    if (!sender || sender.slotId !== 0) return; // Only Host (P1) can kick

    const targetSlot = parseInt(msg.slotId, 10);
    if (isNaN(targetSlot) || targetSlot <= 0 || targetSlot >= 4) return;

    for (const [peer, info] of this.clients.entries()) {
      if (info.slotId === targetSlot) {
        this.sendTo(peer, { type: PACKET_TYPES.KICKED });
        this.clients.delete(peer);
        try { peer.close(); } catch (e) {}
        break;
      }
    }

    this.slots[targetSlot].role = "EMPTY";
    this.slots[targetSlot].name = `EMPTY_${targetSlot + 1}`;
    console.log(`[RoomManager] Host kicked Slot P${targetSlot + 1}`);
    this.broadcastLobbyState();
  }

  handleToggleSlotRole(client, msg) {
    const sender = this.clients.get(client);
    if (!sender || sender.slotId !== 0) return;
    const targetSlot = parseInt(msg.slotId, 10);
    if (isNaN(targetSlot) || targetSlot <= 0 || targetSlot >= 4) return;
    if (this.slots[targetSlot].role === "REMOTE") return;
    this.slots[targetSlot].role = this.slots[targetSlot].role === "AI" ? "EMPTY" : "AI";
    this.slots[targetSlot].name = this.slots[targetSlot].role === "AI" ? DEFAULT_AI_NAMES[targetSlot] : `EMPTY_${targetSlot + 1}`;
    this.broadcastLobbyState();
  }

  handleStartGame(client, msg) {
    this.gameRunning = true;
    this.currentSeed = msg.seed || Math.floor(1000 + Math.random() * 9000);
    this.sessionConfig = {
      pacing: msg.pacing || "marathon",
      totalRooms: msg.totalRooms || 10,
      collapseChance: msg.collapseChance ?? 0.7,
      friendlyFire: msg.friendlyFire ?? true,
      reviveDuration: msg.reviveDuration || 8.0
    };

    console.log(`[RoomManager] Expedition started! Seed: #${this.currentSeed} | Rooms: ${this.sessionConfig.totalRooms}`);
    this.broadcast({
      type: PACKET_TYPES.START_GAME,
      seed: this.currentSeed,
      ...this.sessionConfig,
      slots: this.getPublicSlots()
    }, client);
  }

  handleMessage(client, rawData) {
    let msg;
    try {
      msg = JSON.parse(rawData);
    } catch (e) {
      return;
    }
    if (!msg || !msg.type) return;

    switch (msg.type) {
      case PACKET_TYPES.JOIN_LOBBY:
        this.handleJoinLobby(client, msg);
        break;
      case PACKET_TYPES.UPDATE_NAME:
        this.handleUpdateName(client, msg);
        break;
      case PACKET_TYPES.KICK_PLAYER:
        this.handleKickPlayer(client, msg);
        break;
      case PACKET_TYPES.TOGGLE_SLOT_ROLE:
        this.handleToggleSlotRole(client, msg);
        break;
      case PACKET_TYPES.START_GAME:
        this.handleStartGame(client, msg);
        break;
      case PACKET_TYPES.PLAYER_STATE:
      case PACKET_TYPES.REMOTE_FIRE:
      case PACKET_TYPES.REMOTE_SKILL:
      case PACKET_TYPES.WORLD_SNAPSHOT:
      case PACKET_TYPES.REVIVE_SYNC:
      case PACKET_TYPES.MISSION_SYNC:
        this.broadcast(msg, client);
        break;
      case PACKET_TYPES.PING:
        this.sendTo(client, { type: PACKET_TYPES.PONG, t: msg.t });
        break;
      default:
        break;
    }
  }

  handleDisconnect(client) {
    const info = this.clients.get(client);
    if (!info) return;
    this.clients.delete(client);

    const { slotId, name } = info;
    if (slotId === 0) {
      this.slots[0].name = "HOST_P1";
      this.slots[0].role = "LOCAL";
    } else {
      this.slots[slotId].name = `EMPTY_${slotId + 1}`;
      this.slots[slotId].role = "EMPTY";
    }
    console.log(`[RoomManager] Player '${name}' (P${slotId + 1}) disconnected. Slot reverted to ${this.slots[slotId].role}.`);
    this.broadcastLobbyState();
  }
}

module.exports = { RoomManager };
