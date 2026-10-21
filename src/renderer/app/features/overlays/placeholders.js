"use strict";

/**
 * Aperçus légers et fidèles affichés avant les sources OBS.
 *
 * Ce module ne charge que les médias du design sélectionné. Les iframes
 * restent gérées séparément par catalog.js.
 */
function overlayPlaceholderTimer(seconds = 0, showHours = true) {
  const total = Math.max(0, Math.round(Number(seconds) || 0));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const remainingSeconds = total % 60;
  return showHours
    ? [hours, minutes, remainingSeconds].map((value) => String(value).padStart(2, "0")).join(":")
    : [minutes + hours * 60, remainingSeconds].map((value) => String(value).padStart(2, "0")).join(":");
}

function overlayPlaceholderMediaUrl(item, relativePath) {
  if (!relativePath) return "";
  const encodedPath = String(relativePath)
    .split("/")
    .map((part) => encodeURIComponent(part))
    .join("/");
  if (globalThis.location?.protocol === "file:") {
    try {
      return new URL(
        `../../resources/overlays/media/${encodedPath}`,
        globalThis.location.href
      ).toString();
    } catch {
      // The authorized local overlay server remains a safe fallback.
    }
  }
  const runtimeUrl = overlayCatalogPreviewUrl(item) || item?.url || "";
  if (!runtimeUrl) return "";
  try {
    const source = new URL(runtimeUrl);
    const token = source.searchParams.get("token");
    const route = source.searchParams.has("channel") && !token
      ? `/media/${encodedPath}`
      : `/overlay/media/${encodedPath}`;
    const media = new URL(route, source.origin);
    if (token) media.searchParams.set("token", token);
    if (snapshot?.appVersion) media.searchParams.set("v", snapshot.appVersion);
    return media.toString();
  } catch {
    return "";
  }
}

function overlayPlaceholderImage(item, relativePath, className) {
  const source = overlayPlaceholderMediaUrl(item, relativePath);
  return source
    ? `<img class="${className}" src="${escapeHtml(source)}" alt="" decoding="sync">`
    : "";
}

function overlayPlaceholderThemePath(kind, design) {
  if (!design || design === "classic") return "";
  return `widgets/interactive-overlays/${kind}-theme-${design}.webp`;
}

function overlayPlaceholderNumber(
  value,
  fallback = 0,
  minimum = -1000000,
  maximum = 1000000
) {
  const parsed = Number(value);
  return Math.min(
    maximum,
    Math.max(minimum, Number.isFinite(parsed) ? parsed : fallback)
  );
}

function overlayPlaceholderColor(value, fallback) {
  const color = String(value || "").trim();
  return /^#[0-9a-f]{3,8}$/i.test(color) ? color : fallback;
}

function overlayPlaceholderLikeGoal(item, config, design) {
  design = overlayCatalog.normalizeDesign("likeGoal", design);
  const current = Math.max(0, overlayPlaceholderNumber(config.current));
  const target = Math.max(
    1,
    overlayPlaceholderNumber(config.target, 50000, 1)
  );
  const percent = Math.min(100, Math.round((current / target) * 100));
  const framePath = overlayPlaceholderThemePath("like-goal", design);
  const frame = overlayPlaceholderImage(
    item,
    framePath,
    "overlay-placeholder-frame"
  );
  const foreground = `<span class="overlay-placeholder-like-foreground" aria-hidden="true">
        ${["top", "right", "bottom", "left"].map((side) =>
          overlayPlaceholderImage(
            item,
            framePath,
            `overlay-placeholder-frame overlay-placeholder-frame-slice overlay-placeholder-frame-slice--${side}`
          )
        ).join("")}
      </span>`;
  const title = config.showHeader === false
    ? ""
    : `<strong>${escapeHtml(config.title || item.name)}</strong>`;
  const progressLabel = config.showGoal !== false && config.progressLabel
    ? ` <span>${escapeHtml(config.progressLabel)}</span>`
    : "";
  const percentLabel = config.showPercent === false
    ? ""
    : ` <b>${percent}%</b>`;
  const values = `<small>${Math.round(current).toLocaleString("fr-FR")} / ${Math.round(target).toLocaleString("fr-FR")}${progressLabel}${percentLabel}</small>`;
  const style = [
    `--placeholder-progress:${percent}%`,
    `--placeholder-title-color:${overlayPlaceholderColor(config.likeGoalTitleColor, "#ffffff")}`,
    `--placeholder-content-color:${overlayPlaceholderColor(config.likeGoalContentColor, "#ffffff")}`,
    `--placeholder-percent-color:${overlayPlaceholderColor(config.likeGoalPercentColor, "#ff4f86")}`,
    `--placeholder-title-scale:${overlayPlaceholderNumber(config.likeGoalTitleScale, 100, 50, 400) / 100}`,
    `--placeholder-content-scale:${overlayPlaceholderNumber(config.likeGoalContentScale, 100, 50, 400) / 100}`
  ].join(";");
  return `<div class="overlay-placeholder-like-goal is-themed" data-placeholder-theme="${escapeHtml(design)}" style="${style}">
    ${frame}
    <span class="overlay-placeholder-like-bar"><i></i></span>
    <span class="overlay-placeholder-like-copy">${title}${values}</span>
    ${foreground}
  </div>`;
}

