"use strict";
let studioInstallScope = null, studioInstallBusy = false, studioInstallRequest = 0;
const studioInstallDialog = document.createElement('dialog');
studioInstallDialog.className = 'studio-install-dialog'; studioInstallDialog.id = 'studio-install-dialog';
studioInstallDialog.setAttribute('aria-labelledby', 'studio-install-title'); document.body.append(studioInstallDialog);
studioInstallDialog.addEventListener('cancel', event => { if (studioInstallBusy) event.preventDefault(); });
studioInstallDialog.addEventListener('close', () => { studioInstallScope = null; studioInstallRequest++; });
function studioScopeCurrent(scope=studioInstallScope){return !!scope && supermarketPack()?.id===scope.packId && snapshot.state.session.profileId===scope.profileId && (snapshot.state.settings.account?.uid||'')===scope.accountUid;}
function studioInstallationContext(){return {...supermarketContext(),studioOverlayOnly:studioInstallScope?.overlayOnly===true};}
function studioInstallShell(body) { studioInstallDialog.innerHTML=ShenPulseGameWorkspace.renderStudioShell(studioInstallationContext(),body,{busy:studioInstallBusy}); }
async function openStudioInstallation(options={}) {
  if (!requireGameAccess(supermarketPack())) return;
  studioInstallScope = { overlayOnly:options.overlayOnly===true, packId:supermarketPack().id, profileId:snapshot.state.session.profileId, accountUid:snapshot.state.settings.account?.uid || "" };
  const request = ++studioInstallRequest; studioInstallBusy = false;
  studioInstallShell(ShenPulseGameWorkspace.renderStudioStatus('Détection des logiciels installés…'));
  if (!studioInstallDialog.open) studioInstallDialog.showModal();
  try {
    const studios = await api.studios.status();
    if (request !== studioInstallRequest || !studioInstallDialog.open) return;
    if (!studioScopeCurrent()) { studioInstallDialog.close(); return; }
    studioInstallShell(ShenPulseGameWorkspace.renderStudioChoices(studioInstallationContext(),studios));
  } catch (error) { if (request === studioInstallRequest && studioScopeCurrent()) studioInstallShell(ShenPulseGameWorkspace.renderStudioError(studioInstallationContext(),error.message || 'La détection a échoué.')); }
}
async function installOnStudio(studioId) {
  if (studioInstallBusy || !studioInstallScope) return;
  if (snapshot.state.session.profileId !== studioInstallScope.profileId || supermarketPack()?.id !== studioInstallScope.packId || (snapshot.state.settings.account?.uid || '') !== studioInstallScope.accountUid) { studioInstallShell(ShenPulseGameWorkspace.renderStudioStatus('Le profil a changé. Fermez cette fenêtre et recommencez.','error')); return; }
  const scope = { ...studioInstallScope,studioId }, request = studioInstallRequest; studioInstallBusy = true;
  studioInstallShell(ShenPulseGameWorkspace.renderStudioStatus(scope.overlayOnly?'Installation du compteur…':'Installation de la scène et des sources…'));
  try {
    const result = await api.studios.install(scope); studioInstallBusy = false;
    if (request !== studioInstallRequest || !studioInstallDialog.open) return;
    if (result.status !== 'installed') {
      studioInstallShell(ShenPulseGameWorkspace.renderStudioBlocked(studioInstallationContext(),result,studioId)); return;
    }
    studioInstallShell(ShenPulseGameWorkspace.renderStudioResult(studioInstallationContext(),result));
  } catch (error) {
    studioInstallBusy = false;
    if (request === studioInstallRequest) studioInstallShell(ShenPulseGameWorkspace.renderStudioError(studioInstallationContext(),error.message || 'Installation non confirmée.',studioId));
  }
}
const STUDIO_INSTALL_ACTIONS = new Set(['market-studio-open','market-studio-install','market-studio-close']);
registerActionHandler(STUDIO_INSTALL_ACTIONS, async ({ action, target }) => {
  if (!STUDIO_INSTALL_ACTIONS.has(action)) return ACTION_NOT_HANDLED;
  if (action === 'market-studio-open') return openStudioInstallation({overlayOnly:studioInstallScope?.overlayOnly===true});
  if (action === 'market-studio-install') return installOnStudio(target.dataset.id);
  if (!studioInstallBusy) studioInstallDialog.close();
});
