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
const tiktokUsernameInput = document.getElementById("tiktok-username");
const tiktokControl = tiktokUsernameInput.closest(".tiktok-control");
const tiktokConnectionButton = document.getElementById("tiktok-connection-button");
const tiktokConnectionLabel = document.getElementById("tiktok-connection-label");
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
let currentPage = "home";
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
let soundsSection = "audio";
let catalogSearchRenderTimer = null;
let gameSearch = "";
let gameFilter = "all";
let gameCategory = "all";
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
    description: "Les outils essentiels pour préparer votre LIVE.",
    features: ["3 actions réutilisables et 1 profil", "Voix, sons et musique", "Overlays de base et simulateur"]
  },
  {
    tier: "pro",
    name: "Pro",
    price: 14.99,
    description: "Votre studio avancé, avec plus de liberté de création.",
    features: ["Actions et profils illimités", "Jeux vidéo, commandes et matchs", "Scènes et widgets Pro", "Modules communautaires inclus dans Pro"]
  },
  {
    tier: "premium",
    name: "Premium",
    price: 20.99,
    description: "Inclut automatiquement Pro et ajoute les avantages Premium.",
    features: ["Tout Pro inclus", "Machines IRL et interactions PlugPlus", "1 accès Pro offert à un utilisateur"]
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
  statistics: '<path d="M4 21V13h4v8M10 21V8h4v13M16 21V3h4v18"></path>',
  home: '<path d="m3 10 9-7 9 7v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path><path d="M9 21v-9h6v9"></path>',
  dashboard: `
    <rect width="7" height="9" x="3" y="3" rx="1"></rect>
    <rect width="7" height="5" x="14" y="3" rx="1"></rect>
    <rect width="7" height="9" x="14" y="12" rx="1"></rect>
    <rect width="7" height="5" x="3" y="16" rx="1"></rect>`,
  actions: `
    <path d="M4 14a1 1 0 0 1-.78-1.63l9.9-10.2a.5.5 0 0 1 .86.46l-1.92 6.02A1 1 0 0 0 13 10h7a1 1 0 0 1 .78 1.63l-9.9 10.2a.5.5 0 0 1-.86-.46l1.92-6.02A1 1 0 0 0 11 14z"></path>`,
  sounds: `
    <circle cx="8" cy="18" r="4"></circle>
    <path d="M12 18V2l7 4"></path>`,
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
  agencies: `<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M22 21v-2a4 4 0 0 0-3-3.87"/><circle cx="9" cy="7" r="4"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>`,
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
  { id: "home", label: "Accueil", icon: "⌂", title: "Accueil", kicker: "BIENVENUE CHEZ SHENPULSE" },
  { id: "dashboard", label: "Vue d’ensemble", icon: "⌁", title: "Vue d’ensemble", kicker: "CENTRE DE CONTRÔLE" },
  { section: "CRÉATION" },
  { id: "overlays", label: "Overlays", icon: "▱", title: "Overlays & widgets", kicker: "SOURCES NAVIGATEUR" },
  { id: "games", label: "Jeux & effets", icon: "◇", title: "Jeux & effets", kicker: "INTERACTIONS EN JEU", count: () => ShenPulseGameCategories.countGames(visibleGamePacks()) },
  {
    id: "irl",
    label: "Machines IRL",
    icon: "⚡",
    title: "Machines IRL",
    kicker: "APPAREILS CONNECTÉS",
    count: () =>
      snapshot?.state.settings.irl?.devices?.filter(isPlugPlusIrlDevice)
        .length || null,
    defaultScope: "public"
  },
  { id: "goals", label: "Objectifs", icon: "◎", title: "Objectifs", kicker: "PROGRESSION EN DIRECT" },
  { id: "commands", label: "Commandes", icon: "⌘", title: "Commandes", kicker: "PILOTAGE PAR LE CHAT" },
  { section: "SYSTÈME" },
  { id: "agencies", label: "Agences", icon: "♧", title: "Agences partenaires", kicker: "PROGRAMME AGENCES", defaultScope: "public" },
  { id: "membership", label: "Abonnement", icon: "♛", title: "Tarifs & abonnement", kicker: "ACCÈS SHENPULSE" },
  { id: "connections", label: "Connexions", icon: "⌁", title: "Connexions", kicker: "PLATEFORMES & RELAIS", count: () => snapshot?.state.connections.length },
  { id: "activity", label: "Journal", icon: "≡", title: "Journal d’activité", kicker: "DIAGNOSTIC LOCAL" },
  { id: "settings", label: "Paramètres", icon: "⚙", title: "Paramètres", kicker: "APPLICATION & CONFIDENTIALITÉ", ownerOnly: true, defaultScope: "admin" },
  {
    id: "admin",
    label: "Administration",
    icon: "♜",
    title: "Administration ShenPulse",
    kicker: "ACCÈS PROPRIÉTAIRE SÉCURISÉ",
    ownerOnly: true,
    defaultScope: "admin",
    hidden: () => !isVerifiedAdminSession()
  }
];

const creationPageIndex = pages.findIndex((page) => page.id === "overlays");
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

