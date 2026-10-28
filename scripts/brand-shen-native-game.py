"""Apply the existing ShenPulse identity to authorized standalone Unity packages."""
import argparse,json,pathlib,struct
import UnityPy
from PIL import Image
parser=argparse.ArgumentParser()
parser.add_argument("--stage",required=True)
args=parser.parse_args()
root=pathlib.Path(args.stage).resolve()
descriptor=json.loads((root/"shenpulse-game.json").read_text(encoding="utf-8"))
data=root/pathlib.Path(descriptor["metadataPath"]).parts[0]
logo=Image.open("resources/overlays/brand/shenpulse-logo.png").convert("RGBA")
icon=Image.open("build/icon.png").convert("RGBA")
file=data/"resources.assets"
env=UnityPy.load(str(file))
changed=[]
for obj in env.objects:
 if obj.type.name!="Texture2D":continue
 texture=obj.read()
 if texture.m_Name not in ["shenlink_lockup","shenlink_symbole"]:continue
 source=(logo if texture.m_Name.endswith("lockup") else icon).copy()
 source.thumbnail((texture.m_Width,texture.m_Height),Image.Resampling.LANCZOS)
 canvas=Image.new("RGBA",(texture.m_Width,texture.m_Height),(0,0,0,0))
 canvas.alpha_composite(source,((texture.m_Width-source.width)//2,(texture.m_Height-source.height)//2))
 texture.image=canvas
 texture.save()
 changed.append(texture.m_Name)
if len(changed)!=2:raise RuntimeError("Les deux logos du jeu n'ont pas été remplacés.")
file.write_bytes(env.file.save())
file=data/"globalgamemanagers"
env=UnityPy.load(str(file))
replaced=0
for obj in env.objects:
 if obj.type.name!="PlayerSettings":continue
 raw=obj.get_raw_data()
 old=b"ShenLive"
 prefix=struct.pack("<I",len(old))+old
 index=raw.find(prefix)
 if index<0:raise RuntimeError("La société du jeu n'a pas été identifiée.")
 new=b"ShenPulse"
 value=struct.pack("<I",len(new))+new+b"\0"*3
 raw=raw[:index]+value+raw[index+len(prefix):]
 obj.set_raw_data(raw)
 replaced+=1
if replaced!=1:raise RuntimeError("Les réglages de l'identité du jeu sont ambigus.")
file.write_bytes(env.file.save())
(root.parent/"brand-report.json").write_text(json.dumps({"id":descriptor["id"],"textures":changed,"company":"ShenPulse"}),encoding="utf-8")
print(json.dumps({"id":descriptor["id"],"textures":changed,"company":"ShenPulse"}))
