"use strict";

/** Atelier Commandes : effets musique, action et overlay uniquement.
 * Les anciennes entrées restent stockées mais ne sont jamais exposées ici.
 * Aucun lecteur, abonnement réseau ou polling n'est créé par le rendu.
 */
const CREATOR_CHATBOT_ICONS = Object.freeze({
  command: '<path d="m8 5-5 7 5 7M16 5l5 7-5 7M14 3l-4 18"/>',
  music: '<path d="M9 18V5l12-2v13M9 8l12-2"/><ellipse cx="6" cy="18" rx="3" ry="3"/><ellipse cx="18" cy="16" rx="3" ry="3"/>',
  action: '<path d="m13 2-9 12h7l-1 8 10-12h-7z"/>',
  overlay: '<rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4M6 7h5M6 11h10"/>',
  bot: '<rect x="4" y="7" width="16" height="13" rx="4"/><path d="M12 3v4M10 3h4M1 12v4M23 12v4M8 12h.01M16 12h.01M9 16h6"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  edit: '<path d="m16 3 5 5-12 12-6 1 1-6zM14 5l5 5"/>',
  preview: '<path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7S2 12 2 12"/><circle cx="12" cy="12" r="3"/>',
  trash: '<path d="M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7M14 10v7"/>',
  shield: '<path d="m12 3 8 3v5c0 5-8 10-8 10S4 16 4 11V6zM9 12l2 2 4-4"/>'
});

