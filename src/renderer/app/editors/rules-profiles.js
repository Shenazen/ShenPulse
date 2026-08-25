function timerIntervalParts(intervalMs) {
  const value = Math.max(1000, Number(intervalMs) || 60000);
  if (value % 3600000 === 0) {
    return { value: value / 3600000, unit: "hours" };
  }
  if (value % 60000 === 0) {
    return { value: value / 60000, unit: "minutes" };
  }
  return { value: Math.max(1, Math.round(value / 1000)), unit: "seconds" };
}

function openRuleEditor(rule) {
  const current = rule || {
    id: "",
    name: "",
    enabled: true,
    priority: 50,
    trigger: { enabled: true, type: "gift", source: "*", threshold: 1 },
    conditions: [],
    cooldown: { globalMs: 1000, perUserMs: 2000 },
    chance: 1,
    actions: [],
    actionSelection: {
      mode: "all",
      actionIds: [],
      randomCount: 1
    }
  };
  const selectedActionIds = new Set(triggerActionIds(current));
  const selectionMode =
    current.actionSelection?.mode === "random" ? "random" : "all";
  const selectedCount = Math.max(1, selectedActionIds.size);
  const randomCount = Math.min(
    selectedCount,
    Math.max(
      1,
      Math.floor(Number(current.actionSelection?.randomCount) || 1)
    )
  );
  const actionRows = flattenActions();
  const actionPicker = actionRows.length
    ? actionRows.map(({ rule: ownerRule, action }) => `
      <label class="timer-action-option trigger-action-option" data-trigger-action-option data-searchable="${escapeHtml(`${ownerRule.name} ${actionTypeLabel(action.type)} ${actionDescription(action)}`.toLowerCase())}">
        <input type="checkbox" name="actionIds" value="${escapeHtml(action.id)}" ${selectedActionIds.has(String(action.id)) ? "checked" : ""}>
        <span class="timer-action-check">✓</span>
        <span><strong>${escapeHtml(ownerRule.name)}</strong><small>${escapeHtml(actionTypeLabel(action.type))} · ${escapeHtml(actionDescription(action))}</small></span>
      </label>`).join("")
    : `<div class="timer-actions-empty">Créez d’abord au moins une action dans le sous-onglet Actions.</div>`;
  openEditor({
    title: rule ? "Modifier le déclencheur" : "Nouveau déclencheur",
    kicker: "MOTEUR DE DÉCLENCHEURS",
    variant: "wide",
    body: `<div class="trigger-editor action-editor">
      ${dialogSection(
        "1. Événement",
        "Choisissez l’événement qui doit lancer ce déclencheur.",
        `${field("name", "Nom du déclencheur", current.name, "text", "required full autofocus")}
        <div class="timer-editor-enabled full">
          <span><strong>Déclencheur actif</strong><small>Vous pouvez le désactiver sans perdre la sélection d’actions.</small></span>
          <span class="switch"><input type="checkbox" name="enabled" value="true" ${current.enabled !== false ? "checked" : ""}><span></span></span>
        </div>
        <div class="trigger-editor-source-note full"><span>◎</span><div><strong>Toutes les sources</strong><small>Les événements LIVE et les tests sont toujours pris en compte automatiquement.</small></div></div>
        <label class="field"><span>Type de déclencheur</span><select name="triggerType" data-editor-trigger-type>${triggerTypeOptions(current.trigger.type)}</select></label>
        ${field("threshold", "Seuil / quantité", current.trigger.threshold || 1, "number", 'min="1"')}
        <div class="editor-conditional full" data-trigger-types="gift">${giftTriggerConditionFields(current.conditions)}</div>
        <div class="editor-conditional full" data-trigger-types="chat">${field("messageCondition", "Message contient (optionnel)", conditionValue(current.conditions, "data.message", "contains"), "text", "full")}</div>
        ${field("usernameCondition", "@ viewer précis (optionnel)", conditionValue(current.conditions, "user.name", "equals"), "text", "full")}
        ${field("globalCooldown", "Cooldown global (ms)", current.cooldown?.globalMs || 0, "number", 'min="0"')}
        ${field("userCooldown", "Cooldown viewer (ms)", current.cooldown?.perUserMs || 0, "number", 'min="0"')}`,
        "dialog-section-accent"
      )}
      ${dialogSection(
        "2. Actions existantes",
        "Sélectionnez plusieurs actions à lancer ensemble ou à tirer au hasard.",
        `<label class="field"><span>Mode d’exécution</span><select name="actionSelectionMode" data-trigger-selection-mode>
          <option value="all" ${selectionMode === "all" ? "selected" : ""}>Toutes les actions sélectionnées</option>
          <option value="random" ${selectionMode === "random" ? "selected" : ""}>Un nombre obligatoire au hasard</option>
        </select></label>
        <label class="field" data-trigger-random-count><span>Nombre obligatoire à tirer</span><input name="randomCount" type="number" min="1" max="${selectedCount}" value="${randomCount}"><small data-trigger-random-count-help>Exactement ${randomCount} action${randomCount > 1 ? "s" : ""} sera${randomCount > 1 ? "ont" : ""} tirée${randomCount > 1 ? "s" : ""} à chaque déclenchement.</small></label>
        <label class="field full"><span>Rechercher une action</span><input type="search" data-trigger-action-search placeholder="Nom, type ou configuration…"></label>
        <div class="timer-action-picker trigger-action-picker full">${actionPicker}</div>`
      )}
    </div>`,
    onSubmit: async (data) => {
      const actionIds = [
        ...new Set(data.getAll("actionIds").map(String).filter(Boolean))
      ];
      if (!actionIds.length) {
        throw new Error("Sélectionnez au moins une action existante à exécuter.");
      }
      const actionSelectionMode =
        data.get("actionSelectionMode") === "random" ? "random" : "all";
      const requestedRandomCount = Math.max(
        1,
        Math.floor(Number(data.get("randomCount")) || 1)
      );
      if (
        actionSelectionMode === "random" &&
        requestedRandomCount > actionIds.length
      ) {
        throw new Error(
          `Sélectionnez au moins ${requestedRandomCount} actions pour ce tirage.`
        );
      }
      const updated = {
        ...current,
        id: current.id || `rule_${cryptoId()}`,
        name: data.get("name"),
        enabled: data.get("enabled") === "true",
        trigger: {
          ...current.trigger,
          enabled: true,
          type: data.get("triggerType"),
          source: "*",
          threshold: Number(data.get("threshold"))
        },
        priority: Number(current.priority ?? 50),
        chance: Number(current.chance ?? 1),
        cooldown: {
          globalMs: Number(data.get("globalCooldown")),
          perUserMs: Number(data.get("userCooldown"))
        },
        conditions: buildTriggerConditions(current.conditions, data),
        actions: current.actions || [],
        actionSelection: {
          mode: actionSelectionMode,
          actionIds,
          randomCount:
            actionSelectionMode === "random"
              ? requestedRandomCount
              : actionIds.length
        }
      };
      await api.upsert("rules", updated);
      await ensureRuleInActiveProfile(updated.id);
      snapshot = await api.getSnapshot();
    }
  });
  syncTriggerSelectionEditor();
}

