import { useState, useEffect, useRef, useCallback } from "react";

// ─────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────
const THEMES = {
  paper: { name:"Papel", bg:"#F4E4C1", text:"#2C1810", page:"#FDF6E3", bar:"rgba(44,24,8,0.94)", barText:"#F4E4C1", texture:true },
  dark:  { name:"Noche", bg:"#0D0D0D", text:"#DDD5C5", page:"#111",    bar:"#181818",            barText:"#DDD5C5", texture:false },
  sepia: { name:"Sepia", bg:"#C8A96E", text:"#2C1A0E", page:"#F5DEB3", bar:"rgba(80,46,16,0.95)",barText:"#F5DEB3", texture:false },
  white: { name:"Blanco",bg:"#FAFAFA",  text:"#111",   page:"#FFFFFF", bar:"#111",               barText:"#FFF",   texture:false },
};

const BOOK_COLORS = [
  "#8B3A3A","#2E5C8A","#2D6A4F","#6B4C93",
  "#B5622A","#1A6B6B","#8A4F2A","#4A3728",
  "#C0392B","#1B4F72","#196F3D","#6C3483",
];

const FONTS = [
  { name:"Crimson Text",  val:'"Crimson Text", Georgia, serif' },
  { name:"Palatino",      val:'Palatino,"Book Antiqua",serif' },
  { name:"Georgia",       val:"Georgia,serif" },
  { name:"Courier New",   val:'"Courier New",monospace' },
  { name:"System Sans",   val:"system-ui,sans-serif" },
];

const CHARS_PER_PAGE = 2200;

// ─────────────────────────────────────────────
// STORAGE HELPERS
// ─────────────────────────────────────────────
async function sget(key, fallback = null) {
  try { const r = await window.storage.get(key); return r ? JSON.parse(r.value) : fallback; }
  catch { return fallback; }
}
async function sset(key, val) {
  try { await window.storage.set(key, JSON.stringify(val)); } catch {}
}

