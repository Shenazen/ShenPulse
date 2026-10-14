"use strict";

/** Analyse les messages IRC Twitch sans ouvrir de connexion réseau. */
function parseTags(value) {
  return Object.fromEntries(
    String(value)
      .split(";")
      .map((part) => {
        const [key, ...rest] = part.split("=");
        return [key, rest.join("=")];
      })
  );
}

function parseTwitchLine(line) {
  const match = line.match(/^@([^ ]+) :([^!]+)![^ ]+ ([A-Z]+) #[^ ]+ :?(.*)$/);
  if (!match) return null;
  const tags = parseTags(match[1]);
  const username = match[2];
  const command = match[3];
  const text = match[4];
  const data = {
    user: {
      id: tags["user-id"] || username,
      username,
      displayName: tags["display-name"] || username,
      subscriber: tags.subscriber === "1",
      moderator: tags.mod === "1"
    }
  };
  if (command === "PRIVMSG") {
    return { event: "chat", data: { ...data, message: text } };
  }
  if (command === "USERNOTICE") {
    const noticeType = tags["msg-id"];
    if (noticeType === "raid") {
      return { event: "raid", data: { ...data, message: text, tags } };
    }
    const subscriptionNotices = new Set([
      "sub",
      "resub",
      "subgift",
      "anonsubgift",
      "submysterygift",
      "giftpaidupgrade",
      "anongiftpaidupgrade",
      "primepaidupgrade"
    ]);
    if (subscriptionNotices.has(noticeType)) {
      return { event: "subscribe", data: { ...data, message: text, tags } };
    }
    return null;
  }
  return null;
}

module.exports = { parseTwitchLine };
