"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { decodeTikTokBattleEffects, decodeTikTokBattleInfo } = require("../src/main/matches/tiktok-battle-wire");
const { normalizeTikTokBattleInfo } = require("../src/main/matches/tiktok-battle-info");

// Independent hand encoder: no SDK messages, schemas or protobuf writer.
function varint(input) {
  let value = BigInt.asUintN(64, BigInt(input));
  const result = [];
  do { const next = Number(value & 127n); value >>= 7n; result.push(next | (value ? 128 : 0)); } while (value);
  return Buffer.from(result);
}
const join = (...parts) => Buffer.concat(parts);
const tag = (number, wire) => varint(BigInt(number) * 8n + BigInt(wire));
const scalar = (number, value) => join(tag(number, 0), varint(value));
const blob = (number, bytes) => join(tag(number, 2), varint(bytes.length), bytes);
const text = (number, value) => blob(number, Buffer.from(value, "utf8"));
const effect = ({ type = "", uids = [], extra = "" } = {}) => join(text(1, type), ...uids.map((uid) => text(2, uid)), text(3, extra));
const infos = (effects = [], version = 0) => join(...effects.map((entry) => blob(1, entry)), scalar(2, version));
const armies = (effects = [], version = 0) => blob(20, infos(effects, version));

test("Armies field20 decodes effect strings, exact int64 version and raw field22", () => {
  const bytes = join(scalar(22, 987), armies([
    effect({ type: "critical_strike", uids: ["7412345678901234567", "7412345678901234568"], extra: '{"multiplier":2}' }),
    effect({ type: "other", extra: "arbitrary text, not JSON" })
  ], 9223372036854775807n));
  assert.deepEqual(decodeTikTokBattleEffects(bytes), {
    effectInfoList: [
      { type: "critical_strike", uidList: ["7412345678901234567", "7412345678901234568"], effectExtra: '{"multiplier":2}' },
      { type: "other", uidList: [], effectExtra: "arbitrary text, not JSON" }
    ], effectListVersion: "9223372036854775807", multiplierType: 987
  });
});

test("absent effects return null; empty present field20 is a real empty list", () => {
  for (const bytes of [Buffer.alloc(0), scalar(22, 2), text(9, "not effects")]) assert.equal(decodeTikTokBattleEffects(bytes), null);
  assert.deepEqual(decodeTikTokBattleEffects(blob(20, Buffer.alloc(0))), {
    effectInfoList: [], effectListVersion: "0", multiplierType: null
  });
});

test("signed versions and int32 diagnostics stay precise; singular nested messages merge", () => {
  const bytes = join(armies([effect({ type: "first" })], -9223372036854775808n), scalar(22, -1),
    blob(20, blob(1, effect({ type: "second" }))));
  const value = decodeTikTokBattleEffects(bytes);
  assert.equal(value.effectListVersion, "-9223372036854775808");
  assert.equal(value.multiplierType, -1);
  assert.deepEqual(value.effectInfoList.map((entry) => entry.type), ["first", "second"]);
});

test("unknown valid varint, fixed64, bytes and fixed32 fields are skipped at every depth", () => {
  const unknown = join(scalar(90, 18446744073709551615n), tag(91, 1), Buffer.alloc(8),
    blob(92, Buffer.from([0xff, 0xfe, 0xfd])), tag(93, 5), Buffer.alloc(4));
  const bytes = join(unknown, blob(20, join(unknown, blob(1, join(unknown, effect({ type: "x", uids: ["u"] }))), scalar(2, 5))), unknown);
  assert.deepEqual(decodeTikTokBattleEffects(bytes), {
    effectInfoList: [{ type: "x", uidList: ["u"], effectExtra: "" }], effectListVersion: "5", multiplierType: null
  });
});

test("malformed fields fail closed without throwing, including corruption after valid effects", () => {
  const malformed = [
    Buffer.from([0]), Buffer.from([0x80]), Buffer.from([0x0f]), Buffer.from([0x0b, 0x0c]),
    join(tag(20, 2), varint(100), Buffer.from([1])), scalar(20, 1), blob(22, Buffer.alloc(0)),
    blob(20, scalar(1, 1)), blob(20, blob(2, Buffer.alloc(0))), armies([scalar(1, 2)]),
    armies([scalar(2, 2)]), armies([scalar(3, 2)]),
    join(tag(80, 0), Buffer.alloc(11, 0x80)),
    join(tag(80, 0), Buffer.from([...Array(9).fill(0xff), 2])),
    join(tag(80, 2), Buffer.from([0x80, 0x80, 0x80, 0x80, 0x80, 0])),
    blob(20, join(tag(2, 0), Buffer.from([...Array(9).fill(0xff), 2]))),
    join(tag(80, 1), Buffer.alloc(7)), join(tag(80, 5), Buffer.alloc(3)),
    join(tag(536870911, 2), varint(2), Buffer.alloc(1))
  ];
  for (const bytes of malformed) {
    assert.equal(decodeTikTokBattleEffects(bytes), null, bytes.toString("hex"));
    assert.equal(decodeTikTokBattleEffects(join(armies(), bytes)), null, `trailing ${bytes.toString("hex")}`);
  }
  for (const value of [null, undefined, "bytes", {}, [], new ArrayBuffer(0)]) assert.equal(decodeTikTokBattleEffects(value), null);
});

