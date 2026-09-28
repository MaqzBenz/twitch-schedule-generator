// ============================================================================
// 1. ÉTAT GLOBAL
// ============================================================================
const defaultState = {
    theme: {
        backgroundColor: "#09090b",
        backgroundImageUrl: null,
        textColor: "#ffffff",
        accentColor: "#9146FF",
        fontFamily: "Inter",
        style: "classic" // "classic", "minimal", "neon"
    },
    layout: { format: "landscape" },
    twitchData: { username: "", schedule: [] },
    twitchAuthToken: null // Requis pour chercher des images manuellement
};

let appState = defaultState;
const savedLocalState = localStorage.getItem('schedulerProV2');
if (savedLocalState) {
    try { appState = { ...defaultState, ...JSON.parse(savedLocalState) }; } catch (e) {}
}

function saveLocal() {
    localStorage.setItem('schedulerProV2', JSON.stringify(appState));
    loadBackgroundImageAndRender();
}

// ============================================================================
// 2. INITIALISATION UI & LISTENERS
// ============================================================================
window.addEventListener('DOMContentLoaded', () => {
    if (appState.twitchData.username) document.getElementById('twitchUsername').value = appState.twitchData.username;
    document.getElementById('colorAccent').value = appState.theme.accentColor;
    document.getElementById('colorText').value = appState.theme.textColor;
    document.getElementById('fontFamily').value = appState.theme.fontFamily;
    document.getElementById('themeStyle').value = appState.theme.style;
    updateFormatButtons(appState.layout.format);
});

// Apparence
document.getElementById('colorAccent').addEventListener('input', (e) => { appState.theme.accentColor = e.target.value; saveLocal(); });
document.getElementById('colorText').addEventListener('input', (e) => { appState.theme.textColor = e.target.value; saveLocal(); });
document.getElementById('fontFamily').addEventListener('change', (e) => { appState.theme.fontFamily = e.target.value; saveLocal(); });
document.getElementById('themeStyle').addEventListener('change', (e) => { appState.theme.style = e.target.value; saveLocal(); });

// Format
document.getElementById('btnFormatLandscape').addEventListener('click', () => { appState.layout.format = "landscape"; updateFormatButtons("landscape"); saveLocal(); });
document.getElementById('btnFormatPortrait').addEventListener('click', () => { appState.layout.format = "portrait"; updateFormatButtons("portrait"); saveLocal(); });
function updateFormatButtons(active) {
    document.getElementById('btnFormatLandscape').classList.toggle("active", active === "landscape");
    document.getElementById('btnFormatPortrait').classList.toggle("active", active === "portrait");
}

// Export/Import JSON
document.getElementById('btnExportConfig').addEventListener('click', () => {
    const data = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(appState, null, 2));
    const link = document.createElement('a'); link.href = data; link.download = `planning.json`;
    document.body.appendChild(link); link.click(); link.remove();
});
document.getElementById('importConfig').addEventListener('change', (e) => {
    const reader = new FileReader();
    reader.onload = (ev) => {
        appState = { ...defaultState, ...JSON.parse(ev.target.result) };
        window.location.reload(); // Recharge la page pour tout appliquer
    };
    if (e.target.files[0]) reader.readAsText(e.target.files[0]);
});

// Fond d'écran
let bgImageObj = null;
const imageCache = {};
document.getElementById('bgUploader').addEventListener('change', (e) => {
    const reader = new FileReader();
    reader.onload = (ev) => { appState.theme.backgroundImageUrl = ev.target.result; saveLocal(); };
    if (e.target.files[0]) reader.readAsDataURL(e.target.files[0]);
});
document.getElementById('btnClearBg').addEventListener('click', () => { appState.theme.backgroundImageUrl = null; saveLocal(); });


// ============================================================================
// 3. API TWITCH (Connexion sans Scope & Sync Auto)
// ============================================================================
const TWITCH_CLIENT_ID = 'xc95ll8bm31mma3bhumcw5ny1zlwti'; 
const REDIRECT_URI = 'https://MaqzBenz.github.io/VOTRE_DEPOT/'; 