function overlayPlaceholderTimerCard(item, config, design) {
  design = overlayCatalog.normalizeDesign(item.key, design);
  const framePath = overlayPlaceholderThemePath("timer", design);
  const multiplier = item.key === "multiplierTimer"
    ? `<b>X${Math.round(overlayPlaceholderNumber(config.multiplier, 2, 2, 5))}</b>`
    : "";
  const title = config.showHeader === false
    ? ""
    : `<small>${escapeHtml(config.title || item.name)}</small>`;
  const style = [
    `--timer-title-color:${overlayPlaceholderColor(config.timerTitleColor, "#ffffff")}`,
    `--timer-value-color:${overlayPlaceholderColor(config.timerValueColor, "#ffffff")}`,
    `--timer-multiplier-color:${overlayPlaceholderColor(config.timerMultiplierColor, "#ffe575")}`,
    `--timer-title-scale:${overlayPlaceholderNumber(config.timerTitleScale, 100, 50, 400) / 100}`,
    `--timer-value-scale:${overlayPlaceholderNumber(config.timerValueScale, 100, 50, 400) / 100}`
  ].join(";");
  return `<div class="overlay-placeholder-timer is-standard is-themed" data-placeholder-theme="${escapeHtml(design)}" style="${style}">
    ${overlayPlaceholderImage(item, framePath, "overlay-placeholder-frame")}
    <span class="overlay-placeholder-timer-copy">${title}<strong>${overlayPlaceholderTimer(config.seconds, config.showHours !== false)}${multiplier}</strong></span>
  </div>`;
}

