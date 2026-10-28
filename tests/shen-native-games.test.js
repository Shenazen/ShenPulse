"use strict";
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os'),crypto=require('node:crypto'),{once}=require('node:events'),{WebSocket}=require('ws');
const {SPECS}=require('../src/main/shen-native-games/specs'),{ShenNativeGameBridge}=require('../src/main/shen-native-games/runtime'),{rewriteLiterals}=require('../scripts/lib/unity-game-metadata');
function fixture(t,id='shenfarm'){
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'shen-native-')),spec=SPECS[id],metadataPath=spec.data+'/il2cpp_data/Metadata/global-metadata.dat';
 fs.mkdirSync(path.dirname(path.join(root,metadataPath)),{recursive:true});const bytes=Buffer.alloc(600);bytes.writeUInt32LE(0xfab11baf);bytes.writeUInt32LE(39,4);bytes.write('0'.repeat(64),400);fs.writeFileSync(path.join(root,metadataPath),bytes);fs.writeFileSync(path.join(root,'shenpulse-game.json'),JSON.stringify({schemaVersion:1,protocol:'shen-native-v1',id,gameId:spec.gameId,executable:spec.executable,metadataPath,keyOffset:400}));
 const secrets=new Map(),state={session:{profileId:'p'},settings:{account:{uid:'owner'}},game:{installations:{[id]:{path:root}},connectorOverrides:{},interactionRulesByPack:{}}};
 const store={getState:()=>state,getSecret:id=>secrets.get(id),setSecret:(id,value)=>{id||=crypto.randomUUID();secrets.set(id,value);return id;},mutate:fn=>fn(state)},bridge=new ShenNativeGameBridge({store,gameId:id,port:0});
 bridge.on('error',()=>{});t.after(async()=>{await bridge.close();fs.rmSync(root,{recursive:true,force:true});});return {root,state,store,bridge,secrets,metadataPath};
}
test('quatre jeux autonomes à 9,99 €, logo ShenPulse, nouvelle disposition et douze cadeaux configurés',()=>{
 const packs=require('../src/main/game-catalog').loadShenazenGameCatalog(path.resolve('resources')),policy=require('../src/shared/game-workspace-policy');
 for(const id of Object.keys(SPECS)){const pack=packs.find(p=>p.id===id);assert.equal(pack.price,9.99);assert.deepEqual(pack.storefronts,['shenpulse']);assert.equal(pack.accessMode,'purchase');assert.equal(policy.eligible(pack,['shenpulse']),true);assert.equal(pack.defaultMappings.filter(m=>m.marketColumn==='help').length,6);assert.equal(pack.defaultMappings.filter(m=>m.marketColumn==='trap').length,6);assert.ok(pack.effects.every(e=>e.available===true));assert.ok(fs.existsSync('src/renderer/assets/games/'+pack.artwork));}
 assert.equal(policy.eligible(packs.find(p=>p.id==='color-strike')),false);
});
test('la réécriture Unity conserve tous les indices et recale les sections après un texte plus long',()=>{
 const values=['SyncLive','Bonjour'],data=Buffer.concat(values.map(s=>Buffer.from(s))),header=Buffer.alloc(44),table=Buffer.alloc(12);header.writeUInt32LE(0xfab11baf);header.writeUInt32LE(39,4);header.writeUInt32LE(44,8);header.writeUInt32LE(12,12);header.writeUInt32LE(3,16);header.writeUInt32LE(56,20);header.writeUInt32LE(data.length,24);header.writeUInt32LE(2,28);header.writeUInt32LE(56+data.length,32);header.writeUInt32LE(4,36);table.writeUInt32LE(8,4);table.writeUInt32LE(data.length,8);
 const original=Buffer.concat([header,table,data,Buffer.from('END\0')]);assert.deepEqual(rewriteLiterals(original,s=>s).buffer,original);
 const next=rewriteLiterals(original,s=>s==='SyncLive'?'ShenPulse':s);assert.equal(next.count,2);assert.equal(next.changed,1);assert.equal(next.buffer.readUInt32LE(60-12),9);assert.equal(next.buffer.readUInt32LE(32),original.readUInt32LE(32)+1);assert.equal(next.buffer.toString('utf8',next.positions[1],next.positions[1]+7),'Bonjour');assert.equal(next.buffer.subarray(-4).toString(),'END\0');
});
test('la clé privée reste dans le coffre local ; la licence signée porte le jeu et une durée courte',async t=>{
 const f=fixture(t);await f.bridge.start();const c=f.bridge.credentials,issued=require('../src/main/shen-native-games/licence').issueLicence(c.privateKey,SPECS.shenfarm.gameId,1000000),[body,signature]=issued.split('.');
 assert.deepEqual(JSON.parse(Buffer.from(body,'base64url')),{game:'shenfarm',iat:1000,exp:1120});assert.equal(crypto.verify(null,Buffer.from(body,'base64url'),crypto.createPublicKey(c.privateKey),Buffer.from(signature,'base64url')),true);
 assert.ok(f.state.game.connectorOverrides.shenfarm.localGamePrivateKeySecretId);assert.ok(!JSON.stringify(f.state).includes('BEGIN PRIVATE KEY'));assert.match(fs.readFileSync(path.join(f.root,f.metadataPath)).toString('ascii',400,464),/^[a-f0-9]{64}$/);
});
test('le serveur refuse un navigateur et un faux jeton ; seul le bonjour natif authentifié confirme la connexion',async t=>{
 const f=fixture(t);await f.bridge.start();const url='ws://127.0.0.1:'+f.bridge.port;
 const browser=new WebSocket(url,{origin:'https://example.test'});browser.on('error',()=>{});const response=await new Promise(resolve=>browser.once('unexpected-response',(_req,res)=>{res.resume();resolve(res.statusCode);}));assert.equal(response,403);
 const bad=new WebSocket(url);await once(bad,'open');const badClosed=once(bad,'close');bad.send(JSON.stringify({type:'bonjour',jeton:'faux'}));assert.equal((await badClosed)[0],1008);assert.equal(f.bridge.status().connected,false);
 const client=new WebSocket(url);t.after(()=>client.terminate());await once(client,'open');const message=once(client,'message');client.send(JSON.stringify({type:'bonjour',jeton:f.bridge.credentials.token}));assert.equal(JSON.parse(String((await message)[0])).type,'ok');assert.equal(f.bridge.status().connected,true);
 fs.writeFileSync(f.bridge.credentials.log,'[ShenFarm] connecté au live ShenPulse (licence valide)\n');assert.equal(f.bridge.status().connected,true);
 const action=once(client,'message');await f.bridge.send('pluie',{viewer:'Viewer "test"',viewerId:'user-id',quantity:3,avatarUrl:'https://cdn.example/avatar.png'});const delivered=JSON.parse(String((await action)[0]));assert.equal(delivered.texte,'pluie');assert.equal(delivered.pseudo,'Viewer "test"');assert.equal(delivered.combo,3);assert.equal(delivered.avatar,'https://cdn.example/avatar.png');
});
test('reprendre la même installation conserve sa clé ; changer de profil révoque immédiatement la session',async t=>{
 const f=fixture(t);await f.bridge.start();const key=fs.readFileSync(path.join(f.root,f.metadataPath)).toString('ascii',400,464),token=f.bridge.credentials.token;await f.bridge.close();await f.bridge.start();assert.equal(f.bridge.credentials.token,token);assert.equal(fs.readFileSync(path.join(f.root,f.metadataPath)).toString('ascii',400,464),key);
 const client=new WebSocket('ws://127.0.0.1:'+f.bridge.port);t.after(()=>client.terminate());await once(client,'open');const connected=once(client,'message');client.send(JSON.stringify({type:'bonjour',jeton:token}));await connected;fs.writeFileSync(f.bridge.credentials.log,'connecté au live ShenPulse (licence valide)');assert.equal(f.bridge.status().connected,true);
 f.state.session.profileId='other';assert.equal(f.bridge.status().connected,false);
});
test('le catalogue natif utilise les cadeaux choisis sans doubler les événements gratuits',()=>{
 const {nativeCatalogue}=require('../src/main/shen-native-games/catalogue'),pack={id:'shenfarm',effects:[{id:'rain',code:'pluie',name:'Pluie'}]},state={game:{interactionRulesByPack:{shenfarm:[{enabled:true,trigger:{type:'gift',enabled:true},conditions:[{field:'data.giftName',value:'Rose',giftImageUrl:'https://cdn.example/rose.png',giftCost:1}],actions:[{type:'game.effect',config:{packId:'shenfarm',effectId:'rain'}}]}]}}};
 const catalogue=nativeCatalogue(pack,state);assert.equal(catalogue.actions[0].cadeau,'Rose');assert.equal(catalogue.entrees[0].action,'pluie');assert.equal(catalogue.interactions.actionFollow,'');assert.equal(catalogue.interactions.likesPourPluie,0);
});