function openConnectionEditor(connection) {
  const current = connection || { id: "", name: "", type: "websocket", enabled: true, config: { url: "ws://127.0.0.1:21214" } };
  openEditor({
    title: connection ? "Modifier la source" : "Ajouter une source",
    kicker: "CONNEXION PLATEFORME",
    body: `<div class="form-grid">
      ${field("name", "Nom", current.name, "text", "required full")}
      <label class="field"><span>Type</span><select name="type"><option value="websocket" ${current.type === "websocket" ? "selected" : ""}>WebSocket autorisé</option><option value="twitch-irc" ${current.type === "twitch-irc" ? "selected" : ""}>Twitch IRC</option><option value="demo" ${current.type === "demo" ? "selected" : ""}>Démo</option></select></label>
      <label class="field"><span>Démarrage automatique (hors démo)</span><select name="enabled"><option value="true" ${current.enabled && current.type !== "demo" ? "selected" : ""}>Oui</option><option value="false" ${!current.enabled || current.type === "demo" ? "selected" : ""}>Non</option></select><small>Une source Démo reste toujours manuelle et n’émet rien toute seule.</small></label>
      ${field("url", "URL WebSocket", current.config?.url || "", "text", "full")}
      ${field("channel", "Chaîne Twitch", current.config?.channel || "")}
      ${field("username", "Utilisateur Twitch", current.config?.username || "")}
      ${field("secret", "Nouveau jeton / secret", "", "password", "full")}
      <div class="field full"><small>Pour TikTok ou Kick, renseignez l’URL d’un relais autorisé qui émet { event, data }. Le secret est ajouté comme paramètre token à la connexion WebSocket.</small></div>
    </div>`,
    onSubmit: async (data) => {
      await api.saveConnection({
        ...current,
        id: current.id || `source_${cryptoId()}`,
        name: data.get("name"),
        type: data.get("type"),
        enabled: data.get("type") !== "demo" && data.get("enabled") === "true",
        secret: data.get("secret"),
        config: { ...(current.config || {}), url: data.get("url"), channel: data.get("channel"), username: data.get("username") }
      });
      snapshot = await api.getSnapshot();
    }
  });
}

