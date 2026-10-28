"use strict";

/** Accueil public ; les identités LIVE appartiennent au module home-live. */
function creatorHomeLink(page, label, className = "button") {
  if (!canNavigateTo(page)) return "";
  return `<button type="button" class="${className}" data-navigate="${page}">${escapeHtml(label)}<span aria-hidden="true">↗</span></button>`;
}

function creatorHomeFeature(page, title, description, accent, label) {
  if (!canNavigateTo(page)) return "";
  return `<button type="button" class="home-feature home-accent-${accent}" data-navigate="${page}">
    <span class="home-feature-heading"><span class="home-feature-icon" aria-hidden="true">${page === "actions" ? eventIconMarkup("gift") : navigationIcon(page === "users" ? "statistics" : page)}</span><strong>${escapeHtml(title)}</strong></span>
    <span class="home-feature-description">${escapeHtml(description)}</span>
    <span class="home-feature-cta">${escapeHtml(label)}<span aria-hidden="true">→</span></span>
  </button>`;
}

function creatorHomeStep(number, page, title, description, label) {
  if (!canNavigateTo(page)) return "";
  return `<button type="button" class="home-start-step" data-navigate="${page}">
    <span class="home-step-illustration" aria-hidden="true"><span class="home-step-symbol">${navigationIcon(page)}</span><span class="home-step-number">${number}</span></span>
    <span class="home-step-copy"><strong>${escapeHtml(title)}</strong><span>${escapeHtml(description)}</span></span>
    <span class="home-step-link">${escapeHtml(label)}<span aria-hidden="true">↗</span></span>
  </button>`;
}

