"use strict";

const crypto = require("node:crypto");
const http = require("node:http");
const { GOOGLE_LOOPBACK_PORT } = require("./constants");
const { googleBrowserCallbackHtml } = require("./callback-pages");

/** Reçoit le fragment OpenID en POST local ; jamais transmis à un serveur distant depuis cette page. */
async function createGoogleIdTokenLoopback({
  port = GOOGLE_LOOPBACK_PORT,
  timeoutMs
}) {
  return new Promise((resolve, reject) => {
    let expectedState = "";
    let settled = false;
    let timeout = null;
    let resolveResult;
    let rejectResult;
    const result = new Promise((resolveCallback, rejectCallback) => {
      resolveResult = resolveCallback;
      rejectResult = rejectCallback;
    });
    // Une erreur de préparation peut fermer le serveur avant que l'appelant
    // commence à attendre le résultat.
    result.catch(() => {});

    const finish = (error, value) => {
      if (settled) return false;
      settled = true;
      if (timeout) clearTimeout(timeout);
      server.close(() => {});
      if (error) rejectResult(error);
      else resolveResult(value);
      return true;
    };
    const respondJson = (response, status, payload) => {
      response.writeHead(status, {
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "no-store",
        "Referrer-Policy": "no-referrer",
        "X-Content-Type-Options": "nosniff"
      });
      response.end(JSON.stringify(payload));
    };
    const server = http.createServer((request, response) => {
      let target;
      try {
        target = new URL(request.url || "/", "http://localhost");
      } catch {
        response.writeHead(400).end();
        return;
      }
      if (request.method === "GET" && target.pathname === "/callback") {
        response.writeHead(200, {
          "Content-Type": "text/html; charset=utf-8",
          "Content-Security-Policy":
            "default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; connect-src 'self'",
          "Cache-Control": "no-store",
          "Referrer-Policy": "no-referrer",
          "X-Content-Type-Options": "nosniff"
        });
        response.end(googleBrowserCallbackHtml());
        return;
      }
      if (
        request.method !== "POST" ||
        target.pathname !== "/callback/complete"
      ) {
        response.writeHead(404).end();
        return;
      }

      let body = "";
      request.setEncoding("utf8");
      request.on("data", (chunk) => {
        body += chunk;
        if (body.length > 32 * 1024) request.destroy();
      });
      request.on("end", () => {
        let payload;
        try {
          payload = JSON.parse(body || "{}");
        } catch {
          respondJson(response, 400, { ok: false });
          finish(new Error("Le retour Google est illisible."));
          return;
        }
        const receivedState = String(payload.state || "");
        const idToken = String(payload.idToken || "");
        const browserError = String(payload.error || "").trim();
        const receivedStateBytes = Buffer.from(receivedState);
        const expectedStateBytes = Buffer.from(expectedState);
        const stateMatches = Boolean(
          expectedStateBytes.length &&
          receivedStateBytes.length === expectedStateBytes.length &&
          crypto.timingSafeEqual(receivedStateBytes, expectedStateBytes)
        );
        if (
          !stateMatches ||
          browserError ||
          !/^[A-Za-z0-9._-]{100,20000}$/.test(idToken)
        ) {
          respondJson(response, 400, { ok: false });
          finish(
            new Error(
              browserError ||
                "Le retour Google n'a pas pu être vérifié."
            )
          );
          return;
        }
        respondJson(response, 200, { ok: true });
        finish(null, { idToken });
      });
      request.on("error", (error) => finish(error));
    });

    server.once("error", reject);
    server.listen(Number(port), "127.0.0.1", () => {
      const address = server.address();
      if (!address || typeof address === "string") {
        server.close(() => {});
        reject(
          new Error("Le retour local de connexion est indisponible.")
        );
        return;
      }
      timeout = setTimeout(
        () =>
          finish(
            new Error(
              "La connexion Google a expiré. Relancez-la depuis ShenPulse."
            )
          ),
        timeoutMs
      );
      resolve({
        close: () =>
          finish(
            new Error("La connexion Google a été interrompue.")
          ),
        expectState: (value) => {
          expectedState = String(value || "");
        },
        result,
        url: `http://localhost:${address.port}/callback`
      });
    });
  });
}

module.exports = { createGoogleIdTokenLoopback };
