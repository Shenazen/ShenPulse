"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs/promises"),path=require("node:path"),os=require("node:os"),{createHash}=require("node:crypto");
const {prepareSimsRuntimeProfile,assertSimsRuntimeProfile}=require("../src/main/game-runtime/sims-managed-profile");
async function fixture(t,language="french"){
 const root=await fs.mkdtemp(path.join(os.tmpdir(),"shenpulse-sims-profile-"));t.after(()=>fs.rm(root,{recursive:true,force:true}));
 const targetPath=path.join(root,"steamapps/common/The Sims 4"),documentsPath=path.join(root,"Documents"),localAppDataPath=path.join(root,"AppData/Local"),backupRoot=path.join(root,"backups");await fs.mkdir(targetPath,{recursive:true});await fs.mkdir(documentsPath,{recursive:true});
 await fs.writeFile(path.join(root,"steamapps/appmanifest_1222670.acf"),'"UserConfig" { "language" "'+language+'" }');
 const modulePath=path.join(targetPath,"module.ts4script"),bytes=Buffer.from("verified test module");await fs.writeFile(modulePath,bytes);
 let closed=0;const options={documentsPath,localAppDataPath,backupRoot,modulePath,moduleSha256:createHash("sha256").update(bytes).digest("hex"),assertClosed:async()=>{closed++;}};
 return {root,targetPath,options,closed:()=>closed};
}
test("Sims importe le vrai profil français, garde son original et installe hors Documents",async t=>{
 const f=await fixture(t),source=path.join(f.options.documentsPath,"Electronic Arts/Les\u00a0Sims\u00a04");
 await fs.mkdir(path.join(source,"saves"),{recursive:true});await fs.writeFile(path.join(source,"saves/Slot.save"),"original save");await fs.writeFile(path.join(source,"Options.ini"),"[options]\nfullscreen = 1\nscriptmodsenabled = 0\nmodsdisabled = 1\n");
 const p=await prepareSimsRuntimeProfile(f.targetPath,f.options);assert.equal(await fs.realpath(source),await fs.realpath(p.directory));assert.ok(!p.directory.startsWith(f.options.documentsPath));
 assert.equal(await fs.readFile(path.join(p.directory,"saves/Slot.save"),"utf8"),"original save");assert.match(await fs.readFile(path.join(p.directory,"Options.ini"),"utf8"),/scriptmodsenabled = 1/);
 const marker=JSON.parse(await fs.readFile(path.join(p.directory,".shenpulse-profile.json")));assert.equal(await fs.readFile(path.join(marker.links[source],"saves/Slot.save"),"utf8"),"original save");
 await fs.writeFile(path.join(p.directory,"saves/Slot.save"),"progress after import");await prepareSimsRuntimeProfile(f.targetPath,f.options);assert.equal(await fs.readFile(path.join(p.directory,"saves/Slot.save"),"utf8"),"progress after import");assert.equal(f.closed(),2);await assertSimsRuntimeProfile(f.targetPath,f.options);
});
test("Sims neuf utilise le bon nom français et importe l'ancien dossier anglais sans le retirer",async t=>{
 const f=await fixture(t),legacy=path.join(f.options.documentsPath,"Electronic Arts/The Sims 4");await fs.mkdir(legacy,{recursive:true});await fs.writeFile(path.join(legacy,"Options.ini"),"[options]\nvolume_music = 0.3\n");
 const p=await prepareSimsRuntimeProfile(f.targetPath,f.options);assert.equal(await fs.readFile(path.join(legacy,"Options.ini"),"utf8"),"[options]\nvolume_music = 0.3\n");assert.match(await fs.readFile(path.join(p.directory,"Options.ini"),"utf8"),/volume_music = 0.3/);assert.equal(path.basename(p.sourceDirectory),"Les\u00a0Sims\u00a04");
});
test("Sims refuse un import contenant un lien et conserve toutes les parties",async t=>{
 const f=await fixture(t,"english"),source=path.join(f.options.documentsPath,"Electronic Arts/The Sims 4"),external=path.join(f.root,"external");await fs.mkdir(source,{recursive:true});await fs.mkdir(external);await fs.writeFile(path.join(source,"save"),"safe");await fs.symlink(external,path.join(source,"linked"),"junction");
 await assert.rejects(prepareSimsRuntimeProfile(f.targetPath,f.options),/lien à vérifier/);assert.equal(await fs.readFile(path.join(source,"save"),"utf8"),"safe");assert.equal((await fs.lstat(source)).isSymbolicLink(),false);
});
test("Sims refuse un module altéré avant toute migration",async t=>{
 const f=await fixture(t);await fs.writeFile(f.options.modulePath,"tampered");await assert.rejects(prepareSimsRuntimeProfile(f.targetPath,f.options),/réparé/);assert.equal(f.closed(),0);assert.deepEqual(await fs.readdir(f.options.documentsPath),[]);
});
test("Sims Steam lance l'identifiant compilé et refuse un identifiant fourni par le profil",async()=>{
 const {launchSteamGame}=require("../src/main/game-runtime/steam-launch"),{installerForGame}=require("../src/main/game-installer-manifest");const manifest=installerForGame("the-sims-4"),urls=[];
 await launchSteamGame({gameId:"the-sims-4",manifest,executable:"TS4_x64.exe",shell:{openExternal:async url=>urls.push(url)},assertAccess:()=>{}});assert.deepEqual(urls,["steam://rungameid/1222670"]);
 await assert.rejects(launchSteamGame({gameId:"the-sims-4",manifest:{steamLaunchAppId:"1"},executable:"TS4_x64.exe",shell:{},assertAccess:()=>{}}),/non autorisé/);
});

test("deux préparations Sims simultanées conservent un seul profil et ses sauvegardes",async t=>{
 const f=await fixture(t);const [a,b]=await Promise.all([prepareSimsRuntimeProfile(f.targetPath,f.options),prepareSimsRuntimeProfile(f.targetPath,f.options)]);assert.equal(a.directory,b.directory);await assertSimsRuntimeProfile(f.targetPath,f.options);
});
