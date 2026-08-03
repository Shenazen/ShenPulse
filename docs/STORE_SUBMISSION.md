# Publication Microsoft Store

## Identité intégrée

| Champ | Valeur |
|---|---|
| Package/Identity/Name | `ShenPulse.ShenPulse` |
| Publisher | `CN=F6F04997-3A7F-4EC3-8492-5BB9FCC0FE46` |
| PublisherDisplayName | `ShenPulse` |
| PFN attendu | `ShenPulse.ShenPulse_mammcwaggkw0m` |
| Store ID | `9NDR71Z41ZJG` |

`npm run build:store` génère `dist/ShenPulse-1.0.9.1-x64.appx` ainsi que le
conteneur recommandé `dist/ShenPulse-1.0.9.1-x64.appxupload`. Le Microsoft Store
accepte le format AppX pour une application Desktop Bridge et le resigne pour la
distribution. L'identité Store est déjà renseignée dans `package.json`.

## Actions humaines obligatoires avant l'envoi

1. Fournir l’URL publique de politique de confidentialité
   `https://shenpulse.leuridan.fr/confidentialite` et l’URL de support
   `https://shenpulse.leuridan.fr/docs`.
2. Utiliser les captures 16:9 du dossier `store-screenshots`.
3. Créer ou actualiser la fiche âge/contenu dans Partner Center.
4. Décrire et justifier la capacité `runFullTrust` : elle est requise pour les
   connexions locales aux jeux, OBS et périphériques choisis par l'utilisateur.
5. Charger le package dans le produit Store `9NDR71Z41ZJG`.
6. Lancer le Windows App Certification Kit puis un vol privé Partner Center.
7. Tester la connexion de chaque plateforme avec de vrais identifiants de
   production et vérifier leurs conditions d'utilisation.

## Signature locale

Le package produit par défaut est destiné à Partner Center. Pour un sideload de
test, créez un certificat de test dont le sujet correspond exactement au
Publisher, signez avec `SignTool`, puis installez le certificat dans le magasin
Trusted People de la machine de test. Ne distribuez jamais la clé privée.

## Limites externes

Les secrets OAuth, approbations d'API, URL légales et comptes de test ne peuvent
pas être fabriqués dans le dépôt. Une soumission publique ne doit être déclarée
prête qu'après leur fourniture et validation.
