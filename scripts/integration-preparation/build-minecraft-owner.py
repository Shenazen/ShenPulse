"""Prepare authorized mode logic and fresh arenas; never start a Minecraft server here."""
import hashlib,importlib.util,json,pathlib,re,subprocess,tempfile,zipfile
ROOT=pathlib.Path(__file__).resolve().parents[2];C=ROOT/'.artifacts/integration-wave-20261029';JAVA=pathlib.Path('C:/Program Files/Amazon Corretto/jdk21.0.8_9/bin');SOURCE=ROOT/'scripts/integration-preparation/minecraft'
spec=importlib.util.spec_from_file_location('common',ROOT/'scripts/integration-preparation/build-script-games.py');common=importlib.util.module_from_spec(spec);spec.loader.exec_module(common)
def body(source,name,value):
 match=re.search(r'\b(?:public|private|protected)\s+(?:static\s+)?[^\n{;]*?\b'+re.escape(name)+r'\s*\([^)]*\)[^{]*\{',source)
 if not match:raise ValueError('Method missing '+name)
 start=match.end();i=start;depth=1;state='code'
 while i<len(source) and depth:
  char=source[i];next=source[i:i+2]
  if state=='string' or state=='char':
   if char=='\\':i+=2;continue
   if char==('"' if state=='string' else "'"):state='code'
  elif state=='line':
   if char=='\n':state='code'
  elif state=='block':
   if next=='*/':state='code';i+=2;continue
  elif next=='//':state='line';i+=2;continue
  elif next=='/*':state='block';i+=2;continue
  elif char=='"':state='string'
  elif char=="'":state='char'
  elif char=='{':depth+=1
  elif char=='}':depth-=1
  i+=1
 if depth:raise ValueError('Invalid Java body '+name)
 return source[:start]+'\n'+value+'\n'+source[i-1:]
def clean(text):return text.replace('fr.synclive','fr.shenpulse').replace('SyncLive','ShenPulse').replace('synclive','shenpulse').replace('SYNC','SHEN').replace('LIVE','PULSE').replace('syncfill','shenfill')
pins=json.loads((ROOT/'scripts/integration-preparation/minecraft-inputs.json').read_text())['files']
for name,expected in pins.items():
 if common.digest((C/name).read_bytes())!=expected:raise ValueError('Minecraft source changed: '+name)
libs=list((C/'box-cyber/libraries').rglob('*.jar'));classpath=';'.join(str(p) for p in libs)
# Shared server runtime includes only engine jars, never worlds, players, logs or old account configuration.
serverFiles={'paper.jar':(C/'box-cyber/paper.jar').read_bytes()}
for sub in ['libraries','versions']:
 for f in (C/'box-cyber'/sub).rglob('*.jar'):serverFiles[f.relative_to(C/'box-cyber').as_posix()]=f.read_bytes()
