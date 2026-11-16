function render() {
renderTabs(); renderOverlay();
if (S.err) { app.innerHTML = `<div class="card"><h2>Accès impossible</h2><p class="muted">${esc(S.err)}</p></div>`; return; }
if (!S.loaded) { app.innerHTML = `<div class="card"><div class="row"><span class="spin"></span> ${S.slow ? "Connexion lente : vos données ne sont pas encore joignables." : "Chargement de vos données…"}</div></div>`; return; }
const r = route();
const V = { accueil: vHome, produits: vProducts, nouveau: vEdit, produit: vEdit, publier: vPublish, taches: vTasks, tache: vTask, groupes: vGroups, reglages: vSettings };
app.innerHTML = (V[r.v] || vHome)(r.id);
hydrate();
window.scrollTo?.({ top: S.keepScroll ? window.scrollY : 0 }); S.keepScroll = false;
}
function vHome() {
const P = all("product"), T = all("task"), G = all("group");
const todo = T.filter((t) => t.status === "todo").sort((a, b) => a.scheduled_at.localeCompare(b.scheduled_at));
const due = todo.filter((t) => new Date(t.scheduled_at) <= now());
const avail = P.filter((p) => p.status === "active" && p.quantity > 0);
const stock = avail.reduce((a, p) => a + p.quantity * p.sale_price, 0);
const marge = avail.filter((p) => p.purchase_price).reduce((a, p) => a + p.quantity * (p.sale_price - p.purchase_price), 0);
const done = T.filter((t) => t.status === "done" || t.status === "auto").length;
const st = settings();
let h = `<h1>Bonjour${st.business_name ? ", " + esc(st.business_name) : ""}</h1>`;
if (!P.length) h += `<div class="card"><h2>Démarrer en 3 étapes</h2><div class="steps">
<div class="step${st.default_location ? " done" : ""}"><b>Vos infos de vente</b><div class="small muted">Nom de boutique, ville, WhatsApp, horaires.</div><a class="btn sm" href="#reglages">Compléter</a></div>
<div class="step${G.length ? " done" : ""}"><b>Vos groupes Facebook</b><div class="small muted">Ajoutez les groupes où vous vendez.</div><a class="btn sm" href="#groupes">Ajouter des groupes</a></div>
<div class="step"><b>Votre premier produit</b><div class="small muted">Photos + prix : le reste est préparé pour vous.</div><a class="btn sm primary" href="#nouveau">Ajouter un produit</a></div></div></div>`;
if (due.length) h += `<a class="card" href="#tache-${due[0].id}" style="text-decoration:none;color:inherit;border-color:var(--action)">
<div class="row between"><div><b>🚀 ${due.length} publication${due.length > 1 ? "s" : ""} à faire maintenant</b><div class="small muted">Texte et photos prêts</div></div><span class="btn sm primary">Commencer</span></div></a>`;
else if (todo.length) h += `<div class="card"><div class="small muted">Prochaine publication</div><b>${esc(todo[0].product_name)} → ${esc(todo[0].group_name || (todo[0].channel === "page" ? "ma Page" : "Marketplace"))}</b><div class="small">${when(todo[0].scheduled_at)}</div></div>`;
h += `<div class="stats">
<div class="stat"><b>${avail.length}</b><span>produits en vente</span></div>
<div class="stat"><b>${P.filter((p) => p.status === "sold").length}</b><span>vendus</span></div>
<div class="stat"><b>${G.filter((g) => g.membership === "joined").length}</b><span>groupes rejoints</span></div>
<div class="stat"><b>${todo.length}</b><span>à publier</span></div>
<div class="stat"><b>${done}</b><span>publiées</span></div>
<div class="stat"><b>${P.length}</b><span>produits</span></div></div>
<div class="grid2"><div class="stat"><span>Valeur du stock</span><b style="font-size:18px">${money(stock)}</b></div>
<div class="stat"><span>Marge estimée</span><b style="font-size:18px">${money(marge)}</b></div></div>`;
if (!S.sample) h += `<p class="note n-warn small">IA non configurée : les annonces utilisent le générateur de modèles. Ajoutez une clé Gemini gratuite dans les réglages.</p>`;
return h;
}
const STATUS = { active: ["En vente", "p-ok"], paused: ["Suspendu", "p-warn"], sold: ["Vendu", "p-mute"], archived: ["Archivé", "p-mute"] };
function vProducts() {
const q = (S.draft.q || "").toLowerCase();
const P = all("product").filter((p) => !q || (p.name + " " + p.category).toLowerCase().includes(q)).sort((a, b) => (b.created_at || "").localeCompare(a.created_at || ""));
let h = `<div class="row between"><h1>Produits</h1><a class="btn primary" href="#nouveau">＋ Ajouter</a></div>
<input class="in" id="q" data-bind="q" placeholder="Rechercher un produit" value="${esc(S.draft.q || "")}">`;
if (!P.length) return h + `<div class="card empty">Aucun produit${q ? " trouvé" : ""}. <a href="#nouveau">Ajoutez le premier</a>.</div>`;
h += `<div class="list">` + P.map((p) => {
const ph = (p.photos || []).find((x) => !x.gen) || (p.photos || [])[0];
const [sl, sc] = STATUS[p.status] || STATUS.active;
return `<div class="card"><a class="item" href="#produit-${p.id}">${ph ? `<img class="thumb" data-blob="${ph.id}" alt="">` : `<div class="thumb ph">Photo</div>`}
<div class="t"><b class="trunc">${esc(p.name)}</b><span class="small muted">${esc(p.category)} · ${condFr(p.condition)} · stock ${p.quantity}</span><span class="price">${money(p.sale_price)}</span></div>
<span class="pill ${sc}">${sl}</span></a>
<div class="row">${p.status === "active" && p.quantity > 0 ? `<a class="btn sm primary" style="background:var(--action);border-color:var(--action)" href="#publier-${p.id}">🚀 Publier partout</a>` : ""}
${p.status !== "sold" ? `<button class="btn sm" data-a="sold" data-id="${p.id}">Vendu</button>` : ""}
${p.status === "active" ? `<button class="btn sm" data-a="pause" data-id="${p.id}">Suspendre</button>` : p.status === "paused" ? `<button class="btn sm" data-a="resume" data-id="${p.id}">Réactiver</button>` : ""}</div></div>`;
}).join("") + `</div>`;
return h;
}
const CATS = ["Informatique", "Téléphones", "Électroménager", "Vêtements", "Chaussures", "Immobilier", "Véhicules", "Mobilier", "Beauté", "Autre"];
function initDraft(id) {
const key = id || "new";
if (S.draft.key === key) return S.draft.p;
const st = settings();
const p = id ? JSON.parse(JSON.stringify(get(id) || {})) : { name: "", category: "", condition: "used", sale_price: "", purchase_price: "", min_price: "",
quantity: 1, description: "", location: st.default_location || "", delivery_terms: "", contact_info: "", photos: [], status: "active" };
S.draft.key = key; S.draft.p = p; S.draft.desc = null; return p;
}
function vEdit(id) {
if (id && !get(id)) return `<div class="card empty">Produit introuvable. <a href="#produits">Retour</a></div>`;
const p = initDraft(id);
const fld = (k, label, attrs = "") => `<label class="f">${label}<input class="in" data-bind="p.${k}" value="${esc(p[k] ?? "")}" ${attrs}></label>`;
const margin = p.purchase_price && p.sale_price ? Number(p.sale_price) - Number(p.purchase_price) : null;
let h = `<div class="row between"><h1>${id ? esc(p.name || "Produit") : "Nouveau produit"}</h1>${id ? `<span class="pill ${(STATUS[p.status] || STATUS.active)[1]}">${(STATUS[p.status] || STATUS.active)[0]}</span>` : ""}</div>`;
if (id && p.status === "active" && p.quantity > 0) h += `<a class="mega" href="#publier-${id}">🚀 PUBLIER PARTOUT</a>`;
h += `<form class="card" id="pform" novalidate>
<h2>Photos</h2>
<div class="photos">${(p.photos || []).map((x, i) => `<figure><img data-blob="${x.id}" alt="">${x.gen ? "<em>visuel</em>" : ""}<button type="button" data-a="rmphoto" data-i="${i}" aria-label="Retirer">✕</button></figure>`).join("")}
<label class="thumb ph" style="width:84px;height:84px;cursor:pointer;border-style:dashed">＋ Photo<input type="file" id="pick" accept="image/*" multiple hidden></label></div>
${S.busy === "upload" ? `<div class="small row"><span class="spin"></span> Envoi des photos…</div>` : `<div class="tiny muted">Les métadonnées (dont la position GPS) sont retirées à l'envoi.</div>`}
${fld("name", "Nom du produit *", 'required maxlength="200" placeholder="Ex. Dell Latitude 5420 i5 16 Go"')}
<div class="grid2"><label class="f">Catégorie *<input class="in" list="cats" data-bind="p.category" value="${esc(p.category)}" required></label>
<label class="f">État<select class="in" data-bind="p.condition"><option value="used"${p.condition === "used" ? " selected" : ""}>Occasion</option><option value="new"${p.condition === "new" ? " selected" : ""}>Neuf</option></select></label></div>
<datalist id="cats">${CATS.map((c) => `<option value="${c}">`).join("")}</datalist>
<div class="grid2">${fld("sale_price", "Prix de vente (FCFA) *", 'inputmode="numeric" required')}${fld("quantity", "Quantité", 'inputmode="numeric"')}</div>
<div class="grid2">${fld("purchase_price", "Prix d'achat (privé)", 'inputmode="numeric"')}${fld("min_price", "Prix plancher", 'inputmode="numeric"')}</div>
${margin !== null ? `<div class="tiny muted">Marge unitaire : ${money(margin)}</div>` : ""}
<label class="f">Description<textarea class="in" data-bind="p.description" maxlength="5000" placeholder="Caractéristiques, défauts éventuels, accessoires…">${esc(p.description)}</textarea></label>
${S.sample ? `<button type="button" class="btn sm" data-a="aidesc" ${S.busy ? "disabled" : ""}>${S.busy === "aidesc" ? '<span class="spin"></span> Analyse…' : "🪄 Rédiger avec l'IA" + ((p.photos || []).length && S.canImages ? " (à partir des photos)" : "")}</button>` : ""}
${S.draft.desc ? `<div class="note n-brand small"><div class="pre" style="background:transparent;padding:0">${esc(S.draft.desc.text)}</div>${S.draft.desc.check ? `<div style="margin-top:6px">À vérifier : ${esc(S.draft.desc.check)}</div>` : ""}<div class="row" style="margin-top:8px"><button type="button" class="btn sm primary" data-a="usedesc">Utiliser</button><button type="button" class="btn sm" data-a="nodesc">Ignorer</button></div></div>` : ""}
${fld("location", "Localisation", 'placeholder="Ouagadougou, Karpala"')}
${fld("delivery_terms", "Livraison", 'placeholder="Livraison Ouaga 1 000 F, retrait gratuit"')}
${fld("contact_info", "Contact (vide = celui des réglages)")}
<button class="btn primary block" ${S.busy ? "disabled" : ""}>${id ? "Enregistrer" : "Créer et préparer la diffusion"}</button>
</form>`;
if (id) {
const real = (p.photos || []).filter((x) => !x.gen);
h += `<div class="card"><h2>Visuel publicitaire</h2><p class="small muted" style="margin:0">À partir de votre vraie photo, entière et non retouchée, avec le nom et le prix.</p>
${real.length ? `<div class="row"><select class="in" style="width:auto" data-bind="theme">${["bleu", "vert", "sombre", "orange"].map((t) => `<option${S.draft.theme === t ? " selected" : ""}>${t}</option>`).join("")}</select>
<button class="btn" data-a="visual" ${S.busy ? "disabled" : ""}>${S.busy === "visual" ? '<span class="spin"></span>' : "Créer le visuel"}</button></div>` : `<p class="small">Ajoutez d'abord une photo.</p>`}</div>
<div class="card"><h2>Stock</h2><div class="row"><input class="in" style="width:120px" inputmode="numeric" data-bind="delta" placeholder="+5 ou -1" value="${esc(S.draft.delta || "")}"><button class="btn" data-a="stock">Appliquer</button></div></div>
<button class="btn danger" data-a="delprod">Supprimer ce produit</button>`;
}
return h;
}
function vPublish(id) {
const p = get(id); if (!p) return `<div class="card empty">Produit introuvable.</div>`;
const o = S.draft.pub && S.draft.pub.id === id ? S.draft.pub : (S.draft.pub = { id, marketplace: true, page: !!(fbPage() || settings().page_url), pageN: 1 });
const plan = (S.lastPlan = buildPlan(p, o)); const s = plan.stats;
if (S.draft.pubDone && S.draft.pubDone.id === id) {
const r = S.draft.pubDone;
return `<h1>Diffusion prête 🚀</h1><div class="card"><b>${esc(p.name)}</b>
<p class="note n-ok" style="margin:0">${r.n} publication${r.n > 1 ? "s" : ""} préparée${r.n > 1 ? "s" : ""} ${r.ai ? "et rédigée" + (r.n > 1 ? "s" : "") + " par l'IA" : "(générateur de modèles)"}, chacune avec un texte différent.</p>
${r.autoN ? `<p class="note n-brand" style="margin:0">📘 ${r.autoN} publication${r.autoN > 1 ? "s" : ""} programmée${r.autoN > 1 ? "s" : ""} sur votre Page : Facebook les publiera seul aux horaires prévus.</p>` : ""}
<p class="small muted" style="margin:0">Les autres canaux ne sont marqués « publiés » qu'après votre confirmation.</p></div>
${r.first ? `<a class="mega" href="#tache-${r.first}">Continuer : groupes et Marketplace →</a>` : ""}<a class="btn block" href="#taches">Voir le calendrier</a>`;
}
const ph = (p.photos || []).find((x) => !x.gen);
const modes = { tick: ["Avec Marketplace", "p-violet"], task: ["Planifié", "p-brand"], skip: ["Ignoré", "p-mute"] };
const kept = plan.dec.filter((d) => d.mode !== "skip"), skipped = plan.dec.filter((d) => d.mode === "skip");
return `<div class="card"><div class="item">${ph ? `<img class="thumb" data-blob="${ph.id}" alt="">` : `<div class="thumb ph">—</div>`}
<div class="t"><b>${esc(p.name)}</b><span class="price">${money(p.sale_price)}</span></div></div></div>
<div class="hero"><span class="small">Automatisation estimée</span><b>${s.pct} %</b>
<span class="small">${s.base} min de travail → ${s.rem} min · ${s.gestes} geste${s.gestes > 1 ? "s" : ""} pour vous</span></div>
<div class="card"><h2>Canaux</h2>
<label class="chk"><input type="checkbox" data-bind="pub.marketplace" ${o.marketplace ? "checked" : ""}><span><b>🛒 Marketplace</b><br><span class="small muted">Formulaire ouvert pour vous, champs à coller un par un. Les groupes d'achat-vente sont cochés dans le même formulaire.</span></span></label>
<label class="chk"><input type="checkbox" data-bind="pub.page" ${o.page ? "checked" : ""}><span><b>📘 Ma Page Facebook</b>${plan.auto ? ' <span class="pill p-ok">100 % automatique</span>' : ""}<br><span class="small muted">${plan.auto
? "« " + esc(fbPage().name) + " » : programmé sur Facebook, rien à faire. Horaires : " + plan.pageTimes.map((d) => when(d.toISOString())).join(" · ")
: settings().fb_app_id ? "Facebook non connecté : <a href=\"#reglages\">se connecter</a> pour l'automatique (sinon publication assistée)."
: settings().page_url ? "Publication assistée au prochain horaire. Connectez Facebook dans les réglages pour l'automatique." : "Connectez Facebook dans les réglages."}</span>
${plan.auto && o.page ? `<select class="in" style="width:auto;margin-top:6px" data-bind="pub.pageN">${[1, 2, 3, 4].map((n) => `<option value="${n}"${Number(o.pageN) === n ? " selected" : ""}>${n} publication${n > 1 ? "s" : ""} (prochains horaires)</option>`).join("")}</select>` : ""}</span></label></div>
<div class="card"><div class="row between"><h2>👥 Groupes (${kept.length})</h2><a class="small" href="#groupes">Gérer</a></div>
${plan.dec.length ? kept.map((d) => `<div class="row between" style="border-bottom:1px solid var(--line);padding-bottom:8px">
<div style="min-width:0;flex:1"><b class="trunc" style="display:block">${esc(d.g.name)}</b><span class="tiny muted">${d.mode === "tick" ? "En même temps que Marketplace" : when(d.when.toISOString())} · ${d.g.score}/100</span></div>
<span class="pill ${modes[d.mode][1]}">${modes[d.mode][0]}</span></div>`).join("") : `<p class="small muted" style="margin:0">Aucun groupe. <a href="#groupes">Ajoutez vos groupes</a> pour les inclure.</p>`}
${skipped.length ? `<details><summary>${skipped.length} non retenu${skipped.length > 1 ? "s" : ""}</summary><ul class="small">${skipped.map((d) => `<li>${esc(d.g.name)} — ${esc(d.why)}</li>`).join("")}</ul></details>` : ""}</div>
<button class="mega" data-a="go" data-id="${id}" ${S.busy || !s.canaux ? "disabled" : ""}>${S.busy === "go" ? '<span class="spin"></span> Rédaction des textes…' : "🚀 PUBLIER PARTOUT"}</button>
<p class="tiny muted" style="text-align:center;margin:0">${S.sample ? "Textes rédigés par l'IA (Gemini), un par canal." : "Textes créés par le générateur de modèles."} Prix, état, lieu et contact viennent toujours de votre fiche.</p>`;
}
function taskWhere(t) { return t.channel === "marketplace" ? "🛒 Marketplace" + ((t.ticked || []).length ? " + " + t.ticked.length + " groupe" + (t.ticked.length > 1 ? "s" : "") : "") : t.channel === "page" ? "📘 Ma Page" : "👥 " + t.group_name; }
function vTasks() {
const T = all("task"); const todo = T.filter((t) => t.status === "todo").sort((a, b) => a.scheduled_at.localeCompare(b.scheduled_at));
const due = todo.filter((t) => new Date(t.scheduled_at) <= now()), later = todo.filter((t) => new Date(t.scheduled_at) > now());
const done = T.filter((t) => t.status === "done" || t.status === "auto").sort((a, b) => (b.done_at || "").localeCompare(a.done_at || "")).slice(0, 15);
const row = (t) => `<a class="card item" href="#tache-${t.id}">${t.photos?.[0] ? `<img class="thumb" data-blob="${t.photos[0]}" alt="">` : `<div class="thumb ph">—</div>`}
<div class="t"><b class="trunc">${esc(t.product_name)}</b><span class="small muted trunc">${esc(taskWhere(t))}</span><span class="tiny">${when(t.scheduled_at)}</span></div><span>→</span></a>`;
let h = `<h1>À publier</h1>`;
if (!todo.length) h += `<div class="card empty">Rien à publier. Ouvrez un produit et touchez <b>🚀 Publier partout</b>.</div>`;
if (due.length) h += `<div class="row between"><span class="sec-title" style="color:var(--action)">Maintenant (${due.length})</span><a class="btn sm primary" href="#tache-${due[0].id}">Commencer ▶</a></div><div class="list">${due.map(row).join("")}</div>`;
if (later.length) h += `<div class="row between"><span class="sec-title">Planifié (${later.length})</span>${true ? `<button class="btn sm" data-a="ics">📅 Rappels dans mon agenda</button>` : ""}</div><div class="list">${later.map(row).join("")}</div>`;
if (done.length) h += `<details class="card"${due.length || later.length ? "" : " open"}><summary>Publiées et programmées (${done.length})</summary><ul class="small">${done.map((t) => `<li>${t.status === "auto" ? "📘 Programmé par Facebook " + when(t.scheduled_at) : "✅"} ${esc(t.product_name)} · ${esc(taskWhere(t))}${t.url ? ` · <a href="${esc(t.url)}" target="_blank" rel="noopener">voir</a>` : ""}</li>`).join("")}</ul></details>`;
return h;
}
function vTask(id) {
const t = get(id); if (!t) return `<div class="card empty">Tâche introuvable. <a href="#taches">Retour</a></div>`;
const st = S.step[id] || (S.step[id] = { n: 0 });
const mp = t.channel === "marketplace", page = t.channel === "page";
const open = mp ? "https://www.facebook.com/marketplace/create/item" : page ? "https://business.facebook.com/latest/composer" : t.group_url;
const fields = mp ? [["Titre", t.kit.title], ["Prix", String(t.kit.price)], ["Description", t.kit.desc]] : [["Texte", t.text]];
let h = `<div><div class="sec-title">${esc(taskWhere(t))} · ${when(t.scheduled_at)}</div><h1>${esc(t.product_name)}</h1></div>`;
if (t.status !== "todo") h += `<p class="note n-ok">Déjà traitée (${t.status === "done" ? "publiée" : "ignorée"}).</p>`;
if ((t.warn || []).length) h += `<p class="note n-warn small">⚠ ${esc(t.warn.join(" · "))}</p>`;
h += `<div class="card steps">
<div class="step${st.photos ? " done" : ""}"><div class="row between"><b>Photos (${(t.photos || []).length})</b>${true ? `<button class="btn sm primary" data-a="savephotos" data-id="${id}">📥 Tout enregistrer</button>` : ""}</div>
<div class="photos" style="margin-top:6px">${(t.photos || []).map((pid, i) => `<figure><img data-blob="${pid}" alt="">${true ? `<button type="button" data-a="savephoto" data-id="${id}" data-i="${i}" aria-label="Enregistrer" style="width:auto;padding:0 6px">⬇</button>` : ""}</figure>`).join("")}</div>
<div class="tiny muted">${true ? "Choisissez « Enregistrer » ou partagez directement vers Facebook." : "Appuyez longuement sur une photo pour l'enregistrer."}</div></div>`;
if (mp) h += `<div class="step${st.opened ? " done" : ""}"><b>Ouvrir le formulaire Marketplace</b>
<a class="btn fb block" style="margin-top:6px" href="${open}" target="_blank" rel="noopener" data-a="open" data-id="${id}">Ouvrir Marketplace ↗</a></div>
<div class="step${st.n >= 3 ? " done" : ""}"><b>Coller champ par champ</b>
<button class="btn primary block" style="margin-top:6px" data-a="copynext" data-id="${id}" ${st.n >= 3 ? "disabled" : ""}>${st.n < 3 ? "📋 Copier : " + fields[st.n][0] + " (" + (st.n + 1) + "/3)" : "✓ Tout est copié"}</button>
<div class="list" style="margin-top:8px">${fields.map(([k, v], i) => `<div class="copyline"><span>${i < st.n ? "✅" : "○"}</span><span class="v trunc"><b>${k}</b> : ${esc(k === "Prix" ? money(v) : v)}</span><button class="btn sm" data-a="copyfield" data-id="${id}" data-i="${i}">Copier</button></div>`).join("")}</div>
<dl class="kv" style="margin:10px 0 0"><dt>Catégorie</dt><dd>${esc(t.kit.category)}</dd><dt>État</dt><dd>${esc(t.kit.condition)}</dd>${t.kit.location ? `<dt>Lieu</dt><dd>${esc(t.kit.location)}</dd>` : ""}</dl>
${(t.ticked_names || []).length ? `<div class="note" style="background:var(--violet-soft);color:var(--violet);margin-top:10px"><b>Cochez ces groupes</b> dans « Proposer aussi dans des groupes » :<ul style="margin:4px 0 0">${t.ticked_names.map((n) => `<li>${esc(n)}</li>`).join("")}</ul></div>` : ""}</div>`;
else h += `<div class="step${st.opened ? " done" : ""}"><b>${page ? "Copier le texte et ouvrir Meta Business Suite" : "Copier le texte et ouvrir le groupe"}</b>
<a class="btn fb block" style="margin-top:6px" href="${esc(open)}" target="_blank" rel="noopener" data-a="copyopen" data-id="${id}">📋 Copier + ouvrir ${page ? "Business Suite" : "le groupe"} ↗</a>
${page ? `<div class="tiny muted">Dans Business Suite : coller, ajouter les photos, puis « Programmer » ou « Publier ».</div>` : `<div class="tiny muted">Dans le groupe : « Écrire quelque chose » → coller → photos → Publier.${t.is_admin ? " Vous êtes admin : vous pouvez aussi programmer ce post." : ""}</div>`}
${t.rules ? `<details style="margin-top:6px"><summary>Règles du groupe</summary><div class="pre small">${esc(t.rules)}</div></details>` : ""}
<details style="margin-top:6px"><summary>Voir le texte</summary><div class="pre small">${esc(t.text)}</div></details></div>`;
if (t.status === "todo") h += `<div class="step"><b>Confirmer</b>
<input class="in" style="margin-top:6px" inputmode="url" data-bind="link" placeholder="Lien de la publication (facultatif)" value="${esc(S.draft.link || "")}">
<button class="btn go block" style="margin-top:8px" data-a="done" data-id="${id}">✅ C'est publié — suivant</button>
<div class="grid2" style="margin-top:8px"><button class="btn" data-a="snooze" data-id="${id}">⏰ Dans 1 h</button><button class="btn" data-a="skip" data-id="${id}">Ignorer</button></div></div>`;
return h + `</div>`;
}
const MEMB = { joined: "Membre", pending: "Demande envoyée", to_request: "À rejoindre", rejected: "Refusé", left: "Quitté" };
function vGroups() {
const G = all("group").map((g) => ({ ...g, ...scoreGroup(g) })).sort((a, b) => b.score - a.score);
const f = S.draft.g || (S.draft.g = { url: "", name: "", member_count: "", activity_note: "", posting_rules: "", membership: "joined", buy_sell: false, is_admin: false });
const col = (s) => (s >= 75 ? "var(--ok)" : s >= 50 ? "var(--warn)" : "var(--muted)");
let h = `<h1>Groupes</h1>
<details class="card" ${G.length ? "" : "open"}><summary>🔎 Trouver des groupes pour vos produits</summary>
<p class="small muted">Ouvrez une recherche dans Facebook, copiez le lien d'un groupe intéressant, puis ajoutez-le ci-dessous.</p>
<div class="list">${searchLinks().map((l) => `<div class="row between small"><span class="trunc" style="flex:1;min-width:0">${esc(l.q)}</span><span class="row"><a class="btn sm fb" href="${l.fb}" target="_blank" rel="noopener">Facebook ↗</a><a class="btn sm" href="${l.web}" target="_blank" rel="noopener">Web ↗</a></span></div>`).join("") || `<span class="small muted">Ajoutez d'abord un produit.</span>`}</div></details>
<form class="card" id="gform" novalidate><h2>Ajouter un groupe</h2>
<label class="f">Lien du groupe *<input class="in" inputmode="url" data-bind="g.url" value="${esc(f.url)}" placeholder="https://www.facebook.com/groups/…"></label>
<label class="f">Nom du groupe *<input class="in" data-bind="g.name" value="${esc(f.name)}"></label>
<div class="grid2"><label class="f">Membres<input class="in" inputmode="numeric" data-bind="g.member_count" value="${esc(f.member_count)}" placeholder="25000"></label>
<label class="f">Statut<select class="in" data-bind="g.membership">${Object.entries(MEMB).slice(0, 3).map(([k, v]) => `<option value="${k}"${f.membership === k ? " selected" : ""}>${v}</option>`).join("")}</select></label></div>
<label class="f">Activité<input class="in" data-bind="g.activity_note" value="${esc(f.activity_note)}" placeholder="Très actif"></label>
<label class="f">Règles de publication<textarea class="in" data-bind="g.posting_rules" placeholder="Ex. 1 publication par jour, prix obligatoire">${esc(f.posting_rules)}</textarea></label>
<label class="chk"><input type="checkbox" data-bind="g.buy_sell" ${f.buy_sell ? "checked" : ""}><span>Groupe d'achat-vente (bouton « Vendre »)</span></label>
<label class="chk"><input type="checkbox" data-bind="g.is_admin" ${f.is_admin ? "checked" : ""}><span>Je suis administrateur</span></label>
<button class="btn primary block">Ajouter et noter</button></form>`;
if (!G.length) return h;
h += `<div class="sec-title">Mes groupes (${G.filter((g) => g.membership === "joined").length} rejoints / ${G.length})</div><div class="list">` + G.map((g) => `<div class="card">
<div class="row" style="align-items:flex-start"><div style="flex:1;min-width:0"><a href="${esc(g.url)}" target="_blank" rel="noopener"><b>${esc(g.name)} ↗</b></a>
<div class="row tiny muted" style="gap:6px">${g.member_count ? Number(g.member_count).toLocaleString("fr-FR") + " membres" : ""}${g.buy_sell ? '<span class="pill p-violet">Achat-vente</span>' : ""}${g.is_admin ? '<span class="pill p-mute">Admin</span>' : ""}</div></div>
<div class="score"><b>${g.score}</b><div class="bar"><i style="width:${g.score}%;background:${col(g.score)}"></i></div></div></div>
<div class="row"><select class="in" style="width:auto" data-gset="membership" data-id="${g.id}">${Object.entries(MEMB).map(([k, v]) => `<option value="${k}"${g.membership === k ? " selected" : ""}>${v}</option>`).join("")}</select>
<details style="flex:1"><summary>Réglages</summary><div class="list" style="margin-top:8px">
<div class="tiny muted">${esc(g.expl)}</div>
<label class="chk"><input type="checkbox" data-gset="buy_sell" data-id="${g.id}" ${g.buy_sell ? "checked" : ""}><span>Achat-vente</span></label>
<label class="chk"><input type="checkbox" data-gset="is_admin" data-id="${g.id}" ${g.is_admin ? "checked" : ""}><span>Je suis admin</span></label>
<div class="grid2"><label class="f">Max / semaine<input class="in" inputmode="numeric" data-gset="max_per_week" data-id="${g.id}" value="${g.max_per_week ?? 2}"></label>
<label class="f">Reproposer après (jours)<input class="in" inputmode="numeric" data-gset="cooldown_days" data-id="${g.id}" value="${g.cooldown_days ?? 7}"></label></div>
<button class="btn sm danger" data-a="delgroup" data-id="${g.id}">Retirer ce groupe</button></div></details></div></div>`).join("") + `</div>`;
return h;
}
function vSettings() {
const f = S.draft.s || (S.draft.s = { ...settings(), slotsText: settings().slots.join(", ") });
const fld = (k, l, a = "") => `<label class="f">${l}<input class="in" data-bind="s.${k}" value="${esc(f[k] ?? "")}" ${a}></label>`;
const st = settings(); const page = fbPage();
const fbCard = !st.fb_app_id
? `<p class="small muted" style="margin:0">Entrez l'ID de votre app Meta ci-dessous puis enregistrez : le bouton de connexion apparaîtra.</p>`
: page ? `<div class="note n-ok">✅ Connecté à la Page <b>${esc(page.name)}</b> : publication et programmation automatiques.</div>
${S.fb.pages.length > 1 ? `<label class="f">Page utilisée<select class="in" data-a-change="fbpage">${S.fb.pages.map((p) => `<option value="${p.id}"${p.id === st.fb_page_id ? " selected" : ""}>${esc(p.name)}</option>`).join("")}</select></label>` : ""}
<button class="btn sm" data-a="fbout">Se déconnecter</button>`
: `${S.fb.err ? `<div class="note n-warn small">${esc(S.fb.err)}</div>` : ""}
<button class="btn fb block" data-a="fblogin" ${S.fb.sdk ? "" : "disabled"}>${S.fb.sdk ? "Se connecter avec Facebook" : '<span class="spin"></span> Chargement de Facebook…'}</button>
${st.fb_page_name ? `<div class="tiny muted">Dernière Page utilisée : ${esc(st.fb_page_name)}. La connexion dure environ 1 à 2 h : reconnectez-vous en un geste quand c'est demandé. Les publications déjà programmées restent chez Facebook.</div>` : ""}`;
return `<h1>Réglages</h1>
<div class="card"><h2>📘 Facebook</h2>${fbCard}
<div class="tiny muted">Connexion officielle de Meta : votre mot de passe n'est jamais vu par l'application. Seules vos Pages sont accessibles (Meta n'autorise pas les groupes ni Marketplace).</div></div>
<form class="card" id="sform" novalidate><h2>Boutique</h2>
${fld("business_name", "Nom de la boutique")}${fld("default_location", "Ville / quartier", 'placeholder="Ouagadougou, Karpala"')}
<div class="grid2">${fld("phone", "Téléphone", 'inputmode="tel"')}${fld("whatsapp", "WhatsApp", 'inputmode="tel"')}</div>
${fld("page_url", "Lien de ma Page Facebook (facultatif)", 'inputmode="url" placeholder="https://www.facebook.com/maboutique"')}
<h2>Calendrier de publication</h2>
${fld("slotsText", "Horaires (séparés par des virgules)", 'placeholder="07:00, 12:00, 17:00, 20:00"')}
<div class="grid2">${fld("max_group_per_day", "Groupes max par jour", 'inputmode="numeric"')}${fld("min_spacing", "Minutes entre 2 groupes", 'inputmode="numeric"')}</div>
<h2>Connexions</h2>
${fld("fb_app_id", "ID de l'app Meta", 'inputmode="numeric" placeholder="Ex. 1234567890123456"')}
${fld("gemini_key", "Clé IA Gemini (gratuite, facultative)", 'type="password" autocomplete="off" placeholder="Créée sur aistudio.google.com/apikey"')}
<div class="tiny muted">La clé reste sur ce téléphone. Sans clé, les annonces sont créées par le générateur de modèles.</div>
<button class="btn primary block">Enregistrer</button></form>
<div class="card"><h2>Sauvegarde</h2>
<p class="small muted" style="margin:0">Vos produits, photos et groupes sont enregistrés sur ce téléphone, dans ce navigateur. Faites une sauvegarde de temps en temps.</p>
<div class="row"><button class="btn sm" data-a="backup">⬇ Sauvegarder</button>
<label class="btn sm" style="cursor:pointer">⬆ Restaurer<input type="file" id="restore" accept="application/json,.json" hidden></label></div></div>`;
}
function setPath(path, val) { const ks = path.split("."); let o = S.draft; for (const k of ks.slice(0, -1)) o = o[k] = o[k] || {}; o[ks.at(-1)] = val; }
app.addEventListener("input", (e) => {
const el = e.target; const b = el.dataset.bind; if (!b) return;
setPath(b, el.type === "checkbox" ? el.checked : el.value);
if (b === "q") { const pos = el.selectionStart; render(); const n = document.getElementById("q"); n.focus(); n.setSelectionRange(pos, pos); }
});
app.addEventListener("change", async (e) => {
const el = e.target;
if (el.dataset.bind?.startsWith("pub.")) { setPath(el.dataset.bind, el.type === "checkbox" ? el.checked : el.value); S.keepScroll = true; render(); return; }
if (el.id === "pick" && el.files?.length) {
S.busy = "upload"; render(); const got = await uploadPhotos([...el.files]); S.busy = null;
S.draft.p.photos = [...(S.draft.p.photos || []), ...got].slice(0, 12);
if (S.draft.key !== "new" && got.length) await put(S.draft.key, { ...get(S.draft.key), photos: S.draft.p.photos, updated_at: now().toISOString() });
render(); return;
}
if (el.dataset.aChange === "fbpage") { const p = S.fb.pages.find((x) => x.id === el.value); if (p) { await put("settings", { ...settings(), kind: "settings", fb_page_id: p.id, fb_page_name: p.name }); render(); } return; }
if (el.id === "restore" && el.files?.[0]) {
try {
const data = JSON.parse(await el.files[0].text()); if (data.v !== 1 || typeof data.docs !== "object") throw 0;
for (const [k, b] of Object.entries(data.blobs || {})) { const bin = Uint8Array.from(atob(b.data), (c) => c.charCodeAt(0)); await idb("blobs", "readwrite", (st) => st.put(new Blob([bin], { type: b.type || "image/jpeg" }), k)); }
for (const [k, d] of Object.entries(data.docs)) if (d && typeof d === "object" && ["product", "group", "task", "settings"].includes(d.kind)) await put(k, k === "settings" ? { ...d, gemini_key: settings().gemini_key } : d);
toast("Sauvegarde restaurée"); render();
} catch { toast("Fichier de sauvegarde invalide."); }
return;
}
const gs = el.dataset.gset;
if (gs) {
const g = get(el.dataset.id); if (!g) return;
let v = el.type === "checkbox" ? el.checked : el.value;
if (gs === "max_per_week" || gs === "cooldown_days") v = Math.max(0, Math.min(gs === "max_per_week" ? 21 : 90, parseInt(v, 10) || 0));
await put(g.id, { ...g, [gs]: v, updated_at: now().toISOString() }); S.keepScroll = true; render();
}
});
app.addEventListener("submit", async (e) => {
e.preventDefault();
if (e.target.id === "pform") return saveProduct();
if (e.target.id === "gform") return addGroup();
if (e.target.id === "sform") return saveSettings();
});
async function saveProduct() {
const p = S.draft.p; const num = (v) => (v === "" || v == null ? null : Number(String(v).replace(/[^\d.]/g, "")));
if (!p.name || p.name.trim().length < 2) return toast("Indiquez le nom du produit.");
if (!p.category || p.category.trim().length < 2) return toast("Indiquez la catégorie.");
const sale = num(p.sale_price); if (!sale || sale < 0) return toast("Indiquez un prix de vente valide.");
const min = num(p.min_price); if (min && min > sale) return toast("Le prix plancher dépasse le prix de vente.");
const qty = Math.max(0, parseInt(p.quantity, 10) || 0);
const id = S.draft.key === "new" ? rid("p") : S.draft.key;
const prev = get(id) || {};
const doc = { kind: "product", name: p.name.trim().slice(0, 200), category: p.category.trim().slice(0, 100), condition: p.condition === "new" ? "new" : "used",
sale_price: sale, purchase_price: num(p.purchase_price), min_price: min, quantity: qty, description: (p.description || "").slice(0, 5000),
location: (p.location || "").slice(0, 200), delivery_terms: (p.delivery_terms || "").slice(0, 500), contact_info: (p.contact_info || "").slice(0, 300),
photos: p.photos || [], status: qty === 0 && (prev.status || "active") === "active" ? "sold" : prev.status || "active",
created_at: prev.created_at || now().toISOString(), updated_at: now().toISOString() };
await put(id, doc);
const isNew = S.draft.key === "new"; S.draft.key = null;
if (isNew) { toast("Produit créé"); go("publier-" + id); } else { toast("Enregistré"); render(); }
}
async function addGroup() {
const f = S.draft.g; const url = normGroupUrl(f.url);
if (!url) return toast("Lien invalide : il doit ressembler à facebook.com/groups/…");
if (!f.name || f.name.trim().length < 2) return toast("Indiquez le nom du groupe.");
if (all("group").some((g) => g.url === url)) return toast("Ce groupe est déjà dans votre liste.");
const doc = { kind: "group", url, name: f.name.trim().slice(0, 200), member_count: parseInt(String(f.member_count).replace(/\D/g, ""), 10) || null,
activity_note: (f.activity_note || "").slice(0, 300), posting_rules: (f.posting_rules || "").slice(0, 3000), membership: f.membership,
buy_sell: !!f.buy_sell, is_admin: !!f.is_admin, max_per_week: 2, cooldown_days: 7, created_at: now().toISOString() };
const id = rid("g"); await put(id, doc);
S.draft.g = null; toast("Ajouté : pertinence " + scoreGroup(doc).score + "/100"); render();
}
async function saveSettings() {
const f = S.draft.s;
const slots = [...new Set(String(f.slotsText).split(/[,;\s]+/).map((x) => x.trim()).filter(Boolean))];
if (!slots.length || slots.some((x) => !/^([01]\d|2[0-3]):[0-5]\d$/.test(x))) return toast("Horaires au format HH:MM, ex. 07:00, 12:00");
if (f.page_url && !isFbUrl(f.page_url)) return toast("Le lien de la Page doit commencer par https://www.facebook.com/");
const doc = { kind: "settings", business_name: String(f.business_name || "").slice(0, 120), default_location: String(f.default_location || "").slice(0, 200),
phone: String(f.phone || "").replace(/[^\d+ ()-]/g, "").slice(0, 30), whatsapp: String(f.whatsapp || "").replace(/[^\d+ ()-]/g, "").slice(0, 30),
page_url: f.page_url || "", slots: slots.sort().slice(0, 8),
fb_app_id: String(f.fb_app_id || "").replace(/\D/g, "").slice(0, 20), fb_page_id: settings().fb_page_id, fb_page_name: settings().fb_page_name,
gemini_key: String(f.gemini_key || "").trim().slice(0, 100), gemini_model: settings().gemini_model, max_group_per_day: Math.max(0, Math.min(40, parseInt(f.max_group_per_day, 10) || 6)),
min_spacing: Math.max(5, Math.min(240, parseInt(f.min_spacing, 10) || 20)) };
const appChanged = doc.fb_app_id !== settings().fb_app_id;
await put("settings", doc); S.draft.s = null; setupAI(); toast("Réglages enregistrés");
if (doc.fb_app_id && (appChanged || !window.FB)) { if (window.FB && appChanged) { toast("Rechargez la page pour utiliser la nouvelle app Meta."); } else initFb(); }
render();
}
app.addEventListener("click", async (e) => {
const el = e.target.closest("[data-a]"); if (!el) return;
const a = el.dataset.a, id = el.dataset.id;
const P = id ? get(id) : null;
const upd = async (d) => { await put(id, { ...get(id), ...d, updated_at: now().toISOString() }); render(); };
if (a === "sold") return ask("Marquer « " + P.name + " » comme vendu ?", "Vendu", () => upd({ status: "sold" }));
if (a === "pause") return upd({ status: "paused" });
if (a === "resume") return P.quantity > 0 ? upd({ status: "active" }) : toast("Stock à zéro : ajoutez du stock d'abord.");
if (a === "rmphoto") { S.draft.p.photos.splice(Number(el.dataset.i), 1); if (S.draft.key !== "new") await put(S.draft.key, { ...get(S.draft.key), photos: S.draft.p.photos }); return render(); }
if (a === "delprod") return ask("Supprimer définitivement ce produit ?", "Supprimer", async () => { await del(S.draft.key); S.draft.key = null; go("produits"); }, true);
if (a === "stock") {
const d = parseInt(S.draft.delta, 10); const p = get(S.draft.key); if (!d) return toast("Indiquez une variation, ex. -1 ou +5");
const q = p.quantity + d; if (q < 0) return toast("Stock insuffisant (" + p.quantity + ")");
await put(p.id, { ...p, quantity: q, status: q === 0 && p.status === "active" ? "sold" : q > 0 && p.status === "sold" ? "active" : p.status, updated_at: now().toISOString() });
S.draft.delta = ""; S.draft.key = null; toast("Stock : " + q); return render();
}
if (a === "aidesc") {
const p = S.draft.p; S.busy = "aidesc"; render();
try {
const real = (p.photos || []).filter((x) => !x.gen).slice(0, 3);
const imgs = S.canImages ? await Promise.all(real.map((x) => getBlob(x.id))) : [];
const r = await S.sample.json("Tu aides un commerçant du Burkina Faso à décrire un produit à vendre. Décris UNIQUEMENT ce qui est visible sur les photos ou indiqué ci-dessous. N'invente aucune caractéristique technique non visible ni fournie : mets-la dans a_verifier. Signale honnêtement les défauts visibles. Aucun prix, aucun numéro. Français simple.\nInformations : " + JSON.stringify({ nom: p.name, categorie: p.category, etat: condFr(p.condition), notes: p.description }) + '\nRéponds UNIQUEMENT en JSON : {"description": "3 à 5 phrases", "caracteristiques": ["…"], "a_verifier": ["…"]}', imgs.length ? { images: imgs, cache: false } : { cache: false });
const d = strip(r.description || "").c; const c = (r.caracteristiques || []).map((x) => strip(x).c).filter(Boolean);
S.draft.desc = { text: [d, ...c.map((x) => "• " + x)].join("\n"), check: (r.a_verifier || []).join(", ") };
} catch (err) { toast(err?.code === "bad_key" ? "Clé Gemini refusée : vérifiez-la dans les réglages." : err?.code === "rate_limited" ? "Trop de demandes, réessayez plus tard." : "La rédaction a échoué, réessayez."); if (err?.code === "not_granted") S.sample = null; }
S.busy = null; return render();
}
if (a === "usedesc") { S.draft.p.description = S.draft.desc.text; S.draft.desc = null; return render(); }
if (a === "nodesc") { S.draft.desc = null; return render(); }
if (a === "visual") {
const p = get(S.draft.key); const real = (p.photos || []).find((x) => !x.gen); S.busy = "visual"; render();
try { const v = await makeVisual(p, real.id, S.draft.theme || "bleu"); const photos = [...(p.photos || []), v]; await put(p.id, { ...p, photos }); S.draft.p.photos = photos; toast("Visuel créé"); }
catch { toast("Création du visuel impossible."); }
S.busy = null; return render();
}
if (a === "go") {
const p = get(id); S.busy = "go"; render();
try { const r = await publishEverywhere(p, S.lastPlan); S.draft.pubDone = { id, ...r }; }
catch { toast("La préparation a échoué, réessayez."); }
S.busy = null; return render();
}
if (a === "ics") { const ok = await saveFile("rappels-publications.ics", new Blob([ics(all("task").filter((t) => t.status === "todo" && new Date(t.scheduled_at) > now()))], { type: "text/calendar" })); return toast(ok ? "Ouvrez le fichier pour ajouter les rappels à votre agenda." : "Enregistrement annulé."); }
if (a === "savephoto" || a === "savephotos") {
const t = get(id); const list = a === "savephoto" ? [t.photos[Number(el.dataset.i)]] : t.photos;
const files = []; for (const [i, pid] of list.entries()) { const b = await getBlob(pid); if (b) files.push(new File([b], t.product_name.replace(/[^\w-]+/g, "-").slice(0, 30) + "-" + (i + 1) + ".jpg", { type: "image/jpeg" })); }
let n = 0;
if (navigator.canShare?.({ files })) { try { await navigator.share({ files }); n = files.length; } catch { /* annulé */ } }
else for (const fl of files) if (await saveFile(fl.name, fl)) n++;
S.step[id].photos = n > 0; toast(n + " photo" + (n > 1 ? "s" : "") + " enregistrée" + (n > 1 ? "s" : "")); S.keepScroll = true; return render();
}
const t = id ? get(id) : null;
if (a === "open") { S.step[id].opened = true; setTimeout(() => { S.keepScroll = true; render(); }, 300); return; } // le lien s'ouvre normalement
if (a === "copyopen") { copy(t.text, "Texte"); S.step[id].opened = true; setTimeout(() => { S.keepScroll = true; render(); }, 300); return; }
if (a === "copynext") { const st = S.step[id]; const f = [t.kit.title, String(t.kit.price), t.kit.desc]; const lab = ["Titre", "Prix", "Description"]; await copy(f[st.n], lab[st.n]); st.n = Math.min(3, st.n + 1); S.keepScroll = true; return render(); }
if (a === "copyfield") { const i = Number(el.dataset.i); const f = [t.kit.title, String(t.kit.price), t.kit.desc]; return copy(f[i], ["Titre", "Prix", "Description"][i]); }
if (a === "done") {
const link = (S.draft.link || "").trim(); if (link && !isFbUrl(link)) return toast("Lien Facebook invalide (https://www.facebook.com/…)");
const ts = now().toISOString(); await put(id, { ...t, status: "done", done_at: ts, url: link || null });
for (const gid of [t.group_id, ...(t.ticked || [])].filter(Boolean)) { const g = get(gid); if (g) await put(gid, { ...g, last_posted_at: ts }); }
S.draft.link = ""; return nextTask(id, "Bravo, c'est noté ✅");
}
if (a === "skip") { await put(id, { ...t, status: "skipped" }); return nextTask(id, "Ignorée"); }
if (a === "snooze") { await put(id, { ...t, scheduled_at: new Date(Date.now() + 36e5).toISOString() }); return nextTask(id, "Reportée d'une heure"); }
if (a === "fblogin") return fbLogin();
if (a === "fbout") { if (window.FB) FB.logout(() => {}); S.fb.pages = []; S.fb.user = false; toast("Déconnecté de Facebook"); return render(); }
if (a === "backup") {
const blobs = {}; for (const [k, b] of await idbEntries("blobs")) blobs[k] = { type: b.type, data: await b64(b) };
const docs = Object.fromEntries([...S.docs.entries()].map(([k, v]) => [k, k === "settings" ? { ...v, gemini_key: "" } : v]));
await saveFile("sales-agent-sauvegarde-" + now().toISOString().slice(0, 10) + ".json", new Blob([JSON.stringify({ v: 1, docs, blobs })], { type: "application/json" }));
return toast("Sauvegarde téléchargée (sans votre clé IA).");
}
if (a === "delgroup") return ask("Retirer ce groupe de votre liste ?", "Retirer", async () => { await del(id); render(); }, true);
});
function nextTask(cur, msg) {
toast(msg); const n = all("task").filter((x) => x.status === "todo" && x.id !== cur && new Date(x.scheduled_at) <= now()).sort((a, b) => a.scheduled_at.localeCompare(b.scheduled_at))[0];
go(n ? "tache-" + n.id : "taches");
}
document.getElementById("overlay").addEventListener("click", async (e) => {
const a = e.target.closest("[data-a]")?.dataset.a;
if (a === "modal-no") { S.modal = null; renderOverlay(); }
if (a === "modal-ok") { const f = S.modal.onOk; S.modal = null; renderOverlay(); await f(); }
});
window.addEventListener("hashchange", () => { const r = route(); if (r.v !== "produit" && r.v !== "nouveau") S.draft.key = null; if (r.v !== "publier") S.draft.pubDone = null; render(); });
function initFb() {
const id = settings().fb_app_id; if (!id) return;
loadFbSdk(id).then(() => {
render();
FB.getLoginStatus((r) => { if (r.status === "connected") fbLoadPages().catch(() => {}); }); // reprend une session encore valide
}).catch(() => { S.fb.err = "Impossible de charger Facebook (connexion internet ?)."; render(); });
}
async function boot() {
render();
try { IDB.db = await idbOpen(); } catch { S.err = "Ce navigateur bloque l'enregistrement des données (mode privé ?). Ouvrez le lien dans Chrome normal."; return render(); }
try { navigator.storage?.persist?.(); } catch { /* facultatif */ }
S.docs = new Map((await idbEntries("docs")).filter(([, v]) => v && v.kind));
S.loaded = true; setupAI(); initFb(); render();
}
boot();
setInterval(() => { if (route().v === "taches" || route().v === "accueil") renderTabs(); }, 60000);