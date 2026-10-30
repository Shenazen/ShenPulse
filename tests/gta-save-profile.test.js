"use strict";
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path'),os=require('node:os');
const {deployGtaEnhancedSave,prepareGtaEnhancedSaveForLaunch}=require('../src/main/game-runtime/gta-save');

async function fixture(t){
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'shenpulse-gta-profile-'));
 const previous=process.env.SHENPULSE_GTAV_PROFILE_TEST_PATH;
 const profiles=path.join(root,'Profiles'),old=path.join(profiles,'OLD'),active=path.join(profiles,'EPIC');
 await fs.mkdir(old,{recursive:true});await fs.mkdir(active);
 for(let slot=1;slot<=15;slot++)await fs.writeFile(path.join(old,`SGTA5${String(slot).padStart(4,'0')}`),'ancien-'+slot);
 for(const [directory,time] of [[old,1000],[active,2000]])for(const name of ['cfg.dat','pc_settings.bin']){const file=path.join(directory,name);await fs.writeFile(file,'configuration');await fs.utimes(file,time,time);}
 process.env.SHENPULSE_GTAV_PROFILE_TEST_PATH=profiles;
 t.after(async()=>{if(previous===undefined)delete process.env.SHENPULSE_GTAV_PROFILE_TEST_PATH;else process.env.SHENPULSE_GTAV_PROFILE_TEST_PATH=previous;await fs.rm(root,{recursive:true,force:true});});
 const source=path.join(root,'game-assets','gtav-koth-enhanced','enhanced-save');await fs.mkdir(source,{recursive:true});
 const content=Buffer.alloc(600*1024,0x5a);await fs.writeFile(path.join(source,'SGTA50015'),content);await fs.writeFile(path.join(source,'SGTA50015.bak'),content);
 return {root,old,active,source,content};
}

test('le profil Epic actif vide passe avant quinze anciennes sauvegardes, sans toucher aux anciens profils',async t=>{
 const f=await fixture(t),result=await prepareGtaEnhancedSaveForLaunch({gameId:'gtav-koth-enhanced',userDataPath:f.root});
 assert.equal(result.profile,f.active);assert.equal(result.slot,15);assert.equal(result.deployed,true);
 assert.deepEqual(await fs.readFile(result.savePath),f.content);
 for(let slot=1;slot<=15;slot++)assert.equal(await fs.readFile(path.join(f.old,`SGTA5${String(slot).padStart(4,'0')}`),'utf8'),'ancien-'+slot);
 await fs.writeFile(path.join(f.active,'SGTA50001'),'progression personnelle');
 const hiking=path.join(f.root,'game-assets','gtav-hiking-enhanced','enhanced-save');await fs.cp(f.source,hiking,{recursive:true});
 const second=await prepareGtaEnhancedSaveForLaunch({gameId:'gtav-hiking-enhanced',userDataPath:f.root});
 assert.equal(second.alreadyPresent,true);assert.equal(second.deployed,false);
 assert.equal(await fs.readFile(path.join(f.active,'SGTA50001'),'utf8'),'progression personnelle');
 assert.equal((await fs.readdir(f.active)).filter(n=>n.startsWith('SGTA')).length,3);
});

test('une sauvegarde absente bloque le lancement, un premier profil encore absent peut être préparé ensuite',async t=>{
 const f=await fixture(t);
 await assert.rejects(prepareGtaEnhancedSaveForLaunch({gameId:'gtav-hiking-enhanced',userDataPath:f.root}),/Réinstallez les interactions/);
 await fs.rm(f.active,{recursive:true});await fs.rm(f.old,{recursive:true});
 const pending=await prepareGtaEnhancedSaveForLaunch({gameId:'gtav-koth-enhanced',userDataPath:f.root});
 assert.equal(pending.pending,true);assert.equal(pending.reason,'rockstar-profile-not-found');
});

test('un changement de compte avant la copie empêche de modifier le profil GTA',async t=>{
 const f=await fixture(t);let checks=0;
 await assert.rejects(deployGtaEnhancedSave({sourceDirectory:f.source,backupRoot:path.join(f.root,'backup'),assertAccess(){if(++checks>=2)throw Error('Compte changé');}}),/Compte changé/);
 assert.deepEqual((await fs.readdir(f.active)).sort(),['cfg.dat','pc_settings.bin']);
});
