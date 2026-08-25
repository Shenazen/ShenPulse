function integratedNumberList(value) {
  const source = Array.isArray(value)
    ? value
    : String(value || "").split(/[\s,;|]+/);
  return source.map(Number).filter(Number.isFinite);
}

function integratedNumberField(name, label, value, min, max, step = 1, detail = "") {
  return `<label class="integrated-setting-field">
    <span>${escapeHtml(label)}</span>
    <input name="${escapeHtml(name)}" type="number" min="${min}" max="${max}" step="${step}" value="${escapeHtml(value)}">
    ${detail ? `<small>${escapeHtml(detail)}</small>` : ""}
  </label>`;
}

function integratedTextArea(name, label, value, detail = "") {
  return `<label class="integrated-setting-field full">
    <span>${escapeHtml(label)}</span>
    <textarea name="${escapeHtml(name)}">${escapeHtml(value)}</textarea>
    ${detail ? `<small>${escapeHtml(detail)}</small>` : ""}
  </label>`;
}

function integratedToggle(name, title, detail, checked) {
  return `<label class="integrated-setting-toggle">
    <input name="${escapeHtml(name)}" type="checkbox" ${checked ? "checked" : ""}>
    <span><strong>${escapeHtml(title)}</strong><small>${escapeHtml(detail)}</small></span>
  </label>`;
}

function integratedSettingsTabLabel(id, icon, title, detail, className = "") {
  return `<label for="${escapeHtml(id)}" class="${escapeHtml(className)}">
    <span class="integrated-tab-icon" aria-hidden="true">${escapeHtml(icon)}</span>
    <span class="integrated-tab-copy">
      <strong>${escapeHtml(title)}</strong>
      <small>${escapeHtml(detail)}</small>
    </span>
  </label>`;
}

function renderDealBoxValueFields(values) {
  return `<div class="integrated-box-values-grid">
    ${(Array.isArray(values) ? values : [])
      .slice(0, 24)
      .map(
        (value, index) => `<label class="integrated-box-value-field">
          <span>Valeur ${index + 1}</span>
          <div><b>#${index + 1}</b><input name="boxValue" type="number" min="-999999" max="999999" step="1" value="${escapeHtml(value)}" required></div>
        </label>`
      )
      .join("")}
  </div>`;
}

function renderDealRoundPreview(roundPattern) {
  return `<div class="integrated-round-preview">
    ${(Array.isArray(roundPattern) ? roundPattern : [])
      .slice(0, 12)
      .map(
        (count, index) => `<span>
          <small>Manche ${index + 1}</small>
          <strong>${escapeHtml(count)}</strong>
          <em>boîte${Number(count) > 1 ? "s" : ""}</em>
        </span>`
      )
      .join("")}
  </div>`;
}

function dealHostValueTone(box, allBoxes) {
  const value = Number(box?.value) || 0;
  if (value < 0) return "value-negative";
  const values = (Array.isArray(allBoxes) ? allBoxes : [])
    .map((item) => Number(item?.value) || 0)
    .sort((left, right) => left - right);
  if (values.length <= 1) return "value-mid";
  const index = Math.max(0, values.findIndex((item) => item >= value));
  const rank = index / Math.max(1, values.length - 1);
  if (rank >= 0.86) return "value-jackpot";
  if (rank >= 0.62) return "value-high";
  if (rank <= 0.28) return "value-low";
  return "value-mid";
}

function formatDealHostValue(value) {
  return new Intl.NumberFormat("fr-FR", {
    maximumFractionDigits: 0
  }).format(Number(value) || 0);
}

function formatDealHostMultiplier(value) {
  return new Intl.NumberFormat("fr-FR", {
    maximumFractionDigits: 2
  }).format(Number(value) || 1);
}

