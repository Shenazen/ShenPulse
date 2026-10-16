"use strict";

/** No fetch, persistent storage, full-screen selection or audio. Only two
 * cropped PNGs leave this private page, except the explicit one-shot preview. */
(() => {
  const video = document.getElementById("capture"), bridge = window.shenPulseVision;
  let stream = null, timer = null, running = false, activeToken = "";
  function stop() {
    running = false; clearTimeout(timer); timer = null;
    for (const track of stream?.getTracks?.() || []) track.stop();
    stream = null; video.pause(); video.srcObject = null;
  }
  bridge?.onStop(stop);
  window.addEventListener("pagehide", stop);
  function image(roi, maxWidth, maxHeight) {
    const width = video.videoWidth, height = video.videoHeight;
    if (!width || !height) throw new Error("Missing frame");
    const sx = Math.round(roi.x * width), sy = Math.round(roi.y * height);
    const sw = Math.max(1, Math.min(width - sx, Math.round(roi.width * width)));
    const sh = Math.max(1, Math.min(height - sy, Math.round(roi.height * height)));
    const scale = Math.min(1, maxWidth / sw, maxHeight / sh), canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.floor(sw * scale)); canvas.height = Math.max(1, Math.floor(sh * scale));
    try {
      const context = canvas.getContext("2d", { alpha: false });
      context.drawImage(video, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
      return canvas.toDataURL("image/png");
    } finally { canvas.width = 0; canvas.height = 0; }
  }
  async function frame(command) {
    if (!running || command.token !== activeToken) return;
    try {
      const capturedAtMs = Date.now();
      const payload = command.mode === "preview"
        ? { token: activeToken, mode: "preview", image: image({ x: 0, y: 0, width: 1, height: 1 }, 1920, 1080), capturedAtMs }
        : { token: activeToken, mode: "monitor", banner: image(command.bannerROI, 1600, 600), owner: image(command.ownerROI, 1200, 400), capturedAtMs };
      const result = await bridge.frame(payload);
      if (command.mode === "preview" || result?.stop || !result?.accepted) return stop();
      // ACK backpressure: there can never be a second frame while OCR runs.
      if (running && command.token === activeToken) timer = setTimeout(() => { void frame(command); }, 500);
    } catch { await bridge.status({ token: activeToken, state: "error" }); stop(); }
  }
  window.startShenPulseVisionCapture = async (command) => {
    if (running || !bridge || !command || !["monitor", "preview"].includes(command.mode) || typeof command.token !== "string") return false;
    activeToken = command.token;
    try {
      // Main supplies exactly one verified DesktopCapturerSource in its
      // display-media request handler. deviceId is deliberately not used.
      stream = await navigator.mediaDevices.getDisplayMedia({ audio: false,
        video: { frameRate: { ideal: 2, max: 5 }, width: { max: 3840 }, height: { max: 2160 } } });
      if (stream.getAudioTracks().length || stream.getVideoTracks().length !== 1) { stop(); return false; }
      stream.getVideoTracks()[0].addEventListener("ended", () => { void bridge.status({ token: activeToken, state: "ended" }); stop(); });
      video.srcObject = stream; await video.play(); running = true;
      timer = setTimeout(() => { void frame(command); }, 500);
      return true;
    } catch { stop(); return false; }
  };
})();
