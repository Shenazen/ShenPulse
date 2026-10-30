"use strict";

const crypto = require("node:crypto");
const http = require("node:http");
const { paymentResponseHtml } = require("./callback-pages");

/** Retour PayPal local : état vérifié, annulation explicite et résultat réglé une seule fois. */
async function createPaymentLoopbackCallback({ state, timeoutMs }) {
  return new Promise((resolve, reject) => {
    let ready = false;
    let settled = false;
    let timeout = null;
    let resolveResult;
    let rejectResult;
    const result = new Promise((resolveCallback, rejectCallback) => {
      resolveResult = resolveCallback;
      rejectResult = rejectCallback;
    });
    // Le résultat peut être fermé avant que l'appelant commence à l'attendre.
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
    const server = http.createServer((request, response) => {
      let target;
      try {
        target = new URL(request.url || "/", "http://127.0.0.1");
      } catch {
        response.writeHead(400).end();
        return;
      }
      if (target.pathname !== "/payment-callback") {
        response.writeHead(404).end();
        return;
      }

      const receivedState = target.searchParams.get("state") || "";
      const status = target.searchParams.get("status") || "";
      const stateMatches =
        Buffer.byteLength(receivedState) === Buffer.byteLength(state) &&
        crypto.timingSafeEqual(
          Buffer.from(receivedState),
          Buffer.from(state)
        );
      if (
        !stateMatches ||
        !["success", "cancelled"].includes(status)
      ) {
        response.writeHead(400, {
          "Content-Type": "text/html; charset=utf-8",
          "Content-Security-Policy":
            "default-src 'none'; style-src 'unsafe-inline'"
        });
        response.end(paymentResponseHtml("error"));
        finish(
          new Error(
            "Le retour du paiement n’a pas pu être vérifié par ShenPulse."
          )
        );
        return;
      }

      response.writeHead(200, {
        "Content-Type": "text/html; charset=utf-8",
        "Content-Security-Policy":
          "default-src 'none'; style-src 'unsafe-inline'",
        "Cache-Control": "no-store"
      });
      response.end(paymentResponseHtml(status));
      finish(null, {
        cancelled: status === "cancelled",
        ...(target.searchParams.has("session_id") ? { sessionId: String(target.searchParams.get("session_id") || "").trim() } : {}),
        subscriptionId: String(
          target.searchParams.get("subscription_id") ||
          target.searchParams.get("subscriptionId") ||
          ""
        ).trim(),
        token: String(target.searchParams.get("token") || "").trim()
      });
    });

    server.once("error", (error) => {
      if (!ready) reject(error);
      else finish(error);
    });
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (!address || typeof address === "string") {
        const error = new Error(
          "Le retour local de paiement est indisponible."
        );
        server.close(() => {});
        reject(error);
        return;
      }
      ready = true;
      timeout = setTimeout(
        () =>
          finish(
            new Error(
              "Le paiement a expiré. Relancez-le depuis ShenPulse."
            )
          ),
        timeoutMs
      );
      resolve({
        cancel: () =>
          finish(null, {
            cancelled: true,
            subscriptionId: "",
            token: ""
          }),
        close: () => finish(null, { closed: true }),
        port: address.port,
        result
      });
    });
  });
}

module.exports = { createPaymentLoopbackCallback };
