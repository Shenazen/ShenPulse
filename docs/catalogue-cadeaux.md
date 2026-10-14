# Catalogue cadeaux : identité et visuel

Le cadeau **Cœur sur moi** rassemble les libellés historiques `Heart Me`,
`Envoie-moi un cœur` et `Cœur de la communauté`. Le catalogue embarqué associait
ces identifiants correctement, mais le classement de ses sources choisissait
le dessin ancien de `Heart Me` : un cœur rouge couronné. Le visuel actuel du
cadeau `17712` représente des cœurs entrelacés dorés, comme dans la référence.

`src/shared/gift-identity.js` centralise son URL HTTPS fournie par le
[CDN TikTok](https://p16-webcast.tiktokcdn.com/img/alisg/webcast-sg/resource/dad7a63955f98891958e37071bb067f3.png~tplv-obj.webp).
`src/main/catalogs/gifts.js` harmonise uniquement le visuel **affiché dans le
catalogue** de cette famille. Les autres cadeaux ne sont pas modifiés.

## Préservation des associations

- Les ID techniques, les alias, les conditions et les actions existants restent
  inchangés. Aucune migration ou réécriture du fichier d'état n'est nécessaire.
- Les règles des profils, les interactions des jeux et les sons continuent
  d'identifier les cadeaux par ID ou famille, jamais par leur image.
- Les visuels personnalisés reçus dans les événements LIVE restent disponibles
  dans `giftImageUrl`; le catalogue expose son visuel générique séparément.
- Le cache du renderer remplace ses anciens objets par les objets actualisés,
  y compris derrière les alias de noms et d'ID déjà chargés. Cela évite un ancien
  visuel dans les listes ou les sélecteurs après un rafraîchissement.

La récupération des cadeaux de la salle utilise `fetchAvailableGifts()` du
[connecteur embarqué](https://github.com/zerodytrash/TikTok-Live-Connector), qui
appelle `gift/list/` avec le `room_id`. Ce connecteur est **non officiel** : le
catalogue local reste disponible si TikTok ne répond pas. Les identifiants des
cadeaux et leurs visuels peuvent évoluer; ce test n'est pas une garantie sur
tous les cadeaux futurs ou personnalisés.

## Contrôle

`node --test tests/gift-catalog-integrity.test.js tests/gift-identity.test.js tests/catalogs.test.js`

Les tests vérifient le visuel de `17712`, la conservation des alias, le
fonctionnement de conditions enregistrées pour les jeux/actions/sons/profils,
la non-mutation des données d'entrée et l'actualisation des caches.
