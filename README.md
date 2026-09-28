# 📅 Stream Scheduler Pro (V4)

Un outil web open-source et "serverless" (fonctionnant à 100% dans le navigateur) pour générer des images de planning de stream prêtes à être partagées sur les réseaux sociaux.

Pensé pour les créateurs de contenu, cet outil allie la simplicité d'un générateur automatique à la flexibilité d'un logiciel de design.

## ✨ Fonctionnalités Principales

- **🔌 Double Acquisition de Données** :
  - **Auto (Twitch API)** : Récupère automatiquement les streams prévus, les horaires et télécharge les jaquettes officielles des jeux.
  - **Manuel (Multi-Lives)** : Un éditeur intégré pour créer des jours complexes (plusieurs streams par jour, horaires de début et fin optionnels).
- **🎨 4 Styles Visuels Uniques** :
  - Classique (Cartes avec effet verre dépoli / Glassmorphism)
  - Minimaliste (Lignes pures et néons)
  - Néon (Effets de lueur "Gaming Glow")
  - Polaroid (Cartes blanches avec ombres portées)
- **📱 Multi-Format** : Bascule instantanée entre le mode Paysage (16:9, idéal pour Twitter/Discord) et le mode Portrait (Vertical, adapté aux stories Insta/TikTok).
- **🌐 Intégration FontAwesome & Google Fonts** : Prévisualisation en direct de polices pro et gestion dynamique jusqu'à 4 réseaux sociaux avec icônes officielles.
- **💾 Persistance des Données** : Sauvegarde automatique locale (Local Storage) et export complet du projet en `.json`.

## 🚀 Héberger son propre générateur

Ce projet est conçu pour être hébergé **gratuitement sur GitHub Pages**. Aucune base de données ni serveur Node.js n'est requis.

### 1. Obtenir un Client ID Twitch
1. Connectez-vous à la [Twitch Developer Console](https://dev.twitch.tv/console/apps).
2. Cliquez sur **Register Your Application**.
3. **Important** : Dans *OAuth Redirect URLs*, mettez l'URL exacte où votre site sera hébergé (ex: `https://votre-pseudo.github.io/votre-depot/`).
4. Catégorie : *Website Integration*. Type : *Confidential*.

### 2. Configurer le code
Ouvrez le fichier `app.js` et modifiez la constante à la ligne 153 :
```javascript
const TWITCH_CLIENT_ID = 'VOTRE_CLIENT_ID_TWITCH_ICI';