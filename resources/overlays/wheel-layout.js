"use strict";

(function exposeWheelLayout(root, factory) {
  const layout = factory();
  if (typeof module === "object" && module.exports) module.exports = layout;
  if (root) root.WheelLayout = layout;
})(typeof globalThis === "object" ? globalThis : this, () => {
  const REFERENCE_DIAMETER = 420;

  function clamp(value, minimum, maximum) {
    return Math.min(maximum, Math.max(minimum, Number(value) || 0));
  }

  function visualUnits(value) {
    return Array.from(String(value || "").trim()).reduce((total, character) => {
      if (/\s/.test(character)) return total + 0.34;
      if (/[MW@%#]/i.test(character)) return total + 1.18;
      if (/[Iil1'.,:;!|]/.test(character)) return total + 0.48;
      return total + 1;
    }, 0);
  }

  function wrappedLineCount(value, capacity) {
    const words = String(value || "").trim().split(/\s+/).filter(Boolean);
    if (!words.length) return 1;
    const safeCapacity = Math.max(1, capacity);
    let lines = 1;
    let current = 0;

    words.forEach((word) => {
      let remaining = visualUnits(word);
      const separator = current > 0 ? 0.55 : 0;
      if (current + separator + remaining <= safeCapacity) {
        current += separator + remaining;
        return;
      }
      if (current > 0) {
        lines += 1;
        current = 0;
      }
      if (remaining > safeCapacity) {
        const fullLines = Math.floor(remaining / safeCapacity);
        lines += Math.max(0, fullLines - (remaining % safeCapacity === 0 ? 1 : 0));
        remaining %= safeCapacity;
      }
      current = remaining;
    });

    return lines;
  }

  function uprightRotation(value) {
    let rotation = Number(value) || 0;
    const normalized = ((rotation % 360) + 360) % 360;
    if (normalized > 90 && normalized < 270) rotation += 180;
    return rotation;
  }

  function resolveFontScale({
    label,
    segmentCount,
    widthPercent,
    heightPercent,
    settings
  }) {
    const configuredSize = clamp(settings.fontSize || 50, 10, 120);
    const baseFontPixels = (0.48 + configuredSize / 100) * 16;
    const lineHeight = 0.84 + clamp(settings.lineSpacing ?? 50, 0, 100) / 140;
    const configuredLines = clamp(settings.textMaxLines || 4, 1, 4);
    const shouldClamp = settings.textClamp === true || settings.textClamp === "true";
    const countScale = clamp(1 - Math.max(0, segmentCount - 5) * 0.045, 0.5, 1);
    const minimumScale = clamp(8 / baseFontPixels, 0.34, 0.82);
    const widthPixels = Math.max(8, widthPercent / 100 * REFERENCE_DIAMETER);
    const heightPixels = Math.max(8, heightPercent / 100 * REFERENCE_DIAMETER);
    let scale = Math.max(minimumScale, countScale);
    let availableLines = 1;

    while (scale >= minimumScale - 0.001) {
      const fontPixels = Math.max(8, baseFontPixels * scale);
      const lineCapacity = widthPixels / (fontPixels * 0.56);
      const heightLines = Math.max(1, Math.floor(heightPixels / (fontPixels * lineHeight)));
      availableLines = shouldClamp
        ? Math.min(configuredLines, heightLines)
        : heightLines;
      if (wrappedLineCount(label, lineCapacity) <= availableLines) break;
      scale = Math.max(minimumScale, scale - 0.04);
      if (scale === minimumScale) {
        const minimumFontPixels = Math.max(8, baseFontPixels * scale);
        const minimumCapacity = widthPixels / (minimumFontPixels * 0.56);
        const minimumHeightLines = Math.max(
          1,
          Math.floor(heightPixels / (minimumFontPixels * lineHeight))
        );
        availableLines = shouldClamp
          ? Math.min(configuredLines, minimumHeightLines)
          : minimumHeightLines;
        break;
      }
    }

    return {
      fontScale: Number(scale.toFixed(3)),
      maxLines: Math.max(1, Math.floor(availableLines))
    };
  }

  function resolveSegmentLayout({
    index = 0,
    segmentCount = 2,
    label = "",
    design = "classic",
    settings = {}
  } = {}) {
    const count = Math.round(clamp(segmentCount, 2, 16));
    const segmentAngle = 360 / count;
    const centerAngle = segmentAngle * index + segmentAngle / 2 - 90;
    const segmentOffset = clamp(settings.textSegmentOffset || 0, -100, 100) / 100;
    const angle = centerAngle + segmentOffset * segmentAngle * 0.46;
    const orientation = settings.textOrientation === "vertical" ? "radial" : "tangent";
    const innerRadius = design === "royal" ? 19.5 : 18;
    const outerRadius = design === "royal" ? 46.3 : 47.2;
    const middleRadius = (innerRadius + outerRadius) / 2;
    const countBias = clamp((count - 6) * 0.16, -0.55, 1.6);
    const radiusScale = clamp((settings.textRadius || 100) / 100, 0.2, 1.35);
    const radius = clamp(
      (middleRadius + countBias) * radiusScale,
      innerRadius + 2,
      outerRadius - 2
    );
    const radians = angle * Math.PI / 180;
    const x = 50 + Math.cos(radians) * radius;
    const y = 50 + Math.sin(radians) * radius;
    const rawRotation = orientation === "radial" ? angle : angle + 90;
    const rotation = uprightRotation(
      rawRotation + clamp(settings.textAngleOffset || 0, -180, 180)
    );
    const segmentRadians = segmentAngle * Math.PI / 180;
    const radialLimit = Math.max(
      5,
      Math.min(radius - innerRadius, outerRadius - radius) * 2 * 0.9
    );
    const widthFactor = clamp((settings.textBoxWidth || 100) / 100, 0.45, 2.6);
    const heightFactor = clamp((settings.textBoxHeight || 240) / 240, 0.2, 1.34);
    let widthPercent;
    let heightPercent;

    if (orientation === "radial") {
      widthPercent = Math.max(
        4,
        radialLimit * clamp(widthFactor * 0.78, 0.4, 0.92)
      );
      const innerTextRadius = Math.max(innerRadius + 1, radius - widthPercent / 2);
      const tangentialLimit = clamp(
        2 * innerTextRadius * Math.tan(Math.min(segmentRadians / 2, Math.PI / 3)) * 0.78,
        5,
        50
      );
      heightPercent = Math.max(
        4,
        tangentialLimit * clamp(heightFactor * 0.64, 0.3, 0.82)
      );
    } else {
      heightPercent = Math.max(
        4,
        radialLimit * clamp(heightFactor * 0.58, 0.25, 0.72)
      );
      const innerTextRadius = Math.max(innerRadius + 1, radius - heightPercent / 2);
      const tangentialLimit = clamp(
        2 * innerTextRadius * Math.tan(Math.min(segmentRadians / 2, Math.PI / 3)) * 0.78,
        5,
        50
      );
      widthPercent = Math.max(
        4,
        tangentialLimit * clamp(widthFactor * 0.9, 0.4, 1)
      );
    }
    const typography = resolveFontScale({
      label,
      segmentCount: count,
      widthPercent,
      heightPercent,
      settings
    });

    return {
      segmentAngle,
      radius,
      x,
      y,
      rotation,
      widthPercent,
      heightPercent,
      orientation,
      ...typography
    };
  }

  return {
    resolveSegmentLayout,
    uprightRotation,
    visualUnits,
    wrappedLineCount
  };
});
