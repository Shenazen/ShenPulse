"use strict";

// Recette sur un vrai PaperMC et un joueur protocolaire, hors mondes utilisateur.
const assert = require("node:assert/strict"), fs = require("node:fs");
const { loadShenazenGameCatalog } = require("../src/main/game-catalog");
const { createEffectPayload } = require("../src/main/game-hub/effect-payload");
const mode = process.argv.includes("--box") ? "minecraft-box-cyber" : "minecraft-diamond-rush";
const pack = loadShenazenGameCatalog(require("node:path").resolve("resources")).find((entry) => entry.id === mode);
const results = [], exercised = new Set();
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
async function api(route, body) {
  const response = await fetch("http://127.0.0.1:18686" + route, body ? { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), signal: AbortSignal.timeout(20000) } : { signal: AbortSignal.timeout(20000) });
  const value = await response.json(); if (!response.ok) throw new Error(value.error); return value;
}
const snap = () => api("/snapshot");
const consoleCommand = async (command) => { await api("/command", { command }); await delay(150); };
async function effect(code, parameters = {}) {
  const definition = pack.effects.find((entry) => entry.service === "native" && entry.code === code);
  assert.ok(definition, code);
  exercised.add(code);
  const payload = createEffectPayload(definition, { user: { name: "qa", displayName: "Recette ShenPulse" } }, { parameters });
  for (const command of payload.effect.commands) await consoleCommand(command.replace(/^\//, ""));
}
async function check(name, run) {
  try { const evidence = await run(); results.push({ name, ok: true, evidence }); }
  catch (error) { results.push({ name, ok: false, error: error.message }); }
  process.stdout.write(JSON.stringify(results.at(-1)) + "\n");
}
function block(state, name) { return Number(state.blocks?.[name] || 0); }
function entity(state, name) { return Number(state.entities?.[name] || 0); }
async function diamond() {
  await check("mine prête et outils automatiques", async () => { const state = await snap(); assert.equal(state.diamondEnabled, true); assert.equal(state.arenaReady, true); assert.equal(state.players[0].hand, "DIAMOND_PICKAXE"); assert.ok(block(state, "DIAMOND_ORE") > 1000); return state; });
  await check("diamants offerts et perdus : valeurs exactes", async () => { await consoleCommand("shenpulse_dr sync 0 1 0 15"); const initial = (await snap()).totalDiamonds; await effect("diamonds-add", { count: 100 }); assert.equal((await snap()).totalDiamonds, initial + 100); await effect("diamonds-remove", { count: 30 }); assert.equal((await snap()).totalDiamonds, initial + 70); });
  await check("bonus diamants : expiration réelle", async () => { await effect("double-diamonds", { seconds: 2 }); assert.equal((await snap()).diamondMultiplier, 2); await delay(2400); assert.equal((await snap()).diamondMultiplier, 1); });
  await check("arrêt manuel du bonus", async () => { await effect("double-diamonds", { seconds: 60 }); await effect("normal-diamonds"); assert.equal((await snap()).diamondMultiplier, 1); });
  await check("soin complet", async () => { await consoleCommand("effect clear ShenPulseQA minecraft:regeneration"); await consoleCommand("shenpulseqa health 7"); assert.ok((await snap()).players[0].health < 20); await effect("heal"); assert.equal((await snap()).players[0].health, 20); });
  for (const [code, expected] of [["diamant1", 60], ["diamant2", 200]]) await check(code + " : quantité de minerai", async () => {
    await consoleCommand("tp ShenPulseQA 0.5 34 0.5"); const before = block(await snap(), "DIAMOND_ORE"); await effect(code); const after = block(await snap(), "DIAMOND_ORE"); assert.equal(after - before, expected); return { added: after - before };
  });
  await check("monstres nommés puis suppression", async () => { await effect("zombie"); await effect("skeleton"); const before = await snap(); assert.ok(entity(before, "ZOMBIE") >= 1); assert.ok(entity(before, "SKELETON") >= 1); await effect("clear-mobs"); const after = await snap(); assert.equal(entity(after, "ZOMBIE") + entity(after, "SKELETON"), 0); });
  await check("prison puis libération anticipée", async () => { await effect("prison", { seconds: 4 }); assert.equal((await snap()).prisons, 1); await effect("noprison", { seconds: 4 }); assert.equal((await snap()).prisons, 0); });
  await check("prison : libération automatique", async () => { await effect("prison", { seconds: 2 }); await delay(2500); assert.equal((await snap()).prisons, 0); });
  await check("wins automatiques et multiplicateur temporaire", async () => {
    await consoleCommand("shenpulse_dr sync 5 3 2 15"); await effect("diamonds-add", { count: 3000 }); let state = await snap(); assert.equal(state.totalWins, 8); assert.equal(state.totalDiamonds, 0); await delay(2300); state = await snap(); assert.equal(state.winMultiplier, 1); await consoleCommand("shenpulse_dr sync -3 1 0 15"); assert.equal((await snap()).totalWins, -3);
  });
  await consoleCommand("gamemode creative ShenPulseQA");
  for (const [code, amount] of [["tnt1",15],["tnt2",100]]) await check(code + " : entités explosives", async () => {
    await consoleCommand("tp ShenPulseQA 0.5 32 0.5"); await effect(code); const state = await snap(); assert.ok(entity(state, "PRIMED_TNT") >= amount); await delay(4000); assert.equal(entity(await snap(), "PRIMED_TNT"), 0);
  });
  await check("coulée de lave", async () => { await effect("lava"); assert.ok(block(await snap(), "LAVA") > 0); });
  await check("chaos nucléaire", async () => { await effect("nuclear"); const state = await snap(); assert.ok(entity(state, "PRIMED_TNT") >= 100); assert.ok(block(state,"LAVA") > 0); await delay(4500); });
  await check("régénération de la mine", async () => { await effect("regenerate"); await delay(5000); const state = await snap(); assert.equal(state.arenaReady, true); assert.equal(state.totalDiamonds, 0); assert.ok(block(state, "DIAMOND_ORE") > 1000); });
  await check("minage réel avec la pioche : compteur incrémenté", async () => {
    await consoleCommand("gamemode survival ShenPulseQA"); await consoleCommand("setblock 3 32 0 air"); await consoleCommand("setblock 3 31 0 diamond_ore"); await consoleCommand("tp ShenPulseQA 3.5 32 0.5"); await delay(500); const before = (await snap()).totalDiamonds; await api("/dig", {}); const after = await snap(); assert.ok(after.totalDiamonds > before); return { diamonds: after.totalDiamonds - before };
  });
}
async function box() {
  await check("arène et blocs automatiques", async () => { const state = await snap(); assert.equal(state.boxEnabled, true); assert.equal(state.players[0].mode, "CREATIVE"); assert.equal(state.players[0].hand, "REDSTONE_BLOCK"); return state; });
  for (const [code, material, total] of [["step2", "IRON_BLOCK",243],["step3","GOLD_BLOCK",243],["step4","DIAMOND_BLOCK",243]]) await check(code + " : étage complet", async () => { await effect("reset"); await effect(code); const state = await snap(); assert.equal(block(state,material), total); return state.blocks; });
  await check("blocs offerts : quantité exacte", async () => { await effect("reset"); await effect("fill", { count:25 }); await delay(2000); assert.equal(block(await snap(),"IRON_BLOCK"),25); });
  await check("quatre cadeaux rapprochés : cent blocs conservés", async () => { await effect("reset"); for(let i=0;i<4;i++)await effect("fill",{count:25}); await delay(5700); assert.equal(block(await snap(),"IRON_BLOCK"),100); });
  await check("reset interrompt aussi les blocs en attente", async () => { await effect("reset"); await effect("fill",{count:200}); await delay(200); await effect("reset"); await delay(1500); assert.equal(block(await snap(),"IRON_BLOCK"),0); });
  await check("un second joueur ne vide pas la box", async () => { await effect("step3"); const before=await snap(); await api("/rejoin",{}); const after=await snap(); assert.equal(block(after,"GOLD_BLOCK"),block(before,"GOLD_BLOCK")); });
  await check("prison minute puis libération", async () => { await effect("prison1"); assert.equal((await snap()).prisons,1); await effect("noprison1"); assert.equal((await snap()).prisons,0); });
  await check("parkour puis libération", async () => { await effect("prison2"); let state=await snap(); assert.equal(state.parkourPrisons,1); assert.equal(state.players[0].mode,"SURVIVAL"); assert.ok(state.players[0].x>900); await effect("noprison2"); state=await snap(); assert.equal(state.parkourPrisons,0); assert.equal(state.players[0].mode,"CREATIVE"); assert.ok(state.players[0].x<10); });
  await check("arrivée naturelle du parkour", async () => { await effect("prison2"); await consoleCommand("tp ShenPulseQA 1002.5 61 1051.5"); await api("/walk",{}); await delay(1300); assert.equal((await snap()).parkourPrisons,0); });
  await check("annulation du décompte si la box est vidée", async () => { await effect("step5"); assert.equal((await snap()).isCountingDown,true); await effect("reset"); assert.equal((await snap()).isCountingDown,false); assert.equal(block(await snap(),"EMERALD_BLOCK"),0); });
  await check("victoire native, multiplicateur et reset de la box", async () => { await consoleCommand("shenpulse_box sync 5 3 30 15"); await effect("step5"); await delay(17500); const state=await snap(); assert.equal(state.winCount,8); assert.equal(block(state,"EMERALD_BLOCK"),0); return state; });
  await check("expiration du multiplicateur", async () => { await consoleCommand("shenpulse_box sync -3 3 2 15"); assert.equal((await snap()).shenMultiplier,3); await delay(2400); assert.equal((await snap()).shenMultiplier,1); assert.equal((await snap()).winCount,-3); });
  await check("fusée : durée réglable puis retour à la box", async () => { await effect("step4"); await effect("fusee", {seconds:2}); const state=await snap(); assert.ok(state.players[0].effects.some(effect=>effect.type==="LEVITATION")); await delay(3000); const after=await snap(); assert.ok(!after.players[0].effects.some(effect=>effect.type==="LEVITATION")); assert.ok(after.players[0].y<32); return { before:state.players[0],after:after.players[0] }; });
}
async function main() {
  await (mode.endsWith("box-cyber") ? box() : diamond());
  const native=pack.effects.filter(effect=>effect.service==="native").map(effect=>effect.code);
  const report={mode,at:new Date().toISOString(),results,nativeCodes:native,exercised:[...exercised],missing:native.filter(code=>!exercised.has(code))};
  const suffix=process.argv.includes("--baseline")?"baseline":"final";
  fs.writeFileSync(`.artifacts/minecraft-owner-20261103/${mode}-${suffix}.json`,JSON.stringify(report,null,2));
  process.stdout.write(JSON.stringify({mode,passed:results.filter(r=>r.ok).length,failed:results.filter(r=>!r.ok).length,missing:report.missing})+"\n");
  if(results.some(row=>!row.ok)||report.missing.length)process.exitCode=1;
}
main().catch(error=>{process.stderr.write(error.stack+"\n");process.exitCode=1;});
