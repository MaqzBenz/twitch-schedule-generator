// ============================================================================
// 1. ÉTAT GLOBAL ET GESTION DU STOCKAGE
// ============================================================================

const defaultState = {
    theme: {
        backgroundColor: "#09090b",
        backgroundImageUrl: null,
        textColor: "#ffffff",
        accentColor: "#9146FF",
        fontFamily: "Inter"
    },
    layout: {
        format: "landscape" // "landscape" (16:9) ou "portrait" (9:16)
    },
    twitchData: {
        username: "",
        schedule: [] // Sera rempli par l'API Twitch ou modifié manuellement
    }
};

let appState = defaultState;
const savedLocalState = localStorage.getItem('schedulerProState');

if (savedLocalState) {
    try {
        appState = { ...defaultState, ...JSON.parse(savedLocalState) };
    } catch (e) {
        console.error("Erreur de lecture localStorage", e);
    }
}

function saveLocal() {
    localStorage.setItem('schedulerProState', JSON.stringify(appState));
    loadBackgroundImageAndRender();
}


// ============================================================================
// 2. INITIALISATION DE L'INTERFACE UTILISATEUR (Boutons, Couleurs)
// ============================================================================

window.addEventListener('DOMContentLoaded', () => {
    // Restaurer le pseudo
    if (appState.twitchData.username) {
        document.getElementById('twitchUsername').value = appState.twitchData.username;
    }
    
    // Restaurer les couleurs
    document.getElementById('colorAccent').value = appState.theme.accentColor;
    document.getElementById('colorText').value = appState.theme.textColor;
    
    // Restaurer les boutons de format
    updateFormatButtons(appState.layout.format);
});

// Écouteurs pour les couleurs
document.getElementById('colorAccent').addEventListener('input', (e) => {
    appState.theme.accentColor = e.target.value;
    saveLocal();
});
document.getElementById('colorText').addEventListener('input', (e) => {
    appState.theme.textColor = e.target.value;
    saveLocal();
});

// Écouteurs pour le format (Paysage / Portrait)
document.getElementById('btnFormatLandscape').addEventListener('click', () => {
    appState.layout.format = "landscape";
    updateFormatButtons("landscape");
    saveLocal();
});
document.getElementById('btnFormatPortrait').addEventListener('click', () => {
    appState.layout.format = "portrait";
    updateFormatButtons("portrait");
    saveLocal();
});

function updateFormatButtons(activeFormat) {
    const btnL = document.getElementById('btnFormatLandscape');
    const btnP = document.getElementById('btnFormatPortrait');
    if (activeFormat === "landscape") {
        btnL.classList.add("active");
        btnP.classList.remove("active");
    } else {
        btnP.classList.add("active");
        btnL.classList.remove("active");
    }
}


// ============================================================================
// 3. EXPORT / IMPORT JSON DU PROJET
// ============================================================================

document.getElementById('btnExportConfig').addEventListener('click', () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(appState, null, 2));
    const downloadLink = document.createElement('a');
    downloadLink.setAttribute("href", dataStr);
    downloadLink.setAttribute("download", `scheduler_project.json`);
    document.body.appendChild(downloadLink);
    downloadLink.click();
    downloadLink.remove();
});

document.getElementById('importConfig').addEventListener('change', (event) => {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            appState = { ...defaultState, ...JSON.parse(e.target.result) };
            // Maj UI
            document.getElementById('colorAccent').value = appState.theme.accentColor;
            document.getElementById('colorText').value = appState.theme.textColor;
            updateFormatButtons(appState.layout.format);
            if (appState.twitchData.username) document.getElementById('twitchUsername').value = appState.twitchData.username;
            
            saveLocal();
        } catch (error) { alert("Fichier JSON invalide."); }
    };
    reader.readAsText(file);
});


// ============================================================================
// 4. API TWITCH (Acquisition automatique)
// ============================================================================