function renderDealPrivateMonitor() {
  if (!canUseDealCheatSettings()) return "";
  const state = dealOrNoDealHostState;
  const boxes = Array.isArray(state?.boxes) ? state.boxes : [];
  const payoutMultiplier = Math.max(
    0.01,
    Math.min(100, Number(state?.payoutMultiplier) || 1)
  );
  const multiplierLabel = formatDealHostMultiplier(payoutMultiplier);
  const updatedAt = Number(state?.updatedAt) || 0;
  const updateLabel = updatedAt
    ? `Actualisé à ${new Intl.DateTimeFormat("fr-FR", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit"
      }).format(new Date(updatedAt))}`
    : "En attente de l’ouverture du jeu";
  const phaseLabels = {
    lobby: "Salle d’attente",
    select: "Choix de la boîte joueur",
    opening: "Ouverture des boîtes",
    bankerCall: "Appel du banquier",
    banker: "Appel du banquier",
    targetChoice: "Choix d’une boîte",
    decision: "Décision du joueur",
    finalChoice: "Duel final",
    final: "Duel final",
    result: "Résultat"
  };
  return `<section class="deal-private-monitor" data-deal-private-monitor>
    <header>
      <div>
        <span class="deal-private-kicker"><i></i> SUIVI PRIVÉ EN DIRECT</span>
        <div class="deal-private-title-row">
          <h3>Contenu réel des 24 boîtes</h3>
          ${payoutMultiplier > 1 ? `<strong>GAINS ×${escapeHtml(multiplierLabel)}</strong>` : ""}
        </div>
        <p>${payoutMultiplier > 1 ? `Les montants affichés incluent le multiplicateur ×${escapeHtml(multiplierLabel)} de la partie Premium.` : "Visible uniquement par les comptes autorisés dans l’administration. Les joueurs ne voient jamais ces valeurs avant l’ouverture."}</p>
      </div>
      <div class="deal-private-status">
        <strong>${escapeHtml(phaseLabels[state?.phase] || (boxes.length ? "Partie en cours" : "Jeu fermé"))}</strong>
        <small>${escapeHtml(updateLabel)}</small>
      </div>
    </header>
    ${
      boxes.length
        ? `<div class="deal-private-box-grid">
          ${boxes
            .map((box) => {
              const effectiveValue = Math.round(
                (Number(box.value) || 0) * payoutMultiplier
              );
              const status = box.own
                ? "Boîte joueur"
                : box.opened
                  ? "Ouverte"
                  : "Fermée";
              const stateClass = box.own
                ? "is-own"
                : box.opened
                  ? "is-opened"
                  : "is-closed";
              return `<article class="deal-private-box ${stateClass} ${dealHostValueTone(box, boxes)}">
                <header><b>#${escapeHtml(box.id)}</b><small>${escapeHtml(status)}</small></header>
                <strong>${escapeHtml(formatDealHostValue(effectiveValue))}<span>♦</span></strong>
                ${payoutMultiplier > 1 ? `<em>Base ${escapeHtml(formatDealHostValue(box.value))}</em>` : ""}
              </article>`;
            })
            .join("")}
        </div>`
        : `<div class="deal-private-empty">
          <span>◇</span>
          <div><strong>Les valeurs apparaîtront ici dès l’ouverture du jeu</strong><p>Lancez DealOrNoDeal : l’affectation aléatoire de chaque valeur sera transmise immédiatement.</p></div>
        </div>`
    }
    ${
      state?.playerName ||
      state?.bankerRequestText ||
      Number(state?.bonusValue) ||
      payoutMultiplier > 1
        ? `<footer>
          ${state.playerName ? `<span><small>Joueur</small><strong>${escapeHtml(state.playerName)}</strong></span>` : ""}
          ${payoutMultiplier > 1 ? `<span class="is-premium"><small>Mode choisi</small><strong>Gains ×${escapeHtml(multiplierLabel)}</strong></span>` : ""}
          ${state.bankerRequestText ? `<span><small>Banquier</small><strong>${escapeHtml(state.bankerRequestText)}</strong></span>` : ""}
          ${Number(state.bonusValue) ? `<span><small>Bonus</small><strong>${escapeHtml(formatDealHostValue(state.bonusValue))} ♦</strong></span>` : ""}
        </footer>`
        : ""
    }
  </section>`;
}

function syncDealPrivateMonitor() {
  const current = content.querySelector("[data-deal-private-monitor]");
  if (!current || !canUseDealCheatSettings()) return;
  current.outerHTML = renderDealPrivateMonitor();
}

