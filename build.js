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

/* ---------- design system ---------- */
const CSS = `
:root{--paper:#FAF7EF;--ink:#14212E;--ink2:#3D4C5A;--mut:#71808D;--line:#E3DCCB;
 --navy:#0B131D;--panel:#0F2636;--coral:#D8513D;--gold:#B89221;--gold-bright:#C9A227;
 --disp:'Space Grotesk',system-ui,sans-serif;--ui:'Inter',system-ui,sans-serif;
 --serif:'Charter','Bitstream Charter',Georgia,'Times New Roman',serif;--mono:'Space Mono',ui-monospace,monospace}
@media(prefers-color-scheme:dark){:root{--paper:#0B131D;--ink:#EDE9DE;--ink2:#C4CCD3;--mut:#8A99A6;--line:#22303D;--gold:#C9A227}}
*{box-sizing:border-box;margin:0}
html{scroll-behavior:smooth}
body{background:var(--paper);color:var(--ink);font-family:var(--ui);line-height:1.6;-webkit-font-smoothing:antialiased}
a{color:inherit}
::selection{background:var(--gold-bright);color:#0B131D}
.wrap{max-width:1080px;margin:0 auto;padding:0 24px}
/* chrome */
.progress{position:fixed;top:0;left:0;height:2.5px;width:0;background:var(--gold-bright);z-index:60}
header.site{position:sticky;top:0;z-index:50;background:color-mix(in srgb,var(--navy) 96%,transparent);backdrop-filter:blur(8px);border-bottom:1px solid rgba(201,162,39,.18)}
header.site .wrap{display:flex;align-items:center;gap:22px;height:60px}
.brand{font-family:var(--disp);font-weight:700;font-size:17px;color:#FAF7EF;text-decoration:none;letter-spacing:.01em}
.brand b{color:var(--coral)}
nav.main{margin-left:auto;display:flex;gap:20px}
nav.main a{color:#C4CCD3;text-decoration:none;font-size:13.5px;padding:6px 2px}
nav.main a:hover,nav.main a[aria-current]{color:#FAF7EF;border-bottom:2px solid var(--coral)}
footer.site{background:var(--navy);color:#8A99A6;margin-top:90px;border-top:1px solid rgba(201,162,39,.18)}
footer.site .wrap{padding:34px 24px;display:flex;gap:14px;flex-wrap:wrap;justify-content:space-between;font-size:12.5px}
footer.site a{color:#C4CCD3;text-decoration:none}
.kicker{font-family:var(--mono);font-size:11px;letter-spacing:.16em;text-transform:uppercase;color:var(--gold)}
/* index */
.hero{padding:72px 0 34px}
.hero h1{font-family:var(--disp);font-size:clamp(34px,5.4vw,52px);letter-spacing:-.015em;line-height:1.04;margin:12px 0 14px}
.hero p{color:var(--ink2);font-size:17px;max-width:56ch}
.toolbar{display:flex;gap:10px;flex-wrap:wrap;align-items:center;padding:8px 0 26px;border-bottom:1px solid var(--line)}
.search{flex:1;min-width:220px;position:relative}
.search input{width:100%;padding:11px 14px 11px 38px;font:inherit;font-size:14px;color:var(--ink);background:transparent;border:1px solid var(--line);border-radius:9px;outline:none}
.search input:focus{border-color:var(--gold)}
.search svg{position:absolute;left:12px;top:50%;transform:translateY(-50%);opacity:.5}
.chip{font-family:var(--mono);font-size:10.5px;letter-spacing:.08em;text-transform:uppercase;border:1px solid var(--line);border-radius:999px;padding:7px 13px;background:none;color:var(--ink2);cursor:pointer}
.chip[aria-pressed="true"]{border-color:var(--coral);color:var(--coral)}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(320px,1fr));gap:22px;padding:30px 0}
.card{border:1px solid var(--line);border-radius:12px;padding:24px;display:flex;flex-direction:column;gap:12px;text-decoration:none;transition:transform .15s ease,border-color .15s}
.card:hover{transform:translateY(-2px);border-color:var(--gold)}
.card h2{font-family:var(--disp);font-size:21px;line-height:1.25;letter-spacing:-.01em}
.card p{color:var(--ink2);font-size:14px;line-height:1.55;flex:1}
.card .meta{display:flex;gap:10px;flex-wrap:wrap;align-items:center;font-family:var(--mono);font-size:10.5px;letter-spacing:.06em;color:var(--mut);text-transform:uppercase}
.tagrow{display:flex;gap:6px;flex-wrap:wrap}
.tag{font-family:var(--mono);font-size:9.5px;letter-spacing:.08em;text-transform:uppercase;border:1px solid var(--line);border-radius:999px;padding:3px 9px;color:var(--mut)}
.empty{padding:60px 0;color:var(--mut);text-align:center;font-size:14px;display:none}
/* article */
article.essay{max-width:70ch;margin:0 auto;padding:64px 24px 20px}
.essay .kicker-row{display:flex;gap:14px;flex-wrap:wrap;align-items:center;margin-bottom:18px}
.essay h1{font-family:var(--disp);font-size:clamp(32px,5vw,46px);line-height:1.08;letter-spacing:-.018em;margin:0 0 16px}
.dek{font-family:var(--serif);font-style:italic;font-size:20px;line-height:1.5;color:var(--ink2);margin-bottom:26px}
.byline{display:flex;gap:12px;align-items:center;padding:18px 0;border-top:1px solid var(--line);border-bottom:1px solid var(--line);margin-bottom:38px;font-size:13px;color:var(--ink2)}
.byline .avatar{width:38px;height:38px;border-radius:50%;background:var(--navy);color:#FAF7EF;display:flex;align-items:center;justify-content:center;font-family:var(--disp);font-weight:700;font-size:14px}
.byline .avatar span{color:var(--coral)}
.prose{font-family:var(--serif);font-size:18.5px;line-height:1.75;color:var(--ink)}
.prose p{margin:0 0 1.35em}
.prose>p:first-of-type{font-size:20px}
.prose h2{font-family:var(--disp);font-size:25px;letter-spacing:-.012em;line-height:1.2;margin:2em 0 .7em;scroll-margin-top:80px}
.prose h3{font-family:var(--disp);font-size:19px;margin:1.6em 0 .6em}
.prose a{color:var(--coral);text-decoration-thickness:1px;text-underline-offset:3px}
.prose blockquote{margin:2em 0;padding:.4em 0 .4em 1.4em;border-left:3px solid var(--coral);font-size:21px;line-height:1.55;font-style:italic;color:var(--ink2)}
.prose blockquote p{margin:0}
.prose ul,.prose ol{margin:0 0 1.35em;padding-left:1.3em}
.prose li{margin-bottom:.45em}
.prose code{font-family:var(--mono);font-size:.82em;background:color-mix(in srgb,var(--line) 45%,transparent);border:1px solid var(--line);border-radius:5px;padding:.08em .35em}
.prose .sep{text-align:center;color:var(--gold);letter-spacing:.6em;margin:2.4em 0;font-size:14px}
.prose img{max-width:100%;border-radius:10px;margin:1.5em 0}
figure.code{margin:1.8em 0;border:1px solid var(--line);border-radius:10px;overflow:hidden;background:var(--navy)}
figure.code pre{margin:0;padding:18px;overflow-x:auto}
figure.code code{font-family:var(--mono);font-size:13.5px;line-height:1.65;color:#E8E4D8;background:none;border:none;padding:0}
.tk-kw{color:#E4816F}.tk-str{color:#C9A227}.tk-com{color:#6C7B88;font-style:italic}.tk-num{color:#7FB3DA}
.endmatter{max-width:70ch;margin:0 auto;padding:0 24px}
.share{display:flex;gap:10px;flex-wrap:wrap;padding:26px 0;border-top:1px solid var(--line)}
.share a,.share button{font-family:var(--mono);font-size:10.5px;letter-spacing:.08em;text-transform:uppercase;border:1px solid var(--line);border-radius:999px;padding:8px 15px;color:var(--ink2);text-decoration:none;background:none;cursor:pointer}
.share a:hover,.share button:hover{border-color:var(--coral);color:var(--coral)}
.related{padding:34px 0 0}
.related h2{font-family:var(--disp);font-size:20px;margin:8px 0 18px}
@media(max-width:640px){.hero{padding:48px 0 24px}.grid{grid-template-columns:1fr}}
@media(prefers-reduced-motion:reduce){html{scroll-behavior:auto}.card{transition:none}}
`;

const FONTS = `<link rel="preconnect" href="https://fonts.googleapis.com"><link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;700&family=Inter:wght@400;500;600&family=Space+Mono:wght@400;700&display=swap" rel="stylesheet">`;

function chrome(active){
  return {
    head: `${FONTS}<link rel="stylesheet" href="/insights/insights.css"><link rel="alternate" type="application/rss+xml" title="${esc(SITE_NAME)}" href="${SITE_URL}/rss.xml">`,
    header: `<div class="progress" id="prog"></div><header class="site"><div class="wrap">
      <a class="brand" href="/">V<b>S</b></a>
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
<meta name="twitter:card" content="${p.cover?"summary_large_image":"summary"}"><meta name="twitter:title" content="${esc(p.title)}"><meta name="twitter:description" content="${esc(p.excerpt)}">
<script type="application/ld+json">${jsonld}</script>
${c.head}</head><body>
${c.header}
<article class="essay">
  <div class="kicker-row"><span class="kicker">Insights</span><span class="kicker" style="color:var(--mut)">${fmtDate(p.date)} · ${p.minutes} min read</span></div>
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
