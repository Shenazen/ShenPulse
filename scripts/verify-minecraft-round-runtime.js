"use strict";

const http = require("node:http");
const WebSocket = require("ws");

const debugPort = Number(process.argv[2] || 9222);

async function main() {
  const pages = await jsonRequest(`http://127.0.0.1:${debugPort}/json`);
  const page = pages.find((entry) => entry.type === "page");
  if (!page?.webSocketDebuggerUrl) {
    throw new Error("Fenêtre ShenPulse introuvable.");
  }
  const client = await connect(page.webSocketDebuggerUrl);
  try {
    await client.call("Runtime.enable");
    const result = await client.evaluate(`
      (async () => {
        const packId = "minecraft-bedrock-box";
        const otherPackId = "minecraft-sandbox-3";
        const original =
          snapshot.state.game.roundSettingsByPack?.[packId] || {
            durationMinutes: 10,
            autoRestart: false
          };
        let verification = {};
        try {
          await api.saveGameRoundSettings(packId, {
            durationMinutes: 10,
            autoRestart: false
          });
          const launch = await api.launchGame(packId);
          if (launch?.snapshot) acceptSnapshot(launch.snapshot);
          const active = await api.getSnapshot();
          const runtime = await api.getGameRuntimeStatus(packId);
          let conflict = "";
          try {
            await api.selectGame(otherPackId);
          } catch (error) {
            conflict = error?.message || String(error);
          }
          syncChrome();
          gameSessionStop.click();
          const stopDeadline = Date.now() + 20_000;
          let stoppedSnapshot = null;
          let stoppedRuntime = null;
          while (Date.now() < stopDeadline) {
            await new Promise((resolve) => setTimeout(resolve, 250));
            stoppedSnapshot = await api.getSnapshot();
            stoppedRuntime = await api.getGameRuntimeStatus(packId);
            if (
              stoppedSnapshot.state.session.game?.running !== true &&
              stoppedRuntime.serverRunning === false
            ) {
              break;
            }
          }
          verification = {
            conflict,
            roundDurationSeconds:
              active.state.session.game?.roundDurationSeconds,
            roundEndsAt: active.state.session.game?.roundEndsAt,
            roundStatus: active.state.session.game?.roundStatus,
            serverRunning: runtime.serverRunning === true,
            sessionPackId: active.state.session.game?.packId,
            serverStoppedByTopButton:
              stoppedRuntime?.serverRunning === false,
            sessionStoppedByTopButton:
              stoppedSnapshot?.state.session.game?.running !== true
          };
        } finally {
          const stopped = await api.stopGameSession().catch(() => null);
          if (stopped) acceptSnapshot(stopped);
          await api.saveGameRoundSettings(packId, original).catch(() => {});
        }
        const stoppedRuntime = await api.getGameRuntimeStatus(packId);
        const stoppedSnapshot = await api.getSnapshot();
        return {
          ...verification,
          serverStopped: stoppedRuntime.serverRunning === false,
          sessionStopped:
            stoppedSnapshot.state.session.game?.running !== true
        };
      })()
    `, true);
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  } finally {
    client.close();
  }
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
              resolve: callResolve,
              reject: callReject
            });
            socket.send(
              JSON.stringify({
                id: sequence,
                method,
                params
              })
            );
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

main().catch((error) => {
  process.stderr.write(`${error.stack || error}\n`);
  process.exitCode = 1;
});