test("malformed UTF8 in every known string is rejected, not silently replaced", () => {
  for (const number of [1, 2, 3]) for (const bytes of [Buffer.from([0xc3, 0x28]), Buffer.from([0xed, 0xa0, 0x80]), Buffer.from([0xf0, 0x9f])]) {
    assert.equal(decodeTikTokBattleEffects(armies([blob(number, bytes)])), null);
  }
  assert.equal(decodeTikTokBattleEffects(armies([effect({ type: "×2 🔥", uids: ["créateur"], extra: "é" })])).effectInfoList[0].type, "×2 🔥");
  assert.equal(decodeTikTokBattleEffects(armies([effect({ type: "\uFEFFexact" })])).effectInfoList[0].type, "\uFEFFexact");
});

test("byte, field, effect, UID and per-string limits are inclusive and reject excess", () => {
  assert.ok(decodeTikTokBattleEffects(armies(Array.from({ length: 32 }, () => effect()))));
  assert.equal(decodeTikTokBattleEffects(armies(Array.from({ length: 33 }, () => effect()))), null);
  assert.ok(decodeTikTokBattleEffects(armies([effect({ uids: Array(16).fill("u") })])));
  assert.equal(decodeTikTokBattleEffects(armies([effect({ uids: Array(17).fill("u") })])), null);
  for (const number of [1, 2, 3]) {
    assert.ok(decodeTikTokBattleEffects(armies([text(number, "a".repeat(8192))])));
    assert.equal(decodeTikTokBattleEffects(armies([text(number, "a".repeat(8193))])), null);
  }
  assert.ok(decodeTikTokBattleEffects(armies([text(3, "é".repeat(4096))])));
  assert.equal(decodeTikTokBattleEffects(armies([text(3, "é".repeat(4097))])), null);
  const tiny = scalar(90, 0);
  assert.ok(decodeTikTokBattleEffects(join(blob(20, Buffer.alloc(0)), ...Array(4095).fill(tiny))));
  assert.equal(decodeTikTokBattleEffects(join(blob(20, Buffer.alloc(0)), ...Array(4096).fill(tiny))), null);
  assert.equal(decodeTikTokBattleEffects(Buffer.alloc(1024 * 1024 + 1)), null);
  const size = 1024 * 1024;
  const prefix = blob(20, Buffer.alloc(0));
  // field90 tag=2 bytes, length=3 bytes at this size.
  assert.ok(decodeTikTokBattleEffects(join(prefix, blob(90, Buffer.alloc(size - prefix.length - 5)))));
});

test("nested fields share one budget and arbitrary unknown nesting is not traversed", () => {
  const tiny = scalar(90, 0);
  assert.equal(decodeTikTokBattleEffects(blob(20, join(blob(1, join(...Array(4096).fill(tiny)))))), null);
  let nested = Buffer.from([0xff]);
  for (let index = 0; index < 200; index++) nested = blob(90, nested);
  assert.ok(decodeTikTokBattleEffects(join(armies(), nested)));
});

test("bounded arbitrary byte arrays never escape as exceptions", () => {
  let seed = 0x24102026;
  const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed; };
  for (let index = 0; index < 2000; index++) {
    const bytes = Buffer.alloc(random() % 256);
    for (let offset = 0; offset < bytes.length; offset++) bytes[offset] = random() >>> 24;
    assert.doesNotThrow(() => decodeTikTokBattleEffects(bytes));
  }
});

const INFO_EPOCH = 1792100000000;
const INFO_BATTLE = "7423456789012345678";
const INFO_CHANNEL = "7423456789012345679";
const infoHeader = () => join(scalar(1, 0), scalar(5, INFO_EPOCH + 2318));
const infoSettings = () => join(scalar(1, INFO_BATTLE), scalar(2, INFO_EPOCH), scalar(3, 301),
  scalar(4, INFO_CHANNEL), scalar(10, INFO_EPOCH + 301000));