function renderCreatorHome() {
  const authenticated = isAccountAuthenticated();
  const live = typeof renderCreatorHomeLive === "function" ? renderCreatorHomeLive() || "" : "";
  const features = [
    creatorHomeFeature("actions", "Actions & événements", "Cadeaux, likes, commentaires : donnez vie aux réactions du chat.", "pink", "Créer mes actions"),
    creatorHomeFeature("games", "Jeux & interactions", "Explorez les jeux vidéo compatibles et leurs interactions.", "cyan", "Découvrir les jeux"),
    creatorHomeFeature("overlays", "Overlays & widgets", "Personnalisez vos sources de diffusion et vos widgets interactifs.", "purple", "Choisir mes overlays"),
    creatorHomeFeature("users", "Utilisateurs & stats", "Retrouvez l’historique des participants et leurs contributions.", "green", "Voir les utilisateurs")
  ].join("");
  const steps = [
    creatorHomeStep("1", "connections", "Connectez votre live", "Préparez vos plateformes et vos sources d’événements.", "Configurer mes sources"),
    creatorHomeStep("2", "actions", "Imaginez les interactions", "Associez les cadeaux aux actions qui rendent votre show unique.", "Créer une interaction"),
    creatorHomeStep("3", "dashboard", "Testez, puis lancez-vous", "Vérifiez vos déclencheurs dans le simulateur avant de diffuser.", "Ouvrir le simulateur")
  ].join("");
  const explore = [
    ["voice", "voice", "La voix de votre communauté", "Faites entendre le chat et vos alertes sonores."],
    ["music", "music", "Donnez le rythme", "Préparez la musique et les demandes de titres."],
    ["controllers", "actions", "Gardez le contrôle", "Pilotez vos actions avec Stream Deck et MIDI."]
  ].filter(([page]) => canNavigateTo(page));
  return `<div class="creator-home-page" data-home-page>
    <section class="home-hero" aria-labelledby="home-heading">
      <img class="home-hero-art" src="assets/studio/home.webp" alt="" width="1672" height="941" decoding="async" fetchpriority="high">
      <button type="button" class="home-discord" data-action="open-url" data-value="https://discord.gg/udfRRBDtdd">
        <span class="home-discord-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M19.54 5.34A16.3 16.3 0 0 0 15.43 4l-.5 1.02a15.1 15.1 0 0 0-5.86 0L8.56 4a16.5 16.5 0 0 0-4.1 1.35C1.86 9.2 1.16 12.96 1.51 16.66a16.6 16.6 0 0 0 5.04 2.56l1.23-1.68a10.6 10.6 0 0 1-1.94-.94l.48-.37c3.75 1.73 7.82 1.73 11.52 0l.49.37c-.62.37-1.27.68-1.95.94l1.23 1.68a16.5 16.5 0 0 0 5.04-2.56c.42-4.29-.72-8.01-3.11-11.32ZM8.68 14.36c-1.13 0-2.05-1.03-2.05-2.29s.9-2.3 2.05-2.3c1.15 0 2.07 1.04 2.05 2.3 0 1.26-.9 2.29-2.05 2.29Zm6.65 0c-1.13 0-2.05-1.03-2.05-2.29s.9-2.3 2.05-2.3c1.15 0 2.07 1.04 2.05 2.3 0 1.26-.9 2.29-2.05 2.29Z"/></svg></span>
        <span class="home-discord-copy"><strong>Rejoindre le Discord</strong><span>Échangez avec la communauté</span></span>
        <span class="home-discord-arrow" aria-hidden="true">↗</span>
      </button>
      <div class="home-hero-copy">
        <img class="home-wordmark" src="assets/brand/shenpulse-banner-transparent.png" alt="ShenPulse" width="520" height="150" decoding="async">
        <span class="home-eyebrow">VOTRE LIVE, VOTRE UNIVERS</span>
        <h2 id="home-heading"><span>Un live.</span><span class="home-heading-accent">Toute une communauté aux commandes.</span></h2>
        <p>Transformez les cadeaux, les likes et le chat en expériences interactives. Personnalisez vos overlays, choisissez vos jeux et préparez un show qui vous ressemble.</p>
        <div class="home-hero-actions">
          ${authenticated ? creatorHomeLink("dashboard", "Ouvrir mon tableau de bord", "button primary home-primary") : '<button type="button" class="button primary home-primary" data-action="account-login">Commencer avec ShenPulse<span aria-hidden="true">↗</span></button>'}
          ${creatorHomeLink("games", "Explorer les jeux", "button home-secondary")}
        </div>
        <div class="home-platforms"><span>VOS PLATEFORMES</span><span class="home-platform">TikTok LIVE</span><span class="home-platform">Kick</span><span class="home-platform">Twitch</span></div>
      </div>
      <div class="home-live-slot" data-home-live-slot>${live}</div>
      <span class="home-hero-signature">CRÉEZ · INTERAGISSEZ · DIFFUSEZ</span>
    </section>
    ${typeof renderAgencyHomeSpotlight === "function" && canNavigateTo("agencies") ? renderAgencyHomeSpotlight() : ""}
    ${features ? `<section class="home-features" aria-label="Les outils ShenPulse">${features}</section>` : ""}
    ${steps ? `<section class="home-start" aria-labelledby="home-steps-heading"><img class="home-start-art" src="assets/studio/home-steps.webp" alt="" loading="lazy" decoding="async" width="1800" height="600"><header class="home-section-heading"><div><span class="home-eyebrow">BIEN DÉMARRER</span><h3 id="home-steps-heading">Comment ça marche ?</h3><p>Votre prochain grand live, en trois étapes.</p></div></header><div class="home-start-steps">${steps}</div></section>` : ""}
    ${explore.length ? `<section class="home-explore" aria-label="Explorez votre studio">${explore.map(([page, art, title, description]) => `<button type="button" class="home-explore-card" data-navigate="${page}"><img src="assets/studio/${art}.webp" alt="" loading="lazy" decoding="async"><span><strong>${escapeHtml(title)}</strong><span>${escapeHtml(description)}</span></span><span class="home-explore-arrow" aria-hidden="true">↗</span></button>`).join("")}</section>` : ""}
  </div>`;
}
