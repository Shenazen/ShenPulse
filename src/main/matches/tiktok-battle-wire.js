"use strict";

/** Extension minimale du message Armies : données d'effets uniquement.
 * Les numéros de champs sont un contrat de transport, pas une interprétation
 * de bonus. Aucun JSON, UID bénéficiaire ou multiplicateur n'est inventé.
 * Le lecteur protobuf existant est complété par des limites strictes ; aucune
 * récursion sur les champs inconnus, aucune copie des grandes sous-trames.
 */
const { BinaryReader } = require("@bufbuild/protobuf/wire");

const MAX_BYTES = 1024 * 1024;
const MAX_FIELDS = 4096;
const MAX_EFFECTS = 32;
const MAX_UIDS = 16;
const MAX_STRING_BYTES = 8192;
const utf8 = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true });

function integer(reader, bytes, signed = false) {
  const begin = reader.pos;
  const value = signed ? reader.int64() : reader.uint64();
  // Some protobuf readers truncate excess bits in the tenth varint byte.
  if (reader.pos - begin > 10 || reader.pos - begin === 10 && bytes[reader.pos - 1] > 1) throw new Error("varint overflow");
  return value;
}

function delimited(reader, bytes, maximum = MAX_BYTES) {
  const prefix = reader.pos;
  const size = integer(reader, bytes);
  if (reader.pos - prefix > 5 || BigInt(size) > BigInt(maximum) || BigInt(size) > BigInt(reader.len - reader.pos)) throw new Error("invalid length");
  const begin = reader.pos;
  reader.pos += Number(size);
  return bytes.subarray(begin, reader.pos);
}

function string(reader, bytes, wire) {
  if (wire !== 2) throw new Error("invalid string wire");
  return utf8.decode(delimited(reader, bytes, MAX_STRING_BYTES));
}

function skip(reader, bytes, wire) {
  if (wire === 0) { integer(reader, bytes); return; }
  if (wire === 2) { delimited(reader, bytes); return; }
  if (wire !== 1 && wire !== 5) throw new Error("unsupported wire");
  const width = wire === 1 ? 8 : 4;
  if (width > reader.len - reader.pos) throw new Error("truncated fixed field");
  reader.pos += width;
}

function fields(bytes, budget, visit) {
  const reader = new BinaryReader(bytes);
  while (reader.pos < reader.len) {
    if (++budget.fields > MAX_FIELDS) throw new Error("too many fields");
    const [number, wire] = reader.tag();
    visit(reader, number, wire);
  }
}

function effect(bytes, budget) {
  const value = { type: "", uidList: [], effectExtra: "" };
  fields(bytes, budget, (reader, number, wire) => {
    if (number === 1) value.type = string(reader, bytes, wire);
    else if (number === 2) {
      if (value.uidList.length >= MAX_UIDS) throw new Error("too many UIDs");
      value.uidList.push(string(reader, bytes, wire));
    } else if (number === 3) value.effectExtra = string(reader, bytes, wire);
    else skip(reader, bytes, wire);
  });
  return value;
}

function infos(bytes, budget, value) {
  fields(bytes, budget, (reader, number, wire) => {
    if (number === 1) {
      if (wire !== 2 || value.effectInfoList.length >= MAX_EFFECTS) throw new Error("invalid effects");
      value.effectInfoList.push(effect(delimited(reader, bytes), budget));
    } else if (number === 2) {
      if (wire !== 0) throw new Error("invalid version wire");
      value.effectListVersion = String(integer(reader, bytes, true));
    } else skip(reader, bytes, wire);
  });
}

/** Accepts a protobuf WebcastLinkMicArmies byte array, never decoded objects.
 * Depth is fixed at three messages: Armies -> EffectInfos -> Effect.
 * Version is a decimal string so int64 precision is never lost. The raw
 * multiplierType remains diagnostic, including unknown enum-like values.
 */
