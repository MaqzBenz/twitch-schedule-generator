// --- 1. ÉTAT GLOBAL ET SAUVEGARDE LOCALE ---

const defaultState = {
    theme: {
        backgroundColor: "#18181b",
        backgroundImageUrl: null,
        textColor: "#ffffff",
        accentColor: "#9146FF",
        fontFamily: "Arial"
    },
    layout: {
        isVertical: false
    },
    twitchData: {
        username: "",
        schedule: []
    }
};

let appState = defaultState;
const savedLocalState = localStorage.getItem('twitchScheduleState');

if (savedLocalState) {
    try {
        appState = { ...defaultState, ...JSON.parse(savedLocalState) };
    } catch (e) {
        console.error("Erreur de lecture du localStorage", e);
    }
}

function saveLocal() {
    localStorage.setItem('twitchScheduleState', JSON.stringify(appState));
    loadBackgroundImageAndRender(); // Redessine au lieu de juste renderCanvas
}

// Restauration de l'UI
window.addEventListener('DOMContentLoaded', () => {
    if (appState.twitchData.username) {
        document.getElementById('twitchUsername').value = appState.twitchData.username;
    }
});


// --- 2. EXPORT / IMPORT JSON ---

document.getElementById('btnExportConfig').addEventListener('click', () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(appState, null, 2));
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href", dataStr);
    
    const date = new Date().toISOString().split('T')[0];
    downloadAnchorNode.setAttribute("download", `planning_config_${date}.json`);
    
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
});

document.getElementById('importConfig').addEventListener('change', (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const importedState = JSON.parse(e.target.result);
            appState = { ...defaultState, ...importedState }; 
            
            if (appState.twitchData.username) {
                document.getElementById('twitchUsername').value = appState.twitchData.username;
            }
            saveLocal(); 
            alert("Configuration chargée !");
        } catch (error) {
            alert("Erreur : Fichier JSON invalide.");
        }
    };
    reader.readAsText(file);
});


// --- 3. API TWITCH (Implicit Grant Flow) ---

// ⚠️ À REMPLACER PAR VOS INFORMATIONS ⚠️
const TWITCH_CLIENT_ID = 'VOTRE_CLIENT_ID_ICI'; 
const REDIRECT_URI = 'https://VOTRE_PSEUDO.github.io/VOTRE_DEPOT/'; 
const SCOPES = 'channel:read:schedule';

document.getElementById('btnFetchTwitch').addEventListener('click', () => {
    const twitchAuthUrl = `https://id.twitch.tv/oauth2/authorize?client_id=${TWITCH_CLIENT_ID}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&response_type=token&scope=${encodeURIComponent(SCOPES)}`;
    window.location.href = twitchAuthUrl;
});

// Interception du Token au retour
window.addEventListener('DOMContentLoaded', () => {
    const hash = window.location.hash;
    if (hash && hash.includes('access_token')) {
        const params = new URLSearchParams(hash.substring(1)); 
        const accessToken = params.get('access_token');
        
        if (accessToken) {
            window.history.replaceState({}, document.title, window.location.pathname);
            fetchTwitchSchedule(accessToken);
        }
    }
});

