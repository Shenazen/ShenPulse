"use strict";

const fs = require("node:fs");
const path = require("node:path");

const GAMES = [
  {
    id: "coin-pusher",
    selector: ".coin-pusher-shell",
    async exercise(window) {
      const configuredSettings = await evaluate(window, () =>
        JSON.parse(
          localStorage.getItem("shenpulse.coinPusher.settings") || "{}"
        )
      );
      if (
        configuredSettings.theme !== "galactic-palace" ||
        configuredSettings.topN !== 4 ||
        configuredSettings.guardGift?.name !== "Bouclier smoke" ||
        configuredSettings.mysteryCube?.multiplierValue !== 2.5 ||
        configuredSettings.tickets?.countPerGift !== 3 ||
        configuredSettings.giftRules?.[0]?.coinCount !== 4
      ) {
        throw new Error(
          "Les réglages complets de Coin Pusher ne sont pas arrivés dans le moteur."
        );
      }
      window.webContents.send("live-event", {
        id: "smoke-coin-gift",
        type: "gift",
        timestamp: new Date().toISOString(),
        user: {
          avatarUrl: "",
          displayName: "Test visuel",
          id: "smoke-viewer",
          name: "smoke_viewer"
        },
        data: {
          count: 2,
          giftId: "rose",
          giftImageUrl: "",
          giftName: "Rose",
          value: 1
        }
      });
      await waitFor(window, () =>
        Boolean(
          document
            .querySelector(".gift-toast")
            ?.textContent?.includes("Test visuel")
        )
      );
      return {
        canvasCount: await evaluate(window, () =>
          document.querySelectorAll(".coin-pusher-canvas").length
        ),
        configuredSettings: {
          giftRuleCoinCount: configuredSettings.giftRules[0].coinCount,
          mysteryMultiplier: configuredSettings.mysteryCube.multiplierValue,
          theme: configuredSettings.theme,
          ticketCount: configuredSettings.tickets.countPerGift,
          topN: configuredSettings.topN
        },
        liveGiftVisible: true,
        webglReady: await evaluate(window, () =>
          document
            .querySelector(".coin-pusher-webgl")
            ?.classList.contains("is-ready")
        )
      };
    }
  },
  {
    id: "connect-four",
    selector: ".connect-shell",
    async exercise(window) {
      await evaluate(window, () =>
        document.querySelector(".launch-mode-button")?.click()
      );
      await waitFor(window, () =>
        document.querySelectorAll(".column-gates button:not(:disabled)").length >
        0
      );
      window.webContents.send("game-effect", {
        effectId: "colonne-aleatoire",
        packId: "connect-four"
      });
      await waitFor(
        window,
        () => document.querySelectorAll(".disc").length === 1
      );
      return {
        columns: await evaluate(window, () =>
          document.querySelectorAll(".column-gates button").length
        ),
        discsAfterInteraction: 1,
        rows: await evaluate(window, () => {
          const columns =
            document.querySelectorAll(".column-gates button").length;
          return (
            document.querySelectorAll(".board-frame .cell-button").length /
            columns
          );
        })
      };
    }
  },
  {
    id: "deal-or-no-deal",
    selector: ".app-shell",
    async exercise(window) {
      const configuredSettings = await evaluate(window, () =>
        JSON.parse(
          localStorage.getItem("shenpulse-deal-or-no-deal-settings") || "{}"
        )
      );
      if (
        configuredSettings.boxValues?.length !== 24 ||
        configuredSettings.entryCost !== 300 ||
        configuredSettings.roundPattern?.join(",") !== "4,3,2,1" ||
        configuredSettings.bankerRequests?.[0]?.amount !== 222 ||
        configuredSettings.music?.waiting?.title !== "Attente smoke" ||
        configuredSettings.music?.waiting?.url !==
          "data:audio/mpeg;base64,SUQz" ||
        configuredSettings.rigging?.selectedBoxBigValueChance !== 0.63 ||
        configuredSettings.spend?.premiumEntryCost !== 1000
      ) {
        throw new Error(
          "Les réglages complets de DealOrNoDeal ne sont pas arrivés dans le moteur."
        );
      }
      const premiumSelected = await evaluate(window, () => {
        const choices = Array.from(
          document.querySelectorAll(".entry-choice-group button")
        );
        const premium = choices[1];
        premium?.click();
        return Boolean(premium);
      });
      if (!premiumSelected) {
        throw new Error(
          "L’option de partie avec multiplicateur est introuvable."
        );
      }
      await waitFor(window, () => {
        const amounts = Array.from(
          document.querySelectorAll(".premium-entry-text")
        );
        return (
          amounts.length === 2 &&
          amounts.every(
            (amount) =>
              amount.scrollWidth <= amount.clientWidth + 1 &&
              amount.scrollHeight <= amount.clientHeight + 1
          )
        );
      });
      const entryBannerAmounts = await evaluate(window, () =>
        Array.from(document.querySelectorAll(".premium-entry-text")).map(
          (amount) => ({
            clientHeight: amount.clientHeight,
            clientWidth: amount.clientWidth,
            fontSize: getComputedStyle(amount).fontSize,
            scrollHeight: amount.scrollHeight,
            scrollWidth: amount.scrollWidth,
            text: amount.textContent.trim()
          })
        )
      );
      await evaluate(window, () =>
        document.querySelector(".lobby-panel .primary-action")?.click()
      );
      await waitFor(
        window,
        () => document.querySelectorAll(".case-box:not(:disabled)").length > 0
      );
      await evaluate(window, () =>
        document.querySelector(".case-box:not(:disabled)")?.click()
      );
      await waitFor(window, () =>
        Boolean(document.querySelector(".case-box.selected"))
      );
      window.webContents.send("game-effect", {
        effectId: "ouvrir-une-boite",
        packId: "deal-or-no-deal"
      });
      await waitFor(
        window,
        () => document.querySelectorAll(".case-box.opened").length === 1,
        4000
      );
      await waitFor(
        window,
        async () => {
          const state = await window.shenPulse.getSmokeDealHostState();
          return (
            state?.boxes?.length === 24 &&
            state?.payoutMultiplier === 2.5 &&
            state.boxes.filter((box) => box.opened).length === 1
          );
        },
        4000
      );
      const privateHostState = await evaluate(
        window,
        () => window.shenPulse.getSmokeDealHostState()
      );
      return {
        boxes: await evaluate(window, () =>
          document.querySelectorAll(".case-box").length
        ),
        configuredSettings: {
          bankerAmount: configuredSettings.bankerRequests[0].amount,
          boxCount: configuredSettings.boxValues.length,
          entryCost: configuredSettings.entryCost,
          riggingChance:
            configuredSettings.rigging.selectedBoxBigValueChance,
          spendPremiumEntryCost:
            configuredSettings.spend.premiumEntryCost
        },
        entryBannerAmounts,
        privateHostState: {
          boxCount: privateHostState.boxes.length,
          effectiveFirstBoxValue: Math.round(
            privateHostState.boxes[0].value *
              privateHostState.payoutMultiplier
          ),
          openedCount: privateHostState.boxes.filter(
            (box) => box.opened
          ).length,
          payoutMultiplier: privateHostState.payoutMultiplier,
          valuesVisible: privateHostState.boxes.every(
            (box) => Number.isFinite(Number(box.value))
          )
        },
        openedAfterInteraction: 1,
        selectedPlayerBox: await evaluate(window, () =>
          document.querySelectorAll(".case-box.selected").length
        )
      };
    }
  }
];