function overlayPlaceholderLeaderboard(item, config, design) {
  design = overlayCatalog.normalizeDesign(item.key, design || config.theme);
  const framePath = overlayPlaceholderThemePath("leaderboard", design);
  const isTappers = item.key === "topTappers";
  const unit = config.leaderboardShowUnit === false ? "" : String(config.leaderboardMetricLabel ?? (isTappers ? "likes" : "coins")).trim();
  const scores = isTappers ? [2450, 1870, 920] : [820, 540, 310];
  const maxRows = Math.round(
    overlayPlaceholderNumber(config.maxRows, 5, 1, 5)
  );
  const medal = (rank) => config.showRankBadges === false || rank > 3
    ? ""
    : overlayPlaceholderImage(
        item,
        `widgets/leaderboard/rank-medal-${rank}.webp`,
        "overlay-placeholder-medal"
      );
  const ring = (rank) => config.showRankBadges === false || rank > 3
    ? ""
    : overlayPlaceholderImage(
        item,
        `widgets/leaderboard/rank-ring-${rank}.webp`,
        "overlay-placeholder-ring"
      );
  const crown = config.showCrown === false
    ? ""
    : overlayPlaceholderImage(
        item,
        "widgets/leaderboard/rank-crown.webp",
        "overlay-placeholder-crown"
      );
  const rows = Array.from({ length: maxRows }, (_entry, index) => {
    const rank = index + 1;
    if (rank > 3) {
      return '<span class="overlay-placeholder-leaderboard-row is-empty"></span>';
    }
    return `<span class="overlay-placeholder-leaderboard-row" style="--leaderboard-row-y:var(--leaderboard-slot-${rank}-y)">
      <b class="overlay-placeholder-rank" ${config.showRank === false ? "hidden" : ""}>${medal(rank)}<i>${rank}</i></b>
      <i class="overlay-placeholder-avatar" ${config.showAvatars === false ? "hidden" : ""}><span class="overlay-placeholder-avatar-window">A</span>${ring(rank)}${rank === 1 ? crown : ""}</i>
      <span><strong>APERÇU ${rank}</strong><em ${config.showMetricLabel === false ? "hidden" : ""}><span class="overlay-placeholder-score-number">${scores[index]}</span>${unit ? ` <span class="overlay-placeholder-score-unit">${escapeHtml(unit)}</span>` : ""}</em></span>
    </span>`;
  }).join("");
  const style = [
    `--leaderboard-title-color:${overlayPlaceholderColor(config.leaderboardTitleColor || config.textColor, "#ffffff")}`,
    `--leaderboard-name-color:${overlayPlaceholderColor(config.nameColor, "#ffffff")}`,
    `--leaderboard-score-color:${overlayPlaceholderColor(config.scoreColor, isTappers ? "#ff8db8" : "#ffe575")}`,
    `--leaderboard-rank-color:${overlayPlaceholderColor(config.rankColor, "#ffe575")}`,
    `--leaderboard-row-opacity:${overlayPlaceholderNumber(config.rowOpacity, 68, 0, 100) / 100}`,
    `--leaderboard-unit-color:${overlayPlaceholderColor(config.leaderboardUnitColor || config.scoreColor, isTappers ? "#ff8db8" : "#ffe575")}`,
    `--leaderboard-avatar-scale:${overlayPlaceholderNumber(config.leaderboardAvatarScale, 100, 50, 100) / 100}`,
    ...["Title", "Name", "Score", "Unit"].map((part) => `--leaderboard-${part.toLowerCase()}-scale:${overlayPlaceholderNumber(config[`leaderboard${part}Scale`], 100, 50, 400) / 100}`)
  ].join(";");
  return `<div class="overlay-placeholder-leaderboard is-themed ${config.showAvatars === false ? "without-avatars" : ""} ${config.showRank === false ? "without-rank" : ""}" data-placeholder-theme="${escapeHtml(design)}" style="${style}">
    ${overlayPlaceholderImage(item, framePath, "overlay-placeholder-frame")}
    <span class="overlay-placeholder-leaderboard-copy">
      ${config.showHeader === false ? "" : `<strong>${escapeHtml(config.title || item.name)}</strong>`}
      <span class="overlay-placeholder-leaderboard-rows">${rows}</span>
    </span>
  </div>`;
}

function overlayPlaceholderCoinJar(item, config, design) {
  const model = design || config.model || "fantasy";
  const backName = model === "fantasy"
    ? "jar-test-back-clean-localized.png"
    : `jar-${model}-back.png`;
  const frontName = model === "fantasy"
    ? "jar-test-front-smooth8.png"
    : `jar-${model}-front.png`;
  return `<div class="overlay-placeholder-coin-jar">
    ${overlayPlaceholderImage(item, `widgets/coin-jar/${backName}`, "overlay-placeholder-jar-back")}
    ${overlayPlaceholderImage(item, `widgets/coin-jar/${frontName}`, "overlay-placeholder-jar-front")}
  </div>`;
}

function overlayPlaceholderWinCounter(item, config, design) {
  design = overlayCatalog.normalizeDesign("winCounter", design || config.theme);
  const raw = Math.round(
    overlayPlaceholderNumber(config.current ?? config.value)
  );
  const value = config.allowNegative === false ? Math.max(0, raw) : raw;
  const color = value < 0
    ? overlayPlaceholderColor(config.winCounterLabelColorNegative, "#ff4f6d")
    : value > 0
      ? overlayPlaceholderColor(config.winCounterLabelColorPositive, "#31ff74")
      : overlayPlaceholderColor(config.winCounterLabelColorNeutral, "#f8fafc");
  const style = [
    `--placeholder-win-color:${color}`,
    `--wins-title-color:${overlayPlaceholderColor(config.winCounterTitleColor || config.textColor, "#ffffff")}`,
    `--wins-goal-color:${overlayPlaceholderColor(config.winCounterGoalColor || config.textColor, "#ffffff")}`,
    ...["Title", "Value", "Goal"].map((part) => `--wins-${part.toLowerCase()}-scale:${overlayPlaceholderNumber(config[`winCounter${part}Scale`], 100, 50, 400) / 100}`)
  ].join(";");
  return `<div class="overlay-placeholder-wins is-themed" data-placeholder-theme="${escapeHtml(design)}" style="${style}">
    <i class="overlay-placeholder-win-backdrop"></i>
    ${overlayPlaceholderImage(item, overlayPlaceholderThemePath("win-counter", design), "overlay-placeholder-frame")}
    <span class="overlay-placeholder-win-copy">
      ${config.showHeader === false ? "" : `<small>${escapeHtml(config.title || "WIN")}</small>`}
      <strong>${value}</strong>
      ${config.showGoal === false ? "" : `<span>OBJECTIF <b>${Math.round(overlayPlaceholderNumber(config.target, 20, 1))}</b></span>`}
    </span>
  </div>`;
}

