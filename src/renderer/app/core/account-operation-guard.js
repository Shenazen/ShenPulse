"use strict";

/** Lie une opération asynchrone à son compte et à sa session d'interface. */
let creatorPrivateOperationGeneration = 0;

function creatorPrivateOperationUid() {
  const visible = typeof visibleAccountSession === "function" ? visibleAccountSession() : null;
  return String(visible?.uid || snapshot?.state?.settings?.account?.uid || "");
}

function captureCreatorPrivateOperation() {
  return { uid: creatorPrivateOperationUid(), generation: creatorPrivateOperationGeneration };
}

function creatorPrivateOperationActive(owner) {
  return owner?.generation === creatorPrivateOperationGeneration && owner.uid === creatorPrivateOperationUid() && isAccountAuthenticated();
}

function assertCreatorPrivateOperation(owner) {
  if (!creatorPrivateOperationActive(owner)) throw new Error("Le compte a changé pendant cette opération. Recommencez depuis le compte actuel.");
}

function invalidateCreatorPrivateOperations() {
  creatorPrivateOperationGeneration += 1;
  if (typeof stopRendererAudioPlayback === "function") stopRendererAudioPlayback();
}
