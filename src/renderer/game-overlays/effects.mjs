/** Interprète les commandes du jeu et les effets représentés dans l'overlay. */

import { INTERACTION_ICON_URLS, SANDBOX_OVERLAY_COLOR_IDS } from "./constants.mjs";

function detectOverlayEffect(mapping) {
  const cleanCommands = mapping.commands.map(cleanCommand);
  const commandText = cleanCommands.join("\n");
  const rawText = [mapping.id, mapping.title, commandText].join("\n").toLowerCase();
  const presetImageUrl = overlayPresetImageUrl(mapping.interactionPresetId);
  const winEffect = detectWinEffect(cleanCommands, mapping.title);
  if (winEffect) return withOverlayImage(winEffect, presetImageUrl);
  if (/diamant|diamond/.test(rawText)) {
    return { imageUrl: presetImageUrl || INTERACTION_ICON_URLS.diamond, kind: "diamond", label: overlayEffectLabel(mapping, "DIAMANT") };
  }
  const sandboxTntNearMatch = commandText.match(/\b(?:shenpulse_sandbox\s+\S+\s+)?sandbox\s+tntnear\s*(\d+)?/i);
  if (sandboxTntNearMatch) {
    return {
      amount: Number(sandboxTntNearMatch[1]) || void 0,
      imageUrl: presetImageUrl || INTERACTION_ICON_URLS.randomTnt,
      kind: "tnt",
      label: sandboxTntNearMatch[1] ? "x" + sandboxTntNearMatch[1] : compactTitle(mapping.title, "TNT NEAR")
    };
  }
  const sandboxTntMatch = commandText.match(/\b(?:shenpulse_sandbox\s+\S+\s+)?sandbox\s+tnt\s*(\d+)?/i);
  if (sandboxTntMatch) {
    return {
      amount: Number(sandboxTntMatch[1]) || void 0,
      imageUrl: presetImageUrl || INTERACTION_ICON_URLS.tnt,
      kind: "tnt",
      label: sandboxTntMatch[1] ? "x" + sandboxTntMatch[1] : compactTitle(mapping.title, "TNT")
    };
  }
  if (/\b(?:shenpulse_sandbox\s+\S+\s+)?sandbox\s+prison\b/i.test(commandText)) {
    return { imageUrl: presetImageUrl || INTERACTION_ICON_URLS.glassPrison, kind: "glass", label: overlayEffectLabel(mapping, "PRISON") };
  }
  const sandboxLightningMatch = commandText.match(/\b(?:shenpulse_sandbox\s+\S+\s+)?sandbox\s+lightning\s*(\d+)?/i);
  if (sandboxLightningMatch) {
    return {
      amount: Number(sandboxLightningMatch[1]) || void 0,
      imageUrl: presetImageUrl || INTERACTION_ICON_URLS.fireworks,
      kind: "command",
      label: overlayEffectLabel(mapping, sandboxLightningMatch[1] ? "x" + sandboxLightningMatch[1] + " LIGHTNING" : "LIGHTNING")
    };
  }
  const sandboxFillRowMatch = commandText.match(/\b(?:shenpulse_sandbox\s+\S+\s+)?sandbox\s+fillrow\s+[a-z_]+\s*(\d+)?/i);
  if (sandboxFillRowMatch) {
    return { imageUrl: presetImageUrl || INTERACTION_ICON_URLS.fillRows, kind: "fill", label: overlayEffectLabel(mapping, sandboxFillRowMatch[1] ? sandboxFillRowMatch[1] + " RANGEES" : "FILL ROW") };
  }
  const sandboxRandomRowMatch = commandText.match(/\b(?:shenpulse_sandbox\s+\S+\s+)?sandbox\s+randomrow\s*(\d+)?/i);
  if (sandboxRandomRowMatch) {
    return { imageUrl: presetImageUrl || INTERACTION_ICON_URLS.fillRows, kind: "fill", label: overlayEffectLabel(mapping, sandboxRandomRowMatch[1] ? sandboxRandomRowMatch[1] + " RANGEES" : "RANDOM ROW") };
  }
  const sandboxSandRowMatch = commandText.match(/\b(?:shenpulse_sandbox\s+\S+\s+)?sandbox\s+sandrow\s+[a-z_]+\s*(\d+)?/i);
  if (sandboxSandRowMatch) {
    return { imageUrl: presetImageUrl || INTERACTION_ICON_URLS.fillRows, kind: "fill", label: overlayEffectLabel(mapping, sandboxSandRowMatch[1] ? sandboxSandRowMatch[1] + " RANGEES" : "SAND ROW") };
  }
  const sandboxSandMatch = commandText.match(/\b(?:shenpulse_sandbox\s+\S+\s+)?sandbox\s+sand\s+[a-z_]+\s*(\d+)?/i);
  if (sandboxSandMatch) {
    return {
      amount: Number(sandboxSandMatch[1]) || void 0,
      imageUrl: presetImageUrl || INTERACTION_ICON_URLS.fill,
      kind: "fill",
      label: sandboxSandMatch[1] ? "x" + sandboxSandMatch[1] : overlayEffectLabel(mapping, "SABLE")
    };
  }
  const sandboxCreateMatch = commandText.match(/\b(?:shenpulse_sandbox\s+\S+\s+)?sandbox\s+create(?:\s+(\d+)\s+(\d+))?/i);
  if (sandboxCreateMatch) {
    return { imageUrl: presetImageUrl || INTERACTION_ICON_URLS.fill, kind: "fill", label: overlayEffectLabel(mapping, sandboxCreateMatch[1] ? sandboxCreateMatch[1] + "x" + sandboxCreateMatch[1] : "CREER") };
  }
  const sandboxTimerMatch = commandText.match(/\b(?:shenpulse_sandbox\s+\S+\s+)?sandbox\s+timer\s*(\d+)?/i);
  if (sandboxTimerMatch) {
    return { amount: Number(sandboxTimerMatch[1]) || void 0, imageUrl: presetImageUrl || INTERACTION_ICON_URLS.timer, kind: "timer", label: overlayEffectLabel(mapping, sandboxTimerMatch[1] ? sandboxTimerMatch[1] + "s TIMER" : "TIMER") };
  }
  const sandboxDeleteRowMatch = commandText.match(/\b(?:shenpulse_sandbox\s+\S+\s+)?sandbox\s+deleterow\s*(\d+)?/i);
  if (sandboxDeleteRowMatch) {
    return { amount: Number(sandboxDeleteRowMatch[1]) || void 0, imageUrl: presetImageUrl || INTERACTION_ICON_URLS.clear, kind: "reset", label: overlayEffectLabel(mapping, sandboxDeleteRowMatch[1] ? "-" + sandboxDeleteRowMatch[1] + " LIGNES" : "RETIRER LIGNES") };
  }
  const sandboxSpeedMatch = commandText.match(/\b(?:shenpulse_sandbox\s+\S+\s+)?sandbox\s+speed\s*(\d+)?/i);
  if (sandboxSpeedMatch) {
    return { amount: Number(sandboxSpeedMatch[1]) || void 0, imageUrl: presetImageUrl || INTERACTION_ICON_URLS.timer, kind: "timer", label: overlayEffectLabel(mapping, sandboxSpeedMatch[1] ? "VITESSE " + sandboxSpeedMatch[1] : "VITESSE") };
  }
  const sandboxRangeMatch = commandText.match(/\b(?:shenpulse_sandbox\s+\S+\s+)?sandbox\s+set\s+block_interaction_range\s*(\d+)?/i);
  if (sandboxRangeMatch) {
    return { amount: Number(sandboxRangeMatch[1]) || void 0, imageUrl: presetImageUrl || INTERACTION_ICON_URLS.radiusUp, kind: "blocks", label: overlayEffectLabel(mapping, sandboxRangeMatch[1] ? "PORTEE " + sandboxRangeMatch[1] : "PORTEE") };
  }
  const sandboxBreakSpeedMatch = commandText.match(/\b(?:shenpulse_sandbox\s+\S+\s+)?sandbox\s+set\s+block_break_speed\s*(\d+)?/i);
  if (sandboxBreakSpeedMatch) {
    return { amount: Number(sandboxBreakSpeedMatch[1]) || void 0, imageUrl: presetImageUrl || INTERACTION_ICON_URLS.timer, kind: "timer", label: overlayEffectLabel(mapping, sandboxBreakSpeedMatch[1] ? "CASSE " + sandboxBreakSpeedMatch[1] : "CASSE") };
  }
  if (/\b(?:shenpulse_sandbox\s+\S+\s+)?sandbox\s+delete\b/i.test(commandText)) return { imageUrl: presetImageUrl || INTERACTION_ICON_URLS.clear, kind: "reset", label: overlayEffectLabel(mapping, "SUPPRIMER") };
  if (/\b(?:shenpulse_sandbox\s+\S+\s+)?sandbox\s+clear\b/i.test(commandText)) return { imageUrl: presetImageUrl || INTERACTION_ICON_URLS.clear, kind: "reset", label: overlayEffectLabel(mapping, "VIDER") };
  if (/\b(?:shenpulse_sandbox\s+\S+\s+)?sandbox\s+fill\b/i.test(commandText)) return { imageUrl: presetImageUrl || INTERACTION_ICON_URLS.fill, kind: "fill", label: overlayEffectLabel(mapping, "REMPLIR") };
  if (/\b(?:shenpulse_sandbox\s+\S+\s+)?sandbox\s+glass\b/i.test(commandText)) return { imageUrl: presetImageUrl || INTERACTION_ICON_URLS.glass, kind: "glass", label: overlayEffectLabel(mapping, "VERRE") };
  if (/\b(?:shenpulse_sandbox\s+\S+\s+)?sandbox\s+wood\b/i.test(commandText)) return { imageUrl: presetImageUrl || INTERACTION_ICON_URLS.wood, kind: "blocks", label: overlayEffectLabel(mapping, "BOIS") };
  if (/\b(?:shenpulse_sandbox\s+\S+\s+)?sandbox\s+rock\b/i.test(commandText)) return { imageUrl: presetImageUrl || INTERACTION_ICON_URLS.rock, kind: "blocks", label: overlayEffectLabel(mapping, "BEDROCK") };
  if (/\b(?:shenpulse_sandbox\s+\S+\s+)?sandbox\s+stop\b/i.test(commandText)) return { imageUrl: presetImageUrl || INTERACTION_ICON_URLS.timer, kind: "timer", label: overlayEffectLabel(mapping, "STOP") };
  if (/\b(?:shenpulse_sandbox\s+\S+\s+)?sandbox\s+tp\b/i.test(commandText)) return { imageUrl: presetImageUrl || INTERACTION_ICON_URLS.tp, kind: "tp", label: overlayEffectLabel(mapping, "TP") };
  if (/\b(?:shenpulse_sandbox\s+\S+\s+)?sandbox\s+shovel\b/i.test(commandText)) return { imageUrl: presetImageUrl || INTERACTION_ICON_URLS.diamond, kind: "diamond", label: overlayEffectLabel(mapping, "PELLE") };
  if (/\b(?:shenpulse_sandbox\s+\S+\s+)?sandbox\s+edit\b/i.test(commandText)) return { imageUrl: presetImageUrl || INTERACTION_ICON_URLS.autoReplace, kind: "command", label: overlayEffectLabel(mapping, "EDIT") };
  if (/\b(?:shenpulse_sandbox\s+\S+\s+)?sandbox\s+setdefaultsand\b/i.test(commandText)) return { imageUrl: presetImageUrl || INTERACTION_ICON_URLS.fill, kind: "fill", label: overlayEffectLabel(mapping, "SABLE BASE") };
  const fillBlockMatch = commandText.match(/\bbedrock\s+fillblock\s+(\d+)/i);
  if (fillBlockMatch) {
    return {
      amount: Number(fillBlockMatch[1]) || void 0,
      imageUrl: presetImageUrl || INTERACTION_ICON_URLS.fillBlock,
      kind: "blocks",
      label: "+" + fillBlockMatch[1] + " BLOCS"
    };
  }
  const superTntMatch = commandText.match(/\bbedrock\s+supertnt\s+(\d+)/i);
  if (superTntMatch) {
    return {
      amount: Number(superTntMatch[1]) || void 0,
      imageUrl: presetImageUrl || INTERACTION_ICON_URLS.superTnt,
      kind: "super-tnt",
      label: "x" + superTntMatch[1]
    };
  }
  const weakTntMatch = commandText.match(/\bbedrock\s+weaktnt\s*(\d+)?/i);
  if (weakTntMatch) {
    return {
      amount: Number(weakTntMatch[1]) || void 0,
      imageUrl: presetImageUrl || INTERACTION_ICON_URLS.weakTnt,
      kind: "tnt",
      label: weakTntMatch[1] ? "x" + weakTntMatch[1] : "WEAK TNT"
    };
  }
  const fakeTntMatch = commandText.match(/\bbedrock\s+faketnt\s*(\d+)?/i);
  if (fakeTntMatch) {
    return {
      amount: Number(fakeTntMatch[1]) || void 0,
      imageUrl: presetImageUrl || INTERACTION_ICON_URLS.fakeTnt,
      kind: "tnt",
      label: fakeTntMatch[1] ? "x" + fakeTntMatch[1] : "FAKE TNT"
    };
  }
  const tntRocketMatch = commandText.match(/\bbedrock\s+tntrocket\s*(\d+)?/i);
  if (tntRocketMatch) {
    return {
      amount: Number(tntRocketMatch[1]) || void 0,
      imageUrl: presetImageUrl || INTERACTION_ICON_URLS.tntRocket,
      kind: "super-tnt",
      label: tntRocketMatch[1] ? "x" + tntRocketMatch[1] : "ROCKET"
    };
  }
  const tntStepMatch = commandText.match(/\bbedrock\s+tntstep\s*(\d+)?/i);
  if (tntStepMatch) {
    return {
      amount: Number(tntStepMatch[1]) || void 0,
      imageUrl: presetImageUrl || INTERACTION_ICON_URLS.tntStep,
      kind: "tnt",
      label: tntStepMatch[1] ? "x" + tntStepMatch[1] : "TNT STEP"
    };
  }
  if (/\bbedrock\s+zeustnt\b/i.test(commandText)) return { imageUrl: presetImageUrl || INTERACTION_ICON_URLS.zeusTnt, kind: "super-tnt", label: overlayEffectLabel(mapping, "ZEUS TNT") };
  if (/\bbedrock\s+tntring\b/i.test(commandText)) return { imageUrl: presetImageUrl || INTERACTION_ICON_URLS.tntRing, kind: "super-tnt", label: overlayEffectLabel(mapping, "TNT RING") };
  if (/\bbedrock\s+enderman\b/i.test(commandText)) return { imageUrl: presetImageUrl || INTERACTION_ICON_URLS.enderman, kind: "command", label: overlayEffectLabel(mapping, "ENDERMAN") };
  if (/\bbedrock\s+blackhole\b/i.test(commandText)) return { imageUrl: presetImageUrl || INTERACTION_ICON_URLS.blackhole, kind: "command", label: overlayEffectLabel(mapping, "TROU NOIR") };
  if (/\bbedrock\s+meteor\b/i.test(commandText)) return { imageUrl: presetImageUrl || INTERACTION_ICON_URLS.meteor, kind: "command", label: overlayEffectLabel(mapping, "METEOR") };
  if (/\bbedrock\s+comets\b/i.test(commandText)) return { imageUrl: presetImageUrl || INTERACTION_ICON_URLS.comets, kind: "command", label: overlayEffectLabel(mapping, "COMETES") };
  if (/\bbedrock\s+longhands\b/i.test(commandText)) return { imageUrl: presetImageUrl || INTERACTION_ICON_URLS.longhands, kind: "tp", label: overlayEffectLabel(mapping, "LONG HANDS") };
  const randomTntMatch = commandText.match(/\bbedrock\s+randomtnt\s*(\d+)?/i);
  if (randomTntMatch) {
    return {
      amount: Number(randomTntMatch[1]) || void 0,
      imageUrl: presetImageUrl || INTERACTION_ICON_URLS.randomTnt,
      kind: "tnt",
      label: randomTntMatch[1] ? "x" + randomTntMatch[1] : compactTitle(mapping.title, "TNT")
    };
  }
  const tntMatch = commandText.match(/\bbedrock\s+tnt\s*(\d+)?/i);
  if (tntMatch) {
    return {
      amount: Number(tntMatch[1]) || void 0,
      imageUrl: presetImageUrl || INTERACTION_ICON_URLS.tnt,
      kind: "tnt",
      label: tntMatch[1] ? "x" + tntMatch[1] : compactTitle(mapping.title, "TNT")
    };
  }
  if (rawText.includes("reset") || commandText.includes("bedrock clear") && commandText.includes("bedrock tp")) {
    return { imageUrl: presetImageUrl || INTERACTION_ICON_URLS.reset, kind: "reset", label: overlayEffectLabel(mapping, "RESET") };
  }
  const bedrockWinMatch = commandText.match(/\bbedrock\s+win\s+([12])\b/i);
  if (bedrockWinMatch) {
    return { imageUrl: presetImageUrl || INTERACTION_ICON_URLS.winBedrock, kind: "win", label: "+" + bedrockWinMatch[1] + " WIN", winTone: "positive" };
  }
  if (/\bbedrock\s+clear\b/i.test(commandText)) return { imageUrl: presetImageUrl || INTERACTION_ICON_URLS.clear, kind: "reset", label: overlayEffectLabel(mapping, "VIDER") };
  if (/\bbedrock\s+glass_prison\b/i.test(commandText)) return { imageUrl: presetImageUrl || INTERACTION_ICON_URLS.glassPrison, kind: "glass", label: overlayEffectLabel(mapping, "PRISON") };
  if (/\bbedrock\s+glass\b/i.test(commandText)) return { imageUrl: presetImageUrl || INTERACTION_ICON_URLS.glass, kind: "glass", label: overlayEffectLabel(mapping, "GLASS") };
  if (/\bbedrock\s+rock\b/i.test(commandText)) return { imageUrl: presetImageUrl || INTERACTION_ICON_URLS.rock, kind: "blocks", label: overlayEffectLabel(mapping, "BEDROCK") };
  if (/\bbedrock\s+wood\b/i.test(commandText)) return { imageUrl: presetImageUrl || INTERACTION_ICON_URLS.wood, kind: "blocks", label: overlayEffectLabel(mapping, "BOIS") };
  if (/\bbedrock\s+timer\b/i.test(commandText)) return { imageUrl: presetImageUrl || INTERACTION_ICON_URLS.timer, kind: "timer", label: overlayEffectLabel(mapping, "TIMER") };
  if (/\bbedrock\s+tp\b/i.test(commandText)) return { imageUrl: presetImageUrl || INTERACTION_ICON_URLS.tp, kind: "tp", label: overlayEffectLabel(mapping, "TP") };
  if (/\bbedrock\s+toplock\b/i.test(commandText)) return { imageUrl: presetImageUrl || INTERACTION_ICON_URLS.topLock, kind: "tp", label: overlayEffectLabel(mapping, "TOP LOCK") };
  if (/\bbedrock\s+autoreplace\b/i.test(commandText)) return { imageUrl: presetImageUrl || INTERACTION_ICON_URLS.autoReplace, kind: "command", label: overlayEffectLabel(mapping, "AUTO") };
  if (/\bbedrock\s+fireworks\b/i.test(commandText)) return { imageUrl: presetImageUrl || INTERACTION_ICON_URLS.fireworks, kind: "command", label: overlayEffectLabel(mapping, "FEUX") };
  if (/\bbedrock\s+heightup\b/i.test(commandText)) return { imageUrl: presetImageUrl || INTERACTION_ICON_URLS.heightUp, kind: "blocks", label: overlayEffectLabel(mapping, "HAUTEUR +") };
  if (/\bbedrock\s+heightdown\b/i.test(commandText)) return { imageUrl: presetImageUrl || INTERACTION_ICON_URLS.heightDown, kind: "blocks", label: overlayEffectLabel(mapping, "HAUTEUR -") };
  if (/\bbedrock\s+radiusup\b/i.test(commandText)) return { imageUrl: presetImageUrl || INTERACTION_ICON_URLS.radiusUp, kind: "blocks", label: overlayEffectLabel(mapping, "RAYON +") };
  if (/\bbedrock\s+radiusdown\b/i.test(commandText)) return { imageUrl: presetImageUrl || INTERACTION_ICON_URLS.radiusDown, kind: "blocks", label: overlayEffectLabel(mapping, "RAYON -") };
  if (/\bbedrock\s+fill\s+\d+/i.test(commandText)) return { imageUrl: presetImageUrl || INTERACTION_ICON_URLS.fillRows, kind: "fill", label: overlayEffectLabel(mapping, "RANGEES") };
  if (/\bbedrock\s+fill\b/i.test(commandText)) return { imageUrl: presetImageUrl || INTERACTION_ICON_URLS.fill, kind: "fill", label: overlayEffectLabel(mapping, "TOUT REMPLIR") };
  return { kind: "command", label: compactTitle(mapping.title, "ACTION") };
}

