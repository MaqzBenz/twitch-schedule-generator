// ============================================================================
// 1. ÉTAT GLOBAL
// ============================================================================
const defaultState = {
    theme: {
        backgroundColor: "#09090b", backgroundImageUrl: null,
        textColor: "#ffffff", accentColor: "#9146FF",
        fontFamily: "Inter", style: "classic"
    },
    layout: { format: "landscape" }, // "landscape" ou "portrait"
    socials: { twitter: "", tiktok: "" },
    twitchData: { username: "", schedule: {} }, // Dictionnaire { "2026-09-28": [ streams... ] }
    twitchAuthToken: null
};

let appState = defaultState;
const savedLocalState = localStorage.getItem('schedulerProV3');
if (savedLocalState) {
    try { appState = { ...defaultState, ...JSON.parse(savedLocalState) }; } catch (e) {}
}

function saveLocal() {
    localStorage.setItem('schedulerProV3', JSON.stringify(appState));
    loadBackgroundImageAndRender();
}

// ============================================================================
// 2. INITIALISATION UI & LISTENERS
// ============================================================================
window.addEventListener('DOMContentLoaded', () => {
    document.getElementById('twitchUsername').value = appState.twitchData.username || "";
    document.getElementById('socialTwitter').value = appState.socials.twitter || "";
    document.getElementById('socialTiktok').value = appState.socials.tiktok || "";
    
    document.getElementById('colorAccent').value = appState.theme.accentColor;
    document.getElementById('colorText').value = appState.theme.textColor;
    document.getElementById('fontFamily').value = appState.theme.fontFamily;
    document.getElementById('themeStyle').value = appState.theme.style;
    updateFormatButtons(appState.layout.format);
});

// Écouteurs Apparence
document.getElementById('colorAccent').addEventListener('input', (e) => { appState.theme.accentColor = e.target.value; saveLocal(); });
document.getElementById('colorText').addEventListener('input', (e) => { appState.theme.textColor = e.target.value; saveLocal(); });
document.getElementById('fontFamily').addEventListener('change', (e) => { appState.theme.fontFamily = e.target.value; saveLocal(); });
document.getElementById('themeStyle').addEventListener('change', (e) => { appState.theme.style = e.target.value; saveLocal(); });

// Écouteurs Réseaux & Pseudos
document.getElementById('twitchUsername').addEventListener('input', (e) => { appState.twitchData.username = e.target.value; saveLocal(); });
document.getElementById('socialTwitter').addEventListener('input', (e) => { appState.socials.twitter = e.target.value; saveLocal(); });
document.getElementById('socialTiktok').addEventListener('input', (e) => { appState.socials.tiktok = e.target.value; saveLocal(); });

// Format
document.getElementById('btnFormatLandscape').addEventListener('click', () => { appState.layout.format = "landscape"; updateFormatButtons("landscape"); saveLocal(); });
document.getElementById('btnFormatPortrait').addEventListener('click', () => { appState.layout.format = "portrait"; updateFormatButtons("portrait"); saveLocal(); });
function updateFormatButtons(active) {
    document.getElementById('btnFormatLandscape').classList.toggle("active", active === "landscape");
    document.getElementById('btnFormatPortrait').classList.toggle("active", active === "portrait");
}

// Fond d'écran
let bgImageObj = null; const imageCache = {};
document.getElementById('bgUploader').addEventListener('change', (e) => {
    const reader = new FileReader();
    reader.onload = (ev) => { appState.theme.backgroundImageUrl = ev.target.result; saveLocal(); };
    if (e.target.files[0]) reader.readAsDataURL(e.target.files[0]);
});
document.getElementById('btnClearBg').addEventListener('click', () => { appState.theme.backgroundImageUrl = null; saveLocal(); });

// Projets
document.getElementById('btnExportConfig').addEventListener('click', () => {
    const data = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(appState, null, 2));
    const link = document.createElement('a'); link.href = data; link.download = `planning.json`;
    document.body.appendChild(link); link.click(); link.remove();
});
document.getElementById('importConfig').addEventListener('change', (e) => {
    const reader = new FileReader();
    reader.onload = (ev) => { appState = { ...defaultState, ...JSON.parse(ev.target.result) }; window.location.reload(); };
    if (e.target.files[0]) reader.readAsText(e.target.files[0]);
});

