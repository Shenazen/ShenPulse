"use strict";

/** Lecture locale indépendante des sources navigateur OBS / TikTok Studio.
 * Le processus principal décide de la diffusion LIVE ; ce module ne publie
 * jamais de son et ne doit donc pas dépendre de la présence d'une source LIVE.
 */
function rendererAudioOwner() {
  return JSON.stringify([
    snapshot?.state?.settings?.account?.uid || "",
    snapshot?.state?.session?.profileId || "",
    creatorPrivateOperationGeneration
  ]);
}

const rendererAudioQueue = [];
let rendererAudioJob = null;

function queueRendererAudioPlayback(payload = {}) {
  if (payload.previewScope) return playRendererAudio(payload);
  rendererAudioQueue.push({ payload, owner: rendererAudioOwner() });
  void drainRendererAudioQueue();
}

async function drainRendererAudioQueue() {
  if (rendererAudioJob) return;
  const job = rendererAudioQueue.shift();
  if (!job) return;
  rendererAudioJob = job;
  try {
    if (job.owner !== rendererAudioOwner()) return;
    await new Promise((resolve) => {
      job.finish = resolve;
      void playRendererAudio(job.payload, resolve).catch(resolve);
    });
  } finally {
    rendererAudioJob = null;
    void drainRendererAudioQueue();
  }
}

function stopRendererAudioPlayback(audio = activePreviewAudio) {
  if (!arguments.length) {
    rendererAudioQueue.length = 0;
    rendererAudioJob?.finish?.();
  }
  if (!audio) return;
  if (activePreviewAudio === audio) {
    activePreviewAudio = null;
    activePreviewAudioScope = "";
  }
  audio.shenPulseAudioRelease?.();
  audio.pause();
  audio.removeAttribute("src");
  audio.remove();
  audio.shenPulsePlaybackComplete?.();
  audio.shenPulsePlaybackComplete = null;
}

function rendererAudioErrorMessage(error, audio) {
  if (error?.name === "NotAllowedError") {
    return "La lecture audio a été bloquée. Cliquez de nouveau sur Écouter et vérifiez le volume de ShenPulse dans Windows.";
  }
  if (error?.name === "NotSupportedError" || audio?.error?.code === 4) {
    return "Ce fichier audio n’est pas lisible. Choisissez un autre son ou importez-le à nouveau.";
  }
  return "Le fichier audio n’est pas accessible. Vérifiez votre connexion et réessayez.";
}

/** Les aperçus remplacent le son précédent. Les notifications automatiques
 * attendent la fin du son courant pour rendre chaque répétition audible.
 * Les erreurs d'un ancien périphérique ne doivent pas interrompre un nouveau
 * son ; changer de compte, de profil ou fermer l'aperçu empêche aussi son départ.
 */
async function playRendererAudio(payload = {}, onComplete = null) {
  const scope = String(payload.previewScope || "");
  if (scope === "media-library" && (!mediaLibraryDialog.open || !mediaLibraryContext)) return;
  if (scope === "editor-dialog" && !dialog.open) return;
  const source = resolvedMediaUrl(String(payload.url || "").trim());
  if (!/^(?:https?:\/\/|data:audio\/|blob:)/i.test(source)) {
    toast("Lecture du son impossible", "L’adresse de ce son n’est pas prise en charge.", true);
    onComplete?.();
    return;
  }
  const audioStage = document.getElementById("audio-stage");
  if (!audioStage) { onComplete?.(); return; }
  if (onComplete) stopRendererAudioPlayback(activePreviewAudio);
  else stopRendererAudioPlayback();
  const audio = document.createElement("audio");
  audio.shenPulsePlaybackComplete = onComplete;
  const owner = rendererAudioOwner();
  const current = () => activePreviewAudio === audio && rendererAudioOwner() === owner;
  const fail = (title, detail) => {
    if (!current()) return;
    stopRendererAudioPlayback(audio);
    toast(title, detail, true);
  };
  const volume = Number(payload.volume ?? 1);
  audio.src = source;
  audio.preload = "auto";
  audio.muted = false;
  audio.defaultMuted = false;
  audio.volume = Number.isFinite(volume) ? Math.min(1, Math.max(0, volume)) : 1;
  if (typeof ShenPulseAudio !== "undefined") {
    ShenPulseAudio.runtime.update(ShenPulseAudio.stateControl(snapshot?.state));
    audio.shenPulseAudioRelease = ShenPulseAudio.runtime.media(audio, payload.audioKind || "sounds", payload);
  }
  activePreviewAudio = audio;
  activePreviewAudioScope = scope;
  audioStage.replaceChildren(audio);
  audio.addEventListener("ended", () => stopRendererAudioPlayback(audio), { once: true });
  audio.addEventListener("error", () => fail(
    "Lecture du son impossible", rendererAudioErrorMessage(null, audio)
  ), { once: true });
  if (payload.outputDeviceId && payload.outputDeviceId !== "default") {
    if (typeof audio.setSinkId !== "function") {
      fail("Sortie audio incompatible", "Cette version de Windows ne permet pas de diriger le son vers le périphérique choisi.");
      return;
    }
    try {
      await audio.setSinkId(payload.outputDeviceId);
    } catch {
      fail("Périphérique audio indisponible", "Le périphérique choisi est déconnecté. Actualisez la liste et sélectionnez une sortie audio disponible.");
      return;
    }
  }
  if (!current()) {
    stopRendererAudioPlayback(audio);
    return;
  }
  try {
    await audio.play();
    if (!current()) stopRendererAudioPlayback(audio);
  } catch (error) {
    fail("Lecture du son impossible", rendererAudioErrorMessage(error, audio));
  }
}
