"use strict";

/** Données et règles du domaine Minecraft « mappings » ; identifiants publics inchangés. */


function mapping(id, effectId, title, options = {}) {
  return Object.freeze({
    id,
    effectId,
    title,
    triggerType: options.triggerType || "gift",
    threshold: Number(options.threshold || 1),
    giftName: options.giftName || "",
    cooldownSeconds: Number(options.cooldownSeconds || 0),
    parameters: Object.freeze({ ...(options.parameters || {}) }),
    amount: options.amount,
    operation: options.operation,
    duration: options.duration,
    enabled: options.enabled !== false
  });
}

const BEDROCK_DEFAULT_MAPPINGS = [
  mapping("bedrock-follow-tnt-1", "bedrock-tnt", "1x TNT", {
    triggerType: "follow",
    parameters: { count: 1 }
  }),
  mapping("bedrock-likes-150-tnt-1", "bedrock-tnt", "1x TNT", {
    triggerType: "like",
    threshold: 150,
    parameters: { count: 1 }
  }),
  mapping("bedrock-rose-tnt", "bedrock-tnt", "1x TNT", {
    giftName: "Rose",
    parameters: { count: 1 }
  }),
  mapping("bedrock-finger-heart-tnt-3", "bedrock-tnt", "3x TNT", {
    giftName: "Finger Heart",
    parameters: { count: 3 }
  }),
  mapping("bedrock-doughnut-tnt-20", "bedrock-tnt", "20x TNT", {
    giftName: "Doughnut",
    parameters: { count: 20 }
  }),
  mapping("bedrock-cap-tnt-80", "bedrock-tnt", "80x TNT", {
    giftName: "Cap",
    parameters: { count: 80 }
  }),
  mapping("bedrock-forever-rosa-tnt-1000", "bedrock-tnt", "1000x TNT", {
    giftName: "Forever Rosa",
    parameters: { count: 1000 }
  }),
  mapping("bedrock-heart-me-fillblock-5", "bedrock-fill-block", "+5 blocs", {
    giftName: "Heart Me",
    parameters: { count: 5 }
  }),
  mapping("bedrock-tofu-fillblock-30", "bedrock-fill-block", "+30 blocs", {
    giftName: "Tofu",
    parameters: { count: 30 }
  }),
  mapping("bedrock-perfume-fillblock-100", "bedrock-fill-block", "+100 blocs", {
    giftName: "Perfume",
    parameters: { count: 100 }
  }),
  mapping("bedrock-boxing-gloves-reset", "bedrock-reset", "Reset", {
    giftName: "Boxing Gloves"
  }),
  mapping("bedrock-elephant-trunk-fill", "bedrock-fill", "Tout remplir", {
    giftName: "Elephant Trunk"
  }),
  mapping("bedrock-corgi-win-x2", "win-x2", "X2 WIN", {
    giftName: "Corgi",
    amount: 2,
    operation: "multiplier",
    duration: 60
  }),
  mapping("bedrock-money-gun-win-minus-1", "win-remove", "-1 WIN", {
    giftName: "Money Gun",
    amount: -1,
    operation: "adjust"
  }),
  mapping("bedrock-youre-amazing-win-plus-1", "win-add", "+1 WIN", {
    giftName: "You’re Amazing",
    amount: 1,
    operation: "adjust"
  }),
  mapping("bedrock-ellie-elephant-win-plus-20", "win-add", "+20 WINS", {
    giftName: "Ellie the Elephant",
    amount: 20,
    operation: "adjust"
  }),
  mapping("bedrock-girafa-win-minus-3", "win-remove", "-3 WINS", {
    giftName: "Girafa",
    amount: -3,
    operation: "adjust"
  }),
  mapping("bedrock-leon-kitten-win-minus-20", "win-remove", "-20 WINS", {
    giftName: "Leon the Kitten",
    amount: -20,
    operation: "adjust"
  }),
  mapping("bedrock-voiture-course-win-minus-50", "win-remove", "-50 WINS", {
    giftName: "Voiture de course",
    amount: -50,
    operation: "adjust"
  }),
  mapping("bedrock-lion-win-random-200", "win-random", "+/- 200 WINS", {
    giftName: "Lion",
    amount: 200,
    operation: "random"
  }),
  mapping("bedrock-galaxy-win-plus-3", "win-add", "+3 WINS", {
    giftName: "Galaxy",
    amount: 3,
    operation: "adjust"
  }),
  mapping("bedrock-interstellar-win-plus-45", "win-add", "+45 WINS", {
    giftName: "Interstellar",
    amount: 45,
    operation: "adjust"
  }),
  mapping("bedrock-gg-fillblock-5", "bedrock-fill-block", "+5 blocs", {
    giftName: "GG",
    parameters: { count: 5 }
  }),
  mapping("bedrock-cote-a-cote-blackhole", "bedrock-blackhole", "Trou noir", {
    giftName: "Côte à Côte",
    parameters: { seconds: 10 }
  }),
  mapping("bedrock-urso-misha-tnt-ring", "bedrock-tnt-ring", "Anneau TNT", {
    giftName: "Urso Misha"
  }),
  mapping("bedrock-panda-escalador-zeus-tnt", "bedrock-zeus-tnt", "Zeus TNT", {
    giftName: "Panda Escalador"
  }),
  mapping("bedrock-go-popular-enderman", "bedrock-enderman", "Enderman", {
    giftName: "Go Popular",
    parameters: { count: 1 }
  }),
  mapping("bedrock-family-fireworks", "bedrock-fireworks", "Feux d’artifice", {
    giftName: "Family"
  })
];

