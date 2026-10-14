"use strict";

const crypto = require("node:crypto");
const http = require("node:http");
const { browserResponseHtml } = require("./callback-pages");

/** Ancien retour OAuth local : comparaison constante de l'état et délai conservé. */
async function createLoopbackCallback({
  onReady,
  state,
  timeoutMs
}) {
  return new Promise((resolve, reject) => {
    let settled = false;
    const finish = (error, value) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      server.close(() => {});
      if (error) reject(error);
      else resolve(value);
    };
    const server = http.createServer((request, response) => {
      let target;
      try {
        target = new URL(
          request.url || "/",
          "http://127.0.0.1"
        );
      } catch {
        response.writeHead(400).end();
        return;
      }
      if (target.pathname !== "/callback") {
        response.writeHead(404).end();
        return;
      }
      const receivedState = target.searchParams.get("state") || "";
      const code = target.searchParams.get("code") || "";
      const error = target.searchParams.get("error") || "";
      const stateMatches =
        receivedState.length === state.length &&
        crypto.timingSafeEqual(
          Buffer.from(receivedState),
          Buffer.from(state)
        );
      if (!stateMatches || !code || error) {
        response.writeHead(400, {
          "Content-Type": "text/html; charset=utf-8",
          "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'"
        });
        response.end(browserResponseHtml(false));
        finish(
          new Error(
            error ||
              "Le retour du navigateur n’a pas pu être vérifié."
          )
        );
        return;
      }
      response.writeHead(200, {
        "Content-Type": "text/html; charset=utf-8",
        "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'"
      });
      response.end(browserResponseHtml(true));
      finish(null, { code });
    });
    const timeout = setTimeout(
      () =>
        finish(
          new Error(
            "La connexion a expiré. Relancez-la depuis ShenPulse."
          )
        ),
      timeoutMs
    );
    server.once("error", (error) => finish(error));
    server.listen(0, "127.0.0.1", async () => {
      try {
        const address = server.address();
        if (!address || typeof address === "string") {
          throw new Error("Le retour local de connexion est indisponible.");
        }
        await onReady(
          `http://127.0.0.1:${address.port}/callback`
        );
      } catch (error) {
        finish(error);
      }
    });
  });
}

module.exports = { createLoopbackCallback };
