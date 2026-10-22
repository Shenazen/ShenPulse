"use strict";

const net = require("node:net"), { once } = require("node:events");

// BizHawk's external memory protocol, exercised against the real local host.
async function bizhawkPeer(port, system = "SNES") {
  const socket = net.connect(port, "127.0.0.1"); await once(socket, "connect");
  const memory = new Map(), requests = [], writes = [];
  memory.set(0x36, 2); memory.set(0x1010, 0); memory.set(0x14d, 0x85);
  let buffer = Buffer.alloc(0);
  socket.on("data", chunk => {
    buffer = Buffer.concat([buffer, chunk]);
    while (buffer.length >= 4 && buffer.length >= 4 + buffer.readUInt32BE(0)) {
      const size = buffer.readUInt32BE(0), request = JSON.parse(buffer.subarray(4, 4 + size)); buffer = buffer.subarray(4 + size);
      requests.push(request);
      const response = { ...request, message: "", stamp: Math.floor(Date.now() / 1000) };
      const address = Number(request.address) & 0x1ffff;
      if ([0, 1, 2].includes(request.type)) response.value = memory.get(address) || 0;
      else if ([0x10, 0x11, 0x12].includes(request.type)) { memory.set(address, request.value); writes.push(request); }
      else if (request.type === 0xe3) { response.message = system; response.value = 0x20300; }
      else if (request.type === 0xe2) response.message = system === "SNES" ? "Super Mario Kart (USA)" : "Pokemon Red";
      else if (request.type === 0x0f) response.block = Buffer.from(Array.from({ length: Number(request.value) }, (_, i) => memory.get(address + i) || 0)).toString("base64");
      else if (request.type === 0x1f) { const bytes = Buffer.from(request.block, "base64"); bytes.forEach((byte, i) => memory.set(address + i, byte)); writes.push(request); }
      const json = Buffer.from(JSON.stringify(response)), header = Buffer.alloc(4); header.writeUInt32BE(json.length);
      socket.write(Buffer.concat([header, json]));
    }
  });
  return { socket, memory, requests, writes };
}

module.exports = { bizhawkPeer };
