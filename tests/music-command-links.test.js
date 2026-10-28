"use strict";
const test=require('node:test'),assert=require('node:assert/strict');
const {StateStore}=require('../src/main/store');
const {SongRequestsService}=require('../src/main/spotify/song-requests');
const {ChatbotService}=require('../src/main/chatbot-service');
const {normalizeProfileWorkspace}=require('../src/main/state/profile-workspace');
const {songRequestCommandKey}=require('../src/main/spotify/music-command-links');

function fixture(tier='free'){
 const store=new StateStore('unused-music-test',{isEncryptionAvailable:()=>false});
 store.touch=()=>{};const state=store.state;
 state.activeAccountUid='music-owner';state.settings.account={uid:'music-owner',email:'music@example.invalid',refreshTokenSecretId:'test'};
 store.secrets.test={value:Buffer.from('fake-token').toString('base64')};
 state.commerce.subscription={tier,source:'own',status:tier==='free'?'free':'active'};
 state.session.running=true;
 state.settings.tiktok.status='live';state.connections=[{id:'source_tiktok',type:'tiktok-direct',enabled:true,status:'connected'}];
 let now=10000;const calls=[];
 const spotify={resolveTrack:async()=>({uri:'spotify:track:1234567890123456789012',name:'Titre',artists:[],durationMs:1000}),control:async p=>{calls.push(p);return {playback:{item:{name:'Titre',artists:[]}}};}};
 const service=new SongRequestsService({store,spotify,now:()=>now});
 const chatbot=new ChatbotService({store,sourceHub:{runtimes:new Map()},functionalOnly:true,commandExecutor:{execute:async()=>{throw Error('Double déclenchement');}}});
 const chat=(message,user={})=>({type:'chat',source:'source_tiktok',user:{id:'viewer',...user},data:{message}});
 return{store,state,service,chatbot,calls,chat,tick:()=>now+=11000};
}

test('Musique active quatre commandes persistantes et gratuites, sans double exécution dans Commandes',async()=>{
 const f=fixture();f.service.configure({enabled:true,allowViewerSkip:true});
 assert.equal(f.state.commands.length,4);
 for(const [message,kind]of [['!sr titre','request'],['!np','nowPlaying'],['!queue','queue'],['!skip','skip']]){
  const event=f.chat(message);
  assert.equal(f.chatbot.hasFunctionalCommand(event),false);
  assert.equal(f.chatbot.handleChat(event),null);
  const result=await f.service.handleChat(event);assert.equal(result.ok,true);assert.equal(result.command,kind);
 }
 assert.equal(f.calls.length,2); // lecture courante et une seule lecture de la demande lors du skip
});

test('renommer, restreindre, désactiver et supprimer depuis Commandes modifie les mêmes réglages musicaux',async()=>{
 const f=fixture('pro');f.service.configure({enabled:true});
 let row=f.state.commands.find(r=>songRequestCommandKey(r)==='request');
 f.store.upsert('commands',{...row,command:'!chanson',aliases:['!titre'],audience:'subscriber',cooldownMs:10000});
 assert.equal(f.state.settings.spotify.songRequests.commands.request,'!chanson');
 assert.equal((await f.service.handleChat(f.chat('!sr titre'))).handled,false);
 assert.equal((await f.service.handleChat(f.chat('!titre titre'))).ok,false);
 assert.equal((await f.service.handleChat(f.chat('!titre titre',{subscriber:true}))).ok,true);
 row=f.state.commands.find(r=>r.id===row.id);
 f.store.upsert('commands',{...row,enabled:false});
 assert.equal(f.state.settings.spotify.songRequests.commandEnabled.request,false);
 assert.equal((await f.service.handleChat(f.chat('!titre autre',{subscriber:true}))).handled,false);
 f.store.remove('commands',row.id);
 assert.equal(f.state.settings.spotify.songRequests.commandEnabled.request,false);
});

test('modifier Musique conserve les commandes Pro, refuse les collisions et ne crée aucun doublon',()=>{
 const f=fixture('pro');const custom={id:'custom',kind:'command',command:'!autre',enabled:true,execution:{type:'music',operation:'pause'}};
 f.store.upsert('commands',custom);
 f.service.configure({enabled:true});f.service.configure({commands:{request:'!song'},commandEnabled:{queue:false}});
 assert.equal(f.state.commands.filter(r=>songRequestCommandKey(r)).length,4);
 assert.equal(f.state.commands.find(r=>songRequestCommandKey(r)==='request').command,'!song');
 assert.equal(f.state.commands.find(r=>songRequestCommandKey(r)==='queue').enabled,false);
 assert.deepEqual(f.state.commands.find(r=>r.id==='custom'),custom);
 const before=JSON.stringify(f.state.settings.spotify.songRequests);
 assert.throws(()=>f.service.configure({commands:{request:'!autre'}}),/existe déjà/);
 assert.equal(JSON.stringify(f.state.settings.spotify.songRequests),before);
});