function overlayPresetImageUrl(presetId) {
  const byPresetId = {
    "bedrock-auto-replace": INTERACTION_ICON_URLS.autoReplace,
    "bedrock-clear": INTERACTION_ICON_URLS.clear,
    "bedrock-diamond": INTERACTION_ICON_URLS.diamond,
    "bedrock-fake-tnt": INTERACTION_ICON_URLS.fakeTnt,
    "bedrock-fill": INTERACTION_ICON_URLS.fill,
    "bedrock-fill-block": INTERACTION_ICON_URLS.fillBlock,
    "bedrock-fill-rows": INTERACTION_ICON_URLS.fillRows,
    "bedrock-fireworks": INTERACTION_ICON_URLS.fireworks,
    "bedrock-glass": INTERACTION_ICON_URLS.glass,
    "bedrock-glass-prison": INTERACTION_ICON_URLS.glassPrison,
    "bedrock-height-down": INTERACTION_ICON_URLS.heightDown,
    "bedrock-height-up": INTERACTION_ICON_URLS.heightUp,
    "bedrock-longhands": INTERACTION_ICON_URLS.longhands,
    "bedrock-radius-down": INTERACTION_ICON_URLS.radiusDown,
    "bedrock-radius-up": INTERACTION_ICON_URLS.radiusUp,
    "bedrock-random-tnt": INTERACTION_ICON_URLS.randomTnt,
    "bedrock-reset": INTERACTION_ICON_URLS.reset,
    "bedrock-reset-one": INTERACTION_ICON_URLS.reset,
    "bedrock-reset-two": INTERACTION_ICON_URLS.reset,
    "bedrock-rock": INTERACTION_ICON_URLS.rock,
    "bedrock-super-tnt": INTERACTION_ICON_URLS.superTnt,
    "bedrock-timer": INTERACTION_ICON_URLS.timer,
    "bedrock-tnt": INTERACTION_ICON_URLS.tnt,
    "bedrock-tnt-rocket": INTERACTION_ICON_URLS.tntRocket,
    "bedrock-tnt-ring": INTERACTION_ICON_URLS.tntRing,
    "bedrock-tnt-step": INTERACTION_ICON_URLS.tntStep,
    "bedrock-top-lock": INTERACTION_ICON_URLS.topLock,
    "bedrock-tp": INTERACTION_ICON_URLS.tp,
    "bedrock-weak-tnt": INTERACTION_ICON_URLS.weakTnt,
    "bedrock-win-one": INTERACTION_ICON_URLS.winBedrock,
    "bedrock-win-two": INTERACTION_ICON_URLS.winBedrock,
    "bedrock-wood": INTERACTION_ICON_URLS.wood,
    "bedrock-zeus-tnt": INTERACTION_ICON_URLS.zeusTnt,
    ...Object.fromEntries(SANDBOX_OVERLAY_COLOR_IDS.map((colorId) => [`sandbox-sand-${colorId}`, INTERACTION_ICON_URLS.fill])),
    ...Object.fromEntries(SANDBOX_OVERLAY_COLOR_IDS.map((colorId) => [`sandbox-sand-row-${colorId}`, INTERACTION_ICON_URLS.fillRows])),
    ...Object.fromEntries(SANDBOX_OVERLAY_COLOR_IDS.map((colorId) => [`sandbox-fill-row-${colorId}`, INTERACTION_ICON_URLS.fillRows])),
    ...Object.fromEntries(SANDBOX_OVERLAY_COLOR_IDS.map((colorId) => [`sandbox-set-default-sand-${colorId}`, INTERACTION_ICON_URLS.fill])),
    "sandbox-block-break-speed": INTERACTION_ICON_URLS.timer,
    "sandbox-block-interaction-range": INTERACTION_ICON_URLS.radiusUp,
    "sandbox-clear": INTERACTION_ICON_URLS.clear,
    "sandbox-create": INTERACTION_ICON_URLS.fill,
    "sandbox-delete": INTERACTION_ICON_URLS.clear,
    "sandbox-delete-row": INTERACTION_ICON_URLS.clear,
    "sandbox-edit": INTERACTION_ICON_URLS.autoReplace,
    "sandbox-fill": INTERACTION_ICON_URLS.fill,
    "sandbox-glass": INTERACTION_ICON_URLS.glass,
    "sandbox-lightning": INTERACTION_ICON_URLS.fireworks,
    "sandbox-prison": INTERACTION_ICON_URLS.glassPrison,
    "sandbox-random-row": INTERACTION_ICON_URLS.fillRows,
    "sandbox-rock": INTERACTION_ICON_URLS.rock,
    "sandbox-shovel": INTERACTION_ICON_URLS.diamond,
    "sandbox-speed": INTERACTION_ICON_URLS.timer,
    "sandbox-stop": INTERACTION_ICON_URLS.timer,
    "sandbox-timer": INTERACTION_ICON_URLS.timer,
    "sandbox-tnt": INTERACTION_ICON_URLS.tnt,
    "sandbox-tnt-near": INTERACTION_ICON_URLS.randomTnt,
    "sandbox-tp": INTERACTION_ICON_URLS.tp,
    "sandbox-wood": INTERACTION_ICON_URLS.wood,
    "bedrock-blackhole": INTERACTION_ICON_URLS.blackhole,
    "bedrock-comets": INTERACTION_ICON_URLS.comets,
    "bedrock-enderman": INTERACTION_ICON_URLS.enderman,
    "bedrock-meteor": INTERACTION_ICON_URLS.meteor,
    "win-add": INTERACTION_ICON_URLS.winAdd,
    "win-random": INTERACTION_ICON_URLS.winRandom,
    "win-remove": INTERACTION_ICON_URLS.winRemove,
    "win-x2": INTERACTION_ICON_URLS.winX2
  };
  return byPresetId[presetId] || "";
}

