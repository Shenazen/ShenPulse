"use strict";

const { contextBridge, ipcRenderer } = require("electron");
const channel = process.argv.find((value) => value.startsWith("--shenpulse-vision-channel="))?.split("=")[1] || "";
if (/^shenpulse-vision-[a-f0-9-]{36}$/.test(channel)) {
  contextBridge.exposeInMainWorld("shenPulseVision", {
    frame: (payload) => ipcRenderer.invoke(`${channel}:frame`, payload),
    status: (payload) => ipcRenderer.invoke(`${channel}:status`, payload),
    onStop: (callback) => {
      if (typeof callback !== "function") return;
      ipcRenderer.once(`${channel}:stop`, () => callback());
    }
  });
}