function renderDealBankerRequest(request, index, total) {
  const type = ["cashOffer", "swapBox", "buyBox"].includes(request.type)
    ? request.type
    : "cashOffer";
  const targetMode = ["random", "highest", "lowest", "playerChoice"].includes(
    request.targetMode
  )
    ? request.targetMode
    : type === "swapBox"
      ? "playerChoice"
      : "random";
  return `<article class="integrated-banker-request">
    <input type="hidden" name="banker.${index}.id" value="${escapeHtml(request.id || `banker-request-${index + 1}`)}">
    <header>
      <strong>Demande ${index + 1}</strong>
      <label><input name="banker.${index}.enabled" type="checkbox" ${request.enabled !== false ? "checked" : ""}> Active</label>
      <button type="button" data-action="remove-deal-banker-request" data-index="${index}" ${total <= 1 ? "disabled" : ""}>×</button>
    </header>
    <div class="integrated-settings-grid">
      <label class="integrated-setting-field"><span>Type de demande</span><select name="banker.${index}.type">
        <option value="cashOffer" ${type === "cashOffer" ? "selected" : ""}>Offre en diamants</option>
        <option value="swapBox" ${type === "swapBox" ? "selected" : ""}>Échange de boîte</option>
        <option value="buyBox" ${type === "buyBox" ? "selected" : ""}>Achat d’une boîte</option>
      </select></label>
      ${integratedNumberField(`banker.${index}.weight`, "Poids de tirage", request.weight, 0, 999)}
      ${integratedNumberField(`banker.${index}.forceAfterOpenedCount`, "Forcer après X boîtes", request.forceAfterOpenedCount, 0, 21, 1, "0 conserve un tirage uniquement aléatoire.")}
      ${integratedNumberField(`banker.${index}.amount`, "Montant / prix", request.amount, 0, 999999, 1, "0 calcule automatiquement une offre en diamants.")}
      <label class="integrated-setting-field"><span>Boîte ciblée</span><select name="banker.${index}.targetMode">
        <option value="random" ${targetMode === "random" ? "selected" : ""}>Aléatoire</option>
        <option value="highest" ${targetMode === "highest" ? "selected" : ""}>Plus haute valeur</option>
        <option value="lowest" ${targetMode === "lowest" ? "selected" : ""}>Plus basse valeur</option>
        <option value="playerChoice" ${targetMode === "playerChoice" ? "selected" : ""}>Choix du joueur</option>
      </select></label>
    </div>
  </article>`;
}

function renderDealMusicFields(config) {
  const scenes = [
    ["waiting", "Attente", "Epilogue (Romeo and Juliet)"],
    ["dramaticLoss", "Perte dramatique", "Epilogue (Romeo and Juliet)"],
    ["funeral", "Funérailles", "Chopin - Marche Funèbre"],
    ["badRun", "Mauvaise série", "Bruno Coulais - Norbu"],
    ["uncertain", "Incertitude", "Sorrow"],
    ["bankerOffer", "Offre du banquier", "Sorrow"],
    ["heroicOffer", "Offre héroïque", "Titans From Alexander"],
    ["solemnFinal", "Final solennel", "Conquest of Paradise"],
    ["heroicTension", "Tension héroïque", "Titans From Alexander"],
    ["finalDuel", "Duel final", "The Last of the Mohicans - Promentory"]
  ];
  return scenes
    .map(([scene, label, defaultTitle]) => {
      const override = config.music?.[scene] || {};
      return `<article class="integrated-music-row">
        <header><strong>${escapeHtml(label)}</strong><small>${escapeHtml(defaultTitle)}</small></header>
        <label class="integrated-setting-field"><span>Titre personnalisé</span><input name="music.${scene}.title" value="${escapeHtml(override.title || "")}" placeholder="${escapeHtml(defaultTitle)}"></label>
        <label class="integrated-setting-field"><span>URL audio personnalisée</span><input name="music.${scene}.url" type="url" value="${escapeHtml(override.url || "")}" placeholder="https://…"><small>Vide = musique originale intégrée.</small></label>
      </article>`;
    })
    .join("");
}