// ============================================================================
// 3. API TWITCH (Correction URL Dynamique)
// ============================================================================
const TWITCH_CLIENT_ID = 'xc95ll8bm31mma3bhumcw5ny1zlwti'; 
// On génère dynamiquement l'URL pour éviter l'erreur de redirection
const REDIRECT_URI = window.location.href.split('#')[0]; 

document.getElementById('btnFetchTwitch').addEventListener('click', () => {
    if(TWITCH_CLIENT_ID === 'xc95ll8bm31mma3bhumcw5ny1zlwti') { alert("Veuillez mettre votre Client ID dans app.js !"); return; }
    const authUrl = `https://id.twitch.tv/oauth2/authorize?client_id=${TWITCH_CLIENT_ID}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&response_type=token`;
    window.location.href = authUrl;
});

window.addEventListener('DOMContentLoaded', () => {
    const hash = window.location.hash;
    if (hash && hash.includes('access_token')) {
        const token = new URLSearchParams(hash.substring(1)).get('access_token');
        if (token) {
            window.history.replaceState({}, document.title, window.location.pathname);
            appState.twitchAuthToken = token; 
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

        // On reset le schedule pour injecter les données Twitch
        appState.twitchData.schedule = {};
        streams.forEach(s => {
            if(s.is_canceled) return; // On ignore les annulés
            let dateKey = s.start_time.split('T')[0];
            if(!appState.twitchData.schedule[dateKey]) appState.twitchData.schedule[dateKey] = [];
            
            // Formatage propre de l'heure pour l'input type="time"
            let timeMatch = new Date(s.start_time).toLocaleTimeString('fr-FR', {hour:'2-digit', minute:'2-digit'});
            
            appState.twitchData.schedule[dateKey].push({
                time: timeMatch,
                categoryName: s.category ? s.category.name : "Just Chatting",
                title: s.title,
                boxArtUrl: (s.category && boxArts[s.category.id]) ? boxArts[s.category.id] : null
            });
        });

        saveLocal();
        alert("Synchronisation réussie ! Ouvrez l'Éditeur pour vérifier.");
    } catch (e) { console.error(e); alert("Erreur Twitch. Réessayez."); }
}


// ============================================================================
// 4. ÉDITEUR MANUEL MULTI-STREAMS
// ============================================================================
const daysOfWeekFull = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'];

document.getElementById('btnOpenEditor').addEventListener('click', () => {
    const list = document.getElementById('daysList');
    list.innerHTML = '';
    const startOfWeek = getMondayOfCurrentWeek();

    for (let i = 0; i < 7; i++) {
        let d = new Date(startOfWeek); d.setDate(startOfWeek.getDate() + i);
        let dateKey = d.toISOString().split('T')[0];
        let dayStreams = appState.twitchData.schedule[dateKey] || [];

        let block = document.createElement('div');
        block.className = 'day-block';
        block.dataset.date = dateKey;
        
        let header = `
            <div class="day-header">
                <h4>${daysOfWeekFull[i]} ${d.getDate()}</h4>
                <button class="btn-add-stream" onclick="addStreamRow(this)">+ Ajouter un live</button>
            </div>
            <div class="streams-container"></div>
        `;
        block.innerHTML = header;
        
        let container = block.querySelector('.streams-container');
        if (dayStreams.length === 0) {
            container.innerHTML = `<p style="color:#71717a; font-size:13px; font-style:italic;">Jour de repos (OFF)</p>`;
        } else {
            dayStreams.forEach(stream => container.appendChild(createStreamRowHTML(stream)));
        }
        list.appendChild(block);
    }
    document.getElementById('weekEditorModal').classList.remove('hidden');
});

document.getElementById('btnCloseWeek').addEventListener('click', () => document.getElementById('weekEditorModal').classList.add('hidden'));

// Créer une ligne de stream
window.createStreamRowHTML = function(stream = {time: "20:00", categoryName: "", title: "", boxArtUrl: ""}) {
    let div = document.createElement('div');
    div.className = 'stream-row';
    div.innerHTML = `
        <input type="time" class="input-text time-inp" value="${stream.time}">
        <input type="text" class="input-text cat-inp" placeholder="Nom du Jeu" value="${stream.categoryName}">
        <button class="btn-search" onclick="searchGameForEditor(this)">Rechercher Jaquette</button>
        <input type="text" class="input-text title-inp" placeholder="Titre du live" value="${stream.title}">
        <input type="hidden" class="boxart-inp" value="${stream.boxArtUrl}">
        <button class="btn-remove-stream" onclick="this.parentElement.remove()">X</button>
    `;
    return div;
}

window.addStreamRow = function(btn) {
    const container = btn.parentElement.nextElementSibling;
    if (container.querySelector('p')) container.innerHTML = ''; // Enlève le texte "OFF"
    container.appendChild(createStreamRowHTML());
}

window.searchGameForEditor = async function(btn) {
    if (!appState.twitchAuthToken) { alert("Connectez-vous à Twitch d'abord !"); return; }
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
            row.querySelector('.boxart-inp').value = data.data[0].box_art_url.replace('{width}', '188').replace('{height}', '250');
            btn.innerText = "✔️ Ok"; btn.style.background = "#10b981";
        } else { btn.innerText = "❌ Introuvable"; btn.style.background = "#ef4444"; }
    } catch (e) { btn.innerText = "Erreur"; }
};

