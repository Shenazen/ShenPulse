"use strict";
(() => {
  let handler, socket, ready = false;
  const ticket = new URL(location.href).searchParams.get("ticket");
  const send = value => {
    if (socket?.readyState === WebSocket.OPEN) socket.send(JSON.stringify(value));
  };
  function connect() {
    socket = new WebSocket("ws://" + location.host + "/bridge?ticket=" + encodeURIComponent(ticket));
    socket.onopen = () => { if (ready) send({type: "ready"}); };
    socket.onmessage = async event => {
      let request;
      try {
        request = JSON.parse(event.data);
        if (request.type !== "effect" || !Number.isSafeInteger(request.id)) return;
        if (!handler) throw new Error("Le jeu n’est pas encore prêt.");
        const result = await handler(request.payload);
        send({type: "result", id: request.id, result});
      } catch (error) {
        if (request?.id) send({type: "result", id: request.id, result: {success: false, message: String(error.message || error).slice(0,300)}});
      }
    };
    socket.onclose = () => setTimeout(connect, 1500);
    socket.onerror = () => socket.close();
  }
  Object.defineProperty(window, "ShenPulseGame", {value: Object.freeze({
    onCommand(callback) { if (typeof callback !== "function") throw new Error("Commande invalide"); handler = callback; },
    ready() { ready = true; send({type: "ready"}); return Promise.resolve(); },
    sendEvent(value) { send({type: "event", value}); },
    sendStats() {},
    sendError(value) { send({type: "game-error", message: String(value?.message || value || "").slice(0,300)}); }
  })});
  connect();
})();
