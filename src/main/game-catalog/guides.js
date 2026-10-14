"use strict";

/** Catalogue de jeux : domaine « guides », données et identifiants conservés. */

const EXTERNAL_GUIDE_URLS = Object.freeze({
  "blue-prince": ["https://crowdcontrol.live/guides/blueprince/"],
  "hollow-knight-silksong": [
    "https://crowdcontrol.live/guides/hollowknightsilksong/",
    "https://streamtoearn.io/games/hollowknight-silksong"
  ],
  "hollow-knight": [
    "https://crowdcontrol.live/guides/hollowknight/",
    "https://streamtoearn.io/games/hollowknight"
  ],
  "supermarket-simulator": [
    "https://crowdcontrol.live/guides/supermarketsimulator/",
    "https://streamtoearn.io/games/supermarketsimulator"
  ],
  "egging-on": [
    "https://crowdcontrol.live/guides/eggingon/",
    "https://streamtoearn.io/games/eggingon"
  ],
  balatro: ["https://crowdcontrol.live/guides/balatro/"],
  celeste: ["https://crowdcontrol.live/guides/celeste/"],
  "dead-by-daylight": ["https://crowdcontrol.live/game/dead-by-daylight/"],
  "deep-rock-galactic": ["https://crowdcontrol.live/guides/deeprockgalactic/"],
  dredge: ["https://crowdcontrol.live/guides/dredge/"],
  "fallout-4": ["https://crowdcontrol.live/guides/fallout4/"],
  hades: ["https://crowdcontrol.live/guides/hades/"],
  inscryption: ["https://crowdcontrol.live/guides/inscryption/"],
  "no-mans-sky": ["https://crowdcontrol.live/game/no-mans-sky-2/"],
  palworld: ["https://crowdcontrol.live/guides/palworld/"],
  "resident-evil-7-biohazard": ["https://crowdcontrol.live/guides/residentevil7/"],
  "vampire-survivors": ["https://crowdcontrol.live/guides/vampiresurvivors/"],
  "ark-survival-ascended": ["https://crowdcontrol.live/game/ark-survival-ascended/"],
  "cities-skylines": ["https://crowdcontrol.live/guides/citiesskylines/"],
  "crash-bandicoot-n-sane-trilogy": [
    "https://crowdcontrol.live/guides/crashbandicootnsanetrilogy/"
  ],
  "kingdom-come-deliverance-2": [
    "https://crowdcontrol.live/guides/kingdomcomedeliverance2/"
  ],
  "deep-rock-galactic-survivor": [
    "https://streamtoearn.io/games/deep-rock-galactic-survivor"
  ],
  "hades-ii": ["https://streamtoearn.io/games/hades2"],
  "wobbly-life": ["https://streamtoearn.io/games/wobblylife"]
});

