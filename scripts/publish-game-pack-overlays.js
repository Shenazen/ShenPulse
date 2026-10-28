
const fs=require('fs'),path=require('path'),crypto=require('crypto'),zlib=require('zlib');
const winsOnly=process.argv.includes('--wins-only');
const assetsGame=process.argv.find(value=>value.startsWith('--assets-game='))?.slice(14)||'';
if(assetsGame&&!/^[a-z0-9][a-z0-9-]{1,100}$/.test(assetsGame))throw Error('Invalid artwork game ID');
if(assetsGame&&winsOnly)throw Error('Choose artwork or wins-only publication');
const site='shenpulse-overlays',root='https://firebasehosting.googleapis.com/v1beta1/',files=['/game-pack.html','/runtime/game-pack.js','/runtime/game-pack-models.js','/game-wins.html','/styles/game-wins.css','/runtime/game-wins.js','/fonts/game-wins-orbitron.ttf','/fonts/LICENSE-Orbitron.txt'];
async function main(){
 fs.mkdirSync('.artifacts/game-wins-complete-20261026',{recursive:true});
 const selectedFiles=assetsGame?[]:winsOnly?files.filter(name=>['/game-wins.html','/styles/game-wins.css','/runtime/game-wins.js'].includes(name)):files;
 const sources=new Map(selectedFiles.map(name=>[name,path.join('resources/overlays',name.slice(1))]));
 if(!winsOnly)for(const [name,file] of require('../src/shared/game-pack-overlay').publicGamePackAssets())if(!assetsGame||name.startsWith('/media/game-art/'+assetsGame+'/'))sources.set(name,file);
 if(!sources.size)throw Error('No matching artwork assets');
 const changedFiles=[...sources.keys()];
 const auth=require(path.join(process.env.APPDATA,'npm/node_modules/firebase-tools/lib/auth.js')),account=auth.getProjectDefaultAccount(process.cwd());if(!account?.tokens?.refresh_token)throw Error('Firebase CLI credentials unavailable');
 const access=await auth.getAccessToken(account.tokens.refresh_token,['https://www.googleapis.com/auth/cloud-platform']);if(!access.access_token)throw Error('Firebase access unavailable');
 const headers={Authorization:'Bearer '+access.access_token};
 async function api(resource,method='GET',body){const response=await fetch(root+resource,{method,headers:{...headers,'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});const result=await response.json();if(!response.ok)throw Error('Hosting '+response.status+': '+(result.error?.message || 'Request failed'));return result;}
 const channel=await api('projects/-/sites/'+site+'/channels/live'),source=channel.release?.version?.name;if(!source)throw Error('No live version found');
 const old=await api(source),map={};let page='';do{const listing=await api(source+'/files?pageSize=1000'+(page?'&pageToken='+encodeURIComponent(page):''));for(const file of listing.files || [])map[file.path]=file.hash;page=listing.nextPageToken || '';}while(page);
 const uploads=new Map();for(const [name,file] of sources){const compressed=zlib.gzipSync(fs.readFileSync(file),{level:9}),hash=crypto.createHash('sha256').update(compressed).digest('hex');map[name]=hash;uploads.set(hash,compressed);}
 if(!process.argv.includes('--publish')){console.log(JSON.stringify({site,sourceVersion:source,preservedFileCount:Object.keys(map).length-changedFiles.length,updatedFiles:selectedFiles,publicArtworkFiles:changedFiles.length-selectedFiles.length}));return;}
 const version=await api('projects/-/sites/'+site+'/versions','POST',{config:old.config || {}});fs.writeFileSync('.artifacts/game-wins-complete-20261026/hosting-version.json',JSON.stringify({source,version:version.name},null,2));
 const entries=Object.entries(map);for(let offset=0;offset<entries.length;offset+=1000){const needed=await api(version.name+':populateFiles','POST',{files:Object.fromEntries(entries.slice(offset,offset+1000))});const hashes=needed.uploadRequiredHashes||[];for(let start=0;start<hashes.length;start+=8)await Promise.all(hashes.slice(start,start+8).map(async hash=>{const bytes=uploads.get(hash);if(!bytes)throw Error('Unexpected missing previously published asset');const response=await fetch(needed.uploadUrl+'/'+hash,{method:'POST',headers:{...headers,'Content-Type':'application/octet-stream'},body:bytes});if(!response.ok)throw Error('Hosting upload '+response.status);}));}
 await api(version.name+'?updateMask=status','PATCH',{status:'FINALIZED'});
 const latest=await api('projects/-/sites/'+site+'/channels/live');if(latest.release?.version?.name!==source)throw Error('The public version changed during preparation; release cancelled');
 const release=await api('projects/-/sites/'+site+'/channels/live/releases?versionName='+encodeURIComponent(version.name),'POST',{message:assetsGame?'Game artwork: '+assetsGame:winsOnly?'Game wins: integrated and illustrated models':'Game packs: separate wins HUD and shared presets'});
 const checked=[];for(const name of [...selectedFiles,...changedFiles.filter(name=>name.startsWith("/media/game-art/")).filter((_name,index)=>index%100===0)]){const response=await fetch('https://'+site+'.web.app'+name+'?verify='+Date.now(),{cache:'no-store'});const bytes=Buffer.from(await response.arrayBuffer());if(!response.ok || !bytes.equals(fs.readFileSync(sources.get(name))))throw Error('Public content verification failed: '+name);checked.push(name);}
 fs.writeFileSync('.artifacts/game-wins-complete-20261026/hosting-release.json',JSON.stringify({version:version.name,release:release.name,verified:checked},null,2));console.log(JSON.stringify({site,publishedVersion:version.name,verifiedFiles:checked,preservedFileCount:entries.length-changedFiles.length}));
}
main().catch(error=>{console.error(error.message);process.exitCode=1;});