document.getElementById('btnFetchTwitch').addEventListener('click', () => {
    // ERREUR CORRIGÉE ICI : Pas de paramètre "scope" pour éviter l'erreur 400
    const authUrl = `https://id.twitch.tv/oauth2/authorize?client_id=${TWITCH_CLIENT_ID}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&response_type=token`;
    window.location.href = authUrl;
});

window.addEventListener('DOMContentLoaded', () => {
    const hash = window.location.hash;
    if (hash && hash.includes('access_token')) {
        const token = new URLSearchParams(hash.substring(1)).get('access_token');
        if (token) {
            window.history.replaceState({}, document.title, window.location.pathname);
            appState.twitchAuthToken = token; // Stocké pour les recherches d'images
            fetchTwitchSchedule(token);
        }
    }
});

async function fetchTwitchSchedule(token) {
    try {
        const userRes = await fetch('https://api.twitch.tv/helix/users', { headers: { 'Authorization': `Bearer ${token}`, 'Client-Id': TWITCH_CLIENT_ID } });
        const userData = await userRes.json();
        const userId = userData.data[0].id;
        appState.twitchData.username = userData.data[0].display_name;
        document.getElementById('twitchUsername').value = appState.twitchData.username;

        const schedRes = await fetch(`https://api.twitch.tv/helix/schedule?broadcaster_id=${userId}`, { headers: { 'Authorization': `Bearer ${token}`, 'Client-Id': TWITCH_CLIENT_ID } });
        const schedData = await schedRes.json();
        let streams = schedData.data && schedData.data.segments ? schedData.data.segments : [];
        
        let categoryIds = [];
        streams.forEach(s => { if (s.category && s.category.id) categoryIds.push(s.category.id); });

        let boxArts = {}; 
        if (categoryIds.length > 0) {
            const gamesRes = await fetch(`https://api.twitch.tv/helix/games?id=${categoryIds.join('&id=')}`, { headers: { 'Authorization': `Bearer ${token}`, 'Client-Id': TWITCH_CLIENT_ID } });
            const gamesData = await gamesRes.json();
            if (gamesData.data) gamesData.data.forEach(g => { boxArts[g.id] = g.box_art_url.replace('{width}', '188').replace('{height}', '250'); });
        }

        // On n'écrase pas les entrées créées manuellement par l'utilisateur
        let newSchedule = streams.map(s => ({
            manualDateString: s.start_time.split('T')[0],
            status: s.is_canceled ? "CANCEL" : "LIVE",
            startTime: formatTimeStrict(s.start_time),
            categoryName: s.category ? s.category.name : "Just Chatting",
            title: s.title,
            boxArtUrl: (s.category && boxArts[s.category.id]) ? boxArts[s.category.id] : null
        }));

        appState.twitchData.schedule = newSchedule;
        saveLocal();
        alert("Synchronisation réussie !");
    } catch (e) { console.error(e); alert("Erreur Twitch. Réessayez."); }
}


// ============================================================================
// 4. ÉDITEUR MANUEL DE SEMAINE & RECHERCHE D'IMAGE
// ============================================================================
const daysOfWeek = ['LUN', 'MAR', 'MER', 'JEU', 'VEN', 'SAM', 'DIM'];

document.getElementById('btnOpenEditor').addEventListener('click', () => {
    const list = document.getElementById('daysList');
    list.innerHTML = '';
    
    const startOfWeek = getMondayOfCurrentWeek();

    for (let i = 0; i < 7; i++) {
        const currentDate = new Date(startOfWeek);
        currentDate.setDate(startOfWeek.getDate() + i);
        const dateKey = currentDate.toISOString().split('T')[0];
        
        // Chercher si on a des données pour ce jour
        const s = appState.twitchData.schedule.find(d => d.manualDateString === dateKey) || {};

        const html = `
            <div class="day-row" data-date="${dateKey}">
                <h4>${daysOfWeek[i]}</h4>
                <select class="input-text status-sel">
                    <option value="LIVE" ${s.status === 'LIVE' ? 'selected' : ''}>LIVE</option>
                    <option value="OFF" ${(!s.status || s.status === 'OFF') ? 'selected' : ''}>OFF</option>
                    <option value="CANCEL" ${s.status === 'CANCEL' ? 'selected' : ''}>ANNULÉ</option>
                </select>
                <input type="text" class="input-text time-inp" placeholder="Heure (20:00)" value="${s.startTime || ''}">
                <input type="text" class="input-text cat-inp" placeholder="Nom du Jeu" value="${s.categoryName || ''}">
                <button class="btn-search" onclick="searchGameForRow(this, '${dateKey}')">Chercher Image</button>
                <input type="text" class="input-text title-inp" placeholder="Titre du live" value="${s.title || ''}">
                <input type="hidden" class="boxart-inp" value="${s.boxArtUrl || ''}">
            </div>
        `;
        list.innerHTML += html;
    }
    document.getElementById('weekEditorModal').classList.remove('hidden');
});

