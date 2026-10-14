"use strict";

/** Trace déterministe du contrat Canvas : positions, couleurs, textes et ressources. */
const vm = require("node:vm");
const { createHash } = require("node:crypto");

const styledEntries = [
  { label: "MORT INSTANTANEE", actionLabels: ["MORT INSTANTANEE", "ORBEEZ 5"], triggerType: "gift", triggerKey: "rose", giftLabel: "Rose", giftImageUrl: "https://example.invalid/rose.png", groupKey: "death" },
  { label: "MORT INSTANTANEE", triggerType: "follow", triggerKey: "follow", groupKey: "death" },
  { label: "PING-PONG 15", triggerType: "likes", triggerKey: "500", likeAmount: 500 },
  { label: "+1 WIN", triggerType: "gift", triggerKey: "diamond", giftLabel: "Diamant" },
  { label: "-1 WIN", triggerType: "chat", triggerKey: "!lose" },
  { label: "TELEPORTATION", triggerType: "share", triggerKey: "share", effectImageUrl: "https://example.invalid/effect.png" }
];

const mappings = [
  { id: "tnt", enabled: true, triggerType: "gift", giftTrigger: "gift:5655", title: "TNT", commands: ["shenpulse tnt 5"], interactionPresetId: "tnt", interactionPresetParams: { amount: 5 } },
  { id: "follow", enabled: true, triggerType: "follow", title: "RESET", commands: ["shenpulse reset"], interactionPresetParams: {} },
  { id: "likes", enabled: true, triggerType: "likes", likeAmount: 100, title: "+1 WIN", commands: ["shenpulse win 1"], interactionPresetParams: {} },
  { id: "ignored", enabled: false, triggerType: "chat", chatCommand: "!ignored", title: "IGNORED", commands: ["unknown"], interactionPresetParams: {} }
];

function createEnvironment() {
  const trace = [];
  const images = [];
  const normalize = (value) => value?.src ? { image: value.src } : value;
  const canvasContext = new Proxy({ font: "10px sans-serif" }, {
    set(target, key, value) { target[key] = value; trace.push(["set", key, normalize(value)]); return true; },
    get(target, key) {
      if (key in target) return target[key];
      if (key === "measureText") return (value) => ({ width: String(value).length * (Number(/(\d+(?:\.\d+)?)px/.exec(target.font)?.[1]) || 10) * .6 });
      if (key === "createLinearGradient" || key === "createRadialGradient") return (...args) => {
        trace.push([key, ...args]);
        return { addColorStop(...stop) { trace.push(["colorStop", ...stop]); } };
      };
      return (...args) => trace.push([key, ...args.map(normalize)]);
    }
  });
  const anchors = [];
  let nextTimer = 0;
  const context = {
    Image: class {
      naturalWidth = 512;
      naturalHeight = 512;
      width = 512;
      height = 512;
      set src(value) { this.imageSource = value; images.push(value); queueMicrotask(() => this.onload?.()); }
      get src() { return this.imageSource; }
    },
    document: {
      createElement(kind) {
        if (kind === "canvas") return { width: 0, height: 0, getContext: () => canvasContext, toBlob: (callback, mime) => callback({ mime }) };
        const anchor = { click() { trace.push(["download", this.download]); }, remove() {} };
        anchors.push(anchor);
        return anchor;
      },
      body: { appendChild() {} }
    },
    URL: { createObjectURL: () => "blob:trace", revokeObjectURL() {} },
    window: { setTimeout: () => ++nextTimer, clearTimeout() {} },
    queueMicrotask,
    console
  };
  vm.createContext(context);
  return { context, trace, images, anchors };
}

async function traceGenerator(source, { type = "styled", model = 1 } = {}) {
  const environment = createEnvironment();
  vm.runInContext(source, environment.context);
  const api = environment.context.ShenPulseGameOverlay;
  const options = type === "styled"
    ? { entries: structuredClone(styledEntries), model, backgroundColor: "#162d49" }
    : { mappings: structuredClone(mappings), giftOptions: [{ id: "gift:5655", name: "Rose", imageUrl: "https://example.invalid/rose.png", cost: "1" }], model };
  const canvas = await (type === "styled" ? api.renderMinecraftStyledOverlay(options) : api.renderMinecraftBedrockOverlay(options));
  const trace = JSON.stringify(environment.trace);
  return { hash: createHash("sha256").update(trace).digest("hex"), operations: environment.trace.length, width: canvas.width, height: canvas.height, images: environment.images, api: Object.keys(api).filter((key) => key !== "__esModule").sort() };
}

module.exports = { createEnvironment, traceGenerator, styledEntries, mappings };
