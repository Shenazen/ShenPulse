# Rapport de validation — ShenPulse 1.0.7

Date : 2 août 2026
Environnement : Windows x64, Node.js 24.14.0, Electron 43.2.0,
electron-builder 26.15.3, Windows SDK 10.0.26100.0.

## Résultats

- syntaxe contrôlée sur 118 fichiers JavaScript ;
- 380 tests réussis, 0 échec ;
- installation silencieuse de l’installeur NSIS dans un dossier isolé réussie ;
- lancement du binaire installé 1.0.7.0 réussi ;
- présence puis exécution du désinstalleur validées ;
- création AppX réussie par electron-builder ;
- identité `ShenPulse.ShenPulse`, version `1.0.7.0` et architecture x64 contrôlées ;
- AppXUpload ouvert et contenu contrôlé par le script de build.

## Artefacts

| Fichier | Taille | SHA-256 |
|---|---:|---|
| `ShenPulseSetup-1.0.7-x64.exe` | 502 695 031 octets | `1DCCC7EEA1E91E591288BA948AD729BFBB4CD3CA9575A2A251BF6F5DF718DA47` |
| `ShenPulseSetup-1.0.7.exe` | 502 695 031 octets | `1DCCC7EEA1E91E591288BA948AD729BFBB4CD3CA9575A2A251BF6F5DF718DA47` |
| `ShenPulse-1.0.7-x64.appx` | 553 887 355 octets | `4571599BE2C73DA041CFE444FEA8A5F84FCB2F30BBC6CD1164603909D75E1214` |
| `ShenPulse-1.0.7-x64.appxupload` | 553 731 508 octets | `26CC984E399864FB939BD2AE0AA8807D9553B33C51865108456BA1C69A924C0B` |

Le fichier sans suffixe d’architecture est une copie binaire identique destinée
au chemin de téléchargement public du site.

Le package Store est volontairement non signé. Partner Center signe les packages
AppX/MSIX après certification. Une signature de test est uniquement nécessaire
pour le sideload local.

## Contrôle restant dans une session administrateur interactive

Le Windows App Certification Kit installé sur cette machine n'a pas pu terminer
depuis la session d'agent gérée : `appcert.exe reset` reste en attente car le WACK
exige une session utilisateur active avec droits administrateur. Exécuter :

```powershell
appcert.exe reset
appcert.exe test `
  -appxpackagepath "C:\chemin\ShenPulse-1.0.7-x64.appx" `
  -reportoutputpath "C:\chemin\ShenPulse-WACK.xml"
```

Partner Center réexécutera ses propres contrôles lors d'un vol privé ou d'une
soumission.