const infoTarget = () => join(scalar(1, 281), scalar(2, 20), scalar(3, INFO_EPOCH + 20000),
  scalar(23, "9007199254740993"), scalar(24, 22));
const infoReward = () => join(scalar(1, 281), scalar(2, 20), scalar(3, 2), scalar(4, INFO_EPOCH + 20000));
const infoConfig = () => join(scalar(1, 301), blob(3, infoTarget()), blob(4, infoReward()), scalar(6, INFO_EPOCH));
const infoTask = () => join(blob(1, infoConfig()), blob(2, join(scalar(1, 4), scalar(11, 12))));
const infoData = () => join(scalar(1, INFO_CHANNEL), scalar(2, INFO_BATTLE), blob(3, infoSettings()), blob(12, infoTask()));
const infoEnvelope = (data = infoData(), header = infoHeader()) => join(blob(1, header), blob(2, blob(1, data)));

test("battle/info protobuf envelope reconstructs JSON-shaped settings, START_BONUS and lossless clocks/IDs", () => {
  const value = decodeTikTokBattleInfo(infoEnvelope());
  assert.deepEqual(value, {
    status_code: 0, extra: { now: String(INFO_EPOCH + 2318) }, data: {
      channel_id: INFO_CHANNEL, battle_id: INFO_BATTLE,
      battle_settings: { battle_id: INFO_BATTLE, start_time_ms: String(INFO_EPOCH), duration: 301,
        channel_id: INFO_CHANNEL, end_time_ms: String(INFO_EPOCH + 301000) },
      battle_task: { config: { preview_start_time: "301", preview_start_timestamp: String(INFO_EPOCH),
        target_config: { target_start_time: "281", duration: "20", target_start_timestamp: String(INFO_EPOCH + 20000),
          progress_target: "9007199254740993", target_type: 22 },
        reward_config: { reward_start_time: "281", duration: "20", reward_multiple: "2", reward_start_timestamp: String(INFO_EPOCH + 20000) }
      }, status: { status: 4, progress: "12" } }
    }
  });
  const normalized = normalizeTikTokBattleInfo(value, { battleId: INFO_BATTLE, ownerUserId: "111", roomId: "700",
    receivedAtMs: INFO_EPOCH + 10000, battleEndMs: INFO_EPOCH + 301000 });
  assert.equal(normalized.bonus.stage, "available");
  assert.equal(normalized.bonus.startsAtMs, INFO_EPOCH + 20000);
  assert.equal(normalized.bonus.ownerUserId, "111");
});

test("battle/info requires present header/body but respects implicit protobuf status0 in an empty header", () => {
  for (const bytes of [Buffer.alloc(0), blob(1, infoHeader()), blob(2, blob(1, infoData()))]) assert.equal(decodeTikTokBattleInfo(bytes), null);
  assert.deepEqual(decodeTikTokBattleInfo(join(blob(1, Buffer.alloc(0)), blob(2, Buffer.alloc(0)))), {
    status_code: 0, extra: { now: "0" }
  });
  assert.equal(decodeTikTokBattleInfo(infoEnvelope(infoData(), Buffer.alloc(0))).status_code, 0);
});

test("battle/info missing settings or tasks never acquire synthetic configuration or availability", () => {
  for (const data of [Buffer.alloc(0), blob(3, infoSettings()), blob(12, infoTask())]) {
    const value = decodeTikTokBattleInfo(infoEnvelope(data));
    assert.ok(value && value.data);
    assert.equal(normalizeTikTokBattleInfo(value, { battleId: INFO_BATTLE, ownerUserId: "111", roomId: "700",
      receivedAtMs: INFO_EPOCH + 10000, battleEndMs: INFO_EPOCH + 301000 }), null);
  }
  const value = decodeTikTokBattleInfo(infoEnvelope(join(blob(3, infoSettings()), blob(12, blob(2, Buffer.alloc(0))))));
  assert.deepEqual(value.data.battle_task.status, { status: 0 });
  assert.equal("config" in value.data.battle_task, false);
});

test("battle/info status codes stay safe numbers while signed/max int64 fields remain decimal strings", () => {
  const value = decodeTikTokBattleInfo(infoEnvelope(join(scalar(1, -1), scalar(2, 9223372036854775807n)),
    join(scalar(1, -1), scalar(5, 9223372036854775807n))));
  assert.deepEqual(value, { status_code: -1, extra: { now: "9223372036854775807" },
    data: { channel_id: "-1", battle_id: "9223372036854775807" } });
  for (const status of [9007199254740992n, -9007199254740992n]) assert.equal(decodeTikTokBattleInfo(infoEnvelope(infoData(), scalar(1, status))), null);
});

