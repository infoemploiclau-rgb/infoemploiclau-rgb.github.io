"use strict";
/* Configuration du propriétaire : ID de l'app Meta « Sales Agent »
   + carte « Connecter Facebook » sur l'écran d'accueil. */
(() => {
const APP_ID = "2324680658298046"; // app « Sales Agent Page » (cas : Tout gérer sur votre Page)
const OLD_IDS = ["2636607196817612"];
const CONFIG_ID = "29751199921151585"; // configuration « Publication Page » (Facebook Login for Business)
fbLogin = function () {
if (!window.FB) { toast("Connexion Facebook pas encore prête, réessayez dans quelques secondes."); return; }
FB.login((resp) => {
if (!resp.authResponse) { toast("Connexion annulée."); return; }
fbLoadPages().catch((e) => { S.fb.err = fbMsg(e); render(); });
}, { config_id: CONFIG_ID });
};
// Méthode 2 : connexion classique par autorisations (si la configuration échoue chez Facebook)
app.addEventListener("click", (e) => {
if (!e.target.closest('[data-a="fblogin2"]')) return;
if (!window.FB) { toast("Connexion Facebook pas encore prête, réessayez dans quelques secondes."); return; }
FB.login((resp) => {
if (!resp.authResponse) { toast("Connexion annulée."); return; }
fbLoadPages().catch((err) => { S.fb.err = fbMsg(err); render(); });
}, { scope: "pages_show_list,pages_read_engagement,pages_manage_posts", return_scopes: true });
});
const baseInit = initFb;
initFb = async function () {
const d = S.docs.get("settings") || {};
if (!d.fb_app_id || OLD_IDS.includes(d.fb_app_id)) { try { await put("settings", { ...settings(), kind: "settings", fb_app_id: APP_ID }); } catch { /* réessai au prochain lancement */ } }
return baseInit();
};
const baseHome = vHome;
vHome = function () {
const h = baseHome();
const pg = fbPage();
const card = pg
? `<div class="note n-ok">✅ Facebook connecté : Page <b>${esc(pg.name)}</b> (publication automatique).</div>`
: `<div class="card"><h2>📘 Connecter Facebook</h2>${S.fb.err ? `<div class="note n-warn small">${esc(S.fb.err)}</div>` : ""}<button class="btn fb block" data-a="fblogin" ${S.fb.sdk ? "" : "disabled"}>${S.fb.sdk ? "Se connecter avec Facebook" : '<span class="spin"></span> Chargement de Facebook…'}</button><button class="btn sm block" data-a="fblogin2" ${S.fb.sdk ? "" : "disabled"}>Ça ne marche pas ? Essayer la méthode 2</button><div class="tiny muted">Connexion officielle de Meta : votre mot de passe n'est jamais vu par l'application.</div></div>`;
const i = h.indexOf("</h1>");
return i < 0 ? card + h : h.slice(0, i + 5) + card + h.slice(i + 5);
};
})();
