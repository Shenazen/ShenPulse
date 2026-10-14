"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { auditNativeStoreUpdateBridge } = require("../scripts/verify-protected-match-package");

/** Petit PE32+ AMD64 synthétique : aucun chargement natif ni compilation. */
function bridgeFixture() {
  const bytes = Buffer.alloc(0xa00);
  const coff = 0x84, optional = 0x98, sectionTable = 0x188;
  bytes.write("MZ");
  bytes.writeUInt32LE(0x80, 0x3c);
  bytes.write("PE\0\0", 0x80);
  bytes.writeUInt16LE(0x8664, coff);
  bytes.writeUInt16LE(2, coff + 2);
  bytes.writeUInt32LE(123456, coff + 4);
  bytes.writeUInt16LE(240, coff + 16);
  bytes.writeUInt16LE(0x2022, coff + 18);
  bytes.writeUInt16LE(0x20b, optional);
  bytes.writeUInt32LE(16, optional + 108);
  bytes.writeUInt32LE(0x2000, optional + 112);
  bytes.writeUInt32LE(0x100, optional + 116);
  bytes.writeUInt32LE(0x2200, optional + 160);
  bytes.writeUInt32LE(112, optional + 164);
  const section = (offset, name, rva, raw, size, flags) => {
    bytes.write(name, offset);
    bytes.writeUInt32LE(size, offset + 8);
    bytes.writeUInt32LE(rva, offset + 12);
    bytes.writeUInt32LE(size, offset + 16);
    bytes.writeUInt32LE(raw, offset + 20);
    bytes.writeUInt32LE(flags, offset + 36);
  };
  section(sectionTable, ".text", 0x1000, 0x200, 0x200, 0x60000020);
  section(sectionTable + 40, ".rdata", 0x2000, 0x400, 0x600, 0x40000040);
  bytes.set([0x48, 0x31, 0xc0, 0xc3], 0x200);
  bytes.set([0x48, 0x31, 0xc0, 0xc3], 0x210);
  bytes.writeUInt32LE(2, 0x414);
  bytes.writeUInt32LE(2, 0x418);
  bytes.writeUInt32LE(0x2040, 0x41c);
  bytes.writeUInt32LE(0x2048, 0x420);
  bytes.writeUInt32LE(0x2050, 0x424);
  bytes.writeUInt32LE(0x1000, 0x440);
  bytes.writeUInt32LE(0x1010, 0x444);
  bytes.writeUInt32LE(0x2060, 0x448);
  bytes.writeUInt32LE(0x2080, 0x44c);
  bytes.writeUInt16LE(0, 0x450);
  bytes.writeUInt16LE(1, 0x452);
  bytes.write("napi_register_module_v1\0", 0x460);
  bytes.write("node_api_module_get_api_version_v1\0", 0x480);
  const pdb = Buffer.from("C:\\fixture\\shenpulse_store_update.pdb\0");
  bytes.write("RSDS", 0x700);
  bytes.fill(0x11, 0x704, 0x714);
  bytes.writeUInt32LE(1, 0x714);
  pdb.copy(bytes, 0x718);
  const debug = (offset, type, pointer, size) => {
    bytes.writeUInt32LE(123456, offset + 4);
    bytes.writeUInt32LE(type, offset + 12);
    bytes.writeUInt32LE(size, offset + 16);
    bytes.writeUInt32LE(pointer ? pointer + 0x1c00 : 0, offset + 20);
    bytes.writeUInt32LE(pointer, offset + 24);
  };
  debug(0x600, 2, 0x700, 24 + pdb.length);
  debug(0x61c, 12, 0x780, 20);
  debug(0x638, 13, 0x7a0, 32);
  debug(0x654, 14, 0, 0);
  bytes.write("GCTL", 0x7a0);
  return bytes;
}

test("audit natif : qualifie les exports et accepte uniquement timestamps/GUID de deux compilations", () => {
  const original = bridgeFixture(), rebuilt = Buffer.from(original);
  for (const offset of [0x88, 0x604, 0x620, 0x63c, 0x658]) rebuilt.writeUInt32LE(234567, offset);
  rebuilt.fill(0x22, 0x704, 0x714);
  const report = auditNativeStoreUpdateBridge(original, rebuilt);
  assert.equal(report.format, "PE32+ AMD64");
  assert.deepEqual(report.exports, ["napi_register_module_v1", "node_api_module_get_api_version_v1"]);
  assert.equal(report.changedMetadata.length, 6);
  assert.deepEqual(report.changedMetadata.find(({ field }) => field === "codeview.rsds.guid"),
    { field: "codeview.rsds.guid", offset: 0x704, size: 16 });
  assert.deepEqual(auditNativeStoreUpdateBridge(original, original).changedMetadata, []);
});

test("audit natif : bloque code, données, checksum, chemin et âge PDB même avec les bons exports", () => {
  const original = bridgeFixture();
  for (const offset of [0x205, 0x900, 0xd8, 0x718, 0x714, 0x440]) {
    const tampered = Buffer.from(original);
    tampered[offset] ^= 1;
    assert.throws(() => auditNativeStoreUpdateBridge(original, tampered), /Pont Store désynchronisé|Pont Store PE invalide/,
      `un écart à 0x${offset.toString(16)} ne doit pas être neutralisé`);
  }
});

test("audit natif : rejette architecture, exports, RVA et debug falsifiés, y compris deux copies identiques", () => {
  const mutations = [
    (bytes) => bytes.writeUInt16LE(0x14c, 0x84),
    (bytes) => bytes.write("fake", 0x460),
    (bytes) => bytes.writeUInt32LE(0xffffff00, 0x420),
    (bytes) => bytes.writeUInt32LE(99, 0x60c),
    (bytes) => { bytes.writeUInt32LE(0x1000, 0x614); bytes.writeUInt32LE(0x200, 0x618); },
    (bytes) => bytes.writeUInt32LE(0x701, 0x618),
    (bytes) => bytes.write("BAD!", 0x700),
    (bytes) => bytes.writeUInt16LE(0, 0x452),
    (bytes) => bytes.writeUInt32LE(0x2060, 0x440),
    (bytes) => bytes.writeUInt32LE(456, 0x604)
  ];
  for (const mutate of mutations) {
    const bytes = bridgeFixture();
    mutate(bytes);
    assert.throws(() => auditNativeStoreUpdateBridge(bytes, bytes), /Pont Store PE invalide/);
  }
  assert.throws(() => auditNativeStoreUpdateBridge(Buffer.alloc(4), Buffer.alloc(4)), /Pont Store PE invalide/);
  assert.throws(() => auditNativeStoreUpdateBridge(bridgeFixture().subarray(0, 0x704), bridgeFixture()), /Pont Store PE invalide/);
});
