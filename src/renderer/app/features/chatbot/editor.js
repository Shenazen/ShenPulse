"use strict";

/** Édition des effets de commandes et aperçu pur, sans événement LIVE. */
function creatorChatbotCaptureOwner() {
  return { ...captureCreatorPrivateOperation(), profileId: String(snapshot?.state?.session?.profileId || "") };
}

function assertCreatorChatbotOwner(owner) {
  assertCreatorPrivateOperation(owner);
  if (owner.profileId !== String(snapshot?.state?.session?.profileId || "")) throw new Error("Le profil a changé pendant cette opération. Recommencez depuis le profil actuel.");
}

function assertCreatorChatbotEditable(entry) {
  if (!creatorChatbotFunctionalEntry(entry)) throw new Error("Cette entrée ne correspond pas à une commande de musique, d'action ou d'overlay.");
}

function creatorChatbotDataFromForm(data, current) {
  assertCreatorChatbotEditable(current);
  const read = (name) => String(data.get(name) || "").trim();
  // L'ancienne réponse est conservée comme donnée historique non exécutable.
  // Aucun champ du formulaire ne peut la remplacer ni créer une réponse texte.
  return { ...current, kind: "command", response: String(current.response || ""), command: read("command"),
    aliases: read("aliases").split(/[,;\r\n]+/).map((value) => value.trim()).filter(Boolean),
    execution: creatorCommandEffectFromForm(data, current), platform: read("platform") || "all", enabled: data.has("enabled"),
    audience: read("audience") || "moderator", cooldownMs: Number(data.get("cooldownSeconds")) * 1000,
    globalCooldownMs: Number(data.get("globalCooldownSeconds")) * 1000 };
}

function creatorChatbotTriggerFields(entry) {
  return `${field("command", "Commande", entry.command || "!", "text", 'maxlength="200" required autofocus spellcheck="false"')}${selectFieldMarkup("platform", "Plateforme", entry.platform || "all", [["all", "Toutes les plateformes"], ["tiktok", "TikTok"], ["kick", "Kick"], ["twitch", "Twitch"]])}${field("aliases", "Alias (optionnel)", ShenPulseChatbotCommand.chatbotAliases(entry.aliases).join(", "), "text", 'maxlength="264" full spellcheck="false"')}<p class="chatbot-editor-note full">Exemples : !skip, !play, !song, !roue. Chaque nom commence par !, sans espace. Les arguments suivent un espace ; jusqu’à 8 alias sont possibles.</p>`;
}

function creatorChatbotPolicyFields(entry) {
  const audience = entry.audience || (entry.subscriberOnly ? "subscriber" : "all");
  return `${selectFieldMarkup("audience", "Qui peut utiliser cette commande ?", audience, [["all", "Tout le monde"], ["subscriber", "Abonnés uniquement"], ["moderator", "Modérateurs uniquement"]], { full: true })}${field("cooldownSeconds", "Cooldown par viewer (secondes)", Number(entry.cooldownMs ?? 10000) / 1000, "number", 'min="0" max="3600" step="0.001" required')}${field("globalCooldownSeconds", "Cooldown global (secondes)", Number(entry.globalCooldownMs || 0) / 1000, "number", 'min="0" max="3600" step="0.001" required')}<p class="chatbot-editor-note full">Le cooldown global limite tous les viewers ensemble. Les nouvelles commandes sont réservées aux modérateurs et au créateur du LIVE par défaut. Un compte de test non modérateur ne les déclenche pas : choisissez « Tout le monde » seulement si vous souhaitez ouvrir cet effet à tous les viewers. Les refus apparaissent dans « Exécutions récentes ».</p>`;
}

function creatorChatbotExampleEvent(entry) {
  const audience = entry.audience || (entry.subscriberOnly ? "subscriber" : "all");
  return { type: "chat", source: "local-preview", platform: entry.platform === "all" || !entry.platform ? "tiktok" : entry.platform,
    user: { name: "viewer_exemple", displayName: "Viewer exemple", subscriber: audience === "subscriber", moderator: audience === "moderator" },
    data: { message: `${entry.command || "!exemple"} exemple` } };
}

function creatorChatbotPreviewMarkup(entry) {
  assertCreatorChatbotEditable(entry);
  const event = creatorChatbotExampleEvent(entry);
  let error;
  try { ShenPulseCommandExecution.normalizeCommandExecution(entry.execution); } catch (failure) { error = failure.message; }
  const description = error ? `À compléter : ${error}` : creatorCommandEffectDescription(entry);
  return `<div class="chatbot-preview"><p class="chatbot-preview-note">Exemple fictif, calculé uniquement sur cet appareil. Aucun son, action, overlay ni message n'est déclenché. Les cooldowns, l'état du LIVE et les connexions ne sont pas testés.</p><div class="chatbot-preview-event"><span>Viewer exemple</span><code data-studio-user-content>${escapeHtml(event.data.message)}</code>${entry.enabled === false ? '<span>Cette entrée est désactivée.</span>' : ""}</div><div class="chatbot-preview-result"><span>Effet prévu · aucun test réel</span><p data-studio-user-content>${escapeHtml(description)}</p></div></div>`;
}