function overlayPlaceholderWheel(config, design) {
  const normalized = normalizeWheelConfig(config);
  const selected = normalized.wheels.find(
    (wheel) => wheel.id === normalized.selectedWheelId
  ) || normalized.wheels[0] || {};
  const segments = selected.segments?.length
    ? selected.segments.slice(0, 10)
    : ["Cadeau", "Défi", "Bonus", "Gage"].map((label) => ({ label }));
  const palette = design === "royal"
    ? ["#5f310b", "#eabf65", "#1d143b", "#ca8f2e", "#fff0a6", "#6f3b13"]
    : ["#ff6a00", "#111111", "#f59f00", "#2a1207", "#ff8a1f", "#1e1e1e"];
  const step = 100 / segments.length;
  const stops = segments.map((segment, index) => {
    const color = overlayPlaceholderColor(
      segment.color,
      palette[index % palette.length]
    );
    return `${color} ${(index * step).toFixed(2)}% ${((index + 1) * step).toFixed(2)}%`;
  }).join(",");
  const labels = segments.map((segment, index) =>
    `<span style="--placeholder-segment:${index};--placeholder-segments:${segments.length}">${escapeHtml(segment.label || `Action ${index + 1}`)}</span>`
  ).join("");
  return `<div class="overlay-placeholder-wheel ${design === "royal" ? "is-royal" : "is-classic"}">
    <span class="overlay-placeholder-wheel-machine">
      <i class="overlay-placeholder-wheel-pointer"></i>
      <span class="overlay-placeholder-wheel-frame">
        <span class="overlay-placeholder-wheel-disc" style="background:conic-gradient(${stops})">${labels}</span>
        <i class="overlay-placeholder-wheel-cap">✦</i>
      </span>
      <i class="overlay-placeholder-wheel-stand"></i>
    </span>
  </div>`;
}

function overlayPlaceholderMatch(item, design) {
  const variant = item.match === "enigma" ? "tikcontrol" : design;
  const posterPath = `video/posters/${item.match}-${variant}.webp`;
  return `<div class="overlay-placeholder-match has-poster">
    ${overlayPlaceholderImage(item, posterPath, "overlay-placeholder-match-poster")}
  </div>`;
}

function overlayCardPlaceholder(item, config = {}) {
  const kind = String(item.previewKind || "generic");
  const design = selectedOverlayDesign(item) || "classic";
  if (kind === "like-goal") {
    return overlayPlaceholderLikeGoal(item, config, design);
  }
  if (kind === "timer") {
    return overlayPlaceholderTimerCard(item, config, design);
  }
  if (kind === "leaderboard") {
    return overlayPlaceholderLeaderboard(item, config, design);
  }
  if (kind === "coin-jar") {
    return overlayPlaceholderCoinJar(item, config, design);
  }
  if (kind === "win-counter") {
    return overlayPlaceholderWinCounter(item, config, design);
  }
  if (kind === "wheel") {
    return overlayPlaceholderWheel(config, design);
  }
  if (kind === "match") {
    return overlayPlaceholderMatch(item, design);
  }
  if (item.key === "myActions") {
    return `<div class="overlay-placeholder-my-actions"><span><i></i><strong>${escapeHtml(config.title || item.name)}</strong></span></div>`;
  }
  return `<div class="overlay-placeholder-generic"><span class="overlay-placeholder-icon">${escapeHtml(item.icon)}</span><strong>${escapeHtml(config.title || item.name)}</strong></div>`;
}
