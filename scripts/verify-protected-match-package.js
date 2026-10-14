"use strict";

/** Audit en lecture seule du paquet complet avant son installation locale.
 * Ne dépose aucun média déchiffré sur disque et ne journalise jamais la clé.
 */
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const asar = require("@electron/asar");
const catalog = require("../resources/overlays/overlay-catalog");
const { decryptMedia, FORMAT_VERSION } = require("../src/main/match-media/format");
const projectRoot = path.resolve(__dirname, "..");
const STORE_BRIDGE_ENTRY = "resources/store-update/shenpulse_store_update.node";
const STORE_BRIDGE_EXPORTS = ["napi_register_module_v1", "node_api_module_get_api_version_v1"];

/**
 * Qualification PE32+/AMD64 du pont compilé par MSVC, sans charger le DLL.
 * Format : https://learn.microsoft.com/en-us/windows/win32/debug/pe-format
 * Seuls les timestamps COFF/debug et le GUID CodeView RSDS sont neutralisés.
 * Code, exports, sections, chemins/âge PDB et toutes les autres données restent
 * comparés octet pour octet. Un autre écart bloque l'audit du paquet.
 */
function qualifiedStoreBridge(bytes) {
  const fail = (message) => { throw new Error(`Pont Store PE invalide : ${message}`); };
  const requireRange = (offset, size) => {
    if (!Number.isSafeInteger(offset) || !Number.isSafeInteger(size) || offset < 0 || size < 0 || offset + size > bytes.length) {
      fail("zone hors du fichier");
    }
    return offset;
  };
  if (!Buffer.isBuffer(bytes)) fail("contenu non binaire");
  const u16 = (offset) => bytes.readUInt16LE(requireRange(offset, 2));
  const u32 = (offset) => bytes.readUInt32LE(requireRange(offset, 4));
  if (u16(0) !== 0x5a4d) fail("signature DOS");
  const pe = u32(0x3c);
  if (pe < 0x40 || u32(pe) !== 0x4550) fail("signature PE");
  const coff = pe + 4, optional = coff + 20;
  const count = u16(coff + 2), optionalSize = u16(coff + 16);
  if (u16(coff) !== 0x8664 || u16(optional) !== 0x20b || (u16(coff + 18) & 0x2002) !== 0x2002) {
    fail("le pont doit être un DLL exécutable PE32+ AMD64");
  }
  if (!count || count > 96 || optionalSize < 168 || u32(optional + 108) < 7) fail("en-têtes incomplets");
  const sectionTable = optional + optionalSize;
  requireRange(sectionTable, count * 40);
  const sections = Array.from({ length: count }, (_, index) => {
    const offset = sectionTable + index * 40;
    const section = { virtualSize: u32(offset + 8), rva: u32(offset + 12),
      size: u32(offset + 16), raw: u32(offset + 20), flags: u32(offset + 36) };
    if (section.size) {
      requireRange(section.raw, section.size);
      if (section.raw < sectionTable + count * 40) fail("section dans les en-têtes");
    }
    if (section.rva + Math.max(section.size, section.virtualSize) > 0x100000000) fail("RVA débordante");
    return section;
  });
  for (let index = 0; index < sections.length; index++) {
    const left = sections[index];
    for (const right of sections.slice(index + 1)) {
      if (left.size && right.size && left.raw < right.raw + right.size && right.raw < left.raw + left.size) fail("sections chevauchées");
    }
  }
  const mapRva = (rva, size = 1) => {
    const matches = sections.filter((section) => rva >= section.rva &&
      rva + size <= section.rva + Math.min(section.size, section.virtualSize || section.size));
    if (!rva || matches.length !== 1 || !size) fail("RVA absente ou ambiguë");
    const section = matches[0], offset = section.raw + rva - section.rva;
    requireRange(offset, size);
    return { offset, section };
  };
  const readonly = (mapping) => {
    if (!(mapping.section.flags & 0x40000000) || mapping.section.flags & 0xa0000000) fail("métadonnées dans une section exécutable ou modifiable");
    return mapping.offset;
  };
  const asciiRva = (rva) => {
    const mapping = mapRva(rva);
    readonly(mapping);
    const end = bytes.indexOf(0, mapping.offset);
    if (end < mapping.offset || end - mapping.offset > 512 || end >= mapping.section.raw + mapping.section.size) fail("chaîne non terminée");
    return bytes.toString("ascii", mapping.offset, end);
  };
  const exportRva = u32(optional + 112), exportSize = u32(optional + 116);
  if (exportSize < 40) fail("table d'exports absente");
  const exportsOffset = readonly(mapRva(exportRva, exportSize));
  const functionCount = u32(exportsOffset + 20), nameCount = u32(exportsOffset + 24);
  if (functionCount !== 2 || nameCount !== 2) fail("nombre d'exports N-API incorrect");
  const functions = readonly(mapRva(u32(exportsOffset + 28), functionCount * 4));
  const names = readonly(mapRva(u32(exportsOffset + 32), nameCount * 4));
  const ordinals = readonly(mapRva(u32(exportsOffset + 36), nameCount * 2));
  const exportedNames = Array.from({ length: nameCount }, (_, index) => asciiRva(u32(names + index * 4))).sort();
  if (JSON.stringify(exportedNames) !== JSON.stringify(STORE_BRIDGE_EXPORTS)) fail("exports N-API inattendus");
  const usedOrdinals = new Set();
  for (let index = 0; index < nameCount; index++) {
    const ordinal = u16(ordinals + index * 2);
    if (ordinal >= functionCount || usedOrdinals.has(ordinal)) fail("ordinal N-API incorrect");
    usedOrdinals.add(ordinal);
    const functionRva = u32(functions + ordinal * 4);
    if (functionRva >= exportRva && functionRva < exportRva + exportSize) fail("export N-API redirigé");
    if (!(mapRva(functionRva).section.flags & 0x20000000)) fail("fonction N-API non exécutable");
  }
  const debugRva = u32(optional + 112 + 6 * 8), debugSize = u32(optional + 116 + 6 * 8);
  if (!debugSize || debugSize % 28 || debugSize > 28 * 32) fail("répertoire debug incorrect");
  const debug = readonly(mapRva(debugRva, debugSize));
  const metadata = [{ field: "coff.timestamp", offset: coff + 4, size: 4 }];
  let codeViews = 0;
  for (let offset = debug; offset < debug + debugSize; offset += 28) {
    const type = u32(offset + 12), size = u32(offset + 16), rva = u32(offset + 20), pointer = u32(offset + 24);
    if (![2, 12, 13, 14].includes(type)) fail("type debug non qualifié");
    if (u32(offset + 4) !== u32(coff + 4)) fail("timestamp debug incohérent");
    metadata.push({ field: `debug.${type}.timestamp`, offset: offset + 4, size: 4 });
    if (size) {
      if (readonly(mapRva(rva, size)) !== pointer) fail("pointeur debug incohérent");
    } else if (rva || pointer || type !== 14) fail("payload debug absent");
    if (type !== 2) continue;
    codeViews += 1;
    if (size < 25 || bytes.toString("ascii", pointer, pointer + 4) !== "RSDS" || !u32(pointer + 20)) fail("CodeView RSDS incorrect");
    const pdb = bytes.subarray(pointer + 24, pointer + size);
    if (pdb.at(-1) !== 0 || pdb.subarray(0, -1).includes(0) ||
      !/(?:^|[\\/])shenpulse_store_update\.pdb$/i.test(pdb.toString("utf8", 0, pdb.length - 1))) fail("identité PDB incorrecte");
    metadata.push({ field: "codeview.rsds.guid", offset: pointer + 4, size: 16 });
  }
  if (codeViews !== 1) fail("CodeView unique requis");
  const normalized = Buffer.from(bytes);
  for (const field of metadata) normalized.fill(0, field.offset, field.offset + field.size);
  return { normalized, metadata, exportedNames };
}

