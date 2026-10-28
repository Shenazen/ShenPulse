"use strict";
// Unity Relay's documented binary protocol, over its reliable TLS WebSocket endpoint.
const crypto = require("node:crypto");
const { EventEmitter } = require("node:events");
const { WebSocket } = require("ws");
const PROJECT_ID = "9843f4c0-474c-45ce-b36c-2140b471f837"; // Same ShenPulse project as Color Strike.
const MAX_MESSAGE = 8 * 1024 * 1024, CHUNK = 1386;
const header = type => Buffer.from([0xda, 0x72, 0, type]);
class UnityRelay extends EventEmitter {
  constructor({ projectId = PROJECT_ID, fetchImpl = fetch, WebSocketImpl = WebSocket } = {}) {
    super(); this.projectId = projectId; this.fetch = fetchImpl; this.WebSocketImpl = WebSocketImpl;
    this.pending = new Map(); this.pendingBytes = 0; this.closed = false; this.peers = new Set(); this.nextId = crypto.randomBytes(4).readUInt32BE();
  }
  async api(route, body, auth = false) {
    const response = await this.fetch(auth ? "https://player-auth.services.api.unity.com/v1/authentication/anonymous" : "https://relay-allocations.services.api.unity.com/v1/" + route, {
      method: "POST", headers: auth ? { ProjectId: this.projectId, UnityEnvironment: "production", "Content-Type": "application/json" } : { Authorization: "Bearer " + this.token, "Content-Type": "application/json" },
      body: JSON.stringify(body), signal: AbortSignal.timeout(15000)
    });
    const payload = await response.json();
    if (!response.ok) throw Error("Le service multijoueur Unity est indisponible (" + response.status + "). Réessayez.");
    return payload;
  }
  async open(code = "") {
    this.token = (await this.api("", {}, true)).idToken;
    if (this.closed) throw Error("Session multijoueur arrêtée.");
    const result = await this.api(code ? "join" : "allocate", code ? { joinCode: code } : { maxConnections: 3, region: "europe-west4" });
    const allocation = result.data.allocation, endpoint = allocation.serverEndpoints.find(e => e.connectionType === "wss" && e.secure && e.reliable);
    if (!endpoint || !/^[a-z0-9.-]+[.]relay[.]uf[.]unity3d[.]com$/i.test(endpoint.host)) throw Error("Le relais sécurisé du jeu est indisponible.");
    this.allocation = allocation; this.id = Buffer.from(allocation.allocationIdBytes, "base64"); this.idHex = this.id.toString("hex");
    if (this.closed) throw Error("Session multijoueur arrêtée.");
    const socket = new this.WebSocketImpl("wss://" + endpoint.host + ":" + endpoint.port, { maxPayload: 65536, perMessageDeflate: false, handshakeTimeout: 15000 });
    this.socket = socket;
    socket.on("error", error => this.emit("failure", error));
    socket.on("close", () => { if (!this.closed) this.emit("failure", Error("Connexion multijoueur interrompue.")); });
    socket.on("message", bytes => this.receive(Buffer.from(bytes)));
    await this.wait("open", () => {}, socket);
    const data = Buffer.from(allocation.connectionData, "base64"), bind = Buffer.alloc(8 + data.length);
    header(0).copy(bind); bind[7] = data.length; data.copy(bind, 8);
    await this.wait("bound", () => socket.send(Buffer.concat([bind, crypto.createHmac("sha256", Buffer.from(allocation.key, "base64")).update(bind).digest()])));
    if (code) {
      const target = Buffer.from(allocation.hostConnectionData, "base64");
      await this.wait("accepted", () => socket.send(Buffer.concat([header(3), this.id, Buffer.from([target.length]), target])));
    } else this.code = (await this.api("joincode", { allocationId: allocation.allocationId })).data.joinCode;
    this.ping = setInterval(() => {
      if (socket.readyState === 1) socket.send(Buffer.concat([header(2), this.id, Buffer.alloc(2)]));
      const now = Date.now(); for (const [key, item] of this.pending) if (item.until < now) { this.pendingBytes -= item.size; this.pending.delete(key); this.emit("failure", Error("Un transfert multijoueur a expiré.")); }
    }, 2000); this.ping.unref();
    return this.code || code;
  }
  wait(event, start, emitter = this) {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => done(Error("Le relais multijoueur ne répond pas.")), 15000);
      const done = (error, value) => { clearTimeout(timer); emitter.off(event, ok); emitter.off("error", fail); this.off("failure", fail); error ? reject(error) : resolve(value); };
      const ok = value => done(null, value), fail = error => done(error);
      emitter.once(event, ok); emitter.once("error", fail); this.once("failure", fail);
      try { start(); } catch (error) { done(error); }
    });
  }
  receive(packet) {
    if (packet.length < 4 || packet.readUInt16BE() !== 0xda72 || packet[2] !== 0) return;
    const type = packet[3];
    if (type === 1) return this.emit("bound");
    if (type === 6 && packet.length === 36) {
      this.host = packet.subarray(4, 20).toString("hex"); this.peers.add(this.host); return this.emit("accepted", this.host);
    }
    if (type === 9 && packet.length === 36) {
      const peer = packet.subarray(4, 20).toString("hex"); this.peers.delete(peer); return this.emit("left", peer);
    }
    if (type === 12) return this.emit("failure", Error("Le relais multijoueur a refusé la connexion."));
    if (type !== 10 || packet.length < 52 || !packet.subarray(20, 36).equals(this.id) || packet.readUInt16BE(36) !== packet.length - 38) return;
    const peer = packet.subarray(4, 20).toString("hex"), data = packet.subarray(38);
    if (data.toString("ascii", 0, 4) !== "SPNT" || data[4] !== 1 || data[5] > 1) return;
    const id = data.readUInt32BE(6), index = data.readUInt16BE(10), total = data.readUInt16BE(12);
    if (!total || total > Math.ceil(MAX_MESSAGE / CHUNK) || index >= total || data.length > 1400) return;
    const key = peer + ":" + id; let item = this.pending.get(key);
    if (!item) { if (this.pending.size >= 16) return; item = { chunks: [], count: 0, total, binary: data[5] === 1, size: 0, until: Date.now() + 30000 }; this.pending.set(key, item); }
    if (item.total !== total || item.binary !== (data[5] === 1) || item.chunks[index]) return;
    const chunk = Buffer.from(data.subarray(14)); item.chunks[index] = chunk; item.count++; item.size += chunk.length; this.pendingBytes += chunk.length;
    if (item.size > MAX_MESSAGE || this.pendingBytes > MAX_MESSAGE * 2) { this.pendingBytes -= item.size; this.pending.delete(key); return; }
    this.peers.add(peer);
    if (item.count === total) { this.pendingBytes -= item.size; this.pending.delete(key); this.emit("payload", peer, Buffer.concat(item.chunks), item.binary); }
  }
  async send(peer, data, binary = false) {
    const bytes = Buffer.isBuffer(data) ? data : Buffer.from(String(data));
    if (!/^[0-9a-f]{32}$/.test(peer) || bytes.length > MAX_MESSAGE || !this.peers.has(peer)) throw Error("Destinataire multijoueur indisponible.");
    const total = Math.max(1, Math.ceil(bytes.length / CHUNK)), id = this.nextId = (this.nextId + 1) >>> 0;
    for (let index = 0; index < total; index++) {
      if (this.closed || this.socket?.readyState !== 1) throw Error("Connexion multijoueur arrêtée.");
      const fragment = Buffer.alloc(14); fragment.write("SPNT"); fragment[4] = 1; fragment[5] = binary ? 1 : 0; fragment.writeUInt32BE(id, 6); fragment.writeUInt16BE(index, 10); fragment.writeUInt16BE(total, 12);
      const content = Buffer.concat([fragment, bytes.subarray(index * CHUNK, (index + 1) * CHUNK)]), length = Buffer.alloc(2); length.writeUInt16BE(content.length);
      await new Promise((resolve, reject) => this.socket.send(Buffer.concat([header(10), this.id, Buffer.from(peer, "hex"), length, content]), error => error ? reject(error) : resolve()));
    }
  }
  close() {
    this.closed = true; clearInterval(this.ping); this.pending.clear(); this.pendingBytes = 0; this.token = "";
    if (this.socket?.readyState === 1) { this.socket.send(Buffer.concat([header(11), this.id])); this.socket.close(); }
    else this.socket?.terminate();
  }
}
module.exports = { UnityRelay, PROJECT_ID };
