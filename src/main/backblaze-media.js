"use strict";

const { readState } = require("./state-projection");

const fs = require("node:fs");
const path = require("node:path");
const {
  createHash,
  createHmac,
  randomUUID
} = require("node:crypto");
const { safeString } = require("./utils");

const AUDIO_TYPES = new Map([
  [".m4a", "audio/mp4"],
  [".mp3", "audio/mpeg"],
  [".mp4", "audio/mp4"],
  [".ogg", "audio/ogg"],
  [".wav", "audio/wav"],
  [".webm", "audio/webm"]
]);

const VISUAL_TYPES = new Map([
  [".gif", "image/gif"],
  [".jpeg", "image/jpeg"],
  [".jpg", "image/jpeg"],
  [".mp4", "video/mp4"],
  [".png", "image/png"],
  [".webm", "video/webm"],
  [".webp", "image/webp"]
]);

const MAX_MEDIA_BYTES = 200 * 1024 * 1024;
const UPLOAD_TIMEOUT_MS = 5 * 60 * 1000;

class BackblazeMediaService {
  constructor({ store, environmentPaths = [], fetchImpl = globalThis.fetch, createUpload = null }) {
    this.store = store;
    this.environmentPaths = environmentPaths;
    this.fetch = fetchImpl;
    // L'application distribuée demande une autorisation au serveur ; elle ne
    // reçoit jamais les clés du bucket. Le mode local reste réservé aux outils.
    this.createUpload = typeof createUpload === "function" ? createUpload : null;
  }

  importEnvironmentConfiguration() {
    if (this.createUpload) return this.status();
    const current = readState(this.store, ["settings.backblaze"]).settings.backblaze || {};
    if (current.keyIdSecretId && current.applicationKeySecretId) {
      return this.status();
    }
    const values = this.#readEnvironment();
    if (!values.B2_MEDIA_KEY_ID || !values.B2_MEDIA_APPLICATION_KEY) {
      return this.status();
    }
    const keyIdSecretId = this.store.setSecret(
      current.keyIdSecretId,
      values.B2_MEDIA_KEY_ID
    );
    const applicationKeySecretId = this.store.setSecret(
      current.applicationKeySecretId,
      values.B2_MEDIA_APPLICATION_KEY
    );
    this.store.set("settings.backblaze", {
      ...current,
      bucket: values.B2_MEDIA_BUCKET || current.bucket,
      endpoint: values.B2_MEDIA_ENDPOINT || current.endpoint,
      region: values.B2_MEDIA_REGION || current.region,
      prefix: values.B2_MEDIA_PREFIX || current.prefix,
      publicBaseUrl:
        values.B2_MEDIA_PUBLIC_BASE_URL || current.publicBaseUrl,
      maxBytes: positiveNumber(
        values.B2_MEDIA_MAX_BYTES,
        current.maxBytes
      ),
      keyIdSecretId,
      applicationKeySecretId
    });
    return this.status();
  }

  status() {
    if (this.createUpload) {
      return { configured: true, managed: true, maxBytes: MAX_MEDIA_BYTES };
    }
    try {
      const config = this.#configuration();
      return {
        configured: true,
        bucket: config.bucket,
        maxBytes: config.maxBytes,
        publicBaseUrl: config.publicBaseUrl
      };
    } catch (error) {
      return {
        configured: false,
        message: error.message
      };
    }
  }

  async uploadSound(filePath, options = {}) {
    const media = await this.uploadMedia(filePath, "sound", options);
    return {
      ...media,
      detail: `Son personnalisé Backblaze · ${formatBytes(media.size)}`,
      category: "custom",
      tone: "cyan"
    };
  }

