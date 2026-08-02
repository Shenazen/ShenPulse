"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const {
  ActionRunner,
  filterTtsChatComment
} = require("../src/main/action-runner");

function createRunner(published, options = {}) {
  const state = {
    settings: {
      tts: {
        enabled: true,
        voice: "Microsoft Denise Online (Natural) - French (France)",
        rate: 1,
        pitch: 1,
        volume: 0.9
      }
    }
  };
  return new ActionRunner({
    store: { getState: () => state },
    overlayServer: {
      publish: (event, payload) =>
        published.push({ transport: "overlay", event, payload })
    },
    gameHub: {},
    obsClient: {},
    sourceHub: {},
    spotifyService: {},
    notifyRenderer: (event, payload) =>
      published.push({ transport: "renderer", event, payload }),
    ...options
  });
}

test("un TTS déclenché par le chat lit uniquement le commentaire", async () => {
  const published = [];
  const runner = createRunner(published);

  await runner.run(
    {
      type: "tts.speak",
      config: {
        text: "Cadeau de {{user.displayName}} : {{data.giftName}}",
        voice: "Voix choisie"
      }
    },
    {
      event: {
        type: "chat",
        user: { displayName: "Alice" },
        data: {
          message: "Bonjour le chat !",
          giftName: "Rose"
        }
      }
    }
  );

  assert.equal(published.length, 1);
  assert.equal(published[0].transport, "renderer");
  assert.equal(published[0].event, "playback");
  assert.equal(published[0].payload.type, "tts");
  assert.equal(published[0].payload.text, "Bonjour le chat !");
  assert.equal(published[0].payload.voice, "Voix choisie");
  assert.doesNotMatch(published[0].payload.text, /Alice|Rose|Cadeau/);
});

test("les sons autonomes restent dans le lecteur ShenPulse et pas dans les overlays", async () => {
  const published = [];
  const runner = createRunner(published);

  await runner.run(
    {
      type: "audio.play",
      config: { url: "https://cdn.example.test/alert.mp3", volume: 0.5 }
    },
    { event: { type: "gift", data: {} } }
  );

  assert.equal(published.length, 1);
  assert.equal(published[0].transport, "renderer");
  assert.equal(published[0].event, "playback");
  assert.equal(published[0].payload.type, "audio");
});

test("un événement chat sans commentaire ne lance aucune lecture", async () => {
  const published = [];
  const runner = createRunner(published);

  const result = await runner.run(
    {
      type: "tts.speak",
      config: { text: "Ce texte ne doit pas être lu" }
    },
    {
      event: {
        type: "chat",
        data: { message: "" }
      }
    }
  );

  assert.deepEqual(result, { skipped: true });
  assert.equal(published.length, 0);
});

test("le moteur TTS refuse tous les événements autres que les commentaires", async () => {
  const published = [];
  const runner = createRunner(published);

  for (const type of ["gift", "like", "follow", "share", "subscribe", "join"]) {
    const result = await runner.run(
      {
        type: "tts.speak",
        config: { text: "Ce texte ne doit jamais être lu" }
      },
      {
        event: {
          id: `event_${type}`,
          type,
          data: { message: "Faux commentaire" }
        }
      }
    );
    assert.deepEqual(result, { skipped: true, reason: "chat-only" });
  }

  assert.equal(published.length, 0);
});

test("les filtres TTS ignorent par défaut mentions, commandes et liens", () => {
  assert.equal(filterTtsChatComment("@alice bonjour"), "");
  assert.equal(filterTtsChatComment("!help"), "");
  assert.equal(filterTtsChatComment("/commande"), "");
  assert.equal(filterTtsChatComment("Regarde https://example.com"), "");
  assert.equal(filterTtsChatComment("Regarde example.fr maintenant"), "");
});

test("chaque type de commentaire peut être autorisé séparément", () => {
  assert.equal(
    filterTtsChatComment("@alice bonjour", { allowMentions: true }),
    "@alice bonjour"
  );
  assert.equal(
    filterTtsChatComment("!help", { allowCommands: true }),
    "!help"
  );
  assert.equal(
    filterTtsChatComment("Regarde example.fr", { allowLinks: true }),
    "Regarde example.fr"
  );
});

test("les emojis sont retirés ou conservés selon l'option", () => {
  assert.equal(filterTtsChatComment("Bonjour 😀 à tous 🎉"), "Bonjour à tous");
  assert.equal(filterTtsChatComment("😀🎉"), "");
  assert.equal(filterTtsChatComment("Top 1️⃣"), "Top");
  assert.equal(
    filterTtsChatComment("Bonjour 😀", { readEmojis: true }),
    "Bonjour 😀"
  );
});

test("un même événement chat n'est mis en lecture qu'une seule fois", async () => {
  const published = [];
  const runner = createRunner(published);
  const action = {
    type: "tts.speak",
    config: { text: "{{data.message}}" }
  };
  const context = {
    event: {
      id: "chat_123",
      type: "chat",
      source: "tiktok",
      user: { id: "alice" },
      data: { message: "Message unique" }
    }
  };

  const first = await runner.run(action, context);
  const duplicate = await runner.run(action, context);

  assert.deepEqual(first, { queued: true });
  assert.deepEqual(duplicate, { skipped: true, reason: "duplicate" });
  assert.equal(published.length, 1);
});

test("un doublon recréé avec un nouvel identifiant reste bloqué brièvement", async () => {
  let now = 1_000_000;
  const published = [];
  const runner = createRunner(published, { nowImpl: () => now });
  const action = {
    type: "tts.speak",
    config: { text: "{{data.message}}" }
  };
  const event = {
    type: "chat",
    source: "tiktok",
    user: { id: "alice" },
    data: { message: "Même commentaire" }
  };

  await runner.run(action, { event: { ...event, id: "first" } });
  now += 10_000;
  const duplicate = await runner.run(action, {
    event: { ...event, id: "duplicate" }
  });
  now += 30_000;
  const repeatedLater = await runner.run(action, {
    event: { ...event, id: "later" }
  });

  assert.deepEqual(duplicate, { skipped: true, reason: "duplicate" });
  assert.deepEqual(repeatedLater, { queued: true });
  assert.equal(published.length, 2);
});

test("deux viewers peuvent envoyer le même commentaire sans se bloquer", async () => {
  const published = [];
  const runner = createRunner(published);
  const action = {
    type: "tts.speak",
    config: { text: "{{data.message}}" }
  };
  const baseEvent = {
    type: "chat",
    source: "tiktok",
    data: { message: "Bonjour" }
  };

  await runner.run(action, {
    event: { ...baseEvent, id: "alice_message", user: { id: "alice" } }
  });
  await runner.run(action, {
    event: { ...baseEvent, id: "bob_message", user: { id: "bob" } }
  });

  assert.equal(published.length, 2);
});
