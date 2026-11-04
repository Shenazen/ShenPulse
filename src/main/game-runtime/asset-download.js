"use strict";

/** Téléchargement en flux : progression limitée, délai d’inactivité, taille et SHA-256 vérifiés. Dépendances injectées via runtime. */
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const { pipeline } = require("node:stream/promises");
const { Readable, Transform } = require("node:stream");
const { ASSET_ORIGIN, ASSET_SECRET, LAUNCHER_VERSION } = require("./constants");
const { safeInstallerAssetUrl, sha256File } = require("./paths");
const { installationSlotPercent } = require("./housekeeping");

async function downloadAsset(runtime, gameId, asset, destinationPath, { index = 0, total = 1, fetchImpl = globalThis.fetch } = {}) {
    const pathname = `/api/installer-assets/${encodeURIComponent(
      gameId
    )}/${encodeURIComponent(asset.id)}`;
    const timestamp = String(Math.floor(Date.now() / 1000));
    const origin =
      process.env.SHENPULSE_INSTALLER_ASSET_ORIGIN || ASSET_ORIGIN;
    const directUrl = safeInstallerAssetUrl(asset.url);
    if (asset.url && !directUrl) throw new Error("Adresse de téléchargement non sûre.");
    const requestUrl = directUrl || `${origin}${pathname}`;
    const headers = {
      "X-ShenPulse-Launcher-Version": LAUNCHER_VERSION
    };
    if (!directUrl) {
      const canonical = `GET\n${pathname}\n${timestamp}`;
      headers["X-ShenPulse-Asset-Timestamp"] = timestamp;
      headers["X-ShenPulse-Asset-Signature"] = crypto
        .createHmac("sha256", ASSET_SECRET)
        .update(canonical)
        .digest("hex");
    }
    const controller = new AbortController();
    const transferStartedAt = Date.now();
    let receivedBytes = 0;
    let lastReportAt = 0;
    let stalled = false;
    let stallTimer = 0;
    const partialPath = `${destinationPath}.partial`;
    let partialCreated = false;
    let expectedLength = Number(asset.size || 0);
    const resetStallTimer = () => {
      clearTimeout(stallTimer);
      stallTimer = setTimeout(() => {
        stalled = true;
        controller.abort();
      }, 60_000);
    };
    resetStallTimer();
    try {
      const report = (force = false) => {
        const now = Date.now();
        if (!force && now - lastReportAt < 200) return;
        lastReportAt = now;
        const elapsedSeconds = Math.max(
          0.001,
          (now - transferStartedAt) / 1000
        );
        const speedBps = receivedBytes / elapsedSeconds;
        const downloadRatio = expectedLength
          ? Math.min(1, receivedBytes / expectedLength)
          : 0;
        runtime.progress(gameId, {
          phase: "download",
          current: index + 1,
          total,
          percent: installationSlotPercent(
            index,
            total,
            expectedLength ? downloadRatio * 0.82 : 0.06
          ),
          downloadPercent: expectedLength
            ? Math.round(downloadRatio * 100)
            : null,
          indeterminate: !expectedLength,
          bytesReceived: receivedBytes,
          totalBytes: expectedLength,
          speedBps: Math.round(speedBps),
          etaSeconds:
            expectedLength && speedBps > 0
              ? Math.max(
                  0,
                  Math.round((expectedLength - receivedBytes) / speedBps)
                )
              : null,
          transferStartedAt: new Date(transferStartedAt).toISOString(),
          message: `Téléchargement en cours (${index + 1}/${total})`
        });
      };
      report(true);
      await fs.promises.mkdir(path.dirname(destinationPath), {
        recursive: true
      });
      // Une coupure réseau conserve uniquement notre fichier temporaire. Le
      // serveur doit confirmer l'offset avant toute écriture en ajout.
      for (let attempt = 0; ; attempt++) {
        try {
          resetStallTimer();
          const offset = receivedBytes;
          const response = await fetchImpl(requestUrl, {
            headers: { ...headers, ...(offset ? { Range: `bytes=${offset}-` } : {}) },
            redirect: directUrl ? "follow" : "error",
            signal: controller.signal
          });
          if (!response.ok || !response.body) {
            throw new Error(`Le serveur d’installation ne répond pas correctement (code ${response.status}). Réessayez dans quelques instants.`);
          }
          const responseLength = Number(response.headers.get("content-length") || 0);
          let append = false;
          if (response.status === 206) {
            const range = /^bytes (\d+)-(\d+)\/(\d+)$/.exec(response.headers.get("content-range") || "");
            if (!range || Number(range[1]) !== offset || Number(range[2]) < offset ||
              (expectedLength && Number(range[3]) !== expectedLength) ||
              Number(range[2]) !== Number(range[3]) - 1 ||
              (responseLength && responseLength !== Number(range[2]) - offset + 1)) {
              await response.body.cancel().catch(() => {});
              throw new Error("Le serveur n’a pas confirmé correctement la reprise du téléchargement.");
            }
            expectedLength ||= Number(range[3]);
            append = offset > 0;
          } else {
            if (responseLength && asset.size && responseLength !== Number(asset.size)) {
              await response.body.cancel().catch(() => {});
              throw new Error("Le fichier distant ne correspond pas à la version publiée.");
            }
            expectedLength ||= responseLength;
            // Un serveur sans support Range renvoie le fichier entier : repartir
            // à zéro, sans jamais concaténer deux copies d'une archive.
            receivedBytes = 0;
          }
          const meter = new Transform({
            transform: (chunk, _encoding, callback) => {
              receivedBytes += chunk.length;
              resetStallTimer();
              report(receivedBytes === expectedLength);
              callback(null, chunk);
            }
          });
          const partialFile = await fs.promises.open(partialPath, partialCreated ? append ? "a" : "w" : "wx");
          partialCreated = true;
          await pipeline(Readable.fromWeb(response.body), meter, partialFile.createWriteStream());
          break;
        } catch (error) {
          const code = error?.cause?.code || error?.code;
          const interrupted = error instanceof TypeError || ["ECONNRESET", "ENETUNREACH", "ETIMEDOUT", "UND_ERR_SOCKET", "UND_ERR_BODY_TIMEOUT", "UND_ERR_CONNECT_TIMEOUT"].includes(code);
          if (!interrupted || stalled || attempt >= 3) throw error;
          // Le compteur de lecture peut précéder l'écriture lors d'une coupure.
          // Reprendre depuis la taille effectivement enregistrée, pas lue.
          receivedBytes = partialCreated ? (await fs.promises.stat(partialPath)).size : 0;
          console.warn("[game-installer] Reprise du téléchargement", { gameId, assetId: asset.id, bytes: receivedBytes, attempt: attempt + 1, code: code || error.name });
          runtime.progress(gameId, { phase: "download", message: "Connexion interrompue : reprise automatique du téléchargement…" });
          await new Promise(resolve => setTimeout(resolve, 250 * (attempt + 1)));
        }
      }
      report(true);
      const stat = await fs.promises.stat(partialPath);
      if (stat.size < 1) {
        throw new Error(
          "Le serveur a renvoyé un téléchargement vide. Réessayez dans quelques instants."
        );
      }
      if (expectedLength && stat.size !== expectedLength) {
        throw new Error(
          "Le téléchargement a été interrompu avant la fin. ShenPulse a supprimé le fichier incomplet ; vous pouvez réessayer."
        );
      }
      if (asset.sha256) {
        const actualHash = await sha256File(partialPath);
        if (
          actualHash.toLowerCase() !==
          String(asset.sha256).toLowerCase()
        ) {
          throw new Error(
            "Le contrôle d’intégrité du téléchargement a échoué. Le fichier a été refusé."
          );
        }
      }
      await fs.promises.rename(partialPath, destinationPath);
    } catch (error) {
      if (stalled || error?.name === "AbortError") {
        throw new Error(
          "Le téléchargement ne reçoit plus de données depuis une minute. Vérifiez votre connexion puis réessayez."
        );
      }
      if (error?.code === "ENOSPC") {
        throw new Error(
          "L’espace disque disponible est insuffisant pour terminer l’installation."
        );
      }
      if (error?.code === "EACCES" || error?.code === "EPERM") {
        throw new Error(
          "ShenPulse ne peut pas enregistrer les fichiers dans ce dossier. Fermez le jeu et réessayez."
        );
      }
      if (
        error instanceof TypeError ||
        ["ECONNRESET", "ENETUNREACH", "ETIMEDOUT"].includes(
          error?.cause?.code || error?.code
        )
      ) {
        throw new Error(
          "Impossible de contacter le serveur d’installation. Vérifiez votre connexion Internet puis réessayez.", { cause: error }
        );
      }
      throw error;
    } finally {
      clearTimeout(stallTimer);
      controller.abort();
      if (partialCreated) await fs.promises.rm(partialPath, { force: true }).catch(() => {});
    }
  }

module.exports = { downloadAsset };

