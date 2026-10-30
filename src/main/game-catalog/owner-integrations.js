"use strict";
const { game } = require("./builders");
const records = require("../../../resources/catalogs/owner-game-preparation.json").games;
const modules = require("../../../resources/catalogs/owner-prepared-modules.json");
const { GIFTS } = require("./presentation");
const { artworkPack } = require("../../shared/game-workspace-policy");
const { ownerGameListed } = require("../../shared/owner-game-catalog-policy");

function defaults(record) {
  const result = [];
  for (const column of ["help", "trap"]) {
    record.effects.filter(effect => effect.available && effect.column === column && effect.service !== "overlay").slice(0, 6).forEach((effect, index) => {
      const [giftName, giftId, giftCost, giftIds = []] = GIFTS[column][index];
      result.push({ id: "starter-" + column + "-" + (index + 1), effectId: effect.id, title: effect.name, marketColumn: column, giftName, giftId, giftCost, giftIds, triggerType: "gift", triggerEnabled: true, enabled: true, threshold: 1, duration: effect.duration || 0, parameters: {}, preserveExisting: true });
    });
  }
  if (modules[record.id]?.installer?.minecraftServer) {
    const { LAVARISE_DEFAULT_MAPPINGS } = require("./minecraft/lavarise");
    for (const mapping of LAVARISE_DEFAULT_MAPPINGS) {
      const suffix = mapping.effectId.replace("lava-win-", "");
      const effectId = record.id + "-win-" + suffix;
      if (record.effects.some(effect => effect.id === effectId && effect.available)) result.push({ ...mapping, id: mapping.id.replace("lava-", record.id + "-"), effectId, preserveExisting: true });
    }
  }
  return result;
}

function guide(record) {
  const module = modules[record.id];
  const installer = module?.installer;
  const web = installer?.remoteBrowserGame;
  const minecraft = installer?.minecraftServer;
  const bundled = installer?.managedTarget;
  const ready = record.stage === "prepared";
  const tested = module?.inGameValidation && module.inGameValidation !== "pending";
  const summary = ready ? tested ? record.compatibilityNote || "Module ShenPulse vérifié sur Xbox / Game Pass." : "Module local ShenPulse préparé. La vérification en partie reste à effectuer sur chaque édition." : record.preparationBlocker?.message || "Intégration privée en préparation. Le lancement et les interactions seront ouverts après préparation du module autonome.";
  const firstStep = minecraft
    ? "Utilisez Minecraft Java " + installer.minecraftVersion + ". Le pack fournit le serveur local et ses interactions ; le client Minecraft doit être installé séparément."
    : web ? "Le pack contient les interactions ShenPulse. Le bouton Lancer ouvre la version web officielle de Cookie Clicker ; une connexion Internet est nécessaire."
    : bundled ? "Le téléchargement contient le jeu et sa connexion locale ShenPulse. Aucun logiciel de jeu externe n’est nécessaire."
    : "Installez le jeu depuis sa boutique officielle, puis fermez-le.";
  return {
    mode: ready ? "native" : "reference",
    journey: ["installation", "interactions", "launch"], summary,
    steps: ready ? [
      firstStep,
      minecraft ? "Cliquez sur Installer automatiquement et acceptez les conditions Minecraft. Lancez ensuite le serveur, puis rejoignez 127.0.0.1:" + minecraft.port + " depuis Minecraft Java " + installer.minecraftVersion + "."
        : bundled ? "Cliquez sur Installer automatiquement, puis sur Lancer le jeu."
        : "Cliquez sur Installer automatiquement et choisissez l’édition à préparer si plusieurs installations sont présentes.",
      "Choisissez les cadeaux des six aides et des six pièges, dans la limite des effets disponibles.",
      tested ? "Lancez le jeu depuis ShenPulse, chargez une partie puis fermez les menus avant les interactions." : "Les essais en jeu de ce nouveau pack restent à effectuer avant son ouverture aux autres utilisateurs."
    ] : ["Cette fiche est privée et réservée au compte propriétaire.", record.preparationBlocker?.message || "Les fichiers et la connexion autonome de ce jeu sont encore en préparation.", "Aucun essai en jeu n’a été effectué dans cette phase."],
    notes: [
      ...Object.values(installer?.unsupportedPlatformReasons || {}),
      ...(record.id === "fallout-new-vegas" ? ["Pour Xbox / Game Pass, acceptez la demande Windows du module ShenPulse au lancement. Si la version du jeu n’est pas reconnue, réinstallez le pack à jour. La mort est refusée pendant une invincibilité active."] : []),
      ...(record.id === "cloverpit" ? ["Chargez une partie hors menus. Les effets de tours demandent une manche active ; le retrait demande plus de deux tours restants. Pour ranger un charme, il faut un charme équipé et un tiroir débloqué et disponible. Les retraits de ressources exigent la quantité correspondante."] : []),
      ...(installer?.helperGame === "pvz-goty" ? ["Cette version du module cible Plants vs. Zombies GOTY sur Steam. L’édition Electronic Arts nécessite une adaptation distincte ; son logo indique la disponibilité du jeu de base. Chargez un niveau jouable, hors écran de choix des plantes, avant les interactions."] : []),
      ...(installer?.helperGame === "tf2" ? ["Installez Team Fortress 2 depuis Steam et lancez-le une première fois. Ensuite, lancez-le depuis ShenPulse : les options de connexion locale et les fichiers de configuration sont préparés automatiquement. Les effets agissent sur votre client ; ils ne permettent pas de modifier librement le serveur ni de créer des ennemis."] : []),
      ...(installer?.fileGame === "srb2" ? ["Installez Sonic Robo Blast 2 pour Windows, puis lancez-le depuis ShenPulse : le module et son profil de sauvegarde dédié sont chargés automatiquement. Démarrez une partie pour activer les effets."] : []),
      ...(installer?.fileGame === "fs25" ? ["Activez le mod Interactions ShenPulse dans les mods de la sauvegarde, puis chargez une partie solo ou hôte. Les effets de véhicule exigent de conduire un véhicule. Pour le blé ou l’orge, utilisez une remorque ou un réservoir compatible. La croissance est traitée progressivement par le jeu."] : []),
      ...(record.id === "escape-the-backrooms" ? ["Utilisez l’édition Xbox / Game Pass, puis une partie solo ou une partie dont vous êtes l’hôte. Les entités apparaissent à proximité et restent au maximum huit à la fois. Les dons demandent assez de places libres dans l’inventaire ; les effets dangereux peuvent terminer la vie du personnage."] : []),
      ...(minecraft ? [record.id === "minecraft-diamond-rush" ? "Récoltez 3 000 diamants avec la pioche fournie pour gagner une win. Les cadeaux peuvent modifier la mine et le compteur." : "Remplissez la box avec les blocs fournis et maintenez son sommet complet jusqu’à la fin du décompte pour gagner une win. Les prisons disposent d’actions de libération."] : []),
      record.compatibilityNote || "La présence d’un logo indique où obtenir le jeu ; elle ne garantit pas encore la compatibilité du module avec chaque boutique.",
      tested ? "La validation indiquée concerne l’édition Xbox / Game Pass testée. Les autres éditions gardent leurs propres conditions de compatibilité." : "Les essais en jeu sont réservés à la seconde phase. Aucun abonnement à un autre logiciel n’est nécessaire pour les packs locaux finalisés."
    ], sources: []
  };
}