const SANDBOX_DEFAULT_MAPPINGS = [
  mapping("sandbox-follow-tnt-1", "sandbox-tnt", "1x TNT", {
    triggerType: "follow",
    parameters: { count: 1 }
  }),
  mapping("sandbox-likes-150-tnt-1", "sandbox-tnt", "1x TNT", {
    triggerType: "like",
    threshold: 150,
    parameters: { count: 1 }
  }),
  mapping("sandbox-rose-red-sand", "sandbox-sand-red", "1x Sable rouge", {
    giftName: "Rose",
    parameters: { count: 1 }
  }),
  mapping("sandbox-tiktok-blue-row", "sandbox-sand-row-blue", "Ligne bleue", {
    giftName: "TikTok",
    parameters: { rows: 1 }
  }),
  mapping("sandbox-gg-random-row", "sandbox-random-row", "Ligne hasard", {
    giftName: "GG",
    parameters: { rows: 1 }
  }),
  mapping("sandbox-finger-heart-tnt", "sandbox-tnt", "1x TNT", {
    giftName: "Finger Heart",
    parameters: { count: 1 },
    cooldownSeconds: 2
  }),
  mapping("sandbox-heart-me-fillrow", "sandbox-fill-row-magenta", "2x Fill row", {
    giftName: "Heart Me",
    parameters: { rows: 2 },
    cooldownSeconds: 3
  }),
  mapping("sandbox-perfume-tntnear", "sandbox-tnt-near", "3x TNT proche", {
    giftName: "Perfume",
    parameters: { count: 3 },
    cooldownSeconds: 4
  }),
  mapping("sandbox-cap-prison", "sandbox-prison", "Prison", {
    giftName: "Cap",
    parameters: { seconds: 10 },
    cooldownSeconds: 5
  }),
  mapping("sandbox-fireworks-lightning", "sandbox-lightning", "Éclairs", {
    giftName: "Fireworks",
    parameters: { count: 3 },
    cooldownSeconds: 5
  }),
  mapping("sandbox-corgi-win-x2", "win-x2", "X2 WIN", {
    giftName: "Corgi",
    amount: 2,
    operation: "multiplier",
    duration: 60
  }),
  mapping("sandbox-money-gun-win-minus-1", "win-remove", "-1 WIN", {
    giftName: "Money Gun",
    amount: -1,
    operation: "adjust"
  }),
  mapping("sandbox-youre-amazing-win-plus-1", "win-add", "+1 WIN", {
    giftName: "You’re Amazing",
    amount: 1,
    operation: "adjust"
  }),
  mapping("sandbox-ellie-elephant-win-plus-20", "win-add", "+20 WINS", {
    giftName: "Ellie the Elephant",
    amount: 20,
    operation: "adjust"
  }),
  mapping("sandbox-girafa-win-minus-3", "win-remove", "-3 WINS", {
    giftName: "Girafa",
    amount: -3,
    operation: "adjust"
  }),
  mapping("sandbox-leon-kitten-win-minus-20", "win-remove", "-20 WINS", {
    giftName: "Leon the Kitten",
    amount: -20,
    operation: "adjust"
  }),
  mapping("sandbox-voiture-course-win-minus-55", "win-remove", "-55 WINS", {
    giftName: "Voiture de course",
    amount: -55,
    operation: "adjust"
  }),
  mapping("sandbox-lion-win-random-200", "win-random", "+/- 200 WINS", {
    giftName: "Lion",
    amount: 200,
    operation: "random"
  })
];

module.exports = { mapping, BEDROCK_DEFAULT_MAPPINGS, SANDBOX_DEFAULT_MAPPINGS };

