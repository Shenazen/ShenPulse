"use strict";
/** Display-only policy. It never changes a rule or an installation. */
(function(root,factory){const policy=factory(typeof module!=='undefined'&&module.exports?require('./game-categories'):root.ShenPulseGameCategories);if(typeof module!=='undefined'&&module.exports)module.exports=policy;else root.ShenPulseGameWorkspacePolicy=policy;})(globalThis,categories=>{
 const WITHOUT_OVERLAY_SECTION=new Set(['demonologist','escape-from-duckov','euro-truck-simulator-2','find-the-needle-demo','fortnite','pokemon-red-blue','resident-evil-3','rocket-league','super-mario-kart']);
 const ROUND_TIMER_GAMES=new Set(['minecraft-bedrock-box','minecraft-sandbox-3','gtav-koth-enhanced','gtav-hiking-enhanced']);
 function hasRoundTimer(pack){return ROUND_TIMER_GAMES.has(pack?.id);}
 function hasIntegratedWinModels(pack){return ['gtav-montchiliad','gtav-koth-enhanced','minecraft-lavarise','minecraft-diamond-rush','minecraft-box-cyber'].includes(pack?.id)||hasRoundTimer(pack);}
 function showOverlaySection(pack){return !WITHOUT_OVERLAY_SECTION.has(pack?.id);}
 function eligible(pack,platforms=pack?.storefronts||[]){return !!pack?.id&&(pack.workspaceLayout==='shared'||!categories.categoriesFor(pack).includes('shenpulse')&&!platforms.includes('shenpulse'));}
 function column(row){
  const saved=row.rule?.gameInteraction?.marketColumn;if(['help','neutral','trap'].includes(saved))return saved;
  const effect=row.effect||{};if(['help','neutral','trap'].includes(effect.column))return effect.column;
  const art=String(effect.originalImage||effect.image||'');
  if(/[-_]assist[.]/i.test(art))return 'help';if(/[-_]chaos[.]/i.test(art))return 'trap';if(/[-_]utility[.]/i.test(art))return 'neutral';
  const code=String(effect.code||effect.id).toLowerCase();
  if(/remove|take|lose|kill|damage|hurt|steal|bankrupt|chaos|freeze|blind|invert|poison|explod|tnt|retir|voler|mort|perdre|coupure|immobil/.test(code))return 'trap';
  if(/heal|healthup|addmoney|give|grant|restore|invinc|shield|refill|fill|bonus|jackpot|repair|soin|donner|remplir|ajout|reset.*effect/.test(code))return 'help';return 'neutral';
 }
 function artworkPack(pack){
  const counts=new Map();for(const effect of pack.effects||[])counts.set(effect.image,(counts.get(effect.image)||0)+1);
  return {...pack,effects:(pack.effects||[]).map(effect=>effect.image&&counts.get(effect.image)===1&&!/crowdcontrol|synclive/i.test(effect.image)?effect:{...effect,originalImage:effect.image,image:illustration(pack,effect)})};
 }
 function illustration(pack,effect){
  const escape=value=>String(value||'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
  let hash=0;for(const c of pack.id+'/'+effect.id)hash=(Math.imul(hash,31)+c.charCodeAt(0))>>>0;
  const hue=hash%360,other=(hue+40)%360,text=String(effect.name||effect.id),words=text.split(/\s+/),lines=[];let line='';for(const word of words){if(line.length+word.length>24){lines.push(line);line='';}line+=(line?' ':'')+word;}if(line)lines.push(line);
  const label=(effect.code||'')+' '+text;
  const icon=/money|argent|prix|cash|jackpot/i.test(label)?'$':/heal|sant|soin|vie|heart/i.test(label)?'♥':/time|temps|speed|vitesse/i.test(label)?'◷':/client|customer|joueur|player/i.test(label)?'♟':/camera|view|fov/i.test(label)?'◉':/minecraft|block|cube|rayon|shelf|box|carton/i.test(pack.id+' '+label)?'▦':effect.icon||'✦';
  return 'data:image/svg+xml,'+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="320" height="240" viewBox="0 0 320 240" data-effect="'+escape(effect.id)+'"><defs><linearGradient id="b" x2="1" y2="1"><stop stop-color="hsl('+hue+',55%,22%)"/><stop offset="1" stop-color="hsl('+other+',65%,9%)"/></linearGradient></defs><rect width="320" height="240" rx="22" fill="url(#b)"/><path d="M0 180 320 30M0 220 320 70" stroke="white" opacity=".06" stroke-width="20"/><circle cx="160" cy="88" r="53" fill="none" stroke="hsl('+hue+',90%,70%)" stroke-width="3"/><text x="160" y="112" text-anchor="middle" font-size="70" font-family="Arial,sans-serif" fill="hsl('+hue+',90%,80%)">'+escape(icon)+'</text>'+lines.slice(0,3).map((line,i)=>'<text x="160" y="'+(163+i*22)+'" text-anchor="middle" font-size="17" font-weight="700" font-family="Arial,sans-serif" fill="white">'+escape(line)+'</text>').join('')+'<text x="160" y="229" text-anchor="middle" font-size="9" font-family="Arial,sans-serif" fill="#b5b8d1">'+escape(pack.name).slice(0,65)+'</text></svg>');
 }
 return {eligible,column,artworkPack,showOverlaySection,hasRoundTimer,hasIntegratedWinModels};
});
