// ============================================================================
// 0. UTILITAIRES GÉNÉRAUX
// ============================================================================

/**
 * Fusion profonde (deep merge) de deux objets.
 * Corrige le bug du shallow spread qui écrase les sous-objets entiers.
 */
function deepMerge(defaults, saved) {
    const result = { ...defaults };
    for (const key in saved) {
        if (
            saved[key] !== null &&
            typeof saved[key] === 'object' &&
            !Array.isArray(saved[key])
        ) {
            result[key] = deepMerge(defaults[key] || {}, saved[key]);
        } else {
            result[key] = saved[key];
        }
    }
    return result;
}

/**
 * Système de toasts — remplace tous les alert() natifs
 */
function showToast(message, type = 'info', duration = 3500) {
    const container = document.getElementById('toastContainer');
    const icons = { success: 'fa-check-circle', error: 'fa-times-circle', info: 'fa-info-circle', warning: 'fa-exclamation-triangle' };
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `<i class="fas ${icons[type] || icons.info}"></i><span>${message}</span>`;
    container.appendChild(toast);
    setTimeout(() => {
        toast.classList.add('toast-out');
        toast.addEventListener('animationend', () => toast.remove());
    }, duration);
}

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
        style: "classic"
    },
    layout: { format: "landscape" },
    weekOffset: 0, // 0 = semaine actuelle, -1 = précédente, +1 = suivante
    socials: [
        { network: "\uf099", handle: "@Pseudo" },
        { network: "\uf167", handle: "Chaîne YT" }
    ],
    twitchData: { username: "MonPseudoTwitch", schedule: {} },
    twitchAuthToken: null
};

let appState = defaultState;
const savedLocalState = localStorage.getItem('schedulerProV4');
if (savedLocalState) {
    try {
        appState = deepMerge(defaultState, JSON.parse(savedLocalState));
    } catch (e) {
        console.warn('Impossible de charger l\'état sauvegardé :', e);
    }
}

function saveLocal() {
    localStorage.setItem('schedulerProV4', JSON.stringify(appState));
    loadBackgroundImageAndRender();
}

// ============================================================================
// 2. INITIALISATION UI & LISTENERS
// ============================================================================
window.addEventListener('DOMContentLoaded', () => {
    // Restaurer les champs
    document.getElementById('twitchUsername').value = appState.twitchData.username || "";
    document.getElementById('colorAccent').value    = appState.theme.accentColor;
    document.getElementById('colorText').value      = appState.theme.textColor;
    document.getElementById('fontFamily').value     = appState.theme.fontFamily;
    document.getElementById('themeStyle').value     = appState.theme.style;
    updateFormatButtons(appState.layout.format);
    updateWeekLabel();
    renderSocialsList();

    // Garantir que les polices sont chargées avant le 1er rendu
    document.fonts.ready.then(() => { loadBackgroundImageAndRender(); });
});

// Listeners apparence
document.getElementById('colorAccent').addEventListener('input', (e) => { appState.theme.accentColor = e.target.value; saveLocal(); });
document.getElementById('colorText').addEventListener('input', (e) => { appState.theme.textColor = e.target.value; saveLocal(); });
document.getElementById('twitchUsername').addEventListener('input', (e) => { appState.twitchData.username = e.target.value; saveLocal(); });
document.getElementById('themeStyle').addEventListener('change', (e) => { appState.theme.style = e.target.value; saveLocal(); });
document.getElementById('fontFamily').addEventListener('input', (e) => { appState.theme.fontFamily = e.target.value; saveLocal(); });

// Format
document.getElementById('btnFormatLandscape').addEventListener('click', () => { appState.layout.format = "landscape"; updateFormatButtons("landscape"); saveLocal(); });
document.getElementById('btnFormatPortrait').addEventListener('click', ()  => { appState.layout.format = "portrait";  updateFormatButtons("portrait");  saveLocal(); });
function updateFormatButtons(active) {
    document.getElementById('btnFormatLandscape').classList.toggle("active", active === "landscape");
    document.getElementById('btnFormatPortrait').classList.toggle("active",  active === "portrait");
}

// Fond d'écran
let bgImageObj = null;
const imageCache = {};
document.getElementById('bgUploader').addEventListener('change', (e) => {
    const reader = new FileReader();
    reader.onload = (ev) => { appState.theme.backgroundImageUrl = ev.target.result; saveLocal(); showToast('Image de fond appliquée', 'success'); };
    if (e.target.files[0]) reader.readAsDataURL(e.target.files[0]);
});
document.getElementById('btnClearBg').addEventListener('click', () => {
    appState.theme.backgroundImageUrl = null;
    saveLocal();
    showToast('Fond supprimé', 'info');
});

// Export / Import JSON
document.getElementById('btnExportConfig').addEventListener('click', () => {
    const json = JSON.stringify(appState, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `scheduler_config_${new Date().toISOString().split('T')[0]}.json`;
    link.click();
    showToast('Configuration exportée !', 'success');
});
document.getElementById('importConfig').addEventListener('change', (e) => {
    const reader = new FileReader();
    reader.onload = (ev) => {
        try {
            const imported = JSON.parse(ev.target.result);
            appState = deepMerge(defaultState, imported);
            // Restaurer les champs UI
            document.getElementById('twitchUsername').value = appState.twitchData.username || "";
            document.getElementById('colorAccent').value    = appState.theme.accentColor;
            document.getElementById('colorText').value      = appState.theme.textColor;
            document.getElementById('fontFamily').value     = appState.theme.fontFamily;
            document.getElementById('themeStyle').value     = appState.theme.style;
            updateFormatButtons(appState.layout.format);
            updateWeekLabel();
            renderSocialsList();
            saveLocal();
            showToast('Configuration importée avec succès !', 'success');
        } catch (err) {
            showToast('Fichier JSON invalide.', 'error');
        }
    };
    if (e.target.files[0]) reader.readAsText(e.target.files[0]);
    e.target.value = '';
});

// ============================================================================
// 2.5 NAVIGATION ENTRE SEMAINES
// ============================================================================
function updateWeekLabel() {
    const monday = getMondayByOffset(appState.weekOffset);
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);

    const fmt = (d) => d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
    const label = appState.weekOffset === 0
        ? `Cette semaine (${fmt(monday)})`
        : `${fmt(monday)} → ${fmt(sunday)}`;
    document.getElementById('weekLabel').textContent = label;
}

