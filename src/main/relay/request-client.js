"use strict";

/** Transport du relais : annulation par canal, délai borné et lecture des erreurs Firebase. */
function abortRequests(context, channelId = "") {
    const channelPath = channelId ? `/${encodeURIComponent(channelId)}.json` : "";
    for (const [controller, url] of context.requestControllers) {
      if (channelPath && !url.includes(channelPath)) continue;
      controller.abort(new DOMException("Requête du relais annulée.", "AbortError"));
    }
  }

async function requestRelay(context, url, options, readResponse = (response) => response) {
    const controller = new AbortController();
    context.requestControllers.set(controller, String(url));
    let timeout;
    const cancelled = new Promise((resolve, reject) => {
      controller.signal.addEventListener("abort", () => reject(controller.signal.reason), { once: true });
      timeout = setTimeout(() => {
        const error = new Error("Le relais Firebase n’a pas répondu dans le délai prévu.");
        error.name = "TimeoutError";
        controller.abort(error);
      }, context.requestTimeoutMs);
      timeout.unref?.();
    });
    try {
      return await Promise.race([
        Promise.resolve().then(() => context.fetch(url, { ...options, signal: controller.signal }))
          .then(readResponse),
        cancelled
      ]);
    } finally {
      clearTimeout(timeout);
      context.requestControllers.delete(controller);
    }
  }

function requestJson(context, url, options) {
    return requestRelay(context, url, options, async (response) => {
      const text = await response.text();
      let body = {};
      try {
        body = text ? JSON.parse(text) : {};
      } catch {
        body = {};
      }
      if (!response.ok) {
        const message =
          body?.error?.message ||
          body?.error ||
          `Requête Firebase refusée (${response.status}).`;
        const error = new Error(String(message));
        error.status = response.status;
        throw error;
      }
      return body;
    });
  }

module.exports = { abortRequests, requestRelay, requestJson };

