"use strict";

/** Commandes de la base privée utilisateurs ; toutes les suppressions sont confirmées. */
const CREATOR_AUDIENCE_ACTIONS = new Set([
  "audience-refresh", "audience-page", "audience-rank", "audience-apply-blocked",
  "audience-block", "audience-details", "audience-delete", "audience-cleanup",
  "audience-clear", "audience-import", "audience-export", "audience-merge",
  "audience-show-blocked", "audience-blocked-page", "audience-unblock"
]);

async function mutateCreatorAudience(work, feedback, owner = captureCreatorPrivateOperation()) {
  return perform(async () => {
    assertCreatorPrivateOperation(owner);
    const result = await work();
    assertCreatorPrivateOperation(owner);
    creatorUserSelection.clear();
    await refreshCreatorUsersDatabase({ force: true });
    return result;
  }, feedback);
}

async function handleCreatorAudienceAction({ action, target, id }) {
  if (!CREATOR_AUDIENCE_ACTIONS.has(action)) return ACTION_NOT_HANDLED;
  const owner = captureCreatorPrivateOperation();
  if (action === "audience-refresh") return refreshCreatorUsersDatabase({ force: true });
  if (action === "audience-page") {
    creatorUserPage = Math.max(0, creatorUserPage + (Number(target.dataset.direction) > 0 ? 1 : -1));
    return refreshCreatorUsersDatabase({ force: true });
  }
  if (action === "audience-rank") {
    creatorUserRank = creatorUserRank === id ? "" : id || "";
    creatorUserPage = 0;
    content.querySelectorAll(".audience-rank-chip, .audience-rank-reset").forEach((button) => {
      const selected = button.dataset.id === creatorUserRank;
      button.classList.toggle("active", selected);
      button.setAttribute("aria-pressed", String(selected));
    });
    return refreshCreatorUsersDatabase({ force: true });
  }
  if (!creatorHasUsersDatabase()) throw new Error("La base utilisateurs est indisponible.");
  if (action === "audience-show-blocked") {
    creatorBlockedOpen = !creatorBlockedOpen;
    creatorBlockedPage = 0;
    syncCreatorUsersRuntime({ request: false });
    if (creatorBlockedOpen) return refreshCreatorUsersDatabase({ force: true });
    return;
  }
  if (action === "audience-blocked-page") {
    if (!creatorBlockedOpen) return;
    creatorBlockedPage = Math.max(0, creatorBlockedPage + (Number(target.dataset.direction) > 0 ? 1 : -1));
    return refreshCreatorUsersDatabase({ force: true });
  }
  if (action === "audience-unblock") {
    const entry = creatorUserDatabase?.blockedEntries?.find((row) => row.id === id);
    if (!creatorBlockedOpen || !entry) throw new Error("Ce blocage n'est plus dans la page courante. Actualisez la liste.");
    return mutateCreatorAudience(() => api.users.unblock({ platform: entry.platform, streamer: entry.streamer,
      username: entry.username, rowId: entry.rowId }, owner.uid), "Utilisateur débloqué", owner);
  }
  if (action === "audience-apply-blocked") {
    if (creatorUserStreamer === "*") throw new Error("Choisissez un streamer précis avant de modifier sa liste de blocage.");
    const field = content.querySelector("[data-creator-users-blocked]");
    const usernames = String(field?.value || "").split(/[,;\n\r]+/).map((value) => value.trim()).filter(Boolean);
    return mutateCreatorAudience(async () => {
      const result = await api.users.setBlockedList(usernames, { streamer: creatorUserStreamer });
      if (field) delete field.dataset.edited;
      return result;
    }, "Liste de modération enregistrée", owner);
  }
  if (action === "audience-import") return content.querySelector("[data-creator-users-import]")?.click();
  if (action === "audience-export") {
    return perform(async () => {
      assertCreatorPrivateOperation(owner);
      const value = await api.users.export({ streamer: creatorUserStreamer });
      assertCreatorPrivateOperation(owner);
      downloadCreatorAudienceJson(value);
    }, "Historique utilisateurs exporté");
  }
  if (action === "audience-merge") {
    const ids = [...creatorUserSelection];
    if (ids.length < 2) throw new Error("Sélectionnez au moins deux doublons d'un même utilisateur.");
    if (!(await confirmAction("Fusionner les utilisateurs sélectionnés ? Les contributions seront additionnées. Seule une même identité, sur la même plateforme et le même streamer, peut être fusionnée.", { title: "Fusionner les doublons", confirmLabel: "Fusionner" }))) return;
    return mutateCreatorAudience(() => api.users.merge({ ids }), "Doublons fusionnés", owner);
  }
  if (["audience-cleanup", "audience-clear"].includes(action)) {
    const all = action === "audience-clear";
    const scope = creatorUserStreamer === "*" ? "de tous les streamers de ce compte" : creatorUserStreamer ? `du streamer @${creatorUserStreamer}` : "du streamer actuel";
    const message = all ? `Supprimer tout l’historique utilisateurs ${scope} ? Cette suppression est définitive. La liste de blocage reste conservée.` : `Supprimer les utilisateurs sans diamants ${scope} ? Cette suppression est définitive ; leur prochaine interaction recréera une fiche.`;
    if (!(await confirmAction(message, { title: all ? "Supprimer tout l’historique" : "Nettoyer les utilisateurs", confirmLabel: "Supprimer", danger: true }))) return;
    return mutateCreatorAudience(() => all ? api.users.clear({ streamer: creatorUserStreamer }) : api.users.cleanup({ streamer: creatorUserStreamer }), all ? "Historique supprimé" : "Utilisateurs sans diamants nettoyés", owner);
  }
  const row = creatorUserDatabase?.rows?.find((entry) => entry.id === id);
  if (!row) throw new Error("Cet utilisateur n'est plus dans la page courante. Actualisez la base.");
  if (action === "audience-details") return openCreatorAudienceDetails(row);
  if (action === "audience-block") return mutateCreatorAudience(() => api.users.setBlocked(id, !row.blocked), row.blocked ? "Utilisateur débloqué" : "Utilisateur bloqué globalement", owner);
  if (action === "audience-delete") {
    if (!(await confirmAction(`Supprimer définitivement la fiche de @${row.username || row.name} et ses contributions historiques ? Le blocage éventuel reste conservé.`, { title: "Supprimer un utilisateur", confirmLabel: "Supprimer", danger: true }))) return;
    return mutateCreatorAudience(() => api.users.remove(id), "Fiche utilisateur supprimée", owner);
  }
}