async function runOriginalGamesSmoke({
  BrowserWindow,
  outputDirectory
}) {
  const host = path.join(
    __dirname,
    "..",
    "renderer",
    "games",
    "original",
    "index.html"
  );
  const preload = path.join(__dirname, "original-games-smoke-preload.js");
  await fs.promises.mkdir(outputDirectory, { recursive: true });
  await fs.promises
    .unlink(path.join(outputDirectory, "failure.txt"))
    .catch(() => {});
  const progressPath = path.join(outputDirectory, "progress.log");
  await fs.promises.writeFile(progressPath, "", "utf8");
  const results = [];

  for (const game of GAMES) {
    await appendProgress(progressPath, `${game.id}: démarrage`);
    const errors = [];
    const window = new BrowserWindow({
      width: 1440,
      height: 900,
      show: false,
      backgroundColor: "#050611",
      webPreferences: {
        backgroundThrottling: false,
        contextIsolation: true,
        nodeIntegration: false,
        offscreen: true,
        preload,
        sandbox: true,
        webSecurity: true
      }
    });
    window.webContents.on("console-message", (_event, level, message) => {
      if (level >= 2) errors.push(message);
    });
    window.webContents.on(
      "did-fail-load",
      (_event, code, description) => errors.push(`${code}: ${description}`)
    );

    try {
      await withTimeout(
        window.loadFile(host, { query: { gameId: game.id } }),
        15_000,
        `${game.id}: chargement du fichier`
      );
      await appendProgress(progressPath, `${game.id}: document chargé`);
      await waitFor(
        window,
        (selector) => Boolean(document.querySelector(selector)),
        10_000,
        game.selector
      );
      const gameError = await evaluate(window, () =>
        document.querySelector(".game-error")?.textContent || ""
      );
      if (gameError) throw new Error(`${game.id}: ${gameError}`);

      const assertions = await game.exercise(window);
      await appendProgress(progressPath, `${game.id}: interactions validées`);
      window.webContents.invalidate();
      await delay(800);
      const image = await window.webContents.capturePage();
      const screenshot = path.join(outputDirectory, `${game.id}.png`);
      await fs.promises.writeFile(screenshot, image.toPNG());
      results.push({
        assertions,
        consoleErrors: errors.filter(
          (message) => !message.includes("fonts.googleapis.com")
        ),
        gameId: game.id,
        screenshot
      });
      await appendProgress(progressPath, `${game.id}: capture enregistrée`);
    } catch (error) {
      const consoleDetails = errors.length
        ? `\nConsole:\n${errors.join("\n")}`
        : "";
      throw new Error(
        `${game.id}: ${error?.message || error}${consoleDetails}`,
        { cause: error }
      );
    } finally {
      if (!window.isDestroyed()) window.destroy();
    }
  }

  await fs.promises.writeFile(
    path.join(outputDirectory, "results.json"),
    JSON.stringify(results, null, 2),
    "utf8"
  );
  return results;
}

function evaluate(window, callback, ...args) {
  return window.webContents.executeJavaScript(
    `(${callback.toString()})(...${JSON.stringify(args)})`
  );
}

async function waitFor(window, callback, timeoutMs = 10_000, ...args) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await evaluate(window, callback, ...args)) return;
    await delay(80);
  }
  throw new Error(`Condition non atteinte après ${timeoutMs} ms.`);
}

function delay(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function withTimeout(promise, timeoutMs, label) {
  let timer;
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      timer = setTimeout(
        () => reject(new Error(`${label} a dépassé ${timeoutMs} ms.`)),
        timeoutMs
      );
    })
  ]).finally(() => clearTimeout(timer));
}

function appendProgress(target, message) {
  return fs.promises.appendFile(
    target,
    `${new Date().toISOString()} ${message}\n`,
    "utf8"
  );
}

module.exports = {
  runOriginalGamesSmoke
};
