"use strict";
/* Configuration du propriétaire : ID de l'app Meta « Sales Agent »
   + carte « Connecter Facebook » sur l'écran d'accueil. */
(() => {
const APP_ID = "2636607196817612";
const baseInit = initFb;
initFb = async function () {
const d = S.docs.get("settings") || {};
if (!d.fb_app_id) { try { await put("settings", { ...settings(), kind: "settings", fb_app_id: APP_ID }); } catch { /* réessai au prochain lancement */ } }
return baseInit();
};
const baseHome = vHome;
vHome = function () {
const h = baseHome();
const pg = fbPage();
const card = pg
? `<div class="note n-ok">✅ Facebook connecté : Page <b>${esc(pg.name)}</b> (publication automatique).</div>`
: `<div class="card"><h2>📘 Connecter Facebook</h2>${S.fb.err ? `<div class="note n-warn small">${esc(S.fb.err)}</div>` : ""}<button class="btn fb block" data-a="fblogin" ${S.fb.sdk ? "" : "disabled"}>${S.fb.sdk ? "Se connecter avec Facebook" : '<span class="spin"></span> Chargement de Facebook…'}</button><div class="tiny muted">Connexion officielle de Meta : votre mot de passe n'est jamais vu par l'application.</div></div>`;
const i = h.indexOf("</h1>");
return i < 0 ? card + h : h.slice(0, i + 5) + card + h.slice(i + 5);
};
})();
