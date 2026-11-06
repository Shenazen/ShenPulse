const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path"),vm=require("node:vm"),{JSDOM}=require("jsdom");
const template={id:"pack",revision:1,title:"Pack <20>",minimumCreators:20,maximumCreators:null,prices:{pro:850,premium:1200},status:"enabled",belowMinimum:"block",additions:"prorata",removals:"renewal"};
function fixture(t){
 const dom=new JSDOM('<main></main><section id="editor"></section>',{runScripts:"outside-only"});t.after(()=>dom.window.close());
 const w=dom.window,calls=[];let uid="admin",editor;
 const data={packsAvailable:true,packBillingAvailable:false,agencyPacks:[structuredClone(template)],agencyPackAssignments:[],allAgencies:[{id:"a",name:"Agence <Alpha>",status:"approved"},{id:"b",name:"Agence Beta",status:"pending"}],members:Array.from({length:22},(_,i)=>({uid:"c"+i,agencyId:"a",status:"approved",displayName:"Créateur "+i,email:"c"+i+"@example.invalid"}))};
 data.members.push({uid:"pending",agencyId:"a",status:"pending"},{uid:"foreign",agencyId:"b",status:"approved"});
 w.escapeHtml=s=>String(s??"").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll('"',"&quot;");
 w.creatorPrivateOperationUid=()=>uid;w.creatorPrivateOperationGeneration=1;w.isAccountAuthenticated=()=>!!uid;w.isVerifiedAdminSession=()=>uid==="admin";
 w.captureCreatorPrivateOperation=()=>({uid});w.assertCreatorPrivateOperation=o=>assert.equal(o.uid,uid);
 w.render=()=>{};w.confirmAction=async()=>true;
 w.requireAccountForAction=()=>false;w.canAccessFeature=()=>true;w.handleDashboardChartClick=()=>false;
 w.content=w.document.querySelector("main");w.dialog=w.document.querySelector("#editor");w.dialogBody=w.dialog;w.accountMenu=w.document.createElement("aside");w.accountMenuButton=w.document.createElement("button");
 w.api={agencies:{list:async()=>({agencies:[]}),dashboard:async()=>({uid,members:[]})},admin:{agenciesDashboard:async()=>structuredClone(data),agenciesCommand:async(c,b)=>{calls.push([c,b]);return {ok:true,quote:{ready:true,effectiveMonthlyCents:17000,negotiatedMonthlyCents:17000,proCreators:20,premiumCreators:0,eligibleCreators:20,reasons:[]},proration:{adjustmentCents:850,nextMonthlyCents:17000}};}}};
 w.openEditor=o=>{editor=o;w.document.getElementById("editor").innerHTML='<form>'+o.body+'</form>';};
 const sources=["actions/handlers/contracts.js","features/agencies.js","features/agency-packs.js","features/agency-pack-editors.js","actions/dispatcher.js","core/events/content.js"].map(p=>fs.readFileSync(path.join(__dirname,"../src/renderer/app",p),"utf8")).join("\n");
 vm.runInContext('let currentPage="admin";const STUDIO_PREFERENCE_ACTIONS=new Set();'+sources,dom.getInternalVMContext());
 return {w,data,calls,get editor(){return editor;},setUid(value){uid=value;},form(){return w.document.querySelector("#editor form");},formData(){return new w.FormData(this.form());}};
}
test("la rubrique est réservée au propriétaire, avec distinction préparation/facturation",async t=>{
 const f=fixture(t);await f.w.refreshAgencies(true);
 const html=f.w.renderAdminAgencyPacks();assert.match(html,/Packs personnalisés/);assert.match(html,/aucun prélèvement/);assert.match(html,/8,50/);assert.match(html,/Pack &lt;20>/);assert.doesNotMatch(html,/Pack <20>/);
 f.setUid("director");assert.equal(f.w.renderAdminAgencyPacks(),"");
 await assert.rejects(f.w.handleAgencyPackAction({action:"agency-pack-new"}),/administrateur/);
});
test("création : valeurs modifiables, deux tarifs et centimes exacts",async t=>{
 const f=fixture(t);await f.w.refreshAgencies(true);f.w.openAgencyPackEditor();
 const form=f.form();assert.equal(form.elements.minimumCreators.value,"20");assert.equal(form.elements.proPrice.value,"8.50");assert.equal(form.elements.offerPro.checked,true);assert.equal(form.elements.offerPremium.checked,false);
 form.elements.title.value="20+ créas";form.elements.offerPremium.checked=true;form.elements.premiumPrice.value="11,75";form.elements.proPrice.value="8,50";form.elements.removals.value="credit";
 await f.editor.onSubmit(f.formData());
 const [command,body]=f.calls.at(-1);assert.equal(command,"savePack");assert.equal(body.prices.pro,850);assert.equal(body.prices.premium,1175);assert.equal(body.minimumCreators,20);assert.equal(body.status,"draft");assert.equal(body.removals,"credit");
});
test("les montants mal formés ne partent pas au serveur et la saisie est conservée",async t=>{
 const f=fixture(t);await f.w.refreshAgencies(true);f.w.openAgencyPackEditor();f.form().elements.title.value="Pack sauvegardé";f.form().elements.proPrice.value="8,505";
 await assert.rejects(f.editor.onSubmit(f.formData()),/décimales/);assert.equal(f.calls.length,0);assert.equal(f.form().elements.title.value,"Pack sauvegardé");
});
test("attribution : uniquement agences et membres validés, sélection multiple et formules propres",async t=>{
 const f=fixture(t);await f.w.refreshAgencies(true);f.w.openAgencyPackAssignment(template);
 const form=f.form();assert.equal(form.elements.agencyId.value,"a");
 assert.equal(form.querySelectorAll('input[name="seat"]').length,22);assert.doesNotMatch(form.textContent,/pending@example|foreign@example/);
 const all=form.querySelector("[data-pack-select-all]");all.checked=true;all.dispatchEvent(new f.w.Event("change",{bubbles:true}));
 assert.equal(form.querySelectorAll('input[name="seat"]:checked').length,22);assert.match(form.querySelector("[data-pack-selection-count]").textContent,/22/);
 form.elements.namedItem("seatTier:c0").value="premium";
 await f.editor.onSubmit(f.formData());
 assert.equal(f.calls.at(-1)[0],"assignPack");assert.equal(f.calls.at(-1)[1].seats.length,22);assert.equal(f.calls.at(-1)[1].seats[0].tier,"premium");assert.equal(f.calls.at(-1)[1].expectedPackRevision,1);
});
test("la simulation fonctionne sans sauvegarder et les changements effacent le résultat",async t=>{
 const f=fixture(t);await f.w.refreshAgencies(true);f.w.openAgencyPackAssignment(template);
 const form=f.form(),all=form.querySelector("[data-pack-select-all]");all.checked=true;all.dispatchEvent(new f.w.Event("change",{bubbles:true}));
 await f.w.previewAgencyPackAssignment(form.querySelector('[data-action="agency-pack-preview"]'));
 assert.equal(f.calls[0][0],"previewPack");assert.match(form.querySelector("[data-pack-summary]").textContent,/170,00/);assert.equal(f.calls.some(c=>c[0]==="assignPack"),false);
 const first=form.querySelector('input[name="seat"]');first.checked=false;first.dispatchEvent(new f.w.Event("change",{bubbles:true}));assert.equal(form.querySelector("[data-pack-summary]").textContent,"");
});
test("une simulation lente ne remplace pas les nouveaux réglages ni un autre compte",async t=>{
 const f=fixture(t);await f.w.refreshAgencies(true);f.w.openAgencyPackAssignment(template);
 let finish;f.w.api.admin.agenciesCommand=()=>new Promise(r=>finish=r);
 const form=f.form(),request=f.w.previewAgencyPackAssignment(form.querySelector('[data-action="agency-pack-preview"]'));
 form.elements.periodEnd.value="2026-12-25";form.elements.periodEnd.dispatchEvent(new f.w.Event("input",{bubbles:true}));
 finish({ok:true,quote:{ready:true,reasons:[],effectiveMonthlyCents:1}});
 await request;assert.equal(form.querySelector("[data-pack-summary]").innerHTML,"");
 const pending=f.w.previewAgencyPackAssignment(form.querySelector('[data-action="agency-pack-preview"]'));
 f.setUid("other");finish({ok:true,quote:{ready:true,reasons:[],effectiveMonthlyCents:1}});await assert.rejects(pending);assert.equal(form.querySelector("[data-pack-summary]").innerHTML,"");
});
test("dupliquer et archiver utilisent la bonne révision ; annuler ne déclenche aucune commande",async t=>{
 const f=fixture(t);await f.w.refreshAgencies(true);
 await f.w.handleAgencyPackAction({action:"agency-pack-duplicate",id:"pack"});
 assert.equal(f.form().elements.status.value,"draft");assert.match(f.form().elements.title.value,/copie/);
 f.form().elements.title.value="Copie";await f.editor.onSubmit(f.formData());assert.equal(f.calls.at(-1)[1].id,"");assert.equal(f.calls.at(-1)[1].expectedRevision,0);
 f.w.confirmAction=async()=>false;const previous=f.calls.length;await f.w.handleAgencyPackAction({action:"agency-pack-archive",id:"pack"});assert.equal(f.calls.length,previous);
 f.w.confirmAction=async()=>true;await f.w.handleAgencyPackAction({action:"agency-pack-archive",id:"pack"});assert.equal(f.calls.at(-1)[0],"archivePack");assert.equal(f.calls.at(-1)[1].expectedRevision,1);
});

