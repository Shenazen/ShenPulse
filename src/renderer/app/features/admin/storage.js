"use strict";
/** Médiathèque du propriétaire. Les objets et leurs liens ne quittent pas cet espace privé. */
let adminStorageView={uid:'',generation:0,data:null,busy:false,error:'',query:'',kind:'all',category:'imports',page:1,download:null};
const ADMIN_STORAGE_KINDS={all:'Tous',video:'Vidéos',audio:'Sons',image:'Images et GIF',other:'Autres fichiers'};
function adminStorageBytes(value){const n=Number(value)||0;if(n<1024)return n+' o';const i=Math.min(3,Math.floor(Math.log(n)/Math.log(1024)));return (n/1024**i).toLocaleString('fr-FR',{maximumFractionDigits:1})+' '+['o','Ko','Mo','Go'][i];}
function resetAdminStorage(){adminStorageView={uid:'',generation:adminStorageView.generation+1,data:null,busy:false,error:'',query:'',kind:'all',category:'imports',page:1,download:null};if(dialog?.dataset.variant==='admin-storage-preview'){for(const media of dialogBody.querySelectorAll('video,audio')){media.pause();media.removeAttribute('src');media.load();}dialog.close();}}
function storageCanRender(){return currentPage==='admin'&&adminWorkspace==='storage'&&isVerifiedAdminSession();}
function storageRender(){if(storageCanRender())render();}
function storageOwner(){if(!isVerifiedAdminSession())throw Error('Accès administrateur requis.');return captureCreatorPrivateOperation();}
function storageOwnerCurrent(owner){return creatorPrivateOperationActive(owner)&&isVerifiedAdminSession();}
async function loadAdminStorage({refresh=false,page=1}={}){
 const owner=storageOwner();if(adminStorageView.uid!==owner.uid)resetAdminStorage();const view=adminStorageView;view.uid=owner.uid;
 const generation=++view.generation;view.busy=true;view.error='';view.page=page;storageRender();
 try{if(!api.admin.storageList)throw Error('Relancez la version à jour de ShenPulse pour accéder au stockage.');const result=await api.admin.storageList({query:view.query,kind:view.kind,category:view.category,page,refresh});
  if(!storageOwnerCurrent(owner)||view!==adminStorageView||generation!==view.generation)return;
  if(!result?.ok||!Array.isArray(result.rows))throw Error('La liste des fichiers est indisponible.');view.data=result;view.page=result.page;
 }catch(error){if(storageOwnerCurrent(owner)&&view===adminStorageView&&generation===view.generation)view.error=error.message||'Impossible de charger le stockage.';}
 finally{if(storageOwnerCurrent(owner)&&view===adminStorageView&&generation===view.generation){view.busy=false;storageRender();}}
}
function renderAdminStorage(){
 if(!isVerifiedAdminSession())return '';
 const v=adminStorageView,d=v.uid===creatorPrivateOperationUid()?v.data:null,e=escapeHtml;
 const chips=Object.entries(ADMIN_STORAGE_KINDS).map(([key,label])=>'<button type="button" data-action="admin-storage-kind" data-value="'+key+'" aria-pressed="'+(v.kind===key)+'">'+label+(key!=='all'&&d?' <span>'+d.counts[key]+'</span>':'')+'</button>').join('');
 const cards=(d?.rows||[]).map(row=>'<article class="admin-storage-card"><div class="admin-storage-file-top"><span class="admin-storage-file-icon '+e(row.kind)+'" aria-hidden="true">'+({video:'▷',audio:'♫',image:'▧',other:'↓'}[row.kind]||'↓')+'</span><span class="badge">'+e(ADMIN_STORAGE_KINDS[row.kind]||'Fichier')+'</span></div><h4 title="'+e(row.name)+'">'+e(row.name)+'</h4><p class="admin-storage-path" title="'+e(row.key)+'">'+e(row.folder||'Racine du bucket')+'</p><dl><div><dt>Taille</dt><dd>'+e(adminStorageBytes(row.size))+'</dd></div><div><dt>Ajout / modification</dt><dd>'+e(new Date(row.modified).toLocaleDateString('fr-FR'))+'</dd></div></dl>'+ (row.ownerUid?'<small class="admin-storage-owner" title="'+e(row.ownerUid)+'">Compte : '+e(row.ownerUid)+'</small>':'')+'<footer>'+(row.kind!=='other'?'<button class="button small" data-action="admin-storage-preview" data-key="'+e(row.key)+'">Aperçu</button>':'')+'<button class="button primary small" data-action="admin-storage-download" data-key="'+e(row.key)+'" '+(v.download?'disabled':'')+'>↓ Télécharger</button></footer></article>').join('');
 return '<div class="admin-storage"><header class="admin-storage-header"><div><p class="eyebrow">BIBLIOTHÈQUE DISTANTE · ACCÈS PRIVÉ</p><h3>Stockage Backblaze</h3><p>Retrouvez les imports des utilisateurs et tous les fichiers du bucket ShenPulse. Prévisualisez un média ou enregistrez-le sur votre PC.</p></div><button class="button" data-action="admin-storage-refresh" '+(v.busy?'disabled':'')+'>↻ Actualiser</button></header>'+
 '<section class="admin-storage-summary" aria-label="Résumé du stockage"><div><small>Fichiers dans la sélection</small><strong>'+e(d?.total??'—')+'</strong></div><div><small>Taille de la sélection</small><strong>'+e(d?adminStorageBytes(d.totalBytes):'—')+'</strong></div><div><small>Bucket</small><strong>'+e(d?.bucket||'ShenPulse')+'</strong></div></section>'+
 '<form class="admin-storage-search" data-storage-search><label>Rechercher un fichier<input name="query" placeholder="Nom, dossier ou identifiant du compte…" maxlength="160" value="'+e(v.query)+'"></label><label>Emplacement<select name="category">'+[['imports','Imports des utilisateurs'],['all','Tout le bucket'],['packs','Packs et installations'],['other','Autres dossiers']].map(([id,label])=>'<option value="'+id+'" '+(v.category===id?'selected':'')+'>'+label+'</option>').join('')+'</select></label><button class="button" type="submit">Rechercher</button></form><div class="admin-storage-kinds" role="group" aria-label="Types de fichiers">'+chips+'</div>'+
 (v.error?'<div class="admin-storage-error" role="alert">'+e(v.error)+'<button class="button small" data-action="admin-storage-refresh">Réessayer</button></div>':'')+
 (v.download?'<div class="admin-storage-download" role="status"><span>↓ Téléchargement en cours… '+e(v.download.percent==null?'':v.download.percent+' %')+'</span><progress max="100" '+(v.download.percent==null?'':'value="'+v.download.percent+'"')+'></progress></div>':'')+
 (v.busy?'<div class="admin-storage-loading" role="status"><span class="pulse-loader"></span> Lecture du stockage Backblaze…</div>':'')+
 (!v.busy&&d&&!d.complete?'<p class="admin-storage-error">L’inventaire est partiel. Seuls les '+d.inventoryTotal+' premiers fichiers sont disponibles ; actualisez pour réessayer.</p>':'')+
 (d?'<p class="admin-storage-inventory">'+e(d.inventoryTotal)+' fichiers inventoriés · '+e(new Date(d.listedAt).toLocaleString('fr-FR'))+'</p>':'')+
 '<div class="admin-storage-grid" aria-busy="'+v.busy+'">'+cards+'</div>'+(!v.busy&&!v.error&&d&&!d.rows.length?'<div class="admin-storage-empty"><strong>Aucun fichier trouvé</strong><p>Essayez un autre nom, un autre type ou « Tout le bucket ».</p></div>':'')+
 (d&&d.pageCount>1?'<nav class="admin-storage-pages" aria-label="Pages des fichiers"><button class="button" data-action="admin-storage-page" data-value="'+(d.page-1)+'" '+(d.page<=1||v.busy?'disabled':'')+'>← Précédent</button><span>Page '+d.page+' sur '+d.pageCount+'</span><button class="button" data-action="admin-storage-page" data-value="'+(d.page+1)+'" '+(d.page>=d.pageCount||v.busy?'disabled':'')+'>Suivant →</button></nav>':'')+'</div>';
}
async function previewAdminStorage(key){
 const owner=storageOwner(),view=adminStorageView,row=view.data?.rows.find(r=>r.key===key);if(!row)throw Error('Actualisez la liste pour retrouver ce fichier.');
 const ticket=await api.admin.storagePreview(key);if(!storageOwnerCurrent(owner)||view!==adminStorageView||!storageCanRender())return;
 const e=escapeHtml,attributes='src="'+e(ticket.url)+'" referrerpolicy="no-referrer"',media=ticket.contentType.startsWith('image/')?'<img '+attributes+' alt="'+e(ticket.name)+'">':ticket.contentType.startsWith('video/')?'<video '+attributes+' controls playsinline preload="metadata"></video>':ticket.contentType.startsWith('audio/')?'<audio '+attributes+' controls preload="metadata"></audio>':'';
 if(!media)throw Error('Ce format ne possède pas d’aperçu. Utilisez Télécharger.');
 openEditor({title:'Aperçu du fichier',kicker:'STOCKAGE BACKBLAZE',variant:'admin-storage-preview',body:'<section class="admin-storage-preview"><h3>'+e(ticket.name)+'</h3><p>'+e(row.key)+'</p><div class="admin-storage-player">'+media+'</div><p>'+e(adminStorageBytes(ticket.size))+' · '+e(ticket.contentType)+'</p><button type="button" class="button primary" data-action="admin-storage-download" data-key="'+e(key)+'">↓ Télécharger sur mon PC</button></section>'});
 const player=dialogBody.querySelector('video,audio,img');player?.addEventListener('error',()=>{if(dialog.open&&dialog.dataset.variant==='admin-storage-preview')showDialogError('Cet aperçu ne peut pas être lu ici. Vous pouvez télécharger le fichier pour le lire sur votre PC.');},{once:true});
}
async function downloadAdminStorage(key){
 const owner=storageOwner(),v=adminStorageView;if(v.download)throw Error('Un téléchargement est déjà en cours.');
 const requestId=crypto.randomUUID();v.download={requestId,key,percent:null};storageRender();
 const unsubscribe=api.admin.onStorageProgress?.(p=>{if(storageOwnerCurrent(owner)&&v===adminStorageView&&p.requestId===requestId&&v.download){v.download.percent=p.total?Math.min(100,Math.round(p.received/p.total*100)):100;const progress=content.querySelector('.admin-storage-download progress'),label=content.querySelector('.admin-storage-download span');if(progress)progress.value=v.download.percent;if(label)label.textContent='↓ Téléchargement en cours… '+v.download.percent+' %';}});
 try{const result=await api.admin.storageDownload({key,requestId});if(storageOwnerCurrent(owner)&&!result?.canceled)toast('Fichier téléchargé',result.filePath);}
 finally{unsubscribe?.();if(v===adminStorageView){v.download=null;if(storageOwnerCurrent(owner))storageRender();}}
}
registerActionHandler(new Set(['admin-storage-refresh','admin-storage-kind','admin-storage-page','admin-storage-preview','admin-storage-download']),async({action,target})=>{
 if(!action.startsWith("admin-storage-"))return ACTION_NOT_HANDLED;
 storageOwner();const v=adminStorageView;
 if(action==='admin-storage-refresh')return loadAdminStorage({refresh:true,page:v.page});
 if(action==='admin-storage-kind'){v.kind=target.dataset.value;return loadAdminStorage();}
 if(action==='admin-storage-page')return loadAdminStorage({page:Number(target.dataset.value)});
 if(action==='admin-storage-preview')return perform(()=>previewAdminStorage(target.dataset.key));
 if(action==='admin-storage-download')return perform(()=>downloadAdminStorage(target.dataset.key));
});
content.addEventListener('submit',event=>{const form=event.target.closest('[data-storage-search]');if(!form)return;event.preventDefault();const data=new FormData(form);adminStorageView.query=String(data.get('query')||'');adminStorageView.category=String(data.get('category')||'imports');void loadAdminStorage().catch(error=>toast('Stockage indisponible',error.message,true));});
content.addEventListener('change',event=>{const form=event.target.closest('[data-storage-search]');if(form&&event.target.name==='category'){adminStorageView.category=event.target.value;adminStorageView.query=String(new FormData(form).get('query')||'');void loadAdminStorage().catch(error=>toast('Stockage indisponible',error.message,true));}});

dialog.addEventListener("close",()=>{if(dialog.dataset.variant!=="admin-storage-preview")return;for(const media of dialogBody.querySelectorAll("video,audio")){media.pause();media.removeAttribute("src");media.load();}});
