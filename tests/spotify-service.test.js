"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const {
  normalizeAccount,
  normalizeDevice,
  normalizePlayback,
  spotifyTrackUri
} = require("../src/main/spotify-service");

test("normalise les objets Spotify avant de les exposer au renderer", () => {
  assert.deepEqual(
    normalizeAccount({
      id: "abc",
      display_name: "Shen",
      email: "test@example.com",
      product: "premium"
    }),
    {
      id: "abc",
      displayName: "Shen",
      email: "test@example.com",
      product: "premium",
      country: ""
    }
  );
  assert.deepEqual(
    normalizeDevice({
      id: "device",
      name: "PC",
      type: "Computer",
      is_active: true,
      volume_percent: 42
    }),
    {
      id: "device",
      name: "PC",
      type: "Computer",
      isActive: true,
      isRestricted: false,
      volume: 42
    }
  );
  assert.equal(
    normalizePlayback({ is_playing: true, item: { name: "Titre" } }).isPlaying,
    true
  );
});

test("accepte les URI, liens et identifiants de titres Spotify", () => {
  const id = "4uLU6hMCjMI75M1A2tKUQC";
  assert.equal(spotifyTrackUri(id), `spotify:track:${id}`);
  assert.equal(spotifyTrackUri(`spotify:track:${id}`), `spotify:track:${id}`);
  assert.equal(
    spotifyTrackUri(`https://open.spotify.com/track/${id}?si=test`),
    `spotify:track:${id}`
  );
  assert.equal(spotifyTrackUri("une chanson"), "");
});
