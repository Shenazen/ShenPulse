"use strict";
const fs=require('node:fs'),path=require('node:path'),os=require('node:os');const {lua,lauxlib,lualib,to_luastring,to_jsstring}=require(path.join(os.tmpdir(),'shenpulse-lua-parse-tool/node_modules/fengari'));
const harness=String.raw`local ram={[0x4b]=2,[0x39e]=1,[0xa7]=1,[0x7200]=2};local now,frame=0,0;local request='';local results={};local onexit
debug.getinfo=function()return {source='@C:/fixture/ShenPulseNova/bridge.lua'} end
memory={read_u8=function(a,d)assert(d=='System Bus');return ram[a] or 0 end,write_u8=function(a,v,d)assert(d=='System Bus');ram[a]=v end}
event={onexit=function(f)onexit=f end};os.time=function()return now end;os.remove=function()end
io.open=function(file,mode)if mode=='rb' then return {read=function()return request end,close=function()end} end;return {write=function(_,value)if file:find('response.json',1,true) then table.insert(results,value) end end,close=function()end} end
local function send(code,duration)request='{"id":"'..string.rep('0',22)..string.format('%02d',frame)..'","code":"'..code..'","duration":'..(duration or 0)..'}' end
emu={getsystemid=function()return 'NES' end,frameadvance=function()
 frame=frame+1
 if frame==1 then send('heal') elseif frame==2 then assert(ram[0x4b]==3) -- duplicate must not heal twice
 elseif frame==3 then assert(ram[0x4b]==3);send('ability_ice',1000)
 elseif frame==4 then assert(ram[0x7200]==6 and ram[0x390]==0x86);now=2;request=''
 elseif frame==5 then assert(ram[0x390]==0x82);send('ohko',1000)
 elseif frame==6 then assert(ram[0x4b]==1);now=4;request=''
 elseif frame==7 then assert(ram[0x4b]==3);ram[0x394]=1;send('hurt')
 elseif frame==8 then assert(ram[0x4b]==3);ram[0x394]=0;send('unknown')
 elseif frame==9 then assert(#results==5,"count="..#results.." "..table.concat(results," | "));assert(results[4]:find('"status":3',1,true),results[4]);assert(results[5]:find('"status":2',1,true),results[5]);onexit();error('SHENPULSE_NOVA_OK') end
end}
`;
const state=lauxlib.luaL_newstate();lualib.luaL_openlibs(state);const status=lauxlib.luaL_dostring(state,to_luastring(harness+'\n'+fs.readFileSync(path.join(__dirname,'nova-bridge.lua'),'utf8')));const message=to_jsstring(lua.lua_tostring(state,-1));lua.lua_close(state);if(status===0||!message.includes('SHENPULSE_NOVA_OK'))throw Error(message);console.log('Nova Lua mock: refusals, duplicate delivery, ability and health restoration verified.');
