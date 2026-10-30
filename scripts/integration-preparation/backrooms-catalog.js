"use strict";

const gameId = "escape-the-backrooms";
const rows = [
  ["exorcisme", "Exorcisme", "help", "Retire les entités ajoutées et les entités proches. Partie solo ou hôte requise."],
  ["serenite", "Sérénité", "help", "Rend 25 points de santé mentale."],
  ["serenite_totale", "Sérénité totale", "help", "Restaure la santé mentale."],
  ["rapide", "Course rapide", "help", "Accélère la marche et le sprint, puis restaure les vitesses initiales.", 20],
  ["objet_eau_amande", "Eau amande", "help", "Ajoute de l’eau d’amande dans l’inventaire."],
  ["objet_barre_energie", "Barre énergie", "help", "Ajoute une barre énergétique dans l’inventaire."],
  ["monstre_hound", "Chien Hound", "trap", "Fait apparaître un Hound portant le nom du viewer.", 45],
  ["monstre_smiler", "Smiler", "trap", "Fait apparaître un Smiler portant le nom du viewer.", 45],
  ["monstre_skinstealer", "Skinstealer", "trap", "Fait apparaître un Skinstealer portant le nom du viewer.", 45],
  ["folie", "Folie", "trap", "Retire 25 points de santé mentale."],
  ["ralenti", "Course lente", "trap", "Ralentit le joueur, puis restaure les vitesses initiales.", 20],
  ["horde", "Horde", "trap", "Fait apparaître une horde nommée d’après le viewer. Partie solo ou hôte requise.", 45],
  ...Object.entries({smiler_rapide:"Smiler rapide",bacteria:"Bacteria",bacteria_rodeuse:"Bacteria rôdeuse",partygoer:"Partygoer",moth:"Papillon mortel",clump:"Clump",faceling:"Faceling",araignee:"Araignée",poupee:"Poupée"}).map(([id,name])=>["monstre_"+id,name,"trap","Fait apparaître cette entité avec le nom du viewer. Partie solo ou hôte requise.",45]),
  ["cri","Cri","trap","Joue un cri dans le jeu."],
  ["rire_smiler","Rire Smiler","trap","Joue le rire d’un Smiler."],
  ["alarme","Alarme","trap","Déclenche une alarme sonore."],
  ["musique_angoisse","Musique angoissante","trap","Joue une musique d’angoisse."],
  ["secousse","Caméra secouée","trap","Joue la secousse de caméra prévue par le jeu."],
  ["insanite","Vision troublée","trap","Déforme temporairement la perspective de la caméra, puis rétablit votre champ de vision.",15],
  ["evanouissement","Évanouissement","trap","Fait perdre connaissance au personnage."],
  ["glissade","Glissade","trap","Fait glisser le personnage."],
  ["douleur","Douleur","trap","Applique l’effet de douleur."],
  ["epuisement","Épuisement","trap","Épuise le personnage."],
  ["lacher_tout","Inventaire lâché","trap","Fait lâcher les objets transportés."],
  ["mort","Mort immédiate","trap","Termine la vie du personnage. À tester en dernier."],
  ["pluie_objets","Pluie objets","help","Fait apparaître cinq objets devant le joueur."],
];
const items={eau_amande:"Eau amande",barre_energie:"Barre énergie",jus:"Jus",baton_lumineux:"Bâton lumineux",pistolet_detresse:"Pistolet détresse",feu_artifice:"Feu artifice",tronconneuse:"Tronçonneuse",couteau:"Couteau",pied_de_biche:"Pied-de-biche",corde:"Corde",appareil_photo:"Appareil photo",lidar:"Lidar",thermometre:"Thermomètre",talkie:"Talkie-walkie",insecticide:"Insecticide",gelee:"Gelée",casque:"Casque plongée",jouet:"Jouet",eau_concentree:"Eau concentrée"};
for(const [id,name] of Object.entries(items)) {
  if(!rows.some(row=>row[0]==="objet_"+id)) rows.push(["objet_"+id,name,"help","Ajoute cet objet dans l’inventaire. Une place libre est nécessaire."]);
  rows.push(["sol_"+id,name+" sol","help","Pose cet objet dans le niveau, près du personnage."]);
}
const effects=rows.map(([code,name,column,description,duration=0],sortOrder)=>({
  id:gameId+"-"+code,code,name:name.split(/\s+/).slice(0,2).join(" "),description,column,
  category:code.startsWith("monstre_")||code==="horde"?"Entités":/^(objet|sol)_/.test(code)?"Objets":"Joueur et ambiance",
  service:"native",available:true,duration,sortOrder,
  ...(/^(objet|sol)_/.test(code)?{quantityParameter:"quantity",parameters:[{id:"quantity",label:"Quantité",type:"number",min:1,max:20,step:1,defaultValue:1}]}:{}),
  ...(duration?{durationParameter:"durationSeconds",parameters:[{id:"durationSeconds",label:"Durée (secondes)",type:"number",min:code.startsWith("monstre_")||code==="horde"?10:5,max:code.startsWith("monstre_")||code==="horde"?180:code==="insanite"?60:90,step:1,defaultValue:duration}]}:{})
}));
module.exports={gameId,effects};