document.getElementById('btnPrevWeek').addEventListener('click', () => {
    appState.weekOffset -= 1;
    updateWeekLabel();
    saveLocal();
});
document.getElementById('btnNextWeek').addEventListener('click', () => {
    appState.weekOffset += 1;
    updateWeekLabel();
    saveLocal();
});
document.getElementById('btnResetWeek').addEventListener('click', () => {
    appState.weekOffset = 0;
    updateWeekLabel();
    saveLocal();
    showToast('Retour à la semaine actuelle', 'info');
});

// ============================================================================
// 2.6 GESTION DES RÉSEAUX SOCIAUX DYNAMIQUES
// ============================================================================
const networkOptions = [
    { name: "Twitter/X", val: "\uf099" },
    { name: "Twitch",    val: "\uf1e8" },
    { name: "YouTube",   val: "\uf167" },
    { name: "TikTok",    val: "\ue07b" },
    { name: "Instagram", val: "\uf16d" },
    { name: "Discord",   val: "\uf392" },
    { name: "Kick",      val: "\uf0e7" },
    { name: "BlueSky",   val: "\uf2a0" }
];

function renderSocialsList() {
    const container = document.getElementById('socialsContainer');
    container.innerHTML = '';
    appState.socials.forEach((soc, index) => {
        const div = document.createElement('div');
        div.className = "social-row";

        let selHTML = `<select class="soc-net soc-net-label" data-idx="${index}">`;
        networkOptions.forEach(opt => {
            const isSelected = soc.network === opt.val ? "selected" : "";
            selHTML += `<option value="${opt.val}" ${isSelected}>${opt.name}</option>`;
        });
        selHTML += `</select>`;

        div.innerHTML = `
            ${selHTML}
            <input type="text" class="input-text soc-handle" data-idx="${index}" placeholder="@pseudo..." value="${soc.handle}">
            <button class="btn-remove" data-idx="${index}" title="Supprimer"><i class="fas fa-times"></i></button>
        `;
        container.appendChild(div);
    });

    document.querySelectorAll('.soc-net').forEach(el => el.addEventListener('change', updateSocialState));
    document.querySelectorAll('.soc-handle').forEach(el => el.addEventListener('input', updateSocialState));
    document.querySelectorAll('.btn-remove').forEach(el => el.addEventListener('click', (e) => {
        const idx = e.currentTarget.dataset.idx;
        appState.socials.splice(idx, 1);
        renderSocialsList();
        saveLocal();
    }));
}

function updateSocialState(e) {
    const idx = e.target.dataset.idx;
    if (e.target.classList.contains('soc-net'))    appState.socials[idx].network = e.target.value;
    if (e.target.classList.contains('soc-handle')) appState.socials[idx].handle  = e.target.value;
    saveLocal();
}

document.getElementById('btnAddSocial').addEventListener('click', () => {
    if (appState.socials.length >= 5) { showToast('Maximum 5 réseaux sociaux !', 'warning'); return; }
    appState.socials.push({ network: "\uf1e8", handle: "" });
    renderSocialsList();
});

// ============================================================================
// 3. API TWITCH (Implicit Grant Flow)
// ============================================================================

// Le Client ID est lu depuis le localStorage (configuré via la modale Paramètres)
// Plus besoin de modifier le code source !
let TWITCH_CLIENT_ID = localStorage.getItem('twitchClientId') || '';

const REDIRECT_URI = window.location.href.split('#')[0].split('?')[0];

document.getElementById('btnFetchTwitch').addEventListener('click', () => {
    if (!TWITCH_CLIENT_ID) {
        showToast('Configurez d\'abord votre Client ID Twitch dans les Paramètres (⚙️) !', 'error', 5000);
        document.getElementById('settingsModal').classList.remove('hidden');
        return;
    }
    const authUrl = `https://id.twitch.tv/oauth2/authorize?client_id=${TWITCH_CLIENT_ID}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&response_type=token`;
    window.location.href = authUrl;
});

// Interception du token au retour
window.addEventListener('DOMContentLoaded', () => {
    const hash = window.location.hash;
    if (hash && hash.includes('access_token')) {
        const token = new URLSearchParams(hash.substring(1)).get('access_token');
        if (token) {
            window.history.replaceState({}, document.title, window.location.pathname);
            appState.twitchAuthToken = token;
            showToast('Connecté à Twitch ! Récupération du planning...', 'info');
            fetchTwitchSchedule(token);
        }
    }
});

async function fetchTwitchSchedule(token) {
    try {
        const headers = { 'Authorization': `Bearer ${token}`, 'Client-Id': TWITCH_CLIENT_ID };

        const userRes = await fetch('https://api.twitch.tv/helix/users', { headers });
        if (!userRes.ok) throw new Error(`Erreur utilisateur : ${userRes.status}`);
        const userData = await userRes.json();
        const userId = userData.data[0].id;

        appState.twitchData.username = userData.data[0].display_name;
        document.getElementById('twitchUsername').value = appState.twitchData.username;

        const schedRes = await fetch(`https://api.twitch.tv/helix/schedule?broadcaster_id=${userId}`, { headers });
        if (schedRes.status === 404) {
            showToast('Aucun planning Twitch configuré pour ce compte.', 'warning');
            return;
        }
        if (!schedRes.ok) throw new Error(`Erreur planning : ${schedRes.status}`);
        const schedData = await schedRes.json();
        let streams = schedData.data && schedData.data.segments ? schedData.data.segments : [];

        // Extraction des category_id uniques pour requête groupée
        const categoryIds = [...new Set(streams.filter(s => s.category?.id).map(s => s.category.id))];

        let boxArts = {};
        if (categoryIds.length > 0) {
            const gamesRes = await fetch(`https://api.twitch.tv/helix/games?id=${categoryIds.join('&id=')}`, { headers });
            const gamesData = await gamesRes.json();
            if (gamesData.data) {
                gamesData.data.forEach(g => {
                    boxArts[g.id] = g.box_art_url.replace('{width}', '188').replace('{height}', '250');
                });
            }
        }

        appState.twitchData.schedule = {};
        streams.forEach(s => {
            if (s.is_canceled) return;
            const dateKey = s.start_time.split('T')[0];
            if (!appState.twitchData.schedule[dateKey]) appState.twitchData.schedule[dateKey] = [];
            const timeStart = new Date(s.start_time).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
            const timeEnd   = s.end_time ? new Date(s.end_time).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : "";
            appState.twitchData.schedule[dateKey].push({
                timeStart,
                timeEnd,
                categoryName: s.category ? s.category.name : "Just Chatting",
                title: s.title || "",
                boxArtUrl: (s.category && boxArts[s.category.id]) ? boxArts[s.category.id] : null
            });
        });

        saveLocal();
        showToast(`Planning Twitch synchronisé ! ${streams.length} stream(s) trouvé(s).`, 'success');
    } catch (e) {
        console.error("Erreur Sync Twitch :", e);
        showToast(`Erreur de synchronisation. Voir la console (F12).`, 'error');
    }
}

