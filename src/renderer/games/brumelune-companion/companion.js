"use strict";

const root = document.getElementById("app");
const params = new URLSearchParams(location.search);
const sessionKey = "shenpulse.brumelune.companion";
let roomCode = cleanCode(params.get("room") || "");
let mode = "player";
let token = "";
let identity = null;
let state = null;
let error = "";
let pollTimer = 0;
let selection = { targetIds: [], targetId: "", choice: "", camp: "", eventId: "", borrowedAction: "" };

try {
  const saved = JSON.parse(sessionStorage.getItem(sessionKey) || "null");
  if (saved?.roomCode === roomCode) {
    token = String(saved.token || "");
    mode = saved.mode === "spectator" ? "spectator" : "player";
    identity = saved.identity || null;
  }
} catch {}

root.addEventListener("click", handleClick);
root.addEventListener("submit", handleSubmit);
render();
if (token) void refreshState();

function render() {
  root.innerHTML = `${brand()}${token ? renderSession() : renderJoin()}`;
}

function brand() {
  return `<header class="brand"><span class="brand-mark">◐</span><div><small>ShenPulse présente</small><strong>Veilleurs de Brumelune</strong></div></header>`;
}

function renderJoin() {
  return `<section class="card">
    <span class="eyebrow">COMPAGNON LOCAL</span>
    <h1>Entrez dans la brume</h1>
    <p>Votre rôle et vos choix restent privés sur cet appareil.</p>
    <div class="segmented"><button data-mode="player" class="${mode === "player" ? "active" : ""}">Je joue</button><button data-mode="spectator" class="${mode === "spectator" ? "active" : ""}">Je regarde</button></div>
    <form data-join>
      <label class="field"><span>Code de salle</span><input name="roomCode" value="${escapeHtml(roomCode)}" maxlength="8" required autocomplete="off"></label>
      ${mode === "player" ? `<label class="field"><span>Votre pseudonyme</span><input name="playerId" placeholder="Exactement comme indiqué par l’hôte" required autocomplete="nickname"></label>` : `<label class="field"><span>Votre pseudonyme</span><input name="name" placeholder="Spectateur" maxlength="40" required autocomplete="nickname"></label>`}
      <label class="field"><span>Code personnel</span><input name="pin" inputmode="numeric" maxlength="8" required autocomplete="one-time-code"></label>
      ${mode === "spectator" ? `<label class="field"><span>Vision</span><select name="omniscient"><option value="false">Enquêteur</option><option value="true">Omniscient (code spécial)</option></select></label>` : ""}
      <button class="primary" type="submit">Rejoindre la salle</button>
    </form>
    ${error ? `<div class="error">${escapeHtml(error)}</div>` : ""}
  </section>`;
}

function renderSession() {
  if (!state) return `<section class="card loader">Connexion à la salle…</section>`;
  const self = state.self;
  const phase = phaseLabel(state);
  return `<section class="card">
    <div class="phase-head"><div><span class="status">${escapeHtml(phase)}</span><h2>${escapeHtml(identity?.name || self?.name || "Spectateur")}</h2><small>${state.day ? `Jour ${state.day}` : "Avant l’aube"} · ${state.night ? `Nuit ${state.night}` : "Préparation"}</small></div><button class="ghost" data-leave>Quitter</button></div>
    ${state.warning ? `<div class="error">${escapeHtml(state.warning)}</div>` : ""}
    ${self ? renderPrivate(self) : renderSpectator()}
    ${renderPlayers()}
    ${error ? `<div class="error">${escapeHtml(error)}</div>` : ""}
  </section>`;
}

function renderPrivate(self) {
  const prompt = state.actionPrompt;
  return `<article class="role-card">
    <span class="camp">${escapeHtml(campName(self.currentCamp))}</span>
    <h2>${escapeHtml(self.role?.name || "Rôle secret")}</h2>
    <p class="secret">${escapeHtml(self.role?.secretDescription || "")}</p>
    <p><strong>Victoire :</strong> ${escapeHtml(self.role?.winCondition || "")}</p>
    ${self.occupation ? `<div class="note"><strong>${escapeHtml(self.occupation.name)}</strong><br>${escapeHtml(self.occupation.description)}</div>` : ""}
    ${(self.messages || []).slice(-4).map((message) => `<div class="note">${escapeHtml(message.message)}</div>`).join("")}
    ${state.phase === "reveal" && !self.roleRevealed ? `<button class="primary" data-confirm-role>J’ai lu et mémorisé mon rôle</button>` : prompt ? renderActionPrompt(prompt) : state.canVote ? renderVotePrompt() : `<p class="note">Aucune action privée à effectuer pour le moment.</p>`}
  </article>`;
}

