"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const {
  resolveSegmentLayout,
  uprightRotation,
  wrappedLineCount
} = require("../resources/overlays/wheel-layout");

const defaultSettings = {
  fontSize: 100,
  textOrientation: "horizontal",
  textRadius: 100,
  textBoxWidth: 100,
  textBoxHeight: 240,
  textMaxLines: 4,
  lineSpacing: 50
};

test("les secteurs restent centrés et contenus de 3 à 16 choix", () => {
  [3, 6, 12, 16].forEach((segmentCount) => {
    for (let index = 0; index < segmentCount; index += 1) {
      const layout = resolveSegmentLayout({
        index,
        segmentCount,
        label: `Choix ${index + 1}`,
        settings: defaultSettings
      });
      assert.equal(layout.segmentAngle, 360 / segmentCount);
      assert.ok(layout.x > 0 && layout.x < 100);
      assert.ok(layout.y > 0 && layout.y < 100);
      assert.ok(layout.widthPercent >= 4 && layout.widthPercent <= 50);
      assert.ok(layout.heightPercent >= 4 && layout.heightPercent <= 50);
      const innerTextRadius = layout.radius - layout.heightPercent / 2;
      const sectorHalfWidth = innerTextRadius * Math.tan(
        Math.min(layout.segmentAngle * Math.PI / 360, Math.PI / 3)
      );
      assert.ok(layout.widthPercent / 2 <= sectorHalfWidth * 0.8);
    }
  });
});

test("les textes du bas sont toujours remis à l'endroit", () => {
  [3, 6, 12, 16].forEach((segmentCount) => {
    for (let index = 0; index < segmentCount; index += 1) {
      const { rotation } = resolveSegmentLayout({
        index,
        segmentCount,
        label: "Ping-pong 15 secondes",
        settings: defaultSettings
      });
      const normalized = ((rotation % 360) + 360) % 360;
      assert.ok(normalized <= 90 || normalized >= 270);
    }
  });
  assert.equal(uprightRotation(180), 360);
});

test("la typographie rétrécit avec les secteurs nombreux et les textes longs", () => {
  const largeSector = resolveSegmentLayout({
    segmentCount: 3,
    label: "Rien",
    settings: defaultSettings
  });
  const narrowSector = resolveSegmentLayout({
    segmentCount: 16,
    label: "Ping-pong pendant quinze secondes",
    settings: defaultSettings
  });
  assert.ok(narrowSector.fontScale < largeSector.fontScale);
  assert.ok(narrowSector.widthPercent < largeSector.widthPercent);
  assert.ok(narrowSector.maxLines >= 1);
});

test("le calcul de retour à la ligne accepte les mots très longs", () => {
  assert.equal(wrappedLineCount("Rien", 10), 1);
  assert.ok(wrappedLineCount("SUPERCALIFRAGILISTIC", 5) >= 4);
});
