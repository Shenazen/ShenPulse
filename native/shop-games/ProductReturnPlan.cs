using System;
using System.Collections.Generic;
using System.Linq;
namespace ShenPulse.ShopGames {
 internal static class ProductReturnPlan {
  internal sealed class Slot { public long key; public int product, count, capacity; }
  internal sealed class Item { public long key; public int product; }
  internal sealed class Batch { public long slot; public int product, before; public long[] items; }
  public static Batch[] Build(IEnumerable<Slot> slots,IEnumerable<Item> items) {
   var queues=new Dictionary<int,Queue<long>>();var seen=new HashSet<long>();
   foreach(var item in items)if(item.product>0&&seen.Add(item.key)){Queue<long> queue;if(!queues.TryGetValue(item.product,out queue))queues[item.product]=queue=new Queue<long>();queue.Enqueue(item.key);}
   var result=new List<Batch>();var usedSlots=new HashSet<long>();
   foreach(var slot in slots){Queue<long> queue;if(!usedSlots.Add(slot.key)||slot.count<0||slot.capacity<=slot.count||!queues.TryGetValue(slot.product,out queue))continue;
    int amount=Math.Min(queue.Count,slot.capacity-slot.count);if(amount==0)continue;var selected=new long[amount];for(int n=0;n<amount;n++)selected[n]=queue.Dequeue();
    result.Add(new Batch{slot=slot.key,product=slot.product,before=slot.count,items=selected});
   }return result.ToArray();
  }
 }
}