function openTikTokEditor() {
  const current = snapshot.state.settings.tiktok || {};
  openEditor({
    title: current.username
      ? `Compte TikTok @${current.username}`
      : "Connecter TikTok LIVE",
    kicker: "IDENTITÉ & DÉTECTION LIVE",
    submitLabel: "Détecter le LIVE",
    body: `<div class="form-grid">
      ${field("username", "@ du compte TikTok", current.username || "", "text", "required full")}
      <div class="field full tiktok-help">
        <strong>Détection automatique</strong>
        <small>Après validation, ShenPulse surveille ce compte en arrière-plan. S’il est hors ligne, la connexion se fera automatiquement dès son prochain LIVE.</small>
      </div>
    </div>`,
    onSubmit: async (data) => {
      snapshot = await api.saveTikTok({
        username: data.get("username")
      });
      snapshot = await api.startTikTok();
    }
  });
}

function openProfileManager() {
  const activeProfileId = snapshot.state.session.profileId;
  const profiles = snapshot.state.profiles;
  openEditor({
    title: "Gérer les profils",
    kicker: "PROFILS D’AUTOMATISATION",
    submitLabel: "Fermer",
    body: `<div class="profile-manager">
      <div class="profile-manager-toolbar">
        <div><strong>${profiles.length} profil${profiles.length > 1 ? "s" : ""}</strong><small>Actions, déclencheurs, timers, sons, overlays et réglages de jeux sont indépendants.</small></div>
        <button class="button primary" type="button" data-profile-action="create">＋ Nouveau profil</button>
      </div>
      <div class="profile-manager-list">
        ${profiles.map((profile) => {
          const ruleCount = profile.workspace?.rules?.length || 0;
          return `
          <article class="profile-manager-card ${profile.id === activeProfileId ? "active" : ""}">
            <span class="profile-manager-icon">${escapeHtml(profile.name.slice(0, 2).toUpperCase())}</span>
            <div>
              <h3>${escapeHtml(profile.name)} ${profile.id === activeProfileId ? '<span class="badge success">ACTIF</span>' : ""}</h3>
              <p>${escapeHtml(profile.description || "Aucune description")}</p>
              <small>${ruleCount} règle${ruleCount > 1 ? "s" : ""} · espace de travail indépendant</small>
            </div>
            <div class="profile-manager-actions">
              ${profile.id === activeProfileId ? "" : `<button class="button ghost" type="button" data-profile-action="activate" data-id="${escapeHtml(profile.id)}">Activer</button>`}
              <button class="button" type="button" data-profile-action="edit" data-id="${escapeHtml(profile.id)}">Modifier</button>
              <button class="button danger" type="button" data-profile-action="delete" data-id="${escapeHtml(profile.id)}" ${profiles.length <= 1 ? "disabled" : ""}>Supprimer</button>
            </div>
          </article>`;
        }).join("")}
      </div>
    </div>`,
    onSubmit: async () => {}
  });
}

