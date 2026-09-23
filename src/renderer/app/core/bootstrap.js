"use strict";

/**
 * Références DOM, état d'interface et constantes partagées.
 *
 * Ce module est chargé comme script classique dans l'ordre déclaré par la page.
 * Il partage uniquement les contrats globaux documentés dans README.md.
 */

const api = window.shenPulse;
const visibilityTools = window.ShenPulseVisibility;
const overlayCatalog = window.ShenPulseOverlayCatalog;
if (!overlayCatalog) {
  throw new Error("Le catalogue commun des overlays n'est pas chargé.");
}
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
const storeUpdateBanner = document.getElementById("store-update-banner");
const storeUpdateTitle = document.getElementById("store-update-title");
const storeUpdateDetail = document.getElementById("store-update-detail");
const storeUpdateButton = document.getElementById("store-update-button");

function readCopiedMediaScreenUrls() {
  try {
    const stored = JSON.parse(
      window.localStorage.getItem(COPIED_MEDIA_SCREEN_URLS_KEY) || "[]"
    );
    return new Set(Array.isArray(stored) ? stored.map(String) : []);
  } catch {
    return new Set();
  }
}

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
const COPIED_MEDIA_SCREEN_URLS_KEY = "shenpulse.copiedMediaScreenUrls";
let copiedMediaScreenUrls = readCopiedMediaScreenUrls();
let simulatorType = "gift";
let overlaySearch = "";
let overlayCategory = "all";
let soundSearch = "";
let soundCategory = "all";
let gameSearch = "";
let gameFilter = "all";
let subscriptionCheckoutBusyTier = "";
let subscriptionStopBusy = false;
let selectedGameId = "";
let gamePageMode = "catalog";
let gameWorkspaceStep = "installation";
let gameEffectSearch = "";
let gameEffectCategory = "all";
let gameInteractionEditorContext = null;
let gameInteractionCatalogContext = null;
let gameInstallProgress = null;
let gameInstallBusyId = "";
let gameLaunchProgress = null;
let gameLaunchBusyId = "";
let dealOrNoDealHostState = null;
let thiercelieuxHostState = null;
const integratedSettingsPanels = new Map();
const gamePageMessages = new Map();
const COIN_PUSHER_ARTWORK_MAX_SOURCE_BYTES = 20 * 1024 * 1024;
const COIN_PUSHER_ARTWORK_MAX_DIMENSION = 1600;
const COIN_PUSHER_ARTWORK_TARGET_LENGTH = 750000;
const COIN_PUSHER_DEFAULT_PREVIEW_IMAGE =
  "games/original-src/assets/games/coin-pusher/platform-default.webp";
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
let irlBusy = false;
let irlDiscovery = { accessPoints: [], currentNetwork: "" };
let irlActionSearch = "";
let gameCheatAccessAllowed = false;
let gameCheatAccessPromise = null;
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
let giftCatalogById = new Map();
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
const STORE_UPDATE_CHECK_INTERVAL_MS = 4 * 60 * 60 * 1000;
let storeUpdateStatus = null;
let storeUpdateCheckPromise = null;
let storeUpdateInstalling = false;
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

const OVERLAY_THEMES = overlayCatalog.themes;
const COIN_JAR_MODELS = overlayCatalog.coinJarModels;
const MATCH_VARIANTS = overlayCatalog.matchVariants;
const MATCH_OVERLAYS = overlayCatalog.matches.map(({ key, name, match }) => [
  key,
  name,
  match
]);

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
  "action.group": "Groupe d’actions",
  "overlay.match": "Animation Match",
  "game.effect": "Effet de jeu",
  "overlay.win-counter": "Compteur WINS",
  "obs.request": "Commande OBS",
  "http.request": "Requête HTTP",
  "websocket.send": "Message WebSocket",
  "chat.reply": "Réponse chat",
  "spotify.queue": "Spotify",
  "irl.shelly": "Prise PlugPlus",
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
  "action.group": "🔀",
  "overlay.match": "VS",
  "game.effect": "🎮",
  "overlay.win-counter": "🏆",
  "obs.request": "📺",
  "http.request": "🌐",
  "websocket.send": "🔌",
  "chat.reply": "💬",
  "spotify.queue": "🎵",
  "irl.shelly": "⚡",
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
  irl: `
    <path d="M7 2v5M17 2v5"></path>
    <path d="M5 7h14v3a7 7 0 0 1-14 0z"></path>
    <path d="M12 17v5"></path>
    <path d="M9 22h6"></path>`,
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
  {
    id: "irl",
    label: "Interactions IRL",
    icon: "⚡",
    title: "Interactions IRL",
    kicker: "APPAREILS CONNECTÉS",
    count: () =>
      snapshot?.state.settings.irl?.devices?.filter(isPlugPlusIrlDevice)
        .length || null,
    ownerOnly: true,
    defaultScope: "admin"
  },
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

const GAME_OVERLAY_GENERATOR_ONLY_IDS = new Set([
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
  "deal-or-no-deal",
  "thiercelieux"
]);

const DEFAULT_GAME_JOURNEY = Object.freeze([
  Object.freeze({ id: "installation", label: "Installation", icon: "↓" }),
  Object.freeze({ id: "interactions", label: "Interactions", icon: "⚡" }),
  Object.freeze({ id: "overlays", label: "Overlays", icon: "▱" }),
  Object.freeze({ id: "launch", label: "Démarrage", icon: "▶" })
]);