async function fetchTwitchSchedule(token) {
    try {
        // Obtenir le User ID
        const userResponse = await fetch('https://api.twitch.tv/helix/users', {
            headers: { 'Authorization': `Bearer ${token}`, 'Client-Id': TWITCH_CLIENT_ID }
        });
        const userData = await userResponse.json();
        
        if (!userData.data || userData.data.length === 0) throw new Error("Utilisateur Twitch introuvable.");

        const userId = userData.data[0].id;
        const displayName = userData.data[0].display_name;
        
        appState.twitchData.username = displayName;
        appState.twitchData.userId = userId;
        document.getElementById('twitchUsername').value = displayName;

        // Récupérer le planning
        const scheduleResponse = await fetch(`https://api.twitch.tv/helix/schedule?broadcaster_id=${userId}`, {
            headers: { 'Authorization': `Bearer ${token}`, 'Client-Id': TWITCH_CLIENT_ID }
        });
        const scheduleData = await scheduleResponse.json();
        let streams = [];
        let categoryIds = [];

        if (scheduleData.data && scheduleData.data.segments) {
            streams = scheduleData.data.segments;
            
            // Récupérer les jaquettes
            streams.forEach(segment => {
                if (segment.category && segment.category.id && !categoryIds.includes(segment.category.id)) {
                    categoryIds.push(segment.category.id);
                }
            });

            let boxArts = {}; 
            if (categoryIds.length > 0) {
                const gamesUrl = `https://api.twitch.tv/helix/games?id=${categoryIds.join('&id=')}`;
                const gamesResponse = await fetch(gamesUrl, {
                    headers: { 'Authorization': `Bearer ${token}`, 'Client-Id': TWITCH_CLIENT_ID }
                });
                const gamesData = await gamesResponse.json();

                if (gamesData.data) {
                    gamesData.data.forEach(game => {
                        boxArts[game.id] = game.box_art_url.replace('{width}', '188').replace('{height}', '250');
                    });
                }
            }

            // Sauvegarde finale
            appState.twitchData.schedule = streams.map(segment => ({
                id: segment.id,
                title: segment.title,
                startTime: segment.start_time,
                endTime: segment.end_time,
                isCanceled: segment.is_canceled,
                categoryName: segment.category ? segment.category.name : "Just Chatting",
                categoryId: segment.category ? segment.category.id : null,
                boxArtUrl: (segment.category && boxArts[segment.category.id]) ? boxArts[segment.category.id] : null
            }));
            
            saveLocal();
            alert(`Planning récupéré pour ${displayName} !`);
        } else {
            alert(`Aucun planning trouvé pour ${displayName}.`);
            appState.twitchData.schedule = [];
            saveLocal();
        }
    } catch (error) {
        console.error("Erreur API Twitch:", error);
        alert("Erreur de communication avec Twitch. Avez-vous mis le bon Client ID ?");
    }
}


// --- 4. GESTION DU FOND ET PRECHARGEMENT ---

let bgImageObj = null; 
const imageCache = {};

document.getElementById('bgUploader').addEventListener('change', (event) => {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
        appState.theme.backgroundImageUrl = e.target.result;
        saveLocal(); 
    };
    reader.readAsDataURL(file);
});

document.getElementById('btnClearBg').addEventListener('click', () => {
    appState.theme.backgroundImageUrl = null;
    saveLocal();
});

function loadBackgroundImageAndRender() {
    if (appState.theme.backgroundImageUrl) {
        bgImageObj = new Image();
        bgImageObj.onload = () => { preloadImagesAndRender(); };
        bgImageObj.onerror = () => {
            appState.theme.backgroundImageUrl = null;
            bgImageObj = null;
            preloadImagesAndRender();
        };
        bgImageObj.src = appState.theme.backgroundImageUrl;
    } else {
        bgImageObj = null;
        preloadImagesAndRender();
    }
}

function preloadImagesAndRender() {
    const schedule = appState.twitchData.schedule || [];
    let imagesToLoad = 0;
    let imagesLoaded = 0;

    const checkAllLoaded = () => { if (imagesLoaded === imagesToLoad) renderCanvas(); };

    schedule.forEach(stream => {
        if (stream.boxArtUrl && !imageCache[stream.categoryId]) {
            imagesToLoad++;
            const img = new Image();
            img.crossOrigin = "Anonymous"; 
            img.onload = () => { imagesLoaded++; checkAllLoaded(); };
            img.onerror = () => { imagesLoaded++; checkAllLoaded(); };
            img.src = stream.boxArtUrl;
            imageCache[stream.categoryId] = img; 
        }
    });

    if (imagesToLoad === 0) renderCanvas();
}


// --- 5. MOTEUR DE RENDU (CANVAS) ---

const canvas = document.getElementById('scheduleCanvas');
const ctx = canvas.getContext('2d');

