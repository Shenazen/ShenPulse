/* Rangs ShenPulse : repères de contribution cumulée, indépendants des plateformes. */
(function exposeViewerRanks(root, factory) {
  "use strict";
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.ShenPulseViewerRanks = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function createViewerRanks() {
  "use strict";
  // Barème partagé par le moteur et l'interface. La contribution cumulée est
  // conservée, jamais remplacée par le libellé du rang. Les paliers existants
  // restent inchangés tant qu'un nouveau barème n'a pas été confirmé.
  // Aucun rang n'accorde de droit ni ne représente le niveau TikTok du viewer.
  const numberFormat = new Intl.NumberFormat("fr-FR");
  const ranks = Object.freeze([
    { id: "new", label: "Nouveau", icon: "🌱", minimum: 0, color: "#9ca3ba" },
    { id: "fan", label: "Fan", icon: "🔰", minimum: 1, color: "#4ade80" },
    { id: "supporter", label: "Supporter", icon: "💙", minimum: 10, color: "#60a5fa" },
    { id: "active", label: "Actif", icon: "⭐", minimum: 50, color: "#a78bfa" },
    { id: "loyal", label: "Fidèle", icon: "💎", minimum: 100, color: "#22d3ee" },
    { id: "vip", label: "VIP", icon: "🏆", minimum: 500, color: "#fbbf24" },
    { id: "legend", label: "Légende", icon: "👑", minimum: 1000, color: "#f87171" },
    { id: "mythic", label: "Mythique", icon: "🌟", minimum: 5000, color: "#e879f9" },
    { id: "divine", label: "Divin", icon: "🔱", minimum: 10000, color: "#facc15" },
    { id: "cosmic", label: "Cosmique", icon: "🌌", minimum: 50000, color: "#c4b5fd" },
    { id: "immortal", label: "Immortel", icon: "☄️", minimum: 100000, color: "#facc15" }
  ].map((rank) => Object.freeze(rank)));

  /** Même domaine que les compteurs persistés : entier fini et non négatif. */
  function contributionCount(value) {
    const numeric = typeof value === "number" || typeof value === "string" ? Number(value) : NaN;
    return Number.isFinite(numeric) ? Math.min(Number.MAX_SAFE_INTEGER, Math.max(0, Math.floor(numeric))) : 0;
  }

  function rankForDiamonds(value) {
    const count = contributionCount(value);
    for (let index = ranks.length - 1; index >= 0; index -= 1) {
      if (count >= ranks[index].minimum) return ranks[index];
    }
    return ranks[0];
  }

  /** Progression dans le palier courant, calculée sans toucher à l'historique.
   * Les minima restent la seule source du rang et du prochain objectif. Le
   * dernier rang est terminal : pas de seuil fictif, ni de division par zéro.
   */
  function progressForDiamonds(value) {
    const diamonds = contributionCount(value);
    const rank = rankForDiamonds(diamonds);
    const nextRank = ranks[ranks.indexOf(rank) + 1] || null;
    const required = nextRank ? nextRank.minimum - rank.minimum : 0;
    const earned = nextRank ? diamonds - rank.minimum : 0;
    return {
      rank, nextRank, diamonds, required, earned,
      remaining: nextRank ? nextRank.minimum - diamonds : 0,
      percent: nextRank ? earned / required * 100 : 100
    };
  }

  /** Texte de condition issu du même barème que le filtre et le moteur LIVE. */
  function describeRank(rankOrId) {
    const id = typeof rankOrId === "string" ? rankOrId : rankOrId?.id;
    const index = ranks.findIndex((rank) => rank.id === id);
    if (index < 0) return "";
    const rank = ranks[index];
    const next = ranks[index + 1];
    if (next?.minimum === rank.minimum + 1) return `${numberFormat.format(rank.minimum)} diamant cumulé`;
    if (next) return `De ${numberFormat.format(rank.minimum)} à ${numberFormat.format(next.minimum - 1)} diamants cumulés`;
    return `À partir de ${numberFormat.format(rank.minimum)} diamants cumulés`;
  }

  return Object.freeze({ ranks, rankForDiamonds, progressForDiamonds, describeRank });
});
