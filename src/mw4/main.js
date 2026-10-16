import D from './data.json';
import C from './classes.json';
import './style.css';

(function(){
"use strict";
var TIERS = ["META", "A", "B", "C", "D"];
var cat = {}; D.categories.forEach(function(c){ cat[c.id] = c; });
function $(id){ return document.getElementById(id); }
function esc(s){ return String(s).replace(/[&<>"']/g, function(c){ return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]; }); }
function date(iso){ if (!iso) return ""; var p = iso.split("-"); return p[2] + "/" + p[1] + "/" + p[0]; }

/* onglets */
document.querySelector(".tabs").addEventListener("click", function(e){
  var b = e.target.closest("[data-view]"); if (!b) return;
  document.querySelectorAll(".tabs [data-view]").forEach(function(x){
    var on = x === b; x.setAttribute("aria-selected", on);
    $("view-" + x.getAttribute("data-view")).hidden = !on;
  });
});

/* armes triées par tier puis par rang */
var armes = C.armes.slice().sort(function(a, b){ return TIERS.indexOf(a.tier) - TIERS.indexOf(b.tier) || a.rang - b.rang; });
$("maj").textContent = date(C.maj);

/* filtres par catégorie */
var filtre = "";
$("filtres").innerHTML = '<button type="button" class="chip" aria-pressed="true" data-cat="">Toutes <small>' + armes.length + '</small></button>' +
  D.categories.filter(function(c){ return armes.some(function(a){ return a.cat === c.id; }); }).map(function(c){
    var n = armes.filter(function(a){ return a.cat === c.id; }).length;
    return '<button type="button" class="chip" aria-pressed="false" data-cat="' + c.id + '">' + esc(c.nom) + ' <small>' + n + '</small></button>';
  }).join("");
$("filtres").addEventListener("click", function(e){
  var b = e.target.closest("[data-cat]"); if (!b) return;
  filtre = b.getAttribute("data-cat");
  this.querySelectorAll("[data-cat]").forEach(function(x){ x.setAttribute("aria-pressed", x === b); });
  rendre();
});

function buildHTML(b){
  var titre = D.styles[b.style] || b.style.replace(/_/g, " ").toLowerCase();
  return '<div class="build"><h4>' + esc(titre) + (b.apex ? ' <span class="apex">' + esc(b.apex) + '</span>' : '') + '</h4><ul>' +
    b.acc.map(function(a){
      return '<li><span class="slot">' + esc(D.slots[a.slot] || a.slot) + '</span><span class="an">' + esc(a.nom) + '</span>' + (a.niv ? '<span class="niv">Niv. ' + a.niv + '</span>' : '') + '</li>';
    }).join("") + '</ul></div>';
}

function rendre(){
  var l = armes.filter(function(a){ return !filtre || a.cat === filtre; });
  $("armes").innerHTML = l.map(function(a){
    return '<article class="wep" id="' + a.id + '">' +
      '<header><span class="tier t-' + a.tier + '">' + a.tier + '</span><div><h3>' + esc(a.nom) + '</h3><div class="sub">' + esc((cat[a.cat] || {}).un || a.cat) + '</div></div></header>' +
      (a.builds.length ? '<div class="builds">' + a.builds.map(buildHTML).join("") + '</div>' : '<p class="sub">Pas encore de classe recommandée pour cette arme.</p>') +
      '<a class="src" href="' + a.lien + '" target="_blank" rel="noopener">Source : wzstats.gg, classes du ' + esc(a.nom) + ' ↗</a>' +
      '</article>';
  }).join("");
}
rendre();
})();