function openProfileEditor(profile) {
  const current = profile || {
    id: "",
    name: "",
    description: ""
  };
  openEditor({
    title: profile ? `Modifier ${profile.name}` : "Créer un profil",
    kicker: "PROFIL D’AUTOMATISATION",
    submitLabel: profile ? "Enregistrer" : "Créer et activer",
    body: `<div class="form-grid profile-editor">
      ${field("name", "Nom du profil", current.name, "text", "required full")}
      <label class="field full"><span>Description</span><textarea name="description" placeholder="Usage, jeu ou ambiance de ce profil…">${escapeHtml(current.description || "")}</textarea></label>
      <div class="profile-workspace-notice full">
        <strong>${profile ? "Espace de travail conservé" : "Nouveau profil vierge"}</strong>
        <p>${profile
          ? "Modifier le nom ou la description ne change pas les actions et réglages de ce profil."
          : "Le profil démarre sans action, déclencheur, timer, règle sonore ni commande, avec les overlays par défaut. Les droits Pro, Premium, essais et jeux accordés à votre @ restent disponibles dans tous vos profils."}</p>
      </div>
    </div>`,
    onSubmit: async (data) => {
      const now = new Date().toISOString();
      const profileId = current.id || `profile_${cryptoId()}`;
      await api.upsert("profiles", {
        id: profileId,
        name: data.get("name"),
        description: data.get("description"),
        createdAt: current.createdAt || now,
        updatedAt: now
      });
      if (!profile) await api.selectProfile(profileId);
      snapshot = await api.getSnapshot();
    }
  });
}

function openGoalEditor(goal) {
  const current = goal || { id: "", name: "", type: "like", current: 0, target: 1000, color: "#8D5CF6", enabled: true, reset: "manual" };
  openEditor({
    title: goal ? "Modifier l’objectif" : "Nouvel objectif",
    kicker: "PROGRESSION",
    body: `<div class="form-grid">${field("name","Nom",current.name,"text","required full")}${field("type","Type",current.type)}${field("color","Couleur",current.color,"color")}${field("current","Valeur actuelle",current.current,"number",'min="0"')}${field("target","Cible",current.target,"number",'min="1"')}</div>`,
    onSubmit: async (data) => {
      await api.upsert("goals", { ...current, id: current.id || `goal_${cryptoId()}`, name: data.get("name"), type: data.get("type"), color: data.get("color"), current: Number(data.get("current")), target: Number(data.get("target")) });
      snapshot = await api.getSnapshot();
    }
  });
}

function openCommandEditor(command) {
  const current = command || { id: "", command: "!", response: "", enabled: true, subscriberOnly: false, cooldownMs: 10000 };
  openEditor({
    title: command ? "Modifier la commande" : "Nouvelle commande",
    kicker: "CHATBOT",
    body: `<div class="form-grid">${field("command","Commande",current.command,"text","required")}${field("cooldown","Cooldown (ms)",current.cooldownMs,"number",'min="0"')}${field("response","Réponse",current.response,"text","required full")}<label class="field"><span>Accès</span><select name="subscriberOnly"><option value="false" ${!current.subscriberOnly ? "selected" : ""}>Tout le monde</option><option value="true" ${current.subscriberOnly ? "selected" : ""}>Abonnés uniquement</option></select></label></div>`,
    onSubmit: async (data) => {
      await api.upsert("commands", { ...current, id: current.id || `command_${cryptoId()}`, command: data.get("command"), response: data.get("response"), cooldownMs: Number(data.get("cooldown")), subscriberOnly: data.get("subscriberOnly") === "true" });
      snapshot = await api.getSnapshot();
    }
  });
}

function openGameConfig(pack) {
  if (!requireGameAccess(pack)) return;
  const current = snapshot.state.game.connectorOverrides?.[pack.id] || {};
  const connector = { ...pack.connector, ...current };
  const inputs = connector.type === "rcon" || connector.type === "tcp" || connector.type === "udp"
    ? `${field("host","Hôte",connector.host || "127.0.0.1")}${field("port","Port",connector.port || "","number",'min="1" max="65535"')}`
    : connector.type === "websocket" || connector.type === "http"
      ? field("url","URL",connector.url || "","text","full")
      : `<div class="field full"><small>Le pack de démonstration ne nécessite aucune configuration.</small></div>`;
  openEditor({
    title: `Configurer ${pack.name}`,
    kicker: "PASSERELLE DE JEU",
    body: `<div class="form-grid">${inputs}${connector.type === "rcon" ? field("secret","Nouveau mot de passe RCON","","password","full") : ""}</div>`,
    onSubmit: async (data) => {
      const config = {};
      for (const key of ["host","port","url","secret"]) if (data.has(key) && data.get(key) !== "") config[key] = key === "port" ? Number(data.get(key)) : data.get(key);
      await api.configureGame(pack.id, config);
      snapshot = await api.getSnapshot();
    }
  });
}
