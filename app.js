// --- 1. ÉTAT GLOBAL ET SAUVEGARDE LOCALE ---

// On définit la structure par défaut
const defaultState = {
    theme: {
        backgroundColor: "#18181b",
        textColor: "#ffffff",
        accentColor: "#9146FF",
        fontFamily: "Arial"
    },
    layout: {
        isVertical: false
    },
    twitchData: {
        username: "",
        schedule: [] // Contiendra les jours et heures récupérés
    }
};

// On tente de charger depuis le navigateur (localStorage)
let appState = defaultState;
const savedLocalState = localStorage.getItem('twitchScheduleState');

if (savedLocalState) {
    try {
        // On fusionne les données sauvegardées avec la structure par défaut
        // (utile si on ajoute de nouvelles options plus tard)
        appState = { ...defaultState, ...JSON.parse(savedLocalState) };
    } catch (e) {
        console.error("Erreur de lecture du localStorage", e);
    }
}

// Fonction pour sauvegarder automatiquement après chaque modification
function saveLocal() {
    localStorage.setItem('twitchScheduleState', JSON.stringify(appState));
    renderCanvas(); // On redessine le canvas à chaque changement
}


// --- 2. GESTION DU CANVAS (Rendu Graphique) ---

const canvas = document.getElementById('scheduleCanvas');
const ctx = canvas.getContext('2d');

function renderCanvas() {
    // 1. Fond
    ctx.fillStyle = appState.theme.backgroundColor;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // 2. Titre principal
    ctx.fillStyle = appState.theme.textColor;
    ctx.font = `bold 60px ${appState.theme.fontFamily}`;
    ctx.textAlign = "center";
    ctx.fillText("PLANNING DE LA SEMAINE", canvas.width / 2, 100);

    // 3. Dessin des cartes des jours (Placeholder pour le moment)
    const days = ['LUN', 'MAR', 'MER', 'JEU', 'VEN', 'SAM', 'DIM'];
    const cardWidth = 240;
    const cardHeight = 700;
    const gap = 20;
    const startX = (canvas.width - ((cardWidth * 7) + (gap * 6))) / 2;
    const startY = 200;

    days.forEach((day, index) => {
        const x = startX + (index * (cardWidth + gap));
        
        // Dessin de la carte
        ctx.fillStyle = "#2b2b36";
        ctx.beginPath();
        ctx.roundRect(x, startY, cardWidth, cardHeight, 15);
        ctx.fill();

        // En-tête du jour (couleur d'accentuation)
        ctx.fillStyle = appState.theme.accentColor;
        ctx.beginPath();
        ctx.roundRect(x, startY, cardWidth, 80, [15, 15, 0, 0]); // Arrondi que en haut
        ctx.fill();

        // Texte du jour
        ctx.fillStyle = "#ffffff";
        ctx.font = `bold 30px ${appState.theme.fontFamily}`;
        ctx.fillText(day, x + (cardWidth / 2), startY + 50);
    });

    // Affichage du pseudo si on l'a
    if (appState.twitchData.username) {
        ctx.fillStyle = appState.theme.accentColor;
        ctx.font = `bold 40px ${appState.theme.fontFamily}`;
        ctx.fillText(`twitch.tv/${appState.twitchData.username}`, canvas.width / 2, canvas.height - 50);
    }
}

// Rendu initial
renderCanvas();


// --- 3. EXPORT / IMPORT JSON ---

// Exporter la configuration
document.getElementById('btnExportConfig').addEventListener('click', () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(appState, null, 2));
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href", dataStr);
    
    // Nom du fichier personnalisé avec la date
    const date = new Date().toISOString().split('T')[0];
    downloadAnchorNode.setAttribute("download", `planning_config_${date}.json`);
    
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
});

// Importer une configuration
document.getElementById('importConfig').addEventListener('change', (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const importedState = JSON.parse(e.target.result);
            appState = { ...defaultState, ...importedState }; // Sécurité de structure
            saveLocal(); // Déclenche aussi la mise à jour visuelle
            
            // Met à jour l'input texte si un pseudo était dans le JSON
            if (appState.twitchData.username) {
                document.getElementById('twitchUsername').value = appState.twitchData.username;
            }
            
            alert("Configuration chargée avec succès !");
        } catch (error) {
            alert("Erreur : Fichier JSON invalide.");
            console.error(error);
        }
    };
    reader.readAsText(file);
});

// Restauration de l'UI au chargement (si un pseudo est dans le localStorage)
window.addEventListener('DOMContentLoaded', () => {
    if (appState.twitchData.username) {
        document.getElementById('twitchUsername').value = appState.twitchData.username;
    }
});


// --- 4. PREPARATION API TWITCH ---

document.getElementById('btnFetchTwitch').addEventListener('click', () => {
    const username = document.getElementById('twitchUsername').value.trim();
    
    if (!username) {
        alert("Veuillez entrer un pseudo Twitch.");
        return;
    }

    // On sauvegarde le pseudo
    appState.twitchData.username = username;
    saveLocal();

    // C'est ici que l'on lancera l'authentification.
    console.log(`Préparation pour récupérer le planning de : ${username}`);
    initiateTwitchAuth();
});

function initiateTwitchAuth() {
    // Cette fonction sera complétée à l'étape suivante.
    alert("Prochaine étape : Configuration du Client ID Twitch !");
}