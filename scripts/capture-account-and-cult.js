"use strict";

const { jsonRequest, connect } = require("./lib/cdp-client");

const fs = require("node:fs");
const http = require("node:http");
const path = require("node:path");
const WebSocket = require("ws");

const debugPort = Number(process.argv[2] || 9231);
const outputDirectory = path.resolve(
  __dirname,
  "..",
  "release",
  "ui-verification"
);

async function main() {
  fs.mkdirSync(outputDirectory, { recursive: true });
  const pages = await waitForPages();
  const page = pages.find((entry) => entry.type === "page");
  if (!page?.webSocketDebuggerUrl) {
    throw new Error("Fenêtre ShenPulse introuvable.");
  }
  const client = await connect(page.webSocketDebuggerUrl);
  try {
    await client.call("Page.enable");
    await client.call("Runtime.enable");
    await client.evaluate("document.fonts.ready", true);
    await wait(800);

    await capture(client, "01-compte-requis.png");
    await client.evaluate(
      'document.getElementById("account-auth-cta").click()'
    );
    await wait(300);
    await capture(client, "02-connexion.png");

    await client.evaluate(
      'document.querySelector("[data-account-command=register]").click()'
    );
    await wait(300);
    await capture(client, "03-inscription.png");

    await client.evaluate(`
      (() => {
        if (dialog?.open) dialog.close();
        const pack = snapshot.packs.find(
          (entry) => entry.id === "cult-of-the-lamb"
        );
        if (!pack) throw new Error("Pack Cult of the Lamb absent");
        selectedGameId = pack.id;
        gamePageMode = "detail";
        gameWorkspaceStep = "overlays";
        pageKicker.textContent = "JEUX INTERACTIFS";
        pageTitle.textContent = pack.name;
        content.innerHTML = renderGameWorkspace(pack);
        content.scrollTop = 0;
        return true;
      })()
    `, true);
    await wait(500);
    await capture(client, "04-cult-sans-overlays.png");
    await client.call("Browser.close").catch(() => {});
  } finally {
    client.close();
  }
  process.stdout.write(`${outputDirectory}\n`);
}

async function capture(client, fileName) {
  const result = await client.call("Page.captureScreenshot", {
    captureBeyondViewport: false,
    format: "png",
    fromSurface: true
  });
  fs.writeFileSync(
    path.join(outputDirectory, fileName),
    Buffer.from(result.data, "base64")
  );
}

async function waitForPages() {
  const deadline = Date.now() + 30000;
  let lastError;
  while (Date.now() < deadline) {
    try {
      const pages = await jsonRequest(
        `http://127.0.0.1:${debugPort}/json`
      );
      if (Array.isArray(pages) && pages.length) return pages;
    } catch (error) {
      lastError = error;
    }
    await wait(250);
  }
  throw lastError || new Error("Diagnostic Electron indisponible.");
}


function wait(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
