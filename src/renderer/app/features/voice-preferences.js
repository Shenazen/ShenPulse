"use strict";

function creatorVoicePreferencesMarkup() {
  const settings = snapshot.state.settings.tts || {};
  const assignments = ShenPulseTtsVoices.normalizeAssignments(settings.assignments);
  return `<section class="voice-personality"><div><span class="eyebrow">LA VOIX DE VOTRE CHAT</span><h3>Des voix qui donnent vie au LIVE</h3><p><strong data-studio-user-content>${escapeHtml(ShenPulseTtsVoices.voiceLabel(settings.voice))}</strong> · ${assignments.viewers.length} voix de viewers · ${Object.values(assignments.roles).filter(Boolean).length} rôles personnalisés</p><small>Les voix naturelles nécessitent Internet. Seul le commentaire filtré est envoyé au service vocal Microsoft.</small></div><button class="button primary" data-action="voice-preferences">Choisir les voix</button></section>`;
}

function voiceAssignmentRow(entry = {}) {
  return `<div class="voice-assignment-row"><label class="field"><span>@ du viewer</span><input name="viewerName" value="${escapeHtml(entry.username || "")}" maxlength="80" placeholder="pseudo" spellcheck="false"></label><label class="field"><span>Voix personnelle</span><select name="viewerVoice" data-tts-voice-select>${ttsVoiceOptions(entry.voice || "natural:fr-FR-DeniseNeural")}</select></label><button type="button" class="button small" data-action="voice-assignment-remove" aria-label="Retirer cette voix personnelle">×</button></div>`;
}

function openVoicePreferences() {
  refreshNaturalTtsVoices();
  const owner = creatorChatbotCaptureOwner();
  const settings = snapshot.state.settings.tts || {};
  const assignments = ShenPulseTtsVoices.normalizeAssignments(settings.assignments);
  const slider = (key, label, value, min, max, step) => `<label class="field"><span>${label} <output data-voice-output="${key}">${value}</output></span><input type="range" name="${key}" min="${min}" max="${max}" step="${step}" value="${value}"></label>`;
  openEditor({ title: "Les voix de votre chat", kicker: "VOIX · PROFIL ACTIF", variant: "wide", successMessage: "Voix enregistrées",
    body: `<div data-voice-preferences>${dialogSection("Votre voix par défaut", "Les règles conservent leur propre voix. Une voix attribuée à un viewer ou à son rôle est prioritaire.", `${ttsVoiceField("voice", settings.voice || "", "full")}${slider("rate", "Vitesse", settings.rate ?? 1, .5, 2, .05)}${slider("pitch", "Hauteur", settings.pitch ?? 1, 0, 2, .05)}${slider("volume", "Volume", settings.volume ?? .9, 0, 1, .05)}<label class="field full"><span>Texte de l’essai</span><input name="voiceSample" maxlength="300" value="Bienvenue sur ShenPulse ! Votre chat prend vie."></label><button type="button" class="button" data-action="voice-preview">▶ Écouter sur cet ordinateur</button><p class="full" role="status" data-voice-preview-status></p>`, "dialog-section-accent")}
    <details class="voice-policies"><summary>Voix par rôle et par viewer</summary><p>Priorité : viewer, modérateur, abonné, équipe, puis voix de la règle. Un même viewer garde sa voix avec « Une voix française par viewer ».</p><div class="dialog-grid">${[["moderator", "Modérateurs"], ["subscriber", "Abonnés"], ["team", "Équipe TikTok"]].map(([role, label]) => `<label class="field"><span>${label}</span><select name="role_${role}"><option value="">Utiliser la voix de la règle</option>${ttsVoiceOptions(assignments.roles[role] || "").replace(/<option value=""[\s\S]*?<\/option>/, "")}</select></label>`).join("")}</div><div data-voice-assignments>${assignments.viewers.map(voiceAssignmentRow).join("")}</div><button type="button" class="button small" data-action="voice-assignment-add">+ Voix d’un viewer</button></details><p class="chatbot-editor-note">Les voix naturelles utilisent le service vocal Microsoft. En cas de panne ou de délai dépassé, Windows prend le relais. Aucun fichier de commentaire n’est conservé.</p></div>`,
    onSubmit: async (data) => {
      assertCreatorChatbotOwner(owner);
      const names = data.getAll("viewerName"), voices = data.getAll("viewerVoice");
      if (names.some((name) => !String(name).trim())) throw new Error("Renseignez le @ de chaque viewer ou retirez la ligne vide.");
      const assignments = ShenPulseTtsVoices.normalizeAssignments({ roles: Object.fromEntries(["moderator", "subscriber", "team"].map((role) => [role, data.get(`role_${role}`)])), viewers: names.map((username, index) => ({ username, voice: voices[index] })) });
      const next = await api.saveSettings({ tts: { ...settings, voice: String(data.get("voice") || ""), rate: Number(data.get("rate")), pitch: Number(data.get("pitch")), volume: Number(data.get("volume")), assignments } });
      assertCreatorChatbotOwner(owner);
      acceptSnapshot(next);
    }
  });
}

const VOICE_PREFERENCE_ACTIONS = new Set(["voice-preferences", "voice-preview", "tts-voice-preview", "voice-assignment-add", "voice-assignment-remove"]);
async function handleVoicePreferenceAction({ action, target }) {
  if (!VOICE_PREFERENCE_ACTIONS.has(action)) return ACTION_NOT_HANDLED;
  if (action === "voice-preferences") return openVoicePreferences();
  if (action === "tts-voice-preview") return previewSelectedTtsVoice(target);
  const editor = target.closest("[data-voice-preferences]");
  if (!editor) return;
  if (action === "voice-assignment-remove") { target.closest(".voice-assignment-row").remove(); return; }
  if (action === "voice-assignment-add") {
    const list = editor.querySelector("[data-voice-assignments]");
    if (list.children.length >= 100) throw new Error("Vous pouvez personnaliser jusqu’à 100 viewers.");
    list.insertAdjacentHTML("beforeend", voiceAssignmentRow());
    list.lastElementChild.querySelector("input").focus();
    return;
  }
  const owner = creatorChatbotCaptureOwner(), data = new FormData(dialogForm);
  const status = editor.querySelector("[data-voice-preview-status]");
  target.disabled = true; status.textContent = "Préparation de la voix…";
  try {
    const result = await api.testAction({ type: "tts.speak", config: { voice: String(data.get("voice") || ""), rate: Number(data.get("rate")), pitch: Number(data.get("pitch")), volume: Number(data.get("volume")), outputMode: "local", previewScope: "editor-dialog" }, testEventType: "chat", testMessage: String(data.get("voiceSample") || "Bienvenue sur ShenPulse !") });
    assertCreatorChatbotOwner(owner);
    if (editor.isConnected) status.textContent = result?.voiceFallback ? "Service naturel indisponible : essai avec la voix Windows." : result?.skipped ? "La lecture vocale est désactivée ou le contexte a changé." : "Écoute locale. Le LIVE n’a reçu aucun son.";
  } catch (error) { if (editor.isConnected) status.textContent = error.message; }
  finally { if (target.isConnected) target.disabled = false; }
}
registerActionHandler(VOICE_PREFERENCE_ACTIONS, handleVoicePreferenceAction);
dialog.addEventListener("input", (event) => {
  const editor = event.target.closest?.("[data-voice-preferences], [data-tts-rule-editor]");
  const output = editor?.querySelector(`[data-voice-output="${event.target.name}"]`);
  if (output) output.textContent = event.target.value;
});