document.getElementById('btnCloseWeek').addEventListener('click', () => document.getElementById('weekEditorModal').classList.add('hidden'));

// Sauvegarder l'édition
document.getElementById('btnSaveWeek').addEventListener('click', () => {
    const rows = document.querySelectorAll('.day-row');
    appState.twitchData.schedule = [];

    rows.forEach(row => {
        const status = row.querySelector('.status-sel').value;
        if (status !== 'OFF') {
            appState.twitchData.schedule.push({
                manualDateString: row.getAttribute('data-date'),
                status: status,
                startTime: row.querySelector('.time-inp').value,
                categoryName: row.querySelector('.cat-inp').value,
                title: row.querySelector('.title-inp').value,
                boxArtUrl: row.querySelector('.boxart-inp').value
            });
        }
    });
    saveLocal();
    document.getElementById('weekEditorModal').classList.add('hidden');
});

// Rechercher Image Twitch dans l'éditeur
window.searchGameForRow = async function(btn, dateKey) {
    if (!appState.twitchAuthToken) {
        alert("Vous devez d'abord vous connecter à Twitch (Bouton 1) pour rechercher des images.");
        return;
    }
    const row = btn.parentElement;
    const query = row.querySelector('.cat-inp').value;
    if (!query) return;

    btn.innerText = "⏳...";
    try {
        const res = await fetch(`https://api.twitch.tv/helix/search/categories?query=${encodeURIComponent(query)}`, {
            headers: { 'Authorization': `Bearer ${appState.twitchAuthToken}`, 'Client-Id': TWITCH_CLIENT_ID }
        });
        const data = await res.json();
        if (data.data && data.data.length > 0) {
            // Prend le meilleur résultat
            const cover = data.data[0].box_art_url.replace('{width}', '188').replace('{height}', '250');
            row.querySelector('.boxart-inp').value = cover;
            btn.innerText = "✔️ Trouvé";
            btn.style.background = "#10b981";
        } else {
            btn.innerText = "❌ Introuvable";
            btn.style.background = "#ef4444";
        }
    } catch (e) { btn.innerText = "Erreur"; }
};


// ============================================================================
// 5. MOTEUR DE RENDU MULTI-DESIGNS (Canvas)
// ============================================================================
const canvas = document.getElementById('scheduleCanvas');
const ctx = canvas.getContext('2d');

function loadBackgroundImageAndRender() {
    if (appState.theme.backgroundImageUrl) {
        bgImageObj = new Image();
        bgImageObj.onload = () => preloadImagesAndRender();
        bgImageObj.onerror = () => { bgImageObj = null; preloadImagesAndRender(); };
        bgImageObj.src = appState.theme.backgroundImageUrl;
    } else { bgImageObj = null; preloadImagesAndRender(); }
}

function preloadImagesAndRender() {
    let toLoad = 0, loaded = 0;
    const check = () => { if (loaded === toLoad) renderCanvas(); };
    (appState.twitchData.schedule || []).forEach(s => {
        if (s.boxArtUrl && !imageCache[s.boxArtUrl]) {
            toLoad++; const img = new Image(); img.crossOrigin = "Anonymous";
            img.onload = () => { loaded++; check(); }; img.onerror = () => { loaded++; check(); };
            img.src = s.boxArtUrl; imageCache[s.boxArtUrl] = img; 
        }
    });
    if (toLoad === 0) renderCanvas();
}