function withOverlayImage(effect, imageUrl) {
  return imageUrl && !effect.imageUrl ? { ...effect, imageUrl } : effect;
}

function detectWinEffect(commands, title) {
  for (const command of commands) {
    const x2Match = command.match(/^shenpulse_win\s+x2\b/i);
    if (x2Match) {
      return {
        kind: "win",
        label: "x2 WINS",
        multiplier: 2,
        winTone: "positive"
      };
    }
    const multiplyMatch = command.match(/^shenpulse_win\s+multiply\s+(-?\d+)/i);
    if (multiplyMatch) {
      const multiplier = Number(multiplyMatch[1]) || 1;
      return {
        kind: "win",
        label: `x${multiplier} WINS`,
        multiplier,
        winTone: multiplier >= 0 ? "positive" : "negative"
      };
    }
    const randomMatch = command.match(/^shenpulse_win\s+random\s+(\d+)/i);
    if (randomMatch) {
      const amount = Math.abs(Number(randomMatch[1]) || 0);
      return {
        amount,
        kind: "win",
        label: `+/- ${amount} WINS`,
        winTone: "random"
      };
    }
    const addMatch = command.match(/^shenpulse_win\s+add\s+(-?\d+)/i);
    if (addMatch) return winAddEffect(Number(addMatch[1]) || 0);
  }
  const x2TitleMatch = String(title || "").match(/\bx\s*2\s*wins?\b/i);
  if (x2TitleMatch) {
    return {
      kind: "win",
      label: "x2 WINS",
      multiplier: 2,
      winTone: "positive"
    };
  }
  const randomTitleMatch = String(title || "").match(/\+\/-\s*(\d+)\s*wins?/i);
  if (randomTitleMatch) {
    const amount = Math.abs(Number(randomTitleMatch[1]) || 0);
    return {
      amount,
      kind: "win",
      label: `+/- ${amount} WINS`,
      winTone: "random"
    };
  }
  const titleMatch = String(title || "").match(/([+-]\s*\d+)\s*wins?/i);
  if (titleMatch) return winAddEffect(Number(titleMatch[1].replace(/\s+/g, "")) || 0);
  return null;
}

