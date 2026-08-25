"use strict";

/** Chrome principal, compte et cycle des dialogues. */

sessionButton.addEventListener("click", () =>
  isAccountAuthenticated()
    ? toggleSession().catch(() => {})
    : openAccountLogin()
);
accountMenuButton.addEventListener("click", () => {
  const opening = accountMenu.hidden;
  accountMenu.hidden = !opening;
  accountMenuButton.setAttribute("aria-expanded", String(opening));
});
profilePickerButton.addEventListener("click", () => {
  if (!isAccountAuthenticated()) return openAccountLogin();
  const opening = profileMenu.hidden;
  profileMenu.hidden = !opening;
  profilePickerButton.setAttribute("aria-expanded", String(opening));
});
profileMenu.addEventListener("click", async (event) => {
  if (!isAccountAuthenticated()) return openAccountLogin();
  const choice = event.target.closest("[data-profile-select]");
  if (!choice) return;
  profileMenu.hidden = true;
  profilePickerButton.setAttribute("aria-expanded", "false");
  await perform(
    () => api.selectProfile(choice.dataset.profileSelect),
    "Profil actif modifié"
  );
  snapshot = await api.getSnapshot();
  render();
});
document.addEventListener("click", (event) => {
  if (profileControl.contains(event.target)) return;
  profileMenu.hidden = true;
  profilePickerButton.setAttribute("aria-expanded", "false");
});
profileManageButton.addEventListener("click", () => {
  if (!isAccountAuthenticated()) return openAccountLogin();
  profileMenu.hidden = true;
  profilePickerButton.setAttribute("aria-expanded", "false");
  openProfileManager();
});
gameSessionSummary.addEventListener("click", () => {
  if (!isAccountAuthenticated()) return openAccountLogin();
  const gameSession = activeGameSession();
  if (!gameSession) return;
  if (!requireGameAccess(gameSession.pack)) return;
  selectedGameId = gameSession.packId;
  gamePageMode = "detail";
  gameWorkspaceStep = "launch";
  currentPage = "games";
  render();
  content.scrollTop = 0;
});
gameSessionStop.addEventListener("click", async () => {
  if (!isAccountAuthenticated()) return openAccountLogin();
  if (gameSessionStop.disabled) return;
  gameSessionStop.disabled = true;
  gameSessionStop.textContent = "…";
  gameSessionStop.title = "Arrêt du serveur Minecraft en cours…";
  try {
    await perform(async () => {
      acceptSnapshot(await api.stopGameSession());
      render();
    }, "Serveur et session de jeu arrêtés");
  } finally {
    gameSessionStop.disabled = false;
    gameSessionStop.textContent = "■";
    gameSessionStop.title = "Arrêter la session de jeu";
  }
});
tiktokAccountButton.addEventListener("click", () =>
  isAccountAuthenticated() ? openTikTokEditor() : openAccountLogin()
);
tiktokConnectionButton.addEventListener("click", () =>
  isAccountAuthenticated()
    ? toggleTikTok().catch(() => {})
    : openAccountLogin()
);
profileSelect.addEventListener("change", async () => {
  if (!isAccountAuthenticated()) return openAccountLogin();
  await perform(() => api.selectProfile(profileSelect.value), "Profil actif modifié");
  snapshot = await api.getSnapshot();
  render();
});

dialogForm.addEventListener(
  "invalid",
  (event) => {
    event.preventDefault();
    const control = event.target;
    const label =
      control.closest(".field")?.querySelector(":scope > span")?.textContent ||
      control.name ||
      "Champ";
    showDialogError(
      `${label} : ${control.validationMessage || "valeur invalide."}`
    );
    requestAnimationFrame(() => {
      control.scrollIntoView({ behavior: "smooth", block: "center" });
      control.focus({ preventScroll: true });
    });
  },
  true
);

dialogForm.addEventListener("input", () => {
  if (!dialogError.hidden) clearDialogError();
});

dialogForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!dialogSubmitHandler) return dialog.close();
  const activeDialogSessionId = dialogSessionId;
  const activeSubmitHandler = dialogSubmitHandler;
  clearDialogError();
  const defaultLabel =
    dialogSubmitButton.dataset.defaultLabel ||
    dialogSubmitButton.textContent ||
    "Enregistrer";
  const pendingLabel =
    dialogSubmitButton.dataset.pendingLabel ||
    "Enregistrement…";
  const successMessage = dialog.dataset.successMessage || "";
  dialogSubmitButton.disabled = true;
  dialogSubmitButton.textContent = pendingLabel;
  dialogForm.setAttribute("aria-busy", "true");
  try {
    await activeSubmitHandler(new FormData(dialogForm));
    if (
      activeDialogSessionId !== dialogSessionId ||
      activeSubmitHandler !== dialogSubmitHandler
    ) {
      return;
    }
    dialog.close();
    render();
    if (successMessage) toast(successMessage);
  } catch (error) {
    if (
      activeDialogSessionId !== dialogSessionId ||
      activeSubmitHandler !== dialogSubmitHandler
    ) {
      return;
    }
    showDialogError(error.message || String(error));
    toast("Configuration invalide", error.message || String(error), true);
  } finally {
    if (
      activeDialogSessionId === dialogSessionId &&
      activeSubmitHandler === dialogSubmitHandler
    ) {
      dialogForm.setAttribute("aria-busy", "false");
      dialogSubmitButton.disabled = false;
      dialogSubmitButton.textContent = defaultLabel;
    }
  }
});

dialog.addEventListener("click", (event) => {
  if (!event.target.closest("[data-dialog-close]")) return;
  if (
    dialog.dataset.variant === "game-purchase" &&
    dialogForm.getAttribute("aria-busy") === "true"
  ) {
    api.account.cancelCheckout({ type: "game" }).catch(() => {});
  }
  dialogSubmitHandler = null;
  dialog.close("cancel");
});

dialog.addEventListener("cancel", () => {
  if (
    dialog.dataset.variant === "game-purchase" &&
    dialogForm.getAttribute("aria-busy") === "true"
  ) {
    api.account.cancelCheckout({ type: "game" }).catch(() => {});
  }
  dialogSubmitHandler = null;
});

dialog.addEventListener("close", () => {
  stopEditorAudioPreview();
  dialogSessionId += 1;
  dialogSubmitHandler = null;
  dialogForm.setAttribute("aria-busy", "false");
  dialogSubmitButton.disabled = false;
});

dialog.addEventListener("click", (event) => {
  const accountCommand = event.target.closest("[data-account-command]");
  if (accountCommand) {
    event.preventDefault();
    const command = accountCommand.dataset.accountCommand;
    const currentEmail =
      dialogBody.querySelector('[name="email"]')?.value || "";
    if (command === "login" || command === "register") {
      openAccountLogin(command, currentEmail);
      return;
    }
    if (command === "forgot") {
      if (!currentEmail) {
        return showDialogError(
          "Renseignez d’abord votre adresse e-mail."
        );
      }
      const activeDialogSessionId = dialogSessionId;
      accountCommand.disabled = true;
      accountCommand.textContent = "Envoi en cours…";
      api.account
        .requestPasswordReset({ email: currentEmail })
        .then((result) =>
          activeDialogSessionId === dialogSessionId
            ? toast("E-mail de réinitialisation", result.message)
            : undefined
        )
        .catch((error) => {
          if (activeDialogSessionId === dialogSessionId) {
            showDialogError(error.message || String(error));
          }
        })
        .finally(() => {
          if (activeDialogSessionId !== dialogSessionId) return;
          accountCommand.disabled = false;
          accountCommand.textContent = "Mot de passe oublié ?";
        });
      return;
    }
    if (command === "google") {
      const activeDialogSessionId = dialogSessionId;
      const emailHint = String(
        dialogBody.querySelector('[name="email"]')?.value || ""
      ).trim();
      accountCommand.disabled = true;
      accountCommand.innerHTML =
        '<span aria-hidden="true">G</span> Connexion dans le navigateur…';
      waitForPendingAccountLogout()
        .then(() => api.account.loginWithBrowser({ email: emailHint }))
        .then(async (status) => {
          if (activeDialogSessionId !== dialogSessionId) return;
          accountSession = status;
          acceptSnapshot(await api.getSnapshot());
          if (activeDialogSessionId !== dialogSessionId) return;
          await syncAdminSessionFromAccount();
          if (activeDialogSessionId !== dialogSessionId) return;
          await refreshGameCheatAccess({ renderWhenChanged: false });
          if (activeDialogSessionId !== dialogSessionId) return;
          dialog.close();
          render();
          toast("Compte Google connecté", status.email);
        })
        .catch((error) => {
          if (activeDialogSessionId !== dialogSessionId) return;
          showDialogError(error.message || String(error));
          accountCommand.disabled = false;
          accountCommand.innerHTML =
            '<span aria-hidden="true">G</span> Continuer avec Google';
        });
      return;
    }
  }
  const previewTest = event.target.closest("[data-overlay-preview-test]");
  if (previewTest) {
    event.preventDefault();
    perform(
      () => dispatchOverlayTest(previewTest.dataset.overlayPreviewTest),
      "Test live relancé"
    ).catch(() => {});
    return;
  }
  const action = event.target.closest("[data-action]");
  if (
    action &&
    [
      "overlay-quick",
      "copy",
      "open-url",
      "open-minecraft-mode"
    ].includes(action.dataset.action)
  ) {
    event.preventDefault();
    handleAction(action).catch(() => {});
  }
});