// ─────────────────────────────────────────────
// MAIN APP
// ─────────────────────────────────────────────
export default function App() {
  const [view, setView]               = useState("library");
  const [books, setBooks]             = useState([]);
  const [cats, setCats]               = useState(["Sin categoría","Ficción","No ficción","Ciencia","Arte","Historia"]);
  const [theme, setTheme]             = useState("paper");
  const [fontSize, setFontSize]       = useState(19);
  const [fontFam, setFontFam]         = useState(FONTS[0].val);
  const [bookmarks, setBookmarks]     = useState({});
  const [notes, setNotes]             = useState({});
  const [lastPages, setLastPages]     = useState({});
  const [readTime, setReadTime]       = useState({});
  const [cur, setCur]                 = useState(null);   // current book
  const [page, setPage]               = useState(1);
  const [totalPgs, setTotalPgs]       = useState(0);
  const [pdfDoc, setPdfDoc]           = useState(null);
  const [pdfReady, setPdfReady]       = useState(false);
  const [loading, setLoading]         = useState(false);
  const [zoom, setZoom]               = useState(1.0);
  const [showUpload, setShowUpload]   = useState(false);
  const [showCatMgr, setShowCatMgr]   = useState(false);
  const [showPanel, setShowPanel]     = useState(false);
  const [panelTab, setPanelTab]       = useState("bookmarks");
  const [showTheme, setShowTheme]     = useState(false);
  const [showNote, setShowNote]       = useState(false);
  const [noteText, setNoteText]       = useState("");
  const [showSearch, setShowSearch]   = useState(false);
  const [searchQ, setSearchQ]         = useState("");
  const [pageInput, setPageInput]     = useState("");
  const [ctxMenu, setCtxMenu]         = useState(null);  // {book, x, y}
  const [uploadState, setUploadState] = useState({ title:"", category:"Sin categoría", color:BOOK_COLORS[0], file:null, busy:false });
  const [newCat, setNewCat]           = useState("");
  const [lineH, setLineH]             = useState(1.85);
  const [spread, setSpread]           = useState(false);
  const [showStats, setShowStats]     = useState(false);

  const canvasRef     = useRef(null);
  const canvas2Ref    = useRef(null);
  const fileInputRef  = useRef(null);
  const renderTask    = useRef(null);
  const timerRef      = useRef(null);

  // ── Load PDF.js ────────────────────────────
  useEffect(() => {
    if (window.pdfjsLib) { setPdfReady(true); return; }
    const s = document.createElement("script");
    s.src = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js";
    s.onload = () => {
      window.pdfjsLib.GlobalWorkerOptions.workerSrc =
        "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
      setPdfReady(true);
    };
    document.head.appendChild(s);
  }, []);

  // ── Load persisted data ─────────────────────
  useEffect(() => {
    (async () => {
      const meta    = await sget("lib:books", []);
      const withFiles = await Promise.all(meta.map(async b => {
        const fd = await sget(`lib:file:${b.id}`, null);
        return fd ? { ...b, ...fd } : b;
      }));
      setBooks(withFiles);
      setCats(await sget("lib:cats", ["Sin categoría","Ficción","No ficción","Ciencia","Arte","Historia"]));
      setBookmarks(await sget("lib:bm", {}));
      setNotes(await sget("lib:notes", {}));
      setLastPages(await sget("lib:lp", {}));
      setReadTime(await sget("lib:rt", {}));
      setTheme(await sget("lib:theme", "paper") || "paper");
      setFontSize(await sget("lib:fs", 19) || 19);
    })();
  }, []);

  // ── Save books meta ─────────────────────────
  const saveBooksMeta = useCallback(async (list) => {
    await sset("lib:books", list.map(b => ({ ...b, fileData: undefined, pages: undefined })));
  }, []);

  // ── Open book ───────────────────────────────
  const openBook = useCallback(async (book) => {
    if (!book.fileData && book.type !== "text") { alert("Archivo no disponible. Por favor súbelo de nuevo."); return; }
    setCur(book);
    const startPg = lastPages[book.id] || 1;
    setPage(startPg);
    setView("reader");
    setShowPanel(false);
    setShowTheme(false);
    setShowNote(false);
    setZoom(1.0);
    setCtxMenu(null);

    if (book.type === "pdf" && pdfReady) {
      setLoading(true);
      try {
        const bytes = atob(book.fileData);
        const arr   = new Uint8Array(bytes.length);
        for (let i = 0; i < bytes.length; i++) arr[i] = bytes.charCodeAt(i);
        const doc = await window.pdfjsLib.getDocument({ data: arr }).promise;
        setPdfDoc(doc);
        setTotalPgs(doc.numPages);
      } catch(e) { console.error(e); }
      setLoading(false);
    } else if (book.type === "text") {
      setPdfDoc(null);
      setTotalPgs(book.pages?.length || 1);
    } else {
      setPdfDoc(null);
      setTotalPgs(1);
    }

    timerRef.current = setInterval(() => {
      setReadTime(prev => {
        const u = { ...prev, [book.id]: (prev[book.id] || 0) + 1 };
        sset("lib:rt", u);
        return u;
      });
    }, 60000);
  }, [lastPages, pdfReady]);

  // ── Render PDF page(s) ──────────────────────
  useEffect(() => {
    if (!pdfDoc || view !== "reader" || !cur || cur.type !== "pdf") return;

    const renderOne = async (pg, ref, scale) => {
      if (!ref.current) return;
      try {
        const p   = await pdfDoc.getPage(pg);
        const vp  = p.getViewport({ scale: scale * zoom });
        const c   = ref.current;
        c.width   = vp.width;
        c.height  = vp.height;
        const task = p.render({ canvasContext: c.getContext("2d"), viewport: vp });
        await task.promise;
        return task;
      } catch {}
    };

    setLoading(true);
    if (renderTask.current) { try { renderTask.current.cancel(); } catch {} }
    (async () => {
      await renderOne(page, canvasRef, 1.5);
      if (spread && page + 1 <= totalPgs) await renderOne(page + 1, canvas2Ref, 1.5);
      setLoading(false);
    })();
  }, [pdfDoc, page, zoom, view, cur, spread, totalPgs]);

  // ── Close book ──────────────────────────────
  const closeBook = useCallback(async () => {
    if (cur) {
      const u = { ...lastPages, [cur.id]: page };
      setLastPages(u);
      await sset("lib:lp", u);
    }
    clearInterval(timerRef.current);
    setPdfDoc(null);
    setCur(null);
    setView("library");
  }, [cur, page, lastPages]);

  // ── Navigate ────────────────────────────────
  const goTo = useCallback((p) => {
    setPage(Math.max(1, Math.min(totalPgs, p)));
  }, [totalPgs]);

  // ── Bookmark toggle ─────────────────────────
  const toggleBm = useCallback(async () => {
    if (!cur) return;
    const bm = bookmarks[cur.id] || [];
    const u  = bm.includes(page)
      ? { ...bookmarks, [cur.id]: bm.filter(x => x !== page) }
      : { ...bookmarks, [cur.id]: [...bm, page].sort((a,b) => a-b) };
    setBookmarks(u);
    await sset("lib:bm", u);
  }, [bookmarks, cur, page]);

  // ── Add note ────────────────────────────────
  const saveNote = useCallback(async () => {
    if (!cur || !noteText.trim()) return;
    const arr = notes[cur.id] || [];
    const n   = { id: Date.now(), page, text: noteText };
    const u   = { ...notes, [cur.id]: [...arr, n] };
    setNotes(u);
    await sset("lib:notes", u);
    setNoteText(""); setShowNote(false);
  }, [notes, cur, page, noteText]);

  // ── Delete book ─────────────────────────────
  const deleteBook = useCallback(async (book) => {
    const updated = books.filter(b => b.id !== book.id);
    setBooks(updated);
    await saveBooksMeta(updated);
    try { await window.storage.delete(`lib:file:${book.id}`); } catch {}
    setCtxMenu(null);
  }, [books, saveBooksMeta]);

  // ── Upload ──────────────────────────────────
  const doUpload = useCallback(async () => {
    const { file, title, category, color } = uploadState;
    if (!file) return;
    setUploadState(p => ({ ...p, busy: true }));

    const reader = new FileReader();
    reader.onload = async (e) => {
      const b64   = e.target.result.split(",")[1];
      let type    = "pdf";
      let pages   = null;

      if (file.type.startsWith("image/")) {
        type = "image";
      } else if (file.type === "text/plain") {
        type  = "text";
        const raw = decodeURIComponent(escape(atob(b64)));
        pages = [];
        for (let i = 0; i < raw.length; i += CHARS_PER_PAGE)
          pages.push(raw.slice(i, i + CHARS_PER_PAGE));
      }

      const book = {
        id:       Date.now().toString(),
        title:    title || file.name.replace(/\.[^.]+$/, ""),
        category, color, type, pages,
        fileData: b64,
        added:    new Date().toISOString(),
        size:     file.size,
      };

      const nb = [...books, book];
      setBooks(nb);
      await saveBooksMeta(nb);
      try { await sset(`lib:file:${book.id}`, { fileData: b64, pages }); }
      catch { /* file too large */ }

      setUploadState({ title:"", category:"Sin categoría", color:BOOK_COLORS[0], file:null, busy:false });
      setShowUpload(false);
    };
    reader.readAsDataURL(file);
  }, [uploadState, books, saveBooksMeta]);

  // ─────────────────────────────────────────────
  // DERIVED STATE
  // ─────────────────────────────────────────────
  const T           = THEMES[theme];
  const isBm        = cur && (bookmarks[cur.id] || []).includes(page);
  const pgNotes     = cur ? (notes[cur.id] || []).filter(n => n.page === page) : [];
  const progress    = totalPgs > 0 ? (page / totalPgs) * 100 : 0;
  const fmtTime     = (m) => !m ? "0 min" : m < 60 ? `${m} min` : `${Math.floor(m/60)}h ${m%60}m`;

  const byCategory  = {};
  cats.forEach(c => {
    const cb = books.filter(b => b.category === c);
    if (cb.length) byCategory[c] = cb;
  });
  const other = books.filter(b => !cats.includes(b.category));
  if (other.length) byCategory["Otros"] = other;

  const recentlyRead = [...books]
    .filter(b => lastPages[b.id])
    .sort((a,b) => (lastPages[b.id] || 0) - (lastPages[a.id] || 0))
    .slice(0, 6);

  // ─────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────
  return (
    <div onClick={() => setCtxMenu(null)} style={{ fontFamily:'"Crimson Text",Georgia,serif', minHeight:"100vh", background: view==="reader" ? T.page : "#1E0E04", color:"#F4E4C1", transition:"background 0.3s" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,700;0,900;1,400&family=Crimson+Text:ital,wght@0,400;0,600;1,400&display=swap');
        *{box-sizing:border-box;margin:0;padding:0}
        ::-webkit-scrollbar{width:5px;height:5px}
        ::-webkit-scrollbar-track{background:rgba(0,0,0,.2)}
        ::-webkit-scrollbar-thumb{background:rgba(180,120,60,.45);border-radius:4px}
        .bk{cursor:pointer;transition:transform .2s,box-shadow .2s}
        .bk:hover{transform:translateY(-10px) scale(1.04);box-shadow:6px 12px 28px rgba(0,0,0,.65)!important}
        .btn{cursor:pointer;border:none;background:none;transition:opacity .15s,transform .12s;font-family:inherit}
        .btn:hover{opacity:.82}
        .btn:active{transform:scale(.96)}
        .si{animation:si .28s ease}@keyframes si{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)}}
        .fi{animation:fi .35s ease}@keyframes fi{from{opacity:0}to{opacity:1}}
        .spin{animation:sp 1s linear infinite}@keyframes sp{to{transform:rotate(360deg)}}
        input,textarea,select{font-family:inherit;color:#F4E4C1;background:rgba(0,0,0,.35);border:1px solid rgba(180,120,60,.35);border-radius:8px;padding:8px 12px}
        input:focus,textarea:focus,select:focus{outline:none;border-color:rgba(180,120,60,.75)}
        .overlay{position:fixed;inset:0;background:rgba(0,0,0,.75);z-index:1000;display:flex;align-items:center;justify-content:center;backdrop-filter:blur(5px)}
        .modal{background:#1E0E04;border:1px solid rgba(180,120,60,.3);border-radius:18px;padding:32px;max-width:500px;width:90%;color:#F4E4C1;box-shadow:0 20px 60px rgba(0,0,0,.85)}
        .tag{display:inline-block;padding:2px 8px;border-radius:20px;font-size:.7rem;background:rgba(180,120,60,.15);color:rgba(212,168,83,.7);border:1px solid rgba(180,120,60,.2)}
        .paper-lines::before{content:'';position:absolute;left:72px;top:0;bottom:0;width:1px;background:rgba(220,50,50,.12);pointer-events:none}
        .paper-lines::after{content:'';position:absolute;left:14px;top:0;bottom:0;width:2px;background:rgba(255,160,40,.18);pointer-events:none}
      `}</style>

      {/* ═══════════════ LIBRARY ═══════════════ */}
      {view === "library" && (
        <div className="fi">
          {/* Header */}
          <div style={{ background:"linear-gradient(180deg,#100500 0%,#1E0E04 100%)", borderBottom:"1px solid rgba(180,120,60,.25)", padding:"20px 28px", display:"flex", alignItems:"center", justifyContent:"space-between", position:"sticky", top:0, zIndex:50 }}>
            <div>
              <h1 style={{ fontFamily:'"Playfair Display",serif', fontSize:"1.9rem", fontWeight:900, color:"#D4A853", letterSpacing:".04em", lineHeight:1 }}>
                📚 Mi Biblioteca
              </h1>
              <p style={{ fontSize:".8rem", color:"rgba(212,168,83,.5)", marginTop:3 }}>
                {books.length} {books.length===1?"libro":"libros"} · {Object.keys(byCategory).length} {Object.keys(byCategory).length===1?"categoría":"categorías"}
              </p>
            </div>
            <div style={{ display:"flex", gap:10 }}>
              <button className="btn" onClick={() => setShowStats(true)} style={{ background:"rgba(180,120,60,.12)", border:"1px solid rgba(180,120,60,.25)", color:"#D4A853", borderRadius:10, padding:"9px 14px", fontSize:".82rem" }}>
                📊 Estadísticas
              </button>
              <button className="btn" onClick={() => setShowCatMgr(true)} style={{ background:"rgba(180,120,60,.12)", border:"1px solid rgba(180,120,60,.25)", color:"#D4A853", borderRadius:10, padding:"9px 14px", fontSize:".82rem" }}>
                🗂 Categorías
              </button>
              <button className="btn" onClick={() => setShowUpload(true)} style={{ background:"linear-gradient(135deg,#A0541E,#7A2E2E)", color:"#FFF", borderRadius:10, padding:"9px 20px", fontSize:".88rem", fontWeight:700, boxShadow:"0 4px 14px rgba(160,84,30,.45)" }}>
                + Agregar
              </button>
            </div>
          </div>

          <div style={{ padding:"24px 28px" }}>
            {/* Recently read */}
            {recentlyRead.length > 0 && (
              <div style={{ marginBottom:40 }}>
                <h2 style={{ fontFamily:'"Playfair Display",serif', color:"#D4A853", fontSize:"1.05rem", marginBottom:14, opacity:.7 }}>
                  Recientes
                </h2>
                <div style={{ display:"flex", gap:12, overflowX:"auto", paddingBottom:8 }}>
                  {recentlyRead.map(book => {
                    const pg  = lastPages[book.id] || 1;
                    const pct = book.type==="text" && book.pages ? Math.round(pg/book.pages.length*100) : 0;
                    return (
                      <div key={book.id} className="bk" onClick={() => openBook(book)} style={{ minWidth:100, display:"flex", flexDirection:"column", alignItems:"center", gap:8 }}>
                        <div style={{ width:70, height:95, background:`linear-gradient(135deg,${book.color}dd,${book.color}88)`, borderRadius:"3px 6px 6px 3px", boxShadow:"3px 5px 14px rgba(0,0,0,.5)", display:"flex", alignItems:"center", justifyContent:"center", position:"relative", overflow:"hidden" }}>
                          <span style={{ color:"rgba(255,255,255,.8)", fontSize:".55rem", fontFamily:'"Playfair Display",serif', fontWeight:700, textAlign:"center", padding:"4px 6px", lineHeight:1.3 }}>{book.title}</span>
                          {pct > 0 && <div style={{ position:"absolute", bottom:0, left:0, right:0, height:3, background:"rgba(0,0,0,.3)" }}><div style={{ height:"100%", width:`${pct}%`, background:"#FFD700" }}/></div>}
                        </div>
                        <p style={{ fontSize:".65rem", color:"rgba(212,168,83,.55)", textAlign:"center", maxWidth:90, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>p.{pg}</p>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Empty */}
            {books.length === 0 && (
              <div style={{ textAlign:"center", padding:"80px 0", color:"rgba(212,168,83,.35)" }}>
                <div style={{ fontSize:"5rem", marginBottom:18 }}>📖</div>
                <p style={{ fontFamily:'"Playfair Display",serif', fontSize:"1.3rem", color:"rgba(212,168,83,.6)" }}>Tu biblioteca está vacía</p>
                <p style={{ fontSize:".88rem", marginTop:8, opacity:.6 }}>Sube un PDF, TXT o imagen para comenzar</p>
                <button className="btn" onClick={() => setShowUpload(true)} style={{ marginTop:24, background:"linear-gradient(135deg,#A0541E,#7A2E2E)", color:"#FFF", borderRadius:12, padding:"14px 28px", fontSize:"1rem", fontWeight:700 }}>
                  + Agregar mi primer libro
                </button>
              </div>
            )}

            {/* Shelves by category */}
            {Object.entries(byCategory).map(([cat, cBooks]) => (
              <div key={cat} style={{ marginBottom:44 }}>
                <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:10 }}>
                  <h2 style={{ fontFamily:'"Playfair Display",serif', color:"#D4A853", fontSize:"1.1rem", fontWeight:700 }}>{cat}</h2>
                  <span style={{ color:"rgba(212,168,83,.35)", fontSize:".78rem" }}>({cBooks.length})</span>
                </div>
                <div style={{ background:"linear-gradient(180deg,#4A2208 0%,#3A1A06 40%,#2E1204 100%)", borderRadius:"4px 4px 6px 6px", padding:"20px 20px 0", boxShadow:"inset 0 2px 8px rgba(0,0,0,.5),0 6px 0 #1E0900", border:"1px solid rgba(120,70,20,.25)" }}>
                  <div style={{ display:"flex", gap:6, alignItems:"flex-end", overflowX:"auto", minHeight:130, paddingBottom:0 }}>
                    {cBooks.map((book, idx) => {
                      const h = 100 + (idx%4)*18;
                      const w = 26 + (idx%5)*5;
                      const bm = (bookmarks[book.id]||[]).length;
                      const lp = lastPages[book.id];
                      const totalB = book.type==="text" ? book.pages?.length : null;
                      return (
                        <div key={book.id} className="bk"
                          onClick={() => openBook(book)}
                          onContextMenu={e => { e.preventDefault(); e.stopPropagation(); setCtxMenu({ book, x:e.clientX, y:e.clientY }); }}
                          style={{ width:w, height:h, minWidth:w, background:`linear-gradient(150deg,${book.color}ee,${book.color}88)`, borderRadius:"2px 4px 4px 2px", boxShadow:"2px 4px 14px rgba(0,0,0,.55),inset 2px 0 5px rgba(255,255,255,.08)", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", position:"relative", overflow:"hidden", cursor:"pointer" }}>
                          <div style={{ writingMode:"vertical-rl", transform:"rotate(180deg)", color:"rgba(255,255,255,.9)", fontSize:".6rem", fontWeight:700, fontFamily:'"Playfair Display",serif', textAlign:"center", padding:"4px 2px", maxHeight:h-24, overflow:"hidden", textShadow:"0 1px 4px rgba(0,0,0,.6)", lineHeight:1.25 }}>
                            {book.title}
                          </div>
                          {bm > 0 && <div style={{ position:"absolute", top:0, right:3, width:6, height:15, background:"#FFD700", borderRadius:"0 0 3px 3px" }}/>}
                          {lp && totalB && <div style={{ position:"absolute", bottom:0, left:0, right:0, height:3, background:"rgba(0,0,0,.35)" }}><div style={{ height:"100%", width:`${Math.min(100,(lp/totalB)*100)}%`, background:"rgba(255,215,0,.7)" }}/></div>}
                          <div style={{ position:"absolute", top:0, left:0, bottom:0, width:"28%", background:"linear-gradient(90deg,rgba(255,255,255,.14),transparent)", pointerEvents:"none" }}/>
                        </div>
                      );
                    })}
                  </div>
                  <div style={{ height:11, background:"linear-gradient(180deg,#5C2E10,#3A1A06)", margin:"0 -20px", borderRadius:"0 0 6px 6px", boxShadow:"0 4px 8px rgba(0,0,0,.45)" }}/>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ═══════════════ READER ════════════════ */}
      {view === "reader" && cur && (
        <div className="fi" style={{ minHeight:"100vh", background:T.page, display:"flex", flexDirection:"column", position:"relative" }}>

          {/* TOP BAR */}
          <div style={{ background:T.bar, color:T.barText, padding:"10px 14px", display:"flex", alignItems:"center", justifyContent:"space-between", position:"sticky", top:0, zIndex:100, boxShadow:"0 2px 14px rgba(0,0,0,.45)", gap:8 }}>
            {/* Left */}
            <div style={{ display:"flex", alignItems:"center", gap:10, minWidth:0 }}>
              <button className="btn" onClick={closeBook} style={{ background:"rgba(255,255,255,.1)", color:T.barText, borderRadius:8, padding:"6px 12px", fontSize:".82rem", border:"1px solid rgba(255,255,255,.15)", whiteSpace:"nowrap" }}>
                ← Biblioteca
              </button>
              <span style={{ fontFamily:'"Playfair Display",serif', fontWeight:700, fontSize:".95rem", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", maxWidth:200, color:T.barText }}>
                {cur.title}
              </span>
              <span className="tag">{cur.category}</span>
            </div>
            {/* Right toolbar */}
            <div style={{ display:"flex", alignItems:"center", gap:5, flexShrink:0 }}>
              {[
                { icon:"−", title:"Zoom −",   action:() => setZoom(z=>Math.max(.4,+(z-.1).toFixed(1))), active:false },
                { icon:"+", title:"Zoom +",   action:() => setZoom(z=>Math.min(3,+(z+.1).toFixed(1))), active:false },
              ].map(({icon,title,action},i) => (
                <button key={i} className="btn" onClick={action} title={title} style={{ background:"rgba(255,255,255,.1)", color:T.barText, borderRadius:6, padding:"5px 10px", border:"1px solid rgba(255,255,255,.13)", fontSize:".95rem" }}>{icon}</button>
              ))}
              <span style={{ color:T.barText, fontSize:".77rem", opacity:.7, minWidth:34, textAlign:"center" }}>{Math.round(zoom*100)}%</span>
              <div style={{ width:1, height:20, background:"rgba(255,255,255,.18)", margin:"0 2px" }}/>
              {[
                { icon:"🔖", title:"Marcar",         action:toggleBm,                         active:isBm },
                { icon:"📝", title:"Agregar nota",   action:()=>{setShowNote(!showNote);setShowTheme(false);setShowPanel(false);}, active:showNote },
                { icon:"🔍", title:"Buscar",         action:()=>{setShowSearch(!showSearch);}, active:showSearch },
                { icon:"📄", title:"Doble página",   action:()=>setSpread(!spread),           active:spread, pdfOnly:true },
                { icon:"🎨", title:"Apariencia",     action:()=>{setShowTheme(!showTheme);setShowPanel(false);setShowNote(false);}, active:showTheme },
                { icon:"☰",  title:"Panel",         action:()=>{setShowPanel(!showPanel);setShowTheme(false);setShowNote(false);}, active:showPanel },
              ].filter(x => !x.pdfOnly || cur.type==="pdf").map(({icon,title,action,active},i) => (
                <button key={i} className="btn" onClick={action} title={title} style={{ background:active?"rgba(180,120,60,.35)":"rgba(255,255,255,.1)", color:T.barText, borderRadius:6, padding:"5px 9px", border:"1px solid rgba(255,255,255,.13)", fontSize:"1rem" }}>{icon}</button>
              ))}
            </div>
          </div>

          {/* Search bar */}
          {showSearch && (
            <div style={{ background:T.bar, padding:"8px 14px", display:"flex", gap:8, borderBottom:"1px solid rgba(255,255,255,.1)" }}>
              <input value={searchQ} onChange={e=>setSearchQ(e.target.value)} placeholder="Buscar en el texto..." style={{ flex:1, background:"rgba(255,255,255,.1)", color:T.barText, border:"1px solid rgba(255,255,255,.2)", borderRadius:7, padding:"6px 12px", fontSize:".88rem" }}/>
              <button className="btn" onClick={()=>{setSearchQ("");setShowSearch(false);}} style={{ background:"rgba(255,255,255,.1)", color:T.barText, borderRadius:7, padding:"6px 10px", border:"none", fontSize:".88rem" }}>✕</button>
            </div>
          )}

          {/* Notes on page indicator */}
          {pgNotes.length > 0 && (
            <div onClick={()=>{setShowPanel(true);setPanelTab("notes");}} style={{ background:"rgba(255,215,0,.1)", borderLeft:"3px solid #FFD700", padding:"7px 16px", fontSize:".82rem", color:T.text, cursor:"pointer", display:"flex", gap:8, alignItems:"center" }}>
              📝 {pgNotes.length} {pgNotes.length===1?"nota":"notas"} en esta página — <span style={{ textDecoration:"underline" }}>ver</span>
            </div>
          )}

          {/* Content + side panel */}
          <div style={{ flex:1, display:"flex", overflow:"hidden" }}>
            {/* Page content */}
            <div style={{ flex:1, overflowY:"auto", overflowX:"auto", display:"flex", flexDirection:"column", alignItems:"center", padding:"28px 16px", background:T.page, minHeight:0, maxHeight:"calc(100vh - 112px)" }}>
              {loading && (
                <div style={{ display:"flex", alignItems:"center", justifyContent:"center", height:400, color:T.text, gap:12, opacity:.5 }}>
                  <span className="spin" style={{ fontSize:"1.8rem", display:"inline-block" }}>⟳</span>
                  <span>Cargando...</span>
                </div>
              )}

              {/* PDF */}
              {cur.type==="pdf" && (
                <div style={{ display:"flex", gap:16, alignItems:"flex-start" }}>
                  <div style={{ boxShadow:"0 4px 28px rgba(0,0,0,.3)", borderRadius:3 }}>
                    <canvas ref={canvasRef} style={{ display:"block", maxWidth:"100%", borderRadius:3 }}/>
                  </div>
                  {spread && page+1<=totalPgs && (
                    <div style={{ boxShadow:"0 4px 28px rgba(0,0,0,.3)", borderRadius:3 }}>
                      <canvas ref={canvas2Ref} style={{ display:"block", maxWidth:"100%", borderRadius:3 }}/>
                    </div>
                  )}
                </div>
              )}

              {/* Text */}
              {cur.type==="text" && cur.pages && (
                <div className={theme==="paper"?"paper-lines":""} style={{ maxWidth:700, width:"100%", background:T.page, padding:"52px 60px", boxShadow:"0 4px 28px rgba(0,0,0,.15)", borderRadius:4, minHeight:620, position:"relative" }}>
                  {theme==="paper" && Array.from({length:28},(_,i) => (
                    <div key={i} style={{ position:"absolute", left:0, right:0, top: 52 + i*Math.round(fontSize*lineH), height:1, background:"rgba(70,130,200,.07)", pointerEvents:"none" }}/>
                  ))}
                  <p style={{ fontSize, lineHeight:lineH, color:T.text, fontFamily:fontFam, whiteSpace:"pre-wrap", position:"relative", zIndex:1 }}>
                    {searchQ
                      ? cur.pages[page-1]?.split(new RegExp(`(${searchQ.replace(/[.*+?^${}()|[\]\\]/g,"\\$&")})`, "gi")).map((pt,i) =>
                          pt.toLowerCase()===searchQ.toLowerCase()
                            ? <mark key={i} style={{ background:"#FFD700", color:"#111", borderRadius:2 }}>{pt}</mark>
                            : pt
                        )
                      : cur.pages[page-1]
                    }
                  </p>
                </div>
              )}

              {/* Image */}
              {cur.type==="image" && (
                <img src={`data:image/*;base64,${cur.fileData}`} alt={cur.title} style={{ maxWidth:"100%", maxHeight:"calc(100vh-220px)", objectFit:"contain", boxShadow:"0 4px 28px rgba(0,0,0,.3)", borderRadius:4, transform:`scale(${zoom})`, transformOrigin:"top center" }}/>
              )}

              {/* No file data */}
              {!cur.fileData && cur.type!=="text" && (
                <div style={{ textAlign:"center", padding:"80px 0", color:T.text, opacity:.4 }}>
                  <div style={{ fontSize:"4rem", marginBottom:16 }}>⚠️</div>
                  <p>El archivo no está disponible.</p>
                  <p style={{ fontSize:".85rem", marginTop:8 }}>Regresa a la biblioteca y sube el archivo nuevamente.</p>
                </div>
              )}
            </div>

            {/* Side panel */}
            {showPanel && (
              <div className="si" style={{ width:288, background:theme==="dark"?"#161616":"#1E0E04", borderLeft:"1px solid rgba(180,120,60,.2)", display:"flex", flexDirection:"column", overflow:"hidden" }}>
                <div style={{ display:"flex", borderBottom:"1px solid rgba(180,120,60,.18)" }}>
                  {[{id:"bookmarks",icon:"🔖",label:"Marcas"},{id:"notes",icon:"📝",label:"Notas"},{id:"info",icon:"ℹ️",label:"Info"}].map(t=>(
                    <button key={t.id} className="btn" onClick={()=>setPanelTab(t.id)} style={{ flex:1, padding:"11px 4px", background:panelTab===t.id?"rgba(180,120,60,.2)":"transparent", color:panelTab===t.id?"#D4A853":"rgba(212,168,83,.45)", borderBottom:panelTab===t.id?"2px solid #D4A853":"2px solid transparent", fontSize:".72rem", display:"flex", flexDirection:"column", alignItems:"center", gap:2 }}>
                      <span>{t.icon}</span><span>{t.label}</span>
                    </button>
                  ))}
                </div>

                <div style={{ flex:1, overflowY:"auto", padding:14 }}>
                  {/* Bookmarks */}
                  {panelTab==="bookmarks" && (
                    <div>
                      <p style={{ color:"#D4A853", fontFamily:'"Playfair Display",serif', marginBottom:12, fontSize:".92rem" }}>Páginas marcadas</p>
                      {(bookmarks[cur.id]||[]).length===0
                        ? <p style={{ color:"rgba(212,168,83,.35)", fontSize:".82rem", textAlign:"center", marginTop:24, lineHeight:1.7 }}>Sin marcas aún.<br/>Usa 🔖 para marcar una página.</p>
                        : (bookmarks[cur.id]||[]).map(pg=>(
                          <div key={pg} style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"8px 11px", marginBottom:6, background:pg===page?"rgba(212,168,83,.18)":"rgba(255,255,255,.05)", borderRadius:8, cursor:"pointer", border:pg===page?"1px solid rgba(212,168,83,.4)":"1px solid transparent" }} onClick={()=>goTo(pg)}>
                            <span style={{ color:"#D4A853", fontSize:".88rem" }}>📄 Página {pg}</span>
                            <button className="btn" onClick={e=>{e.stopPropagation();const u={...bookmarks,[cur.id]:(bookmarks[cur.id]||[]).filter(x=>x!==pg)};setBookmarks(u);sset("lib:bm",u);}} style={{ color:"rgba(212,168,83,.35)", fontSize:".75rem", padding:"2px 5px" }}>✕</button>
                          </div>
                        ))
                      }
                    </div>
                  )}

                  {/* Notes */}
                  {panelTab==="notes" && (
                    <div>
                      <p style={{ color:"#D4A853", fontFamily:'"Playfair Display",serif', marginBottom:12, fontSize:".92rem" }}>Notas ({(notes[cur.id]||[]).length})</p>
                      {(notes[cur.id]||[]).length===0
                        ? <p style={{ color:"rgba(212,168,83,.35)", fontSize:".82rem", textAlign:"center", marginTop:24, lineHeight:1.7 }}>Sin notas aún.<br/>Usa 📝 para agregar una nota.</p>
                        : [...(notes[cur.id]||[])].sort((a,b)=>a.page-b.page).map(n=>(
                          <div key={n.id} style={{ padding:"10px 12px", marginBottom:8, background:"rgba(255,215,0,.07)", border:"1px solid rgba(255,215,0,.18)", borderLeft:"3px solid #FFD700", borderRadius:"0 8px 8px 0", cursor:"pointer" }} onClick={()=>goTo(n.page)}>
                            <div style={{ display:"flex", justifyContent:"space-between", marginBottom:4 }}>
                              <span style={{ color:"rgba(212,168,83,.55)", fontSize:".72rem" }}>p.{n.page}</span>
                              <button className="btn" onClick={e=>{e.stopPropagation();const arr=(notes[cur.id]||[]).filter(x=>x.id!==n.id);const u={...notes,[cur.id]:arr};setNotes(u);sset("lib:notes",u);}} style={{ color:"rgba(212,168,83,.35)", fontSize:".72rem", padding:"1px 4px" }}>✕</button>
                            </div>
                            <p style={{ color:"#D4A853", fontSize:".82rem", lineHeight:1.5 }}>{n.text}</p>
                          </div>
                        ))
                      }
                      {/* Export notes */}
                      {(notes[cur.id]||[]).length>0 && (
                        <button className="btn" onClick={()=>{
                          const txt = (notes[cur.id]||[]).sort((a,b)=>a.page-b.page).map(n=>`[p.${n.page}] ${n.text}`).join("\n\n");
                          const a = document.createElement("a"); a.href = "data:text/plain;charset=utf-8,"+encodeURIComponent(`Notas: ${cur.title}\n\n${txt}`); a.download = `notas-${cur.title}.txt`; a.click();
                        }} style={{ marginTop:10, width:"100%", background:"rgba(212,168,83,.12)", color:"#D4A853", borderRadius:8, padding:"8px", fontSize:".8rem", border:"1px solid rgba(212,168,83,.2)" }}>
                          ↓ Exportar notas
                        </button>
                      )}
                    </div>
                  )}

                  {/* Info */}
                  {panelTab==="info" && (
                    <div>
                      <p style={{ color:"#D4A853", fontFamily:'"Playfair Display",serif', marginBottom:14, fontSize:".92rem" }}>Información</p>
                      {[
                        ["Título",      cur.title],
                        ["Categoría",   cur.category],
                        ["Formato",     cur.type?.toUpperCase()],
                        ["Total págs",  totalPgs],
                        ["Pág. actual", page],
                        ["Progreso",    `${Math.round(progress)}%`],
                        ["Marcas",      (bookmarks[cur.id]||[]).length],
                        ["Notas",       (notes[cur.id]||[]).length],
                        ["Tiempo",      fmtTime(readTime[cur.id])],
                        ["Agregado",    new Date(cur.added).toLocaleDateString("es")],
                      ].map(([l,v])=>(
                        <div key={l} style={{ display:"flex", justifyContent:"space-between", padding:"7px 0", borderBottom:"1px solid rgba(180,120,60,.1)" }}>
                          <span style={{ color:"rgba(212,168,83,.5)", fontSize:".78rem" }}>{l}</span>
                          <span style={{ color:"#D4A853", fontSize:".82rem", fontWeight:600 }}>{v}</span>
                        </div>
                      ))}
                      <div style={{ marginTop:18, height:5, background:"rgba(255,255,255,.08)", borderRadius:4, overflow:"hidden" }}>
                        <div style={{ height:"100%", width:`${progress}%`, background:"linear-gradient(90deg,#A0541E,#D4A853)", borderRadius:4, transition:"width .3s" }}/>
                      </div>
                      <p style={{ color:"rgba(212,168,83,.35)", fontSize:".7rem", textAlign:"right", marginTop:5 }}>{Math.round(progress)}% completado</p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Theme panel dropdown */}
          {showTheme && (
            <div className="si" style={{ position:"fixed", top:56, right:12, background:"#1E0E04", border:"1px solid rgba(180,120,60,.3)", borderRadius:14, padding:18, zIndex:200, width:300, boxShadow:"0 8px 36px rgba(0,0,0,.7)" }}>
              <p style={{ color:"#D4A853", fontFamily:'"Playfair Display",serif', marginBottom:14, fontSize:".95rem" }}>🎨 Apariencia</p>

              <div style={{ marginBottom:16 }}>
                <p style={{ fontSize:".77rem", color:"rgba(212,168,83,.55)", marginBottom:8 }}>Fondo / Modo</p>
                <div style={{ display:"flex", gap:7 }}>
                  {Object.entries(THEMES).map(([k,th])=>(
                    <button key={k} className="btn" onClick={()=>{setTheme(k);sset("lib:theme",k);}} style={{ flex:1, padding:"10px 4px", background:th.page, border:theme===k?"2px solid #D4A853":"2px solid transparent", borderRadius:9, display:"flex", flexDirection:"column", alignItems:"center", gap:4, color:th.text, fontSize:".65rem", fontWeight:700 }}>
                      {th.name}
                    </button>
                  ))}
                </div>
              </div>

              {cur.type==="text" && <>
                <div style={{ marginBottom:14 }}>
                  <p style={{ fontSize:".77rem", color:"rgba(212,168,83,.55)", marginBottom:8 }}>Tamaño de letra</p>
                  <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                    <button className="btn" onClick={()=>setFontSize(f=>Math.max(12,f-2))} style={{ background:"rgba(180,120,60,.18)", color:"#D4A853", borderRadius:7, padding:"6px 14px", border:"none", fontWeight:700 }}>A−</button>
                    <span style={{ color:"#D4A853", flex:1, textAlign:"center", fontSize:".88rem" }}>{fontSize}px</span>
                    <button className="btn" onClick={()=>{setFontSize(f=>Math.min(34,f+2));sset("lib:fs",fontSize+2);}} style={{ background:"rgba(180,120,60,.18)", color:"#D4A853", borderRadius:7, padding:"6px 14px", border:"none", fontWeight:700 }}>A+</button>
                  </div>
                </div>

                <div style={{ marginBottom:14 }}>
                  <p style={{ fontSize:".77rem", color:"rgba(212,168,83,.55)", marginBottom:8 }}>Interlineado</p>
                  <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                    <button className="btn" onClick={()=>setLineH(l=>Math.max(1.2,+(l-.1).toFixed(1)))} style={{ background:"rgba(180,120,60,.18)", color:"#D4A853", borderRadius:7, padding:"6px 12px", border:"none" }}>−</button>
                    <span style={{ color:"#D4A853", flex:1, textAlign:"center", fontSize:".88rem" }}>{lineH.toFixed(1)}</span>
                    <button className="btn" onClick={()=>setLineH(l=>Math.min(3,+(l+.1).toFixed(1)))} style={{ background:"rgba(180,120,60,.18)", color:"#D4A853", borderRadius:7, padding:"6px 12px", border:"none" }}>+</button>
                  </div>
                </div>

                <div>
                  <p style={{ fontSize:".77rem", color:"rgba(212,168,83,.55)", marginBottom:8 }}>Fuente tipográfica</p>
                  <select value={fontFam} onChange={e=>setFontFam(e.target.value)} style={{ width:"100%", background:"rgba(0,0,0,.35)", color:"#D4A853", border:"1px solid rgba(180,120,60,.3)", borderRadius:8, padding:"8px 10px" }}>
                    {FONTS.map(f=><option key={f.val} value={f.val}>{f.name}</option>)}
                  </select>
                </div>
              </>}
            </div>
          )}

          {/* Add note popup */}
          {showNote && (
            <div className="si" style={{ position:"fixed", bottom:80, right:showPanel?302:12, background:"#1E0E04", border:"1px solid rgba(212,168,83,.4)", borderRadius:14, padding:16, width:275, zIndex:200, boxShadow:"0 8px 36px rgba(0,0,0,.7)" }}>
              <p style={{ color:"#D4A853", fontFamily:'"Playfair Display",serif', marginBottom:10, fontSize:".88rem" }}>📝 Nota — Página {page}</p>
              <textarea value={noteText} onChange={e=>setNoteText(e.target.value)} placeholder="Escribe tu nota aquí..." rows={4} style={{ width:"100%", resize:"vertical", background:"rgba(0,0,0,.35)", color:"#F4E4C1", borderRadius:8, padding:8, border:"1px solid rgba(212,168,83,.3)", marginBottom:10, fontSize:".88rem" }}/>
              <div style={{ display:"flex", gap:8 }}>
                <button className="btn" onClick={saveNote} style={{ flex:1, background:"linear-gradient(135deg,#A0541E,#7A2E2E)", color:"#FFF", borderRadius:8, padding:"8px", border:"none", fontSize:".85rem", fontWeight:700 }}>Guardar</button>
                <button className="btn" onClick={()=>{setShowNote(false);setNoteText("");}} style={{ background:"rgba(255,255,255,.07)", color:"rgba(212,168,83,.6)", borderRadius:8, padding:"8px 12px", border:"1px solid rgba(212,168,83,.2)", fontSize:".85rem" }}>✕</button>
              </div>
            </div>
          )}

          {/* BOTTOM NAV */}
          <div style={{ background:T.bar, padding:"9px 18px", display:"flex", alignItems:"center", justifyContent:"center", gap:14, position:"sticky", bottom:0, zIndex:100, boxShadow:"0 -2px 14px rgba(0,0,0,.45)" }}>
            <div style={{ position:"absolute", top:0, left:0, right:0, height:3, background:"rgba(255,255,255,.08)" }}>
              <div style={{ height:"100%", width:`${progress}%`, background:"linear-gradient(90deg,#A0541E,#D4A853)", transition:"width .3s" }}/>
            </div>
            {[
              { icon:"⏮", action:()=>goTo(1),           disabled:page<=1 },
              { icon:"‹",  action:()=>goTo(page-1),      disabled:page<=1,     label:"Anterior", big:true },
            ].map((b,i)=>(
              <button key={i} className="btn" onClick={b.action} disabled={b.disabled} style={{ background:"rgba(255,255,255,.1)", color:T.barText, borderRadius:b.big?9:7, padding:b.big?"7px 18px":"6px 10px", border:"none", opacity:b.disabled?.3:1, fontSize:b.big?".88rem":"1rem" }}>
                {b.icon}{b.label?` ${b.label}`:""}
              </button>
            ))}
            <div style={{ display:"flex", alignItems:"center", gap:7 }}>
              <input type="number" value={pageInput||page} onChange={e=>setPageInput(e.target.value)}
                onBlur={e=>{const p=parseInt(e.target.value);if(p)goTo(p);setPageInput("");}}
                onKeyDown={e=>{if(e.key==="Enter"){const p=parseInt(e.target.value);if(p)goTo(p);setPageInput("");}}}
                style={{ width:56, textAlign:"center", background:"rgba(255,255,255,.1)", color:T.barText, border:"1px solid rgba(255,255,255,.2)", borderRadius:7, padding:"5px", fontSize:".88rem" }}/>
              <span style={{ color:T.barText, fontSize:".82rem", opacity:.55 }}>/ {totalPgs}</span>
            </div>
            {[
              { icon:"›",  action:()=>goTo(page+1),      disabled:page>=totalPgs, label:"Siguiente", big:true },
              { icon:"⏭", action:()=>goTo(totalPgs),    disabled:page>=totalPgs },
            ].map((b,i)=>(
              <button key={i} className="btn" onClick={b.action} disabled={b.disabled} style={{ background:"rgba(255,255,255,.1)", color:T.barText, borderRadius:b.big?9:7, padding:b.big?"7px 18px":"6px 10px", border:"none", opacity:b.disabled?.3:1, fontSize:b.big?".88rem":"1rem" }}>
                {b.label?`${b.label} `:""}{b.icon}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ══════════ CONTEXT MENU ══════════ */}
      {ctxMenu && (
        <div onClick={e=>e.stopPropagation()} style={{ position:"fixed", top:ctxMenu.y, left:ctxMenu.x, background:"#1E0E04", border:"1px solid rgba(180,120,60,.35)", borderRadius:10, padding:6, zIndex:500, boxShadow:"0 8px 28px rgba(0,0,0,.7)", minWidth:160 }}>
          {[
            { label:"📖 Abrir",     action:()=>openBook(ctxMenu.book) },
            { label:"🗑 Eliminar",  action:()=>{ if(confirm(`¿Eliminar "${ctxMenu.book.title}"?`)) deleteBook(ctxMenu.book); }, danger:true },
          ].map(({label,action,danger})=>(
            <button key={label} className="btn" onClick={action} style={{ display:"block", width:"100%", textAlign:"left", padding:"9px 14px", color:danger?"rgba(220,80,80,.9)":"#D4A853", background:"transparent", borderRadius:7, fontSize:".88rem" }}>
              {label}
            </button>
          ))}
        </div>
      )}

      {/* ══════════ UPLOAD MODAL ══════════ */}
      {showUpload && (
        <div className="overlay" onClick={e=>{if(e.target===e.currentTarget){setShowUpload(false);setUploadState(p=>({...p,file:null,busy:false}));}}}>
          <div className="modal si">
            <h2 style={{ fontFamily:'"Playfair Display",serif', color:"#D4A853", marginBottom:24, fontSize:"1.35rem" }}>📚 Agregar libro</h2>

            {/* Drop zone */}
            <div onClick={()=>fileInputRef.current?.click()} onDragOver={e=>e.preventDefault()} onDrop={e=>{e.preventDefault();const f=e.dataTransfer.files[0];if(f){setUploadState(p=>({...p,file:f,title:p.title||f.name.replace(/\.[^.]+$/,"")}))}}} style={{ border:uploadState.file?"2px solid #D4A853":"2px dashed rgba(212,168,83,.3)", borderRadius:12, padding:22, textAlign:"center", cursor:"pointer", marginBottom:18, background:uploadState.file?"rgba(212,168,83,.06)":"rgba(0,0,0,.2)", transition:"all .2s" }}>
              <input ref={fileInputRef} type="file" accept=".pdf,.txt,.png,.jpg,.jpeg,.gif,.webp,.bmp" style={{ display:"none" }} onChange={e=>{const f=e.target.files[0];if(f)setUploadState(p=>({...p,file:f,title:p.title||f.name.replace(/\.[^.]+$/,"")}));}}/>
              {uploadState.file
                ? <div>
                    <div style={{ fontSize:"2.2rem", marginBottom:8 }}>{uploadState.file.type==="application/pdf"?"📄":uploadState.file.type.startsWith("image/")?"🖼️":"📝"}</div>
                    <p style={{ color:"#D4A853", fontWeight:700 }}>{uploadState.file.name}</p>
                    <p style={{ color:"rgba(212,168,83,.45)", fontSize:".78rem", marginTop:4 }}>{(uploadState.file.size/1024/1024).toFixed(2)} MB</p>
                  </div>
                : <div>
                    <div style={{ fontSize:"2.8rem", marginBottom:10 }}>📁</div>
                    <p style={{ color:"rgba(212,168,83,.65)" }}>Arrastra o haz clic para seleccionar</p>
                    <p style={{ color:"rgba(212,168,83,.35)", fontSize:".78rem", marginTop:6 }}>PDF · TXT · PNG · JPG · GIF · WEBP</p>
                  </div>
              }
            </div>

            <div style={{ marginBottom:14 }}>
              <label style={{ color:"rgba(212,168,83,.6)", fontSize:".8rem", display:"block", marginBottom:5 }}>Título</label>
              <input value={uploadState.title} onChange={e=>setUploadState(p=>({...p,title:e.target.value}))} placeholder="Título del libro..." style={{ width:"100%" }}/>
            </div>
            <div style={{ marginBottom:14 }}>
              <label style={{ color:"rgba(212,168,83,.6)", fontSize:".8rem", display:"block", marginBottom:5 }}>Categoría</label>
              <select value={uploadState.category} onChange={e=>setUploadState(p=>({...p,category:e.target.value}))} style={{ width:"100%" }}>
                {cats.map(c=><option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div style={{ marginBottom:22 }}>
              <label style={{ color:"rgba(212,168,83,.6)", fontSize:".8rem", display:"block", marginBottom:8 }}>Color del lomo</label>
              <div style={{ display:"flex", gap:7, flexWrap:"wrap" }}>
                {BOOK_COLORS.map(c=>(
                  <button key={c} className="btn" onClick={()=>setUploadState(p=>({...p,color:c}))} style={{ width:32, height:32, background:c, borderRadius:7, border:uploadState.color===c?"2.5px solid #D4A853":"2.5px solid transparent" }}/>
                ))}
              </div>
            </div>
            <div style={{ display:"flex", gap:10 }}>
              <button className="btn" onClick={doUpload} disabled={!uploadState.file||uploadState.busy} style={{ flex:1, background:uploadState.file?"linear-gradient(135deg,#A0541E,#7A2E2E)":"rgba(180,120,60,.2)", color:"#FFF", borderRadius:11, padding:"13px", fontSize:".95rem", fontWeight:700, border:"none", opacity:!uploadState.file||uploadState.busy?.5:1 }}>
                {uploadState.busy?"Procesando...":"+ Agregar a biblioteca"}
              </button>
              <button className="btn" onClick={()=>{setShowUpload(false);setUploadState(p=>({...p,file:null,busy:false}));}} style={{ background:"rgba(255,255,255,.04)", color:"rgba(212,168,83,.5)", borderRadius:11, padding:"13px 16px", border:"1px solid rgba(212,168,83,.18)" }}>
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══════════ CATEGORY MANAGER ══════════ */}
      {showCatMgr && (
        <div className="overlay" onClick={e=>{if(e.target===e.currentTarget)setShowCatMgr(false);}}>
          <div className="modal si">
            <h2 style={{ fontFamily:'"Playfair Display",serif', color:"#D4A853", marginBottom:20, fontSize:"1.25rem" }}>🗂 Categorías</h2>
            <div style={{ marginBottom:16 }}>
              {cats.map(c=>(
                <div key={c} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"10px 14px", marginBottom:7, background:"rgba(255,255,255,.04)", borderRadius:9, border:"1px solid rgba(212,168,83,.12)" }}>
                  <span style={{ color:"#D4A853", fontSize:".9rem" }}>📁 {c}</span>
                  <button className="btn" onClick={async()=>{const u=cats.filter(x=>x!==c);setCats(u);await sset("lib:cats",u);}} style={{ color:"rgba(212,168,83,.3)", fontSize:".78rem", padding:"3px 7px" }}>✕</button>
                </div>
              ))}
            </div>
            <div style={{ display:"flex", gap:9, marginBottom:18 }}>
              <input value={newCat} onChange={e=>setNewCat(e.target.value)} placeholder="Nueva categoría..." onKeyDown={async e=>{if(e.key==="Enter"&&newCat.trim()){const u=[...cats,newCat.trim()];setCats(u);await sset("lib:cats",u);setNewCat("");}}} style={{ flex:1 }}/>
              <button className="btn" onClick={async()=>{if(!newCat.trim())return;const u=[...cats,newCat.trim()];setCats(u);await sset("lib:cats",u);setNewCat("");}} style={{ background:"linear-gradient(135deg,#A0541E,#7A2E2E)", color:"#FFF", borderRadius:9, padding:"8px 16px", border:"none", fontWeight:700 }}>+</button>
            </div>
            <button className="btn" onClick={()=>setShowCatMgr(false)} style={{ width:"100%", background:"rgba(255,255,255,.04)", color:"rgba(212,168,83,.5)", borderRadius:11, padding:"12px", border:"1px solid rgba(212,168,83,.18)" }}>Cerrar</button>
          </div>
        </div>
      )}

      {/* ══════════ STATS MODAL ══════════ */}
      {showStats && (
        <div className="overlay" onClick={e=>{if(e.target===e.currentTarget)setShowStats(false);}}>
          <div className="modal si" style={{ maxWidth:540 }}>
            <h2 style={{ fontFamily:'"Playfair Display",serif', color:"#D4A853", marginBottom:22, fontSize:"1.25rem" }}>📊 Mis estadísticas</h2>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12, marginBottom:22 }}>
              {[
                { label:"Libros totales",    val:books.length,                                    icon:"📚" },
                { label:"Libros iniciados",  val:Object.keys(lastPages).length,                   icon:"📖" },
                { label:"Libros terminados", val:books.filter(b=>b.type==="text"&&b.pages&&lastPages[b.id]>=b.pages.length-1).length, icon:"✅" },
                { label:"Notas escritas",    val:Object.values(notes).reduce((a,n)=>a+n.length,0),icon:"📝" },
                { label:"Páginas marcadas",  val:Object.values(bookmarks).reduce((a,bm)=>a+bm.length,0), icon:"🔖" },
                { label:"Tiempo total",      val:fmtTime(Object.values(readTime).reduce((a,t)=>a+t,0)), icon:"⏱" },
              ].map(({label,val,icon})=>(
                <div key={label} style={{ background:"rgba(212,168,83,.07)", borderRadius:12, padding:"16px 14px", border:"1px solid rgba(212,168,83,.15)" }}>
                  <div style={{ fontSize:"1.5rem", marginBottom:6 }}>{icon}</div>
                  <div style={{ color:"#D4A853", fontSize:"1.4rem", fontWeight:700, fontFamily:'"Playfair Display",serif' }}>{val}</div>
                  <div style={{ color:"rgba(212,168,83,.5)", fontSize:".75rem", marginTop:3 }}>{label}</div>
                </div>
              ))}
            </div>
            {books.length>0 && (
              <div style={{ marginBottom:18 }}>
                <p style={{ color:"rgba(212,168,83,.6)", fontSize:".8rem", marginBottom:10 }}>Tiempo por libro</p>
                {books.filter(b=>readTime[b.id]).sort((a,b)=>(readTime[b.id]||0)-(readTime[a.id]||0)).slice(0,5).map(b=>(
                  <div key={b.id} style={{ display:"flex", alignItems:"center", gap:10, marginBottom:7 }}>
                    <div style={{ width:10, height:10, background:b.color, borderRadius:3, flexShrink:0 }}/>
                    <span style={{ color:"#D4A853", fontSize:".82rem", flex:1, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{b.title}</span>
                    <span style={{ color:"rgba(212,168,83,.5)", fontSize:".78rem", flexShrink:0 }}>{fmtTime(readTime[b.id])}</span>
                  </div>
                ))}
              </div>
            )}
            <button className="btn" onClick={()=>setShowStats(false)} style={{ width:"100%", background:"rgba(255,255,255,.04)", color:"rgba(212,168,83,.5)", borderRadius:11, padding:"12px", border:"1px solid rgba(212,168,83,.18)" }}>Cerrar</button>
          </div>
        </div>
      )}
    </div>
  );
}