document.getElementById('btnSaveWeek').addEventListener('click', () => {
    appState.twitchData.schedule = {}; // On vide
    document.querySelectorAll('.day-block').forEach(block => {
        let dateKey = block.dataset.date;
        let streams = [];
        block.querySelectorAll('.stream-row').forEach(row => {
            streams.push({
                time: row.querySelector('.time-inp').value,
                categoryName: row.querySelector('.cat-inp').value,
                title: row.querySelector('.title-inp').value,
                boxArtUrl: row.querySelector('.boxart-inp').value
            });
        });
        // On trie par heure
        streams.sort((a,b) => a.time.localeCompare(b.time));
        if (streams.length > 0) appState.twitchData.schedule[dateKey] = streams;
    });
    saveLocal();
    document.getElementById('weekEditorModal').classList.add('hidden');
});


// ============================================================================
// 5. MOTEUR DE RENDU CANVAS
// ============================================================================
const canvas = document.getElementById('scheduleCanvas');
const ctx = canvas.getContext('2d');
const daysOfWeekShort = ['LUN', 'MAR', 'MER', 'JEU', 'VEN', 'SAM', 'DIM'];

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
    const check = () => { if (loaded === toLoad) drawWithFonts(); };
    
    // Parcourt le dictionnaire
    Object.values(appState.twitchData.schedule).forEach(dayStreams => {
        dayStreams.forEach(s => {
            if (s.boxArtUrl && !imageCache[s.boxArtUrl]) {
                toLoad++; const img = new Image(); img.crossOrigin = "Anonymous";
                img.onload = () => { loaded++; check(); }; img.onerror = () => { loaded++; check(); };
                img.src = s.boxArtUrl; imageCache[s.boxArtUrl] = img; 
            }
        });
    });
    if (toLoad === 0) drawWithFonts();
}

// FIX FONTS : S'assure que la police est chargée avant de dessiner
function drawWithFonts() {
    document.fonts.ready.then(() => { renderCanvas(); });
}