// ============================================================================
// 4. ÉDITEUR MANUEL DE SEMAINE
// ============================================================================
const daysOfWeekFull = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'];

document.getElementById('btnOpenEditor').addEventListener('click', () => {
    const list = document.getElementById('daysList');
    list.innerHTML = '';
    const startOfWeek = getMondayByOffset(appState.weekOffset);

    for (let i = 0; i < 7; i++) {
        const d = new Date(startOfWeek);
        d.setDate(startOfWeek.getDate() + i);
        const dateKey = d.toISOString().split('T')[0];
        const dayStreams = appState.twitchData.schedule[dateKey] || [];

        const block = document.createElement('div');
        block.className = 'day-block';
        block.dataset.date = dateKey;
        block.innerHTML = `
            <div class="day-header">
                <h4>${daysOfWeekFull[i]} ${d.getDate()} ${d.toLocaleDateString('fr-FR', { month: 'long' })}</h4>
                <button class="btn-add-stream" onclick="addStreamRow(this)">+ Ajouter un live</button>
            </div>
            <div class="streams-container"></div>
        `;

        const container = block.querySelector('.streams-container');
        if (dayStreams.length === 0) {
            container.innerHTML = `<p style="color:var(--text-dim);font-size:13px;font-style:italic;padding:8px 0;">Jour de repos (OFF)</p>`;
        } else {
            dayStreams.forEach(stream => container.appendChild(createStreamRowHTML(stream)));
        }
        list.appendChild(block);
    }
    document.getElementById('weekEditorModal').classList.remove('hidden');
});

// Fermeture modal
document.getElementById('btnCloseWeek').addEventListener('click', () => document.getElementById('weekEditorModal').classList.add('hidden'));
document.getElementById('btnCloseWeekBottom').addEventListener('click', () => document.getElementById('weekEditorModal').classList.add('hidden'));

// Fermer avec Escape
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') document.getElementById('weekEditorModal').classList.add('hidden');
});

// Création d'une ligne d'édition (avec upload de jaquette manuelle)
window.createStreamRowHTML = function(stream = { timeStart: "20:00", timeEnd: "", categoryName: "", title: "", boxArtUrl: "" }) {
    const div = document.createElement('div');
    div.className = 'stream-row';

    const thumbId = 'thumb_' + Math.random().toString(36).slice(2);
    const uploadId = 'upload_' + Math.random().toString(36).slice(2);

    div.innerHTML = `
        <div class="time-col">
            <label>Début</label>
            <input type="time" class="input-text time-start" value="${stream.timeStart}">
        </div>
        <div class="time-col">
            <label>Fin (opt.)</label>
            <input type="time" class="input-text time-end" value="${stream.timeEnd || ''}">
        </div>
        <input type="text" class="input-text cat-inp" placeholder="Jeu / Catégorie" value="${stream.categoryName}">
        <button class="btn-search" onclick="searchGameForEditor(this)" title="Rechercher sur Twitch"><i class="fas fa-search"></i></button>
        <div class="boxart-wrapper">
            <img id="${thumbId}" class="thumb-preview ${stream.boxArtUrl ? 'visible' : ''}" src="${stream.boxArtUrl || ''}" alt="Jaquette">
            <input type="file" id="${uploadId}" accept="image/*" style="display:none;">
            <button class="btn-upload-thumb" onclick="document.getElementById('${uploadId}').click()">📁 Upload</button>
        </div>
        <input type="text" class="input-text title-inp" placeholder="Titre du live" value="${stream.title}">
        <input type="hidden" class="boxart-inp" value="${stream.boxArtUrl || ''}">
        <button class="btn-remove-stream" onclick="this.closest('.stream-row').remove()" title="Supprimer"><i class="fas fa-times"></i></button>
    `;

    // Upload jaquette manuelle → Base64
    div.querySelector(`#${uploadId}`).addEventListener('change', function(e) {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (ev) => {
            const base64 = ev.target.result;
            div.querySelector('.boxart-inp').value = base64;
            const thumb = div.querySelector(`#${thumbId}`);
            thumb.src = base64;
            thumb.classList.add('visible');
        };
        reader.readAsDataURL(file);
    });

    return div;
};

window.addStreamRow = function(btn) {
    const container = btn.parentElement.nextElementSibling;
    const placeholder = container.querySelector('p');
    if (placeholder) container.innerHTML = '';
    container.appendChild(createStreamRowHTML());
};

window.searchGameForEditor = async function(btn) {
    if (!appState.twitchAuthToken) { showToast('Connectez-vous d\'abord à Twitch (bouton 1) !', 'warning'); return; }
    const row = btn.closest('.stream-row');
    const query = row.querySelector('.cat-inp').value;
    if (!query) return;

    const icon = btn.querySelector('i');
    icon.className = 'fas fa-spinner fa-spin';
    try {
        const res = await fetch(`https://api.twitch.tv/helix/search/categories?query=${encodeURIComponent(query)}`, {
            headers: { 'Authorization': `Bearer ${appState.twitchAuthToken}`, 'Client-Id': TWITCH_CLIENT_ID }
        });
        const data = await res.json();
        if (data.data && data.data.length > 0) {
            const url = data.data[0].box_art_url.replace('{width}', '188').replace('{height}', '250');
            row.querySelector('.boxart-inp').value = url;
            const thumb = row.querySelector('.thumb-preview');
            thumb.src = url;
            thumb.classList.add('visible');
            icon.className = 'fas fa-check';
            btn.style.background = 'rgba(16,185,129,0.15)';
            btn.style.borderColor = 'rgba(16,185,129,0.4)';
            btn.style.color = '#10b981';
            showToast(`Jaquette trouvée : ${data.data[0].name}`, 'success', 2000);
        } else {
            icon.className = 'fas fa-times';
            btn.style.background = 'rgba(239,68,68,0.15)';
            btn.style.color = '#ef4444';
            showToast('Aucun jeu trouvé avec ce nom.', 'warning');
        }
    } catch (e) {
        icon.className = 'fas fa-exclamation-triangle';
        showToast('Erreur lors de la recherche.', 'error');
    }
};

