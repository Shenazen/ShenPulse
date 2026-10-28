"use strict";
const policy=require('../../shared/game-workspace-policy');
const titles=require('../../shared/game-interaction-titles');
const starters=require('./starter-effects');
const {semanticName}=require('./short-names');
const {supermarketDefaultMappings}=require('./shop-game-presets');
const STARTER_VERSION=2026102603;
const STARTER_CLEANUP_VERSION=2026102604;
const CLEANUP_PACKS=new Set(['cult-of-the-lamb','minecraft-bedrock-box','minecraft-survival-plugin','super-mario-kart','terraria']);
const GIFTS={help:[['Rose','5655',1],['Finger Heart','5487',5],['Perfume','5658',20],['Doughnut','5879',30],['Cap','6104',99],['Corgi','6267',299]],trap:[['TikTok','5269',1],['Tofu','10604',5,['11015']],['S Flowers','14115',20],['Capybara','14488',30,['17490']],['Hat and Mustache','6427',99],['Boxing Gloves','6007',299]]};
const explicit={f_crouch_walk:'Marche accroupie',f_sidestep_dancer:'Esquive latérale',f_bunny_hopper:'Sauts courus',chaos_upupaway:'Joueur projeté',chaos_tp_mountchilliad:'TP Chiliad',chaos_tp_random:'TP aléatoire',chaos_5stars:'Recherche maximale',chaos_vehicle_random:'Véhicule aléatoire',chaos_vehicle_flip:'Véhicule retourné',chaos_tank_on_head:'Tank perché',chaos_delete_vehicle:'Véhicule supprimé',chaos_vehicle_boost:'Super vitesse',chaos_zombie_horde:'Horde zombie',chaos_tp_lsairport:'TP aéroport',chaos_super_jump:'Super saut',chaos_vehicle_repair:'Véhicule réparé',chaos_drunk:'Ivresse',tout_annuler:'Rétablir effets',reset_effects:'Rétablir effets',viewer_client:'Client viewer',reputation:'Client viewer',faillite:'Faillite',argent_plus:'Argent offert',argent_moins:'Argent volé',xp_boutique:'Expérience boutique',client_puant:'Client puant',lumieres:'Coupure courant',remplir_rayons:'Rayons pleins',vider_rayon:'Rayon vidé',employe_arrive:'Employé offert',agrandir_magasin:'Agrandir magasin',chaos_cartons:'Chaos cartons',spawn_monster:'Monstre hostile',spawn_human:'Client humain',spawn_doppel:'Client sosie',spawn_pet:'Animal familier',inventory_max:'Grand inventaire',inventory_min:'Petit inventaire',speed_zero:'Œuf immobilisé',jump_zero:'Saut désactivé',next:'Point suivant',prev:'Point précédent',bottom:'Retour départ',unfry:'Cuisson annulée',heal_all:'Équipe soignée',giveitem_masterball:'Master Ball',giveitem_rarecandy:'Super Bonbon',heal_full:'Soin complet',give_money_1000:'Argent offert',remove_money_1000:'Argent volé',give_buff_invincibility:'Invincibilité',heal_player:'Soin offert',damage_player:'Dégâts joueur',spawn_town_npc:'PNJ offert',golden_slime_rain:'Slimes dorés',givemoney:'Argent offert',takemoney:'Argent volé',givefruit:'Wumpas offerts',takefruit:'Wumpas retirés',givelife:'Vies offertes',takelife:'Vies retirées',giveboxes:'Caisses offertes',takeboxes:'Caisses retirées',fullheal:'Soin complet'};
function compactEffectName(effect){
 const semantic=semanticName(effect);if(semantic)return titles.shortDefaultTitle(semantic);
 if(explicit[effect.code])return explicit[effect.code];
 let name=String(effect.name||effect.id).trim();if(name.split(/\s+/).length<=2)return name;
 name=name.replace(/(\d+)\s*([%$]|XP|PV|s|sec|secondes?|minutes?)\b/gi,(_m,n,unit)=>n+unit).replace(/(\d+)\s*\$/g,'$1$');
 const music=name.match(/^Changer la musique\s*:\s*(?:thème (?:de |du ))?(.+)$/i);if(music)return titles.shortDefaultTitle('Musique '+music[1]);
 name=name.replace(/^(?:Apparition|Infliger|Soigner|Prochain plan)\s*:\s*/i,'');
 name=name.replace(/\b(?:joueur|personnage)\s+([12])\s*:\s*/gi,'J$1 ').replace(/\b(?:joueur|personnage)\s+([12])\b/gi,'J$1');
 const nameWords=name.split(/\s+/).filter(word=>!['de','du','des','la','le','les','un','une','à','au','aux','en','dans','pour','avec','pendant','et',':','toute','tout','complètement','toutes','faire'].includes(word.toLowerCase()));
 if(nameWords.length<=2)return nameWords.join(' ');
 if(/^(?:Donner|Offrir|Ajouter)\b/i.test(name)){const body=nameWords.slice(1);if(body.length===1)return body[0]+' offert';if(/^[-+]?\d/.test(body[0]))return titles.shortDefaultTitle(body.slice(1).join(' ')+' +'+body[0]);return body.slice(-2).join(' ');}
 return titles.shortDefaultTitle(nameWords.join(' '));
}
function prepareGamePresentation(pack){
 const effects=pack.effects.map(effect=>{const compact=compactEffectName(effect),name=titles.capitalize(compact);return {...effect,name,...(name!==effect.name?{previousNames:[...new Set([...(effect.previousNames||[]),effect.name,compact])]}:{})};});
 if(effects.some(effect=>effect.winCounter))for(const [kind,name,operation]of [['reset','Reset wins','reset'],['invert','Inverser wins','invert'],['mute','Mute','mute'],['unmute','Démute','unmute']])effects.push({id:pack.id+'-win-'+kind,code:'overlay_win_'+kind,name,description:kind==='reset'?'Remet le compteur de wins à zéro.':kind==='invert'?'Inverse le signe du compteur de wins.':kind==='mute'?'Coupe le micro Windows par défaut pendant la durée choisie.':'Retire du temps au mute lancé par ShenPulse.',category:'WINS',available:true,service:'overlay',image:'../../resources/overlays/media/game-wins/'+kind+'.svg',actionType:'overlay.win-counter',winCounter:{amount:0,operation},duration:kind==='mute'||kind==='unmute'?60:0,icon:'★'});
 const previousDefaultMappings=structuredClone(pack.defaultMappings||[]);
 const mappings=previousDefaultMappings.map(mapping=>{const effect=effects.find(e=>e.id===mapping.effectId);return {...mapping,...(effect?.winCounter?.operation==='multiplier'&&!['gtav-koth-enhanced','gtav-hiking-enhanced'].includes(pack.id)?{giftName:'',giftId:'',giftIds:[],triggerEnabled:false,enabled:false,duration:600,actionConfig:{...(mapping.actionConfig||{}),stackMode:'increment',maxMultiplier:10,addDuration:false}}:{}),title:effect&&(mapping.title===pack.effects.find(e=>e.id===mapping.effectId)?.name)?effect.name:titles.shortDefaultTitle(mapping.title||effect?.name||'')};});
 const external=policy.eligible(pack);
 if(!external)return {...pack,effects,defaultMappings:mappings};
 if(pack.id==='supermarket-simulator')return {...pack,effects,defaultMappings:supermarketDefaultMappings(effects)};
 const curated=starters[pack.id],selected=[];
 if(curated)for(const column of ['help','trap'])for(const [index,key]of curated[column].entries()){
  const effect=effects.find(effect=>(effect.code===key||effect.id===key)&&effect.available!==false);if(!effect)continue;effect.column=column;
  const [giftName,giftId,giftCost,giftIds=[]]=GIFTS[column][index];
  selected.push({id:'starter-'+column+'-'+(index+1),effectId:effect.id,title:effect.name,marketColumn:column,giftName,giftId,giftCost,giftIds,triggerType:'gift',triggerEnabled:true,enabled:true,threshold:1,duration:effect.duration||0,parameters:{},preserveExisting:true});
 }
 // Keep the game's original wins and free events separate from its twelve effect starters.
 const extra=mappings.filter(mapping=>{const effect=effects.find(e=>e.id===mapping.effectId);return effect?.winCounter||effect?.actionType==='overlay.win-counter'||['follow','like','likes'].includes(mapping.triggerType);});
 for(const effect of effects.filter(effect=>['overlay_win_reset','overlay_win_invert','overlay_win_mute','overlay_win_unmute'].includes(effect.code)))extra.push({id:'wins-'+effect.winCounter.operation,effectId:effect.id,title:effect.name,triggerType:'gift',triggerEnabled:effect.winCounter.operation==='reset',enabled:effect.winCounter.operation==='reset',...(effect.winCounter.operation==='reset'?{giftName:'Octopus',giftCost:10000}:{}),threshold:1,preserveExisting:true});
 const cleanupVersion=pack.id==='tcg-card-shop-simulator'?2026102606:CLEANUP_PACKS.has(pack.id)?STARTER_CLEANUP_VERSION:0;
 return {...pack,effects,previousDefaultMappings,starterDefaultsVersion:STARTER_VERSION,...(cleanupVersion?{starterCleanupVersion:cleanupVersion}:{}),...(pack.id==='tcg-card-shop-simulator'?{starterCleanupScope:'generated'}:{}),defaultMappings:[...selected,...extra],interactionCatalogVersion:Math.max(cleanupVersion,STARTER_VERSION,pack.interactionCatalogVersion||0)};
}
module.exports={prepareGamePresentation,compactEffectName,STARTER_VERSION,GIFTS};