function renderCanvas() {
    const isLand = (appState.layout.format === "landscape");
    const style = appState.theme.style;
    
    // Calcul dynamique de la hauteur en mode portrait selon le nombre de lives
    let totalPortraitHeight = 250; // Header
    const startOfWeek = getMondayOfCurrentWeek();
    
    if (!isLand) {
        for (let i = 0; i < 7; i++) {
            let d = new Date(startOfWeek); d.setDate(startOfWeek.getDate() + i);
            let dateKey = d.toISOString().split('T')[0];
            let nbStreams = (appState.twitchData.schedule[dateKey] || []).length;
            let cardH = nbStreams === 0 ? 120 : (nbStreams * 180) + 60; // 180px par stream
            totalPortraitHeight += cardH + 25; // 25px gap
        }
        totalPortraitHeight += 150; // Footer sociaux
    }

    canvas.width = isLand ? 1920 : 1080;
    canvas.height = isLand ? 1080 : Math.max(1920, totalPortraitHeight); // S'agrandit si besoin

    // FOND
    ctx.fillStyle = appState.theme.backgroundColor;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    if (bgImageObj) {
        drawImageProp(ctx, bgImageObj, 0, 0, canvas.width, canvas.height);
        ctx.fillStyle = "rgba(0,0,0,0.5)"; ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
    
    // TITRE PRINCIPAL
    ctx.fillStyle = appState.theme.textColor;
    ctx.font = `900 70px "${appState.theme.fontFamily}"`;
    ctx.textAlign = "center";
    if (style === "neon") { ctx.shadowBlur = 20; ctx.shadowColor = appState.theme.accentColor; }
    ctx.fillText("PLANNING DE LA SEMAINE", canvas.width / 2, 120);
    ctx.shadowBlur = 0; 

    // GESTION DES CARTES
    let cardW = isLand ? 240 : 850;
    let gap = isLand ? 20 : 25;
    let startX = isLand ? (canvas.width - (cardW*7 + gap*6))/2 : (canvas.width - cardW)/2;
    let currentY = 220; // Utilisé pour empiler en Portrait

    for (let i = 0; i < 7; i++) {
        let x = isLand ? startX + (i * (cardW + gap)) : startX;
        let y = isLand ? 220 : currentY;
        
        let d = new Date(startOfWeek); d.setDate(startOfWeek.getDate() + i);
        let dateKey = d.toISOString().split('T')[0];
        let dayStreams = appState.twitchData.schedule[dateKey] || [];
        let isOff = dayStreams.length === 0;

        // Calcul Hauteur Carte (Dynamique)
        let cardH = isLand ? 720 : (isOff ? 120 : (dayStreams.length * 180) + 60);

        // DESIGN CARTE
        if (style === "classic") {
            ctx.save();
            if (bgImageObj) ctx.filter = "blur(12px)";
            ctx.fillStyle = "rgba(24, 24, 27, 0.7)";
            ctx.strokeStyle = "rgba(255,255,255,0.1)"; ctx.lineWidth = 1;
            ctx.beginPath(); ctx.roundRect(x, y, cardW, cardH, 15); ctx.fill(); ctx.stroke();
            ctx.restore();
            
            ctx.fillStyle = appState.theme.accentColor;
            ctx.beginPath(); 
            if(isLand) ctx.roundRect(x, y, cardW, 80, [15,15,0,0]);
            else ctx.roundRect(x, y, 15, cardH, [15,0,0,15]);
            ctx.fill();
        } 
        else if (style === "minimal") {
            ctx.strokeStyle = appState.theme.accentColor; ctx.lineWidth = 3;
            ctx.beginPath();
            if (isLand) { ctx.moveTo(x, y); ctx.lineTo(x+cardW, y); } 
            else { ctx.moveTo(x, y+cardH); ctx.lineTo(x+cardW, y+cardH); } 
            ctx.stroke();
        }
        else if (style === "neon") {
            ctx.fillStyle = "rgba(0, 0, 0, 0.8)";
            ctx.shadowBlur = 15; ctx.shadowColor = appState.theme.accentColor;
            ctx.strokeStyle = appState.theme.accentColor; ctx.lineWidth = 2;
            ctx.beginPath(); ctx.roundRect(x, y, cardW, cardH, 8); ctx.fill(); ctx.stroke();
            ctx.shadowBlur = 0;
        }

        // TEXTE HEADER JOUR
        ctx.fillStyle = "#ffffff";
        ctx.textAlign = isLand ? "center" : "left";
        let titleX = isLand ? x + cardW/2 : x + 40;
        ctx.font = `800 ${isLand ? 30 : 36}px "${appState.theme.fontFamily}"`;
        ctx.fillText(`${daysOfWeekShort[i]} ${d.getDate()}`, titleX, y + (isLand ? 55 : 55));

        // CONTENU STREAMS
        if (isOff) {
            ctx.fillStyle = "#71717a";
            ctx.font = `800 36px "${appState.theme.fontFamily}"`;
            ctx.fillText("OFF", titleX, y + (isLand ? 350 : 100));
        } else {
            // MULTI STREAMS
            let availableH = isLand ? (cardH - 100) : (cardH - 60); 
            let slotH = availableH / dayStreams.length;
            
            dayStreams.forEach((stream, idx) => {
                let slotY = isLand ? (y + 100 + (idx * slotH)) : (y + 70 + (idx * 180));
                
                // Heure
                ctx.fillStyle = appState.theme.accentColor;
                ctx.font = `700 ${isLand ? 24 : 28}px "${appState.theme.fontFamily}"`;
                ctx.fillText(stream.time, titleX, slotY + 20);

                // Jaquette
                let imgW = isLand ? (dayStreams.length > 2 ? 80 : 120) : 100;
                let imgH = imgW * 1.33;
                let imgX = isLand ? (x + (cardW - imgW)/2) : (x + cardW - imgW - 30);
                let imgY = isLand ? (slotY + 40) : (slotY + 10);
                
                if (stream.boxArtUrl && imageCache[stream.boxArtUrl]) {
                    ctx.save(); ctx.beginPath(); ctx.roundRect(imgX, imgY, imgW, imgH, 8); ctx.clip();
                    ctx.drawImage(imageCache[stream.boxArtUrl], imgX, imgY, imgW, imgH); ctx.restore();
                }

                // Titre Jeu & Texte
                ctx.fillStyle = "#ffffff";
                ctx.font = `700 ${isLand ? 18 : 24}px "${appState.theme.fontFamily}"`;
                let textY = isLand ? (imgY + imgH + 25) : (slotY + 60);
                ctx.fillText(stream.categoryName.substring(0, 18), titleX, textY);

                ctx.fillStyle = "#aaaaaa";
                ctx.font = `400 ${isLand ? 14 : 18}px "${appState.theme.fontFamily}"`;
                wrapText(ctx, stream.title, titleX, textY + 25, isLand ? cardW-20 : cardW-250, 20, isLand?"center":"left");
                
                // Petite ligne séparatrice en Paysage s'il y en a plusieurs
                if (isLand && idx < dayStreams.length - 1) {
                    ctx.strokeStyle = "rgba(255,255,255,0.1)"; ctx.beginPath();
                    ctx.moveTo(x+20, slotY + slotH - 10); ctx.lineTo(x+cardW-20, slotY + slotH - 10); ctx.stroke();
                }
            });
        }
        
        currentY += cardH + gap; // Incrémente pour le mode Portrait
    }

    // SIGNATURE & RESEAUX SOCIAUX EN BAS
    let footerY = canvas.height - 60;
    
    // Pseudo principal
    if (appState.twitchData.username) {
        ctx.fillStyle = appState.theme.accentColor;
        ctx.font = `900 35px "${appState.theme.fontFamily}"`;
        ctx.textAlign = "center";
        ctx.fillText(`twitch.tv/${appState.twitchData.username}`, canvas.width / 2, footerY - 40);
    }
    
    // Réseaux secondaires
    ctx.fillStyle = "#ffffff";
    ctx.font = `400 20px "${appState.theme.fontFamily}"`;
    let socialsTxt = [];
    if (appState.socials.twitter) socialsTxt.push(`Twitter: ${appState.socials.twitter}`);
    if (appState.socials.tiktok) socialsTxt.push(`TikTok/YT: ${appState.socials.tiktok}`);
    
    if (socialsTxt.length > 0) {
        ctx.fillText(socialsTxt.join("   |   "), canvas.width / 2, footerY);
    }
}

// Utilitaires
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

document.getElementById('btnDownloadImage').addEventListener('click', () => {
    const link = document.createElement('a'); link.href = canvas.toDataURL("image/png");
    link.download = `planning_${appState.layout.format}.png`;
    document.body.appendChild(link); link.click(); link.remove();
});

// LANCEMENT INITIAL
loadBackgroundImageAndRender();