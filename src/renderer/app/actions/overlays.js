"use strict";

/**
 * Commandes utilisateur et tests propres aux overlays.
 *
 * Ce module est chargé comme script classique dans l'ordre déclaré par la page.
 * Il partage uniquement les contrats globaux documentés dans README.md.
 */

function cryptoId() {
  return `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

async function testActionRow(row) {
  if (!row) throw new Error("Action introuvable.");
  return api.testAction({
    ...row.action,
    testEventType:
      row.action.type === "tts.speak"
        ? "chat"
        : row.rule.trigger?.type || "gift",
    ...(row.action.type === "tts.speak"
      ? { testMessage: "Ceci est un test de lecture ShenPulse." }
      : {})
  });
}

async function duplicateActionRow(row) {
  if (!row) throw new Error("Action introuvable.");
  const nextAction = structuredClone(row.action);
  nextAction.id = `action_${cryptoId()}`;
  const nextRule = structuredClone(row.rule);
  nextRule.id = `rule_${cryptoId()}`;
  nextRule.actions = [nextAction];
  await api.upsert("rules", nextRule);
  await ensureRuleInActiveProfile(nextRule.id);
  snapshot = await api.getSnapshot();
  render();
}

async function deleteActionRow(row) {
  if (!row) throw new Error("Action introuvable.");
  if (
    !(await confirmAction(
      `Supprimer l’action « ${actionTypeLabel(row.action.type)} » ?`,
      { title: "Supprimer cette action", confirmLabel: "Supprimer" }
    ))
  ) {
    return;
  }
  const actions = (row.rule.actions || []).filter((_item, index) => index !== row.actionIndex);
  if (actions.length) await api.upsert("rules", { ...row.rule, actions });
  else await api.remove("rules", row.rule.id);
  snapshot = await api.getSnapshot();
  render();
}

async function deleteTriggerRule(rule) {
  if (!rule) throw new Error("Déclencheur introuvable.");
  if (
    !(await confirmAction(
      `Supprimer le déclencheur « ${rule.name} » ? Les actions existantes seront conservées.`,
      { title: "Supprimer ce déclencheur", confirmLabel: "Supprimer" }
    ))
  ) {
    return;
  }
  if ((rule.actions || []).length) {
    const nextRule = structuredClone(rule);
    nextRule.trigger = {
      ...(nextRule.trigger || {}),
      enabled: false
    };
    delete nextRule.actionSelection;
    await api.upsert("rules", nextRule);
  } else {
    await api.remove("rules", rule.id);
  }
  acceptSnapshot(await api.getSnapshot());
  render();
}

async function setSoundVolume(row, volume) {
  if (!row) throw new Error("Son introuvable.");
  const actions = [...(row.rule.actions || [])];
  actions[row.actionIndex] = {
    ...row.action,
    config: { ...(row.action.config || {}), volume: Number(volume) }
  };
  await api.upsert("rules", { ...row.rule, actions });
  snapshot = await api.getSnapshot();
}

function liveScreenUrl(screen) {
  const urls = Array.isArray(snapshot.overlayUrls?.mediaScreens)
    ? snapshot.overlayUrls.mediaScreens
    : [];
  return urls[Math.min(8, Math.max(1, Number(screen) || 1)) - 1] || "";
}

async function updateAudioOutput(row, outputMode, liveScreen = 1) {
  if (!row) throw new Error("Sortie audio introuvable.");
  const actions = [...(row.rule.actions || [])];
  actions[row.actionIndex] = {
    ...row.action,
    config: {
      ...(row.action.config || {}),
      outputMode: outputMode === "live" ? "live" : "local",
      liveScreen: Math.min(8, Math.max(1, Math.round(Number(liveScreen) || 1)))
    }
  };
  await api.upsert("rules", { ...row.rule, actions });
  acceptSnapshot(await api.getSnapshot());
}

function syncLiveAudioScreenDialog() {
  const picker = dialogBody.querySelector('[name="liveScreen"]');
  const urlNode = dialogBody.querySelector("[data-live-output-url]");
  const copyButton = dialogBody.querySelector("[data-live-output-copy]");
  if (!picker || !urlNode || !copyButton) return;
  const url = liveScreenUrl(picker.value);
  urlNode.textContent = url || "URL indisponible";
  urlNode.title = url;
  copyButton.dataset.value = url;
  copyButton.disabled = !url;
}

function openLiveAudioOutputEditor(row) {
  if (!row) return;
  const selectedScreen = normalizedLiveScreen(row.action.config);
  openEditor({
    title: "Diffuser le son pour tout le LIVE",
    kicker: "SORTIE AUDIO · SOURCE NAVIGATEUR",
    submitLabel: "Activer sur cet écran",
    successMessage: "Sortie audio LIVE activée",
    body: `<div class="live-audio-output-dialog">
      <div class="live-audio-output-intro">
        <span aria-hidden="true">◉</span>
        <div><strong>Choisissez l’écran qui transportera le son</strong><p>Les sons et le TTS seront joués uniquement par l’URL de cet écran.</p></div>
      </div>
      <label class="field full"><span>Écran de diffusion</span><select name="liveScreen" required>
        ${Array.from({ length: 8 }, (_value, index) => {
          const screen = index + 1;
          return `<option value="${screen}" ${screen === selectedScreen ? "selected" : ""}>Écran ${screen}</option>`;
        }).join("")}
      </select></label>
      <div class="live-audio-output-url">
        <span>URL à ajouter dans OBS ou TikTok LIVE Studio</span>
        <code data-live-output-url></code>
        <button type="button" class="button primary" data-action="copy" data-media-screen-url="true" data-live-output-copy data-value="">Copier l’URL</button>
      </div>
      <div class="live-audio-output-warning">
        <strong>Attention aux doublons</strong>
        <p>Vérifiez si cette URL est déjà présente dans votre interface de LIVE avant de l’ajouter. Si la même URL est chargée dans deux sources, le son et le TTS seront entendus deux fois.</p>
      </div>
      <div class="live-audio-output-spotify">
        <strong>Spotify</strong>
        <p>Spotify continue de jouer sur l’appareil Spotify actif. Pour l’entendre en LIVE, capturez l’application Spotify séparément. Le flux Spotify et ses jetons ne sont jamais publiés dans cette URL.</p>
      </div>
    </div>`,
    onSubmit: async (data) => {
      await updateAudioOutput(row, "live", data.get("liveScreen"));
    }
  });
  syncLiveAudioScreenDialog();
}

function likeGoalTestAmount() {
  const editor = dialogBody.querySelector(
    '[data-overlay-config-editor="likeGoal"]'
  );
  const draftTarget = Number(
    editor?.querySelector('[name="target"]')?.value
  );
  const configuredTarget = Number(overlayConfig("likeGoal").target);
  const target = Number.isFinite(draftTarget) && draftTarget > 0
    ? draftTarget
    : configuredTarget;
  return Math.max(1, Math.round(target || 1));
}

function matchPlaybackPayload(key) {
  const item = overlayDefinitions().find((entry) => entry.key === key);
  if (!item?.match) throw new Error("Animation Match introuvable.");
  const config = overlayConfig(key);
  return {
    requestId: `preview-${cryptoId()}`,
    match: item.match,
    variant:
      item.match === "enigma"
        ? "tikcontrol"
        : config.variant || "tikcontrol",
    fit: config.fit === "cover" ? "cover" : "contain"
  };
}

async function dispatchOverlayTest(key) {
  const overlay = overlayDefinitions().find((item) => item.key === key);
  if (overlay && !canAccessOverlay(overlay)) {
    throw new Error("Cet overlay est masqué par la configuration ShenPulse.");
  }
  if (overlay && !overlayUnlocked(overlay)) {
    const frame = dialogBody.querySelector(
      `[data-overlay-config-editor="${CSS.escape(key)}"] [data-overlay-live-preview]`
    );
    if (!frame?.contentWindow) {
      throw new Error("L’aperçu Pro n’est pas encore chargé.");
    }
    const previewMessages = key === "multiplierTimer"
      ? [{
          channel: "timer",
          payload: { operation: "add", seconds: 30, label: "BONUS X2" }
        }]
      : key === "winCounter"
        ? [{
            channel: "win-counter",
            payload: { operation: "adjust", amount: 1 }
          }]
        : key.startsWith("match")
          ? [{
              channel: "match",
              payload: matchPlaybackPayload(key)
            }]
          : [{
              channel: "game",
              payload: { effectName: "Effet de test", viewer: "Spectateur test" }
            }];
    for (const message of previewMessages) {
      frame.contentWindow.postMessage(
        {
          source: "shenpulse-overlay-card",
          channel: message.channel,
          payload: message.payload
        },
        new URL(frame.src).origin
      );
    }
    return { previewOnly: true };
  }
  if (["alerts", "myActions", "feed"].includes(key)) {
    const type = key === "feed" ? "chat" : "gift";
    const event = await api.testEvent(type);
    postOverlayCardEvent(key, "event", event);
    return event;
  }
  if (key === "goals") {
    const event = await api.testEvent("like");
    postOverlayCardEvent(key, "event", event);
    return event;
  }
  if (key === "likeGoal") {
    const amount = likeGoalTestAmount();
    const event = await api.simulateEvent({
      type: "like",
      count: amount,
      likeCount: amount
    });
    postOverlayCardEvent(key, "event", event);
    return event;
  }
  if (key === "topDonors" || key === "coinJar") {
    const gift = giftForName("Rose");
    const event = await api.simulateEvent({
      type: "gift",
      giftId: gift?.id || "rose",
      giftName: gift?.name || "Rose",
      giftImageUrl: gift?.imageUrl || "",
      count: 5,
      repeatCount: 5,
      value: gift?.cost || 1
    });
    postOverlayCardEvent(key, "event", event);
    return event;
  }
  if (key === "topTappers") {
    const event = await api.simulateEvent({
      type: "like",
      count: 250,
      likeCount: 250
    });
    postOverlayCardEvent(key, "event", event);
    return event;
  }
  if (key === "winCounter") {
    const payload = { operation: "adjust", amount: 1 };
    const result = await api.testAction({
      id: "preview_win_counter",
      type: "overlay.win-counter",
      config: payload
    });
    postOverlayCardEvent(key, "win-counter", payload);
    return result;
  }
  if (key.startsWith("match")) {
    const requested = matchPlaybackPayload(key);
    const payload = await api.testAction({
      id: `preview_match_${cryptoId()}`,
      type: "overlay.match",
      config: requested
    });
    postOverlayCardEvent(key, "match", payload);
    return payload;
  }
  if (key === "game") {
    const activePack = snapshot.packs.find(
      (pack) => pack.id === snapshot.state.session.activeGamePackId
    ) || snapshot.packs[0];
    return api.triggerEffect(activePack.effects[0]?.id || "spawn_enemy", {});
  }
  if (key === "timer") {
    const payload = {
      operation: "add",
      seconds: 30,
      label: "TEMPS RESTANT"
    };
    const result = await api.testAction({
      id: "preview_timer",
      type: "timer.add",
      config: payload
    });
    postOverlayCardEvent(key, "timer", payload);
    return result;
  }
  if (key === "multiplierTimer") {
    const payload = {
      operation: "add",
      seconds: 30,
      label: "BONUS X2"
    };
    const result = await api.testAction({
      id: "preview_multiplier_timer",
      type: "timer.add",
      config: payload
    });
    postOverlayCardEvent(key, "timer", payload);
    return result;
  }
  if (key === "wheel") {
    const config = normalizeWheelConfig(overlayConfig("wheel"));
    const wheel = config.wheels.find(
      (entry) => entry.id === config.selectedWheelId
    ) || config.wheels[0];
    const choices = wheel.segments.map((segment) => segment.label);
    const colors = wheel.segments.map((segment) => segment.color);
    const result = await api.testAction({
      id: "preview_wheel",
      type: "wheel.spin",
      config: {
        wheelId: wheel.id,
        choices: [],
        color: wheel.segments[0]?.color || "#ff6a00"
      }
    });
    postOverlayCardEvent(key, "wheel", {
      choices,
      colors,
      winnerIndex: 0,
      winner: choices[0] || "Surprise !",
      settings: wheel,
      design: wheel.design
    });
    return result;
  }
  throw new Error("Overlay inconnu.");
}

function previewGuestOverlay(key) {
  const timestamp = Date.now();
  const viewer = {
    id: `guest-preview-${timestamp}`,
    username: "spectateur_test",
    displayName: "Spectateur test",
    avatarUrl: ""
  };
  const event = (type, data) => ({
    id: `guest-preview-${type}-${timestamp}`,
    type,
    timestamp,
    user: viewer,
    data
  });

  if (key === "likeGoal") {
    return postOverlayCardEvent(key, "like-goal", {
      operation: "adjust",
      amount: Math.max(100, Math.round(likeGoalTestAmount() * 0.25))
    });
  }
  if (key === "topDonors" || key === "coinJar") {
    return postOverlayCardEvent(key, "event", event("gift", {
      giftName: "Rose",
      count: 5,
      repeatCount: 5,
      value: 1
    }));
  }
  if (key === "topTappers") {
    return postOverlayCardEvent(key, "event", event("like", {
      count: 250,
      likeCount: 250
    }));
  }
  if (key === "timer") {
    return postOverlayCardEvent(key, "timer", {
      operation: "set",
      seconds: 30,
      label: "TEMPS RESTANT"
    });
  }
  if (key === "multiplierTimer") {
    return postOverlayCardEvent(key, "multiplier-timer", {
      operation: "set",
      seconds: 30,
      multiplier: 2,
      label: "BONUS ACTIF"
    });
  }
  if (key === "winCounter") {
    return postOverlayCardEvent(key, "win-counter", {
      operation: "adjust",
      amount: 1
    });
  }
  if (key === "wheel") {
    const config = normalizeWheelConfig(overlayConfig("wheel"));
    const wheel = config.wheels.find(
      (entry) => entry.id === config.selectedWheelId
    ) || config.wheels[0];
    const choices = wheel.segments.map((segment) => segment.label);
    return postOverlayCardEvent(key, "wheel", {
      choices,
      colors: wheel.segments.map((segment) => segment.color),
      winnerIndex: 0,
      winner: choices[0] || "Surprise !",
      settings: wheel,
      design: wheel.design
    });
  }
  if (key.startsWith("match")) {
    return postOverlayCardEvent(key, "match", matchPlaybackPayload(key));
  }
  if (key === "myActions") {
    return postOverlayCardEvent(key, "event", event("gift", {
      giftName: "Rose",
      count: 1,
      repeatCount: 1,
      value: 1
    }));
  }
  return postOverlayCardEvent(key, "game", {
    effectName: "Effet de démonstration",
    viewer: "Spectateur test"
  });
}

async function previewOverlay(key) {
  if (!isAccountAuthenticated()) return previewGuestOverlay(key);
  return dispatchOverlayTest(key);
}

async function performOverlayQuickAction(key, operation, amount = 0) {
  const item = overlayDefinitions().find((entry) => entry.key === key);
  if (!item || !canAccessOverlay(item) || !overlayUnlocked(item)) {
    throw new Error("Cet overlay n’est pas disponible avec le profil actuel.");
  }
  if (operation === "test") return dispatchOverlayTest(key);

  const config = overlayConfig(key);
  const numericAmount = Math.abs(Number(amount || 0));
  let next = { ...config };
  let previewMessage = null;

  if (["likeGoal", "coinJar", "winCounter"].includes(key)) {
    const current = Number(config.current || 0);
    const delta = operation === "add"
      ? numericAmount
      : operation === "remove"
        ? -numericAmount
        : 0;
    next.current = operation === "reset"
      ? 0
      : key === "winCounter" && config.allowNegative !== false
        ? current + delta
        : Math.max(0, current + delta);
    await saveOverlayConfig(key, next, {
      rerender: false,
      updateCard: true
    });
    if (key === "winCounter") {
      await api.testAction({
        id: `quick_win_${cryptoId()}`,
        type: "overlay.win-counter",
        config: {
          operation: operation === "reset" ? "reset" : "adjust",
          amount: delta
        }
      });
      previewMessage = {
        channel: "win-counter",
        payload: {
          operation: operation === "reset" ? "reset" : "adjust",
          amount: delta
        }
      };
    } else {
      await api.testAction({
        id: `quick_${key}_${cryptoId()}`,
        type: key === "likeGoal" ? "overlay.like-goal" : "overlay.coin-jar",
        config: {
          operation: operation === "reset" ? "reset" : "adjust",
          amount: delta
        }
      });
      previewMessage = {
        channel: key === "likeGoal" ? "like-goal" : "coin-jar",
        payload: {
          operation: operation === "reset" ? "reset" : "adjust",
          amount: delta
        }
      };
    }
  } else if (["timer", "multiplierTimer"].includes(key)) {
    if (operation === "pause") {
      next.timerPaused = !config.timerPaused;
      await saveOverlayConfig(key, next, {
        rerender: false,
        updateCard: true
      });
      await api.testAction({
        id: `quick_timer_${cryptoId()}`,
        type: "timer.add",
        config: {
          operation: next.timerPaused ? "pause" : "resume",
          seconds: 0,
          label: config.title
        }
      });
      previewMessage = {
        channel: "timer",
        payload: {
          operation: next.timerPaused ? "pause" : "resume",
          seconds: 0,
          label: config.title
        }
      };
    } else {
      const delta = operation === "add"
        ? numericAmount
        : operation === "remove"
          ? -numericAmount
          : 0;
      next.seconds = operation === "reset"
        ? 0
        : Math.max(0, Number(config.seconds || 0) + delta);
      await saveOverlayConfig(key, next, {
        rerender: false,
        updateCard: true
      });
      await api.testAction({
        id: `quick_timer_${cryptoId()}`,
        type: "timer.add",
        config: {
          operation: operation === "reset" ? "reset" : "add",
          seconds: delta,
          label: config.title
        }
      });
      previewMessage = {
        channel: "timer",
        payload: {
          operation: operation === "reset" ? "reset" : "add",
          seconds: delta,
          label: config.title
        }
      };
    }
  }

  if (previewMessage) {
    postOverlayCardEvent(key, previewMessage.channel, previewMessage.payload);
  }
  if (dialog.open) scheduleOverlayLivePreview();
  return next;
}