const GAME_GUIDES = Object.freeze({
  thiercelieux: integratedGuide(
    "La régie sociale est intégrée à ShenPulse avec des illustrations originales et sans contenu graphique officiel non autorisé.",
    [
      "Configurez le cadeau d’entrée et constituez la file LIVE.",
      "Installez jusqu’à huit joueurs, choisissez les extensions et le format portrait ou paysage.",
      "Distribuez les personnages en privé puis suivez le guide dynamique du maître du jeu."
    ]
  ),
  "coin-pusher": integratedGuide(
    "Le jeu est intégré à ShenPulse : aucune installation externe n’est nécessaire.",
    ["Configure les cadeaux et les valeurs des pièces.", "Teste le Plinko et le poussoir.", "Lance la fenêtre de jeu avant le LIVE."]
  ),
  "connect-four": integratedGuide(
    "Le jeu est intégré à ShenPulse : la grille et les équipes se configurent dans l’application.",
    ["Choisis la taille de grille et la condition de victoire.", "Associe les cadeaux aux équipes.", "Teste une manche avant le LIVE."]
  ),
  "deal-or-no-deal": integratedGuide(
    "Le plateau, le banquier et les boîtes sont inclus dans ShenPulse.",
    ["Règle les valeurs et le prix d’entrée.", "Configure les demandes du banquier.", "Ouvre la fenêtre hôte et teste une boîte."]
  ),
  "diamond-bridge": integratedGuide(
    "Le Pont des Diamants est inclus et ne modifie aucun autre jeu.",
    ["Règle le cadeau d’entrée.", "Configure l’aide et la file des joueurs.", "Teste les commandes du pont."]
  ),
  "diamond-drop": integratedGuide(
    "Diamond Drop Live s’exécute directement dans ShenPulse.",
    ["Configure les coûts et multiplicateurs.", "Associe les interactions TikTok.", "Lance une partie de test."]
  ),
  "color-strike": {
    mode: "native",
    summary:
      "La version autonome ShenPulse de Color Strike expose ses interactions uniquement en local sur le port 7444.",
    journey: ["installation", "interactions", "overlays", "launch"],
    steps: [
      "Dans Installation, lance le téléchargement et l’installation automatiques depuis ShenPulse.",
      "Vérifie ou personnalise les cadeaux déjà associés aux interactions Color Strike.",
      "Clique sur Lancer puis commence une partie dans Color Strike.",
      "Vérifie la connexion locale avant d’activer la session LIVE."
    ],
    notes: [
      "Le jeu ne demande ni ticket, ni launcher externe, ni connexion aux anciennes API.",
      "ShenPulse communique uniquement avec 127.0.0.1:7444 ; le jeu et ShenPulse doivent rester ouverts.",
      "Les cadeaux, likes, follows, partages et la commande !spin de la configuration par défaut sont actifs dès l’initialisation."
    ],
    sources: []
  },
  "tiklive-climb": {
    mode: "native",
    summary:
      "La version autonome ShenPulse de Climb expose ses interactions uniquement en local sur le port 7777.",
    journey: ["installation", "interactions", "overlays", "launch"],
    steps: [
      "Dans Installation, lance le téléchargement et l’installation automatiques depuis ShenPulse.",
      "Vérifie ou personnalise les cadeaux déjà associés aux interactions Climb.",
      "Clique sur Lancer puis commence une ascension dans Climb.",
      "Vérifie la connexion locale avant d’activer la session LIVE."
    ],
    notes: [
      "Le jeu ne demande ni ticket, ni launcher externe, ni connexion aux anciennes API.",
      "ShenPulse communique uniquement avec 127.0.0.1:7777 ; le jeu et ShenPulse doivent rester ouverts.",
      "Les cadeaux, likes, follows, partages et la commande !spin de la configuration par défaut sont actifs dès l’initialisation."
    ],
    sources: []
  },
  "tiklive-cube-wars": {
    mode: "native",
    summary:
      "La version autonome ShenPulse de Cube Wars expose ses interactions uniquement en local sur le port 7811.",
    journey: ["installation", "interactions", "overlays", "launch"],
    steps: [
      "Dans Installation, lance le téléchargement et l’installation automatiques depuis ShenPulse.",
      "Vérifie ou personnalise les cadeaux associés aux camps Hommes et Femmes.",
      "Clique sur Lancer, démarre une manche, puis les viewers choisissent H ou F dans le chat.",
      "Vérifie la connexion locale avant d’activer la session LIVE."
    ],
    notes: [
      "Le jeu ne demande ni ticket, ni launcher externe, ni connexion aux anciennes API.",
      "ShenPulse communique uniquement avec 127.0.0.1:7811 ; le jeu et ShenPulse doivent rester ouverts.",
      "Les cadeaux, likes, follows, partages, les commandes H/F et !spin de la configuration par défaut sont actifs dès l’initialisation."
    ],
    sources: []
  },
  "tiklive-stack-tower": {
    mode: "native",
    summary:
      "La version autonome ShenPulse de Stack Tower expose ses interactions uniquement en local sur le port 7817.",
    journey: ["installation", "interactions", "overlays", "launch"],
    steps: [
      "Dans Installation, lance le téléchargement et l’installation automatiques depuis ShenPulse.",
      "Vérifie ou personnalise les cadeaux déjà associés aux aides, sabotages et WINS de Stack Tower.",
      "Clique sur Lancer, commence la construction et tente d’atteindre les 500 étages.",
      "Vérifie la connexion locale avant d’activer la session LIVE."
    ],
    notes: [
      "Le jeu ne demande ni ticket, ni launcher externe, ni connexion aux anciennes API.",
      "ShenPulse communique uniquement avec 127.0.0.1:7817 ; le jeu et ShenPulse doivent rester ouverts.",
      "Les 31 cadeaux TikLive, le tap-tap, le follow, le partage et la commande !spin sont préconfigurés dès l’initialisation."
    ],
    sources: []
  },
  "clash-of-live": {
    mode: "native",
    summary:
      "La version autonome Clash Of ShenPulse expose ses interactions uniquement en local sur le port 4244.",
    journey: ["installation", "interactions", "overlays", "launch"],
    steps: [
      "Dans Installation, lance le téléchargement et l’installation automatiques depuis ShenPulse.",
      "Vérifie ou personnalise les cadeaux déjà associés aux renforts rouges et bleus.",
      "Clique sur Lancer puis démarre une partie dans Clash Of ShenPulse.",
      "Vérifie la connexion locale avant d’activer la session LIVE."
    ],
    notes: [
      "Le jeu ne demande ni licence, ni launcher externe, ni connexion aux anciennes API.",
      "ShenPulse communique uniquement avec 127.0.0.1:4244 ; le jeu et ShenPulse doivent rester ouverts.",
      "Les cadeaux, likes, follows, partages et la commande !spin de la configuration par défaut sont actifs dès l’initialisation."
    ],
    sources: []
  },
  "pokemon-red-blue": {
    mode: "emulator",
    summary: "ShenPulse installe BizHawk, Pokémon Rouge et le pack d’interactions dans un environnement prêt à jouer.",
    steps: [
      "Clique sur Installer : BizHawk, Pokémon Rouge, le client et le pack sont téléchargés automatiquement.",
      "ShenPulse vérifie la ROM et applique automatiquement le correctif d’interactions.",
      "Configure les interactions TikTok que tu souhaites utiliser.",
      "Clique sur Lancer pour ouvrir directement la ROM dans BizHawk avec le connecteur actif."
    ],
    notes: [
      "Aucun fichier supplémentaire n’est demandé à l’utilisateur.",
      "Garde BizHawk, le client local et ShenPulse ouverts pendant le LIVE."
    ],
    sources: [
      {
        label: "Guide officiel Crowd Control · Pokémon Rouge/Bleu",
        url: "https://crowdcontrol.live/guides/pokemonredblue"
      }
    ]
  },
  "super-mario-kart": {
    mode: "emulator",
    summary:
      "ShenPulse installe BizHawk, Super Mario Kart et le pack de 87 interactions dans un environnement prêt à jouer.",
    steps: [
      "Clique sur Installer : BizHawk, Super Mario Kart, le client et le pack sont téléchargés automatiquement.",
      "ShenPulse vérifie l’empreinte de la ROM USA incluse.",
      "Configure les interactions TikTok que tu souhaites utiliser.",
      "Clique sur Lancer pour ouvrir directement la ROM dans BizHawk avec le connecteur actif."
    ],
    notes: [
      "Aucun fichier supplémentaire n’est demandé à l’utilisateur.",
      "Garde BizHawk, le client local et ShenPulse ouverts pendant le LIVE."
    ],
    sources: [
      {
        label: "Guide officiel Crowd Control · Super Mario Kart",
        url: "https://crowdcontrol.live/guides/supermariokart"
      }
    ]
  },
  fortnite: {
    mode: "input",
    summary:
      "Aucun mod n’est installé : ShenPulse reproduit les séquences clavier du pack Fortnite officiel de Crowd Control dans la fenêtre du jeu.",
    steps: [
      "Lance Fortnite sur PC et charge une partie jouable.",
      "Conserve les touches clavier standard attendues par le pack Crowd Control.",
      "Configure les interactions puis teste-les pendant que Fortnite est ouvert.",
      "Active la session de jeu avant le LIVE."
    ],
    notes: [
      "ShenPulse refuse l’envoi si le processus Fortnite exact n’est pas ouvert.",
      "Les effets ciblent uniquement FortniteClient-Win64-Shipping.exe et ne modifient aucun fichier du jeu.",
      "Les commandes dépendent des touches standard du pack : ZQSD/WASD, Maj, Espace, Ctrl, R, B, M et 1 à 5."
    ],
    sources: [
      {
        label: "Pack Fortnite Crowd Control",
        url: "https://crowdcontrol.live/game/fortnite/"
      },
      {
        label: "Guide officiel des Input Disrupts",
        url: "https://crowdcontrol.live/guides/disrupts"
      }
    ]
  },
  "rocket-league": {
    mode: "input",
    summary:
      "Aucun mod n’est installé : ShenPulse envoie les commandes clavier et souris directement à la fenêtre Rocket League.",
    steps: [
      "Lance Rocket League sur PC et entre dans une partie jouable.",
      "Choisis la disposition WASD ou ZQSD et conserve les touches indiquées par ShenPulse.",
      "Démarre la session, puis ajoute les interactions TikTok souhaitées.",
      "Teste chaque interaction pendant que la fenêtre Rocket League est ouverte."
    ],
    notes: [
      "Aucun fichier du jeu n’est téléchargé ni modifié.",
      "Les commandes ciblent uniquement RocketLeague.exe et s’arrêtent si cette fenêtre n’est plus disponible.",
      "Les touches attendues sont : WASD ou ZQSD pour conduire, Ctrl pour déraper, Espace pour la caméra ballon, Tab pour le score, clic gauche pour le turbo et clic droit pour sauter.",
      "Le mode plein écran sans bordure ou fenêtré facilite le retour au premier plan pendant les tests."
    ],
    sources: []
  },
  demonologist: {
    mode: "input",
    summary:
      "Aucun mod n’est requis : ShenPulse reproduit les séquences clavier et souris du pack Demonologist officiel de Crowd Control dans la fenêtre du jeu.",
    journey: ["installation", "interactions", "overlays", "launch"],
    steps: [
      "Lance Demonologist depuis Steam et charge une partie.",
      "Choisis le clavier WASD ou ZQSD puis vérifie que ShenPulse détecte la fenêtre du jeu.",
      "Configure les cadeaux TikTok sur les 31 interactions disponibles.",
      "Active la session ShenPulse en gardant Demonologist au premier plan."
    ],
    notes: [
      "Aucun fichier du jeu n’est téléchargé ni modifié.",
      "Les commandes sont envoyées uniquement à la fenêtre de jeu Demonologist (Shivers-Win64-Shipping.exe) et s’arrêtent si elle ne peut plus être ciblée.",
      "La Démo Steam n’expose qu’une partie des commandes dans ses réglages. ShenPulse conserve néanmoins les 31 interactions pour les utilisateurs de la version complète.",
      "Le pack officiel recommande le plein écran sans bordure ou le mode fenêtré."
    ],
    sources: [
      {
        label: "Guide officiel Crowd Control · Input Disrupts",
        url: "https://crowdcontrol.live/guides/disrupts"
      },
      {
        label: "Catalogue officiel Demonologist",
        url: "https://crowdcontrol.live/games/demonologist"
      }
    ]
  },
  "euro-truck-simulator-2": {
    mode: "crowd-control-mod",
    summary:
      "Le plugin local Euro Truck Simulator 2 se connecte à ShenPulse sur le port 51337 et reçoit les interactions TikTok LIVE configurées.",
    journey: ["installation", "interactions", "overlays", "launch"],
    steps: [
      "Laisse ShenPulse détecter Euro Truck Simulator 2 et installer automatiquement le plugin officiel Crowd Control.",
      "Ferme Crowd Control pour libérer le port local 51337, puis configure les cadeaux dans ShenPulse.",
      "Prépare si besoin la fiche d’interactions pour ton overlay LIVE.",
      "Lance Euro Truck Simulator 2 sur Steam, charge une partie puis active la session ShenPulse."
    ],
    notes: [
      "Le pack officiel a été testé avec la version Steam du jeu.",
      "Le mode Convoy n’est pas officiellement validé et certains effets peuvent ne pas fonctionner en multijoueur.",
      "Teste toujours quelques interactions dans une sauvegarde chargée avant le LIVE."
    ],
    sources: [
      {
        label: "Guide officiel Crowd Control · Euro Truck Simulator 2",
        url: "https://crowdcontrol.live/guides/eurotrucksimulator2"
      },
      {
        label: "Catalogue officiel des interactions",
        url: "https://crowdcontrol.live/games/eurotrucksimulator2"
      }
    ]
  },
  "resident-evil-3": {
    mode: "native",
    summary:
      "ShenPulse détecte Resident Evil 3, installe automatiquement REFramework et le mod d’interactions officiel, puis reçoit les cadeaux TikTok LIVE sur le port local 58431.",
    journey: ["installation", "interactions", "overlays", "launch"],
    steps: [
      "Ferme Resident Evil 3, puis laisse ShenPulse détecter son dossier Steam et installer le mod officiel recommandé.",
      "Associe les cadeaux TikTok aux interactions souhaitées dans ShenPulse.",
      "Prépare si besoin la fiche d’interactions destinée à ton overlay LIVE.",
      "Lance Resident Evil 3 depuis ShenPulse, charge une sauvegarde jouable puis teste un effet."
    ],
    notes: [
      "L’installation recommandée cible la version actuelle de Resident Evil 3 ; l’ancienne branche dx11_non-rt n’est pas sélectionnée automatiquement.",
      "Le bouton Installation ajoute automatiquement le runtime Bureau .NET 8 officiel s’il manque.",
      "Si Crowd Control utilise déjà le port 58431, ShenPulse ferme uniquement ses processus locaux avant d’activer la session Resident Evil 3.",
      "Un test manuel remet automatiquement Resident Evil 3 au premier plan avant d’envoyer l’effet. Le jeu doit néanmoins être dans une partie jouable, hors menu, cinématique et chargement.",
      "Certains effets dépendent du personnage, de l’inventaire, des ennemis présents ou de la progression. Ils peuvent être temporairement indisponibles dans un menu, une cinématique ou un chargement.",
      "La touche Inser ouvre le menu REFramework dans le jeu si un diagnostic est nécessaire."
    ],
    sources: [
      {
        label: "Guide officiel Crowd Control · Resident Evil 3",
        url: "https://crowdcontrol.live/guides/residentevil3?pack=ResidentEvil3"
      },
      {
        label: "Catalogue officiel Resident Evil 3",
        url: "https://crowdcontrol.live/games/residentevil3"
      }
    ]
  },
  "gtav-montchiliad": {
    mode: "native",
    summary: "ShenPulse installe, prépare et lance GTA V Mont Chiliad avec un parcours simple en quatre étapes.",
    steps: [
      "Fermez GTA V avant de commencer.",
      "Laissez ShenPulse détecter et préparer automatiquement le jeu.",
      "Choisissez les interactions et les overlays souhaités.",
      "Lancez le jeu puis chargez votre partie."
    ],
    notes: [
      "ShenPulse conserve automatiquement une copie de sécurité.",
      "Si le jeu n’est pas trouvé, choisissez simplement son dossier."
    ],
    sources: []
  },
  "minecraft-bedrock-box": managedMinecraftGuide(
    "Installe le serveur local et le monde Bedrock Box, puis rejoins 127.0.0.1."
  ),
  "minecraft-sandbox-3": managedMinecraftGuide(
    "Installe le serveur local SandBox 3 et ses plugins, puis rejoins 127.0.0.1."
  ),
  "minecraft-survival-plugin": managedMinecraftGuide(
    "Installe automatiquement PaperMC, Java 21 et le plugin Survival, puis rejoins 127.0.0.1 en mode survie.",
    [
      {
        label: "Catalogue officiel StreamToEarn · Survival",
        url: "https://streamtoearn.io/plugins/s2e-survival-plugin"
      }
    ]
  ),
  "cult-of-the-lamb": modGuide(
    "ShenPulse détecte Cult of the Lamb, installe BepInEx et son pont local, puis charge les interactions historiques du pack."
  ),
  "stardew-valley": modGuide(
    "Installe SMAPI, ajoute le mod d’interactions puis lance Stardew Valley via SMAPI."
  ),
  terraria: modGuide(
    "Installe tModLoader, ajoute le mod d’interactions et démarre une partie locale."
  )
});

