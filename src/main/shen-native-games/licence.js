"use strict";
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {SPECS}=require('./specs');
function scopeKey(store){const s=store.getState();return JSON.stringify([s.settings.account?.uid||'',s.session.profileId]);}
async function localCredentials(store,id,directory){
 const scope=scopeKey(store),assertScope=()=>{if(scopeKey(store)!==scope)throw Error('Le compte ou le profil a changé.');};
 const spec=SPECS[id];if(!spec)throw Error('Jeu ShenPulse inconnu.');
 const root=await fs.promises.realpath(directory),d=JSON.parse(await fs.promises.readFile(path.join(root,'shenpulse-game.json'),'utf8'));
 const expected=spec.data+'/il2cpp_data/Metadata/global-metadata.dat';
 if(d.schemaVersion!==1||d.protocol!=='shen-native-v1'||d.id!==id||d.gameId!==spec.gameId||d.executable!==spec.executable||d.metadataPath!==expected||!Number.isSafeInteger(d.keyOffset))throw Error('Ce pack ShenPulse est invalide. Réinstallez-le.');
 const file=await fs.promises.realpath(path.join(root,expected));if(!file.startsWith(root+path.sep))throw Error('Le pack sort de son dossier autorisé.');
 assertScope();
 const config=store.getState().game.connectorOverrides?.[id]||{};
 let pem=config.localGamePrivateKeySecretId?store.getSecret(config.localGamePrivateKeySecretId):'',token=config.localGameTokenSecretId?store.getSecret(config.localGameTokenSecretId):'';
 if(!pem){const pair=crypto.generateKeyPairSync('ed25519');pem=pair.privateKey.export({type:'pkcs8',format:'pem'}).toString();}
 if(!token)token=crypto.randomBytes(32).toString('hex');
 const privateKey=crypto.createPrivateKey(pem),publicHex=crypto.createPublicKey(privateKey).export({type:'spki',format:'der'}).subarray(-32).toString('hex');
 const bytes=await fs.promises.readFile(file);if(bytes.readUInt32LE(0)!==0xfab11baf||![38,39].includes(bytes.readUInt32LE(4))||d.keyOffset<380||d.keyOffset+64>bytes.length||!/^[a-f0-9]{64}$/i.test(bytes.toString('ascii',d.keyOffset,d.keyOffset+64)))throw Error('La clé locale du jeu est invalide. Réinstallez-le.');
 if(bytes.toString('ascii',d.keyOffset,d.keyOffset+64)!==publicHex){bytes.write(publicHex,d.keyOffset,64,'ascii');try{await fs.promises.writeFile(file,bytes);}catch{throw Error('Fermez ce jeu avant de préparer sa connexion ShenPulse, puis relancez-le.');}}
 assertScope();
 const keyId=store.setSecret(config.localGamePrivateKeySecretId||'',pem),tokenId=store.setSecret(config.localGameTokenSecretId||'',token);
 store.mutate(s=>{s.game.connectorOverrides[id]={...s.game.connectorOverrides[id],localGamePrivateKeySecretId:keyId,localGameTokenSecretId:tokenId};},true);
 return {privateKey,token,root,descriptor:d,log:path.join(root,'shenpulse-runtime.log')};
}
function issueLicence(key,gameId,now=Date.now()){
 const iat=Math.floor(now/1000),payload=Buffer.from(JSON.stringify({game:gameId,iat,exp:iat+120}));
 return payload.toString('base64url')+'.'+crypto.sign(null,payload,key).toString('base64url');
}
function validToken(actual,expected){if(typeof actual!=='string'||typeof expected!=='string')return false;const a=Buffer.from(actual),b=Buffer.from(expected);return a.length===b.length&&crypto.timingSafeEqual(a,b);}
module.exports={localCredentials,issueLicence,validToken,scopeKey};
