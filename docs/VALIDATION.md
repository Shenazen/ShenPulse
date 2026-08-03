# Rapport de validation — ShenPulse 1.0.9

Date : 3 août 2026
Environnement : Windows x64, Node.js 24.14.0, Electron 43.2.0,
electron-builder 26.15.3, Windows SDK 10.0.26100.0.

## Résultats

- syntaxe contrôlée sur 125 fichiers JavaScript ;
- 414 tests réussis, 0 échec ;
- compilation Vite des jeux réussie ;
- installation silencieuse de l’installeur NSIS dans un dossier isolé réussie ;
- lancement du binaire installé 1.0.9.1 réussi ;
- présence puis exécution du désinstalleur validées ;
- création AppX réussie par electron-builder ;
- identité `ShenPulse.ShenPulse`, version `1.0.9.1`, éditeur Store et architecture x64 contrôlés dans le manifeste ;
- AppXUpload ouvert et contenu contrôlé ;
- le site public passe ses 17 contrôles de build et de routes ;
- le téléchargement public 1.0.9.1 répond en HTTP 200 avec la taille attendue ;
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
| `ShenPulseSetup-1.0.9.1-x64.exe` | 502 718 928 octets | `43A3D72C3DA7A9C2A53C40EDE5E286A983752D36F965046A22D3F9B919D538ED` |
| `ShenPulseSetup-1.0.9.1.exe` | 502 718 928 octets | `43A3D72C3DA7A9C2A53C40EDE5E286A983752D36F965046A22D3F9B919D538ED` |
| `ShenPulse-1.0.9.1-x64.appx` | 553 917 687 octets | `B9E8AC2814B551EACF131DC321ECF7A2F01E46903294801F21D08C68472C3E1D` |
| `ShenPulse-1.0.9.1-x64.appxupload` | 553 761 721 octets | `DAD31FFE53503584A3EE711184156B47CA63A45292B1FE00119DC229F4728EBC` |

Le fichier sans suffixe d’architecture est une copie binaire identique destinée
au chemin de téléchargement public du site.

Le site public pointe sur la 1.0.9.1 et le téléchargement répond en HTTP 200 avec
une taille de 502 718 928 octets. Le déploiement conserve la 1.0.8.1 afin de ne
pas casser un ancien lien direct.

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
  -appxpackagepath "C:\chemin\ShenPulse-1.0.9.1-x64.appx" `
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
