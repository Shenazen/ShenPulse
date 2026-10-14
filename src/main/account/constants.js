"use strict";

/** Endpoints et délais historiques ; aucune politique d'authentification n'est changée ici. */
const FIREBASE_API_KEY = "AIzaSyDHcC8ngIhy2Av8N7J-XdCQq9G8KimGGJk";
const FIREBASE_DATABASE_URL =
  "https://shenazenoverlay-default-rtdb.firebaseio.com";
const IDENTITY_BASE_URL = "https://identitytoolkit.googleapis.com/v1";
const TOKEN_BASE_URL = "https://securetoken.googleapis.com/v1";
const DEFAULT_WEB_ORIGIN = "https://shenpulse.leuridan.fr";
const BROWSER_AUTH_TIMEOUT_MS = 10 * 60 * 1000;
const GOOGLE_LOOPBACK_PORT = 21216;
const TRIAL_ENTITLEMENT_LEASE_MS = 10 * 60 * 1000;

module.exports = { FIREBASE_API_KEY, FIREBASE_DATABASE_URL, IDENTITY_BASE_URL, TOKEN_BASE_URL, DEFAULT_WEB_ORIGIN, BROWSER_AUTH_TIMEOUT_MS, GOOGLE_LOOPBACK_PORT, TRIAL_ENTITLEMENT_LEASE_MS };