  async uploadMedia(filePath, requestedKind = "visual", { expectedUid = "" } = {}) {
    if (this.createUpload || expectedUid) assertMediaAccount(this.store, expectedUid);
    const absolutePath = path.resolve(String(filePath || ""));
    const extension = path.extname(absolutePath).toLowerCase();
    const typeMap = requestedKind === "sound" ? AUDIO_TYPES : VISUAL_TYPES;
    const contentType = typeMap.get(extension);
    if (!contentType) {
      throw new Error(
        requestedKind === "sound"
          ? "Format audio non pris en charge (MP3, WAV, OGG, M4A, MP4 ou WebM)."
          : "Format média non pris en charge (PNG, JPG, WebP, GIF, MP4 ou WebM)."
      );
    }
    const stats = await fs.promises.stat(absolutePath);
    if (!stats.isFile() || stats.size <= 0) {
      throw new Error("Le fichier sélectionné est vide ou introuvable.");
    }
    const config = this.createUpload ? null : this.#configuration();
    const maxBytes = config?.maxBytes || MAX_MEDIA_BYTES;
    if (stats.size > maxBytes) {
      throw new Error(
        `Fichier trop volumineux. Limite : ${Math.round(maxBytes / 1024 / 1024)} Mo.`
      );
    }
    if (this.createUpload || expectedUid) assertMediaAccount(this.store, expectedUid);
    const localKey = config ? [
      safePathSegment(config.prefix || "mediauploads"),
      "desktop",
      mediaKind(contentType, requestedKind),
      `${randomUUID()}${extension}`
    ].filter(Boolean).join("/") : "";
    const target = this.createUpload
      ? validateManagedUpload(await this.createUpload({
          fileName: path.basename(absolutePath), contentType, size: stats.size, expectedUid
        }), { contentType, size: stats.size, expectedUid })
      : {
          key: localKey,
          uploadUrl: presignPutObjectUrl({ config, key: localKey }),
          publicUrl: publicMediaUrl(config, localKey),
          headers: { "Content-Type": contentType }
        };
    if (this.createUpload || expectedUid) assertMediaAccount(this.store, expectedUid);
    const body = await fs.promises.readFile(absolutePath);
    if (body.length !== stats.size) {
      throw new Error("Le fichier a changé pendant son import. Sélectionnez-le à nouveau.");
    }
    if (this.createUpload || expectedUid) assertMediaAccount(this.store, expectedUid);
    const response = await this.fetch(target.uploadUrl, {
      method: "PUT",
      body,
      headers: {
        ...target.headers,
        "Content-Length": String(body.length),
        "Content-Type": contentType
      },
      // Ni redirection, ni cookies, ni jeton Firebase vers un hôte de stockage.
      redirect: "error",
      credentials: "omit",
      signal: AbortSignal.timeout(UPLOAD_TIMEOUT_MS)
    });
    if (this.createUpload || expectedUid) assertMediaAccount(this.store, expectedUid);
    if (!response.ok) {
      throw new Error(`Upload Backblaze B2 échoué (${response.status}).`);
    }
    const name = safeString(
      path.basename(absolutePath, extension).replace(/[_-]+/g, " "),
      160
    ).trim() || "Média personnalisé";
    const kind = mediaKind(contentType, requestedKind);
    return {
      id: `custom:${randomUUID()}`,
      name,
      detail: `${mediaKindLabel(kind)} personnalisé Backblaze · ${formatBytes(stats.size)}`,
      category: "custom",
      url: target.publicUrl,
      tone: "cyan",
      kind,
      source: "custom",
      contentType,
      key: target.key,
      size: stats.size,
      createdAt: new Date().toISOString()
    };
  }

  #configuration() {
    const settings = readState(this.store, ["settings.backblaze"]).settings.backblaze || {};
    const bucket = validateBucket(settings.bucket);
    const endpoint = validateEndpoint(settings.endpoint);
    const region = safePathSegment(
      settings.region || regionFromEndpoint(endpoint)
    );
    const keyId = this.store.getSecret(settings.keyIdSecretId);
    const applicationKey = this.store.getSecret(
      settings.applicationKeySecretId
    );
    if (!region || !keyId || !applicationKey) {
      throw new Error(
        "Stockage Backblaze incomplet. Vérifiez les paramètres du stockage média."
      );
    }
    return {
      bucket,
      endpoint,
      region,
      keyId,
      applicationKey,
      prefix: safePathSegment(settings.prefix || "mediauploads"),
      publicBaseUrl: validatePublicBaseUrl(settings.publicBaseUrl),
      maxBytes: Math.min(
        MAX_MEDIA_BYTES,
        Math.max(
          1024 * 1024,
          positiveNumber(settings.maxBytes, MAX_MEDIA_BYTES)
        )
      )
    };
  }

  #readEnvironment() {
    for (const environmentPath of this.environmentPaths) {
      try {
        if (!fs.existsSync(environmentPath)) continue;
        return parseEnvironmentFile(
          fs.readFileSync(environmentPath, "utf8")
        );
      } catch {
        // Try the next explicitly configured development source.
      }
    }
    return {};
  }
}

