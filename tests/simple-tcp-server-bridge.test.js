"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const net = require("node:net");
const {
  SimpleTcpServerBridge
} = require("../src/main/simple-tcp-server-bridge");

test("accepte les statuts camelCase du mod Blue Prince et conserve les refus temporaires", async t => {
  const bridge = new SimpleTcpServerBridge({ port: 0, timeoutMs: 1500 });
  const status = await bridge.start();
  const client = net.createConnection({ host: "127.0.0.1", port: status.port });
  t.after(async () => { client.destroy(); await bridge.close(); });
  await new Promise((resolve, reject) => { client.once("connect", resolve); client.once("error", reject); });
  let buffer = "";
  client.on("data", chunk => {
    buffer += chunk.toString();
    let ending;
    while ((ending = buffer.indexOf("\0")) >= 0) {
      const request = JSON.parse(buffer.slice(0, ending)); buffer = buffer.slice(ending + 1);
      assert.equal(request.duration, 3000);
      const response = { id: request.id, type: "effectRequest", status: request.code, metadata: {}, timeRemaining: 0 };
      const frame = JSON.stringify(response) + "\0";
      client.write(frame.slice(0, 5)); client.write(frame.slice(5));
    }
  });
  assert.equal((await bridge.send("success", { duration: 3000 })).status, 0);
  await assert.rejects(bridge.send("retry", { duration: 3000 }), error => error.status === 3);
  await assert.rejects(bridge.send("unavailable", { duration: 3000 }), error => error.status === 2);
  assert.equal((await bridge.send("finished", { duration: 3000 })).status, 8);
});

test("la passerelle SimpleTCP reçoit le mod puis exécute une interaction", async () => {
  const bridge = new SimpleTcpServerBridge({
    port: 0,
    timeoutMs: 1500,
    label: "Jeu test"
  });
  const status = await bridge.start();
  assert.equal(status.listening, true);

  const client = net.createConnection({
    host: "127.0.0.1",
    port: status.port
  });
  await new Promise((resolve, reject) => {
    client.once("connect", resolve);
    client.once("error", reject);
  });

  let buffer = "";
  client.on("data", (chunk) => {
    buffer += chunk.toString("utf8");
    const separator = buffer.indexOf("\0");
    if (separator < 0) return;
    const request = JSON.parse(buffer.slice(0, separator));
    assert.equal(request.type, 1);
    assert.equal(request.code, "chaos_heal");
    assert.equal(request.viewer, "Nova");
    assert.equal(request.parameters.amount, 25);
    assert.equal(request.amount, 25);
    client.write(
      `${JSON.stringify({
        id: request.id,
        status: 0,
        message: "Interaction exécutée."
      })}\0`
    );
  });

  const result = await bridge.send("chaos_heal", {
    viewer: "Nova",
    quantity: 1,
    duration: 0,
    parameters: { amount: 25 }
  });
  assert.equal(result.ok, true);
  assert.equal(result.message, "Interaction exécutée.");

  client.destroy();
  await bridge.close();
});

test("la passerelle explique clairement quand le jeu n’est pas connecté", async () => {
  const bridge = new SimpleTcpServerBridge({
    port: 0,
    timeoutMs: 1000,
    label: "GTA V Mont Chiliad"
  });
  await assert.rejects(
    () => bridge.send("chaos_heal"),
    /n’est pas encore connecté à ShenPulse/
  );
  await bridge.close();
});

test("la passerelle conserve le statut temporaire refusé par le mod", async () => {
  const bridge = new SimpleTcpServerBridge({
    port: 0,
    timeoutMs: 1000,
    label: "Jeu test"
  });
  const status = await bridge.start();
  const client = net.createConnection({ host: "127.0.0.1", port: status.port });
  await new Promise((resolve, reject) => {
    client.once("connect", resolve);
    client.once("error", reject);
  });
  client.on("data", (chunk) => {
    const request = JSON.parse(chunk.toString("utf8").split("\0")[0]);
    client.write(
      `${JSON.stringify({ id: request.id, status: 3, message: "retry" })}\0`
    );
  });

  await assert.rejects(
    bridge.send("temporary"),
    (error) => error.status === 3 && /retry/.test(error.message)
  );

  client.destroy();
  await bridge.close();
});
