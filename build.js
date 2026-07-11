#!/usr/bin/env node
/* ═══════════════════════════════════════════════════════════════
   INSIGHTS ENGINE · vikashksingh.com
   Zero-dependency static publisher. Markdown in → publication out.
   Usage:  node build.js            (drafts excluded)
           BUILD_DRAFTS=1 node build.js
   Output: dist/  (site/ copied verbatim first — landing page untouched)
   ═══════════════════════════════════════════════════════════════ */
"use strict";
const fs = require("fs"), path = require("path");

const SITE_URL = "https://vikashksingh.com";
const AUTHOR   = "Vikash Singh";
const SITE_NAME= "Vikash Singh · Insights";
const TAGLINE  = "Essays on innovation, systems and the architecture of ecosystems.";
const ROOT = __dirname, DIST = path.join(ROOT,"dist"), CONTENT = path.join(ROOT,"content","insights"), SITE = path.join(ROOT,"site");

/* ---------- fs helpers ---------- */
const read = f => fs.readFileSync(f,"utf8");
const write = (f,c) => { fs.mkdirSync(path.dirname(f),{recursive:true}); fs.writeFileSync(f,c); };
function copyDir(src,dst){ if(!fs.existsSync(src)) return;
  for(const e of fs.readdirSync(src,{withFileTypes:true})){
    const s=path.join(src,e.name), d=path.join(dst,e.name);
    if(e.name.startsWith(".")||e.name.startsWith("README")) continue;
    if(e.isDirectory()) copyDir(s,d);
    else { fs.mkdirSync(path.dirname(d),{recursive:true}); fs.copyFileSync(s,d); }
  } }
const esc = s => String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
const xml = s => String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");

/* ---------- front matter ---------- */
function parseFront(raw){
  const m = raw.match(/^---\n([\s\S]*?)\n---\n?/);
  const meta = {}; let body = raw;
  if(m){ body = raw.slice(m[0].length);
    m[1].split("\n").forEach(l=>{ const i=l.indexOf(":"); if(i<0) return;
      meta[l.slice(0,i).trim()] = l.slice(i+1).trim(); }); }
  meta.tags = (meta.tags||"").split(",").map(t=>t.trim()).filter(Boolean);
  meta.draft = /^true$/i.test(meta.draft||"");
  return { meta, body: body.trim() };
}

