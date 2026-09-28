# 📅 Générateur de Planning Twitch

Un outil web open-source fonctionnant entièrement côté client (Frontend-only) pour générer des images de planning de stream prêtes à être partagées sur les réseaux sociaux (Twitter, Discord, Instagram).

Il récupère automatiquement votre agenda depuis Twitch, télécharge les jaquettes officielles des jeux, et vous permet de personnaliser le design avant d'exporter le tout en PNG haute définition.

## ✨ Fonctionnalités

- **🔌 Intégration Twitch API** : Récupère automatiquement les dates, heures, titres et catégories de vos streams prévus.
- **🖼️ Jaquettes Officielles** : Affiche automatiquement les pochettes (Box Art) des jeux prévus via l'API Twitch/IGDB.
- **🎨 Personnalisation** : Uploadez votre propre image de fond. Les cartes des jours utilisent un effet de *Glassmorphism* (verre dépoli) pour s'adapter à votre arrière-plan.
- **💾 Sauvegarde Locale & JSON** : Votre configuration (fond, préférences) est sauvegardée automatiquement dans votre navigateur. Vous pouvez aussi l'exporter en fichier `.json` pour la transférer.
- **🔒 Respect de la Vie Privée (Serverless)** : L'application fonctionne 100% dans votre navigateur (HTML/JS/Canvas). Aucune donnée n'est envoyée vers un serveur tiers.

## 🚀 Utilisation (Pour les Streamers)

Une version hébergée de cet outil est disponible ici :
👉 **[Lien vers votre GitHub Pages]** *(ex: https://MaqzBenz.github.io/twitch-schedule-generator/)*

1. Cliquez sur **Connexion & Récupérer le planning**.
2. Autorisez l'application à lire votre agenda Twitch.
3. Personnalisez votre fond d'écran si vous le souhaitez.
4. Cliquez sur **Télécharger le Planning (PNG)**.

## 🛠️ Configuration (Pour les Développeurs)

Si vous souhaitez forker ce projet ou l'héberger vous-même, vous devez créer votre propre application Twitch pour obtenir un **Client ID**.

### 1. Créer une application sur Twitch
1. Allez sur la [Twitch Developer Console](https://dev.twitch.tv/console/apps).
2. Cliquez sur **Register Your Application**.
3. Remplissez le nom.
4. **Très important :** Dans *OAuth Redirect URLs*, mettez l'URL exacte où votre site sera hébergé (ex: `http://localhost:5500/` pour le développement local, ou `https://MaqzBenz.github.io/votre-depot/` en production).
5. Catégorie : *Website Integration*.
6. Type : *Confidential* (le Client Secret généré ne sera pas utilisé ici, seul le Client ID nous intéresse).

### 2. Mettre à jour le code
Ouvrez le fichier `app.js` et modifiez ces constantes (ligne 82) :

```javascript
const TWITCH_CLIENT_ID = 'VOTRE_CLIENT_ID_ICI';
const REDIRECT_URI = 'VOTRE_URL_DE_REDIRECTION_ICI';