function renderActionPrompt(prompt) {
  const choices = prompt.action === "choose-camp"
    ? [{ id: "village", name: "Veilleurs" }, { id: "hostile", name: "Brumes" }]
    : prompt.action === "alchemy"
      ? [{ id: "heal", name: "Essence réparatrice" }, { id: "poison", name: "Fiole corrosive" }]
      : prompt.action === "borrow"
        ? (prompt.borrowedOptions || []).map((id) => ({ id, name: ({ inspect: "Lecture astrale", protect: "Halo protecteur", mark: "Marque runique" })[id] || id }))
        : (prompt.events || []).map((event) => ({ id: event.id, name: event.name }));
  const multi = ["bond", "charm"].includes(prompt.action);
  return `<div class="prompt"><h3>${escapeHtml(prompt.instruction)}</h3>
    ${choices.length ? `<div class="choices">${choices.map((choice) => `<button class="choice ${isChoiceSelected(prompt.action, choice.id) ? "selected" : ""}" data-prompt-choice="${escapeHtml(prompt.action)}" data-value="${escapeHtml(choice.id)}">${escapeHtml(choice.name)}</button>`).join("")}</div>` : ""}
    ${(prompt.targets || []).length ? `<div class="choices">${prompt.targets.map((target) => `<button class="choice ${isTargetSelected(target.id) ? "selected" : ""}" data-target="${escapeHtml(target.id)}" data-multi="${multi}">Siège ${target.seat} · ${escapeHtml(target.name)}</button>`).join("")}</div>` : ""}
    <button class="primary" data-send-night data-step="${escapeHtml(prompt.stepId)}">Confirmer l’action</button>
    ${prompt.canSkip ? `<button class="ghost" data-skip-night data-step="${escapeHtml(prompt.stepId)}">Ne rien faire</button>` : ""}
  </div>`;
}

function renderVotePrompt() {
  const targets = (state.players || []).filter((player) => player.alive && player.id !== state.self.id);
  return `<div class="prompt"><h3>Votre bulletin</h3><div class="choices">${targets.map((target) => `<button class="choice ${selection.targetId === target.id ? "selected" : ""}" data-vote-target="${escapeHtml(target.id)}">${escapeHtml(target.name)}</button>`).join("")}</div><button class="primary" data-send-vote>Sceller mon vote</button></div>`;
}

function renderSpectator() {
  if (state.finished) return `<div class="note">Partie terminée · ${escapeHtml(state.victoryReason || "")}</div>`;
  const alive = (state.players || []).filter((player) => player.alive);
  return `<div class="prompt"><h3>Votre pronostic</h3><div class="prediction-grid"><select data-predict-player><option value="">Choisir un joueur</option>${alive.map((player) => `<option value="${escapeHtml(player.id)}">${escapeHtml(player.name)}</option>`).join("")}</select><select data-predict-camp><option value="hostile">Brumes</option><option value="village">Veilleurs</option><option value="solitary">Solitaire</option></select><button class="primary" data-send-prediction>Enregistrer le pronostic</button></div></div>`;
}

function renderPlayers() {
  return `<div class="players"><h3>Village</h3>${(state.players || []).map((player) => `<div class="player-row ${player.alive ? "" : "dead"}"><span>Siège ${player.seat} · ${escapeHtml(player.name)}</span><b>${player.alive ? "En vie" : "Éliminé"}</b></div>`).join("")}</div>`;
}

async function handleSubmit(event) {
  const form = event.target.closest("[data-join]");
  if (!form) return;
  event.preventDefault();
  error = "";
  const data = new FormData(form);
  roomCode = cleanCode(data.get("roomCode"));
  try {
    const result = await request("/api/join", {
      method: "POST",
      body: JSON.stringify({ roomCode, mode, playerId: data.get("playerId"), name: data.get("name"), pin: data.get("pin"), omniscient: data.get("omniscient") === "true" })
    });
    token = result.token;
    identity = result;
    sessionStorage.setItem(sessionKey, JSON.stringify({ roomCode, token, mode, identity }));
    render();
    await refreshState();
  } catch (caught) {
    error = caught.message;
    render();
  }
}

