"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const overlayCatalog = require("../resources/overlays/overlay-catalog");
const { root, renderer, rendererCss, overlayCss, overlayRuntime, coinJarPhysics, overlayHtml, sourceHub, overlayDefaults, stateStore } = require("./helpers/catalog-regression-fixtures");

/** Rendus, couleurs, positions et médias propres aux overlays. */

test("le Like Goal classique garde son ratio et remplit le cadre intérieur", () => {
  assert.match(rendererCss, /\.preview-theme-classic/);
  assert.match(rendererCss, /aspect-ratio:\s*6\.5\s*\/\s*1/);
  assert.match(overlayCss, /\[data-theme="classic"\] \.like-goal-bar/);
  assert.match(overlayCss, /inset:\s*21% 8\.5% 19%/);
  assert.equal(overlayCatalog.defaultConfig("likeGoal").schemaVersion, 2);
  assert.equal(overlayCatalog.defaultConfig("likeGoal").scale, 100);
  assert.match(
    overlayDefaults,
    /likeGoal:\s*\{[\s\S]*schemaVersion:\s*2[\s\S]*scale:\s*100/
  );
  assert.match(
    stateStore,
    /overlayId === "likeGoal"[\s\S]*Number\(saved\.scale\) === 60[\s\S]*merged\.scale = 100/
  );
});

test("les anciennes couleurs Like Goal alimentent les trois couleurs de texte", () => {
  assert.match(
    stateStore,
    /merged\.likeGoalTitleColor\s*=\s*[\s\S]*saved\.textColor/
  );
  assert.match(
    stateStore,
    /merged\.likeGoalContentColor\s*=\s*[\s\S]*saved\.textColor/
  );
  assert.match(
    stateStore,
    /merged\.likeGoalPercentColor\s*=\s*[\s\S]*saved\.secondaryColor/
  );
});

test("les deux designs de roue prevus utilisent aussi le rendu OBS reel", () => {
  assert.match(renderer, /\["classic", "Orange classique"\]/);
  assert.match(renderer, /\["royal", "Royale Prestige"\]/);
  assert.match(
    renderer,
    /overlayLivePreview\(item, config, \{ compact: true \}\)/
  );
  assert.match(renderer, /data-wheel-design-thumbnail/);
  assert.match(
    renderer,
    /wheelDesignOption\("classic"[\s\S]*wheelDesignOption\("royal"/
  );
});

test("la roue ne superpose plus de rayons jaunes aux secteurs", () => {
  const finalWheelRules = overlayCss.slice(
    overlayCss.indexOf(".wheel-stage .wheel-frame::after")
  );
  assert.doesNotMatch(
    finalWheelRules,
    /repeating-conic-gradient\(from -90deg,\s*rgba\(255,\s*235,\s*176/
  );
  assert.doesNotMatch(
    finalWheelRules,
    /repeating-conic-gradient\(from -90deg,\s*rgba\(255,\s*255,\s*255,\s*\.22\)/
  );
  assert.doesNotMatch(
    finalWheelRules,
    /repeating-conic-gradient\(from -90deg,\s*rgba\(255,\s*221,\s*99/
  );
  assert.doesNotMatch(overlayRuntime, /sectorSeparators|repeating-conic-gradient\(from -90deg/);
});

test("les textes, les couleurs et le gagnant de la roue utilisent le même angle", () => {
  assert.match(overlayRuntime, /conic-gradient\(from 0deg/);
  assert.match(
    overlayRuntime,
    /const stopAngle = 360 - \(winnerIndex \+ 0\.5\) \* segmentAngle/
  );
});

test("les timers gardent seulement les commandes icone lecture pause et reset", () => {
  const timerActions =
    renderer.match(
      /if \(\["timer", "multiplierTimer"\]\.includes\(item\.key\)\) \{([\s\S]*?)\r?\n  \}\r?\n  const definitions/
    )?.[1] || "";

  assert.match(timerActions, /data-operation="pause"/);
  assert.match(timerActions, /data-operation="reset"/);
  assert.match(timerActions, /overlay-quick-icon/);
  assert.match(timerActions, /aria-label="\$\{toggleLabel\}"/);
  assert.doesNotMatch(timerActions, /data-operation="add"|data-operation="remove"/);
});

test("les vidéos Match utilisent un lecteur local exclusif et protégé par compte", () => {
  const firebaseConfig = fs.readFileSync(
    path.join(root, "firebase.json"),
    "utf8"
  );

  const definitions = overlayCatalog.definitionsWithUrls({
    publicUrls: { matchPlayer: "https://public.invalid/m/123/channel" },
    localUrls: { matchPlayer: "http://127.0.0.1/match-player" }
  });
  const matchDefinitions = definitions.filter(
    (definition) => definition.previewKind === "match"
  );
  assert.equal(matchDefinitions.length, overlayCatalog.matches.length);
  assert.ok(
    matchDefinitions.every(
      (definition) =>
        definition.delivery === "public" &&
        definition.url === "https://public.invalid/m/123/channel"
    )
  );
  assert.match(renderer, /Source Match protégée/);
  assert.match(renderer, /Copier pour TikTok Studio/);
  assert.match(renderer, /typeof creatorMatchesStudioSourceUrl === "function"/);
  assert.doesNotMatch(renderer, /matchVideoPaths|updateMatchVideoPathUi/);
  assert.doesNotMatch(renderer, /data-action="(?:prepare-match-video|copy-match-video-path)"/);
  assert.doesNotMatch(renderer, /api\.prepareMatchVideo/);
  assert.match(renderer, /Pro ou Premium actif/);
  assert.match(renderer, /Régénérer l’URL Match/);
  assert.match(renderer, /type: "overlay\.match"/);
  assert.match(overlayRuntime, /matchPlaybackQueue\?\.enqueue\(request\)/);
  assert.match(overlayRuntime, /matchTicketUrl\(request\)/);
  assert.match(overlayRuntime, /\/match-bridge\//);
  assert.match(overlayRuntime, /video\.addEventListener\("ended", \(\) =>/);
  assert.match(firebaseConfig, /media\/video\/\*\*/);
});

test("la Coin Jar utilise les images cadeaux et les empile au fond", () => {
  assert.match(overlayRuntime, /event\.data\?\.giftImageUrl/);
  assert.match(overlayRuntime, /document\.createElement\("img"\)/);
  assert.match(overlayRuntime, /CoinJarPhysics\.giftDiameter/);
  assert.match(overlayRuntime, /Math\.floor\(requestedCount\)/);
  assert.match(overlayRuntime, /scheduleGift\(index \+ 1\)/);
  assert.match(overlayRuntime, /gift\.state !== "spilled"/);
  assert.doesNotMatch(overlayRuntime, /Math\.min\(40,/);
  assert.doesNotMatch(overlayRuntime, /coinJarDrops\.length >= 120/);
  assert.match(overlayRuntime, /if \(operation === "reset"\) clearCoinJarDrops\(\)/);
  assert.doesNotMatch(overlayRuntime, /fill\.style\.height/);
  assert.doesNotMatch(overlayRuntime, /classList\.add\("packing"\)/);
  assert.match(overlayRuntime, /runtime\.recentEvents[\s\S]*spawnCoinJarDrop\(event\)/);
  assert.doesNotMatch(overlayRuntime, /setTimeout\(\(\) => node\.remove\(\), 8000\)/);
  assert.match(
    overlayHtml,
    /runtime\/loader\.js/
  );
  assert.match(overlayRuntime, /if \(view === "coin-jar"\) scripts\.push\("coin-jar-physics\.js"\)/);
  assert.match(overlayRuntime, /scripts\.push\("runtime\/configuration\.js", "runtime\/design\.js"\)/);
  assert.match(
    overlayCss,
    /\.coin-jar-widget\s*\{[\s\S]*width:\s*min\(69\.444444vw,\s*96\.153846vh\)[\s\S]*aspect-ratio:\s*1/
  );
  assert.doesNotMatch(overlayCss, /data-jar-model[^\{]*#coin-jar-back/);
  assert.doesNotMatch(overlayCss, /#coin-jar-back\s*\{[\s\S]*?transform:/);
  assert.match(overlayHtml, /id="coin-jar-glass-clip"/);
  assert.match(overlayHtml, /id="coin-jar-motion-clip"/);
  assert.match(
    overlayHtml,
    /M \.31 \.09 L \.69 \.09[\s\S]*L \.785 \.80[\s\S]*L \.34 \.925[\s\S]*L \.215 \.31/
  );
  assert.match(
    overlayHtml,
    /id="coin-jar-contained-drops"[\s\S]*id="coin-jar-overflow-drops"[\s\S]*id="coin-jar-exterior-drops"/
  );
  assert.match(overlayCss, /\.coin-jar-contained-drops\s*\{[\s\S]*clip-path:\s*polygon\(/);
  assert.match(overlayCss, /\.coin-jar-overflow-drops\s*\{[\s\S]*clip-path:\s*polygon\(/);
  assert.match(overlayRuntime, /gift\.state === "spilled"[\s\S]*\? exteriorLayer/);
  assert.match(overlayRuntime, /function coinJarGiftRandom\(/);
  assert.match(overlayRuntime, /gift\.y - visualRadius >= coinJarGeometry\.mouthTop/);
  assert.match(overlayRuntime, /jar-test-back-clean-localized\.png/);
  assert.match(overlayHtml, /id="coin-jar-level"/);
  assert.match(overlayHtml, /id="coin-jar-current"[\s\S]*id="coin-jar-target"/);
  assert.match(overlayHtml, /coin-jar-meter/);
  assert.match(overlayCss, /\.coin-jar-meter/);
  assert.doesNotMatch(overlayRuntime, /packContainedBodies/);
  assert.doesNotMatch(coinJarPhysics, /packContainedBodies/);
  assert.doesNotMatch(overlayCss, /rgba\(255,\s*213,\s*82/);
  assert.doesNotMatch(overlayHtml, /class="coin-jar-label"/);
  assert.match(renderer, /giftImageUrl:\s*selectedGift\?\.imageUrl/);
});

test("les objectifs gardent leur cadre devant la progression et les timers n'ont plus de barre", () => {
  assert.match(overlayHtml, /class="like-goal-frame-slice slice-bottom"/);
  assert.match(
    overlayCss,
    /:where\(\[data-theme\]:not\(\[data-theme="classic"\]\)\) \.like-goal-widget/
  );
  assert.match(overlayCss, /\.like-goal-frame-foreground\s*\{[\s\S]*z-index:\s*3/);
  assert.match(
    overlayCss,
    /\[data-theme\]:not\(\[data-theme="classic"\]\) \.like-goal-bar\s*\{[\s\S]*z-index:\s*2/
  );
  assert.doesNotMatch(overlayHtml, /class="timer-line"/);
  assert.doesNotMatch(overlayCss, /\.timer-line/);
});

test("les matchs expliquent leur source protégée et les super fans ne deviennent pas des abonnements", () => {
  assert.match(renderer, /function renderMatchOverlayGuide\(\)/);
  assert.match(renderer, /Largeur<\/strong> · 1080 px/);
  assert.match(renderer, /Hauteur<\/strong> · 1920 px/);
  assert.doesNotMatch(renderer, /Utiliser les 8 Matchs comme fichiers vidéo temporaires/);
  assert.doesNotMatch(sourceHub, /WebcastEvent\.SUPER_FAN/);
  assert.match(sourceHub, /WebcastSubNotifyMessage: "subscribe"/);
  assert.match(sourceHub, /tiktokDecodedEventType\(messageType, event\)/);
});

test("la roue et son son démarrent immédiatement puis le son s'arrête avec la rotation", () => {
  assert.match(
    overlayRuntime,
    /wheel\.style\.animationDelay = "0s"/
  );
  assert.doesNotMatch(
    overlayRuntime,
    /soundStartTimer/
  );
  assert.match(
    overlayRuntime,
    /if \(wheelBoolean\(wheelRuntimeSettings\.soundActive, true\)\) \{\s*startSpinSound\(\);\s*\}/
  );
  assert.match(
    overlayRuntime,
    /}, spinSeconds \* 1000\);/
  );
  assert.doesNotMatch(overlayRuntime, /const announceSeconds =/);
});

test("le Like Goal montre le palier atteint avant de calculer le suivant", () => {
  assert.match(
    overlayRuntime,
    /renderLikeGoal\(\{ preserveTarget: true, forceVisible: true, animate: true \}\)/
  );
  assert.match(
    overlayRuntime,
    /likeGoalCompletionTimer = setTimeout\(\(\) => \{[\s\S]*renderLikeGoal\(\);[\s\S]*\}, 1200\)/
  );
  assert.match(
    overlayRuntime,
    /options\.preserveTarget \?\? Boolean\(likeGoalCompletionTimer\)/
  );
  assert.match(
    overlayRuntime,
    /if \(eventId && interactiveEventIds\.has\(eventId\)\) return/
  );
});

test("les sources OBS utilisent toute leur hauteur et contiennent les widgets", () => {
  assert.match(overlayCss, /html,\s*body,\s*#overlay-root\s*\{[\s\S]*height:\s*100%/);
  assert.match(
    overlayCss,
    /#timer-view\.active,[\s\S]*#multiplier-timer-view\.active[\s\S]*align-items:\s*center/
  );
  assert.match(
    overlayCss,
    /\[data-theme\]:not\(\[data-theme="classic"\]\) \.timer-panel[\s\S]*width:\s*613\.2px;[\s\S]*height:\s*336px;/
  );
  assert.match(
    overlayCss,
    /\.view\.active\.native-overlay-canvas[\s\S]*scale\(var\(--native-canvas-scale, 1\)\)/
  );
  assert.match(
    overlayCss,
    /#leaderboard-view \.leaderboard-widget[\s\S]*calc\(\(100vh - 44px\) \* 0\.75\)/
  );
  assert.match(
    overlayCss,
    /\.wheel-stage \.wheel-machine[\s\S]*calc\(\(100vh - 20px\) \/ 1\.22\)/
  );
  assert.match(
    overlayRuntime,
    /let overlayFontSize = viewName === "wheel"\s*\?\s*1/
  );
});

test("les classements alignent les profils dans chaque cadre et restaurent le classique royal", () => {
  assert.match(
    overlayRuntime,
    /const leaderboardRankCrown = "widgets\/leaderboard\/rank-crown\.webp"/
  );
  assert.match(
    overlayRuntime,
    /leaderboardRankMedals[\s\S]*rank-medal-1\.webp[\s\S]*rank-medal-3\.webp/
  );
  assert.match(
    overlayRuntime,
    /leaderboardRankRings[\s\S]*rank-ring-1\.webp[\s\S]*rank-ring-3\.webp/
  );
  assert.match(
    overlayRuntime,
    /avatarUrl: safeLeaderboardAvatarUrl\(user\.avatarUrl\) \|\| current\.avatarUrl/
  );
  assert.match(
    overlayRuntime,
    /Array\.from\(\{ length: maxRows \}[\s\S]*leaderboard-avatar-image[\s\S]*leaderboard-avatar-fallback/
  );
  assert.match(
    overlayCss,
    /\[data-theme="classic"\] #leaderboard-view \.leaderboard-widget[\s\S]*border:\s*2px solid[\s\S]*linear-gradient/
  );
  assert.match(
    overlayCss,
    /grid-template-rows:\s*repeat\(var\(--leaderboard-row-count,\s*5\),\s*minmax\(0,\s*1fr\)\)/
  );
  for (const theme of [
    "akatsuki",
    "assassination-classroom",
    "cult-of-the-lamb",
    "demon-slayer",
    "dragon-ball",
    "fairy-tail",
    "gta",
    "harry-potter",
    "minecraft",
    "naruto",
    "one-piece",
    "stardew-valley",
    "terraria"
  ]) {
    assert.match(
      overlayCss,
      new RegExp(
        `\\[data-theme="${theme}"\\] #leaderboard-view \\.leaderboard-widget[\\s\\S]*?--leaderboard-rows-top:`
      )
    );
  }
  assert.match(
    overlayCss,
    /\[data-theme="assassination-classroom"\] #leaderboard-view \.leaderboard-widget[\s\S]*?--leaderboard-rows-right:\s*10\.75%[\s\S]*?--leaderboard-rows-left:\s*12\.69%[\s\S]*?aspect-ratio:\s*67\s*\/\s*120[\s\S]*?overflow:\s*hidden/
  );
  assert.match(
    overlayCss,
    /\[data-theme="assassination-classroom"\] #leaderboard-view #leaderboard-frame\s*\{[\s\S]*?inset:\s*0 auto 0 -34\.328%[\s\S]*?width:\s*134\.328%/
  );
  for (const asset of [
    "rank-crown.webp",
    "rank-medal-1.webp",
    "rank-medal-2.webp",
    "rank-medal-3.webp",
    "rank-ring-1.webp",
    "rank-ring-2.webp",
    "rank-ring-3.webp"
  ]) {
    assert.ok(
      fs.existsSync(
        path.join(root, "resources", "overlays", "media", "widgets", "leaderboard", asset)
      ),
      `${asset} doit rester embarqué`
    );
  }
});