serverData=common.zip_bytes(serverFiles);serverName='minecraft-paper-1.20.4.zip';serverKey='installer-assets/common/minecraft-paper/1.20.4/'+serverName;serverBuild=ROOT/'.artifacts/game-pack-builds/minecraft-owner-runtime/1.20.4';serverBuild.mkdir(parents=True,exist_ok=True);(serverBuild/serverName).write_bytes(serverData)
serverAsset=dict(gameId='minecraft-owner-runtime',id='minecraft-paper',version='1.20.4',key=serverKey,size=len(serverData),sha256=common.digest(serverData),buildPath=(serverBuild/serverName).relative_to(ROOT).as_posix());registryPath=ROOT/'scripts/manifests/game-packs.json';registry=json.loads(registryPath.read_text());old=next((a for a in registry['assets'] if a['key']==serverKey),None)
if old and old['sha256']!=serverAsset['sha256']:raise ValueError('Shared server input changed')
if not old:registry['assets'].append(serverAsset);registryPath.write_text(json.dumps(registry,indent=2)+'\n')
(serverBuild/'asset.json').write_text(json.dumps(serverAsset,indent=2)+'\n')
with tempfile.TemporaryDirectory(prefix='shenpulse-minecraft-owner-') as tmp:
 stage=pathlib.Path(tmp)
 for game,folder,port,main in [('minecraft-diamond-rush','diamond-sources',25586,'fr.shenpulse.diamondrush.DiamondBridge'),('minecraft-box-cyber','box-cyber-sources',25587,'fr.shenpulse.box.BoxBridge')]:
  src=stage/game/'src';classes=stage/game/'classes';src.mkdir(parents=True);classes.mkdir()
  for f in (C/folder).rglob('*.java'):
   if f.stem in ['SyncLiveLicense','SyncFrameCommand','SyncFrameListener','ImageMapRenderer']:continue
   text=f.read_text(encoding='utf8')
   if f.stem=='DiamondRush':
    text=text.replace('Collection collection =','Collection<? extends Player> collection =').replace('PersistentDataType.BYTE, (Object)1','PersistentDataType.BYTE, (byte)1')
    text=text.replace('import fr.synclive.diamondrush.SyncLiveLicense;','').replace('!SyncLiveLicense.verify(this)','false').replace('!SyncLiveLicense.verify(DiamondRush.this)','false')
    text=body(text,'startWebServer','');text=body(text,'onChunkLoad','')
    start=text.index('public void onJoin(');end=text.index('public void onRespawn(',start);part=text[start:end].replace('this.totalDiamonds = 0;','').replace('this.totalWins = 0;','').replace('playerJoinEvent.getPlayer().setOp(true);','');text=text[:start]+part+text[end:]
   if f.stem=='SyncLiveBox':
    text=text.replace('import fr.synclive.box.SyncFrameCommand;','').replace('import fr.synclive.box.SyncFrameListener;','');start=text.index('        SyncFrameListener syncFrameListener');end=text.index('        PrisonManager prisonManager',start);text=text[:start]+text[end:]
   if f.stem=='PlayerJoinListener':
    start=text.index('        try {');end=text.index('        ItemStack itemStack',start);text=text[:start]+text[end:];text=text.replace('player.setOp(true);','');text=re.sub(r'    private static final String RESOURCE_PACK_(URL|HASH) = .*?;\n', '', text);text=re.sub(r'^        this.plugin.getLogger\(\).info\(\"Tentative.*?\n', '', text, flags=re.M)
   if f.stem=='WinCountdownManager':text=body(text,'addWinToAPI','this.plugin.getLogger().info("SHENPULSE_WIN_COUNTER current="+this.winCount+" source=auto-win");')
   if f.stem=='FillCommand':text=text.replace('n2 = n3;', 'final int fillIndex = n3;').replace('arrayList.get(n2)', 'arrayList.get(fillIndex)')
   if f.stem=='WinCountdownManager':text=text.replace('private int winCount = 0;', 'private int winCount = 0; private int shenMultiplier = 1;').replace('++this.winCount;', 'this.winCount += this.shenMultiplier;')
   if f.stem=='ConfigManager':
    for name,value in [('getApiBaseUrl','return "";'),('getAutowinId','return null;'),('getAutowinToken','return null;'),('hasAutowinConfig','return false;')]:text=body(text,name,value)
   text=clean(text);name=clean(f.name);(src/name).write_text(text,encoding='utf8')
  wrapper='DiamondBridge.java' if folder=='diamond-sources' else 'BoxBridge.java';(src/wrapper).write_text((SOURCE/wrapper).read_text(),encoding='utf8')
  args=['-proc:none','-encoding','UTF-8','-classpath',classpath,'-d',str(classes)]+[str(p) for p in src.glob('*.java')];rsp=stage/(game+'.rsp');rsp.write_text('\n'.join('"'+a.replace('\\','/')+'"' for a in args),encoding='utf8');result=subprocess.run([str(JAVA/'javac.exe'),'@'+str(rsp)],capture_output=True,text=True,encoding='utf8')
  if result.returncode:raise ValueError(result.stderr[:5000])
  commands=['diamondrush','shenpulse_dr'] if folder=='diamond-sources' else ['shenpulse_box','shenfill','sendtitle','fusee','prison1','noprison1','prison2','noprison2','step1','step2','step3','step4','step5','reset']
  plugin='ShenPulse-DiamondRush' if folder=='diamond-sources' else 'ShenPulse-BoxCyber';descriptor='name: '+plugin+'\nversion: 1.0.0\nmain: '+main+'\napi-version: "1.20"\nauthor: ShenPulse\ncommands:\n'+''.join('  '+name+':\n    description: Commande locale ShenPulse\n' for name in commands)
  jarFiles={f.relative_to(classes).as_posix():f.read_bytes() for f in classes.rglob('*.class')};jarFiles['plugin.yml']=descriptor.encode();jarFiles['config.yml']=("total-diamonds: 0\ntotal-wins: 0\ndiamond-goal: 3000\nwin-goal: 15\n" if folder=='diamond-sources' else "box:\n  min-x: -4\n  max-x: 4\n  min-y: 15\n  max-y: 29\n  min-z: -26\n  max-z: -18\n  countdown-duration: 15\n").encode()
  module='plugins/'+plugin+'.jar';files={module:common.zip_bytes(jarFiles)}
  files['server.properties']=('server-ip=127.0.0.1\nserver-port='+str(port)+'\nonline-mode=true\nmax-players=4\nview-distance=4\nsimulation-distance=4\nspawn-protection=0\nallow-flight=true\nlevel-type=minecraft:flat\ngenerate-structures=false\nlevel-name=world\ngamemode='+('survival' if folder=='diamond-sources' else 'creative')+'\ndifficulty=normal\nmotd=ShenPulse - '+plugin+'\nenable-rcon=false\n').encode()
  common.publish_record(game,files,module,58834 if folder=='diamond-sources' else 58835,dict(managedTarget=True,nativeWinCommand='shenpulse_dr' if folder=='diamond-sources' else 'shenpulse_box',minecraftVersion='1.20.4',minecraftServer=dict(serverJar='paper.jar',javaDirectory='runtime/java',port=port,xms='512M',xmx='1536M',creativeMode=folder!='diamond-sources'),requiresMinecraftEula=True,executables=[],launchExecutables=[],requireLaunchExecutable=False),version='1.0.1')
  p=ROOT/'resources/catalogs/owner-prepared-modules.json';records=json.loads(p.read_text());java=json.loads(subprocess.check_output(['node','-e',"console.log(JSON.stringify(require('./src/main/game-installers/minecraft-sandbox-3').assets.find(a=>a.id==='java')))"],cwd=ROOT,text=True));records[game]['additionalAssets']=[dict(id='minecraft-paper',fileName=serverName,action='extract',url='https://f003.backblazeb2.com/file/shenpulse-media/'+serverKey,size=len(serverData),sha256=common.digest(serverData)),java];p.write_text(json.dumps(records,indent=2)+'\n')
