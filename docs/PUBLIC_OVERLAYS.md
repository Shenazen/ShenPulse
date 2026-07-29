# Overlays publics ShenPulse

## Objectif

TikTok LIVE Studio n'accepte pas toujours les sources navigateur en
`127.0.0.1`. ShenPulse fournit donc deux transports qui utilisent le même moteur
de widgets :

- le serveur local HTTP/SSE reste disponible pour OBS et les aperçus internes ;
- le relais Firebase fournit des URL HTTPS permanentes pour TikTok LIVE Studio.

Le flux local ne dépend jamais du cloud. Une coupure Internet ne bloque donc ni
le moteur d'actions ni OBS.

## Architecture

- `src/shared/public-overlay-protocol.js` construit les URL, réduit l'état
  publié et convertit les médias locaux en ressources HTTPS ;
- `src/main/public-overlay-relay.js` gère l'identité de l'installation, les
  jetons Firebase, les lots d'événements, les états, la présence et la
  reconnexion ;
- `resources/overlays/overlay.js` choisit automatiquement SSE local ou Firebase
  REST Streaming selon la présence du paramètre `channel` ;
- `firebase/database.rules.json` autorise la lecture du canal public mais
  réserve toute écriture à l'identité qui l'a créé ;
- `firebase.json` déploie le moteur de widgets et ses ressources sur le site
  Firebase Hosting `shenpulse-overlays`.

Les événements très rapprochés sont groupés pendant 40 ms, avec un maximum de
250 messages par écriture. L'état persistant est condensé et publié au plus
toutes les 350 ms. Les sources se reconnectent automatiquement et reprennent
l'état courant ou celui du dernier live.

## Sécurité et confidentialité

Le canal est un identifiant aléatoire de 192 bits qui agit comme un lien de
lecture. Il ne contient ni jeton local, ni mot de passe, ni clé API privée.
L'identité Firebase et son refresh token sont créés automatiquement par
installation ; le mot de passe et le refresh token sont stockés avec
`safeStorage`.

Seuls les champs nécessaires aux widgets quittent l'application : objectifs,
état de session minimal, état courant des overlays, statistiques agrégées et
événements destinés à l'affichage. Les listes d'identifiants d'audience, les
paramètres, les règles et les secrets ne sont jamais publiés.

Le bouton **Régénérer les URL** supprime l'ancien canal et crée un nouvel
identifiant. Toutes les anciennes sources deviennent alors inutilisables.

## Déploiement

```powershell
firebase deploy --only "database,hosting" --project shenazenoverlay
```

Le test réel et réversible crée un compte et un canal temporaires, vérifie
l'écriture, la lecture publique, le widget et une ressource graphique, puis
supprime les données :

```powershell
node scripts/smoke-public-overlay-relay.js
```

Les tests unitaires sont dans `tests/public-overlay-protocol.test.js` et
`tests/public-overlay-relay.test.js`.
