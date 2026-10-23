/**
 * =========================================================================
 * BOXHEAD: THE CORE v3.1 — WebSocket Multiplayer Protocol (backend/protocol.js)
 * =========================================================================
 */
"use strict";

const PACKET_TYPES = {
  // Lobby & Room Management
  JOIN_LOBBY: "JOIN_LOBBY",
  ASSIGN_SLOT: "ASSIGN_SLOT",
  UPDATE_NAME: "UPDATE_NAME",
  LOBBY_STATE: "LOBBY_STATE",
  ROOM_FULL: "ROOM_FULL",
  KICK_PLAYER: "KICK_PLAYER",
  KICKED: "KICKED",
  TOGGLE_SLOT_ROLE: "TOGGLE_SLOT_ROLE",

  // Session Lifecycle
  START_GAME: "START_GAME",
  RETURN_LOBBY: "RETURN_LOBBY",

  // Real-Time 4-Player In-Game Co-op Sync
  PLAYER_STATE: "PLAYER_STATE",
  REMOTE_FIRE: "REMOTE_FIRE",
  REMOTE_SKILL: "REMOTE_SKILL",
  WORLD_SNAPSHOT: "WORLD_SNAPSHOT",
  REVIVE_SYNC: "REVIVE_SYNC",
  MISSION_SYNC: "MISSION_SYNC",
  PING: "PING",
  PONG: "PONG"
};

const SQUAD_COLORS = [0x3b82f6, 0x10b981, 0xf59e0b, 0xec4899];
const DEFAULT_AI_NAMES = ["HOST_P1", "ALPHA_AI", "BRAVO_AI", "CHARLIE_AI"];

function createDefaultSlots() {
  return [
    { id: 0, name: "HOST_P1", role: "LOCAL", ready: true, color: SQUAD_COLORS[0] },
    { id: 1, name: "EMPTY_2", role: "EMPTY", ready: false, color: SQUAD_COLORS[1] },
    { id: 2, name: "EMPTY_3", role: "EMPTY", ready: false, color: SQUAD_COLORS[2] },
    { id: 3, name: "EMPTY_4", role: "EMPTY", ready: false, color: SQUAD_COLORS[3] }
  ];
}

module.exports = {
  PACKET_TYPES,
  SQUAD_COLORS,
  DEFAULT_AI_NAMES,
  createDefaultSlots
};
