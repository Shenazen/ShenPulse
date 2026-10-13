"use strict";

function gift(giftId, giftName, giftCost, alternateGiftIds = []) {
  return Object.freeze({
    giftId: String(giftId),
    giftIds: Object.freeze(
      alternateGiftIds.map((value) => String(value)).filter(Boolean)
    ),
    giftName,
    giftCost
  });
}

const TIKLIVE_DEFAULT_GIFTS = Object.freeze({
  rose: gift(5655, "Rose", 1),
  fingerHeart: gift(5487, "Cœur avec les doigts", 5),
  rosa: gift(8913, "Rosa", 10),
  gameController: gift(7569, "Manette de jeu", 100, [6581]),
  elephantTrunk: gift(8260, "Trompe d'éléphant", 299),
  gg: gift(6064, "GG", 1),
  tofu: gift(10604, "Tofu", 5),
  goldenBoxingGloves: gift(5853, "Gants de boxe dorés", 10),
  cap: gift(6104, "Casquette", 99),
  corgi: gift(6267, "Corgi", 299),
  lionMane: gift(7985, "Crinière de lion", 500, [11926]),
  silverPistol: gift(7168, "Pistolet à argent", 500),
  heartInHands: gift(6968, "Cœur dans les mains", 100, [5924, 8343]),
  friendshipNecklace: gift(9947, "Collier d'amitié", 10),
  donut: gift(5879, "Donut", 30),
  sunglasses: gift(5509, "Lunettes de soleil", 199),
  tiktok: gift(5269, "TikTok", 1),
  perfume: gift(5658, "Parfum", 20),
  signLanguageLove: gift(8259, "Amour en langage des signes", 49),
  galaxy: gift(11046, "Galaxie", 1000),
  privateJet: gift(5767, "Jet privé", 4888),
  sunsetHighway: gift(6203, "Autoroute au coucher de soleil", 10000),
  giraffe: gift(11476, "Girafe", 1000, [11491, 11879]),
  leonKitten: gift(6646, "Léon le chaton", 4888),
  octopus: gift(8417, "Pieuvre", 10000),
  sportsCar: gift(6089, "Voiture de sport", 7000),
  tomatoThrow: gift(13962, "Jet de tomates", 99),
  handsHeart: gift(5660, "Cœur avec les mains", 100),
  gemGun: gift(7122, "Pistolet à gemmes", 500),
  boxingGloves: gift(6007, "Gants de boxe", 299),
  communityHeart: Object.freeze({
    ...gift(7934, "Envoie-moi un cœur", 1),
    giftFamily: "community-heart"
  }),
  capybara: gift(14488, "Capybara", 30, [17490]),
  heartKiss: gift(6661, "Bisou du cœur", 99),
  helloBear: gift(8692, "Salut Ours", 10),
  luckyPig: gift(8825, "Porc porte-bonheur", 10),
  iceCreamCone: gift(5827, "Cornet de crème glacée", 1),
  coffee: gift(5333, "Café", 1),
  windmill: gift(5868, "Moulin à vent", 1),
  thunderHammer: gift(6635, "Marteau du tonnerre", 1),
  fairyWings: gift(8495, "Ailes de fée", 1),
  lightning: gift(6652, "Éclair", 1),
  tinyDino: gift(6560, "Petit dino", 10),
  cuteCat: gift(8655, "Chat mignon", 5),
  maxPower: gift(9537, "Puissance Max", 399),
  goldMine: gift(5587, "Mine d'or", 1000),
  stargazing: gift(
    10825,
    "Observation d'étoiles",
    2200,
    [12590, 12594, 12612, 12615]
  ),
  meteorShower: gift(6563, "Pluie de météorites", 3000),
  giant: gift(9149, "Géant", 3999)
});

function tikLiveDefaultGift(key) {
  const value = TIKLIVE_DEFAULT_GIFTS[key];
  if (!value) throw new Error(`Cadeau TikLive par défaut inconnu : ${key}`);
  return value;
}

module.exports = {
  TIKLIVE_DEFAULT_GIFTS,
  tikLiveDefaultGift
};