function creatorChatbotIcon(name) {
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${CREATOR_CHATBOT_ICONS[name] || CREATOR_CHATBOT_ICONS.command}</svg>`;
}

function creatorChatbotFunctionalEntry(entry) {
  return (entry?.kind || "command") === "command" && ["music", "action", "overlay"].includes(entry?.execution?.type);
}

function creatorChatbotRows() {
  return (snapshot?.state?.commands || []).filter(creatorChatbotFunctionalEntry);
}

function creatorChatbotAudience(entry) {
  const audience = entry.audience || (entry.subscriberOnly ? "subscriber" : "all");
  return ({ all: "Tout le monde", subscriber: "Abonnés uniquement", moderator: "Modérateurs uniquement" })[audience] || "Tout le monde";
}

function creatorChatbotHeading() {
  return ["Vos commandes", "Un ! dans le chat pour contrôler la musique, lancer vos actions et faire vivre vos overlays.", "Nouvelle commande"];
}

function creatorChatbotEntryTitle(entry) { return String(entry.command || "!"); }
function creatorChatbotEntryMeta(entry) {
  const aliases = ShenPulseChatbotCommand.chatbotAliases(entry.aliases);
  return aliases.length ? `${aliases.length} alias` : "Commande du chat";
}

/** Une ligne = une commande. Le rendu reste pur et les actions déléguées inchangées. */
function creatorChatbotEntryRow(entry) {
  const id = escapeHtml(entry.id);
  const aliases = ShenPulseChatbotCommand.chatbotAliases(entry.aliases).slice(0, 8);
  const effectType = creatorCommandEffectType(entry);
  const effectLabel = ({ music: "Musique", action: "Action", overlay: "Overlay" })[effectType];
  const title = creatorChatbotEntryTitle(entry);
  return {
    id: entry.id, className: `chatbot-entry ${entry.enabled === false ? "is-paused" : ""}`,
    attributes: { "data-chatbot-entry": entry.id },
    cells: {
      command: `<div class="chatbot-entry-title"><h4 data-studio-user-content>${escapeHtml(title)}</h4>${aliases.length ? `<div class="chatbot-aliases">${aliases.map((alias) => `<code data-studio-user-content>${escapeHtml(alias)}</code>`).join("")}</div>` : `<small>${escapeHtml(creatorChatbotEntryMeta(entry))}</small>`}</div>`,
      effect: `<span class="chatbot-effect-badge is-${escapeHtml(effectType)}">${creatorChatbotIcon(effectType)}${effectLabel}</span><p class="chatbot-entry-response" data-studio-user-content>${escapeHtml(creatorCommandEffectDescription(entry))}</p>`,
      audience: `<div class="chatbot-entry-policy"><span>${creatorChatbotIcon("shield")}${escapeHtml(creatorChatbotAudience(entry))}</span><small>${({ all: "Toutes les plateformes", tiktok: "TikTok", kick: "Kick", twitch: "Twitch" })[entry.platform || "all"] || "Toutes les plateformes"}</small></div>`,
      cooldown: `<div class="chatbot-entry-policy"><span>${creatorChatbotIcon("clock")}<strong>${Math.round(Number(entry.cooldownMs || 0) / 1000)} s</strong> par viewer</span>${Number(entry.globalCooldownMs) > 0 ? `<small><strong>${Math.round(Number(entry.globalCooldownMs) / 1000)} s</strong> global</small>` : ""}</div>`,
      status: `<label class="chatbot-entry-toggle"><span>${entry.enabled === false ? "Inactif" : "Actif"}</span><span class="switch"><input type="checkbox" data-action="chatbot-toggle" data-id="${id}" aria-label="Activer ou désactiver ${escapeHtml(title)}" ${entry.enabled !== false ? "checked" : ""}><span></span></span></label>`,
      actions: `<div class="chatbot-entry-actions"><button type="button" class="chatbot-row-button" data-action="chatbot-preview" data-id="${id}" aria-label="Aperçu de ${escapeHtml(title)}" title="Aperçu local">${creatorChatbotIcon("preview")}</button><button type="button" class="chatbot-row-button" data-action="chatbot-edit" data-id="${id}" aria-label="Modifier ${escapeHtml(title)}" title="Modifier">${creatorChatbotIcon("edit")}</button><button type="button" class="chatbot-row-button danger" data-action="chatbot-delete" data-id="${id}" aria-label="Supprimer ${escapeHtml(title)}" title="Supprimer">${creatorChatbotIcon("trash")}</button></div>`
    }
  };
}

function creatorChatbotPanelMarkup() {
  const rows = creatorChatbotRows();
  const [title, description, addLabel] = creatorChatbotHeading();
  const table = rows.length ? renderCompactResourceTable({
    key: "commands", label: title, className: "chatbot-command-table",
    columns: [{ key: "command", label: "Commande / alias" }, { key: "effect", label: "Effet exécuté" }, { key: "audience", label: "Accès / plateforme" }, { key: "cooldown", label: "Cooldown" }, { key: "status", label: "Statut" }, { key: "actions", label: "Actions" }],
    rows: rows.map(creatorChatbotEntryRow), emptyText: "Aucune commande dans ce profil."
  }) : `<div class="chatbot-empty"><span>${creatorChatbotIcon("command")}</span><div><h3>Votre première commande commence ici.</h3><p>!skip passe un titre, !song choisit une musique, !roue lance votre roue.</p></div><button type="button" class="button" data-action="chatbot-add">${creatorChatbotIcon("plus")}${addLabel}</button></div>`;
  return `<section class="chatbot-section"><header class="chatbot-section-heading"><div><h3>${title}<span>${rows.length}</span></h3><p>${description}</p></div><button type="button" class="button small primary" data-action="chatbot-add">${creatorChatbotIcon("plus")}${addLabel}</button></header>${table}</section>`;
}

function creatorChatbotRecentActivity() {
  const profileId = String(snapshot?.state?.session?.profileId || "");
  return (snapshot?.state?.activity || []).filter((entry) => entry.category === "chatbot" && ["music", "action", "overlay"].includes(entry.executionType) && (!entry.profileId || String(entry.profileId) === profileId)).slice(0, 6);
}

function creatorChatbotActivitySignature() {
  return JSON.stringify(creatorChatbotRecentActivity().map((entry) => [entry.id, entry.timestamp, entry.title, entry.detail, entry.level, entry.partial, entry.queued]));
}

function creatorChatbotActivityIcon(entry) {
  if (entry.partial === true) return "shield";
  if (entry.queued === true) return "clock";
  return entry.level === "success" ? "command" : "shield";
}

function creatorChatbotActivityMarkup() {
  const entries = creatorChatbotRecentActivity();
  return `<section class="chatbot-section chatbot-journal"><header class="chatbot-section-heading"><div><h3>Exécutions récentes</h3><p>Les six derniers résultats du profil actif : effets exécutés, refus ou erreurs.</p></div></header>${entries.length ? `<div class="chatbot-journal-list">${entries.map((entry) => `<article><span class="chatbot-journal-icon ${entry.level === "success" && entry.partial !== true && entry.queued !== true ? "is-sent" : ""}">${creatorChatbotIcon(creatorChatbotActivityIcon(entry))}</span><div><header><strong>${escapeHtml(entry.title || "Commande du LIVE")}</strong><time datetime="${escapeHtml(entry.timestamp || "")}">${escapeHtml(formatTime(entry.timestamp))}</time></header><p data-studio-user-content>${escapeHtml(entry.detail || "")}</p></div></article>`).join("")}</div>` : '<div class="chatbot-journal-empty">Aucune exécution récente. Les commandes reçues pendant votre LIVE apparaîtront ici.</div>'}</section>`;
}

function renderCreatorChatbot() {
  if (!isAccountAuthenticated()) return renderPrivateDataPlaceholder("Vos Commandes", "Connectez votre compte ShenPulse pour retrouver les commandes de votre profil.");
  return `<div class="reference-page creator-chatbot-page"><div class="chatbot-hero">${renderStudioHero("chatbot", "Commandes", "Votre chat prend les commandes du LIVE")}<button type="button" class="button primary chatbot-hero-action" data-action="chatbot-add">${creatorChatbotIcon("plus")}Nouvelle commande</button></div>
    <div class="chatbot-functional-intro"><span>${creatorChatbotIcon("command")}</span><div><strong>Un message. Une commande. Un effet.</strong><p>Recevez les commandes ! directement depuis le chat TikTok, Kick ou Twitch. Musique, actions et overlays fonctionnent sans publier de réponse dans le chat.</p></div><code>!skip</code><code>!song titre</code><code>!roue</code></div>
    <div id="creator-chatbot-panel" data-creator-chatbot-panel>${creatorChatbotPanelMarkup()}</div><div data-creator-chatbot-activity data-chatbot-activity-state="${escapeHtml(creatorChatbotActivitySignature())}">${creatorChatbotActivityMarkup()}</div>
    <p class="chatbot-safety-note">Les aperçus restent locaux : aucun message n’est envoyé et aucune interaction du LIVE n’est déclenchée.</p>
  </div>`;
}

/** Le chat fréquent reconstruit uniquement le journal, jamais le tableau. */
function syncCreatorChatbotActivity() {
  if (currentPage !== "commands" || !isAccountAuthenticated()) return false;
  const journal = content.querySelector("[data-creator-chatbot-activity]");
  if (!journal) return false;
  const signature = creatorChatbotActivitySignature();
  if (journal.dataset.chatbotActivityState === signature) return true;
  journal.innerHTML = creatorChatbotActivityMarkup();
  journal.dataset.chatbotActivityState = signature;
  if (typeof applyStudioLanguage === "function") applyStudioLanguage(journal);
  return true;
}

/** Mise à jour ciblée après CRUD : la bannière reste montée. */
function syncCreatorChatbotRuntime() {
  if (currentPage !== "commands" || !isAccountAuthenticated()) return false;
  const panel = content.querySelector("[data-creator-chatbot-panel]");
  if (!panel) return false;
  panel.innerHTML = creatorChatbotPanelMarkup();
  if (typeof applyStudioLanguage === "function") applyStudioLanguage(panel);
  return true;
}