test("battle/info ignores valid unknown fields at all supported depths without retaining their byte content", () => {
  const unknown = join(scalar(90, 17), tag(91, 1), Buffer.alloc(8), blob(92, Buffer.from([0xff, 0xfe])), tag(93, 5), Buffer.alloc(4));
  const config = join(unknown, blob(3, join(infoTarget(), unknown)), blob(4, join(infoReward(), unknown)));
  const task = join(unknown, blob(1, config), blob(2, join(scalar(1, 4), unknown)));
  const data = join(unknown, scalar(2, INFO_BATTLE), blob(3, join(infoSettings(), unknown)), blob(12, task));
  const envelope = join(unknown, blob(1, join(infoHeader(), unknown)), blob(2, join(unknown, blob(1, data))));
  const value = decodeTikTokBattleInfo(envelope);
  assert.equal(value.data.battle_task.config.target_config.target_type, 22);
  assert.equal(value.data.battle_task.config.reward_config.reward_multiple, "2");
  assert.equal(JSON.stringify(value).includes("unknown"), false);
});

test("battle/info malformed nested wires, lengths, tags and int64 overflows fail closed", () => {
  const overflow = Buffer.from([...Array(9).fill(0xff), 2]);
  const cases = [
    scalar(1, 0), scalar(2, 0), join(blob(1, infoHeader()), blob(2, Buffer.from([0]))),
    infoEnvelope(scalar(3, 0)), infoEnvelope(scalar(12, 0)), infoEnvelope(blob(12, scalar(1, 0))),
    infoEnvelope(blob(12, blob(1, scalar(3, 0)))), infoEnvelope(blob(12, blob(1, scalar(4, 0)))),
    infoEnvelope(blob(12, blob(2, blob(1, Buffer.alloc(0))))),
    infoEnvelope(blob(3, blob(1, Buffer.alloc(0)))), infoEnvelope(infoData(), blob(1, Buffer.alloc(0))),
    infoEnvelope(infoData(), join(tag(5, 0), overflow)),
    infoEnvelope(blob(12, blob(1, blob(4, join(tag(4, 0), overflow))))),
    infoEnvelope(blob(12, join(tag(1, 2), varint(100), Buffer.alloc(1)))),
    join(infoEnvelope(), Buffer.from([0x0b, 0x0c]))
  ];
  for (const bytes of cases) assert.equal(decodeTikTokBattleInfo(bytes), null, bytes.toString("hex"));
  for (const value of [null, undefined, "protobuf", {}, [], new ArrayBuffer(0)]) assert.equal(decodeTikTokBattleInfo(value), null);
});

test("battle/info duplicate nested messages merge fields while repeated body bytes use the final value", () => {
  const settings = join(blob(3, scalar(1, INFO_BATTLE)), blob(3, scalar(2, INFO_EPOCH)));
  const bytes = join(blob(1, scalar(5, INFO_EPOCH)), blob(1, scalar(1, 0)), blob(2, Buffer.from([0])), blob(2, blob(1, settings)));
  assert.deepEqual(decodeTikTokBattleInfo(bytes), { status_code: 0, extra: { now: String(INFO_EPOCH) }, data: {
    battle_settings: { battle_id: INFO_BATTLE, start_time_ms: String(INFO_EPOCH) }
  } });
});

test("battle/info shares byte and field budgets across its entire known nested structure", () => {
  const prefix = join(blob(1, Buffer.alloc(0)), blob(2, Buffer.alloc(0))), tiny = scalar(90, 0);
  assert.ok(decodeTikTokBattleInfo(join(prefix, ...Array(4094).fill(tiny))));
  assert.equal(decodeTikTokBattleInfo(join(prefix, ...Array(4095).fill(tiny))), null);
  assert.equal(decodeTikTokBattleInfo(infoEnvelope(join(...Array(4096).fill(tiny)))), null);
  const size = 1024 * 1024;
  assert.ok(decodeTikTokBattleInfo(join(prefix, blob(90, Buffer.alloc(size - prefix.length - 5)))));
  assert.equal(decodeTikTokBattleInfo(Buffer.alloc(size + 1)), null);
  let nested = Buffer.from([0xff]);
  for (let index = 0; index < 200; index++) nested = blob(90, nested);
  assert.ok(decodeTikTokBattleInfo(join(infoEnvelope(), nested)));
});

test("battle/info bounded arbitrary byte arrays cannot escape as exceptions", () => {
  let seed = 0x24102027;
  const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed; };
  for (let index = 0; index < 2000; index++) {
    const bytes = Buffer.alloc(random() % 256);
    for (let offset = 0; offset < bytes.length; offset++) bytes[offset] = random() >>> 24;
    assert.doesNotThrow(() => decodeTikTokBattleInfo(bytes));
  }
});