/* ---------- syntax highlighting (compact tokenizer) ---------- */
const KW = {
  js:"const let var function return if else for while class new import export from async await try catch throw typeof of in switch case break default null undefined true false this extends",
  ts:"const let var function return if else for while class new import export from async await try catch throw typeof of in interface type enum implements readonly public private null undefined true false this extends",
  python:"def return if elif else for while class import from as with try except raise lambda pass yield None True False in not and or is global async await",
  bash:"if then else fi for do done while echo export cd rm cp mv mkdir curl grep sed awk sudo function case esac",
  json:"true false null", sql:"select from where insert update delete join left right inner on group by order limit create table as and or not"
};
function highlight(code, lang){
  let s = esc(code);
  if(!lang||!KW[lang]) return s;
  s = s.replace(/(&quot;.*?&quot;|'[^'\n]*'|`[^`]*`)/g, '\u0001str$1\u0002');            // strings
  s = s.replace(/(\/\/[^\n]*|#[^\n]*|\/\*[\s\S]*?\*\/)/g, '\u0001com$1\u0002');          // comments
  s = s.replace(/\b(\d+\.?\d*)\b/g, '\u0001num$1\u0002');                                // numbers
  const kws = KW[lang].split(" ").join("|");
  s = s.replace(new RegExp("\\b("+kws+")\\b","g"), '\u0001kw$1\u0002');                  // keywords
  return s.replace(/\u0001(str|com|num|kw)/g,'<span class="tk-$1">').replace(/\u0002/g,"</span>");
}

/* ---------- markdown → html ---------- */
function inline(t){
  t = esc(t);
  t = t.replace(/`([^`]+)`/g, "<code>$1</code>");
  t = t.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  t = t.replace(/\*([^*]+)\*/g, "<em>$1</em>");
  t = t.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1" loading="lazy">');
  t = t.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');
  return t;
}
function md(body){
  const lines = body.split("\n"); const out=[]; let i=0;
  while(i<lines.length){
    const L=lines[i];
    if(/^```/.test(L)){ const lang=L.slice(3).trim().toLowerCase(); const buf=[]; i++;
      while(i<lines.length && !/^```/.test(lines[i])) buf.push(lines[i++]); i++;
      out.push(`<figure class="code"><pre><code class="lang-${esc(lang||"text")}">${highlight(buf.join("\n"),lang)}</code></pre></figure>`); continue; }
    if(/^###\s/.test(L)){ out.push(`<h3>${inline(L.slice(4))}</h3>`); i++; continue; }
    if(/^##\s/.test(L)){ const t=L.slice(3); out.push(`<h2 id="${slugify(t)}">${inline(t)}</h2>`); i++; continue; }
    if(/^(---|\*\s\*\s\*|···)\s*$/.test(L)){ out.push('<div class="sep" aria-hidden="true">· · ·</div>'); i++; continue; }
    if(/^>\s?/.test(L)){ const buf=[]; while(i<lines.length && /^>\s?/.test(lines[i])) buf.push(lines[i++].replace(/^>\s?/,""));
      out.push(`<blockquote><p>${buf.map(inline).join("</p><p>")}</p></blockquote>`); continue; }
    if(/^[-*]\s/.test(L)){ const buf=[]; while(i<lines.length && /^[-*]\s/.test(lines[i])) buf.push(lines[i++].slice(2));
      out.push("<ul>"+buf.map(x=>`<li>${inline(x)}</li>`).join("")+"</ul>"); continue; }
    if(/^\d+\.\s/.test(L)){ const buf=[]; while(i<lines.length && /^\d+\.\s/.test(lines[i])) buf.push(lines[i++].replace(/^\d+\.\s/,""));
      out.push("<ol>"+buf.map(x=>`<li>${inline(x)}</li>`).join("")+"</ol>"); continue; }
    if(!L.trim()){ i++; continue; }
    const buf=[L]; i++;
    while(i<lines.length && lines[i].trim() && !/^(##|###|>|```|[-*]\s|\d+\.\s|---)/.test(lines[i])) buf.push(lines[i++]);
    out.push(`<p>${inline(buf.join(" "))}</p>`);
  }
  return out.join("\n");
}
const slugify = s => s.toLowerCase().replace(/['".,;:!?()]/g,"").replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"");
const words = s => s.split(/\s+/).filter(Boolean).length;
const fmtDate = d => new Date(d+"T00:00:00Z").toLocaleDateString("en-AU",{day:"numeric",month:"long",year:"numeric",timeZone:"UTC"});

/* ---------- design system (matches vikashksingh.com: dark navy + teal/cyan) ---------- */
const CSS = `
:root{--bg:#070C11;--bg-alt:#0A1017;--panel:#0D141C;--card:rgba(255,255,255,.025);
 --ink:#F1F7FB;--ink2:#DCE6EE;--body:#B8C7D2;--mut:#9FB2BF;--faint:#5C7183;
 --line:rgba(255,255,255,.08);--line-soft:rgba(255,255,255,.06);
 --teal:#2DD4BF;--cyan:#22D3EE;--cyan-bright:#67E8F9;--onaccent:#06110F;
 --grad:linear-gradient(90deg,var(--teal),var(--cyan));
 --disp:'Space Grotesk',system-ui,sans-serif;--ui:'IBM Plex Sans',system-ui,sans-serif;--mono:'Space Mono',ui-monospace,monospace}
*{box-sizing:border-box;margin:0}
html{scroll-behavior:smooth}
body{background:var(--bg);color:var(--body);font-family:var(--ui);line-height:1.6;-webkit-font-smoothing:antialiased}
a{color:var(--teal);text-decoration:none}
a:hover{color:var(--cyan-bright)}
::selection{background:var(--teal);color:var(--onaccent)}
.wrap{max-width:1280px;margin:0 auto;padding:0 6vw}
/* chrome */
.progress{position:fixed;top:0;left:0;height:2.5px;width:0;background:var(--grad);z-index:60}
header.site{position:sticky;top:0;z-index:50;background:rgba(7,12,17,.75);backdrop-filter:blur(14px);border-bottom:1px solid var(--line-soft)}
header.site .wrap{display:flex;align-items:center;gap:22px;height:64px}
.brand{font-family:var(--disp);font-weight:700;font-size:16px;letter-spacing:.04em;color:var(--ink);text-decoration:none}
.brand b{color:var(--teal);font-weight:700}
nav.main{margin-left:auto;display:flex;gap:24px;align-items:center}
nav.main a{color:var(--mut);text-decoration:none;font-size:14px;font-weight:500;padding:6px 2px}
nav.main a:hover,nav.main a[aria-current]{color:var(--ink)}
nav.main a[aria-current]{border-bottom:2px solid var(--teal)}
footer.site{background:var(--bg-alt);color:var(--faint);margin-top:90px;border-top:1px solid var(--line-soft)}
footer.site .wrap{padding:34px 6vw;display:flex;gap:14px;flex-wrap:wrap;justify-content:space-between;font-size:13px}
footer.site a{color:var(--mut);text-decoration:none}
footer.site a:hover{color:var(--cyan-bright)}
.kicker{font-family:var(--ui);font-weight:600;font-size:12px;letter-spacing:.14em;text-transform:uppercase;color:var(--teal)}
/* index */
.hero{padding:72px 0 34px}
.hero h1{font-family:var(--disp);font-weight:700;font-size:clamp(34px,5.4vw,52px);letter-spacing:-.015em;line-height:1.04;margin:12px 0 14px;color:var(--ink)}
.hero p{color:var(--mut);font-size:17px;max-width:56ch}
.toolbar{display:flex;gap:10px;flex-wrap:wrap;align-items:center;padding:8px 0 26px;border-bottom:1px solid var(--line-soft)}
.search{flex:1;min-width:220px;position:relative}
.search input{width:100%;padding:11px 14px 11px 38px;font:inherit;font-size:14px;color:var(--ink);background:var(--card);border:1px solid var(--line);border-radius:9px;outline:none}
.search input:focus{border-color:var(--teal)}
.search svg{position:absolute;left:12px;top:50%;transform:translateY(-50%);opacity:.5;color:var(--mut)}
.chip{font-family:var(--ui);font-weight:600;font-size:10.5px;letter-spacing:.08em;text-transform:uppercase;border:1px solid var(--line);border-radius:999px;padding:7px 13px;background:none;color:var(--mut);cursor:pointer}
.chip[aria-pressed="true"]{border-color:var(--teal);color:var(--teal)}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(320px,1fr));gap:20px;padding:30px 0}
.card{border:1px solid var(--line);background:var(--card);border-radius:12px;padding:24px;display:flex;flex-direction:column;gap:12px;text-decoration:none;transition:transform .2s ease,border-color .2s}
.card:hover{transform:translateY(-3px);border-color:rgba(45,212,191,.45)}
.card h2{font-family:var(--disp);font-weight:600;font-size:21px;line-height:1.25;letter-spacing:-.01em;color:var(--ink)}
.card p{color:var(--mut);font-size:14px;line-height:1.55;flex:1}
.card .meta{display:flex;gap:10px;flex-wrap:wrap;align-items:center;font-family:var(--ui);font-size:10.5px;letter-spacing:.06em;color:var(--faint);text-transform:uppercase}
.tagrow{display:flex;gap:6px;flex-wrap:wrap}
.tag{font-family:var(--ui);font-weight:600;font-size:9.5px;letter-spacing:.08em;text-transform:uppercase;border:1px solid rgba(45,212,191,.3);border-radius:999px;padding:3px 9px;color:var(--teal)}
.empty{padding:60px 0;color:var(--mut);text-align:center;font-size:14px;display:none}
/* article */
article.essay{max-width:70ch;margin:0 auto;padding:64px 24px 20px}
.cover{max-width:920px;margin:0 auto;padding:24px 24px 0}
.cover img{width:100%;border-radius:14px;border:1px solid var(--line);display:block}
.essay .kicker-row{display:flex;gap:14px;flex-wrap:wrap;align-items:center;margin-bottom:18px}
.essay h1{font-family:var(--disp);font-weight:700;font-size:clamp(32px,5vw,46px);line-height:1.08;letter-spacing:-.018em;margin:0 0 16px;color:var(--ink)}
.dek{font-family:var(--ui);font-style:italic;font-size:19px;line-height:1.5;color:var(--mut);margin-bottom:26px}
.byline{display:flex;gap:12px;align-items:center;padding:18px 0;border-top:1px solid var(--line-soft);border-bottom:1px solid var(--line-soft);margin-bottom:38px;font-size:13px;color:var(--mut)}
.byline .avatar{width:38px;height:38px;border-radius:50%;background:var(--panel);border:1px solid var(--line);color:var(--ink);display:flex;align-items:center;justify-content:center;font-family:var(--disp);font-weight:700;font-size:14px}
.byline .avatar span{color:var(--teal)}
.byline strong{color:var(--ink2)}
.prose{font-family:var(--ui);font-size:18px;line-height:1.75;color:var(--body)}
.prose p{margin:0 0 1.35em}
.prose>p:first-of-type{font-size:19.5px}
.prose h2{font-family:var(--disp);font-weight:600;font-size:25px;letter-spacing:-.012em;line-height:1.2;margin:2em 0 .7em;scroll-margin-top:80px;color:var(--ink)}
.prose h3{font-family:var(--disp);font-weight:600;font-size:19px;margin:1.6em 0 .6em;color:var(--ink)}
.prose a{color:var(--teal);text-decoration-thickness:1px;text-underline-offset:3px}
.prose a:hover{color:var(--cyan-bright)}
.prose blockquote{margin:2em 0;padding:.4em 0 .4em 1.4em;border-left:3px solid var(--teal);font-size:20px;line-height:1.55;font-style:italic;color:var(--ink2)}
.prose blockquote p{margin:0}
.prose ul,.prose ol{margin:0 0 1.35em;padding-left:1.3em}
.prose li{margin-bottom:.45em}
.prose code{font-family:var(--mono);font-size:.82em;background:rgba(255,255,255,.06);border:1px solid var(--line);border-radius:5px;padding:.08em .35em;color:var(--ink2)}
.prose .sep{text-align:center;color:var(--teal);letter-spacing:.6em;margin:2.4em 0;font-size:14px}
.prose img{max-width:100%;border-radius:10px;margin:1.5em 0}
figure.code{margin:1.8em 0;border:1px solid var(--line);border-radius:10px;overflow:hidden;background:var(--panel)}
figure.code pre{margin:0;padding:18px;overflow-x:auto}
figure.code code{font-family:var(--mono);font-size:13.5px;line-height:1.65;color:var(--ink2);background:none;border:none;padding:0}
.tk-kw{color:var(--cyan-bright)}.tk-str{color:var(--teal)}.tk-com{color:var(--faint);font-style:italic}.tk-num{color:#7FB3DA}
.endmatter{max-width:70ch;margin:0 auto;padding:0 24px}
.share{display:flex;gap:10px;flex-wrap:wrap;padding:26px 0;border-top:1px solid var(--line-soft)}
.share a,.share button{font-family:var(--ui);font-weight:600;font-size:10.5px;letter-spacing:.08em;text-transform:uppercase;border:1px solid var(--line);border-radius:999px;padding:8px 15px;color:var(--mut);text-decoration:none;background:none;cursor:pointer}
.share a:hover,.share button:hover{border-color:var(--teal);color:var(--cyan-bright)}
.related{padding:34px 0 0}
.related h2{font-family:var(--disp);font-weight:600;font-size:20px;margin:8px 0 18px;color:var(--ink)}
@media(max-width:640px){.hero{padding:48px 0 24px}.grid{grid-template-columns:1fr}}
@media(prefers-reduced-motion:reduce){html{scroll-behavior:auto}.card{transition:none}}
`;

const FONTS = `<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700&family=IBM+Plex+Sans:ital,wght@0,400;0,500;0,600;1,400&family=Space+Mono:wght@400;700&display=swap" rel="stylesheet">`;

function chrome(active){
  return {
    head: `${FONTS}<link rel="stylesheet" href="/insights/insights.css"><link rel="alternate" type="application/rss+xml" title="${esc(SITE_NAME)}" href="${SITE_URL}/rss.xml">`,
    header: `<div class="progress" id="prog"></div><header class="site"><div class="wrap">
      <a class="brand" href="/">VIKASH SINGH<b>.</b></a>
      <nav class="main" aria-label="Site">
        <a href="/">Home</a>
        <a href="/insights/" ${active==="insights"?'aria-current="page"':""}>Insights</a>
        <a href="/rss.xml">RSS</a>
      </nav></div></header>`,
    footer: `<footer class="site"><div class="wrap">
      <div>© ${new Date().getFullYear()} ${esc(AUTHOR)} · Perth, Western Australia</div>
      <div><a href="/insights/">Insights</a> · <a href="/rss.xml">RSS</a> · <a href="/sitemap.xml">Sitemap</a></div>
    </div></footer>`
  };
}
const PROG_JS = `<script>(function(){var p=document.getElementById('prog');if(!p)return;addEventListener('scroll',function(){var h=document.documentElement,m=h.scrollHeight-h.clientHeight;p.style.width=(m>0?(h.scrollTop/m*100):0)+'%'},{passive:true})})();</script>`;

/* ---------- load posts ---------- */
const files = fs.existsSync(CONTENT)? fs.readdirSync(CONTENT).filter(f=>f.endsWith(".md")) : [];
let posts = files.map(f=>{
  const { meta, body } = parseFront(read(path.join(CONTENT,f)));
  const slug = meta.slug || slugify(meta.title||f.replace(/\.md$/,""));
  const html = md(body);
  return { ...meta, slug, html, body,
    minutes: Math.max(1, Math.round(words(body)/220)),
    url: `${SITE_URL}/insights/${slug}/` };
});
const drafts = posts.filter(p=>p.draft);
if(!process.env.BUILD_DRAFTS) posts = posts.filter(p=>!p.draft);
posts.sort((a,b)=> b.date.localeCompare(a.date));
const allTags = [...new Set(posts.flatMap(p=>p.tags))].sort();

/* ---------- article pages ---------- */
function articlePage(p){
  const c = chrome("insights");
  const related = posts.filter(x=>x.slug!==p.slug)
    .map(x=>({x, s:x.tags.filter(t=>p.tags.includes(t)).length}))
    .sort((a,b)=>b.s-a.s || b.x.date.localeCompare(a.x.date)).slice(0,3).map(r=>r.x);
  const jsonld = JSON.stringify({ "@context":"https://schema.org","@type":"Article",
    headline:p.title, description:p.excerpt, datePublished:p.date,
    author:{"@type":"Person",name:AUTHOR,url:SITE_URL}, mainEntityOfPage:p.url,
    publisher:{"@type":"Person",name:AUTHOR} });
  return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(p.title)} · ${esc(AUTHOR)}</title>
<meta name="description" content="${esc(p.excerpt)}">
<link rel="canonical" href="${p.url}">
<meta property="og:type" content="article"><meta property="og:title" content="${esc(p.title)}">
<meta property="og:description" content="${esc(p.excerpt)}"><meta property="og:url" content="${p.url}">
<meta property="og:site_name" content="${esc(SITE_NAME)}">${p.cover?`<meta property="og:image" content="${esc(p.cover)}">`:""}
<meta property="article:published_time" content="${p.date}">${p.tags.map(t=>`<meta property="article:tag" content="${esc(t)}">`).join("")}
<meta name="twitter:card" content="${p.cover?"summary_large_image":"summary"}"><meta name="twitter:title" content="${esc(p.title)}"><meta name="twitter:description" content="${esc(p.excerpt)}">${p.cover?`<meta name="twitter:image" content="${esc(p.cover)}">`:""}
<script type="application/ld+json">${jsonld}</script>
${c.head}</head><body>
${c.header}
${p.cover?`<div class="cover"><img src="${esc(p.cover)}" alt="${esc(p.title)}" width="1200" height="630"></div>`:""}
<article class="essay">
  <div class="kicker-row"><span class="kicker">Insights</span><span class="kicker" style="color:var(--faint)">${fmtDate(p.date)} · ${p.minutes} min read</span></div>
  <h1>${esc(p.title)}</h1>
  <p class="dek">${esc(p.excerpt)}</p>
  <div class="byline"><div class="avatar">V<span>S</span></div><div><strong>${esc(AUTHOR)}</strong><br>Innovation, strategy & ecosystem architecture</div></div>
  <div class="prose">${p.html}</div>
  <div class="tagrow" style="margin-top:34px">${p.tags.map(t=>`<span class="tag">${esc(t)}</span>`).join("")}</div>
</article>
<div class="endmatter">
  <div class="share">
    <a href="https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(p.url)}" rel="noopener" target="_blank">Share on LinkedIn</a>
    <a href="mailto:?subject=${encodeURIComponent(p.title)}&body=${encodeURIComponent(p.url)}">Email</a>
    <button onclick="navigator.clipboard&&navigator.clipboard.writeText('${p.url}');this.textContent='Copied'">Copy link</button>
  </div>
  ${related.length?`<div class="related"><span class="kicker">Keep reading</span><h2>Related essays</h2><div class="grid" style="padding-top:4px">${related.map(card).join("")}</div></div>`:""}
</div>
${c.footer}${PROG_JS}
</body></html>`;
}
function card(p){
  return `<a class="card" href="/insights/${p.slug}/">
    <div class="meta"><span>${fmtDate(p.date)}</span><span>·</span><span>${p.minutes} min</span></div>
    <h2>${esc(p.title)}</h2><p>${esc(p.excerpt)}</p>
    <div class="tagrow">${p.tags.map(t=>`<span class="tag">${esc(t)}</span>`).join("")}</div></a>`;
}

/* ---------- index page ---------- */
function indexPage(){
  const c = chrome("insights");
  const idx = JSON.stringify(posts.map(p=>({s:p.slug,t:p.title,e:p.excerpt,g:p.tags,d:p.date,m:p.minutes})));
  return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Insights · ${esc(AUTHOR)}</title>
<meta name="description" content="${esc(TAGLINE)}">
<link rel="canonical" href="${SITE_URL}/insights/">
<meta property="og:type" content="website"><meta property="og:title" content="Insights · ${esc(AUTHOR)}">
<meta property="og:description" content="${esc(TAGLINE)}"><meta property="og:url" content="${SITE_URL}/insights/">
${c.head}</head><body>
${c.header}
<main class="wrap">
  <div class="hero"><span class="kicker">The writing desk</span><h1>Insights</h1><p>${esc(TAGLINE)}</p></div>
  <div class="toolbar">
    <div class="search"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/></svg>
      <input id="q" type="search" placeholder="Search essays…" aria-label="Search essays"></div>
    <button class="chip" data-tag="" aria-pressed="true">All</button>
    ${allTags.map(t=>`<button class="chip" data-tag="${esc(t)}" aria-pressed="false">${esc(t)}</button>`).join("")}
  </div>
  <div class="grid" id="grid">${posts.map(card).join("")}</div>
  <div class="empty" id="empty">Nothing matches — try a different term or tag.</div>
</main>
${c.footer}
<script>
(function(){
 var IDX=${idx};
 var q=document.getElementById('q'),grid=document.getElementById('grid'),empty=document.getElementById('empty');
 var cards=[].slice.call(grid.children),tag='';
 function apply(){
   var term=(q.value||'').toLowerCase(),n=0;
   IDX.forEach(function(p,i){
     var hit=(!tag||p.g.indexOf(tag)>-1)&&(!term||(p.t+' '+p.e+' '+p.g.join(' ')).toLowerCase().indexOf(term)>-1);
     cards[i].style.display=hit?'':'none'; if(hit)n++;
   });
   empty.style.display=n?'none':'block';
 }
 q.addEventListener('input',apply);
 [].forEach.call(document.querySelectorAll('.chip'),function(b){
   b.addEventListener('click',function(){
     tag=b.dataset.tag;
     [].forEach.call(document.querySelectorAll('.chip'),function(x){x.setAttribute('aria-pressed',x===b?'true':'false')});
     apply();
   });
 });
})();
</script>
</body></html>`;
}

/* ---------- feeds ---------- */
function rss(){
  const items = posts.map(p=>`  <item>
    <title>${xml(p.title)}</title><link>${p.url}</link><guid isPermaLink="true">${p.url}</guid>
    <pubDate>${new Date(p.date+"T00:00:00Z").toUTCString()}</pubDate>
    ${p.tags.map(t=>`<category>${xml(t)}</category>`).join("")}
    <description>${xml(p.excerpt)}</description>
  </item>`).join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"><channel>
  <title>${xml(SITE_NAME)}</title><link>${SITE_URL}/insights/</link>
  <description>${xml(TAGLINE)}</description><language>en-au</language>
  <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
${items}
</channel></rss>`;
}
function sitemap(){
  const urls = [
    {loc:SITE_URL+"/", pri:"1.0"},
    {loc:SITE_URL+"/insights/", pri:"0.9"},
    ...posts.map(p=>({loc:p.url, pri:"0.8", mod:p.date}))
  ];
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map(u=>`  <url><loc>${u.loc}</loc>${u.mod?`<lastmod>${u.mod}</lastmod>`:""}<priority>${u.pri}</priority></url>`).join("\n")}
</urlset>`;
}

/* ---------- build ---------- */
fs.rmSync(DIST,{recursive:true,force:true});
fs.mkdirSync(DIST,{recursive:true});
copyDir(SITE, DIST);                       // landing page & existing assets, verbatim, first
if(!fs.existsSync(path.join(DIST,"index.html")))
  console.warn("⚠  site/index.html not found — dist has no landing page yet. Drop your existing site into site/.");
write(path.join(DIST,"insights","insights.css"), CSS);
write(path.join(DIST,"insights","index.html"), indexPage());
posts.forEach(p=> write(path.join(DIST,"insights",p.slug,"index.html"), articlePage(p)));
write(path.join(DIST,"rss.xml"), rss());
if(!fs.existsSync(path.join(DIST,"sitemap.xml"))) write(path.join(DIST,"sitemap.xml"), sitemap());
if(!fs.existsSync(path.join(DIST,"robots.txt"))) write(path.join(DIST,"robots.txt"), `User-agent: *\nAllow: /\nSitemap: ${SITE_URL}/sitemap.xml\n`);
console.log(`✔ built ${posts.length} essay(s)${drafts.length?` · ${drafts.length} draft(s) held back`:""} → dist/`);
posts.forEach(p=>console.log(`  /insights/${p.slug}/  (${p.minutes} min · ${p.tags.join(", ")})`));
