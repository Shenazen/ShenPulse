"use strict";
const {randomUUID}=require('node:crypto');
const {game}=require('./game-catalog/builders');
const {defaultGameInteractionRule}=require('./game-hub/interaction-defaults');
const {normalizeProcessName}=require('./windows-input-service');
const BUILDER_ID='personalise-tes-jeux',ART='personalise-tes-jeux.webp';
const NON_GAME_PROCESS=/^(?:shenpulse|explorer|powershell|pwsh|cmd|windowsterminal|code|codex|chatgpt|claude|openai|credentialui|consent)$/i;
const ASSISTANT_WINDOW=/(?:^|[\s·—–|:-])(?:chatgpt|openai|codex|claude)(?:$|[\s·—–|:-])/i;
function isGameProcess(processName){return !NON_GAME_PROCESS.test(String(processName||'').replace(/\.exe$/i,''));}
function gameWindows(entries){return entries.filter(entry=>entry?.ProcessName&&isGameProcess(entry.ProcessName)&&!ASSISTANT_WINDOW.test(entry.MainWindowTitle||'')).map(entry=>({processName:entry.ProcessName,title:entry.MainWindowTitle}));}
const PRESETS=[['jump','Sauter','ESPACE','help','Rose',1],['sprint','Sprint','SHIFT','help','Finger Heart',5],['interact','Interagir','E','help','Doughnut',30],['crouch','S’accroupir','CTRL','trap','TikTok',1],['drop','Lâcher objet','A','trap','Perfume',20],['reload','Recharger','R','trap','Confetti',100]];
function metadata(incoming={},previous={}){
 const name=String(incoming.name??previous.name??'').trim().replace(/\s+/g,' ');if(!name||name.length>64)throw Error('Le nom du jeu doit contenir de 1 à 64 caractères.');
 const process=String(incoming.processName??previous.processName??'').trim();const processName=process?normalizeProcessName(process):'';
 if(!isGameProcess(processName))throw Error('Choisissez la fenêtre du jeu, pas une autre application.');
 const artworkUrl=String(incoming.artworkUrl??previous.artworkUrl??'');
 if(artworkUrl&&!/^data:image\/(?:png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(artworkUrl))throw Error('Utilisez une image PNG, JPEG ou WebP.');
 if(artworkUrl.length>1400000)throw Error('L’image dépasse la taille autorisée (1 Mo).');
 return {id:previous.id||'custom-game-'+randomUUID(),name,processName,artworkUrl,createdAt:previous.createdAt||new Date().toISOString()};
}
function base(id,name){return {...game(id,name,{included:true,storefronts:['shenpulse'],workspaceLayout:'shared',artwork:ART,coverArtwork:ART,connector:{type:'custom-keyboard'}}),catalogCategory:'shenpulse',catalogCategories:['shenpulse'],source:'ShenPulse',requiresPro:true};}
function builderPack(){return {...base(BUILDER_ID,'Personnalise tes jeux'),customGameBuilder:true,pinned:true,description:'Créez les interactions de votre jeu : cadeaux, touches du clavier, sons et overlay.'};}
function packFor(definition){
 // Old packs may have targeted the assistant window during setup. Keep their
 // cards and artwork, but require a real game target before enabling them.
 if(!isGameProcess(definition.processName))definition={...definition,processName:''};
 const effects=PRESETS.map(([key,name,shortcut,column])=>({id:'keyboard-'+key,code:'keyboard-'+key,name,column,category:'Clavier',available:true,customShortcut:true,description:'Remet le jeu sélectionné au premier plan, puis lui envoie les touches. Séparez les touches simultanées par + et les étapes par ;.',image:'data:image/svg+xml,'+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 160"><rect x="8" y="8" width="144" height="144" rx="28" fill="#20172f" stroke="#33d9e4" stroke-width="4"/><text x="80" y="93" text-anchor="middle" font-family="sans-serif" font-size="30" fill="#ffffff">'+shortcut+'</text></svg>'),parameters:[{id:'shortcut',label:'Touches du clavier',type:'text',format:'shortcut',maxLength:80,defaultValue:shortcut},{id:'holdMs',label:'Maintien (ms)',min:40,max:10000,step:10,defaultValue:100},{id:'repeat',label:'Répétitions',min:1,max:10,step:1,defaultValue:1},{id:'gapMs',label:'Intervalle (ms)',min:0,max:5000,step:10,defaultValue:150}]}));
 effects.push({id:'overlay-only',code:'overlay-only',name:'Overlay seul',category:'Overlay',available:true,description:'Affiche la carte et joue son son, sans appuyer sur une touche.',image:'data:image/svg+xml,'+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 160"><rect width="160" height="160" rx="28" fill="#27143b"/><text x="80" y="100" text-anchor="middle" font-size="70" fill="#32e6ee">★</text></svg>')});
 for(const [key,name,operation,amount]of [['add','Ajouter wins','adjust',1],['remove','Retirer wins','adjust',-1],['reset','Reset wins','reset',0],['invert','Inverser wins','invert',0],['multiplier','Multiplicateur','multiplier',2],['mute','Mute','mute',0],['unmute','Démute','unmute',0]])effects.push({id:definition.id+'-win-'+key,code:'overlay_win_'+key,name,category:'WINS',available:true,actionType:'overlay.win-counter',winCounter:{operation,amount},duration:['mute','unmute'].includes(key)?60:key==='multiplier'?600:0,image:'../../resources/overlays/media/game-wins/'+(['reset','invert','mute','unmute'].includes(key)?key:'reset')+'.svg'});
 const pack={...base(definition.id,definition.name),customGame:true,customGameDefinition:definition,artworkUrl:definition.artworkUrl||'',coverArtwork:definition.artworkUrl?'':ART,connector:{type:'custom-keyboard',processName:definition.processName},guide:{mode:'custom-keyboard',summary:'Ouvrez votre jeu, sélectionnez sa fenêtre et configurez les mêmes touches que dans ses contrôles. Les jeux qui bloquent les entrées simulées peuvent ne pas réagir.'},description:'Votre pack de raccourcis clavier personnalisé.',effects,interactionCatalogVersion:1};
 pack.defaultMappings=PRESETS.map(([key,name,_shortcut,column,giftName,giftCost])=>({id:key,effectId:'keyboard-'+key,title:name,marketColumn:column,giftName,giftCost,enabled:true,triggerType:'gift'}));
 for(const [i,amount]of [1,3,20,45].entries())for(const [direction,gifts]of [['add',['Money Gun','Galaxy','Private Jet','Sunset Speedway']],['remove',["Lion’s Mane",'Gerry the Giraffe','Leon the Kitten','Interstellar']]])pack.defaultMappings.push({id:'win-'+direction+'-'+i,effectId:definition.id+'-win-'+direction,amount:direction==='add'?amount:-amount,giftName:gifts[i],giftCost:[500,1000,4888,10000][i],enabled:false,triggerType:'gift'});
 for(const kind of ['reset','invert','multiplier','mute','unmute'])pack.defaultMappings.push({id:'win-'+kind,effectId:definition.id+'-win-'+kind,enabled:false,triggerEnabled:false,triggerType:'gift',duration:kind==='multiplier'?600:60});
 return pack;
}
function createRules(pack,gifts){return pack.defaultMappings.map(mapping=>defaultGameInteractionRule(pack,pack.effects.find(e=>e.id===mapping.effectId),mapping,1,gifts));}
module.exports={BUILDER_ID,builderPack,metadata,packFor,createRules,isGameProcess,gameWindows};