// ⚠️ VOS IDENTIFIANTS ICI ⚠️
const TWITCH_CLIENT_ID = 'xc95ll8bm31mma3bhumcw5ny1zlwti'; 
const REDIRECT_URI = 'https://MaqzBenz.github.io/VOTRE_DEPOT/'; 
const SCOPES = 'channel:read:schedule';

document.getElementById('btnFetchTwitch').addEventListener('click', () => {
    const authUrl = `https://id.twitch.tv/oauth2/authorize?client_id=${TWITCH_CLIENT_ID}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&response_type=token&scope=${encodeURIComponent(SCOPES)}`;
    window.location.href = authUrl;
});

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
        const userRes = await fetch('https://api.twitch.tv/helix/users', { headers: { 'Authorization': `Bearer ${token}`, 'Client-Id': TWITCH_CLIENT_ID } });
        const userData = await userRes.json();
        if (!userData.data) throw new Error("Utilisateur introuvable.");

        const userId = userData.data[0].id;
        const displayName = userData.data[0].display_name;
        
        appState.twitchData.username = displayName;
        document.getElementById('twitchUsername').value = displayName;

        const schedRes = await fetch(`https://api.twitch.tv/helix/schedule?broadcaster_id=${userId}`, { headers: { 'Authorization': `Bearer ${token}`, 'Client-Id': TWITCH_CLIENT_ID } });
        const schedData = await schedRes.json();
        
        let streams = schedData.data && schedData.data.segments ? schedData.data.segments : [];
        let categoryIds = [];
        streams.forEach(s => { if (s.category && s.category.id) categoryIds.push(s.category.id); });

        let boxArts = {}; 
        if (categoryIds.length > 0) {
            const gamesRes = await fetch(`https://api.twitch.tv/helix/games?id=${categoryIds.join('&id=')}`, { headers: { 'Authorization': `Bearer ${token}`, 'Client-Id': TWITCH_CLIENT_ID } });
            const gamesData = await gamesRes.json();
            if (gamesData.data) {
                gamesData.data.forEach(g => { boxArts[g.id] = g.box_art_url.replace('{width}', '188').replace('{height}', '250'); });
            }
        }

        appState.twitchData.schedule = streams.map(s => ({
            id: s.id,
            title: s.title,
            startTime: s.start_time,
            isCanceled: s.is_canceled,
            isManual: false, // Flag pour savoir si l'user a forcé une modif
            categoryName: s.category ? s.category.name : "Just Chatting",
            categoryId: s.category ? s.category.id : null,
            boxArtUrl: (s.category && boxArts[s.category.id]) ? boxArts[s.category.id] : null
        }));
        
        saveLocal();
    } catch (error) {
        console.error(error);
        alert("Erreur de connexion Twitch.");
    }
}


// ============================================================================
// 5. GESTION DU FOND (Background) ET PRECHARGEMENT IMAGE
// ============================================================================

let bgImageObj = null; 
const imageCache = {};

document.getElementById('btnUploadBg').addEventListener('click', () => document.getElementById('bgUploader').click());
document.getElementById('bgUploader').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
        appState.theme.backgroundImageUrl = ev.target.result;
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
        bgImageObj.onload = () => preloadImagesAndRender();
        bgImageObj.onerror = () => { bgImageObj = null; preloadImagesAndRender(); };
        bgImageObj.src = appState.theme.backgroundImageUrl;
    } else {
        bgImageObj = null;
        preloadImagesAndRender();
    }
}

function preloadImagesAndRender() {
    const sched = appState.twitchData.schedule || [];
    let toLoad = 0, loaded = 0;
    const check = () => { if (loaded === toLoad) renderCanvas(); };

    sched.forEach(s => {
        if (s.boxArtUrl && !imageCache[s.boxArtUrl]) { // Indexé par URL maintenant (car modif manuelle possible)
            toLoad++;
            const img = new Image();
            img.crossOrigin = "Anonymous"; 
            img.onload = () => { loaded++; check(); };
            img.onerror = () => { loaded++; check(); };
            img.src = s.boxArtUrl;
            imageCache[s.boxArtUrl] = img; 
        }
    });
    if (toLoad === 0) renderCanvas();
}


