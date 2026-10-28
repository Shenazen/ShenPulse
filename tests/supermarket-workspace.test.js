"use strict";
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {JSDOM}=require('jsdom');
const effects=require('../resources/catalogs/supermarket-simulator-effects.json');
const {defaultGameInteractionRule}=require('../src/main/game-hub/interaction-defaults');
const root=path.resolve(__dirname,'..'),pack={id:'supermarket-simulator',name:'Supermarket Simulator',installerVersion:'1.0.25',effects,guide:{mode:'native'}};
function fixture(){
 const dom=new JSDOM('<main id="content"></main><dialog><div id="dialog-body"></div></dialog>'),saved=[],previews=[],handlers=new Map();let editor,sequence=0;
 const rules=['GiveMoney','TakeMoney','ChangeFOV'].map((code,i)=>{const effect=effects.find(e=>e.code===code);const rule=defaultGameInteractionRule(pack,effect,{id:'test-'+i,triggerType:'gift',triggerEnabled:true,quantity:3},20261023);rule.conditions=[{field:'data.giftName',operator:'equals',value:'Cadeau '+i,giftId:'gift-'+i,giftIds:['alias-'+i],giftImageUrl:'https://example.test/gift.png'}];rule.cooldown={globalMs:1700,perUserMs:2900};rule.chance=.75;return rule;});
 const gifts=[{id:'5655',name:'Rose',cost:1,alternateIds:['rose'],imageUrl:'https://example.test/rose.png'},{id:'6104',name:'Cap',cost:99,imageUrl:'https://example.test/cap.png'},{id:'6267',name:'Corgi',cost:299,imageUrl:'https://example.test/corgi.png'},{id:'9999',name:'Rare',cost:1000,imageUrl:'https://example.test/rare.png'}];
 const dialog=dom.window.document.querySelector('dialog'),dialogBody=dom.window.document.querySelector('#dialog-body');dialog.close=()=>dialog.removeAttribute('open');
 const state={session:{profileId:'profile-a'},game:{installations:{[pack.id]:{platform:'xbox',path:'C:/XboxGames/Supermarket/Content',installerVersion:pack.installerVersion}},interactionRulesByPack:{[pack.id]:rules}},settings:{}};
 const ctx=vm.createContext({console,structuredClone,URL,Set,Map,ShenPulseGameInteractionTitles:require("../src/shared/game-interaction-titles"),ShenPulseMinecraftRoundSettings:require('../src/shared/minecraft-round-settings'),dialog,dialogBody,dialogSessionId:0,content:dom.window.document.querySelector('main'),snapshot:{state,packs:[pack]},gameInstallBusyId:'',gameLaunchBusyId:'',cryptoId:()=>String(++sequence),
  escapeHtml:value=>String(value??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('"','&quot;'),isGameUnlocked:()=>true,requireGameAccess:()=>true,activeGameSession:()=>null,gameArtwork:()=> 'assets/games/catalog/supermarket-simulator.jpg',gameInstallationPlatformLabel:i=>i?.platform==='xbox'?'Xbox / Game Pass':'Steam',
  triggerLabel:r=>r.trigger.type,normalizeGiftName:value=>String(value).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase(),giftPickerSearchText:g=>(g.name+' '+g.id+' '+g.cost).toLowerCase(),giftPickerCatalogContext:()=>({username:'fixture'}),giftPickerRoomMatches:()=>false,preloadGiftPickerCatalog:async()=>({gifts}),giftPickerDisplayGroups:list=>list.map(gift=>({gift,variants:[gift]})),giftForSavedReference:(name,id,saved)=>gifts.find(g=>g.id===id)||{id,name,cost:saved.giftCost||0,imageUrl:saved.giftImageUrl},giftReferenceForSave:(name,id,previous)=>({...((previous.giftId===id)?previous:{}),giftId:id,giftCost:gifts.find(g=>g.id===id)?.cost||0,giftImageUrl:gifts.find(g=>g.id===id)?.imageUrl||'',giftIds:gifts.find(g=>g.id===id)?.alternateIds||[]}),
  triggerPill:r=>'<span>'+r.conditions[0]?.value+'</span>',hasAutomaticTrigger:r=>r.trigger?.enabled!==false,eventIconMarkup:()=>'<svg></svg>',ruleGiftCondition:r=>r.conditions[0],ruleGiftName:r=>r.conditions[0]?.value||'',
  renderGameConditionsButton:()=>'<button>CONDITION DE JEU</button>',renderGameConditionsPanel:()=>'',renderGamePageMessage:()=>'',renderGameInteractionSession:()=>'',gameOverlayItemsFor:()=>[],GTA_INTERACTION_OVERLAY_BACKGROUNDS:[['#082b63','Bleu'],['#101010','Noir']],renderGameOverlays:()=>'<div>Overlay</div>',renderGameLaunchProgressModal:()=>'',overlayDefinitions:()=>[{key:'winCounter'}],overlayUnlocked:()=>true,renderOverlayCard:()=>'<div>Compteur WINS</div>',
  ACTION_NOT_HANDLED:Symbol("unhandled"), registerActionHandler:(names,handler)=>{for(const name of names)handlers.set(name,handler);},render(){},acceptSnapshot(next){ctx.snapshot=next;},api:{async saveGamePackPresentation(options){ctx.snapshot.state.settings.overlayConfigs||={};ctx.snapshot.state.settings.overlayConfigs.gameInteractionOverlays||={};const map=ctx.snapshot.state.settings.overlayConfigs.gameInteractionOverlays;const {profileId,accountUid,...patch}=options;if(profileId!==ctx.snapshot.state.session.profileId)throw Error('Le profil a changé');map[pack.id]={...map[pack.id],...patch};return structuredClone(ctx.snapshot);},async testAction(action){previews.push(structuredClone(action));},async saveGameInteraction(id,rule){saved.push(structuredClone(rule));const list=ctx.snapshot.state.game.interactionRulesByPack[id];const index=list.findIndex(r=>r.id===rule.id);if(index>=0)list[index]=structuredClone(rule);else list.push(structuredClone(rule));return structuredClone(ctx.snapshot);}},
  openEditor:options=>{editor=options;dialog.dataset.variant=options.variant||'standard';dialogBody.innerHTML=options.body;dialog.setAttribute('open','');ctx.dialogSessionId++;},soundPickerField:()=>'<input name="marketSound">',openGameInteractionCatalog(){},openGameInteractionEditor(){},perform:async fn=>fn()
 });
 const interactions=fs.readFileSync(path.join(root,'src/renderer/app/features/games/interactions.js'),'utf8');
 vm.runInContext(interactions.slice(interactions.indexOf('function gameInteractionRules('),interactions.indexOf('function gameInteractionReadinessIssues('))+interactions.slice(interactions.indexOf('function findGameInteractionRow(')),ctx);
 for(const file of ["workspace/core.js","workspace/interactions.js","workspace/free-events.js","workspace/catalog.js","workspace/preview.js","workspace/updates.js","workspace/sections.js","workspace/dialogs.js","workspace/wins.js","supermarket-workspace.js","supermarket-free-events.js","supermarket-controls.js","supermarket-gifts.js"])vm.runInContext(fs.readFileSync(path.join(root,'src/renderer/app/features/games',file),'utf8'),ctx);
 return {ctx,dom,saved,previews,handlers,rules,editor:()=>editor,render:()=>{ctx.content.innerHTML=ctx.renderSupermarketWorkspace(pack);return ctx.content;}};
}

test('Supermarket place le guide avant les cartes et replie le catalogue sans wins ni panneau overlay',()=>{
 const f=fixture(),page=f.render();assert.equal(page.querySelectorAll('.market-hero').length,1);assert.equal(page.querySelectorAll('.market-phone').length,1);assert.equal(page.querySelectorAll('.market-column').length,3);assert.equal(page.querySelectorAll('.game-journey-tabs').length,0);
 assert.equal(page.querySelectorAll('[data-action="install-game"]').length,1);assert.ok(page.textContent.includes('Xbox / Game Pass'));assert.equal(page.querySelectorAll('[data-market-card]').length,3);assert.equal(page.querySelectorAll('.market-catalog-grid article').length,0,'Le catalogue replié ne construit aucune carte.');
 for(const id of ['market-guide','market-interactions','market-follow','market-catalog'])assert.ok(page.querySelector('#'+id));
 assert.equal(page.querySelector('#market-catalog').tagName,'DETAILS');assert.equal(page.querySelector('#market-catalog').open,false);
 assert.equal(page.querySelector('#market-wins'),null);assert.equal(page.querySelector('#market-overlays'),null);assert.equal(page.querySelector('[data-action="market-section"][data-value="overlays"]'),null);
 const order=[...page.querySelectorAll('.market-workspace > section,.market-workspace > details')].map(node=>node.id);assert.ok(order.indexOf('market-installation')<order.indexOf('market-guide'));assert.ok(order.indexOf('market-guide')<order.indexOf('market-interactions'));
 const catalog=page.querySelector('#market-catalog');catalog.open=true;catalog.dispatchEvent(new f.dom.window.Event('toggle'));assert.equal(page.querySelectorAll('.market-catalog-art').length,42);assert.equal(new Set([...page.querySelectorAll('.market-catalog-art')].map(img=>img.getAttribute('src'))).size,42);assert.equal(page.querySelectorAll('.market-effect-choice img').length,3);
 assert.equal(page.querySelector('.market-column.help [data-market-inline="effect"]').value,effects.find(e=>e.code==='GiveMoney').id);
 assert.equal(page.querySelector('.market-column.trap [data-market-inline="effect"]').value,effects.find(e=>e.code==='TakeMoney').id);
 assert.equal(page.querySelector('.market-column.neutral [data-market-inline="effect"]').value,effects.find(e=>e.code==='ChangeFOV').id);
 assert.doesNotMatch(page.innerHTML,/synclive|crowd.?control|tauri|\.sfc/i);assert.equal(f.saved.length,0);
});

test('les modifications directes conservent cadeaux, alias, cooldowns, chance et actions supplémentaires',async()=>{
 const f=fixture(),rule=f.rules[0];rule.actions.push({id:'sound-kept',type:'audio.play',config:{url:'https://example.test/sound.mp3',volume:.4}});const before=structuredClone(rule);const page=f.render(),card=page.querySelector('[data-market-card]');
 const title=card.querySelector('[data-market-inline="title"]');title.value='Client personnalisé';await f.ctx.saveSupermarketInline(title);
 let next=f.saved.at(-1);assert.equal(next.gameInteraction.title,'Client personnalisé');assert.deepEqual(next.conditions,before.conditions);assert.deepEqual(next.trigger,before.trigger);assert.deepEqual(next.cooldown,before.cooldown);assert.equal(next.chance,.75);assert.deepEqual(next.actions,before.actions);
 const column=card.querySelector('[data-market-inline="column"]');column.value='trap';await f.ctx.saveSupermarketInline(column);next=f.saved.at(-1);assert.equal(next.gameInteraction.marketColumn,'trap');assert.deepEqual(next.conditions,before.conditions);assert.equal(next.gameInteraction.title,'Client personnalisé');
});

test('deux sauvegardes rapides se fusionnent et un changement de profil annule une écriture en attente',async()=>{
 const f=fixture(),page=f.render(),card=page.querySelector('[data-market-card]'),title=card.querySelector('[data-market-inline="title"]'),column=card.querySelector('[data-market-inline="column"]');title.value='Titre A';column.value='neutral';
 await Promise.all([f.ctx.saveSupermarketInline(title),f.ctx.saveSupermarketInline(column)]);assert.equal(f.saved.at(-1).gameInteraction.title,'Titre A');assert.equal(f.saved.at(-1).gameInteraction.marketColumn,'neutral');
 title.value='Mauvais profil';const pending=f.ctx.saveSupermarketInline(title);f.ctx.snapshot.state.session.profileId='profile-b';await assert.rejects(pending,/profil a changé/);assert.equal(f.saved.length,2);
});

test('changer l’effet ne modifie pas le déclencheur et les durées se conservent dans le paramètre natif',async()=>{
 const f=fixture(),page=f.render(),card=page.querySelector('[data-market-card]'),select=card.querySelector('[data-market-inline="effect"]');const before=structuredClone(f.rules[0].conditions);select.value=effects.find(e=>e.code==='GameSlowDown').id;await f.ctx.saveSupermarketInline(select);assert.deepEqual(f.saved.at(-1).conditions,before);assert.equal(f.saved.at(-1).actions[0].config.duration,20);
 f.render();const input=f.ctx.content.querySelector('[data-market-inline="parameter"]');input.value='8';await f.ctx.saveSupermarketInline(input);assert.equal(f.saved.at(-1).actions[0].config.parameters.count,8);assert.equal(f.saved.at(-1).actions[0].config.duration,8);
});

test('le son et les actions multiples appartiennent à la même règle sans perdre les associations',async()=>{
 const f=fixture(),rule=f.rules[0],before=structuredClone(rule.conditions),reference={ruleId:rule.id,actionId:rule.actions[0].id,index:0};f.ctx.openSupermarketSound(reference);
 const data=new f.dom.window.FormData();data.set('marketSound','https://example.test/sound.mp3');data.set('marketSoundName','Mon son');await f.editor().onSubmit(data);assert.deepEqual(f.saved.at(-1).conditions,before);assert.equal(f.saved.at(-1).actions[1].config.soundName,'Mon son');
 f.ctx.openSupermarketExtraActions(reference);const extra=new f.dom.window.FormData();extra.append('marketExtraEffects',effects.find(e=>e.code==='FillShelves').id);await f.editor().onSubmit(extra);const after=f.saved.at(-1);assert.equal(after.actions.length,3);assert.ok(after.actions.some(a=>a.type==='audio.play'));assert.deepEqual(after.conditions,before);
 assert.equal(f.ctx.supermarketRows(pack).length,3,'une seule carte par règle malgré plusieurs effets');
});

test('la recherche et les catégories ne modifient aucune règle et les titres restent échappés',async()=>{
 const f=fixture();f.rules[0].gameInteraction={title:'<img src=x onerror=alert(1)>'};f.render();assert.equal(f.ctx.content.querySelectorAll('img[src="x"]').length,0);
 const handler=f.handlers.get('market-category');await handler({action:'market-category',target:{dataset:{value:'Finances'}}});const html=f.ctx.renderSupermarketCatalog(pack,true),dom=new JSDOM(html);assert.equal(dom.window.document.querySelectorAll('.market-catalog-grid article').length,4);assert.equal(f.saved.length,0);
});


test('les commandes des autres pages traversent le nouveau groupe de commandes sans être interceptées',async()=>{
 const f=fixture(),handler=f.handlers.get('market-section');for(const action of ['creator-voice-tab','configure-overlay','edit-game-interaction','copy'])assert.equal(await handler({action,target:{dataset:{}}}),f.ctx.ACTION_NOT_HANDLED);assert.equal(f.saved.length,0);
});


test('écouter un son ne lance aucun effet en jeu et ne change aucune association',async()=>{
 const f=fixture();const sound={id:'sound-preview',type:'audio.play',config:{url:'https://example.test/sound.mp3',soundName:'Mon son',volume:.4}};f.rules[0].actions.push(sound);
 const page=f.render(),button=page.querySelector('.market-column.help [data-action="market-preview-sound"]');
 assert.equal(button.disabled,false);await f.handlers.get('market-preview-sound')({action:'market-preview-sound',target:button});
 assert.deepEqual(f.previews,[sound]);assert.equal(f.saved.length,0);
 const silent=page.querySelector('.market-column.trap [data-action="market-preview-sound"]');assert.equal(silent.disabled,true);
 await f.handlers.get('market-preview-sound')({action:'market-preview-sound',target:silent});assert.equal(f.previews.length,1);
});


test('le vrai profil initial affiche six cartes d’aide, une colonne neutre vide et six pièges',()=>{
 const f=fixture(),realPack=require('../src/main/game-catalog').loadShenazenGameCatalog(path.join(root,'resources')).find(p=>p.id===pack.id);
 f.ctx.snapshot.state.game.interactionRulesByPack[pack.id]=realPack.defaultMappings.map(mapping=>defaultGameInteractionRule(realPack,realPack.effects.find(e=>e.id===mapping.effectId),mapping,realPack.interactionCatalogVersion));
 const page=f.render();assert.equal(page.querySelectorAll('.market-column.help [data-market-card]').length,6);assert.equal(page.querySelectorAll('.market-column.neutral [data-market-card]').length,0);assert.equal(page.querySelectorAll('.market-column.trap [data-market-card]').length,6);
 assert.equal(page.querySelectorAll('[data-market-card]').length,12);assert.equal(page.querySelector('.market-column.help [data-market-inline="parameter"]').value,'1');assert.ok(page.querySelector('.market-column.neutral .market-empty'));
});


test('l’ajout propose cadeau, follow et likes, et une annulation du cadeau ne crée aucune règle',async()=>{
 const f=fixture();f.render();await f.handlers.get('market-add')({action:'market-add',target:{dataset:{value:'help',menu:'help'}}});
 const page=f.render();assert.equal(page.querySelectorAll('.market-column.help .market-add-menu [role="menuitem"]').length,3);
 await f.handlers.get('market-add-kind')({action:'market-add-kind',target:{dataset:{value:'help',type:'gift'}}});
 assert.equal(f.editor().variant,'market-gifts');assert.equal(f.saved.length,0);assert.ok(f.ctx.dialogBody.querySelector('.market-gift-choice img'));assert.ok(f.ctx.dialogBody.textContent.includes('DÉJÀ UTILISÉS'));f.ctx.dialog.close();assert.equal(f.saved.length,0);
});

test('le choix visuel crée une seule carte et ses alias, les filtres et recherches ne sauvegardent rien',async()=>{
 const f=fixture();await f.ctx.addSupermarketInteraction('gift','trap');const search=f.ctx.dialogBody.querySelector('[data-market-gift-search]');search.value='99';search.dispatchEvent(new f.dom.window.Event('input',{bubbles:true}));
 const grid=f.ctx.dialogBody.querySelector('[data-market-gift-results]');assert.equal(grid.querySelectorAll('.market-gift-choice').length,3,'recherche par prix ou identifiant');
 const large=f.ctx.dialogBody.querySelector('[data-market-gift-range="large"]');search.value='';search.dispatchEvent(new f.dom.window.Event('input',{bubbles:true}));large.click();assert.equal(grid.querySelectorAll('.market-gift-choice').length,1);assert.equal(f.saved.length,0);
 await f.ctx.chooseSupermarketGift('5655');const rule=f.saved.at(-1);assert.equal(f.saved.length,1);assert.equal(rule.gameInteraction.marketColumn,'trap');assert.equal(rule.actions[0].config.effectId,effects.find(e=>e.code==='FlipCamera').id);assert.equal(rule.conditions[0].giftId,'5655');assert.deepEqual(rule.conditions[0].giftIds,['rose']);assert.equal(rule.trigger.enabled,true);assert.equal(f.ctx.dialog.open,false);
});

test('changer le cadeau conserve les conditions de viewer, effets, sons et cooldowns de la carte',async()=>{
 const f=fixture(),rule=f.rules[0];rule.conditions.push({field:'user.name',operator:'equals',value:'viewer'},{field:'data.value',operator:'equals',value:99});rule.actions.push({id:'sound',type:'audio.play',config:{url:'https://example.test/sound.mp3'}});const before=structuredClone(rule);
 await f.ctx.openSupermarketGifts({ruleId:rule.id,actionId:rule.actions[0].id,index:0});await f.ctx.chooseSupermarketGift('6104');const saved=f.saved.at(-1);
 assert.equal(saved.conditions[0].giftId,'6104');assert.deepEqual(saved.conditions.slice(1),[{field:'user.name',operator:'equals',value:'viewer'}]);assert.deepEqual(saved.actions,before.actions);assert.deepEqual(saved.cooldown,before.cooldown);assert.equal(saved.chance,.75);
});

test('un changement de profil pendant le choix du cadeau interdit toute écriture',async()=>{
 const f=fixture();await f.ctx.addSupermarketInteraction('gift','help');f.ctx.snapshot.state.session.profileId='profile-b';await assert.rejects(f.ctx.chooseSupermarketGift('5655'),/profil.*changé/i);assert.equal(f.saved.length,0);
});

test('follow et likes s’ajoutent directement, avec un seuil de likes modifiable dans la carte',async()=>{
 const f=fixture();await f.ctx.addSupermarketInteraction('follow','help');await f.ctx.addSupermarketInteraction('like','neutral');let page=f.render();assert.equal(page.querySelectorAll('.market-follow-grid [data-market-card]').length,2);
 const input=page.querySelector('[data-market-inline="threshold"]');input.value='250';await f.ctx.saveSupermarketInline(input);assert.equal(f.saved.at(-1).trigger.threshold,250);assert.equal(f.saved.at(-1).trigger.type,'like');
});

test('les actions supplémentaires se choisissent dans la carte sans changer son cadeau',async()=>{
 const f=fixture(),page=f.render(),card=page.querySelector('[data-market-card]'),before=structuredClone(f.rules[0].conditions);
 await f.handlers.get('market-extra-add')({action:'market-extra-add',target:card.querySelector('[data-action="market-extra-add"]')});f.render();const select=f.ctx.content.querySelector('[data-market-inline="new-extra-effect"]');assert.ok(select);select.value=effects.find(e=>e.code==='FillShelves').id;await f.ctx.saveSupermarketInline(select);assert.deepEqual(f.saved.at(-1).conditions,before);assert.equal(f.saved.at(-1).actions.length,2);assert.equal(f.ctx.supermarketRows(pack).length,3);
});


test('les trois modèles gardent la même URL, cachent Animé/Fixe pour 2 et 3 et conservent les interactions',async()=>{
 const f=fixture();f.ctx.snapshot.overlayUrls={gamePack:'https://overlay.test/game-pack.html?channel=public'};f.ctx.snapshot.localOverlayUrls={gamePack:'http://127.0.0.1:1234/game-pack.html?token=local'};
 const original=JSON.stringify(f.rules),url=f.ctx.supermarketOverlayUrl();
 let page=f.render();assert.equal(page.querySelectorAll('.market-preview-models button').length,3);assert.ok(page.querySelector('.market-preview-mode'));assert.equal(page.querySelectorAll('.game-interaction-overlay-card').length,0);
 for(const model of [2,3,1]){
  await f.handlers.get('market-overlay-model')({action:'market-overlay-model',target:{dataset:{value:String(model)}}});page=f.render();
  assert.equal(page.querySelector('[data-action="market-overlay-model"][aria-pressed="true"]').dataset.value,String(model));assert.equal(!!page.querySelector('.market-preview-mode'),model===1);assert.equal(f.ctx.supermarketOverlayUrl(),url);assert.equal(JSON.stringify(f.rules),original);
 }
 await f.handlers.get('market-preview-mode')({action:'market-preview-mode',target:{dataset:{value:'static'}}});page=f.render();assert.equal(page.querySelector('[data-action="market-preview-mode"][aria-pressed="true"]').dataset.value,'static');assert.equal(f.ctx.supermarketOverlayUrl(),url);
 await f.handlers.get('market-overlay-model')({action:'market-overlay-model',target:{dataset:{value:'2'}}});assert.ok(f.render().querySelector('[data-market-overlay-color]'));
 await f.handlers.get('market-overlay-color')({action:'market-overlay-color',target:{dataset:{value:'#abcdef'}}});assert.equal(f.ctx.supermarketOverlayPresentation().backgroundColor,'#abcdef');assert.equal(f.ctx.supermarketOverlayUrl(),url);
 const waiting=f.ctx.saveSupermarketOverlayPresentation({model:3});f.ctx.snapshot.state.session.profileId='other';await assert.rejects(waiting,/profil a changé/);
 f.dom.window.close();
});

test('le catalogue se déplie, garde ses filtres pendant les rendus et se replie sans sauvegarder de règles',async()=>{
 const f=fixture();f.ctx.render=()=>{f.render();};let page=f.render(),catalog=page.querySelector('#market-catalog');
 catalog.open=true;catalog.dispatchEvent(new f.dom.window.Event('toggle'));
 assert.equal(catalog.querySelector('[data-market-catalog-label]').textContent,'Replier la liste');
 await f.handlers.get('market-category')({action:'market-category',target:{dataset:{value:'Finances'}}});
 page=f.render();catalog=page.querySelector('#market-catalog');assert.equal(catalog.open,true);assert.equal(catalog.querySelectorAll('article').length,4);
 const search=catalog.querySelector('[data-market-catalog-search]');search.value='JACKPOT';search.dispatchEvent(new f.dom.window.Event('input',{bubbles:true}));
 catalog=f.ctx.content.querySelector('#market-catalog');assert.equal(catalog.open,true);assert.equal(catalog.querySelectorAll('article').length,1);
 catalog.open=false;catalog.dispatchEvent(new f.dom.window.Event('toggle'));
 assert.equal(catalog.querySelector('[data-market-catalog-label]').textContent,'Afficher les effets');assert.equal(f.render().querySelector('#market-catalog').open,false);assert.equal(f.saved.length,0);f.dom.window.close();
});

test('Follow et Likes affichent deux lignes inactives sans créer de règles au rendu',()=>{
 const f=fixture(),before=JSON.stringify(f.rules),page=f.render(),rows=[...page.querySelectorAll('.market-free-row')];
 assert.deepEqual(rows.map(row=>row.dataset.marketFreeType),['follow','like']);assert.equal(page.querySelectorAll('[data-market-free-placeholder]').length,2);
 for(const row of rows){assert.equal(row.querySelector('[data-market-inline="enabled"]').checked,false);assert.equal(row.querySelector('[data-market-inline="effect"]').value,effects.find(e=>e.code==='GiveMoney').id);assert.equal(row.querySelector('[data-market-inline="parameter"]').value,'100');assert.equal(row.querySelector('.market-free-aside > strong').textContent,'gratuit');}
 assert.equal(rows[1].querySelector('[data-market-inline="threshold"]').value,'100');assert.equal(f.saved.length,0);assert.equal(JSON.stringify(f.rules),before);f.dom.window.close();
});
test('activer une ligne gratuite crée seulement le déclencheur demandé avec une action prête',async()=>{
 const f=fixture(),before=structuredClone(f.rules),page=f.render(),toggle=page.querySelector('[data-market-free-placeholder="like"] [data-market-inline="enabled"]');toggle.checked=true;await f.ctx.saveSupermarketInline(toggle);
 const rule=f.saved.at(-1);assert.equal(f.saved.length,1);assert.equal(rule.enabled,true);assert.equal(rule.trigger.type,'like');assert.equal(rule.trigger.threshold,100);assert.equal(rule.actions[0].config.effectId,effects.find(e=>e.code==='GiveMoney').id);assert.equal(rule.actions[0].config.parameters.count,100);assert.deepEqual(f.rules.slice(0,3),before);
 const next=f.render();assert.equal(next.querySelectorAll('[data-market-free-placeholder]').length,1);assert.equal(next.querySelector('[data-market-free-type="like"] [data-market-inline="enabled"]').checked,true);f.dom.window.close();
});
test('deux réglages rapides de la même ligne inactive ne créent pas de doublon et ne l’activent pas',async()=>{
 const f=fixture(),page=f.render(),row=page.querySelector('[data-market-free-placeholder="follow"]'),select=row.querySelector('[data-market-inline="effect"]'),amount=row.querySelector('[data-market-inline="parameter"]');select.value=effects.find(e=>e.code==='HireEmployees').id;amount.value='3';
 await Promise.all([f.ctx.saveSupermarketInline(select),f.ctx.saveSupermarketInline(amount)]);
 const current=f.ctx.snapshot.state.game.interactionRulesByPack[pack.id];assert.equal(current.length,4);const rule=current.at(-1);assert.equal(rule.enabled,false);assert.equal(rule.trigger.type,'follow');assert.equal(rule.actions[0].config.effectId,select.value);assert.equal(rule.actions[0].config.parameters.count,3);assert.equal(f.saved[0].id,f.saved[1].id);f.dom.window.close();
});
test('les lignes gratuites gardent les sons, actions supplémentaires, conditions et titres déjà configurés',async()=>{
 const f=fixture(),rule=f.rules[0];rule.trigger={type:'like',enabled:false,threshold:250};rule.gameInteraction={title:'Mon bonus',marketColumn:'help'};rule.actions.push({id:'extra',type:'game.effect',config:{packId:pack.id,effectId:effects.find(e=>e.code==='FillShelves').id}},{id:'sound',type:'audio.play',config:{url:'https://example.test/sound.mp3',soundName:'Mon son'}});const before=structuredClone(rule);
 const row=f.render().querySelector('[data-market-free-type="like"]');assert.equal(row.querySelectorAll('.market-extra-effect').length,1);assert.equal(row.querySelector('.market-sound-name').textContent,'Mon son');
 const toggle=row.querySelector('[data-market-inline="enabled"]');toggle.checked=true;await f.ctx.saveSupermarketInline(toggle);const saved=f.saved.at(-1);assert.equal(saved.trigger.enabled,true);assert.deepEqual(saved.actions,before.actions);assert.deepEqual(saved.conditions,before.conditions);assert.deepEqual(saved.gameInteraction,before.gameInteraction);assert.deepEqual(saved.cooldown,before.cooldown);f.dom.window.close();
});

test('un changement de profil annule aussi la création d’une ligne gratuite',async()=>{
 const f=fixture(),page=f.render(),toggle=page.querySelector('[data-market-free-placeholder="follow"] [data-market-inline="enabled"]');toggle.checked=true;const pending=f.ctx.saveSupermarketInline(toggle);f.ctx.snapshot.state.session.profileId='other-profile';await assert.rejects(pending,/profil a changé/);assert.equal(f.saved.length,0);assert.equal(f.rules.length,3);f.dom.window.close();
});


test('les réglages de présentation remplacent seulement leurs commandes et conservent le même iframe',()=>{
 const f=fixture();f.ctx.snapshot.localOverlayUrls={gamePack:'https://overlay.test/game-pack.html?token=local'};f.ctx.snapshot.state.settings.account={uid:'creator'};
 const page=f.render(),frame=page.querySelector('.market-phone-source iframe'),initial=page.innerHTML;
 f.ctx.snapshot.state.settings.overlayConfigs={gameInteractionOverlays:{[pack.id]:{model:2,backgroundColor:'#abcdef'}}};
 const changed=f.ctx.renderSupermarketWorkspace(pack);assert.equal(f.ctx.patchSupermarketPreview(initial,changed),true);assert.equal(page.querySelector('.market-phone-source iframe'),frame);assert.equal(page.querySelector('[data-action="market-overlay-model"][aria-pressed="true"]').dataset.value,'2');assert.ok(page.querySelector('[data-market-overlay-color]'));assert.equal(page.querySelector('.market-preview-mode'),null);
 f.ctx.snapshot.state.settings.overlayConfigs.gameInteractionOverlays[pack.id].backgroundColor='#123456';const color=f.ctx.renderSupermarketWorkspace(pack);assert.equal(f.ctx.patchSupermarketPreview(changed,color),true);assert.equal(page.querySelector('iframe'),frame);
 f.ctx.snapshot.state.session.profileId='other';assert.equal(f.ctx.patchSupermarketPreview(color,f.ctx.renderSupermarketWorkspace(pack)),false);f.ctx.snapshot.state.session.profileId='profile-a';f.ctx.snapshot.state.settings.account.uid='other';assert.equal(f.ctx.patchSupermarketPreview(color,f.ctx.renderSupermarketWorkspace(pack)),false);f.ctx.snapshot.state.settings.account.uid='creator';
 f.ctx.snapshot.state.game.interactionRulesByPack[pack.id][0].gameInteraction.title='Autre interaction';assert.equal(f.ctx.patchSupermarketPreview(color,f.ctx.renderSupermarketWorkspace(pack)),false,'Une modification hors présentation doit conserver le rendu normal.');f.dom.window.close();
});


test('les noms standards sont courts dans les cartes, listes et catalogue sans écraser un titre personnalisé',()=>{
 const f=fixture(),effect=effects.find(e=>e.code==='GiveMoney');f.rules[0].gameInteraction={title:effect.previousNames[0]};
 let page=f.render();assert.equal(page.querySelector('.market-column.help [data-market-inline="title"]').value,effect.name);
 for(const item of page.querySelectorAll('.market-catalog-grid h4,.market-effect-choice option'))assert.ok(item.textContent.trim().split(/\s+/).length<=2,item.textContent);
 f.rules[0].gameInteraction.title='Mon cadeau avec un titre personnel';page=f.render();assert.equal(page.querySelector('.market-column.help [data-market-inline="title"]').value,'Mon cadeau avec un titre personnel');assert.equal(f.saved.length,0);f.dom.window.close();
});


test('la fiche propose le retrait du module et le retour aux valeurs par défaut à des endroits distincts',()=>{
 const f=fixture(),page=f.render();assert.ok(page.querySelector('.market-hero-links [data-action="uninstall-game"]'));assert.ok(page.querySelector('#market-interactions .market-section-heading [data-action="reset-game-interactions"]'));
 delete f.ctx.snapshot.state.game.installations[pack.id];assert.equal(f.render().querySelector('[data-action="uninstall-game"]'),null);f.dom.window.close();
});


test('la visite guidée couvre la préparation complète sans modifier les cartes et se place en haut du héros',()=>{
 const f=fixture(),page=f.render(),trigger=page.querySelector('[data-game-tour-start]');assert.ok(trigger);
 const steps=JSON.parse(trigger.dataset.gameTourSteps);assert.ok(steps.length>=12);assert.equal(steps[0].target,'.game-pack-launch-actions [data-action="install-game"]');
 for(const text of ['cadeaux','Follow','overlay','studio','LIVE','viewers','défaut'])assert.ok(steps.some(step=>(step.title+' '+step.text).includes(text)),text);
 assert.ok(steps.every(step=>step.global||step.targets?.some(selector=>page.querySelector(selector))||page.querySelector(step.target)||/conditions|session/.test(step.target)), 'les cibles absentes des stubs sont ignorées par le moteur');
 const hero=page.querySelector('.game-pack-hero');assert.equal(trigger.closest('.game-pack-hero'),hero);assert.equal(page.querySelector('.game-pack-tour-entry'),null);assert.ok(trigger.compareDocumentPosition(hero.querySelector('.game-pack-kicker'))&f.dom.window.Node.DOCUMENT_POSITION_FOLLOWING);assert.equal(f.saved.length,0);
});


test('les cadeaux du LIVE suivent les sections usuelles par défaut ; les autres exigent Tout afficher',async()=>{
 const f=fixture(),regional={id:'901',name:'Cadeau régional',cost:50,source:'tiktok-room',imageUrl:'https://example.test/regional.png'},foreign={id:'902',name:'Cadeau étranger',cost:50,imageUrl:'https://example.test/foreign.png'};
 f.ctx.giftPickerRoomMatches=room=>room?.username==='fixture';f.ctx.preloadGiftPickerCatalog=async()=>({gifts:[regional,foreign],room:{username:'fixture',available:true},roomGifts:[regional]});
 await f.ctx.addSupermarketInteraction('gift','help');const grid=f.ctx.dialogBody.querySelector('[data-market-gift-results]');
 assert.ok(grid.querySelector('[data-market-gift-choice="901"]'));assert.equal(grid.querySelector('[data-market-gift-choice="902"]'),null);assert.ok(grid.textContent.includes('RÉGION / LIVE'));
 const search=f.ctx.dialogBody.querySelector('[data-market-gift-search]');search.value='902';search.dispatchEvent(new f.dom.window.Event('input',{bubbles:true}));assert.equal(grid.querySelector('[data-market-gift-choice="902"]'),null,'Une recherche ne doit pas élargir la région silencieusement.');
 const all=f.ctx.dialogBody.querySelector('[data-market-gift-show-all]');all.checked=true;all.dispatchEvent(new f.dom.window.Event('change',{bubbles:true}));assert.ok(grid.querySelector('[data-market-gift-choice="902"]'));assert.ok(grid.textContent.includes('Autre région / spécial'));assert.equal(f.saved.length,0);
});

test('les cadeaux suivants sont chargés par lots de soixante et les filtres gardent leur portée',async()=>{
 const f=fixture(),regional=Array.from({length:135},(_,i)=>({id:String(2000+i),name:'Local '+i,cost:i<130?1:1000,imageUrl:'https://example.test/'+i+'.png'}));
 f.ctx.giftPickerRoomMatches=()=>true;f.ctx.preloadGiftPickerCatalog=async()=>({gifts:regional,room:{available:true},roomGifts:regional});await f.ctx.addSupermarketInteraction('gift','help');
 const grid=f.ctx.dialogBody.querySelector('[data-market-gift-results]'),scope=()=>[...grid.querySelectorAll('.market-gift-group')].at(-1);
 assert.equal(scope().querySelectorAll('.market-gift-entry').length,60);grid.querySelector('[data-market-gift-more]').click();assert.equal(scope().querySelectorAll('.market-gift-entry').length,120);grid.querySelector('[data-market-gift-more]').click();assert.equal(scope().querySelectorAll('.market-gift-entry').length,135);assert.equal(grid.querySelector('[data-market-gift-more]'),null);
 f.ctx.dialogBody.querySelector('[data-market-gift-range="large"]').click();assert.equal(scope().querySelectorAll('.market-gift-entry').length,5);assert.equal(f.saved.length,0);
});

test('les variantes régionales gardent leurs vrais ID et sont sélectionnables sans fusion',async()=>{
 const f=fixture(),group=require('../src/shared/gift-display').groupGiftDisplayRows,image='https://example.test/0123456789abcdef0123456789abcdef.webp';
 const gifts=[{id:'900',name:'Version mondiale',cost:5,imageUrl:image},{id:'901',name:'Version régionale',cost:5,imageUrl:image},{id:'902',name:'Autre version régionale',cost:5,imageUrl:image}];
 f.ctx.giftPickerDisplayGroups=group;f.ctx.giftPickerRoomMatches=()=>true;f.ctx.preloadGiftPickerCatalog=async()=>({gifts,room:{available:true},roomGifts:gifts.slice(1)});
 await f.ctx.addSupermarketInteraction('gift','help');const grid=f.ctx.dialogBody.querySelector('[data-market-gift-results]');assert.equal(grid.querySelector('[data-market-gift-choice="900"]'),null);assert.ok(grid.querySelector('[data-market-gift-choice="901"]'));assert.ok(grid.querySelector('[data-market-gift-choice="902"]'));assert.equal(grid.querySelector('.market-gift-variants').open,false);
 await f.ctx.chooseSupermarketGift('902');assert.equal(f.saved.at(-1).conditions[0].giftId,'902');assert.ok(!(f.saved.at(-1).conditions[0].giftIds||[]).includes('900'));
});

test('une liste complète vide ne devient pas le catalogue global ; hors LIVE le repli standard est explicite',async()=>{
 for(const verified of [true,false]){
  const f=fixture(),standard={id:'901',name:'Standard',cost:2,source:'catalog'},foreign={id:'902',name:'Spécial',cost:2,source:'tiklive'};
  f.ctx.giftPickerRoomMatches=()=>true;f.ctx.preloadGiftPickerCatalog=async()=>({gifts:[standard,foreign],room:{available:verified},roomGifts:[]});await f.ctx.addSupermarketInteraction('gift','help');const grid=f.ctx.dialogBody.querySelector('[data-market-gift-results]');
  assert.equal(!!grid.querySelector('[data-market-gift-choice="901"]'),!verified);assert.equal(grid.querySelector('[data-market-gift-choice="902"]'),null);if(!verified)assert.match(grid.textContent,/CADEAUX STANDARDS/);f.dom.window.close();
 }
});

test('une réponse régionale tardive actualise le popup ouvert sans effacer recherche et choix de portée',async()=>{
 const f=fixture(),a={id:'901',name:'Local Alpha',cost:5},b={id:'902',name:'Local Beta',cost:5};let result={gifts:[a,b],room:{available:false},roomGifts:[]};
 f.ctx.giftPickerRoomMatches=()=>true;f.ctx.preloadGiftPickerCatalog=async()=>result;f.ctx.cachedGiftPickerCatalog=()=>result;await f.ctx.addSupermarketInteraction('gift','help');const search=f.ctx.dialogBody.querySelector('[data-market-gift-search]');search.value='Local';search.dispatchEvent(new f.dom.window.Event('input',{bubbles:true}));
 result={gifts:[a,b],room:{available:true},roomGifts:[b]};f.ctx.refreshSupermarketGiftCatalog();const grid=f.ctx.dialogBody.querySelector('[data-market-gift-results]');assert.equal(f.ctx.dialogBody.querySelector('[data-market-gift-search]'),search);assert.equal(search.value,'Local');assert.equal(grid.querySelector('[data-market-gift-choice="901"]'),null);assert.ok(grid.querySelector('[data-market-gift-choice="902"]'));
 const before=grid.innerHTML;f.ctx.snapshot.state.settings.account={uid:'other'};result.roomGifts=[a];f.ctx.refreshSupermarketGiftCatalog();assert.equal(grid.innerHTML,before,'Un ancien compte ne peut remplacer le sélecteur courant.');assert.equal(f.saved.length,0);
});
