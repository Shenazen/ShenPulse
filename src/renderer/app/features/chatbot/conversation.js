"use strict";

let creatorChatbotTab = "commands";
function creatorConversationalEntry(entry) {
  return !entry?.execution && entry?.conversationVersion === 1 && ["command", "auto-reply", "timer"].includes(entry.kind || "command");
}
function creatorConversationRows() {
  return (snapshot.state.commands || []).filter((entry) => creatorConversationalEntry(entry) && (creatorChatbotTab === "timers" ? entry.kind === "timer" : entry.kind !== "timer"));
}
function creatorChatbotTabsMarkup() {
  return `<nav class="voice-tabs chatbot-tabs" aria-label="Fonctions du chatbot">${[["commands", "Commandes d’actions", "command"], ["replies", "Réponses du chat", "bot"], ["timers", "Messages programmés", "clock"]].map(([key, label, icon]) => `<button type="button" class="voice-tab ${creatorChatbotTab === key ? "active" : ""}" data-action="chatbot-tab" data-value="${key}" aria-pressed="${creatorChatbotTab === key}">${creatorChatbotIcon(icon)}${label}</button>`).join("")}</nav>`;
}
function creatorConversationPanelMarkup() {
  const timer = creatorChatbotTab === "timers", rows = creatorConversationRows();
  return `<section class="chatbot-section"><header class="chatbot-section-heading"><div><h3>${timer ? "Vos messages programmés" : "Vos réponses"}<span>${rows.length}</span></h3><p>${timer ? "Un rappel à intervalle régulier, uniquement pendant votre LIVE." : "Une réponse à une commande ! ou à des mots-clés. Vous choisissez le texte."}</p></div><div class="button-row">${!timer ? '<button class="button small" data-action="chatbot-add" data-kind="reply-command">Réponse à !commande</button>' : ""}<button class="button primary small" data-action="chatbot-add" data-kind="${timer ? "timer" : "auto-reply"}">+ ${timer ? "Programmer un message" : "Réponse automatique"}</button></div></header>
    <div class="chatbot-message-list">${rows.map((entry) => `<article class="chatbot-message-card ${entry.enabled === false ? "is-paused" : ""}"><span class="chatbot-message-symbol">${creatorChatbotIcon(entry.kind === "timer" ? "clock" : "bot")}</span><div><h4 data-studio-user-content>${escapeHtml(creatorChatbotEntryTitle(entry))}</h4><p data-studio-user-content>${escapeHtml(entry.response)}</p><small>${entry.kind === "timer" ? `Toutes les ${Math.round(entry.intervalMs / 60000 * 10) / 10} min · ${entry.minChatMessages || 0} messages minimum` : entry.kind === "command" ? "À la réception de la commande" : `Mots-clés · ${entry.matchMode === "exact" ? "message exact" : "contenus dans le message"}`} · ${escapeHtml(creatorChatbotAudience(entry))} · ${escapeHtml(entry.platform || "all")}</small></div><label class="chatbot-entry-toggle"><span>${entry.enabled === false ? "Inactif" : "Actif"}</span><span class="switch"><input type="checkbox" data-action="chatbot-toggle" data-id="${escapeHtml(entry.id)}" aria-label="Activer ${escapeHtml(creatorChatbotEntryTitle(entry))}" ${entry.enabled !== false ? "checked" : ""}><span></span></span></label><div class="chatbot-entry-actions">${[["preview", "Aperçu local"], ["edit", "Modifier"], ["delete", "Supprimer"]].map(([action, label]) => `<button class="chatbot-row-button" data-action="chatbot-${action}" data-id="${escapeHtml(entry.id)}" aria-label="${label}">${creatorChatbotIcon(action === "delete" ? "trash" : action)}</button>`).join("")}</div></article>`).join("") || '<div class="chatbot-journal-empty">Créez votre premier message ou choisissez un modèle ci-dessous.</div>'}</div></section>`;
}
function renderCreatorConversationWorkspace() {
  const timer = creatorChatbotTab === "timers";
  return `<div class="reference-page creator-chatbot-page">${renderStudioHero("chatbot", "Commandes & chatbot", "Des réponses utiles, au bon moment.")}${creatorChatbotTabsMarkup()}<div class="chatbot-template-grid">${(timer ? [["reminder", "Rappel du LIVE", "Invitez les viewers à suivre et à participer."]] : [["discord", "Votre Discord", "Donnez votre lien avec !discord."], ["bonjour", "Un accueil chaleureux", "Répondez aux salutations du chat."]]).map(([key, title, description]) => `<button class="chatbot-template-card" data-action="chatbot-template" data-value="${key}">${creatorChatbotIcon(timer ? "clock" : "bot")}<strong>${title}</strong><span>${description}</span><small>Préparer ce modèle →</small></button>`).join("")}</div><div id="creator-chatbot-panel" data-creator-chatbot-panel>${creatorConversationPanelMarkup()}</div>${renderCreatorChatbotDelivery()}<div data-creator-chatbot-activity data-chatbot-activity-state="${escapeHtml(creatorChatbotActivitySignature())}">${creatorChatbotActivityMarkup()}</div><p class="chatbot-safety-note">Les nouveaux messages sont désactivés par défaut. Vérifiez l’aperçu, autorisez l’envoi sur la plateforme, puis activez-les. Aucun aperçu ne publie de message.</p></div>`;
}

