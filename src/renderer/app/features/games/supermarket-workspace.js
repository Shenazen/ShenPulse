"use strict";
const MARKET_COLUMNS = Object.freeze([
    { id: "help", label: "Aider le streamer", hint: "Un coup de pouce pour votre magasin.", icon: "+" },
    { id: "neutral", label: "Neutre", hint: "Des surprises qui changent la partie.", icon: "◇" },
    { id: "trap", label: "Le piéger", hint: "Vos viewers vous compliquent la tâche.", icon: "ϟ" }
]);
const MARKET_HELP_CODES = new Set(["SpawnCustomers", "CustomerRush", "GiveMoney", "Jackpot", "FillShelves", "MaxLevel", "AntiChaos", "SpeedBoost", "OpenStore", "DeliverProducts", "HireEmployees", "UnlockAllLicenses", "UpgradeStore", "DeliverFurniture", "ResetEffects"]);
const MARKET_NEUTRAL_CODES = new Set(["SpeedUpTime", "ThrowItem", "DropAllItems", "RandomizePrices", "Teleport", "ChangeFOV", "GameSpeedUp", "ChangeLanguage", "AutoDiscount", "FinishDay", "ResetGame"]);
let marketAddMenu = "";
let marketPendingExtraRuleId = "";
let marketCatalogSearch = "";
let marketCatalogCategory = "all";
let marketCatalogOpen = false;
function supermarketTriggerPresentation(rule) {
    const automatic = hasAutomaticTrigger(rule);
    const type = rule.trigger?.type || 'gift';
    const reference = ruleGiftCondition(rule) || {};
    const giftName = ruleGiftName(rule);
    const gift = type === 'gift' && typeof giftForSavedReference === 'function'
        ? giftForSavedReference(giftName, reference.giftId, reference) : null;
    const cost = Math.max(0, Number(gift?.cost ?? reference.giftCost) || 0);
    const caption = !automatic ? 'Lancement manuel' : type === 'gift' ? giftName || 'Choisir un cadeau' : triggerLabel(rule);
    const image = eventIconMarkup(automatic ? type : giftName ? 'gift' : 'manual', {
        ...reference, giftName, giftId: reference.giftId,
        imageUrl: gift?.imageUrl || reference.giftImageUrl
    });
    return { caption, image, cost, free: automatic && ['follow', 'like', 'likes'].includes(type) };
}
// Adaptateur du jeu : seuls les contenus, capacités et branchements métier restent ici.
function supermarketRows(pack) { return ShenPulseGameWorkspace.collectRows(pack, gameMappedEffects(pack)); }
function supermarketColumn(row) { return ShenPulseGameWorkspace.classifyRow(row, { columns: MARKET_COLUMNS, storedKey: 'marketColumn', helpCodes: MARKET_HELP_CODES, neutralCodes: MARKET_NEUTRAL_CODES }); }
function supermarketContext(pack = supermarketPack(), overrides = {}) {
    const rows = overrides.rows || supermarketRows(pack), unlocked = overrides.unlocked ?? isGameUnlocked(pack);
    const installation = snapshot.state.game.installations?.[pack.id], update = installation && installation.installerVersion !== pack.installerVersion;
    const platform = gameInstallationPlatformLabel(installation), active = activeGameSession()?.packId === pack.id, busy = gameInstallBusyId === pack.id || gameLaunchBusyId === pack.id || typeof gameMaintenanceBusyId !== 'undefined' && gameMaintenanceBusyId === pack.id;
    const presentation = supermarketOverlayPresentation();
    const ctx = ShenPulseGameWorkspace.createContext({ pack, rows, unlocked, interactionsReady: (typeof gameWorkspaceInteractionsReady !== 'function' || gameWorkspaceInteractionsReady(pack)) && !(typeof gameMaintenanceBusyId !== 'undefined' && gameMaintenanceBusyId === pack.id && gameMaintenanceBusyOperation === 'reset-game-interactions'), idPrefix: 'market', classAliases: { 'game-pack-': 'market-' }, profileId: snapshot.state.session.profileId, accountUid: snapshot.state.settings.account?.uid || '',
        columns: MARKET_COLUMNS.map(column => ({ ...column, shortLabel: column.id === 'help' ? 'Aide' : column.id === 'trap' ? 'Piège' : 'Neutre' })), classify: supermarketColumn, titleForRule: ShenPulseGameInteractionTitles.title, presentTrigger: supermarketTriggerPresentation, isAutomatic: hasAutomaticTrigger, eventIcon: eventIconMarkup, normalizeGiftSearch: normalizeGiftName, giftSearchText: giftPickerSearchText,
        bindings: { inline: 'market-inline', card: 'market-card', freeType: 'market-free-type', freePlaceholder: 'market-free-placeholder', overlayColor: 'market-overlay-color', catalogSearch: 'market-catalog-search', catalogLabel: 'market-catalog-label', giftChoice: 'market-gift-choice', giftRange: 'market-gift-range', giftSearch: 'market-gift-search', giftShowAll: 'market-gift-show-all', giftResults: 'market-gift-results', giftMore: 'market-gift-more' },
        actions: { add: 'market-add', addKind: 'market-add-kind', gift: 'market-gift', sound: 'market-sound', previewSound: 'market-preview-sound', extraAdd: 'market-extra-add', removeExtra: 'market-remove-extra', cancelExtra: 'market-cancel-extra', category: 'market-category', addEffect: 'market-add-effect', chooseModel: 'market-overlay-model', chooseColor: 'market-overlay-color', previewMode: 'market-preview-mode', section: 'market-section', studioOpen: 'market-studio-open', studioInstall: 'market-studio-install', studioClose: 'market-studio-close' },
        interactionActions: [{action:'reset-game-interactions',id:pack.id,label:'↺ Valeurs par défaut',disabled:!unlocked || busy || active}],
        features: { wins: false, overlays: false }, freeDefaults: { follow: 'GiveMoney', like: 'GiveMoney' },
        ui: { addMenu: marketAddMenu, pendingExtraRuleId: marketPendingExtraRuleId, catalog: { search: marketCatalogSearch, category: marketCatalogCategory, open: marketCatalogOpen } },
        hero: { artwork: gameArtwork(pack), titleLines: ['SUPERMARKET', 'SIMULATOR'], kicker: 'VOTRE MAGASIN · VOS VIEWERS AUX COMMANDES', description: 'Vos viewers vous aident ou vous piègent avec leurs cadeaux. Préparez votre magasin, vos interactions et votre LIVE au même endroit.', installed: !!installation,
            stats: [{ value: pack.effects.length, label: 'effets disponibles' }, { value: rows.filter(row => row.rule.enabled !== false && hasAutomaticTrigger(row.rule)).length, label: 'déclencheurs actifs' }, { value: rows.filter(row => row.rule.actions?.some(action => action.type === 'audio.play')).length, label: 'sons associés' }],
            status: installation ? 'Pack installé' + (platform ? ' · ' + platform : '') : 'Interactions à installer', installNote: 'Installation automatique depuis ShenPulse. Si plusieurs éditions sont présentes, choisissez Steam ou Xbox / Game Pass.', installPath: installation?.path || '',
            actions: [{ className: 'button primary', action: 'install-game', id: pack.id, disabled: !unlocked || busy, label: '↓ ' + (gameInstallBusyId === pack.id ? 'Installation en cours…' : update ? 'Mettre à jour le pack' : installation ? 'Réparer l’installation' : 'Installer automatiquement') }, { className: 'button game-pack-studio-button', action: 'market-studio-open', disabled: !unlocked || busy, label: '▣ Installer sur le studio' }, { className: 'button game-pack-launch-button', action: active ? 'stop-game-session' : 'launch-game', id: pack.id, disabled: !unlocked || !installation || busy, label: active ? '■ Arrêter la session' : gameLaunchBusyId === pack.id ? 'Lancement en cours…' : '▶ Lancer le jeu' + (platform ? ' · ' + platform : '') }],
            links: [{ className: 'button', action: 'market-section', value: 'interactions', label: '⚡ Configurer les cadeaux' }, ...(installation ? [{className:'button game-pack-maintenance-button',action:'uninstall-game',id:pack.id,label:'Désinstaller le module',disabled:!unlocked || busy || active}] : [])] },
        preview: { presentation, models: [{ id: 1, label: 'Modèle 1', supportsMotion: true }, { id: 2, label: 'Modèle 2', supportsBackground: true, backgroundLabel: 'Fond du modèle 2', backgroundAriaLabel: 'Couleur personnalisée du modèle 2' }, { id: 3, label: 'Modèle 3' }], backgrounds: GTA_INTERACTION_OVERLAY_BACKGROUNDS, planLabel: 'PRO', fixedValue: 'static', sourceUrl: supermarketOverlayUrl(true, true), publicUrl: supermarketOverlayUrl() || supermarketOverlayUrl(true),
            camera: { src: 'assets/games/market-webcam-preview.jpg', alt: 'Exemple de caméra en LIVE', username: 'ton_pseudo' }, game: { src: gameArtwork(pack), alt: pack.name, label: 'VOTRE PARTIE' },
            guides: [{ kind: 'camera', title: 'Ta caméra', description: 'En haut, comme d’habitude.' }, { kind: 'game', title: 'Ton jeu', description: 'Au milieu, rien ne le cache.' }, { kind: 'gifts', title: 'Les cadeaux', animated: 'Les cartes réagissent avec le pseudo du viewer.', fixed: 'Les interactions de tes viewers, en bas.' }],
            caption: { animated: 'Les cartes bougent et réagissent avec le pseudo du viewer quand son cadeau tombe.', fixed: 'Les cadeaux et les interactions de ton pack restent affichés dans la mise en page choisie.' } },
        tour: { steps: supermarketTourSteps(!!installation, active) },
        guide: { title: 'Prêt en trois étapes', steps: [{ title: 'Installez les interactions', description: 'ShenPulse détecte votre jeu, télécharge le pack et prépare les fichiers.' }, { title: 'Configurez vos cartes', description: 'Choisissez les cadeaux, les effets et les sons de votre communauté.' }, { title: 'Lancez votre magasin', description: 'Chargez une partie et gardez la session active pour vos viewers.' }] },
        fragments: { conditionsButton: () => renderGameConditionsButton(pack), conditionsPanel: () => renderGameConditionsPanel(pack), installationMessage: () => renderGamePageMessage(pack, 'installation'), launchMessage: () => renderGamePageMessage(pack, 'launch'), session: ctx => renderGameInteractionSession(pack, unlocked && ctx.interactionsReady !== false), launchProgress: () => renderGameLaunchProgressModal(pack) }
    });
    return ctx;
}
function supermarketMarkup(ctx, html) { return ShenPulseGameWorkspace.withClassAliases(ctx, html); }
function renderSupermarketAddButton(column, disabled, main = false) { const ctx = supermarketContext(); return supermarketMarkup(ctx, ShenPulseGameWorkspace.renderAddButton(ctx, column, disabled, main)); }
function supermarketEffectSelect(pack, effectId, attributes, label, withImage = true) { const ctx = supermarketContext(pack); return supermarketMarkup(ctx, ShenPulseGameWorkspace.renderEffectSelect(ctx, effectId, attributes, label, withImage)); }
function supermarketRowAttributes(row) { const pack = snapshot.packs.find(pack => pack.id === row.action.config?.packId) || supermarketPack(); return ShenPulseGameWorkspace.rowAttributes(supermarketContext(pack), row); }
function supermarketEditorButton(row, label, extraClass = '') { const ctx = supermarketContext(); return supermarketMarkup(ctx, ShenPulseGameWorkspace.renderEditorButton(ctx, row, label, extraClass)); }
function renderSupermarketInteraction(row, unlocked) { const ctx = supermarketContext(undefined, { unlocked }); return supermarketMarkup(ctx, ShenPulseGameWorkspace.renderInteractionCard(ctx, row)); }
function supermarketOverlayUrl(local = false, compact = false) { return ShenPulseGameWorkspace.overlayUrl({ base: (local ? snapshot.localOverlayUrls : snapshot.overlayUrls)?.gamePack, packId: 'supermarket-simulator', profileId: snapshot.state.session.profileId, language: 'fr', compact }); }
function supermarketOverlayPresentation() { const value = snapshot.state.settings.overlayConfigs?.gameInteractionOverlays?.['supermarket-simulator'] || {}; return { model: [1, 2, 3].includes(Number(value.model)) ? Number(value.model) : 1, motion: value.motion === 'fixed' ? 'fixed' : 'animated', backgroundColor: /^#[0-9a-f]{6}$/i.test(value.backgroundColor || '') ? value.backgroundColor : '#082b63' }; }
function renderSupermarketModelChoices() { const ctx = supermarketContext(); return supermarketMarkup(ctx, ShenPulseGameWorkspace.renderPreviewControls(ctx)); }
function patchSupermarketPreview(previousMarkup, nextMarkup) { return ShenPulseGameWorkspace.patchPreview(content, previousMarkup, nextMarkup); }
function renderSupermarketPhone(pack) { const ctx = supermarketContext(pack); return supermarketMarkup(ctx, ShenPulseGameWorkspace.renderLivePreview(ctx)); }
function renderSupermarketWorkspace(pack) { return ShenPulseGameWorkspace.renderPage(supermarketContext(pack)); }
function renderSupermarketQuickGuide() { const ctx = supermarketContext(); return supermarketMarkup(ctx, ShenPulseGameWorkspace.renderQuickGuide(ctx)); }
function renderSupermarketCatalog(pack, unlocked) { const ctx = supermarketContext(pack, { unlocked }); return supermarketMarkup(ctx, ShenPulseGameWorkspace.renderCatalog(ctx)); }

// Les cibles et textes appartiennent au jeu ; le moteur de visite est partagé.
function supermarketTourSteps(installed, active) {
    return [
        { target: '.game-pack-launch-actions [data-action="install-game"]', title: installed ? '1. Le module du jeu' : '1. Installer les interactions', text: installed ? 'Le pack est déjà installé. Ce bouton permet de le réparer ou de le mettre à jour. Pour une première installation, ShenPulse détecte le jeu et télécharge les fichiers nécessaires. Fermez le jeu avant une installation.' : 'Commencez par « Installer automatiquement », jeu fermé. ShenPulse détecte votre installation, télécharge le pack et prépare les interactions. Si Steam et Xbox / Game Pass sont présents, choisissez l’édition que vous souhaitez utiliser.' },
        { target: '.game-conditions-button', title: 'Vérifier les conditions', text: 'Ouvrez « CONDITION DE JEU » après la visite pour retrouver les prérequis et les étapes propres à Supermarket Simulator. Les effets de clients demandent notamment un magasin ouvert, pendant les heures de visite, avec une partie chargée hors menus.' },
        { targets: ['.game-pack-action-card .game-pack-gift-tile', '.game-pack-columns'], title: 'Choisir les cadeaux', text: 'Chaque carte relie un cadeau à une action du jeu. Cliquez sur son image pour choisir le cadeau TikTok. Aide, Neutre et Piège déterminent la présentation de la carte. L’interrupteur active ou désactive la règle ; les changements restent propres au profil actif.' },
        { targets: ['.game-pack-action-card .game-pack-effect-field', '.game-pack-columns'], title: 'Régler les effets', text: 'Choisissez l’action, puis sa quantité ou sa durée si elle est réglable. « + action » ajoute un autre effet au même cadeau. Le nom de la carte est modifiable ; la roue dentée ouvre les réglages détaillés, comme les délais entre deux déclenchements.' },
        { targets: ['.game-pack-action-card .game-pack-sound-control', '.game-pack-heading-actions'], title: 'Sons et nouvelles cartes', text: '« Aucun son » permet d’associer un son au cadeau ; le petit bouton lecture sert à l’écouter. « Ajouter une interaction » crée une autre carte. Le bouton de test de la carte lance réellement son effet : utilisez une partie d’essai après le lancement du jeu.' },
        { target: '.game-pack-follow-grid', title: 'Follow et Likes', text: 'Ces déclencheurs sont gratuits pour les viewers. Activez chaque ligne souhaitée, choisissez son effet et sa quantité. Pour les likes, réglez le nombre à atteindre par viewer. Une ligne désactivée ne déclenche rien.' },
        { target: '.game-pack-catalog > summary', title: 'Découvrir tous les effets', text: 'Dépliez cette ligne pour rechercher et filtrer tous les effets disponibles. Vous pourrez les ajouter à votre pack ou les tester en jeu. Repliez la liste pour garder une page lisible.' },
        { target: '.game-pack-preview-controls', title: 'Personnaliser l’overlay', text: 'Choisissez le modèle et, lorsqu’elle est proposée, sa couleur. Le modèle 1 propose Animé ou Fixe. L’aperçu du téléphone utilise les cadeaux et interactions de votre profil ; les modifications se mettent à jour sur la même URL.' },
        { target: '.game-pack-copy-overlay', title: 'Afficher les interactions en LIVE', text: 'Ce bouton copie l’URL de vos cadeaux. Collez-la dans une source Navigateur / Lien de votre studio pour afficher les interactions pendant le LIVE. Vous pouvez aussi utiliser l’installation automatique sur le studio, à l’étape suivante.' },
        { target: '.game-pack-launch-actions [data-action="market-studio-open"]', title: 'Préparer le studio', text: 'Choisissez TikTok LIVE Studio, OBS ou Streamlabs parmi les logiciels installés. ShenPulse ajoute une scène avec caméra, capture du jeu et overlay des interactions. Vérifiez ensuite la caméra, la capture et la disposition dans votre studio.' },
        { targets: ['.game-pack-launch-button'], title: active ? 'La session est déjà active' : 'Lancer le bon jeu', text: active ? 'La session de ce jeu est active. Ce bouton permet de l’arrêter. Pour un prochain démarrage, « Lancer le jeu » utilisera l’édition Steam ou Xbox / Game Pass sélectionnée à l’installation.' : 'Cliquez sur « Lancer le jeu » après avoir installé le pack. ShenPulse utilise l’édition choisie à l’installation et vérifie la connexion du module. Chargez votre partie, fermez les menus et ouvrez le magasin pour les effets de clients.' },
        { target: '.tiktok-control', global: true, title: 'Connecter votre LIVE', text: 'Saisissez votre @ TikTok en haut de ShenPulse et connectez-vous à votre LIVE. Les essais manuels ne nécessitent pas de cadeau, mais les vrais événements des viewers demandent une connexion au LIVE.' },
        { target: '.game-interaction-session', title: 'Activer les déclenchements viewers', text: 'Vérifiez ici « Déclenchements viewers actifs ». Si la session est inactive, activez-la une fois le jeu prêt et connecté. Sans session active, les cadeaux peuvent être reçus sans déclencher les effets. Testez ensuite un cadeau et surveillez le résultat dans le jeu.' },
        { targets: ['.game-pack-heading-actions [data-action="reset-game-interactions"]'], title: 'Repartir des valeurs par défaut', text: 'Ce bouton rétablit les 6 aides et 6 pièges du pack pour le profil actif. Une confirmation est demandée et vos règles précédentes sont sauvegardées. Il ne désinstalle pas le module du jeu.' },
        ...(installed ? [{ target: '[data-action="uninstall-game"]', title: 'Retirer le module si nécessaire', text: '« Désinstaller le module » retire les interactions installées dans le jeu, après confirmation et avec le jeu fermé. Vos sauvegardes et vos cartes ShenPulse sont conservées. Les fichiers partagés avec d’autres mods peuvent être préservés. Vous êtes prêt : fermez la visite pour effectuer vos réglages.' }] : [])
    ];
}