function auditNativeStoreUpdateBridge(packaged, workspace) {
  const packagedPe = qualifiedStoreBridge(packaged), workspacePe = qualifiedStoreBridge(workspace);
  if (JSON.stringify(packagedPe.metadata) !== JSON.stringify(workspacePe.metadata) ||
    !packagedPe.normalized.equals(workspacePe.normalized)) {
    throw new Error("Pont Store désynchronisé : écart hors timestamps COFF/debug ou GUID RSDS.");
  }
  const changedMetadata = packagedPe.metadata.filter(({ offset, size }) =>
    !packaged.subarray(offset, offset + size).equals(workspace.subarray(offset, offset + size)));
  return { format: "PE32+ AMD64", exports: packagedPe.exportedNames, changedMetadata };
}

function filesBelow(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const file = path.join(directory, entry.name);
    return entry.isDirectory() ? filesBelow(file) : [file];
  });
}

function auditProtectedMatchPackage(packageDirectory) {
  const directory = path.resolve(packageDirectory);
  const archive = path.join(directory, "resources/app.asar");
  const readEntry = (entry) => asar.extractFile(archive, path.normalize(entry));
  const entries = asar.listPackage(archive).map((entry) => entry.replace(/\\/g, "/").replace(/^\//, ""));
  if (entries.some((entry) => /\.(webm|mp4)$/i.test(entry)) ||
      filesBelow(directory).some((entry) => /\.(webm|mp4|spm)$/i.test(entry))) {
    throw new Error("Vidéo brute ou ressource privée décompressée trouvée dans le paquet.");
  }
  if (entries.some((entry) => entry.endsWith("match-video-export.js"))) throw new Error("Ancien exporteur vidéo encore distribué.");
  const privateRoot = "resources/protected-match-media";
  // electron-builder retire volontairement scripts/devDependencies/build.
  const packagedIdentity = JSON.parse(readEntry("package.json").toString("utf8"));
  const workspaceIdentity = require("../package.json");
  for (const field of ["name", "productName", "version", "main"]) {
    if (packagedIdentity[field] !== workspaceIdentity[field]) throw new Error(`Identité du paquet incorrecte : ${field}`);
  }
  const declared = catalog.matches.flatMap((entry) => catalog.animationVariants(entry.match)
    .map(([variant]) => `${entry.match}-${variant}.webm`)).sort();
  const manifest = JSON.parse(readEntry(`${privateRoot}/manifest.json`).toString("utf8"));
  if (manifest.version !== FORMAT_VERSION || JSON.stringify(Object.keys(manifest.entries).sort()) !== JSON.stringify(declared)) {
    throw new Error("Catalogue privé du paquet différent des variantes déclarées.");
  }
  const encryptedNames = entries.filter((entry) => entry.startsWith(`${privateRoot}/`) && entry.endsWith(".spm")).sort();
  const expectedNames = declared.map((name) => `${privateRoot}/${name}.spm`).sort();
  if (JSON.stringify(encryptedNames) !== JSON.stringify(expectedNames)) throw new Error("Ressources privées absentes ou orphelines.");
  let verifiedSources = 0;
  let nativeStoreBridge = null;
  for (const entry of entries.filter((name) => /^(src|resources)\//.test(name) || ["README.md", "PRIVACY.md", "LICENSE"].includes(name))) {
    const metadata = asar.statFile(archive, path.normalize(entry));
    if (metadata.files) continue;
    if (entry.startsWith(`${privateRoot}/`) && metadata.unpacked) throw new Error("Ressource privée hors ASAR.");
    const workspaceFile = path.join(projectRoot, entry);
    if (!fs.existsSync(workspaceFile)) {
      throw new Error(`Source du paquet désynchronisée : ${entry}`);
    }
    const packagedBytes = readEntry(entry), workspaceBytes = fs.readFileSync(workspaceFile);
    if (entry === STORE_BRIDGE_ENTRY) {
      if (!metadata.unpacked) throw new Error("Pont Store natif non décompressé.");
      nativeStoreBridge = auditNativeStoreUpdateBridge(packagedBytes, workspaceBytes);
    } else if (!packagedBytes.equals(workspaceBytes)) {
      throw new Error(`Source du paquet désynchronisée : ${entry}`);
    }
    verifiedSources += 1;
  }
  const storedKey = JSON.parse(readEntry(`${privateRoot}/client-key.json`).toString("utf8"));
  const key = Buffer.from(storedKey.key, "base64");
  if (storedKey.version !== FORMAT_VERSION || key.length !== 32) throw new Error("Clé de lecture du paquet invalide.");
  try {
    for (const name of declared) {
      const metadata = manifest.entries[name];
      const encrypted = readEntry(`${privateRoot}/${metadata.file}`);
      let bytes;
      try {
        bytes = decryptMedia(encrypted, key, name, metadata.size);
        const expected = fs.readFileSync(path.join(projectRoot, "resources/overlays/media/video", name));
        if (!bytes.equals(expected) || crypto.createHash("sha256").update(bytes).digest("hex") !== metadata.sha256) {
          throw new Error(`Vidéo du paquet différente de sa source : ${name}`);
        }
      } finally { bytes?.fill(0); encrypted.fill(0); }
    }
  } finally { key.fill(0); }
  if (!nativeStoreBridge) throw new Error("Pont Store natif absent du paquet.");
  return { verifiedSources, protectedVideos: declared.length, rawVideos: 0, privateUnpackedFiles: 0, nativeStoreBridge };
}

if (require.main === module) {
  if (!process.argv[2]) throw new Error("Fournir le dossier win-unpacked à auditer.");
  process.stdout.write(`${JSON.stringify(auditProtectedMatchPackage(process.argv[2]), null, 2)}\n`);
}
module.exports = { auditProtectedMatchPackage, auditNativeStoreUpdateBridge };
