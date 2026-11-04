"use strict";
// Shared by the inline cards, extra actions, follow/likes and detailed editor.
(function(root){
 const shortcuts=root.ShenPulseCustomShortcuts;
 const escape=value=>String(value??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#39;');
 root.ShenPulseShortcutInput={render(value,attributes='',disabled=''){
  return '<span class="shortcut-input-control"><input type="text" class="game-pack-amount shortcut-key-input" '+attributes+' data-shortcut-input readonly autocomplete="off" spellcheck="false" maxlength="80" aria-label="Touches du clavier" title="Cliquez puis appuyez sur la touche ou la combinaison souhaitée" value="'+escape(shortcuts.format(value))+'" '+disabled+'><button type="button" class="shortcut-text-button" data-shortcut-text '+disabled+' title="Saisir un raccourci ou une séquence au clavier">Saisie texte</button><small class="shortcut-input-hint" aria-live="polite">Cliquez puis appuyez sur votre touche.</small></span>';
 }};
 let recording=null;
 function hint(input,message){const node=input.closest('.shortcut-input-control')?.querySelector('.shortcut-input-hint');if(node)node.textContent=message;}
 function stop(){if(!recording)return;const {input}=recording;input.classList.remove('is-recording');input.value=recording.before;hint(input,'Cliquez puis appuyez sur votre touche.');recording=null;}
 function start(input){
  if(recording?.input===input)return;
  stop();recording={input,before:input.value,held:new Set(),keys:[],error:''};input.readOnly=true;delete input.dataset.shortcutTyping;input.classList.add('is-recording');input.focus();hint(input,'Appuyez puis relâchez votre touche ou combinaison…');
 }
 function consume(event){event.preventDefault();event.stopPropagation();event.stopImmediatePropagation();}
 function commit(){
  const {input,keys,error}=recording;
  if(error){hint(input,error);input.setCustomValidity(error);input.reportValidity();recording.held.clear();recording.keys=[];recording.error='';return;}
  try{
   const value=shortcuts.normalize(keys.join('+'));shortcuts.compile({shortcut:value});
   recording=null;input.value=value;input.classList.remove('is-recording');input.setCustomValidity('');hint(input,'Touche enregistrée : '+value);input.dispatchEvent(new Event('change',{bubbles:true}));
  }catch(error){hint(input,error.message);input.setCustomValidity(error.message);input.reportValidity();recording.held.clear();recording.keys=[];}
 }
 document.addEventListener('click',event=>{
  const textButton=event.target.closest('[data-shortcut-text]');
  if(textButton){const input=textButton.closest('.shortcut-input-control').querySelector('[data-shortcut-input]');stop();input.readOnly=false;input.dataset.shortcutTyping='true';input.setCustomValidity('');input.focus();input.select();hint(input,'Ex. CTRL + E ; ESPACE. Validez avec Entrée ou quittez le champ.');return;}
  const input=event.target.closest('[data-shortcut-input]');if(input&&!input.disabled&&!input.dataset.shortcutTyping)start(input);
 },true);
 document.addEventListener('keydown',event=>{
  if(recording&&!recording.input.isConnected)stop();
  const input=event.target.closest?.('[data-shortcut-input]');
  if(!input||input.disabled)return;
  if(input.dataset.shortcutTyping){
   if(event.key==='Enter'){consume(event);try{shortcuts.compile({shortcut:input.value});input.value=shortcuts.normalize(input.value);input.setCustomValidity('');input.readOnly=true;delete input.dataset.shortcutTyping;input.dispatchEvent(new Event('change',{bubbles:true}));}catch(error){input.setCustomValidity(error.message);input.reportValidity();} }
   return;
  }
  if(!recording&&event.key==='Tab')return;
  if(!recording)start(input);
  if(recording.input!==input)return;
  consume(event);if(event.repeat)return;
  input.setCustomValidity('');
  try{
   const key=shortcuts.keyFromEvent(event);recording.held.add(key);
   const keys=[...(event.ctrlKey?['CTRL']:[]),...(event.shiftKey?['SHIFT']:[]),...(event.altKey?['ALT']:[]),key];
   for(const item of keys)if(!recording.keys.includes(item))recording.keys.push(item);
   hint(input,'Relâchez : '+recording.keys.join(' + '));
  }catch(error){recording.error=error.message;hint(input,error.message);}
 },true);
 document.addEventListener('keyup',event=>{
  if(!recording||event.target!==recording.input)return;
  consume(event);
  try{recording.held.delete(shortcuts.keyFromEvent(event));}catch{/* keydown already explains unsupported keys */}
  if(!recording.held.size)commit();
 },true);
 document.addEventListener('focusout',event=>{
  const input=event.target.closest?.('[data-shortcut-input]');if(!input)return;
  if(recording?.input===input)stop();
  if(input.dataset.shortcutTyping){input.value=shortcuts.format(input.value);input.readOnly=true;delete input.dataset.shortcutTyping;}
 },true);
 document.addEventListener('change',event=>{
  const input=event.target.closest?.('[data-shortcut-input]');if(!input)return;
  input.value=shortcuts.format(input.value);
 },true);
 root.addEventListener('blur',stop);
})(globalThis);
