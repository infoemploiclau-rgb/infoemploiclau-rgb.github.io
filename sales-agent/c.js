"use strict";
/* Configuration du propriétaire : app Meta « Sales Agent Page »
   + carte « Connecter Facebook » sur l'écran d'accueil.
   Ce fichier peut s'exécuter après le démarrage de b.js : tout est fait pour marcher dans les deux cas. */
(() => {
const APP_ID = "2324680658298046"; // app « Sales Agent Page » (cas : Tout gérer sur votre Page)
const OLD_IDS = ["2636607196817612"];
const CONFIG_ID = "29751199921151585"; // configuration « Publication Page » (Facebook Login for Business)
const SCOPES = "pages_show_list,pages_read_engagement,pages_manage_posts";
const BACK = "https://infoemploiclau-rgb.github.io/sales-agent/";
const goodId = () => { const d = S.docs.get("settings") || {}; return d.fb_app_id && !OLD_IDS.includes(d.fb_app_id); };
const saveId = () => put("settings", { ...settings(), kind: "settings", fb_app_id: APP_ID });

// Méthode 1 : fenêtre Facebook avec la configuration « Publication Page »
fbLogin = function () {
if (!window.FB) { toast("Connexion Facebook pas encore prête, réessayez dans quelques secondes."); return; }
S.fb.tok = null;
FB.login((resp) => {
if (!resp.authResponse) { toast("Connexion annulée."); return; }
fbLoadPages().catch((e) => { S.fb.err = fbMsg(e); render(); });
}, { config_id: CONFIG_ID });
};

// Méthode 2 : connexion OAuth par redirection (pas de fenêtre pop-up, plus fiable sur iPhone)
app.addEventListener("click", (e) => {
if (!e.target.closest('[data-a="fblogin2"]')) return;
const st = Math.random().toString(36).slice(2) + Date.now().toString(36);
try { sessionStorage.setItem("fb_state", st); } catch { /* facultatif */ }
location.href = "https://www.facebook.com/" + FBV + "/dialog/oauth?client_id=" + APP_ID + "&redirect_uri=" + encodeURIComponent(BACK)
+ "&response_type=token&scope=" + SCOPES + "&state=" + st;
});

// Retour de Facebook : le jeton arrive dans l'adresse (#access_token=…). Il reste en mémoire seulement.
(() => {
const h = location.hash.slice(1); if (!/(^|&)(access_token|error)=/.test(h)) return;
const q = new URLSearchParams(h); let saved = null;
try { saved = sessionStorage.getItem("fb_state"); sessionStorage.removeItem("fb_state"); } catch { /* facultatif */ }
history.replaceState(null, "", location.pathname + "#accueil");
if (q.get("error")) { S.fb.err = "Facebook a refusé la connexion : " + (q.get("error_description") || q.get("error")).replace(/\+/g, " "); return; }
if (!saved || q.get("state") !== saved) { S.fb.err = "Connexion refusée par sécurité (réponse inattendue). Réessayez."; return; }
S.fb.tok = q.get("access_token");
})();
const baseApi = fbApi;
fbApi = (path, params) => baseApi(path, S.fb.tok ? { ...(params || {}), access_token: S.fb.tok } : params);
let polling = false;
function useToken() {
if (!S.fb.tok || polling) return; polling = true;
const t0 = Date.now();
const w = setInterval(() => {
if (Date.now() - t0 > 30000) { clearInterval(w); S.fb.err = "Facebook ne répond pas : vérifiez la connexion internet puis réessayez."; render(); return; }
if (!S.loaded || !window.FB) return;
clearInterval(w);
fbLoadPages().catch((e) => { S.fb.tok = null; S.fb.err = fbMsg(e); render(); });
}, 300);
}

const baseInit = initFb;
initFb = async function () {
if (!goodId()) { try { await saveId(); } catch { /* réessai au prochain lancement */ } }
baseInit(); useToken();
};

const baseHome = vHome;
vHome = function () {
const h = baseHome();
const pg = fbPage();
const card = pg
? `<div class="note n-ok">✅ Facebook connecté : Page <b>${esc(pg.name)}</b> (publication automatique).</div>`
: `<div class="card"><h2>📘 Connecter Facebook</h2>${S.fb.err ? `<div class="note n-warn small">${esc(S.fb.err)}</div>` : ""}<button class="btn fb block" data-a="fblogin" ${S.fb.sdk ? "" : "disabled"}>${S.fb.sdk ? "Se connecter avec Facebook" : '<span class="spin"></span> Chargement de Facebook…'}</button><button class="btn sm block" data-a="fblogin2">Ça ne marche pas ? Essayer la méthode 2 (sans pop-up)</button><div class="tiny muted">Connexion officielle de Meta : votre mot de passe n'est jamais vu par l'application.</div></div>`;
const i = h.indexOf("</h1>");
return i < 0 ? card + h : h.slice(0, i + 5) + card + h.slice(i + 5);
};

// Marketplace : sur iPhone, l'appli Facebook comprend mal le lien « /create/item » (elle cherche « item »).
const baseTask = vTask;
vTask = function (id) {
let h = baseTask(id);
const help = `<div class="note n-brand small" style="margin-top:6px">Si Facebook ouvre une recherche au lieu du formulaire : touchez ← pour quitter la recherche, puis ouvrez <b>Marketplace → Vendre → Articles</b>.</div>`;
h = h.replace('href="https://www.facebook.com/marketplace/create/item"', 'href="https://www.facebook.com/marketplace/create/"');
h = h.replace(/(data-a="open"[^>]*>Ouvrir Marketplace ↗<\/a>)/, "$1" + help);
return h;
};

// Si b.js a déjà fini de démarrer avant ce fichier, on rattrape ici.
const sdkTag = () => !!document.querySelector('script[src*="connect.facebook.net"]');
const catchUp = async () => {
if (!S.loaded) return false;
if (!goodId()) {
try { await saveId(); } catch { return true; }
if (sdkTag() || window.FB) { location.reload(); return true; } // le SDK avait démarré avec un ancien ID
}
if (!sdkTag() && !window.FB) baseInit();
useToken(); render(); return true;
};
catchUp(); // sinon (démarrage pas encore fini), b.js appellera la version ci-dessus de initFb
})();
