"use strict";

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

function jsonRequest(url) {
  return new Promise((resolve, reject) => {
    http
      .get(url, (response) => {
        let body = "";
        response.setEncoding("utf8");
        response.on("data", (chunk) => {
          body += chunk;
        });
        response.on("end", () => {
          try {
            resolve(JSON.parse(body));
          } catch (error) {
            reject(error);
          }
        });
      })
      .on("error", reject);
  });
}

function connect(url) {
  return new Promise((resolve, reject) => {
    const socket = new WebSocket(url);
    const pending = new Map();
    let sequence = 0;
    socket.once("error", reject);
    socket.once("open", () => {
      resolve({
        call(method, params = {}) {
          return new Promise((callResolve, callReject) => {
            sequence += 1;
            pending.set(sequence, {
              reject: callReject,
              resolve: callResolve
            });
            socket.send(JSON.stringify({ id: sequence, method, params }));
          });
        },
        close() {
          socket.close();
        },
        evaluate(expression, awaitPromise = false) {
          return this.call("Runtime.evaluate", {
            awaitPromise,
            expression,
            returnByValue: true,
            userGesture: true
          }).then((response) => {
            if (response.exceptionDetails) {
              throw new Error(
                response.exceptionDetails.exception?.description ||
                  response.exceptionDetails.text ||
                  "Évaluation Electron impossible."
              );
            }
            return response.result?.value;
          });
        }
      });
    });
    socket.on("message", (payload) => {
      const message = JSON.parse(String(payload));
      if (!message.id || !pending.has(message.id)) return;
      const request = pending.get(message.id);
      pending.delete(message.id);
      if (message.error) request.reject(new Error(message.error.message));
      else request.resolve(message.result);
    });
  });
}

function wait(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
