# Rapport de validation — ShenPulse 1.0.9

Date : 3 août 2026
Environnement : Windows x64, Node.js 24.14.0, Electron 43.2.0,
electron-builder 26.15.3, Windows SDK 10.0.26100.0.

## Résultats

- syntaxe contrôlée sur 125 fichiers JavaScript ;
- 414 tests réussis, 0 échec ;
- compilation Vite des jeux réussie ;
- installation silencieuse de l’installeur NSIS dans un dossier isolé réussie ;
- lancement du binaire installé 1.0.9 réussi ;
- présence puis exécution du désinstalleur validées ;
- création AppX réussie par electron-builder ;
- identité `ShenPulse.ShenPulse`, version technique `1.0.9.0`, éditeur Store et architecture x64 contrôlés dans le manifeste ;
- AppXUpload ouvert et contenu contrôlé ;
- le site public passe ses 17 contrôles de build et de routes ;
- le téléchargement public 1.0.9 répond en HTTP 200 avec la taille attendue ;
- les overlays publics ont été validés puis publiés sur Firebase Hosting.

## Paiements de production

- l’API publique annonce `environment: live` et `paypalReady: true` ;
- les abonnements Pro à 9,99 EUR et Premium à 13,99 EUR sont configurés et disponibles au checkout ;
- Coin Pusher Live, Puissance 4 Arena, DealOrNoDeal et Diamond Drop Live sont disponibles à l’achat à 4,99 EUR ;
- un compte client connecté peut payer sans vérification préalable de son e-mail Firebase ;
- la vérification de l’e-mail reste obligatoire pour les opérations d’administration sensibles ;
- la route `/api/auth/desktop/redeem` est déployée et répond correctement aux codes invalides ;
- les anciens abonnements et achats de test Sandbox ont été annulés ou révoqués avant l’activation Live.

## Artefacts

| Fichier | Taille | SHA-256 |
|---|---:|---|
| `ShenPulseSetup-1.0.9-x64.exe` | 502 717 588 octets | `2BBB26543C8A723A68F8841CFF8111DEE375937F7B6BBAA42D27137545ED00C2` |
| `ShenPulseSetup-1.0.9.exe` | 502 717 588 octets | `2BBB26543C8A723A68F8841CFF8111DEE375937F7B6BBAA42D27137545ED00C2` |
| `ShenPulse-1.0.9-x64.appx` | 553 917 649 octets | `BF9675F6CE40D113EAF1162C12B22A12B42AFB9E78C849F9F42A58F01A68CCF2` |
| `ShenPulse-1.0.9-x64.appxupload` | 553 761 445 octets | `44AB49E3A6DD25022ABC16A283580B821269D8FD80C93AA2B4436BE2103FED10` |

Le fichier sans suffixe d’architecture est une copie binaire identique destinée
au chemin de téléchargement public du site.

Le site public pointe sur la 1.0.9 et le téléchargement répond en HTTP 200 avec
une taille de 502 717 588 octets. Les anciens fichiers restent disponibles afin
de ne pas casser un ancien lien direct.

Le package Store est volontairement non signé. Partner Center signe les packages
AppX/MSIX après certification. Une signature de test est uniquement nécessaire
pour le sideload local.

## Contrôles manuels restants

Le Windows App Certification Kit installé sur cette machine ne peut pas terminer
depuis la session d’agent gérée : `appcert.exe reset` exige une session utilisateur
active avec droits administrateur. Exécuter :

```powershell
appcert.exe reset
appcert.exe test `
  -appxpackagepath "C:\chemin\ShenPulse-1.0.9-x64.appx" `
  -reportoutputpath "C:\chemin\ShenPulse-WACK.xml"
```

Partner Center réexécutera ses propres contrôles lors d’un vol privé ou d’une
soumission. Aucun débit réel n’a été provoqué pendant cette validation : le dernier
contrôle fonctionnel consiste à terminer un checkout Live avec un compte payeur,
puis à confirmer l’apparition du paiement dans PayPal et du droit dans ShenPulse.

La connexion Spotify exige encore que le propriétaire de l’application OAuth
ShenPulse ajoute exactement `http://127.0.0.1:21215/spotify/callback` aux URI de
redirection autorisées dans le tableau de bord Spotify.

L’installeur direct `.exe` n’a pas de signature Authenticode : il fonctionne, mais
Windows peut afficher un avertissement. Le package Store est signé par Partner Center
après certification.
