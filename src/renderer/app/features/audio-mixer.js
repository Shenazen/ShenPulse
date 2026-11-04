"use strict";

/** Un seul panneau et les mêmes réglages dans Voix & sons et Matchs. */
function renderAudioMixer() {
  const values = ShenPulseAudio.normalizeSettings(snapshot.state.settings.audioMixer);
  const labels = { master: "Volume général", sounds: "Alertes sonores", tts: "Voix TTS", matches: "Animations & matchs", overlays: "Autres overlays" };
  return `<section class="shen-audio-mixer" aria-label="Volumes audio"><header><div><h3>Volumes audio</h3><p>Réglages appliqués sur votre PC et sur le LIVE, y compris pendant la lecture. À 0 %, le son est coupé.</p></div></header><div class="shen-audio-mixer-grid">${Object.entries(labels).map(([key, label]) => `<label><span>${label}<output data-audio-mixer-output="${key}">${Math.round(values[key] * 100)} %</output></span><input type="range" min="0" max="100" step="1" value="${Math.round(values[key] * 100)}" data-audio-mixer="${key}" aria-label="${label}"></label>`).join("")}</div></section>`;
}

let audioMixerSaveTimer, pendingAudioMixer, audioMixerSaving = false;
function audioMixerOwner() { return JSON.stringify([snapshot?.state?.settings?.account?.uid, snapshot?.state?.session?.profileId]); }
async function saveAudioMixer() {
  clearTimeout(audioMixerSaveTimer);
  if (audioMixerSaving || !pendingAudioMixer) return;
  const pending = pendingAudioMixer; pendingAudioMixer = null;
  if (audioMixerOwner() !== pending.owner) return;
  audioMixerSaving = true;
  try {
    const result = await api.saveSettings({ audioMixer: pending.values });
    if (audioMixerOwner() !== pending.owner) return;
    if (!pendingAudioMixer) acceptSnapshot(result);
  } catch (error) { if (audioMixerOwner() === pending.owner) toast("Volume non enregistré", error.message, true); }
  finally { audioMixerSaving = false; if (pendingAudioMixer) void saveAudioMixer(); }
}
document.addEventListener("input", event => {
  const input = event.target.closest?.("[data-audio-mixer]");
  if (!input || !isAccountAuthenticated()) return;
  const key = input.dataset.audioMixer;
  if (!ShenPulseAudio.channels.includes(key)) return;
  const values = ShenPulseAudio.normalizeSettings({ ...snapshot.state.settings.audioMixer, [key]: Number(input.value) / 100 });
  snapshot.state.settings.audioMixer = values;
  ShenPulseAudio.runtime.update(ShenPulseAudio.stateControl(snapshot.state));
  document.querySelectorAll(`[data-audio-mixer-output="${key}"]`).forEach(output => { output.textContent = `${Math.round(values[key] * 100)} %`; });
  pendingAudioMixer = { values, owner: audioMixerOwner() };
  clearTimeout(audioMixerSaveTimer); audioMixerSaveTimer = setTimeout(saveAudioMixer, 120);
});
document.addEventListener("change", event => { if (event.target.matches?.("[data-audio-mixer]")) void saveAudioMixer(); });