// L’ancienne bibliothèque audio redirige vers Voix & sons.
pages.find((page) => page.id === "sounds").hidden = () => true;
Object.assign(pages.find((page) => page.id === "dashboard"), { label: "Tableau de bord", title: "Tableau de bord" });
Object.assign(pages.find((page) => page.id === "games"), { label: "Jeux vidéo", title: "Jeux vidéo compatibles" });
pages.splice(pages.findIndex((page) => page.section === "CRÉATION"), 0,
  { id: "users", label: "Utilisateurs", title: "Utilisateurs & statistiques", kicker: "VOTRE COMMUNAUTÉ", icon: "♧" }
);
pages.splice(pages.findIndex((page) => page.id === "actions") + 1, 0,
  { id: "voice", label: "Voix & sons", title: "Voix & sons", kicker: "AUDIO INTERACTIF", icon: "♪" },
  { id: "music", label: "Musique", title: "Musique & song requests", kicker: "AMBIANCE DU LIVE", icon: "♫" }
);
pages.splice(pages.findIndex((page) => page.id === "connections") + 1, 0,
  { id: "controllers", label: "Contrôleurs", title: "Stream Deck & MIDI", kicker: "RÉGIE PHYSIQUE", icon: "▦", ownerOnly: true, defaultScope: "admin" }
);
// Les commandes gardent leur route historique, après les interactions IRL.
const chatbotNavigationEntry = pages.splice(pages.findIndex((page) => page.id === "commands"), 1)[0];
pages.splice(pages.findIndex((page) => page.id === "irl") + 1, 0, chatbotNavigationEntry,
  { id: "matches", label: "Matchs", icon: "VS", title: "Matchs", kicker: "LES TEMPS FORTS DU LIVE", defaultScope: "public" }
);
Object.assign(NAVIGATION_ICONS, {
  users: '<circle cx="9" cy="8" r="3"></circle><path d="M3 21v-3a6 6 0 0 1 12 0v3M16 5a3 3 0 0 1 0 6M19 21v-3a6 6 0 0 0-3-5"></path>',
  voice: '<rect x="9" y="2" width="6" height="12" rx="3"></rect><path d="M5 10v2a7 7 0 0 0 14 0v-2M12 19v3M8 22h8"></path>',
  music: '<path d="M9 18V5l12-3v13M9 8l12-3"></path><circle cx="6" cy="18" r="3"></circle><circle cx="18" cy="15" r="3"></circle>',
  commands: '<rect x="3" y="4" width="18" height="16" rx="3"></rect><path d="m7 9 3 3-3 3M13 15h4"></path>',
  matches: '<path d="m4 3 5 2 1 6-4 4-3-2V7zM20 3l-5 2-1 6 4 4 3-2V7zM6 15v6h5M18 15v6h-5"></path>',
  controllers: '<rect x="3" y="3" width="18" height="18" rx="3"></rect><path d="M9 3v18M15 3v18M3 9h18M3 15h18"></path>'
});

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
  "palworld",
  "escape-from-duckov",
  "shenfarm", "shenpaint", "shenkite", "splash-bombes",
  "hogwarts-legacy", "tcg-card-shop-simulator", "supermarket-simulator", "shift-at-midnight",
  "dead-by-daylight", "dredge", "egging-on", "fallout-4",
  "ark-survival-ascended",
  "balatro",
  "blue-prince",
  "crash-bandicoot-n-sane-trilogy",
  "unturned",
  "the-mortuary-assistant",
  "clash-of-live",
  "color-strike",
  "tiklive-climb",
  "tiklive-cube-wars",
  "tiklive-stack-tower",
  "demonologist",
  "find-the-needle-demo",
  "euro-truck-simulator-2",
  "resident-evil-3",
  "gtav-montchiliad",
  "gtav-koth-enhanced",
  "gtav-hiking-enhanced",
  "pokemon-red-blue",
  "super-mario-kart",
  "minecraft-bedrock-box",
  "minecraft-sandbox-3",
  "minecraft-survival-plugin",
  "minecraft-lavarise",
  "cult-of-the-lamb",
  "stardew-valley",
  "terraria"
]);

const MANAGED_BIZHAWK_GAME_IDS = new Set([
  "pokemon-red-blue",
  "super-mario-kart"
]);

const GAME_OVERLAY_GENERATOR_ONLY_IDS = new Set([
  "hogwarts-legacy", "tcg-card-shop-simulator", "supermarket-simulator", "shift-at-midnight",
  "dead-by-daylight", "dredge", "egging-on", "fallout-4",
  "ark-survival-ascended",
  "balatro",
  "blue-prince",
  "crash-bandicoot-n-sane-trilogy",
  "unturned",
  "the-mortuary-assistant",
  "cult-of-the-lamb",
  "stardew-valley",
  "terraria"
]);

const MINECRAFT_LAUNCHER_ID = "minecraft";
const GTA_LAUNCHER_ID = "gta-enhanced";
const GTA_MODE_IDS = Object.freeze(["gtav-montchiliad", "gtav-koth-enhanced", "gtav-hiking-enhanced"]);
const MINECRAFT_MODE_IDS = Object.freeze([
  "minecraft-lavarise",
  "minecraft-bedrock-box",
  "minecraft-sandbox-3",
  "minecraft-survival-plugin"
]);
const MINECRAFT_ROUND_MODE_IDS = Object.freeze([
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