function handleClick(event) {
  const button = event.target.closest("button");
  if (!button) return;
  if (button.dataset.mode) { mode = button.dataset.mode; error = ""; render(); return; }
  if (button.dataset.leave !== undefined) { leave(); return; }
  if (button.dataset.target) {
    if (button.dataset.multi === "true") {
      const id = button.dataset.target;
      selection.targetIds = selection.targetIds.includes(id) ? selection.targetIds.filter((value) => value !== id) : [...selection.targetIds, id].slice(-2);
    } else selection.targetId = button.dataset.target;
    render(); return;
  }
  if (button.dataset.voteTarget) { selection.targetId = button.dataset.voteTarget; render(); return; }
  if (button.dataset.promptChoice) {
    const key = button.dataset.promptChoice === "choose-camp" ? "camp" : button.dataset.promptChoice === "choose-event" ? "eventId" : button.dataset.promptChoice === "borrow" ? "borrowedAction" : "choice";
    selection[key] = button.dataset.value;
    render(); return;
  }
  if (button.dataset.sendNight !== undefined) void sendAction("night-action", { stepId: button.dataset.step, ...selection });
  if (button.dataset.skipNight !== undefined) void sendAction("night-action", { stepId: button.dataset.step, skip: "true" });
  if (button.dataset.confirmRole !== undefined) void sendAction("confirm-role", {});
  if (button.dataset.sendVote !== undefined) void sendAction("vote", { targetId: selection.targetId });
  if (button.dataset.sendPrediction !== undefined) {
    const playerId = root.querySelector("[data-predict-player]")?.value || "";
    const guessedCamp = root.querySelector("[data-predict-camp]")?.value || "";
    void sendAction("prediction", { playerId, guessedCamp, confidence: "50" });
  }
}

async function sendAction(type, payload) {
  try {
    await request("/api/action", { method: "POST", body: JSON.stringify({ roomCode, token, type, payload }) });
    selection = { targetIds: [], targetId: "", choice: "", camp: "", eventId: "", borrowedAction: "" };
    error = "Action transmise à l’hôte.";
    render();
  } catch (caught) {
    error = caught.message;
    render();
  }
}

async function refreshState() {
  window.clearTimeout(pollTimer);
  if (!token) return;
  try {
    state = await request(`/api/state?room=${encodeURIComponent(roomCode)}&token=${encodeURIComponent(token)}`);
    error = "";
    render();
  } catch (caught) {
    error = caught.message;
    if (/expir|introuvable/i.test(error)) { leave(); return; }
  }
  pollTimer = window.setTimeout(refreshState, 1200);
}

async function request(url, options = {}) {
  const response = await fetch(url, { ...options, headers: { "Content-Type": "application/json", ...(options.headers || {}) } });
  const value = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(value.error || "Connexion impossible.");
  return value;
}

function leave() {
  window.clearTimeout(pollTimer);
  token = ""; identity = null; state = null; error = "";
  sessionStorage.removeItem(sessionKey);
  render();
}

function phaseLabel(value) {
  return ({ reveal: "Rôles", "night-intro": "Préparation", night: "Nuit", dawn: "Aube", discussion: "Conseil", vote: "Vote", verdict: "Verdict", ended: "Terminé", "death-trigger": "Réaction" })[value.phase] || value.phase;
}

function campName(camp) { return ({ village: "Camp des Veilleurs", hostile: "Camp des Brumes", solitary: "Objectif solitaire", undecided: "Allégeance indécise" })[camp] || camp; }
function isTargetSelected(id) { return selection.targetId === id || selection.targetIds.includes(id); }
function isChoiceSelected(action, id) { return action === "choose-camp" ? selection.camp === id : action === "choose-event" ? selection.eventId === id : action === "borrow" ? selection.borrowedAction === id : selection.choice === id; }
function cleanCode(value) { return String(value || "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8); }
function escapeHtml(value) { return String(value ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;"); }
