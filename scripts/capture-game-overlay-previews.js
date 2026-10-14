"use strict";

const { jsonRequest, connect } = require("./lib/cdp-client");

const fs = require("node:fs");
const http = require("node:http");
const path = require("node:path");
const WebSocket = require("ws");

const debugPort = Number(process.argv[2] || 9222);
const outputDirectory = path.resolve(
  __dirname,
  "..",
  ".artifacts",
  "game-overlay-previews"
);
const gameIds = [
  "minecraft-bedrock-box",
  "gtav-montchiliad"
];

async function main() {
  fs.mkdirSync(outputDirectory, { recursive: true });
  const pages = await jsonRequest(`http://127.0.0.1:${debugPort}/json`);
  const page = pages.find((entry) => entry.type === "page");
  if (!page?.webSocketDebuggerUrl) {
    throw new Error("Fenêtre ShenPulse introuvable sur le port de diagnostic.");
  }
  const client = await connect(page.webSocketDebuggerUrl);
  try {
    await client.call("Page.enable");
    await client.call("Runtime.enable");
    for (const gameId of gameIds) {
      await client.evaluate(`
        (async () => {
          const pack = snapshot.packs.find(
            (entry) => entry.id === ${JSON.stringify(gameId)}
          );
          if (!pack) throw new Error("Pack absent");
          selectedGameId = pack.id;
          gamePageMode = "detail";
          gameWorkspaceStep = "overlays";
          if (dialog?.open) dialog.close();
          pageKicker.textContent = "JEUX INTERACTIFS";
          pageTitle.textContent = pack.name;
          content.innerHTML = renderGameWorkspace(pack);
          content.scrollTop = 0;
          return true;
        })()
      `, true);
      await wait(800);
      const pageCapture = await client.call("Page.captureScreenshot", {
        captureBeyondViewport: false,
        format: "png",
        fromSurface: true
      });
      fs.writeFileSync(
        path.join(outputDirectory, `${gameId}-page.png`),
        Buffer.from(pageCapture.data, "base64")
      );
      for (const model of [1, 2]) {
        const rendered = await client.evaluate(`
          (async () => {
            const pack = snapshot.packs.find(
              (entry) => entry.id === ${JSON.stringify(gameId)}
            );
            if (!pack) throw new Error("Pack absent");
            const entries = gameInteractionOverlayEntries(pack);
            const canvas = await ShenPulseGameOverlay.renderMinecraftStyledOverlay({
              backgroundColor: gameInteractionOverlayBackground(pack.id),
              entries: entries.map((entry) => ({
                effectImageUrl: entry.effectImageUrl,
                giftImageUrl: entry.giftImageUrl,
                giftLabel: entry.giftLabel,
                groupKey: entry.groupKey,
                label: entry.title,
                likeAmount: entry.likeAmount,
                triggerKey: entry.triggerKey,
                triggerType: entry.triggerType
              })),
              model: ${model}
            });
            return {
              dataUrl: canvas.toDataURL("image/png"),
              entryCount: entries.length,
              height: canvas.height,
              width: canvas.width
            };
          })()
        `, true);
        if (!rendered?.dataUrl) {
          throw new Error(
            `Le modèle ${model} de ${gameId} n’a produit aucune image.`
          );
        }
        const base64 = rendered.dataUrl.replace(
          /^data:image\/png;base64,/,
          ""
        );
        fs.writeFileSync(
          path.join(outputDirectory, `${gameId}-modele-${model}.png`),
          Buffer.from(base64, "base64")
        );
        process.stdout.write(
          `${gameId} modèle ${model}: ${rendered.width}x${rendered.height}, ` +
          `${rendered.entryCount} interaction(s)\n`
        );
      }
      if (gameId === "minecraft-bedrock-box") {
        await client.evaluate(`
          (() => {
            const pack = snapshot.packs.find(
              (entry) => entry.id === "minecraft-bedrock-box"
            );
            gameWorkspaceStep = "launch";
            content.innerHTML = renderGameWorkspace(pack);
            content.scrollTop = 0;
            return true;
          })()
        `, true);
        await wait(500);
        const launchCapture = await client.call("Page.captureScreenshot", {
          captureBeyondViewport: false,
          format: "png",
          fromSurface: true
        });
        fs.writeFileSync(
          path.join(outputDirectory, `${gameId}-launch-page.png`),
          Buffer.from(launchCapture.data, "base64")
        );
      }
    }
    await client.evaluate(`
      (async () => {
        currentPage = "dashboard";
        gamePageMode = "catalog";
        render();
        content.scrollTop = 0;
        return true;
      })()
    `, true);
  } finally {
    client.close();
  }
  process.stdout.write(`${outputDirectory}\n`);
}

function wait(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

main().catch((error) => {
  process.stderr.write(`${error.stack || error}\n`);
  process.exitCode = 1;
});