test('la désinstallation ne retire que la copie gérée, conserve les sauvegardes et permet une restauration',async t=>{
 const f=fixture(t),managed=path.join(f.root,'games','shenfarm');fs.mkdirSync(path.dirname(managed),{recursive:true});const original=path.join(f.root,'external');fs.mkdirSync(original);fs.writeFileSync(original+'/keep.txt','original');f.state.game.installations.shenfarm.path=original;
 const runtime={store:f.store,app:{getPath:()=>f.root},activeInstalls:new Set(),assertAccess(){}},remove=require('../src/main/shen-native-games/uninstall').uninstallNativeGame;
 await assert.rejects(remove(runtime,'shenfarm'),/pas gérée/);assert.equal(fs.readFileSync(original+'/keep.txt','utf8'),'original');
 fs.mkdirSync(managed);fs.writeFileSync(managed+'/shenpulse-game.json',JSON.stringify({id:'shenfarm',protocol:'shen-native-v1'}));fs.writeFileSync(managed+'/game.exe','qa');fs.writeFileSync(f.root+'/save.json','save');f.state.game.installations.shenfarm.path=managed;
 await assert.rejects(remove(runtime,'shenfarm',{assertClosed:async()=>{throw Error('Jeu ouvert');}}),/Jeu ouvert/);assert.ok(fs.existsSync(managed+'/game.exe'));
 const result=await remove(runtime,'shenfarm',{assertClosed:async()=>{}});assert.equal(result.managedGameRemoved,true);assert.equal(fs.existsSync(managed),false);assert.equal(fs.readFileSync(result.backupPath+'/game.exe','utf8'),'qa');assert.equal(fs.readFileSync(f.root+'/save.json','utf8'),'save');assert.equal(runtime.activeInstalls.size,0);
});

