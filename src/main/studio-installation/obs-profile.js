"use strict";
const fs=require("node:fs"),path=require("node:path"),crypto=require("node:crypto");
function value(text,section,key){const part=text.match(new RegExp("(?:^|\\n)\\["+section+"\\]\\r?\\n([\\s\\S]*?)(?=\\n\\[|$)"));return part?.[1].match(new RegExp("(?:^|\\n)"+key+"=([^\\r\\n]*)"))?.[1]||"";}
function set(text,section,key,entry){const heading="["+section+"]",start=text.indexOf(heading);if(start<0)return text+"\n"+heading+"\n"+key+"="+entry+"\n";const end=text.indexOf("\n[",start+heading.length),stop=end<0?text.length:end;const part=text.slice(start,stop),line=new RegExp("(^|\\n)"+key+"=[^\\r\\n]*");const next=line.test(part)?part.replace(line,(_,before)=>before+key+"="+entry):part.replace(/\s*$/,"\n")+key+"="+entry+"\n";return text.slice(0,start)+next+text.slice(stop);}
function prepareObsProfile(root,id){
 const name="ShenPulse Supermarket "+id,folder=path.join(root,"basic","profiles","ShenPulse_"+id),ini=path.join(folder,"basic.ini");
 let config="";for(const file of ["user.ini","global.ini"]){try{config+="\n"+fs.readFileSync(path.join(root,file),"utf8");}catch{/* First launch. */}}
 const current=value(config,"Basic","ProfileDir"),origin=path.join(root,"basic","profiles",path.basename(current));
 fs.mkdirSync(folder,{recursive:true});
 if(current&&origin!==folder)for(const file of ["basic.ini","service.json","streamEncoder.json","recordEncoder.json"]){const source=path.join(origin,file),target=path.join(folder,file);if(!fs.existsSync(target)&&fs.existsSync(source))fs.copyFileSync(source,target);}
 let text=fs.existsSync(ini)?fs.readFileSync(ini,"utf8"):"";text=set(text,"General","Name",name);for(const [key,entry]of Object.entries({BaseCX:1080,BaseCY:1920,OutputCX:1080,OutputCY:1920}))text=set(text,"Video",key,entry);
 const temporary=ini+"."+crypto.randomUUID()+".tmp";try{fs.writeFileSync(temporary,text,{mode:0o600});fs.renameSync(temporary,ini);}finally{if(fs.existsSync(temporary))fs.unlinkSync(temporary);}
 return name;
}
module.exports={prepareObsProfile,value,set};
