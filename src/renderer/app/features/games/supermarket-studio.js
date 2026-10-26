"use strict";
let studioInstallScope = null, studioInstallBusy = false, studioInstallRequest = 0;
const studioInstallDialog = document.createElement('dialog');
studioInstallDialog.className = 'studio-install-dialog'; studioInstallDialog.id = 'studio-install-dialog';
studioInstallDialog.setAttribute('aria-labelledby', 'studio-install-title'); document.body.append(studioInstallDialog);
studioInstallDialog.addEventListener('cancel', event => { if (studioInstallBusy) event.preventDefault(); });
studioInstallDialog.addEventListener('close', () => { studioInstallScope = null; studioInstallRequest++; });
function studioInstallShell(body) { studioInstallDialog.innerHTML=ShenPulseGameWorkspace.renderStudioShell(supermarketContext(),body,{busy:studioInstallBusy}); }
async function openStudioInstallation() {
  if (!requireGameAccess(supermarketPack())) return;
  studioInstallScope = { profileId:snapshot.state.session.profileId, accountUid:snapshot.state.settings.account?.uid || "" };
  const request = ++studioInstallRequest; studioInstallBusy = false;
  studioInstallShell(ShenPulseGameWorkspace.renderStudioStatus('Détection des logiciels installés…'));
  if (!studioInstallDialog.open) studioInstallDialog.showModal();
  try {
    const studios = await api.studios.status();
    if (request !== studioInstallRequest || !studioInstallDialog.open) return;
    studioInstallShell(ShenPulseGameWorkspace.renderStudioChoices(supermarketContext(),studios));
  } catch (error) { if (request === studioInstallRequest) studioInstallShell(ShenPulseGameWorkspace.renderStudioError(supermarketContext(),error.message || 'La détection a échoué.')); }
}
async function installOnStudio(studioId) {
  if (studioInstallBusy || !studioInstallScope) return;
  if (snapshot.state.session.profileId !== studioInstallScope.profileId) { studioInstallShell(ShenPulseGameWorkspace.renderStudioStatus('Le profil a changé. Fermez cette fenêtre et recommencez.','error')); return; }
  const scope = { ...studioInstallScope,studioId }, request = studioInstallRequest; studioInstallBusy = true;
  studioInstallShell(ShenPulseGameWorkspace.renderStudioStatus('Installation de la scène et des sources…'));
  try {
    const result = await api.studios.install(scope); studioInstallBusy = false;
    if (request !== studioInstallRequest || !studioInstallDialog.open) return;
    if (result.status !== 'installed') {
      studioInstallShell(ShenPulseGameWorkspace.renderStudioBlocked(supermarketContext(),result,studioId)); return;
    }
    studioInstallShell(ShenPulseGameWorkspace.renderStudioResult(supermarketContext(),result));
  } catch (error) {
    studioInstallBusy = false;
    if (request === studioInstallRequest) studioInstallShell(ShenPulseGameWorkspace.renderStudioError(supermarketContext(),error.message || 'Installation non confirmée.',studioId));
  }
}
const STUDIO_INSTALL_ACTIONS = new Set(['market-studio-open','market-studio-install','market-studio-close']);
registerActionHandler(STUDIO_INSTALL_ACTIONS, async ({ action, target }) => {
  if (!STUDIO_INSTALL_ACTIONS.has(action)) return ACTION_NOT_HANDLED;
  if (action === 'market-studio-open') return openStudioInstallation();
  if (action === 'market-studio-install') return installOnStudio(target.dataset.id);
  if (!studioInstallBusy) studioInstallDialog.close();
});