dialog.addEventListener("input", (event) => {
  if (!event.target.matches("[data-game-effect-library-search]")) return;
  const query = event.target.value.trim().toLocaleLowerCase("fr");
  let visibleCount = 0;
  dialogBody
    .querySelectorAll("[data-game-effect-library-group]")
    .forEach((group) => {
      let groupCount = 0;
      group
        .querySelectorAll("[data-select-game-effect]")
        .forEach((option) => {
          const visible =
            !query ||
            String(option.dataset.filter || "").includes(query);
          option.hidden = !visible;
          if (visible) {
            groupCount += 1;
            visibleCount += 1;
          }
        });
      group.hidden = groupCount === 0;
    });
  const empty = dialogBody.querySelector(
    "[data-game-effect-library-empty]"
  );
  if (empty) empty.hidden = visibleCount > 0;
});

dialog.addEventListener("click", (event) => {
  const openLibrary = event.target.closest(
    "[data-open-game-effect-library]"
  );
  const selectedEffect = event.target.closest(
    "[data-select-game-effect]"
  );
  const target = selectedEffect || openLibrary;
  if (!target) return;

  event.preventDefault();
  const pack = snapshot.packs.find(
    (entry) => entry.id === target.dataset.pack
  );
  if (!pack) {
    return showDialogError("Le catalogue de ce jeu est introuvable.");
  }
  if (!requireGameAccess(pack)) {
    dialog.close();
    return;
  }
  const row = target.dataset.rule
    ? gameInteractionCatalogContext?.packId === pack.id &&
      gameInteractionCatalogContext.row?.rule?.id === target.dataset.rule
      ? gameInteractionCatalogContext.row
      : findGameInteractionRow(
          pack.id,
          target.dataset.rule,
          target.dataset.rowAction,
          target.dataset.index
        )
    : gameInteractionCatalogContext?.packId === pack.id
      ? gameInteractionCatalogContext.row
      : null;
  if (openLibrary) {
    const context = gameInteractionEditorContext;
    const draftRow =
      context?.packId === pack.id && context.effectId === target.dataset.effect
        ? gameInteractionDraftFromForm(
            context.pack,
            context.effect,
            context,
            new FormData(dialogForm)
          )
        : row;
    return openGameInteractionCatalog(pack, draftRow);
  }

  const effect = pack.effects.find(
    (entry) => entry.id === target.dataset.effect
  );
  if (!effect) {
    return showDialogError("Cette interaction n’existe plus.");
  }
  openGameInteractionEditor(pack, effect, row);
});

