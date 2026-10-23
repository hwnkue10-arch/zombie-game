/**
 * =========================================================================
 * BOXHEAD: THE CORE v3.1 — Hamachi Local Co-op Server (backend/server.js)
 * - Serves `frontend/` static files over HTTP on port 3000
 * - Hosts 4-Player WebSocket server on port 3000
 * - Works with `express` + `ws` (via `npm install`) AND includes a built-in
 *   native Node.js HTTP + RFC-6455 WebSocket fallback so `node backend/server.js`
 *   runs immediately even without `node_modules`!
 * =========================================================================
 */
"use strict";

const http = require("http");
const fs = require("fs");
const path = require("path");
const os = require("os");
const crypto = require("crypto");
const { RoomManager } = require("./roomManager");

const PORT = parseInt(process.env.PORT || "3000", 10);
const HOST = process.env.HOST || "0.0.0.0";
const FRONTEND_DIR = path.resolve(__dirname, "../frontend");

const roomManager = new RoomManager();

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon"
};

function handleHttpRequest(req, res) {
  const safeUrl = (req.url || "/").split("?")[0];

  if (safeUrl === "/api/status") {
    res.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
    res.end(JSON.stringify({
      status: "ok",
      version: "3.1.0",
      gameRunning: roomManager.gameRunning,
      connectedClients: roomManager.clients.size,
      slots: roomManager.getPublicSlots()
    }));
    return;
  }

  let relPath = safeUrl === "/" ? "/index.html" : safeUrl;
  const filePath = path.normalize(path.join(FRONTEND_DIR, relPath));

  if (!filePath.startsWith(FRONTEND_DIR)) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }

  fs.readFile(filePath, (err, content) => {
    if (err) {
      res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("404 Not Found: " + relPath);
      return;
    }
    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, {
      "Content-Type": MIME_TYPES[ext] || "application/octet-stream",
      "Cache-Control": "no-cache"
    });
    res.end(content);
  });
}

const server = http.createServer(handleHttpRequest);

// Attach `ws` package if installed, otherwise use native RFC-6455 WebSocket implementation
let attachedWsLibrary = false;
try {
  const WebSocket = require("ws");
  const wss = new WebSocket.Server({ server });
  wss.on("connection", (ws) => {
    ws.on("message", (data) => roomManager.handleMessage(ws, data.toString()));
    ws.on("close", () => roomManager.handleDisconnect(ws));
    ws.on("error", () => roomManager.handleDisconnect(ws));
  });
  attachedWsLibrary = true;
} catch (e) {
  // Built-in Zero-Dependency RFC-6455 WebSocket Fallback
  server.on("upgrade", (req, socket) => {
    const key = req.headers["sec-websocket-key"];
    if (!key) {
      socket.destroy();
      return;
    }
    const accept = crypto
      .createHash("sha1")
      .update(key + "258EAFA5-E914-47DA-95CA-C5AB0DC85B11", "binary")
      .digest("base64");

    socket.write(
      "HTTP/1.1 101 Switching Protocols\r\n" +
      "Upgrade: websocket\r\n" +
      "Connection: Upgrade\r\n" +
      `Sec-WebSocket-Accept: ${accept}\r\n\r\n`
    );

    const clientWrapper = {
      readyState: 1,
      send(str) {
        if (this.readyState !== 1) return;
        const payload = Buffer.from(str, "utf8");
        const len = payload.length;
        let header;
        if (len < 126) {
          header = Buffer.alloc(2);
          header[0] = 0x81;
          header[1] = len;
        } else if (len < 65536) {
          header = Buffer.alloc(4);
          header[0] = 0x81;
          header[1] = 126;
          header.writeUInt16BE(len, 2);
        } else {
          header = Buffer.alloc(10);
          header[0] = 0x81;
          header[1] = 127;
          header.writeBigUInt64BE(BigInt(len), 2);
        }
        try {
          socket.write(Buffer.concat([header, payload]));
        } catch (err) {}
      },
      close() {
        this.readyState = 3;
        try { socket.end(); } catch (err) {}
      }
    };

    let buffer = Buffer.alloc(0);
    socket.on("data", (chunk) => {
      buffer = Buffer.concat([buffer, chunk]);
      while (buffer.length >= 2) {
        const firstByte = buffer[0];
        const secondByte = buffer[1];
        const opcode = firstByte & 0x0f;
        const isMasked = (secondByte & 0x80) !== 0;
        let payloadLen = secondByte & 0x7f;
        let offset = 2;

        if (opcode === 0x8) {
          clientWrapper.readyState = 3;
          roomManager.handleDisconnect(clientWrapper);
          socket.end();
          return;
        }
        if (payloadLen === 126) {
          if (buffer.length < 4) return;
          payloadLen = buffer.readUInt16BE(2);
          offset = 4;
        } else if (payloadLen === 127) {
          if (buffer.length < 10) return;
          payloadLen = Number(buffer.readBigUInt64BE(2));
          offset = 10;
        }

        const maskLen = isMasked ? 4 : 0;
        if (buffer.length < offset + maskLen + payloadLen) return;

        let maskKey = null;
        if (isMasked) {
          maskKey = buffer.slice(offset, offset + 4);
          offset += 4;
        }
        const dataBuf = Buffer.from(buffer.slice(offset, offset + payloadLen));
        buffer = buffer.slice(offset + payloadLen);

        if (isMasked && maskKey) {
          for (let i = 0; i < dataBuf.length; i++) {
            dataBuf[i] ^= maskKey[i % 4];
          }
        }
        if (opcode === 0x1) {
          roomManager.handleMessage(clientWrapper, dataBuf.toString("utf8"));
        }
      }
    });

    socket.on("close", () => {
      clientWrapper.readyState = 3;
      roomManager.handleDisconnect(clientWrapper);
    });
    socket.on("error", () => {
      clientWrapper.readyState = 3;
      roomManager.handleDisconnect(clientWrapper);
    });
  });
}

function getNetworkAddresses() {
  const nets = os.networkInterfaces();
  const list = [];
  for (const name of Object.keys(nets)) {
    for (const net of nets[name] || []) {
      if (net.family === "IPv4" && !net.internal) {
        const isHamachi = net.address.startsWith("25.");
        list.push({ name, address: net.address, isHamachi });
      }
    }
  }
  return list;
}

server.listen(PORT, HOST, () => {
  const addrs = getNetworkAddresses();
  console.log("===================================================================");
  console.log(" 🚀 BOXHEAD: THE CORE v3.1 — HAMACHI 4-PLAYER CO-OP SERVER READY");
  console.log("===================================================================");
  console.log(` • WebSocket Engine : ${attachedWsLibrary ? "ws (Node Package)" : "Native RFC-6455 Built-in Engine"}`);
  console.log(` • Host (방장 접속) : http://localhost:${PORT}`);
  addrs.forEach(a => {
    const tag = a.isHamachi ? "★ 하마치(Hamachi) IPv4" : `LAN (${a.name})`;
    console.log(` • ${tag} : http://${a.address}:${PORT}  (WS: ws://${a.address}:${PORT})`);
  });
  console.log("===================================================================");
});
