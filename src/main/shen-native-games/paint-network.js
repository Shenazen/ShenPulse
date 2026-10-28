"use strict";
const http = require("node:http"), crypto = require("node:crypto");
const { WebSocketServer } = require("ws");
const { UnityRelay } = require("./unity-relay");
function validLicence(value, key, now = Date.now()) {
  try {
    const [body, signature] = String(value).split("."), bytes = Buffer.from(body, "base64url"), payload = JSON.parse(bytes);
    return payload.game === "shenpaint" && payload.exp > now / 1000 && payload.iat <= now / 1000 + 10 && payload.exp - payload.iat <= 120 &&
      crypto.verify(null, bytes, crypto.createPublicKey(key), Buffer.from(signature, "base64url"));
  } catch { return false; }
}
class PaintNetwork {
  constructor({ credentials, assertAccess, port = 58534, createRelay = () => new UnityRelay() }) {
    this.credentials = credentials; this.assertAccess = assertAccess; this.port = port; this.createRelay = createRelay; this.clients = new Set();
  }
  async start() {
    this.assertAccess(); this.server = http.createServer((_req, res) => res.writeHead(404).end());
    this.sockets = new WebSocketServer({ noServer: true, maxPayload: 8 * 1024 * 1024, perMessageDeflate: false });
    this.server.on("upgrade", (request, socket, head) => {
      if (request.headers.origin || request.url !== "/") return socket.end("HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n");
      this.sockets.handleUpgrade(request, socket, head, client => this.attach(client));
    });
    await new Promise((resolve, reject) => { this.server.once("error", reject); this.server.listen({ host: "127.0.0.1", port: this.port, exclusive: true }, () => { this.port = this.server.address().port; resolve(); }); });
  }
  attach(client) {
    let state = { client, relay: null, role: "", members: new Map(), closed: false, ready: false, pending: 0, pendingBytes: 0, chain: Promise.resolve() };
    this.clients.add(state);
    const deadline = setTimeout(() => { if (!state.role) client.close(1008, "Authentification requise"); }, 5000); deadline.unref();
    const fail = () => { if (state.closed) return; this.native(state, { t: "erreur", raison: "reseau" }); this.remove(state); };
    client.on("error", () => {});
    client.on("close", () => { clearTimeout(deadline); if (state.client === client) this.detach(state); });
    client.on("message", (data, binary) => {
      const queuedState = state; queuedState.pendingBytes += data.length;
      if (++queuedState.pending > 200 || queuedState.pendingBytes > 16 * 1024 * 1024) return fail();
      state.chain = state.chain.then(async () => {
        this.assertAccess();
        if (state.closed) return;
        if (!state.role) {
          if (binary || data.length > 8192) throw Error("Bonjour invalide.");
          const message = JSON.parse(String(data));
          if (message.t !== "bonjour" || !["creer", "rejoindre", "reprendre"].includes(message.action) || !validLicence(message.licence, this.credentials.privateKey)) {
            client.close(1008, "Licence invalide"); return;
          }
          clearTimeout(deadline);
          if (message.action === "reprendre" || (message.action === "rejoindre" && [...this.clients].some(s => s !== state && s.detached && !s.closed && s.role === "invite" && s.code === String(message.code).toUpperCase() && s.pseudo === String(message.pseudo || "Streamer").slice(0,60) && s.version === String(message.version || "").slice(0,80)))) {
            const previous = [...this.clients].find(s => s !== state && s.detached && !s.closed && s.code === String(message.code).toUpperCase() && s.pseudo === String(message.pseudo || "Streamer").slice(0,60) && s.version === String(message.version || "").slice(0,80));
            if (!previous) { this.native(state, {t:"erreur",raison:"code"}); this.remove(state); return; }
            this.clients.delete(state); state = previous; clearTimeout(state.detachTimer); state.client = client; state.detached = false;
            if (state.role === "hote") {
              this.native(state, {...this.room(state,0),reprise:true});
              const event = {t:"retour",place:0,pseudo:state.pseudo,joueurs:this.roster(state)};
              for (const peer of state.members.keys()) await this.control(state,peer,event);
            } else {
              this.native(state, {...state.lastRoom,reprise:true});
              await this.control(state,state.relay.host,{t:"return"});
            }
            return;
          }
          state.role = message.action === "creer" ? "hote" : "invite";
          state.pseudo = String(message.pseudo || "Streamer").slice(0, 60); state.version = String(message.version || "").slice(0, 80);
          if (state.role === "invite" && !/^[6789BCDFGHJKLMNPQRTW]{6,12}$/i.test(String(message.code || ""))) throw Error("Code invalide.");
          const relay = state.relay = this.createRelay();
          relay.on("failure", fail);
          relay.on("payload", (peer, bytes, isBinary) => { this.incoming(state, peer, bytes, isBinary).catch(() => { if (state.role === "hote") this.departed(state,peer); else fail(); }); });
          relay.on("left", peer => this.departed(state, peer));
          state.code = await relay.open(state.role === "invite" ? String(message.code).toUpperCase() : "");
          this.assertAccess(); if (state.closed) return relay.close();
          state.lastSeen = Date.now();
          if (state.role === "hote") { state.ready = true; this.native(state, this.room(state, 0)); }
          else await this.control(state, relay.host, { t: "join", game: "shenpaint", version: state.version, pseudo: state.pseudo });
          state.heartbeat = setInterval(() => {
            try {
              this.assertAccess();
              if (state.closed) return;
              if (state.role === "invite") {
                if (Date.now() - state.lastSeen > 15000) return fail();
                void this.control(state, relay.host, { t: "ping" }).catch(fail);
              } else for (const [peer, member] of state.members) if (Date.now() - member.lastSeen > 15000) this.departed(state, peer);
            } catch { fail(); }
          }, 3000); state.heartbeat.unref();
          return;
        }
        if (!state.ready) return;
        if (binary) {
          if (state.role === "invite") return state.relay.send(state.relay.host, data, true);
          if (data.length < 2) return;
          const destination = data[0], bytes = data.subarray(1);
          for (const [peer, member] of state.members) if (destination === 255 || destination === member.place) await state.relay.send(peer, bytes, true);
        } else if (state.role === "hote") {
          const message = JSON.parse(String(data));
          if (message.t === "quitter") { this.remove(state); return; }
          if (message.t === "verrouiller") state.locked = message.oui === true;
          if (message.t === "expulser") {
            const peer = [...state.members].find(([, member]) => member.place === message.place)?.[0];
            if (peer) { await this.control(state, peer, { t: "expulse" }); this.departed(state, peer); }
          }
        }
      }).catch(fail).finally(() => { queuedState.pending--; queuedState.pendingBytes -= data.length; });
    });
  }
  roster(state) { return [{ place: 0, pseudo: state.pseudo }, ...[...state.members.values()].map(({ place, pseudo }) => ({ place, pseudo }))]; }
  room(state, place) { return { t: "salle", role: place === 0 ? "hote" : "invite", code: state.code, place, reprise: false, hoteAbsent: false, joueurs: this.roster(state) }; }
  native(state, message, binary = false) {
    if (!state.closed && state.client?.readyState === 1) state.client.send(binary ? message : JSON.stringify(message), { binary });
  }
  control(state, peer, message) { return state.relay.send(peer, JSON.stringify(message)); }
  async incoming(state, peer, bytes, binary) {
    this.assertAccess(); if (state.closed) return;
    if (state.role === "invite") {
      if (peer !== state.relay.host) return;
      state.lastSeen = Date.now();
      if (binary) { if (state.ready) this.native(state, bytes, true); return; }
      if (bytes.length > 8192) throw Error("Message de salle trop volumineux.");
      const message = JSON.parse(String(bytes));
      if (message.t === "salle") { state.ready = true; state.lastRoom = message; }
      if (state.lastRoom && message.joueurs) state.lastRoom.joueurs = message.joueurs;
      if (message.t !== "pong") this.native(state, message);
      if (["erreur","expulse","fin"].includes(message.t)) this.remove(state);
      return;
    }
    if (binary) { const member = state.members.get(peer); if (member) this.native(state, Buffer.concat([Buffer.from([member.place]),bytes]), true); return; }
    if (bytes.length > 8192) throw Error("Message de salle trop volumineux.");
      const message = JSON.parse(String(bytes));
    if (message.t === "join") {
      if (message.game !== "shenpaint" || message.version !== state.version) return this.control(state, peer, { t: "erreur", raison: "version" });
      if (state.locked) return this.control(state, peer, { t: "erreur", raison: "verrouillee" });
      if (state.members.size >= 3 && !state.members.has(peer)) return this.control(state, peer, { t: "erreur", raison: "pleine" });
      let member = state.members.get(peer);
      if (!member) { const used = new Set([...state.members.values()].map(m => m.place)); member = { place: [1, 2, 3].find(n => !used.has(n)), pseudo: String(message.pseudo || "Streamer").slice(0, 60) }; state.members.set(peer, member); }
      member.lastSeen = Date.now();
      await this.control(state, peer, this.room(state, member.place));
      const event = { t: "arrivee", place: member.place, pseudo: member.pseudo, joueurs: this.roster(state) };
      for (const other of state.members.keys()) await this.control(state, other, event);
      this.native(state, event);
    } else if (["away","return"].includes(message.t) && state.members.has(peer)) {
      const member = state.members.get(peer), event = {t:message.t === "away" ? "attente" : "retour",place:member.place,pseudo:member.pseudo,joueurs:this.roster(state)};
      this.native(state,event); for (const other of state.members.keys()) await this.control(state,other,event);
    } else if (message.t === "ping" && state.members.has(peer)) {
      state.members.get(peer).lastSeen = Date.now(); await this.control(state, peer, { t: "pong" });
    }
  }
  departed(state, peer) {
    if (state.closed) return;
    if (state.role === "invite") { if (peer !== state.relay.host) return; this.native(state, { t: "fin" }); this.remove(state); return; }
    const member = state.members.get(peer); if (!member) return;
    state.members.delete(peer);
    const message = { t: "depart", place: member.place, pseudo: member.pseudo, joueurs: this.roster(state) };
    this.native(state, message); for (const other of state.members.keys()) void this.control(state, other, message).catch(() => {});
  }
  detach(state) {
    if (state.closed || state.detached) return;
    if (!state.ready) return this.remove(state);
    state.detached = true; state.client = null;
    state.detachTimer = setTimeout(() => this.remove(state),60000); state.detachTimer.unref();
    if (state.role === "hote") {
      const event = {t:"attente",place:0,pseudo:state.pseudo,joueurs:this.roster(state)};
      for (const peer of state.members.keys()) void this.control(state,peer,event).catch(()=>{});
    } else void this.control(state,state.relay.host,{t:"away"}).catch(()=>{});
  }
  remove(state) {
    if (state.closed) return; state.closed = true; clearInterval(state.heartbeat); clearTimeout(state.detachTimer); this.clients.delete(state); state.relay?.close();
    if (state.client?.readyState === 1) state.client.close();
  }
  async close() {
    for (const state of this.clients) { this.native(state, { t: "fin" }); this.remove(state); }
    this.sockets?.close();
    if (this.server?.listening) await new Promise(resolve => this.server.close(resolve));
  }
}
module.exports = { PaintNetwork, validLicence };
