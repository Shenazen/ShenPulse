#include "runtime.h"
namespace ShenPulse { namespace Hiking {
static const Point defaultStart{2471.84009f,5129.45117f,47.60053f};
static const std::vector<Point> defaultPoints={
 {2396.51709f,5316.21582f,95.94903f},
 {2311.68994f,5354.26611f,120.45260f},
 {2242.05298f,5382.58203f,144.41600f},
 {2160.61304f,5378.76514f,165.00490f},
 {2034.59302f,5379.47412f,173.69411f},
 {1933.24194f,5393.11523f,186.63499f},
 {1850.42102f,5406.15820f,231.56700f},
 {1786.18994f,5432.70508f,258.42801f},
 {1671.45703f,5469.70898f,316.72400f},
 {1629.51001f,5485.04395f,341.92300f},
 {1543.80005f,5511.85400f,396.01599f},
 {1462.81995f,5534.62598f,441.04001f},
 {1398.00696f,5548.91699f,462.45401f},
 {1313.74695f,5555.66309f,480.08600f},
 {1238.11206f,5561.32910f,503.07001f},
 {1135.98096f,5582.50781f,555.97900f},
 {1074.54797f,5592.93701f,583.56097f},
 {1028.30896f,5609.18994f,603.20801f},
 {924.81799f,5638.76904f,652.26801f},
 {866.39099f,5659.90723f,677.67902f},
 {802.17297f,5690.13086f,696.24799f},
 {677.50598f,5697.33594f,725.95203f},
 {619.28101f,5682.46582f,744.68500f},
 {564.68701f,5658.96094f,765.90399f},
 {528.45898f,5627.68799f,779.29303f},
 {517.20300f,5581.32080f,781.35400f},
 {497.25299f,5559.64795f,782.31702f},
 {484.72699f,5570.30811f,788.56799f},
 {497.11401f,5589.99414f,794.17102f},
 {501.66141f,5604.56494f,797.91058f}
};
void DefaultRoute(){startPoint=defaultStart;route=defaultPoints;}
void SaveRoute(){auto path=SettingsPath(L"hiking-route.ini");auto write=[&](const wchar_t* key,int value){WritePrivateProfileStringW(L"Route",key,std::to_wstring(value).c_str(),path.c_str());};write(L"count",static_cast<int>(route.size()));write(L"allowDriving",allowDriving?1:0);write(L"showCounter",showCounter?1:0);auto point=[&](const std::wstring& key,Point p){std::wstring value=std::to_wstring(p.x)+L","+std::to_wstring(p.y)+L","+std::to_wstring(p.z);WritePrivateProfileStringW(L"Route",key.c_str(),value.c_str(),path.c_str());};point(L"start",startPoint);for(size_t i=0;i<route.size();i++)point(L"point"+std::to_wstring(i),route[i]);}
void LoadRoute(){DefaultRoute();auto path=SettingsPath(L"hiking-route.ini");allowDriving=GetPrivateProfileIntW(L"Route",L"allowDriving",0,path.c_str())!=0;showCounter=GetPrivateProfileIntW(L"Route",L"showCounter",1,path.c_str())!=0;int count=GetPrivateProfileIntW(L"Route",L"count",0,path.c_str());if(count<2||count>100)return;auto read=[&](const std::wstring& key,Point& p){wchar_t value[160];GetPrivateProfileStringW(L"Route",key.c_str(),L"",value,160,path.c_str());return swscanf_s(value,L"%f,%f,%f",&p.x,&p.y,&p.z)==3&&ValidPoint(p);};Point start;std::vector<Point> points;if(!read(L"start",start))return;for(int i=0;i<count;i++){Point p;if(!read(L"point"+std::to_wstring(i),p))return;points.push_back(p);}startPoint=start;route=points;}
} }