test("le vrai clic Créer un pack traverse le routeur et ouvre un seul formulaire",async t=>{
 const f=fixture(t);await f.w.refreshAgencies(true);
 f.w.content.innerHTML=f.w.renderAdminAgencyPacks();
 const button=f.w.content.querySelector('[data-action="agency-pack-new"]');
 assert.equal(button.disabled,false);button.click();await new Promise(r=>setImmediate(r));
 assert.ok(f.editor,"Le routeur doit atteindre l’éditeur des packs après le gestionnaire général des agences");
 assert.equal(f.form().elements.minimumCreators.value,"20");
 f.form().elements.title.value="Pack depuis le clic";await f.editor.onSubmit(f.formData());
 assert.equal(f.calls.filter(([c])=>c==="savePack").length,1);
});
test("le vrai clic de simulation dans la popup ne sauvegarde pas l’attribution",async t=>{
 const f=fixture(t);await f.w.refreshAgencies(true);f.w.openAgencyPackAssignment(template);
 const form=f.form();form.querySelector('[data-pack-select-all]').click();
 form.querySelector('[data-action="agency-pack-preview"]').click();await new Promise(r=>setImmediate(r));
 assert.equal(f.calls.filter(([c])=>c==="previewPack").length,1);
 assert.match(form.querySelector('[data-pack-summary]').textContent,/170,00/);
 assert.equal(f.calls.filter(([c])=>c==="assignPack").length,0);
});