function renderCanvas() {
    const isLand = (appState.layout.format === "landscape");
    canvas.width = isLand ? 1920 : 1080;
    canvas.height = isLand ? 1080 : 1920;

    // FOND
    ctx.fillStyle = appState.theme.backgroundColor;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    if (bgImageObj) {
        drawImageProp(ctx, bgImageObj, 0, 0, canvas.width, canvas.height);
        ctx.fillStyle = "rgba(0,0,0,0.5)"; ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
    
    ctx.shadowBlur = 0; // Reset
    const style = appState.theme.style;
    
    // TITRE
    ctx.fillStyle = appState.theme.textColor;
    ctx.font = `900 70px "${appState.theme.fontFamily}"`;
    ctx.textAlign = "center";
    if (style === "neon") { ctx.shadowBlur = 20; ctx.shadowColor = appState.theme.accentColor; }
    ctx.fillText("PLANNING DE LA SEMAINE", canvas.width / 2, 120);
    ctx.shadowBlur = 0; // Reset

    const startOfWeek = getMondayOfCurrentWeek();
    let cardW = isLand ? 240 : 850;
    let cardH = isLand ? 700 : 200;
    let gap = isLand ? 20 : 25;
    let startX = isLand ? (canvas.width - (cardW*7 + gap*6))/2 : (canvas.width - cardW)/2;
    let startY = 220;

    for (let i = 0; i < 7; i++) {
        let x = isLand ? startX + (i * (cardW + gap)) : startX;
        let y = isLand ? startY : startY + (i * (cardH + gap));
        
        let d = new Date(startOfWeek); d.setDate(startOfWeek.getDate() + i);
        let dateKey = d.toISOString().split('T')[0];
        let stream = appState.twitchData.schedule.find(s => s.manualDateString === dateKey);

        // --- DESSIN SELON LE TEMPLATE ---
        if (style === "classic") {
            // VERRE DÉPOLI
            ctx.save();
            if (bgImageObj) ctx.filter = "blur(12px)";
            ctx.fillStyle = "rgba(24, 24, 27, 0.7)";
            ctx.strokeStyle = "rgba(255,255,255,0.1)"; ctx.lineWidth = 1;
            ctx.beginPath(); ctx.roundRect(x, y, cardW, cardH, 15); ctx.fill(); ctx.stroke();
            ctx.restore();
            // Header Couleurs
            ctx.fillStyle = appState.theme.accentColor;
            ctx.beginPath(); 
            if(isLand) ctx.roundRect(x, y, cardW, 80, [15,15,0,0]);
            else ctx.roundRect(x, y, 15, cardH, [15,0,0,15]);
            ctx.fill();
        } 
        else if (style === "minimal") {
            // LIGNES ÉPURÉES (Pas de fond de carte)
            ctx.strokeStyle = appState.theme.accentColor; ctx.lineWidth = 3;
            ctx.beginPath();
            if (isLand) { ctx.moveTo(x, y); ctx.lineTo(x+cardW, y); } // Ligne en haut
            else { ctx.moveTo(x, y+cardH); ctx.lineTo(x+cardW, y+cardH); } // Ligne en bas
            ctx.stroke();
        }
        else if (style === "neon") {
            // GLOW EFFECTS
            ctx.fillStyle = "rgba(0, 0, 0, 0.8)";
            ctx.shadowBlur = 15; ctx.shadowColor = appState.theme.accentColor;
            ctx.strokeStyle = appState.theme.accentColor; ctx.lineWidth = 2;
            ctx.beginPath(); ctx.roundRect(x, y, cardW, cardH, 8); ctx.fill(); ctx.stroke();
            ctx.shadowBlur = 0;
        }

        // TEXTES
        ctx.fillStyle = "#ffffff";
        ctx.textAlign = isLand ? "center" : "left";
        let titleX = isLand ? x + cardW/2 : x + 40;
        
        ctx.font = `800 ${isLand ? 30 : 36}px "${appState.theme.fontFamily}"`;
        ctx.fillText(`${daysOfWeek[i]} ${d.getDate()}`, titleX, y + (isLand ? 55 : 60));

        if (stream && stream.status !== "OFF") {
            ctx.fillStyle = appState.theme.accentColor;
            ctx.font = `700 ${isLand ? 26 : 28}px "${appState.theme.fontFamily}"`;
            if (style === "neon") { ctx.shadowBlur = 10; ctx.shadowColor = appState.theme.accentColor; }
            ctx.fillText(stream.startTime, titleX, y + (isLand ? 130 : 110));
            ctx.shadowBlur = 0;

            let imgY = isLand ? y+160 : y+ (cardH-160)/2;
            let imgX = isLand ? x + (cardW-120)/2 : x + cardW - 140;
            
            if (stream.boxArtUrl && imageCache[stream.boxArtUrl]) {
                ctx.save(); ctx.beginPath(); ctx.roundRect(imgX, imgY, 120, 160, 8); ctx.clip();
                ctx.drawImage(imageCache[stream.boxArtUrl], imgX, imgY, 120, 160); ctx.restore();
            }

            ctx.fillStyle = "#ffffff";
            ctx.font = `700 ${isLand ? 20 : 24}px "${appState.theme.fontFamily}"`;
            let textY = isLand ? imgY + 190 : y + 150;
            ctx.fillText(stream.categoryName.substring(0, 18), titleX, textY);

            ctx.fillStyle = "#aaaaaa";
            ctx.font = `400 ${isLand ? 16 : 18}px "${appState.theme.fontFamily}"`;
            wrapText(ctx, stream.title, titleX, textY+30, isLand ? cardW-20 : cardW-300, 24, isLand?"center":"left");

            if (stream.status === "CANCEL") {
                ctx.fillStyle = "rgba(239, 68, 68, 0.9)";
                ctx.fillRect(x, y + cardH/2 - 30, cardW, 60);
                ctx.fillStyle = "#fff"; ctx.font = `900 30px "${appState.theme.fontFamily}"`;
                ctx.textAlign = "center"; ctx.fillText("ANNULÉ", x + cardW/2, y + cardH/2 + 10);
            }
        } else {
            ctx.fillStyle = "#71717a";
            ctx.font = `800 36px "${appState.theme.fontFamily}"`;
            ctx.fillText("OFF", titleX, y + (isLand ? 350 : 130));
        }
    }
}

// Utilitaires : Extract Heure, Text Wrap, Dessin Image
function formatTimeStrict(dStr) {
    if(!dStr.includes('T')) return dStr;
    return new Date(dStr).toLocaleTimeString('fr-FR', {hour:'2-digit', minute:'2-digit'});
}
function getMondayOfCurrentWeek() {
    let d = new Date(), day = d.getDay();
    return new Date(d.setDate(d.getDate() - day + (day===0?-6:1)));
}
function wrapText(ctx, text, x, y, maxW, lineH, align) {
    if(!text) return;
    let words = text.split(' '), line = ''; ctx.textAlign = align;
    for(let n=0; n<words.length; n++) {
        let test = line + words[n] + ' ';
        if (ctx.measureText(test).width > maxW && n>0) {
            ctx.fillText(line.trim(), x, y); line = words[n] + ' '; y += lineH;
        } else line = test;
    }
    ctx.fillText(line.trim(), x, y);
}
function drawImageProp(ctx, img, x, y, w, h) {
    let iw=img.width, ih=img.height, r=Math.min(w/iw, h/ih), nw=iw*r, nh=ih*r, ar=1;
    if(nw<w) ar=w/nw; if(Math.abs(ar-1)<1e-14 && nh<h) ar=h/nh; nw*=ar; nh*=ar;
    ctx.drawImage(img, (iw-iw/(nw/w))/2, (ih-ih/(nh/h))/2, iw/(nw/w), ih/(nh/h), x, y, w, h);
}

// Download
document.getElementById('btnDownloadImage').addEventListener('click', () => {
    const link = document.createElement('a'); link.href = canvas.toDataURL("image/png");
    link.download = `planning_${appState.layout.format}.png`;
    document.body.appendChild(link); link.click(); link.remove();
});

loadBackgroundImageAndRender();