using System;
using System.Collections.Concurrent;
using System.IO;
using System.Net.Sockets;
using System.Text;
using System.Threading;
using System.Threading.Tasks;
using Newtonsoft.Json.Linq;
namespace ShenPulse.LocalGames {
 // Network I/O is isolated; the host game drains requests on its own update thread.
 public sealed class LocalEffectClient : IDisposable {
  public sealed class Request { public JObject Data; internal TcpClient Client; public int Id {get {return (int?)Data["id"]??0;}} public string Code {get{return (string)Data["code"]??"";}} public string Viewer {get{return (string)Data["viewer"]??"ShenPulse";}} public int Number(string key,int fallback,int min,int max) {double value;var raw=Data["parameters"]?[key]??Data[key];return double.TryParse(Convert.ToString(raw,System.Globalization.CultureInfo.InvariantCulture),System.Globalization.NumberStyles.Float,System.Globalization.CultureInfo.InvariantCulture,out value)&&!double.IsNaN(value)&&!double.IsInfinity(value)?(int)Math.Max(min,Math.Min(max,value)):fallback;} }
  readonly ConcurrentQueue<Request> queue=new ConcurrentQueue<Request>(); readonly CancellationTokenSource stop=new CancellationTokenSource(); readonly object sendLock=new object(); readonly int port; TcpClient client;
  public LocalEffectClient(int port){this.port=port; Task.Run((Func<Task>)Connect);}
  public bool Connected {get{return client!=null&&client.Connected;}}
  async Task Connect(){while(!stop.IsCancellationRequested){try{using(var socket=new TcpClient()){client=socket;await socket.ConnectAsync("127.0.0.1",port);socket.NoDelay=true;var data=new byte[4096];using(var frame=new MemoryStream()){var stream=socket.GetStream();while(!stop.IsCancellationRequested){int count=await stream.ReadAsync(data,0,data.Length,stop.Token);if(count==0)break;for(int i=0;i<count;i++){if(data[i]!=0){frame.WriteByte(data[i]);if(frame.Length>1048576)throw new IOException("Oversized local frame");continue;}var text=Encoding.UTF8.GetString(frame.ToArray());frame.SetLength(0);if(text.Length==0)continue;JObject obj;try{obj=JObject.Parse(text);}catch{continue;}var req=new Request{Data=obj,Client=socket};if(queue.Count>=128)Reply(req,3,"La file locale est pleine ; réessayez.");else queue.Enqueue(req);}}}}}catch(Exception){ }finally{client=null;Request old;while(queue.TryDequeue(out old)){} }try{await Task.Delay(750,stop.Token);}catch(OperationCanceledException){} }}
  public void Drain(Action<Request> handle){Request request;for(int i=0;i<8&&queue.TryDequeue(out request);i++){if(request.Client!=client||!Connected)continue;try{handle(request);}catch(Exception ex){Reply(request,1,"Interaction refusée : "+ex.Message);}}}
  public void Reply(Request request,int status,string message){if(request.Client!=client||!Connected)return;var bytes=Encoding.UTF8.GetBytes(new JObject{["id"]=request.Id,["status"]=status,["message"]=message}.ToString(Newtonsoft.Json.Formatting.None)+"\0");try{lock(sendLock)request.Client.GetStream().Write(bytes,0,bytes.Length);}catch(Exception){} }
  public void Dispose(){stop.Cancel();client?.Close();Request old;while(queue.TryDequeue(out old)){} }
 }
}