test("modifier, dupliquer et attribuer passent aussi par les clics de la page",async t=>{
 for(const action of ["edit","duplicate","assign"]){
  const f=fixture(t);await f.w.refreshAgencies(true);f.w.content.innerHTML=f.w.renderAdminAgencyPacks();
  f.w.content.querySelector('[data-action="agency-pack-'+action+'"]').click();await new Promise(r=>setImmediate(r));
  assert.ok(f.editor,action);
  if(action==="edit")assert.equal(f.form().elements.title.value,template.title);
  if(action==="duplicate")assert.match(f.form().elements.title.value,/copie/);
  if(action==="assign")assert.equal(f.form().elements.agencyId.value,"a");
  assert.equal(f.calls.length,0,"Ouvrir le formulaire ne doit rien enregistrer");
 }
});
test("les clics d’archivage et de retrait atteignent seulement leur commande prévue",async t=>{
 for(const [action,command]of [["archive","archivePack"],["unassign","unassignPack"]]){
  const f=fixture(t);f.data.agencyPackAssignments=[{agencyId:"a",packId:"pack",revision:3,seats:[]}];
  await f.w.refreshAgencies(true);f.w.content.innerHTML=f.w.renderAdminAgencyPacks();
  f.w.content.querySelector('[data-action="agency-pack-'+action+'"]').click();await new Promise(r=>setImmediate(r));
  assert.equal(f.calls.length,1);assert.equal(f.calls[0][0],command);
  assert.equal(f.calls[0][1].expectedRevision,action==="archive"?1:3);
 }
});
