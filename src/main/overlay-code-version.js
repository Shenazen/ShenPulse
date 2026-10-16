"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { createHash } = require("node:crypto");

const versions = new Map();
const CODE_DIRECTORIES = new Set(["catalog", "runtime", "styles", "vendor"]);

/** Empreinte réelle du lecteur local, indépendante de la version commerciale.
 * Les ressources empaquetées sont immuables pendant un processus : le calcul
 * est mémorisé par dossier. Aucune vidéo, clé ou donnée de compte n'est lue.
 * Deux installations 2.0.2 aux moteurs différents ne partagent plus les mêmes
 * URL de scripts/CSS dans le cache persistant de TikTok Studio.
 */
function getOverlayCodeVersion(staticDirectory) {
  const directory = path.resolve(staticDirectory);
  const key = process.platform === "win32" ? directory.toLowerCase() : directory;
  if (versions.has(key)) return versions.get(key);
  const files = [];
  const visit = (current, nested = false) => {
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const filename = path.join(current, entry.name);
      // Ne pas suivre de liens symboliques hors du dossier de code empaqueté.
      if (entry.isDirectory() && (nested || CODE_DIRECTORIES.has(entry.name))) {
        visit(filename, true);
      } else if (entry.isFile() && (/\.(?:js|css)$/i.test(entry.name) || !nested && entry.name === "index.html")) {
        files.push(filename);
      }
    }
  };
  visit(directory);
  const hash = createHash("sha256");
  for (const filename of files.sort()) {
    const relative = path.relative(directory, filename).split(path.sep).join("/");
    const bytes = fs.readFileSync(filename);
    hash.update(relative).update("\0").update(String(bytes.length)).update("\0").update(bytes);
  }
  const version = `match-local-${hash.digest("hex").slice(0, 24)}`;
  versions.set(key, version);
  return version;
}

/** Adapte seulement le HTML des routes Match locales. Le site HTTPS et les
 * autres overlays conservent leur propre version de publication. La CSP reste
 * inchangée : aucune instruction inline ni ressource distante n'est ajoutée.
 */
function versionLocalMatchDocument(document, staticDirectory) {
  const version = getOverlayCodeVersion(staticDirectory);
  const metadata = /(<meta\b[^>]*\bname=["']shenpulse-overlay-version["'][^>]*\bcontent=["'])[^"']*(["'][^>]*>)/i;
  let result = String(document);
  if (metadata.test(result)) result = result.replace(metadata, `$1${version}$2`);
  else result = result.replace(/<head>/i, `<head>\n    <meta name="shenpulse-overlay-version" content="${version}" />`);
  return result.replace(/(<(?:script|link)\b[^>]*\b(?:src|href)=)(["'])([^"']+)\2/gi,
    (attribute, prefix, quote, source) => {
      if (!/^(?![a-z][a-z0-9+.-]*:|\/\/)[^?#]+\.(?:js|css|woff2?)(?:\?[^#]*)?(?:#.*)?$/i.test(source)) return attribute;
      const fragmentIndex = source.indexOf("#");
      const fragment = fragmentIndex < 0 ? "" : source.slice(fragmentIndex);
      const value = fragmentIndex < 0 ? source : source.slice(0, fragmentIndex);
      const queryIndex = value.indexOf("?");
      const filename = queryIndex < 0 ? value : value.slice(0, queryIndex);
      const query = new URLSearchParams(queryIndex < 0 ? "" : value.slice(queryIndex + 1));
      query.set("v", version);
      return `${prefix}${quote}${filename}?${query}${fragment}${quote}`;
    });
}

module.exports = { getOverlayCodeVersion, versionLocalMatchDocument };