document.getElementById('btnSaveWeek').addEventListener('click', () => {
    appState.twitchData.schedule = {};
    document.querySelectorAll('.day-block').forEach(block => {
        const dateKey = block.dataset.date;
        const streams = [];
        block.querySelectorAll('.stream-row').forEach(row => {
            streams.push({
                timeStart:    row.querySelector('.time-start').value,
                timeEnd:      row.querySelector('.time-end').value,
                categoryName: row.querySelector('.cat-inp').value,
                title:        row.querySelector('.title-inp').value,
                boxArtUrl:    row.querySelector('.boxart-inp').value
            });
        });
        streams.sort((a, b) => a.timeStart.localeCompare(b.timeStart));
        if (streams.length > 0) appState.twitchData.schedule[dateKey] = streams;
    });
    saveLocal();
    document.getElementById('weekEditorModal').classList.add('hidden');
    showToast('Planning mis à jour !', 'success');
});

// ============================================================================
// 5. EXPORTS IMAGE
// ============================================================================
const canvas = document.getElementById('scheduleCanvas');
const ctx = canvas.getContext('2d');

function downloadCanvas(mimeType, quality, filename) {
    const dataUrl = quality ? canvas.toDataURL(mimeType, quality) : canvas.toDataURL(mimeType);
    const link = document.createElement('a');
    link.href = dataUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    showToast(`Image téléchargée en ${filename.split('.').pop().toUpperCase()} !`, 'success');
}

document.getElementById('btnDownloadImage').addEventListener('click', () => {
    downloadCanvas('image/png', null, `planning_${appState.layout.format}_${new Date().toISOString().split('T')[0]}.png`);
});
document.getElementById('btnDownloadJpeg').addEventListener('click', () => {
    downloadCanvas('image/jpeg', 0.92, `planning_${appState.layout.format}.jpg`);
});
document.getElementById('btnDownloadWebp').addEventListener('click', () => {
    downloadCanvas('image/webp', 0.85, `planning_${appState.layout.format}.webp`);
});

// Copier dans le presse-papier
document.getElementById('btnCopyClipboard').addEventListener('click', async () => {
    try {
        const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
        await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
        showToast('Image copiée dans le presse-papier !', 'success');
    } catch (e) {
        showToast('Copie impossible (navigateur non supporté).', 'error');
    }
});

// Export "Tonight" — carré 1:1 du prochain stream du jour
document.getElementById('btnDownloadTonight').addEventListener('click', () => {
    const today = new Date().toISOString().split('T')[0];
    const todayStreams = appState.twitchData.schedule[today];
    if (!todayStreams || todayStreams.length === 0) {
        showToast('Aucun stream prévu aujourd\'hui !', 'warning');
        return;
    }
    renderTonightCanvas(todayStreams[0]);
});

function renderTonightCanvas(stream) {
    const tc = document.createElement('canvas');
    tc.width = 1080; tc.height = 1080;
    const tCtx = tc.getContext('2d');

    // Fond gradient
    const grad = tCtx.createLinearGradient(0, 0, 1080, 1080);
    grad.addColorStop(0, '#09090b');
    grad.addColorStop(1, '#1a0a2e');
    tCtx.fillStyle = grad;
    tCtx.fillRect(0, 0, 1080, 1080);

    // Halo accent
    const halo = tCtx.createRadialGradient(540, 540, 100, 540, 540, 600);
    halo.addColorStop(0, appState.theme.accentColor + '33');
    halo.addColorStop(1, 'transparent');
    tCtx.fillStyle = halo;
    tCtx.fillRect(0, 0, 1080, 1080);

    // Jaquette si disponible
    const img = stream.boxArtUrl && imageCache[stream.boxArtUrl];
    if (img) {
        tCtx.save();
        tCtx.globalAlpha = 0.25;
        drawImagePropCtx(tCtx, img, 0, 0, 1080, 1080);
        tCtx.globalAlpha = 1;
        tCtx.fillStyle = 'rgba(0,0,0,0.6)';
        tCtx.fillRect(0, 0, 1080, 1080);
        tCtx.restore();

        // Jaquette centrée
        tCtx.save();
        const iw = 270, ih = 360;
        tCtx.beginPath();
        tCtx.roundRect(540 - iw / 2, 300, iw, ih, 16);
        tCtx.clip();
        tCtx.drawImage(img, 540 - iw / 2, 300, iw, ih);
        tCtx.restore();
    }

    // "CE SOIR"
    tCtx.fillStyle = appState.theme.accentColor;
    tCtx.font = `900 48px "${appState.theme.fontFamily}"`;
    tCtx.textAlign = 'center';
    tCtx.fillText('CE SOIR', 540, 250);

    // Heure
    tCtx.fillStyle = '#ffffff';
    tCtx.font = `900 96px "${appState.theme.fontFamily}"`;
    const timeStr = stream.timeEnd ? `${stream.timeStart} – ${stream.timeEnd}` : stream.timeStart;
    tCtx.fillText(timeStr, 540, img ? 730 : 540);

    // Catégorie
    tCtx.fillStyle = appState.theme.accentColor;
    tCtx.font = `700 36px "${appState.theme.fontFamily}"`;
    tCtx.fillText(stream.categoryName || '', 540, img ? 790 : 620);

    // Titre
    tCtx.fillStyle = '#aaaaaa';
    tCtx.font = `400 28px "${appState.theme.fontFamily}"`;
    wrapText(tCtx, stream.title, 540, img ? 850 : 690, 900, 36, 'center');

    // Pseudo Twitch
    tCtx.fillStyle = appState.theme.accentColor;
    tCtx.font = `700 30px "${appState.theme.fontFamily}"`;
    tCtx.fillText(`twitch.tv/${appState.twitchData.username}`, 540, 1020);

    const link = document.createElement('a');
    link.href = tc.toDataURL('image/png');
    link.download = `tonight_${appState.twitchData.username}.png`;
    link.click();
    showToast('Visuel "Ce soir" exporté !', 'success');
}

// ============================================================================
// 6. MOTEUR DE RENDU CANVAS
// ============================================================================
const daysOfWeekShort = ['LUN', 'MAR', 'MER', 'JEU', 'VEN', 'SAM', 'DIM'];

