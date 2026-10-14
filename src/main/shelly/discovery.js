"use strict";

/** shelly : module « discovery », sans initialisation externe au chargement. */
const dgram = require("node:dgram");
const { MDNS_ADDRESS, MDNS_PORT } = require("./constants");
const { normalizeHost, clampNumber } = require("./devices");

function encodeDnsName(name) {
  const labels = String(name).split(".").filter(Boolean);
  return Buffer.concat([
    ...labels.map((label) => {
      const content = Buffer.from(label, "utf8");
      return Buffer.concat([Buffer.from([content.length]), content]);
    }),
    Buffer.from([0])
  ]);
}

function mdnsQueryPacket() {
  const header = Buffer.alloc(12);
  header.writeUInt16BE(2, 4);
  const question = (name) => {
    const suffix = Buffer.alloc(4);
    suffix.writeUInt16BE(12, 0);
    suffix.writeUInt16BE(0x8001, 2);
    return Buffer.concat([encodeDnsName(name), suffix]);
  };
  return Buffer.concat([
    header,
    question("_shelly._tcp.local"),
    question("_http._tcp.local")
  ]);
}

function readDnsName(buffer, offset) {
  const labels = [];
  let cursor = offset;
  let nextOffset = offset;
  let jumped = false;
  let steps = 0;
  while (cursor < buffer.length && steps < 80) {
    steps += 1;
    const length = buffer[cursor];
    if (length === 0) {
      if (!jumped) nextOffset = cursor + 1;
      break;
    }
    if ((length & 0xc0) === 0xc0) {
      if (cursor + 1 >= buffer.length) throw new Error("Pointeur DNS incomplet.");
      const pointer = ((length & 0x3f) << 8) | buffer[cursor + 1];
      if (!jumped) nextOffset = cursor + 2;
      cursor = pointer;
      jumped = true;
      continue;
    }
    const start = cursor + 1;
    const end = start + length;
    if (end > buffer.length) throw new Error("Nom DNS incomplet.");
    labels.push(buffer.toString("utf8", start, end));
    cursor = end;
    if (!jumped) nextOffset = cursor;
  }
  return { name: labels.join(".").toLowerCase(), nextOffset };
}

function parseMdnsPacket(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length < 12) return [];
  let offset = 12;
  const questions = buffer.readUInt16BE(4);
  const recordsCount =
    buffer.readUInt16BE(6) +
    buffer.readUInt16BE(8) +
    buffer.readUInt16BE(10);
  for (let index = 0; index < questions; index += 1) {
    const name = readDnsName(buffer, offset);
    offset = name.nextOffset + 4;
    if (offset > buffer.length) return [];
  }
  const records = [];
  for (let index = 0; index < recordsCount; index += 1) {
    const owner = readDnsName(buffer, offset);
    offset = owner.nextOffset;
    if (offset + 10 > buffer.length) break;
    const type = buffer.readUInt16BE(offset);
    const length = buffer.readUInt16BE(offset + 8);
    const dataOffset = offset + 10;
    const end = dataOffset + length;
    if (end > buffer.length) break;
    const record = { name: owner.name, type };
    if (type === 1 && length === 4) {
      record.address = [...buffer.subarray(dataOffset, end)].join(".");
    } else if (type === 12) {
      record.target = readDnsName(buffer, dataOffset).name;
    } else if (type === 33 && length >= 6) {
      record.port = buffer.readUInt16BE(dataOffset + 4);
      record.target = readDnsName(buffer, dataOffset + 6).name;
    }
    records.push(record);
    offset = end;
  }
  return records;
}

function hostsFromMdnsRecords(records) {
  const serviceInstances = new Set(
    records
      .filter(
        (record) =>
          record.type === 12 &&
          ["_shelly._tcp.local", "_http._tcp.local"].includes(record.name)
      )
      .map((record) => record.target)
      .filter(Boolean)
  );
  const serviceHosts = new Set(
    records
      .filter(
        (record) =>
          record.type === 33 &&
          (serviceInstances.has(record.name) || record.name.includes("shelly"))
      )
      .map((record) => record.target)
      .filter(Boolean)
  );
  const result = [];
  for (const record of records) {
    if (record.type !== 1 || !record.address) continue;
    if (serviceHosts.has(record.name) || record.name.includes("shelly")) {
      result.push(record.address);
    }
  }
  for (const host of serviceHosts) result.push(host);
  return [...new Set(result.map(normalizeHost).filter(Boolean))];
}

function discoverMdnsHosts({ timeoutMs = 1400 } = {}) {
  return new Promise((resolve) => {
    const socket = dgram.createSocket({ type: "udp4", reuseAddr: true });
    const records = [];
    let finished = false;
    const finish = () => {
      if (finished) return;
      finished = true;
      try {
        socket.close();
      } catch {
        // The socket may already have closed after a network change.
      }
      resolve(hostsFromMdnsRecords(records));
    };
    const timer = setTimeout(finish, clampNumber(timeoutMs, 300, 5000, 1400));
    socket.on("message", (message) => {
      try {
        records.push(...parseMdnsPacket(message));
      } catch {
        // Ignore malformed packets from unrelated multicast services.
      }
    });
    socket.once("error", () => {
      clearTimeout(timer);
      finish();
    });
    socket.bind(0, () => {
      socket.send(mdnsQueryPacket(), MDNS_PORT, MDNS_ADDRESS, (error) => {
        if (error) {
          clearTimeout(timer);
          finish();
        }
      });
    });
  });
}

module.exports = { encodeDnsName, mdnsQueryPacket, readDnsName, parseMdnsPacket, hostsFromMdnsRecords, discoverMdnsHosts };

