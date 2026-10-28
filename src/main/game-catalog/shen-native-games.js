"use strict";
const {SPECS}=require('../shen-native-games/specs'),{game}=require('./builders');
const DEFINITIONS={
 shenfarm:[
  ['rejoindre_protecteur','Lutin protecteur','help'],['renfort_protecteur','Renfort protecteur','help'],['pluie','Pluie','help'],['epouvantail','Épouvantail','help'],['arc_en_ciel','Arc-en-ciel','help'],['pluie_doree','Pluie dorée','help'],
  ['rejoindre_saboteur','Animal saboteur','trap'],['renfort_saboteur','Horde saboteurs','trap'],['danse','Danse forcée','trap'],['charrette','Charrette folle','trap'],['tornade','Tornade','trap'],['boss','Boss géant','trap'],
  ['prison','Prison','trap'],['meteores','Météores','trap'],['tempete','Tempête','trap'],['multiplicateur','Points doublés','help'],['ovni','OVNI allié','help'],['arme_hasard','Arme surprise','neutral'],['roue','Roue','neutral'],['likes','Pluie arc-en-ciel','help'],['renommer_ferme','Ferme renommée','neutral'],['ajouter_victoire','Victoire ajoutée','score'],['retirer_victoire','Victoire retirée','score'],['reset_victoires','Victoires réinitialisées','score']
 ],
 shenpaint:[
  ['artiste','Artiste allié','help'],['ballon','Ballon peinture','help'],['arc_en_ciel','Arc-en-ciel','help'],['licorne','Licorne','help'],['pinceau_geant','Pinceau géant','help'],['arme_surprise','Arme surprise','help'],
  ['gribouilleur','Gribouilleur','trap'],['grand_gribouille','Gribouilleur géant','trap'],['nuage_encre','Nuage encre','trap'],['pistolet_bouche','Pistolet bouché','trap'],['gouttes_ecran','Écran taché','trap'],['seau_encre','Seau encre','trap'],
  ['comete','Comète','neutral'],['win_plus','Victoire ajoutée','score'],['win_moins','Victoire retirée','score'],['inverser_wins','Victoires inversées','score'],['nouvelle_partie','Nouvelle partie','neutral']
 ],
 shenkite:[
  ['allie','Pilote allié','help'],['noeud_repare','Nœud réparé','help'],['fil_diamant','Fil diamant','help'],['rafale','Rafale','help'],['pluie_bonus','Pluie bonus','help'],['escadrille','Escadrille','help'],
  ['rival','Pilote rival','trap'],['bourrasque','Bourrasque','trap'],['orage','Orage','trap'],['oiseaux','Oiseaux','trap'],['pirate','Pirate','trap'],['tornade','Tornade','trap'],
  ['super_roi','Super roi','help'],['arrivee','Arrivée','neutral'],['win_plus_1','Victoire ajoutée','score'],['win_plus_2','Victoires +2','score'],['win_plus_10','Victoires +10','score'],['win_plus_20','Victoires +20','score'],['win_moins_1','Victoire retirée','score'],['win_moins_2','Victoires −2','score'],['win_moins_10','Victoires −10','score'],['win_moins_20','Victoires −20','score'],['reset_wins','Victoires réinitialisées','score'],['inverser_wins','Victoires inversées','score']
 ],
 'splash-bombes':[
  ['bombe_plus','Bombes supplémentaires','help'],['flamme_plus','Portée augmentée','help'],['donut','Invincibilité','help'],['bombe_surprise','Bombe surprise','help'],['pluie_bonus','Pluie bonus','help'],['frappe_aerienne','Frappe aérienne','help'],
  ['savon','Sol glissant','trap'],['escargot','Escargot','trap'],['inverse','Commandes inversées','trap'],['nuage_encre','Nuage encre','trap'],['caisse','Pluie caisses','trap'],['bombe_nucleaire','Bombe nucléaire','trap'],
  ['bombe','Bombe','neutral'],['missile','Missile','neutral'],['ovni','OVNI','neutral'],['pluie_meteores','Pluie météores','trap'],['pluie_peinture','Pluie peinture','neutral'],['tsunami','Tsunami','neutral'],['win_plus','Victoire ajoutée','score'],['win_moins','Victoire retirée','score'],['inverser_wins','Victoires inversées','score'],['nouvelle_partie','Nouvelle partie','neutral']
 ]
};
const descriptions={
 shenfarm:'Votre communauté protège ou sabote votre ferme : lutins, animaux, météo et événements.',
 shenpaint:'Votre communauté repeint le monde ou le couvre d’encre : artistes, créatures et armes de peinture.',
 shenkite:'Votre communauté rejoint les pilotes et influence la bataille de cerfs-volants.',
 'splash-bombes':'Une arène de bombes et de peinture, en solo contre le robot ou à deux sur le même écran.'
};
function nativeEffects(id){return DEFINITIONS[id].map(([code,name,column])=>({id:id+'-'+code,code,name,column:column==='score'?'neutral':column,category:column==='score'?'Victoires':'Partie',image:'assets/games/shen-native/'+id+'/'+code+'.svg',available:true,description:name+' dans '+SPECS[id].title+'. Commencez une partie avant de tester.',quantity:1,parameters:[{id:'count',label:'Quantité',min:1,max:100,step:1,defaultValue:1}],quantityParameter:'count',icon:column==='help'?'✦':column==='trap'?'⚡':'◆'}));}
const SHEN_NATIVE_GAMES=Object.entries(SPECS).map(([id,spec])=>game(id,spec.title,{
 price:9.99,workspaceLayout:'shared',storefronts:['shenpulse'],coverArtwork:'covers/'+id+'.webp',artwork:'shen-native/scenes/'+id+'.svg',sceneArtwork:'shen-native/scenes/'+id+'.svg',
 source:'ShenPulse · jeu autonome',description:descriptions[id],tags:['ShenPulse','achat unique','jeu autonome'],
 connector:{type:'shen-native',host:'127.0.0.1',port:spec.port,launchConnectionTimeoutMs:60000},effects:nativeEffects(id),interactionCatalogVersion:2026102605,installerVersion:require('../game-installers/shen-native-games')[id].version
}));
module.exports={SHEN_NATIVE_GAMES,DEFINITIONS,nativeEffects};