function openCreatorChatbotEditor(entry, requestedKind = "command") {
  const owner = creatorChatbotCaptureOwner();
  assertCreatorChatbotOwner(owner);
  if (requestedKind && requestedKind !== "command") throw new Error("Seules les commandes de musique, d'action ou d'overlay sont disponibles.");
  if (entry) assertCreatorChatbotEditable(entry);
  const current = entry || { id: "", kind: "command", command: "!skip", aliases: [], response: "", enabled: true, audience: "moderator",
    platform: "all", cooldownMs: 10000, globalCooldownMs: 3000, execution: creatorCommandDefaultEffect() };
  const [label, description, addLabel] = creatorChatbotHeading();
  const effect = current.execution;
  const effectSignature = `${effect.type}:${effect.overlayKey || ""}:${effect.operation || ""}`;
  const enabled = `<label class="chatbot-editor-enabled full"><span><strong>Entrée active</strong><small>Désactivez-la sans perdre ses réglages.</small></span><span class="switch"><input type="checkbox" name="enabled" ${current.enabled !== false ? "checked" : ""}><span></span></span></label>`;
  openEditor({
    title: entry ? "Modifier la commande" : addLabel, kicker: "COMMANDES · PROFIL ACTIF", variant: "wide", successMessage: "Commande enregistrée",
    body: `<div class="chatbot-editor" data-chatbot-editor="command" data-command-effect-type="${creatorCommandEffectType(current)}" data-command-effect-signature="${escapeHtml(effectSignature)}">${dialogSection(label, description, creatorChatbotTriggerFields(current), "dialog-section-accent")}${dialogSection("Effet de la commande", "Choisissez une musique, une action ou un overlay.", `${creatorCommandEffectSection(current)}${enabled}`)}${dialogSection("Accès & anti-spam", "Les autorisations et cooldowns sont vérifiés avant chaque exécution.", creatorChatbotPolicyFields(current))}<section class="dialog-section"><header><div><h3>Aperçu local</h3><p>Aucun message n’est envoyé et aucune interaction du LIVE n’est déclenchée.</p></div></header><div data-chatbot-draft-preview>${creatorChatbotPreviewMarkup(current)}</div></section></div>`,
    onSubmit: async (data) => {
      assertCreatorChatbotOwner(owner);
      const next = creatorChatbotDataFromForm(data, current);
      next.id = current.id || `command_${cryptoId()}`;
      const normalized = ShenPulseChatbotCommand.normalizeChatbotCommand(next, { commands: creatorChatbotRows() });
      try { await api.upsert("commands", normalized); }
      catch (error) {
        // L'enveloppe technique Electron n'aide pas à corriger le formulaire.
        throw new Error(String(error.message || error).replace(/^Error invoking remote method 'entity:upsert': (?:Error: )?/, ""), { cause: error });
      }
      assertCreatorChatbotOwner(owner);
      const updated = await api.getSnapshot();
      assertCreatorChatbotOwner(owner);
      acceptSnapshot(updated);
    }
  });
  const mounted = dialog.querySelector("[data-chatbot-editor]");
  if (mounted) {
    mounted._commandInitial = current;
    mounted._commandEffect = current.execution;
  }
}

function openCreatorChatbotPreview(entry) {
  assertCreatorChatbotOwner(creatorChatbotCaptureOwner());
  assertCreatorChatbotEditable(entry);
  openEditor({ title: "Aperçu local", kicker: "COMMANDES · AUCUNE EXÉCUTION", body: creatorChatbotPreviewMarkup(entry) });
}

/** Écouteurs délégués : aucun brouillon ne survit à la suppression du formulaire. */
function creatorChatbotUpdateDraftPreview(event) {
  const editor = event.target.closest?.("[data-chatbot-editor]");
  const preview = editor?.querySelector("[data-chatbot-draft-preview]");
  if (!preview) return;
  syncCreatorCommandEffectDraft(editor, new FormData(dialogForm));
  const entry = creatorChatbotDataFromForm(new FormData(dialogForm), editor._commandInitial);
  preview.innerHTML = creatorChatbotPreviewMarkup(entry);
  if (typeof applyStudioLanguage === "function") applyStudioLanguage(preview);
}
dialog.addEventListener("input", creatorChatbotUpdateDraftPreview);
dialog.addEventListener("change", creatorChatbotUpdateDraftPreview);
