"use strict";
/* ============================================================
Sales Agent Facebook — application vendeur (une seule page)
Données : base privée du compte (data/users/<id>), photos : assets,
rédaction : Claude (sample). Aucune action n'est faite sur Facebook
à votre place : la page prépare, ouvre Facebook, copie, et vous publiez.
============================================================ */
const S = {
coll: null, assets: null, sample: null, downloads: null, canImages: false,
docs: new Map(), loaded: false, slow: false, err: null,
draft: {}, step: {}, busy: null, toast: null, modal: null, lastPlan: null,
};
const app = document.getElementById("app");
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const rid = (p) => p + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const now = () => new Date();
const money = (v) => (v == null || v === "" ? "—" : Number(v).toLocaleString("fr-FR") + " FCFA");
const when = (iso) => iso ? new Date(iso).toLocaleString("fr-FR", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "—";
const URLS = new Map();
async function getBlob(id) { return await idb("blobs", "readonly", (st) => st.get(id)); }
async function blobUrl(id) { if (!URLS.has(id)) { const b = await getBlob(id); if (b) URLS.set(id, URL.createObjectURL(b)); } return URLS.get(id) || ""; }
async function hydrate() { for (const im of app.querySelectorAll("img[data-blob]")) { const u = await blobUrl(im.dataset.blob); if (u) im.src = u; } }
const all = (kind) => [...S.docs.entries()].filter(([, d]) => d.kind === kind).map(([id, d]) => ({ id, ...d }));
const get = (id) => (S.docs.has(id) ? { id, ...S.docs.get(id) } : null);
const settings = () => ({ business_name: "", phone: "", whatsapp: "", default_location: "", page_url: "",
slots: ["07:00", "12:00", "17:00", "20:00"], max_group_per_day: 6, min_spacing: 20, fb_app_id: "", fb_page_id: "", fb_page_name: "", gemini_key: "", gemini_model: "gemini-flash-latest", ...(S.docs.get("settings") || {}) });
function toast(t) { S.toast = t; renderOverlay(); clearTimeout(toast.h); toast.h = setTimeout(() => { S.toast = null; renderOverlay(); }, 3200); }
function ask(text, okLabel, onOk, danger) { S.modal = { text, okLabel, onOk, danger }; renderOverlay(); }
async function put(id, data) {
const clean = JSON.parse(JSON.stringify(data));
delete clean.id;
S.docs.set(id, clean);
try { await idb("docs", "readwrite", (st) => st.put(clean, id)); }
catch (e) { toast("Enregistrement impossible : mémoire du téléphone pleine ?"); throw e; }
}
async function del(id) { S.docs.delete(id); try { await idb("docs", "readwrite", (st) => st.delete(id)); } catch { toast("Suppression impossible, réessayez."); } }
const IDB = { db: null };
function idbOpen() {
return new Promise((res, rej) => {
const r = indexedDB.open("sales-agent", 1);
r.onupgradeneeded = () => { r.result.createObjectStore("docs"); r.result.createObjectStore("blobs"); };
r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
});
}
function idb(store, mode, fn) {
return new Promise((res, rej) => {
const tx = IDB.db.transaction(store, mode); const req = fn(tx.objectStore(store));
tx.oncomplete = () => res(req ? req.result : undefined); tx.onerror = () => rej(tx.error); tx.onabort = () => rej(tx.error);
});
}
function idbEntries(store) {
return new Promise((res, rej) => {
const out = []; const req = IDB.db.transaction(store).objectStore(store).openCursor();
req.onsuccess = () => { const c = req.result; if (c) { out.push([c.key, c.value]); c.continue(); } else res(out); };
req.onerror = () => rej(req.error);
});
}
async function putBlob(blob) { const id = rid("b"); await idb("blobs", "readwrite", (st) => st.put(blob, id)); return { id }; }
async function b64(blob) { const buf = new Uint8Array(await blob.arrayBuffer()); let s = ""; for (let i = 0; i < buf.length; i += 0x8000) s += String.fromCharCode(...buf.subarray(i, i + 0x8000)); return btoa(s); }
function makeGemini(key, model) {
return { json: async (prompt, opts = {}) => {
const parts = [{ text: prompt }];
for (const b of opts.images || []) parts.push({ inline_data: { mime_type: b.type || "image/jpeg", data: await b64(b) } });
let r;
try {
r = await fetch("https://generativelanguage.googleapis.com/v1beta/models/" + encodeURIComponent(model || "gemini-flash-latest") + ":generateContent", {
method: "POST", headers: { "Content-Type": "application/json", "x-goog-api-key": key },
body: JSON.stringify({ contents: [{ role: "user", parts }], generationConfig: { temperature: 1, responseMimeType: "application/json" } }) });
} catch { throw { code: "upstream_error" }; }
if (!r.ok) throw { code: r.status === 429 ? "rate_limited" : (r.status === 400 || r.status === 401 || r.status === 403) ? "bad_key" : "upstream_error" };
const j = await r.json(); const txt = (j.candidates?.[0]?.content?.parts || []).map((p) => p.text || "").join("");
const m = txt.match(/[\[{][\s\S]*[\]}]/); if (!m) throw { code: "invalid_json" };
return JSON.parse(m[0]);
} };
}
function setupAI() { const st = settings(); S.sample = st.gemini_key ? makeGemini(st.gemini_key, st.gemini_model) : null; S.canImages = !!S.sample; }
const FBV = "v23.0";
S.fb = { sdk: false, pages: [], user: false, err: null };
function loadFbSdk(appId) {
return new Promise((res, rej) => {
if (window.FB) { res(); return; }
window.fbAsyncInit = () => { FB.init({ appId, cookie: false, xfbml: false, version: FBV }); S.fb.sdk = true; res(); };
const sc = document.createElement("script"); sc.src = "https://connect.facebook.net/fr_FR/sdk.js"; sc.async = true; sc.crossOrigin = "anonymous";
sc.onerror = () => rej(new Error("sdk")); document.head.appendChild(sc);
});
}
function fbApi(path, params) { return new Promise((res, rej) => FB.api(path, params || {}, (r) => (!r || r.error ? rej(r?.error || {}) : res(r)))); }
async function fbLoadPages() {
const r = await fbApi("/me/accounts", { fields: "id,name,access_token,tasks", limit: 100 });
S.fb.pages = (r.data || []).filter((p) => !p.tasks || p.tasks.includes("CREATE_CONTENT"));
S.fb.user = true; S.fb.err = S.fb.pages.length ? null : "Aucune Page trouvée : créez une Page ou acceptez l'accès à votre Page.";
const st = settings();
if (S.fb.pages.length && !S.fb.pages.some((p) => p.id === st.fb_page_id)) await put("settings", { ...st, kind: "settings", fb_page_id: S.fb.pages[0].id, fb_page_name: S.fb.pages[0].name });
render();
}
function fbLogin() {
if (!window.FB) { toast("Connexion Facebook pas encore prête : vérifiez l'ID de l'app dans les réglages."); return; }
FB.login((resp) => {
if (!resp.authResponse) { toast("Connexion annulée."); return; }
fbLoadPages().catch((e) => { S.fb.err = fbMsg(e); render(); });
}, { scope: "pages_show_list,pages_read_engagement,pages_manage_posts", return_scopes: true });
}
function fbMsg(e) {
const c = e && e.code;
return ({ 190: "Connexion Facebook expirée : touchez « Se connecter avec Facebook ».", 200: "Permission refusée : reconnectez et acceptez la publication sur la Page.",
10: "Permission manquante : reconnectez et acceptez tout.", 368: "Facebook bloque temporairement les publications de cette Page.",
4: "Limite Facebook atteinte, réessayez plus tard.", 32: "Limite Facebook atteinte, réessayez plus tard." })[c] || "Erreur Facebook : " + ((e && e.message) || "inconnue");
}
function fbPage() { const st = settings(); return S.fb.pages.find((p) => p.id === st.fb_page_id) || null; }
async function fbPublish(text, photoId, whenDate) {
const page = fbPage(); if (!page) throw { message: "Page non connectée" };
const fd = new FormData(); fd.append("access_token", page.access_token);
if (whenDate) { fd.append("published", "false"); fd.append("scheduled_publish_time", String(Math.floor(whenDate.getTime() / 1000))); }
let url;
const blob = photoId ? await getBlob(photoId) : null;
if (blob) { fd.append("source", blob, "photo.jpg"); fd.append("caption", text); url = "https://graph.facebook.com/" + FBV + "/" + page.id + "/photos"; }
else { fd.append("message", text); url = "https://graph.facebook.com/" + FBV + "/" + page.id + "/feed"; }
let j; try { j = await (await fetch(url, { method: "POST", body: fd })).json(); } catch { throw { message: "Facebook injoignable (connexion internet ?)" }; }
if (j.error) { if (j.error.code === 190) S.fb.pages = []; throw { message: fbMsg(j.error) }; }
return j.post_id || j.id;
}
async function copy(text, label) {
try { await navigator.clipboard.writeText(text); toast((label || "Texte") + " copié"); return true; }
catch { toast("Copie refusée par le navigateur : appuyez longuement sur le texte pour le copier."); return false; }
}
const FB_HOSTS = ["facebook.com", "www.facebook.com", "m.facebook.com", "web.facebook.com", "mbasic.facebook.com"];
function normGroupUrl(raw) {
let s = String(raw || "").trim();
if (!/^https?:\/\//i.test(s)) s = "https://" + s;
let u; try { u = new URL(s); } catch { return null; }
if (!FB_HOSTS.includes(u.hostname.toLowerCase())) return null;
const m = u.pathname.match(/^\/groups\/([A-Za-z0-9._-]{2,100})/);
return m ? "https://www.facebook.com/groups/" + m[1] : null;
}
function isFbUrl(raw) { try { const u = new URL(raw); return u.protocol === "https:" && FB_HOSTS.includes(u.hostname.toLowerCase()); } catch { return false; } }
const norm = (t) => " " + String(t || "").toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, " ").trim() + " ";
const has = (text, words) => words.some((w) => text.includes(" " + w + " "));
const SYN = {
informatique: ["informatique", "ordinateur", "ordinateurs", "pc", "laptop", "portable", "computer", "dell", "hp", "lenovo", "macbook"],
telephones: ["telephone", "telephones", "phone", "smartphone", "iphone", "samsung", "android", "tecno", "infinix", "gsm"],
electromenager: ["electromenager", "frigo", "refrigerateur", "climatiseur", "congelateur", "televiseur", "tv"],
vetements: ["vetement", "vetements", "mode", "habits", "friperie", "pret a porter", "fashion"],
chaussures: ["chaussure", "chaussures", "baskets", "sneakers", "souliers"],
immobilier: ["immobilier", "maison", "terrain", "parcelle", "location", "villa", "appartement"],
vehicules: ["vehicule", "vehicules", "voiture", "auto", "moto", "motos", "engin"],
mobilier: ["meuble", "meubles", "mobilier", "decoration"],
beaute: ["beaute", "cosmetique", "cosmetiques", "parfum", "maquillage"],
};
const GENERIC = ["vente", "achat", "bons plans", "bon plan", "deals", "marche", "a vendre", "occasion", "commerce", "business", "boutique"];
const COUNTRY = ["burkina", "faso", "bf", "burkinabe"];
const MP_CAT = { informatique: "Électronique et ordinateurs", telephones: "Téléphones portables", electromenager: "Appareils électroménagers",
vetements: "Vêtements et accessoires", chaussures: "Vêtements et accessoires", immobilier: "Immobilier", vehicules: "Véhicules", mobilier: "Mobilier", beaute: "Santé et beauté" };
function catKey(c) { const t = norm(c); for (const [k, w] of Object.entries(SYN)) if (t.includes(" " + k + " ") || has(t, w)) return k; return null; }
function scoreGroup(g) {
const prods = all("product").filter((p) => p.status !== "archived");
const text = norm([g.name, g.description, g.location].join(" "));
const parts = [];
const keys = [...new Set(prods.map((p) => catKey(p.category)).filter(Boolean))];
const matched = keys.filter((k) => has(text, SYN[k]) || text.includes(" " + k + " "));
let fit = 5;
if (matched.length) { fit = 40; parts.push("vos produits +40"); }
else if (has(text, GENERIC)) { fit = 25; parts.push("achat-vente général +25"); }
else parts.push("thème éloigné +5");
const locs = norm([settings().default_location, ...prods.map((p) => p.location)].join(" ")).split(" ").filter((w) => w.length > 3 && !COUNTRY.includes(w));
let loc = 5;
if (locs.length && has(text, locs)) { loc = 25; parts.push("même ville +25"); }
else if (has(text, COUNTRY)) { loc = 18; parts.push("même pays +18"); }
else parts.push("lieu inconnu +5");
let size = 8;
if (g.member_count) { size = Math.max(0, Math.min(20, Math.round(4 * Math.log10(Math.max(1, g.member_count))))); parts.push(Number(g.member_count).toLocaleString("fr-FR") + " membres +" + size); }
else parts.push("taille inconnue +8");
let act = 0;
if (g.buy_sell) { act += 7; parts.push("achat-vente +7"); }
if (g.activity_note) { const b = has(norm(g.activity_note), ["actif", "active", "quotidien", "beaucoup", "tres", "dynamique"]) ? 8 : 4; act += b; parts.push("activité +" + b); }
return { score: Math.min(100, fit + loc + size + act), expl: parts.join(" · ") };
}
function searchLinks() {
const st = settings();
const prods = all("product");
const city = (st.default_location || prods.find((p) => p.location)?.location || "").split(",")[0].trim();
const places = [city, "Burkina Faso"].filter(Boolean);
const qs = [];
for (const c of [...new Set(prods.map((p) => p.category))].sort()) for (const pl of places) qs.push("vente " + c + " " + pl);
for (const pl of places) qs.push("achat vente " + pl, "bons plans " + pl);
return [...new Set(qs)].slice(0, 12).map((q) => ({ q,
fb: "https://www.facebook.com/search/groups/?q=" + encodeURIComponent(q),
web: "https://www.google.com/search?q=" + encodeURIComponent("site:facebook.com/groups " + q) }));
}
const RX_MONEY = /\d[\d\s.,]*\s*(?:f\b|fcfa|cfa|francs?|xof|€|\$|k\b|mille)/gi;
const RX_PHONE = /\+?\d[\d\s.-]{7,}\d/g;
const RX_URL = /https?:\/\/\S+|www\.\S+/gi;
function strip(t) { const c = String(t || "").replace(RX_MONEY, "").replace(RX_PHONE, "").replace(RX_URL, "").replace(/[ \t]{2,}/g, " ").trim().replace(/^[,;:\-\s]+|[,;:\-\s]+$/g, ""); return { c, changed: c !== String(t || "").trim().replace(/^[,;:\-\s]+|[,;:\-\s]+$/g, "") }; }
const ANGLES = { prix: "le rapport qualité-prix", qualite: "la qualité et la fiabilité", livraison: "la simplicité : livraison ou retrait rapide",
urgence: "une urgence honnête (stock limité, sans mentir)", usage: "à quoi il sert au quotidien et pour qui", confiance: "la confiance : produit vérifiable avant achat",
question: "une question d'accroche sur le besoin de l'acheteur", benefice: "le bénéfice principal en une phrase forte" };
const ANGLE_KEYS = Object.keys(ANGLES);
const FOOT = [["💰 Prix", "📦 État", "📍", "🚚 Livraison", "📞"], ["👉 Prix", "✔ État", "📌 Lieu :", "🛵 Livraison", "☎ Contact :"], ["Prix", "État", "Lieu :", "Livraison", "Contact :"]];
const condFr = (c) => (c === "new" ? "Neuf" : "Occasion");
function tag(w) { const t = String(w).normalize("NFKD").replace(/[̀-ͯ]/g, ""); return "#" + t.split(/[^A-Za-z0-9]+/).filter(Boolean).map((x) => x[0].toUpperCase() + x.slice(1)).join(""); }
function tags(list, p) {
const out = [];
for (const x of [...(list || []), p.category, (p.location || settings().default_location || "").split(",")[0]]) {
if (!x) continue; const h = tag(String(x).replace(/^#/, ""));
if (h.length > 2 && h.length <= 30 && !out.some((o) => o.toLowerCase() === h.toLowerCase())) out.push(h);
}
return out.slice(0, 6);
}
function facts(p, style) {
const st = settings(); const [lp, le, ll, ld, lc] = FOOT[style % 3];
const neg = p.min_price && Number(p.min_price) < Number(p.sale_price);
const lines = [lp + " : " + money(p.sale_price) + (neg ? " (légèrement négociable)" : ""), le + " : " + condFr(p.condition)];
const loc = p.location || st.default_location; if (loc) lines.push(ll + " " + loc);
if (p.delivery_terms) { const t = p.delivery_terms.replace(/^\s*livraison\s*[:\-]?\s*/i, "") || p.delivery_terms; lines.push(ld + " : " + t[0].toUpperCase() + t.slice(1)); }
const contact = p.contact_info || [st.phone, st.whatsapp && "WhatsApp " + st.whatsapp].filter(Boolean).join(" · ");
if (contact) lines.push(lc + " " + contact);
return lines.join("\n");
}
function assemble(p, d, angle, provider) {
const style = Math.floor(Math.random() * 3); const warn = [];
const title = strip(d.titre); const hook = strip(d.accroche); const cta = strip(d.appel_action);
if (title.changed || hook.changed || cta.changed) warn.push("Montant, numéro ou lien inventé retiré automatiquement");
const pts = (d.arguments || []).slice(0, 6).map((x) => strip(x)).filter((x) => x.c.length > 3);
if (pts.some((x) => x.changed)) warn.push("Montant ou numéro retiré d'un argument");
const bullet = ["✅", "▪", "•"][style];
const parts = [];
if (hook.c) parts.push(hook.c);
if (pts.length) parts.push(pts.map((x) => bullet + " " + x.c).join("\n"));
const factBlock = facts(p, style);
parts.push(factBlock);
if (cta.c) parts.push(cta.c);
const tg = tags(d.hashtags, p); if (tg.length) parts.push(tg.join(" "));
const descForMp = [hook.c, pts.length ? pts.map((x) => "• " + x.c).join("\n") : "", factBlock.split("\n").filter((l) => !/Prix|État/.test(l)).join("\n"), cta.c].filter(Boolean).join("\n\n");
return { title: (title.c || p.name).slice(0, 99), body: parts.join("\n\n"), mp_desc: descForMp, angle, provider, warn };
}
const HOOKS = { prix: ["Bonne affaire à saisir : {n}.", "{n} à un prix vraiment raisonnable.", "Vous cherchez {n} sans vous ruiner ? C'est ici."],
qualite: ["{n} en {e} état, prêt à l'emploi.", "Qualité garantie : {n}.", "Un {n} fiable, comme vous le cherchez."],
livraison: ["{n} disponible, livraison possible.", "Commandez {n}, on s'occupe du reste.", "{n} : vous commandez, on vous l'amène."],
urgence: ["{s} : {n}.", "Ne tardez pas, {n} part vite.", "Dernière occasion pour {n}."],
usage: ["{n}, idéal au quotidien.", "Pour le travail, les études ou la maison : {n}.", "Le {n} qui vous simplifie la vie."],
confiance: ["Vendeur sérieux : {n} vérifiable avant achat.", "Achetez en confiance : {n}.", "{n}, venez voir avant de payer."],
question: ["Besoin d'un {n} ?", "Toujours à la recherche de {n} ?", "Et si vous passiez enfin au {n} ?"],
benefice: ["Gagnez du temps avec {n}.", "{n} : le bon choix sans hésiter.", "Faites-vous plaisir avec {n}."] };
const CTAS = ["Écrivez-moi en privé pour réserver.", "Contactez-moi vite, premier arrivé premier servi.", "Envoyez « intéressé » en message privé.", "Écrivez sur WhatsApp pour plus de photos.", "Réservez dès maintenant par message."];
const TITLES = ["{n}", "{n} — {c}", "{c} : {n}", "{n} disponible", "À vendre : {n}"];
const pick = (a) => a[Math.floor(Math.random() * a.length)];
function templateDraft(p, angle) {
const f = (s) => s.replace("{n}", p.name).replace("{e}", p.condition === "used" ? "très bon" : "parfait").replace("{s}", Number(p.quantity) === 1 ? "Dernière pièce" : "Stock limité").replace("{c}", condFr(p.condition));
const sent = String(p.description || "").split(/[\n.;•]+/).map((s) => s.trim()).filter((s) => s.length > 3).sort(() => Math.random() - 0.5);
return assemble(p, { titre: f(pick(TITLES)), accroche: f(pick(HOOKS[angle])), arguments: sent.slice(0, 5), appel_action: pick(CTAS), hashtags: [] }, angle, "template");
}
async function writeAds(p, targets) {
// targets : [{label, kind:'marketplace'|'page'|'group', rules?, angle}]
if (S.sample) {
const factsForAi = { nom: p.name, categorie: p.category, etat: condFr(p.condition), description_du_vendeur: p.description || "",
stock: Number(p.quantity) === 1 ? "une seule unité" : "plusieurs unités", livraison_disponible: !!p.delivery_terms };
const prev = all("task").filter((t) => t.product_id === p.id).slice(-4).map((t) => t.text.slice(0, 300));
const prompt = [
"Tu es rédacteur d'annonces de vente sur Facebook pour un commerçant au Burkina Faso. Français simple et naturel, comme un vendeur local sérieux.",
"RÈGLES ABSOLUES : 1) n'invente AUCUNE caractéristique absente des informations ; 2) n'écris AUCUN prix, montant, numéro de téléphone, lien ni adresse (ajoutés automatiquement) ; 3) 2 à 4 emojis maximum, pas de MAJUSCULES excessives ; 4) chaque annonce doit être nettement différente des autres (accroche, structure, mots) ; 5) respecte l'angle et les règles du groupe.",
"Produit : " + JSON.stringify(factsForAi),
prev.length ? "Annonces déjà utilisées (ne pas imiter) :\n" + prev.join("\n---\n") : "",
"Rédige " + targets.length + " annonces, une par cible, dans cet ordre :",
targets.map((t, i) => (i + 1) + ". " + (t.kind === "marketplace" ? "Facebook Marketplace (titre court et précis, max 70 caractères)" : t.kind === "page" ? "Page Facebook de la boutique" : "groupe « " + t.label + " »" + (t.rules ? " — règles : " + t.rules.slice(0, 400) : "")) + " — angle : " + ANGLES[t.angle]).join("\n"),
'Réponds UNIQUEMENT avec un tableau JSON de ' + targets.length + ' objets {"titre": string, "accroche": string, "arguments": [3 à 5 phrases courtes], "appel_action": string, "hashtags": [3 à 5 mots]}.',
].filter(Boolean).join("\n\n");
try {
const arr = await S.sample.json(prompt, { cache: false });
if (Array.isArray(arr) && arr.length >= targets.length) return targets.map((t, i) => assemble(p, arr[i] || {}, t.angle, "ia"));
} catch (e) {
if (e && e.code === "not_granted") S.sample = null;
}
}
return targets.map((t) => templateDraft(p, t.angle));
}
async function compress(file, max = 1600) {
const img = await createImageBitmap(file).catch(() => null);
if (!img) throw new Error("Image illisible");
const k = Math.min(1, max / Math.max(img.width, img.height));
const c = document.createElement("canvas"); c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
return await new Promise((r) => c.toBlob(r, "image/jpeg", 0.86)); // ré-encodage : supprime les métadonnées (GPS)
}
async function uploadPhotos(files) {
const out = [];
for (const f of files) {
try { const b = await compress(f); const r = await putBlob(b); out.push({ id: r.id, gen: false }); }
catch { toast("« " + f.name + " » n'a pas pu être envoyée."); }
}
return out;
}
async function loadImg(src) { return await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = src; }); }
async function makeVisual(p, photoId, theme) {
const T = { bleu: ["#1f57c9", "#ffc400"], vert: ["#16803d", "#ffd600"], sombre: ["#18181b", "#facc15"], orange: ["#ea580c", "#ffffff"] }[theme] || ["#1f57c9", "#ffc400"];
const W = 1080, c = document.createElement("canvas"); c.width = c.height = W; const x = c.getContext("2d");
x.fillStyle = T[0]; x.fillRect(0, 0, W, W);
const img = await loadImg(await blobUrl(photoId));
const bw = W - 80, bh = W - 340, top = 140;
x.fillStyle = "#fff"; x.fillRect(40, top, bw, bh);
const k = Math.min(bw / img.width, bh / img.height); const iw = img.width * k, ih = img.height * k;
x.drawImage(img, 40 + (bw - iw) / 2, top + (bh - ih) / 2, iw, ih); // photo entière, non recadrée, non retouchée
const font = (s, b) => (b ? "800 " : "500 ") + s + "px 'Bricolage Grotesque', 'Segoe UI', sans-serif";
let s = 64; x.font = font(s, 1); while (x.measureText(p.name).width > W - 80 && s > 30) { s -= 2; x.font = font(s, 1); }
x.fillStyle = "#fff"; x.textBaseline = "middle"; x.fillText(p.name, 40, 75);
const price = money(p.sale_price); let ps = 74; x.font = font(ps, 1); while (x.measureText(price).width > W - 520 && ps > 40) { ps -= 2; x.font = font(ps, 1); }
const pw = x.measureText(price).width; const y = top + bh + 22;
x.fillStyle = T[1]; x.beginPath(); x.roundRect(40, y, pw + 60, 100, 22); x.fill();
x.fillStyle = T[1] === "#ffffff" ? "#1a1a1a" : T[0]; x.fillText(price, 70, y + 52);
x.fillStyle = "#fff"; x.font = font(28, 0); x.fillText("Photo réelle du produit" + (settings().business_name ? " · " + settings().business_name : ""), 40, W - 34);
const blob = await new Promise((r) => c.toBlob(r, "image/jpeg", 0.9));
const r = await putBlob(blob); return { id: r.id, gen: true };
}
async function saveFile(name, blobOrText) {
try {
const blob = blobOrText instanceof Blob ? blobOrText : new Blob([blobOrText]);
const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); a.remove();
setTimeout(() => URL.revokeObjectURL(a.href), 10000); return true;
} catch { return false; }
}
const BASE = { page: 8, pageauto: 8, marketplace: 12, group: 7, ticked: 3 }, REM = { page: 1, pageauto: 0, marketplace: 1.5, group: 0.5, ticked: 0.1 }, GEST = { page: 4, pageauto: 0, marketplace: 8, group: 4, ticked: 1 };
function slotTimes(from, days) {
const st = settings(); const out = [];
for (let d = 0; d < days; d++) for (const s of [...st.slots].sort()) {
const [h, m] = s.split(":").map(Number); const t = new Date(from); t.setDate(t.getDate() + d); t.setHours(h, m, 0, 0);
if (t >= from) out.push(t);
}
return out.sort((a, b) => a - b);
}
function buildPlan(p, opt) {
const st = settings(); const t0 = now();
const tasks = all("task");
const groups = all("group").map((g) => ({ ...g, ...scoreGroup(g) })).sort((a, b) => b.score - a.score);
const dec = []; let ticked = 0;
for (const g of groups) {
if (g.membership !== "joined") { dec.push({ g, mode: "skip", why: "Pas encore membre" }); continue; }
if (g.score < 50) { dec.push({ g, mode: "skip", why: "Pertinence faible (" + g.score + "/100)" }); continue; }
const same = tasks.filter((t) => t.group_id === g.id || (t.ticked || []).includes(g.id)).filter((t) => t.product_id === p.id && t.status !== "skipped");
const cd = Number(g.cooldown_days ?? 7);
if (same.some((t) => t0 - new Date(t.scheduled_at) < cd * 864e5)) { dec.push({ g, mode: "skip", why: "Produit déjà proposé il y a moins de " + cd + " j" }); continue; }
const week = tasks.filter((t) => (t.group_id === g.id || (t.ticked || []).includes(g.id)) && t.status !== "skipped" && t0 - new Date(t.created_at) < 7 * 864e5).length;
if (week >= Number(g.max_per_week ?? 2)) { dec.push({ g, mode: "skip", why: "Limite du groupe (" + (g.max_per_week ?? 2) + "/semaine)" }); continue; }
if (opt.marketplace && g.buy_sell && ticked < 20) { dec.push({ g, mode: "tick" }); ticked++; } else dec.push({ g, mode: "task" });
}
// calendrier : horaires du vendeur, écart minimal, plafond quotidien
const spacing = Number(st.min_spacing || 20) * 6e4, perDay = Number(st.max_group_per_day || 6);
const taken = tasks.filter((t) => t.status === "todo" && t.channel === "group").map((t) => new Date(t.scheduled_at));
const dayKey = (d) => d.toDateString(); const count = {};
taken.forEach((d) => (count[dayKey(d)] = (count[dayKey(d)] || 0) + 1));
const slots = slotTimes(new Date(t0.getTime() + 5 * 6e4), 14); let i = 0;
for (const d of dec.filter((x) => x.mode === "task")) {
let placed = false;
while (!placed && i < slots.length * 6) {
const c = new Date(slots[Math.floor(i / 6)].getTime() + (i % 6) * spacing); i++;
if ((count[dayKey(c)] || 0) >= perDay) continue;
if (taken.some((t) => Math.abs(t - c) < spacing)) continue;
d.when = c; taken.push(c); count[dayKey(c)] = (count[dayKey(c)] || 0) + 1; placed = true;
}
if (!placed) { d.mode = "skip"; d.why = "Calendrier plein sur 14 jours"; }
}
const auto = !!fbPage(); const pageN = auto ? Math.max(1, Math.min(4, Number(opt.pageN || 1))) : 1;
const pageTimes = slotTimes(new Date(t0.getTime() + 11 * 6e4), 3).slice(0, pageN);
const items = [...(opt.page ? Array(pageN).fill(auto ? "pageauto" : "page") : []), ...(opt.marketplace ? ["marketplace"] : []),
...dec.filter((d) => d.mode === "task").map(() => "group"), ...dec.filter((d) => d.mode === "tick").map(() => "ticked")];
const base = items.reduce((a, k) => a + BASE[k], 0), rem = items.reduce((a, k) => a + REM[k], 0);
const pageWhen = pageTimes[0] || t0;
return { dec, opt, pageWhen, pageTimes, auto, stats: { canaux: items.length, gestes: items.reduce((a, k) => a + GEST[k], 0),
base: Math.round(base * 10) / 10, rem: Math.round(rem * 10) / 10, pct: base ? Math.round(100 * (1 - rem / base)) : 0 } };
}
async function publishEverywhere(p, plan) {
const camp = rid("c"); const t0 = now().toISOString();
const targets = [];
if (plan.opt.marketplace) targets.push({ kind: "marketplace", label: "Marketplace" });
if (plan.opt.page) (plan.auto ? plan.pageTimes : [plan.pageWhen]).forEach((w) => targets.push({ kind: "page", label: "Page", when: w }));
for (const d of plan.dec.filter((x) => x.mode === "task")) targets.push({ kind: "group", label: d.g.name, rules: d.g.posting_rules, d });
const start = Math.floor(Math.random() * 8);
targets.forEach((t, i) => (t.angle = ANGLE_KEYS[(start + i) % 8]));
const texts = await writeAds(p, targets);
const photoIds = [...(p.photos || [])].sort((a, b) => a.gen - b.gen).map((x) => x.id);
const ticked = plan.dec.filter((d) => d.mode === "tick").map((d) => d.g);
let first = null;
for (let i = 0; i < targets.length; i++) {
const t = targets[i], a = texts[i]; const id = rid("t");
const base = { kind: "task", campaign: camp, product_id: p.id, product_name: p.name, channel: t.kind, status: "todo", created_at: t0,
title: a.title, text: a.title + "\n\n" + a.body, angle: a.angle, provider: a.provider, warn: a.warn, photos: photoIds };
if (t.kind === "marketplace") Object.assign(base, { scheduled_at: t0, ticked: ticked.map((g) => g.id), ticked_names: ticked.map((g) => g.name),
kit: { title: a.title, price: Number(p.sale_price), desc: a.mp_desc, category: MP_CAT[catKey(p.category)] || "Divers", condition: p.condition === "new" ? "Neuf" : "Occasion – bon état", location: p.location || settings().default_location || "" } });
if (t.kind === "page") {
Object.assign(base, { scheduled_at: t.when.toISOString() });
if (plan.auto) {
const visual = (p.photos || []).filter((x) => x.gen).at(-1) || (p.photos || [])[0];
try {
const fbId = await fbPublish(base.text, visual?.id, t.when);
Object.assign(base, { status: "auto", fb_id: fbId, done_at: t0, page_name: fbPage()?.name });
} catch (e) { base.warn = [...(base.warn || []), "Facebook : " + (e.message || "échec") + " — publication à faire à la main"]; }
}
}
if (t.kind === "group") Object.assign(base, { scheduled_at: t.d.when.toISOString(), group_id: t.d.g.id, group_name: t.d.g.name, group_url: t.d.g.url, rules: t.d.g.posting_rules || "", is_admin: !!t.d.g.is_admin });
await put(id, base);
if (!first) first = id;
}
const autoN = all("task").filter((x) => x.campaign === camp && x.status === "auto").length;
const firstTodo = all("task").filter((x) => x.campaign === camp && x.status === "todo").sort((a, b) => a.scheduled_at.localeCompare(b.scheduled_at))[0];
return { camp, first: firstTodo?.id || null, n: targets.length, autoN, ai: texts.some((x) => x.provider === "ia") };
}
function ics(tasks) {
const f = (d) => new Date(d).toISOString().replace(/[-:]/g, "").replace(/\.\d+/, "");
const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Sales Agent//FR", "CALSCALE:GREGORIAN"];
for (const t of tasks) {
const where = t.channel === "marketplace" ? "Marketplace" : t.channel === "page" ? "ma Page" : t.group_name;
lines.push("BEGIN:VEVENT", "UID:" + t.id + "@sales-agent", "DTSTAMP:" + f(now()), "DTSTART:" + f(t.scheduled_at),
"DTEND:" + f(new Date(new Date(t.scheduled_at).getTime() + 10 * 6e4)),
"SUMMARY:À publier : " + (t.product_name + " → " + where).replace(/[,;]/g, " "),
"DESCRIPTION:Ouvrez Sales Agent > À publier : texte et photos sont prêts.",
"BEGIN:VALARM", "ACTION:DISPLAY", "DESCRIPTION:À publier", "TRIGGER:PT0M", "END:VALARM", "END:VEVENT");
}
lines.push("END:VCALENDAR"); return lines.join("\r\n");
}
const ICON = {
home: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/></svg>',
box: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 8l-9-5-9 5 9 5 9-5zM3 8v8l9 5 9-5V8M12 13v8"/></svg>',
plus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><circle cx="12" cy="12" r="9"/><path d="M12 8v8M8 12h8"/></svg>',
rocket: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 15c-1.5 1.5-2 5-2 5s3.5-.5 5-2M9 15l-3-3c1-4 4-8 12-9-1 8-5 11-9 12z"/><circle cx="15" cy="9" r="1.6"/></svg>',
people: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c.8-3.5 3.4-5.5 6.5-5.5s5.7 2 6.5 5.5M16 4.8a3.5 3.5 0 0 1 0 6.4M18 14.8c2 .8 3.2 2.6 3.6 5.2"/></svg>',
};
function route() { const h = (location.hash || "#accueil").slice(1); const m = h.match(/^([a-z]+)(?:-(.+))?$/); return { v: m ? m[1] : "accueil", id: m ? m[2] : null }; }
function go(h) { if (location.hash === "#" + h) render(); else location.hash = h; }
function renderTabs() {
const r = route().v; const due = all("task").filter((t) => t.status === "todo" && new Date(t.scheduled_at) <= now()).length;
const T = [["accueil", "Accueil", ICON.home, ["accueil"]], ["produits", "Produits", ICON.box, ["produits", "produit", "publier"]],
["nouveau", "Ajouter", ICON.plus, ["nouveau"]], ["taches", "À publier", ICON.rocket, ["taches", "tache"]], ["groupes", "Groupes", ICON.people, ["groupes"]]];
document.getElementById("tabs").innerHTML = T.map(([h, l, ic, on]) =>
`<a href="#${h}" class="${on.includes(r) ? "on" : ""}">${ic}${l}${h === "taches" && due ? `<span class="badge">${due}</span>` : ""}</a>`).join("");
}
function renderOverlay() {
const o = document.getElementById("overlay"); let h = "";
if (S.toast) h += `<div class="toast" role="status">${esc(S.toast)}</div>`;
if (S.modal) h += `<div class="modal-bg"><div class="modal" role="dialog" aria-modal="true"><p style="margin:0">${esc(S.modal.text)}</p>
<div class="grid2"><button class="btn" data-a="modal-no">Annuler</button><button class="btn ${S.modal.danger ? "danger" : "primary"}" data-a="modal-ok">${esc(S.modal.okLabel)}</button></div></div></div>`;
o.innerHTML = h;
}
