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
    const resetStallTimer = () => {
      clearTimeout(stallTimer);
      stallTimer = setTimeout(() => {
        stalled = true;
        controller.abort();
      }, 60_000);
    };
    resetStallTimer();
    try {
      const response = await fetchImpl(requestUrl, {
        headers,
        redirect: directUrl ? "follow" : "error",
        signal: controller.signal
      });
      if (!response.ok || !response.body) {
        throw new Error(
          `Le serveur d’installation ne répond pas correctement (code ${response.status}). Réessayez dans quelques instants.`
        );
      }
      const responseLength = Number(
        response.headers.get("content-length") || 0
      );
      const expectedLength = Number(asset.size || responseLength || 0);
      if (
        responseLength &&
        asset.size &&
        responseLength !== Number(asset.size)
      ) {
        throw new Error(
          "Le fichier distant ne correspond pas à la version publiée."
        );
      }
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
      const meter = new Transform({
        transform: (chunk, _encoding, callback) => {
          receivedBytes += chunk.length;
          resetStallTimer();
          report(receivedBytes === expectedLength);
          callback(null, chunk);
        }
      });
      const partialFile = await fs.promises.open(partialPath, "wx");
      partialCreated = true;
      await pipeline(
        Readable.fromWeb(response.body),
        meter,
        partialFile.createWriteStream()
      );
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
          "Impossible de contacter le serveur d’installation. Vérifiez votre connexion Internet puis réessayez."
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

