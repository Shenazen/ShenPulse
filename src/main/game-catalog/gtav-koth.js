"use strict";
const {game}=require("./builders");
const models=require("./gtav-koth-models.json");
const {GTAV_MONT_CHILIAD_EFFECTS}=require("../gtav-mont-chiliad-catalog");
const operations=[
 ["koth_clear","Rampe nettoyée","Retire uniquement les obstacles créés par KOTH.","help"],
 ["koth_ramp_jump","Saut rampe","Propulse le joueur vers le haut de la rampe.","help"],
 ["koth_start","Retour départ","Replace le joueur au début de la rampe.","trap"],
 ["koth_finish","TP sommet","Place le joueur au sommet ; restez dix secondes pour gagner.","help"],
 ["koth_meteor","Météorite","Déclenche un impact près du joueur.","trap"],
 ["koth_companion","Compagnon offert","Crée un compagnon qui suit le joueur pendant 45 secondes.","help"],
 ["koth_random_obstacle","Hasard Obstacle","Lance un obstacle aléatoire depuis la zone d’arrivée. Tous les modèles sont tirés sans répétition avant un nouveau cycle. Collisions actives ; retrait seulement après la chute hors de la rampe.","trap"],
 ["koth_log","Tronc roulant","Lance un tronc depuis la zone d’arrivée ; il roule jusqu’en bas et reste présent tant qu’il n’est pas tombé hors de la rampe.","trap"],
 ["koth_super_jump","Super saut","Active les super sauts pendant 20 secondes.","help",20],
 ["koth_prop","Obstacle tonneau","Lance un tonneau depuis la zone d’arrivée, avec collisions actives jusqu’à sa chute hors de la rampe.","trap"],
 ["koth_jail","Prison","Enferme le joueur dans une cage visible pendant la durée choisie, puis le libère.","trap",5],
 ["koth_exit_jail","Sortie prison","Retire les barreaux et libère le joueur ; une prison doit déjà être active.","help"],
 ["koth_heal","Vie restaurée","Restaure la vie du joueur.","help"],
 ["koth_shield","Bouclier temporaire","Protège le joueur pendant vingt secondes, puis rétablit sa protection précédente.","help",20],
 ["koth_sprint","Sprint rapide","Augmente le sprint pendant quinze secondes, puis rétablit sa vitesse.","help",15],
 ["koth_ragdoll","Chute forcée","Fait tomber le joueur pendant la durée choisie, trois secondes par défaut.","trap",3],
 ["koth_create","Créer rampe","Crée ou recrée la rampe avec les réglages du menu F10.","neutral"],
 ["koth_destroy","Retirer rampe","Retire la rampe et ses obstacles ; F10 permet de la recréer.","neutral"]
];
const effects=[
 ...operations.map(([id,name,description,column,duration=0])=>({id,code:id,name,description,column,duration,quantity:1,category:["koth_create","koth_destroy"].includes(id)?"Rampe":["koth_log","koth_prop","koth_random_obstacle"].includes(id)?"Obstacles":"Joueur",available:true,service:"native",icon:"↗"})),
 ...models.map(model=>({id:"koth_vehicle_"+model,code:"koth_vehicle_"+model,name:"Obstacle "+model[0].toUpperCase()+model.slice(1),description:"Fait apparaître le véhicule "+model+" dans la zone d’arrivée. Il dévale vers le joueur, peut se retourner et heurter les autres obstacles ; il est retiré seulement après sa chute hors de la rampe. Le modèle doit exister dans votre version de GTA V Enhanced.",column:"trap",duration:0,quantity:1,category:"Véhicules",available:true,service:"native",icon:"◇"})),
 ...GTAV_MONT_CHILIAD_EFFECTS.filter(effect=>effect.winCounter).map(effect=>({...effect,description:effect.description.replaceAll("au Mont Chiliad","dans KOTH").replaceAll("lors d’une mort","lors d’une chute ou mort")}))
].map((effect,sortOrder)=>({...effect,...(!effect.image?{image:"../../resources/game-interactions/gtav-koth-enhanced/"+effect.id+(effect.code.startsWith("koth_vehicle_")?".webp":".png")}:{}),sortOrder}));
const mappings=require("./gtav-koth-wins").kothWinMappings(GTAV_MONT_CHILIAD_EFFECTS);
const GTAV_KOTH=game("gtav-koth-enhanced","GTA V KOTH Enhanced",{
 included:true,workspaceLayout:"shared",storefronts:["rockstar-games","steam","epic-games"],
 artwork:"catalog/gtav-koth-enhanced.jpg",coverArtwork:"covers/gtav-koth-enhanced.png",installerVersion:"1.0.9",
 source:"ShenPulse",description:"Gravissez une rampe géante pendant que vos viewers y font dévaler véhicules et obstacles. Mode Histoire de GTA V Enhanced, avec rampe réglable, wins et interactions locales ShenPulse.",
 connector:{type:"tcp-server",host:"127.0.0.1",port:58469,timeoutMs:30000,expectResponse:true,launchConnectionTimeoutMs:600000,focusProcessOnManualTrigger:"GTA5_Enhanced",launchConnectionFailureMessage:"Le module KOTH ne répond pas. Installez les interactions dans GTA V Enhanced, fermez le jeu puis lancez-le depuis cette page et chargez le mode Histoire."},
 effects,defaultMappings:mappings,interactionCatalogVersion:2026102702
});
module.exports={GTAV_KOTH};
