-- ShenPulse Nova: local file protocol, no cloud connector.
local script=debug.getinfo(1,'S').source:gsub('^@',''):gsub('\\','/')
local root=script:match('^(.*)/[^/]+$') or '.'
local input,output,heartbeat=root..'/request.json',root..'/response.json',root..'/ready.txt'
local abilities={none=0,blaster=1,glider=2,bomb=3,fire=4,firework=5,ice=6,boomerang=7,mirror=8,water=9,fan=10,burger=11}
local ability,ohko,lastid,frames=nil,nil,'',0
local function read(a)return memory.read_u8(a,'System Bus')end
local function write(a,v)memory.write_u8(a,v,'System Bus')end
local function active()
 if emu.getsystemid()~='NES' then return false end
 local hp,bank=read(0x4b),read(0x39e)
 if hp<1 or hp>8 or bank==7 then return false end
 if bank==14 and (read(0x7267)~=0 or (read(0x700)==0x50 and (read(0x716)==9 or read(0x716)==10) and (read(0x396)==0x80 or read(0x396)<10))) then return false end
 return read(0x394)==0 and read(0xa9)==0 and read(0x392)==0 and read(0x3da)==0
end
local function save(file,text)local f=io.open(file,'wb');if f then f:write(text);f:close() end end
local function restoreAbility()if ability then write(0x390,0x80+ability.before);ability=nil end end
local function restoreHealth()if ohko then if read(0x4b)>0 then write(0x4b,ohko.before) end;ohko=nil end end
local function cleanup()restoreAbility();restoreHealth();os.remove(heartbeat);os.remove(input)end
event.onexit(cleanup,'ShenPulse restore')
local function effect(code,duration)
 if not active() then return 3 end
 local hp=read(0x4b)
 if code=='fullheal' then if hp>=8 then return 3 end;write(0x4b,8)
 elseif code=='heal' then if hp>=8 or ohko then return 3 end;write(0x4b,math.min(8,hp+1))
 elseif code=='hurt' then if hp<=1 or ohko then return 3 end;write(0x4b,hp-1)
 elseif code=='kill' then restoreAbility();ohko=nil;write(0x4b,0)
 elseif code=='ohko' then if ohko then return 3 end;ohko={before=hp,untilTime=os.time()+math.max(1,math.min(600,duration>0 and duration/1000 or 15)),level=read(0xa7)};write(0x4b,1)
 else
  local name=code:match('^ability_(.+)$');local value=name and abilities[name]
  if value==nil then return 2 end
  if ability then return 3 end
  ability={before=read(0x7200),value=value,untilTime=os.time()+math.max(1,math.min(600,duration>0 and duration/1000 or 10)),level=read(0xa7)}
  write(0x7200,value);write(0x390,0x80+value)
 end
 return 0
end
while true do
 if frames%30==0 then save(heartbeat,'SHENPULSE NOVA') end
 local now=os.time()
 if ability then if now>=ability.untilTime or read(0xa7)~=ability.level or read(0x4b)==0 then restoreAbility() elseif active() then write(0x7200,ability.value) end end
 if ohko then if now>=ohko.untilTime or read(0xa7)~=ohko.level then restoreHealth() elseif read(0x4b)==0 then ohko=nil elseif active() then write(0x4b,1) end end
 local f=io.open(input,'rb')
 if f then local text=f:read(65537);f:close();if text and #text<=65536 then
  local id=text:match('"id"%s*:%s*"([a-f0-9]+)"');local code=text:match('"code"%s*:%s*"([a-z_]+)"');local duration=tonumber(text:match('"duration"%s*:%s*(%d+)')) or 0
  if id and #id==24 and code and id~=lastid then
   lastid=id;local ok,status=pcall(effect,code,duration);if not ok then status=1 end
   save(output,'{"id":"'..id..'","status":'..status..',"message":"'..(status==0 and 'Interaction appliquee.' or 'Interaction indisponible dans cet etat du jeu.')..'"}')
  end
 end end
 frames=frames+1;emu.frameadvance()
end
