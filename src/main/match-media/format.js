"use strict";

/** Format privé du paquet : nonce GCM, étiquette puis vidéo chiffrée. */
const crypto = require("node:crypto");
const FORMAT_VERSION = 1;
const NONCE_BYTES = 12;
const TAG_BYTES = 16;
const MAX_VIDEO_BYTES = 16 * 1024 * 1024;
const MEDIA_NAME = /^[a-z0-9]+-[a-z0-9]+\.webm$/;

function associatedData(name, size) {
  if (!MEDIA_NAME.test(name) || !Number.isSafeInteger(size) || size < 1 || size > MAX_VIDEO_BYTES) {
    throw new Error("Métadonnées de vidéo Match invalides.");
  }
  return Buffer.from(`ShenPulse Match ${FORMAT_VERSION}:${name}:${size}`, "utf8");
}

function encryptMedia(bytes, key, name) {
  const nonce = crypto.randomBytes(NONCE_BYTES);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, nonce);
  cipher.setAAD(associatedData(name, bytes.length));
  const encrypted = Buffer.concat([cipher.update(bytes), cipher.final()]);
  return Buffer.concat([nonce, cipher.getAuthTag(), encrypted]);
}

function decryptMedia(encrypted, key, name, size) {
  if (encrypted.length !== size + NONCE_BYTES + TAG_BYTES) throw new Error("Vidéo Match protégée tronquée.");
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, encrypted.subarray(0, NONCE_BYTES));
  decipher.setAAD(associatedData(name, size));
  decipher.setAuthTag(encrypted.subarray(NONCE_BYTES, NONCE_BYTES + TAG_BYTES));
  let bytes;
  try {
    bytes = decipher.update(encrypted.subarray(NONCE_BYTES + TAG_BYTES));
    decipher.final();
    return bytes;
  } catch (error) {
    bytes?.fill(0);
    throw new Error("L’intégrité de la vidéo Match protégée est invalide.", { cause: error });
  }
}

module.exports = { FORMAT_VERSION, MAX_VIDEO_BYTES, MEDIA_NAME, encryptMedia, decryptMedia };
