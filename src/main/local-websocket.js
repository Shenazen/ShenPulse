"use strict";

const crypto = require("node:crypto");
const { EventEmitter } = require("node:events");

function encodeFrame(payload, opcode = 0x1) {
  const data = Buffer.isBuffer(payload) ? payload : Buffer.from(String(payload));
  let header;
  if (data.length < 126) {
    header = Buffer.from([0x80 | opcode, data.length]);
  } else if (data.length <= 0xffff) {
    header = Buffer.alloc(4);
    header[0] = 0x80 | opcode;
    header[1] = 126;
    header.writeUInt16BE(data.length, 2);
  } else {
    header = Buffer.alloc(10);
    header[0] = 0x80 | opcode;
    header[1] = 127;
    header.writeBigUInt64BE(BigInt(data.length), 2);
  }
  return Buffer.concat([header, data]);
}

class LocalWebSocketServer extends EventEmitter {
  constructor({ authorize = () => true } = {}) {
    super();
    this.authorize = authorize;
    this.clients = new Set();
  }

  handleUpgrade(request, socket) {
    if (!this.authorize(request)) {
      socket.end("HTTP/1.1 401 Unauthorized\r\nConnection: close\r\n\r\n");
      return;
    }
    const key = request.headers["sec-websocket-key"];
    if (!key || request.headers.upgrade?.toLowerCase() !== "websocket") {
      socket.end("HTTP/1.1 400 Bad Request\r\nConnection: close\r\n\r\n");
      return;
    }
    const accept = crypto
      .createHash("sha1")
      .update(`${key}258EAFA5-E914-47DA-95CA-C5AB0DC85B11`)
      .digest("base64");
    socket.write(
      "HTTP/1.1 101 Switching Protocols\r\n" +
        "Upgrade: websocket\r\n" +
        "Connection: Upgrade\r\n" +
        `Sec-WebSocket-Accept: ${accept}\r\n\r\n`
    );
    socket.setNoDelay(true);
    socket._shenPulseBuffer = Buffer.alloc(0);
    this.clients.add(socket);
    this.emit("connection", socket, request);
    socket.on("data", (data) => this.#consume(socket, data));
    socket.on("error", () => this.clients.delete(socket));
    socket.on("close", () => this.clients.delete(socket));
  }

  #consume(socket, incoming) {
    let buffer = Buffer.concat([socket._shenPulseBuffer, incoming]);
    while (buffer.length >= 2) {
      const first = buffer[0];
      const second = buffer[1];
      const opcode = first & 0x0f;
      const masked = Boolean(second & 0x80);
      let length = second & 0x7f;
      let offset = 2;
      if (length === 126) {
        if (buffer.length < 4) break;
        length = buffer.readUInt16BE(2);
        offset = 4;
      } else if (length === 127) {
        if (buffer.length < 10) break;
        const longLength = buffer.readBigUInt64BE(2);
        if (longLength > BigInt(1024 * 1024)) {
          socket.destroy();
          return;
        }
        length = Number(longLength);
        offset = 10;
      }
      const maskLength = masked ? 4 : 0;
      if (buffer.length < offset + maskLength + length) break;
      const mask = masked ? buffer.subarray(offset, offset + 4) : null;
      offset += maskLength;
      const payload = Buffer.from(buffer.subarray(offset, offset + length));
      if (mask) {
        for (let index = 0; index < payload.length; index += 1) {
          payload[index] ^= mask[index % 4];
        }
      }
      buffer = buffer.subarray(offset + length);
      if (opcode === 0x8) {
        socket.end(encodeFrame(payload, 0x8));
      } else if (opcode === 0x9) {
        socket.write(encodeFrame(payload, 0xa));
      } else if (opcode === 0x1) {
        this.emit("message", payload.toString("utf8"), socket);
      }
    }
    socket._shenPulseBuffer = buffer;
  }

  send(socket, value) {
    if (socket.writable) socket.write(encodeFrame(JSON.stringify(value)));
  }

  broadcast(value) {
    const frame = encodeFrame(JSON.stringify(value));
    for (const client of this.clients) {
      if (client.writable) client.write(frame);
      else this.clients.delete(client);
    }
  }

  close() {
    for (const client of this.clients) client.destroy();
    this.clients.clear();
  }
}

module.exports = { LocalWebSocketServer, encodeFrame };