function creatorConversationExample(entry) {
  return { type: entry.kind === "timer" ? "timer" : "chat", platform: entry.platform === "all" ? "tiktok" : entry.platform, user: { name: "viewer_exemple", displayName: "Viewer exemple", moderator: true, subscriber: true }, data: { message: entry.kind === "auto-reply" ? entry.keywords?.[0] || entry.matchText : `${entry.command || "!exemple"} exemple` } };
}
function creatorConversationPreview(entry) {
  const event = creatorConversationExample(entry);
  const response = ShenPulseChatbotCommand.renderChatbotResponse(entry, event);
  return `<div class="chatbot-preview"><p class="chatbot-preview-note">Aperçu local · aucun message envoyé</p><div class="chatbot-preview-event"><span>Viewer exemple</span><code data-studio-user-content>${escapeHtml(event.data.message || "Message programmé")}</code></div><div class="chatbot-preview-result"><span>Réponse prévue</span><p data-studio-user-content>${escapeHtml(response || "Saisissez votre message…")}</p></div></div>`;
}
function creatorConversationFromForm(data, current) {
  const next = { ...current, conversationVersion: 1, enabled: data.has("enabled"), response: String(data.get("response") || "").trim(), platform: String(data.get("platform") || "all"), audience: String(data.get("audience") || "all"), cooldownMs: Number(data.get("cooldownSeconds") ?? 10) * 1000, globalCooldownMs: Number(data.get("globalCooldownSeconds") ?? 30) * 1000 };
  delete next.execution;
  if (next.kind === "timer") {
    next.messages = next.response.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
    next.response = next.messages[0] || "";
    next.intervalMs = Number(data.get("intervalMinutes")) * 60000;
    next.minChatMessages = Number(data.get("minChatMessages"));
    next.name = String(data.get("name") || "Message programmé").slice(0, 80);
  } else if (next.kind === "command") { next.command = String(data.get("command") || "").trim(); next.aliases = []; }
  else { next.keywords = String(data.get("keywords") || "").split(/[,;\r\n]+/).map((word) => word.trim()).filter(Boolean); next.matchText = next.keywords[0]; next.matchMode = String(data.get("matchMode") || "contains"); }
  return next;
}
function openCreatorConversationEditor(entry, kind = "auto-reply", preset = "") {
  const owner = creatorChatbotCaptureOwner();
  assertCreatorChatbotOwner(owner);
  const defaults = {
    discord: { kind: "command", command: "!discord", response: "Rejoins notre communauté : https://discord.gg/TON_CODE" },
    bonjour: { kind: "auto-reply", keywords: ["bonjour", "salut", "coucou"], response: "Bienvenue {user} ! Installe-toi et profite du LIVE !" },
    reminder: { kind: "timer", name: "Rappel du LIVE", response: "Bienvenue ! Pense à suivre le LIVE pour retrouver nos prochaines parties." }
  };
  const current = entry || { kind: kind === "reply-command" ? "command" : kind, conversationVersion: 1, enabled: false, platform: "all", audience: "all", command: "!infos", keywords: [], matchMode: "contains", response: "", intervalMs: 300000, minChatMessages: 5, cooldownMs: 30000, globalCooldownMs: 30000, ...defaults[preset] };
  const timer = current.kind === "timer";
  const trigger = timer ? `${field("name", "Nom du rappel", current.name || "Message programmé", "text", 'maxlength="80" full required')}${field("intervalMinutes", "Intervalle (minutes)", Number(current.intervalMs) / 60000, "number", 'min="1" max="60" step="0.1" required')}${field("minChatMessages", "Messages reçus minimum entre deux rappels", current.minChatMessages ?? 5, "number", 'min="0" max="1000" step="1" required')}` : current.kind === "command" ? field("command", "Commande à écrire dans le chat", current.command, "text", 'maxlength="32" placeholder="!discord" full required') : `${field("keywords", "Mots-clés (séparés par des virgules)", (current.keywords || [current.matchText]).filter(Boolean).join(", "), "text", 'maxlength="1000" placeholder="bonjour, salut, coucou" full required')}${selectFieldMarkup("matchMode", "Déclencher si le message…", current.matchMode || "contains", [["contains", "contient un de ces mots-clés"], ["exact", "correspond exactement à un de ces mots-clés"]], { full: true })}`;
  openEditor({ title: entry ? "Modifier le message" : timer ? "Programmer un message" : "Créer une réponse du chat", kicker: "CHATBOT · PROFIL ACTIF", variant: "wide", successMessage: "Message enregistré",
    body: `<div data-conversation-editor>${dialogSection(timer ? "Quand envoyer le rappel ?" : "Quand répondre ?", timer ? "Pas de rattrapage en rafale après une pause. Les rappels attendent une session LIVE et une source autorisée." : "Choisissez ce qui déclenche votre réponse.", trigger, "dialog-section-accent")}${dialogSection("Votre message", timer ? "Une ligne par message (10 maximum). Les messages tournent à chaque intervalle." : "Votre texte est envoyé tel que vous le préparez. {user} est remplacé par le nom du viewer.", `<label class="field full"><span>${timer ? "Messages à faire tourner" : "Réponse"}</span><textarea name="response" rows="3" maxlength="${timer ? 5010 : 500}" required>${escapeHtml(timer ? ShenPulseChatbotCommand.chatbotTimerMessages(current).join("\n") : current.response)}</textarea></label><label class="checkbox-label full"><input type="checkbox" name="enabled" ${current.enabled !== false ? "checked" : ""}><span>Activer ce message pendant le LIVE</span></label>`)}<details class="voice-policies"><summary>Plateforme, accès et anti-spam</summary><div class="dialog-grid">${selectFieldMarkup("platform", "Plateforme", current.platform, [["all", "Toutes les plateformes"], ["tiktok", "TikTok"], ["kick", "Kick"], ["twitch", "Twitch"]])}${selectFieldMarkup("audience", "Audience", current.audience || "all", [["all", "Tout le monde"], ["subscriber", "Abonnés"], ["moderator", "Modérateurs"]])}${field("cooldownSeconds", "Délai par viewer (secondes)", Number(current.cooldownMs || 0) / 1000, "number", 'min="0" max="3600" required')}${field("globalCooldownSeconds", "Délai entre deux réponses (secondes)", Number(current.globalCooldownMs || 0) / 1000, "number", 'min="0" max="3600" required')}</div></details><div data-conversation-preview>${creatorConversationPreview(current)}</div></div>`,
    onSubmit: async (data) => {
      assertCreatorChatbotOwner(owner);
      const next = creatorConversationFromForm(data, current);
      if (next.response.includes("TON_CODE")) throw new Error("Remplacez TON_CODE par votre véritable invitation Discord.");
      next.id = current.id || `chatbot_${cryptoId()}`;
      const normalized = ShenPulseChatbotCommand.normalizeChatbotCommand(next, { commands: (snapshot.state.commands || []).filter((item) => creatorChatbotFunctionalEntry(item) || creatorConversationalEntry(item)) });
      await api.upsert("commands", normalized);
      assertCreatorChatbotOwner(owner);
      const updated = await api.getSnapshot();
      assertCreatorChatbotOwner(owner);
      acceptSnapshot(updated);
    }
  });
  dialog.querySelector("[data-conversation-editor]")._conversationInitial = current;
}
dialog.addEventListener("input", (event) => {
  const editor = event.target.closest?.("[data-conversation-editor]");
  if (!editor) return;
  editor.querySelector("[data-conversation-preview]").innerHTML = creatorConversationPreview(creatorConversationFromForm(new FormData(dialogForm), editor._conversationInitial));
});
