"use strict";
// Façades historiques : tous les éléments d’affichage sont partagés avec les autres jeux.
function renderSupermarketFreeSection(pack,rows,unlocked) { const ctx=supermarketContext(pack,{unlocked});return supermarketMarkup(ctx,ShenPulseGameWorkspace.renderFreeEventsSection(ctx,rows)); }
function renderSupermarketFreeRow(pack,row,type,unlocked) { const ctx=supermarketContext(pack,{unlocked});return supermarketMarkup(ctx,ShenPulseGameWorkspace.renderFreeRow(ctx,row,type)); }
