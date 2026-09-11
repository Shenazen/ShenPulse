"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const {
  createMatchAccessKey,
  createMatchChannelId,
  matchAccountNumber,
  matchPublicSourcePath,
  matchSourcePath,
  normalizeMatchAccess,
  parseMatchBridgePath,
  parseMatchPublicSourcePath,
  parseMatchSourcePath
} = require("../src/main/match-access");

test("le numéro Match est numérique, stable et ne révèle pas l’UID", () => {
  const first = matchAccountNumber("firebase-user-alexandre");
  assert.match(first, /^\d{12}$/);
  assert.equal(first, matchAccountNumber("firebase-user-alexandre"));
  assert.notEqual(first, matchAccountNumber("firebase-user-other"));
  assert.doesNotMatch(first, /alexandre|firebase/i);
});

test("la source Match publique reste courte et sépare le compte du canal", () => {
  const channelId = createMatchChannelId();
  const pathname = matchPublicSourcePath({
    accountUid: "firebase-user-alexandre",
    channelId
  });
  const accountNumber = matchAccountNumber("firebase-user-alexandre");
  assert.equal(pathname, `/m/${accountNumber}/${channelId}`);
  assert.deepEqual(parseMatchPublicSourcePath(pathname), {
    accountNumber,
    channelId
  });
  assert.deepEqual(
    parseMatchBridgePath(
      `/match-bridge/${accountNumber}/${channelId}/ticket`
    ),
    { accountNumber, channelId, resource: "ticket" }
  );
  assert.equal(parseMatchPublicSourcePath("/m/invalide"), null);
});

test("la source Match combine numéro public et clé révocable", () => {
  const accessKey = createMatchAccessKey();
  const pathname = matchSourcePath({
    accountUid: "firebase-user-alexandre",
    accessKey
  });
  assert.match(pathname, /^\/match\/\d{12}\/[A-Za-z0-9_-]{32}$/);
  assert.deepEqual(parseMatchSourcePath(`${pathname}/ticket`), {
    accountNumber: matchAccountNumber("firebase-user-alexandre"),
    accessKey,
    resource: "ticket"
  });
  assert.equal(parseMatchSourcePath("/match/invalide"), null);
});

test("une clé Match invalide est remplacée sans réutiliser la précédente", () => {
  const first = normalizeMatchAccess({ accessKey: "trop-courte" });
  const second = normalizeMatchAccess({ accessKey: "trop-courte" });
  assert.match(first.accessKey, /^[A-Za-z0-9_-]{32}$/);
  assert.notEqual(first.accessKey, second.accessKey);
  assert.deepEqual(normalizeMatchAccess(first), first);
});
