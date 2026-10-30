using System;
using System.IO;
using System.Linq;
using System.Net;
using System.Net.Sockets;
using System.Collections.Generic;
using System.Collections.Concurrent;
using System.Diagnostics;
using System.Text;
using System.Threading;
using System.Threading.Tasks;
using ConnectorLib.Inject;
using CrowdControl.Common;
using CrowdControl.Games.Packs.PlantsVsZombies;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;

internal sealed class PvzHost : IDisposable {
 static readonly TextWriter Protocol; static PvzHost(){Protocol=Console.Out;}
 readonly ConcurrentDictionary<Guid,TaskCompletionSource<EffectResponse>> pending=new();
 readonly UserRecord player=new("00000000-0000-0000-0000-000000000001","shenpulse","local","ShenPulse","shenpulse");
 readonly object writeLock=new(); readonly CancellationTokenSource stop=new();
 PlantsVsZombies pack; InjectConnector connector; NetworkStream stream;
 public static async Task Main(string[] args){Console.SetOut(TextWriter.Null);using var host=new PvzHost();host.pack=new PlantsVsZombies(host.player,host.Receive,_=>{});
  if(args.Length==1&&args[0]=="--catalog"){Protocol.WriteLine(JsonConvert.SerializeObject(host.pack.Effects.Keys));return;}
  if(args.Length!=1)throw new ArgumentException("Installation requise");
  await host.Run(Path.GetFullPath(args[0]));
 }
 async Task Run(string root){
  // A missing or different game never receives a memory connector.
  _=Task.Run(async()=>{while(!stop.IsCancellationRequested){try{
   bool valid=AllowedProcess(root);
   if(!valid&&connector!=null){pack.StopAllEffects(true);connector.Dispose();connector=null;}
   if(valid&&connector==null){connector=new InjectConnector();pack.GameConnector=connector;await connector.Connect();}
  }catch{try{connector?.Dispose();}catch{}connector=null;}try{await Task.Delay(1000,stop.Token);}catch{break;}}});
  _=Task.Run(()=>{while(Console.ReadLine() is string line)if(line=="stop")break;stop.Cancel();try{stream?.Dispose();}catch{}});
  Protocol.WriteLine("SHENPULSE_PVZ_READY");Protocol.Flush();
  while(!stop.IsCancellationRequested){try{using var tcp=new TcpClient();await tcp.ConnectAsync(IPAddress.Loopback,58836,stop.Token);stream=tcp.GetStream();var bytes=new List<byte>();var chunk=new byte[4096];int n;
   while((n=await stream.ReadAsync(chunk,stop.Token))>0){for(int i=0;i<n;i++){if(chunk[i]!=0){bytes.Add(chunk[i]);if(bytes.Count>65536)throw new InvalidDataException();continue;}if(bytes.Count==0)continue;var frame=JObject.Parse(Encoding.UTF8.GetString(bytes.ToArray()));bytes.Clear();if((int?)frame["type"]==255)continue;await Handle(frame);}}
  }catch{stream=null;if(!stop.IsCancellationRequested)await Task.Delay(500,stop.Token).ContinueWith(_=>{});}}
 }
 static bool AllowedProcess(string root){var all=Process.GetProcessesByName("popcapgame1");try{return all.Length==1&&all.All(p=>Path.GetFullPath(p.MainModule.FileName).StartsWith(root.TrimEnd(Path.DirectorySeparatorChar)+Path.DirectorySeparatorChar,StringComparison.OrdinalIgnoreCase));}catch{return false;}finally{foreach(var p in all)p.Dispose();}}
 async Task Handle(JObject frame){var id=frame["id"];string code=(string)frame["code"]??"";if(!pack.Effects.ContainsKey(code)||pack.Effects[code].Disabled){await Reply(id,2,"Interaction inconnue.");return;}if(connector?.Connected!=true){await Reply(id,3,"Chargez une partie de Plants vs. Zombies GOTY Steam, hors menus.");return;}
  int type=(int?)frame["type"]??1;if(type!=1){await Reply(id,2,"Requête inconnue.");return;}
  var request=new EffectRequest(pack.Effects[code]){Target=player,Origin=player,Viewers=new(){new UserRecord("00000000-0000-0000-0000-000000000002","viewer","local",((string)frame["viewer"]??"Viewer").Substring(0,Math.Min(80,((string)frame["viewer"]??"Viewer").Length)),"viewer")},Quantity=(uint)Math.Max(1,Math.Min(9999,(int?)frame["quantity"]??1)),Free=true,RetryMaxAttempts=0};
  double ms=Math.Max(0,Math.Min(600000,(double?)frame["duration"]??0));if(ms>0)request.Duration=TimeSpan.FromMilliseconds(ms);
  var completion=new TaskCompletionSource<EffectResponse>(TaskCreationOptions.RunContinuationsAsynchronously);pending[request.ID]=completion;
  try{pack.ProcessRequest(request);var response=await completion.Task.WaitAsync(TimeSpan.FromSeconds(10),stop.Token);await Reply(id,response.Status.IsSuccess()?0:3,response.Status.IsSuccess()?"Interaction exécutée.":"Interaction indisponible dans l’état actuel du jeu.");}
  catch{await Reply(id,3,"Le jeu n’a pas confirmé l’interaction.");}finally{pending.TryRemove(request.ID,out _);}
 }
 bool Receive(CrowdControlBlock block){if(block is EffectResponse response&&(response.Status.IsSuccess()||response.Status.IsFailure())&&pending.TryGetValue(response.Request,out var completion))completion.TrySetResult(response);return true;}
 Task Reply(JToken id,int status,string message){var bytes=Encoding.UTF8.GetBytes(new JObject{["id"]=id,["status"]=status,["message"]=message}.ToString(Formatting.None)+"\0");lock(writeLock){stream?.Write(bytes,0,bytes.Length);}return Task.CompletedTask;}
 public void Dispose(){stop.Cancel();try{pack?.StopAllEffects(true);pack?.Dispose();connector?.Dispose();stream?.Dispose();}catch{}stop.Dispose();}
}
