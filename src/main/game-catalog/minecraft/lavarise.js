"use strict";
const {parameter,winEffect}=require('./builders');
const p=(id,label,value,min,max)=>parameter(id,label,value,min,max);
const rows=[
 ['down','Lave abaissée','help','lava down {{blocks}} {{viewer}}','bedrock-height-down-ai.png',[p('blocks','Blocs retirés',1,1,10)]],
 ['up','Lave montante','trap','lava up {{blocks}} {{viewer}}','bedrock-height-up-ai.png',[p('blocks','Blocs ajoutés',1,1,10)]],
 ['speed','Vitesse lave','neutral','lava speed {{speed}}','bedrock-timer-ai.png',[p('speed','Vitesse de montée',90,1,200)]],
 ['tp-up','Plateformes gagnées','help','tp up {{levels}} {{viewer}}','bedrock-tp-ai.png',[p('levels','Plateformes',1,1,60)]],
 ['tp-down','Plateformes perdues','trap','tp down {{levels}} {{viewer}}','bedrock-radius-down-ai.png',[p('levels','Plateformes',1,1,60)]],
 ['tp-level','Niveau choisi','neutral','tp {{level}} {{viewer}}','bedrock-radius-up-ai.png',[p('level','Niveau',10,1,60)]],
 ...[['boost','Course rapide','help','bedrock-tnt-rocket-ai.png'],['slow','Course ralentie','trap','bedrock-rock-ai.png'],['jump','Saut renforcé','help','bedrock-tnt-step-ai.png'],['blind','Vision masquée','trap','bedrock-blackhole.webp'],['glow','Aura lumineuse','neutral','bedrock-diamond-ai.png']].map(([id,name,column,image])=>[id,name,column,'@effect '+id+' {{seconds}} {{viewer}}',image,[p('seconds','Durée en secondes',10,1,300)],10]),
 ['levitation','Lévitation','help','effect levitation {{viewer}}','bedrock-comets.webp',[],2],
 ['mega-jump','Super saut','help','jump {{force}} {{seconds}} {{viewer}}','bedrock-super-tnt-ai.png',[p('force','Puissance',5,1,10),p('seconds','Durée en secondes',10,1,120)],10],
 ['freeze','Joueur gelé','trap','freeze {{seconds}} {{viewer}}','bedrock-glass-prison-ai.png',[p('seconds','Durée en secondes',5,1,30)],5],
 ['unfreeze','Gel réduit','help','unfreeze {{seconds}} {{viewer}}','bedrock-clear-ai.png',[p('seconds','Secondes retirées',5,1,60)]],
 ['ghosts','Fantômes hostiles','trap','mobs spawn {{count}} ghost {{viewer}}','bedrock-enderman.webp',[p('count','Créatures',3,1,10)]],
 ['skeletons','Squelettes hostiles','trap','mobs spawn {{count}} skeleton {{viewer}}','bedrock-fake-tnt-ai.png',[p('count','Créatures',3,1,10)]],
 ['mixed','Horde mixte','trap','mobs spawn {{count}} mixed {{viewer}}','bedrock-random-tnt-ai.png',[p('count','Créatures',3,1,10)]],
 ['clear-mobs','Créatures retirées','help','mobs clear {{viewer}}','bedrock-weak-tnt-ai.png'],
 ['ice','Sol glissant','trap','ice {{seconds}} {{viewer}}','bedrock-glass-ai.png',[p('seconds','Durée en secondes',15,5,60)],15],
 ['moving','Plateformes mouvantes','trap','moving {{seconds}} {{viewer}}','bedrock-fill-rows-ai.png',[p('seconds','Durée en secondes',30,10,120)],30],
 ['gear','Équipement offert','help','gear {{seconds}} {{viewer}}','bedrock-wood-ai.png',[p('seconds','Durée en secondes',30,10,300)],30],
 ['gear5','Mode héroïque','help','gear5 {{seconds}} {{viewer}}','bedrock-zeus-tnt.webp',[p('seconds','Durée en secondes',30,10,120)],30],
 ['win-timer','Maintien sommet','neutral','wintimer {{seconds}}','bedrock-top-lock-ai.png',[p('seconds','Secondes au sommet',10,1,120)]]
];
const descriptions={down:'Abaisse la lave.',up:'Fait monter la lave.',speed:'Règle la vitesse de montée de 1 à 200.', 'tp-up':'Téléporte vers les plateformes supérieures.','tp-down':'Téléporte vers les plateformes inférieures.','tp-level':'Téléporte au niveau choisi.',boost:'Accélère le déplacement.',slow:'Ralentit le déplacement.',jump:'Renforce les sauts.',blind:'Masque la vision.',glow:'Fait briller le joueur.',levitation:'Soulève le joueur pendant deux secondes.','mega-jump':'Choisit la puissance et la durée des sauts.',freeze:'Immobilise le joueur ; les appels ajoutent du temps.',unfreeze:'Retire du temps au gel actif.',ghosts:'Ajoute des fantômes hostiles.',skeletons:'Ajoute des squelettes hostiles.',mixed:'Ajoute un mélange de créatures hostiles.','clear-mobs':'Retire les créatures de la tour.',ice:'Rend les plateformes glissantes.',moving:'Fait bouger les plateformes.',gear:'Offre temporairement un équipement puissant, puis rétablit le précédent.',gear5:'Active temporairement le grappin, le poing géant et les capacités héroïques.','win-timer':'Règle le temps à tenir au sommet avant de gagner.'};
const LAVARISE_EFFECTS=rows.map(([id,name,column,command,image,parameters=[],duration=0])=>({id:'lava-'+id,code:'lava-'+id,name,column,category:column==='help'?'Aide':column==='trap'?'Piège':'Contrôle',description:descriptions[id]+' Partie chargée dans la tour, hors menus.',command:command.startsWith('@')?'/shenpulse_lava '+command.slice(1):'/lavarise '+command,commands:[command.startsWith('@')?'/shenpulse_lava '+command.slice(1):'/lavarise '+command],image:'../../resources/game-interactions/minecraft/'+image,parameters,duration,...(duration&&parameters.some(p=>p.id==='seconds')?{durationParameter:'seconds'}:{}),quantity:1,available:true,service:'native',icon:'◆'}));
for(const [id,name,amount,operation,image] of [['add','Wins ajoutées',1,'adjust','add'],['remove','Wins retirées',-1,'adjust','remove'],['random','Wins aléatoires',200,'random','random'],['multiplier','Bonus wins',2,'multiplier','x2']])LAVARISE_EFFECTS.push(winEffect('lava-win-'+id,name,'Modifie le compteur de wins synchronisé avec la partie.','bedrock-win-'+image+'-ai.png',amount,operation));
const LAVARISE_DEFAULT_MAPPINGS=[...[1,3,20,45].flatMap((amount,index)=>[
 {id:'lava-wins-plus-'+index,effectId:'lava-win-add',title:'Wins ajoutées',giftName:['Money Gun','Galaxy','Private Jet','Interstellar'][index],giftId:['7168','11046','5767','6149'][index],giftCost:[500,1000,4888,10000][index],amount},
 {id:'lava-wins-minus-'+index,effectId:'lava-win-remove',title:'Wins retirées',giftName:['Crinière de lion','Gerry la girafe','Leon the Kitten','Voiture de course'][index],giftId:['7985','6842','6646','7063'][index],giftIds:[['12203','12947','11926'],['12726','11476','11491','11879'],[],['7286']][index],giftCost:[500,1000,4888,12000][index],amount:-amount}
]),{id:'lava-wins-multiplier',effectId:'lava-win-multiplier',title:'Bonus wins',giftName:'',enabled:false,triggerEnabled:false,duration:600,amount:2}];
module.exports={LAVARISE_EFFECTS,LAVARISE_DEFAULT_MAPPINGS};
