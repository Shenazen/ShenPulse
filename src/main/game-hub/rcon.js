"use strict";

const net = require("node:net");

/** Encode le cadrage et les terminateurs binaires RCON historiques. */
function rconPacket(requestId, type, body) {
  const payload = Buffer.from(`${body}\0\0`, "utf8");
  const packet = Buffer.alloc(12 + Buffer.byteLength(body, "utf8") + 2);
  packet.writeInt32LE(payload.length + 8, 0);
  packet.writeInt32LE(requestId, 4);
  packet.writeInt32LE(type, 8);
  payload.copy(packet, 12);
  return packet;
}

/** Attend un paquet complet et conserve les octets restants. */
function readRconPacket(buffer) {
  if (buffer.length < 4) return null;
  const length = buffer.readInt32LE(0);
  if (buffer.length < length + 4) return null;
  return {
    length,
    requestId: buffer.readInt32LE(4),
    type: buffer.readInt32LE(8),
    body: buffer.subarray(12, length + 2).toString("utf8"),
    remainder: buffer.subarray(length + 4)
  };
}

/** Authentification puis commande corrélée, avec fermeture du socket. */
function rconRequest(connector, password, command, { assertAccess = () => {} } = {}) {
  assertAccess();
  if (!password) return Promise.reject(new Error("Mot de passe RCON requis."));
  return new Promise((resolve, reject) => {
    const socket = net.createConnection({
      host: connector.host || "127.0.0.1",
      port: Number(connector.port || 25575),
      timeout: Number(connector.timeoutMs || 5000)
    });
    let phase = "auth";
    let buffer = Buffer.alloc(0);
    const cleanup = () => socket.destroy();
    socket.on("connect", () => {
      try { assertAccess(); socket.write(rconPacket(1, 3, password)); }
      catch (error) { cleanup(); reject(error); }
    });
    socket.on("data", (chunk) => {
      buffer = Buffer.concat([buffer, chunk]);
      let packet;
      while ((packet = readRconPacket(buffer))) {
        buffer = packet.remainder;
        if (phase === "auth") {
          if (packet.requestId === -1) {
            cleanup();
            reject(new Error("Authentification RCON refusée."));
            return;
          }
          if (packet.requestId === 1) {
            phase = "command";
            try { assertAccess(); }
            catch (error) { cleanup(); reject(error); return; }
            socket.write(rconPacket(2, 2, command));
          }
        } else if (packet.requestId === 2) {
          cleanup();
          resolve({ status: "success", message: packet.body });
          return;
        }
      }
    });
    socket.on("timeout", () => {
      cleanup();
      reject(new Error("Délai RCON dépassé."));
    });
    socket.on("error", reject);
  });
}

module.exports = { rconPacket, readRconPacket, rconRequest };