test('changer l’effet gratuit en action Pro ne réactive pas l’ancienne commande musicale au rechargement',()=>{
 const f=fixture('pro');f.service.configure({enabled:true});
 const row=f.state.commands.find(r=>songRequestCommandKey(r)==='request');
 f.store.upsert('commands',{...row,execution:{type:'action',actionId:'pro-action'}});
 const settings=f.state.settings.spotify.songRequests;
 assert.equal(settings.commandEnabled.request,false);
 const restored=normalizeProfileWorkspace({commands:f.state.commands,songRequestSettings:settings});
 assert.equal(restored.commands.find(r=>r.id===row.id).execution.type,'action');
 assert.equal(restored.commands.filter(r=>songRequestCommandKey(r)==='request').length,0);
 const empty=normalizeProfileWorkspace({songRequestSettings:{enabled:false}});
 assert.equal(empty.commands.length,0);
});

test('une recherche démarrée dans un profil ne dépose rien dans le profil suivant',async()=>{
 const f=fixture();f.service.configure({enabled:true});
 let release;f.service.spotify.resolveTrack=()=>new Promise(r=>release=r);
 const pending=f.service.add({query:'essai'});await new Promise(r=>setImmediate(r));
 f.state.session.profileId='new-profile';release({uri:'spotify:track:1234567890123456789012',name:'Titre',artists:[],durationMs:1000});
 await assert.rejects(pending,/profil/);assert.equal(f.service.status().queue.length,0);
});

test('une ancienne commande !skip personnalisée ne bloque pas la sauvegarde des paramètres musicaux',async()=>{
 const f=fixture('pro'),custom={id:'old-skip',kind:'command',command:'!skip',enabled:true,execution:{type:'music',operation:'next'}};
 f.store.upsert('commands',custom);
 f.service.configure({enabled:true,maxQueue:17});f.service.configure({maxPerViewer:2});
 assert.deepEqual(f.state.commands.find(r=>r.id==='old-skip').execution,custom.execution);
 assert.equal(f.state.commands.find(r=>r.id==='old-skip').songRequestKey,'skip');
 assert.equal(f.state.settings.spotify.songRequests.maxQueue,17);
 assert.equal(f.state.commands.filter(r=>r.command==='!skip').length,1);
 f.state.commerce.subscription={tier:'free',status:'free'};
 const r=await f.service.handleChat(f.chat('!skip',{moderator:true}));
 assert.equal(r.ok,true);assert.equal(f.calls.length,1);
});

test('la désactivation depuis Musique atteint aussi le raccourci Spotify déjà existant dans Commandes',async()=>{
 const f=fixture('pro'),custom={id:'old-skip',kind:'command',command:'!skip',enabled:true,aliases:['!suivant'],audience:'moderator',cooldownMs:12000,execution:{type:'music',operation:'next'}};
 f.store.upsert('commands',custom);f.service.configure({enabled:true});
 f.service.configure({commandEnabled:{skip:false}});
 const row=f.state.commands.find(r=>r.id==='old-skip');
 assert.equal(row.enabled,false);
 assert.deepEqual(row.execution,custom.execution);
 assert.deepEqual(row.aliases,custom.aliases);
 assert.equal(row.cooldownMs,12000);
 assert.equal(f.state.commands.filter(r=>r.command==='!skip').length,1);
 f.service.configure({commandEnabled:{skip:true},commands:{skip:'!suivantitre'}});
 assert.equal(f.state.commands.find(r=>r.id==='old-skip').enabled,true);
 assert.equal(f.state.commands.find(r=>r.id==='old-skip').command,'!suivantitre');
 f.store.upsert('commands',{...f.state.commands.find(r=>r.id==='old-skip'),command:'!avance',enabled:false});
 assert.equal(f.state.settings.spotify.songRequests.commands.skip,'!avance');
 assert.equal(f.state.settings.spotify.songRequests.commandEnabled.skip,false);
});

test('la coupure générale dans Musique désactive les raccourcis liés sans altérer les commandes sans rapport',()=>{
 const f=fixture('pro');
 f.store.upsert('commands',{id:'skip',kind:'command',command:'!skip',enabled:true,execution:{type:'music',operation:'next'}});
 f.store.upsert('commands',{id:'pause',kind:'command',command:'!pause',enabled:true,execution:{type:'music',operation:'pause'}});
 f.service.configure({enabled:true});f.service.configure({enabled:false});
 assert.equal(f.state.commands.find(r=>r.id==='skip').enabled,false);
 assert.equal(f.state.commands.find(r=>r.id==='pause').enabled,true);
});
