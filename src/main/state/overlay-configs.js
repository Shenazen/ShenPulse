"use strict";

const { clone } = require("../utils");
const { createDefaultOverlayConfigs } = require("../defaults");
const overlayCatalog = require("../../../resources/overlays/overlay-catalog");

/** Migration commune à l'état actif et aux profils : Like Goal et roues historiques. */
/** Une action choisie active son secteur, sauf pour le secteur spécial de relance. */
function normalizeWheelSegmentActions(wheels = []) {
  for (const wheel of wheels) {
    for (const segment of wheel?.segments || []) {
      if (segment.action !== "spin" && String(segment.actionId || "").trim()) {
        segment.action = "action";
      }
    }
  }
  return wheels;
}

/** Fusionne les valeurs initiales et les configurations héritées sans modifier l'entrée. */
function normalizeProfileOverlayConfigs(storedConfigs) {
  const defaults = createDefaultOverlayConfigs();
  const stored =
    storedConfigs && typeof storedConfigs === "object" ? storedConfigs : {};

  return Object.fromEntries(
    Object.entries(defaults).map(([overlayId, defaultConfig]) => {
      const saved =
        stored[overlayId] && typeof stored[overlayId] === "object"
          ? stored[overlayId]
          : {};
      const merged = { ...clone(defaultConfig), ...clone(saved) };

      if (["topDonors", "topTappers"].includes(overlayId)) {
        merged.theme = overlayCatalog.normalizeDesign(overlayId, merged.theme);
        if (!Object.prototype.hasOwnProperty.call(saved, "leaderboardUnitColor")) {
          merged.leaderboardUnitColor = saved.scoreColor || defaultConfig.leaderboardUnitColor;
        }
        if (!Object.prototype.hasOwnProperty.call(saved, "leaderboardTitleColor")) {
          merged.leaderboardTitleColor = saved.textColor || defaultConfig.leaderboardTitleColor;
        }
      }

      if (["timer", "multiplierTimer"].includes(overlayId)) {
        merged.theme = overlayCatalog.normalizeDesign(overlayId, merged.theme);
        if (!Object.prototype.hasOwnProperty.call(saved, "timerTitleColor")) {
          merged.timerTitleColor = saved.accentColor || saved.textColor || defaultConfig.timerTitleColor;
        }
        if (!Object.prototype.hasOwnProperty.call(saved, "timerValueColor")) {
          merged.timerValueColor = saved.textColor || defaultConfig.timerValueColor;
        }
      }

      if (overlayId === "coinJar") {
        if (!Object.prototype.hasOwnProperty.call(saved, "coinJarTitleColor")) merged.coinJarTitleColor = saved.textColor || defaultConfig.coinJarTitleColor;
      }

      if (overlayId === "winCounter") {
        merged.theme = overlayCatalog.normalizeDesign(overlayId, merged.theme);
        delete merged.winCounterLabelOffsetX;
        delete merged.winCounterLabelOffsetY;
        for (const key of ["winCounterTitleColor", "winCounterGoalColor"]) {
          if (!Object.prototype.hasOwnProperty.call(saved, key)) {
            merged[key] = saved.textColor || defaultConfig[key];
          }
        }
      }

      if (overlayId === "likeGoal") {
        merged.theme = overlayCatalog.normalizeDesign(overlayId, merged.theme);
        for (const key of ["likeGoalTitleOffsetX", "likeGoalTitleOffsetY", "likeGoalContentOffsetX", "likeGoalContentOffsetY"]) {
          delete merged[key];
        }
        if (
          !Object.prototype.hasOwnProperty.call(
            saved,
            "likeGoalTitleColor"
          )
        ) {
          merged.likeGoalTitleColor =
            saved.textColor || defaultConfig.likeGoalTitleColor;
        }
        if (
          !Object.prototype.hasOwnProperty.call(
            saved,
            "likeGoalContentColor"
          )
        ) {
          merged.likeGoalContentColor =
            saved.textColor || defaultConfig.likeGoalContentColor;
        }
        if (
          !Object.prototype.hasOwnProperty.call(
            saved,
            "likeGoalPercentColor"
          )
        ) {
          merged.likeGoalPercentColor =
            saved.secondaryColor || defaultConfig.likeGoalPercentColor;
        }
        if (
          Number(saved.schemaVersion || 0) < 2 &&
          Number(saved.scale) === 60
        ) {
          merged.scale = 100;
        }
        merged.schemaVersion = Math.max(
          2,
          Number(merged.schemaVersion) || 0
        );
        return [overlayId, merged];
      }

      if (overlayId !== "wheel") return [overlayId, merged];

      if (
        !Array.isArray(saved.wheels) &&
        Array.isArray(saved.choices) &&
        saved.choices.length >= 2
      ) {
        const colors = Array.isArray(saved.colors) ? saved.colors : [];
        merged.wheels = clone(defaultConfig.wheels);
        merged.wheels[0].name = saved.title || merged.wheels[0].name;
        merged.wheels[0].design =
          saved.design === "royal" ? "royal" : "classic";
        merged.wheels[0].settings = {
          ...merged.wheels[0].settings,
          ...saved
        };
        merged.wheels[0].segments = saved.choices
          .slice(0, 16)
          .map((label, index) => ({
            id: `segment_legacy_${index + 1}`,
            label: String(label),
            color:
              colors[index] ||
              ["#ff6a00", "#111111", "#f59f00", "#2a1207"][index % 4],
            action: "none",
            actionId: ""
          }));
        merged.selectedWheelId = merged.wheels[0].id;
      }

      const wheels = overlayCatalog.normalizeWheelIdentities(Array.isArray(merged.wheels) && merged.wheels.length
        ? clone(merged.wheels)
        : clone(defaultConfig.wheels));
      normalizeWheelSegmentActions(wheels);
      merged.wheels = wheels;
      merged.schemaVersion = Math.max(
        11,
        Number(merged.schemaVersion) || 0
      );
      if (
        !wheels.some((wheel) => wheel.id === merged.selectedWheelId)
      ) {
        merged.selectedWheelId = wheels[0]?.id || "";
      }
      return [overlayId, merged];
    })
  );
}

module.exports = { normalizeWheelSegmentActions, normalizeProfileOverlayConfigs };
