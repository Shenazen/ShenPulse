"use strict";

/** CRUD des commandes explicite et borné au compte et au profil de départ. */
const CREATOR_CHATBOT_ACTIONS = new Set(["chatbot-add", "chatbot-edit", "chatbot-toggle", "chatbot-delete", "chatbot-preview"]);
const creatorChatbotPending = new Set();

async function creatorChatbotMutation(work, message, owner) {
  return perform(async () => {
    assertCreatorChatbotOwner(owner);
    await work();
    assertCreatorChatbotOwner(owner);
    const updated = await api.getSnapshot();
    assertCreatorChatbotOwner(owner);
    acceptSnapshot(updated);
    if (!syncCreatorChatbotRuntime()) render();
  }, message);
}

async function handleCreatorChatbotAction({ action, target, id }) {
  if (!CREATOR_CHATBOT_ACTIONS.has(action)) return ACTION_NOT_HANDLED;
  const owner = creatorChatbotCaptureOwner();
  assertCreatorChatbotOwner(owner);
  if (action === "chatbot-add") return openCreatorChatbotEditor(null, target.dataset.kind);
  const entry = (snapshot.state.commands || []).find((item) => String(item.id) === String(id));
  if (!entry) throw new Error("Cette commande n’existe plus dans le profil actif.");
  assertCreatorChatbotEditable(entry);
  if (action === "chatbot-edit") return openCreatorChatbotEditor(entry);
  if (action === "chatbot-preview") return openCreatorChatbotPreview(entry);
  const key = `${owner.uid}:${owner.profileId}:${entry.id}`;
  if (creatorChatbotPending.has(key)) return;
  creatorChatbotPending.add(key);
  const wasDisabled = target.disabled;
  target.disabled = true;
  try {
    if (action === "chatbot-toggle") return await creatorChatbotMutation(() => api.upsert("commands", { ...entry, enabled: target.checked }), "État de la commande mis à jour", owner);
    if (action === "chatbot-delete") {
      if (!(await confirmAction(`Supprimer « ${creatorChatbotEntryTitle(entry)} » du profil actif ?`, { title: "Supprimer cette entrée", confirmLabel: "Supprimer", danger: true }))) return;
      return await creatorChatbotMutation(() => api.remove("commands", entry.id), "Entrée supprimée", owner);
    }
  } catch (error) {
    if (action === "chatbot-toggle") target.checked = entry.enabled !== false;
    throw error;
  } finally {
    creatorChatbotPending.delete(key);
    target.disabled = wasDisabled;
  }
}

registerActionHandler(CREATOR_CHATBOT_ACTIONS, handleCreatorChatbotAction);
