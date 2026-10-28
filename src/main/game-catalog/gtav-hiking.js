"use strict";
const {game}=require('./builders');
const {GTAV_MONT_CHILIAD_EFFECTS}=require('../gtav-mont-chiliad-catalog');
const rows=[
 ['hike_rabbits','Lapins fans','Crée des lapins amicaux qui suivent le joueur pendant trois minutes.','help','Compagnons'],
 ['hike_companion','Compagnon offert','Crée un randonneur amical qui suit le joueur pendant trois minutes.','help','Compagnons'],
 ['hike_forward','Point suivant','Téléporte au prochain point, qui est validé en respectant le mode à pied ou véhicules.','help','Parcours'],
 ['hike_speed','Sprint rapide','Accélère le sprint pendant la durée choisie, puis rétablit sa vitesse.','help','Joueur',15],
 ['hike_ignite','Adversaires embrasés','Incendie les adversaires créés par Hiking. Faites d’abord apparaître un adversaire.','help','Adversaires'],
 ['hike_heal','Soin complet','Restaure la vie du joueur.','help','Joueur'],
 ['hike_funny_npc','Singe hostile','Crée un personnage costumé en singe qui attaque le joueur.','trap','Adversaires'],
 ['hike_back','Point précédent','Retire un point validé et replace le joueur au point précédent.','trap','Parcours'],
 ['hike_alien','Alien hostile','Crée un personnage en costume alien qui attaque le joueur.','trap','Adversaires'],
 ['hike_animal','Cougar hostile','Crée un cougar qui attaque le joueur.','trap','Adversaires'],
 ['hike_quake','Séisme','Secoue la caméra et perturbe physiquement le joueur pendant la durée choisie.','trap','Joueur',12],
 ['hike_blackhole','Trou noir','Crée un trou noir devant la caméra qui attire progressivement les entités proches.','trap','Joueur',12],
 ['hike_attackers','Bandit hostile','Crée un bandit armé d’un pistolet près du joueur.','trap','Adversaires'],
 ['hike_jump','Super saut','Active les super sauts pendant la durée choisie.','help','Joueur',20],
 ['hike_weapons','Arme offerte','Offre un pistolet et des munitions au joueur.','help','Joueur'],
 ['hike_disarm','Armes retirées','Retire les armes du joueur.','trap','Joueur'],
 ['hike_shield','Bouclier temporaire','Protège pendant la durée choisie puis restaure la protection précédente.','help','Joueur',20],
 ['hike_ragdoll','Chute forcée','Fait tomber le joueur pendant la durée choisie.','trap','Joueur',3],
 ['hike_clear','Adversaires retirés','Retire les personnages créés par les interactions de Hiking.','help','Adversaires'],
 ['hike_start','Retour départ','Remet la progression à zéro et replace le joueur au départ sans modifier la durée.','trap','Parcours'],
 ['hike_restart','Nouvelle randonnée','Commence une nouvelle manche au départ du parcours.','neutral','Parcours']
];
const effects=rows.map(([id,name,description,column,category,duration=0],sortOrder)=>({id,code:id,name,description,column,category,duration,quantity:1,available:true,service:'native',image:'../../resources/game-interactions/gtav-hiking-enhanced/'+id+'.png',sortOrder}));
const wins=GTAV_MONT_CHILIAD_EFFECTS.filter(e=>e.winCounter).map(e=>({...e,description:e.description.replaceAll('au Mont Chiliad','dans Hiking')}));
const mappings=require('./gtav-koth-wins').kothWinMappings(wins).map(m=>({...m,id:m.id.replace(/^koth-/,'hiking-')}));
const GTAV_HIKING=game('gtav-hiking-enhanced','GTA V Hiking Enhanced',{included:true,workspaceLayout:'shared',source:'ShenPulse',storefronts:['rockstar-games','steam','epic-games'],artwork:'covers/gtav-hiking-enhanced.png',coverArtwork:'covers/gtav-hiking-enhanced.png',description:'Gravissez le Mont Chiliad en validant trente points de contrôle pendant que vos viewers aident ou perturbent votre randonnée. Parcours personnalisable, mode Histoire Enhanced et connexion locale ShenPulse.',installerVersion:'1.0.3',connector:{type:'tcp-server',host:'127.0.0.1',port:58470,timeoutMs:30000,expectResponse:true,launchConnectionTimeoutMs:600000,focusProcessOnManualTrigger:'GTA5_Enhanced',launchConnectionFailureMessage:'Le module Hiking ne répond pas. Installez les interactions dans GTA V Enhanced puis lancez le mode Histoire depuis cette page.'},effects:[...effects,...wins],defaultMappings:mappings,interactionCatalogVersion:2026102701});
module.exports={GTAV_HIKING};