function openCreatorAudienceDetails(row) {
  const rank = creatorViewerRank(row.diamonds);
  const metrics = [["Diamants", row.diamonds], ["Cadeaux", row.gifts], ["Likes", row.likes], ["Commentaires", row.comments], ["Partages", row.shares], ["Interactions", row.events]];
  openEditor({ title: `Utilisateur · @${row.username || row.name}`, kicker: "FICHE UTILISATEUR", body: `<section class="audience-user-detail"><div class="creator-user-identity">${creatorUserAvatar({ ...row, displayName: row.name })}<span data-studio-user-content><strong>@${escapeHtml(row.username)}</strong><small>${row.platform === "kick" ? "Kick" : "TikTok"} · Streamer @${escapeHtml(row.streamer || "")}</small></span>${creatorViewerRankMarkup(rank)}</div>${creatorViewerRankProgressMarkup(row.diamonds)}<div class="audience-detail-metrics">${metrics.map(([label, value]) => `<article><small>${label}</small><strong>${asNumber(value)}</strong></article>`).join("")}</div><p>Première activité : ${creatorUserDate(row.firstSeen)}<br>Dernière activité : ${creatorUserDate(row.lastSeen)}</p><p>${row.blocked ? "Ce viewer est bloqué : ses prochaines interactions ne déclenchent ni actions, ni jeux, ni voix." : "Ce viewer n’est pas bloqué."}</p><small>Ces totaux proviennent des événements réellement reçus par ShenPulse. Aucun statut de présence n’est déduit de la dernière activité.</small></section>` });
}

async function importCreatorAudienceFile(input) {
  const owner = captureCreatorPrivateOperation();
  const file = input.files?.[0];
  input.value = "";
  if (!file) return;
  if (file.size > 10 * 1024 * 1024) throw new Error("Le fichier JSON dépasse la limite de 10 Mo.");
  let data;
  try { data = JSON.parse((await file.text()).replace(/^\uFEFF/, "")); }
  catch { throw new Error("Le fichier ne contient pas un JSON valide."); }
  assertCreatorPrivateOperation(owner);
  return mutateCreatorAudience(() => api.users.import(data), "Historique utilisateurs importé", owner);
}

function downloadCreatorAudienceJson(value) {
  const blob = new Blob([JSON.stringify(value, null, 2)], { type: "application/json;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `shenpulse-utilisateurs-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

registerActionHandler(CREATOR_AUDIENCE_ACTIONS, handleCreatorAudienceAction);
