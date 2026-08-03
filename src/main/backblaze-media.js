"use strict";

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

class BackblazeMediaService {
  constructor({ store, environmentPaths = [], fetchImpl = globalThis.fetch }) {
    this.store = store;
    this.environmentPaths = environmentPaths;
    this.fetch = fetchImpl;
  }

  importEnvironmentConfiguration() {
    const current = this.store.getState().settings.backblaze || {};
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

  async uploadSound(filePath) {
    const media = await this.uploadMedia(filePath, "sound");
    return {
      ...media,
      detail: `Son personnalisé Backblaze · ${formatBytes(media.size)}`,
      category: "custom",
      tone: "cyan"
    };
  }

  async uploadMedia(filePath, requestedKind = "visual") {
    const config = this.#configuration();
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
    if (stats.size > config.maxBytes) {
      throw new Error(
        `Fichier trop volumineux. Limite : ${Math.round(config.maxBytes / 1024 / 1024)} Mo.`
      );
    }
    const key = [
      safePathSegment(config.prefix || "mediauploads"),
      "desktop",
      mediaKind(contentType, requestedKind),
      `${randomUUID()}${extension}`
    ].filter(Boolean).join("/");
    const uploadUrl = presignPutObjectUrl({ config, key });
    const body = await fs.promises.readFile(absolutePath);
    const response = await this.fetch(uploadUrl, {
      method: "PUT",
      body,
      headers: {
        "Content-Length": String(body.length),
        "Content-Type": contentType
      }
    });
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
      url: publicMediaUrl(config, key),
      tone: "cyan",
      kind,
      source: "custom",
      contentType,
      key,
      size: stats.size,
      createdAt: new Date().toISOString()
    };
  }

  #configuration() {
    const settings = this.store.getState().settings.backblaze || {};
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
        200 * 1024 * 1024,
        Math.max(
          1024 * 1024,
          positiveNumber(settings.maxBytes, 200 * 1024 * 1024)
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
  VISUAL_TYPES,
  parseEnvironmentFile,
  presignPutObjectUrl,
  publicMediaUrl
};
