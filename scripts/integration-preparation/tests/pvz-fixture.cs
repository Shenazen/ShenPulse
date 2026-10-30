using System;using System.Collections.Generic;using System.Threading;using Newtonsoft.Json.Linq;
namespace MelonLoader {
 [AttributeUsage(AttributeTargets.Assembly)]public class MelonInfoAttribute:Attribute{public MelonInfoAttribute(Type t,string n,string v,string a){}}
 public class TestLogger{public void Warning(string s){}}
 public class MelonMod{public TestLogger LoggerInstance=new TestLogger();public virtual void OnInitializeMelon(){}public virtual void OnUpdate(){}public virtual void OnDeinitializeMelon(){}}
}
namespace Il2Cpp {public static class GameAPP {public static int theGameStatus=0;}}
namespace ShenPulseFusion.Engine {public class Effects {internal Dictionary<string,Action<JObject>> RegisterRoutes(){return new Dictionary<string,Action<JObject>>{["/spawnplant"]=body=>Console.WriteLine("CALL "+body.ToString(Newtonsoft.Json.Formatting.None)),["/broken"]=body=>throw new InvalidOperationException("fixture refusal")};}}}
internal static class Program {static volatile bool running=true;static void Main(){Console.OutputEncoding=new System.Text.UTF8Encoding(false);var bridge=new ShenPulseFusion.Bridge();bridge.OnInitializeMelon();new Thread(()=>{string line;while((line=Console.ReadLine())!=null){if(line=="off")Il2Cpp.GameAPP.theGameStatus=1;if(line=="on")Il2Cpp.GameAPP.theGameStatus=0;if(line=="quit"){running=false;return;}}running=false;}){IsBackground=true}.Start();try{while(running){bridge.OnUpdate();Thread.Sleep(5);}}finally{bridge.OnDeinitializeMelon();}}}
