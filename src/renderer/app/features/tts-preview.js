"use strict";

async function previewSelectedTtsVoice(target) {
  const form = target.closest("form");
  if (!form) return;
  const owner = creatorChatbotCaptureOwner();
  const field = target.closest(".tts-voice-field"), status = field.querySelector("[data-voice-preview-status]");
  const component = target.closest("[data-action-component]");
  const data = component ? actionComponentFormData(component) : new FormData(form), name = target.dataset.voiceField;
  const prefixed = name === "ttsVoice";
  const value = (key, fallback) => Number(data.get(prefixed ? `tts${key[0].toUpperCase() + key.slice(1)}` : key) ?? fallback);
  target.disabled = true; status.textContent = "Préparation de l’essai…";
  try {
    const result = await api.testAction({ type: "tts.speak", testEventType: "chat", testMessage: String(data.get("voiceSample") || "Bienvenue sur ShenPulse ! Votre chat prend vie."), config: {
      voice: String(data.get(name) || ""), rate: value("rate", 1), pitch: value("pitch", 1), volume: value("volume", .9), outputMode: "local", ...(dialog.contains(target) ? { previewScope: "editor-dialog" } : {})
    } });
    assertCreatorChatbotOwner(owner);
    if (field.isConnected) status.textContent = result?.voiceFallback ? "Service naturel indisponible : essai avec Windows." : result?.skipped ? "La synthèse vocale est désactivée ou le profil a changé." : "Essai en cours sur cet ordinateur uniquement.";
  } catch (error) { if (field.isConnected) status.textContent = error.message; }
  finally { if (target.isConnected) target.disabled = false; }
}