function integratedGuide(summary, steps) {
  return {
    mode: "integrated",
    summary,
    steps,
    notes: ["Aucun fichier n’est copié dans un jeu tiers."],
    sources: []
  };
}

function minecraftGuide(summary) {
  return {
    mode: "server",
    summary,
    steps: [
      "Installe Java 17 ou une version compatible avec le serveur.",
      "Prépare le monde, server.properties et les plugins du pack.",
      "Démarre le serveur local et rejoins 127.0.0.1 dans Minecraft.",
      "Vérifie la passerelle, active les interactions et teste un effet."
    ],
    notes: [
      "Conserve ShenPulse et le serveur ouverts pendant le LIVE.",
      "Le port du serveur et celui de la passerelle doivent rester disponibles."
    ],
    sources: []
  };
}

function managedMinecraftGuide(summary, sources = []) {
  return {
    mode: "server",
    summary,
    steps: [
      "Clique sur Installer et accepte le CLUF Minecraft.",
      "Laisse ShenPulse installer Java 21, PaperMC, le monde et les plugins.",
      "Attends que le serveur local soit prêt sur 127.0.0.1.",
      "Ouvre Minecraft, rejoins 127.0.0.1 et active les interactions."
    ],
    notes: [
      "Aucun dossier serveur ni Java déjà installé n’est nécessaire.",
      "Conserve ShenPulse ouvert pendant le LIVE."
    ],
    sources
  };
}

