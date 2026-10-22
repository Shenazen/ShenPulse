"use strict";

const journey = ["installation", "interactions", "overlays", "launch"];
const common = ["Associe tes cadeaux ou autres déclencheurs aux interactions souhaitées.", "Génère les fiches de tes interactions dans l’étape Overlays puis ajoute-les à ton logiciel de LIVE."];

module.exports = {
  "dead-by-daylight": {
    mode: "input", journey,
    summary: "20 interactions ShenPulse, avec détection Steam et Xbox Game Pass.",
    requirements: [
      "Terminez l’étape Survival Tutorial (tutoriel du survivant).",
      "Terminez l’étape Killer Tutorial (tutoriel du tueur).",
      "Pour les essais, démarrez une partie avec des bots après les tutoriels. Choisissez les interactions correspondant à votre rôle, survivant ou tueur."
    ],
    steps: ["Dans Installation, choisis WASD, ZQSD ou ZSQD selon les commandes de ton rôle, puis prépare les interactions en confirmant le dossier détecté.", ...common, "Lance Dead by Daylight, entre dans une partie d’essai avec le rôle adapté, puis teste les commandes."],
    notes: [
      "Les interactions utilisent les commandes clavier et souris par défaut. Choisis WASD, ZQSD ou ZSQD selon les déplacements du rôle joué ; les autres touches doivent correspondre aux réglages du jeu. Si tes deux rôles ont des déplacements différents, adapte ce choix en changeant de rôle.",
      "Si les gestes 1 / 2 ne répondent pas sur ton clavier, choisis P / O dans Installation et associe « Désigner » à P et « Suivez-moi / Venez ici » à O dans les commandes du survivant du jeu.",
      "Les catégories indiquent le rôle survivant ou tueur. Les actions dépendent du rôle, de la cible, de l’objet et de la situation. Ferme le chat et les menus avant de tester.",
      "Aucun mod n’est installé dans le jeu. ShenPulse cible la fenêtre de l’édition préparée et la place au premier plan avant l’envoi.",
      "Les overlays générés par ShenPulse présentent tes associations de cadeaux. Ces 20 interactions agissent sur les commandes du joueur ; aucun filtre vidéo n’est inclus."
    ],
    sources: [{ label: "Pack officiel Dead by Daylight", url: "https://open-api.crowdcontrol.live/games/DeadbyDaylight/packs" }, { label: "Documentation technique des commandes", url: "https://crowdcontrol.live/guides/disrupts" }]
  },
  dredge: {
    mode: "native", journey,
    summary: "ShenPulse installe BepInEx et le module officiel DREDGE Steam ou Xbox Game Pass, puis prépare la connexion locale au lancement.",
    steps: ["Ferme DREDGE et clique sur Installer automatiquement. Confirme le dossier détecté.", ...common, "Lance DREDGE depuis ShenPulse, charge une sauvegarde d’essai et quitte le quai avant de tester."],
    notes: [
      "Les interactions attendent que le bateau soit en mer, hors pêche et menus de cargaison. Certains effets demandent des ressources ou un emplacement libre.",
      "Les durées des effets temporaires sont configurables. Les apparitions et objets peuvent dépendre de ta progression ou des DLC.",
      "Les 53 anciens identifiants restent conservés ; les anciens effets d’argent et d’objets utilisent désormais les codes du module officiel.",
      "« Retirer les monstres proches » reste indisponible : le module officiel ne l’enregistre pas dans son moteur.",
      "Les effets de destruction ou de cargaison modifient réellement la partie. Utilise une sauvegarde d’essai. Garde ShenPulse ouvert pendant le LIVE."
    ],
    sources: [{ label: "Packs officiels Steam et Game Pass", url: "https://open-api.crowdcontrol.live/games/Dredge/packs" }, { label: "Guide officiel DREDGE", url: "https://crowdcontrol.live/guides/dredge" }]
  },
  "egging-on": {
    mode: "native", journey,
    summary: "ShenPulse installe MelonLoader et le module officiel Egging On dans le dossier du jeu.",
    steps: ["Ferme Egging On et clique sur Installer automatiquement. Confirme le dossier détecté.", ...common, "Lance Egging On depuis ShenPulse, attends le chargement du mod puis reprends une partie pour tester."],
    notes: [
      "Le module d’interactions utilisé par ShenPulse cible l’édition Steam. La compatibilité Game Pass doit être vérifiée sur le PC ; le dossier XboxGames doit être modifiable.",
      "Les 37 anciens identifiants sont conservés. Les 35 effets publics et les deux narrations supplémentaires présentes dans le module sont proposés.",
      "Les effets de vitesse, saut, taille, caméra et gravité ont une durée configurable. Certains effets dépendent de la progression et de l’état de l’œuf.",
      "Le premier lancement prépare MelonLoader. Si le jeu est installé dans WindowsApps, utilise l’application Xbox pour le déplacer vers XboxGames.",
      "Utilise une partie d’essai pour les effets de retour au départ et de destruction. Garde ShenPulse ouvert pendant le LIVE."
    ],
    sources: [{ label: "Guide officiel Egging On", url: "https://crowdcontrol.live/guides/eggingon" }, { label: "Pack officiel Egging On", url: "https://open-api.crowdcontrol.live/games/EggingOn/packs" }]
  },
  "fallout-4": {
    mode: "native", journey,
    summary: "298 interactions pour l’édition Steam 1.11.240, avec les six DLC et F4SE 0.7.9. L’édition Xbox / Game Pass est incompatible avec F4SE.",
    steps: [
      "Installe Fallout 4 Steam 1.11.240 et ses six DLC (le Creations Bundle n’est pas requis). Installe F4SE 0.7.9 depuis son site officiel.",
      "Ferme le jeu, puis clique sur Installer automatiquement. ShenPulse vérifie l’édition, les DLC et F4SE avant de télécharger le module.",
      ...common,
      "Lance depuis ShenPulse via F4SE. Active le module d’interactions installé par ShenPulse dans le menu CREATIONS, puis charge une sauvegarde après la sortie de l’Abri 111."
    ],
    notes: [
      "L’installation Game Pass est refusée avant toute copie. Le module officiel ne peut pas fonctionner avec cette édition.",
      "F4SE se télécharge depuis le site de ses auteurs (lien Nexus). ShenPulse ne remplace pas cet installateur tiers.",
      "ShenPulse installe le module d’interactions, son archive et le plugin F4SE en sauvegardant les fichiers remplacés. Les autres mods et leur ordre de chargement sont conservés.",
      "Les effets ne fonctionnent pas pendant le prologue, les chargements ou les menus. Certains demandent une cible ou des ressources disponibles.",
      "Les noms d’objets officiels sont conservés pour les reconnaître. Utilise une sauvegarde d’essai et garde ShenPulse ouvert pendant le LIVE."
    ],
    sources: [{ label: "Guide officiel Fallout 4", url: "https://crowdcontrol.live/guides/fallout4" }, { label: "F4SE et compatibilité", url: "https://f4se.silverlock.org/" }]
  }
};
