"use strict";
module.exports = {
  mode: "native",
  summary: "ShenPulse installe son module local dans l’édition de Palworld choisie.",
  journey: ["installation", "interactions", "overlays", "launch"],
  steps: [
    "Installez Palworld depuis Steam ou Xbox / Game Pass, lancez-le une première fois puis fermez-le.",
    "Cliquez sur Installer automatiquement et choisissez l’édition à utiliser. ShenPulse télécharge le pack depuis Backblaze, vérifie son intégrité et sauvegarde les fichiers remplacés.",
    "Personnalisez les six aides et les six pièges proposés : cadeaux, durées et quantités. Les autres effets restent disponibles à l’ajout.",
    "Choisissez l’affichage des cadeaux et installez-le dans votre studio, puis cliquez sur Lancer le jeu.",
    "Chargez un monde solo, attendez que le personnage soit contrôlable et fermez les menus avant les essais."
  ],
  notes: [
    "Le lancement réutilise l’édition mémorisée lors de l’installation. Si l’autre édition est ouverte, fermez-la avant de continuer.",
    "Le jeu et ShenPulse doivent rester ouverts sur le même PC. Aucun raccourci clavier particulier n’est nécessaire.",
    "Les serveurs publics, le multijoueur et les cinématiques ne sont pas pris en charge.",
    "Les effets de taille des Pals demandent des Pals présents près du joueur. Les captures demandent une sphère et une cible capturable.",
    "Les raids nécessitent une base construite et les invasions autorisées dans les règles du monde. Les événements de largage nécessitent une zone compatible.",
    "Les effets temporaires reviennent à leur valeur initiale à leur expiration. Les ressources, l’expérience, les apparitions et la mort peuvent être sauvegardées par le jeu : utilisez un monde d’essai pour les premiers tests.",
    "La réapparition demande un personnage K.-O. Les autres effets sont refusés pendant la mort ou lorsque les menus bloquent le contrôle."
  ],
  sources: []
};