function winAddEffect(amount) {
  return {
    amount,
    kind: "win",
    label: `${amount > 0 ? "+" : ""}${amount} WIN`,
    winTone: amount < 0 ? "negative" : "positive"
  };
}

function cleanCommand(command) {
  return String(command || "").trim().replace(/^\/+/, "").trim().replace(/\s+/g, " ");
}

function overlayEffectLabel(mapping, fallback) {
  const title = String(mapping.title || "").trim();
  const userTitle = /^(?:bedrock|sandbox|survival) command$/i.test(title) ? "" : title;
  return compactTitle(userTitle || commandTitleLabel(mapping.commands) || fallback, fallback);
}

function commandTitleLabel(commands = []) {
  for (const command of commands) {
    const match = cleanCommand(command).match(/^title\s+@a\s+title\s+"([^"]+)"$/i);
    if (match?.[1]) return match[1];
  }
  return "";
}

function compactTitle(title, fallback) {
  return String(title || fallback).trim().replace(/\s+/g, " ").slice(0, 28).toUpperCase();
}

function sortWinItems(items) {
  return [...items].sort((left, right) => {
    const leftRank = left.effect.multiplier ? 1e5 + left.effect.multiplier : Math.abs(left.effect.amount || 0);
    const rightRank = right.effect.multiplier ? 1e5 + right.effect.multiplier : Math.abs(right.effect.amount || 0);
    return leftRank - rightRank;
  });
}

export { detectOverlayEffect, overlayPresetImageUrl, withOverlayImage, detectWinEffect, winAddEffect, cleanCommand, overlayEffectLabel, commandTitleLabel, compactTitle, sortWinItems };

