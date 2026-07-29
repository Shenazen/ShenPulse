"use strict";

const api = window.shenPulse;
const visibilityTools = window.ShenPulseVisibility;
const content = document.getElementById("content");
const navigation = document.getElementById("navigation");
const pageTitle = document.getElementById("page-title");
const pageKicker = document.getElementById("page-kicker");
const profileSelect = document.getElementById("profile-select");
const profileControl = document.getElementById("profile-control");
const profilePickerButton = document.getElementById("profile-picker-button");
const profileCurrentName = document.getElementById("profile-current-name");
const profileMenu = document.getElementById("profile-menu");
const profileManageButton = document.getElementById("profile-manage-button");
const gameSessionControl = document.getElementById("game-session-control");
const gameSessionSummary = document.getElementById("game-session-summary");
const gameSessionLabel = document.getElementById("game-session-label");
const gameSessionStop = document.getElementById("game-session-stop");
const sessionButton = document.getElementById("session-button");
const sessionLabel = document.getElementById("session-label");
const accountAuthCta = document.getElementById("account-auth-cta");
const tiktokAccountButton = document.getElementById("tiktok-account-button");
const tiktokControl = tiktokAccountButton.closest(".tiktok-control");
const tiktokConnectionButton = document.getElementById("tiktok-connection-button");
const tiktokAccountLabel = document.getElementById("tiktok-account-label");
const tiktokStatusLabel = document.getElementById("tiktok-status-label");
const tiktokStatusDot = document.getElementById("tiktok-status-dot");
const accountMenuButton = document.getElementById("account-menu-button");
const accountMenu = document.getElementById("account-menu");
const accountAvatar = document.getElementById("account-avatar");
const accountName = document.getElementById("account-name");
const accountEmail = document.getElementById("account-email");
const accountMenuAvatar = document.getElementById(
  "account-menu-avatar"
);
const accountMenuName = document.getElementById("account-menu-name");
const accountMenuEmail = document.getElementById(
  "account-menu-email"
);
const dialog = document.getElementById("editor-dialog");
const dialogForm = document.getElementById("editor-form");
const dialogTitle = document.getElementById("dialog-title");
const dialogKicker = document.getElementById("dialog-kicker");
const dialogBody = document.getElementById("dialog-body");
const dialogError = document.getElementById("dialog-error");
const dialogSubmitButton = document.getElementById("dialog-submit");
const confirmationDialog = document.getElementById("confirmation-dialog");
const confirmationForm = document.getElementById("confirmation-form");
const confirmationTitle = document.getElementById("confirmation-title");
const confirmationMessage = document.getElementById("confirmation-message");
const confirmationCancelButton = document.getElementById(
  "confirmation-cancel"
);
const confirmationSubmitButton = document.getElementById(
  "confirmation-submit"
);
const mediaLibraryDialog = document.getElementById("media-library-dialog");
const mediaLibraryTitle = document.getElementById("media-library-title");
const mediaLibrarySources = document.getElementById("media-library-sources");
const mediaLibrarySearchInput = document.getElementById(
  "media-library-search"
);
const mediaLibraryFilters = document.getElementById("media-library-filters");
const mediaLibraryStatus = document.getElementById("media-library-status");
const mediaLibraryResults = document.getElementById("media-library-results");
const mediaLibraryUploadButton = document.getElementById(
  "media-library-upload"
);
const mediaLibraryConfirmButton = document.getElementById(
  "media-library-confirm"
);
const toastRegion = document.getElementById("toast-region");

let snapshot = null;
let currentPage = "dashboard";
let liveEvents = [];
let navigationStructureSignature = "";
let profileChromeSignature = "";
let renderedContentPage = "";
let renderedContentMarkup = "";
let dialogSubmitHandler = null;
let dialogSessionId = 0;
let confirmationResolver = null;
let actionsSearch = "";
let actionsSection = "actions";
let onlyEnabledActions = false;
let simulatorType = "gift";
let overlaySearch = "";
let overlayCategory = "all";
let soundSearch = "";
let soundCategory = "all";
let gameSearch = "";
let gameFilter = "all";
let selectedGameId = "";
let gamePageMode = "catalog";
let gameWorkspaceStep = "installation";
let gameEffectSearch = "";
let gameEffectCategory = "all";
let gameInstallProgress = null;
let gameInstallBusyId = "";
let gameLaunchProgress = null;
let gameLaunchBusyId = "";
const gamePageMessages = new Map();
const GTA_INTERACTION_OVERLAY_BACKGROUNDS = [
  ["#082b63", "Bleu nuit"],
  ["#312e81", "Indigo"],
  ["#581c87", "Violet"],
  ["#7f1d1d", "Rouge sombre"],
  ["#064e3b", "Émeraude"],
  ["#1f2937", "Anthracite"]
];
const ADMIN_OWNER_EMAIL = "alexandre.leuridan@gmail.com";
let adminSession = {
  authorized: false,
  email: "",
  uid: "",
  lastAuthenticatedAt: ""
};
let accountSession = {
  authenticated: false,
  email: "",
  uid: "",
  displayName: "",
  photoUrl: "",
  providerId: "",
  emailVerified: false,
  lastAuthenticatedAt: "",
  offline: false
};
let adminDashboard = null;
let adminWorkspace = "overview";
let adminVisibilitySection = "navigation";
let adminVisibilitySearch = "";
let adminCommerceSearch = "";
let adminBusy = false;
let siteVisibility = {
  schemaVersion: 7,
  navigation: {},
  features: {},
  actionTypes: {},
  overlays: {},
  games: {}
};
let giftSearchTimer = 0;
let giftRequestSequence = 0;
let GIFT_CATALOG = [];
let giftCatalogByName = new Map();
let activePreviewAudio = null;
let activePreviewAudioScope = "";
let mediaLibraryContext = null;
let mediaLibrarySource = "web";
let mediaLibraryKind = "all";
let mediaLibrarySelected = null;
let mediaLibraryRemoteSounds = [];
let mediaLibraryRemoteMedia = [];
let mediaLibraryRemotePage = 1;
let mediaLibraryRemoteHasMore = false;
let mediaLibraryLoading = false;
let mediaLibrarySearchTimer = 0;
let mediaLibraryRequestSequence = 0;
let wheelEditorContext = null;
let overlayPreviewRefreshTimer = 0;
let entitlementSyncPromise = null;
let pendingAccountLogoutPromise = null;
const ENTITLEMENT_SYNC_INTERVAL_MS = 30 * 1000;
const locallyHandledOverlayConfigs = new Map();
let spotifyStatus = {
  configured: false,
  connected: false,
  account: null,
  activeDevice: null,
  playback: null,
  devices: []
};

let SOUND_LIBRARY = [];
let MEDIA_LIBRARY = [];
let ttsVoices = [];
const mediaSessionEntries = new Map();

const OVERLAY_THEMES = [
  ["classic", "Classique"],
  ["gta", "GTA"],
  ["minecraft", "Minecraft"],
  ["akatsuki", "Akatsuki"],
  ["assassination-classroom", "Assassination Classroom"],
  ["fairy-tail", "Fairy Tail"],
  ["harry-potter", "Harry Potter"],
  ["cult-of-the-lamb", "Cult of the Lamb"],
  ["stardew-valley", "Stardew Valley"],
  ["terraria", "Terraria"],
  ["one-piece", "One Piece"],
  ["demon-slayer", "Demon Slayer"],
  ["dragon-ball", "Dragon Ball"],
  ["naruto", "Naruto"]
];

const COIN_JAR_MODELS = [
  ["fantasy", "Fantasy"],
  ["football", "Football"],
  ["gaming-retro", "Gaming rétro"],
  ["gaming-modern", "Gaming moderne"],
  ["magic-alchemy", "Magie / Alchimie"],
  ["cyberpunk", "Cyberpunk"],
  ["kawaii", "Kawaii"],
  ["pirate-treasure", "Pirate / Trésor"],
  ["halloween", "Halloween"],
  ["winter-christmas", "Noël / Hiver"],
  ["luxury-casino", "Luxury / Casino"],
  ["manga-anime", "Manga / Anime"],
  ["enchanted-forest", "Forêt enchantée"],
  ["space", "Spatial"]
];

const MATCH_VARIANTS = [
  ["tikcontrol", "TikControl"],
  ["gladiador", "Gladiador"]
];

const overlayDesignSelections = Object.create(null);

const SUBSCRIPTION_PLANS = [
  {
    tier: "free",
    name: "Free",
    price: 0,
    description: "Catalogue visible, overlays inclus, actions et simulateur.",
    features: ["Overlays locaux", "Actions et simulateur", "Catalogue des jeux consultable"]
  },
  {
    tier: "pro",
    name: "Pro",
    price: 9.99,
    description: "Débloque les fonctions Pro et l’accès aux jeux ShenPulse.",
    features: ["Toutes les fonctions Pro", "Accès aux jeux interactifs", "Passerelles locales et support des packs"]
  },
  {
    tier: "premium",
    name: "Premium",
    price: 13.99,
    description: "Inclut automatiquement Pro et ajoute les avantages Premium.",
    features: ["Tout Pro inclus", "Avantages Premium", "1 accès Pro offert à un utilisateur"]
  }
];

const ACTION_TYPE_LABELS = {
  "overlay.media": "Media",
  "tts.speak": "Synthèse vocale",
  "audio.play": "Son",
  "goal.add": "Objectif",
  "timer.add": "Minuteur",
  "wheel.spin": "Roue",
  "game.effect": "Effet de jeu",
  "overlay.win-counter": "Compteur WINS",
  "obs.request": "Commande OBS",
  "http.request": "Requête HTTP",
  "websocket.send": "Message WebSocket",
  "chat.reply": "Réponse chat",
  "spotify.queue": "Spotify",
  "system.keys": "Raccourci clavier",
  "system.open": "Ouvrir une URL",
  delay: "Délai"
};

const ACTION_TYPE_ICONS = {
  "overlay.media": "🎬",
  "tts.speak": "🗣️",
  "audio.play": "🔊",
  "goal.add": "🎯",
  "timer.add": "⏱️",
  "wheel.spin": "🎡",
  "game.effect": "🎮",
  "overlay.win-counter": "🏆",
  "obs.request": "📺",
  "http.request": "🌐",
  "websocket.send": "🔌",
  "chat.reply": "💬",
  "spotify.queue": "🎵",
  "system.keys": "⌨️",
  "system.open": "🔗",
  delay: "⌛"
};

const NAVIGATION_ICONS = {
  dashboard: `
    <rect width="7" height="9" x="3" y="3" rx="1"></rect>
    <rect width="7" height="5" x="14" y="3" rx="1"></rect>
    <rect width="7" height="9" x="14" y="12" rx="1"></rect>
    <rect width="7" height="5" x="3" y="16" rx="1"></rect>`,
  live: `
    <path d="M4.9 19.1C1 15.2 1 8.8 4.9 4.9"></path>
    <path d="M7.8 16.2c-2.3-2.3-2.3-6.1 0-8.5"></path>
    <circle cx="12" cy="12" r="2"></circle>
    <path d="M16.2 7.8c2.3 2.3 2.3 6.1 0 8.5"></path>
    <path d="M19.1 4.9C23 8.8 23 15.1 19.1 19"></path>`,
  actions: `
    <path d="M4 14a1 1 0 0 1-.78-1.63l9.9-10.2a.5.5 0 0 1 .86.46l-1.92 6.02A1 1 0 0 0 13 10h7a1 1 0 0 1 .78 1.63l-9.9 10.2a.5.5 0 0 1-.86-.46l1.92-6.02A1 1 0 0 0 11 14z"></path>`,
  sounds: `
    <circle cx="8" cy="18" r="4"></circle>
    <path d="M12 18V2l7 4"></path>`,
  rules: `
    <rect width="8" height="8" x="3" y="3" rx="2"></rect>
    <path d="M7 11v4a2 2 0 0 0 2 2h4"></path>
    <rect width="8" height="8" x="13" y="13" rx="2"></rect>`,
  overlays: `
    <path d="M10 7.75a.75.75 0 0 1 1.142-.638l3.664 2.249a.75.75 0 0 1 0 1.278l-3.664 2.25a.75.75 0 0 1-1.142-.64z"></path>
    <path d="M12 17v4"></path>
    <path d="M8 21h8"></path>
    <rect x="2" y="3" width="20" height="14" rx="2"></rect>`,
  games: `
    <line x1="6" x2="10" y1="11" y2="11"></line>
    <line x1="8" x2="8" y1="9" y2="13"></line>
    <line x1="15" x2="15.01" y1="12" y2="12"></line>
    <line x1="18" x2="18.01" y1="10" y2="10"></line>
    <path d="M17.32 5H6.68a4 4 0 0 0-3.978 3.59c-.006.052-.01.101-.017.152C2.604 9.416 2 14.456 2 16a3 3 0 0 0 3 3c1 0 1.5-.5 2-1l1.414-1.414A2 2 0 0 1 9.828 16h4.344a2 2 0 0 1 1.414.586L17 18c.5.5 1 1 2 1a3 3 0 0 0 3-3c0-1.545-.604-6.584-.685-7.258-.007-.05-.011-.1-.017-.151A4 4 0 0 0 17.32 5z"></path>`,
  goals: `
    <circle cx="12" cy="12" r="10"></circle>
    <circle cx="12" cy="12" r="6"></circle>
    <circle cx="12" cy="12" r="2"></circle>`,
  commands: `
    <path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z"></path>
    <path d="M8 12h.01M12 12h.01M16 12h.01"></path>`,
  membership: `
    <path d="M11.562 3.266a.5.5 0 0 1 .876 0L15.39 8.87a1 1 0 0 0 1.516.294L21.183 5.5a.5.5 0 0 1 .798.519l-2.834 10.246a1 1 0 0 1-.956.734H5.81a1 1 0 0 1-.957-.734L2.02 6.02a.5.5 0 0 1 .798-.519l4.276 3.664a1 1 0 0 0 1.516-.294z"></path>
    <path d="M5 21h14"></path>`,
  connections: `
    <path d="M6.3 20.3a2.4 2.4 0 0 0 3.4 0L12 18l-6-6-2.3 2.3a2.4 2.4 0 0 0 0 3.4Z"></path>
    <path d="m2 22 3-3"></path>
    <path d="M7.5 13.5 10 11M10.5 16.5 13 14"></path>
    <path d="m18 3-4 4h6l-4 4"></path>`,
  activity: `
    <path d="M15 12h-5M15 8h-5"></path>
    <path d="M19 17V5a2 2 0 0 0-2-2H4"></path>
    <path d="M8 21h12a2 2 0 0 0 2-2v-1a1 1 0 0 0-1-1H11a1 1 0 0 0-1 1v1a2 2 0 1 1-4 0V5a2 2 0 1 0-4 0v2a1 1 0 0 0 1 1h3"></path>`,
  settings: `
    <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"></path>
    <circle cx="12" cy="12" r="3"></circle>`,
  admin: `
    <path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"></path>
    <path d="m9 12 2 2 4-4"></path>`
};

function navigationIcon(pageId) {
  const icon = NAVIGATION_ICONS[pageId] || NAVIGATION_ICONS.actions;
  return `
    <svg
      class="nav-icon-svg nav-icon-svg--${pageId}"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2.25"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
      focusable="false"
    >${icon}</svg>`;
}

const pages = [
  { section: "PILOTAGE" },
  { id: "dashboard", label: "Vue d’ensemble", icon: "⌁", title: "Vue d’ensemble", kicker: "CENTRE DE CONTRÔLE" },
  { id: "live", label: "Session en direct", icon: "◉", title: "Session en direct", kicker: "ÉVÉNEMENTS TEMPS RÉEL", count: () => isAccountAuthenticated() ? liveEvents.length : null },
  { section: "CRÉATION" },
  { id: "rules", label: "Automatisations", icon: "⎇", title: "Automatisations", kicker: "MOTEUR DE RÈGLES", count: () => snapshot?.state.rules.length },
  { id: "overlays", label: "Overlays", icon: "▱", title: "Overlays & widgets", kicker: "SOURCES NAVIGATEUR" },
  { id: "games", label: "Jeux & effets", icon: "◇", title: "Jeux & effets", kicker: "INTERACTIONS EN JEU", count: () => snapshot?.packs.length },
  { id: "goals", label: "Objectifs", icon: "◎", title: "Objectifs", kicker: "PROGRESSION EN DIRECT" },
  { id: "commands", label: "Chatbot", icon: "⌘", title: "Chatbot & commandes", kicker: "ENGAGEMENT DU CHAT" },
  { section: "SYSTÈME" },
  { id: "membership", label: "Abonnement", icon: "♛", title: "Tarifs & abonnement", kicker: "ACCÈS SHENPULSE" },
  { id: "connections", label: "Connexions", icon: "⌁", title: "Connexions", kicker: "PLATEFORMES & RELAIS", count: () => snapshot?.state.connections.length },
  { id: "activity", label: "Journal", icon: "≡", title: "Journal d’activité", kicker: "DIAGNOSTIC LOCAL" },
  { id: "settings", label: "Paramètres", icon: "⚙", title: "Paramètres", kicker: "APPLICATION & CONFIDENTIALITÉ" },
  {
    id: "admin",
    label: "Administration",
    icon: "♜",
    title: "Administration ShenPulse",
    kicker: "ACCÈS PROPRIÉTAIRE SÉCURISÉ",
    hidden: () => !isVerifiedAdminSession()
  }
];

const creationPageIndex = pages.findIndex((page) => page.id === "rules");
pages.splice(
  creationPageIndex < 0 ? pages.length : creationPageIndex,
  0,
  {
    id: "actions",
    label: "Actions",
    icon: "⚡",
    title: "Actions & déclencheurs",
    kicker: "WORKFLOW INTERACTIF",
    count: () => flattenActions().length
  },
  {
    id: "sounds",
    label: "Sons",
    icon: "♫",
    title: "Sons & voix",
    kicker: "BIBLIOTHÈQUE AUDIO",
    count: () => soundActionRows().length
  }
);

const eventIcons = {
  gift: "🎁",
  follow: "👤",
  like: "❤️",
  chat: "💬",
  share: "🔁",
  subscribe: "⭐",
  join: "👋",
  raid: "⚡️"
};

const EVENT_LABELS = {
  gift: "Cadeau",
  follow: "Follow",
  like: "Likes",
  chat: "Message",
  share: "Partage",
  subscribe: "Abonnement",
  join: "Arrivée",
  raid: "Raid"
};

const AUTOMATED_GAME_INSTALLERS = new Set([
  "gtav-montchiliad",
  "pokemon-red-blue",
  "minecraft-bedrock-box",
  "minecraft-sandbox-3",
  "minecraft-survival-plugin",
  "cult-of-the-lamb",
  "stardew-valley",
  "terraria"
]);

const MINECRAFT_LAUNCHER_ID = "minecraft";
const MINECRAFT_MODE_IDS = Object.freeze([
  "minecraft-bedrock-box",
  "minecraft-sandbox-3"
]);

const CONFIGURABLE_INTEGRATED_GAMES = new Set([
  "coin-pusher",
  "connect-four",
  "deal-or-no-deal"
]);

const DEFAULT_GAME_JOURNEY = Object.freeze([
  Object.freeze({ id: "installation", label: "Installation", icon: "↓" }),
  Object.freeze({ id: "interactions", label: "Interactions", icon: "⚡" }),
  Object.freeze({ id: "overlays", label: "Overlays", icon: "▱" }),
  Object.freeze({ id: "launch", label: "Démarrage", icon: "▶" })
]);

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function normalizeGiftName(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLocaleLowerCase("fr");
}

function rememberGifts(gifts = []) {
  for (const gift of gifts) {
    const key = normalizeGiftName(gift.name);
    if (!key) continue;
    giftCatalogByName.set(key, gift);
  }
  GIFT_CATALOG = [...giftCatalogByName.values()];
}

function giftForName(name) {
  return giftCatalogByName.get(normalizeGiftName(name)) || null;
}

function eventIconMarkup(type, options = {}) {
  const kind = String(type || "").toLocaleLowerCase("fr");
  const imageUrl =
    options.imageUrl || (kind === "gift" ? giftForName(options.giftName)?.imageUrl : "");
  if (imageUrl) {
    return `<span class="event-visual event-${escapeHtml(kind)}"><img src="${escapeHtml(imageUrl)}" alt="" loading="lazy"></span>`;
  }
  const paths = {
    gift: '<path d="M4 10h16v10H4zM3 7h18v4H3zM12 7v13M12 7H8.8A2.8 2.8 0 1 1 12 4.2V7Zm0 0h3.2A2.8 2.8 0 1 0 12 4.2V7Z"/>',
    follow: '<circle cx="9" cy="8" r="3"/><path d="M3.5 20a5.5 5.5 0 0 1 11 0M18 8v6M15 11h6"/>',
    like: '<path d="M20.8 5.8a5.4 5.4 0 0 0-7.6 0L12 7l-1.2-1.2a5.4 5.4 0 0 0-7.6 7.6L12 22l8.8-8.6a5.4 5.4 0 0 0 0-7.6Z"/>',
    chat: '<path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4Z"/><path d="M8 9h8M8 13h5"/>',
    share: '<circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="m8.6 10.5 6.8-4M8.6 13.5l6.8 4"/>',
    subscribe: '<path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2L12 17.3l-5.6 2.9 1.1-6.2L3 9.6l6.2-.9Z"/>',
    join: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/><path d="m18 4 2 2 3-3"/>',
    raid: '<path d="m13 2-9 12h7l-1 8 9-12h-7Z"/>',
    manual: '<circle cx="12" cy="12" r="9"/><path d="m10 8 6 4-6 4Z"/>'
  };
  return `<span class="event-visual event-${escapeHtml(kind || "other")}"><svg viewBox="0 0 24 24" aria-hidden="true">${paths[kind] || '<circle cx="12" cy="12" r="7"/>'}</svg></span>`;
}

function ruleGiftName(rule) {
  return (rule?.conditions || []).find(
    (condition) =>
      condition.field === "data.giftName" &&
      String(condition.operator || "equals") === "equals"
  )?.value || "";
}

function hasAutomaticTrigger(rule) {
  return rule?.trigger?.enabled !== false;
}

function triggerPill(rule) {
  if (!hasAutomaticTrigger(rule)) {
    return `<span class="trigger-pill trigger-manual">${eventIconMarkup("manual")}<span>Lancement manuel</span></span>`;
  }
  const type = rule?.trigger?.type || "*";
  const giftName = type === "gift" ? ruleGiftName(rule) : "";
  return `<span class="trigger-pill">${eventIconMarkup(type, {
    giftName
  })}<span>${escapeHtml(triggerLabel(rule))}</span></span>`;
}

function asNumber(value) {
  return new Intl.NumberFormat("fr-FR", { notation: "compact", maximumFractionDigits: 1 }).format(Number(value || 0));
}

function formatTime(value) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("fr-FR", { hour: "2-digit", minute: "2-digit", second: "2-digit" }).format(new Date(value));
}

function formatDuration(startedAt) {
  if (!startedAt) return "00:00:00";
  const seconds = Math.max(0, Math.floor((Date.now() - new Date(startedAt).getTime()) / 1000));
  const hours = String(Math.floor(seconds / 3600)).padStart(2, "0");
  const minutes = String(Math.floor((seconds % 3600) / 60)).padStart(2, "0");
  const rest = String(seconds % 60).padStart(2, "0");
  return `${hours}:${minutes}:${rest}`;
}

function toast(title, detail = "", isError = false) {
  const node = document.createElement("div");
  node.className = `toast${isError ? " error" : ""}`;
  node.innerHTML = `<strong>${escapeHtml(title)}</strong><span>${escapeHtml(detail)}</span>`;
  toastRegion.appendChild(node);
  setTimeout(() => node.remove(), 4200);
}

function finishConfirmation(confirmed) {
  const resolve = confirmationResolver;
  if (!resolve) return;
  confirmationResolver = null;
  if (confirmationDialog.open) {
    confirmationDialog.close(confirmed ? "confirm" : "cancel");
  }
  requestAnimationFrame(() => {
    window.focus();
    resolve(confirmed);
  });
}

function confirmAction(
  message,
  {
    title = "Confirmer l’action",
    confirmLabel = "Confirmer",
    danger = true
  } = {}
) {
  if (confirmationResolver) finishConfirmation(false);
  confirmationTitle.textContent = title;
  confirmationMessage.textContent = String(message || "");
  confirmationSubmitButton.textContent = confirmLabel;
  confirmationSubmitButton.classList.toggle("danger", danger);
  return new Promise((resolve) => {
    confirmationResolver = resolve;
    if (!confirmationDialog.open) confirmationDialog.showModal();
    requestAnimationFrame(() => {
      confirmationCancelButton.focus({ preventScroll: true });
    });
  });
}

async function perform(work, successMessage) {
  try {
    const result = await work();
    if (successMessage) toast(successMessage);
    return result;
  } catch (error) {
    toast("Action impossible", error.message || String(error), true);
    throw error;
  }
}

function acceptSnapshot(value) {
  snapshot = value;
  if (value?.state?.settings?.siteVisibility) {
    siteVisibility = value.state.settings.siteVisibility;
  }
  if (Array.isArray(value?.soundCatalog) && value.soundCatalog.length) {
    SOUND_LIBRARY = value.soundCatalog;
  }
  if (Array.isArray(value?.mediaCatalog)) {
    MEDIA_LIBRARY = value.mediaCatalog;
  }
  return value;
}

function overlayPageStateSignature(value) {
  const state = value?.state || {};
  return JSON.stringify({
    overlayUrls: value?.overlayUrls || {},
    localOverlayUrls: value?.localOverlayUrls || {},
    publicOverlayRelay: value?.publicOverlayRelay || {},
    profileId: state.session?.profileId || "",
    profiles: (state.profiles || []).map((profile) => [
      profile.id,
      profile.name
    ]),
    overlayConfigs: state.settings?.overlayConfigs || {},
    overlayVisibility: state.settings?.siteVisibility?.overlays || {},
    subscription: state.commerce?.subscription || {}
  });
}

function overlayPageStableStateSignature(value) {
  const state = value?.state || {};
  return JSON.stringify({
    overlayUrls: value?.overlayUrls || {},
    localOverlayUrls: value?.localOverlayUrls || {},
    publicOverlayRelay: value?.publicOverlayRelay || {},
    profileId: state.session?.profileId || "",
    profiles: (state.profiles || []).map((profile) => [
      profile.id,
      profile.name
    ]),
    overlayVisibility: state.settings?.siteVisibility?.overlays || {},
    subscription: state.commerce?.subscription || {}
  });
}

function gamePageStateSignature(value) {
  const state = value?.state || {};
  return JSON.stringify({
    packs: value?.packs || [],
    overlayUrls: value?.overlayUrls || {},
    localOverlayUrls: value?.localOverlayUrls || {},
    profileId: state.session?.profileId || "",
    activeGamePackId: state.session?.activeGamePackId || "",
    gameSession: state.session?.game || {},
    game: state.game || {},
    interactionRulesByPack: state.game?.interactionRulesByPack || {},
    overlayConfigs: state.settings?.overlayConfigs || {},
    gameVisibility: state.settings?.siteVisibility?.games || {},
    subscription: state.commerce?.subscription || {},
    gameEntitlements: state.commerce?.gameEntitlements || []
  });
}

function consumeLocallyHandledOverlayState(previous, value) {
  if (
    overlayPageStableStateSignature(previous) !==
    overlayPageStableStateSignature(value)
  ) {
    return false;
  }
  const previousConfigs = previous?.state?.settings?.overlayConfigs || {};
  const nextConfigs = value?.state?.settings?.overlayConfigs || {};
  const keys = new Set([
    ...Object.keys(previousConfigs),
    ...Object.keys(nextConfigs)
  ]);
  const changedKeys = [...keys].filter(
    (key) =>
      JSON.stringify(previousConfigs[key] || {}) !==
      JSON.stringify(nextConfigs[key] || {})
  );
  if (
    !changedKeys.length ||
    !changedKeys.every(
      (key) =>
        locallyHandledOverlayConfigs.get(key) ===
        JSON.stringify(nextConfigs[key] || {})
    )
  ) {
    return false;
  }
  for (const key of changedKeys) locallyHandledOverlayConfigs.delete(key);
  return true;
}

function giftPickerField(name, label, value = "", extra = "", help = "") {
  const selectedGift = giftForName(value);
  return `<div class="field gift-picker ${extra.includes("full") ? "full" : ""}" data-gift-picker-root>
    ${help ? fieldLabelWithInfo(label, help) : `<span>${escapeHtml(label)}</span>`}
    <div class="gift-picker-input">
      <input name="${escapeHtml(name)}" value="${escapeHtml(value)}" data-gift-picker autocomplete="off" placeholder="Rechercher un cadeau TikTok…" ${extra.replace("full", "")}>
      <span class="gift-picker-selection" data-gift-selected title="${escapeHtml(selectedGift?.name || "Cadeau TikTok")}">
        ${selectedGift?.imageUrl ? `<img src="${escapeHtml(selectedGift.imageUrl)}" alt="">` : eventIconMarkup("gift")}
      </span>
      <button type="button" data-gift-clear title="Effacer">×</button>
    </div>
    <div class="gift-picker-results" data-gift-results hidden></div>
    <small>Recherche rapide par nom ou nombre de pièces dans le catalogue TikTok global.</small>
  </div>`;
}

async function hydrateGiftCatalog(query = "", input = null) {
  const list = document.getElementById("gift-catalog-options");
  if (!list) return;
  const requestId = String(++giftRequestSequence);
  if (input) input.dataset.giftRequestId = requestId;
  try {
    const result = await api.searchGifts(query, 1000);
    if (input && input.dataset.giftRequestId !== requestId) return;
    rememberGifts(result.gifts || []);
    list.innerHTML = (result.gifts || [])
      .map(
        (gift) =>
          `<option value="${escapeHtml(gift.name)}">${escapeHtml(gift.cost)} pièces · ${escapeHtml(gift.id)}</option>`
      )
      .join("");
    list.dataset.total = String(result.total || 0);
    const root = input?.closest("[data-gift-picker-root]");
    const results = root?.querySelector("[data-gift-results]");
    if (results) {
      const gifts = result.gifts || [];
      results.innerHTML = `<div class="gift-results-summary">
          <strong>${gifts.length} cadeau${gifts.length > 1 ? "x" : ""}</strong>
          <span>Tri : pièces ↑ puis A–Z</span>
        </div>${gifts
        .map(
          (gift) => `<button type="button" class="gift-result" data-gift-choice="${escapeHtml(gift.name)}" data-gift-image="${escapeHtml(gift.imageUrl || "")}">
            ${gift.imageUrl ? `<img src="${escapeHtml(gift.imageUrl)}" alt="" loading="lazy">` : '<span class="gift-result-fallback">🎁</span>'}
            <span><strong>${escapeHtml(gift.name)}</strong><small>${escapeHtml(gift.cost)} pièce${gift.cost > 1 ? "s" : ""}</small></span>
            <span class="gift-result-select">Choisir</span>
          </button>`
        )
        .join("")}${gifts.length ? "" : `<p class="picker-empty">Aucun cadeau trouvé.</p>`}`;
      results.hidden = false;
      positionGiftResults(root);
    }
    if (input) updateGiftPickerSelection(input.closest("[data-gift-picker-root]"));
    else updateAllGiftPickerSelections();
  } catch {
    list.innerHTML = "";
  }
}

function updateGiftPickerSelection(root, gift = null) {
  const input = root?.querySelector("[data-gift-picker]");
  const selected = root?.querySelector("[data-gift-selected]");
  if (!input || !selected) return;
  const exactGift = gift || giftForName(input.value);
  selected.title = exactGift?.name || "Cadeau TikTok";
  selected.innerHTML = exactGift?.imageUrl
    ? `<img src="${escapeHtml(exactGift.imageUrl)}" alt="">`
    : eventIconMarkup("gift");
}

function updateAllGiftPickerSelections() {
  document
    .querySelectorAll("[data-gift-picker-root]")
    .forEach((root) => updateGiftPickerSelection(root));
}

function positionGiftResults(root) {
  const inputBox = root?.querySelector(".gift-picker-input");
  const results = root?.querySelector("[data-gift-results]");
  if (!inputBox || !results || results.hidden) return;
  const rect = inputBox.getBoundingClientRect();
  const margin = 10;
  const roomBelow = window.innerHeight - rect.bottom - margin;
  const roomAbove = rect.top - margin;
  const openAbove = roomBelow < 260 && roomAbove > roomBelow;
  const available = Math.max(
    80,
    Math.min(430, openAbove ? roomAbove : roomBelow)
  );
  results.style.left = `${Math.max(margin, rect.left)}px`;
  results.style.width = `${Math.min(
    rect.width,
    window.innerWidth - Math.max(margin, rect.left) - margin
  )}px`;
  results.style.maxHeight = `${available}px`;
  results.style.top = openAbove ? "auto" : `${rect.bottom + 6}px`;
  results.style.bottom = openAbove
    ? `${window.innerHeight - rect.top + 6}px`
    : "auto";
}

function scheduleGiftCatalog(input) {
  updateGiftPickerSelection(input?.closest("[data-gift-picker-root]"));
  clearTimeout(giftSearchTimer);
  giftSearchTimer = setTimeout(
    () => hydrateGiftCatalog(input?.value || "", input),
    160
  );
}

function soundPickerField(
  name,
  selectedUrl = "",
  {
    label = "Son à jouer",
    selectedName = "",
    optional = false
  } = {}
) {
  const selected =
    soundLibraryEntry(selectedUrl) ||
    mediaSessionEntries.get(selectedUrl) ||
    (selectedUrl
      ? {
          id: selectedUrl,
          name: selectedName || mediaNameFromUrl(selectedUrl),
          detail: "Son externe",
          category: "audio",
          url: selectedUrl
        }
      : null) ||
    {
      id: "",
      name: optional ? "Aucun son sélectionné" : "Choisir un son",
      detail: optional
        ? "Cette action sera affichée sans accompagnement audio."
        : "Ouvrez la bibliothèque globale.",
      url: ""
    };
  const value = selectedUrl || selected.url;
  return `<div class="field full compact-media-picker" data-media-picker-root data-picker-kind="sound" data-picker-optional="${optional ? "true" : "false"}">
    <span>${escapeHtml(label)}</span>
    <input type="hidden" name="${escapeHtml(name)}" value="${escapeHtml(value)}" data-media-value>
    <input type="hidden" name="${escapeHtml(`${name}Name`)}" value="${escapeHtml(selected.name)}" data-media-name>
    <div class="compact-media-selection" data-media-selection>
      ${soundSelectionMarkup(selected)}
      <div class="compact-media-actions">
        ${value ? `<button type="button" class="sound-preview-button" data-media-preview-url="${escapeHtml(value)}" title="Écouter">▶</button>` : ""}
        ${optional && value ? '<button type="button" class="button ghost small" data-clear-media>Retirer</button>' : ""}
        <button type="button" class="button small" data-open-media-library data-kind="sound" data-input="${escapeHtml(name)}" data-optional="${optional ? "true" : "false"}">Ouvrir la bibliothèque</button>
      </div>
    </div>
    <small>Catalogue web MyInstants, aperçu immédiat et import personnel Backblaze.</small>
  </div>`;
}

function normalizeCatalogSearch(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function mediaPickerField(
  name,
  label,
  selectedUrl = "",
  selectedName = "",
  { optional = true } = {}
) {
  const selected =
    mediaLibraryEntry(selectedUrl) ||
    mediaSessionEntries.get(selectedUrl) ||
    (selectedUrl
      ? {
          id: selectedUrl,
          name: selectedName || mediaNameFromUrl(selectedUrl),
          detail: "Média externe",
          kind: mediaKindFromUrl(selectedUrl),
          source: "external",
          url: selectedUrl
        }
      : null);
  return `<div class="field full compact-media-picker" data-media-picker-root data-picker-kind="visual" data-picker-optional="${optional ? "true" : "false"}">
    <span>${escapeHtml(label)}</span>
    <input type="hidden" name="${escapeHtml(name)}" value="${escapeHtml(selectedUrl)}" data-media-value>
    <input type="hidden" name="${escapeHtml(`${name}Name`)}" value="${escapeHtml(selected?.name || "")}" data-media-name>
    <div class="compact-media-selection" data-media-selection>
      ${visualSelectionMarkup(selected)}
      <div class="compact-media-actions">
        ${optional && selectedUrl ? '<button type="button" class="button ghost small" data-clear-media>Retirer</button>' : ""}
        <button type="button" class="button small" data-open-media-library data-kind="visual" data-input="${escapeHtml(name)}" data-optional="${optional ? "true" : "false"}">Ouvrir la bibliothèque média</button>
      </div>
    </div>
    <small>Catalogue web d’images, GIF, vidéos et animations, ou import personnel Backblaze.</small>
  </div>`;
}

function soundSelectionMarkup(item) {
  return `<span class="compact-media-icon">♫</span>
    <span class="compact-media-copy"><strong>${escapeHtml(item?.name || "Aucun son sélectionné")}</strong><small>${escapeHtml(item?.detail || "")}</small></span>
    <span class="badge cyan">${escapeHtml(item?.category || "audio")}</span>`;
}

function visualSelectionMarkup(item) {
  if (!item?.url) {
    return `<span class="compact-media-icon">▧</span>
      <span class="compact-media-copy"><strong>Aucun média sélectionné</strong><small>Ajoutez une image, un GIF, une vidéo ou une animation.</small></span>`;
  }
  return `${mediaPreviewMarkup(item, "compact-media-thumb")}
    <span class="compact-media-copy"><strong>${escapeHtml(item.name || mediaNameFromUrl(item.url))}</strong><small>${escapeHtml(item.detail || mediaKindLabel(item.kind))}</small></span>
    <span class="badge cyan">${escapeHtml(mediaKindLabel(item.kind))}</span>`;
}

function mediaNameFromUrl(value) {
  try {
    const pathname = new URL(value, "http://127.0.0.1").pathname;
    return decodeURIComponent(pathname.split("/").pop() || "Média")
      .replace(/\.[^.]+$/, "")
      .replace(/[-_]+/g, " ");
  } catch {
    return "Média externe";
  }
}

function mediaLibraryEntry(url) {
  return (
    MEDIA_LIBRARY.find((item) => item.url === url) ||
    mediaSessionEntries.get(url) ||
    null
  );
}

function mediaKindFromUrl(value) {
  const cleanValue = String(value || "").split(/[?#]/)[0].toLowerCase();
  if (cleanValue.endsWith(".gif")) return "gif";
  if (/\.(mp4|webm)$/.test(cleanValue)) return "video";
  if (cleanValue.endsWith(".json")) return "animation";
  return "image";
}

function mediaKindLabel(kind) {
  return (
    {
      animation: "Animation",
      gif: "GIF",
      image: "Image",
      sound: "Son",
      video: "Vidéo"
    }[kind] || "Média"
  );
}

function resolvedMediaUrl(value) {
  const source = String(value || "");
  if (!source.startsWith("/overlay/media/")) return source;
  const base = snapshot?.localOverlayUrls?.base || "";
  const token = snapshot?.state?.settings?.overlayToken || "";
  if (!base) return source;
  return `${base}${source}${source.includes("?") ? "&" : "?"}token=${encodeURIComponent(token)}`;
}

function mediaPreviewMarkup(item, className = "") {
  if (!item?.url) return `<span class="${escapeHtml(className)}">▧</span>`;
  const source = escapeHtml(
    resolvedMediaUrl(item.previewUrl || item.url)
  );
  const name = escapeHtml(item.name || "Média");
  const kind = item.kind || mediaKindFromUrl(item.url);
  if (kind === "animation") {
    return `<lottie-player class="${escapeHtml(className)}" src="${source}" background="transparent" speed="1" loop autoplay aria-label="${name}"></lottie-player>`;
  }
  if (kind === "video") {
    return `<video class="${escapeHtml(className)}" src="${source}" muted loop autoplay playsinline aria-label="${name}"></video>`;
  }
  return `<img class="${escapeHtml(className)}" src="${source}" alt="${name}" loading="lazy">`;
}

function openMediaLibrary(trigger) {
  const root = trigger.closest("[data-media-picker-root]");
  const valueInput = root?.querySelector("[data-media-value]");
  if (!root || !valueInput) return;
  const selectedUrl = valueInput.value;
  const selected =
    (root.dataset.pickerKind === "sound"
      ? soundLibraryEntry(selectedUrl)
      : mediaLibraryEntry(selectedUrl)) ||
    mediaSessionEntries.get(selectedUrl) ||
    null;
  mediaLibraryContext = {
    root,
    inputName: trigger.dataset.input || valueInput.name,
    kind: trigger.dataset.kind === "sound" ? "sound" : "visual",
    optional:
      trigger.dataset.optional === "true" ||
      root.dataset.pickerOptional === "true"
  };
  mediaLibrarySource =
    selected?.source === "custom" ? "custom" : "web";
  mediaLibraryKind = "all";
  mediaLibrarySelected = selected;
  mediaLibraryRemoteSounds = [];
  mediaLibraryRemoteMedia = [];
  mediaLibraryRemotePage = 1;
  mediaLibraryRemoteHasMore = false;
  mediaLibrarySearchInput.value = "";
  mediaLibraryTitle.textContent =
    mediaLibraryContext.kind === "sound"
      ? "Choisir un son"
      : "Choisir une image, un GIF ou une vidéo";
  updateMediaLibraryUploadButton();
  renderMediaLibrary();
  if (!mediaLibraryDialog.open) mediaLibraryDialog.showModal();
  if (mediaLibrarySource === "web") loadRemoteMediaLibrary();
  requestAnimationFrame(() => mediaLibrarySearchInput.focus());
}

function closeMediaLibrary() {
  clearTimeout(mediaLibrarySearchTimer);
  mediaLibraryRequestSequence += 1;
  mediaLibraryContext = null;
  mediaLibrarySelected = null;
  mediaLibraryLoading = false;
  if (mediaLibraryDialog.open) mediaLibraryDialog.close("cancel");
}

function mediaLibrarySourceOptions() {
  const options =
    mediaLibraryContext?.kind === "sound"
      ? [
          ["web", "Catalogue web MyInstants"],
          ["custom", "Mes sons importés"]
        ]
      : [
          ["web", "Catalogue web"],
          ["custom", "Mes médias importés"]
        ];
  return options
    .map(
      ([value, label]) =>
        `<button type="button" class="${mediaLibrarySource === value ? "active" : ""}" data-media-source="${value}">${escapeHtml(label)}</button>`
    )
    .join("");
}

function mediaLibraryFilterOptions(items) {
  if (mediaLibraryContext?.kind === "visual") {
    return [
      ["all", "Tous"],
      ["image", "Images"],
      ["gif", "GIF"],
      ["video", "Vidéos"],
      ["animation", "Animations"]
    ];
  }
  const categories = [
    ...new Set(items.map((item) => item.category).filter(Boolean))
  ].sort((left, right) => left.localeCompare(right, "fr"));
  return [
    ["all", "Tous"],
    ...categories.map((category) => [category, category])
  ];
}

function mediaLibraryItems() {
  const isSound = mediaLibraryContext?.kind === "sound";
  let items = [];
  if (isSound && mediaLibrarySource === "web") {
    items = mediaLibraryRemoteSounds;
  } else if (isSound) {
    items = SOUND_LIBRARY.filter((item) => item.source === "custom");
  } else if (mediaLibrarySource === "web") {
    items = mediaLibraryRemoteMedia;
  } else {
    items = MEDIA_LIBRARY.filter((item) => item.source === "custom");
  }
  const query = normalizeCatalogSearch(mediaLibrarySearchInput.value);
  return items.filter((item) => {
    const categoryMatch =
      mediaLibraryKind === "all" ||
      (isSound
        ? item.category === mediaLibraryKind
        : (item.kind || mediaKindFromUrl(item.url)) === mediaLibraryKind);
    const queryMatch =
      !query ||
      normalizeCatalogSearch(
        `${item.name || ""} ${item.detail || ""} ${item.category || ""}`
      ).includes(query);
    return categoryMatch && queryMatch;
  });
}

function renderMediaLibrary() {
  if (!mediaLibraryContext) return;
  const items = mediaLibraryItems();
  const filters = mediaLibraryFilterOptions(
    mediaLibraryContext.kind === "sound"
      ? SOUND_LIBRARY.filter((item) => item.source === "custom")
      : mediaLibrarySource === "web"
        ? mediaLibraryRemoteMedia
        : MEDIA_LIBRARY.filter((item) => item.source === "custom")
  );
  if (!filters.some(([value]) => value === mediaLibraryKind)) {
    mediaLibraryKind = "all";
  }
  mediaLibrarySources.innerHTML = mediaLibrarySourceOptions();
  mediaLibraryFilters.innerHTML =
    mediaLibrarySource === "web" &&
    mediaLibraryContext.kind === "sound"
      ? ""
      : filters
          .map(
            ([value, label]) =>
              `<button type="button" class="${mediaLibraryKind === value ? "active" : ""}" data-media-kind="${escapeHtml(value)}">${escapeHtml(label)}</button>`
          )
          .join("");
  mediaLibraryStatus.innerHTML = mediaLibraryLoading
    ? `<span class="media-library-spinner"></span><strong>Recherche en cours…</strong>`
    : `<strong>${items.length} résultat${items.length > 1 ? "s" : ""}</strong><span>${
        mediaLibrarySource === "web"
          ? mediaLibraryContext.kind === "sound"
            ? "MyInstants · aperçu avant utilisation"
            : "Wikimedia Commons & animations TikFinity"
          : "Vos imports personnels Backblaze"
      }</span>`;
  if (mediaLibraryContext.kind === "sound") {
    mediaLibraryResults.className = "media-library-results sound-results";
    mediaLibraryResults.innerHTML = items.length
      ? items.map(soundLibraryResultMarkup).join("")
      : mediaLibraryEmptyMarkup();
    if (
      mediaLibrarySource === "web" &&
      mediaLibraryRemoteHasMore &&
      !mediaLibraryLoading
    ) {
      mediaLibraryResults.insertAdjacentHTML(
        "beforeend",
        `<button class="button media-library-more" type="button" data-media-load-more>Afficher plus de sons</button>`
      );
    }
  } else {
    mediaLibraryResults.className = "media-library-results visual-results";
    mediaLibraryResults.innerHTML = items.length
      ? items.map(visualLibraryResultMarkup).join("")
      : mediaLibraryEmptyMarkup();
  }
  mediaLibraryConfirmButton.disabled = !mediaLibrarySelected;
}

function soundLibraryResultMarkup(item) {
  const selected =
    mediaLibrarySelected?.id === item.id ||
    mediaLibrarySelected?.url === item.url;
  return `<article class="media-sound-row ${selected ? "selected" : ""}" data-media-card data-media-id="${escapeHtml(item.id || item.url)}">
    <button type="button" class="sound-preview-button" data-media-preview-url="${escapeHtml(item.url)}" title="Écouter ${escapeHtml(item.name)}">▶</button>
    <button type="button" class="media-sound-select" data-media-select="${escapeHtml(item.id || item.url)}">
      <span><strong>${escapeHtml(item.name || "Son")}</strong><small>${escapeHtml(item.detail || "Son de la bibliothèque")}</small></span>
      <span class="badge cyan">${escapeHtml(item.category || "audio")}</span>
      <span class="media-choice-mark">${selected ? "✓ Sélectionné" : "Choisir"}</span>
    </button>
  </article>`;
}

function visualLibraryResultMarkup(item) {
  const selected =
    mediaLibrarySelected?.id === item.id ||
    mediaLibrarySelected?.url === item.url;
  return `<button type="button" class="media-visual-card ${selected ? "selected" : ""}" data-media-select="${escapeHtml(item.id || item.url)}">
    <span class="media-visual-preview">${mediaPreviewMarkup(item, "media-result-preview")}</span>
    <span class="media-visual-copy"><strong>${escapeHtml(item.name || "Média")}</strong><small>${escapeHtml(item.detail || mediaKindLabel(item.kind))}</small></span>
    <span class="media-visual-meta"><span class="badge cyan">${escapeHtml(mediaKindLabel(item.kind || mediaKindFromUrl(item.url)))}</span><b>${selected ? "✓ Sélectionné" : "Choisir"}</b></span>
  </button>`;
}

function mediaLibraryEmptyMarkup() {
  const isCustom = mediaLibrarySource === "custom";
  return `<div class="media-library-empty">
    <span>◇</span>
    <strong>${isCustom ? "Aucun média personnalisé" : "Aucun résultat"}</strong>
    <p>${isCustom ? "Utilisez le bouton d’import pour envoyer un fichier depuis votre PC vers votre espace Backblaze." : "Essayez une autre recherche ou un autre filtre."}</p>
  </div>`;
}

function findMediaLibraryItem(id) {
  const items =
    mediaLibraryContext?.kind === "sound"
      ? [...SOUND_LIBRARY, ...mediaLibraryRemoteSounds]
      : [...MEDIA_LIBRARY, ...mediaLibraryRemoteMedia];
  return (
    items.find((item) => item.id === id || item.url === id) ||
    mediaSessionEntries.get(id) ||
    null
  );
}

async function loadRemoteMediaLibrary({ append = false } = {}) {
  if (!mediaLibraryContext || mediaLibrarySource !== "web") return;
  const isSound = mediaLibraryContext.kind === "sound";
  const requestSequence = ++mediaLibraryRequestSequence;
  const requestedPage = append ? mediaLibraryRemotePage + 1 : 1;
  mediaLibraryLoading = true;
  if (!append) {
    if (isSound) mediaLibraryRemoteSounds = [];
    else mediaLibraryRemoteMedia = [];
  }
  renderMediaLibrary();
  try {
    const query = mediaLibrarySearchInput.value.trim();
    const result = isSound
      ? await api.searchSounds({
          query,
          page: requestedPage,
          locale: navigator.language || "fr"
        })
      : mediaLibraryKind === "animation"
        ? { media: [], hasMore: false }
        : await api.searchMedia({
            query,
            page: requestedPage,
            kind: mediaLibraryKind
          });
    if (
      requestSequence !== mediaLibraryRequestSequence ||
      mediaLibrarySource !== "web"
    ) {
      return;
    }
    const webAnimations =
      !isSound && requestedPage === 1
        ? MEDIA_LIBRARY.filter(
            (item) =>
              item.source === "tikfinity" &&
              (mediaLibraryKind === "all" ||
                mediaLibraryKind === "animation") &&
              (!normalizeCatalogSearch(query) ||
                normalizeCatalogSearch(
                  `${item.name} ${item.detail}`
                ).includes(normalizeCatalogSearch(query)))
          )
        : [];
    const nextItems = isSound
      ? Array.isArray(result?.sounds)
        ? result.sounds
        : []
      : [
          ...webAnimations,
          ...(Array.isArray(result?.media) ? result.media : [])
        ];
    for (const item of nextItems) {
      mediaSessionEntries.set(item.url, item);
    }
    const existingItems = isSound
      ? mediaLibraryRemoteSounds
      : mediaLibraryRemoteMedia;
    const mergedItems = append
      ? [
          ...existingItems,
          ...nextItems.filter(
            (item) =>
              !existingItems.some(
                (existing) =>
                  existing.id === item.id || existing.url === item.url
              )
          )
        ]
      : nextItems;
    if (isSound) mediaLibraryRemoteSounds = mergedItems;
    else mediaLibraryRemoteMedia = mergedItems;
    mediaLibraryRemotePage = requestedPage;
    mediaLibraryRemoteHasMore = Boolean(
      result?.hasMore &&
        (isSound ? result?.sounds?.length : result?.media?.length)
    );
  } catch (error) {
    if (requestSequence !== mediaLibraryRequestSequence) return;
    mediaLibraryRemoteHasMore = false;
    toast(
      "Catalogue web indisponible",
      error.message || String(error),
      true
    );
  } finally {
    if (requestSequence === mediaLibraryRequestSequence) {
      mediaLibraryLoading = false;
      renderMediaLibrary();
    }
  }
}

function updateMediaLibraryUploadButton({ busy = false } = {}) {
  const isSound = mediaLibraryContext?.kind === "sound";
  mediaLibraryUploadButton.innerHTML = busy
    ? `<span class="media-import-icon">↥</span><span><strong>Envoi vers Backblaze…</strong><small>Veuillez patienter pendant le transfert.</small></span>`
    : `<span class="media-import-icon">＋</span><span><strong>${
        isSound ? "Importer mon propre son" : "Importer mon propre média"
      }</strong><small>Depuis votre PC · stockage personnel Backblaze</small></span>`;
}

function updateCompactMediaPicker(root, item) {
  const valueInput = root?.querySelector("[data-media-value]");
  const nameInput = root?.querySelector("[data-media-name]");
  const selection = root?.querySelector("[data-media-selection]");
  if (!valueInput || !nameInput || !selection) return;
  const kind = root.dataset.pickerKind;
  const optional = root.dataset.pickerOptional === "true";
  valueInput.value = item?.url || "";
  nameInput.value = item?.name || "";
  const previewButton =
    kind === "sound" && item?.url
      ? `<button type="button" class="sound-preview-button" data-media-preview-url="${escapeHtml(item.url)}" title="Écouter">▶</button>`
      : "";
  const clearButton =
    optional && item?.url
      ? '<button type="button" class="button ghost small" data-clear-media>Retirer</button>'
      : "";
  selection.innerHTML = `${
    kind === "sound"
      ? soundSelectionMarkup(item)
      : visualSelectionMarkup(item)
  }
    <div class="compact-media-actions">
      ${previewButton}
      ${clearButton}
      <button type="button" class="button small" data-open-media-library data-kind="${kind === "sound" ? "sound" : "visual"}" data-input="${escapeHtml(valueInput.name)}" data-optional="${optional ? "true" : "false"}">${kind === "sound" ? "Ouvrir la bibliothèque" : "Ouvrir la bibliothèque média"}</button>
    </div>`;
}

function confirmMediaLibrarySelection() {
  if (!mediaLibraryContext || !mediaLibrarySelected) return;
  updateCompactMediaPicker(mediaLibraryContext.root, mediaLibrarySelected);
  mediaLibraryContext = null;
  mediaLibrarySelected = null;
  mediaLibraryDialog.close("selected");
}

function clearMediaPicker(root) {
  updateCompactMediaPicker(root, null);
}

async function uploadMediaFromLibrary() {
  if (!mediaLibraryContext) return;
  const featureId =
    mediaLibraryContext.kind === "sound"
      ? "backblaze.sounds"
      : "backblaze.media";
  if (!canAccessFeature(featureId)) {
    return toast(
      "Import indisponible",
      "Cette bibliothèque personnalisée est masquée par l’administration.",
      true
    );
  }
  mediaLibraryUploadButton.disabled = true;
  updateMediaLibraryUploadButton({ busy: true });
  try {
    const result = await api.uploadCustomMedia(mediaLibraryContext.kind);
    if (result?.canceled) return;
    if (result?.snapshot) acceptSnapshot(result.snapshot);
    const item = result?.media;
    if (!item) throw new Error("Le média importé est introuvable.");
    mediaSessionEntries.set(item.url, item);
    mediaLibrarySelected = item;
    mediaLibrarySource = "custom";
    mediaLibraryKind = "all";
    mediaLibrarySearchInput.value = "";
    renderMediaLibrary();
    toast(
      "Média importé",
      `${item.name} est disponible dans votre bibliothèque Backblaze.`
    );
  } catch (error) {
    toast("Import impossible", error.message || String(error), true);
  } finally {
    mediaLibraryUploadButton.disabled = false;
    updateMediaLibraryUploadButton();
  }
}

const globalMediaLibrary = Object.freeze({
  open: openMediaLibrary,
  close: closeMediaLibrary,
  clear: clearMediaPicker,
  confirm: confirmMediaLibrarySelection,
  refresh: renderMediaLibrary,
  upload: uploadMediaFromLibrary
});
window.ShenPulseMediaLibrary = globalMediaLibrary;

async function refreshSpotifyStatus({ redraw = true } = {}) {
  try {
    spotifyStatus = await api.getSpotifyStatus();
  } catch (error) {
    spotifyStatus = {
      configured: Boolean(snapshot?.state.settings.spotify?.clientId),
      connected: false,
      account: snapshot?.state.settings.spotify?.account || null,
      devices: [],
      message: error.message
    };
  }
  if (redraw && currentPage === "sounds") render();
  return spotifyStatus;
}

function spotifyTrackLabel(track) {
  if (!track) return "";
  const artists = Array.isArray(track.artists) ? track.artists.join(", ") : "";
  return [track.name, artists].filter(Boolean).join(" · ");
}

function visibilityScope(section, id) {
  const storedId = visibilityTools.storageKey(id);
  return siteVisibility?.[section]?.[storedId]?.scope || "public";
}

function canAccessCatalogItem(section, id) {
  return visibilityTools.canAccessScope(
    visibilityScope(section, id),
    isVerifiedAdminSession()
  );
}

function canAccessFeature(id) {
  return canAccessCatalogItem("features", id);
}

function canAccessOverlay(item) {
  return Boolean(item?.key && canAccessCatalogItem("overlays", item.key));
}

function canAccessGame(pack) {
  return Boolean(pack?.id && canAccessCatalogItem("games", pack.id));
}

function minecraftLauncherPack(modePacks) {
  return {
    id: MINECRAFT_LAUNCHER_ID,
    name: "Minecraft",
    publisher: "ShenPulse",
    version: "1.0.0",
    description:
      "Choisissez Bedrock Box ou SandBox, puis configurez les interactions TikTok LIVE propres à ce mode.",
    platform: "Windows",
    tags: ["abonnement requis", "inclus", "2 modes"],
    artwork: "minecraft.webp",
    artworkUrl: "",
    accessMode: "included",
    included: true,
    requiresPro: true,
    price: 0,
    currency: "EUR",
    source: "Minecraft",
    connector: { type: "modes" },
    effects: modePacks.flatMap((pack) => pack.effects || []),
    modes: modePacks,
    modeSelector: true
  };
}

function visibleGamePacks() {
  const visible = (snapshot?.packs || []).filter(canAccessGame);
  const minecraftModes = visible.filter((pack) =>
    MINECRAFT_MODE_IDS.includes(pack.id)
  );
  if (!minecraftModes.length) return visible;
  const firstMinecraftIndex = visible.findIndex((pack) =>
    MINECRAFT_MODE_IDS.includes(pack.id)
  );
  return visible.flatMap((pack, index) => {
    if (!MINECRAFT_MODE_IDS.includes(pack.id)) return [pack];
    if (index !== firstMinecraftIndex) return [];
    return [minecraftLauncherPack(minecraftModes)];
  });
}

const ACTION_FEATURE_REQUIREMENTS = Object.freeze({
  "tts.speak": "tts.voices",
  "spotify.queue": "spotify.playback",
  "obs.request": "obs.websocket",
  "websocket.send": "sources.custom"
});

function canAccessActionType(type) {
  const canonicalType = canonicalActionType(type);
  const featureId = ACTION_FEATURE_REQUIREMENTS[canonicalType];
  return (
    canAccessCatalogItem("actionTypes", canonicalType) &&
    (!featureId || canAccessFeature(featureId))
  );
}

function canAccessPage(page) {
  if (!page?.id || page.hidden?.()) return false;
  if (page.id === "admin") return isVerifiedAdminSession();
  if (page.id === "activity" && !isAccountAuthenticated()) {
    return false;
  }
  return canAccessCatalogItem("navigation", page.id);
}

function isAccountAuthenticated() {
  return accountSession.authenticated === true;
}

function isVerifiedAdminSession() {
  return (
    isAccountAuthenticated() &&
    String(accountSession.email || "").trim().toLowerCase() ===
      ADMIN_OWNER_EMAIL &&
    adminSession.authorized === true &&
    String(adminSession.email || "").trim().toLowerCase() ===
      ADMIN_OWNER_EMAIL &&
    Boolean(accountSession.uid) &&
    accountSession.uid === adminSession.uid
  );
}

function visibleNavigationEntries() {
  const entries = [];
  let pendingSection = null;
  for (const page of pages) {
    if (page.section) {
      pendingSection = page;
      continue;
    }
    if (!canAccessPage(page)) continue;
    if (pendingSection) {
      entries.push(pendingSection);
      pendingSection = null;
    }
    entries.push(page);
  }
  return entries;
}

function firstAccessiblePageId() {
  return (
    pages.find((page) => page.id && page.id !== "admin" && canAccessPage(page))
      ?.id || "dashboard"
  );
}

function ensureCurrentPageAccess() {
  const current = pages.find((page) => page.id === currentPage);
  if (!current || !canAccessPage(current)) {
    currentPage = firstAccessiblePageId();
  }
}

function canNavigateTo(pageId) {
  return canAccessPage(pages.find((page) => page.id === pageId));
}

function renderNavigation() {
  const entries = visibleNavigationEntries();
  const nextStructureSignature = JSON.stringify(
    entries.map((page) =>
      page.section
        ? ["section", page.section]
        : ["page", page.id, page.label]
    )
  );
  if (nextStructureSignature !== navigationStructureSignature) {
    navigation.innerHTML = entries
      .map((page) => {
        if (page.section) return `<div class="nav-section">${escapeHtml(page.section)}</div>`;
        return `
          <button class="nav-item" data-navigate="${page.id}">
            <span class="nav-icon">${navigationIcon(page.id)}</span>
            <span>${escapeHtml(page.label)}</span>
          </button>`;
      })
      .join("");
    navigationStructureSignature = nextStructureSignature;
  }

  const navigationItems = new Map(
    Array.from(navigation.querySelectorAll(".nav-item")).map((item) => [
      item.dataset.navigate,
      item
    ])
  );
  for (const page of entries) {
    if (page.section) continue;
    const item = navigationItems.get(page.id);
    if (!item) continue;
    item.classList.toggle("active", currentPage === page.id);
    const count = page.count?.();
    let countNode = item.querySelector(".nav-count");
    if (count == null) {
      countNode?.remove();
      continue;
    }
    if (!countNode) {
      countNode = document.createElement("span");
      countNode.className = "nav-count";
      item.appendChild(countNode);
    }
    const nextCount = String(count);
    if (countNode.textContent !== nextCount) countNode.textContent = nextCount;
  }
}

function tiktokMeta() {
  const tiktok = snapshot?.state.settings.tiktok || {};
  const connection = snapshot?.state.connections.find(
    (item) => item.id === "source_tiktok"
  );
  const status = tiktok.status || "unconfigured";
  const labels = {
    live: "LIVE détecté",
    offline: "Hors ligne",
    checking: "Détection en cours",
    disconnected: "Détection arrêtée",
    error: "LIVE non détecté",
    unconfigured: tiktok.username ? "Relais requis" : "À configurer"
  };
  return {
    ...tiktok,
    connection,
    status,
    label: labels[status] || status,
    live: status === "live",
    connected: ["connected", "connecting", "reconnecting"].includes(
      connection?.status
    )
  };
}

function activeGameSession() {
  const game = snapshot?.state?.session?.game || {};
  if (!game.running || !game.packId) return null;
  const pack = snapshot.packs.find((entry) => entry.id === game.packId);
  if (!pack) return null;
  return { ...game, pack };
}

function minecraftRoundSettingsFor(packId) {
  const saved =
    snapshot?.state?.game?.roundSettingsByPack?.[packId] || {};
  return {
    durationMinutes: Math.max(
      1,
      Math.min(1440, Math.round(Number(saved.durationMinutes || 10)))
    ),
    autoRestart: saved.autoRestart === true
  };
}

function minecraftRoundRemainingSeconds(gameSession = activeGameSession()) {
  if (
    !gameSession ||
    !MINECRAFT_MODE_IDS.includes(gameSession.packId) ||
    !gameSession.roundEndsAt
  ) {
    return 0;
  }
  return Math.max(
    0,
    Math.ceil(
      (new Date(gameSession.roundEndsAt).getTime() - Date.now()) / 1000
    )
  );
}

function formatCountdown(seconds) {
  const value = Math.max(0, Math.round(Number(seconds || 0)));
  const hours = Math.floor(value / 3600);
  const minutes = Math.floor((value % 3600) / 60);
  const remainingSeconds = value % 60;
  return hours
    ? `${String(hours).padStart(2, "0")}:${String(minutes).padStart(
        2,
        "0"
      )}:${String(remainingSeconds).padStart(2, "0")}`
    : `${String(minutes).padStart(2, "0")}:${String(
        remainingSeconds
      ).padStart(2, "0")}`;
}

function updateMinecraftRoundCountdowns() {
  const gameSession = activeGameSession();
  const remaining = minecraftRoundRemainingSeconds(gameSession);
  document
    .querySelectorAll("[data-minecraft-round-countdown]")
    .forEach((node) => {
      node.textContent =
        gameSession?.roundStatus === "timeout" && !gameSession.roundEndsAt
          ? "TIME OUT"
          : formatCountdown(remaining);
    });
}

function activeGameConflict(pack) {
  const gameSession = activeGameSession();
  if (!gameSession || !pack) return null;
  if (pack.id === gameSession.packId) return null;
  if (
    pack.modeSelector &&
    (pack.modes || []).some((mode) => mode.id === gameSession.packId)
  ) {
    return null;
  }
  return gameSession;
}

function showActiveGameConflict(pack) {
  const gameSession = activeGameConflict(pack);
  if (!gameSession) return false;
  openEditor({
    title: "Un jeu est déjà actif",
    kicker: "CHANGEMENT DE JEU BLOQUÉ",
    variant: "game-session-blocked",
    body: `<div class="game-session-blocked-dialog">
      <span>■</span>
      <div>
        <strong>${escapeHtml(gameSession.pack.name)} est en cours d’exécution</strong>
        <p>Arrêtez d’abord ce jeu avec le bouton Stop de la barre supérieure. Son serveur et son chrono seront coupés proprement avant que vous puissiez ouvrir ${escapeHtml(pack.name)}.</p>
      </div>
    </div>`,
    onSubmit: null
  });
  return true;
}

function visibleAccountSession() {
  return accountSession;
}

function accountInitials(session = visibleAccountSession()) {
  const source = String(
    session.displayName || session.email?.split("@")[0] || "SP"
  ).trim();
  const words = source
    .split(/[\s._-]+/)
    .map((word) => word.trim())
    .filter(Boolean);
  return (
    (words.length > 1
      ? `${words[0][0]}${words[1][0]}`
      : source.slice(0, 2)) || "SP"
  ).toLocaleUpperCase("fr");
}

function accountDisplayName(session = visibleAccountSession()) {
  if (!session.authenticated) return "Aucun compte";
  return (
    session.displayName ||
    String(session.email || "").split("@")[0] ||
    "Compte ShenPulse"
  );
}

function signedOutAccountSession() {
  return {
    authenticated: false,
    email: "",
    uid: "",
    displayName: "",
    photoUrl: "",
    providerId: "",
    emailVerified: false,
    lastAuthenticatedAt: "",
    offline: false
  };
}

async function waitForPendingAccountLogout() {
  const logoutPromise = pendingAccountLogoutPromise;
  if (logoutPromise) await logoutPromise;
}

function syncAccountChrome() {
  const visibleSession = visibleAccountSession();
  const authenticated = visibleSession.authenticated === true;
  const displayName = accountDisplayName(visibleSession);
  const email = authenticated
    ? visibleSession.email
    : "Se connecter à ShenPulse";
  const initials = accountInitials(visibleSession);
  accountAvatar.textContent = initials;
  accountMenuAvatar.textContent = initials;
  accountName.textContent = displayName;
  accountName.title = authenticated
    ? visibleSession.email
    : "Aucun compte ShenPulse connecté";
  accountEmail.textContent = email;
  accountEmail.title = email;
  accountMenuName.textContent = displayName;
  accountMenuEmail.textContent = authenticated
    ? `${visibleSession.email}${
        visibleSession.offline ? " · Hors ligne" : ""
      }`
    : "Connectez votre compte pour synchroniser vos accès.";
  accountMenu
    .querySelector(".account-login-action")
    ?.toggleAttribute("hidden", authenticated);
  accountMenu
    .querySelector(".account-logout-action")
    ?.toggleAttribute("hidden", !authenticated);
  accountAuthCta.hidden = authenticated;
  profileControl.hidden = !authenticated;
  tiktokControl.hidden = !authenticated;
  sessionButton.hidden = !authenticated;
}

function syncChrome() {
  ensureCurrentPageAccess();
  const page =
    pages.find((item) => item.id === currentPage) ||
    pages.find((item) => item.id === firstAccessiblePageId()) ||
    pages[1];
  pageTitle.textContent = page.title;
  pageKicker.textContent = page.kicker;
  const state = snapshot?.state;
  if (!state) return;
  syncAccountChrome();
  const activeProfile = state.profiles.find(
    (profile) => profile.id === state.session.profileId
  ) || state.profiles[0];
  profileCurrentName.textContent = activeProfile?.name || "Profil actif";
  const nextProfileChromeSignature = JSON.stringify(
    state.profiles.map((profile) => [
      profile.id,
      profile.name,
      profile.description || "",
      profile.workspace?.rules?.length || 0,
      profile.id === state.session.profileId
    ])
  );
  if (nextProfileChromeSignature !== profileChromeSignature) {
    const menuWasOpen = !profileMenu.hidden;
    profileSelect.innerHTML = state.profiles
      .map((profile) => `<option value="${escapeHtml(profile.id)}" ${profile.id === state.session.profileId ? "selected" : ""}>${escapeHtml(profile.name)}</option>`)
      .join("");
    profileMenu.innerHTML = state.profiles.map((profile) => {
      const active = profile.id === state.session.profileId;
      const ruleCount = profile.workspace?.rules?.length || 0;
      return `<button type="button" class="profile-menu-item ${active ? "active" : ""}" data-profile-select="${escapeHtml(profile.id)}" role="option" aria-selected="${active}">
        <span class="profile-menu-avatar">${escapeHtml(profile.name.slice(0, 2).toUpperCase())}</span>
        <span class="profile-menu-copy">
          <strong>${escapeHtml(profile.name)}</strong>
          <small>${escapeHtml(profile.description || `${ruleCount} règle${ruleCount > 1 ? "s" : ""} configurée${ruleCount > 1 ? "s" : ""}`)}</small>
        </span>
        ${active ? '<span class="profile-menu-active">ACTIF</span>' : ""}
      </button>`;
    }).join("");
    profileMenu.hidden = !menuWasOpen;
    profilePickerButton.setAttribute("aria-expanded", String(menuWasOpen));
    profileChromeSignature = nextProfileChromeSignature;
  }
  const gameSession = activeGameSession();
  gameSessionControl.hidden = !gameSession;
  if (gameSession) {
    gameSessionLabel.textContent = MINECRAFT_MODE_IDS.includes(
      gameSession.packId
    )
      ? `${gameSession.pack.name} · ${
          gameSession.roundStatus === "timeout" && !gameSession.roundEndsAt
            ? "TIME OUT"
            : `${formatCountdown(
                minecraftRoundRemainingSeconds(gameSession)
              )} restant`
        }`
      : `${gameSession.pack.name} · ${formatDuration(
          gameSession.startedAt
        )}`;
    gameSessionSummary.title = `Revenir à ${gameSession.pack.name}`;
  }
  sessionButton.classList.toggle("running", state.session.running);
  sessionLabel.textContent = state.session.running ? `LIVE · ${formatDuration(state.session.startedAt)}` : "Démarrer le live";
  const tiktok = tiktokMeta();
  tiktokAccountLabel.textContent = tiktok.username
    ? `@${tiktok.username}`
    : "@ TikTok";
  tiktokStatusLabel.textContent = tiktok.label;
  tiktokStatusDot.className = `tiktok-status-dot status-${tiktok.status}`;
  tiktokConnectionButton.classList.toggle("connected", tiktok.connected);
  tiktokConnectionButton.disabled = !tiktok.username;
  tiktokConnectionButton.textContent = tiktok.connected ? "■" : "↻";
  tiktokConnectionButton.title = tiktok.connected
    ? "Arrêter la détection TikTok LIVE"
    : "Détecter automatiquement si le compte TikTok est en LIVE";
  const serverDot = document.getElementById("server-dot");
  const serverDetail = document.getElementById("server-detail");
  const urlsReady = Boolean(snapshot.overlayUrls?.base);
  serverDot.classList.toggle("error", !urlsReady);
  serverDetail.textContent = urlsReady ? `API : ${state.settings.apiPort} · Overlay : ${state.settings.overlayPort}` : "Serveurs indisponibles";
}

function render() {
  if (!snapshot) return;
  const adminScrollState = captureAdminScrollState();
  ensureCurrentPageAccess();
  renderNavigation();
  syncChrome();
  const renderers = {
    dashboard: renderDashboard,
    live: renderLive,
    actions: renderActions,
    rules: renderRules,
    overlays: renderOverlaysV2,
    sounds: renderSounds,
    games: renderGamesV2,
    goals: renderGoals,
    commands: renderCommands,
    membership: renderMembership,
    connections: renderConnections,
    activity: renderActivity,
    settings: renderSettings,
    admin: renderAdmin
  };
  const pageMarkup = (renderers[currentPage] || renderDashboard)();
  const nextContentMarkup = isAccountAuthenticated()
    ? pageMarkup
    : `${renderGuestAccessNotice()}${pageMarkup}`;
  if (
    renderedContentPage === currentPage &&
    renderedContentMarkup === nextContentMarkup
  ) {
    applyGuestReadOnlyMode(content);
    return;
  }
  content.innerHTML = nextContentMarkup;
  renderedContentPage = currentPage;
  renderedContentMarkup = nextContentMarkup;
  bindOverlayRuntimeFrames(content);
  applyGuestReadOnlyMode(content);
  restoreAdminScrollState(adminScrollState);
}

const GUEST_BROWSING_ACTIONS = new Set([
  "account-login",
  "close-game",
  "dismiss-game-message",
  "dismiss-game-progress",
  "filter-enabled-actions",
  "select-simulator-type",
  "set-actions-section",
  "set-game-effect-category",
  "set-game-filter",
  "set-overlay-category",
  "set-sound-category",
  "preview-overlay"
]);

function renderGuestAccessNotice() {
  if (currentPage === "activity") return "";
  return `<aside class="guest-access-notice">
    <span aria-hidden="true">SP</span>
    <div>
      <strong>Mode consultation</strong>
      <p>Connectez-vous pour afficher vos données locales, vos sources et vos URL, puis pour modifier ou lancer une configuration.</p>
    </div>
    <button class="button primary" type="button" data-action="account-login">Se connecter ou s’inscrire</button>
  </aside>`;
}

function applyGuestReadOnlyMode(root) {
  if (!root) return;
  if (isAccountAuthenticated()) {
    root
      .querySelectorAll('[data-guest-locked="true"]')
      .forEach((control) => {
        if ("disabled" in control) {
          control.disabled = control.dataset.guestWasDisabled === "true";
        }
        if (control.dataset.guestHadAriaDisabled === "true") {
          control.setAttribute(
            "aria-disabled",
            control.dataset.guestPreviousAriaDisabled || "false"
          );
        } else {
          control.removeAttribute("aria-disabled");
        }
        if (control.dataset.guestHadTitle === "true") {
          control.title = control.dataset.guestPreviousTitle || "";
        } else {
          control.removeAttribute("title");
        }
        delete control.dataset.guestLocked;
        delete control.dataset.guestWasDisabled;
        delete control.dataset.guestHadAriaDisabled;
        delete control.dataset.guestPreviousAriaDisabled;
        delete control.dataset.guestHadTitle;
        delete control.dataset.guestPreviousTitle;
      });
    return;
  }
  const lockControl = (control, message) => {
    if (control.dataset.guestLocked !== "true") {
      control.dataset.guestWasDisabled = String(
        "disabled" in control && control.disabled
      );
      control.dataset.guestHadAriaDisabled = String(
        control.hasAttribute("aria-disabled")
      );
      control.dataset.guestPreviousAriaDisabled =
        control.getAttribute("aria-disabled") || "";
      control.dataset.guestHadTitle = String(control.hasAttribute("title"));
      control.dataset.guestPreviousTitle = control.getAttribute("title") || "";
    }
    control.dataset.guestLocked = "true";
    control.setAttribute("aria-disabled", "true");
    control.title = message;
    if ("disabled" in control) control.disabled = true;
  };
  root
    .querySelectorAll("input, select, textarea")
    .forEach((control) => {
      const browsingControl =
        control.matches("[data-search]") ||
        control.matches('[data-action="filter-enabled-actions"]') ||
        control.matches("[data-overlay-design]");
      if (!browsingControl) {
        lockControl(
          control,
          "Connectez-vous à ShenPulse pour modifier ce réglage."
        );
      }
    });
  root.querySelectorAll("button, [data-action]").forEach((control) => {
    const action = control.dataset.action || "";
    const browsingControl =
      control.hasAttribute("data-navigate") ||
      GUEST_BROWSING_ACTIONS.has(action);
    if (browsingControl) return;
    lockControl(
      control,
      "Connectez-vous à ShenPulse pour utiliser cette fonction."
    );
  });
}

function requireAccountForAction(action) {
  if (
    isAccountAuthenticated() ||
    GUEST_BROWSING_ACTIONS.has(action)
  ) {
    return false;
  }
  toast(
    "Connexion requise",
    "Connectez-vous à votre compte ShenPulse pour utiliser cette fonction.",
    true
  );
  openAccountLogin();
  return true;
}

function captureAdminScrollState() {
  if (currentPage !== "admin" || !content.querySelector(".admin-page")) {
    return null;
  }
  return {
    contentTop: content.scrollTop,
    regions: Array.from(content.querySelectorAll("[data-admin-scroll]")).map(
      (element) => ({
        key: element.dataset.adminScroll,
        top: element.scrollTop,
        left: element.scrollLeft
      })
    )
  };
}

function restoreAdminScrollState(scrollState) {
  if (!scrollState || currentPage !== "admin") return;
  content.scrollTop = scrollState.contentTop;
  for (const region of scrollState.regions) {
    const element = Array.from(
      content.querySelectorAll("[data-admin-scroll]")
    ).find((candidate) => candidate.dataset.adminScroll === region.key);
    if (!element) continue;
    element.scrollTop = region.top;
    element.scrollLeft = region.left;
  }
}

function renderDashboard() {
  if (!isAccountAuthenticated()) {
    return `
      <div class="page-grid guest-dashboard">
        <section class="card accent session-hero">
          <div class="session-copy">
            <p class="eyebrow">DÉCOUVRIR SHENPULSE</p>
            <h2>Parcourez les outils avant de connecter votre compte.</h2>
            <p>Les données d’activité, les sources, les URL et les réglages enregistrés sur cet appareil restent protégés pendant la consultation.</p>
            <div class="button-row">
              <button class="button primary" data-action="account-login">Se connecter ou s’inscrire</button>
              <button class="button ghost" data-navigate="overlays">Voir les overlays</button>
              <button class="button ghost" data-navigate="games">Voir les jeux</button>
            </div>
          </div>
          <div class="pulse-visual">
            <div class="pulse-ring"></div>
            <div class="pulse-ring"></div>
            <div class="pulse-core">SP</div>
          </div>
        </section>
      </div>`;
  }
  const { state } = snapshot;
  const stats = state.statistics;
  const connected = state.connections.filter((item) => item.status === "connected").length;
  const recent = state.activity.slice(0, 6);
  return `
    <div class="page-grid">
      <section class="stats-grid">
        ${statCard("Événements", stats.sessionEvents, "⌁", "var(--cyan)", "cette session")}
        ${statCard("Actions exécutées", stats.sessionActions, "⎇", "var(--violet)", "cette session")}
        ${statCard("Likes reçus", stats.sessionLikes || 0, "♥", "var(--red)", "cette session")}
        ${statCard("Audience unique", stats.sessionUniqueViewers?.length || 0, "◉", "var(--green)", "cette session")}
      </section>
      <section class="hero-grid">
        <article class="card accent session-hero">
          <div class="session-copy">
            <p class="eyebrow">${state.session.running ? "SESSION EN COURS" : "PRÊT À INTERAGIR"}</p>
            <h2>${state.session.running ? "Votre communauté pilote maintenant le show." : "Transformez chaque réaction en moment de jeu."}</h2>
            <p>${state.session.running ? `${connected} source(s) connectée(s), ${stats.sessionEvents} événement(s) traités. Les règles actives continuent de s’exécuter localement.` : "Connectez une source autorisée, choisissez un pack de jeu et laissez le moteur ShenPulse orchestrer alertes, overlays et effets en temps réel."}</p>
            <div class="button-row">
              <button class="button primary" data-action="toggle-session">${state.session.running ? "■ Arrêter la session" : "▶ Démarrer la session"}</button>
              <button class="button" data-action="test-event" data-type="gift">🎁 Tester un cadeau</button>
              ${canNavigateTo("connections") ? '<button class="button ghost" data-navigate="connections">Configurer les sources →</button>' : ""}
            </div>
          </div>
          <div class="pulse-visual">
            <div class="pulse-ring"></div>
            <div class="pulse-ring"></div>
            <div class="pulse-core">${state.session.running ? "◉" : "⌁"}</div>
          </div>
        </article>
        <article class="card">
          <header class="card-header"><div><p class="eyebrow">SOURCES</p><h3>État des connexions</h3></div><span class="badge ${connected ? "success" : ""}">${connected} ACTIVE${connected > 1 ? "S" : ""}</span></header>
          <div class="card-body list">
            ${state.connections.slice(0, 4).map(connectionRow).join("")}
          </div>
        </article>
      </section>
      <section class="card">
        <header class="card-header"><div><p class="eyebrow">ACTIVITÉ RÉCENTE</p><h3>Tout ce qui traverse ShenPulse</h3></div><button class="button small ghost" data-navigate="activity">Ouvrir le journal</button></header>
        <div class="card-body list">
          ${recent.length ? recent.map(activityRow).join("") : emptyInline("Aucune activité pour le moment.")}
        </div>
      </section>
    </div>`;
}

function statCard(label, value, icon, glow, detail) {
  return `<article class="card stat-card" style="--glow:${glow}">
    <div class="stat-top"><span class="stat-icon">${icon}</span><span class="stat-change">${escapeHtml(detail)}</span></div>
    <div class="stat-value">${asNumber(value)}</div><div class="stat-label">${escapeHtml(label)}</div>
  </article>`;
}

function connectionRow(connection) {
  const statusClass = connection.status === "connected" ? "success" : connection.status === "error" ? "error" : "";
  return `<div class="list-row">
    <span class="connector-icon">${connection.type === "demo" ? "◈" : connection.type === "twitch-irc" ? "T" : "⌁"}</span>
    <div><h4>${escapeHtml(connection.name)}</h4><p>${escapeHtml(connection.type)}${connection.error ? ` · ${escapeHtml(connection.error)}` : ""}</p></div>
    <span class="badge ${statusClass}">${escapeHtml(connection.status || "disconnected")}</span>
  </div>`;
}

function activityRow(entry) {
  const icon = eventIcons[entry.category] || (entry.level === "error" ? "!" : "•");
  return `<div class="list-row">
    <span class="event-icon">${icon}</span>
    <div><h4>${escapeHtml(entry.title)}</h4><p>${escapeHtml(entry.detail || entry.category)}</p></div>
    <span class="event-time">${formatTime(entry.timestamp)}</span>
  </div>`;
}

function emptyInline(message) {
  return `<div class="empty-state" style="min-height:130px"><div><span class="empty-icon">⌁</span><p>${escapeHtml(message)}</p></div></div>`;
}

function renderLive() {
  if (!isAccountAuthenticated()) {
    return renderPrivateDataPlaceholder(
      "Session en direct protégée",
      "Connectez-vous pour voir les événements reçus, les statistiques de session et les sources actives."
    );
  }
  const state = snapshot.state;
  return `
    <div class="page-grid">
      <div class="section-toolbar">
        <div><h2>Flux temps réel</h2><p>Les derniers événements normalisés par le moteur.</p></div>
        <div class="toolbar-actions">
          <button class="button" data-action="test-event" data-type="chat">Tester le chat</button>
          <button class="button" data-action="test-event" data-type="follow">Tester un follow</button>
          <button class="button primary" data-action="test-event" data-type="gift">Tester un cadeau</button>
        </div>
      </div>
      <section class="stats-grid">
        ${statCard("Durée", formatDuration(state.session.startedAt), "◷", "var(--cyan)", state.session.running ? "LIVE" : "hors ligne")}
        ${statCard("Événements", state.statistics.sessionEvents, "⌁", "var(--violet)", "session")}
        ${statCard("Actions", state.statistics.sessionActions, "⎇", "var(--green)", "exécutées")}
        ${statCard("Sources actives", state.connections.filter((item) => item.status === "connected").length, "◉", "var(--amber)", "connectées")}
      </section>
      <section class="card">
        <header class="card-header"><div><p class="eyebrow">LIVE FEED</p><h3>Événements entrants</h3></div><span class="badge ${state.session.running ? "success" : ""}">${state.session.running ? "ÉCOUTE ACTIVE" : "EN PAUSE"}</span></header>
        <div class="card-body list">
          ${liveEvents.length ? liveEvents.map(liveEventRow).join("") : emptyInline("Démarrez la session ou envoyez un événement de test.")}
        </div>
      </section>
    </div>`;
}

function liveEventRow(event) {
  const detail = event.type === "chat" ? event.data.message : event.type === "gift" ? `${event.data.giftName} ×${event.data.count}` : event.type;
  return `<div class="list-row">
    <span class="event-icon">${eventIconMarkup(event.type, {
      giftName: event.data?.giftName
    })}</span>
    <div><h4>${escapeHtml(event.user?.displayName || "Viewer")}</h4><p>${escapeHtml(detail)} · ${escapeHtml(event.source)}</p></div>
    <span class="event-time">${formatTime(event.timestamp)}</span>
  </div>`;
}

function flattenActions() {
  if (!snapshot?.state?.rules) return [];
  return snapshot.state.rules.flatMap((rule) =>
    (rule.actions || []).map((action, actionIndex) => ({
      rule,
      action,
      actionIndex
    }))
  );
}

function soundActionRows() {
  return flattenActions().filter(({ action }) =>
    canAccessActionType(action.type) &&
    ["audio.play", "tts.speak"].includes(action.type)
  );
}

function scheduledTimers() {
  return Array.isArray(snapshot?.state?.timers) ? snapshot.state.timers : [];
}

function actionTypeLabel(type) {
  const canonicalType = canonicalActionType(type);
  return ACTION_TYPE_LABELS[canonicalType] || canonicalType || "Action";
}

function actionTypeOptionLabel(type) {
  const canonicalType = canonicalActionType(type);
  const icon = ACTION_TYPE_ICONS[canonicalType] || "◆";
  return `${icon}\u00A0\u00A0${actionTypeLabel(canonicalType)}`;
}

function canonicalActionType(type) {
  return type === "overlay.alert" ? "overlay.media" : type;
}

function triggerLabel(rule) {
  if (!hasAutomaticTrigger(rule)) return "Lancement manuel";
  const trigger = rule.trigger || {};
  const threshold = Number(trigger.threshold || 1);
  const type = trigger.type || "*";
  const giftName = type === "gift" ? ruleGiftName(rule) : "";
  return `${EVENT_LABELS[type] || type}${giftName ? ` · ${giftName}` : ""}${threshold > 1 ? ` ×${threshold}` : ""}`;
}

function soundLibraryEntry(url) {
  return (
    SOUND_LIBRARY.find((item) => item.url === url) ||
    mediaSessionEntries.get(url) ||
    null
  );
}

function actionDescription(action) {
  const config = action.config || {};
  if (
    !isAccountAuthenticated() &&
    Object.entries(config).some(
      ([key, value]) =>
        /(?:url|uri)$/i.test(key) &&
        String(value || "").trim()
    )
  ) {
    return "Détail protégé · connexion requise";
  }
  switch (action.type) {
    case "overlay.alert":
      return config.title || config.message || "Affichage dans l’overlay";
    case "overlay.media":
      return (
        mediaLibraryEntry(config.mediaUrl)?.name ||
        config.mediaName ||
        config.mediaUrl ||
        "Média à choisir"
      );
    case "tts.speak":
      return config.text || "Texte lu à voix haute";
    case "audio.play":
      return (
        soundLibraryEntry(config.url)?.name ||
        config.soundName ||
        config.url ||
        "Son local"
      );
    case "goal.add":
      return `${config.goalId || "objectif"} +${config.amount || 1}`;
    case "timer.add":
      return `${timerOperationLabel(config.operation)} · ${config.seconds || 0}s · ${config.label || "Minuteur"}`;
    case "wheel.spin":
      return Array.isArray(config.choices) ? config.choices.join(", ") : "Roue";
    case "game.effect":
      return config.effectId || "Effet du pack actif";
    case "delay":
      return `${config.durationMs || 0} ms`;
    default:
      return config.url || config.operation || config.requestType || "Configuration avancée";
  }
}

function findActionRow(ruleId, actionId, actionIndex) {
  return flattenActions().find(
    (row) =>
      row.rule.id === ruleId &&
      (actionId ? row.action.id === actionId : row.actionIndex === Number(actionIndex))
  );
}

function renderMediaScreensPanel(rows) {
  if (!isAccountAuthenticated()) {
    return `<section class="studio-panel panel-cyan media-screens-panel guest-media-screens">
      <header class="studio-panel-heading">
        <div><span class="panel-accent"></span><div><h3>Écrans Media</h3><p>Les URL de vos sources navigateur sont protégées.</p></div></div>
        <span class="badge">CONNEXION REQUISE</span>
      </header>
      <div class="media-screens-intro">
        <strong>Connectez-vous pour préparer vos écrans Media</strong>
        <p>Aucune URL locale ou publique n’est affichée et aucune copie n’est possible en mode consultation.</p>
      </div>
    </section>`;
  }
  const urls = Array.isArray(snapshot.overlayUrls?.mediaScreens)
    ? snapshot.overlayUrls.mediaScreens
    : [];
  const usage = Array.from({ length: 8 }, () => 0);
  for (const { action } of rows) {
    if (canonicalActionType(action.type) !== "overlay.media") continue;
    const screen = Math.min(
      8,
      Math.max(1, Math.round(Number(action.config?.screen) || 1))
    );
    usage[screen - 1] += 1;
  }
  return `<section class="studio-panel panel-cyan media-screens-panel">
    <header class="studio-panel-heading">
      <div><span class="panel-accent"></span><div><h3>Écrans Media</h3><p>Une source navigateur indépendante par écran, avec sa propre file d’attente.</p></div></div>
      <span class="badge cyan">TIKTOK LIVE STUDIO · OBS</span>
    </header>
    <div class="media-screens-intro">
      <strong>Affichez vos médias dans le logiciel de LIVE</strong>
      <p>Copiez cette URL HTTPS dans TikTok LIVE Studio ou OBS en 1920 × 1080, puis choisissez le même écran dans la configuration de l’action Media.</p>
    </div>
    <div class="media-screens-table-wrap">
      <table class="media-screens-table">
        <thead><tr><th>ÉCRAN</th><th>URL DE LA SOURCE NAVIGATEUR</th><th>ACTIONS LIÉES</th><th>ÉTAT</th><th></th></tr></thead>
        <tbody>
          ${Array.from({ length: 8 }, (_value, index) => {
            const screen = index + 1;
            const url = urls[index] || "";
            const actionCount = usage[index];
            return `<tr>
              <td><strong>Écran ${screen}</strong></td>
              <td><code title="${escapeHtml(url)}">${escapeHtml(url || "Serveur d’overlay indisponible")}</code></td>
              <td><span class="media-screen-count">${actionCount} action${actionCount > 1 ? "s" : ""}</span></td>
              <td><span class="media-screen-status ${url ? "ready" : "offline"}"><i></i>${url ? "Prêt" : "Hors ligne"}</span></td>
              <td><button class="button small ${url ? "primary" : ""}" data-action="copy" data-value="${escapeHtml(url)}" ${url ? "" : "disabled"}>Copier</button></td>
            </tr>`;
          }).join("")}
        </tbody>
      </table>
    </div>
  </section>`;
}

function renderActions() {
  const rows = flattenActions().filter(
    ({ action }) =>
      !["audio.play", "tts.speak"].includes(action.type) &&
      canAccessActionType(action.type)
  );
  const query = actionsSearch.trim().toLowerCase();
  const filteredRows = rows.filter(({ rule, action }) => {
    if (onlyEnabledActions && !rule.enabled) return false;
    return !query || [
      rule.name,
      actionTypeLabel(action.type),
      triggerLabel(rule),
      actionDescription(action)
    ].join(" ").toLowerCase().includes(query);
  });
  const tabs = [
    ["actions", "Actions", rows.length],
    ["timers", "Timers", scheduledTimers().length],
    ["simulator", "Simulateur", 8]
  ];
  return `
    <div class="reference-page actions-workspace">
      <section class="page-hero compact">
        <div>
          <span class="hero-chip">WORKFLOW SHENPULSE</span>
          <h2>Actions & déclencheurs</h2>
          <p>Configurez ce que ShenPulse doit faire et, directement dans chaque action, l’événement qui doit la lancer.</p>
        </div>
      </section>
      <nav class="module-tabs" aria-label="Sections des actions">
        ${tabs.map(([id, label, count]) => `<button class="${actionsSection === id ? "active" : ""}" data-action="set-actions-section" data-value="${id}">${label}<span>${count}</span></button>`).join("")}
      </nav>
      ${actionsSection === "actions" ? `
        <section class="studio-panel panel-violet">
          <header class="studio-panel-heading">
            <div><span class="panel-accent"></span><div><h3>Actions</h3><p>Médias, overlays, intégrations et commandes de jeu exécutés par le moteur local.</p></div></div>
            <span class="count-pill">${filteredRows.length}</span>
          </header>
          <div class="catalog-toolbar">
            <button class="button primary" data-action="add-action">＋ Créer une action</button>
            <label class="filter-check"><input type="checkbox" data-action="filter-enabled-actions" ${onlyEnabledActions ? "checked" : ""}><span>Actives uniquement</span></label>
            <label class="search-control"><span>⌕</span><input data-search="actions" type="search" value="${escapeHtml(actionsSearch)}" placeholder="Rechercher une action, un déclencheur…"></label>
          </div>
          <div class="data-table-wrap">
            <table class="data-table actions-data-table">
              <thead><tr><th>OUTILS</th><th>ACTIF</th><th>NOM</th><th>TYPE</th><th>DÉCLENCHEUR</th><th>DÉTAIL</th><th>COOLDOWN</th></tr></thead>
              <tbody>
                ${filteredRows.length ? filteredRows.map(({ rule, action, actionIndex }) => `
                  <tr>
                    <td class="table-tools">
                      <button title="Tester" data-action="test-action" data-rule="${escapeHtml(rule.id)}" data-id="${escapeHtml(action.id || "")}" data-index="${actionIndex}">▶</button>
                      <button title="Modifier" data-action="edit-action" data-rule="${escapeHtml(rule.id)}" data-id="${escapeHtml(action.id || "")}" data-index="${actionIndex}">✎</button>
                      <button title="Dupliquer" data-action="duplicate-action" data-rule="${escapeHtml(rule.id)}" data-id="${escapeHtml(action.id || "")}" data-index="${actionIndex}">⧉</button>
                      <button title="Supprimer" data-action="delete-action" data-rule="${escapeHtml(rule.id)}" data-id="${escapeHtml(action.id || "")}" data-index="${actionIndex}">×</button>
                    </td>
                    <td><label class="switch"><input type="checkbox" data-action="toggle-rule" data-id="${escapeHtml(rule.id)}" ${rule.enabled ? "checked" : ""}><span></span></label></td>
                    <td><strong>${escapeHtml(rule.name)}</strong></td>
                    <td><span class="type-pill">${escapeHtml(actionTypeLabel(action.type))}</span></td>
                    <td>${triggerPill(rule)}</td>
                    <td title="${escapeHtml(actionDescription(action))}">${escapeHtml(actionDescription(action))}</td>
                    <td>${Math.round(Number(rule.cooldown?.globalMs || 0) / 1000)}s</td>
                  </tr>`).join("") : `<tr><td colspan="7">${emptyInline("Aucune action ne correspond à cette recherche.")}</td></tr>`}
              </tbody>
            </table>
          </div>
        </section>
        ${renderMediaScreensPanel(rows)}` : ""}
      ${actionsSection === "simulator" ? `
        <section class="studio-panel panel-pink">
          <header class="studio-panel-heading"><div><span class="panel-accent"></span><div><h3>Simulateur</h3><p>Injectez des déclencheurs de test dans le même pipeline que le live.</p></div></div><span class="badge success">LOCAL</span></header>
          <div class="simulator-grid">
            ${["gift","like","follow","chat","share","subscribe","join"].map((type) => `<button class="simulator-card ${simulatorType === type ? "active" : ""}" data-action="select-simulator-type" data-type="${type}">${eventIconMarkup(type)}<strong>${escapeHtml(EVENT_LABELS[type] || type)}</strong><small>${simulatorType === type ? "Sélectionné" : "Choisir"}</small></button>`).join("")}
          </div>
          <form id="simulator-form" class="simulator-form">
            <input type="hidden" name="type" value="${escapeHtml(simulatorType)}">
            <div>
              <label class="field"><span>@ du viewer test</span><input name="username" value="test_viewer" required></label>
              <label class="field"><span>Nom affiché</span><input name="nickname" value="Spectateur test" required></label>
              <label class="field"><span>Quantité / likes</span><input name="count" type="number" min="1" value="${simulatorType === "like" ? 25 : 5}"></label>
              <label class="field"><span>Valeur</span><input name="value" type="number" min="0" value="5"></label>
              ${giftPickerField("giftName", "Cadeau", "Rose", simulatorType === "gift" ? "" : "disabled")}
              <label class="field"><span>Message</span><input name="message" value="!help" ${simulatorType === "chat" ? "" : "disabled"}></label>
            </div>
            <div class="simulator-submit">
              <span>Compte cible : <strong>${snapshot.state.settings.tiktok?.username ? `@${escapeHtml(snapshot.state.settings.tiktok.username)}` : "non configuré"}</strong></span>
              <button class="button primary" type="submit">▶ Simuler le déclencheur ${escapeHtml(simulatorType)}</button>
            </div>
          </form>
          <div class="simulator-presets">
            <button class="button" data-action="preview-overlay" data-id="timer">＋ 30 secondes</button>
            <button class="button" data-action="preview-overlay" data-id="wheel">Lancer la roue</button>
            <button class="button" data-action="preview-sound" data-id="kenney:confirmation_001">Tester un son</button>
          </div>
        </section>` : ""}
      ${actionsSection === "timers" ? renderTimersPanel() : ""}
    </div>`;
}

function renderRules() {
  const rules = snapshot.state.rules;
  return `
    <div class="section-toolbar">
      <div><h2>${rules.length} automatisation${rules.length > 1 ? "s" : ""}</h2><p>Déclencheurs, conditions, cooldowns et actions chaînées.</p></div>
      <button class="button primary" data-action="add-rule">＋ Nouvelle règle</button>
    </div>
    <div class="rules-grid">
      ${rules.map((rule) => `
        <article class="card entity-card">
          <div class="entity-top">
            <div><h3>${escapeHtml(rule.name)}</h3><p>${escapeHtml(rule.actions?.length || 0)} action(s) · priorité ${escapeHtml(rule.priority || 0)}</p></div>
            <label class="switch"><input type="checkbox" data-action="toggle-rule" data-id="${escapeHtml(rule.id)}" ${rule.enabled ? "checked" : ""}><span></span></label>
          </div>
          <div class="entity-meta">
            <span class="badge cyan">${escapeHtml(rule.trigger?.type || "*")}</span>
            <span class="badge">SEUIL ${escapeHtml(rule.trigger?.threshold || 1)}</span>
            <span class="badge">CD ${Math.round(Number(rule.cooldown?.globalMs || 0) / 1000)}s</span>
          </div>
          <div class="entity-actions">
            <button class="button small" data-action="edit-rule" data-id="${escapeHtml(rule.id)}">Modifier</button>
            <button class="button small" data-action="run-rule" data-id="${escapeHtml(rule.id)}">Tester</button>
            <button class="button small ghost" data-action="delete-entity" data-collection="rules" data-id="${escapeHtml(rule.id)}">Supprimer</button>
          </div>
        </article>`).join("")}
    </div>`;
}

function overlayDefinitions() {
  const urls = snapshot.overlayUrls || {};
  return [
    {
      key: "myActions",
      name: "My Actions",
      description: "File visuelle des actions lancées par les déclencheurs, sons, commandes et timers.",
      category: "actions",
      icon: "⚡",
      url: urls.myActions,
      sourceSize: [720, 520]
    },
    {
      key: "game",
      name: "Interactions en jeu",
      description: "Affiche clairement l’interaction déclenchée et le viewer à son origine.",
      category: "interactions",
      icon: "◇",
      url: urls.game,
      previewView: "game",
      previewKind: "game",
      catalogHidden: true,
      requiresPro: true
    },
    {
      key: "likeGoal",
      name: "Like Goal",
      description: "Objectif de likes avec le cadre mystique et les 14 thèmes de ShenazenOverlay.",
      category: "counters",
      icon: "♥",
      url: urls.likeGoal,
      parameter: "theme",
      options: OVERLAY_THEMES,
      defaultOption: "classic",
      previewKind: "like-goal",
      sourceSize: [1300, 200]
    },
    {
      key: "topDonors",
      name: "Classement donateurs",
      description: "Top des viewers par pièces envoyées, avec 14 thèmes et badges de rang.",
      category: "rankings",
      icon: "♛",
      url: urls.topDonors,
      parameter: "theme",
      options: OVERLAY_THEMES,
      defaultOption: "classic",
      previewKind: "leaderboard",
      sourceSize: [520, 640]
    },
    {
      key: "topTappers",
      name: "Classement tapoteurs",
      description: "Top des viewers par likes, avec 14 thèmes et mise à jour en direct.",
      category: "rankings",
      icon: "★",
      url: urls.topTappers,
      parameter: "theme",
      options: OVERLAY_THEMES,
      defaultOption: "classic",
      previewKind: "leaderboard",
      sourceSize: [520, 640]
    },
    {
      key: "coinJar",
      name: "Coin Jar",
      description: "Coin Jar réel de ShenazenOverlay : aucun faux point ni fausse pièce ne s’affiche au repos.",
      category: "gifts",
      icon: "◉",
      url: urls.coinJar,
      parameter: "model",
      options: COIN_JAR_MODELS,
      defaultOption: "fantasy",
      previewKind: "coin-jar",
      sourceSize: [720, 520]
    },
    {
      key: "timer",
      name: "Timer",
      description: "Compte à rebours configurable avec les 14 thèmes graphiques.",
      category: "counters",
      icon: "◷",
      url: urls.timer,
      parameter: "theme",
      options: OVERLAY_THEMES,
      defaultOption: "gta",
      previewKind: "timer",
      sourceSize: [900, 360]
    },
    {
      key: "multiplierTimer",
      name: "Timer multiplicateur",
      description: "Compte à rebours indépendant affichant un multiplicateur X2 à X5.",
      category: "counters",
      icon: "×2",
      url: urls.multiplierTimer,
      parameter: "theme",
      options: OVERLAY_THEMES,
      defaultOption: "gta",
      previewView: "multiplier-timer",
      previewKind: "timer",
      sourceSize: [900, 360],
      requiresPro: true
    },
    {
      key: "winCounter",
      name: "Compteur de wins",
      description: "Compteur de victoires réactif avec objectif et 14 thèmes graphiques.",
      category: "counters",
      icon: "W",
      url: urls.winCounter,
      parameter: "theme",
      options: OVERLAY_THEMES,
      defaultOption: "gta",
      previewView: "win-counter",
      previewKind: "win-counter",
      sourceSize: [720, 520],
      requiresPro: true
    },
    {
      key: "wheel",
      name: "Wheel Actions",
      description: "Roue d’actions configurable avec segments, libellés et designs Classique ou Royale Prestige.",
      category: "interactions",
      icon: "✺",
      url: urls.wheel,
      parameter: "design",
      options: [["classic", "Orange classique"], ["royal", "Royale Prestige"]],
      defaultOption: "classic",
      previewKind: "wheel",
      sourceSize: [800, 900]
    },
    ...[
      ["matchX2", "Match x2", "x2"],
      ["matchX3", "Match x3", "x3"],
      ["matchGants", "Match Gants", "guantes"],
      ["matchCoffre", "Match Coffre", "cofre"],
      ["matchSnipe", "Match Snipe", "snipe"],
      ["matchTapTap", "Match TapTap", "taptap"],
      ["matchQuiereme", "Match Quiereme", "quiereme"],
      ["matchEnigma", "Match Enigma", "enigma"]
    ].map(([key, name, match]) => ({
      key,
      name,
      description: `Animation ${name.replace("Match ", "")} plein écran pour les temps forts des matchs TikTok.`,
      category: "matches",
      icon: "VS",
      url: urls[key],
      parameter: "variant",
      options: match === "enigma" ? [MATCH_VARIANTS[0]] : MATCH_VARIANTS,
      defaultOption: "tikcontrol",
      previewView: "match",
      previewKind: "match",
      match,
      sourceSize: [1080, 1920],
      requiresPro: true
    }))
  ];
}

function overlayUnlocked(item) {
  return !item.requiresPro || hasProAccess();
}

function selectedOverlayDesign(item) {
  const config = overlayConfig(item.key);
  const previewSelection = overlayDesignSelections[item.key];
  if (previewSelection) return previewSelection;
  if (item.key === "wheel" && Array.isArray(config.wheels)) {
    const selectedWheel = config.wheels.find(
      (wheel) => wheel.id === config.selectedWheelId
    ) || config.wheels[0];
    if (selectedWheel?.design) return selectedWheel.design;
  }
  const configured = item.parameter === "theme"
    ? config.theme
    : item.parameter === "model"
      ? config.model
      : item.parameter === "design"
        ? config.design
        : item.parameter === "variant"
          ? config.variant
          : "";
  return configured || item.defaultOption || item.options?.[0]?.[0] || "";
}

function overlayConfig(key) {
  const common = {
    enabled: true,
    scale: 100,
    xOffset: 0,
    yOffset: 0,
    accentColor: "#22d3ee",
    secondaryColor: "#ff4f86",
    textColor: "#ffffff",
    backgroundColor: "#111315",
    backgroundOpacity: 82,
    shadowColor: "#000000",
    showShadow: true,
    showWhenIdle: true,
    font: "Inter",
    fontSize: 100,
    layout: "wide",
    animation: "pop",
    displayTime: 8,
    pauseTime: 2,
    soundEnabled: true,
    soundVolume: 70,
    saturation: 100,
    hue: 0,
    rtl: false
  };
  const specific = {
    myActions: { title: "MY ACTIONS", maxRows: 5, showHeader: true },
    likeGoal: {
      schemaVersion: 2,
      title: "LIKE GOAL",
      theme: "classic",
      scale: 100,
      current: 0,
      target: 50000,
      whenReached: "increase",
      completionActionId: "",
      goalBaseline: 0,
      progressLabel: "Objectif LIVE",
      showHeader: true,
      showGoal: true,
      showPercent: true
    },
    topDonors: {
      title: "CLASSEMENT DONATEURS",
      theme: "classic",
      maxRows: 5,
      showHeader: true,
      showRank: true,
      showAvatars: true,
      showCrown: true,
      showRankBadges: true,
      showMetricLabel: true,
      nameColor: "#ffffff",
      scoreColor: "#ffe575",
      rankColor: "#ffe575",
      rowOpacity: 68
    },
    topTappers: {
      title: "CLASSEMENT TAPOTEURS",
      theme: "classic",
      maxRows: 5,
      showHeader: true,
      showRank: true,
      showAvatars: true,
      showCrown: true,
      showRankBadges: true,
      showMetricLabel: true,
      nameColor: "#ffffff",
      scoreColor: "#ff8db8",
      rankColor: "#ffe575",
      rowOpacity: 68
    },
    coinJar: {
      title: "COIN JAR",
      model: "fantasy",
      current: 0,
      target: 1000,
      minCoins: 0,
      showGoal: true,
      showBase: true
    },
    timer: {
      title: "TEMPS RESTANT",
      theme: "gta",
      seconds: 300,
      completionActionId: "",
      showHours: true,
      showGoal: true,
      timerAutoStart: false,
      incrementShortcut: "Alt+W, Alt+ArrowUp",
      decrementShortcut: "Alt+S, Alt+ArrowDown",
      resetShortcut: "Alt+R, Alt+0"
    },
    multiplierTimer: {
      title: "BONUS ACTIF",
      theme: "gta",
      seconds: 120,
      multiplier: 2,
      showHours: false,
      showGoal: true,
      timerAutoStart: false
    },
    winCounter: {
      title: "WIN",
      theme: "gta",
      current: 0,
      target: 20,
      showGoal: false,
      allowNegative: true,
      winCounterLabelColorNegative: "#ff4f6d",
      winCounterLabelColorNeutral: "#f8fafc",
      winCounterLabelColorPositive: "#31ff74",
      winCounterLabelOffsetX: 0,
      winCounterLabelOffsetY: 0,
      incrementShortcut: "Alt+W, Alt+ArrowUp",
      decrementShortcut: "Alt+S, Alt+ArrowDown",
      resetShortcut: "Alt+R, Alt+0"
    }
  };
  const saved = snapshot.state.settings.overlayConfigs?.[key] || {};
  const fallback = specific[key] || (
    key.startsWith("match")
      ? { variant: "tikcontrol", fit: "contain", autoplay: true, loop: true }
      : {}
  );
  const merged = { ...common, ...fallback, ...saved };
  return key === "wheel" ? normalizeWheelConfig(merged) : merged;
}

function overlayUrl(item, configOverride = null) {
  if (!item?.url) return "";
  try {
    const url = new URL(item.url);
    const config = configOverride
      ? { ...overlayConfig(item.key), ...configOverride }
      : overlayConfig(item.key);
    const selectedWheel = item.key === "wheel" && Array.isArray(config.wheels)
      ? config.wheels.find((wheel) => wheel.id === config.selectedWheelId) || config.wheels[0]
      : null;
    const effectiveConfig = selectedWheel
      ? {
          ...config,
          ...selectedWheel.settings,
          design: selectedWheel.design,
          choices: selectedWheel.segments?.map((segment) => segment.label) || config.choices,
          colors: selectedWheel.segments?.map((segment) => segment.color) || config.colors
        }
      : config;
    const selectedParameter = item.parameter === "theme"
      ? effectiveConfig.theme
      : item.parameter === "model"
        ? effectiveConfig.model
        : item.parameter === "design"
          ? effectiveConfig.design
          : item.parameter === "variant"
            ? effectiveConfig.variant
            : "";
    if (item.parameter) {
      url.searchParams.set(
        item.parameter,
        selectedParameter || selectedOverlayDesign(item)
      );
    }
    const mappings = {
      accentColor: "accent",
      secondaryColor: "secondary",
      textColor: "textColor",
      backgroundColor: "background",
      backgroundOpacity: "backgroundOpacity",
      shadowColor: "shadowColor",
      showShadow: "showShadow",
      showWhenIdle: "showWhenIdle",
      font: "font",
      fontSize: "fontSize",
      layout: "layout",
      animation: "animation",
      displayTime: "displayTime",
      pauseTime: "pauseTime",
      soundEnabled: "soundEnabled",
      soundVolume: "soundVolume",
      saturation: "saturation",
      hue: "hue",
      rtl: "rtl",
      scale: "scale",
      xOffset: "x",
      yOffset: "y",
      title: "title",
      current: "current",
      target: "target",
      seconds: "seconds",
      multiplier: "multiplier",
      fit: "fit",
      autoplay: "autoplay",
      loop: "loop",
      showHeader: "showHeader",
      showGoal: "showGoal",
      showPercent: "showPercent",
      showRank: "showRank",
      showAvatars: "showAvatars",
      showCrown: "showCrown",
      showRankBadges: "showRankBadges",
      showMetricLabel: "showMetricLabel",
      showBase: "showBase",
      showHours: "showHours",
      timerAutoStart: "timerAutoStart",
      allowNegative: "allowNegative",
      minCoins: "minCoins",
      goalBaseline: "goalBaseline",
      progressLabel: "progressLabel",
      whenReached: "whenReached",
      winCounterLabelColorNegative: "negativeColor",
      winCounterLabelColorNeutral: "neutralColor",
      winCounterLabelColorPositive: "positiveColor",
      winCounterLabelOffsetX: "labelX",
      winCounterLabelOffsetY: "labelY",
      incrementShortcut: "incrementShortcut",
      decrementShortcut: "decrementShortcut",
      resetShortcut: "resetShortcut",
      maxRows: "maxRows",
      enabled: "enabled",
      nameColor: "nameColor",
      scoreColor: "scoreColor",
      rankColor: "rankColor",
      rowOpacity: "rowOpacity"
    };
    for (const [key, parameter] of Object.entries(mappings)) {
      if (effectiveConfig[key] !== undefined && effectiveConfig[key] !== "") {
        url.searchParams.set(parameter, String(effectiveConfig[key]));
      }
    }
    if (Array.isArray(effectiveConfig.choices)) {
      url.searchParams.set("choices", effectiveConfig.choices.join("|"));
    }
    if (Array.isArray(effectiveConfig.colors)) {
      url.searchParams.set("colors", effectiveConfig.colors.join("|"));
    }
    if (item.key === "wheel") {
      const wheelParameters = [
        "font",
        "fontSize",
        "textOrientation",
        "textColor",
        "textShadowColor",
        "textShadowStrength",
        "textRadius",
        "textSegmentOffset",
        "textBoxWidth",
        "textBoxHeight",
        "textAngleOffset",
        "textAlign",
        "textClamp",
        "textMaxLines",
        "lineSpacing",
        "letterSpacing",
        "soundActive",
        "spinDuration",
        "waitDuration",
        "glow",
        "showWinner",
        "pointerPosition",
        "alwaysVisible",
        "entranceAnimation",
        "exitAnimation",
        "resultDuration"
      ];
      for (const key of wheelParameters) {
        if (effectiveConfig[key] !== undefined && effectiveConfig[key] !== "") {
          url.searchParams.set(key, String(effectiveConfig[key]));
        }
      }
    }
    return url.toString();
  } catch {
    return item.url;
  }
}

function localOverlayUrl(item, configOverride = null) {
  const localUrl = snapshot?.localOverlayUrls?.[item?.key] || "";
  if (!localUrl) return "";
  return overlayUrl({ ...item, url: localUrl }, configOverride);
}

function overlayCatalogPreviewUrl(item) {
  const previewUrls = isAccountAuthenticated()
    ? snapshot?.localOverlayUrls
    : snapshot?.previewOverlayUrls;
  const localUrl = previewUrls?.[item?.key];
  if (localUrl) return localUrl;
  const base = previewUrls?.base;
  const token = snapshot?.state?.settings?.overlayToken;
  if (!base || !token || !item?.previewView) return "";
  try {
    const url = new URL("/overlay/", `${base}/`);
    url.searchParams.set("view", item.previewView);
    url.searchParams.set("token", token);
    if (item.match) url.searchParams.set("match", item.match);
    return url.toString();
  } catch {
    return "";
  }
}

function overlayRuntimeFrame(
  item,
  config = null,
  { context = "card", editable = false, loading = "lazy" } = {}
) {
  const size = overlaySourceSize(item);
  const cardMaxWidth = Math.min(560, Math.max(110, (220 * size.width) / size.height));
  const previewItem = {
    ...item,
    url: overlayCatalogPreviewUrl(item) || item.url
  };
  let runtimeUrl = overlayUrl(previewItem, config);
  try {
    const previewUrl = new URL(runtimeUrl);
    previewUrl.searchParams.set("preview", "static");
    runtimeUrl = previewUrl.toString();
  } catch {
    // Keep the original local URL if it cannot be parsed.
  }
  return `<div
    class="overlay-runtime-frame overlay-runtime-frame--${escapeHtml(context)}"
    data-overlay-native-frame
    data-overlay-source-width="${size.width}"
    data-overlay-source-height="${size.height}"
    style="--overlay-preview-ratio:${size.width} / ${size.height};--overlay-card-max-width:${cardMaxWidth.toFixed(2)}px;--overlay-source-max-width:${size.width}px;--overlay-source-width:${size.width}px;--overlay-source-height:${size.height}px"
  >
    <iframe
      ${editable ? "data-overlay-live-preview" : 'data-overlay-runtime-preview="true"'}
      title="Aperçu réel ${escapeHtml(item.name)}"
      src="${escapeHtml(runtimeUrl)}"
      loading="${loading}"
      tabindex="-1"
      sandbox="allow-scripts allow-same-origin"
    ></iframe>
  </div>`;
}

const observedOverlayRuntimeFrames = new Set();
const overlayRuntimeFrameObserver = typeof ResizeObserver === "undefined"
  ? null
  : new ResizeObserver((entries) => {
    for (const entry of entries) updateOverlayRuntimeFrameScale(entry.target);
  });

function updateOverlayRuntimeFrameScale(frame) {
  const sourceWidth = Number(frame.dataset.overlaySourceWidth || 0);
  const sourceHeight = Number(frame.dataset.overlaySourceHeight || 0);
  if (
    !sourceWidth ||
    !sourceHeight ||
    !frame.clientWidth ||
    !frame.clientHeight
  ) return;
  const scale = Math.min(
    frame.clientWidth / sourceWidth,
    frame.clientHeight / sourceHeight
  );
  frame.style.setProperty("--overlay-render-scale", String(scale));
}

function bindOverlayRuntimeFrames(root = document) {
  for (const frame of observedOverlayRuntimeFrames) {
    if (frame.isConnected) continue;
    overlayRuntimeFrameObserver?.unobserve(frame);
    observedOverlayRuntimeFrames.delete(frame);
  }
  root.querySelectorAll("[data-overlay-native-frame]").forEach((frame) => {
    if (!observedOverlayRuntimeFrames.has(frame)) {
      observedOverlayRuntimeFrames.add(frame);
      overlayRuntimeFrameObserver?.observe(frame);
    }
    const iframe = frame.querySelector("iframe");
    if (iframe && !iframe.dataset.overlayPreviewLoadBound) {
      iframe.dataset.overlayPreviewLoadBound = "true";
      iframe.addEventListener("load", () => {
        iframe.dataset.overlayPreviewReady = "true";
      });
    }
    updateOverlayRuntimeFrameScale(frame);
  });
}

function overlayPreview(item, config = null) {
  return overlayRuntimeFrame(item, config, { context: "card" });
}

function overlayDesignPicker(item, allowed = overlayUnlocked(item)) {
  if (!item.options?.length) return "";
  const selection = selectedOverlayDesign(item);
  return `<label class="overlay-design-picker">
    <span>Design · ${item.options.length} disponible${item.options.length > 1 ? "s" : ""}${allowed ? "" : " · aperçu"}</span>
    <select data-overlay-design="${escapeHtml(item.key)}" data-overlay-preview-only="${allowed ? "false" : "true"}">
      ${item.options.map(([value, label]) => `<option value="${escapeHtml(value)}" ${selection === value ? "selected" : ""}>${escapeHtml(label)}</option>`).join("")}
    </select>
  </label>`;
}

function overlaySourceSize(item) {
  const [width, height] = item.sourceSize || [1920, 1080];
  return {
    width,
    height,
    label: `Largeur ${width} px · Hauteur ${height} px`
  };
}

function overlayProfileName() {
  const profileId = snapshot.state.session.profileId;
  return snapshot.state.profiles?.find((profile) => profile.id === profileId)?.name
    || "Profil actif";
}

function overlayQuickActions(item, allowed = true) {
  if (["timer", "multiplierTimer"].includes(item.key)) {
    const paused = Boolean(overlayConfig(item.key).timerPaused);
    const toggleLabel = paused ? "Reprendre le timer" : "Mettre le timer en pause";
    const toggleIcon = paused ? "&#9654;" : "&#10074;&#10074;";
    return `<div class="overlay-quick-actions overlay-quick-actions--timer" aria-label="Actions rapides">
      <span>Actions rapides</span>
      <div>
        <button type="button" class="button tiny ghost overlay-quick-icon" data-action="overlay-quick" data-id="${escapeHtml(item.key)}" data-operation="pause" data-amount="0" title="${toggleLabel}" aria-label="${toggleLabel}" ${allowed ? "" : "disabled"}><span aria-hidden="true">${toggleIcon}</span></button>
        <button type="button" class="button tiny ghost overlay-quick-icon" data-action="overlay-quick" data-id="${escapeHtml(item.key)}" data-operation="reset" data-amount="0" title="Réinitialiser le timer" aria-label="Réinitialiser le timer" ${allowed ? "" : "disabled"}><span aria-hidden="true">&#8635;</span></button>
      </div>
    </div>`;
  }
  const definitions = {
    likeGoal: [
      ["add", 1000, "＋1 000"],
      ["reset", 0, "Réinitialiser"]
    ],
    coinJar: [
      ["add", 10, "＋10"],
      ["remove", 10, "−10"],
      ["reset", 0, "Vider"]
    ],
    winCounter: [
      ["remove", 1, "−1"],
      ["add", 1, "＋1"],
      ["reset", 0, "Réinitialiser"]
    ],
    wheel: [["test", 0, "Lancer"]]
  };
  const actions = definitions[item.key] || [];
  if (!actions.length) return "";
  return `<div class="overlay-quick-actions" aria-label="Actions rapides">
    <span>Actions rapides</span>
    <div>${actions.map(([operation, amount, label]) =>
      `<button type="button" class="button tiny ghost" data-action="overlay-quick" data-id="${escapeHtml(item.key)}" data-operation="${operation}" data-amount="${amount}" ${allowed ? "" : "disabled"}>${escapeHtml(label)}</button>`
    ).join("")}</div>
  </div>`;
}

function renderOverlayCard(item, { allowed = overlayUnlocked(item) } = {}) {
  const accountReady = isAccountAuthenticated();
  const url = accountReady && allowed ? overlayUrl(item) : "";
  const size = overlaySourceSize(item);
  const categoryLabel = {
    counters: "Compteurs",
    rankings: "Classements",
    interactions: "Interactions",
    actions: "Actions",
    events: "Événements",
    points: "Points",
    likes: "Likes",
    gifts: "Cadeaux",
    games: "Jeux",
    music: "Musique",
    seasonal: "Saisonnier",
    tools: "Outils",
    matches: "Matchs"
  }[item.category] || item.category;
  return `<article class="overlay-catalog-card ${allowed ? "" : "locked"}" data-overlay-card="${escapeHtml(item.key)}">
    <div class="overlay-preview">${overlayPreview(item)}</div>
    <div class="overlay-card-copy">
      <div class="overlay-card-title">
        <span>${item.icon}</span>
        <div><h3>${escapeHtml(item.name)}</h3><small>${escapeHtml(categoryLabel)}</small></div>
        <span class="badge ${allowed ? "success" : "warning"}">${allowed ? (item.requiresPro ? "PRO" : "LOCAL") : (item.requiresPro ? "PRO REQUIS" : "INDISPONIBLE")}</span>
      </div>
      <p>${escapeHtml(item.description)}</p>
      <div class="overlay-card-meta">
        <span class="overlay-source-size">
          <small>Source OBS recommandée</small>
          <span class="overlay-source-dimensions">
            <span><small>Largeur</small><strong>${size.width} px</strong></span>
            <span><small>Hauteur</small><strong>${size.height} px</strong></span>
          </span>
        </span>
        <span><small>Configuration liée</small><strong>${escapeHtml(overlayProfileName())}</strong></span>
      </div>
      ${overlayDesignPicker(item, allowed && accountReady)}
      ${overlayQuickActions(item, allowed && accountReady)}
      ${accountReady
        ? ""
        : `<div class="overlay-guest-preview-actions">
            <button class="button small primary" type="button" data-action="preview-overlay" data-id="${escapeHtml(item.key)}">Voir l’animation</button>
            <span>Essai local et temporaire, sans enregistrer le design.</span>
          </div>`}
      ${allowed || !accountReady
        ? ""
        : `<div class="overlay-locked-actions"><span>L’aperçu et tous les réglages restent accessibles. Seule l’URL OBS est protégée.</span><div><button class="button small" data-action="configure-overlay" data-id="${escapeHtml(item.key)}">Configurer l’aperçu</button><button class="button small warning" data-navigate="membership">Voir les abonnements</button></div></div>`}
    </div>
    ${allowed && accountReady
      ? `<div class="overlay-card-footer">
          <div class="url-field"><code>${escapeHtml(url)}</code><button class="button small" data-action="copy" data-value="${escapeHtml(url)}">Copier</button></div>
          <div class="entity-actions">
            <button class="button small primary" data-action="preview-overlay" data-id="${escapeHtml(item.key)}">Tester en direct</button>
            <button class="button small" data-action="configure-overlay" data-id="${escapeHtml(item.key)}">Configurer</button>
            <button class="button small" data-action="open-url" data-value="${escapeHtml(url)}">Ouvrir</button>
            <button class="button small ghost" data-action="copy" data-value="${escapeHtml(localOverlayUrl(item))}">OBS local</button>
          </div>
        </div>`
      : ""}
  </article>`;
}

function overlayCardElement(key) {
  return [...content.querySelectorAll("[data-overlay-card]")].find(
    (card) => card.dataset.overlayCard === key
  ) || null;
}

function postOverlayCardEvent(key, channel, payload) {
  const frames = [
    overlayCardElement(key)?.querySelector(
      '[data-overlay-runtime-preview="true"]'
    ),
    dialogBody.querySelector(
      `[data-overlay-config-editor="${CSS.escape(key)}"] [data-overlay-live-preview]`
    )
  ].filter(
    (frame, index, entries) =>
      frame?.contentWindow && entries.indexOf(frame) === index
  );
  if (!frames.length) return false;
  const message = {
    source: "shenpulse-overlay-card",
    channel,
    payload
  };
  for (const frame of frames) {
    const send = () => {
      try {
        frame.contentWindow?.postMessage(message, new URL(frame.src).origin);
      } catch {
        // The preview may have left the DOM while navigating.
      }
    };
    send();
    if (!frame.dataset.overlayPreviewReady) {
      frame.addEventListener("load", send, { once: true });
    }
  }
  return true;
}

function postOverlayPreviewEvent(channel, payload) {
  const frames = content.querySelectorAll(
    '[data-overlay-runtime-preview="true"]'
  );
  for (const frame of frames) {
    if (!frame.contentWindow) continue;
    const message = {
      source: "shenpulse-overlay-card",
      channel,
      payload
    };
    const send = () => {
      try {
        frame.contentWindow?.postMessage(
          message,
          new URL(frame.src).origin
        );
      } catch {
        // A preview can disappear when the user changes page.
      }
    };
    send();
    if (!frame.dataset.overlayPreviewReady) {
      frame.addEventListener("load", send, { once: true });
    }
  }
}

function overlaySessionLifecycleSignature(value) {
  const runtime = value?.state?.overlaySession || {};
  return JSON.stringify(runtime);
}

function updateOverlayCardConfigUi(key, config) {
  const item = overlayDefinitions().find((entry) => entry.key === key);
  const card = overlayCardElement(key);
  if (!item || !card) return;

  const url = overlayUrl(item, config);
  const footer = card.querySelector(".overlay-card-footer");
  const code = footer?.querySelector(".url-field code");
  if (code) code.textContent = url;
  footer
    ?.querySelectorAll('[data-action="copy"], [data-action="open-url"]')
    .forEach((button) => {
      button.dataset.value = url;
    });

  if (["timer", "multiplierTimer"].includes(key)) {
    const toggle = card.querySelector(
      '.overlay-quick-actions--timer [data-operation="pause"]'
    );
    const paused = Boolean(config.timerPaused);
    const label = paused ? "Reprendre le timer" : "Mettre le timer en pause";
    if (toggle) {
      toggle.title = label;
      toggle.setAttribute("aria-label", label);
      const icon = toggle.querySelector('[aria-hidden="true"]');
      if (icon) icon.textContent = paused ? "▶" : "❚❚";
    }
  }
}

function previewOverlayDesignSelection(item, value) {
  overlayDesignSelections[item.key] = value;
  const frame = overlayCardElement(item.key)?.querySelector(
    '[data-overlay-runtime-preview="true"]'
  );
  if (!frame) return;
  const send = () => {
    postOverlayCardEvent(item.key, "design", {
      parameter: item.parameter || "theme",
      value
    });
  };
  send();
  if (!frame.dataset.overlayPreviewReady) {
    frame.addEventListener("load", send, { once: true });
  }
}

async function saveOverlayConfig(
  key,
  nextConfig,
  { rerender = true, updateCard = false } = {}
) {
  const scrollTop = content.scrollTop;
  if (updateCard) {
    locallyHandledOverlayConfigs.set(key, JSON.stringify(nextConfig || {}));
  }
  try {
    acceptSnapshot(await api.saveSettings({
      ...snapshot.state.settings,
      overlayConfigs: {
        ...(snapshot.state.settings.overlayConfigs || {}),
        [key]: nextConfig
      }
    }));
  } catch (error) {
    if (updateCard) locallyHandledOverlayConfigs.delete(key);
    throw error;
  }
  if (updateCard) {
    updateOverlayCardConfigUi(key, nextConfig);
    setTimeout(() => {
      if (
        locallyHandledOverlayConfigs.get(key) ===
        JSON.stringify(nextConfig || {})
      ) {
        locallyHandledOverlayConfigs.delete(key);
      }
    }, 1500);
  }
  if (rerender) {
    render();
    content.scrollTop = scrollTop;
  }
  return nextConfig;
}

async function persistOverlayDesignSelection(item, value) {
  const config = overlayConfig(item.key);
  let next = { ...config };
  if (item.key === "wheel") {
    const normalized = normalizeWheelConfig(config);
    const wheels = normalized.wheels.map((wheel) =>
      wheel.id === normalized.selectedWheelId
        ? { ...wheel, design: value === "royal" ? "royal" : "classic" }
        : wheel
    );
    next = { ...normalized, design: value, wheels };
  } else {
    const property = item.parameter === "model"
      ? "model"
      : item.parameter === "variant"
        ? "variant"
        : "theme";
    next[property] = value;
  }
  previewOverlayDesignSelection(item, value);
  if (!overlayUnlocked(item)) return next;
  await saveOverlayConfig(item.key, next, {
    rerender: false,
    updateCard: true
  });
  return next;
}

const OVERLAY_FIELD_HELP = {
  enabled: "Active ou masque entièrement cet overlay dans sa source navigateur, sans supprimer ses réglages.",
  title: "Texte principal affiché dans l’overlay. Le changement apparaît immédiatement dans l’aperçu.",
  scale: "Agrandit ou réduit l’ensemble du rendu à l’intérieur de la source OBS, sans changer ses dimensions.",
  xOffset: "Déplace horizontalement le rendu dans la source : valeur négative vers la gauche, positive vers la droite.",
  yOffset: "Déplace verticalement le rendu dans la source : valeur négative vers le haut, positive vers le bas.",
  accentColor: "Couleur principale des éléments générés par ShenPulse, notamment les progressions et les accents.",
  secondaryColor: "Deuxième couleur utilisée pour les dégradés, pourcentages et détails contrastés.",
  textColor: "Couleur des textes générés par ShenPulse. Les textes intégrés dans une image de design ne sont pas modifiés.",
  backgroundColor: "Couleur du panneau situé derrière le contenu de l’overlay.",
  backgroundOpacity: "Règle la transparence du panneau de fond, de totalement transparent à totalement opaque.",
  showShadow: "Active ou retire les ombres des textes et éléments générés par ShenPulse.",
  showWhenIdle: "Garde l’overlay visible lorsqu’aucun événement n’est reçu. Sinon il se masque après sa durée d’affichage.",
  font: "Police utilisée par les textes générés par ShenPulse.",
  fontSize: "Agrandit ou réduit uniquement les textes, sans modifier la taille du design.",
  saturation: "Intensifie ou atténue toutes les couleurs du rendu, design compris.",
  hue: "Fait tourner la teinte de toutes les couleurs du rendu pour créer une variante chromatique.",
  rtl: "Inverse le sens de lecture pour les langues qui s’écrivent de droite à gauche.",
  theme: "Design graphique appliqué à l’overlay. Tous les designs sont visibles dans l’aperçu, même sans abonnement Pro.",
  model: "Modèle graphique du bocal utilisé dans la source et dans l’aperçu.",
  variant: "Version vidéo de l’animation de match.",
  current: "Valeur de départ utilisée hors live ou quand aucune donnée de session n’est encore disponible.",
  target: "Valeur à atteindre. Elle définit aussi le calcul de la progression quand l’overlay en possède une.",
  goalBaseline: "Point de départ de la progression : les valeurs inférieures ou égales correspondent à 0 %.",
  progressLabel: "Libellé affiché au-dessus de la progression du Like Goal.",
  whenReached: "Définit le comportement automatique lorsque le Like Goal atteint sa valeur cible.",
  completionActionId: "Action ShenPulse lancée une seule fois lorsque le Like Goal franchit son objectif ou lorsque le timer standard arrive à zéro.",
  showPercent: "Affiche ou masque le pourcentage calculé à côté des valeurs du Like Goal.",
  minCoins: "Valeur minimale du bocal après une remise à zéro ou une mise à jour.",
  showBase: "Affiche ou masque la partie de support prévue par le design.",
  seconds: "Temps chargé au démarrage de la source, avant les ajouts, retraits ou remises à zéro.",
  timerAutoStart: "Démarre automatiquement le compte à rebours dès que la source navigateur est chargée.",
  showHours: "Affiche le format heures:minutes:secondes dès qu’une heure ou plus reste au compteur.",
  multiplier: "Valeur X2 à X5 affichée sur le Timer multiplicateur.",
  maxRows: "Nombre maximal d’éléments ou de personnes visibles simultanément.",
  showRank: "Affiche ou masque le numéro et le badge de chaque position du classement.",
  showAvatars: "Affiche les photos de profil TikTok, ou l’initiale quand aucune photo n’est disponible.",
  showCrown: "Affiche la couronne graphique au-dessus de la première place.",
  showRankBadges: "Affiche les médailles et cadres graphiques associés aux premières places.",
  showMetricLabel: "Affiche le score et son unité, par exemple coins ou likes.",
  nameColor: "Couleur des noms des viewers dans le classement.",
  scoreColor: "Couleur du score affiché pour chaque viewer.",
  rankColor: "Couleur des numéros de rang lorsque le design les laisse visibles.",
  rowOpacity: "Règle l’opacité du fond généré derrière chaque ligne du classement.",
  allowNegative: "Autorise le compteur de wins à descendre sous zéro.",
  winCounterLabelColorNegative: "Couleur du nombre lorsque la valeur est négative.",
  winCounterLabelColorNeutral: "Couleur du nombre lorsque la valeur est égale à zéro.",
  winCounterLabelColorPositive: "Couleur du nombre lorsque la valeur est positive.",
  winCounterLabelOffsetX: "Déplace horizontalement le bloc libellé, valeur et objectif dans le design.",
  winCounterLabelOffsetY: "Déplace verticalement le bloc libellé, valeur et objectif dans le design.",
  fit: "Détermine si la vidéo entière reste visible ou remplit la source 1080 × 1920 en la recadrant si nécessaire.",
  autoplay: "Lance la vidéo automatiquement au chargement et à chaque déclenchement.",
  loop: "Rejoue l’animation vidéo en continu au lieu de s’arrêter après une lecture.",
  showHeader: "Affiche ou masque le titre principal de l’overlay.",
  showGoal: "Affiche ou masque la zone d’objectif lorsque ce design en possède une.",
  incrementShortcut: "Combinaisons clavier qui ajoutent une unité. Séparez plusieurs raccourcis par une virgule.",
  decrementShortcut: "Combinaisons clavier qui retirent une unité. Séparez plusieurs raccourcis par une virgule.",
  resetShortcut: "Combinaisons clavier qui remettent la valeur à zéro.",
  wheelName: "Nom interne de cette roue et libellé utilisé dans la source lorsqu’il est affiché.",
  wheelEnabled: "Autorise cette roue à être choisie et déclenchée par ShenPulse.",
  wheelDesign: "Style graphique de la roue sélectionnée.",
  wheelTrigger: "Cadeau TikTok précis qui lance cette roue. Laissez vide pour un lancement manuel ou depuis une action.",
  wheelSegmentLabel: "Texte affiché dans cette case de la roue.",
  wheelSegmentColor: "Couleur de fond de cette case.",
  wheelSegmentAction: "Comportement exécuté lorsque cette case gagne : affichage, action ShenPulse ou nouvelle rotation.",
  wheelSegmentActionId: "Action ShenPulse lancée uniquement lorsque le résultat de la case est réglé sur « Lancer une action ».",
  textOrientation: "Orientation du texte à l’intérieur des segments.",
  textShadowColor: "Couleur de l’ombre dessinée derrière le texte des segments.",
  textShadowStrength: "Intensité et visibilité de l’ombre du texte.",
  textRadius: "Distance du texte par rapport au centre de la roue.",
  textSegmentOffset: "Décale le texte le long de son segment sans déplacer le segment.",
  textBoxWidth: "Largeur maximale réservée au texte dans chaque segment.",
  textBoxHeight: "Hauteur maximale réservée au texte dans chaque segment.",
  textAngleOffset: "Corrige l’angle du texte dans tous les segments.",
  textAlign: "Alignement du texte à l’intérieur de sa zone.",
  textClamp: "Limite le texte à la zone et au nombre de lignes prévus.",
  textMaxLines: "Nombre maximal de lignes affichées par segment lorsque la limitation est active.",
  lineSpacing: "Espace vertical entre les lignes du texte.",
  letterSpacing: "Espace horizontal entre les lettres.",
  glow: "Intensité de la lumière autour de la roue.",
  pointerPosition: "Côté de la roue sur lequel le pointeur du résultat est placé.",
  soundActive: "Active ou coupe le son de rotation de la roue.",
  spinDuration: "Durée exacte de la rotation et du son associé.",
  waitDuration: "Pause entre l’arrêt de la roue et l’affichage du résultat.",
  showWinner: "Affiche le libellé de la case gagnante après l’arrêt.",
  resultDuration: "Durée pendant laquelle le résultat gagnant reste visible.",
  alwaysVisible: "Garde la roue visible au repos ou la montre uniquement pendant une rotation.",
  entranceAnimation: "Animation utilisée lorsque la roue apparaît.",
  exitAnimation: "Animation utilisée lorsque la roue disparaît."
};

function fieldLabelWithInfo(label, help) {
  return `<span class="field-label-with-info">
    <span>${escapeHtml(label)}</span>
    <button type="button" class="field-info-button" aria-label="Information : ${escapeHtml(label)}" title="${escapeHtml(help)}">i</button>
    <span class="field-info-popover" role="tooltip">${escapeHtml(help)}</span>
  </span>`;
}

function overlaySelect(name, label, value, options, full = false, help = OVERLAY_FIELD_HELP[name] || "") {
  return `<label class="field ${full ? "full" : ""}">${fieldLabelWithInfo(label, help)}<select name="${escapeHtml(name)}">${options.map(([optionValue, optionLabel]) => `<option value="${escapeHtml(optionValue)}" ${String(value) === String(optionValue) ? "selected" : ""}>${escapeHtml(optionLabel)}</option>`).join("")}</select></label>`;
}

function overlayField(name, label, value = "", type = "text", extra = "", help = OVERLAY_FIELD_HELP[name] || "") {
  return `<label class="field ${extra.includes("full") ? "full" : ""}">${fieldLabelWithInfo(label, help)}<input name="${escapeHtml(name)}" type="${escapeHtml(type)}" value="${escapeHtml(value)}" ${extra.replace("full", "")}></label>`;
}

function overlayActionSelect(name, label, selectedId = "") {
  return `<label class="field full">${fieldLabelWithInfo(
    label,
    OVERLAY_FIELD_HELP.completionActionId
  )}<select name="${escapeHtml(name)}">${wheelActionOptions(
    selectedId
  )}</select></label>`;
}

function wheelDefaultSettings(overrides = {}) {
  return {
    font: "Kalam",
    fontSize: 50,
    textOrientation: "horizontal",
    textColor: "#fff8ec",
    textShadowColor: "#2b170c",
    textShadowStrength: 55,
    textRadius: 100,
    textSegmentOffset: 0,
    textBoxWidth: 100,
    textBoxHeight: 240,
    textAngleOffset: 0,
    textAlign: "center",
    textClamp: false,
    textMaxLines: 4,
    lineSpacing: 50,
    letterSpacing: 50,
    showBase: true,
    soundActive: true,
    announceDuration: 0,
    spinDuration: 5,
    waitDuration: 3,
    scale: 100,
    glow: 82,
    showWinner: true,
    pointerPosition: "top",
    alwaysVisible: true,
    entranceAnimation: "fade",
    exitAnimation: "fade",
    resultDuration: 4,
    ...overrides,
    announceDuration: 0
  };
}

function wheelSeedSegments(design = "classic") {
  const values = design === "royal"
    ? [
        ["15s pompes", "#7b1fa2"],
        ["4x gainage", "#f59f00"],
        ["Rien", "#2f8f00"],
        ["3x abdos", "#0067b8"],
        ["10x pompes", "#c51f12"],
        ["1x relance", "#9b168d", "spin"],
        ["20x abdos", "#008d8f"],
        ["5x gainage", "#d77a00"],
        ["15s pompes", "#005fae"],
        ["1x abdo", "#2e8b00"],
        ["20x pompes", "#d52a16"],
        ["5x abdos", "#0094a3"]
      ]
    : [
        ["10 pompes", "#ff6a00"],
        ["Choisis un défi", "#111111"],
        ["x2 pendant 1 min", "#f59f00"],
        ["Question chat", "#2a1207"],
        ["Danse 15 sec", "#ff8a1f"],
        ["Rien du tout", "#1e1e1e"],
        ["Action mystère", "#ffb04a"],
        ["Relance", "#371707", "spin"]
      ];
  return values.map(([label, color, action = "none"]) => ({
    id: `segment_${cryptoId()}`,
    label,
    color,
    action,
    actionId: ""
  }));
}

function normalizedWheelSettings(wheel = {}) {
  const settings = wheel.settings || {};
  const usesRegressedDefaults =
    settings.font === "Inter" &&
    Number(settings.fontSize) === 19 &&
    settings.textOrientation === "radial" &&
    Number(settings.textRadius) === 34 &&
    Number(settings.textBoxHeight) === 42;
  if (!usesRegressedDefaults) return wheelDefaultSettings(settings);
  return wheelDefaultSettings(
    wheel.design === "royal"
      ? {
          font: "Georgia",
          fontSize: 50,
          textColor: "#fff5cb",
          glow: 100,
          spinDuration: 7
        }
      : {}
  );
}

function normalizeWheelConfig(rawConfig = {}) {
  const legacyLabels = Array.isArray(rawConfig.choices) && rawConfig.choices.length > 1
    ? rawConfig.choices
    : wheelSeedSegments().map((segment) => segment.label);
  const legacyColors = Array.isArray(rawConfig.colors) ? rawConfig.colors : [];
  const sourceWheels = Array.isArray(rawConfig.wheels) && rawConfig.wheels.length
    ? rawConfig.wheels
    : [{
        id: "wheel_classic",
        name: "Roue classique",
        enabled: true,
        trigger: "",
        design: rawConfig.design || "classic",
        settings: wheelDefaultSettings(rawConfig),
        segments: legacyLabels.map((label, index) => ({
          id: `segment_${cryptoId()}`,
          label,
          color: legacyColors[index] || ["#ff6a00", "#111111", "#f59f00", "#2a1207"][index % 4],
          action: "none",
          actionId: ""
        }))
      }];
  const wheels = sourceWheels.map((wheel, wheelIndex) => ({
    id: wheel.id || `wheel_${cryptoId()}`,
    name: wheel.name || `Roue ${wheelIndex + 1}`,
    enabled: wheel.enabled !== false,
    trigger: wheel.trigger || "",
    design: wheel.design === "royal" ? "royal" : "classic",
    settings: normalizedWheelSettings(wheel),
    segments: (wheel.segments?.length ? wheel.segments : wheelSeedSegments(wheel.design)).map(
      (segment, index) => ({
        id: segment.id || `segment_${cryptoId()}`,
        label: segment.label || `Segment ${index + 1}`,
        color: segment.color || "#ff6a00",
        action:
          segment.action === "spin"
            ? "spin"
            : segment.actionId
              ? "action"
              : segment.action === "action"
                ? "action"
                : "none",
        actionId: segment.actionId || ""
      })
    )
  }));
  if (!wheels.some((wheel) => wheel.design === "classic")) {
    wheels.push({
      id: "wheel_classic",
      name: "Roue Orange Classique - Actions LIVE",
      enabled: true,
      trigger: "",
      design: "classic",
      settings: wheelDefaultSettings(),
      segments: wheelSeedSegments("classic")
    });
  }
  if (!wheels.some((wheel) => wheel.design === "royal")) {
    wheels.push({
      id: "wheel_royal",
      name: "Roue Royale Prestige - Défis Sport",
      enabled: false,
      trigger: "",
      design: "royal",
      settings: wheelDefaultSettings({
        font: "Georgia",
        fontSize: 17,
        textColor: "#fff5cb",
        glow: 100,
        spinDuration: 7
      }),
      segments: wheelSeedSegments("royal")
    });
  }
  return {
    ...rawConfig,
    schemaVersion: 11,
    selectedWheelId: wheels.some((wheel) => wheel.id === rawConfig.selectedWheelId)
      ? rawConfig.selectedWheelId
      : wheels[0].id,
    wheels
  };
}

function wheelDesignOption(value, label, detail, selected) {
  return `<label class="wheel-design-option ${selected === value ? "selected" : ""}">
    <input type="radio" name="wheelDesign" value="${value}" ${selected === value ? "checked" : ""}>
    <span class="wheel-design-thumbnail" data-wheel-design-thumbnail="${value}" aria-hidden="true">
      <i></i><b></b><em></em>
    </span>
    <span class="wheel-design-copy"><strong>${label}</strong><small>${detail}</small></span>
    <span class="wheel-design-check" aria-hidden="true">✓</span>
  </label>`;
}

function wheelActionOptions(selectedId = "") {
  return [
    `<option value="">Choisir une action ShenPulse</option>`,
    ...flattenActions().map(({ rule, action }) =>
      `<option value="${escapeHtml(action.id)}" ${selectedId === action.id ? "selected" : ""}>${escapeHtml(rule.name)} · ${escapeHtml(actionTypeLabel(action.type))}</option>`
    )
  ].join("");
}

function wheelSegmentEditor(segment, index, count) {
  const resultLabel =
    segment.action === "spin"
      ? "Relance la roue"
      : segment.actionId
        ? "Lance une action"
        : "Affiche le résultat";
  return `<article class="wheel-segment-row" data-wheel-segment-row data-segment-id="${escapeHtml(segment.id)}">
    <header class="wheel-segment-header">
      <div class="wheel-segment-heading">
        <span class="wheel-segment-number">${index + 1}</span>
        <span class="wheel-segment-color-preview" style="--wheel-segment-color:${escapeHtml(segment.color)}"></span>
        <span><strong>${escapeHtml(segment.label)}</strong><small>${resultLabel}</small></span>
      </div>
      <div class="wheel-segment-controls" aria-label="Organiser le secteur ${index + 1}">
        <button type="button" title="Monter ce secteur" aria-label="Monter le secteur ${index + 1}" data-wheel-command="segment-up" data-index="${index}" ${index === 0 ? "disabled" : ""}>↑</button>
        <button type="button" title="Descendre ce secteur" aria-label="Descendre le secteur ${index + 1}" data-wheel-command="segment-down" data-index="${index}" ${index === count - 1 ? "disabled" : ""}>↓</button>
        <button type="button" class="danger" title="Supprimer ce secteur" aria-label="Supprimer le secteur ${index + 1}" data-wheel-command="segment-delete" data-index="${index}" ${count <= 2 ? "disabled" : ""}>×</button>
      </div>
    </header>
    <div class="wheel-segment-fields">
      <label class="wheel-segment-label-field">${fieldLabelWithInfo("Texte affiché", OVERLAY_FIELD_HELP.wheelSegmentLabel)}<input name="wheelSegmentLabel" value="${escapeHtml(segment.label)}" maxlength="70" required></label>
      <label class="wheel-color-field">${fieldLabelWithInfo("Couleur", OVERLAY_FIELD_HELP.wheelSegmentColor)}<input name="wheelSegmentColor" type="color" value="${escapeHtml(segment.color)}"></label>
      <label class="wheel-segment-result-field">${fieldLabelWithInfo("Quand ce secteur gagne", OVERLAY_FIELD_HELP.wheelSegmentAction)}<select name="wheelSegmentAction">
        <option value="none" ${segment.action === "none" ? "selected" : ""}>Afficher le résultat uniquement</option>
        <option value="action" ${segment.action === "action" ? "selected" : ""}>Lancer une action ShenPulse</option>
        <option value="spin" ${segment.action === "spin" ? "selected" : ""}>Relancer automatiquement la roue</option>
      </select></label>
      <label class="wheel-segment-action-select">${fieldLabelWithInfo("Action à lancer", OVERLAY_FIELD_HELP.wheelSegmentActionId)}<select name="wheelSegmentActionId">${wheelActionOptions(segment.actionId)}</select></label>
    </div>
  </article>`;
}

function syncWheelSegmentActionVisibility(root = dialogBody) {
  root.querySelectorAll("[data-wheel-segment-row]").forEach((row) => {
    const mode = row.querySelector('[name="wheelSegmentAction"]')?.value;
    const actionField = row.querySelector(".wheel-segment-action-select");
    if (actionField) actionField.hidden = mode !== "action";
  });
}

function collectWheelEditorForm() {
  if (!wheelEditorContext || !dialog.open) return;
  const wheel = wheelEditorContext.config.wheels.find(
    (entry) => entry.id === wheelEditorContext.config.selectedWheelId
  );
  if (!wheel) return;
  const data = new FormData(dialogForm);
  wheel.name = String(data.get("wheelName") || wheel.name).trim() || "Roue sans nom";
  wheel.enabled = data.get("wheelEnabled") === "true";
  wheel.trigger = String(data.get("wheelTrigger") || "").trim();
  wheel.design = data.get("wheelDesign") === "royal" ? "royal" : "classic";
  const settings = wheel.settings;
  for (const key of [
    "font",
    "textOrientation",
    "textColor",
    "textShadowColor",
    "textAlign",
    "pointerPosition",
    "entranceAnimation",
    "exitAnimation"
  ]) {
    if (data.has(key)) settings[key] = data.get(key);
  }
  for (const key of [
    "fontSize",
    "textShadowStrength",
    "textRadius",
    "textSegmentOffset",
    "textBoxWidth",
    "textBoxHeight",
    "textAngleOffset",
    "textMaxLines",
    "lineSpacing",
    "letterSpacing",
    "spinDuration",
    "waitDuration",
    "scale",
    "glow",
    "resultDuration"
  ]) {
    if (data.has(key)) settings[key] = Number(data.get(key));
  }
  for (const key of [
    "textClamp",
    "showBase",
    "soundActive",
    "showWinner",
    "alwaysVisible"
  ]) {
    if (data.has(key)) settings[key] = data.get(key) === "true";
  }
  wheel.segments = [...dialogBody.querySelectorAll("[data-wheel-segment-row]")].map(
    (row) => {
      const actionId =
        row.querySelector('[name="wheelSegmentActionId"]').value;
      const selectedMode =
        row.querySelector('[name="wheelSegmentAction"]').value;
      return {
        id: row.dataset.segmentId || `segment_${cryptoId()}`,
        label: row.querySelector('[name="wheelSegmentLabel"]').value.trim(),
        color: row.querySelector('[name="wheelSegmentColor"]').value,
        action:
          selectedMode === "spin"
            ? "spin"
            : actionId
              ? "action"
              : selectedMode,
        actionId
      };
    }
  ).filter((segment) => segment.label);
}

function openWheelOverlayConfig(item, rawConfig = null) {
  if (!wheelEditorContext || wheelEditorContext.item.key !== item.key || rawConfig) {
    wheelEditorContext = {
      item,
      config: normalizeWheelConfig(rawConfig || overlayConfig(item.key)),
      section: "setup"
    };
  }
  const config = wheelEditorContext.config;
  const wheel = config.wheels.find((entry) => entry.id === config.selectedWheelId)
    || config.wheels[0];
  config.selectedWheelId = wheel.id;
  const settings = wheel.settings;
  const activeSection = ["setup", "segments", "appearance", "playback"].includes(
    wheelEditorContext.section
  )
    ? wheelEditorContext.section
    : "setup";
  const wheelTabs = config.wheels.map((entry) =>
    `<button type="button" class="${entry.id === wheel.id ? "active" : ""}" data-wheel-command="select" data-wheel-id="${escapeHtml(entry.id)}">
      <span class="wheel-list-dot ${entry.enabled ? "enabled" : ""}"></span>
      <span><strong>${escapeHtml(entry.name)}</strong><small>${entry.segments.length} segments · ${entry.design === "royal" ? "Royal" : "Classique"}</small></span>
    </button>`
  ).join("");
  openEditor({
    title: "Configurer la roue d’actions",
    kicker: "OVERLAY OBS · ROUES & SEGMENTS",
    variant: "overlay-live",
    body: `<div class="wheel-config-editor" data-overlay-config-editor="${escapeHtml(item.key)}">
      <aside class="wheel-config-sidebar">
        <div class="wheel-sidebar-intro"><span>COLLECTION</span><strong>Mes roues</strong><small>Choisissez la roue à modifier.</small></div>
        <div class="wheel-config-list">${wheelTabs}</div>
        <button type="button" class="wheel-add-button" data-wheel-command="add">＋ Créer une roue</button>
        <button type="button" class="wheel-delete-button" data-wheel-command="delete" ${config.wheels.length <= 1 ? "disabled" : ""}>Supprimer cette roue</button>
      </aside>
      <div class="wheel-config-main">
        <section class="wheel-config-identity">
          <div>
            <span class="game-step-kicker">ROUE SÉLECTIONNÉE</span>
            <h3>${escapeHtml(wheel.name)}</h3>
            <p>${wheel.segments.length} secteurs · ${wheel.trigger ? `déclenchée par ${escapeHtml(wheel.trigger)}` : "lancement manuel ou via une action"}</p>
          </div>
          <div class="wheel-live-toggle">
            ${fieldLabelWithInfo("État", OVERLAY_FIELD_HELP.wheelEnabled)}
            <select name="wheelEnabled"><option value="true" ${wheel.enabled ? "selected" : ""}>Active</option><option value="false" ${!wheel.enabled ? "selected" : ""}>Désactivée</option></select>
          </div>
        </section>
        <nav class="wheel-editor-steps" aria-label="Étapes de configuration">
          <button type="button" class="${activeSection === "setup" ? "active" : ""}" data-wheel-command="section" data-wheel-section="setup"><b>1</b><span><strong>Configuration</strong><small>Nom, design et cadeau</small></span></button>
          <button type="button" class="${activeSection === "segments" ? "active" : ""}" data-wheel-command="section" data-wheel-section="segments"><b>2</b><span><strong>Secteurs</strong><small>Résultats et actions</small></span></button>
          <button type="button" class="${activeSection === "appearance" ? "active" : ""}" data-wheel-command="section" data-wheel-section="appearance"><b>3</b><span><strong>Apparence</strong><small>Texte et rendu</small></span></button>
          <button type="button" class="${activeSection === "playback" ? "active" : ""}" data-wheel-command="section" data-wheel-section="playback"><b>4</b><span><strong>Diffusion</strong><small>Animation et résultat</small></span></button>
        </nav>
        <div class="wheel-editor-workspace">
          <div class="wheel-editor-panels">
            <section class="wheel-editor-panel" data-wheel-section-panel="setup" ${activeSection === "setup" ? "" : "hidden"}>
              <header class="wheel-panel-heading"><span>ÉTAPE 1</span><h3>Configurer l’essentiel</h3><p>Donnez un nom clair à la roue, choisissez son style puis décidez comment elle sera déclenchée.</p></header>
              <div class="wheel-settings-card form-grid">
                ${overlayField("wheelName", "Nom de la roue", wheel.name, "text", "required full")}
                ${giftPickerField("wheelTrigger", "Cadeau déclencheur", wheel.trigger, "full", OVERLAY_FIELD_HELP.wheelTrigger)}
                <div class="wheel-inline-note full"><strong>Cadeau facultatif</strong><span>Sans cadeau, vous pourrez toujours lancer cette roue depuis une action ou le simulateur.</span></div>
              </div>
              <div class="wheel-settings-card">
                <header><div><h4>Design de la roue</h4><p>L’aperçu réel à droite se met à jour dès votre choix.</p></div></header>
                <div class="wheel-design-options">
                  ${wheelDesignOption("classic", "Orange Classique", "Énergique et lisible pour les actions LIVE.", wheel.design)}
                  ${wheelDesignOption("royal", "Royale Prestige", "Ornements dorés pour les défis et événements.", wheel.design)}
                </div>
              </div>
            </section>
            <section class="wheel-editor-panel" data-wheel-section-panel="segments" ${activeSection === "segments" ? "" : "hidden"}>
              <header class="wheel-panel-heading wheel-panel-heading-with-action"><div><span>ÉTAPE 2</span><h3>Définir les secteurs</h3><p>Chaque secteur affiche un résultat et peut lancer une action ShenPulse.</p></div><button type="button" class="button secondary" data-wheel-command="segment-add">＋ Ajouter un secteur</button></header>
              <div class="wheel-segment-help"><span>${wheel.segments.length}</span><div><strong>secteurs configurés</strong><small>Utilisez les flèches pour définir leur ordre sur la roue.</small></div></div>
              <div class="wheel-segment-list">${wheel.segments.map((segment, index) => wheelSegmentEditor(segment, index, wheel.segments.length)).join("")}</div>
            </section>
            <section class="wheel-editor-panel" data-wheel-section-panel="appearance" ${activeSection === "appearance" ? "" : "hidden"}>
              <header class="wheel-panel-heading"><span>ÉTAPE 3</span><h3>Régler l’apparence</h3><p>Commencez par la lisibilité. Les ajustements fins restent disponibles dans les options avancées.</p></header>
              <div class="wheel-settings-card">
                <header><div><h4>Texte des secteurs</h4><p>Les réglages les plus utiles au quotidien.</p></div></header>
                <div class="form-grid wheel-form-grid-3">
                  ${overlaySelect("font", "Police", settings.font, [["Kalam", "Kalam"], ["Inter", "Inter"], ["Impact", "Impact"], ["Arial Rounded", "Arial Rounded"], ["System", "Système"]])}
                  ${overlayField("fontSize", "Taille", settings.fontSize, "number", 'min="10" max="120"')}
                  ${overlayField("textColor", "Couleur", settings.textColor, "color")}
                  ${overlaySelect("textOrientation", "Orientation", settings.textOrientation, [["horizontal", "Horizontale"], ["vertical", "Verticale"]])}
                  ${overlaySelect("textAlign", "Alignement", settings.textAlign, [["left", "Gauche"], ["center", "Centre"], ["right", "Droite"]])}
                  ${overlaySelect("textClamp", "Limiter le texte", String(settings.textClamp), [["true", "Oui"], ["false", "Non"]])}
                </div>
              </div>
              <div class="wheel-settings-card">
                <header><div><h4>Rendu de la roue</h4><p>Taille, lumière et éléments décoratifs.</p></div></header>
                <div class="form-grid wheel-form-grid-3">
                  ${overlayField("scale", "Échelle globale (%)", settings.scale, "number", 'min="50" max="180"')}
                  ${overlayField("glow", "Intensité lumineuse", settings.glow, "number", 'min="0" max="140"')}
                  ${overlaySelect("showBase", "Afficher le socle", String(settings.showBase), [["true", "Oui"], ["false", "Non"]])}
                  ${overlaySelect("pointerPosition", "Position du pointeur", settings.pointerPosition, [["top", "En haut"], ["right", "À droite"], ["bottom", "En bas"], ["left", "À gauche"]])}
                </div>
              </div>
              <details class="wheel-settings-card wheel-advanced-settings">
                <summary><span><strong>Réglages typographiques avancés</strong><small>Ombre, placement et dimensions du texte.</small></span><b>Afficher</b></summary>
                <div class="form-grid wheel-form-grid-3">
                  ${overlayField("textShadowColor", "Couleur de l’ombre", settings.textShadowColor, "color")}
                  ${overlayField("textShadowStrength", "Force de l’ombre", settings.textShadowStrength, "number", 'min="0" max="100"')}
                  ${overlayField("textRadius", "Rayon du texte (%)", settings.textRadius, "number", 'min="20" max="135"')}
                  ${overlayField("textSegmentOffset", "Décalage dans le secteur", settings.textSegmentOffset, "number", 'min="-100" max="100"')}
                  ${overlayField("textBoxWidth", "Largeur du texte", settings.textBoxWidth, "number", 'min="45" max="260"')}
                  ${overlayField("textBoxHeight", "Hauteur du texte", settings.textBoxHeight, "number", 'min="50" max="320"')}
                  ${overlayField("textAngleOffset", "Correction d’angle", settings.textAngleOffset, "number", 'min="-180" max="180"')}
                  ${overlayField("textMaxLines", "Nombre de lignes", settings.textMaxLines, "number", 'min="1" max="4"')}
                  ${overlayField("lineSpacing", "Interligne (%)", settings.lineSpacing, "number", 'min="0" max="100"')}
                  ${overlayField("letterSpacing", "Espacement lettres (%)", settings.letterSpacing, "number", 'min="0" max="100"')}
                </div>
              </details>
            </section>
            <section class="wheel-editor-panel" data-wheel-section-panel="playback" ${activeSection === "playback" ? "" : "hidden"}>
              <header class="wheel-panel-heading"><span>ÉTAPE 4</span><h3>Préparer la diffusion</h3><p>Contrôlez la durée de la rotation, le son et ce que les spectateurs voient avant et après le résultat.</p></header>
              <div class="wheel-settings-card">
                <header><div><h4>Rotation et son</h4><p>La rotation commence toujours immédiatement.</p></div></header>
                <div class="form-grid wheel-form-grid-3">
                  ${overlaySelect("soundActive", "Son de rotation", String(settings.soundActive), [["true", "Activé"], ["false", "Désactivé"]])}
                  ${overlayField("spinDuration", "Durée de rotation (s)", settings.spinDuration, "number", 'min="1" max="30" step="0.1"')}
                  ${overlayField("waitDuration", "Pause avant résultat (s)", settings.waitDuration, "number", 'min="0" max="15" step="0.1"')}
                </div>
              </div>
              <div class="wheel-settings-card">
                <header><div><h4>Affichage et résultat</h4><p>Choisissez quand la roue apparaît et combien de temps le résultat reste visible.</p></div></header>
                <div class="form-grid wheel-form-grid-3">
                  ${overlaySelect("showWinner", "Afficher le résultat", String(settings.showWinner), [["true", "Oui"], ["false", "Non"]])}
                  ${overlayField("resultDuration", "Durée du résultat (s)", settings.resultDuration, "number", 'min="1" max="30" step="0.1"')}
                  ${overlaySelect("alwaysVisible", "Visible au repos", String(settings.alwaysVisible), [["true", "Oui"], ["false", "Seulement pendant l’action"]])}
                  ${overlaySelect("entranceAnimation", "Animation d’entrée", settings.entranceAnimation, [["zoom", "Zoom"], ["fade", "Fondu"], ["slide", "Glissement"], ["none", "Aucune"]])}
                  ${overlaySelect("exitAnimation", "Animation de sortie", settings.exitAnimation, [["fade", "Fondu"], ["zoom", "Zoom"], ["slide", "Glissement"], ["none", "Aucune"]])}
                </div>
              </div>
            </section>
          </div>
          <aside class="wheel-preview-column">
            ${overlayLivePreview(item, config, { compact: true })}
            <div class="wheel-preview-summary">
              <span><small>Secteurs</small><strong>${wheel.segments.length}</strong></span>
              <span><small>Design</small><strong>${wheel.design === "royal" ? "Royal" : "Classique"}</strong></span>
              <span><small>Déclencheur</small><strong>${wheel.trigger ? escapeHtml(wheel.trigger) : "Manuel"}</strong></span>
            </div>
            <div class="overlay-config-source"><span>Source HTTPS · 800 × 900</span><code>${escapeHtml(overlayUrl(item))}</code><small>OBS local</small><code>${escapeHtml(localOverlayUrl(item))}</code></div>
          </aside>
        </div>
      </div>
    </div>`,
    onSubmit: async () => {
      collectWheelEditorForm();
      const next = wheelEditorContext.config;
      const selected = next.wheels.find((entry) => entry.id === next.selectedWheelId) || next.wheels[0];
      if (selected.segments.length < 2) {
        throw new Error("La roue doit contenir au moins deux segments.");
      }
      next.title = selected.name;
      next.design = selected.design;
      next.choices = selected.segments.map((segment) => segment.label);
      next.colors = selected.segments.map((segment) => segment.color);
      Object.assign(next, selected.settings);
      overlayDesignSelections[item.key] = selected.design;
      await saveOverlayConfig(item.key, next, { rerender: false });
      wheelEditorContext = null;
    }
  });
  syncWheelSegmentActionVisibility();
}

function overlayDraftConfig(item, baseConfig, data = new FormData(dialogForm)) {
  const next = { ...baseConfig };
  const stringKeys = [
    "title",
    "theme",
    "model",
    "design",
    "variant",
    "fit",
    "font",
    "layout",
    "animation",
    "progressLabel",
    "whenReached",
    "completionActionId",
    "incrementShortcut",
    "decrementShortcut",
    "resetShortcut",
    "accentColor",
    "secondaryColor",
    "textColor",
    "backgroundColor",
    "shadowColor",
    "nameColor",
    "scoreColor",
    "rankColor",
    "winCounterLabelColorNegative",
    "winCounterLabelColorNeutral",
    "winCounterLabelColorPositive"
  ];
  const numberKeys = [
    "scale",
    "xOffset",
    "yOffset",
    "backgroundOpacity",
    "fontSize",
    "displayTime",
    "pauseTime",
    "soundVolume",
    "saturation",
    "hue",
    "current",
    "target",
    "goalBaseline",
    "seconds",
    "multiplier",
    "maxRows",
    "minCoins",
    "winCounterLabelOffsetX",
    "winCounterLabelOffsetY",
    "rowOpacity"
  ];
  const booleanKeys = [
    "enabled",
    "showHeader",
    "showGoal",
    "showPercent",
    "showRank",
    "showAvatars",
    "showCrown",
    "showRankBadges",
    "showMetricLabel",
    "showBase",
    "showHours",
    "showShadow",
    "showWhenIdle",
    "soundEnabled",
    "rtl",
    "timerAutoStart",
    "allowNegative",
    "autoplay",
    "loop"
  ];
  for (const key of stringKeys) {
    if (data.has(key)) next[key] = String(data.get(key) || "");
  }
  for (const key of numberKeys) {
    if (data.has(key)) next[key] = Number(data.get(key) || 0);
  }
  for (const key of booleanKeys) {
    if (data.has(key)) next[key] = data.get(key) === "true";
  }
  return next;
}

function overlayLivePreview(item, config, { compact = false } = {}) {
  const size = overlaySourceSize(item);
  const sourceAvailable = Boolean(item.url);
  return `<aside class="overlay-live-preview-panel ${compact ? "compact" : ""}">
    <header>
      <div><span>APERÇU LIVE RÉEL</span><strong>${escapeHtml(item.name)}</strong></div>
      <b>${size.label}</b>
    </header>
    ${overlayRuntimeFrame(item, config, {
      context: "live",
      editable: true,
      loading: "eager"
    })}
    <p>${sourceAvailable
      ? "Le rendu ci-dessus est la vraie source locale. Chaque modification du formulaire y apparaît avant l’enregistrement."
      : "Aperçu local complet de l’overlay Pro. Tous les réglages et designs restent testables ; seule l’URL OBS demeure protégée."}</p>
    <div class="overlay-live-preview-actions">
      <button type="button" class="button primary" data-overlay-preview-test="${escapeHtml(item.key)}">▶ Relancer le test</button>
      ${sourceAvailable
        ? `<button type="button" class="button ghost" data-action="copy" data-value="${escapeHtml(overlayUrl(item, config))}">Copier la source OBS</button>`
        : `<span class="badge warning">URL OBS disponible avec Pro</span>`}
    </div>
  </aside>`;
}

function scheduleOverlayLivePreview() {
  clearTimeout(overlayPreviewRefreshTimer);
  overlayPreviewRefreshTimer = setTimeout(() => {
    const editor = dialogBody.querySelector("[data-overlay-config-editor]");
    const frame = dialogBody.querySelector("[data-overlay-live-preview]");
    if (!editor || !frame) return;
    const item = overlayDefinitions().find(
      (entry) => entry.key === editor.dataset.overlayConfigEditor
    );
    if (!item) return;
    let draft;
    if (item.key === "wheel" && wheelEditorContext) {
      collectWheelEditorForm();
      const selectedWheel = wheelEditorContext.config.wheels.find(
        (entry) => entry.id === wheelEditorContext.config.selectedWheelId
      ) || wheelEditorContext.config.wheels[0];
      draft = {
        ...wheelEditorContext.config,
        title: selectedWheel?.name || wheelEditorContext.config.title
      };
    } else {
      draft = overlayDraftConfig(item, overlayConfig(item.key));
    }
    const previewItem = item.url
      ? item
      : { ...item, url: overlayCatalogPreviewUrl(item) };
    const runtimeUrl = overlayUrl(previewItem, draft);
    let payload = {};
    try {
      payload = Object.fromEntries(new URL(runtimeUrl).searchParams.entries());
    } catch {
      return;
    }
    const message = {
      source: "shenpulse-overlay-card",
      channel: "configuration",
      payload
    };
    const send = () => {
      try {
        frame.contentWindow?.postMessage(message, new URL(frame.src).origin);
      } catch {
        // The dialog may close while the debounced preview is being updated.
      }
    };
    send();
    if (!frame.dataset.overlayPreviewReady) {
      frame.addEventListener("load", send, { once: true });
    }
    const copyButton = dialogBody.querySelector(
      ".overlay-live-preview-actions [data-action='copy']"
    );
    if (copyButton) copyButton.dataset.value = overlayUrl(item, draft);
  }, 45);
}

function openOverlayConfig(item) {
  if (!item) throw new Error("Overlay introuvable.");
  if (item.key === "wheel") {
    wheelEditorContext = null;
    return openWheelOverlayConfig(item, overlayConfig(item.key));
  }
  const config = overlayConfig(item.key);
  const titledOverlays = [
    "myActions",
    "likeGoal",
    "topDonors",
    "topTappers",
    "timer",
    "multiplierTimer",
    "winCounter"
  ];
  const typographyOverlays = titledOverlays;
  const placement = `${overlaySelect("enabled", "Overlay actif", String(config.enabled !== false), [["true", "Oui"], ["false", "Non"]], true)}
    ${overlayField("scale", "Échelle globale (%)", config.scale ?? 100, "number", 'min="50" max="180"')}
    ${overlayField("xOffset", "Position horizontale (px)", config.xOffset ?? 0, "number", 'min="-1000" max="1000"')}
    ${overlayField("yOffset", "Position verticale (px)", config.yOffset ?? 0, "number", 'min="-1000" max="1000"')}`;

  let specialized = "";
  if (item.parameter === "theme") {
    specialized += overlaySelect("theme", "Thème", config.theme || item.defaultOption, item.options, true);
  }
  if (item.parameter === "model") {
    specialized += overlaySelect("model", "Modèle du bocal", config.model || item.defaultOption, item.options, true);
  }
  if (item.parameter === "variant") {
    specialized += overlaySelect("variant", "Vidéo", config.variant || item.defaultOption, item.options, true);
  }
  if (titledOverlays.includes(item.key)) {
    specialized += overlayField("title", "Titre affiché", config.title || item.name, "text", "full");
  }
  if (["likeGoal", "coinJar", "winCounter"].includes(item.key)) {
    specialized += `${overlayField("current", "Valeur de départ hors session", config.current ?? 0, "number", 'min="-999999" max="999999"')}
      ${overlayField("target", "Objectif", config.target ?? 1000, "number", 'min="1" max="999999"')}`;
  }
  if (item.key === "likeGoal") {
    specialized += `${overlayField("goalBaseline", "Départ de la progression", config.goalBaseline ?? 0, "number")}
      ${overlayField("progressLabel", "Unité / libellé de progression", config.progressLabel || "likes", "text")}
      ${overlaySelect("whenReached", "Lorsque l’objectif est atteint", config.whenReached || "increase", [["keep", "Conserver l’objectif"], ["increase", "Augmenter l’objectif"], ["double", "Doubler l’objectif"], ["hide", "Masquer le Like Goal"]])}
      ${overlayActionSelect("completionActionId", "Action à lancer lorsque l’objectif est atteint", config.completionActionId)}
      ${overlaySelect("showPercent", "Afficher le pourcentage", String(config.showPercent !== false), [["true", "Oui"], ["false", "Non"]])}`;
  }
  if (item.key === "coinJar") {
    specialized += `${overlayField("minCoins", "Minimum de pièces conservé", config.minCoins ?? 0, "number", 'min="0"')}
      ${overlaySelect("showBase", "Afficher le niveau de remplissage", String(config.showBase !== false), [["true", "Oui"], ["false", "Non"]], false, "Affiche ou masque la jauge lumineuse située derrière les cadeaux dans le bocal.")}`;
  }
  if (["timer", "multiplierTimer"].includes(item.key)) {
    specialized += `${overlayField("seconds", "Durée initiale (secondes)", config.seconds ?? 300, "number", 'min="0" max="359999" full')}
      ${overlaySelect("timerAutoStart", "Démarrage automatique", String(config.timerAutoStart === true), [["true", "Oui"], ["false", "Non"]])}
      ${overlaySelect("showHours", "Afficher les heures", String(config.showHours !== false), [["true", "Oui"], ["false", "Non"]])}`;
  }
  if (item.key === "timer") {
    specialized += overlayActionSelect(
      "completionActionId",
      "Action à lancer lorsque le timer arrive à zéro",
      config.completionActionId
    );
  }
  if (item.key === "multiplierTimer") {
    specialized += overlayField("multiplier", "Multiplicateur", config.multiplier ?? 2, "number", 'min="2" max="5"');
  }
  if (item.key === "myActions") {
    specialized += overlayField("maxRows", "Nombre de lignes", config.maxRows ?? 5, "number", 'min="1" max="12"');
  }
  if (["topDonors", "topTappers"].includes(item.key)) {
    specialized += `${overlayField("maxRows", "Nombre de places", Math.min(5, config.maxRows ?? 5), "number", 'min="1" max="5"')}
      ${overlaySelect("showRank", "Afficher le rang", String(config.showRank !== false), [["true", "Oui"], ["false", "Non"]])}
      ${overlaySelect("showAvatars", "Afficher les photos de profil", String(config.showAvatars !== false), [["true", "Oui"], ["false", "Non"]])}
      ${overlaySelect("showRankBadges", "Afficher les médailles et cadres", String(config.showRankBadges !== false), [["true", "Oui"], ["false", "Non"]])}
      ${overlaySelect("showCrown", "Couronne sur la première place", String(config.showCrown !== false), [["true", "Oui"], ["false", "Non"]])}
      ${overlaySelect("showMetricLabel", "Afficher les scores", String(config.showMetricLabel !== false), [["true", "Oui"], ["false", "Non"]])}
      ${overlayField("nameColor", "Couleur des noms", config.nameColor || "#ffffff", "color")}
      ${overlayField("scoreColor", "Couleur des scores", config.scoreColor || "#ffe575", "color")}
      ${overlayField("rankColor", "Couleur des rangs", config.rankColor || "#ffe575", "color")}
      ${overlayField("rowOpacity", "Opacité du fond des lignes (%)", config.rowOpacity ?? 68, "number", 'min="0" max="100"')}`;
  }
  if (item.key === "winCounter") {
    specialized += `${overlaySelect("allowNegative", "Autoriser les valeurs négatives", String(config.allowNegative !== false), [["true", "Oui"], ["false", "Non"]])}
      ${overlayField("winCounterLabelColorNegative", "Couleur si négatif", config.winCounterLabelColorNegative || "#ff4f6d", "color")}
      ${overlayField("winCounterLabelColorNeutral", "Couleur à zéro", config.winCounterLabelColorNeutral || "#f8fafc", "color")}
      ${overlayField("winCounterLabelColorPositive", "Couleur si positif", config.winCounterLabelColorPositive || "#31ff74", "color")}
      ${overlayField("winCounterLabelOffsetX", "Position du libellé X", config.winCounterLabelOffsetX ?? 0, "number", 'min="-500" max="500"')}
      ${overlayField("winCounterLabelOffsetY", "Position du libellé Y", config.winCounterLabelOffsetY ?? 0, "number", 'min="-500" max="500"')}`;
  }
  if (item.previewKind === "match") {
    specialized += `${overlaySelect("fit", "Ajustement dans la source 1080 × 1920", config.fit || "contain", [["contain", "Vidéo entière"], ["cover", "Remplir la source"]], true)}
      ${overlaySelect("autoplay", "Lecture automatique", String(config.autoplay !== false), [["true", "Oui"], ["false", "Non"]])}
      ${overlaySelect("loop", "Lecture en boucle", String(config.loop !== false), [["true", "Oui"], ["false", "Non"]])}`;
  }

  const visibility = `${titledOverlays.includes(item.key) ? overlaySelect("showHeader", "Afficher le titre", String(config.showHeader !== false), [["true", "Oui"], ["false", "Non"]]) : ""}
    ${["likeGoal", "winCounter"].includes(item.key) ? overlaySelect("showGoal", "Afficher l’objectif", String(config.showGoal !== false), [["true", "Oui"], ["false", "Non"]]) : ""}
    ${overlaySelect("showWhenIdle", "Visible au repos", String(config.showWhenIdle !== false), [["true", "Oui"], ["false", "Non"]])}
    ${overlaySelect("showShadow", "Afficher l’ombre", String(config.showShadow !== false), [["true", "Oui"], ["false", "Non"]])}
    ${typographyOverlays.includes(item.key) ? overlaySelect("rtl", "Sens de lecture", String(config.rtl === true), [["false", "Gauche vers droite"], ["true", "Droite vers gauche"]]) : ""}`;

  const appearance = `${typographyOverlays.includes(item.key) ? `${overlaySelect("font", "Police", config.font || "Inter", [["Inter", "Inter"], ["Arial", "Arial"], ["Georgia", "Georgia"], ["Impact", "Impact"], ["Verdana", "Verdana"]])}
    ${overlayField("fontSize", "Taille du texte (%)", config.fontSize ?? 100, "number", 'min="50" max="200"')}
    ${overlayField("textColor", "Couleur générale du texte", config.textColor || "#ffffff", "color")}` : ""}
    ${["myActions", "likeGoal", "timer", "multiplierTimer"].includes(item.key) ? overlayField("accentColor", "Couleur principale", config.accentColor || "#22d3ee", "color") : ""}
    ${item.key === "likeGoal" ? overlayField("secondaryColor", "Couleur secondaire", config.secondaryColor || "#ff4f86", "color") : ""}
    ${item.key === "myActions" ? `${overlayField("backgroundColor", "Couleur du panneau", config.backgroundColor || "#111315", "color")}
      ${overlayField("backgroundOpacity", "Opacité du panneau (%)", config.backgroundOpacity ?? 82, "number", 'min="0" max="100"')}` : ""}
    ${overlayField("saturation", "Saturation du rendu (%)", config.saturation ?? 100, "number", 'min="0" max="200"')}
    ${overlayField("hue", "Décalage de teinte (°)", config.hue ?? 0, "number", 'min="-180" max="180"')}`;

  const shortcuts = ["timer", "winCounter"].includes(item.key)
    ? `${overlayField("incrementShortcut", item.key === "timer" ? "Raccourci : ajouter 60 secondes" : "Raccourci : ajouter 1 win", config.incrementShortcut || "Alt+W, Alt+ArrowUp", "text", "full")}
       ${overlayField("decrementShortcut", item.key === "timer" ? "Raccourci : retirer 60 secondes" : "Raccourci : retirer 1 win", config.decrementShortcut || "Alt+S, Alt+ArrowDown", "text", "full")}
       ${overlayField("resetShortcut", "Raccourci de réinitialisation", config.resetShortcut || "Alt+R, Alt+0", "text", "full")}`
    : "";

  openEditor({
    title: `Configurer ${item.name}`,
    kicker: `OVERLAY OBS · ${overlayProfileName().toLocaleUpperCase("fr")}`,
    variant: "overlay-live",
    body: `<div class="overlay-config-live-layout" data-overlay-config-editor="${escapeHtml(item.key)}">
      <div class="overlay-config-fields">
        ${dialogSection("Activation & placement", "La source OBS conserve ses dimensions ; seul le rendu intérieur est déplacé ou redimensionné.", placement, "dialog-section-accent")}
        ${dialogSection("Contenu & design", "Réglages propres à cet overlay et à son design sélectionné.", specialized || `<div class="field full"><small>Aucun réglage spécifique supplémentaire.</small></div>`)}
        ${dialogSection("Lisibilité & couleurs", "Les couleurs et corrections sont appliquées directement au rendu réel.", appearance)}
        ${dialogSection("Éléments visibles", "Chaque option masque ou affiche uniquement l’élément indiqué.", visibility)}
        ${shortcuts ? `<details class="dialog-advanced"><summary>Raccourcis rapides</summary><div class="form-grid">${shortcuts}</div></details>` : ""}
      </div>
      ${overlayLivePreview(item, config)}
    </div>`,
    onSubmit: async (data) => {
      const next = overlayDraftConfig(item, config, data);
      overlayDesignSelections[item.key] = next.theme || next.model || next.variant || "";
      await saveOverlayConfig(item.key, next, { rerender: false });
    }
  });
}

function openOverlayConfigLegacy(item) {
  if (!item) throw new Error("Overlay introuvable.");
  if (item.key === "wheel") {
    wheelEditorContext = null;
    return openWheelOverlayConfig(item, overlayConfig(item.key));
  }
  const config = { ...overlayConfig(item.key) };
  const common = `${field("title", "Titre / libellé", config.title || item.name, "text", "full")}
    ${field("scale", "Échelle (%)", config.scale ?? 100, "number", 'min="50" max="180"')}
    ${field("xOffset", "Position X (px)", config.xOffset ?? 0, "number", 'min="-1000" max="1000"')}
    ${field("yOffset", "Position Y (px)", config.yOffset ?? 0, "number", 'min="-1000" max="1000"')}
    ${field("accentColor", "Couleur accent", config.accentColor || "#22d3ee", "color")}
    ${field("textColor", "Couleur texte", config.textColor || "#ffffff", "color")}`;
  let specialized = "";
  if (item.parameter === "theme") {
    specialized += overlaySelect("theme", "Thème", config.theme || item.defaultOption, item.options, true);
  }
  if (item.parameter === "model") {
    specialized += overlaySelect("model", "Modèle du bocal", config.model || item.defaultOption, item.options, true);
  }
  if (item.parameter === "design") {
    specialized += overlaySelect("design", "Design de la roue", config.design || item.defaultOption, item.options, true);
  }
  if (item.parameter === "variant") {
    specialized += overlaySelect("variant", "Vidéo", config.variant || item.defaultOption, item.options, true);
  }
  if (["likeGoal", "coinJar", "winCounter"].includes(item.key)) {
    specialized += `${field("current", "Valeur actuelle", config.current ?? 0, "number", 'min="-999999" max="999999"')}${field("target", "Objectif", config.target ?? 1000, "number", 'min="1" max="999999"')}`;
  }
  if (["timer", "multiplierTimer"].includes(item.key)) {
    specialized += field("seconds", "Durée initiale (secondes)", config.seconds ?? 300, "number", 'min="0" max="359999" full');
  }
  if (item.key === "multiplierTimer") {
    specialized += field("multiplier", "Multiplicateur", config.multiplier ?? 2, "number", 'min="2" max="5"');
  }
  if (item.key === "myActions") {
    specialized += field("maxRows", "Nombre de lignes", config.maxRows ?? 5, "number", 'min="1" max="12"');
  }
  if (["topDonors", "topTappers"].includes(item.key)) {
    specialized += field("maxRows", "Nombre de places", Math.min(5, config.maxRows ?? 5), "number", 'min="1" max="5"');
  }
  if (item.previewKind === "match") {
    specialized += overlaySelect("fit", "Ajustement dans la source 1080 × 1920", config.fit || "contain", [["contain", "Vidéo entière"], ["cover", "Remplir la source"]], true);
  }
  if (item.key === "wheel") {
    specialized += `<label class="field full"><span>Segments (un par ligne)</span><textarea name="choices" rows="7" required>${escapeHtml((config.choices || []).join("\n"))}</textarea></label>`;
  }
  const toggles = `${overlaySelect("showHeader", "Afficher le titre", String(config.showHeader !== false), [["true", "Oui"], ["false", "Non"]])}
    ${["likeGoal", "coinJar", "timer", "multiplierTimer", "winCounter"].includes(item.key) ? overlaySelect("showGoal", "Afficher l’objectif", String(config.showGoal !== false), [["true", "Oui"], ["false", "Non"]]) : ""}
    ${item.key === "wheel" ? overlaySelect("showBase", "Afficher le socle", String(config.showBase !== false), [["true", "Oui"], ["false", "Non"]]) : ""}`;
  openEditor({
    title: `Configurer ${item.name}`,
    kicker: "OVERLAY OBS · RÉGLAGES PERSISTANTS",
    variant: "wide",
    body: `<div class="action-editor overlay-config-editor">
      ${dialogSection("Placement", "Déplacez et redimensionnez le rendu sans modifier les dimensions de la source OBS.", common, "dialog-section-accent")}
      ${dialogSection("Contenu & design", "Seuls les réglages réellement pris en charge par ce moteur sont proposés.", specialized || `<div class="field full"><small>Aucun réglage spécifique supplémentaire.</small></div>`)}
      ${dialogSection("Affichage", "Affinez les éléments visibles dans la source navigateur.", toggles)}
      <div class="overlay-config-source"><span>Source HTTPS recommandée</span><strong>${item.previewKind === "match" ? "1080 × 1920" : item.previewKind === "leaderboard" || item.previewKind === "coin-jar" ? "520 × 640" : "1920 × 1080"}</strong><code>${escapeHtml(overlayUrl(item))}</code><small>OBS local</small><code>${escapeHtml(localOverlayUrl(item))}</code></div>
    </div>`,
    onSubmit: async (data) => {
      const next = {
        ...config,
        title: data.get("title"),
        scale: Math.min(180, Math.max(50, Number(data.get("scale") || 100))),
        xOffset: Math.min(1000, Math.max(-1000, Number(data.get("xOffset") || 0))),
        yOffset: Math.min(1000, Math.max(-1000, Number(data.get("yOffset") || 0))),
        accentColor: data.get("accentColor"),
        textColor: data.get("textColor")
      };
      for (const key of ["theme", "model", "design", "variant", "fit"]) {
        if (data.has(key)) next[key] = data.get(key);
      }
      for (const key of ["current", "target", "seconds", "multiplier", "maxRows"]) {
        if (data.has(key)) next[key] = Number(data.get(key));
      }
      for (const key of ["showHeader", "showGoal", "showBase"]) {
        if (data.has(key)) next[key] = data.get(key) === "true";
      }
      if (data.has("choices")) {
        next.choices = String(data.get("choices") || "")
          .split(/\r?\n/)
          .map((choice) => choice.trim())
          .filter(Boolean)
          .slice(0, 16);
        if (next.choices.length < 2) throw new Error("La roue doit contenir au moins deux segments.");
      }
      overlayDesignSelections[item.key] = next.theme || next.model || next.design || next.variant || "";
      acceptSnapshot(await api.saveSettings({
        ...snapshot.state.settings,
        overlayConfigs: {
          ...(snapshot.state.settings.overlayConfigs || {}),
          [item.key]: next
        }
      }));
    }
  });
}

function renderMatchOverlayGuide() {
  return `<aside class="match-overlay-guide">
    <header>
      <span aria-hidden="true">OBS</span>
      <div>
        <strong>Comment utiliser ces overlays d’animation de matchs&nbsp;?</strong>
        <p>Ces animations verticales sont prévues pour être déclenchées proprement dans OBS.</p>
      </div>
    </header>
    <ol>
      <li><b>1</b><span>Utilisez <strong>OBS</strong>. Le fonctionnement est dégradé et peu logique dans TikTok LIVE Studio.</span></li>
      <li><b>2</b><span>Copiez l’URL de l’overlay Match que vous souhaitez utiliser.</span></li>
      <li><b>3</b><span>Dans OBS, ajoutez une nouvelle source <strong>«&nbsp;Navigateur&nbsp;»</strong>.</span></li>
      <li class="match-overlay-source-settings">
        <b>4</b>
        <span>
          Dans les paramètres de la source, utilisez&nbsp;:
          <small><strong>URL</strong> · collez l’URL de l’overlay</small>
          <small><strong>Largeur</strong> · 1080 px</small>
          <small><strong>Hauteur</strong> · 1920 px</small>
          <small>Cochez <strong>«&nbsp;Désactiver la source quand elle n’est pas visible&nbsp;»</strong></small>
          <small>Cochez <strong>«&nbsp;Rafraîchir le navigateur lorsque la scène devient active&nbsp;»</strong></small>
        </span>
      </li>
    </ol>
  </aside>`;
}

function renderOverlaysV2() {
  const query = overlaySearch.trim().toLowerCase();
  const accessibleItems = overlayDefinitions().filter(canAccessOverlay);
  const catalogItems = accessibleItems.filter((item) => !item.catalogHidden);
  const categoryDefinitions = [
    ["counters", "Compteurs", "◎"],
    ["rankings", "Classements", "♛"],
    ["interactions", "Interactions", "✦"],
    ["actions", "Actions", "⚡"],
    ["events", "Événements", "◌"],
    ["points", "Points", "★"],
    ["likes", "Likes", "♥"],
    ["gifts", "Cadeaux", "♢"],
    ["games", "Jeux", "◇"],
    ["music", "Musique", "♫"],
    ["seasonal", "Saisonnier", "❄"],
    ["tools", "Outils", "⌁"],
    ["matches", "Matchs", "VS"]
  ];
  const availableCategoryIds = new Set(catalogItems.map((item) => item.category));
  const categories = categoryDefinitions.filter(([id]) => availableCategoryIds.has(id));
  if (overlayCategory !== "all" && !availableCategoryIds.has(overlayCategory)) {
    overlayCategory = "all";
  }
  const items = catalogItems.filter((item) => {
    const matchesCategory =
      overlayCategory === "all" || item.category === overlayCategory;
    const optionLabels = item.options?.flat().join(" ") || "";
    const matchesSearch = !query || `${item.name} ${item.description} ${optionLabels}`.toLowerCase().includes(query);
    return matchesCategory && matchesSearch;
  });
  const sections = categories
    .map(([id, label, icon]) => ({
      id,
      label,
      icon,
      items: items.filter((item) => item.category === id)
    }))
    .filter((section) => section.items.length);
  const relay = snapshot.publicOverlayRelay || {};
  const relayStatus = relay.connected
    ? ["success", "CONNECTÉ", "Les URL HTTPS reçoivent les événements en temps réel."]
    : relay.status === "connecting"
      ? ["cyan", "CONNEXION", "Initialisation sécurisée du relais cloud…"]
      : ["warning", "HORS LIGNE", "Les URL restent stables et se reconnecteront automatiquement."];
  return `
    <div class="reference-page overlay-catalog-page">
      <section class="page-hero">
        <div><span class="hero-chip">GALERIE OVERLAYS</span><h2>Overlays & widgets</h2><p>Les overlays ShenPulse classés comme dans ShenazenOverlay, avec leurs réglages persistants.</p></div>
        <span class="hero-count">${catalogItems.length}</span>
      </section>
      ${isAccountAuthenticated() ? `<section class="card public-overlay-relay-card">
        <header class="card-header">
          <div>
            <p class="eyebrow">RELAIS PUBLIC SHENPULSE</p>
            <h3>Sources HTTPS pour TikTok LIVE Studio</h3>
            <p>${relayStatus[2]} OBS peut aussi continuer d’utiliser le serveur local.</p>
          </div>
          <div class="button-row">
            <span class="badge ${relayStatus[0]}">${relayStatus[1]}</span>
            <button class="button small ghost" data-action="rotate-public-overlay-urls">Régénérer les URL</button>
          </div>
        </header>
      </section>` : ""}
      <section class="catalog-toolbar overlay-toolbar">
        <label class="search-control"><span>⌕</span><input data-search="overlays" type="search" value="${escapeHtml(overlaySearch)}" placeholder="Rechercher un overlay, un compteur ou un timer"></label>
        <div class="filter-pills">
          <button class="${overlayCategory === "all" ? "active" : ""}" data-action="set-overlay-category" data-value="all">Tous</button>
          ${categories.map(([id, label]) => `<button class="${overlayCategory === id ? "active" : ""}" data-action="set-overlay-category" data-value="${id}">${label}</button>`).join("")}
        </div>
      </section>
      <div class="overlay-section-stack">
        ${sections.map((section) => `<section class="overlay-category-section" data-overlay-category="${escapeHtml(section.id)}">
          <header class="overlay-category-heading">
            <span aria-hidden="true">${section.icon}</span>
            <h3>${escapeHtml(section.label)}</h3>
            <small>${section.items.length} overlay${section.items.length > 1 ? "s" : ""}</small>
          </header>
          ${section.id === "matches" ? renderMatchOverlayGuide() : ""}
          <div class="overlay-catalog-grid">${section.items.map((item) => renderOverlayCard(item)).join("")}</div>
        </section>`).join("")}
      </div>
      ${items.length ? "" : emptyInline("Aucun overlay ne correspond à ces filtres.")}
    </div>`;
}

function renderSounds() {
  const query = normalizeCatalogSearch(soundSearch);
  const audioRows = soundActionRows().filter(({ rule, action }) =>
    action.type === "audio.play" &&
    (!query || normalizeCatalogSearch(`${rule.name} ${triggerLabel(rule)} ${actionDescription(action)}`).includes(query))
  );
  const ttsRows = soundActionRows().filter(({ rule, action }) =>
    action.type === "tts.speak" &&
    (!query || normalizeCatalogSearch(`${rule.name} ${triggerLabel(rule)} ${actionDescription(action)}`).includes(query))
  );
  return `
    <div class="reference-page sounds-page">
      <section class="page-hero compact">
        <div><span class="hero-chip">ATELIER AUDIO</span><h2>Sons & voix</h2><p>Associez une alerte sonore ou une voix à chaque déclencheur, puis vérifiez le rendu en direct.</p></div>
        <label class="search-control"><span>⌕</span><input data-search="sounds" type="search" value="${escapeHtml(soundSearch)}" placeholder="Rechercher un son ou une règle"></label>
      </section>
      <section class="studio-panel audio-panel panel-violet">
        <header class="studio-panel-heading">
          <div><span class="panel-accent"></span><div><h3>Jouer des sons</h3><p>Bibliothèque locale incluse, déclencheurs, raccourcis et volume.</p></div></div>
          <div class="button-row">
            ${canAccessFeature("backblaze.sounds") ? '<button class="button" data-action="upload-sound">↑ Ajouter un son personnalisé</button>' : ""}
            <button class="button primary" data-action="add-sound">＋ Créer une alerte sonore</button>
          </div>
        </header>
        <div class="data-table-wrap">
          <table class="data-table sounds-data-table">
            <thead><tr><th>OUTILS</th><th>ACTIF</th><th>DÉCLENCHEUR</th><th>SON</th><th>VOLUME</th><th>NOM</th></tr></thead>
            <tbody>${audioRows.length ? audioRows.map(({ rule, action, actionIndex }) => `
              <tr>
                <td class="table-tools"><button title="Écouter" data-action="test-action" data-rule="${escapeHtml(rule.id)}" data-id="${escapeHtml(action.id || "")}" data-index="${actionIndex}">▶</button><button title="Modifier" data-action="edit-sound" data-rule="${escapeHtml(rule.id)}" data-id="${escapeHtml(action.id || "")}" data-index="${actionIndex}">✎</button><button title="Supprimer" data-action="delete-action" data-rule="${escapeHtml(rule.id)}" data-id="${escapeHtml(action.id || "")}" data-index="${actionIndex}">×</button></td>
                <td><label class="switch"><input type="checkbox" data-action="toggle-rule" data-id="${escapeHtml(rule.id)}" ${rule.enabled ? "checked" : ""}><span></span></label></td>
                <td>${triggerPill(rule)}</td>
                <td><span class="sound-name"><span>♫</span>${escapeHtml(actionDescription(action))}</span></td>
                <td><input class="volume-slider" type="range" min="0" max="1" step="0.05" value="${escapeHtml(action.config?.volume ?? 1)}" data-action="set-sound-volume" data-rule="${escapeHtml(rule.id)}" data-id="${escapeHtml(action.id || "")}" data-index="${actionIndex}"></td>
                <td><strong>${escapeHtml(rule.name)}</strong></td>
              </tr>`).join("") : `<tr><td colspan="6">${emptyInline("Aucune alerte sonore. Créez votre première règle audio.")}</td></tr>`}</tbody>
          </table>
        </div>
      </section>
      <section class="studio-panel audio-panel panel-cyan" ${canAccessFeature("tts.voices") && canAccessActionType("tts.speak") ? "" : "hidden"}>
        <header class="studio-panel-heading"><div><span class="panel-accent"></span><div><h3>Synthèse vocale</h3><p>Chaque commentaire du chat peut être lu avec la voix Windows de votre choix.</p></div></div><div class="button-row"><button class="button" data-action="preview-tts">Tester la voix</button><button class="button primary" data-action="add-tts">＋ Ajouter une règle TTS</button></div></header>
        <div class="data-table-wrap">
          <table class="data-table">
            <thead><tr><th>OUTILS</th><th>ACTIF</th><th>TEXTE</th><th>VOIX</th><th>VOLUME</th></tr></thead>
            <tbody>${ttsRows.map(({ rule, action, actionIndex }) => `
              <tr>
                <td class="table-tools"><button data-action="test-action" data-rule="${escapeHtml(rule.id)}" data-id="${escapeHtml(action.id || "")}" data-index="${actionIndex}">▶</button><button data-action="edit-tts" data-rule="${escapeHtml(rule.id)}" data-id="${escapeHtml(action.id || "")}" data-index="${actionIndex}">✎</button><button data-action="delete-action" data-rule="${escapeHtml(rule.id)}" data-id="${escapeHtml(action.id || "")}" data-index="${actionIndex}">×</button></td>
                <td><label class="switch"><input type="checkbox" data-action="toggle-rule" data-id="${escapeHtml(rule.id)}" ${rule.enabled ? "checked" : ""}><span></span></label></td>
                <td>Commentaire du chat</td><td>${escapeHtml(action.config?.voice || snapshot.state.settings.tts.voice || "Voix Windows par défaut")}</td><td>${Math.round(Number(action.config?.volume ?? snapshot.state.settings.tts.volume) * 100)}%</td>
              </tr>`).join("") || `<tr><td colspan="5">${emptyInline("Aucune règle de synthèse vocale.")}</td></tr>`}</tbody>
          </table>
        </div>
      </section>
      <section class="studio-panel spotify-panel ${spotifyStatus.connected ? "is-connected" : ""}" ${canAccessFeature("spotify.playback") && canAccessActionType("spotify.queue") ? "" : "hidden"}>
        <header class="studio-panel-heading">
          <div><span class="spotify-mark">●</span><div><h3>Spotify en direct</h3><p>Contrôlez la musique et ajoutez des titres depuis les interactions du live.</p></div></div>
          <div class="button-row">
            ${spotifyStatus.connected ? `<button class="button" data-action="spotify-refresh">↻ Actualiser</button><button class="button danger" data-action="spotify-disconnect">Déconnecter</button>` : `<button class="button spotify-connect-button" data-action="spotify-connect">Connecter Spotify</button>`}
          </div>
        </header>
        <div class="spotify-summary">
          <article><span>COMPTE</span><strong>${escapeHtml(spotifyStatus.account?.displayName || spotifyStatus.account?.email || "Non connecté")}</strong><small>${spotifyStatus.connected ? "Compte autorisé" : spotifyStatus.configured ? "Prêt pour la connexion" : "Client ID à renseigner dans Paramètres"}</small></article>
          <article><span>APPAREIL</span><strong>${escapeHtml(spotifyStatus.activeDevice?.name || "Aucun appareil actif")}</strong><small>${escapeHtml(spotifyStatus.activeDevice?.type || "Ouvrez Spotify et lancez une musique")}</small></article>
          <article><span>EN COURS</span><strong>${escapeHtml(spotifyTrackLabel(spotifyStatus.playback?.item) || "Aucun titre")}</strong><small>${spotifyStatus.playback?.isPlaying ? "Lecture en cours" : "En pause"}</small></article>
        </div>
        <div class="spotify-controls">
          <button class="button" data-action="spotify-control" data-operation="play" ${spotifyStatus.connected ? "" : "disabled"}>▶ Lecture</button>
          <button class="button" data-action="spotify-control" data-operation="pause" ${spotifyStatus.connected ? "" : "disabled"}>Ⅱ Pause</button>
          <button class="button" data-action="spotify-control" data-operation="next" ${spotifyStatus.connected ? "" : "disabled"}>≫ Suivant</button>
          <span>Les actions Spotify des déclencheurs utilisent cette connexion globale.</span>
        </div>
      </section>
    </div>`;
}

function renderTimersPanel() {
  const timers = scheduledTimers();
  const actionRows = flattenActions();
  const actionById = new Map(
    actionRows.map((row) => [row.action.id, row])
  );
  const runtimeById = new Map(
    (snapshot.timerRuntime || []).map((entry) => [entry.id, entry])
  );
  return `
    <div class="timers-page actions-timers-panel">
      <section class="studio-panel panel-violet">
        <header class="studio-panel-heading">
          <div><span class="panel-accent"></span><div><h3>Timers d’actions</h3><p>Exécutez automatiquement une ou plusieurs actions toutes les X secondes, minutes ou heures.</p></div></div>
          <button class="button primary" data-action="add-timer">＋ Créer un timer</button>
        </header>
      </section>
      <section class="timer-scheduler-summary">
        <article><span>PLANIFICATEURS</span><strong>${timers.length}</strong><small>Propres au profil actif</small></article>
        <article><span>ACTIFS</span><strong>${timers.filter((timer) => timer.enabled !== false).length}</strong><small>Armés tant que ShenPulse est ouvert</small></article>
        <article><span>ACTIONS DISPONIBLES</span><strong>${actionRows.length}</strong><small>Sélection multiple autorisée</small></article>
      </section>
      <section class="studio-panel panel-cyan">
        <header class="studio-panel-heading">
          <div><span class="panel-accent"></span><div><h3>Planification</h3><p>Chaque passage exécute les actions cochées dans l’ordre, puis répète le cycle si demandé.</p></div></div>
          <span class="count-pill">${timers.length}</span>
        </header>
        <div class="data-table-wrap">
          <table class="data-table timers-data-table">
            <thead><tr><th>OUTILS</th><th>ACTIF</th><th>NOM</th><th>FRÉQUENCE</th><th>RÉPÉTITIONS</th><th>ACTIONS</th><th>PROCHAINE EXÉCUTION</th></tr></thead>
            <tbody>${timers.length ? timers.map((timer) => {
              const runtime = runtimeById.get(timer.id);
              const selectedRows = (timer.actionIds || [])
                .map((actionId) => actionById.get(actionId))
                .filter(Boolean);
              return `
              <tr>
                <td class="table-tools">
                  <button title="Exécuter maintenant" data-action="test-timer" data-id="${escapeHtml(timer.id)}">▶</button>
                  <button title="Modifier" data-action="edit-timer" data-id="${escapeHtml(timer.id)}">✎</button>
                  <button title="Supprimer" data-action="delete-entity" data-collection="timers" data-id="${escapeHtml(timer.id)}">×</button>
                </td>
                <td><label class="switch"><input type="checkbox" data-action="toggle-timer" data-id="${escapeHtml(timer.id)}" ${timer.enabled !== false ? "checked" : ""}><span></span></label></td>
                <td><strong>${escapeHtml(timer.name)}</strong><small class="table-subline">${timer.lastRunAt ? `Dernière : ${escapeHtml(formatTime(timer.lastRunAt))}` : "Jamais exécuté"}</small></td>
                <td><span class="timer-frequency-pill">${escapeHtml(timerIntervalLabel(timer.intervalMs))}</span></td>
                <td><strong>× ${Math.max(1, Number(timer.repeatCount || 1))}</strong><small class="table-subline">${Number(timer.repeatDelayMs || 0) > 0 ? `${formatIntervalDuration(timer.repeatDelayMs)} entre chaque passage` : "à la suite"}</small></td>
                <td><div class="timer-action-chips">${selectedRows.length ? selectedRows.map(({ rule, action }) => `<span title="${escapeHtml(actionTypeLabel(action.type))}">${escapeHtml(rule.name)}</span>`).join("") : `<em>Action manquante</em>`}</div></td>
                <td>${timer.enabled === false ? `<span class="badge">DÉSACTIVÉ</span>` : runtime?.running ? `<span class="badge success">EN COURS</span>` : runtime?.nextRunAt ? `<strong>${escapeHtml(formatTime(runtime.nextRunAt))}</strong>` : `<span class="badge">ARMEMENT…</span>`}</td>
              </tr>`;
            }).join("") : `<tr><td colspan="7">${emptyInline("Aucun timer. Créez-en un puis sélectionnez les actions à exécuter.")}</td></tr>`}</tbody>
          </table>
        </div>
      </section>
    </div>`;
}

function timerIntervalLabel(intervalMs) {
  const value = Math.max(1000, Number(intervalMs) || 60000);
  if (value % 3600000 === 0) {
    const hours = value / 3600000;
    return `Toutes les ${hours} heure${hours > 1 ? "s" : ""}`;
  }
  if (value % 60000 === 0) {
    const minutes = value / 60000;
    return `Toutes les ${minutes} minute${minutes > 1 ? "s" : ""}`;
  }
  const seconds = value / 1000;
  return `Toutes les ${seconds} seconde${seconds > 1 ? "s" : ""}`;
}

function formatIntervalDuration(milliseconds) {
  const seconds = Math.max(0, Number(milliseconds) || 0) / 1000;
  return seconds < 1 ? `${Math.round(seconds * 1000)} ms` : `${seconds} s`;
}

function timerOperationLabel(operation = "add") {
  return {
    add: "Ajouter / retirer",
    set: "Définir",
    pause: "Pause",
    resume: "Reprendre",
    reset: "Réinitialiser"
  }[operation] || operation;
}

function gameAccessGroup(pack) {
  return pack.accessMode === "purchase" ? "purchase" : "included";
}

function currentSubscription() {
  return snapshot.state.commerce?.subscription || {
    tier: "free",
    source: "free",
    status: "free",
    priceMonthly: 0
  };
}

function commerceExpiryMs(entry) {
  const numeric = Number(entry?.expiresAtMs || 0);
  if (numeric > 0) return numeric;
  const parsed = Date.parse(
    String(entry?.expiresAt || entry?.renewalDate || "")
  );
  return Number.isFinite(parsed) ? parsed : 0;
}

function hasProAccess() {
  const subscription = currentSubscription();
  if (!["pro", "premium"].includes(subscription.tier)) return false;
  if (
    subscription.source === "trial" ||
    subscription.status === "trial"
  ) {
    return (
      ["active", "trial"].includes(subscription.status) &&
      commerceExpiryMs(subscription) > Date.now()
    );
  }
  return ["active", "paid"].includes(subscription.status);
}

function hasActivePaidPremium() {
  const subscription = currentSubscription();
  return (
    subscription.tier === "premium" &&
    ["active", "paid"].includes(String(subscription.status || "")) &&
    subscription.source !== "trial"
  );
}

function gameEntitlement(pack) {
  if (pack.accessMode === "included") {
    return { gameId: pack.id, source: "included", status: "active" };
  }
  return (snapshot.state.commerce?.gameEntitlements || []).find((entry) => {
    if (typeof entry === "string") return entry === pack.id;
    if (!entry || entry.gameId !== pack.id) return false;
    if (["expired", "revoked"].includes(entry.status)) return false;
    if (entry.source === "trial" || entry.status === "trial") {
      return commerceExpiryMs(entry) > Date.now();
    }
    return true;
  });
}

function hasGameEntitlement(pack) {
  return Boolean(gameEntitlement(pack));
}

function isGameUnlocked(pack) {
  return hasProAccess() && hasGameEntitlement(pack);
}

function gameArtwork(pack) {
  if (pack.artworkUrl) return pack.artworkUrl;
  if (pack.artwork) return `assets/games/${pack.artwork}`;
  return "assets/brand/shenpulse-512.png";
}

function gamePrice(pack) {
  if (pack.accessMode === "included") return "Inclus avec abonnement";
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: pack.currency || "EUR"
  }).format(Number(pack.price || 0));
}

function gameAccessLabel(pack) {
  if (!hasProAccess()) return "ABONNEMENT REQUIS";
  if (!hasGameEntitlement(pack)) return "ACHAT REQUIS";
  const entitlement = gameEntitlement(pack);
  if (
    entitlement?.source === "trial" ||
    entitlement?.status === "trial"
  ) {
    return "ESSAI ACTIF";
  }
  return pack.accessMode === "included"
    ? "INCLUS AVEC ABONNEMENT"
    : "ACHETÉ";
}

function gameAccessReason(pack) {
  const missingGame = !hasGameEntitlement(pack);
  const missingSubscription = !hasProAccess();
  if (missingGame && missingSubscription) {
    return "Un abonnement ShenPulse Pro ou Premium actif et le droit d’accès à ce jeu (achat ou essai) sont requis.";
  }
  if (missingGame) {
    return "Votre abonnement est actif. Achetez ce jeu ou activez un essai de jeu pour y accéder.";
  }
  return "Activez un abonnement ShenPulse Pro ou Premium pour entrer dans ce jeu.";
}

function requireGameAccess(pack) {
  if (pack && isGameUnlocked(pack)) return true;
  toast(
    "Abonnement ShenPulse requis",
    pack
      ? gameAccessReason(pack)
      : "Un abonnement ShenPulse Pro ou Premium actif est requis pour accéder aux jeux.",
    true
  );
  return false;
}

function renderGamesCatalogLegacy() {
  if (!["all", "included", "purchase"].includes(gameFilter)) {
    gameFilter = "all";
  }
  const query = gameSearch.trim().toLowerCase();
  const packs = snapshot.packs.filter((pack) => {
    const matchesSearch = !query || `${pack.name} ${pack.description} ${(pack.tags || []).join(" ")}`.toLowerCase().includes(query);
    const matchesFilter = gameFilter === "all" || gameAccessGroup(pack) === gameFilter;
    return matchesSearch && matchesFilter;
  });
  const selected = snapshot.packs.find((pack) => pack.id === (selectedGameId || snapshot.state.session.activeGamePackId)) || snapshot.packs[0];
  const selectedUnlocked = isGameUnlocked(selected);
  return `
    <div class="reference-page games-gallery-page">
      <section class="page-hero compact games-heading">
        <div><span class="hero-chip">JEUX INTERACTIFS</span><h2>Galerie des jeux</h2><p>Choisissez un pack, configurez sa passerelle et testez chaque effet avant le live.</p></div>
        <span class="hero-count">${snapshot.packs.length}</span>
      </section>
      <section class="catalog-toolbar games-toolbar">
        <label class="search-control"><span>⌕</span><input data-search="games" type="search" value="${escapeHtml(gameSearch)}" placeholder="Rechercher un jeu, un connecteur ou un effet"></label>
        <div class="filter-pills"><button class="${gameFilter === "all" ? "active" : ""}" data-action="set-game-filter" data-value="all">Tous</button><button class="${gameFilter === "included" ? "active" : ""}" data-action="set-game-filter" data-value="included">Inclus avec abonnement</button><button class="${gameFilter === "purchase" ? "active" : ""}" data-action="set-game-filter" data-value="purchase">Achat + abonnement</button></div>
        <span class="result-count">${packs.length} résultat${packs.length > 1 ? "s" : ""}</span>
      </section>
      <section class="games-tile-grid">
        ${packs.map((pack) => `
          <article class="game-gallery-tile ${selected.id === pack.id ? "selected" : ""} ${isGameUnlocked(pack) ? "" : "locked"}" data-action="select-game" data-id="${escapeHtml(pack.id)}">
            <div class="game-tile-art" style="background-image:linear-gradient(180deg,transparent,rgba(5,7,13,.25)),url('${escapeHtml(gameArtwork(pack))}')"></div>
            <span class="tile-status ${isGameUnlocked(pack) ? "unlocked" : "locked"}">${isGameUnlocked(pack) ? "✓ " : "🔒 "}${escapeHtml(gameAccessLabel(pack))}</span>
            <div class="tile-caption"><span>${escapeHtml(pack.source || pack.connector.type)}</span><h3>${escapeHtml(pack.name)}</h3><small>${pack.effects.length} interactions · ${escapeHtml(gamePrice(pack))}</small></div>
            <button class="tile-action-button" data-action="select-game" data-id="${escapeHtml(pack.id)}">Ouvrir</button>
          </article>`).join("")}
      </section>
      ${packs.length ? "" : emptyInline("Aucun jeu ne correspond à ces filtres.")}
      <section class="studio-panel game-detail panel-violet">
        <header class="game-detail-heading">
          <img src="${escapeHtml(gameArtwork(selected))}" alt="">
          <div><span>${escapeHtml(selected.publisher)} · ${escapeHtml(selected.version)}</span><h2>${escapeHtml(selected.name)}</h2><p>${escapeHtml(selected.description)}</p><div class="entity-meta">${(selected.tags || []).map((tag) => `<span class="badge">${escapeHtml(tag)}</span>`).join("")}<span class="badge cyan">${escapeHtml(selected.connector.type)}</span><span class="badge ${selectedUnlocked ? "success" : ""}">${escapeHtml(gameAccessLabel(selected))}</span></div></div>
          <div>${selectedUnlocked ? `<button class="button" data-action="configure-game" data-id="${escapeHtml(selected.id)}">Configurer</button><button class="button primary" data-action="test-game" data-id="${escapeHtml(selected.id)}">Tester la passerelle</button>` : `<button class="button primary" data-navigate="membership">Voir les accès</button><button class="button" data-action="open-url" data-value="https://shenpulse.leuridan.fr">Gérer sur le web</button>`}</div>
        </header>
        <div class="effect-grid game-effects-grid">${selected.effects.map((effect) => `<article class="effect-card ${effect.available === false ? "effect-unavailable" : ""}">${effect.image ? `<img class="effect-image" src="${escapeHtml(effect.image)}" alt="">` : `<span class="effect-icon">${escapeHtml(effect.icon || "◇")}</span>`}<div><h4>${escapeHtml(effect.name)}</h4><p>${escapeHtml(effect.description)}</p><small>${escapeHtml(effect.category || "Effet")} · ${effect.available === false ? "RÉFÉRENCE" : "NATIF"}</small></div><button class="button small" data-action="trigger-effect" data-id="${escapeHtml(effect.id)}" ${selectedUnlocked && effect.available !== false ? "" : "disabled"}>${effect.available === false ? "Non exécutable" : "Déclencher"}</button></article>`).join("")}</div>
      </section>
    </div>`;
}

function renderGamesV2() {
  const availablePacks = visibleGamePacks();
  if (!["all", "included", "purchase"].includes(gameFilter)) {
    gameFilter = "all";
  }
  if (gamePageMode === "detail") {
    const selected = (snapshot?.packs || []).find(
      (pack) => pack.id === selectedGameId && canAccessGame(pack)
    );
    if (selected && isGameUnlocked(selected)) {
      return renderGameWorkspace(selected);
    }
    gamePageMode = "catalog";
  }
  const query = gameSearch.trim().toLocaleLowerCase();
  const packs = availablePacks.filter((pack) => {
    const effects = (pack.effects || []).map((effect) => effect.name).join(" ");
    const matchesSearch =
      !query ||
      `${pack.name} ${pack.description} ${(pack.tags || []).join(" ")} ${effects}`
        .toLocaleLowerCase()
        .includes(query);
    const matchesFilter =
      gameFilter === "all" || gameAccessGroup(pack) === gameFilter;
    return matchesSearch && matchesFilter;
  });
  return `
    <div class="reference-page games-gallery-page">
      <section class="page-hero compact games-heading">
        <div><span class="hero-chip">JEUX INTERACTIFS</span><h2>Galerie des jeux</h2><p>Parcourez tous les jeux disponibles. Un abonnement ShenPulse actif est requis pour entrer dans un jeu.</p></div>
        <span class="hero-count">${availablePacks.length}</span>
      </section>
      ${hasProAccess() ? "" : `<section class="game-access-warning game-catalog-access-warning"><span aria-hidden="true">🔒</span><div><strong>Le catalogue reste accessible</strong><p>Vous pouvez consulter tous les jeux. Activez un abonnement Pro ou Premium pour ouvrir un jeu, l’installer, le configurer et lancer ses interactions.</p></div><button class="button primary" data-navigate="membership">Voir les abonnements</button></section>`}
      <section class="catalog-toolbar games-toolbar">
        <label class="search-control"><span>⌕</span><input data-search="games" type="search" value="${escapeHtml(gameSearch)}" placeholder="Rechercher un jeu, un connecteur ou un effet"></label>
        <div class="filter-pills"><button class="${gameFilter === "all" ? "active" : ""}" data-action="set-game-filter" data-value="all">Tous</button><button class="${gameFilter === "included" ? "active" : ""}" data-action="set-game-filter" data-value="included">Inclus avec abonnement</button><button class="${gameFilter === "purchase" ? "active" : ""}" data-action="set-game-filter" data-value="purchase">Achat + abonnement</button></div>
        <span class="result-count">${packs.length} résultat${packs.length > 1 ? "s" : ""}</span>
      </section>
      <section class="games-tile-grid">
        ${packs.map((pack) => `
          <article class="game-gallery-tile ${isGameUnlocked(pack) ? "" : "locked"}" data-action="open-game" data-id="${escapeHtml(pack.id)}" tabindex="0">
            <div class="game-tile-art" style="background-image:linear-gradient(180deg,transparent,rgba(5,7,13,.25)),url('${escapeHtml(gameArtwork(pack))}')"></div>
            <span class="tile-status ${isGameUnlocked(pack) ? "unlocked" : "locked"}">${isGameUnlocked(pack) ? "✓ " : "🔒 "}${escapeHtml(gameAccessLabel(pack))}</span>
            <div class="tile-caption"><span>${escapeHtml(pack.source || pack.connector.type)}</span><h3>${escapeHtml(pack.name)}</h3><small>${pack.modeSelector ? `${pack.modes.length} modes · ${pack.effects.length} interactions` : `${pack.effects.length} interactions · ${gamePrice(pack)}`}</small></div>
            <button class="tile-action-button" data-action="open-game" data-id="${escapeHtml(pack.id)}" aria-disabled="${String(!isGameUnlocked(pack))}">${isGameUnlocked(pack) ? (pack.modeSelector ? "Choisir le mode" : "Entrer dans le jeu") : "Accès requis"}</button>
          </article>`).join("")}
      </section>
      ${packs.length ? "" : emptyInline("Aucun jeu ne correspond à ces filtres.")}
    </div>`;
}

function openMinecraftModeSelector(launcher) {
  const modes = launcher?.modes || [];
  if (!modes.length) {
    return toast(
      "Minecraft indisponible",
      "Aucun mode Minecraft n’est actuellement visible.",
      true
    );
  }
  openEditor({
    title: "Choisir un mode Minecraft",
    kicker: "MINECRAFT · BEDROCK BOX OU SANDBOX",
    variant: "minecraft-modes",
    body: `<div class="minecraft-mode-picker">
      <header>
        <span>2 EXPÉRIENCES COMPLÈTES</span>
        <h3>Dans quel mode voulez-vous jouer ?</h3>
        <p>Chaque mode conserve sa propre installation, ses réglages et son catalogue d’interactions TikTok LIVE.</p>
      </header>
      <div class="minecraft-mode-grid">
        ${modes.map((mode) => `
          <button type="button" class="minecraft-mode-card" data-action="open-minecraft-mode" data-id="${escapeHtml(mode.id)}">
            <img src="${escapeHtml(gameArtwork(mode))}" alt="" loading="eager">
            <span>
              <small>${escapeHtml(mode.id === "minecraft-bedrock-box" ? "SURVIE VERTICALE" : "PLATEFORME DE SABLE")}</small>
              <strong>${escapeHtml(mode.name)}</strong>
              <b>${mode.effects.length} interactions récupérées</b>
              <em>Ouvrir ce mode →</em>
            </span>
          </button>`).join("")}
      </div>
    </div>`,
    onSubmit: null
  });
}

async function enterGameWorkspace(pack) {
  selectedGameId = pack.id;
  gamePageMode = "detail";
  gameWorkspaceStep = "installation";
  gameEffectSearch = "";
  gameEffectCategory = "all";
  await api.selectGame(pack.id);
  snapshot = await api.getSnapshot();
  render();
  content.scrollTop = 0;
}

function renderGameWorkspace(pack) {
  const unlocked = isGameUnlocked(pack);
  const guide = pack.guide || {};
  const mappedEffects = gameMappedEffects(pack);
  const steps = gameJourneyFor(pack);
  if (!steps.some((step) => step.id === gameWorkspaceStep)) {
    gameWorkspaceStep = steps[0]?.id || "installation";
  }
  return `<div class="reference-page game-workspace-page">
    <button class="game-back-button" data-action="close-game"><span>←</span> Retour à la galerie</button>
    <section class="game-workspace-hero">
      <img src="${escapeHtml(gameArtwork(pack))}" alt="">
      <div>
        <span>PARCOURS SHENPULSE</span>
        <h2>${escapeHtml(pack.name)}</h2>
        <p>${escapeHtml(guide.summary || pack.description)}</p>
        <div class="entity-meta">
          <span class="badge ${unlocked ? "success" : ""}">${escapeHtml(gameAccessLabel(pack))}</span>
          <span class="badge cyan">Configuration guidée</span>
        </div>
      </div>
      <div class="game-hero-stats">
        <span><strong>${pack.effects.length}</strong><small>interactions</small></span>
        <span><strong>${mappedEffects.length}</strong><small>configurées</small></span>
      </div>
    </section>
    ${unlocked ? "" : `<section class="game-access-warning"><span aria-hidden="true">🔒</span><div><strong>Accès requis pour exécuter ce jeu</strong><p>${escapeHtml(gameAccessReason(pack))}</p></div><button class="button primary" data-navigate="membership">Voir les accès</button></section>`}
    <nav class="game-journey-tabs" aria-label="Parcours de configuration">
      ${steps.map((step, index) => `<button class="${gameWorkspaceStep === step.id ? "active" : ""}" data-action="game-step" data-value="${step.id}">
        <b>${step.icon}</b><span><small>ÉTAPE ${index + 1}</small><strong>${step.label}</strong></span>
      </button>`).join("")}
    </nav>
    <section class="game-workspace-content">${renderGameWorkspaceStep(pack, unlocked)}</section>
    ${renderGameInstallProgressModal(pack)}
    ${renderGameLaunchProgressModal(pack)}
  </div>`;
}

function gameJourneyFor(pack) {
  const requested = Array.isArray(pack.guide?.journey)
    ? pack.guide.journey
    : [];
  const known = new Map(DEFAULT_GAME_JOURNEY.map((step) => [step.id, step]));
  const custom = requested
    .map((entry) => {
      const id = typeof entry === "string" ? entry : entry?.id;
      if (!known.has(id)) return null;
      return {
        ...known.get(id),
        ...(typeof entry === "object" ? entry : {})
      };
    })
    .filter(Boolean);
  const journey = custom.length ? custom : DEFAULT_GAME_JOURNEY;
  if (!CONFIGURABLE_INTEGRATED_GAMES.has(pack.id)) return journey;
  return journey.map((step) =>
    step.id === "installation"
      ? { ...step, label: "Réglages", icon: "⚙" }
      : step
  );
}

function renderGameWorkspaceStep(pack, unlocked) {
  if (gameWorkspaceStep === "interactions") {
    return renderGameInteractions(pack, unlocked);
  }
  if (gameWorkspaceStep === "overlays") {
    return renderGameOverlays(pack, unlocked);
  }
  if (gameWorkspaceStep === "launch") {
    return renderGameLaunch(pack, unlocked);
  }
  return renderGameInstallation(pack, unlocked);
}

function integratedGameSettings(gameId) {
  const defaults = {
    "coin-pusher": {
      theme: "arcade",
      topN: 3,
      roundDurationMinutes: 15,
      pusherSpeed: 1,
      coinScale: 1,
      volume: 0.8,
      maxCoins: 1000,
      sideLossEnabled: false
    },
    "connect-four": {
      columns: 7,
      rows: 6,
      winLength: 4,
      duelEntryCost: 0,
      aiEasyEntryCost: 0,
      aiHardEntryCost: 0,
      rewardsEnabled: false,
      rewards: { horizontal: 0, vertical: 0, diagonal: 0 }
    },
    "deal-or-no-deal": {
      entryGift: "Rose",
      premiumGift: "TikTok Universe",
      boxValues: "0.01, 1, 5, 10, 25, 50, 75, 100, 250, 500, 750, 1000, 2500, 5000, 7500, 10000, 25000, 50000, 75000, 100000",
      roundPattern: "6, 5, 4, 3, 2, 1",
      bankerOfferRatio: 0.72,
      premiumMultiplier: 1.5,
      cashOfferEnabled: true,
      swapEnabled: true,
      buyBoxEnabled: true,
      musicEnabled: true,
      musicVolume: 0.35,
      musicTrack: "conquest-of-paradise.mp3"
    }
  };
  const saved = snapshot.state.game.connectorOverrides?.[gameId] || {};
  const merged = { ...(defaults[gameId] || {}), ...saved };
  if (gameId === "connect-four") {
    merged.rewards = {
      ...defaults["connect-four"].rewards,
      ...(saved.rewards || {})
    };
  }
  return merged;
}

function integratedNumberField(name, label, value, min, max, step = 1, detail = "") {
  return `<label class="integrated-setting-field">
    <span>${escapeHtml(label)}</span>
    <input name="${escapeHtml(name)}" type="number" min="${min}" max="${max}" step="${step}" value="${escapeHtml(value)}">
    ${detail ? `<small>${escapeHtml(detail)}</small>` : ""}
  </label>`;
}

function renderIntegratedGameFields(pack, config) {
  if (pack.id === "coin-pusher") {
    return `<div class="integrated-settings-sections">
      <section class="integrated-settings-card">
        <header><span>01</span><div><h4>Plateau et manche</h4><p>Les réglages essentiels du Coin Pusher de ShenazenOverlay.</p></div></header>
        <div class="integrated-settings-grid">
          <label class="integrated-setting-field"><span>Thème du plateau</span><select name="theme"><option value="arcade" ${config.theme === "arcade" ? "selected" : ""}>Arcade classique</option><option value="galactic-palace" ${config.theme === "galactic-palace" ? "selected" : ""}>Palais galactique</option></select></label>
          ${integratedNumberField("roundDurationMinutes", "Durée d’une manche (min)", config.roundDurationMinutes, 1, 180)}
          ${integratedNumberField("topN", "Joueurs récompensés", config.topN, 1, 10)}
          ${integratedNumberField("maxCoins", "Capacité du plateau", config.maxCoins, 80, 10000, 20)}
        </div>
      </section>
      <section class="integrated-settings-card">
        <header><span>02</span><div><h4>Physique et ambiance</h4><p>Ajustez le rythme sans modifier les associations de cadeaux.</p></div></header>
        <div class="integrated-settings-grid">
          ${integratedNumberField("pusherSpeed", "Vitesse du poussoir", config.pusherSpeed, 0.5, 2, 0.1)}
          ${integratedNumberField("coinScale", "Taille des pièces", config.coinScale, 0.6, 2.2, 0.1)}
          ${integratedNumberField("volume", "Volume général", config.volume, 0, 1, 0.05)}
          <label class="integrated-setting-toggle"><input name="sideLossEnabled" type="checkbox" ${config.sideLossEnabled ? "checked" : ""}><span><strong>Pertes latérales</strong><small>Les pièces peuvent tomber sur les côtés du plateau.</small></span></label>
        </div>
      </section>
    </div>`;
  }
  if (pack.id === "connect-four") {
    return `<div class="integrated-settings-sections">
      <section class="integrated-settings-card">
        <header><span>01</span><div><h4>Grille et victoire</h4><p>Les mêmes limites que le Puissance 4 de ShenazenOverlay.</p></div></header>
        <div class="integrated-settings-grid">
          ${integratedNumberField("columns", "Colonnes", config.columns, 4, 12)}
          ${integratedNumberField("rows", "Lignes", config.rows, 4, 10)}
          <label class="integrated-setting-field"><span>Jetons à aligner</span><select name="winLength">${[4, 5, 6].map((value) => `<option value="${value}" ${Number(config.winLength) === value ? "selected" : ""}>${value}</option>`).join("")}</select></label>
        </div>
      </section>
      <section class="integrated-settings-card">
        <header><span>02</span><div><h4>Entrées et récompenses</h4><p>Les montants sont propres au profil actif.</p></div></header>
        <div class="integrated-settings-grid">
          ${integratedNumberField("duelEntryCost", "Entrée duel", config.duelEntryCost, 0, 999999)}
          ${integratedNumberField("aiEasyEntryCost", "Entrée IA facile", config.aiEasyEntryCost, 0, 999999)}
          ${integratedNumberField("aiHardEntryCost", "Entrée IA difficile", config.aiHardEntryCost, 0, 999999)}
          <label class="integrated-setting-toggle"><input name="rewardsEnabled" type="checkbox" ${config.rewardsEnabled ? "checked" : ""}><span><strong>Récompenses actives</strong><small>Attribuer des points selon l’alignement gagnant.</small></span></label>
          ${integratedNumberField("rewardHorizontal", "Récompense horizontale", config.rewards.horizontal, 0, 999999)}
          ${integratedNumberField("rewardVertical", "Récompense verticale", config.rewards.vertical, 0, 999999)}
          ${integratedNumberField("rewardDiagonal", "Récompense diagonale", config.rewards.diagonal, 0, 999999)}
        </div>
      </section>
    </div>`;
  }
  return `<div class="integrated-settings-sections">
    <section class="integrated-settings-card">
      <header><span>01</span><div><h4>Entrée et boîtes</h4><p>Configurez la valeur du ticket et le déroulé des manches.</p></div></header>
      <div class="integrated-settings-grid">
        <label class="integrated-setting-field"><span>Cadeau d’entrée</span><input name="entryGift" value="${escapeHtml(config.entryGift)}" list="integrated-game-gifts"></label>
        <label class="integrated-setting-field"><span>Cadeau premium</span><input name="premiumGift" value="${escapeHtml(config.premiumGift)}" list="integrated-game-gifts"></label>
        <label class="integrated-setting-field full"><span>Valeurs des boîtes</span><textarea name="boxValues">${escapeHtml(config.boxValues)}</textarea><small>Séparez les valeurs par des virgules.</small></label>
        <label class="integrated-setting-field full"><span>Rythme des manches</span><input name="roundPattern" value="${escapeHtml(config.roundPattern)}"><small>Nombre de boîtes à ouvrir : 6, 5, 4, 3, 2, 1.</small></label>
      </div>
    </section>
    <section class="integrated-settings-card">
      <header><span>02</span><div><h4>Banquier et ambiance</h4><p>Retrouvez les demandes et la bande-son du jeu d’origine.</p></div></header>
      <div class="integrated-settings-grid">
        ${integratedNumberField("bankerOfferRatio", "Ratio de l’offre", config.bankerOfferRatio, 0.1, 1.5, 0.01)}
        ${integratedNumberField("premiumMultiplier", "Multiplicateur premium", config.premiumMultiplier, 1, 10, 0.1)}
        <label class="integrated-setting-field"><span>Musique</span><select name="musicTrack">
          ${[
            ["conquest-of-paradise.mp3", "Conquest of Paradise"],
            ["last-of-the-mohicans-promentory.mp3", "Last of the Mohicans"],
            ["titans-alexander.mp3", "Titans · Alexander"],
            ["romeo-juliet-epilogue.mp3", "Roméo & Juliette · Épilogue"],
            ["norbu-cordes.mp3", "Norbu · Cordes"],
            ["sorrow.mp3", "Sorrow"],
            ["chopin-marche-funebre.mp3", "Chopin · Marche funèbre"]
          ].map(([value, label]) => `<option value="${value}" ${config.musicTrack === value ? "selected" : ""}>${label}</option>`).join("")}
        </select></label>
        ${integratedNumberField("musicVolume", "Volume musique", config.musicVolume, 0, 1, 0.05)}
        <label class="integrated-setting-toggle"><input name="cashOfferEnabled" type="checkbox" ${config.cashOfferEnabled !== false ? "checked" : ""}><span><strong>Offres en argent</strong><small>Le banquier peut proposer un montant.</small></span></label>
        <label class="integrated-setting-toggle"><input name="swapEnabled" type="checkbox" ${config.swapEnabled !== false ? "checked" : ""}><span><strong>Échanges de boîte</strong><small>Le banquier peut proposer un échange.</small></span></label>
        <label class="integrated-setting-toggle"><input name="buyBoxEnabled" type="checkbox" ${config.buyBoxEnabled !== false ? "checked" : ""}><span><strong>Achats de boîte</strong><small>Le banquier peut vendre une boîte.</small></span></label>
        <label class="integrated-setting-toggle"><input name="musicEnabled" type="checkbox" ${config.musicEnabled !== false ? "checked" : ""}><span><strong>Bande-son active</strong><small>Jouer la musique dans la fenêtre du jeu.</small></span></label>
      </div>
      <datalist id="integrated-game-gifts">${GIFT_CATALOG.map((gift) => `<option value="${escapeHtml(gift.name)}"></option>`).join("")}</datalist>
    </section>
  </div>`;
}

function renderIntegratedGameSettings(pack, unlocked) {
  const config = integratedGameSettings(pack.id);
  return `<form class="integrated-game-settings" data-integrated-game-settings="${escapeHtml(pack.id)}">
    <section class="game-interaction-toolbar integrated-settings-heading">
      <div><span>⚙ RÉGLAGES DU JEU</span><h3>Configurer ${escapeHtml(pack.name)}</h3><p>Ces réglages reprennent l’écran dédié de ShenazenOverlay et restent enregistrés uniquement pour ${escapeHtml(overlayProfileName())}.</p></div>
      <span class="game-step-count">INTÉGRÉ</span>
    </section>
    ${renderGamePageMessage(pack, "installation")}
    ${renderIntegratedGameFields(pack, config)}
    <footer class="game-step-footer integrated-settings-actions">
      <div><strong>Jeu local prêt</strong><small>Aucune installation externe n’est nécessaire.</small></div>
      <button class="button" type="submit" ${unlocked ? "" : "disabled"}>Enregistrer</button>
      <button class="button primary game-launch-button" type="submit" data-launch-after-save="true" ${unlocked ? "" : "disabled"}>▶ Enregistrer et ouvrir le jeu</button>
      <button class="button ghost" type="button" data-action="game-step" data-value="interactions" ${unlocked ? "" : "disabled"}>Configurer les interactions →</button>
    </footer>
  </form>`;
}

function integratedSettingsFromForm(gameId, data) {
  const number = (name, fallback, minimum, maximum) => {
    const value = Number(data.get(name));
    return Number.isFinite(value)
      ? Math.min(maximum, Math.max(minimum, value))
      : fallback;
  };
  if (gameId === "coin-pusher") {
    return {
      theme: data.get("theme") === "galactic-palace" ? "galactic-palace" : "arcade",
      roundDurationMinutes: Math.round(number("roundDurationMinutes", 15, 1, 180)),
      topN: Math.round(number("topN", 3, 1, 10)),
      maxCoins: Math.round(number("maxCoins", 1000, 80, 10000)),
      pusherSpeed: number("pusherSpeed", 1, 0.5, 2),
      coinScale: number("coinScale", 1, 0.6, 2.2),
      volume: number("volume", 0.8, 0, 1),
      sideLossEnabled: data.has("sideLossEnabled")
    };
  }
  if (gameId === "connect-four") {
    const winLength = Math.round(number("winLength", 4, 4, 6));
    return {
      columns: Math.round(number("columns", 7, 4, 12)),
      rows: Math.round(number("rows", 6, 4, 10)),
      winLength: [4, 5, 6].includes(winLength) ? winLength : 4,
      duelEntryCost: Math.round(number("duelEntryCost", 0, 0, 999999)),
      aiEasyEntryCost: Math.round(number("aiEasyEntryCost", 0, 0, 999999)),
      aiHardEntryCost: Math.round(number("aiHardEntryCost", 0, 0, 999999)),
      rewardsEnabled: data.has("rewardsEnabled"),
      rewards: {
        horizontal: Math.round(number("rewardHorizontal", 0, 0, 999999)),
        vertical: Math.round(number("rewardVertical", 0, 0, 999999)),
        diagonal: Math.round(number("rewardDiagonal", 0, 0, 999999))
      }
    };
  }
  const cashOfferEnabled = data.has("cashOfferEnabled");
  const swapEnabled = data.has("swapEnabled");
  const buyBoxEnabled = data.has("buyBoxEnabled");
  return {
    entryGift: String(data.get("entryGift") || "").trim(),
    premiumGift: String(data.get("premiumGift") || "").trim(),
    boxValues: String(data.get("boxValues") || "").trim(),
    roundPattern: String(data.get("roundPattern") || "").trim(),
    bankerOfferRatio: number("bankerOfferRatio", 0.72, 0.1, 1.5),
    premiumMultiplier: number("premiumMultiplier", 1.5, 1, 10),
    cashOfferEnabled: cashOfferEnabled || (!swapEnabled && !buyBoxEnabled),
    swapEnabled,
    buyBoxEnabled,
    musicEnabled: data.has("musicEnabled"),
    musicVolume: number("musicVolume", 0.35, 0, 1),
    musicTrack: String(data.get("musicTrack") || "conquest-of-paradise.mp3")
  };
}

function renderGameInstallation(pack, unlocked) {
  const integrated = pack.guide?.mode === "integrated";
  if (integrated && CONFIGURABLE_INTEGRATED_GAMES.has(pack.id)) {
    return renderIntegratedGameSettings(pack, unlocked);
  }
  const automated = AUTOMATED_GAME_INSTALLERS.has(pack.id);
  const managedMinecraft = MINECRAFT_MODE_IDS.includes(pack.id);
  const installation = snapshot.state.game.installations?.[pack.id];
  const updateAvailable = Boolean(
    installation &&
      pack.installerVersion &&
      installation.installerVersion !== pack.installerVersion
  );
  const busy = gameInstallBusyId === pack.id;
  let statusTitle = integrated
    ? "Aucune installation nécessaire"
    : updateAvailable
      ? "Une mise à jour du pack est disponible"
    : installation
      ? `${pack.name} est prêt`
      : "Installation en un clic";
  let statusText = integrated
    ? "Ce jeu est déjà inclus dans ShenPulse. Vous pouvez passer directement aux interactions."
    : updateAvailable
      ? pack.id === "gtav-montchiliad"
        ? "Mettez à jour le pack pour profiter des 178 véhicules du nouveau tirage aléatoire GTA."
        : `Mettez à jour le pack ${pack.name} pour installer la dernière version du mod et de sa passerelle ShenPulse.`
    : installation
      ? "Tous les éléments nécessaires sont installés. Vous pouvez continuer la configuration."
      : "ShenPulse recherche le jeu puis installe automatiquement tout ce qui est nécessaire. S’il ne le trouve pas, il vous demandera simplement de choisir son dossier.";
  if (managedMinecraft) {
    statusTitle = installation
      ? "Serveur Minecraft ShenPulse installé"
      : "Serveur Minecraft complet en un clic";
    statusText = installation
      ? "PaperMC, Java 21, le mode choisi et ses plugins sont installés. Le serveur se lance automatiquement sur 127.0.0.1."
      : "ShenPulse installe PaperMC, un Java 21 portable, le monde et les plugins dans son propre dossier. Aucun dossier serveur ne vous sera demandé.";
  }
  const installationStateText = managedMinecraft
    ? installation
      ? "Le serveur local est mémorisé et peut être relancé depuis ShenPulse."
      : "Acceptez le CLUF Minecraft puis laissez ShenPulse télécharger, préparer et démarrer le serveur."
    : installation || integrated
      ? "ShenPulse a mémorisé cette installation."
      : "Fermez le jeu avant de commencer. ShenPulse s’occupe du reste et conserve une copie de sécurité si nécessaire.";
  return `<div class="game-simple-step">
    <section class="game-primary-panel game-install-simple">
      <header><div><span>↓ INSTALLATION</span><h3>${escapeHtml(statusTitle)}</h3><p>${escapeHtml(statusText)}</p></div><span class="game-step-count">${updateAvailable ? "MISE À JOUR" : installation || integrated ? "PRÊT" : "1 CLIC"}</span></header>
      ${renderGamePageMessage(pack, "installation")}
      <div class="game-install-state ${installation || integrated ? "ready" : ""}">
        <span>${installation || integrated ? "✓" : "↓"}</span>
        <div>
          <strong>${installation || integrated ? "Prêt à continuer" : `Installer ${escapeHtml(pack.name)}`}</strong>
          <p>${installationStateText}</p>
        </div>
      </div>
      <footer class="game-panel-actions">
        ${automated ? `<button class="button primary game-install-button" data-action="install-game" data-id="${escapeHtml(pack.id)}" ${unlocked && !busy ? "" : "disabled"}>${busy ? "Installation en cours…" : updateAvailable ? "↓ Mettre à jour le pack" : installation ? "↻ Réparer l’installation" : "↓ Installer automatiquement"}</button>` : ""}
        ${!automated && !integrated ? `<button class="button" data-action="open-url" data-value="${escapeHtml(pack.guide?.sources?.[0]?.url || "")}" ${pack.guide?.sources?.[0]?.url ? "" : "disabled"}>Ouvrir l’aide d’installation</button>` : ""}
        <button class="button ${installation || integrated ? "primary" : ""}" data-action="game-step" data-value="interactions" ${unlocked ? "" : "disabled"}>Continuer vers les interactions →</button>
      </footer>
    </section>
    <aside class="game-novice-note">
      <span>✦</span>
      <strong>Vous n’avez rien à configurer</strong>
      <p>Le téléchargement, la copie des éléments et la préparation sont automatisés. Une fenêtre de progression reste visible jusqu’à la fin.</p>
      ${installation ? `<small>Dernière installation : ${escapeHtml(formatAdminDate(installation.installedAt))}</small>` : ""}
    </aside>
  </div>`;
}

function renderGameLaunch(pack, unlocked) {
  const integrated = pack.guide?.mode === "integrated";
  const managedMinecraft = MINECRAFT_MODE_IDS.includes(pack.id);
  const installation = snapshot.state.game.installations?.[pack.id];
  const canLaunch = unlocked && (integrated || Boolean(installation));
  const mappings = gameMappedEffects(pack);
  const runningSession = activeGameSession();
  const sessionActive = runningSession?.packId === pack.id;
  const launchBusy = gameLaunchBusyId === pack.id;
  const roundSettings = managedMinecraft
    ? minecraftRoundSettingsFor(pack.id)
    : null;
  const roundRemaining = sessionActive
    ? minecraftRoundRemainingSeconds(runningSession)
    : roundSettings
      ? roundSettings.durationMinutes * 60
      : 0;
  const launchDescription = managedMinecraft
    ? "Démarrez le serveur depuis ShenPulse, ouvrez Minecraft puis rejoignez 127.0.0.1. Les interactions du mode choisi seront déjà chargées."
    : "Lancez le jeu depuis ShenPulse. Une fois votre partie chargée, les interactions configurées seront prêtes à fonctionner.";
  const launchButtonLabel = managedMinecraft
    ? "▶ Démarrer le serveur et activer"
    : `▶ Lancer ${pack.name} et activer`;
  return `<div class="game-simple-step game-start-layout">
    <section class="game-primary-panel game-start-panel">
      <header><div><span>▶ DÉMARRAGE</span><h3>Tout est prêt pour jouer</h3><p>${escapeHtml(launchDescription)}</p></div></header>
      ${renderGamePageMessage(pack, "launch")}
      <div class="game-start-readiness">
        <article class="${canLaunch ? "ready" : ""}"><span>${canLaunch ? "✓" : "1"}</span><div><strong>${canLaunch ? "Jeu prêt" : "Installation nécessaire"}</strong><small>${canLaunch ? "ShenPulse peut lancer le jeu." : "Revenez à l’étape Installation."}</small></div></article>
        <article class="${mappings.length ? "ready" : ""}"><span>${mappings.length ? "✓" : "2"}</span><div><strong>${mappings.length ? `${mappings.length} interaction${mappings.length > 1 ? "s" : ""} configurée${mappings.length > 1 ? "s" : ""}` : "Interactions facultatives"}</strong><small>${mappings.length ? "Vos déclencheurs sont enregistrés." : "Vous pourrez en ajouter à tout moment."}</small></div></article>
        <article class="${sessionActive ? "ready" : ""}"><span>${sessionActive ? "✓" : "3"}</span><div><strong>${sessionActive ? "Session de jeu active" : "Session de jeu arrêtée"}</strong><small>${sessionActive ? "Les interactions restent actives sur toutes les pages." : "Activez-la pour autoriser les interactions de ce jeu."}</small></div></article>
      </div>
      <footer class="game-panel-actions">
        ${canLaunch ? "" : `<button class="button" data-action="game-step" data-value="installation">← Revenir à l’installation</button>`}
        ${sessionActive
          ? `<button class="button danger game-launch-button" data-action="stop-game-session">■ Arrêter la session de jeu</button>`
          : canLaunch
            ? `<button class="button primary game-launch-button" data-action="launch-game" data-id="${escapeHtml(pack.id)}" ${launchBusy ? "disabled" : ""}>${launchBusy ? "… Démarrage du serveur" : integrated ? "▶ Ouvrir le jeu et activer" : escapeHtml(launchButtonLabel)}</button>`
            : `<button class="button primary game-launch-button" data-action="start-game-session" data-id="${escapeHtml(pack.id)}" ${unlocked ? "" : "disabled"}>▶ Activer les interactions</button>`}
      </footer>
    </section>
    ${managedMinecraft
      ? `<div class="game-launch-side">
          <form class="minecraft-round-settings" data-minecraft-round-settings="${escapeHtml(pack.id)}">
            <header>
              <span>◷</span>
              <div><strong>Durée de la partie</strong><small>Le chrono démarre dès que PaperMC est prêt.</small></div>
            </header>
            <label>
              <span>Temps avant TIME OUT</span>
              <div><input name="durationMinutes" type="number" min="1" max="1440" step="1" value="${roundSettings.durationMinutes}"><b>minutes</b></div>
            </label>
            <label class="minecraft-round-toggle">
              <input name="autoRestart" type="checkbox" ${roundSettings.autoRestart ? "checked" : ""}>
              <span><strong>Relancer automatiquement le chrono</strong><small>Après chaque TIME OUT, une WIN est retirée puis une nouvelle partie commence.</small></span>
            </label>
            <div class="minecraft-round-runtime ${sessionActive ? "running" : ""}">
              <span>${sessionActive ? "TEMPS RESTANT" : "PROCHAINE PARTIE"}</span>
              <strong data-minecraft-round-countdown>${formatCountdown(roundRemaining)}</strong>
              <small>${sessionActive ? (roundSettings.autoRestart ? "Relance automatique active" : "Le chrono s’arrêtera après le TIME OUT") : `${roundSettings.durationMinutes} minute${roundSettings.durationMinutes > 1 ? "s" : ""} configurée${roundSettings.durationMinutes > 1 ? "s" : ""}`}</small>
            </div>
            <button type="button" class="button primary" data-action="save-game-round-settings" data-id="${escapeHtml(pack.id)}">Enregistrer les réglages</button>
          </form>
          <aside class="game-novice-note">
            <span>▶</span>
            <strong>Après le lancement</strong>
            <p>Dans Minecraft, ajoutez le serveur 127.0.0.1 puis rejoignez-le. ShenPulse garde le serveur, le chrono et les interactions actifs.</p>
          </aside>
        </div>`
      : `<aside class="game-novice-note">
          <span>▶</span>
          <strong>Après le lancement</strong>
          <p>Chargez simplement votre partie. ShenPulse reconnaît automatiquement le jeu préparé et utilise votre profil actif.</p>
        </aside>`}
  </div>`;
}

function renderGameOverlays(pack, unlocked) {
  if (pack.id === "cult-of-the-lamb") {
    return `<div class="game-overlays-page">
      <section class="game-interaction-toolbar">
        <div><span>◇ CULT OF THE LAMB</span><h3>Aucun overlay requis</h3><p>Les interactions Cult of the Lamb s’exécutent directement dans le jeu. Aucun timer, compteur de WINS, multiplicateur ou roue ne doit être ajouté à OBS pour ce pack.</p></div>
        <span class="badge success">JEU DIRECT</span>
      </section>
      <section class="empty-state game-overlay-empty-state">
        <div><span class="empty-icon">✓</span><h2>Configuration visuelle inutile</h2><p>Continuez vers le démarrage : ShenPulse transmettra les interactions au mod Cult of the Lamb sans source navigateur supplémentaire.</p></div>
      </section>
      <footer class="game-step-footer">
        <div><strong>Interactions intégrées au jeu</strong><small>Aucun élément de la capture OBS n’est nécessaire.</small></div>
        <button class="button primary" data-action="game-step" data-value="launch" ${unlocked ? "" : "disabled"}>Continuer vers le démarrage →</button>
      </footer>
    </div>`;
  }
  const items = gameOverlayItemsFor(pack);
  const cards = items.map((item) =>
    renderOverlayCard(item, {
      allowed: unlocked && overlayUnlocked(item)
    })
  ).join("");
  const overlayContent = `<section class="game-overlay-composer-layout">
      ${renderGameInteractionOverlayCard(pack, unlocked)}
      <div class="overlay-catalog-grid game-overlay-card-grid">${cards}</div>
    </section>`;
  return `<div class="game-overlays-page">
    <section class="game-interaction-toolbar">
      <div><span>▱ OVERLAYS LIÉS</span><h3>Préparer les affichages du LIVE</h3><p>Téléchargez d’abord l’image des interactions, puis ajoutez les compteurs utiles comme sources navigateur. Le même générateur est utilisé par tous les jeux ShenPulse.</p></div>
      <span class="game-step-count">${items.length + 1} DISPONIBLES</span>
    </section>
    ${overlayContent}
    <footer class="game-step-footer">
      <div><strong>Configuration globale liée</strong><small>Enregistrée uniquement pour ${escapeHtml(overlayProfileName())}.</small></div>
      <button class="button primary" data-action="game-step" data-value="launch" ${unlocked ? "" : "disabled"}>Continuer vers le démarrage →</button>
    </footer>
  </div>`;
}

function renderGameOverlaysLegacy(pack, unlocked) {
  const items = gameOverlayItemsFor(pack);
  return `<div class="game-overlays-page">
    <section class="game-interaction-toolbar">
      <div><span>▱ OVERLAYS</span><h3>Habillez votre partie</h3><p>Choisissez les éléments à afficher, prévisualisez-les puis adaptez leur design en quelques clics.</p></div>
      <span class="game-step-count">${items.length} DISPONIBLES</span>
    </section>
    <section class="game-overlay-card-grid">
      ${items.map((item) => {
        const allowed = unlocked && overlayUnlocked(item);
        return `<article class="game-overlay-card ${allowed ? "" : "locked"}">
          <div class="game-overlay-card-preview">${overlayPreview(item)}</div>
          <div class="game-overlay-card-copy">
            <header><span>${escapeHtml(item.icon)}</span><div><small>${item.requiresPro ? "INCLUS AVEC PRO" : "INCLUS"}</small><h4>${escapeHtml(item.name)}</h4></div></header>
            <p>${escapeHtml(item.description)}</p>
            ${overlayDesignPicker(item)}
            <footer>
              <button class="button small" data-action="preview-overlay" data-id="${escapeHtml(item.key)}" ${allowed ? "" : "disabled"}>Aperçu</button>
              <button class="button small primary" data-action="configure-overlay" data-id="${escapeHtml(item.key)}" ${allowed ? "" : "disabled"}>Personnaliser</button>
              <button class="button small ghost" data-action="copy" data-value="${escapeHtml(overlayUrl(item))}" ${allowed ? "" : "disabled"}>Ajouter à mon LIVE</button>
            </footer>
          </div>
        </article>`;
      }).join("")}
    </section>
    <footer class="game-step-footer">
      <div><strong>Vos choix sont enregistrés</strong><small>Ils restent indépendants pour le profil actuellement sélectionné.</small></div>
      <button class="button primary" data-action="game-step" data-value="launch" ${unlocked ? "" : "disabled"}>Continuer vers le démarrage →</button>
    </footer>
  </div>`;
}

function gameOverlayItemsFor(pack) {
  const preferredKeys = pack.id === "gtav-montchiliad"
    ? ["winCounter", "multiplierTimer"]
    : MINECRAFT_MODE_IDS.includes(pack.id)
      ? ["timer", "multiplierTimer", "winCounter"]
      : pack.id === "cult-of-the-lamb"
        ? []
        : ["myActions", "timer", "multiplierTimer", "winCounter", "wheel"];
  const definitions = overlayDefinitions();
  return preferredKeys
    .map((key) => definitions.find((item) => item.key === key))
    .filter((item) => item && canAccessOverlay(item));
}

function gameInteractionOverlayBackground(packId) {
  const configured =
    snapshot.state.settings.overlayConfigs?.gameInteractionOverlays
      ?.[packId]?.backgroundColor ||
    (packId === "gtav-montchiliad"
      ? snapshot.state.settings.overlayConfigs?.gtavInteractionOverlay
        ?.backgroundColor
      : "");
  return /^#[0-9a-f]{6}$/i.test(String(configured || ""))
    ? configured
    : "#082b63";
}

function gtaInteractionOverlayBackground() {
  return gameInteractionOverlayBackground("gtav-montchiliad");
}

function gameOverlayTriggerType(rule) {
  if (!hasAutomaticTrigger(rule)) return "chat";
  const type = String(rule?.trigger?.type || "gift");
  if (type === "like") return "likes";
  if (type === "message") return "chat";
  if (type === "subscription") return "subscribe";
  if (["gift", "likes", "chat", "follow", "share", "subscribe"].includes(type)) {
    return type;
  }
  return "chat";
}

function gameInteractionOverlayEntries(pack) {
  return gameMappedEffects(pack)
    .filter((row) => row.rule.enabled !== false)
    .map((row) => {
      const effect = pack.effects.find(
        (item) => item.id === row.action.config?.effectId
      );
      if (!effect || effect.available === false) return null;
      const giftName = ruleGiftName(row.rule);
      const triggerType = gameOverlayTriggerType(row.rule);
      return {
        effectId: effect.id,
        isWinEffect: effect.actionType === "overlay.win-counter",
        title: row.rule.gameInteraction?.title || effect.name,
        trigger: triggerLabel(row.rule),
        triggerType,
        triggerKey: giftName || triggerLabel(row.rule),
        likeAmount:
          triggerType === "likes"
            ? Math.max(1, Number(row.rule.trigger?.threshold || 1))
            : 0,
        groupKey: `${effect.id}:${JSON.stringify({
          amount: row.action.config?.amount,
          duration: row.action.config?.duration,
          operation: row.action.config?.operation,
          parameters: row.action.config?.parameters || {}
        })}`,
        effectImageUrl: effect.image || "",
        giftImageUrl: giftForName(giftName)?.imageUrl || "",
        giftLabel: giftName || triggerLabel(row.rule)
      };
    })
    .filter(Boolean)
    .slice(0, 42);
}

function gtaInteractionOverlayEntries(pack) {
  return gameInteractionOverlayEntries(pack);
}

function renderGameInteractionOverlayCard(pack, unlocked) {
  const entries = gameInteractionOverlayEntries(pack);
  const color = gameInteractionOverlayBackground(pack.id);
  const previewEntries = entries.slice(0, 6);
  return `<article class="gta-interaction-overlay-card game-interaction-overlay-card">
    <header>
      <span class="gta-overlay-download-icon">↓</span>
      <div><small>À TÉLÉCHARGER EN PREMIER</small><h3>Overlay des interactions ${escapeHtml(pack.name)}</h3></div>
      <span class="badge ${entries.length ? "success" : "warning"}">${entries.length} ACTIVE${entries.length > 1 ? "S" : ""}</span>
    </header>
    <p>Cette image reprend uniquement les interactions actives du profil ${escapeHtml(overlayProfileName())}. Elle reproduit les deux modèles historiques ShenazenOverlay : WINS sur les côtés, cadeaux et effets correctement regroupés dans le panneau inférieur.</p>
    <div class="gta-interaction-overlay-preview" style="--gta-overlay-background:${escapeHtml(color)}">
      ${previewEntries.length
        ? previewEntries.map((entry) => `<span><i>${entry.giftImageUrl ? `<img src="${escapeHtml(entry.giftImageUrl)}" alt="">` : "🎁"}</i><strong>${escapeHtml(entry.title)}</strong><small>${escapeHtml(entry.trigger)}</small></span>`).join("")
        : "<em>Activez au moins une interaction GTA pour générer le fond.</em>"}
    </div>
    <div class="gta-overlay-instructions">
      <span><b>1</b>Téléchargez l’image après avoir réglé vos interactions.</span>
      <span><b>2</b>Ajoutez-la comme source image dans votre logiciel de LIVE.</span>
      <span><b>3</b>Conservez sa taille 1080 × 1920 et placez-la au-dessus du jeu.</span>
    </div>
    <div class="gta-overlay-background-picker">
      <span><strong>Fond du modèle 1</strong><small>Choisissez la couleur qui remplacera le noir derrière le jeu. Le modèle 2 conserve son panneau bleu historique.</small></span>
      <div>${GTA_INTERACTION_OVERLAY_BACKGROUNDS.map(([value, label]) =>
        `<button type="button" class="${color.toLowerCase() === value ? "active" : ""}" style="--swatch:${value}" data-action="set-game-overlay-background" data-id="${escapeHtml(pack.id)}" data-value="${value}" title="${escapeHtml(label)}" aria-label="${escapeHtml(label)}">${color.toLowerCase() === value ? "✓" : ""}</button>`
      ).join("")}<label style="--swatch:${escapeHtml(color)}" title="Couleur personnalisée"><span>◈</span><input type="color" value="${escapeHtml(color)}" data-action="set-game-overlay-background" data-id="${escapeHtml(pack.id)}" aria-label="Couleur personnalisée"></label></div>
    </div>
    <footer>
      <button class="button primary" data-action="download-game-interaction-overlay" data-id="${escapeHtml(pack.id)}" data-model="1" ${unlocked && entries.length ? "" : "disabled"}>↓ Télécharger le modèle 1</button>
      <button class="button" data-action="download-game-interaction-overlay" data-id="${escapeHtml(pack.id)}" data-model="2" ${unlocked && entries.length ? "" : "disabled"}>↓ Télécharger le modèle 2</button>
    </footer>
    <small class="gta-overlay-refresh-note">Après chaque modification des interactions, téléchargez de nouveau l’image pour garder les cadeaux et les intitulés à jour.</small>
  </article>`;
}

async function saveGameInteractionOverlayBackground(packId, value) {
  const color = /^#[0-9a-f]{6}$/i.test(String(value || ""))
    ? String(value)
    : "#082b63";
  acceptSnapshot(await api.saveSettings({
    ...snapshot.state.settings,
    overlayConfigs: {
      ...(snapshot.state.settings.overlayConfigs || {}),
      gameInteractionOverlays: {
        ...(snapshot.state.settings.overlayConfigs?.gameInteractionOverlays || {}),
        [packId]: {
          ...(snapshot.state.settings.overlayConfigs?.gameInteractionOverlays
            ?.[packId] || {}),
          backgroundColor: color
        }
      }
    }
  }));
  render();
}

function loadGtaOverlayImage(source, timeoutMs = 4500) {
  const url = String(source || "").trim();
  if (!url) return Promise.resolve(null);
  return new Promise((resolve) => {
    const image = new Image();
    let settled = false;
    const finish = (result) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(result);
    };
    const timer = setTimeout(() => finish(null), timeoutMs);
    image.crossOrigin = "anonymous";
    image.decoding = "async";
    image.onload = () => finish(image);
    image.onerror = () => finish(null);
    image.src = url;
  });
}

function roundedCanvasRect(context, x, y, width, height, radius) {
  const safeRadius = Math.min(radius, width / 2, height / 2);
  context.beginPath();
  context.moveTo(x + safeRadius, y);
  context.lineTo(x + width - safeRadius, y);
  context.quadraticCurveTo(x + width, y, x + width, y + safeRadius);
  context.lineTo(x + width, y + height - safeRadius);
  context.quadraticCurveTo(x + width, y + height, x + width - safeRadius, y + height);
  context.lineTo(x + safeRadius, y + height);
  context.quadraticCurveTo(x, y + height, x, y + height - safeRadius);
  context.lineTo(x, y + safeRadius);
  context.quadraticCurveTo(x, y, x + safeRadius, y);
  context.closePath();
}

function drawGtaOverlayImage(context, image, x, y, width, height) {
  if (!image?.naturalWidth || !image?.naturalHeight) return false;
  const ratio = Math.min(width / image.naturalWidth, height / image.naturalHeight);
  const drawWidth = image.naturalWidth * ratio;
  const drawHeight = image.naturalHeight * ratio;
  context.drawImage(
    image,
    x + (width - drawWidth) / 2,
    y + (height - drawHeight) / 2,
    drawWidth,
    drawHeight
  );
  return true;
}

function drawGtaOverlayText(context, value, x, y, maxWidth, size, color = "#ffffff") {
  let fontSize = size;
  context.font = `900 ${fontSize}px "Segoe UI", Arial, sans-serif`;
  while (fontSize > 16 && context.measureText(String(value)).width > maxWidth) {
    fontSize -= 1;
    context.font = `900 ${fontSize}px "Segoe UI", Arial, sans-serif`;
  }
  context.fillStyle = color;
  context.textBaseline = "middle";
  context.fillText(String(value), x, y, maxWidth);
}

function drawGtaOverlayOutlinedText(
  context,
  value,
  x,
  y,
  maxWidth,
  size,
  color = "#ffffff",
  align = "left"
) {
  let fontSize = size;
  const text = String(value || "");
  context.font = `900 ${fontSize}px Impact, "Arial Black", "Segoe UI", sans-serif`;
  while (fontSize > 15 && context.measureText(text).width > maxWidth) {
    fontSize -= 1;
    context.font = `900 ${fontSize}px Impact, "Arial Black", "Segoe UI", sans-serif`;
  }
  context.textAlign = align;
  context.textBaseline = "middle";
  context.lineJoin = "round";
  context.strokeStyle = "#020617";
  context.lineWidth = Math.max(4, fontSize * 0.16);
  context.strokeText(text, x, y, maxWidth);
  context.fillStyle = color;
  context.fillText(text, x, y, maxWidth);
}

function splitGtaOverlayTitle(context, value, maxWidth, size) {
  const words = String(value || "")
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .filter(Boolean);
  context.font = `900 ${size}px Impact, "Arial Black", "Segoe UI", sans-serif`;
  if (!words.length) return [""];
  const lines = [];
  let line = "";
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (line && context.measureText(candidate).width > maxWidth) {
      lines.push(line);
      line = word;
    } else {
      line = candidate;
    }
  }
  if (line) lines.push(line);
  if (lines.length <= 2) return lines;
  return [lines[0], lines.slice(1).join(" ")];
}

function drawGtaOverlayInteractionCard(
  context,
  entry,
  x,
  y,
  width,
  height,
  model
) {
  roundedCanvasRect(context, x, y, width, height, model === 1 ? 9 : 6);
  const gradient = context.createLinearGradient(x, y, x, y + height);
  gradient.addColorStop(0, "rgba(10, 49, 77, .98)");
  gradient.addColorStop(1, "rgba(1, 18, 33, .99)");
  context.fillStyle = gradient;
  context.fill();
  context.strokeStyle =
    model === 1 ? "rgba(29, 196, 220, .24)" : "rgba(148, 163, 184, .22)";
  context.lineWidth = 2;
  context.stroke();

  const imageHeight = model === 1
    ? Math.min(78, height * 0.55)
    : Math.min(60, height * 0.52);
  const imageWidth = Math.min(width - 30, imageHeight * 1.45);
  const imageX = x + (width - imageWidth) / 2;
  const imageY = y + 8;
  drawGtaOverlayImage(
    context,
    entry.effectImage || entry.giftImage,
    imageX,
    imageY,
    imageWidth,
    imageHeight
  );
  if (entry.giftImage && entry.effectImage) {
    const giftSize = model === 1 ? 34 : 27;
    drawGtaOverlayImage(
      context,
      entry.giftImage,
      x + width - giftSize - 7,
      y + 6,
      giftSize,
      giftSize
    );
  }

  const fontSize = model === 1 ? 22 : 17;
  const lines = splitGtaOverlayTitle(
    context,
    entry.title,
    width - 12,
    fontSize
  );
  const textY = y + height - (lines.length === 1 ? 21 : 34);
  lines.slice(0, 2).forEach((line, index) => {
    drawGtaOverlayOutlinedText(
      context,
      line,
      x + width / 2,
      textY + index * (fontSize + 3),
      width - 10,
      fontSize,
      "#ffffff",
      "center"
    );
  });
}

function gtaWinOverlayColor(effectId) {
  if (effectId === "overlay_win_x2") return "#fff51a";
  if (effectId === "overlay_win_random_200") return "#ffffff";
  return effectId.includes("_remove_") ? "#ff173d" : "#0787ff";
}

function drawGtaOverlayWinRule(context, entry, side, index, model) {
  const yStart = model === 1 ? 650 : 655;
  const rowGap = model === 1 ? 128 : 142;
  const y = yStart + index * rowGap;
  const imageWidth = model === 1 ? 94 : 86;
  const imageHeight = model === 1 ? 72 : 68;
  const left = side === "left";
  const centerX = left ? 86 : 994;
  drawGtaOverlayImage(
    context,
    entry.giftImage || entry.effectImage,
    centerX - imageWidth / 2,
    y,
    imageWidth,
    imageHeight
  );
  drawGtaOverlayOutlinedText(
    context,
    String(entry.title || "").replace(/\s+/g, " "),
    left ? 8 : 1072,
    y + imageHeight + 22,
    model === 1 ? 190 : 184,
    model === 1 ? 37 : 34,
    gtaWinOverlayColor(entry.effectId),
    left ? "left" : "right"
  );
}

function drawGtaInteractionOverlayLayout(context, prepared, model) {
  const selectedModel = Number(model) === 2 ? 2 : 1;
  context.fillStyle = gtaInteractionOverlayBackground();
  context.fillRect(0, 0, 1080, 1920);

  const winById = new Map(
    prepared
      .filter((entry) => entry.isWinEffect)
      .map((entry) => [entry.effectId, entry])
  );
  const positiveIds = [
    "overlay_win_add_1",
    "overlay_win_add_3",
    "overlay_win_add_20",
    "overlay_win_add_45",
    "overlay_win_x2"
  ];
  const negativeIds = [
    "overlay_win_remove_1",
    "overlay_win_remove_3",
    "overlay_win_remove_20",
    "overlay_win_remove_50",
    "overlay_win_random_200"
  ];
  positiveIds
    .map((effectId) => winById.get(effectId))
    .filter(Boolean)
    .forEach((entry, index) =>
      drawGtaOverlayWinRule(context, entry, "left", index, selectedModel)
    );
  negativeIds
    .map((effectId) => winById.get(effectId))
    .filter(Boolean)
    .forEach((entry, index) =>
      drawGtaOverlayWinRule(context, entry, "right", index, selectedModel)
    );

  const interactionEntries = prepared
    .filter((entry) => !entry.isWinEffect)
    .slice(0, selectedModel === 1 ? 24 : 32);
  const columns = selectedModel === 1 ? 6 : 8;
  const gap = selectedModel === 1 ? 8 : 5;
  const padding = selectedModel === 1 ? 10 : 13;
  const rows = Math.max(1, Math.ceil(interactionEntries.length / columns));
  const panelY = selectedModel === 1 ? 1360 : 1482;
  const panelBottom = 1914;
  const panelPadding = selectedModel === 1 ? 10 : 12;
  const panelHeight = panelBottom - panelY;
  const cardHeight =
    (panelHeight - panelPadding * 2 - gap * (rows - 1)) / rows;
  const cardWidth =
    (1080 - padding * 2 - gap * (columns - 1)) / columns;

  if (selectedModel === 1) {
    const panelGradient = context.createLinearGradient(0, panelY, 0, panelBottom);
    panelGradient.addColorStop(0, "rgba(0, 74, 88, .97)");
    panelGradient.addColorStop(1, "rgba(1, 21, 38, .99)");
    context.fillStyle = panelGradient;
    context.fillRect(0, panelY, 1080, panelHeight + 6);
    context.fillStyle = "rgba(34, 211, 238, .28)";
    context.fillRect(0, panelY, 1080, 3);
  } else {
    context.fillStyle = "#e2e8f0";
    context.fillRect(4, panelY - 7, 1072, panelHeight + 14);
    context.fillStyle = "#061e33";
    context.fillRect(11, panelY, 1058, panelHeight);
  }

  context.save();
  context.globalAlpha = 0.13;
  drawGtaOverlayOutlinedText(
    context,
    "ShenPulse",
    540,
    panelY + panelHeight / 2,
    520,
    72,
    "#22d3ee",
    "center"
  );
  context.restore();

  interactionEntries.forEach((entry, index) => {
    const column = index % columns;
    const row = Math.floor(index / columns);
    drawGtaOverlayInteractionCard(
      context,
      entry,
      padding + column * (cardWidth + gap),
      panelY + panelPadding + row * (cardHeight + gap),
      cardWidth,
      cardHeight,
      selectedModel
    );
  });
}

async function downloadGameInteractionOverlay(packId, model = 1) {
  const pack = snapshot.packs.find((item) => item.id === packId);
  if (!pack) throw new Error("Jeu introuvable.");
  const entries = gameInteractionOverlayEntries(pack);
  if (!entries.length) {
    throw new Error("Activez au moins une interaction avant de télécharger l’overlay.");
  }
  if (
    typeof ShenPulseGameOverlay === "undefined" ||
    !ShenPulseGameOverlay.renderMinecraftStyledOverlay
  ) {
    throw new Error("Le générateur partagé d’overlays n’est pas disponible.");
  }
  const selectedModel = Number(model) === 2 ? 2 : 1;
  const canvas = await ShenPulseGameOverlay.renderMinecraftStyledOverlay({
    backgroundColor: gameInteractionOverlayBackground(pack.id),
    entries: entries.map((entry) => ({
      effectImageUrl: entry.effectImageUrl,
      giftImageUrl: entry.giftImageUrl,
      giftLabel: entry.giftLabel,
      groupKey: entry.groupKey,
      label: entry.title,
      likeAmount: entry.likeAmount,
      triggerKey: entry.triggerKey,
      triggerType: entry.triggerType
    })),
    model: selectedModel
  });
  window.__lastGameInteractionOverlayPng = canvas.toDataURL("image/png");
  window.__lastGameInteractionOverlayMeta = {
    gameId: pack.id,
    height: canvas.height,
    model: selectedModel,
    width: canvas.width
  };
  const blob = await new Promise((resolve, reject) => {
    canvas.toBlob(
      (result) =>
        result
          ? resolve(result)
          : reject(new Error("Export PNG impossible.")),
      "image/png"
    );
  });
  const downloadUrl = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = downloadUrl;
  link.download =
    `${pack.id}-overlay-interactions-modele-${selectedModel}.png`;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(downloadUrl), 1500);
}

async function downloadGtaInteractionOverlay(packId, model = 1) {
  const pack = snapshot.packs.find((item) => item.id === packId);
  if (!pack) throw new Error("Jeu GTA introuvable.");
  const entries = gtaInteractionOverlayEntries(pack);
  if (!entries.length) {
    throw new Error("Activez au moins une interaction GTA avant de télécharger l’overlay.");
  }
  const canvas = document.createElement("canvas");
  canvas.width = 1080;
  canvas.height = 1920;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Création de l’image indisponible.");
  const prepared = await Promise.all(entries.map(async (entry) => ({
    ...entry,
    effectImage: await loadGtaOverlayImage(entry.effectImageUrl),
    giftImage: await loadGtaOverlayImage(entry.giftImageUrl)
  })));
  drawGtaInteractionOverlayLayout(context, prepared, model);
  if (!prepared.length) {
  const columns = 3;
  const gap = 14;
  const padding = 30;
  const cardWidth = (canvas.width - padding * 2 - gap * (columns - 1)) / columns;
  const cardHeight = model === 1 ? 150 : 164;
  const rows = Math.ceil(prepared.length / columns);
  const panelHeight = Math.min(910, rows * (cardHeight + gap) + 104);
  const panelY = canvas.height - panelHeight - 16;
  if (Number(model) === 1) {
    const gradient = context.createLinearGradient(0, panelY, canvas.width, canvas.height);
    gradient.addColorStop(0, gtaInteractionOverlayBackground());
    gradient.addColorStop(1, "#030712");
    roundedCanvasRect(context, 8, panelY, canvas.width - 16, panelHeight, 34);
    context.fillStyle = gradient;
    context.fill();
    context.strokeStyle = "rgba(245, 158, 11, .72)";
    context.lineWidth = 4;
    context.stroke();
  }
  context.textAlign = "left";
  drawGtaOverlayText(
    context,
    "INTERACTIONS GTA",
    padding,
    panelY + 42,
    canvas.width - padding * 2,
    30,
    Number(model) === 1 ? "#fbbf24" : "#ffffff"
  );
  prepared.forEach((entry, index) => {
    const column = index % columns;
    const row = Math.floor(index / columns);
    const x = padding + column * (cardWidth + gap);
    const y = panelY + 72 + row * (cardHeight + gap);
    roundedCanvasRect(context, x, y, cardWidth, cardHeight, 18);
    context.fillStyle = Number(model) === 1
      ? "rgba(2, 6, 23, .72)"
      : "rgba(4, 7, 18, .92)";
    context.fill();
    context.strokeStyle = Number(model) === 1
      ? "rgba(251, 191, 36, .45)"
      : "rgba(34, 211, 238, .5)";
    context.lineWidth = 2;
    context.stroke();
    const giftX = x + 16;
    const giftY = y + 14;
    if (!drawGtaOverlayImage(context, entry.giftImage, giftX, giftY, 50, 50)) {
      context.fillStyle = "#f59e0b";
      context.beginPath();
      context.arc(giftX + 25, giftY + 25, 23, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = "#ffffff";
      context.font = '700 24px "Segoe UI Emoji"';
      context.fillText("🎁", giftX + 10, giftY + 28);
    }
    if (!drawGtaOverlayImage(context, entry.effectImage, x + cardWidth - 78, y + 12, 62, 62)) {
      context.fillStyle = "rgba(255,255,255,.12)";
      context.fillRect(x + cardWidth - 70, y + 20, 48, 48);
    }
    drawGtaOverlayText(context, entry.title, x + 16, y + 96, cardWidth - 32, 23);
    drawGtaOverlayText(context, entry.trigger, x + 16, y + 128, cardWidth - 32, 18, "#cbd5e1");
  });
  }
  window.__lastGtaInteractionOverlayPng = canvas.toDataURL("image/png");
  const blob = await new Promise((resolve, reject) => {
    canvas.toBlob(
      (result) => result ? resolve(result) : reject(new Error("Export PNG impossible.")),
      "image/png"
    );
  });
  const downloadUrl = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = downloadUrl;
  link.download = `${pack.id}-overlay-interactions-modele-${Number(model) === 1 ? 1 : 2}.png`;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(downloadUrl), 1500);
}

function renderGameInteractions(pack, unlocked) {
  const query = gameEffectSearch.trim().toLocaleLowerCase();
  const rows = gameMappedEffects(pack)
    .map((row) => ({
      ...row,
      effect: pack.effects.find(
        (effect) => effect.id === row.action.config?.effectId
      )
    }))
    .filter((row) => row.effect);
  const categories = [
    ...new Set(rows.map((row) => row.effect.category || "Interaction"))
  ].sort((left, right) => left.localeCompare(right, "fr"));
  const visibleRows = rows.filter((row) => {
    const effect = row.effect;
    const title = row.rule.gameInteraction?.title || effect.name;
    const matchesCategory =
      gameEffectCategory === "all" || effect.category === gameEffectCategory;
    const matchesSearch =
      !query ||
      `${title} ${effect.name} ${effect.description} ${effect.code || ""} ${effect.category || ""} ${triggerLabel(row.rule)}`
        .toLocaleLowerCase()
        .includes(query);
    return matchesCategory && matchesSearch;
  });
  return `<div class="game-interactions-page">
    <header class="game-effects-heading">
      <span>${eventIconMarkup("gift")} INTERACTIONS <strong>${rows.length}</strong></span>
      <div class="button-row">
        <span class="game-effect-catalog-count">${pack.effects.length} actions disponibles</span>
        <button class="button primary" data-action="add-game-interaction" data-pack="${escapeHtml(pack.id)}" ${unlocked ? "" : "disabled"}>＋ Ajouter une interaction</button>
      </div>
    </header>
    <section class="game-interaction-toolbar">
      <label class="search-control"><span>⌕</span><input data-search="game-effects" type="search" value="${escapeHtml(gameEffectSearch)}" placeholder="Rechercher dans vos interactions"></label>
    </section>
    <div class="game-category-pills">
      <button class="${gameEffectCategory === "all" ? "active" : ""}" data-action="set-game-effect-category" data-value="all">Toutes <span>${rows.length}</span></button>
      ${categories.map((category) => `<button class="${gameEffectCategory === category ? "active" : ""}" data-action="set-game-effect-category" data-value="${escapeHtml(category)}">${escapeHtml(category)} <span>${rows.filter((row) => (row.effect.category || "Interaction") === category).length}</span></button>`).join("")}
    </div>
    <section class="game-interaction-grid">
      ${visibleRows.map((row) => {
        const effect = row.effect;
        const enabled = row.rule.enabled !== false;
        const title = row.rule.gameInteraction?.title || effect.name;
        const editorData = `data-action="edit-game-interaction" data-pack="${escapeHtml(pack.id)}" data-effect="${escapeHtml(effect.id)}" data-rule="${escapeHtml(row.rule.id)}" data-row-action="${escapeHtml(row.action.id || "")}" data-index="${row.actionIndex}"`;
        return `<article class="game-interaction-card configured ${enabled ? "" : "disabled"} ${effect.available === false ? "unavailable" : ""}">
        <div class="game-effect-side">
          <button class="game-effect-icon" data-action="toggle-game-interaction" data-pack="${escapeHtml(pack.id)}" data-rule="${escapeHtml(row.rule.id)}" title="${enabled ? "Désactiver" : "Activer"}" ${unlocked && effect.available !== false ? "" : "disabled"}>
            ${enabled
              ? '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z"/><circle cx="12" cy="12" r="2.7"/></svg>'
              : '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 3l18 18M10.6 6.2A10 10 0 0 1 12 6c6 0 9.5 6 9.5 6a16 16 0 0 1-2.2 2.8M6.2 6.3C3.8 8 2.5 12 2.5 12s3.5 6 9.5 6a9 9 0 0 0 3-.5M9.9 9.9a3 3 0 0 0 4.2 4.2"/></svg>'}
          </button>
          <button class="game-effect-icon danger" data-action="delete-game-interaction" data-pack="${escapeHtml(pack.id)}" data-rule="${escapeHtml(row.rule.id)}" title="Supprimer" ${unlocked ? "" : "disabled"}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M9 7V4h6v3M7 7l1 13h8l1-13M10 11v5M14 11v5"/></svg></button>
        </div>
        <button class="game-effect-main" ${editorData} title="${escapeHtml(effect.description || effect.name)}" ${unlocked && effect.available !== false ? "" : "disabled"}>
          <span class="game-effect-art">${effect.image ? `<img src="${escapeHtml(effect.image)}" alt="${escapeHtml(effect.name)}" loading="lazy">` : `<span>${escapeHtml(effect.icon || "◇")}</span>`}</span>
          <strong>${escapeHtml(title)}</strong>
          <small>${escapeHtml(effect.category || "Interaction")}</small>
        </button>
        <div class="game-effect-side right">
          <button class="game-effect-icon" ${editorData} title="Modifier" ${unlocked && effect.available !== false ? "" : "disabled"}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m4 20 4.2-1 10.4-10.4a2 2 0 0 0-2.8-2.8L5.4 16.2 4 20Z"/><path d="m14.5 7.1 2.8 2.8"/></svg></button>
          <button class="game-effect-icon play" data-action="test-game-interaction" data-pack="${escapeHtml(pack.id)}" data-rule="${escapeHtml(row.rule.id)}" data-row-action="${escapeHtml(row.action.id || "")}" data-index="${row.actionIndex}" title="${effect.actionType === "overlay.win-counter" ? "Tester sur l’overlay WINS" : "Tester dans le jeu"}" ${unlocked && effect.available !== false ? "" : "disabled"}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m8 5 11 7-11 7Z"/></svg></button>
        </div>
        <div class="game-effect-trigger">
          ${triggerPill(row.rule)}
        </div>
      </article>`;
      }).join("")}
    </section>
    ${visibleRows.length ? "" : emptyInline(rows.length ? "Aucune interaction ne correspond à cette recherche." : "Aucune interaction configurée. Utilisez « Ajouter une interaction » pour choisir une action du jeu.")}
    <footer class="game-step-footer">
      <div><strong>${rows.length} interaction${rows.length > 1 ? "s" : ""} configurée${rows.length > 1 ? "s" : ""}</strong><small>Chaque interaction et chaque déclencheur restent propres au profil actif.</small></div>
      <button class="button primary" data-action="game-step" data-value="overlays" ${unlocked ? "" : "disabled"}>Continuer vers les overlays →</button>
    </footer>
  </div>`;
}

function renderGamePageMessage(pack, scope) {
  const message = gamePageMessages.get(pack.id);
  if (!message || (message.scope && message.scope !== scope)) return "";
  return `<div class="game-page-message ${escapeHtml(message.type || "info")}" role="status">
    <span>${message.type === "error" ? "!" : "✓"}</span>
    <div><strong>${escapeHtml(message.title)}</strong><p>${escapeHtml(message.detail || "")}</p></div>
    <button type="button" data-action="dismiss-game-message" data-id="${escapeHtml(pack.id)}" aria-label="Fermer">×</button>
  </div>`;
}

function friendlyInstallStage(progress = {}) {
  if (progress.phase === "complete") {
    return {
      kicker: "TERMINÉ",
      title: "Installation terminée",
      detail: `${progress.gameTitle || "Le jeu"} est prêt dans ShenPulse.`
    };
  }
  if (progress.phase === "install") {
    return {
      kicker: "INSTALLATION",
      title: "Préparation automatique en cours",
      detail: progress.message || "ShenPulse installe les éléments nécessaires."
    };
  }
  if (progress.phase === "download") {
    return {
      kicker: "TÉLÉCHARGEMENT",
      title: "Récupération des éléments nécessaires",
      detail: progress.message || "Le téléchargement est sécurisé et peut prendre quelques minutes."
    };
  }
  return {
    kicker: "PRÉPARATION",
    title: "Recherche de votre jeu",
    detail: progress.message || "ShenPulse détecte automatiquement son emplacement."
  };
}

function formatTransferBytes(value) {
  const bytes = Math.max(0, Number(value || 0));
  if (bytes < 1024) return `${Math.round(bytes)} o`;
  const units = ["Ko", "Mo", "Go", "To"];
  let amount = bytes / 1024;
  let unitIndex = 0;
  while (amount >= 1024 && unitIndex < units.length - 1) {
    amount /= 1024;
    unitIndex += 1;
  }
  return `${amount >= 100 ? amount.toFixed(0) : amount.toFixed(1)} ${units[unitIndex]}`;
}

function formatTransferDuration(seconds) {
  const value = Math.max(0, Math.round(Number(seconds || 0)));
  if (value < 60) return `${value} s`;
  const minutes = Math.floor(value / 60);
  const rest = value % 60;
  if (minutes < 60) return `${minutes} min ${String(rest).padStart(2, "0")} s`;
  const hours = Math.floor(minutes / 60);
  return `${hours} h ${String(minutes % 60).padStart(2, "0")} min`;
}

function renderGameInstallProgressModal(pack) {
  if (
    !gameInstallProgress?.open ||
    gameInstallProgress.gameId !== pack.id
  ) {
    return "";
  }
  const stage = friendlyInstallStage(gameInstallProgress);
  const percent = Math.min(
    100,
    Math.max(0, Number(gameInstallProgress.percent || 0))
  );
  const complete = gameInstallProgress.phase === "complete";
  const downloading = gameInstallProgress.phase === "download";
  const indeterminate =
    !complete && Boolean(gameInstallProgress.indeterminate);
  const totalBytes = Math.max(
    0,
    Number(gameInstallProgress.totalBytes || 0)
  );
  const receivedBytes = Math.max(
    0,
    Number(gameInstallProgress.bytesReceived || 0)
  );
  const speedBps = Math.max(0, Number(gameInstallProgress.speedBps || 0));
  const rawDownloadPercent = gameInstallProgress.downloadPercent;
  const downloadPercent =
    rawDownloadPercent != null &&
    Number.isFinite(Number(rawDownloadPercent))
    ? Math.max(
        0,
        Math.min(100, Number(rawDownloadPercent))
      )
    : null;
  const startedAt = Date.parse(
    gameInstallProgress.startedAt ||
      gameInstallProgress.occurredAt ||
      new Date().toISOString()
  );
  const lastActivityAt = Date.parse(
    gameInstallProgress.lastActivityAt ||
      gameInstallProgress.occurredAt ||
      new Date().toISOString()
  );
  const elapsedSeconds = Math.max(
    0,
    Math.floor((Date.now() - startedAt) / 1000)
  );
  const idleSeconds = Math.max(
    0,
    Math.floor((Date.now() - lastActivityAt) / 1000)
  );
  const progressWidth = complete ? 100 : Math.max(3, percent);
  const current = Number(gameInstallProgress.current || 0);
  const total = Number(gameInstallProgress.total || 0);
  const waitingForNetwork = downloading && idleSeconds >= 10;
  const activityText = complete
    ? "Installation terminée."
    : gameInstallProgress.phase === "install"
      ? "Préparation locale des fichiers en cours…"
      : idleSeconds < 2
        ? "Activité en cours…"
        : idleSeconds < 10
          ? `Dernière activité il y a ${idleSeconds} s`
          : `Toujours en attente du serveur · ${idleSeconds} s`;
  return `<div class="game-progress-backdrop" role="presentation">
    <section class="game-progress-modal" role="dialog" aria-modal="true" aria-labelledby="game-progress-title">
      <header>
        <div><span>${escapeHtml(stage.kicker)}</span><h3 id="game-progress-title">${escapeHtml(stage.title)}</h3></div>
        <strong>${Math.round(percent)}%</strong>
      </header>
      <div class="game-progress-visual ${complete ? "complete" : ""} ${indeterminate ? "is-indeterminate" : ""}">
        <span>${complete ? "✓" : downloading ? "↓" : "↻"}</span>
        <div class="game-progress-track ${indeterminate ? "indeterminate" : ""}"><i style="width:${progressWidth}%"></i></div>
      </div>
      <p>${escapeHtml(stage.detail)}</p>
      ${complete ? "" : `<div class="game-progress-stats">
        <span><small>ÉTAPE</small><strong>${current && total ? `${current} sur ${total}` : "Préparation"}</strong></span>
        ${downloading ? `<span><small>TÉLÉCHARGÉ</small><strong>${formatTransferBytes(receivedBytes)}${totalBytes ? ` / ${formatTransferBytes(totalBytes)}` : ""}</strong></span>` : ""}
        ${downloading ? `<span><small>PROGRESSION</small><strong>${downloadPercent === null ? "Calcul…" : `${Math.round(downloadPercent)} %`}</strong></span>` : ""}
        ${downloading ? `<span><small>VITESSE</small><strong>${speedBps ? `${formatTransferBytes(speedBps)}/s` : "Connexion…"}</strong></span>` : ""}
        ${downloading && gameInstallProgress.etaSeconds != null ? `<span><small>RESTANT</small><strong>${formatTransferDuration(gameInstallProgress.etaSeconds)}</strong></span>` : ""}
        <span><small>ÉCOULÉ</small><strong>${formatTransferDuration(elapsedSeconds)}</strong></span>
      </div>`}
      <div class="game-progress-activity ${waitingForNetwork ? "waiting" : ""}">
        <i></i>
        <span>${escapeHtml(activityText)}</span>
      </div>
      <small>${complete ? "Vous pouvez continuer la configuration." : waitingForNetwork ? "ShenPulse fonctionne toujours. Si aucune donnée n’arrive pendant une minute, un message d’erreur vous proposera de réessayer." : gameInstallProgress.phase === "install" ? "L’extraction et la copie peuvent prendre plusieurs minutes selon votre disque." : "Gardez ShenPulse ouvert jusqu’à la fin de l’installation."}</small>
      ${complete ? `<footer><button class="button primary" data-action="dismiss-game-progress">Continuer</button></footer>` : ""}
    </section>
  </div>`;
}

function renderGameLaunchProgressModal(pack) {
  if (
    !gameLaunchProgress?.open ||
    gameLaunchProgress.gameId !== pack.id
  ) {
    return "";
  }
  const elapsedSeconds = Math.max(
    0,
    Math.floor(
      (Date.now() - Number(gameLaunchProgress.startedAt || Date.now())) / 1000
    )
  );
  return `<div class="game-progress-backdrop game-launch-progress-backdrop" role="presentation">
    <section class="game-progress-modal game-launch-progress-modal" role="dialog" aria-modal="true" aria-labelledby="game-launch-progress-title">
      <header>
        <div><span>DÉMARRAGE DU SERVEUR</span><h3 id="game-launch-progress-title">PaperMC se prépare</h3></div>
        <strong>Veuillez patienter</strong>
      </header>
      <div class="game-progress-visual is-indeterminate">
        <span>↻</span>
        <div class="game-progress-track indeterminate"><i></i></div>
      </div>
      <p>ShenPulse démarre le serveur, attend qu’il soit réellement prêt, puis active les interactions et le chrono.</p>
      <div class="game-progress-stats">
        <span><small>ÉTAT</small><strong>Initialisation en cours…</strong></span>
        <span><small>ÉCOULÉ</small><strong>${formatTransferDuration(elapsedSeconds)}</strong></span>
      </div>
      <div class="game-progress-activity">
        <i></i>
        <span>En attente du message « serveur prêt » de PaperMC…</span>
      </div>
      <small>Un seul clic suffit. Cette fenêtre se fermera automatiquement lorsque le bouton passera sur « Arrêter la session de jeu ».</small>
    </section>
  </div>`;
}

function gameInteractionRules(packId) {
  const rules =
    snapshot?.state?.game?.interactionRulesByPack?.[packId];
  return Array.isArray(rules) ? rules : [];
}

function gameMappedEffects(pack) {
  return gameInteractionRules(pack.id).flatMap((rule) =>
    (rule.actions || [])
      .map((action, actionIndex) => ({
        rule,
        action,
        actionIndex
      }))
      .filter(
        (row) =>
          ["game.effect", "overlay.win-counter"].includes(
            row.action.type
          ) &&
          row.action.config?.effectId
      )
  );
}

function gameInteractionReadinessIssues(pack) {
  if (!pack) return [];
  const activeRules = gameInteractionRules(pack.id).filter(
    (rule) => rule.enabled !== false
  );
  if (!activeRules.length) {
    return [
      {
        name: "Interactions du jeu",
        reason: "aucune interaction n’est active"
      }
    ];
  }
  const availableEffectIds = new Set(
    (pack.effects || [])
      .filter((effect) => effect.available !== false)
      .map((effect) => effect.id)
  );
  return activeRules.flatMap((rule) => {
    const reasons = [];
    const triggerType = String(rule.trigger?.type || "").trim();
    if (hasAutomaticTrigger(rule)) {
      if (!triggerType || triggerType === "*") {
        reasons.push("aucun déclencheur précis n’est défini");
      }
      if (
        triggerType === "gift" &&
        !String(ruleGiftName(rule) || "").trim()
      ) {
        reasons.push("aucun cadeau TikTok n’est sélectionné");
      }
      if (
        ["like", "likes"].includes(triggerType) &&
        (!Number.isFinite(Number(rule.trigger?.threshold)) ||
          Number(rule.trigger?.threshold) <= 0)
      ) {
        reasons.push("le nombre de likes requis n’est pas valide");
      }
    }
    const mappedActions = (rule.actions || []).filter(
      (action) =>
        action.enabled !== false &&
        ["game.effect", "overlay.win-counter"].includes(action.type)
    );
    if (!mappedActions.length) {
      reasons.push("aucun effet de jeu n’est configuré");
    } else if (
      !mappedActions.some((action) =>
        availableEffectIds.has(String(action.config?.effectId || ""))
      )
    ) {
      reasons.push("l’effet configuré n’est pas disponible pour ce jeu");
    }
    const name = String(
      rule.gameInteraction?.title || rule.name || "Interaction sans nom"
    ).trim();
    return reasons.map((reason) => ({ name, reason }));
  });
}

async function confirmGameInteractionReadiness(pack, operationLabel) {
  const issues = gameInteractionReadinessIssues(pack);
  if (!issues.length) return true;
  const visibleIssues = issues
    .slice(0, 10)
    .map((issue) => `• ${issue.name} : ${issue.reason}`)
    .join("\n");
  const hiddenCount = Math.max(0, issues.length - 10);
  return confirmAction(
    `Interactions à vérifier avant ${operationLabel}\n\n` +
      `${visibleIssues}` +
      (hiddenCount ? `\n• … et ${hiddenCount} autre${hiddenCount > 1 ? "s" : ""}` : "") +
      "\n\nLe fonctionnement sera dégradé tant que ces réglages ne seront pas complétés.\n\nContinuer quand même ?",
    {
      title: "Interactions incomplètes",
      confirmLabel: "Continuer quand même"
    }
  );
}

function findGameInteractionRow(
  packId,
  ruleId,
  actionId,
  actionIndex
) {
  const pack = snapshot.packs.find((entry) => entry.id === packId);
  if (!pack) return null;
  return gameMappedEffects(pack).find(
    (row) =>
      row.rule.id === ruleId &&
      (actionId
        ? row.action.id === actionId
        : row.actionIndex === Number(actionIndex))
  );
}

function renderMembership() {
  const subscription = currentSubscription();
  const premiumBeneficiary =
    snapshot.state.commerce?.premiumSeat?.beneficiaryEmail || "";
  const paidGames = visibleGamePacks().filter(
    (pack) => pack.accessMode === "purchase"
  );
  return `
    <div class="reference-page membership-page">
      <section class="page-hero compact">
        <div><span class="hero-chip">ACCÈS SHENPULSE</span><h2>Tarifs & abonnements</h2><p>Les droits sont synchronisés par le compte ShenPulse. Premium comprend toujours l’intégralité de Pro.</p></div>
        <span class="membership-current">${escapeHtml(subscription.tier || "free")}</span>
      </section>
      <div class="subscription-grid">
        ${SUBSCRIPTION_PLANS.map((plan) => `
          <article class="subscription-card ${subscription.tier === plan.tier ? "current" : ""} ${plan.tier === "premium" ? "premium" : ""}">
            <header><span>${plan.tier === "premium" ? "♛" : plan.tier === "pro" ? "◆" : "○"}</span><div><small>${subscription.tier === plan.tier ? "ABONNEMENT ACTUEL" : "OFFRE MENSUELLE"}</small><h3>${plan.name}</h3></div></header>
            <strong>${plan.price === 0 ? "Gratuit" : `${plan.price.toFixed(2).replace(".", ",")} €`}<small>${plan.price ? " / mois" : ""}</small></strong>
            <p>${plan.description}</p>
            <ul>${plan.features.map((feature) => `<li>✓ ${feature}</li>`).join("")}</ul>
            ${subscription.tier === plan.tier ? `<button class="button" disabled>Offre active</button>` : `<button class="button primary" data-action="open-url" data-value="https://shenpulse.leuridan.fr">Choisir ${plan.name}</button>`}
          </article>`).join("")}
      </div>
      ${hasActivePaidPremium() ? `
        <section class="premium-seat-panel">
          <div class="premium-seat-copy">
            <span class="premium-seat-icon" aria-hidden="true">♛</span>
            <div>
              <small>AVANTAGE PREMIUM</small>
              <h3>Offrez un accès Pro</h3>
              <p>Renseignez l’adresse e-mail du compte ShenPulse qui bénéficiera gratuitement d’un espace Pro complet.</p>
              ${premiumBeneficiary
                ? `<span class="premium-seat-current">Accès Pro actuellement offert à <strong>${escapeHtml(premiumBeneficiary)}</strong></span>`
                : ""}
            </div>
          </div>
          <form id="premium-seat-form" class="premium-seat-form">
            <label for="premium-beneficiary-email">Adresse e-mail du bénéficiaire</label>
            <div>
              <span aria-hidden="true">✉</span>
              <input id="premium-beneficiary-email" name="beneficiaryEmail" value="${escapeHtml(premiumBeneficiary)}" type="email" required maxlength="254" placeholder="utilisateur@exemple.fr" autocomplete="email" autocapitalize="none" spellcheck="false">
              <button class="button primary" type="submit">Offrir l’accès Pro</button>
            </div>
            <small>Un seul compte peut bénéficier de cet accès. Le bénéficiaire devra se connecter avec exactement cette adresse e-mail.</small>
          </form>
        </section>
      ` : ""}
      <section class="studio-panel commerce-note panel-cyan">
        <div><span class="panel-accent"></span><div><h3>Accès aux jeux</h3><p>Le catalogue est visible avec l’offre Free, mais l’entrée dans tous les jeux exige un abonnement Pro ou Premium actif. Premium comprend toujours tous les droits Pro.</p></div></div>
        <span class="badge success">PREMIUM = PRO + PREMIUM</span>
      </section>
      <section class="commerce-games">
        <header><div><h3>Jeux vendus séparément</h3><p>Ces jeux demandent à la fois un abonnement Pro ou Premium actif et l’achat du jeu, ou un essai de jeu actif.</p></div><span>${paidGames.length} jeux</span></header>
        <div>
          ${paidGames.map((pack) => `<article><img src="${escapeHtml(gameArtwork(pack))}" alt=""><div><strong>${escapeHtml(pack.name)}</strong><small>ABONNEMENT + ACHAT UNIQUE</small></div><b>${escapeHtml(gamePrice(pack))}</b></article>`).join("")}
        </div>
      </section>
    </div>`;
}

function renderOverlays() {
  const urls = snapshot.overlayUrls;
  const overlays = [
    ["Alertes & médias", "Animations, sons, vidéos et cadeaux.", "alerts", "▱"],
    ["Objectifs", "Progression des likes, follows, cadeaux ou valeurs.", "goals", "◎"],
    ["Flux d’activité", "Dernières interactions du public.", "feed", "≡"],
    ["Effets de jeu", "Affiche les effets lancés et leur auteur.", "game", "◇"],
    ["Compte à rebours", "Temps ajouté ou retiré par les règles.", "timer", "◷"],
    ["Roue des cadeaux", "Sélection aléatoire animée parmi vos choix.", "wheel", "✺"]
  ];
  return `
    <div class="section-toolbar">
      <div><h2>Sources navigateur locales</h2><p>Ajoutez chaque URL comme source navigateur dans OBS ou source lien dans LIVE Studio.</p></div>
      <button class="button" data-action="restart-servers">↻ Redémarrer les services</button>
    </div>
    <div class="overlay-grid">
      ${overlays.map(([name, description, key, icon]) => `
        <article class="card entity-card">
          <div class="entity-top"><span class="effect-icon">${icon}</span><span class="badge success">LOCAL</span></div>
          <h3 style="margin-top:13px">${name}</h3><p>${description}</p>
          <div class="url-field"><code>${escapeHtml(urls[key])}</code><button class="button small" data-action="copy" data-value="${escapeHtml(urls[key])}">Copier</button></div>
          <div class="entity-actions"><button class="button small" data-action="open-url" data-value="${escapeHtml(urls[key])}">Prévisualiser</button></div>
        </article>`).join("")}
    </div>
    <article class="card" style="margin-top:16px">
      <header class="card-header"><div><p class="eyebrow">API DÉVELOPPEUR</p><h3>Endpoint WebSocket local</h3></div><span class="badge cyan">JSON TEMPS RÉEL</span></header>
      <div class="card-body"><p style="margin:0;color:var(--muted);font-size:11px">Recevez tous les événements avec le format <code>{ event, data }</code> ou injectez des événements autorisés via l’API authentifiée.</p><div class="url-field"><code>${escapeHtml(urls.api)}</code><button class="button small" data-action="copy" data-value="${escapeHtml(urls.api)}">Copier</button></div></div>
    </article>`;
}

function renderGames() {
  const state = snapshot.state;
  const pack = snapshot.packs.find((item) => item.id === state.session.activeGamePackId) || snapshot.packs[0];
  return `
    <div class="split-layout">
      <aside class="card pack-list">
        <header class="card-header"><div><p class="eyebrow">BIBLIOTHÈQUE</p><h3>${snapshot.packs.length} packs installés</h3></div></header>
        ${snapshot.packs.map((item) => `
          <button class="pack-item ${item.id === pack.id ? "active" : ""}" data-action="select-game" data-id="${escapeHtml(item.id)}">
            <span class="pack-logo">${escapeHtml(item.name.slice(0, 1))}</span>
            <span><strong>${escapeHtml(item.name)}</strong><small>${escapeHtml(item.connector.type)} · ${item.effects.length} effets</small></span>
            <span class="chevron">›</span>
          </button>`).join("")}
      </aside>
      <section class="card">
        <header class="card-header">
          <div><p class="eyebrow">${escapeHtml(pack.publisher)} · ${escapeHtml(pack.version)}</p><h2>${escapeHtml(pack.name)}</h2><p>${escapeHtml(pack.description)}</p></div>
          <div class="toolbar-actions"><button class="button small" data-action="configure-game" data-id="${escapeHtml(pack.id)}">Configurer</button><button class="button small primary" data-action="test-game" data-id="${escapeHtml(pack.id)}">Tester</button></div>
        </header>
        <div class="card-body">
          <div class="entity-meta" style="margin:0 0 16px">${pack.tags.map((tag) => `<span class="badge">${escapeHtml(tag)}</span>`).join("")}<span class="badge cyan">${escapeHtml(pack.connector.type)}</span></div>
          <div class="effect-grid">
            ${pack.effects.map((effect) => `
              <article class="effect-card">
                <span class="effect-icon">${escapeHtml(effect.icon || "◇")}</span>
                <h4>${escapeHtml(effect.name)}</h4>
                <p>${escapeHtml(effect.description)}</p>
                <button class="button small" data-action="trigger-effect" data-id="${escapeHtml(effect.id)}">Déclencher</button>
              </article>`).join("")}
          </div>
        </div>
      </section>
    </div>`;
}

function renderGoals() {
  const goals = snapshot.state.goals;
  return `
    <div class="section-toolbar"><div><h2>Objectifs du live</h2><p>Affichez la progression et mettez-la à jour depuis vos règles.</p></div><button class="button primary" data-action="add-goal">＋ Nouvel objectif</button></div>
    <div class="goal-grid">
      ${goals.map((goal) => {
        const progress = Math.min(100, Math.round((Number(goal.current) / Math.max(1, Number(goal.target))) * 100));
        return `<article class="card entity-card">
          <div class="entity-top"><div><h3>${escapeHtml(goal.name)}</h3><p>${escapeHtml(goal.type)} · ${progress}% atteint</p></div><label class="switch"><input type="checkbox" data-action="toggle-goal" data-id="${escapeHtml(goal.id)}" ${goal.enabled ? "checked" : ""}><span></span></label></div>
          <div class="goal-progress"><span style="width:${progress}%;background:linear-gradient(90deg,var(--cyan),${escapeHtml(goal.color || "var(--violet)")})"></span></div>
          <div class="goal-numbers"><span>${asNumber(goal.current)}</span><span>${asNumber(goal.target)}</span></div>
          <div class="entity-actions"><button class="button small" data-action="edit-goal" data-id="${escapeHtml(goal.id)}">Modifier</button><button class="button small ghost" data-action="reset-goal" data-id="${escapeHtml(goal.id)}">Réinitialiser</button><button class="button small ghost" data-action="delete-entity" data-collection="goals" data-id="${escapeHtml(goal.id)}">Supprimer</button></div>
        </article>`;
      }).join("")}
    </div>`;
}

function renderCommands() {
  const commands = snapshot.state.commands;
  return `
    <div class="section-toolbar"><div><h2>Commandes du chat</h2><p>Réponses via la source quand elle l’autorise, sinon affichage dans l’overlay.</p></div><button class="button primary" data-action="add-command">＋ Nouvelle commande</button></div>
    <section class="card">
      <div class="card-body list">
        ${commands.length ? commands.map((command) => `
          <div class="list-row">
            <span class="event-icon">⌘</span>
            <div><h4>${escapeHtml(command.command)} · ${escapeHtml(command.response)}</h4><p>${command.subscriberOnly ? "Abonnés uniquement" : "Tout le monde"} · cooldown ${Math.round(Number(command.cooldownMs || 0) / 1000)}s</p></div>
            <div class="toolbar-actions"><label class="switch"><input type="checkbox" data-action="toggle-command" data-id="${escapeHtml(command.id)}" ${command.enabled ? "checked" : ""}><span></span></label><button class="button small" data-action="edit-command" data-id="${escapeHtml(command.id)}">Modifier</button><button class="button small ghost" data-action="delete-entity" data-collection="commands" data-id="${escapeHtml(command.id)}">Supprimer</button></div>
          </div>`).join("") : emptyInline("Ajoutez votre première commande.")}
      </div>
    </section>`;
}

function renderConnections() {
  if (!isAccountAuthenticated()) {
    return renderPrivateDataPlaceholder(
      "Sources protégées",
      "Les comptes TikTok, relais, connexions locales et leur état ne sont jamais affichés sans compte ShenPulse connecté."
    );
  }
  const connections = snapshot.state.connections;
  return `
    <div class="section-toolbar"><div><h2>Sources d’événements</h2><p>Utilisez uniquement une API, un relais ou des identifiants que vous êtes autorisé à exploiter.</p></div><button class="button primary" data-action="add-connection">＋ Ajouter une source</button></div>
    <div class="connector-grid">
      ${connections.map((connection) => {
        const statusClass = connection.status === "connected" ? "success" : connection.status === "error" ? "error" : "";
        return `<article class="card entity-card">
          <div class="entity-top"><span class="connector-icon">${connection.type === "demo" ? "◈" : connection.type === "twitch-irc" ? "T" : "⌁"}</span><span class="badge ${statusClass}">${escapeHtml(connection.status || "disconnected")}</span></div>
          <h3 style="margin-top:13px">${escapeHtml(connection.name)}</h3><p>${escapeHtml(connection.type)}${connection.config?.url ? ` · ${escapeHtml(connection.config.url)}` : ""}</p>
          <div class="entity-meta"><span class="badge ${connection.enabled ? "cyan" : ""}">${connection.enabled ? "AUTO" : "MANUEL"}</span>${connection.hasSecret ? '<span class="badge success">SECRET CHIFFRÉ</span>' : ""}</div>
          <div class="entity-actions">
            <button class="button small ${connection.status === "connected" ? "danger" : "primary"}" data-action="${connection.status === "connected" ? "stop-connection" : "start-connection"}" data-id="${escapeHtml(connection.id)}">${connection.status === "connected" ? "Déconnecter" : "Connecter"}</button>
            <button class="button small" data-action="edit-connection" data-id="${escapeHtml(connection.id)}">Modifier</button>
            ${connection.type === "demo" ? "" : `<button class="button small ghost" data-action="delete-entity" data-collection="connections" data-id="${escapeHtml(connection.id)}">Supprimer</button>`}
          </div>
        </article>`;
      }).join("")}
    </div>
    <article class="card" style="margin-top:16px"><header class="card-header"><div><p class="eyebrow">TIKTOK LIVE</p><h3>Détection automatique</h3></div><span class="badge success">AUCUN RÉGLAGE TECHNIQUE</span></header><div class="card-body"><p style="margin:0;color:var(--muted);font-size:11px;line-height:1.7">Renseignez seulement le @ TikTok. ShenPulse surveille ensuite le compte, détecte son passage en LIVE, reçoit les cadeaux, likes, follows, partages, abonnements et chats, puis se reconnecte automatiquement entre les sessions.</p></div></article>`;
}

function renderActivity() {
  if (!isAccountAuthenticated()) {
    return renderPrivateDataPlaceholder(
      "Journal inaccessible",
      "Connectez-vous pour consulter le journal local de ShenPulse."
    );
  }
  const entries = snapshot.state.activity;
  return `
    <div class="section-toolbar"><div><h2>${entries.length} entrées locales</h2><p>Les secrets sont masqués et aucune télémétrie n’est envoyée.</p></div><button class="button" data-action="export-data">Exporter la configuration</button></div>
    <section class="card">
      ${entries.length ? `<table class="activity-table"><thead><tr><th>HEURE</th><th>NIVEAU</th><th>CATÉGORIE</th><th>ÉVÉNEMENT</th><th>DÉTAIL</th></tr></thead><tbody>${entries.map((entry) => `<tr><td>${formatTime(entry.timestamp)}</td><td><span class="badge ${entry.level === "error" ? "error" : entry.level === "success" ? "success" : ""}">${escapeHtml(entry.level)}</span></td><td>${escapeHtml(entry.category)}</td><td><strong>${escapeHtml(entry.title)}</strong></td><td>${escapeHtml(entry.detail)}</td></tr>`).join("")}</tbody></table>` : emptyInline("Le journal est vide.")}</section>`;
}

function renderPrivateDataPlaceholder(title, detail) {
  return `<section class="card guest-private-placeholder">
    <span aria-hidden="true">◇</span>
    <h2>${escapeHtml(title)}</h2>
    <p>${escapeHtml(detail)}</p>
    <button class="button primary" type="button" data-action="account-login">Se connecter ou s’inscrire</button>
  </section>`;
}

function renderSettings() {
  if (!isAccountAuthenticated()) {
    return `<div class="settings-layout guest-settings-overview">
      <section class="card">
        <header class="card-header"><div><p class="eyebrow">APPLICATION</p><h3>Comportement</h3></div></header>
        <div class="card-body"><p>Les services locaux, les préférences de fenêtre et les autorisations système se configurent ici après connexion.</p></div>
      </section>
      <section class="card">
        <header class="card-header"><div><p class="eyebrow">AUDIO</p><h3>Synthèse vocale</h3></div></header>
        <div class="card-body"><p>La voix, la vitesse et le volume restent consultables et modifiables uniquement par le compte connecté.</p></div>
      </section>
      <section class="card">
        <header class="card-header"><div><p class="eyebrow">INTÉGRATIONS</p><h3>OBS, Spotify et stockage</h3></div></header>
        <div class="card-body"><p>Les adresses, identifiants, ports, jetons et secrets enregistrés sur cet appareil sont masqués en mode consultation.</p></div>
      </section>
      <section class="card">
        <header class="card-header"><div><p class="eyebrow">DONNÉES LOCALES</p><h3>Import, export et suppression</h3></div></header>
        <div class="card-body"><p>Aucune opération sur les données locales n’est autorisée sans connexion à ShenPulse.</p></div>
      </section>
    </div>`;
  }
  const settings = snapshot.state.settings;
  const backblaze = settings.backblaze || {};
  const backblazeConfigured = Boolean(
    backblaze.keyIdSecretId && backblaze.applicationKeySecretId
  );
  return `
    <form id="settings-form" class="page-grid">
      <div class="settings-layout">
        <section class="card">
          <header class="card-header"><div><p class="eyebrow">APPLICATION</p><h3>Comportement</h3></div></header>
          <div class="card-body">
            ${checkRow("Démarrer les services locaux", "Overlays et API disponibles dès l’ouverture.", "startOverlayServer", settings.startOverlayServer)}
            ${checkRow("Réduire à la fermeture", "Préférence conservée pour une future icône de zone de notification.", "minimizeToTray", settings.minimizeToTray)}
            ${checkRow("Autoriser la simulation de touches", "Permet aux règles explicitement configurées de contrôler une application Windows.", "allowKeystrokes", settings.allowKeystrokes)}
            ${checkRow("Télémétrie", "Désactivée : aucune télémétrie n’est actuellement implémentée.", "telemetry", settings.telemetry)}
          </div>
        </section>
        <section class="card">
          <header class="card-header"><div><p class="eyebrow">SERVICES LOCAUX</p><h3>Ports & sécurité</h3></div></header>
          <div class="card-body form-grid">
            <label class="field"><span>Port overlays</span><input type="number" name="overlayPort" min="1024" max="65535" value="${escapeHtml(settings.overlayPort)}"></label>
            <label class="field"><span>Port API</span><input type="number" name="apiPort" min="1024" max="65535" value="${escapeHtml(settings.apiPort)}"></label>
            <label class="field full"><span>Jeton API local</span><input type="text" readonly value="${escapeHtml(settings.apiToken)}"><small>Le jeton reste sur cet appareil. Régénérez les données pour le remplacer.</small></label>
          </div>
        </section>
        <section class="card">
          <header class="card-header"><div><p class="eyebrow">SYNTHÈSE VOCALE</p><h3>Voix du stream</h3></div></header>
          <div class="card-body form-grid">
            ${ttsVoiceField("ttsVoice", settings.tts.voice || "")}
            <label class="field"><span>Vitesse</span><input type="number" name="ttsRate" min="0.5" max="2" step="0.1" value="${escapeHtml(settings.tts.rate)}"></label>
            <label class="field"><span>Hauteur</span><input type="number" name="ttsPitch" min="0" max="2" step="0.1" value="${escapeHtml(settings.tts.pitch)}"></label>
            <label class="field"><span>Volume</span><input type="number" name="ttsVolume" min="0" max="1" step="0.1" value="${escapeHtml(settings.tts.volume)}"></label>
          </div>
        </section>
        <section class="card">
          <header class="card-header"><div><p class="eyebrow">INTÉGRATIONS</p><h3>OBS & Spotify</h3></div><button class="button small" type="button" data-action="test-obs">Tester OBS</button></header>
          <div class="card-body form-grid">
            <label class="field full"><span>OBS WebSocket</span><input name="obsUrl" value="${escapeHtml(settings.obs.url)}"></label>
            <label class="field full"><span>Nouveau mot de passe OBS</span><input type="password" name="obsPassword" placeholder="${settings.obs.passwordSecretId ? "Secret déjà enregistré" : "Facultatif"}"></label>
            <label class="field full"><span>Client ID de l’application Spotify</span><input name="spotifyClientId" value="${escapeHtml(settings.spotify?.clientId || "")}" placeholder="Identifiant public depuis developer.spotify.com"><small>Ajoutez cette URI de redirection dans votre application Spotify : ${escapeHtml(`http://127.0.0.1:${settings.spotify?.redirectPort || 21215}/spotify/callback`)}</small></label>
            <label class="field"><span>Port OAuth Spotify</span><input type="number" name="spotifyRedirectPort" min="1024" max="65535" value="${escapeHtml(settings.spotify?.redirectPort || 21215)}"></label>
            <div class="field"><span>État Spotify</span><strong>${settings.spotify?.refreshTokenSecretId ? "Compte autorisé" : "Non connecté"}</strong><small>Les jetons OAuth sont chiffrés par le coffre-fort Windows.</small></div>
          </div>
        </section>
        <section class="card">
          <header class="card-header"><div><p class="eyebrow">STOCKAGE MÉDIA GLOBAL</p><h3>Backblaze B2</h3><small>Sons, images, GIF et vidéos personnalisés.</small></div><span class="badge ${backblazeConfigured ? "success" : ""}">${backblazeConfigured ? "CONFIGURÉ" : "À CONFIGURER"}</span></header>
          <div class="card-body form-grid">
            ${field("backblazeBucket", "Bucket", backblaze.bucket || "", "text", "full")}
            ${field("backblazeEndpoint", "Endpoint S3", backblaze.endpoint || "", "text", "full")}
            ${field("backblazeRegion", "Région", backblaze.region || "")}
            ${field("backblazePrefix", "Dossier", backblaze.prefix || "mediauploads")}
            ${field("backblazePublicBaseUrl", "URL publique", backblaze.publicBaseUrl || "", "url", "full")}
            ${field("backblazeMaxMb", "Taille maximale (Mo)", Math.round(Number(backblaze.maxBytes || 209715200) / 1024 / 1024), "number", 'min="1" max="200"')}
            <label class="field"><span>Nouveau Key ID</span><input type="password" name="backblazeKeyId" placeholder="${backblaze.keyIdSecretId ? "Clé chiffrée enregistrée" : "À renseigner"}"></label>
            <label class="field"><span>Nouvelle Application Key</span><input type="password" name="backblazeApplicationKey" placeholder="${backblaze.applicationKeySecretId ? "Clé chiffrée enregistrée" : "À renseigner"}"></label>
            <div class="field full"><small>Les clés sont conservées dans le coffre-fort Windows et ne sont jamais envoyées au renderer. Elles servent uniquement à importer les sons choisis dans le bucket.</small></div>
          </div>
        </section>
      </div>
      <section class="card">
        <header class="card-header"><div><p class="eyebrow">DONNÉES & CONFIDENTIALITÉ</p><h3>Contrôle local</h3></div></header>
        <div class="card-body">
          <div class="button-row"><button class="button" type="button" data-action="export-data">Exporter</button><button class="button" type="button" data-action="import-data">Importer</button><button class="button danger" type="button" data-action="clear-data">Effacer toutes les données</button></div>
          <p style="margin:14px 0 0;color:var(--muted);font-size:10px">Les fonctions de live restent locales. Les secrets sont chiffrés par le coffre-fort Windows quand il est disponible.</p>
        </div>
      </section>
      <section class="card admin-access-card">
        <header class="card-header">
          <div><p class="eyebrow">ADMINISTRATION PRIVÉE</p><h3>Panneau propriétaire</h3></div>
          <span class="badge ${isVerifiedAdminSession() ? "success" : ""}">${isVerifiedAdminSession() ? "ACCÈS VÉRIFIÉ" : "VERROUILLÉ"}</span>
        </header>
        <div class="card-body">
          <p>${isVerifiedAdminSession()
            ? `Session sécurisée active pour <strong>${escapeHtml(adminSession.email)}</strong>. Les droits sont revérifiés côté serveur pour chaque modification.`
            : "Connexion réservée au compte propriétaire ShenPulse. Un autre compte, même connecté à Firebase, sera refusé par le backend."}</p>
          <div class="button-row">
            ${isVerifiedAdminSession()
              ? `<button class="button primary" type="button" data-action="open-admin">Ouvrir l’administration</button><button class="button ghost" type="button" data-action="admin-logout">Déconnecter l’admin</button>`
              : `<button class="button primary" type="button" data-action="admin-login">Connexion propriétaire</button>`}
          </div>
        </div>
      </section>
      <div class="button-row" style="justify-content:flex-end"><button class="button primary" type="submit">Enregistrer les paramètres</button></div>
    </form>`;
}

const ADMIN_VISIBILITY_SECTIONS = [
  ["navigation", "Pages ShenPulse", "Les 13 pages réellement présentes dans la navigation de ShenPulseNew"],
  ["features", "Fonctionnalités", "Les services réellement disponibles dans l’application"],
  ["actionTypes", "Actions disponibles", "Les actions proposées dans les éditeurs ShenPulseNew"],
  ["overlays", "Overlays", "Les 17 overlays réellement présents dans la galerie"],
  ["games", "Jeux", "Le catalogue actuel de jeux et packs ShenPulseNew"]
];

const ADMIN_OVERLAY_CATEGORY_LABELS = {
  actions: "Actions",
  engagement: "Engagement",
  interactions: "Interactions",
  matches: "Matchs",
  rankings: "Classements",
  utilities: "Utilitaires"
};

function adminVisibilityCatalog() {
  let pageGroup = "ShenPulse";
  const navigationItems = [];
  for (const page of pages) {
    if (page.section) {
      pageGroup = page.section;
      continue;
    }
    if (!page.id || page.id === "admin") continue;
    navigationItems.push({
      id: page.id,
      label: page.label,
      detail: `${page.title} · ${page.kicker}`,
      group: pageGroup,
      icon: page.icon
    });
  }
  return {
    navigation: navigationItems,
    features: visibilityTools.FEATURE_ITEMS.map((item) => ({ ...item })),
    actionTypes: Object.entries(ACTION_TYPE_LABELS).map(([id, label]) => ({
      id,
      label,
      detail: "Action disponible dans les déclencheurs et automatisations",
      icon: "⚡"
    })),
    overlays: overlayDefinitions().map((overlay) => ({
      id: overlay.key,
      label: overlay.name,
      detail:
        ADMIN_OVERLAY_CATEGORY_LABELS[overlay.category] ||
        "Overlay ShenPulse",
      icon: "▱"
    })),
    games: (snapshot?.packs || []).map((pack) => ({
      id: pack.id,
      label: pack.name,
      detail: `${pack.category || "Jeu interactif"} · ${
        pack.accessMode === "purchase" ? "achat séparé" : "inclus"
      }`,
      icon: "◇"
    }))
  };
}

function canonicalAdminSiteSettings(settings) {
  return visibilityTools.canonicalizeVisibility(
    settings,
    adminVisibilityCatalog()
  );
}

function adminVisibilityAudit(settings) {
  return visibilityTools.auditVisibility(
    settings,
    adminVisibilityCatalog()
  );
}

function adminVisibilityMeta(section) {
  return (
    ADMIN_VISIBILITY_SECTIONS.find(([id]) => id === section) ||
    ADMIN_VISIBILITY_SECTIONS[0]
  );
}

function adminVisibilityStorageKey(id) {
  return visibilityTools.storageKey(id);
}

function renderAdmin() {
  if (!isVerifiedAdminSession()) {
    return `<section class="admin-locked">
      <span>♜</span>
      <p class="eyebrow">ACCÈS PROPRIÉTAIRE</p>
      <h2>Administration verrouillée</h2>
      <p>Seul le compte propriétaire ShenPulse peut ouvrir cet espace. L’autorisation est vérifiée côté serveur.</p>
      <button class="button primary" data-action="admin-login">Se connecter</button>
    </section>`;
  }
  if (adminBusy && !adminDashboard) {
    return `<section class="admin-locked"><span class="pulse-loader"></span><h2>Chargement de l’administration…</h2><p>Lecture des réglages, essais et tarifs publiés.</p></section>`;
  }
  if (!adminDashboard) {
    return `<section class="admin-locked"><span>!</span><h2>Données non chargées</h2><p>La session est valide, mais les données distantes doivent être actualisées.</p><button class="button primary" data-action="admin-refresh">Actualiser</button></section>`;
  }

  const workspaces = [
    ["overview", "Tableau de bord", "Synthèse"],
    ["visibility", "Visibilité", "Pages et fonctions"],
    ["trials", "Offres d’essai", "Utilisateurs"],
    ["commerce", "Tarifs & promotions", "PRO / Premium / jeux"]
  ];
  const contentByWorkspace = {
    overview: renderAdminOverview,
    visibility: renderAdminVisibility,
    trials: renderAdminTrials,
    commerce: renderAdminCommerce
  };
  return `<div class="admin-page">
    <section class="admin-hero">
      <div>
        <p class="eyebrow">CONSOLE SHENPULSE</p>
        <h2>Pilotage global</h2>
        <p>Les modifications sont enregistrées sur les services ShenPulse et appliquées aux utilisateurs concernés.</p>
      </div>
      <div class="admin-identity">
        <span class="status-dot"></span>
        <div><strong>${escapeHtml(adminSession.email)}</strong><small>Propriétaire vérifié par Firebase</small></div>
        <button class="button small" data-action="admin-refresh" ${adminBusy ? "disabled" : ""}>↻ Actualiser</button>
        <button class="button small ghost" data-action="admin-logout">Déconnexion</button>
      </div>
    </section>
    <nav class="admin-workspaces" aria-label="Rubriques d’administration">
      ${workspaces.map(([id, label, detail]) => `<button class="${adminWorkspace === id ? "active" : ""}" data-action="admin-workspace" data-value="${id}"><strong>${label}</strong><small>${detail}</small></button>`).join("")}
    </nav>
    ${renderAdminModuleWarnings()}
    <section class="admin-content ${adminBusy ? "is-busy" : ""}">
      ${(contentByWorkspace[adminWorkspace] || renderAdminOverview)()}
    </section>
  </div>`;
}

function renderAdminOverview() {
  const settings = canonicalAdminSiteSettings(
    adminDashboard.siteSettings || {}
  );
  const visibilityEntries = ADMIN_VISIBILITY_SECTIONS.flatMap(([section]) =>
    Object.values(settings[section] || {})
  );
  const publicCount = visibilityEntries.filter((entry) => entry.scope === "public").length;
  const adminCount = visibilityEntries.filter((entry) => entry.scope === "admin").length;
  const hiddenCount = visibilityEntries.filter((entry) => entry.scope === "hidden").length;
  const trials = adminTrialRows();
  const catalog = adminCommerceCatalog();
  const products = Object.values(catalog.products || {}).filter(
    isCurrentGameProduct
  );
  const promotions = Object.values(catalog.promotions || {}).filter((item) => item.enabled);
  return `<div class="admin-overview">
    <div class="admin-stat-grid">
      ${adminStat("Éléments publics", publicCount, "Visibles par tous", "cyan")}
      ${adminStat("Réservés admin", adminCount, "Visibles uniquement par toi", "violet")}
      ${adminStat("Éléments masqués", hiddenCount, "Retirés pour les utilisateurs", "pink")}
      ${adminStat("Essais actifs", trials.length, "Abonnements et jeux", "green")}
    </div>
    <div class="admin-overview-grid">
      <section class="admin-panel">
        <header><div><p class="eyebrow">COMMERCE</p><h3>Catalogue publié</h3></div><button class="button small" data-action="admin-workspace" data-value="commerce">Gérer</button></header>
        <div class="admin-summary-list">
          <span><strong>${products.filter((item) => item.enabled).length}</strong><small>offres de jeux actives</small></span>
          <span><strong>${promotions.length}</strong><small>promotions actives</small></span>
          ${Object.values(catalog.subscriptions || {}).map((plan) => `<span><strong>${escapeHtml(plan.priceMonthly)} ${escapeHtml(plan.currency)}</strong><small>${escapeHtml(plan.title)} / mois</small></span>`).join("")}
        </div>
      </section>
      <section class="admin-panel">
        <header><div><p class="eyebrow">ESSAIS</p><h3>Dernières offres accordées</h3></div><button class="button small" data-action="admin-workspace" data-value="trials">Gérer</button></header>
        <div class="admin-trial-mini-list">
          ${trials.length ? trials.slice(0, 5).map((trial) => `<span><b>${escapeHtml(trial.email || trial.beneficiaryEmail || "compte inconnu")}</b><small>jusqu’au ${formatAdminDate(trial.expiresAt, false)}</small></span>`).join("") : `<p>Aucune offre d’essai active.</p>`}
        </div>
      </section>
    </div>
    <section class="admin-security-note">
      <span>✓</span><div><strong>Protection active sur trois niveaux</strong><p>Compte Firebase exact, jeton d’identité vérifié sur le serveur, puis contrôle de l’adresse propriétaire avant chaque écriture. Le mot de passe n’est jamais conservé.</p></div>
    </section>
  </div>`;
}

function renderAdminVisibility() {
  const sourceSettings = adminDashboard.siteSettings || {};
  const catalog = adminVisibilityCatalog();
  const settings = canonicalAdminSiteSettings(sourceSettings);
  const audit = adminVisibilityAudit(sourceSettings);
  const meta = adminVisibilityMeta(adminVisibilitySection);
  const entries = (catalog[adminVisibilitySection] || [])
    .map((item, order) => ({
      ...item,
      order,
      scope:
        settings[adminVisibilitySection]?.[
          adminVisibilityStorageKey(item.id)
        ]?.scope || "public"
    }))
    .filter((item) => {
      const query = adminVisibilitySearch.trim().toLocaleLowerCase();
      return (
        !query ||
        `${item.id} ${item.label} ${item.detail || ""} ${item.group || ""}`
          .toLocaleLowerCase()
          .includes(query)
      );
    })
    .sort((left, right) =>
      adminVisibilitySection === "navigation"
        ? left.order - right.order
        : left.label.localeCompare(right.label, "fr")
    );
  return `<div class="admin-visibility-page">
    <section class="admin-catalog-sync ${audit.changed ? "needs-sync" : "is-synced"}">
      <span>${audit.changed ? "↻" : "✓"}</span>
      <div>
        <strong>${audit.changed ? "L’inventaire distant utilise encore l’ancien schéma" : "Inventaire synchronisé avec ShenPulseNew"}</strong>
        <p>${audit.total} éléments réels détectés directement dans l’application.${audit.changed ? ` ${audit.missing} identifiants actuels à ajouter et ${audit.obsolete} anciennes entrées à retirer.` : " Aucune page ni fonctionnalité étrangère n’est affichée."}</p>
      </div>
      <button class="button small ${audit.changed ? "primary" : "ghost"}" data-action="admin-visibility-sync" ${!audit.changed || adminBusy ? "disabled" : ""}>
        ${audit.changed ? "Synchroniser maintenant" : "À jour"}
      </button>
    </section>
    <div class="admin-visibility-layout">
    <aside class="admin-section-list">
      <header><strong>Inventaire ShenPulseNew</strong><small>Uniquement les pages et fonctions réellement disponibles</small></header>
      ${ADMIN_VISIBILITY_SECTIONS.map(([id, label]) => {
        const values = catalog[id] || [];
        const hiddenCount = values.filter(
          (entry) =>
            settings[id]?.[adminVisibilityStorageKey(entry.id)]?.scope ===
            "hidden"
        ).length;
        return `<button class="${id === adminVisibilitySection ? "active" : ""}" data-action="admin-visibility-section" data-value="${id}"><span><strong>${label}</strong><small>${values.length} élément${values.length > 1 ? "s" : ""}</small></span>${hiddenCount ? `<b>${hiddenCount}</b>` : ""}</button>`;
      }).join("")}
    </aside>
    <section class="admin-panel admin-visibility-panel">
      <header>
        <div><p class="eyebrow">VISIBILITÉ · ${entries.length} RÉSULTAT${entries.length > 1 ? "S" : ""}</p><h3>${escapeHtml(meta[1])}</h3><p>${escapeHtml(meta[2])}</p></div>
        <label class="catalog-search"><span>⌕</span><input data-search="admin-visibility" value="${escapeHtml(adminVisibilitySearch)}" placeholder="Rechercher un élément…"></label>
      </header>
      <div class="admin-bulk-actions">
        <span>Appliquer à toute la catégorie</span>
        <button class="button small" data-action="admin-visibility-bulk" data-value="public">Public</button>
        <button class="button small" data-action="admin-visibility-bulk" data-value="admin">Moi uniquement</button>
        <button class="button small ghost" data-action="admin-visibility-bulk" data-value="hidden">Masqué</button>
      </div>
      <div class="admin-visibility-list" data-admin-scroll="visibility-${escapeHtml(adminVisibilitySection)}">
        ${entries.length ? entries.map((item) => `<article>
          <span class="admin-item-icon">${escapeHtml(item.icon || adminVisibilityIcon(item.scope))}</span>
          <div class="admin-item-copy"><strong>${escapeHtml(item.label)}</strong><small>${escapeHtml(item.detail || "")}</small><code>${escapeHtml(item.id)}</code></div>
          <select data-action="admin-scope" data-section="${escapeHtml(adminVisibilitySection)}" data-id="${escapeHtml(item.id)}" class="scope-${escapeHtml(item.scope)}" aria-label="Visibilité de ${escapeHtml(item.label)}">
            <option value="public" ${item.scope === "public" ? "selected" : ""}>Visible par tous</option>
            <option value="admin" ${item.scope === "admin" ? "selected" : ""}>Moi uniquement</option>
            <option value="hidden" ${item.scope === "hidden" ? "selected" : ""}>Masqué</option>
          </select>
        </article>`).join("") : `<div class="admin-empty">Aucun élément ne correspond à cette recherche.</div>`}
      </div>
    </section>
    </div>
  </div>`;
}

function renderAdminTrials() {
  const trials = adminTrialRows();
  const trialsBlocked = Boolean(adminModuleError("trials"));
  const eligibleGames = Object.values(adminCommerceCatalog().products || {})
    .filter((item) => isCurrentGameProduct(item) && item.enabled && item.accessMode === "purchase" && item.trialEligible)
    .sort((left, right) => left.title.localeCompare(right.title, "fr"));
  return `<div class="admin-trials-layout">
    <form id="admin-trial-form" class="admin-panel admin-trial-form" autocomplete="off">
      <header><div><p class="eyebrow">NOUVELLE OFFRE</p><h3>Accorder un essai</h3><p>Le bénéficiaire est identifié exclusivement par l’adresse e-mail de son compte ShenPulse.</p></div></header>
      <div class="form-grid">
        <label class="field full"><span>Adresse e-mail du compte bénéficiaire</span><input name="email" type="email" required maxlength="254" placeholder="utilisateur@exemple.fr" autocomplete="email" autocapitalize="none" spellcheck="false"></label>
        <label class="field"><span>Durée</span><input name="days" type="number" min="1" max="365" value="7" required></label>
        <div class="field"><span>Jeux éligibles</span><strong>${eligibleGames.length} disponibles</strong><small>Laisser la sélection vide accorde tous les jeux éligibles.</small></div>
      </div>
      <div class="admin-trial-options">
        <label><input type="checkbox" name="subscription" checked><span><strong>Accès Pro</strong><small>Toutes les fonctions réservées au plan Pro</small></span></label>
        <label><input type="checkbox" name="games"><span><strong>Jeux payants</strong><small>Tout le catalogue éligible ou une sélection</small></span></label>
      </div>
      <label class="field"><span>Jeux précis (facultatif)</span><select name="gameIds" multiple size="6">${eligibleGames.map((game) => `<option value="${escapeHtml(game.id)}">${escapeHtml(game.title)}</option>`).join("")}</select><small>Ctrl + clic pour en choisir plusieurs. Aucun choix = tous.</small></label>
      <footer><button class="button primary" type="submit" ${adminBusy ? "disabled" : ""}>Offrir l’essai</button></footer>
    </form>
    <section class="admin-panel admin-trial-list">
      <header><div><p class="eyebrow">OFFRES ACTIVES</p><h3>${trials.length} essai${trials.length > 1 ? "s" : ""}</h3><p>Modification et révocation immédiates.</p></div><button class="button small" data-action="admin-refresh">↻</button></header>
      <div>
        ${trials.length ? trials.map((trial) => `<article>
          <span class="admin-trial-avatar">@</span>
          <div><strong>${escapeHtml(trial.email || trial.beneficiaryEmail || "Compte inconnu")}</strong><small>${trial.pending ? "En attente de création du compte" : "Compte ShenPulse associé"}</small></div>
          <div class="admin-trial-entitlements">
            ${trial.subscriptionTrial ? `<b>PRO</b>` : ""}
            ${(trial.gameTrialIds || []).length ? `<b>${trial.gameTrialIds.length} jeu${trial.gameTrialIds.length > 1 ? "x" : ""}</b>` : ""}
          </div>
          <time>${formatAdminDate(trial.expiresAt, false)}</time>
          <button class="button small" data-action="admin-trial-edit" data-id="${escapeHtml(trial.id)}" ${trialsBlocked ? "disabled" : ""}>Modifier</button>
          <button class="button small danger" data-action="admin-trial-revoke" data-id="${escapeHtml(trial.id)}" ${trialsBlocked ? "disabled" : ""}>Retirer</button>
        </article>`).join("") : `<div class="admin-empty">Aucune offre d’essai active.</div>`}
      </div>
    </section>
  </div>`;
}

function restoreAdminTrialFormInteractivity({ focusEmail = false } = {}) {
  if (
    adminBusy ||
    currentPage !== "admin" ||
    adminWorkspace !== "trials"
  ) {
    return;
  }
  const restore = () => {
    if (adminBusy) return;
    const form = content.querySelector("#admin-trial-form");
    if (!form) return;
    const adminContent = form.closest(".admin-content");
    [adminContent, form].filter(Boolean).forEach((element) => {
      element.inert = false;
      element.removeAttribute("inert");
      element.removeAttribute("aria-disabled");
    });
    adminContent?.classList.remove("is-busy");
    form
      .querySelectorAll("input, select, textarea, button")
      .forEach((control) => {
        control.disabled = false;
        control.removeAttribute("disabled");
        control.removeAttribute("aria-disabled");
      });
    const emailInput = form.querySelector('input[name="email"]');
    if (emailInput) {
      emailInput.readOnly = false;
      emailInput.removeAttribute("readonly");
      if (focusEmail) {
        emailInput.focus({ preventScroll: true });
      }
    }
  };
  restore();
  requestAnimationFrame(restore);
}

function renderAdminCommerce() {
  const catalog = adminCommerceCatalog();
  const commerceBlocked = Boolean(adminModuleError("commerce"));
  const query = adminCommerceSearch.trim().toLocaleLowerCase();
  const products = Object.values(catalog.products || {})
    .filter((item) => isCurrentGameProduct(item) && (!query || `${item.title} ${item.id}`.toLocaleLowerCase().includes(query)))
    .sort((left, right) => Number(left.sortOrder) - Number(right.sortOrder) || left.title.localeCompare(right.title, "fr"));
  const plans = Object.values(catalog.subscriptions || {}).sort((left, right) => Number(left.sortOrder) - Number(right.sortOrder));
  const promotions = Object.values(catalog.promotions || {}).sort((left, right) => left.title.localeCompare(right.title, "fr"));
  const history = adminDashboard.commerce?.history || [];
  return `<div class="admin-commerce">
    <section class="admin-commerce-toolbar">
      <div><p class="eyebrow">CATALOGUE COMMERCIAL</p><h3>${commerceBlocked ? "Catalogue public · lecture de secours" : "Brouillon synchronisé"}</h3><p>${commerceBlocked ? "La modification commerciale reprendra dès que l’index Firebase sera publié." : "Enregistre les modifications, puis publie-les sur TEST ou PROD."}</p></div>
      <div class="button-row">
        <button class="button" data-action="admin-commerce-publish" data-value="publish-test" ${commerceBlocked ? "disabled" : ""}>Publier TEST</button>
        <button class="button primary" data-action="admin-commerce-publish" data-value="publish-prod" ${commerceBlocked ? "disabled" : ""}>Publier PROD</button>
      </div>
    </section>
    <div class="admin-plan-grid">
      ${plans.map((plan) => `<article class="${plan.enabled ? "" : "disabled"}"><span>${plan.tier === "premium" ? "♛" : "◆"}</span><div><small>ABONNEMENT</small><strong>${escapeHtml(plan.title)}</strong><b>${escapeHtml(plan.priceMonthly)} ${escapeHtml(plan.currency)}<em>/mois</em></b></div><button class="button small" data-action="admin-plan-edit" data-id="${escapeHtml(plan.tier)}" ${commerceBlocked ? "disabled" : ""}>Modifier</button></article>`).join("")}
    </div>
    <section class="admin-panel">
      <header><div><p class="eyebrow">JEUX</p><h3>${products.length} offres</h3></div><label class="catalog-search"><span>⌕</span><input data-search="admin-commerce" value="${escapeHtml(adminCommerceSearch)}" placeholder="Rechercher un jeu…"></label></header>
      <div class="admin-product-list">
        ${products.map((product) => `<article class="${product.enabled ? "" : "disabled"}">
          <div><strong>${escapeHtml(product.title)}</strong><small>${escapeHtml(product.id)}</small></div>
          <span class="badge">${product.accessMode === "included" ? "INCLUS" : "ACHAT"}</span>
          <b>${product.accessMode === "included" ? "0,00 €" : `${escapeHtml(product.baseAmount)} ${escapeHtml(product.currency)}`}</b>
          <small>${product.trialEligible ? "Essai autorisé" : "Sans essai"}</small>
          <button class="button small" data-action="admin-product-edit" data-id="${escapeHtml(product.id)}" ${commerceBlocked ? "disabled" : ""}>Modifier</button>
        </article>`).join("")}
      </div>
    </section>
    <section class="admin-panel">
      <header><div><p class="eyebrow">PROMOTIONS</p><h3>${promotions.length} campagne${promotions.length > 1 ? "s" : ""}</h3></div><button class="button small primary" data-action="admin-promotion-add" ${commerceBlocked ? "disabled" : ""}>＋ Nouvelle promotion</button></header>
      <div class="admin-promotion-list">
        ${promotions.length ? promotions.map((promo) => `<article class="${promo.enabled ? "" : "disabled"}">
          <span>${promo.type === "percent" ? "%" : "€"}</span>
          <div><strong>${escapeHtml(promo.title)}</strong><small>${promo.productIds?.length ? `${promo.productIds.length} jeu(x)` : "Tous les jeux payants"}${promo.endsAt ? ` · fin ${formatAdminDate(promo.endsAt, false)}` : ""}</small></div>
          <b>${promo.type === "percent" ? `−${escapeHtml(promo.value)} %` : `−${escapeHtml(promo.value)} €`}</b>
          <button class="button small" data-action="admin-promotion-edit" data-id="${escapeHtml(promo.id)}" ${commerceBlocked ? "disabled" : ""}>Modifier</button>
          <button class="button small danger" data-action="admin-promotion-delete" data-id="${escapeHtml(promo.id)}" ${commerceBlocked ? "disabled" : ""}>Supprimer</button>
        </article>`).join("") : `<div class="admin-empty">Aucune promotion configurée.</div>`}
      </div>
    </section>
    ${history.length ? `<section class="admin-panel"><header><div><p class="eyebrow">HISTORIQUE</p><h3>Versions restaurables</h3></div></header><div class="admin-history-list">${history.slice(0, 8).map((entry) => `<span><div><strong>${entry.action === "publish-prod" ? "Publication PROD" : entry.action === "publish-test" ? "Publication TEST" : "Brouillon"}</strong><small>${formatAdminDate(entry.savedAt)}</small></div><button class="button small ghost" data-action="admin-commerce-restore" data-id="${escapeHtml(entry.id)}" ${commerceBlocked ? "disabled" : ""}>Restaurer en brouillon</button></span>`).join("")}</div></section>` : ""}
  </div>`;
}

function adminModuleError(moduleName) {
  return adminDashboard?.errors?.[moduleName] || null;
}

function renderAdminModuleWarnings() {
  const entries = Object.entries(adminDashboard?.errors || {}).filter(
    ([moduleName]) =>
      adminWorkspace === "overview" ||
      (adminWorkspace === "commerce" && moduleName === "commerce") ||
      (adminWorkspace === "trials" && moduleName === "trials")
  );
  if (!entries.length) return "";
  return entries
    .map(
      ([moduleName, error]) => `<section class="admin-module-warning">
        <span>!</span>
        <div><strong>${moduleName === "commerce" ? "Commerce en lecture de secours" : "Offres d’essai indisponibles"}</strong><p>${escapeHtml(error?.message || "Ce module est temporairement indisponible.")}</p></div>
        <button class="button small" data-action="admin-refresh">Réessayer</button>
      </section>`
    )
    .join("");
}

function adminStat(label, value, detail, tone) {
  return `<article class="admin-stat tone-${tone}"><span>${escapeHtml(value)}</span><div><strong>${escapeHtml(label)}</strong><small>${escapeHtml(detail)}</small></div></article>`;
}

function adminTrialRows() {
  return Array.isArray(adminDashboard?.trials?.trials)
    ? adminDashboard.trials.trials
    : [];
}

function adminCommerceCatalog() {
  return (
    adminDashboard?.commerce?.catalog || {
      products: {},
      promotions: {},
      subscriptions: {}
    }
  );
}

function isCurrentGameProduct(product) {
  return (snapshot?.packs || []).some((pack) => pack.id === product?.id);
}

function adminItemLabel(id) {
  const knownItem = Object.values(adminVisibilityCatalog())
    .flat()
    .find((item) => item.id === id);
  if (knownItem?.label) return knownItem.label;
  return String(id || "")
    .replace(/[-_.:]+/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function adminVisibilityIcon(scope) {
  return scope === "hidden" ? "◌" : scope === "admin" ? "♜" : "◉";
}

function formatAdminDate(value, withTime = true) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "date inconnue";
  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    ...(withTime ? { hour: "2-digit", minute: "2-digit" } : {})
  }).format(date);
}

function cloneAdminData(value) {
  return JSON.parse(JSON.stringify(value));
}

function normalizeAdminMoney(value, minimum = 0) {
  const amount = Number(String(value ?? "").trim().replace(",", "."));
  if (
    !Number.isFinite(amount) ||
    amount < minimum ||
    amount > 100000
  ) {
    throw new Error("Renseignez un prix valide.");
  }
  return amount.toFixed(2);
}

async function refreshAdminDashboard() {
  if (!isVerifiedAdminSession() || adminBusy) return;
  adminBusy = true;
  render();
  try {
    adminDashboard = await api.admin.dashboard();
    adminSession = adminDashboard.status || adminSession;
  } finally {
    adminBusy = false;
    render();
  }
}

async function syncAdminSessionFromAccount() {
  adminSession = await api.admin.status().catch(() => ({
    authorized: false,
    email: "",
    uid: "",
    lastAuthenticatedAt: ""
  }));
  if (!isVerifiedAdminSession()) {
    adminDashboard = null;
    ensureCurrentPageAccess();
    return;
  }
  try {
    adminDashboard = await api.admin.dashboard();
    adminSession = adminDashboard.status || adminSession;
  } catch (error) {
    console.warn(
      "Synchronisation de l’administration différée :",
      error?.message || error
    );
  }
}

function openAccountLogin(mode = "login", preservedEmail = "") {
  const registering = mode === "register";
  accountMenu.hidden = true;
  accountMenuButton.setAttribute("aria-expanded", "false");
  openEditor({
    title: registering
      ? "Créer votre compte ShenPulse"
      : "Connexion à ShenPulse",
    kicker: registering
      ? "INSCRIPTION SÉCURISÉE · FIREBASE"
      : "COMPTE & ABONNEMENT",
    submitLabel: registering
      ? "Créer mon compte"
      : "Se connecter",
    variant: "account-auth",
    body: `<div class="admin-login-dialog account-login-dialog">
      <section class="admin-login-shield">
        <span>SP</span>
        <div>
          <strong>${registering ? "Un compte pour tous vos accès" : "Retrouvez votre compte ShenPulse"}</strong>
          <p>Votre adresse e-mail identifie vos abonnements, vos achats et vos jeux. Le mot de passe est traité par Firebase et n’est jamais enregistré par ShenPulse.</p>
        </div>
      </section>
      <button class="account-google-button" type="button" data-account-command="google">
        <span aria-hidden="true">G</span>
        ${registering ? "S’inscrire avec Google" : "Continuer avec Google"}
      </button>
      <div class="account-auth-divider"><span>ou avec votre e-mail</span></div>
      <div class="form-grid">
        <label class="field full">
          <span>Adresse email</span>
          <input name="email" type="email" autocomplete="email" value="${escapeHtml(preservedEmail)}" required autofocus>
        </label>
        <label class="field full">
          <span>Mot de passe</span>
          <input name="password" type="password" minlength="${registering ? 8 : 1}" autocomplete="${registering ? "new-password" : "current-password"}" required>
          ${registering ? "<small>8 caractères minimum.</small>" : ""}
        </label>
        ${registering
          ? `<label class="field full">
              <span>Confirmer le mot de passe</span>
              <input name="passwordConfirmation" type="password" minlength="8" autocomplete="new-password" required>
            </label>
            <label class="account-auth-consent full">
              <input name="acceptedTerms" type="checkbox" required>
              <span>J’accepte les conditions d’utilisation et la politique de confidentialité ShenPulse.</span>
            </label>`
          : ""}
      </div>
      ${registering
        ? `<p class="account-auth-switch">Déjà inscrit ? <button type="button" data-account-command="login">Se connecter</button></p>`
        : `<div class="account-auth-links">
            <button type="button" data-account-command="forgot">Mot de passe oublié ?</button>
            <p>Pas encore de compte ? <button type="button" data-account-command="register">Inscrivez-vous</button></p>
          </div>`}
    </div>`,
    onSubmit: async (data) => {
      await waitForPendingAccountLogout();
      const email = data.get("email");
      accountSession = registering
        ? await api.account.register({
            email,
            password: data.get("password"),
            passwordConfirmation: data.get("passwordConfirmation"),
            displayName: String(email || "").split("@")[0]
          })
        : await api.account.login({
            email,
            password: data.get("password")
          });
      acceptSnapshot(await api.getSnapshot());
      await syncAdminSessionFromAccount();
      syncAccountChrome();
      toast(
        registering ? "Compte créé" : "Compte connecté",
        accountSession.emailVerified
          ? accountSession.email
          : `${accountSession.email} · vérifiez l’e-mail reçu avant tout paiement`
      );
    }
  });
  const activeDialogSessionId = dialogSessionId;
  resetAccountAuthDialog(activeDialogSessionId);
  requestAnimationFrame(() => {
    resetAccountAuthDialog(activeDialogSessionId);
  });
}

function resetAccountAuthDialog(expectedSessionId = dialogSessionId) {
  if (
    expectedSessionId !== dialogSessionId ||
    dialog.dataset.variant !== "account-auth"
  ) {
    return;
  }
  [dialog, dialogForm, dialogBody].forEach((element) => {
    element.inert = false;
    element.removeAttribute("inert");
    element.removeAttribute("aria-disabled");
    element.style.removeProperty("pointer-events");
  });
  dialogForm.setAttribute("aria-busy", "false");
  dialogBody
    .querySelectorAll("input, select, textarea, button")
    .forEach((control) => {
      control.disabled = false;
      control.removeAttribute("disabled");
      if (control.matches("input, textarea")) {
        control.readOnly = false;
        control.removeAttribute("readonly");
      }
      control.removeAttribute("aria-disabled");
      delete control.dataset.guestLocked;
      delete control.dataset.guestWasDisabled;
    });
  dialogSubmitButton.disabled = false;
}

function openAdminLogin() {
  openEditor({
    title: "Connexion propriétaire",
    kicker: "ADMINISTRATION SHENPULSE · FIREBASE",
    submitLabel: "Vérifier mon accès",
    body: `<div class="admin-login-dialog">
      <section class="admin-login-shield"><span>♜</span><div><strong>Accès strictement personnel</strong><p>Seul le compte propriétaire défini côté serveur est accepté. Le mot de passe est envoyé directement à Firebase puis oublié.</p></div></section>
      <div class="form-grid">
        <label class="field full"><span>Compte administrateur</span><input name="email" type="email" value="alexandre.leuridan@gmail.com" readonly></label>
        <label class="field full"><span>Mot de passe Firebase</span><input name="password" type="password" autocomplete="current-password" required autofocus></label>
      </div>
    </div>`,
    onSubmit: async (data) => {
      adminBusy = true;
      try {
        adminSession = await api.admin.login({
          email: data.get("email"),
          password: data.get("password")
        });
        adminDashboard = await api.admin.dashboard();
        siteVisibility = await api.admin.visibility();
        currentPage = "admin";
      } finally {
        adminBusy = false;
      }
    }
  });
}

async function saveAdminVisibilityScope(section, id, scope) {
  const next = canonicalAdminSiteSettings(adminDashboard.siteSettings);
  if (!adminVisibilityCatalog()[section]?.some((item) => item.id === id)) {
    throw new Error("Cet élément n’existe pas dans ShenPulseNew.");
  }
  const storedId = adminVisibilityStorageKey(id);
  next[section][storedId] = { scope };
  if (section === "actionTypes") {
    next.actionTypeOverrides = next.actionTypeOverrides || {};
    next.actionTypeOverrides[storedId] = true;
  }
  adminBusy = true;
  try {
    adminDashboard.siteSettings = await api.admin.saveSiteSettings(next);
    siteVisibility = await api.admin.visibility();
  } finally {
    adminBusy = false;
    render();
  }
}

async function saveAdminVisibilityBulk(scope) {
  const next = canonicalAdminSiteSettings(adminDashboard.siteSettings);
  const items = adminVisibilityCatalog()[adminVisibilitySection] || [];
  for (const { id } of items) {
    const storedId = adminVisibilityStorageKey(id);
    next[adminVisibilitySection][storedId] = { scope };
    if (adminVisibilitySection === "actionTypes") {
      next.actionTypeOverrides[storedId] = true;
    }
  }
  adminBusy = true;
  try {
    adminDashboard.siteSettings = await api.admin.saveSiteSettings(next);
    siteVisibility = await api.admin.visibility();
  } finally {
    adminBusy = false;
    render();
  }
}

async function syncAdminVisibilityCatalog() {
  const next = canonicalAdminSiteSettings(adminDashboard.siteSettings);
  adminBusy = true;
  try {
    adminDashboard.siteSettings = await api.admin.saveSiteSettings(next);
    siteVisibility = await api.admin.visibility();
  } finally {
    adminBusy = false;
    render();
  }
}

async function saveAdminCommerce(catalog, action = "save-draft", success = "Catalogue enregistré") {
  if (adminModuleError("commerce")) {
    throw new Error(
      "La modification commerciale est suspendue jusqu’à la publication de l’index Firebase."
    );
  }
  adminBusy = true;
  try {
    adminDashboard.commerce = await api.admin.saveCommerce({ action, catalog });
    toast(success);
  } finally {
    adminBusy = false;
    render();
  }
}

function openAdminPlanEditor(tier) {
  if (adminModuleError("commerce")) {
    throw new Error("Le commerce est temporairement disponible en lecture seule.");
  }
  const plan = adminCommerceCatalog().subscriptions?.[tier];
  if (!plan) throw new Error("Abonnement introuvable.");
  openEditor({
    title: `Abonnement ${plan.title}`,
    kicker: "TARIF MENSUEL PUBLIC",
    body: `<div class="form-grid">
      ${field("title", "Nom affiché", plan.title, "text", "full required maxlength=\"80\"")}
      ${field("priceMonthly", "Prix mensuel", plan.priceMonthly, "text", 'inputmode="decimal" required')}
      ${field("sortOrder", "Ordre d’affichage", plan.sortOrder, "number", 'step="1"')}
      <label class="field"><span>Disponibilité</span><select name="enabled"><option value="true" ${plan.enabled ? "selected" : ""}>Disponible</option><option value="false" ${!plan.enabled ? "selected" : ""}>Indisponible</option></select></label>
    </div>`,
    onSubmit: async (data) => {
      const catalog = cloneAdminData(adminCommerceCatalog());
      catalog.subscriptions[tier] = {
        ...plan,
        title: String(data.get("title") || "").trim(),
        priceMonthly: normalizeAdminMoney(data.get("priceMonthly"), 0.01),
        sortOrder: Number(data.get("sortOrder") || 0),
        enabled: data.get("enabled") === "true"
      };
      await saveAdminCommerce(catalog, "save-draft", `Abonnement ${tier.toUpperCase()} enregistré`);
    }
  });
}

function openAdminProductEditor(productId) {
  if (adminModuleError("commerce")) {
    throw new Error("Le commerce est temporairement disponible en lecture seule.");
  }
  const product = adminCommerceCatalog().products?.[productId];
  if (!product) throw new Error("Offre de jeu introuvable.");
  openEditor({
    title: product.title,
    kicker: "OFFRE COMMERCIALE DU JEU",
    submitLabel: "Enregistrer et publier",
    body: `<div class="form-grid">
      ${field("title", "Nom affiché", product.title, "text", "full required maxlength=\"120\"")}
      <label class="field"><span>Mode d’accès</span><select name="accessMode"><option value="purchase" ${product.accessMode === "purchase" ? "selected" : ""}>Achat séparé</option><option value="included" ${product.accessMode === "included" ? "selected" : ""}>Inclus</option></select></label>
      ${field("baseAmount", "Prix", product.baseAmount, "text", 'inputmode="decimal" required')}
      ${field("sortOrder", "Ordre", product.sortOrder, "number", 'step="1"')}
      <label class="field"><span>Disponibilité</span><select name="enabled"><option value="true" ${product.enabled ? "selected" : ""}>Disponible</option><option value="false" ${!product.enabled ? "selected" : ""}>Masqué à la vente</option></select></label>
      <label class="field full"><span>Offre d’essai</span><select name="trialEligible"><option value="true" ${product.trialEligible ? "selected" : ""}>Peut être offert en essai</option><option value="false" ${!product.trialEligible ? "selected" : ""}>Jamais en essai</option></select></label>
    </div>`,
    onSubmit: async (data) => {
      const catalog = cloneAdminData(adminCommerceCatalog());
      const accessMode = data.get("accessMode") === "included" ? "included" : "purchase";
      catalog.products[productId] = {
        ...product,
        title: String(data.get("title") || "").trim(),
        accessMode,
        baseAmount: accessMode === "included"
          ? "0.00"
          : normalizeAdminMoney(data.get("baseAmount")),
        sortOrder: Number(data.get("sortOrder") || 0),
        enabled: data.get("enabled") === "true",
        trialEligible: data.get("trialEligible") === "true"
      };
      await saveAdminCommerce(
        catalog,
        "publish-prod",
        `${product.title} enregistré et publié`
      );
    }
  });
}

function openAdminPromotionEditor(promotion = null) {
  if (adminModuleError("commerce")) {
    throw new Error("Le commerce est temporairement disponible en lecture seule.");
  }
  const catalog = adminCommerceCatalog();
  const draft = promotion || {
    id: `promo-${Date.now()}`,
    title: "Nouvelle promotion",
    type: "percent",
    value: 10,
    enabled: true,
    startsAt: "",
    endsAt: "",
    productIds: []
  };
  openEditor({
    title: promotion ? `Promotion ${promotion.title}` : "Nouvelle promotion",
    kicker: "CAMPAGNE COMMERCIALE",
    variant: "wide",
    body: `<div class="form-grid">
      ${field("title", "Nom de la campagne", draft.title, "text", "full required maxlength=\"120\"")}
      <label class="field"><span>Type</span><select name="type"><option value="percent" ${draft.type === "percent" ? "selected" : ""}>Pourcentage</option><option value="fixed" ${draft.type === "fixed" ? "selected" : ""}>Montant fixe</option></select></label>
      ${field("value", "Remise", draft.value, "number", 'min="0.01" max="100000" step="0.01" required')}
      ${field("startsAt", "Début (facultatif)", toLocalAdminDate(draft.startsAt), "datetime-local")}
      ${field("endsAt", "Fin (facultatif)", toLocalAdminDate(draft.endsAt), "datetime-local")}
      <label class="field"><span>État</span><select name="enabled"><option value="true" ${draft.enabled ? "selected" : ""}>Active</option><option value="false" ${!draft.enabled ? "selected" : ""}>Suspendue</option></select></label>
      <label class="field full"><span>IDs des jeux (un par ligne, vide = tous les jeux payants)</span><textarea name="productIds" rows="8">${escapeHtml((draft.productIds || []).join("\n"))}</textarea></label>
    </div>`,
    onSubmit: async (data) => {
      const next = cloneAdminData(catalog);
      next.promotions[draft.id] = {
        ...draft,
        title: String(data.get("title") || "").trim(),
        type: data.get("type") === "fixed" ? "fixed" : "percent",
        value: Number(data.get("value") || 0),
        enabled: data.get("enabled") === "true",
        startsAt: adminDateToIso(data.get("startsAt")),
        endsAt: adminDateToIso(data.get("endsAt")),
        productIds: String(data.get("productIds") || "").split(/\r?\n|,/).map((id) => id.trim()).filter((id) => next.products[id])
      };
      await saveAdminCommerce(next, "save-draft", "Promotion enregistrée");
    }
  });
}

function openAdminTrialEditor(trial) {
  if (adminModuleError("trials")) {
    throw new Error("Le service des offres d’essai est temporairement indisponible.");
  }
  openEditor({
    title: `Essai de ${trial.email || trial.beneficiaryEmail}`,
    kicker: "MODIFIER L’OFFRE D’ESSAI",
    body: `<div class="form-grid">
      ${field("email", "Adresse e-mail du compte", trial.email || trial.beneficiaryEmail, "email", "full required maxlength=\"254\"")}
      ${field("days", "Nouvelle durée (jours)", trial.durationDays || 7, "number", 'min="1" max="365" required')}
      <label class="field"><span>Accès Pro</span><select name="subscription"><option value="true" ${trial.subscriptionTrial ? "selected" : ""}>Oui</option><option value="false" ${!trial.subscriptionTrial ? "selected" : ""}>Non</option></select></label>
      <label class="field"><span>Jeux</span><select name="games"><option value="true" ${(trial.gameTrialIds || []).length ? "selected" : ""}>Oui</option><option value="false" ${!(trial.gameTrialIds || []).length ? "selected" : ""}>Non</option></select></label>
      <label class="field full"><span>IDs des jeux (vide = tous les jeux éligibles)</span><textarea name="gameIds" rows="7">${escapeHtml((trial.gameTrialIds || []).join("\n"))}</textarea></label>
    </div>`,
    onSubmit: async (data) => {
      adminBusy = true;
      try {
        await api.admin.updateTrial({
          trialId: trial.id,
          email: data.get("email"),
          days: Number(data.get("days")),
          subscription: data.get("subscription") === "true",
          games: data.get("games") === "true",
          gameIds: String(data.get("gameIds") || "").split(/\r?\n|,/).map((id) => id.trim()).filter(Boolean)
        });
        adminDashboard = await api.admin.dashboard();
      } finally {
        adminBusy = false;
      }
    }
  });
}

function toLocalAdminDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
}

function adminDateToIso(value) {
  if (!value) return "";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toISOString();
}

function checkRow(title, detail, name, checked) {
  return `<label class="check-row"><span><strong>${escapeHtml(title)}</strong><small>${escapeHtml(detail)}</small></span><span class="switch"><input type="checkbox" name="${escapeHtml(name)}" ${checked ? "checked" : ""}><span></span></span></label>`;
}

function openEditor({
  title,
  kicker = "CONFIGURATION",
  body,
  submitLabel = "Enregistrer",
  onSubmit,
  variant = "standard"
}) {
  dialogSessionId += 1;
  dialog.dataset.variant = variant;
  dialog.removeAttribute("inert");
  dialogForm.removeAttribute("inert");
  dialogForm.setAttribute("aria-busy", "false");
  dialogTitle.textContent = title;
  dialogKicker.textContent = kicker;
  dialogBody.innerHTML = body;
  dialogSubmitButton.textContent = submitLabel;
  dialogSubmitButton.hidden = typeof onSubmit !== "function";
  dialogSubmitButton.disabled = false;
  dialogSubmitButton.dataset.defaultLabel = submitLabel;
  clearDialogError();
  dialogSubmitHandler = onSubmit;
  dialog.scrollTop = 0;
  dialogForm.scrollTop = 0;
  dialogBody.scrollTop = 0;
  if (!dialog.open) dialog.showModal();
  syncActionEditorVisibility();
  bindOverlayRuntimeFrames(dialogBody);
  requestAnimationFrame(() => {
    dialog.scrollTop = 0;
    dialogForm.scrollTop = 0;
    dialogBody.scrollTop = 0;
    bindOverlayRuntimeFrames(dialogBody);
    const focusTarget = dialogBody.querySelector(
      "[autofocus], input:not([type='hidden']):not([disabled]), select:not([disabled]), textarea:not([disabled])"
    );
    if (!focusTarget) return;
    focusTarget.focus({ preventScroll: true });
    if (
      focusTarget instanceof HTMLInputElement &&
      focusTarget.type !== "password"
    ) {
      focusTarget.select();
    }
  });
}

function clearDialogError() {
  dialogError.hidden = true;
  dialogError.textContent = "";
}

function showDialogError(message) {
  dialogError.textContent =
    String(message || "").trim() ||
    "Vérifiez les champs indiqués avant d’enregistrer.";
  dialogError.hidden = false;
}

function field(name, label, value = "", type = "text", extra = "") {
  return `<label class="field ${extra.includes("full") ? "full" : ""}"><span>${escapeHtml(label)}</span><input name="${escapeHtml(name)}" type="${escapeHtml(type)}" value="${escapeHtml(value)}" ${extra.replace("full", "")}></label>`;
}

function readTtsVoices() {
  if (!("speechSynthesis" in window)) return [];
  return window.speechSynthesis
    .getVoices()
    .filter((voice) => voice?.name)
    .sort((first, second) => {
      const firstFrench = /^fr(?:-|$)/i.test(first.lang || "") ? 0 : 1;
      const secondFrench = /^fr(?:-|$)/i.test(second.lang || "") ? 0 : 1;
      return (
        firstFrench - secondFrench ||
        String(first.lang || "").localeCompare(String(second.lang || ""), "fr") ||
        first.name.localeCompare(second.name, "fr")
      );
    });
}

function ttsVoiceOptions(currentVoice = "") {
  const available = readTtsVoices();
  if (available.length) ttsVoices = available;
  const selectedVoice = String(currentVoice || "");
  const voices = [...ttsVoices];
  if (
    selectedVoice &&
    !voices.some((voice) => voice.name === selectedVoice)
  ) {
    voices.unshift({
      name: selectedVoice,
      lang: "",
      legacy: true
    });
  }
  return [
    `<option value="" ${selectedVoice ? "" : "selected"}>Voix Windows par défaut</option>`,
    ...voices.map(
      (voice) =>
        `<option value="${escapeHtml(voice.name)}" ${voice.name === selectedVoice ? "selected" : ""}>${escapeHtml(`${voice.name}${voice.lang ? ` · ${voice.lang}` : voice.legacy ? " · ancienne configuration" : ""}`)}</option>`
    )
  ].join("");
}

function ttsVoiceField(name, currentVoice = "", extraClass = "") {
  return `<label class="field ${extraClass}"><span>Voix</span><select name="${escapeHtml(name)}" data-tts-voice-select>${ttsVoiceOptions(currentVoice)}</select><small>Voix de synthèse installées dans Windows.</small></label>`;
}

function refreshTtsVoiceSelects() {
  const available = readTtsVoices();
  if (available.length) ttsVoices = available;
  document.querySelectorAll("[data-tts-voice-select]").forEach((select) => {
    const selectedVoice = select.value;
    select.innerHTML = ttsVoiceOptions(selectedVoice);
    select.value = selectedVoice;
  });
}

function ttsCommentFilterFields(config = {}) {
  return `<div class="tts-comment-filters">
    ${checkRow(
      "Lire les emojis",
      "Windows prononcera le nom des emojis présents dans le commentaire.",
      "ttsReadEmojis",
      config.readEmojis === true
    )}
    ${checkRow(
      "Lire les mentions commençant par @",
      "Autorise les commentaires adressés directement à un autre compte.",
      "ttsAllowMentions",
      config.allowMentions === true
    )}
    ${checkRow(
      "Lire les commandes ! et /",
      "Autorise les commentaires qui commencent comme une commande.",
      "ttsAllowCommands",
      config.allowCommands === true
    )}
    ${checkRow(
      "Lire les messages contenant un lien",
      "Autorise les URL et adresses présentes dans les commentaires.",
      "ttsAllowLinks",
      config.allowLinks === true
    )}
  </div>`;
}

function dialogSection(
  title,
  description,
  content,
  className = "",
  headerControl = ""
) {
  return `<section class="dialog-section ${className}">
    <header><div><h3>${escapeHtml(title)}</h3><p>${escapeHtml(description)}</p></div>${headerControl}</header>
    <div class="form-grid">${content}</div>
  </section>`;
}

function conditionalFields(types, content, extraClass = "") {
  return `<div class="editor-conditional full ${extraClass}" data-action-types="${escapeHtml(types)}">${content}</div>`;
}

function triggerTypeOptions(currentType = "gift") {
  const options = [
    ["gift", "Cadeau"],
    ["like", "Likes"],
    ["follow", "Nouveau follow"],
    ["chat", "Message du chat"],
    ["share", "Partage du LIVE"],
    ["subscribe", "Nouvel abonnement"],
    ["join", "Arrivée dans le LIVE"]
  ];
  return options
    .map(
      ([value, label]) =>
        `<option value="${value}" ${currentType === value ? "selected" : ""}>${escapeHtml(`${eventIcons[value] || "◆"}\u00A0\u00A0${label}`)}</option>`
    )
    .join("");
}

function syncActionEditorVisibility() {
  const actionType = dialogBody.querySelector("[name='actionType']")?.value;
  if (actionType) {
    dialogBody.querySelectorAll("[data-action-types]").forEach((element) => {
      const types = String(element.dataset.actionTypes || "").split(/\s+/);
      setEditorConditionalVisibility(
        element,
        types.includes("*") || types.includes(actionType)
      );
    });
  }
  const triggerEnabledControl = dialogBody.querySelector(
    "[data-editor-trigger-enabled]"
  );
  const triggerEnabled =
    !triggerEnabledControl || triggerEnabledControl.checked;
  triggerEnabledControl
    ?.closest(".dialog-section")
    ?.classList.toggle("is-trigger-disabled", !triggerEnabled);
  dialogBody.querySelectorAll("[data-trigger-enabled]").forEach((element) => {
    setEditorConditionalVisibility(element, triggerEnabled);
  });
  const triggerType = dialogBody.querySelector("[name='triggerType']")?.value;
  if (triggerType) {
    dialogBody.querySelectorAll("[data-trigger-types]").forEach((element) => {
      const types = String(element.dataset.triggerTypes || "").split(/\s+/);
      setEditorConditionalVisibility(
        element,
        triggerEnabled &&
          (types.includes("*") || types.includes(triggerType))
      );
    });
  }
}

function setEditorConditionalVisibility(element, visible) {
  element.hidden = !visible;
  element
    .querySelectorAll("input, select, textarea, button")
    .forEach((control) => {
      if (!visible) {
        if (!control.disabled) {
          control.dataset.editorConditionalDisabled = "true";
          control.disabled = true;
        }
      } else if (control.dataset.editorConditionalDisabled === "true") {
        delete control.dataset.editorConditionalDisabled;
        control.disabled = false;
      }
    });
}

function conditionValue(conditions, fieldName, operator) {
  return (
    (conditions || []).find(
      (condition) =>
        condition.field === fieldName &&
        (!operator || condition.operator === operator)
    )?.value || ""
  );
}

function buildTriggerConditions(existing, data) {
  const managedFields = new Set(["data.giftName", "user.name", "data.message"]);
  const conditions = (existing || []).filter(
    (condition) => !managedFields.has(condition.field)
  );
  const giftName = String(data.get("giftNameCondition") || "").trim();
  const username = String(data.get("usernameCondition") || "")
    .trim()
    .replace(/^@+/, "");
  const message = String(data.get("messageCondition") || "").trim();
  if (giftName) {
    conditions.push({
      field: "data.giftName",
      operator: "equals",
      value: giftName
    });
  }
  if (username) {
    conditions.push({ field: "user.name", operator: "equals", value: username });
  }
  if (message) {
    conditions.push({
      field: "data.message",
      operator: "contains",
      value: message
    });
  }
  return conditions;
}

async function ensureRuleInActiveProfile() {
  // The store now attaches every rule directly to the active profile workspace.
}

function actionTypeOptions(currentType) {
  const canonicalCurrentType = canonicalActionType(currentType);
  const groups = [
    ["VISUEL & AUDIO", ["overlay.media", "audio.play"]],
    ["INTERACTIONS", ["goal.add", "timer.add", "wheel.spin", "chat.reply"]],
    ["INTÉGRATIONS", ["spotify.queue", "obs.request", "http.request", "websocket.send"]],
    ["SYSTÈME", ["system.keys", "system.open", "delay"]]
  ];
  const existingHiddenOption =
    canonicalCurrentType && !canAccessActionType(canonicalCurrentType)
      ? `<optgroup label="ACTION EXISTANTE"><option value="${escapeHtml(canonicalCurrentType)}" selected>${escapeHtml(actionTypeOptionLabel(canonicalCurrentType))} · masquée par l’administration</option></optgroup>`
      : "";
  return existingHiddenOption + groups
    .map(
      ([label, types]) =>
        `<optgroup label="${label}">${types
          .filter(canAccessActionType)
          .map(
            (type) =>
              `<option value="${escapeHtml(type)}" ${type === canonicalCurrentType ? "selected" : ""}>${escapeHtml(actionTypeOptionLabel(type))}</option>`
          )
          .join("")}</optgroup>`
    )
    .join("");
}

function gameInteractionRowData(row) {
  if (!row) return "";
  return [
    `data-rule="${escapeHtml(row.rule.id)}"`,
    `data-row-action="${escapeHtml(row.action.id || "")}"`,
    `data-index="${row.actionIndex}"`
  ].join(" ");
}

function openGameInteractionCatalog(pack, row = null) {
  const groups = [
    ...new Set(
      (pack.effects || []).map(
        (effect) => effect.category || "Interaction"
      )
    )
  ].sort((left, right) => left.localeCompare(right, "fr"));
  const currentEffectId = row?.action.config?.effectId || "";
  const rowData = gameInteractionRowData(row);
  openEditor({
    title: row ? "Changer l’interaction" : "Ajouter une interaction",
    kicker: `${pack.name.toLocaleUpperCase("fr")} · ${pack.effects.length} ACTIONS DISPONIBLES`,
    variant: "effect-library",
    body: `<div class="game-effect-library">
      <header class="game-effect-library-intro">
        <div><span>CATALOGUE DU JEU</span><h3>Choisissez l’action à déclencher</h3><p>Chaque interaction reprend son visuel et sa description. Vous configurerez le cadeau, le follow, les likes ou le message juste après.</p></div>
        <strong>${pack.effects.length}</strong>
      </header>
      <label class="game-effect-library-search">
        <span>⌕</span>
        <input type="search" data-game-effect-library-search autofocus placeholder="Rechercher une action, une catégorie ou un effet">
      </label>
      <div class="game-effect-library-groups">
        ${groups.map((category) => {
          const effects = pack.effects.filter(
            (effect) => (effect.category || "Interaction") === category
          );
          return `<section class="game-effect-library-group" data-game-effect-library-group>
            <header><span>${escapeHtml(category)}</span><strong>${effects.length}</strong></header>
            <div>${effects.map((effect) => {
              const searchText =
                `${effect.name} ${effect.description || ""} ${category} ${effect.code || effect.id}`
                  .toLocaleLowerCase("fr");
              const art = effect.image
                ? `<img src="${escapeHtml(effect.image)}" alt="" loading="lazy">`
                : `<span class="game-effect-library-fallback">${escapeHtml(effect.icon || "◇")}</span>`;
              return `<button type="button" class="game-effect-library-option ${effect.id === currentEffectId ? "selected" : ""}" data-select-game-effect data-pack="${escapeHtml(pack.id)}" data-effect="${escapeHtml(effect.id)}" data-filter="${escapeHtml(searchText)}" ${rowData}>
                ${art}
                <span><strong>${escapeHtml(effect.name)}</strong><small>${escapeHtml(effect.description || "Interaction de jeu ShenPulse.")}</small></span>
                <b>${effect.id === currentEffectId ? "✓" : "＋"}</b>
              </button>`;
            }).join("")}</div>
          </section>`;
        }).join("")}
      </div>
      <p class="game-effect-library-empty" data-game-effect-library-empty hidden>Aucune interaction ne correspond à cette recherche.</p>
    </div>`,
    onSubmit: null
  });
}

function gameEffectParameterFields(effect, config) {
  const parameters = Array.isArray(effect.parameters)
    ? effect.parameters
    : [];
  if (!parameters.length) {
    return `${field("quantity", "Quantité", config.quantity ?? 1, "number", 'min="1" max="1000"')}
      ${field("effectDuration", "Durée de l’effet (secondes)", config.duration ?? 0, "number", 'min="0" max="3600"')}`;
  }
  return parameters
    .map((parameter) => {
      const name = `effectParameter_${parameter.id}`;
      const value =
        config.parameters?.[parameter.id] ??
        parameter.defaultValue ??
        parameter.min ??
        0;
      const constraints = [
        `min="${Number(parameter.min ?? 0)}"`,
        `max="${Number(parameter.max ?? 100000)}"`,
        `step="${Number(parameter.step ?? 1)}"`
      ].join(" ");
      return field(
        name,
        parameter.label || parameter.id,
        value,
        "number",
        constraints
      );
    })
    .join("");
}

function gameEffectParametersFromForm(effect, data) {
  return Object.fromEntries(
    (effect.parameters || []).map((parameter) => {
      const raw = Number(data.get(`effectParameter_${parameter.id}`));
      const minimum = Number(parameter.min ?? 0);
      const maximum = Number(parameter.max ?? 100000);
      const fallback = Number(parameter.defaultValue ?? minimum);
      const value = Number.isFinite(raw) ? raw : fallback;
      return [
        parameter.id,
        Math.min(maximum, Math.max(minimum, value))
      ];
    })
  );
}

function openGameInteractionEditor(pack, effect, row = null) {
  const currentRule = row?.rule || {
    id: "",
    name: `${pack.name} · ${effect.name}`,
    enabled: true,
    priority: 50,
    trigger: {
      enabled: true,
      type: "gift",
      source: "*",
      threshold: 1
    },
    conditions: [],
    cooldown: { globalMs: 1000, perUserMs: 2000 },
    chance: 1,
    actions: []
  };
  const currentAction = row?.action || {
    id: "",
    type: effect.actionType || "game.effect",
    config: {
      packId: pack.id,
      effectId: effect.id,
      quantity: Number(effect.quantity || 1),
      duration: Number(effect.duration || 0),
      parameters: Object.fromEntries(
        (effect.parameters || []).map((parameter) => [
          parameter.id,
          Number(parameter.defaultValue || 0)
        ])
      ),
      ...(effect.winCounter
        ? {
            amount: Number(effect.winCounter.amount || 0),
            operation: effect.winCounter.operation || "adjust"
          }
        : {})
    }
  };
  const config = currentAction.config || {};
  const triggerEnabled = hasAutomaticTrigger(currentRule);
  const image = effect.image
    ? `<img src="${escapeHtml(effect.image)}" alt="${escapeHtml(effect.name)}">`
    : `<span>${escapeHtml(effect.icon || "◇")}</span>`;
  const rowData = gameInteractionRowData(row);
  const interactionTitle =
    currentRule.gameInteraction?.title || effect.name;
  openEditor({
    title: row ? "Modifier l’interaction" : "Configurer l’interaction",
    kicker: "INTERACTION DE JEU",
    variant: "effect",
    body: `<div class="game-interaction-editor">
      <section class="game-interaction-editor-hero">
        <div class="game-interaction-editor-art">${image}</div>
        <div><small>${escapeHtml(effect.category || "Interaction")}</small><h3>${escapeHtml(effect.name)}</h3><p>${escapeHtml(effect.description || "Interaction de jeu ShenPulse.")}</p><button type="button" class="button small ghost game-interaction-change" data-open-game-effect-library data-pack="${escapeHtml(pack.id)}" ${rowData}>Changer l’interaction</button></div>
      </section>
      <label class="game-interaction-enabled">
        <span class="switch"><input type="checkbox" name="effectEnabled" value="true" ${currentRule.enabled !== false ? "checked" : ""}><span></span></span>
        <span><strong>Interaction active</strong><small>Le public peut utiliser cette interaction pendant le LIVE.</small></span>
      </label>
      ${dialogSection(
        "Déclencheur TikTok",
        "Associez un événement ou un cadeau précis à cet effet.",
        `<label class="field"><span>Type de déclencheur</span><select name="triggerType" data-editor-trigger-type>${triggerTypeOptions(currentRule.trigger?.type)}</select></label>
        ${field("threshold", "Seuil / quantité", currentRule.trigger?.threshold || 1, "number", 'min="1"')}
        <div class="editor-conditional full" data-trigger-types="gift">${giftPickerField("giftNameCondition", "Cadeau TikTok", conditionValue(currentRule.conditions, "data.giftName", "equals"), "full")}</div>
        <div class="editor-conditional full" data-trigger-types="chat">${field("messageCondition", "Le message contient (optionnel)", conditionValue(currentRule.conditions, "data.message", "contains"), "text", "full")}</div>
        ${field("usernameCondition", "@ viewer précis (optionnel)", conditionValue(currentRule.conditions, "user.name", "equals"), "text", "full")}`,
        "game-interaction-trigger-section",
        `<label class="dialog-header-toggle" title="Activer ou désactiver le déclenchement automatique"><span>Automatique</span><span class="switch"><input type="checkbox" name="triggerEnabled" value="true" data-editor-trigger-enabled ${triggerEnabled ? "checked" : ""}><span></span></span></label>`
      )}
      ${dialogSection(
        "Réglages de l’effet",
        "Ajustez son intensité et ses délais sans quitter le jeu.",
        `${field("interactionTitle", "Nom affiché", interactionTitle, "text", "required full")}
        ${gameEffectParameterFields(effect, config)}
        ${field("globalCooldownSeconds", "Cooldown global (secondes)", Math.max(0, Number(currentRule.cooldown?.globalMs || 0) / 1000), "number", 'min="0" max="3600" step="0.1"')}
        ${field("userCooldownSeconds", "Cooldown par viewer (secondes)", Math.max(0, Number(currentRule.cooldown?.perUserMs || 0) / 1000), "number", 'min="0" max="3600" step="0.1"')}`
      )}
    </div>`,
    onSubmit: async (data) => {
      const nextAction = {
        ...currentAction,
        id: currentAction.id || `action_${cryptoId()}`,
        type: effect.actionType || "game.effect",
        config: {
          ...config,
          packId: pack.id,
          effectId: effect.id,
          quantity: Math.max(
            1,
            Number(data.get("quantity")) ||
              Number(effect.quantity || 1)
          ),
          duration: Math.max(
            0,
            Number(data.get("effectDuration")) ||
              Number(effect.duration || 0)
          ),
          parameters: gameEffectParametersFromForm(effect, data),
          ...(effect.winCounter
            ? {
                amount: Number(effect.winCounter.amount || 0),
                operation: effect.winCounter.operation || "adjust"
              }
            : {})
        }
      };
      const actions = [...(currentRule.actions || [])];
      if (row) actions[row.actionIndex] = nextAction;
      else actions.push(nextAction);
      const automatic = data.get("triggerEnabled") === "true";
      const ruleId = currentRule.id || `rule_${cryptoId()}`;
      const nextTitle =
        String(data.get("interactionTitle") || "").trim() || effect.name;
      await api.saveGameInteraction(pack.id, {
        ...currentRule,
        id: ruleId,
        name: `${pack.name} · ${nextTitle}`,
        enabled: data.get("effectEnabled") === "true",
        gameInteraction: {
          ...(currentRule.gameInteraction || {}),
          title: nextTitle
        },
        trigger: {
          ...(currentRule.trigger || {}),
          enabled: automatic,
          type: data.get("triggerType") || "gift",
          source: "*",
          threshold: Math.max(1, Number(data.get("threshold")) || 1)
        },
        conditions: automatic
          ? buildTriggerConditions(currentRule.conditions, data)
          : currentRule.conditions || [],
        cooldown: {
          globalMs: Math.round(
            Math.max(0, Number(data.get("globalCooldownSeconds")) || 0) *
              1000
          ),
          perUserMs: Math.round(
            Math.max(0, Number(data.get("userCooldownSeconds")) || 0) *
              1000
          )
        },
        actions
      });
      await ensureRuleInActiveProfile(ruleId);
      snapshot = await api.getSnapshot();
    }
  });
}

function openActionEditor(row) {
  const preset = arguments[1] || {};
  const currentRule = row?.rule || preset.rule || {
    id: "",
    name: "",
    enabled: true,
    priority: 50,
    trigger: {
      enabled: false,
      type: "gift",
      source: "*",
      threshold: 1
    },
    conditions: [],
    cooldown: { globalMs: 1000, perUserMs: 2000 },
    chance: 1,
    actions: []
  };
  const automaticTriggerEnabled = hasAutomaticTrigger(currentRule);
  const currentAction = row?.action || preset.action || {
    id: "",
    type: "overlay.media",
    config: {
      durationMs: 5000
    }
  };
  if (!row && !preset.action && !canAccessActionType(currentAction.type)) {
    currentAction.type =
      Object.keys(ACTION_TYPE_LABELS).find(canAccessActionType) ||
      currentAction.type;
  }
  const config = currentAction.config || {};
  const accessiblePacks = visibleGamePacks();
  const configuredPack =
    snapshot.packs.find(
      (pack) =>
        pack.id ===
        (config.packId || snapshot.state.session.activeGamePackId)
    );
  const activePack =
    (configuredPack && (canAccessGame(configuredPack) || Boolean(row))
      ? configuredPack
      : accessiblePacks[0]) ||
    snapshot.packs[0];
  const editorGamePacks =
    activePack && !accessiblePacks.some((pack) => pack.id === activePack.id)
      ? [activePack, ...accessiblePacks]
      : accessiblePacks;
  const configuredWheels = normalizeWheelConfig(
    overlayConfig("wheel")
  ).wheels;
  const connectionOptions = [
    ["", "Source du déclencheur"],
    ...snapshot.state.connections.map((connection) => [
      connection.id,
      connection.name
    ])
  ];
  const connectionsSelect = (name, current) =>
    `<label class="field"><span>Connexion</span><select name="${name}">${connectionOptions
      .map(
        ([value, label]) =>
          `<option value="${escapeHtml(value)}" ${value === current ? "selected" : ""}>${escapeHtml(label)}</option>`
      )
      .join("")}</select></label>`;
  const actionFields = [
    conditionalFields(
      "overlay.media",
      `<div class="form-grid">
        <label class="field"><span>Écran Media</span><select name="mediaScreen">
          ${Array.from({ length: 8 }, (_value, index) => {
            const screen = index + 1;
            return `<option value="${screen}" ${Number(config.screen || 1) === screen ? "selected" : ""}>Écran ${screen}</option>`;
          }).join("")}
        </select><small>Utilisez l’URL du même écran affichée en bas de la page Actions.</small></label>
        ${field("durationMs", "Durée à l’écran (ms)", config.durationMs || 5000, "number", 'min="500" max="60000"')}
        ${mediaPickerField(
          "url",
          "Média affiché",
          config.mediaUrl || "",
          config.mediaName || "",
          { optional: false }
        )}
        ${soundPickerField("soundUrl", config.soundUrl || "", {
          label: "Son optionnel",
          selectedName: config.soundName || "",
          optional: true
        })}
      </div>`
    ),
    conditionalFields(
      "audio.play",
      `<div class="form-grid">${soundPickerField(
        "soundLibrary",
        config.url || "",
        { selectedName: config.soundName || "" }
      )}${field("audioVolume", "Volume", config.volume ?? 0.9, "number", 'min="0" max="1" step="0.05"')}</div>`
    ),
    conditionalFields(
      "tts.speak",
      `<div class="form-grid">
        <label class="field full"><span>Texte prononcé</span><textarea name="text" required>${escapeHtml(config.text || "{{data.message}}")}</textarea><small>Avec le déclencheur « Message du chat », ShenPulse lit uniquement le commentaire reçu.</small></label>
        ${ttsVoiceField("ttsVoice", config.voice || snapshot.state.settings.tts.voice || "")}
        ${field("ttsRate", "Vitesse", config.rate ?? snapshot.state.settings.tts.rate ?? 1, "number", 'min="0.5" max="2" step="0.1"')}
        ${field("ttsPitch", "Hauteur", config.pitch ?? snapshot.state.settings.tts.pitch ?? 1, "number", 'min="0" max="2" step="0.1"')}
        ${field("ttsVolume", "Volume", config.volume ?? snapshot.state.settings.tts.volume ?? 0.9, "number", 'min="0" max="1" step="0.05"')}
        ${ttsCommentFilterFields(config)}
      </div>`
    ),
    conditionalFields(
      "goal.add",
      `<div class="form-grid">
        <label class="field"><span>Objectif</span><select name="goalId">${snapshot.state.goals.map((goal) => `<option value="${escapeHtml(goal.id)}" ${(config.goalId || snapshot.state.goals[0]?.id) === goal.id ? "selected" : ""}>${escapeHtml(goal.name)}</option>`).join("")}</select></label>
        ${field("amount", "Valeur ajoutée", config.amount ?? 1, "number")}
      </div>`
    ),
    conditionalFields(
      "timer.add",
      `<div class="form-grid">
        <label class="field"><span>Commande du timer</span><select name="timerOperation">${[
          ["add", "Ajouter / retirer du temps"],
          ["set", "Définir le temps"],
          ["pause", "Mettre en pause"],
          ["resume", "Reprendre"],
          ["reset", "Réinitialiser"]
        ].map(([value, label]) => `<option value="${value}" ${(config.operation || "add") === value ? "selected" : ""}>${label}</option>`).join("")}</select></label>
        ${field("seconds", "Secondes", config.seconds ?? 30, "number", 'min="-86400" max="86400"')}
        ${field("label", "Libellé", config.label || "TEMPS RESTANT", "text", "full")}
      </div>`
    ),
    conditionalFields(
      "wheel.spin",
      `<div class="form-grid">
        <label class="field full"><span>Roue à lancer</span><select name="wheelId">${configuredWheels.map((wheel) => `<option value="${escapeHtml(wheel.id)}" ${(config.wheelId || overlayConfig("wheel").selectedWheelId) === wheel.id ? "selected" : ""}>${escapeHtml(wheel.name)} · ${wheel.segments.length} segments</option>`).join("")}</select><small>Les segments, couleurs et actions sont gérés depuis la page Overlays.</small></label>
        <label class="field full"><span>Segments temporaires (optionnel)</span><textarea name="choices" placeholder="Laissez vide pour utiliser la roue configurée">${escapeHtml((config.choices || []).join("\n"))}</textarea><small>Un choix par ligne. Cette liste ne modifie pas la roue enregistrée.</small></label>
        ${field("wheelColor", "Couleur de secours", config.color || "#ff6a00", "color")}
      </div>`
    ),
    conditionalFields(
      "game.effect",
      `<div class="form-grid">
        <label class="field full"><span>Jeu ciblé</span><select name="gamePackId">${editorGamePacks.map((pack) => `<option value="${escapeHtml(pack.id)}" ${activePack?.id === pack.id ? "selected" : ""}>${escapeHtml(pack.name)} · ${pack.effects.length} interactions${canAccessGame(pack) ? "" : " · masqué"}</option>`).join("")}</select><small>Le jeu sera activé automatiquement avant le test ou l'exécution.</small></label>
        <label class="field full"><span>Effet du jeu actif</span><select name="effectId">${(activePack?.effects || []).map((effect) => `<option value="${escapeHtml(effect.id)}" ${(config.effectId || activePack.effects[0]?.id) === effect.id ? "selected" : ""}>${escapeHtml(effect.name)} · ${escapeHtml(effect.id)}</option>`).join("")}</select></label>
        ${field("quantity", "Quantité", config.quantity ?? 1, "number", 'min="1" max="100"')}
        ${field("effectDuration", "Durée (secondes)", config.duration ?? 0, "number", 'min="0"')}
      </div>`
    ),
    conditionalFields(
      "spotify.queue",
      `<div class="form-grid">
        <label class="field"><span>Commande Spotify</span><select name="spotifyOperation">${["request","queue","play","pause","next","now_playing","volume_up","volume_down"].map((operation) => `<option value="${operation}" ${(config.operation || "request") === operation ? "selected" : ""}>${operation}</option>`).join("")}</select></label>
        <label class="field"><span>Mode de demande</span><select name="spotifyMode"><option value="queue" ${config.mode !== "play" ? "selected" : ""}>Ajouter à la file</option><option value="play" ${config.mode === "play" ? "selected" : ""}>Lire immédiatement</option></select></label>
        ${field("spotifyQuery", "Titre, URL ou URI", config.query || config.uri || "{{data.message}}", "text", "full")}
        <label class="field"><span>Contenu explicite</span><select name="spotifyExplicit"><option value="true" ${config.allowExplicit !== false ? "selected" : ""}>Autorisé</option><option value="false" ${config.allowExplicit === false ? "selected" : ""}>Refusé</option></select></label>
      </div>`
    ),
    conditionalFields(
      "obs.request",
      `<div class="form-grid">${field("requestType", "Commande OBS WebSocket", config.requestType || "GetVersion", "text", "full")}<label class="field full"><span>Données JSON</span><textarea name="requestData">${escapeHtml(JSON.stringify(config.requestData || {}, null, 2))}</textarea></label></div>`
    ),
    conditionalFields(
      "http.request",
      `<div class="form-grid">
        ${field("httpUrl", "URL HTTP(S)", config.url || "https://", "url", "full")}
        <label class="field"><span>Méthode</span><select name="httpMethod">${["POST","PUT","PATCH","GET","DELETE"].map((method) => `<option ${String(config.method || "POST").toUpperCase() === method ? "selected" : ""}>${method}</option>`).join("")}</select></label>
        ${field("timeoutMs", "Délai maximal (ms)", config.timeoutMs || 10000, "number", 'min="500" max="30000"')}
        <label class="field"><span>En-têtes JSON</span><textarea name="httpHeaders">${escapeHtml(JSON.stringify(config.headers || {}, null, 2))}</textarea></label>
        <label class="field"><span>Corps JSON</span><textarea name="httpBody">${escapeHtml(JSON.stringify(config.body || {}, null, 2))}</textarea></label>
      </div>`
    ),
    conditionalFields(
      "websocket.send",
      `<div class="form-grid">${connectionsSelect("connectionId", config.connectionId || "")}<label class="field full"><span>Message JSON</span><textarea name="wsPayload">${escapeHtml(JSON.stringify(config.payload || {}, null, 2))}</textarea></label></div>`
    ),
    conditionalFields(
      "chat.reply",
      `<div class="form-grid">${connectionsSelect("chatConnectionId", config.connectionId || "")}${field("chatMessage", "Réponse envoyée", config.message || "Merci {{user.displayName}} !", "text", "full")}</div>`
    ),
    conditionalFields(
      "system.keys",
      `<div class="form-grid">${field("keys", "Touches Windows", config.keys || "", "text", "full")}<div class="field full"><small>Cette action nécessite l’autorisation « Simulation de touches » dans Paramètres.</small></div></div>`
    ),
    conditionalFields(
      "system.open",
      `<div class="form-grid">${field("openUrl", "URL HTTP(S) à ouvrir", config.url || "https://", "url", "full")}</div>`
    ),
    conditionalFields(
      "delay",
      `<div class="form-grid">${field("delayMs", "Durée d’attente (ms)", config.durationMs || 1000, "number", 'min="0" max="60000"')}</div>`
    )
  ].join("");
  openEditor({
    title: row ? "Modifier l’action" : "Créer une action",
    kicker: "ACTION & DÉCLENCHEUR",
    variant: "wide",
    body: `<div class="action-editor">
      ${dialogSection(
        "1. Action",
        "Définissez ce que ShenPulse exécutera.",
        `<div class="action-editor-basics full">
          ${field("name", "Nom de l’action", currentRule.name, "text", "required autofocus")}
          <label class="field full"><span>Type d’action</span><select name="actionType" data-editor-action-type>${actionTypeOptions(currentAction.type)}</select></label>
        </div>
        <div class="action-config-stage full">
          <div class="action-config-heading"><strong>Configuration</strong><small>Seuls les réglages utiles au type choisi sont affichés.</small></div>
          ${actionFields}
        </div>`,
        "dialog-section-accent"
      )}
      ${dialogSection(
        "2. Déclencheur",
        "Optionnel : lancez automatiquement cette action lors d’un événement précis.",
        `<div class="trigger-editor-fields editor-conditional full" data-trigger-enabled>
          <label class="field"><span>Déclencheur</span><select name="triggerType" data-editor-trigger-type>${triggerTypeOptions(currentRule.trigger?.type)}</select></label>
          ${field("threshold", "Seuil / quantité", currentRule.trigger?.threshold || 1, "number", 'min="1"')}
          <div class="editor-conditional full" data-trigger-types="gift">${giftPickerField("giftNameCondition", "Cadeau précis (optionnel)", conditionValue(currentRule.conditions, "data.giftName", "equals"), "full")}</div>
          <div class="editor-conditional full" data-trigger-types="chat">${field("messageCondition", "Le message contient (optionnel)", conditionValue(currentRule.conditions, "data.message", "contains"), "text", "full")}</div>
          ${field("usernameCondition", "@ viewer précis (optionnel)", conditionValue(currentRule.conditions, "user.name", "equals"), "text", "full")}
        </div>`,
        "trigger-option-section",
        `<label class="dialog-header-toggle" title="Activer ou désactiver le déclencheur automatique">
          <span>Automatique</span>
          <span class="switch"><input type="checkbox" name="triggerEnabled" value="true" data-editor-trigger-enabled ${automaticTriggerEnabled ? "checked" : ""}><span></span></span>
        </label>`
      )}
      <details class="dialog-advanced" data-trigger-enabled>
        <summary>Réglages avancés du déclencheur</summary>
        <div class="form-grid">
          ${field("globalCooldown", "Cooldown global (ms)", currentRule.cooldown?.globalMs || 0, "number", 'min="0"')}
          ${field("userCooldown", "Cooldown viewer (ms)", currentRule.cooldown?.perUserMs || 0, "number", 'min="0"')}
        </div>
      </details>
    </div>`,
    onSubmit: async (data) => {
      const type = data.get("actionType");
      const triggerEnabled = data.get("triggerEnabled") === "true";
      const libraryUrl = data.get("soundLibrary");
      const rawUrl = String(libraryUrl || "").trim();
      const nextConfig = { ...config };
      if (type === "overlay.media") {
        const mediaUrl = String(data.get("url") || "").trim();
        if (!mediaUrl) {
          throw new Error("Choisissez le média à afficher.");
        }
        Object.assign(nextConfig, {
          screen: Math.min(
            8,
            Math.max(1, Math.round(Number(data.get("mediaScreen")) || 1))
          ),
          mediaUrl,
          mediaName: data.get("urlName"),
          soundUrl: data.get("soundUrl"),
          soundName: data.get("soundUrlName"),
          durationMs: Number(data.get("durationMs"))
        });
        delete nextConfig.title;
        delete nextConfig.message;
        delete nextConfig.color;
      } else if (type === "audio.play") {
        if (!rawUrl) {
          throw new Error("Choisissez un son à jouer.");
        }
        Object.assign(nextConfig, {
          url: rawUrl,
          soundName: data.get("soundLibraryName"),
          volume: Number(data.get("audioVolume"))
        });
      } else if (type === "tts.speak") {
        Object.assign(nextConfig, {
          text: data.get("text"),
          voice: data.get("ttsVoice"),
          rate: Number(data.get("ttsRate")),
          pitch: Number(data.get("ttsPitch")),
          volume: Number(data.get("ttsVolume")),
          readEmojis: data.has("ttsReadEmojis"),
          allowMentions: data.has("ttsAllowMentions"),
          allowCommands: data.has("ttsAllowCommands"),
          allowLinks: data.has("ttsAllowLinks")
        });
        delete nextConfig.language;
      } else if (type === "goal.add") {
        Object.assign(nextConfig, {
          goalId: data.get("goalId"),
          amount: Number(data.get("amount"))
        });
      } else if (type === "timer.add") {
        Object.assign(nextConfig, {
          seconds: Number(data.get("seconds")),
          label: data.get("label"),
          operation: data.get("timerOperation")
        });
      } else if (type === "wheel.spin") {
        Object.assign(nextConfig, {
          wheelId: data.get("wheelId") || "",
          choices: String(data.get("choices") || "").split(/\r?\n|,/).map((value) => value.trim()).filter(Boolean),
          color: data.get("wheelColor")
        });
      } else if (type === "game.effect") {
        Object.assign(nextConfig, {
          packId: data.get("gamePackId") || activePack?.id || "",
          effectId: data.get("effectId"),
          duration: Number(data.get("effectDuration")),
          quantity: Number(data.get("quantity"))
        });
      } else if (type === "spotify.queue") {
        Object.assign(nextConfig, {
          operation: data.get("spotifyOperation"),
          query: data.get("spotifyQuery"),
          uri: data.get("spotifyQuery"),
          mode: data.get("spotifyMode"),
          allowExplicit: data.get("spotifyExplicit") !== "false"
        });
      } else if (type === "obs.request") {
        Object.assign(nextConfig, {
          requestType: data.get("requestType"),
          requestData: parseJsonInput(data.get("requestData"), "Données OBS")
        });
      } else if (type === "http.request") {
        Object.assign(nextConfig, {
          url: data.get("httpUrl"),
          method: data.get("httpMethod"),
          timeoutMs: Number(data.get("timeoutMs")),
          headers: parseJsonInput(data.get("httpHeaders"), "En-têtes HTTP"),
          body: parseJsonInput(data.get("httpBody"), "Corps HTTP")
        });
      } else if (type === "websocket.send") {
        Object.assign(nextConfig, {
          connectionId: data.get("connectionId"),
          payload: parseJsonInput(data.get("wsPayload"), "Message WebSocket")
        });
      } else if (type === "chat.reply") {
        Object.assign(nextConfig, {
          connectionId: data.get("chatConnectionId"),
          message: data.get("chatMessage")
        });
      } else if (type === "system.keys") {
        nextConfig.keys = data.get("keys");
      } else if (type === "system.open") {
        nextConfig.url = data.get("openUrl");
      } else if (type === "delay") {
        nextConfig.durationMs = Number(data.get("delayMs"));
      }
      const nextAction = {
        ...currentAction,
        id: currentAction.id || `action_${cryptoId()}`,
        type,
        config: nextConfig
      };
      const ruleId = currentRule.id || `rule_${cryptoId()}`;
      const actions = [...(currentRule.actions || [])];
      if (row) actions[row.actionIndex] = nextAction;
      else actions.push(nextAction);
      await api.upsert("rules", {
        ...currentRule,
        id: ruleId,
        name: data.get("name"),
        enabled: true,
        trigger: {
           ...(currentRule.trigger || {}),
           enabled: triggerEnabled,
           type: triggerEnabled
             ? data.get("triggerType")
             : currentRule.trigger?.type || "gift",
           source: "*",
           threshold: triggerEnabled
             ? Number(data.get("threshold"))
             : Number(currentRule.trigger?.threshold || 1)
         },
         conditions: triggerEnabled
           ? buildTriggerConditions(currentRule.conditions, data)
           : currentRule.conditions || [],
        cooldown: {
          globalMs: triggerEnabled
            ? Number(data.get("globalCooldown"))
            : Number(currentRule.cooldown?.globalMs || 0),
          perUserMs: triggerEnabled
            ? Number(data.get("userCooldown"))
            : Number(currentRule.cooldown?.perUserMs || 0)
        },
        actions
      });
      await ensureRuleInActiveProfile(ruleId);
      snapshot = await api.getSnapshot();
    }
  });
}

function parseJsonInput(value, label) {
  try {
    return JSON.parse(String(value || "{}"));
  } catch {
    throw new Error(`${label} : JSON invalide.`);
  }
}

function openTtsEditor(row) {
  const settings = snapshot.state.settings.tts || {};
  const currentRule = row?.rule || {
    id: "",
    name: "Nouvelle règle TTS",
    enabled: true,
    priority: 50,
    trigger: {
      enabled: true,
      type: "chat",
      source: "*",
      threshold: 1
    },
    conditions: [],
    cooldown: { globalMs: 0, perUserMs: 0 },
    chance: 1,
    actions: []
  };
  const currentAction = row?.action || {
    id: "",
    type: "tts.speak",
    config: {
      text: "{{data.message}}",
      voice: settings.voice || "",
      rate: settings.rate ?? 1,
      pitch: settings.pitch ?? 1,
      volume: settings.volume ?? 0.9
    }
  };
  const config = currentAction.config || {};
  openEditor({
    title: row ? "Modifier la règle TTS" : "Ajouter une règle TTS",
    kicker: "SYNTHÈSE VOCALE GLOBALE",
    variant: "wide",
    body: `<div class="action-editor">
      ${dialogSection(
        "Lecture des commentaires",
        "Choisissez la voix et son rendu. Le texte lu sera toujours le commentaire reçu.",
        `${field("name", "Nom de la règle", currentRule.name, "text", "required full")}
        ${ttsVoiceField("voice", config.voice || settings.voice || "")}
        ${field("rate", "Vitesse", config.rate ?? settings.rate ?? 1, "number", 'min="0.5" max="2" step="0.1"')}
        ${field("pitch", "Hauteur", config.pitch ?? settings.pitch ?? 1, "number", 'min="0" max="2" step="0.1"')}
        ${field("volume", "Volume", config.volume ?? settings.volume ?? 0.9, "number", 'min="0" max="1" step="0.05"')}`,
        "dialog-section-accent"
      )}
      ${dialogSection(
        "Filtres des commentaires",
        "Choisissez précisément quels messages peuvent être lus à voix haute.",
        ttsCommentFilterFields(config),
        "tts-filter-section"
      )}
    </div>`,
    onSubmit: async (data) => {
      const actionConfig = {
        ...config,
        text: "{{data.message}}",
        voice: data.get("voice"),
        rate: Number(data.get("rate")),
        pitch: Number(data.get("pitch")),
        volume: Number(data.get("volume")),
        readEmojis: data.has("ttsReadEmojis"),
        allowMentions: data.has("ttsAllowMentions"),
        allowCommands: data.has("ttsAllowCommands"),
        allowLinks: data.has("ttsAllowLinks")
      };
      delete actionConfig.language;
      const action = {
        ...currentAction,
        id: currentAction.id || `action_${cryptoId()}`,
        type: "tts.speak",
        config: actionConfig
      };
      const actions = [...(currentRule.actions || [])];
      if (row) actions[row.actionIndex] = action;
      else actions.push(action);
      const ruleId = currentRule.id || `rule_${cryptoId()}`;
      await api.upsert("rules", {
        ...currentRule,
        id: ruleId,
        name: data.get("name"),
        enabled: currentRule.enabled !== false,
        trigger: {
          enabled: true,
          type: "chat",
          source: "*",
          threshold: 1
        },
        conditions: [],
        cooldown: { globalMs: 0, perUserMs: 0 },
        actions
      });
      await ensureRuleInActiveProfile(ruleId);
      acceptSnapshot(await api.getSnapshot());
    }
  });
}

function openSoundEditor(row, preferredSoundId = "") {
  const preferred = SOUND_LIBRARY.find((sound) => sound.id === preferredSoundId);
  const currentRule = row?.rule || {
    id: "",
    name: preferred ? `Son · ${preferred.name}` : "Nouvelle alerte sonore",
    enabled: true,
    priority: 50,
    trigger: { type: "gift", source: "*", threshold: 1 },
    conditions: [],
    cooldown: { globalMs: 1000, perUserMs: 1500 },
    chance: 1,
    actions: []
  };
  const currentAction = row?.action || {
    id: "",
    type: "audio.play",
    config: { url: preferred?.url || "", volume: 0.9 }
  };
  const config = currentAction.config || {};
  openEditor({
    title: row ? "Modifier l’alerte sonore" : "Créer une alerte sonore",
    kicker: "BIBLIOTHÈQUE AUDIO",
    variant: "wide",
    body: `<div class="action-editor">
      ${dialogSection(
        "1. Son",
        "Recherchez, écoutez puis choisissez un son.",
        `${field("name", "Nom de l’alerte", currentRule.name, "text", "required full")}
        ${soundPickerField("soundUrl", config.url || "", {
          selectedName: config.soundName || ""
        })}
        ${field("volume", "Volume", config.volume ?? 0.9, "number", 'min="0" max="1" step="0.05"')}`,
        "dialog-section-accent"
      )}
      ${dialogSection(
        "2. Déclencheur",
        "Associez le son à une interaction du LIVE.",
        `<label class="field"><span>Déclencheur</span><select name="triggerType" data-editor-trigger-type>${triggerTypeOptions(currentRule.trigger?.type)}</select></label>
        ${field("threshold", "Seuil", currentRule.trigger?.threshold || 1, "number", 'min="1"')}
        <div class="editor-conditional full" data-trigger-types="gift">${giftPickerField("giftNameCondition", "Cadeau précis (optionnel)", conditionValue(currentRule.conditions, "data.giftName", "equals"), "full")}</div>
        ${field("cooldown", "Cooldown (ms)", currentRule.cooldown?.globalMs || 1000, "number", 'min="0"')}`
      )}
    </div>`,
    onSubmit: async (data) => {
      const nextAction = {
        ...currentAction,
        id: currentAction.id || `action_${cryptoId()}`,
        type: "audio.play",
        config: {
          ...config,
          url: data.get("soundUrl"),
          soundName: data.get("soundUrlName"),
          volume: Number(data.get("volume"))
        }
      };
      const actions = [...(currentRule.actions || [])];
      if (row) actions[row.actionIndex] = nextAction;
      else actions.push(nextAction);
      const ruleId = currentRule.id || `rule_${cryptoId()}`;
      await api.upsert("rules", {
        ...currentRule,
        id: ruleId,
        name: data.get("name"),
        enabled: true,
        trigger: {
          ...(currentRule.trigger || {}),
          type: data.get("triggerType"),
          source: "*",
          threshold: Number(data.get("threshold"))
        },
        conditions: buildTriggerConditions(currentRule.conditions, data),
        cooldown: {
          ...(currentRule.cooldown || {}),
          globalMs: Number(data.get("cooldown"))
        },
        actions
      });
      await ensureRuleInActiveProfile(ruleId);
      snapshot = await api.getSnapshot();
    }
  });
}

function openTimerEditor(timer) {
  const current = timer || {
    id: "",
    name: "",
    enabled: true,
    intervalMs: 60000,
    repeatCount: 1,
    repeatDelayMs: 0,
    actionIds: [],
    lastRunAt: ""
  };
  const interval = timerIntervalParts(current.intervalMs);
  const selectedActionIds = new Set(current.actionIds || []);
  const actionRows = flattenActions();
  const actionPicker = actionRows.length
    ? actionRows
        .map(
          ({ rule, action }) => `
            <label class="timer-action-option" data-timer-action-option data-searchable="${escapeHtml(`${rule.name} ${actionTypeLabel(action.type)} ${actionDescription(action)}`.toLowerCase())}">
              <input type="checkbox" name="actionIds" value="${escapeHtml(action.id)}" ${selectedActionIds.has(action.id) ? "checked" : ""}>
              <span class="timer-action-check">✓</span>
              <span><strong>${escapeHtml(rule.name)}</strong><small>${escapeHtml(actionTypeLabel(action.type))} · ${escapeHtml(actionDescription(action))}</small></span>
            </label>`
        )
        .join("")
    : `<div class="timer-actions-empty">Créez d’abord au moins une action dans le sous-onglet Actions.</div>`;
  openEditor({
    title: timer ? "Modifier le timer" : "Créer un timer",
    kicker: "PLANIFICATEUR D’ACTIONS",
    variant: "wide",
    body: `<div class="action-editor">
      ${dialogSection(
        "1. Fréquence",
        "Choisissez à quel rythme le cycle d’actions doit démarrer.",
        `${field("name", "Nom du timer", current.name, "text", "required full autofocus")}
        <div class="timer-editor-enabled full">
          <span><strong>Timer actif</strong><small>Le compteur repart de zéro à chaque activation ou modification.</small></span>
          <span class="switch"><input type="checkbox" name="enabled" value="true" ${current.enabled !== false ? "checked" : ""}><span></span></span>
        </div>
        ${field("intervalValue", "Exécuter toutes les", interval.value, "number", 'required min="1" step="1"')}
        <label class="field"><span>Unité</span><select name="intervalUnit">
          <option value="seconds" ${interval.unit === "seconds" ? "selected" : ""}>Secondes</option>
          <option value="minutes" ${interval.unit === "minutes" ? "selected" : ""}>Minutes</option>
          <option value="hours" ${interval.unit === "hours" ? "selected" : ""}>Heures</option>
        </select></label>
        ${field("repeatCount", "Nombre d’exécutions à la suite", Math.max(1, Number(current.repeatCount || 1)), "number", 'required min="1" max="100" step="1"')}
        ${field("repeatDelaySeconds", "Pause entre deux exécutions (secondes)", Number(current.repeatDelayMs || 0) / 1000, "number", 'min="0" max="60" step="0.1"')}`,
        "dialog-section-accent"
      )}
      ${dialogSection(
        "2. Actions à exécuter",
        "Sélectionnez une ou plusieurs actions. Elles seront lancées dans l’ordre affiché.",
        `<label class="field full"><span>Rechercher une action</span><input type="search" data-timer-action-search placeholder="Nom, type ou configuration…"></label>
        <div class="timer-action-picker full">${actionPicker}</div>`
      )}
    </div>`,
    onSubmit: async (data) => {
      const actionIds = data.getAll("actionIds").map(String).filter(Boolean);
      if (!actionIds.length) {
        throw new Error("Sélectionnez au moins une action à exécuter.");
      }
      const multipliers = {
        seconds: 1000,
        minutes: 60000,
        hours: 3600000
      };
      const intervalUnit = data.get("intervalUnit");
      const intervalMs =
        Number(data.get("intervalValue")) *
        (multipliers[intervalUnit] || multipliers.minutes);
      await api.upsert("timers", {
        ...current,
        id: current.id || `timer_${cryptoId()}`,
        name: data.get("name"),
        enabled: data.get("enabled") === "true",
        intervalMs,
        repeatCount: Number(data.get("repeatCount")),
        repeatDelayMs: Number(data.get("repeatDelaySeconds")) * 1000,
        actionIds,
        createdAt: current.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
      acceptSnapshot(await api.getSnapshot());
    }
  });
}

function timerIntervalParts(intervalMs) {
  const value = Math.max(1000, Number(intervalMs) || 60000);
  if (value % 3600000 === 0) {
    return { value: value / 3600000, unit: "hours" };
  }
  if (value % 60000 === 0) {
    return { value: value / 60000, unit: "minutes" };
  }
  return { value: Math.max(1, Math.round(value / 1000)), unit: "seconds" };
}

function openRuleEditor(rule) {
  const current = rule || {
    id: "",
    name: "",
    enabled: true,
    priority: 50,
    trigger: { type: "gift", source: "*", threshold: 1 },
    conditions: [],
    cooldown: { globalMs: 1000, perUserMs: 2000 },
    chance: 1,
    actions: []
  };
  openEditor({
    title: rule ? "Modifier le déclencheur" : "Nouveau déclencheur",
    kicker: "MOTEUR DE DÉCLENCHEURS",
    body: `<div class="trigger-editor">
      ${dialogSection(
        "Configuration",
        "Choisissez l’événement qui doit lancer ce déclencheur.",
        `${field("name", "Nom du déclencheur", current.name, "text", "required full autofocus")}
        <div class="trigger-editor-source-note full"><span>◎</span><div><strong>Toutes les sources</strong><small>Les événements LIVE et les tests sont toujours pris en compte automatiquement.</small></div></div>
        <label class="field"><span>Type de déclencheur</span><select name="triggerType" data-editor-trigger-type>${triggerTypeOptions(current.trigger.type)}</select></label>
        ${field("threshold", "Seuil / quantité", current.trigger.threshold || 1, "number", 'min="1"')}
        <div class="editor-conditional full" data-trigger-types="gift">${giftPickerField("giftNameCondition", "Cadeau précis (optionnel)", conditionValue(current.conditions, "data.giftName", "equals"), "full")}</div>
        <div class="editor-conditional full" data-trigger-types="chat">${field("messageCondition", "Message contient (optionnel)", conditionValue(current.conditions, "data.message", "contains"), "text", "full")}</div>
        ${field("usernameCondition", "@ viewer précis (optionnel)", conditionValue(current.conditions, "user.name", "equals"), "text", "full")}`,
        "dialog-section-accent"
      )}
    </div>`,
    onSubmit: async (data) => {
      const updated = {
        ...current,
        id: current.id || `rule_${cryptoId()}`,
        name: data.get("name"),
        trigger: { ...current.trigger, type: data.get("triggerType"), source: "*", threshold: Number(data.get("threshold")) },
        priority: Number(current.priority ?? 50),
        chance: Number(current.chance ?? 1),
        cooldown: {
          globalMs: Number(current.cooldown?.globalMs || 0),
          perUserMs: Number(current.cooldown?.perUserMs || 0)
        },
        conditions: buildTriggerConditions(current.conditions, data),
        actions: current.actions || []
      };
      await api.upsert("rules", updated);
      await ensureRuleInActiveProfile(updated.id);
      snapshot = await api.getSnapshot();
    }
  });
}

function openConnectionEditor(connection) {
  const current = connection || { id: "", name: "", type: "websocket", enabled: true, config: { url: "ws://127.0.0.1:21214" } };
  openEditor({
    title: connection ? "Modifier la source" : "Ajouter une source",
    kicker: "CONNEXION PLATEFORME",
    body: `<div class="form-grid">
      ${field("name", "Nom", current.name, "text", "required full")}
      <label class="field"><span>Type</span><select name="type"><option value="websocket" ${current.type === "websocket" ? "selected" : ""}>WebSocket autorisé</option><option value="twitch-irc" ${current.type === "twitch-irc" ? "selected" : ""}>Twitch IRC</option><option value="demo" ${current.type === "demo" ? "selected" : ""}>Démo</option></select></label>
      <label class="field"><span>Démarrage automatique</span><select name="enabled"><option value="true" ${current.enabled ? "selected" : ""}>Oui</option><option value="false" ${!current.enabled ? "selected" : ""}>Non</option></select></label>
      ${field("url", "URL WebSocket", current.config?.url || "", "text", "full")}
      ${field("channel", "Chaîne Twitch", current.config?.channel || "")}
      ${field("username", "Utilisateur Twitch", current.config?.username || "")}
      ${field("secret", "Nouveau jeton / secret", "", "password", "full")}
      <div class="field full"><small>Pour TikTok ou Kick, renseignez l’URL d’un relais autorisé qui émet { event, data }. Le secret est ajouté comme paramètre token à la connexion WebSocket.</small></div>
    </div>`,
    onSubmit: async (data) => {
      await api.saveConnection({
        ...current,
        id: current.id || `source_${cryptoId()}`,
        name: data.get("name"),
        type: data.get("type"),
        enabled: data.get("enabled") === "true",
        secret: data.get("secret"),
        config: { ...(current.config || {}), url: data.get("url"), channel: data.get("channel"), username: data.get("username") }
      });
      snapshot = await api.getSnapshot();
    }
  });
}

function openTikTokEditor() {
  const current = snapshot.state.settings.tiktok || {};
  openEditor({
    title: current.username
      ? `Compte TikTok @${current.username}`
      : "Connecter TikTok LIVE",
    kicker: "IDENTITÉ & DÉTECTION LIVE",
    submitLabel: "Détecter le LIVE",
    body: `<div class="form-grid">
      ${field("username", "@ du compte TikTok", current.username || "", "text", "required full")}
      <div class="field full tiktok-help">
        <strong>Détection automatique</strong>
        <small>Après validation, ShenPulse surveille ce compte en arrière-plan. S’il est hors ligne, la connexion se fera automatiquement dès son prochain LIVE.</small>
      </div>
    </div>`,
    onSubmit: async (data) => {
      snapshot = await api.saveTikTok({
        username: data.get("username")
      });
      snapshot = await api.startTikTok();
    }
  });
}

function openProfileManager() {
  const activeProfileId = snapshot.state.session.profileId;
  const profiles = snapshot.state.profiles;
  openEditor({
    title: "Gérer les profils",
    kicker: "PROFILS D’AUTOMATISATION",
    submitLabel: "Fermer",
    body: `<div class="profile-manager">
      <div class="profile-manager-toolbar">
        <div><strong>${profiles.length} profil${profiles.length > 1 ? "s" : ""}</strong><small>Actions, déclencheurs, timers, sons, overlays et réglages de jeux sont indépendants.</small></div>
        <button class="button primary" type="button" data-profile-action="create">＋ Nouveau profil</button>
      </div>
      <div class="profile-manager-list">
        ${profiles.map((profile) => {
          const ruleCount = profile.workspace?.rules?.length || 0;
          return `
          <article class="profile-manager-card ${profile.id === activeProfileId ? "active" : ""}">
            <span class="profile-manager-icon">${escapeHtml(profile.name.slice(0, 2).toUpperCase())}</span>
            <div>
              <h3>${escapeHtml(profile.name)} ${profile.id === activeProfileId ? '<span class="badge success">ACTIF</span>' : ""}</h3>
              <p>${escapeHtml(profile.description || "Aucune description")}</p>
              <small>${ruleCount} règle${ruleCount > 1 ? "s" : ""} · espace de travail indépendant</small>
            </div>
            <div class="profile-manager-actions">
              ${profile.id === activeProfileId ? "" : `<button class="button ghost" type="button" data-profile-action="activate" data-id="${escapeHtml(profile.id)}">Activer</button>`}
              <button class="button" type="button" data-profile-action="edit" data-id="${escapeHtml(profile.id)}">Modifier</button>
              <button class="button danger" type="button" data-profile-action="delete" data-id="${escapeHtml(profile.id)}" ${profiles.length <= 1 ? "disabled" : ""}>Supprimer</button>
            </div>
          </article>`;
        }).join("")}
      </div>
    </div>`,
    onSubmit: async () => {}
  });
}

function openProfileEditor(profile) {
  const current = profile || {
    id: "",
    name: "",
    description: ""
  };
  openEditor({
    title: profile ? `Modifier ${profile.name}` : "Créer un profil",
    kicker: "PROFIL D’AUTOMATISATION",
    submitLabel: profile ? "Enregistrer" : "Créer et activer",
    body: `<div class="form-grid profile-editor">
      ${field("name", "Nom du profil", current.name, "text", "required full")}
      <label class="field full"><span>Description</span><textarea name="description" placeholder="Usage, jeu ou ambiance de ce profil…">${escapeHtml(current.description || "")}</textarea></label>
      <div class="profile-workspace-notice full">
        <strong>${profile ? "Espace de travail conservé" : "Nouveau profil vierge"}</strong>
        <p>${profile
          ? "Modifier le nom ou la description ne change pas les actions et réglages de ce profil."
          : "Le profil démarre sans action, déclencheur, timer, règle sonore ni commande, avec les overlays par défaut. Les droits Pro, Premium, essais et jeux accordés à votre @ restent disponibles dans tous vos profils."}</p>
      </div>
    </div>`,
    onSubmit: async (data) => {
      const now = new Date().toISOString();
      const profileId = current.id || `profile_${cryptoId()}`;
      await api.upsert("profiles", {
        id: profileId,
        name: data.get("name"),
        description: data.get("description"),
        createdAt: current.createdAt || now,
        updatedAt: now
      });
      if (!profile) await api.selectProfile(profileId);
      snapshot = await api.getSnapshot();
    }
  });
}

function openGoalEditor(goal) {
  const current = goal || { id: "", name: "", type: "like", current: 0, target: 1000, color: "#8D5CF6", enabled: true, reset: "manual" };
  openEditor({
    title: goal ? "Modifier l’objectif" : "Nouvel objectif",
    kicker: "PROGRESSION",
    body: `<div class="form-grid">${field("name","Nom",current.name,"text","required full")}${field("type","Type",current.type)}${field("color","Couleur",current.color,"color")}${field("current","Valeur actuelle",current.current,"number",'min="0"')}${field("target","Cible",current.target,"number",'min="1"')}</div>`,
    onSubmit: async (data) => {
      await api.upsert("goals", { ...current, id: current.id || `goal_${cryptoId()}`, name: data.get("name"), type: data.get("type"), color: data.get("color"), current: Number(data.get("current")), target: Number(data.get("target")) });
      snapshot = await api.getSnapshot();
    }
  });
}

function openCommandEditor(command) {
  const current = command || { id: "", command: "!", response: "", enabled: true, subscriberOnly: false, cooldownMs: 10000 };
  openEditor({
    title: command ? "Modifier la commande" : "Nouvelle commande",
    kicker: "CHATBOT",
    body: `<div class="form-grid">${field("command","Commande",current.command,"text","required")}${field("cooldown","Cooldown (ms)",current.cooldownMs,"number",'min="0"')}${field("response","Réponse",current.response,"text","required full")}<label class="field"><span>Accès</span><select name="subscriberOnly"><option value="false" ${!current.subscriberOnly ? "selected" : ""}>Tout le monde</option><option value="true" ${current.subscriberOnly ? "selected" : ""}>Abonnés uniquement</option></select></label></div>`,
    onSubmit: async (data) => {
      await api.upsert("commands", { ...current, id: current.id || `command_${cryptoId()}`, command: data.get("command"), response: data.get("response"), cooldownMs: Number(data.get("cooldown")), subscriberOnly: data.get("subscriberOnly") === "true" });
      snapshot = await api.getSnapshot();
    }
  });
}

function openGameConfig(pack) {
  if (!requireGameAccess(pack)) return;
  const current = snapshot.state.game.connectorOverrides?.[pack.id] || {};
  const connector = { ...pack.connector, ...current };
  const inputs = connector.type === "rcon" || connector.type === "tcp" || connector.type === "udp"
    ? `${field("host","Hôte",connector.host || "127.0.0.1")}${field("port","Port",connector.port || "","number",'min="1" max="65535"')}`
    : connector.type === "websocket" || connector.type === "http"
      ? field("url","URL",connector.url || "","text","full")
      : `<div class="field full"><small>Le pack de démonstration ne nécessite aucune configuration.</small></div>`;
  openEditor({
    title: `Configurer ${pack.name}`,
    kicker: "PASSERELLE DE JEU",
    body: `<div class="form-grid">${inputs}${connector.type === "rcon" ? field("secret","Nouveau mot de passe RCON","","password","full") : ""}</div>`,
    onSubmit: async (data) => {
      const config = {};
      for (const key of ["host","port","url","secret"]) if (data.has(key) && data.get(key) !== "") config[key] = key === "port" ? Number(data.get(key)) : data.get(key);
      await api.configureGame(pack.id, config);
      snapshot = await api.getSnapshot();
    }
  });
}

function cryptoId() {
  return `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

async function testActionRow(row) {
  if (!row) throw new Error("Action introuvable.");
  return api.testAction({
    ...row.action,
    testEventType:
      row.action.type === "tts.speak"
        ? "chat"
        : row.rule.trigger?.type || "gift",
    ...(row.action.type === "tts.speak"
      ? { testMessage: "Ceci est un test de lecture ShenPulse." }
      : {})
  });
}

async function duplicateActionRow(row) {
  if (!row) throw new Error("Action introuvable.");
  const nextAction = structuredClone(row.action);
  nextAction.id = `action_${cryptoId()}`;
  const nextRule = {
    ...row.rule,
    actions: [...(row.rule.actions || []), nextAction]
  };
  await api.upsert("rules", nextRule);
  snapshot = await api.getSnapshot();
  render();
}

async function deleteActionRow(row) {
  if (!row) throw new Error("Action introuvable.");
  if (
    !(await confirmAction(
      `Supprimer l’action « ${actionTypeLabel(row.action.type)} » ?`,
      { title: "Supprimer cette action", confirmLabel: "Supprimer" }
    ))
  ) {
    return;
  }
  const actions = (row.rule.actions || []).filter((_item, index) => index !== row.actionIndex);
  if (actions.length) await api.upsert("rules", { ...row.rule, actions });
  else await api.remove("rules", row.rule.id);
  snapshot = await api.getSnapshot();
  render();
}

async function setSoundVolume(row, volume) {
  if (!row) throw new Error("Son introuvable.");
  const actions = [...(row.rule.actions || [])];
  actions[row.actionIndex] = {
    ...row.action,
    config: { ...(row.action.config || {}), volume: Number(volume) }
  };
  await api.upsert("rules", { ...row.rule, actions });
  snapshot = await api.getSnapshot();
}

function likeGoalTestAmount() {
  const editor = dialogBody.querySelector(
    '[data-overlay-config-editor="likeGoal"]'
  );
  const draftTarget = Number(
    editor?.querySelector('[name="target"]')?.value
  );
  const configuredTarget = Number(overlayConfig("likeGoal").target);
  const target = Number.isFinite(draftTarget) && draftTarget > 0
    ? draftTarget
    : configuredTarget;
  return Math.max(1, Math.round(target || 1));
}

async function dispatchOverlayTest(key) {
  const overlay = overlayDefinitions().find((item) => item.key === key);
  if (overlay && !canAccessOverlay(overlay)) {
    throw new Error("Cet overlay est masqué par la configuration ShenPulse.");
  }
  if (overlay && !overlayUnlocked(overlay)) {
    const frame = dialogBody.querySelector(
      `[data-overlay-config-editor="${CSS.escape(key)}"] [data-overlay-live-preview]`
    );
    if (!frame?.contentWindow) {
      throw new Error("L’aperçu Pro n’est pas encore chargé.");
    }
    const previewMessages = key === "multiplierTimer"
      ? [{
          channel: "timer",
          payload: { operation: "add", seconds: 30, label: "BONUS X2" }
        }]
      : key === "winCounter"
        ? [{
            channel: "win-counter",
            payload: { operation: "adjust", amount: 1 }
          }]
        : key.startsWith("match")
          ? [{
              channel: "event",
              payload: {
                type: "gift",
                timestamp: Date.now(),
                user: { displayName: "Spectateur test" },
                data: { giftName: "Rose", count: 1, value: 1 }
              }
            }]
          : [{
              channel: "game",
              payload: { effectName: "Effet de test", viewer: "Spectateur test" }
            }];
    for (const message of previewMessages) {
      frame.contentWindow.postMessage(
        {
          source: "shenpulse-overlay-card",
          channel: message.channel,
          payload: message.payload
        },
        new URL(frame.src).origin
      );
    }
    return { previewOnly: true };
  }
  if (["alerts", "myActions", "feed"].includes(key)) {
    const type = key === "feed" ? "chat" : "gift";
    const event = await api.testEvent(type);
    postOverlayCardEvent(key, "event", event);
    return event;
  }
  if (key === "goals") {
    const event = await api.testEvent("like");
    postOverlayCardEvent(key, "event", event);
    return event;
  }
  if (key === "likeGoal") {
    const amount = likeGoalTestAmount();
    const event = await api.simulateEvent({
      type: "like",
      count: amount,
      likeCount: amount
    });
    postOverlayCardEvent(key, "event", event);
    return event;
  }
  if (key === "topDonors" || key === "coinJar") {
    const gift = giftForName("Rose");
    const event = await api.simulateEvent({
      type: "gift",
      giftId: gift?.id || "rose",
      giftName: gift?.name || "Rose",
      giftImageUrl: gift?.imageUrl || "",
      count: 5,
      repeatCount: 5,
      value: gift?.cost || 1
    });
    postOverlayCardEvent(key, "event", event);
    return event;
  }
  if (key === "topTappers") {
    const event = await api.simulateEvent({
      type: "like",
      count: 250,
      likeCount: 250
    });
    postOverlayCardEvent(key, "event", event);
    return event;
  }
  if (key === "winCounter") {
    const payload = { operation: "adjust", amount: 1 };
    const result = await api.testAction({
      id: "preview_win_counter",
      type: "overlay.win-counter",
      config: payload
    });
    postOverlayCardEvent(key, "win-counter", payload);
    return result;
  }
  if (key.startsWith("match")) {
    const event = await api.testEvent("gift");
    postOverlayCardEvent(key, "event", event);
    return event;
  }
  if (key === "game") {
    const activePack = snapshot.packs.find(
      (pack) => pack.id === snapshot.state.session.activeGamePackId
    ) || snapshot.packs[0];
    return api.triggerEffect(activePack.effects[0]?.id || "spawn_enemy", {});
  }
  if (key === "timer") {
    const payload = {
      operation: "add",
      seconds: 30,
      label: "TEMPS RESTANT"
    };
    const result = await api.testAction({
      id: "preview_timer",
      type: "timer.add",
      config: payload
    });
    postOverlayCardEvent(key, "timer", payload);
    return result;
  }
  if (key === "multiplierTimer") {
    const payload = {
      operation: "add",
      seconds: 30,
      label: "BONUS X2"
    };
    const result = await api.testAction({
      id: "preview_multiplier_timer",
      type: "timer.add",
      config: payload
    });
    postOverlayCardEvent(key, "timer", payload);
    return result;
  }
  if (key === "wheel") {
    const config = normalizeWheelConfig(overlayConfig("wheel"));
    const wheel = config.wheels.find(
      (entry) => entry.id === config.selectedWheelId
    ) || config.wheels[0];
    const choices = wheel.segments.map((segment) => segment.label);
    const colors = wheel.segments.map((segment) => segment.color);
    const result = await api.testAction({
      id: "preview_wheel",
      type: "wheel.spin",
      config: {
        wheelId: wheel.id,
        choices: [],
        color: wheel.segments[0]?.color || "#ff6a00"
      }
    });
    postOverlayCardEvent(key, "wheel", {
      choices,
      colors,
      winnerIndex: 0,
      winner: choices[0] || "Surprise !",
      settings: wheel,
      design: wheel.design
    });
    return result;
  }
  throw new Error("Overlay inconnu.");
}

function previewGuestOverlay(key) {
  const timestamp = Date.now();
  const viewer = {
    id: `guest-preview-${timestamp}`,
    username: "spectateur_test",
    displayName: "Spectateur test",
    avatarUrl: ""
  };
  const event = (type, data) => ({
    id: `guest-preview-${type}-${timestamp}`,
    type,
    timestamp,
    user: viewer,
    data
  });

  if (key === "likeGoal") {
    return postOverlayCardEvent(key, "like-goal", {
      operation: "adjust",
      amount: Math.max(100, Math.round(likeGoalTestAmount() * 0.25))
    });
  }
  if (key === "topDonors" || key === "coinJar") {
    return postOverlayCardEvent(key, "event", event("gift", {
      giftName: "Rose",
      count: 5,
      repeatCount: 5,
      value: 1
    }));
  }
  if (key === "topTappers") {
    return postOverlayCardEvent(key, "event", event("like", {
      count: 250,
      likeCount: 250
    }));
  }
  if (key === "timer") {
    return postOverlayCardEvent(key, "timer", {
      operation: "set",
      seconds: 30,
      label: "TEMPS RESTANT"
    });
  }
  if (key === "multiplierTimer") {
    return postOverlayCardEvent(key, "multiplier-timer", {
      operation: "set",
      seconds: 30,
      multiplier: 2,
      label: "BONUS ACTIF"
    });
  }
  if (key === "winCounter") {
    return postOverlayCardEvent(key, "win-counter", {
      operation: "adjust",
      amount: 1
    });
  }
  if (key === "wheel") {
    const config = normalizeWheelConfig(overlayConfig("wheel"));
    const wheel = config.wheels.find(
      (entry) => entry.id === config.selectedWheelId
    ) || config.wheels[0];
    const choices = wheel.segments.map((segment) => segment.label);
    return postOverlayCardEvent(key, "wheel", {
      choices,
      colors: wheel.segments.map((segment) => segment.color),
      winnerIndex: 0,
      winner: choices[0] || "Surprise !",
      settings: wheel,
      design: wheel.design
    });
  }
  if (key.startsWith("match")) {
    return postOverlayCardEvent(key, "event", event("gift", {
      giftName: "Rose",
      count: 1,
      repeatCount: 1,
      value: 1
    }));
  }
  if (key === "myActions") {
    return postOverlayCardEvent(key, "event", event("gift", {
      giftName: "Rose",
      count: 1,
      repeatCount: 1,
      value: 1
    }));
  }
  return postOverlayCardEvent(key, "game", {
    effectName: "Effet de démonstration",
    viewer: "Spectateur test"
  });
}

async function previewOverlay(key) {
  if (!isAccountAuthenticated()) return previewGuestOverlay(key);
  return dispatchOverlayTest(key);
}

async function performOverlayQuickAction(key, operation, amount = 0) {
  const item = overlayDefinitions().find((entry) => entry.key === key);
  if (!item || !canAccessOverlay(item) || !overlayUnlocked(item)) {
    throw new Error("Cet overlay n’est pas disponible avec le profil actuel.");
  }
  if (operation === "test") return dispatchOverlayTest(key);

  const config = overlayConfig(key);
  const numericAmount = Math.abs(Number(amount || 0));
  let next = { ...config };
  let previewMessage = null;

  if (["likeGoal", "coinJar", "winCounter"].includes(key)) {
    const current = Number(config.current || 0);
    const delta = operation === "add"
      ? numericAmount
      : operation === "remove"
        ? -numericAmount
        : 0;
    next.current = operation === "reset"
      ? 0
      : key === "winCounter" && config.allowNegative !== false
        ? current + delta
        : Math.max(0, current + delta);
    await saveOverlayConfig(key, next, {
      rerender: false,
      updateCard: true
    });
    if (key === "winCounter") {
      await api.testAction({
        id: `quick_win_${cryptoId()}`,
        type: "overlay.win-counter",
        config: {
          operation: operation === "reset" ? "reset" : "adjust",
          amount: delta
        }
      });
      previewMessage = {
        channel: "win-counter",
        payload: {
          operation: operation === "reset" ? "reset" : "adjust",
          amount: delta
        }
      };
    } else {
      await api.testAction({
        id: `quick_${key}_${cryptoId()}`,
        type: key === "likeGoal" ? "overlay.like-goal" : "overlay.coin-jar",
        config: {
          operation: operation === "reset" ? "reset" : "adjust",
          amount: delta
        }
      });
      previewMessage = {
        channel: key === "likeGoal" ? "like-goal" : "coin-jar",
        payload: {
          operation: operation === "reset" ? "reset" : "adjust",
          amount: delta
        }
      };
    }
  } else if (["timer", "multiplierTimer"].includes(key)) {
    if (operation === "pause") {
      next.timerPaused = !config.timerPaused;
      await saveOverlayConfig(key, next, {
        rerender: false,
        updateCard: true
      });
      await api.testAction({
        id: `quick_timer_${cryptoId()}`,
        type: "timer.add",
        config: {
          operation: next.timerPaused ? "pause" : "resume",
          seconds: 0,
          label: config.title
        }
      });
      previewMessage = {
        channel: "timer",
        payload: {
          operation: next.timerPaused ? "pause" : "resume",
          seconds: 0,
          label: config.title
        }
      };
    } else {
      const delta = operation === "add"
        ? numericAmount
        : operation === "remove"
          ? -numericAmount
          : 0;
      next.seconds = operation === "reset"
        ? 0
        : Math.max(0, Number(config.seconds || 0) + delta);
      await saveOverlayConfig(key, next, {
        rerender: false,
        updateCard: true
      });
      await api.testAction({
        id: `quick_timer_${cryptoId()}`,
        type: "timer.add",
        config: {
          operation: operation === "reset" ? "reset" : "add",
          seconds: delta,
          label: config.title
        }
      });
      previewMessage = {
        channel: "timer",
        payload: {
          operation: operation === "reset" ? "reset" : "add",
          seconds: delta,
          label: config.title
        }
      };
    }
  }

  if (previewMessage) {
    postOverlayCardEvent(key, previewMessage.channel, previewMessage.payload);
  }
  if (dialog.open) scheduleOverlayLivePreview();
  return next;
}

async function handleAction(target) {
  const action = target.dataset.action;
  const id = target.dataset.id;
  if (!action) return;
  if (action === "account-login") {
    return openAccountLogin();
  }
  if (action === "account-logout") {
    const visibleSession = visibleAccountSession();
    if (
      !(await confirmAction(
        `Se déconnecter du compte ${visibleSession.email || "ShenPulse"} sur cet appareil ?`,
        { title: "Changer de compte", confirmLabel: "Se déconnecter" }
      ))
    ) {
      return;
    }
    const logoutOperation = (async () => {
      const nextSession = await api.account.logout();
      siteVisibility = await api.admin.visibility();
      acceptSnapshot(await api.getSnapshot());
      return nextSession;
    })();
    pendingAccountLogoutPromise = logoutOperation;
    accountSession = signedOutAccountSession();
    liveEvents = [];
    adminSession = {
      authorized: false,
      email: "",
      uid: "",
      lastAuthenticatedAt: ""
    };
    adminDashboard = null;
    ensureCurrentPageAccess();
    accountMenu.hidden = true;
    accountMenuButton.setAttribute("aria-expanded", "false");
    render();
    toast("Compte ShenPulse déconnecté");
    openAccountLogin();
    try {
      accountSession = await logoutOperation;
      render();
    } finally {
      if (pendingAccountLogoutPromise === logoutOperation) {
        pendingAccountLogoutPromise = null;
      }
    }
    return;
  }
  if (requireAccountForAction(action)) return;
  const requiredFeature = {
    "upload-sound": "backblaze.sounds",
    "add-tts": "tts.voices",
    "edit-tts": "tts.voices",
    "preview-tts": "tts.voices",
    "spotify-connect": "spotify.playback",
    "spotify-disconnect": "spotify.playback",
    "spotify-refresh": "spotify.playback",
    "spotify-control": "spotify.playback",
    "test-obs": "obs.websocket",
    "add-connection": "sources.custom",
    "edit-connection": "sources.custom",
    "start-connection": "sources.custom",
    "stop-connection": "sources.custom",
    "export-data": "data.management",
    "import-data": "data.management",
    "clear-data": "data.management",
    "restart-servers": "local.services"
  }[action];
  if (requiredFeature && !canAccessFeature(requiredFeature)) {
    return toast(
      "Fonction indisponible",
      "Cette fonction est masquée par la configuration ShenPulse.",
      true
    );
  }
  if (action === "admin-login") return openAdminLogin();
  if (action === "open-admin") {
    currentPage = "admin";
    render();
    content.scrollTop = 0;
    if (!adminDashboard) return refreshAdminDashboard();
    return;
  }
  if (action === "admin-logout") {
    if (
      !(await confirmAction(
        "Fermer la session d’administration sur cet appareil ?",
        {
          title: "Fermer l’administration",
          confirmLabel: "Se déconnecter"
        }
      ))
    ) {
      return;
    }
    await api.admin.logout();
    adminSession = { authorized: false, email: "", uid: "", lastAuthenticatedAt: "" };
    adminDashboard = null;
    siteVisibility = await api.admin.visibility();
    currentPage = "settings";
    ensureCurrentPageAccess();
    render();
    return toast("Administration déconnectée");
  }
  if (action === "admin-refresh") {
    return perform(() => refreshAdminDashboard(), "Administration actualisée");
  }
  if (action === "admin-workspace") {
    adminWorkspace = target.dataset.value || "overview";
    render();
    content.scrollTop = 0;
    return;
  }
  if (action === "admin-visibility-section") {
    adminVisibilitySection = target.dataset.value || "navigation";
    adminVisibilitySearch = "";
    return render();
  }
  if (action === "admin-visibility-sync") {
    if (!adminVisibilityAudit(adminDashboard.siteSettings).changed) return;
    return perform(
      () => syncAdminVisibilityCatalog(),
      "Inventaire ShenPulseNew synchronisé"
    );
  }
  if (action === "admin-visibility-bulk") {
    const scope = target.dataset.value || "public";
    if (
      !(await confirmAction(
        `Appliquer « ${scope === "public" ? "Visible par tous" : scope === "admin" ? "Moi uniquement" : "Masqué"} » à toute cette catégorie ?`,
        { title: "Modifier toute la catégorie", confirmLabel: "Appliquer" }
      ))
    ) return;
    return perform(
      () => saveAdminVisibilityBulk(scope),
      "Catégorie mise à jour"
    );
  }
  if (action === "admin-trial-edit") {
    const trial = adminTrialRows().find((item) => item.id === id);
    if (!trial) throw new Error("Essai introuvable.");
    return openAdminTrialEditor(trial);
  }
  if (action === "admin-trial-revoke") {
    if (adminModuleError("trials")) {
      throw new Error("Le service des offres d’essai est temporairement indisponible.");
    }
    const trial = adminTrialRows().find((item) => item.id === id);
    if (
      !trial ||
      !(await confirmAction(
        `Retirer immédiatement l’essai de ${trial.email || trial.beneficiaryEmail} ?`,
        { title: "Retirer l’offre d’essai", confirmLabel: "Retirer" }
      ))
    ) {
      return;
    }
    return perform(async () => {
      adminBusy = true;
      try {
        await api.admin.revokeTrial({ trialId: id });
        adminDashboard = await api.admin.dashboard();
      } finally {
        adminBusy = false;
        render();
        restoreAdminTrialFormInteractivity({ focusEmail: true });
      }
    }, "Offre d’essai retirée");
  }
  if (action === "admin-plan-edit") return openAdminPlanEditor(id);
  if (action === "admin-product-edit") return openAdminProductEditor(id);
  if (action === "admin-promotion-add") return openAdminPromotionEditor();
  if (action === "admin-promotion-edit") {
    const promotion = adminCommerceCatalog().promotions?.[id];
    if (!promotion) throw new Error("Promotion introuvable.");
    return openAdminPromotionEditor(promotion);
  }
  if (action === "admin-promotion-delete") {
    const promotion = adminCommerceCatalog().promotions?.[id];
    if (
      !promotion ||
      !(await confirmAction(`Supprimer la promotion « ${promotion.title} » ?`, {
        title: "Supprimer la promotion",
        confirmLabel: "Supprimer"
      }))
    ) {
      return;
    }
    const catalog = cloneAdminData(adminCommerceCatalog());
    delete catalog.promotions[id];
    return saveAdminCommerce(catalog, "save-draft", "Promotion supprimée");
  }
  if (action === "admin-commerce-publish") {
    const publishAction = target.dataset.value;
    const channel = publishAction === "publish-prod" ? "PROD" : "TEST";
    if (
      !(await confirmAction(`Publier le brouillon actuel sur ${channel} ?`, {
        title: `Publication ${channel}`,
        confirmLabel: "Publier",
        danger: false
      }))
    ) {
      return;
    }
    return saveAdminCommerce(
      cloneAdminData(adminCommerceCatalog()),
      publishAction,
      `Catalogue publié sur ${channel}`
    );
  }
  if (action === "admin-commerce-restore") {
    if (adminModuleError("commerce")) {
      throw new Error("Le commerce est temporairement disponible en lecture seule.");
    }
    if (
      !(await confirmAction(
        "Restaurer cette version dans le brouillon ? TEST et PROD resteront inchangés.",
        {
          title: "Restaurer cette version",
          confirmLabel: "Restaurer",
          danger: false
        }
      ))
    ) {
      return;
    }
    adminBusy = true;
    try {
      adminDashboard.commerce = await api.admin.saveCommerce({
        action: "restore-draft",
        historyId: id
      });
      toast("Version restaurée dans le brouillon");
    } finally {
      adminBusy = false;
      render();
    }
    return;
  }
  if (action === "set-actions-section") {
    actionsSection = target.dataset.value;
    return render();
  }
  if (action === "select-simulator-type") {
    simulatorType = target.dataset.type || "gift";
    return render();
  }
  if (action === "filter-enabled-actions") {
    onlyEnabledActions = target.checked;
    return render();
  }
  if (action === "set-overlay-category") {
    overlayCategory = target.dataset.value;
    return render();
  }
  if (action === "set-sound-category") {
    soundCategory = target.dataset.value;
    return render();
  }
  if (action === "set-game-filter") {
    gameFilter = target.dataset.value;
    return render();
  }
  if (action === "open-game") {
    const pack =
      id === MINECRAFT_LAUNCHER_ID
        ? visibleGamePacks().find(
            (item) => item.id === MINECRAFT_LAUNCHER_ID
          )
        : snapshot.packs.find((item) => item.id === id);
    if (!pack) throw new Error("Jeu introuvable.");
    if (!pack.modeSelector && !canAccessGame(pack)) {
      return toast(
        "Jeu indisponible",
        "Ce jeu est masqué par la configuration ShenPulse.",
        true
      );
    }
    if (showActiveGameConflict(pack)) return;
    if (!requireGameAccess(pack)) return;
    if (pack.modeSelector) return openMinecraftModeSelector(pack);
    await enterGameWorkspace(pack);
    return;
  }
  if (action === "open-minecraft-mode") {
    const pack = snapshot.packs.find(
      (item) => item.id === id && MINECRAFT_MODE_IDS.includes(item.id)
    );
    if (!pack || !canAccessGame(pack)) {
      return toast(
        "Mode Minecraft indisponible",
        "Ce mode est masqué par la configuration ShenPulse.",
        true
      );
    }
    if (showActiveGameConflict(pack)) return;
    if (!requireGameAccess(pack)) return;
    dialog.close();
    await enterGameWorkspace(pack);
    return;
  }
  if (action === "close-game") {
    gamePageMode = "catalog";
    gameEffectSearch = "";
    gameEffectCategory = "all";
    render();
    content.scrollTop = 0;
    return;
  }
  if (action === "game-step") {
    const nextStep = target.dataset.value || "installation";
    const pack = snapshot.packs.find(
      (item) => item.id === selectedGameId
    );
    if (!requireGameAccess(pack)) {
      gamePageMode = "catalog";
      render();
      return;
    }
    if (nextStep === "interactions") {
      if (pack) {
        const result = await api.initializeGameInteractions(pack.id);
        if (result?.snapshot) acceptSnapshot(result.snapshot);
      }
    }
    gameWorkspaceStep = nextStep;
    render();
    content.scrollTop = 0;
    return;
  }
  if (action === "dismiss-game-message") {
    gamePageMessages.delete(id);
    render();
    return;
  }
  if (action === "dismiss-game-progress") {
    if (gameInstallBusyId) return;
    gameInstallProgress = null;
    render();
    return;
  }
  if (action === "set-game-effect-category") {
    gameEffectCategory = target.dataset.value || "all";
    render();
    return;
  }
  if (action === "set-game-overlay-background") {
    return saveGameInteractionOverlayBackground(
      id,
      target.value || target.dataset.value
    );
  }
  if (action === "save-game-round-settings") {
    const pack = snapshot.packs.find((item) => item.id === id);
    if (showActiveGameConflict(pack)) return;
    if (!requireGameAccess(pack)) return;
    const form = target.closest("[data-minecraft-round-settings]");
    if (!form) return;
    const durationMinutes = Number(
      form.querySelector('[name="durationMinutes"]')?.value || 10
    );
    const autoRestart = Boolean(
      form.querySelector('[name="autoRestart"]')?.checked
    );
    return perform(async () => {
      acceptSnapshot(
        await api.saveGameRoundSettings(id, {
          durationMinutes,
          autoRestart
        })
      );
      render();
    }, "Réglages de partie enregistrés");
  }
  if (action === "download-game-interaction-overlay") {
    const pack = snapshot.packs.find((item) => item.id === id);
    if (
      !(await confirmGameInteractionReadiness(
        pack,
        "de télécharger l’overlay"
      ))
    ) {
      return;
    }
    return perform(
      () => downloadGameInteractionOverlay(
        id,
        Number(target.dataset.model || 1)
      ),
      `Overlay modèle ${Number(target.dataset.model || 1)} téléchargé`
    );
  }
  if (action === "save-game-interactions") {
    return toast(
      "Interactions enregistrées",
      "Chaque modification est sauvegardée automatiquement dans ce profil."
    );
  }
  if (action === "toggle-game-interaction") {
    const packId = target.dataset.pack;
    const pack = snapshot.packs.find((item) => item.id === packId);
    if (!requireGameAccess(pack)) return;
    const rule = gameInteractionRules(packId).find(
      (item) => item.id === target.dataset.rule
    );
    if (!rule) throw new Error("Interaction introuvable.");
    return updateGameInteractionToggle(
      packId,
      rule,
      rule.enabled === false
    );
  }
  if (action === "add-game-interaction") {
    const pack = snapshot.packs.find(
      (item) => item.id === target.dataset.pack
    );
    if (!pack) throw new Error("Jeu introuvable.");
    if (!requireGameAccess(pack)) return;
    return openGameInteractionCatalog(pack);
  }
  if (action === "edit-game-interaction") {
    const pack = snapshot.packs.find(
      (item) => item.id === target.dataset.pack
    );
    const effect = pack?.effects.find(
      (item) => item.id === target.dataset.effect
    );
    if (!pack || !effect) throw new Error("Interaction introuvable.");
    if (!requireGameAccess(pack)) return;
    const row = target.dataset.rule
      ? findGameInteractionRow(
          pack.id,
          target.dataset.rule,
          target.dataset.rowAction,
          target.dataset.index
        )
      : gameMappedEffects(pack).find(
          (item) => item.action.config?.effectId === effect.id
        );
    return openGameInteractionEditor(pack, effect, row);
  }
  if (action === "delete-game-interaction") {
    const packId = target.dataset.pack;
    const pack = snapshot.packs.find((item) => item.id === packId);
    if (!requireGameAccess(pack)) return;
    const rule = gameInteractionRules(packId).find(
      (item) => item.id === target.dataset.rule
    );
    if (!rule) throw new Error("Interaction introuvable.");
    if (
      !(await confirmAction(
        `Supprimer l’interaction « ${rule.gameInteraction?.title || rule.name} » ?`,
        { title: "Supprimer l’interaction", confirmLabel: "Supprimer" }
      ))
    ) {
      return;
    }
    return perform(async () => {
      acceptSnapshot(
        await api.removeGameInteraction(packId, rule.id)
      );
      render();
    }, "Interaction supprimée");
  }
  if (action === "test-game-interaction") {
    const pack = snapshot.packs.find(
      (item) => item.id === target.dataset.pack
    );
    if (!requireGameAccess(pack)) return;
    const row = findGameInteractionRow(
      target.dataset.pack,
      target.dataset.rule,
      target.dataset.rowAction,
      target.dataset.index
    );
    return perform(
      () => testActionRow(row),
      "Interaction de jeu testée"
    );
  }
  if (action === "create-game-action") {
    const pack = snapshot.packs.find(
      (item) => item.id === target.dataset.pack
    );
    const effect = pack?.effects.find((item) => item.id === id);
    if (!pack || !effect) throw new Error("Interaction introuvable.");
    if (!requireGameAccess(pack)) return;
    return openGameInteractionEditor(pack, effect);
  }
  if (action === "add-action") return openActionEditor();
  if (action === "edit-action") {
    const row = findActionRow(
      target.dataset.rule,
      id,
      target.dataset.index
    );
    return row?.action.type === "tts.speak"
      ? openTtsEditor(row)
      : openActionEditor(row);
  }
  if (action === "test-action") {
    const row = findActionRow(target.dataset.rule, id, target.dataset.index);
    return perform(() => testActionRow(row), "Action de test exécutée");
  }
  if (action === "duplicate-action") {
    const row = findActionRow(target.dataset.rule, id, target.dataset.index);
    return perform(() => duplicateActionRow(row), "Action dupliquée");
  }
  if (action === "delete-action") {
    return deleteActionRow(
      findActionRow(target.dataset.rule, id, target.dataset.index)
    );
  }
  if (action === "add-sound") return openSoundEditor(null, target.dataset.sound || "");
  if (action === "upload-sound") {
    return perform(async () => {
      const result = await api.uploadCustomSound();
      if (result.canceled) return;
      acceptSnapshot(result.snapshot);
      soundSearch = "";
      soundCategory = "custom";
      render();
      toast("Son personnalisé ajouté", result.sound.name);
    });
  }
  if (action === "add-tts") return openTtsEditor();
  if (action === "edit-tts") {
    return openTtsEditor(
      findActionRow(target.dataset.rule, id, target.dataset.index)
    );
  }
  if (action === "add-timer") return openTimerEditor();
  if (action === "edit-timer") {
    return openTimerEditor(
      scheduledTimers().find((timer) => timer.id === id)
    );
  }
  if (action === "test-timer") {
    return perform(() => api.testTimer(id), "Timer exécuté");
  }
  if (action === "toggle-timer") {
    return updateToggle("timers", id, target.checked);
  }
  if (action === "edit-sound") {
    return openSoundEditor(
      findActionRow(target.dataset.rule, id, target.dataset.index)
    );
  }
  if (action === "set-sound-volume") {
    return perform(() =>
      setSoundVolume(
        findActionRow(target.dataset.rule, id, target.dataset.index),
        target.value
      )
    );
  }
  if (action === "preview-sound") {
    const sound = SOUND_LIBRARY.find((item) => item.id === id);
    if (!sound) throw new Error("Son introuvable dans le catalogue global.");
    return perform(
      () => api.testAction({
        id: `preview_${sound.id}`,
        type: "audio.play",
        config: { url: sound.url, volume: 0.9 }
      }),
      `${sound.name} lancé`
    );
  }
  if (action === "preview-tts") {
    return perform(
      () => api.testAction({
        id: "preview_tts",
        type: "tts.speak",
        testEventType: "chat",
        testMessage: "ShenPulse est prêt pour votre prochain live.",
        config: { text: "{{data.message}}" }
      }),
      "Test vocal lancé"
    );
  }
  if (action === "spotify-connect") {
    return perform(async () => {
      const result = await api.connectSpotify();
      spotifyStatus = result.status;
      acceptSnapshot(result.snapshot);
      render();
    }, "Spotify connecté");
  }
  if (action === "spotify-disconnect") {
    if (
      !(await confirmAction("Déconnecter le compte Spotify de ShenPulse ?", {
        title: "Déconnecter Spotify",
        confirmLabel: "Déconnecter"
      }))
    ) {
      return;
    }
    return perform(async () => {
      const result = await api.disconnectSpotify();
      spotifyStatus = result.status;
      acceptSnapshot(result.snapshot);
      render();
    }, "Spotify déconnecté");
  }
  if (action === "spotify-refresh") {
    return perform(() => refreshSpotifyStatus(), "État Spotify actualisé");
  }
  if (action === "spotify-control") {
    return perform(async () => {
      await api.controlSpotify({ operation: target.dataset.operation });
      await refreshSpotifyStatus();
    }, "Commande Spotify envoyée");
  }
  if (action === "preview-overlay") {
    return perform(() => previewOverlay(id), "Test visible sur la carte");
  }
  if (action === "overlay-quick") {
    return perform(
      () => performOverlayQuickAction(
        id,
        target.dataset.operation,
        Number(target.dataset.amount || 0)
      ),
      "Overlay mis à jour"
    );
  }
  if (action === "configure-overlay") {
    const overlay = overlayDefinitions().find((item) => item.key === id);
    if (!overlay || !canAccessOverlay(overlay)) {
      return toast(
        "Overlay indisponible",
        "Cet overlay est masqué par la configuration ShenPulse.",
        true
      );
    }
    return openOverlayConfig(overlay);
  }
  if (action === "toggle-session") return toggleSession();
  if (action === "configure-tiktok") return openTikTokEditor();
  if (action === "toggle-tiktok") return toggleTikTok();
  if (action === "test-event") return perform(() => api.testEvent(target.dataset.type), "Événement de test envoyé");
  if (action === "copy") return perform(() => api.copy(target.dataset.value), "URL copiée");
  if (action === "open-url") return perform(() => api.openExternal(target.dataset.value));
  if (action === "restart-servers") return perform(async () => { await api.restartServers(); snapshot = await api.getSnapshot(); render(); }, "Services redémarrés");
  if (action === "rotate-public-overlay-urls") {
    if (
      !(await confirmAction(
        "Régénérer toutes les URL publiques ? Les anciennes sources TikTok LIVE Studio et OBS ne recevront plus aucun événement.",
        { title: "Régénérer les URL", confirmLabel: "Régénérer" }
      ))
    ) {
      return;
    }
    return perform(async () => {
      const result = await api.rotatePublicOverlayUrls();
      acceptSnapshot(result.snapshot);
      render();
    }, "Nouvelles URL publiques générées");
  }
  if (action === "add-rule") return openRuleEditor();
  if (action === "edit-rule") return openRuleEditor(snapshot.state.rules.find((item) => item.id === id));
  if (action === "run-rule") return perform(() => api.testRule(id), "Règle testée précisément");
  if (action === "toggle-rule") return updateToggle("rules", id, target.checked);
  if (action === "add-goal") return openGoalEditor();
  if (action === "edit-goal") return openGoalEditor(snapshot.state.goals.find((item) => item.id === id));
  if (action === "toggle-goal") return updateToggle("goals", id, target.checked);
  if (action === "reset-goal") {
    const goal = snapshot.state.goals.find((item) => item.id === id);
    return perform(async () => { await api.upsert("goals", { ...goal, current: 0 }); snapshot = await api.getSnapshot(); render(); }, "Objectif réinitialisé");
  }
  if (action === "add-command") return openCommandEditor();
  if (action === "edit-command") return openCommandEditor(snapshot.state.commands.find((item) => item.id === id));
  if (action === "toggle-command") return updateToggle("commands", id, target.checked);
  if (action === "add-connection") return openConnectionEditor();
  if (action === "edit-connection") {
    if (id === "source_tiktok") return openTikTokEditor();
    return openConnectionEditor(
      snapshot.state.connections.find((item) => item.id === id)
    );
  }
  if (action === "start-connection") return perform(async () => { await api.startConnection(id); snapshot = await api.getSnapshot(); render(); }, "Connexion lancée");
  if (action === "stop-connection") return perform(async () => { await api.stopConnection(id); snapshot = await api.getSnapshot(); render(); }, "Connexion arrêtée");
  if (action === "select-game") {
    const pack = snapshot.packs.find((item) => item.id === id);
    if (showActiveGameConflict(pack)) return;
    if (!requireGameAccess(pack)) return;
    return perform(async () => {
    selectedGameId = id;
    await api.selectGame(id);
    snapshot = await api.getSnapshot();
    render();
    });
  }
  if (action === "configure-game") {
    const pack = snapshot.packs.find((item) => item.id === id);
    if (showActiveGameConflict(pack)) return;
    if (!requireGameAccess(pack)) return;
    return openGameConfig(pack);
  }
  if (action === "install-game") {
    const pack = snapshot.packs.find((item) => item.id === id);
    if (showActiveGameConflict(pack)) return;
    if (!requireGameAccess(pack)) return;
    gamePageMessages.delete(id);
    gameInstallBusyId = id;
    const startedAt = new Date().toISOString();
    gameInstallProgress = {
      open: true,
      gameId: id,
      phase: "prepare",
      percent: 2,
      startedAt,
      lastActivityAt: startedAt,
      message: "ShenPulse recherche votre jeu."
    };
    render();
    try {
      const result = await api.installGame(id);
      if (result?.canceled) {
        gameInstallProgress = null;
        return result;
      }
      acceptSnapshot(await api.getSnapshot());
      gameInstallProgress = {
        ...(gameInstallProgress || {}),
        open: true,
        gameId: id,
        gameTitle:
          snapshot.packs.find((item) => item.id === id)?.name || "Le jeu",
        phase: "complete",
        percent: 100
      };
      gamePageMessages.set(id, {
        type: "success",
        scope: "installation",
        title: "Installation terminée",
        detail: "Le jeu est prêt. Vous pouvez passer aux interactions."
      });
      return result;
    } catch (error) {
      gameInstallProgress = null;
      gamePageMessages.set(id, {
        type: "error",
        scope: "installation",
        title: "L’installation n’a pas pu se terminer",
        detail:
          error.message ||
          "Vérifiez que le jeu est fermé puis réessayez."
      });
      return null;
    } finally {
      gameInstallBusyId = "";
      render();
    }
  }
  if (action === "launch-game") {
    if (gameLaunchBusyId) return;
    const pack = snapshot.packs.find((item) => item.id === id);
    if (showActiveGameConflict(pack)) return;
    if (!requireGameAccess(pack)) return;
    if (
      !(await confirmGameInteractionReadiness(
        pack,
        "de lancer le jeu et son serveur"
      ))
    ) {
      return;
    }
    gamePageMessages.delete(id);
    gameLaunchBusyId = id;
    if (MINECRAFT_MODE_IDS.includes(id)) {
      gameLaunchProgress = {
        open: true,
        gameId: id,
        startedAt: Date.now()
      };
    }
    render();
    try {
      const result = await api.launchGame(id);
      if (result?.snapshot) acceptSnapshot(result.snapshot);
      gamePageMessages.set(id, {
        type: "success",
        scope: "launch",
        title: "Le jeu a été lancé",
        detail: "Chargez votre partie : ShenPulse s’occupe du reste."
      });
      toast("Jeu lancé");
      return result;
    } catch (error) {
      gamePageMessages.set(id, {
        type: "error",
        scope: "launch",
        title: "Le jeu n’a pas pu démarrer",
        detail:
          error.message ||
          "Revenez à l’installation puis essayez à nouveau."
      });
      toast("Démarrage impossible", error.message || String(error), true);
      return null;
    } finally {
      if (gameLaunchBusyId === id) gameLaunchBusyId = "";
      if (gameLaunchProgress?.gameId === id) gameLaunchProgress = null;
      render();
    }
  }
  if (action === "start-game-session") {
    const pack = snapshot.packs.find((item) => item.id === id);
    if (showActiveGameConflict(pack)) return;
    if (!requireGameAccess(pack)) return;
    if (
      !(await confirmGameInteractionReadiness(
        pack,
        "d’activer la session de jeu"
      ))
    ) {
      return;
    }
    return perform(async () => {
      acceptSnapshot(await api.startGameSession(id));
      render();
    }, "Session de jeu activée");
  }
  if (action === "stop-game-session") {
    return perform(async () => {
      acceptSnapshot(await api.stopGameSession());
      render();
    }, "Session de jeu arrêtée");
  }
  if (action === "test-game") {
    const pack = snapshot.packs.find((item) => item.id === id);
    if (!requireGameAccess(pack)) return;
    return perform(
      () => api.testGame(id),
      "Passerelle de jeu opérationnelle"
    );
  }
  if (action === "trigger-effect") {
    const packId = target.dataset.pack ||
      snapshot.state.session.activeGamePackId;
    const pack = snapshot.packs.find((item) => item.id === packId);
    if (!requireGameAccess(pack)) return;
    return perform(async () => {
      if (packId && snapshot.state.session.activeGamePackId !== packId) {
        await api.selectGame(packId);
        snapshot = await api.getSnapshot();
      }
      return api.triggerEffect(id, {});
    }, "Effet déclenché");
  }
  if (action === "test-obs") return perform(() => api.testObs(), "OBS WebSocket connecté");
  if (action === "export-data") return perform(() => api.exportData(), "Export terminé");
  if (action === "import-data") return perform(async () => { const result = await api.importData(); if (!result.canceled) { snapshot = result.snapshot; render(); } }, "Import terminé");
  if (action === "clear-data") {
    if (
      !(await confirmAction(
        "Effacer définitivement la configuration, les secrets et le journal local ?",
        { title: "Effacer les données locales", confirmLabel: "Tout effacer" }
      ))
    ) {
      return;
    }
    return perform(async () => { snapshot = await api.clearData(); render(); }, "Données locales effacées");
  }
  if (action === "delete-entity") {
    if (
      !(await confirmAction("Supprimer cet élément ?", {
        title: "Supprimer l’élément",
        confirmLabel: "Supprimer"
      }))
    ) {
      return;
    }
    return perform(async () => { await api.remove(target.dataset.collection, id); snapshot = await api.getSnapshot(); render(); }, "Élément supprimé");
  }
}

async function updateToggle(collection, id, enabled) {
  const item = snapshot.state[collection].find((entry) => entry.id === id);
  if (!item) return;
  await perform(() => api.upsert(collection, { ...item, enabled }));
  snapshot = await api.getSnapshot();
  render();
}

async function updateGameInteractionToggle(packId, rule, enabled) {
  await perform(() =>
    api.saveGameInteraction(packId, { ...rule, enabled })
  );
  snapshot = await api.getSnapshot();
  render();
}

async function toggleTikTok() {
  const tiktok = tiktokMeta();
  if (!tiktok.username) {
    openTikTokEditor();
    return;
  }
  await perform(async () => {
    snapshot = tiktok.connected
      ? await api.stopTikTok()
      : await api.startTikTok();
    render();
  }, tiktok.connected ? "Détection TikTok arrêtée" : "Surveillance LIVE démarrée");
}

async function toggleSession() {
  const wasRunning = snapshot.state.session.running;
  const confirmedLive = tiktokMeta().live;
  await perform(async () => {
    snapshot = wasRunning ? await api.stopSession() : await api.startSession();
    render();
  }, wasRunning
    ? "Session arrêtée"
    : confirmedLive
      ? "Session démarrée"
      : "Détection du LIVE relancée");
}

content.addEventListener("input", (event) => {
  if (event.target.matches("[data-gift-picker]")) {
    scheduleGiftCatalog(event.target);
  }
  const input = event.target.closest("[data-search]");
  if (!input) return;
  const key = input.dataset.search;
  if (key === "actions") actionsSearch = input.value;
  if (key === "overlays") overlaySearch = input.value;
  if (key === "sounds") soundSearch = input.value;
  if (key === "sounds" && soundSearch.trim()) soundCategory = "all";
  if (key === "games") gameSearch = input.value;
  if (key === "game-effects") gameEffectSearch = input.value;
  if (key === "admin-visibility") adminVisibilitySearch = input.value;
  if (key === "admin-commerce") adminCommerceSearch = input.value;
  const position = input.selectionStart;
  render();
  const replacement = content.querySelector(`[data-search="${key}"]`);
  if (replacement) {
    replacement.focus();
    replacement.setSelectionRange(position, position);
  }
});

content.addEventListener("change", (event) => {
  const scopePicker = event.target.closest(
    'select[data-action="admin-scope"]'
  );
  if (scopePicker) {
    perform(
      () =>
        saveAdminVisibilityScope(
          scopePicker.dataset.section,
          scopePicker.dataset.id,
          scopePicker.value
        ),
      "Visibilité mise à jour"
    ).catch(() => {});
    return;
  }
  const picker = event.target.closest("[data-overlay-design]");
  if (!picker) return;
  const item = overlayDefinitions().find(
    (entry) => entry.key === picker.dataset.overlayDesign
  );
  if (!item) return;
  if (!isAccountAuthenticated()) {
    previewOverlayDesignSelection(item, picker.value);
    return;
  }
  perform(
    () => persistOverlayDesignSelection(item, picker.value),
    overlayUnlocked(item)
      ? "Design lié au profil mis à jour"
      : "Aperçu du design Pro mis à jour"
  ).catch(() => {});
});

dialogBody.addEventListener("input", (event) => {
  if (event.target.matches("[data-gift-picker]")) {
    scheduleGiftCatalog(event.target);
  }
  if (event.target.matches("[data-timer-action-search]")) {
    const query = event.target.value.trim().toLowerCase();
    dialogBody.querySelectorAll("[data-timer-action-option]").forEach((item) => {
      item.hidden =
        Boolean(query) &&
        !String(item.dataset.searchable || "").includes(query);
    });
  }
  if (event.target.closest("[data-overlay-config-editor]")) {
    scheduleOverlayLivePreview();
  }
});

document.addEventListener("focusin", (event) => {
  if (event.target.matches("[data-gift-picker]")) {
    hydrateGiftCatalog(event.target.value, event.target);
  }
});

dialogBody.addEventListener("change", (event) => {
  if (
    event.target.matches('[name="wheelSegmentActionId"]') &&
    event.target.value
  ) {
    const row = event.target.closest("[data-wheel-segment-row]");
    const mode = row?.querySelector('[name="wheelSegmentAction"]');
    if (mode && mode.value !== "spin") mode.value = "action";
  }
  if (
    event.target.matches(
      '[name="wheelSegmentAction"], [name="wheelSegmentActionId"]'
    )
  ) {
    if (
      event.target.matches('[name="wheelSegmentAction"]') &&
      event.target.value !== "action"
    ) {
      const actionSelect = event.target
        .closest("[data-wheel-segment-row]")
        ?.querySelector('[name="wheelSegmentActionId"]');
      if (actionSelect) actionSelect.value = "";
    }
    syncWheelSegmentActionVisibility();
  }
  if (event.target.closest("[data-overlay-config-editor]")) {
    scheduleOverlayLivePreview();
  }
  if (
    event.target.matches('[name="wheelDesign"]') &&
    wheelEditorContext
  ) {
    collectWheelEditorForm();
    dialogBody.querySelectorAll(".wheel-design-option").forEach((option) => {
      option.classList.toggle(
        "selected",
        option.querySelector('[name="wheelDesign"]')?.checked === true
      );
    });
    scheduleOverlayLivePreview();
    return;
  }
  if (
    event.target.matches("[data-editor-action-type]") ||
    event.target.matches("[data-editor-trigger-type]") ||
    event.target.matches("[data-editor-trigger-enabled]")
  ) {
    syncActionEditorVisibility();
  }
  if (event.target.matches('[name="gamePackId"]')) {
    const effectSelect = dialogBody.querySelector('[name="effectId"]');
    const pack = snapshot.packs.find(
      (entry) => entry.id === event.target.value
    );
    if (effectSelect && pack) {
      effectSelect.innerHTML = pack.effects.map(
        (effect) =>
          `<option value="${escapeHtml(effect.id)}">${escapeHtml(effect.name)} · ${escapeHtml(effect.id)}</option>`
      ).join("");
    }
  }
});

content.addEventListener("click", (event) => {
  const navigate = event.target.closest("[data-navigate]");
  if (navigate) {
    if (!canNavigateTo(navigate.dataset.navigate)) {
      return toast(
        "Page indisponible",
        "Cette page est masquée par la configuration ShenPulse.",
        true
      );
    }
    currentPage = navigate.dataset.navigate;
    render();
    content.scrollTop = 0;
    if (currentPage === "sounds" && isAccountAuthenticated()) {
      refreshSpotifyStatus();
    }
    if (currentPage === "admin" && !adminDashboard) {
      refreshAdminDashboard().catch((error) =>
        toast("Administration indisponible", error.message || String(error), true)
      );
    }
    content.focus();
    return;
  }
  const action = event.target.closest("[data-action]");
  if (action) handleAction(action).catch(() => {});
});

content.addEventListener("change", (event) => {
  const action = event.target.closest("[data-action]");
  if (action) handleAction(action).catch(() => {});
});

document.body.addEventListener("click", (event) => {
  if (!event.target.closest(".account-control")) {
    accountMenu.hidden = true;
    accountMenuButton.setAttribute("aria-expanded", "false");
  }
  if (!event.target.closest("[data-gift-picker-root]")) {
    document.querySelectorAll("[data-gift-results]").forEach((results) => {
      results.hidden = true;
    });
  }
  const giftChoice = event.target.closest("[data-gift-choice]");
  if (giftChoice && !dialog.contains(giftChoice)) {
    const root = giftChoice.closest("[data-gift-picker-root]");
    const input = root?.querySelector("[data-gift-picker]");
    if (input) input.value = giftChoice.dataset.giftChoice;
    updateGiftPickerSelection(root, {
      name: giftChoice.dataset.giftChoice,
      imageUrl: giftChoice.dataset.giftImage
    });
    const results = root?.querySelector("[data-gift-results]");
    if (results) results.hidden = true;
    return;
  }
  const giftClear = event.target.closest("[data-gift-clear]");
  if (giftClear && !dialog.contains(giftClear)) {
    const root = giftClear.closest("[data-gift-picker-root]");
    const input = root?.querySelector("[data-gift-picker]");
    if (input) input.value = "";
    updateGiftPickerSelection(root);
    const results = root?.querySelector("[data-gift-results]");
    if (results) results.hidden = true;
    return;
  }
  const navigate = event.target.closest("[data-navigate]");
  if (navigate && !content.contains(navigate)) {
    if (!canNavigateTo(navigate.dataset.navigate)) {
      return toast(
        "Page indisponible",
        "Cette page est masquée par la configuration ShenPulse.",
        true
      );
    }
    currentPage = navigate.dataset.navigate;
    render();
    content.scrollTop = 0;
    if (currentPage === "sounds" && isAccountAuthenticated()) {
      refreshSpotifyStatus();
    }
    if (currentPage === "admin" && !adminDashboard) {
      refreshAdminDashboard().catch((error) =>
        toast("Administration indisponible", error.message || String(error), true)
      );
    }
    accountMenu.hidden = true;
    accountMenuButton.setAttribute("aria-expanded", "false");
  }
  const globalAction = event.target.closest("[data-action]");
  if (globalAction && !content.contains(globalAction)) {
    handleAction(globalAction).catch(() => {});
  }
  const windowButton = event.target.closest("[data-window]");
  if (windowButton) api.window[windowButton.dataset.window]?.();
});

sessionButton.addEventListener("click", () =>
  isAccountAuthenticated()
    ? toggleSession().catch(() => {})
    : openAccountLogin()
);
accountMenuButton.addEventListener("click", () => {
  const opening = accountMenu.hidden;
  accountMenu.hidden = !opening;
  accountMenuButton.setAttribute("aria-expanded", String(opening));
});
profilePickerButton.addEventListener("click", () => {
  if (!isAccountAuthenticated()) return openAccountLogin();
  const opening = profileMenu.hidden;
  profileMenu.hidden = !opening;
  profilePickerButton.setAttribute("aria-expanded", String(opening));
});
profileMenu.addEventListener("click", async (event) => {
  if (!isAccountAuthenticated()) return openAccountLogin();
  const choice = event.target.closest("[data-profile-select]");
  if (!choice) return;
  profileMenu.hidden = true;
  profilePickerButton.setAttribute("aria-expanded", "false");
  await perform(
    () => api.selectProfile(choice.dataset.profileSelect),
    "Profil actif modifié"
  );
  snapshot = await api.getSnapshot();
  render();
});
document.addEventListener("click", (event) => {
  if (profileControl.contains(event.target)) return;
  profileMenu.hidden = true;
  profilePickerButton.setAttribute("aria-expanded", "false");
});
profileManageButton.addEventListener("click", () => {
  if (!isAccountAuthenticated()) return openAccountLogin();
  profileMenu.hidden = true;
  profilePickerButton.setAttribute("aria-expanded", "false");
  openProfileManager();
});
gameSessionSummary.addEventListener("click", () => {
  if (!isAccountAuthenticated()) return openAccountLogin();
  const gameSession = activeGameSession();
  if (!gameSession) return;
  if (!requireGameAccess(gameSession.pack)) return;
  selectedGameId = gameSession.packId;
  gamePageMode = "detail";
  gameWorkspaceStep = "launch";
  currentPage = "games";
  render();
  content.scrollTop = 0;
});
gameSessionStop.addEventListener("click", async () => {
  if (!isAccountAuthenticated()) return openAccountLogin();
  if (gameSessionStop.disabled) return;
  gameSessionStop.disabled = true;
  gameSessionStop.textContent = "…";
  gameSessionStop.title = "Arrêt du serveur Minecraft en cours…";
  try {
    await perform(async () => {
      acceptSnapshot(await api.stopGameSession());
      render();
    }, "Serveur et session de jeu arrêtés");
  } finally {
    gameSessionStop.disabled = false;
    gameSessionStop.textContent = "■";
    gameSessionStop.title = "Arrêter la session de jeu";
  }
});
tiktokAccountButton.addEventListener("click", () =>
  isAccountAuthenticated() ? openTikTokEditor() : openAccountLogin()
);
tiktokConnectionButton.addEventListener("click", () =>
  isAccountAuthenticated()
    ? toggleTikTok().catch(() => {})
    : openAccountLogin()
);
profileSelect.addEventListener("change", async () => {
  if (!isAccountAuthenticated()) return openAccountLogin();
  await perform(() => api.selectProfile(profileSelect.value), "Profil actif modifié");
  snapshot = await api.getSnapshot();
  render();
});

dialogForm.addEventListener(
  "invalid",
  (event) => {
    event.preventDefault();
    const control = event.target;
    const label =
      control.closest(".field")?.querySelector(":scope > span")?.textContent ||
      control.name ||
      "Champ";
    showDialogError(
      `${label} : ${control.validationMessage || "valeur invalide."}`
    );
    requestAnimationFrame(() => {
      control.scrollIntoView({ behavior: "smooth", block: "center" });
      control.focus({ preventScroll: true });
    });
  },
  true
);

dialogForm.addEventListener("input", () => {
  if (!dialogError.hidden) clearDialogError();
});

dialogForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!dialogSubmitHandler) return dialog.close();
  const activeDialogSessionId = dialogSessionId;
  const activeSubmitHandler = dialogSubmitHandler;
  clearDialogError();
  const defaultLabel =
    dialogSubmitButton.dataset.defaultLabel ||
    dialogSubmitButton.textContent ||
    "Enregistrer";
  dialogSubmitButton.disabled = true;
  dialogSubmitButton.textContent = "Enregistrement…";
  dialogForm.setAttribute("aria-busy", "true");
  try {
    await activeSubmitHandler(new FormData(dialogForm));
    if (
      activeDialogSessionId !== dialogSessionId ||
      activeSubmitHandler !== dialogSubmitHandler
    ) {
      return;
    }
    dialog.close();
    render();
    toast("Configuration enregistrée");
  } catch (error) {
    if (
      activeDialogSessionId !== dialogSessionId ||
      activeSubmitHandler !== dialogSubmitHandler
    ) {
      return;
    }
    showDialogError(error.message || String(error));
    toast("Configuration invalide", error.message || String(error), true);
  } finally {
    if (
      activeDialogSessionId === dialogSessionId &&
      activeSubmitHandler === dialogSubmitHandler
    ) {
      dialogForm.setAttribute("aria-busy", "false");
      dialogSubmitButton.disabled = false;
      dialogSubmitButton.textContent = defaultLabel;
    }
  }
});

dialog.addEventListener("click", (event) => {
  if (!event.target.closest("[data-dialog-close]")) return;
  dialogSubmitHandler = null;
  dialog.close("cancel");
});

dialog.addEventListener("cancel", () => {
  dialogSubmitHandler = null;
});

dialog.addEventListener("close", () => {
  stopEditorAudioPreview();
  dialogSessionId += 1;
  dialogSubmitHandler = null;
  dialogForm.setAttribute("aria-busy", "false");
  dialogSubmitButton.disabled = false;
});

dialog.addEventListener("click", (event) => {
  const accountCommand = event.target.closest("[data-account-command]");
  if (accountCommand) {
    event.preventDefault();
    const command = accountCommand.dataset.accountCommand;
    const currentEmail =
      dialogBody.querySelector('[name="email"]')?.value || "";
    if (command === "login" || command === "register") {
      openAccountLogin(command, currentEmail);
      return;
    }
    if (command === "forgot") {
      if (!currentEmail) {
        return showDialogError(
          "Renseignez d’abord votre adresse e-mail."
        );
      }
      const activeDialogSessionId = dialogSessionId;
      accountCommand.disabled = true;
      accountCommand.textContent = "Envoi en cours…";
      api.account
        .requestPasswordReset({ email: currentEmail })
        .then((result) =>
          activeDialogSessionId === dialogSessionId
            ? toast("E-mail de réinitialisation", result.message)
            : undefined
        )
        .catch((error) => {
          if (activeDialogSessionId === dialogSessionId) {
            showDialogError(error.message || String(error));
          }
        })
        .finally(() => {
          if (activeDialogSessionId !== dialogSessionId) return;
          accountCommand.disabled = false;
          accountCommand.textContent = "Mot de passe oublié ?";
        });
      return;
    }
    if (command === "google") {
      const activeDialogSessionId = dialogSessionId;
      accountCommand.disabled = true;
      accountCommand.innerHTML =
        '<span aria-hidden="true">G</span> Connexion dans le navigateur…';
      waitForPendingAccountLogout()
        .then(() => api.account.loginWithBrowser())
        .then(async (status) => {
          if (activeDialogSessionId !== dialogSessionId) return;
          accountSession = status;
          acceptSnapshot(await api.getSnapshot());
          if (activeDialogSessionId !== dialogSessionId) return;
          await syncAdminSessionFromAccount();
          if (activeDialogSessionId !== dialogSessionId) return;
          dialog.close();
          render();
          toast("Compte Google connecté", status.email);
        })
        .catch((error) => {
          if (activeDialogSessionId !== dialogSessionId) return;
          showDialogError(error.message || String(error));
          accountCommand.disabled = false;
          accountCommand.innerHTML =
            '<span aria-hidden="true">G</span> Continuer avec Google';
        });
      return;
    }
  }
  const previewTest = event.target.closest("[data-overlay-preview-test]");
  if (previewTest) {
    event.preventDefault();
    perform(
      () => dispatchOverlayTest(previewTest.dataset.overlayPreviewTest),
      "Test live relancé"
    ).catch(() => {});
    return;
  }
  const action = event.target.closest("[data-action]");
  if (
    action &&
    [
      "overlay-quick",
      "copy",
      "open-url",
      "open-minecraft-mode"
    ].includes(action.dataset.action)
  ) {
    event.preventDefault();
    handleAction(action).catch(() => {});
  }
});

dialog.addEventListener("input", (event) => {
  if (!event.target.matches("[data-game-effect-library-search]")) return;
  const query = event.target.value.trim().toLocaleLowerCase("fr");
  let visibleCount = 0;
  dialogBody
    .querySelectorAll("[data-game-effect-library-group]")
    .forEach((group) => {
      let groupCount = 0;
      group
        .querySelectorAll("[data-select-game-effect]")
        .forEach((option) => {
          const visible =
            !query ||
            String(option.dataset.filter || "").includes(query);
          option.hidden = !visible;
          if (visible) {
            groupCount += 1;
            visibleCount += 1;
          }
        });
      group.hidden = groupCount === 0;
    });
  const empty = dialogBody.querySelector(
    "[data-game-effect-library-empty]"
  );
  if (empty) empty.hidden = visibleCount > 0;
});

dialog.addEventListener("click", (event) => {
  const openLibrary = event.target.closest(
    "[data-open-game-effect-library]"
  );
  const selectedEffect = event.target.closest(
    "[data-select-game-effect]"
  );
  const target = selectedEffect || openLibrary;
  if (!target) return;

  event.preventDefault();
  const pack = snapshot.packs.find(
    (entry) => entry.id === target.dataset.pack
  );
  if (!pack) {
    return showDialogError("Le catalogue de ce jeu est introuvable.");
  }
  if (!requireGameAccess(pack)) {
    dialog.close();
    return;
  }
  const row = target.dataset.rule
    ? findGameInteractionRow(
        pack.id,
        target.dataset.rule,
        target.dataset.rowAction,
        target.dataset.index
      )
    : null;
  if (openLibrary) {
    return openGameInteractionCatalog(pack, row);
  }

  const effect = pack.effects.find(
    (entry) => entry.id === target.dataset.effect
  );
  if (!effect) {
    return showDialogError("Cette interaction n’existe plus.");
  }
  dialog.close();
  openGameInteractionEditor(pack, effect, row);
});

dialog.addEventListener("click", (event) => {
  const openLibrary = event.target.closest("[data-open-media-library]");
  if (openLibrary) {
    globalMediaLibrary.open(openLibrary);
    return;
  }
  const clearMedia = event.target.closest("[data-clear-media]");
  if (clearMedia) {
    globalMediaLibrary.clear(
      clearMedia.closest("[data-media-picker-root]")
    );
    return;
  }
  const mediaPreview = event.target.closest("[data-media-preview-url]");
  if (mediaPreview) {
    perform(() =>
      api.testAction({
        id: `preview_${cryptoId()}`,
        type: "audio.play",
        config: {
          url: mediaPreview.dataset.mediaPreviewUrl,
          volume: 0.9,
          previewScope: "editor-dialog"
        }
      })
    ).catch(() => {});
    return;
  }
  const giftChoice = event.target.closest("[data-gift-choice]");
  if (giftChoice) {
    const root = giftChoice.closest("[data-gift-picker-root]");
    const input = root?.querySelector("[data-gift-picker]");
    if (input) {
      input.value = giftChoice.dataset.giftChoice;
      updateGiftPickerSelection(root, {
        name: giftChoice.dataset.giftChoice,
        imageUrl: giftChoice.dataset.giftImage
      });
      root.querySelector("[data-gift-results]").hidden = true;
    }
    return;
  }
  const giftClear = event.target.closest("[data-gift-clear]");
  if (giftClear) {
    const root = giftClear.closest("[data-gift-picker-root]");
    const input = root?.querySelector("[data-gift-picker]");
    if (input) input.value = "";
    updateGiftPickerSelection(root);
    const results = root?.querySelector("[data-gift-results]");
    if (results) results.hidden = true;
    return;
  }
});

mediaLibrarySearchInput.addEventListener("input", () => {
  clearTimeout(mediaLibrarySearchTimer);
  if (mediaLibrarySource !== "web") {
    renderMediaLibrary();
    return;
  }
  mediaLibrarySearchTimer = setTimeout(
    () => loadRemoteMediaLibrary(),
    300
  );
});

mediaLibraryDialog.addEventListener("click", (event) => {
  const source = event.target.closest("[data-media-source]");
  if (source) {
    mediaLibrarySource = source.dataset.mediaSource;
    mediaLibraryKind = "all";
    mediaLibrarySelected = null;
    mediaLibraryRemotePage = 1;
    mediaLibraryRemoteHasMore = false;
    mediaLibrarySearchInput.value = "";
    if (mediaLibrarySource === "web") loadRemoteMediaLibrary();
    else renderMediaLibrary();
    return;
  }
  const filter = event.target.closest("[data-media-kind]");
  if (filter) {
    mediaLibraryKind = filter.dataset.mediaKind;
    if (
      mediaLibrarySource === "web" &&
      mediaLibraryContext?.kind === "visual"
    ) {
      loadRemoteMediaLibrary();
    } else {
      renderMediaLibrary();
    }
    return;
  }
  const selection = event.target.closest("[data-media-select]");
  if (selection) {
    mediaLibrarySelected = findMediaLibraryItem(
      selection.dataset.mediaSelect
    );
    renderMediaLibrary();
    return;
  }
  const preview = event.target.closest("[data-media-preview-url]");
  if (preview) {
    perform(() =>
      api.testAction({
        id: `preview_${cryptoId()}`,
        type: "audio.play",
        config: { url: preview.dataset.mediaPreviewUrl, volume: 0.9 }
      })
    ).catch(() => {});
    return;
  }
  if (event.target.closest("[data-media-load-more]")) {
    loadRemoteMediaLibrary({ append: true });
  }
});

document
  .getElementById("media-library-close")
  .addEventListener("click", globalMediaLibrary.close);
document
  .getElementById("media-library-cancel")
  .addEventListener("click", globalMediaLibrary.close);
mediaLibraryConfirmButton.addEventListener(
  "click",
  globalMediaLibrary.confirm
);
mediaLibraryUploadButton.addEventListener(
  "click",
  globalMediaLibrary.upload
);
mediaLibraryDialog.addEventListener("cancel", (event) => {
  event.preventDefault();
  globalMediaLibrary.close();
});

confirmationForm.addEventListener("submit", (event) => {
  event.preventDefault();
  finishConfirmation(true);
});

confirmationCancelButton.addEventListener("click", () => {
  finishConfirmation(false);
});

confirmationDialog.addEventListener("cancel", (event) => {
  event.preventDefault();
  finishConfirmation(false);
});

confirmationDialog.addEventListener("close", () => {
  if (confirmationResolver) finishConfirmation(false);
});

dialog.addEventListener("click", async (event) => {
  const target = event.target.closest("[data-wheel-command]");
  if (!target || !wheelEditorContext) return;
  event.preventDefault();
  const previousWheelScrollTop = dialogBody.scrollTop;
  collectWheelEditorForm();
  const config = wheelEditorContext.config;
  const wheel = config.wheels.find(
    (entry) => entry.id === config.selectedWheelId
  );
  const command = target.dataset.wheelCommand;
  if (command === "section") {
    const section = target.dataset.wheelSection;
    if (!["setup", "segments", "appearance", "playback"].includes(section)) {
      return;
    }
    wheelEditorContext.section = section;
    dialogBody.querySelectorAll("[data-wheel-section]").forEach((button) => {
      button.classList.toggle(
        "active",
        button.dataset.wheelSection === section
      );
    });
    dialogBody
      .querySelectorAll("[data-wheel-section-panel]")
      .forEach((panel) => {
        panel.hidden = panel.dataset.wheelSectionPanel !== section;
      });
    dialogBody
      .querySelector(`[data-wheel-section-panel="${section}"]`)
      ?.scrollIntoView({ block: "start" });
    return;
  }
  if (command === "select") {
    config.selectedWheelId = target.dataset.wheelId;
    wheelEditorContext.section = "setup";
  } else if (command === "add") {
    const nextWheel = {
      id: `wheel_${cryptoId()}`,
      name: `Nouvelle roue ${config.wheels.length + 1}`,
      enabled: true,
      trigger: "",
      design: "classic",
      settings: wheelDefaultSettings(),
      segments: wheelSeedSegments("classic")
    };
    config.wheels.push(nextWheel);
    config.selectedWheelId = nextWheel.id;
    wheelEditorContext.section = "setup";
  } else if (command === "delete") {
    if (config.wheels.length <= 1) {
      return toast(
        "Suppression impossible",
        "Conservez au moins une roue d’actions.",
        true
      );
    }
    if (
      !(await confirmAction(`Supprimer la roue « ${wheel.name} » ?`, {
        title: "Supprimer cette roue",
        confirmLabel: "Supprimer"
      }))
    ) {
      return;
    }
    config.wheels = config.wheels.filter((entry) => entry.id !== wheel.id);
    config.selectedWheelId = config.wheels[0].id;
    wheelEditorContext.section = "setup";
  } else if (command === "segment-add") {
    wheel.segments.push({
      id: `segment_${cryptoId()}`,
      label: `Nouveau segment ${wheel.segments.length + 1}`,
      color: wheel.design === "royal" ? "#7b1fa2" : "#ff6a00",
      action: "none",
      actionId: ""
    });
  } else if (command.startsWith("segment-")) {
    const index = Number(target.dataset.index);
    if (!Number.isInteger(index) || !wheel.segments[index]) return;
    if (command === "segment-delete" && wheel.segments.length > 2) {
      wheel.segments.splice(index, 1);
    }
    if (command === "segment-up" && index > 0) {
      [wheel.segments[index - 1], wheel.segments[index]] = [
        wheel.segments[index],
        wheel.segments[index - 1]
      ];
    }
    if (command === "segment-down" && index < wheel.segments.length - 1) {
      [wheel.segments[index + 1], wheel.segments[index]] = [
        wheel.segments[index],
        wheel.segments[index + 1]
      ];
    }
  }
  openWheelOverlayConfig(wheelEditorContext.item);
  if (command.startsWith("segment-")) {
    requestAnimationFrame(() => {
      if (command === "segment-add") {
        dialogBody
          .querySelector("[data-wheel-segment-row]:last-child")
          ?.scrollIntoView({ block: "center" });
        return;
      }
      dialogBody.scrollTop = previousWheelScrollTop;
    });
  }
});

dialog.addEventListener("click", async (event) => {
  const target = event.target.closest("[data-profile-action]");
  if (!target) return;
  const action = target.dataset.profileAction;
  const profile = snapshot.state.profiles.find(
    (item) => item.id === target.dataset.id
  );
  if (action === "create" || action === "edit") {
    dialog.close();
    openProfileEditor(action === "edit" ? profile : null);
    return;
  }
  if (action === "activate" && profile) {
    await perform(async () => {
      await api.selectProfile(profile.id);
      snapshot = await api.getSnapshot();
      openProfileManager();
      render();
    }, `Profil « ${profile.name} » activé`);
    return;
  }
  if (action === "delete" && profile) {
    if (snapshot.state.profiles.length <= 1) {
      toast("Suppression impossible", "ShenPulse doit conserver au moins un profil.", true);
      return;
    }
    if (
      !(await confirmAction(`Supprimer le profil « ${profile.name} » ?`, {
        title: "Supprimer ce profil",
        confirmLabel: "Supprimer"
      }))
    ) {
      return;
    }
    await perform(async () => {
      if (snapshot.state.session.profileId === profile.id) {
        const fallback = snapshot.state.profiles.find(
          (item) => item.id !== profile.id
        );
        await api.selectProfile(fallback.id);
      }
      await api.remove("profiles", profile.id);
      snapshot = await api.getSnapshot();
      openProfileManager();
      render();
    }, "Profil supprimé");
  }
});

content.addEventListener("submit", async (event) => {
  if (!isAccountAuthenticated()) {
    event.preventDefault();
    toast(
      "Connexion requise",
      "Aucune modification n’est autorisée en mode consultation.",
      true
    );
    openAccountLogin();
    return;
  }
  if (event.target.id === "premium-seat-form") {
    event.preventDefault();
    const data = new FormData(event.target);
    await perform(async () => {
      const response = await api.assignPremiumSeat({
        beneficiaryEmail: data.get("beneficiaryEmail")
      });
      if (response?.snapshot) acceptSnapshot(response.snapshot);
      render();
    }, "Accès Pro offert");
    return;
  }
  const integratedSettingsForm = event.target.closest(
    "[data-integrated-game-settings]"
  );
  if (integratedSettingsForm) {
    event.preventDefault();
    const gameId = integratedSettingsForm.dataset.integratedGameSettings;
    const pack = snapshot.packs.find((item) => item.id === gameId);
    if (!requireGameAccess(pack)) return;
    const launchAfterSave =
      event.submitter?.dataset.launchAfterSave === "true";
    const data = new FormData(integratedSettingsForm);
    await perform(async () => {
      snapshot = await api.configureGame(
        gameId,
        integratedSettingsFromForm(gameId, data)
      );
      if (launchAfterSave) {
        const result = await api.launchGame(gameId);
        if (result?.snapshot) acceptSnapshot(result.snapshot);
      }
      gamePageMessages.set(gameId, {
        type: "success",
        scope: "installation",
        title: launchAfterSave ? "Jeu ouvert" : "Réglages enregistrés",
        detail: launchAfterSave
          ? `${pack?.name || "Le jeu"} utilise maintenant les réglages du profil actif.`
          : "Les prochains lancements utiliseront cette configuration."
      });
      render();
    }, launchAfterSave ? "Jeu configuré et lancé" : "Réglages du jeu enregistrés");
    return;
  }
  if (event.target.id === "admin-trial-form") {
    event.preventDefault();
    const data = new FormData(event.target);
    await perform(async () => {
      adminBusy = true;
      render();
      try {
        await api.admin.grantTrial({
          email: data.get("email"),
          days: Number(data.get("days") || 7),
          subscription: data.has("subscription"),
          games: data.has("games"),
          gameIds: data.getAll("gameIds")
        });
        adminDashboard = await api.admin.dashboard();
      } finally {
        adminBusy = false;
        render();
        restoreAdminTrialFormInteractivity({ focusEmail: true });
      }
    }, "Offre d’essai accordée");
    return;
  }
  if (event.target.id === "simulator-form") {
    event.preventDefault();
    const data = new FormData(event.target);
    const values = Object.fromEntries(data.entries());
    const selectedGift = giftForName(values.giftName || "Rose");
    await perform(
      () =>
        api.simulateEvent({
          type: values.type,
          username: values.username,
          nickname: values.nickname,
          count: Number(values.count || 1),
          value: Number(values.value || 0),
          giftId: selectedGift?.id || "",
          giftName: values.giftName || "Rose",
          giftImageUrl: selectedGift?.imageUrl || "",
          message: values.message || "!help"
        }),
      `Événement ${values.type} injecté dans les déclencheurs`
    );
    return;
  }
  if (event.target.id !== "settings-form") return;
  event.preventDefault();
  const data = new FormData(event.target);
  const values = Object.fromEntries(data.entries());
  await perform(async () => {
    snapshot = await api.saveSettings({
      startOverlayServer: data.has("startOverlayServer"),
      minimizeToTray: data.has("minimizeToTray"),
      allowKeystrokes: data.has("allowKeystrokes"),
      telemetry: data.has("telemetry"),
      overlayPort: Number(values.overlayPort),
      apiPort: Number(values.apiPort),
      tts: { voice: values.ttsVoice, rate: Number(values.ttsRate), pitch: Number(values.ttsPitch), volume: Number(values.ttsVolume) },
      obs: { url: values.obsUrl },
      obsPassword: values.obsPassword,
      spotify: {
        clientId: values.spotifyClientId,
        redirectPort: Number(values.spotifyRedirectPort)
      },
      backblaze: {
        bucket: values.backblazeBucket,
        endpoint: values.backblazeEndpoint,
        region: values.backblazeRegion,
        prefix: values.backblazePrefix,
        publicBaseUrl: values.backblazePublicBaseUrl,
        maxBytes: Number(values.backblazeMaxMb || 200) * 1024 * 1024
      },
      backblazeKeyId: values.backblazeKeyId,
      backblazeApplicationKey: values.backblazeApplicationKey
    });
    render();
  }, "Paramètres enregistrés");
});

api.on("game-install-progress", (progress) => {
  if (!progress?.gameId || progress.gameId !== gameInstallBusyId) return;
  gameInstallProgress = {
    ...(gameInstallProgress || {}),
    ...progress,
    lastActivityAt:
      progress.occurredAt ||
      gameInstallProgress?.lastActivityAt ||
      new Date().toISOString(),
    open: true
  };
  if (
    currentPage === "games" &&
    gamePageMode === "detail" &&
    selectedGameId === progress.gameId
  ) {
    render();
  }
});

api.on("state-changed", (value) => {
  const overlaySessionChanged =
    overlaySessionLifecycleSignature(snapshot) !==
    overlaySessionLifecycleSignature(value);
  const overlayStateHandledLocally =
    currentPage === "overlays" &&
    consumeLocallyHandledOverlayState(snapshot, value);
  const refreshOverlayPage =
    currentPage === "overlays" &&
    !overlayStateHandledLocally &&
    overlayPageStateSignature(snapshot) !== overlayPageStateSignature(value);
  const refreshGamePage =
    currentPage === "games" &&
    gamePageStateSignature(snapshot) !== gamePageStateSignature(value);
  const refreshCurrentPage =
    currentPage === "dashboard" ||
    currentPage === "activity" ||
    currentPage === "connections" ||
    currentPage === "actions" ||
    refreshGamePage ||
    refreshOverlayPage ||
    currentPage === "sounds" ||
    currentPage === "membership";
  acceptSnapshot(value);
  if (overlaySessionChanged) {
    postOverlayPreviewEvent(
      "session-state",
      value.state?.overlaySession || {}
    );
  }
  if (refreshCurrentPage) render();
  else {
    renderNavigation();
    syncChrome();
  }
});

api.on("public-overlay-relay-status", (status) => {
  if (!snapshot) return;
  snapshot.publicOverlayRelay = status;
  if (currentPage === "overlays") render();
  else syncChrome();
});

api.on("game-round-timeout", (entry) => {
  toast(
    "TIME OUT Minecraft",
    `${entry.appliedAmount} WIN${
      Math.abs(Number(entry.appliedAmount || 0)) === 1 ? "" : "S"
    } · total ${entry.currentWins}${
      entry.autoRestart ? " · nouveau chrono démarré" : ""
    }`,
    true
  );
});

api.on("overlay-completion-fired", (entry) => {
  const source =
    entry.kind === "likeGoal" ? "Like Goal atteint" : "Timer terminé";
  if (!entry.ok) {
    toast(
      `${source} · action impossible`,
      entry.error || "L’action sélectionnée n’a pas pu être exécutée.",
      true
    );
    return;
  }
  toast(
    source,
    `Action exécutée : ${
      ACTION_TYPE_LABELS[entry.actionType] || entry.actionType || "Action"
    }`
  );
});

api.on("live-event", (event) => {
  liveEvents.unshift(event);
  liveEvents = liveEvents.slice(0, 100);
  postOverlayPreviewEvent("event", event);
  if (currentPage === "live") render();
  else {
    renderNavigation();
    syncChrome();
  }
});

api.on("playback", (payload) => {
  if (payload.type === "tts" && "speechSynthesis" in window) {
    const utterance = new SpeechSynthesisUtterance(payload.text);
    utterance.rate = Number(payload.rate || 1);
    utterance.pitch = Number(payload.pitch || 1);
    utterance.volume = Number(payload.volume ?? 1);
    let selectedVoice = null;
    if (payload.voice) {
      selectedVoice = window.speechSynthesis
        .getVoices()
        .find((entry) => entry.name === payload.voice);
      if (selectedVoice) utterance.voice = selectedVoice;
    }
    utterance.lang = selectedVoice?.lang || payload.language || "fr-FR";
    window.speechSynthesis.speak(utterance);
  } else if (
    payload.type === "audio" &&
    /^https?:|^data:|^blob:/i.test(payload.url || "")
  ) {
    activePreviewAudio?.pause();
    activePreviewAudio?.remove();
    const audioStage = document.getElementById("audio-stage");
    const audio = document.createElement("audio");
    audio.src = payload.url;
    audio.preload = "auto";
    audio.volume = Number(payload.volume ?? 1);
    activePreviewAudio = audio;
    activePreviewAudioScope = payload.previewScope || "";
    audioStage.replaceChildren(audio);
    audio.addEventListener(
      "ended",
      () => {
        if (activePreviewAudio === audio) {
          activePreviewAudio = null;
          activePreviewAudioScope = "";
        }
        audio.remove();
      },
      { once: true }
    );
    audio
      .play()
      .catch((error) =>
        toast(
          "Lecture du son impossible",
          error.message || "Le fichier audio n’est pas accessible.",
          true
        )
      );
  }
});

function stopEditorAudioPreview() {
  if (
    activePreviewAudioScope !== "editor-dialog" ||
    !activePreviewAudio
  ) {
    return;
  }
  const audio = activePreviewAudio;
  activePreviewAudio = null;
  activePreviewAudioScope = "";
  audio.pause();
  try {
    audio.currentTime = 0;
  } catch {
    // Le média peut ne pas encore avoir chargé ses métadonnées.
  }
  audio.remove();
}

document.addEventListener(
  "scroll",
  () => {
    document
      .querySelectorAll("[data-gift-picker-root]")
      .forEach(positionGiftResults);
  },
  true
);

window.addEventListener("resize", () => {
  document
    .querySelectorAll("[data-gift-picker-root]")
    .forEach(positionGiftResults);
});

function keyboardShortcutMatches(event, shortcuts = "") {
  const candidates = String(shortcuts || "")
    .split(",")
    .map((shortcut) => shortcut.trim())
    .filter(Boolean);
  const eventKeys = new Set([
    String(event.key || "").toLowerCase(),
    String(event.code || "").toLowerCase(),
    String(event.code || "").replace(/^Key|^Digit/, "").toLowerCase()
  ]);
  return candidates.some((shortcut) => {
    const parts = shortcut
      .split("+")
      .map((part) => part.trim().toLowerCase())
      .filter(Boolean);
    const expects = {
      alt: parts.includes("alt"),
      ctrl: parts.includes("ctrl") || parts.includes("control"),
      shift: parts.includes("shift"),
      meta: parts.includes("meta") || parts.includes("cmd") || parts.includes("command")
    };
    if (
      event.altKey !== expects.alt ||
      event.ctrlKey !== expects.ctrl ||
      event.shiftKey !== expects.shift ||
      event.metaKey !== expects.meta
    ) {
      return false;
    }
    const key = parts.find(
      (part) => !["alt", "ctrl", "control", "shift", "meta", "cmd", "command"].includes(part)
    );
    return Boolean(key && eventKeys.has(key));
  });
}

function handleOverlayKeyboardShortcut(event) {
  if (
    !isAccountAuthenticated() ||
    event.repeat ||
    dialog.open ||
    event.target.closest?.("input, select, textarea, [contenteditable='true']")
  ) {
    return false;
  }
  for (const key of ["timer", "winCounter"]) {
    const config = overlayConfig(key);
    const commands = [
      ["incrementShortcut", "add"],
      ["decrementShortcut", "remove"],
      ["resetShortcut", "reset"]
    ];
    for (const [property, operation] of commands) {
      if (!keyboardShortcutMatches(event, config[property])) continue;
      event.preventDefault();
      const amount = key === "timer" ? 60 : 1;
      performOverlayQuickAction(key, operation, amount).catch((error) =>
        toast("Raccourci overlay impossible", error.message || String(error), true)
      );
      return true;
    }
  }
  return false;
}

document.addEventListener("keydown", (event) => {
  if (event.ctrlKey && event.shiftKey && event.key.toLowerCase() === "a") {
    event.preventDefault();
    if (isVerifiedAdminSession()) {
      currentPage = "admin";
      render();
      if (!adminDashboard) {
        refreshAdminDashboard().catch((error) =>
          toast("Administration indisponible", error.message || String(error), true)
        );
      }
    } else if (isAccountAuthenticated()) {
      openAdminLogin();
    } else {
      openAccountLogin();
    }
  }
  if (event.ctrlKey && event.key.toLowerCase() === "l") {
    event.preventDefault();
    if (isAccountAuthenticated()) toggleSession().catch(() => {});
    else openAccountLogin();
  }
  if (event.ctrlKey && event.shiftKey && event.key.toLowerCase() === "t") {
    event.preventDefault();
    if (isAccountAuthenticated()) api.testEvent("gift").catch(() => {});
    else openAccountLogin();
  }
  handleOverlayKeyboardShortcut(event);
});

function refreshAccountEntitlements() {
  if (!isAccountAuthenticated() || entitlementSyncPromise) {
    return entitlementSyncPromise;
  }
  entitlementSyncPromise = api.account
    .syncEntitlements()
    .catch(() => null)
    .finally(() => {
      entitlementSyncPromise = null;
    });
  return entitlementSyncPromise;
}

window.addEventListener("focus", () => {
  refreshAccountEntitlements();
});

document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") {
    refreshAccountEntitlements();
  }
});

setInterval(() => {
  refreshAccountEntitlements();
}, ENTITLEMENT_SYNC_INTERVAL_MS);

setInterval(() => {
  if (
    (gameInstallBusyId || gameLaunchBusyId) &&
    currentPage === "games" &&
    gamePageMode === "detail" &&
    [gameInstallBusyId, gameLaunchBusyId].includes(selectedGameId)
  ) {
    render();
  }
  if (
    snapshot?.state.session.running ||
    snapshot?.state.session.game?.running
  ) {
    syncChrome();
    updateMinecraftRoundCountdowns();
  }
}, 1000);

if ("speechSynthesis" in window) {
  refreshTtsVoiceSelects();
  window.speechSynthesis.addEventListener(
    "voiceschanged",
    refreshTtsVoiceSelects
  );
}

api.getSnapshot()
  .then(async (initialSnapshot) => {
    acceptSnapshot(initialSnapshot);
    const localAccount =
      initialSnapshot?.state?.settings?.account || {};
    accountSession = {
      authenticated: Boolean(localAccount.email && localAccount.uid),
      email: localAccount.email || "",
      uid: localAccount.uid || "",
      displayName: localAccount.displayName || "",
      photoUrl: localAccount.photoUrl || "",
      providerId: localAccount.providerId || "",
      emailVerified: localAccount.emailVerified === true,
      lastAuthenticatedAt: localAccount.lastAuthenticatedAt || "",
      offline: false
    };
    await hydrateGiftCatalog();
    ensureCurrentPageAccess();
    render();

    const [accountStatus, visibility] = await Promise.all([
      api.account
        .status()
        .catch(() => ({
          authenticated: false,
          email: "",
          uid: "",
          displayName: "",
          photoUrl: "",
          providerId: "",
          emailVerified: false,
          lastAuthenticatedAt: "",
          offline: false
        })),
      api.admin.visibility().catch(() => siteVisibility)
    ]);
    accountSession = accountStatus;
    siteVisibility = visibility;
    adminSession = await api.admin
      .status()
      .catch(() => ({
        authorized: false,
        email: "",
        uid: "",
        lastAuthenticatedAt: ""
      }));
    acceptSnapshot(await api.getSnapshot());
    ensureCurrentPageAccess();
    render();
    if (isVerifiedAdminSession()) {
      try {
        adminDashboard = await api.admin.dashboard();
        adminSession = adminDashboard.status || adminSession;
        render();
      } catch (error) {
        console.warn(
          "Synchronisation automatique des accès différée :",
          error?.message || error
        );
      }
    }
  })
  .catch((error) => {
    content.innerHTML = `<div class="empty-state"><div><span class="empty-icon">!</span><h2>ShenPulse n’a pas pu démarrer</h2><p>${escapeHtml(error.message)}</p></div></div>`;
  });
