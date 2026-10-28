"use strict";
// Short labels retain the distinguishing subject, direction, resource or side.
function semanticName(effect){
 const name=String(effect.name||'').trim(),code=String(effect.code||''),words=name.split(/\s+/),stop=['de','du','des','la','le','les','un','une','à','au','aux','en','dans','pour','avec','pendant','et'];
 const compact=value=>value.trim().split(/\s+/).filter(w=>!stop.includes(w.toLowerCase())).slice(0,2).join(' ');
 const exact={lengthup:'Tour ajouté',lengthdown:'Tour retiré',dv_perfect:'DV parfaits',dv_terrible:'DV désastreux',kill_all_zombies:'Zombies éliminés',kill_all_animals:'Animaux éliminés',steer_left:'Virage gauche',steer_right:'Virage droite',teleleft:'Salle gauche',teleright:'Salle droite',ark_strafe_left:'Gauche forcée',ark_strafe_right:'Droite forcée',ark_inventory:'Inventaire',ark_map:'Carte',rl_rl_camera_spam:'Caméra agitée',exfastplayer:'Canard supersonique',exslowplayer:'Canard ralenti',uslowmove:'Déplacements ralentis',ufastmove:'Déplacements accélérés',efull:'Ennemis restaurés',spawn_em0100:'Zombie féminine',spawn_em3300:'Hunter Beta',spawn_em3400:'Hunter Gamma',evolve:'Pokémon évolué'};
 if(exact[code])return exact[code];
 if(code==='blackout'&&/équipe/i.test(name))return 'Équipe K.O.';
 if(code==='faint'&&/Pokémon/i.test(name))return 'Pokémon K.O.';
 const reference=code.match(/-cc-(assist|chaos|control|progression|sabotage|utility)$/);if(reference)return {assist:'Aide',chaos:'Chaos',control:'Contrôle',progression:'Progression',sabotage:'Sabotage',utility:'Utilitaire'}[reference[1]];
 if(/^(?:Soin des tours|Roue native|Poussée|Choisir le camp|Squelettes|Chevalier|Barbare|Géant|Dragon)/i.test(name)){
  const side=name.match(/(?:·\s*|camp\s+)(Rouge|Bleu|Hommes|Femmes)$/i);
  if(side)return (/^Soin/.test(name)?'Soin':/^Roue/.test(name)?'Roue':/^Choisir/.test(name)?'Camp':words[0])+' '+side[1].toLowerCase();
 }
 if(/^bombe/i.test(code)){const medium=/moyenne/.test(code),small=/petite/.test(code),large=/grosse/.test(code),color=/bleue/.test(code)?'Bleue':'Rouge';if(medium||small||large)return color+' '+(medium?'moyenne':small?'mini':'géante');}
 const sand=code.match(/\/sandbox (sandrow|fillrow|setdefaultsand|sand) ([a-z_]+)/);if(sand){const colors={white:'blanc',orange:'orange',magenta:'magenta',light_blue:'azur',yellow:'jaune',lime:'citron',pink:'rose',gray_gravel:'gravier',light_gray:'perle',cyan:'cyan',purple:'violet',blue:'bleu',brown:'brun',green:'vert',red:'rouge',red_sand:'ocre',black:'noir',gray:'gris'};return {sandrow:'Rangée',fillrow:'Ligne',setdefaultsand:'Initial',sand:'Sable'}[sand[1]]+' '+(colors[sand[2]]||sand[2]);}
 const player=name.match(/joueur ([12])/i),item=name.match(/:\s*(.+)$/);
 if(player&&item&&/^(?:char|item|useitem)/.test(code)){const subject=item[1].replace('Donkey Kong','Donkey').replace('Carapace verte','Verte').replace('Carapace rouge','Rouge').replace('Aucun objet','Aucun');return compact(subject)+' J'+player[1];}
 if(player&&/^lapdown/.test(code))return 'Tour− J'+player[1];
 if(player&&/^coinup/.test(code))return 'Pièce+ J'+player[1];
 if(player&&/^coindown/.test(code))return 'Pièce− J'+player[1];
 if(player&&/^(reverse|auto|side|spinout|spin)/.test(code))return (/^reverse/.test(code)?'Inversion':/^auto/.test(code)?'Autopilote':/^side/.test(code)?'Inclinaison':/^spinout/.test(code)?'Tête-à-queue':'Rotation')+' J'+player[1];
 const buff=name.match(/^(Soigner|Infliger)\s*:\s*(.+)$/i);if(buff)return compact(buff[2])+' '+(buff[1].toLowerCase()==='soigner'?'soignée':'infligée');
 const resource=name.match(/^(Donner|Retirer|Ajouter|Enlever)\s+([-+]?\d+)\s+(.+)$/i);
 if(resource){const body=resource[3].replace(/^(?:des |de |du |la |le |les )/i,'');if(body.split(/\s+/).length<=2)return body.split(/\s+/)[0]+' '+(/donner|ajouter/i.test(resource[1])?'+':'−')+resource[2];}
 const enemy=name.match(/^Faire apparaître un ennemi (?:au|à la|à l[’'])\s*(.+)$/i);if(enemy)return 'Ennemi '+enemy[1].replace('fusil à pompe','pompe').trim().split(/\s+/).at(-1);
 const spawn=name.match(/^(?:Faire apparaître|Apparition)\s*:\s*(.+)$/i);if(spawn)return compact(spawn[1].replace(/\s*\([^)]*\)/g,''));
 const stat=name.match(/^(Augmenter|Réduire)\s*:\s*(\S+)\s+(?:to\s+)?([-+]?\d+)$/i);if(stat)return stat[2]+' '+(stat[1]==='Augmenter'?'+':'=')+stat[3];
 const color=name.match(/^(Prochaine pièce|Relancer les plans\s*:\s*couleur|Relancer les plans|Prochain plan)\s+(.+)$/i);if(color)return (/Prochaine/.test(color[1])?'Pièce':'Plans')+' '+color[2].split(/\s+/).at(-1);
 if(/^removeequippedweapon/.test(code))return 'Arme retirée';
 if(/^removeequippedpowerarmor/.test(code))return 'Armure retirée';
 if(/^playercamerafirstperson/.test(code))return 'Vue subjective';
 if(/^playercamerathirdperson/.test(code))return 'Vue extérieure';
 if(/^setgamehour_/.test(code))return {7:'Matin',12:'Après-midi',19:'Soir',0:'Minuit'}[code.split('_')[1]];
 const limb=name.match(/^Cripple (Left|Right) (Arm|Leg)$/i);if(limb)return (limb[2]==='Arm'?'Bras':'Jambe')+' '+(limb[1]==='Left'?'gauche':'droite');
 return '';
}
module.exports={semanticName};
