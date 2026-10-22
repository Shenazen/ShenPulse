"use strict";

const { LiveDirectoryService } = require("../../src/main/live-directory-service");

/** Le navigateur consulte le même annuaire public qu’Electron, sans publier de LIVE. */
function createPreviewLiveDirectory({ service = new LiveDirectoryService() } = {}) {
  const clients = new Set();
  const status = () => {
    const { available, connected, rows, capped, error } = service.status();
    return { available, connected, rows, capped, error };
  };
  const frame = () => `event: live-directory-status\ndata: ${JSON.stringify(status())}\n\n`;
  service.on("changed", () => {
    const message = frame();
    for (const response of clients) {
      if (response.destroyed || response.writableLength > 512000) {
        clients.delete(response);
        response.end();
      } else response.write(message);
    }
  });
  return {
    status,
    start: () => service.start(),
    async stop() {
      for (const response of clients) response.end();
      clients.clear();
      await service.stop();
    },
    connect(request, response) {
      response.writeHead(200, { "Content-Type": "text/event-stream", "Cache-Control": "no-cache, no-store", Connection: "keep-alive" });
      response.write(`retry: 3000\n${frame()}`);
      clients.add(response);
      request.on("close", () => clients.delete(response));
    }
  };
}

module.exports = { createPreviewLiveDirectory };
