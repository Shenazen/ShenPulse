"use strict";

/** Construit les données de simulation sans réseau ni mutation du magasin. */
const { preferredImageUrl, safeString } = require("../utils");
const { defaultTestEventCount } = require("./trigger-policy");

function createTestEvent(type = "gift", overrides = {}, username = "shenpulse") {
  const account = username || "shenpulse";
  const viewer =
    safeString(overrides.username || overrides.uniqueId || "test_viewer", 120)
      .replace(/^@+/, "") || "test_viewer";
  const nickname = safeString(
    overrides.nickname || overrides.displayName || "Spectateur test",
    160
  );
  const count = Math.max(
    1,
    Number(
      overrides.count ?? defaultTestEventCount(type)
    )
  );
  const shared = {
    uniqueId: viewer,
    nickname,
    channelUsername: account,
    profilePictureUrl: safeString(
      overrides.avatarUrl || overrides.profilePictureUrl || "",
      1000
    )
  };
  const samples = {
    gift: {
      event: "gift",
      data: {
        ...shared,
         giftId: safeString(overrides.giftId || "rose", 120),
         giftName: safeString(overrides.giftName || "Rose", 160),
         giftImageUrl: preferredImageUrl(
           overrides.giftImageUrl,
           overrides.giftPictureUrl,
           overrides.giftImage
         ),
         repeatCount: Math.max(1, Number(overrides.repeatCount ?? count)),
         value: Math.max(1, Number(overrides.value || 1))
      }
    },
    follow: { event: "follow", data: shared },
    like: {
      event: "like",
      data: {
        ...shared,
        likeCount: Math.max(1, Number(overrides.likeCount ?? count))
      }
    },
    chat: {
      event: "chat",
      data: {
        ...shared,
        comment: safeString(
          overrides.message || overrides.comment || "!help",
          1000
        )
      }
    },
    share: { event: "share", data: shared },
    subscribe: { event: "subscribe", data: shared },
    join: { event: "join", data: shared },
    raid: {
      event: "raid",
      data: {
        ...shared,
        count,
        viewers: Number(overrides.viewers || count)
      }
    }
  };
  return samples[type] || samples.gift;
}

module.exports = { createTestEvent };
