import D from './data.json';
import './style.css';

(function(){
"use strict";
var KEY = "antre-mw4-classes";
var MAX_ACC = 5;
var byId = {}; D.armes.forEach(function(a){ byId[a.id] = a; });
var catNom = {}; D.categories.forEach(function(c){ catNom[c.id] = c.nom; });

function $(id){ return document.getElementById(id); }
function esc(s){ return String(s).replace(/[&<>"']/g, function(c){ return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]; }); }
function lien(id){ return "https://wzstats.gg/fr/best-loadouts/" + id; }

/* stockage */
function charger(){ try { var v = JSON.parse(localStorage.getItem(KEY) || "[]"); return Array.isArray(v) ? v : []; } catch(e){ return []; } }
function sauver(){ try { localStorage.setItem(KEY, JSON.stringify(classes)); } catch(e){ toast("Impossible d'enregistrer dans ce navigateur."); } }
var classes = charger();

var toastTimer;
function toast(msg){ var t = $("toast"); t.textContent = msg; t.hidden = false; clearTimeout(toastTimer); toastTimer = setTimeout(function(){ t.hidden = true; }, 2600); }

/* onglets */
document.querySelector(".tabs").addEventListener("click", function(e){
  var b = e.target.closest("[data-view]"); if(!b) return;
  document.querySelectorAll(".tabs [data-view]").forEach(function(x){
    var on = x === b; x.setAttribute("aria-selected", on);
    $("view-" + x.getAttribute("data-view")).hidden = !on;
  });
});

/* listes d'armes */
function options(sel, vide){
  var h = vide ? '<option value="">— Aucune —</option>' : '<option value="" disabled selected>Choisir…</option>';
  D.categories.forEach(function(c){
    h += '<optgroup label="' + esc(c.nom) + '">' + D.armes.filter(function(a){ return a.cat === c.id; }).map(function(a){ return '<option value="' + a.id + '">' + esc(a.nom) + '</option>'; }).join("") + '</optgroup>';
  });
  sel.innerHTML = h;
}
options($("f-arme"), false);
options($("f-arme2"), true);

function accRow(acc){
  acc = acc || {};
  return '<div class="acc"><select aria-label="Emplacement"><option value="">Emplacement…</option>' +
    D.emplacements.map(function(e){ return '<option' + (e === acc.emplacement ? " selected" : "") + '>' + esc(e) + '</option>'; }).join("") +
    '</select><input type="text" maxlength="40" placeholder="Nom de l\'accessoire" aria-label="Accessoire" value="' + esc(acc.nom || "") + '"></div>';
}

/* éditeur */
var editing = -1;
function ouvrir(i){
  editing = i;
  var c = i >= 0 ? classes[i] : { nom: "", arme: "", arme2: "", acc: [], note: "" };
  $("ed-title").textContent = i >= 0 ? "Modifier la classe" : "Nouvelle classe";
  $("f-nom").value = c.nom; $("f-arme").value = c.arme; $("f-arme2").value = c.arme2 || ""; $("f-note").value = c.note || "";
  var h = ""; for (var k = 0; k < MAX_ACC; k++) h += accRow(c.acc[k]);
  $("f-acc").innerHTML = h;
  $("editor").hidden = false; $("new").hidden = true;
  $("f-nom").focus();
}
function fermer(){ $("editor").hidden = true; $("new").hidden = false; editing = -1; }
$("new").addEventListener("click", function(){ ouvrir(-1); });
$("cancel").addEventListener("click", fermer);
$("editor").addEventListener("submit", function(e){
  e.preventDefault();
  var acc = [].map.call($("f-acc").querySelectorAll(".acc"), function(r){
    return { emplacement: r.querySelector("select").value, nom: r.querySelector("input").value.trim() };
  }).filter(function(a){ return a.nom; });
  var c = { nom: $("f-nom").value.trim(), arme: $("f-arme").value, arme2: $("f-arme2").value, acc: acc, note: $("f-note").value.trim() };
  if (!c.nom || !c.arme) return;
  if (editing >= 0) classes[editing] = c; else classes.push(c);
  sauver(); fermer(); rendre(); toast("Classe enregistrée.");
});

/* liste des classes */
function rendre(){
  $("n-classes").textContent = classes.length ? classes.length + (classes.length > 1 ? " classes" : " classe") : "";
  if (!classes.length){ $("classes").innerHTML = '<div class="empty">Aucune classe pour l\'instant. Crée la première avec « Nouvelle classe ».</div>'; return; }
  $("classes").innerHTML = classes.map(function(c, i){
    var a = byId[c.arme] || { nom: c.arme, cat: "" }, a2 = byId[c.arme2];
    return '<article class="card">' +
      '<div class="ch"><div><h3>' + esc(c.nom) + '</h3><div class="sub">' + esc(a.nom) + ' · ' + esc(catNom[a.cat] || "") + (a2 ? ' · secondaire : ' + esc(a2.nom) : '') + '</div></div>' +
      '<div class="cbtn"><button type="button" class="btn sm" data-edit="' + i + '">Modifier</button><button type="button" class="btn sm danger" data-del="' + i + '">Supprimer</button></div></div>' +
      (c.acc.length ? '<ul class="accs">' + c.acc.map(function(x){ return '<li><span>' + esc(x.emplacement || "—") + '</span>' + esc(x.nom) + '</li>'; }).join("") + '</ul>' : '<p class="sub">Aucun accessoire noté.</p>') +
      (c.note ? '<p class="cnote">' + esc(c.note) + '</p>' : '') +
      (byId[c.arme] ? '<a class="ext" href="' + lien(c.arme) + '" target="_blank" rel="noopener">Comparer avec la classe recommandée ↗</a>' : '') +
      '</article>';
  }).join("");
}
$("classes").addEventListener("click", function(e){
  var b = e.target.closest("button"); if (!b) return;
  if (b.hasAttribute("data-edit")) ouvrir(+b.getAttribute("data-edit"));
  if (b.hasAttribute("data-del")){
    var i = +b.getAttribute("data-del");
    if (confirm("Supprimer la classe « " + classes[i].nom + " » ?")){ classes.splice(i, 1); sauver(); rendre(); toast("Classe supprimée."); }
  }
});

/* export / import */
$("export").addEventListener("click", function(){
  var blob = new Blob([JSON.stringify(classes, null, 1)], { type: "application/json" });
  var a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "mw4-classes.json"; a.click();
  setTimeout(function(){ URL.revokeObjectURL(a.href); }, 1000);
});
$("import").addEventListener("change", function(e){
  var f = e.target.files[0]; if (!f) return;
  f.text().then(function(t){
    var v = JSON.parse(t); if (!Array.isArray(v)) throw new Error();
    classes = v.filter(function(c){ return c && c.nom && c.arme && Array.isArray(c.acc); });
    sauver(); rendre(); toast(classes.length + " classe(s) importée(s).");
  }).catch(function(){ toast("Fichier non reconnu."); });
  e.target.value = "";
});

/* armes */
$("n-armes").textContent = D.armes.length;
$("armes").innerHTML = D.categories.map(function(c){
  var l = D.armes.filter(function(a){ return a.cat === c.id; });
  if (!l.length) return "";
  return '<section class="cat"><h2>' + esc(c.nom) + ' <small>' + l.length + '</small></h2><div class="weps">' +
    l.map(function(a){ return '<a class="wep" href="' + lien(a.id) + '" target="_blank" rel="noopener"><span>' + esc(a.nom) + '</span><small>Classe recommandée ↗</small></a>'; }).join("") +
    '</div></section>';
}).join("");

rendre();
})();
