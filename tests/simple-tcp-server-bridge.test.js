"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const net = require("node:net");
const {
  SimpleTcpServerBridge
} = require("../src/main/simple-tcp-server-bridge");

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
    client.write(
      `${JSON.stringify({
        id: request.id,
        status: 0,
        message: "Interaction exécutée."
      })}\0`
    );
  });

  const result = await bridge.send("chaos_heal", {
    quantity: 1,
    duration: 0
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
