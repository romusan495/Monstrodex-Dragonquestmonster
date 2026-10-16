import D from './data.json';
import './style.css';

(function(){
"use strict";
var M=D.M,T=D.T,A=D.A,I=D.I,K=D.K,P=D.P,S=D.S;
function spStyle(id,s){var p=S[id]||[0,0];return "--x:"+p[0]+";--y:"+p[1]+";--s:"+s}
var RANKS="GFEDCBASX".split("");
var FAMS=["Slime","Dragon","Bête","Nature","Matière","Démon","Mort-vivant","???"];
var FKEY={"Slime":"slime","Dragon":"dragon","Bête":"beast","Nature":"nature","Matière":"material","Démon":"demon","Mort-vivant":"undead","???":"unknown"};
var KEYFAM={slime:"Slime",dragon:"Dragon",beast:"Bête",nature:"Nature",material:"Matière",demon:"Démon",undead:"Mort-vivant",boss:"???"};
var FINI={"Slime":"S","Dragon":"D","Bête":"B","Nature":"N","Matière":"M","Démon":"É","Mort-vivant":"Z","???":"?"};
var STATN=["PV","PM","Attaque","Défense","Agilité","Sagesse"];
var SEAS=["Printemps","Été","Automne","Hiver"];
var ELEM=["Feu","Eau","Vent","Terre","Explosions","Glace","Électricité","Lumière","Ténèbres"];

function esc(s){return String(s).replace(/[&<>"']/g,function(c){return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]})}
function norm(s){return String(s).normalize("NFD").replace(/[̀-ͯ]/g,"").replace(/œ/g,"oe").toLowerCase()}

var byId={};M.forEach(function(m,i){byId[m.id]=m;m.i=i});
var REV={};
M.forEach(function(m){m.syn.forEach(function(rec){rec.forEach(function(p){p.forEach(function(pid){if(byId[pid]){(REV[pid]=REV[pid]||{})[m.id]=1}})})})});
function revHTML(m){
  var ids=Object.keys(REV[m.id]||{}).map(function(i){return byId[i]}).sort(function(a,b){return a.no-b.no});
  if(!ids.length)return '<p class="sub">Ce monstre n\'entre dans aucune recette connue.</p>';
  return '<div class="rev">'+ids.slice(0,16).map(function(r){return mchip(r.id)}).join("")+'</div>'+(ids.length>16?'<div class="legend">+ '+(ids.length-16)+' autres : voir l\'onglet Synthèse.</div>':"");
}
var maxStat=[0,0,0,0,0,0];
M.forEach(function(m){for(var k=0;k<6;k++){if(typeof m.s[k]==="number"&&m.s[k]>maxStat[k])maxStat[k]=m.s[k]}});

/* searchable entries per monster */
M.forEach(function(m){
  var E=[];
  m.ta.forEach(function(t){
    var k=K[t[0]];E.push(["Talent",k.n,k.e]);
    k.a.forEach(function(a){var x=A[a[0]];E.push(["Compétence",x[0],x[2]])});
  });
  m.tr.forEach(function(t){var x=T[t[2]];E.push(["Trait",x[0],x[2]])});
  m.lo.forEach(function(l){E.push(["Lieu",P[l[0]],l[0]])});
  m.it.forEach(function(n){var x=I[n];E.push(["Objet",x[0],x[2]])});
  m.E=E.map(function(e){return [e[0],e[1],norm(e[1]+" "+e[2])]});
  m.nn=norm(m.n+" "+m.e+" #"+m.no+" ");
  m.blob=m.nn+" "+norm(m.f+" rang "+m.r+" ")+m.E.map(function(e){return e[2]}).join(" | ");
  m.tot=typeof m.s[6]==="number"?m.s[6]:0;
});

/* state */
var own={},fnd={};
var LS="dqm3-carnet-v1";
function lsRead(){try{var v=localStorage.getItem(LS);return v?JSON.parse(v):null}catch(e){return null}}
function lsWrite(o){try{localStorage.setItem(LS,JSON.stringify(o))}catch(e){}}
function setFrom(o){own={};fnd={};if(!o)return;(o.o||[]).forEach(function(id){if(byId[id])own[id]=1});(o.f||[]).forEach(function(id){if(byId[id])fnd[id]=1})}
function snapshotObj(){return {o:Object.keys(own).sort(),f:Object.keys(fnd).sort()}}
setFrom(lsRead());

var ref=null,saveTimer=null;
function setSync(k){
  var t={ok:"Avancement enregistré sur ton compte.",saving:"Enregistrement…",local:"Enregistrement dans ce navigateur (non synchronisé)."}[k];
  document.getElementById("sync").textContent=t;
}
function save(){
  var o=snapshotObj();lsWrite(o);
  if(!ref){return}
  setSync("saving");
  clearTimeout(saveTimer);
  saveTimer=setTimeout(function(){
    saveTimer=null;
    var o2=snapshotObj();
    ref.set({o:o2.o,f:o2.f,t:Date.now()}).then(function(){setSync("ok")},function(){setSync("local")});
  },500);
}
function initCloud(){
  if(!window.claude||!window.claude.use)return;
  Promise.all([window.claude.use("db"),window.claude.use("user")]).then(function(r){
    var db=r[0],user=r[1];if(!db||!user)return null;
    return user.id().then(function(uid){
      if(!uid)return;
      ref=db.doc("data/users/"+uid+"/tracker");
      ref.onSnapshot(function(snap){
        if(snap.metadata&&snap.metadata.hasPendingWrites)return;
        if(saveTimer)return;
        if(snap.exists){
          var d=snap.data()||{};
          var before=JSON.stringify(snapshotObj());
          setFrom(d);
          if(JSON.stringify(snapshotObj())!==before){lsWrite(snapshotObj());syncDom()}
          setSync("ok");
        }else{
          var o=snapshotObj();
          if(o.o.length||o.f.length){ref.set({o:o.o,f:o.f,t:Date.now()}).then(function(){setSync("ok")},function(){setSync("local")})}
          else setSync("ok");
        }
      },function(){setSync("local")});
    });
  }).catch(function(){setSync("local")});
}

/* synthesis feasibility */
function ownedList(){return Object.keys(own)}
function parentCands(pid,ol){
  var g=/^(slime|dragon|beast|nature|material|demon|undead|boss)-(any|[a-z])$/.exec(pid);
  if(!g){return own[pid]?[pid]:[]}
  var fam=KEYFAM[g[1]],rk=g[2]==="any"?null:g[2].toUpperCase();
  return ol.filter(function(id){var m=byId[id];return m.f===fam&&(!rk||m.r===rk)});
}
function pairOk(p,ol){
  var a=parentCands(p[0],ol),b=parentCands(p[1],ol);
  if(!a.length||!b.length)return false;
  if(a.length===1&&b.length===1&&a[0]===b[0])return false;
  return true;
}
function synPossible(m){
  if(own[m.id]||!m.syn.length)return false;
  var ol=ownedList();if(ol.length<2)return false;
  return m.syn.some(function(rec){return rec.every(function(p){return pairOk(p,ol)})});
}
function parentLabel(pid){
  if(byId[pid])return byId[pid].n;
  var g=/^(slime|dragon|beast|nature|material|demon|undead|boss)-(any|[a-z])$/.exec(pid);
  if(g)return "Famille "+KEYFAM[g[1]]+(g[2]==="any"?" (tout rang)":" rang "+g[2].toUpperCase());
  return pid;
}

/* filters */
var F={q:"",fam:{},rank:{},st:"all",sc:"all",so:"no"};
var open={};
var listEl=document.getElementById("list");

function matches(m,toks,ol){
  for(var i=0;i<toks.length;i++){if(m.blob.indexOf(toks[i])<0)return false}
  if(Object.keys(F.fam).length&&!F.fam[m.f])return false;
  if(Object.keys(F.rank).length&&!F.rank[m.r])return false;
  if(F.sc!=="all"&&String(m.sc)!==F.sc)return false;
  switch(F.st){
    case "own":if(!own[m.id])return false;break;
    case "miss":if(own[m.id])return false;break;
    case "syn":if(!synPossible(m))return false;break;
  }
  return true;
}
function sorter(){
  var rk=function(m){return RANKS.indexOf(m.r)};
  switch(F.so){
    case "name":return function(a,b){return a.n.localeCompare(b.n,"fr")};
    case "rank":return function(a,b){return rk(a)-rk(b)||a.no-b.no};
    case "rankd":return function(a,b){return rk(b)-rk(a)||a.no-b.no};
    case "tot":return function(a,b){return b.tot-a.tot};
    case "fam":return function(a,b){return FAMS.indexOf(a.f)-FAMS.indexOf(b.f)||a.no-b.no};
    default:return function(a,b){return a.no-b.no||a.i-b.i};
  }
}
function hitLine(m,toks){
  var out=[];
  toks.forEach(function(t){
    if(m.nn.indexOf(t)>=0)return;
    for(var i=0;i<m.E.length&&out.length<4;i++){
      var e=m.E[i];
      if(e[2].indexOf(t)>=0){var s=e[0]+" « "+e[1]+" »";if(out.indexOf(s)<0)out.push(s);break}
    }
  });
  return out.length?"Correspond : "+out.join(" · "):"";
}

function rowHTML(m,toks,synP){
  var hit=toks.length?hitLine(m,toks):"";
  var isO=!!own[m.id];
  var op=!!open[m.id];
  return '<article class="mon'+(isO?" is-own":"")+'" data-id="'+esc(m.id)+'" style="--fc:var(--f-'+FKEY[m.f]+')">'+
  '<div class="row">'+
    '<span class="sp tile" role="img" aria-label="'+esc(m.n)+'" style="'+spStyle(m.id,.7467)+'"></span>'+
    '<div><div class="nm">'+esc(m.n)+'</div>'+
      '<div class="sub">N° '+esc(m.no)+(m.e!==m.n?' · '+esc(m.e):'')+' · '+esc(m.f)+' · rang '+esc(m.r)+
      (synP?' <span class="badge syn" data-syn>Synthèse possible</span>':'<span class="badge syn" data-syn hidden>Synthèse possible</span>')+'</div>'+
      (hit?'<div class="hit">'+esc(hit)+'</div>':'')+
    '</div>'+
    '<div class="stat"><span class="rk'+(m.r==="S"||m.r==="X"?" hi":"")+'">'+esc(m.r)+'</span><small>Total '+esc(m.s[6])+'</small></div>'+
    '<div class="marks">'+
      '<label class="mk o"><input type="checkbox" data-k="o" aria-label="Possédé : '+esc(m.n)+'"'+(isO?" checked":"")+'><span>Possédé</span></label>'+
    '</div>'+
    '<button type="button" class="more" data-more aria-expanded="'+(op?"true":"false")+'">Détails</button>'+
  '</div>'+(op?detailHTML(m):"")+'</article>';
}

function render(){
  var phrase=norm(F.q).replace(/\s+/g," ").trim();
  var toks=phrase?phrase.split(" "):[];
  var ol=ownedList();
  var rows=[];
  if(toks.length>1){
    rows=M.filter(function(m){return matches(m,[phrase],ol)});
    if(rows.length)toks=[phrase];
  }
  if(!rows.length)rows=M.filter(function(m){return matches(m,toks,ol)});
  rows.sort(sorter());
  var synCache={};
  listEl.innerHTML=rows.length?rows.map(function(m){return rowHTML(m,toks,F.st==="syn"?true:synPossible(m))}).join(""):
    '<div class="empty">Aucun monstre ne correspond. Essaie un autre mot ou retire un filtre.</div>';
  document.getElementById("cnt").textContent=rows.length+" monstre"+(rows.length>1?"s":"")+" affiché"+(rows.length>1?"s":"");
  var active=F.q||Object.keys(F.fam).length||Object.keys(F.rank).length||F.st!=="all"||F.sc!=="all";
  document.getElementById("reset").hidden=!active;
  document.getElementById("qx").hidden=!F.q;
}

/* detail */
function bars(m){
  var h='<div class="bars">';
  for(var k=0;k<6;k++){
    var v=m.s[k],w=typeof v==="number"&&maxStat[k]?Math.round(v/maxStat[k]*100):0;
    h+='<div class="bl"><span>'+STATN[k]+'</span><b>'+esc(v)+'</b><div class="bar"><i style="width:'+w+'%"></i></div></div>';
  }
  return h+'</div><div class="facts"><span><b>Total</b> '+esc(m.s[6])+'</span><span><b>Œuf</b> '+(m.egg?esc(m.egg):"aucun")+'</span><span><b>Recrutable dans la nature</b> '+(m.sc?"oui":"non")+'</span></div>';
}
function resHTML(m){
  var el=[],st=[];
  m.res.forEach(function(r){
    var v=r[1],c=v<0?"w":v>=100?"i":v>0?"s":"";
    var lab=v<0?"faible":v>=100?"immunisé":v>0?"résiste":"";
    var h='<span class="rs '+c+'" title="'+(lab||"normal")+'">'+esc(r[0])+" "+(v>0?"+":"")+v+"%</span>";
    (ELEM.indexOf(r[0])>=0?el:st).push(h);
  });
  return '<div class="res">'+el.join("")+'</div><div class="res" style="margin-top:8px">'+st.join("")+'</div>'+
    '<div class="legend">Valeur positive : le monstre résiste. Valeur négative : il est faible face à cet élément ou ce statut.</div>';
}
function talHTML(m){
  if(!m.ta.length)return '<p class="sub">Aucun talent.</p>';
  return m.ta.map(function(t,i){
    var k=K[t[0]];
    var badge=t[1]==="P"?' <span class="badge">principal</span>':t[1]==="W"?' <span class="badge">monstre sauvage seulement</span>':'';
    var ab=k.a.map(function(a){var x=A[a[0]];
      return '<div class="pt">'+a[1]+' pts</div><div><span class="nn">'+esc(x[0])+'</span>'+(x[2]!==x[0]?' <span class="en2">'+esc(x[2])+'</span>':'')+(x[3]?' <span class="mp">'+esc(x[3])+'</span>':'')+'<span class="dd">'+esc(x[1])+'</span></div>';
    }).join("");
    return '<details class="tal"'+(i===0?" open":"")+'><summary><span>'+esc(k.n)+'</span>'+(k.e!==k.n?'<span class="en">'+esc(k.e)+'</span>':'')+badge+'</summary><div class="ab">'+ab+'</div></details>';
  }).join("");
}
function trHTML(m){
  return m.tr.map(function(t){var x=T[t[2]];
    return '<div class="tr"><span class="sz" title="'+(t[0]==="S"?"Petit":"Grand")+'">'+esc(t[0])+'</span><span class="lv">Niv. '+t[1]+'</span><span><b>'+esc(x[0])+'</b> <span class="en2">'+esc(x[2])+'</span></span><span class="dd">'+esc(x[1])+'</span></div>';
  }).join("")||'<p class="sub">Aucun trait.</p>';
}
function locHTML(m){
  if(!m.lo.length)return '<p class="sub">'+(m.sc?"Lieu non renseigné.":"Pas recrutable dans la nature : s'obtient par synthèse ou événement.")+'</p>';
  return m.lo.map(function(l){
    var s=l[2].map(function(w,i){
      var none=!w[0]&&!w[1];
      return '<div class="'+(none?"none":"")+'"><span>'+SEAS[i]+'</span>'+(none?'<span>–</span>':'<span class="wx">'+(w[0]?'<svg role="img" aria-label="Temps clair"><title>Temps clair</title><use href="#sun"/></svg>':'')+(w[1]?'<svg role="img" aria-label="Précipitations"><title>Précipitations</title><use href="#rain"/></svg>':'')+'</span>')+'</div>';
    }).join("");
    return '<div class="loc"><span class="pn">'+esc(P[l[0]])+'</span>'+(l[1]?' <span class="badge">mini-boss</span>':'')+'<div class="seasons">'+s+'</div></div>';
  }).join("")+'<div class="legend">Soleil : temps clair. Nuage : précipitations. Un tiret : absent à cette saison.</div>';
}
function parChip(pid){
  if(byId[pid]){var h=!!own[pid];return '<button type="button" class="par'+(h?" have":"")+'" data-go="'+esc(pid)+'" data-pid="'+esc(pid)+'" title="Voir ce monstre"><span class="ck">'+(h?"✓ ":"")+'</span><span class="sp" style="'+spStyle(pid,.3)+'"></span>'+esc(byId[pid].n)+'</button>'}
  return '<span class="par gen">'+esc(parentLabel(pid))+'</span>';
}
function synHTML(m){
  if(!m.syn.length)return '<p class="sub">Aucune synthèse connue pour ce monstre.</p>';
  return m.syn.map(function(rec,i){
    var h=rec.map(function(p){return '<span class="pc">'+parChip(p[0])+'<span class="op">+</span>'+parChip(p[1])+'</span>'}).join('<span class="op">et</span>');
    return '<div class="rec">'+(i?'<span class="op">ou</span>':'')+h+'</div>';
  }).join("")+(m.syn.some(function(r){return r.length>1})?'<div class="legend">« et » : synthèse à quatre monstres, il faut les deux paires.</div>':'');
}
function itemHTML(m){
  if(!m.it.length)return '<p class="sub">Aucun objet.</p>';
  return m.it.map(function(n){var x=I[n];
    return '<div class="item"><span><b>'+esc(x[0])+'</b> <span class="en2">'+esc(x[2])+' · '+(x[3]==="Rare"?"rare":"normal")+'</span></span><span class="dd">'+esc(x[1])+'</span></div>';
  }).join("");
}
function detailHTML(m){
  return '<div class="detail">'+
   '<div class="col"><section class="sec"><h3>Talents et <em>compétences</em></h3>'+talHTML(m)+'</section>'+
   '<section class="sec"><h3>Traits</h3>'+trHTML(m)+'</section></div>'+
   '<div class="col"><section class="sec"><h3>Statistiques max</h3>'+bars(m)+'</section>'+
   '<section class="sec"><h3>Où le trouver</h3>'+locHTML(m)+'</section>'+
   '<section class="sec"><h3>Synthèse</h3>'+synHTML(m)+'</section>'+
   '<section class="sec"><h3>Sert à fabriquer</h3>'+revHTML(m)+'</section>'+
   '<section class="sec"><h3>Résistances</h3>'+resHTML(m)+'</section>'+
   '<section class="sec"><h3>Objets</h3>'+itemHTML(m)+'</section></div></div>';
}

/* meters, in-place updates */
function counts(){
  var o=Object.keys(own).length;
  var n=M.length;
  document.getElementById("n-own").textContent=o+" / "+n;
  document.getElementById("b-own").style.width=(o/n*100)+"%";
  var per={};FAMS.forEach(function(x){per[x]=[0,0]});
  M.forEach(function(m){per[m.f][1]++;if(own[m.id])per[m.f][0]++});
  document.querySelectorAll("[data-famc]").forEach(function(el){var p=per[el.getAttribute("data-famc")];el.textContent=p[0]+"/"+p[1]});
}
function refreshRow(art){
  var id=art.getAttribute("data-id"),m=byId[id];
  art.classList.toggle("is-own",!!own[id]);
  var o=art.querySelector('input[data-k="o"]');
  if(o)o.checked=!!own[id];
}
function refreshBadges(){
  var ol=ownedList();
  listEl.querySelectorAll(".mon").forEach(function(art){
    var m=byId[art.getAttribute("data-id")],b=art.querySelector("[data-syn]");
    if(b)b.hidden=!synPossible(m);
  });
  listEl.querySelectorAll("[data-pid]").forEach(function(el){
    var h=!!own[el.getAttribute("data-pid")],ck=el.querySelector(".ck");
    el.classList.toggle("have",h);if(ck)ck.textContent=h?"✓ ":"";
  });
}
function syncDom(){
  listEl.querySelectorAll(".mon").forEach(refreshRow);
  counts();refreshBadges();
  if(view==="syn")renderSyn();
}

/* events */
listEl.addEventListener("change",function(e){
  var inp=e.target;if(!inp.matches||!inp.matches("input[data-k]"))return;
  var art=inp.closest(".mon"),id=art.getAttribute("data-id"),k=inp.getAttribute("data-k");
  if(inp.checked)own[id]=1;else delete own[id];
  refreshRow(art);counts();refreshBadges();save();
});
listEl.addEventListener("click",function(e){
  var b=e.target.closest("[data-more]");
  if(b){
    var art=b.closest(".mon"),id=art.getAttribute("data-id"),m=byId[id];
    var isOpen=!open[id];open[id]=isOpen;
    b.setAttribute("aria-expanded",isOpen?"true":"false");
    var d=art.querySelector(".detail");
    if(isOpen&&!d)art.insertAdjacentHTML("beforeend",detailHTML(m));
    else if(!isOpen&&d)d.remove();
    return;
  }
  var g=e.target.closest("[data-go]");
  if(g){goTo(g.getAttribute("data-go"))}
});
var qEl=document.getElementById("q"),tmr=null;
qEl.addEventListener("input",function(){F.q=qEl.value;clearTimeout(tmr);tmr=setTimeout(render,120)});
document.getElementById("qx").addEventListener("click",function(){qEl.value="";F.q="";render();qEl.focus()});
["st","sc","so"].forEach(function(id){document.getElementById(id).addEventListener("change",function(e){F[id]=e.target.value;render()})});
function resetFilters(doRender){
  F={q:"",fam:{},rank:{},st:"all",sc:"all",so:F.so};
  qEl.value="";document.getElementById("st").value="all";document.getElementById("sc").value="all";
  document.querySelectorAll(".chip").forEach(function(c){c.setAttribute("aria-pressed","false")});
  if(doRender!==false)render();
}
document.getElementById("reset").addEventListener("click",function(){resetFilters()});

/* chips */
var famsEl=document.getElementById("fams"),ranksEl=document.getElementById("ranks");
famsEl.innerHTML=FAMS.map(function(f){return '<button type="button" class="chip" aria-pressed="false" data-fam="'+esc(f)+'" style="--fc:var(--f-'+FKEY[f]+')"><span class="dot"></span>'+esc(f)+' <small data-famc="'+esc(f)+'"></small></button>'}).join("");
ranksEl.innerHTML=RANKS.map(function(r){return '<button type="button" class="chip" aria-pressed="false" data-rank="'+r+'">'+r+'</button>'}).join("");
famsEl.addEventListener("click",function(e){var c=e.target.closest("[data-fam]");if(!c)return;var f=c.getAttribute("data-fam");if(F.fam[f])delete F.fam[f];else F.fam[f]=1;c.setAttribute("aria-pressed",F.fam[f]?"true":"false");render()});
ranksEl.addEventListener("click",function(e){var c=e.target.closest("[data-rank]");if(!c)return;var f=c.getAttribute("data-rank");if(F.rank[f])delete F.rank[f];else F.rank[f]=1;c.setAttribute("aria-pressed",F.rank[f]?"true":"false");render()});

/* ---- synthesis calculator ---- */
var view="carnet",mode="fuse",showAllFuse=false,showAllCan=false;
var vC=document.getElementById("view-carnet"),vS=document.getElementById("view-syn"),vT=document.getElementById("view-tips"),vL=document.getElementById("view-tal");
var GENRE=/^(slime|dragon|beast|nature|material|demon|undead|boss)-(any|[a-z])$/;

function showView(v){
  view=v;vC.hidden=v!=="carnet";vS.hidden=v!=="syn";vT.hidden=v!=="tips";vL.hidden=v!=="tal";
  ["carnet","syn","tal","tips"].forEach(function(k){document.getElementById("tab-"+k).setAttribute("aria-selected",k===v?"true":"false")});
  if(v==="syn")renderSyn();
  if(v==="tips"&&!tipsDone)buildTips();
  if(v==="tal")renderTal();
}

/* ---- talents ---- */
var W=D.W||[],tlOpen={},tlMine=false,talMons=null;
function talIndex(){
  if(talMons)return;talMons={};
  M.forEach(function(m){(m.ta||[]).forEach(function(t){(talMons[t[0]]=talMons[t[0]]||[]).push(m.id)})});
}
function renderTal(){
  talIndex();
  var q=norm(document.getElementById("tlq").value).trim(),out=[],n=0;
  W.slice().sort(function(a,b){return a.n.localeCompare(b.n,"fr")}).forEach(function(t){
    var ids=talMons[t.e]||[];
    if(tlMine&&!ids.some(function(i){return own[i]}))return;
    if(q){
      var hay=norm([t.n,t.al||"",t.e].concat(t.r.map(function(r){return r[1]})).concat(ids.map(function(i){return byId[i].n})).join(" "));
      if(hay.indexOf(q)<0)return;
    }
    n++;var op=!!tlOpen[t.e];
    var chips=ids.slice(0,op?999:8).map(function(i){var h=!!own[i];return '<button type="button" class="par'+(h?" have":"")+'" data-go="'+esc(i)+'">'+(h?'<span class="ck">✓ </span>':'')+sprite(i,24)+esc(byId[i].n)+'</button>'}).join("");
    if(!op&&ids.length>8)chips+='<span class="none">+ '+(ids.length-8)+' autres</span>';
    var rows=t.r.length?'<table><tr><th>Pts</th><th>Aptitude</th><th>Effet</th></tr>'+t.r.map(function(r){return '<tr><td>'+r[0]+'</td><td>'+esc(r[1])+'</td><td>'+esc(r[2]||"")+'</td></tr>'}).join("")+'</table>':'';
    out.push('<article class="tl'+(op?" op":"")+'"><h3>'+esc(t.n)+(t.ok?'<span class="ok" title="Nom officiel du wiki">officiel</span>':'')+'<span class="en">'+esc(t.e)+(t.al?' · aussi « '+esc(t.al)+' »':'')+'</span></h3>'+
      (ids.length?'<div class="mons">'+chips+'</div>':'<p class="none">'+(t.eg?'Aucun monstre naturellement, mais disponible dans les œufs dorés.':'Aucun monstre ne l\'a naturellement (il s\'obtient autrement).')+'</p>')+
      (op?rows:'')+
      '<button type="button" class="tgl" data-tl="'+esc(t.e)+'">'+(op?'Réduire':'Voir les '+t.r.length+' aptitudes')+'</button></article>');
  });
  document.getElementById("tl-count").textContent=n+" talent"+(n>1?"s":"");
  document.getElementById("tl-body").innerHTML=out.join("")||'<p class="none">Aucun résultat.</p>';
}
(function(){
  var b=document.getElementById("tl-body"),qi=document.getElementById("tlq"),tm=null;
  b.addEventListener("click",function(e){
    var g=e.target.closest("[data-go]");if(g){goTo(g.getAttribute("data-go"));return}
    var t=e.target.closest("[data-tl]");if(t){var k=t.getAttribute("data-tl");tlOpen[k]=!tlOpen[k];renderTal()}
  });
  qi.addEventListener("input",function(){clearTimeout(tm);tm=setTimeout(renderTal,150)});
  document.getElementById("tl-mine").addEventListener("click",function(){tlMine=!tlMine;this.setAttribute("aria-pressed",tlMine?"true":"false");renderTal()});
})();
function goTo(id){
  showView("carnet");
  resetFilters(false);F.q=byId[id].n;open[id]=true;
  document.getElementById("q").value=F.q;
  render();window.scrollTo({top:0,behavior:"smooth"});
}
function sprite(id,size){return '<span class="sp" style="'+spStyle(id,size/75)+'"></span>'}
function specOk(s,id){
  if(s===id)return true;
  if(byId[s])return false;
  var g=GENRE.exec(s);if(!g)return false;
  var m=byId[id];
  return m.f===KEYFAM[g[1]]&&(g[2]==="any"||m.r===g[2].toUpperCase());
}
function matchPair(g,a,b){return (specOk(g[0],a)&&specOk(g[1],b))||(specOk(g[0],b)&&specOk(g[1],a))}
function resolve(v){
  var q=norm(v).trim();if(!q)return null;
  var ex=M.filter(function(m){return norm(m.n)===q||norm(m.e)===q});
  if(ex.length)return ex[0];
  var st=M.filter(function(m){return norm(m.n).indexOf(q)===0||norm(m.e).indexOf(q)===0});
  return st.length===1?st[0]:null;
}
function mchip(id){
  var m=byId[id];if(!m)return specChip(id);
  var h=!!own[id];
  return '<button type="button" class="mchip'+(h?" have":"")+'" data-go="'+esc(id)+'" title="Ouvrir dans le carnet">'+sprite(id,30)+'<span class="mn">'+(h?"✓ ":"")+esc(m.n)+'</span><small>'+esc(m.r)+'</small></button>';
}
function specChip(pid){
  if(byId[pid])return mchip(pid);
  var c=parentCands(pid,ownedList()).slice(0,3).map(function(i){return byId[i].n});
  return '<span class="mchip gen"><span>'+esc(parentLabel(pid))+'</span>'+(c.length?'<small class="cand">tu as : '+esc(c.join(", "))+'</small>':'')+'</span>';
}
function ownBtn(id,mini){
  var h=!!own[id];
  return '<button type="button" class="ownbtn'+(mini?" mini":"")+(h?" on":"")+'" data-own="'+esc(id)+'" aria-pressed="'+(h?"true":"false")+'">'+(h?"✓ Possédé":"Je l'ai obtenu")+'</button>';
}
function toggleOwn(id){
  if(own[id])delete own[id];else own[id]=1;
  var h=!!own[id];
  vS.querySelectorAll("[data-own]").forEach(function(b){
    if(b.getAttribute("data-own")!==id)return;
    b.classList.toggle("on",h);b.textContent=h?"✓ Possédé":"Je l'ai obtenu";b.setAttribute("aria-pressed",h?"true":"false");
  });
  vS.querySelectorAll("[data-go]").forEach(function(c){
    if(c.getAttribute("data-go")!==id)return;
    c.classList.toggle("have",h);var n=c.querySelector(".mn");if(n)n.textContent=(h?"✓ ":"")+byId[id].n;
  });
  listEl.querySelectorAll(".mon").forEach(refreshRow);
  var pc=document.getElementById("plan-count");
  if(pc&&mode==="plan"){var tt=resolve(document.getElementById("pt").value);if(tt)pc.innerHTML=planCount(tt)}
  counts();refreshBadges();save();
}
function recLine(g){return '<span class="mini">'+specChip(g[0])+'<span class="op">+</span>'+specChip(g[1])+'</span>'}
function synRow(m,rec,gi,ok,parents){
  var h=recLine(rec[gi]);
  if(rec.length>1)h+='<span class="op">et</span>'+recLine(rec[1-gi]);
  return '<div class="srow'+(ok?" ok":"")+'">'+h+'<span class="arw">→</span>'+mchip(m.id)+(rec.length===1?ownBtn(m.id)+doBtn(m.id,parents):"")+(rec.length>1?'<span class="op">(4 monstres : deux fusions, puis leurs résultats)</span>':'')+'</div>';
}

/* ---- fusion done: result owned, parents consumed, undo ---- */
var snapUndo=null,toastT=null,toastEl=document.getElementById("toast");
function toast(html,undo){
  toastEl.innerHTML='<span>'+html+'</span>'+(undo?'<button type="button" data-undo>Annuler</button>':'');
  toastEl.hidden=false;clearTimeout(toastT);toastT=setTimeout(function(){toastEl.hidden=true},12000);
}
function doBtn(id,parents){
  if(!parents||!parents.length)return "";
  return '<button type="button" class="ownbtn do" data-fuse="'+esc(id)+'" data-parents="'+esc(parents.join(","))+'" title="Ajoute le petit à tes monstres et retire les parents, qui disparaissent en jeu">Fusion faite : retirer les parents</button>';
}
function applyFusion(id,parents){
  snapUndo=Object.assign({},own);
  var gone=[];
  parents.forEach(function(p){if(p!==id&&own[p]&&byId[p]){delete own[p];gone.push(byId[p].n)}});
  own[id]=1;
  save();syncDom();
  toast('<b>'+esc(byId[id].n)+'</b> ajouté'+(gone.length?" ; retiré : "+esc(gone.join(", ")):"")+'.',true);
}
toastEl.addEventListener("click",function(e){
  if(!e.target.closest("[data-undo]")||!snapUndo)return;
  own=snapUndo;snapUndo=null;toastEl.hidden=true;save();syncDom();
});
function planCount(t){
  if(!t.syn.length)return "";
  var ol=ownedList(),n=t.syn.length,k=t.syn.filter(function(rec){return rec.every(function(g){return pairOk(g,ol)})}).length;
  return n+" recette"+(n>1?"s":"")+(k?", dont <b>"+k+" faisable"+(k>1?"s":"")+"</b> avec tes monstres":", aucune faisable avec tes monstres pour l'instant");
}

/* ---- Astuces tab ---- */
var byEN={};M.forEach(function(m){byEN[m.e.toLowerCase()]=m});
function nameTok(s){return s.replace(/\{\{(?:([KATN]):)?([^}]+)\}\}/g,function(_,k,n){
  var f=null;
  if(!k){var m=byEN[n.toLowerCase()];f=m&&m.n}
  else if(k==="N"){var mm=M.filter(function(x){return String(x.no)===n})[0];f=mm&&mm.n}
  else if(k==="K"){var wk=W.filter(function(x){return x.e===n})[0];f=(wk&&wk.n)||(K[n]&&K[n].n)}
  else if(k==="A"){f=A[n]&&A[n][0]}
  else{f=T[n]&&T[n][0]}
  return f?'<b class="mref">'+esc(f)+'</b>':esc(n)});
}
var G8="https://game8.co/games/DQM-Dark-Prince/archives/";
var SRC={
 lvl:["Game8, monter de niveau vite",G8+"435933"],exp:["Game8, système d'EXP",G8+"439316"],
 beg8:["Game8, 8 conseils de début",G8+"438901"],tip9:["Game8, 9 astuces",G8+"436646"],
 tp:["Game8, points de talent",G8+"436710"],stats:["Game8, augmenter les stats",G8+"438970"],
 sc:["Game8, recruter après un combat",G8+"439310"],seed:["Game8, farmer les graines",G8+"439321"],
 metal:["Game8, farm des gluants de métal",G8+"436061"],gold:["Game8, gagner de l'or",G8+"438909"],
 syn:["Samurai Gamers, synthèse","https://samurai-gamers.com/dragon-quest-monsters-the-dark-prince/synthesis-guide/"],
 syn4:["Samurai Gamers, synthèse à quatre","https://samurai-gamers.com/dragon-quest-monsters-the-dark-prince/four-monster-synthesis-guide/"],
 eggs:["Game8, farmer les œufs et lieux",G8+"435956"],
 bt:["Game8, meilleurs talents (histoire et PvP)",G8+"436660"],btier:["Game8, tier list des talents",G8+"436680"],bpg:["ProGameGuides, meilleurs talents","https://progameguides.com/dragon-quest-monsters/best-talents-in-dragon-quest-monsters-the-dark-prince/"],bex:["Game8, points de talent (exemples de builds)",G8+"436710"],
 shiny:["GamerBraves, brillants","https://www.gamerbraves.com/guide-dragon-quest-monsters-the-dark-prince-shiny-monsters-and-why-they-matter/"]
};
var CATS=["Débuter","Progresser","Recruter","Synthèse","Œufs","Builds","Combat","Argent"];
var TIPS=[
 {c:"Débuter",t:"Les premiers pas",open:true,src:["beg8","tip9"],li:[
  "Les lieux à connaître : le <b>Paddock</b> (choisir son équipe), la <b>Tour de RoseColine</b> (restaure PV et PM, et l'autel de synthèse est au sous-sol), les auberges, la boutique et la banque.",
  "Le menu principal permet de changer l'équipe et la réserve, d'utiliser des objets, d'équiper des accessoires, de régler les tactiques de combat automatique et de distribuer les points de talent.",
  "Le <b>Zoom</b> (voyage rapide) ramène à n'importe quel lieu débloqué : utilise-le pour éviter les allers-retours.",
  "Les stats : la plus haute entre <b>attaque et sagesse</b> décide du taux de recrutement ; l'agilité règle l'ordre des tours et l'esquive ; la défense réduit les dégâts physiques ; la sagesse renforce sorts et soins.",
  "Perdre deux parents pour un petit vaut le coup dès le <b>niveau 10</b> : le petit a des stats et des points de talent bien supérieurs.",
  "Les points de talent arrivent à des niveaux fixes (3, 5, 7, 9, 12, 14, 17, 20) : monte tes monstres jusqu'à un palier <b>avant</b> de les fusionner."]},
 {c:"Progresser",t:"Monter de niveau vite",src:["lvl","exp"],li:[
  "<b>Début de partie :</b> utilise des monstres à attaque de zone pour éliminer les petits ennemis en un coup. Cercle du Courroux, échelon inférieur (niveau conseillé 10) : environ 80 à 150 EXP par combat. Cercle de la Gourmandise, échelon inférieur (niveau 14) : environ 200 à 300 EXP.",
  "Monstres conseillés : {{Raptile}} et {{Drake Slime}} (talent {{K:Shallow Breather}}), {{Jargon}} ({{K:Blazer}}), {{Powie Yowie}} ({{K:Chilly Receptionist}}), {{Cannonbrawler}} et {{Dessert Demon}} ({{K:Bang Afficionado}}).",
  "<b>Milieu de partie :</b> les gluants de métal ({{Metal Slime}} et ses variantes) apparaissent rarement à partir de l'échelon intermédiaire, niveau conseillé 20 à 50. Compte environ <b>5 000 à 15 000 EXP</b> par gluant, de plus en plus en avançant.",
  "<b>Fin de partie :</b> le {{Metal King Slime}} (échelon supérieur) rapporte environ <b>4,8 millions d'EXP</b> selon le guide (un commentaire conteste ce chiffre). Son apparition n'est pas garantie : prévois du temps.",
  "<b>Partage de l'EXP :</b> l'équipe active reçoit l'EXP complète, la réserve la <b>moitié</b>, les monstres du garde-monstres le <b>quart</b> (ils montent de niveau sans être dans l'équipe). Un monstre K.O. à la fin du combat ne reçoit rien : ranime-le avant la fin.",
  "<b>Boosts d'EXP :</b> la <i>Bonus Ball</i> (×1,5 EXP et or pendant 10 combats) et la <i>Bumper Bonus Ball</i> (×2 pendant 25 combats) viennent des arènes, des coffres, des bonus de précommande ou des DLC. Côté accessoires : <i>Cupcake Cane</i> ×1,1 (objet d'histoire, Cercle de la Gourmandise intermédiaire), <i>Trainee's Badge</i> ×1,3 (Classe B du Maulosseum), <i>Trainee's Medal</i> ×1,5 (Classe S). Seul l'accessoire le plus fort compte, et les bonus des objets et des accessoires s'additionnent (noms anglais des guides).",
  "Utilise ces boosts aussi dans les combats ordinaires : ils profitent à la réserve."]},
 {c:"Progresser",t:"Gluants de métal : où et comment",src:["metal"],li:[
  "{{Metal Slime}} : échelon intermédiaire ou plus, une fois le Diabolic Hall terminé. {{Liquid Metal Slime}} : échelon supérieur, après le Berceau de la Corruption (niveau intermédiaire). {{Metal King Slime}} : échelon supérieur, et <b>beaucoup plus fréquent après le boss secret</b>.",
  "Certains ne sortent qu'à une saison donnée : change de saison avec la Seasonal Flute (après la fin du jeu) ou la Seasonal Powder.",
  "Après chaque victoire, <b>voyage vers une autre zone</b> : ils ne réapparaissent pas au même endroit.",
  "Coupe la sauvegarde automatique et sauvegarde avant le combat. S'il s'enfuit, retourne au titre et recharge.",
  "Début : <i>Metal Slash</i> (dégâts garantis), {{A:Hatchet Man}} (coups critiques). Milieu (gluant de mercure) : les compétences « Ultra rusé » baissent la défense d'un élément, puis attaque avec cet élément. Ces monstres gagnent le trait au niveau 20 : {{Liege Lizard}} ({{T:Ultra Crafty Frizzer}}), {{Archdemon}} ({{T:Ultra Crafty Banger}}), {{Wight King}} ({{T:Ultra Crafty Woosher}}), {{Snowbird}} ({{T:Ultra Crafty Cracker}}), {{Wrecktor}} ({{T:Ultra Crafty Zapper}}), {{Shadow Slime}} ({{T:Ultra Crafty Zammer}}).",
  "Fin : les monstres avec le trait {{T:Metal Beater}} ({{Overkilling Machine}}, {{Night Knight}}, {{Balhib}}) et la compétence {{A:Mercurial Thrust}}, qui permet d'agir en premier. Un monstre à très forte attaque peut aussi tuer un gluant de métal d'un coup.",
  "Un accessoire ×1,5 d'EXP (Training Medallion ou Trainee's Medal) rend la chasse bien plus rentable."]},
 {c:"Progresser",t:"Points de talent",src:["tp"],li:[
  "Source principale : le <b>niveau</b>. Aux niveaux 3, 5, 7, 12, 14, 17 et 20, un monstre à deux talents gagne 6 points (9 avec trois talents) ; au niveau 9, 8 points (12 avec trois talents). Total : <b>50</b> points à deux talents, <b>75</b> à trois talents.",
  "Les monstres à <b>trois talents</b> gagnent plus : on les obtient en synthétisant des monstres à deux talents.",
  "À la synthèse, le petit hérite de la <b>moitié</b> des points de ses parents, y compris les points non dépensés.",
  "<b>Astuce de re-synthèse :</b> après le niveau 20, refais une synthèse. Le monstre repasse au niveau 1 avec les points hérités, puis regagne les points de chaque palier.",
  "Une <b>Graine d'habileté</b> donne 3 points de talent (une super graine 10, noms à confirmer). Plafond : 999 points par monstre.",
  "Priorités : des <b>compétences utilisables</b> avant les bonus de stats ; les talents uniques ou évolués ; un talent « <b>Garde</b> » (sa dernière compétence, {{A:Castslasher}}, réduit de moitié le coût en PM) ; un talent « <b>Boost</b> » I à IV (attaque ou sagesse pour les attaquants, défense pour les soutiens).",
  "Construction type : un talent de spécialité + une Garde + un Boost. <b>Attaquant spécial :</b> {{K:Bang Afficionado}}, {{K:Zap Ward}}, Boost de sagesse II. <b>Attaquant physique :</b> {{K:Duelist}}, Boost d'attaque III, au choix. <b>Soigneur :</b> {{K:Paramedic}}, {{K:Crag Ward}}, Boost de sagesse III.",
  "<b>Talents évolués :</b> on évolue un talent en atteignant son maximum de points avec les points cumulés des deux parents (par exemple un parent à 100, ou 30 + 70)."]},
 {c:"Progresser",t:"Augmenter les stats",src:["stats","tip9"],li:[
  "Les talents <b>Boost</b> s'ajoutent à la limite de base de la stat : ils peuvent la dépasser.",
  "À la synthèse, les <b>limites de stats</b> dépendent des familles des six ancêtres. Les parents comptent <b>double</b> par rapport aux grands-parents. Avec quatre ancêtres de familles toutes différentes, toutes les limites montent, mais aucune n'est maximale.",
  "Des parents de <b>niveau 100</b> ajoutent 20 % de la limite de base : par exemple 1 500 PV → 1 800, et 500 → 600 pour les autres stats.",
  "Le petit démarre avec environ <b>un quart</b> de la somme des stats de ses parents : monte-les avant de les fusionner.",
  "Taille L : PV et PM ×1,5, autres stats ×1,1, mais toutes les limites tombent à 0,7 à 0,9 fois : le gain est souvent annulé. Un monstre L occupe deux places dans l'équipe.",
  "Les <b>graines</b> donnent +3 à une stat (+10 pour les super graines) sans dépasser la limite propre à chaque espèce.",
  "Les accessoires donnent des stats ; on en fabrique à l'établi du bricoleur (Tinkerer's Workbench)."]},
 {c:"Recruter",t:"Réussir un recrutement",src:["sc","beg8","tip9"],li:[
  "Compare l'<b>attaque</b> et la <b>sagesse</b> de ton monstre : c'est la plus haute qui compte, choisis l'action de recrutement qui y correspond.",
  "Donne de la <b>nourriture à base de viande</b> au monstre avant de finir le combat : tu peux en donner plusieurs pour un meilleur effet. Après la victoire, un monstre vaincu peut se relever et te rejoindre ; c'est une chance faible sans viande, mais un bon filet de secours.",
  "Les monstres forts sont difficiles à recruter normalement : la viande leur est surtout utile. Sans bonne viande, la <b>Viande mystère</b> est une option (le monstre n'a qu'une petite chance de la manger).",
  "Des renforts comme {{A:Oomph}} ou {{A:Ping}} aident. Si le recrutement échoue, vaincs le monstre.",
  "Un monstre <b>déjà recruté</b> est plus difficile à recruter à nouveau : pour avoir des doublons, la synthèse est plus efficace.",
  "Dans le DLC Mole Hole, on peut recruter de nouveau des monstres de haut rang, et la viande améliore encore les chances."]},
 {c:"Recruter",t:"Farmer des graines",src:["seed"],li:[
  "Méthode principale : <b>relâcher des monstres recrutés</b> au Paddock (auprès de Zachariah). La graine obtenue est aléatoire, et meilleure pour un monstre de haut niveau et de hautes stats : monte-les d'abord, car un monstre dans l'équipe gagne plus d'EXP qu'au Paddock.",
  "Où recruter pour ça : le DLC <b>Mole Hole</b> (Donnie Mole au Paddock) permet de recruter tous les monstres déjà rencontrés, même ceux que tu as seulement synthétisés. Sans le DLC, les <b>Circles of Nadiria</b> marchent, un peu moins efficacement. Passe au niveau suivant quand les doublons font baisser ton taux.",
  "On peut relâcher juste après un recrutement, mais seulement si l'équipe est pleine (8 monstres, actifs et réserve).",
  "Pour retenter : coupe la sauvegarde automatique, sauvegarde devant Zachariah, relâche, puis retourne au titre <b>sans sauvegarder</b>.",
  "Les coffres et les drops d'ennemis sont la méthode la moins rentable."]},
 {c:"Synthèse",t:"Les bases de la synthèse",
  flow:'<div class="flow"><span class="box">Parent 1</span><span class="op">+</span><span class="box">Parent 2</span><span class="arw">→</span><span class="box big">Petit<small>≈ ¼ des stats cumulées · ½ des points de talent de chaque parent · niveau 1</small></span></div>',
  src:["syn","tip9"],li:[
  "Les <b>deux parents</b> doivent être au <b>niveau 10 minimum</b>.",
  "Le petit reçoit environ <b>un quart des stats cumulées</b> des deux parents : de bons parents donnent un meilleur petit. Il <b>repart au niveau 1</b>.",
  "Il reçoit <b>la moitié des points de talent</b> accumulés par chaque parent. Exemple : parents à 60 et 100 points → 30 + 50 = 80 points.",
  "Il hérite des <b>talents des deux parents</b>, jusqu'à 3 pour les monstres de taille S et L.",
  "Deux parents de <b>même taille</b> donnent un petit de même taille. Un monstre qui a l'air petit mais qui est grand peut donner un grand petit avec un vrai grand.",
  "La <b>famille et la race</b> du petit dépendent de la combinaison des races des parents. Certaines recettes (cadre doré) donnent une race inattendue : le calculateur de l'onglet Synthèse les connaît.",
  "Les <b>parents disparaissent</b> après la synthèse. Dans le calculateur, le bouton « Fusion faite » retire les parents de ta liste et ajoute le petit, avec un bouton Annuler.",
  "Un guide dit « la moitié des stats de chaque parent », ce qui contredit le quart des stats cumulées des autres guides : je retiens le quart, à vérifier en jeu."]},
 {c:"Synthèse",t:"Talents évolués et spéciaux",src:["syn","tp"],li:[
  "Un parent qui a rempli un talent <b>au maximum</b> peut transmettre sa version évoluée.",
  "Si les deux parents ont le même talent et que leurs points cumulés atteignent le maximum, le petit peut obtenir la <b>version améliorée</b>.",
  "Certaines paires de talents, chacune au maximum chez les deux parents, donnent un <b>talent spécial</b>."]},
 {c:"Synthèse",t:"Synthèse à quatre monstres",
  flow:'<div class="flow"><span class="box">A + B</span><span class="arw">→</span><span class="box">Petit 1</span><span class="op">et</span><span class="box">C + D</span><span class="arw">→</span><span class="box">Petit 2</span><span class="arw">⇒</span><span class="box big">Petit 1 + Petit 2 → monstre visé</span></div>',
  src:["syn4"],li:[
  "Quatre « grands-parents » forment <b>deux paires</b>. Chaque paire donne un petit, puis les deux petits sont fusionnés pour obtenir le monstre voulu.",
  "La famille des grands-parents n'a pas d'importance, tant que la combinaison de monstres est la bonne.",
  "Parmi les monstres obtenus ainsi : {{Greater Platypink}}, {{Prism Peacock}}, {{Corvus}}, {{Hargon}}, {{Mortamor}}, {{Nimzo}}, {{Orgodemir}}, {{Psaro the Manslayer}} (rang S) ; {{Estark}}, {{Nokturnus}}, {{Ramia}}, {{Zoma}} (rang X).",
  "Les rangs S et X s'enchaînent : par exemple, {{Estark}} demande {{Psaro the Manslayer}} + {{Nimzo}} dans une de ses paires, et {{Nokturnus}} demande {{Mortamor}} + {{Ramia}}. Fabrique d'abord les ingrédients.",
  "Les <b>quatre</b> grands-parents sont consommés. Le mode « Obtenir un monstre » déplie toute la chaîne jusqu'aux monstres recrutables dans la nature."]},
 {c:"Synthèse",t:"Monstres brillants",src:["shiny","tip9"],li:[
  "Ils ne viennent que de la <b>synthèse</b> (environ 5 % de chance d'après un guide). Ils sont reconnaissables à leurs étoiles scintillantes.",
  "Le plafond d'<b>une stat tirée au hasard</b> (PV, PM, attaque, défense, agilité ou sagesse) augmente d'environ <b>100</b>.",
  "Le bonus <b>ne se transmet pas</b> : évite d'utiliser un brillant comme parent.",
  "Pour savoir quelle stat est gonflée : monte un monstre normal de la même espèce et le brillant au <b>même niveau</b>, puis compare.",
  "Méthode des joueurs : couper la sauvegarde automatique (menu Autres), sauvegarder, fusionner, et recharger si le résultat ne te convient pas."]},
 {c:"Synthèse",t:"La recherche de synthèse du jeu",src:["syn"],li:[
  "Dans la recherche de synthèse, l'option qui filtre sur les <b>monstres jamais recrutés</b> remplit la bibliothèque plus vite (le libellé exact peut différer en français).",
  "Un ● marque un monstre jamais recruté. Un « ? » indique qu'il reste des combinaisons avec des monstres jamais rencontrés ; sans « ? », toutes les combinaisons de ce monstre sont faites.",
  "Coupe la <b>sauvegarde automatique</b> avant une série de fusions : tu peux recharger si tu perds un monstre par erreur."]},
 {c:"Œufs",t:"Œufs : comment ils fonctionnent",src:["eggs"],li:[
  "Les œufs éclosent <b>tout de suite</b> quand tu les ramasses : plus d'attente ni de noms d'œufs comme dans les anciens jeux.",
  "Ils apparaissent dans le monde une fois <b>toutes les quêtes de Terrestria terminées</b>, dans les échelons inférieur, intermédiaire et supérieur.",
  "Dans la nature, un œuf est toujours <b>blanc</b> : sa rareté (blanc, argent, or ou arc-en-ciel) ne se révèle qu'une fois ramassé. Ramasse-les dès que tu les vois.",
  "<b>Rareté selon ta progression :</b> après Terrestria, œufs blancs et argent (rangs G à D) ; après le Berceau de la Corruption, niveau inférieur, œufs <b>or</b> (rangs C et B) ; après le Berceau de la Corruption, niveau moyen, œufs <b>arc-en-ciel</b> (rang A).",
  "<b>Plus l'échelon est haut, plus les œufs sont rares</b> (comptages du guide sur 593 œufs, à prendre comme ordre de grandeur) :<table class='tt'><tr><th></th><th>Inférieur</th><th>Intermédiaire</th><th>Supérieur</th></tr><tr><td>Blanc</td><td>62,9 %</td><td>43,0 %</td><td>20,0 %</td></tr><tr><td>Argent</td><td>30,7 %</td><td>48,4 %</td><td>47,3 %</td></tr><tr><td>Or</td><td>5,7 %</td><td>6,5 %</td><td>23,4 %</td></tr><tr><td>Arc-en-ciel</td><td>0,8 %</td><td>2,2 %</td><td>9,3 %</td></tr></table>Un lecteur du guide a obtenu des résultats très différents (beaucoup d'or dans l'échelon supérieur du Cercle du Courroux) : c'est un échantillon, pas une règle.",
  "Les talents <b>réservés aux œufs</b> (voir plus bas) ont aussi plus de chances de sortir dans l'échelon supérieur.",
  "De <b>gros monstres</b> peuvent sortir d'un œuf. Si tu vises un monstre précis, sauvegarde devant l'œuf puis recharge jusqu'à obtenir le bon."]},
 {c:"Œufs",t:"Farmer les œufs : la méthode de relance",src:["eggs"],li:[
  "<b>1.</b> Choisis une carte et ramasse tous ses œufs.",
  "<b>2.</b> Fais <b>10 combats ou plus</b> dans la même zone : c'est la condition pour que les œufs réapparaissent.",
  "<b>3.</b> Voyage rapide vers une autre carte.",
  "<b>4.</b> Désactive la sauvegarde automatique, puis sauvegarde.",
  "<b>5.</b> Reviens sur la carte choisie et cherche les œufs. S'il n'y en a pas, recharge ta sauvegarde et recommence : c'est bien plus rapide que de chercher longtemps.",
  "<b>6.</b> Si l'œuf éclot en un monstre qui ne te convient pas, retourne à l'écran titre et recharge pour retenter.",
  "Ces règles viennent de tests de joueurs, le guide les donne <b>à titre indicatif</b>. Certains cas sont confirmés où les œufs ne réapparaissent pas si tu changes de carte tout de suite après les combats : dans ce cas, attends environ <b>5 minutes</b>.",
  "Une carte contient <b>3 œufs au maximum</b>. Varie les cartes : si tu restes dans une seule zone, les œufs finissent par ne plus y réapparaître. Ramasse les mini-médailles en passant.",
  "Si tu n'as pas de préférence, le <b>Cercle de l'Inconstance, échelon supérieur</b> est conseillé : on voit presque toute la carte depuis les hauteurs, donc on repère vite les œufs."]},
 {c:"Œufs",t:"Route conseillée : Cercle de l'Inconstance, échelon supérieur",src:["eggs"],li:[
  "Pars du <b>Sanctuaire d'Aamon</b> et repère les œufs depuis la colline, sans en descendre, en regardant dans plusieurs directions (le guide numérote 6 points d'observation, avec des vues vers l'est, le sud, l'ouest et le niveau inférieur).",
  "Une fois l'œuf repéré, utilise le voyage rapide vers l'objet le plus proche et ramasse-le. Une fois la route connue, la vérification prend environ une minute.",
  "Les hauteurs de la <b>Tour de RoseColine</b> permettent de voir presque tous les œufs restants, vers l'est comme vers l'ouest.",
  "<b>Saison :</b> n'importe laquelle convient, mais l'<b>automne</b> est la meilleure : des œufs sont alors immergés et parfois visibles de loin.",
  "En automne la météo peut changer et faire poursuivre {{Lunatick}} et {{Soulspawn}}. Astuce : sauvegarde en été, va dans la zone, puis passe en automne avec une poudre ou la flûte des saisons : la météo bouge moins.",
  "La <b>flûtiau des quatre saisons</b> se récupère <b>après la fin du jeu</b> dans <b>Les bois chuchotants</b>. Elle permet de changer de saison à volonté, sauf dans les lieux où les saisons sont immuables. Avec 4 poudres passe-saison, tu peux avancer les saisons 4 fois sans recharger, et recharger la sauvegarde si ça ne donne rien.",
  "Pour fabriquer des monstres de rang X : {{N:387}} (nécessaire à leur fusion) apparaît souvent dans le <b>Cercle de la Conquête, échelon supérieur</b>, et {{N:497}} dans le <b>Cercle de la Ténacité, échelon supérieur</b>. Ces deux monstres ne sortent que d'œufs : si tu en as assez de relancer, change de zone."]},
 {c:"Œufs",t:"Monstres qui ne sortent que d'un œuf",src:["eggs"],li:[
  "{{N:77}} : Dragon, rang F, œuf blanc.",
  "{{N:100}} : Dragon, rang C, œuf or.",
  "{{N:164}} : Nature, rang E, œuf argent.",
  "{{N:166}} : Nature, rang E, œuf argent.",
  "{{N:171}} : Nature, rang D, œuf argent.",
  "{{N:187}} : Nature, rang C, œuf or.",
  "{{N:265}} : Bête, rang B, œuf or.",
  "{{N:266}} : Bête, rang B, œuf or.",
  "{{N:272}} : Bête, rang A, œuf arc-en-ciel.",
  "{{N:306}} : Matière, rang E, œuf argent.",
  "{{N:387}} : Démon, rang D, œuf argent.",
  "{{N:414}} : Démon, rang B, œuf or.",
  "{{N:453}} : Mort-vivant, rang E, œuf argent.",
  "{{N:457}} : Mort-vivant, rang E, œuf argent.",
  "{{N:468}} : Mort-vivant, rang D, œuf argent.",
  "{{N:497}} : famille ???, rang C, œuf or.",
  "Quand un monstre sorti d'un œuf possède un talent très rare, un message s'affiche (« Je sens un grand pouvoir de ce monstre ! »). Ce message scintillant n'a aucun rapport avec les monstres brillants."]},
 {c:"Œufs",t:"Talents réservés aux œufs",src:["eggs"],li:[
  "Un monstre sorti d'un œuf peut avoir des talents introuvables ailleurs. Le guide cite {{K:Freeze Popper}} et {{K:Wisdom Booster II}} comme exemples rares, et les talents <b>exclusifs aux œufs</b> ci-dessous.",
  "<b>{{K:Hard Warder}}</b> (Hard Warder, œufs arc-en-ciel uniquement) : résistances accrues, dans l'ordre des paliers, à l'absorption de PM, à l'eau, à l'étourdissement, à l'éblouissement, à la terre, à la confusion, à la glace, à l'antimagie.",
  "<b>{{K:Sparkling Warder}}</b> (Sparkling Warder) : absorption de PM, feu, poison, éblouissement, foudre, paralysie, lumière, affaiblissement.",
  "<b>{{K:Holy Warder}}</b> (Holy Warder) : absorption de PM, poison, ténèbres, mort instantanée, explosion, éblouissement, vent, sommeil.",
  "Talents d'évolution qu'on trouve aussi dans les œufs dorés : {{K:Freeze Popper}}, {{K:Freezer Burner}}, {{K:Air Fryer}} et {{K:Storm Brewer}}. Voir l'onglet Talents pour leurs aptitudes."]},
 {c:"Builds",t:"Builds d'attaquants (histoire)",src:["bt","btier","bpg"],li:[
  "<b>Début :</b> les talents de souffle {{K:Shallow Breather}}, {{K:Blazer}}, {{K:Chilly Receptionist}} sont très bons au début et restent utiles en fin de jeu. Côté physique : {{K:Fighter}} et {{K:Materialist}}. {{K:Afficionado}} (<b>Espoir de X</b>) est un excellent choix précoce.",
  "<b>Milieu :</b> <b>Esthète de X</b> (évolution d'Espoir de X) : Bang pour {{Kaboomle}}, Crack pour {{Kacrackle}} sont cités en exemple. {{K:Smart Blazer}} et {{K:Frosty Receptionist}} pour les dégâts de souffle généraux, {{K:Deep Breather}} pour {{Sandy Sigh}}, {{K:Duelist}} (le guide cite {{Killing Machine}}).",
  "<b>Fin :</b> {{K:Wrecker}} (« augmente beaucoup l'attaque »), {{K:Multidisciplinarian}}, {{K:Warmonger}}, {{K:Storm Chaser}} (polyvalent mais obtenu uniquement par synthèse) et <b>Snow Drifter</b>.",
  "<b>Affaiblisseur contre les Métal :</b> {{K:Devil's Advocate}} pour les attaques de regard et de hurlement.",
  "Pour les évolutions et les prérequis de chaque talent, utilise l'onglet Synthèse, mode « Monstre ultime »."]},
 {c:"Builds",t:"Builds de soigneurs et de soutien (histoire)",src:["bt","bpg"],li:[
  "<b>Soigneurs au début :</b> {{K:Aquapothecary}}, {{K:Healer}}, {{K:Paramedic}}. <b>Milieu :</b> {{K:Cure-All}} (« un excellent sort de soin global ») et {{K:Empath}}. <b>Fin :</b> {{K:Supreme Healer}} (résulte de {{K:Healer}} + {{K:Cure-All}}), {{K:Mystic}} (synthèse uniquement), {{K:Strong Speller}} pour un soigneur secondaire.",
  "<b>Défense et soutien :</b> {{K:Good Knight}}, {{K:Fortifier}}, {{K:Defender}} au début. {{K:Leading Light}} et {{K:Enfeebler}} au milieu. Les talents de stats (<b>Bonus de PV, d'attaque, d'agilité, de sagesse</b>) sont jugés « essentiels du milieu à la fin du jeu ».",
  "<b>Fin :</b> {{K:Antimagic Avoider}} contre les sorts d'étouffement, {{K:Smarty-Pants}} (récupération auto de PM), {{K:Mouth Guard}} (renvoi de sorts), {{K:Sage}} (buffs et debuffs).",
  "<b>Maxés très utiles (ProGameGuides) :</b> {{K:Dancer}} pour un monstre à forte attaque, {{K:Cupid}} pour un monstre à forte sagesse, {{K:Water Baby}} (récupère des PM à chaque action), {{K:Fortifier}} (attaque de tous les alliés), {{K:Protector}} (renvoi de sorts)."]},
 {c:"Builds",t:"Builds PvP",src:["bt","btier"],li:[
  "<b>Résistances :</b> {{K:Hard Warder}}, {{K:Holy Warder}}, {{K:Sparkling Warder}} (tous issus d'œufs) sont classés S : ils augmentent plusieurs résistances d'un coup. En A : boucliers Magma, Glacier, Chiaroscuro, Tremor, Fulgurite. Le bouclier Cyclone est cité pour le PvP.",
  "<b>Attaquants physiques :</b> {{K:Wrecker}}, Uberkilling Machine (synthèse uniquement). <b>Souffle :</b> Blowhard, classé S pour la puissance brute.",
  "<b>Lanceurs :</b> {{K:Perfect Speller}} (S), puis {{K:Impactor}} et {{K:Polariser}} (A).",
  "<b>Affaiblisseurs :</b> {{K:Super Naturalist}}, <b>Wild Child</b>, <b>Sleep Counsellor</b>, {{K:Nuisance}} (jusqu'à quatre types de debuffs, plus résistance à la paralysie et au sommeil), <b>Grump</b>.",
  "<b>Soutien :</b> {{K:Altruist}} et {{K:Protector}}. <b>Soigneurs :</b> {{K:Supreme Healer}}, {{K:Fluffy}} (soutien et guérison des statuts), <b>The Almighty</b> (récupération auto de PV et des statuts).",
  "Selon le guide, la plupart des monstres de rang S en PvP sont destinés à la fin de jeu."]},
 {c:"Builds",t:"Tier list des talents par type",src:["btier"],li:[
  "<b>Physique :</b> S {{K:Hair Splitter}} · A {{K:Duelist}} · B {{K:Freezer Burner}}, {{K:Air Fryer}}, {{K:Freeze Popper}}, {{K:Storm Brewer}}.",
  "<b>Sorts :</b> S {{K:Perfect Speller}} · A {{K:Impactor}}, {{K:Polariser}} · le reste des tiers contient surtout des talents de boss.",
  "<b>Souffle :</b> S Blowhard · B {{K:Smart Blazer}}, {{K:Frosty Receptionist}}, {{K:Deep Breather}}.",
  "<b>Soins :</b> S {{K:Mystic}}, {{K:Supreme Healer}} · A {{K:Cure-All}} · B {{K:Empath}}.",
  "<b>Résistance :</b> S Hard/Holy/Sparkling Warder · A boucliers · B {{K:Super Naturalist}}.",
  "<b>Soutien :</b> S {{K:Fluffy}}, {{K:Sage}} · A {{K:Willing Helper}}, {{K:Smarty-Pants}}, {{K:Fortifier}}, {{K:Strong Speller}} · B {{K:Mouth Guard}}.",
  "Note : plusieurs talents de boss (Nokturnus, Zoma, Baramos, Aamon…) sont cités par la source ; leurs noms français ne sont pas confirmés."]},
 {c:"Combat",t:"Équipe, soins et tactiques",src:["tip9"],li:[
  "Associe les compétences et les traits : {{T:Insta-Oomph}} va bien avec les attaques physiques comme {{A:Whack}} ou {{A:Thwack}} ; {{T:Insta-Ping}} avec les soins comme {{A:Heal}} ou {{A:Multiheal}}.",
  "Aligne 3 ou 4 attaquants et garde des <b>soigneurs en réserve</b> : au moins deux pour les combats de boss longs.",
  "Règle les <b>tactiques</b> selon ton plan : attaquer à fond, soutenir et soigner, ou viser les dégâts plutôt que la victoire.",
  "Un guide complet sur les tactiques existe chez Game8 (<a href=\""+G8+"436890\" target=\"_blank\" rel=\"noopener\">Monster Tactics and Instructions</a>)."]},
 {c:"Argent",t:"Gagner de l'or",src:["gold"],li:[
  "<b>Début :</b> les monstres à attaque de zone ({{Raptile}}, {{Jargon}}, {{Drake Slime}}, {{Cannonbrawler}}, {{Dessert Demon}}, {{Powie Yowie}}) rapportent plus vite. Or par monstre : Terrestria ~4 G, Cercle de la Conquête (inf.) ~16, Cercle du Courroux ~25, Cercle de la Gourmandise ~34, Cercle de l'Inconstance ~41, Cercle de la Ténacité ~43, Berceau de la Corruption (inf.) ~48.",
  "Garde les <b>drops</b> : la revente ne rapporte que 1/10 du prix d'achat.",
  "<b>Milieu :</b> le {{Bag o' Tricks}} rapporte environ <b>3 000 G</b> par monstre, en 2 minutes environ, dans le Cercle de la Conquête (échelon intermédiaire). <b>Fin :</b> environ 3 500 G dans le Cercle de la Gourmandise (échelon supérieur), à trois points d'apparition à l'est de la Tour de RoseColine.",
  "Ils ne réapparaissent qu'après un <b>changement de zone</b> d'un autre secteur. Élimine les ennemis autour avant : cela augmente les chances d'en voir arriver d'autres.",
  "<b>Boosts d'or :</b> Bonus Ball ×1,5 (10 combats), Bumper Bonus Ball ×2 (25 combats, remplace la Bonus Ball), Cupcake Cane ×1,1, Gold Badge ×1,3 (40 Mini Medals) et Gold Medal ×1,5 (60 Mini Medals) chez le Medallist. Seul l'accessoire le plus fort compte ; les bonus s'additionnent."]}
];
var tipsDone=false,tipsCat="Tout";
function buildTips(){
  var h='<p class="note">Ces astuces viennent de guides communautaires en anglais et en japonais, traduits ici. Les chiffres sont ceux que rapportent ces guides : vérifie en jeu quand c\'est important. Les noms de lieux, d\'objets et d\'accessoires que je n\'ai pas pu confirmer en français restent en anglais (en italique pour les objets).</p>';
  h+='<div class="tipsbar"><input id="tq" type="search" placeholder="Chercher une astuce : EXP, recrutement, graine, brillant…" aria-label="Chercher une astuce" autocomplete="off"><div class="frow" id="tcats">'+["Tout"].concat(CATS).map(function(c){return '<button type="button" class="chip" data-tcat="'+esc(c)+'" aria-pressed="'+(c==="Tout"?"true":"false")+'">'+esc(c)+'</button>'}).join("")+'</div></div><div id="tips-list">';
  h+=TIPS.map(function(s,i){
    var body='<div class="tipbody">'+(s.flow||"")+'<ul>'+s.li.map(function(x){return '<li>'+nameTok(x)+'</li>'}).join("")+'</ul>'+
      '<p class="srcs">Sources : '+s.src.map(function(k){return '<a href="'+SRC[k][1]+'" target="_blank" rel="noopener">'+esc(SRC[k][0])+'</a>'}).join(" · ")+'</p></div>';
    return '<details class="tip" data-cat="'+esc(s.c)+'"'+(s.open?" open":"")+'><summary>'+esc(s.t)+' <span class="tcat">'+esc(s.c)+'</span></summary>'+body+'</details>';
  }).join("");
  h+='</div><p class="note" id="tips-none" hidden>Aucune astuce ne correspond.</p>';
  document.getElementById("tips-body").innerHTML=h;
  document.querySelectorAll("#tips-list .tip").forEach(function(d){d.setAttribute("data-t",norm(d.textContent))});
  tipsDone=true;
}
function filterTips(){
  var q=norm(document.getElementById("tq").value).trim(),n=0;
  document.querySelectorAll("#tips-list .tip").forEach(function(d){
    var ok=(tipsCat==="Tout"||d.getAttribute("data-cat")===tipsCat)&&(!q||d.getAttribute("data-t").indexOf(q)>=0);
    d.hidden=!ok;if(ok){n++;if(q)d.open=true}
  });
  document.getElementById("tips-none").hidden=n>0;
}
document.getElementById("tips-body").addEventListener("input",function(e){if(e.target.id==="tq")filterTips()});
document.getElementById("tips-body").addEventListener("click",function(e){
  var b=e.target.closest("[data-tcat]");if(!b)return;
  tipsCat=b.getAttribute("data-tcat");
  document.querySelectorAll("[data-tcat]").forEach(function(x){x.setAttribute("aria-pressed",x===b?"true":"false")});
  filterTips();
});

/* pickers */
function buildDL(){
  var only=document.getElementById("onlyown").checked;
  var opt=function(m){return '<option value="'+esc(m.n)+'"'+(m.e!==m.n?' label="'+esc(m.e)+'"':'')+'></option>'};
  document.getElementById("dl").innerHTML=M.filter(function(m){return !only||own[m.id]}).map(opt).join("");
  document.getElementById("dlall").innerHTML=M.map(opt).join("");
  document.getElementById("dltal").innerHTML=W.map(function(t){return '<option value="'+esc(t.n)+'"'+(t.e!==t.n?' label="'+esc(t.e)+'"':'')+'></option>'}).join("");
}

/* mode 1: fuse */
function fuseRender(){
  var pa=document.getElementById("pa"),pb=document.getElementById("pb");
  var a=resolve(pa.value),b=resolve(pb.value),out=document.getElementById("fuse-out"),h="";
  var hint=function(v,r){return r?mchip(r.id):(v?'<span class="hint">Choisis un nom dans la liste.</span>':"")};
  document.getElementById("pa-hint").innerHTML=hint(pa.value,a);
  document.getElementById("pb-hint").innerHTML=hint(pb.value,b);
  if(!a&&!b){out.innerHTML='<div class="empty">Choisis un monstre, ou deux. Avec deux, tu vois ce qu\'ils donnent. Avec un seul, tu vois tout ce qu\'il permet de fabriquer.</div>';return}
  if(a&&b){
    var direct=[],part=[];
    M.forEach(function(m){m.syn.forEach(function(rec){
      if(rec.length===1){if(matchPair(rec[0],a.id,b.id))direct.push({m:m,rec:rec,gi:0})}
      else rec.forEach(function(g,gi){if(matchPair(g,a.id,b.id))part.push({m:m,rec:rec,gi:gi})});
    })});
    h+='<h3 class="oh">Résultat</h3>';
    h+=direct.length?direct.map(function(d){return synRow(d.m,d.rec,d.gi,false,[a.id,b.id])}).join(""):'<div class="empty">Aucune recette connue pour cette paire. La base ne dit pas ce que donne cette fusion.</div>';
    if(part.length)h+='<h3 class="oh">Première étape d\'une synthèse à quatre monstres</h3>'+part.map(function(d){return synRow(d.m,d.rec,d.gi)}).join("");
    out.innerHTML=h;return;
  }
  var x=a||b,rows=[],seen={},ol=ownedList();
  M.forEach(function(m){m.syn.forEach(function(rec,ri){rec.forEach(function(g,gi){
    var other=null;
    if(specOk(g[0],x.id))other=g[1];else if(specOk(g[1],x.id))other=g[0];
    if(other===null)return;
    var key=m.id+"|"+ri+"|"+gi;if(seen[key])return;seen[key]=1;
    rows.push({m:m,rec:rec,gi:gi,ok:parentCands(other,ol).length>0});
  })})});
  rows.sort(function(p,q){return (q.ok-p.ok)||(p.m.no-q.m.no)});
  var nok=rows.filter(function(r){return r.ok}).length;
  h+='<h3 class="oh">Avec '+esc(x.n)+' : '+rows.length+' recette'+(rows.length>1?"s":"")+(nok?" dont "+nok+" faisable"+(nok>1?"s":"")+" avec tes monstres":"")+'</h3>';
  if(!rows.length)h+='<div class="empty">Ce monstre n\'apparaît dans aucune recette connue.</div>';
  var lim=showAllFuse?rows.length:40;
  h+=rows.slice(0,lim).map(function(r){return synRow(r.m,r.rec,r.gi,r.ok)}).join("");
  if(rows.length>lim)h+='<button type="button" class="more2" data-showall="fuse">Afficher les '+(rows.length-lim)+' autres</button>';
  out.innerHTML=h;
}

/* mode 2: plan a monster, as a tree */
function nodeHTML(pid,path,depth){
  if(!byId[pid])return specChip(pid);
  var m=byId[pid],h=!!own[pid];
  var status=h?"possédé":m.sc?"recrutable":m.syn.length?"par fusion":"œuf ou événement";
  var inner=sprite(pid,30)+'<span class="mn">'+(h?"✓ ":"")+esc(m.n)+'</span><small>'+esc(m.r)+" · "+status+'</small>';
  if(!m.syn.length||depth>=5||path.indexOf(pid)>=0)return '<span class="mchip'+(h?" have":"")+'">'+inner+'</span>'+ownBtn(pid,1);
  return '<details class="node" data-id="'+esc(pid)+'" data-path="'+esc(path.join(","))+'" data-depth="'+depth+'"><summary class="mchip'+(h?" have":"")+'">'+inner+'<span class="exp">comment l\'obtenir</span>'+ownBtn(pid,1)+'</summary><div class="nbody"></div></details>';
}
function recipesHTML(m,path,depth){
  return m.syn.map(function(rec,i){
    var h='<div class="plrec"><div class="plh">'+(m.syn.length>1?"Recette "+(i+1)+" sur "+m.syn.length:"Recette")+'</div>';
    rec.forEach(function(g,gi){
      h+='<div class="plpair">'+(rec.length>1?'<span class="op">Fusion '+(gi+1)+' :</span>':"")+nodeHTML(g[0],path,depth)+'<span class="op">+</span>'+nodeHTML(g[1],path,depth)+'</div>';
    });
    if(rec.length>1)h+='<div class="op">Puis fusionne les deux monstres obtenus.</div>';
    return h+'</div>';
  }).join("");
}
function planRender(){
  var pt=document.getElementById("pt"),out=document.getElementById("plan-out");
  var t=resolve(pt.value);
  document.getElementById("pt-hint").innerHTML=t?mchip(t.id):(pt.value?'<span class="hint">Choisis un nom dans la liste.</span>':"");
  if(!t){out.innerHTML='<div class="empty">Choisis le monstre que tu veux obtenir : tu vois ses recettes, que tu peux déplier jusqu\'aux monstres qu\'on recrute dans la nature.</div>';return}
  var h='<div class="phead">'+sprite(t.id,72)+'<div><div class="nm">'+esc(t.n)+'</div><div class="sub">N° '+esc(t.no)+' · '+esc(t.f)+' · rang '+esc(t.r)+' · '+(own[t.id]?"<b>tu le possèdes</b>":"pas encore possédé")+'</div><div style="margin-top:8px">'+ownBtn(t.id)+'</div><div class="sub" id="plan-count" style="margin-top:6px">'+planCount(t)+'</div></div></div>';
  if(t.sc){
    var pl=[];t.lo.forEach(function(l){var p=P[l[0]];if(pl.indexOf(p)<0)pl.push(p)});
    h+='<p class="note"><b>Recrutable dans la nature</b>'+(pl.length?" : "+esc(pl.slice(0,4).join(" ; "))+(pl.length>4?" …":""):"")+'.</p>';
  }else h+='<p class="note">Non recrutable dans la nature.</p>';
  h+=t.syn.length?'<h3 class="oh">Comment le fabriquer</h3>'+recipesHTML(t,[t.id],0):'<div class="empty">Aucune recette de synthèse connue pour ce monstre.</div>';
  out.innerHTML=h;
}

/* mode 3: what can I make now */
function pickPair(g,ol){
  var a=parentCands(g[0],ol),b=parentCands(g[1],ol);
  for(var i=0;i<a.length;i++)for(var j=0;j<b.length;j++)if(a[i]!==b[j])return [a[i],b[j]];
  return null;
}
function canRender(){
  var out=document.getElementById("can-out"),ol=ownedList(),incl=document.getElementById("incl").checked;
  if(ol.length<2){out.innerHTML='<div class="empty">Coche au moins deux monstres comme « Possédé » dans le carnet pour voir ce que tu peux fabriquer.</div>';return}
  var res=[];
  M.forEach(function(m){
    if(!incl&&own[m.id])return;
    var feas=[];
    m.syn.forEach(function(rec){
      var picks=[];
      var ok=rec.every(function(g){var p=pickPair(g,ol);if(p)picks.push(p);return !!p});
      if(ok)feas.push(picks);
    });
    if(feas.length)res.push({m:m,feas:feas});
  });
  var rk=function(m){return RANKS.indexOf(m.r)};
  res.sort(function(p,q){return rk(q.m)-rk(p.m)||p.m.no-q.m.no});
  var h='<h3 class="oh">'+res.length+' monstre'+(res.length>1?"s":"")+' fabricable'+(res.length>1?"s":"")+' avec tes '+ol.length+' monstres</h3>';
  if(!res.length)h+='<div class="empty">Rien de fabricable pour l\'instant avec les monstres cochés.</div>';
  var lim=showAllCan?res.length:60;
  h+='<div class="cgrid">'+res.slice(0,lim).map(function(r){
    var lines=r.feas.slice(0,2).map(function(picks){
      return '<div class="w"><span class="op">avec</span>'+picks.map(function(p){return '<span class="mini">'+mchip(p[0])+'<span class="op">+</span>'+mchip(p[1])+'</span>'}).join('<span class="op">et</span>')+doBtn(r.m.id,[].concat.apply([],picks))+'</div>';
    }).join("");
    return '<div class="ccard">'+mchip(r.m.id)+ownBtn(r.m.id)+lines+(r.feas.length>2?'<div class="op">+ '+(r.feas.length-2)+' autre'+(r.feas.length>3?"s":"")+' recette'+(r.feas.length>3?"s":"")+'</div>':"")+'</div>';
  }).join("")+'</div>';
  if(res.length>lim)h+='<button type="button" class="more2" data-showall="can">Afficher les '+(res.length-lim)+' autres</button>';
  out.innerHTML=h;
}


/* mode 4: monstre ultime (arbre de fusions avec talents) */
var ultMemo={};
function tName(en){var k=W.filter(function(x){return x.e===en})[0];return k?k.n:(K[en]?K[en].n:en)}
function resolveTal(v){
  var q=norm(v).trim();if(!q)return null;
  var hit=W.filter(function(t){return norm(t.n)===q||norm(t.e)===q||(t.al&&norm(t.al)===q)});
  return hit.length?hit[0].e:null;
}
function leafSet(m,assumeWild){
  var r=[];m.ta.forEach(function(t){if(t[1]==="P"||(t[1]==="W"&&(m.sc||assumeWild)))r.push(t[0])});return r;
}
function splits(S){
  var out=[],n=S.length;
  for(var mask=0;mask<(1<<n);mask++){var a=[],b=[];for(var i=0;i<n;i++)((mask>>i)&1?a:b).push(S[i]);out.push([a,b])}
  return out;
}

/* solveur : coût minimal par (monstre, ensemble de talents), point fixe sans limite de profondeur */
var specMatch={};
function matchList(spec){
  if(!specMatch[spec])specMatch[spec]=M.filter(function(m){return specOk(spec,m.id)}).map(function(m){return m.id});
  return specMatch[spec];
}
function pcnt(x){var c=0;while(x){c+=x&1;x>>=1}return c}
function ultUniverse(S){
  var U=[],seen={},alt={};
  var add=function(x){
    if(seen[x])return;seen[x]=1;U.push(x);
    var p=PRE[x];if(!p)return;
    var sets=p.all?[p.all]:combos(p.of,p.pick);
    alt[x]=sets;sets.forEach(function(st){st.forEach(add)});
  };
  S.forEach(add);
  return {U:U,alt:alt};
}
function ultTable(S,keep){
  var uu=ultUniverse(S),U=uu.U,n=U.length,INF=1e9,bit={};
  U.forEach(function(x,i){bit[x]=i});
  var altM={};
  Object.keys(uu.alt).forEach(function(x){altM[bit[x]]=uu.alt[x].map(function(st){var m=0;st.forEach(function(y){m|=1<<bit[y]});return m})});
  var top=0;S.forEach(function(x){top|=1<<bit[x]});
  var poolsOf=function(need){
    var pools=[need&~0],ev=[];
    for(var i=0;i<n;i++)if((need>>i)&1&&altM[i])ev.push(i);
    ev.forEach(function(e){
      var np=[];
      pools.forEach(function(pl){
        np.push(pl);
        altM[e].forEach(function(am){np.push((pl&~(1<<e))|am)});
      });
      pools=np;
    });
    var seen={},out=[];pools.forEach(function(pl){if(!seen[pl]){seen[pl]=1;out.push(pl)}});
    return out;
  };
  // masks atteignables
  var R={},queue=[top];R[top]=1;
  while(queue.length){
    var k=queue.pop();
    poolsOf(k).forEach(function(pl){
      var x=pl;
      while(true){
        if(x&&pcnt(x)<=3&&!R[x]){R[x]=1;queue.push(x)}
        if(x===0)break;x=(x-1)&pl;
      }
    });
  }
  var masks=Object.keys(R).map(Number).sort(function(a,b){return a-b}),midx={};
  masks.forEach(function(k,i){midx[k]=i+1});
  var size=masks.length+1,C={},pm={},Tt={},specs={};
  M.forEach(function(m){
    var arr=new Array(size);for(var i=0;i<size;i++)arr[i]=INF;
    arr[0]=own[m.id]?0:1;
    var lm=0;leafSet(m,!!own[m.id]).forEach(function(t){if(t in bit)lm|=1<<bit[t]});
    var fr=0;if(keep)m.ta.forEach(function(t){if(t[1]==="P"&&(t[0] in bit))fr|=1<<bit[t[0]]});
    var lf=own[m.id]||m.sc||!m.syn.length;
    masks.forEach(function(k,i){if(lf&&(k&lm)===k)arr[i+1]=own[m.id]?0:1});
    C[m.id]=arr;pm[m.id]={lm:lm,fr:fr,lf:lf};
    m.syn.forEach(function(rec){rec.forEach(function(g){g.forEach(function(sp){if(!byId[sp]&&!specs[sp])specs[sp]=1})})});
  });
  Object.keys(specs).forEach(function(sp){var a=new Array(size);for(var i=0;i<size;i++)a[i]=INF;a[0]=0;Tt[sp]=a;matchList(sp)});
  var ix=function(k){return k===0?0:(midx[k]||-1)};
  var spc=function(sp,k){var i=ix(k);if(i<0)return INF;return byId[sp]?C[sp][i]:Tt[sp][i]};
  var pair=function(g,k){
    var best=INF,sa=k;
    while(true){
      var c=spc(g[0],sa)+spc(g[1],k^sa);
      if(c<best)best=c;
      if(sa===0)break;sa=(sa-1)&k;
    }
    return best;
  };
  var recCost=function(rec,pool){
    if(rec.length===1)return pair(rec[0],pool)+3;
    var best=INF,sa=pool;
    while(true){
      if(pcnt(sa)<=3&&pcnt(pool^sa)<=3){var c=pair(rec[0],sa)+pair(rec[1],pool^sa);if(c<best)best=c}
      if(sa===0)break;sa=(sa-1)&pool;
    }
    return best+6;
  };
  var poolCache={};
  var changed=true,guard=0;
  while(changed&&guard++<300){
    changed=false;
    Object.keys(Tt).forEach(function(sp){
      var ids=specMatch[sp],a=Tt[sp];
      for(var i=1;i<size;i++){var b=INF;for(var j=0;j<ids.length;j++){var c=C[ids[j]][i];if(c<b)b=c}if(b<a[i]){a[i]=b;changed=true}}
    });
    M.forEach(function(m){
      if(!m.syn.length)return;
      var arr=C[m.id],fr=pm[m.id].fr;
      masks.forEach(function(k,i0){
        var i=i0+1,need=k&~fr,pl=poolCache[need]||(poolCache[need]=poolsOf(need));
        for(var a=0;a<pl.length;a++)for(var r=0;r<m.syn.length;r++){var c=recCost(m.syn[r],pl[a]);if(c<arr[i]){arr[i]=c;changed=true}}
      });
    });
  }
  return {C:C,pm:pm,pair:pair,recCost:recCost,spc:spc,ix:ix,INF:INF,U:U,bit:bit,poolsOf:poolsOf,altM:altM,top:top};
}
function ultBuild(tb,mid,k,maxMask){
  var m=byId[mid],INF=tb.INF;
  var names=function(mask){var r=[];tb.U.forEach(function(t,i){if(mask>>i&1)r.push(t)});return r};
  if(k===0)return {t:"gen",id:mid,S:[],cost:own[mid]?0:1};
  var info=tb.pm[mid],i=tb.ix(k);
  var leafOk=i>=0&&info.lf&&((k&info.lm)===k);
  var need=k&~info.fr,best=INF,bestRec=null,bestPool=0;
  if(m.syn.length)tb.poolsOf(need).forEach(function(pl){m.syn.forEach(function(rec){var c=tb.recCost(rec,pl);if(c<best){best=c;bestRec=rec;bestPool=pl}})});
  var mk=names(k&(maxMask||0));
  if(leafOk&&(own[mid]?0:1)<=best)return {t:"leaf",id:mid,S:names(k),maxS:mk,cost:own[mid]?0:1};
  if(!bestRec||best>=INF)return null;
  // évolutions réalisées à cette fusion : talents voulus absents du pool mais dont les prérequis y sont
  var evo=[];
  tb.U.forEach(function(t,j){
    if((need>>j&1)&&!(bestPool>>j&1)&&tb.altM[j]){
      var am=tb.altM[j].filter(function(x){return (bestPool&x)===x})[0];
      if(am!==undefined)evo.push({t:t,from:names(am)});
    }
  });
  var evoMask=0;evo.forEach(function(e){e.from.forEach(function(x){evoMask|=1<<tb.bit[x]})});
  var free=names(k&info.fr);
  var pairNode=function(g,kk){
    var bb=INF,bs=kk,sa=kk;
    while(true){var c=tb.spc(g[0],sa)+tb.spc(g[1],kk^sa);if(c<bb){bb=c;bs=sa}if(sa===0)break;sa=(sa-1)&kk}
    return {sub:[specBuild(tb,g[0],bs,bs&evoMask),specBuild(tb,g[1],kk^bs,(kk^bs)&evoMask)],cost:bb};
  };
  if(bestRec.length===1){
    var r=pairNode(bestRec[0],bestPool);
    return {t:"fuse",id:mid,S:names(k),maxS:mk,free:free,evo:evo,cost:best,sub:r.sub};
  }
  var bb=INF,bx=0,sa=bestPool;
  while(true){
    if(pcnt(sa)<=3&&pcnt(bestPool^sa)<=3){var c=tb.pair(bestRec[0],sa)+tb.pair(bestRec[1],bestPool^sa);if(c<bb){bb=c;bx=sa}}
    if(sa===0)break;sa=(sa-1)&bestPool;
  }
  var r1=pairNode(bestRec[0],bx),r2=pairNode(bestRec[1],bestPool^bx);
  return {t:"fuse2",id:mid,S:names(k),maxS:mk,free:free,evo:evo,cost:best,mids:[{S:names(bx),maxS:names(bx&evoMask),sub:r1.sub},{S:names(bestPool^bx),maxS:names((bestPool^bx)&evoMask),sub:r2.sub}]};
}
function specBuild(tb,sp,k,maxMask){
  if(byId[sp])return ultBuild(tb,sp,k,maxMask);
  if(k===0)return {t:"gen",spec:sp,S:[],cost:0};
  var ids=matchList(sp),bi=null,bc=tb.INF,ii=tb.ix(k);
  ids.forEach(function(id){var c=tb.C[id][ii];if(c<bc){bc=c;bi=id}});
  return bi?ultBuild(tb,bi,k,maxMask):null;
}
function tBadges(S,lbl,mx){
  mx=mx||[];
  return S.length?'<span class="utt">'+(lbl?'<small class="op">'+lbl+'</small>':'')+S.map(function(x){
    var m=mx.indexOf(x)>=0,p=m?maxPts(x):null;
    return '<b'+(m?' class="mx"':'')+'>'+esc(tName(x))+(m?' · à maxer'+(p?' ('+p+' pts)':''):'')+'</b>';
  }).join("")+'</span>':"";
}
function utHTML(n){
  if(!n)return "";
  if(n.t==="gen")return n.id?mchip(n.id)+ownBtn(n.id,1):specChip(n.spec);
  if(n.t==="leaf")return '<div class="uth">'+mchip(n.id)+'<span class="utk">'+(own[n.id]?"tu le possèdes":"à recruter dans la nature")+'</span>'+ownBtn(n.id,1)+tBadges(n.S,"il porte",n.maxS)+'</div>';
  var h='<div class="uth">'+mchip(n.id)+'<span class="utk">fusion</span>'+ownBtn(n.id,1)+tBadges(n.S,"talents obtenus",n.maxS)+(n.free&&n.free.length?tBadges(n.free,"dont déjà à lui"):"")+'</div>';
  if(n.evo&&n.evo.length)h+=n.evo.map(function(e){return '<div class="uevo">↳ obtient <b>'+esc(tName(e.t))+'</b> grâce à '+e.from.map(function(x){return esc(tName(x))}).join(" + ")+' maxé'+(e.from.length>1?'s':'')+' sur les parents</div>'}).join("");
  h+='<div class="utc">';
  if(n.t==="fuse"){
    h+=utHTML(n.sub[0])+'<div class="uop">+</div>'+utHTML(n.sub[1]);
  }else{
    n.mids.forEach(function(mi,i){
      h+=(i?'<div class="uop">+ (puis on fusionne ces deux monstres)</div>':"")+'<div class="ut"><div class="uth"><span class="utk">monstre intermédiaire</span>'+tBadges(mi.S,"talents obtenus",mi.maxS)+'</div><div class="utc">'+utHTML(mi.sub[0])+'<div class="uop">+</div>'+utHTML(mi.sub[1])+'</div></div>';
    });
  }
  return h+'</div>';
}
function utSteps(n,acc){
  if(!n||n.t==="leaf"||n.t==="gen")return acc;
  if(n.t==="fuse"){utSteps(n.sub[0],acc);utSteps(n.sub[1],acc);acc.n++}
  else{n.mids.forEach(function(mi){utSteps(mi.sub[0],acc);utSteps(mi.sub[1],acc);acc.n++});acc.n++}
  return acc;
}

var PRE={"Smart Blazer":{all:["Blazer"]},"Deep Breather":{all:["Shallow Breather"]},
 "Storm Brewer":{all:["Blowy Slasher","Stony Slasher"]},"Air Fryer":{all:["Spicy Slasher","Blowy Slasher"]},
 "Freezer Burner":{all:["Spicy Slasher","Soggy Slasher"]},"Freeze Popper":{all:["Soggy Slasher","Stony Slasher"]},
 "Impactor":{pick:2,of:["Frizz Virtuoso","Crag Virtuoso","Bang Virtuoso","Zam Virtuoso"]},
 "Polariser":{pick:2,of:["Splash Virtuoso","Woosh Virtuoso","Crack Virtuoso","Zap Virtuoso","Sizz Virtuoso"]},
 "Perfect Speller":{all:["Impactor","Polariser"]}};
["Zam","Bang","Sizz","Frizz","Zap","Crack","Splash","Crag","Woosh"].forEach(function(x){PRE[x+" Virtuoso"]={all:[x+" Afficionado"]}});
PRE["Frosty Receptionist"]={all:["Chilly Receptionist"]};
PRE["Blowhard"]={pick:2,of:["Smart Blazer","Frosty Receptionist","Deep Breather"]};
PRE["Hair Splitter"]={pick:2,of:["Air Fryer","Freeze Popper","Freezer Burner","Storm Brewer"]};
PRE["Supreme Healer"]={all:["Healer","Cure-All"]};
PRE["Magma Shield"]={all:["Crag Ward","Frizz Ward"]};PRE["Glacier Shield"]={all:["Crack Ward","Splish Ward"]};
PRE["Cyclone Shield"]={all:["Bang Ward","Woosh Ward"]};PRE["Tremor Shield"]={all:["Bang Ward","Crag Ward"]};
PRE["Fulgurite Shield"]={all:["Sizz Ward","Zap Ward"]};PRE["Chiaroscuro Shield"]={all:["Sizz Ward","Zam Ward"]};
["Agility","Attack","Defence","HP","MP","Wisdom"].forEach(function(x){PRE[x+" Booster II"]={all:[x+" Booster I"]};PRE[x+" Booster III"]={all:[x+" Booster II"]};PRE[x+" Booster IV"]={all:[x+" Booster III"]}});
function combos(a,k){
  if(k===0)return [[]];if(a.length<k)return [];
  var out=[];combos(a.slice(1),k-1).forEach(function(c){out.push([a[0]].concat(c))});
  return out.concat(combos(a.slice(1),k));
}
function uniq(a){var r=[];a.forEach(function(x){if(r.indexOf(x)<0)r.push(x)});return r}
function expandAlts(en){
  var p=PRE[en];if(!p)return [{base:[en],chain:[]}];
  var sets=p.all?[p.all]:combos(p.of,p.pick),out=[];
  sets.forEach(function(set){
    var parts=[{base:[],chain:[]}];
    set.forEach(function(x){
      var nx=[];expandAlts(x).forEach(function(e){parts.forEach(function(q){nx.push({base:q.base.concat(e.base),chain:q.chain.concat(e.chain)})})});
      parts=nx;
    });
    parts.forEach(function(q){out.push({base:uniq(q.base),chain:q.chain.concat([{t:en,from:set}])})});
  });
  return out;
}
function maxPts(en){var k=W.filter(function(x){return x.e===en})[0];return k&&k.r.length?k.r[k.r.length-1][0]:null}
function ultSolve(t,S,keep){
  var tb=ultTable(S.slice().sort(),keep);
  var r=ultBuild(tb,t.id,tb.top,0);
  return r?{r:r,chain:[],pool:S}:null;
}
var ultRun=0;
function ultRender(){
  var out=document.getElementById("ult-out"),t=resolve(document.getElementById("ut").value);
  document.getElementById("ut-hint").innerHTML=t?mchip(t.id):"";
  var S=[],bad=[];
  ["ut1","ut2","ut3"].forEach(function(id){
    var v=document.getElementById(id).value;if(!v.trim())return;
    var k=resolveTal(v);if(k){if(S.indexOf(k)<0)S.push(k)}else bad.push(v);
  });
  if(!t){out.innerHTML='<div class="empty">Choisis le monstre voulu, puis jusqu\'à 3 talents.</div>';return}
  if(bad.length){out.innerHTML='<div class="empty">Talent non reconnu : '+esc(bad.join(", "))+'. Choisis un nom dans la liste.</div>';return}
  if(!S.length){out.innerHTML='<div class="empty">Ajoute au moins un talent.</div>';return}
  ultMemo={};
  var keep=document.getElementById("ukeep").checked;
  out.innerHTML='<div class="empty">Calcul en cours… (jusqu\'à 20 s pour les talents très complexes comme Pentacliste)</div>';
  var run=++ultRun;
  setTimeout(function(){
  if(run!==ultRun)return;
  var sol=ultSolve(t,S,keep),r=sol&&sol.r;
  talIndex();
  var h='<div class="ult-sum"><b>'+esc(t.n)+'</b> avec '+S.map(function(x){return '<b>'+esc(tName(x))+'</b>'}).join(", ")+'</div>';
  if(!r){
    var none=[];S.forEach(function(x){expandAlts(x)[0].base.forEach(function(y){if(!(talMons[y]||[]).length&&none.indexOf(y)<0)none.push(y)})});
    h+='<div class="empty">Aucun arbre trouvé, quel que soit le nombre de fusions.'+(none.length?' Ces talents de base ne sont naturels à aucun monstre (les Bonus I sont portés au hasard par des monstres sauvages, les autres viennent d\'œufs ou de parchemins) : '+esc(none.map(tName).join(", "))+'.':' Essaie moins de talents, ou un autre monstre : la base de recettes ne permet pas de réunir ces talents.')+'</div>';
    out.innerHTML=h;return;
  }
  var st=utSteps(r,{n:0});
  h+='<p class="note"><b>'+st.n+' fusion'+(st.n>1?"s":"")+'</b> au total. Les monstres que tu possèdes (✓) sont pris en priorité. À chaque fusion, choisis les talents « obtenus » (sur chaque monstre, y compris les intermédiaires) ; « à maxer » = mets tous les points dans ce talent avant de fusionner.</p>';
  h+='<div class="ut">'+utHTML(r)+'</div>';
  out.innerHTML=h;
  },30);
}
(function(){
  ["ut","ut1","ut2","ut3"].forEach(function(id){var tm=null;document.getElementById(id).addEventListener("input",function(){clearTimeout(tm);tm=setTimeout(ultRender,200)})});
  document.getElementById("ukeep").addEventListener("change",ultRender);
})();
function renderSyn(){
  ["fuse","plan","can","ult"].forEach(function(k){document.getElementById("m-"+k).hidden=k!==mode});
  document.querySelectorAll("[data-mode]").forEach(function(b){b.setAttribute("aria-pressed",b.getAttribute("data-mode")===mode?"true":"false")});
  buildDL();
  if(mode==="fuse")fuseRender();else if(mode==="plan")planRender();else if(mode==="ult")ultRender();else canRender();
}

document.querySelectorAll("[data-view]").forEach(function(b){b.addEventListener("click",function(){showView(b.getAttribute("data-view"))})});
document.querySelectorAll("[data-mode]").forEach(function(b){b.addEventListener("click",function(){mode=b.getAttribute("data-mode");renderSyn()})});
["pa","pb"].forEach(function(id){document.getElementById(id).addEventListener("input",function(){showAllFuse=false;fuseRender()})});
document.getElementById("pt").addEventListener("input",planRender);
document.getElementById("onlyown").addEventListener("change",function(){buildDL();fuseRender()});
document.getElementById("incl").addEventListener("change",function(){showAllCan=false;canRender()});
vS.addEventListener("click",function(e){
  var fb=e.target.closest("[data-fuse]");if(fb){applyFusion(fb.getAttribute("data-fuse"),fb.getAttribute("data-parents").split(","));return}
  var ob=e.target.closest("[data-own]");if(ob){e.preventDefault();toggleOwn(ob.getAttribute("data-own"));if(mode==="ult")ultRender();else if(mode==="can")canRender();return}
  var g=e.target.closest("[data-go]");if(g){goTo(g.getAttribute("data-go"));return}
  var s=e.target.closest("[data-showall]");
  if(s){if(s.getAttribute("data-showall")==="fuse"){showAllFuse=true;fuseRender()}else{showAllCan=true;canRender()}}
});
vS.addEventListener("toggle",function(e){
  var d=e.target;if(!d.classList||!d.classList.contains("node")||!d.open)return;
  var b=d.querySelector(".nbody");
  if(b&&!b.firstChild)b.innerHTML=recipesHTML(byId[d.getAttribute("data-id")],d.getAttribute("data-path").split(","),+d.getAttribute("data-depth")+1);
},true);

if(window.matchMedia&&window.matchMedia("(max-width:760px)").matches)document.getElementById("fbox").open=false;
render();counts();initCloud();
})();
