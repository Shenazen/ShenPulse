"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const { pathToFileURL } = require("node:url");
const { appPermissionAllowed } = require("../src/main/app-permissions");
const rendererDirectory = path.resolve(__dirname,"../src/renderer");
const mainUrl = pathToFileURL(path.join(rendererDirectory,"index.html")).href;
const request = {rendererDirectory, requestingUrl:mainUrl, contentsUrl:mainUrl,isMainFrame:true,authenticated:true,overlayPort:17654};
test("MIDI is scoped to authenticated main document and never allows sysex, camera or iframe hardware",()=>{
  assert.equal(appPermissionAllowed({...request,permission:"midi"}),true);
  for(const permission of ["midiSysex","media","hid","serial","usb"]) assert.equal(appPermissionAllowed({...request,permission}),false);
  assert.equal(appPermissionAllowed({...request,permission:"midi",authenticated:false}),false);
  assert.equal(appPermissionAllowed({...request,permission:"midi",isMainFrame:false}),false);
  assert.equal(appPermissionAllowed({...request,permission:"midi",requestingUrl:"https://example.com"}),false);
});
test("local preview and renderer can use loopback but remote frames cannot",()=>{
  assert.equal(appPermissionAllowed({...request,permission:"loopback-network",authenticated:false}),true);
  assert.equal(appPermissionAllowed({...request,permission:"loopback-network",requestingUrl:"http://127.0.0.1:17654/overlay/scene",isMainFrame:false}),true);
  assert.equal(appPermissionAllowed({...request,permission:"loopback-network",requestingUrl:"https://example.com",isMainFrame:false}),false);
});
test("local permission paths use Windows file identity and refuse URL suffixes or sibling directories",()=>{
  if (process.platform === "win32") {
    assert.equal(appPermissionAllowed({...request,permission:"midi",requestingUrl:mainUrl.toLowerCase(),contentsUrl:mainUrl.toLowerCase()}),true);
  }
  for (const suffix of ["?remote=true", "#remote"]) {
    assert.equal(appPermissionAllowed({...request,permission:"midi",requestingUrl:mainUrl+suffix}),false);
  }
  const sibling = pathToFileURL(path.join(rendererDirectory + "-untrusted","index.html")).href;
  assert.equal(appPermissionAllowed({...request,permission:"loopback-network",requestingUrl:sibling,contentsUrl:sibling}),false);
});