function decodeTikTokBattleEffects(bytes) {
  if (!(bytes instanceof Uint8Array) || bytes.byteLength > MAX_BYTES) return null;
  try {
    let present = false;
    const value = { effectInfoList: [], effectListVersion: "0", multiplierType: null };
    const budget = { fields: 0 };
    fields(bytes, budget, (reader, number, wire) => {
      if (number === 20) {
        if (wire !== 2) throw new Error("invalid effects wire");
        present = true;
        infos(delimited(reader, bytes), budget, value);
      } else if (number === 22) {
        if (wire !== 0) throw new Error("invalid multiplier wire");
        value.multiplierType = Number(BigInt.asIntN(32, BigInt(integer(reader, bytes))));
      } else skip(reader, bytes, wire);
    });
    return present ? value : null;
  } catch {
    return null;
  }
}

// Transport field facts only. This is not an implementation of the remote
// application: JSON is reconstructed solely for our strict battle/info adapter.
const STATUS = { defaults: { status: 0 }, fields: { 1: ["status", "int32"], 11: ["progress", "int64"] } };
const TARGET = { fields: { 1: ["target_start_time", "int64"], 2: ["duration", "int64"],
  3: ["target_start_timestamp", "int64"], 23: ["progress_target", "int64"], 24: ["target_type", "int32"] } };
const REWARD = { fields: { 1: ["reward_start_time", "int64"], 2: ["duration", "int64"],
  3: ["reward_multiple", "int64"], 4: ["reward_start_timestamp", "int64"] } };
const CONFIG = { fields: { 1: ["preview_start_time", "int64"], 3: ["target_config", TARGET],
  4: ["reward_config", REWARD], 6: ["preview_start_timestamp", "int64"] } };
const TASK = { fields: { 1: ["config", CONFIG], 2: ["status", STATUS] } };
const SETTINGS = { fields: { 1: ["battle_id", "int64"], 2: ["start_time_ms", "int64"],
  3: ["duration", "int32"], 4: ["channel_id", "int64"], 10: ["end_time_ms", "int64"] } };
const DATA = { fields: { 1: ["channel_id", "int64"], 2: ["battle_id", "int64"],
  3: ["battle_settings", SETTINGS], 12: ["battle_task", TASK] } };
const RESPONSE = { fields: { 1: ["data", DATA] } };
const HEADER = { defaults: { status_code: 0, now: "0" }, fields: { 1: ["status_code", "safeNumber"], 5: ["now", "int64"] } };
const ENVELOPE = { fields: { 1: ["header", HEADER], 2: ["body", "bytes"] } };

function message(bytes, budget, schema, depth = 0, existing) {
  if (depth > 8) throw new Error("message depth exceeded");
  const result = existing || { ...schema.defaults };
  fields(bytes, budget, (reader, number, wire) => {
    const field = schema.fields[number];
    if (!field) { skip(reader, bytes, wire); return; }
    const [name, type] = field;
    if (typeof type === "object" || type === "bytes") {
      if (wire !== 2) throw new Error("invalid message wire");
      const content = delimited(reader, bytes);
      result[name] = type === "bytes" ? content : message(content, budget, type, depth + 1, result[name]);
      return;
    }
    if (wire !== 0) throw new Error("invalid scalar wire");
    if (type === "int32") result[name] = Number(BigInt.asIntN(32, BigInt(integer(reader, bytes))));
    else {
      const value = integer(reader, bytes, true);
      if (type === "int64") result[name] = String(value);
      else {
        const numberValue = Number(value);
        if (!Number.isSafeInteger(numberValue)) throw new Error("unsafe status code");
        result[name] = numberValue;
      }
    }
  });
  return result;
}

/** PB envelope -> the JSON-shaped battle/info contract our normalizer uses.
 * All IDs and int64 clocks remain exact decimal strings. Presence of both
 * envelope header and body is mandatory; missing tasks/settings stay missing.
 * No remote request, JSON parsing, bonus attribution or clock change occurs.
 */
function decodeTikTokBattleInfo(bytes) {
  if (!(bytes instanceof Uint8Array) || bytes.byteLength > MAX_BYTES) return null;
  try {
    const budget = { fields: 0 };
    const envelope = message(bytes, budget, ENVELOPE);
    if (!Object.hasOwn(envelope, "header") || !Object.hasOwn(envelope, "body")) return null;
    const body = message(envelope.body, budget, RESPONSE, 1);
    return { status_code: envelope.header.status_code, extra: { now: envelope.header.now }, ...body };
  } catch {
    return null;
  }
}

module.exports = { decodeTikTokBattleEffects, decodeTikTokBattleInfo };
