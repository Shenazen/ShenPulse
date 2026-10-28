"use strict";
const MAGIC=0xfab11baf;
/** IL2CPP v38/39: rewrite literal bytes and their offset table, preserving all tokens. */
function rewriteLiterals(source,replace){
 const input=Buffer.from(source);if(input.readUInt32LE(0)!==MAGIC||![38,39].includes(input.readUInt32LE(4)))throw Error('Métadonnées Unity non prises en charge.');
 const tableOffset=input.readUInt32LE(8),tableSize=input.readUInt32LE(12),offset=input.readUInt32LE(20),size=input.readUInt32LE(24),headerSize=tableOffset;
 if((headerSize-8)%12||tableSize%4||offset!==tableOffset+tableSize||offset+size>input.length)throw Error('Structure des métadonnées Unity invalide.');
 const lengths=[],chunks=[],positions=[],count=tableSize/4-1;let total=0,changed=0;
 for(let i=0;i<count;i++){const from=input.readUInt32LE(tableOffset+i*4),to=input.readUInt32LE(tableOffset+(i+1)*4);if(to<from||to>size)throw Error('Littéral Unity invalide.');const value=input.toString('utf8',offset+from,offset+to),next=replace(value,i);if(typeof next!=='string')throw Error('Remplacement Unity invalide.');const bytes=Buffer.from(next,'utf8');positions.push(total);chunks.push(bytes);lengths.push(bytes.length);total+=bytes.length;if(next!==value)changed++;}
 const data=Buffer.concat(chunks),delta=data.length-size,output=Buffer.concat([input.subarray(0,offset),data,input.subarray(offset+size)]);let cursor=0;
 for(let i=0;i<=count;i++){output.writeUInt32LE(cursor,tableOffset+i*4);if(i<count)cursor+=lengths[i];}
 for(let p=8;p<headerSize;p+=12){const oldOffset=input.readUInt32LE(p);if(oldOffset>=offset+size&&oldOffset)output.writeUInt32LE(oldOffset+delta,p);}
 output.writeUInt32LE(data.length,24);
 return {buffer:output,changed,positions:positions.map(p=>offset+p),count};
}
function replaceEqualBytes(buffer,from,to){
 const old=Buffer.from(from),next=Buffer.from(to);if(old.length!==next.length)throw Error('Le remplacement binaire doit conserver sa taille.');let count=0,p=0;
 while((p=buffer.indexOf(old,p))!==-1){next.copy(buffer,p);p+=old.length;count++;}return count;
}
module.exports={rewriteLiterals,replaceEqualBytes};