function formatTime(dateString) {
    if (!dateString) return "";
    return new Date(dateString).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
}

function getMondayOfCurrentWeek() {
    const d = new Date();
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1); 
    const monday = new Date(d.setDate(diff));
    monday.setHours(0, 0, 0, 0); 
    return monday;
}

function renderCanvas() {
    // FOND
    ctx.fillStyle = appState.theme.backgroundColor;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    if (bgImageObj) {
        drawImageProp(ctx, bgImageObj, 0, 0, canvas.width, canvas.height);
        ctx.fillStyle = "rgba(0, 0, 0, 0.4)"; 
        ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
    
    // TITRE
    ctx.fillStyle = appState.theme.textColor;
    ctx.font = `bold 60px ${appState.theme.fontFamily}`;
    ctx.textAlign = "center";
    ctx.fillText("PLANNING DE LA SEMAINE", canvas.width / 2, 100);

    const days = ['LUN', 'MAR', 'MER', 'JEU', 'VEN', 'SAM', 'DIM'];
    const cardWidth = 240;
    const cardHeight = 700;
    const gap = 20;
    const startX = (canvas.width - ((cardWidth * 7) + (gap * 6))) / 2;
    const startY = 200;

    const startOfWeek = getMondayOfCurrentWeek();
    const schedule = appState.twitchData.schedule || [];

    // BOUCLE JOURS
    days.forEach((dayName, index) => {
        const x = startX + (index * (cardWidth + gap));
        const currentDate = new Date(startOfWeek);
        currentDate.setDate(startOfWeek.getDate() + index);
        
        const streamForDay = schedule.find(stream => {
            const streamDate = new Date(stream.startTime);
            return streamDate.getDate() === currentDate.getDate() && 
                   streamDate.getMonth() === currentDate.getMonth() &&
                   streamDate.getFullYear() === currentDate.getFullYear();
        });

        // EFFET GLASSMORPHISM
        ctx.save();
        if (bgImageObj) ctx.filter = "blur(10px)";
        ctx.fillStyle = "rgba(43, 43, 54, 0.6)"; 
        ctx.strokeStyle = "rgba(255, 255, 255, 0.1)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.roundRect(x, startY, cardWidth, cardHeight, 15);
        ctx.fill();
        ctx.stroke(); 
        ctx.restore();

        // EN-TETE CARTE
        ctx.save();
        ctx.globalAlpha = 0.85;
        ctx.fillStyle = appState.theme.accentColor;
        ctx.beginPath();
        ctx.roundRect(x, startY, cardWidth, 80, [15, 15, 0, 0]);
        ctx.fill();
        ctx.restore();

        // TEXTE DATE
        ctx.fillStyle = "#ffffff";
        ctx.font = `bold 30px ${appState.theme.fontFamily}`;
        ctx.fillText(`${dayName} ${currentDate.getDate()}`, x + (cardWidth / 2), startY + 50);

        // CONTENU STREAM
        if (streamForDay && !streamForDay.isCanceled) {
            ctx.fillStyle = appState.theme.accentColor;
            ctx.font = `bold 24px ${appState.theme.fontFamily}`;
            ctx.fillText(`${formatTime(streamForDay.startTime)}`, x + (cardWidth / 2), startY + 140);

            let textStartY = startY + 200;

            if (streamForDay.categoryId && imageCache[streamForDay.categoryId]) {
                const img = imageCache[streamForDay.categoryId];
                const imgWidth = 140; 
                const imgHeight = 186; 
                const imgX = x + (cardWidth / 2) - (imgWidth / 2); 
                const imgY = startY + 160; 
                
                ctx.save();
                ctx.beginPath();
                ctx.roundRect(imgX, imgY, imgWidth, imgHeight, 8); 
                ctx.clip(); 
                ctx.drawImage(img, imgX, imgY, imgWidth, imgHeight);
                ctx.restore(); 
                
                textStartY = imgY + imgHeight + 40;
            }

            ctx.fillStyle = "#ffffff";
            ctx.font = `bold 20px ${appState.theme.fontFamily}`;
            let cat = streamForDay.categoryName;
            if (cat.length > 18) cat = cat.substring(0, 15) + "...";
            ctx.fillText(cat, x + (cardWidth / 2), textStartY);

            ctx.fillStyle = "#aaaaaa";
            ctx.font = `normal 16px ${appState.theme.fontFamily}`;
            wrapText(ctx, streamForDay.title, x + (cardWidth / 2), textStartY + 30, cardWidth - 30, 24);

        } else if (streamForDay && streamForDay.isCanceled) {
             ctx.fillStyle = "#ff4444";
             ctx.font = `bold 28px ${appState.theme.fontFamily}`;
             ctx.fillText("ANNULÉ", x + (cardWidth / 2), startY + 150);
        } else {
            ctx.fillStyle = "#555555";
            ctx.font = `bold 28px ${appState.theme.fontFamily}`;
            ctx.fillText("OFF", x + (cardWidth / 2), startY + 150);
        }
    });

    if (appState.twitchData.username) {
        ctx.fillStyle = appState.theme.accentColor;
        ctx.font = `bold 40px ${appState.theme.fontFamily}`;
        ctx.fillText(`twitch.tv/${appState.twitchData.username}`, canvas.width / 2, canvas.height - 50);
    }
}


// --- 6. UTILITAIRES ---

function wrapText(context, text, x, y, maxWidth, lineHeight) {
    if(!text) return;
    const words = text.split(' ');
    let line = '';
    for(let n = 0; n < words.length; n++) {
      const testLine = line + words[n] + ' ';
      const metrics = context.measureText(testLine);
      if (metrics.width > maxWidth && n > 0) {
        context.fillText(line.trim(), x, y);
        line = words[n] + ' ';
        y += lineHeight;
      } else { line = testLine; }
    }
    context.fillText(line.trim(), x, y);
}

function drawImageProp(ctx, img, x, y, w, h, offsetX, offsetY) {
    if (arguments.length === 2) { x = y = 0; w = ctx.canvas.width; h = ctx.canvas.height; }
    offsetX = typeof offsetX === "number" ? offsetX : 0.5;
    offsetY = typeof offsetY === "number" ? offsetY : 0.5;
    if (offsetX < 0) offsetX = 0; if (offsetY < 0) offsetY = 0;
    if (offsetX > 1) offsetX = 1; if (offsetY > 1) offsetY = 1;
    let iw = img.width, ih = img.height, r = Math.min(w / iw, h / ih), nw = iw * r, nh = ih * r, cx, cy, cw, ch, ar = 1;
    if (nw < w) ar = w / nw;                             
    if (Math.abs(ar - 1) < 1e-14 && nh < h) ar = h / nh;  
    nw *= ar; nh *= ar;
    cw = iw / (nw / w); ch = ih / (nh / h);
    cx = (iw - cw) * offsetX; cy = (ih - ch) * offsetY;
    if (cx < 0) cx = 0; if (cy < 0) cy = 0;
    if (cw > iw) cw = iw; if (ch > ih) ch = ih;
    ctx.drawImage(img, cx, cy, cw, ch,  x, y, w, h);
}


// --- 7. EXPORTATION IMAGE FINALE ---

document.getElementById('btnDownloadImage').addEventListener('click', () => {
    const imageToDownload = canvas.toDataURL("image/png");
    const dateStr = new Date().toLocaleDateString('fr-FR').replace(/\//g, '-');
    const pseudo = appState.twitchData.username ? `${appState.twitchData.username}_` : '';
    
    const downloadLink = document.createElement('a');
    downloadLink.href = imageToDownload;
    downloadLink.download = `planning_${pseudo}${dateStr}.png`;
    
    document.body.appendChild(downloadLink);
    downloadLink.click();
    document.body.removeChild(downloadLink);
});

// LANCEMENT INITIAL
loadBackgroundImageAndRender();