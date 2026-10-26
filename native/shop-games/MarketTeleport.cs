using System;
using System.Linq;
using UnityEngine;
using UnityEngine.AI;
namespace ShenPulse.ShopGames {
 internal static class MarketTeleport {
  public static bool Move(FirstPersonController player,bool outside) {
   var controller=player.m_CharacterController;
   if(controller==null)controller=player.GetComponent<CharacterController>();
   var manager=NoktaSingleton<CustomerManager>.Instance;
   var door=manager==null?null:manager.m_StoreDoor;
   var slots=UnityEngine.Object.FindObjectsOfType<DisplaySlot>();
   if(controller==null||door==null||slots.Length==0)return false;
   Vector3 center=Vector3.zero;foreach(var slot in slots)center+=slot.transform.position;center/=slots.Length;
   Vector3 outward=door.position-center;outward.y=0;if(outward.sqrMagnitude<.1f)return false;outward.Normalize();
   Vector3 side=Vector3.Cross(Vector3.up,outward);Vector3 original=controller.transform.position;
   Vector3 scale=controller.transform.lossyScale;float radius=Mathf.Max(.55f,controller.radius*Mathf.Max(Mathf.Abs(scale.x),Mathf.Abs(scale.z)));float height=Mathf.Max(1.8f,Mathf.Max(radius*2,controller.height*Mathf.Abs(scale.y)));
   // Exiger un passage praticable, même si le contrôleur du jeu est très étroit.
   Vector3 centerOffset=Vector3.up*(height*.5f);
   for(int n=0;n<48;n++) {
    Vector3 candidate=door.position+outward*((outside?1:-1)*(1.8f+n%6*.35f))+side*((n/6%7-3)*.4f);
    NavMeshHit hit;if(!NavMesh.SamplePosition(candidate,out hit,2f,NavMesh.AllAreas))continue;
    float halfPlane=Vector3.Dot(hit.position-door.position,outward);
    if(outside?halfPlane<1:halfPlane>-.5f)continue;
    Vector3 target=hit.position+Vector3.up*.12f;
    Vector3 capsuleCenter=target+centerOffset;float half=Mathf.Max(0,height*.5f-radius);
    var blockers=Physics.OverlapCapsule(capsuleCenter+Vector3.up*half,capsuleCenter-Vector3.up*half,radius*.95f,Physics.DefaultRaycastLayers,QueryTriggerInteraction.Ignore);
    if(blockers.Any(c=>c!=controller&&!c.transform.IsChildOf(player.transform)))continue;
    bool enabled=controller.enabled;
    try{controller.enabled=false;controller.transform.position=target;player._verticalVelocity=0;Physics.SyncTransforms();return true;}
    catch{controller.transform.position=original;throw;}
    finally{controller.enabled=enabled;}
   }return false;
  }
 }
}