dialog.addEventListener("click", (event) => {
  const openLibrary = event.target.closest("[data-open-media-library]");
  if (openLibrary) {
    globalMediaLibrary.open(openLibrary);
    return;
  }
  const clearMedia = event.target.closest("[data-clear-media]");
  if (clearMedia) {
    globalMediaLibrary.clear(
      clearMedia.closest("[data-media-picker-root]")
    );
    return;
  }
  const mediaPreview = event.target.closest("[data-media-preview-url]");
  if (mediaPreview) {
    perform(() =>
      api.testAction({
        id: `preview_${cryptoId()}`,
        type: "audio.play",
        config: {
          url: mediaPreview.dataset.mediaPreviewUrl,
          volume: 0.9,
          previewScope: "editor-dialog"
        }
      })
    ).catch(() => {});
    return;
  }
  const giftChoice = event.target.closest("[data-gift-choice]");
  if (giftChoice) {
    const root = giftChoice.closest("[data-gift-picker-root]");
    const input = root?.querySelector("[data-gift-picker]");
    const idInput = root?.querySelector("[data-gift-id-input]");
    if (input) {
      input.value = giftChoice.dataset.giftChoice;
      if (idInput) idInput.value = giftChoice.dataset.giftId || "";
      updateGiftPickerSelection(root, {
        id: giftChoice.dataset.giftId,
        name: giftChoice.dataset.giftChoice,
        imageUrl: giftChoice.dataset.giftImage
      });
      root.querySelector("[data-gift-results]").hidden = true;
    }
    return;
  }
  const giftClear = event.target.closest("[data-gift-clear]");
  if (giftClear) {
    const root = giftClear.closest("[data-gift-picker-root]");
    const input = root?.querySelector("[data-gift-picker]");
    const idInput = root?.querySelector("[data-gift-id-input]");
    if (input) input.value = "";
    if (idInput) idInput.value = "";
    updateGiftPickerSelection(root);
    const results = root?.querySelector("[data-gift-results]");
    if (results) results.hidden = true;
    return;
  }
});

mediaLibrarySearchInput.addEventListener("input", () => {
  clearTimeout(mediaLibrarySearchTimer);
  if (mediaLibrarySource !== "web") {
    renderMediaLibrary();
    return;
  }
  mediaLibrarySearchTimer = setTimeout(
    () => loadRemoteMediaLibrary(),
    300
  );
});

mediaLibraryDialog.addEventListener("click", (event) => {
  const source = event.target.closest("[data-media-source]");
  if (source) {
    mediaLibrarySource = source.dataset.mediaSource;
    mediaLibraryKind = "all";
    mediaLibrarySelected = null;
    mediaLibraryRemotePage = 1;
    mediaLibraryRemoteHasMore = false;
    mediaLibrarySearchInput.value = "";
    if (mediaLibrarySource === "web") loadRemoteMediaLibrary();
    else renderMediaLibrary();
    return;
  }
  const filter = event.target.closest("[data-media-kind]");
  if (filter) {
    mediaLibraryKind = filter.dataset.mediaKind;
    if (
      mediaLibrarySource === "web" &&
      mediaLibraryContext?.kind === "visual"
    ) {
      loadRemoteMediaLibrary();
    } else {
      renderMediaLibrary();
    }
    return;
  }
  const selection = event.target.closest("[data-media-select]");
  if (selection) {
    mediaLibrarySelected = findMediaLibraryItem(
      selection.dataset.mediaSelect
    );
    renderMediaLibrary();
    return;
  }
  const preview = event.target.closest("[data-media-preview-url]");
  if (preview) {
    perform(() =>
      api.testAction({
        id: `preview_${cryptoId()}`,
        type: "audio.play",
        config: { url: preview.dataset.mediaPreviewUrl, volume: 0.9 }
      })
    ).catch(() => {});
    return;
  }
  if (event.target.closest("[data-media-load-more]")) {
    loadRemoteMediaLibrary({ append: true });
  }
});

document
  .getElementById("media-library-close")
  .addEventListener("click", globalMediaLibrary.close);
document
  .getElementById("media-library-cancel")
  .addEventListener("click", globalMediaLibrary.close);
mediaLibraryConfirmButton.addEventListener(
  "click",
  globalMediaLibrary.confirm
);
mediaLibraryUploadButton.addEventListener(
  "click",
  globalMediaLibrary.upload
);
mediaLibraryDialog.addEventListener("cancel", (event) => {
  event.preventDefault();
  globalMediaLibrary.close();
});

confirmationForm.addEventListener("submit", (event) => {
  event.preventDefault();
  finishConfirmation(true);
});

confirmationCancelButton.addEventListener("click", () => {
  finishConfirmation(false);
});

confirmationDialog.addEventListener("cancel", (event) => {
  event.preventDefault();
  finishConfirmation(false);
});

confirmationDialog.addEventListener("close", () => {
  if (confirmationResolver) finishConfirmation(false);
});
