"use strict";
// The same parser validates saved cards and compiles the exact events sent to Windows.
(function(root,factory){const api=factory();if(typeof module!=="undefined"&&module.exports)module.exports=api;else root.ShenPulseCustomShortcuts=api;})(globalThis,()=>{
 const KEYS={space:32,espace:32,enter:13,entree:13,entrée:13,tab:9,escape:27,esc:27,echap:27,échap:27,backspace:8,retour:8,delete:46,del:46,suppr:46,insert:45,ins:45,home:36,end:35,fin:35,pageup:33,pagedown:34,up:38,haut:38,down:40,bas:40,left:37,gauche:37,right:39,droite:39,ctrl:162,control:162,shift:160,maj:160,alt:164,capslock:20,numlock:144,scrolllock:145,pause:19,printscreen:44};
 const LABELS={32:'ESPACE',13:'ENTRÉE',9:'TAB',27:'ESC',8:'BACKSPACE',46:'SUPPR',45:'INS',36:'HOME',35:'FIN',33:'PAGEUP',34:'PAGEDOWN',38:'HAUT',40:'BAS',37:'GAUCHE',39:'DROITE',162:'CTRL',160:'SHIFT',164:'ALT',20:'CAPSLOCK',144:'NUMLOCK',145:'SCROLLLOCK',19:'PAUSE',44:'PRINTSCREEN'};
 function keyCode(name){if(KEYS[name])return KEYS[name];if(/^[a-z0-9]$/.test(name))return name.toUpperCase().charCodeAt(0);if(/^f(?:[1-9]|1[0-9]|2[0-4])$/.test(name))return 111+Number(name.slice(1));if(/^num[0-9]$/.test(name))return 96+Number(name.slice(3));throw Error('Touche inconnue « '+name+' ». Exemple : espace, z ou ctrl+e.');}
 function keyLabel(code){return LABELS[code]||(code>=112&&code<=135?'F'+(code-111):code>=96&&code<=105?'NUM'+(code-96):String.fromCharCode(code));}
 function normalize(shortcut){
  const text=String(shortcut??'').trim().toLowerCase();
  if(!text||text.length>80)throw Error('Renseignez un raccourci clavier (80 caractères maximum).');
  return text.split(';').map(chord=>chord.trim().split('+').map(key=>keyLabel(keyCode(key.trim()))).join(' + ')).join(' ; ');
 }
 function format(shortcut){try{return normalize(shortcut);}catch{return String(shortcut??'');}}
 function keyFromEvent(event){
  if(event.isComposing||event.key==='Dead'||event.key==='Process')throw Error('Cette touche de composition ne peut pas être enregistrée seule.');
  if(/^Numpad[0-9]$/.test(event.code||''))return 'NUM'+event.code.slice(-1);
  // On AZERTY, &/1 has key="&" and code="Digit1". Record its real number-row key.
  if(/^Digit[0-9]$/.test(event.code||''))return event.code.slice(-1);
  const names={Escape:'ESC',Control:'CTRL',Shift:'SHIFT',Alt:'ALT',Enter:'ENTRÉE',Tab:'TAB',' ':'ESPACE',Spacebar:'ESPACE',ArrowUp:'HAUT',ArrowDown:'BAS',ArrowLeft:'GAUCHE',ArrowRight:'DROITE',Backspace:'BACKSPACE',Delete:'SUPPR',Insert:'INS',Home:'HOME',End:'FIN',PageUp:'PAGEUP',PageDown:'PAGEDOWN',CapsLock:'CAPSLOCK',NumLock:'NUMLOCK',ScrollLock:'SCROLLLOCK',Pause:'PAUSE',PrintScreen:'PRINTSCREEN'};
  return normalize(names[event.key]||event.key);
 }
 function compile(parameters={}){
  const text=String(parameters.shortcut??'').trim().toLowerCase();
  if(!text||text.length>80)throw Error('Renseignez un raccourci clavier (80 caractères maximum).');
  const chords=text.split(';').map(chord=>chord.trim().split('+').map(key=>key.trim()));
  if(chords.length>8)throw Error('Une séquence accepte au maximum 8 raccourcis séparés par ;.');
  const numeric=(key,fallback,min,max)=>{const raw=parameters[key]??fallback;if(String(raw).trim()===''||!Number.isFinite(Number(raw))||Number(raw)<min||Number(raw)>max)throw Error('Valeur invalide pour '+key+'.');return Number(raw);};
  const hold=Math.round(numeric('holdMs',100,40,10000)),repeat=numeric('repeat',1,1,10),gap=Math.round(numeric('gapMs',150,0,5000));
  if(!Number.isInteger(repeat))throw Error('Le nombre de répétitions doit être entier.');
  const codes=chords.map(keys=>{if(keys.length>4||keys.some(key=>!key))throw Error('Combinaison invalide : 4 touches maximum.');const codes=keys.map(keyCode);if(new Set(codes).size!==codes.length)throw Error('Une touche est présente deux fois.');if(codes.includes(164)&&codes.includes(115)||codes.includes(162)&&codes.includes(164)&&codes.includes(46)||codes.includes(164)&&codes.includes(9))throw Error('Ce raccourci Windows ne peut pas être utilisé pour une interaction.');return codes;});
  const events=[];for(let n=0;n<repeat;n++)for(const chord of codes){for(const [i,key]of chord.entries())events.push('k,'+(i===0&&events.length?gap:0)+','+key+',0');for(const [i,key]of [...chord].reverse().entries())events.push('k,'+(i===0?hold:0)+','+key+',1');}
  const duration=repeat*codes.length*hold+(repeat*codes.length-1)*gap;
  if(events.length>120||duration>30000)throw Error('Cette séquence est trop longue : 30 secondes et 120 événements maximum.');
  return events.join(';');
 }
 function assertRule(pack,rule){for(const action of rule.actions||[]){if(action.type!=='game.effect')continue;const effect=pack.effects.find(effect=>effect.id===action.config?.effectId);if(!effect)throw Error('Action personnalisée introuvable.');if(effect.customShortcut)compile({...Object.fromEntries(effect.parameters.map(p=>[p.id,p.defaultValue])),...action.config?.parameters});}}
 return {compile,assertRule,normalize,format,keyFromEvent};
});