function connector(record, module) {
  if (!module) return { type: "demo" };
  const installer = module.installer || {};
  if (installer.minecraftServer) return { type: "minecraft-runtime" };
  return {
    type: installer.browserGame ? "websocket-server" : "tcp-server",
    ...(installer.browserGame ? { browserGame: true } : {}),
    ...(installer.helperGame ? { helperGame: true } : {}),
    ...(installer.remoteBrowserGame ? { remoteBrowserGame: true } : {}),
    ...(installer.localHttpGame ? { localHttpGame: true } : {}),
    ...(installer.fileGame ? { fileGame: installer.fileGame } : {}),
    host: "127.0.0.1", port: module.port,
    parameterOrderByCode: record.parameterOrderByCode,
    ...(installer.parameterFormat ? { parameterFormat: installer.parameterFormat } : {}),
    timeoutMs: 12000, durationMultiplier: module.durationMultiplier, expectResponse: true, launchConnectionTimeoutMs: 90000
  };
}

// Incomplete preparations remain in the private build inventory, outside the app catalog.
// Regenerating the inventory must never expose a game whose executable pack is missing.
const OWNER_INTEGRATIONS = records.filter(record =>
  ownerGameListed(record) && modules[record.id] &&
  record.effects.some(effect => effect.available !== false)
).map(record => {
  const module = modules[record.id], details = guide(record);
  return {
    ...game(record.id, record.name, {
      included: true, source: "ShenPulse", workspaceLayout: "shared", ownerOnly: true,
      artwork: record.artwork, storefronts: record.platforms, tags: ["inclus", "préparation privée"],
      ...(module?.installer?.minecraftServer ? { minecraftVersion: module.installer.minecraftVersion, serverAddress: "127.0.0.1:" + module.installer.minecraftServer.port } : {}),
      installerVersion: module?.version || "", interactionCatalogVersion: 2026103001,
      connector: connector(record, module), effects: artworkPack(record).effects,
      defaultMappings: defaults(record), description: details.summary
    }),
    catalogCategories: record.categories,
    ownerPreparation: { stage: record.stage, inGameValidation: module.inGameValidation || "pending", platformAvailabilityVerified: true },
    guide: details
  };
});
module.exports = { OWNER_INTEGRATIONS };
