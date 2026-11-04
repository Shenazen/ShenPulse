"use strict";

const localTtsQueue = [];
let localTtsCurrent = null;

function stopLocalTtsPlayback(previewsOnly = false) {
  for (let index = localTtsQueue.length - 1; index >= 0; index--) {
    if (!previewsOnly || localTtsQueue[index].payload.previewScope) localTtsQueue.splice(index, 1);
  }
  if (localTtsCurrent && (!previewsOnly || localTtsCurrent.payload.previewScope)) localTtsCurrent.stop?.();
}

function queueLocalTtsPlayback(payload) {
  const job = { payload, owner: rendererAudioOwner() };
  if (payload.previewScope) stopLocalTtsPlayback(true);
  if (localTtsQueue.length >= 20) return;
  localTtsQueue.push(job);
  void drainLocalTtsPlayback();
}

async function drainLocalTtsPlayback() {
  if (localTtsCurrent) return;
  const job = localTtsQueue.shift();
  if (!job) return;
  localTtsCurrent = job;
  try {
    if (job.owner !== rendererAudioOwner() || job.payload.previewScope === "editor-dialog" && !dialog.open) return;
    await new Promise((resolve) => {
      let audio, timeout, releaseAudio = () => {};
      const done = () => { releaseAudio(); clearTimeout(timeout); audio?.pause(); audio?.removeAttribute("src"); resolve(); };
      job.stop = () => { if (!audio) window.speechSynthesis?.cancel(); done(); };
      timeout = setTimeout(job.stop, 120000);
      const payload = job.payload;
      if (typeof ShenPulseAudio !== "undefined") ShenPulseAudio.runtime.update(ShenPulseAudio.stateControl(snapshot?.state));
      if (/^data:audio\/mpeg;base64,[A-Za-z0-9+/=]+$/.test(payload.audioUrl || "")) {
        audio = new Audio(payload.audioUrl);
        audio.volume = Math.max(0, Math.min(1, Number(payload.volume ?? 1)));
        if (typeof ShenPulseAudio !== "undefined") releaseAudio = ShenPulseAudio.runtime.media(audio, "tts", payload);
        audio.addEventListener("ended", done, { once: true });
        audio.addEventListener("error", done, { once: true });
        audio.play().catch(done);
      } else if (typeof ShenPulseAudio !== "undefined" && "speechSynthesis" in window) {
        const stopSpeech = ShenPulseAudio.runtime.speak(payload, { onEnd: done });
        job.stop = stopSpeech;
      } else if ("speechSynthesis" in window) {
        const utterance = new SpeechSynthesisUtterance(payload.text);
        utterance.rate = Number(payload.rate || 1);
        utterance.pitch = Number(payload.pitch ?? 1);
        utterance.volume = Math.max(0, Math.min(1, Number(payload.volume ?? 1)));
        const voice = window.speechSynthesis.getVoices().find((entry) => entry.name === payload.voice);
        if (voice) utterance.voice = voice;
        utterance.lang = voice?.lang || payload.language || "fr-FR";
        utterance.onend = done; utterance.onerror = done;
        window.speechSynthesis.speak(utterance);
      } else done();
    });
  } finally { localTtsCurrent = null; void drainLocalTtsPlayback(); }
}
