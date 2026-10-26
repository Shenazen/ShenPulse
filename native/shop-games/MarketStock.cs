using System;
using System.Collections.Generic;
using System.Linq;
using UnityEngine;
using Object=UnityEngine.Object;
namespace ShenPulse.ShopGames {
 internal static class MarketStock {
  private static bool Alive(Object value){return value!=null;}
  private static int Capacity(DisplaySlot slot){var ids=NoktaSingleton<IDManager>.Instance;var product=ids==null?null:ids.ProductSO(slot.ProductID);return product==null||product.GridLayoutInStorage==null?0:product.GridLayoutInStorage.productCount;}
  private static void Rebuild(DisplaySlot slot,int product,int count){
   int before=slot.ProductCount;
   for(int n=0;n<before&&slot.HasProduct;n++){var old=slot.TakeProductFromDisplay();if(!Alive(old))throw new InvalidOperationException("Le jeu n’a pas libéré un produit du rayon.");old.gameObject.SetActive(false);}
   if(slot.HasProduct)throw new InvalidOperationException("Le rayon contient encore des produits.");
   if(count>0)slot.SpawnProduct(product,count);
   if(slot.Data!=null)slot.Data.FirstItemCount=count;
   if(slot.ProductCount!=count)throw new InvalidOperationException("Le stock du rayon n’a pas atteint la quantité demandée.");
  }
  private static void Change(DisplaySlot slot,int count){
   int product=slot.ProductID,before=slot.ProductCount;
   try{Rebuild(slot,product,count);}catch{Rebuild(slot,product,before);throw;}
  }
  private static void Refresh(DisplaySlot slot){slot.SetPriceTag();slot.SetLabel();slot.RequestLabelMaskUpdate();}
  // Le cache utilisé pour les listes d’achat est dérivé du stock réel. Cette
  // reconstruction empêche les incréments fantômes après un rangement répété.
  public static void SyncInventory(){
   var manager=NoktaSingleton<InventoryManager>.Instance;if(manager==null)return;
   var totals=new Il2CppSystem.Collections.Generic.Dictionary<int,int>();
   foreach(var slot in Object.FindObjectsOfType<DisplaySlot>())if(slot.ProductID>0&&slot.ProductCount>0){int id=slot.ProductID;totals[id]=(totals.ContainsKey(id)?totals[id]:0)+slot.ProductCount;}
   manager.m_DisplayedProducts=totals;manager.SetProductsOrderDirty();
  }
  public static int Fill(Func<DisplaySlot,bool> eligible){int changed=0;
   try{foreach(var slot in Object.FindObjectsOfType<DisplaySlot>())if(slot.ProductID>0&&!slot.Full&&eligible(slot)){int capacity=Capacity(slot);if(capacity<=slot.ProductCount)continue;Change(slot,capacity);Refresh(slot);changed++;}return changed;}finally{SyncInventory();}
  }
  public static int Empty(Func<DisplaySlot,bool> eligible){
   var displays=Object.FindObjectsOfType<DisplaySlot>().Where(s=>s.HasProduct&&eligible(s)&&s.Display!=null).Select(s=>s.Display).GroupBy(d=>d.Pointer.ToInt64()).Select(g=>g.First()).ToArray();
   if(displays.Length==0)return 0;var display=displays[UnityEngine.Random.Range(0,displays.Length)];int removed=0;
   try{foreach(var slot in display.DisplaySlots)if(slot.HasProduct){removed+=slot.ProductCount;Change(slot,0);Refresh(slot);}return removed;}finally{SyncInventory();}
  }
  public static int ClearStock(){
   int removed=0;var manager=NoktaSingleton<InventoryManager>.Instance;
   if(manager==null)throw new InvalidOperationException("L’inventaire du magasin est indisponible.");
   try {
    foreach(var slot in Object.FindObjectsOfType<DisplaySlot>())if(slot.HasProduct){removed+=slot.ProductCount;Change(slot,0);Refresh(slot);}
    foreach(var box in Object.FindObjectsOfType<Box>()){
     if(box.Data!=null)manager.RemoveBox(box.Data);
     box.gameObject.SetActive(false);Object.Destroy(box.gameObject);removed++;
    }
    return removed;
   }finally{SyncInventory();}
  }
  public static int ReturnLoose(Func<DisplaySlot,bool> eligible){
   var slots=Object.FindObjectsOfType<DisplaySlot>().Where(s=>s.ProductID>0&&eligible(s)).ToDictionary(s=>s.Pointer.ToInt64());
   var items=Object.FindObjectsOfType<Product>().Where(p=>p.IsDropped&&p.gameObject.activeInHierarchy&&p.ProductSO!=null).ToDictionary(p=>p.Pointer.ToInt64());
   var plan=ProductReturnPlan.Build(slots.Select(p=>new ProductReturnPlan.Slot{key=p.Key,product=p.Value.ProductID,count=p.Value.ProductCount,capacity=Capacity(p.Value)}),items.Select(p=>new ProductReturnPlan.Item{key=p.Key,product=p.Value.ProductSO.ID}));
   int restored=0;
   try{foreach(var batch in plan){var slot=slots[batch.slot];Change(slot,batch.before+batch.items.Length);
     foreach(long key in batch.items){var item=items[key];item.IsDropped=false;item.gameObject.SetActive(false);Object.Destroy(item.gameObject);restored++;}Refresh(slot);
   }return restored;}finally{SyncInventory();}
  }
 }
}
