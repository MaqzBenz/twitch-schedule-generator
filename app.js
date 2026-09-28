// --- 4. GESTION DE L'API TWITCH ---

// ⚠️ À REMPLACER PAR VOS INFORMATIONS
const TWITCH_CLIENT_ID = 'xc95ll8bm31mma3bhumcw5ny1zlwti'; 
const REDIRECT_URI = 'https://MaqzBenz.github.io/twitch-schedule-generator/'; // Doit être EXACTEMENT la même que sur la console Twitch

// Les "scopes" sont les permissions qu'on demande à l'utilisateur.
// channel:read:schedule est nécessaire pour lire le planning du compte connecté.
const SCOPES = 'channel:read:schedule';

// 4.1 - Déclencher l'authentification Twitch
document.getElementById('btnFetchTwitch').addEventListener('click', () => {
    // On construit l'URL d'autorisation Twitch
    const twitchAuthUrl = `https://id.twitch.tv/oauth2/authorize?client_id=${TWITCH_CLIENT_ID}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&response_type=token&scope=${encodeURIComponent(SCOPES)}`;
    
    // On redirige l'utilisateur vers Twitch
    window.location.href = twitchAuthUrl;
});


// 4.2 - Intercepter le Token au retour de Twitch
// Cette fonction s'exécute dès que la page se charge
window.addEventListener('DOMContentLoaded', () => {
    // Twitch renvoie le token dans le "hash" de l'URL (après le #)
    // Exemple : mon-site.com/#access_token=123456&scope=...
    const hash = window.location.hash;

    if (hash && hash.includes('access_token')) {
        // On extrait le token de l'URL
        const params = new URLSearchParams(hash.substring(1)); // On enlève le '#'
        const accessToken = params.get('access_token');
        
        if (accessToken) {
            console.log("Token Twitch récupéré avec succès !");
            
            // On nettoie l'URL pour faire propre (enlever le gros token de la barre d'adresse)
            window.history.replaceState({}, document.title, window.location.pathname);
            
            // On lance la récupération du planning avec ce token
            fetchTwitchSchedule(accessToken);
        }
    }
});


// 4.3 - Appeler l'API Twitch pour récupérer le planning
async function fetchTwitchSchedule(token) {
    try {
        // Étape A : Obtenir le User ID (Twitch ID) de l'utilisateur connecté
        // L'API a besoin de l'ID numérique, pas du pseudo.
        console.log("Récupération de l'ID utilisateur...");
        const userResponse = await fetch('https://api.twitch.tv/helix/users', {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Client-Id': TWITCH_CLIENT_ID
            }
        });
        
        const userData = await userResponse.json();
        
        if (!userData.data || userData.data.length === 0) {
            throw new Error("Impossible de trouver l'utilisateur Twitch.");
        }

        const userId = userData.data[0].id;
        const displayName = userData.data[0].display_name;
        
        // On sauvegarde le pseudo et l'ID dans l'état global
        appState.twitchData.username = displayName;
        appState.twitchData.userId = userId;
        document.getElementById('twitchUsername').value = displayName;

        // Étape B : Récupérer le planning avec ce User ID
        console.log(`Récupération du planning pour l'ID : ${userId}`);
        const scheduleResponse = await fetch(`https://api.twitch.tv/helix/schedule?broadcaster_id=${userId}`, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Client-Id': TWITCH_CLIENT_ID
            }
        });
        
        const scheduleData = await scheduleResponse.json();
        
        if (scheduleData.data && scheduleData.data.segments) {
            const streams = scheduleData.data.segments;
            console.log("Planning récupéré :", streams);
            
            // On reformate les données pour ne garder que l'essentiel
            appState.twitchData.schedule = streams.map(segment => ({
                id: segment.id,
                title: segment.title,
                startTime: segment.start_time,
                endTime: segment.end_time,
                isCanceled: segment.is_canceled,
                categoryName: segment.category ? segment.category.name : "Just Chatting",
                categoryId: segment.category ? segment.category.id : null
            }));
            
            saveLocal();
            alert(`Planning récupéré avec succès pour ${displayName} ! (${streams.length} streams trouvés)`);
        } else {
            alert(`Aucun planning trouvé pour ${displayName}. Pensez à le configurer sur Twitch !`);
            appState.twitchData.schedule = [];
            saveLocal();
        }

    } catch (error) {
        console.error("Erreur lors de l'appel API Twitch:", error);
        alert("Une erreur est survenue lors de la communication avec Twitch. Regardez la console (F12) pour plus de détails.");
    }
}