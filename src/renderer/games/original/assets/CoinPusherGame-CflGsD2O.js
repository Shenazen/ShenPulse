import{n as Sf,a as Sc,c as ho,d as $u,b as lr,w as cr,T as _a,o as bt,e as Nt,f as me,t as nt,g as ti,F as nl,r as il,h as mr,i as ni,j as Jt,C as Mf,k as ft,l as yf,m as bf,p as lh,q as ch,s as hh,u as Ef,v as Tf,x as Af,y as wf,z as Cf,A as uh,B as dh,D as mn,E as dt,G as Rf,H as Pf,I as gn,J as If,K as Lf}from"./index-V2bcWW4c.js";import{_ as Zu}from"./_plugin-vue_export-helper-DlAUqK2U.js";import{S as uo,P as Df,R as fh,V as Nf,a as Uf}from"./volume-x-B1JWtGfJ.js";import{c as Ju}from"./createLucideIcon-DlBcuTWW.js";/**
 * @license lucide-vue-next v0.468.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const ph=Ju("CrownIcon",[["path",{d:"M11.562 3.266a.5.5 0 0 1 .876 0L15.39 8.87a1 1 0 0 0 1.516.294L21.183 5.5a.5.5 0 0 1 .798.519l-2.834 10.246a1 1 0 0 1-.956.734H5.81a1 1 0 0 1-.957-.734L2.02 6.02a.5.5 0 0 1 .798-.519l4.276 3.664a1 1 0 0 0 1.516-.294z",key:"1vdc57"}],["path",{d:"M5 21h14",key:"11awu3"}]]);/**
 * @license lucide-vue-next v0.468.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Ff=Ju("PauseIcon",[["rect",{x:"14",y:"4",width:"4",height:"16",rx:"1",key:"zuxfzm"}],["rect",{x:"6",y:"4",width:"4",height:"16",rx:"1",key:"1okwgv"}]]),ct=540,rt=48,Ct=492,wn=142,bs=382,yr=392,sl=11.5,kn=12.5,Mc=4.25,Qu=52,rl=29,ju=Qu/2,Tt=388,ht=718,Ot=392,Ka=82,yc=34,Of=.34,br=6,bc=.64,gr=.74,Bf=.1,kf=.45,Gf=1.2,Ei=5.82/(ht-Tt)/(1/66),zf=690,Hf=1/120,Vf=6,Wf=.7,Xf=7,La=260,ed=620,Yf=32;function Ec(i){return Math.max(0,Number(i)||0)/Ei}function xa(i){return(Number(i)||0)+yc}function al(i,e,t=0){const n=Number(e)||0,s=Ec(i.radius),r=n-(i.y-s);return r<=0?!1:(i.y+=r,i.vy=Math.max(i.vy,Math.max(0,Number(t)||0)),!0)}function qf(i,e){const t=Number(e.previousFaceY)||0,n=Number(e.currentFaceY)||0;if(n<=t)return!1;const s=Ec(i.radius),r=i.y-s,a=i.y+s;if(n<r||t>a)return!1;const o=Math.max(1/1e3,Math.min(.05,Number(e.delta)||0)),l=(n-t)/o;return al(i,n,l)}function Kf(i,e){const t=Math.max(0,Math.min(.05,Number(e.delta)||0)),n=Math.pow(.86,t*60);return i.vx*=n,i.vy*=n,Math.abs(i.vx)<.01&&(i.vx=0),Math.abs(i.vy)<.01&&(i.vy=0),i.x+=i.vx*t,i.y+=i.vy*t,{contact:qf(i,{currentFaceY:e.currentFaceY,delta:t,previousFaceY:e.previousFaceY})}}function $f(i,e){return!Number.isFinite(i.x)||!Number.isFinite(i.y)?!0:i.phase==="falling"&&i.y>e}function Da(i,e){let t=2166136261^e>>>0;const n=String(i||"coin");for(let s=0;s<n.length;s+=1)t^=n.charCodeAt(s),t=Math.imul(t,16777619);return(t>>>0)%2?1:-1}function Zf(i,e){const t=i<e?i:e,n=i<e?e:i;return Da(`${t}|${n}`,97)}function Gi(i){return Math.max(0,Math.min(br,Math.round(Number(i)||0)))}function yi(i,e,t){return Math.min(t,Math.max(e,i))}const mh=new WeakMap;function ol(i,e){const t=Number(i.y),n=Number(e);if(!Number.isFinite(t)||!Number.isFinite(n))return!1;const s=Math.max(0,Number(i.radius)||0),r=Ec(s),a=s>0?yi(r*Bf,kf,Gf):0,o=n-t,l=mh.get(i),c=l?l.supported?o>=-a:o>a:o>=-a;return mh.set(i,{supported:c}),c}function Jf(i,e){const t=Math.max(0,Math.min(.05,Number(e.delta)||0)),n=(Number(e.currentPusherY)||0)-(Number(e.previousPusherY)||0),s=Gi(i.stackLevel??0)===0&&!i.stackFalling;n>0&&s&&(i.y+=n),i.vx*=Math.pow(.82,t*60),Math.abs(i.vx)<.01&&(i.vx=0),i.x+=i.vx*t,i.vy=0;const r=xa(e.currentPusherY);return{lostSupport:!ol(i,r),supportEdgeY:r}}function gh(i=kn){const e=yi(Number(i)||kn,sl*.5,kn*3),t=Math.hypot(ju,rl),n=Qf(),s=2*(e+Mc)+n,r=yi(s/t,.72,1.9),a=Qu*r,o=rl*r,l=yi(Math.floor((bs-9-170)/o)+1,4,12),c=Ct-rt,h=e+15,f=yi(Math.floor((c-h*2)/a)+1,4,11),d=[];for(let u=0;u<l;u+=1){const m=Math.max(3,f-u%2),x=(m-1)*a,v=ct/2-x/2;for(let g=0;g<m;g+=1)d.push({index:g,row:u,x:v+g*a,y:170+u*o})}return d}function Qf(i=kn,e=Mc){return Math.hypot(ju,rl)-2*(i+e)}function jf(i,e,t){const n=Math.min(.05,Math.max(0,Number(e)||0)),s=Math.max(1,Math.min(Vf,Math.ceil(n/Hf))),r=n/s,a=[];let o=!1;np(i);for(let l=0;l<s;l+=1){i.plinkoAge+=r,i.plinkoImpactCooldown=Math.max(0,i.plinkoImpactCooldown-r),i.vy=Math.min(ed,i.vy+zf*r),i.vx*=Math.pow(.994,r*60),i.x+=i.vx*r,i.y+=i.vy*r,tp(i);const c=ep(i,t);if(c&&i.plinkoImpactCooldown<=0&&(a.push(c),i.plinkoImpactCooldown=.06),i.y>=i.plinkoProgressY+2?(i.plinkoProgressY=i.y,i.plinkoStallSeconds=0):i.plinkoStallSeconds+=r,i.plinkoStallSeconds>=Wf){const h=Da(i.id,Math.floor(i.plinkoAge*10));i.vx=yi(i.vx+h*72,-La,La),i.vy=Math.max(i.vy,125),i.y+=1.5,i.plinkoProgressY=Math.max(i.plinkoProgressY,i.y),i.plinkoStallSeconds=0,o=!0}if(i.y>=yr)return{escaped:!0,forcedExit:!1,impacts:a,rescued:o}}return i.plinkoAge>=Xf?(i.y=yr,i.vy=Math.max(i.vy,125),{escaped:!0,forcedExit:!0,impacts:a,rescued:!0}):{escaped:!1,forcedExit:!1,impacts:a,rescued:o}}function ep(i,e){const t=i.radius+Mc,n=t+2;for(const s of e){if(Math.abs(s.y-i.y)>n)continue;const r=i.x-s.x,a=i.y-s.y,o=r*r+a*a;if(o>=t*t)continue;let l,c,h;o<=1e-4?(l=Da(i.id,s.row*17+s.index)*.94,c=-.342,h=0):(h=Math.sqrt(o),l=r/h,c=a/h);const f=t-h+.02;i.x+=l*f,i.y+=c*f;const d=i.vx*l+i.vy*c;if(d<0){const u=-1.28*d;i.vx+=u*l,i.vy+=u*c}return Math.abs(l)<.08&&(i.vx+=Da(i.id,s.row*31+s.index)*18),i.vx=yi(i.vx,-La,La),i.vy=yi(i.vy,-180,ed),d<-25?s:null}return null}function tp(i){i.x-i.radius<rt?(i.x=rt+i.radius,i.vx=Math.abs(i.vx)*.72):i.x+i.radius>Ct&&(i.x=Ct-i.radius,i.vx=-Math.abs(i.vx)*.72)}function np(i){Number.isFinite(i.plinkoAge)||(i.plinkoAge=0),Number.isFinite(i.plinkoImpactCooldown)||(i.plinkoImpactCooldown=0),Number.isFinite(i.plinkoProgressY)||(i.plinkoProgressY=i.y),Number.isFinite(i.plinkoStallSeconds)||(i.plinkoStallSeconds=0)}function ip(i,e){const t=Math.max(0,Math.min(.05,Number(e)||0));return i.dropProgress=Math.min(1,Math.max(0,Number(i.dropProgress)||0)+t/Of),i.vx*=Math.pow(.78,t*60),Math.abs(i.vx)<.01&&(i.vx=0),i.x+=i.vx*t*.22,i.vy=0,i.dropProgress>=1}function sp(i,e){let t=0;for(const n of e){if(n.id===i.id)continue;const s=Gi(n.stackLevel);td(i,n,bc)&&(t=Math.max(t,Math.min(br,s+1)))}return Math.min(br,t)}function td(i,e,t=bc){const n=Math.max(.2,Math.min(.95,Number(t)||0)),s=(i.radius+e.radius)*n,r=e.x-i.x,a=(e.y-i.y)*Ei;return r*r+a*a<=s*s}function rp(i){return i.stackFalling?null:Gi(i.stackLevel)}function ap(i,e,t,n){const s=Gi(i.stackLevel);if(i.stackFalling||t.stackFalling||s<=0||Gi(t.stackLevel)!==s-1)return!1;const r={radius:i.radius,x:e.x,y:e.y},a={radius:t.radius,x:n.x,y:n.y};if(!td(r,a,gr))return!1;const o=t.x-n.x,l=t.y-n.y;return!Number.isFinite(o)||!Number.isFinite(l)?!1:(i.x=e.x+o,i.y=e.y+l,typeof t.vx=="number"&&Number.isFinite(t.vx)&&(i.vx=t.vx),typeof t.vy=="number"&&Number.isFinite(t.vy)&&(i.vy=t.vy),!0)}function Or(i,e={}){const t=e.positions;let n=0;for(const r of i){const a=t?t.get(r.id):r;Tc(r,a)&&(n=Math.max(n,r.radius))}const s={cellSize:Math.max(1,n*2),entriesByBody:new Map,levels:new Map,maximumRadius:n,normalizeLevels:e.normalizeLevels!==!1,positions:t};for(let r=0;r<i.length;r+=1)nd(s,i[r],r);return s}function Sa(i,e,t){if(!e.entriesByBody.size)return null;const n=t.position||i;if(!Tc(i,n))return null;const s=t.ratio===void 0?bc:Number(t.ratio)||0,r=Math.max(.2,Math.min(.95,s)),a=sd(e,t.supportLevel),o=e.levels.get(a);if(!o)return null;const l=Number(n.x),c=Number(n.y)*Ei,h=Math.floor(l/e.cellSize),f=Math.floor(c/e.cellSize),d=(i.radius+e.maximumRadius)*r,u=Math.max(1,Math.ceil(d/e.cellSize));let m=null,x=Number.POSITIVE_INFINITY;for(let v=-u;v<=u;v+=1)for(let g=-u;g<=u;g+=1){const y=o.get(id(h+g,f+v));if(y)for(const E of y){const M=E.body;if(M.id===i.id||t.accept&&!t.accept(M))continue;const T=(i.radius+M.radius)*r,w=E.x-l,R=E.y*Ei-c,_=w*w+R*R;_>T*T||(_<x||_===x&&E.order<(m?.order??Number.POSITIVE_INFINITY))&&(m=E,x=_)}}return m?.body||null}function op(i,e){const t=Gi(i.stackLevel);return t<=0?!0:Sa(i,e,{ratio:gr,supportLevel:t-1})!==null}function lp(i,e){const t=i.entriesByBody.get(e);return t?(cp(i,t),nd(i,e,t.order)):!1}function nd(i,e,t){const n=i.positions?i.positions.get(e.id):e;if(!Tc(e,n))return!1;const s=Number(n.x),r=Number(n.y),a=sd(i,e.stackLevel),o=id(Math.floor(s/i.cellSize),Math.floor(r*Ei/i.cellSize));let l=i.levels.get(a);l||(l=new Map,i.levels.set(a,l));let c=l.get(o);c||(c=[],l.set(o,c));const h={body:e,cellKey:o,level:a,order:t,x:s,y:r};return c.push(h),i.entriesByBody.set(e,h),!0}function cp(i,e){const t=i.levels.get(e.level),n=t?.get(e.cellKey);if(n){const s=n.indexOf(e);s>=0&&n.splice(s,1),n.length||t?.delete(e.cellKey),t&&!t.size&&i.levels.delete(e.level)}i.entriesByBody.delete(e.body)}function Tc(i,e){return!!e&&Number.isFinite(e.x)&&Number.isFinite(e.y)&&Number.isFinite(i.radius)&&i.radius>=0}function id(i,e){return`${i}:${e}`}function sd(i,e){return i.normalizeLevels?Gi(e):Number(e)}function fo(i,e={}){const t=Math.max(1,Math.min(4,Math.round(e.iterations||1))),n=Math.max(0,Math.min(3,Number(e.padding)||0)),s=Math.max(0,Math.min(1,Number(e.restitution)||0)),r=Math.max(.1,Math.min(4,Number(e.yScale)||1));for(let a=0;a<t;a+=1){if(i.length<Yf){for(let l=0;l<i.length;l+=1)for(let c=l+1;c<i.length;c+=1)_h(i[l],i[c],n,s,r);continue}const o=hp(i,n,r);for(const[l,c]of o)_h(i[l],i[c],n,s,r)}}function hp(i,e,t){let n=0;for(const h of i)vh(h)&&(n=Math.max(n,h.radius));const s=Math.max(1,n*2+e),r=new Int32Array(i.length),a=new Int32Array(i.length),o=new Uint8Array(i.length),l=new Map;for(let h=0;h<i.length;h+=1){const f=i[h];if(!vh(f))continue;const d=Math.floor(f.x/s),u=Math.floor(f.y*t/s);r[h]=d,a[h]=u,o[h]=1;const m=`${d}:${u}`,x=l.get(m);x?x.push(h):l.set(m,[h])}const c=[];for(let h=0;h<i.length;h+=1){if(!o[h])continue;const f=[],d=r[h],u=a[h];for(let m=-1;m<=1;m+=1)for(let x=-1;x<=1;x+=1){const v=l.get(`${d+x}:${u+m}`);if(v)for(const g of v)g>h&&f.push(g)}f.sort((m,x)=>m-x);for(const m of f)c.push([h,m])}return c}function vh(i){return Number.isFinite(i.x)&&Number.isFinite(i.y)&&Number.isFinite(i.radius)&&i.radius>=0}function _h(i,e,t,n,s){const r=i.radius+e.radius+t;if(Math.abs(i.y-e.y)*s>r||Math.abs(i.x-e.x)>r)return!1;const a=e.x-i.x,o=(e.y-i.y)*s,l=a*a+o*o;if(l>=r*r)return!1;let c=Math.sqrt(Math.max(0,l)),h,f;c<=1e-4?(h=Zf(i.id,e.id),f=0,c=0):(h=a/c,f=o/c);const d=(r-c)*.5;i.x-=h*d,i.y-=f*d/s,e.x+=h*d,e.y+=f*d/s;const u=(e.vx-i.vx)*h+(e.vy-i.vy)*s*f;if(u<0){const m=-(1+n)*u*.5;i.vx-=m*h,i.vy-=m*f/s,e.vx+=m*h,e.vy+=m*f/s}return!0}function up(){return{mysteryOverflowResolved:0,pusherClock:0,pusherY:Ot,previousPusherY:Ot,fullPushElapsed:0,fullPushStartY:Ot,fullPushTargetY:Ot+Ka,fullPushPendingSpawnCount:0,fullPushResumePhase:"playing",fullPushWaitingForEffects:!1,spawnClock:0,latestDropTimer:0,specialAnnouncementTimer:0,mysteryRollInterval:0,mysteryResultTimer:0,mysteryCloseTimer:0,idSeed:1,floatingScoreIdSeed:1,pendingScoredCoins:0,leaderboardDirty:!1}}const Si=960,cn=790,po=916,ws=69,vr=ct-ws,xh=32,dp=520,fp=10,pp=8,mp=24,hr=1.2,ll=.28,Ma=.72,rd=.48,ad=.72,Sh=hr*2+ll*2+Ma*2+rd+ad;function od(i,e){return i<0?"#fb7185":i===0?e%2?"#64748b":"#7c3aed":i>=25?"#fbbf24":i>=10?"#a855f7":"#22d3ee"}function gp(i,e){const t=i.length?[...i]:[0],s=kn*Math.max(.6,Number(e)||1)*2.35+8,r=Math.max(3,Math.floor((Ct-rt)/s));if(t.length<=r)return t;const a=[];for(let o=0;o<r;o+=1){const l=r===1?0:Math.round(o*(t.length-1)/(r-1));a.push(Number(t[l])||0)}return a}function cl(i,e){const t=Math.ceil(Math.min(Number(i)||0,Number(e)||0)),n=Math.floor(Math.max(Number(i)||0,Number(e)||0));return t+Math.floor(Math.random()*Math.max(1,n-t+1))}function Br(i,e,t){return i+(e-i)*Math.max(0,Math.min(1,t))}function kr(i){const e=Math.max(0,Math.min(1,i));return e*e*(3-2*e)}function ts(i){return Math.max(0,Math.floor(Number(i)||0)).toLocaleString("fr-FR")}function Mh(i){return Number(i).toLocaleString("fr-FR",{maximumFractionDigits:3})}function vp(i,e){const t=Math.max(0,Math.floor(Number(i)||0)),n=Math.max(0,Math.floor(Number(e)||0));return n>=Number.MAX_SAFE_INTEGER-t?Number.MAX_SAFE_INTEGER:t+n}function ld(i){return Number(i).toLocaleString("fr-FR",{maximumFractionDigits:1,minimumFractionDigits:Number.isInteger(Number(i))?0:1})}function Es(i,e){const t=[["#06b6d4","#1d4ed8"],["#a855f7","#db2777"],["#f59e0b","#dc2626"],["#10b981","#0891b2"],["#6366f1","#7c3aed"]];let n=0;for(let s=0;s<i.length;s+=1)n=n*31+i.charCodeAt(s)>>>0;return t[n%t.length][e?1:0]}function ya(i){return String(i||"?").split(/\s+/).filter(Boolean).slice(0,2).map(e=>e[0]?.toUpperCase()).join("")||"?"}function $a(i){const e=i;return String(e?.name||e?.displayName||e?.username||"Viewer").trim().slice(0,80)}function cd(i){const e=i;return String(e?.username||e?.uniqueId||$a(i)).trim().replace(/^@+/,"").slice(0,80)}function hl(i){const e=i;return String(e?.avatarUrl||e?.profilePictureUrl||"").trim().slice(0,4e3)}function _p(i){const e=i;return String(e?.viewerId||e?.userId||cd(i)||$a(i)).trim().toLowerCase()}function yh(i){return i.username?`@${i.username}`:i.name}function bh(i){return{backgroundImage:i.avatarUrl?`url("${i.avatarUrl.replace(/"/g,"%22")}")`:"","--avatar-a":Es(i.viewerId,0),"--avatar-b":Es(i.viewerId,1)}}function xp({runtime:i,timeRemainingMs:e,settings:t,pusherPower:n,mysteryRevealActive:s,mysteryRevealQueue:r,roundPhase:a,fullPushFinishAfter:o,fullPushActive:l,coins:c,fullPushTargetCoinIds:h,spawnQueue:f,sideGuardProgress:d,particles:u,floatingScores:m,scoreFrameBatches:x,scoreFramePlayers:v,playerByViewerId:g,pendingTones:y,players:E,totalScoredCoins:M,totalSpawnedCoins:T,totalSideLosses:w,totalDiamondsReceived:R,activeCoinCount:_,queueCoinCount:b,sideGuardSeconds:P,scoreMultiplier:L,scoreMultiplierSeconds:B,specialAnnouncement:Y,latestDropPresentedCount:p,resumeAudio:C,announceSpecial:D,spawnCoin:U,burst:O,tone:F,flushScoreFrameBatches:G,cancelMysteryReveals:Z}){function ae(ce){e.value=Math.max(0,e.value-ce*1e3),e.value<=0&&de()}function Te(ce){i.previousPusherY=i.pusherY,i.pusherClock+=ce*.24*t.value.pusherSpeed;const ue=i.pusherClock%1,_e=(1-Math.cos(ue*Math.PI*2))/2;i.pusherY=Ot+Ka*_e;const ge=Math.max(0,(i.pusherY-i.previousPusherY)/Math.max(.001,ce));n.value=Math.min(1,ge/115)}function qe(ce){if(i.fullPushWaitingForEffects){i.previousPusherY=i.pusherY,i.pusherY=Ot,n.value=0,!s.value&&!r.length&&(i.fullPushWaitingForEffects=!1,ke());return}const ue=i.pusherY;i.fullPushElapsed=Math.min(Sh,i.fullPushElapsed+ce);const _e=hr,ge=_e+ll,Fe=ge+Ma,We=Fe+rd,k=We+hr,it=k+ll+ad;i.fullPushElapsed<_e?i.pusherY=Br(i.fullPushStartY,i.fullPushTargetY,kr(i.fullPushElapsed/hr)):i.fullPushElapsed<ge?i.pusherY=i.fullPushTargetY:i.fullPushElapsed<Fe?i.pusherY=Br(i.fullPushTargetY,Ot,kr((i.fullPushElapsed-ge)/Ma)):i.fullPushElapsed<We?i.pusherY=Ot:i.fullPushElapsed<k?i.pusherY=Br(Ot,i.fullPushTargetY,kr((i.fullPushElapsed-We)/hr)):i.fullPushElapsed<it?i.pusherY=i.fullPushTargetY:i.pusherY=Br(i.fullPushTargetY,Ot,kr((i.fullPushElapsed-it)/Ma)),i.previousPusherY=ue;const Qe=Math.max(0,(i.pusherY-ue)/Math.max(.001,ce));n.value=Math.min(1,Qe/115),i.fullPushElapsed>=Sh&&ke()}function Re(ce){const ue=Sf(ce);ue.command==="pause"&&j(),ue.command==="resume"&&pe(),ue.command==="end"&&de(),ue.command==="reset"&&le(!0),ue.command==="start"&&le(!0),ue.command==="push"&&De(!1)}function j(){a.value!=="playing"||o.value||(a.value="paused")}function pe(){a.value==="finished"||o.value||(a.value="playing",C())}function de(){a.value!=="finished"&&(e.value=0,De(!0))}function De(ce){if(a.value!=="finished"){if(l.value){if(ce&&!o.value){o.value=!0,i.fullPushPendingSpawnCount=Number.POSITIVE_INFINITY,e.value=0;for(const ue of c)ue.scored||h.add(ue.id);D("POUSSÉE FINALE · TOUS LES POINTS VONT ÊTRE COMPTÉS")}return}i.fullPushResumePhase=a.value,l.value=!0,o.value=ce,i.fullPushPendingSpawnCount=ce?Number.POSITIVE_INFINITY:f.reduce((ue,_e)=>ue+_e.remaining,0),h.clear();for(const ue of c)ue.scored||h.add(ue.id);ze(),D(ce?"POUSSÉE FINALE · TOUS LES POINTS VONT ÊTRE COMPTÉS":"POUSSÉE COMPLÈTE DU PLATEAU"),C()}}function ze(){et();let ce=Math.max(0,Math.floor(t.value.maxCoins-c.length));for(;ce>0&&f.length&&(o.value||i.fullPushPendingSpawnCount>0);){const _e=f[0],ge=U(_e.drop,_e.remaining,_e.kind);h.add(ge.id),_e.remaining-=1,ce-=1,Number.isFinite(i.fullPushPendingSpawnCount)&&(i.fullPushPendingSpawnCount-=1),_e.remaining<=0&&f.shift()}for(const _e of c)_e.scored||!h.has(_e.id)||_e.phase!=="plinko"&&_e.phase!=="settling"||(_e.phase="pusher",_e.dropProgress=0,_e.plinkoProgressY=yr,_e.stackFalling=!1,_e.stackHeight=0,_e.stackLevel=0,_e.vx*=.2,_e.vy=0,_e.y=yr);const ue=c.reduce((_e,ge)=>h.has(ge.id)?Math.max(_e,ge.radius):_e,kn*t.value.coinScale);i.fullPushStartY=i.pusherY,i.fullPushTargetY=ht+ue/Ei+4-yc,i.fullPushElapsed=0,i.fullPushWaitingForEffects=!1,d.value=1,O(ct/2,Tt+82,"#fbbf24",54,180),F(220,.18,.06,3,"full-push-start")}function ke(){i.pusherY=Ot,i.previousPusherY=Ot,n.value=0,G();const ce=new Set(c.filter(ge=>ge.scored).map(ge=>ge.id));for(const ge of ce)h.delete(ge);et();const ue=c.some(ge=>!ge.scored&&h.has(ge.id)),_e=(o.value||i.fullPushPendingSpawnCount>0)&&f.length>0;if(ue||_e){ze();return}if(o.value&&(s.value||r.length)){i.fullPushWaitingForEffects=!0;return}if(o.value){re();return}He()}function et(){for(let ce=c.length-1;ce>=0;ce-=1)c[ce].phase==="falling"&&c[ce].scored&&c.splice(ce,1)}function He(){l.value=!1,o.value=!1,i.fullPushWaitingForEffects=!1,i.fullPushElapsed=0,i.fullPushPendingSpawnCount=0,h.clear(),i.pusherY=Ot,i.previousPusherY=Ot,i.pusherClock=0,n.value=0,a.value=i.fullPushResumePhase}function re(){l.value=!1,o.value=!1,i.fullPushWaitingForEffects=!1,i.fullPushElapsed=0,i.fullPushPendingSpawnCount=0,h.clear(),a.value="finished",O(ct/2,214,"#fbbf24",120,230),F(720,.34,.075)}function le(ce=!0){He(),Z(),c.splice(0),f.splice(0),u.splice(0),m.splice(0),x.clear(),v.clear(),g.clear(),y.splice(0),i.pendingScoredCoins=0,i.leaderboardDirty=!1,E.value=[],M.value=0,T.value=0,w.value=0,R.value=0,_.value=0,b.value=0,P.value=0,d.value=t.value.sideLossEnabled?0:1,L.value=1,B.value=0,Y.value="",p.value=0,e.value=t.value.roundDurationMinutes*6e4,i.pusherClock=0,i.pusherY=Ot,i.previousPusherY=Ot,a.value=ce?"playing":"paused",O(ct/2,330,"#67e8f9",42,150),C()}function he(){a.value==="playing"?j():a.value==="paused"?pe():le(!0)}return{updateRound:ae,updatePusher:Te,updateFullPush:qe,applyRoundCommand:Re,pauseRound:j,resumeRound:pe,finishRound:de,startFullPush:De,prepareFullPushCycle:ze,completeFullPushCycle:ke,removeScoredFallingCoins:et,stopFullPush:He,completeFinishedRound:re,resetRound:le,togglePause:he}}function Sp({runtime:i,roundPhase:e,mysteryRevealQueue:t,mysteryRevealActive:n,settings:s,floatingScores:r,scoreMultiplier:a,scoreMultiplierSeconds:o,mysteryRevealPhase:l,mysteryRevealAccent:c,mysteryRevealLabel:h,mysteryRevealDetail:f,mysteryToneTimers:d,getScene3d:u,awardPoints:m,enqueueSpawnBatch:x,activateSideGuard:v,tone:g,burst:y}){function E(_){if(e.value!=="finished"){if(t.length>=pp){const b=M(_);b[Math.floor(Math.random()*b.length)].run(),i.mysteryOverflowResolved+=1;return}t.push({coin:_}),!n.value&&!i.mysteryResultTimer&&!i.mysteryCloseTimer&&T()}}function M(_){const b=s.value.mysteryCube,P=[];return b.pointsBonusEnabled&&P.push({accent:"#f8d776",label:"TRÉSOR BONUS",run:()=>{const L=cl(b.pointsBonusMin,b.pointsBonusMax);return m(_,L,!1),r.push({color:"#f8d776",id:i.floatingScoreIdSeed++,life:1.55,text:`TRÉSOR +${L}`,x:_.x,y:cn+18}),`+${L} POINTS POUR ${_.name.toUpperCase()}`}}),b.coinRainEnabled&&P.push({accent:"#67e8f9",label:"PLUIE DE PIÈCES",run:()=>{const L=cl(b.coinRainMin,b.coinRainMax),B=Sc({avatarUrl:_.avatarUrl,coinCount:L,createdAt:Date.now(),displayName:_.name,eventId:`mystery-rain-${Date.now()}-${_.id}`,gift:{cost:0,id:"mystery-coin-rain",imageUrl:"",name:"Pluie mystère"},source:"manual",username:_.username,viewerId:_.viewerId});return`${x(B,"coin",L)} NOUVELLES PIÈCES POUR ${_.name.toUpperCase()}`}}),b.multiplierEnabled&&P.push({accent:"#f472b6",label:`SCORE ×${ld(b.multiplierValue)}`,run:()=>(a.value=b.multiplierValue,o.value=b.multiplierDurationSeconds,`TOUS LES SCORES SONT MULTIPLIÉS PENDANT ${Math.ceil(b.multiplierDurationSeconds)} S`)}),b.barriersEnabled&&s.value.sideLossEnabled&&P.push({accent:"#60a5fa",label:"BOUCLIERS SAUVEURS",run:()=>(v(b.barriersDurationSeconds,!1),`BORDS PROTÉGÉS PENDANT ${Math.ceil(b.barriersDurationSeconds)} S`)}),P.length||P.push({accent:"#94a3b8",label:"AUCUNE ACTION ACTIVE",run:()=>"ACTIVEZ AU MOINS UN EFFET DANS LES PARAMÈTRES"}),P}function T(){const _=t.shift();if(!_){n.value=!1;return}w();const b=M(_.coin),P=b[Math.floor(Math.random()*b.length)];let L=Math.floor(Math.random()*b.length);n.value=!0,l.value="rolling",c.value="#c084fc",h.value=b[L].label,f.value=`LE DÉ DE ${_.coin.name.toUpperCase()} CHOISIT…`,i.mysteryRollInterval=window.setInterval(()=>{L=(L+1)%b.length,h.value=b[L].label},b.length>1?135:240),[420,470,530,600,680,770,880].forEach((Y,p)=>{d.push(window.setTimeout(()=>{g(Y,.045+p*.004,.025+p*.003,2,`mystery-roll-${p}`)},240+p*245))}),i.mysteryResultTimer=window.setTimeout(()=>{if(i.mysteryResultTimer=0,window.clearInterval(i.mysteryRollInterval),i.mysteryRollInterval=0,e.value==="finished"){R();return}l.value="revealed",c.value=P.accent,h.value=P.label;const Y=P.run(),p=i.mysteryOverflowResolved;i.mysteryOverflowResolved=0,f.value=p>0?`${Y} · ${p} EFFET${p>1?"S":""} RÉSOLU${p>1?"S":""} EN RAFALE`:Y,y(_.coin.x,cn+18,P.accent,76,245),u()?.giftBurst(70),g(960,.26,.082,3,"mystery-reveal-high"),d.push(window.setTimeout(()=>{g(640,.3,.07,3,"mystery-reveal-low")},95)),i.mysteryCloseTimer=window.setTimeout(()=>{i.mysteryCloseTimer=0,n.value=!1,i.mysteryCloseTimer=window.setTimeout(()=>{i.mysteryCloseTimer=0,T()},260)},2600)},2100)}function w(){window.clearInterval(i.mysteryRollInterval),window.clearTimeout(i.mysteryResultTimer),window.clearTimeout(i.mysteryCloseTimer),i.mysteryRollInterval=0,i.mysteryResultTimer=0,i.mysteryCloseTimer=0;for(const _ of d)window.clearTimeout(_);d.splice(0)}function R(){w(),t.splice(0),i.mysteryOverflowResolved=0,n.value=!1,l.value="rolling"}return{triggerMysteryAction:E,buildMysteryActions:M,startNextMysteryReveal:T,clearMysteryRevealTimers:w,cancelMysteryReveals:R}}function Mp({runtime:i,effectiveScoreSlots:e,scoreMultiplier:t,scoreFrameBatches:n,playerByViewerId:s,players:r,scoreFramePlayers:a,totalScoredCoins:o,floatingScores:l,getScene3d:c,triggerMysteryAction:h,burst:f,tone:d}){function u(v){const g=e.value,y=Ct-rt,E=Math.max(0,Math.min(.9999,(v.x-rt)/y)),M=Math.min(g.length-1,Math.floor(E*g.length)),T=Number(g[M])||0,w=v.kind==="ticket"?v.specialValue:T,R=Math.round(w*t.value),_=od(R,M);m(v,R,!0),i.pendingScoredCoins+=1;const b=`${M}:${R}:${v.kind}`,P=n.get(b);P?P.count+=1:n.set(b,{color:_,count:1,points:R,slotIndex:M,x:rt+(M+.5)*y/g.length}),v.kind==="mystery"&&h(v)}function m(v,g,y){let E=s.get(v.viewerId);E||(E={avatarUrl:v.avatarUrl,coinsScored:0,lastScore:0,name:v.name,points:0,rankPulse:0,username:v.username,viewerId:v.viewerId},s.set(E.viewerId,E),r.value.push(E)),E.avatarUrl=v.avatarUrl||E.avatarUrl,E.name=v.name||E.name,E.username=v.username||E.username,E.points+=g,y&&(E.coinsScored+=1),E.lastScore=g,a.add(E),i.leaderboardDirty=!0}function x(){if(i.leaderboardDirty){const g=Date.now();for(const y of a)y.rankPulse=g;r.value=[...r.value],a.clear(),i.leaderboardDirty=!1}if(i.pendingScoredCoins>0&&(o.value+=i.pendingScoredCoins,i.pendingScoredCoins=0),!n.size)return;const v=[...n.values()].sort((g,y)=>g.slotIndex-y.slotIndex);n.clear();for(const g of v){const y=g.count>1?` ×${g.count}`:"";l.push({color:g.color,id:i.floatingScoreIdSeed++,life:1.2,text:`${g.points>0?"+":""}${g.points}${y}`,x:g.x,y:cn+42});const E=Math.min(18,Math.ceil(Math.log2(g.count+1)*4)),M=g.points>=20;f(g.x,cn+46,g.color,(M?28:14)+E,(M?165:100)+Math.min(30,g.count*2)),c()?.scoreBurst(g.x,g.points),d(g.points<0?145:g.points===0?260:610+Math.min(280,g.points*9),M?.16:.08,Math.min(.075,(M?.06:.035)+Math.log2(g.count+1)*.004),2,`score-slot-${g.slotIndex}`)}l.length>xh&&l.splice(0,l.length-xh)}return{scoreCoin:u,awardPoints:m,flushScoreFrameBatches:x}}function yp({runtime:i,spawnQueue:e,coins:t,settings:n,totalSpawnedCoins:s,roundPhase:r,fullPushFinishAfter:a,seenDropIds:o,totalDiamondsReceived:l,latestDrop:c,latestDropPresentedCount:h,latestDropObjectLabel:f,latestDropVisible:d,getScene3d:u,warmAvatar:m,burst:x,tone:v,activateSideGuard:g}){function y(_){if(!e.length)return;i.spawnClock+=_;const b=e[0],P=b.remaining>45?.05:b.remaining>15?.06:.075;for(i.spawnClock=Math.min(i.spawnClock,P*2);i.spawnClock>=P&&b&&t.length<n.value.maxCoins;)if(i.spawnClock-=P,E(b.drop,b.remaining,b.kind),b.remaining-=1,b.remaining<=0){e.shift(),i.spawnClock=0;break}}function E(_,b,P="coin"){const L=(sl+Math.random()*(kn-sl))*n.value.coinScale,B=Math.max(1,Number(_.coinCount)||1),Y=Math.min((Ct-rt)/2-L-4,Math.max(L*3.5,80+B*2.4)),p=b*.61803398875%1-.5,C=$a(_),D=cd(_),U=_p(_),O=hl(_),F={avatarUrl:O,createdAt:Date.now(),dropProgress:0,faceAngle:Math.random()*Math.PI*2,id:`coin-${i.idSeed++}`,kind:P,lostSide:0,name:C,phase:"plinko",plinkoAge:0,plinkoImpactCooldown:0,plinkoProgressY:wn-38,plinkoStallSeconds:0,radius:L,rotation:Math.random()*Math.PI*2,scored:!1,spin:(Math.random()>.5?1:-1)*(2.4+Math.random()*4),specialValue:P==="ticket"?cl(n.value.tickets.minPoints,n.value.tickets.maxPoints):0,stackFalling:!1,stackHeight:0,stackLevel:0,username:D,viewerId:U,vx:p*70+(Math.random()-.5)*42,vy:8+Math.random()*42,x:Math.max(rt+L,Math.min(Ct-L,ct/2+p*Y+(Math.random()-.5)*16)),y:wn-38-Math.random()*28};return F.plinkoProgressY=F.y,t.push(F),s.value+=1,m(O),x(F.x,F.y+10,"#f8d776",4,52),v(360+Math.random()*80,.035,.025),F}function M(_){if(r.value==="finished"||a.value)return;const b=Sc(_),P=String(b.eventId||b.id||""),L=Date.now();if(R(L),P&&o.has(P))return;P&&o.set(P,L),b.source==="gift"&&(l.value=vp(l.value,b.totalDiamonds));const B=Math.max(1,Math.min(n.value.maxCoins,Math.round(Number(b.coinCount)||1))),Y=Math.max(1,Math.round(Number(b.repeatCount)||1)),p=n.value.sideLossEnabled&&ho(b.gift,n.value.guardGift),C=ho(b.gift,n.value.mysteryCube),D=ho(b.gift,n.value.tickets),U=n.value.mysteryCube.enabled?C?Y:w(Y,n.value.mysteryCube.spawnChance):0,O=n.value.tickets.enabled?D?Y:w(Y,n.value.tickets.spawnChance):0;let F=!0,G=0;const Z=[];if(p&&(g(n.value.guardGift.durationSeconds),F=n.value.guardGift.includeCoinDrop,Z.push("BOUCLIERS")),U>0&&(G+=T(b,"mystery",U),C&&!n.value.mysteryCube.includeCoinDrop&&(F=!1),Z.push("DÉ MYSTÈRE")),O>0){const Te=O*n.value.tickets.countPerGift;G+=T(b,"ticket",Te),D&&!n.value.tickets.includeCoinDrop&&(F=!1),Z.push("TICKETS")}const ae=F?T(b,"coin",B):0;if(c.value=b,h.value=ae+G,f.value=Z.length&&!ae?Z.join(" + "):Z.length?`PIÈCES + ${Z.join(" + ")}`:"PIÈCES",d.value=!0,window.clearTimeout(i.latestDropTimer),i.latestDropTimer=window.setTimeout(()=>{d.value=!1},4200),m(hl(b)),u()?.giftBurst(Math.max(ae,G)),ae>=50){for(let Te=0;Te<42;Te+=1)x(70+Math.random()*400,110+Math.random()*90,Te%2?"#fbbf24":"#8b5cf6",1,160);v(210,.18,.055)}}function T(_,b,P){const L=Math.max(0,Math.round(Number(P)||0));return L<=0?0:(e.push({drop:_,kind:b,remaining:L}),L)}function w(_,b){const P=Math.max(0,Math.floor(Number(_)||0)),L=Math.max(0,Math.min(1,(Number(b)||0)/100));if(!P||L<=0)return 0;if(L>=1)return P;if(P<=4096){let U=0;for(let O=0;O<P;O+=1)Math.random()<L&&(U+=1);return U}const B=P*L,Y=Math.sqrt(P*L*(1-L)),p=Math.max(Number.EPSILON,Math.random()),C=Math.random(),D=Math.sqrt(-2*Math.log(p))*Math.cos(2*Math.PI*C);return Math.max(0,Math.min(P,Math.round(B+D*Y)))}function R(_){for(const[b,P]of o)_-P>5*6e4&&o.delete(b)}return{updateSpawnQueue:y,spawnCoin:E,enqueueDrop:M,enqueueSpawnBatch:T,randomBinomial:w,pruneSeenDrops:R}}function bp({fallbackCanvasRef:i,coins:e,particles:t,floatingScores:n,avatarCache:s,settings:r,isGalacticTheme:a,effectiveScoreSlots:o,scoreMultiplier:l,pusherPower:c,sideGuardProgress:h,getPegs:f,getPlinkoImage:d,getPlatformImage:u,getPusherY:m}){function x(p){const C=i.value;if(!C)return;const D=C.getContext("2d");if(!D)return;D.save(),D.setTransform(C.width/ct,0,0,C.height/Si,0,0),D.clearRect(0,0,ct,Si),v(D,p),g(D,p),M(D,p),T(D,p);const U=[...e].sort((O,F)=>{const G={plinko:0,pusher:1,settling:2,shelf:3,falling:4};return G[O.phase]-G[F.phase]||O.y-F.y});for(const O of U)w(D,O);R(D,p),b(D),P(D),D.restore()}function v(p,C){const D=a.value,U=p.createLinearGradient(0,0,0,Si);U.addColorStop(0,D?"#02030b":"#050818"),U.addColorStop(.46,D?"#090518":"#090b22"),U.addColorStop(1,D?"#010207":"#03040d"),p.fillStyle=U,p.fillRect(0,0,ct,Si);const O=p.createRadialGradient(ct/2,370,10,ct/2,370,430);O.addColorStop(0,D?"rgba(88, 55, 174, 0.16)":"rgba(36, 211, 238, 0.19)"),O.addColorStop(.46,D?"rgba(16, 151, 211, 0.07)":"rgba(109, 40, 217, 0.1)"),O.addColorStop(1,"rgba(2, 6, 23, 0)"),p.fillStyle=O,p.fillRect(0,0,ct,Si),p.save(),p.globalAlpha=.22;for(let G=0;G<38;G+=1){const Z=G*137.5%ct+Math.sin(C*.25+G)*6,ae=(G*83.2+C*(4+G%3))%Si;p.fillStyle=D?G%5===0?"#f2cf7a":G%2?"#74dcff":"#bd7cff":G%4===0?"#f8d776":"#72e8ff",p.beginPath(),p.arc(Z,ae,G%5===0?1.7:.8,0,Math.PI*2),p.fill()}p.restore(),p.save(),p.translate(ct/2,520),p.rotate(-.09);const F=p.createLinearGradient(-280,0,280,0);F.addColorStop(0,"rgba(34,211,238,0)"),F.addColorStop(.5,`rgba(34,211,238,${.025+Math.sin(C*.8)*.012})`),F.addColorStop(1,"rgba(34,211,238,0)"),p.fillStyle=F,p.fillRect(-310,-410,620,820),p.restore()}function g(p,C){p.save(),B(p,23,104,494,830,28);const D=p.createLinearGradient(0,104,ct,934);D.addColorStop(0,"#b98228"),D.addColorStop(.08,"#17213a"),D.addColorStop(.5,"#060a16"),D.addColorStop(.91,"#25304e"),D.addColorStop(1,"#d7a33d"),p.fillStyle=D,p.shadowColor="rgba(63, 212, 255, 0.34)",p.shadowBlur=26,p.fill(),p.shadowBlur=0,B(p,37,120,466,798,21),p.fillStyle="#060914",p.fill(),p.strokeStyle="rgba(125, 211, 252, 0.32)",p.lineWidth=1.5,p.stroke();const U=p.createLinearGradient(0,wn,0,bs);U.addColorStop(0,"#080d20"),U.addColorStop(1,"#101025"),p.fillStyle=U,p.fillRect(rt,wn-16,Ct-rt,bs-wn+32);const O=d();O?.complete&&O.naturalWidth>0&&(p.save(),p.beginPath(),p.rect(rt,wn-16,Ct-rt,bs-wn+32),p.clip(),p.globalAlpha=.78,L(p,O,rt,wn-16,Ct-rt,bs-wn+32),p.fillStyle="rgba(2, 6, 23, 0.3)",p.fillRect(rt,wn-16,Ct-rt,bs-wn+32),p.restore()),p.save(),p.beginPath(),p.moveTo(rt,Tt),p.lineTo(Ct,Tt),p.lineTo(Ct-12,ht),p.lineTo(rt+12,ht),p.closePath(),p.clip();const F=u();if(F?.complete&&F.naturalWidth>0)p.globalAlpha=.88,L(p,F,rt,Tt,Ct-rt,ht-Tt);else{const ae=p.createLinearGradient(0,Tt,0,ht);ae.addColorStop(0,"#13223a"),ae.addColorStop(1,"#07101e"),p.fillStyle=ae,p.fillRect(rt,Tt,Ct-rt,ht-Tt)}const G=p.createLinearGradient(0,Tt,0,ht);G.addColorStop(0,"rgba(2, 6, 23, 0.08)"),G.addColorStop(.66,"rgba(2, 6, 23, 0.05)"),G.addColorStop(1,"rgba(0, 0, 0, 0.48)"),p.fillStyle=G,p.fillRect(rt,Tt,Ct-rt,ht-Tt),p.globalAlpha=.12,p.strokeStyle="#5ee9ff",p.lineWidth=1;for(let ae=Tt+20;ae<ht;ae+=31)p.beginPath(),p.moveTo(rt,ae),p.lineTo(Ct,ae),p.stroke();p.restore(),p.fillStyle="#02040a",p.fillRect(rt+10,ht,Ct-rt-20,cn-ht);const Z=p.createLinearGradient(0,ht,0,cn);Z.addColorStop(0,"rgba(0,0,0,0.92)"),Z.addColorStop(1,"rgba(124,58,237,0.18)"),p.fillStyle=Z,p.fillRect(rt+10,ht,Ct-rt-20,cn-ht),E(p,C),a.value&&y(p,C),p.restore()}function y(p,C){p.save();const D=p.createLinearGradient(80,0,ct-80,0);D.addColorStop(0,"rgba(3,4,11,0)"),D.addColorStop(.18,"rgba(14,12,27,0.96)"),D.addColorStop(.5,"rgba(4,5,13,0.98)"),D.addColorStop(.82,"rgba(14,12,27,0.96)"),D.addColorStop(1,"rgba(3,4,11,0)"),p.fillStyle=D,p.fillRect(76,105,ct-152,58),p.lineCap="round",p.lineJoin="round",p.strokeStyle="#d9ad52",p.lineWidth=6,p.beginPath(),p.moveTo(106,111),p.lineTo(187,130),p.lineTo(230,116),p.moveTo(ct-106,111),p.lineTo(ct-187,130),p.lineTo(ct-230,116),p.stroke(),p.strokeStyle="rgba(74, 220, 255, 0.82)",p.lineWidth=2,p.beginPath(),p.moveTo(116,118),p.lineTo(187,136),p.lineTo(229,123),p.stroke(),p.strokeStyle="rgba(184, 83, 255, 0.82)",p.beginPath(),p.moveTo(ct-116,118),p.lineTo(ct-187,136),p.lineTo(ct-229,123),p.stroke();const U=.82+Math.sin(C*2.2)*.08;p.translate(ct/2,126),p.shadowColor="#a855f7",p.shadowBlur=18*U,p.fillStyle="#12091f",p.strokeStyle="#e4b95f",p.lineWidth=5,p.beginPath(),p.moveTo(0,-31),p.lineTo(27,-4),p.lineTo(18,25),p.lineTo(0,36),p.lineTo(-18,25),p.lineTo(-27,-4),p.closePath(),p.fill(),p.stroke();const O=p.createLinearGradient(-13,-17,14,19);O.addColorStop(0,"#f3d8ff"),O.addColorStop(.28,"#c66cff"),O.addColorStop(.68,"#7131c9"),O.addColorStop(1,"#32105f"),p.fillStyle=O,p.strokeStyle="#fff0bc",p.lineWidth=2,p.beginPath(),p.moveTo(0,-20),p.lineTo(14,-2),p.lineTo(0,22),p.lineTo(-14,-2),p.closePath(),p.fill(),p.stroke(),p.restore(),p.save(),p.strokeStyle="rgba(242, 198, 95, 0.9)",p.lineWidth=4;for(const F of[-1,1]){const G=F<0?62:ct-62;p.beginPath(),p.moveTo(G-F*9,287),p.lineTo(G+F*4,301),p.lineTo(G-F*9,315),p.stroke()}p.restore()}function E(p,C){const D=o.value,U=(Ct-rt)/D.length;for(let O=0;O<D.length;O+=1){const F=rt+O*U,G=Number(D[O])||0,Z=od(G,O);p.save(),p.beginPath(),p.moveTo(F+2,cn),p.lineTo(F+U-2,cn),p.lineTo(F+U-7,po),p.lineTo(F+7,po),p.closePath(),p.fillStyle="rgba(2, 4, 10, 0.96)",p.shadowColor=Z,p.shadowBlur=9+Math.sin(C*2.2+O)*2,p.fill(),p.shadowBlur=0,p.strokeStyle="rgba(255, 255, 255, 0.82)",p.lineWidth=2,p.stroke();const ae=p.createLinearGradient(0,cn,0,po);ae.addColorStop(0,Y(Z,.08)),ae.addColorStop(.58,Y(Z,.14)),ae.addColorStop(1,Y(Z,.3)),p.fillStyle=ae,p.fill(),p.fillStyle="#f8fafc",p.font=`950 ${D.length>=12?18:D.length>=9?21:25}px Inter, system-ui, sans-serif`,p.textAlign="center",p.textBaseline="middle",p.lineJoin="round",p.strokeStyle="rgba(0, 0, 0, 0.96)",p.lineWidth=D.length>=12?4:5,p.shadowColor=Z,p.shadowBlur=12;const Te=Math.round(G*l.value),qe=`${Te>0?"+":""}${Te}`;p.strokeText(qe,F+U/2,cn+34),p.fillText(qe,F+U/2,cn+34),p.restore()}}function M(p,C){p.save();for(const D of f()){const U=.7+Math.sin(C*2+D.x*.03)*.14;p.shadowColor=a.value?"#e8bb61":D.row%2?"#8b5cf6":"#22d3ee",p.shadowBlur=10*U;const O=p.createRadialGradient(D.x-2,D.y-2,1,D.x,D.y,7);O.addColorStop(0,"#fff8d9"),O.addColorStop(.32,"#d9b35b"),O.addColorStop(.72,"#5b421d"),O.addColorStop(1,"#15101b"),p.fillStyle=O,p.beginPath(),p.arc(D.x,D.y,5.7,0,Math.PI*2),p.fill(),p.shadowBlur=0,p.strokeStyle="rgba(255,255,255,0.28)",p.lineWidth=.8,p.stroke()}p.restore()}function T(p,C){p.save();const D=m(),U=c.value;p.shadowColor=U>.1?"#22d3ee":"#7c3aed",p.shadowBlur=10+U*18;const O=44+Math.max(0,D-Tt)*.035,F=ct-O*2,G=p.createLinearGradient(0,D,0,D+36);G.addColorStop(0,"#f0c977"),G.addColorStop(.12,"#24324e"),G.addColorStop(.55,"#0c1220"),G.addColorStop(.88,"#273453"),G.addColorStop(1,"#d3a44b"),B(p,O,D,F,34,9),p.fillStyle=G,p.fill(),p.shadowBlur=0,p.strokeStyle=`rgba(103,232,249,${.42+U*.42})`,p.lineWidth=1.5,p.stroke();const Z=p.createLinearGradient(O,0,O+F,0);Z.addColorStop(0,"rgba(34,211,238,0)"),Z.addColorStop(.18,"#22d3ee"),Z.addColorStop(.5,"#f8d776"),Z.addColorStop(.82,"#a855f7"),Z.addColorStop(1,"rgba(168,85,247,0)"),p.fillStyle=Z,p.globalAlpha=.56+Math.sin(C*4)*.1,B(p,O+12,D+7,F-24,3,2),p.fill(),p.restore()}function w(p,C){const D=C.phase==="pusher"||C.phase==="settling"||C.phase==="shelf",U=D?Math.max(0,Math.min(1,(C.y-Tt)/(ht-Tt))):0,O=D?.87+U*.18:1,F=C.radius*O,G=C.phase==="falling"?.24+Math.abs(Math.cos(C.faceAngle))*.76:D?.64+Math.abs(Math.cos(C.faceAngle))*.16:.78+Math.abs(Math.cos(C.faceAngle))*.22,Z=C.phase==="pusher"?-5:C.phase==="settling"?-5*(1-C.dropProgress*C.dropProgress):0,ae=D?C.stackHeight*4.2:0;if(p.save(),p.translate(C.x,C.y+Z-ae),p.rotate(C.rotation*.16),p.save(),p.scale(1,.36),p.fillStyle=C.phase==="falling"?"rgba(0,0,0,0.18)":"rgba(0,0,0,0.48)",p.shadowColor="rgba(0,0,0,0.62)",p.shadowBlur=9,p.beginPath(),p.ellipse(2,F*1.55,F*.92,F*.52,0,0,Math.PI*2),p.fill(),p.restore(),C.kind==="mystery"){p.scale(1,Math.max(.56,G));const Re=F*1.52,j=p.createLinearGradient(-Re,-Re,Re,Re);j.addColorStop(0,"#f5e8ff"),j.addColorStop(.25,"#d06cff"),j.addColorStop(.68,"#7132c7"),j.addColorStop(1,"#29104d"),B(p,-Re/2,-Re/2,Re,Re,F*.28),p.fillStyle=j,p.shadowColor="#c084fc",p.shadowBlur=18,p.fill(),p.shadowBlur=0,p.strokeStyle="#ffe8a3",p.lineWidth=Math.max(1.4,F*.12),p.stroke(),p.fillStyle="#fff8db",p.font=`950 ${Math.max(11,F*1.05)}px Inter, system-ui, sans-serif`,p.textAlign="center",p.textBaseline="middle",p.fillText("?",0,1),p.restore();return}if(C.kind==="ticket"){p.scale(1,Math.max(.48,G));const Re=F*1.82,j=F*1.18,pe=p.createLinearGradient(-Re,0,Re,0);pe.addColorStop(0,"#0e7490"),pe.addColorStop(.5,"#67e8f9"),pe.addColorStop(1,"#7c3aed"),B(p,-Re/2,-j/2,Re,j,F*.2),p.fillStyle=pe,p.shadowColor="#67e8f9",p.shadowBlur=14,p.fill(),p.shadowBlur=0,p.strokeStyle="#fff3b0",p.lineWidth=Math.max(1.2,F*.1),p.stroke(),p.fillStyle="#07111e",p.font=`950 ${Math.max(6,F*.48)}px Inter, system-ui, sans-serif`,p.textAlign="center",p.textBaseline="middle",p.fillText(`+${C.specialValue}`,0,0),p.restore();return}p.scale(1,G);const Te=p.createRadialGradient(-F*.35,-F*.42,F*.1,0,0,F);if(Te.addColorStop(0,"#fff7c5"),Te.addColorStop(.24,"#f6c95b"),Te.addColorStop(.7,"#a76410"),Te.addColorStop(1,"#4c2506"),p.fillStyle=Te,p.shadowColor="#fbbf24",p.shadowBlur=C.phase==="falling"?16:7,p.beginPath(),p.arc(0,0,F,0,Math.PI*2),p.fill(),p.shadowBlur=0,p.fillStyle="#08101d",p.beginPath(),p.arc(0,0,F*.76,0,Math.PI*2),p.fill(),a.value){const Re=p.createLinearGradient(-F,-F,F,F);Re.addColorStop(0,Es(C.viewerId,0)),Re.addColorStop(1,Es(C.viewerId,1)),p.strokeStyle=Re,p.lineWidth=Math.max(1.6,F*.13),p.beginPath(),p.arc(0,0,F*.77,0,Math.PI*2),p.stroke()}const qe=C.avatarUrl?s.get(C.avatarUrl):null;if(p.save(),p.beginPath(),p.arc(0,0,F*.68,0,Math.PI*2),p.clip(),qe?.complete&&qe.naturalWidth>0)L(p,qe,-F*.68,-F*.68,F*1.36,F*1.36);else{const Re=p.createLinearGradient(-F,-F,F,F);Re.addColorStop(0,Es(C.viewerId,0)),Re.addColorStop(1,Es(C.viewerId,1)),p.fillStyle=Re,p.fillRect(-F,-F,F*2,F*2),p.fillStyle="#ffffff",p.font=`900 ${Math.max(8,F*.7)}px Inter, system-ui, sans-serif`,p.textAlign="center",p.textBaseline="middle",p.fillText(ya(C.name),0,1)}p.restore(),p.strokeStyle="rgba(255,255,255,0.72)",p.lineWidth=Math.max(1,F*.07),p.beginPath(),p.arc(0,0,F*.73,0,Math.PI*2),p.stroke(),p.strokeStyle="rgba(80,38,4,0.65)",p.lineWidth=Math.max(1,F*.055),p.setLineDash([2.1,2.5]),p.beginPath(),p.arc(0,0,F*.9,0,Math.PI*2),p.stroke(),p.setLineDash([]),p.restore()}function R(p,C){p.save();const D=p.createLinearGradient(0,0,ct,0);D.addColorStop(0,"#f1c15b"),D.addColorStop(.08,"#15213a"),D.addColorStop(.92,"#15213a"),D.addColorStop(1,"#f1c15b"),p.strokeStyle=D,p.lineWidth=9,p.beginPath(),p.moveTo(43,134),p.lineTo(43,914),p.moveTo(497,134),p.lineTo(497,914),p.stroke(),p.strokeStyle=`rgba(103,232,249,${.38+Math.sin(C*2.4)*.09})`,p.lineWidth=2,p.beginPath(),p.moveTo(48,143),p.lineTo(48,904),p.moveTo(492,143),p.lineTo(492,904),p.stroke(),p.fillStyle="#f8d776",p.shadowColor="#fbbf24",p.shadowBlur=12,p.beginPath(),p.moveTo(54,ht-3),p.lineTo(486,ht-3),p.lineTo(479,ht+7),p.lineTo(61,ht+7),p.closePath(),p.fill(),p.shadowBlur=0,_(p,C),p.fillStyle="rgba(255,255,255,0.045)",p.beginPath(),p.moveTo(53,136),p.lineTo(165,136),p.lineTo(82,716),p.lineTo(53,716),p.closePath(),p.fill(),p.restore()}function _(p,C){const D=Math.max(0,Math.min(1,h.value));if(D<=.002)return;p.save(),p.globalAlpha=.35+D*.65,p.lineCap="round",p.lineWidth=6+D*3,p.shadowColor="#67e8f9",p.shadowBlur=9+D*14;const U=p.createLinearGradient(0,Tt,0,ht);U.addColorStop(0,"#f8d776"),U.addColorStop(.35,"#67e8f9"),U.addColorStop(1,"#a855f7"),p.strokeStyle=U;const O=(1-D)*52;for(const F of[-1,1]){const G=F<0?ws:vr,Z=F<0?61:ct-61;p.beginPath(),p.moveTo(G,Tt+O),p.lineTo(Z,ht-4+O),p.stroke()}p.globalAlpha*=.42+Math.sin(C*3.2)*.08,p.lineWidth=2,p.strokeStyle="#ffffff";for(const F of[-1,1]){const G=F<0?ws:vr,Z=F<0?61:ct-61;p.beginPath(),p.moveTo(G,Tt+O),p.lineTo(Z,ht-4+O),p.stroke()}p.restore()}function b(p){p.save();for(const C of t){const D=Math.max(0,C.life/C.maxLife);p.globalAlpha=D,p.fillStyle=C.color,p.shadowColor=C.color,p.shadowBlur=7,p.beginPath(),p.arc(C.x,C.y,C.radius*Math.max(.35,D),0,Math.PI*2),p.fill()}p.restore()}function P(p){p.save(),p.textAlign="center",p.textBaseline="middle",p.font="950 30px Inter, system-ui, sans-serif";for(const C of n){const D=Math.max(0,Math.min(1,C.life*1.5));p.globalAlpha=D,p.fillStyle=C.color,p.shadowColor=C.color,p.shadowBlur=18,p.fillText(C.text,C.x,C.y)}p.restore()}function L(p,C,D,U,O,F){const G=C.naturalWidth/C.naturalHeight,Z=O/F;let ae=C.naturalWidth,Te=C.naturalHeight,qe=0,Re=0;G>Z?(ae=C.naturalHeight*Z,qe=(C.naturalWidth-ae)/2):(Te=C.naturalWidth/Z,Re=(C.naturalHeight-Te)/2),p.drawImage(C,qe,Re,ae,Te,D,U,O,F)}function B(p,C,D,U,O,F){p.beginPath(),p.roundRect(C,D,U,O,F)}function Y(p,C){const D=p.trim();if(/^#[0-9a-f]{6}$/i.test(D)){const U=Number.parseInt(D.slice(1,3),16),O=Number.parseInt(D.slice(3,5),16),F=Number.parseInt(D.slice(5,7),16);return`rgba(${U},${O},${F},${C})`}return D}return{drawLegacyScene:x}}function Ep({muted:i,settings:e,pendingTones:t}){let n=null,s=0,r=Number.NEGATIVE_INFINITY;async function a(){if(!(i.value||e.value.volume<=0))try{n||=new AudioContext,n.state==="suspended"&&await n.resume()}catch{}}function o(h,f=.06,d=.035,u=0,m="ambient"){if(i.value||e.value.volume<=0)return;const x={duration:Math.max(.02,Math.min(.5,Number(f)||.06)),frequency:Math.max(40,Math.min(2400,Number(h)||440)),gainValue:Math.max(.001,Math.min(.12,Number(d)||.035)),key:m,priority:Math.max(0,Math.min(3,Math.round(Number(u)||0))),sequence:s++},v=t.find(E=>E.key===x.key);if(v){(x.priority>v.priority||x.gainValue>=v.gainValue)&&(v.duration=x.duration,v.frequency=x.frequency,v.gainValue=x.gainValue,v.priority=x.priority);return}if(t.length<fp){t.push(x);return}let g=0;for(let E=1;E<t.length;E+=1){const M=t[E],T=t[g];(M.priority<T.priority||M.priority===T.priority&&M.gainValue<T.gainValue)&&(g=E)}const y=t[g];(x.priority>y.priority||x.priority===y.priority&&x.gainValue>y.gainValue)&&(t[g]=x)}function l(h){if(!t.length)return;if(i.value||e.value.volume<=0){t.splice(0);return}if(h-r<mp)return;let f=0;for(let u=1;u<t.length;u+=1){const m=t[u],x=t[f];(m.priority>x.priority||m.priority===x.priority&&m.sequence<x.sequence)&&(f=u)}const d=t.splice(f,1)[0];try{if(n||=new AudioContext,n.state!=="running")return;const u=n.createOscillator(),m=n.createGain();u.type=d.frequency<250?"sawtooth":"triangle",u.frequency.setValueAtTime(d.frequency,n.currentTime),m.gain.setValueAtTime(Math.max(.001,d.gainValue*e.value.volume),n.currentTime),m.gain.exponentialRampToValueAtTime(.001,n.currentTime+d.duration),u.connect(m),m.connect(n.destination),u.start(),u.stop(n.currentTime+d.duration),r=h}catch{}}function c(){t.splice(0),n?.close().catch(()=>{})}return{resumeAudio:a,tone:o,flushPendingTone:l,dispose:c}}function Tp({coins:i,particles:e,floatingScores:t,totalSideLosses:n,sideGuardSolid:s,getPegs:r,getPusherY:a,getPreviousPusherY:o,burst:l,tone:c,scoreCoin:h}){function f(p){return p.phase==="pusher"&&!p.stackFalling}function d(p){return p.phase==="shelf"&&!p.stackFalling}function u(p){const C=xa(a()),D=xa(o()),U=new Map(i.filter(G=>G.phase==="pusher"||G.phase==="shelf").map(G=>[G.id,{x:G.x,y:G.y}]));for(const G of i){if(G.rotation+=G.spin*p,G.faceAngle+=G.spin*1.45*p,G.phase==="plinko"){const Z=jf(G,p,r());for(const ae of Z.impacts)g(ae);Z.escaped&&(G.phase="pusher",G.dropProgress=0,G.y=yr,G.vx*=.22,G.vy=0,G.spin*=.38,P(G),M(G,"pusher"),l(G.x,G.y,"#6ee7ff",6,52),c(420,.025,.018));continue}if(G.phase==="pusher"){Jf(G,{currentPusherY:a(),delta:p,previousPusherY:o()}),P(G);continue}if(G.phase==="settling"){if(ip(G,p)){G.phase="shelf",G.dropProgress=1,G.vx*=.32,G.vy=0,G.spin*=.62;const Z=Math.max(0,(C-D)/Math.max(1/1e3,p));al(G,C,Z),L(G),M(G,"shelf"),l(G.x,G.y,"#d7b56d",7,48),c(235,.045,.024)}continue}if(G.phase==="shelf"){Kf(G,{currentFaceY:C,delta:p,previousFaceY:D}),L(G);continue}G.stackHeight=Math.max(0,G.stackHeight-p*8),G.vy+=880*p,G.vx*=Math.pow(.992,p*60),G.x+=G.vx*p,G.y+=G.vy*p,!G.scored&&G.y>=cn+18&&(G.scored=!0,h(G))}_();const O=Or(i,{normalizeLevels:!1,positions:U});y(U,O),E(D,C,p,U,O),T(p);let F=0;for(let G=0;G<i.length;G+=1){const Z=i[G];$f(Z,Si+70)||(i[F]=Z,F+=1)}i.length=F}function m(p){p.phase!=="settling"&&(p.phase="settling",p.dropProgress=0,p.stackFalling=!1,p.vy=0,p.spin*=.74,l(p.x,p.y,"#9deeff",4,36))}function x(p){p.phase!=="falling"&&(p.phase="falling",p.lostSide=0,p.dropProgress=1,p.stackLevel=0,p.stackFalling=!1,p.vy=90+Math.random()*45,p.vx+=(Math.random()-.5)*36,p.spin=(Math.random()>.5?1:-1)*(5.2+Math.random()*5),l(p.x,ht+8,"#fbbf24",7,85))}function v(p,C){p.phase!=="falling"&&(p.phase="falling",p.lostSide=C,p.dropProgress=1,p.stackLevel=0,p.stackFalling=!1,p.scored=!0,p.vy=72+Math.random()*36,p.vx=C*(92+Math.random()*64),p.spin=-C*(6.2+Math.random()*5.5),n.value+=1,l(p.x,p.y,"#fb7185",10,105),c(128,.09,.04,1,"side-loss"))}function g(p){l(p.x,p.y,p.row%2?"#a78bfa":"#67e8f9",3,42),c(540+p.row*35,.025,.02)}function y(p,C){const D=xa(a());for(let U=0;U<=br;U+=1){if(U>0){const F=i.filter(Te=>Te.phase==="pusher"),G=i.filter(Te=>Te.phase==="settling"),Z=Or(F.filter(Te=>!Te.stackFalling),{normalizeLevels:!1}),ae=Or(G,{normalizeLevels:!1});for(const Te of F.filter(qe=>qe.stackLevel===U)){const qe=Sa(Te,Z,{ratio:gr,supportLevel:U-1})!==null,Re=!qe&&Sa(Te,ae,{ratio:gr,supportLevel:U-1})!==null;!qe&&Re&&m(Te)}R("pusher",U,p,C)}const O=w("pusher",U);fo(O,{iterations:4,padding:0,restitution:.04,yScale:Ei});for(const F of O)P(F),U===0&&!ol(F,D)&&m(F)}}function E(p,C,D,U,O){const F=Math.max(0,(C-p)/Math.max(.001,D));for(let Z=0;Z<=br;Z+=1){Z>0&&R("shelf",Z,U,O);const ae=w("shelf",Z);for(let Te=0;Te<4;Te+=1){fo(ae,{iterations:1,padding:0,restitution:.06,yScale:Ei});for(const qe of ae)al(qe,C,F),L(qe)}}const G=i.filter(Z=>Z.phase==="shelf");for(const Z of G)L(Z),Z.stackLevel===0&&!ol(Z,ht)&&x(Z)}function M(p,C){const D=i.filter(U=>U.id!==p.id&&U.phase===C&&!U.stackFalling);if(p.stackLevel=sp(p,D),p.stackLevel===0){p.stackHeight=0,p.stackFalling=!1;return}p.stackHeight=Math.max(p.stackHeight,p.stackLevel+.32),p.stackFalling=!0}function T(p){for(const C of["pusher","shelf"]){const D=i.filter(O=>O.phase===C).sort((O,F)=>O.stackLevel-F.stackLevel),U=Or(D);for(const O of D){if(O.stackFalling){O.stackHeight=Math.max(O.stackLevel,O.stackHeight-p*7),O.stackHeight<=O.stackLevel+.005&&(O.stackHeight=O.stackLevel,O.stackFalling=!1);continue}if(O.stackLevel>0&&!op(O,U)){O.stackLevel-=1,O.stackFalling=!0,lp(U,O);continue}O.stackHeight=O.stackLevel}}}function w(p,C){return i.filter(D=>D.phase===p&&rp(D)===C)}function R(p,C,D,U){const O=i.filter(F=>F.phase===p);for(const F of O){if(F.stackLevel!==C||F.stackFalling)continue;const G=D.get(F.id);if(!G)continue;const Z=Sa(F,U,{accept:p==="pusher"?f:d,position:G,ratio:gr,supportLevel:C-1});if(!Z)continue;const ae=D.get(Z.id);ae&&ap(F,G,Z,ae)&&(p==="pusher"?P(F):L(F))}}function _(){const p=b("plinko",2,.16);for(const C of p)C.x-C.radius<rt?(C.x=rt+C.radius,C.vx=Math.abs(C.vx)*.5):C.x+C.radius>Ct&&(C.x=Ct-C.radius,C.vx=-Math.abs(C.vx)*.5)}function b(p,C,D,U=1){const O=i.filter(F=>F.phase===p);return fo(O,{iterations:C,padding:p==="plinko"?.25:0,restitution:D,yScale:U}),O}function P(p){if(!s.value){p.x<ws?v(p,-1):p.x>vr&&v(p,1);return}p.x-p.radius<ws?(p.x=ws+p.radius,p.vx=Math.abs(p.vx)*.22):p.x+p.radius>vr&&(p.x=vr-p.radius,p.vx=-Math.abs(p.vx)*.22)}function L(p){const D=48+Math.max(0,Math.min(1,(p.y-Tt)/(ht-Tt)))*13,U=ct-D;if(!s.value){p.x<D?v(p,-1):p.x>U&&v(p,1);return}p.x-p.radius<D?(p.x=D+p.radius,p.vx=Math.abs(p.vx)*.3):p.x+p.radius>U&&(p.x=U-p.radius,p.vx=-Math.abs(p.vx)*.3)}function B(p){let C=0;for(let D=0;D<e.length;D+=1){const U=e[D];U.life-=p,U.vy+=155*p,U.x+=U.vx*p,U.y+=U.vy*p,!(U.life<=0)&&(e[C]=U,C+=1)}e.length=C}function Y(p){for(const C of t)C.life-=p,C.y-=42*p;for(let C=t.length-1;C>=0;C-=1)t[C].life<=0&&t.splice(C,1)}return{isPusherTransportSupport:f,isShelfTransportSupport:d,updateCoins:u,beginSettlingCoin:m,beginFallingCoin:x,beginSideFallingCoin:v,showPegImpact:g,resolveUpperTrayCollisions:y,resolveShelfCollisions:E,assignLandingStack:M,stabilizeCoinStacks:T,stackCoinsAtLevel:w,transportCoinStackLevel:R,resolvePlinkoCollisions:_,resolveCoinCollisions:b,constrainUpperTrayCoin:P,constrainShelfCoin:L,updateParticles:B,updateFloatingScores:Y}}const Ap={class:"mystery-live-result",role:"status","aria-live":"assertive","aria-atomic":"true"},wp={class:"mystery-core"},Cp={class:"mystery-copy"},Rp={class:"mystery-kicker"},Pp={class:"mystery-label"},Ip={class:"mystery-detail"},Lp={class:"mystery-particles","aria-hidden":"true"},Dp=$u({__name:"CoinPusherMysteryReveal",props:{active:{type:Boolean},phase:{},label:{},detail:{},accent:{default:"#a855f7"}},setup(i){return(e,t)=>(bt(),lr(_a,{name:"mystery-presence"},{default:cr(()=>[i.active?(bt(),Nt("section",{key:0,class:ni(["mystery-reveal",`is-${i.phase}`]),style:mr({"--mystery-accent":i.accent})},[me("span",Ap,nt(i.phase==="revealed"?`${i.label}. ${i.detail}`:""),1),t[4]||(t[4]=me("div",{class:"mystery-vignette","aria-hidden":"true"},null,-1)),me("div",wp,[t[2]||(t[2]=me("div",{class:"energy-rings","aria-hidden":"true"},[me("i",{class:"energy-ring energy-ring--outer"}),me("i",{class:"energy-ring energy-ring--middle"}),me("i",{class:"energy-ring energy-ring--inner"}),me("i",{class:"energy-sweep"})],-1)),t[3]||(t[3]=me("div",{class:"dice-stage","aria-hidden":"true"},[me("div",{class:"dice-glow"}),me("div",{class:"dice-shadow"}),me("div",{class:"mystery-cube"},[me("span",{class:"cube-face cube-face--front"},"?"),me("span",{class:"cube-face cube-face--back"},"?"),me("span",{class:"cube-face cube-face--right"},"?"),me("span",{class:"cube-face cube-face--left"},"?"),me("span",{class:"cube-face cube-face--top"},"?"),me("span",{class:"cube-face cube-face--bottom"},"?")]),me("div",{class:"reveal-flare"})],-1)),me("div",Cp,[me("span",Rp,[t[0]||(t[0]=me("i",{class:"kicker-line"},null,-1)),ti(" "+nt(i.phase==="rolling"?"Le destin tourne":"Dé mystère")+" ",1),t[1]||(t[1]=me("i",{class:"kicker-line"},null,-1))]),me("strong",Pp,nt(i.label),1),me("span",Ip,nt(i.detail),1)]),me("div",Lp,[(bt(),Nt(nl,null,il(14,n=>me("i",{key:n,style:mr({"--particle-index":n})},null,4)),64))])])],6)):Jt("",!0)]),_:1}))}}),Np=Zu(Dp,[["__scopeId","data-v-3f325b74"]]);/**
 * @license
 * Copyright 2010-2026 Three.js Authors
 * SPDX-License-Identifier: MIT
 */const Ac="185",Up=0,Eh=1,Fp=2,ba=1,hd=2,ur=3,li=0,en=1,Cn=2,Gn=0,Oi=1,zi=2,Th=3,Ah=4,Op=5,Di=100,Bp=101,kp=102,Gp=103,zp=104,Hp=200,Vp=201,Wp=202,Xp=203,ul=204,dl=205,Yp=206,qp=207,Kp=208,$p=209,Zp=210,Jp=211,Qp=212,jp=213,em=214,fl=0,pl=1,ml=2,Ps=3,gl=4,vl=5,_l=6,xl=7,wc=0,tm=1,nm=2,zn=0,Cc=1,Rc=2,Pc=3,Za=4,Ic=5,Lc=6,Dc=7,ud=300,Hi=301,Is=302,mo=303,go=304,Ja=306,Sl=1e3,Pn=1001,Ml=1002,Xt=1003,im=1004,Gr=1005,Ft=1006,vo=1007,ri=1008,un=1009,dd=1010,fd=1011,Er=1012,Nc=1013,Xn=1014,In=1015,dn=1016,Uc=1017,Fc=1018,Tr=1020,pd=35902,md=35899,gd=1021,vd=1022,Ln=1023,ci=1026,Fi=1027,Oc=1028,Bc=1029,Vi=1030,kc=1031,Gc=1033,Ea=33776,Ta=33777,Aa=33778,wa=33779,yl=35840,bl=35841,El=35842,Tl=35843,Al=36196,wl=37492,Cl=37496,Rl=37488,Pl=37489,Na=37490,Il=37491,Ll=37808,Dl=37809,Nl=37810,Ul=37811,Fl=37812,Ol=37813,Bl=37814,kl=37815,Gl=37816,zl=37817,Hl=37818,Vl=37819,Wl=37820,Xl=37821,Yl=36492,ql=36494,Kl=36495,$l=36283,Zl=36284,Ua=36285,Jl=36286,sm=3200,Fa=0,rm=1,Mi="",kt="srgb",Oa="srgb-linear",Ba="linear",pt="srgb",ns=7680,wh=519,am=512,om=513,lm=514,zc=515,cm=516,hm=517,Hc=518,um=519,Ql=35044,Bi=35048,Ch="300 es",Bn=2e3,Ar=2001;function dm(i){for(let e=i.length-1;e>=0;--e)if(i[e]>=65535)return!0;return!1}function wr(i){return document.createElementNS("http://www.w3.org/1999/xhtml",i)}function fm(){const i=wr("canvas");return i.style.display="block",i}const Rh={};function ka(...i){const e="THREE."+i.shift();console.log(e,...i)}function _d(i){const e=i[0];if(typeof e=="string"&&e.startsWith("TSL:")){const t=i[1];t&&t.isStackTrace?i[0]+=" "+t.getLocation():i[1]='Stack trace not available. Enable "THREE.Node.captureStackTrace" to capture stack traces.'}return i}function Ke(...i){i=_d(i);const e="THREE."+i.shift();{const t=i[0];t&&t.isStackTrace?console.warn(t.getError(e)):console.warn(e,...i)}}function at(...i){i=_d(i);const e="THREE."+i.shift();{const t=i[0];t&&t.isStackTrace?console.error(t.getError(e)):console.error(e,...i)}}function Cs(...i){const e=i.join(" ");e in Rh||(Rh[e]=!0,Ke(...i))}function pm(i,e,t){return new Promise(function(n,s){function r(){switch(i.clientWaitSync(e,i.SYNC_FLUSH_COMMANDS_BIT,0)){case i.WAIT_FAILED:s();break;case i.TIMEOUT_EXPIRED:setTimeout(r,t);break;default:n()}}setTimeout(r,t)})}const mm={[fl]:pl,[ml]:_l,[gl]:xl,[Ps]:vl,[pl]:fl,[_l]:ml,[xl]:gl,[vl]:Ps};class Ki{addEventListener(e,t){this._listeners===void 0&&(this._listeners={});const n=this._listeners;n[e]===void 0&&(n[e]=[]),n[e].indexOf(t)===-1&&n[e].push(t)}hasEventListener(e,t){const n=this._listeners;return n===void 0?!1:n[e]!==void 0&&n[e].indexOf(t)!==-1}removeEventListener(e,t){const n=this._listeners;if(n===void 0)return;const s=n[e];if(s!==void 0){const r=s.indexOf(t);r!==-1&&s.splice(r,1)}}dispatchEvent(e){const t=this._listeners;if(t===void 0)return;const n=t[e.type];if(n!==void 0){e.target=this;const s=n.slice(0);for(let r=0,a=s.length;r<a;r++)s[r].call(this,e);e.target=null}}}const qt=["00","01","02","03","04","05","06","07","08","09","0a","0b","0c","0d","0e","0f","10","11","12","13","14","15","16","17","18","19","1a","1b","1c","1d","1e","1f","20","21","22","23","24","25","26","27","28","29","2a","2b","2c","2d","2e","2f","30","31","32","33","34","35","36","37","38","39","3a","3b","3c","3d","3e","3f","40","41","42","43","44","45","46","47","48","49","4a","4b","4c","4d","4e","4f","50","51","52","53","54","55","56","57","58","59","5a","5b","5c","5d","5e","5f","60","61","62","63","64","65","66","67","68","69","6a","6b","6c","6d","6e","6f","70","71","72","73","74","75","76","77","78","79","7a","7b","7c","7d","7e","7f","80","81","82","83","84","85","86","87","88","89","8a","8b","8c","8d","8e","8f","90","91","92","93","94","95","96","97","98","99","9a","9b","9c","9d","9e","9f","a0","a1","a2","a3","a4","a5","a6","a7","a8","a9","aa","ab","ac","ad","ae","af","b0","b1","b2","b3","b4","b5","b6","b7","b8","b9","ba","bb","bc","bd","be","bf","c0","c1","c2","c3","c4","c5","c6","c7","c8","c9","ca","cb","cc","cd","ce","cf","d0","d1","d2","d3","d4","d5","d6","d7","d8","d9","da","db","dc","dd","de","df","e0","e1","e2","e3","e4","e5","e6","e7","e8","e9","ea","eb","ec","ed","ee","ef","f0","f1","f2","f3","f4","f5","f6","f7","f8","f9","fa","fb","fc","fd","fe","ff"];let Ph=1234567;const _r=Math.PI/180,Ls=180/Math.PI;function Hn(){const i=Math.random()*4294967295|0,e=Math.random()*4294967295|0,t=Math.random()*4294967295|0,n=Math.random()*4294967295|0;return(qt[i&255]+qt[i>>8&255]+qt[i>>16&255]+qt[i>>24&255]+"-"+qt[e&255]+qt[e>>8&255]+"-"+qt[e>>16&15|64]+qt[e>>24&255]+"-"+qt[t&63|128]+qt[t>>8&255]+"-"+qt[t>>16&255]+qt[t>>24&255]+qt[n&255]+qt[n>>8&255]+qt[n>>16&255]+qt[n>>24&255]).toLowerCase()}function tt(i,e,t){return Math.max(e,Math.min(t,i))}function Vc(i,e){return(i%e+e)%e}function gm(i,e,t,n,s){return n+(i-e)*(s-n)/(t-e)}function vm(i,e,t){return i!==e?(t-i)/(e-i):0}function xr(i,e,t){return(1-t)*i+t*e}function _m(i,e,t,n){return xr(i,e,1-Math.exp(-t*n))}function xm(i,e=1){return e-Math.abs(Vc(i,e*2)-e)}function Sm(i,e,t){return i<=e?0:i>=t?1:(i=(i-e)/(t-e),i*i*(3-2*i))}function Mm(i,e,t){return i<=e?0:i>=t?1:(i=(i-e)/(t-e),i*i*i*(i*(i*6-15)+10))}function ym(i,e){return i+Math.floor(Math.random()*(e-i+1))}function bm(i,e){return i+Math.random()*(e-i)}function Em(i){return i*(.5-Math.random())}function Tm(i){i!==void 0&&(Ph=i);let e=Ph+=1831565813;return e=Math.imul(e^e>>>15,e|1),e^=e+Math.imul(e^e>>>7,e|61),((e^e>>>14)>>>0)/4294967296}function Am(i){return i*_r}function wm(i){return i*Ls}function Cm(i){return(i&i-1)===0&&i!==0}function Rm(i){return Math.pow(2,Math.ceil(Math.log(i)/Math.LN2))}function Pm(i){return Math.pow(2,Math.floor(Math.log(i)/Math.LN2))}function Im(i,e,t,n,s){const r=Math.cos,a=Math.sin,o=r(t/2),l=a(t/2),c=r((e+n)/2),h=a((e+n)/2),f=r((e-n)/2),d=a((e-n)/2),u=r((n-e)/2),m=a((n-e)/2);switch(s){case"XYX":i.set(o*h,l*f,l*d,o*c);break;case"YZY":i.set(l*d,o*h,l*f,o*c);break;case"ZXZ":i.set(l*f,l*d,o*h,o*c);break;case"XZX":i.set(o*h,l*m,l*u,o*c);break;case"YXY":i.set(l*u,o*h,l*m,o*c);break;case"ZYZ":i.set(l*m,l*u,o*h,o*c);break;default:Ke("MathUtils: .setQuaternionFromProperEuler() encountered an unknown order: "+s)}}function Rn(i,e){switch(e.constructor){case Float32Array:return i;case Uint32Array:return i/4294967295;case Uint16Array:return i/65535;case Uint8Array:return i/255;case Int32Array:return Math.max(i/2147483647,-1);case Int16Array:return Math.max(i/32767,-1);case Int8Array:return Math.max(i/127,-1);default:throw new Error("THREE.MathUtils: Invalid component type.")}}function gt(i,e){switch(e.constructor){case Float32Array:return i;case Uint32Array:return Math.round(i*4294967295);case Uint16Array:return Math.round(i*65535);case Uint8Array:return Math.round(i*255);case Int32Array:return Math.round(i*2147483647);case Int16Array:return Math.round(i*32767);case Int8Array:return Math.round(i*127);default:throw new Error("THREE.MathUtils: Invalid component type.")}}const mt={DEG2RAD:_r,RAD2DEG:Ls,generateUUID:Hn,clamp:tt,euclideanModulo:Vc,mapLinear:gm,inverseLerp:vm,lerp:xr,damp:_m,pingpong:xm,smoothstep:Sm,smootherstep:Mm,randInt:ym,randFloat:bm,randFloatSpread:Em,seededRandom:Tm,degToRad:Am,radToDeg:wm,isPowerOfTwo:Cm,ceilPowerOfTwo:Rm,floorPowerOfTwo:Pm,setQuaternionFromProperEuler:Im,normalize:gt,denormalize:Rn};class fe{static{fe.prototype.isVector2=!0}constructor(e=0,t=0){this.x=e,this.y=t}get width(){return this.x}set width(e){this.x=e}get height(){return this.y}set height(e){this.y=e}set(e,t){return this.x=e,this.y=t,this}setScalar(e){return this.x=e,this.y=e,this}setX(e){return this.x=e,this}setY(e){return this.y=e,this}setComponent(e,t){switch(e){case 0:this.x=t;break;case 1:this.y=t;break;default:throw new Error("THREE.Vector2: index is out of range: "+e)}return this}getComponent(e){switch(e){case 0:return this.x;case 1:return this.y;default:throw new Error("THREE.Vector2: index is out of range: "+e)}}clone(){return new this.constructor(this.x,this.y)}copy(e){return this.x=e.x,this.y=e.y,this}add(e){return this.x+=e.x,this.y+=e.y,this}addScalar(e){return this.x+=e,this.y+=e,this}addVectors(e,t){return this.x=e.x+t.x,this.y=e.y+t.y,this}addScaledVector(e,t){return this.x+=e.x*t,this.y+=e.y*t,this}sub(e){return this.x-=e.x,this.y-=e.y,this}subScalar(e){return this.x-=e,this.y-=e,this}subVectors(e,t){return this.x=e.x-t.x,this.y=e.y-t.y,this}multiply(e){return this.x*=e.x,this.y*=e.y,this}multiplyScalar(e){return this.x*=e,this.y*=e,this}divide(e){return this.x/=e.x,this.y/=e.y,this}divideScalar(e){return this.multiplyScalar(1/e)}applyMatrix3(e){const t=this.x,n=this.y,s=e.elements;return this.x=s[0]*t+s[3]*n+s[6],this.y=s[1]*t+s[4]*n+s[7],this}min(e){return this.x=Math.min(this.x,e.x),this.y=Math.min(this.y,e.y),this}max(e){return this.x=Math.max(this.x,e.x),this.y=Math.max(this.y,e.y),this}clamp(e,t){return this.x=tt(this.x,e.x,t.x),this.y=tt(this.y,e.y,t.y),this}clampScalar(e,t){return this.x=tt(this.x,e,t),this.y=tt(this.y,e,t),this}clampLength(e,t){const n=this.length();return this.divideScalar(n||1).multiplyScalar(tt(n,e,t))}floor(){return this.x=Math.floor(this.x),this.y=Math.floor(this.y),this}ceil(){return this.x=Math.ceil(this.x),this.y=Math.ceil(this.y),this}round(){return this.x=Math.round(this.x),this.y=Math.round(this.y),this}roundToZero(){return this.x=Math.trunc(this.x),this.y=Math.trunc(this.y),this}negate(){return this.x=-this.x,this.y=-this.y,this}dot(e){return this.x*e.x+this.y*e.y}cross(e){return this.x*e.y-this.y*e.x}lengthSq(){return this.x*this.x+this.y*this.y}length(){return Math.sqrt(this.x*this.x+this.y*this.y)}manhattanLength(){return Math.abs(this.x)+Math.abs(this.y)}normalize(){return this.divideScalar(this.length()||1)}angle(){return Math.atan2(-this.y,-this.x)+Math.PI}angleTo(e){const t=Math.sqrt(this.lengthSq()*e.lengthSq());if(t===0)return Math.PI/2;const n=this.dot(e)/t;return Math.acos(tt(n,-1,1))}distanceTo(e){return Math.sqrt(this.distanceToSquared(e))}distanceToSquared(e){const t=this.x-e.x,n=this.y-e.y;return t*t+n*n}manhattanDistanceTo(e){return Math.abs(this.x-e.x)+Math.abs(this.y-e.y)}setLength(e){return this.normalize().multiplyScalar(e)}lerp(e,t){return this.x+=(e.x-this.x)*t,this.y+=(e.y-this.y)*t,this}lerpVectors(e,t,n){return this.x=e.x+(t.x-e.x)*n,this.y=e.y+(t.y-e.y)*n,this}equals(e){return e.x===this.x&&e.y===this.y}fromArray(e,t=0){return this.x=e[t],this.y=e[t+1],this}toArray(e=[],t=0){return e[t]=this.x,e[t+1]=this.y,e}fromBufferAttribute(e,t){return this.x=e.getX(t),this.y=e.getY(t),this}rotateAround(e,t){const n=Math.cos(t),s=Math.sin(t),r=this.x-e.x,a=this.y-e.y;return this.x=r*n-a*s+e.x,this.y=r*s+a*n+e.y,this}random(){return this.x=Math.random(),this.y=Math.random(),this}*[Symbol.iterator](){yield this.x,yield this.y}}class Vn{constructor(e=0,t=0,n=0,s=1){this.isQuaternion=!0,this._x=e,this._y=t,this._z=n,this._w=s}static slerpFlat(e,t,n,s,r,a,o){let l=n[s+0],c=n[s+1],h=n[s+2],f=n[s+3],d=r[a+0],u=r[a+1],m=r[a+2],x=r[a+3];if(f!==x||l!==d||c!==u||h!==m){let v=l*d+c*u+h*m+f*x;v<0&&(d=-d,u=-u,m=-m,x=-x,v=-v);let g=1-o;if(v<.9995){const y=Math.acos(v),E=Math.sin(y);g=Math.sin(g*y)/E,o=Math.sin(o*y)/E,l=l*g+d*o,c=c*g+u*o,h=h*g+m*o,f=f*g+x*o}else{l=l*g+d*o,c=c*g+u*o,h=h*g+m*o,f=f*g+x*o;const y=1/Math.sqrt(l*l+c*c+h*h+f*f);l*=y,c*=y,h*=y,f*=y}}e[t]=l,e[t+1]=c,e[t+2]=h,e[t+3]=f}static multiplyQuaternionsFlat(e,t,n,s,r,a){const o=n[s],l=n[s+1],c=n[s+2],h=n[s+3],f=r[a],d=r[a+1],u=r[a+2],m=r[a+3];return e[t]=o*m+h*f+l*u-c*d,e[t+1]=l*m+h*d+c*f-o*u,e[t+2]=c*m+h*u+o*d-l*f,e[t+3]=h*m-o*f-l*d-c*u,e}get x(){return this._x}set x(e){this._x=e,this._onChangeCallback()}get y(){return this._y}set y(e){this._y=e,this._onChangeCallback()}get z(){return this._z}set z(e){this._z=e,this._onChangeCallback()}get w(){return this._w}set w(e){this._w=e,this._onChangeCallback()}set(e,t,n,s){return this._x=e,this._y=t,this._z=n,this._w=s,this._onChangeCallback(),this}clone(){return new this.constructor(this._x,this._y,this._z,this._w)}copy(e){return this._x=e.x,this._y=e.y,this._z=e.z,this._w=e.w,this._onChangeCallback(),this}setFromEuler(e,t=!0){const n=e._x,s=e._y,r=e._z,a=e._order,o=Math.cos,l=Math.sin,c=o(n/2),h=o(s/2),f=o(r/2),d=l(n/2),u=l(s/2),m=l(r/2);switch(a){case"XYZ":this._x=d*h*f+c*u*m,this._y=c*u*f-d*h*m,this._z=c*h*m+d*u*f,this._w=c*h*f-d*u*m;break;case"YXZ":this._x=d*h*f+c*u*m,this._y=c*u*f-d*h*m,this._z=c*h*m-d*u*f,this._w=c*h*f+d*u*m;break;case"ZXY":this._x=d*h*f-c*u*m,this._y=c*u*f+d*h*m,this._z=c*h*m+d*u*f,this._w=c*h*f-d*u*m;break;case"ZYX":this._x=d*h*f-c*u*m,this._y=c*u*f+d*h*m,this._z=c*h*m-d*u*f,this._w=c*h*f+d*u*m;break;case"YZX":this._x=d*h*f+c*u*m,this._y=c*u*f+d*h*m,this._z=c*h*m-d*u*f,this._w=c*h*f-d*u*m;break;case"XZY":this._x=d*h*f-c*u*m,this._y=c*u*f-d*h*m,this._z=c*h*m+d*u*f,this._w=c*h*f+d*u*m;break;default:Ke("Quaternion: .setFromEuler() encountered an unknown order: "+a)}return t===!0&&this._onChangeCallback(),this}setFromAxisAngle(e,t){const n=t/2,s=Math.sin(n);return this._x=e.x*s,this._y=e.y*s,this._z=e.z*s,this._w=Math.cos(n),this._onChangeCallback(),this}setFromRotationMatrix(e){const t=e.elements,n=t[0],s=t[4],r=t[8],a=t[1],o=t[5],l=t[9],c=t[2],h=t[6],f=t[10],d=n+o+f;if(d>0){const u=.5/Math.sqrt(d+1);this._w=.25/u,this._x=(h-l)*u,this._y=(r-c)*u,this._z=(a-s)*u}else if(n>o&&n>f){const u=2*Math.sqrt(1+n-o-f);this._w=(h-l)/u,this._x=.25*u,this._y=(s+a)/u,this._z=(r+c)/u}else if(o>f){const u=2*Math.sqrt(1+o-n-f);this._w=(r-c)/u,this._x=(s+a)/u,this._y=.25*u,this._z=(l+h)/u}else{const u=2*Math.sqrt(1+f-n-o);this._w=(a-s)/u,this._x=(r+c)/u,this._y=(l+h)/u,this._z=.25*u}return this._onChangeCallback(),this}setFromUnitVectors(e,t){let n=e.dot(t)+1;return n<1e-8?(n=0,Math.abs(e.x)>Math.abs(e.z)?(this._x=-e.y,this._y=e.x,this._z=0,this._w=n):(this._x=0,this._y=-e.z,this._z=e.y,this._w=n)):(this._x=e.y*t.z-e.z*t.y,this._y=e.z*t.x-e.x*t.z,this._z=e.x*t.y-e.y*t.x,this._w=n),this.normalize()}angleTo(e){return 2*Math.acos(Math.abs(tt(this.dot(e),-1,1)))}rotateTowards(e,t){const n=this.angleTo(e);if(n===0)return this;const s=Math.min(1,t/n);return this.slerp(e,s),this}identity(){return this.set(0,0,0,1)}invert(){return this.conjugate()}conjugate(){return this._x*=-1,this._y*=-1,this._z*=-1,this._onChangeCallback(),this}dot(e){return this._x*e._x+this._y*e._y+this._z*e._z+this._w*e._w}lengthSq(){return this._x*this._x+this._y*this._y+this._z*this._z+this._w*this._w}length(){return Math.sqrt(this._x*this._x+this._y*this._y+this._z*this._z+this._w*this._w)}normalize(){let e=this.length();return e===0?(this._x=0,this._y=0,this._z=0,this._w=1):(e=1/e,this._x=this._x*e,this._y=this._y*e,this._z=this._z*e,this._w=this._w*e),this._onChangeCallback(),this}multiply(e){return this.multiplyQuaternions(this,e)}premultiply(e){return this.multiplyQuaternions(e,this)}multiplyQuaternions(e,t){const n=e._x,s=e._y,r=e._z,a=e._w,o=t._x,l=t._y,c=t._z,h=t._w;return this._x=n*h+a*o+s*c-r*l,this._y=s*h+a*l+r*o-n*c,this._z=r*h+a*c+n*l-s*o,this._w=a*h-n*o-s*l-r*c,this._onChangeCallback(),this}slerp(e,t){let n=e._x,s=e._y,r=e._z,a=e._w,o=this.dot(e);o<0&&(n=-n,s=-s,r=-r,a=-a,o=-o);let l=1-t;if(o<.9995){const c=Math.acos(o),h=Math.sin(c);l=Math.sin(l*c)/h,t=Math.sin(t*c)/h,this._x=this._x*l+n*t,this._y=this._y*l+s*t,this._z=this._z*l+r*t,this._w=this._w*l+a*t,this._onChangeCallback()}else this._x=this._x*l+n*t,this._y=this._y*l+s*t,this._z=this._z*l+r*t,this._w=this._w*l+a*t,this.normalize();return this}slerpQuaternions(e,t,n){return this.copy(e).slerp(t,n)}random(){const e=2*Math.PI*Math.random(),t=2*Math.PI*Math.random(),n=Math.random(),s=Math.sqrt(1-n),r=Math.sqrt(n);return this.set(s*Math.sin(e),s*Math.cos(e),r*Math.sin(t),r*Math.cos(t))}equals(e){return e._x===this._x&&e._y===this._y&&e._z===this._z&&e._w===this._w}fromArray(e,t=0){return this._x=e[t],this._y=e[t+1],this._z=e[t+2],this._w=e[t+3],this._onChangeCallback(),this}toArray(e=[],t=0){return e[t]=this._x,e[t+1]=this._y,e[t+2]=this._z,e[t+3]=this._w,e}fromBufferAttribute(e,t){return this._x=e.getX(t),this._y=e.getY(t),this._z=e.getZ(t),this._w=e.getW(t),this._onChangeCallback(),this}toJSON(){return this.toArray()}_onChange(e){return this._onChangeCallback=e,this}_onChangeCallback(){}*[Symbol.iterator](){yield this._x,yield this._y,yield this._z,yield this._w}}class N{static{N.prototype.isVector3=!0}constructor(e=0,t=0,n=0){this.x=e,this.y=t,this.z=n}set(e,t,n){return n===void 0&&(n=this.z),this.x=e,this.y=t,this.z=n,this}setScalar(e){return this.x=e,this.y=e,this.z=e,this}setX(e){return this.x=e,this}setY(e){return this.y=e,this}setZ(e){return this.z=e,this}setComponent(e,t){switch(e){case 0:this.x=t;break;case 1:this.y=t;break;case 2:this.z=t;break;default:throw new Error("THREE.Vector3: index is out of range: "+e)}return this}getComponent(e){switch(e){case 0:return this.x;case 1:return this.y;case 2:return this.z;default:throw new Error("THREE.Vector3: index is out of range: "+e)}}clone(){return new this.constructor(this.x,this.y,this.z)}copy(e){return this.x=e.x,this.y=e.y,this.z=e.z,this}add(e){return this.x+=e.x,this.y+=e.y,this.z+=e.z,this}addScalar(e){return this.x+=e,this.y+=e,this.z+=e,this}addVectors(e,t){return this.x=e.x+t.x,this.y=e.y+t.y,this.z=e.z+t.z,this}addScaledVector(e,t){return this.x+=e.x*t,this.y+=e.y*t,this.z+=e.z*t,this}sub(e){return this.x-=e.x,this.y-=e.y,this.z-=e.z,this}subScalar(e){return this.x-=e,this.y-=e,this.z-=e,this}subVectors(e,t){return this.x=e.x-t.x,this.y=e.y-t.y,this.z=e.z-t.z,this}multiply(e){return this.x*=e.x,this.y*=e.y,this.z*=e.z,this}multiplyScalar(e){return this.x*=e,this.y*=e,this.z*=e,this}multiplyVectors(e,t){return this.x=e.x*t.x,this.y=e.y*t.y,this.z=e.z*t.z,this}applyEuler(e){return this.applyQuaternion(Ih.setFromEuler(e))}applyAxisAngle(e,t){return this.applyQuaternion(Ih.setFromAxisAngle(e,t))}applyMatrix3(e){const t=this.x,n=this.y,s=this.z,r=e.elements;return this.x=r[0]*t+r[3]*n+r[6]*s,this.y=r[1]*t+r[4]*n+r[7]*s,this.z=r[2]*t+r[5]*n+r[8]*s,this}applyNormalMatrix(e){return this.applyMatrix3(e).normalize()}applyMatrix4(e){const t=this.x,n=this.y,s=this.z,r=e.elements,a=1/(r[3]*t+r[7]*n+r[11]*s+r[15]);return this.x=(r[0]*t+r[4]*n+r[8]*s+r[12])*a,this.y=(r[1]*t+r[5]*n+r[9]*s+r[13])*a,this.z=(r[2]*t+r[6]*n+r[10]*s+r[14])*a,this}applyQuaternion(e){const t=this.x,n=this.y,s=this.z,r=e.x,a=e.y,o=e.z,l=e.w,c=2*(a*s-o*n),h=2*(o*t-r*s),f=2*(r*n-a*t);return this.x=t+l*c+a*f-o*h,this.y=n+l*h+o*c-r*f,this.z=s+l*f+r*h-a*c,this}project(e){return this.applyMatrix4(e.matrixWorldInverse).applyMatrix4(e.projectionMatrix)}unproject(e){return this.applyMatrix4(e.projectionMatrixInverse).applyMatrix4(e.matrixWorld)}transformDirection(e){const t=this.x,n=this.y,s=this.z,r=e.elements;return this.x=r[0]*t+r[4]*n+r[8]*s,this.y=r[1]*t+r[5]*n+r[9]*s,this.z=r[2]*t+r[6]*n+r[10]*s,this.normalize()}divide(e){return this.x/=e.x,this.y/=e.y,this.z/=e.z,this}divideScalar(e){return this.multiplyScalar(1/e)}min(e){return this.x=Math.min(this.x,e.x),this.y=Math.min(this.y,e.y),this.z=Math.min(this.z,e.z),this}max(e){return this.x=Math.max(this.x,e.x),this.y=Math.max(this.y,e.y),this.z=Math.max(this.z,e.z),this}clamp(e,t){return this.x=tt(this.x,e.x,t.x),this.y=tt(this.y,e.y,t.y),this.z=tt(this.z,e.z,t.z),this}clampScalar(e,t){return this.x=tt(this.x,e,t),this.y=tt(this.y,e,t),this.z=tt(this.z,e,t),this}clampLength(e,t){const n=this.length();return this.divideScalar(n||1).multiplyScalar(tt(n,e,t))}floor(){return this.x=Math.floor(this.x),this.y=Math.floor(this.y),this.z=Math.floor(this.z),this}ceil(){return this.x=Math.ceil(this.x),this.y=Math.ceil(this.y),this.z=Math.ceil(this.z),this}round(){return this.x=Math.round(this.x),this.y=Math.round(this.y),this.z=Math.round(this.z),this}roundToZero(){return this.x=Math.trunc(this.x),this.y=Math.trunc(this.y),this.z=Math.trunc(this.z),this}negate(){return this.x=-this.x,this.y=-this.y,this.z=-this.z,this}dot(e){return this.x*e.x+this.y*e.y+this.z*e.z}lengthSq(){return this.x*this.x+this.y*this.y+this.z*this.z}length(){return Math.sqrt(this.x*this.x+this.y*this.y+this.z*this.z)}manhattanLength(){return Math.abs(this.x)+Math.abs(this.y)+Math.abs(this.z)}normalize(){return this.divideScalar(this.length()||1)}setLength(e){return this.normalize().multiplyScalar(e)}lerp(e,t){return this.x+=(e.x-this.x)*t,this.y+=(e.y-this.y)*t,this.z+=(e.z-this.z)*t,this}lerpVectors(e,t,n){return this.x=e.x+(t.x-e.x)*n,this.y=e.y+(t.y-e.y)*n,this.z=e.z+(t.z-e.z)*n,this}cross(e){return this.crossVectors(this,e)}crossVectors(e,t){const n=e.x,s=e.y,r=e.z,a=t.x,o=t.y,l=t.z;return this.x=s*l-r*o,this.y=r*a-n*l,this.z=n*o-s*a,this}projectOnVector(e){const t=e.lengthSq();if(t===0)return this.set(0,0,0);const n=e.dot(this)/t;return this.copy(e).multiplyScalar(n)}projectOnPlane(e){return _o.copy(this).projectOnVector(e),this.sub(_o)}reflect(e){return this.sub(_o.copy(e).multiplyScalar(2*this.dot(e)))}angleTo(e){const t=Math.sqrt(this.lengthSq()*e.lengthSq());if(t===0)return Math.PI/2;const n=this.dot(e)/t;return Math.acos(tt(n,-1,1))}distanceTo(e){return Math.sqrt(this.distanceToSquared(e))}distanceToSquared(e){const t=this.x-e.x,n=this.y-e.y,s=this.z-e.z;return t*t+n*n+s*s}manhattanDistanceTo(e){return Math.abs(this.x-e.x)+Math.abs(this.y-e.y)+Math.abs(this.z-e.z)}setFromSpherical(e){return this.setFromSphericalCoords(e.radius,e.phi,e.theta)}setFromSphericalCoords(e,t,n){const s=Math.sin(t)*e;return this.x=s*Math.sin(n),this.y=Math.cos(t)*e,this.z=s*Math.cos(n),this}setFromCylindrical(e){return this.setFromCylindricalCoords(e.radius,e.theta,e.y)}setFromCylindricalCoords(e,t,n){return this.x=e*Math.sin(t),this.y=n,this.z=e*Math.cos(t),this}setFromMatrixPosition(e){const t=e.elements;return this.x=t[12],this.y=t[13],this.z=t[14],this}setFromMatrixScale(e){const t=this.setFromMatrixColumn(e,0).length(),n=this.setFromMatrixColumn(e,1).length(),s=this.setFromMatrixColumn(e,2).length();return this.x=t,this.y=n,this.z=s,this}setFromMatrixColumn(e,t){return this.fromArray(e.elements,t*4)}setFromMatrix3Column(e,t){return this.fromArray(e.elements,t*3)}setFromEuler(e){return this.x=e._x,this.y=e._y,this.z=e._z,this}setFromColor(e){return this.x=e.r,this.y=e.g,this.z=e.b,this}equals(e){return e.x===this.x&&e.y===this.y&&e.z===this.z}fromArray(e,t=0){return this.x=e[t],this.y=e[t+1],this.z=e[t+2],this}toArray(e=[],t=0){return e[t]=this.x,e[t+1]=this.y,e[t+2]=this.z,e}fromBufferAttribute(e,t){return this.x=e.getX(t),this.y=e.getY(t),this.z=e.getZ(t),this}random(){return this.x=Math.random(),this.y=Math.random(),this.z=Math.random(),this}randomDirection(){const e=Math.random()*Math.PI*2,t=Math.random()*2-1,n=Math.sqrt(1-t*t);return this.x=n*Math.cos(e),this.y=t,this.z=n*Math.sin(e),this}*[Symbol.iterator](){yield this.x,yield this.y,yield this.z}}const _o=new N,Ih=new Vn;class Je{static{Je.prototype.isMatrix3=!0}constructor(e,t,n,s,r,a,o,l,c){this.elements=[1,0,0,0,1,0,0,0,1],e!==void 0&&this.set(e,t,n,s,r,a,o,l,c)}set(e,t,n,s,r,a,o,l,c){const h=this.elements;return h[0]=e,h[1]=s,h[2]=o,h[3]=t,h[4]=r,h[5]=l,h[6]=n,h[7]=a,h[8]=c,this}identity(){return this.set(1,0,0,0,1,0,0,0,1),this}copy(e){const t=this.elements,n=e.elements;return t[0]=n[0],t[1]=n[1],t[2]=n[2],t[3]=n[3],t[4]=n[4],t[5]=n[5],t[6]=n[6],t[7]=n[7],t[8]=n[8],this}extractBasis(e,t,n){return e.setFromMatrix3Column(this,0),t.setFromMatrix3Column(this,1),n.setFromMatrix3Column(this,2),this}setFromMatrix4(e){const t=e.elements;return this.set(t[0],t[4],t[8],t[1],t[5],t[9],t[2],t[6],t[10]),this}multiply(e){return this.multiplyMatrices(this,e)}premultiply(e){return this.multiplyMatrices(e,this)}multiplyMatrices(e,t){const n=e.elements,s=t.elements,r=this.elements,a=n[0],o=n[3],l=n[6],c=n[1],h=n[4],f=n[7],d=n[2],u=n[5],m=n[8],x=s[0],v=s[3],g=s[6],y=s[1],E=s[4],M=s[7],T=s[2],w=s[5],R=s[8];return r[0]=a*x+o*y+l*T,r[3]=a*v+o*E+l*w,r[6]=a*g+o*M+l*R,r[1]=c*x+h*y+f*T,r[4]=c*v+h*E+f*w,r[7]=c*g+h*M+f*R,r[2]=d*x+u*y+m*T,r[5]=d*v+u*E+m*w,r[8]=d*g+u*M+m*R,this}multiplyScalar(e){const t=this.elements;return t[0]*=e,t[3]*=e,t[6]*=e,t[1]*=e,t[4]*=e,t[7]*=e,t[2]*=e,t[5]*=e,t[8]*=e,this}determinant(){const e=this.elements,t=e[0],n=e[1],s=e[2],r=e[3],a=e[4],o=e[5],l=e[6],c=e[7],h=e[8];return t*a*h-t*o*c-n*r*h+n*o*l+s*r*c-s*a*l}invert(){const e=this.elements,t=e[0],n=e[1],s=e[2],r=e[3],a=e[4],o=e[5],l=e[6],c=e[7],h=e[8],f=h*a-o*c,d=o*l-h*r,u=c*r-a*l,m=t*f+n*d+s*u;if(m===0)return this.set(0,0,0,0,0,0,0,0,0);const x=1/m;return e[0]=f*x,e[1]=(s*c-h*n)*x,e[2]=(o*n-s*a)*x,e[3]=d*x,e[4]=(h*t-s*l)*x,e[5]=(s*r-o*t)*x,e[6]=u*x,e[7]=(n*l-c*t)*x,e[8]=(a*t-n*r)*x,this}transpose(){let e;const t=this.elements;return e=t[1],t[1]=t[3],t[3]=e,e=t[2],t[2]=t[6],t[6]=e,e=t[5],t[5]=t[7],t[7]=e,this}getNormalMatrix(e){return this.setFromMatrix4(e).invert().transpose()}transposeIntoArray(e){const t=this.elements;return e[0]=t[0],e[1]=t[3],e[2]=t[6],e[3]=t[1],e[4]=t[4],e[5]=t[7],e[6]=t[2],e[7]=t[5],e[8]=t[8],this}setUvTransform(e,t,n,s,r,a,o){const l=Math.cos(r),c=Math.sin(r);return this.set(n*l,n*c,-n*(l*a+c*o)+a+e,-s*c,s*l,-s*(-c*a+l*o)+o+t,0,0,1),this}scale(e,t){return Cs("Matrix3: .scale() is deprecated. Use .makeScale() instead."),this.premultiply(xo.makeScale(e,t)),this}rotate(e){return Cs("Matrix3: .rotate() is deprecated. Use .makeRotation() instead."),this.premultiply(xo.makeRotation(-e)),this}translate(e,t){return Cs("Matrix3: .translate() is deprecated. Use .makeTranslation() instead."),this.premultiply(xo.makeTranslation(e,t)),this}makeTranslation(e,t){return e.isVector2?this.set(1,0,e.x,0,1,e.y,0,0,1):this.set(1,0,e,0,1,t,0,0,1),this}makeRotation(e){const t=Math.cos(e),n=Math.sin(e);return this.set(t,-n,0,n,t,0,0,0,1),this}makeScale(e,t){return this.set(e,0,0,0,t,0,0,0,1),this}equals(e){const t=this.elements,n=e.elements;for(let s=0;s<9;s++)if(t[s]!==n[s])return!1;return!0}fromArray(e,t=0){for(let n=0;n<9;n++)this.elements[n]=e[n+t];return this}toArray(e=[],t=0){const n=this.elements;return e[t]=n[0],e[t+1]=n[1],e[t+2]=n[2],e[t+3]=n[3],e[t+4]=n[4],e[t+5]=n[5],e[t+6]=n[6],e[t+7]=n[7],e[t+8]=n[8],e}clone(){return new this.constructor().fromArray(this.elements)}}const xo=new Je,Lh=new Je().set(.4123908,.3575843,.1804808,.212639,.7151687,.0721923,.0193308,.1191948,.9505322),Dh=new Je().set(3.2409699,-1.5373832,-.4986108,-.9692436,1.8759675,.0415551,.0556301,-.203977,1.0569715);function Lm(){const i={enabled:!0,workingColorSpace:Oa,spaces:{},convert:function(s,r,a){return this.enabled===!1||r===a||!r||!a||(this.spaces[r].transfer===pt&&(s.r=ai(s.r),s.g=ai(s.g),s.b=ai(s.b)),this.spaces[r].primaries!==this.spaces[a].primaries&&(s.applyMatrix3(this.spaces[r].toXYZ),s.applyMatrix3(this.spaces[a].fromXYZ)),this.spaces[a].transfer===pt&&(s.r=Rs(s.r),s.g=Rs(s.g),s.b=Rs(s.b))),s},workingToColorSpace:function(s,r){return this.convert(s,this.workingColorSpace,r)},colorSpaceToWorking:function(s,r){return this.convert(s,r,this.workingColorSpace)},getPrimaries:function(s){return this.spaces[s].primaries},getTransfer:function(s){return s===Mi?Ba:this.spaces[s].transfer},getToneMappingMode:function(s){return this.spaces[s].outputColorSpaceConfig.toneMappingMode||"standard"},getLuminanceCoefficients:function(s,r=this.workingColorSpace){return s.fromArray(this.spaces[r].luminanceCoefficients)},define:function(s){Object.assign(this.spaces,s)},_getMatrix:function(s,r,a){return s.copy(this.spaces[r].toXYZ).multiply(this.spaces[a].fromXYZ)},_getDrawingBufferColorSpace:function(s){return this.spaces[s].outputColorSpaceConfig.drawingBufferColorSpace},_getUnpackColorSpace:function(s=this.workingColorSpace){return this.spaces[s].workingColorSpaceConfig.unpackColorSpace},fromWorkingColorSpace:function(s,r){return Cs("ColorManagement: .fromWorkingColorSpace() has been renamed to .workingToColorSpace()."),i.workingToColorSpace(s,r)},toWorkingColorSpace:function(s,r){return Cs("ColorManagement: .toWorkingColorSpace() has been renamed to .colorSpaceToWorking()."),i.colorSpaceToWorking(s,r)}},e=[.64,.33,.3,.6,.15,.06],t=[.2126,.7152,.0722],n=[.3127,.329];return i.define({[Oa]:{primaries:e,whitePoint:n,transfer:Ba,toXYZ:Lh,fromXYZ:Dh,luminanceCoefficients:t,workingColorSpaceConfig:{unpackColorSpace:kt},outputColorSpaceConfig:{drawingBufferColorSpace:kt}},[kt]:{primaries:e,whitePoint:n,transfer:pt,toXYZ:Lh,fromXYZ:Dh,luminanceCoefficients:t,outputColorSpaceConfig:{drawingBufferColorSpace:kt}}}),i}const st=Lm();function ai(i){return i<.04045?i*.0773993808:Math.pow(i*.9478672986+.0521327014,2.4)}function Rs(i){return i<.0031308?i*12.92:1.055*Math.pow(i,.41666)-.055}let is;class Dm{static getDataURL(e,t="image/png"){if(/^data:/i.test(e.src)||typeof HTMLCanvasElement>"u")return e.src;let n;if(e instanceof HTMLCanvasElement)n=e;else{is===void 0&&(is=wr("canvas")),is.width=e.width,is.height=e.height;const s=is.getContext("2d");e instanceof ImageData?s.putImageData(e,0,0):s.drawImage(e,0,0,e.width,e.height),n=is}return n.toDataURL(t)}static sRGBToLinear(e){if(typeof HTMLImageElement<"u"&&e instanceof HTMLImageElement||typeof HTMLCanvasElement<"u"&&e instanceof HTMLCanvasElement||typeof ImageBitmap<"u"&&e instanceof ImageBitmap){const t=wr("canvas");t.width=e.width,t.height=e.height;const n=t.getContext("2d");n.drawImage(e,0,0,e.width,e.height);const s=n.getImageData(0,0,e.width,e.height),r=s.data;for(let a=0;a<r.length;a++)r[a]=ai(r[a]/255)*255;return n.putImageData(s,0,0),t}else if(e.data){const t=e.data.slice(0);for(let n=0;n<t.length;n++)t instanceof Uint8Array||t instanceof Uint8ClampedArray?t[n]=Math.floor(ai(t[n]/255)*255):t[n]=ai(t[n]);return{data:t,width:e.width,height:e.height}}else return Ke("ImageUtils.sRGBToLinear(): Unsupported image type. No color space conversion applied."),e}}let Nm=0;class Wc{constructor(e=null){this.isSource=!0,Object.defineProperty(this,"id",{value:Nm++}),this.uuid=Hn(),this.data=e,this.dataReady=!0,this.version=0}getSize(e){const t=this.data;return typeof HTMLVideoElement<"u"&&t instanceof HTMLVideoElement?e.set(t.videoWidth,t.videoHeight,0):typeof VideoFrame<"u"&&t instanceof VideoFrame?e.set(t.displayWidth,t.displayHeight,0):t!==null?e.set(t.width,t.height,t.depth||0):e.set(0,0,0),e}set needsUpdate(e){e===!0&&this.version++}toJSON(e){const t=e===void 0||typeof e=="string";if(!t&&e.images[this.uuid]!==void 0)return e.images[this.uuid];const n={uuid:this.uuid,url:""},s=this.data;if(s!==null){let r;if(Array.isArray(s)){r=[];for(let a=0,o=s.length;a<o;a++)s[a].isDataTexture?r.push(So(s[a].image)):r.push(So(s[a]))}else r=So(s);n.url=r}return t||(e.images[this.uuid]=n),n}}function So(i){return typeof HTMLImageElement<"u"&&i instanceof HTMLImageElement||typeof HTMLCanvasElement<"u"&&i instanceof HTMLCanvasElement||typeof ImageBitmap<"u"&&i instanceof ImageBitmap?Dm.getDataURL(i):i.data?{data:Array.from(i.data),width:i.width,height:i.height,type:i.data.constructor.name}:(Ke("Texture: Unable to serialize Texture."),{})}let Um=0;const Mo=new N;class Wt extends Ki{constructor(e=Wt.DEFAULT_IMAGE,t=Wt.DEFAULT_MAPPING,n=Pn,s=Pn,r=Ft,a=ri,o=Ln,l=un,c=Wt.DEFAULT_ANISOTROPY,h=Mi){super(),this.isTexture=!0,Object.defineProperty(this,"id",{value:Um++}),this.uuid=Hn(),this.name="",this.source=new Wc(e),this.mipmaps=[],this.mapping=t,this.channel=0,this.wrapS=n,this.wrapT=s,this.magFilter=r,this.minFilter=a,this.anisotropy=c,this.format=o,this.internalFormat=null,this.type=l,this.offset=new fe(0,0),this.repeat=new fe(1,1),this.center=new fe(0,0),this.rotation=0,this.matrixAutoUpdate=!0,this.matrix=new Je,this.generateMipmaps=!0,this.premultiplyAlpha=!1,this.flipY=!0,this.unpackAlignment=4,this.colorSpace=h,this.userData={},this.updateRanges=[],this.version=0,this.onUpdate=null,this.renderTarget=null,this.isRenderTargetTexture=!1,this.isArrayTexture=!!(e&&e.depth&&e.depth>1),this.pmremVersion=0,this.normalized=!1}get width(){return this.source.getSize(Mo).x}get height(){return this.source.getSize(Mo).y}get depth(){return this.source.getSize(Mo).z}get image(){return this.source.data}set image(e){this.source.data=e}updateMatrix(){this.matrix.setUvTransform(this.offset.x,this.offset.y,this.repeat.x,this.repeat.y,this.rotation,this.center.x,this.center.y)}addUpdateRange(e,t){this.updateRanges.push({start:e,count:t})}clearUpdateRanges(){this.updateRanges.length=0}clone(){return new this.constructor().copy(this)}copy(e){return this.name=e.name,this.source=e.source,this.mipmaps=e.mipmaps.slice(0),this.mapping=e.mapping,this.channel=e.channel,this.wrapS=e.wrapS,this.wrapT=e.wrapT,this.magFilter=e.magFilter,this.minFilter=e.minFilter,this.anisotropy=e.anisotropy,this.format=e.format,this.internalFormat=e.internalFormat,this.type=e.type,this.normalized=e.normalized,this.offset.copy(e.offset),this.repeat.copy(e.repeat),this.center.copy(e.center),this.rotation=e.rotation,this.matrixAutoUpdate=e.matrixAutoUpdate,this.matrix.copy(e.matrix),this.generateMipmaps=e.generateMipmaps,this.premultiplyAlpha=e.premultiplyAlpha,this.flipY=e.flipY,this.unpackAlignment=e.unpackAlignment,this.colorSpace=e.colorSpace,this.renderTarget=e.renderTarget,this.isRenderTargetTexture=e.isRenderTargetTexture,this.isArrayTexture=e.isArrayTexture,this.userData=JSON.parse(JSON.stringify(e.userData)),this.needsUpdate=!0,this}setValues(e){for(const t in e){const n=e[t];if(n===void 0){Ke(`Texture.setValues(): parameter '${t}' has value of undefined.`);continue}const s=this[t];if(s===void 0){Ke(`Texture.setValues(): property '${t}' does not exist.`);continue}s&&n&&s.isVector2&&n.isVector2||s&&n&&s.isVector3&&n.isVector3||s&&n&&s.isMatrix3&&n.isMatrix3?s.copy(n):this[t]=n}}toJSON(e){const t=e===void 0||typeof e=="string";if(!t&&e.textures[this.uuid]!==void 0)return e.textures[this.uuid];const n={metadata:{version:4.7,type:"Texture",generator:"Texture.toJSON"},uuid:this.uuid,name:this.name,image:this.source.toJSON(e).uuid,mapping:this.mapping,channel:this.channel,repeat:[this.repeat.x,this.repeat.y],offset:[this.offset.x,this.offset.y],center:[this.center.x,this.center.y],rotation:this.rotation,wrap:[this.wrapS,this.wrapT],format:this.format,internalFormat:this.internalFormat,type:this.type,normalized:this.normalized,colorSpace:this.colorSpace,minFilter:this.minFilter,magFilter:this.magFilter,anisotropy:this.anisotropy,flipY:this.flipY,generateMipmaps:this.generateMipmaps,premultiplyAlpha:this.premultiplyAlpha,unpackAlignment:this.unpackAlignment};return Object.keys(this.userData).length>0&&(n.userData=this.userData),t||(e.textures[this.uuid]=n),n}dispose(){this.dispatchEvent({type:"dispose"})}transformUv(e){if(this.mapping!==ud)return e;if(e.applyMatrix3(this.matrix),e.x<0||e.x>1)switch(this.wrapS){case Sl:e.x=e.x-Math.floor(e.x);break;case Pn:e.x=e.x<0?0:1;break;case Ml:Math.abs(Math.floor(e.x)%2)===1?e.x=Math.ceil(e.x)-e.x:e.x=e.x-Math.floor(e.x);break}if(e.y<0||e.y>1)switch(this.wrapT){case Sl:e.y=e.y-Math.floor(e.y);break;case Pn:e.y=e.y<0?0:1;break;case Ml:Math.abs(Math.floor(e.y)%2)===1?e.y=Math.ceil(e.y)-e.y:e.y=e.y-Math.floor(e.y);break}return this.flipY&&(e.y=1-e.y),e}set needsUpdate(e){e===!0&&(this.version++,this.source.needsUpdate=!0)}set needsPMREMUpdate(e){e===!0&&this.pmremVersion++}}Wt.DEFAULT_IMAGE=null;Wt.DEFAULT_MAPPING=ud;Wt.DEFAULT_ANISOTROPY=1;class Rt{static{Rt.prototype.isVector4=!0}constructor(e=0,t=0,n=0,s=1){this.x=e,this.y=t,this.z=n,this.w=s}get width(){return this.z}set width(e){this.z=e}get height(){return this.w}set height(e){this.w=e}set(e,t,n,s){return this.x=e,this.y=t,this.z=n,this.w=s,this}setScalar(e){return this.x=e,this.y=e,this.z=e,this.w=e,this}setX(e){return this.x=e,this}setY(e){return this.y=e,this}setZ(e){return this.z=e,this}setW(e){return this.w=e,this}setComponent(e,t){switch(e){case 0:this.x=t;break;case 1:this.y=t;break;case 2:this.z=t;break;case 3:this.w=t;break;default:throw new Error("THREE.Vector4: index is out of range: "+e)}return this}getComponent(e){switch(e){case 0:return this.x;case 1:return this.y;case 2:return this.z;case 3:return this.w;default:throw new Error("THREE.Vector4: index is out of range: "+e)}}clone(){return new this.constructor(this.x,this.y,this.z,this.w)}copy(e){return this.x=e.x,this.y=e.y,this.z=e.z,this.w=e.w!==void 0?e.w:1,this}add(e){return this.x+=e.x,this.y+=e.y,this.z+=e.z,this.w+=e.w,this}addScalar(e){return this.x+=e,this.y+=e,this.z+=e,this.w+=e,this}addVectors(e,t){return this.x=e.x+t.x,this.y=e.y+t.y,this.z=e.z+t.z,this.w=e.w+t.w,this}addScaledVector(e,t){return this.x+=e.x*t,this.y+=e.y*t,this.z+=e.z*t,this.w+=e.w*t,this}sub(e){return this.x-=e.x,this.y-=e.y,this.z-=e.z,this.w-=e.w,this}subScalar(e){return this.x-=e,this.y-=e,this.z-=e,this.w-=e,this}subVectors(e,t){return this.x=e.x-t.x,this.y=e.y-t.y,this.z=e.z-t.z,this.w=e.w-t.w,this}multiply(e){return this.x*=e.x,this.y*=e.y,this.z*=e.z,this.w*=e.w,this}multiplyScalar(e){return this.x*=e,this.y*=e,this.z*=e,this.w*=e,this}applyMatrix4(e){const t=this.x,n=this.y,s=this.z,r=this.w,a=e.elements;return this.x=a[0]*t+a[4]*n+a[8]*s+a[12]*r,this.y=a[1]*t+a[5]*n+a[9]*s+a[13]*r,this.z=a[2]*t+a[6]*n+a[10]*s+a[14]*r,this.w=a[3]*t+a[7]*n+a[11]*s+a[15]*r,this}divide(e){return this.x/=e.x,this.y/=e.y,this.z/=e.z,this.w/=e.w,this}divideScalar(e){return this.multiplyScalar(1/e)}setAxisAngleFromQuaternion(e){this.w=2*Math.acos(e.w);const t=Math.sqrt(1-e.w*e.w);return t<1e-4?(this.x=1,this.y=0,this.z=0):(this.x=e.x/t,this.y=e.y/t,this.z=e.z/t),this}setAxisAngleFromRotationMatrix(e){let t,n,s,r;const l=e.elements,c=l[0],h=l[4],f=l[8],d=l[1],u=l[5],m=l[9],x=l[2],v=l[6],g=l[10];if(Math.abs(h-d)<.01&&Math.abs(f-x)<.01&&Math.abs(m-v)<.01){if(Math.abs(h+d)<.1&&Math.abs(f+x)<.1&&Math.abs(m+v)<.1&&Math.abs(c+u+g-3)<.1)return this.set(1,0,0,0),this;t=Math.PI;const E=(c+1)/2,M=(u+1)/2,T=(g+1)/2,w=(h+d)/4,R=(f+x)/4,_=(m+v)/4;return E>M&&E>T?E<.01?(n=0,s=.707106781,r=.707106781):(n=Math.sqrt(E),s=w/n,r=R/n):M>T?M<.01?(n=.707106781,s=0,r=.707106781):(s=Math.sqrt(M),n=w/s,r=_/s):T<.01?(n=.707106781,s=.707106781,r=0):(r=Math.sqrt(T),n=R/r,s=_/r),this.set(n,s,r,t),this}let y=Math.sqrt((v-m)*(v-m)+(f-x)*(f-x)+(d-h)*(d-h));return Math.abs(y)<.001&&(y=1),this.x=(v-m)/y,this.y=(f-x)/y,this.z=(d-h)/y,this.w=Math.acos((c+u+g-1)/2),this}setFromMatrixPosition(e){const t=e.elements;return this.x=t[12],this.y=t[13],this.z=t[14],this.w=t[15],this}min(e){return this.x=Math.min(this.x,e.x),this.y=Math.min(this.y,e.y),this.z=Math.min(this.z,e.z),this.w=Math.min(this.w,e.w),this}max(e){return this.x=Math.max(this.x,e.x),this.y=Math.max(this.y,e.y),this.z=Math.max(this.z,e.z),this.w=Math.max(this.w,e.w),this}clamp(e,t){return this.x=tt(this.x,e.x,t.x),this.y=tt(this.y,e.y,t.y),this.z=tt(this.z,e.z,t.z),this.w=tt(this.w,e.w,t.w),this}clampScalar(e,t){return this.x=tt(this.x,e,t),this.y=tt(this.y,e,t),this.z=tt(this.z,e,t),this.w=tt(this.w,e,t),this}clampLength(e,t){const n=this.length();return this.divideScalar(n||1).multiplyScalar(tt(n,e,t))}floor(){return this.x=Math.floor(this.x),this.y=Math.floor(this.y),this.z=Math.floor(this.z),this.w=Math.floor(this.w),this}ceil(){return this.x=Math.ceil(this.x),this.y=Math.ceil(this.y),this.z=Math.ceil(this.z),this.w=Math.ceil(this.w),this}round(){return this.x=Math.round(this.x),this.y=Math.round(this.y),this.z=Math.round(this.z),this.w=Math.round(this.w),this}roundToZero(){return this.x=Math.trunc(this.x),this.y=Math.trunc(this.y),this.z=Math.trunc(this.z),this.w=Math.trunc(this.w),this}negate(){return this.x=-this.x,this.y=-this.y,this.z=-this.z,this.w=-this.w,this}dot(e){return this.x*e.x+this.y*e.y+this.z*e.z+this.w*e.w}lengthSq(){return this.x*this.x+this.y*this.y+this.z*this.z+this.w*this.w}length(){return Math.sqrt(this.x*this.x+this.y*this.y+this.z*this.z+this.w*this.w)}manhattanLength(){return Math.abs(this.x)+Math.abs(this.y)+Math.abs(this.z)+Math.abs(this.w)}normalize(){return this.divideScalar(this.length()||1)}setLength(e){return this.normalize().multiplyScalar(e)}lerp(e,t){return this.x+=(e.x-this.x)*t,this.y+=(e.y-this.y)*t,this.z+=(e.z-this.z)*t,this.w+=(e.w-this.w)*t,this}lerpVectors(e,t,n){return this.x=e.x+(t.x-e.x)*n,this.y=e.y+(t.y-e.y)*n,this.z=e.z+(t.z-e.z)*n,this.w=e.w+(t.w-e.w)*n,this}equals(e){return e.x===this.x&&e.y===this.y&&e.z===this.z&&e.w===this.w}fromArray(e,t=0){return this.x=e[t],this.y=e[t+1],this.z=e[t+2],this.w=e[t+3],this}toArray(e=[],t=0){return e[t]=this.x,e[t+1]=this.y,e[t+2]=this.z,e[t+3]=this.w,e}fromBufferAttribute(e,t){return this.x=e.getX(t),this.y=e.getY(t),this.z=e.getZ(t),this.w=e.getW(t),this}random(){return this.x=Math.random(),this.y=Math.random(),this.z=Math.random(),this.w=Math.random(),this}*[Symbol.iterator](){yield this.x,yield this.y,yield this.z,yield this.w}}class Fm extends Ki{constructor(e=1,t=1,n={}){super(),n=Object.assign({generateMipmaps:!1,internalFormat:null,minFilter:Ft,depthBuffer:!0,stencilBuffer:!1,resolveDepthBuffer:!0,resolveStencilBuffer:!0,depthTexture:null,samples:0,count:1,depth:1,multiview:!1,useArrayDepthTexture:!1},n),this.isRenderTarget=!0,this.width=e,this.height=t,this.depth=n.depth,this.scissor=new Rt(0,0,e,t),this.scissorTest=!1,this.viewport=new Rt(0,0,e,t),this.textures=[];const s={width:e,height:t,depth:n.depth},r=new Wt(s),a=n.count;for(let o=0;o<a;o++)this.textures[o]=r.clone(),this.textures[o].isRenderTargetTexture=!0,this.textures[o].renderTarget=this;this._setTextureOptions(n),this.depthBuffer=n.depthBuffer,this.stencilBuffer=n.stencilBuffer,this.resolveDepthBuffer=n.resolveDepthBuffer,this.resolveStencilBuffer=n.resolveStencilBuffer,this._depthTexture=null,this.depthTexture=n.depthTexture,this.samples=n.samples,this.multiview=n.multiview,this.useArrayDepthTexture=n.useArrayDepthTexture}_setTextureOptions(e={}){const t={minFilter:Ft,generateMipmaps:!1,flipY:!1,internalFormat:null};e.mapping!==void 0&&(t.mapping=e.mapping),e.wrapS!==void 0&&(t.wrapS=e.wrapS),e.wrapT!==void 0&&(t.wrapT=e.wrapT),e.wrapR!==void 0&&(t.wrapR=e.wrapR),e.magFilter!==void 0&&(t.magFilter=e.magFilter),e.minFilter!==void 0&&(t.minFilter=e.minFilter),e.format!==void 0&&(t.format=e.format),e.type!==void 0&&(t.type=e.type),e.anisotropy!==void 0&&(t.anisotropy=e.anisotropy),e.colorSpace!==void 0&&(t.colorSpace=e.colorSpace),e.flipY!==void 0&&(t.flipY=e.flipY),e.generateMipmaps!==void 0&&(t.generateMipmaps=e.generateMipmaps),e.internalFormat!==void 0&&(t.internalFormat=e.internalFormat);for(let n=0;n<this.textures.length;n++)this.textures[n].setValues(t)}get texture(){return this.textures[0]}set texture(e){this.textures[0]=e}set depthTexture(e){this._depthTexture!==null&&(this._depthTexture.renderTarget=null),e!==null&&(e.renderTarget=this),this._depthTexture=e}get depthTexture(){return this._depthTexture}setSize(e,t,n=1){if(this.width!==e||this.height!==t||this.depth!==n){this.width=e,this.height=t,this.depth=n;for(let s=0,r=this.textures.length;s<r;s++)this.textures[s].image.width=e,this.textures[s].image.height=t,this.textures[s].image.depth=n,this.textures[s].isData3DTexture!==!0&&(this.textures[s].isArrayTexture=this.textures[s].image.depth>1);this.dispose()}this.viewport.set(0,0,e,t),this.scissor.set(0,0,e,t)}clone(){return new this.constructor().copy(this)}copy(e){this.width=e.width,this.height=e.height,this.depth=e.depth,this.scissor.copy(e.scissor),this.scissorTest=e.scissorTest,this.viewport.copy(e.viewport),this.textures.length=0;for(let t=0,n=e.textures.length;t<n;t++){this.textures[t]=e.textures[t].clone(),this.textures[t].isRenderTargetTexture=!0,this.textures[t].renderTarget=this;const s=Object.assign({},e.textures[t].image);this.textures[t].source=new Wc(s)}return this.depthBuffer=e.depthBuffer,this.stencilBuffer=e.stencilBuffer,this.resolveDepthBuffer=e.resolveDepthBuffer,this.resolveStencilBuffer=e.resolveStencilBuffer,e.depthTexture!==null&&(this.depthTexture=e.depthTexture.clone()),this.samples=e.samples,this.multiview=e.multiview,this.useArrayDepthTexture=e.useArrayDepthTexture,this}dispose(){this.dispatchEvent({type:"dispose"})}}class nn extends Fm{constructor(e=1,t=1,n={}){super(e,t,n),this.isWebGLRenderTarget=!0}}class xd extends Wt{constructor(e=null,t=1,n=1,s=1){super(null),this.isDataArrayTexture=!0,this.image={data:e,width:t,height:n,depth:s},this.magFilter=Xt,this.minFilter=Xt,this.wrapR=Pn,this.generateMipmaps=!1,this.flipY=!1,this.unpackAlignment=1,this.layerUpdates=new Set}addLayerUpdate(e){this.layerUpdates.add(e)}clearLayerUpdates(){this.layerUpdates.clear()}}class Om extends Wt{constructor(e=null,t=1,n=1,s=1){super(null),this.isData3DTexture=!0,this.image={data:e,width:t,height:n,depth:s},this.magFilter=Xt,this.minFilter=Xt,this.wrapR=Pn,this.generateMipmaps=!1,this.flipY=!1,this.unpackAlignment=1}}class ut{static{ut.prototype.isMatrix4=!0}constructor(e,t,n,s,r,a,o,l,c,h,f,d,u,m,x,v){this.elements=[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1],e!==void 0&&this.set(e,t,n,s,r,a,o,l,c,h,f,d,u,m,x,v)}set(e,t,n,s,r,a,o,l,c,h,f,d,u,m,x,v){const g=this.elements;return g[0]=e,g[4]=t,g[8]=n,g[12]=s,g[1]=r,g[5]=a,g[9]=o,g[13]=l,g[2]=c,g[6]=h,g[10]=f,g[14]=d,g[3]=u,g[7]=m,g[11]=x,g[15]=v,this}identity(){return this.set(1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1),this}clone(){return new ut().fromArray(this.elements)}copy(e){const t=this.elements,n=e.elements;return t[0]=n[0],t[1]=n[1],t[2]=n[2],t[3]=n[3],t[4]=n[4],t[5]=n[5],t[6]=n[6],t[7]=n[7],t[8]=n[8],t[9]=n[9],t[10]=n[10],t[11]=n[11],t[12]=n[12],t[13]=n[13],t[14]=n[14],t[15]=n[15],this}copyPosition(e){const t=this.elements,n=e.elements;return t[12]=n[12],t[13]=n[13],t[14]=n[14],this}setFromMatrix3(e){const t=e.elements;return this.set(t[0],t[3],t[6],0,t[1],t[4],t[7],0,t[2],t[5],t[8],0,0,0,0,1),this}extractBasis(e,t,n){return this.determinantAffine()===0?(e.set(1,0,0),t.set(0,1,0),n.set(0,0,1),this):(e.setFromMatrixColumn(this,0),t.setFromMatrixColumn(this,1),n.setFromMatrixColumn(this,2),this)}makeBasis(e,t,n){return this.set(e.x,t.x,n.x,0,e.y,t.y,n.y,0,e.z,t.z,n.z,0,0,0,0,1),this}extractRotation(e){if(e.determinantAffine()===0)return this.identity();const t=this.elements,n=e.elements,s=1/ss.setFromMatrixColumn(e,0).length(),r=1/ss.setFromMatrixColumn(e,1).length(),a=1/ss.setFromMatrixColumn(e,2).length();return t[0]=n[0]*s,t[1]=n[1]*s,t[2]=n[2]*s,t[3]=0,t[4]=n[4]*r,t[5]=n[5]*r,t[6]=n[6]*r,t[7]=0,t[8]=n[8]*a,t[9]=n[9]*a,t[10]=n[10]*a,t[11]=0,t[12]=0,t[13]=0,t[14]=0,t[15]=1,this}makeRotationFromEuler(e){const t=this.elements,n=e.x,s=e.y,r=e.z,a=Math.cos(n),o=Math.sin(n),l=Math.cos(s),c=Math.sin(s),h=Math.cos(r),f=Math.sin(r);if(e.order==="XYZ"){const d=a*h,u=a*f,m=o*h,x=o*f;t[0]=l*h,t[4]=-l*f,t[8]=c,t[1]=u+m*c,t[5]=d-x*c,t[9]=-o*l,t[2]=x-d*c,t[6]=m+u*c,t[10]=a*l}else if(e.order==="YXZ"){const d=l*h,u=l*f,m=c*h,x=c*f;t[0]=d+x*o,t[4]=m*o-u,t[8]=a*c,t[1]=a*f,t[5]=a*h,t[9]=-o,t[2]=u*o-m,t[6]=x+d*o,t[10]=a*l}else if(e.order==="ZXY"){const d=l*h,u=l*f,m=c*h,x=c*f;t[0]=d-x*o,t[4]=-a*f,t[8]=m+u*o,t[1]=u+m*o,t[5]=a*h,t[9]=x-d*o,t[2]=-a*c,t[6]=o,t[10]=a*l}else if(e.order==="ZYX"){const d=a*h,u=a*f,m=o*h,x=o*f;t[0]=l*h,t[4]=m*c-u,t[8]=d*c+x,t[1]=l*f,t[5]=x*c+d,t[9]=u*c-m,t[2]=-c,t[6]=o*l,t[10]=a*l}else if(e.order==="YZX"){const d=a*l,u=a*c,m=o*l,x=o*c;t[0]=l*h,t[4]=x-d*f,t[8]=m*f+u,t[1]=f,t[5]=a*h,t[9]=-o*h,t[2]=-c*h,t[6]=u*f+m,t[10]=d-x*f}else if(e.order==="XZY"){const d=a*l,u=a*c,m=o*l,x=o*c;t[0]=l*h,t[4]=-f,t[8]=c*h,t[1]=d*f+x,t[5]=a*h,t[9]=u*f-m,t[2]=m*f-u,t[6]=o*h,t[10]=x*f+d}return t[3]=0,t[7]=0,t[11]=0,t[12]=0,t[13]=0,t[14]=0,t[15]=1,this}makeRotationFromQuaternion(e){return this.compose(Bm,e,km)}lookAt(e,t,n){const s=this.elements;return on.subVectors(e,t),on.lengthSq()===0&&(on.z=1),on.normalize(),fi.crossVectors(n,on),fi.lengthSq()===0&&(Math.abs(n.z)===1?on.x+=1e-4:on.z+=1e-4,on.normalize(),fi.crossVectors(n,on)),fi.normalize(),zr.crossVectors(on,fi),s[0]=fi.x,s[4]=zr.x,s[8]=on.x,s[1]=fi.y,s[5]=zr.y,s[9]=on.y,s[2]=fi.z,s[6]=zr.z,s[10]=on.z,this}multiply(e){return this.multiplyMatrices(this,e)}premultiply(e){return this.multiplyMatrices(e,this)}multiplyMatrices(e,t){const n=e.elements,s=t.elements,r=this.elements,a=n[0],o=n[4],l=n[8],c=n[12],h=n[1],f=n[5],d=n[9],u=n[13],m=n[2],x=n[6],v=n[10],g=n[14],y=n[3],E=n[7],M=n[11],T=n[15],w=s[0],R=s[4],_=s[8],b=s[12],P=s[1],L=s[5],B=s[9],Y=s[13],p=s[2],C=s[6],D=s[10],U=s[14],O=s[3],F=s[7],G=s[11],Z=s[15];return r[0]=a*w+o*P+l*p+c*O,r[4]=a*R+o*L+l*C+c*F,r[8]=a*_+o*B+l*D+c*G,r[12]=a*b+o*Y+l*U+c*Z,r[1]=h*w+f*P+d*p+u*O,r[5]=h*R+f*L+d*C+u*F,r[9]=h*_+f*B+d*D+u*G,r[13]=h*b+f*Y+d*U+u*Z,r[2]=m*w+x*P+v*p+g*O,r[6]=m*R+x*L+v*C+g*F,r[10]=m*_+x*B+v*D+g*G,r[14]=m*b+x*Y+v*U+g*Z,r[3]=y*w+E*P+M*p+T*O,r[7]=y*R+E*L+M*C+T*F,r[11]=y*_+E*B+M*D+T*G,r[15]=y*b+E*Y+M*U+T*Z,this}multiplyScalar(e){const t=this.elements;return t[0]*=e,t[4]*=e,t[8]*=e,t[12]*=e,t[1]*=e,t[5]*=e,t[9]*=e,t[13]*=e,t[2]*=e,t[6]*=e,t[10]*=e,t[14]*=e,t[3]*=e,t[7]*=e,t[11]*=e,t[15]*=e,this}determinant(){const e=this.elements,t=e[0],n=e[4],s=e[8],r=e[12],a=e[1],o=e[5],l=e[9],c=e[13],h=e[2],f=e[6],d=e[10],u=e[14],m=e[3],x=e[7],v=e[11],g=e[15],y=l*u-c*d,E=o*u-c*f,M=o*d-l*f,T=a*u-c*h,w=a*d-l*h,R=a*f-o*h;return t*(x*y-v*E+g*M)-n*(m*y-v*T+g*w)+s*(m*E-x*T+g*R)-r*(m*M-x*w+v*R)}determinantAffine(){const e=this.elements,t=e[0],n=e[4],s=e[8],r=e[1],a=e[5],o=e[9],l=e[2],c=e[6],h=e[10];return t*(a*h-o*c)-n*(r*h-o*l)+s*(r*c-a*l)}transpose(){const e=this.elements;let t;return t=e[1],e[1]=e[4],e[4]=t,t=e[2],e[2]=e[8],e[8]=t,t=e[6],e[6]=e[9],e[9]=t,t=e[3],e[3]=e[12],e[12]=t,t=e[7],e[7]=e[13],e[13]=t,t=e[11],e[11]=e[14],e[14]=t,this}setPosition(e,t,n){const s=this.elements;return e.isVector3?(s[12]=e.x,s[13]=e.y,s[14]=e.z):(s[12]=e,s[13]=t,s[14]=n),this}invert(){const e=this.elements,t=e[0],n=e[1],s=e[2],r=e[3],a=e[4],o=e[5],l=e[6],c=e[7],h=e[8],f=e[9],d=e[10],u=e[11],m=e[12],x=e[13],v=e[14],g=e[15],y=t*o-n*a,E=t*l-s*a,M=t*c-r*a,T=n*l-s*o,w=n*c-r*o,R=s*c-r*l,_=h*x-f*m,b=h*v-d*m,P=h*g-u*m,L=f*v-d*x,B=f*g-u*x,Y=d*g-u*v,p=y*Y-E*B+M*L+T*P-w*b+R*_;if(p===0)return this.set(0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0);const C=1/p;return e[0]=(o*Y-l*B+c*L)*C,e[1]=(s*B-n*Y-r*L)*C,e[2]=(x*R-v*w+g*T)*C,e[3]=(d*w-f*R-u*T)*C,e[4]=(l*P-a*Y-c*b)*C,e[5]=(t*Y-s*P+r*b)*C,e[6]=(v*M-m*R-g*E)*C,e[7]=(h*R-d*M+u*E)*C,e[8]=(a*B-o*P+c*_)*C,e[9]=(n*P-t*B-r*_)*C,e[10]=(m*w-x*M+g*y)*C,e[11]=(f*M-h*w-u*y)*C,e[12]=(o*b-a*L-l*_)*C,e[13]=(t*L-n*b+s*_)*C,e[14]=(x*E-m*T-v*y)*C,e[15]=(h*T-f*E+d*y)*C,this}scale(e){const t=this.elements,n=e.x,s=e.y,r=e.z;return t[0]*=n,t[4]*=s,t[8]*=r,t[1]*=n,t[5]*=s,t[9]*=r,t[2]*=n,t[6]*=s,t[10]*=r,t[3]*=n,t[7]*=s,t[11]*=r,this}getMaxScaleOnAxis(){const e=this.elements,t=e[0]*e[0]+e[1]*e[1]+e[2]*e[2],n=e[4]*e[4]+e[5]*e[5]+e[6]*e[6],s=e[8]*e[8]+e[9]*e[9]+e[10]*e[10];return Math.sqrt(Math.max(t,n,s))}makeTranslation(e,t,n){return e.isVector3?this.set(1,0,0,e.x,0,1,0,e.y,0,0,1,e.z,0,0,0,1):this.set(1,0,0,e,0,1,0,t,0,0,1,n,0,0,0,1),this}makeRotationX(e){const t=Math.cos(e),n=Math.sin(e);return this.set(1,0,0,0,0,t,-n,0,0,n,t,0,0,0,0,1),this}makeRotationY(e){const t=Math.cos(e),n=Math.sin(e);return this.set(t,0,n,0,0,1,0,0,-n,0,t,0,0,0,0,1),this}makeRotationZ(e){const t=Math.cos(e),n=Math.sin(e);return this.set(t,-n,0,0,n,t,0,0,0,0,1,0,0,0,0,1),this}makeRotationAxis(e,t){const n=Math.cos(t),s=Math.sin(t),r=1-n,a=e.x,o=e.y,l=e.z,c=r*a,h=r*o;return this.set(c*a+n,c*o-s*l,c*l+s*o,0,c*o+s*l,h*o+n,h*l-s*a,0,c*l-s*o,h*l+s*a,r*l*l+n,0,0,0,0,1),this}makeScale(e,t,n){return this.set(e,0,0,0,0,t,0,0,0,0,n,0,0,0,0,1),this}makeShear(e,t,n,s,r,a){return this.set(1,n,r,0,e,1,a,0,t,s,1,0,0,0,0,1),this}compose(e,t,n){const s=this.elements,r=t._x,a=t._y,o=t._z,l=t._w,c=r+r,h=a+a,f=o+o,d=r*c,u=r*h,m=r*f,x=a*h,v=a*f,g=o*f,y=l*c,E=l*h,M=l*f,T=n.x,w=n.y,R=n.z;return s[0]=(1-(x+g))*T,s[1]=(u+M)*T,s[2]=(m-E)*T,s[3]=0,s[4]=(u-M)*w,s[5]=(1-(d+g))*w,s[6]=(v+y)*w,s[7]=0,s[8]=(m+E)*R,s[9]=(v-y)*R,s[10]=(1-(d+x))*R,s[11]=0,s[12]=e.x,s[13]=e.y,s[14]=e.z,s[15]=1,this}decompose(e,t,n){const s=this.elements;e.x=s[12],e.y=s[13],e.z=s[14];const r=this.determinantAffine();if(r===0)return n.set(1,1,1),t.identity(),this;let a=ss.set(s[0],s[1],s[2]).length();const o=ss.set(s[4],s[5],s[6]).length(),l=ss.set(s[8],s[9],s[10]).length();r<0&&(a=-a),En.copy(this);const c=1/a,h=1/o,f=1/l;return En.elements[0]*=c,En.elements[1]*=c,En.elements[2]*=c,En.elements[4]*=h,En.elements[5]*=h,En.elements[6]*=h,En.elements[8]*=f,En.elements[9]*=f,En.elements[10]*=f,t.setFromRotationMatrix(En),n.x=a,n.y=o,n.z=l,this}makePerspective(e,t,n,s,r,a,o=Bn,l=!1){const c=this.elements,h=2*r/(t-e),f=2*r/(n-s),d=(t+e)/(t-e),u=(n+s)/(n-s);let m,x;if(l)m=r/(a-r),x=a*r/(a-r);else if(o===Bn)m=-(a+r)/(a-r),x=-2*a*r/(a-r);else if(o===Ar)m=-a/(a-r),x=-a*r/(a-r);else throw new Error("THREE.Matrix4.makePerspective(): Invalid coordinate system: "+o);return c[0]=h,c[4]=0,c[8]=d,c[12]=0,c[1]=0,c[5]=f,c[9]=u,c[13]=0,c[2]=0,c[6]=0,c[10]=m,c[14]=x,c[3]=0,c[7]=0,c[11]=-1,c[15]=0,this}makeOrthographic(e,t,n,s,r,a,o=Bn,l=!1){const c=this.elements,h=2/(t-e),f=2/(n-s),d=-(t+e)/(t-e),u=-(n+s)/(n-s);let m,x;if(l)m=1/(a-r),x=a/(a-r);else if(o===Bn)m=-2/(a-r),x=-(a+r)/(a-r);else if(o===Ar)m=-1/(a-r),x=-r/(a-r);else throw new Error("THREE.Matrix4.makeOrthographic(): Invalid coordinate system: "+o);return c[0]=h,c[4]=0,c[8]=0,c[12]=d,c[1]=0,c[5]=f,c[9]=0,c[13]=u,c[2]=0,c[6]=0,c[10]=m,c[14]=x,c[3]=0,c[7]=0,c[11]=0,c[15]=1,this}equals(e){const t=this.elements,n=e.elements;for(let s=0;s<16;s++)if(t[s]!==n[s])return!1;return!0}fromArray(e,t=0){for(let n=0;n<16;n++)this.elements[n]=e[n+t];return this}toArray(e=[],t=0){const n=this.elements;return e[t]=n[0],e[t+1]=n[1],e[t+2]=n[2],e[t+3]=n[3],e[t+4]=n[4],e[t+5]=n[5],e[t+6]=n[6],e[t+7]=n[7],e[t+8]=n[8],e[t+9]=n[9],e[t+10]=n[10],e[t+11]=n[11],e[t+12]=n[12],e[t+13]=n[13],e[t+14]=n[14],e[t+15]=n[15],e}}const ss=new N,En=new ut,Bm=new N(0,0,0),km=new N(1,1,1),fi=new N,zr=new N,on=new N,Nh=new ut,Uh=new Vn;class Yn{constructor(e=0,t=0,n=0,s=Yn.DEFAULT_ORDER){this.isEuler=!0,this._x=e,this._y=t,this._z=n,this._order=s}get x(){return this._x}set x(e){this._x=e,this._onChangeCallback()}get y(){return this._y}set y(e){this._y=e,this._onChangeCallback()}get z(){return this._z}set z(e){this._z=e,this._onChangeCallback()}get order(){return this._order}set order(e){this._order=e,this._onChangeCallback()}set(e,t,n,s=this._order){return this._x=e,this._y=t,this._z=n,this._order=s,this._onChangeCallback(),this}clone(){return new this.constructor(this._x,this._y,this._z,this._order)}copy(e){return this._x=e._x,this._y=e._y,this._z=e._z,this._order=e._order,this._onChangeCallback(),this}setFromRotationMatrix(e,t=this._order,n=!0){const s=e.elements,r=s[0],a=s[4],o=s[8],l=s[1],c=s[5],h=s[9],f=s[2],d=s[6],u=s[10];switch(t){case"XYZ":this._y=Math.asin(tt(o,-1,1)),Math.abs(o)<.9999999?(this._x=Math.atan2(-h,u),this._z=Math.atan2(-a,r)):(this._x=Math.atan2(d,c),this._z=0);break;case"YXZ":this._x=Math.asin(-tt(h,-1,1)),Math.abs(h)<.9999999?(this._y=Math.atan2(o,u),this._z=Math.atan2(l,c)):(this._y=Math.atan2(-f,r),this._z=0);break;case"ZXY":this._x=Math.asin(tt(d,-1,1)),Math.abs(d)<.9999999?(this._y=Math.atan2(-f,u),this._z=Math.atan2(-a,c)):(this._y=0,this._z=Math.atan2(l,r));break;case"ZYX":this._y=Math.asin(-tt(f,-1,1)),Math.abs(f)<.9999999?(this._x=Math.atan2(d,u),this._z=Math.atan2(l,r)):(this._x=0,this._z=Math.atan2(-a,c));break;case"YZX":this._z=Math.asin(tt(l,-1,1)),Math.abs(l)<.9999999?(this._x=Math.atan2(-h,c),this._y=Math.atan2(-f,r)):(this._x=0,this._y=Math.atan2(o,u));break;case"XZY":this._z=Math.asin(-tt(a,-1,1)),Math.abs(a)<.9999999?(this._x=Math.atan2(d,c),this._y=Math.atan2(o,r)):(this._x=Math.atan2(-h,u),this._y=0);break;default:Ke("Euler: .setFromRotationMatrix() encountered an unknown order: "+t)}return this._order=t,n===!0&&this._onChangeCallback(),this}setFromQuaternion(e,t,n){return Nh.makeRotationFromQuaternion(e),this.setFromRotationMatrix(Nh,t,n)}setFromVector3(e,t=this._order){return this.set(e.x,e.y,e.z,t)}reorder(e){return Uh.setFromEuler(this),this.setFromQuaternion(Uh,e)}equals(e){return e._x===this._x&&e._y===this._y&&e._z===this._z&&e._order===this._order}fromArray(e){return this._x=e[0],this._y=e[1],this._z=e[2],e[3]!==void 0&&(this._order=e[3]),this._onChangeCallback(),this}toArray(e=[],t=0){return e[t]=this._x,e[t+1]=this._y,e[t+2]=this._z,e[t+3]=this._order,e}_onChange(e){return this._onChangeCallback=e,this}_onChangeCallback(){}*[Symbol.iterator](){yield this._x,yield this._y,yield this._z,yield this._order}}Yn.DEFAULT_ORDER="XYZ";class Sd{constructor(){this.mask=1}set(e){this.mask=(1<<e|0)>>>0}enable(e){this.mask|=1<<e|0}enableAll(){this.mask=-1}toggle(e){this.mask^=1<<e|0}disable(e){this.mask&=~(1<<e|0)}disableAll(){this.mask=0}test(e){return(this.mask&e.mask)!==0}isEnabled(e){return(this.mask&(1<<e|0))!==0}}let Gm=0;const Fh=new N,rs=new Vn,Zn=new ut,Hr=new N,Zs=new N,zm=new N,Hm=new Vn,Oh=new N(1,0,0),Bh=new N(0,1,0),kh=new N(0,0,1),Gh={type:"added"},Vm={type:"removed"},as={type:"childadded",child:null},yo={type:"childremoved",child:null};class Lt extends Ki{constructor(){super(),this.isObject3D=!0,Object.defineProperty(this,"id",{value:Gm++}),this.uuid=Hn(),this.name="",this.type="Object3D",this.parent=null,this.children=[],this.up=Lt.DEFAULT_UP.clone();const e=new N,t=new Yn,n=new Vn,s=new N(1,1,1);function r(){n.setFromEuler(t,!1)}function a(){t.setFromQuaternion(n,void 0,!1)}t._onChange(r),n._onChange(a),Object.defineProperties(this,{position:{configurable:!0,enumerable:!0,value:e},rotation:{configurable:!0,enumerable:!0,value:t},quaternion:{configurable:!0,enumerable:!0,value:n},scale:{configurable:!0,enumerable:!0,value:s},modelViewMatrix:{value:new ut},normalMatrix:{value:new Je}}),this.matrix=new ut,this.matrixWorld=new ut,this.matrixAutoUpdate=Lt.DEFAULT_MATRIX_AUTO_UPDATE,this.matrixWorldAutoUpdate=Lt.DEFAULT_MATRIX_WORLD_AUTO_UPDATE,this.matrixWorldNeedsUpdate=!1,this.layers=new Sd,this.visible=!0,this.castShadow=!1,this.receiveShadow=!1,this.frustumCulled=!0,this.renderOrder=0,this.animations=[],this.customDepthMaterial=void 0,this.customDistanceMaterial=void 0,this.static=!1,this.userData={},this.pivot=null}onBeforeShadow(){}onAfterShadow(){}onBeforeRender(){}onAfterRender(){}applyMatrix4(e){this.matrixAutoUpdate&&this.updateMatrix(),this.matrix.premultiply(e),this.matrix.decompose(this.position,this.quaternion,this.scale)}applyQuaternion(e){return this.quaternion.premultiply(e),this}setRotationFromAxisAngle(e,t){this.quaternion.setFromAxisAngle(e,t)}setRotationFromEuler(e){this.quaternion.setFromEuler(e,!0)}setRotationFromMatrix(e){this.quaternion.setFromRotationMatrix(e)}setRotationFromQuaternion(e){this.quaternion.copy(e)}rotateOnAxis(e,t){return rs.setFromAxisAngle(e,t),this.quaternion.multiply(rs),this}rotateOnWorldAxis(e,t){return rs.setFromAxisAngle(e,t),this.quaternion.premultiply(rs),this}rotateX(e){return this.rotateOnAxis(Oh,e)}rotateY(e){return this.rotateOnAxis(Bh,e)}rotateZ(e){return this.rotateOnAxis(kh,e)}translateOnAxis(e,t){return Fh.copy(e).applyQuaternion(this.quaternion),this.position.add(Fh.multiplyScalar(t)),this}translateX(e){return this.translateOnAxis(Oh,e)}translateY(e){return this.translateOnAxis(Bh,e)}translateZ(e){return this.translateOnAxis(kh,e)}localToWorld(e){return this.updateWorldMatrix(!0,!1),e.applyMatrix4(this.matrixWorld)}worldToLocal(e){return this.updateWorldMatrix(!0,!1),e.applyMatrix4(Zn.copy(this.matrixWorld).invert())}lookAt(e,t,n){e.isVector3?Hr.copy(e):Hr.set(e,t,n);const s=this.parent;this.updateWorldMatrix(!0,!1),Zs.setFromMatrixPosition(this.matrixWorld),this.isCamera||this.isLight?Zn.lookAt(Zs,Hr,this.up):Zn.lookAt(Hr,Zs,this.up),this.quaternion.setFromRotationMatrix(Zn),s&&(Zn.extractRotation(s.matrixWorld),rs.setFromRotationMatrix(Zn),this.quaternion.premultiply(rs.invert()))}add(e){if(arguments.length>1){for(let t=0;t<arguments.length;t++)this.add(arguments[t]);return this}return e===this?(at("Object3D.add: object can't be added as a child of itself.",e),this):(e&&e.isObject3D?(e.removeFromParent(),e.parent=this,this.children.push(e),e.dispatchEvent(Gh),as.child=e,this.dispatchEvent(as),as.child=null):at("Object3D.add: object not an instance of THREE.Object3D.",e),this)}remove(e){if(arguments.length>1){for(let n=0;n<arguments.length;n++)this.remove(arguments[n]);return this}const t=this.children.indexOf(e);return t!==-1&&(e.parent=null,this.children.splice(t,1),e.dispatchEvent(Vm),yo.child=e,this.dispatchEvent(yo),yo.child=null),this}removeFromParent(){const e=this.parent;return e!==null&&e.remove(this),this}clear(){return this.remove(...this.children)}attach(e){return this.updateWorldMatrix(!0,!1),Zn.copy(this.matrixWorld).invert(),e.parent!==null&&(e.parent.updateWorldMatrix(!0,!1),Zn.multiply(e.parent.matrixWorld)),e.applyMatrix4(Zn),e.removeFromParent(),e.parent=this,this.children.push(e),e.updateWorldMatrix(!1,!0),e.dispatchEvent(Gh),as.child=e,this.dispatchEvent(as),as.child=null,this}getObjectById(e){return this.getObjectByProperty("id",e)}getObjectByName(e){return this.getObjectByProperty("name",e)}getObjectByProperty(e,t){if(this[e]===t)return this;for(let n=0,s=this.children.length;n<s;n++){const a=this.children[n].getObjectByProperty(e,t);if(a!==void 0)return a}}getObjectsByProperty(e,t,n=[]){this[e]===t&&n.push(this);const s=this.children;for(let r=0,a=s.length;r<a;r++)s[r].getObjectsByProperty(e,t,n);return n}getWorldPosition(e){return this.updateWorldMatrix(!0,!1),e.setFromMatrixPosition(this.matrixWorld)}getWorldQuaternion(e){return this.updateWorldMatrix(!0,!1),this.matrixWorld.decompose(Zs,e,zm),e}getWorldScale(e){return this.updateWorldMatrix(!0,!1),this.matrixWorld.decompose(Zs,Hm,e),e}getWorldDirection(e){this.updateWorldMatrix(!0,!1);const t=this.matrixWorld.elements;return e.set(t[8],t[9],t[10]).normalize()}raycast(){}traverse(e){e(this);const t=this.children;for(let n=0,s=t.length;n<s;n++)t[n].traverse(e)}traverseVisible(e){if(this.visible===!1)return;e(this);const t=this.children;for(let n=0,s=t.length;n<s;n++)t[n].traverseVisible(e)}traverseAncestors(e){const t=this.parent;t!==null&&(e(t),t.traverseAncestors(e))}updateMatrix(){this.matrix.compose(this.position,this.quaternion,this.scale);const e=this.pivot;if(e!==null){const t=e.x,n=e.y,s=e.z,r=this.matrix.elements;r[12]+=t-r[0]*t-r[4]*n-r[8]*s,r[13]+=n-r[1]*t-r[5]*n-r[9]*s,r[14]+=s-r[2]*t-r[6]*n-r[10]*s}this.matrixWorldNeedsUpdate=!0}updateMatrixWorld(e){this.matrixAutoUpdate&&this.updateMatrix(),(this.matrixWorldNeedsUpdate||e)&&(this.matrixWorldAutoUpdate===!0&&(this.parent===null?this.matrixWorld.copy(this.matrix):this.matrixWorld.multiplyMatrices(this.parent.matrixWorld,this.matrix)),this.matrixWorldNeedsUpdate=!1,e=!0);const t=this.children;for(let n=0,s=t.length;n<s;n++)t[n].updateMatrixWorld(e)}updateWorldMatrix(e,t,n=!1){const s=this.parent;if(e===!0&&s!==null&&s.updateWorldMatrix(!0,!1),this.matrixAutoUpdate&&this.updateMatrix(),(this.matrixWorldNeedsUpdate||n)&&(this.matrixWorldAutoUpdate===!0&&(this.parent===null?this.matrixWorld.copy(this.matrix):this.matrixWorld.multiplyMatrices(this.parent.matrixWorld,this.matrix)),this.matrixWorldNeedsUpdate=!1,n=!0),t===!0){const r=this.children;for(let a=0,o=r.length;a<o;a++)r[a].updateWorldMatrix(!1,!0,n)}}toJSON(e){const t=e===void 0||typeof e=="string",n={};t&&(e={geometries:{},materials:{},textures:{},images:{},shapes:{},skeletons:{},animations:{},nodes:{}},n.metadata={version:4.7,type:"Object",generator:"Object3D.toJSON"});const s={};s.uuid=this.uuid,s.type=this.type,this.name!==""&&(s.name=this.name),this.castShadow===!0&&(s.castShadow=!0),this.receiveShadow===!0&&(s.receiveShadow=!0),this.visible===!1&&(s.visible=!1),this.frustumCulled===!1&&(s.frustumCulled=!1),this.renderOrder!==0&&(s.renderOrder=this.renderOrder),this.static!==!1&&(s.static=this.static),Object.keys(this.userData).length>0&&(s.userData=this.userData),s.layers=this.layers.mask,s.matrix=this.matrix.toArray(),s.up=this.up.toArray(),this.pivot!==null&&(s.pivot=this.pivot.toArray()),this.matrixAutoUpdate===!1&&(s.matrixAutoUpdate=!1),this.morphTargetDictionary!==void 0&&(s.morphTargetDictionary=Object.assign({},this.morphTargetDictionary)),this.morphTargetInfluences!==void 0&&(s.morphTargetInfluences=this.morphTargetInfluences.slice()),this.isInstancedMesh&&(s.type="InstancedMesh",s.count=this.count,s.instanceMatrix=this.instanceMatrix.toJSON(),this.instanceColor!==null&&(s.instanceColor=this.instanceColor.toJSON())),this.isBatchedMesh&&(s.type="BatchedMesh",s.perObjectFrustumCulled=this.perObjectFrustumCulled,s.sortObjects=this.sortObjects,s.drawRanges=this._drawRanges,s.reservedRanges=this._reservedRanges,s.geometryInfo=this._geometryInfo.map(o=>({...o,boundingBox:o.boundingBox?o.boundingBox.toJSON():void 0,boundingSphere:o.boundingSphere?o.boundingSphere.toJSON():void 0})),s.instanceInfo=this._instanceInfo.map(o=>({...o})),s.availableInstanceIds=this._availableInstanceIds.slice(),s.availableGeometryIds=this._availableGeometryIds.slice(),s.nextIndexStart=this._nextIndexStart,s.nextVertexStart=this._nextVertexStart,s.geometryCount=this._geometryCount,s.maxInstanceCount=this._maxInstanceCount,s.maxVertexCount=this._maxVertexCount,s.maxIndexCount=this._maxIndexCount,s.geometryInitialized=this._geometryInitialized,s.matricesTexture=this._matricesTexture.toJSON(e),s.indirectTexture=this._indirectTexture.toJSON(e),this._colorsTexture!==null&&(s.colorsTexture=this._colorsTexture.toJSON(e)),this.boundingSphere!==null&&(s.boundingSphere=this.boundingSphere.toJSON()),this.boundingBox!==null&&(s.boundingBox=this.boundingBox.toJSON()));function r(o,l){return o[l.uuid]===void 0&&(o[l.uuid]=l.toJSON(e)),l.uuid}if(this.isScene)this.background&&(this.background.isColor?s.background=this.background.toJSON():this.background.isTexture&&(s.background=this.background.toJSON(e).uuid)),this.environment&&this.environment.isTexture&&this.environment.isRenderTargetTexture!==!0&&(s.environment=this.environment.toJSON(e).uuid);else if(this.isMesh||this.isLine||this.isPoints){s.geometry=r(e.geometries,this.geometry);const o=this.geometry.parameters;if(o!==void 0&&o.shapes!==void 0){const l=o.shapes;if(Array.isArray(l))for(let c=0,h=l.length;c<h;c++){const f=l[c];r(e.shapes,f)}else r(e.shapes,l)}}if(this.isSkinnedMesh&&(s.bindMode=this.bindMode,s.bindMatrix=this.bindMatrix.toArray(),this.skeleton!==void 0&&(r(e.skeletons,this.skeleton),s.skeleton=this.skeleton.uuid)),this.material!==void 0)if(Array.isArray(this.material)){const o=[];for(let l=0,c=this.material.length;l<c;l++)o.push(r(e.materials,this.material[l]));s.material=o}else s.material=r(e.materials,this.material);if(this.children.length>0){s.children=[];for(let o=0;o<this.children.length;o++)s.children.push(this.children[o].toJSON(e).object)}if(this.animations.length>0){s.animations=[];for(let o=0;o<this.animations.length;o++){const l=this.animations[o];s.animations.push(r(e.animations,l))}}if(t){const o=a(e.geometries),l=a(e.materials),c=a(e.textures),h=a(e.images),f=a(e.shapes),d=a(e.skeletons),u=a(e.animations),m=a(e.nodes);o.length>0&&(n.geometries=o),l.length>0&&(n.materials=l),c.length>0&&(n.textures=c),h.length>0&&(n.images=h),f.length>0&&(n.shapes=f),d.length>0&&(n.skeletons=d),u.length>0&&(n.animations=u),m.length>0&&(n.nodes=m)}return n.object=s,n;function a(o){const l=[];for(const c in o){const h=o[c];delete h.metadata,l.push(h)}return l}}clone(e){return new this.constructor().copy(this,e)}copy(e,t=!0){if(this.name=e.name,this.up.copy(e.up),this.position.copy(e.position),this.rotation.order=e.rotation.order,this.quaternion.copy(e.quaternion),this.scale.copy(e.scale),this.pivot=e.pivot!==null?e.pivot.clone():null,this.matrix.copy(e.matrix),this.matrixWorld.copy(e.matrixWorld),this.matrixAutoUpdate=e.matrixAutoUpdate,this.matrixWorldAutoUpdate=e.matrixWorldAutoUpdate,this.matrixWorldNeedsUpdate=e.matrixWorldNeedsUpdate,this.layers.mask=e.layers.mask,this.visible=e.visible,this.castShadow=e.castShadow,this.receiveShadow=e.receiveShadow,this.frustumCulled=e.frustumCulled,this.renderOrder=e.renderOrder,this.static=e.static,this.animations=e.animations.slice(),this.userData=JSON.parse(JSON.stringify(e.userData)),t===!0)for(let n=0;n<e.children.length;n++){const s=e.children[n];this.add(s.clone())}return this}}Lt.DEFAULT_UP=new N(0,1,0);Lt.DEFAULT_MATRIX_AUTO_UPDATE=!0;Lt.DEFAULT_MATRIX_WORLD_AUTO_UPDATE=!0;class Bt extends Lt{constructor(){super(),this.isGroup=!0,this.type="Group"}}const Wm={type:"move"};class bo{constructor(){this._targetRay=null,this._grip=null,this._hand=null}getHandSpace(){return this._hand===null&&(this._hand=new Bt,this._hand.matrixAutoUpdate=!1,this._hand.visible=!1,this._hand.joints={},this._hand.inputState={pinching:!1}),this._hand}getTargetRaySpace(){return this._targetRay===null&&(this._targetRay=new Bt,this._targetRay.matrixAutoUpdate=!1,this._targetRay.visible=!1,this._targetRay.hasLinearVelocity=!1,this._targetRay.linearVelocity=new N,this._targetRay.hasAngularVelocity=!1,this._targetRay.angularVelocity=new N),this._targetRay}getGripSpace(){return this._grip===null&&(this._grip=new Bt,this._grip.matrixAutoUpdate=!1,this._grip.visible=!1,this._grip.hasLinearVelocity=!1,this._grip.linearVelocity=new N,this._grip.hasAngularVelocity=!1,this._grip.angularVelocity=new N,this._grip.eventsEnabled=!1),this._grip}dispatchEvent(e){return this._targetRay!==null&&this._targetRay.dispatchEvent(e),this._grip!==null&&this._grip.dispatchEvent(e),this._hand!==null&&this._hand.dispatchEvent(e),this}connect(e){if(e&&e.hand){const t=this._hand;if(t)for(const n of e.hand.values())this._getHandJoint(t,n)}return this.dispatchEvent({type:"connected",data:e}),this}disconnect(e){return this.dispatchEvent({type:"disconnected",data:e}),this._targetRay!==null&&(this._targetRay.visible=!1),this._grip!==null&&(this._grip.visible=!1),this._hand!==null&&(this._hand.visible=!1),this}update(e,t,n){let s=null,r=null,a=null;const o=this._targetRay,l=this._grip,c=this._hand;if(e&&t.session.visibilityState!=="visible-blurred"){if(c&&e.hand){a=!0;for(const x of e.hand.values()){const v=t.getJointPose(x,n),g=this._getHandJoint(c,x);v!==null&&(g.matrix.fromArray(v.transform.matrix),g.matrix.decompose(g.position,g.rotation,g.scale),g.matrixWorldNeedsUpdate=!0,g.jointRadius=v.radius),g.visible=v!==null}const h=c.joints["index-finger-tip"],f=c.joints["thumb-tip"],d=h.position.distanceTo(f.position),u=.02,m=.005;c.inputState.pinching&&d>u+m?(c.inputState.pinching=!1,this.dispatchEvent({type:"pinchend",handedness:e.handedness,target:this})):!c.inputState.pinching&&d<=u-m&&(c.inputState.pinching=!0,this.dispatchEvent({type:"pinchstart",handedness:e.handedness,target:this}))}else l!==null&&e.gripSpace&&(r=t.getPose(e.gripSpace,n),r!==null&&(l.matrix.fromArray(r.transform.matrix),l.matrix.decompose(l.position,l.rotation,l.scale),l.matrixWorldNeedsUpdate=!0,r.linearVelocity?(l.hasLinearVelocity=!0,l.linearVelocity.copy(r.linearVelocity)):l.hasLinearVelocity=!1,r.angularVelocity?(l.hasAngularVelocity=!0,l.angularVelocity.copy(r.angularVelocity)):l.hasAngularVelocity=!1,l.eventsEnabled&&l.dispatchEvent({type:"gripUpdated",data:e,target:this})));o!==null&&(s=t.getPose(e.targetRaySpace,n),s===null&&r!==null&&(s=r),s!==null&&(o.matrix.fromArray(s.transform.matrix),o.matrix.decompose(o.position,o.rotation,o.scale),o.matrixWorldNeedsUpdate=!0,s.linearVelocity?(o.hasLinearVelocity=!0,o.linearVelocity.copy(s.linearVelocity)):o.hasLinearVelocity=!1,s.angularVelocity?(o.hasAngularVelocity=!0,o.angularVelocity.copy(s.angularVelocity)):o.hasAngularVelocity=!1,this.dispatchEvent(Wm)))}return o!==null&&(o.visible=s!==null),l!==null&&(l.visible=r!==null),c!==null&&(c.visible=a!==null),this}_getHandJoint(e,t){if(e.joints[t.jointName]===void 0){const n=new Bt;n.matrixAutoUpdate=!1,n.visible=!1,e.joints[t.jointName]=n,e.add(n)}return e.joints[t.jointName]}}const Md={aliceblue:15792383,antiquewhite:16444375,aqua:65535,aquamarine:8388564,azure:15794175,beige:16119260,bisque:16770244,black:0,blanchedalmond:16772045,blue:255,blueviolet:9055202,brown:10824234,burlywood:14596231,cadetblue:6266528,chartreuse:8388352,chocolate:13789470,coral:16744272,cornflowerblue:6591981,cornsilk:16775388,crimson:14423100,cyan:65535,darkblue:139,darkcyan:35723,darkgoldenrod:12092939,darkgray:11119017,darkgreen:25600,darkgrey:11119017,darkkhaki:12433259,darkmagenta:9109643,darkolivegreen:5597999,darkorange:16747520,darkorchid:10040012,darkred:9109504,darksalmon:15308410,darkseagreen:9419919,darkslateblue:4734347,darkslategray:3100495,darkslategrey:3100495,darkturquoise:52945,darkviolet:9699539,deeppink:16716947,deepskyblue:49151,dimgray:6908265,dimgrey:6908265,dodgerblue:2003199,firebrick:11674146,floralwhite:16775920,forestgreen:2263842,fuchsia:16711935,gainsboro:14474460,ghostwhite:16316671,gold:16766720,goldenrod:14329120,gray:8421504,green:32768,greenyellow:11403055,grey:8421504,honeydew:15794160,hotpink:16738740,indianred:13458524,indigo:4915330,ivory:16777200,khaki:15787660,lavender:15132410,lavenderblush:16773365,lawngreen:8190976,lemonchiffon:16775885,lightblue:11393254,lightcoral:15761536,lightcyan:14745599,lightgoldenrodyellow:16448210,lightgray:13882323,lightgreen:9498256,lightgrey:13882323,lightpink:16758465,lightsalmon:16752762,lightseagreen:2142890,lightskyblue:8900346,lightslategray:7833753,lightslategrey:7833753,lightsteelblue:11584734,lightyellow:16777184,lime:65280,limegreen:3329330,linen:16445670,magenta:16711935,maroon:8388608,mediumaquamarine:6737322,mediumblue:205,mediumorchid:12211667,mediumpurple:9662683,mediumseagreen:3978097,mediumslateblue:8087790,mediumspringgreen:64154,mediumturquoise:4772300,mediumvioletred:13047173,midnightblue:1644912,mintcream:16121850,mistyrose:16770273,moccasin:16770229,navajowhite:16768685,navy:128,oldlace:16643558,olive:8421376,olivedrab:7048739,orange:16753920,orangered:16729344,orchid:14315734,palegoldenrod:15657130,palegreen:10025880,paleturquoise:11529966,palevioletred:14381203,papayawhip:16773077,peachpuff:16767673,peru:13468991,pink:16761035,plum:14524637,powderblue:11591910,purple:8388736,rebeccapurple:6697881,red:16711680,rosybrown:12357519,royalblue:4286945,saddlebrown:9127187,salmon:16416882,sandybrown:16032864,seagreen:3050327,seashell:16774638,sienna:10506797,silver:12632256,skyblue:8900331,slateblue:6970061,slategray:7372944,slategrey:7372944,snow:16775930,springgreen:65407,steelblue:4620980,tan:13808780,teal:32896,thistle:14204888,tomato:16737095,turquoise:4251856,violet:15631086,wheat:16113331,white:16777215,whitesmoke:16119285,yellow:16776960,yellowgreen:10145074},pi={h:0,s:0,l:0},Vr={h:0,s:0,l:0};function Eo(i,e,t){return t<0&&(t+=1),t>1&&(t-=1),t<1/6?i+(e-i)*6*t:t<1/2?e:t<2/3?i+(e-i)*6*(2/3-t):i}class Le{constructor(e,t,n){return this.isColor=!0,this.r=1,this.g=1,this.b=1,this.set(e,t,n)}set(e,t,n){if(t===void 0&&n===void 0){const s=e;s&&s.isColor?this.copy(s):typeof s=="number"?this.setHex(s):typeof s=="string"&&this.setStyle(s)}else this.setRGB(e,t,n);return this}setScalar(e){return this.r=e,this.g=e,this.b=e,this}setHex(e,t=kt){return e=Math.floor(e),this.r=(e>>16&255)/255,this.g=(e>>8&255)/255,this.b=(e&255)/255,st.colorSpaceToWorking(this,t),this}setRGB(e,t,n,s=st.workingColorSpace){return this.r=e,this.g=t,this.b=n,st.colorSpaceToWorking(this,s),this}setHSL(e,t,n,s=st.workingColorSpace){if(e=Vc(e,1),t=tt(t,0,1),n=tt(n,0,1),t===0)this.r=this.g=this.b=n;else{const r=n<=.5?n*(1+t):n+t-n*t,a=2*n-r;this.r=Eo(a,r,e+1/3),this.g=Eo(a,r,e),this.b=Eo(a,r,e-1/3)}return st.colorSpaceToWorking(this,s),this}setStyle(e,t=kt){function n(r){r!==void 0&&parseFloat(r)<1&&Ke("Color: Alpha component of "+e+" will be ignored.")}let s;if(s=/^(\w+)\(([^\)]*)\)/.exec(e)){let r;const a=s[1],o=s[2];switch(a){case"rgb":case"rgba":if(r=/^\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*(\d*\.?\d+)\s*)?$/.exec(o))return n(r[4]),this.setRGB(Math.min(255,parseInt(r[1],10))/255,Math.min(255,parseInt(r[2],10))/255,Math.min(255,parseInt(r[3],10))/255,t);if(r=/^\s*(\d+)\%\s*,\s*(\d+)\%\s*,\s*(\d+)\%\s*(?:,\s*(\d*\.?\d+)\s*)?$/.exec(o))return n(r[4]),this.setRGB(Math.min(100,parseInt(r[1],10))/100,Math.min(100,parseInt(r[2],10))/100,Math.min(100,parseInt(r[3],10))/100,t);break;case"hsl":case"hsla":if(r=/^\s*(\d*\.?\d+)\s*,\s*(\d*\.?\d+)\%\s*,\s*(\d*\.?\d+)\%\s*(?:,\s*(\d*\.?\d+)\s*)?$/.exec(o))return n(r[4]),this.setHSL(parseFloat(r[1])/360,parseFloat(r[2])/100,parseFloat(r[3])/100,t);break;default:Ke("Color: Unknown color model "+e)}}else if(s=/^\#([A-Fa-f\d]+)$/.exec(e)){const r=s[1],a=r.length;if(a===3)return this.setRGB(parseInt(r.charAt(0),16)/15,parseInt(r.charAt(1),16)/15,parseInt(r.charAt(2),16)/15,t);if(a===6)return this.setHex(parseInt(r,16),t);Ke("Color: Invalid hex color "+e)}else if(e&&e.length>0)return this.setColorName(e,t);return this}setColorName(e,t=kt){const n=Md[e.toLowerCase()];return n!==void 0?this.setHex(n,t):Ke("Color: Unknown color "+e),this}clone(){return new this.constructor(this.r,this.g,this.b)}copy(e){return this.r=e.r,this.g=e.g,this.b=e.b,this}copySRGBToLinear(e){return this.r=ai(e.r),this.g=ai(e.g),this.b=ai(e.b),this}copyLinearToSRGB(e){return this.r=Rs(e.r),this.g=Rs(e.g),this.b=Rs(e.b),this}convertSRGBToLinear(){return this.copySRGBToLinear(this),this}convertLinearToSRGB(){return this.copyLinearToSRGB(this),this}getHex(e=kt){return st.workingToColorSpace(Kt.copy(this),e),Math.round(tt(Kt.r*255,0,255))*65536+Math.round(tt(Kt.g*255,0,255))*256+Math.round(tt(Kt.b*255,0,255))}getHexString(e=kt){return("000000"+this.getHex(e).toString(16)).slice(-6)}getHSL(e,t=st.workingColorSpace){st.workingToColorSpace(Kt.copy(this),t);const n=Kt.r,s=Kt.g,r=Kt.b,a=Math.max(n,s,r),o=Math.min(n,s,r);let l,c;const h=(o+a)/2;if(o===a)l=0,c=0;else{const f=a-o;switch(c=h<=.5?f/(a+o):f/(2-a-o),a){case n:l=(s-r)/f+(s<r?6:0);break;case s:l=(r-n)/f+2;break;case r:l=(n-s)/f+4;break}l/=6}return e.h=l,e.s=c,e.l=h,e}getRGB(e,t=st.workingColorSpace){return st.workingToColorSpace(Kt.copy(this),t),e.r=Kt.r,e.g=Kt.g,e.b=Kt.b,e}getStyle(e=kt){st.workingToColorSpace(Kt.copy(this),e);const t=Kt.r,n=Kt.g,s=Kt.b;return e!==kt?`color(${e} ${t.toFixed(3)} ${n.toFixed(3)} ${s.toFixed(3)})`:`rgb(${Math.round(t*255)},${Math.round(n*255)},${Math.round(s*255)})`}offsetHSL(e,t,n){return this.getHSL(pi),this.setHSL(pi.h+e,pi.s+t,pi.l+n)}add(e){return this.r+=e.r,this.g+=e.g,this.b+=e.b,this}addColors(e,t){return this.r=e.r+t.r,this.g=e.g+t.g,this.b=e.b+t.b,this}addScalar(e){return this.r+=e,this.g+=e,this.b+=e,this}sub(e){return this.r=Math.max(0,this.r-e.r),this.g=Math.max(0,this.g-e.g),this.b=Math.max(0,this.b-e.b),this}multiply(e){return this.r*=e.r,this.g*=e.g,this.b*=e.b,this}multiplyScalar(e){return this.r*=e,this.g*=e,this.b*=e,this}lerp(e,t){return this.r+=(e.r-this.r)*t,this.g+=(e.g-this.g)*t,this.b+=(e.b-this.b)*t,this}lerpColors(e,t,n){return this.r=e.r+(t.r-e.r)*n,this.g=e.g+(t.g-e.g)*n,this.b=e.b+(t.b-e.b)*n,this}lerpHSL(e,t){this.getHSL(pi),e.getHSL(Vr);const n=xr(pi.h,Vr.h,t),s=xr(pi.s,Vr.s,t),r=xr(pi.l,Vr.l,t);return this.setHSL(n,s,r),this}setFromVector3(e){return this.r=e.x,this.g=e.y,this.b=e.z,this}applyMatrix3(e){const t=this.r,n=this.g,s=this.b,r=e.elements;return this.r=r[0]*t+r[3]*n+r[6]*s,this.g=r[1]*t+r[4]*n+r[7]*s,this.b=r[2]*t+r[5]*n+r[8]*s,this}equals(e){return e.r===this.r&&e.g===this.g&&e.b===this.b}fromArray(e,t=0){return this.r=e[t],this.g=e[t+1],this.b=e[t+2],this}toArray(e=[],t=0){return e[t]=this.r,e[t+1]=this.g,e[t+2]=this.b,e}fromBufferAttribute(e,t){return this.r=e.getX(t),this.g=e.getY(t),this.b=e.getZ(t),this}toJSON(){return this.getHex()}*[Symbol.iterator](){yield this.r,yield this.g,yield this.b}}const Kt=new Le;Le.NAMES=Md;class Ga{constructor(e,t=25e-5){this.isFogExp2=!0,this.name="",this.color=new Le(e),this.density=t}clone(){return new Ga(this.color,this.density)}toJSON(){return{type:"FogExp2",name:this.name,color:this.color.getHex(),density:this.density}}}class yd extends Lt{constructor(){super(),this.isScene=!0,this.type="Scene",this.background=null,this.environment=null,this.fog=null,this.backgroundBlurriness=0,this.backgroundIntensity=1,this.backgroundRotation=new Yn,this.environmentIntensity=1,this.environmentRotation=new Yn,this.overrideMaterial=null,typeof __THREE_DEVTOOLS__<"u"&&__THREE_DEVTOOLS__.dispatchEvent(new CustomEvent("observe",{detail:this}))}copy(e,t){return super.copy(e,t),e.background!==null&&(this.background=e.background.clone()),e.environment!==null&&(this.environment=e.environment.clone()),e.fog!==null&&(this.fog=e.fog.clone()),this.backgroundBlurriness=e.backgroundBlurriness,this.backgroundIntensity=e.backgroundIntensity,this.backgroundRotation.copy(e.backgroundRotation),this.environmentIntensity=e.environmentIntensity,this.environmentRotation.copy(e.environmentRotation),e.overrideMaterial!==null&&(this.overrideMaterial=e.overrideMaterial.clone()),this.matrixAutoUpdate=e.matrixAutoUpdate,this}toJSON(e){const t=super.toJSON(e);return this.fog!==null&&(t.object.fog=this.fog.toJSON()),this.backgroundBlurriness>0&&(t.object.backgroundBlurriness=this.backgroundBlurriness),this.backgroundIntensity!==1&&(t.object.backgroundIntensity=this.backgroundIntensity),t.object.backgroundRotation=this.backgroundRotation.toArray(),this.environmentIntensity!==1&&(t.object.environmentIntensity=this.environmentIntensity),t.object.environmentRotation=this.environmentRotation.toArray(),t}}const Tn=new N,Jn=new N,To=new N,Qn=new N,os=new N,ls=new N,zh=new N,Ao=new N,wo=new N,Co=new N,Ro=new Rt,Po=new Rt,Io=new Rt;class xn{constructor(e=new N,t=new N,n=new N){this.a=e,this.b=t,this.c=n}static getNormal(e,t,n,s){s.subVectors(n,t),Tn.subVectors(e,t),s.cross(Tn);const r=s.lengthSq();return r>0?s.multiplyScalar(1/Math.sqrt(r)):s.set(0,0,0)}static getBarycoord(e,t,n,s,r){Tn.subVectors(s,t),Jn.subVectors(n,t),To.subVectors(e,t);const a=Tn.dot(Tn),o=Tn.dot(Jn),l=Tn.dot(To),c=Jn.dot(Jn),h=Jn.dot(To),f=a*c-o*o;if(f===0)return r.set(0,0,0),null;const d=1/f,u=(c*l-o*h)*d,m=(a*h-o*l)*d;return r.set(1-u-m,m,u)}static containsPoint(e,t,n,s){return this.getBarycoord(e,t,n,s,Qn)===null?!1:Qn.x>=0&&Qn.y>=0&&Qn.x+Qn.y<=1}static getInterpolation(e,t,n,s,r,a,o,l){return this.getBarycoord(e,t,n,s,Qn)===null?(l.x=0,l.y=0,"z"in l&&(l.z=0),"w"in l&&(l.w=0),null):(l.setScalar(0),l.addScaledVector(r,Qn.x),l.addScaledVector(a,Qn.y),l.addScaledVector(o,Qn.z),l)}static getInterpolatedAttribute(e,t,n,s,r,a){return Ro.setScalar(0),Po.setScalar(0),Io.setScalar(0),Ro.fromBufferAttribute(e,t),Po.fromBufferAttribute(e,n),Io.fromBufferAttribute(e,s),a.setScalar(0),a.addScaledVector(Ro,r.x),a.addScaledVector(Po,r.y),a.addScaledVector(Io,r.z),a}static isFrontFacing(e,t,n,s){return Tn.subVectors(n,t),Jn.subVectors(e,t),Tn.cross(Jn).dot(s)<0}set(e,t,n){return this.a.copy(e),this.b.copy(t),this.c.copy(n),this}setFromPointsAndIndices(e,t,n,s){return this.a.copy(e[t]),this.b.copy(e[n]),this.c.copy(e[s]),this}setFromAttributeAndIndices(e,t,n,s){return this.a.fromBufferAttribute(e,t),this.b.fromBufferAttribute(e,n),this.c.fromBufferAttribute(e,s),this}clone(){return new this.constructor().copy(this)}copy(e){return this.a.copy(e.a),this.b.copy(e.b),this.c.copy(e.c),this}getArea(){return Tn.subVectors(this.c,this.b),Jn.subVectors(this.a,this.b),Tn.cross(Jn).length()*.5}getMidpoint(e){return e.addVectors(this.a,this.b).add(this.c).multiplyScalar(1/3)}getNormal(e){return xn.getNormal(this.a,this.b,this.c,e)}getPlane(e){return e.setFromCoplanarPoints(this.a,this.b,this.c)}getBarycoord(e,t){return xn.getBarycoord(e,this.a,this.b,this.c,t)}getInterpolation(e,t,n,s,r){return xn.getInterpolation(e,this.a,this.b,this.c,t,n,s,r)}containsPoint(e){return xn.containsPoint(e,this.a,this.b,this.c)}isFrontFacing(e){return xn.isFrontFacing(this.a,this.b,this.c,e)}intersectsBox(e){return e.intersectsTriangle(this)}closestPointToPoint(e,t){const n=this.a,s=this.b,r=this.c;let a,o;os.subVectors(s,n),ls.subVectors(r,n),Ao.subVectors(e,n);const l=os.dot(Ao),c=ls.dot(Ao);if(l<=0&&c<=0)return t.copy(n);wo.subVectors(e,s);const h=os.dot(wo),f=ls.dot(wo);if(h>=0&&f<=h)return t.copy(s);const d=l*f-h*c;if(d<=0&&l>=0&&h<=0)return a=l/(l-h),t.copy(n).addScaledVector(os,a);Co.subVectors(e,r);const u=os.dot(Co),m=ls.dot(Co);if(m>=0&&u<=m)return t.copy(r);const x=u*c-l*m;if(x<=0&&c>=0&&m<=0)return o=c/(c-m),t.copy(n).addScaledVector(ls,o);const v=h*m-u*f;if(v<=0&&f-h>=0&&u-m>=0)return zh.subVectors(r,s),o=(f-h)/(f-h+(u-m)),t.copy(s).addScaledVector(zh,o);const g=1/(v+x+d);return a=x*g,o=d*g,t.copy(n).addScaledVector(os,a).addScaledVector(ls,o)}equals(e){return e.a.equals(this.a)&&e.b.equals(this.b)&&e.c.equals(this.c)}}class $i{constructor(e=new N(1/0,1/0,1/0),t=new N(-1/0,-1/0,-1/0)){this.isBox3=!0,this.min=e,this.max=t}set(e,t){return this.min.copy(e),this.max.copy(t),this}setFromArray(e){this.makeEmpty();for(let t=0,n=e.length;t<n;t+=3)this.expandByPoint(An.fromArray(e,t));return this}setFromBufferAttribute(e){this.makeEmpty();for(let t=0,n=e.count;t<n;t++)this.expandByPoint(An.fromBufferAttribute(e,t));return this}setFromPoints(e){this.makeEmpty();for(let t=0,n=e.length;t<n;t++)this.expandByPoint(e[t]);return this}setFromCenterAndSize(e,t){const n=An.copy(t).multiplyScalar(.5);return this.min.copy(e).sub(n),this.max.copy(e).add(n),this}setFromObject(e,t=!1){return this.makeEmpty(),this.expandByObject(e,t)}clone(){return new this.constructor().copy(this)}copy(e){return this.min.copy(e.min),this.max.copy(e.max),this}makeEmpty(){return this.min.x=this.min.y=this.min.z=1/0,this.max.x=this.max.y=this.max.z=-1/0,this}isEmpty(){return this.max.x<this.min.x||this.max.y<this.min.y||this.max.z<this.min.z}getCenter(e){return this.isEmpty()?e.set(0,0,0):e.addVectors(this.min,this.max).multiplyScalar(.5)}getSize(e){return this.isEmpty()?e.set(0,0,0):e.subVectors(this.max,this.min)}expandByPoint(e){return this.min.min(e),this.max.max(e),this}expandByVector(e){return this.min.sub(e),this.max.add(e),this}expandByScalar(e){return this.min.addScalar(-e),this.max.addScalar(e),this}expandByObject(e,t=!1){e.updateWorldMatrix(!1,!1);const n=e.geometry;if(n!==void 0){const r=n.getAttribute("position");if(t===!0&&r!==void 0&&e.isInstancedMesh!==!0)for(let a=0,o=r.count;a<o;a++)e.isMesh===!0?e.getVertexPosition(a,An):An.fromBufferAttribute(r,a),An.applyMatrix4(e.matrixWorld),this.expandByPoint(An);else e.boundingBox!==void 0?(e.boundingBox===null&&e.computeBoundingBox(),Wr.copy(e.boundingBox)):(n.boundingBox===null&&n.computeBoundingBox(),Wr.copy(n.boundingBox)),Wr.applyMatrix4(e.matrixWorld),this.union(Wr)}const s=e.children;for(let r=0,a=s.length;r<a;r++)this.expandByObject(s[r],t);return this}containsPoint(e){return e.x>=this.min.x&&e.x<=this.max.x&&e.y>=this.min.y&&e.y<=this.max.y&&e.z>=this.min.z&&e.z<=this.max.z}containsBox(e){return this.min.x<=e.min.x&&e.max.x<=this.max.x&&this.min.y<=e.min.y&&e.max.y<=this.max.y&&this.min.z<=e.min.z&&e.max.z<=this.max.z}getParameter(e,t){return t.set((e.x-this.min.x)/(this.max.x-this.min.x),(e.y-this.min.y)/(this.max.y-this.min.y),(e.z-this.min.z)/(this.max.z-this.min.z))}intersectsBox(e){return e.max.x>=this.min.x&&e.min.x<=this.max.x&&e.max.y>=this.min.y&&e.min.y<=this.max.y&&e.max.z>=this.min.z&&e.min.z<=this.max.z}intersectsSphere(e){return this.clampPoint(e.center,An),An.distanceToSquared(e.center)<=e.radius*e.radius}intersectsPlane(e){let t,n;return e.normal.x>0?(t=e.normal.x*this.min.x,n=e.normal.x*this.max.x):(t=e.normal.x*this.max.x,n=e.normal.x*this.min.x),e.normal.y>0?(t+=e.normal.y*this.min.y,n+=e.normal.y*this.max.y):(t+=e.normal.y*this.max.y,n+=e.normal.y*this.min.y),e.normal.z>0?(t+=e.normal.z*this.min.z,n+=e.normal.z*this.max.z):(t+=e.normal.z*this.max.z,n+=e.normal.z*this.min.z),t<=-e.constant&&n>=-e.constant}intersectsTriangle(e){if(this.isEmpty())return!1;this.getCenter(Js),Xr.subVectors(this.max,Js),cs.subVectors(e.a,Js),hs.subVectors(e.b,Js),us.subVectors(e.c,Js),mi.subVectors(hs,cs),gi.subVectors(us,hs),Ci.subVectors(cs,us);let t=[0,-mi.z,mi.y,0,-gi.z,gi.y,0,-Ci.z,Ci.y,mi.z,0,-mi.x,gi.z,0,-gi.x,Ci.z,0,-Ci.x,-mi.y,mi.x,0,-gi.y,gi.x,0,-Ci.y,Ci.x,0];return!Lo(t,cs,hs,us,Xr)||(t=[1,0,0,0,1,0,0,0,1],!Lo(t,cs,hs,us,Xr))?!1:(Yr.crossVectors(mi,gi),t=[Yr.x,Yr.y,Yr.z],Lo(t,cs,hs,us,Xr))}clampPoint(e,t){return t.copy(e).clamp(this.min,this.max)}distanceToPoint(e){return this.clampPoint(e,An).distanceTo(e)}getBoundingSphere(e){return this.isEmpty()?e.makeEmpty():(this.getCenter(e.center),e.radius=this.getSize(An).length()*.5),e}intersect(e){return this.min.max(e.min),this.max.min(e.max),this.isEmpty()&&this.makeEmpty(),this}union(e){return this.min.min(e.min),this.max.max(e.max),this}applyMatrix4(e){return this.isEmpty()?this:(jn[0].set(this.min.x,this.min.y,this.min.z).applyMatrix4(e),jn[1].set(this.min.x,this.min.y,this.max.z).applyMatrix4(e),jn[2].set(this.min.x,this.max.y,this.min.z).applyMatrix4(e),jn[3].set(this.min.x,this.max.y,this.max.z).applyMatrix4(e),jn[4].set(this.max.x,this.min.y,this.min.z).applyMatrix4(e),jn[5].set(this.max.x,this.min.y,this.max.z).applyMatrix4(e),jn[6].set(this.max.x,this.max.y,this.min.z).applyMatrix4(e),jn[7].set(this.max.x,this.max.y,this.max.z).applyMatrix4(e),this.setFromPoints(jn),this)}translate(e){return this.min.add(e),this.max.add(e),this}equals(e){return e.min.equals(this.min)&&e.max.equals(this.max)}toJSON(){return{min:this.min.toArray(),max:this.max.toArray()}}fromJSON(e){return this.min.fromArray(e.min),this.max.fromArray(e.max),this}}const jn=[new N,new N,new N,new N,new N,new N,new N,new N],An=new N,Wr=new $i,cs=new N,hs=new N,us=new N,mi=new N,gi=new N,Ci=new N,Js=new N,Xr=new N,Yr=new N,Ri=new N;function Lo(i,e,t,n,s){for(let r=0,a=i.length-3;r<=a;r+=3){Ri.fromArray(i,r);const o=s.x*Math.abs(Ri.x)+s.y*Math.abs(Ri.y)+s.z*Math.abs(Ri.z),l=e.dot(Ri),c=t.dot(Ri),h=n.dot(Ri);if(Math.max(-Math.max(l,c,h),Math.min(l,c,h))>o)return!1}return!0}const Ut=new N,qr=new fe;let Xm=0;class Gt extends Ki{constructor(e,t,n=!1){if(super(),Array.isArray(e))throw new TypeError("THREE.BufferAttribute: array should be a Typed Array.");this.isBufferAttribute=!0,Object.defineProperty(this,"id",{value:Xm++}),this.name="",this.array=e,this.itemSize=t,this.count=e!==void 0?e.length/t:0,this.normalized=n,this.usage=Ql,this.updateRanges=[],this.gpuType=In,this.version=0}onUploadCallback(){}set needsUpdate(e){e===!0&&this.version++}setUsage(e){return this.usage=e,this}addUpdateRange(e,t){this.updateRanges.push({start:e,count:t})}clearUpdateRanges(){this.updateRanges.length=0}copy(e){return this.name=e.name,this.array=new e.array.constructor(e.array),this.itemSize=e.itemSize,this.count=e.count,this.normalized=e.normalized,this.usage=e.usage,this.gpuType=e.gpuType,this}copyAt(e,t,n){e*=this.itemSize,n*=t.itemSize;for(let s=0,r=this.itemSize;s<r;s++)this.array[e+s]=t.array[n+s];return this}copyArray(e){return this.array.set(e),this}applyMatrix3(e){if(this.itemSize===2)for(let t=0,n=this.count;t<n;t++)qr.fromBufferAttribute(this,t),qr.applyMatrix3(e),this.setXY(t,qr.x,qr.y);else if(this.itemSize===3)for(let t=0,n=this.count;t<n;t++)Ut.fromBufferAttribute(this,t),Ut.applyMatrix3(e),this.setXYZ(t,Ut.x,Ut.y,Ut.z);return this}applyMatrix4(e){for(let t=0,n=this.count;t<n;t++)Ut.fromBufferAttribute(this,t),Ut.applyMatrix4(e),this.setXYZ(t,Ut.x,Ut.y,Ut.z);return this}applyNormalMatrix(e){for(let t=0,n=this.count;t<n;t++)Ut.fromBufferAttribute(this,t),Ut.applyNormalMatrix(e),this.setXYZ(t,Ut.x,Ut.y,Ut.z);return this}transformDirection(e){for(let t=0,n=this.count;t<n;t++)Ut.fromBufferAttribute(this,t),Ut.transformDirection(e),this.setXYZ(t,Ut.x,Ut.y,Ut.z);return this}set(e,t=0){return this.array.set(e,t),this}getComponent(e,t){let n=this.array[e*this.itemSize+t];return this.normalized&&(n=Rn(n,this.array)),n}setComponent(e,t,n){return this.normalized&&(n=gt(n,this.array)),this.array[e*this.itemSize+t]=n,this}getX(e){let t=this.array[e*this.itemSize];return this.normalized&&(t=Rn(t,this.array)),t}setX(e,t){return this.normalized&&(t=gt(t,this.array)),this.array[e*this.itemSize]=t,this}getY(e){let t=this.array[e*this.itemSize+1];return this.normalized&&(t=Rn(t,this.array)),t}setY(e,t){return this.normalized&&(t=gt(t,this.array)),this.array[e*this.itemSize+1]=t,this}getZ(e){let t=this.array[e*this.itemSize+2];return this.normalized&&(t=Rn(t,this.array)),t}setZ(e,t){return this.normalized&&(t=gt(t,this.array)),this.array[e*this.itemSize+2]=t,this}getW(e){let t=this.array[e*this.itemSize+3];return this.normalized&&(t=Rn(t,this.array)),t}setW(e,t){return this.normalized&&(t=gt(t,this.array)),this.array[e*this.itemSize+3]=t,this}setXY(e,t,n){return e*=this.itemSize,this.normalized&&(t=gt(t,this.array),n=gt(n,this.array)),this.array[e+0]=t,this.array[e+1]=n,this}setXYZ(e,t,n,s){return e*=this.itemSize,this.normalized&&(t=gt(t,this.array),n=gt(n,this.array),s=gt(s,this.array)),this.array[e+0]=t,this.array[e+1]=n,this.array[e+2]=s,this}setXYZW(e,t,n,s,r){return e*=this.itemSize,this.normalized&&(t=gt(t,this.array),n=gt(n,this.array),s=gt(s,this.array),r=gt(r,this.array)),this.array[e+0]=t,this.array[e+1]=n,this.array[e+2]=s,this.array[e+3]=r,this}onUpload(e){return this.onUploadCallback=e,this}clone(){return new this.constructor(this.array,this.itemSize).copy(this)}toJSON(){const e={itemSize:this.itemSize,type:this.array.constructor.name,array:Array.from(this.array),normalized:this.normalized};return this.name!==""&&(e.name=this.name),this.usage!==Ql&&(e.usage=this.usage),e}dispose(){this.dispatchEvent({type:"dispose"})}}class bd extends Gt{constructor(e,t,n){super(new Uint16Array(e),t,n)}}class Ed extends Gt{constructor(e,t,n){super(new Uint32Array(e),t,n)}}class _t extends Gt{constructor(e,t,n){super(new Float32Array(e),t,n)}}const Ym=new $i,Qs=new N,Do=new N;class ks{constructor(e=new N,t=-1){this.isSphere=!0,this.center=e,this.radius=t}set(e,t){return this.center.copy(e),this.radius=t,this}setFromPoints(e,t){const n=this.center;t!==void 0?n.copy(t):Ym.setFromPoints(e).getCenter(n);let s=0;for(let r=0,a=e.length;r<a;r++)s=Math.max(s,n.distanceToSquared(e[r]));return this.radius=Math.sqrt(s),this}copy(e){return this.center.copy(e.center),this.radius=e.radius,this}isEmpty(){return this.radius<0}makeEmpty(){return this.center.set(0,0,0),this.radius=-1,this}containsPoint(e){return e.distanceToSquared(this.center)<=this.radius*this.radius}distanceToPoint(e){return e.distanceTo(this.center)-this.radius}intersectsSphere(e){const t=this.radius+e.radius;return e.center.distanceToSquared(this.center)<=t*t}intersectsBox(e){return e.intersectsSphere(this)}intersectsPlane(e){return Math.abs(e.distanceToPoint(this.center))<=this.radius}clampPoint(e,t){const n=this.center.distanceToSquared(e);return t.copy(e),n>this.radius*this.radius&&(t.sub(this.center).normalize(),t.multiplyScalar(this.radius).add(this.center)),t}getBoundingBox(e){return this.isEmpty()?(e.makeEmpty(),e):(e.set(this.center,this.center),e.expandByScalar(this.radius),e)}applyMatrix4(e){return this.center.applyMatrix4(e),this.radius=this.radius*e.getMaxScaleOnAxis(),this}translate(e){return this.center.add(e),this}expandByPoint(e){if(this.isEmpty())return this.center.copy(e),this.radius=0,this;Qs.subVectors(e,this.center);const t=Qs.lengthSq();if(t>this.radius*this.radius){const n=Math.sqrt(t),s=(n-this.radius)*.5;this.center.addScaledVector(Qs,s/n),this.radius+=s}return this}union(e){return e.isEmpty()?this:this.isEmpty()?(this.copy(e),this):(this.center.equals(e.center)===!0?this.radius=Math.max(this.radius,e.radius):(Do.subVectors(e.center,this.center).setLength(e.radius),this.expandByPoint(Qs.copy(e.center).add(Do)),this.expandByPoint(Qs.copy(e.center).sub(Do))),this)}equals(e){return e.center.equals(this.center)&&e.radius===this.radius}clone(){return new this.constructor().copy(this)}toJSON(){return{radius:this.radius,center:this.center.toArray()}}fromJSON(e){return this.radius=e.radius,this.center.fromArray(e.center),this}}let qm=0;const vn=new ut,No=new Lt,ds=new N,ln=new $i,js=new $i,Vt=new N;class It extends Ki{constructor(){super(),this.isBufferGeometry=!0,Object.defineProperty(this,"id",{value:qm++}),this.uuid=Hn(),this.name="",this.type="BufferGeometry",this.index=null,this.indirect=null,this.indirectOffset=0,this.attributes={},this.morphAttributes={},this.morphTargetsRelative=!1,this.groups=[],this.boundingBox=null,this.boundingSphere=null,this.drawRange={start:0,count:1/0},this.userData={},this._transformed=!1}getIndex(){return this.index}setIndex(e){return Array.isArray(e)?this.index=new(dm(e)?Ed:bd)(e,1):this.index=e,this}setIndirect(e,t=0){return this.indirect=e,this.indirectOffset=t,this}getIndirect(){return this.indirect}getAttribute(e){return this.attributes[e]}setAttribute(e,t){return this.attributes[e]=t,this}deleteAttribute(e){return delete this.attributes[e],this}hasAttribute(e){return this.attributes[e]!==void 0}addGroup(e,t,n=0){this.groups.push({start:e,count:t,materialIndex:n})}clearGroups(){this.groups=[]}setDrawRange(e,t){this.drawRange.start=e,this.drawRange.count=t}applyMatrix4(e){const t=this.attributes.position;t!==void 0&&(t.applyMatrix4(e),t.needsUpdate=!0);const n=this.attributes.normal;if(n!==void 0){const r=new Je().getNormalMatrix(e);n.applyNormalMatrix(r),n.needsUpdate=!0}const s=this.attributes.tangent;return s!==void 0&&(s.transformDirection(e),s.needsUpdate=!0),this.boundingBox!==null&&this.computeBoundingBox(),this.boundingSphere!==null&&this.computeBoundingSphere(),this._transformed=!0,this}applyQuaternion(e){return vn.makeRotationFromQuaternion(e),this.applyMatrix4(vn),this}rotateX(e){return vn.makeRotationX(e),this.applyMatrix4(vn),this}rotateY(e){return vn.makeRotationY(e),this.applyMatrix4(vn),this}rotateZ(e){return vn.makeRotationZ(e),this.applyMatrix4(vn),this}translate(e,t,n){return vn.makeTranslation(e,t,n),this.applyMatrix4(vn),this}scale(e,t,n){return vn.makeScale(e,t,n),this.applyMatrix4(vn),this}lookAt(e){return No.lookAt(e),No.updateMatrix(),this.applyMatrix4(No.matrix),this}center(){return this.computeBoundingBox(),this.boundingBox.getCenter(ds).negate(),this.translate(ds.x,ds.y,ds.z),this}setFromPoints(e){const t=this.getAttribute("position");if(t===void 0){const n=[];for(let s=0,r=e.length;s<r;s++){const a=e[s];n.push(a.x,a.y,a.z||0)}this.setAttribute("position",new _t(n,3))}else{const n=Math.min(e.length,t.count);for(let s=0;s<n;s++){const r=e[s];t.setXYZ(s,r.x,r.y,r.z||0)}e.length>t.count&&Ke("BufferGeometry: Buffer size too small for points data. Use .dispose() and create a new geometry."),t.needsUpdate=!0}return this}computeBoundingBox(){this.boundingBox===null&&(this.boundingBox=new $i);const e=this.attributes.position,t=this.morphAttributes.position;if(e&&e.isGLBufferAttribute){at("BufferGeometry.computeBoundingBox(): GLBufferAttribute requires a manual bounding box.",this),this.boundingBox.set(new N(-1/0,-1/0,-1/0),new N(1/0,1/0,1/0));return}if(e!==void 0){if(this.boundingBox.setFromBufferAttribute(e),t)for(let n=0,s=t.length;n<s;n++){const r=t[n];ln.setFromBufferAttribute(r),this.morphTargetsRelative?(Vt.addVectors(this.boundingBox.min,ln.min),this.boundingBox.expandByPoint(Vt),Vt.addVectors(this.boundingBox.max,ln.max),this.boundingBox.expandByPoint(Vt)):(this.boundingBox.expandByPoint(ln.min),this.boundingBox.expandByPoint(ln.max))}}else this.boundingBox.makeEmpty();(isNaN(this.boundingBox.min.x)||isNaN(this.boundingBox.min.y)||isNaN(this.boundingBox.min.z))&&at('BufferGeometry.computeBoundingBox(): Computed min/max have NaN values. The "position" attribute is likely to have NaN values.',this)}computeBoundingSphere(){this.boundingSphere===null&&(this.boundingSphere=new ks);const e=this.attributes.position,t=this.morphAttributes.position;if(e&&e.isGLBufferAttribute){at("BufferGeometry.computeBoundingSphere(): GLBufferAttribute requires a manual bounding sphere.",this),this.boundingSphere.set(new N,1/0);return}if(e){const n=this.boundingSphere.center;if(ln.setFromBufferAttribute(e),t)for(let r=0,a=t.length;r<a;r++){const o=t[r];js.setFromBufferAttribute(o),this.morphTargetsRelative?(Vt.addVectors(ln.min,js.min),ln.expandByPoint(Vt),Vt.addVectors(ln.max,js.max),ln.expandByPoint(Vt)):(ln.expandByPoint(js.min),ln.expandByPoint(js.max))}ln.getCenter(n);let s=0;for(let r=0,a=e.count;r<a;r++)Vt.fromBufferAttribute(e,r),s=Math.max(s,n.distanceToSquared(Vt));if(t)for(let r=0,a=t.length;r<a;r++){const o=t[r],l=this.morphTargetsRelative;for(let c=0,h=o.count;c<h;c++)Vt.fromBufferAttribute(o,c),l&&(ds.fromBufferAttribute(e,c),Vt.add(ds)),s=Math.max(s,n.distanceToSquared(Vt))}this.boundingSphere.radius=Math.sqrt(s),isNaN(this.boundingSphere.radius)&&at('BufferGeometry.computeBoundingSphere(): Computed radius is NaN. The "position" attribute is likely to have NaN values.',this)}}computeTangents(){const e=this.index,t=this.attributes;if(e===null||t.position===void 0||t.normal===void 0||t.uv===void 0){at("BufferGeometry: .computeTangents() failed. Missing required attributes (index, position, normal or uv)");return}const n=t.position,s=t.normal,r=t.uv;let a=this.getAttribute("tangent");(a===void 0||a.count!==n.count)&&(a=new Gt(new Float32Array(4*n.count),4),this.setAttribute("tangent",a));const o=[],l=[];for(let _=0;_<n.count;_++)o[_]=new N,l[_]=new N;const c=new N,h=new N,f=new N,d=new fe,u=new fe,m=new fe,x=new N,v=new N;function g(_,b,P){c.fromBufferAttribute(n,_),h.fromBufferAttribute(n,b),f.fromBufferAttribute(n,P),d.fromBufferAttribute(r,_),u.fromBufferAttribute(r,b),m.fromBufferAttribute(r,P),h.sub(c),f.sub(c),u.sub(d),m.sub(d);const L=1/(u.x*m.y-m.x*u.y);isFinite(L)&&(x.copy(h).multiplyScalar(m.y).addScaledVector(f,-u.y).multiplyScalar(L),v.copy(f).multiplyScalar(u.x).addScaledVector(h,-m.x).multiplyScalar(L),o[_].add(x),o[b].add(x),o[P].add(x),l[_].add(v),l[b].add(v),l[P].add(v))}let y=this.groups;y.length===0&&(y=[{start:0,count:e.count}]);for(let _=0,b=y.length;_<b;++_){const P=y[_],L=P.start,B=P.count;for(let Y=L,p=L+B;Y<p;Y+=3)g(e.getX(Y+0),e.getX(Y+1),e.getX(Y+2))}const E=new N,M=new N,T=new N,w=new N;function R(_){T.fromBufferAttribute(s,_),w.copy(T);const b=o[_];E.copy(b),E.sub(T.multiplyScalar(T.dot(b))).normalize(),M.crossVectors(w,b);const L=M.dot(l[_])<0?-1:1;a.setXYZW(_,E.x,E.y,E.z,L)}for(let _=0,b=y.length;_<b;++_){const P=y[_],L=P.start,B=P.count;for(let Y=L,p=L+B;Y<p;Y+=3)R(e.getX(Y+0)),R(e.getX(Y+1)),R(e.getX(Y+2))}this._transformed=!0}computeVertexNormals(){const e=this.index,t=this.getAttribute("position");if(t!==void 0){let n=this.getAttribute("normal");if(n===void 0||n.count!==t.count)n=new Gt(new Float32Array(t.count*3),3),this.setAttribute("normal",n);else for(let d=0,u=n.count;d<u;d++)n.setXYZ(d,0,0,0);const s=new N,r=new N,a=new N,o=new N,l=new N,c=new N,h=new N,f=new N;if(e)for(let d=0,u=e.count;d<u;d+=3){const m=e.getX(d+0),x=e.getX(d+1),v=e.getX(d+2);s.fromBufferAttribute(t,m),r.fromBufferAttribute(t,x),a.fromBufferAttribute(t,v),h.subVectors(a,r),f.subVectors(s,r),h.cross(f),o.fromBufferAttribute(n,m),l.fromBufferAttribute(n,x),c.fromBufferAttribute(n,v),o.add(h),l.add(h),c.add(h),n.setXYZ(m,o.x,o.y,o.z),n.setXYZ(x,l.x,l.y,l.z),n.setXYZ(v,c.x,c.y,c.z)}else for(let d=0,u=t.count;d<u;d+=3)s.fromBufferAttribute(t,d+0),r.fromBufferAttribute(t,d+1),a.fromBufferAttribute(t,d+2),h.subVectors(a,r),f.subVectors(s,r),h.cross(f),n.setXYZ(d+0,h.x,h.y,h.z),n.setXYZ(d+1,h.x,h.y,h.z),n.setXYZ(d+2,h.x,h.y,h.z);this.normalizeNormals(),n.needsUpdate=!0}}normalizeNormals(){const e=this.attributes.normal;for(let t=0,n=e.count;t<n;t++)Vt.fromBufferAttribute(e,t),Vt.normalize(),e.setXYZ(t,Vt.x,Vt.y,Vt.z)}toNonIndexed(){function e(o,l){const c=o.array,h=o.itemSize,f=o.normalized,d=new c.constructor(l.length*h);let u=0,m=0;for(let x=0,v=l.length;x<v;x++){o.isInterleavedBufferAttribute?u=l[x]*o.data.stride+o.offset:u=l[x]*h;for(let g=0;g<h;g++)d[m++]=c[u++]}return new Gt(d,h,f)}if(this.index===null)return Ke("BufferGeometry.toNonIndexed(): BufferGeometry is already non-indexed."),this;const t=new It,n=this.index.array,s=this.attributes;for(const o in s){const l=s[o],c=e(l,n);t.setAttribute(o,c)}const r=this.morphAttributes;for(const o in r){const l=[],c=r[o];for(let h=0,f=c.length;h<f;h++){const d=c[h],u=e(d,n);l.push(u)}t.morphAttributes[o]=l}t.morphTargetsRelative=this.morphTargetsRelative;const a=this.groups;for(let o=0,l=a.length;o<l;o++){const c=a[o];t.addGroup(c.start,c.count,c.materialIndex)}return t}toJSON(){const e={metadata:{version:4.7,type:"BufferGeometry",generator:"BufferGeometry.toJSON"}};if(e.uuid=this.uuid,e.type=this.parameters!==void 0&&this._transformed===!0?"BufferGeometry":this.type,this.name!==""&&(e.name=this.name),Object.keys(this.userData).length>0&&(e.userData=this.userData),this.parameters!==void 0&&this._transformed!==!0){const l=this.parameters;for(const c in l)l[c]!==void 0&&(e[c]=l[c]);return e}e.data={attributes:{}};const t=this.index;t!==null&&(e.data.index={type:t.array.constructor.name,array:Array.prototype.slice.call(t.array)});const n=this.attributes;for(const l in n){const c=n[l];e.data.attributes[l]=c.toJSON(e.data)}const s={};let r=!1;for(const l in this.morphAttributes){const c=this.morphAttributes[l],h=[];for(let f=0,d=c.length;f<d;f++){const u=c[f];h.push(u.toJSON(e.data))}h.length>0&&(s[l]=h,r=!0)}r&&(e.data.morphAttributes=s,e.data.morphTargetsRelative=this.morphTargetsRelative);const a=this.groups;a.length>0&&(e.data.groups=JSON.parse(JSON.stringify(a)));const o=this.boundingSphere;return o!==null&&(e.data.boundingSphere=o.toJSON()),e}clone(){return new this.constructor().copy(this)}copy(e){this.index=null,this.attributes={},this.morphAttributes={},this.groups=[],this.boundingBox=null,this.boundingSphere=null;const t={};this.name=e.name;const n=e.index;n!==null&&this.setIndex(n.clone());const s=e.attributes;for(const c in s){const h=s[c];this.setAttribute(c,h.clone(t))}const r=e.morphAttributes;for(const c in r){const h=[],f=r[c];for(let d=0,u=f.length;d<u;d++)h.push(f[d].clone(t));this.morphAttributes[c]=h}this.morphTargetsRelative=e.morphTargetsRelative;const a=e.groups;for(let c=0,h=a.length;c<h;c++){const f=a[c];this.addGroup(f.start,f.count,f.materialIndex)}const o=e.boundingBox;o!==null&&(this.boundingBox=o.clone());const l=e.boundingSphere;return l!==null&&(this.boundingSphere=l.clone()),this.drawRange.start=e.drawRange.start,this.drawRange.count=e.drawRange.count,this.userData=e.userData,this._transformed=e._transformed,this}dispose(){this.dispatchEvent({type:"dispose"})}}class Km{constructor(e,t){this.isInterleavedBuffer=!0,this.array=e,this.stride=t,this.count=e!==void 0?e.length/t:0,this.usage=Ql,this.updateRanges=[],this.version=0,this.uuid=Hn()}onUploadCallback(){}set needsUpdate(e){e===!0&&this.version++}setUsage(e){return this.usage=e,this}addUpdateRange(e,t){this.updateRanges.push({start:e,count:t})}clearUpdateRanges(){this.updateRanges.length=0}copy(e){return this.array=new e.array.constructor(e.array),this.count=e.count,this.stride=e.stride,this.usage=e.usage,this}copyAt(e,t,n){e*=this.stride,n*=t.stride;for(let s=0,r=this.stride;s<r;s++)this.array[e+s]=t.array[n+s];return this}set(e,t=0){return this.array.set(e,t),this}clone(e){e.arrayBuffers===void 0&&(e.arrayBuffers={}),this.array.buffer._uuid===void 0&&(this.array.buffer._uuid=Hn()),e.arrayBuffers[this.array.buffer._uuid]===void 0&&(e.arrayBuffers[this.array.buffer._uuid]=this.array.slice(0).buffer);const t=new this.array.constructor(e.arrayBuffers[this.array.buffer._uuid]),n=new this.constructor(t,this.stride);return n.setUsage(this.usage),n}onUpload(e){return this.onUploadCallback=e,this}toJSON(e){return e.arrayBuffers===void 0&&(e.arrayBuffers={}),this.array.buffer._uuid===void 0&&(this.array.buffer._uuid=Hn()),e.arrayBuffers[this.array.buffer._uuid]===void 0&&(e.arrayBuffers[this.array.buffer._uuid]=Array.from(new Uint32Array(this.array.buffer))),{uuid:this.uuid,buffer:this.array.buffer._uuid,type:this.array.constructor.name,stride:this.stride}}}const Zt=new N;class za{constructor(e,t,n,s=!1){this.isInterleavedBufferAttribute=!0,this.name="",this.data=e,this.itemSize=t,this.offset=n,this.normalized=s}get count(){return this.data.count}get array(){return this.data.array}set needsUpdate(e){this.data.needsUpdate=e}applyMatrix4(e){for(let t=0,n=this.data.count;t<n;t++)Zt.fromBufferAttribute(this,t),Zt.applyMatrix4(e),this.setXYZ(t,Zt.x,Zt.y,Zt.z);return this}applyNormalMatrix(e){for(let t=0,n=this.count;t<n;t++)Zt.fromBufferAttribute(this,t),Zt.applyNormalMatrix(e),this.setXYZ(t,Zt.x,Zt.y,Zt.z);return this}transformDirection(e){for(let t=0,n=this.count;t<n;t++)Zt.fromBufferAttribute(this,t),Zt.transformDirection(e),this.setXYZ(t,Zt.x,Zt.y,Zt.z);return this}getComponent(e,t){let n=this.array[e*this.data.stride+this.offset+t];return this.normalized&&(n=Rn(n,this.array)),n}setComponent(e,t,n){return this.normalized&&(n=gt(n,this.array)),this.data.array[e*this.data.stride+this.offset+t]=n,this}setX(e,t){return this.normalized&&(t=gt(t,this.array)),this.data.array[e*this.data.stride+this.offset]=t,this}setY(e,t){return this.normalized&&(t=gt(t,this.array)),this.data.array[e*this.data.stride+this.offset+1]=t,this}setZ(e,t){return this.normalized&&(t=gt(t,this.array)),this.data.array[e*this.data.stride+this.offset+2]=t,this}setW(e,t){return this.normalized&&(t=gt(t,this.array)),this.data.array[e*this.data.stride+this.offset+3]=t,this}getX(e){let t=this.data.array[e*this.data.stride+this.offset];return this.normalized&&(t=Rn(t,this.array)),t}getY(e){let t=this.data.array[e*this.data.stride+this.offset+1];return this.normalized&&(t=Rn(t,this.array)),t}getZ(e){let t=this.data.array[e*this.data.stride+this.offset+2];return this.normalized&&(t=Rn(t,this.array)),t}getW(e){let t=this.data.array[e*this.data.stride+this.offset+3];return this.normalized&&(t=Rn(t,this.array)),t}setXY(e,t,n){return e=e*this.data.stride+this.offset,this.normalized&&(t=gt(t,this.array),n=gt(n,this.array)),this.data.array[e+0]=t,this.data.array[e+1]=n,this}setXYZ(e,t,n,s){return e=e*this.data.stride+this.offset,this.normalized&&(t=gt(t,this.array),n=gt(n,this.array),s=gt(s,this.array)),this.data.array[e+0]=t,this.data.array[e+1]=n,this.data.array[e+2]=s,this}setXYZW(e,t,n,s,r){return e=e*this.data.stride+this.offset,this.normalized&&(t=gt(t,this.array),n=gt(n,this.array),s=gt(s,this.array),r=gt(r,this.array)),this.data.array[e+0]=t,this.data.array[e+1]=n,this.data.array[e+2]=s,this.data.array[e+3]=r,this}clone(e){if(e===void 0){ka("InterleavedBufferAttribute.clone(): Cloning an interleaved buffer attribute will de-interleave buffer data.");const t=[];for(let n=0;n<this.count;n++){const s=n*this.data.stride+this.offset;for(let r=0;r<this.itemSize;r++)t.push(this.data.array[s+r])}return new Gt(new this.array.constructor(t),this.itemSize,this.normalized)}else return e.interleavedBuffers===void 0&&(e.interleavedBuffers={}),e.interleavedBuffers[this.data.uuid]===void 0&&(e.interleavedBuffers[this.data.uuid]=this.data.clone(e)),new za(e.interleavedBuffers[this.data.uuid],this.itemSize,this.offset,this.normalized)}toJSON(e){if(e===void 0){ka("InterleavedBufferAttribute.toJSON(): Serializing an interleaved buffer attribute will de-interleave buffer data.");const t=[];for(let n=0;n<this.count;n++){const s=n*this.data.stride+this.offset;for(let r=0;r<this.itemSize;r++)t.push(this.data.array[s+r])}return{itemSize:this.itemSize,type:this.array.constructor.name,array:t,normalized:this.normalized}}else return e.interleavedBuffers===void 0&&(e.interleavedBuffers={}),e.interleavedBuffers[this.data.uuid]===void 0&&(e.interleavedBuffers[this.data.uuid]=this.data.toJSON(e)),{isInterleavedBufferAttribute:!0,itemSize:this.itemSize,data:this.data.uuid,offset:this.offset,normalized:this.normalized}}}let $m=0;class Ti extends Ki{constructor(){super(),this.isMaterial=!0,Object.defineProperty(this,"id",{value:$m++}),this.uuid=Hn(),this.name="",this.type="Material",this.blending=Oi,this.side=li,this.vertexColors=!1,this.opacity=1,this.transparent=!1,this.alphaHash=!1,this.blendSrc=ul,this.blendDst=dl,this.blendEquation=Di,this.blendSrcAlpha=null,this.blendDstAlpha=null,this.blendEquationAlpha=null,this.blendColor=new Le(0,0,0),this.blendAlpha=0,this.depthFunc=Ps,this.depthTest=!0,this.depthWrite=!0,this.stencilWriteMask=255,this.stencilFunc=wh,this.stencilRef=0,this.stencilFuncMask=255,this.stencilFail=ns,this.stencilZFail=ns,this.stencilZPass=ns,this.stencilWrite=!1,this.clippingPlanes=null,this.clipIntersection=!1,this.clipShadows=!1,this.shadowSide=null,this.colorWrite=!0,this.precision=null,this.polygonOffset=!1,this.polygonOffsetFactor=0,this.polygonOffsetUnits=0,this.dithering=!1,this.alphaToCoverage=!1,this.premultipliedAlpha=!1,this.forceSinglePass=!1,this.allowOverride=!0,this.visible=!0,this.toneMapped=!0,this.userData={},this.version=0,this._alphaTest=0}get alphaTest(){return this._alphaTest}set alphaTest(e){this._alphaTest>0!=e>0&&this.version++,this._alphaTest=e}onBeforeRender(){}onBeforeCompile(){}customProgramCacheKey(){return this.onBeforeCompile.toString()}setValues(e){if(e!==void 0)for(const t in e){const n=e[t];if(n===void 0){Ke(`Material: parameter '${t}' has value of undefined.`);continue}const s=this[t];if(s===void 0){Ke(`Material: '${t}' is not a property of THREE.${this.type}.`);continue}s&&s.isColor?s.set(n):s&&s.isVector2&&n&&n.isVector2||s&&s.isEuler&&n&&n.isEuler||s&&s.isVector3&&n&&n.isVector3?s.copy(n):this[t]=n}}toJSON(e){const t=e===void 0||typeof e=="string";t&&(e={textures:{},images:{}});const n={metadata:{version:4.7,type:"Material",generator:"Material.toJSON"}};n.uuid=this.uuid,n.type=this.type,this.name!==""&&(n.name=this.name),this.color&&this.color.isColor&&(n.color=this.color.getHex()),this.roughness!==void 0&&(n.roughness=this.roughness),this.metalness!==void 0&&(n.metalness=this.metalness),this.sheen!==void 0&&(n.sheen=this.sheen),this.sheenColor&&this.sheenColor.isColor&&(n.sheenColor=this.sheenColor.getHex()),this.sheenRoughness!==void 0&&(n.sheenRoughness=this.sheenRoughness),this.emissive&&this.emissive.isColor&&(n.emissive=this.emissive.getHex()),this.emissiveIntensity!==void 0&&this.emissiveIntensity!==1&&(n.emissiveIntensity=this.emissiveIntensity),this.specular&&this.specular.isColor&&(n.specular=this.specular.getHex()),this.specularIntensity!==void 0&&(n.specularIntensity=this.specularIntensity),this.specularColor&&this.specularColor.isColor&&(n.specularColor=this.specularColor.getHex()),this.shininess!==void 0&&(n.shininess=this.shininess),this.clearcoat!==void 0&&(n.clearcoat=this.clearcoat),this.clearcoatRoughness!==void 0&&(n.clearcoatRoughness=this.clearcoatRoughness),this.clearcoatMap&&this.clearcoatMap.isTexture&&(n.clearcoatMap=this.clearcoatMap.toJSON(e).uuid),this.clearcoatRoughnessMap&&this.clearcoatRoughnessMap.isTexture&&(n.clearcoatRoughnessMap=this.clearcoatRoughnessMap.toJSON(e).uuid),this.clearcoatNormalMap&&this.clearcoatNormalMap.isTexture&&(n.clearcoatNormalMap=this.clearcoatNormalMap.toJSON(e).uuid,n.clearcoatNormalScale=this.clearcoatNormalScale.toArray()),this.sheenColorMap&&this.sheenColorMap.isTexture&&(n.sheenColorMap=this.sheenColorMap.toJSON(e).uuid),this.sheenRoughnessMap&&this.sheenRoughnessMap.isTexture&&(n.sheenRoughnessMap=this.sheenRoughnessMap.toJSON(e).uuid),this.dispersion!==void 0&&(n.dispersion=this.dispersion),this.iridescence!==void 0&&(n.iridescence=this.iridescence),this.iridescenceIOR!==void 0&&(n.iridescenceIOR=this.iridescenceIOR),this.iridescenceThicknessRange!==void 0&&(n.iridescenceThicknessRange=this.iridescenceThicknessRange),this.iridescenceMap&&this.iridescenceMap.isTexture&&(n.iridescenceMap=this.iridescenceMap.toJSON(e).uuid),this.iridescenceThicknessMap&&this.iridescenceThicknessMap.isTexture&&(n.iridescenceThicknessMap=this.iridescenceThicknessMap.toJSON(e).uuid),this.anisotropy!==void 0&&(n.anisotropy=this.anisotropy),this.anisotropyRotation!==void 0&&(n.anisotropyRotation=this.anisotropyRotation),this.anisotropyMap&&this.anisotropyMap.isTexture&&(n.anisotropyMap=this.anisotropyMap.toJSON(e).uuid),this.map&&this.map.isTexture&&(n.map=this.map.toJSON(e).uuid),this.matcap&&this.matcap.isTexture&&(n.matcap=this.matcap.toJSON(e).uuid),this.alphaMap&&this.alphaMap.isTexture&&(n.alphaMap=this.alphaMap.toJSON(e).uuid),this.lightMap&&this.lightMap.isTexture&&(n.lightMap=this.lightMap.toJSON(e).uuid,n.lightMapIntensity=this.lightMapIntensity),this.aoMap&&this.aoMap.isTexture&&(n.aoMap=this.aoMap.toJSON(e).uuid,n.aoMapIntensity=this.aoMapIntensity),this.bumpMap&&this.bumpMap.isTexture&&(n.bumpMap=this.bumpMap.toJSON(e).uuid,n.bumpScale=this.bumpScale),this.normalMap&&this.normalMap.isTexture&&(n.normalMap=this.normalMap.toJSON(e).uuid,n.normalMapType=this.normalMapType,n.normalScale=this.normalScale.toArray()),this.displacementMap&&this.displacementMap.isTexture&&(n.displacementMap=this.displacementMap.toJSON(e).uuid,n.displacementScale=this.displacementScale,n.displacementBias=this.displacementBias),this.roughnessMap&&this.roughnessMap.isTexture&&(n.roughnessMap=this.roughnessMap.toJSON(e).uuid),this.metalnessMap&&this.metalnessMap.isTexture&&(n.metalnessMap=this.metalnessMap.toJSON(e).uuid),this.emissiveMap&&this.emissiveMap.isTexture&&(n.emissiveMap=this.emissiveMap.toJSON(e).uuid),this.specularMap&&this.specularMap.isTexture&&(n.specularMap=this.specularMap.toJSON(e).uuid),this.specularIntensityMap&&this.specularIntensityMap.isTexture&&(n.specularIntensityMap=this.specularIntensityMap.toJSON(e).uuid),this.specularColorMap&&this.specularColorMap.isTexture&&(n.specularColorMap=this.specularColorMap.toJSON(e).uuid),this.envMap&&this.envMap.isTexture&&(n.envMap=this.envMap.toJSON(e).uuid,this.combine!==void 0&&(n.combine=this.combine)),this.envMapRotation!==void 0&&(n.envMapRotation=this.envMapRotation.toArray()),this.envMapIntensity!==void 0&&(n.envMapIntensity=this.envMapIntensity),this.reflectivity!==void 0&&(n.reflectivity=this.reflectivity),this.refractionRatio!==void 0&&(n.refractionRatio=this.refractionRatio),this.gradientMap&&this.gradientMap.isTexture&&(n.gradientMap=this.gradientMap.toJSON(e).uuid),this.transmission!==void 0&&(n.transmission=this.transmission),this.transmissionMap&&this.transmissionMap.isTexture&&(n.transmissionMap=this.transmissionMap.toJSON(e).uuid),this.thickness!==void 0&&(n.thickness=this.thickness),this.thicknessMap&&this.thicknessMap.isTexture&&(n.thicknessMap=this.thicknessMap.toJSON(e).uuid),this.attenuationDistance!==void 0&&this.attenuationDistance!==1/0&&(n.attenuationDistance=this.attenuationDistance),this.attenuationColor!==void 0&&(n.attenuationColor=this.attenuationColor.getHex()),this.size!==void 0&&(n.size=this.size),this.shadowSide!==null&&(n.shadowSide=this.shadowSide),this.sizeAttenuation!==void 0&&(n.sizeAttenuation=this.sizeAttenuation),this.blending!==Oi&&(n.blending=this.blending),this.side!==li&&(n.side=this.side),this.vertexColors===!0&&(n.vertexColors=!0),this.opacity<1&&(n.opacity=this.opacity),this.transparent===!0&&(n.transparent=!0),this.blendSrc!==ul&&(n.blendSrc=this.blendSrc),this.blendDst!==dl&&(n.blendDst=this.blendDst),this.blendEquation!==Di&&(n.blendEquation=this.blendEquation),this.blendSrcAlpha!==null&&(n.blendSrcAlpha=this.blendSrcAlpha),this.blendDstAlpha!==null&&(n.blendDstAlpha=this.blendDstAlpha),this.blendEquationAlpha!==null&&(n.blendEquationAlpha=this.blendEquationAlpha),this.blendColor&&this.blendColor.isColor&&(n.blendColor=this.blendColor.getHex()),this.blendAlpha!==0&&(n.blendAlpha=this.blendAlpha),this.depthFunc!==Ps&&(n.depthFunc=this.depthFunc),this.depthTest===!1&&(n.depthTest=this.depthTest),this.depthWrite===!1&&(n.depthWrite=this.depthWrite),this.colorWrite===!1&&(n.colorWrite=this.colorWrite),this.stencilWriteMask!==255&&(n.stencilWriteMask=this.stencilWriteMask),this.stencilFunc!==wh&&(n.stencilFunc=this.stencilFunc),this.stencilRef!==0&&(n.stencilRef=this.stencilRef),this.stencilFuncMask!==255&&(n.stencilFuncMask=this.stencilFuncMask),this.stencilFail!==ns&&(n.stencilFail=this.stencilFail),this.stencilZFail!==ns&&(n.stencilZFail=this.stencilZFail),this.stencilZPass!==ns&&(n.stencilZPass=this.stencilZPass),this.stencilWrite===!0&&(n.stencilWrite=this.stencilWrite),this.rotation!==void 0&&this.rotation!==0&&(n.rotation=this.rotation),this.polygonOffset===!0&&(n.polygonOffset=!0),this.polygonOffsetFactor!==0&&(n.polygonOffsetFactor=this.polygonOffsetFactor),this.polygonOffsetUnits!==0&&(n.polygonOffsetUnits=this.polygonOffsetUnits),this.linewidth!==void 0&&this.linewidth!==1&&(n.linewidth=this.linewidth),this.dashSize!==void 0&&(n.dashSize=this.dashSize),this.gapSize!==void 0&&(n.gapSize=this.gapSize),this.scale!==void 0&&(n.scale=this.scale),this.dithering===!0&&(n.dithering=!0),this.alphaTest>0&&(n.alphaTest=this.alphaTest),this.alphaHash===!0&&(n.alphaHash=!0),this.alphaToCoverage===!0&&(n.alphaToCoverage=!0),this.premultipliedAlpha===!0&&(n.premultipliedAlpha=!0),this.forceSinglePass===!0&&(n.forceSinglePass=!0),this.allowOverride===!1&&(n.allowOverride=!1),this.wireframe===!0&&(n.wireframe=!0),this.wireframeLinewidth>1&&(n.wireframeLinewidth=this.wireframeLinewidth),this.wireframeLinecap!=="round"&&(n.wireframeLinecap=this.wireframeLinecap),this.wireframeLinejoin!=="round"&&(n.wireframeLinejoin=this.wireframeLinejoin),this.flatShading===!0&&(n.flatShading=!0),this.visible===!1&&(n.visible=!1),this.toneMapped===!1&&(n.toneMapped=!1),this.fog===!1&&(n.fog=!1),Object.keys(this.userData).length>0&&(n.userData=this.userData);function s(r){const a=[];for(const o in r){const l=r[o];delete l.metadata,a.push(l)}return a}if(t){const r=s(e.textures),a=s(e.images);r.length>0&&(n.textures=r),a.length>0&&(n.images=a)}return n}fromJSON(e,t){if(e.uuid!==void 0&&(this.uuid=e.uuid),e.name!==void 0&&(this.name=e.name),e.color!==void 0&&this.color!==void 0&&this.color.setHex(e.color),e.roughness!==void 0&&(this.roughness=e.roughness),e.metalness!==void 0&&(this.metalness=e.metalness),e.sheen!==void 0&&(this.sheen=e.sheen),e.sheenColor!==void 0&&(this.sheenColor=new Le().setHex(e.sheenColor)),e.sheenRoughness!==void 0&&(this.sheenRoughness=e.sheenRoughness),e.emissive!==void 0&&this.emissive!==void 0&&this.emissive.setHex(e.emissive),e.specular!==void 0&&this.specular!==void 0&&this.specular.setHex(e.specular),e.specularIntensity!==void 0&&(this.specularIntensity=e.specularIntensity),e.specularColor!==void 0&&this.specularColor!==void 0&&this.specularColor.setHex(e.specularColor),e.shininess!==void 0&&(this.shininess=e.shininess),e.clearcoat!==void 0&&(this.clearcoat=e.clearcoat),e.clearcoatRoughness!==void 0&&(this.clearcoatRoughness=e.clearcoatRoughness),e.dispersion!==void 0&&(this.dispersion=e.dispersion),e.iridescence!==void 0&&(this.iridescence=e.iridescence),e.iridescenceIOR!==void 0&&(this.iridescenceIOR=e.iridescenceIOR),e.iridescenceThicknessRange!==void 0&&(this.iridescenceThicknessRange=e.iridescenceThicknessRange),e.transmission!==void 0&&(this.transmission=e.transmission),e.thickness!==void 0&&(this.thickness=e.thickness),e.attenuationDistance!==void 0&&(this.attenuationDistance=e.attenuationDistance),e.attenuationColor!==void 0&&this.attenuationColor!==void 0&&this.attenuationColor.setHex(e.attenuationColor),e.anisotropy!==void 0&&(this.anisotropy=e.anisotropy),e.anisotropyRotation!==void 0&&(this.anisotropyRotation=e.anisotropyRotation),e.fog!==void 0&&(this.fog=e.fog),e.flatShading!==void 0&&(this.flatShading=e.flatShading),e.blending!==void 0&&(this.blending=e.blending),e.combine!==void 0&&(this.combine=e.combine),e.side!==void 0&&(this.side=e.side),e.shadowSide!==void 0&&(this.shadowSide=e.shadowSide),e.opacity!==void 0&&(this.opacity=e.opacity),e.transparent!==void 0&&(this.transparent=e.transparent),e.alphaTest!==void 0&&(this.alphaTest=e.alphaTest),e.alphaHash!==void 0&&(this.alphaHash=e.alphaHash),e.depthFunc!==void 0&&(this.depthFunc=e.depthFunc),e.depthTest!==void 0&&(this.depthTest=e.depthTest),e.depthWrite!==void 0&&(this.depthWrite=e.depthWrite),e.colorWrite!==void 0&&(this.colorWrite=e.colorWrite),e.blendSrc!==void 0&&(this.blendSrc=e.blendSrc),e.blendDst!==void 0&&(this.blendDst=e.blendDst),e.blendEquation!==void 0&&(this.blendEquation=e.blendEquation),e.blendSrcAlpha!==void 0&&(this.blendSrcAlpha=e.blendSrcAlpha),e.blendDstAlpha!==void 0&&(this.blendDstAlpha=e.blendDstAlpha),e.blendEquationAlpha!==void 0&&(this.blendEquationAlpha=e.blendEquationAlpha),e.blendColor!==void 0&&this.blendColor!==void 0&&this.blendColor.setHex(e.blendColor),e.blendAlpha!==void 0&&(this.blendAlpha=e.blendAlpha),e.stencilWriteMask!==void 0&&(this.stencilWriteMask=e.stencilWriteMask),e.stencilFunc!==void 0&&(this.stencilFunc=e.stencilFunc),e.stencilRef!==void 0&&(this.stencilRef=e.stencilRef),e.stencilFuncMask!==void 0&&(this.stencilFuncMask=e.stencilFuncMask),e.stencilFail!==void 0&&(this.stencilFail=e.stencilFail),e.stencilZFail!==void 0&&(this.stencilZFail=e.stencilZFail),e.stencilZPass!==void 0&&(this.stencilZPass=e.stencilZPass),e.stencilWrite!==void 0&&(this.stencilWrite=e.stencilWrite),e.wireframe!==void 0&&(this.wireframe=e.wireframe),e.wireframeLinewidth!==void 0&&(this.wireframeLinewidth=e.wireframeLinewidth),e.wireframeLinecap!==void 0&&(this.wireframeLinecap=e.wireframeLinecap),e.wireframeLinejoin!==void 0&&(this.wireframeLinejoin=e.wireframeLinejoin),e.rotation!==void 0&&(this.rotation=e.rotation),e.linewidth!==void 0&&(this.linewidth=e.linewidth),e.dashSize!==void 0&&(this.dashSize=e.dashSize),e.gapSize!==void 0&&(this.gapSize=e.gapSize),e.scale!==void 0&&(this.scale=e.scale),e.polygonOffset!==void 0&&(this.polygonOffset=e.polygonOffset),e.polygonOffsetFactor!==void 0&&(this.polygonOffsetFactor=e.polygonOffsetFactor),e.polygonOffsetUnits!==void 0&&(this.polygonOffsetUnits=e.polygonOffsetUnits),e.dithering!==void 0&&(this.dithering=e.dithering),e.alphaToCoverage!==void 0&&(this.alphaToCoverage=e.alphaToCoverage),e.premultipliedAlpha!==void 0&&(this.premultipliedAlpha=e.premultipliedAlpha),e.forceSinglePass!==void 0&&(this.forceSinglePass=e.forceSinglePass),e.allowOverride!==void 0&&(this.allowOverride=e.allowOverride),e.visible!==void 0&&(this.visible=e.visible),e.toneMapped!==void 0&&(this.toneMapped=e.toneMapped),e.userData!==void 0&&(this.userData=e.userData),e.vertexColors!==void 0&&(typeof e.vertexColors=="number"?this.vertexColors=e.vertexColors>0:this.vertexColors=e.vertexColors),e.size!==void 0&&(this.size=e.size),e.sizeAttenuation!==void 0&&(this.sizeAttenuation=e.sizeAttenuation),e.map!==void 0&&(this.map=t[e.map]||null),e.matcap!==void 0&&(this.matcap=t[e.matcap]||null),e.alphaMap!==void 0&&(this.alphaMap=t[e.alphaMap]||null),e.bumpMap!==void 0&&(this.bumpMap=t[e.bumpMap]||null),e.bumpScale!==void 0&&(this.bumpScale=e.bumpScale),e.normalMap!==void 0&&(this.normalMap=t[e.normalMap]||null),e.normalMapType!==void 0&&(this.normalMapType=e.normalMapType),e.normalScale!==void 0){let n=e.normalScale;Array.isArray(n)===!1&&(n=[n,n]),this.normalScale=new fe().fromArray(n)}return e.displacementMap!==void 0&&(this.displacementMap=t[e.displacementMap]||null),e.displacementScale!==void 0&&(this.displacementScale=e.displacementScale),e.displacementBias!==void 0&&(this.displacementBias=e.displacementBias),e.roughnessMap!==void 0&&(this.roughnessMap=t[e.roughnessMap]||null),e.metalnessMap!==void 0&&(this.metalnessMap=t[e.metalnessMap]||null),e.emissiveMap!==void 0&&(this.emissiveMap=t[e.emissiveMap]||null),e.emissiveIntensity!==void 0&&(this.emissiveIntensity=e.emissiveIntensity),e.specularMap!==void 0&&(this.specularMap=t[e.specularMap]||null),e.specularIntensityMap!==void 0&&(this.specularIntensityMap=t[e.specularIntensityMap]||null),e.specularColorMap!==void 0&&(this.specularColorMap=t[e.specularColorMap]||null),e.envMap!==void 0&&(this.envMap=t[e.envMap]||null),e.envMapRotation!==void 0&&this.envMapRotation.fromArray(e.envMapRotation),e.envMapIntensity!==void 0&&(this.envMapIntensity=e.envMapIntensity),e.reflectivity!==void 0&&(this.reflectivity=e.reflectivity),e.refractionRatio!==void 0&&(this.refractionRatio=e.refractionRatio),e.lightMap!==void 0&&(this.lightMap=t[e.lightMap]||null),e.lightMapIntensity!==void 0&&(this.lightMapIntensity=e.lightMapIntensity),e.aoMap!==void 0&&(this.aoMap=t[e.aoMap]||null),e.aoMapIntensity!==void 0&&(this.aoMapIntensity=e.aoMapIntensity),e.gradientMap!==void 0&&(this.gradientMap=t[e.gradientMap]||null),e.clearcoatMap!==void 0&&(this.clearcoatMap=t[e.clearcoatMap]||null),e.clearcoatRoughnessMap!==void 0&&(this.clearcoatRoughnessMap=t[e.clearcoatRoughnessMap]||null),e.clearcoatNormalMap!==void 0&&(this.clearcoatNormalMap=t[e.clearcoatNormalMap]||null),e.clearcoatNormalScale!==void 0&&(this.clearcoatNormalScale=new fe().fromArray(e.clearcoatNormalScale)),e.iridescenceMap!==void 0&&(this.iridescenceMap=t[e.iridescenceMap]||null),e.iridescenceThicknessMap!==void 0&&(this.iridescenceThicknessMap=t[e.iridescenceThicknessMap]||null),e.transmissionMap!==void 0&&(this.transmissionMap=t[e.transmissionMap]||null),e.thicknessMap!==void 0&&(this.thicknessMap=t[e.thicknessMap]||null),e.anisotropyMap!==void 0&&(this.anisotropyMap=t[e.anisotropyMap]||null),e.sheenColorMap!==void 0&&(this.sheenColorMap=t[e.sheenColorMap]||null),e.sheenRoughnessMap!==void 0&&(this.sheenRoughnessMap=t[e.sheenRoughnessMap]||null),this}clone(){return new this.constructor().copy(this)}copy(e){this.name=e.name,this.blending=e.blending,this.side=e.side,this.vertexColors=e.vertexColors,this.opacity=e.opacity,this.transparent=e.transparent,this.blendSrc=e.blendSrc,this.blendDst=e.blendDst,this.blendEquation=e.blendEquation,this.blendSrcAlpha=e.blendSrcAlpha,this.blendDstAlpha=e.blendDstAlpha,this.blendEquationAlpha=e.blendEquationAlpha,this.blendColor.copy(e.blendColor),this.blendAlpha=e.blendAlpha,this.depthFunc=e.depthFunc,this.depthTest=e.depthTest,this.depthWrite=e.depthWrite,this.stencilWriteMask=e.stencilWriteMask,this.stencilFunc=e.stencilFunc,this.stencilRef=e.stencilRef,this.stencilFuncMask=e.stencilFuncMask,this.stencilFail=e.stencilFail,this.stencilZFail=e.stencilZFail,this.stencilZPass=e.stencilZPass,this.stencilWrite=e.stencilWrite;const t=e.clippingPlanes;let n=null;if(t!==null){const s=t.length;n=new Array(s);for(let r=0;r!==s;++r)n[r]=t[r].clone()}return this.clippingPlanes=n,this.clipIntersection=e.clipIntersection,this.clipShadows=e.clipShadows,this.shadowSide=e.shadowSide,this.colorWrite=e.colorWrite,this.precision=e.precision,this.polygonOffset=e.polygonOffset,this.polygonOffsetFactor=e.polygonOffsetFactor,this.polygonOffsetUnits=e.polygonOffsetUnits,this.dithering=e.dithering,this.alphaTest=e.alphaTest,this.alphaHash=e.alphaHash,this.alphaToCoverage=e.alphaToCoverage,this.premultipliedAlpha=e.premultipliedAlpha,this.forceSinglePass=e.forceSinglePass,this.allowOverride=e.allowOverride,this.visible=e.visible,this.toneMapped=e.toneMapped,this.userData=JSON.parse(JSON.stringify(e.userData)),this}dispose(){this.dispatchEvent({type:"dispose"})}set needsUpdate(e){e===!0&&this.version++}}class Xc extends Ti{constructor(e){super(),this.isSpriteMaterial=!0,this.type="SpriteMaterial",this.color=new Le(16777215),this.map=null,this.alphaMap=null,this.rotation=0,this.sizeAttenuation=!0,this.transparent=!0,this.fog=!0,this.setValues(e)}copy(e){return super.copy(e),this.color.copy(e.color),this.map=e.map,this.alphaMap=e.alphaMap,this.rotation=e.rotation,this.sizeAttenuation=e.sizeAttenuation,this.fog=e.fog,this}}let fs;const er=new N,ps=new N,ms=new N,gs=new fe,tr=new fe,Td=new ut,Kr=new N,nr=new N,$r=new N,Hh=new fe,Uo=new fe,Vh=new fe;class Ad extends Lt{constructor(e=new Xc){if(super(),this.isSprite=!0,this.type="Sprite",fs===void 0){fs=new It;const t=new Float32Array([-.5,-.5,0,0,0,.5,-.5,0,1,0,.5,.5,0,1,1,-.5,.5,0,0,1]),n=new Km(t,5);fs.setIndex([0,1,2,0,2,3]),fs.setAttribute("position",new za(n,3,0,!1)),fs.setAttribute("uv",new za(n,2,3,!1))}this.geometry=fs,this.material=e,this.center=new fe(.5,.5),this.count=1}raycast(e,t){e.camera===null&&at('Sprite: "Raycaster.camera" needs to be set in order to raycast against sprites.'),ps.setFromMatrixScale(this.matrixWorld),Td.copy(e.camera.matrixWorld),this.modelViewMatrix.multiplyMatrices(e.camera.matrixWorldInverse,this.matrixWorld),ms.setFromMatrixPosition(this.modelViewMatrix),e.camera.isPerspectiveCamera&&this.material.sizeAttenuation===!1&&ps.multiplyScalar(-ms.z);const n=this.material.rotation;let s,r;n!==0&&(r=Math.cos(n),s=Math.sin(n));const a=this.center;Zr(Kr.set(-.5,-.5,0),ms,a,ps,s,r),Zr(nr.set(.5,-.5,0),ms,a,ps,s,r),Zr($r.set(.5,.5,0),ms,a,ps,s,r),Hh.set(0,0),Uo.set(1,0),Vh.set(1,1);let o=e.ray.intersectTriangle(Kr,nr,$r,!1,er);if(o===null&&(Zr(nr.set(-.5,.5,0),ms,a,ps,s,r),Uo.set(0,1),o=e.ray.intersectTriangle(Kr,$r,nr,!1,er),o===null))return;const l=e.ray.origin.distanceTo(er);l<e.near||l>e.far||t.push({distance:l,point:er.clone(),uv:xn.getInterpolation(er,Kr,nr,$r,Hh,Uo,Vh,new fe),face:null,object:this})}copy(e,t){return super.copy(e,t),e.center!==void 0&&this.center.copy(e.center),this.material=e.material,this}}function Zr(i,e,t,n,s,r){gs.subVectors(i,t).addScalar(.5).multiply(n),s!==void 0?(tr.x=r*gs.x-s*gs.y,tr.y=s*gs.x+r*gs.y):tr.copy(gs),i.copy(e),i.x+=tr.x,i.y+=tr.y,i.applyMatrix4(Td)}const ei=new N,Fo=new N,Jr=new N,vi=new N,Oo=new N,Qr=new N,Bo=new N;class wd{constructor(e=new N,t=new N(0,0,-1)){this.origin=e,this.direction=t}set(e,t){return this.origin.copy(e),this.direction.copy(t),this}copy(e){return this.origin.copy(e.origin),this.direction.copy(e.direction),this}at(e,t){return t.copy(this.origin).addScaledVector(this.direction,e)}lookAt(e){return this.direction.copy(e).sub(this.origin).normalize(),this}recast(e){return this.origin.copy(this.at(e,ei)),this}closestPointToPoint(e,t){t.subVectors(e,this.origin);const n=t.dot(this.direction);return n<0?t.copy(this.origin):t.copy(this.origin).addScaledVector(this.direction,n)}distanceToPoint(e){return Math.sqrt(this.distanceSqToPoint(e))}distanceSqToPoint(e){const t=ei.subVectors(e,this.origin).dot(this.direction);return t<0?this.origin.distanceToSquared(e):(ei.copy(this.origin).addScaledVector(this.direction,t),ei.distanceToSquared(e))}distanceSqToSegment(e,t,n,s){Fo.copy(e).add(t).multiplyScalar(.5),Jr.copy(t).sub(e).normalize(),vi.copy(this.origin).sub(Fo);const r=e.distanceTo(t)*.5,a=-this.direction.dot(Jr),o=vi.dot(this.direction),l=-vi.dot(Jr),c=vi.lengthSq(),h=Math.abs(1-a*a);let f,d,u,m;if(h>0)if(f=a*l-o,d=a*o-l,m=r*h,f>=0)if(d>=-m)if(d<=m){const x=1/h;f*=x,d*=x,u=f*(f+a*d+2*o)+d*(a*f+d+2*l)+c}else d=r,f=Math.max(0,-(a*d+o)),u=-f*f+d*(d+2*l)+c;else d=-r,f=Math.max(0,-(a*d+o)),u=-f*f+d*(d+2*l)+c;else d<=-m?(f=Math.max(0,-(-a*r+o)),d=f>0?-r:Math.min(Math.max(-r,-l),r),u=-f*f+d*(d+2*l)+c):d<=m?(f=0,d=Math.min(Math.max(-r,-l),r),u=d*(d+2*l)+c):(f=Math.max(0,-(a*r+o)),d=f>0?r:Math.min(Math.max(-r,-l),r),u=-f*f+d*(d+2*l)+c);else d=a>0?-r:r,f=Math.max(0,-(a*d+o)),u=-f*f+d*(d+2*l)+c;return n&&n.copy(this.origin).addScaledVector(this.direction,f),s&&s.copy(Fo).addScaledVector(Jr,d),u}intersectSphere(e,t){ei.subVectors(e.center,this.origin);const n=ei.dot(this.direction),s=ei.dot(ei)-n*n,r=e.radius*e.radius;if(s>r)return null;const a=Math.sqrt(r-s),o=n-a,l=n+a;return l<0?null:o<0?this.at(l,t):this.at(o,t)}intersectsSphere(e){return e.radius<0?!1:this.distanceSqToPoint(e.center)<=e.radius*e.radius}distanceToPlane(e){const t=e.normal.dot(this.direction);if(t===0)return e.distanceToPoint(this.origin)===0?0:null;const n=-(this.origin.dot(e.normal)+e.constant)/t;return n>=0?n:null}intersectPlane(e,t){const n=this.distanceToPlane(e);return n===null?null:this.at(n,t)}intersectsPlane(e){const t=e.distanceToPoint(this.origin);return t===0||e.normal.dot(this.direction)*t<0}intersectBox(e,t){let n,s,r,a,o,l;const c=1/this.direction.x,h=1/this.direction.y,f=1/this.direction.z,d=this.origin;return c>=0?(n=(e.min.x-d.x)*c,s=(e.max.x-d.x)*c):(n=(e.max.x-d.x)*c,s=(e.min.x-d.x)*c),h>=0?(r=(e.min.y-d.y)*h,a=(e.max.y-d.y)*h):(r=(e.max.y-d.y)*h,a=(e.min.y-d.y)*h),n>a||r>s||((r>n||isNaN(n))&&(n=r),(a<s||isNaN(s))&&(s=a),f>=0?(o=(e.min.z-d.z)*f,l=(e.max.z-d.z)*f):(o=(e.max.z-d.z)*f,l=(e.min.z-d.z)*f),n>l||o>s)||((o>n||n!==n)&&(n=o),(l<s||s!==s)&&(s=l),s<0)?null:this.at(n>=0?n:s,t)}intersectsBox(e){return this.intersectBox(e,ei)!==null}intersectTriangle(e,t,n,s,r){Oo.subVectors(t,e),Qr.subVectors(n,e),Bo.crossVectors(Oo,Qr);let a=this.direction.dot(Bo),o;if(a>0){if(s)return null;o=1}else if(a<0)o=-1,a=-a;else return null;vi.subVectors(this.origin,e);const l=o*this.direction.dot(Qr.crossVectors(vi,Qr));if(l<0)return null;const c=o*this.direction.dot(Oo.cross(vi));if(c<0||l+c>a)return null;const h=-o*vi.dot(Bo);return h<0?null:this.at(h/a,r)}applyMatrix4(e){return this.origin.applyMatrix4(e),this.direction.transformDirection(e),this}equals(e){return e.origin.equals(this.origin)&&e.direction.equals(this.direction)}clone(){return new this.constructor().copy(this)}}class oi extends Ti{constructor(e){super(),this.isMeshBasicMaterial=!0,this.type="MeshBasicMaterial",this.color=new Le(16777215),this.map=null,this.lightMap=null,this.lightMapIntensity=1,this.aoMap=null,this.aoMapIntensity=1,this.specularMap=null,this.alphaMap=null,this.envMap=null,this.envMapRotation=new Yn,this.combine=wc,this.reflectivity=1,this.refractionRatio=.98,this.wireframe=!1,this.wireframeLinewidth=1,this.wireframeLinecap="round",this.wireframeLinejoin="round",this.fog=!0,this.setValues(e)}copy(e){return super.copy(e),this.color.copy(e.color),this.map=e.map,this.lightMap=e.lightMap,this.lightMapIntensity=e.lightMapIntensity,this.aoMap=e.aoMap,this.aoMapIntensity=e.aoMapIntensity,this.specularMap=e.specularMap,this.alphaMap=e.alphaMap,this.envMap=e.envMap,this.envMapRotation.copy(e.envMapRotation),this.combine=e.combine,this.reflectivity=e.reflectivity,this.refractionRatio=e.refractionRatio,this.wireframe=e.wireframe,this.wireframeLinewidth=e.wireframeLinewidth,this.wireframeLinecap=e.wireframeLinecap,this.wireframeLinejoin=e.wireframeLinejoin,this.fog=e.fog,this}}const Wh=new ut,Pi=new wd,jr=new ks,Xh=new N,ea=new N,ta=new N,na=new N,ko=new N,ia=new N,Yh=new N,sa=new N;class $e extends Lt{constructor(e=new It,t=new oi){super(),this.isMesh=!0,this.type="Mesh",this.geometry=e,this.material=t,this.morphTargetDictionary=void 0,this.morphTargetInfluences=void 0,this.count=1,this.updateMorphTargets()}copy(e,t){return super.copy(e,t),e.morphTargetInfluences!==void 0&&(this.morphTargetInfluences=e.morphTargetInfluences.slice()),e.morphTargetDictionary!==void 0&&(this.morphTargetDictionary=Object.assign({},e.morphTargetDictionary)),this.material=Array.isArray(e.material)?e.material.slice():e.material,this.geometry=e.geometry,this}updateMorphTargets(){const t=this.geometry.morphAttributes,n=Object.keys(t);if(n.length>0){const s=t[n[0]];if(s!==void 0){this.morphTargetInfluences=[],this.morphTargetDictionary={};for(let r=0,a=s.length;r<a;r++){const o=s[r].name||String(r);this.morphTargetInfluences.push(0),this.morphTargetDictionary[o]=r}}}}getVertexPosition(e,t){const n=this.geometry,s=n.attributes.position,r=n.morphAttributes.position,a=n.morphTargetsRelative;t.fromBufferAttribute(s,e);const o=this.morphTargetInfluences;if(r&&o){ia.set(0,0,0);for(let l=0,c=r.length;l<c;l++){const h=o[l],f=r[l];h!==0&&(ko.fromBufferAttribute(f,e),a?ia.addScaledVector(ko,h):ia.addScaledVector(ko.sub(t),h))}t.add(ia)}return t}raycast(e,t){const n=this.geometry,s=this.material,r=this.matrixWorld;s!==void 0&&(n.boundingSphere===null&&n.computeBoundingSphere(),jr.copy(n.boundingSphere),jr.applyMatrix4(r),Pi.copy(e.ray).recast(e.near),!(jr.containsPoint(Pi.origin)===!1&&(Pi.intersectSphere(jr,Xh)===null||Pi.origin.distanceToSquared(Xh)>(e.far-e.near)**2))&&(Wh.copy(r).invert(),Pi.copy(e.ray).applyMatrix4(Wh),!(n.boundingBox!==null&&Pi.intersectsBox(n.boundingBox)===!1)&&this._computeIntersections(e,t,Pi)))}_computeIntersections(e,t,n){let s;const r=this.geometry,a=this.material,o=r.index,l=r.attributes.position,c=r.attributes.uv,h=r.attributes.uv1,f=r.attributes.normal,d=r.groups,u=r.drawRange;if(o!==null)if(Array.isArray(a))for(let m=0,x=d.length;m<x;m++){const v=d[m],g=a[v.materialIndex],y=Math.max(v.start,u.start),E=Math.min(o.count,Math.min(v.start+v.count,u.start+u.count));for(let M=y,T=E;M<T;M+=3){const w=o.getX(M),R=o.getX(M+1),_=o.getX(M+2);s=ra(this,g,e,n,c,h,f,w,R,_),s&&(s.faceIndex=Math.floor(M/3),s.face.materialIndex=v.materialIndex,t.push(s))}}else{const m=Math.max(0,u.start),x=Math.min(o.count,u.start+u.count);for(let v=m,g=x;v<g;v+=3){const y=o.getX(v),E=o.getX(v+1),M=o.getX(v+2);s=ra(this,a,e,n,c,h,f,y,E,M),s&&(s.faceIndex=Math.floor(v/3),t.push(s))}}else if(l!==void 0)if(Array.isArray(a))for(let m=0,x=d.length;m<x;m++){const v=d[m],g=a[v.materialIndex],y=Math.max(v.start,u.start),E=Math.min(l.count,Math.min(v.start+v.count,u.start+u.count));for(let M=y,T=E;M<T;M+=3){const w=M,R=M+1,_=M+2;s=ra(this,g,e,n,c,h,f,w,R,_),s&&(s.faceIndex=Math.floor(M/3),s.face.materialIndex=v.materialIndex,t.push(s))}}else{const m=Math.max(0,u.start),x=Math.min(l.count,u.start+u.count);for(let v=m,g=x;v<g;v+=3){const y=v,E=v+1,M=v+2;s=ra(this,a,e,n,c,h,f,y,E,M),s&&(s.faceIndex=Math.floor(v/3),t.push(s))}}}}function Zm(i,e,t,n,s,r,a,o){let l;if(e.side===en?l=n.intersectTriangle(a,r,s,!0,o):l=n.intersectTriangle(s,r,a,e.side===li,o),l===null)return null;sa.copy(o),sa.applyMatrix4(i.matrixWorld);const c=t.ray.origin.distanceTo(sa);return c<t.near||c>t.far?null:{distance:c,point:sa.clone(),object:i}}function ra(i,e,t,n,s,r,a,o,l,c){i.getVertexPosition(o,ea),i.getVertexPosition(l,ta),i.getVertexPosition(c,na);const h=Zm(i,e,t,n,ea,ta,na,Yh);if(h){const f=new N;xn.getBarycoord(Yh,ea,ta,na,f),s&&(h.uv=xn.getInterpolatedAttribute(s,o,l,c,f,new fe)),r&&(h.uv1=xn.getInterpolatedAttribute(r,o,l,c,f,new fe)),a&&(h.normal=xn.getInterpolatedAttribute(a,o,l,c,f,new N),h.normal.dot(n.direction)>0&&h.normal.multiplyScalar(-1));const d={a:o,b:l,c,normal:new N,materialIndex:0};xn.getNormal(ea,ta,na,d.normal),h.face=d,h.barycoord=f}return h}class Cd extends Wt{constructor(e=null,t=1,n=1,s,r,a,o,l,c=Xt,h=Xt,f,d){super(null,a,o,l,c,h,s,r,f,d),this.isDataTexture=!0,this.image={data:e,width:t,height:n},this.generateMipmaps=!1,this.flipY=!1,this.unpackAlignment=1}}class jl extends Gt{constructor(e,t,n,s=1){super(e,t,n),this.isInstancedBufferAttribute=!0,this.meshPerAttribute=s}copy(e){return super.copy(e),this.meshPerAttribute=e.meshPerAttribute,this}toJSON(){const e=super.toJSON();return e.meshPerAttribute=this.meshPerAttribute,e.isInstancedBufferAttribute=!0,e}}const vs=new ut,qh=new ut,aa=[],Kh=new $i,Jm=new ut,ir=new $e,sr=new ks;class yn extends $e{constructor(e,t,n){super(e,t),this.isInstancedMesh=!0,this.instanceMatrix=new jl(new Float32Array(n*16),16),this.instanceColor=null,this.morphTexture=null,this.count=n,this.boundingBox=null,this.boundingSphere=null;for(let s=0;s<n;s++)this.setMatrixAt(s,Jm)}computeBoundingBox(){const e=this.geometry,t=this.count;this.boundingBox===null&&(this.boundingBox=new $i),e.boundingBox===null&&e.computeBoundingBox(),this.boundingBox.makeEmpty();for(let n=0;n<t;n++)this.getMatrixAt(n,vs),Kh.copy(e.boundingBox).applyMatrix4(vs),this.boundingBox.union(Kh)}computeBoundingSphere(){const e=this.geometry,t=this.count;this.boundingSphere===null&&(this.boundingSphere=new ks),e.boundingSphere===null&&e.computeBoundingSphere(),this.boundingSphere.makeEmpty();for(let n=0;n<t;n++)this.getMatrixAt(n,vs),sr.copy(e.boundingSphere).applyMatrix4(vs),this.boundingSphere.union(sr)}copy(e,t){return super.copy(e,t),this.instanceMatrix.copy(e.instanceMatrix),e.morphTexture!==null&&(this.morphTexture=e.morphTexture.clone()),e.instanceColor!==null&&(this.instanceColor=e.instanceColor.clone()),this.count=e.count,e.boundingBox!==null&&(this.boundingBox=e.boundingBox.clone()),e.boundingSphere!==null&&(this.boundingSphere=e.boundingSphere.clone()),this}getColorAt(e,t){return this.instanceColor===null?t.setRGB(1,1,1):t.fromArray(this.instanceColor.array,e*3)}getMatrixAt(e,t){return t.fromArray(this.instanceMatrix.array,e*16)}getMorphAt(e,t){const n=t.morphTargetInfluences,s=this.morphTexture.source.data.data,r=n.length+1,a=e*r+1;for(let o=0;o<n.length;o++)n[o]=s[a+o]}raycast(e,t){const n=this.matrixWorld,s=this.count;if(ir.geometry=this.geometry,ir.material=this.material,ir.material!==void 0&&(this.boundingSphere===null&&this.computeBoundingSphere(),sr.copy(this.boundingSphere),sr.applyMatrix4(n),e.ray.intersectsSphere(sr)!==!1))for(let r=0;r<s;r++){this.getMatrixAt(r,vs),qh.multiplyMatrices(n,vs),ir.matrixWorld=qh,ir.raycast(e,aa);for(let a=0,o=aa.length;a<o;a++){const l=aa[a];l.instanceId=r,l.object=this,t.push(l)}aa.length=0}}setColorAt(e,t){return this.instanceColor===null&&(this.instanceColor=new jl(new Float32Array(this.instanceMatrix.count*3).fill(1),3)),t.toArray(this.instanceColor.array,e*3),this}setMatrixAt(e,t){return t.toArray(this.instanceMatrix.array,e*16),this}setMorphAt(e,t){const n=t.morphTargetInfluences,s=n.length+1;this.morphTexture===null&&(this.morphTexture=new Cd(new Float32Array(s*this.count),s,this.count,Oc,In));const r=this.morphTexture.source.data.data;let a=0;for(let c=0;c<n.length;c++)a+=n[c];const o=this.geometry.morphTargetsRelative?1:1-a,l=s*e;return r[l]=o,r.set(n,l+1),this}updateMorphTargets(){}dispose(){this.dispatchEvent({type:"dispose"}),this.morphTexture!==null&&(this.morphTexture.dispose(),this.morphTexture=null)}}const Go=new N,Qm=new N,jm=new Je;class Li{constructor(e=new N(1,0,0),t=0){this.isPlane=!0,this.normal=e,this.constant=t}set(e,t){return this.normal.copy(e),this.constant=t,this}setComponents(e,t,n,s){return this.normal.set(e,t,n),this.constant=s,this}setFromNormalAndCoplanarPoint(e,t){return this.normal.copy(e),this.constant=-t.dot(this.normal),this}setFromCoplanarPoints(e,t,n){const s=Go.subVectors(n,t).cross(Qm.subVectors(e,t)).normalize();return this.setFromNormalAndCoplanarPoint(s,e),this}copy(e){return this.normal.copy(e.normal),this.constant=e.constant,this}normalize(){const e=1/this.normal.length();return this.normal.multiplyScalar(e),this.constant*=e,this}negate(){return this.constant*=-1,this.normal.negate(),this}distanceToPoint(e){return this.normal.dot(e)+this.constant}distanceToSphere(e){return this.distanceToPoint(e.center)-e.radius}projectPoint(e,t){return t.copy(e).addScaledVector(this.normal,-this.distanceToPoint(e))}intersectLine(e,t,n=!0){const s=e.delta(Go),r=this.normal.dot(s);if(r===0)return this.distanceToPoint(e.start)===0?t.copy(e.start):null;const a=-(e.start.dot(this.normal)+this.constant)/r;return n===!0&&(a<0||a>1)?null:t.copy(e.start).addScaledVector(s,a)}intersectsLine(e){const t=this.distanceToPoint(e.start),n=this.distanceToPoint(e.end);return t<0&&n>0||n<0&&t>0}intersectsBox(e){return e.intersectsPlane(this)}intersectsSphere(e){return e.intersectsPlane(this)}coplanarPoint(e){return e.copy(this.normal).multiplyScalar(-this.constant)}applyMatrix4(e,t){const n=t||jm.getNormalMatrix(e),s=this.coplanarPoint(Go).applyMatrix4(e),r=this.normal.applyMatrix3(n).normalize();return this.constant=-s.dot(r),this}translate(e){return this.constant-=e.dot(this.normal),this}equals(e){return e.normal.equals(this.normal)&&e.constant===this.constant}clone(){return new this.constructor().copy(this)}}const Ii=new ks,e0=new fe(.5,.5),oa=new N;class Yc{constructor(e=new Li,t=new Li,n=new Li,s=new Li,r=new Li,a=new Li){this.planes=[e,t,n,s,r,a]}set(e,t,n,s,r,a){const o=this.planes;return o[0].copy(e),o[1].copy(t),o[2].copy(n),o[3].copy(s),o[4].copy(r),o[5].copy(a),this}copy(e){const t=this.planes;for(let n=0;n<6;n++)t[n].copy(e.planes[n]);return this}setFromProjectionMatrix(e,t=Bn,n=!1){const s=this.planes,r=e.elements,a=r[0],o=r[1],l=r[2],c=r[3],h=r[4],f=r[5],d=r[6],u=r[7],m=r[8],x=r[9],v=r[10],g=r[11],y=r[12],E=r[13],M=r[14],T=r[15];if(s[0].setComponents(c-a,u-h,g-m,T-y).normalize(),s[1].setComponents(c+a,u+h,g+m,T+y).normalize(),s[2].setComponents(c+o,u+f,g+x,T+E).normalize(),s[3].setComponents(c-o,u-f,g-x,T-E).normalize(),n)s[4].setComponents(l,d,v,M).normalize(),s[5].setComponents(c-l,u-d,g-v,T-M).normalize();else if(s[4].setComponents(c-l,u-d,g-v,T-M).normalize(),t===Bn)s[5].setComponents(c+l,u+d,g+v,T+M).normalize();else if(t===Ar)s[5].setComponents(l,d,v,M).normalize();else throw new Error("THREE.Frustum.setFromProjectionMatrix(): Invalid coordinate system: "+t);return this}intersectsObject(e){if(e.boundingSphere!==void 0)e.boundingSphere===null&&e.computeBoundingSphere(),Ii.copy(e.boundingSphere).applyMatrix4(e.matrixWorld);else{const t=e.geometry;t.boundingSphere===null&&t.computeBoundingSphere(),Ii.copy(t.boundingSphere).applyMatrix4(e.matrixWorld)}return this.intersectsSphere(Ii)}intersectsSprite(e){Ii.center.set(0,0,0);const t=e0.distanceTo(e.center);return Ii.radius=.7071067811865476+t,Ii.applyMatrix4(e.matrixWorld),this.intersectsSphere(Ii)}intersectsSphere(e){const t=this.planes,n=e.center,s=-e.radius;for(let r=0;r<6;r++)if(t[r].distanceToPoint(n)<s)return!1;return!0}intersectsBox(e){const t=this.planes;for(let n=0;n<6;n++){const s=t[n];if(oa.x=s.normal.x>0?e.max.x:e.min.x,oa.y=s.normal.y>0?e.max.y:e.min.y,oa.z=s.normal.z>0?e.max.z:e.min.z,s.distanceToPoint(oa)<0)return!1}return!0}containsPoint(e){const t=this.planes;for(let n=0;n<6;n++)if(t[n].distanceToPoint(e)<0)return!1;return!0}clone(){return new this.constructor().copy(this)}}class qc extends Ti{constructor(e){super(),this.isPointsMaterial=!0,this.type="PointsMaterial",this.color=new Le(16777215),this.map=null,this.alphaMap=null,this.size=1,this.sizeAttenuation=!0,this.fog=!0,this.setValues(e)}copy(e){return super.copy(e),this.color.copy(e.color),this.map=e.map,this.alphaMap=e.alphaMap,this.size=e.size,this.sizeAttenuation=e.sizeAttenuation,this.fog=e.fog,this}}const $h=new ut,ec=new wd,la=new ks,ca=new N;class Rd extends Lt{constructor(e=new It,t=new qc){super(),this.isPoints=!0,this.type="Points",this.geometry=e,this.material=t,this.morphTargetDictionary=void 0,this.morphTargetInfluences=void 0,this.updateMorphTargets()}copy(e,t){return super.copy(e,t),this.material=Array.isArray(e.material)?e.material.slice():e.material,this.geometry=e.geometry,this}raycast(e,t){const n=this.geometry,s=this.matrixWorld,r=e.params.Points.threshold,a=n.drawRange;if(n.boundingSphere===null&&n.computeBoundingSphere(),la.copy(n.boundingSphere),la.applyMatrix4(s),la.radius+=r,e.ray.intersectsSphere(la)===!1)return;$h.copy(s).invert(),ec.copy(e.ray).applyMatrix4($h);const o=r/((this.scale.x+this.scale.y+this.scale.z)/3),l=o*o,c=n.index,f=n.attributes.position;if(c!==null){const d=Math.max(0,a.start),u=Math.min(c.count,a.start+a.count);for(let m=d,x=u;m<x;m++){const v=c.getX(m);ca.fromBufferAttribute(f,v),Zh(ca,v,l,s,e,t,this)}}else{const d=Math.max(0,a.start),u=Math.min(f.count,a.start+a.count);for(let m=d,x=u;m<x;m++)ca.fromBufferAttribute(f,m),Zh(ca,m,l,s,e,t,this)}}updateMorphTargets(){const t=this.geometry.morphAttributes,n=Object.keys(t);if(n.length>0){const s=t[n[0]];if(s!==void 0){this.morphTargetInfluences=[],this.morphTargetDictionary={};for(let r=0,a=s.length;r<a;r++){const o=s[r].name||String(r);this.morphTargetInfluences.push(0),this.morphTargetDictionary[o]=r}}}}}function Zh(i,e,t,n,s,r,a){const o=ec.distanceSqToPoint(i);if(o<t){const l=new N;ec.closestPointToPoint(i,l),l.applyMatrix4(n);const c=s.ray.origin.distanceTo(l);if(c<s.near||c>s.far)return;r.push({distance:c,distanceToRay:Math.sqrt(o),point:l,index:e,face:null,faceIndex:null,barycoord:null,object:a})}}class Pd extends Wt{constructor(e=[],t=Hi,n,s,r,a,o,l,c,h){super(e,t,n,s,r,a,o,l,c,h),this.isCubeTexture=!0,this.flipY=!1}get images(){return this.image}set images(e){this.image=e}}class Qa extends Wt{constructor(e,t,n,s,r,a,o,l,c){super(e,t,n,s,r,a,o,l,c),this.isCanvasTexture=!0,this.needsUpdate=!0}}class Ds extends Wt{constructor(e,t,n=Xn,s,r,a,o=Xt,l=Xt,c,h=ci,f=1){if(h!==ci&&h!==Fi)throw new Error("THREE.DepthTexture: format must be either THREE.DepthFormat or THREE.DepthStencilFormat");const d={width:e,height:t,depth:f};super(d,s,r,a,o,l,h,n,c),this.isDepthTexture=!0,this.flipY=!1,this.generateMipmaps=!1,this.compareFunction=null}copy(e){return super.copy(e),this.source=new Wc(Object.assign({},e.image)),this.compareFunction=e.compareFunction,this}toJSON(e){const t=super.toJSON(e);return this.compareFunction!==null&&(t.compareFunction=this.compareFunction),t}}class t0 extends Ds{constructor(e,t=Xn,n=Hi,s,r,a=Xt,o=Xt,l,c=ci){const h={width:e,height:e,depth:1},f=[h,h,h,h,h,h];super(e,e,t,n,s,r,a,o,l,c),this.image=f,this.isCubeDepthTexture=!0,this.isCubeTexture=!0}get images(){return this.image}set images(e){this.image=e}}class Id extends Wt{constructor(e=null){super(),this.sourceTexture=e,this.isExternalTexture=!0}copy(e){return super.copy(e),this.sourceTexture=e.sourceTexture,this}}class qn extends It{constructor(e=1,t=1,n=1,s=1,r=1,a=1){super(),this.type="BoxGeometry",this.parameters={width:e,height:t,depth:n,widthSegments:s,heightSegments:r,depthSegments:a};const o=this;s=Math.floor(s),r=Math.floor(r),a=Math.floor(a);const l=[],c=[],h=[],f=[];let d=0,u=0;m("z","y","x",-1,-1,n,t,e,a,r,0),m("z","y","x",1,-1,n,t,-e,a,r,1),m("x","z","y",1,1,e,n,t,s,a,2),m("x","z","y",1,-1,e,n,-t,s,a,3),m("x","y","z",1,-1,e,t,n,s,r,4),m("x","y","z",-1,-1,e,t,-n,s,r,5),this.setIndex(l),this.setAttribute("position",new _t(c,3)),this.setAttribute("normal",new _t(h,3)),this.setAttribute("uv",new _t(f,2));function m(x,v,g,y,E,M,T,w,R,_,b){const P=M/R,L=T/_,B=M/2,Y=T/2,p=w/2,C=R+1,D=_+1;let U=0,O=0;const F=new N;for(let G=0;G<D;G++){const Z=G*L-Y;for(let ae=0;ae<C;ae++){const Te=ae*P-B;F[x]=Te*y,F[v]=Z*E,F[g]=p,c.push(F.x,F.y,F.z),F[x]=0,F[v]=0,F[g]=w>0?1:-1,h.push(F.x,F.y,F.z),f.push(ae/R),f.push(1-G/_),U+=1}}for(let G=0;G<_;G++)for(let Z=0;Z<R;Z++){const ae=d+Z+C*G,Te=d+Z+C*(G+1),qe=d+(Z+1)+C*(G+1),Re=d+(Z+1)+C*G;l.push(ae,Te,Re),l.push(Te,qe,Re),O+=6}o.addGroup(u,O,b),u+=O,d+=U}}copy(e){return super.copy(e),this.parameters=Object.assign({},e.parameters),this}static fromJSON(e){return new qn(e.width,e.height,e.depth,e.widthSegments,e.heightSegments,e.depthSegments)}}class Kc extends It{constructor(e=1,t=32,n=0,s=Math.PI*2){super(),this.type="CircleGeometry",this.parameters={radius:e,segments:t,thetaStart:n,thetaLength:s},t=Math.max(3,t);const r=[],a=[],o=[],l=[],c=new N,h=new fe;a.push(0,0,0),o.push(0,0,1),l.push(.5,.5);for(let f=0,d=3;f<=t;f++,d+=3){const u=n+f/t*s;c.x=e*Math.cos(u),c.y=e*Math.sin(u),a.push(c.x,c.y,c.z),o.push(0,0,1),h.x=(a[d]/e+1)/2,h.y=(a[d+1]/e+1)/2,l.push(h.x,h.y)}for(let f=1;f<=t;f++)r.push(f,f+1,0);this.setIndex(r),this.setAttribute("position",new _t(a,3)),this.setAttribute("normal",new _t(o,3)),this.setAttribute("uv",new _t(l,2))}copy(e){return super.copy(e),this.parameters=Object.assign({},e.parameters),this}static fromJSON(e){return new Kc(e.radius,e.segments,e.thetaStart,e.thetaLength)}}class Wi extends It{constructor(e=1,t=1,n=1,s=32,r=1,a=!1,o=0,l=Math.PI*2){super(),this.type="CylinderGeometry",this.parameters={radiusTop:e,radiusBottom:t,height:n,radialSegments:s,heightSegments:r,openEnded:a,thetaStart:o,thetaLength:l};const c=this;s=Math.floor(s),r=Math.floor(r);const h=[],f=[],d=[],u=[];let m=0;const x=[],v=n/2;let g=0;y(),a===!1&&(e>0&&E(!0),t>0&&E(!1)),this.setIndex(h),this.setAttribute("position",new _t(f,3)),this.setAttribute("normal",new _t(d,3)),this.setAttribute("uv",new _t(u,2));function y(){const M=new N,T=new N;let w=0;const R=(t-e)/n;for(let _=0;_<=r;_++){const b=[],P=_/r,L=P*(t-e)+e;for(let B=0;B<=s;B++){const Y=B/s,p=Y*l+o,C=Math.sin(p),D=Math.cos(p);T.x=L*C,T.y=-P*n+v,T.z=L*D,f.push(T.x,T.y,T.z),M.set(C,R,D).normalize(),d.push(M.x,M.y,M.z),u.push(Y,1-P),b.push(m++)}x.push(b)}for(let _=0;_<s;_++)for(let b=0;b<r;b++){const P=x[b][_],L=x[b+1][_],B=x[b+1][_+1],Y=x[b][_+1];(e>0||b!==0)&&(h.push(P,L,Y),w+=3),(t>0||b!==r-1)&&(h.push(L,B,Y),w+=3)}c.addGroup(g,w,0),g+=w}function E(M){const T=m,w=new fe,R=new N;let _=0;const b=M===!0?e:t,P=M===!0?1:-1;for(let B=1;B<=s;B++)f.push(0,v*P,0),d.push(0,P,0),u.push(.5,.5),m++;const L=m;for(let B=0;B<=s;B++){const p=B/s*l+o,C=Math.cos(p),D=Math.sin(p);R.x=b*D,R.y=v*P,R.z=b*C,f.push(R.x,R.y,R.z),d.push(0,P,0),w.x=C*.5+.5,w.y=D*.5*P+.5,u.push(w.x,w.y),m++}for(let B=0;B<s;B++){const Y=T+B,p=L+B;M===!0?h.push(p,p+1,Y):h.push(p+1,p,Y),_+=3}c.addGroup(g,_,M===!0?1:2),g+=_}}copy(e){return super.copy(e),this.parameters=Object.assign({},e.parameters),this}static fromJSON(e){return new Wi(e.radiusTop,e.radiusBottom,e.height,e.radialSegments,e.heightSegments,e.openEnded,e.thetaStart,e.thetaLength)}}class $c extends It{constructor(e=[],t=[],n=1,s=0){super(),this.type="PolyhedronGeometry",this.parameters={vertices:e,indices:t,radius:n,detail:s};const r=[],a=[];o(s),c(n),h(),this.setAttribute("position",new _t(r,3)),this.setAttribute("normal",new _t(r.slice(),3)),this.setAttribute("uv",new _t(a,2)),s===0?this.computeVertexNormals():this.normalizeNormals();function o(y){const E=new N,M=new N,T=new N;for(let w=0;w<t.length;w+=3)u(t[w+0],E),u(t[w+1],M),u(t[w+2],T),l(E,M,T,y)}function l(y,E,M,T){const w=T+1,R=[];for(let _=0;_<=w;_++){R[_]=[];const b=y.clone().lerp(M,_/w),P=E.clone().lerp(M,_/w),L=w-_;for(let B=0;B<=L;B++)B===0&&_===w?R[_][B]=b:R[_][B]=b.clone().lerp(P,B/L)}for(let _=0;_<w;_++)for(let b=0;b<2*(w-_)-1;b++){const P=Math.floor(b/2);b%2===0?(d(R[_][P+1]),d(R[_+1][P]),d(R[_][P])):(d(R[_][P+1]),d(R[_+1][P+1]),d(R[_+1][P]))}}function c(y){const E=new N;for(let M=0;M<r.length;M+=3)E.x=r[M+0],E.y=r[M+1],E.z=r[M+2],E.normalize().multiplyScalar(y),r[M+0]=E.x,r[M+1]=E.y,r[M+2]=E.z}function h(){const y=new N;for(let E=0;E<r.length;E+=3){y.x=r[E+0],y.y=r[E+1],y.z=r[E+2];const M=v(y)/2/Math.PI+.5,T=g(y)/Math.PI+.5;a.push(M,1-T)}m(),f()}function f(){for(let y=0;y<a.length;y+=6){const E=a[y+0],M=a[y+2],T=a[y+4],w=Math.max(E,M,T),R=Math.min(E,M,T);w>.9&&R<.1&&(E<.2&&(a[y+0]+=1),M<.2&&(a[y+2]+=1),T<.2&&(a[y+4]+=1))}}function d(y){r.push(y.x,y.y,y.z)}function u(y,E){const M=y*3;E.x=e[M+0],E.y=e[M+1],E.z=e[M+2]}function m(){const y=new N,E=new N,M=new N,T=new N,w=new fe,R=new fe,_=new fe;for(let b=0,P=0;b<r.length;b+=9,P+=6){y.set(r[b+0],r[b+1],r[b+2]),E.set(r[b+3],r[b+4],r[b+5]),M.set(r[b+6],r[b+7],r[b+8]),w.set(a[P+0],a[P+1]),R.set(a[P+2],a[P+3]),_.set(a[P+4],a[P+5]),T.copy(y).add(E).add(M).divideScalar(3);const L=v(T);x(w,P+0,y,L),x(R,P+2,E,L),x(_,P+4,M,L)}}function x(y,E,M,T){T<0&&y.x===1&&(a[E]=y.x-1),M.x===0&&M.z===0&&(a[E]=T/2/Math.PI+.5)}function v(y){return Math.atan2(y.z,-y.x)}function g(y){return Math.atan2(-y.y,Math.sqrt(y.x*y.x+y.z*y.z))}}copy(e){return super.copy(e),this.parameters=Object.assign({},e.parameters),this}static fromJSON(e){return new $c(e.vertices,e.indices,e.radius,e.detail)}}class Kn{constructor(){this.type="Curve",this.arcLengthDivisions=200,this.needsUpdate=!1,this.cacheArcLengths=null}getPoint(){Ke("Curve: .getPoint() not implemented.")}getPointAt(e,t){const n=this.getUtoTmapping(e);return this.getPoint(n,t)}getPoints(e=5){const t=[];for(let n=0;n<=e;n++)t.push(this.getPoint(n/e));return t}getSpacedPoints(e=5){const t=[];for(let n=0;n<=e;n++)t.push(this.getPointAt(n/e));return t}getLength(){const e=this.getLengths();return e[e.length-1]}getLengths(e=this.arcLengthDivisions){if(this.cacheArcLengths&&this.cacheArcLengths.length===e+1&&!this.needsUpdate)return this.cacheArcLengths;this.needsUpdate=!1;const t=[];let n,s=this.getPoint(0),r=0;t.push(0);for(let a=1;a<=e;a++)n=this.getPoint(a/e),r+=n.distanceTo(s),t.push(r),s=n;return this.cacheArcLengths=t,t}updateArcLengths(){this.needsUpdate=!0,this.getLengths()}getUtoTmapping(e,t=null){const n=this.getLengths();let s=0;const r=n.length;let a;t?a=t:a=e*n[r-1];let o=0,l=r-1,c;for(;o<=l;)if(s=Math.floor(o+(l-o)/2),c=n[s]-a,c<0)o=s+1;else if(c>0)l=s-1;else{l=s;break}if(s=l,n[s]===a)return s/(r-1);const h=n[s],d=n[s+1]-h,u=(a-h)/d;return(s+u)/(r-1)}getTangent(e,t){let s=e-1e-4,r=e+1e-4;s<0&&(s=0),r>1&&(r=1);const a=this.getPoint(s),o=this.getPoint(r),l=t||(a.isVector2?new fe:new N);return l.copy(o).sub(a).normalize(),l}getTangentAt(e,t){const n=this.getUtoTmapping(e);return this.getTangent(n,t)}computeFrenetFrames(e,t=!1){const n=new N,s=[],r=[],a=[],o=new N,l=new ut;for(let u=0;u<=e;u++){const m=u/e;s[u]=this.getTangentAt(m,new N)}r[0]=new N,a[0]=new N;let c=Number.MAX_VALUE;const h=Math.abs(s[0].x),f=Math.abs(s[0].y),d=Math.abs(s[0].z);h<=c&&(c=h,n.set(1,0,0)),f<=c&&(c=f,n.set(0,1,0)),d<=c&&n.set(0,0,1),o.crossVectors(s[0],n).normalize(),r[0].crossVectors(s[0],o),a[0].crossVectors(s[0],r[0]);for(let u=1;u<=e;u++){if(r[u]=r[u-1].clone(),a[u]=a[u-1].clone(),o.crossVectors(s[u-1],s[u]),o.length()>Number.EPSILON){o.normalize();const m=Math.acos(tt(s[u-1].dot(s[u]),-1,1));r[u].applyMatrix4(l.makeRotationAxis(o,m))}a[u].crossVectors(s[u],r[u])}if(t===!0){let u=Math.acos(tt(r[0].dot(r[e]),-1,1));u/=e,s[0].dot(o.crossVectors(r[0],r[e]))>0&&(u=-u);for(let m=1;m<=e;m++)r[m].applyMatrix4(l.makeRotationAxis(s[m],u*m)),a[m].crossVectors(s[m],r[m])}return{tangents:s,normals:r,binormals:a}}clone(){return new this.constructor().copy(this)}copy(e){return this.arcLengthDivisions=e.arcLengthDivisions,this}toJSON(){const e={metadata:{version:4.7,type:"Curve",generator:"Curve.toJSON"}};return e.arcLengthDivisions=this.arcLengthDivisions,e.type=this.type,e}fromJSON(e){return this.arcLengthDivisions=e.arcLengthDivisions,this}}class Zc extends Kn{constructor(e=0,t=0,n=1,s=1,r=0,a=Math.PI*2,o=!1,l=0){super(),this.isEllipseCurve=!0,this.type="EllipseCurve",this.aX=e,this.aY=t,this.xRadius=n,this.yRadius=s,this.aStartAngle=r,this.aEndAngle=a,this.aClockwise=o,this.aRotation=l}getPoint(e,t=new fe){const n=t,s=Math.PI*2;let r=this.aEndAngle-this.aStartAngle;const a=Math.abs(r)<Number.EPSILON;for(;r<0;)r+=s;for(;r>s;)r-=s;r<Number.EPSILON&&(a?r=0:r=s),this.aClockwise===!0&&!a&&(r===s?r=-s:r=r-s);const o=this.aStartAngle+e*r;let l=this.aX+this.xRadius*Math.cos(o),c=this.aY+this.yRadius*Math.sin(o);if(this.aRotation!==0){const h=Math.cos(this.aRotation),f=Math.sin(this.aRotation),d=l-this.aX,u=c-this.aY;l=d*h-u*f+this.aX,c=d*f+u*h+this.aY}return n.set(l,c)}copy(e){return super.copy(e),this.aX=e.aX,this.aY=e.aY,this.xRadius=e.xRadius,this.yRadius=e.yRadius,this.aStartAngle=e.aStartAngle,this.aEndAngle=e.aEndAngle,this.aClockwise=e.aClockwise,this.aRotation=e.aRotation,this}toJSON(){const e=super.toJSON();return e.aX=this.aX,e.aY=this.aY,e.xRadius=this.xRadius,e.yRadius=this.yRadius,e.aStartAngle=this.aStartAngle,e.aEndAngle=this.aEndAngle,e.aClockwise=this.aClockwise,e.aRotation=this.aRotation,e}fromJSON(e){return super.fromJSON(e),this.aX=e.aX,this.aY=e.aY,this.xRadius=e.xRadius,this.yRadius=e.yRadius,this.aStartAngle=e.aStartAngle,this.aEndAngle=e.aEndAngle,this.aClockwise=e.aClockwise,this.aRotation=e.aRotation,this}}class n0 extends Zc{constructor(e,t,n,s,r,a){super(e,t,n,n,s,r,a),this.isArcCurve=!0,this.type="ArcCurve"}}function Jc(){let i=0,e=0,t=0,n=0;function s(r,a,o,l){i=r,e=o,t=-3*r+3*a-2*o-l,n=2*r-2*a+o+l}return{initCatmullRom:function(r,a,o,l,c){s(a,o,c*(o-r),c*(l-a))},initNonuniformCatmullRom:function(r,a,o,l,c,h,f){let d=(a-r)/c-(o-r)/(c+h)+(o-a)/h,u=(o-a)/h-(l-a)/(h+f)+(l-o)/f;d*=h,u*=h,s(a,o,d,u)},calc:function(r){const a=r*r,o=a*r;return i+e*r+t*a+n*o}}}const Jh=new N,Qh=new N,zo=new Jc,Ho=new Jc,Vo=new Jc;class i0 extends Kn{constructor(e=[],t=!1,n="centripetal",s=.5){super(),this.isCatmullRomCurve3=!0,this.type="CatmullRomCurve3",this.points=e,this.closed=t,this.curveType=n,this.tension=s}getPoint(e,t=new N){const n=t,s=this.points,r=s.length,a=(r-(this.closed?0:1))*e;let o=Math.floor(a),l=a-o;this.closed?o+=o>0?0:(Math.floor(Math.abs(o)/r)+1)*r:l===0&&o===r-1&&(o=r-2,l=1);let c,h;this.closed||o>0?c=s[(o-1)%r]:(Qh.subVectors(s[0],s[1]).add(s[0]),c=Qh);const f=s[o%r],d=s[(o+1)%r];if(this.closed||o+2<r?h=s[(o+2)%r]:(Jh.subVectors(s[r-1],s[r-2]).add(s[r-1]),h=Jh),this.curveType==="centripetal"||this.curveType==="chordal"){const u=this.curveType==="chordal"?.5:.25;let m=Math.pow(c.distanceToSquared(f),u),x=Math.pow(f.distanceToSquared(d),u),v=Math.pow(d.distanceToSquared(h),u);x<1e-4&&(x=1),m<1e-4&&(m=x),v<1e-4&&(v=x),zo.initNonuniformCatmullRom(c.x,f.x,d.x,h.x,m,x,v),Ho.initNonuniformCatmullRom(c.y,f.y,d.y,h.y,m,x,v),Vo.initNonuniformCatmullRom(c.z,f.z,d.z,h.z,m,x,v)}else this.curveType==="catmullrom"&&(zo.initCatmullRom(c.x,f.x,d.x,h.x,this.tension),Ho.initCatmullRom(c.y,f.y,d.y,h.y,this.tension),Vo.initCatmullRom(c.z,f.z,d.z,h.z,this.tension));return n.set(zo.calc(l),Ho.calc(l),Vo.calc(l)),n}copy(e){super.copy(e),this.points=[];for(let t=0,n=e.points.length;t<n;t++){const s=e.points[t];this.points.push(s.clone())}return this.closed=e.closed,this.curveType=e.curveType,this.tension=e.tension,this}toJSON(){const e=super.toJSON();e.points=[];for(let t=0,n=this.points.length;t<n;t++){const s=this.points[t];e.points.push(s.toArray())}return e.closed=this.closed,e.curveType=this.curveType,e.tension=this.tension,e}fromJSON(e){super.fromJSON(e),this.points=[];for(let t=0,n=e.points.length;t<n;t++){const s=e.points[t];this.points.push(new N().fromArray(s))}return this.closed=e.closed,this.curveType=e.curveType,this.tension=e.tension,this}}function jh(i,e,t,n,s){const r=(n-e)*.5,a=(s-t)*.5,o=i*i,l=i*o;return(2*t-2*n+r+a)*l+(-3*t+3*n-2*r-a)*o+r*i+t}function s0(i,e){const t=1-i;return t*t*e}function r0(i,e){return 2*(1-i)*i*e}function a0(i,e){return i*i*e}function Sr(i,e,t,n){return s0(i,e)+r0(i,t)+a0(i,n)}function o0(i,e){const t=1-i;return t*t*t*e}function l0(i,e){const t=1-i;return 3*t*t*i*e}function c0(i,e){return 3*(1-i)*i*i*e}function h0(i,e){return i*i*i*e}function Mr(i,e,t,n,s){return o0(i,e)+l0(i,t)+c0(i,n)+h0(i,s)}class Ld extends Kn{constructor(e=new fe,t=new fe,n=new fe,s=new fe){super(),this.isCubicBezierCurve=!0,this.type="CubicBezierCurve",this.v0=e,this.v1=t,this.v2=n,this.v3=s}getPoint(e,t=new fe){const n=t,s=this.v0,r=this.v1,a=this.v2,o=this.v3;return n.set(Mr(e,s.x,r.x,a.x,o.x),Mr(e,s.y,r.y,a.y,o.y)),n}copy(e){return super.copy(e),this.v0.copy(e.v0),this.v1.copy(e.v1),this.v2.copy(e.v2),this.v3.copy(e.v3),this}toJSON(){const e=super.toJSON();return e.v0=this.v0.toArray(),e.v1=this.v1.toArray(),e.v2=this.v2.toArray(),e.v3=this.v3.toArray(),e}fromJSON(e){return super.fromJSON(e),this.v0.fromArray(e.v0),this.v1.fromArray(e.v1),this.v2.fromArray(e.v2),this.v3.fromArray(e.v3),this}}class u0 extends Kn{constructor(e=new N,t=new N,n=new N,s=new N){super(),this.isCubicBezierCurve3=!0,this.type="CubicBezierCurve3",this.v0=e,this.v1=t,this.v2=n,this.v3=s}getPoint(e,t=new N){const n=t,s=this.v0,r=this.v1,a=this.v2,o=this.v3;return n.set(Mr(e,s.x,r.x,a.x,o.x),Mr(e,s.y,r.y,a.y,o.y),Mr(e,s.z,r.z,a.z,o.z)),n}copy(e){return super.copy(e),this.v0.copy(e.v0),this.v1.copy(e.v1),this.v2.copy(e.v2),this.v3.copy(e.v3),this}toJSON(){const e=super.toJSON();return e.v0=this.v0.toArray(),e.v1=this.v1.toArray(),e.v2=this.v2.toArray(),e.v3=this.v3.toArray(),e}fromJSON(e){return super.fromJSON(e),this.v0.fromArray(e.v0),this.v1.fromArray(e.v1),this.v2.fromArray(e.v2),this.v3.fromArray(e.v3),this}}class Dd extends Kn{constructor(e=new fe,t=new fe){super(),this.isLineCurve=!0,this.type="LineCurve",this.v1=e,this.v2=t}getPoint(e,t=new fe){const n=t;return e===1?n.copy(this.v2):(n.copy(this.v2).sub(this.v1),n.multiplyScalar(e).add(this.v1)),n}getPointAt(e,t){return this.getPoint(e,t)}getTangent(e,t=new fe){return t.subVectors(this.v2,this.v1).normalize()}getTangentAt(e,t){return this.getTangent(e,t)}copy(e){return super.copy(e),this.v1.copy(e.v1),this.v2.copy(e.v2),this}toJSON(){const e=super.toJSON();return e.v1=this.v1.toArray(),e.v2=this.v2.toArray(),e}fromJSON(e){return super.fromJSON(e),this.v1.fromArray(e.v1),this.v2.fromArray(e.v2),this}}class d0 extends Kn{constructor(e=new N,t=new N){super(),this.isLineCurve3=!0,this.type="LineCurve3",this.v1=e,this.v2=t}getPoint(e,t=new N){const n=t;return e===1?n.copy(this.v2):(n.copy(this.v2).sub(this.v1),n.multiplyScalar(e).add(this.v1)),n}getPointAt(e,t){return this.getPoint(e,t)}getTangent(e,t=new N){return t.subVectors(this.v2,this.v1).normalize()}getTangentAt(e,t){return this.getTangent(e,t)}copy(e){return super.copy(e),this.v1.copy(e.v1),this.v2.copy(e.v2),this}toJSON(){const e=super.toJSON();return e.v1=this.v1.toArray(),e.v2=this.v2.toArray(),e}fromJSON(e){return super.fromJSON(e),this.v1.fromArray(e.v1),this.v2.fromArray(e.v2),this}}class Nd extends Kn{constructor(e=new fe,t=new fe,n=new fe){super(),this.isQuadraticBezierCurve=!0,this.type="QuadraticBezierCurve",this.v0=e,this.v1=t,this.v2=n}getPoint(e,t=new fe){const n=t,s=this.v0,r=this.v1,a=this.v2;return n.set(Sr(e,s.x,r.x,a.x),Sr(e,s.y,r.y,a.y)),n}copy(e){return super.copy(e),this.v0.copy(e.v0),this.v1.copy(e.v1),this.v2.copy(e.v2),this}toJSON(){const e=super.toJSON();return e.v0=this.v0.toArray(),e.v1=this.v1.toArray(),e.v2=this.v2.toArray(),e}fromJSON(e){return super.fromJSON(e),this.v0.fromArray(e.v0),this.v1.fromArray(e.v1),this.v2.fromArray(e.v2),this}}class f0 extends Kn{constructor(e=new N,t=new N,n=new N){super(),this.isQuadraticBezierCurve3=!0,this.type="QuadraticBezierCurve3",this.v0=e,this.v1=t,this.v2=n}getPoint(e,t=new N){const n=t,s=this.v0,r=this.v1,a=this.v2;return n.set(Sr(e,s.x,r.x,a.x),Sr(e,s.y,r.y,a.y),Sr(e,s.z,r.z,a.z)),n}copy(e){return super.copy(e),this.v0.copy(e.v0),this.v1.copy(e.v1),this.v2.copy(e.v2),this}toJSON(){const e=super.toJSON();return e.v0=this.v0.toArray(),e.v1=this.v1.toArray(),e.v2=this.v2.toArray(),e}fromJSON(e){return super.fromJSON(e),this.v0.fromArray(e.v0),this.v1.fromArray(e.v1),this.v2.fromArray(e.v2),this}}class Ud extends Kn{constructor(e=[]){super(),this.isSplineCurve=!0,this.type="SplineCurve",this.points=e}getPoint(e,t=new fe){const n=t,s=this.points,r=(s.length-1)*e,a=Math.floor(r),o=r-a,l=s[a===0?a:a-1],c=s[a],h=s[a>s.length-2?s.length-1:a+1],f=s[a>s.length-3?s.length-1:a+2];return n.set(jh(o,l.x,c.x,h.x,f.x),jh(o,l.y,c.y,h.y,f.y)),n}copy(e){super.copy(e),this.points=[];for(let t=0,n=e.points.length;t<n;t++){const s=e.points[t];this.points.push(s.clone())}return this}toJSON(){const e=super.toJSON();e.points=[];for(let t=0,n=this.points.length;t<n;t++){const s=this.points[t];e.points.push(s.toArray())}return e}fromJSON(e){super.fromJSON(e),this.points=[];for(let t=0,n=e.points.length;t<n;t++){const s=e.points[t];this.points.push(new fe().fromArray(s))}return this}}var tc=Object.freeze({__proto__:null,ArcCurve:n0,CatmullRomCurve3:i0,CubicBezierCurve:Ld,CubicBezierCurve3:u0,EllipseCurve:Zc,LineCurve:Dd,LineCurve3:d0,QuadraticBezierCurve:Nd,QuadraticBezierCurve3:f0,SplineCurve:Ud});class p0 extends Kn{constructor(){super(),this.type="CurvePath",this.curves=[],this.autoClose=!1}add(e){this.curves.push(e)}closePath(){const e=this.curves[0].getPoint(0),t=this.curves[this.curves.length-1].getPoint(1);if(!e.equals(t)){const n=e.isVector2===!0?"LineCurve":"LineCurve3";this.curves.push(new tc[n](t,e))}return this}getPoint(e,t){const n=e*this.getLength(),s=this.getCurveLengths();let r=0;for(;r<s.length;){if(s[r]>=n){const a=s[r]-n,o=this.curves[r],l=o.getLength(),c=l===0?0:1-a/l;return o.getPointAt(c,t)}r++}return null}getLength(){const e=this.getCurveLengths();return e[e.length-1]}updateArcLengths(){this.needsUpdate=!0,this.cacheLengths=null,this.getCurveLengths()}getCurveLengths(){if(this.cacheLengths&&this.cacheLengths.length===this.curves.length)return this.cacheLengths;const e=[];let t=0;for(let n=0,s=this.curves.length;n<s;n++)t+=this.curves[n].getLength(),e.push(t);return this.cacheLengths=e,e}getSpacedPoints(e=40){const t=[];for(let n=0;n<=e;n++)t.push(this.getPoint(n/e));return this.autoClose&&t.push(t[0]),t}getPoints(e=12){const t=[];let n;for(let s=0,r=this.curves;s<r.length;s++){const a=r[s],o=a.isEllipseCurve?e*2:a.isLineCurve||a.isLineCurve3?1:a.isSplineCurve?e*a.points.length:e,l=a.getPoints(o);for(let c=0;c<l.length;c++){const h=l[c];n&&n.equals(h)||(t.push(h),n=h)}}return this.autoClose&&t.length>1&&!t[t.length-1].equals(t[0])&&t.push(t[0]),t}copy(e){super.copy(e),this.curves=[];for(let t=0,n=e.curves.length;t<n;t++){const s=e.curves[t];this.curves.push(s.clone())}return this.autoClose=e.autoClose,this}toJSON(){const e=super.toJSON();e.autoClose=this.autoClose,e.curves=[];for(let t=0,n=this.curves.length;t<n;t++){const s=this.curves[t];e.curves.push(s.toJSON())}return e}fromJSON(e){super.fromJSON(e),this.autoClose=e.autoClose,this.curves=[];for(let t=0,n=e.curves.length;t<n;t++){const s=e.curves[t];this.curves.push(new tc[s.type]().fromJSON(s))}return this}}class eu extends p0{constructor(e){super(),this.type="Path",this.currentPoint=new fe,e&&this.setFromPoints(e)}setFromPoints(e){this.moveTo(e[0].x,e[0].y);for(let t=1,n=e.length;t<n;t++)this.lineTo(e[t].x,e[t].y);return this}moveTo(e,t){return this.currentPoint.set(e,t),this}lineTo(e,t){const n=new Dd(this.currentPoint.clone(),new fe(e,t));return this.curves.push(n),this.currentPoint.set(e,t),this}quadraticCurveTo(e,t,n,s){const r=new Nd(this.currentPoint.clone(),new fe(e,t),new fe(n,s));return this.curves.push(r),this.currentPoint.set(n,s),this}bezierCurveTo(e,t,n,s,r,a){const o=new Ld(this.currentPoint.clone(),new fe(e,t),new fe(n,s),new fe(r,a));return this.curves.push(o),this.currentPoint.set(r,a),this}splineThru(e){const t=[this.currentPoint.clone()].concat(e),n=new Ud(t);return this.curves.push(n),this.currentPoint.copy(e[e.length-1]),this}arc(e,t,n,s,r,a){const o=this.currentPoint.x,l=this.currentPoint.y;return this.absarc(e+o,t+l,n,s,r,a),this}absarc(e,t,n,s,r,a){return this.absellipse(e,t,n,n,s,r,a),this}ellipse(e,t,n,s,r,a,o,l){const c=this.currentPoint.x,h=this.currentPoint.y;return this.absellipse(e+c,t+h,n,s,r,a,o,l),this}absellipse(e,t,n,s,r,a,o,l){const c=new Zc(e,t,n,s,r,a,o,l);if(this.curves.length>0){const f=c.getPoint(0);f.equals(this.currentPoint)||this.lineTo(f.x,f.y)}this.curves.push(c);const h=c.getPoint(1);return this.currentPoint.copy(h),this}copy(e){return super.copy(e),this.currentPoint.copy(e.currentPoint),this}toJSON(){const e=super.toJSON();return e.currentPoint=this.currentPoint.toArray(),e}fromJSON(e){return super.fromJSON(e),this.currentPoint.fromArray(e.currentPoint),this}}class Fd extends eu{constructor(e){super(e),this.uuid=Hn(),this.type="Shape",this.holes=[]}getPointsHoles(e){const t=[];for(let n=0,s=this.holes.length;n<s;n++)t[n]=this.holes[n].getPoints(e);return t}extractPoints(e){return{shape:this.getPoints(e),holes:this.getPointsHoles(e)}}copy(e){super.copy(e),this.holes=[];for(let t=0,n=e.holes.length;t<n;t++){const s=e.holes[t];this.holes.push(s.clone())}return this}toJSON(){const e=super.toJSON();e.uuid=this.uuid,e.holes=[];for(let t=0,n=this.holes.length;t<n;t++){const s=this.holes[t];e.holes.push(s.toJSON())}return e}fromJSON(e){super.fromJSON(e),this.uuid=e.uuid,this.holes=[];for(let t=0,n=e.holes.length;t<n;t++){const s=e.holes[t];this.holes.push(new eu().fromJSON(s))}return this}}function m0(i,e,t=2){const n=e&&e.length,s=n?e[0]*t:i.length;let r=Od(i,0,s,t,!0);const a=[];if(!r||r.next===r.prev)return a;let o,l,c;if(n&&(r=S0(i,e,r,t)),i.length>80*t){o=i[0],l=i[1];let h=o,f=l;for(let d=t;d<s;d+=t){const u=i[d],m=i[d+1];u<o&&(o=u),m<l&&(l=m),u>h&&(h=u),m>f&&(f=m)}c=Math.max(h-o,f-l),c=c!==0?32767/c:0}return Cr(r,a,t,o,l,c,0),a}function Od(i,e,t,n,s){let r;if(s===I0(i,e,t,n)>0)for(let a=e;a<t;a+=n)r=tu(a/n|0,i[a],i[a+1],r);else for(let a=t-n;a>=e;a-=n)r=tu(a/n|0,i[a],i[a+1],r);return r&&Ns(r,r.next)&&(Pr(r),r=r.next),r}function Xi(i,e){if(!i)return i;e||(e=i);let t=i,n;do if(n=!1,!t.steiner&&(Ns(t,t.next)||Pt(t.prev,t,t.next)===0)){if(Pr(t),t=e=t.prev,t===t.next)break;n=!0}else t=t.next;while(n||t!==e);return e}function Cr(i,e,t,n,s,r,a){if(!i)return;!a&&r&&T0(i,n,s,r);let o=i;for(;i.prev!==i.next;){const l=i.prev,c=i.next;if(r?v0(i,n,s,r):g0(i)){e.push(l.i,i.i,c.i),Pr(i),i=c.next,o=c.next;continue}if(i=c,i===o){a?a===1?(i=_0(Xi(i),e),Cr(i,e,t,n,s,r,2)):a===2&&x0(i,e,t,n,s,r):Cr(Xi(i),e,t,n,s,r,1);break}}}function g0(i){const e=i.prev,t=i,n=i.next;if(Pt(e,t,n)>=0)return!1;const s=e.x,r=t.x,a=n.x,o=e.y,l=t.y,c=n.y,h=Math.min(s,r,a),f=Math.min(o,l,c),d=Math.max(s,r,a),u=Math.max(o,l,c);let m=n.next;for(;m!==e;){if(m.x>=h&&m.x<=d&&m.y>=f&&m.y<=u&&dr(s,o,r,l,a,c,m.x,m.y)&&Pt(m.prev,m,m.next)>=0)return!1;m=m.next}return!0}function v0(i,e,t,n){const s=i.prev,r=i,a=i.next;if(Pt(s,r,a)>=0)return!1;const o=s.x,l=r.x,c=a.x,h=s.y,f=r.y,d=a.y,u=Math.min(o,l,c),m=Math.min(h,f,d),x=Math.max(o,l,c),v=Math.max(h,f,d),g=nc(u,m,e,t,n),y=nc(x,v,e,t,n);let E=i.prevZ,M=i.nextZ;for(;E&&E.z>=g&&M&&M.z<=y;){if(E.x>=u&&E.x<=x&&E.y>=m&&E.y<=v&&E!==s&&E!==a&&dr(o,h,l,f,c,d,E.x,E.y)&&Pt(E.prev,E,E.next)>=0||(E=E.prevZ,M.x>=u&&M.x<=x&&M.y>=m&&M.y<=v&&M!==s&&M!==a&&dr(o,h,l,f,c,d,M.x,M.y)&&Pt(M.prev,M,M.next)>=0))return!1;M=M.nextZ}for(;E&&E.z>=g;){if(E.x>=u&&E.x<=x&&E.y>=m&&E.y<=v&&E!==s&&E!==a&&dr(o,h,l,f,c,d,E.x,E.y)&&Pt(E.prev,E,E.next)>=0)return!1;E=E.prevZ}for(;M&&M.z<=y;){if(M.x>=u&&M.x<=x&&M.y>=m&&M.y<=v&&M!==s&&M!==a&&dr(o,h,l,f,c,d,M.x,M.y)&&Pt(M.prev,M,M.next)>=0)return!1;M=M.nextZ}return!0}function _0(i,e){let t=i;do{const n=t.prev,s=t.next.next;!Ns(n,s)&&kd(n,t,t.next,s)&&Rr(n,s)&&Rr(s,n)&&(e.push(n.i,t.i,s.i),Pr(t),Pr(t.next),t=i=s),t=t.next}while(t!==i);return Xi(t)}function x0(i,e,t,n,s,r){let a=i;do{let o=a.next.next;for(;o!==a.prev;){if(a.i!==o.i&&C0(a,o)){let l=Gd(a,o);a=Xi(a,a.next),l=Xi(l,l.next),Cr(a,e,t,n,s,r,0),Cr(l,e,t,n,s,r,0);return}o=o.next}a=a.next}while(a!==i)}function S0(i,e,t,n){const s=[];for(let r=0,a=e.length;r<a;r++){const o=e[r]*n,l=r<a-1?e[r+1]*n:i.length,c=Od(i,o,l,n,!1);c===c.next&&(c.steiner=!0),s.push(w0(c))}s.sort(M0);for(let r=0;r<s.length;r++)t=y0(s[r],t);return t}function M0(i,e){let t=i.x-e.x;if(t===0&&(t=i.y-e.y,t===0)){const n=(i.next.y-i.y)/(i.next.x-i.x),s=(e.next.y-e.y)/(e.next.x-e.x);t=n-s}return t}function y0(i,e){const t=b0(i,e);if(!t)return e;const n=Gd(t,i);return Xi(n,n.next),Xi(t,t.next)}function b0(i,e){let t=e;const n=i.x,s=i.y;let r=-1/0,a;if(Ns(i,t))return t;do{if(Ns(i,t.next))return t.next;if(s<=t.y&&s>=t.next.y&&t.next.y!==t.y){const f=t.x+(s-t.y)*(t.next.x-t.x)/(t.next.y-t.y);if(f<=n&&f>r&&(r=f,a=t.x<t.next.x?t:t.next,f===n))return a}t=t.next}while(t!==e);if(!a)return null;const o=a,l=a.x,c=a.y;let h=1/0;t=a;do{if(n>=t.x&&t.x>=l&&n!==t.x&&Bd(s<c?n:r,s,l,c,s<c?r:n,s,t.x,t.y)){const f=Math.abs(s-t.y)/(n-t.x);Rr(t,i)&&(f<h||f===h&&(t.x>a.x||t.x===a.x&&E0(a,t)))&&(a=t,h=f)}t=t.next}while(t!==o);return a}function E0(i,e){return Pt(i.prev,i,e.prev)<0&&Pt(e.next,i,i.next)<0}function T0(i,e,t,n){let s=i;do s.z===0&&(s.z=nc(s.x,s.y,e,t,n)),s.prevZ=s.prev,s.nextZ=s.next,s=s.next;while(s!==i);s.prevZ.nextZ=null,s.prevZ=null,A0(s)}function A0(i){let e,t=1;do{let n=i,s;i=null;let r=null;for(e=0;n;){e++;let a=n,o=0;for(let c=0;c<t&&(o++,a=a.nextZ,!!a);c++);let l=t;for(;o>0||l>0&&a;)o!==0&&(l===0||!a||n.z<=a.z)?(s=n,n=n.nextZ,o--):(s=a,a=a.nextZ,l--),r?r.nextZ=s:i=s,s.prevZ=r,r=s;n=a}r.nextZ=null,t*=2}while(e>1);return i}function nc(i,e,t,n,s){return i=(i-t)*s|0,e=(e-n)*s|0,i=(i|i<<8)&16711935,i=(i|i<<4)&252645135,i=(i|i<<2)&858993459,i=(i|i<<1)&1431655765,e=(e|e<<8)&16711935,e=(e|e<<4)&252645135,e=(e|e<<2)&858993459,e=(e|e<<1)&1431655765,i|e<<1}function w0(i){let e=i,t=i;do(e.x<t.x||e.x===t.x&&e.y<t.y)&&(t=e),e=e.next;while(e!==i);return t}function Bd(i,e,t,n,s,r,a,o){return(s-a)*(e-o)>=(i-a)*(r-o)&&(i-a)*(n-o)>=(t-a)*(e-o)&&(t-a)*(r-o)>=(s-a)*(n-o)}function dr(i,e,t,n,s,r,a,o){return!(i===a&&e===o)&&Bd(i,e,t,n,s,r,a,o)}function C0(i,e){return i.next.i!==e.i&&i.prev.i!==e.i&&!R0(i,e)&&(Rr(i,e)&&Rr(e,i)&&P0(i,e)&&(Pt(i.prev,i,e.prev)||Pt(i,e.prev,e))||Ns(i,e)&&Pt(i.prev,i,i.next)>0&&Pt(e.prev,e,e.next)>0)}function Pt(i,e,t){return(e.y-i.y)*(t.x-e.x)-(e.x-i.x)*(t.y-e.y)}function Ns(i,e){return i.x===e.x&&i.y===e.y}function kd(i,e,t,n){const s=ua(Pt(i,e,t)),r=ua(Pt(i,e,n)),a=ua(Pt(t,n,i)),o=ua(Pt(t,n,e));return!!(s!==r&&a!==o||s===0&&ha(i,t,e)||r===0&&ha(i,n,e)||a===0&&ha(t,i,n)||o===0&&ha(t,e,n))}function ha(i,e,t){return e.x<=Math.max(i.x,t.x)&&e.x>=Math.min(i.x,t.x)&&e.y<=Math.max(i.y,t.y)&&e.y>=Math.min(i.y,t.y)}function ua(i){return i>0?1:i<0?-1:0}function R0(i,e){let t=i;do{if(t.i!==i.i&&t.next.i!==i.i&&t.i!==e.i&&t.next.i!==e.i&&kd(t,t.next,i,e))return!0;t=t.next}while(t!==i);return!1}function Rr(i,e){return Pt(i.prev,i,i.next)<0?Pt(i,e,i.next)>=0&&Pt(i,i.prev,e)>=0:Pt(i,e,i.prev)<0||Pt(i,i.next,e)<0}function P0(i,e){let t=i,n=!1;const s=(i.x+e.x)/2,r=(i.y+e.y)/2;do t.y>r!=t.next.y>r&&t.next.y!==t.y&&s<(t.next.x-t.x)*(r-t.y)/(t.next.y-t.y)+t.x&&(n=!n),t=t.next;while(t!==i);return n}function Gd(i,e){const t=ic(i.i,i.x,i.y),n=ic(e.i,e.x,e.y),s=i.next,r=e.prev;return i.next=e,e.prev=i,t.next=s,s.prev=t,n.next=t,t.prev=n,r.next=n,n.prev=r,n}function tu(i,e,t,n){const s=ic(i,e,t);return n?(s.next=n.next,s.prev=n,n.next.prev=s,n.next=s):(s.prev=s,s.next=s),s}function Pr(i){i.next.prev=i.prev,i.prev.next=i.next,i.prevZ&&(i.prevZ.nextZ=i.nextZ),i.nextZ&&(i.nextZ.prevZ=i.prevZ)}function ic(i,e,t){return{i,x:e,y:t,prev:null,next:null,z:0,prevZ:null,nextZ:null,steiner:!1}}function I0(i,e,t,n){let s=0;for(let r=e,a=t-n;r<t;r+=n)s+=(i[a]-i[r])*(i[r+1]+i[a+1]),a=r;return s}class L0{static triangulate(e,t,n=2){return m0(e,t,n)}}class Ts{static area(e){const t=e.length;let n=0;for(let s=t-1,r=0;r<t;s=r++)n+=e[s].x*e[r].y-e[r].x*e[s].y;return n*.5}static isClockWise(e){return Ts.area(e)<0}static triangulateShape(e,t){const n=[],s=[],r=[];nu(e),iu(n,e);let a=e.length;t.forEach(nu);for(let l=0;l<t.length;l++)s.push(a),a+=t[l].length,iu(n,t[l]);const o=L0.triangulate(n,s);for(let l=0;l<o.length;l+=3)r.push(o.slice(l,l+3));return r}}function nu(i){const e=i.length;e>2&&i[e-1].equals(i[0])&&i.pop()}function iu(i,e){for(let t=0;t<e.length;t++)i.push(e[t].x),i.push(e[t].y)}class Qc extends It{constructor(e=new Fd([new fe(.5,.5),new fe(-.5,.5),new fe(-.5,-.5),new fe(.5,-.5)]),t={}){super(),this.type="ExtrudeGeometry",this.parameters={shapes:e,options:t},e=Array.isArray(e)?e:[e];const n=this,s=[],r=[];for(let o=0,l=e.length;o<l;o++){const c=e[o];a(c)}this.setAttribute("position",new _t(s,3)),this.setAttribute("uv",new _t(r,2)),this.computeVertexNormals();function a(o){const l=[],c=t.curveSegments!==void 0?t.curveSegments:12,h=t.steps!==void 0?t.steps:1,f=t.depth!==void 0?t.depth:1;let d=t.bevelEnabled!==void 0?t.bevelEnabled:!0,u=t.bevelThickness!==void 0?t.bevelThickness:.2,m=t.bevelSize!==void 0?t.bevelSize:u-.1,x=t.bevelOffset!==void 0?t.bevelOffset:0,v=t.bevelSegments!==void 0?t.bevelSegments:3;const g=t.extrudePath,y=t.UVGenerator!==void 0?t.UVGenerator:D0;let E,M=!1,T,w,R,_;if(g){E=g.getSpacedPoints(h),M=!0,d=!1;const re=g.isCatmullRomCurve3?g.closed:!1;T=g.computeFrenetFrames(h,re),w=new N,R=new N,_=new N}d||(v=0,u=0,m=0,x=0);const b=o.extractPoints(c);let P=b.shape;const L=b.holes;if(!Ts.isClockWise(P)){P=P.reverse();for(let re=0,le=L.length;re<le;re++){const he=L[re];Ts.isClockWise(he)&&(L[re]=he.reverse())}}function Y(re){const he=10000000000000001e-36;let ce=re[0];for(let ue=1;ue<=re.length;ue++){const _e=ue%re.length,ge=re[_e],Fe=ge.x-ce.x,We=ge.y-ce.y,k=Fe*Fe+We*We,it=Math.max(Math.abs(ge.x),Math.abs(ge.y),Math.abs(ce.x),Math.abs(ce.y)),Qe=he*it*it;if(k<=Qe){re.splice(_e,1),ue--;continue}ce=ge}}Y(P),L.forEach(Y);const p=L.length,C=P;for(let re=0;re<p;re++){const le=L[re];P=P.concat(le)}function D(re,le,he){return le||at("ExtrudeGeometry: vec does not exist"),re.clone().addScaledVector(le,he)}const U=P.length;function O(re,le,he){let ce,ue,_e;const ge=re.x-le.x,Fe=re.y-le.y,We=he.x-re.x,k=he.y-re.y,it=ge*ge+Fe*Fe,Qe=ge*k-Fe*We;if(Math.abs(Qe)>Number.EPSILON){const I=Math.sqrt(it),S=Math.sqrt(We*We+k*k),W=le.x-Fe/I,$=le.y+ge/I,ee=he.x-k/S,ve=he.y+We/S,xe=((ee-W)*k-(ve-$)*We)/(ge*k-Fe*We);ce=W+ge*xe-re.x,ue=$+Fe*xe-re.y;const te=ce*ce+ue*ue;if(te<=2)return new fe(ce,ue);_e=Math.sqrt(te/2)}else{let I=!1;ge>Number.EPSILON?We>Number.EPSILON&&(I=!0):ge<-Number.EPSILON?We<-Number.EPSILON&&(I=!0):Math.sign(Fe)===Math.sign(k)&&(I=!0),I?(ce=-Fe,ue=ge,_e=Math.sqrt(it)):(ce=ge,ue=Fe,_e=Math.sqrt(it/2))}return new fe(ce/_e,ue/_e)}const F=[];for(let re=0,le=C.length,he=le-1,ce=re+1;re<le;re++,he++,ce++)he===le&&(he=0),ce===le&&(ce=0),F[re]=O(C[re],C[he],C[ce]);const G=[];let Z,ae=F.concat();for(let re=0,le=p;re<le;re++){const he=L[re];Z=[];for(let ce=0,ue=he.length,_e=ue-1,ge=ce+1;ce<ue;ce++,_e++,ge++)_e===ue&&(_e=0),ge===ue&&(ge=0),Z[ce]=O(he[ce],he[_e],he[ge]);G.push(Z),ae=ae.concat(Z)}let Te;if(v===0)Te=Ts.triangulateShape(C,L);else{const re=[],le=[];for(let he=0;he<v;he++){const ce=he/v,ue=u*Math.cos(ce*Math.PI/2),_e=m*Math.sin(ce*Math.PI/2)+x;for(let ge=0,Fe=C.length;ge<Fe;ge++){const We=D(C[ge],F[ge],_e);De(We.x,We.y,-ue),ce===0&&re.push(We)}for(let ge=0,Fe=p;ge<Fe;ge++){const We=L[ge];Z=G[ge];const k=[];for(let it=0,Qe=We.length;it<Qe;it++){const I=D(We[it],Z[it],_e);De(I.x,I.y,-ue),ce===0&&k.push(I)}ce===0&&le.push(k)}}Te=Ts.triangulateShape(re,le)}const qe=Te.length,Re=m+x;for(let re=0;re<U;re++){const le=d?D(P[re],ae[re],Re):P[re];M?(R.copy(T.normals[0]).multiplyScalar(le.x),w.copy(T.binormals[0]).multiplyScalar(le.y),_.copy(E[0]).add(R).add(w),De(_.x,_.y,_.z)):De(le.x,le.y,0)}for(let re=1;re<=h;re++)for(let le=0;le<U;le++){const he=d?D(P[le],ae[le],Re):P[le];M?(R.copy(T.normals[re]).multiplyScalar(he.x),w.copy(T.binormals[re]).multiplyScalar(he.y),_.copy(E[re]).add(R).add(w),De(_.x,_.y,_.z)):De(he.x,he.y,f/h*re)}for(let re=v-1;re>=0;re--){const le=re/v,he=u*Math.cos(le*Math.PI/2),ce=m*Math.sin(le*Math.PI/2)+x;for(let ue=0,_e=C.length;ue<_e;ue++){const ge=D(C[ue],F[ue],ce);De(ge.x,ge.y,f+he)}for(let ue=0,_e=L.length;ue<_e;ue++){const ge=L[ue];Z=G[ue];for(let Fe=0,We=ge.length;Fe<We;Fe++){const k=D(ge[Fe],Z[Fe],ce);M?De(k.x,k.y+E[h-1].y,E[h-1].x+he):De(k.x,k.y,f+he)}}}j(),pe();function j(){const re=s.length/3;if(d){let le=0,he=U*le;for(let ce=0;ce<qe;ce++){const ue=Te[ce];ze(ue[2]+he,ue[1]+he,ue[0]+he)}le=h+v*2,he=U*le;for(let ce=0;ce<qe;ce++){const ue=Te[ce];ze(ue[0]+he,ue[1]+he,ue[2]+he)}}else{for(let le=0;le<qe;le++){const he=Te[le];ze(he[2],he[1],he[0])}for(let le=0;le<qe;le++){const he=Te[le];ze(he[0]+U*h,he[1]+U*h,he[2]+U*h)}}n.addGroup(re,s.length/3-re,0)}function pe(){const re=s.length/3;let le=0;de(C,le),le+=C.length;for(let he=0,ce=L.length;he<ce;he++){const ue=L[he];de(ue,le),le+=ue.length}n.addGroup(re,s.length/3-re,1)}function de(re,le){let he=re.length;for(;--he>=0;){const ce=he;let ue=he-1;ue<0&&(ue=re.length-1);for(let _e=0,ge=h+v*2;_e<ge;_e++){const Fe=U*_e,We=U*(_e+1),k=le+ce+Fe,it=le+ue+Fe,Qe=le+ue+We,I=le+ce+We;ke(k,it,Qe,I)}}}function De(re,le,he){l.push(re),l.push(le),l.push(he)}function ze(re,le,he){et(re),et(le),et(he);const ce=s.length/3,ue=y.generateTopUV(n,s,ce-3,ce-2,ce-1);He(ue[0]),He(ue[1]),He(ue[2])}function ke(re,le,he,ce){et(re),et(le),et(ce),et(le),et(he),et(ce);const ue=s.length/3,_e=y.generateSideWallUV(n,s,ue-6,ue-3,ue-2,ue-1);He(_e[0]),He(_e[1]),He(_e[3]),He(_e[1]),He(_e[2]),He(_e[3])}function et(re){s.push(l[re*3+0]),s.push(l[re*3+1]),s.push(l[re*3+2])}function He(re){r.push(re.x),r.push(re.y)}}}copy(e){return super.copy(e),this.parameters=Object.assign({},e.parameters),this}toJSON(){const e=super.toJSON(),t=this.parameters.shapes,n=this.parameters.options;return N0(t,n,e)}static fromJSON(e,t){const n=[];for(let r=0,a=e.shapes.length;r<a;r++){const o=t[e.shapes[r]];n.push(o)}const s=e.options.extrudePath;return s!==void 0&&(e.options.extrudePath=new tc[s.type]().fromJSON(s)),new Qc(n,e.options)}}const D0={generateTopUV:function(i,e,t,n,s){const r=e[t*3],a=e[t*3+1],o=e[n*3],l=e[n*3+1],c=e[s*3],h=e[s*3+1];return[new fe(r,a),new fe(o,l),new fe(c,h)]},generateSideWallUV:function(i,e,t,n,s,r){const a=e[t*3],o=e[t*3+1],l=e[t*3+2],c=e[n*3],h=e[n*3+1],f=e[n*3+2],d=e[s*3],u=e[s*3+1],m=e[s*3+2],x=e[r*3],v=e[r*3+1],g=e[r*3+2];return Math.abs(o-h)<Math.abs(a-c)?[new fe(a,1-l),new fe(c,1-f),new fe(d,1-m),new fe(x,1-g)]:[new fe(o,1-l),new fe(h,1-f),new fe(u,1-m),new fe(v,1-g)]}};function N0(i,e,t){if(t.shapes=[],Array.isArray(i))for(let n=0,s=i.length;n<s;n++){const r=i[n];t.shapes.push(r.uuid)}else t.shapes.push(i.uuid);return t.options=Object.assign({},e),e.extrudePath!==void 0&&(t.options.extrudePath=e.extrudePath.toJSON()),t}class Yi extends $c{constructor(e=1,t=0){const n=[1,0,0,-1,0,0,0,1,0,0,-1,0,0,0,1,0,0,-1],s=[0,2,4,0,4,3,0,3,5,0,5,2,1,2,5,1,5,3,1,3,4,1,4,2];super(n,s,e,t),this.type="OctahedronGeometry",this.parameters={radius:e,detail:t}}static fromJSON(e){return new Yi(e.radius,e.detail)}}class Sn extends It{constructor(e=1,t=1,n=1,s=1){super(),this.type="PlaneGeometry",this.parameters={width:e,height:t,widthSegments:n,heightSegments:s};const r=e/2,a=t/2,o=Math.floor(n),l=Math.floor(s),c=o+1,h=l+1,f=e/o,d=t/l,u=[],m=[],x=[],v=[];for(let g=0;g<h;g++){const y=g*d-a;for(let E=0;E<c;E++){const M=E*f-r;m.push(M,-y,0),x.push(0,0,1),v.push(E/o),v.push(1-g/l)}}for(let g=0;g<l;g++)for(let y=0;y<o;y++){const E=y+c*g,M=y+c*(g+1),T=y+1+c*(g+1),w=y+1+c*g;u.push(E,M,w),u.push(M,T,w)}this.setIndex(u),this.setAttribute("position",new _t(m,3)),this.setAttribute("normal",new _t(x,3)),this.setAttribute("uv",new _t(v,2))}copy(e){return super.copy(e),this.parameters=Object.assign({},e.parameters),this}static fromJSON(e){return new Sn(e.width,e.height,e.widthSegments,e.heightSegments)}}class bn extends It{constructor(e=1,t=.4,n=12,s=48,r=Math.PI*2,a=0,o=Math.PI*2){super(),this.type="TorusGeometry",this.parameters={radius:e,tube:t,radialSegments:n,tubularSegments:s,arc:r,thetaStart:a,thetaLength:o},n=Math.floor(n),s=Math.floor(s);const l=[],c=[],h=[],f=[],d=new N,u=new N,m=new N;for(let x=0;x<=n;x++){const v=a+x/n*o;for(let g=0;g<=s;g++){const y=g/s*r;u.x=(e+t*Math.cos(v))*Math.cos(y),u.y=(e+t*Math.cos(v))*Math.sin(y),u.z=t*Math.sin(v),c.push(u.x,u.y,u.z),d.x=e*Math.cos(y),d.y=e*Math.sin(y),m.subVectors(u,d).normalize(),h.push(m.x,m.y,m.z),f.push(g/s),f.push(x/n)}}for(let x=1;x<=n;x++)for(let v=1;v<=s;v++){const g=(s+1)*x+v-1,y=(s+1)*(x-1)+v-1,E=(s+1)*(x-1)+v,M=(s+1)*x+v;l.push(g,y,M),l.push(y,E,M)}this.setIndex(l),this.setAttribute("position",new _t(c,3)),this.setAttribute("normal",new _t(h,3)),this.setAttribute("uv",new _t(f,2))}copy(e){return super.copy(e),this.parameters=Object.assign({},e.parameters),this}static fromJSON(e){return new bn(e.radius,e.tube,e.radialSegments,e.tubularSegments,e.arc)}}function Us(i){const e={};for(const t in i){e[t]={};for(const n in i[t]){const s=i[t][n];if(su(s))s.isRenderTargetTexture?(Ke("UniformsUtils: Textures of render targets cannot be cloned via cloneUniforms() or mergeUniforms()."),e[t][n]=null):e[t][n]=s.clone();else if(Array.isArray(s))if(su(s[0])){const r=[];for(let a=0,o=s.length;a<o;a++)r[a]=s[a].clone();e[t][n]=r}else e[t][n]=s.slice();else e[t][n]=s}}return e}function Qt(i){const e={};for(let t=0;t<i.length;t++){const n=Us(i[t]);for(const s in n)e[s]=n[s]}return e}function su(i){return i&&(i.isColor||i.isMatrix3||i.isMatrix4||i.isVector2||i.isVector3||i.isVector4||i.isTexture||i.isQuaternion)}function U0(i){const e=[];for(let t=0;t<i.length;t++)e.push(i[t].clone());return e}function zd(i){const e=i.getRenderTarget();return e===null?i.outputColorSpace:e.isXRRenderTarget===!0?e.texture.colorSpace:st.workingColorSpace}const Ir={clone:Us,merge:Qt};var F0=`void main() {
	gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
}`,O0=`void main() {
	gl_FragColor = vec4( 1.0, 0.0, 0.0, 1.0 );
}`;class $t extends Ti{constructor(e){super(),this.isShaderMaterial=!0,this.type="ShaderMaterial",this.defines={},this.uniforms={},this.uniformsGroups=[],this.vertexShader=F0,this.fragmentShader=O0,this.linewidth=1,this.wireframe=!1,this.wireframeLinewidth=1,this.fog=!1,this.lights=!1,this.clipping=!1,this.forceSinglePass=!0,this.extensions={clipCullDistance:!1,multiDraw:!1},this.defaultAttributeValues={color:[1,1,1],uv:[0,0],uv1:[0,0]},this.index0AttributeName=void 0,this.uniformsNeedUpdate=!1,this.glslVersion=null,e!==void 0&&this.setValues(e)}copy(e){return super.copy(e),this.fragmentShader=e.fragmentShader,this.vertexShader=e.vertexShader,this.uniforms=Us(e.uniforms),this.uniformsGroups=U0(e.uniformsGroups),this.defines=Object.assign({},e.defines),this.wireframe=e.wireframe,this.wireframeLinewidth=e.wireframeLinewidth,this.fog=e.fog,this.lights=e.lights,this.clipping=e.clipping,this.extensions=Object.assign({},e.extensions),this.glslVersion=e.glslVersion,this.defaultAttributeValues=Object.assign({},e.defaultAttributeValues),this.index0AttributeName=e.index0AttributeName,this.uniformsNeedUpdate=e.uniformsNeedUpdate,this}toJSON(e){const t=super.toJSON(e);t.glslVersion=this.glslVersion,t.uniforms={};for(const s in this.uniforms){const a=this.uniforms[s].value;a&&a.isTexture?t.uniforms[s]={type:"t",value:a.toJSON(e).uuid}:a&&a.isColor?t.uniforms[s]={type:"c",value:a.getHex()}:a&&a.isVector2?t.uniforms[s]={type:"v2",value:a.toArray()}:a&&a.isVector3?t.uniforms[s]={type:"v3",value:a.toArray()}:a&&a.isVector4?t.uniforms[s]={type:"v4",value:a.toArray()}:a&&a.isMatrix3?t.uniforms[s]={type:"m3",value:a.toArray()}:a&&a.isMatrix4?t.uniforms[s]={type:"m4",value:a.toArray()}:t.uniforms[s]={value:a}}Object.keys(this.defines).length>0&&(t.defines=this.defines),t.vertexShader=this.vertexShader,t.fragmentShader=this.fragmentShader,t.lights=this.lights,t.clipping=this.clipping;const n={};for(const s in this.extensions)this.extensions[s]===!0&&(n[s]=!0);return Object.keys(n).length>0&&(t.extensions=n),t}fromJSON(e,t){if(super.fromJSON(e,t),e.uniforms!==void 0)for(const n in e.uniforms){const s=e.uniforms[n];switch(this.uniforms[n]={},s.type){case"t":this.uniforms[n].value=t[s.value]||null;break;case"c":this.uniforms[n].value=new Le().setHex(s.value);break;case"v2":this.uniforms[n].value=new fe().fromArray(s.value);break;case"v3":this.uniforms[n].value=new N().fromArray(s.value);break;case"v4":this.uniforms[n].value=new Rt().fromArray(s.value);break;case"m3":this.uniforms[n].value=new Je().fromArray(s.value);break;case"m4":this.uniforms[n].value=new ut().fromArray(s.value);break;default:this.uniforms[n].value=s.value}}if(e.defines!==void 0&&(this.defines=e.defines),e.vertexShader!==void 0&&(this.vertexShader=e.vertexShader),e.fragmentShader!==void 0&&(this.fragmentShader=e.fragmentShader),e.glslVersion!==void 0&&(this.glslVersion=e.glslVersion),e.extensions!==void 0)for(const n in e.extensions)this.extensions[n]=e.extensions[n];return e.lights!==void 0&&(this.lights=e.lights),e.clipping!==void 0&&(this.clipping=e.clipping),this}}class Hd extends $t{constructor(e){super(e),this.isRawShaderMaterial=!0,this.type="RawShaderMaterial"}}class sn extends Ti{constructor(e){super(),this.isMeshStandardMaterial=!0,this.type="MeshStandardMaterial",this.defines={STANDARD:""},this.color=new Le(16777215),this.roughness=1,this.metalness=0,this.map=null,this.lightMap=null,this.lightMapIntensity=1,this.aoMap=null,this.aoMapIntensity=1,this.emissive=new Le(0),this.emissiveIntensity=1,this.emissiveMap=null,this.bumpMap=null,this.bumpScale=1,this.normalMap=null,this.normalMapType=Fa,this.normalScale=new fe(1,1),this.displacementMap=null,this.displacementScale=1,this.displacementBias=0,this.roughnessMap=null,this.metalnessMap=null,this.alphaMap=null,this.envMap=null,this.envMapRotation=new Yn,this.envMapIntensity=1,this.wireframe=!1,this.wireframeLinewidth=1,this.wireframeLinecap="round",this.wireframeLinejoin="round",this.flatShading=!1,this.fog=!0,this.setValues(e)}copy(e){return super.copy(e),this.defines={STANDARD:""},this.color.copy(e.color),this.roughness=e.roughness,this.metalness=e.metalness,this.map=e.map,this.lightMap=e.lightMap,this.lightMapIntensity=e.lightMapIntensity,this.aoMap=e.aoMap,this.aoMapIntensity=e.aoMapIntensity,this.emissive.copy(e.emissive),this.emissiveMap=e.emissiveMap,this.emissiveIntensity=e.emissiveIntensity,this.bumpMap=e.bumpMap,this.bumpScale=e.bumpScale,this.normalMap=e.normalMap,this.normalMapType=e.normalMapType,this.normalScale.copy(e.normalScale),this.displacementMap=e.displacementMap,this.displacementScale=e.displacementScale,this.displacementBias=e.displacementBias,this.roughnessMap=e.roughnessMap,this.metalnessMap=e.metalnessMap,this.alphaMap=e.alphaMap,this.envMap=e.envMap,this.envMapRotation.copy(e.envMapRotation),this.envMapIntensity=e.envMapIntensity,this.wireframe=e.wireframe,this.wireframeLinewidth=e.wireframeLinewidth,this.wireframeLinecap=e.wireframeLinecap,this.wireframeLinejoin=e.wireframeLinejoin,this.flatShading=e.flatShading,this.fog=e.fog,this}}class Mt extends sn{constructor(e){super(),this.isMeshPhysicalMaterial=!0,this.defines={STANDARD:"",PHYSICAL:""},this.type="MeshPhysicalMaterial",this.anisotropyRotation=0,this.anisotropyMap=null,this.clearcoatMap=null,this.clearcoatRoughness=0,this.clearcoatRoughnessMap=null,this.clearcoatNormalScale=new fe(1,1),this.clearcoatNormalMap=null,this.ior=1.5,Object.defineProperty(this,"reflectivity",{get:function(){return tt(2.5*(this.ior-1)/(this.ior+1),0,1)},set:function(t){this.ior=(1+.4*t)/(1-.4*t)}}),this.iridescenceMap=null,this.iridescenceIOR=1.3,this.iridescenceThicknessRange=[100,400],this.iridescenceThicknessMap=null,this.sheenColor=new Le(0),this.sheenColorMap=null,this.sheenRoughness=1,this.sheenRoughnessMap=null,this.transmissionMap=null,this.thickness=0,this.thicknessMap=null,this.attenuationDistance=1/0,this.attenuationColor=new Le(1,1,1),this.specularIntensity=1,this.specularIntensityMap=null,this.specularColor=new Le(1,1,1),this.specularColorMap=null,this._anisotropy=0,this._clearcoat=0,this._dispersion=0,this._iridescence=0,this._sheen=0,this._transmission=0,this.setValues(e)}get anisotropy(){return this._anisotropy}set anisotropy(e){this._anisotropy>0!=e>0&&this.version++,this._anisotropy=e}get clearcoat(){return this._clearcoat}set clearcoat(e){this._clearcoat>0!=e>0&&this.version++,this._clearcoat=e}get iridescence(){return this._iridescence}set iridescence(e){this._iridescence>0!=e>0&&this.version++,this._iridescence=e}get dispersion(){return this._dispersion}set dispersion(e){this._dispersion>0!=e>0&&this.version++,this._dispersion=e}get sheen(){return this._sheen}set sheen(e){this._sheen>0!=e>0&&this.version++,this._sheen=e}get transmission(){return this._transmission}set transmission(e){this._transmission>0!=e>0&&this.version++,this._transmission=e}copy(e){return super.copy(e),this.defines={STANDARD:"",PHYSICAL:""},this.anisotropy=e.anisotropy,this.anisotropyRotation=e.anisotropyRotation,this.anisotropyMap=e.anisotropyMap,this.clearcoat=e.clearcoat,this.clearcoatMap=e.clearcoatMap,this.clearcoatRoughness=e.clearcoatRoughness,this.clearcoatRoughnessMap=e.clearcoatRoughnessMap,this.clearcoatNormalMap=e.clearcoatNormalMap,this.clearcoatNormalScale.copy(e.clearcoatNormalScale),this.dispersion=e.dispersion,this.ior=e.ior,this.iridescence=e.iridescence,this.iridescenceMap=e.iridescenceMap,this.iridescenceIOR=e.iridescenceIOR,this.iridescenceThicknessRange=[...e.iridescenceThicknessRange],this.iridescenceThicknessMap=e.iridescenceThicknessMap,this.sheen=e.sheen,this.sheenColor.copy(e.sheenColor),this.sheenColorMap=e.sheenColorMap,this.sheenRoughness=e.sheenRoughness,this.sheenRoughnessMap=e.sheenRoughnessMap,this.transmission=e.transmission,this.transmissionMap=e.transmissionMap,this.thickness=e.thickness,this.thicknessMap=e.thicknessMap,this.attenuationDistance=e.attenuationDistance,this.attenuationColor.copy(e.attenuationColor),this.specularIntensity=e.specularIntensity,this.specularIntensityMap=e.specularIntensityMap,this.specularColor.copy(e.specularColor),this.specularColorMap=e.specularColorMap,this}}class B0 extends Ti{constructor(e){super(),this.isMeshLambertMaterial=!0,this.type="MeshLambertMaterial",this.color=new Le(16777215),this.map=null,this.lightMap=null,this.lightMapIntensity=1,this.aoMap=null,this.aoMapIntensity=1,this.emissive=new Le(0),this.emissiveIntensity=1,this.emissiveMap=null,this.bumpMap=null,this.bumpScale=1,this.normalMap=null,this.normalMapType=Fa,this.normalScale=new fe(1,1),this.displacementMap=null,this.displacementScale=1,this.displacementBias=0,this.specularMap=null,this.alphaMap=null,this.envMap=null,this.envMapRotation=new Yn,this.combine=wc,this.reflectivity=1,this.envMapIntensity=1,this.refractionRatio=.98,this.wireframe=!1,this.wireframeLinewidth=1,this.wireframeLinecap="round",this.wireframeLinejoin="round",this.flatShading=!1,this.fog=!0,this.setValues(e)}copy(e){return super.copy(e),this.color.copy(e.color),this.map=e.map,this.lightMap=e.lightMap,this.lightMapIntensity=e.lightMapIntensity,this.aoMap=e.aoMap,this.aoMapIntensity=e.aoMapIntensity,this.emissive.copy(e.emissive),this.emissiveMap=e.emissiveMap,this.emissiveIntensity=e.emissiveIntensity,this.bumpMap=e.bumpMap,this.bumpScale=e.bumpScale,this.normalMap=e.normalMap,this.normalMapType=e.normalMapType,this.normalScale.copy(e.normalScale),this.displacementMap=e.displacementMap,this.displacementScale=e.displacementScale,this.displacementBias=e.displacementBias,this.specularMap=e.specularMap,this.alphaMap=e.alphaMap,this.envMap=e.envMap,this.envMapRotation.copy(e.envMapRotation),this.combine=e.combine,this.reflectivity=e.reflectivity,this.envMapIntensity=e.envMapIntensity,this.refractionRatio=e.refractionRatio,this.wireframe=e.wireframe,this.wireframeLinewidth=e.wireframeLinewidth,this.wireframeLinecap=e.wireframeLinecap,this.wireframeLinejoin=e.wireframeLinejoin,this.flatShading=e.flatShading,this.fog=e.fog,this}}class k0 extends Ti{constructor(e){super(),this.isMeshDepthMaterial=!0,this.type="MeshDepthMaterial",this.depthPacking=sm,this.map=null,this.alphaMap=null,this.displacementMap=null,this.displacementScale=1,this.displacementBias=0,this.wireframe=!1,this.wireframeLinewidth=1,this.setValues(e)}copy(e){return super.copy(e),this.depthPacking=e.depthPacking,this.map=e.map,this.alphaMap=e.alphaMap,this.displacementMap=e.displacementMap,this.displacementScale=e.displacementScale,this.displacementBias=e.displacementBias,this.wireframe=e.wireframe,this.wireframeLinewidth=e.wireframeLinewidth,this}}class G0 extends Ti{constructor(e){super(),this.isMeshDistanceMaterial=!0,this.type="MeshDistanceMaterial",this.map=null,this.alphaMap=null,this.displacementMap=null,this.displacementScale=1,this.displacementBias=0,this.setValues(e)}copy(e){return super.copy(e),this.map=e.map,this.alphaMap=e.alphaMap,this.displacementMap=e.displacementMap,this.displacementScale=e.displacementScale,this.displacementBias=e.displacementBias,this}}const Wo={enabled:!1,files:{},add:function(i,e){this.enabled!==!1&&(ru(i)||(this.files[i]=e))},get:function(i){if(this.enabled!==!1&&!ru(i))return this.files[i]},remove:function(i){delete this.files[i]},clear:function(){this.files={}}};function ru(i){try{const e=i.slice(i.indexOf(":")+1);return new URL(e).protocol==="blob:"}catch{return!1}}class z0{constructor(e,t,n){const s=this;let r=!1,a=0,o=0,l;const c=[];this.onStart=void 0,this.onLoad=e,this.onProgress=t,this.onError=n,this._abortController=null,this.itemStart=function(h){o++,r===!1&&s.onStart!==void 0&&s.onStart(h,a,o),r=!0},this.itemEnd=function(h){a++,s.onProgress!==void 0&&s.onProgress(h,a,o),a===o&&(r=!1,s.onLoad!==void 0&&s.onLoad())},this.itemError=function(h){s.onError!==void 0&&s.onError(h)},this.resolveURL=function(h){return h=h.normalize("NFC"),l?l(h):h},this.setURLModifier=function(h){return l=h,this},this.addHandler=function(h,f){return c.push(h,f),this},this.removeHandler=function(h){const f=c.indexOf(h);return f!==-1&&c.splice(f,2),this},this.getHandler=function(h){for(let f=0,d=c.length;f<d;f+=2){const u=c[f],m=c[f+1];if(u.global&&(u.lastIndex=0),u.test(h))return m}return null},this.abort=function(){return this.abortController.abort(),this._abortController=null,this}}get abortController(){return this._abortController||(this._abortController=new AbortController),this._abortController}}const H0=new z0;class jc{constructor(e){this.manager=e!==void 0?e:H0,this.crossOrigin="anonymous",this.withCredentials=!1,this.path="",this.resourcePath="",this.requestHeader={},typeof __THREE_DEVTOOLS__<"u"&&__THREE_DEVTOOLS__.dispatchEvent(new CustomEvent("observe",{detail:this}))}load(){}loadAsync(e,t){const n=this;return new Promise(function(s,r){n.load(e,s,t,r)})}parse(){}setCrossOrigin(e){return this.crossOrigin=e,this}setWithCredentials(e){return this.withCredentials=e,this}setPath(e){return this.path=e,this}setResourcePath(e){return this.resourcePath=e,this}setRequestHeader(e){return this.requestHeader=e,this}abort(){return this}}jc.DEFAULT_MATERIAL_NAME="__DEFAULT";const _s=new WeakMap;class Vd extends jc{constructor(e){super(e)}load(e,t,n,s){this.path!==void 0&&(e=this.path+e),e=this.manager.resolveURL(e);const r=this,a=Wo.get(`image:${e}`);if(a!==void 0){if(a.complete===!0)r.manager.itemStart(e),setTimeout(function(){t&&t(a),r.manager.itemEnd(e)},0);else{let f=_s.get(a);f===void 0&&(f=[],_s.set(a,f)),f.push({onLoad:t,onError:s})}return a}const o=wr("img");function l(){h(),t&&t(this);const f=_s.get(this)||[];for(let d=0;d<f.length;d++){const u=f[d];u.onLoad&&u.onLoad(this)}_s.delete(this),r.manager.itemEnd(e)}function c(f){h(),s&&s(f),Wo.remove(`image:${e}`);const d=_s.get(this)||[];for(let u=0;u<d.length;u++){const m=d[u];m.onError&&m.onError(f)}_s.delete(this),r.manager.itemError(e),r.manager.itemEnd(e)}function h(){o.removeEventListener("load",l,!1),o.removeEventListener("error",c,!1)}return o.addEventListener("load",l,!1),o.addEventListener("error",c,!1),e.slice(0,5)!=="data:"&&this.crossOrigin!==void 0&&(o.crossOrigin=this.crossOrigin),Wo.add(`image:${e}`,o),r.manager.itemStart(e),o.src=e,o}}class Wd extends jc{constructor(e){super(e)}load(e,t,n,s){const r=new Wt,a=new Vd(this.manager);return a.setCrossOrigin(this.crossOrigin),a.setPath(this.path),a.load(e,function(o){r.image=o,r.needsUpdate=!0,t!==void 0&&t(r)},n,s),r}}class ja extends Lt{constructor(e,t=1){super(),this.isLight=!0,this.type="Light",this.color=new Le(e),this.intensity=t}dispose(){this.dispatchEvent({type:"dispose"})}copy(e,t){return super.copy(e,t),this.color.copy(e.color),this.intensity=e.intensity,this}toJSON(e){const t=super.toJSON(e);return t.object.color=this.color.getHex(),t.object.intensity=this.intensity,t}}class V0 extends ja{constructor(e,t,n){super(e,n),this.isHemisphereLight=!0,this.type="HemisphereLight",this.position.copy(Lt.DEFAULT_UP),this.updateMatrix(),this.groundColor=new Le(t)}copy(e,t){return super.copy(e,t),this.groundColor.copy(e.groundColor),this}toJSON(e){const t=super.toJSON(e);return t.object.groundColor=this.groundColor.getHex(),t}}const Xo=new ut,au=new N,ou=new N;class Xd{constructor(e){this.camera=e,this.intensity=1,this.bias=0,this.biasNode=null,this.normalBias=0,this.radius=1,this.blurSamples=8,this.mapSize=new fe(512,512),this.mapType=un,this.map=null,this.mapPass=null,this.matrix=new ut,this.autoUpdate=!0,this.needsUpdate=!1,this._frustum=new Yc,this._frameExtents=new fe(1,1),this._viewportCount=1,this._viewports=[new Rt(0,0,1,1)]}getViewportCount(){return this._viewportCount}getFrustum(){return this._frustum}updateMatrices(e){const t=this.camera,n=this.matrix;au.setFromMatrixPosition(e.matrixWorld),t.position.copy(au),ou.setFromMatrixPosition(e.target.matrixWorld),t.lookAt(ou),t.updateMatrixWorld(),Xo.multiplyMatrices(t.projectionMatrix,t.matrixWorldInverse),this._frustum.setFromProjectionMatrix(Xo,t.coordinateSystem,t.reversedDepth),t.coordinateSystem===Ar||t.reversedDepth?n.set(.5,0,0,.5,0,.5,0,.5,0,0,1,0,0,0,0,1):n.set(.5,0,0,.5,0,.5,0,.5,0,0,.5,.5,0,0,0,1),n.multiply(Xo)}getViewport(e){return this._viewports[e]}getFrameExtents(){return this._frameExtents}dispose(){this.map&&this.map.dispose(),this.mapPass&&this.mapPass.dispose()}copy(e){return this.camera=e.camera.clone(),this.intensity=e.intensity,this.bias=e.bias,this.radius=e.radius,this.autoUpdate=e.autoUpdate,this.needsUpdate=e.needsUpdate,this.normalBias=e.normalBias,this.blurSamples=e.blurSamples,this.mapSize.copy(e.mapSize),this.biasNode=e.biasNode,this}clone(){return new this.constructor().copy(this)}toJSON(){const e={};return this.intensity!==1&&(e.intensity=this.intensity),this.bias!==0&&(e.bias=this.bias),this.normalBias!==0&&(e.normalBias=this.normalBias),this.radius!==1&&(e.radius=this.radius),(this.mapSize.x!==512||this.mapSize.y!==512)&&(e.mapSize=this.mapSize.toArray()),e.camera=this.camera.toJSON(!1).object,delete e.camera.matrix,e}}const da=new N,fa=new Vn,Un=new N;class Yd extends Lt{constructor(){super(),this.isCamera=!0,this.type="Camera",this.matrixWorldInverse=new ut,this.projectionMatrix=new ut,this.projectionMatrixInverse=new ut,this.coordinateSystem=Bn,this._reversedDepth=!1}get reversedDepth(){return this._reversedDepth}copy(e,t){return super.copy(e,t),this.matrixWorldInverse.copy(e.matrixWorldInverse),this.projectionMatrix.copy(e.projectionMatrix),this.projectionMatrixInverse.copy(e.projectionMatrixInverse),this.coordinateSystem=e.coordinateSystem,this}getWorldDirection(e){return super.getWorldDirection(e).negate()}updateMatrixWorld(e){super.updateMatrixWorld(e),this.matrixWorld.decompose(da,fa,Un),Un.x===1&&Un.y===1&&Un.z===1?this.matrixWorldInverse.copy(this.matrixWorld).invert():this.matrixWorldInverse.compose(da,fa,Un.set(1,1,1)).invert()}updateWorldMatrix(e,t,n=!1){super.updateWorldMatrix(e,t,n),this.matrixWorld.decompose(da,fa,Un),Un.x===1&&Un.y===1&&Un.z===1?this.matrixWorldInverse.copy(this.matrixWorld).invert():this.matrixWorldInverse.compose(da,fa,Un.set(1,1,1)).invert()}clone(){return new this.constructor().copy(this)}}const _i=new N,lu=new fe,cu=new fe;class tn extends Yd{constructor(e=50,t=1,n=.1,s=2e3){super(),this.isPerspectiveCamera=!0,this.type="PerspectiveCamera",this.fov=e,this.zoom=1,this.near=n,this.far=s,this.focus=10,this.aspect=t,this.view=null,this.filmGauge=35,this.filmOffset=0,this.updateProjectionMatrix()}copy(e,t){return super.copy(e,t),this.fov=e.fov,this.zoom=e.zoom,this.near=e.near,this.far=e.far,this.focus=e.focus,this.aspect=e.aspect,this.view=e.view===null?null:Object.assign({},e.view),this.filmGauge=e.filmGauge,this.filmOffset=e.filmOffset,this}setFocalLength(e){const t=.5*this.getFilmHeight()/e;this.fov=Ls*2*Math.atan(t),this.updateProjectionMatrix()}getFocalLength(){const e=Math.tan(_r*.5*this.fov);return .5*this.getFilmHeight()/e}getEffectiveFOV(){return Ls*2*Math.atan(Math.tan(_r*.5*this.fov)/this.zoom)}getFilmWidth(){return this.filmGauge*Math.min(this.aspect,1)}getFilmHeight(){return this.filmGauge/Math.max(this.aspect,1)}getViewBounds(e,t,n){_i.set(-1,-1,.5).applyMatrix4(this.projectionMatrixInverse),t.set(_i.x,_i.y).multiplyScalar(-e/_i.z),_i.set(1,1,.5).applyMatrix4(this.projectionMatrixInverse),n.set(_i.x,_i.y).multiplyScalar(-e/_i.z)}getViewSize(e,t){return this.getViewBounds(e,lu,cu),t.subVectors(cu,lu)}setViewOffset(e,t,n,s,r,a){this.aspect=e/t,this.view===null&&(this.view={enabled:!0,fullWidth:1,fullHeight:1,offsetX:0,offsetY:0,width:1,height:1}),this.view.enabled=!0,this.view.fullWidth=e,this.view.fullHeight=t,this.view.offsetX=n,this.view.offsetY=s,this.view.width=r,this.view.height=a,this.updateProjectionMatrix()}clearViewOffset(){this.view!==null&&(this.view.enabled=!1),this.updateProjectionMatrix()}updateProjectionMatrix(){const e=this.near;let t=e*Math.tan(_r*.5*this.fov)/this.zoom,n=2*t,s=this.aspect*n,r=-.5*s;const a=this.view;if(this.view!==null&&this.view.enabled){const l=a.fullWidth,c=a.fullHeight;r+=a.offsetX*s/l,t-=a.offsetY*n/c,s*=a.width/l,n*=a.height/c}const o=this.filmOffset;o!==0&&(r+=e*o/this.getFilmWidth()),this.projectionMatrix.makePerspective(r,r+s,t,t-n,e,this.far,this.coordinateSystem,this.reversedDepth),this.projectionMatrixInverse.copy(this.projectionMatrix).invert()}toJSON(e){const t=super.toJSON(e);return t.object.fov=this.fov,t.object.zoom=this.zoom,t.object.near=this.near,t.object.far=this.far,t.object.focus=this.focus,t.object.aspect=this.aspect,this.view!==null&&(t.object.view=Object.assign({},this.view)),t.object.filmGauge=this.filmGauge,t.object.filmOffset=this.filmOffset,t}}class W0 extends Xd{constructor(){super(new tn(50,1,.5,500)),this.isSpotLightShadow=!0,this.focus=1,this.aspect=1}updateMatrices(e){const t=this.camera,n=Ls*2*e.angle*this.focus,s=this.mapSize.width/this.mapSize.height*this.aspect,r=e.distance||t.far;(n!==t.fov||s!==t.aspect||r!==t.far)&&(t.fov=n,t.aspect=s,t.far=r,t.updateProjectionMatrix()),super.updateMatrices(e)}copy(e){return super.copy(e),this.focus=e.focus,this}}class X0 extends ja{constructor(e,t,n=0,s=Math.PI/3,r=0,a=2){super(e,t),this.isSpotLight=!0,this.type="SpotLight",this.position.copy(Lt.DEFAULT_UP),this.updateMatrix(),this.target=new Lt,this.distance=n,this.angle=s,this.penumbra=r,this.decay=a,this.map=null,this.shadow=new W0}get power(){return this.intensity*Math.PI}set power(e){this.intensity=e/Math.PI}dispose(){super.dispose(),this.shadow.dispose()}copy(e,t){return super.copy(e,t),this.distance=e.distance,this.angle=e.angle,this.penumbra=e.penumbra,this.decay=e.decay,this.target=e.target.clone(),this.map=e.map,this.shadow=e.shadow.clone(),this}toJSON(e){const t=super.toJSON(e);return t.object.distance=this.distance,t.object.angle=this.angle,t.object.decay=this.decay,t.object.penumbra=this.penumbra,t.object.target=this.target.uuid,this.map&&this.map.isTexture&&(t.object.map=this.map.toJSON(e).uuid),t.object.shadow=this.shadow.toJSON(),t}}class Y0 extends Xd{constructor(){super(new tn(90,1,.5,500)),this.isPointLightShadow=!0}}class sc extends ja{constructor(e,t,n=0,s=2){super(e,t),this.isPointLight=!0,this.type="PointLight",this.distance=n,this.decay=s,this.shadow=new Y0}get power(){return this.intensity*4*Math.PI}set power(e){this.intensity=e/(4*Math.PI)}dispose(){super.dispose(),this.shadow.dispose()}copy(e,t){return super.copy(e,t),this.distance=e.distance,this.decay=e.decay,this.shadow=e.shadow.clone(),this}toJSON(e){const t=super.toJSON(e);return t.object.distance=this.distance,t.object.decay=this.decay,t.object.shadow=this.shadow.toJSON(),t}}class eh extends Yd{constructor(e=-1,t=1,n=1,s=-1,r=.1,a=2e3){super(),this.isOrthographicCamera=!0,this.type="OrthographicCamera",this.zoom=1,this.view=null,this.left=e,this.right=t,this.top=n,this.bottom=s,this.near=r,this.far=a,this.updateProjectionMatrix()}copy(e,t){return super.copy(e,t),this.left=e.left,this.right=e.right,this.top=e.top,this.bottom=e.bottom,this.near=e.near,this.far=e.far,this.zoom=e.zoom,this.view=e.view===null?null:Object.assign({},e.view),this}setViewOffset(e,t,n,s,r,a){this.view===null&&(this.view={enabled:!0,fullWidth:1,fullHeight:1,offsetX:0,offsetY:0,width:1,height:1}),this.view.enabled=!0,this.view.fullWidth=e,this.view.fullHeight=t,this.view.offsetX=n,this.view.offsetY=s,this.view.width=r,this.view.height=a,this.updateProjectionMatrix()}clearViewOffset(){this.view!==null&&(this.view.enabled=!1),this.updateProjectionMatrix()}updateProjectionMatrix(){const e=(this.right-this.left)/(2*this.zoom),t=(this.top-this.bottom)/(2*this.zoom),n=(this.right+this.left)/2,s=(this.top+this.bottom)/2;let r=n-e,a=n+e,o=s+t,l=s-t;if(this.view!==null&&this.view.enabled){const c=(this.right-this.left)/this.view.fullWidth/this.zoom,h=(this.top-this.bottom)/this.view.fullHeight/this.zoom;r+=c*this.view.offsetX,a=r+c*this.view.width,o-=h*this.view.offsetY,l=o-h*this.view.height}this.projectionMatrix.makeOrthographic(r,a,o,l,this.near,this.far,this.coordinateSystem,this.reversedDepth),this.projectionMatrixInverse.copy(this.projectionMatrix).invert()}toJSON(e){const t=super.toJSON(e);return t.object.zoom=this.zoom,t.object.left=this.left,t.object.right=this.right,t.object.top=this.top,t.object.bottom=this.bottom,t.object.near=this.near,t.object.far=this.far,this.view!==null&&(t.object.view=Object.assign({},this.view)),t}}class q0 extends ja{constructor(e,t){super(e,t),this.isAmbientLight=!0,this.type="AmbientLight"}}const xs=-90,Ss=1;class K0 extends Lt{constructor(e,t,n){super(),this.type="CubeCamera",this.renderTarget=n,this.coordinateSystem=null,this.activeMipmapLevel=0;const s=new tn(xs,Ss,e,t);s.layers=this.layers,this.add(s);const r=new tn(xs,Ss,e,t);r.layers=this.layers,this.add(r);const a=new tn(xs,Ss,e,t);a.layers=this.layers,this.add(a);const o=new tn(xs,Ss,e,t);o.layers=this.layers,this.add(o);const l=new tn(xs,Ss,e,t);l.layers=this.layers,this.add(l);const c=new tn(xs,Ss,e,t);c.layers=this.layers,this.add(c)}updateCoordinateSystem(){const e=this.coordinateSystem,t=this.children.concat(),[n,s,r,a,o,l]=t;for(const c of t)this.remove(c);if(e===Bn)n.up.set(0,1,0),n.lookAt(1,0,0),s.up.set(0,1,0),s.lookAt(-1,0,0),r.up.set(0,0,-1),r.lookAt(0,1,0),a.up.set(0,0,1),a.lookAt(0,-1,0),o.up.set(0,1,0),o.lookAt(0,0,1),l.up.set(0,1,0),l.lookAt(0,0,-1);else if(e===Ar)n.up.set(0,-1,0),n.lookAt(-1,0,0),s.up.set(0,-1,0),s.lookAt(1,0,0),r.up.set(0,0,1),r.lookAt(0,1,0),a.up.set(0,0,-1),a.lookAt(0,-1,0),o.up.set(0,-1,0),o.lookAt(0,0,1),l.up.set(0,-1,0),l.lookAt(0,0,-1);else throw new Error("THREE.CubeCamera.updateCoordinateSystem(): Invalid coordinate system: "+e);for(const c of t)this.add(c),c.updateMatrixWorld()}update(e,t){this.parent===null&&this.updateMatrixWorld();const{renderTarget:n,activeMipmapLevel:s}=this;this.coordinateSystem!==e.coordinateSystem&&(this.coordinateSystem=e.coordinateSystem,this.updateCoordinateSystem());const[r,a,o,l,c,h]=this.children,f=e.getRenderTarget(),d=e.getActiveCubeFace(),u=e.getActiveMipmapLevel(),m=e.xr.enabled;e.xr.enabled=!1;const x=n.texture.generateMipmaps;n.texture.generateMipmaps=!1;let v=!1;e.isWebGLRenderer===!0?v=e.state.buffers.depth.getReversed():v=e.reversedDepthBuffer,e.setRenderTarget(n,0,s),v&&e.autoClear===!1&&e.clearDepth(),e.render(t,r),e.setRenderTarget(n,1,s),v&&e.autoClear===!1&&e.clearDepth(),e.render(t,a),e.setRenderTarget(n,2,s),v&&e.autoClear===!1&&e.clearDepth(),e.render(t,o),e.setRenderTarget(n,3,s),v&&e.autoClear===!1&&e.clearDepth(),e.render(t,l),e.setRenderTarget(n,4,s),v&&e.autoClear===!1&&e.clearDepth(),e.render(t,c),n.texture.generateMipmaps=x,e.setRenderTarget(n,5,s),v&&e.autoClear===!1&&e.clearDepth(),e.render(t,h),e.setRenderTarget(f,d,u),e.xr.enabled=m,n.texture.needsPMREMUpdate=!0}}class $0 extends tn{constructor(e=[]){super(),this.isArrayCamera=!0,this.isMultiViewCamera=!1,this.cameras=e}}class Z0{constructor(){this._previousTime=0,this._currentTime=0,this._startTime=performance.now(),this._delta=0,this._elapsed=0,this._timescale=1,this._document=null,this._pageVisibilityHandler=null}connect(e){this._document=e,e.hidden!==void 0&&(this._pageVisibilityHandler=J0.bind(this),e.addEventListener("visibilitychange",this._pageVisibilityHandler,!1))}disconnect(){this._pageVisibilityHandler!==null&&(this._document.removeEventListener("visibilitychange",this._pageVisibilityHandler),this._pageVisibilityHandler=null),this._document=null}getDelta(){return this._delta/1e3}getElapsed(){return this._elapsed/1e3}getTimescale(){return this._timescale}setTimescale(e){return this._timescale=e,this}reset(){return this._currentTime=performance.now()-this._startTime,this}dispose(){this.disconnect()}update(e){return this._pageVisibilityHandler!==null&&this._document.hidden===!0?this._delta=0:(this._previousTime=this._currentTime,this._currentTime=(e!==void 0?e:performance.now())-this._startTime,this._delta=(this._currentTime-this._previousTime)*this._timescale,this._elapsed+=this._delta),this}}function J0(){this._document.hidden===!1&&this.reset()}class qd{static{qd.prototype.isMatrix2=!0}constructor(e,t,n,s){this.elements=[1,0,0,1],e!==void 0&&this.set(e,t,n,s)}identity(){return this.set(1,0,0,1),this}fromArray(e,t=0){for(let n=0;n<4;n++)this.elements[n]=e[n+t];return this}set(e,t,n,s){const r=this.elements;return r[0]=e,r[2]=t,r[1]=n,r[3]=s,this}}function hu(i,e,t,n){const s=Q0(n);switch(t){case gd:return i*e;case Oc:return i*e/s.components*s.byteLength;case Bc:return i*e/s.components*s.byteLength;case Vi:return i*e*2/s.components*s.byteLength;case kc:return i*e*2/s.components*s.byteLength;case vd:return i*e*3/s.components*s.byteLength;case Ln:return i*e*4/s.components*s.byteLength;case Gc:return i*e*4/s.components*s.byteLength;case Ea:case Ta:return Math.floor((i+3)/4)*Math.floor((e+3)/4)*8;case Aa:case wa:return Math.floor((i+3)/4)*Math.floor((e+3)/4)*16;case bl:case Tl:return Math.max(i,16)*Math.max(e,8)/4;case yl:case El:return Math.max(i,8)*Math.max(e,8)/2;case Al:case wl:case Rl:case Pl:return Math.floor((i+3)/4)*Math.floor((e+3)/4)*8;case Cl:case Na:case Il:return Math.floor((i+3)/4)*Math.floor((e+3)/4)*16;case Ll:return Math.floor((i+3)/4)*Math.floor((e+3)/4)*16;case Dl:return Math.floor((i+4)/5)*Math.floor((e+3)/4)*16;case Nl:return Math.floor((i+4)/5)*Math.floor((e+4)/5)*16;case Ul:return Math.floor((i+5)/6)*Math.floor((e+4)/5)*16;case Fl:return Math.floor((i+5)/6)*Math.floor((e+5)/6)*16;case Ol:return Math.floor((i+7)/8)*Math.floor((e+4)/5)*16;case Bl:return Math.floor((i+7)/8)*Math.floor((e+5)/6)*16;case kl:return Math.floor((i+7)/8)*Math.floor((e+7)/8)*16;case Gl:return Math.floor((i+9)/10)*Math.floor((e+4)/5)*16;case zl:return Math.floor((i+9)/10)*Math.floor((e+5)/6)*16;case Hl:return Math.floor((i+9)/10)*Math.floor((e+7)/8)*16;case Vl:return Math.floor((i+9)/10)*Math.floor((e+9)/10)*16;case Wl:return Math.floor((i+11)/12)*Math.floor((e+9)/10)*16;case Xl:return Math.floor((i+11)/12)*Math.floor((e+11)/12)*16;case Yl:case ql:case Kl:return Math.ceil(i/4)*Math.ceil(e/4)*16;case $l:case Zl:return Math.ceil(i/4)*Math.ceil(e/4)*8;case Ua:case Jl:return Math.ceil(i/4)*Math.ceil(e/4)*16}throw new Error(`Unable to determine texture byte length for ${t} format.`)}function Q0(i){switch(i){case un:case dd:return{byteLength:1,components:1};case Er:case fd:case dn:return{byteLength:2,components:1};case Uc:case Fc:return{byteLength:2,components:4};case Xn:case Nc:case In:return{byteLength:4,components:1};case pd:case md:return{byteLength:4,components:3}}throw new Error(`THREE.TextureUtils: Unknown texture type ${i}.`)}typeof __THREE_DEVTOOLS__<"u"&&__THREE_DEVTOOLS__.dispatchEvent(new CustomEvent("register",{detail:{revision:Ac}}));typeof window<"u"&&(window.__THREE__?Ke("WARNING: Multiple instances of Three.js being imported."):window.__THREE__=Ac);/**
 * @license
 * Copyright 2010-2026 Three.js Authors
 * SPDX-License-Identifier: MIT
 */function Kd(){let i=null,e=!1,t=null,n=null;function s(r,a){t(r,a),n=i.requestAnimationFrame(s)}return{start:function(){e!==!0&&t!==null&&i!==null&&(n=i.requestAnimationFrame(s),e=!0)},stop:function(){i!==null&&i.cancelAnimationFrame(n),e=!1},setAnimationLoop:function(r){t=r},setContext:function(r){i=r}}}function j0(i){const e=new WeakMap;function t(o,l){const c=o.array,h=o.usage,f=c.byteLength,d=i.createBuffer();i.bindBuffer(l,d),i.bufferData(l,c,h),o.onUploadCallback();let u;if(c instanceof Float32Array)u=i.FLOAT;else if(typeof Float16Array<"u"&&c instanceof Float16Array)u=i.HALF_FLOAT;else if(c instanceof Uint16Array)o.isFloat16BufferAttribute?u=i.HALF_FLOAT:u=i.UNSIGNED_SHORT;else if(c instanceof Int16Array)u=i.SHORT;else if(c instanceof Uint32Array)u=i.UNSIGNED_INT;else if(c instanceof Int32Array)u=i.INT;else if(c instanceof Int8Array)u=i.BYTE;else if(c instanceof Uint8Array)u=i.UNSIGNED_BYTE;else if(c instanceof Uint8ClampedArray)u=i.UNSIGNED_BYTE;else throw new Error("THREE.WebGLAttributes: Unsupported buffer data format: "+c);return{buffer:d,type:u,bytesPerElement:c.BYTES_PER_ELEMENT,version:o.version,size:f}}function n(o,l,c){const h=l.array,f=l.updateRanges;if(i.bindBuffer(c,o),f.length===0)i.bufferSubData(c,0,h);else{f.sort((u,m)=>u.start-m.start);let d=0;for(let u=1;u<f.length;u++){const m=f[d],x=f[u];x.start<=m.start+m.count+1?m.count=Math.max(m.count,x.start+x.count-m.start):(++d,f[d]=x)}f.length=d+1;for(let u=0,m=f.length;u<m;u++){const x=f[u];i.bufferSubData(c,x.start*h.BYTES_PER_ELEMENT,h,x.start,x.count)}l.clearUpdateRanges()}l.onUploadCallback()}function s(o){return o.isInterleavedBufferAttribute&&(o=o.data),e.get(o)}function r(o){o.isInterleavedBufferAttribute&&(o=o.data);const l=e.get(o);l&&(i.deleteBuffer(l.buffer),e.delete(o))}function a(o,l){if(o.isInterleavedBufferAttribute&&(o=o.data),o.isGLBufferAttribute){const h=e.get(o);(!h||h.version<o.version)&&e.set(o,{buffer:o.buffer,type:o.type,bytesPerElement:o.elementSize,version:o.version});return}const c=e.get(o);if(c===void 0)e.set(o,t(o,l));else if(c.version<o.version){if(c.size!==o.array.byteLength)throw new Error("THREE.WebGLAttributes: The size of the buffer attribute's array buffer does not match the original size. Resizing buffer attributes is not supported.");n(c.buffer,o,l),c.version=o.version}}return{get:s,remove:r,update:a}}var eg=`#ifdef USE_ALPHAHASH
	if ( diffuseColor.a < getAlphaHashThreshold( vPosition ) ) discard;
#endif`,tg=`#ifdef USE_ALPHAHASH
	const float ALPHA_HASH_SCALE = 0.05;
	float hash2D( vec2 value ) {
		return fract( 1.0e4 * sin( 17.0 * value.x + 0.1 * value.y ) * ( 0.1 + abs( sin( 13.0 * value.y + value.x ) ) ) );
	}
	float hash3D( vec3 value ) {
		return hash2D( vec2( hash2D( value.xy ), value.z ) );
	}
	float getAlphaHashThreshold( vec3 position ) {
		float maxDeriv = max(
			length( dFdx( position.xyz ) ),
			length( dFdy( position.xyz ) )
		);
		float pixScale = 1.0 / ( ALPHA_HASH_SCALE * maxDeriv );
		vec2 pixScales = vec2(
			exp2( floor( log2( pixScale ) ) ),
			exp2( ceil( log2( pixScale ) ) )
		);
		vec2 alpha = vec2(
			hash3D( floor( pixScales.x * position.xyz ) ),
			hash3D( floor( pixScales.y * position.xyz ) )
		);
		float lerpFactor = fract( log2( pixScale ) );
		float x = ( 1.0 - lerpFactor ) * alpha.x + lerpFactor * alpha.y;
		float a = min( lerpFactor, 1.0 - lerpFactor );
		vec3 cases = vec3(
			x * x / ( 2.0 * a * ( 1.0 - a ) ),
			( x - 0.5 * a ) / ( 1.0 - a ),
			1.0 - ( ( 1.0 - x ) * ( 1.0 - x ) / ( 2.0 * a * ( 1.0 - a ) ) )
		);
		float threshold = ( x < ( 1.0 - a ) )
			? ( ( x < a ) ? cases.x : cases.y )
			: cases.z;
		return clamp( threshold , 1.0e-6, 1.0 );
	}
#endif`,ng=`#ifdef USE_ALPHAMAP
	diffuseColor.a *= texture2D( alphaMap, vAlphaMapUv ).g;
#endif`,ig=`#ifdef USE_ALPHAMAP
	uniform sampler2D alphaMap;
#endif`,sg=`#ifdef USE_ALPHATEST
	#ifdef ALPHA_TO_COVERAGE
	diffuseColor.a = smoothstep( alphaTest, alphaTest + fwidth( diffuseColor.a ), diffuseColor.a );
	if ( diffuseColor.a == 0.0 ) discard;
	#else
	if ( diffuseColor.a < alphaTest ) discard;
	#endif
#endif`,rg=`#ifdef USE_ALPHATEST
	uniform float alphaTest;
#endif`,ag=`#ifdef USE_AOMAP
	float ambientOcclusion = ( texture2D( aoMap, vAoMapUv ).r - 1.0 ) * aoMapIntensity + 1.0;
	reflectedLight.indirectDiffuse *= ambientOcclusion;
	#if defined( USE_CLEARCOAT ) 
		clearcoatSpecularIndirect *= ambientOcclusion;
	#endif
	#if defined( USE_SHEEN ) 
		sheenSpecularIndirect *= ambientOcclusion;
	#endif
	#if defined( USE_ENVMAP ) && defined( STANDARD )
		float dotNV = saturate( dot( geometryNormal, geometryViewDir ) );
		reflectedLight.indirectSpecular *= computeSpecularOcclusion( dotNV, ambientOcclusion, material.roughness );
	#endif
#endif`,og=`#ifdef USE_AOMAP
	uniform sampler2D aoMap;
	uniform float aoMapIntensity;
#endif`,lg=`#ifdef USE_BATCHING
	#if ! defined( GL_ANGLE_multi_draw )
	#define gl_DrawID _gl_DrawID
	uniform int _gl_DrawID;
	#endif
	uniform highp sampler2D batchingTexture;
	uniform highp usampler2D batchingIdTexture;
	mat4 getBatchingMatrix( const in float i ) {
		int size = textureSize( batchingTexture, 0 ).x;
		int j = int( i ) * 4;
		int x = j % size;
		int y = j / size;
		vec4 v1 = texelFetch( batchingTexture, ivec2( x, y ), 0 );
		vec4 v2 = texelFetch( batchingTexture, ivec2( x + 1, y ), 0 );
		vec4 v3 = texelFetch( batchingTexture, ivec2( x + 2, y ), 0 );
		vec4 v4 = texelFetch( batchingTexture, ivec2( x + 3, y ), 0 );
		return mat4( v1, v2, v3, v4 );
	}
	float getIndirectIndex( const in int i ) {
		int size = textureSize( batchingIdTexture, 0 ).x;
		int x = i % size;
		int y = i / size;
		return float( texelFetch( batchingIdTexture, ivec2( x, y ), 0 ).r );
	}
#endif
#ifdef USE_BATCHING_COLOR
	uniform sampler2D batchingColorTexture;
	vec4 getBatchingColor( const in float i ) {
		int size = textureSize( batchingColorTexture, 0 ).x;
		int j = int( i );
		int x = j % size;
		int y = j / size;
		return texelFetch( batchingColorTexture, ivec2( x, y ), 0 );
	}
#endif`,cg=`#ifdef USE_BATCHING
	mat4 batchingMatrix = getBatchingMatrix( getIndirectIndex( gl_DrawID ) );
#endif`,hg=`vec3 transformed = vec3( position );
#ifdef USE_ALPHAHASH
	vPosition = vec3( position );
#endif`,ug=`vec3 objectNormal = vec3( normal );
#ifdef USE_TANGENT
	vec3 objectTangent = vec3( tangent.xyz );
#endif`,dg=`float G_BlinnPhong_Implicit( ) {
	return 0.25;
}
float D_BlinnPhong( const in float shininess, const in float dotNH ) {
	return RECIPROCAL_PI * ( shininess * 0.5 + 1.0 ) * pow( dotNH, shininess );
}
vec3 BRDF_BlinnPhong( const in vec3 lightDir, const in vec3 viewDir, const in vec3 normal, const in vec3 specularColor, const in float shininess ) {
	vec3 halfDir = normalize( lightDir + viewDir );
	float dotNH = saturate( dot( normal, halfDir ) );
	float dotVH = saturate( dot( viewDir, halfDir ) );
	vec3 F = F_Schlick( specularColor, 1.0, dotVH );
	float G = G_BlinnPhong_Implicit( );
	float D = D_BlinnPhong( shininess, dotNH );
	return F * ( G * D );
} // validated`,fg=`#ifdef USE_IRIDESCENCE
	const mat3 XYZ_TO_REC709 = mat3(
		 3.2404542, -0.9692660,  0.0556434,
		-1.5371385,  1.8760108, -0.2040259,
		-0.4985314,  0.0415560,  1.0572252
	);
	vec3 Fresnel0ToIor( vec3 fresnel0 ) {
		vec3 sqrtF0 = sqrt( fresnel0 );
		return ( vec3( 1.0 ) + sqrtF0 ) / ( vec3( 1.0 ) - sqrtF0 );
	}
	vec3 IorToFresnel0( vec3 transmittedIor, float incidentIor ) {
		return pow2( ( transmittedIor - vec3( incidentIor ) ) / ( transmittedIor + vec3( incidentIor ) ) );
	}
	float IorToFresnel0( float transmittedIor, float incidentIor ) {
		return pow2( ( transmittedIor - incidentIor ) / ( transmittedIor + incidentIor ));
	}
	vec3 evalSensitivity( float OPD, vec3 shift ) {
		float phase = 2.0 * PI * OPD * 1.0e-9;
		vec3 val = vec3( 5.4856e-13, 4.4201e-13, 5.2481e-13 );
		vec3 pos = vec3( 1.6810e+06, 1.7953e+06, 2.2084e+06 );
		vec3 var = vec3( 4.3278e+09, 9.3046e+09, 6.6121e+09 );
		vec3 xyz = val * sqrt( 2.0 * PI * var ) * cos( pos * phase + shift ) * exp( - pow2( phase ) * var );
		xyz.x += 9.7470e-14 * sqrt( 2.0 * PI * 4.5282e+09 ) * cos( 2.2399e+06 * phase + shift[ 0 ] ) * exp( - 4.5282e+09 * pow2( phase ) );
		xyz /= 1.0685e-7;
		vec3 rgb = XYZ_TO_REC709 * xyz;
		return rgb;
	}
	vec3 evalIridescence( float outsideIOR, float eta2, float cosTheta1, float thinFilmThickness, vec3 baseF0 ) {
		vec3 I;
		float iridescenceIOR = mix( outsideIOR, eta2, smoothstep( 0.0, 0.03, thinFilmThickness ) );
		float sinTheta2Sq = pow2( outsideIOR / iridescenceIOR ) * ( 1.0 - pow2( cosTheta1 ) );
		float cosTheta2Sq = 1.0 - sinTheta2Sq;
		if ( cosTheta2Sq < 0.0 ) {
			return vec3( 1.0 );
		}
		float cosTheta2 = sqrt( cosTheta2Sq );
		float R0 = IorToFresnel0( iridescenceIOR, outsideIOR );
		float R12 = F_Schlick( R0, 1.0, cosTheta1 );
		float T121 = 1.0 - R12;
		float phi12 = 0.0;
		if ( iridescenceIOR < outsideIOR ) phi12 = PI;
		float phi21 = PI - phi12;
		vec3 baseIOR = Fresnel0ToIor( clamp( baseF0, 0.0, 0.9999 ) );		vec3 R1 = IorToFresnel0( baseIOR, iridescenceIOR );
		vec3 R23 = F_Schlick( R1, 1.0, cosTheta2 );
		vec3 phi23 = vec3( 0.0 );
		if ( baseIOR[ 0 ] < iridescenceIOR ) phi23[ 0 ] = PI;
		if ( baseIOR[ 1 ] < iridescenceIOR ) phi23[ 1 ] = PI;
		if ( baseIOR[ 2 ] < iridescenceIOR ) phi23[ 2 ] = PI;
		float OPD = 2.0 * iridescenceIOR * thinFilmThickness * cosTheta2;
		vec3 phi = vec3( phi21 ) + phi23;
		vec3 R123 = clamp( R12 * R23, 1e-5, 0.9999 );
		vec3 r123 = sqrt( R123 );
		vec3 Rs = pow2( T121 ) * R23 / ( vec3( 1.0 ) - R123 );
		vec3 C0 = R12 + Rs;
		I = C0;
		vec3 Cm = Rs - T121;
		for ( int m = 1; m <= 2; ++ m ) {
			Cm *= r123;
			vec3 Sm = 2.0 * evalSensitivity( float( m ) * OPD, float( m ) * phi );
			I += Cm * Sm;
		}
		return max( I, vec3( 0.0 ) );
	}
#endif`,pg=`#ifdef USE_BUMPMAP
	uniform sampler2D bumpMap;
	uniform float bumpScale;
	vec2 dHdxy_fwd() {
		vec2 dSTdx = dFdx( vBumpMapUv );
		vec2 dSTdy = dFdy( vBumpMapUv );
		float Hll = bumpScale * texture2D( bumpMap, vBumpMapUv ).x;
		float dBx = bumpScale * texture2D( bumpMap, vBumpMapUv + dSTdx ).x - Hll;
		float dBy = bumpScale * texture2D( bumpMap, vBumpMapUv + dSTdy ).x - Hll;
		return vec2( dBx, dBy );
	}
	vec3 perturbNormalArb( vec3 surf_pos, vec3 surf_norm, vec2 dHdxy, float faceDirection ) {
		vec3 vSigmaX = normalize( dFdx( surf_pos.xyz ) );
		vec3 vSigmaY = normalize( dFdy( surf_pos.xyz ) );
		vec3 vN = surf_norm;
		vec3 R1 = cross( vSigmaY, vN );
		vec3 R2 = cross( vN, vSigmaX );
		float fDet = dot( vSigmaX, R1 ) * faceDirection;
		vec3 vGrad = sign( fDet ) * ( dHdxy.x * R1 + dHdxy.y * R2 );
		return normalize( abs( fDet ) * surf_norm - vGrad );
	}
#endif`,mg=`#if NUM_CLIPPING_PLANES > 0
	vec4 plane;
	#ifdef ALPHA_TO_COVERAGE
		float distanceToPlane, distanceGradient;
		float clipOpacity = 1.0;
		#pragma unroll_loop_start
		for ( int i = 0; i < UNION_CLIPPING_PLANES; i ++ ) {
			plane = clippingPlanes[ i ];
			distanceToPlane = - dot( vClipPosition, plane.xyz ) + plane.w;
			distanceGradient = fwidth( distanceToPlane ) / 2.0;
			clipOpacity *= smoothstep( - distanceGradient, distanceGradient, distanceToPlane );
			if ( clipOpacity == 0.0 ) discard;
		}
		#pragma unroll_loop_end
		#if UNION_CLIPPING_PLANES < NUM_CLIPPING_PLANES
			float unionClipOpacity = 1.0;
			#pragma unroll_loop_start
			for ( int i = UNION_CLIPPING_PLANES; i < NUM_CLIPPING_PLANES; i ++ ) {
				plane = clippingPlanes[ i ];
				distanceToPlane = - dot( vClipPosition, plane.xyz ) + plane.w;
				distanceGradient = fwidth( distanceToPlane ) / 2.0;
				unionClipOpacity *= 1.0 - smoothstep( - distanceGradient, distanceGradient, distanceToPlane );
			}
			#pragma unroll_loop_end
			clipOpacity *= 1.0 - unionClipOpacity;
		#endif
		diffuseColor.a *= clipOpacity;
		if ( diffuseColor.a == 0.0 ) discard;
	#else
		#pragma unroll_loop_start
		for ( int i = 0; i < UNION_CLIPPING_PLANES; i ++ ) {
			plane = clippingPlanes[ i ];
			if ( dot( vClipPosition, plane.xyz ) > plane.w ) discard;
		}
		#pragma unroll_loop_end
		#if UNION_CLIPPING_PLANES < NUM_CLIPPING_PLANES
			bool clipped = true;
			#pragma unroll_loop_start
			for ( int i = UNION_CLIPPING_PLANES; i < NUM_CLIPPING_PLANES; i ++ ) {
				plane = clippingPlanes[ i ];
				clipped = ( dot( vClipPosition, plane.xyz ) > plane.w ) && clipped;
			}
			#pragma unroll_loop_end
			if ( clipped ) discard;
		#endif
	#endif
#endif`,gg=`#if NUM_CLIPPING_PLANES > 0
	varying vec3 vClipPosition;
	uniform vec4 clippingPlanes[ NUM_CLIPPING_PLANES ];
#endif`,vg=`#if NUM_CLIPPING_PLANES > 0
	varying vec3 vClipPosition;
#endif`,_g=`#if NUM_CLIPPING_PLANES > 0
	vClipPosition = - mvPosition.xyz;
#endif`,xg=`#if defined( USE_COLOR ) || defined( USE_COLOR_ALPHA )
	diffuseColor *= vColor;
#endif`,Sg=`#if defined( USE_COLOR ) || defined( USE_COLOR_ALPHA )
	varying vec4 vColor;
#endif`,Mg=`#if defined( USE_COLOR ) || defined( USE_COLOR_ALPHA ) || defined( USE_INSTANCING_COLOR ) || defined( USE_BATCHING_COLOR )
	varying vec4 vColor;
#endif`,yg=`#if defined( USE_COLOR ) || defined( USE_COLOR_ALPHA ) || defined( USE_INSTANCING_COLOR ) || defined( USE_BATCHING_COLOR )
	vColor = vec4( 1.0 );
#endif
#ifdef USE_COLOR_ALPHA
	vColor *= color;
#elif defined( USE_COLOR )
	vColor.rgb *= color;
#endif
#ifdef USE_INSTANCING_COLOR
	vColor.rgb *= instanceColor.rgb;
#endif
#ifdef USE_BATCHING_COLOR
	vColor *= getBatchingColor( getIndirectIndex( gl_DrawID ) );
#endif`,bg=`#define PI 3.141592653589793
#define PI2 6.283185307179586
#define PI_HALF 1.5707963267948966
#define RECIPROCAL_PI 0.3183098861837907
#define RECIPROCAL_PI2 0.15915494309189535
#define EPSILON 1e-6
#ifndef saturate
#define saturate( a ) clamp( a, 0.0, 1.0 )
#endif
#define whiteComplement( a ) ( 1.0 - saturate( a ) )
float pow2( const in float x ) { return x*x; }
vec3 pow2( const in vec3 x ) { return x*x; }
float pow3( const in float x ) { return x*x*x; }
float pow4( const in float x ) { float x2 = x*x; return x2*x2; }
float max3( const in vec3 v ) { return max( max( v.x, v.y ), v.z ); }
float average( const in vec3 v ) { return dot( v, vec3( 0.3333333 ) ); }
highp float rand( const in vec2 uv ) {
	const highp float a = 12.9898, b = 78.233, c = 43758.5453;
	highp float dt = dot( uv.xy, vec2( a,b ) ), sn = mod( dt, PI );
	return fract( sin( sn ) * c );
}
#ifdef HIGH_PRECISION
	float precisionSafeLength( vec3 v ) { return length( v ); }
#else
	float precisionSafeLength( vec3 v ) {
		float maxComponent = max3( abs( v ) );
		return length( v / maxComponent ) * maxComponent;
	}
#endif
struct IncidentLight {
	vec3 color;
	vec3 direction;
	bool visible;
};
struct ReflectedLight {
	vec3 directDiffuse;
	vec3 directSpecular;
	vec3 indirectDiffuse;
	vec3 indirectSpecular;
};
#ifdef USE_ALPHAHASH
	varying vec3 vPosition;
#endif
vec3 transformDirection( in vec3 dir, in mat4 matrix ) {
	return normalize( ( matrix * vec4( dir, 0.0 ) ).xyz );
}
#define inverseTransformDirection transformDirectionByInverseViewMatrix
vec3 transformNormalByInverseViewMatrix( in vec3 normal, in mat4 viewMatrix ) {
	return normalize( ( vec4( normal, 0.0 ) * viewMatrix ).xyz );
}
vec3 transformDirectionByInverseViewMatrix( in vec3 dir, in mat4 viewMatrix ) {
	return normalize( ( vec4( dir, 0.0 ) * viewMatrix ).xyz );
}
bool isPerspectiveMatrix( mat4 m ) {
	return m[ 2 ][ 3 ] == - 1.0;
}
vec2 equirectUv( in vec3 dir ) {
	float u = atan( dir.z, dir.x ) * RECIPROCAL_PI2 + 0.5;
	float v = asin( clamp( dir.y, - 1.0, 1.0 ) ) * RECIPROCAL_PI + 0.5;
	return vec2( u, v );
}
vec3 BRDF_Lambert( const in vec3 diffuseColor ) {
	return RECIPROCAL_PI * diffuseColor;
}
vec3 F_Schlick( const in vec3 f0, const in float f90, const in float dotVH ) {
	float fresnel = exp2( ( - 5.55473 * dotVH - 6.98316 ) * dotVH );
	return f0 * ( 1.0 - fresnel ) + ( f90 * fresnel );
}
float F_Schlick( const in float f0, const in float f90, const in float dotVH ) {
	float fresnel = exp2( ( - 5.55473 * dotVH - 6.98316 ) * dotVH );
	return f0 * ( 1.0 - fresnel ) + ( f90 * fresnel );
} // validated`,Eg=`#ifdef ENVMAP_TYPE_CUBE_UV
	#define cubeUV_minMipLevel 4.0
	#define cubeUV_minTileSize 16.0
	float getFace( vec3 direction ) {
		vec3 absDirection = abs( direction );
		float face = - 1.0;
		if ( absDirection.x > absDirection.z ) {
			if ( absDirection.x > absDirection.y )
				face = direction.x > 0.0 ? 0.0 : 3.0;
			else
				face = direction.y > 0.0 ? 1.0 : 4.0;
		} else {
			if ( absDirection.z > absDirection.y )
				face = direction.z > 0.0 ? 2.0 : 5.0;
			else
				face = direction.y > 0.0 ? 1.0 : 4.0;
		}
		return face;
	}
	vec2 getUV( vec3 direction, float face ) {
		vec2 uv;
		if ( face == 0.0 ) {
			uv = vec2( direction.z, direction.y ) / abs( direction.x );
		} else if ( face == 1.0 ) {
			uv = vec2( - direction.x, - direction.z ) / abs( direction.y );
		} else if ( face == 2.0 ) {
			uv = vec2( - direction.x, direction.y ) / abs( direction.z );
		} else if ( face == 3.0 ) {
			uv = vec2( - direction.z, direction.y ) / abs( direction.x );
		} else if ( face == 4.0 ) {
			uv = vec2( - direction.x, direction.z ) / abs( direction.y );
		} else {
			uv = vec2( direction.x, direction.y ) / abs( direction.z );
		}
		return 0.5 * ( uv + 1.0 );
	}
	vec3 bilinearCubeUV( sampler2D envMap, vec3 direction, float mipInt ) {
		float face = getFace( direction );
		float filterInt = max( cubeUV_minMipLevel - mipInt, 0.0 );
		mipInt = max( mipInt, cubeUV_minMipLevel );
		float faceSize = exp2( mipInt );
		highp vec2 uv = getUV( direction, face ) * ( faceSize - 2.0 ) + 1.0;
		if ( face > 2.0 ) {
			uv.y += faceSize;
			face -= 3.0;
		}
		uv.x += face * faceSize;
		uv.x += filterInt * 3.0 * cubeUV_minTileSize;
		uv.y += 4.0 * ( exp2( CUBEUV_MAX_MIP ) - faceSize );
		uv.x *= CUBEUV_TEXEL_WIDTH;
		uv.y *= CUBEUV_TEXEL_HEIGHT;
		#ifdef texture2DGradEXT
			return texture2DGradEXT( envMap, uv, vec2( 0.0 ), vec2( 0.0 ) ).rgb;
		#else
			return texture2D( envMap, uv ).rgb;
		#endif
	}
	#define cubeUV_r0 1.0
	#define cubeUV_m0 - 2.0
	#define cubeUV_r1 0.8
	#define cubeUV_m1 - 1.0
	#define cubeUV_r4 0.4
	#define cubeUV_m4 2.0
	#define cubeUV_r5 0.305
	#define cubeUV_m5 3.0
	#define cubeUV_r6 0.21
	#define cubeUV_m6 4.0
	float roughnessToMip( float roughness ) {
		float mip = 0.0;
		if ( roughness >= cubeUV_r1 ) {
			mip = ( cubeUV_r0 - roughness ) * ( cubeUV_m1 - cubeUV_m0 ) / ( cubeUV_r0 - cubeUV_r1 ) + cubeUV_m0;
		} else if ( roughness >= cubeUV_r4 ) {
			mip = ( cubeUV_r1 - roughness ) * ( cubeUV_m4 - cubeUV_m1 ) / ( cubeUV_r1 - cubeUV_r4 ) + cubeUV_m1;
		} else if ( roughness >= cubeUV_r5 ) {
			mip = ( cubeUV_r4 - roughness ) * ( cubeUV_m5 - cubeUV_m4 ) / ( cubeUV_r4 - cubeUV_r5 ) + cubeUV_m4;
		} else if ( roughness >= cubeUV_r6 ) {
			mip = ( cubeUV_r5 - roughness ) * ( cubeUV_m6 - cubeUV_m5 ) / ( cubeUV_r5 - cubeUV_r6 ) + cubeUV_m5;
		} else {
			mip = - 2.0 * log2( 1.16 * roughness );		}
		return mip;
	}
	vec4 textureCubeUV( sampler2D envMap, vec3 sampleDir, float roughness ) {
		float mip = clamp( roughnessToMip( roughness ), cubeUV_m0, CUBEUV_MAX_MIP );
		float mipF = fract( mip );
		float mipInt = floor( mip );
		vec3 color0 = bilinearCubeUV( envMap, sampleDir, mipInt );
		if ( mipF == 0.0 ) {
			return vec4( color0, 1.0 );
		} else {
			vec3 color1 = bilinearCubeUV( envMap, sampleDir, mipInt + 1.0 );
			return vec4( mix( color0, color1, mipF ), 1.0 );
		}
	}
#endif`,Tg=`vec3 transformedNormal = objectNormal;
#ifdef USE_TANGENT
	vec3 transformedTangent = objectTangent;
#endif
#ifdef USE_BATCHING
	mat3 bm = mat3( batchingMatrix );
	transformedNormal /= vec3( dot( bm[ 0 ], bm[ 0 ] ), dot( bm[ 1 ], bm[ 1 ] ), dot( bm[ 2 ], bm[ 2 ] ) );
	transformedNormal = bm * transformedNormal;
	#ifdef USE_TANGENT
		transformedTangent = bm * transformedTangent;
	#endif
#endif
#ifdef USE_INSTANCING
	mat3 im = mat3( instanceMatrix );
	transformedNormal /= vec3( dot( im[ 0 ], im[ 0 ] ), dot( im[ 1 ], im[ 1 ] ), dot( im[ 2 ], im[ 2 ] ) );
	transformedNormal = im * transformedNormal;
	#ifdef USE_TANGENT
		transformedTangent = im * transformedTangent;
	#endif
#endif
transformedNormal = normalMatrix * transformedNormal;
#ifdef FLIP_SIDED
	transformedNormal = - transformedNormal;
#endif
#ifdef USE_TANGENT
	transformedTangent = ( modelViewMatrix * vec4( transformedTangent, 0.0 ) ).xyz;
#endif`,Ag=`#ifdef USE_DISPLACEMENTMAP
	uniform sampler2D displacementMap;
	uniform float displacementScale;
	uniform float displacementBias;
#endif`,wg=`#ifdef USE_DISPLACEMENTMAP
	transformed += normalize( objectNormal ) * ( texture2D( displacementMap, vDisplacementMapUv ).x * displacementScale + displacementBias );
#endif`,Cg=`#ifdef USE_EMISSIVEMAP
	vec4 emissiveColor = texture2D( emissiveMap, vEmissiveMapUv );
	#ifdef DECODE_VIDEO_TEXTURE_EMISSIVE
		emissiveColor = sRGBTransferEOTF( emissiveColor );
	#endif
	totalEmissiveRadiance *= emissiveColor.rgb;
#endif`,Rg=`#ifdef USE_EMISSIVEMAP
	uniform sampler2D emissiveMap;
#endif`,Pg="gl_FragColor = linearToOutputTexel( gl_FragColor );",Ig=`vec4 LinearTransferOETF( in vec4 value ) {
	return value;
}
vec4 sRGBTransferEOTF( in vec4 value ) {
	return vec4( mix( pow( value.rgb * 0.9478672986 + vec3( 0.0521327014 ), vec3( 2.4 ) ), value.rgb * 0.0773993808, vec3( lessThanEqual( value.rgb, vec3( 0.04045 ) ) ) ), value.a );
}
vec4 sRGBTransferOETF( in vec4 value ) {
	return vec4( mix( pow( value.rgb, vec3( 0.41666 ) ) * 1.055 - vec3( 0.055 ), value.rgb * 12.92, vec3( lessThanEqual( value.rgb, vec3( 0.0031308 ) ) ) ), value.a );
}`,Lg=`#ifdef USE_ENVMAP
	#ifdef ENV_WORLDPOS
		vec3 cameraToFrag;
		if ( isOrthographic ) {
			cameraToFrag = normalize( vec3( - viewMatrix[ 0 ][ 2 ], - viewMatrix[ 1 ][ 2 ], - viewMatrix[ 2 ][ 2 ] ) );
		} else {
			cameraToFrag = normalize( vWorldPosition - cameraPosition );
		}
		vec3 worldNormal = transformNormalByInverseViewMatrix( normal, viewMatrix );
		#ifdef ENVMAP_MODE_REFLECTION
			vec3 reflectVec = reflect( cameraToFrag, worldNormal );
		#else
			vec3 reflectVec = refract( cameraToFrag, worldNormal, refractionRatio );
		#endif
	#else
		vec3 reflectVec = vReflect;
	#endif
	#ifdef ENVMAP_TYPE_CUBE
		vec4 envColor = textureCube( envMap, envMapRotation * reflectVec );
		#ifdef ENVMAP_BLENDING_MULTIPLY
			outgoingLight = mix( outgoingLight, outgoingLight * envColor.xyz, specularStrength * reflectivity );
		#elif defined( ENVMAP_BLENDING_MIX )
			outgoingLight = mix( outgoingLight, envColor.xyz, specularStrength * reflectivity );
		#elif defined( ENVMAP_BLENDING_ADD )
			outgoingLight += envColor.xyz * specularStrength * reflectivity;
		#endif
	#endif
#endif`,Dg=`#ifdef USE_ENVMAP
	uniform float envMapIntensity;
	uniform mat3 envMapRotation;
	#ifdef ENVMAP_TYPE_CUBE
		uniform samplerCube envMap;
	#else
		uniform sampler2D envMap;
	#endif
#endif`,Ng=`#ifdef USE_ENVMAP
	uniform float reflectivity;
	#if defined( USE_BUMPMAP ) || defined( USE_NORMALMAP ) || defined( PHONG ) || defined( LAMBERT )
		#define ENV_WORLDPOS
	#endif
	#ifdef ENV_WORLDPOS
		varying vec3 vWorldPosition;
		uniform float refractionRatio;
	#else
		varying vec3 vReflect;
	#endif
#endif`,Ug=`#ifdef USE_ENVMAP
	#if defined( USE_BUMPMAP ) || defined( USE_NORMALMAP ) || defined( PHONG ) || defined( LAMBERT )
		#define ENV_WORLDPOS
	#endif
	#ifdef ENV_WORLDPOS
		
		varying vec3 vWorldPosition;
	#else
		varying vec3 vReflect;
		uniform float refractionRatio;
	#endif
#endif`,Fg=`#ifdef USE_ENVMAP
	#ifdef ENV_WORLDPOS
		vWorldPosition = worldPosition.xyz;
	#else
		vec3 cameraToVertex;
		if ( isOrthographic ) {
			cameraToVertex = normalize( vec3( - viewMatrix[ 0 ][ 2 ], - viewMatrix[ 1 ][ 2 ], - viewMatrix[ 2 ][ 2 ] ) );
		} else {
			cameraToVertex = normalize( worldPosition.xyz - cameraPosition );
		}
		vec3 worldNormal = transformNormalByInverseViewMatrix( transformedNormal, viewMatrix );
		#ifdef ENVMAP_MODE_REFLECTION
			vReflect = reflect( cameraToVertex, worldNormal );
		#else
			vReflect = refract( cameraToVertex, worldNormal, refractionRatio );
		#endif
	#endif
#endif`,Og=`#ifdef USE_FOG
	vFogDepth = - mvPosition.z;
#endif`,Bg=`#ifdef USE_FOG
	varying float vFogDepth;
#endif`,kg=`#ifdef USE_FOG
	#ifdef FOG_EXP2
		float fogFactor = 1.0 - exp( - fogDensity * fogDensity * vFogDepth * vFogDepth );
	#else
		float fogFactor = smoothstep( fogNear, fogFar, vFogDepth );
	#endif
	gl_FragColor.rgb = mix( gl_FragColor.rgb, fogColor, fogFactor );
#endif`,Gg=`#ifdef USE_FOG
	uniform vec3 fogColor;
	varying float vFogDepth;
	#ifdef FOG_EXP2
		uniform float fogDensity;
	#else
		uniform float fogNear;
		uniform float fogFar;
	#endif
#endif`,zg=`#ifdef USE_GRADIENTMAP
	uniform sampler2D gradientMap;
#endif
vec3 getGradientIrradiance( vec3 normal, vec3 lightDirection ) {
	float dotNL = dot( normal, lightDirection );
	vec2 coord = vec2( dotNL * 0.5 + 0.5, 0.0 );
	#ifdef USE_GRADIENTMAP
		return vec3( texture2D( gradientMap, coord ).r );
	#else
		vec2 fw = fwidth( coord ) * 0.5;
		return mix( vec3( 0.7 ), vec3( 1.0 ), smoothstep( 0.7 - fw.x, 0.7 + fw.x, coord.x ) );
	#endif
}`,Hg=`#ifdef USE_LIGHTMAP
	uniform sampler2D lightMap;
	uniform float lightMapIntensity;
#endif`,Vg=`LambertMaterial material;
material.diffuseColor = diffuseColor.rgb;
material.specularStrength = specularStrength;`,Wg=`varying vec3 vViewPosition;
struct LambertMaterial {
	vec3 diffuseColor;
	float specularStrength;
};
void RE_Direct_Lambert( const in IncidentLight directLight, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in LambertMaterial material, inout ReflectedLight reflectedLight ) {
	float dotNL = saturate( dot( geometryNormal, directLight.direction ) );
	vec3 irradiance = dotNL * directLight.color;
	reflectedLight.directDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
}
void RE_IndirectDiffuse_Lambert( const in vec3 irradiance, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in LambertMaterial material, inout ReflectedLight reflectedLight ) {
	reflectedLight.indirectDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
}
#define RE_Direct				RE_Direct_Lambert
#define RE_IndirectDiffuse		RE_IndirectDiffuse_Lambert`,Xg=`uniform bool receiveShadow;
uniform vec3 ambientLightColor;
#if defined( USE_LIGHT_PROBES )
	uniform vec3 lightProbe[ 9 ];
#endif
vec3 shGetIrradianceAt( in vec3 normal, in vec3 shCoefficients[ 9 ] ) {
	float x = normal.x, y = normal.y, z = normal.z;
	vec3 result = shCoefficients[ 0 ] * 0.886227;
	result += shCoefficients[ 1 ] * 2.0 * 0.511664 * y;
	result += shCoefficients[ 2 ] * 2.0 * 0.511664 * z;
	result += shCoefficients[ 3 ] * 2.0 * 0.511664 * x;
	result += shCoefficients[ 4 ] * 2.0 * 0.429043 * x * y;
	result += shCoefficients[ 5 ] * 2.0 * 0.429043 * y * z;
	result += shCoefficients[ 6 ] * ( 0.743125 * z * z - 0.247708 );
	result += shCoefficients[ 7 ] * 2.0 * 0.429043 * x * z;
	result += shCoefficients[ 8 ] * 0.429043 * ( x * x - y * y );
	return result;
}
vec3 getLightProbeIrradiance( const in vec3 lightProbe[ 9 ], const in vec3 normal ) {
	vec3 worldNormal = transformNormalByInverseViewMatrix( normal, viewMatrix );
	vec3 irradiance = shGetIrradianceAt( worldNormal, lightProbe );
	return irradiance;
}
vec3 getAmbientLightIrradiance( const in vec3 ambientLightColor ) {
	vec3 irradiance = ambientLightColor;
	return irradiance;
}
float getDistanceAttenuation( const in float lightDistance, const in float cutoffDistance, const in float decayExponent ) {
	float distanceFalloff = 1.0 / max( pow( lightDistance, decayExponent ), 0.01 );
	if ( cutoffDistance > 0.0 ) {
		distanceFalloff *= pow2( saturate( 1.0 - pow4( lightDistance / cutoffDistance ) ) );
	}
	return distanceFalloff;
}
float getSpotAttenuation( const in float coneCosine, const in float penumbraCosine, const in float angleCosine ) {
	return smoothstep( coneCosine, penumbraCosine, angleCosine );
}
#if NUM_DIR_LIGHTS > 0
	struct DirectionalLight {
		vec3 direction;
		vec3 color;
	};
	uniform DirectionalLight directionalLights[ NUM_DIR_LIGHTS ];
	void getDirectionalLightInfo( const in DirectionalLight directionalLight, out IncidentLight light ) {
		light.color = directionalLight.color;
		light.direction = directionalLight.direction;
		light.visible = true;
	}
#endif
#if NUM_POINT_LIGHTS > 0
	struct PointLight {
		vec3 position;
		vec3 color;
		float distance;
		float decay;
	};
	uniform PointLight pointLights[ NUM_POINT_LIGHTS ];
	void getPointLightInfo( const in PointLight pointLight, const in vec3 geometryPosition, out IncidentLight light ) {
		vec3 lVector = pointLight.position - geometryPosition;
		light.direction = normalize( lVector );
		float lightDistance = length( lVector );
		light.color = pointLight.color;
		light.color *= getDistanceAttenuation( lightDistance, pointLight.distance, pointLight.decay );
		light.visible = ( light.color != vec3( 0.0 ) );
	}
#endif
#if NUM_SPOT_LIGHTS > 0
	struct SpotLight {
		vec3 position;
		vec3 direction;
		vec3 color;
		float distance;
		float decay;
		float coneCos;
		float penumbraCos;
	};
	uniform SpotLight spotLights[ NUM_SPOT_LIGHTS ];
	void getSpotLightInfo( const in SpotLight spotLight, const in vec3 geometryPosition, out IncidentLight light ) {
		vec3 lVector = spotLight.position - geometryPosition;
		light.direction = normalize( lVector );
		float angleCos = dot( light.direction, spotLight.direction );
		float spotAttenuation = getSpotAttenuation( spotLight.coneCos, spotLight.penumbraCos, angleCos );
		if ( spotAttenuation > 0.0 ) {
			float lightDistance = length( lVector );
			light.color = spotLight.color * spotAttenuation;
			light.color *= getDistanceAttenuation( lightDistance, spotLight.distance, spotLight.decay );
			light.visible = ( light.color != vec3( 0.0 ) );
		} else {
			light.color = vec3( 0.0 );
			light.visible = false;
		}
	}
#endif
#if NUM_RECT_AREA_LIGHTS > 0
	struct RectAreaLight {
		vec3 color;
		vec3 position;
		vec3 halfWidth;
		vec3 halfHeight;
	};
	uniform sampler2D ltc_1;	uniform sampler2D ltc_2;
	uniform RectAreaLight rectAreaLights[ NUM_RECT_AREA_LIGHTS ];
#endif
#if NUM_HEMI_LIGHTS > 0
	struct HemisphereLight {
		vec3 direction;
		vec3 skyColor;
		vec3 groundColor;
	};
	uniform HemisphereLight hemisphereLights[ NUM_HEMI_LIGHTS ];
	vec3 getHemisphereLightIrradiance( const in HemisphereLight hemiLight, const in vec3 normal ) {
		float dotNL = dot( normal, hemiLight.direction );
		float hemiDiffuseWeight = 0.5 * dotNL + 0.5;
		vec3 irradiance = mix( hemiLight.groundColor, hemiLight.skyColor, hemiDiffuseWeight );
		return irradiance;
	}
#endif
#include <lightprobes_pars_fragment>`,Yg=`#ifdef USE_ENVMAP
	vec3 getIBLIrradiance( const in vec3 normal ) {
		#ifdef ENVMAP_TYPE_CUBE_UV
			vec3 worldNormal = transformNormalByInverseViewMatrix( normal, viewMatrix );
			vec4 envMapColor = textureCubeUV( envMap, envMapRotation * worldNormal, 1.0 );
			return PI * envMapColor.rgb * envMapIntensity;
		#else
			return vec3( 0.0 );
		#endif
	}
	vec3 getIBLRadiance( const in vec3 viewDir, const in vec3 normal, const in float roughness ) {
		#ifdef ENVMAP_TYPE_CUBE_UV
			vec3 reflectVec = reflect( - viewDir, normal );
			reflectVec = normalize( mix( reflectVec, normal, pow4( roughness ) ) );
			reflectVec = transformDirectionByInverseViewMatrix( reflectVec, viewMatrix );
			vec4 envMapColor = textureCubeUV( envMap, envMapRotation * reflectVec, roughness );
			return envMapColor.rgb * envMapIntensity;
		#else
			return vec3( 0.0 );
		#endif
	}
	#ifdef USE_ANISOTROPY
		vec3 getIBLAnisotropyRadiance( const in vec3 viewDir, const in vec3 normal, const in float roughness, const in vec3 bitangent, const in float anisotropy ) {
			#ifdef ENVMAP_TYPE_CUBE_UV
				vec3 bentNormal = cross( bitangent, viewDir );
				bentNormal = normalize( cross( bentNormal, bitangent ) );
				bentNormal = normalize( mix( bentNormal, normal, pow2( pow2( 1.0 - anisotropy * ( 1.0 - roughness ) ) ) ) );
				return getIBLRadiance( viewDir, bentNormal, roughness );
			#else
				return vec3( 0.0 );
			#endif
		}
	#endif
#endif`,qg=`ToonMaterial material;
material.diffuseColor = diffuseColor.rgb;`,Kg=`varying vec3 vViewPosition;
struct ToonMaterial {
	vec3 diffuseColor;
};
void RE_Direct_Toon( const in IncidentLight directLight, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in ToonMaterial material, inout ReflectedLight reflectedLight ) {
	vec3 irradiance = getGradientIrradiance( geometryNormal, directLight.direction ) * directLight.color;
	reflectedLight.directDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
}
void RE_IndirectDiffuse_Toon( const in vec3 irradiance, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in ToonMaterial material, inout ReflectedLight reflectedLight ) {
	reflectedLight.indirectDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
}
#define RE_Direct				RE_Direct_Toon
#define RE_IndirectDiffuse		RE_IndirectDiffuse_Toon`,$g=`BlinnPhongMaterial material;
material.diffuseColor = diffuseColor.rgb;
material.specularColor = specular;
material.specularShininess = shininess;
material.specularStrength = specularStrength;`,Zg=`varying vec3 vViewPosition;
struct BlinnPhongMaterial {
	vec3 diffuseColor;
	vec3 specularColor;
	float specularShininess;
	float specularStrength;
};
void RE_Direct_BlinnPhong( const in IncidentLight directLight, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in BlinnPhongMaterial material, inout ReflectedLight reflectedLight ) {
	float dotNL = saturate( dot( geometryNormal, directLight.direction ) );
	vec3 irradiance = dotNL * directLight.color;
	reflectedLight.directDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
	reflectedLight.directSpecular += irradiance * BRDF_BlinnPhong( directLight.direction, geometryViewDir, geometryNormal, material.specularColor, material.specularShininess ) * material.specularStrength;
}
void RE_IndirectDiffuse_BlinnPhong( const in vec3 irradiance, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in BlinnPhongMaterial material, inout ReflectedLight reflectedLight ) {
	reflectedLight.indirectDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
}
#define RE_Direct				RE_Direct_BlinnPhong
#define RE_IndirectDiffuse		RE_IndirectDiffuse_BlinnPhong`,Jg=`PhysicalMaterial material;
material.diffuseColor = diffuseColor.rgb;
material.diffuseContribution = diffuseColor.rgb * ( 1.0 - metalnessFactor );
material.metalness = metalnessFactor;
vec3 dxy = max( abs( dFdx( nonPerturbedNormal ) ), abs( dFdy( nonPerturbedNormal ) ) );
float geometryRoughness = max( max( dxy.x, dxy.y ), dxy.z );
material.roughness = max( roughnessFactor, 0.0525 );material.roughness += geometryRoughness;
material.roughness = min( material.roughness, 1.0 );
#ifdef IOR
	material.ior = ior;
	#ifdef USE_SPECULAR
		float specularIntensityFactor = specularIntensity;
		vec3 specularColorFactor = specularColor;
		#ifdef USE_SPECULAR_COLORMAP
			specularColorFactor *= texture2D( specularColorMap, vSpecularColorMapUv ).rgb;
		#endif
		#ifdef USE_SPECULAR_INTENSITYMAP
			specularIntensityFactor *= texture2D( specularIntensityMap, vSpecularIntensityMapUv ).a;
		#endif
		material.specularF90 = mix( specularIntensityFactor, 1.0, metalnessFactor );
	#else
		float specularIntensityFactor = 1.0;
		vec3 specularColorFactor = vec3( 1.0 );
		material.specularF90 = 1.0;
	#endif
	material.specularColor = min( pow2( ( material.ior - 1.0 ) / ( material.ior + 1.0 ) ) * specularColorFactor, vec3( 1.0 ) ) * specularIntensityFactor;
	material.specularColorBlended = mix( material.specularColor, diffuseColor.rgb, metalnessFactor );
#else
	material.specularColor = vec3( 0.04 );
	material.specularColorBlended = mix( material.specularColor, diffuseColor.rgb, metalnessFactor );
	material.specularF90 = 1.0;
#endif
#ifdef USE_CLEARCOAT
	material.clearcoat = clearcoat;
	material.clearcoatRoughness = clearcoatRoughness;
	material.clearcoatF0 = vec3( 0.04 );
	material.clearcoatF90 = 1.0;
	#ifdef USE_CLEARCOATMAP
		material.clearcoat *= texture2D( clearcoatMap, vClearcoatMapUv ).x;
	#endif
	#ifdef USE_CLEARCOAT_ROUGHNESSMAP
		material.clearcoatRoughness *= texture2D( clearcoatRoughnessMap, vClearcoatRoughnessMapUv ).y;
	#endif
	material.clearcoat = saturate( material.clearcoat );	material.clearcoatRoughness = max( material.clearcoatRoughness, 0.0525 );
	material.clearcoatRoughness += geometryRoughness;
	material.clearcoatRoughness = min( material.clearcoatRoughness, 1.0 );
#endif
#ifdef USE_DISPERSION
	material.dispersion = dispersion;
#endif
#ifdef USE_IRIDESCENCE
	material.iridescence = iridescence;
	material.iridescenceIOR = iridescenceIOR;
	#ifdef USE_IRIDESCENCEMAP
		material.iridescence *= texture2D( iridescenceMap, vIridescenceMapUv ).r;
	#endif
	#ifdef USE_IRIDESCENCE_THICKNESSMAP
		material.iridescenceThickness = (iridescenceThicknessMaximum - iridescenceThicknessMinimum) * texture2D( iridescenceThicknessMap, vIridescenceThicknessMapUv ).g + iridescenceThicknessMinimum;
	#else
		material.iridescenceThickness = iridescenceThicknessMaximum;
	#endif
#endif
#ifdef USE_SHEEN
	material.sheenColor = sheenColor;
	#ifdef USE_SHEEN_COLORMAP
		material.sheenColor *= texture2D( sheenColorMap, vSheenColorMapUv ).rgb;
	#endif
	material.sheenRoughness = clamp( sheenRoughness, 0.0001, 1.0 );
	#ifdef USE_SHEEN_ROUGHNESSMAP
		material.sheenRoughness *= texture2D( sheenRoughnessMap, vSheenRoughnessMapUv ).a;
	#endif
#endif
#ifdef USE_ANISOTROPY
	#ifdef USE_ANISOTROPYMAP
		mat2 anisotropyMat = mat2( anisotropyVector.x, anisotropyVector.y, - anisotropyVector.y, anisotropyVector.x );
		vec3 anisotropyPolar = texture2D( anisotropyMap, vAnisotropyMapUv ).rgb;
		vec2 anisotropyV = anisotropyMat * normalize( 2.0 * anisotropyPolar.rg - vec2( 1.0 ) ) * anisotropyPolar.b;
	#else
		vec2 anisotropyV = anisotropyVector;
	#endif
	material.anisotropy = length( anisotropyV );
	if( material.anisotropy == 0.0 ) {
		anisotropyV = vec2( 1.0, 0.0 );
	} else {
		anisotropyV /= material.anisotropy;
		material.anisotropy = saturate( material.anisotropy );
	}
	material.alphaT = mix( pow2( material.roughness ), 1.0, pow2( material.anisotropy ) );
	material.anisotropyT = tbn[ 0 ] * anisotropyV.x + tbn[ 1 ] * anisotropyV.y;
	material.anisotropyB = tbn[ 1 ] * anisotropyV.x - tbn[ 0 ] * anisotropyV.y;
#endif`,Qg=`uniform sampler2D dfgLUT;
struct PhysicalMaterial {
	vec3 diffuseColor;
	vec3 diffuseContribution;
	vec3 specularColor;
	vec3 specularColorBlended;
	float roughness;
	float metalness;
	float specularF90;
	float dispersion;
	#ifdef USE_CLEARCOAT
		float clearcoat;
		float clearcoatRoughness;
		vec3 clearcoatF0;
		float clearcoatF90;
	#endif
	#ifdef USE_IRIDESCENCE
		float iridescence;
		float iridescenceIOR;
		float iridescenceThickness;
		vec3 iridescenceFresnel;
		vec3 iridescenceF0;
		vec3 iridescenceFresnelDielectric;
		vec3 iridescenceFresnelMetallic;
	#endif
	#ifdef USE_SHEEN
		vec3 sheenColor;
		float sheenRoughness;
	#endif
	#ifdef IOR
		float ior;
	#endif
	#ifdef USE_TRANSMISSION
		float transmission;
		float transmissionAlpha;
		float thickness;
		float attenuationDistance;
		vec3 attenuationColor;
	#endif
	#ifdef USE_ANISOTROPY
		float anisotropy;
		float alphaT;
		vec3 anisotropyT;
		vec3 anisotropyB;
	#endif
};
vec3 clearcoatSpecularDirect = vec3( 0.0 );
vec3 clearcoatSpecularIndirect = vec3( 0.0 );
vec3 sheenSpecularDirect = vec3( 0.0 );
vec3 sheenSpecularIndirect = vec3(0.0 );
vec3 Schlick_to_F0( const in vec3 f, const in float f90, const in float dotVH ) {
    float x = clamp( 1.0 - dotVH, 0.0, 1.0 );
    float x2 = x * x;
    float x5 = clamp( x * x2 * x2, 0.0, 0.9999 );
    return ( f - vec3( f90 ) * x5 ) / ( 1.0 - x5 );
}
float V_GGX_SmithCorrelated( const in float alpha, const in float dotNL, const in float dotNV ) {
	float a2 = pow2( alpha );
	float gv = dotNL * sqrt( a2 + ( 1.0 - a2 ) * pow2( dotNV ) );
	float gl = dotNV * sqrt( a2 + ( 1.0 - a2 ) * pow2( dotNL ) );
	return 0.5 / max( gv + gl, EPSILON );
}
float D_GGX( const in float alpha, const in float dotNH ) {
	float a2 = pow2( alpha );
	float denom = pow2( dotNH ) * ( a2 - 1.0 ) + 1.0;
	return RECIPROCAL_PI * a2 / pow2( denom );
}
#ifdef USE_ANISOTROPY
	float V_GGX_SmithCorrelated_Anisotropic( const in float alphaT, const in float alphaB, const in float dotTV, const in float dotBV, const in float dotTL, const in float dotBL, const in float dotNV, const in float dotNL ) {
		float gv = dotNL * length( vec3( alphaT * dotTV, alphaB * dotBV, dotNV ) );
		float gl = dotNV * length( vec3( alphaT * dotTL, alphaB * dotBL, dotNL ) );
		return 0.5 / max( gv + gl, EPSILON );
	}
	float D_GGX_Anisotropic( const in float alphaT, const in float alphaB, const in float dotNH, const in float dotTH, const in float dotBH ) {
		float a2 = alphaT * alphaB;
		highp vec3 v = vec3( alphaB * dotTH, alphaT * dotBH, a2 * dotNH );
		highp float v2 = dot( v, v );
		float w2 = a2 / v2;
		return RECIPROCAL_PI * a2 * pow2 ( w2 );
	}
#endif
#ifdef USE_CLEARCOAT
	vec3 BRDF_GGX_Clearcoat( const in vec3 lightDir, const in vec3 viewDir, const in vec3 normal, const in PhysicalMaterial material) {
		vec3 f0 = material.clearcoatF0;
		float f90 = material.clearcoatF90;
		float roughness = material.clearcoatRoughness;
		float alpha = pow2( roughness );
		vec3 halfDir = normalize( lightDir + viewDir );
		float dotNL = saturate( dot( normal, lightDir ) );
		float dotNV = saturate( dot( normal, viewDir ) );
		float dotNH = saturate( dot( normal, halfDir ) );
		float dotVH = saturate( dot( viewDir, halfDir ) );
		vec3 F = F_Schlick( f0, f90, dotVH );
		float V = V_GGX_SmithCorrelated( alpha, dotNL, dotNV );
		float D = D_GGX( alpha, dotNH );
		return F * ( V * D );
	}
#endif
vec3 BRDF_GGX( const in vec3 lightDir, const in vec3 viewDir, const in vec3 normal, const in PhysicalMaterial material ) {
	vec3 f0 = material.specularColorBlended;
	float f90 = material.specularF90;
	float roughness = material.roughness;
	float alpha = pow2( roughness );
	vec3 halfDir = normalize( lightDir + viewDir );
	float dotNL = saturate( dot( normal, lightDir ) );
	float dotNV = saturate( dot( normal, viewDir ) );
	float dotNH = saturate( dot( normal, halfDir ) );
	float dotVH = saturate( dot( viewDir, halfDir ) );
	vec3 F = F_Schlick( f0, f90, dotVH );
	#ifdef USE_IRIDESCENCE
		F = mix( F, material.iridescenceFresnel, material.iridescence );
	#endif
	#ifdef USE_ANISOTROPY
		float dotTL = dot( material.anisotropyT, lightDir );
		float dotTV = dot( material.anisotropyT, viewDir );
		float dotTH = dot( material.anisotropyT, halfDir );
		float dotBL = dot( material.anisotropyB, lightDir );
		float dotBV = dot( material.anisotropyB, viewDir );
		float dotBH = dot( material.anisotropyB, halfDir );
		float V = V_GGX_SmithCorrelated_Anisotropic( material.alphaT, alpha, dotTV, dotBV, dotTL, dotBL, dotNV, dotNL );
		float D = D_GGX_Anisotropic( material.alphaT, alpha, dotNH, dotTH, dotBH );
	#else
		float V = V_GGX_SmithCorrelated( alpha, dotNL, dotNV );
		float D = D_GGX( alpha, dotNH );
	#endif
	return F * ( V * D );
}
vec2 LTC_Uv( const in vec3 N, const in vec3 V, const in float roughness ) {
	const float LUT_SIZE = 64.0;
	const float LUT_SCALE = ( LUT_SIZE - 1.0 ) / LUT_SIZE;
	const float LUT_BIAS = 0.5 / LUT_SIZE;
	float dotNV = saturate( dot( N, V ) );
	vec2 uv = vec2( roughness, sqrt( 1.0 - dotNV ) );
	uv = uv * LUT_SCALE + LUT_BIAS;
	return uv;
}
float LTC_ClippedSphereFormFactor( const in vec3 f ) {
	float l = length( f );
	return max( ( l * l + f.z ) / ( l + 1.0 ), 0.0 );
}
vec3 LTC_EdgeVectorFormFactor( const in vec3 v1, const in vec3 v2 ) {
	float x = dot( v1, v2 );
	float y = abs( x );
	float a = 0.8543985 + ( 0.4965155 + 0.0145206 * y ) * y;
	float b = 3.4175940 + ( 4.1616724 + y ) * y;
	float v = a / b;
	float theta_sintheta = ( x > 0.0 ) ? v : 0.5 * inversesqrt( max( 1.0 - x * x, 1e-7 ) ) - v;
	return cross( v1, v2 ) * theta_sintheta;
}
vec3 LTC_Evaluate( const in vec3 N, const in vec3 V, const in vec3 P, const in mat3 mInv, const in vec3 rectCoords[ 4 ] ) {
	vec3 v1 = rectCoords[ 1 ] - rectCoords[ 0 ];
	vec3 v2 = rectCoords[ 3 ] - rectCoords[ 0 ];
	vec3 lightNormal = cross( v1, v2 );
	if( dot( lightNormal, P - rectCoords[ 0 ] ) < 0.0 ) return vec3( 0.0 );
	vec3 T1, T2;
	T1 = normalize( V - N * dot( V, N ) );
	T2 = - cross( N, T1 );
	mat3 mat = mInv * transpose( mat3( T1, T2, N ) );
	vec3 coords[ 4 ];
	coords[ 0 ] = mat * ( rectCoords[ 0 ] - P );
	coords[ 1 ] = mat * ( rectCoords[ 1 ] - P );
	coords[ 2 ] = mat * ( rectCoords[ 2 ] - P );
	coords[ 3 ] = mat * ( rectCoords[ 3 ] - P );
	coords[ 0 ] = normalize( coords[ 0 ] );
	coords[ 1 ] = normalize( coords[ 1 ] );
	coords[ 2 ] = normalize( coords[ 2 ] );
	coords[ 3 ] = normalize( coords[ 3 ] );
	vec3 vectorFormFactor = vec3( 0.0 );
	vectorFormFactor += LTC_EdgeVectorFormFactor( coords[ 0 ], coords[ 1 ] );
	vectorFormFactor += LTC_EdgeVectorFormFactor( coords[ 1 ], coords[ 2 ] );
	vectorFormFactor += LTC_EdgeVectorFormFactor( coords[ 2 ], coords[ 3 ] );
	vectorFormFactor += LTC_EdgeVectorFormFactor( coords[ 3 ], coords[ 0 ] );
	float result = LTC_ClippedSphereFormFactor( vectorFormFactor );
	return vec3( result );
}
#if defined( USE_SHEEN )
float D_Charlie( float roughness, float dotNH ) {
	float alpha = pow2( roughness );
	float invAlpha = 1.0 / alpha;
	float cos2h = dotNH * dotNH;
	float sin2h = max( 1.0 - cos2h, 0.0078125 );
	return ( 2.0 + invAlpha ) * pow( sin2h, invAlpha * 0.5 ) / ( 2.0 * PI );
}
float V_Neubelt( float dotNV, float dotNL ) {
	return saturate( 1.0 / ( 4.0 * ( dotNL + dotNV - dotNL * dotNV ) ) );
}
vec3 BRDF_Sheen( const in vec3 lightDir, const in vec3 viewDir, const in vec3 normal, vec3 sheenColor, const in float sheenRoughness ) {
	vec3 halfDir = normalize( lightDir + viewDir );
	float dotNL = saturate( dot( normal, lightDir ) );
	float dotNV = saturate( dot( normal, viewDir ) );
	float dotNH = saturate( dot( normal, halfDir ) );
	float D = D_Charlie( sheenRoughness, dotNH );
	float V = V_Neubelt( dotNV, dotNL );
	return sheenColor * ( D * V );
}
#endif
float IBLSheenBRDF( const in vec3 normal, const in vec3 viewDir, const in float roughness ) {
	float dotNV = saturate( dot( normal, viewDir ) );
	float r2 = roughness * roughness;
	float rInv = 1.0 / ( roughness + 0.1 );
	float a = -1.9362 + 1.0678 * roughness + 0.4573 * r2 - 0.8469 * rInv;
	float b = -0.6014 + 0.5538 * roughness - 0.4670 * r2 - 0.1255 * rInv;
	float DG = exp( a * dotNV + b );
	return saturate( DG );
}
vec3 EnvironmentBRDF( const in vec3 normal, const in vec3 viewDir, const in vec3 specularColor, const in float specularF90, const in float roughness ) {
	float dotNV = saturate( dot( normal, viewDir ) );
	vec2 fab = texture2D( dfgLUT, vec2( roughness, dotNV ) ).rg;
	return specularColor * fab.x + specularF90 * fab.y;
}
#ifdef USE_IRIDESCENCE
void computeMultiscatteringIridescence( const in vec3 normal, const in vec3 viewDir, const in vec3 specularColor, const in float specularF90, const in float iridescence, const in vec3 iridescenceF0, const in float roughness, inout vec3 singleScatter, inout vec3 multiScatter ) {
#else
void computeMultiscattering( const in vec3 normal, const in vec3 viewDir, const in vec3 specularColor, const in float specularF90, const in float roughness, inout vec3 singleScatter, inout vec3 multiScatter ) {
#endif
	float dotNV = saturate( dot( normal, viewDir ) );
	vec2 fab = texture2D( dfgLUT, vec2( roughness, dotNV ) ).rg;
	#ifdef USE_IRIDESCENCE
		vec3 Fr = mix( specularColor, iridescenceF0, iridescence );
	#else
		vec3 Fr = specularColor;
	#endif
	vec3 FssEss = Fr * fab.x + specularF90 * fab.y;
	float Ess = fab.x + fab.y;
	float Ems = 1.0 - Ess;
	vec3 Favg = Fr + ( 1.0 - Fr ) * 0.047619;	vec3 Fms = FssEss * Favg / ( 1.0 - Ems * Favg );
	singleScatter += FssEss;
	multiScatter += Fms * Ems;
}
vec3 BRDF_GGX_Multiscatter( const in vec3 lightDir, const in vec3 viewDir, const in vec3 normal, const in PhysicalMaterial material ) {
	vec3 singleScatter = BRDF_GGX( lightDir, viewDir, normal, material );
	float dotNL = saturate( dot( normal, lightDir ) );
	float dotNV = saturate( dot( normal, viewDir ) );
	vec2 dfgV = texture2D( dfgLUT, vec2( material.roughness, dotNV ) ).rg;
	vec2 dfgL = texture2D( dfgLUT, vec2( material.roughness, dotNL ) ).rg;
	vec3 FssEss_V = material.specularColorBlended * dfgV.x + material.specularF90 * dfgV.y;
	vec3 FssEss_L = material.specularColorBlended * dfgL.x + material.specularF90 * dfgL.y;
	float Ess_V = dfgV.x + dfgV.y;
	float Ess_L = dfgL.x + dfgL.y;
	float Ems_V = 1.0 - Ess_V;
	float Ems_L = 1.0 - Ess_L;
	vec3 Favg = material.specularColorBlended + ( 1.0 - material.specularColorBlended ) * 0.047619;
	vec3 Fms = FssEss_V * FssEss_L * Favg / ( 1.0 - Ems_V * Ems_L * Favg + EPSILON );
	float compensationFactor = Ems_V * Ems_L;
	vec3 multiScatter = Fms * compensationFactor;
	return singleScatter + multiScatter;
}
#if NUM_RECT_AREA_LIGHTS > 0
	void RE_Direct_RectArea_Physical( const in RectAreaLight rectAreaLight, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in PhysicalMaterial material, inout ReflectedLight reflectedLight ) {
		vec3 normal = geometryNormal;
		vec3 viewDir = geometryViewDir;
		vec3 position = geometryPosition;
		vec3 lightPos = rectAreaLight.position;
		vec3 halfWidth = rectAreaLight.halfWidth;
		vec3 halfHeight = rectAreaLight.halfHeight;
		vec3 lightColor = rectAreaLight.color;
		float roughness = material.roughness;
		vec3 rectCoords[ 4 ];
		rectCoords[ 0 ] = lightPos + halfWidth - halfHeight;		rectCoords[ 1 ] = lightPos - halfWidth - halfHeight;
		rectCoords[ 2 ] = lightPos - halfWidth + halfHeight;
		rectCoords[ 3 ] = lightPos + halfWidth + halfHeight;
		vec2 uv = LTC_Uv( normal, viewDir, roughness );
		vec4 t1 = texture2D( ltc_1, uv );
		vec4 t2 = texture2D( ltc_2, uv );
		mat3 mInv = mat3(
			vec3( t1.x, 0, t1.y ),
			vec3(    0, 1,    0 ),
			vec3( t1.z, 0, t1.w )
		);
		vec3 fresnel = ( material.specularColorBlended * t2.x + ( material.specularF90 - material.specularColorBlended ) * t2.y );
		reflectedLight.directSpecular += lightColor * fresnel * LTC_Evaluate( normal, viewDir, position, mInv, rectCoords );
		reflectedLight.directDiffuse += lightColor * material.diffuseContribution * LTC_Evaluate( normal, viewDir, position, mat3( 1.0 ), rectCoords );
		#ifdef USE_CLEARCOAT
			vec3 Ncc = geometryClearcoatNormal;
			vec2 uvClearcoat = LTC_Uv( Ncc, viewDir, material.clearcoatRoughness );
			vec4 t1Clearcoat = texture2D( ltc_1, uvClearcoat );
			vec4 t2Clearcoat = texture2D( ltc_2, uvClearcoat );
			mat3 mInvClearcoat = mat3(
				vec3( t1Clearcoat.x, 0, t1Clearcoat.y ),
				vec3(             0, 1,             0 ),
				vec3( t1Clearcoat.z, 0, t1Clearcoat.w )
			);
			vec3 fresnelClearcoat = material.clearcoatF0 * t2Clearcoat.x + ( material.clearcoatF90 - material.clearcoatF0 ) * t2Clearcoat.y;
			clearcoatSpecularDirect += lightColor * fresnelClearcoat * LTC_Evaluate( Ncc, viewDir, position, mInvClearcoat, rectCoords );
		#endif
	}
#endif
void RE_Direct_Physical( const in IncidentLight directLight, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in PhysicalMaterial material, inout ReflectedLight reflectedLight ) {
	float dotNL = saturate( dot( geometryNormal, directLight.direction ) );
	vec3 irradiance = dotNL * directLight.color;
	#ifdef USE_CLEARCOAT
		float dotNLcc = saturate( dot( geometryClearcoatNormal, directLight.direction ) );
		vec3 ccIrradiance = dotNLcc * directLight.color;
		clearcoatSpecularDirect += ccIrradiance * BRDF_GGX_Clearcoat( directLight.direction, geometryViewDir, geometryClearcoatNormal, material );
	#endif
	#ifdef USE_SHEEN
 
 		sheenSpecularDirect += irradiance * BRDF_Sheen( directLight.direction, geometryViewDir, geometryNormal, material.sheenColor, material.sheenRoughness );
 
 		float sheenAlbedoV = IBLSheenBRDF( geometryNormal, geometryViewDir, material.sheenRoughness );
 		float sheenAlbedoL = IBLSheenBRDF( geometryNormal, directLight.direction, material.sheenRoughness );
 
 		float sheenEnergyComp = 1.0 - max3( material.sheenColor ) * max( sheenAlbedoV, sheenAlbedoL );
 
 		irradiance *= sheenEnergyComp;
 
 	#endif
	reflectedLight.directSpecular += irradiance * BRDF_GGX_Multiscatter( directLight.direction, geometryViewDir, geometryNormal, material );
	reflectedLight.directDiffuse += irradiance * BRDF_Lambert( material.diffuseContribution );
}
void RE_IndirectDiffuse_Physical( const in vec3 irradiance, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in PhysicalMaterial material, inout ReflectedLight reflectedLight ) {
	vec3 diffuse = irradiance * BRDF_Lambert( material.diffuseContribution );
	#ifdef USE_SHEEN
		float sheenAlbedo = IBLSheenBRDF( geometryNormal, geometryViewDir, material.sheenRoughness );
		float sheenEnergyComp = 1.0 - max3( material.sheenColor ) * sheenAlbedo;
		diffuse *= sheenEnergyComp;
	#endif
	reflectedLight.indirectDiffuse += diffuse;
}
void RE_IndirectSpecular_Physical( const in vec3 radiance, const in vec3 irradiance, const in vec3 clearcoatRadiance, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in PhysicalMaterial material, inout ReflectedLight reflectedLight) {
	#ifdef USE_CLEARCOAT
		clearcoatSpecularIndirect += clearcoatRadiance * EnvironmentBRDF( geometryClearcoatNormal, geometryViewDir, material.clearcoatF0, material.clearcoatF90, material.clearcoatRoughness );
	#endif
	#ifdef USE_SHEEN
		sheenSpecularIndirect += irradiance * material.sheenColor * IBLSheenBRDF( geometryNormal, geometryViewDir, material.sheenRoughness ) * RECIPROCAL_PI;
 	#endif
	vec3 singleScatteringDielectric = vec3( 0.0 );
	vec3 multiScatteringDielectric = vec3( 0.0 );
	vec3 singleScatteringMetallic = vec3( 0.0 );
	vec3 multiScatteringMetallic = vec3( 0.0 );
	#ifdef USE_IRIDESCENCE
		computeMultiscatteringIridescence( geometryNormal, geometryViewDir, material.specularColor, material.specularF90, material.iridescence, material.iridescenceFresnelDielectric, material.roughness, singleScatteringDielectric, multiScatteringDielectric );
		computeMultiscatteringIridescence( geometryNormal, geometryViewDir, material.diffuseColor, material.specularF90, material.iridescence, material.iridescenceFresnelMetallic, material.roughness, singleScatteringMetallic, multiScatteringMetallic );
	#else
		computeMultiscattering( geometryNormal, geometryViewDir, material.specularColor, material.specularF90, material.roughness, singleScatteringDielectric, multiScatteringDielectric );
		computeMultiscattering( geometryNormal, geometryViewDir, material.diffuseColor, material.specularF90, material.roughness, singleScatteringMetallic, multiScatteringMetallic );
	#endif
	vec3 singleScattering = mix( singleScatteringDielectric, singleScatteringMetallic, material.metalness );
	vec3 multiScattering = mix( multiScatteringDielectric, multiScatteringMetallic, material.metalness );
	vec3 totalScatteringDielectric = singleScatteringDielectric + multiScatteringDielectric;
	vec3 diffuse = material.diffuseContribution * ( 1.0 - totalScatteringDielectric );
	vec3 cosineWeightedIrradiance = irradiance * RECIPROCAL_PI;
	vec3 indirectSpecular = radiance * singleScattering;
	indirectSpecular += multiScattering * cosineWeightedIrradiance;
	vec3 indirectDiffuse = diffuse * cosineWeightedIrradiance;
	#ifdef USE_SHEEN
		float sheenAlbedo = IBLSheenBRDF( geometryNormal, geometryViewDir, material.sheenRoughness );
		float sheenEnergyComp = 1.0 - max3( material.sheenColor ) * sheenAlbedo;
		indirectSpecular *= sheenEnergyComp;
		indirectDiffuse *= sheenEnergyComp;
	#endif
	reflectedLight.indirectSpecular += indirectSpecular;
	reflectedLight.indirectDiffuse += indirectDiffuse;
}
#define RE_Direct				RE_Direct_Physical
#define RE_Direct_RectArea		RE_Direct_RectArea_Physical
#define RE_IndirectDiffuse		RE_IndirectDiffuse_Physical
#define RE_IndirectSpecular		RE_IndirectSpecular_Physical
float computeSpecularOcclusion( const in float dotNV, const in float ambientOcclusion, const in float roughness ) {
	return saturate( pow( dotNV + ambientOcclusion, exp2( - 16.0 * roughness - 1.0 ) ) - 1.0 + ambientOcclusion );
}`,jg=`
vec3 geometryPosition = - vViewPosition;
vec3 geometryNormal = normal;
vec3 geometryViewDir = ( isOrthographic ) ? vec3( 0, 0, 1 ) : normalize( vViewPosition );
vec3 geometryClearcoatNormal = vec3( 0.0 );
#ifdef USE_CLEARCOAT
	geometryClearcoatNormal = clearcoatNormal;
#endif
#ifdef USE_IRIDESCENCE
	float dotNVi = saturate( dot( normal, geometryViewDir ) );
	if ( material.iridescenceThickness == 0.0 ) {
		material.iridescence = 0.0;
	} else {
		material.iridescence = saturate( material.iridescence );
	}
	if ( material.iridescence > 0.0 ) {
		material.iridescenceFresnelDielectric = evalIridescence( 1.0, material.iridescenceIOR, dotNVi, material.iridescenceThickness, material.specularColor );
		material.iridescenceFresnelMetallic = evalIridescence( 1.0, material.iridescenceIOR, dotNVi, material.iridescenceThickness, material.diffuseColor );
		material.iridescenceFresnel = mix( material.iridescenceFresnelDielectric, material.iridescenceFresnelMetallic, material.metalness );
		material.iridescenceF0 = Schlick_to_F0( material.iridescenceFresnel, 1.0, dotNVi );
	}
#endif
IncidentLight directLight;
#if ( NUM_POINT_LIGHTS > 0 ) && defined( RE_Direct )
	PointLight pointLight;
	#if defined( USE_SHADOWMAP ) && NUM_POINT_LIGHT_SHADOWS > 0
	PointLightShadow pointLightShadow;
	#endif
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_POINT_LIGHTS; i ++ ) {
		pointLight = pointLights[ i ];
		getPointLightInfo( pointLight, geometryPosition, directLight );
		#if defined( USE_SHADOWMAP ) && ( UNROLLED_LOOP_INDEX < NUM_POINT_LIGHT_SHADOWS ) && ( defined( SHADOWMAP_TYPE_PCF ) || defined( SHADOWMAP_TYPE_BASIC ) )
		pointLightShadow = pointLightShadows[ i ];
		directLight.color *= ( directLight.visible && receiveShadow ) ? getPointShadow( pointShadowMap[ i ], pointLightShadow.shadowMapSize, pointLightShadow.shadowIntensity, pointLightShadow.shadowBias, pointLightShadow.shadowRadius, vPointShadowCoord[ i ], pointLightShadow.shadowCameraNear, pointLightShadow.shadowCameraFar ) : 1.0;
		#endif
		RE_Direct( directLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
	}
	#pragma unroll_loop_end
#endif
#if ( NUM_SPOT_LIGHTS > 0 ) && defined( RE_Direct )
	SpotLight spotLight;
	vec4 spotColor;
	vec3 spotLightCoord;
	bool inSpotLightMap;
	#if defined( USE_SHADOWMAP ) && NUM_SPOT_LIGHT_SHADOWS > 0
	SpotLightShadow spotLightShadow;
	#endif
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_SPOT_LIGHTS; i ++ ) {
		spotLight = spotLights[ i ];
		getSpotLightInfo( spotLight, geometryPosition, directLight );
		#if ( UNROLLED_LOOP_INDEX < NUM_SPOT_LIGHT_SHADOWS_WITH_MAPS )
		#define SPOT_LIGHT_MAP_INDEX UNROLLED_LOOP_INDEX
		#elif ( UNROLLED_LOOP_INDEX < NUM_SPOT_LIGHT_SHADOWS )
		#define SPOT_LIGHT_MAP_INDEX NUM_SPOT_LIGHT_MAPS
		#else
		#define SPOT_LIGHT_MAP_INDEX ( UNROLLED_LOOP_INDEX - NUM_SPOT_LIGHT_SHADOWS + NUM_SPOT_LIGHT_SHADOWS_WITH_MAPS )
		#endif
		#if ( SPOT_LIGHT_MAP_INDEX < NUM_SPOT_LIGHT_MAPS )
			spotLightCoord = vSpotLightCoord[ i ].xyz / vSpotLightCoord[ i ].w;
			inSpotLightMap = all( lessThan( abs( spotLightCoord * 2. - 1. ), vec3( 1.0 ) ) );
			spotColor = texture2D( spotLightMap[ SPOT_LIGHT_MAP_INDEX ], spotLightCoord.xy );
			directLight.color = inSpotLightMap ? directLight.color * spotColor.rgb : directLight.color;
		#endif
		#undef SPOT_LIGHT_MAP_INDEX
		#if defined( USE_SHADOWMAP ) && ( UNROLLED_LOOP_INDEX < NUM_SPOT_LIGHT_SHADOWS )
		spotLightShadow = spotLightShadows[ i ];
		directLight.color *= ( directLight.visible && receiveShadow ) ? getShadow( spotShadowMap[ i ], spotLightShadow.shadowMapSize, spotLightShadow.shadowIntensity, spotLightShadow.shadowBias, spotLightShadow.shadowRadius, vSpotLightCoord[ i ] ) : 1.0;
		#endif
		RE_Direct( directLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
	}
	#pragma unroll_loop_end
#endif
#if ( NUM_DIR_LIGHTS > 0 ) && defined( RE_Direct )
	DirectionalLight directionalLight;
	#if defined( USE_SHADOWMAP ) && NUM_DIR_LIGHT_SHADOWS > 0
	DirectionalLightShadow directionalLightShadow;
	#endif
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_DIR_LIGHTS; i ++ ) {
		directionalLight = directionalLights[ i ];
		getDirectionalLightInfo( directionalLight, directLight );
		#if defined( USE_SHADOWMAP ) && ( UNROLLED_LOOP_INDEX < NUM_DIR_LIGHT_SHADOWS )
		directionalLightShadow = directionalLightShadows[ i ];
		directLight.color *= ( directLight.visible && receiveShadow ) ? getShadow( directionalShadowMap[ i ], directionalLightShadow.shadowMapSize, directionalLightShadow.shadowIntensity, directionalLightShadow.shadowBias, directionalLightShadow.shadowRadius, vDirectionalShadowCoord[ i ] ) : 1.0;
		#endif
		RE_Direct( directLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
	}
	#pragma unroll_loop_end
#endif
#if ( NUM_RECT_AREA_LIGHTS > 0 ) && defined( RE_Direct_RectArea )
	RectAreaLight rectAreaLight;
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_RECT_AREA_LIGHTS; i ++ ) {
		rectAreaLight = rectAreaLights[ i ];
		RE_Direct_RectArea( rectAreaLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
	}
	#pragma unroll_loop_end
#endif
#if defined( RE_IndirectDiffuse )
	vec3 iblIrradiance = vec3( 0.0 );
	vec3 irradiance = getAmbientLightIrradiance( ambientLightColor );
	#if defined( USE_LIGHT_PROBES )
		irradiance += getLightProbeIrradiance( lightProbe, geometryNormal );
	#endif
	#if ( NUM_HEMI_LIGHTS > 0 )
		#pragma unroll_loop_start
		for ( int i = 0; i < NUM_HEMI_LIGHTS; i ++ ) {
			irradiance += getHemisphereLightIrradiance( hemisphereLights[ i ], geometryNormal );
		}
		#pragma unroll_loop_end
	#endif
	#ifdef USE_LIGHT_PROBES_GRID
		vec3 probeWorldPos = ( ( vec4( geometryPosition, 1.0 ) - viewMatrix[ 3 ] ) * viewMatrix ).xyz;
		vec3 probeWorldNormal = transformNormalByInverseViewMatrix( geometryNormal, viewMatrix );
		irradiance += getLightProbeGridIrradiance( probeWorldPos, probeWorldNormal );
	#endif
#endif
#if defined( RE_IndirectSpecular )
	vec3 radiance = vec3( 0.0 );
	vec3 clearcoatRadiance = vec3( 0.0 );
#endif`,ev=`#if defined( RE_IndirectDiffuse )
	#ifdef USE_LIGHTMAP
		vec4 lightMapTexel = texture2D( lightMap, vLightMapUv );
		vec3 lightMapIrradiance = lightMapTexel.rgb * lightMapIntensity;
		irradiance += lightMapIrradiance;
	#endif
	#if defined( USE_ENVMAP ) && defined( ENVMAP_TYPE_CUBE_UV )
		#if defined( STANDARD ) || defined( LAMBERT ) || defined( PHONG )
			iblIrradiance += getIBLIrradiance( geometryNormal );
		#endif
	#endif
#endif
#if defined( USE_ENVMAP ) && defined( RE_IndirectSpecular )
	#ifdef USE_ANISOTROPY
		radiance += getIBLAnisotropyRadiance( geometryViewDir, geometryNormal, material.roughness, material.anisotropyB, material.anisotropy );
	#else
		radiance += getIBLRadiance( geometryViewDir, geometryNormal, material.roughness );
	#endif
	#ifdef USE_CLEARCOAT
		clearcoatRadiance += getIBLRadiance( geometryViewDir, geometryClearcoatNormal, material.clearcoatRoughness );
	#endif
#endif`,tv=`#if defined( RE_IndirectDiffuse )
	#if defined( LAMBERT ) || defined( PHONG )
		irradiance += iblIrradiance;
	#endif
	RE_IndirectDiffuse( irradiance, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
#endif
#if defined( RE_IndirectSpecular )
	RE_IndirectSpecular( radiance, iblIrradiance, clearcoatRadiance, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
#endif`,nv=`#ifdef USE_LIGHT_PROBES_GRID
uniform highp sampler3D probesSH;
uniform vec3 probesMin;
uniform vec3 probesMax;
uniform vec3 probesResolution;
vec3 getLightProbeGridIrradiance( vec3 worldPos, vec3 worldNormal ) {
	vec3 res = probesResolution;
	vec3 gridRange = probesMax - probesMin;
	vec3 resMinusOne = res - 1.0;
	vec3 probeSpacing = gridRange / resMinusOne;
	vec3 samplePos = worldPos + worldNormal * probeSpacing * 0.5;
	vec3 uvw = clamp( ( samplePos - probesMin ) / gridRange, 0.0, 1.0 );
	uvw = uvw * resMinusOne / res + 0.5 / res;
	float nz          = res.z;
	float paddedSlices = nz + 2.0;
	float atlasDepth  = 7.0 * paddedSlices;
	float uvZBase     = uvw.z * nz + 1.0;
	vec4 s0 = texture( probesSH, vec3( uvw.xy, ( uvZBase                       ) / atlasDepth ) );
	vec4 s1 = texture( probesSH, vec3( uvw.xy, ( uvZBase +       paddedSlices   ) / atlasDepth ) );
	vec4 s2 = texture( probesSH, vec3( uvw.xy, ( uvZBase + 2.0 * paddedSlices   ) / atlasDepth ) );
	vec4 s3 = texture( probesSH, vec3( uvw.xy, ( uvZBase + 3.0 * paddedSlices   ) / atlasDepth ) );
	vec4 s4 = texture( probesSH, vec3( uvw.xy, ( uvZBase + 4.0 * paddedSlices   ) / atlasDepth ) );
	vec4 s5 = texture( probesSH, vec3( uvw.xy, ( uvZBase + 5.0 * paddedSlices   ) / atlasDepth ) );
	vec4 s6 = texture( probesSH, vec3( uvw.xy, ( uvZBase + 6.0 * paddedSlices   ) / atlasDepth ) );
	vec3 c0 = s0.xyz;
	vec3 c1 = vec3( s0.w, s1.xy );
	vec3 c2 = vec3( s1.zw, s2.x );
	vec3 c3 = s2.yzw;
	vec3 c4 = s3.xyz;
	vec3 c5 = vec3( s3.w, s4.xy );
	vec3 c6 = vec3( s4.zw, s5.x );
	vec3 c7 = s5.yzw;
	vec3 c8 = s6.xyz;
	float x = worldNormal.x, y = worldNormal.y, z = worldNormal.z;
	vec3 result = c0 * 0.886227;
	result += c1 * 2.0 * 0.511664 * y;
	result += c2 * 2.0 * 0.511664 * z;
	result += c3 * 2.0 * 0.511664 * x;
	result += c4 * 2.0 * 0.429043 * x * y;
	result += c5 * 2.0 * 0.429043 * y * z;
	result += c6 * ( 0.743125 * z * z - 0.247708 );
	result += c7 * 2.0 * 0.429043 * x * z;
	result += c8 * 0.429043 * ( x * x - y * y );
	return max( result, vec3( 0.0 ) );
}
#endif`,iv=`#if defined( USE_LOGARITHMIC_DEPTH_BUFFER )
	gl_FragDepth = vIsPerspective == 0.0 ? gl_FragCoord.z : log2( vFragDepth ) * logDepthBufFC * 0.5;
#endif`,sv=`#if defined( USE_LOGARITHMIC_DEPTH_BUFFER )
	uniform float logDepthBufFC;
	varying float vFragDepth;
	varying float vIsPerspective;
#endif`,rv=`#ifdef USE_LOGARITHMIC_DEPTH_BUFFER
	varying float vFragDepth;
	varying float vIsPerspective;
#endif`,av=`#ifdef USE_LOGARITHMIC_DEPTH_BUFFER
	vFragDepth = 1.0 + gl_Position.w;
	vIsPerspective = float( isPerspectiveMatrix( projectionMatrix ) );
#endif`,ov=`#ifdef USE_MAP
	vec4 sampledDiffuseColor = texture2D( map, vMapUv );
	#ifdef DECODE_VIDEO_TEXTURE
		sampledDiffuseColor = sRGBTransferEOTF( sampledDiffuseColor );
	#endif
	diffuseColor *= sampledDiffuseColor;
#endif`,lv=`#ifdef USE_MAP
	uniform sampler2D map;
#endif`,cv=`#if defined( USE_MAP ) || defined( USE_ALPHAMAP )
	#if defined( USE_POINTS_UV )
		vec2 uv = vUv;
	#else
		vec2 uv = ( uvTransform * vec3( gl_PointCoord.x, 1.0 - gl_PointCoord.y, 1 ) ).xy;
	#endif
#endif
#ifdef USE_MAP
	diffuseColor *= texture2D( map, uv );
#endif
#ifdef USE_ALPHAMAP
	diffuseColor.a *= texture2D( alphaMap, uv ).g;
#endif`,hv=`#if defined( USE_POINTS_UV )
	varying vec2 vUv;
#else
	#if defined( USE_MAP ) || defined( USE_ALPHAMAP )
		uniform mat3 uvTransform;
	#endif
#endif
#ifdef USE_MAP
	uniform sampler2D map;
#endif
#ifdef USE_ALPHAMAP
	uniform sampler2D alphaMap;
#endif`,uv=`float metalnessFactor = metalness;
#ifdef USE_METALNESSMAP
	vec4 texelMetalness = texture2D( metalnessMap, vMetalnessMapUv );
	metalnessFactor *= texelMetalness.b;
#endif`,dv=`#ifdef USE_METALNESSMAP
	uniform sampler2D metalnessMap;
#endif`,fv=`#ifdef USE_INSTANCING_MORPH
	float morphTargetInfluences[ MORPHTARGETS_COUNT ];
	float morphTargetBaseInfluence = texelFetch( morphTexture, ivec2( 0, gl_InstanceID ), 0 ).r;
	for ( int i = 0; i < MORPHTARGETS_COUNT; i ++ ) {
		morphTargetInfluences[i] =  texelFetch( morphTexture, ivec2( i + 1, gl_InstanceID ), 0 ).r;
	}
#endif`,pv=`#if defined( USE_MORPHCOLORS )
	vColor *= morphTargetBaseInfluence;
	for ( int i = 0; i < MORPHTARGETS_COUNT; i ++ ) {
		#if defined( USE_COLOR_ALPHA )
			if ( morphTargetInfluences[ i ] != 0.0 ) vColor += getMorph( gl_VertexID, i, 2 ) * morphTargetInfluences[ i ];
		#elif defined( USE_COLOR )
			if ( morphTargetInfluences[ i ] != 0.0 ) vColor += getMorph( gl_VertexID, i, 2 ).rgb * morphTargetInfluences[ i ];
		#endif
	}
#endif`,mv=`#ifdef USE_MORPHNORMALS
	objectNormal *= morphTargetBaseInfluence;
	for ( int i = 0; i < MORPHTARGETS_COUNT; i ++ ) {
		if ( morphTargetInfluences[ i ] != 0.0 ) objectNormal += getMorph( gl_VertexID, i, 1 ).xyz * morphTargetInfluences[ i ];
	}
#endif`,gv=`#ifdef USE_MORPHTARGETS
	#ifndef USE_INSTANCING_MORPH
		uniform float morphTargetBaseInfluence;
		uniform float morphTargetInfluences[ MORPHTARGETS_COUNT ];
	#endif
	uniform sampler2DArray morphTargetsTexture;
	uniform ivec2 morphTargetsTextureSize;
	vec4 getMorph( const in int vertexIndex, const in int morphTargetIndex, const in int offset ) {
		int texelIndex = vertexIndex * MORPHTARGETS_TEXTURE_STRIDE + offset;
		int y = texelIndex / morphTargetsTextureSize.x;
		int x = texelIndex - y * morphTargetsTextureSize.x;
		ivec3 morphUV = ivec3( x, y, morphTargetIndex );
		return texelFetch( morphTargetsTexture, morphUV, 0 );
	}
#endif`,vv=`#ifdef USE_MORPHTARGETS
	transformed *= morphTargetBaseInfluence;
	for ( int i = 0; i < MORPHTARGETS_COUNT; i ++ ) {
		if ( morphTargetInfluences[ i ] != 0.0 ) transformed += getMorph( gl_VertexID, i, 0 ).xyz * morphTargetInfluences[ i ];
	}
#endif`,_v=`float faceDirection = gl_FrontFacing ? 1.0 : - 1.0;
#ifdef FLAT_SHADED
	vec3 fdx = dFdx( vViewPosition );
	vec3 fdy = dFdy( vViewPosition );
	vec3 normal = normalize( cross( fdx, fdy ) );
#else
	vec3 normal = normalize( vNormal );
	#ifdef DOUBLE_SIDED
		normal *= faceDirection;
	#endif
#endif
#if defined( USE_NORMALMAP_TANGENTSPACE ) || defined( USE_CLEARCOAT_NORMALMAP ) || defined( USE_ANISOTROPY )
	#ifdef USE_TANGENT
		mat3 tbn = mat3( normalize( vTangent ), normalize( vBitangent ), normal );
	#else
		mat3 tbn = getTangentFrame( - vViewPosition, normal,
		#if defined( USE_NORMALMAP )
			vNormalMapUv
		#elif defined( USE_CLEARCOAT_NORMALMAP )
			vClearcoatNormalMapUv
		#else
			vUv
		#endif
		);
	#endif
	#ifdef DOUBLE_SIDED
		tbn[0] *= faceDirection;
		tbn[1] *= faceDirection;
	#endif
#endif
#ifdef USE_CLEARCOAT_NORMALMAP
	#ifdef USE_TANGENT
		mat3 tbn2 = mat3( normalize( vTangent ), normalize( vBitangent ), normal );
	#else
		mat3 tbn2 = getTangentFrame( - vViewPosition, normal, vClearcoatNormalMapUv );
	#endif
	#ifdef DOUBLE_SIDED
		tbn2[0] *= faceDirection;
		tbn2[1] *= faceDirection;
	#endif
#endif
vec3 nonPerturbedNormal = normal;`,xv=`#ifdef USE_NORMALMAP_OBJECTSPACE
	normal = texture2D( normalMap, vNormalMapUv ).xyz * 2.0 - 1.0;
	#ifdef FLIP_SIDED
		normal = - normal;
	#endif
	#ifdef DOUBLE_SIDED
		normal = normal * faceDirection;
	#endif
	normal = normalize( normalMatrix * normal );
#elif defined( USE_NORMALMAP_TANGENTSPACE )
	vec3 mapN = texture2D( normalMap, vNormalMapUv ).xyz * 2.0 - 1.0;
	#if defined( USE_PACKED_NORMALMAP )
		mapN = vec3( mapN.xy, sqrt( saturate( 1.0 - dot( mapN.xy, mapN.xy ) ) ) );
	#endif
	mapN.xy *= normalScale;
	normal = normalize( tbn * mapN );
#elif defined( USE_BUMPMAP )
	normal = perturbNormalArb( - vViewPosition, normal, dHdxy_fwd(), faceDirection );
#endif`,Sv=`#ifndef FLAT_SHADED
	varying vec3 vNormal;
	#ifdef USE_TANGENT
		varying vec3 vTangent;
		varying vec3 vBitangent;
	#endif
#endif`,Mv=`#ifndef FLAT_SHADED
	varying vec3 vNormal;
	#ifdef USE_TANGENT
		varying vec3 vTangent;
		varying vec3 vBitangent;
	#endif
#endif`,yv=`#ifndef FLAT_SHADED
	vNormal = normalize( transformedNormal );
	#ifdef USE_TANGENT
		vTangent = normalize( transformedTangent );
		vBitangent = normalize( cross( vNormal, vTangent ) * tangent.w );
		#ifdef FLIP_SIDED
			vBitangent = - vBitangent;
		#endif
	#endif
#endif`,bv=`#ifdef USE_NORMALMAP
	uniform sampler2D normalMap;
	uniform vec2 normalScale;
#endif
#ifdef USE_NORMALMAP_OBJECTSPACE
	uniform mat3 normalMatrix;
#endif
#if ! defined ( USE_TANGENT ) && ( defined ( USE_NORMALMAP_TANGENTSPACE ) || defined ( USE_CLEARCOAT_NORMALMAP ) || defined( USE_ANISOTROPY ) )
	mat3 getTangentFrame( vec3 eye_pos, vec3 surf_norm, vec2 uv ) {
		vec3 q0 = dFdx( eye_pos.xyz );
		vec3 q1 = dFdy( eye_pos.xyz );
		vec2 st0 = dFdx( uv.st );
		vec2 st1 = dFdy( uv.st );
		vec3 N = surf_norm;
		vec3 q1perp = cross( q1, N );
		vec3 q0perp = cross( N, q0 );
		vec3 T = q1perp * st0.x + q0perp * st1.x;
		vec3 B = q1perp * st0.y + q0perp * st1.y;
		float det = max( dot( T, T ), dot( B, B ) );
		float scale = ( det == 0.0 ) ? 0.0 : inversesqrt( det );
		return mat3( T * scale, B * scale, N );
	}
#endif`,Ev=`#ifdef USE_CLEARCOAT
	vec3 clearcoatNormal = nonPerturbedNormal;
#endif`,Tv=`#ifdef USE_CLEARCOAT_NORMALMAP
	vec3 clearcoatMapN = texture2D( clearcoatNormalMap, vClearcoatNormalMapUv ).xyz * 2.0 - 1.0;
	clearcoatMapN.xy *= clearcoatNormalScale;
	clearcoatNormal = normalize( tbn2 * clearcoatMapN );
#endif`,Av=`#ifdef USE_CLEARCOATMAP
	uniform sampler2D clearcoatMap;
#endif
#ifdef USE_CLEARCOAT_NORMALMAP
	uniform sampler2D clearcoatNormalMap;
	uniform vec2 clearcoatNormalScale;
#endif
#ifdef USE_CLEARCOAT_ROUGHNESSMAP
	uniform sampler2D clearcoatRoughnessMap;
#endif`,wv=`#ifdef USE_IRIDESCENCEMAP
	uniform sampler2D iridescenceMap;
#endif
#ifdef USE_IRIDESCENCE_THICKNESSMAP
	uniform sampler2D iridescenceThicknessMap;
#endif`,Cv=`#ifdef OPAQUE
diffuseColor.a = 1.0;
#endif
#ifdef USE_TRANSMISSION
diffuseColor.a *= material.transmissionAlpha;
#endif
gl_FragColor = vec4( outgoingLight, diffuseColor.a );`,Rv=`vec3 packNormalToRGB( const in vec3 normal ) {
	return normalize( normal ) * 0.5 + 0.5;
}
vec3 unpackRGBToNormal( const in vec3 rgb ) {
	return 2.0 * rgb.xyz - 1.0;
}
const float PackUpscale = 256. / 255.;const float UnpackDownscale = 255. / 256.;const float ShiftRight8 = 1. / 256.;
const float Inv255 = 1. / 255.;
const vec4 PackFactors = vec4( 1.0, 256.0, 256.0 * 256.0, 256.0 * 256.0 * 256.0 );
const vec2 UnpackFactors2 = vec2( UnpackDownscale, 1.0 / PackFactors.g );
const vec3 UnpackFactors3 = vec3( UnpackDownscale / PackFactors.rg, 1.0 / PackFactors.b );
const vec4 UnpackFactors4 = vec4( UnpackDownscale / PackFactors.rgb, 1.0 / PackFactors.a );
vec4 packDepthToRGBA( const in float v ) {
	if( v <= 0.0 )
		return vec4( 0., 0., 0., 0. );
	if( v >= 1.0 )
		return vec4( 1., 1., 1., 1. );
	float vuf;
	float af = modf( v * PackFactors.a, vuf );
	float bf = modf( vuf * ShiftRight8, vuf );
	float gf = modf( vuf * ShiftRight8, vuf );
	return vec4( vuf * Inv255, gf * PackUpscale, bf * PackUpscale, af );
}
vec3 packDepthToRGB( const in float v ) {
	if( v <= 0.0 )
		return vec3( 0., 0., 0. );
	if( v >= 1.0 )
		return vec3( 1., 1., 1. );
	float vuf;
	float bf = modf( v * PackFactors.b, vuf );
	float gf = modf( vuf * ShiftRight8, vuf );
	return vec3( vuf * Inv255, gf * PackUpscale, bf );
}
vec2 packDepthToRG( const in float v ) {
	if( v <= 0.0 )
		return vec2( 0., 0. );
	if( v >= 1.0 )
		return vec2( 1., 1. );
	float vuf;
	float gf = modf( v * 256., vuf );
	return vec2( vuf * Inv255, gf );
}
float unpackRGBAToDepth( const in vec4 v ) {
	return dot( v, UnpackFactors4 );
}
float unpackRGBToDepth( const in vec3 v ) {
	return dot( v, UnpackFactors3 );
}
float unpackRGToDepth( const in vec2 v ) {
	return v.r * UnpackFactors2.r + v.g * UnpackFactors2.g;
}
vec4 pack2HalfToRGBA( const in vec2 v ) {
	vec4 r = vec4( v.x, fract( v.x * 255.0 ), v.y, fract( v.y * 255.0 ) );
	return vec4( r.x - r.y / 255.0, r.y, r.z - r.w / 255.0, r.w );
}
vec2 unpackRGBATo2Half( const in vec4 v ) {
	return vec2( v.x + ( v.y / 255.0 ), v.z + ( v.w / 255.0 ) );
}
float viewZToOrthographicDepth( const in float viewZ, const in float near, const in float far ) {
	return ( viewZ + near ) / ( near - far );
}
float orthographicDepthToViewZ( const in float depth, const in float near, const in float far ) {
	#ifdef USE_REVERSED_DEPTH_BUFFER
	
		return depth * ( far - near ) - far;
	#else
		return depth * ( near - far ) - near;
	#endif
}
float viewZToPerspectiveDepth( const in float viewZ, const in float near, const in float far ) {
	return ( ( near + viewZ ) * far ) / ( ( far - near ) * viewZ );
}
float perspectiveDepthToViewZ( const in float depth, const in float near, const in float far ) {
	
	#ifdef USE_REVERSED_DEPTH_BUFFER
		return ( near * far ) / ( ( near - far ) * depth - near );
	#else
		return ( near * far ) / ( ( far - near ) * depth - far );
	#endif
}`,Pv=`#ifdef PREMULTIPLIED_ALPHA
	gl_FragColor.rgb *= gl_FragColor.a;
#endif`,Iv=`vec4 mvPosition = vec4( transformed, 1.0 );
#ifdef USE_BATCHING
	mvPosition = batchingMatrix * mvPosition;
#endif
#ifdef USE_INSTANCING
	mvPosition = instanceMatrix * mvPosition;
#endif
mvPosition = modelViewMatrix * mvPosition;
gl_Position = projectionMatrix * mvPosition;`,Lv=`#ifdef DITHERING
	gl_FragColor.rgb = dithering( gl_FragColor.rgb );
#endif`,Dv=`#ifdef DITHERING
	vec3 dithering( vec3 color ) {
		float grid_position = rand( gl_FragCoord.xy );
		vec3 dither_shift_RGB = vec3( 0.25 / 255.0, -0.25 / 255.0, 0.25 / 255.0 );
		dither_shift_RGB = mix( 2.0 * dither_shift_RGB, -2.0 * dither_shift_RGB, grid_position );
		return color + dither_shift_RGB;
	}
#endif`,Nv=`float roughnessFactor = roughness;
#ifdef USE_ROUGHNESSMAP
	vec4 texelRoughness = texture2D( roughnessMap, vRoughnessMapUv );
	roughnessFactor *= texelRoughness.g;
#endif`,Uv=`#ifdef USE_ROUGHNESSMAP
	uniform sampler2D roughnessMap;
#endif`,Fv=`#if NUM_SPOT_LIGHT_COORDS > 0
	varying vec4 vSpotLightCoord[ NUM_SPOT_LIGHT_COORDS ];
#endif
#if NUM_SPOT_LIGHT_MAPS > 0
	uniform sampler2D spotLightMap[ NUM_SPOT_LIGHT_MAPS ];
#endif
#ifdef USE_SHADOWMAP
	#if NUM_DIR_LIGHT_SHADOWS > 0
		#if defined( SHADOWMAP_TYPE_PCF )
			uniform sampler2DShadow directionalShadowMap[ NUM_DIR_LIGHT_SHADOWS ];
		#else
			uniform sampler2D directionalShadowMap[ NUM_DIR_LIGHT_SHADOWS ];
		#endif
		varying vec4 vDirectionalShadowCoord[ NUM_DIR_LIGHT_SHADOWS ];
		struct DirectionalLightShadow {
			float shadowIntensity;
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
		};
		uniform DirectionalLightShadow directionalLightShadows[ NUM_DIR_LIGHT_SHADOWS ];
	#endif
	#if NUM_SPOT_LIGHT_SHADOWS > 0
		#if defined( SHADOWMAP_TYPE_PCF )
			uniform sampler2DShadow spotShadowMap[ NUM_SPOT_LIGHT_SHADOWS ];
		#else
			uniform sampler2D spotShadowMap[ NUM_SPOT_LIGHT_SHADOWS ];
		#endif
		struct SpotLightShadow {
			float shadowIntensity;
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
		};
		uniform SpotLightShadow spotLightShadows[ NUM_SPOT_LIGHT_SHADOWS ];
	#endif
	#if NUM_POINT_LIGHT_SHADOWS > 0
		#if defined( SHADOWMAP_TYPE_PCF )
			uniform samplerCubeShadow pointShadowMap[ NUM_POINT_LIGHT_SHADOWS ];
		#elif defined( SHADOWMAP_TYPE_BASIC )
			uniform samplerCube pointShadowMap[ NUM_POINT_LIGHT_SHADOWS ];
		#endif
		varying vec4 vPointShadowCoord[ NUM_POINT_LIGHT_SHADOWS ];
		struct PointLightShadow {
			float shadowIntensity;
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
			float shadowCameraNear;
			float shadowCameraFar;
		};
		uniform PointLightShadow pointLightShadows[ NUM_POINT_LIGHT_SHADOWS ];
	#endif
	#if defined( SHADOWMAP_TYPE_PCF )
		float interleavedGradientNoise( vec2 position ) {
			return fract( 52.9829189 * fract( dot( position, vec2( 0.06711056, 0.00583715 ) ) ) );
		}
		vec2 vogelDiskSample( int sampleIndex, int samplesCount, float phi ) {
			const float goldenAngle = 2.399963229728653;
			float r = sqrt( ( float( sampleIndex ) + 0.5 ) / float( samplesCount ) );
			float theta = float( sampleIndex ) * goldenAngle + phi;
			return vec2( cos( theta ), sin( theta ) ) * r;
		}
	#endif
	#if defined( SHADOWMAP_TYPE_PCF )
		float getShadow( sampler2DShadow shadowMap, vec2 shadowMapSize, float shadowIntensity, float shadowBias, float shadowRadius, vec4 shadowCoord ) {
			float shadow = 1.0;
			shadowCoord.xyz /= shadowCoord.w;
			shadowCoord.z += shadowBias;
			bool inFrustum = shadowCoord.x >= 0.0 && shadowCoord.x <= 1.0 && shadowCoord.y >= 0.0 && shadowCoord.y <= 1.0;
			bool frustumTest = inFrustum && shadowCoord.z <= 1.0;
			if ( frustumTest ) {
				vec2 texelSize = vec2( 1.0 ) / shadowMapSize;
				float radius = shadowRadius * texelSize.x;
				float phi = interleavedGradientNoise( gl_FragCoord.xy ) * PI2;
				shadow = (
					texture( shadowMap, vec3( shadowCoord.xy + vogelDiskSample( 0, 5, phi ) * radius, shadowCoord.z ) ) +
					texture( shadowMap, vec3( shadowCoord.xy + vogelDiskSample( 1, 5, phi ) * radius, shadowCoord.z ) ) +
					texture( shadowMap, vec3( shadowCoord.xy + vogelDiskSample( 2, 5, phi ) * radius, shadowCoord.z ) ) +
					texture( shadowMap, vec3( shadowCoord.xy + vogelDiskSample( 3, 5, phi ) * radius, shadowCoord.z ) ) +
					texture( shadowMap, vec3( shadowCoord.xy + vogelDiskSample( 4, 5, phi ) * radius, shadowCoord.z ) )
				) * 0.2;
			}
			return mix( 1.0, shadow, shadowIntensity );
		}
	#elif defined( SHADOWMAP_TYPE_VSM )
		float getShadow( sampler2D shadowMap, vec2 shadowMapSize, float shadowIntensity, float shadowBias, float shadowRadius, vec4 shadowCoord ) {
			float shadow = 1.0;
			shadowCoord.xyz /= shadowCoord.w;
			#ifdef USE_REVERSED_DEPTH_BUFFER
				shadowCoord.z -= shadowBias;
			#else
				shadowCoord.z += shadowBias;
			#endif
			bool inFrustum = shadowCoord.x >= 0.0 && shadowCoord.x <= 1.0 && shadowCoord.y >= 0.0 && shadowCoord.y <= 1.0;
			bool frustumTest = inFrustum && shadowCoord.z <= 1.0;
			if ( frustumTest ) {
				vec2 distribution = texture2D( shadowMap, shadowCoord.xy ).rg;
				float mean = distribution.x;
				float variance = distribution.y * distribution.y;
				#ifdef USE_REVERSED_DEPTH_BUFFER
					float hard_shadow = step( mean, shadowCoord.z );
				#else
					float hard_shadow = step( shadowCoord.z, mean );
				#endif
				
				if ( hard_shadow == 1.0 ) {
					shadow = 1.0;
				} else {
					variance = max( variance, 0.0000001 );
					float d = shadowCoord.z - mean;
					float p_max = variance / ( variance + d * d );
					p_max = clamp( ( p_max - 0.3 ) / 0.65, 0.0, 1.0 );
					shadow = max( hard_shadow, p_max );
				}
			}
			return mix( 1.0, shadow, shadowIntensity );
		}
	#else
		float getShadow( sampler2D shadowMap, vec2 shadowMapSize, float shadowIntensity, float shadowBias, float shadowRadius, vec4 shadowCoord ) {
			float shadow = 1.0;
			shadowCoord.xyz /= shadowCoord.w;
			#ifdef USE_REVERSED_DEPTH_BUFFER
				shadowCoord.z -= shadowBias;
			#else
				shadowCoord.z += shadowBias;
			#endif
			bool inFrustum = shadowCoord.x >= 0.0 && shadowCoord.x <= 1.0 && shadowCoord.y >= 0.0 && shadowCoord.y <= 1.0;
			bool frustumTest = inFrustum && shadowCoord.z <= 1.0;
			if ( frustumTest ) {
				float depth = texture2D( shadowMap, shadowCoord.xy ).r;
				#ifdef USE_REVERSED_DEPTH_BUFFER
					shadow = step( depth, shadowCoord.z );
				#else
					shadow = step( shadowCoord.z, depth );
				#endif
			}
			return mix( 1.0, shadow, shadowIntensity );
		}
	#endif
	#if NUM_POINT_LIGHT_SHADOWS > 0
	#if defined( SHADOWMAP_TYPE_PCF )
	float getPointShadow( samplerCubeShadow shadowMap, vec2 shadowMapSize, float shadowIntensity, float shadowBias, float shadowRadius, vec4 shadowCoord, float shadowCameraNear, float shadowCameraFar ) {
		float shadow = 1.0;
		vec3 lightToPosition = shadowCoord.xyz;
		vec3 bd3D = normalize( lightToPosition );
		vec3 absVec = abs( lightToPosition );
		float viewSpaceZ = max( max( absVec.x, absVec.y ), absVec.z );
		if ( viewSpaceZ - shadowCameraFar <= 0.0 && viewSpaceZ - shadowCameraNear >= 0.0 ) {
			#ifdef USE_REVERSED_DEPTH_BUFFER
				float dp = ( shadowCameraNear * ( shadowCameraFar - viewSpaceZ ) ) / ( viewSpaceZ * ( shadowCameraFar - shadowCameraNear ) );
				dp -= shadowBias;
			#else
				float dp = ( shadowCameraFar * ( viewSpaceZ - shadowCameraNear ) ) / ( viewSpaceZ * ( shadowCameraFar - shadowCameraNear ) );
				dp += shadowBias;
			#endif
			float texelSize = shadowRadius / shadowMapSize.x;
			vec3 absDir = abs( bd3D );
			vec3 tangent = absDir.x > absDir.z ? vec3( 0.0, 1.0, 0.0 ) : vec3( 1.0, 0.0, 0.0 );
			tangent = normalize( cross( bd3D, tangent ) );
			vec3 bitangent = cross( bd3D, tangent );
			float phi = interleavedGradientNoise( gl_FragCoord.xy ) * PI2;
			vec2 sample0 = vogelDiskSample( 0, 5, phi );
			vec2 sample1 = vogelDiskSample( 1, 5, phi );
			vec2 sample2 = vogelDiskSample( 2, 5, phi );
			vec2 sample3 = vogelDiskSample( 3, 5, phi );
			vec2 sample4 = vogelDiskSample( 4, 5, phi );
			shadow = (
				texture( shadowMap, vec4( bd3D + ( tangent * sample0.x + bitangent * sample0.y ) * texelSize, dp ) ) +
				texture( shadowMap, vec4( bd3D + ( tangent * sample1.x + bitangent * sample1.y ) * texelSize, dp ) ) +
				texture( shadowMap, vec4( bd3D + ( tangent * sample2.x + bitangent * sample2.y ) * texelSize, dp ) ) +
				texture( shadowMap, vec4( bd3D + ( tangent * sample3.x + bitangent * sample3.y ) * texelSize, dp ) ) +
				texture( shadowMap, vec4( bd3D + ( tangent * sample4.x + bitangent * sample4.y ) * texelSize, dp ) )
			) * 0.2;
		}
		return mix( 1.0, shadow, shadowIntensity );
	}
	#elif defined( SHADOWMAP_TYPE_BASIC )
	float getPointShadow( samplerCube shadowMap, vec2 shadowMapSize, float shadowIntensity, float shadowBias, float shadowRadius, vec4 shadowCoord, float shadowCameraNear, float shadowCameraFar ) {
		float shadow = 1.0;
		vec3 lightToPosition = shadowCoord.xyz;
		vec3 absVec = abs( lightToPosition );
		float viewSpaceZ = max( max( absVec.x, absVec.y ), absVec.z );
		if ( viewSpaceZ - shadowCameraFar <= 0.0 && viewSpaceZ - shadowCameraNear >= 0.0 ) {
			float dp = ( shadowCameraFar * ( viewSpaceZ - shadowCameraNear ) ) / ( viewSpaceZ * ( shadowCameraFar - shadowCameraNear ) );
			dp += shadowBias;
			vec3 bd3D = normalize( lightToPosition );
			float depth = textureCube( shadowMap, bd3D ).r;
			#ifdef USE_REVERSED_DEPTH_BUFFER
				depth = 1.0 - depth;
			#endif
			shadow = step( dp, depth );
		}
		return mix( 1.0, shadow, shadowIntensity );
	}
	#endif
	#endif
#endif`,Ov=`#if NUM_SPOT_LIGHT_COORDS > 0
	uniform mat4 spotLightMatrix[ NUM_SPOT_LIGHT_COORDS ];
	varying vec4 vSpotLightCoord[ NUM_SPOT_LIGHT_COORDS ];
#endif
#ifdef USE_SHADOWMAP
	#if NUM_DIR_LIGHT_SHADOWS > 0
		uniform mat4 directionalShadowMatrix[ NUM_DIR_LIGHT_SHADOWS ];
		varying vec4 vDirectionalShadowCoord[ NUM_DIR_LIGHT_SHADOWS ];
		struct DirectionalLightShadow {
			float shadowIntensity;
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
		};
		uniform DirectionalLightShadow directionalLightShadows[ NUM_DIR_LIGHT_SHADOWS ];
	#endif
	#if NUM_SPOT_LIGHT_SHADOWS > 0
		struct SpotLightShadow {
			float shadowIntensity;
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
		};
		uniform SpotLightShadow spotLightShadows[ NUM_SPOT_LIGHT_SHADOWS ];
	#endif
	#if NUM_POINT_LIGHT_SHADOWS > 0
		uniform mat4 pointShadowMatrix[ NUM_POINT_LIGHT_SHADOWS ];
		varying vec4 vPointShadowCoord[ NUM_POINT_LIGHT_SHADOWS ];
		struct PointLightShadow {
			float shadowIntensity;
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
			float shadowCameraNear;
			float shadowCameraFar;
		};
		uniform PointLightShadow pointLightShadows[ NUM_POINT_LIGHT_SHADOWS ];
	#endif
#endif`,Bv=`#if ( defined( USE_SHADOWMAP ) && ( NUM_DIR_LIGHT_SHADOWS > 0 || NUM_POINT_LIGHT_SHADOWS > 0 ) ) || ( NUM_SPOT_LIGHT_COORDS > 0 )
	#ifdef HAS_NORMAL
		vec3 shadowWorldNormal = transformNormalByInverseViewMatrix( transformedNormal, viewMatrix );
	#else
		vec3 shadowWorldNormal = vec3( 0.0 );
	#endif
	vec4 shadowWorldPosition;
#endif
#if defined( USE_SHADOWMAP )
	#if NUM_DIR_LIGHT_SHADOWS > 0
		#pragma unroll_loop_start
		for ( int i = 0; i < NUM_DIR_LIGHT_SHADOWS; i ++ ) {
			shadowWorldPosition = worldPosition + vec4( shadowWorldNormal * directionalLightShadows[ i ].shadowNormalBias, 0 );
			vDirectionalShadowCoord[ i ] = directionalShadowMatrix[ i ] * shadowWorldPosition;
		}
		#pragma unroll_loop_end
	#endif
	#if NUM_POINT_LIGHT_SHADOWS > 0
		#pragma unroll_loop_start
		for ( int i = 0; i < NUM_POINT_LIGHT_SHADOWS; i ++ ) {
			shadowWorldPosition = worldPosition + vec4( shadowWorldNormal * pointLightShadows[ i ].shadowNormalBias, 0 );
			vPointShadowCoord[ i ] = pointShadowMatrix[ i ] * shadowWorldPosition;
		}
		#pragma unroll_loop_end
	#endif
#endif
#if NUM_SPOT_LIGHT_COORDS > 0
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_SPOT_LIGHT_COORDS; i ++ ) {
		shadowWorldPosition = worldPosition;
		#if ( defined( USE_SHADOWMAP ) && UNROLLED_LOOP_INDEX < NUM_SPOT_LIGHT_SHADOWS )
			shadowWorldPosition.xyz += shadowWorldNormal * spotLightShadows[ i ].shadowNormalBias;
		#endif
		vSpotLightCoord[ i ] = spotLightMatrix[ i ] * shadowWorldPosition;
	}
	#pragma unroll_loop_end
#endif`,kv=`float getShadowMask() {
	float shadow = 1.0;
	#ifdef USE_SHADOWMAP
	#if NUM_DIR_LIGHT_SHADOWS > 0
	DirectionalLightShadow directionalLight;
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_DIR_LIGHT_SHADOWS; i ++ ) {
		directionalLight = directionalLightShadows[ i ];
		shadow *= receiveShadow ? getShadow( directionalShadowMap[ i ], directionalLight.shadowMapSize, directionalLight.shadowIntensity, directionalLight.shadowBias, directionalLight.shadowRadius, vDirectionalShadowCoord[ i ] ) : 1.0;
	}
	#pragma unroll_loop_end
	#endif
	#if NUM_SPOT_LIGHT_SHADOWS > 0
	SpotLightShadow spotLight;
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_SPOT_LIGHT_SHADOWS; i ++ ) {
		spotLight = spotLightShadows[ i ];
		shadow *= receiveShadow ? getShadow( spotShadowMap[ i ], spotLight.shadowMapSize, spotLight.shadowIntensity, spotLight.shadowBias, spotLight.shadowRadius, vSpotLightCoord[ i ] ) : 1.0;
	}
	#pragma unroll_loop_end
	#endif
	#if NUM_POINT_LIGHT_SHADOWS > 0 && ( defined( SHADOWMAP_TYPE_PCF ) || defined( SHADOWMAP_TYPE_BASIC ) )
	PointLightShadow pointLight;
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_POINT_LIGHT_SHADOWS; i ++ ) {
		pointLight = pointLightShadows[ i ];
		shadow *= receiveShadow ? getPointShadow( pointShadowMap[ i ], pointLight.shadowMapSize, pointLight.shadowIntensity, pointLight.shadowBias, pointLight.shadowRadius, vPointShadowCoord[ i ], pointLight.shadowCameraNear, pointLight.shadowCameraFar ) : 1.0;
	}
	#pragma unroll_loop_end
	#endif
	#endif
	return shadow;
}`,Gv=`#ifdef USE_SKINNING
	mat4 boneMatX = getBoneMatrix( skinIndex.x );
	mat4 boneMatY = getBoneMatrix( skinIndex.y );
	mat4 boneMatZ = getBoneMatrix( skinIndex.z );
	mat4 boneMatW = getBoneMatrix( skinIndex.w );
#endif`,zv=`#ifdef USE_SKINNING
	uniform mat4 bindMatrix;
	uniform mat4 bindMatrixInverse;
	uniform highp sampler2D boneTexture;
	mat4 getBoneMatrix( const in float i ) {
		int size = textureSize( boneTexture, 0 ).x;
		int j = int( i ) * 4;
		int x = j % size;
		int y = j / size;
		vec4 v1 = texelFetch( boneTexture, ivec2( x, y ), 0 );
		vec4 v2 = texelFetch( boneTexture, ivec2( x + 1, y ), 0 );
		vec4 v3 = texelFetch( boneTexture, ivec2( x + 2, y ), 0 );
		vec4 v4 = texelFetch( boneTexture, ivec2( x + 3, y ), 0 );
		return mat4( v1, v2, v3, v4 );
	}
#endif`,Hv=`#ifdef USE_SKINNING
	vec4 skinVertex = bindMatrix * vec4( transformed, 1.0 );
	vec4 skinned = vec4( 0.0 );
	skinned += boneMatX * skinVertex * skinWeight.x;
	skinned += boneMatY * skinVertex * skinWeight.y;
	skinned += boneMatZ * skinVertex * skinWeight.z;
	skinned += boneMatW * skinVertex * skinWeight.w;
	transformed = ( bindMatrixInverse * skinned ).xyz;
#endif`,Vv=`#ifdef USE_SKINNING
	mat4 skinMatrix = mat4( 0.0 );
	skinMatrix += skinWeight.x * boneMatX;
	skinMatrix += skinWeight.y * boneMatY;
	skinMatrix += skinWeight.z * boneMatZ;
	skinMatrix += skinWeight.w * boneMatW;
	skinMatrix = bindMatrixInverse * skinMatrix * bindMatrix;
	objectNormal = vec4( skinMatrix * vec4( objectNormal, 0.0 ) ).xyz;
	#ifdef USE_TANGENT
		objectTangent = vec4( skinMatrix * vec4( objectTangent, 0.0 ) ).xyz;
	#endif
#endif`,Wv=`float specularStrength;
#ifdef USE_SPECULARMAP
	vec4 texelSpecular = texture2D( specularMap, vSpecularMapUv );
	specularStrength = texelSpecular.r;
#else
	specularStrength = 1.0;
#endif`,Xv=`#ifdef USE_SPECULARMAP
	uniform sampler2D specularMap;
#endif`,Yv=`#if defined( TONE_MAPPING )
	gl_FragColor.rgb = toneMapping( gl_FragColor.rgb );
#endif`,qv=`#ifndef saturate
#define saturate( a ) clamp( a, 0.0, 1.0 )
#endif
uniform float toneMappingExposure;
vec3 LinearToneMapping( vec3 color ) {
	return saturate( toneMappingExposure * color );
}
vec3 ReinhardToneMapping( vec3 color ) {
	color *= toneMappingExposure;
	return saturate( color / ( vec3( 1.0 ) + color ) );
}
vec3 CineonToneMapping( vec3 color ) {
	color *= toneMappingExposure;
	color = max( vec3( 0.0 ), color - 0.004 );
	return pow( ( color * ( 6.2 * color + 0.5 ) ) / ( color * ( 6.2 * color + 1.7 ) + 0.06 ), vec3( 2.2 ) );
}
vec3 RRTAndODTFit( vec3 v ) {
	vec3 a = v * ( v + 0.0245786 ) - 0.000090537;
	vec3 b = v * ( 0.983729 * v + 0.4329510 ) + 0.238081;
	return a / b;
}
vec3 ACESFilmicToneMapping( vec3 color ) {
	const mat3 ACESInputMat = mat3(
		vec3( 0.59719, 0.07600, 0.02840 ),		vec3( 0.35458, 0.90834, 0.13383 ),
		vec3( 0.04823, 0.01566, 0.83777 )
	);
	const mat3 ACESOutputMat = mat3(
		vec3(  1.60475, -0.10208, -0.00327 ),		vec3( -0.53108,  1.10813, -0.07276 ),
		vec3( -0.07367, -0.00605,  1.07602 )
	);
	color *= toneMappingExposure / 0.6;
	color = ACESInputMat * color;
	color = RRTAndODTFit( color );
	color = ACESOutputMat * color;
	return saturate( color );
}
const mat3 LINEAR_REC2020_TO_LINEAR_SRGB = mat3(
	vec3( 1.6605, - 0.1246, - 0.0182 ),
	vec3( - 0.5876, 1.1329, - 0.1006 ),
	vec3( - 0.0728, - 0.0083, 1.1187 )
);
const mat3 LINEAR_SRGB_TO_LINEAR_REC2020 = mat3(
	vec3( 0.6274, 0.0691, 0.0164 ),
	vec3( 0.3293, 0.9195, 0.0880 ),
	vec3( 0.0433, 0.0113, 0.8956 )
);
vec3 agxDefaultContrastApprox( vec3 x ) {
	vec3 x2 = x * x;
	vec3 x4 = x2 * x2;
	return + 15.5 * x4 * x2
		- 40.14 * x4 * x
		+ 31.96 * x4
		- 6.868 * x2 * x
		+ 0.4298 * x2
		+ 0.1191 * x
		- 0.00232;
}
vec3 AgXToneMapping( vec3 color ) {
	const mat3 AgXInsetMatrix = mat3(
		vec3( 0.856627153315983, 0.137318972929847, 0.11189821299995 ),
		vec3( 0.0951212405381588, 0.761241990602591, 0.0767994186031903 ),
		vec3( 0.0482516061458583, 0.101439036467562, 0.811302368396859 )
	);
	const mat3 AgXOutsetMatrix = mat3(
		vec3( 1.1271005818144368, - 0.1413297634984383, - 0.14132976349843826 ),
		vec3( - 0.11060664309660323, 1.157823702216272, - 0.11060664309660294 ),
		vec3( - 0.016493938717834573, - 0.016493938717834257, 1.2519364065950405 )
	);
	const float AgxMinEv = - 12.47393;	const float AgxMaxEv = 4.026069;
	color *= toneMappingExposure;
	color = LINEAR_SRGB_TO_LINEAR_REC2020 * color;
	color = AgXInsetMatrix * color;
	color = max( color, 1e-10 );	color = log2( color );
	color = ( color - AgxMinEv ) / ( AgxMaxEv - AgxMinEv );
	color = clamp( color, 0.0, 1.0 );
	color = agxDefaultContrastApprox( color );
	color = AgXOutsetMatrix * color;
	color = pow( max( vec3( 0.0 ), color ), vec3( 2.2 ) );
	color = LINEAR_REC2020_TO_LINEAR_SRGB * color;
	color = clamp( color, 0.0, 1.0 );
	return color;
}
vec3 NeutralToneMapping( vec3 color ) {
	const float StartCompression = 0.8 - 0.04;
	const float Desaturation = 0.15;
	color *= toneMappingExposure;
	float x = min( color.r, min( color.g, color.b ) );
	float offset = x < 0.08 ? x - 6.25 * x * x : 0.04;
	color -= offset;
	float peak = max( color.r, max( color.g, color.b ) );
	if ( peak < StartCompression ) return color;
	float d = 1. - StartCompression;
	float newPeak = 1. - d * d / ( peak + d - StartCompression );
	color *= newPeak / peak;
	float g = 1. - 1. / ( Desaturation * ( peak - newPeak ) + 1. );
	return mix( color, vec3( newPeak ), g );
}
vec3 CustomToneMapping( vec3 color ) { return color; }`,Kv=`#ifdef USE_TRANSMISSION
	material.transmission = transmission;
	material.transmissionAlpha = 1.0;
	material.thickness = thickness;
	material.attenuationDistance = attenuationDistance;
	material.attenuationColor = attenuationColor;
	#ifdef USE_TRANSMISSIONMAP
		material.transmission *= texture2D( transmissionMap, vTransmissionMapUv ).r;
	#endif
	#ifdef USE_THICKNESSMAP
		material.thickness *= texture2D( thicknessMap, vThicknessMapUv ).g;
	#endif
	vec3 pos = vWorldPosition;
	vec3 v = normalize( cameraPosition - pos );
	vec3 n = transformNormalByInverseViewMatrix( normal, viewMatrix );
	vec4 transmitted = getIBLVolumeRefraction(
		n, v, material.roughness, material.diffuseContribution, material.specularColorBlended, material.specularF90,
		pos, modelMatrix, viewMatrix, projectionMatrix, material.dispersion, material.ior, material.thickness,
		material.attenuationColor, material.attenuationDistance );
	material.transmissionAlpha = mix( material.transmissionAlpha, transmitted.a, material.transmission );
	totalDiffuse = mix( totalDiffuse, transmitted.rgb, material.transmission );
#endif`,$v=`#ifdef USE_TRANSMISSION
	uniform float transmission;
	uniform float thickness;
	uniform float attenuationDistance;
	uniform vec3 attenuationColor;
	#ifdef USE_TRANSMISSIONMAP
		uniform sampler2D transmissionMap;
	#endif
	#ifdef USE_THICKNESSMAP
		uniform sampler2D thicknessMap;
	#endif
	uniform vec2 transmissionSamplerSize;
	uniform sampler2D transmissionSamplerMap;
	uniform mat4 modelMatrix;
	uniform mat4 projectionMatrix;
	varying vec3 vWorldPosition;
	float w0( float a ) {
		return ( 1.0 / 6.0 ) * ( a * ( a * ( - a + 3.0 ) - 3.0 ) + 1.0 );
	}
	float w1( float a ) {
		return ( 1.0 / 6.0 ) * ( a *  a * ( 3.0 * a - 6.0 ) + 4.0 );
	}
	float w2( float a ){
		return ( 1.0 / 6.0 ) * ( a * ( a * ( - 3.0 * a + 3.0 ) + 3.0 ) + 1.0 );
	}
	float w3( float a ) {
		return ( 1.0 / 6.0 ) * ( a * a * a );
	}
	float g0( float a ) {
		return w0( a ) + w1( a );
	}
	float g1( float a ) {
		return w2( a ) + w3( a );
	}
	float h0( float a ) {
		return - 1.0 + w1( a ) / ( w0( a ) + w1( a ) );
	}
	float h1( float a ) {
		return 1.0 + w3( a ) / ( w2( a ) + w3( a ) );
	}
	vec4 bicubic( sampler2D tex, vec2 uv, vec4 texelSize, float lod ) {
		uv = uv * texelSize.zw + 0.5;
		vec2 iuv = floor( uv );
		vec2 fuv = fract( uv );
		float g0x = g0( fuv.x );
		float g1x = g1( fuv.x );
		float h0x = h0( fuv.x );
		float h1x = h1( fuv.x );
		float h0y = h0( fuv.y );
		float h1y = h1( fuv.y );
		vec2 p0 = ( vec2( iuv.x + h0x, iuv.y + h0y ) - 0.5 ) * texelSize.xy;
		vec2 p1 = ( vec2( iuv.x + h1x, iuv.y + h0y ) - 0.5 ) * texelSize.xy;
		vec2 p2 = ( vec2( iuv.x + h0x, iuv.y + h1y ) - 0.5 ) * texelSize.xy;
		vec2 p3 = ( vec2( iuv.x + h1x, iuv.y + h1y ) - 0.5 ) * texelSize.xy;
		return g0( fuv.y ) * ( g0x * textureLod( tex, p0, lod ) + g1x * textureLod( tex, p1, lod ) ) +
			g1( fuv.y ) * ( g0x * textureLod( tex, p2, lod ) + g1x * textureLod( tex, p3, lod ) );
	}
	vec4 textureBicubic( sampler2D sampler, vec2 uv, float lod ) {
		vec2 fLodSize = vec2( textureSize( sampler, int( lod ) ) );
		vec2 cLodSize = vec2( textureSize( sampler, int( lod + 1.0 ) ) );
		vec2 fLodSizeInv = 1.0 / fLodSize;
		vec2 cLodSizeInv = 1.0 / cLodSize;
		vec4 fSample = bicubic( sampler, uv, vec4( fLodSizeInv, fLodSize ), floor( lod ) );
		vec4 cSample = bicubic( sampler, uv, vec4( cLodSizeInv, cLodSize ), ceil( lod ) );
		return mix( fSample, cSample, fract( lod ) );
	}
	vec3 getVolumeTransmissionRay( const in vec3 n, const in vec3 v, const in float thickness, const in float ior, const in mat4 modelMatrix ) {
		vec3 refractionVector = refract( - v, normalize( n ), 1.0 / ior );
		vec3 modelScale;
		modelScale.x = length( vec3( modelMatrix[ 0 ].xyz ) );
		modelScale.y = length( vec3( modelMatrix[ 1 ].xyz ) );
		modelScale.z = length( vec3( modelMatrix[ 2 ].xyz ) );
		return normalize( refractionVector ) * thickness * modelScale;
	}
	float applyIorToRoughness( const in float roughness, const in float ior ) {
		return roughness * clamp( ior * 2.0 - 2.0, 0.0, 1.0 );
	}
	vec4 getTransmissionSample( const in vec2 fragCoord, const in float roughness, const in float ior ) {
		float lod = log2( transmissionSamplerSize.x ) * applyIorToRoughness( roughness, ior );
		return textureBicubic( transmissionSamplerMap, fragCoord.xy, lod );
	}
	vec3 volumeAttenuation( const in float transmissionDistance, const in vec3 attenuationColor, const in float attenuationDistance ) {
		if ( isinf( attenuationDistance ) ) {
			return vec3( 1.0 );
		} else {
			vec3 attenuationCoefficient = -log( attenuationColor ) / attenuationDistance;
			vec3 transmittance = exp( - attenuationCoefficient * transmissionDistance );			return transmittance;
		}
	}
	vec4 getIBLVolumeRefraction( const in vec3 n, const in vec3 v, const in float roughness, const in vec3 diffuseColor,
		const in vec3 specularColor, const in float specularF90, const in vec3 position, const in mat4 modelMatrix,
		const in mat4 viewMatrix, const in mat4 projMatrix, const in float dispersion, const in float ior, const in float thickness,
		const in vec3 attenuationColor, const in float attenuationDistance ) {
		vec4 transmittedLight;
		vec3 transmittance;
		#ifdef USE_DISPERSION
			float halfSpread = ( ior - 1.0 ) * 0.025 * dispersion;
			vec3 iors = vec3( ior - halfSpread, ior, ior + halfSpread );
			for ( int i = 0; i < 3; i ++ ) {
				vec3 transmissionRay = getVolumeTransmissionRay( n, v, thickness, iors[ i ], modelMatrix );
				vec3 refractedRayExit = position + transmissionRay;
				vec4 ndcPos = projMatrix * viewMatrix * vec4( refractedRayExit, 1.0 );
				vec2 refractionCoords = ndcPos.xy / ndcPos.w;
				refractionCoords += 1.0;
				refractionCoords /= 2.0;
				vec4 transmissionSample = getTransmissionSample( refractionCoords, roughness, iors[ i ] );
				transmittedLight[ i ] = transmissionSample[ i ];
				transmittedLight.a += transmissionSample.a;
				transmittance[ i ] = diffuseColor[ i ] * volumeAttenuation( length( transmissionRay ), attenuationColor, attenuationDistance )[ i ];
			}
			transmittedLight.a /= 3.0;
		#else
			vec3 transmissionRay = getVolumeTransmissionRay( n, v, thickness, ior, modelMatrix );
			vec3 refractedRayExit = position + transmissionRay;
			vec4 ndcPos = projMatrix * viewMatrix * vec4( refractedRayExit, 1.0 );
			vec2 refractionCoords = ndcPos.xy / ndcPos.w;
			refractionCoords += 1.0;
			refractionCoords /= 2.0;
			transmittedLight = getTransmissionSample( refractionCoords, roughness, ior );
			transmittance = diffuseColor * volumeAttenuation( length( transmissionRay ), attenuationColor, attenuationDistance );
		#endif
		vec3 attenuatedColor = transmittance * transmittedLight.rgb;
		vec3 F = EnvironmentBRDF( n, v, specularColor, specularF90, roughness );
		float transmittanceFactor = ( transmittance.r + transmittance.g + transmittance.b ) / 3.0;
		return vec4( ( 1.0 - F ) * attenuatedColor, 1.0 - ( 1.0 - transmittedLight.a ) * transmittanceFactor );
	}
#endif`,Zv=`#if defined( USE_UV ) || defined( USE_ANISOTROPY )
	varying vec2 vUv;
#endif
#ifdef USE_MAP
	varying vec2 vMapUv;
#endif
#ifdef USE_ALPHAMAP
	varying vec2 vAlphaMapUv;
#endif
#ifdef USE_LIGHTMAP
	varying vec2 vLightMapUv;
#endif
#ifdef USE_AOMAP
	varying vec2 vAoMapUv;
#endif
#ifdef USE_BUMPMAP
	varying vec2 vBumpMapUv;
#endif
#ifdef USE_NORMALMAP
	varying vec2 vNormalMapUv;
#endif
#ifdef USE_EMISSIVEMAP
	varying vec2 vEmissiveMapUv;
#endif
#ifdef USE_METALNESSMAP
	varying vec2 vMetalnessMapUv;
#endif
#ifdef USE_ROUGHNESSMAP
	varying vec2 vRoughnessMapUv;
#endif
#ifdef USE_ANISOTROPYMAP
	varying vec2 vAnisotropyMapUv;
#endif
#ifdef USE_CLEARCOATMAP
	varying vec2 vClearcoatMapUv;
#endif
#ifdef USE_CLEARCOAT_NORMALMAP
	varying vec2 vClearcoatNormalMapUv;
#endif
#ifdef USE_CLEARCOAT_ROUGHNESSMAP
	varying vec2 vClearcoatRoughnessMapUv;
#endif
#ifdef USE_IRIDESCENCEMAP
	varying vec2 vIridescenceMapUv;
#endif
#ifdef USE_IRIDESCENCE_THICKNESSMAP
	varying vec2 vIridescenceThicknessMapUv;
#endif
#ifdef USE_SHEEN_COLORMAP
	varying vec2 vSheenColorMapUv;
#endif
#ifdef USE_SHEEN_ROUGHNESSMAP
	varying vec2 vSheenRoughnessMapUv;
#endif
#ifdef USE_SPECULARMAP
	varying vec2 vSpecularMapUv;
#endif
#ifdef USE_SPECULAR_COLORMAP
	varying vec2 vSpecularColorMapUv;
#endif
#ifdef USE_SPECULAR_INTENSITYMAP
	varying vec2 vSpecularIntensityMapUv;
#endif
#ifdef USE_TRANSMISSIONMAP
	uniform mat3 transmissionMapTransform;
	varying vec2 vTransmissionMapUv;
#endif
#ifdef USE_THICKNESSMAP
	uniform mat3 thicknessMapTransform;
	varying vec2 vThicknessMapUv;
#endif`,Jv=`#if defined( USE_UV ) || defined( USE_ANISOTROPY )
	varying vec2 vUv;
#endif
#ifdef USE_MAP
	uniform mat3 mapTransform;
	varying vec2 vMapUv;
#endif
#ifdef USE_ALPHAMAP
	uniform mat3 alphaMapTransform;
	varying vec2 vAlphaMapUv;
#endif
#ifdef USE_LIGHTMAP
	uniform mat3 lightMapTransform;
	varying vec2 vLightMapUv;
#endif
#ifdef USE_AOMAP
	uniform mat3 aoMapTransform;
	varying vec2 vAoMapUv;
#endif
#ifdef USE_BUMPMAP
	uniform mat3 bumpMapTransform;
	varying vec2 vBumpMapUv;
#endif
#ifdef USE_NORMALMAP
	uniform mat3 normalMapTransform;
	varying vec2 vNormalMapUv;
#endif
#ifdef USE_DISPLACEMENTMAP
	uniform mat3 displacementMapTransform;
	varying vec2 vDisplacementMapUv;
#endif
#ifdef USE_EMISSIVEMAP
	uniform mat3 emissiveMapTransform;
	varying vec2 vEmissiveMapUv;
#endif
#ifdef USE_METALNESSMAP
	uniform mat3 metalnessMapTransform;
	varying vec2 vMetalnessMapUv;
#endif
#ifdef USE_ROUGHNESSMAP
	uniform mat3 roughnessMapTransform;
	varying vec2 vRoughnessMapUv;
#endif
#ifdef USE_ANISOTROPYMAP
	uniform mat3 anisotropyMapTransform;
	varying vec2 vAnisotropyMapUv;
#endif
#ifdef USE_CLEARCOATMAP
	uniform mat3 clearcoatMapTransform;
	varying vec2 vClearcoatMapUv;
#endif
#ifdef USE_CLEARCOAT_NORMALMAP
	uniform mat3 clearcoatNormalMapTransform;
	varying vec2 vClearcoatNormalMapUv;
#endif
#ifdef USE_CLEARCOAT_ROUGHNESSMAP
	uniform mat3 clearcoatRoughnessMapTransform;
	varying vec2 vClearcoatRoughnessMapUv;
#endif
#ifdef USE_SHEEN_COLORMAP
	uniform mat3 sheenColorMapTransform;
	varying vec2 vSheenColorMapUv;
#endif
#ifdef USE_SHEEN_ROUGHNESSMAP
	uniform mat3 sheenRoughnessMapTransform;
	varying vec2 vSheenRoughnessMapUv;
#endif
#ifdef USE_IRIDESCENCEMAP
	uniform mat3 iridescenceMapTransform;
	varying vec2 vIridescenceMapUv;
#endif
#ifdef USE_IRIDESCENCE_THICKNESSMAP
	uniform mat3 iridescenceThicknessMapTransform;
	varying vec2 vIridescenceThicknessMapUv;
#endif
#ifdef USE_SPECULARMAP
	uniform mat3 specularMapTransform;
	varying vec2 vSpecularMapUv;
#endif
#ifdef USE_SPECULAR_COLORMAP
	uniform mat3 specularColorMapTransform;
	varying vec2 vSpecularColorMapUv;
#endif
#ifdef USE_SPECULAR_INTENSITYMAP
	uniform mat3 specularIntensityMapTransform;
	varying vec2 vSpecularIntensityMapUv;
#endif
#ifdef USE_TRANSMISSIONMAP
	uniform mat3 transmissionMapTransform;
	varying vec2 vTransmissionMapUv;
#endif
#ifdef USE_THICKNESSMAP
	uniform mat3 thicknessMapTransform;
	varying vec2 vThicknessMapUv;
#endif`,Qv=`#if defined( USE_UV ) || defined( USE_ANISOTROPY )
	vUv = vec3( uv, 1 ).xy;
#endif
#ifdef USE_MAP
	vMapUv = ( mapTransform * vec3( MAP_UV, 1 ) ).xy;
#endif
#ifdef USE_ALPHAMAP
	vAlphaMapUv = ( alphaMapTransform * vec3( ALPHAMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_LIGHTMAP
	vLightMapUv = ( lightMapTransform * vec3( LIGHTMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_AOMAP
	vAoMapUv = ( aoMapTransform * vec3( AOMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_BUMPMAP
	vBumpMapUv = ( bumpMapTransform * vec3( BUMPMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_NORMALMAP
	vNormalMapUv = ( normalMapTransform * vec3( NORMALMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_DISPLACEMENTMAP
	vDisplacementMapUv = ( displacementMapTransform * vec3( DISPLACEMENTMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_EMISSIVEMAP
	vEmissiveMapUv = ( emissiveMapTransform * vec3( EMISSIVEMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_METALNESSMAP
	vMetalnessMapUv = ( metalnessMapTransform * vec3( METALNESSMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_ROUGHNESSMAP
	vRoughnessMapUv = ( roughnessMapTransform * vec3( ROUGHNESSMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_ANISOTROPYMAP
	vAnisotropyMapUv = ( anisotropyMapTransform * vec3( ANISOTROPYMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_CLEARCOATMAP
	vClearcoatMapUv = ( clearcoatMapTransform * vec3( CLEARCOATMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_CLEARCOAT_NORMALMAP
	vClearcoatNormalMapUv = ( clearcoatNormalMapTransform * vec3( CLEARCOAT_NORMALMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_CLEARCOAT_ROUGHNESSMAP
	vClearcoatRoughnessMapUv = ( clearcoatRoughnessMapTransform * vec3( CLEARCOAT_ROUGHNESSMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_IRIDESCENCEMAP
	vIridescenceMapUv = ( iridescenceMapTransform * vec3( IRIDESCENCEMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_IRIDESCENCE_THICKNESSMAP
	vIridescenceThicknessMapUv = ( iridescenceThicknessMapTransform * vec3( IRIDESCENCE_THICKNESSMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_SHEEN_COLORMAP
	vSheenColorMapUv = ( sheenColorMapTransform * vec3( SHEEN_COLORMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_SHEEN_ROUGHNESSMAP
	vSheenRoughnessMapUv = ( sheenRoughnessMapTransform * vec3( SHEEN_ROUGHNESSMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_SPECULARMAP
	vSpecularMapUv = ( specularMapTransform * vec3( SPECULARMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_SPECULAR_COLORMAP
	vSpecularColorMapUv = ( specularColorMapTransform * vec3( SPECULAR_COLORMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_SPECULAR_INTENSITYMAP
	vSpecularIntensityMapUv = ( specularIntensityMapTransform * vec3( SPECULAR_INTENSITYMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_TRANSMISSIONMAP
	vTransmissionMapUv = ( transmissionMapTransform * vec3( TRANSMISSIONMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_THICKNESSMAP
	vThicknessMapUv = ( thicknessMapTransform * vec3( THICKNESSMAP_UV, 1 ) ).xy;
#endif`,jv=`#if defined( USE_ENVMAP ) || defined( DISTANCE ) || defined ( USE_SHADOWMAP ) || defined ( USE_TRANSMISSION ) || NUM_SPOT_LIGHT_COORDS > 0
	vec4 worldPosition = vec4( transformed, 1.0 );
	#ifdef USE_BATCHING
		worldPosition = batchingMatrix * worldPosition;
	#endif
	#ifdef USE_INSTANCING
		worldPosition = instanceMatrix * worldPosition;
	#endif
	worldPosition = modelMatrix * worldPosition;
#endif`;const e_=`varying vec2 vUv;
uniform mat3 uvTransform;
void main() {
	vUv = ( uvTransform * vec3( uv, 1 ) ).xy;
	gl_Position = vec4( position.xy, 1.0, 1.0 );
}`,t_=`uniform sampler2D t2D;
uniform float backgroundIntensity;
varying vec2 vUv;
void main() {
	vec4 texColor = texture2D( t2D, vUv );
	#ifdef DECODE_VIDEO_TEXTURE
		texColor = vec4( mix( pow( texColor.rgb * 0.9478672986 + vec3( 0.0521327014 ), vec3( 2.4 ) ), texColor.rgb * 0.0773993808, vec3( lessThanEqual( texColor.rgb, vec3( 0.04045 ) ) ) ), texColor.w );
	#endif
	texColor.rgb *= backgroundIntensity;
	gl_FragColor = texColor;
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
}`,n_=`varying vec3 vWorldDirection;
#include <common>
void main() {
	vWorldDirection = transformDirection( position, modelMatrix );
	#include <begin_vertex>
	#include <project_vertex>
	gl_Position.z = gl_Position.w;
}`,i_=`#ifdef ENVMAP_TYPE_CUBE
	uniform samplerCube envMap;
#elif defined( ENVMAP_TYPE_CUBE_UV )
	uniform sampler2D envMap;
#endif
uniform float backgroundBlurriness;
uniform float backgroundIntensity;
uniform mat3 backgroundRotation;
varying vec3 vWorldDirection;
#include <cube_uv_reflection_fragment>
void main() {
	#ifdef ENVMAP_TYPE_CUBE
		vec4 texColor = textureCube( envMap, backgroundRotation * vWorldDirection );
	#elif defined( ENVMAP_TYPE_CUBE_UV )
		vec4 texColor = textureCubeUV( envMap, backgroundRotation * vWorldDirection, backgroundBlurriness );
	#else
		vec4 texColor = vec4( 0.0, 0.0, 0.0, 1.0 );
	#endif
	texColor.rgb *= backgroundIntensity;
	gl_FragColor = texColor;
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
}`,s_=`varying vec3 vWorldDirection;
#include <common>
void main() {
	vWorldDirection = transformDirection( position, modelMatrix );
	#include <begin_vertex>
	#include <project_vertex>
	gl_Position.z = gl_Position.w;
}`,r_=`uniform samplerCube tCube;
uniform float tFlip;
uniform float opacity;
varying vec3 vWorldDirection;
void main() {
	vec4 texColor = textureCube( tCube, vec3( tFlip * vWorldDirection.x, vWorldDirection.yz ) );
	gl_FragColor = texColor;
	gl_FragColor.a *= opacity;
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
}`,a_=`#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
varying vec2 vHighPrecisionZW;
void main() {
	#include <uv_vertex>
	#include <batching_vertex>
	#include <skinbase_vertex>
	#include <morphinstance_vertex>
	#ifdef USE_DISPLACEMENTMAP
		#include <beginnormal_vertex>
		#include <morphnormal_vertex>
		#include <skinnormal_vertex>
	#endif
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	vHighPrecisionZW = gl_Position.zw;
}`,o_=`#if DEPTH_PACKING == 3200
	uniform float opacity;
#endif
#include <common>
#include <packing>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
varying vec2 vHighPrecisionZW;
void main() {
	vec4 diffuseColor = vec4( 1.0 );
	#include <clipping_planes_fragment>
	#if DEPTH_PACKING == 3200
		diffuseColor.a = opacity;
	#endif
	#include <map_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <logdepthbuf_fragment>
	#ifdef USE_REVERSED_DEPTH_BUFFER
		float fragCoordZ = vHighPrecisionZW[ 0 ] / vHighPrecisionZW[ 1 ];
	#else
		float fragCoordZ = 0.5 * vHighPrecisionZW[ 0 ] / vHighPrecisionZW[ 1 ] + 0.5;
	#endif
	#if DEPTH_PACKING == 3200
		gl_FragColor = vec4( vec3( 1.0 - fragCoordZ ), opacity );
	#elif DEPTH_PACKING == 3201
		gl_FragColor = packDepthToRGBA( fragCoordZ );
	#elif DEPTH_PACKING == 3202
		gl_FragColor = vec4( packDepthToRGB( fragCoordZ ), 1.0 );
	#elif DEPTH_PACKING == 3203
		gl_FragColor = vec4( packDepthToRG( fragCoordZ ), 0.0, 1.0 );
	#endif
}`,l_=`#define DISTANCE
varying vec3 vWorldPosition;
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <batching_vertex>
	#include <skinbase_vertex>
	#include <morphinstance_vertex>
	#ifdef USE_DISPLACEMENTMAP
		#include <beginnormal_vertex>
		#include <morphnormal_vertex>
		#include <skinnormal_vertex>
	#endif
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <worldpos_vertex>
	#include <clipping_planes_vertex>
	vWorldPosition = worldPosition.xyz;
}`,c_=`#define DISTANCE
uniform vec3 referencePosition;
uniform float nearDistance;
uniform float farDistance;
varying vec3 vWorldPosition;
#include <common>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( 1.0 );
	#include <clipping_planes_fragment>
	#include <map_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	float dist = length( vWorldPosition - referencePosition );
	dist = ( dist - nearDistance ) / ( farDistance - nearDistance );
	dist = saturate( dist );
	gl_FragColor = vec4( dist, 0.0, 0.0, 1.0 );
}`,h_=`varying vec3 vWorldDirection;
#include <common>
void main() {
	vWorldDirection = transformDirection( position, modelMatrix );
	#include <begin_vertex>
	#include <project_vertex>
}`,u_=`uniform sampler2D tEquirect;
varying vec3 vWorldDirection;
#include <common>
void main() {
	vec3 direction = normalize( vWorldDirection );
	vec2 sampleUV = equirectUv( direction );
	gl_FragColor = texture2D( tEquirect, sampleUV );
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
}`,d_=`uniform float scale;
attribute float lineDistance;
varying float vLineDistance;
#include <common>
#include <uv_pars_vertex>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <morphtarget_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	vLineDistance = scale * lineDistance;
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	#include <fog_vertex>
}`,f_=`uniform vec3 diffuse;
uniform float opacity;
uniform float dashSize;
uniform float totalSize;
varying float vLineDistance;
#include <common>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <fog_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	if ( mod( vLineDistance, totalSize ) > dashSize ) {
		discard;
	}
	vec3 outgoingLight = vec3( 0.0 );
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	outgoingLight = diffuseColor.rgb;
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
}`,p_=`#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <envmap_pars_vertex>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <batching_vertex>
	#if defined ( USE_ENVMAP ) || defined ( USE_SKINNING )
		#include <beginnormal_vertex>
		#include <morphnormal_vertex>
		#include <skinbase_vertex>
		#include <skinnormal_vertex>
		#include <defaultnormal_vertex>
	#endif
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	#include <worldpos_vertex>
	#include <envmap_vertex>
	#include <fog_vertex>
}`,m_=`uniform vec3 diffuse;
uniform float opacity;
#ifndef FLAT_SHADED
	varying vec3 vNormal;
#endif
#include <common>
#include <dithering_pars_fragment>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <aomap_pars_fragment>
#include <lightmap_pars_fragment>
#include <envmap_common_pars_fragment>
#include <envmap_pars_fragment>
#include <fog_pars_fragment>
#include <specularmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <specularmap_fragment>
	ReflectedLight reflectedLight = ReflectedLight( vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ) );
	#ifdef USE_LIGHTMAP
		vec4 lightMapTexel = texture2D( lightMap, vLightMapUv );
		reflectedLight.indirectDiffuse += lightMapTexel.rgb * lightMapIntensity * RECIPROCAL_PI;
	#else
		reflectedLight.indirectDiffuse += vec3( 1.0 );
	#endif
	#include <aomap_fragment>
	reflectedLight.indirectDiffuse *= diffuseColor.rgb;
	vec3 outgoingLight = reflectedLight.indirectDiffuse;
	#include <envmap_fragment>
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
	#include <dithering_fragment>
}`,g_=`#define LAMBERT
varying vec3 vViewPosition;
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <envmap_pars_vertex>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <normal_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <shadowmap_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <normal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	vViewPosition = - mvPosition.xyz;
	#include <worldpos_vertex>
	#include <envmap_vertex>
	#include <shadowmap_vertex>
	#include <fog_vertex>
}`,v_=`#define LAMBERT
uniform vec3 diffuse;
uniform vec3 emissive;
uniform float opacity;
#include <common>
#include <dithering_pars_fragment>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <aomap_pars_fragment>
#include <lightmap_pars_fragment>
#include <emissivemap_pars_fragment>
#include <cube_uv_reflection_fragment>
#include <envmap_common_pars_fragment>
#include <envmap_pars_fragment>
#include <envmap_physical_pars_fragment>
#include <fog_pars_fragment>
#include <bsdfs>
#include <lights_pars_begin>
#include <normal_pars_fragment>
#include <lights_lambert_pars_fragment>
#include <shadowmap_pars_fragment>
#include <bumpmap_pars_fragment>
#include <normalmap_pars_fragment>
#include <specularmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	ReflectedLight reflectedLight = ReflectedLight( vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ) );
	vec3 totalEmissiveRadiance = emissive;
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <specularmap_fragment>
	#include <normal_fragment_begin>
	#include <normal_fragment_maps>
	#include <emissivemap_fragment>
	#include <lights_lambert_fragment>
	#include <lights_fragment_begin>
	#include <lights_fragment_maps>
	#include <lights_fragment_end>
	#include <aomap_fragment>
	vec3 outgoingLight = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse + totalEmissiveRadiance;
	#include <envmap_fragment>
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
	#include <dithering_fragment>
}`,__=`#define MATCAP
varying vec3 vViewPosition;
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <color_pars_vertex>
#include <displacementmap_pars_vertex>
#include <fog_pars_vertex>
#include <normal_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <normal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	#include <fog_vertex>
	vViewPosition = - mvPosition.xyz;
}`,x_=`#define MATCAP
uniform vec3 diffuse;
uniform float opacity;
uniform sampler2D matcap;
varying vec3 vViewPosition;
#include <common>
#include <dithering_pars_fragment>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <fog_pars_fragment>
#include <normal_pars_fragment>
#include <bumpmap_pars_fragment>
#include <normalmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <normal_fragment_begin>
	#include <normal_fragment_maps>
	vec3 viewDir = normalize( vViewPosition );
	vec3 x = normalize( vec3( viewDir.z, 0.0, - viewDir.x ) );
	vec3 y = cross( viewDir, x );
	vec2 uv = vec2( dot( x, normal ), dot( y, normal ) ) * 0.495 + 0.5;
	#ifdef USE_MATCAP
		vec4 matcapColor = texture2D( matcap, uv );
	#else
		vec4 matcapColor = vec4( vec3( mix( 0.2, 0.8, uv.y ) ), 1.0 );
	#endif
	vec3 outgoingLight = diffuseColor.rgb * matcapColor.rgb;
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
	#include <dithering_fragment>
}`,S_=`#define NORMAL
#if defined( FLAT_SHADED ) || defined( USE_BUMPMAP ) || defined( USE_NORMALMAP_TANGENTSPACE )
	varying vec3 vViewPosition;
#endif
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <normal_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphinstance_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <normal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
#if defined( FLAT_SHADED ) || defined( USE_BUMPMAP ) || defined( USE_NORMALMAP_TANGENTSPACE )
	vViewPosition = - mvPosition.xyz;
#endif
}`,M_=`#define NORMAL
uniform float opacity;
#if defined( FLAT_SHADED ) || defined( USE_BUMPMAP ) || defined( USE_NORMALMAP_TANGENTSPACE )
	varying vec3 vViewPosition;
#endif
#include <uv_pars_fragment>
#include <normal_pars_fragment>
#include <bumpmap_pars_fragment>
#include <normalmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( 0.0, 0.0, 0.0, opacity );
	#include <clipping_planes_fragment>
	#include <logdepthbuf_fragment>
	#include <normal_fragment_begin>
	#include <normal_fragment_maps>
	gl_FragColor = vec4( normalize( normal ) * 0.5 + 0.5, diffuseColor.a );
	#ifdef OPAQUE
		gl_FragColor.a = 1.0;
	#endif
}`,y_=`#define PHONG
varying vec3 vViewPosition;
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <envmap_pars_vertex>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <normal_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <shadowmap_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphcolor_vertex>
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphinstance_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <normal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	vViewPosition = - mvPosition.xyz;
	#include <worldpos_vertex>
	#include <envmap_vertex>
	#include <shadowmap_vertex>
	#include <fog_vertex>
}`,b_=`#define PHONG
uniform vec3 diffuse;
uniform vec3 emissive;
uniform vec3 specular;
uniform float shininess;
uniform float opacity;
#include <common>
#include <dithering_pars_fragment>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <aomap_pars_fragment>
#include <lightmap_pars_fragment>
#include <emissivemap_pars_fragment>
#include <cube_uv_reflection_fragment>
#include <envmap_common_pars_fragment>
#include <envmap_pars_fragment>
#include <envmap_physical_pars_fragment>
#include <fog_pars_fragment>
#include <bsdfs>
#include <lights_pars_begin>
#include <normal_pars_fragment>
#include <lights_phong_pars_fragment>
#include <shadowmap_pars_fragment>
#include <bumpmap_pars_fragment>
#include <normalmap_pars_fragment>
#include <specularmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	ReflectedLight reflectedLight = ReflectedLight( vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ) );
	vec3 totalEmissiveRadiance = emissive;
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <specularmap_fragment>
	#include <normal_fragment_begin>
	#include <normal_fragment_maps>
	#include <emissivemap_fragment>
	#include <lights_phong_fragment>
	#include <lights_fragment_begin>
	#include <lights_fragment_maps>
	#include <lights_fragment_end>
	#include <aomap_fragment>
	vec3 outgoingLight = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse + reflectedLight.directSpecular + reflectedLight.indirectSpecular + totalEmissiveRadiance;
	#include <envmap_fragment>
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
	#include <dithering_fragment>
}`,E_=`#define STANDARD
varying vec3 vViewPosition;
#ifdef USE_TRANSMISSION
	varying vec3 vWorldPosition;
#endif
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <normal_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <shadowmap_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <normal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	vViewPosition = - mvPosition.xyz;
	#include <worldpos_vertex>
	#include <shadowmap_vertex>
	#include <fog_vertex>
#ifdef USE_TRANSMISSION
	vWorldPosition = worldPosition.xyz;
#endif
}`,T_=`#define STANDARD
#ifdef PHYSICAL
	#define IOR
	#define USE_SPECULAR
#endif
uniform vec3 diffuse;
uniform vec3 emissive;
uniform float roughness;
uniform float metalness;
uniform float opacity;
#ifdef IOR
	uniform float ior;
#endif
#ifdef USE_SPECULAR
	uniform float specularIntensity;
	uniform vec3 specularColor;
	#ifdef USE_SPECULAR_COLORMAP
		uniform sampler2D specularColorMap;
	#endif
	#ifdef USE_SPECULAR_INTENSITYMAP
		uniform sampler2D specularIntensityMap;
	#endif
#endif
#ifdef USE_CLEARCOAT
	uniform float clearcoat;
	uniform float clearcoatRoughness;
#endif
#ifdef USE_DISPERSION
	uniform float dispersion;
#endif
#ifdef USE_IRIDESCENCE
	uniform float iridescence;
	uniform float iridescenceIOR;
	uniform float iridescenceThicknessMinimum;
	uniform float iridescenceThicknessMaximum;
#endif
#ifdef USE_SHEEN
	uniform vec3 sheenColor;
	uniform float sheenRoughness;
	#ifdef USE_SHEEN_COLORMAP
		uniform sampler2D sheenColorMap;
	#endif
	#ifdef USE_SHEEN_ROUGHNESSMAP
		uniform sampler2D sheenRoughnessMap;
	#endif
#endif
#ifdef USE_ANISOTROPY
	uniform vec2 anisotropyVector;
	#ifdef USE_ANISOTROPYMAP
		uniform sampler2D anisotropyMap;
	#endif
#endif
varying vec3 vViewPosition;
#include <common>
#include <dithering_pars_fragment>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <aomap_pars_fragment>
#include <lightmap_pars_fragment>
#include <emissivemap_pars_fragment>
#include <iridescence_fragment>
#include <cube_uv_reflection_fragment>
#include <envmap_common_pars_fragment>
#include <envmap_physical_pars_fragment>
#include <fog_pars_fragment>
#include <lights_pars_begin>
#include <normal_pars_fragment>
#include <lights_physical_pars_fragment>
#include <transmission_pars_fragment>
#include <shadowmap_pars_fragment>
#include <bumpmap_pars_fragment>
#include <normalmap_pars_fragment>
#include <clearcoat_pars_fragment>
#include <iridescence_pars_fragment>
#include <roughnessmap_pars_fragment>
#include <metalnessmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	ReflectedLight reflectedLight = ReflectedLight( vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ) );
	vec3 totalEmissiveRadiance = emissive;
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <roughnessmap_fragment>
	#include <metalnessmap_fragment>
	#include <normal_fragment_begin>
	#include <normal_fragment_maps>
	#include <clearcoat_normal_fragment_begin>
	#include <clearcoat_normal_fragment_maps>
	#include <emissivemap_fragment>
	#include <lights_physical_fragment>
	#include <lights_fragment_begin>
	#include <lights_fragment_maps>
	#include <lights_fragment_end>
	#include <aomap_fragment>
	vec3 totalDiffuse = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse;
	vec3 totalSpecular = reflectedLight.directSpecular + reflectedLight.indirectSpecular;
	#include <transmission_fragment>
	vec3 outgoingLight = totalDiffuse + totalSpecular + totalEmissiveRadiance;
	#ifdef USE_SHEEN
 
		outgoingLight = outgoingLight + sheenSpecularDirect + sheenSpecularIndirect;
 
 	#endif
	#ifdef USE_CLEARCOAT
		float dotNVcc = saturate( dot( geometryClearcoatNormal, geometryViewDir ) );
		vec3 Fcc = F_Schlick( material.clearcoatF0, material.clearcoatF90, dotNVcc );
		outgoingLight = outgoingLight * ( 1.0 - material.clearcoat * Fcc ) + ( clearcoatSpecularDirect + clearcoatSpecularIndirect ) * material.clearcoat;
	#endif
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
	#include <dithering_fragment>
}`,A_=`#define TOON
varying vec3 vViewPosition;
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <normal_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <shadowmap_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <normal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	vViewPosition = - mvPosition.xyz;
	#include <worldpos_vertex>
	#include <shadowmap_vertex>
	#include <fog_vertex>
}`,w_=`#define TOON
uniform vec3 diffuse;
uniform vec3 emissive;
uniform float opacity;
#include <common>
#include <dithering_pars_fragment>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <aomap_pars_fragment>
#include <lightmap_pars_fragment>
#include <emissivemap_pars_fragment>
#include <gradientmap_pars_fragment>
#include <fog_pars_fragment>
#include <bsdfs>
#include <lights_pars_begin>
#include <normal_pars_fragment>
#include <lights_toon_pars_fragment>
#include <shadowmap_pars_fragment>
#include <bumpmap_pars_fragment>
#include <normalmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	ReflectedLight reflectedLight = ReflectedLight( vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ) );
	vec3 totalEmissiveRadiance = emissive;
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <normal_fragment_begin>
	#include <normal_fragment_maps>
	#include <emissivemap_fragment>
	#include <lights_toon_fragment>
	#include <lights_fragment_begin>
	#include <lights_fragment_maps>
	#include <lights_fragment_end>
	#include <aomap_fragment>
	vec3 outgoingLight = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse + totalEmissiveRadiance;
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
	#include <dithering_fragment>
}`,C_=`uniform float size;
uniform float scale;
#include <common>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <morphtarget_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
#ifdef USE_POINTS_UV
	varying vec2 vUv;
	uniform mat3 uvTransform;
#endif
void main() {
	#ifdef USE_POINTS_UV
		vUv = ( uvTransform * vec3( uv, 1 ) ).xy;
	#endif
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <project_vertex>
	gl_PointSize = size;
	#ifdef USE_SIZEATTENUATION
		bool isPerspective = isPerspectiveMatrix( projectionMatrix );
		if ( isPerspective ) gl_PointSize *= ( scale / - mvPosition.z );
	#endif
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	#include <worldpos_vertex>
	#include <fog_vertex>
}`,R_=`uniform vec3 diffuse;
uniform float opacity;
#include <common>
#include <color_pars_fragment>
#include <map_particle_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <fog_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	vec3 outgoingLight = vec3( 0.0 );
	#include <logdepthbuf_fragment>
	#include <map_particle_fragment>
	#include <color_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	outgoingLight = diffuseColor.rgb;
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
}`,P_=`#include <common>
#include <batching_pars_vertex>
#include <fog_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <shadowmap_pars_vertex>
void main() {
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphinstance_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <worldpos_vertex>
	#include <shadowmap_vertex>
	#include <fog_vertex>
}`,I_=`uniform vec3 color;
uniform float opacity;
#include <common>
#include <fog_pars_fragment>
#include <bsdfs>
#include <lights_pars_begin>
#include <logdepthbuf_pars_fragment>
#include <shadowmap_pars_fragment>
#include <shadowmask_pars_fragment>
void main() {
	#include <logdepthbuf_fragment>
	gl_FragColor = vec4( color, opacity * ( 1.0 - getShadowMask() ) );
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
}`,L_=`uniform float rotation;
uniform vec2 center;
#include <common>
#include <uv_pars_vertex>
#include <fog_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	vec4 mvPosition = modelViewMatrix[ 3 ];
	vec2 scale = vec2( length( modelMatrix[ 0 ].xyz ), length( modelMatrix[ 1 ].xyz ) );
	#ifndef USE_SIZEATTENUATION
		bool isPerspective = isPerspectiveMatrix( projectionMatrix );
		if ( isPerspective ) scale *= - mvPosition.z;
	#endif
	vec2 alignedPosition = ( position.xy - ( center - vec2( 0.5 ) ) ) * scale;
	vec2 rotatedPosition;
	rotatedPosition.x = cos( rotation ) * alignedPosition.x - sin( rotation ) * alignedPosition.y;
	rotatedPosition.y = sin( rotation ) * alignedPosition.x + cos( rotation ) * alignedPosition.y;
	mvPosition.xy += rotatedPosition;
	gl_Position = projectionMatrix * mvPosition;
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	#include <fog_vertex>
}`,D_=`uniform vec3 diffuse;
uniform float opacity;
#include <common>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <fog_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	vec3 outgoingLight = vec3( 0.0 );
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	outgoingLight = diffuseColor.rgb;
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
}`,je={alphahash_fragment:eg,alphahash_pars_fragment:tg,alphamap_fragment:ng,alphamap_pars_fragment:ig,alphatest_fragment:sg,alphatest_pars_fragment:rg,aomap_fragment:ag,aomap_pars_fragment:og,batching_pars_vertex:lg,batching_vertex:cg,begin_vertex:hg,beginnormal_vertex:ug,bsdfs:dg,iridescence_fragment:fg,bumpmap_pars_fragment:pg,clipping_planes_fragment:mg,clipping_planes_pars_fragment:gg,clipping_planes_pars_vertex:vg,clipping_planes_vertex:_g,color_fragment:xg,color_pars_fragment:Sg,color_pars_vertex:Mg,color_vertex:yg,common:bg,cube_uv_reflection_fragment:Eg,defaultnormal_vertex:Tg,displacementmap_pars_vertex:Ag,displacementmap_vertex:wg,emissivemap_fragment:Cg,emissivemap_pars_fragment:Rg,colorspace_fragment:Pg,colorspace_pars_fragment:Ig,envmap_fragment:Lg,envmap_common_pars_fragment:Dg,envmap_pars_fragment:Ng,envmap_pars_vertex:Ug,envmap_physical_pars_fragment:Yg,envmap_vertex:Fg,fog_vertex:Og,fog_pars_vertex:Bg,fog_fragment:kg,fog_pars_fragment:Gg,gradientmap_pars_fragment:zg,lightmap_pars_fragment:Hg,lights_lambert_fragment:Vg,lights_lambert_pars_fragment:Wg,lights_pars_begin:Xg,lights_toon_fragment:qg,lights_toon_pars_fragment:Kg,lights_phong_fragment:$g,lights_phong_pars_fragment:Zg,lights_physical_fragment:Jg,lights_physical_pars_fragment:Qg,lights_fragment_begin:jg,lights_fragment_maps:ev,lights_fragment_end:tv,lightprobes_pars_fragment:nv,logdepthbuf_fragment:iv,logdepthbuf_pars_fragment:sv,logdepthbuf_pars_vertex:rv,logdepthbuf_vertex:av,map_fragment:ov,map_pars_fragment:lv,map_particle_fragment:cv,map_particle_pars_fragment:hv,metalnessmap_fragment:uv,metalnessmap_pars_fragment:dv,morphinstance_vertex:fv,morphcolor_vertex:pv,morphnormal_vertex:mv,morphtarget_pars_vertex:gv,morphtarget_vertex:vv,normal_fragment_begin:_v,normal_fragment_maps:xv,normal_pars_fragment:Sv,normal_pars_vertex:Mv,normal_vertex:yv,normalmap_pars_fragment:bv,clearcoat_normal_fragment_begin:Ev,clearcoat_normal_fragment_maps:Tv,clearcoat_pars_fragment:Av,iridescence_pars_fragment:wv,opaque_fragment:Cv,packing:Rv,premultiplied_alpha_fragment:Pv,project_vertex:Iv,dithering_fragment:Lv,dithering_pars_fragment:Dv,roughnessmap_fragment:Nv,roughnessmap_pars_fragment:Uv,shadowmap_pars_fragment:Fv,shadowmap_pars_vertex:Ov,shadowmap_vertex:Bv,shadowmask_pars_fragment:kv,skinbase_vertex:Gv,skinning_pars_vertex:zv,skinning_vertex:Hv,skinnormal_vertex:Vv,specularmap_fragment:Wv,specularmap_pars_fragment:Xv,tonemapping_fragment:Yv,tonemapping_pars_fragment:qv,transmission_fragment:Kv,transmission_pars_fragment:$v,uv_pars_fragment:Zv,uv_pars_vertex:Jv,uv_vertex:Qv,worldpos_vertex:jv,background_vert:e_,background_frag:t_,backgroundCube_vert:n_,backgroundCube_frag:i_,cube_vert:s_,cube_frag:r_,depth_vert:a_,depth_frag:o_,distance_vert:l_,distance_frag:c_,equirect_vert:h_,equirect_frag:u_,linedashed_vert:d_,linedashed_frag:f_,meshbasic_vert:p_,meshbasic_frag:m_,meshlambert_vert:g_,meshlambert_frag:v_,meshmatcap_vert:__,meshmatcap_frag:x_,meshnormal_vert:S_,meshnormal_frag:M_,meshphong_vert:y_,meshphong_frag:b_,meshphysical_vert:E_,meshphysical_frag:T_,meshtoon_vert:A_,meshtoon_frag:w_,points_vert:C_,points_frag:R_,shadow_vert:P_,shadow_frag:I_,sprite_vert:L_,sprite_frag:D_},Pe={common:{diffuse:{value:new Le(16777215)},opacity:{value:1},map:{value:null},mapTransform:{value:new Je},alphaMap:{value:null},alphaMapTransform:{value:new Je},alphaTest:{value:0}},specularmap:{specularMap:{value:null},specularMapTransform:{value:new Je}},envmap:{envMap:{value:null},envMapRotation:{value:new Je},reflectivity:{value:1},ior:{value:1.5},refractionRatio:{value:.98},dfgLUT:{value:null}},aomap:{aoMap:{value:null},aoMapIntensity:{value:1},aoMapTransform:{value:new Je}},lightmap:{lightMap:{value:null},lightMapIntensity:{value:1},lightMapTransform:{value:new Je}},bumpmap:{bumpMap:{value:null},bumpMapTransform:{value:new Je},bumpScale:{value:1}},normalmap:{normalMap:{value:null},normalMapTransform:{value:new Je},normalScale:{value:new fe(1,1)}},displacementmap:{displacementMap:{value:null},displacementMapTransform:{value:new Je},displacementScale:{value:1},displacementBias:{value:0}},emissivemap:{emissiveMap:{value:null},emissiveMapTransform:{value:new Je}},metalnessmap:{metalnessMap:{value:null},metalnessMapTransform:{value:new Je}},roughnessmap:{roughnessMap:{value:null},roughnessMapTransform:{value:new Je}},gradientmap:{gradientMap:{value:null}},fog:{fogDensity:{value:25e-5},fogNear:{value:1},fogFar:{value:2e3},fogColor:{value:new Le(16777215)}},lights:{ambientLightColor:{value:[]},lightProbe:{value:[]},directionalLights:{value:[],properties:{direction:{},color:{}}},directionalLightShadows:{value:[],properties:{shadowIntensity:1,shadowBias:{},shadowNormalBias:{},shadowRadius:{},shadowMapSize:{}}},directionalShadowMatrix:{value:[]},spotLights:{value:[],properties:{color:{},position:{},direction:{},distance:{},coneCos:{},penumbraCos:{},decay:{}}},spotLightShadows:{value:[],properties:{shadowIntensity:1,shadowBias:{},shadowNormalBias:{},shadowRadius:{},shadowMapSize:{}}},spotLightMap:{value:[]},spotLightMatrix:{value:[]},pointLights:{value:[],properties:{color:{},position:{},decay:{},distance:{}}},pointLightShadows:{value:[],properties:{shadowIntensity:1,shadowBias:{},shadowNormalBias:{},shadowRadius:{},shadowMapSize:{},shadowCameraNear:{},shadowCameraFar:{}}},pointShadowMatrix:{value:[]},hemisphereLights:{value:[],properties:{direction:{},skyColor:{},groundColor:{}}},rectAreaLights:{value:[],properties:{color:{},position:{},width:{},height:{}}},ltc_1:{value:null},ltc_2:{value:null},probesSH:{value:null},probesMin:{value:new N},probesMax:{value:new N},probesResolution:{value:new N}},points:{diffuse:{value:new Le(16777215)},opacity:{value:1},size:{value:1},scale:{value:1},map:{value:null},alphaMap:{value:null},alphaMapTransform:{value:new Je},alphaTest:{value:0},uvTransform:{value:new Je}},sprite:{diffuse:{value:new Le(16777215)},opacity:{value:1},center:{value:new fe(.5,.5)},rotation:{value:0},map:{value:null},mapTransform:{value:new Je},alphaMap:{value:null},alphaMapTransform:{value:new Je},alphaTest:{value:0}}},On={basic:{uniforms:Qt([Pe.common,Pe.specularmap,Pe.envmap,Pe.aomap,Pe.lightmap,Pe.fog]),vertexShader:je.meshbasic_vert,fragmentShader:je.meshbasic_frag},lambert:{uniforms:Qt([Pe.common,Pe.specularmap,Pe.envmap,Pe.aomap,Pe.lightmap,Pe.emissivemap,Pe.bumpmap,Pe.normalmap,Pe.displacementmap,Pe.fog,Pe.lights,{emissive:{value:new Le(0)},envMapIntensity:{value:1}}]),vertexShader:je.meshlambert_vert,fragmentShader:je.meshlambert_frag},phong:{uniforms:Qt([Pe.common,Pe.specularmap,Pe.envmap,Pe.aomap,Pe.lightmap,Pe.emissivemap,Pe.bumpmap,Pe.normalmap,Pe.displacementmap,Pe.fog,Pe.lights,{emissive:{value:new Le(0)},specular:{value:new Le(1118481)},shininess:{value:30},envMapIntensity:{value:1}}]),vertexShader:je.meshphong_vert,fragmentShader:je.meshphong_frag},standard:{uniforms:Qt([Pe.common,Pe.envmap,Pe.aomap,Pe.lightmap,Pe.emissivemap,Pe.bumpmap,Pe.normalmap,Pe.displacementmap,Pe.roughnessmap,Pe.metalnessmap,Pe.fog,Pe.lights,{emissive:{value:new Le(0)},roughness:{value:1},metalness:{value:0},envMapIntensity:{value:1}}]),vertexShader:je.meshphysical_vert,fragmentShader:je.meshphysical_frag},toon:{uniforms:Qt([Pe.common,Pe.aomap,Pe.lightmap,Pe.emissivemap,Pe.bumpmap,Pe.normalmap,Pe.displacementmap,Pe.gradientmap,Pe.fog,Pe.lights,{emissive:{value:new Le(0)}}]),vertexShader:je.meshtoon_vert,fragmentShader:je.meshtoon_frag},matcap:{uniforms:Qt([Pe.common,Pe.bumpmap,Pe.normalmap,Pe.displacementmap,Pe.fog,{matcap:{value:null}}]),vertexShader:je.meshmatcap_vert,fragmentShader:je.meshmatcap_frag},points:{uniforms:Qt([Pe.points,Pe.fog]),vertexShader:je.points_vert,fragmentShader:je.points_frag},dashed:{uniforms:Qt([Pe.common,Pe.fog,{scale:{value:1},dashSize:{value:1},totalSize:{value:2}}]),vertexShader:je.linedashed_vert,fragmentShader:je.linedashed_frag},depth:{uniforms:Qt([Pe.common,Pe.displacementmap]),vertexShader:je.depth_vert,fragmentShader:je.depth_frag},normal:{uniforms:Qt([Pe.common,Pe.bumpmap,Pe.normalmap,Pe.displacementmap,{opacity:{value:1}}]),vertexShader:je.meshnormal_vert,fragmentShader:je.meshnormal_frag},sprite:{uniforms:Qt([Pe.sprite,Pe.fog]),vertexShader:je.sprite_vert,fragmentShader:je.sprite_frag},background:{uniforms:{uvTransform:{value:new Je},t2D:{value:null},backgroundIntensity:{value:1}},vertexShader:je.background_vert,fragmentShader:je.background_frag},backgroundCube:{uniforms:{envMap:{value:null},backgroundBlurriness:{value:0},backgroundIntensity:{value:1},backgroundRotation:{value:new Je}},vertexShader:je.backgroundCube_vert,fragmentShader:je.backgroundCube_frag},cube:{uniforms:{tCube:{value:null},tFlip:{value:-1},opacity:{value:1}},vertexShader:je.cube_vert,fragmentShader:je.cube_frag},equirect:{uniforms:{tEquirect:{value:null}},vertexShader:je.equirect_vert,fragmentShader:je.equirect_frag},distance:{uniforms:Qt([Pe.common,Pe.displacementmap,{referencePosition:{value:new N},nearDistance:{value:1},farDistance:{value:1e3}}]),vertexShader:je.distance_vert,fragmentShader:je.distance_frag},shadow:{uniforms:Qt([Pe.lights,Pe.fog,{color:{value:new Le(0)},opacity:{value:1}}]),vertexShader:je.shadow_vert,fragmentShader:je.shadow_frag}};On.physical={uniforms:Qt([On.standard.uniforms,{clearcoat:{value:0},clearcoatMap:{value:null},clearcoatMapTransform:{value:new Je},clearcoatNormalMap:{value:null},clearcoatNormalMapTransform:{value:new Je},clearcoatNormalScale:{value:new fe(1,1)},clearcoatRoughness:{value:0},clearcoatRoughnessMap:{value:null},clearcoatRoughnessMapTransform:{value:new Je},dispersion:{value:0},iridescence:{value:0},iridescenceMap:{value:null},iridescenceMapTransform:{value:new Je},iridescenceIOR:{value:1.3},iridescenceThicknessMinimum:{value:100},iridescenceThicknessMaximum:{value:400},iridescenceThicknessMap:{value:null},iridescenceThicknessMapTransform:{value:new Je},sheen:{value:0},sheenColor:{value:new Le(0)},sheenColorMap:{value:null},sheenColorMapTransform:{value:new Je},sheenRoughness:{value:1},sheenRoughnessMap:{value:null},sheenRoughnessMapTransform:{value:new Je},transmission:{value:0},transmissionMap:{value:null},transmissionMapTransform:{value:new Je},transmissionSamplerSize:{value:new fe},transmissionSamplerMap:{value:null},thickness:{value:0},thicknessMap:{value:null},thicknessMapTransform:{value:new Je},attenuationDistance:{value:0},attenuationColor:{value:new Le(0)},specularColor:{value:new Le(1,1,1)},specularColorMap:{value:null},specularColorMapTransform:{value:new Je},specularIntensity:{value:1},specularIntensityMap:{value:null},specularIntensityMapTransform:{value:new Je},anisotropyVector:{value:new fe},anisotropyMap:{value:null},anisotropyMapTransform:{value:new Je}}]),vertexShader:je.meshphysical_vert,fragmentShader:je.meshphysical_frag};const pa={r:0,b:0,g:0},N_=new ut,$d=new Je;$d.set(-1,0,0,0,1,0,0,0,1);function U_(i,e,t,n,s,r){const a=new Le(0);let o=s===!0?0:1,l,c,h=null,f=0,d=null;function u(y){let E=y.isScene===!0?y.background:null;if(E&&E.isTexture){const M=y.backgroundBlurriness>0;E=e.get(E,M)}return E}function m(y){let E=!1;const M=u(y);M===null?v(a,o):M&&M.isColor&&(v(M,1),E=!0);const T=i.xr.getEnvironmentBlendMode();T==="additive"?t.buffers.color.setClear(0,0,0,1,r):T==="alpha-blend"&&t.buffers.color.setClear(0,0,0,0,r),(i.autoClear||E)&&(t.buffers.depth.setTest(!0),t.buffers.depth.setMask(!0),t.buffers.color.setMask(!0),i.clear(i.autoClearColor,i.autoClearDepth,i.autoClearStencil))}function x(y,E){const M=u(E);M&&(M.isCubeTexture||M.mapping===Ja)?(c===void 0&&(c=new $e(new qn(1,1,1),new $t({name:"BackgroundCubeMaterial",uniforms:Us(On.backgroundCube.uniforms),vertexShader:On.backgroundCube.vertexShader,fragmentShader:On.backgroundCube.fragmentShader,side:en,depthTest:!1,depthWrite:!1,fog:!1,allowOverride:!1})),c.geometry.deleteAttribute("normal"),c.geometry.deleteAttribute("uv"),c.onBeforeRender=function(T,w,R){this.matrixWorld.copyPosition(R.matrixWorld)},Object.defineProperty(c.material,"envMap",{get:function(){return this.uniforms.envMap.value}}),n.update(c)),c.material.uniforms.envMap.value=M,c.material.uniforms.backgroundBlurriness.value=E.backgroundBlurriness,c.material.uniforms.backgroundIntensity.value=E.backgroundIntensity,c.material.uniforms.backgroundRotation.value.setFromMatrix4(N_.makeRotationFromEuler(E.backgroundRotation)).transpose(),M.isCubeTexture&&M.isRenderTargetTexture===!1&&c.material.uniforms.backgroundRotation.value.premultiply($d),c.material.toneMapped=st.getTransfer(M.colorSpace)!==pt,(h!==M||f!==M.version||d!==i.toneMapping)&&(c.material.needsUpdate=!0,h=M,f=M.version,d=i.toneMapping),c.layers.enableAll(),y.unshift(c,c.geometry,c.material,0,0,null)):M&&M.isTexture&&(l===void 0&&(l=new $e(new Sn(2,2),new $t({name:"BackgroundMaterial",uniforms:Us(On.background.uniforms),vertexShader:On.background.vertexShader,fragmentShader:On.background.fragmentShader,side:li,depthTest:!1,depthWrite:!1,fog:!1,allowOverride:!1})),l.geometry.deleteAttribute("normal"),Object.defineProperty(l.material,"map",{get:function(){return this.uniforms.t2D.value}}),n.update(l)),l.material.uniforms.t2D.value=M,l.material.uniforms.backgroundIntensity.value=E.backgroundIntensity,l.material.toneMapped=st.getTransfer(M.colorSpace)!==pt,M.matrixAutoUpdate===!0&&M.updateMatrix(),l.material.uniforms.uvTransform.value.copy(M.matrix),(h!==M||f!==M.version||d!==i.toneMapping)&&(l.material.needsUpdate=!0,h=M,f=M.version,d=i.toneMapping),l.layers.enableAll(),y.unshift(l,l.geometry,l.material,0,0,null))}function v(y,E){y.getRGB(pa,zd(i)),t.buffers.color.setClear(pa.r,pa.g,pa.b,E,r)}function g(){c!==void 0&&(c.geometry.dispose(),c.material.dispose(),c=void 0),l!==void 0&&(l.geometry.dispose(),l.material.dispose(),l=void 0)}return{getClearColor:function(){return a},setClearColor:function(y,E=1){a.set(y),o=E,v(a,o)},getClearAlpha:function(){return o},setClearAlpha:function(y){o=y,v(a,o)},render:m,addToRenderList:x,dispose:g}}function F_(i,e){const t=i.getParameter(i.MAX_VERTEX_ATTRIBS),n={},s=d(null);let r=s,a=!1;function o(L,B,Y,p,C){let D=!1;const U=f(L,p,Y,B);r!==U&&(r=U,c(r.object)),D=u(L,p,Y,C),D&&m(L,p,Y,C),C!==null&&e.update(C,i.ELEMENT_ARRAY_BUFFER),(D||a)&&(a=!1,M(L,B,Y,p),C!==null&&i.bindBuffer(i.ELEMENT_ARRAY_BUFFER,e.get(C).buffer))}function l(){return i.createVertexArray()}function c(L){return i.bindVertexArray(L)}function h(L){return i.deleteVertexArray(L)}function f(L,B,Y,p){const C=p.wireframe===!0;let D=n[B.id];D===void 0&&(D={},n[B.id]=D);const U=L.isInstancedMesh===!0?L.id:0;let O=D[U];O===void 0&&(O={},D[U]=O);let F=O[Y.id];F===void 0&&(F={},O[Y.id]=F);let G=F[C];return G===void 0&&(G=d(l()),F[C]=G),G}function d(L){const B=[],Y=[],p=[];for(let C=0;C<t;C++)B[C]=0,Y[C]=0,p[C]=0;return{geometry:null,program:null,wireframe:!1,newAttributes:B,enabledAttributes:Y,attributeDivisors:p,object:L,attributes:{},index:null}}function u(L,B,Y,p){const C=r.attributes,D=B.attributes;let U=0;const O=Y.getAttributes();for(const F in O)if(O[F].location>=0){const Z=C[F];let ae=D[F];if(ae===void 0&&(F==="instanceMatrix"&&L.instanceMatrix&&(ae=L.instanceMatrix),F==="instanceColor"&&L.instanceColor&&(ae=L.instanceColor)),Z===void 0||Z.attribute!==ae||ae&&Z.data!==ae.data)return!0;U++}return r.attributesNum!==U||r.index!==p}function m(L,B,Y,p){const C={},D=B.attributes;let U=0;const O=Y.getAttributes();for(const F in O)if(O[F].location>=0){let Z=D[F];Z===void 0&&(F==="instanceMatrix"&&L.instanceMatrix&&(Z=L.instanceMatrix),F==="instanceColor"&&L.instanceColor&&(Z=L.instanceColor));const ae={};ae.attribute=Z,Z&&Z.data&&(ae.data=Z.data),C[F]=ae,U++}r.attributes=C,r.attributesNum=U,r.index=p}function x(){const L=r.newAttributes;for(let B=0,Y=L.length;B<Y;B++)L[B]=0}function v(L){g(L,0)}function g(L,B){const Y=r.newAttributes,p=r.enabledAttributes,C=r.attributeDivisors;Y[L]=1,p[L]===0&&(i.enableVertexAttribArray(L),p[L]=1),C[L]!==B&&(i.vertexAttribDivisor(L,B),C[L]=B)}function y(){const L=r.newAttributes,B=r.enabledAttributes;for(let Y=0,p=B.length;Y<p;Y++)B[Y]!==L[Y]&&(i.disableVertexAttribArray(Y),B[Y]=0)}function E(L,B,Y,p,C,D,U){U===!0?i.vertexAttribIPointer(L,B,Y,C,D):i.vertexAttribPointer(L,B,Y,p,C,D)}function M(L,B,Y,p){x();const C=p.attributes,D=Y.getAttributes(),U=B.defaultAttributeValues;for(const O in D){const F=D[O];if(F.location>=0){let G=C[O];if(G===void 0&&(O==="instanceMatrix"&&L.instanceMatrix&&(G=L.instanceMatrix),O==="instanceColor"&&L.instanceColor&&(G=L.instanceColor)),G!==void 0){const Z=G.normalized,ae=G.itemSize,Te=e.get(G);if(Te===void 0)continue;const qe=Te.buffer,Re=Te.type,j=Te.bytesPerElement,pe=Re===i.INT||Re===i.UNSIGNED_INT||G.gpuType===Nc;if(G.isInterleavedBufferAttribute){const de=G.data,De=de.stride,ze=G.offset;if(de.isInstancedInterleavedBuffer){for(let ke=0;ke<F.locationSize;ke++)g(F.location+ke,de.meshPerAttribute);L.isInstancedMesh!==!0&&p._maxInstanceCount===void 0&&(p._maxInstanceCount=de.meshPerAttribute*de.count)}else for(let ke=0;ke<F.locationSize;ke++)v(F.location+ke);i.bindBuffer(i.ARRAY_BUFFER,qe);for(let ke=0;ke<F.locationSize;ke++)E(F.location+ke,ae/F.locationSize,Re,Z,De*j,(ze+ae/F.locationSize*ke)*j,pe)}else{if(G.isInstancedBufferAttribute){for(let de=0;de<F.locationSize;de++)g(F.location+de,G.meshPerAttribute);L.isInstancedMesh!==!0&&p._maxInstanceCount===void 0&&(p._maxInstanceCount=G.meshPerAttribute*G.count)}else for(let de=0;de<F.locationSize;de++)v(F.location+de);i.bindBuffer(i.ARRAY_BUFFER,qe);for(let de=0;de<F.locationSize;de++)E(F.location+de,ae/F.locationSize,Re,Z,ae*j,ae/F.locationSize*de*j,pe)}}else if(U!==void 0){const Z=U[O];if(Z!==void 0)switch(Z.length){case 2:i.vertexAttrib2fv(F.location,Z);break;case 3:i.vertexAttrib3fv(F.location,Z);break;case 4:i.vertexAttrib4fv(F.location,Z);break;default:i.vertexAttrib1fv(F.location,Z)}}}}y()}function T(){b();for(const L in n){const B=n[L];for(const Y in B){const p=B[Y];for(const C in p){const D=p[C];for(const U in D)h(D[U].object),delete D[U];delete p[C]}}delete n[L]}}function w(L){if(n[L.id]===void 0)return;const B=n[L.id];for(const Y in B){const p=B[Y];for(const C in p){const D=p[C];for(const U in D)h(D[U].object),delete D[U];delete p[C]}}delete n[L.id]}function R(L){for(const B in n){const Y=n[B];for(const p in Y){const C=Y[p];if(C[L.id]===void 0)continue;const D=C[L.id];for(const U in D)h(D[U].object),delete D[U];delete C[L.id]}}}function _(L){for(const B in n){const Y=n[B],p=L.isInstancedMesh===!0?L.id:0,C=Y[p];if(C!==void 0){for(const D in C){const U=C[D];for(const O in U)h(U[O].object),delete U[O];delete C[D]}delete Y[p],Object.keys(Y).length===0&&delete n[B]}}}function b(){P(),a=!0,r!==s&&(r=s,c(r.object))}function P(){s.geometry=null,s.program=null,s.wireframe=!1}return{setup:o,reset:b,resetDefaultState:P,dispose:T,releaseStatesOfGeometry:w,releaseStatesOfObject:_,releaseStatesOfProgram:R,initAttributes:x,enableAttribute:v,disableUnusedAttributes:y}}function O_(i,e,t){let n;function s(l){n=l}function r(l,c){i.drawArrays(n,l,c),t.update(c,n,1)}function a(l,c,h){h!==0&&(i.drawArraysInstanced(n,l,c,h),t.update(c,n,h))}function o(l,c,h){if(h===0)return;e.get("WEBGL_multi_draw").multiDrawArraysWEBGL(n,l,0,c,0,h);let d=0;for(let u=0;u<h;u++)d+=c[u];t.update(d,n,1)}this.setMode=s,this.render=r,this.renderInstances=a,this.renderMultiDraw=o}function B_(i,e,t,n){let s;function r(){if(s!==void 0)return s;if(e.has("EXT_texture_filter_anisotropic")===!0){const R=e.get("EXT_texture_filter_anisotropic");s=i.getParameter(R.MAX_TEXTURE_MAX_ANISOTROPY_EXT)}else s=0;return s}function a(R){return!(R!==Ln&&n.convert(R)!==i.getParameter(i.IMPLEMENTATION_COLOR_READ_FORMAT))}function o(R){const _=R===dn&&(e.has("EXT_color_buffer_half_float")||e.has("EXT_color_buffer_float"));return!(R!==un&&n.convert(R)!==i.getParameter(i.IMPLEMENTATION_COLOR_READ_TYPE)&&R!==In&&!_)}function l(R){if(R==="highp"){if(i.getShaderPrecisionFormat(i.VERTEX_SHADER,i.HIGH_FLOAT).precision>0&&i.getShaderPrecisionFormat(i.FRAGMENT_SHADER,i.HIGH_FLOAT).precision>0)return"highp";R="mediump"}return R==="mediump"&&i.getShaderPrecisionFormat(i.VERTEX_SHADER,i.MEDIUM_FLOAT).precision>0&&i.getShaderPrecisionFormat(i.FRAGMENT_SHADER,i.MEDIUM_FLOAT).precision>0?"mediump":"lowp"}let c=t.precision!==void 0?t.precision:"highp";const h=l(c);h!==c&&(Ke("WebGLRenderer:",c,"not supported, using",h,"instead."),c=h);const f=t.logarithmicDepthBuffer===!0,d=t.reversedDepthBuffer===!0&&e.has("EXT_clip_control");t.reversedDepthBuffer===!0&&d===!1&&Ke("WebGLRenderer: Unable to use reversed depth buffer due to missing EXT_clip_control extension. Fallback to default depth buffer.");const u=i.getParameter(i.MAX_TEXTURE_IMAGE_UNITS),m=i.getParameter(i.MAX_VERTEX_TEXTURE_IMAGE_UNITS),x=i.getParameter(i.MAX_TEXTURE_SIZE),v=i.getParameter(i.MAX_CUBE_MAP_TEXTURE_SIZE),g=i.getParameter(i.MAX_VERTEX_ATTRIBS),y=i.getParameter(i.MAX_VERTEX_UNIFORM_VECTORS),E=i.getParameter(i.MAX_VARYING_VECTORS),M=i.getParameter(i.MAX_FRAGMENT_UNIFORM_VECTORS),T=i.getParameter(i.MAX_SAMPLES),w=i.getParameter(i.SAMPLES);return{isWebGL2:!0,getMaxAnisotropy:r,getMaxPrecision:l,textureFormatReadable:a,textureTypeReadable:o,precision:c,logarithmicDepthBuffer:f,reversedDepthBuffer:d,maxTextures:u,maxVertexTextures:m,maxTextureSize:x,maxCubemapSize:v,maxAttributes:g,maxVertexUniforms:y,maxVaryings:E,maxFragmentUniforms:M,maxSamples:T,samples:w}}function k_(i){const e=this;let t=null,n=0,s=!1,r=!1;const a=new Li,o=new Je,l={value:null,needsUpdate:!1};this.uniform=l,this.numPlanes=0,this.numIntersection=0,this.init=function(f,d){const u=f.length!==0||d||n!==0||s;return s=d,n=f.length,u},this.beginShadows=function(){r=!0,h(null)},this.endShadows=function(){r=!1},this.setGlobalState=function(f,d){t=h(f,d,0)},this.setState=function(f,d,u){const m=f.clippingPlanes,x=f.clipIntersection,v=f.clipShadows,g=i.get(f);if(!s||m===null||m.length===0||r&&!v)r?h(null):c();else{const y=r?0:n,E=y*4;let M=g.clippingState||null;l.value=M,M=h(m,d,E,u);for(let T=0;T!==E;++T)M[T]=t[T];g.clippingState=M,this.numIntersection=x?this.numPlanes:0,this.numPlanes+=y}};function c(){l.value!==t&&(l.value=t,l.needsUpdate=n>0),e.numPlanes=n,e.numIntersection=0}function h(f,d,u,m){const x=f!==null?f.length:0;let v=null;if(x!==0){if(v=l.value,m!==!0||v===null){const g=u+x*4,y=d.matrixWorldInverse;o.getNormalMatrix(y),(v===null||v.length<g)&&(v=new Float32Array(g));for(let E=0,M=u;E!==x;++E,M+=4)a.copy(f[E]).applyMatrix4(y,o),a.normal.toArray(v,M),v[M+3]=a.constant}l.value=v,l.needsUpdate=!0}return e.numPlanes=x,e.numIntersection=0,v}}const bi=4,uu=[.125,.215,.35,.446,.526,.582],Ni=20,G_=256,rr=new eh,du=new Le;let Yo=null,qo=0,Ko=0,$o=!1;const z_=new N;class rc{constructor(e){this._renderer=e,this._pingPongRenderTarget=null,this._lodMax=0,this._cubeSize=0,this._sizeLods=[],this._sigmas=[],this._lodMeshes=[],this._backgroundBox=null,this._cubemapMaterial=null,this._equirectMaterial=null,this._blurMaterial=null,this._ggxMaterial=null}fromScene(e,t=0,n=.1,s=100,r={}){const{size:a=256,position:o=z_}=r;Yo=this._renderer.getRenderTarget(),qo=this._renderer.getActiveCubeFace(),Ko=this._renderer.getActiveMipmapLevel(),$o=this._renderer.xr.enabled,this._renderer.xr.enabled=!1,this._setSize(a);const l=this._allocateTargets();return l.depthBuffer=!0,this._sceneToCubeUV(e,n,s,l,o),t>0&&this._blur(l,0,0,t),this._applyPMREM(l),this._cleanup(l),l}fromEquirectangular(e,t=null){return this._fromTexture(e,t)}fromCubemap(e,t=null){return this._fromTexture(e,t)}compileCubemapShader(){this._cubemapMaterial===null&&(this._cubemapMaterial=mu(),this._compileMaterial(this._cubemapMaterial))}compileEquirectangularShader(){this._equirectMaterial===null&&(this._equirectMaterial=pu(),this._compileMaterial(this._equirectMaterial))}dispose(){this._dispose(),this._cubemapMaterial!==null&&this._cubemapMaterial.dispose(),this._equirectMaterial!==null&&this._equirectMaterial.dispose(),this._backgroundBox!==null&&(this._backgroundBox.geometry.dispose(),this._backgroundBox.material.dispose())}_setSize(e){this._lodMax=Math.floor(Math.log2(e)),this._cubeSize=Math.pow(2,this._lodMax)}_dispose(){this._blurMaterial!==null&&this._blurMaterial.dispose(),this._ggxMaterial!==null&&this._ggxMaterial.dispose(),this._pingPongRenderTarget!==null&&this._pingPongRenderTarget.dispose();for(let e=0;e<this._lodMeshes.length;e++)this._lodMeshes[e].geometry.dispose()}_cleanup(e){this._renderer.setRenderTarget(Yo,qo,Ko),this._renderer.xr.enabled=$o,e.scissorTest=!1,Ms(e,0,0,e.width,e.height)}_fromTexture(e,t){e.mapping===Hi||e.mapping===Is?this._setSize(e.image.length===0?16:e.image[0].width||e.image[0].image.width):this._setSize(e.image.width/4),Yo=this._renderer.getRenderTarget(),qo=this._renderer.getActiveCubeFace(),Ko=this._renderer.getActiveMipmapLevel(),$o=this._renderer.xr.enabled,this._renderer.xr.enabled=!1;const n=t||this._allocateTargets();return this._textureToCubeUV(e,n),this._applyPMREM(n),this._cleanup(n),n}_allocateTargets(){const e=3*Math.max(this._cubeSize,112),t=4*this._cubeSize,n={magFilter:Ft,minFilter:Ft,generateMipmaps:!1,type:dn,format:Ln,colorSpace:Oa,depthBuffer:!1},s=fu(e,t,n);if(this._pingPongRenderTarget===null||this._pingPongRenderTarget.width!==e||this._pingPongRenderTarget.height!==t){this._pingPongRenderTarget!==null&&this._dispose(),this._pingPongRenderTarget=fu(e,t,n);const{_lodMax:r}=this;({lodMeshes:this._lodMeshes,sizeLods:this._sizeLods,sigmas:this._sigmas}=H_(r)),this._blurMaterial=W_(r,e,t),this._ggxMaterial=V_(r,e,t)}return s}_compileMaterial(e){const t=new $e(new It,e);this._renderer.compile(t,rr)}_sceneToCubeUV(e,t,n,s,r){const l=new tn(90,1,t,n),c=[1,-1,1,1,1,1],h=[1,1,1,-1,-1,-1],f=this._renderer,d=f.autoClear,u=f.toneMapping;f.getClearColor(du),f.toneMapping=zn,f.autoClear=!1,f.state.buffers.depth.getReversed()&&(f.setRenderTarget(s),f.clearDepth(),f.setRenderTarget(null)),this._backgroundBox===null&&(this._backgroundBox=new $e(new qn,new oi({name:"PMREM.Background",side:en,depthWrite:!1,depthTest:!1})));const x=this._backgroundBox,v=x.material;let g=!1;const y=e.background;y?y.isColor&&(v.color.copy(y),e.background=null,g=!0):(v.color.copy(du),g=!0);for(let E=0;E<6;E++){const M=E%3;M===0?(l.up.set(0,c[E],0),l.position.set(r.x,r.y,r.z),l.lookAt(r.x+h[E],r.y,r.z)):M===1?(l.up.set(0,0,c[E]),l.position.set(r.x,r.y,r.z),l.lookAt(r.x,r.y+h[E],r.z)):(l.up.set(0,c[E],0),l.position.set(r.x,r.y,r.z),l.lookAt(r.x,r.y,r.z+h[E]));const T=this._cubeSize;Ms(s,M*T,E>2?T:0,T,T),f.setRenderTarget(s),g&&f.render(x,l),f.render(e,l)}f.toneMapping=u,f.autoClear=d,e.background=y}_textureToCubeUV(e,t){const n=this._renderer,s=e.mapping===Hi||e.mapping===Is;s?(this._cubemapMaterial===null&&(this._cubemapMaterial=mu()),this._cubemapMaterial.uniforms.flipEnvMap.value=e.isRenderTargetTexture===!1?-1:1):this._equirectMaterial===null&&(this._equirectMaterial=pu());const r=s?this._cubemapMaterial:this._equirectMaterial,a=this._lodMeshes[0];a.material=r;const o=r.uniforms;o.envMap.value=e;const l=this._cubeSize;Ms(t,0,0,3*l,2*l),n.setRenderTarget(t),n.render(a,rr)}_applyPMREM(e){const t=this._renderer,n=t.autoClear;t.autoClear=!1;const s=this._lodMeshes.length;for(let r=1;r<s;r++)this._applyGGXFilter(e,r-1,r);t.autoClear=n}_applyGGXFilter(e,t,n){const s=this._renderer,r=this._pingPongRenderTarget,a=this._ggxMaterial,o=this._lodMeshes[n];o.material=a;const l=a.uniforms,c=n/(this._lodMeshes.length-1),h=t/(this._lodMeshes.length-1),f=Math.sqrt(c*c-h*h),d=0+c*1.25,u=f*d,{_lodMax:m}=this,x=this._sizeLods[n],v=3*x*(n>m-bi?n-m+bi:0),g=4*(this._cubeSize-x);l.envMap.value=e.texture,l.roughness.value=u,l.mipInt.value=m-t,Ms(r,v,g,3*x,2*x),s.setRenderTarget(r),s.render(o,rr),l.envMap.value=r.texture,l.roughness.value=0,l.mipInt.value=m-n,Ms(e,v,g,3*x,2*x),s.setRenderTarget(e),s.render(o,rr)}_blur(e,t,n,s,r){const a=this._pingPongRenderTarget;this._halfBlur(e,a,t,n,s,"latitudinal",r),this._halfBlur(a,e,n,n,s,"longitudinal",r)}_halfBlur(e,t,n,s,r,a,o){const l=this._renderer,c=this._blurMaterial;a!=="latitudinal"&&a!=="longitudinal"&&at("blur direction must be either latitudinal or longitudinal!");const h=3,f=this._lodMeshes[s];f.material=c;const d=c.uniforms,u=this._sizeLods[n]-1,m=isFinite(r)?Math.PI/(2*u):2*Math.PI/(2*Ni-1),x=r/m,v=isFinite(r)?1+Math.floor(h*x):Ni;v>Ni&&Ke(`sigmaRadians, ${r}, is too large and will clip, as it requested ${v} samples when the maximum is set to ${Ni}`);const g=[];let y=0;for(let R=0;R<Ni;++R){const _=R/x,b=Math.exp(-_*_/2);g.push(b),R===0?y+=b:R<v&&(y+=2*b)}for(let R=0;R<g.length;R++)g[R]=g[R]/y;d.envMap.value=e.texture,d.samples.value=v,d.weights.value=g,d.latitudinal.value=a==="latitudinal",o&&(d.poleAxis.value=o);const{_lodMax:E}=this;d.dTheta.value=m,d.mipInt.value=E-n;const M=this._sizeLods[s],T=3*M*(s>E-bi?s-E+bi:0),w=4*(this._cubeSize-M);Ms(t,T,w,3*M,2*M),l.setRenderTarget(t),l.render(f,rr)}}function H_(i){const e=[],t=[],n=[];let s=i;const r=i-bi+1+uu.length;for(let a=0;a<r;a++){const o=Math.pow(2,s);e.push(o);let l=1/o;a>i-bi?l=uu[a-i+bi-1]:a===0&&(l=0),t.push(l);const c=1/(o-2),h=-c,f=1+c,d=[h,h,f,h,f,f,h,h,f,f,h,f],u=6,m=6,x=3,v=2,g=1,y=new Float32Array(x*m*u),E=new Float32Array(v*m*u),M=new Float32Array(g*m*u);for(let w=0;w<u;w++){const R=w%3*2/3-1,_=w>2?0:-1,b=[R,_,0,R+2/3,_,0,R+2/3,_+1,0,R,_,0,R+2/3,_+1,0,R,_+1,0];y.set(b,x*m*w),E.set(d,v*m*w);const P=[w,w,w,w,w,w];M.set(P,g*m*w)}const T=new It;T.setAttribute("position",new Gt(y,x)),T.setAttribute("uv",new Gt(E,v)),T.setAttribute("faceIndex",new Gt(M,g)),n.push(new $e(T,null)),s>bi&&s--}return{lodMeshes:n,sizeLods:e,sigmas:t}}function fu(i,e,t){const n=new nn(i,e,t);return n.texture.mapping=Ja,n.texture.name="PMREM.cubeUv",n.scissorTest=!0,n}function Ms(i,e,t,n,s){i.viewport.set(e,t,n,s),i.scissor.set(e,t,n,s)}function V_(i,e,t){return new $t({name:"PMREMGGXConvolution",defines:{GGX_SAMPLES:G_,CUBEUV_TEXEL_WIDTH:1/e,CUBEUV_TEXEL_HEIGHT:1/t,CUBEUV_MAX_MIP:`${i}.0`},uniforms:{envMap:{value:null},roughness:{value:0},mipInt:{value:0}},vertexShader:eo(),fragmentShader:`

			precision highp float;
			precision highp int;

			varying vec3 vOutputDirection;

			uniform sampler2D envMap;
			uniform float roughness;
			uniform float mipInt;

			#define ENVMAP_TYPE_CUBE_UV
			#include <cube_uv_reflection_fragment>

			#define PI 3.14159265359

			// Van der Corput radical inverse
			float radicalInverse_VdC(uint bits) {
				bits = (bits << 16u) | (bits >> 16u);
				bits = ((bits & 0x55555555u) << 1u) | ((bits & 0xAAAAAAAAu) >> 1u);
				bits = ((bits & 0x33333333u) << 2u) | ((bits & 0xCCCCCCCCu) >> 2u);
				bits = ((bits & 0x0F0F0F0Fu) << 4u) | ((bits & 0xF0F0F0F0u) >> 4u);
				bits = ((bits & 0x00FF00FFu) << 8u) | ((bits & 0xFF00FF00u) >> 8u);
				return float(bits) * 2.3283064365386963e-10; // / 0x100000000
			}

			// Hammersley sequence
			vec2 hammersley(uint i, uint N) {
				return vec2(float(i) / float(N), radicalInverse_VdC(i));
			}

			// GGX VNDF importance sampling (Eric Heitz 2018)
			// "Sampling the GGX Distribution of Visible Normals"
			// https://jcgt.org/published/0007/04/01/
			vec3 importanceSampleGGX_VNDF(vec2 Xi, vec3 V, float roughness) {
				float alpha = roughness * roughness;

				// Section 4.1: Orthonormal basis
				vec3 T1 = vec3(1.0, 0.0, 0.0);
				vec3 T2 = cross(V, T1);

				// Section 4.2: Parameterization of projected area
				float r = sqrt(Xi.x);
				float phi = 2.0 * PI * Xi.y;
				float t1 = r * cos(phi);
				float t2 = r * sin(phi);
				float s = 0.5 * (1.0 + V.z);
				t2 = (1.0 - s) * sqrt(1.0 - t1 * t1) + s * t2;

				// Section 4.3: Reprojection onto hemisphere
				vec3 Nh = t1 * T1 + t2 * T2 + sqrt(max(0.0, 1.0 - t1 * t1 - t2 * t2)) * V;

				// Section 3.4: Transform back to ellipsoid configuration
				return normalize(vec3(alpha * Nh.x, alpha * Nh.y, max(0.0, Nh.z)));
			}

			void main() {
				vec3 N = normalize(vOutputDirection);
				vec3 V = N; // Assume view direction equals normal for pre-filtering

				vec3 prefilteredColor = vec3(0.0);
				float totalWeight = 0.0;

				// For very low roughness, just sample the environment directly
				if (roughness < 0.001) {
					gl_FragColor = vec4(bilinearCubeUV(envMap, N, mipInt), 1.0);
					return;
				}

				// Tangent space basis for VNDF sampling
				vec3 up = abs(N.z) < 0.999 ? vec3(0.0, 0.0, 1.0) : vec3(1.0, 0.0, 0.0);
				vec3 tangent = normalize(cross(up, N));
				vec3 bitangent = cross(N, tangent);

				for(uint i = 0u; i < uint(GGX_SAMPLES); i++) {
					vec2 Xi = hammersley(i, uint(GGX_SAMPLES));

					// For PMREM, V = N, so in tangent space V is always (0, 0, 1)
					vec3 H_tangent = importanceSampleGGX_VNDF(Xi, vec3(0.0, 0.0, 1.0), roughness);

					// Transform H back to world space
					vec3 H = normalize(tangent * H_tangent.x + bitangent * H_tangent.y + N * H_tangent.z);
					vec3 L = normalize(2.0 * dot(V, H) * H - V);

					float NdotL = max(dot(N, L), 0.0);

					if(NdotL > 0.0) {
						// Sample environment at fixed mip level
						// VNDF importance sampling handles the distribution filtering
						vec3 sampleColor = bilinearCubeUV(envMap, L, mipInt);

						// Weight by NdotL for the split-sum approximation
						// VNDF PDF naturally accounts for the visible microfacet distribution
						prefilteredColor += sampleColor * NdotL;
						totalWeight += NdotL;
					}
				}

				if (totalWeight > 0.0) {
					prefilteredColor = prefilteredColor / totalWeight;
				}

				gl_FragColor = vec4(prefilteredColor, 1.0);
			}
		`,blending:Gn,depthTest:!1,depthWrite:!1})}function W_(i,e,t){const n=new Float32Array(Ni),s=new N(0,1,0);return new $t({name:"SphericalGaussianBlur",defines:{n:Ni,CUBEUV_TEXEL_WIDTH:1/e,CUBEUV_TEXEL_HEIGHT:1/t,CUBEUV_MAX_MIP:`${i}.0`},uniforms:{envMap:{value:null},samples:{value:1},weights:{value:n},latitudinal:{value:!1},dTheta:{value:0},mipInt:{value:0},poleAxis:{value:s}},vertexShader:eo(),fragmentShader:`

			precision mediump float;
			precision mediump int;

			varying vec3 vOutputDirection;

			uniform sampler2D envMap;
			uniform int samples;
			uniform float weights[ n ];
			uniform bool latitudinal;
			uniform float dTheta;
			uniform float mipInt;
			uniform vec3 poleAxis;

			#define ENVMAP_TYPE_CUBE_UV
			#include <cube_uv_reflection_fragment>

			vec3 getSample( float theta, vec3 axis ) {

				float cosTheta = cos( theta );
				// Rodrigues' axis-angle rotation
				vec3 sampleDirection = vOutputDirection * cosTheta
					+ cross( axis, vOutputDirection ) * sin( theta )
					+ axis * dot( axis, vOutputDirection ) * ( 1.0 - cosTheta );

				return bilinearCubeUV( envMap, sampleDirection, mipInt );

			}

			void main() {

				vec3 axis = latitudinal ? poleAxis : cross( poleAxis, vOutputDirection );

				if ( all( equal( axis, vec3( 0.0 ) ) ) ) {

					axis = vec3( vOutputDirection.z, 0.0, - vOutputDirection.x );

				}

				axis = normalize( axis );

				gl_FragColor = vec4( 0.0, 0.0, 0.0, 1.0 );
				gl_FragColor.rgb += weights[ 0 ] * getSample( 0.0, axis );

				for ( int i = 1; i < n; i++ ) {

					if ( i >= samples ) {

						break;

					}

					float theta = dTheta * float( i );
					gl_FragColor.rgb += weights[ i ] * getSample( -1.0 * theta, axis );
					gl_FragColor.rgb += weights[ i ] * getSample( theta, axis );

				}

			}
		`,blending:Gn,depthTest:!1,depthWrite:!1})}function pu(){return new $t({name:"EquirectangularToCubeUV",uniforms:{envMap:{value:null}},vertexShader:eo(),fragmentShader:`

			precision mediump float;
			precision mediump int;

			varying vec3 vOutputDirection;

			uniform sampler2D envMap;

			#include <common>

			void main() {

				vec3 outputDirection = normalize( vOutputDirection );
				vec2 uv = equirectUv( outputDirection );

				gl_FragColor = vec4( texture2D ( envMap, uv ).rgb, 1.0 );

			}
		`,blending:Gn,depthTest:!1,depthWrite:!1})}function mu(){return new $t({name:"CubemapToCubeUV",uniforms:{envMap:{value:null},flipEnvMap:{value:-1}},vertexShader:eo(),fragmentShader:`

			precision mediump float;
			precision mediump int;

			uniform float flipEnvMap;

			varying vec3 vOutputDirection;

			uniform samplerCube envMap;

			void main() {

				gl_FragColor = textureCube( envMap, vec3( flipEnvMap * vOutputDirection.x, vOutputDirection.yz ) );

			}
		`,blending:Gn,depthTest:!1,depthWrite:!1})}function eo(){return`

		precision mediump float;
		precision mediump int;

		attribute float faceIndex;

		varying vec3 vOutputDirection;

		// RH coordinate system; PMREM face-indexing convention
		vec3 getDirection( vec2 uv, float face ) {

			uv = 2.0 * uv - 1.0;

			vec3 direction = vec3( uv, 1.0 );

			if ( face == 0.0 ) {

				direction = direction.zyx; // ( 1, v, u ) pos x

			} else if ( face == 1.0 ) {

				direction = direction.xzy;
				direction.xz *= -1.0; // ( -u, 1, -v ) pos y

			} else if ( face == 2.0 ) {

				direction.x *= -1.0; // ( -u, v, 1 ) pos z

			} else if ( face == 3.0 ) {

				direction = direction.zyx;
				direction.xz *= -1.0; // ( -1, v, -u ) neg x

			} else if ( face == 4.0 ) {

				direction = direction.xzy;
				direction.xy *= -1.0; // ( -u, -1, v ) neg y

			} else if ( face == 5.0 ) {

				direction.z *= -1.0; // ( u, v, -1 ) neg z

			}

			return direction;

		}

		void main() {

			vOutputDirection = getDirection( uv, faceIndex );
			gl_Position = vec4( position, 1.0 );

		}
	`}class Zd extends nn{constructor(e=1,t={}){super(e,e,t),this.isWebGLCubeRenderTarget=!0;const n={width:e,height:e,depth:1},s=[n,n,n,n,n,n];this.texture=new Pd(s),this._setTextureOptions(t),this.texture.isRenderTargetTexture=!0}fromEquirectangularTexture(e,t){this.texture.type=t.type,this.texture.colorSpace=t.colorSpace,this.texture.generateMipmaps=t.generateMipmaps,this.texture.minFilter=t.minFilter,this.texture.magFilter=t.magFilter;const n={uniforms:{tEquirect:{value:null}},vertexShader:`

				varying vec3 vWorldDirection;

				vec3 transformDirection( in vec3 dir, in mat4 matrix ) {

					return normalize( ( matrix * vec4( dir, 0.0 ) ).xyz );

				}

				void main() {

					vWorldDirection = transformDirection( position, modelMatrix );

					#include <begin_vertex>
					#include <project_vertex>

				}
			`,fragmentShader:`

				uniform sampler2D tEquirect;

				varying vec3 vWorldDirection;

				#include <common>

				void main() {

					vec3 direction = normalize( vWorldDirection );

					vec2 sampleUV = equirectUv( direction );

					gl_FragColor = texture2D( tEquirect, sampleUV );

				}
			`},s=new qn(5,5,5),r=new $t({name:"CubemapFromEquirect",uniforms:Us(n.uniforms),vertexShader:n.vertexShader,fragmentShader:n.fragmentShader,side:en,blending:Gn});r.uniforms.tEquirect.value=t;const a=new $e(s,r),o=t.minFilter;return t.minFilter===ri&&(t.minFilter=Ft),new K0(1,10,this).update(e,a),t.minFilter=o,a.geometry.dispose(),a.material.dispose(),this}clear(e,t=!0,n=!0,s=!0){const r=e.getRenderTarget();for(let a=0;a<6;a++)e.setRenderTarget(this,a),e.clear(t,n,s);e.setRenderTarget(r)}}function X_(i){let e=new WeakMap,t=new WeakMap,n=null;function s(d,u=!1){return d==null?null:u?a(d):r(d)}function r(d){if(d&&d.isTexture){const u=d.mapping;if(u===mo||u===go)if(e.has(d)){const m=e.get(d).texture;return o(m,d.mapping)}else{const m=d.image;if(m&&m.height>0){const x=new Zd(m.height);return x.fromEquirectangularTexture(i,d),e.set(d,x),d.addEventListener("dispose",c),o(x.texture,d.mapping)}else return null}}return d}function a(d){if(d&&d.isTexture){const u=d.mapping,m=u===mo||u===go,x=u===Hi||u===Is;if(m||x){let v=t.get(d);const g=v!==void 0?v.texture.pmremVersion:0;if(d.isRenderTargetTexture&&d.pmremVersion!==g)return n===null&&(n=new rc(i)),v=m?n.fromEquirectangular(d,v):n.fromCubemap(d,v),v.texture.pmremVersion=d.pmremVersion,t.set(d,v),v.texture;if(v!==void 0)return v.texture;{const y=d.image;return m&&y&&y.height>0||x&&y&&l(y)?(n===null&&(n=new rc(i)),v=m?n.fromEquirectangular(d):n.fromCubemap(d),v.texture.pmremVersion=d.pmremVersion,t.set(d,v),d.addEventListener("dispose",h),v.texture):null}}}return d}function o(d,u){return u===mo?d.mapping=Hi:u===go&&(d.mapping=Is),d}function l(d){let u=0;const m=6;for(let x=0;x<m;x++)d[x]!==void 0&&u++;return u===m}function c(d){const u=d.target;u.removeEventListener("dispose",c);const m=e.get(u);m!==void 0&&(e.delete(u),m.dispose())}function h(d){const u=d.target;u.removeEventListener("dispose",h);const m=t.get(u);m!==void 0&&(t.delete(u),m.dispose())}function f(){e=new WeakMap,t=new WeakMap,n!==null&&(n.dispose(),n=null)}return{get:s,dispose:f}}function Y_(i){const e={};function t(n){if(e[n]!==void 0)return e[n];const s=i.getExtension(n);return e[n]=s,s}return{has:function(n){return t(n)!==null},init:function(){t("EXT_color_buffer_float"),t("WEBGL_clip_cull_distance"),t("OES_texture_float_linear"),t("EXT_color_buffer_half_float"),t("WEBGL_multisampled_render_to_texture"),t("WEBGL_render_shared_exponent")},get:function(n){const s=t(n);return s===null&&Cs("WebGLRenderer: "+n+" extension not supported."),s}}}function q_(i,e,t,n){const s={},r=new WeakMap;function a(f){const d=f.target;d.index!==null&&e.remove(d.index);for(const m in d.attributes)e.remove(d.attributes[m]);d.removeEventListener("dispose",a),delete s[d.id];const u=r.get(d);u&&(e.remove(u),r.delete(d)),n.releaseStatesOfGeometry(d),d.isInstancedBufferGeometry===!0&&delete d._maxInstanceCount,t.memory.geometries--}function o(f,d){return s[d.id]===!0||(d.addEventListener("dispose",a),s[d.id]=!0,t.memory.geometries++),d}function l(f){const d=f.attributes;for(const u in d)e.update(d[u],i.ARRAY_BUFFER)}function c(f){const d=[],u=f.index,m=f.attributes.position;let x=0;if(m===void 0)return;if(u!==null){const y=u.array;x=u.version;for(let E=0,M=y.length;E<M;E+=3){const T=y[E+0],w=y[E+1],R=y[E+2];d.push(T,w,w,R,R,T)}}else{const y=m.array;x=m.version;for(let E=0,M=y.length/3-1;E<M;E+=3){const T=E+0,w=E+1,R=E+2;d.push(T,w,w,R,R,T)}}const v=new(m.count>=65535?Ed:bd)(d,1);v.version=x;const g=r.get(f);g&&e.remove(g),r.set(f,v)}function h(f){const d=r.get(f);if(d){const u=f.index;u!==null&&d.version<u.version&&c(f)}else c(f);return r.get(f)}return{get:o,update:l,getWireframeAttribute:h}}function K_(i,e,t){let n;function s(f){n=f}let r,a;function o(f){r=f.type,a=f.bytesPerElement}function l(f,d){i.drawElements(n,d,r,f*a),t.update(d,n,1)}function c(f,d,u){u!==0&&(i.drawElementsInstanced(n,d,r,f*a,u),t.update(d,n,u))}function h(f,d,u){if(u===0)return;e.get("WEBGL_multi_draw").multiDrawElementsWEBGL(n,d,0,r,f,0,u);let x=0;for(let v=0;v<u;v++)x+=d[v];t.update(x,n,1)}this.setMode=s,this.setIndex=o,this.render=l,this.renderInstances=c,this.renderMultiDraw=h}function $_(i){const e={geometries:0,textures:0},t={frame:0,calls:0,triangles:0,points:0,lines:0};function n(r,a,o){switch(t.calls++,a){case i.TRIANGLES:t.triangles+=o*(r/3);break;case i.LINES:t.lines+=o*(r/2);break;case i.LINE_STRIP:t.lines+=o*(r-1);break;case i.LINE_LOOP:t.lines+=o*r;break;case i.POINTS:t.points+=o*r;break;default:at("WebGLInfo: Unknown draw mode:",a);break}}function s(){t.calls=0,t.triangles=0,t.points=0,t.lines=0}return{memory:e,render:t,programs:null,autoReset:!0,reset:s,update:n}}function Z_(i,e,t){const n=new WeakMap,s=new Rt;function r(a,o,l){const c=a.morphTargetInfluences,h=o.morphAttributes.position||o.morphAttributes.normal||o.morphAttributes.color,f=h!==void 0?h.length:0;let d=n.get(o);if(d===void 0||d.count!==f){let b=function(){R.dispose(),n.delete(o),o.removeEventListener("dispose",b)};d!==void 0&&d.texture.dispose();const u=o.morphAttributes.position!==void 0,m=o.morphAttributes.normal!==void 0,x=o.morphAttributes.color!==void 0,v=o.morphAttributes.position||[],g=o.morphAttributes.normal||[],y=o.morphAttributes.color||[];let E=0;u===!0&&(E=1),m===!0&&(E=2),x===!0&&(E=3);let M=o.attributes.position.count*E,T=1;M>e.maxTextureSize&&(T=Math.ceil(M/e.maxTextureSize),M=e.maxTextureSize);const w=new Float32Array(M*T*4*f),R=new xd(w,M,T,f);R.type=In,R.needsUpdate=!0;const _=E*4;for(let P=0;P<f;P++){const L=v[P],B=g[P],Y=y[P],p=M*T*4*P;for(let C=0;C<L.count;C++){const D=C*_;u===!0&&(s.fromBufferAttribute(L,C),w[p+D+0]=s.x,w[p+D+1]=s.y,w[p+D+2]=s.z,w[p+D+3]=0),m===!0&&(s.fromBufferAttribute(B,C),w[p+D+4]=s.x,w[p+D+5]=s.y,w[p+D+6]=s.z,w[p+D+7]=0),x===!0&&(s.fromBufferAttribute(Y,C),w[p+D+8]=s.x,w[p+D+9]=s.y,w[p+D+10]=s.z,w[p+D+11]=Y.itemSize===4?s.w:1)}}d={count:f,texture:R,size:new fe(M,T)},n.set(o,d),o.addEventListener("dispose",b)}if(a.isInstancedMesh===!0&&a.morphTexture!==null)l.getUniforms().setValue(i,"morphTexture",a.morphTexture,t);else{let u=0;for(let x=0;x<c.length;x++)u+=c[x];const m=o.morphTargetsRelative?1:1-u;l.getUniforms().setValue(i,"morphTargetBaseInfluence",m),l.getUniforms().setValue(i,"morphTargetInfluences",c)}l.getUniforms().setValue(i,"morphTargetsTexture",d.texture,t),l.getUniforms().setValue(i,"morphTargetsTextureSize",d.size)}return{update:r}}function J_(i,e,t,n,s){let r=new WeakMap;function a(c){const h=s.render.frame,f=c.geometry,d=e.get(c,f);if(r.get(d)!==h&&(e.update(d),r.set(d,h)),c.isInstancedMesh&&(c.hasEventListener("dispose",l)===!1&&c.addEventListener("dispose",l),r.get(c)!==h&&(t.update(c.instanceMatrix,i.ARRAY_BUFFER),c.instanceColor!==null&&t.update(c.instanceColor,i.ARRAY_BUFFER),r.set(c,h))),c.isSkinnedMesh){const u=c.skeleton;r.get(u)!==h&&(u.update(),r.set(u,h))}return d}function o(){r=new WeakMap}function l(c){const h=c.target;h.removeEventListener("dispose",l),n.releaseStatesOfObject(h),t.remove(h.instanceMatrix),h.instanceColor!==null&&t.remove(h.instanceColor)}return{update:a,dispose:o}}const Q_={[Cc]:"LINEAR_TONE_MAPPING",[Rc]:"REINHARD_TONE_MAPPING",[Pc]:"CINEON_TONE_MAPPING",[Za]:"ACES_FILMIC_TONE_MAPPING",[Lc]:"AGX_TONE_MAPPING",[Dc]:"NEUTRAL_TONE_MAPPING",[Ic]:"CUSTOM_TONE_MAPPING"};function j_(i,e,t,n,s,r){const a=new nn(e,t,{type:i,depthBuffer:s,stencilBuffer:r,samples:n?4:0,depthTexture:s?new Ds(e,t):void 0}),o=new nn(e,t,{type:dn,depthBuffer:!1,stencilBuffer:!1}),l=new It;l.setAttribute("position",new _t([-1,3,0,-1,-1,0,3,-1,0],3)),l.setAttribute("uv",new _t([0,2,0,0,2,0],2));const c=new Hd({uniforms:{tDiffuse:{value:null}},vertexShader:`
			precision highp float;

			uniform mat4 modelViewMatrix;
			uniform mat4 projectionMatrix;

			attribute vec3 position;
			attribute vec2 uv;

			varying vec2 vUv;

			void main() {
				vUv = uv;
				gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
			}`,fragmentShader:`
			precision highp float;

			uniform sampler2D tDiffuse;

			varying vec2 vUv;

			#include <tonemapping_pars_fragment>
			#include <colorspace_pars_fragment>

			void main() {
				gl_FragColor = texture2D( tDiffuse, vUv );

				#ifdef LINEAR_TONE_MAPPING
					gl_FragColor.rgb = LinearToneMapping( gl_FragColor.rgb );
				#elif defined( REINHARD_TONE_MAPPING )
					gl_FragColor.rgb = ReinhardToneMapping( gl_FragColor.rgb );
				#elif defined( CINEON_TONE_MAPPING )
					gl_FragColor.rgb = CineonToneMapping( gl_FragColor.rgb );
				#elif defined( ACES_FILMIC_TONE_MAPPING )
					gl_FragColor.rgb = ACESFilmicToneMapping( gl_FragColor.rgb );
				#elif defined( AGX_TONE_MAPPING )
					gl_FragColor.rgb = AgXToneMapping( gl_FragColor.rgb );
				#elif defined( NEUTRAL_TONE_MAPPING )
					gl_FragColor.rgb = NeutralToneMapping( gl_FragColor.rgb );
				#elif defined( CUSTOM_TONE_MAPPING )
					gl_FragColor.rgb = CustomToneMapping( gl_FragColor.rgb );
				#endif

				#ifdef SRGB_TRANSFER
					gl_FragColor = sRGBTransferOETF( gl_FragColor );
				#endif
			}`,depthTest:!1,depthWrite:!1}),h=new $e(l,c),f=new eh(-1,1,1,-1,0,1);let d=null,u=null,m=!1,x,v=null,g=[],y=!1;this.setSize=function(E,M){a.setSize(E,M),o.setSize(E,M);for(let T=0;T<g.length;T++){const w=g[T];w.setSize&&w.setSize(E,M)}},this.setEffects=function(E){g=E,y=g.length>0&&g[0].isRenderPass===!0;const M=a.width,T=a.height;for(let w=0;w<g.length;w++){const R=g[w];R.setSize&&R.setSize(M,T)}},this.begin=function(E,M){if(m||E.toneMapping===zn&&g.length===0)return!1;if(v=M,M!==null){const T=M.width,w=M.height;(a.width!==T||a.height!==w)&&this.setSize(T,w)}return y===!1&&E.setRenderTarget(a),x=E.toneMapping,E.toneMapping=zn,!0},this.hasRenderPass=function(){return y},this.end=function(E,M){E.toneMapping=x,m=!0;let T=a,w=o;for(let R=0;R<g.length;R++){const _=g[R];if(_.enabled!==!1&&(_.render(E,w,T,M),_.needsSwap!==!1)){const b=T;T=w,w=b}}if(d!==E.outputColorSpace||u!==E.toneMapping){d=E.outputColorSpace,u=E.toneMapping,c.defines={},st.getTransfer(d)===pt&&(c.defines.SRGB_TRANSFER="");const R=Q_[u];R&&(c.defines[R]=""),c.needsUpdate=!0}c.uniforms.tDiffuse.value=T.texture,E.setRenderTarget(v),E.render(h,f),v=null,m=!1},this.isCompositing=function(){return m},this.dispose=function(){a.depthTexture&&a.depthTexture.dispose(),a.dispose(),o.dispose(),l.dispose(),c.dispose()}}const Jd=new Wt,ac=new Ds(1,1),Qd=new xd,jd=new Om,ef=new Pd,gu=[],vu=[],_u=new Float32Array(16),xu=new Float32Array(9),Su=new Float32Array(4);function Gs(i,e,t){const n=i[0];if(n<=0||n>0)return i;const s=e*t;let r=gu[s];if(r===void 0&&(r=new Float32Array(s),gu[s]=r),e!==0){n.toArray(r,0);for(let a=1,o=0;a!==e;++a)o+=t,i[a].toArray(r,o)}return r}function zt(i,e){if(i.length!==e.length)return!1;for(let t=0,n=i.length;t<n;t++)if(i[t]!==e[t])return!1;return!0}function Ht(i,e){for(let t=0,n=e.length;t<n;t++)i[t]=e[t]}function to(i,e){let t=vu[e];t===void 0&&(t=new Int32Array(e),vu[e]=t);for(let n=0;n!==e;++n)t[n]=i.allocateTextureUnit();return t}function ex(i,e){const t=this.cache;t[0]!==e&&(i.uniform1f(this.addr,e),t[0]=e)}function tx(i,e){const t=this.cache;if(e.x!==void 0)(t[0]!==e.x||t[1]!==e.y)&&(i.uniform2f(this.addr,e.x,e.y),t[0]=e.x,t[1]=e.y);else{if(zt(t,e))return;i.uniform2fv(this.addr,e),Ht(t,e)}}function nx(i,e){const t=this.cache;if(e.x!==void 0)(t[0]!==e.x||t[1]!==e.y||t[2]!==e.z)&&(i.uniform3f(this.addr,e.x,e.y,e.z),t[0]=e.x,t[1]=e.y,t[2]=e.z);else if(e.r!==void 0)(t[0]!==e.r||t[1]!==e.g||t[2]!==e.b)&&(i.uniform3f(this.addr,e.r,e.g,e.b),t[0]=e.r,t[1]=e.g,t[2]=e.b);else{if(zt(t,e))return;i.uniform3fv(this.addr,e),Ht(t,e)}}function ix(i,e){const t=this.cache;if(e.x!==void 0)(t[0]!==e.x||t[1]!==e.y||t[2]!==e.z||t[3]!==e.w)&&(i.uniform4f(this.addr,e.x,e.y,e.z,e.w),t[0]=e.x,t[1]=e.y,t[2]=e.z,t[3]=e.w);else{if(zt(t,e))return;i.uniform4fv(this.addr,e),Ht(t,e)}}function sx(i,e){const t=this.cache,n=e.elements;if(n===void 0){if(zt(t,e))return;i.uniformMatrix2fv(this.addr,!1,e),Ht(t,e)}else{if(zt(t,n))return;Su.set(n),i.uniformMatrix2fv(this.addr,!1,Su),Ht(t,n)}}function rx(i,e){const t=this.cache,n=e.elements;if(n===void 0){if(zt(t,e))return;i.uniformMatrix3fv(this.addr,!1,e),Ht(t,e)}else{if(zt(t,n))return;xu.set(n),i.uniformMatrix3fv(this.addr,!1,xu),Ht(t,n)}}function ax(i,e){const t=this.cache,n=e.elements;if(n===void 0){if(zt(t,e))return;i.uniformMatrix4fv(this.addr,!1,e),Ht(t,e)}else{if(zt(t,n))return;_u.set(n),i.uniformMatrix4fv(this.addr,!1,_u),Ht(t,n)}}function ox(i,e){const t=this.cache;t[0]!==e&&(i.uniform1i(this.addr,e),t[0]=e)}function lx(i,e){const t=this.cache;if(e.x!==void 0)(t[0]!==e.x||t[1]!==e.y)&&(i.uniform2i(this.addr,e.x,e.y),t[0]=e.x,t[1]=e.y);else{if(zt(t,e))return;i.uniform2iv(this.addr,e),Ht(t,e)}}function cx(i,e){const t=this.cache;if(e.x!==void 0)(t[0]!==e.x||t[1]!==e.y||t[2]!==e.z)&&(i.uniform3i(this.addr,e.x,e.y,e.z),t[0]=e.x,t[1]=e.y,t[2]=e.z);else{if(zt(t,e))return;i.uniform3iv(this.addr,e),Ht(t,e)}}function hx(i,e){const t=this.cache;if(e.x!==void 0)(t[0]!==e.x||t[1]!==e.y||t[2]!==e.z||t[3]!==e.w)&&(i.uniform4i(this.addr,e.x,e.y,e.z,e.w),t[0]=e.x,t[1]=e.y,t[2]=e.z,t[3]=e.w);else{if(zt(t,e))return;i.uniform4iv(this.addr,e),Ht(t,e)}}function ux(i,e){const t=this.cache;t[0]!==e&&(i.uniform1ui(this.addr,e),t[0]=e)}function dx(i,e){const t=this.cache;if(e.x!==void 0)(t[0]!==e.x||t[1]!==e.y)&&(i.uniform2ui(this.addr,e.x,e.y),t[0]=e.x,t[1]=e.y);else{if(zt(t,e))return;i.uniform2uiv(this.addr,e),Ht(t,e)}}function fx(i,e){const t=this.cache;if(e.x!==void 0)(t[0]!==e.x||t[1]!==e.y||t[2]!==e.z)&&(i.uniform3ui(this.addr,e.x,e.y,e.z),t[0]=e.x,t[1]=e.y,t[2]=e.z);else{if(zt(t,e))return;i.uniform3uiv(this.addr,e),Ht(t,e)}}function px(i,e){const t=this.cache;if(e.x!==void 0)(t[0]!==e.x||t[1]!==e.y||t[2]!==e.z||t[3]!==e.w)&&(i.uniform4ui(this.addr,e.x,e.y,e.z,e.w),t[0]=e.x,t[1]=e.y,t[2]=e.z,t[3]=e.w);else{if(zt(t,e))return;i.uniform4uiv(this.addr,e),Ht(t,e)}}function mx(i,e,t){const n=this.cache,s=t.allocateTextureUnit();n[0]!==s&&(i.uniform1i(this.addr,s),n[0]=s);let r;this.type===i.SAMPLER_2D_SHADOW?(ac.compareFunction=t.isReversedDepthBuffer()?Hc:zc,r=ac):r=Jd,t.setTexture2D(e||r,s)}function gx(i,e,t){const n=this.cache,s=t.allocateTextureUnit();n[0]!==s&&(i.uniform1i(this.addr,s),n[0]=s),t.setTexture3D(e||jd,s)}function vx(i,e,t){const n=this.cache,s=t.allocateTextureUnit();n[0]!==s&&(i.uniform1i(this.addr,s),n[0]=s),t.setTextureCube(e||ef,s)}function _x(i,e,t){const n=this.cache,s=t.allocateTextureUnit();n[0]!==s&&(i.uniform1i(this.addr,s),n[0]=s),t.setTexture2DArray(e||Qd,s)}function xx(i){switch(i){case 5126:return ex;case 35664:return tx;case 35665:return nx;case 35666:return ix;case 35674:return sx;case 35675:return rx;case 35676:return ax;case 5124:case 35670:return ox;case 35667:case 35671:return lx;case 35668:case 35672:return cx;case 35669:case 35673:return hx;case 5125:return ux;case 36294:return dx;case 36295:return fx;case 36296:return px;case 35678:case 36198:case 36298:case 36306:case 35682:return mx;case 35679:case 36299:case 36307:return gx;case 35680:case 36300:case 36308:case 36293:return vx;case 36289:case 36303:case 36311:case 36292:return _x}}function Sx(i,e){i.uniform1fv(this.addr,e)}function Mx(i,e){const t=Gs(e,this.size,2);i.uniform2fv(this.addr,t)}function yx(i,e){const t=Gs(e,this.size,3);i.uniform3fv(this.addr,t)}function bx(i,e){const t=Gs(e,this.size,4);i.uniform4fv(this.addr,t)}function Ex(i,e){const t=Gs(e,this.size,4);i.uniformMatrix2fv(this.addr,!1,t)}function Tx(i,e){const t=Gs(e,this.size,9);i.uniformMatrix3fv(this.addr,!1,t)}function Ax(i,e){const t=Gs(e,this.size,16);i.uniformMatrix4fv(this.addr,!1,t)}function wx(i,e){i.uniform1iv(this.addr,e)}function Cx(i,e){i.uniform2iv(this.addr,e)}function Rx(i,e){i.uniform3iv(this.addr,e)}function Px(i,e){i.uniform4iv(this.addr,e)}function Ix(i,e){i.uniform1uiv(this.addr,e)}function Lx(i,e){i.uniform2uiv(this.addr,e)}function Dx(i,e){i.uniform3uiv(this.addr,e)}function Nx(i,e){i.uniform4uiv(this.addr,e)}function Ux(i,e,t){const n=this.cache,s=e.length,r=to(t,s);zt(n,r)||(i.uniform1iv(this.addr,r),Ht(n,r));let a;this.type===i.SAMPLER_2D_SHADOW?a=ac:a=Jd;for(let o=0;o!==s;++o)t.setTexture2D(e[o]||a,r[o])}function Fx(i,e,t){const n=this.cache,s=e.length,r=to(t,s);zt(n,r)||(i.uniform1iv(this.addr,r),Ht(n,r));for(let a=0;a!==s;++a)t.setTexture3D(e[a]||jd,r[a])}function Ox(i,e,t){const n=this.cache,s=e.length,r=to(t,s);zt(n,r)||(i.uniform1iv(this.addr,r),Ht(n,r));for(let a=0;a!==s;++a)t.setTextureCube(e[a]||ef,r[a])}function Bx(i,e,t){const n=this.cache,s=e.length,r=to(t,s);zt(n,r)||(i.uniform1iv(this.addr,r),Ht(n,r));for(let a=0;a!==s;++a)t.setTexture2DArray(e[a]||Qd,r[a])}function kx(i){switch(i){case 5126:return Sx;case 35664:return Mx;case 35665:return yx;case 35666:return bx;case 35674:return Ex;case 35675:return Tx;case 35676:return Ax;case 5124:case 35670:return wx;case 35667:case 35671:return Cx;case 35668:case 35672:return Rx;case 35669:case 35673:return Px;case 5125:return Ix;case 36294:return Lx;case 36295:return Dx;case 36296:return Nx;case 35678:case 36198:case 36298:case 36306:case 35682:return Ux;case 35679:case 36299:case 36307:return Fx;case 35680:case 36300:case 36308:case 36293:return Ox;case 36289:case 36303:case 36311:case 36292:return Bx}}class Gx{constructor(e,t,n){this.id=e,this.addr=n,this.cache=[],this.type=t.type,this.setValue=xx(t.type)}}class zx{constructor(e,t,n){this.id=e,this.addr=n,this.cache=[],this.type=t.type,this.size=t.size,this.setValue=kx(t.type)}}class Hx{constructor(e){this.id=e,this.seq=[],this.map={}}setValue(e,t,n){const s=this.seq;for(let r=0,a=s.length;r!==a;++r){const o=s[r];o.setValue(e,t[o.id],n)}}}const Zo=/(\w+)(\])?(\[|\.)?/g;function Mu(i,e){i.seq.push(e),i.map[e.id]=e}function Vx(i,e,t){const n=i.name,s=n.length;for(Zo.lastIndex=0;;){const r=Zo.exec(n),a=Zo.lastIndex;let o=r[1];const l=r[2]==="]",c=r[3];if(l&&(o=o|0),c===void 0||c==="["&&a+2===s){Mu(t,c===void 0?new Gx(o,i,e):new zx(o,i,e));break}else{let f=t.map[o];f===void 0&&(f=new Hx(o),Mu(t,f)),t=f}}}class Ca{constructor(e,t){this.seq=[],this.map={};const n=e.getProgramParameter(t,e.ACTIVE_UNIFORMS);for(let a=0;a<n;++a){const o=e.getActiveUniform(t,a),l=e.getUniformLocation(t,o.name);Vx(o,l,this)}const s=[],r=[];for(const a of this.seq)a.type===e.SAMPLER_2D_SHADOW||a.type===e.SAMPLER_CUBE_SHADOW||a.type===e.SAMPLER_2D_ARRAY_SHADOW?s.push(a):r.push(a);s.length>0&&(this.seq=s.concat(r))}setValue(e,t,n,s){const r=this.map[t];r!==void 0&&r.setValue(e,n,s)}setOptional(e,t,n){const s=t[n];s!==void 0&&this.setValue(e,n,s)}static upload(e,t,n,s){for(let r=0,a=t.length;r!==a;++r){const o=t[r],l=n[o.id];l.needsUpdate!==!1&&o.setValue(e,l.value,s)}}static seqWithValue(e,t){const n=[];for(let s=0,r=e.length;s!==r;++s){const a=e[s];a.id in t&&n.push(a)}return n}}function yu(i,e,t){const n=i.createShader(e);return i.shaderSource(n,t),i.compileShader(n),n}const Wx=37297;let Xx=0;function Yx(i,e){const t=i.split(`
`),n=[],s=Math.max(e-6,0),r=Math.min(e+6,t.length);for(let a=s;a<r;a++){const o=a+1;n.push(`${o===e?">":" "} ${o}: ${t[a]}`)}return n.join(`
`)}const bu=new Je;function qx(i){st._getMatrix(bu,st.workingColorSpace,i);const e=`mat3( ${bu.elements.map(t=>t.toFixed(4))} )`;switch(st.getTransfer(i)){case Ba:return[e,"LinearTransferOETF"];case pt:return[e,"sRGBTransferOETF"];default:return Ke("WebGLProgram: Unsupported color space: ",i),[e,"LinearTransferOETF"]}}function Eu(i,e,t){const n=i.getShaderParameter(e,i.COMPILE_STATUS),r=(i.getShaderInfoLog(e)||"").trim();if(n&&r==="")return"";const a=/ERROR: 0:(\d+)/.exec(r);if(a){const o=parseInt(a[1]);return t.toUpperCase()+`

`+r+`

`+Yx(i.getShaderSource(e),o)}else return r}function Kx(i,e){const t=qx(e);return[`vec4 ${i}( vec4 value ) {`,`	return ${t[1]}( vec4( value.rgb * ${t[0]}, value.a ) );`,"}"].join(`
`)}const $x={[Cc]:"Linear",[Rc]:"Reinhard",[Pc]:"Cineon",[Za]:"ACESFilmic",[Lc]:"AgX",[Dc]:"Neutral",[Ic]:"Custom"};function Zx(i,e){const t=$x[e];return t===void 0?(Ke("WebGLProgram: Unsupported toneMapping:",e),"vec3 "+i+"( vec3 color ) { return LinearToneMapping( color ); }"):"vec3 "+i+"( vec3 color ) { return "+t+"ToneMapping( color ); }"}const ma=new N;function Jx(){st.getLuminanceCoefficients(ma);const i=ma.x.toFixed(4),e=ma.y.toFixed(4),t=ma.z.toFixed(4);return["float luminance( const in vec3 rgb ) {",`	const vec3 weights = vec3( ${i}, ${e}, ${t} );`,"	return dot( weights, rgb );","}"].join(`
`)}function Qx(i){return[i.extensionClipCullDistance?"#extension GL_ANGLE_clip_cull_distance : require":"",i.extensionMultiDraw?"#extension GL_ANGLE_multi_draw : require":""].filter(fr).join(`
`)}function jx(i){const e=[];for(const t in i){const n=i[t];n!==!1&&e.push("#define "+t+" "+n)}return e.join(`
`)}function eS(i,e){const t={},n=i.getProgramParameter(e,i.ACTIVE_ATTRIBUTES);for(let s=0;s<n;s++){const r=i.getActiveAttrib(e,s),a=r.name;let o=1;r.type===i.FLOAT_MAT2&&(o=2),r.type===i.FLOAT_MAT3&&(o=3),r.type===i.FLOAT_MAT4&&(o=4),t[a]={type:r.type,location:i.getAttribLocation(e,a),locationSize:o}}return t}function fr(i){return i!==""}function Tu(i,e){const t=e.numSpotLightShadows+e.numSpotLightMaps-e.numSpotLightShadowsWithMaps;return i.replace(/NUM_DIR_LIGHTS/g,e.numDirLights).replace(/NUM_SPOT_LIGHTS/g,e.numSpotLights).replace(/NUM_SPOT_LIGHT_MAPS/g,e.numSpotLightMaps).replace(/NUM_SPOT_LIGHT_COORDS/g,t).replace(/NUM_RECT_AREA_LIGHTS/g,e.numRectAreaLights).replace(/NUM_POINT_LIGHTS/g,e.numPointLights).replace(/NUM_HEMI_LIGHTS/g,e.numHemiLights).replace(/NUM_DIR_LIGHT_SHADOWS/g,e.numDirLightShadows).replace(/NUM_SPOT_LIGHT_SHADOWS_WITH_MAPS/g,e.numSpotLightShadowsWithMaps).replace(/NUM_SPOT_LIGHT_SHADOWS/g,e.numSpotLightShadows).replace(/NUM_POINT_LIGHT_SHADOWS/g,e.numPointLightShadows)}function Au(i,e){return i.replace(/NUM_CLIPPING_PLANES/g,e.numClippingPlanes).replace(/UNION_CLIPPING_PLANES/g,e.numClippingPlanes-e.numClipIntersection)}const tS=/^[ \t]*#include +<([\w\d./]+)>/gm;function oc(i){return i.replace(tS,iS)}const nS=new Map;function iS(i,e){let t=je[e];if(t===void 0){const n=nS.get(e);if(n!==void 0)t=je[n],Ke('WebGLRenderer: Shader chunk "%s" has been deprecated. Use "%s" instead.',e,n);else throw new Error("THREE.WebGLProgram: Can not resolve #include <"+e+">")}return oc(t)}const sS=/#pragma unroll_loop_start\s+for\s*\(\s*int\s+i\s*=\s*(\d+)\s*;\s*i\s*<\s*(\d+)\s*;\s*i\s*\+\+\s*\)\s*{([\s\S]+?)}\s+#pragma unroll_loop_end/g;function wu(i){return i.replace(sS,rS)}function rS(i,e,t,n){let s="";for(let r=parseInt(e);r<parseInt(t);r++)s+=n.replace(/\[\s*i\s*\]/g,"[ "+r+" ]").replace(/UNROLLED_LOOP_INDEX/g,r);return s}function Cu(i){let e=`precision ${i.precision} float;
	precision ${i.precision} int;
	precision ${i.precision} sampler2D;
	precision ${i.precision} samplerCube;
	precision ${i.precision} sampler3D;
	precision ${i.precision} sampler2DArray;
	precision ${i.precision} sampler2DShadow;
	precision ${i.precision} samplerCubeShadow;
	precision ${i.precision} sampler2DArrayShadow;
	precision ${i.precision} isampler2D;
	precision ${i.precision} isampler3D;
	precision ${i.precision} isamplerCube;
	precision ${i.precision} isampler2DArray;
	precision ${i.precision} usampler2D;
	precision ${i.precision} usampler3D;
	precision ${i.precision} usamplerCube;
	precision ${i.precision} usampler2DArray;
	`;return i.precision==="highp"?e+=`
#define HIGH_PRECISION`:i.precision==="mediump"?e+=`
#define MEDIUM_PRECISION`:i.precision==="lowp"&&(e+=`
#define LOW_PRECISION`),e}const aS={[ba]:"SHADOWMAP_TYPE_PCF",[ur]:"SHADOWMAP_TYPE_VSM"};function oS(i){return aS[i.shadowMapType]||"SHADOWMAP_TYPE_BASIC"}const lS={[Hi]:"ENVMAP_TYPE_CUBE",[Is]:"ENVMAP_TYPE_CUBE",[Ja]:"ENVMAP_TYPE_CUBE_UV"};function cS(i){return i.envMap===!1?"ENVMAP_TYPE_CUBE":lS[i.envMapMode]||"ENVMAP_TYPE_CUBE"}const hS={[Is]:"ENVMAP_MODE_REFRACTION"};function uS(i){return i.envMap===!1?"ENVMAP_MODE_REFLECTION":hS[i.envMapMode]||"ENVMAP_MODE_REFLECTION"}const dS={[wc]:"ENVMAP_BLENDING_MULTIPLY",[tm]:"ENVMAP_BLENDING_MIX",[nm]:"ENVMAP_BLENDING_ADD"};function fS(i){return i.envMap===!1?"ENVMAP_BLENDING_NONE":dS[i.combine]||"ENVMAP_BLENDING_NONE"}function pS(i){const e=i.envMapCubeUVHeight;if(e===null)return null;const t=Math.log2(e)-2,n=1/e;return{texelWidth:1/(3*Math.max(Math.pow(2,t),112)),texelHeight:n,maxMip:t}}function mS(i,e,t,n){const s=i.getContext(),r=t.defines;let a=t.vertexShader,o=t.fragmentShader;const l=oS(t),c=cS(t),h=uS(t),f=fS(t),d=pS(t),u=Qx(t),m=jx(r),x=s.createProgram();let v,g,y=t.glslVersion?"#version "+t.glslVersion+`
`:"";t.isRawShaderMaterial?(v=["#define SHADER_TYPE "+t.shaderType,"#define SHADER_NAME "+t.shaderName,m].filter(fr).join(`
`),v.length>0&&(v+=`
`),g=["#define SHADER_TYPE "+t.shaderType,"#define SHADER_NAME "+t.shaderName,m].filter(fr).join(`
`),g.length>0&&(g+=`
`)):(v=[Cu(t),"#define SHADER_TYPE "+t.shaderType,"#define SHADER_NAME "+t.shaderName,m,t.extensionClipCullDistance?"#define USE_CLIP_DISTANCE":"",t.batching?"#define USE_BATCHING":"",t.batchingColor?"#define USE_BATCHING_COLOR":"",t.instancing?"#define USE_INSTANCING":"",t.instancingColor?"#define USE_INSTANCING_COLOR":"",t.instancingMorph?"#define USE_INSTANCING_MORPH":"",t.useFog&&t.fog?"#define USE_FOG":"",t.useFog&&t.fogExp2?"#define FOG_EXP2":"",t.map?"#define USE_MAP":"",t.envMap?"#define USE_ENVMAP":"",t.envMap?"#define "+h:"",t.lightMap?"#define USE_LIGHTMAP":"",t.aoMap?"#define USE_AOMAP":"",t.bumpMap?"#define USE_BUMPMAP":"",t.normalMap?"#define USE_NORMALMAP":"",t.normalMapObjectSpace?"#define USE_NORMALMAP_OBJECTSPACE":"",t.normalMapTangentSpace?"#define USE_NORMALMAP_TANGENTSPACE":"",t.displacementMap?"#define USE_DISPLACEMENTMAP":"",t.emissiveMap?"#define USE_EMISSIVEMAP":"",t.anisotropy?"#define USE_ANISOTROPY":"",t.anisotropyMap?"#define USE_ANISOTROPYMAP":"",t.clearcoatMap?"#define USE_CLEARCOATMAP":"",t.clearcoatRoughnessMap?"#define USE_CLEARCOAT_ROUGHNESSMAP":"",t.clearcoatNormalMap?"#define USE_CLEARCOAT_NORMALMAP":"",t.iridescenceMap?"#define USE_IRIDESCENCEMAP":"",t.iridescenceThicknessMap?"#define USE_IRIDESCENCE_THICKNESSMAP":"",t.specularMap?"#define USE_SPECULARMAP":"",t.specularColorMap?"#define USE_SPECULAR_COLORMAP":"",t.specularIntensityMap?"#define USE_SPECULAR_INTENSITYMAP":"",t.roughnessMap?"#define USE_ROUGHNESSMAP":"",t.metalnessMap?"#define USE_METALNESSMAP":"",t.alphaMap?"#define USE_ALPHAMAP":"",t.alphaHash?"#define USE_ALPHAHASH":"",t.transmission?"#define USE_TRANSMISSION":"",t.transmissionMap?"#define USE_TRANSMISSIONMAP":"",t.thicknessMap?"#define USE_THICKNESSMAP":"",t.sheenColorMap?"#define USE_SHEEN_COLORMAP":"",t.sheenRoughnessMap?"#define USE_SHEEN_ROUGHNESSMAP":"",t.mapUv?"#define MAP_UV "+t.mapUv:"",t.alphaMapUv?"#define ALPHAMAP_UV "+t.alphaMapUv:"",t.lightMapUv?"#define LIGHTMAP_UV "+t.lightMapUv:"",t.aoMapUv?"#define AOMAP_UV "+t.aoMapUv:"",t.emissiveMapUv?"#define EMISSIVEMAP_UV "+t.emissiveMapUv:"",t.bumpMapUv?"#define BUMPMAP_UV "+t.bumpMapUv:"",t.normalMapUv?"#define NORMALMAP_UV "+t.normalMapUv:"",t.displacementMapUv?"#define DISPLACEMENTMAP_UV "+t.displacementMapUv:"",t.metalnessMapUv?"#define METALNESSMAP_UV "+t.metalnessMapUv:"",t.roughnessMapUv?"#define ROUGHNESSMAP_UV "+t.roughnessMapUv:"",t.anisotropyMapUv?"#define ANISOTROPYMAP_UV "+t.anisotropyMapUv:"",t.clearcoatMapUv?"#define CLEARCOATMAP_UV "+t.clearcoatMapUv:"",t.clearcoatNormalMapUv?"#define CLEARCOAT_NORMALMAP_UV "+t.clearcoatNormalMapUv:"",t.clearcoatRoughnessMapUv?"#define CLEARCOAT_ROUGHNESSMAP_UV "+t.clearcoatRoughnessMapUv:"",t.iridescenceMapUv?"#define IRIDESCENCEMAP_UV "+t.iridescenceMapUv:"",t.iridescenceThicknessMapUv?"#define IRIDESCENCE_THICKNESSMAP_UV "+t.iridescenceThicknessMapUv:"",t.sheenColorMapUv?"#define SHEEN_COLORMAP_UV "+t.sheenColorMapUv:"",t.sheenRoughnessMapUv?"#define SHEEN_ROUGHNESSMAP_UV "+t.sheenRoughnessMapUv:"",t.specularMapUv?"#define SPECULARMAP_UV "+t.specularMapUv:"",t.specularColorMapUv?"#define SPECULAR_COLORMAP_UV "+t.specularColorMapUv:"",t.specularIntensityMapUv?"#define SPECULAR_INTENSITYMAP_UV "+t.specularIntensityMapUv:"",t.transmissionMapUv?"#define TRANSMISSIONMAP_UV "+t.transmissionMapUv:"",t.thicknessMapUv?"#define THICKNESSMAP_UV "+t.thicknessMapUv:"",t.vertexTangents&&t.flatShading===!1?"#define USE_TANGENT":"",t.vertexNormals?"#define HAS_NORMAL":"",t.vertexColors?"#define USE_COLOR":"",t.vertexAlphas?"#define USE_COLOR_ALPHA":"",t.vertexUv1s?"#define USE_UV1":"",t.vertexUv2s?"#define USE_UV2":"",t.vertexUv3s?"#define USE_UV3":"",t.pointsUvs?"#define USE_POINTS_UV":"",t.flatShading?"#define FLAT_SHADED":"",t.skinning?"#define USE_SKINNING":"",t.morphTargets?"#define USE_MORPHTARGETS":"",t.morphNormals&&t.flatShading===!1?"#define USE_MORPHNORMALS":"",t.morphColors?"#define USE_MORPHCOLORS":"",t.morphTargetsCount>0?"#define MORPHTARGETS_TEXTURE_STRIDE "+t.morphTextureStride:"",t.morphTargetsCount>0?"#define MORPHTARGETS_COUNT "+t.morphTargetsCount:"",t.doubleSided?"#define DOUBLE_SIDED":"",t.flipSided?"#define FLIP_SIDED":"",t.shadowMapEnabled?"#define USE_SHADOWMAP":"",t.shadowMapEnabled?"#define "+l:"",t.sizeAttenuation?"#define USE_SIZEATTENUATION":"",t.numLightProbes>0?"#define USE_LIGHT_PROBES":"",t.logarithmicDepthBuffer?"#define USE_LOGARITHMIC_DEPTH_BUFFER":"",t.reversedDepthBuffer?"#define USE_REVERSED_DEPTH_BUFFER":"","uniform mat4 modelMatrix;","uniform mat4 modelViewMatrix;","uniform mat4 projectionMatrix;","uniform mat4 viewMatrix;","uniform mat3 normalMatrix;","uniform vec3 cameraPosition;","uniform bool isOrthographic;","#ifdef USE_INSTANCING","	attribute mat4 instanceMatrix;","#endif","#ifdef USE_INSTANCING_COLOR","	attribute vec3 instanceColor;","#endif","#ifdef USE_INSTANCING_MORPH","	uniform sampler2D morphTexture;","#endif","attribute vec3 position;","attribute vec3 normal;","attribute vec2 uv;","#ifdef USE_UV1","	attribute vec2 uv1;","#endif","#ifdef USE_UV2","	attribute vec2 uv2;","#endif","#ifdef USE_UV3","	attribute vec2 uv3;","#endif","#ifdef USE_TANGENT","	attribute vec4 tangent;","#endif","#if defined( USE_COLOR_ALPHA )","	attribute vec4 color;","#elif defined( USE_COLOR )","	attribute vec3 color;","#endif","#ifdef USE_SKINNING","	attribute vec4 skinIndex;","	attribute vec4 skinWeight;","#endif",`
`].filter(fr).join(`
`),g=[Cu(t),"#define SHADER_TYPE "+t.shaderType,"#define SHADER_NAME "+t.shaderName,m,t.useFog&&t.fog?"#define USE_FOG":"",t.useFog&&t.fogExp2?"#define FOG_EXP2":"",t.alphaToCoverage?"#define ALPHA_TO_COVERAGE":"",t.map?"#define USE_MAP":"",t.matcap?"#define USE_MATCAP":"",t.envMap?"#define USE_ENVMAP":"",t.envMap?"#define "+c:"",t.envMap?"#define "+h:"",t.envMap?"#define "+f:"",d?"#define CUBEUV_TEXEL_WIDTH "+d.texelWidth:"",d?"#define CUBEUV_TEXEL_HEIGHT "+d.texelHeight:"",d?"#define CUBEUV_MAX_MIP "+d.maxMip+".0":"",t.lightMap?"#define USE_LIGHTMAP":"",t.aoMap?"#define USE_AOMAP":"",t.bumpMap?"#define USE_BUMPMAP":"",t.normalMap?"#define USE_NORMALMAP":"",t.normalMapObjectSpace?"#define USE_NORMALMAP_OBJECTSPACE":"",t.normalMapTangentSpace?"#define USE_NORMALMAP_TANGENTSPACE":"",t.packedNormalMap?"#define USE_PACKED_NORMALMAP":"",t.emissiveMap?"#define USE_EMISSIVEMAP":"",t.anisotropy?"#define USE_ANISOTROPY":"",t.anisotropyMap?"#define USE_ANISOTROPYMAP":"",t.clearcoat?"#define USE_CLEARCOAT":"",t.clearcoatMap?"#define USE_CLEARCOATMAP":"",t.clearcoatRoughnessMap?"#define USE_CLEARCOAT_ROUGHNESSMAP":"",t.clearcoatNormalMap?"#define USE_CLEARCOAT_NORMALMAP":"",t.dispersion?"#define USE_DISPERSION":"",t.iridescence?"#define USE_IRIDESCENCE":"",t.iridescenceMap?"#define USE_IRIDESCENCEMAP":"",t.iridescenceThicknessMap?"#define USE_IRIDESCENCE_THICKNESSMAP":"",t.specularMap?"#define USE_SPECULARMAP":"",t.specularColorMap?"#define USE_SPECULAR_COLORMAP":"",t.specularIntensityMap?"#define USE_SPECULAR_INTENSITYMAP":"",t.roughnessMap?"#define USE_ROUGHNESSMAP":"",t.metalnessMap?"#define USE_METALNESSMAP":"",t.alphaMap?"#define USE_ALPHAMAP":"",t.alphaTest?"#define USE_ALPHATEST":"",t.alphaHash?"#define USE_ALPHAHASH":"",t.sheen?"#define USE_SHEEN":"",t.sheenColorMap?"#define USE_SHEEN_COLORMAP":"",t.sheenRoughnessMap?"#define USE_SHEEN_ROUGHNESSMAP":"",t.transmission?"#define USE_TRANSMISSION":"",t.transmissionMap?"#define USE_TRANSMISSIONMAP":"",t.thicknessMap?"#define USE_THICKNESSMAP":"",t.vertexTangents&&t.flatShading===!1?"#define USE_TANGENT":"",t.vertexColors||t.instancingColor?"#define USE_COLOR":"",t.vertexAlphas||t.batchingColor?"#define USE_COLOR_ALPHA":"",t.vertexUv1s?"#define USE_UV1":"",t.vertexUv2s?"#define USE_UV2":"",t.vertexUv3s?"#define USE_UV3":"",t.pointsUvs?"#define USE_POINTS_UV":"",t.gradientMap?"#define USE_GRADIENTMAP":"",t.flatShading?"#define FLAT_SHADED":"",t.doubleSided?"#define DOUBLE_SIDED":"",t.flipSided?"#define FLIP_SIDED":"",t.shadowMapEnabled?"#define USE_SHADOWMAP":"",t.shadowMapEnabled?"#define "+l:"",t.premultipliedAlpha?"#define PREMULTIPLIED_ALPHA":"",t.numLightProbes>0?"#define USE_LIGHT_PROBES":"",t.numLightProbeGrids>0?"#define USE_LIGHT_PROBES_GRID":"",t.decodeVideoTexture?"#define DECODE_VIDEO_TEXTURE":"",t.decodeVideoTextureEmissive?"#define DECODE_VIDEO_TEXTURE_EMISSIVE":"",t.logarithmicDepthBuffer?"#define USE_LOGARITHMIC_DEPTH_BUFFER":"",t.reversedDepthBuffer?"#define USE_REVERSED_DEPTH_BUFFER":"","uniform mat4 viewMatrix;","uniform vec3 cameraPosition;","uniform bool isOrthographic;",t.toneMapping!==zn?"#define TONE_MAPPING":"",t.toneMapping!==zn?je.tonemapping_pars_fragment:"",t.toneMapping!==zn?Zx("toneMapping",t.toneMapping):"",t.dithering?"#define DITHERING":"",t.opaque?"#define OPAQUE":"",je.colorspace_pars_fragment,Kx("linearToOutputTexel",t.outputColorSpace),Jx(),t.useDepthPacking?"#define DEPTH_PACKING "+t.depthPacking:"",`
`].filter(fr).join(`
`)),a=oc(a),a=Tu(a,t),a=Au(a,t),o=oc(o),o=Tu(o,t),o=Au(o,t),a=wu(a),o=wu(o),t.isRawShaderMaterial!==!0&&(y=`#version 300 es
`,v=[u,"#define attribute in","#define varying out","#define texture2D texture"].join(`
`)+`
`+v,g=["#define varying in",t.glslVersion===Ch?"":"layout(location = 0) out highp vec4 pc_fragColor;",t.glslVersion===Ch?"":"#define gl_FragColor pc_fragColor","#define gl_FragDepthEXT gl_FragDepth","#define texture2D texture","#define textureCube texture","#define texture2DProj textureProj","#define texture2DLodEXT textureLod","#define texture2DProjLodEXT textureProjLod","#define textureCubeLodEXT textureLod","#define texture2DGradEXT textureGrad","#define texture2DProjGradEXT textureProjGrad","#define textureCubeGradEXT textureGrad"].join(`
`)+`
`+g);const E=y+v+a,M=y+g+o,T=yu(s,s.VERTEX_SHADER,E),w=yu(s,s.FRAGMENT_SHADER,M);s.attachShader(x,T),s.attachShader(x,w),t.index0AttributeName!==void 0?s.bindAttribLocation(x,0,t.index0AttributeName):t.hasPositionAttribute===!0&&s.bindAttribLocation(x,0,"position"),s.linkProgram(x);function R(L){if(i.debug.checkShaderErrors){const B=s.getProgramInfoLog(x)||"",Y=s.getShaderInfoLog(T)||"",p=s.getShaderInfoLog(w)||"",C=B.trim(),D=Y.trim(),U=p.trim();let O=!0,F=!0;if(s.getProgramParameter(x,s.LINK_STATUS)===!1)if(O=!1,typeof i.debug.onShaderError=="function")i.debug.onShaderError(s,x,T,w);else{const G=Eu(s,T,"vertex"),Z=Eu(s,w,"fragment");at("WebGLProgram: Shader Error "+s.getError()+" - VALIDATE_STATUS "+s.getProgramParameter(x,s.VALIDATE_STATUS)+`

Material Name: `+L.name+`
Material Type: `+L.type+`

Program Info Log: `+C+`
`+G+`
`+Z)}else C!==""?Ke("WebGLProgram: Program Info Log:",C):(D===""||U==="")&&(F=!1);F&&(L.diagnostics={runnable:O,programLog:C,vertexShader:{log:D,prefix:v},fragmentShader:{log:U,prefix:g}})}s.deleteShader(T),s.deleteShader(w),_=new Ca(s,x),b=eS(s,x)}let _;this.getUniforms=function(){return _===void 0&&R(this),_};let b;this.getAttributes=function(){return b===void 0&&R(this),b};let P=t.rendererExtensionParallelShaderCompile===!1;return this.isReady=function(){return P===!1&&(P=s.getProgramParameter(x,Wx)),P},this.destroy=function(){n.releaseStatesOfProgram(this),s.deleteProgram(x),this.program=void 0},this.type=t.shaderType,this.name=t.shaderName,this.id=Xx++,this.cacheKey=e,this.usedTimes=1,this.program=x,this.vertexShader=T,this.fragmentShader=w,this}let gS=0;class vS{constructor(){this.shaderCache=new Map,this.materialCache=new Map}update(e,t,n){const s=this._getShaderCacheForMaterial(e);return s.has(t)===!1&&(s.add(t),t.usedTimes++),s.has(n)===!1&&(s.add(n),n.usedTimes++),this}remove(e){const t=this.materialCache.get(e);for(const n of t)n.usedTimes--,n.usedTimes===0&&this.shaderCache.delete(n.code);return this.materialCache.delete(e),this}getVertexShaderStage(e){return this._getShaderStage(e.vertexShader)}getFragmentShaderStage(e){return this._getShaderStage(e.fragmentShader)}dispose(){this.shaderCache.clear(),this.materialCache.clear()}_getShaderCacheForMaterial(e){const t=this.materialCache;let n=t.get(e);return n===void 0&&(n=new Set,t.set(e,n)),n}_getShaderStage(e){const t=this.shaderCache;let n=t.get(e);return n===void 0&&(n=new _S(e),t.set(e,n)),n}}class _S{constructor(e){this.id=gS++,this.code=e,this.usedTimes=0}}function xS(i){return i===Vi||i===Na||i===Ua}function SS(i,e,t,n,s,r){const a=new Sd,o=new vS,l=new Set,c=[],h=new Map,f=n.logarithmicDepthBuffer;let d=n.precision;const u={MeshDepthMaterial:"depth",MeshDistanceMaterial:"distance",MeshNormalMaterial:"normal",MeshBasicMaterial:"basic",MeshLambertMaterial:"lambert",MeshPhongMaterial:"phong",MeshToonMaterial:"toon",MeshStandardMaterial:"physical",MeshPhysicalMaterial:"physical",MeshMatcapMaterial:"matcap",LineBasicMaterial:"basic",LineDashedMaterial:"dashed",PointsMaterial:"points",ShadowMaterial:"shadow",SpriteMaterial:"sprite"};function m(_){return l.add(_),_===0?"uv":`uv${_}`}function x(_,b,P,L,B,Y){const p=L.fog,C=B.geometry,D=_.isMeshStandardMaterial||_.isMeshLambertMaterial||_.isMeshPhongMaterial?L.environment:null,U=_.isMeshStandardMaterial||_.isMeshLambertMaterial&&!_.envMap||_.isMeshPhongMaterial&&!_.envMap,O=e.get(_.envMap||D,U),F=O&&O.mapping===Ja?O.image.height:null,G=u[_.type];_.precision!==null&&(d=n.getMaxPrecision(_.precision),d!==_.precision&&Ke("WebGLProgram.getParameters:",_.precision,"not supported, using",d,"instead."));const Z=C.morphAttributes.position||C.morphAttributes.normal||C.morphAttributes.color,ae=Z!==void 0?Z.length:0;let Te=0;C.morphAttributes.position!==void 0&&(Te=1),C.morphAttributes.normal!==void 0&&(Te=2),C.morphAttributes.color!==void 0&&(Te=3);let qe,Re,j,pe;if(G){const Ue=On[G];qe=Ue.vertexShader,Re=Ue.fragmentShader}else{qe=_.vertexShader,Re=_.fragmentShader;const Ue=o.getVertexShaderStage(_),At=o.getFragmentShaderStage(_);o.update(_,Ue,At),j=Ue.id,pe=At.id}const de=i.getRenderTarget(),De=i.state.buffers.depth.getReversed(),ze=B.isInstancedMesh===!0,ke=B.isBatchedMesh===!0,et=!!_.map,He=!!_.matcap,re=!!O,le=!!_.aoMap,he=!!_.lightMap,ce=!!_.bumpMap&&_.wireframe===!1,ue=!!_.normalMap,_e=!!_.displacementMap,ge=!!_.emissiveMap,Fe=!!_.metalnessMap,We=!!_.roughnessMap,k=_.anisotropy>0,it=_.clearcoat>0,Qe=_.dispersion>0,I=_.iridescence>0,S=_.sheen>0,W=_.transmission>0,$=k&&!!_.anisotropyMap,ee=it&&!!_.clearcoatMap,ve=it&&!!_.clearcoatNormalMap,xe=it&&!!_.clearcoatRoughnessMap,te=I&&!!_.iridescenceMap,ne=I&&!!_.iridescenceThicknessMap,ye=S&&!!_.sheenColorMap,Ne=S&&!!_.sheenRoughnessMap,Ae=!!_.specularMap,Ee=!!_.specularColorMap,Ge=!!_.specularIntensityMap,Xe=W&&!!_.transmissionMap,Ze=W&&!!_.thicknessMap,z=!!_.gradientMap,Me=!!_.alphaMap,ie=_.alphaTest>0,be=!!_.alphaHash,we=!!_.extensions;let oe=zn;_.toneMapped&&(de===null||de.isXRRenderTarget===!0)&&(oe=i.toneMapping);const Be={shaderID:G,shaderType:_.type,shaderName:_.name,vertexShader:qe,fragmentShader:Re,defines:_.defines,customVertexShaderID:j,customFragmentShaderID:pe,isRawShaderMaterial:_.isRawShaderMaterial===!0,glslVersion:_.glslVersion,precision:d,batching:ke,batchingColor:ke&&B._colorsTexture!==null,instancing:ze,instancingColor:ze&&B.instanceColor!==null,instancingMorph:ze&&B.morphTexture!==null,outputColorSpace:de===null?i.outputColorSpace:de.isXRRenderTarget===!0?de.texture.colorSpace:st.workingColorSpace,alphaToCoverage:!!_.alphaToCoverage,map:et,matcap:He,envMap:re,envMapMode:re&&O.mapping,envMapCubeUVHeight:F,aoMap:le,lightMap:he,bumpMap:ce,normalMap:ue,displacementMap:_e,emissiveMap:ge,normalMapObjectSpace:ue&&_.normalMapType===rm,normalMapTangentSpace:ue&&_.normalMapType===Fa,packedNormalMap:ue&&_.normalMapType===Fa&&xS(_.normalMap.format),metalnessMap:Fe,roughnessMap:We,anisotropy:k,anisotropyMap:$,clearcoat:it,clearcoatMap:ee,clearcoatNormalMap:ve,clearcoatRoughnessMap:xe,dispersion:Qe,iridescence:I,iridescenceMap:te,iridescenceThicknessMap:ne,sheen:S,sheenColorMap:ye,sheenRoughnessMap:Ne,specularMap:Ae,specularColorMap:Ee,specularIntensityMap:Ge,transmission:W,transmissionMap:Xe,thicknessMap:Ze,gradientMap:z,opaque:_.transparent===!1&&_.blending===Oi&&_.alphaToCoverage===!1,alphaMap:Me,alphaTest:ie,alphaHash:be,combine:_.combine,mapUv:et&&m(_.map.channel),aoMapUv:le&&m(_.aoMap.channel),lightMapUv:he&&m(_.lightMap.channel),bumpMapUv:ce&&m(_.bumpMap.channel),normalMapUv:ue&&m(_.normalMap.channel),displacementMapUv:_e&&m(_.displacementMap.channel),emissiveMapUv:ge&&m(_.emissiveMap.channel),metalnessMapUv:Fe&&m(_.metalnessMap.channel),roughnessMapUv:We&&m(_.roughnessMap.channel),anisotropyMapUv:$&&m(_.anisotropyMap.channel),clearcoatMapUv:ee&&m(_.clearcoatMap.channel),clearcoatNormalMapUv:ve&&m(_.clearcoatNormalMap.channel),clearcoatRoughnessMapUv:xe&&m(_.clearcoatRoughnessMap.channel),iridescenceMapUv:te&&m(_.iridescenceMap.channel),iridescenceThicknessMapUv:ne&&m(_.iridescenceThicknessMap.channel),sheenColorMapUv:ye&&m(_.sheenColorMap.channel),sheenRoughnessMapUv:Ne&&m(_.sheenRoughnessMap.channel),specularMapUv:Ae&&m(_.specularMap.channel),specularColorMapUv:Ee&&m(_.specularColorMap.channel),specularIntensityMapUv:Ge&&m(_.specularIntensityMap.channel),transmissionMapUv:Xe&&m(_.transmissionMap.channel),thicknessMapUv:Ze&&m(_.thicknessMap.channel),alphaMapUv:Me&&m(_.alphaMap.channel),vertexTangents:!!C.attributes.tangent&&(ue||k),vertexNormals:!!C.attributes.normal,vertexColors:_.vertexColors,vertexAlphas:_.vertexColors===!0&&!!C.attributes.color&&C.attributes.color.itemSize===4,pointsUvs:B.isPoints===!0&&!!C.attributes.uv&&(et||Me),fog:!!p,useFog:_.fog===!0,fogExp2:!!p&&p.isFogExp2,flatShading:_.wireframe===!1&&(_.flatShading===!0||C.attributes.normal===void 0&&ue===!1&&(_.isMeshLambertMaterial||_.isMeshPhongMaterial||_.isMeshStandardMaterial||_.isMeshPhysicalMaterial)),sizeAttenuation:_.sizeAttenuation===!0,logarithmicDepthBuffer:f,reversedDepthBuffer:De,skinning:B.isSkinnedMesh===!0,hasPositionAttribute:C.attributes.position!==void 0,morphTargets:C.morphAttributes.position!==void 0,morphNormals:C.morphAttributes.normal!==void 0,morphColors:C.morphAttributes.color!==void 0,morphTargetsCount:ae,morphTextureStride:Te,numDirLights:b.directional.length,numPointLights:b.point.length,numSpotLights:b.spot.length,numSpotLightMaps:b.spotLightMap.length,numRectAreaLights:b.rectArea.length,numHemiLights:b.hemi.length,numDirLightShadows:b.directionalShadowMap.length,numPointLightShadows:b.pointShadowMap.length,numSpotLightShadows:b.spotShadowMap.length,numSpotLightShadowsWithMaps:b.numSpotLightShadowsWithMaps,numLightProbes:b.numLightProbes,numLightProbeGrids:Y.length,numClippingPlanes:r.numPlanes,numClipIntersection:r.numIntersection,dithering:_.dithering,shadowMapEnabled:i.shadowMap.enabled&&P.length>0,shadowMapType:i.shadowMap.type,toneMapping:oe,decodeVideoTexture:et&&_.map.isVideoTexture===!0&&st.getTransfer(_.map.colorSpace)===pt,decodeVideoTextureEmissive:ge&&_.emissiveMap.isVideoTexture===!0&&st.getTransfer(_.emissiveMap.colorSpace)===pt,premultipliedAlpha:_.premultipliedAlpha,doubleSided:_.side===Cn,flipSided:_.side===en,useDepthPacking:_.depthPacking>=0,depthPacking:_.depthPacking||0,index0AttributeName:_.index0AttributeName,extensionClipCullDistance:we&&_.extensions.clipCullDistance===!0&&t.has("WEBGL_clip_cull_distance"),extensionMultiDraw:(we&&_.extensions.multiDraw===!0||ke)&&t.has("WEBGL_multi_draw"),rendererExtensionParallelShaderCompile:t.has("KHR_parallel_shader_compile"),customProgramCacheKey:_.customProgramCacheKey()};return Be.vertexUv1s=l.has(1),Be.vertexUv2s=l.has(2),Be.vertexUv3s=l.has(3),l.clear(),Be}function v(_){const b=[];if(_.shaderID?b.push(_.shaderID):(b.push(_.customVertexShaderID),b.push(_.customFragmentShaderID)),_.defines!==void 0)for(const P in _.defines)b.push(P),b.push(_.defines[P]);return _.isRawShaderMaterial===!1&&(g(b,_),y(b,_),b.push(i.outputColorSpace)),b.push(_.customProgramCacheKey),b.join()}function g(_,b){_.push(b.precision),_.push(b.outputColorSpace),_.push(b.envMapMode),_.push(b.envMapCubeUVHeight),_.push(b.mapUv),_.push(b.alphaMapUv),_.push(b.lightMapUv),_.push(b.aoMapUv),_.push(b.bumpMapUv),_.push(b.normalMapUv),_.push(b.displacementMapUv),_.push(b.emissiveMapUv),_.push(b.metalnessMapUv),_.push(b.roughnessMapUv),_.push(b.anisotropyMapUv),_.push(b.clearcoatMapUv),_.push(b.clearcoatNormalMapUv),_.push(b.clearcoatRoughnessMapUv),_.push(b.iridescenceMapUv),_.push(b.iridescenceThicknessMapUv),_.push(b.sheenColorMapUv),_.push(b.sheenRoughnessMapUv),_.push(b.specularMapUv),_.push(b.specularColorMapUv),_.push(b.specularIntensityMapUv),_.push(b.transmissionMapUv),_.push(b.thicknessMapUv),_.push(b.combine),_.push(b.fogExp2),_.push(b.sizeAttenuation),_.push(b.morphTargetsCount),_.push(b.morphAttributeCount),_.push(b.numDirLights),_.push(b.numPointLights),_.push(b.numSpotLights),_.push(b.numSpotLightMaps),_.push(b.numHemiLights),_.push(b.numRectAreaLights),_.push(b.numDirLightShadows),_.push(b.numPointLightShadows),_.push(b.numSpotLightShadows),_.push(b.numSpotLightShadowsWithMaps),_.push(b.numLightProbes),_.push(b.shadowMapType),_.push(b.toneMapping),_.push(b.numClippingPlanes),_.push(b.numClipIntersection),_.push(b.depthPacking)}function y(_,b){a.disableAll(),b.instancing&&a.enable(0),b.instancingColor&&a.enable(1),b.instancingMorph&&a.enable(2),b.matcap&&a.enable(3),b.envMap&&a.enable(4),b.normalMapObjectSpace&&a.enable(5),b.normalMapTangentSpace&&a.enable(6),b.clearcoat&&a.enable(7),b.iridescence&&a.enable(8),b.alphaTest&&a.enable(9),b.vertexColors&&a.enable(10),b.vertexAlphas&&a.enable(11),b.vertexUv1s&&a.enable(12),b.vertexUv2s&&a.enable(13),b.vertexUv3s&&a.enable(14),b.vertexTangents&&a.enable(15),b.anisotropy&&a.enable(16),b.alphaHash&&a.enable(17),b.batching&&a.enable(18),b.dispersion&&a.enable(19),b.batchingColor&&a.enable(20),b.gradientMap&&a.enable(21),b.packedNormalMap&&a.enable(22),b.vertexNormals&&a.enable(23),_.push(a.mask),a.disableAll(),b.fog&&a.enable(0),b.useFog&&a.enable(1),b.flatShading&&a.enable(2),b.logarithmicDepthBuffer&&a.enable(3),b.reversedDepthBuffer&&a.enable(4),b.skinning&&a.enable(5),b.morphTargets&&a.enable(6),b.morphNormals&&a.enable(7),b.morphColors&&a.enable(8),b.premultipliedAlpha&&a.enable(9),b.shadowMapEnabled&&a.enable(10),b.doubleSided&&a.enable(11),b.flipSided&&a.enable(12),b.useDepthPacking&&a.enable(13),b.dithering&&a.enable(14),b.transmission&&a.enable(15),b.sheen&&a.enable(16),b.opaque&&a.enable(17),b.pointsUvs&&a.enable(18),b.decodeVideoTexture&&a.enable(19),b.decodeVideoTextureEmissive&&a.enable(20),b.alphaToCoverage&&a.enable(21),b.numLightProbeGrids>0&&a.enable(22),b.hasPositionAttribute&&a.enable(23),_.push(a.mask)}function E(_){const b=u[_.type];let P;if(b){const L=On[b];P=Ir.clone(L.uniforms)}else P=_.uniforms;return P}function M(_,b){let P=h.get(b);return P!==void 0?++P.usedTimes:(P=new mS(i,b,_,s),c.push(P),h.set(b,P)),P}function T(_){if(--_.usedTimes===0){const b=c.indexOf(_);c[b]=c[c.length-1],c.pop(),h.delete(_.cacheKey),_.destroy()}}function w(_){o.remove(_)}function R(){o.dispose()}return{getParameters:x,getProgramCacheKey:v,getUniforms:E,acquireProgram:M,releaseProgram:T,releaseShaderCache:w,programs:c,dispose:R}}function MS(){let i=new WeakMap;function e(a){return i.has(a)}function t(a){let o=i.get(a);return o===void 0&&(o={},i.set(a,o)),o}function n(a){i.delete(a)}function s(a,o,l){i.get(a)[o]=l}function r(){i=new WeakMap}return{has:e,get:t,remove:n,update:s,dispose:r}}function yS(i,e){return i.groupOrder!==e.groupOrder?i.groupOrder-e.groupOrder:i.renderOrder!==e.renderOrder?i.renderOrder-e.renderOrder:i.material.id!==e.material.id?i.material.id-e.material.id:i.materialVariant!==e.materialVariant?i.materialVariant-e.materialVariant:i.z!==e.z?i.z-e.z:i.id-e.id}function Ru(i,e){return i.groupOrder!==e.groupOrder?i.groupOrder-e.groupOrder:i.renderOrder!==e.renderOrder?i.renderOrder-e.renderOrder:i.z!==e.z?e.z-i.z:i.id-e.id}function Pu(){const i=[];let e=0;const t=[],n=[],s=[];function r(){e=0,t.length=0,n.length=0,s.length=0}function a(d){let u=0;return d.isInstancedMesh&&(u+=2),d.isSkinnedMesh&&(u+=1),u}function o(d,u,m,x,v,g){let y=i[e];return y===void 0?(y={id:d.id,object:d,geometry:u,material:m,materialVariant:a(d),groupOrder:x,renderOrder:d.renderOrder,z:v,group:g},i[e]=y):(y.id=d.id,y.object=d,y.geometry=u,y.material=m,y.materialVariant=a(d),y.groupOrder=x,y.renderOrder=d.renderOrder,y.z=v,y.group=g),e++,y}function l(d,u,m,x,v,g){const y=o(d,u,m,x,v,g);m.transmission>0?n.push(y):m.transparent===!0?s.push(y):t.push(y)}function c(d,u,m,x,v,g){const y=o(d,u,m,x,v,g);m.transmission>0?n.unshift(y):m.transparent===!0?s.unshift(y):t.unshift(y)}function h(d,u,m){t.length>1&&t.sort(d||yS),n.length>1&&n.sort(u||Ru),s.length>1&&s.sort(u||Ru),m&&(t.reverse(),n.reverse(),s.reverse())}function f(){for(let d=e,u=i.length;d<u;d++){const m=i[d];if(m.id===null)break;m.id=null,m.object=null,m.geometry=null,m.material=null,m.group=null}}return{opaque:t,transmissive:n,transparent:s,init:r,push:l,unshift:c,finish:f,sort:h}}function bS(){let i=new WeakMap;function e(n,s){const r=i.get(n);let a;return r===void 0?(a=new Pu,i.set(n,[a])):s>=r.length?(a=new Pu,r.push(a)):a=r[s],a}function t(){i=new WeakMap}return{get:e,dispose:t}}function ES(){const i={};return{get:function(e){if(i[e.id]!==void 0)return i[e.id];let t;switch(e.type){case"DirectionalLight":t={direction:new N,color:new Le};break;case"SpotLight":t={position:new N,direction:new N,color:new Le,distance:0,coneCos:0,penumbraCos:0,decay:0};break;case"PointLight":t={position:new N,color:new Le,distance:0,decay:0};break;case"HemisphereLight":t={direction:new N,skyColor:new Le,groundColor:new Le};break;case"RectAreaLight":t={color:new Le,position:new N,halfWidth:new N,halfHeight:new N};break}return i[e.id]=t,t}}}function TS(){const i={};return{get:function(e){if(i[e.id]!==void 0)return i[e.id];let t;switch(e.type){case"DirectionalLight":t={shadowIntensity:1,shadowBias:0,shadowNormalBias:0,shadowRadius:1,shadowMapSize:new fe};break;case"SpotLight":t={shadowIntensity:1,shadowBias:0,shadowNormalBias:0,shadowRadius:1,shadowMapSize:new fe};break;case"PointLight":t={shadowIntensity:1,shadowBias:0,shadowNormalBias:0,shadowRadius:1,shadowMapSize:new fe,shadowCameraNear:1,shadowCameraFar:1e3};break}return i[e.id]=t,t}}}let AS=0;function wS(i,e){return(e.castShadow?2:0)-(i.castShadow?2:0)+(e.map?1:0)-(i.map?1:0)}function CS(i){const e=new ES,t=TS(),n={version:0,hash:{directionalLength:-1,pointLength:-1,spotLength:-1,rectAreaLength:-1,hemiLength:-1,numDirectionalShadows:-1,numPointShadows:-1,numSpotShadows:-1,numSpotMaps:-1,numLightProbes:-1},ambient:[0,0,0],probe:[],directional:[],directionalShadow:[],directionalShadowMap:[],directionalShadowMatrix:[],spot:[],spotLightMap:[],spotShadow:[],spotShadowMap:[],spotLightMatrix:[],rectArea:[],rectAreaLTC1:null,rectAreaLTC2:null,point:[],pointShadow:[],pointShadowMap:[],pointShadowMatrix:[],hemi:[],numSpotLightShadowsWithMaps:0,numLightProbes:0};for(let c=0;c<9;c++)n.probe.push(new N);const s=new N,r=new ut,a=new ut;function o(c){let h=0,f=0,d=0;for(let b=0;b<9;b++)n.probe[b].set(0,0,0);let u=0,m=0,x=0,v=0,g=0,y=0,E=0,M=0,T=0,w=0,R=0;c.sort(wS);for(let b=0,P=c.length;b<P;b++){const L=c[b],B=L.color,Y=L.intensity,p=L.distance;let C=null;if(L.shadow&&L.shadow.map&&(L.shadow.map.texture.format===Vi?C=L.shadow.map.texture:C=L.shadow.map.depthTexture||L.shadow.map.texture),L.isAmbientLight)h+=B.r*Y,f+=B.g*Y,d+=B.b*Y;else if(L.isLightProbe){for(let D=0;D<9;D++)n.probe[D].addScaledVector(L.sh.coefficients[D],Y);R++}else if(L.isDirectionalLight){const D=e.get(L);if(D.color.copy(L.color).multiplyScalar(L.intensity),L.castShadow){const U=L.shadow,O=t.get(L);O.shadowIntensity=U.intensity,O.shadowBias=U.bias,O.shadowNormalBias=U.normalBias,O.shadowRadius=U.radius,O.shadowMapSize=U.mapSize,n.directionalShadow[u]=O,n.directionalShadowMap[u]=C,n.directionalShadowMatrix[u]=L.shadow.matrix,y++}n.directional[u]=D,u++}else if(L.isSpotLight){const D=e.get(L);D.position.setFromMatrixPosition(L.matrixWorld),D.color.copy(B).multiplyScalar(Y),D.distance=p,D.coneCos=Math.cos(L.angle),D.penumbraCos=Math.cos(L.angle*(1-L.penumbra)),D.decay=L.decay,n.spot[x]=D;const U=L.shadow;if(L.map&&(n.spotLightMap[T]=L.map,T++,U.updateMatrices(L),L.castShadow&&w++),n.spotLightMatrix[x]=U.matrix,L.castShadow){const O=t.get(L);O.shadowIntensity=U.intensity,O.shadowBias=U.bias,O.shadowNormalBias=U.normalBias,O.shadowRadius=U.radius,O.shadowMapSize=U.mapSize,n.spotShadow[x]=O,n.spotShadowMap[x]=C,M++}x++}else if(L.isRectAreaLight){const D=e.get(L);D.color.copy(B).multiplyScalar(Y),D.halfWidth.set(L.width*.5,0,0),D.halfHeight.set(0,L.height*.5,0),n.rectArea[v]=D,v++}else if(L.isPointLight){const D=e.get(L);if(D.color.copy(L.color).multiplyScalar(L.intensity),D.distance=L.distance,D.decay=L.decay,L.castShadow){const U=L.shadow,O=t.get(L);O.shadowIntensity=U.intensity,O.shadowBias=U.bias,O.shadowNormalBias=U.normalBias,O.shadowRadius=U.radius,O.shadowMapSize=U.mapSize,O.shadowCameraNear=U.camera.near,O.shadowCameraFar=U.camera.far,n.pointShadow[m]=O,n.pointShadowMap[m]=C,n.pointShadowMatrix[m]=L.shadow.matrix,E++}n.point[m]=D,m++}else if(L.isHemisphereLight){const D=e.get(L);D.skyColor.copy(L.color).multiplyScalar(Y),D.groundColor.copy(L.groundColor).multiplyScalar(Y),n.hemi[g]=D,g++}}v>0&&(i.has("OES_texture_float_linear")===!0?(n.rectAreaLTC1=Pe.LTC_FLOAT_1,n.rectAreaLTC2=Pe.LTC_FLOAT_2):(n.rectAreaLTC1=Pe.LTC_HALF_1,n.rectAreaLTC2=Pe.LTC_HALF_2)),n.ambient[0]=h,n.ambient[1]=f,n.ambient[2]=d;const _=n.hash;(_.directionalLength!==u||_.pointLength!==m||_.spotLength!==x||_.rectAreaLength!==v||_.hemiLength!==g||_.numDirectionalShadows!==y||_.numPointShadows!==E||_.numSpotShadows!==M||_.numSpotMaps!==T||_.numLightProbes!==R)&&(n.directional.length=u,n.spot.length=x,n.rectArea.length=v,n.point.length=m,n.hemi.length=g,n.directionalShadow.length=y,n.directionalShadowMap.length=y,n.pointShadow.length=E,n.pointShadowMap.length=E,n.spotShadow.length=M,n.spotShadowMap.length=M,n.directionalShadowMatrix.length=y,n.pointShadowMatrix.length=E,n.spotLightMatrix.length=M+T-w,n.spotLightMap.length=T,n.numSpotLightShadowsWithMaps=w,n.numLightProbes=R,_.directionalLength=u,_.pointLength=m,_.spotLength=x,_.rectAreaLength=v,_.hemiLength=g,_.numDirectionalShadows=y,_.numPointShadows=E,_.numSpotShadows=M,_.numSpotMaps=T,_.numLightProbes=R,n.version=AS++)}function l(c,h){let f=0,d=0,u=0,m=0,x=0;const v=h.matrixWorldInverse;for(let g=0,y=c.length;g<y;g++){const E=c[g];if(E.isDirectionalLight){const M=n.directional[f];M.direction.setFromMatrixPosition(E.matrixWorld),s.setFromMatrixPosition(E.target.matrixWorld),M.direction.sub(s),M.direction.transformDirection(v),f++}else if(E.isSpotLight){const M=n.spot[u];M.position.setFromMatrixPosition(E.matrixWorld),M.position.applyMatrix4(v),M.direction.setFromMatrixPosition(E.matrixWorld),s.setFromMatrixPosition(E.target.matrixWorld),M.direction.sub(s),M.direction.transformDirection(v),u++}else if(E.isRectAreaLight){const M=n.rectArea[m];M.position.setFromMatrixPosition(E.matrixWorld),M.position.applyMatrix4(v),a.identity(),r.copy(E.matrixWorld),r.premultiply(v),a.extractRotation(r),M.halfWidth.set(E.width*.5,0,0),M.halfHeight.set(0,E.height*.5,0),M.halfWidth.applyMatrix4(a),M.halfHeight.applyMatrix4(a),m++}else if(E.isPointLight){const M=n.point[d];M.position.setFromMatrixPosition(E.matrixWorld),M.position.applyMatrix4(v),d++}else if(E.isHemisphereLight){const M=n.hemi[x];M.direction.setFromMatrixPosition(E.matrixWorld),M.direction.transformDirection(v),x++}}}return{setup:o,setupView:l,state:n}}function Iu(i){const e=new CS(i),t=[],n=[],s=[];function r(d){f.camera=d,t.length=0,n.length=0,s.length=0}function a(d){t.push(d)}function o(d){n.push(d)}function l(d){s.push(d)}function c(){e.setup(t)}function h(d){e.setupView(t,d)}const f={lightsArray:t,shadowsArray:n,lightProbeGridArray:s,camera:null,lights:e,transmissionRenderTarget:{},textureUnits:0};return{init:r,state:f,setupLights:c,setupLightsView:h,pushLight:a,pushShadow:o,pushLightProbeGrid:l}}function RS(i){let e=new WeakMap;function t(s,r=0){const a=e.get(s);let o;return a===void 0?(o=new Iu(i),e.set(s,[o])):r>=a.length?(o=new Iu(i),a.push(o)):o=a[r],o}function n(){e=new WeakMap}return{get:t,dispose:n}}const PS=`void main() {
	gl_Position = vec4( position, 1.0 );
}`,IS=`uniform sampler2D shadow_pass;
uniform vec2 resolution;
uniform float radius;
void main() {
	const float samples = float( VSM_SAMPLES );
	float mean = 0.0;
	float squared_mean = 0.0;
	float uvStride = samples <= 1.0 ? 0.0 : 2.0 / ( samples - 1.0 );
	float uvStart = samples <= 1.0 ? 0.0 : - 1.0;
	for ( float i = 0.0; i < samples; i ++ ) {
		float uvOffset = uvStart + i * uvStride;
		#ifdef HORIZONTAL_PASS
			vec2 distribution = texture2D( shadow_pass, ( gl_FragCoord.xy + vec2( uvOffset, 0.0 ) * radius ) / resolution ).rg;
			mean += distribution.x;
			squared_mean += distribution.y * distribution.y + distribution.x * distribution.x;
		#else
			float depth = texture2D( shadow_pass, ( gl_FragCoord.xy + vec2( 0.0, uvOffset ) * radius ) / resolution ).r;
			mean += depth;
			squared_mean += depth * depth;
		#endif
	}
	mean = mean / samples;
	squared_mean = squared_mean / samples;
	float std_dev = sqrt( max( 0.0, squared_mean - mean * mean ) );
	gl_FragColor = vec4( mean, std_dev, 0.0, 1.0 );
}`,LS=[new N(1,0,0),new N(-1,0,0),new N(0,1,0),new N(0,-1,0),new N(0,0,1),new N(0,0,-1)],DS=[new N(0,-1,0),new N(0,-1,0),new N(0,0,1),new N(0,0,-1),new N(0,-1,0),new N(0,-1,0)],Lu=new ut,ar=new N,Jo=new N;function NS(i,e,t){let n=new Yc;const s=new fe,r=new fe,a=new Rt,o=new k0,l=new G0,c={},h=t.maxTextureSize,f={[li]:en,[en]:li,[Cn]:Cn},d=new $t({defines:{VSM_SAMPLES:8},uniforms:{shadow_pass:{value:null},resolution:{value:new fe},radius:{value:4}},vertexShader:PS,fragmentShader:IS}),u=d.clone();u.defines.HORIZONTAL_PASS=1;const m=new It;m.setAttribute("position",new Gt(new Float32Array([-1,-1,.5,3,-1,.5,-1,3,.5]),3));const x=new $e(m,d),v=this;this.enabled=!1,this.autoUpdate=!0,this.needsUpdate=!1,this.type=ba;let g=this.type;this.render=function(w,R,_){if(v.enabled===!1||v.autoUpdate===!1&&v.needsUpdate===!1||w.length===0)return;this.type===hd&&(Ke("WebGLShadowMap: PCFSoftShadowMap has been deprecated. Using PCFShadowMap instead."),this.type=ba);const b=i.getRenderTarget(),P=i.getActiveCubeFace(),L=i.getActiveMipmapLevel(),B=i.state;B.setBlending(Gn),B.buffers.depth.getReversed()===!0?B.buffers.color.setClear(0,0,0,0):B.buffers.color.setClear(1,1,1,1),B.buffers.depth.setTest(!0),B.setScissorTest(!1);const Y=g!==this.type;Y&&R.traverse(function(p){p.material&&(Array.isArray(p.material)?p.material.forEach(C=>C.needsUpdate=!0):p.material.needsUpdate=!0)});for(let p=0,C=w.length;p<C;p++){const D=w[p],U=D.shadow;if(U===void 0){Ke("WebGLShadowMap:",D,"has no shadow.");continue}if(U.autoUpdate===!1&&U.needsUpdate===!1)continue;s.copy(U.mapSize);const O=U.getFrameExtents();s.multiply(O),r.copy(U.mapSize),(s.x>h||s.y>h)&&(s.x>h&&(r.x=Math.floor(h/O.x),s.x=r.x*O.x,U.mapSize.x=r.x),s.y>h&&(r.y=Math.floor(h/O.y),s.y=r.y*O.y,U.mapSize.y=r.y));const F=i.state.buffers.depth.getReversed();if(U.camera._reversedDepth=F,U.map===null||Y===!0){if(U.map!==null&&(U.map.depthTexture!==null&&(U.map.depthTexture.dispose(),U.map.depthTexture=null),U.map.dispose()),this.type===ur){if(D.isPointLight){Ke("WebGLShadowMap: VSM shadow maps are not supported for PointLights. Use PCF or BasicShadowMap instead.");continue}U.map=new nn(s.x,s.y,{format:Vi,type:dn,minFilter:Ft,magFilter:Ft,generateMipmaps:!1}),U.map.texture.name=D.name+".shadowMap",U.map.depthTexture=new Ds(s.x,s.y,In),U.map.depthTexture.name=D.name+".shadowMapDepth",U.map.depthTexture.format=ci,U.map.depthTexture.compareFunction=null,U.map.depthTexture.minFilter=Xt,U.map.depthTexture.magFilter=Xt}else D.isPointLight?(U.map=new Zd(s.x),U.map.depthTexture=new t0(s.x,Xn)):(U.map=new nn(s.x,s.y),U.map.depthTexture=new Ds(s.x,s.y,Xn)),U.map.depthTexture.name=D.name+".shadowMap",U.map.depthTexture.format=ci,this.type===ba?(U.map.depthTexture.compareFunction=F?Hc:zc,U.map.depthTexture.minFilter=Ft,U.map.depthTexture.magFilter=Ft):(U.map.depthTexture.compareFunction=null,U.map.depthTexture.minFilter=Xt,U.map.depthTexture.magFilter=Xt);U.camera.updateProjectionMatrix()}const G=U.map.isWebGLCubeRenderTarget?6:1;for(let Z=0;Z<G;Z++){if(U.map.isWebGLCubeRenderTarget)i.setRenderTarget(U.map,Z),i.clear();else{Z===0&&(i.setRenderTarget(U.map),i.clear());const ae=U.getViewport(Z);a.set(r.x*ae.x,r.y*ae.y,r.x*ae.z,r.y*ae.w),B.viewport(a)}if(D.isPointLight){const ae=U.camera,Te=U.matrix,qe=D.distance||ae.far;qe!==ae.far&&(ae.far=qe,ae.updateProjectionMatrix()),ar.setFromMatrixPosition(D.matrixWorld),ae.position.copy(ar),Jo.copy(ae.position),Jo.add(LS[Z]),ae.up.copy(DS[Z]),ae.lookAt(Jo),ae.updateMatrixWorld(),Te.makeTranslation(-ar.x,-ar.y,-ar.z),Lu.multiplyMatrices(ae.projectionMatrix,ae.matrixWorldInverse),U._frustum.setFromProjectionMatrix(Lu,ae.coordinateSystem,ae.reversedDepth)}else U.updateMatrices(D);n=U.getFrustum(),M(R,_,U.camera,D,this.type)}U.isPointLightShadow!==!0&&this.type===ur&&y(U,_),U.needsUpdate=!1}g=this.type,v.needsUpdate=!1,i.setRenderTarget(b,P,L)};function y(w,R){const _=e.update(x);d.defines.VSM_SAMPLES!==w.blurSamples&&(d.defines.VSM_SAMPLES=w.blurSamples,u.defines.VSM_SAMPLES=w.blurSamples,d.needsUpdate=!0,u.needsUpdate=!0),w.mapPass===null&&(w.mapPass=new nn(s.x,s.y,{format:Vi,type:dn})),d.uniforms.shadow_pass.value=w.map.depthTexture,d.uniforms.resolution.value=w.mapSize,d.uniforms.radius.value=w.radius,i.setRenderTarget(w.mapPass),i.clear(),i.renderBufferDirect(R,null,_,d,x,null),u.uniforms.shadow_pass.value=w.mapPass.texture,u.uniforms.resolution.value=w.mapSize,u.uniforms.radius.value=w.radius,i.setRenderTarget(w.map),i.clear(),i.renderBufferDirect(R,null,_,u,x,null)}function E(w,R,_,b){let P=null;const L=_.isPointLight===!0?w.customDistanceMaterial:w.customDepthMaterial;if(L!==void 0)P=L;else if(P=_.isPointLight===!0?l:o,i.localClippingEnabled&&R.clipShadows===!0&&Array.isArray(R.clippingPlanes)&&R.clippingPlanes.length!==0||R.displacementMap&&R.displacementScale!==0||R.alphaMap&&R.alphaTest>0||R.map&&R.alphaTest>0||R.alphaToCoverage===!0){const B=P.uuid,Y=R.uuid;let p=c[B];p===void 0&&(p={},c[B]=p);let C=p[Y];C===void 0&&(C=P.clone(),p[Y]=C,R.addEventListener("dispose",T)),P=C}if(P.visible=R.visible,P.wireframe=R.wireframe,b===ur?P.side=R.shadowSide!==null?R.shadowSide:R.side:P.side=R.shadowSide!==null?R.shadowSide:f[R.side],P.alphaMap=R.alphaMap,P.alphaTest=R.alphaToCoverage===!0?.5:R.alphaTest,P.map=R.map,P.clipShadows=R.clipShadows,P.clippingPlanes=R.clippingPlanes,P.clipIntersection=R.clipIntersection,P.displacementMap=R.displacementMap,P.displacementScale=R.displacementScale,P.displacementBias=R.displacementBias,P.wireframeLinewidth=R.wireframeLinewidth,P.linewidth=R.linewidth,_.isPointLight===!0&&P.isMeshDistanceMaterial===!0){const B=i.properties.get(P);B.light=_}return P}function M(w,R,_,b,P){if(w.visible===!1)return;if(w.layers.test(R.layers)&&(w.isMesh||w.isLine||w.isPoints)&&(w.castShadow||w.receiveShadow&&P===ur)&&(!w.frustumCulled||n.intersectsObject(w))){w.modelViewMatrix.multiplyMatrices(_.matrixWorldInverse,w.matrixWorld);const Y=e.update(w),p=w.material;if(Array.isArray(p)){const C=Y.groups;for(let D=0,U=C.length;D<U;D++){const O=C[D],F=p[O.materialIndex];if(F&&F.visible){const G=E(w,F,b,P);w.onBeforeShadow(i,w,R,_,Y,G,O),i.renderBufferDirect(_,null,Y,G,w,O),w.onAfterShadow(i,w,R,_,Y,G,O)}}}else if(p.visible){const C=E(w,p,b,P);w.onBeforeShadow(i,w,R,_,Y,C,null),i.renderBufferDirect(_,null,Y,C,w,null),w.onAfterShadow(i,w,R,_,Y,C,null)}}const B=w.children;for(let Y=0,p=B.length;Y<p;Y++)M(B[Y],R,_,b,P)}function T(w){w.target.removeEventListener("dispose",T);for(const _ in c){const b=c[_],P=w.target.uuid;P in b&&(b[P].dispose(),delete b[P])}}}function US(i,e){function t(){let z=!1;const Me=new Rt;let ie=null;const be=new Rt(0,0,0,0);return{setMask:function(we){ie!==we&&!z&&(i.colorMask(we,we,we,we),ie=we)},setLocked:function(we){z=we},setClear:function(we,oe,Be,Ue,At){At===!0&&(we*=Ue,oe*=Ue,Be*=Ue),Me.set(we,oe,Be,Ue),be.equals(Me)===!1&&(i.clearColor(we,oe,Be,Ue),be.copy(Me))},reset:function(){z=!1,ie=null,be.set(-1,0,0,0)}}}function n(){let z=!1,Me=!1,ie=null,be=null,we=null;return{setReversed:function(oe){if(Me!==oe){const Be=e.get("EXT_clip_control");oe?Be.clipControlEXT(Be.LOWER_LEFT_EXT,Be.ZERO_TO_ONE_EXT):Be.clipControlEXT(Be.LOWER_LEFT_EXT,Be.NEGATIVE_ONE_TO_ONE_EXT),Me=oe;const Ue=we;we=null,this.setClear(Ue)}},getReversed:function(){return Me},setTest:function(oe){oe?de(i.DEPTH_TEST):De(i.DEPTH_TEST)},setMask:function(oe){ie!==oe&&!z&&(i.depthMask(oe),ie=oe)},setFunc:function(oe){if(Me&&(oe=mm[oe]),be!==oe){switch(oe){case fl:i.depthFunc(i.NEVER);break;case pl:i.depthFunc(i.ALWAYS);break;case ml:i.depthFunc(i.LESS);break;case Ps:i.depthFunc(i.LEQUAL);break;case gl:i.depthFunc(i.EQUAL);break;case vl:i.depthFunc(i.GEQUAL);break;case _l:i.depthFunc(i.GREATER);break;case xl:i.depthFunc(i.NOTEQUAL);break;default:i.depthFunc(i.LEQUAL)}be=oe}},setLocked:function(oe){z=oe},setClear:function(oe){we!==oe&&(we=oe,Me&&(oe=1-oe),i.clearDepth(oe))},reset:function(){z=!1,ie=null,be=null,we=null,Me=!1}}}function s(){let z=!1,Me=null,ie=null,be=null,we=null,oe=null,Be=null,Ue=null,At=null;return{setTest:function(vt){z||(vt?de(i.STENCIL_TEST):De(i.STENCIL_TEST))},setMask:function(vt){Me!==vt&&!z&&(i.stencilMask(vt),Me=vt)},setFunc:function(vt,rn,fn){(ie!==vt||be!==rn||we!==fn)&&(i.stencilFunc(vt,rn,fn),ie=vt,be=rn,we=fn)},setOp:function(vt,rn,fn){(oe!==vt||Be!==rn||Ue!==fn)&&(i.stencilOp(vt,rn,fn),oe=vt,Be=rn,Ue=fn)},setLocked:function(vt){z=vt},setClear:function(vt){At!==vt&&(i.clearStencil(vt),At=vt)},reset:function(){z=!1,Me=null,ie=null,be=null,we=null,oe=null,Be=null,Ue=null,At=null}}}const r=new t,a=new n,o=new s,l=new WeakMap,c=new WeakMap;let h={},f={},d={},u=new WeakMap,m=[],x=null,v=!1,g=null,y=null,E=null,M=null,T=null,w=null,R=null,_=new Le(0,0,0),b=0,P=!1,L=null,B=null,Y=null,p=null,C=null;const D=i.getParameter(i.MAX_COMBINED_TEXTURE_IMAGE_UNITS);let U=!1,O=0;const F=i.getParameter(i.VERSION);F.indexOf("WebGL")!==-1?(O=parseFloat(/^WebGL (\d)/.exec(F)[1]),U=O>=1):F.indexOf("OpenGL ES")!==-1&&(O=parseFloat(/^OpenGL ES (\d)/.exec(F)[1]),U=O>=2);let G=null,Z={};const ae=i.getParameter(i.SCISSOR_BOX),Te=i.getParameter(i.VIEWPORT),qe=new Rt().fromArray(ae),Re=new Rt().fromArray(Te);function j(z,Me,ie,be){const we=new Uint8Array(4),oe=i.createTexture();i.bindTexture(z,oe),i.texParameteri(z,i.TEXTURE_MIN_FILTER,i.NEAREST),i.texParameteri(z,i.TEXTURE_MAG_FILTER,i.NEAREST);for(let Be=0;Be<ie;Be++)z===i.TEXTURE_3D||z===i.TEXTURE_2D_ARRAY?i.texImage3D(Me,0,i.RGBA,1,1,be,0,i.RGBA,i.UNSIGNED_BYTE,we):i.texImage2D(Me+Be,0,i.RGBA,1,1,0,i.RGBA,i.UNSIGNED_BYTE,we);return oe}const pe={};pe[i.TEXTURE_2D]=j(i.TEXTURE_2D,i.TEXTURE_2D,1),pe[i.TEXTURE_CUBE_MAP]=j(i.TEXTURE_CUBE_MAP,i.TEXTURE_CUBE_MAP_POSITIVE_X,6),pe[i.TEXTURE_2D_ARRAY]=j(i.TEXTURE_2D_ARRAY,i.TEXTURE_2D_ARRAY,1,1),pe[i.TEXTURE_3D]=j(i.TEXTURE_3D,i.TEXTURE_3D,1,1),r.setClear(0,0,0,1),a.setClear(1),o.setClear(0),de(i.DEPTH_TEST),a.setFunc(Ps),ce(!1),ue(Eh),de(i.CULL_FACE),le(Gn);function de(z){h[z]!==!0&&(i.enable(z),h[z]=!0)}function De(z){h[z]!==!1&&(i.disable(z),h[z]=!1)}function ze(z,Me){return d[z]!==Me?(i.bindFramebuffer(z,Me),d[z]=Me,z===i.DRAW_FRAMEBUFFER&&(d[i.FRAMEBUFFER]=Me),z===i.FRAMEBUFFER&&(d[i.DRAW_FRAMEBUFFER]=Me),!0):!1}function ke(z,Me){let ie=m,be=!1;if(z){ie=u.get(Me),ie===void 0&&(ie=[],u.set(Me,ie));const we=z.textures;if(ie.length!==we.length||ie[0]!==i.COLOR_ATTACHMENT0){for(let oe=0,Be=we.length;oe<Be;oe++)ie[oe]=i.COLOR_ATTACHMENT0+oe;ie.length=we.length,be=!0}}else ie[0]!==i.BACK&&(ie[0]=i.BACK,be=!0);be&&i.drawBuffers(ie)}function et(z){return x!==z?(i.useProgram(z),x=z,!0):!1}const He={[Di]:i.FUNC_ADD,[Bp]:i.FUNC_SUBTRACT,[kp]:i.FUNC_REVERSE_SUBTRACT};He[Gp]=i.MIN,He[zp]=i.MAX;const re={[Hp]:i.ZERO,[Vp]:i.ONE,[Wp]:i.SRC_COLOR,[ul]:i.SRC_ALPHA,[Zp]:i.SRC_ALPHA_SATURATE,[Kp]:i.DST_COLOR,[Yp]:i.DST_ALPHA,[Xp]:i.ONE_MINUS_SRC_COLOR,[dl]:i.ONE_MINUS_SRC_ALPHA,[$p]:i.ONE_MINUS_DST_COLOR,[qp]:i.ONE_MINUS_DST_ALPHA,[Jp]:i.CONSTANT_COLOR,[Qp]:i.ONE_MINUS_CONSTANT_COLOR,[jp]:i.CONSTANT_ALPHA,[em]:i.ONE_MINUS_CONSTANT_ALPHA};function le(z,Me,ie,be,we,oe,Be,Ue,At,vt){if(z===Gn){v===!0&&(De(i.BLEND),v=!1);return}if(v===!1&&(de(i.BLEND),v=!0),z!==Op){if(z!==g||vt!==P){if((y!==Di||T!==Di)&&(i.blendEquation(i.FUNC_ADD),y=Di,T=Di),vt)switch(z){case Oi:i.blendFuncSeparate(i.ONE,i.ONE_MINUS_SRC_ALPHA,i.ONE,i.ONE_MINUS_SRC_ALPHA);break;case zi:i.blendFunc(i.ONE,i.ONE);break;case Th:i.blendFuncSeparate(i.ZERO,i.ONE_MINUS_SRC_COLOR,i.ZERO,i.ONE);break;case Ah:i.blendFuncSeparate(i.DST_COLOR,i.ONE_MINUS_SRC_ALPHA,i.ZERO,i.ONE);break;default:at("WebGLState: Invalid blending: ",z);break}else switch(z){case Oi:i.blendFuncSeparate(i.SRC_ALPHA,i.ONE_MINUS_SRC_ALPHA,i.ONE,i.ONE_MINUS_SRC_ALPHA);break;case zi:i.blendFuncSeparate(i.SRC_ALPHA,i.ONE,i.ONE,i.ONE);break;case Th:at("WebGLState: SubtractiveBlending requires material.premultipliedAlpha = true");break;case Ah:at("WebGLState: MultiplyBlending requires material.premultipliedAlpha = true");break;default:at("WebGLState: Invalid blending: ",z);break}E=null,M=null,w=null,R=null,_.set(0,0,0),b=0,g=z,P=vt}return}we=we||Me,oe=oe||ie,Be=Be||be,(Me!==y||we!==T)&&(i.blendEquationSeparate(He[Me],He[we]),y=Me,T=we),(ie!==E||be!==M||oe!==w||Be!==R)&&(i.blendFuncSeparate(re[ie],re[be],re[oe],re[Be]),E=ie,M=be,w=oe,R=Be),(Ue.equals(_)===!1||At!==b)&&(i.blendColor(Ue.r,Ue.g,Ue.b,At),_.copy(Ue),b=At),g=z,P=!1}function he(z,Me){z.side===Cn?De(i.CULL_FACE):de(i.CULL_FACE);let ie=z.side===en;Me&&(ie=!ie),ce(ie),z.blending===Oi&&z.transparent===!1?le(Gn):le(z.blending,z.blendEquation,z.blendSrc,z.blendDst,z.blendEquationAlpha,z.blendSrcAlpha,z.blendDstAlpha,z.blendColor,z.blendAlpha,z.premultipliedAlpha),a.setFunc(z.depthFunc),a.setTest(z.depthTest),a.setMask(z.depthWrite),r.setMask(z.colorWrite);const be=z.stencilWrite;o.setTest(be),be&&(o.setMask(z.stencilWriteMask),o.setFunc(z.stencilFunc,z.stencilRef,z.stencilFuncMask),o.setOp(z.stencilFail,z.stencilZFail,z.stencilZPass)),ge(z.polygonOffset,z.polygonOffsetFactor,z.polygonOffsetUnits),z.alphaToCoverage===!0?de(i.SAMPLE_ALPHA_TO_COVERAGE):De(i.SAMPLE_ALPHA_TO_COVERAGE)}function ce(z){L!==z&&(z?i.frontFace(i.CW):i.frontFace(i.CCW),L=z)}function ue(z){z!==Up?(de(i.CULL_FACE),z!==B&&(z===Eh?i.cullFace(i.BACK):z===Fp?i.cullFace(i.FRONT):i.cullFace(i.FRONT_AND_BACK))):De(i.CULL_FACE),B=z}function _e(z){z!==Y&&(U&&i.lineWidth(z),Y=z)}function ge(z,Me,ie){z?(de(i.POLYGON_OFFSET_FILL),(p!==Me||C!==ie)&&(p=Me,C=ie,a.getReversed()&&(Me=-Me),i.polygonOffset(Me,ie))):De(i.POLYGON_OFFSET_FILL)}function Fe(z){z?de(i.SCISSOR_TEST):De(i.SCISSOR_TEST)}function We(z){z===void 0&&(z=i.TEXTURE0+D-1),G!==z&&(i.activeTexture(z),G=z)}function k(z,Me,ie){ie===void 0&&(G===null?ie=i.TEXTURE0+D-1:ie=G);let be=Z[ie];be===void 0&&(be={type:void 0,texture:void 0},Z[ie]=be),(be.type!==z||be.texture!==Me)&&(G!==ie&&(i.activeTexture(ie),G=ie),i.bindTexture(z,Me||pe[z]),be.type=z,be.texture=Me)}function it(){const z=Z[G];z!==void 0&&z.type!==void 0&&(i.bindTexture(z.type,null),z.type=void 0,z.texture=void 0)}function Qe(){try{i.compressedTexImage2D(...arguments)}catch(z){at("WebGLState:",z)}}function I(){try{i.compressedTexImage3D(...arguments)}catch(z){at("WebGLState:",z)}}function S(){try{i.texSubImage2D(...arguments)}catch(z){at("WebGLState:",z)}}function W(){try{i.texSubImage3D(...arguments)}catch(z){at("WebGLState:",z)}}function $(){try{i.compressedTexSubImage2D(...arguments)}catch(z){at("WebGLState:",z)}}function ee(){try{i.compressedTexSubImage3D(...arguments)}catch(z){at("WebGLState:",z)}}function ve(){try{i.texStorage2D(...arguments)}catch(z){at("WebGLState:",z)}}function xe(){try{i.texStorage3D(...arguments)}catch(z){at("WebGLState:",z)}}function te(){try{i.texImage2D(...arguments)}catch(z){at("WebGLState:",z)}}function ne(){try{i.texImage3D(...arguments)}catch(z){at("WebGLState:",z)}}function ye(z){return f[z]!==void 0?f[z]:i.getParameter(z)}function Ne(z,Me){f[z]!==Me&&(i.pixelStorei(z,Me),f[z]=Me)}function Ae(z){qe.equals(z)===!1&&(i.scissor(z.x,z.y,z.z,z.w),qe.copy(z))}function Ee(z){Re.equals(z)===!1&&(i.viewport(z.x,z.y,z.z,z.w),Re.copy(z))}function Ge(z,Me){let ie=c.get(Me);ie===void 0&&(ie=new WeakMap,c.set(Me,ie));let be=ie.get(z);be===void 0&&(be=i.getUniformBlockIndex(Me,z.name),ie.set(z,be))}function Xe(z,Me){const be=c.get(Me).get(z);l.get(Me)!==be&&(i.uniformBlockBinding(Me,be,z.__bindingPointIndex),l.set(Me,be))}function Ze(){i.disable(i.BLEND),i.disable(i.CULL_FACE),i.disable(i.DEPTH_TEST),i.disable(i.POLYGON_OFFSET_FILL),i.disable(i.SCISSOR_TEST),i.disable(i.STENCIL_TEST),i.disable(i.SAMPLE_ALPHA_TO_COVERAGE),i.blendEquation(i.FUNC_ADD),i.blendFunc(i.ONE,i.ZERO),i.blendFuncSeparate(i.ONE,i.ZERO,i.ONE,i.ZERO),i.blendColor(0,0,0,0),i.colorMask(!0,!0,!0,!0),i.clearColor(0,0,0,0),i.depthMask(!0),i.depthFunc(i.LESS),a.setReversed(!1),i.clearDepth(1),i.stencilMask(4294967295),i.stencilFunc(i.ALWAYS,0,4294967295),i.stencilOp(i.KEEP,i.KEEP,i.KEEP),i.clearStencil(0),i.cullFace(i.BACK),i.frontFace(i.CCW),i.polygonOffset(0,0),i.activeTexture(i.TEXTURE0),i.bindFramebuffer(i.FRAMEBUFFER,null),i.bindFramebuffer(i.DRAW_FRAMEBUFFER,null),i.bindFramebuffer(i.READ_FRAMEBUFFER,null),i.useProgram(null),i.lineWidth(1),i.scissor(0,0,i.canvas.width,i.canvas.height),i.viewport(0,0,i.canvas.width,i.canvas.height),i.pixelStorei(i.PACK_ALIGNMENT,4),i.pixelStorei(i.UNPACK_ALIGNMENT,4),i.pixelStorei(i.UNPACK_FLIP_Y_WEBGL,!1),i.pixelStorei(i.UNPACK_PREMULTIPLY_ALPHA_WEBGL,!1),i.pixelStorei(i.UNPACK_COLORSPACE_CONVERSION_WEBGL,i.BROWSER_DEFAULT_WEBGL),i.pixelStorei(i.PACK_ROW_LENGTH,0),i.pixelStorei(i.PACK_SKIP_PIXELS,0),i.pixelStorei(i.PACK_SKIP_ROWS,0),i.pixelStorei(i.UNPACK_ROW_LENGTH,0),i.pixelStorei(i.UNPACK_IMAGE_HEIGHT,0),i.pixelStorei(i.UNPACK_SKIP_PIXELS,0),i.pixelStorei(i.UNPACK_SKIP_ROWS,0),i.pixelStorei(i.UNPACK_SKIP_IMAGES,0),h={},f={},G=null,Z={},d={},u=new WeakMap,m=[],x=null,v=!1,g=null,y=null,E=null,M=null,T=null,w=null,R=null,_=new Le(0,0,0),b=0,P=!1,L=null,B=null,Y=null,p=null,C=null,qe.set(0,0,i.canvas.width,i.canvas.height),Re.set(0,0,i.canvas.width,i.canvas.height),r.reset(),a.reset(),o.reset()}return{buffers:{color:r,depth:a,stencil:o},enable:de,disable:De,bindFramebuffer:ze,drawBuffers:ke,useProgram:et,setBlending:le,setMaterial:he,setFlipSided:ce,setCullFace:ue,setLineWidth:_e,setPolygonOffset:ge,setScissorTest:Fe,activeTexture:We,bindTexture:k,unbindTexture:it,compressedTexImage2D:Qe,compressedTexImage3D:I,texImage2D:te,texImage3D:ne,pixelStorei:Ne,getParameter:ye,updateUBOMapping:Ge,uniformBlockBinding:Xe,texStorage2D:ve,texStorage3D:xe,texSubImage2D:S,texSubImage3D:W,compressedTexSubImage2D:$,compressedTexSubImage3D:ee,scissor:Ae,viewport:Ee,reset:Ze}}function FS(i,e,t,n,s,r,a){const o=e.has("WEBGL_multisampled_render_to_texture")?e.get("WEBGL_multisampled_render_to_texture"):null,l=typeof navigator>"u"?!1:/OculusBrowser/g.test(navigator.userAgent),c=new fe,h=new WeakMap,f=new Set;let d;const u=new WeakMap;let m=!1;try{m=typeof OffscreenCanvas<"u"&&new OffscreenCanvas(1,1).getContext("2d")!==null}catch{}function x(I,S){return m?new OffscreenCanvas(I,S):wr("canvas")}function v(I,S,W){let $=1;const ee=Qe(I);if((ee.width>W||ee.height>W)&&($=W/Math.max(ee.width,ee.height)),$<1)if(typeof HTMLImageElement<"u"&&I instanceof HTMLImageElement||typeof HTMLCanvasElement<"u"&&I instanceof HTMLCanvasElement||typeof ImageBitmap<"u"&&I instanceof ImageBitmap||typeof VideoFrame<"u"&&I instanceof VideoFrame){const ve=Math.floor($*ee.width),xe=Math.floor($*ee.height);d===void 0&&(d=x(ve,xe));const te=S?x(ve,xe):d;return te.width=ve,te.height=xe,te.getContext("2d").drawImage(I,0,0,ve,xe),Ke("WebGLRenderer: Texture has been resized from ("+ee.width+"x"+ee.height+") to ("+ve+"x"+xe+")."),te}else return"data"in I&&Ke("WebGLRenderer: Image in DataTexture is too big ("+ee.width+"x"+ee.height+")."),I;return I}function g(I){return I.generateMipmaps}function y(I){i.generateMipmap(I)}function E(I){return I.isWebGLCubeRenderTarget?i.TEXTURE_CUBE_MAP:I.isWebGL3DRenderTarget?i.TEXTURE_3D:I.isWebGLArrayRenderTarget||I.isCompressedArrayTexture?i.TEXTURE_2D_ARRAY:i.TEXTURE_2D}function M(I,S,W,$,ee,ve=!1){if(I!==null){if(i[I]!==void 0)return i[I];Ke("WebGLRenderer: Attempt to use non-existing WebGL internal format '"+I+"'")}let xe;$&&(xe=e.get("EXT_texture_norm16"),xe||Ke("WebGLRenderer: Unable to use normalized textures without EXT_texture_norm16 extension"));let te=S;if(S===i.RED&&(W===i.FLOAT&&(te=i.R32F),W===i.HALF_FLOAT&&(te=i.R16F),W===i.UNSIGNED_BYTE&&(te=i.R8),W===i.UNSIGNED_SHORT&&xe&&(te=xe.R16_EXT),W===i.SHORT&&xe&&(te=xe.R16_SNORM_EXT)),S===i.RED_INTEGER&&(W===i.UNSIGNED_BYTE&&(te=i.R8UI),W===i.UNSIGNED_SHORT&&(te=i.R16UI),W===i.UNSIGNED_INT&&(te=i.R32UI),W===i.BYTE&&(te=i.R8I),W===i.SHORT&&(te=i.R16I),W===i.INT&&(te=i.R32I)),S===i.RG&&(W===i.FLOAT&&(te=i.RG32F),W===i.HALF_FLOAT&&(te=i.RG16F),W===i.UNSIGNED_BYTE&&(te=i.RG8),W===i.UNSIGNED_SHORT&&xe&&(te=xe.RG16_EXT),W===i.SHORT&&xe&&(te=xe.RG16_SNORM_EXT)),S===i.RG_INTEGER&&(W===i.UNSIGNED_BYTE&&(te=i.RG8UI),W===i.UNSIGNED_SHORT&&(te=i.RG16UI),W===i.UNSIGNED_INT&&(te=i.RG32UI),W===i.BYTE&&(te=i.RG8I),W===i.SHORT&&(te=i.RG16I),W===i.INT&&(te=i.RG32I)),S===i.RGB_INTEGER&&(W===i.UNSIGNED_BYTE&&(te=i.RGB8UI),W===i.UNSIGNED_SHORT&&(te=i.RGB16UI),W===i.UNSIGNED_INT&&(te=i.RGB32UI),W===i.BYTE&&(te=i.RGB8I),W===i.SHORT&&(te=i.RGB16I),W===i.INT&&(te=i.RGB32I)),S===i.RGBA_INTEGER&&(W===i.UNSIGNED_BYTE&&(te=i.RGBA8UI),W===i.UNSIGNED_SHORT&&(te=i.RGBA16UI),W===i.UNSIGNED_INT&&(te=i.RGBA32UI),W===i.BYTE&&(te=i.RGBA8I),W===i.SHORT&&(te=i.RGBA16I),W===i.INT&&(te=i.RGBA32I)),S===i.RGB&&(W===i.UNSIGNED_SHORT&&xe&&(te=xe.RGB16_EXT),W===i.SHORT&&xe&&(te=xe.RGB16_SNORM_EXT),W===i.UNSIGNED_INT_5_9_9_9_REV&&(te=i.RGB9_E5),W===i.UNSIGNED_INT_10F_11F_11F_REV&&(te=i.R11F_G11F_B10F)),S===i.RGBA){const ne=ve?Ba:st.getTransfer(ee);W===i.FLOAT&&(te=i.RGBA32F),W===i.HALF_FLOAT&&(te=i.RGBA16F),W===i.UNSIGNED_BYTE&&(te=ne===pt?i.SRGB8_ALPHA8:i.RGBA8),W===i.UNSIGNED_SHORT&&xe&&(te=xe.RGBA16_EXT),W===i.SHORT&&xe&&(te=xe.RGBA16_SNORM_EXT),W===i.UNSIGNED_SHORT_4_4_4_4&&(te=i.RGBA4),W===i.UNSIGNED_SHORT_5_5_5_1&&(te=i.RGB5_A1)}return(te===i.R16F||te===i.R32F||te===i.RG16F||te===i.RG32F||te===i.RGBA16F||te===i.RGBA32F)&&e.get("EXT_color_buffer_float"),te}function T(I,S){let W;return I?S===null||S===Xn||S===Tr?W=i.DEPTH24_STENCIL8:S===In?W=i.DEPTH32F_STENCIL8:S===Er&&(W=i.DEPTH24_STENCIL8,Ke("DepthTexture: 16 bit depth attachment is not supported with stencil. Using 24-bit attachment.")):S===null||S===Xn||S===Tr?W=i.DEPTH_COMPONENT24:S===In?W=i.DEPTH_COMPONENT32F:S===Er&&(W=i.DEPTH_COMPONENT16),W}function w(I,S){return g(I)===!0||I.isFramebufferTexture&&I.minFilter!==Xt&&I.minFilter!==Ft?Math.log2(Math.max(S.width,S.height))+1:I.mipmaps!==void 0&&I.mipmaps.length>0?I.mipmaps.length:I.isCompressedTexture&&Array.isArray(I.image)?S.mipmaps.length:1}function R(I){const S=I.target;S.removeEventListener("dispose",R),b(S),S.isVideoTexture&&h.delete(S),S.isHTMLTexture&&f.delete(S)}function _(I){const S=I.target;S.removeEventListener("dispose",_),L(S)}function b(I){const S=n.get(I);if(S.__webglInit===void 0)return;const W=I.source,$=u.get(W);if($){const ee=$[S.__cacheKey];ee.usedTimes--,ee.usedTimes===0&&P(I),Object.keys($).length===0&&u.delete(W)}n.remove(I)}function P(I){const S=n.get(I);i.deleteTexture(S.__webglTexture);const W=I.source,$=u.get(W);delete $[S.__cacheKey],a.memory.textures--}function L(I){const S=n.get(I);if(I.depthTexture&&(I.depthTexture.dispose(),n.remove(I.depthTexture)),I.isWebGLCubeRenderTarget)for(let $=0;$<6;$++){if(Array.isArray(S.__webglFramebuffer[$]))for(let ee=0;ee<S.__webglFramebuffer[$].length;ee++)i.deleteFramebuffer(S.__webglFramebuffer[$][ee]);else i.deleteFramebuffer(S.__webglFramebuffer[$]);S.__webglDepthbuffer&&i.deleteRenderbuffer(S.__webglDepthbuffer[$])}else{if(Array.isArray(S.__webglFramebuffer))for(let $=0;$<S.__webglFramebuffer.length;$++)i.deleteFramebuffer(S.__webglFramebuffer[$]);else i.deleteFramebuffer(S.__webglFramebuffer);if(S.__webglDepthbuffer&&i.deleteRenderbuffer(S.__webglDepthbuffer),S.__webglMultisampledFramebuffer&&i.deleteFramebuffer(S.__webglMultisampledFramebuffer),S.__webglColorRenderbuffer)for(let $=0;$<S.__webglColorRenderbuffer.length;$++)S.__webglColorRenderbuffer[$]&&i.deleteRenderbuffer(S.__webglColorRenderbuffer[$]);S.__webglDepthRenderbuffer&&i.deleteRenderbuffer(S.__webglDepthRenderbuffer)}const W=I.textures;for(let $=0,ee=W.length;$<ee;$++){const ve=n.get(W[$]);ve.__webglTexture&&(i.deleteTexture(ve.__webglTexture),a.memory.textures--),n.remove(W[$])}n.remove(I)}let B=0;function Y(){B=0}function p(){return B}function C(I){B=I}function D(){const I=B;return I>=s.maxTextures&&Ke("WebGLTextures: Trying to use "+I+" texture units while this GPU supports only "+s.maxTextures),B+=1,I}function U(I){const S=[];return S.push(I.wrapS),S.push(I.wrapT),S.push(I.wrapR||0),S.push(I.magFilter),S.push(I.minFilter),S.push(I.anisotropy),S.push(I.internalFormat),S.push(I.format),S.push(I.type),S.push(I.generateMipmaps),S.push(I.premultiplyAlpha),S.push(I.flipY),S.push(I.unpackAlignment),S.push(I.colorSpace),S.join()}function O(I,S){const W=n.get(I);if(I.isVideoTexture&&k(I),I.isRenderTargetTexture===!1&&I.isExternalTexture!==!0&&I.version>0&&W.__version!==I.version){const $=I.image;if($===null)Ke("WebGLRenderer: Texture marked for update but no image data found.");else if($.complete===!1)Ke("WebGLRenderer: Texture marked for update but image is incomplete");else{De(W,I,S);return}}else I.isExternalTexture&&(W.__webglTexture=I.sourceTexture?I.sourceTexture:null);t.bindTexture(i.TEXTURE_2D,W.__webglTexture,i.TEXTURE0+S)}function F(I,S){const W=n.get(I);if(I.isRenderTargetTexture===!1&&I.version>0&&W.__version!==I.version){De(W,I,S);return}else I.isExternalTexture&&(W.__webglTexture=I.sourceTexture?I.sourceTexture:null);t.bindTexture(i.TEXTURE_2D_ARRAY,W.__webglTexture,i.TEXTURE0+S)}function G(I,S){const W=n.get(I);if(I.isRenderTargetTexture===!1&&I.version>0&&W.__version!==I.version){De(W,I,S);return}t.bindTexture(i.TEXTURE_3D,W.__webglTexture,i.TEXTURE0+S)}function Z(I,S){const W=n.get(I);if(I.isCubeDepthTexture!==!0&&I.version>0&&W.__version!==I.version){ze(W,I,S);return}t.bindTexture(i.TEXTURE_CUBE_MAP,W.__webglTexture,i.TEXTURE0+S)}const ae={[Sl]:i.REPEAT,[Pn]:i.CLAMP_TO_EDGE,[Ml]:i.MIRRORED_REPEAT},Te={[Xt]:i.NEAREST,[im]:i.NEAREST_MIPMAP_NEAREST,[Gr]:i.NEAREST_MIPMAP_LINEAR,[Ft]:i.LINEAR,[vo]:i.LINEAR_MIPMAP_NEAREST,[ri]:i.LINEAR_MIPMAP_LINEAR},qe={[am]:i.NEVER,[um]:i.ALWAYS,[om]:i.LESS,[zc]:i.LEQUAL,[lm]:i.EQUAL,[Hc]:i.GEQUAL,[cm]:i.GREATER,[hm]:i.NOTEQUAL};function Re(I,S){if(S.type===In&&e.has("OES_texture_float_linear")===!1&&(S.magFilter===Ft||S.magFilter===vo||S.magFilter===Gr||S.magFilter===ri||S.minFilter===Ft||S.minFilter===vo||S.minFilter===Gr||S.minFilter===ri)&&Ke("WebGLRenderer: Unable to use linear filtering with floating point textures. OES_texture_float_linear not supported on this device."),i.texParameteri(I,i.TEXTURE_WRAP_S,ae[S.wrapS]),i.texParameteri(I,i.TEXTURE_WRAP_T,ae[S.wrapT]),(I===i.TEXTURE_3D||I===i.TEXTURE_2D_ARRAY)&&i.texParameteri(I,i.TEXTURE_WRAP_R,ae[S.wrapR]),i.texParameteri(I,i.TEXTURE_MAG_FILTER,Te[S.magFilter]),i.texParameteri(I,i.TEXTURE_MIN_FILTER,Te[S.minFilter]),S.compareFunction&&(i.texParameteri(I,i.TEXTURE_COMPARE_MODE,i.COMPARE_REF_TO_TEXTURE),i.texParameteri(I,i.TEXTURE_COMPARE_FUNC,qe[S.compareFunction])),e.has("EXT_texture_filter_anisotropic")===!0){if(S.magFilter===Xt||S.minFilter!==Gr&&S.minFilter!==ri||S.type===In&&e.has("OES_texture_float_linear")===!1)return;if(S.anisotropy>1||n.get(S).__currentAnisotropy){const W=e.get("EXT_texture_filter_anisotropic");i.texParameterf(I,W.TEXTURE_MAX_ANISOTROPY_EXT,Math.min(S.anisotropy,s.getMaxAnisotropy())),n.get(S).__currentAnisotropy=S.anisotropy}}}function j(I,S){let W=!1;I.__webglInit===void 0&&(I.__webglInit=!0,S.addEventListener("dispose",R));const $=S.source;let ee=u.get($);ee===void 0&&(ee={},u.set($,ee));const ve=U(S);if(ve!==I.__cacheKey){ee[ve]===void 0&&(ee[ve]={texture:i.createTexture(),usedTimes:0},a.memory.textures++,W=!0),ee[ve].usedTimes++;const xe=ee[I.__cacheKey];xe!==void 0&&(ee[I.__cacheKey].usedTimes--,xe.usedTimes===0&&P(S)),I.__cacheKey=ve,I.__webglTexture=ee[ve].texture}return W}function pe(I,S,W){return Math.floor(Math.floor(I/W)/S)}function de(I,S,W,$){const ve=I.updateRanges;if(ve.length===0)t.texSubImage2D(i.TEXTURE_2D,0,0,0,S.width,S.height,W,$,S.data);else{ve.sort((Ne,Ae)=>Ne.start-Ae.start);let xe=0;for(let Ne=1;Ne<ve.length;Ne++){const Ae=ve[xe],Ee=ve[Ne],Ge=Ae.start+Ae.count,Xe=pe(Ee.start,S.width,4),Ze=pe(Ae.start,S.width,4);Ee.start<=Ge+1&&Xe===Ze&&pe(Ee.start+Ee.count-1,S.width,4)===Xe?Ae.count=Math.max(Ae.count,Ee.start+Ee.count-Ae.start):(++xe,ve[xe]=Ee)}ve.length=xe+1;const te=t.getParameter(i.UNPACK_ROW_LENGTH),ne=t.getParameter(i.UNPACK_SKIP_PIXELS),ye=t.getParameter(i.UNPACK_SKIP_ROWS);t.pixelStorei(i.UNPACK_ROW_LENGTH,S.width);for(let Ne=0,Ae=ve.length;Ne<Ae;Ne++){const Ee=ve[Ne],Ge=Math.floor(Ee.start/4),Xe=Math.ceil(Ee.count/4),Ze=Ge%S.width,z=Math.floor(Ge/S.width),Me=Xe,ie=1;t.pixelStorei(i.UNPACK_SKIP_PIXELS,Ze),t.pixelStorei(i.UNPACK_SKIP_ROWS,z),t.texSubImage2D(i.TEXTURE_2D,0,Ze,z,Me,ie,W,$,S.data)}I.clearUpdateRanges(),t.pixelStorei(i.UNPACK_ROW_LENGTH,te),t.pixelStorei(i.UNPACK_SKIP_PIXELS,ne),t.pixelStorei(i.UNPACK_SKIP_ROWS,ye)}}function De(I,S,W){let $=i.TEXTURE_2D;(S.isDataArrayTexture||S.isCompressedArrayTexture)&&($=i.TEXTURE_2D_ARRAY),S.isData3DTexture&&($=i.TEXTURE_3D);const ee=j(I,S),ve=S.source;t.bindTexture($,I.__webglTexture,i.TEXTURE0+W);const xe=n.get(ve);if(ve.version!==xe.__version||ee===!0){if(t.activeTexture(i.TEXTURE0+W),(typeof ImageBitmap<"u"&&S.image instanceof ImageBitmap)===!1){const ie=st.getPrimaries(st.workingColorSpace),be=S.colorSpace===Mi?null:st.getPrimaries(S.colorSpace),we=S.colorSpace===Mi||ie===be?i.NONE:i.BROWSER_DEFAULT_WEBGL;t.pixelStorei(i.UNPACK_FLIP_Y_WEBGL,S.flipY),t.pixelStorei(i.UNPACK_PREMULTIPLY_ALPHA_WEBGL,S.premultiplyAlpha),t.pixelStorei(i.UNPACK_COLORSPACE_CONVERSION_WEBGL,we)}t.pixelStorei(i.UNPACK_ALIGNMENT,S.unpackAlignment);let ne=v(S.image,!1,s.maxTextureSize);ne=it(S,ne);const ye=r.convert(S.format,S.colorSpace),Ne=r.convert(S.type);let Ae=M(S.internalFormat,ye,Ne,S.normalized,S.colorSpace,S.isVideoTexture);Re($,S);let Ee;const Ge=S.mipmaps,Xe=S.isVideoTexture!==!0,Ze=xe.__version===void 0||ee===!0,z=ve.dataReady,Me=w(S,ne);if(S.isDepthTexture)Ae=T(S.format===Fi,S.type),Ze&&(Xe?t.texStorage2D(i.TEXTURE_2D,1,Ae,ne.width,ne.height):t.texImage2D(i.TEXTURE_2D,0,Ae,ne.width,ne.height,0,ye,Ne,null));else if(S.isDataTexture)if(Ge.length>0){Xe&&Ze&&t.texStorage2D(i.TEXTURE_2D,Me,Ae,Ge[0].width,Ge[0].height);for(let ie=0,be=Ge.length;ie<be;ie++)Ee=Ge[ie],Xe?z&&t.texSubImage2D(i.TEXTURE_2D,ie,0,0,Ee.width,Ee.height,ye,Ne,Ee.data):t.texImage2D(i.TEXTURE_2D,ie,Ae,Ee.width,Ee.height,0,ye,Ne,Ee.data);S.generateMipmaps=!1}else Xe?(Ze&&t.texStorage2D(i.TEXTURE_2D,Me,Ae,ne.width,ne.height),z&&de(S,ne,ye,Ne)):t.texImage2D(i.TEXTURE_2D,0,Ae,ne.width,ne.height,0,ye,Ne,ne.data);else if(S.isCompressedTexture)if(S.isCompressedArrayTexture){Xe&&Ze&&t.texStorage3D(i.TEXTURE_2D_ARRAY,Me,Ae,Ge[0].width,Ge[0].height,ne.depth);for(let ie=0,be=Ge.length;ie<be;ie++)if(Ee=Ge[ie],S.format!==Ln)if(ye!==null)if(Xe){if(z)if(S.layerUpdates.size>0){const we=hu(Ee.width,Ee.height,S.format,S.type);for(const oe of S.layerUpdates){const Be=Ee.data.subarray(oe*we/Ee.data.BYTES_PER_ELEMENT,(oe+1)*we/Ee.data.BYTES_PER_ELEMENT);t.compressedTexSubImage3D(i.TEXTURE_2D_ARRAY,ie,0,0,oe,Ee.width,Ee.height,1,ye,Be)}S.clearLayerUpdates()}else t.compressedTexSubImage3D(i.TEXTURE_2D_ARRAY,ie,0,0,0,Ee.width,Ee.height,ne.depth,ye,Ee.data)}else t.compressedTexImage3D(i.TEXTURE_2D_ARRAY,ie,Ae,Ee.width,Ee.height,ne.depth,0,Ee.data,0,0);else Ke("WebGLRenderer: Attempt to load unsupported compressed texture format in .uploadTexture()");else Xe?z&&t.texSubImage3D(i.TEXTURE_2D_ARRAY,ie,0,0,0,Ee.width,Ee.height,ne.depth,ye,Ne,Ee.data):t.texImage3D(i.TEXTURE_2D_ARRAY,ie,Ae,Ee.width,Ee.height,ne.depth,0,ye,Ne,Ee.data)}else{Xe&&Ze&&t.texStorage2D(i.TEXTURE_2D,Me,Ae,Ge[0].width,Ge[0].height);for(let ie=0,be=Ge.length;ie<be;ie++)Ee=Ge[ie],S.format!==Ln?ye!==null?Xe?z&&t.compressedTexSubImage2D(i.TEXTURE_2D,ie,0,0,Ee.width,Ee.height,ye,Ee.data):t.compressedTexImage2D(i.TEXTURE_2D,ie,Ae,Ee.width,Ee.height,0,Ee.data):Ke("WebGLRenderer: Attempt to load unsupported compressed texture format in .uploadTexture()"):Xe?z&&t.texSubImage2D(i.TEXTURE_2D,ie,0,0,Ee.width,Ee.height,ye,Ne,Ee.data):t.texImage2D(i.TEXTURE_2D,ie,Ae,Ee.width,Ee.height,0,ye,Ne,Ee.data)}else if(S.isDataArrayTexture)if(Xe){if(Ze&&t.texStorage3D(i.TEXTURE_2D_ARRAY,Me,Ae,ne.width,ne.height,ne.depth),z)if(S.layerUpdates.size>0){const ie=hu(ne.width,ne.height,S.format,S.type);for(const be of S.layerUpdates){const we=ne.data.subarray(be*ie/ne.data.BYTES_PER_ELEMENT,(be+1)*ie/ne.data.BYTES_PER_ELEMENT);t.texSubImage3D(i.TEXTURE_2D_ARRAY,0,0,0,be,ne.width,ne.height,1,ye,Ne,we)}S.clearLayerUpdates()}else t.texSubImage3D(i.TEXTURE_2D_ARRAY,0,0,0,0,ne.width,ne.height,ne.depth,ye,Ne,ne.data)}else t.texImage3D(i.TEXTURE_2D_ARRAY,0,Ae,ne.width,ne.height,ne.depth,0,ye,Ne,ne.data);else if(S.isData3DTexture)Xe?(Ze&&t.texStorage3D(i.TEXTURE_3D,Me,Ae,ne.width,ne.height,ne.depth),z&&t.texSubImage3D(i.TEXTURE_3D,0,0,0,0,ne.width,ne.height,ne.depth,ye,Ne,ne.data)):t.texImage3D(i.TEXTURE_3D,0,Ae,ne.width,ne.height,ne.depth,0,ye,Ne,ne.data);else if(S.isFramebufferTexture){if(Ze)if(Xe)t.texStorage2D(i.TEXTURE_2D,Me,Ae,ne.width,ne.height);else{let ie=ne.width,be=ne.height;for(let we=0;we<Me;we++)t.texImage2D(i.TEXTURE_2D,we,Ae,ie,be,0,ye,Ne,null),ie>>=1,be>>=1}}else if(S.isHTMLTexture){if("texElementImage2D"in i){const ie=i.canvas;if(ie.hasAttribute("layoutsubtree")||ie.setAttribute("layoutsubtree","true"),ne.parentNode!==ie){ie.appendChild(ne),f.add(S),ie.onpaint=be=>{const we=be.changedElements;for(const oe of f)we.includes(oe.image)&&(oe.needsUpdate=!0)},ie.requestPaint();return}if(i.texElementImage2D.length===3)i.texElementImage2D(i.TEXTURE_2D,i.RGBA8,ne);else{const we=i.RGBA,oe=i.RGBA,Be=i.UNSIGNED_BYTE;i.texElementImage2D(i.TEXTURE_2D,0,we,oe,Be,ne)}i.texParameteri(i.TEXTURE_2D,i.TEXTURE_MIN_FILTER,i.LINEAR),i.texParameteri(i.TEXTURE_2D,i.TEXTURE_WRAP_S,i.CLAMP_TO_EDGE),i.texParameteri(i.TEXTURE_2D,i.TEXTURE_WRAP_T,i.CLAMP_TO_EDGE)}}else if(Ge.length>0){if(Xe&&Ze){const ie=Qe(Ge[0]);t.texStorage2D(i.TEXTURE_2D,Me,Ae,ie.width,ie.height)}for(let ie=0,be=Ge.length;ie<be;ie++)Ee=Ge[ie],Xe?z&&t.texSubImage2D(i.TEXTURE_2D,ie,0,0,ye,Ne,Ee):t.texImage2D(i.TEXTURE_2D,ie,Ae,ye,Ne,Ee);S.generateMipmaps=!1}else if(Xe){if(Ze){const ie=Qe(ne);t.texStorage2D(i.TEXTURE_2D,Me,Ae,ie.width,ie.height)}z&&t.texSubImage2D(i.TEXTURE_2D,0,0,0,ye,Ne,ne)}else t.texImage2D(i.TEXTURE_2D,0,Ae,ye,Ne,ne);g(S)&&y($),xe.__version=ve.version,S.onUpdate&&S.onUpdate(S)}I.__version=S.version}function ze(I,S,W){if(S.image.length!==6)return;const $=j(I,S),ee=S.source;t.bindTexture(i.TEXTURE_CUBE_MAP,I.__webglTexture,i.TEXTURE0+W);const ve=n.get(ee);if(ee.version!==ve.__version||$===!0){t.activeTexture(i.TEXTURE0+W);const xe=st.getPrimaries(st.workingColorSpace),te=S.colorSpace===Mi?null:st.getPrimaries(S.colorSpace),ne=S.colorSpace===Mi||xe===te?i.NONE:i.BROWSER_DEFAULT_WEBGL;t.pixelStorei(i.UNPACK_FLIP_Y_WEBGL,S.flipY),t.pixelStorei(i.UNPACK_PREMULTIPLY_ALPHA_WEBGL,S.premultiplyAlpha),t.pixelStorei(i.UNPACK_ALIGNMENT,S.unpackAlignment),t.pixelStorei(i.UNPACK_COLORSPACE_CONVERSION_WEBGL,ne);const ye=S.isCompressedTexture||S.image[0].isCompressedTexture,Ne=S.image[0]&&S.image[0].isDataTexture,Ae=[];for(let oe=0;oe<6;oe++)!ye&&!Ne?Ae[oe]=v(S.image[oe],!0,s.maxCubemapSize):Ae[oe]=Ne?S.image[oe].image:S.image[oe],Ae[oe]=it(S,Ae[oe]);const Ee=Ae[0],Ge=r.convert(S.format,S.colorSpace),Xe=r.convert(S.type),Ze=M(S.internalFormat,Ge,Xe,S.normalized,S.colorSpace),z=S.isVideoTexture!==!0,Me=ve.__version===void 0||$===!0,ie=ee.dataReady;let be=w(S,Ee);Re(i.TEXTURE_CUBE_MAP,S);let we;if(ye){z&&Me&&t.texStorage2D(i.TEXTURE_CUBE_MAP,be,Ze,Ee.width,Ee.height);for(let oe=0;oe<6;oe++){we=Ae[oe].mipmaps;for(let Be=0;Be<we.length;Be++){const Ue=we[Be];S.format!==Ln?Ge!==null?z?ie&&t.compressedTexSubImage2D(i.TEXTURE_CUBE_MAP_POSITIVE_X+oe,Be,0,0,Ue.width,Ue.height,Ge,Ue.data):t.compressedTexImage2D(i.TEXTURE_CUBE_MAP_POSITIVE_X+oe,Be,Ze,Ue.width,Ue.height,0,Ue.data):Ke("WebGLRenderer: Attempt to load unsupported compressed texture format in .setTextureCube()"):z?ie&&t.texSubImage2D(i.TEXTURE_CUBE_MAP_POSITIVE_X+oe,Be,0,0,Ue.width,Ue.height,Ge,Xe,Ue.data):t.texImage2D(i.TEXTURE_CUBE_MAP_POSITIVE_X+oe,Be,Ze,Ue.width,Ue.height,0,Ge,Xe,Ue.data)}}}else{if(we=S.mipmaps,z&&Me){we.length>0&&be++;const oe=Qe(Ae[0]);t.texStorage2D(i.TEXTURE_CUBE_MAP,be,Ze,oe.width,oe.height)}for(let oe=0;oe<6;oe++)if(Ne){z?ie&&t.texSubImage2D(i.TEXTURE_CUBE_MAP_POSITIVE_X+oe,0,0,0,Ae[oe].width,Ae[oe].height,Ge,Xe,Ae[oe].data):t.texImage2D(i.TEXTURE_CUBE_MAP_POSITIVE_X+oe,0,Ze,Ae[oe].width,Ae[oe].height,0,Ge,Xe,Ae[oe].data);for(let Be=0;Be<we.length;Be++){const At=we[Be].image[oe].image;z?ie&&t.texSubImage2D(i.TEXTURE_CUBE_MAP_POSITIVE_X+oe,Be+1,0,0,At.width,At.height,Ge,Xe,At.data):t.texImage2D(i.TEXTURE_CUBE_MAP_POSITIVE_X+oe,Be+1,Ze,At.width,At.height,0,Ge,Xe,At.data)}}else{z?ie&&t.texSubImage2D(i.TEXTURE_CUBE_MAP_POSITIVE_X+oe,0,0,0,Ge,Xe,Ae[oe]):t.texImage2D(i.TEXTURE_CUBE_MAP_POSITIVE_X+oe,0,Ze,Ge,Xe,Ae[oe]);for(let Be=0;Be<we.length;Be++){const Ue=we[Be];z?ie&&t.texSubImage2D(i.TEXTURE_CUBE_MAP_POSITIVE_X+oe,Be+1,0,0,Ge,Xe,Ue.image[oe]):t.texImage2D(i.TEXTURE_CUBE_MAP_POSITIVE_X+oe,Be+1,Ze,Ge,Xe,Ue.image[oe])}}}g(S)&&y(i.TEXTURE_CUBE_MAP),ve.__version=ee.version,S.onUpdate&&S.onUpdate(S)}I.__version=S.version}function ke(I,S,W,$,ee,ve){const xe=r.convert(W.format,W.colorSpace),te=r.convert(W.type),ne=M(W.internalFormat,xe,te,W.normalized,W.colorSpace),ye=n.get(S),Ne=n.get(W);if(Ne.__renderTarget=S,!ye.__hasExternalTextures){const Ae=Math.max(1,S.width>>ve),Ee=Math.max(1,S.height>>ve);ee===i.TEXTURE_3D||ee===i.TEXTURE_2D_ARRAY?t.texImage3D(ee,ve,ne,Ae,Ee,S.depth,0,xe,te,null):t.texImage2D(ee,ve,ne,Ae,Ee,0,xe,te,null)}t.bindFramebuffer(i.FRAMEBUFFER,I),We(S)?o.framebufferTexture2DMultisampleEXT(i.FRAMEBUFFER,$,ee,Ne.__webglTexture,0,Fe(S)):(ee===i.TEXTURE_2D||ee>=i.TEXTURE_CUBE_MAP_POSITIVE_X&&ee<=i.TEXTURE_CUBE_MAP_NEGATIVE_Z)&&i.framebufferTexture2D(i.FRAMEBUFFER,$,ee,Ne.__webglTexture,ve),t.bindFramebuffer(i.FRAMEBUFFER,null)}function et(I,S,W){if(i.bindRenderbuffer(i.RENDERBUFFER,I),S.depthBuffer){const $=S.depthTexture,ee=$&&$.isDepthTexture?$.type:null,ve=T(S.stencilBuffer,ee),xe=S.stencilBuffer?i.DEPTH_STENCIL_ATTACHMENT:i.DEPTH_ATTACHMENT;We(S)?o.renderbufferStorageMultisampleEXT(i.RENDERBUFFER,Fe(S),ve,S.width,S.height):W?i.renderbufferStorageMultisample(i.RENDERBUFFER,Fe(S),ve,S.width,S.height):i.renderbufferStorage(i.RENDERBUFFER,ve,S.width,S.height),i.framebufferRenderbuffer(i.FRAMEBUFFER,xe,i.RENDERBUFFER,I)}else{const $=S.textures;for(let ee=0;ee<$.length;ee++){const ve=$[ee],xe=r.convert(ve.format,ve.colorSpace),te=r.convert(ve.type),ne=M(ve.internalFormat,xe,te,ve.normalized,ve.colorSpace);We(S)?o.renderbufferStorageMultisampleEXT(i.RENDERBUFFER,Fe(S),ne,S.width,S.height):W?i.renderbufferStorageMultisample(i.RENDERBUFFER,Fe(S),ne,S.width,S.height):i.renderbufferStorage(i.RENDERBUFFER,ne,S.width,S.height)}}i.bindRenderbuffer(i.RENDERBUFFER,null)}function He(I,S,W){const $=S.isWebGLCubeRenderTarget===!0;if(t.bindFramebuffer(i.FRAMEBUFFER,I),!(S.depthTexture&&S.depthTexture.isDepthTexture))throw new Error("THREE.WebGLTextures: renderTarget.depthTexture must be an instance of THREE.DepthTexture.");const ee=n.get(S.depthTexture);if(ee.__renderTarget=S,(!ee.__webglTexture||S.depthTexture.image.width!==S.width||S.depthTexture.image.height!==S.height)&&(S.depthTexture.image.width=S.width,S.depthTexture.image.height=S.height,S.depthTexture.needsUpdate=!0),$){if(ee.__webglInit===void 0&&(ee.__webglInit=!0,S.depthTexture.addEventListener("dispose",R)),ee.__webglTexture===void 0){ee.__webglTexture=i.createTexture(),t.bindTexture(i.TEXTURE_CUBE_MAP,ee.__webglTexture),Re(i.TEXTURE_CUBE_MAP,S.depthTexture);const ye=r.convert(S.depthTexture.format),Ne=r.convert(S.depthTexture.type);let Ae;S.depthTexture.format===ci?Ae=i.DEPTH_COMPONENT24:S.depthTexture.format===Fi&&(Ae=i.DEPTH24_STENCIL8);for(let Ee=0;Ee<6;Ee++)i.texImage2D(i.TEXTURE_CUBE_MAP_POSITIVE_X+Ee,0,Ae,S.width,S.height,0,ye,Ne,null)}}else O(S.depthTexture,0);const ve=ee.__webglTexture,xe=Fe(S),te=$?i.TEXTURE_CUBE_MAP_POSITIVE_X+W:i.TEXTURE_2D,ne=S.depthTexture.format===Fi?i.DEPTH_STENCIL_ATTACHMENT:i.DEPTH_ATTACHMENT;if(S.depthTexture.format===ci)We(S)?o.framebufferTexture2DMultisampleEXT(i.FRAMEBUFFER,ne,te,ve,0,xe):i.framebufferTexture2D(i.FRAMEBUFFER,ne,te,ve,0);else if(S.depthTexture.format===Fi)We(S)?o.framebufferTexture2DMultisampleEXT(i.FRAMEBUFFER,ne,te,ve,0,xe):i.framebufferTexture2D(i.FRAMEBUFFER,ne,te,ve,0);else throw new Error("THREE.WebGLTextures: Unknown depthTexture format.")}function re(I){const S=n.get(I),W=I.isWebGLCubeRenderTarget===!0;if(S.__boundDepthTexture!==I.depthTexture){const $=I.depthTexture;if(S.__depthDisposeCallback&&S.__depthDisposeCallback(),$){const ee=()=>{delete S.__boundDepthTexture,delete S.__depthDisposeCallback,$.removeEventListener("dispose",ee)};$.addEventListener("dispose",ee),S.__depthDisposeCallback=ee}S.__boundDepthTexture=$}if(I.depthTexture&&!S.__autoAllocateDepthBuffer)if(W)for(let $=0;$<6;$++)He(S.__webglFramebuffer[$],I,$);else{const $=I.texture.mipmaps;$&&$.length>0?He(S.__webglFramebuffer[0],I,0):He(S.__webglFramebuffer,I,0)}else if(W){S.__webglDepthbuffer=[];for(let $=0;$<6;$++)if(t.bindFramebuffer(i.FRAMEBUFFER,S.__webglFramebuffer[$]),S.__webglDepthbuffer[$]===void 0)S.__webglDepthbuffer[$]=i.createRenderbuffer(),et(S.__webglDepthbuffer[$],I,!1);else{const ee=I.stencilBuffer?i.DEPTH_STENCIL_ATTACHMENT:i.DEPTH_ATTACHMENT,ve=S.__webglDepthbuffer[$];i.bindRenderbuffer(i.RENDERBUFFER,ve),i.framebufferRenderbuffer(i.FRAMEBUFFER,ee,i.RENDERBUFFER,ve)}}else{const $=I.texture.mipmaps;if($&&$.length>0?t.bindFramebuffer(i.FRAMEBUFFER,S.__webglFramebuffer[0]):t.bindFramebuffer(i.FRAMEBUFFER,S.__webglFramebuffer),S.__webglDepthbuffer===void 0)S.__webglDepthbuffer=i.createRenderbuffer(),et(S.__webglDepthbuffer,I,!1);else{const ee=I.stencilBuffer?i.DEPTH_STENCIL_ATTACHMENT:i.DEPTH_ATTACHMENT,ve=S.__webglDepthbuffer;i.bindRenderbuffer(i.RENDERBUFFER,ve),i.framebufferRenderbuffer(i.FRAMEBUFFER,ee,i.RENDERBUFFER,ve)}}t.bindFramebuffer(i.FRAMEBUFFER,null)}function le(I,S,W){const $=n.get(I);S!==void 0&&ke($.__webglFramebuffer,I,I.texture,i.COLOR_ATTACHMENT0,i.TEXTURE_2D,0),W!==void 0&&re(I)}function he(I){const S=I.texture,W=n.get(I),$=n.get(S);I.addEventListener("dispose",_);const ee=I.textures,ve=I.isWebGLCubeRenderTarget===!0,xe=ee.length>1;if(xe||($.__webglTexture===void 0&&($.__webglTexture=i.createTexture()),$.__version=S.version,a.memory.textures++),ve){W.__webglFramebuffer=[];for(let te=0;te<6;te++)if(S.mipmaps&&S.mipmaps.length>0){W.__webglFramebuffer[te]=[];for(let ne=0;ne<S.mipmaps.length;ne++)W.__webglFramebuffer[te][ne]=i.createFramebuffer()}else W.__webglFramebuffer[te]=i.createFramebuffer()}else{if(S.mipmaps&&S.mipmaps.length>0){W.__webglFramebuffer=[];for(let te=0;te<S.mipmaps.length;te++)W.__webglFramebuffer[te]=i.createFramebuffer()}else W.__webglFramebuffer=i.createFramebuffer();if(xe)for(let te=0,ne=ee.length;te<ne;te++){const ye=n.get(ee[te]);ye.__webglTexture===void 0&&(ye.__webglTexture=i.createTexture(),a.memory.textures++)}if(I.samples>0&&We(I)===!1){W.__webglMultisampledFramebuffer=i.createFramebuffer(),W.__webglColorRenderbuffer=[],t.bindFramebuffer(i.FRAMEBUFFER,W.__webglMultisampledFramebuffer);for(let te=0;te<ee.length;te++){const ne=ee[te];W.__webglColorRenderbuffer[te]=i.createRenderbuffer(),i.bindRenderbuffer(i.RENDERBUFFER,W.__webglColorRenderbuffer[te]);const ye=r.convert(ne.format,ne.colorSpace),Ne=r.convert(ne.type),Ae=M(ne.internalFormat,ye,Ne,ne.normalized,ne.colorSpace,I.isXRRenderTarget===!0),Ee=Fe(I);i.renderbufferStorageMultisample(i.RENDERBUFFER,Ee,Ae,I.width,I.height),i.framebufferRenderbuffer(i.FRAMEBUFFER,i.COLOR_ATTACHMENT0+te,i.RENDERBUFFER,W.__webglColorRenderbuffer[te])}i.bindRenderbuffer(i.RENDERBUFFER,null),I.depthBuffer&&(W.__webglDepthRenderbuffer=i.createRenderbuffer(),et(W.__webglDepthRenderbuffer,I,!0)),t.bindFramebuffer(i.FRAMEBUFFER,null)}}if(ve){t.bindTexture(i.TEXTURE_CUBE_MAP,$.__webglTexture),Re(i.TEXTURE_CUBE_MAP,S);for(let te=0;te<6;te++)if(S.mipmaps&&S.mipmaps.length>0)for(let ne=0;ne<S.mipmaps.length;ne++)ke(W.__webglFramebuffer[te][ne],I,S,i.COLOR_ATTACHMENT0,i.TEXTURE_CUBE_MAP_POSITIVE_X+te,ne);else ke(W.__webglFramebuffer[te],I,S,i.COLOR_ATTACHMENT0,i.TEXTURE_CUBE_MAP_POSITIVE_X+te,0);g(S)&&y(i.TEXTURE_CUBE_MAP),t.unbindTexture()}else if(xe){for(let te=0,ne=ee.length;te<ne;te++){const ye=ee[te],Ne=n.get(ye);let Ae=i.TEXTURE_2D;(I.isWebGL3DRenderTarget||I.isWebGLArrayRenderTarget)&&(Ae=I.isWebGL3DRenderTarget?i.TEXTURE_3D:i.TEXTURE_2D_ARRAY),t.bindTexture(Ae,Ne.__webglTexture),Re(Ae,ye),ke(W.__webglFramebuffer,I,ye,i.COLOR_ATTACHMENT0+te,Ae,0),g(ye)&&y(Ae)}t.unbindTexture()}else{let te=i.TEXTURE_2D;if((I.isWebGL3DRenderTarget||I.isWebGLArrayRenderTarget)&&(te=I.isWebGL3DRenderTarget?i.TEXTURE_3D:i.TEXTURE_2D_ARRAY),t.bindTexture(te,$.__webglTexture),Re(te,S),S.mipmaps&&S.mipmaps.length>0)for(let ne=0;ne<S.mipmaps.length;ne++)ke(W.__webglFramebuffer[ne],I,S,i.COLOR_ATTACHMENT0,te,ne);else ke(W.__webglFramebuffer,I,S,i.COLOR_ATTACHMENT0,te,0);g(S)&&y(te),t.unbindTexture()}I.depthBuffer&&re(I)}function ce(I){const S=I.textures;for(let W=0,$=S.length;W<$;W++){const ee=S[W];if(g(ee)){const ve=E(I),xe=n.get(ee).__webglTexture;t.bindTexture(ve,xe),y(ve),t.unbindTexture()}}}const ue=[],_e=[];function ge(I){if(I.samples>0){if(We(I)===!1){const S=I.textures,W=I.width,$=I.height;let ee=i.COLOR_BUFFER_BIT;const ve=I.stencilBuffer?i.DEPTH_STENCIL_ATTACHMENT:i.DEPTH_ATTACHMENT,xe=n.get(I),te=S.length>1;if(te)for(let ye=0;ye<S.length;ye++)t.bindFramebuffer(i.FRAMEBUFFER,xe.__webglMultisampledFramebuffer),i.framebufferRenderbuffer(i.FRAMEBUFFER,i.COLOR_ATTACHMENT0+ye,i.RENDERBUFFER,null),t.bindFramebuffer(i.FRAMEBUFFER,xe.__webglFramebuffer),i.framebufferTexture2D(i.DRAW_FRAMEBUFFER,i.COLOR_ATTACHMENT0+ye,i.TEXTURE_2D,null,0);t.bindFramebuffer(i.READ_FRAMEBUFFER,xe.__webglMultisampledFramebuffer);const ne=I.texture.mipmaps;ne&&ne.length>0?t.bindFramebuffer(i.DRAW_FRAMEBUFFER,xe.__webglFramebuffer[0]):t.bindFramebuffer(i.DRAW_FRAMEBUFFER,xe.__webglFramebuffer);for(let ye=0;ye<S.length;ye++){if(I.resolveDepthBuffer&&(I.depthBuffer&&(ee|=i.DEPTH_BUFFER_BIT),I.stencilBuffer&&I.resolveStencilBuffer&&(ee|=i.STENCIL_BUFFER_BIT)),te){i.framebufferRenderbuffer(i.READ_FRAMEBUFFER,i.COLOR_ATTACHMENT0,i.RENDERBUFFER,xe.__webglColorRenderbuffer[ye]);const Ne=n.get(S[ye]).__webglTexture;i.framebufferTexture2D(i.DRAW_FRAMEBUFFER,i.COLOR_ATTACHMENT0,i.TEXTURE_2D,Ne,0)}i.blitFramebuffer(0,0,W,$,0,0,W,$,ee,i.NEAREST),l===!0&&(ue.length=0,_e.length=0,ue.push(i.COLOR_ATTACHMENT0+ye),I.depthBuffer&&I.resolveDepthBuffer===!1&&(ue.push(ve),_e.push(ve),i.invalidateFramebuffer(i.DRAW_FRAMEBUFFER,_e)),i.invalidateFramebuffer(i.READ_FRAMEBUFFER,ue))}if(t.bindFramebuffer(i.READ_FRAMEBUFFER,null),t.bindFramebuffer(i.DRAW_FRAMEBUFFER,null),te)for(let ye=0;ye<S.length;ye++){t.bindFramebuffer(i.FRAMEBUFFER,xe.__webglMultisampledFramebuffer),i.framebufferRenderbuffer(i.FRAMEBUFFER,i.COLOR_ATTACHMENT0+ye,i.RENDERBUFFER,xe.__webglColorRenderbuffer[ye]);const Ne=n.get(S[ye]).__webglTexture;t.bindFramebuffer(i.FRAMEBUFFER,xe.__webglFramebuffer),i.framebufferTexture2D(i.DRAW_FRAMEBUFFER,i.COLOR_ATTACHMENT0+ye,i.TEXTURE_2D,Ne,0)}t.bindFramebuffer(i.DRAW_FRAMEBUFFER,xe.__webglMultisampledFramebuffer)}else if(I.depthBuffer&&I.resolveDepthBuffer===!1&&l){const S=I.stencilBuffer?i.DEPTH_STENCIL_ATTACHMENT:i.DEPTH_ATTACHMENT;i.invalidateFramebuffer(i.DRAW_FRAMEBUFFER,[S])}}}function Fe(I){return Math.min(s.maxSamples,I.samples)}function We(I){const S=n.get(I);return I.samples>0&&e.has("WEBGL_multisampled_render_to_texture")===!0&&S.__useRenderToTexture!==!1}function k(I){const S=a.render.frame;h.get(I)!==S&&(h.set(I,S),I.update())}function it(I,S){const W=I.colorSpace,$=I.format,ee=I.type;return I.isCompressedTexture===!0||I.isVideoTexture===!0||W!==Oa&&W!==Mi&&(st.getTransfer(W)===pt?($!==Ln||ee!==un)&&Ke("WebGLTextures: sRGB encoded textures have to use RGBAFormat and UnsignedByteType."):at("WebGLTextures: Unsupported texture color space:",W)),S}function Qe(I){return typeof HTMLImageElement<"u"&&I instanceof HTMLImageElement?(c.width=I.naturalWidth||I.width,c.height=I.naturalHeight||I.height):typeof VideoFrame<"u"&&I instanceof VideoFrame?(c.width=I.displayWidth,c.height=I.displayHeight):(c.width=I.width,c.height=I.height),c}this.allocateTextureUnit=D,this.resetTextureUnits=Y,this.getTextureUnits=p,this.setTextureUnits=C,this.setTexture2D=O,this.setTexture2DArray=F,this.setTexture3D=G,this.setTextureCube=Z,this.rebindTextures=le,this.setupRenderTarget=he,this.updateRenderTargetMipmap=ce,this.updateMultisampleRenderTarget=ge,this.setupDepthRenderbuffer=re,this.setupFrameBufferTexture=ke,this.useMultisampledRTT=We,this.isReversedDepthBuffer=function(){return t.buffers.depth.getReversed()}}function OS(i,e){function t(n,s=Mi){let r;const a=st.getTransfer(s);if(n===un)return i.UNSIGNED_BYTE;if(n===Uc)return i.UNSIGNED_SHORT_4_4_4_4;if(n===Fc)return i.UNSIGNED_SHORT_5_5_5_1;if(n===pd)return i.UNSIGNED_INT_5_9_9_9_REV;if(n===md)return i.UNSIGNED_INT_10F_11F_11F_REV;if(n===dd)return i.BYTE;if(n===fd)return i.SHORT;if(n===Er)return i.UNSIGNED_SHORT;if(n===Nc)return i.INT;if(n===Xn)return i.UNSIGNED_INT;if(n===In)return i.FLOAT;if(n===dn)return i.HALF_FLOAT;if(n===gd)return i.ALPHA;if(n===vd)return i.RGB;if(n===Ln)return i.RGBA;if(n===ci)return i.DEPTH_COMPONENT;if(n===Fi)return i.DEPTH_STENCIL;if(n===Oc)return i.RED;if(n===Bc)return i.RED_INTEGER;if(n===Vi)return i.RG;if(n===kc)return i.RG_INTEGER;if(n===Gc)return i.RGBA_INTEGER;if(n===Ea||n===Ta||n===Aa||n===wa)if(a===pt)if(r=e.get("WEBGL_compressed_texture_s3tc_srgb"),r!==null){if(n===Ea)return r.COMPRESSED_SRGB_S3TC_DXT1_EXT;if(n===Ta)return r.COMPRESSED_SRGB_ALPHA_S3TC_DXT1_EXT;if(n===Aa)return r.COMPRESSED_SRGB_ALPHA_S3TC_DXT3_EXT;if(n===wa)return r.COMPRESSED_SRGB_ALPHA_S3TC_DXT5_EXT}else return null;else if(r=e.get("WEBGL_compressed_texture_s3tc"),r!==null){if(n===Ea)return r.COMPRESSED_RGB_S3TC_DXT1_EXT;if(n===Ta)return r.COMPRESSED_RGBA_S3TC_DXT1_EXT;if(n===Aa)return r.COMPRESSED_RGBA_S3TC_DXT3_EXT;if(n===wa)return r.COMPRESSED_RGBA_S3TC_DXT5_EXT}else return null;if(n===yl||n===bl||n===El||n===Tl)if(r=e.get("WEBGL_compressed_texture_pvrtc"),r!==null){if(n===yl)return r.COMPRESSED_RGB_PVRTC_4BPPV1_IMG;if(n===bl)return r.COMPRESSED_RGB_PVRTC_2BPPV1_IMG;if(n===El)return r.COMPRESSED_RGBA_PVRTC_4BPPV1_IMG;if(n===Tl)return r.COMPRESSED_RGBA_PVRTC_2BPPV1_IMG}else return null;if(n===Al||n===wl||n===Cl||n===Rl||n===Pl||n===Na||n===Il)if(r=e.get("WEBGL_compressed_texture_etc"),r!==null){if(n===Al||n===wl)return a===pt?r.COMPRESSED_SRGB8_ETC2:r.COMPRESSED_RGB8_ETC2;if(n===Cl)return a===pt?r.COMPRESSED_SRGB8_ALPHA8_ETC2_EAC:r.COMPRESSED_RGBA8_ETC2_EAC;if(n===Rl)return r.COMPRESSED_R11_EAC;if(n===Pl)return r.COMPRESSED_SIGNED_R11_EAC;if(n===Na)return r.COMPRESSED_RG11_EAC;if(n===Il)return r.COMPRESSED_SIGNED_RG11_EAC}else return null;if(n===Ll||n===Dl||n===Nl||n===Ul||n===Fl||n===Ol||n===Bl||n===kl||n===Gl||n===zl||n===Hl||n===Vl||n===Wl||n===Xl)if(r=e.get("WEBGL_compressed_texture_astc"),r!==null){if(n===Ll)return a===pt?r.COMPRESSED_SRGB8_ALPHA8_ASTC_4x4_KHR:r.COMPRESSED_RGBA_ASTC_4x4_KHR;if(n===Dl)return a===pt?r.COMPRESSED_SRGB8_ALPHA8_ASTC_5x4_KHR:r.COMPRESSED_RGBA_ASTC_5x4_KHR;if(n===Nl)return a===pt?r.COMPRESSED_SRGB8_ALPHA8_ASTC_5x5_KHR:r.COMPRESSED_RGBA_ASTC_5x5_KHR;if(n===Ul)return a===pt?r.COMPRESSED_SRGB8_ALPHA8_ASTC_6x5_KHR:r.COMPRESSED_RGBA_ASTC_6x5_KHR;if(n===Fl)return a===pt?r.COMPRESSED_SRGB8_ALPHA8_ASTC_6x6_KHR:r.COMPRESSED_RGBA_ASTC_6x6_KHR;if(n===Ol)return a===pt?r.COMPRESSED_SRGB8_ALPHA8_ASTC_8x5_KHR:r.COMPRESSED_RGBA_ASTC_8x5_KHR;if(n===Bl)return a===pt?r.COMPRESSED_SRGB8_ALPHA8_ASTC_8x6_KHR:r.COMPRESSED_RGBA_ASTC_8x6_KHR;if(n===kl)return a===pt?r.COMPRESSED_SRGB8_ALPHA8_ASTC_8x8_KHR:r.COMPRESSED_RGBA_ASTC_8x8_KHR;if(n===Gl)return a===pt?r.COMPRESSED_SRGB8_ALPHA8_ASTC_10x5_KHR:r.COMPRESSED_RGBA_ASTC_10x5_KHR;if(n===zl)return a===pt?r.COMPRESSED_SRGB8_ALPHA8_ASTC_10x6_KHR:r.COMPRESSED_RGBA_ASTC_10x6_KHR;if(n===Hl)return a===pt?r.COMPRESSED_SRGB8_ALPHA8_ASTC_10x8_KHR:r.COMPRESSED_RGBA_ASTC_10x8_KHR;if(n===Vl)return a===pt?r.COMPRESSED_SRGB8_ALPHA8_ASTC_10x10_KHR:r.COMPRESSED_RGBA_ASTC_10x10_KHR;if(n===Wl)return a===pt?r.COMPRESSED_SRGB8_ALPHA8_ASTC_12x10_KHR:r.COMPRESSED_RGBA_ASTC_12x10_KHR;if(n===Xl)return a===pt?r.COMPRESSED_SRGB8_ALPHA8_ASTC_12x12_KHR:r.COMPRESSED_RGBA_ASTC_12x12_KHR}else return null;if(n===Yl||n===ql||n===Kl)if(r=e.get("EXT_texture_compression_bptc"),r!==null){if(n===Yl)return a===pt?r.COMPRESSED_SRGB_ALPHA_BPTC_UNORM_EXT:r.COMPRESSED_RGBA_BPTC_UNORM_EXT;if(n===ql)return r.COMPRESSED_RGB_BPTC_SIGNED_FLOAT_EXT;if(n===Kl)return r.COMPRESSED_RGB_BPTC_UNSIGNED_FLOAT_EXT}else return null;if(n===$l||n===Zl||n===Ua||n===Jl)if(r=e.get("EXT_texture_compression_rgtc"),r!==null){if(n===$l)return r.COMPRESSED_RED_RGTC1_EXT;if(n===Zl)return r.COMPRESSED_SIGNED_RED_RGTC1_EXT;if(n===Ua)return r.COMPRESSED_RED_GREEN_RGTC2_EXT;if(n===Jl)return r.COMPRESSED_SIGNED_RED_GREEN_RGTC2_EXT}else return null;return n===Tr?i.UNSIGNED_INT_24_8:i[n]!==void 0?i[n]:null}return{convert:t}}const BS=`
void main() {

	gl_Position = vec4( position, 1.0 );

}`,kS=`
uniform sampler2DArray depthColor;
uniform float depthWidth;
uniform float depthHeight;

void main() {

	vec2 coord = vec2( gl_FragCoord.x / depthWidth, gl_FragCoord.y / depthHeight );

	if ( coord.x >= 1.0 ) {

		gl_FragDepth = texture( depthColor, vec3( coord.x - 1.0, coord.y, 1 ) ).r;

	} else {

		gl_FragDepth = texture( depthColor, vec3( coord.x, coord.y, 0 ) ).r;

	}

}`;class GS{constructor(){this.texture=null,this.mesh=null,this.depthNear=0,this.depthFar=0}init(e,t){if(this.texture===null){const n=new Id(e.texture);(e.depthNear!==t.depthNear||e.depthFar!==t.depthFar)&&(this.depthNear=e.depthNear,this.depthFar=e.depthFar),this.texture=n}}getMesh(e){if(this.texture!==null&&this.mesh===null){const t=e.cameras[0].viewport,n=new $t({vertexShader:BS,fragmentShader:kS,uniforms:{depthColor:{value:this.texture},depthWidth:{value:t.z},depthHeight:{value:t.w}}});this.mesh=new $e(new Sn(20,20),n)}return this.mesh}reset(){this.texture=null,this.mesh=null}getDepthTexture(){return this.texture}}class zS extends Ki{constructor(e,t){super();const n=this;let s=null,r=1,a=null,o="local-floor",l=1,c=null,h=null,f=null,d=null,u=null,m=null;const x=typeof XRWebGLBinding<"u",v=new GS,g={},y=t.getContextAttributes();let E=null,M=null;const T=[],w=[],R=new fe;let _=null;const b=new tn;b.viewport=new Rt;const P=new tn;P.viewport=new Rt;const L=[b,P],B=new $0;let Y=null,p=null;this.cameraAutoUpdate=!0,this.enabled=!1,this.isPresenting=!1,this.getController=function(j){let pe=T[j];return pe===void 0&&(pe=new bo,T[j]=pe),pe.getTargetRaySpace()},this.getControllerGrip=function(j){let pe=T[j];return pe===void 0&&(pe=new bo,T[j]=pe),pe.getGripSpace()},this.getHand=function(j){let pe=T[j];return pe===void 0&&(pe=new bo,T[j]=pe),pe.getHandSpace()};function C(j){const pe=w.indexOf(j.inputSource);if(pe===-1)return;const de=T[pe];de!==void 0&&(de.update(j.inputSource,j.frame,c||a),de.dispatchEvent({type:j.type,data:j.inputSource}))}function D(){s.removeEventListener("select",C),s.removeEventListener("selectstart",C),s.removeEventListener("selectend",C),s.removeEventListener("squeeze",C),s.removeEventListener("squeezestart",C),s.removeEventListener("squeezeend",C),s.removeEventListener("end",D),s.removeEventListener("inputsourceschange",U);for(let j=0;j<T.length;j++){const pe=w[j];pe!==null&&(w[j]=null,T[j].disconnect(pe))}Y=null,p=null,v.reset();for(const j in g)delete g[j];e.setRenderTarget(E),u=null,d=null,f=null,s=null,M=null,Re.stop(),n.isPresenting=!1,e.setPixelRatio(_),e.setSize(R.width,R.height,!1),n.dispatchEvent({type:"sessionend"})}this.setFramebufferScaleFactor=function(j){r=j,n.isPresenting===!0&&Ke("WebXRManager: Cannot change framebuffer scale while presenting.")},this.setReferenceSpaceType=function(j){o=j,n.isPresenting===!0&&Ke("WebXRManager: Cannot change reference space type while presenting.")},this.getReferenceSpace=function(){return c||a},this.setReferenceSpace=function(j){c=j},this.getBaseLayer=function(){return d!==null?d:u},this.getBinding=function(){return f===null&&x&&(f=new XRWebGLBinding(s,t)),f},this.getFrame=function(){return m},this.getSession=function(){return s},this.setSession=async function(j){if(s=j,s!==null){if(E=e.getRenderTarget(),s.addEventListener("select",C),s.addEventListener("selectstart",C),s.addEventListener("selectend",C),s.addEventListener("squeeze",C),s.addEventListener("squeezestart",C),s.addEventListener("squeezeend",C),s.addEventListener("end",D),s.addEventListener("inputsourceschange",U),y.xrCompatible!==!0&&await t.makeXRCompatible(),_=e.getPixelRatio(),e.getSize(R),x&&"createProjectionLayer"in XRWebGLBinding.prototype){let de=null,De=null,ze=null;y.depth&&(ze=y.stencil?t.DEPTH24_STENCIL8:t.DEPTH_COMPONENT24,de=y.stencil?Fi:ci,De=y.stencil?Tr:Xn);const ke={colorFormat:t.RGBA8,depthFormat:ze,scaleFactor:r};f=this.getBinding(),d=f.createProjectionLayer(ke),s.updateRenderState({layers:[d]}),e.setPixelRatio(1),e.setSize(d.textureWidth,d.textureHeight,!1),M=new nn(d.textureWidth,d.textureHeight,{format:Ln,type:un,depthTexture:new Ds(d.textureWidth,d.textureHeight,De,void 0,void 0,void 0,void 0,void 0,void 0,de),stencilBuffer:y.stencil,colorSpace:e.outputColorSpace,samples:y.antialias?4:0,resolveDepthBuffer:d.ignoreDepthValues===!1,resolveStencilBuffer:d.ignoreDepthValues===!1})}else{const de={antialias:y.antialias,alpha:!0,depth:y.depth,stencil:y.stencil,framebufferScaleFactor:r};u=new XRWebGLLayer(s,t,de),s.updateRenderState({baseLayer:u}),e.setPixelRatio(1),e.setSize(u.framebufferWidth,u.framebufferHeight,!1),M=new nn(u.framebufferWidth,u.framebufferHeight,{format:Ln,type:un,colorSpace:e.outputColorSpace,stencilBuffer:y.stencil,resolveDepthBuffer:u.ignoreDepthValues===!1,resolveStencilBuffer:u.ignoreDepthValues===!1})}M.isXRRenderTarget=!0,this.setFoveation(l),c=null,a=await s.requestReferenceSpace(o),Re.setContext(s),Re.start(),n.isPresenting=!0,n.dispatchEvent({type:"sessionstart"})}},this.getEnvironmentBlendMode=function(){if(s!==null)return s.environmentBlendMode},this.getDepthTexture=function(){return v.getDepthTexture()};function U(j){for(let pe=0;pe<j.removed.length;pe++){const de=j.removed[pe],De=w.indexOf(de);De>=0&&(w[De]=null,T[De].disconnect(de))}for(let pe=0;pe<j.added.length;pe++){const de=j.added[pe];let De=w.indexOf(de);if(De===-1){for(let ke=0;ke<T.length;ke++)if(ke>=w.length){w.push(de),De=ke;break}else if(w[ke]===null){w[ke]=de,De=ke;break}if(De===-1)break}const ze=T[De];ze&&ze.connect(de)}}const O=new N,F=new N;function G(j,pe,de){O.setFromMatrixPosition(pe.matrixWorld),F.setFromMatrixPosition(de.matrixWorld);const De=O.distanceTo(F),ze=pe.projectionMatrix.elements,ke=de.projectionMatrix.elements,et=ze[14]/(ze[10]-1),He=ze[14]/(ze[10]+1),re=(ze[9]+1)/ze[5],le=(ze[9]-1)/ze[5],he=(ze[8]-1)/ze[0],ce=(ke[8]+1)/ke[0],ue=et*he,_e=et*ce,ge=De/(-he+ce),Fe=ge*-he;if(pe.matrixWorld.decompose(j.position,j.quaternion,j.scale),j.translateX(Fe),j.translateZ(ge),j.matrixWorld.compose(j.position,j.quaternion,j.scale),j.matrixWorldInverse.copy(j.matrixWorld).invert(),ze[10]===-1)j.projectionMatrix.copy(pe.projectionMatrix),j.projectionMatrixInverse.copy(pe.projectionMatrixInverse);else{const We=et+ge,k=He+ge,it=ue-Fe,Qe=_e+(De-Fe),I=re*He/k*We,S=le*He/k*We;j.projectionMatrix.makePerspective(it,Qe,I,S,We,k),j.projectionMatrixInverse.copy(j.projectionMatrix).invert()}}function Z(j,pe){pe===null?j.matrixWorld.copy(j.matrix):j.matrixWorld.multiplyMatrices(pe.matrixWorld,j.matrix),j.matrixWorldInverse.copy(j.matrixWorld).invert()}this.updateCamera=function(j){if(s===null)return;let pe=j.near,de=j.far;v.texture!==null&&(v.depthNear>0&&(pe=v.depthNear),v.depthFar>0&&(de=v.depthFar)),B.near=P.near=b.near=pe,B.far=P.far=b.far=de,(Y!==B.near||p!==B.far)&&(s.updateRenderState({depthNear:B.near,depthFar:B.far}),Y=B.near,p=B.far),B.layers.mask=j.layers.mask|6,b.layers.mask=B.layers.mask&-5,P.layers.mask=B.layers.mask&-3;const De=j.parent,ze=B.cameras;Z(B,De);for(let ke=0;ke<ze.length;ke++)Z(ze[ke],De);ze.length===2?G(B,b,P):B.projectionMatrix.copy(b.projectionMatrix),ae(j,B,De)};function ae(j,pe,de){de===null?j.matrix.copy(pe.matrixWorld):(j.matrix.copy(de.matrixWorld),j.matrix.invert(),j.matrix.multiply(pe.matrixWorld)),j.matrix.decompose(j.position,j.quaternion,j.scale),j.updateMatrixWorld(!0),j.projectionMatrix.copy(pe.projectionMatrix),j.projectionMatrixInverse.copy(pe.projectionMatrixInverse),j.isPerspectiveCamera&&(j.fov=Ls*2*Math.atan(1/j.projectionMatrix.elements[5]),j.zoom=1)}this.getCamera=function(){return B},this.getFoveation=function(){if(!(d===null&&u===null))return l},this.setFoveation=function(j){l=j,d!==null&&(d.fixedFoveation=j),u!==null&&u.fixedFoveation!==void 0&&(u.fixedFoveation=j)},this.hasDepthSensing=function(){return v.texture!==null},this.getDepthSensingMesh=function(){return v.getMesh(B)},this.getCameraTexture=function(j){return g[j]};let Te=null;function qe(j,pe){if(h=pe.getViewerPose(c||a),m=pe,h!==null){const de=h.views;u!==null&&(e.setRenderTargetFramebuffer(M,u.framebuffer),e.setRenderTarget(M));let De=!1;de.length!==B.cameras.length&&(B.cameras.length=0,De=!0);for(let He=0;He<de.length;He++){const re=de[He];let le=null;if(u!==null)le=u.getViewport(re);else{const ce=f.getViewSubImage(d,re);le=ce.viewport,He===0&&(e.setRenderTargetTextures(M,ce.colorTexture,ce.depthStencilTexture),e.setRenderTarget(M))}let he=L[He];he===void 0&&(he=new tn,he.layers.enable(He),he.viewport=new Rt,L[He]=he),he.matrix.fromArray(re.transform.matrix),he.matrix.decompose(he.position,he.quaternion,he.scale),he.projectionMatrix.fromArray(re.projectionMatrix),he.projectionMatrixInverse.copy(he.projectionMatrix).invert(),he.viewport.set(le.x,le.y,le.width,le.height),He===0&&(B.matrix.copy(he.matrix),B.matrix.decompose(B.position,B.quaternion,B.scale)),De===!0&&B.cameras.push(he)}const ze=s.enabledFeatures;if(ze&&ze.includes("depth-sensing")&&s.depthUsage=="gpu-optimized"&&x){f=n.getBinding();const He=f.getDepthInformation(de[0]);He&&He.isValid&&He.texture&&v.init(He,s.renderState)}if(ze&&ze.includes("camera-access")&&x){e.state.unbindTexture(),f=n.getBinding();for(let He=0;He<de.length;He++){const re=de[He].camera;if(re){let le=g[re];le||(le=new Id,g[re]=le);const he=f.getCameraImage(re);le.sourceTexture=he}}}}for(let de=0;de<T.length;de++){const De=w[de],ze=T[de];De!==null&&ze!==void 0&&ze.update(De,pe,c||a)}Te&&Te(j,pe),pe.detectedPlanes&&n.dispatchEvent({type:"planesdetected",data:pe}),m=null}const Re=new Kd;Re.setAnimationLoop(qe),this.setAnimationLoop=function(j){Te=j},this.dispose=function(){}}}const HS=new ut,tf=new Je;tf.set(-1,0,0,0,1,0,0,0,1);function VS(i,e){function t(v,g){v.matrixAutoUpdate===!0&&v.updateMatrix(),g.value.copy(v.matrix)}function n(v,g){g.color.getRGB(v.fogColor.value,zd(i)),g.isFog?(v.fogNear.value=g.near,v.fogFar.value=g.far):g.isFogExp2&&(v.fogDensity.value=g.density)}function s(v,g,y,E,M){g.isNodeMaterial?g.uniformsNeedUpdate=!1:g.isMeshBasicMaterial?r(v,g):g.isMeshLambertMaterial?(r(v,g),g.envMap&&(v.envMapIntensity.value=g.envMapIntensity)):g.isMeshToonMaterial?(r(v,g),f(v,g)):g.isMeshPhongMaterial?(r(v,g),h(v,g),g.envMap&&(v.envMapIntensity.value=g.envMapIntensity)):g.isMeshStandardMaterial?(r(v,g),d(v,g),g.isMeshPhysicalMaterial&&u(v,g,M)):g.isMeshMatcapMaterial?(r(v,g),m(v,g)):g.isMeshDepthMaterial?r(v,g):g.isMeshDistanceMaterial?(r(v,g),x(v,g)):g.isMeshNormalMaterial?r(v,g):g.isLineBasicMaterial?(a(v,g),g.isLineDashedMaterial&&o(v,g)):g.isPointsMaterial?l(v,g,y,E):g.isSpriteMaterial?c(v,g):g.isShadowMaterial?(v.color.value.copy(g.color),v.opacity.value=g.opacity):g.isShaderMaterial&&(g.uniformsNeedUpdate=!1)}function r(v,g){v.opacity.value=g.opacity,g.color&&v.diffuse.value.copy(g.color),g.emissive&&v.emissive.value.copy(g.emissive).multiplyScalar(g.emissiveIntensity),g.map&&(v.map.value=g.map,t(g.map,v.mapTransform)),g.alphaMap&&(v.alphaMap.value=g.alphaMap,t(g.alphaMap,v.alphaMapTransform)),g.bumpMap&&(v.bumpMap.value=g.bumpMap,t(g.bumpMap,v.bumpMapTransform),v.bumpScale.value=g.bumpScale,g.side===en&&(v.bumpScale.value*=-1)),g.normalMap&&(v.normalMap.value=g.normalMap,t(g.normalMap,v.normalMapTransform),v.normalScale.value.copy(g.normalScale),g.side===en&&v.normalScale.value.negate()),g.displacementMap&&(v.displacementMap.value=g.displacementMap,t(g.displacementMap,v.displacementMapTransform),v.displacementScale.value=g.displacementScale,v.displacementBias.value=g.displacementBias),g.emissiveMap&&(v.emissiveMap.value=g.emissiveMap,t(g.emissiveMap,v.emissiveMapTransform)),g.specularMap&&(v.specularMap.value=g.specularMap,t(g.specularMap,v.specularMapTransform)),g.alphaTest>0&&(v.alphaTest.value=g.alphaTest);const y=e.get(g),E=y.envMap,M=y.envMapRotation;E&&(v.envMap.value=E,v.envMapRotation.value.setFromMatrix4(HS.makeRotationFromEuler(M)).transpose(),E.isCubeTexture&&E.isRenderTargetTexture===!1&&v.envMapRotation.value.premultiply(tf),v.reflectivity.value=g.reflectivity,v.ior.value=g.ior,v.refractionRatio.value=g.refractionRatio),g.lightMap&&(v.lightMap.value=g.lightMap,v.lightMapIntensity.value=g.lightMapIntensity,t(g.lightMap,v.lightMapTransform)),g.aoMap&&(v.aoMap.value=g.aoMap,v.aoMapIntensity.value=g.aoMapIntensity,t(g.aoMap,v.aoMapTransform))}function a(v,g){v.diffuse.value.copy(g.color),v.opacity.value=g.opacity,g.map&&(v.map.value=g.map,t(g.map,v.mapTransform))}function o(v,g){v.dashSize.value=g.dashSize,v.totalSize.value=g.dashSize+g.gapSize,v.scale.value=g.scale}function l(v,g,y,E){v.diffuse.value.copy(g.color),v.opacity.value=g.opacity,v.size.value=g.size*y,v.scale.value=E*.5,g.map&&(v.map.value=g.map,t(g.map,v.uvTransform)),g.alphaMap&&(v.alphaMap.value=g.alphaMap,t(g.alphaMap,v.alphaMapTransform)),g.alphaTest>0&&(v.alphaTest.value=g.alphaTest)}function c(v,g){v.diffuse.value.copy(g.color),v.opacity.value=g.opacity,v.rotation.value=g.rotation,g.map&&(v.map.value=g.map,t(g.map,v.mapTransform)),g.alphaMap&&(v.alphaMap.value=g.alphaMap,t(g.alphaMap,v.alphaMapTransform)),g.alphaTest>0&&(v.alphaTest.value=g.alphaTest)}function h(v,g){v.specular.value.copy(g.specular),v.shininess.value=Math.max(g.shininess,1e-4)}function f(v,g){g.gradientMap&&(v.gradientMap.value=g.gradientMap)}function d(v,g){v.metalness.value=g.metalness,g.metalnessMap&&(v.metalnessMap.value=g.metalnessMap,t(g.metalnessMap,v.metalnessMapTransform)),v.roughness.value=g.roughness,g.roughnessMap&&(v.roughnessMap.value=g.roughnessMap,t(g.roughnessMap,v.roughnessMapTransform)),g.envMap&&(v.envMapIntensity.value=g.envMapIntensity)}function u(v,g,y){v.ior.value=g.ior,g.sheen>0&&(v.sheenColor.value.copy(g.sheenColor).multiplyScalar(g.sheen),v.sheenRoughness.value=g.sheenRoughness,g.sheenColorMap&&(v.sheenColorMap.value=g.sheenColorMap,t(g.sheenColorMap,v.sheenColorMapTransform)),g.sheenRoughnessMap&&(v.sheenRoughnessMap.value=g.sheenRoughnessMap,t(g.sheenRoughnessMap,v.sheenRoughnessMapTransform))),g.clearcoat>0&&(v.clearcoat.value=g.clearcoat,v.clearcoatRoughness.value=g.clearcoatRoughness,g.clearcoatMap&&(v.clearcoatMap.value=g.clearcoatMap,t(g.clearcoatMap,v.clearcoatMapTransform)),g.clearcoatRoughnessMap&&(v.clearcoatRoughnessMap.value=g.clearcoatRoughnessMap,t(g.clearcoatRoughnessMap,v.clearcoatRoughnessMapTransform)),g.clearcoatNormalMap&&(v.clearcoatNormalMap.value=g.clearcoatNormalMap,t(g.clearcoatNormalMap,v.clearcoatNormalMapTransform),v.clearcoatNormalScale.value.copy(g.clearcoatNormalScale),g.side===en&&v.clearcoatNormalScale.value.negate())),g.dispersion>0&&(v.dispersion.value=g.dispersion),g.iridescence>0&&(v.iridescence.value=g.iridescence,v.iridescenceIOR.value=g.iridescenceIOR,v.iridescenceThicknessMinimum.value=g.iridescenceThicknessRange[0],v.iridescenceThicknessMaximum.value=g.iridescenceThicknessRange[1],g.iridescenceMap&&(v.iridescenceMap.value=g.iridescenceMap,t(g.iridescenceMap,v.iridescenceMapTransform)),g.iridescenceThicknessMap&&(v.iridescenceThicknessMap.value=g.iridescenceThicknessMap,t(g.iridescenceThicknessMap,v.iridescenceThicknessMapTransform))),g.transmission>0&&(v.transmission.value=g.transmission,v.transmissionSamplerMap.value=y.texture,v.transmissionSamplerSize.value.set(y.width,y.height),g.transmissionMap&&(v.transmissionMap.value=g.transmissionMap,t(g.transmissionMap,v.transmissionMapTransform)),v.thickness.value=g.thickness,g.thicknessMap&&(v.thicknessMap.value=g.thicknessMap,t(g.thicknessMap,v.thicknessMapTransform)),v.attenuationDistance.value=g.attenuationDistance,v.attenuationColor.value.copy(g.attenuationColor)),g.anisotropy>0&&(v.anisotropyVector.value.set(g.anisotropy*Math.cos(g.anisotropyRotation),g.anisotropy*Math.sin(g.anisotropyRotation)),g.anisotropyMap&&(v.anisotropyMap.value=g.anisotropyMap,t(g.anisotropyMap,v.anisotropyMapTransform))),v.specularIntensity.value=g.specularIntensity,v.specularColor.value.copy(g.specularColor),g.specularColorMap&&(v.specularColorMap.value=g.specularColorMap,t(g.specularColorMap,v.specularColorMapTransform)),g.specularIntensityMap&&(v.specularIntensityMap.value=g.specularIntensityMap,t(g.specularIntensityMap,v.specularIntensityMapTransform))}function m(v,g){g.matcap&&(v.matcap.value=g.matcap)}function x(v,g){const y=e.get(g).light;v.referencePosition.value.setFromMatrixPosition(y.matrixWorld),v.nearDistance.value=y.shadow.camera.near,v.farDistance.value=y.shadow.camera.far}return{refreshFogUniforms:n,refreshMaterialUniforms:s}}function WS(i,e,t,n){let s={},r={},a=[];const o=i.getParameter(i.MAX_UNIFORM_BUFFER_BINDINGS);function l(M,T){const w=T.program;n.uniformBlockBinding(M,w)}function c(M,T){let w=s[M.id];w===void 0&&(v(M),w=h(M),s[M.id]=w,M.addEventListener("dispose",y));const R=T.program;n.updateUBOMapping(M,R);const _=e.render.frame;r[M.id]!==_&&(d(M),r[M.id]=_)}function h(M){const T=f();M.__bindingPointIndex=T;const w=i.createBuffer(),R=M.__size,_=M.usage;return i.bindBuffer(i.UNIFORM_BUFFER,w),i.bufferData(i.UNIFORM_BUFFER,R,_),i.bindBuffer(i.UNIFORM_BUFFER,null),i.bindBufferBase(i.UNIFORM_BUFFER,T,w),w}function f(){for(let M=0;M<o;M++)if(a.indexOf(M)===-1)return a.push(M),M;return at("WebGLRenderer: Maximum number of simultaneously usable uniforms groups reached."),0}function d(M){const T=s[M.id],w=M.uniforms,R=M.__cache;i.bindBuffer(i.UNIFORM_BUFFER,T);for(let _=0,b=w.length;_<b;_++){const P=w[_];if(Array.isArray(P))for(let L=0,B=P.length;L<B;L++)u(P[L],_,L,R);else u(P,_,0,R)}i.bindBuffer(i.UNIFORM_BUFFER,null)}function u(M,T,w,R){if(x(M,T,w,R)===!0){const _=M.__offset,b=M.value;if(Array.isArray(b)){let P=0;for(let L=0;L<b.length;L++){const B=b[L],Y=g(B);m(B,M.__data,P),typeof B!="number"&&typeof B!="boolean"&&!B.isMatrix3&&!ArrayBuffer.isView(B)&&(P+=Y.storage/Float32Array.BYTES_PER_ELEMENT)}}else m(b,M.__data,0);i.bufferSubData(i.UNIFORM_BUFFER,_,M.__data)}}function m(M,T,w){typeof M=="number"||typeof M=="boolean"?T[0]=M:M.isMatrix3?(T[0]=M.elements[0],T[1]=M.elements[1],T[2]=M.elements[2],T[3]=0,T[4]=M.elements[3],T[5]=M.elements[4],T[6]=M.elements[5],T[7]=0,T[8]=M.elements[6],T[9]=M.elements[7],T[10]=M.elements[8],T[11]=0):ArrayBuffer.isView(M)?T.set(new M.constructor(M.buffer,M.byteOffset,T.length)):M.toArray(T,w)}function x(M,T,w,R){const _=M.value,b=T+"_"+w;if(R[b]===void 0)return typeof _=="number"||typeof _=="boolean"?R[b]=_:ArrayBuffer.isView(_)?R[b]=_.slice():R[b]=_.clone(),!0;{const P=R[b];if(typeof _=="number"||typeof _=="boolean"){if(P!==_)return R[b]=_,!0}else{if(ArrayBuffer.isView(_))return!0;if(P.equals(_)===!1)return P.copy(_),!0}}return!1}function v(M){const T=M.uniforms;let w=0;const R=16;for(let b=0,P=T.length;b<P;b++){const L=Array.isArray(T[b])?T[b]:[T[b]];for(let B=0,Y=L.length;B<Y;B++){const p=L[B],C=Array.isArray(p.value)?p.value:[p.value];for(let D=0,U=C.length;D<U;D++){const O=C[D],F=g(O),G=w%R,Z=G%F.boundary,ae=G+Z;w+=Z,ae!==0&&R-ae<F.storage&&(w+=R-ae),p.__data=new Float32Array(F.storage/Float32Array.BYTES_PER_ELEMENT),p.__offset=w,w+=F.storage}}}const _=w%R;return _>0&&(w+=R-_),M.__size=w,M.__cache={},this}function g(M){const T={boundary:0,storage:0};return typeof M=="number"||typeof M=="boolean"?(T.boundary=4,T.storage=4):M.isVector2?(T.boundary=8,T.storage=8):M.isVector3||M.isColor?(T.boundary=16,T.storage=12):M.isVector4?(T.boundary=16,T.storage=16):M.isMatrix3?(T.boundary=48,T.storage=48):M.isMatrix4?(T.boundary=64,T.storage=64):M.isTexture?Ke("WebGLRenderer: Texture samplers can not be part of an uniforms group."):ArrayBuffer.isView(M)?(T.boundary=16,T.storage=M.byteLength):Ke("WebGLRenderer: Unsupported uniform value type.",M),T}function y(M){const T=M.target;T.removeEventListener("dispose",y);const w=a.indexOf(T.__bindingPointIndex);a.splice(w,1),i.deleteBuffer(s[T.id]),delete s[T.id],delete r[T.id]}function E(){for(const M in s)i.deleteBuffer(s[M]);a=[],s={},r={}}return{bind:l,update:c,dispose:E}}const XS=new Uint16Array([12469,15057,12620,14925,13266,14620,13807,14376,14323,13990,14545,13625,14713,13328,14840,12882,14931,12528,14996,12233,15039,11829,15066,11525,15080,11295,15085,10976,15082,10705,15073,10495,13880,14564,13898,14542,13977,14430,14158,14124,14393,13732,14556,13410,14702,12996,14814,12596,14891,12291,14937,11834,14957,11489,14958,11194,14943,10803,14921,10506,14893,10278,14858,9960,14484,14039,14487,14025,14499,13941,14524,13740,14574,13468,14654,13106,14743,12678,14818,12344,14867,11893,14889,11509,14893,11180,14881,10751,14852,10428,14812,10128,14765,9754,14712,9466,14764,13480,14764,13475,14766,13440,14766,13347,14769,13070,14786,12713,14816,12387,14844,11957,14860,11549,14868,11215,14855,10751,14825,10403,14782,10044,14729,9651,14666,9352,14599,9029,14967,12835,14966,12831,14963,12804,14954,12723,14936,12564,14917,12347,14900,11958,14886,11569,14878,11247,14859,10765,14828,10401,14784,10011,14727,9600,14660,9289,14586,8893,14508,8533,15111,12234,15110,12234,15104,12216,15092,12156,15067,12010,15028,11776,14981,11500,14942,11205,14902,10752,14861,10393,14812,9991,14752,9570,14682,9252,14603,8808,14519,8445,14431,8145,15209,11449,15208,11451,15202,11451,15190,11438,15163,11384,15117,11274,15055,10979,14994,10648,14932,10343,14871,9936,14803,9532,14729,9218,14645,8742,14556,8381,14461,8020,14365,7603,15273,10603,15272,10607,15267,10619,15256,10631,15231,10614,15182,10535,15118,10389,15042,10167,14963,9787,14883,9447,14800,9115,14710,8665,14615,8318,14514,7911,14411,7507,14279,7198,15314,9675,15313,9683,15309,9712,15298,9759,15277,9797,15229,9773,15166,9668,15084,9487,14995,9274,14898,8910,14800,8539,14697,8234,14590,7790,14479,7409,14367,7067,14178,6621,15337,8619,15337,8631,15333,8677,15325,8769,15305,8871,15264,8940,15202,8909,15119,8775,15022,8565,14916,8328,14804,8009,14688,7614,14569,7287,14448,6888,14321,6483,14088,6171,15350,7402,15350,7419,15347,7480,15340,7613,15322,7804,15287,7973,15229,8057,15148,8012,15046,7846,14933,7611,14810,7357,14682,7069,14552,6656,14421,6316,14251,5948,14007,5528,15356,5942,15356,5977,15353,6119,15348,6294,15332,6551,15302,6824,15249,7044,15171,7122,15070,7050,14949,6861,14818,6611,14679,6349,14538,6067,14398,5651,14189,5311,13935,4958,15359,4123,15359,4153,15356,4296,15353,4646,15338,5160,15311,5508,15263,5829,15188,6042,15088,6094,14966,6001,14826,5796,14678,5543,14527,5287,14377,4985,14133,4586,13869,4257,15360,1563,15360,1642,15358,2076,15354,2636,15341,3350,15317,4019,15273,4429,15203,4732,15105,4911,14981,4932,14836,4818,14679,4621,14517,4386,14359,4156,14083,3795,13808,3437,15360,122,15360,137,15358,285,15355,636,15344,1274,15322,2177,15281,2765,15215,3223,15120,3451,14995,3569,14846,3567,14681,3466,14511,3305,14344,3121,14037,2800,13753,2467,15360,0,15360,1,15359,21,15355,89,15346,253,15325,479,15287,796,15225,1148,15133,1492,15008,1749,14856,1882,14685,1886,14506,1783,14324,1608,13996,1398,13702,1183]);let Fn=null;function YS(){return Fn===null&&(Fn=new Cd(XS,16,16,Vi,dn),Fn.name="DFG_LUT",Fn.minFilter=Ft,Fn.magFilter=Ft,Fn.wrapS=Pn,Fn.wrapT=Pn,Fn.generateMipmaps=!1,Fn.needsUpdate=!0),Fn}class qS{constructor(e={}){const{canvas:t=fm(),context:n=null,depth:s=!0,stencil:r=!1,alpha:a=!1,antialias:o=!1,premultipliedAlpha:l=!0,preserveDrawingBuffer:c=!1,powerPreference:h="default",failIfMajorPerformanceCaveat:f=!1,reversedDepthBuffer:d=!1,outputBufferType:u=un}=e;this.isWebGLRenderer=!0;let m;if(n!==null){if(typeof WebGLRenderingContext<"u"&&n instanceof WebGLRenderingContext)throw new Error("THREE.WebGLRenderer: WebGL 1 is not supported since r163.");m=n.getContextAttributes().alpha}else m=a;const x=u,v=new Set([Gc,kc,Bc]),g=new Set([un,Xn,Er,Tr,Uc,Fc]),y=new Uint32Array(4),E=new Int32Array(4),M=new N;let T=null,w=null;const R=[],_=[];let b=null;this.domElement=t,this.debug={checkShaderErrors:!0,onShaderError:null},this.autoClear=!0,this.autoClearColor=!0,this.autoClearDepth=!0,this.autoClearStencil=!0,this.sortObjects=!0,this.clippingPlanes=[],this.localClippingEnabled=!1,this.toneMapping=zn,this.toneMappingExposure=1,this.transmissionResolutionScale=1;const P=this;let L=!1,B=null,Y=null,p=null,C=null;this._outputColorSpace=kt;let D=0,U=0,O=null,F=-1,G=null;const Z=new Rt,ae=new Rt;let Te=null;const qe=new Le(0);let Re=0,j=t.width,pe=t.height,de=1,De=null,ze=null;const ke=new Rt(0,0,j,pe),et=new Rt(0,0,j,pe);let He=!1;const re=new Yc;let le=!1,he=!1;const ce=new ut,ue=new N,_e=new Rt,ge={background:null,fog:null,environment:null,overrideMaterial:null,isScene:!0};let Fe=!1;function We(){return O===null?de:1}let k=n;function it(A,H){return t.getContext(A,H)}try{const A={alpha:!0,depth:s,stencil:r,antialias:o,premultipliedAlpha:l,preserveDrawingBuffer:c,powerPreference:h,failIfMajorPerformanceCaveat:f};if("setAttribute"in t&&t.setAttribute("data-engine",`three.js r${Ac}`),t.addEventListener("webglcontextlost",At,!1),t.addEventListener("webglcontextrestored",vt,!1),t.addEventListener("webglcontextcreationerror",rn,!1),k===null){const H="webgl2";if(k=it(H,A),k===null)throw it(H)?new Error("THREE.WebGLRenderer: Error creating WebGL context with your selected attributes."):new Error("THREE.WebGLRenderer: Error creating WebGL context.")}}catch(A){throw at("WebGLRenderer: "+A.message),A}let Qe,I,S,W,$,ee,ve,xe,te,ne,ye,Ne,Ae,Ee,Ge,Xe,Ze,z,Me,ie,be,we,oe;function Be(){Qe=new Y_(k),Qe.init(),be=new OS(k,Qe),I=new B_(k,Qe,e,be),S=new US(k,Qe),I.reversedDepthBuffer&&d&&S.buffers.depth.setReversed(!0),Y=k.createFramebuffer(),p=k.createFramebuffer(),C=k.createFramebuffer(),W=new $_(k),$=new MS,ee=new FS(k,Qe,S,$,I,be,W),ve=new X_(P),xe=new j0(k),we=new F_(k,xe),te=new q_(k,xe,W,we),ne=new J_(k,te,xe,we,W),z=new Z_(k,I,ee),Ge=new k_($),ye=new SS(P,ve,Qe,I,we,Ge),Ne=new VS(P,$),Ae=new bS,Ee=new RS(Qe),Ze=new U_(P,ve,S,ne,m,l),Xe=new NS(P,ne,I),oe=new WS(k,W,I,S),Me=new O_(k,Qe,W),ie=new K_(k,Qe,W),W.programs=ye.programs,P.capabilities=I,P.extensions=Qe,P.properties=$,P.renderLists=Ae,P.shadowMap=Xe,P.state=S,P.info=W}Be(),x!==un&&(b=new j_(x,t.width,t.height,o,s,r));const Ue=new zS(P,k);this.xr=Ue,this.getContext=function(){return k},this.getContextAttributes=function(){return k.getContextAttributes()},this.forceContextLoss=function(){const A=Qe.get("WEBGL_lose_context");A&&A.loseContext()},this.forceContextRestore=function(){const A=Qe.get("WEBGL_lose_context");A&&A.restoreContext()},this.getPixelRatio=function(){return de},this.setPixelRatio=function(A){A!==void 0&&(de=A,this.setSize(j,pe,!1))},this.getSize=function(A){return A.set(j,pe)},this.setSize=function(A,H,J=!0){if(Ue.isPresenting){Ke("WebGLRenderer: Can't change size while VR device is presenting.");return}j=A,pe=H,t.width=Math.floor(A*de),t.height=Math.floor(H*de),J===!0&&(t.style.width=A+"px",t.style.height=H+"px"),b!==null&&b.setSize(t.width,t.height),this.setViewport(0,0,A,H)},this.getDrawingBufferSize=function(A){return A.set(j*de,pe*de).floor()},this.setDrawingBufferSize=function(A,H,J){j=A,pe=H,de=J,t.width=Math.floor(A*J),t.height=Math.floor(H*J),this.setViewport(0,0,A,H)},this.setEffects=function(A){if(x===un){at("WebGLRenderer: setEffects() requires outputBufferType set to HalfFloatType or FloatType.");return}if(A){for(let H=0;H<A.length;H++)if(A[H].isOutputPass===!0){Ke("WebGLRenderer: OutputPass is not needed in setEffects(). Tone mapping and color space conversion are applied automatically.");break}}b.setEffects(A||[])},this.getCurrentViewport=function(A){return A.copy(Z)},this.getViewport=function(A){return A.copy(ke)},this.setViewport=function(A,H,J,K){A.isVector4?ke.set(A.x,A.y,A.z,A.w):ke.set(A,H,J,K),S.viewport(Z.copy(ke).multiplyScalar(de).round())},this.getScissor=function(A){return A.copy(et)},this.setScissor=function(A,H,J,K){A.isVector4?et.set(A.x,A.y,A.z,A.w):et.set(A,H,J,K),S.scissor(ae.copy(et).multiplyScalar(de).round())},this.getScissorTest=function(){return He},this.setScissorTest=function(A){S.setScissorTest(He=A)},this.setOpaqueSort=function(A){De=A},this.setTransparentSort=function(A){ze=A},this.getClearColor=function(A){return A.copy(Ze.getClearColor())},this.setClearColor=function(){Ze.setClearColor(...arguments)},this.getClearAlpha=function(){return Ze.getClearAlpha()},this.setClearAlpha=function(){Ze.setClearAlpha(...arguments)},this.clear=function(A=!0,H=!0,J=!0){let K=0;if(A){let q=!1;if(O!==null){const Ce=O.texture.format;q=v.has(Ce)}if(q){const Ce=O.texture.type,V=g.has(Ce),X=Ze.getClearColor(),Q=Ze.getClearAlpha(),Se=X.r,Ye=X.g,Ve=X.b;V?(y[0]=Se,y[1]=Ye,y[2]=Ve,y[3]=Q,k.clearBufferuiv(k.COLOR,0,y)):(E[0]=Se,E[1]=Ye,E[2]=Ve,E[3]=Q,k.clearBufferiv(k.COLOR,0,E))}else K|=k.COLOR_BUFFER_BIT}H&&(K|=k.DEPTH_BUFFER_BIT,this.state.buffers.depth.setMask(!0)),J&&(K|=k.STENCIL_BUFFER_BIT,this.state.buffers.stencil.setMask(4294967295)),K!==0&&k.clear(K)},this.clearColor=function(){this.clear(!0,!1,!1)},this.clearDepth=function(){this.clear(!1,!0,!1)},this.clearStencil=function(){this.clear(!1,!1,!0)},this.setNodesHandler=function(A){A.setRenderer(this),B=A},this.dispose=function(){t.removeEventListener("webglcontextlost",At,!1),t.removeEventListener("webglcontextrestored",vt,!1),t.removeEventListener("webglcontextcreationerror",rn,!1),Ze.dispose(),Ae.dispose(),Ee.dispose(),$.dispose(),ve.dispose(),ne.dispose(),we.dispose(),oe.dispose(),ye.dispose(),Ue.dispose(),Ue.removeEventListener("sessionstart",Vs),Ue.removeEventListener("sessionend",Ws),$n.stop()};function At(A){A.preventDefault(),ka("WebGLRenderer: Context Lost."),L=!0}function vt(){ka("WebGLRenderer: Context Restored."),L=!1;const A=W.autoReset,H=Xe.enabled,J=Xe.autoUpdate,K=Xe.needsUpdate,q=Xe.type;Be(),W.autoReset=A,Xe.enabled=H,Xe.autoUpdate=J,Xe.needsUpdate=K,Xe.type=q}function rn(A){at("WebGLRenderer: A WebGL context could not be created. Reason: ",A.statusMessage)}function fn(A){const H=A.target;H.removeEventListener("dispose",fn),ao(H)}function ao(A){Ji(A),$.remove(A)}function Ji(A){const H=$.get(A).programs;H!==void 0&&(H.forEach(function(J){ye.releaseProgram(J)}),A.isShaderMaterial&&ye.releaseShaderCache(A))}this.renderBufferDirect=function(A,H,J,K,q,Ce){H===null&&(H=ge);const V=q.isMesh&&q.matrixWorld.determinantAffine()<0,X=Ur(A,H,J,K,q);S.setMaterial(K,V);let Q=J.index,Se=1;if(K.wireframe===!0){if(Q=te.getWireframeAttribute(J),Q===void 0)return;Se=2}const Ye=J.drawRange,Ve=J.attributes.position;let Oe=Ye.start*Se,ot=(Ye.start+Ye.count)*Se;Ce!==null&&(Oe=Math.max(Oe,Ce.start*Se),ot=Math.min(ot,(Ce.start+Ce.count)*Se)),Q!==null?(Oe=Math.max(Oe,0),ot=Math.min(ot,Q.count)):Ve!=null&&(Oe=Math.max(Oe,0),ot=Math.min(ot,Ve.count));const wt=ot-Oe;if(wt<0||wt===1/0)return;we.setup(q,K,X,J,Q);let Et,xt=Me;if(Q!==null&&(Et=xe.get(Q),xt=ie,xt.setIndex(Et)),q.isMesh)K.wireframe===!0?(S.setLineWidth(K.wireframeLinewidth*We()),xt.setMode(k.LINES)):xt.setMode(k.TRIANGLES);else if(q.isLine){let Yt=K.linewidth;Yt===void 0&&(Yt=1),S.setLineWidth(Yt*We()),q.isLineSegments?xt.setMode(k.LINES):q.isLineLoop?xt.setMode(k.LINE_LOOP):xt.setMode(k.LINE_STRIP)}else q.isPoints?xt.setMode(k.POINTS):q.isSprite&&xt.setMode(k.TRIANGLES);if(q.isBatchedMesh)if(Qe.get("WEBGL_multi_draw"))xt.renderMultiDraw(q._multiDrawStarts,q._multiDrawCounts,q._multiDrawCount);else{const Yt=q._multiDrawStarts,Ie=q._multiDrawCounts,an=q._multiDrawCount,lt=Q?xe.get(Q).bytesPerElement:1,pn=$.get(K).currentProgram.getUniforms();for(let Nn=0;Nn<an;Nn++)pn.setValue(k,"_gl_DrawID",Nn),xt.render(Yt[Nn]/lt,Ie[Nn])}else if(q.isInstancedMesh)xt.renderInstances(Oe,wt,q.count);else if(J.isInstancedBufferGeometry){const Yt=J._maxInstanceCount!==void 0?J._maxInstanceCount:1/0,Ie=Math.min(J.instanceCount,Yt);xt.renderInstances(Oe,wt,Ie)}else xt.render(Oe,wt)};function Nr(A,H,J){A.transparent===!0&&A.side===Cn&&A.forceSinglePass===!1?(A.side=en,A.needsUpdate=!0,wi(A,H,J),A.side=li,A.needsUpdate=!0,wi(A,H,J),A.side=Cn):wi(A,H,J)}this.compile=function(A,H,J=null){J===null&&(J=A),w=Ee.get(J),w.init(H),_.push(w),J.traverseVisible(function(q){q.isLight&&q.layers.test(H.layers)&&(w.pushLight(q),q.castShadow&&w.pushShadow(q))}),A!==J&&A.traverseVisible(function(q){q.isLight&&q.layers.test(H.layers)&&(w.pushLight(q),q.castShadow&&w.pushShadow(q))}),w.setupLights();const K=new Set;return A.traverse(function(q){if(!(q.isMesh||q.isPoints||q.isLine||q.isSprite))return;const Ce=q.material;if(Ce)if(Array.isArray(Ce))for(let V=0;V<Ce.length;V++){const X=Ce[V];Nr(X,J,q),K.add(X)}else Nr(Ce,J,q),K.add(Ce)}),w=_.pop(),K},this.compileAsync=function(A,H,J=null){const K=this.compile(A,H,J);return new Promise(q=>{function Ce(){if(K.forEach(function(V){$.get(V).currentProgram.isReady()&&K.delete(V)}),K.size===0){q(A);return}setTimeout(Ce,10)}Qe.get("KHR_parallel_shader_compile")!==null?Ce():setTimeout(Ce,10)})};let Qi=null;function oo(A){Qi&&Qi(A)}function Vs(){$n.stop()}function Ws(){$n.start()}const $n=new Kd;$n.setAnimationLoop(oo),typeof self<"u"&&$n.setContext(self),this.setAnimationLoop=function(A){Qi=A,Ue.setAnimationLoop(A),A===null?$n.stop():$n.start()},Ue.addEventListener("sessionstart",Vs),Ue.addEventListener("sessionend",Ws),this.render=function(A,H){if(H!==void 0&&H.isCamera!==!0){at("WebGLRenderer.render: camera is not an instance of THREE.Camera.");return}if(L===!0)return;B!==null&&B.renderStart(A,H);const J=Ue.enabled===!0&&Ue.isPresenting===!0,K=b!==null&&(O===null||J)&&b.begin(P,O);if(A.matrixWorldAutoUpdate===!0&&A.updateMatrixWorld(),H.parent===null&&H.matrixWorldAutoUpdate===!0&&H.updateMatrixWorld(),Ue.enabled===!0&&Ue.isPresenting===!0&&(b===null||b.isCompositing()===!1)&&(Ue.cameraAutoUpdate===!0&&Ue.updateCamera(H),H=Ue.getCamera()),A.isScene===!0&&A.onBeforeRender(P,A,H,O),w=Ee.get(A,_.length),w.init(H),w.state.textureUnits=ee.getTextureUnits(),_.push(w),ce.multiplyMatrices(H.projectionMatrix,H.matrixWorldInverse),re.setFromProjectionMatrix(ce,Bn,H.reversedDepth),he=this.localClippingEnabled,le=Ge.init(this.clippingPlanes,he),T=Ae.get(A,R.length),T.init(),R.push(T),Ue.enabled===!0&&Ue.isPresenting===!0){const V=P.xr.getDepthSensingMesh();V!==null&&Dn(V,H,-1/0,P.sortObjects)}Dn(A,H,0,P.sortObjects),T.finish(),P.sortObjects===!0&&T.sort(De,ze,H.reversedDepth),Fe=Ue.enabled===!1||Ue.isPresenting===!1||Ue.hasDepthSensing()===!1,Fe&&Ze.addToRenderList(T,A),this.info.render.frame++,this.info.autoReset===!0&&this.info.reset(),le===!0&&Ge.beginShadows();const q=w.state.shadowsArray;if(Xe.render(q,A,H),le===!0&&Ge.endShadows(),(K&&b.hasRenderPass())===!1){const V=T.opaque,X=T.transmissive;if(w.setupLights(),H.isArrayCamera){const Q=H.cameras;if(X.length>0)for(let Se=0,Ye=Q.length;Se<Ye;Se++){const Ve=Q[Se];Ys(V,X,A,Ve)}Fe&&Ze.render(A);for(let Se=0,Ye=Q.length;Se<Ye;Se++){const Ve=Q[Se];Xs(T,A,Ve,Ve.viewport)}}else X.length>0&&Ys(V,X,A,H),Fe&&Ze.render(A),Xs(T,A,H)}O!==null&&U===0&&(ee.updateMultisampleRenderTarget(O),ee.updateRenderTargetMipmap(O)),K&&b.end(P),A.isScene===!0&&A.onAfterRender(P,A,H),we.resetDefaultState(),F=-1,G=null,_.pop(),_.length>0?(w=_[_.length-1],ee.setTextureUnits(w.state.textureUnits),le===!0&&Ge.setGlobalState(P.clippingPlanes,w.state.camera)):w=null,R.pop(),R.length>0?T=R[R.length-1]:T=null,B!==null&&B.renderEnd()};function Dn(A,H,J,K){if(A.visible===!1)return;if(A.layers.test(H.layers)){if(A.isGroup)J=A.renderOrder;else if(A.isLOD)A.autoUpdate===!0&&A.update(H);else if(A.isLightProbeGrid)w.pushLightProbeGrid(A);else if(A.isLight)w.pushLight(A),A.castShadow&&w.pushShadow(A);else if(A.isSprite){if(!A.frustumCulled||re.intersectsSprite(A)){K&&_e.setFromMatrixPosition(A.matrixWorld).applyMatrix4(ce);const V=ne.update(A),X=A.material;X.visible&&T.push(A,V,X,J,_e.z,null)}}else if((A.isMesh||A.isLine||A.isPoints)&&(!A.frustumCulled||re.intersectsObject(A))){const V=ne.update(A),X=A.material;if(K&&(A.boundingSphere!==void 0?(A.boundingSphere===null&&A.computeBoundingSphere(),_e.copy(A.boundingSphere.center)):(V.boundingSphere===null&&V.computeBoundingSphere(),_e.copy(V.boundingSphere.center)),_e.applyMatrix4(A.matrixWorld).applyMatrix4(ce)),Array.isArray(X)){const Q=V.groups;for(let Se=0,Ye=Q.length;Se<Ye;Se++){const Ve=Q[Se],Oe=X[Ve.materialIndex];Oe&&Oe.visible&&T.push(A,V,Oe,J,_e.z,Ve)}}else X.visible&&T.push(A,V,X,J,_e.z,null)}}const Ce=A.children;for(let V=0,X=Ce.length;V<X;V++)Dn(Ce[V],H,J,K)}function Xs(A,H,J,K){const{opaque:q,transmissive:Ce,transparent:V}=A;w.setupLightsView(J),le===!0&&Ge.setGlobalState(P.clippingPlanes,J),K&&S.viewport(Z.copy(K)),q.length>0&&Ai(q,H,J),Ce.length>0&&Ai(Ce,H,J),V.length>0&&Ai(V,H,J),S.buffers.depth.setTest(!0),S.buffers.depth.setMask(!0),S.buffers.color.setMask(!0),S.setPolygonOffset(!1)}function Ys(A,H,J,K){if((J.isScene===!0?J.overrideMaterial:null)!==null)return;if(w.state.transmissionRenderTarget[K.id]===void 0){const Oe=Qe.has("EXT_color_buffer_half_float")||Qe.has("EXT_color_buffer_float");w.state.transmissionRenderTarget[K.id]=new nn(1,1,{generateMipmaps:!0,type:Oe?dn:un,minFilter:ri,samples:Math.max(4,I.samples),stencilBuffer:r,resolveDepthBuffer:!1,resolveStencilBuffer:!1,colorSpace:st.workingColorSpace})}const Ce=w.state.transmissionRenderTarget[K.id],V=K.viewport||Z;Ce.setSize(V.z*P.transmissionResolutionScale,V.w*P.transmissionResolutionScale);const X=P.getRenderTarget(),Q=P.getActiveCubeFace(),Se=P.getActiveMipmapLevel();P.setRenderTarget(Ce),P.getClearColor(qe),Re=P.getClearAlpha(),Re<1&&P.setClearColor(16777215,.5),P.clear(),Fe&&Ze.render(J);const Ye=P.toneMapping;P.toneMapping=zn;const Ve=K.viewport;if(K.viewport!==void 0&&(K.viewport=void 0),w.setupLightsView(K),le===!0&&Ge.setGlobalState(P.clippingPlanes,K),Ai(A,J,K),ee.updateMultisampleRenderTarget(Ce),ee.updateRenderTargetMipmap(Ce),Qe.has("WEBGL_multisampled_render_to_texture")===!1){let Oe=!1;for(let ot=0,wt=H.length;ot<wt;ot++){const Et=H[ot],{object:xt,geometry:Yt,material:Ie,group:an}=Et;if(Ie.side===Cn&&xt.layers.test(K.layers)){const lt=Ie.side;Ie.side=en,Ie.needsUpdate=!0,qs(xt,J,K,Yt,Ie,an),Ie.side=lt,Ie.needsUpdate=!0,Oe=!0}}Oe===!0&&(ee.updateMultisampleRenderTarget(Ce),ee.updateRenderTargetMipmap(Ce))}P.setRenderTarget(X,Q,Se),P.setClearColor(qe,Re),Ve!==void 0&&(K.viewport=Ve),P.toneMapping=Ye}function Ai(A,H,J){const K=H.isScene===!0?H.overrideMaterial:null;for(let q=0,Ce=A.length;q<Ce;q++){const V=A[q],{object:X,geometry:Q,group:Se}=V;let Ye=V.material;Ye.allowOverride===!0&&K!==null&&(Ye=K),X.layers.test(J.layers)&&qs(X,H,J,Q,Ye,Se)}}function qs(A,H,J,K,q,Ce){A.onBeforeRender(P,H,J,K,q,Ce),A.modelViewMatrix.multiplyMatrices(J.matrixWorldInverse,A.matrixWorld),A.normalMatrix.getNormalMatrix(A.modelViewMatrix),q.onBeforeRender(P,H,J,K,A,Ce),q.transparent===!0&&q.side===Cn&&q.forceSinglePass===!1?(q.side=en,q.needsUpdate=!0,P.renderBufferDirect(J,H,K,q,A,Ce),q.side=li,q.needsUpdate=!0,P.renderBufferDirect(J,H,K,q,A,Ce),q.side=Cn):P.renderBufferDirect(J,H,K,q,A,Ce),A.onAfterRender(P,H,J,K,q,Ce)}function wi(A,H,J){H.isScene!==!0&&(H=ge);const K=$.get(A),q=w.state.lights,Ce=w.state.shadowsArray,V=q.state.version,X=ye.getParameters(A,q.state,Ce,H,J,w.state.lightProbeGridArray),Q=ye.getProgramCacheKey(X);let Se=K.programs;K.environment=A.isMeshStandardMaterial||A.isMeshLambertMaterial||A.isMeshPhongMaterial?H.environment:null,K.fog=H.fog;const Ye=A.isMeshStandardMaterial||A.isMeshLambertMaterial&&!A.envMap||A.isMeshPhongMaterial&&!A.envMap;K.envMap=ve.get(A.envMap||K.environment,Ye),K.envMapRotation=K.environment!==null&&A.envMap===null?H.environmentRotation:A.envMapRotation,Se===void 0&&(A.addEventListener("dispose",fn),Se=new Map,K.programs=Se);let Ve=Se.get(Q);if(Ve!==void 0){if(K.currentProgram===Ve&&K.lightsStateVersion===V)return $s(A,X),Ve}else X.uniforms=ye.getUniforms(A),B!==null&&A.isNodeMaterial&&B.build(A,J,X),A.onBeforeCompile(X,P),Ve=ye.acquireProgram(X,Q),Se.set(Q,Ve),K.uniforms=X.uniforms;const Oe=K.uniforms;return(!A.isShaderMaterial&&!A.isRawShaderMaterial||A.clipping===!0)&&(Oe.clippingPlanes=Ge.uniform),$s(A,X),K.needsLights=Fr(A),K.lightsStateVersion=V,K.needsLights&&(Oe.ambientLightColor.value=q.state.ambient,Oe.lightProbe.value=q.state.probe,Oe.directionalLights.value=q.state.directional,Oe.directionalLightShadows.value=q.state.directionalShadow,Oe.spotLights.value=q.state.spot,Oe.spotLightShadows.value=q.state.spotShadow,Oe.rectAreaLights.value=q.state.rectArea,Oe.ltc_1.value=q.state.rectAreaLTC1,Oe.ltc_2.value=q.state.rectAreaLTC2,Oe.pointLights.value=q.state.point,Oe.pointLightShadows.value=q.state.pointShadow,Oe.hemisphereLights.value=q.state.hemi,Oe.directionalShadowMatrix.value=q.state.directionalShadowMatrix,Oe.spotLightMatrix.value=q.state.spotLightMatrix,Oe.spotLightMap.value=q.state.spotLightMap,Oe.pointShadowMatrix.value=q.state.pointShadowMatrix),K.lightProbeGrid=w.state.lightProbeGridArray.length>0,K.currentProgram=Ve,K.uniformsList=null,Ve}function Ks(A){if(A.uniformsList===null){const H=A.currentProgram.getUniforms();A.uniformsList=Ca.seqWithValue(H.seq,A.uniforms)}return A.uniformsList}function $s(A,H){const J=$.get(A);J.outputColorSpace=H.outputColorSpace,J.batching=H.batching,J.batchingColor=H.batchingColor,J.instancing=H.instancing,J.instancingColor=H.instancingColor,J.instancingMorph=H.instancingMorph,J.skinning=H.skinning,J.morphTargets=H.morphTargets,J.morphNormals=H.morphNormals,J.morphColors=H.morphColors,J.morphTargetsCount=H.morphTargetsCount,J.numClippingPlanes=H.numClippingPlanes,J.numIntersection=H.numClipIntersection,J.vertexAlphas=H.vertexAlphas,J.vertexTangents=H.vertexTangents,J.toneMapping=H.toneMapping}function lo(A,H){if(A.length===0)return null;if(A.length===1)return A[0].texture!==null?A[0]:null;M.setFromMatrixPosition(H.matrixWorld);for(let J=0,K=A.length;J<K;J++){const q=A[J];if(q.texture!==null&&q.boundingBox.containsPoint(M))return q}return null}function Ur(A,H,J,K,q){H.isScene!==!0&&(H=ge),ee.resetTextureUnits();const Ce=H.fog,V=K.isMeshStandardMaterial||K.isMeshLambertMaterial||K.isMeshPhongMaterial?H.environment:null,X=O===null?P.outputColorSpace:O.isXRRenderTarget===!0?O.texture.colorSpace:st.workingColorSpace,Q=K.isMeshStandardMaterial||K.isMeshLambertMaterial&&!K.envMap||K.isMeshPhongMaterial&&!K.envMap,Se=ve.get(K.envMap||V,Q),Ye=K.vertexColors===!0&&!!J.attributes.color&&J.attributes.color.itemSize===4,Ve=!!J.attributes.tangent&&(!!K.normalMap||K.anisotropy>0),Oe=!!J.morphAttributes.position,ot=!!J.morphAttributes.normal,wt=!!J.morphAttributes.color;let Et=zn;K.toneMapped&&(O===null||O.isXRRenderTarget===!0)&&(Et=P.toneMapping);const xt=J.morphAttributes.position||J.morphAttributes.normal||J.morphAttributes.color,Yt=xt!==void 0?xt.length:0,Ie=$.get(K),an=w.state.lights;if(le===!0&&(he===!0||A!==G)){const yt=A===G&&K.id===F;Ge.setState(K,A,yt)}let lt=!1;K.version===Ie.__version?(Ie.needsLights&&Ie.lightsStateVersion!==an.state.version||Ie.outputColorSpace!==X||q.isBatchedMesh&&Ie.batching===!1||!q.isBatchedMesh&&Ie.batching===!0||q.isBatchedMesh&&Ie.batchingColor===!0&&q.colorTexture===null||q.isBatchedMesh&&Ie.batchingColor===!1&&q.colorTexture!==null||q.isInstancedMesh&&Ie.instancing===!1||!q.isInstancedMesh&&Ie.instancing===!0||q.isSkinnedMesh&&Ie.skinning===!1||!q.isSkinnedMesh&&Ie.skinning===!0||q.isInstancedMesh&&Ie.instancingColor===!0&&q.instanceColor===null||q.isInstancedMesh&&Ie.instancingColor===!1&&q.instanceColor!==null||q.isInstancedMesh&&Ie.instancingMorph===!0&&q.morphTexture===null||q.isInstancedMesh&&Ie.instancingMorph===!1&&q.morphTexture!==null||Ie.envMap!==Se||K.fog===!0&&Ie.fog!==Ce||Ie.numClippingPlanes!==void 0&&(Ie.numClippingPlanes!==Ge.numPlanes||Ie.numIntersection!==Ge.numIntersection)||Ie.vertexAlphas!==Ye||Ie.vertexTangents!==Ve||Ie.morphTargets!==Oe||Ie.morphNormals!==ot||Ie.morphColors!==wt||Ie.toneMapping!==Et||Ie.morphTargetsCount!==Yt||!!Ie.lightProbeGrid!=w.state.lightProbeGridArray.length>0)&&(lt=!0):(lt=!0,Ie.__version=K.version);let pn=Ie.currentProgram;lt===!0&&(pn=wi(K,H,q),B&&K.isNodeMaterial&&B.onUpdateProgram(K,pn,Ie));let Nn=!1,hi=!1,ji=!1;const St=pn.getUniforms(),Dt=Ie.uniforms;if(S.useProgram(pn.program)&&(Nn=!0,hi=!0,ji=!0),K.id!==F&&(F=K.id,hi=!0),Ie.needsLights){const yt=lo(w.state.lightProbeGridArray,q);Ie.lightProbeGrid!==yt&&(Ie.lightProbeGrid=yt,hi=!0)}if(Nn||G!==A){S.buffers.depth.getReversed()&&A.reversedDepth!==!0&&(A._reversedDepth=!0,A.updateProjectionMatrix()),St.setValue(k,"projectionMatrix",A.projectionMatrix),St.setValue(k,"viewMatrix",A.matrixWorldInverse);const di=St.map.cameraPosition;di!==void 0&&di.setValue(k,ue.setFromMatrixPosition(A.matrixWorld)),I.logarithmicDepthBuffer&&St.setValue(k,"logDepthBufFC",2/(Math.log(A.far+1)/Math.LN2)),(K.isMeshPhongMaterial||K.isMeshToonMaterial||K.isMeshLambertMaterial||K.isMeshBasicMaterial||K.isMeshStandardMaterial||K.isShaderMaterial)&&St.setValue(k,"isOrthographic",A.isOrthographicCamera===!0),G!==A&&(G=A,hi=!0,ji=!0)}if(Ie.needsLights&&(an.state.directionalShadowMap.length>0&&St.setValue(k,"directionalShadowMap",an.state.directionalShadowMap,ee),an.state.spotShadowMap.length>0&&St.setValue(k,"spotShadowMap",an.state.spotShadowMap,ee),an.state.pointShadowMap.length>0&&St.setValue(k,"pointShadowMap",an.state.pointShadowMap,ee)),q.isSkinnedMesh){St.setOptional(k,q,"bindMatrix"),St.setOptional(k,q,"bindMatrixInverse");const yt=q.skeleton;yt&&(yt.boneTexture===null&&yt.computeBoneTexture(),St.setValue(k,"boneTexture",yt.boneTexture,ee))}q.isBatchedMesh&&(St.setOptional(k,q,"batchingTexture"),St.setValue(k,"batchingTexture",q._matricesTexture,ee),St.setOptional(k,q,"batchingIdTexture"),St.setValue(k,"batchingIdTexture",q._indirectTexture,ee),St.setOptional(k,q,"batchingColorTexture"),q._colorsTexture!==null&&St.setValue(k,"batchingColorTexture",q._colorsTexture,ee));const ui=J.morphAttributes;if((ui.position!==void 0||ui.normal!==void 0||ui.color!==void 0)&&z.update(q,J,pn),(hi||Ie.receiveShadow!==q.receiveShadow)&&(Ie.receiveShadow=q.receiveShadow,St.setValue(k,"receiveShadow",q.receiveShadow)),(K.isMeshStandardMaterial||K.isMeshLambertMaterial||K.isMeshPhongMaterial)&&K.envMap===null&&H.environment!==null&&(Dt.envMapIntensity.value=H.environmentIntensity),Dt.dfgLUT!==void 0&&(Dt.dfgLUT.value=YS()),hi){if(St.setValue(k,"toneMappingExposure",P.toneMappingExposure),Ie.needsLights&&co(Dt,ji),Ce&&K.fog===!0&&Ne.refreshFogUniforms(Dt,Ce),Ne.refreshMaterialUniforms(Dt,K,de,pe,w.state.transmissionRenderTarget[A.id]),Ie.needsLights&&Ie.lightProbeGrid){const yt=Ie.lightProbeGrid;Dt.probesSH.value=yt.texture,Dt.probesMin.value.copy(yt.boundingBox.min),Dt.probesMax.value.copy(yt.boundingBox.max),Dt.probesResolution.value.copy(yt.resolution)}Ca.upload(k,Ks(Ie),Dt,ee)}if(K.isShaderMaterial&&K.uniformsNeedUpdate===!0&&(Ca.upload(k,Ks(Ie),Dt,ee),K.uniformsNeedUpdate=!1),K.isSpriteMaterial&&St.setValue(k,"center",q.center),St.setValue(k,"modelViewMatrix",q.modelViewMatrix),St.setValue(k,"normalMatrix",q.normalMatrix),St.setValue(k,"modelMatrix",q.matrixWorld),K.uniformsGroups!==void 0){const yt=K.uniformsGroups;for(let di=0,es=yt.length;di<es;di++){const oh=yt[di];oe.update(oh,pn),oe.bind(oh,pn)}}return pn}function co(A,H){A.ambientLightColor.needsUpdate=H,A.lightProbe.needsUpdate=H,A.directionalLights.needsUpdate=H,A.directionalLightShadows.needsUpdate=H,A.pointLights.needsUpdate=H,A.pointLightShadows.needsUpdate=H,A.spotLights.needsUpdate=H,A.spotLightShadows.needsUpdate=H,A.rectAreaLights.needsUpdate=H,A.hemisphereLights.needsUpdate=H}function Fr(A){return A.isMeshLambertMaterial||A.isMeshToonMaterial||A.isMeshPhongMaterial||A.isMeshStandardMaterial||A.isShadowMaterial||A.isShaderMaterial&&A.lights===!0}this.getActiveCubeFace=function(){return D},this.getActiveMipmapLevel=function(){return U},this.getRenderTarget=function(){return O},this.setRenderTargetTextures=function(A,H,J){const K=$.get(A);K.__autoAllocateDepthBuffer=A.resolveDepthBuffer===!1,K.__autoAllocateDepthBuffer===!1&&(K.__useRenderToTexture=!1),$.get(A.texture).__webglTexture=H,$.get(A.depthTexture).__webglTexture=K.__autoAllocateDepthBuffer?void 0:J,K.__hasExternalTextures=!0},this.setRenderTargetFramebuffer=function(A,H){const J=$.get(A);J.__webglFramebuffer=H,J.__useDefaultFramebuffer=H===void 0},this.setRenderTarget=function(A,H=0,J=0){O=A,D=H,U=J;let K=null,q=!1,Ce=!1;if(A){const X=$.get(A);if(X.__useDefaultFramebuffer!==void 0){S.bindFramebuffer(k.FRAMEBUFFER,X.__webglFramebuffer),Z.copy(A.viewport),ae.copy(A.scissor),Te=A.scissorTest,S.viewport(Z),S.scissor(ae),S.setScissorTest(Te),F=-1;return}else if(X.__webglFramebuffer===void 0)ee.setupRenderTarget(A);else if(X.__hasExternalTextures)ee.rebindTextures(A,$.get(A.texture).__webglTexture,$.get(A.depthTexture).__webglTexture);else if(A.depthBuffer){const Ye=A.depthTexture;if(X.__boundDepthTexture!==Ye){if(Ye!==null&&$.has(Ye)&&(A.width!==Ye.image.width||A.height!==Ye.image.height))throw new Error("THREE.WebGLRenderer: Attached DepthTexture is initialized to the incorrect size.");ee.setupDepthRenderbuffer(A)}}const Q=A.texture;(Q.isData3DTexture||Q.isDataArrayTexture||Q.isCompressedArrayTexture)&&(Ce=!0);const Se=$.get(A).__webglFramebuffer;A.isWebGLCubeRenderTarget?(Array.isArray(Se[H])?K=Se[H][J]:K=Se[H],q=!0):A.samples>0&&ee.useMultisampledRTT(A)===!1?K=$.get(A).__webglMultisampledFramebuffer:Array.isArray(Se)?K=Se[J]:K=Se,Z.copy(A.viewport),ae.copy(A.scissor),Te=A.scissorTest}else Z.copy(ke).multiplyScalar(de).floor(),ae.copy(et).multiplyScalar(de).floor(),Te=He;if(J!==0&&(K=Y),S.bindFramebuffer(k.FRAMEBUFFER,K)&&S.drawBuffers(A,K),S.viewport(Z),S.scissor(ae),S.setScissorTest(Te),q){const X=$.get(A.texture);k.framebufferTexture2D(k.FRAMEBUFFER,k.COLOR_ATTACHMENT0,k.TEXTURE_CUBE_MAP_POSITIVE_X+H,X.__webglTexture,J)}else if(Ce){const X=H;for(let Q=0;Q<A.textures.length;Q++){const Se=$.get(A.textures[Q]);k.framebufferTextureLayer(k.FRAMEBUFFER,k.COLOR_ATTACHMENT0+Q,Se.__webglTexture,J,X)}}else if(A!==null&&J!==0){const X=$.get(A.texture);k.framebufferTexture2D(k.FRAMEBUFFER,k.COLOR_ATTACHMENT0,k.TEXTURE_2D,X.__webglTexture,J)}F=-1},this.readRenderTargetPixels=function(A,H,J,K,q,Ce,V,X=0){if(!(A&&A.isWebGLRenderTarget)){at("WebGLRenderer.readRenderTargetPixels: renderTarget is not THREE.WebGLRenderTarget.");return}let Q=$.get(A).__webglFramebuffer;if(A.isWebGLCubeRenderTarget&&V!==void 0&&(Q=Q[V]),Q){S.bindFramebuffer(k.FRAMEBUFFER,Q);try{const Se=A.textures[X],Ye=Se.format,Ve=Se.type;if(A.textures.length>1&&k.readBuffer(k.COLOR_ATTACHMENT0+X),!I.textureFormatReadable(Ye)){at("WebGLRenderer.readRenderTargetPixels: renderTarget is not in RGBA or implementation defined format.");return}if(!I.textureTypeReadable(Ve)){at("WebGLRenderer.readRenderTargetPixels: renderTarget is not in UnsignedByteType or implementation defined type.");return}H>=0&&H<=A.width-K&&J>=0&&J<=A.height-q&&k.readPixels(H,J,K,q,be.convert(Ye),be.convert(Ve),Ce)}finally{const Se=O!==null?$.get(O).__webglFramebuffer:null;S.bindFramebuffer(k.FRAMEBUFFER,Se)}}},this.readRenderTargetPixelsAsync=async function(A,H,J,K,q,Ce,V,X=0){if(!(A&&A.isWebGLRenderTarget))throw new Error("THREE.WebGLRenderer.readRenderTargetPixels: renderTarget is not THREE.WebGLRenderTarget.");let Q=$.get(A).__webglFramebuffer;if(A.isWebGLCubeRenderTarget&&V!==void 0&&(Q=Q[V]),Q)if(H>=0&&H<=A.width-K&&J>=0&&J<=A.height-q){S.bindFramebuffer(k.FRAMEBUFFER,Q);const Se=A.textures[X],Ye=Se.format,Ve=Se.type;if(A.textures.length>1&&k.readBuffer(k.COLOR_ATTACHMENT0+X),!I.textureFormatReadable(Ye))throw new Error("THREE.WebGLRenderer.readRenderTargetPixelsAsync: renderTarget is not in RGBA or implementation defined format.");if(!I.textureTypeReadable(Ve))throw new Error("THREE.WebGLRenderer.readRenderTargetPixelsAsync: renderTarget is not in UnsignedByteType or implementation defined type.");const Oe=k.createBuffer();k.bindBuffer(k.PIXEL_PACK_BUFFER,Oe),k.bufferData(k.PIXEL_PACK_BUFFER,Ce.byteLength,k.STREAM_READ),k.readPixels(H,J,K,q,be.convert(Ye),be.convert(Ve),0);const ot=O!==null?$.get(O).__webglFramebuffer:null;S.bindFramebuffer(k.FRAMEBUFFER,ot);const wt=k.fenceSync(k.SYNC_GPU_COMMANDS_COMPLETE,0);return k.flush(),await pm(k,wt,4),k.bindBuffer(k.PIXEL_PACK_BUFFER,Oe),k.getBufferSubData(k.PIXEL_PACK_BUFFER,0,Ce),k.deleteBuffer(Oe),k.deleteSync(wt),Ce}else throw new Error("THREE.WebGLRenderer.readRenderTargetPixelsAsync: requested read bounds are out of range.")},this.copyFramebufferToTexture=function(A,H=null,J=0){const K=Math.pow(2,-J),q=Math.floor(A.image.width*K),Ce=Math.floor(A.image.height*K),V=H!==null?H.x:0,X=H!==null?H.y:0;ee.setTexture2D(A,0),k.copyTexSubImage2D(k.TEXTURE_2D,J,0,0,V,X,q,Ce),S.unbindTexture()},this.copyTextureToTexture=function(A,H,J=null,K=null,q=0,Ce=0){let V,X,Q,Se,Ye,Ve,Oe,ot,wt;const Et=A.isCompressedTexture?A.mipmaps[Ce]:A.image;if(J!==null)V=J.max.x-J.min.x,X=J.max.y-J.min.y,Q=J.isBox3?J.max.z-J.min.z:1,Se=J.min.x,Ye=J.min.y,Ve=J.isBox3?J.min.z:0;else{const Dt=Math.pow(2,-q);V=Math.floor(Et.width*Dt),X=Math.floor(Et.height*Dt),A.isDataArrayTexture?Q=Et.depth:A.isData3DTexture?Q=Math.floor(Et.depth*Dt):Q=1,Se=0,Ye=0,Ve=0}K!==null?(Oe=K.x,ot=K.y,wt=K.z):(Oe=0,ot=0,wt=0);const xt=be.convert(H.format),Yt=be.convert(H.type);let Ie;H.isData3DTexture?(ee.setTexture3D(H,0),Ie=k.TEXTURE_3D):H.isDataArrayTexture||H.isCompressedArrayTexture?(ee.setTexture2DArray(H,0),Ie=k.TEXTURE_2D_ARRAY):(ee.setTexture2D(H,0),Ie=k.TEXTURE_2D),S.activeTexture(k.TEXTURE0),S.pixelStorei(k.UNPACK_FLIP_Y_WEBGL,H.flipY),S.pixelStorei(k.UNPACK_PREMULTIPLY_ALPHA_WEBGL,H.premultiplyAlpha),S.pixelStorei(k.UNPACK_ALIGNMENT,H.unpackAlignment);const an=S.getParameter(k.UNPACK_ROW_LENGTH),lt=S.getParameter(k.UNPACK_IMAGE_HEIGHT),pn=S.getParameter(k.UNPACK_SKIP_PIXELS),Nn=S.getParameter(k.UNPACK_SKIP_ROWS),hi=S.getParameter(k.UNPACK_SKIP_IMAGES);S.pixelStorei(k.UNPACK_ROW_LENGTH,Et.width),S.pixelStorei(k.UNPACK_IMAGE_HEIGHT,Et.height),S.pixelStorei(k.UNPACK_SKIP_PIXELS,Se),S.pixelStorei(k.UNPACK_SKIP_ROWS,Ye),S.pixelStorei(k.UNPACK_SKIP_IMAGES,Ve);const ji=A.isDataArrayTexture||A.isData3DTexture,St=H.isDataArrayTexture||H.isData3DTexture;if(A.isDepthTexture){const Dt=$.get(A),ui=$.get(H),yt=$.get(Dt.__renderTarget),di=$.get(ui.__renderTarget);S.bindFramebuffer(k.READ_FRAMEBUFFER,yt.__webglFramebuffer),S.bindFramebuffer(k.DRAW_FRAMEBUFFER,di.__webglFramebuffer);for(let es=0;es<Q;es++)ji&&(k.framebufferTextureLayer(k.READ_FRAMEBUFFER,k.COLOR_ATTACHMENT0,$.get(A).__webglTexture,q,Ve+es),k.framebufferTextureLayer(k.DRAW_FRAMEBUFFER,k.COLOR_ATTACHMENT0,$.get(H).__webglTexture,Ce,wt+es)),k.blitFramebuffer(Se,Ye,V,X,Oe,ot,V,X,k.DEPTH_BUFFER_BIT,k.NEAREST);S.bindFramebuffer(k.READ_FRAMEBUFFER,null),S.bindFramebuffer(k.DRAW_FRAMEBUFFER,null)}else if(q!==0||A.isRenderTargetTexture||$.has(A)){const Dt=$.get(A),ui=$.get(H);S.bindFramebuffer(k.READ_FRAMEBUFFER,p),S.bindFramebuffer(k.DRAW_FRAMEBUFFER,C);for(let yt=0;yt<Q;yt++)ji?k.framebufferTextureLayer(k.READ_FRAMEBUFFER,k.COLOR_ATTACHMENT0,Dt.__webglTexture,q,Ve+yt):k.framebufferTexture2D(k.READ_FRAMEBUFFER,k.COLOR_ATTACHMENT0,k.TEXTURE_2D,Dt.__webglTexture,q),St?k.framebufferTextureLayer(k.DRAW_FRAMEBUFFER,k.COLOR_ATTACHMENT0,ui.__webglTexture,Ce,wt+yt):k.framebufferTexture2D(k.DRAW_FRAMEBUFFER,k.COLOR_ATTACHMENT0,k.TEXTURE_2D,ui.__webglTexture,Ce),q!==0?k.blitFramebuffer(Se,Ye,V,X,Oe,ot,V,X,k.COLOR_BUFFER_BIT,k.NEAREST):St?k.copyTexSubImage3D(Ie,Ce,Oe,ot,wt+yt,Se,Ye,V,X):k.copyTexSubImage2D(Ie,Ce,Oe,ot,Se,Ye,V,X);S.bindFramebuffer(k.READ_FRAMEBUFFER,null),S.bindFramebuffer(k.DRAW_FRAMEBUFFER,null)}else St?A.isDataTexture||A.isData3DTexture?k.texSubImage3D(Ie,Ce,Oe,ot,wt,V,X,Q,xt,Yt,Et.data):H.isCompressedArrayTexture?k.compressedTexSubImage3D(Ie,Ce,Oe,ot,wt,V,X,Q,xt,Et.data):k.texSubImage3D(Ie,Ce,Oe,ot,wt,V,X,Q,xt,Yt,Et):A.isDataTexture?k.texSubImage2D(k.TEXTURE_2D,Ce,Oe,ot,V,X,xt,Yt,Et.data):A.isCompressedTexture?k.compressedTexSubImage2D(k.TEXTURE_2D,Ce,Oe,ot,Et.width,Et.height,xt,Et.data):k.texSubImage2D(k.TEXTURE_2D,Ce,Oe,ot,V,X,xt,Yt,Et);S.pixelStorei(k.UNPACK_ROW_LENGTH,an),S.pixelStorei(k.UNPACK_IMAGE_HEIGHT,lt),S.pixelStorei(k.UNPACK_SKIP_PIXELS,pn),S.pixelStorei(k.UNPACK_SKIP_ROWS,Nn),S.pixelStorei(k.UNPACK_SKIP_IMAGES,hi),Ce===0&&H.generateMipmaps&&k.generateMipmap(Ie),S.unbindTexture()},this.initRenderTarget=function(A){$.get(A).__webglFramebuffer===void 0&&ee.setupRenderTarget(A)},this.initTexture=function(A){A.isCubeTexture?ee.setTextureCube(A,0):A.isData3DTexture?ee.setTexture3D(A,0):A.isDataArrayTexture||A.isCompressedArrayTexture?ee.setTexture2DArray(A,0):ee.setTexture2D(A,0),S.unbindTexture()},this.resetState=function(){D=0,U=0,O=null,S.reset(),we.reset()},typeof __THREE_DEVTOOLS__<"u"&&__THREE_DEVTOOLS__.dispatchEvent(new CustomEvent("observe",{detail:this}))}get coordinateSystem(){return Bn}get outputColorSpace(){return this._outputColorSpace}set outputColorSpace(e){this._outputColorSpace=e;const t=this.getContext();t.drawingBufferColorSpace=st._getDrawingBufferColorSpace(e),t.unpackColorSpace=st._getUnpackColorSpace()}}class zs{constructor(){this.isPass=!0,this.enabled=!0,this.needsSwap=!0,this.clear=!1,this.renderToScreen=!1}setSize(){}render(){console.error("THREE.Pass: .render() must be implemented in derived pass.")}dispose(){}}const KS=new eh(-1,1,1,-1,0,1);class $S extends It{constructor(){super(),this.setAttribute("position",new _t([-1,3,0,-1,-1,0,3,-1,0],3)),this.setAttribute("uv",new _t([0,2,0,0,2,0],2))}}const ZS=new $S;class th{constructor(e){this._mesh=new $e(ZS,e)}dispose(){this._mesh.geometry.dispose()}render(e){e.render(this._mesh,KS)}get material(){return this._mesh.material}set material(e){this._mesh.material=e}}const Ra={name:"CopyShader",uniforms:{tDiffuse:{value:null},opacity:{value:1}},vertexShader:`

		varying vec2 vUv;

		void main() {

			vUv = uv;
			gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );

		}`,fragmentShader:`

		uniform float opacity;

		uniform sampler2D tDiffuse;

		varying vec2 vUv;

		void main() {

			vec4 texel = texture2D( tDiffuse, vUv );
			gl_FragColor = opacity * texel;


		}`},JS={uniforms:{tDiffuse:{value:null},luminosityThreshold:{value:1},smoothWidth:{value:1},defaultColor:{value:new Le(0)},defaultOpacity:{value:0}},vertexShader:`

		varying vec2 vUv;

		void main() {

			vUv = uv;

			gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );

		}`,fragmentShader:`

		uniform sampler2D tDiffuse;
		uniform vec3 defaultColor;
		uniform float defaultOpacity;
		uniform float luminosityThreshold;
		uniform float smoothWidth;

		varying vec2 vUv;

		void main() {

			vec4 texel = texture2D( tDiffuse, vUv );

			float v = luminance( texel.xyz );

			vec4 outputColor = vec4( defaultColor.rgb, defaultOpacity );

			float alpha = smoothstep( luminosityThreshold, luminosityThreshold + smoothWidth, v );

			gl_FragColor = mix( outputColor, texel, alpha );

		}`};class Fs extends zs{constructor(e,t=1,n,s){super(),this.strength=t,this.radius=n,this.threshold=s,this.resolution=e!==void 0?new fe(e.x,e.y):new fe(256,256),this.clearColor=new Le(0,0,0),this.needsSwap=!1,this.renderTargetsHorizontal=[],this.renderTargetsVertical=[],this.nMips=5;let r=Math.round(this.resolution.x/2),a=Math.round(this.resolution.y/2);this.renderTargetBright=new nn(r,a,{type:dn}),this.renderTargetBright.texture.name="UnrealBloomPass.bright",this.renderTargetBright.texture.generateMipmaps=!1;for(let h=0;h<this.nMips;h++){const f=new nn(r,a,{type:dn});f.texture.name="UnrealBloomPass.h"+h,f.texture.generateMipmaps=!1,this.renderTargetsHorizontal.push(f);const d=new nn(r,a,{type:dn});d.texture.name="UnrealBloomPass.v"+h,d.texture.generateMipmaps=!1,this.renderTargetsVertical.push(d),r=Math.round(r/2),a=Math.round(a/2)}const o=JS;this.highPassUniforms=Ir.clone(o.uniforms),this.highPassUniforms.luminosityThreshold.value=s,this.highPassUniforms.smoothWidth.value=.01,this.materialHighPassFilter=new $t({uniforms:this.highPassUniforms,vertexShader:o.vertexShader,fragmentShader:o.fragmentShader}),this.separableBlurMaterials=[];const l=[6,10,14,18,22];r=Math.round(this.resolution.x/2),a=Math.round(this.resolution.y/2);for(let h=0;h<this.nMips;h++)this.separableBlurMaterials.push(this._getSeparableBlurMaterial(l[h])),this.separableBlurMaterials[h].uniforms.invSize.value=new fe(1/r,1/a),r=Math.round(r/2),a=Math.round(a/2);this.compositeMaterial=this._getCompositeMaterial(this.nMips),this.compositeMaterial.uniforms.blurTexture1.value=this.renderTargetsVertical[0].texture,this.compositeMaterial.uniforms.blurTexture2.value=this.renderTargetsVertical[1].texture,this.compositeMaterial.uniforms.blurTexture3.value=this.renderTargetsVertical[2].texture,this.compositeMaterial.uniforms.blurTexture4.value=this.renderTargetsVertical[3].texture,this.compositeMaterial.uniforms.blurTexture5.value=this.renderTargetsVertical[4].texture,this.compositeMaterial.uniforms.bloomStrength.value=t,this.compositeMaterial.uniforms.bloomRadius.value=.1;const c=[1,.8,.6,.4,.2];this.compositeMaterial.uniforms.bloomFactors.value=c,this.bloomTintColors=[new N(1,1,1),new N(1,1,1),new N(1,1,1),new N(1,1,1),new N(1,1,1)],this.compositeMaterial.uniforms.bloomTintColors.value=this.bloomTintColors,this.copyUniforms=Ir.clone(Ra.uniforms),this.blendMaterial=new $t({uniforms:this.copyUniforms,vertexShader:Ra.vertexShader,fragmentShader:Ra.fragmentShader,premultipliedAlpha:!0,blending:zi,depthTest:!1,depthWrite:!1,transparent:!0}),this._oldClearColor=new Le,this._oldClearAlpha=1,this._basic=new oi,this._fsQuad=new th(null)}dispose(){for(let e=0;e<this.renderTargetsHorizontal.length;e++)this.renderTargetsHorizontal[e].dispose();for(let e=0;e<this.renderTargetsVertical.length;e++)this.renderTargetsVertical[e].dispose();this.renderTargetBright.dispose();for(let e=0;e<this.separableBlurMaterials.length;e++)this.separableBlurMaterials[e].dispose();this.compositeMaterial.dispose(),this.blendMaterial.dispose(),this._basic.dispose(),this._fsQuad.dispose()}setSize(e,t){let n=Math.round(e/2),s=Math.round(t/2);this.renderTargetBright.setSize(n,s);for(let r=0;r<this.nMips;r++)this.renderTargetsHorizontal[r].setSize(n,s),this.renderTargetsVertical[r].setSize(n,s),this.separableBlurMaterials[r].uniforms.invSize.value=new fe(1/n,1/s),n=Math.round(n/2),s=Math.round(s/2)}render(e,t,n,s,r){e.getClearColor(this._oldClearColor),this._oldClearAlpha=e.getClearAlpha();const a=e.autoClear;e.autoClear=!1,e.setClearColor(this.clearColor,0),r&&e.state.buffers.stencil.setTest(!1),this.renderToScreen&&(this._fsQuad.material=this._basic,this._basic.map=n.texture,e.setRenderTarget(null),e.clear(),this._fsQuad.render(e)),this.highPassUniforms.tDiffuse.value=n.texture,this.highPassUniforms.luminosityThreshold.value=this.threshold,this._fsQuad.material=this.materialHighPassFilter,e.setRenderTarget(this.renderTargetBright),e.clear(),this._fsQuad.render(e);let o=this.renderTargetBright;for(let l=0;l<this.nMips;l++)this._fsQuad.material=this.separableBlurMaterials[l],this.separableBlurMaterials[l].uniforms.colorTexture.value=o.texture,this.separableBlurMaterials[l].uniforms.direction.value=Fs.BlurDirectionX,e.setRenderTarget(this.renderTargetsHorizontal[l]),e.clear(),this._fsQuad.render(e),this.separableBlurMaterials[l].uniforms.colorTexture.value=this.renderTargetsHorizontal[l].texture,this.separableBlurMaterials[l].uniforms.direction.value=Fs.BlurDirectionY,e.setRenderTarget(this.renderTargetsVertical[l]),e.clear(),this._fsQuad.render(e),o=this.renderTargetsVertical[l];this._fsQuad.material=this.compositeMaterial,this.compositeMaterial.uniforms.bloomStrength.value=this.strength,this.compositeMaterial.uniforms.bloomRadius.value=this.radius,this.compositeMaterial.uniforms.bloomTintColors.value=this.bloomTintColors,e.setRenderTarget(this.renderTargetsHorizontal[0]),e.clear(),this._fsQuad.render(e),this._fsQuad.material=this.blendMaterial,this.copyUniforms.tDiffuse.value=this.renderTargetsHorizontal[0].texture,r&&e.state.buffers.stencil.setTest(!0),this.renderToScreen?(e.setRenderTarget(null),this._fsQuad.render(e)):(e.setRenderTarget(n),this._fsQuad.render(e)),e.setClearColor(this._oldClearColor,this._oldClearAlpha),e.autoClear=a}_getSeparableBlurMaterial(e){const t=[],n=e/3;for(let s=0;s<e;s++)t.push(.39894*Math.exp(-.5*s*s/(n*n))/n);return new $t({defines:{KERNEL_RADIUS:e},uniforms:{colorTexture:{value:null},invSize:{value:new fe(.5,.5)},direction:{value:new fe(.5,.5)},gaussianCoefficients:{value:t}},vertexShader:`

				varying vec2 vUv;

				void main() {

					vUv = uv;
					gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );

				}`,fragmentShader:`

				#include <common>

				varying vec2 vUv;

				uniform sampler2D colorTexture;
				uniform vec2 invSize;
				uniform vec2 direction;
				uniform float gaussianCoefficients[KERNEL_RADIUS];

				void main() {

					float weightSum = gaussianCoefficients[0];
					vec3 diffuseSum = texture2D( colorTexture, vUv ).rgb * weightSum;

					for ( int i = 1; i < KERNEL_RADIUS; i ++ ) {

						float x = float( i );
						float w = gaussianCoefficients[i];
						vec2 uvOffset = direction * invSize * x;
						vec3 sample1 = texture2D( colorTexture, vUv + uvOffset ).rgb;
						vec3 sample2 = texture2D( colorTexture, vUv - uvOffset ).rgb;
						diffuseSum += ( sample1 + sample2 ) * w;

					}

					gl_FragColor = vec4( diffuseSum, 1.0 );

				}`})}_getCompositeMaterial(e){return new $t({defines:{NUM_MIPS:e},uniforms:{blurTexture1:{value:null},blurTexture2:{value:null},blurTexture3:{value:null},blurTexture4:{value:null},blurTexture5:{value:null},bloomStrength:{value:1},bloomFactors:{value:null},bloomTintColors:{value:null},bloomRadius:{value:0}},vertexShader:`

				varying vec2 vUv;

				void main() {

					vUv = uv;
					gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );

				}`,fragmentShader:`

				varying vec2 vUv;

				uniform sampler2D blurTexture1;
				uniform sampler2D blurTexture2;
				uniform sampler2D blurTexture3;
				uniform sampler2D blurTexture4;
				uniform sampler2D blurTexture5;
				uniform float bloomStrength;
				uniform float bloomRadius;
				uniform float bloomFactors[NUM_MIPS];
				uniform vec3 bloomTintColors[NUM_MIPS];

				float lerpBloomFactor( const in float factor ) {

					float mirrorFactor = 1.2 - factor;
					return mix( factor, mirrorFactor, bloomRadius );

				}

				void main() {

					// 3.0 for backwards compatibility with previous alpha-based intensity
					vec3 bloom = 3.0 * bloomStrength * (
						lerpBloomFactor( bloomFactors[ 0 ] ) * bloomTintColors[ 0 ] * texture2D( blurTexture1, vUv ).rgb +
						lerpBloomFactor( bloomFactors[ 1 ] ) * bloomTintColors[ 1 ] * texture2D( blurTexture2, vUv ).rgb +
						lerpBloomFactor( bloomFactors[ 2 ] ) * bloomTintColors[ 2 ] * texture2D( blurTexture3, vUv ).rgb +
						lerpBloomFactor( bloomFactors[ 3 ] ) * bloomTintColors[ 3 ] * texture2D( blurTexture4, vUv ).rgb +
						lerpBloomFactor( bloomFactors[ 4 ] ) * bloomTintColors[ 4 ] * texture2D( blurTexture5, vUv ).rgb
					);

					float bloomAlpha = max( bloom.r, max( bloom.g, bloom.b ) );
					gl_FragColor = vec4( bloom, bloomAlpha );

				}`})}}Fs.BlurDirectionX=new fe(1,0);Fs.BlurDirectionY=new fe(0,1);class nf extends zs{constructor(e,t="tDiffuse"){super(),this.textureID=t,this.uniforms=null,this.material=null,e instanceof $t?(this.uniforms=e.uniforms,this.material=e):e&&(this.uniforms=Ir.clone(e.uniforms),this.material=new $t({name:e.name!==void 0?e.name:"unspecified",defines:Object.assign({},e.defines),uniforms:this.uniforms,vertexShader:e.vertexShader,fragmentShader:e.fragmentShader})),this._fsQuad=new th(this.material)}render(e,t,n){this.uniforms[this.textureID]&&(this.uniforms[this.textureID].value=n.texture),this._fsQuad.material=this.material,this.renderToScreen?(e.setRenderTarget(null),this._fsQuad.render(e)):(e.setRenderTarget(t),this.clear&&e.clear(e.autoClearColor,e.autoClearDepth,e.autoClearStencil),this._fsQuad.render(e))}dispose(){this.material.dispose(),this._fsQuad.dispose()}}class Du extends zs{constructor(e,t){super(),this.scene=e,this.camera=t,this.clear=!0,this.needsSwap=!1,this.inverse=!1}render(e,t,n){const s=e.getContext(),r=e.state;r.buffers.color.setMask(!1),r.buffers.depth.setMask(!1),r.buffers.color.setLocked(!0),r.buffers.depth.setLocked(!0);let a,o;this.inverse?(a=0,o=1):(a=1,o=0),r.buffers.stencil.setTest(!0),r.buffers.stencil.setOp(s.REPLACE,s.REPLACE,s.REPLACE),r.buffers.stencil.setFunc(s.ALWAYS,a,4294967295),r.buffers.stencil.setClear(o),r.buffers.stencil.setLocked(!0),e.setRenderTarget(n),this.clear&&e.clear(),e.render(this.scene,this.camera),e.setRenderTarget(t),this.clear&&e.clear(),e.render(this.scene,this.camera),r.buffers.color.setLocked(!1),r.buffers.depth.setLocked(!1),r.buffers.color.setMask(!0),r.buffers.depth.setMask(!0),r.buffers.stencil.setLocked(!1),r.buffers.stencil.setFunc(s.EQUAL,1,4294967295),r.buffers.stencil.setOp(s.KEEP,s.KEEP,s.KEEP),r.buffers.stencil.setLocked(!0)}}class QS extends zs{constructor(){super(),this.needsSwap=!1}render(e){e.state.buffers.stencil.setLocked(!1),e.state.buffers.stencil.setTest(!1)}}class jS{constructor(e,t){if(this.renderer=e,this._pixelRatio=e.getPixelRatio(),t===void 0){const n=e.getSize(new fe);this._width=n.width,this._height=n.height,t=new nn(this._width*this._pixelRatio,this._height*this._pixelRatio,{type:dn}),t.texture.name="EffectComposer.rt1"}else this._width=t.width,this._height=t.height;this.renderTarget1=t,this.renderTarget2=t.clone(),this.renderTarget2.texture.name="EffectComposer.rt2",this.writeBuffer=this.renderTarget1,this.readBuffer=this.renderTarget2,this.renderToScreen=!0,this.passes=[],this.copyPass=new nf(Ra),this.copyPass.material.blending=Gn,this.timer=new Z0}swapBuffers(){const e=this.readBuffer;this.readBuffer=this.writeBuffer,this.writeBuffer=e}addPass(e){this.passes.push(e),e.setSize(this._width*this._pixelRatio,this._height*this._pixelRatio)}insertPass(e,t){this.passes.splice(t,0,e),e.setSize(this._width*this._pixelRatio,this._height*this._pixelRatio)}removePass(e){const t=this.passes.indexOf(e);t!==-1&&this.passes.splice(t,1)}isLastEnabledPass(e){for(let t=e+1;t<this.passes.length;t++)if(this.passes[t].enabled)return!1;return!0}render(e){this.timer.update(),e===void 0&&(e=this.timer.getDelta());const t=this.renderer.getRenderTarget();let n=!1;for(let s=0,r=this.passes.length;s<r;s++){const a=this.passes[s];if(a.enabled!==!1){if(a.renderToScreen=this.renderToScreen&&this.isLastEnabledPass(s),a.render(this.renderer,this.writeBuffer,this.readBuffer,e,n),a.needsSwap){if(n){const o=this.renderer.getContext(),l=this.renderer.state.buffers.stencil;l.setFunc(o.NOTEQUAL,1,4294967295),this.copyPass.render(this.renderer,this.writeBuffer,this.readBuffer,e),l.setFunc(o.EQUAL,1,4294967295)}this.swapBuffers()}Du!==void 0&&(a instanceof Du?n=!0:a instanceof QS&&(n=!1))}}this.renderer.setRenderTarget(t)}reset(e){if(e===void 0){const t=this.renderer.getSize(new fe);this._pixelRatio=this.renderer.getPixelRatio(),this._width=t.width,this._height=t.height,e=this.renderTarget1.clone(),e.setSize(this._width*this._pixelRatio,this._height*this._pixelRatio)}this.renderTarget1.dispose(),this.renderTarget2.dispose(),this.renderTarget1=e,this.renderTarget2=e.clone(),this.writeBuffer=this.renderTarget1,this.readBuffer=this.renderTarget2}setSize(e,t){this._width=e,this._height=t;const n=this._width*this._pixelRatio,s=this._height*this._pixelRatio;this.renderTarget1.setSize(n,s),this.renderTarget2.setSize(n,s);for(let r=0;r<this.passes.length;r++)this.passes[r].setSize(n,s)}setPixelRatio(e){this._pixelRatio=e,this.setSize(this._width,this._height)}dispose(){this.renderTarget1.dispose(),this.renderTarget2.dispose(),this.copyPass.dispose()}}const eM={name:"FXAAShader",uniforms:{tDiffuse:{value:null},resolution:{value:new fe(1/1024,1/512)}},vertexShader:`

		varying vec2 vUv;

		void main() {

			vUv = uv;
			gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );

		}`,fragmentShader:`

		uniform sampler2D tDiffuse;
		uniform vec2 resolution;
		varying vec2 vUv;

		#define EDGE_STEP_COUNT 6
		#define EDGE_GUESS 8.0
		#define EDGE_STEPS 1.0, 1.5, 2.0, 2.0, 2.0, 4.0
		const float edgeSteps[EDGE_STEP_COUNT] = float[EDGE_STEP_COUNT]( EDGE_STEPS );

		float _ContrastThreshold = 0.0312;
		float _RelativeThreshold = 0.063;
		float _SubpixelBlending = 1.0;

		vec4 Sample( sampler2D  tex2D, vec2 uv ) {

			return texture( tex2D, uv );

		}

		float SampleLuminance( sampler2D tex2D, vec2 uv ) {

			return dot( Sample( tex2D, uv ).rgb, vec3( 0.3, 0.59, 0.11 ) );

		}

		float SampleLuminance( sampler2D tex2D, vec2 texSize, vec2 uv, float uOffset, float vOffset ) {

			uv += texSize * vec2(uOffset, vOffset);
			return SampleLuminance(tex2D, uv);

		}

		struct LuminanceData {

			float m, n, e, s, w;
			float ne, nw, se, sw;
			float highest, lowest, contrast;

		};

		LuminanceData SampleLuminanceNeighborhood( sampler2D tex2D, vec2 texSize, vec2 uv ) {

			LuminanceData l;
			l.m = SampleLuminance( tex2D, uv );
			l.n = SampleLuminance( tex2D, texSize, uv,  0.0,  1.0 );
			l.e = SampleLuminance( tex2D, texSize, uv,  1.0,  0.0 );
			l.s = SampleLuminance( tex2D, texSize, uv,  0.0, -1.0 );
			l.w = SampleLuminance( tex2D, texSize, uv, -1.0,  0.0 );

			l.ne = SampleLuminance( tex2D, texSize, uv,  1.0,  1.0 );
			l.nw = SampleLuminance( tex2D, texSize, uv, -1.0,  1.0 );
			l.se = SampleLuminance( tex2D, texSize, uv,  1.0, -1.0 );
			l.sw = SampleLuminance( tex2D, texSize, uv, -1.0, -1.0 );

			l.highest = max( max( max( max( l.n, l.e ), l.s ), l.w ), l.m );
			l.lowest = min( min( min( min( l.n, l.e ), l.s ), l.w ), l.m );
			l.contrast = l.highest - l.lowest;
			return l;

		}

		bool ShouldSkipPixel( LuminanceData l ) {

			float threshold = max( _ContrastThreshold, _RelativeThreshold * l.highest );
			return l.contrast < threshold;

		}

		float DeterminePixelBlendFactor( LuminanceData l ) {

			float f = 2.0 * ( l.n + l.e + l.s + l.w );
			f += l.ne + l.nw + l.se + l.sw;
			f *= 1.0 / 12.0;
			f = abs( f - l.m );
			f = clamp( f / l.contrast, 0.0, 1.0 );

			float blendFactor = smoothstep( 0.0, 1.0, f );
			return blendFactor * blendFactor * _SubpixelBlending;

		}

		struct EdgeData {

			bool isHorizontal;
			float pixelStep;
			float oppositeLuminance, gradient;

		};

		EdgeData DetermineEdge( vec2 texSize, LuminanceData l ) {

			EdgeData e;
			float horizontal =
				abs( l.n + l.s - 2.0 * l.m ) * 2.0 +
				abs( l.ne + l.se - 2.0 * l.e ) +
				abs( l.nw + l.sw - 2.0 * l.w );
			float vertical =
				abs( l.e + l.w - 2.0 * l.m ) * 2.0 +
				abs( l.ne + l.nw - 2.0 * l.n ) +
				abs( l.se + l.sw - 2.0 * l.s );
			e.isHorizontal = horizontal >= vertical;

			float pLuminance = e.isHorizontal ? l.n : l.e;
			float nLuminance = e.isHorizontal ? l.s : l.w;
			float pGradient = abs( pLuminance - l.m );
			float nGradient = abs( nLuminance - l.m );

			e.pixelStep = e.isHorizontal ? texSize.y : texSize.x;

			if (pGradient < nGradient) {

				e.pixelStep = -e.pixelStep;
				e.oppositeLuminance = nLuminance;
				e.gradient = nGradient;

			} else {

				e.oppositeLuminance = pLuminance;
				e.gradient = pGradient;

			}

			return e;

		}

		float DetermineEdgeBlendFactor( sampler2D  tex2D, vec2 texSize, LuminanceData l, EdgeData e, vec2 uv ) {

			vec2 uvEdge = uv;
			vec2 edgeStep;
			if (e.isHorizontal) {

				uvEdge.y += e.pixelStep * 0.5;
				edgeStep = vec2( texSize.x, 0.0 );

			} else {

				uvEdge.x += e.pixelStep * 0.5;
				edgeStep = vec2( 0.0, texSize.y );

			}

			float edgeLuminance = ( l.m + e.oppositeLuminance ) * 0.5;
			float gradientThreshold = e.gradient * 0.25;

			vec2 puv = uvEdge + edgeStep * edgeSteps[0];
			float pLuminanceDelta = SampleLuminance( tex2D, puv ) - edgeLuminance;
			bool pAtEnd = abs( pLuminanceDelta ) >= gradientThreshold;

			for ( int i = 1; i < EDGE_STEP_COUNT && !pAtEnd; i++ ) {

				puv += edgeStep * edgeSteps[i];
				pLuminanceDelta = SampleLuminance( tex2D, puv ) - edgeLuminance;
				pAtEnd = abs( pLuminanceDelta ) >= gradientThreshold;

			}

			if ( !pAtEnd ) {

				puv += edgeStep * EDGE_GUESS;

			}

			vec2 nuv = uvEdge - edgeStep * edgeSteps[0];
			float nLuminanceDelta = SampleLuminance( tex2D, nuv ) - edgeLuminance;
			bool nAtEnd = abs( nLuminanceDelta ) >= gradientThreshold;

			for ( int i = 1; i < EDGE_STEP_COUNT && !nAtEnd; i++ ) {

				nuv -= edgeStep * edgeSteps[i];
				nLuminanceDelta = SampleLuminance( tex2D, nuv ) - edgeLuminance;
				nAtEnd = abs( nLuminanceDelta ) >= gradientThreshold;

			}

			if ( !nAtEnd ) {

				nuv -= edgeStep * EDGE_GUESS;

			}

			float pDistance, nDistance;
			if ( e.isHorizontal ) {

				pDistance = puv.x - uv.x;
				nDistance = uv.x - nuv.x;

			} else {

				pDistance = puv.y - uv.y;
				nDistance = uv.y - nuv.y;

			}

			float shortestDistance;
			bool deltaSign;
			if ( pDistance <= nDistance ) {

				shortestDistance = pDistance;
				deltaSign = pLuminanceDelta >= 0.0;

			} else {

				shortestDistance = nDistance;
				deltaSign = nLuminanceDelta >= 0.0;

			}

			if ( deltaSign == ( l.m - edgeLuminance >= 0.0 ) ) {

				return 0.0;

			}

			return 0.5 - shortestDistance / ( pDistance + nDistance );

		}

		vec4 ApplyFXAA( sampler2D  tex2D, vec2 texSize, vec2 uv ) {

			LuminanceData luminance = SampleLuminanceNeighborhood( tex2D, texSize, uv );
			if ( ShouldSkipPixel( luminance ) ) {

				return Sample( tex2D, uv );

			}

			float pixelBlend = DeterminePixelBlendFactor( luminance );
			EdgeData edge = DetermineEdge( texSize, luminance );
			float edgeBlend = DetermineEdgeBlendFactor( tex2D, texSize, luminance, edge, uv );
			float finalBlend = max( pixelBlend, edgeBlend );

			if (edge.isHorizontal) {

				uv.y += edge.pixelStep * finalBlend;

			} else {

				uv.x += edge.pixelStep * finalBlend;

			}

			return Sample( tex2D, uv );

		}

		void main() {

			gl_FragColor = ApplyFXAA( tDiffuse, resolution.xy, vUv );

		}`};class tM extends nf{constructor(){super(eM)}setSize(e,t){this.material.uniforms.resolution.value.set(1/e,1/t)}}class nM extends yd{constructor(){super(),this.name="RoomEnvironment",this.position.y=-3.5;const e=new qn;e.deleteAttribute("uv");const t=new sn({side:en}),n=new sn,s=new sc(16777215,900,28,2);s.position.set(.418,16.199,.3),this.add(s);const r=new $e(e,t);r.position.set(-.757,13.219,.717),r.scale.set(31.713,28.305,28.591),this.add(r);const a=new yn(e,n,6),o=new Lt;o.position.set(-10.906,2.009,1.846),o.rotation.set(0,-.195,0),o.scale.set(2.328,7.905,4.651),o.updateMatrix(),a.setMatrixAt(0,o.matrix),o.position.set(-5.607,-.754,-.758),o.rotation.set(0,.994,0),o.scale.set(1.97,1.534,3.955),o.updateMatrix(),a.setMatrixAt(1,o.matrix),o.position.set(6.167,.857,7.803),o.rotation.set(0,.561,0),o.scale.set(3.927,6.285,3.687),o.updateMatrix(),a.setMatrixAt(2,o.matrix),o.position.set(-2.017,.018,6.124),o.rotation.set(0,.333,0),o.scale.set(2.002,4.566,2.064),o.updateMatrix(),a.setMatrixAt(3,o.matrix),o.position.set(2.291,-.756,-2.621),o.rotation.set(0,-.286,0),o.scale.set(1.546,1.552,1.496),o.updateMatrix(),a.setMatrixAt(4,o.matrix),o.position.set(-2.193,-.369,-5.547),o.rotation.set(0,.516,0),o.scale.set(3.875,3.487,2.986),o.updateMatrix(),a.setMatrixAt(5,o.matrix),this.add(a);const l=new $e(e,ys(50));l.position.set(-16.116,14.37,8.208),l.scale.set(.1,2.428,2.739),this.add(l);const c=new $e(e,ys(50));c.position.set(-16.109,18.021,-8.207),c.scale.set(.1,2.425,2.751),this.add(c);const h=new $e(e,ys(17));h.position.set(14.904,12.198,-1.832),h.scale.set(.15,4.265,6.331),this.add(h);const f=new $e(e,ys(43));f.position.set(-.462,8.89,14.52),f.scale.set(4.38,5.441,.088),this.add(f);const d=new $e(e,ys(20));d.position.set(3.235,11.486,-12.541),d.scale.set(2.5,2,.1),this.add(d);const u=new $e(e,ys(100));u.position.set(0,20,0),u.scale.set(1,.1,1),this.add(u)}dispose(){const e=new Set;this.traverse(t=>{t.isMesh&&(e.add(t.geometry),e.add(t.material))});for(const t of e)t.dispose()}}function ys(i){return new B0({color:0,emissive:16777215,emissiveIntensity:i})}class iM extends zs{constructor(e,t,n=null,s=null,r=null){super(),this.scene=e,this.camera=t,this.overrideMaterial=n,this.clearColor=s,this.clearAlpha=r,this.clear=!0,this.clearDepth=!1,this.needsSwap=!1,this.isRenderPass=!0,this._oldClearColor=new Le}render(e,t,n){const s=e.autoClear;e.autoClear=!1;let r,a;this.overrideMaterial!==null&&(a=this.scene.overrideMaterial,this.scene.overrideMaterial=this.overrideMaterial),this.clearColor!==null&&(e.getClearColor(this._oldClearColor),e.setClearColor(this.clearColor,e.getClearAlpha())),this.clearAlpha!==null&&(r=e.getClearAlpha(),e.setClearAlpha(this.clearAlpha)),this.clearDepth==!0&&e.clearDepth(),e.setRenderTarget(this.renderToScreen?null:n),this.clear===!0&&e.clear(e.autoClearColor,e.autoClearDepth,e.autoClearStencil),e.render(this.scene,this.camera),this.clearColor!==null&&e.setClearColor(this._oldClearColor),this.clearAlpha!==null&&e.setClearAlpha(r),this.overrideMaterial!==null&&(this.scene.overrideMaterial=a),e.autoClear=s}}const ga={name:"OutputShader",uniforms:{tDiffuse:{value:null},toneMappingExposure:{value:1}},vertexShader:`
		precision highp float;

		uniform mat4 modelViewMatrix;
		uniform mat4 projectionMatrix;

		attribute vec3 position;
		attribute vec2 uv;

		varying vec2 vUv;

		void main() {

			vUv = uv;
			gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );

		}`,fragmentShader:`

		precision highp float;

		uniform sampler2D tDiffuse;

		#include <tonemapping_pars_fragment>
		#include <colorspace_pars_fragment>

		varying vec2 vUv;

		void main() {

			gl_FragColor = texture2D( tDiffuse, vUv );

			// tone mapping

			#ifdef LINEAR_TONE_MAPPING

				gl_FragColor.rgb = LinearToneMapping( gl_FragColor.rgb );

			#elif defined( REINHARD_TONE_MAPPING )

				gl_FragColor.rgb = ReinhardToneMapping( gl_FragColor.rgb );

			#elif defined( CINEON_TONE_MAPPING )

				gl_FragColor.rgb = CineonToneMapping( gl_FragColor.rgb );

			#elif defined( ACES_FILMIC_TONE_MAPPING )

				gl_FragColor.rgb = ACESFilmicToneMapping( gl_FragColor.rgb );

			#elif defined( AGX_TONE_MAPPING )

				gl_FragColor.rgb = AgXToneMapping( gl_FragColor.rgb );

			#elif defined( NEUTRAL_TONE_MAPPING )

				gl_FragColor.rgb = NeutralToneMapping( gl_FragColor.rgb );

			#elif defined( CUSTOM_TONE_MAPPING )

				gl_FragColor.rgb = CustomToneMapping( gl_FragColor.rgb );

			#endif

			// color space

			#ifdef SRGB_TRANSFER

				gl_FragColor = sRGBTransferOETF( gl_FragColor );

			#endif

		}`};class sM extends zs{constructor(){super(),this.isOutputPass=!0,this.uniforms=Ir.clone(ga.uniforms),this.material=new Hd({name:ga.name,uniforms:this.uniforms,vertexShader:ga.vertexShader,fragmentShader:ga.fragmentShader}),this._fsQuad=new th(this.material),this._outputColorSpace=null,this._toneMapping=null}render(e,t,n){this.uniforms.tDiffuse.value=n.texture,this.uniforms.toneMappingExposure.value=e.toneMappingExposure,(this._outputColorSpace!==e.outputColorSpace||this._toneMapping!==e.toneMapping)&&(this._outputColorSpace=e.outputColorSpace,this._toneMapping=e.toneMapping,this.material.defines={},st.getTransfer(this._outputColorSpace)===pt&&(this.material.defines.SRGB_TRANSFER=""),this._toneMapping===Cc?this.material.defines.LINEAR_TONE_MAPPING="":this._toneMapping===Rc?this.material.defines.REINHARD_TONE_MAPPING="":this._toneMapping===Pc?this.material.defines.CINEON_TONE_MAPPING="":this._toneMapping===Za?this.material.defines.ACES_FILMIC_TONE_MAPPING="":this._toneMapping===Lc?this.material.defines.AGX_TONE_MAPPING="":this._toneMapping===Dc?this.material.defines.NEUTRAL_TONE_MAPPING="":this._toneMapping===Ic&&(this.material.defines.CUSTOM_TONE_MAPPING=""),this.material.needsUpdate=!0),this.renderToScreen===!0?(e.setRenderTarget(null),this._fsQuad.render(e)):(e.setRenderTarget(t),this.clear&&e.clear(e.autoClearColor,e.autoClearDepth,e.autoClearStencil),this._fsQuad.render(e))}dispose(){this.material.dispose(),this._fsQuad.dispose()}}function rM(i){return mt.clamp((i-Tt)/(ht-Tt),0,1)}function ki(i){return-2.82+rM(i)*5.82}const no=540,Ha=48,nh=492,Va=142,ih=382,aM=916,Nu=1024,Wa=32,oM=32,sf=Wa*oM,Os=64,Ui=Wa*Os,Pa=2,Uu=1024,lM=180,cM=12,hM=8,Qo=3,uM=90,Fu=64,dM=64,jo=800,Ou=.68,fM=1.35,pM=2.4,mM=1.05,gM=4.8,ii=.34,io=Math.hypot(1,ii/2),lc=Math.hypot(.62,.62,.62),cc=Math.hypot(.86,.43,.05),hc=1.02,uc=1.08,rf=.018,dc=.006,vM=2.335,Bu=2.994,el=-3.382,ku=-3.12,Bs=8.9,Xa=3.2,_M=-2.74,Ya=8.22,sh=2.31,af=3.56,xM=(nh-Ha)/132,of=.018,Hs=new N(.1,9.9,17.24).normalize(),rh=new N().crossVectors(new N(0,1,0),Hs).normalize(),qi=new N().crossVectors(Hs,rh).normalize(),so=(Bs+Xa)/2,Ia=(Bs-Xa)/(2*qi.y),lf=new N(0,so,_M+qi.z*Ia),fc=new Vn().setFromUnitVectors(new N(0,0,1),Hs),cf=16238685,si=4450559,hf=11032055,Gu=16726951,SM=1678591,MM=10309119,zu=[new Le(2678783),new Le(12082431),new Le(16732084),new Le(16762447),new Le(7240703)],hn=yc*5.82/(ht-Tt),yM=Ka*5.82/(ht-Tt),pr=-.54-yM-.16,uf=pr+.04,va=ki(Ot+Ka)+uf,Hu=.08,bM=kn*Mf/66,EM=Math.max(io,lc*hc,cc*uc),As=ki(Ot)-bM*EM-.045,df=.18,TM=As-df/2,AM=.18,wM=3.11,ff=.06,CM=As-ff/2,RM=4.6,PM=4.35,IM=-6.34,LM=.46,DM=.085,NM=.08,UM=3.91,FM=.46,tl=64,OM=BM();function BM(){const i=[];for(let e=0;e<8;e+=1){const t=e%2===0?8:7,n=52,s=(t-1)*n,r=no/2-s/2;for(let a=0;a<t;a+=1)i.push({index:a,row:e,x:r+a*n,y:170+e*29})}return i}function Vu(){return{desiredUrl:"",loadedUrl:"",loadingUrl:"",retryAt:0,texture:null,token:0}}function kM(i,e){i.colorSpace=kt,i.wrapS=Pn,i.wrapT=Pn,i.magFilter=Ft,i.minFilter=ri,i.generateMipmaps=!0,i.anisotropy=Math.min(8,e.capabilities.getMaxAnisotropy()),i.needsUpdate=!0}function GM(){const i=document.createElement("canvas");i.width=64,i.height=64;const e=i.getContext("2d");if(e){const n=e.createRadialGradient(32,32,3,32,32,31);n.addColorStop(0,"rgba(255,255,255,1)"),n.addColorStop(.46,"rgba(255,255,255,.9)"),n.addColorStop(.78,"rgba(255,255,255,.34)"),n.addColorStop(1,"rgba(255,255,255,0)"),e.fillStyle=n,e.fillRect(0,0,64,64)}const t=new Qa(i);return t.colorSpace=kt,t.magFilter=Ft,t.minFilter=ri,t.needsUpdate=!0,t}function Zi(i){const e=new Qa(i);return e.colorSpace=kt,e.anisotropy=4,e.needsUpdate=!0,e}function zM(i){return String(i||"?").split(/\s+/).filter(Boolean).slice(0,2).map(e=>e[0]?.toUpperCase()).join("")||"?"}function pc(i){let e=2166136261;for(let t=0;t<i.length;t+=1)e^=i.charCodeAt(t),e=Math.imul(e,16777619);return e>>>0}function mc(i){for(;i.children.length;){const e=i.children[0];i.remove(e),gc(e)}}function gc(i){const e=new Set,t=new Set,n=new Set;i.traverse(s=>{const r=s;r.geometry&&e.add(r.geometry);const a=Array.isArray(r.material)?r.material:r.material?[r.material]:[];for(const o of a){t.add(o);for(const l of Object.values(o))l instanceof Wt&&n.add(l)}});for(const s of n)s.dispose();for(const s of t)s.dispose();for(const s of e)s.dispose();i.removeFromParent()}function qa(i,e,t,n,s=1,r=0,a=12,o=io,l=ii/2,c=1){const h=(e-no/2)/66,f=Math.max(0,r)*HM(a),d=Dr(a)*Math.max(0,Number(l)||0)*Math.max(0,Number(c)||0),u=n||(t<=ih?"plinko":t<=ht?"shelf":"falling");if(u==="plinko")return pf(i,e,t,a,o);if(u==="pusher")return i.set(h,Bu+d+dc+f,ki(t));if(u==="settling"){const x=mt.clamp(s,0,1),v=x*x,g=Wu(t,d);return i.set(h,mt.lerp(Bu+d+dc,g,v)+f,ki(t))}if(u==="shelf")return i.set(h,Wu(t,d)+f,ki(t));const m=mt.clamp((t-ht)/(aM-ht),0,1.25);return i.set(h,2.37-m*3.41+f,3+m*.34)}function Wu(i,e){return vM+e+dc}function HM(i){return ii*Math.max(.15,Number(i)/66||0)+.008}function pf(i,e,t,n=0,s=io){const r=(e-no/2)/66,a=mt.clamp((t-Va)/(ih-Va),-.35,1.1),o=Dr(n),l=o>0?Math.max(ku-el,o*s+rf):ku-el;return i.set(r,8.82-a*5.56,el+l)}function vc(i,e,t){const n=mt.clamp((t-Va)/(ih-Va),-.12,1.04),s=(e-no/2)/66,r=8.82-n*5.56,a=(r-so)/qi.y;return i.copy(lf).addScaledVector(rh,s*VM(r)).addScaledVector(qi,a)}function Xu(i,e,t){const n=Dr(e);return n<=0||i.addScaledVector(Hs,of+n*t+rf),i}function Dr(i){const e=Number(i);return Number.isFinite(e)&&e>0?Math.max(.15,e/66):0}function VM(i){const e=mt.clamp((Bs-i)/(Bs-Ya),0,1);return mt.lerp(sh/xM,1,e)}function _c(i,e=0,t=1){const n=Number(i),s=Number(e),r=Number(t);if(!Number.isFinite(n)||!Number.isFinite(s)||!Number.isFinite(r))throw new RangeError("Coin Pusher instance capacity must be finite.");const a=Math.max(0,Math.ceil(n)),o=Math.max(1,Math.ceil(s),Math.ceil(r));let l=1;for(;l<o;)l*=2;for(;l<a;)l*=2;return l}function Yu(i,e){return xc(Dr(i),e,1,1,ii/2)}function xc(i,e,t,n,s){const r=Number(e.x)||0,a=Number(e.y)||0,o=Number(e.z)||0,l=Number(e.w)||0,c=2*(r*a+o*l),h=1-2*(r*r+o*o),f=2*(a*o-r*l);return Math.max(0,Number(i)||0)*(Math.abs(c)*t+Math.abs(h)*n+Math.abs(f)*s)}function WM(i,e=0,t=0){const n=Number.isFinite(i)?Math.max(0,Number(i)):0,s=Number.isFinite(e)?Math.max(0,Number(e)):0,r=Number.isFinite(t)?Math.max(0,Number(t)):0,a=n+s*.28+r*4;return a>=1400?.7:a>=900?.8:a>=600?.88:a>=350?.95:1}function mf(i){const e=String(i.viewerId||"").trim().toLowerCase(),t=String(i.name||"Viewer").trim().toLowerCase(),n=String(i.avatarUrl||"").trim(),r=!e||/^(?:viewer|anonymous|unknown)$/.test(e)?`coin:${String(i.id||t||"viewer").trim().toLowerCase()}`:`viewer:${e}`,a=n?`avatar:${n}`:`fallback:${t}`;return JSON.stringify([r,a])}function XM(i){let e=2166136261;const t=n=>{e^=n|0,e=Math.imul(e,16777619)};for(let n=0;n<i.length;n+=1){const s=i[n];t(Math.round(s.index)),t(Math.round(s.row)),t(Math.round(s.x*1e3)),t(Math.round(s.y*1e3))}return`${i.length}:${e>>>0}`}function YM(i,e=!1){const t=i[0].index!==null,n=new Set(Object.keys(i[0].attributes)),s=new Set(Object.keys(i[0].morphAttributes)),r={},a={},o=i[0].morphTargetsRelative,l=new It;let c=0;for(let h=0;h<i.length;++h){const f=i[h];let d=0;if(t!==(f.index!==null))return console.error("THREE.BufferGeometryUtils: .mergeGeometries() failed with geometry at index "+h+". All geometries must have compatible attributes; make sure index attribute exists among all geometries, or in none of them."),null;for(const u in f.attributes){if(!n.has(u))return console.error("THREE.BufferGeometryUtils: .mergeGeometries() failed with geometry at index "+h+'. All geometries must have compatible attributes; make sure "'+u+'" attribute exists among all geometries, or in none of them.'),null;r[u]===void 0&&(r[u]=[]),r[u].push(f.attributes[u]),d++}if(d!==n.size)return console.error("THREE.BufferGeometryUtils: .mergeGeometries() failed with geometry at index "+h+". Make sure all geometries have the same number of attributes."),null;if(o!==f.morphTargetsRelative)return console.error("THREE.BufferGeometryUtils: .mergeGeometries() failed with geometry at index "+h+". .morphTargetsRelative must be consistent throughout all geometries."),null;for(const u in f.morphAttributes){if(!s.has(u))return console.error("THREE.BufferGeometryUtils: .mergeGeometries() failed with geometry at index "+h+".  .morphAttributes must be consistent throughout all geometries."),null;a[u]===void 0&&(a[u]=[]),a[u].push(f.morphAttributes[u])}if(e){let u;if(t)u=f.index.count;else if(f.attributes.position!==void 0)u=f.attributes.position.count;else return console.error("THREE.BufferGeometryUtils: .mergeGeometries() failed with geometry at index "+h+". The geometry must have either an index or a position attribute"),null;l.addGroup(c,u,h),c+=u}}if(t){let h=0;const f=[];for(let d=0;d<i.length;++d){const u=i[d].index;for(let m=0;m<u.count;++m)f.push(u.getX(m)+h);h+=i[d].attributes.position.count}l.setIndex(f)}for(const h in r){const f=qu(r[h]);if(!f)return console.error("THREE.BufferGeometryUtils: .mergeGeometries() failed while trying to merge the "+h+" attribute."),null;l.setAttribute(h,f)}for(const h in a){const f=a[h][0].length;if(f!==0){l.morphAttributes=l.morphAttributes||{},l.morphAttributes[h]=[];for(let d=0;d<f;++d){const u=[];for(let x=0;x<a[h].length;++x)u.push(a[h][x][d]);const m=qu(u);if(!m)return console.error("THREE.BufferGeometryUtils: .mergeGeometries() failed while trying to merge the "+h+" morphAttribute."),null;l.morphAttributes[h].push(m)}}}return l}function qu(i){let e,t,n,s=-1,r=0;for(let c=0;c<i.length;++c){const h=i[c];if(e===void 0&&(e=h.array.constructor),e!==h.array.constructor)return console.error("THREE.BufferGeometryUtils: .mergeAttributes() failed. BufferAttribute.array must be of consistent array types across matching attributes."),null;if(t===void 0&&(t=h.itemSize),t!==h.itemSize)return console.error("THREE.BufferGeometryUtils: .mergeAttributes() failed. BufferAttribute.itemSize must be consistent across matching attributes."),null;if(n===void 0&&(n=h.normalized),n!==h.normalized)return console.error("THREE.BufferGeometryUtils: .mergeAttributes() failed. BufferAttribute.normalized must be consistent across matching attributes."),null;if(s===-1&&(s=h.gpuType),s!==h.gpuType)return console.error("THREE.BufferGeometryUtils: .mergeAttributes() failed. BufferAttribute.gpuType must be consistent across matching attributes."),null;r+=h.count*t}const a=new e(r),o=new Gt(a,t,n);let l=0;for(let c=0;c<i.length;++c){const h=i[c];if(h.isInterleavedBufferAttribute){const f=l/t;for(let d=0,u=h.count;d<u;d++)for(let m=0;m<t;m++){const x=h.getComponent(d,m);o.setComponent(d+f,m,x)}}else a.set(h.array,l);l+=h.count*t}return s!==void 0&&(o.gpuType=s),o}const or=new N;function _n(i,e,t,n,s,r){const a=2*Math.PI*s/4,o=Math.max(r-2*s,0),l=Math.PI/4;or.copy(e),or[n]=0,or.normalize();const c=.5*a/(a+o),h=1-or.angleTo(i)/l;return Math.sign(or[t])===1?h*c:o/(a+o)+c+c*(1-h)}class Lr extends qn{constructor(e=1,t=1,n=1,s=2,r=.1){const a=s*2+1;if(r=Math.min(e/2,t/2,n/2,r),super(1,1,1,a,a,a),this.type="RoundedBoxGeometry",this.parameters={width:e,height:t,depth:n,segments:s,radius:r},a===1)return;const o=this.toNonIndexed();this.index=null,this.attributes.position=o.attributes.position,this.attributes.normal=o.attributes.normal,this.attributes.uv=o.attributes.uv;const l=new N,c=new N,h=new N(e,t,n).divideScalar(2).subScalar(r),f=this.attributes.position.array,d=this.attributes.normal.array,u=this.attributes.uv.array,m=f.length/6,x=new N,v=.5/a;for(let g=0,y=0;g<f.length;g+=3,y+=2)switch(l.fromArray(f,g),c.copy(l),c.x-=Math.sign(c.x)*v,c.y-=Math.sign(c.y)*v,c.z-=Math.sign(c.z)*v,c.normalize(),f[g+0]=h.x*Math.sign(l.x)+c.x*r,f[g+1]=h.y*Math.sign(l.y)+c.y*r,f[g+2]=h.z*Math.sign(l.z)+c.z*r,d[g+0]=c.x,d[g+1]=c.y,d[g+2]=c.z,Math.floor(g/m)){case 0:x.set(1,0,0),u[y+0]=_n(x,c,"z","y",r,n),u[y+1]=1-_n(x,c,"y","z",r,t);break;case 1:x.set(-1,0,0),u[y+0]=1-_n(x,c,"z","y",r,n),u[y+1]=1-_n(x,c,"y","z",r,t);break;case 2:x.set(0,1,0),u[y+0]=1-_n(x,c,"x","z",r,e),u[y+1]=_n(x,c,"z","x",r,n);break;case 3:x.set(0,-1,0),u[y+0]=1-_n(x,c,"x","z",r,e),u[y+1]=1-_n(x,c,"z","x",r,n);break;case 4:x.set(0,0,1),u[y+0]=1-_n(x,c,"x","y",r,e),u[y+1]=1-_n(x,c,"y","x",r,t);break;case 5:x.set(0,0,-1),u[y+0]=_n(x,c,"x","y",r,e),u[y+1]=1-_n(x,c,"y","x",r,t);break}}static fromJSON(e){return new Lr(e.width,e.height,e.depth,e.segments,e.radius)}}function qM(i){const e=document.createElement("canvas");e.width=1024,e.height=144;const t=e.getContext("2d");if(t){t.clearRect(0,0,e.width,e.height);const s=t.createLinearGradient(112,0,e.width-112,0);s.addColorStop(0,"rgba(67,232,255,0)"),s.addColorStop(.22,"#43e8ff"),s.addColorStop(.5,"#f7c85d"),s.addColorStop(.78,"#fb4b4f"),s.addColorStop(1,"rgba(251,75,79,0)"),t.fillStyle=s,t.fillRect(112,119,e.width-224,3);const r=t.createLinearGradient(0,28,0,112);r.addColorStop(0,"#fff3c9"),r.addColorStop(.48,"#f7c85d"),r.addColorStop(1,"#b9761e"),t.textAlign="center",t.textBaseline="middle",t.font="900 82px Inter, Arial Black, Arial, sans-serif",t.lineWidth=8,t.strokeStyle="rgba(2,6,15,.96)",t.strokeText(i,e.width/2,71),t.shadowColor="rgba(247,200,93,.5)",t.shadowBlur=6,t.fillStyle=r,t.fillText(i,e.width/2,71)}const n=new Qa(e);return n.colorSpace=kt,n.anisotropy=4,n.needsUpdate=!0,n}function KM(){const i=document.createElement("canvas");i.width=512,i.height=512;const e=i.getContext("2d");if(e){const n=e.createRadialGradient(174,132,18,256,256,360);n.addColorStop(0,"#a85cff"),n.addColorStop(.42,"#4b1a91"),n.addColorStop(1,"#10051f"),e.fillStyle=n,e.fillRect(0,0,i.width,i.height);const s=e.createLinearGradient(20,20,492,492);s.addColorStop(0,"#fff2af"),s.addColorStop(.28,"#f6bc47"),s.addColorStop(.56,"#fff4c8"),s.addColorStop(1,"#9b5b16"),e.lineJoin="round",e.lineWidth=28,e.strokeStyle=s,e.strokeRect(28,28,456,456),e.lineWidth=5,e.strokeStyle="rgba(255,255,255,.68)",e.strokeRect(51,51,410,410);for(let r=0;r<4;r+=1){const a=r%2?438:74,o=r>1?438:74;e.save(),e.translate(a,o),e.rotate(Math.PI/4),e.fillStyle=r%2?"#58e9ff":"#ffbd48",e.fillRect(-12,-12,24,24),e.restore()}e.textAlign="center",e.textBaseline="middle",e.font="900 330px Inter, Arial Black, Arial, sans-serif",e.lineJoin="round",e.lineWidth=36,e.strokeStyle="#160523",e.strokeText("?",256,273),e.shadowColor="#fff2a8",e.shadowBlur=24,e.fillStyle=s,e.fillText("?",256,273),e.shadowBlur=0,e.fillStyle="rgba(255,255,255,.72)",e.beginPath(),e.ellipse(204,129,38,16,-.55,0,Math.PI*2),e.fill()}const t=Zi(i);return t.anisotropy=8,t}function $M(){const i=document.createElement("canvas");i.width=1024,i.height=512;const e=i.getContext("2d");if(e){e.clearRect(0,0,i.width,i.height);const n=e.createLinearGradient(0,0,i.width,i.height);n.addColorStop(0,"#063f67"),n.addColorStop(.42,"#0ab6d7"),n.addColorStop(.58,"#7425bb"),n.addColorStop(1,"#26063c"),e.beginPath(),e.roundRect(18,18,i.width-36,i.height-36,62),e.fillStyle=n,e.fill();const s=e.createLinearGradient(30,0,i.width-30,0);s.addColorStop(0,"#66f4ff"),s.addColorStop(.48,"#fff5c6"),s.addColorStop(1,"#f1a3ff"),e.lineWidth=22,e.strokeStyle=s,e.stroke(),e.beginPath(),e.roundRect(49,49,i.width-98,i.height-98,42),e.setLineDash([18,13]),e.lineWidth=5,e.strokeStyle="rgba(255,255,255,.68)",e.stroke(),e.setLineDash([]);for(let r=0;r<2;r+=1){const a=r?878:146;e.save(),e.translate(a,255),e.rotate(Math.PI/4),e.fillStyle="#ffd66d",e.fillRect(-38,-38,76,76),e.fillStyle="#5a20a2",e.fillRect(-20,-20,40,40),e.restore()}e.textAlign="center",e.textBaseline="middle",e.font="900 94px Inter, Arial Black, Arial, sans-serif",e.lineJoin="round",e.lineWidth=18,e.strokeStyle="#07101f",e.strokeText("TICKET BONUS",i.width/2,205),e.fillStyle="#ffffff",e.shadowColor="#73eeff",e.shadowBlur=18,e.fillText("TICKET BONUS",i.width/2,205),e.shadowBlur=0,e.font="900 122px Inter, Arial Black, Arial, sans-serif",e.strokeText("+ POINTS",i.width/2,329),e.fillStyle="#ffe184",e.fillText("+ POINTS",i.width/2,329)}const t=Zi(i);return t.anisotropy=8,t}function ZM(){const i=document.createElement("canvas");i.width=1024,i.height=1024;const e=i.getContext("2d");if(e){const n=i.width,s=n/2,r=e.createLinearGradient(0,0,0,n);r.addColorStop(0,"#09091b"),r.addColorStop(.42,"#100b24"),r.addColorStop(.7,"#070817"),r.addColorStop(1,"#02040d"),e.fillStyle=r,e.fillRect(0,0,n,n);const a=e.createRadialGradient(105,420,10,105,420,390);a.addColorStop(0,"rgba(31,199,255,.22)"),a.addColorStop(.42,"rgba(23,101,180,.095)"),a.addColorStop(1,"rgba(0,0,0,0)"),e.fillStyle=a,e.fillRect(0,0,n,n);const o=e.createRadialGradient(919,400,10,919,400,390);o.addColorStop(0,"rgba(168,75,255,.22)"),o.addColorStop(.42,"rgba(91,34,167,.1)"),o.addColorStop(1,"rgba(0,0,0,0)"),e.fillStyle=o,e.fillRect(0,0,n,n);const l=e.createRadialGradient(s,80,0,s,80,430);l.addColorStop(0,"rgba(255,204,103,.13)"),l.addColorStop(.45,"rgba(118,71,175,.055)"),l.addColorStop(1,"rgba(0,0,0,0)"),e.fillStyle=l,e.fillRect(0,0,n,660);const c=e.createLinearGradient(70,0,n-70,0);c.addColorStop(0,"rgba(56,216,255,.72)"),c.addColorStop(.22,"rgba(224,174,78,.76)"),c.addColorStop(.5,"rgba(255,224,150,.86)"),c.addColorStop(.78,"rgba(224,174,78,.76)"),c.addColorStop(1,"rgba(173,79,255,.74)");for(let m=0;m<4;m+=1)e.beginPath(),e.ellipse(s,612+m*10,470-m*27,548-m*30,0,Math.PI,Math.PI*2),e.lineWidth=m===0?10:m===1?4:2,e.strokeStyle=m===0?"rgba(76,50,93,.88)":m===1?c:`rgba(230,190,102,${.32-m*.045})`,e.stroke();for(const m of[-1,1]){const x=s+m*395,v=e.createLinearGradient(x-82,0,x+82,0);v.addColorStop(0,"rgba(3,5,15,.96)"),v.addColorStop(.28,"rgba(31,27,56,.94)"),v.addColorStop(.5,"rgba(63,52,83,.78)"),v.addColorStop(.72,"rgba(25,22,49,.94)"),v.addColorStop(1,"rgba(2,4,13,.96)"),e.beginPath(),e.moveTo(x-88,116),e.lineTo(x+88,116),e.lineTo(x+104,178),e.lineTo(x+92,770),e.lineTo(x+64,824),e.lineTo(x-64,824),e.lineTo(x-92,770),e.lineTo(x-104,178),e.closePath(),e.fillStyle=v,e.fill(),e.lineWidth=8,e.strokeStyle="rgba(205,150,61,.55)",e.stroke();for(let g=-2;g<=2;g+=1){const y=x+g*25,E=e.createLinearGradient(y-4,0,y+4,0);E.addColorStop(0,"rgba(0,0,0,0)"),E.addColorStop(.5,m<0?"rgba(63,213,255,.27)":"rgba(179,85,255,.27)"),E.addColorStop(1,"rgba(0,0,0,0)"),e.fillStyle=E,e.fillRect(y-5,190,10,548)}for(const g of[166,258,445,632,748])e.beginPath(),e.roundRect(x-74,g,148,11,5),e.fillStyle="rgba(225,178,80,.35)",e.fill(),e.fillStyle=m<0?"rgba(57,210,255,.34)":"rgba(175,77,255,.34)",e.fillRect(x-54,g+3,108,3)}const h=e.createLinearGradient(0,620,0,n);h.addColorStop(0,"rgba(35,25,55,.08)"),h.addColorStop(.34,"rgba(15,13,31,.72)"),h.addColorStop(1,"rgba(2,4,12,.98)"),e.fillStyle=h,e.fillRect(0,620,n,n-620),e.save(),e.beginPath(),e.rect(0,620,n,n-620),e.clip();for(let m=-7;m<=7;m+=1)e.beginPath(),e.moveTo(s+m*18,620),e.lineTo(s+m*92,n),e.lineWidth=m%2===0?2:1,e.strokeStyle=m<0?"rgba(58,197,255,.16)":m>0?"rgba(167,77,255,.16)":"rgba(236,187,88,.24)",e.stroke();for(let m=0;m<9;m+=1){const x=m/8,v=635+Math.pow(x,1.72)*369;e.beginPath(),e.moveTo(0,v),e.lineTo(n,v),e.lineWidth=m%3===0?2:1,e.strokeStyle=`rgba(220,177,87,${.08+x*.08})`,e.stroke()}e.restore();let f=5182393;const d=()=>(f=Math.imul(f^f>>>15,1|f),f^=f+Math.imul(f^f>>>7,61|f),((f^f>>>14)>>>0)/4294967296);for(let m=0;m<76;m+=1){const x=m%2===0?-1:1,v=s+x*(300+d()*205),g=72+d()*795,y=.8+d()*2.3;e.beginPath(),e.arc(v,g,y,0,Math.PI*2),e.fillStyle=m%5===0?`rgba(255,212,122,${.26+d()*.42})`:x<0?`rgba(86,221,255,${.16+d()*.32})`:`rgba(193,112,255,${.16+d()*.32})`,e.fill()}for(const m of[-1,1])for(let x=0;x<5;x+=1){const v=s+m*(438+x%2*18),g=230+x*112,y=e.createRadialGradient(v,g,0,v,g,31);y.addColorStop(0,m<0?"rgba(176,244,255,.78)":"rgba(226,185,255,.78)"),y.addColorStop(.18,m<0?"rgba(46,203,255,.36)":"rgba(164,63,255,.36)"),y.addColorStop(1,"rgba(0,0,0,0)"),e.fillStyle=y,e.fillRect(v-34,g-34,68,68),e.save(),e.translate(v,g),e.rotate(Math.PI/4),e.fillStyle="rgba(244,198,95,.74)",e.fillRect(-6,-6,12,12),e.fillStyle=m<0?"#63dcff":"#b86cff",e.fillRect(-3,-3,6,6),e.restore()}const u=e.createRadialGradient(s,490,300,s,490,760);u.addColorStop(0,"rgba(0,0,0,0)"),u.addColorStop(.72,"rgba(0,0,0,.06)"),u.addColorStop(1,"rgba(0,0,0,.52)"),e.fillStyle=u,e.fillRect(0,0,n,n)}const t=Zi(i);return t.anisotropy=8,t}function JM(){const i=document.createElement("canvas"),e=1024;i.width=512,i.height=512;const t=i.getContext("2d");if(t){t.scale(i.width/e,i.height/e),t.clearRect(0,0,e,e);const n=t.createLinearGradient(0,0,e,e);n.addColorStop(0,"rgba(2,7,18,.22)"),n.addColorStop(.45,"rgba(20,5,46,.4)"),n.addColorStop(1,"rgba(2,12,29,.24)"),t.fillStyle=n,t.fillRect(0,0,e,e);const s=t.createRadialGradient(180,720,0,180,720,520);s.addColorStop(0,"rgba(21,183,255,.18)"),s.addColorStop(.45,"rgba(18,102,220,.075)"),s.addColorStop(1,"rgba(0,0,0,0)"),t.fillStyle=s,t.fillRect(0,0,e,e);const r=t.createRadialGradient(820,250,0,820,250,480);r.addColorStop(0,"rgba(183,69,255,.18)"),r.addColorStop(.5,"rgba(90,33,190,.07)"),r.addColorStop(1,"rgba(0,0,0,0)"),t.fillStyle=r,t.fillRect(0,0,e,e);let a=5904329;const o=()=>(a=Math.imul(a^a>>>15,1|a),a^=a+Math.imul(a^a>>>7,61|a),((a^a>>>14)>>>0)/4294967296);for(let c=0;c<230;c+=1){const h=28+o()*(e-56),f=28+o()*(e-56),d=.55+o()*1.65,u=.18+o()*.62;t.beginPath(),t.arc(h,f,d,0,Math.PI*2),t.fillStyle=c%7===0?`rgba(123,226,255,${u})`:c%9===0?`rgba(220,154,255,${u})`:`rgba(255,239,198,${u})`,t.fill()}t.lineWidth=1.5,t.strokeStyle="rgba(240,197,105,.11)";for(let c=0;c<7;c+=1){const h=90+o()*840,f=80+o()*850;t.beginPath(),t.moveTo(h,f);for(let d=1;d<5;d+=1)t.lineTo(Math.max(45,Math.min(979,h+(o()-.5)*370)),Math.max(45,Math.min(979,f+d*58+(o()-.5)*70)));t.stroke()}const l=t.createLinearGradient(0,0,e,e);l.addColorStop(0,"rgba(74,224,255,.38)"),l.addColorStop(.5,"rgba(255,198,90,.2)"),l.addColorStop(1,"rgba(176,65,255,.38)"),t.strokeStyle=l,t.lineWidth=9,t.strokeRect(10,10,e-20,e-20),t.lineWidth=2,t.strokeStyle="rgba(255,231,170,.32)",t.strokeRect(24,24,e-48,e-48)}return Zi(i)}function gf(i){const e=Math.max(0,Math.min(sf-1,Math.floor(i)));return{x:e%Wa*Os,y:Math.floor(e/Wa)*Os}}function QM(i){const{x:e,y:t}=gf(i),n=Os-Pa*2;return[(e+Pa)/Ui,(Ui-t-Os+Pa)/Ui,n/Ui,n/Ui]}function vf(i,e){if(!i)return null;const{x:t,y:n}=gf(e),s=Pa,r=Os,a=t+s,o=n+s,l=r-s*2;return i.save(),i.clearRect(t,n,r,r),i.fillStyle="#040914",i.fillRect(t,n,r,r),i.beginPath(),i.arc(a+l/2,o+l/2,l/2,0,Math.PI*2),i.clip(),{contentSize:l,contentX:a,contentY:o}}function _f(i,e){if(!i||!e)return;i.restore();const t=e.contentX+e.contentSize/2,n=e.contentY+e.contentSize/2;i.save(),i.strokeStyle="rgba(255,255,255,.9)",i.lineWidth=1.5,i.beginPath(),i.arc(t,n,e.contentSize*.43,0,Math.PI*2),i.stroke(),i.strokeStyle="rgba(251,191,36,.96)",i.lineWidth=2,i.beginPath(),i.arc(t,n,e.contentSize*.475,0,Math.PI*2),i.stroke(),i.restore()}function jM(i,e,t,n){const s=vf(i,e);if(!i||!s)return;const r=pc(t)%360,a=s.contentX+s.contentSize/2,o=s.contentY+s.contentSize/2,l=i.createRadialGradient(s.contentX+s.contentSize*.31,s.contentY+s.contentSize*.22,s.contentSize*.05,a,o,s.contentSize*.74);l.addColorStop(0,`hsl(${(r+42)%360} 95% 72%)`),l.addColorStop(.52,`hsl(${r} 78% 48%)`),l.addColorStop(1,"#07101f"),i.fillStyle=l,i.fillRect(s.contentX,s.contentY,s.contentSize,s.contentSize),i.fillStyle="#ffffff",i.shadowColor="#000000",i.shadowBlur=4,i.textAlign="center",i.textBaseline="middle",i.font=`900 ${Math.round(s.contentSize*.31)}px Inter, Arial, sans-serif`,i.fillText(zM(n),a,o+1),_f(i,s)}function ey(i,e,t){const n=vf(i,e);if(!i||!n)return;const s=Math.max(1,t.naturalWidth||t.width||1),r=Math.max(1,t.naturalHeight||t.height||1),a=Math.min(s,r),o=(s-a)/2,l=(r-a)/2;try{i.drawImage(t,o,l,a,a,n.contentX,n.contentY,n.contentSize,n.contentSize)}finally{_f(i,n)}}class ty{constructor(e){this.options=e,this.avatarAtlasEntries=new Map,this.activeAvatarAtlasLoads=0,this.avatarAtlasLoadQueue=[],this.avatarAtlasPages=new Map,this.avatarImageLoader=new Vd,this.nextAvatarAtlasPageId=0,this.disposed=!1,this.frameIndex=0,this.avatarImageLoader.setCrossOrigin("anonymous")}setFrame(e){this.frameIndex=e}createAvatarAtlasGeometry(e){const t=this.options.circleGeometry.clone(),n=new jl(new Float32Array(e*4),4);return n.setUsage(Bi),t.setAttribute("instanceUvRect",n),{geometry:t,instanceUv:n}}createAvatarAtlasMaterial(e){const t=new oi({map:e,side:li,toneMapped:!1,transparent:!1});return t.onBeforeCompile=n=>{n.vertexShader=n.vertexShader.replace("#include <common>",`#include <common>
attribute vec4 instanceUvRect;`).replace("#include <uv_vertex>",["#include <uv_vertex>","#ifdef USE_MAP","  vMapUv = instanceUvRect.xy + vMapUv * instanceUvRect.zw;","#endif"].join(`
`))},t.customProgramCacheKey=()=>"coin-pusher-avatar-atlas-v1",t}createAvatarFaceMesh(e,t,n){const s=new yn(e,t,n);return s.count=0,s.frustumCulled=!1,s.instanceMatrix.setUsage(Bi),s.renderOrder=5,s}createAvatarAtlasPage(){const e=this.nextAvatarAtlasPageId;this.nextAvatarAtlasPageId+=1;const t=document.createElement("canvas");t.width=Ui,t.height=Ui;const n=t.getContext("2d",{alpha:!1});n&&(n.imageSmoothingEnabled=!0,n.imageSmoothingQuality="high",n.fillStyle="#040914",n.fillRect(0,0,t.width,t.height));const s=new Qa(t);s.colorSpace=kt,s.generateMipmaps=!1,s.magFilter=Ft,s.minFilter=Ft,s.needsUpdate=!0;const r=this.createAvatarAtlasMaterial(s),a=Uu,{geometry:o,instanceUv:l}=this.createAvatarAtlasGeometry(a),c=this.createAvatarFaceMesh(o,r,a),h=this.createAvatarFaceMesh(o,r,a);this.options.root.add(c,h);const f={back:h,capacity:a,canvas:t,context:n,count:0,disposed:!1,entries:0,freeSlots:[],front:c,geometry:o,id:e,instanceUv:l,lastTextureUploadFrame:this.frameIndex,material:r,nextSlot:0,texture:s,textureDirty:!1};return this.avatarAtlasPages.set(e,f),f}ensureAvatarAtlasPageCapacity(e,t){if(t<=e.capacity)return;const n=_c(t,e.capacity,Uu),s=e.front,r=e.back,a=e.geometry,{geometry:o,instanceUv:l}=this.createAvatarAtlasGeometry(n);e.front=this.createAvatarFaceMesh(o,e.material,n),e.back=this.createAvatarFaceMesh(o,e.material,n),e.geometry=o,e.instanceUv=l,e.capacity=n,this.options.root.add(e.front,e.back),this.options.root.remove(s,r),s.dispose(),r.dispose(),a.dispose()}findAvatarAtlasPageWithSpace(){for(const e of this.avatarAtlasPages.values())if(!e.disposed&&(e.freeSlots.length>0||e.nextSlot<sf))return e;return this.createAvatarAtlasPage()}disposeAvatarAtlasPage(e){e.disposed||(e.disposed=!0,e.count=0,e.front.count=0,e.back.count=0,this.options.root.remove(e.front,e.back),e.front.dispose(),e.back.dispose(),e.geometry.dispose(),e.material.dispose(),e.texture.dispose(),this.avatarAtlasPages.get(e.id)===e&&this.avatarAtlasPages.delete(e.id))}markAvatarAtlasPageDirty(e){e.disposed||(e.textureDirty=!0)}drawAvatarAtlasFallback(e,t){jM(e.context,t.slot,t.key,t.name),this.markAvatarAtlasPageDirty(e)}drawAvatarAtlasImage(e,t,n){ey(e.context,t.slot,n),this.markAvatarAtlasPageDirty(e)}enqueueAvatarAtlasLoad(e){!e.avatarUrl||e.loadedToken===e.loadToken||e.pendingLoadToken===e.loadToken||e.loadAttempts>=Qo||(e.pendingLoadToken=e.loadToken,this.avatarAtlasLoadQueue.push({entry:e,token:e.loadToken,url:e.avatarUrl}),this.pumpAvatarAtlasLoads())}isCurrentAvatarAtlasLoad(e){return!this.disposed&&this.avatarAtlasEntries.get(e.entry.key)===e.entry&&e.entry.loadToken===e.token&&e.entry.avatarUrl===e.url}settleAvatarAtlasLoad(e,t){const n=e.entry;if(n.pendingLoadToken===e.token&&(n.pendingLoadToken=-1),!this.isCurrentAvatarAtlasLoad(e))return;if(t){n.loadedToken=e.token,n.retryAtFrame=0;return}if(n.loadAttempts>=Qo)return;const s=2**Math.max(0,n.loadAttempts-1);n.retryAtFrame=this.frameIndex+uM*s}pumpAvatarAtlasLoads(){if(this.disposed){this.avatarAtlasLoadQueue.splice(0);return}for(;this.activeAvatarAtlasLoads<hM&&this.avatarAtlasLoadQueue.length>0;){const e=this.avatarAtlasLoadQueue.shift();if(!e)break;if(this.avatarAtlasEntries.get(e.entry.key)!==e.entry||e.entry.loadToken!==e.token||e.entry.avatarUrl!==e.url){e.entry.pendingLoadToken===e.token&&(e.entry.pendingLoadToken=-1);continue}e.entry.loadAttempts+=1,this.activeAvatarAtlasLoads+=1;let t=!1;const n=s=>{t||(t=!0,this.settleAvatarAtlasLoad(e,s),this.activeAvatarAtlasLoads=Math.max(0,this.activeAvatarAtlasLoads-1),this.pumpAvatarAtlasLoads())};try{this.avatarImageLoader.load(e.url,s=>{const r=this.avatarAtlasPages.get(e.entry.pageId);let a=!1;if(this.isCurrentAvatarAtlasLoad(e)&&r&&!r.disposed)try{this.drawAvatarAtlasImage(r,e.entry,s),a=!0}catch{try{this.drawAvatarAtlasFallback(r,e.entry)}catch{}}n(a)},void 0,()=>{n(!1)})}catch{n(!1)}}}retryActiveAvatarAtlasLoads(){for(const e of this.avatarAtlasEntries.values())e.lastSeenFrame!==this.frameIndex||!e.avatarUrl||e.loadedToken===e.loadToken||e.pendingLoadToken===e.loadToken||e.loadAttempts>=Qo||this.frameIndex<e.retryAtFrame||this.enqueueAvatarAtlasLoad(e)}ensureAvatarAtlasEntry(e,t=mf(e)){const n=String(e.name||"Viewer"),s=String(e.avatarUrl||"").trim();let r=this.avatarAtlasEntries.get(t);if(!r){const a=this.findAvatarAtlasPageWithSpace(),o=a.freeSlots.pop(),l=o??a.nextSlot;o===void 0&&(a.nextSlot+=1),a.entries+=1,r={avatarUrl:s,key:t,lastSeenFrame:this.frameIndex,loadAttempts:0,loadToken:s?1:0,loadedToken:-1,name:n,pageId:a.id,pendingLoadToken:-1,retryAtFrame:0,slot:l,uv:QM(l)},this.avatarAtlasEntries.set(t,r),this.drawAvatarAtlasFallback(a,r),a.texture.needsUpdate=!0,a.textureDirty=!1,a.lastTextureUploadFrame=this.frameIndex,this.enqueueAvatarAtlasLoad(r)}return r.lastSeenFrame=this.frameIndex,r}releaseAvatarAtlasEntry(e,t){if(this.avatarAtlasEntries.get(e)!==t)return;this.avatarAtlasEntries.delete(e),t.loadToken+=1,t.pendingLoadToken=-1;const n=this.avatarAtlasPages.get(t.pageId);!n||n.disposed||(n.entries=Math.max(0,n.entries-1),n.freeSlots.push(t.slot),n.entries===0&&this.disposeAvatarAtlasPage(n))}sweepAvatarAtlasEntries(){for(const[e,t]of this.avatarAtlasEntries)this.frameIndex-t.lastSeenFrame>lM&&this.releaseAvatarAtlasEntry(e,t)}flushAvatarAtlasTextures(){for(const e of this.avatarAtlasPages.values())!e.textureDirty||e.disposed||!(this.frameIndex-e.lastTextureUploadFrame>=cM)||(e.texture.needsUpdate=!0,e.textureDirty=!1,e.lastTextureUploadFrame=this.frameIndex)}dispose(){if(!this.disposed){this.disposed=!0,this.avatarAtlasLoadQueue.splice(0),this.avatarAtlasEntries.clear();for(const e of this.avatarAtlasPages.values())this.disposeAvatarAtlasPage(e);this.avatarAtlasPages.clear()}}}class ny{constructor(e){this.options=e,this.bodyCapacity=Nu,this.dummy=new Lt,this.faceBackLocal=new ut,this.faceFrontLocal=new ut,this.faceMatrix=new ut,this.galacticCoinRimColorCache=new Map,this.mysteryCapacity=tl,this.ticketCapacity=tl,this.poseByCoinId=new Map,this.targetPosition=new N,this.targetQuaternion=new Vn,this.targetEuler=new Yn,this.regularCoins=[],this.mysteryItems=[],this.tickets=[],this.avatarKeys=[],this.avatarRepresentatives=new Map,this.avatarEntriesByKey=new Map,this.avatarEntries=[],this.pageRequirements=new Map,this.machineTheme="arcade",this.frameIndex=0,this.lastFrameTime=0,this.bodyGeometry=new Wi(1,1,ii,48,1,!1),this.bodyGeometry.rotateX(Math.PI/2),this.circleGeometry=new Kc(.84,48),this.bodyMaterial=new Mt({clearcoat:1,clearcoatRoughness:.08,color:16370530,emissive:6042112,emissiveIntensity:.08,envMapIntensity:.9,metalness:1,roughness:.34}),this.bodyMesh=this.createBodyMesh(this.bodyCapacity),this.options.root.add(this.bodyMesh);const t=new bn(.765,.034,8,32),n=new bn(.765,.034,8,32),s=ii/2+.018;t.translate(0,0,s),n.translate(0,0,-s);const r=YM([t,n],!1);if(t.dispose(),n.dispose(),!r)throw new Error("[coin-pusher] Failed to build the galactic coin rims.");this.galacticCoinRimGeometry=r,this.galacticCoinRimMaterial=new sn({color:16777215,emissive:2364223,emissiveIntensity:.24,metalness:.76,roughness:.24,vertexColors:!0}),this.galacticCoinRimMesh=this.createGalacticCoinRimMesh(this.bodyCapacity),this.options.root.add(this.galacticCoinRimMesh);const a=KM();this.mysteryGeometry=new Lr(1.24,1.24,1.24,4,.13),this.mysteryMaterial=new Mt({clearcoat:1,clearcoatRoughness:.08,color:16777215,emissive:3281005,emissiveIntensity:.26,envMapIntensity:1,map:a,metalness:.58,roughness:.22}),this.mysteryMesh=this.createSpecialItemMesh(this.mysteryGeometry,this.mysteryMaterial,this.mysteryCapacity);const o=$M();this.ticketGeometry=new Lr(1.72,.86,.1,4,.075),this.ticketMaterial=new Mt({clearcoat:.92,clearcoatRoughness:.14,color:16777215,emissive:473180,emissiveIntensity:.22,envMapIntensity:.76,map:o,metalness:.34,roughness:.24}),this.ticketMesh=this.createSpecialItemMesh(this.ticketGeometry,this.ticketMaterial,this.ticketCapacity),this.options.root.add(this.mysteryMesh,this.ticketMesh),this.faceFrontLocal.compose(new N(0,0,ii/2+.012),new Vn,new N(1,1,1)),this.faceBackLocal.compose(new N(0,0,-ii/2-.012),new Vn().setFromAxisAngle(new N(0,1,0),Math.PI),new N(1,1,1)),this.atlas=new ty({root:e.root,circleGeometry:this.circleGeometry})}sync(e,t,n,s){this.machineTheme=t,this.lastFrameTime=n,this.frameIndex=s,this.atlas.setFrame(s),this.syncCoins(e)}createBodyMesh(e){const t=new yn(this.bodyGeometry,this.bodyMaterial,e);return t.count=0,t.castShadow=!0,t.frustumCulled=!1,t.instanceMatrix.setUsage(Bi),t.renderOrder=4,t}createGalacticCoinRimMesh(e){const t=new yn(this.galacticCoinRimGeometry,this.galacticCoinRimMaterial,e);return t.count=0,t.frustumCulled=!1,t.instanceMatrix.setUsage(Bi),t.renderOrder=6,t}createSpecialItemMesh(e,t,n){const s=new yn(e,t,n);return s.count=0,s.castShadow=!0,s.receiveShadow=!0,s.frustumCulled=!1,s.instanceMatrix.setUsage(Bi),s.renderOrder=7,s}ensureSpecialItemCapacity(e,t){const n=e==="mystery"?this.mysteryCapacity:this.ticketCapacity;if(t<=n)return;const s=_c(t,n,tl),r=e==="mystery"?this.mysteryMesh:this.ticketMesh,a=this.createSpecialItemMesh(e==="mystery"?this.mysteryGeometry:this.ticketGeometry,e==="mystery"?this.mysteryMaterial:this.ticketMaterial,s);this.options.root.add(a),this.options.root.remove(r),r.dispose(),e==="mystery"?(this.mysteryCapacity=s,this.mysteryMesh=a):(this.ticketCapacity=s,this.ticketMesh=a)}ensureBodyCapacity(e){if(e<=this.bodyCapacity)return;const t=_c(e,this.bodyCapacity,Nu),n=this.bodyMesh,s=this.galacticCoinRimMesh,r=this.createBodyMesh(t),a=this.createGalacticCoinRimMesh(t);this.bodyMesh=r,this.galacticCoinRimMesh=a,this.bodyCapacity=t,this.options.root.add(r,a),this.options.root.remove(n,s),n.dispose(),s.dispose()}syncCoins(e){this.clearFrameBuffers();const{regularCoins:t,mysteryItems:n,tickets:s,avatarKeys:r,avatarRepresentatives:a,avatarEntriesByKey:o,avatarEntries:l,pageRequirements:c}=this;for(let u=0;u<e.length;u+=1){const m=e[u];m.kind==="mystery"?n.push(m):m.kind==="ticket"?s.push(m):t.push(m)}const h=e.length,f=t.length,d=this.machineTheme==="galactic-palace";this.ensureBodyCapacity(h);for(const u of this.atlas.avatarAtlasPages.values())u.count=0;r.length=f;for(let u=0;u<f;u+=1){const m=t[u],x=mf(m);r[u]=x,a.has(x)||a.set(x,m)}for(const[u,m]of a)o.set(u,this.atlas.ensureAvatarAtlasEntry(m,u));this.atlas.retryActiveAvatarAtlasLoads(),l.length=f;for(let u=0;u<f;u+=1){const m=o.get(r[u]);m&&(l[u]=m,c.set(m.pageId,(c.get(m.pageId)||0)+1))}for(const[u,m]of c){const x=this.atlas.avatarAtlasPages.get(u);x&&this.atlas.ensureAvatarAtlasPageCapacity(x,m)}for(let u=0;u<f;u+=1){const m=t[u],x=l[u];if(!x)continue;qa(this.targetPosition,m.x,m.y,m.phase,m.dropProgress,m.stackHeight,m.radius),m.phase==="plinko"&&this.machineTheme==="galactic-palace"&&(vc(this.targetPosition,m.x,m.y),Xu(this.targetPosition,m.radius,io));const v=m.phase==="pusher"||m.phase==="settling"||m.phase==="shelf";if(m.phase==="plinko")this.targetEuler.set(m.faceAngle,m.rotation*.22,m.rotation);else if(m.phase==="pusher"||m.phase==="shelf"){const R=Math.min(.065,Math.max(0,m.stackHeight)*.014);this.targetEuler.set(-Math.PI/2+Math.sin(m.faceAngle)*.035+Math.sin(m.rotation*1.7)*R,Math.sin(m.rotation)*.045+Math.cos(m.rotation*1.3)*R,m.rotation)}else if(m.phase==="settling"){const R=Math.sin(Math.PI*mt.clamp(m.dropProgress,0,1))*.18;this.targetEuler.set(-Math.PI/2+R,Math.sin(m.rotation)*.05,m.rotation)}else this.targetEuler.set(m.faceAngle,m.rotation*.62,m.rotation);this.targetQuaternion.setFromEuler(this.targetEuler),m.phase==="plinko"&&this.machineTheme==="galactic-palace"&&this.targetQuaternion.premultiply(fc);let g=0;if(v){const R=Dr(m.radius)*ii/2;g=Yu(m.radius,this.targetQuaternion),this.targetPosition.y+=Math.max(0,g-R)}const y=this.ensureCoinPose(m,this.targetPosition,this.targetQuaternion),E=m.phase==="plinko"?.72:m.phase==="pusher"?.68:m.phase==="shelf"?.62:.74;if(m.phase==="pusher"||m.phase==="settling"||m.phase==="shelf"?(y.position.x=mt.lerp(y.position.x,this.targetPosition.x,E),y.position.y=this.targetPosition.y,y.position.z=this.targetPosition.z):y.position.lerp(this.targetPosition,E),y.quaternion.slerp(this.targetQuaternion,E),v){const R=Yu(m.radius,y.quaternion);y.position.y+=Math.max(0,R-g)}y.lastSeenFrame=this.frameIndex,this.dummy.position.copy(y.position),this.dummy.quaternion.copy(y.quaternion);const M=Math.max(.15,m.radius/66);if(this.dummy.scale.setScalar(M),this.dummy.updateMatrix(),this.bodyMesh.setMatrixAt(u,this.dummy.matrix),d){this.galacticCoinRimMesh.setMatrixAt(u,this.dummy.matrix);const R=this.getGalacticCoinRimColor(m);this.galacticCoinRimMesh.setColorAt(u,R)}const T=this.atlas.avatarAtlasPages.get(x.pageId);if(!T)continue;const w=T.count;T.count+=1,this.faceMatrix.multiplyMatrices(this.dummy.matrix,this.faceFrontLocal),T.front.setMatrixAt(w,this.faceMatrix),this.faceMatrix.multiplyMatrices(this.dummy.matrix,this.faceBackLocal),T.back.setMatrixAt(w,this.faceMatrix),T.instanceUv.setXYZW(w,...x.uv)}this.bodyMesh.count=f,this.bodyMesh.instanceMatrix.needsUpdate=!0,this.galacticCoinRimMesh.count=d?f:0,this.galacticCoinRimMesh.visible=d,d&&(this.galacticCoinRimMesh.instanceMatrix.needsUpdate=!0,this.galacticCoinRimMesh.instanceColor&&(this.galacticCoinRimMesh.instanceColor.needsUpdate=!0));for(const u of this.atlas.avatarAtlasPages.values())u.front.count=u.count,u.back.count=u.count,!(u.count<=0)&&(u.front.instanceMatrix.needsUpdate=!0,u.back.instanceMatrix.needsUpdate=!0,u.instanceUv.needsUpdate=!0);this.syncSpecialItems(n,s),this.atlas.sweepAvatarAtlasEntries(),this.atlas.flushAvatarAtlasTextures();for(const[u,m]of this.poseByCoinId)this.frameIndex-m.lastSeenFrame>2&&this.poseByCoinId.delete(u)}syncSpecialItems(e,t){this.ensureSpecialItemCapacity("mystery",e.length),this.ensureSpecialItemCapacity("ticket",t.length),this.syncSpecialItemBatch(e,"mystery",this.mysteryMesh),this.syncSpecialItemBatch(t,"ticket",this.ticketMesh)}clearFrameBuffers(){this.regularCoins.length=0,this.mysteryItems.length=0,this.tickets.length=0,this.avatarKeys.length=0,this.avatarEntries.length=0,this.avatarRepresentatives.clear(),this.avatarEntriesByKey.clear(),this.pageRequirements.clear()}syncSpecialItemBatch(e,t,n){for(let s=0;s<e.length;s+=1){const r=e[s];qa(this.targetPosition,r.x,r.y,r.phase,r.dropProgress,r.stackHeight,r.radius,t==="mystery"?lc:cc,t==="mystery"?.62:.05,t==="mystery"?hc:uc),r.phase==="plinko"&&this.machineTheme==="galactic-palace"&&(vc(this.targetPosition,r.x,r.y),Xu(this.targetPosition,r.radius,t==="mystery"?lc:cc));const a=Math.max(.15,r.radius/66),o=r.phase==="pusher"||r.phase==="settling"||r.phase==="shelf";if(t==="mystery"){const x=this.lastFrameTime*(o?2.6:6.4)+pc(r.id)%360*Math.PI/180;o?this.targetEuler.set(Math.sin(r.faceAngle)*.07+Math.sin(x)*.035,r.rotation+Math.sin(x*.71)*.045,Math.cos(r.rotation*.73)*.06+Math.cos(x*.83)*.03):this.targetEuler.set(r.faceAngle+r.rotation*.42+Math.sin(x)*.24,r.rotation*.86+x*.34,r.rotation*1.14+Math.cos(x*.79)*.22)}else if(o){const x=Math.min(.09,Math.max(0,r.stackHeight)*.018);this.targetEuler.set(-Math.PI/2+Math.sin(r.faceAngle)*.045+x,Math.sin(r.rotation)*.055,r.rotation)}else this.targetEuler.set(r.faceAngle,r.rotation*.48,r.rotation);r.phase==="falling"&&r.lostSide&&(this.targetEuler.z+=r.lostSide*.32),this.targetQuaternion.setFromEuler(this.targetEuler),r.phase==="plinko"&&this.machineTheme==="galactic-palace"&&this.targetQuaternion.premultiply(fc);const l=a*(t==="mystery"?hc:uc),c=t==="mystery"?.62:.86,h=t==="mystery"?.62:.43,f=t==="mystery"?.62:.05;let d=0;if(o){const x=l*f;d=xc(l,this.targetQuaternion,c,h,f),this.targetPosition.y+=Math.max(0,d-x)}const u=this.ensureCoinPose(r,this.targetPosition,this.targetQuaternion);if(o?(u.position.x=mt.lerp(u.position.x,this.targetPosition.x,.7),u.position.y=this.targetPosition.y,u.position.z=this.targetPosition.z):u.position.lerp(this.targetPosition,.74),u.quaternion.slerp(this.targetQuaternion,.72),o){const x=xc(l,u.quaternion,c,h,f);u.position.y+=Math.max(0,x-d)}u.lastSeenFrame=this.frameIndex,this.dummy.position.copy(u.position),this.dummy.quaternion.copy(u.quaternion),this.dummy.scale.setScalar(l),this.dummy.updateMatrix(),n.setMatrixAt(s,this.dummy.matrix);const m=Math.abs(Number(r.specialValue)||0)>=25;n.setColorAt(s,this.options.colors.get(t==="mystery"?this.machineTheme==="galactic-palace"?"#d9b1ff":"#bcefff":m?"#fff0a8":this.machineTheme==="galactic-palace"?"#ffd2f5":"#bdf7ff"))}n.count=e.length,n.instanceMatrix.needsUpdate=!0,n.instanceColor&&(n.instanceColor.needsUpdate=!0),n.visible=e.length>0}ensureCoinPose(e,t,n){let s=this.poseByCoinId.get(e.id);return s||(s={lastSeenFrame:this.frameIndex,position:t.clone(),quaternion:n.clone()},this.poseByCoinId.set(e.id,s)),s}getGalacticCoinRimColor(e){const t=String(e.viewerId||e.name||e.id||"viewer").toLowerCase();let n=this.galacticCoinRimColorCache.get(t);if(!n){if(n=zu[pc(t)%zu.length],this.galacticCoinRimColorCache.size>=4096){const s=this.galacticCoinRimColorCache.keys().next().value;s&&this.galacticCoinRimColorCache.delete(s)}this.galacticCoinRimColorCache.set(t,n)}return n}dispose(){this.bodyMesh.dispose(),this.galacticCoinRimMesh.dispose(),this.atlas.dispose(),this.circleGeometry.dispose(),this.galacticCoinRimColorCache.clear(),this.poseByCoinId.clear(),this.clearFrameBuffers()}}class iy{constructor(){this.colorCache=new Map}get(e){const t=String(e||"#ffffff");let n=this.colorCache.get(t);return n||(n=new Le(t),this.colorCache.set(t,n)),n}clear(){this.colorCache.clear()}}function sy(i,e){const t=document.createElement("canvas");t.width=320,t.height=128;const n=t.getContext("2d");if(n){n.clearRect(0,0,t.width,t.height),n.beginPath(),n.roundRect(5,5,t.width-10,t.height-10,25),n.fillStyle="rgba(2,6,16,.95)",n.fill(),n.lineWidth=6,n.strokeStyle=e,n.stroke();const s=n.createLinearGradient(44,0,t.width-44,0);s.addColorStop(0,"rgba(255,255,255,0)"),s.addColorStop(.5,e),s.addColorStop(1,"rgba(255,255,255,0)"),n.fillStyle=s,n.fillRect(44,108,t.width-88,3),n.textAlign="center",n.textBaseline="middle";const r=ah(n,i,268,82,44);n.font=ro(r),n.lineJoin="round",n.lineWidth=Math.max(8,r*.14),n.strokeStyle="rgba(1,3,10,.98)",n.strokeText(i,t.width/2,62),n.shadowColor=e,n.shadowBlur=12,n.fillStyle="#ffffff",n.fillText(i,t.width/2,62)}return Zi(t)}function ry(i,e){const t=document.createElement("canvas");t.width=512,t.height=256;const n=t.getContext("2d");if(n){n.clearRect(0,0,t.width,t.height),n.beginPath(),n.roundRect(8,8,t.width-16,t.height-16,34);const s=n.createLinearGradient(0,8,0,t.height-8);s.addColorStop(0,"rgba(14,22,38,.99)"),s.addColorStop(.54,"rgba(3,8,18,.99)"),s.addColorStop(1,"rgba(1,3,10,.99)"),n.fillStyle=s,n.fill(),n.lineWidth=11,n.strokeStyle=e,n.stroke(),n.beginPath(),n.roundRect(21,21,t.width-42,t.height-42,24),n.lineWidth=2,n.strokeStyle="rgba(255,255,255,.28)",n.stroke();const r=n.createLinearGradient(70,0,t.width-70,0);r.addColorStop(0,"rgba(255,255,255,0)"),r.addColorStop(.22,e),r.addColorStop(.5,"#ffffff"),r.addColorStop(.78,e),r.addColorStop(1,"rgba(255,255,255,0)"),n.fillStyle=r,n.fillRect(70,222,t.width-140,7),n.textAlign="center",n.textBaseline="middle";const a=ah(n,i,430,176,76);n.font=ro(a),n.lineJoin="round",n.lineWidth=Math.max(15,a*.13),n.strokeStyle="rgba(0,2,8,1)",n.strokeText(i,t.width/2,126),n.shadowColor=e,n.shadowBlur=20,n.fillStyle="#ffffff",n.fillText(i,t.width/2,126)}return Zi(t)}function ay(i,e){const t=document.createElement("canvas");t.width=512,t.height=256;const n=t.getContext("2d");if(n){n.clearRect(0,0,t.width,t.height),n.beginPath(),n.moveTo(42,10),n.lineTo(t.width-42,10),n.lineTo(t.width-10,48),n.lineTo(t.width-10,t.height-42),n.lineTo(t.width-48,t.height-10),n.lineTo(48,t.height-10),n.lineTo(10,t.height-42),n.lineTo(10,48),n.closePath();const s=n.createLinearGradient(0,8,0,t.height-8);s.addColorStop(0,"rgba(23,20,43,.99)"),s.addColorStop(.42,"rgba(5,5,14,.995)"),s.addColorStop(1,"rgba(1,2,7,.995)"),n.fillStyle=s,n.fill(),n.lineWidth=12,n.strokeStyle=e,n.shadowColor=e,n.shadowBlur=18,n.stroke(),n.shadowBlur=0,n.beginPath(),n.moveTo(58,28),n.lineTo(t.width-58,28),n.lineTo(t.width-29,58),n.lineTo(t.width-29,t.height-54),n.lineTo(t.width-58,t.height-28),n.lineTo(58,t.height-28),n.lineTo(29,t.height-54),n.lineTo(29,58),n.closePath(),n.lineWidth=3,n.strokeStyle="rgba(255,222,150,.58)",n.stroke();const r=n.createLinearGradient(70,0,t.width-70,0);r.addColorStop(0,"rgba(255,255,255,0)"),r.addColorStop(.25,e),r.addColorStop(.5,"#fff4ce"),r.addColorStop(.75,e),r.addColorStop(1,"rgba(255,255,255,0)"),n.fillStyle=r,n.fillRect(70,39,t.width-140,5),n.fillRect(92,216,t.width-184,5),n.textAlign="center",n.textBaseline="middle";const a=ah(n,i,416,174,74);n.font=ro(a),n.lineJoin="round",n.lineWidth=Math.max(16,a*.135),n.strokeStyle="rgba(0,1,6,1)",n.strokeText(i,t.width/2,129),n.shadowColor=e,n.shadowBlur=24,n.fillStyle="#fff8e7",n.fillText(i,t.width/2,129)}return Zi(t)}function ah(i,e,t,n,s){let r=n;for(;r>s&&(i.font=ro(r),!(i.measureText(e).width<=t));)r-=4;return Math.max(s,r)}function ro(i){return`900 ${i}px Inter, Arial Black, Arial, sans-serif`}function oy(i,e){return i<0?new Le(14630754):i===0?new Le(e%2?5195493:4674921):i>=25?new Le(15185995):i>=10?new Le(9133302):new Le(2672600)}function ly(i,e){if(i<0)return new Le(15809651);if(i===0)return new Le(e%2?6511615:4740463);if(i>=25)return new Le(16170307);const t=[1493230,12733695,7560703,16731591,16170307];return new Le(t[e%t.length])}class cy{constructor(){this.floatingScoreGroup=new Bt,this.floatingScorePool=[],this.floatingScoreSprites=new Map,this.floatingScoreTextures=new Map,this.targetPosition=new N,this.frameIndex=0}sync(e,t){this.frameIndex=t,this.syncFloatingScores(e)}syncFloatingScores(e){const t=Math.max(0,e.length-Fu);for(let n=t;n<e.length;n+=1){const s=this.floatingScoreSprites.get(e[n].id);s&&(s.lastSeenFrame=this.frameIndex)}for(const[n,s]of this.floatingScoreSprites)s.lastSeenFrame!==this.frameIndex&&this.releaseFloatingScore(n,s);for(let n=t;n<e.length;n+=1){const s=e[n];let r=this.floatingScoreSprites.get(s.id);r||(r=this.acquireFloatingScore(s.id)),r.lastSeenFrame=this.frameIndex,this.bindFloatingScoreTexture(r,s.text,s.color),qa(this.targetPosition,s.x,s.y),r.sprite.position.set(this.targetPosition.x,this.targetPosition.y,this.targetPosition.z+.48),r.material.opacity=mt.clamp(s.life*1.25,0,1),r.sprite.scale.setScalar(.86+Math.min(.3,s.life*.18)),r.sprite.scale.x*=1.72,r.sprite.scale.y*=.64}this.evictFloatingScoreTextures()}acquireFloatingScore(e){let t=this.floatingScorePool.pop();if(!t){const n=new Xc({blending:Oi,depthTest:!1,depthWrite:!1,opacity:1,toneMapped:!1,transparent:!0}),s=new Ad(n);s.renderOrder=24,t={lastSeenFrame:this.frameIndex,material:n,sprite:s,textureKey:""}}return t.lastSeenFrame=this.frameIndex,t.material.opacity=1,this.floatingScoreGroup.add(t.sprite),this.floatingScoreSprites.set(e,t),t}releaseFloatingScore(e,t){this.floatingScoreGroup.remove(t.sprite),this.floatingScoreSprites.delete(e),this.releaseFloatingScoreTexture(t),t.material.opacity=0,this.floatingScorePool.length<Fu?this.floatingScorePool.push(t):t.material.dispose()}bindFloatingScoreTexture(e,t,n){const s=String(t||"0"),r=String(n||"#ffffff"),a=`${r}\0${s}`;if(e.textureKey===a){const l=this.floatingScoreTextures.get(a);l&&(l.lastUsedFrame=this.frameIndex);return}this.releaseFloatingScoreTexture(e);let o=this.floatingScoreTextures.get(a);o||(o={lastUsedFrame:this.frameIndex,references:0,texture:sy(s,r)},this.floatingScoreTextures.set(a,o)),o.lastUsedFrame=this.frameIndex,o.references+=1,e.textureKey=a,e.material.map=o.texture,e.material.needsUpdate=!0}releaseFloatingScoreTexture(e){if(!e.textureKey)return;const t=this.floatingScoreTextures.get(e.textureKey);t&&(t.references=Math.max(0,t.references-1)),e.textureKey="",e.material.map=null,e.material.needsUpdate=!0}evictFloatingScoreTextures(){for(;this.floatingScoreTextures.size>dM;){let e="",t=Number.POSITIVE_INFINITY;for(const[s,r]of this.floatingScoreTextures)r.references>0||r.lastUsedFrame>=t||(e=s,t=r.lastUsedFrame);if(!e)return;this.floatingScoreTextures.get(e)?.texture.dispose(),this.floatingScoreTextures.delete(e)}}dispose(){for(const[e,t]of this.floatingScoreSprites)this.releaseFloatingScore(e,t);for(const e of this.floatingScorePool)e.material.dispose();for(const e of this.floatingScoreTextures.values())e.texture.dispose();this.floatingScorePool.splice(0),this.floatingScoreTextures.clear()}}function Mn(i,e){return new sn({color:i,emissive:i,emissiveIntensity:e,metalness:.24,roughness:.2})}function hy(){const e=[],l=(u,m,x)=>{const v=Math.PI/8+x/8*Math.PI*2;return[Math.cos(v)*u,m,Math.sin(v)*u]},c=(u,m,x)=>{e.push(...u,...m,...x)},h=[0,.46,0],f=[0,-.58,0];for(let u=0;u<8;u+=1){const m=(u+1)%8,x=l(.22,.46,u),v=l(.22,.46,m),g=l(.54,.08,u),y=l(.54,.08,m),E=l(.54,-.045,u),M=l(.54,-.045,m);c(h,v,x),c(x,v,y),c(x,y,g),c(g,y,M),c(g,M,E),c(E,M,f)}const d=new It;return d.setAttribute("position",new _t(e,3)),d.computeVertexNormals(),d.computeBoundingSphere(),d}function Wn(i,e,t,n,s,r=!1){const a=new Fd,o=e[0]||[0,0];a.moveTo(o[0],o[1]);for(let h=1;h<e.length;h+=1)a.lineTo(e[h][0],e[h][1]);a.closePath();const l=new Qc(a,{bevelEnabled:!0,bevelSegments:2,bevelSize:Math.min(.035,t*.22),bevelThickness:Math.min(.025,t*.18),curveSegments:2,depth:t,steps:1});l.translate(0,0,-t/2);const c=new $e(l,n);return c.position.set(...s),c.castShadow=r,c.receiveShadow=r,i.add(c),c}function uy(i,e,t,n,s,r,a,o){const l=new Float32Array([e-t/2,s,r,e+t/2,s,r,e+n/2,s,a,e-n/2,s,a]),c=new It;c.setAttribute("position",new Gt(l,3)),c.setIndex([0,2,1,0,3,2]),c.computeVertexNormals();const h=new $e(c,o);return h.receiveShadow=!0,i.add(h),h}function Ku(){const i=new It,e=sh,t=af,n=[[-e,Bs],[-t,Ya],[-t,Xa],[t,Xa],[t,Ya],[e,Bs]],s=[],r=new N;for(const[a,o]of n){const l=(o-so)/qi.y;r.copy(lf).addScaledVector(rh,a).addScaledVector(qi,l),s.push(r.x,r.y,r.z)}return i.setAttribute("position",new _t(s,3)),i.setIndex([0,1,4,0,4,5,1,2,3,1,3,4]),xf(i,1),i.computeVertexNormals(),i}function xf(i,e){const t=sh,n=af,s=Ia*2,r=n*2/s,a=mt.clamp(Number.isFinite(e)?e:1,.12,8);let o=0,l=1,c=0,h=1;a>r?(o=(1-r/a)/2,l=1-o):(c=(1-a/r)/2,h=1-c);const f=(n-t)/(n*2),d=y=>mt.lerp(o,l,y),u=y=>mt.lerp(c,h,y),x=((Ya-so)/qi.y+Ia)/(Ia*2),v=i.getAttribute("uv"),g=[d(f),h,o,u(x),o,c,l,c,l,u(x),d(1-f),h];if(v instanceof Gt&&v.count===6){for(let y=0;y<6;y+=1)v.setXY(y,g[y*2],g[y*2+1]);v.needsUpdate=!0;return}i.setAttribute("uv",new _t(g,2))}function dy(i){const e=i.image,t=Number(e?.naturalWidth||e?.videoWidth||e?.width||0),n=Number(e?.naturalHeight||e?.videoHeight||e?.height||0);return t>0&&n>0?t/n:1}function jt(i,e,t,n,s,r,a=.025){const o=new N(...e),l=new N(...t),c=l.clone().sub(o),h=Math.max(.001,c.length()),f=o.add(l).multiplyScalar(.5),d=se(i,[h,n,s],[f.x,f.y,f.z],r,a);return d.quaternion.setFromUnitVectors(new N(1,0,0),c.normalize()),d}function xi(i,e,t,n){const s=new $e(new qn(...e),n);return s.position.set(...t),i.add(s),s}function se(i,e,t,n,s=.08,r=!1){const a=Math.max(.006,Math.min(s,...e.map(c=>c*.22))),o=new Lr(e[0],e[1],e[2],4,a),l=new $e(o,n);return l.position.set(...t),l.castShadow=r,l.receiveShadow=r,i.add(l),l}class fy{constructor(e){this.goldMaterial=e,this.scoreGroup=new Bt,this.scoreImpulses=[],this.scoreMaterials=[],this.scoreMultiplier=1,this.scoreSlotValues=[],this.machineTheme="arcade"}sync(e,t,n){this.machineTheme=n,this.scoreMultiplier=Number.isFinite(Number(t))?mt.clamp(Number(t),0,100):1,this.ensureScoreSlots(e)}invalidate(){this.scoreSlotValues=[]}update(e){this.updateScoreFlashes(e)}burst(e,t){this.scoreBurst(e,t)}scoreBurst(e,t){const n=mt.clamp((e-Ha)/(nh-Ha),0,.9999),s=Math.min(Math.max(0,this.scoreMaterials.length-1),Math.floor(n*Math.max(1,this.scoreMaterials.length)));this.scoreMaterials[s]&&(this.scoreImpulses[s]=Math.max(this.scoreImpulses[s]||0,t>=20?1.35:1))}ensureScoreSlots(e){const t=e.length||1,n=this.scoreMultiplier;let s=this.scoreSlotValues.length!==t;if(!s)for(let d=0;d<t;d+=1){const u=Math.round((Number(e.length?e[d]:0)||0)*n);if(this.scoreSlotValues[d]!==u){s=!0;break}}if(!s)return;const r=new Array(t);for(let d=0;d<t;d+=1)r[d]=Math.round((Number(e.length?e[d]:0)||0)*n);this.scoreSlotValues=r,mc(this.scoreGroup),this.scoreMaterials.splice(0),this.scoreImpulses.length=t,this.scoreImpulses.fill(0);const a=this.machineTheme==="galactic-palace",o=6.78/r.length,l=-3.39+o/2,c=new Mt({clearcoat:.62,clearcoatRoughness:.26,color:a?591895:1581620,emissive:a?590619:66570,emissiveIntensity:a?.17:.06,metalness:.92,roughness:a?.24:.32}),h=new Mt({clearcoat:.72,clearcoatRoughness:.22,color:a?197643:527638,emissive:a?459285:66314,emissiveIntensity:a?.18:.08,metalness:a?.92:.78,roughness:a?.22:.3}),f=this.goldMaterial.clone();a&&(f.color.setHex(14988634),f.emissive.setHex(2691840),f.emissiveIntensity=.025,f.roughness=.2),r.forEach((d,u)=>{const m=Math.round(Number(d)||0),x=a?ly(m,u):oy(m,u),v=x.clone().lerp(new Le(a?197643:593432),a?.86:.78),g=new Mt({clearcoat:a?.82:.5,clearcoatRoughness:a?.2:.34,color:v,emissive:x,emissiveIntensity:a?.13:.08,envMapIntensity:a?.88:.5,metalness:a?.86:.72,roughness:a?.26:.42}),y=new sn({color:x,emissive:x,emissiveIntensity:m>=20?.42:.32,metalness:a?.62:.46,roughness:a?.2:.3});if(y.userData.baseEmissiveIntensity=y.emissiveIntensity,this.scoreMaterials.push(y),a){const _=l+u*o,b=Math.max(.08,o-.31),P=Math.max(.12,o-.11);Wn(this.scoreGroup,[[-b/2,1.18],[b/2,1.18],[P/2,-1.34],[-P/2,-1.34]],.12,g,[_,0,2.7]),Wn(this.scoreGroup,[[-b*.35,1.04],[b*.35,1.04],[P*.34,-1.12],[-P*.34,-1.12]],.035,y,[_,0,2.84]),uy(this.scoreGroup,_,b,P,-1.6,2.75,3.72,y),se(this.scoreGroup,[Math.max(.08,b),.18,.22],[_,1.23,2.86],h,.035),jt(this.scoreGroup,[_-b/2,1.17,2.93],[_-P/2,-1.34,3.02],.052,.075,f,.015),jt(this.scoreGroup,[_+b/2,1.17,2.93],[_+P/2,-1.34,3.02],.052,.075,f,.015),se(this.scoreGroup,[Math.max(.16,o-.075),.54,.24],[_,.04,3.69],h,.045),se(this.scoreGroup,[Math.max(.1,o-.2),.035,.035],[_,.305,3.835],y,.008)}else se(this.scoreGroup,[Math.max(.16,o-.055),.13,1.34],[l+u*o,-.96,3.5],g,.045,!0),se(this.scoreGroup,[Math.max(.12,o-.15),.032,1.04],[l+u*o,-.875,3.48],y,.012),se(this.scoreGroup,[Math.max(.16,o-.055),.5,.16],[l+u*o,-.64,4.16],h,.035,!0),se(this.scoreGroup,[Math.max(.1,o-.15),.035,.045],[l+u*o,-.375,4.25],y,.012);const E=`${m>0?"+":""}${m}`,M=`#${x.getHexString()}`,T=a?ay(E,M):ry(E,M),w=new oi({alphaTest:.006,depthTest:!a,depthWrite:!a,map:T,toneMapped:!1,transparent:!0}),R=new $e(new Sn(Math.max(.3,o*(a?.86:.92)),a?FM:.43),w);if(R.position.set(l+u*o,a?NM:-.64,a?UM:4.252),R.renderOrder=20,R.frustumCulled=!a,this.scoreGroup.add(R),a&&o>=.44){const _=new $e(new Yi(Math.min(.105,o*.12),0),y);_.position.set(l+u*o,-1.53,3.81),_.rotation.z=Math.PI/4,_.scale.z=.42,_.renderOrder=21,this.scoreGroup.add(_)}});for(let d=0;d<=r.length;d+=1){const u=-3.39+d*o;a?(se(this.scoreGroup,[.095,2.78,.34],[u,-.08,2.88],c,.026),se(this.scoreGroup,[.032,2.62,.045],[u,-.08,3.075],f,.009)):(se(this.scoreGroup,[.055,1.3,1.4],[u,-.33,3.5],c,.018,!0),se(this.scoreGroup,[.08,.06,1.44],[u,.35,3.5],f,.02))}}updateScoreFlashes(e){for(let t=0;t<this.scoreMaterials.length;t+=1){const n=this.scoreMaterials[t],s=Math.max(0,(this.scoreImpulses[t]||0)-e*2.4);this.scoreImpulses[t]=s;const r=Number(n.userData.baseEmissiveIntensity)||(n.color.getHex()===15185995?.42:.32);n.emissiveIntensity=r+s*(this.machineTheme==="galactic-palace"?.34:.72)}}}class py{constructor(e){this.options=e,this.particleColors=new Float32Array(jo*3),this.particlePositions=new Float32Array(jo*3),this.particleGeometry=new It,this.targetPosition=new N,this.particleGeometry.setAttribute("position",new Gt(this.particlePositions,3).setUsage(Bi)),this.particleGeometry.setAttribute("color",new Gt(this.particleColors,3).setUsage(Bi)),this.particleGeometry.setDrawRange(0,0),this.particleMaterial=new qc({alphaTest:.006,blending:zi,depthWrite:!1,map:e.pointTexture,opacity:.55,size:.085,sizeAttenuation:!0,transparent:!0,vertexColors:!0}),this.particlePoints=new Rd(this.particleGeometry,this.particleMaterial),this.particlePoints.frustumCulled=!1,this.particlePoints.renderOrder=15,e.root.add(this.particlePoints)}sync(e){const t=Math.min(jo,e.length),n=Math.max(0,e.length-t);for(let a=0;a<t;a+=1){const o=e[n+a];qa(this.targetPosition,o.x,o.y);const l=a*3;this.particlePositions[l]=this.targetPosition.x,this.particlePositions[l+1]=this.targetPosition.y,this.particlePositions[l+2]=this.targetPosition.z+.16;const c=this.options.colors.get(o.color),f=.1+mt.clamp(o.life/Math.max(.001,o.maxLife),0,1)*.65;this.particleColors[l]=c.r*f,this.particleColors[l+1]=c.g*f,this.particleColors[l+2]=c.b*f}this.particleGeometry.setDrawRange(0,t);const s=this.particleGeometry.getAttribute("position"),r=this.particleGeometry.getAttribute("color");s.needsUpdate=!0,r.needsUpdate=!0}}class my{constructor(e){this.options=e,this.platformTextureState=Vu(),this.plinkoTextureState=Vu(),this.textureLoader=new Wd,this.disposed=!1,this.textureLoader.setCrossOrigin("anonymous");const t=s=>[{fallbackColor:s?1511719:1651275,material:e.platformMaterial,textureColor:s?16315135:15856887},{fallbackColor:s?854552:1120295,material:e.movingDeckSurfaceMaterial,textureColor:s?16249343:15265266}],n=s=>[{fallbackColor:s?591895:725796,material:e.plinkoMaterial,textureColor:s?16249599:15856887},{fallbackColor:526099,material:e.galacticPlinkoSurfaceMaterial,textureColor:15195890}];this.platformTargets={arcade:t(!1),"galactic-palace":t(!0)},this.plinkoTargets={arcade:n(!1),"galactic-palace":n(!0)}}sync(e,t){this.ensurePlatformTexture(e),this.ensurePlinkoTexture(t)}applyThemeSurfaceColors(){const e=this.options.getTheme()==="galactic-palace";this.options.platformMaterial.color.setHex(this.platformTextureState.texture?e?16315135:15856887:e?723474:1651275),this.options.movingDeckSurfaceMaterial.color.setHex(this.platformTextureState.texture?e?16249343:15265266:e?460556:1120295),this.options.pusherGapSurfaceMaterial.color.setHex(e?5919331:2505554),this.options.plinkoMaterial.color.setHex(this.plinkoTextureState.texture?e?16249599:15856887:e?591895:725796),this.options.galacticPlinkoSurfaceMaterial.color.setHex(this.plinkoTextureState.texture?15195890:526099),this.options.platformMaterial.emissive.setHex(e?196872:464935),this.options.movingDeckSurfaceMaterial.emissive.setHex(e?131334:200989),this.options.pusherGapSurfaceMaterial.emissive.setHex(e?1247517:464935),this.options.plinkoMaterial.emissive.setHex(e?131334:198677),this.options.platformMaterial.needsUpdate=!0,this.options.movingDeckSurfaceMaterial.needsUpdate=!0,this.options.pusherGapSurfaceMaterial.needsUpdate=!0,this.options.plinkoMaterial.needsUpdate=!0,this.options.galacticPlinkoSurfaceMaterial.needsUpdate=!0}ensurePlatformTexture(e){this.ensureSurfaceTexture(e,this.platformTextureState,this.platformTargets[this.options.getTheme()])}ensurePlinkoTexture(e){this.ensureSurfaceTexture(e,this.plinkoTextureState,this.plinkoTargets[this.options.getTheme()])}ensurePlinkoUvCrop(e){this.plinkoAspect!==e&&(xf(this.options.getPlinkoGeometry(),e),this.plinkoAspect=e)}ensureSurfaceTexture(e,t,n){const s=String(e||"").trim(),r=n.some(o=>o.material===this.options.galacticPlinkoSurfaceMaterial);if(s!==t.desiredUrl&&(t.desiredUrl=s,t.loadingUrl="",t.retryAt=0,t.token+=1),!s){if(r&&this.options.getPlinkoGeometry()&&this.ensurePlinkoUvCrop(1),!t.texture&&!t.loadedUrl)return;t.texture?.dispose(),t.texture=null,t.loadedUrl="";for(const o of n)o.material.map=null,o.material.color.setHex(o.fallbackColor),o.material.needsUpdate=!0;this.applyThemeSurfaceColors();return}if(t.texture&&t.loadedUrl===s||t.loadingUrl===s||Date.now()<t.retryAt)return;t.loadingUrl=s;const a=++t.token;this.textureLoader.load(s,o=>{if(this.disposed||a!==t.token||t.desiredUrl!==s){o.dispose();return}kM(o,this.options.renderer),r&&this.options.getPlinkoGeometry()&&this.ensurePlinkoUvCrop(dy(o));const l=t.texture;t.texture=o,t.loadedUrl=s,t.loadingUrl="",t.retryAt=0;for(const c of n)c.material.map=o,c.material.color.setHex(c.textureColor),c.material.needsUpdate=!0;this.applyThemeSurfaceColors(),l&&l!==o&&l.dispose()},void 0,()=>{this.disposed||a!==t.token||t.desiredUrl!==s||(t.loadingUrl="",t.retryAt=Date.now()+1500)})}dispose(){this.disposed||(this.disposed=!0,this.platformTextureState.token+=1,this.plinkoTextureState.token+=1,this.platformTextureState.texture?.dispose(),this.plinkoTextureState.texture?.dispose())}}class gy{constructor(e){this.options=e,this.sideGuardRoot=new Bt,this.sideGuardVisualProgress=1,this.machineTheme="arcade",this.pusherGapSurface=this.buildPusherGapSurface(),this.pusherGapTrim=this.buildPusherGapTrim(),this.buildSideGuards()}update(e,t,n,s,r,a){this.machineTheme=a,this.updatePusherGap(e),this.updateSideGuards(t,n,s,r)}buildPusherGapSurface(){const e=new $e(new qn(6.04,.05,1),this.options.materials.pusherGapSurfaceMaterial);return e.position.set(0,2.965,va),e.scale.z=.001,e.receiveShadow=!0,e.visible=!1,this.options.root.add(e),e}buildPusherGapTrim(){const e=new $e(new qn(6.12,.055,.055),this.options.materials.goldMaterial);return e.position.set(0,2.974,va),e.castShadow=!0,e.receiveShadow=!0,e.visible=!1,this.options.root.add(e),e}updatePusherGap(e){const t=e+uf,n=Math.max(0,t-va),s=n>.006;if(this.pusherGapSurface.visible=s,this.pusherGapTrim.visible=s,!s)return;const r=n+Hu;this.pusherGapSurface.position.z=va+r/2,this.pusherGapSurface.scale.z=r,this.pusherGapTrim.position.z=t-Hu/2}buildSideGuards(){this.sideGuardRoot.name="coin-pusher-side-guards";for(const e of[-1,1]){const t=se(this.sideGuardRoot,[.19,.62,5.74],[e*3.27,0,-.02],this.options.materials.sideGuardFrameMaterial,.065,!0);t.castShadow=!0;const n=e*3.16;se(this.sideGuardRoot,[.034,.12,5.46],[n,.17,-.03],this.options.materials.sideGuardGlowMaterial,.012),se(this.sideGuardRoot,[.24,.15,.34],[e*3.27,.26,-2.76],this.options.materials.goldMaterial,.045,!0),se(this.sideGuardRoot,[.24,.15,.34],[e*3.27,.26,2.72],this.options.materials.goldMaterial,.045,!0);for(let s=0;s<5;s+=1){const r=se(this.sideGuardRoot,[.032,.16,.28],[n,-.1,-2.12+s*1.06],this.options.materials.sideGuardGlowMaterial,.01);r.rotation.x=Math.PI/4}}this.sideGuardRoot.position.y=2.65,this.sideGuardRoot.renderOrder=8,this.options.root.add(this.sideGuardRoot)}updateSideGuards(e,t,n,s){const r=t===!1||t===void 0?1:mt.clamp(Number.isFinite(Number(e))?Number(e):1,0,1);this.sideGuardVisualProgress=r;let a=12;for(let h=0;h<n.length;h+=1){const f=n[h];f.phase!=="pusher"&&f.phase!=="settling"&&f.phase!=="shelf"||(a=Math.max(a,Number(f.radius)||0))}const o=mt.clamp(a/18,1,2.8),l=.62*o,c=2.38;this.sideGuardRoot.scale.y=o,this.sideGuardRoot.position.y=c+l/2-(1-this.sideGuardVisualProgress)*(l+.34),this.sideGuardRoot.visible=this.sideGuardVisualProgress>.015,this.options.materials.sideGuardGlowMaterial.emissiveIntensity=(this.machineTheme==="galactic-palace"?.66:.84)+Math.sin(s*4.6)*.08+this.sideGuardVisualProgress*.16}}function vy(i){const e=new Mt({clearcoat:.86,clearcoatRoughness:.18,color:197899,emissive:65798,emissiveIntensity:.025,envMapIntensity:.72,metalness:.94,roughness:.23}),t=new Mt({clearcoat:.58,clearcoatRoughness:.26,color:526359,emissive:196874,emissiveIntensity:.04,envMapIntensity:.62,metalness:.78,roughness:.3}),n=new Mt({clearcoat:1,clearcoatRoughness:.08,color:14988634,emissive:2691840,emissiveIntensity:.025,envMapIntensity:1,metalness:1,roughness:.19}),s=new Mt({clearcoat:.88,clearcoatRoughness:.14,color:12157484,emissive:1444096,emissiveIntensity:.02,envMapIntensity:.92,metalness:.98,roughness:.26}),r=Mn(1687551,.66),a=Mn(5627903,.82),o=Mn(7419647,.7),l=Mn(15084219,.68),c=Mn(14461259,.16),h=new Mt({clearcoat:.58,clearcoatRoughness:.24,color:7029533,envMapIntensity:.82,metalness:.98,roughness:.3});for(const[d,u]of[r,a,o,l,c].entries())u.userData.baseEmissiveIntensity=u.emissiveIntensity,u.userData.pulsePhase=d*1.37,u.userData.pulseSpeed=.62+d*.075,i.galacticPulseMaterials.push(u);const f=i.galacticThemeRoot;return f.name="coin-pusher-galactic-palace",f.visible=!1,i.machineRoot.add(f),{root:f,obsidian:e,obsidianInset:t,royalGold:n,antiqueGold:s,cyanNeon:r,electricCyan:a,violetNeon:o,magentaNeon:l,warmNeon:c,deepBronze:h}}function _y(i,e){const{root:t}=e,n=new Yi(.064,0),s=[{color:4447487,positions:[[-3.04,10.5,-2.97],[-3.43,8.48,-2.78],[-3.49,6.83,-2.43],[-3.54,5.12,-2.06],[-3.63,2.42,2.78],[-2.54,-1.18,3.65]]},{color:9331199,positions:[[3.04,10.5,-2.97],[3.43,8.48,-2.78],[3.49,6.83,-2.43],[3.54,5.12,-2.06],[3.63,2.42,2.78],[2.54,-1.18,3.65]]},{color:15748040,positions:[[-2.3,10.54,-3.05],[2.3,10.54,-3.05],[-3.65,3.55,-1.72],[3.65,3.55,-1.72],[-1.34,-1.2,3.72],[1.34,-1.2,3.72]]},{color:16763746,positions:[[-1.5,10.57,-3.08],[1.5,10.57,-3.08],[-3.56,4.3,-1.9],[3.56,4.3,-1.9],[-.42,-1.2,3.74],[.42,-1.2,3.74]]}];for(let r=0;r<s.length;r+=1){const a=s[r],o=new sn({color:a.color,emissive:a.color,emissiveIntensity:.46,metalness:.16,roughness:.18}),l={h:0,s:0,l:0};o.color.getHSL(l);const c=new yn(n,o,a.positions.length);c.name=`galactic-ambient-jewels-${r+1}`;for(let h=0;h<a.positions.length;h+=1){i.dummy.position.set(...a.positions[h]),i.dummy.quaternion.identity(),i.dummy.rotation.z=Math.PI/4+h*.31;const f=.82+h%3*.12;i.dummy.scale.set(f,f*1.24,f*.72),i.dummy.updateMatrix(),c.setMatrixAt(h,i.dummy.matrix)}c.instanceMatrix.needsUpdate=!0,c.computeBoundingSphere(),t.add(c),i.galacticAmbientAccents.push({baseHue:l.h,baseIntensity:.34+r*.025,material:o,phase:r*1.61,pulseRange:.22,speed:.56+r*.07})}}function xy(i,e){const{root:t,obsidianInset:n,royalGold:s,antiqueGold:r,deepBronze:a}=e;i.galacticBackdropRoot.name="galactic-palace-hall-backdrop",t.add(i.galacticBackdropRoot);const o=i.galacticBackdropRoot,l=ZM(),c=new sn({color:11643087,emissive:3877215,emissiveIntensity:.16,emissiveMap:l,map:l,metalness:.28,roughness:.72}),h=new Mt({clearcoat:.7,clearcoatRoughness:.24,color:2368061,emissive:527138,emissiveIntensity:.13,envMapIntensity:.72,metalness:.9,roughness:.28}),f=Mn(2871295,.34),d=Mn(10178047,.35),u=Mn(16763240,.2);for(const[y,E]of[f,d,u].entries())E.userData.baseEmissiveIntensity=E.emissiveIntensity,E.userData.pulsePhase=y*2.08;i.galacticBackdropPulseMaterials.push(f,d,u),se(o,[14.6,13.7,.22],[0,4.25,-7.18],h,.18);const m=new $e(new Sn(14.25,13.35),c);m.name="galactic-casino-art-deco-mural",m.position.set(0,4.25,-7.045),m.castShadow=!1,m.receiveShadow=!1,o.add(m);const x=new Mt({clearcoat:.92,clearcoatRoughness:.12,color:1511463,depthWrite:!1,emissive:395032,emissiveIntensity:.12,envMapIntensity:.86,metalness:.34,opacity:.34,roughness:.17,transparent:!0});se(o,[14.4,.1,8.8],[0,-1.78,-3.02],x,.035);const v=new $e(new bn(5.24,.15,12,72,Math.PI),a);v.name="galactic-hall-outer-arch",v.position.set(0,4.82,-6.65),o.add(v);const g=new $e(new bn(5.02,.07,10,72,Math.PI),r);g.name="galactic-hall-gold-arch",g.position.set(0,4.82,-6.49),o.add(g);for(const y of[-1,1]){const E=new $e(new bn(4.82,.036,8,40,Math.PI/2),y<0?f:d);E.name=y<0?"galactic-hall-cyan-arch":"galactic-hall-violet-arch",E.rotation.z=y<0?Math.PI/2:0,E.position.set(0,4.82,-6.34),o.add(E)}for(const y of[-1,1]){const E=se(o,[1.82,10.72,.24],[y*4.76,4.25,-6.76],n,.26);E.name=y<0?"galactic-hall-left-alcove":"galactic-hall-right-alcove";const M=se(o,[1.42,9.98,.08],[y*4.76,4.25,-6.59],h,.22);M.name="galactic-hall-faceted-inset";const T=new Bt;T.name=y<0?"galactic-hall-left-column":"galactic-hall-right-column",T.position.set(y*RM,PM,IM);const w=new $e(new Wi(.51,.67,10.45,32),h);w.name="galactic-hall-fluted-column-shaft",w.castShadow=!1,T.add(w);for(const L of[-.25,0,.25])se(T,[.045,8.72,.055],[L,.02,.52],L===0?u:r,.012);for(const L of[-4.8,-4.12,4.04,4.82]){const B=Math.abs(L)>4.5,Y=new $e(new bn(B?.72:.57,B?.085:.06,10,36),B?s:r);Y.rotation.x=Math.PI/2,Y.position.y=L,T.add(Y)}const R=new $e(new Wi(.8,.58,.34,8),s);R.position.y=4.98,T.add(R);const _=new $e(new Yi(.2,0),y<0?f:d);_.position.set(0,5.34,.05),_.rotation.z=Math.PI/4,T.add(_),se(T,[.09,7.65,.1],[y*-.17,.06,.61],y<0?f:d,.022),o.add(T),jt(o,[y*5.55,-1.64,-6.42],[y*3.73,-1.64,1.26],.048,.055,y<0?f:d,.014);const b=new Yi(.105,0),P=new yn(b,y<0?f:d,5);P.name=y<0?"galactic-hall-left-sconces":"galactic-hall-right-sconces";for(let L=0;L<5;L+=1){i.dummy.position.set(y*5.22,.38+L*1.92,-6.16),i.dummy.quaternion.identity(),i.dummy.rotation.z=Math.PI/4;const B=.88+L%2*.18;i.dummy.scale.set(B,B*1.35,B*.72),i.dummy.updateMatrix(),P.setMatrixAt(L,i.dummy.matrix)}P.instanceMatrix.needsUpdate=!0,P.computeBoundingSphere(),o.add(P)}}function Sy(i,e){const{root:t,obsidian:n,obsidianInset:s,royalGold:r,antiqueGold:a,cyanNeon:o,electricCyan:l,violetNeon:c,magentaNeon:h,deepBronze:f}=e;Wn(t,[[-3.38,6],[3.38,6],[3.92,5.5],[4.08,1.45],[4.42,-.2],[4.12,-2.72],[4.02,-5.9],[-4.02,-5.9],[-4.12,-2.72],[-4.42,-.2],[-4.08,1.45],[-3.92,5.5]],.4,n,[0,4.28,-6.36]),se(t,[7.75,.58,.64],[0,10.16,-3.86],s,.11),se(t,[7.34,.095,.7],[0,10.42,-3.72],a,.025),se(t,[6.98,.042,.74],[0,10.29,-3.34],l,.012),se(t,[7.6,.075,.72],[0,9.89,-3.52],f,.02),se(t,[7.22,.18,.38],[0,10.62,-3.94],n,.045),se(t,[6.82,.045,.43],[0,10.68,-3.71],r,.012),se(t,[6.46,.075,.38],[0,10.51,-3.43],s,.018),se(t,[5.92,.032,.12],[0,10.47,-3.19],a,.009);for(const T of[-1,1]){const w=Wn(t,[[-.52,.18],[.36,.18],[.52,0],[.34,-.2],[-.46,-.2],[-.62,0]],.18,s,[T*3.05,10.48,-3.12]);w.rotation.y=T<0?0:Math.PI,se(t,[.74,.045,.09],[T*3.04,10.54,-2.99],T<0?l:c,.012)}const d=[[[-2.34,8.92,-3.78],[-3.2,8.34,-3.58]],[[-3.2,8.34,-3.58],[-3.55,3.3,-2.54]],[[2.34,8.92,-3.78],[3.2,8.34,-3.58]],[[3.2,8.34,-3.58],[3.55,3.3,-2.54]]];for(let T=0;T<d.length;T+=1){const[w,R]=d[T],_=T<2;jt(t,w,R,.19,.34,f,.055);const b=[w[0]+(_?.085:-.085),w[1],w[2]+.2],P=[R[0]+(_?.085:-.085),R[1],R[2]+.2];jt(t,b,P,.048,.075,_?l:c,.014)}jt(t,[-2.34,8.92,-3.78],[2.34,8.92,-3.78],.16,.32,a,.045),jt(t,[-3.55,3.3,As-.14],[3.55,3.3,As-.14],.14,.28,a,.04);const u=[[[-2.22,8.76,-3.64],[-3.01,8.2,-3.45]],[[-3.01,8.2,-3.45],[-3.3,3.45,-2.43]],[[2.22,8.76,-3.64],[3.01,8.2,-3.45]],[[3.01,8.2,-3.45],[3.3,3.45,-2.43]]];for(let T=0;T<u.length;T+=1){const[w,R]=u[T];jt(t,w,R,.068,.12,r,.018);const _=T<2?.045:-.045;jt(t,[w[0]+_,w[1],w[2]+.072],[R[0]+_,R[1],R[2]+.072],.022,.035,T<2?o:c,.006)}jt(t,[-2.2,8.76,-3.64],[2.2,8.76,-3.64],.066,.12,r,.018),jt(t,[-3.28,3.44,As-.055],[3.28,3.44,As-.055],.062,.11,r,.016);for(const T of[-1,1])jt(t,[T*3.58,3.25,-2.65],[T*4.06,2.08,3.15],.43,.5,s,.1),jt(t,[T*3.48,3.16,-2.48],[T*3.83,2.16,3.22],.095,.13,a,.026),jt(t,[T*3.39,3.05,-2.32],[T*3.7,2.22,3.16],.044,.07,T<0?o:c,.012);const m=JM(),x=new oi({blending:zi,depthWrite:!1,map:m,opacity:.24,toneMapped:!1,transparent:!0}),v=Ku(),g=new $e(v,i.galacticPlinkoSurfaceMaterial);g.receiveShadow=!0,g.renderOrder=1,t.add(g);const y=new $e(Ku(),x);y.position.copy(Hs).multiplyScalar(of),y.renderOrder=2,t.add(y),se(t,[.76,7.26,.68],[-3.91,6.2,-3.36],n,.12,!0),se(t,[.76,7.26,.68],[3.91,6.2,-3.36],n,.12,!0),se(t,[.3,6.82,.77],[-3.6,6.14,-3.19],a,.065),se(t,[.3,6.82,.77],[3.6,6.14,-3.19],a,.065),se(t,[.09,5.96,.09],[-3.39,6.1,-2.89],l,.025),se(t,[.09,5.96,.09],[3.39,6.1,-2.89],l,.025);for(const T of[-1,1]){const w=T*3.88,R=se(t,[.54,1.42,.74],[w,8.75,-3.18],s,.09);R.rotation.z=T*-.18;const _=se(t,[.09,1.24,.79],[T*3.59,8.67,-2.95],r,.025);_.rotation.z=T*-.18;const b=se(t,[.62,1.72,.82],[T*3.79,3.52,-2.18],s,.1);b.rotation.z=T*.16;const P=se(t,[.075,1.38,.09],[T*3.52,3.55,-1.79],T<0?o:h,.02);P.rotation.z=T*.16}for(const T of[-1,1])for(let w=0;w<3;w+=1){const R=4.48+w*1.45,_=Wn(t,[[-.23,.54],[.15,.54],[.28,.35],[.24,-.43],[.07,-.56],[-.22,-.47],[-.3,.32]],.12,s,[T*3.78,R,-2.91]);_.rotation.y=T<0?0:Math.PI,se(t,[.035,.72,.035],[T*3.54,R,-2.77],T<0?o:c,.007)}const E=new Yi(.052,0),M=new yn(E,r,16);for(let T=0;T<16;T+=1){const w=T<8?-1:1,_=T%8/7;i.dummy.position.set(w*mt.lerp(3.4,3.52,_),mt.lerp(3.75,8.56,_),mt.lerp(-2.38,-3.46,_)),i.dummy.quaternion.identity(),i.dummy.rotation.z=Math.PI/4,i.dummy.scale.set(1,1.35,.6),i.dummy.updateMatrix(),M.setMatrixAt(T,i.dummy.matrix)}return M.instanceMatrix.needsUpdate=!0,M.renderOrder=3,t.add(M),v}function My(i,e){const{root:t,obsidian:n,obsidianInset:s,royalGold:r,antiqueGold:a,cyanNeon:o,electricCyan:l,violetNeon:c,warmNeon:h}=e;se(t,[8.2,1.34,.72],[0,9.62,-3.3],n,.18,!0),se(t,[7.72,.22,.82],[0,10.14,-3.17],r,.055),se(t,[7.54,.065,.12],[0,10.02,-2.76],l,.02);const f=se(t,[2.96,.34,.34],[-1.78,9.55,-2.91],s,.055);f.rotation.z=-.16;const d=se(t,[2.96,.34,.34],[1.78,9.55,-2.91],s,.055);d.rotation.z=.16;const u=se(t,[2.74,.18,.32],[-1.78,9.58,-2.76],a,.045);u.rotation.z=-.16;const m=se(t,[2.74,.18,.32],[1.78,9.58,-2.76],a,.045);m.rotation.z=.16;const x=se(t,[2.36,.035,.05],[-1.86,9.48,-2.53],r,.008);x.rotation.z=-.16;const v=se(t,[2.36,.035,.05],[1.86,9.48,-2.53],r,.008);v.rotation.z=.16;const g=se(t,[2.16,.065,.09],[-1.9,9.72,-2.54],o,.018);g.rotation.z=-.16;const y=se(t,[2.16,.065,.09],[1.9,9.72,-2.54],c,.018);y.rotation.z=.16,i.galacticCrest.position.set(0,9.58,-2.62),i.galacticCrest.name="galactic-amethyst-crest",t.add(i.galacticCrest),Wn(i.galacticCrest,[[-.66,.35],[0,.92],[.66,.35],[.48,-.58],[0,-.98],[-.48,-.58]],.18,s,[0,0,0]);const E=new $e(new bn(.67,.085,16,64),r);E.position.z=.19;const M=new $e(new bn(.5,.035,12,56),a);M.position.z=.245,i.galacticCrest.add(E,M);const T=new Mt({clearcoat:1,clearcoatRoughness:.04,color:12151039,emissive:6099886,emissiveIntensity:.22,envMapIntensity:1.62,flatShading:!0,ior:2.05,metalness:.08,roughness:.055,thickness:.88,transmission:.16});i.galacticDiamond.name="galactic-amethyst-diamond-pivot",i.galacticDiamond.position.z=.34,i.galacticDiamond.rotation.y=Math.PI/8,i.galacticDiamond.scale.set(.82,.86,.72);const w=new $e(hy(),T);w.name="galactic-amethyst",w.castShadow=!0,i.galacticDiamond.add(w),i.galacticCrest.add(i.galacticDiamond);const R=new Xc({blending:zi,color:11294463,depthTest:!0,depthWrite:!1,map:i.pointTexture,opacity:.09,toneMapped:!1,transparent:!0}),_=new Ad(R);_.position.z=.08,_.scale.set(1.65,1.65,1),_.renderOrder=7,i.galacticCrest.add(_),se(t,[1.72,.24,.19],[0,8.98,-2.82],n,.05),se(t,[1.5,.028,.045],[0,9.08,-2.7],h,.009);const b=new sn({alphaTest:.012,color:16775135,emissive:9428991,emissiveIntensity:.06,emissiveMap:i.logoTexture,map:i.logoTexture,metalness:.08,roughness:.28,transparent:!0}),P=new $e(new Sn(1.34,.25),b);P.position.set(0,8.98,-2.695),P.renderOrder=8,t.add(P);for(const L of[-1,1]){const B=Wn(t,[[-.32,.38],[.16,0],[-.32,-.38],[-.14,-.38],[.34,0],[-.14,.38]],.075,h,[L*3.04,6.15,-3.01]);B.rotation.y=L<0?0:Math.PI}return T}function yy(i,e){const{root:t,obsidian:n,obsidianInset:s,royalGold:r,antiqueGold:a,cyanNeon:o,electricCyan:l,violetNeon:c,magentaNeon:h,warmNeon:f,deepBronze:d}=e;se(t,[7.45,AM,df],[0,wM,TM],s,.06),se(t,[6.92,.055,ff],[0,3.19,CM],f,.018),se(t,[.54,1.28,1.15],[-3.48,2.7,-2.28],n,.1),se(t,[.54,1.28,1.15],[3.48,2.7,-2.28],n,.1);for(const u of[-1,1]){const m=Wn(t,[[-.5,.52],[.22,.52],[.48,.18],[.4,-.42],[.08,-.58],[-.46,-.38]],.38,s,[u*3.18,3.08,-2.08]);m.rotation.y=u<0?0:Math.PI;const x=jt(t,[u*2.78,3.4,-1.82],[u*3.29,2.75,-1.61],.07,.08,r,.015);x.renderOrder=4,se(t,[.32,.055,.09],[u*3.2,2.75,-1.54],u<0?l:h,.012)}se(t,[7.38,.42,.48],[0,2.12,3.12],n,.09),se(t,[7.05,.075,.18],[0,2.33,3.23],a,.02),se(t,[6.58,.038,.08],[0,2.39,3.34],f,.012),se(t,[6.74,.085,.3],[0,1.96,3.18],d,.022),se(t,[6.26,.025,.08],[0,2.01,3.36],r,.007);for(const u of[-1,1])Wn(t,[[-.44,.28],[.28,.28],[.44,0],[.22,-.42],[-.35,-.42],[-.52,-.05]],.28,u<0?o:c,[u*3.35,2.23,3.35]).rotation.y=u<0?0:Math.PI;se(t,[.5,1.16,6.55],[-3.72,2.54,-.02],n,.1),se(t,[.5,1.16,6.55],[3.72,2.54,-.02],n,.1),se(t,[.09,.09,5.9],[-3.4,2.93,.12],o,.024),se(t,[.09,.09,5.9],[3.4,2.93,.12],l,.024);for(const u of[-1,1])for(let m=0;m<3;m+=1){const x=-2.03+m*2.06,v=se(t,[.32,.42,1.66],[u*3.48,2.6,x],s,.055);v.rotation.z=u*(m%2?.045:-.045),se(t,[.035,.22,1.26],[u*3.29,2.67,x],u<0?m===1?c:o:m===1?h:c,.008),se(t,[.055,.055,1.48],[u*3.37,2.89,x],a,.012)}se(t,[7.74,.82,1.04],[0,-1.5,3.12],n,.16),se(t,[7.26,.13,1.1],[0,-1.16,3.15],r,.04),se(t,[7.38,.18,.64],[0,-1.86,3.1],s,.06),se(t,[6.94,.038,.7],[0,-1.76,3.23],a,.011),se(t,[5.72,.022,.12],[0,-1.71,3.6],f,.006),se(t,[.58,3.75,1.72],[-3.78,.22,3.44],n,.11),se(t,[.58,3.75,1.72],[3.78,.22,3.44],n,.11),se(t,[.075,2.7,.075],[-3.47,.18,2.62],o,.02),se(t,[.075,2.7,.075],[3.47,.18,2.62],h,.02);for(const u of[-1,1]){const m=Wn(t,[[-.36,.68],[.24,.5],[.34,-.5],[.08,-.74],[-.4,-.55]],.22,d,[u*3.54,.04,3.7]);m.rotation.y=u<0?0:Math.PI,se(t,[.035,.92,.055],[u*3.32,.08,3.83],u<0?o:c,.008)}i.galacticPusherThemeRoot.name="galactic-pusher-skin",i.galacticPusherThemeRoot.visible=!1,i.pusherGroup.add(i.galacticPusherThemeRoot),se(i.galacticPusherThemeRoot,[6.3,.22,.16],[0,2.56,hn+.12],n,.045),se(i.galacticPusherThemeRoot,[5.92,.052,.06],[0,2.63,hn+.215],l,.016),se(i.galacticPusherThemeRoot,[6.42,.075,.12],[0,2.91,hn+.08],a,.022),se(i.galacticPusherThemeRoot,[5.46,.035,.06],[0,2.955,hn+.155],f,.01);for(const u of[-1,1]){const m=se(i.galacticPusherThemeRoot,[.54,.28,.23],[u*3.06,2.6,hn+.17],r,.045);m.rotation.z=u*.16}}class by{constructor(e){this.options=e,this.classicDecorRoot=new Bt,this.classicHeaderGroup=new Bt,this.classicPegRoot=new Bt,this.galacticPegRoot=new Bt,this.galacticAmbientAccents=[],this.galacticBackdropPulseMaterials=[],this.galacticBackdropRoot=new Bt,this.galacticCrest=new Bt,this.galacticDiamond=new Bt,this.galacticPulseMaterials=[],this.galacticPusherThemeRoot=new Bt,this.galacticThemeRoot=new Bt,this.pusherGroup=new Bt,this.pegSignature="",this.textureLoader=new Wd,this.dummy=new Lt,this.machineTheme="arcade",this.themeReveal=1,this.platformSurface=this.buildMachine(),this.mechanics=new gy({root:e.root,materials:e.materials}),this.ensurePegs(),this.buildGalacticTheme(),this.textureLoader.setCrossOrigin("anonymous")}setTheme(e){this.machineTheme=e,this.themeReveal=0}animate(e,t,n,s,r){this.updateMachineThemeAnimation(e,t,n,s,r)}buildMachine(){this.options.root.add(this.classicHeaderGroup,this.classicDecorRoot);const e=new Mt({clearcoat:.52,clearcoatRoughness:.32,color:527900,emissive:133143,emissiveIntensity:.1,envMapIntensity:.65,metalness:.92,roughness:.36}),t=new sn({color:330005,emissive:0,emissiveIntensity:0,metalness:.18,roughness:.72}),n=Mn(si,1.35),s=Mn(hf,1.2),r=Mn(16730960,.58),a=Mn(si,.5),o=new Mt({clearcoat:.28,clearcoatRoughness:.42,color:7268351,depthWrite:!1,envMapIntensity:.24,metalness:0,opacity:.045,roughness:.42,side:Cn,transparent:!0,transmission:.02}),l=new Mt({clearcoat:.65,clearcoatRoughness:.28,color:1120295,emissive:200989,emissiveIntensity:.1,envMapIntensity:.72,metalness:.82,roughness:.34}),c=new Mt({clearcoat:.38,clearcoatRoughness:.5,color:462876,emissive:66827,emissiveIntensity:.08,envMapIntensity:.42,metalness:.68,roughness:.52});this.classicPlinkoBackShell=se(this.options.root,[7.55,6.85,.42],[0,6.18,-3.8],e,.2,!0),this.classicPlinkoInsetShell=se(this.options.root,[6.86,6.08,.2],[0,6.18,-3.5],t,.13,!0);const h=new $e(new Sn((nh-Ha)/66,5.56),this.options.materials.plinkoMaterial);h.position.set(0,6.04,-3.382),h.receiveShadow=!0,h.renderOrder=1,this.classicPlinkoSurface=h,this.options.root.add(h),se(this.options.root,[7.72,1.16,.72],[0,9.49,-3.45],e,.16,!0),se(this.options.root,[7.46,.07,.76],[0,10.02,-3.44],this.options.materials.goldMaterial,.025,!0),se(this.options.root,[7.46,.07,.76],[0,8.96,-3.44],this.options.materials.goldMaterial,.025,!0),se(this.options.root,[.34,6.25,.58],[-3.67,6.22,-3.42],this.options.materials.goldMaterial,.1,!0),se(this.options.root,[.34,6.25,.58],[3.67,6.22,-3.42],this.options.materials.goldMaterial,.1,!0),xi(this.classicDecorRoot,[6.65,.045,.055],[0,8.86,-3.31],a),xi(this.classicDecorRoot,[6.65,.055,.06],[0,3.25,-3.31],s),xi(this.classicDecorRoot,[.055,5.9,.06],[-3.32,6.19,-3.31],n),xi(this.classicDecorRoot,[.055,5.9,.06],[3.32,6.19,-3.31],s),se(this.classicHeaderGroup,[5.34,.98,.18],[0,9.59,-3.01],t,.12,!0),se(this.classicHeaderGroup,[.045,.76,.08],[-2.53,9.6,-2.87],n,.012),se(this.classicHeaderGroup,[.045,.76,.08],[2.53,9.6,-2.87],r,.012);const f=this.textureLoader.load("/brand/shenpulse-banner-transparent.png");this.logoTexture=f,f.colorSpace=kt,f.anisotropy=8;const d=new oi({alphaTest:.012,color:462876,map:f,toneMapped:!0}),u=new sn({alphaTest:.012,color:16777215,emissive:16777215,emissiveIntensity:.14,emissiveMap:f,map:f,metalness:.08,roughness:.34}),m=new Sn(4.62,.934);for(let _=3;_>=1;_-=1){const b=new $e(m,d);b.position.set(-_*.006,9.64-_*.003,-2.84-_*.015),b.renderOrder=3,this.classicHeaderGroup.add(b)}const x=new $e(m,u);x.position.set(0,9.64,-2.84),x.renderOrder=4,this.classicHeaderGroup.add(x),se(this.classicHeaderGroup,[3.56,.34,.12],[0,9.02,-3.01],t,.07,!0);const v=qM("COIN PUSHER"),g=new oi({alphaTest:.01,map:v,toneMapped:!1,transparent:!0}),y=new $e(new Sn(3.25,.29),g);y.position.set(0,9.02,-2.91),y.renderOrder=5,this.classicHeaderGroup.add(y),se(this.options.root,[7.25,.3,6.5],[0,2.17,-.03],e,.12,!0);const E=new $e(new Sn(6.84,6.08),this.options.materials.platformMaterial);E.rotation.x=-Math.PI/2,E.position.set(0,2.335,-.08),E.receiveShadow=!0,E.renderOrder=1,this.options.root.add(E),se(this.options.root,[.22,.58,6.55],[-3.52,2.53,-.02],this.options.materials.goldMaterial,.07,!0),se(this.options.root,[.22,.58,6.55],[3.52,2.53,-.02],this.options.materials.goldMaterial,.07,!0),xi(this.options.root,[.055,5.1,6.35],[-3.66,5.05,-.08],o),xi(this.options.root,[.055,5.1,6.35],[3.66,5.05,-.08],o);const M=se(this.pusherGroup,[6.55,.58,hn-pr],[0,2.65,(hn+pr)/2],e,.12,!0);M.castShadow=!0,se(this.pusherGroup,[6.42,.12,.036],[0,2.41,hn+.018],t,.007,!0),se(this.pusherGroup,[6.38,.16,.075],[0,2.52,hn+.046],t,.04,!0),se(this.pusherGroup,[6.12,.035,.025],[0,2.52,hn+.096],this.options.materials.pusherGlowMaterial,.012);const T=hn-pr-.04,w=(hn+pr)/2+.02;se(this.pusherGroup,[6.1,.06,T],[0,2.96,w],l,.035,!0);const R=new $e(new Sn(6.04,Math.max(.2,T-.08)),this.options.materials.movingDeckSurfaceMaterial);return R.rotation.x=-Math.PI/2,R.position.set(0,2.994,w-.02),R.receiveShadow=!0,R.renderOrder=2,this.pusherGroup.add(R),se(this.pusherGroup,[6.18,.07,.1],[0,2.95,hn-.025],this.options.materials.goldMaterial,.026,!0),this.pusherGroup.position.z=ki(Ot),this.options.root.add(this.pusherGroup),se(this.options.root,[7.06,2.52,.18],[0,.15,2.76],c,.09,!0),se(this.options.root,[7.08,.18,1.56],[0,-1.06,3.5],c,.07,!0),se(this.options.root,[7.7,.68,.86],[0,-1.42,3.12],e,.18,!0),se(this.options.root,[7.35,.24,1.65],[0,1.82,3.22],this.options.materials.goldMaterial,.08,!0),se(this.options.root,[.42,3.55,1.5],[-3.67,.35,3.47],this.options.materials.goldMaterial,.1,!0),se(this.options.root,[.42,3.55,1.5],[3.67,.35,3.47],this.options.materials.goldMaterial,.1,!0),xi(this.classicDecorRoot,[.035,2.12,.035],[-3.34,.12,2.88],a),xi(this.classicDecorRoot,[.035,2.12,.035],[3.34,.12,2.88],a),this.options.root.add(this.options.scoreGroup),E}buildGalacticTheme(){const e={machineRoot:this.options.root,pointTexture:this.options.pointTexture,galacticPlinkoSurfaceMaterial:this.options.materials.galacticPlinkoSurfaceMaterial,galacticThemeRoot:this.galacticThemeRoot,dummy:this.dummy,galacticAmbientAccents:this.galacticAmbientAccents,galacticBackdropRoot:this.galacticBackdropRoot,galacticBackdropPulseMaterials:this.galacticBackdropPulseMaterials,galacticCrest:this.galacticCrest,galacticDiamond:this.galacticDiamond,logoTexture:this.logoTexture,galacticPusherThemeRoot:this.galacticPusherThemeRoot,pusherGroup:this.pusherGroup,galacticPulseMaterials:this.galacticPulseMaterials},t=vy(e);_y(e,t),xy(e,t),this.galacticPlinkoPanelGeometry=Sy(e,t),this.galacticDiamondMaterial=My(e,t),yy(e,t)}ensurePegs(e){const t=e===void 0?OM:e;if(t===this.pegSource)return;let n=!1;for(let a=0;a<t.length;a+=1){const o=t[a];if(!Number.isFinite(o.index)||!Number.isFinite(o.row)||!Number.isFinite(o.x)||!Number.isFinite(o.y)){n=!0;break}}const s=n?t.filter(a=>Number.isFinite(a.index)&&Number.isFinite(a.row)&&Number.isFinite(a.x)&&Number.isFinite(a.y)):t,r=XM(s);this.pegSource=t,r!==this.pegSignature&&(this.pegSignature=r,this.buildPegs(s))}buildPegs(e){if(mc(this.classicPegRoot),mc(this.galacticPegRoot),this.classicPegRoot.name="coin-pusher-arcade-pegs",this.galacticPegRoot.name="coin-pusher-palace-pegs",this.options.root.add(this.classicPegRoot),this.galacticThemeRoot.add(this.galacticPegRoot),e.length===0){this.options.onShadowRefresh();return}const t=new Wi(.075,.098,.25,40);t.rotateX(Math.PI/2);const n=new Mt({clearcoat:1,color:15910509,emissive:4924928,emissiveIntensity:.16,metalness:1,roughness:.28}),s=new yn(t,n,e.length),r=new bn(.132,.022,12,40),a=new oi({color:16768922,toneMapped:!0}),o=new yn(r,a,e.length),l=new N;e.forEach((x,v)=>{pf(l,x.x,x.y),this.dummy.position.copy(l),this.dummy.quaternion.identity(),this.dummy.scale.setScalar(1),this.dummy.updateMatrix(),s.setMatrixAt(v,this.dummy.matrix),o.setMatrixAt(v,this.dummy.matrix)}),s.instanceMatrix.needsUpdate=!0,o.instanceMatrix.needsUpdate=!0,s.castShadow=!0,s.receiveShadow=!0,this.classicPegRoot.add(s,o);const c=new Wi(.05,.071,.27,18);c.rotateX(Math.PI/2);const h=new Mt({clearcoat:.84,clearcoatRoughness:.14,color:14067277,envMapIntensity:.92,metalness:1,roughness:.23}),f=new yn(c,h,e.length),d=new bn(.077,.012,8,20),u=new sn({color:1182989,metalness:.92,roughness:.24}),m=new yn(d,u,e.length);e.forEach((x,v)=>{vc(l,x.x,x.y),this.dummy.position.copy(l),this.dummy.quaternion.copy(fc),this.dummy.scale.setScalar(1),this.dummy.updateMatrix(),f.setMatrixAt(v,this.dummy.matrix),this.dummy.position.addScaledVector(Hs,.146),this.dummy.updateMatrix(),m.setMatrixAt(v,this.dummy.matrix)}),f.instanceMatrix.needsUpdate=!0,m.instanceMatrix.needsUpdate=!0,f.castShadow=!1,f.receiveShadow=!0,this.galacticPegRoot.add(f,m),this.classicPegRoot.visible=this.machineTheme!=="galactic-palace",this.galacticPegRoot.visible=!0,this.options.onShadowRefresh()}updateMachineThemeAnimation(e,t,n,s,r){if(this.machineTheme!=="galactic-palace")return;this.themeReveal=mt.damp(this.themeReveal,1,5.5,t);const a=1-Math.pow(1-this.themeReveal,3);this.galacticThemeRoot.position.y=(1-a)*.08;for(let c=0;c<this.galacticPulseMaterials.length;c+=1){const h=this.galacticPulseMaterials[c],f=Number(h.userData.baseEmissiveIntensity)||1,d=Number(h.userData.pulsePhase)||0,u=Number(h.userData.pulseSpeed)||.7,m=(Math.sin(e*u+d)+1)*.5,x=m*m*(3-2*m);h.emissiveIntensity=f+x*.075+n*.045}for(let c=0;c<this.galacticBackdropPulseMaterials.length;c+=1){const h=this.galacticBackdropPulseMaterials[c],f=Number(h.userData.baseEmissiveIntensity)||.2,d=Number(h.userData.pulsePhase)||0,u=(Math.sin(e*LM+d)+1)*.5;h.emissiveIntensity=f+u*DM+n*.025}for(const c of this.galacticAmbientAccents){const h=(Math.sin(e*c.speed+c.phase)+1)*.5,f=h*h*(3-2*h),d=c.baseHue+Math.sin(e*.12+c.phase)*.012;c.material.color.setHSL(d,.82,.57),c.material.emissive.setHSL(d,.9,.41),c.material.emissiveIntensity=c.baseIntensity+f*c.pulseRange+n*.035}this.galacticCrest.rotation.y=Math.sin(e*.72)*.028,this.galacticCrest.rotation.z=Math.sin(e*.46)*.012;const o=1+Math.sin(e*2.1)*.012+n*.025;this.galacticCrest.scale.setScalar(.82*o),this.galacticDiamond.rotation.x=Math.sin(e*.43)*.065,this.galacticDiamond.rotation.y=e*.74+Math.PI/8,this.galacticDiamond.rotation.z=Math.sin(e*.31)*.025;const l=(Math.sin(e*1.7)+1)*.5;this.galacticDiamondMaterial.emissiveIntensity=.16+l*.12+n*.075,s.color.setHSL(.54+Math.sin(e*.09)*.008,.86,.58),r.color.setHSL(.79+Math.sin(e*.075+1.8)*.01,.78,.6)}}function Ey(){const i=new Mt({clearcoat:1,clearcoatRoughness:.1,color:cf,emissive:7157504,emissiveIntensity:.08,envMapIntensity:.8,metalness:1,roughness:.3}),e=new Mt({clearcoat:.22,clearcoatRoughness:.48,color:1651275,emissive:464935,emissiveIntensity:.04,envMapIntensity:.4,metalness:.08,roughness:.76}),t=new Mt({clearcoat:.38,clearcoatRoughness:.38,color:1120295,emissive:200989,emissiveIntensity:.06,envMapIntensity:.48,metalness:.18,polygonOffset:!0,polygonOffsetFactor:-1,polygonOffsetUnits:-1,roughness:.68}),n=new Mt({clearcoat:.58,clearcoatRoughness:.32,color:2505554,emissive:464935,emissiveIntensity:.12,envMapIntensity:.7,metalness:.72,roughness:.42}),s=new Mt({clearcoat:.18,clearcoatRoughness:.56,color:725796,emissive:198677,emissiveIntensity:.035,envMapIntensity:.26,metalness:.06,roughness:.82}),r=new Mt({clearcoat:.42,clearcoatRoughness:.3,color:526099,emissive:196872,emissiveIntensity:.025,envMapIntensity:.42,metalness:.08,roughness:.58,side:Cn}),a=new sn({color:10156031,emissive:si,emissiveIntensity:.9,metalness:.25,roughness:.32}),o=new Mt({clearcoat:.88,clearcoatRoughness:.16,color:1055272,emissive:397342,emissiveIntensity:.1,envMapIntensity:.86,metalness:.94,roughness:.24}),l=new sn({color:9238527,emissive:si,emissiveIntensity:.88,metalness:.28,roughness:.2});return{goldMaterial:i,platformMaterial:e,movingDeckSurfaceMaterial:t,pusherGapSurfaceMaterial:n,plinkoMaterial:s,galacticPlinkoSurfaceMaterial:r,pusherGlowMaterial:a,sideGuardFrameMaterial:o,sideGuardGlowMaterial:l}}class Ty{constructor(e){this.adaptiveQuality=1,this.adaptiveRecoverySeconds=0,this.adaptiveStressSeconds=0,this.appliedPixelRatio=0,this.basePixelRatio=1,this.camera=new tn(46,9/16,.1,80),this.cameraBase=new N(-.18,6.55,19.5),this.cameraTarget=new N(-.28,4.12,-.35),this.galacticCameraBase=new N(-.18,13.9,16.9),this.galacticCameraTarget=new N(-.28,4,-.34),this.machineRoot=new Bt,this.scene=new yd,this.disposed=!1,this.frameIndex=0,this.frameTimeEma=1/60,this.giftImpulse=0,this.lastFrameTime=0,this.lost=!1,this.machineTheme="arcade",this.nextAdaptiveQualityChangeAt=0,this.shake=0,this.shadowFrameInterval=1,this.shadowRefreshPending=!0,this.viewportHeight=1,this.viewportWidth=1,this.handleContextLost=a=>{a.preventDefault(),this.lost=!0},this.handleContextRestored=()=>{this.lost=!1,this.appliedPixelRatio=0,this.shadowRefreshPending=!0,this.resize()},this.colors=new iy,this.floatingScores=new cy,this.canvas=e,this.renderer=new qS({alpha:!1,antialias:!0,canvas:e,powerPreference:"high-performance",stencil:!1}),this.renderer.outputColorSpace=kt,this.renderer.toneMapping=Za,this.renderer.toneMappingExposure=.76,this.renderer.shadowMap.enabled=!0,this.renderer.shadowMap.type=hd,this.renderer.shadowMap.autoUpdate=!1,this.renderer.shadowMap.needsUpdate=!0,this.scene.background=new Le(66314),this.scene.fog=new Ga(198418,.032),this.scene.add(this.machineRoot),this.machineRoot.position.x=-.3;const t=new nM,n=new rc(this.renderer);this.environmentTexture=n.fromScene(t,.035).texture,this.scene.environment=this.environmentTexture,n.dispose(),gc(t),this.coins=new ny({root:this.machineRoot,colors:this.colors}),this.materials=Ey(),this.pointTexture=GM(),this.scoreLanes=new fy(this.materials.goldMaterial),this.decor=new by({root:this.machineRoot,scoreGroup:this.scoreLanes.scoreGroup,materials:this.materials,pointTexture:this.pointTexture,onShadowRefresh:()=>{this.shadowRefreshPending=!0}}),this.surfaces=new my({renderer:this.renderer,getTheme:()=>this.machineTheme,getPlinkoGeometry:()=>this.decor.galacticPlinkoPanelGeometry,platformMaterial:this.materials.platformMaterial,movingDeckSurfaceMaterial:this.materials.movingDeckSurfaceMaterial,pusherGapSurfaceMaterial:this.materials.pusherGapSurfaceMaterial,plinkoMaterial:this.materials.plinkoMaterial,galacticPlinkoSurfaceMaterial:this.materials.galacticPlinkoSurfaceMaterial}),this.starField=this.buildStars(),this.particles=new py({root:this.machineRoot,pointTexture:this.pointTexture,colors:this.colors}),this.machineRoot.add(this.floatingScores.floatingScoreGroup),this.keyLight=new X0(16765322,115,42,Math.PI/5.8,.5,2),this.keyLight.position.set(-4.8,12,9),this.keyLight.target.position.set(-.2,3.4,-.4),this.keyLight.castShadow=!0;const s=(window.devicePixelRatio||1)>=1.75?2048:1536,r=Math.min(this.renderer.capabilities.maxTextureSize,s);this.keyLight.shadow.mapSize.set(r,r),this.keyLight.shadow.bias=-3e-4,this.scene.add(this.keyLight,this.keyLight.target),this.cyanLight=new sc(si,18,17,2),this.cyanLight.position.set(-4.4,5.7,4.8),this.magentaLight=new sc(Gu,14,16,2),this.magentaLight.position.set(4.3,7.4,1.8),this.scene.add(new V0(9169663,524823,.38),new q0(7438591,.1),this.cyanLight,this.magentaLight),this.camera.position.copy(this.cameraBase),this.camera.lookAt(this.cameraTarget),this.composer=new jS(this.renderer),this.composer.addPass(new iM(this.scene,this.camera)),this.bloomPass=new Fs(new fe(540,960),.2,.14,1.18),this.composer.addPass(this.bloomPass),this.fxaaPass=new tM,this.composer.addPass(this.fxaaPass),this.composer.addPass(new sM),e.addEventListener("webglcontextlost",this.handleContextLost),e.addEventListener("webglcontextrestored",this.handleContextRestored),this.resize()}resize(){if(this.disposed)return;const e=this.canvas.getBoundingClientRect(),t=Math.max(1,Math.round(e.width||540)),n=Math.max(1,Math.round(e.height||960)),s=Math.min(2,Math.max(1.5,window.devicePixelRatio||1)),r=Math.sqrt(5e6/Math.max(1,t*n)),a=Math.max(1,Math.min(s,r)),o=t!==this.viewportWidth||n!==this.viewportHeight,l=Math.abs(a-this.basePixelRatio)>=.01;!o&&!l&&this.appliedPixelRatio>0||(this.viewportWidth=t,this.viewportHeight=n,this.basePixelRatio=a,this.camera.aspect=t/n,this.camera.updateProjectionMatrix(),this.applyAdaptiveQuality(!0))}render(e){if(this.disposed)return;if(this.lost)throw new Error("[coin-pusher] WebGL context lost; switching to the compatibility renderer.");const t=e.time-this.lastFrameTime||.016,n=Math.min(.05,Math.max(.001,t));this.lastFrameTime=e.time,this.frameIndex+=1,this.applyMachineTheme(e.machineTheme),this.updateAdaptiveQuality(t,e.coins.length,e.particles.length,e.floatingScores.length,e.time),this.surfaces.sync(e.platformImageUrl,e.plinkoImageUrl||""),this.decor.ensurePegs(e.pegs),this.scoreLanes.sync(e.scoreSlots,e.scoreMultiplier,this.machineTheme),this.coins.sync(e.coins,this.machineTheme,e.time,this.frameIndex),this.particles.sync(e.particles),this.floatingScores.sync(e.floatingScores,this.frameIndex);const s=ki(e.pusherY);this.decor.pusherGroup.position.z=s,this.decor.mechanics.update(s,e.sideGuardProgress,e.sideLossEnabled,e.coins,e.time,this.machineTheme),this.materials.pusherGlowMaterial.emissiveIntensity=mt.damp(this.materials.pusherGlowMaterial.emissiveIntensity,.68+e.pusherPower*.2+this.giftImpulse*.1,5,n),this.giftImpulse=Math.max(0,this.giftImpulse-n*1.35),this.shake=Math.max(0,this.shake-n*1.7);const r=(Math.sin(e.time*2.2)+1)*.5,a=this.machineTheme==="galactic-palace";this.cyanLight.intensity=a?7.5+r*2.4+this.giftImpulse*5:18+r*7+this.giftImpulse*18,this.magentaLight.intensity=a?5.8+(1-r)*2+this.giftImpulse*4:14+(1-r)*6+this.giftImpulse*14,this.keyLight.intensity=a?74+e.pusherPower*14:115+e.pusherPower*25,this.bloomPass.strength=Math.min(a?.22:.3,(a?.125:.18)+this.giftImpulse*(a?.045:.07));const o=Math.sin(e.time*61)*this.shake*.075,l=Math.sin(e.time*47+1.7)*this.shake*.055,c=a?this.galacticCameraBase:this.cameraBase,h=a?this.galacticCameraTarget:this.cameraTarget,f=mt.damp(this.camera.fov,a?41.3:46,7.5,n);Math.abs(f-this.camera.fov)>.001&&(this.camera.fov=f,this.camera.updateProjectionMatrix()),this.camera.position.set(c.x+o,c.y+l+Math.sin(e.time*.23)*.025,c.z+Math.cos(e.time*.19)*.035),this.camera.lookAt(h),this.machineRoot.rotation.y=a?0:Math.sin(e.time*.16)*.006,this.starField.rotation.z=e.time*.004,this.starField.rotation.y=Math.sin(e.time*.05)*.02,this.decor.animate(e.time,n,this.giftImpulse,this.cyanLight,this.magentaLight),this.scoreLanes.update(n),e.roundPhase==="finished"&&(this.bloomPass.strength=Math.min(a?.24:.34,this.bloomPass.strength+.04+Math.sin(e.time*5)*.01)),this.renderer.shadowMap.needsUpdate=this.shadowRefreshPending||this.frameIndex%this.shadowFrameInterval===0,this.shadowRefreshPending=!1,this.composer.render(n)}giftBurst(e){const t=mt.clamp(Math.sqrt(Math.max(1,e))/9,.2,1);this.giftImpulse=Math.max(this.giftImpulse,.45+t*.8),this.shake=Math.max(this.shake,t*.65)}scoreBurst(e,t){this.scoreLanes.burst(e,t),this.shake=Math.max(this.shake,t>=20?.65:.18)}updateAdaptiveQuality(e,t,n,s,r){const a=WM(t,n,s),o=this.adaptiveQuality<.76?3:this.adaptiveQuality<.96||a<1?2:1;if(o!==this.shadowFrameInterval&&(this.shadowFrameInterval=o,this.shadowRefreshPending=!0),!Number.isFinite(e)||e<=0||e>.1||typeof document<"u"&&document.hidden){this.adaptiveStressSeconds=Math.max(0,this.adaptiveStressSeconds-.05),this.adaptiveRecoverySeconds=0;return}const l=mt.clamp(e,1/240,.075),c=1-Math.exp(-l/.72);this.frameTimeEma+=(l-this.frameTimeEma)*c;const h=this.adaptiveQuality>a+.005,f=this.frameTimeEma>.0205,d=this.frameTimeEma>.0275;if(h||f?(this.adaptiveStressSeconds+=l*(d?1.7:1),this.adaptiveRecoverySeconds=0):(this.adaptiveStressSeconds=Math.max(0,this.adaptiveStressSeconds-l*.8),this.frameTimeEma<.0168&&this.adaptiveQuality<a-.005?this.adaptiveRecoverySeconds+=l:this.adaptiveRecoverySeconds=Math.max(0,this.adaptiveRecoverySeconds-l*.65)),!(!Number.isFinite(r)||r<this.nextAdaptiveQualityChangeAt)){if(this.adaptiveStressSeconds>=mM){const u=d?.1:.07,m=Math.max(Ou,this.adaptiveQuality-u),x=h?Math.max(a,m):m;this.setAdaptiveQuality(x),this.adaptiveStressSeconds=0,this.adaptiveRecoverySeconds=0,this.nextAdaptiveQualityChangeAt=r+fM;return}this.adaptiveRecoverySeconds>=gM&&(this.setAdaptiveQuality(Math.min(a,this.adaptiveQuality+.05)),this.adaptiveStressSeconds=0,this.adaptiveRecoverySeconds=0,this.nextAdaptiveQualityChangeAt=r+pM)}}setAdaptiveQuality(e){const t=Math.round(mt.clamp(e,Ou,1)*100)/100;Math.abs(t-this.adaptiveQuality)<.005||(this.adaptiveQuality=t,this.applyAdaptiveQuality())}applyAdaptiveQuality(e=!1){const t=this.basePixelRatio*this.adaptiveQuality,n=Math.round(mt.clamp(t,.75,this.basePixelRatio)*20)/20;!e&&Math.abs(n-this.appliedPixelRatio)<.025||(this.appliedPixelRatio=n,this.renderer.setPixelRatio(n),this.renderer.setSize(this.viewportWidth,this.viewportHeight,!1),this.composer.setPixelRatio(n),this.composer.setSize(this.viewportWidth,this.viewportHeight),this.shadowRefreshPending=!0)}dispose(){if(!this.disposed){this.disposed=!0,this.canvas.removeEventListener("webglcontextlost",this.handleContextLost),this.canvas.removeEventListener("webglcontextrestored",this.handleContextRestored),this.surfaces.dispose(),this.environmentTexture.dispose(),this.coins.dispose(),this.floatingScores.dispose(),gc(this.scene);for(const e of this.composer.passes)e.dispose?.();this.composer.dispose(),this.renderer.dispose(),this.renderer.forceContextLoss(),this.colors.clear()}}applyMachineTheme(e){const t=String(e||"").trim().toLowerCase()==="galactic-palace"?"galactic-palace":"arcade";if(t===this.machineTheme)return;this.machineTheme=t;const n=t==="galactic-palace";this.decor.classicDecorRoot.visible=!n,this.decor.classicHeaderGroup.visible=!n,this.decor.classicPegRoot.visible=!n,this.decor.classicPlinkoBackShell.visible=!n,this.decor.classicPlinkoInsetShell.visible=!n,this.decor.classicPlinkoSurface.visible=!n,this.decor.galacticThemeRoot.visible=n,this.decor.galacticPusherThemeRoot.visible=n,this.starField.visible=!n,this.decor.setTheme(t),this.scene.background instanceof Le&&this.scene.background.setHex(n?65800:66314),this.scene.fog instanceof Ga&&(this.scene.fog.color.setHex(n?525081:198418),this.scene.fog.density=n?.027:.032),this.renderer.toneMappingExposure=n?.68:.76,this.materials.goldMaterial.color.setHex(n?14988634:cf),this.materials.goldMaterial.emissive.setHex(n?2691840:7157504),this.materials.goldMaterial.emissiveIntensity=n?.025:.08,this.coins.bodyMaterial.color.setHex(n?14724425:16370530),this.coins.bodyMaterial.emissive.setHex(n?2823168:6042112),this.coins.bodyMaterial.emissiveIntensity=n?.025:.08,this.materials.pusherGlowMaterial.color.setHex(n?13302015:10156031),this.materials.pusherGlowMaterial.emissive.setHex(n?SM:si),this.materials.sideGuardFrameMaterial.color.setHex(n?591633:1055272),this.materials.sideGuardFrameMaterial.emissive.setHex(n?1640736:397342),this.materials.sideGuardFrameMaterial.emissiveIntensity=n?.14:.1,this.materials.sideGuardGlowMaterial.color.setHex(n?5495295:9238527),this.materials.sideGuardGlowMaterial.emissive.setHex(n?MM:si),this.coins.mysteryMaterial.emissive.setHex(n?4133487:343656),this.coins.ticketMaterial.emissive.setHex(n?3871309:473180),this.cyanLight.color.setHex(n?2931967:si),this.magentaLight.color.setHex(n?12799487:Gu),this.keyLight.color.setHex(n?16767386:16765322),this.surfaces.applyThemeSurfaceColors(),this.scoreLanes.invalidate(),this.shadowRefreshPending=!0}buildStars(){const t=new Float32Array(780),n=new Float32Array(260*3),s=new Le(si),r=new Le(hf);for(let c=0;c<260;c+=1){const h=c*3;t[h]=(Math.random()-.5)*19,t[h+1]=-2+Math.random()*16,t[h+2]=-8-Math.random()*4;const f=c%3?s:r,d=.25+Math.random()*.75;n[h]=f.r*d,n[h+1]=f.g*d,n[h+2]=f.b*d}const a=new It;a.setAttribute("position",new Gt(t,3)),a.setAttribute("color",new Gt(n,3));const o=new qc({alphaTest:.006,blending:zi,depthWrite:!1,map:this.pointTexture,opacity:.48,size:.055,sizeAttenuation:!0,transparent:!0,vertexColors:!0}),l=new Rd(a,o);return this.scene.add(l),l}}function Ay(i){return new Ty(i)}const wy=["data-machine-theme"],Cy={class:"game-hud"},Ry={class:"brand-lockup"},Py={class:"brand-gem"},Iy={class:"host-controls"},Ly=["disabled","title"],Dy=["title"],Ny={class:"render-signature"},Uy={key:0,class:"active-effects"},Fy={key:0,class:"effect-guard"},Oy={key:1,class:"effect-multiplier"},By={class:"leaderboard-pool"},ky=["aria-label"],Gy={key:0},zy={class:"leaderboard-identity"},Hy=["title"],Vy=["title"],Wy={class:"leaderboard-metrics"},Xy={class:"leaderboard-score"},Yy={key:0,class:"leaderboard-prize"},qy={key:"empty",class:"leaderboard-empty"},Ky={key:0,class:"gift-toast"},$y={key:0},Zy={key:0,class:"special-announcement"},Jy={class:"machine-status"},Qy={key:0},jy={key:0,class:"final-podium"},e1={class:"final-kicker"},t1={class:"final-winners"},n1={key:0},i1=["title"],s1={key:0},r1={key:0,class:"final-empty"},a1=$u({__name:"CoinPusherGame",setup(i){const e=ft(null),t=ft(null),n=ft(yf()),s=Pf([]),r=ft("playing"),a=ft(n.value.roundDurationMinutes*6e4),o=ft(null),l=ft(!1),c=ft(!1),h=ft(0),f=ft(0),d=ft(0),u=ft(0),m=ft(0),x=ft(0),v=ft(0),g=ft(!1),y=ft(0),E=ft(n.value.sideLossEnabled?0:1),M=ft(1),T=ft(0),w=ft(""),R=ft(!1),_=ft(!1),b=ft("PIÈCES"),P=ft(0),L=ft(!1),B=ft("rolling"),Y=ft("LE DESTIN TOURNE"),p=ft("Le dé choisit votre effet…"),C=ft("#c084fc"),D=[],U=[],O=[],F=[],G=new Map,Z=new Map,ae=new Set,Te=[],qe=new Map,Re=new Map,j=[],pe=new Set;let de=gh(kn*n.value.coinScale),De=0,ze=0;const ke=[];let et=null,He=null,re="",le=null,he="",ce=!1,ue=0,_e=0,ge=null;const Fe=up(),We=gn(()=>[...s.value].sort((V,X)=>X.points-V.points||X.coinsScored-V.coinsScored||V.name.localeCompare(X.name)).slice(0,n.value.topN)),k=gn(()=>We.value.slice(0,n.value.topN)),it=gn(()=>n.value.theme===Lf),Qe=gn(()=>gp(n.value.scoreSlots,n.value.coinScale)),I=gn(()=>!n.value.sideLossEnabled||y.value>0||R.value),S=gn(()=>!n.value.sideLossEnabled||E.value>=.55),W=gn(()=>{const V=Math.max(0,Math.ceil(a.value/1e3)),X=Math.floor(V/60),Q=V%60;return`${String(X).padStart(2,"0")}:${String(Q).padStart(2,"0")}`}),$=gn(()=>_.value?"POUSSÉE FINALE":R.value?"POUSSÉE MAX":r.value==="paused"?"PAUSE":r.value==="finished"?"TERMINÉ":"LIVE"),ee=gn(()=>P.value||Math.max(0,Number(o.value?.coinCount)||0)),ve=gn(()=>$a(o.value)),xe=gn(()=>hl(o.value)),te=gn(()=>String(o.value?.gift?.name||"Cadeau")),ne=Ep({muted:c,settings:n,pendingTones:Te}),{resumeAudio:ye,tone:Ne,flushPendingTone:Ae}=ne,{drawLegacyScene:Ee}=bp({fallbackCanvasRef:t,coins:D,particles:O,floatingScores:F,avatarCache:Re,settings:n,isGalacticTheme:it,effectiveScoreSlots:Qe,scoreMultiplier:M,pusherPower:m,sideGuardProgress:E,getPegs:()=>de,getPlinkoImage:()=>le,getPlatformImage:()=>He,getPusherY:()=>Fe.pusherY}),{updateCoins:Ge,updateParticles:Xe,updateFloatingScores:Ze}=Tp({coins:D,particles:O,floatingScores:F,totalSideLosses:d,sideGuardSolid:S,getPegs:()=>de,getPusherY:()=>Fe.pusherY,getPreviousPusherY:()=>Fe.previousPusherY,burst:Dn,tone:Ne,scoreCoin:V=>At(V)}),{updateRound:z,updatePusher:Me,updateFullPush:ie,applyRoundCommand:be,resetRound:we,togglePause:oe}=xp({runtime:Fe,timeRemainingMs:a,settings:n,pusherPower:m,mysteryRevealActive:L,mysteryRevealQueue:j,roundPhase:r,fullPushFinishAfter:_,fullPushActive:R,coins:D,fullPushTargetCoinIds:pe,spawnQueue:U,sideGuardProgress:E,particles:O,floatingScores:F,scoreFrameBatches:G,scoreFramePlayers:ae,playerByViewerId:Z,pendingTones:Te,players:s,totalScoredCoins:h,totalSpawnedCoins:f,totalSideLosses:d,totalDiamondsReceived:u,activeCoinCount:x,queueCoinCount:v,sideGuardSeconds:y,scoreMultiplier:M,scoreMultiplierSeconds:T,specialAnnouncement:w,latestDropPresentedCount:P,resumeAudio:(...V)=>ye(...V),announceSpecial:(...V)=>Ws(...V),spawnCoin:(...V)=>ao(...V),burst:(...V)=>Dn(...V),tone:(...V)=>Ne(...V),flushScoreFrameBatches:(...V)=>rn(...V),cancelMysteryReveals:(...V)=>Ue(...V)}),{triggerMysteryAction:Be,cancelMysteryReveals:Ue}=Sp({runtime:Fe,roundPhase:r,mysteryRevealQueue:j,mysteryRevealActive:L,settings:n,floatingScores:F,scoreMultiplier:M,scoreMultiplierSeconds:T,mysteryRevealPhase:B,mysteryRevealAccent:C,mysteryRevealLabel:Y,mysteryRevealDetail:p,mysteryToneTimers:ke,getScene3d:()=>ge,awardPoints:(...V)=>vt(...V),enqueueSpawnBatch:(...V)=>Nr(...V),activateSideGuard:(...V)=>Vs(...V),tone:(...V)=>Ne(...V),burst:(...V)=>Dn(...V)}),{scoreCoin:At,awardPoints:vt,flushScoreFrameBatches:rn}=Mp({runtime:Fe,effectiveScoreSlots:Qe,scoreMultiplier:M,scoreFrameBatches:G,playerByViewerId:Z,players:s,scoreFramePlayers:ae,totalScoredCoins:h,floatingScores:F,getScene3d:()=>ge,triggerMysteryAction:(...V)=>Be(...V),burst:(...V)=>Dn(...V),tone:(...V)=>Ne(...V)}),{updateSpawnQueue:fn,spawnCoin:ao,enqueueDrop:Ji,enqueueSpawnBatch:Nr}=yp({runtime:Fe,spawnQueue:U,coins:D,settings:n,totalSpawnedCoins:f,roundPhase:r,fullPushFinishAfter:_,seenDropIds:qe,totalDiamondsReceived:u,latestDrop:o,latestDropPresentedCount:P,latestDropObjectLabel:b,latestDropVisible:l,getScene3d:()=>ge,warmAvatar:(...V)=>H(...V),burst:(...V)=>Dn(...V),tone:(...V)=>Ne(...V),activateSideGuard:(...V)=>Vs(...V)});bf(()=>{if(e.value)try{ge=Ay(e.value),g.value=!0}catch(V){ge=null,g.value=!1,console.error("[coin-pusher] WebGL renderer unavailable, using the compatibility renderer.",V)}Fr(n.value.platformImageUrl),A(n.value.plinkoImageUrl),K(),et=new ResizeObserver(K),e.value&&et.observe(e.value),window.addEventListener("storage",qs),window.addEventListener(lh,Xs),window.addEventListener(ch,Ys),window.addEventListener(hh,Ai),window.addEventListener("keydown",$s),lo(),ze=performance.now(),De=requestAnimationFrame(Qi)}),Ef(()=>{cancelAnimationFrame(De),ge?.dispose(),ge=null,et?.disconnect(),window.clearTimeout(Fe.latestDropTimer),window.clearTimeout(Fe.specialAnnouncementTimer),Ue(),window.removeEventListener("storage",qs),window.removeEventListener(lh,Xs),window.removeEventListener(ch,Ys),window.removeEventListener(hh,Ai),window.removeEventListener("keydown",$s),ne.dispose()});function Qi(V){const X=Math.max(0,(V-ze)/1e3),Q=Math.min(.034,X||.016);ze=V,r.value==="playing"||R.value?(r.value==="playing"&&!_.value&&z(Q),oo(Q),R.value?ie(Q):Me(Q),_.value||fn(Q),Ge(Q),rn(),Xe(Q),Ze(Q)):(Xe(Q*.35),Ze(Q*.35)),Ae(V),ue+=Q,ue>=.12&&(ue=0,x.value=D.length,v.value=U.reduce((Se,Ye)=>Se+Ye.remaining,0)),_e+=Q,_e>=10&&(_e=0,J()),$n(V/1e3),De=requestAnimationFrame(Qi)}function oo(V){y.value>0&&(y.value=Math.max(0,y.value-V)),T.value>0&&(T.value=Math.max(0,T.value-V),T.value<=0&&(M.value=1));const X=I.value?1:0,Q=X>E.value?4.8:3.2;E.value+=Math.max(-Q*V,Math.min(Q*V,X-E.value))}function Vs(V,X=!0){n.value.sideLossEnabled&&(y.value=Math.max(y.value,Math.max(1,Number(V)||1)),X&&Ws(`BOUCLIERS LATÉRAUX · ${Math.ceil(y.value)} S`),Dn(ct/2,610,"#67e8f9",34,165),Ne(760,.18,.055,3,"side-guard"))}function Ws(V){w.value=V,window.clearTimeout(Fe.specialAnnouncementTimer),Fe.specialAnnouncementTimer=window.setTimeout(()=>{w.value=""},3400)}function $n(V){if(ge&&g.value)try{ge.render({coins:D,floatingScores:F,machineTheme:n.value.theme,particles:O,platformImageUrl:n.value.platformImageUrl,plinkoImageUrl:n.value.plinkoImageUrl,pegs:de,pusherPower:m.value,pusherY:Fe.pusherY,roundPhase:r.value,scoreMultiplier:M.value,scoreSlots:Qe.value,sideGuardProgress:E.value,sideLossEnabled:n.value.sideLossEnabled,time:V});return}catch(X){console.error("[coin-pusher] WebGL frame failed, switching to the compatibility renderer.",X),ge.dispose(),ge=null,g.value=!1,K()}Ee(V)}function Dn(V,X,Q,Se=10,Ye=90){const Ve=Math.max(0,dp-O.length),Oe=Math.min(160,Math.max(1,Se),Ve);if(!(Oe<=0))for(let ot=0;ot<Oe;ot+=1){const wt=Math.random()*Math.PI*2,Et=Ye*(.35+Math.random()*.75);O.push({color:Q,life:.35+Math.random()*.5,maxLife:.85,radius:1.2+Math.random()*2.3,vx:Math.cos(wt)*Et,vy:Math.sin(wt)*Et-Ye*.12,x:V,y:X})}}function Xs(V){wi(V.detail)}function Ys(V){Ji(V.detail)}function Ai(V){be(V.detail)}function qs(V){if(V.newValue)try{V.key===Tf&&wi(JSON.parse(V.newValue)),V.key===Af&&Ji(JSON.parse(V.newValue)),V.key===wf&&be(JSON.parse(V.newValue))}catch{}}function wi(V){const X=n.value.platformImageUrl,Q=n.value.plinkoImageUrl,Se=n.value.coinScale;if(n.value=Cf(V),Se!==n.value.coinScale){const Ye=n.value.coinScale/Math.max(.01,Se);for(const Ve of D)Ve.radius*=Ye,Ve.phase==="plinko"&&(Ve.x=Math.max(rt+Ve.radius,Math.min(Ct-Ve.radius,Ve.x)));de=gh(kn*n.value.coinScale)}(X!==n.value.platformImageUrl||!He)&&Fr(n.value.platformImageUrl),(Q!==n.value.plinkoImageUrl||!le)&&A(n.value.plinkoImageUrl)}function Ks(){c.value=!c.value,c.value?Te.splice(0):ye()}function $s(V){const X=V.target;X&&["INPUT","TEXTAREA","SELECT"].includes(X.tagName)||(V.code==="Space"&&(V.preventDefault(),oe()),V.key.toLowerCase()==="r"&&we(!0),V.key.toLowerCase()==="m"&&Ks(),V.key.toLowerCase()==="d"&&Ji(Ur(uh,12,dh)))}function lo(){if(ce||!co())return;ce=!0,[{avatarUrl:"https://api.dicebear.com/9.x/adventurer/png?seed=Luna",count:22,name:"LunaNova"},{avatarUrl:"https://api.dicebear.com/9.x/adventurer/png?seed=Max",count:17,name:"MaxPower"},{avatarUrl:"https://api.dicebear.com/9.x/adventurer/png?seed=Yumi",count:14,name:"YumiLive"},{avatarUrl:"https://api.dicebear.com/9.x/adventurer/png?seed=Nico",count:11,name:"NicoRush"}].forEach((X,Q)=>{window.setTimeout(()=>{const Se=Ur(X.name,X.count,X.avatarUrl);if(Ji(Se),Q<3){const Ye=[45,30,18][Q],Ve={avatarUrl:X.avatarUrl,coinsScored:4-Q,lastScore:Q?10:25,name:X.name,points:Ye,rankPulse:Date.now(),username:X.name.toLowerCase(),viewerId:X.name.toLowerCase()};Z.set(Ve.viewerId,Ve),s.value.push(Ve),s.value=[...s.value]}},260+Q*520)})}function Ur(V=uh,X=12,Q=dh){const Se=Date.now();return Sc({avatarUrl:Q,coinCount:X,createdAt:Se,eventId:`demo-${Se}-${Math.random().toString(36).slice(2,7)}`,gift:{cost:Math.max(1,X*10),id:X>=20?"demo-galaxy":"demo-rose",imageUrl:"",name:X>=20?"Galaxy Pulse":"Rose"},name:V,source:"test",username:V.toLowerCase().replace(/\s+/g,"")})}function co(){return typeof window>"u"?!1:new URLSearchParams(window.location.search).get("__visual")==="1"&&["127.0.0.1","localhost","::1"].includes(window.location.hostname)}function Fr(V){const X=String(V||"").trim();if(re=X,!X){He=null;return}const Q=new Image;Q.decoding="async",Q.onload=()=>{re===X&&(He=Q)},Q.onerror=()=>{re===X&&console.warn("[coin-pusher] Platform artwork could not be loaded; keeping the previous texture.")},Q.src=X}function A(V){const X=String(V||"").trim();if(he=X,!X){le=null;return}const Q=new Image;Q.decoding="async",Q.onload=()=>{he===X&&(le=Q)},Q.onerror=()=>{he===X&&console.warn("[coin-pusher] Plinko artwork could not be loaded; keeping the previous texture.")},Q.src=X}function H(V){const X=String(V||"").trim();if(!X||Re.has(X))return;Re.set(X,null),J();const Q=new Image;Q.decoding="async",Q.onload=()=>{Re.has(X)&&Re.set(X,Q)},Q.onerror=()=>{Re.has(X)&&Re.set(X,null)},Q.src=X}function J(){const V=new Set(D.map(Q=>Q.avatarUrl.trim()).filter(Boolean)),X=V.size+64;if(!(Re.size<=X))for(const Q of Re.keys()){if(Re.size<=X)break;V.has(Q)||Re.delete(Q)}}function K(){ge?.resize();const V=t.value;if(!V)return;const X=V.getBoundingClientRect(),Q=Math.max(1,X.width||ct),Se=Math.max(1,X.height||Si),Ye=Math.sqrt(5e6/Math.max(1,Q*Se)),Ve=Math.min(2,Math.max(1.5,window.devicePixelRatio||1),Ye),Oe=Math.round(Q*Ve),ot=Math.round(Se*Ve);V.width!==Oe&&(V.width=Oe),V.height!==ot&&(V.height=ot)}function q(V){return Math.max(0,Number(n.value.winnerPrizePercents[V])||0)}function Ce(V){return If(u.value,q(V))}return(V,X)=>(bt(),Nt("main",{class:ni(["coin-pusher-shell",{"theme-galactic-palace":it.value}]),"data-machine-theme":n.value.theme},[me("section",{class:ni(["coin-pusher-stage",[`is-${r.value}`,{"has-mystery-reveal":L.value,"is-full-push":R.value}]])},[me("canvas",{ref_key:"canvasRef",ref:e,class:ni(["coin-pusher-canvas coin-pusher-webgl",{"is-ready":g.value}]),"aria-label":"Coin Pusher 3D live"},null,2),me("canvas",{ref_key:"fallbackCanvasRef",ref:t,class:ni(["coin-pusher-canvas coin-pusher-fallback",{"is-hidden":g.value}]),width:"540",height:"960","aria-hidden":"true"},null,2),X[13]||(X[13]=me("div",{class:"stage-aurora","aria-hidden":"true"},null,-1)),X[14]||(X[14]=me("div",{class:"stage-vignette","aria-hidden":"true"},null,-1)),X[15]||(X[15]=me("div",{class:"stage-reflection","aria-hidden":"true"},null,-1)),X[16]||(X[16]=me("div",{class:"stage-grain","aria-hidden":"true"},null,-1)),me("header",Cy,[me("div",Ry,[me("span",Py,[mn(dt(uo),{size:18})]),me("div",null,[me("small",null,nt(it.value?"SHENPULSE CELESTIAL":"SHENPULSE ARCADE"),1),X[3]||(X[3]=me("strong",null,"COIN PUSHER",-1))])]),me("div",{class:ni(["round-timer",{paused:r.value==="paused",finished:r.value==="finished"||_.value}])},[me("span",null,[X[4]||(X[4]=me("i",null,null,-1)),ti(nt($.value),1)]),me("strong",null,nt(W.value),1)],2),me("div",Iy,[me("button",{type:"button",disabled:_.value,title:r.value==="playing"?"Mettre en pause":"Reprendre",onClick:X[0]||(X[0]=(...Q)=>dt(oe)&&dt(oe)(...Q))},[r.value==="playing"?(bt(),lr(dt(Ff),{key:0,size:15})):(bt(),lr(dt(Df),{key:1,size:15}))],8,Ly),me("button",{type:"button",title:"Recommencer la manche",onClick:X[1]||(X[1]=Q=>dt(we)(!0))},[mn(dt(fh),{size:15})]),me("button",{type:"button",title:c.value?"Activer le son":"Couper le son",onClick:Ks},[c.value?(bt(),lr(dt(Nf),{key:0,size:15})):(bt(),lr(dt(Uf),{key:1,size:15}))],8,Dy)])]),me("div",Ny,[X[5]||(X[5]=me("i",null,null,-1)),ti(" "+nt(it.value?"PALACE 3D":"3D REALTIME"),1)]),y.value>0||T.value>0?(bt(),Nt("div",Uy,[y.value>0?(bt(),Nt("span",Fy," BOUCLIERS "+nt(Math.ceil(y.value))+" S ",1)):Jt("",!0),T.value>0?(bt(),Nt("span",Oy," SCORE ×"+nt(dt(ld)(M.value))+" · "+nt(Math.ceil(T.value))+" S ",1)):Jt("",!0)])):Jt("",!0),me("aside",{class:ni(["leaderboard-panel",{"is-empty":!We.value.length}]),"aria-label":"Classement Coin Pusher"},[me("header",null,[me("span",null,[mn(dt(ph),{size:14}),ti(" TOP "+nt(n.value.topN),1)]),me("div",By,[X[6]||(X[6]=me("small",null,"CAGNOTTE LIVE",-1)),me("strong",null,"💎 "+nt(dt(ts)(u.value)),1)])]),mn(Rf,{name:"rank",tag:"div",class:"leaderboard-list"},{default:cr(()=>[(bt(!0),Nt(nl,null,il(We.value,(Q,Se)=>(bt(),Nt("article",{key:Q.viewerId,class:ni(["leaderboard-row",[`rank-${Se+1}`,{pulse:Date.now()-Q.rankPulse<1100}]]),"aria-label":`${Se+1}. ${Q.name}, ${dt(ts)(Q.points)} points`},[me("b",null,nt(Se+1),1),me("span",{class:"leaderboard-avatar",style:mr(dt(bh)(Q))},[Q.avatarUrl?Jt("",!0):(bt(),Nt("em",Gy,nt(dt(ya)(Q.name)),1))],4),me("span",zy,[me("strong",{title:Q.name,dir:"auto"},nt(Q.name),9,Hy),me("small",{title:dt(yh)(Q),dir:"ltr"},nt(dt(yh)(Q)),9,Vy)]),me("span",Wy,[me("span",Xy,[me("strong",null,nt(dt(ts)(Q.points)),1),X[7]||(X[7]=me("small",null,"POINTS",-1))]),q(Se)>0?(bt(),Nt("span",Yy,[me("strong",null,nt(dt(ts)(Ce(Se)))+" 💎",1),me("small",null,nt(dt(Mh)(q(Se)))+"% DU LIVE",1)])):Jt("",!0)])],10,ky))),128)),We.value.length?Jt("",!0):(bt(),Nt("div",qy,[mn(dt(uo),{size:16}),X[8]||(X[8]=me("span",null,[ti("Le podium se joue"),me("br"),ti("dans les cases")],-1))]))]),_:1})],2),mn(_a,{name:"gift"},{default:cr(()=>[o.value&&l.value?(bt(),Nt("article",Ky,[me("span",{class:"gift-avatar",style:mr(xe.value?{backgroundImage:`url(${xe.value})`}:void 0)},[xe.value?Jt("",!0):(bt(),Nt("em",$y,nt(dt(ya)(ve.value)),1))],4),me("span",null,[me("small",null,nt(te.value),1),me("strong",null,nt(ve.value),1)]),me("b",null,"+"+nt(ee.value),1),me("em",null,nt(b.value),1)])):Jt("",!0)]),_:1}),mn(_a,{name:"special"},{default:cr(()=>[w.value?(bt(),Nt("div",Zy,[mn(dt(uo),{size:15}),me("span",null,nt(w.value),1)])):Jt("",!0)]),_:1}),mn(Np,{accent:C.value,active:L.value,detail:p.value,label:Y.value,phase:B.value},null,8,["accent","active","detail","label","phase"]),me("div",Jy,[me("span",null,[X[9]||(X[9]=me("i",{class:"status-dot"},null,-1)),ti(nt(x.value)+" EN JEU",1)]),me("span",null,nt(v.value)+" EN FILE",1),me("span",null,nt(h.value)+" SCORES",1),n.value.sideLossEnabled?(bt(),Nt("span",Qy,nt(d.value)+" PERDUES",1)):Jt("",!0)]),mn(_a,{name:"podium"},{default:cr(()=>[r.value==="finished"?(bt(),Nt("section",jy,[me("span",e1,[mn(dt(ph),{size:18}),X[10]||(X[10]=ti(" MANCHE TERMINÉE",-1))]),X[12]||(X[12]=me("h1",null,"Hall of fame",-1)),me("p",null," Classement calculé uniquement avec les points des cases · cagnotte finale "+nt(dt(ts)(u.value))+" 💎 ",1),me("div",t1,[(bt(!0),Nt(nl,null,il(k.value,(Q,Se)=>(bt(),Nt("article",{key:Q.viewerId,class:ni(`winner-${Se+1}`)},[me("b",null,nt(Se+1),1),me("span",{class:"final-avatar",style:mr(dt(bh)(Q))},[Q.avatarUrl?Jt("",!0):(bt(),Nt("em",n1,nt(dt(ya)(Q.name)),1))],4),me("span",null,[me("strong",{title:Q.name,dir:"auto"},nt(Q.name),9,i1),me("small",null,nt(Q.points)+" points",1),q(Se)>0?(bt(),Nt("em",s1,nt(dt(Mh)(q(Se)))+"% · "+nt(dt(ts)(Ce(Se)))+" 💎 ",1)):Jt("",!0)])],2))),128)),k.value.length?Jt("",!0):(bt(),Nt("div",r1,"Aucun jeton n’a encore marqué."))]),me("button",{type:"button",onClick:X[2]||(X[2]=Q=>dt(we)(!0))},[mn(dt(fh),{size:17}),X[11]||(X[11]=ti(" Nouvelle manche ",-1))])])):Jt("",!0)]),_:1})],2)],10,wy))}}),u1=Zu(a1,[["__scopeId","data-v-719011c1"]]);export{u1 as default};
