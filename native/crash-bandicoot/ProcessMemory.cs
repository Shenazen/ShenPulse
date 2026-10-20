using System;
using System.ComponentModel;
using System.Diagnostics;
using System.Linq;
using System.Runtime.InteropServices;

namespace ShenPulse.Crash
{
    public interface IMemory
    {
        byte[] Read(long offset, int count);
        void Write(long offset, byte[] bytes);
    }

    public sealed class ProcessMemory : IMemory, IDisposable
    {
        private readonly IntPtr handle;
        private readonly long module;
        [DllImport("kernel32.dll", SetLastError = true)] static extern IntPtr OpenProcess(uint access, bool inherit, int pid);
        [DllImport("kernel32.dll", SetLastError = true)] static extern bool ReadProcessMemory(IntPtr process, IntPtr address, byte[] buffer, UIntPtr size, out UIntPtr read);
        [DllImport("kernel32.dll", SetLastError = true)] static extern bool WriteProcessMemory(IntPtr process, IntPtr address, byte[] buffer, UIntPtr size, out UIntPtr written);
        [DllImport("kernel32.dll", SetLastError = true)] static extern bool VirtualProtectEx(IntPtr process, IntPtr address, UIntPtr size, uint protection, out uint old);
        [DllImport("kernel32.dll", SetLastError = true)] static extern bool FlushInstructionCache(IntPtr process, IntPtr address, UIntPtr size);
        [DllImport("kernel32.dll")] static extern bool CloseHandle(IntPtr handle);

        public ProcessMemory(Process process)
        {
            module = process.MainModule.BaseAddress.ToInt64();
            handle = OpenProcess(0x438, false, process.Id);
            if (handle == IntPtr.Zero) throw new Win32Exception(Marshal.GetLastWin32Error());
        }
        // Negative offsets denote absolute pointers resolved from the game's module.
        private IntPtr Address(long offset) { return new IntPtr(offset < 0 ? -offset : checked(module + offset)); }
        public byte[] Read(long offset, int count)
        {
            var bytes = new byte[count]; UIntPtr read;
            if (!ReadProcessMemory(handle, Address(offset), bytes, (UIntPtr)count, out read) || read.ToUInt64() != (ulong)count)
                throw new InvalidOperationException("Mémoire du jeu indisponible. Ouvrez un niveau jouable.");
            return bytes;
        }
        public void Write(long offset, byte[] bytes)
        {
            var address = Address(offset); var size = (UIntPtr)bytes.Length; uint old; UIntPtr written;
            if (!VirtualProtectEx(handle, address, size, 0x40, out old)) throw new Win32Exception(Marshal.GetLastWin32Error());
            try
            {
                if (!WriteProcessMemory(handle, address, bytes, size, out written) || written.ToUInt64() != (ulong)bytes.Length)
                    throw new Win32Exception(Marshal.GetLastWin32Error());
                if (!FlushInstructionCache(handle, address, size)) throw new Win32Exception(Marshal.GetLastWin32Error());
                if (!Read(offset, bytes.Length).SequenceEqual(bytes)) throw new InvalidOperationException("Écriture non confirmée par le jeu.");
            }
            finally
            {
                uint ignored;
                if (!VirtualProtectEx(handle, address, size, old, out ignored)) throw new Win32Exception(Marshal.GetLastWin32Error());
            }
        }
        public void Dispose() { CloseHandle(handle); }
    }
}
