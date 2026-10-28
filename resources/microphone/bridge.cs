using System;
using System.Diagnostics;
using System.Collections.Concurrent;
using System.Runtime.InteropServices;
using System.Text;
using System.Threading;

public static class ShenPulseMicBridge {
 [ComImport,Guid("BCDE0395-E52F-467C-8E3D-C4579291692E")] private class Enumerator {}
 [ComImport,Guid("A95664D2-9614-4F35-A746-DE8DB63617E6"),InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
 private interface IDevices {
  [PreserveSig] int EnumAudioEndpoints(int flow,int mask,out IntPtr devices);
  [PreserveSig] int GetDefaultAudioEndpoint(int flow,int role,out IDevice device);
 }
 [ComImport,Guid("D666063F-1587-4E43-81F1-B948E807363F"),InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
 private interface IDevice {
  [PreserveSig] int Activate(ref Guid iid,int context,IntPtr parameters,[MarshalAs(UnmanagedType.Interface)] out IVolume volume);
 }
 [ComImport,Guid("5CDF2C82-841E-4546-9722-0CF74078229A"),InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
 private interface IVolume {
  [PreserveSig] int RegisterControlChangeNotify(IntPtr notify);
  [PreserveSig] int UnregisterControlChangeNotify(IntPtr notify);
  [PreserveSig] int GetChannelCount(out uint count);
  [PreserveSig] int SetMasterVolumeLevel(float level,ref Guid context);
  [PreserveSig] int SetMasterVolumeLevelScalar(float level,ref Guid context);
  [PreserveSig] int GetMasterVolumeLevel(out float level);
  [PreserveSig] int GetMasterVolumeLevelScalar(out float level);
  [PreserveSig] int SetChannelVolumeLevel(uint channel,float level,ref Guid context);
  [PreserveSig] int SetChannelVolumeLevelScalar(uint channel,float level,ref Guid context);
  [PreserveSig] int GetChannelVolumeLevel(uint channel,out float level);
  [PreserveSig] int GetChannelVolumeLevelScalar(uint channel,out float level);
  [PreserveSig] int SetMute([MarshalAs(UnmanagedType.Bool)]bool mute,ref Guid context);
  [PreserveSig] int GetMute([MarshalAs(UnmanagedType.Bool)]out bool mute);
 }
 private static IVolume volume; private static bool owned=false; private static long end=0;
 private static long Now(){return DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();}
 private static void Open(){if(volume!=null)return;var enumerator=(IDevices)new Enumerator();IDevice device;Marshal.ThrowExceptionForHR(enumerator.GetDefaultAudioEndpoint(1,0,out device));var iid=typeof(IVolume).GUID;Marshal.ThrowExceptionForHR(device.Activate(ref iid,23,IntPtr.Zero,out volume));Marshal.ReleaseComObject(device);Marshal.ReleaseComObject(enumerator);}
 private static bool Muted(){bool mute;Marshal.ThrowExceptionForHR(volume.GetMute(out mute));return mute;}
 private static void Set(bool mute){var context=Guid.Empty;Marshal.ThrowExceptionForHR(volume.SetMute(mute,ref context));}
 private static void Release(){try{if(volume!=null&&owned&&Muted())Set(false);}finally{owned=false;end=0;if(volume!=null){Marshal.ReleaseComObject(volume);volume=null;}}}
 public static void Run(){
  Console.OutputEncoding=new UTF8Encoding(false);int parent=int.Parse(Environment.GetEnvironmentVariable("SHENPULSE_MIC_PARENT"));var lines=new BlockingCollection<string>();var reader=new Thread(()=>{try{string line;while((line=Console.In.ReadLine())!=null)lines.Add(line);}finally{lines.CompleteAdding();}});reader.IsBackground=true;reader.Start();
  try{
   while(true){
    try{using(var parentProcess=Process.GetProcessById(parent)){if(parentProcess.HasExited)break;}}catch{break;}
    if(end>0&&(Now()>=end||(owned&&!Muted()))){Release();Console.WriteLine("STATE|0");}
    string line;if(!lines.TryTake(out line,100)){if(lines.IsCompleted)break;continue;}
    var parts=line.Split('|');if(parts.Length!=3)continue;var id=parts[1];
    try{
     if(parts[0]=="PROBE"||parts[0]=="STATUS"){Open();Console.WriteLine("OK|"+id+"|0|"+(Muted()?"1":"0"));if(parts[0]=="PROBE")Release();continue;}
     if(parts[0]=="STOP"){Release();Console.WriteLine("OK|"+id+"|0|0");continue;}
     if(parts[0]=="REDUCE"){int delta;if(!Int32.TryParse(parts[2],out delta)||delta<1||delta>3600)throw new Exception("Invalid microphone duration");if(end>0){end-=delta*1000L;if(end<=Now())Release();}Console.WriteLine("OK|"+id+"|"+end+"|0");continue;}
     int seconds;if(parts[0]!="MUTE"||!Int32.TryParse(parts[2],out seconds)||seconds<1||seconds>3600)throw new Exception("Invalid microphone duration");
     Open();if(end==0)owned=!Muted();Set(true);end=Now()+seconds*1000L;Console.WriteLine("OK|"+id+"|"+end+"|"+(owned?"0":"1"));
    }catch(Exception error){Console.WriteLine("ERROR|"+id+"|"+Convert.ToBase64String(Encoding.UTF8.GetBytes(error.Message)));}
   }
  }finally{Release();}
 }
}
