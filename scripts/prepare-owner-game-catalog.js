
"use strict";
/** Builds private preparation records from the captured, public effect definitions. */
const fs=require("node:fs"),path=require("node:path"),{createHash}=require("node:crypto");
const root=path.resolve(__dirname,".."),capture=path.join(root,".artifacts/integration-wave-20261029");
const requested=require("./integration-preparation/requested-games.json").games;
const prepared=require("../resources/catalogs/owner-prepared-modules.json");
const {ownerGameListed}=require("../src/shared/owner-game-catalog-policy");
const {compactEffectName}=require("../src/main/game-catalog/presentation");
const titles=require("../src/shared/game-interaction-titles");
const clean=s=>String(s||"").replace(/Crowd\s*Control|SyncLive|Stream\s*To\s*Earn|StreamToEarn|WarpWorld|S2E/gi,"ShenPulse").replace(/<[^>]*>/g,"").trim();
const labels={Health:"Santé",Money:"Argent",Time:"Temps",Camera:"Caméra",Player:"Joueur",Movement:"Déplacement",Items:"Objets",Misc:"Divers",Enemies:"Ennemis",Weapons:"Armes",Stats:"Attributs",Aiming:"Visée",Fighters:"Combattants"};
const names={"Spawn Trash":"Déchets ajoutés","Spawn New Customer":"Client offert","Spawn Employee":"Employé offert","Turn Lights On":"Lumières allumées","Jail Player":"Joueur emprisonné","Random Aim":"Visée aléatoire","Heal Player":"Joueur soigné","Kill Player":"Mort immédiate","Give Money":"Argent offert","Take Money":"Argent volé","Bake Cookies":"Cookies offerts","Eat Cookies":"Cookies mangés","Golden Cookie":"Cookie doré","Buy Most Expensive Building":"Bâtiment acheté","Sell Most Expensive Building":"Bâtiment vendu"};
function nameFor(value){let text=clean(value);if(names[text])return names[text];text=text.replace(/^Give /i,"Donner ").replace(/^Take /i,"Retirer ").replace(/^Spawn /i,"Apparition ").replace(/^Heal /i,"Soin ").replace(/^Damage /i,"Dégâts ").replace(/^Kill /i,"Éliminer ").replace(/^Increase /i,"Augmenter ").replace(/^Decrease /i,"Réduire ").replace(/^Remove /i,"Retirer ").replace(/^Add /i,"Ajouter ").replace(/^Set /i,"Régler ");text=text.replace(/\b(?:a|an|the|some)\s+/gi,"");return titles.capitalize(compactEffectName({name:text}));}
function side(code,e){const morality=Number(e.alignment?.morality||0);if(morality)return morality>0?"help":"trap";if(/heal|give|addmoney|restore|repair|invinc|buff_frenzy|golden_cookie/i.test(code))return"help";if(/take|remove|kill|damage|blind|randomaim|clot|curse|invert|poison|freeze/i.test(code))return"trap";return"neutral";}
function parametersFor(e){let rows=[];for(const [id,v] of Object.entries(e.parameters||{})){if(v.type==="options")rows.push({id,label:clean(v.name||id),type:"select",defaultValue:Object.keys(v.options||{})[0]||"",options:Object.entries(v.options||{}).map(([value,o])=>({value,label:clean(o.name||value)}))});else if(v.type==="number")rows.push({id,label:clean(v.name||id),type:"number",min:v.min??0,max:v.max??100000,defaultValue:v.default??v.min??0,step:1});}if(e.quantity)rows.push({id:"quantity",label:"Quantité",type:"number",defaultValue:e.quantity.min||1,min:e.quantity.min||1,max:e.quantity.max||1000,step:1});const duration=Number(e.duration?.value||0);if(duration>0)rows.push({id:"durationSeconds",label:"Durée (secondes)",type:"number",defaultValue:duration,min:1,max:Math.max(600,duration),step:1});return rows;}
const overrides=require("../resources/catalogs/owner-effect-overrides.json");
const scriptEffects=require("../resources/catalogs/owner-script-effects.json");
const records=[];
for(const g of requested){let upstream=null;const file=path.join(capture,"upstream",g.upstream,"pack.json");if(fs.existsSync(file))upstream=JSON.parse(fs.readFileSync(file));const ready=prepared[g.id];let effects=[];let parameterOrderByCode={};
 if(upstream){for(const [code,e] of Object.entries(upstream.effects.game||upstream.effects.input||{})){if(!e.name||e.external||e.hidden||e.admin)continue;if(Object.keys(e.parameters||{}).length)parameterOrderByCode[code]=Object.keys(e.parameters);const name=nameFor(typeof e.name==="string"?e.name:e.name.public||e.name.en||code),parameters=parametersFor(e);let id=g.id+"-"+code.toLowerCase().replace(/[^a-z0-9-]/g,"-");if(effects.some(x=>x.id===id))id+="-"+createHash("sha256").update(code).digest("hex").slice(0,8);const available=Boolean(ready)&&!e.disabled&&!e.inactive;effects.push({id,code,name,description:clean(e.description)||name,category:labels[e.category?.[0]]||clean(e.category?.[0])||"Interactions",column:side(code,e),available,...(!available?{unavailableReason:ready?"Cet effet est désactivé dans la version du module récupérée.":"Module autonome en cours de préparation. Les essais en jeu n’ont pas encore été effectués."}:{}),service:"native",duration:Number(e.duration?.value||0),...(e.quantity?{quantityParameter:"quantity"}:{}),...(e.duration?.value?{durationParameter:"durationSeconds"}:{}),...(parameters.length?{parameters}:{}),sortOrder:effects.length});}}
 if(scriptEffects[g.id])parameterOrderByCode={};
 if(scriptEffects[g.id])effects=scriptEffects[g.id].map(e=>({...e,available:Boolean(ready)&&e.available!==false,...(!ready?{unavailableReason:"Module autonome en préparation."}:{})}));
 effects=effects.map(effect=>({...effect,...overrides[g.id]?.[effect.code]}));
 const sourceGame=upstream?.game;let artwork="";for(const ext of ["jpg","png","webp"])if(fs.existsSync(path.join(root,"src/renderer/assets/games/catalog/owner",g.id+"."+ext)))artwork="catalog/owner/"+g.id+"."+ext;
 records.push({id:g.id,name:g.name,platforms:g.platforms,categories:[g.category],artwork,ownerOnly:true,parameterOrderByCode,stage:ready?"prepared":"pending",inGameValidation:"pending",...(g.preparationBlocker?{preparationBlocker:g.preparationBlocker}:{}),...(g.compatibilityNote?{compatibilityNote:g.compatibilityNote}:{}),...(g.deferGameInstallation?{deferGameInstallation:true}:{}),...(upstream?{installer:{steamAppIds:upstream.meta.steam?.id?[String(upstream.meta.steam.id)]:[],directoryNames:[sourceGame?.name,upstream.meta.name].filter(Boolean),executables:upstream.meta.executable?[upstream.meta.executable.replace(/\\/g,"/")]:[]},...((sourceGame?.gameID||g.upstream)?{coverSourceId:sourceGame?.gameID||g.upstream}:{})}:{}),effects});
}
fs.writeFileSync(path.join(root,"resources/catalogs/owner-game-preparation.json"),JSON.stringify({schemaVersion:1,preparedAt:"2026-10-30",inGameTestsAuthorized:false,games:records},null,2)+"\n");console.log(records.length+" fiches privées préparées ; "+records.reduce((n,g)=>n+g.effects.length,0)+" effets documentés.");

// Keep the renderer's offline installation affordance aligned with the generated private manifests.
const bootstrapPath=path.join(root,"src/renderer/app/core/bootstrap.js");
let bootstrap=fs.readFileSync(bootstrapPath,"utf8");
const begin="  // Prepared private integrations.",end="  // End prepared private integrations.";
const block=begin+"\n"+records.filter(record=>ownerGameListed(record)&&prepared[record.id]).map(record=>record.id).sort().map(id=>"  "+JSON.stringify(id)+",").join("\n")+"\n"+end;
const start=bootstrap.indexOf(begin),finish=bootstrap.includes(end)?bootstrap.indexOf(end,start)+end.length:bootstrap.indexOf("\n\n",start);
if(start<0||finish<start)throw Error("Zone des installateurs privés introuvable.");
bootstrap=bootstrap.slice(0,start)+block+bootstrap.slice(finish);fs.writeFileSync(bootstrapPath,bootstrap);