// ============================================================================
// 6. MOTEUR DE RENDU CANVAS ET LOGIQUE D'ORIENTATION
// ============================================================================

const canvas = document.getElementById('scheduleCanvas');
const ctx = canvas.getContext('2d');

// --- Tableau qui stocke les zones cliquables (Hitboxes) ---
let dayHitboxes = []; 

function formatTime(dateString) {
    if (!dateString) return "";
    // Gestion simplifiée pour les entrées manuelles (ex: "20h00")
    if (!dateString.includes('T')) return dateString; 
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
    // 1. Adapter la taille du canvas selon le format
    if (appState.layout.format === "portrait") {
        canvas.width = 1080;
        canvas.height = 1920;
    } else {
        canvas.width = 1920;
        canvas.height = 1080;
    }

    // Réinitialiser les hitboxes pour le clic
    dayHitboxes = [];

    // FOND
    ctx.fillStyle = appState.theme.backgroundColor;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    if (bgImageObj) {
        drawImageProp(ctx, bgImageObj, 0, 0, canvas.width, canvas.height);
        ctx.fillStyle = "rgba(0, 0, 0, 0.4)"; 
        ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
    
    // TITRE PRINCIPAL
    ctx.fillStyle = appState.theme.textColor;
    ctx.font = `bold 60px ${appState.theme.fontFamily}`;
    ctx.textAlign = "center";
    ctx.fillText("PLANNING DE LA SEMAINE", canvas.width / 2, 100);

    const days = ['LUN', 'MAR', 'MER', 'JEU', 'VEN', 'SAM', 'DIM'];
    const startOfWeek = getMondayOfCurrentWeek();
    const schedule = appState.twitchData.schedule || [];

    // PARAMÈTRES DE GRILLE DYNAMIQUES
    let cardWidth, cardHeight, startX, startY, gapX, gapY;

    if (appState.layout.format === "landscape") {
        cardWidth = 240;
        cardHeight = 700;
        gapX = 20;
        gapY = 0;
        startX = (canvas.width - ((cardWidth * 7) + (gapX * 6))) / 2;
        startY = 200;
    } else {
        // Portrait (1 colonne, 7 lignes)
        cardWidth = 800;
        cardHeight = 220; // Plus écrasé en portrait
        gapX = 0;
        gapY = 20;
        startX = (canvas.width - cardWidth) / 2;
        startY = 200;
    }

    // BOUCLE DE DESSIN DES CARTES
    days.forEach((dayName, index) => {
        // Calcul position
        const x = appState.layout.format === "landscape" ? startX + (index * (cardWidth + gapX)) : startX;
        const y = appState.layout.format === "landscape" ? startY : startY + (index * (cardHeight + gapY));

        // Date exacte du jour
        const currentDate = new Date(startOfWeek);
        currentDate.setDate(startOfWeek.getDate() + index);
        const dayKeyStr = currentDate.toISOString().split('T')[0]; // "2026-09-28"

        // Chercher les données du stream pour ce jour (API ou Manuel)
        let streamForDay = schedule.find(s => {
            if (s.manualDateString) return s.manualDateString === dayKeyStr; // Si forcé manuellement
            if (s.startTime && s.startTime.includes('T')) {
                const sDate = new Date(s.startTime);
                return sDate.getDate() === currentDate.getDate() && sDate.getMonth() === currentDate.getMonth();
            }
            return false;
        });

        // ------------------
        // ENREGISTREMENT HITBOX POUR LE CLIC
        dayHitboxes.push({
            dayIndex: index,
            dayName: dayName,
            dateKey: dayKeyStr, // Identifiant unique pour sauvegarder la modif manuelle
            rect: { x: x, y: y, w: cardWidth, h: cardHeight },
            currentData: streamForDay
        });
        // ------------------

        // DESSIN FOND CARTE (Glassmorphism)
        ctx.save();
        if (bgImageObj) ctx.filter = "blur(12px)";
        ctx.fillStyle = "rgba(24, 24, 27, 0.7)"; 
        ctx.strokeStyle = "rgba(255, 255, 255, 0.1)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.roundRect(x, y, cardWidth, cardHeight, 15);
        ctx.fill();
        ctx.stroke(); 
        ctx.restore();

        // TEXTE INTÉRIEUR (Logique différente entre Paysage/Vertical)
        ctx.fillStyle = appState.theme.textColor;
        ctx.textAlign = appState.layout.format === "landscape" ? "center" : "left";

        if (appState.layout.format === "landscape") {
            // --- MODE PAYSAGE ---
            // Header Coloré
            ctx.fillStyle = appState.theme.accentColor;
            ctx.beginPath();
            ctx.roundRect(x, y, cardWidth, 80, [15, 15, 0, 0]);
            ctx.fill();

            // Date
            ctx.fillStyle = "#ffffff";
            ctx.font = `bold 30px ${appState.theme.fontFamily}`;
            ctx.fillText(`${dayName} ${currentDate.getDate()}`, x + (cardWidth / 2), y + 50);

            // Contenu
            if (streamForDay && !streamForDay.isCanceled && streamForDay.status !== "OFF") {
                ctx.fillStyle = appState.theme.accentColor;
                ctx.font = `bold 24px ${appState.theme.fontFamily}`;
                ctx.fillText(`${formatTime(streamForDay.startTime)}`, x + (cardWidth / 2), y + 140);

                let textStartY = y + 190;

                // Dessin Jaquette
                if (streamForDay.boxArtUrl && imageCache[streamForDay.boxArtUrl]) {
                    const img = imageCache[streamForDay.boxArtUrl];
                    const imgW = 140, imgH = 186; 
                    const imgX = x + (cardWidth / 2) - (imgW / 2); 
                    
                    ctx.save();
                    ctx.beginPath();
                    ctx.roundRect(imgX, textStartY, imgW, imgH, 8); 
                    ctx.clip(); 
                    ctx.drawImage(img, imgX, textStartY, imgW, imgH);
                    ctx.restore(); 
                    
                    textStartY += imgH + 40;
                }

                ctx.fillStyle = "#ffffff";
                ctx.font = `bold 20px ${appState.theme.fontFamily}`;
                let cat = streamForDay.categoryName || "";
                if (cat.length > 18) cat = cat.substring(0, 15) + "...";
                ctx.fillText(cat, x + (cardWidth / 2), textStartY);

                ctx.fillStyle = "#aaaaaa";
                ctx.font = `normal 16px ${appState.theme.fontFamily}`;
                wrapText(ctx, streamForDay.title, x + (cardWidth / 2), textStartY + 30, cardWidth - 30, 24, "center");
            } else {
                ctx.fillStyle = streamForDay && streamForDay.isCanceled ? "#ef4444" : "#71717a";
                ctx.font = `bold 28px ${appState.theme.fontFamily}`;
                ctx.fillText(streamForDay && streamForDay.isCanceled ? "ANNULÉ" : "REPOS", x + (cardWidth / 2), y + 350);
            }

        } else {
            // --- MODE PORTRAIT ---
            // En portrait on a de la place en largeur, donc on met le texte à gauche et l'image à droite
            
            // Ligne de couleur verticale sur la gauche
            ctx.fillStyle = appState.theme.accentColor;
            ctx.beginPath();
            ctx.roundRect(x, y, 15, cardHeight, [15, 0, 0, 15]);
            ctx.fill();

            // Date (ex: LUN 28)
            ctx.fillStyle = "#ffffff";
            ctx.font = `bold 36px ${appState.theme.fontFamily}`;
            ctx.fillText(`${dayName} ${currentDate.getDate()}`, x + 40, y + 60);

            if (streamForDay && !streamForDay.isCanceled && streamForDay.status !== "OFF") {
                // Heure
                ctx.fillStyle = appState.theme.accentColor;
                ctx.font = `bold 28px ${appState.theme.fontFamily}`;
                ctx.fillText(`${formatTime(streamForDay.startTime)}`, x + 40, y + 110);
                
                // Titre
                ctx.fillStyle = "#ffffff";
                ctx.font = `bold 24px ${appState.theme.fontFamily}`;
                ctx.fillText(streamForDay.categoryName || "Just Chatting", x + 40, y + 150);

                ctx.fillStyle = "#aaaaaa";
                ctx.font = `normal 18px ${appState.theme.fontFamily}`;
                wrapText(ctx, streamForDay.title, x + 40, y + 180, cardWidth - 250, 24, "left");

                // Jaquette (Alignée à droite)
                if (streamForDay.boxArtUrl && imageCache[streamForDay.boxArtUrl]) {
                    const img = imageCache[streamForDay.boxArtUrl];
                    const imgW = 120, imgH = 160; 
                    const imgX = x + cardWidth - imgW - 30; 
                    const imgY = y + (cardHeight - imgH) / 2;
                    
                    ctx.save();
                    ctx.beginPath();
                    ctx.roundRect(imgX, imgY, imgW, imgH, 8); 
                    ctx.clip(); 
                    ctx.drawImage(img, imgX, imgY, imgW, imgH);
                    ctx.restore(); 
                }
            } else {
                ctx.fillStyle = streamForDay && streamForDay.isCanceled ? "#ef4444" : "#71717a";
                ctx.font = `bold 36px ${appState.theme.fontFamily}`;
                ctx.fillText(streamForDay && streamForDay.isCanceled ? "ANNULÉ" : "OFF / REPOS", x + 40, y + 140);
            }
        }
    });

    // SIGNATURE EN BAS
    if (appState.twitchData.username) {
        ctx.fillStyle = appState.theme.accentColor;
        ctx.font = `bold 40px ${appState.theme.fontFamily}`;
        ctx.textAlign = "center";
        ctx.fillText(`twitch.tv/${appState.twitchData.username}`, canvas.width / 2, canvas.height - 50);
    }
}


// ============================================================================
// 7. ÉDITION MANUELLE INTERACTIVE (Clic sur Canvas)
// ============================================================================

const modal = document.getElementById('editModal');
let currentEditDayKey = null; // Stocke la date en cours d'édition (ex: "2026-09-28")

// Détection du clic
canvas.addEventListener('click', (e) => {
    // Calcul de la position du clic relative à l'affichage (qui peut être mis à l'échelle via CSS)
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const clickX = (e.clientX - rect.left) * scaleX;
    const clickY = (e.clientY - rect.top) * scaleY;

    // Vérifier si le clic est dans une hitbox
    for (let box of dayHitboxes) {
        if (clickX >= box.rect.x && clickX <= box.rect.x + box.rect.w &&
            clickY >= box.rect.y && clickY <= box.rect.y + box.rect.h) {
            
            openEditModal(box);
            break;
        }
    }
});

function openEditModal(boxData) {
    currentEditDayKey = boxData.dateKey;
    document.getElementById('modalDayTitle').innerText = `Modifier le ${boxData.dayName}`;
    
    // Remplir les champs avec les données actuelles ou vides
    const s = boxData.currentData;
    
    if (!s || s.status === "OFF") {
        document.getElementById('modalStatus').value = "OFF";
        document.getElementById('modalTime').value = "";
        document.getElementById('modalCategory').value = "";
        document.getElementById('modalTitle').value = "";
    } else if (s.isCanceled) {
        document.getElementById('modalStatus').value = "CANCEL";
        document.getElementById('modalTime').value = s.startTime || "";
        document.getElementById('modalCategory').value = s.categoryName || "";
        document.getElementById('modalTitle').value = s.title || "";
    } else {
        document.getElementById('modalStatus').value = "LIVE";
        document.getElementById('modalTime').value = formatTime(s.startTime);
        document.getElementById('modalCategory').value = s.categoryName || "";
        document.getElementById('modalTitle').value = s.title || "";
    }

    toggleLiveFields();
    modal.classList.remove('hidden');
}

// Cacher les champs si on sélectionne OFF ou ANNULÉ
document.getElementById('modalStatus').addEventListener('change', toggleLiveFields);

function toggleLiveFields() {
    const status = document.getElementById('modalStatus').value;
    const fields = document.getElementById('liveFields');
    if (status === "LIVE") { fields.style.display = "block"; } 
    else { fields.style.display = "none"; }
}

document.getElementById('btnCloseModal').addEventListener('click', () => modal.classList.add('hidden'));

// Sauvegarde de l'édition manuelle
document.getElementById('btnSaveModal').addEventListener('click', () => {
    const status = document.getElementById('modalStatus').value;
    
    // On crée l'objet du stream modifié
    const manualEntry = {
        id: "manual_" + currentEditDayKey,
        manualDateString: currentEditDayKey, // C'est ça qui fait le lien
        isManual: true,
        status: status,
        isCanceled: (status === "CANCEL"),
        startTime: document.getElementById('modalTime').value,
        categoryName: document.getElementById('modalCategory').value,
        title: document.getElementById('modalTitle').value,
        // On conserve la jaquette si elle existait (évolution future : upload d'image manuelle ici)
        boxArtUrl: null 
    };

    // Chercher s'il y a déjà une jaquette stockée par l'API pour ce jour
    const existing = appState.twitchData.schedule.find(s => 
        (s.manualDateString === currentEditDayKey) || 
        (s.startTime && s.startTime.includes(currentEditDayKey))
    );
    if (existing && existing.boxArtUrl) manualEntry.boxArtUrl = existing.boxArtUrl;

    // Supprimer l'ancienne entrée de ce jour (API ou manuel)
    appState.twitchData.schedule = appState.twitchData.schedule.filter(s => {
        if (s.manualDateString === currentEditDayKey) return false;
        if (s.startTime && s.startTime.includes(currentEditDayKey)) return false;
        return true;
    });

    // Ajouter la nouvelle
    appState.twitchData.schedule.push(manualEntry);

    saveLocal();
    modal.classList.add('hidden');
});


// ============================================================================
// 8. UTILITAIRES ET EXPORT
// ============================================================================

function wrapText(context, text, x, y, maxWidth, lineHeight, align = "center") {
    if(!text) return;
    const words = text.split(' ');
    let line = '';
    context.textAlign = align;
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

function drawImageProp(ctx, img, x, y, w, h, offsetX=0.5, offsetY=0.5) {
    let iw = img.width, ih = img.height, r = Math.min(w / iw, h / ih), nw = iw * r, nh = ih * r, ar = 1;
    if (nw < w) ar = w / nw; if (Math.abs(ar - 1) < 1e-14 && nh < h) ar = h / nh;  
    nw *= ar; nh *= ar;
    let cw = iw / (nw / w), ch = ih / (nh / h);
    let cx = (iw - cw) * offsetX, cy = (ih - ch) * offsetY;
    if (cx < 0) cx = 0; if (cy < 0) cy = 0; if (cw > iw) cw = iw; if (ch > ih) ch = ih;
    ctx.drawImage(img, cx, cy, cw, ch,  x, y, w, h);
}

// Exportation PNG
document.getElementById('btnDownloadImage').addEventListener('click', () => {
    const imageToDownload = canvas.toDataURL("image/png");
    const link = document.createElement('a');
    link.href = imageToDownload;
    link.download = `planning_${appState.layout.format}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
});

// INITIALISATION DU DESSIN AU LANCEMENT
loadBackgroundImageAndRender();