"use strict";

function renderGameCategoryFilters(packs) {
  return `<div class="filter-pills game-category-filters" role="group" aria-label="Catégories de jeux">${ShenPulseGameCategories.categories.map((category) => {
    const count = ShenPulseGameCategories.countGames(category.id === "all" ? packs : packs.filter((pack) => ShenPulseGameCategories.categoryFor(pack) === category.id));
    const active = gameCategory === category.id;
    return `<button type="button" class="${active ? "active" : ""}" data-action="set-game-category" data-value="${category.id}" aria-pressed="${active}" style="--game-category-color:${category.color}"><span class="game-category-icon" aria-hidden="true">${category.icon}</span><span>${escapeHtml(category.label)}</span><span class="game-category-count">${count}</span></button>`;
  }).join("")}</div>`;
}