test('un changement de compte après déplacement restaure atomiquement le jeu géré',async t=>{
 const f=fixture(t),managed=path.join(f.root,'games','shenfarm');fs.mkdirSync(managed,{recursive:true});fs.writeFileSync(managed+'/shenpulse-game.json',JSON.stringify({id:'shenfarm',protocol:'shen-native-v1'}));f.state.game.installations.shenfarm.path=managed;
 const runtime={store:f.store,app:{getPath:()=>f.root},activeInstalls:new Set()},remove=require('../src/main/shen-native-games/uninstall').uninstallNativeGame;
 await assert.rejects(remove(runtime,'shenfarm',{assertClosed:async()=>{},assertAccess(){if(!fs.existsSync(managed))throw Error('Profil modifié');}}),/Profil modifié/);assert.ok(fs.existsSync(managed+'/shenpulse-game.json'));
});

test('la préparation refuse une copie native déjà ouverte, même si son exécutable porte un suffixe .exe',async()=>{
 const guard=require('../src/main/game-runtime/mod-installation-ready').assertModGameClosed;
 for(const id of Object.keys(SPECS)){await assert.rejects(guard(id,path.resolve('.'),{platform:'win32',execute:async(_cmd,args)=>{const source=args.at(-1),encoded=source.match(/FromBase64String\('([^']+)'\)/)[1],config=JSON.parse(Buffer.from(encoded,'base64'));assert.ok(config.names.includes(SPECS[id].executable.replace(/[.]exe$/i,'')));return '1234';}}),/Fermez/);}
});

test('le véritable GameHub transmet les cadeaux et quantités au pont natif et refuse les anciens détournements de connecteur',async t=>{
 const {GameHub}=require('../src/main/game-hub'),{bridgeFor}=require('../src/main/shen-native-games/runtime');
 for(const id of Object.keys(SPECS)){const f=fixture(t,id),pack=require('../src/main/game-catalog').loadShenazenGameCatalog(path.resolve('resources')).find(p=>p.id===id);
 f.state.settings.account={uid:'test',email:'test@example.test',refreshTokenSecretId:'auth'};f.secrets.set('auth','test-token');f.state.commerce={subscription:{tier:'pro',status:'active',source:'paid'},gameEntitlements:[id]};f.state.game.connectorOverrides[id]={type:'http',url:'https://example.invalid'};
 const hub=new GameHub({store:f.store,resourcesDirectory:path.resolve('resources')}),bridge=bridgeFor(f.store,id);bridge.port=0;hub.packs=[pack];t.after(()=>bridge.close());
 const prepared=await hub.prepareConnection(id);assert.equal(prepared.type,'shen-native');assert.equal(prepared.connected,false);
 const client=new WebSocket('ws://127.0.0.1:'+bridge.port);t.after(()=>client.terminate());await once(client,'open');const ok=once(client,'message');client.send(JSON.stringify({type:'bonjour',jeton:bridge.credentials.token}));assert.equal(JSON.parse(String((await ok)[0])).type,'ok');
 assert.equal((await hub.waitForConnection(id)).connected,true);
 const delivered=new Promise(resolve=>client.on('message',data=>{const m=JSON.parse(String(data));if(m.type==='action')resolve(m);}));
 await hub.trigger(pack.effects[0].id,{source:'gift',user:{id:'viewer-1',displayName:'Viewer gift',avatarUrl:'https://example.test/avatar.png'}},{packId:id,parameters:{count:4}});
 const message=await delivered;assert.equal(message.pseudo,'Viewer gift');assert.equal(message.combo,4);assert.equal(message.texte,pack.effects[0].code);assert.equal(message.avatar,'https://example.test/avatar.png');
 f.state.commerce.gameEntitlements=[];await assert.rejects(hub.trigger(pack.effects[0].id,{}, {packId:id}),/achat|essai/);await bridge.close();
 }
});
