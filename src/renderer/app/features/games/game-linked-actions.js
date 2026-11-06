"use strict";
function openGameLinkedActionsEditor(pack=supermarketPack()){
 if(!pack||!requireGameAccess(pack))return;
 const scope={packId:pack.id,profileId:snapshot.state.session.profileId,accountUid:snapshot.state.settings.account?.uid||''};
 const config=ShenPulseGameLinkedActions.normalize(snapshot.state.settings.overlayConfigs?.gameInteractionOverlays?.[pack.id]),selected=new Set(config.linkedRuleIds);
 const candidates=ShenPulseGameLinkedActions.candidates(snapshot.state),e=escapeHtml;
 openEditor({title:'Actions & IRL sur vos cartes',kicker:pack.name,variant:'game-linked-actions',successMessage:'Affichage des actions enregistré pour ce jeu',
  body:'<section class="game-linked-editor"><div class="game-linked-intro"><span aria-hidden="true">⌁</span><div><h3>Le jeu et vos actions, sur les mêmes cartes</h3><p>Le même cadeau regroupe les effets du jeu et les titres de vos actions. Un autre cadeau ajoute une carte. Les actions et interactions IRL se distinguent en bleu cyan.</p></div></div>'+
  '<label class="game-linked-master"><input type="checkbox" name="linkedActionsEnabled" '+(config.linkedActionsEnabled?'checked':'')+'><span><strong>Afficher les actions sélectionnées sur ce jeu</strong><small>Masquez-les à tout moment : votre sélection reste enregistrée.</small></span></label>'+
  '<label class="field"><span>Rechercher une action ou un cadeau</span><input type="search" data-game-linked-search placeholder="Ex. Ballon 5, Rose…"></label><div class="game-linked-list">'+
  (candidates.length?candidates.map(choice=>{
   const trigger=supermarketTriggerPresentation(choice.rule),checked=selected.has(choice.id);
   return '<label class="game-linked-choice" data-game-linked-choice data-search="'+e((choice.title+' '+trigger.caption).toLocaleLowerCase('fr'))+'"><input type="checkbox" name="linkedRuleIds" value="'+e(choice.id)+'" '+(checked?'checked':'')+'><span class="game-linked-gift">'+trigger.image+'</span><span class="game-linked-caption"><strong>'+e(choice.title)+'</strong><small>'+e(trigger.caption)+' · '+(choice.kind==='irl'?'Interaction IRL':'Action')+(choice.active?'':' · inactive dans ce profil')+'</small></span><span class="game-linked-tag">'+(choice.kind==='irl'?'IRL':'ACTION')+'</span></label>';
  }).join(''):'<p class="game-linked-empty">Créez une action avec un déclencheur cadeau, follow ou likes pour la retrouver ici.</p>')+
  '</div><p class="game-linked-note">Ce choix concerne seulement l’affichage de '+e(pack.name)+'. Il ne duplique aucun déclenchement. Les actions gardent leurs conditions, leur activation et leurs réglages de combos dans Actions ou Machines IRL. Une action inactive ne s’affiche pas sur le LIVE.</p></section>',
  onSubmit:async data=>{
   if(supermarketPack()?.id!==scope.packId||snapshot.state.session.profileId!==scope.profileId||(snapshot.state.settings.account?.uid||'')!==scope.accountUid)throw Error('Le jeu, le compte ou le profil a changé. Rouvrez la sélection.');
   await saveSupermarketOverlayPresentation({linkedActionsEnabled:data.has('linkedActionsEnabled'),linkedRuleIds:data.getAll('linkedRuleIds')});
  }
 });
}
dialog.addEventListener('input',event=>{
 const root=event.target.closest('.game-linked-editor');if(!root)return;
 if(event.target.matches('[data-game-linked-search]')){const query=event.target.value.trim().toLocaleLowerCase('fr');for(const row of root.querySelectorAll('[data-game-linked-choice]'))row.hidden=!row.dataset.search.includes(query);}
 if(event.target.matches('[name="linkedRuleIds"]')&&event.target.checked)root.querySelector('[name="linkedActionsEnabled"]').checked=true;
});