function modGuide(summary) {
  return {
    mode: "native",
    summary,
    steps: [
      "Ferme le jeu avant de modifier son dossier.",
      "Sélectionne ou détecte le dossier d’installation.",
      "Installe le mod et sa passerelle locale en conservant une sauvegarde.",
      "Lance le jeu, charge une partie et teste un effet."
    ],
    notes: [
      "La version du mod doit correspondre à la version installée du jeu.",
      "Retire les autres mods pour le premier test si un conflit apparaît."
    ],
    sources: []
  };
}

function buildGameGuide(entry, effects) {
  const specialized = GAME_GUIDES[entry.id];
  if (specialized) return structuredClone(specialized);
  const sources = (EXTERNAL_GUIDE_URLS[entry.id] || []).map((url) => ({
    label: url.includes("streamtoearn.io")
      ? "Référence de compatibilité StreamToEarn"
      : "Guide du pack Crowd Control",
    url
  }));
  const native = effects.some((effect) => effect.available);
  const compatibilityNotes = {
    "hollow-knight": "Le patch actuel peut être incompatible : utilise la branche historique prise en charge.",
    "supermarket-simulator": "La mise à jour coopérative actuelle peut nécessiter une ancienne version prise en charge.",
    hades: "La version Microsoft Store/Game Pass peut limiter les mods : valide le pack localement.",
    "vampire-survivors": "Cette intégration cible une ancienne version du jeu.",
    "crash-bandicoot-n-sane-trilogy": "La compatibilité du mod est partielle et doit être validée localement."
  };
  return {
    mode: native ? "native" : "reference",
    summary: native
      ? `ShenPulse pilote le pack local de ${entry.name} par la passerelle de jeu.`
      : `La fiche reprend les interactions référencées pour ${entry.name} ; les éléments visuels restent signalés tant qu’aucun pack local exécutable n’est installé.`,
    steps: [
      "Installe le jeu depuis sa boutique officielle et lance-le une première fois.",
      "Ouvre ShenPulse, sélectionne le jeu puis configure ou détecte sa passerelle locale.",
      "Installe le pack compatible avec la version exacte du jeu en suivant le guide lié.",
      "Charge une sauvegarde jouable et teste plusieurs interactions avant le LIVE."
    ],
    notes: [
      compatibilityNotes[entry.id] ||
        "Désactive les autres mods pour le premier test et conserve une sauvegarde des fichiers remplacés.",
      native
        ? "Les interactions marquées Natif peuvent être envoyées à la passerelle locale."
        : "Les interactions marquées Référence ne déclenchent aucun code tant qu’un pack natif n’est pas disponible."
    ],
    sources
  };
}

module.exports = { EXTERNAL_GUIDE_URLS, GAME_GUIDES, integratedGuide, minecraftGuide, managedMinecraftGuide, modGuide, buildGameGuide };