/** Identité locale uniquement : aucun secret ou jeton ne sort de cette vérification. */
function currentMediaAccountUid(store) {
  const session = store?.getAccountSession?.() ||
    readState(store, ["settings.account"]).settings.account || {};
  const uid = String(session.uid || "").trim();
  return typeof store?.getActiveAccountUid === "function" && store.getActiveAccountUid() !== uid
    ? "" : uid;
}

/** Empêche un import commencé sous A d'être ajouté à la bibliothèque de B. */
function assertMediaAccount(store, expectedUid) {
  if (!expectedUid || currentMediaAccountUid(store) !== expectedUid) {
    const error = new Error("Le compte ShenPulse a changé pendant l'import. Recommencez depuis le compte souhaité.");
    error.code = "MEDIA_ACCOUNT_CHANGED";
    throw error;
  }
}

/** Seules les destinations B2 émises par le courtier sont utilisables pour un PUT. */
function validateManagedUpload(payload, { contentType, size, expectedUid }) {
  const invalid = () => new Error("Le service de stockage a renvoyé une autorisation média invalide.");
  const media = payload?.media;
  const upload = payload?.upload;
  if (payload?.ok !== true || upload?.method !== "PUT" ||
      media?.contentType !== contentType || media?.size !== size) throw invalid();
  const key = String(media?.key || "");
  if (!key || key.length > 1024 || /[\\\u0000-\u001f\u007f?#]/.test(key) ||
      key.split("/").some((part) => !part || part === "." || part === "..")) throw invalid();
  if (key.split("/")[1] !== safePathSegment(expectedUid)) throw invalid();
  let uploadUrl, publicUrl;
  try {
    uploadUrl = new URL(upload.url);
    publicUrl = new URL(media.publicUrl);
  } catch { throw invalid(); }
  for (const url of [uploadUrl, publicUrl]) {
    if (url.protocol !== "https:" || url.username || url.password || url.port || url.hash ||
        !url.hostname.endsWith(".backblazeb2.com")) throw invalid();
  }
  if (!/^(?:[a-z0-9][a-z0-9.-]*\.)?s3\.[a-z0-9-]+\.backblazeb2\.com$/i.test(uploadUrl.hostname) ||
      publicUrl.search || !publicUrl.pathname.endsWith(`/${encodeS3Key(key)}`) ||
      !uploadUrl.pathname.endsWith(`/${encodeS3Key(key)}`)) throw invalid();
  if (upload.expiresAt !== undefined) {
    const expiry = typeof upload.expiresAt === "number" ? upload.expiresAt : Date.parse(upload.expiresAt);
    if (!Number.isFinite(expiry) || expiry <= Date.now()) throw invalid();
  }
  const headers = {};
  for (const [name, value] of Object.entries(upload.headers || {})) {
    const lower = name.toLowerCase();
    if (!["content-type", "content-length", "x-amz-content-sha256", "x-amz-checksum-sha256"].includes(lower) ||
        typeof value !== "string" || /[\r\n]/.test(value)) throw invalid();
    if (lower === "content-type" && value !== contentType) throw invalid();
    if (lower === "content-length" && value !== String(size)) throw invalid();
    headers[lower === "content-type" ? "Content-Type" : lower === "content-length" ? "Content-Length" : lower] = value;
  }
  // Ne jamais conserver le jeton signé dans la bibliothèque : seule l'URL
  // publique permanente sera enregistrée et partagée avec les overlays.
  return { key, uploadUrl: uploadUrl.href, publicUrl: publicUrl.href, headers };
}

function presignPutObjectUrl({ config, key, now = new Date(), ttl = 900 }) {
  const amzDate = iso8601Basic(now);
  const dateStamp = amzDate.slice(0, 8);
  const host = `${config.bucket}.${config.endpoint}`;
  const canonicalUri = `/${encodeS3Key(key)}`;
  const credentialScope = `${dateStamp}/${config.region}/s3/aws4_request`;
  const query = {
    "X-Amz-Algorithm": "AWS4-HMAC-SHA256",
    "X-Amz-Credential": `${config.keyId}/${credentialScope}`,
    "X-Amz-Date": amzDate,
    "X-Amz-Expires": String(Math.min(3600, Math.max(60, Number(ttl) || 900))),
    "X-Amz-SignedHeaders": "host"
  };
  const canonicalQuery = Object.entries(query)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(
      ([name, value]) =>
        `${encodeRfc3986(name)}=${encodeRfc3986(value)}`
    )
    .join("&");
  const canonicalRequest = [
    "PUT",
    canonicalUri,
    canonicalQuery,
    `host:${host}\n`,
    "host",
    "UNSIGNED-PAYLOAD"
  ].join("\n");
  const stringToSign = [
    "AWS4-HMAC-SHA256",
    amzDate,
    credentialScope,
    sha256Hex(canonicalRequest)
  ].join("\n");
  const dateKey = hmacBuffer(`AWS4${config.applicationKey}`, dateStamp);
  const regionKey = hmacBuffer(dateKey, config.region);
  const serviceKey = hmacBuffer(regionKey, "s3");
  const signingKey = hmacBuffer(serviceKey, "aws4_request");
  const signature = createHmac("sha256", signingKey)
    .update(stringToSign, "utf8")
    .digest("hex");
  return `https://${host}${canonicalUri}?${canonicalQuery}&X-Amz-Signature=${signature}`;
}

function publicMediaUrl(config, key) {
  const encodedKey = encodeS3Key(key);
  if (config.publicBaseUrl) {
    return `${config.publicBaseUrl.replace(/\/+$/, "")}/${encodedKey}`;
  }
  return `https://${config.bucket}.${config.endpoint}/${encodedKey}`;
}

function parseEnvironmentFile(content) {
  const result = {};
  for (const line of String(content || "").split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (!match || match[1].startsWith("#")) continue;
    result[match[1]] = match[2].replace(/^(['"])(.*)\1$/, "$2");
  }
  return result;
}

function validateBucket(value) {
  const bucket = String(value || "").trim();
  if (!/^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$/.test(bucket)) {
    throw new Error("Nom de bucket Backblaze invalide.");
  }
  return bucket;
}

function validateEndpoint(value) {
  const endpoint = String(value || "")
    .trim()
    .replace(/^https?:\/\//i, "")
    .replace(/\/+$/, "");
  if (!/^s3\.[a-z0-9-]+\.backblazeb2\.com$/i.test(endpoint)) {
    throw new Error("Endpoint Backblaze S3 invalide.");
  }
  return endpoint.toLowerCase();
}

function validatePublicBaseUrl(value) {
  const url = String(value || "").trim().replace(/\/+$/, "");
  if (!url) return "";
  if (!/^https:\/\/[a-z0-9.-]+(?:\/[^?#]*)?$/i.test(url)) {
    throw new Error("URL publique Backblaze invalide.");
  }
  return url;
}

function regionFromEndpoint(endpoint) {
  return String(endpoint || "").match(
    /^s3\.([a-z0-9-]+)\.backblazeb2\.com$/i
  )?.[1] || "";
}

function safePathSegment(value) {
  return String(value || "")
    .trim()
    .replace(/[^a-zA-Z0-9_-]/g, "_")
    .slice(0, 120);
}

function encodeS3Key(value) {
  return String(value || "")
    .split("/")
    .map(encodeRfc3986)
    .join("/");
}

function encodeRfc3986(value) {
  return encodeURIComponent(String(value)).replace(
    /[!'()*]/g,
    (character) =>
      `%${character.charCodeAt(0).toString(16).toUpperCase()}`
  );
}

function iso8601Basic(date) {
  return date.toISOString().replace(/[:-]|\.\d{3}/g, "");
}

function sha256Hex(value) {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function hmacBuffer(key, value) {
  return createHmac("sha256", key).update(value, "utf8").digest();
}

function positiveNumber(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : Number(fallback);
}

function formatBytes(value) {
  const megabytes = Number(value || 0) / 1024 / 1024;
  return megabytes >= 1
    ? `${megabytes.toFixed(megabytes >= 10 ? 0 : 1)} Mo`
    : `${Math.max(1, Math.round(Number(value || 0) / 1024))} Ko`;
}

function mediaKind(contentType, requestedKind) {
  if (requestedKind === "sound" || String(contentType).startsWith("audio/")) {
    return "sound";
  }
  if (String(contentType).startsWith("video/")) return "video";
  if (contentType === "image/gif") return "gif";
  return "image";
}

function mediaKindLabel(kind) {
  return {
    gif: "GIF",
    image: "Image",
    sound: "Son",
    video: "Vidéo"
  }[kind] || "Média";
}

module.exports = {
  AUDIO_TYPES,
  BackblazeMediaService,
  MAX_MEDIA_BYTES,
  VISUAL_TYPES,
  assertMediaAccount,
  currentMediaAccountUid,
  parseEnvironmentFile,
  presignPutObjectUrl,
  publicMediaUrl
};
