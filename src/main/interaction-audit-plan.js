"use strict";

const INTERACTION_AUDIT_PLANS = Object.freeze({
  "cult-of-the-lamb": [
    "cult-take-hp",
    "cult-add-hp",
    "cult-custom-hearts",
    "cult-take-custom-heart",
    "cult-give-item",
    "cult-wipe-resources",
    "cult-cc-lose-faith",
    "cult-cc-increase-faith",
    "cult-speed-up",
    "cult-slow-down",
    "cult-add-follower",
    "cult-cc-resurrect-follower",
    "cult-cc-break-building",
    "cult-cc-spawn-enemies",
    "cult-freeze-enemies",
    "cult-invincible",
    "cult-cc-poison-lamb",
    "cult-set-weapon",
    "cult-cc-give-tarot",
    "cult-spell-goop",
    "cult-spell-mega-slash",
    "cult-spell-fireball",
    "cult-spell-tentacles",
    "cult-spell-barrier",
    "cult-kill-all-enemies",
    "cult-spell-teleport",
    "cult-move-up-room",
    "cult-move-down-room",
    "cult-move-left-room",
    "cult-move-right-room",
    "cult-cc-return-base",
    "cult-kill"
  ],
  "stardew-valley": [
    "stardew-hurt",
    "stardew-heal",
    "stardew-energy-drain",
    "stardew-energy-restore",
    "stardew-give-money",
    "stardew-take-money",
    "stardew-give-item",
    "stardew-spawn-mob",
    "stardew-immortality",
    "stardew-frozen",
    "stardew-slimed",
    "stardew-darkness",
    "stardew-nauseous",
    "stardew-tipsy",
    "stardew-adrenaline-rush",
    "stardew-warp",
    "stardew-random-hair-style",
    "stardew-axe-downgrade",
    "stardew-axe-upgrade",
    "stardew-pickaxe-downgrade",
    "stardew-pickaxe-upgrade",
    "stardew-hoe-downgrade",
    "stardew-hoe-upgrade",
    "stardew-watering-can-downgrade",
    "stardew-watering-can-upgrade",
    "stardew-fishing-rod-downgrade",
    "stardew-fishing-rod-upgrade",
    "stardew-instant-kill"
  ],
  terraria: [
    "terraria-decrease-hp",
    "terraria-increase-hp",
    "terraria-give-item",
    "terraria-spawn-entity",
    "terraria-spawn-random-npc",
    "terraria-random-slime",
    "terraria-spawn-friendly-bees",
    "terraria-web-trap",
    "terraria-sand-trap",
    "terraria-blind",
    "terraria-confuse",
    "terraria-freeze",
    "terraria-gravitation",
    "terraria-spelunker",
    "terraria-shimmer",
    "terraria-ghost",
    "terraria-rainbow",
    "terraria-shake-screen",
    "terraria-bombs-rain",
    "terraria-dynamite",
    "terraria-random-teleport",
    "terraria-summon-event",
    "terraria-all-bosses",
    "terraria-boss-run",
    "terraria-spawn-boss"
  ]
});

const INTERACTION_AUDIT_PREPARATIONS = Object.freeze({
  "cult-take-hp":
    "Chargez votre sauvegarde jusqu’à pouvoir contrôler l’agneau. La campagne commencera par retirer de la vie, puis testera immédiatement le soin inverse.",
  "cult-wipe-resources":
    "Attention : ce test met réellement à zéro les principales ressources de cette sauvegarde. Continuez seulement lorsque vous êtes prêt à constater cette perte.",
  "cult-speed-up":
    "Chargez votre sauvegarde jusqu’à pouvoir déplacer librement l’agneau. Le monde et les animations doivent ensuite tourner deux fois plus vite pendant dix secondes.",
  "cult-add-follower":
    "Revenez au village du culte et attendez de pouvoir déplacer librement l’agneau. Le nouveau fidèle doit apparaître près de lui.",
  "cult-cc-resurrect-follower":
    "Un fidèle mort doit être disponible dans cette sauvegarde pour vérifier sa résurrection.",
  "cult-cc-break-building":
    "Revenez au culte et assurez-vous qu’un bâtiment compatible peut être détruit. Ce test modifie réellement la sauvegarde.",
  "cult-cc-spawn-enemies":
    "Démarrez une croisade et entrez dans une salle où des ennemis peuvent apparaître. Les tests de combat suivants s’enchaîneront ensuite automatiquement.",
  "cult-move-up-room":
    "Placez l’agneau dans une salle de croisade possédant une salle accessible au-dessus, puis attendez la fin de tout chargement.",
  "cult-move-down-room":
    "Placez l’agneau dans une salle de croisade possédant une salle accessible en dessous, puis attendez la fin de tout chargement.",
  "cult-move-left-room":
    "Placez l’agneau dans une salle de croisade possédant une salle accessible à gauche, puis attendez la fin de tout chargement.",
  "cult-move-right-room":
    "Placez l’agneau dans une salle de croisade possédant une salle accessible à droite, puis attendez la fin de tout chargement.",
  "cult-kill":
    "Restez dans une salle de croisade active où l’agneau peut recevoir des dégâts. Cette interaction doit l’éliminer immédiatement.",
  "cult-cc-return-base":
    "Démarrez ou reprenez une croisade, puis attendez que la salle soit complètement chargée avant de tester le retour au culte.",
  "stardew-axe-downgrade":
    "Gardez la hache, la pioche, la houe, l’arrosoir et la canne à pêche disponibles. Chaque rétrogradation sera suivie de l’amélioration inverse.",
  "stardew-hurt":
    "Chargez votre sauvegarde jusqu’à pouvoir déplacer le personnage. La campagne commencera par infliger des dégâts, puis testera immédiatement le soin.",
  "terraria-decrease-hp":
    "Chargez un personnage et entrez complètement dans un monde. La campagne commencera par retirer de la vie, puis testera immédiatement le soin inverse.",
  "terraria-all-bosses":
    "Placez le personnage dans une zone ouverte d’un monde chargé. Les trois commandes de boss seront ensuite testées à la suite."
});

function orderInteractionAuditEffects(gameId, effects) {
  const byId = new Map(
    effects.map((effect) => [String(effect.id || ""), effect])
  );
  const ordered = [];
  for (const effectId of INTERACTION_AUDIT_PLANS[gameId] || []) {
    const effect = byId.get(effectId);
    if (!effect) continue;
    ordered.push({
      effect,
      preparation: INTERACTION_AUDIT_PREPARATIONS[effect.id] || ""
    });
    byId.delete(effectId);
  }
  for (const effect of effects) {
    if (!byId.has(effect.id)) continue;
    ordered.push({
      effect,
      preparation: INTERACTION_AUDIT_PREPARATIONS[effect.id] || ""
    });
    byId.delete(effect.id);
  }
  return ordered;
}

module.exports = {
  INTERACTION_AUDIT_PLANS,
  INTERACTION_AUDIT_PREPARATIONS,
  orderInteractionAuditEffects
};
