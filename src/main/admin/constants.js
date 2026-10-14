"use strict";

/** admin : module « constants », sans initialisation externe au chargement. */


const ADMIN_EMAIL = "alexandre.leuridan@gmail.com";

const FIREBASE_API_KEY = "AIzaSyDHcC8ngIhy2Av8N7J-XdCQq9G8KimGGJk";

const FIREBASE_DATABASE_URL =
  "https://shenazenoverlay-default-rtdb.firebaseio.com";

const SHENPULSE_API_URL = "https://shenpulse.leuridan.fr";

const PUBLIC_VISIBILITY_SECTIONS = Object.freeze([
  "navigation",
  "features",
  "actionTypes",
  "overlays",
  "games"
]);

const VISIBILITY_SECTIONS = Object.freeze([
  "navigation",
  "features",
  "games",
  "overlays",
  "setupFeatures",
  "actionTypes",
  "maintenanceFeatures"
]);

module.exports = { ADMIN_EMAIL, FIREBASE_API_KEY, FIREBASE_DATABASE_URL, SHENPULSE_API_URL, PUBLIC_VISIBILITY_SECTIONS, VISIBILITY_SECTIONS };