function loadBackgroundImageAndRender() {
    if (appState.theme.backgroundImageUrl) {
        bgImageObj = new Image();
        bgImageObj.onload  = () => preloadImagesAndRender();
        bgImageObj.onerror = () => { bgImageObj = null; preloadImagesAndRender(); };
        bgImageObj.src = appState.theme.backgroundImageUrl;
    } else {
        bgImageObj = null;
        preloadImagesAndRender();
    }
}

function preloadImagesAndRender() {
    let toLoad = 0, loaded = 0;
    const check = () => { if (loaded === toLoad) drawWithFonts(); };

    Object.values(appState.twitchData.schedule).forEach(dayStreams => {
        dayStreams.forEach(s => {
            if (s.boxArtUrl && !imageCache[s.boxArtUrl]) {
                toLoad++;
                const img = new Image();
                img.crossOrigin = "Anonymous";
                img.onload  = () => { loaded++; check(); };
                img.onerror = () => { loaded++; check(); };
                img.src = s.boxArtUrl;
                imageCache[s.boxArtUrl] = img;
            }
        });
    });
    if (toLoad === 0) drawWithFonts();
}

function drawWithFonts() {
    document.fonts.ready.then(() => renderCanvas());
}

// ─────────────────────────────────────────
// RENDU PRINCIPAL
// ─────────────────────────────────────────
function renderCanvas() {
    const isLand = appState.layout.format === "landscape";
    const style  = appState.theme.style;
    const accent = appState.theme.accentColor;
    const font   = appState.theme.fontFamily;

    const startOfWeek = getMondayByOffset(appState.weekOffset);

    // Calcul hauteur Portrait dynamique
    let totalPortraitHeight = 280;
    if (!isLand) {
        for (let i = 0; i < 7; i++) {
            const d = new Date(startOfWeek);
            d.setDate(startOfWeek.getDate() + i);
            const nbStreams = (appState.twitchData.schedule[d.toISOString().split('T')[0]] || []).length;
            totalPortraitHeight += (nbStreams === 0 ? 130 : nbStreams * 190 + 70) + 28;
        }
        totalPortraitHeight += 200;
    }

    canvas.width  = isLand ? 1920 : 1080;
    canvas.height = isLand ? 1080 : Math.max(1920, totalPortraitHeight);

    // ── FOND ──
    ctx.fillStyle = appState.theme.backgroundColor;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Styles avec fond spécial
    if (style === 'pastel') {
        const grad = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
        grad.addColorStop(0, '#e8d5f5');
        grad.addColorStop(0.5, '#fce4ec');
        grad.addColorStop(1, '#e3f2fd');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
    } else if (style === 'newspaper') {
        ctx.fillStyle = '#f5f0e8';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        // Texture de points
        ctx.fillStyle = 'rgba(0,0,0,0.04)';
        for (let x = 0; x < canvas.width; x += 6) {
            for (let y = 0; y < canvas.height; y += 6) {
                ctx.beginPath();
                ctx.arc(x, y, 0.8, 0, Math.PI * 2);
                ctx.fill();
            }
        }
    } else if (style === 'lofi') {
        const grad = ctx.createLinearGradient(0, 0, 0, canvas.height);
        grad.addColorStop(0, '#0d1117');
        grad.addColorStop(1, '#1a1420');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        // Film grain simulé
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imageData.data;
        for (let i = 0; i < data.length; i += 4) {
            const noise = (Math.random() - 0.5) * 18;
            data[i]     = Math.min(255, Math.max(0, data[i]     + noise));
            data[i + 1] = Math.min(255, Math.max(0, data[i + 1] + noise));
            data[i + 2] = Math.min(255, Math.max(0, data[i + 2] + noise));
        }
        ctx.putImageData(imageData, 0, 0);
        // Vignette
        const vignette = ctx.createRadialGradient(canvas.width / 2, canvas.height / 2, canvas.height * 0.3, canvas.width / 2, canvas.height / 2, canvas.height * 0.85);
        vignette.addColorStop(0, 'transparent');
        vignette.addColorStop(1, 'rgba(0,0,0,0.65)');
        ctx.fillStyle = vignette;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
    } else if (style === 'cosmic') {
        ctx.fillStyle = '#020408';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        // Étoiles
        for (let i = 0; i < 350; i++) {
            const x = Math.random() * canvas.width;
            const y = Math.random() * canvas.height;
            const r = Math.random() * 1.5;
            const a = Math.random() * 0.8 + 0.2;
            ctx.beginPath();
            ctx.arc(x, y, r, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(255,255,255,${a})`;
            ctx.fill();
        }
        // Nébuleuses
        [[0.15, 0.2, '#ff00ff'], [0.8, 0.7, '#00ffff'], [0.5, 0.9, '#9146ff']].forEach(([rx, ry, col]) => {
            const nebula = ctx.createRadialGradient(canvas.width * rx, canvas.height * ry, 0, canvas.width * rx, canvas.height * ry, canvas.width * 0.25);
            nebula.addColorStop(0, col + '22');
            nebula.addColorStop(1, 'transparent');
            ctx.fillStyle = nebula;
            ctx.fillRect(0, 0, canvas.width, canvas.height);
        });
    } else if (style === 'arcade') {
        ctx.fillStyle = '#050510';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        // Grille CRT
        ctx.strokeStyle = 'rgba(0,255,65,0.07)';
        ctx.lineWidth = 1;
        for (let x = 0; x < canvas.width; x += 40) {
            ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, canvas.height); ctx.stroke();
        }
        for (let y = 0; y < canvas.height; y += 40) {
            ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(canvas.width, y); ctx.stroke();
        }
        // Scanlines
        for (let y = 0; y < canvas.height; y += 4) {
            ctx.fillStyle = 'rgba(0,0,0,0.18)';
            ctx.fillRect(0, y, canvas.width, 2);
        }
    }

    if (bgImageObj) {
        drawImagePropCtx(ctx, bgImageObj, 0, 0, canvas.width, canvas.height);
        ctx.fillStyle = "rgba(0,0,0,0.5)";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
    }

    // ── TITRE ──
    ctx.textAlign = "center";
    const titleText = "PLANNING DE LA SEMAINE";
    const titleY = isLand ? 110 : 120;
    const titleSize = isLand ? 68 : 72;

    if (style === 'cosmic') {
        // Titre iridescent
        const iriGrad = ctx.createLinearGradient(canvas.width / 2 - 600, 0, canvas.width / 2 + 600, 0);
        iriGrad.addColorStop(0, '#ff00ff');
        iriGrad.addColorStop(0.33, '#9146ff');
        iriGrad.addColorStop(0.66, '#00ffff');
        iriGrad.addColorStop(1, '#ff00ff');
        ctx.fillStyle = iriGrad;
        ctx.shadowBlur = 30; ctx.shadowColor = '#9146ff';
        ctx.font = `900 ${titleSize}px "${font}"`;
        ctx.fillText(titleText, canvas.width / 2, titleY);
        ctx.shadowBlur = 0;
    } else if (style === 'neon') {
        ctx.shadowBlur = 25; ctx.shadowColor = accent;
        ctx.fillStyle = '#ffffff';
        ctx.font = `900 ${titleSize}px "${font}"`;
        ctx.fillText(titleText, canvas.width / 2, titleY);
        ctx.shadowBlur = 0;
    } else if (style === 'newspaper') {
        ctx.fillStyle = '#1a1a1a';
        ctx.font = `900 ${titleSize}px "Playfair Display"`;
        ctx.fillText(titleText, canvas.width / 2, titleY);
        // Ligne de séparation sous le titre
        ctx.strokeStyle = '#1a1a1a'; ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(canvas.width * 0.1, titleY + 20);
        ctx.lineTo(canvas.width * 0.9, titleY + 20);
        ctx.stroke();
    } else if (style === 'arcade') {
        ctx.fillStyle = '#00ff41';
        ctx.shadowBlur = 20; ctx.shadowColor = '#00ff41';
        ctx.font = `900 ${Math.floor(titleSize * 0.7)}px "Press Start 2P"`;
        ctx.fillText(titleText, canvas.width / 2, titleY);
        ctx.shadowBlur = 0;
    } else if (style === 'lofi') {
        ctx.fillStyle = '#e8c9a0';
        ctx.font = `700 ${titleSize}px "Caveat"`;
        ctx.fillText(titleText, canvas.width / 2, titleY + 20);
    } else if (style === 'pastel') {
        ctx.fillStyle = '#5b21b6';
        ctx.font = `900 ${titleSize}px "Nunito"`;
        ctx.fillText(titleText, canvas.width / 2, titleY);
    } else {
        ctx.fillStyle = appState.theme.textColor;
        ctx.font = `900 ${titleSize}px "${font}"`;
        ctx.fillText(titleText, canvas.width / 2, titleY);
    }

    // Sous-titre : période de la semaine
    const monday = getMondayByOffset(appState.weekOffset);
    const sunday = new Date(monday); sunday.setDate(monday.getDate() + 6);
    const periodStr = `${monday.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })} – ${sunday.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}`;
    const isDarkBg = ['pastel', 'newspaper'].includes(style);
    ctx.fillStyle = isDarkBg ? '#555555' : 'rgba(255,255,255,0.45)';
    ctx.font = `500 ${isLand ? 22 : 26}px "${font}"`;
    ctx.fillText(periodStr, canvas.width / 2, titleY + 45);

    // ── CARTES ──
    const cardW   = isLand ? 240 : 870;
    const gap     = isLand ? 20  : 28;
    const startX  = isLand ? (canvas.width - (cardW * 7 + gap * 6)) / 2 : (canvas.width - cardW) / 2;
    let currentY  = isLand ? 200 : 200;

    for (let i = 0; i < 7; i++) {
        const d = new Date(startOfWeek);
        d.setDate(startOfWeek.getDate() + i);
        const dateKey   = d.toISOString().split('T')[0];
        const dayStreams = appState.twitchData.schedule[dateKey] || [];
        const isOff     = dayStreams.length === 0;
        const cardH     = isLand ? 740 : (isOff ? 130 : dayStreams.length * 190 + 70);
        const x = isLand ? startX + i * (cardW + gap) : startX;
        const y = isLand ? 200 : currentY;

        // ── FOND DE CARTE selon style ──
        ctx.save();

        if (style === 'classic') {
            if (bgImageObj) ctx.filter = "blur(14px)";
            ctx.fillStyle = "rgba(20,20,28,0.72)";
            ctx.strokeStyle = "rgba(255,255,255,0.08)"; ctx.lineWidth = 1;
            ctx.beginPath(); ctx.roundRect(x, y, cardW, cardH, 14); ctx.fill(); ctx.stroke();
            ctx.filter = "none";
        } else if (style === 'polaroid') {
            ctx.shadowBlur = 20; ctx.shadowColor = "rgba(0,0,0,0.35)";
            ctx.fillStyle = "#ffffff";
            ctx.fillRect(x, y, cardW, cardH);
            ctx.shadowBlur = 0;
        } else if (style === 'minimal') {
            // Fond léger
            ctx.fillStyle = "rgba(255,255,255,0.03)";
            ctx.fillRect(x, y, cardW, cardH);
            // Barre accent
            ctx.fillStyle = accent;
            if (isLand) ctx.fillRect(x, y, cardW, 5);
            else ctx.fillRect(x, y, 5, cardH);
        } else if (style === 'neon') {
            ctx.fillStyle = "rgba(0,0,0,0.82)";
            ctx.shadowBlur = 18; ctx.shadowColor = accent;
            ctx.strokeStyle = accent; ctx.lineWidth = 1.5;
            ctx.beginPath(); ctx.roundRect(x, y, cardW, cardH, 8); ctx.fill(); ctx.stroke();
            ctx.shadowBlur = 0;
        } else if (style === 'arcade') {
            const accentArcade = '#00ff41';
            ctx.fillStyle = "rgba(0,10,0,0.88)";
            ctx.strokeStyle = accentArcade; ctx.lineWidth = 2;
            ctx.shadowBlur = 12; ctx.shadowColor = accentArcade;
            ctx.beginPath(); ctx.roundRect(x, y, cardW, cardH, 0); ctx.fill(); ctx.stroke();
            ctx.shadowBlur = 0;
        } else if (style === 'pastel') {
            ctx.fillStyle = "rgba(255,255,255,0.7)";
            ctx.strokeStyle = "rgba(145,70,255,0.15)"; ctx.lineWidth = 1.5;
            ctx.shadowBlur = 20; ctx.shadowColor = "rgba(145,70,255,0.12)";
            ctx.beginPath(); ctx.roundRect(x, y, cardW, cardH, 20); ctx.fill(); ctx.stroke();
            ctx.shadowBlur = 0;
        } else if (style === 'newspaper') {
            ctx.fillStyle = "#fffef5";
            ctx.strokeStyle = "#1a1a1a"; ctx.lineWidth = 2;
            ctx.beginPath(); ctx.roundRect(x, y, cardW, cardH, 0); ctx.fill(); ctx.stroke();
        } else if (style === 'lofi') {
            ctx.fillStyle = "rgba(30,20,10,0.75)";
            ctx.strokeStyle = "#c8a87a"; ctx.lineWidth = 1;
            ctx.beginPath(); ctx.roundRect(x, y, cardW, cardH, 6); ctx.fill(); ctx.stroke();
        } else if (style === 'cosmic') {
            const cosGrad = ctx.createLinearGradient(x, y, x + cardW, y + cardH);
            cosGrad.addColorStop(0, "rgba(15,5,30,0.9)");
            cosGrad.addColorStop(1, "rgba(5,10,25,0.9)");
            ctx.fillStyle = cosGrad;
            ctx.strokeStyle = accent + 'aa'; ctx.lineWidth = 1.5;
            ctx.shadowBlur = 20; ctx.shadowColor = accent;
            ctx.beginPath(); ctx.roundRect(x, y, cardW, cardH, 12); ctx.fill(); ctx.stroke();
            ctx.shadowBlur = 0;
        }
        ctx.restore();

        // Header carte (Classic)
        if (style === 'classic') {
            ctx.save();
            ctx.fillStyle = accent;
            ctx.beginPath();
            if (isLand) ctx.roundRect(x, y, cardW, 75, [14, 14, 0, 0]);
            else ctx.roundRect(x, y, 12, cardH, [14, 0, 0, 14]);
            ctx.fill();
            ctx.restore();
        }

        // ── TEXTE DATE ──
        const isDarkCard = ['polaroid', 'pastel', 'newspaper'].includes(style);
        const titleColor = isDarkCard ? '#111111' : '#ffffff';

        ctx.fillStyle = titleColor;
        ctx.textAlign = isLand ? "center" : "left";
        const titleX = isLand ? x + cardW / 2 : x + 40;

        const dateText = `${daysOfWeekShort[i]} ${d.getDate()}`;
        const dateFontSize = isLand ? 28 : 34;

        ctx.save();
        if (style === 'neon') { ctx.shadowBlur = 10; ctx.shadowColor = accent; }
        else if (style === 'arcade') { ctx.shadowBlur = 8; ctx.shadowColor = '#00ff41'; }
        ctx.font = `900 ${dateFontSize}px "${style === 'newspaper' ? 'Playfair Display' : style === 'arcade' ? 'Press Start 2P' : style === 'lofi' ? 'Caveat' : style === 'pastel' ? 'Nunito' : font}"`;
        ctx.fillStyle = style === 'arcade' ? '#00ff41' : style === 'lofi' ? '#e8c9a0' : style === 'pastel' ? '#5b21b6' : titleColor;
        ctx.fillText(dateText, titleX, y + (isLand ? 50 : 50));
        ctx.shadowBlur = 0;
        ctx.restore();

        // Soulignement polaroid
        if (style === 'polaroid') {
            ctx.fillStyle = '#000000';
            ctx.fillRect(isLand ? x + 20 : x + 40, y + (isLand ? 62 : 62), isLand ? cardW - 40 : 200, 3);
        }

        // ── CONTENU OFF / STREAMS ──
        if (isOff) {
            ctx.fillStyle = isDarkCard ? '#888' : 'rgba(255,255,255,0.2)';
            ctx.font = `800 ${isLand ? 32 : 40}px "${font}"`;
            ctx.textAlign = isLand ? "center" : "left";
            ctx.fillText("OFF", isLand ? x + cardW / 2 : x + 40, y + (isLand ? 380 : 95));
        } else {
            const slotH = isLand ? (cardH - 90) / dayStreams.length : 190;

            dayStreams.forEach((stream, idx) => {
                const slotY = isLand ? y + 85 + idx * slotH : y + 70 + idx * slotH;

                // Heure
                const displayTime = stream.timeEnd ? `${stream.timeStart} – ${stream.timeEnd}` : stream.timeStart;
                ctx.fillStyle = style === 'arcade' ? '#00ff41' : style === 'lofi' ? '#c8a87a' : style === 'pastel' ? '#7c3aed' : style === 'newspaper' ? '#1a1a1a' : accent;
                ctx.font = `700 ${isLand ? 18 : 22}px "${font}"`;
                ctx.textAlign = isLand ? "center" : "left";
                ctx.fillText(displayTime, titleX, slotY + 22);

                // Jaquette
                const imgW = isLand ? (dayStreams.length > 2 ? 80 : 110) : 95;
                const imgH = imgW * 1.33;
                const imgX = isLand ? x + (cardW - imgW) / 2 : x + cardW - imgW - 30;
                const imgY = isLand ? slotY + 38 : slotY + 8;

                if (stream.boxArtUrl && imageCache[stream.boxArtUrl]) {
                    ctx.save();
                    if (style === 'newspaper') {
                        ctx.filter = 'grayscale(100%) contrast(1.1)';
                    }
                    ctx.beginPath();
                    ctx.roundRect(imgX, imgY, imgW, imgH, style === 'polaroid' ? 0 : 6);
                    ctx.clip();
                    ctx.drawImage(imageCache[stream.boxArtUrl], imgX, imgY, imgW, imgH);
                    ctx.restore();
                }

                // Nom catégorie
                ctx.fillStyle = isDarkCard ? '#222222' : '#ffffff';
                ctx.font = `700 ${isLand ? 16 : 22}px "${font}"`;
                const textY = isLand ? imgY + imgH + 24 : slotY + 58;
                ctx.fillText(stream.categoryName.substring(0, 20), titleX, textY);

                // Titre du live
                ctx.fillStyle = isDarkCard ? '#555555' : 'rgba(255,255,255,0.55)';
                ctx.font = `400 ${isLand ? 13 : 17}px "${font}"`;
                wrapText(ctx, stream.title, titleX, textY + 22, isLand ? cardW - 18 : cardW - 230, 18, isLand ? 'center' : 'left');

                // Séparateur entre streams (paysage)
                if (isLand && idx < dayStreams.length - 1) {
                    ctx.strokeStyle = isDarkCard ? 'rgba(0,0,0,0.1)' : 'rgba(255,255,255,0.07)';
                    ctx.lineWidth = 1;
                    ctx.beginPath();
                    ctx.moveTo(x + 15, slotY + slotH - 8);
                    ctx.lineTo(x + cardW - 15, slotY + slotH - 8);
                    ctx.stroke();
                }
            });
        }

        currentY += cardH + gap;
    }

    // ── FOOTER ──
    const footerY = canvas.height - 65;
    const isDarkTheme = ['pastel', 'newspaper'].includes(style);

    if (appState.twitchData.username) {
        ctx.textAlign = "center";
        ctx.fillStyle = style === 'arcade' ? '#00ff41' : style === 'lofi' ? '#c8a87a' : style === 'newspaper' ? '#1a1a1a' : accent;
        ctx.font = `900 ${isLand ? 34 : 36}px "${font}"`;
        if (style === 'neon' || style === 'cosmic') { ctx.shadowBlur = 18; ctx.shadowColor = accent; }
        ctx.fillText(`twitch.tv/${appState.twitchData.username}`, canvas.width / 2, footerY - 28);
        ctx.shadowBlur = 0;
    }

    // Réseaux sociaux via FontAwesome
    ctx.fillStyle = isDarkTheme ? '#333333' : 'rgba(255,255,255,0.8)';
    ctx.textAlign = "center";
    const socialParts = appState.socials.filter(s => s.handle.trim() !== '');
    if (socialParts.length > 0) {
        const socialStr = socialParts.map(s => `${s.network}  ${s.handle}`).join('      ');
        ctx.font = `400 ${isLand ? 21 : 24}px 'FontAwesome', "${font}"`;
        ctx.fillText(socialStr, canvas.width / 2, footerY + 20);
    }
}

// ============================================================================
// 2.7 MODALE PARAMÈTRES (Client ID Twitch)
// ============================================================================

function updateClientIdStatus() {
    const statusEl = document.getElementById('clientIdStatus');
    if (!statusEl) return;
    if (TWITCH_CLIENT_ID) {
        // Masque partiellement l'ID pour la sécurité
        const masked = TWITCH_CLIENT_ID.slice(0, 6) + '•'.repeat(Math.max(0, TWITCH_CLIENT_ID.length - 10)) + TWITCH_CLIENT_ID.slice(-4);
        statusEl.className = 'client-id-status status-ok';
        statusEl.innerHTML = `<i class="fas fa-circle-check"></i><span>Client ID configuré : <strong>${masked}</strong></span>`;
    } else {
        statusEl.className = 'client-id-status status-empty';
        statusEl.innerHTML = `<i class="fas fa-circle-xmark"></i><span>Aucun Client ID configuré</span>`;
    }
}

document.getElementById('btnOpenSettings').addEventListener('click', () => {
    document.getElementById('settingsClientId').value = TWITCH_CLIENT_ID;
    updateClientIdStatus();
    document.getElementById('settingsModal').classList.remove('hidden');
});

document.getElementById('btnCloseSettings').addEventListener('click', () => {
    document.getElementById('settingsModal').classList.add('hidden');
});

// Fermer en cliquant sur l'arrière-plan
document.getElementById('settingsModal').addEventListener('click', (e) => {
    if (e.target === e.currentTarget) e.currentTarget.classList.add('hidden');
});

document.getElementById('btnSaveClientId').addEventListener('click', () => {
    const inputVal = document.getElementById('settingsClientId').value.trim();
    if (!inputVal) {
        showToast('Le champ Client ID est vide.', 'warning');
        return;
    }
    // Validation basique : doit ressembler à un Client ID Twitch (alphanumérique, ~30 caractères)
    if (!/^[a-z0-9]{10,50}$/i.test(inputVal)) {
        showToast('Le format du Client ID semble invalide. Vérifiez votre copie.', 'error');
        return;
    }
    TWITCH_CLIENT_ID = inputVal;
    localStorage.setItem('twitchClientId', TWITCH_CLIENT_ID);
    updateClientIdStatus();
    showToast('Client ID enregistré ! Vous pouvez maintenant synchro Twitch.', 'success');
});

// Initialiser le statut et l'URL de redirect au chargement
window.addEventListener('DOMContentLoaded', () => {
    updateClientIdStatus();

    // Afficher l'URL de redirect dès le chargement (toujours visible dans la modale)
    const urlDisplay = document.getElementById('currentUrlDisplay');
    if (urlDisplay) urlDisplay.textContent = REDIRECT_URI;
});

// Bouton copier l'URL de redirect
document.getElementById('btnCopyRedirectUrl').addEventListener('click', () => {
    navigator.clipboard.writeText(REDIRECT_URI).then(() => {
        const btn = document.getElementById('btnCopyRedirectUrl');
        btn.classList.add('copied');
        btn.innerHTML = '<i class="fas fa-check"></i>';
        setTimeout(() => {
            btn.classList.remove('copied');
            btn.innerHTML = '<i class="fas fa-copy"></i>';
        }, 2000);
        showToast('URL de redirect copiée !', 'success', 2000);
    }).catch(() => {
        showToast('Copie impossible, copiez manuellement.', 'warning');
    });
});

// ============================================================================
// 7. UTILITAIRES
// ============================================================================

function getMondayByOffset(offset = 0) {
    const d = new Date();
    const day = d.getDay();
    // Lundi de la semaine courante
    d.setDate(d.getDate() - day + (day === 0 ? -6 : 1));
    // Appliquer l'offset en semaines
    d.setDate(d.getDate() + offset * 7);
    d.setHours(0, 0, 0, 0);
    return d;
}

function wrapText(ctx, text, x, y, maxW, lineH, align) {
    if (!text) return;
    const words = text.split(' ');
    let line = '';
    ctx.textAlign = align;
    for (let n = 0; n < words.length; n++) {
        const test = line + words[n] + ' ';
        if (ctx.measureText(test).width > maxW && n > 0) {
            ctx.fillText(line.trim(), x, y);
            line = words[n] + ' ';
            y += lineH;
        } else {
            line = test;
        }
    }
    ctx.fillText(line.trim(), x, y);
}

function drawImagePropCtx(context, img, x, y, w, h) {
    const iw = img.width, ih = img.height;
    let r = Math.min(w / iw, h / ih);
    let nw = iw * r, nh = ih * r, ar = 1;
    if (nw < w) ar = w / nw;
    if (Math.abs(ar - 1) < 1e-14 && nh < h) ar = h / nh;
    nw *= ar; nh *= ar;
    context.drawImage(img, (iw - iw / (nw / w)) / 2, (ih - ih / (nh / h)) / 2, iw / (nw / w), ih / (nh / h), x, y, w, h);
}
// Alias rétrocompatible
function drawImageProp(ctx, img, x, y, w, h) { drawImagePropCtx(ctx, img, x, y, w, h); }