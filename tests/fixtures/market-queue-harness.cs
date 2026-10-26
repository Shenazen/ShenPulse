using System;
using System.Collections.Generic;
using ShenPulse.ShopGames;
class MarketQueueHarness {
 static int checks;
 static void Check(bool value,string message){checks++;if(!value)throw new Exception(message);}
 static int Main(){try{
  var queue=new ViewerSpawnQueue();
  Check(queue.Enqueue(5,"Alice"),"A gift must add all five requested customers.");
  Check(queue.Enqueue(3,"Bob"),"A second donor must remain in the queue.");
  Check(queue.Count==8&&queue.Viewer=="Alice","A failed native spawn must leave the first customer and donor intact.");
  for(int n=0;n<5;n++){Check(queue.Viewer=="Alice","All customers from the first gift must keep Alice.");queue.Spawned();}
  Check(queue.Count==3&&queue.Viewer=="Bob","Donors must retain FIFO order after a busy game pool.");
  for(int n=0;n<3;n++)queue.Spawned();
  Check(queue.Count==0&&queue.Viewer==null,"The completed queue must be empty.");
  Check(!queue.Enqueue(0,"Invalid")&&!queue.Enqueue(-1,"Invalid"),"Invalid counts must never consume capacity.");
  Check(queue.Enqueue(ViewerSpawnQueue.Maximum,"Élodie 🛒"),"A large burst must retain its donor without per-customer name allocation.");
  Check(!queue.Enqueue(1,"Overflow")&&queue.Count==ViewerSpawnQueue.Maximum,"Overflow must be refused atomically, without losing earlier customers.");
  queue.Spawned();Check(queue.Enqueue(1,"Last")&&queue.Count==ViewerSpawnQueue.Maximum,"Completed customers must release queue capacity.");
  for(int n=1;n<ViewerSpawnQueue.Maximum;n++)queue.Spawned();
  Check(queue.Viewer=="Last","The donor of a later gift must remain distinct after a full burst.");
  queue.Clear();Check(queue.Count==0&&queue.Viewer==null,"Changing saves must discard obsolete customers and donors.");
  double now=0;float scale=1;int ended=0;
  var timers=new TemporaryEffects(()=>now,key=>ended++,(key,e)=>{throw e;});
  timers.Run("time",20,()=>scale=.5f,()=>scale=1);
  now=19;timers.Run("time",120,()=>scale=2,()=>scale=.5f);
  Check(scale==2&&timers.Remaining("time")==1,"Opposing gifts must replace the factor without extending the real deadline.");
  now=20;timers.Tick();Check(scale==1&&ended==1,"Speed must restore its first baseline after twenty real seconds.");
  bool lights=false;timers.Run("lights",20,()=>lights=false,()=>lights=false);timers.Reset();Check(!lights,"An already dark store must remain dark after reset.");
  bool hidden=false;timers.Run("math",20,()=>hidden=true,()=>hidden=false);timers.Reset();Check(!hidden,"Reset must reveal the change display again.");
  var contracts=new List<int>{105,7,42,105};var active=new HashSet<int>{105,7,42};
  int dismissed=EmployeeOperations.Dismiss(contracts,id=>{active.Remove(id);contracts.RemoveAll(x=>x==id);},id=>active.Contains(id));
  Check(dismissed==3&&contracts.Count==0,"Dismissal must handle non-contiguous IDs and mutation of the native contract list.");
  dismissed=EmployeeOperations.Dismiss(new[]{999},id=>{},id=>true);Check(dismissed==0,"A rejected native dismissal must not be counted as success.");
  dismissed=EmployeeOperations.Dismiss(new int[0],id=>{throw new Exception();},id=>true);Check(dismissed==0,"An empty employee category must be harmless.");
  var plan=ProductReturnPlan.Build(new[]{new ProductReturnPlan.Slot{key=1,product=10,count=2,capacity=4},new ProductReturnPlan.Slot{key=2,product=10,count=0,capacity=2}},new[]{new ProductReturnPlan.Item{key=101,product=10},new ProductReturnPlan.Item{key=101,product=10},new ProductReturnPlan.Item{key=102,product=10},new ProductReturnPlan.Item{key=103,product=10},new ProductReturnPlan.Item{key=104,product=10},new ProductReturnPlan.Item{key=105,product=10}});
  Check(plan.Length==2&&plan[0].items.Length==2&&plan[1].items.Length==2,"Restocking must preserve per-slot capacity and exclude duplicate loose objects.");
  var used=new HashSet<long>();foreach(var batch in plan)foreach(long key in batch.items)Check(used.Add(key),"A loose object must never be returned twice.");
  Check(!used.Contains(105),"Overflow must remain on the floor rather than disappear.");
  plan=ProductReturnPlan.Build(new[]{new ProductReturnPlan.Slot{key=1,product=10,count=4,capacity=4}},new[]{new ProductReturnPlan.Item{key=106,product=99}});
  Check(plan.Length==0,"Unmatched products and full slots must be preserved.");
  Check(MarketTime.AdvanceElapsed(0,46800)==7200,"A new day must advance by two hours.");
  Check(MarketTime.AdvanceElapsed(14400,46800)==21600,"Advancement must preserve elapsed time.");
  Check(MarketTime.AdvanceElapsed(43200,46800)==46800,"Advancement must stop at the native end of day.");
  Check(MarketTime.AdvanceElapsed(46800,46800)==46800,"An ended day must not wrap or rewind.");
  Check(MarketTime.SecondsOfDay(0,8)==28800,"The day must start at the native configured hour.");
  Check(MarketTime.SecondsOfDay(14400,8)==43200,"Noon must retain its absolute time.");
  Check(MarketTime.SecondsOfDay(28800,8)==57600,"The afternoon must not return to morning.");
  Check(MarketTime.SecondsOfDay(3600,28800)==32400,"Starting time expressed in seconds must remain supported.");
  Check(MarketTime.SecondsOfDay(55,8)==28855,"Seconds must remain consistent with the elapsed cycle.");
  Console.WriteLine(checks+" Supermarket behavior checks passed");return 0;
 }catch(Exception e){Console.Error.WriteLine(e.Message);return 1;}}
}
