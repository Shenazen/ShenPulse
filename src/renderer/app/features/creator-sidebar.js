"use strict";

/** Carte vectorielle légère : aucun chargement réseau, animation ou image bitmap. */
function renderCreatorSidebarPromotion() {
  const showOffers = canNavigateTo("membership") && !creatorHasActiveSubscription();
  return `<div class="sidebar-promotion">
    ${showOffers ? `<section class="sidebar-pro-card" aria-labelledby="sidebar-pro-title">
      <svg class="sidebar-pro-crown" viewBox="0 0 64 64" aria-hidden="true"><defs><linearGradient id="sidebar-crown-gold" x2="0" y2="1"><stop stop-color="#fff1a6"/><stop offset="1" stop-color="#ffbb73"/></linearGradient></defs><path fill="url(#sidebar-crown-gold)" d="m9 22 13 9 10-19 10 19 13-9-6 26H15z"/><path d="M17 52h30" stroke="#ffca87" stroke-width="4" stroke-linecap="round"/></svg>
      <h3 id="sidebar-pro-title">Passez Pro</h3>
      <p>Plus de modules<br>Plus de possibilités<br>Une communauté plus grande</p>
      <button type="button" class="sidebar-pro-offers" data-action="membership-offers" aria-haspopup="dialog">Découvrir les offres</button>
    </section>` : ""}
    <blockquote>« Vos viewers ne regardent plus un live…<br>Ils en font partie. »</blockquote>
    <img class="sidebar-handwritten-signature" src="assets/brand/shenpulse-signature.svg" alt="ShenPulse" width="210" height="92" loading="lazy" decoding="async">
  </div>`;
}
