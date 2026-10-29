#include "runtime.h"
namespace ShenPulse { namespace Koth {
void Menu(){
 static bool open=false,keys[256]{};static int row=0;static std::string status;
 auto pressed=[&](int k){bool down=(GetAsyncKeyState(k)&0x8000)!=0;bool edge=down&&!keys[k];keys[k]=down;return edge;};
 if(pressed(VK_F10)){open=!open;status.clear();}if(!open)return;
 CONTROLS::DISABLE_ALL_CONTROL_ACTIONS(0);CONTROLS::DISABLE_ALL_CONTROL_ACTIONS(2);
 const int count=10;GRAPHICS::DRAW_RECT(0.25f,0.38f,0.40f,0.67f,8,12,30,238);DrawText("SHENPULSE  KOTH",0.25f,0.065f,0.52f,25,225,240);
 std::string rows[]={active?"Retirer la rampe":"Creer la rampe",std::string("Rampe animee : ")+(animated?"OUI":"NON"),"Tester un vehicule / obstacle","Tester un compagnon","Angle : < "+std::to_string(static_cast<int>(ramp.angle))+" degres >","Longueur : < "+std::to_string(sections)+" conteneurs >","Design : < "+std::string(DesignName(design))+" >","Teleportation au sommet","Retour au depart","Fermer"};
 for(int i=0;i<count;i++)DrawText((i==row?"> ":"")+rows[i],0.25f,0.13f+i*0.045f,0.33f,i==row?35:230,i==row?240:230,255);
 DrawText(status.empty()?"Fleches : regler  |  Entree : appliquer  |  F10 : fermer":status,0.25f,0.62f,0.23f,255,220,130);
 if(pressed(VK_UP))row=(row+count-1)%count;if(pressed(VK_DOWN))row=(row+1)%count;
 int direction=pressed(VK_RIGHT)?1:pressed(VK_LEFT)?-1:0;bool enter=pressed(VK_RETURN);
 if(direction||enter){
  float oldAngle=ramp.angle;int oldSections=sections,oldDesign=design;bool oldAnimated=animated;
  if(row==4&&direction)ramp.angle=std::max(5.0f,std::min(60.0f,ramp.angle+direction*5));
  if(row==5&&direction)sections=std::max(5,std::min(95,sections+direction*5));
  if(row==6&&direction)design=(design+5+direction)%5;
  if(row==1){animated=!animated;if(active){Result result=Build();status=result.message;if(result.status)animated=oldAnimated;}else{SaveSettings();status=animated?"Animation activee":"Animation arretee";}}
  else if(row==9&&enter)open=false;
  else if(row==0&&enter){if(active){EndJail();ClearObstacles();ClearRamp();won=true;status="Rampe retiree";}else status=Build().message;}
  else if(row==2&&enter)status=Execute(Request{0,"koth_vehicle_adder",1}).message;
  else if(row==3&&enter)status=Execute(Request{0,"koth_companion",1}).message;
  else if(row==7&&enter){Teleport(true);status="Restez dix secondes au sommet";}
  else if(row==8&&enter){Teleport(false);status="Retour au depart";}
  else if(row>=4&&row<=6){Result result=Build();status=result.message;if(result.status){ramp.angle=oldAngle;sections=oldSections;design=oldDesign;animated=oldAnimated;}}
 }
}
} }
