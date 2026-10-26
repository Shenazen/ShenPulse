import ctypes,pathlib,sys
lib=ctypes.CDLL(str(pathlib.Path(sys.argv[1]).resolve()))
lib.luaL_newstate.restype=ctypes.c_void_p
lib.luaL_openlibs.argtypes=[ctypes.c_void_p]
lib.luaL_loadbufferx.argtypes=[ctypes.c_void_p,ctypes.c_char_p,ctypes.c_size_t,ctypes.c_char_p,ctypes.c_char_p]
lib.lua_pcallk.argtypes=[ctypes.c_void_p,ctypes.c_int,ctypes.c_int,ctypes.c_int,ctypes.c_longlong,ctypes.c_void_p]
lib.lua_tolstring.argtypes=[ctypes.c_void_p,ctypes.c_int,ctypes.c_void_p];lib.lua_tolstring.restype=ctypes.c_char_p
lib.lua_close.argtypes=[ctypes.c_void_p]
state=lib.luaL_newstate();lib.luaL_openlibs(state)
try:
 source=pathlib.Path(sys.argv[2]).read_bytes()
 status=lib.luaL_loadbufferx(state,source,len(source),sys.argv[2].encode(),b't')
 if status==0:status=lib.lua_pcallk(state,0,0,0,0,None)
 if status:raise RuntimeError(lib.lua_tolstring(state,-1,None).decode('utf-8','replace'))
finally:lib.lua_close(state)
