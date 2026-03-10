import { useState, useEffect, useRef, useCallback } from "react";

/* ─── GOOGLE FONTS ─────────────────────────────────────────── */
const FONT_LINK = "https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,700;0,900;1,400&family=DM+Sans:wght@300;400;500;600&display=swap";

/* ─── THEME DEFINITIONS ────────────────────────────────────── */
const THEMES = {
  paper: {
    name: "Papel", icon: "☀️",
    shell: "#0F0F0F",            // app background (always dark)
    page: "#F5ECD7",             // reading area bg
    text: "#1A1008",             // reading text
    muted: "#6B5A3E",
    canvasFilter: "sepia(0.12) brightness(1.02)",
  },
  night: {
    name: "Noche", icon: "🌙",
    shell: "#0F0F0F",
    page: "#0D0D0D",
    text: "#E8DDD0",
    muted: "#7A7060",
    canvasFilter: "invert(1) brightness(0.88)",
  },
  sepia: {
    name: "Sepia", icon: "🍂",
    shell: "#0F0F0F",
    page: "#2A1F10",
    text: "#DEC99A",
    muted: "#8B7550",
    canvasFilter: "sepia(1) contrast(1.05) brightness(0.7) hue-rotate(5deg)",
  },
  white: {
    name: "Blanco", icon: "🔆",
    shell: "#0F0F0F",
    page: "#FFFFFF",
    text: "#111111",
    muted: "#555555",
    canvasFilter: "none",
  },
};

const BOOK_COLORS = [
  ["#8B1A1A","#C0392B"],["#1A4A8B","#2980B9"],["#1A6B2E","#27AE60"],
  ["#6B1A8B","#9B59B6"],["#8B5E1A","#E67E22"],["#1A6B6B","#16A085"],
  ["#4A1A6B","#7D3C98"],["#6B1A4A","#C0392B"],
];
const FONTS = [
  { name:"Playfair Display", val:'"Playfair Display",Georgia,serif' },
  { name:"Georgia",           val:"Georgia,serif" },
  { name:"DM Sans",           val:'"DM Sans",system-ui,sans-serif' },
  { name:"Courier New",       val:'"Courier New",monospace' },
];
const CHARS_PER_PAGE = 2400;

/* ─── STORAGE ───────────────────────────────────────────────── */
async function sg(k, fb = null) {
  try { const r = await window.storage.get(k); return r ? JSON.parse(r.value) : fb; }
  catch { return fb; }
}
async function ss(k, v) {
  try { await window.storage.set(k, JSON.stringify(v)); } catch {}
}

/* ═══════════════════════════════════════════════════════════════
   MAIN APP
═══════════════════════════════════════════════════════════════ */
export default function App() {
  /* ─ state ─ */
  const [view, setView]             = useState("library");  // library | reader | detail
  const [books, setBooks]           = useState([]);
  const [cats, setCats]             = useState(["Sin categoría","Ficción","No ficción","Ciencia","Arte","Historia"]);
  const [theme, setTheme]           = useState("paper");
  const [fontSize, setFontSize]     = useState(19);
  const [fontFam, setFontFam]       = useState(FONTS[0].val);
  const [lineH, setLineH]           = useState(1.9);
  const [bookmarks, setBookmarks]   = useState({});
  const [notes, setNotes]           = useState({});
  const [lastPages, setLastPages]   = useState({});
  const [readTime, setReadTime]     = useState({});
  const [cur, setCur]               = useState(null);
  const [detailBook, setDetailBook] = useState(null);
  const [page, setPage]             = useState(1);
  const [totalPgs, setTotalPgs]     = useState(1);
  const [pdfDoc, setPdfDoc]         = useState(null);
  const [pdfLibReady, setPdfLibReady] = useState(false);
  const [loading, setLoading]       = useState(false);
  const [zoom, setZoom]             = useState(1.0);
  const [showUpload, setShowUpload] = useState(false);
  const [showPanel, setShowPanel]   = useState(false);
  const [panelTab, setPanelTab]     = useState("bm");
  const [showTheme, setShowTheme]   = useState(false);
  const [showNote, setShowNote]     = useState(false);
  const [noteText, setNoteText]     = useState("");
  const [searchQ, setSearchQ]       = useState("");
  const [showSearch, setShowSearch] = useState(false);
  const [pageInput, setPageInput]   = useState("");
  const [showCatMgr, setShowCatMgr] = useState(false);
  const [newCat, setNewCat]         = useState("");
  const [ctxMenu, setCtxMenu]       = useState(null);
  const [renderErr, setRenderErr]   = useState(null);
  const [upState, setUpState]       = useState({
    title:"", cat:"Sin categoría", color:0, file:null, busy:false
  });

  const canvasRef   = useRef(null);
  const canvas2Ref  = useRef(null);
  const fileRef     = useRef(null);
  const timerRef    = useRef(null);
  const renderRef   = useRef(null);

  /* ─ load PDF.js ─ */
  useEffect(() => {
    if (window.pdfjsLib) { setPdfLibReady(true); return; }
    const s = document.createElement("script");
    s.src = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js";
    s.onload = () => {
      window.pdfjsLib.GlobalWorkerOptions.workerSrc =
        "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
      setPdfLibReady(true);
    };
    s.onerror = () => console.error("PDF.js failed to load");
    document.head.appendChild(s);
    const f = document.createElement("link");
    f.rel = "stylesheet"; f.href = FONT_LINK;
    document.head.appendChild(f);
  }, []);

  /* ─ persist data ─ */
  useEffect(() => {
    (async () => {
      const meta = await sg("bk:books", []);
      const full = await Promise.all(meta.map(async b => {
        const fd = await sg(`bk:file:${b.id}`, null);
        return fd ? { ...b, ...fd } : b;
      }));
      setBooks(full);
      setCats(await sg("bk:cats", ["Sin categoría","Ficción","No ficción","Ciencia","Arte","Historia"]));
      setBookmarks(await sg("bk:bm", {}));
      setNotes(await sg("bk:notes", {}));
      setLastPages(await sg("bk:lp", {}));
      setReadTime(await sg("bk:rt", {}));
      setTheme(await sg("bk:theme", "paper") || "paper");
      setFontSize(await sg("bk:fs", 19) || 19);
      setFontFam(await sg("bk:ff", FONTS[0].val) || FONTS[0].val);
    })();
  }, []);

  /* ─ save meta ─ */
  const saveMeta = useCallback(async (list) => {
    await ss("bk:books", list.map(b => ({ id:b.id, title:b.title, cat:b.cat, color:b.color, type:b.type, added:b.added, size:b.size })));
  }, []);

  /* ─ open book ─ */
  const openBook = useCallback(async (book) => {
    setRenderErr(null);
    if (!book.fileData && !book.pages) { alert("Archivo no disponible."); return; }
    setCur(book);
    const startPg = lastPages[book.id] || 1;
    setPage(startPg);
    setPageInput("");
    setView("reader");
    setShowPanel(false); setShowTheme(false); setShowNote(false);
    setZoom(1.0);

    if (book.type === "pdf") {
      if (!pdfLibReady) { setRenderErr("PDF.js aún cargando, intenta en un momento."); return; }
      setLoading(true);
      try {
        const raw  = book.fileData;
        const bin  = atob(raw);
        const arr  = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
        const doc  = await window.pdfjsLib.getDocument({ data: arr.buffer }).promise;
        setPdfDoc(doc);
        setTotalPgs(doc.numPages);
      } catch (e) {
        console.error("PDF load error:", e);
        setRenderErr("No se pudo cargar el PDF: " + e.message);
      }
      setLoading(false);
    } else {
      setPdfDoc(null);
      setTotalPgs(book.pages?.length || 1);
    }

    clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setReadTime(prev => {
        const u = { ...prev, [book.id]: (prev[book.id] || 0) + 1 };
        ss("bk:rt", u);
        return u;
      });
    }, 60000);
  }, [lastPages, pdfLibReady]);

  /* ─ render PDF page ─ */
  useEffect(() => {
    if (!pdfDoc || view !== "reader" || !cur || cur.type !== "pdf") return;

    const render = async () => {
      setLoading(true);
      setRenderErr(null);
      if (renderRef.current) { try { renderRef.current.cancel(); } catch {} }

      const canvas = canvasRef.current;
      if (!canvas) { setLoading(false); return; }

      try {
        const pg   = await pdfDoc.getPage(page);
        const vp   = pg.getViewport({ scale: 1.8 * zoom });
        canvas.width  = vp.width;
        canvas.height = vp.height;
        const ctx = canvas.getContext("2d");
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        const task = pg.render({ canvasContext: ctx, viewport: vp });
        renderRef.current = task;
        await task.promise;
      } catch (e) {
        if (e?.name !== "RenderingCancelledException") {
          console.error("Render error:", e);
          setRenderErr("Error al renderizar página " + page + ": " + (e?.message || ""));
        }
      }
      setLoading(false);
    };

    render();
  }, [pdfDoc, page, zoom, view, cur]);

  /* ─ close book ─ */
  const closeBook = useCallback(async () => {
    if (cur) {
      const u = { ...lastPages, [cur.id]: page };
      setLastPages(u);
      await ss("bk:lp", u);
    }
    clearInterval(timerRef.current);
    setPdfDoc(null);
    setCur(null);
    setView("library");
  }, [cur, page, lastPages]);

  const goTo = useCallback((p) => setPage(Math.max(1, Math.min(totalPgs, p))), [totalPgs]);

  const toggleBm = useCallback(async () => {
    if (!cur) return;
    const bm = bookmarks[cur.id] || [];
    const u  = bm.includes(page)
      ? { ...bookmarks, [cur.id]: bm.filter(x => x !== page) }
      : { ...bookmarks, [cur.id]: [...bm, page].sort((a,b) => a-b) };
    setBookmarks(u); await ss("bk:bm", u);
  }, [bookmarks, cur, page]);

  const saveNote = useCallback(async () => {
    if (!cur || !noteText.trim()) return;
    const n = { id: Date.now(), page, text: noteText };
    const u = { ...notes, [cur.id]: [...(notes[cur.id] || []), n] };
    setNotes(u); await ss("bk:notes", u);
    setNoteText(""); setShowNote(false);
  }, [notes, cur, page, noteText]);

  const deleteBook = useCallback(async (book) => {
    const upd = books.filter(b => b.id !== book.id);
    setBooks(upd); await saveMeta(upd);
    try { await window.storage.delete(`bk:file:${book.id}`); } catch {}
    setCtxMenu(null); setDetailBook(null);
  }, [books, saveMeta]);

  /* ─ upload ─ */
  const doUpload = useCallback(async () => {
    const { file, title, cat, color } = upState;
    if (!file) return;
    setUpState(p => ({ ...p, busy: true }));

    const reader = new FileReader();
    reader.onload = async (e) => {
      const b64 = e.target.result.split(",")[1];
      let type  = "pdf";
      let pages = null;

      if (file.type === "text/plain") {
        type  = "text";
        let raw = "";
        try { raw = decodeURIComponent(escape(atob(b64))); } catch { raw = atob(b64); }
        pages = [];
        for (let i = 0; i < raw.length; i += CHARS_PER_PAGE)
          pages.push(raw.slice(i, i + CHARS_PER_PAGE));
      } else if (file.type.startsWith("image/")) {
        type = "image";
      }

      const book = {
        id:       Date.now().toString(),
        title:    title || file.name.replace(/\.[^.]+$/, ""),
        cat:      cat,
        color,
        type,
        pages,
        fileData: b64,
        added:    new Date().toISOString(),
        size:     file.size,
      };

      const nb = [...books, book];
      setBooks(nb);
      await saveMeta(nb);
      try { await ss(`bk:file:${book.id}`, { fileData: b64, pages }); } catch {}

      setUpState({ title:"", cat:"Sin categoría", color:0, file:null, busy:false });
      setShowUpload(false);
    };
    reader.onerror = () => { setUpState(p => ({ ...p, busy:false })); alert("Error al leer el archivo."); };
    reader.readAsDataURL(file);
  }, [upState, books, saveMeta]);

  /* ─── DERIVED ────────────────────────────────────────────── */
  const T        = THEMES[theme];
  const isBm     = cur ? (bookmarks[cur.id] || []).includes(page) : false;
  const progress = totalPgs > 0 ? Math.round((page / totalPgs) * 100) : 0;
  const pgNotes  = cur ? (notes[cur.id] || []).filter(n => n.page === page) : [];
  const fmtTime  = m => !m ? "—" : m < 60 ? `${m}m` : `${Math.floor(m/60)}h ${m%60}m`;

  const byCategory = {};
  cats.forEach(c => { const b = books.filter(x => x.cat === c); if (b.length) byCategory[c] = b; });
  const other = books.filter(b => !cats.includes(b.cat));
  if (other.length) byCategory["Otros"] = other;

  const recent = [...books].filter(b => lastPages[b.id]).sort((a,b) => (lastPages[b.id]||0)-(lastPages[a.id]||0)).slice(0,8);

  /* ─── CSS FILTER for PDF based on theme ──────────────────── */
  const pdfFilter = T.canvasFilter;

  /* ═══════════════════════════════════════════════════════════
     GLOBAL STYLES
  ═══════════════════════════════════════════════════════════ */
  const G = `
    @import url('${FONT_LINK}');
    *{box-sizing:border-box;margin:0;padding:0}
    body{background:#0F0F0F;font-family:"DM Sans",system-ui,sans-serif}
    ::-webkit-scrollbar{width:4px;height:4px}
    ::-webkit-scrollbar-track{background:transparent}
    ::-webkit-scrollbar-thumb{background:rgba(200,146,42,.3);border-radius:4px}
    .btn{cursor:pointer;border:none;background:none;font-family:inherit;transition:opacity .15s,transform .12s}
    .btn:hover{opacity:.8}.btn:active{transform:scale(.96)}
    .card{cursor:pointer;transition:transform .22s cubic-bezier(.34,1.56,.64,1),box-shadow .22s}
    .card:hover{transform:translateY(-6px) scale(1.02);box-shadow:0 20px 48px rgba(0,0,0,.65)!important}
    .fadein{animation:fi .35s ease}@keyframes fi{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}
    .slide{animation:sl .28s ease}@keyframes sl{from{opacity:0;transform:translateX(20px)}to{opacity:1;transform:translateX(0)}}
    .spin{animation:sp .9s linear infinite;display:inline-block}@keyframes sp{to{transform:rotate(360deg)}}
    .overlay{position:fixed;inset:0;background:rgba(0,0,0,.82);z-index:900;display:flex;align-items:center;justify-content:center;backdrop-filter:blur(8px)}
    input,textarea,select{font-family:"DM Sans",inherit;background:rgba(255,255,255,.06);border:1px solid rgba(200,146,42,.2);border-radius:10px;padding:10px 14px;color:#E8DDD0;outline:none;transition:border .2s}
    input:focus,textarea:focus,select:focus{border-color:rgba(200,146,42,.6)}
    select option{background:#1A1208;color:#E8DDD0}
    .pill{display:inline-flex;align-items:center;padding:3px 10px;border-radius:20px;font-size:.68rem;font-weight:600;letter-spacing:.03em}
    .progress-bar{height:3px;background:rgba(255,255,255,.08);border-radius:4px;overflow:hidden}
    .progress-fill{height:100%;background:linear-gradient(90deg,#C8922A,#E8B84B);border-radius:4px;transition:width .4s}
  `;

  /* ═══════════════════════════════════════════════════════════
     LIBRARY
  ═══════════════════════════════════════════════════════════ */
  const Library = () => (
    <div className="fadein" style={{ minHeight:"100vh", background:"#0F0F0F", color:"#E8DDD0", paddingBottom:90 }}>

      {/* TOP BAR */}
      <div style={{ padding:"20px 20px 10px", display:"flex", alignItems:"center", justifyContent:"space-between", position:"sticky", top:0, background:"rgba(15,15,15,.97)", backdropFilter:"blur(14px)", zIndex:50, borderBottom:"1px solid rgba(200,146,42,.08)" }}>
        <div>
          <h1 style={{ fontFamily:'"Playfair Display",serif', fontSize:"1.7rem", fontWeight:900, color:"#C8922A", lineHeight:1 }}>Biblioteca</h1>
          <p style={{ fontSize:".72rem", color:"rgba(232,221,208,.35)", marginTop:2 }}>{books.length} {books.length===1?"libro":"libros"}</p>
        </div>
        <div style={{ display:"flex", gap:8 }}>
          <button className="btn" onClick={() => setShowCatMgr(true)} style={{ background:"rgba(200,146,42,.08)", border:"1px solid rgba(200,146,42,.18)", color:"#C8922A", borderRadius:10, padding:"9px 14px", fontSize:".8rem", fontWeight:600 }}>
            Categorías
          </button>
          <button className="btn" onClick={() => setShowUpload(true)} style={{ background:"linear-gradient(135deg,#C8922A,#A06820)", color:"#FFF", borderRadius:10, padding:"9px 18px", fontSize:".82rem", fontWeight:700, boxShadow:"0 4px 16px rgba(200,146,42,.35)" }}>
            + Agregar
          </button>
        </div>
      </div>

      <div style={{ padding:"18px 20px" }}>

        {/* RECIENTES */}
        {recent.length > 0 && (
          <section style={{ marginBottom:36 }}>
            <p style={{ fontSize:".72rem", fontWeight:600, color:"rgba(200,146,42,.6)", letterSpacing:".12em", textTransform:"uppercase", marginBottom:14 }}>Continuar leyendo</p>
            <div style={{ display:"flex", gap:14, overflowX:"auto", paddingBottom:6 }}>
              {recent.map(b => {
                const lp  = lastPages[b.id] || 1;
                const tot = b.type === "text" ? b.pages?.length || 1 : 0;
                const pct = tot > 0 ? Math.round(lp/tot*100) : 0;
                const [c1, c2] = BOOK_COLORS[b.color] || BOOK_COLORS[0];
                return (
                  <div key={b.id} className="card" onClick={() => openBook(b)} style={{ minWidth:110, flexShrink:0 }}>
                    <div style={{ width:110, height:155, background:`linear-gradient(150deg,${c1},${c2})`, borderRadius:10, boxShadow:"0 8px 24px rgba(0,0,0,.55)", display:"flex", alignItems:"center", justifyContent:"center", position:"relative", overflow:"hidden" }}>
                      <span style={{ color:"rgba(255,255,255,.9)", fontSize:".6rem", fontFamily:'"Playfair Display",serif', fontWeight:700, textAlign:"center", padding:"8px", lineHeight:1.4, zIndex:1, position:"relative" }}>{b.title}</span>
                      <div style={{ position:"absolute", top:-20, right:-20, width:80, height:80, background:"rgba(255,255,255,.06)", borderRadius:"50%" }}/>
                      <div style={{ position:"absolute", bottom:0, left:0, right:0, height:4, background:"rgba(0,0,0,.3)" }}>
                        {pct>0 && <div style={{ height:"100%", width:`${pct}%`, background:"#E8B84B" }}/>}
                      </div>
                    </div>
                    <div style={{ marginTop:8, paddingLeft:2 }}>
                      <p style={{ fontSize:".75rem", fontWeight:600, color:"#E8DDD0", lineHeight:1.3, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", maxWidth:110 }}>{b.title}</p>
                      <p style={{ fontSize:".65rem", color:"rgba(232,221,208,.35)", marginTop:2 }}>p. {lp}{pct?` · ${pct}%`:""}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* EMPTY */}
        {books.length === 0 && (
          <div style={{ textAlign:"center", padding:"80px 20px" }}>
            <div style={{ fontSize:"4rem", marginBottom:16, opacity:.4 }}>📚</div>
            <p style={{ fontFamily:'"Playfair Display",serif', fontSize:"1.4rem", color:"rgba(200,146,42,.7)" }}>Tu biblioteca está vacía</p>
            <p style={{ fontSize:".85rem", color:"rgba(232,221,208,.35)", marginTop:8, lineHeight:1.7 }}>Sube PDFs, archivos TXT o imágenes</p>
            <button className="btn" onClick={() => setShowUpload(true)} style={{ marginTop:24, background:"linear-gradient(135deg,#C8922A,#A06820)", color:"#FFF", borderRadius:14, padding:"14px 32px", fontSize:".95rem", fontWeight:700, boxShadow:"0 6px 20px rgba(200,146,42,.4)" }}>
              + Agregar primer libro
            </button>
          </div>
        )}

        {/* SHELVES */}
        {Object.entries(byCategory).map(([cat, cBooks]) => (
          <section key={cat} style={{ marginBottom:38 }}>
            <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:14 }}>
              <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                <p style={{ fontSize:".72rem", fontWeight:600, color:"rgba(200,146,42,.6)", letterSpacing:".12em", textTransform:"uppercase" }}>{cat}</p>
                <span style={{ fontSize:".68rem", color:"rgba(232,221,208,.2)" }}>{cBooks.length}</span>
              </div>
            </div>
            <div style={{ display:"flex", gap:14, overflowX:"auto", paddingBottom:8 }}>
              {cBooks.map(book => {
                const [c1, c2] = BOOK_COLORS[book.color] || BOOK_COLORS[0];
                const lp  = lastPages[book.id];
                const tot = book.type === "text" ? book.pages?.length || 0 : 0;
                const pct = tot>0 ? Math.round(lp/tot*100) : 0;
                const bms = (bookmarks[book.id]||[]).length;
                return (
                  <div key={book.id} className="card"
                    onClick={() => setDetailBook(book)}
                    onContextMenu={e => { e.preventDefault(); setCtxMenu({ book, x:e.clientX, y:e.clientY }); }}
                    style={{ minWidth:130, flexShrink:0 }}>
                    <div style={{ width:130, height:180, background:`linear-gradient(150deg,${c1},${c2})`, borderRadius:12, boxShadow:"0 8px 28px rgba(0,0,0,.5)", position:"relative", overflow:"hidden", display:"flex", alignItems:"center", justifyContent:"center" }}>
                      {/* Gloss */}
                      <div style={{ position:"absolute", top:0, left:0, right:0, height:"45%", background:"linear-gradient(180deg,rgba(255,255,255,.13),transparent)", pointerEvents:"none" }}/>
                      <div style={{ position:"absolute", top:-30, right:-30, width:100, height:100, background:"rgba(255,255,255,.07)", borderRadius:"50%", pointerEvents:"none" }}/>
                      <span style={{ color:"rgba(255,255,255,.93)", fontSize:".65rem", fontFamily:'"Playfair Display",serif', fontWeight:700, textAlign:"center", padding:"10px", lineHeight:1.4, position:"relative", zIndex:1 }}>{book.title}</span>
                      {/* Bookmark ribbon */}
                      {bms > 0 && <div style={{ position:"absolute", top:0, right:12, width:8, height:22, background:"#E8B84B", borderRadius:"0 0 4px 4px" }}/>}
                      {/* Spine */}
                      <div style={{ position:"absolute", left:0, top:0, bottom:0, width:6, background:"rgba(0,0,0,.25)" }}/>
                      {/* Progress */}
                      {pct>0 && <div style={{ position:"absolute", bottom:0, left:0, right:0, height:3, background:"rgba(0,0,0,.3)" }}>
                        <div style={{ height:"100%", width:`${pct}%`, background:"rgba(255,255,255,.55)" }}/>
                      </div>}
                    </div>
                    <div style={{ marginTop:10, paddingLeft:2 }}>
                      <p style={{ fontSize:".78rem", fontWeight:600, color:"#E8DDD0", lineHeight:1.3, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", maxWidth:130 }}>{book.title}</p>
                      <p style={{ fontSize:".65rem", color:"rgba(232,221,208,.35)", marginTop:3 }}>{book.type?.toUpperCase()}{lp?` · p.${lp}`:""}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        ))}
      </div>
    </div>
  );

  /* ═══════════════════════════════════════════════════════════
     READER
  ═══════════════════════════════════════════════════════════ */
  const Reader = () => (
    <div style={{ height:"100vh", display:"flex", flexDirection:"column", background:T.page, transition:"background .3s" }}>

      {/* TOP BAR */}
      <div style={{ background: theme==="white" ? "rgba(250,250,250,.97)" : "rgba(15,12,8,.96)", borderBottom:`1px solid ${theme==="white"?"rgba(0,0,0,.1)":"rgba(200,146,42,.1)"}`, padding:"10px 14px", display:"flex", alignItems:"center", gap:10, backdropFilter:"blur(12px)", zIndex:100, flexShrink:0 }}>
        <button className="btn" onClick={closeBook} style={{ background:"rgba(200,146,42,.12)", color:"#C8922A", borderRadius:8, padding:"7px 13px", fontSize:".8rem", fontWeight:600, border:"1px solid rgba(200,146,42,.2)", flexShrink:0 }}>
          ← Volver
        </button>
        <div style={{ flex:1, minWidth:0 }}>
          <p style={{ fontFamily:'"Playfair Display",serif', fontWeight:700, fontSize:".92rem", color: theme==="white"?"#111":theme==="night"?"#E8DDD0":"#C8922A", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{cur?.title}</p>
          <p style={{ fontSize:".65rem", color: theme==="white"?"#888":"rgba(200,146,42,.45)", marginTop:1 }}>
            Pág. {page} de {totalPgs} · {progress}%
          </p>
        </div>
        <div style={{ display:"flex", gap:5, flexShrink:0 }}>
          {[
            { ico:"🔍", act:()=>{ setShowSearch(!showSearch); setShowTheme(false); setShowNote(false); } },
            { ico:"🔖", act:toggleBm, active:isBm },
            { ico:"📝", act:()=>{ setShowNote(!showNote); setShowTheme(false); setShowSearch(false); } },
            { ico:"🎨", act:()=>{ setShowTheme(!showTheme); setShowNote(false); setShowSearch(false); } },
            { ico:"☰",  act:()=>{ setShowPanel(!showPanel); setShowTheme(false); } },
          ].map(({ ico, act, active }, i) => (
            <button key={i} className="btn" onClick={act} style={{ background: active?"rgba(200,146,42,.25)":"rgba(200,146,42,.08)", color:"#C8922A", borderRadius:8, padding:"7px 9px", fontSize:".95rem", border:`1px solid ${active?"rgba(200,146,42,.4)":"rgba(200,146,42,.15)"}` }}>
              {ico}
            </button>
          ))}
        </div>
      </div>

      {/* Zoom row */}
      <div style={{ background: theme==="white"?"rgba(250,250,250,.9)":"rgba(10,8,5,.9)", display:"flex", alignItems:"center", justifyContent:"center", gap:8, padding:"5px 14px", borderBottom:`1px solid ${theme==="white"?"rgba(0,0,0,.08)":"rgba(200,146,42,.07)"}`, flexShrink:0 }}>
        {[
          { l:"−", a:()=>setZoom(z=>Math.max(.4,+(z-.15).toFixed(2))) },
          { l:"+", a:()=>setZoom(z=>Math.min(3,+(z+.15).toFixed(2))) },
        ].map(({l,a},i)=>(
          <button key={i} className="btn" onClick={a} style={{ background:"rgba(200,146,42,.1)", color:"#C8922A", borderRadius:6, padding:"3px 12px", fontSize:"1rem", fontWeight:700, border:"1px solid rgba(200,146,42,.18)" }}>{l}</button>
        ))}
        <span style={{ fontSize:".75rem", color:"rgba(200,146,42,.5)", minWidth:42, textAlign:"center" }}>{Math.round(zoom*100)}%</span>
        <button className="btn" onClick={()=>setZoom(1)} style={{ background:"rgba(200,146,42,.1)", color:"rgba(200,146,42,.5)", borderRadius:6, padding:"3px 10px", fontSize:".72rem", border:"1px solid rgba(200,146,42,.15)" }}>↺</button>
        {/* Progress */}
        <div style={{ flex:1, margin:"0 4px" }}>
          <div className="progress-bar"><div className="progress-fill" style={{ width:`${progress}%` }}/></div>
        </div>
      </div>

      {/* Search bar */}
      {showSearch && (
        <div className="slide" style={{ background: theme==="white"?"#F5F5F5":"#0F0C08", padding:"8px 14px", display:"flex", gap:8, borderBottom:`1px solid ${theme==="white"?"rgba(0,0,0,.1)":"rgba(200,146,42,.12)"}`, flexShrink:0 }}>
          <input value={searchQ} onChange={e=>setSearchQ(e.target.value)} placeholder="Buscar texto en esta página..." style={{ flex:1, fontSize:".85rem", background: theme==="white"?"#FFF":"rgba(255,255,255,.07)", color: T.text, borderRadius:8, padding:"7px 12px", border:`1px solid ${theme==="white"?"#DDD":"rgba(200,146,42,.22)"}` }}/>
          <button className="btn" onClick={()=>{setSearchQ("");setShowSearch(false);}} style={{ color:"#C8922A", padding:"7px 12px", background:"rgba(200,146,42,.1)", borderRadius:8, border:"none" }}>✕</button>
        </div>
      )}

      {/* Notes indicator */}
      {pgNotes.length>0 && (
        <div onClick={()=>{setShowPanel(true);setPanelTab("notes");}} style={{ background:"rgba(232,184,75,.08)", borderLeft:"3px solid #E8B84B", padding:"7px 16px", fontSize:".8rem", color:"#E8B84B", cursor:"pointer", flexShrink:0 }}>
          📝 {pgNotes.length} nota{pgNotes.length>1?"s":""} aquí · ver
        </div>
      )}

      {/* CONTENT + PANEL */}
      <div style={{ flex:1, display:"flex", overflow:"hidden", minHeight:0 }}>

        {/* Page area */}
        <div style={{ flex:1, overflowY:"auto", overflowX:"auto", display:"flex", justifyContent:"center", alignItems:"flex-start", padding:"24px 12px", background:T.page, transition:"background .3s" }}>
          {loading && (
            <div style={{ display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", height:300, gap:12, color:"rgba(200,146,42,.5)" }}>
              <span className="spin" style={{ fontSize:"2rem" }}>⟳</span>
              <span style={{ fontSize:".85rem" }}>Cargando...</span>
            </div>
          )}

          {renderErr && (
            <div style={{ background:"rgba(200,50,50,.1)", border:"1px solid rgba(200,50,50,.3)", borderRadius:12, padding:24, maxWidth:460, textAlign:"center", color:T.text }}>
              <div style={{ fontSize:"2rem", marginBottom:12 }}>⚠️</div>
              <p style={{ fontWeight:600, marginBottom:8 }}>No se pudo mostrar el documento</p>
              <p style={{ fontSize:".85rem", opacity:.6, lineHeight:1.6 }}>{renderErr}</p>
              <button className="btn" onClick={closeBook} style={{ marginTop:16, background:"rgba(200,146,42,.15)", color:"#C8922A", border:"1px solid rgba(200,146,42,.3)", borderRadius:8, padding:"8px 20px", fontSize:".85rem" }}>
                ← Volver a biblioteca
              </button>
            </div>
          )}

          {/* PDF CANVAS */}
          {cur?.type === "pdf" && !renderErr && (
            <div style={{ boxShadow: theme==="white"?"0 4px 24px rgba(0,0,0,.18)":"0 6px 32px rgba(0,0,0,.6)", borderRadius:4, overflow:"hidden", display: loading?"none":"block" }}>
              <canvas
                ref={canvasRef}
                style={{
                  display: "block",
                  maxWidth: "100%",
                  filter: pdfFilter,
                  transition: "filter .3s",
                }}
              />
            </div>
          )}

          {/* TEXT */}
          {cur?.type === "text" && cur.pages && (
            <div style={{
              maxWidth:680, width:"100%",
              background:T.page,
              color: T.text,
              padding:"48px 52px",
              boxShadow: theme==="white"?"0 4px 24px rgba(0,0,0,.12)":"0 6px 32px rgba(0,0,0,.5)",
              borderRadius:6,
              minHeight:580,
              transition:"background .3s, color .3s",
            }}>
              {theme==="paper" && (
                <div style={{ position:"absolute", inset:0, pointerEvents:"none", backgroundImage:"repeating-linear-gradient(transparent,transparent 31px,rgba(100,80,40,.09) 31px,rgba(100,80,40,.09) 32px)", borderRadius:6 }}/>
              )}
              <p style={{
                fontSize: `${fontSize}px`,
                lineHeight: lineH,
                fontFamily: fontFam,
                color: T.text,
                whiteSpace:"pre-wrap",
                transition:"color .3s",
              }}>
                {searchQ && cur.pages[page-1]
                  ? cur.pages[page-1].split(new RegExp(`(${searchQ.replace(/[.*+?^${}()|[\]\\]/g,"\\$&")})`, "gi")).map((pt,i) =>
                      pt.toLowerCase()===searchQ.toLowerCase()
                        ? <mark key={i} style={{ background:"#E8B84B", color:"#111", borderRadius:2, padding:"0 1px" }}>{pt}</mark>
                        : pt
                    )
                  : cur.pages[page-1]
                }
              </p>
            </div>
          )}

          {/* IMAGE */}
          {cur?.type === "image" && cur.fileData && (
            <div style={{ boxShadow:"0 6px 32px rgba(0,0,0,.5)", borderRadius:6, overflow:"hidden" }}>
              <img
                src={`data:image/*;base64,${cur.fileData}`}
                alt={cur?.title}
                style={{ maxWidth:"100%", display:"block", transform:`scale(${zoom})`, transformOrigin:"top center", filter: pdfFilter, transition:"filter .3s" }}
              />
            </div>
          )}

          {!cur?.fileData && cur?.type !== "text" && !renderErr && !loading && (
            <div style={{ textAlign:"center", padding:60, color:T.text, opacity:.4 }}>
              <div style={{ fontSize:"3rem", marginBottom:16 }}>📄</div>
              <p>Archivo no disponible</p>
            </div>
          )}
        </div>

        {/* SIDE PANEL */}
        {showPanel && (
          <div className="slide" style={{ width:280, background: theme==="white"?"#F0EDE8":"#100D08", borderLeft:`1px solid ${theme==="white"?"rgba(0,0,0,.1)":"rgba(200,146,42,.12)"}`, display:"flex", flexDirection:"column", overflow:"hidden", flexShrink:0 }}>
            {/* Tabs */}
            <div style={{ display:"flex", borderBottom:`1px solid ${theme==="white"?"rgba(0,0,0,.1)":"rgba(200,146,42,.12)"}` }}>
              {[{id:"bm",ico:"🔖",l:"Marcas"},{id:"notes",ico:"📝",l:"Notas"},{id:"info",ico:"ℹ️",l:"Info"}].map(t=>(
                <button key={t.id} className="btn" onClick={()=>setPanelTab(t.id)} style={{ flex:1, padding:"12px 4px", background:panelTab===t.id?"rgba(200,146,42,.1)":"transparent", color:panelTab===t.id?"#C8922A":"rgba(200,146,42,.35)", borderBottom:panelTab===t.id?"2px solid #C8922A":"2px solid transparent", fontSize:".7rem", display:"flex", flexDirection:"column", alignItems:"center", gap:3 }}>
                  <span>{t.ico}</span><span style={{ fontWeight:600 }}>{t.l}</span>
                </button>
              ))}
            </div>
            <div style={{ flex:1, overflowY:"auto", padding:14 }}>
              {/* Bookmarks */}
              {panelTab==="bm" && (
                <div>
                  <p style={{ color:"#C8922A", fontFamily:'"Playfair Display",serif', marginBottom:14, fontSize:".9rem" }}>Marcapáginas</p>
                  {(bookmarks[cur?.id]||[]).length===0
                    ? <p style={{ color:"rgba(200,146,42,.3)", fontSize:".8rem", textAlign:"center", marginTop:24, lineHeight:1.8 }}>Sin marcas.<br/>Toca 🔖 para marcar.</p>
                    : (bookmarks[cur?.id]||[]).map(pg=>(
                      <div key={pg} onClick={()=>goTo(pg)} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"9px 12px", marginBottom:6, background:pg===page?"rgba(200,146,42,.15)":"rgba(255,255,255,.03)", borderRadius:10, cursor:"pointer", border:`1px solid ${pg===page?"rgba(200,146,42,.35)":"transparent"}` }}>
                        <span style={{ color:"#C8922A", fontSize:".85rem" }}>📄 Pág. {pg}</span>
                        <button className="btn" onClick={e=>{e.stopPropagation();const u={...bookmarks,[cur.id]:(bookmarks[cur.id]||[]).filter(x=>x!==pg)};setBookmarks(u);ss("bk:bm",u);}} style={{ color:"rgba(200,146,42,.3)", fontSize:".75rem" }}>✕</button>
                      </div>
                    ))
                  }
                </div>
              )}

              {/* Notes */}
              {panelTab==="notes" && (
                <div>
                  <p style={{ color:"#C8922A", fontFamily:'"Playfair Display",serif', marginBottom:14, fontSize:".9rem" }}>Notas ({(notes[cur?.id]||[]).length})</p>
                  {(notes[cur?.id]||[]).length===0
                    ? <p style={{ color:"rgba(200,146,42,.3)", fontSize:".8rem", textAlign:"center", marginTop:24, lineHeight:1.8 }}>Sin notas.<br/>Toca 📝 para agregar.</p>
                    : [...(notes[cur?.id]||[])].sort((a,b)=>a.page-b.page).map(n=>(
                      <div key={n.id} onClick={()=>goTo(n.page)} style={{ padding:"10px 12px", marginBottom:8, background:"rgba(232,184,75,.06)", border:"1px solid rgba(232,184,75,.15)", borderLeft:"3px solid #E8B84B", borderRadius:"0 10px 10px 0", cursor:"pointer" }}>
                        <div style={{ display:"flex", justifyContent:"space-between", marginBottom:5 }}>
                          <span style={{ color:"rgba(200,146,42,.5)", fontSize:".7rem", fontWeight:600 }}>P.{n.page}</span>
                          <button className="btn" onClick={e=>{e.stopPropagation();const arr=(notes[cur.id]||[]).filter(x=>x.id!==n.id);const u={...notes,[cur.id]:arr};setNotes(u);ss("bk:notes",u);}} style={{ color:"rgba(200,146,42,.3)", fontSize:".72rem" }}>✕</button>
                        </div>
                        <p style={{ color:"#E8DDD0", fontSize:".82rem", lineHeight:1.55 }}>{n.text}</p>
                      </div>
                    ))
                  }
                  {(notes[cur?.id]||[]).length>0 && (
                    <button className="btn" onClick={()=>{
                      const txt=(notes[cur.id]||[]).sort((a,b)=>a.page-b.page).map(n=>`[Pág.${n.page}]\n${n.text}`).join("\n\n---\n\n");
                      const a=document.createElement("a");a.href="data:text/plain;charset=utf-8,"+encodeURIComponent(`${cur.title}\n${"=".repeat(40)}\n\n${txt}`);a.download=`notas-${cur.title}.txt`;a.click();
                    }} style={{ marginTop:10, width:"100%", background:"rgba(200,146,42,.1)", color:"#C8922A", borderRadius:9, padding:"9px", fontSize:".8rem", border:"1px solid rgba(200,146,42,.2)", fontWeight:600 }}>
                      ↓ Exportar notas (.txt)
                    </button>
                  )}
                </div>
              )}

              {/* Info */}
              {panelTab==="info" && (
                <div>
                  <p style={{ color:"#C8922A", fontFamily:'"Playfair Display",serif', marginBottom:14, fontSize:".9rem" }}>Información</p>
                  {[
                    ["Título", cur?.title],
                    ["Categoría", cur?.cat],
                    ["Formato", cur?.type?.toUpperCase()],
                    ["Total págs", totalPgs],
                    ["Pág. actual", page],
                    ["Progreso", `${progress}%`],
                    ["Marcas", (bookmarks[cur?.id]||[]).length],
                    ["Notas", (notes[cur?.id]||[]).length],
                    ["Tiempo lectura", fmtTime(readTime[cur?.id])],
                  ].map(([l,v])=>(
                    <div key={l} style={{ display:"flex", justifyContent:"space-between", padding:"7px 0", borderBottom:"1px solid rgba(200,146,42,.07)" }}>
                      <span style={{ color:"rgba(200,146,42,.4)", fontSize:".75rem" }}>{l}</span>
                      <span style={{ color:"#C8922A", fontSize:".8rem", fontWeight:600 }}>{v}</span>
                    </div>
                  ))}
                  <div style={{ marginTop:16 }}>
                    <div className="progress-bar"><div className="progress-fill" style={{ width:`${progress}%` }}/></div>
                    <p style={{ textAlign:"right", fontSize:".68rem", color:"rgba(200,146,42,.3)", marginTop:5 }}>{progress}% completado</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* THEME DROPDOWN */}
      {showTheme && (
        <div className="slide" style={{ position:"fixed", top:112, right:14, background:"#100D08", border:"1px solid rgba(200,146,42,.25)", borderRadius:16, padding:18, zIndex:200, width:295, boxShadow:"0 12px 48px rgba(0,0,0,.8)" }}>
          <p style={{ color:"#C8922A", fontFamily:'"Playfair Display",serif', marginBottom:16, fontSize:".95rem", fontWeight:700 }}>Apariencia del lector</p>
          <div style={{ marginBottom:18 }}>
            <p style={{ fontSize:".7rem", color:"rgba(200,146,42,.45)", marginBottom:10, fontWeight:600, letterSpacing:".08em", textTransform:"uppercase" }}>Tema de lectura</p>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8 }}>
              {Object.entries(THEMES).map(([k,th])=>(
                <button key={k} className="btn" onClick={async()=>{setTheme(k);await ss("bk:theme",k);}} style={{ padding:"11px 8px", background:th.page, border:theme===k?"2px solid #C8922A":"2px solid transparent", borderRadius:12, display:"flex", flexDirection:"column", alignItems:"center", gap:5, color:th.text, fontSize:".72rem", fontWeight:700, boxShadow:theme===k?"0 0 0 3px rgba(200,146,42,.2)":"none", transition:"all .2s" }}>
                  <span style={{ fontSize:"1.1rem" }}>{th.icon}</span>
                  <span style={{ color:th.text }}>{th.name}</span>
                </button>
              ))}
            </div>
          </div>

          {cur?.type === "text" && (
            <>
              <div style={{ marginBottom:14 }}>
                <p style={{ fontSize:".7rem", color:"rgba(200,146,42,.45)", marginBottom:10, fontWeight:600, letterSpacing:".08em", textTransform:"uppercase" }}>Tamaño de texto</p>
                <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                  <button className="btn" onClick={()=>setFontSize(f=>Math.max(12,f-1))} style={{ background:"rgba(200,146,42,.12)", color:"#C8922A", borderRadius:8, padding:"7px 14px", border:"1px solid rgba(200,146,42,.2)", fontWeight:700 }}>A−</button>
                  <span style={{ color:"#C8922A", flex:1, textAlign:"center", fontWeight:700 }}>{fontSize}px</span>
                  <button className="btn" onClick={()=>setFontSize(f=>Math.min(36,f+1))} style={{ background:"rgba(200,146,42,.12)", color:"#C8922A", borderRadius:8, padding:"7px 14px", border:"1px solid rgba(200,146,42,.2)", fontWeight:700 }}>A+</button>
                </div>
              </div>
              <div style={{ marginBottom:14 }}>
                <p style={{ fontSize:".7rem", color:"rgba(200,146,42,.45)", marginBottom:10, fontWeight:600, letterSpacing:".08em", textTransform:"uppercase" }}>Interlineado</p>
                <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                  <button className="btn" onClick={()=>setLineH(l=>Math.max(1.2,+(l-.1).toFixed(1)))} style={{ background:"rgba(200,146,42,.12)", color:"#C8922A", borderRadius:8, padding:"7px 13px", border:"1px solid rgba(200,146,42,.2)", fontWeight:700 }}>−</button>
                  <span style={{ color:"#C8922A", flex:1, textAlign:"center", fontWeight:700 }}>{lineH.toFixed(1)}</span>
                  <button className="btn" onClick={()=>setLineH(l=>Math.min(3,+(l+.1).toFixed(1)))} style={{ background:"rgba(200,146,42,.12)", color:"#C8922A", borderRadius:8, padding:"7px 13px", border:"1px solid rgba(200,146,42,.2)", fontWeight:700 }}>+</button>
                </div>
              </div>
              <div>
                <p style={{ fontSize:".7rem", color:"rgba(200,146,42,.45)", marginBottom:10, fontWeight:600, letterSpacing:".08em", textTransform:"uppercase" }}>Tipografía</p>
                <select value={fontFam} onChange={e=>{setFontFam(e.target.value);ss("bk:ff",e.target.value);}} style={{ width:"100%", background:"rgba(200,146,42,.08)", color:"#C8922A", border:"1px solid rgba(200,146,42,.25)", borderRadius:8, padding:"9px 12px", fontSize:".85rem" }}>
                  {FONTS.map(f=><option key={f.val} value={f.val}>{f.name}</option>)}
                </select>
              </div>
            </>
          )}
        </div>
      )}

      {/* ADD NOTE POPUP */}
      {showNote && (
        <div className="slide" style={{ position:"fixed", bottom:72, right:showPanel?295:14, background:"#100D08", border:"1px solid rgba(200,146,42,.3)", borderRadius:16, padding:16, width:270, zIndex:200, boxShadow:"0 12px 48px rgba(0,0,0,.8)" }}>
          <p style={{ color:"#C8922A", fontFamily:'"Playfair Display",serif', marginBottom:10, fontSize:".88rem" }}>📝 Nota — Pág. {page}</p>
          <textarea value={noteText} onChange={e=>setNoteText(e.target.value)} placeholder="Escribe tu anotación..." rows={4} style={{ width:"100%", resize:"vertical", background:"rgba(255,255,255,.04)", color:"#E8DDD0", borderRadius:10, padding:"9px 12px", border:"1px solid rgba(200,146,42,.2)", marginBottom:10, fontSize:".85rem", lineHeight:1.6 }}/>
          <div style={{ display:"flex", gap:8 }}>
            <button className="btn" onClick={saveNote} style={{ flex:1, background:"linear-gradient(135deg,#C8922A,#A06820)", color:"#FFF", borderRadius:10, padding:"9px", border:"none", fontSize:".85rem", fontWeight:700 }}>Guardar</button>
            <button className="btn" onClick={()=>{setShowNote(false);setNoteText("");}} style={{ background:"rgba(255,255,255,.05)", color:"rgba(200,146,42,.5)", borderRadius:10, padding:"9px 12px", border:"1px solid rgba(200,146,42,.15)", fontSize:".85rem" }}>✕</button>
          </div>
        </div>
      )}

      {/* BOTTOM NAV */}
      <div style={{ background: theme==="white"?"rgba(250,250,250,.97)":"rgba(12,9,5,.97)", backdropFilter:"blur(14px)", borderTop:`1px solid ${theme==="white"?"rgba(0,0,0,.1)":"rgba(200,146,42,.1)"}`, padding:"10px 18px", display:"flex", alignItems:"center", justifyContent:"center", gap:10, flexShrink:0, zIndex:100 }}>
        <button className="btn" onClick={()=>goTo(1)} disabled={page<=1} style={{ background:"rgba(200,146,42,.1)", color:"#C8922A", borderRadius:8, padding:"7px 11px", border:"1px solid rgba(200,146,42,.2)", opacity:page<=1?.3:1 }}>⏮</button>
        <button className="btn" onClick={()=>goTo(page-1)} disabled={page<=1} style={{ background:"rgba(200,146,42,.1)", color:"#C8922A", borderRadius:8, padding:"7px 18px", border:"1px solid rgba(200,146,42,.2)", fontSize:".88rem", fontWeight:600, opacity:page<=1?.3:1 }}>← Anterior</button>
        <div style={{ display:"flex", alignItems:"center", gap:7 }}>
          <input
            type="number"
            value={pageInput !== "" ? pageInput : page}
            onChange={e=>setPageInput(e.target.value)}
            onBlur={e=>{ const p=parseInt(e.target.value); if(p&&p>0&&p<=totalPgs) goTo(p); setPageInput(""); }}
            onKeyDown={e=>{ if(e.key==="Enter"){const p=parseInt(e.target.value);if(p&&p>0&&p<=totalPgs)goTo(p);setPageInput("");} }}
            style={{ width:58, textAlign:"center", background:"rgba(200,146,42,.1)", color:"#C8922A", border:"1px solid rgba(200,146,42,.25)", borderRadius:8, padding:"7px 4px", fontSize:".88rem", fontWeight:700 }}
          />
          <span style={{ color:"rgba(200,146,42,.4)", fontSize:".82rem" }}>/ {totalPgs}</span>
        </div>
        <button className="btn" onClick={()=>goTo(page+1)} disabled={page>=totalPgs} style={{ background:"rgba(200,146,42,.1)", color:"#C8922A", borderRadius:8, padding:"7px 18px", border:"1px solid rgba(200,146,42,.2)", fontSize:".88rem", fontWeight:600, opacity:page>=totalPgs?.3:1 }}>Siguiente →</button>
        <button className="btn" onClick={()=>goTo(totalPgs)} disabled={page>=totalPgs} style={{ background:"rgba(200,146,42,.1)", color:"#C8922A", borderRadius:8, padding:"7px 11px", border:"1px solid rgba(200,146,42,.2)", opacity:page>=totalPgs?.3:1 }}>⏭</button>
      </div>
    </div>
  );

  /* ═══════════════════════════════════════════════════════════
     BOOK DETAIL MODAL
  ═══════════════════════════════════════════════════════════ */
  const DetailModal = () => {
    if (!detailBook) return null;
    const [c1,c2] = BOOK_COLORS[detailBook.color] || BOOK_COLORS[0];
    const lp   = lastPages[detailBook.id];
    const tot  = detailBook.type==="text" ? detailBook.pages?.length||0 : 0;
    const pct  = tot>0 ? Math.round(lp/tot*100) : 0;
    const bms  = (bookmarks[detailBook.id]||[]).length;
    const nts  = (notes[detailBook.id]||[]).length;
    const rt   = readTime[detailBook.id];
    return (
      <div className="overlay" onClick={e=>{if(e.target===e.currentTarget)setDetailBook(null);}}>
        <div className="fadein" style={{ background:"#0F0C08", border:"1px solid rgba(200,146,42,.2)", borderRadius:20, padding:0, maxWidth:420, width:"92%", overflow:"hidden", boxShadow:"0 24px 80px rgba(0,0,0,.9)" }}>
          {/* Cover band */}
          <div style={{ background:`linear-gradient(135deg,${c1},${c2})`, padding:"28px 28px 20px", display:"flex", gap:20, alignItems:"center", position:"relative", overflow:"hidden" }}>
            <div style={{ position:"absolute", top:-30, right:-30, width:120, height:120, background:"rgba(255,255,255,.06)", borderRadius:"50%" }}/>
            <div style={{ width:80, height:110, background:"rgba(0,0,0,.25)", borderRadius:8, flexShrink:0, display:"flex", alignItems:"center", justifyContent:"center", boxShadow:"4px 6px 20px rgba(0,0,0,.5)", position:"relative" }}>
              <span style={{ color:"rgba(255,255,255,.9)", fontSize:".58rem", fontFamily:'"Playfair Display",serif', fontWeight:700, textAlign:"center", padding:6, lineHeight:1.3 }}>{detailBook.title}</span>
              <div style={{ position:"absolute", left:0, top:0, bottom:0, width:5, background:"rgba(0,0,0,.2)", borderRadius:"8px 0 0 8px" }}/>
            </div>
            <div style={{ flex:1, minWidth:0 }}>
              <h2 style={{ fontFamily:'"Playfair Display",serif', fontWeight:900, fontSize:"1.1rem", color:"#FFF", lineHeight:1.25, marginBottom:6 }}>{detailBook.title}</h2>
              <span className="pill" style={{ background:"rgba(0,0,0,.25)", color:"rgba(255,255,255,.7)", border:"1px solid rgba(255,255,255,.15)" }}>{detailBook.cat}</span>
              <span className="pill" style={{ background:"rgba(0,0,0,.25)", color:"rgba(255,255,255,.5)", border:"1px solid rgba(255,255,255,.1)", marginLeft:6 }}>{detailBook.type?.toUpperCase()}</span>
              {pct>0 && <div style={{ marginTop:10 }}><div style={{ height:4, background:"rgba(0,0,0,.3)", borderRadius:4, overflow:"hidden" }}><div style={{ height:"100%", width:`${pct}%`, background:"rgba(255,255,255,.7)" }}/></div><p style={{ color:"rgba(255,255,255,.55)", fontSize:".68rem", marginTop:4 }}>{pct}% completado</p></div>}
            </div>
          </div>

          {/* Stats row */}
          <div style={{ display:"flex", borderBottom:"1px solid rgba(200,146,42,.1)" }}>
            {[["📄","Páginas",tot||"—"],["🔖","Marcas",bms],["📝","Notas",nts],["⏱","Tiempo",fmtTime(rt)]].map(([ic,l,v])=>(
              <div key={l} style={{ flex:1, textAlign:"center", padding:"14px 4px", borderRight:"1px solid rgba(200,146,42,.08)" }}>
                <div style={{ fontSize:"1rem", marginBottom:4 }}>{ic}</div>
                <div style={{ color:"#C8922A", fontWeight:700, fontSize:".9rem" }}>{v}</div>
                <div style={{ color:"rgba(200,146,42,.4)", fontSize:".65rem", marginTop:2 }}>{l}</div>
              </div>
            ))}
          </div>

          {/* Actions */}
          <div style={{ padding:20, display:"flex", flexDirection:"column", gap:10 }}>
            <button className="btn" onClick={()=>{setDetailBook(null);openBook(detailBook);}} style={{ background:"linear-gradient(135deg,#C8922A,#A06820)", color:"#FFF", borderRadius:12, padding:"14px", fontSize:".95rem", fontWeight:700, border:"none", boxShadow:"0 6px 20px rgba(200,146,42,.4)", width:"100%" }}>
              {lp ? `▶ Continuar — Pág. ${lp}` : "▶ Comenzar a leer"}
            </button>
            <div style={{ display:"flex", gap:10 }}>
              {lp && <button className="btn" onClick={()=>{const u={...lastPages};delete u[detailBook.id];setLastPages(u);ss("bk:lp",u);setDetailBook(null);}} style={{ flex:1, background:"rgba(200,146,42,.06)", color:"rgba(200,146,42,.55)", borderRadius:12, padding:"11px", fontSize:".82rem", border:"1px solid rgba(200,146,42,.15)" }}>
                ↺ Reiniciar
              </button>}
              <button className="btn" onClick={()=>{ if(confirm(`¿Eliminar "${detailBook.title}"?`)) deleteBook(detailBook); }} style={{ flex:1, background:"rgba(200,50,50,.06)", color:"rgba(220,80,80,.7)", borderRadius:12, padding:"11px", fontSize:".82rem", border:"1px solid rgba(200,50,50,.15)" }}>
                🗑 Eliminar
              </button>
              <button className="btn" onClick={()=>setDetailBook(null)} style={{ flex:1, background:"rgba(255,255,255,.04)", color:"rgba(200,146,42,.4)", borderRadius:12, padding:"11px", fontSize:".82rem", border:"1px solid rgba(200,146,42,.1)" }}>
                Cerrar
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  /* ═══════════════════════════════════════════════════════════
     UPLOAD MODAL
  ═══════════════════════════════════════════════════════════ */
  const UploadModal = () => (
    <div className="overlay" onClick={e=>{if(e.target===e.currentTarget&&!upState.busy){setShowUpload(false);setUpState(p=>({...p,file:null,busy:false}));}}}>
      <div className="fadein" style={{ background:"#0F0C08", border:"1px solid rgba(200,146,42,.2)", borderRadius:20, padding:26, maxWidth:460, width:"92%", boxShadow:"0 24px 80px rgba(0,0,0,.9)" }}>
        <h2 style={{ fontFamily:'"Playfair Display",serif', color:"#C8922A", marginBottom:22, fontSize:"1.25rem", fontWeight:900 }}>Agregar libro</h2>

        {/* Drop zone */}
        <div
          onClick={()=>!upState.busy&&fileRef.current?.click()}
          onDragOver={e=>e.preventDefault()}
          onDrop={e=>{e.preventDefault();const f=e.dataTransfer.files[0];if(f)setUpState(p=>({...p,file:f,title:p.title||f.name.replace(/\.[^.]+$/,"")}));}}
          style={{ border:upState.file?"2px solid rgba(200,146,42,.7)":"2px dashed rgba(200,146,42,.2)", borderRadius:14, padding:20, textAlign:"center", cursor:upState.busy?"default":"pointer", marginBottom:18, background:upState.file?"rgba(200,146,42,.06)":"rgba(255,255,255,.02)", transition:"all .2s" }}>
          <input ref={fileRef} type="file" accept=".pdf,.txt,.png,.jpg,.jpeg,.gif,.webp,.bmp" style={{ display:"none" }} onChange={e=>{const f=e.target.files[0];if(f)setUpState(p=>({...p,file:f,title:p.title||f.name.replace(/\.[^.]+$/,"")}));}}/>
          {upState.file
            ? <div>
                <div style={{ fontSize:"2.2rem", marginBottom:8 }}>{upState.file.type==="application/pdf"?"📄":upState.file.type.startsWith("image/")?"🖼️":"📝"}</div>
                <p style={{ color:"#C8922A", fontWeight:600 }}>{upState.file.name}</p>
                <p style={{ color:"rgba(200,146,42,.4)", fontSize:".75rem", marginTop:4 }}>{(upState.file.size/1024/1024).toFixed(2)} MB</p>
              </div>
            : <div>
                <div style={{ fontSize:"2.5rem", marginBottom:10, opacity:.5 }}>📁</div>
                <p style={{ color:"rgba(200,146,42,.6)", fontSize:".9rem" }}>Arrastra o toca para seleccionar</p>
                <p style={{ color:"rgba(200,146,42,.3)", fontSize:".75rem", marginTop:6 }}>PDF · TXT · PNG · JPG · WEBP</p>
              </div>
          }
        </div>

        <div style={{ marginBottom:14 }}>
          <label style={{ color:"rgba(200,146,42,.5)", fontSize:".75rem", display:"block", marginBottom:6, fontWeight:600, letterSpacing:".06em", textTransform:"uppercase" }}>Título</label>
          <input value={upState.title} onChange={e=>setUpState(p=>({...p,title:e.target.value}))} placeholder="Título del libro..." style={{ width:"100%", background:"rgba(200,146,42,.06)", color:"#E8DDD0" }}/>
        </div>
        <div style={{ marginBottom:18 }}>
          <label style={{ color:"rgba(200,146,42,.5)", fontSize:".75rem", display:"block", marginBottom:6, fontWeight:600, letterSpacing:".06em", textTransform:"uppercase" }}>Categoría</label>
          <select value={upState.cat} onChange={e=>setUpState(p=>({...p,cat:e.target.value}))} style={{ width:"100%", background:"rgba(200,146,42,.06)", color:"#E8DDD0" }}>
            {cats.map(c=><option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div style={{ marginBottom:22 }}>
          <label style={{ color:"rgba(200,146,42,.5)", fontSize:".75rem", display:"block", marginBottom:10, fontWeight:600, letterSpacing:".06em", textTransform:"uppercase" }}>Color de portada</label>
          <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
            {BOOK_COLORS.map(([c1,c2],idx)=>(
              <button key={idx} className="btn" onClick={()=>setUpState(p=>({...p,color:idx}))} style={{ width:34, height:34, background:`linear-gradient(135deg,${c1},${c2})`, borderRadius:9, border:upState.color===idx?"3px solid #C8922A":"3px solid transparent", boxShadow:upState.color===idx?"0 0 0 2px rgba(200,146,42,.3)":"none" }}/>
            ))}
          </div>
        </div>
        <div style={{ display:"flex", gap:10 }}>
          <button className="btn" onClick={doUpload} disabled={!upState.file||upState.busy} style={{ flex:1, background:upState.file&&!upState.busy?"linear-gradient(135deg,#C8922A,#A06820)":"rgba(200,146,42,.15)", color:"#FFF", borderRadius:12, padding:"13px", fontSize:".92rem", fontWeight:700, border:"none", boxShadow:upState.file&&!upState.busy?"0 6px 18px rgba(200,146,42,.4)":"none", opacity:!upState.file||upState.busy?.5:1 }}>
            {upState.busy ? <><span className="spin">⟳</span> Procesando...</> : "+ Agregar a biblioteca"}
          </button>
          <button className="btn" onClick={()=>{if(!upState.busy){setShowUpload(false);setUpState(p=>({...p,file:null,busy:false}));}}} style={{ background:"rgba(255,255,255,.04)", color:"rgba(200,146,42,.4)", borderRadius:12, padding:"13px 16px", border:"1px solid rgba(200,146,42,.15)", fontSize:".9rem" }}>
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );

  /* ═══════════════════════════════════════════════════════════
     CATEGORY MANAGER
  ═══════════════════════════════════════════════════════════ */
  const CatModal = () => (
    <div className="overlay" onClick={e=>{if(e.target===e.currentTarget)setShowCatMgr(false);}}>
      <div className="fadein" style={{ background:"#0F0C08", border:"1px solid rgba(200,146,42,.2)", borderRadius:20, padding:26, maxWidth:400, width:"92%", boxShadow:"0 24px 80px rgba(0,0,0,.9)" }}>
        <h2 style={{ fontFamily:'"Playfair Display",serif', color:"#C8922A", marginBottom:20, fontSize:"1.2rem", fontWeight:900 }}>Gestionar categorías</h2>
        <div style={{ marginBottom:16, maxHeight:250, overflowY:"auto" }}>
          {cats.map(c=>(
            <div key={c} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"10px 14px", marginBottom:6, background:"rgba(200,146,42,.05)", borderRadius:10, border:"1px solid rgba(200,146,42,.1)" }}>
              <span style={{ color:"#E8DDD0", fontSize:".88rem" }}>📁 {c}</span>
              <button className="btn" onClick={async()=>{const u=cats.filter(x=>x!==c);setCats(u);await ss("bk:cats",u);}} style={{ color:"rgba(200,146,42,.3)", fontSize:".8rem", padding:"2px 7px" }}>✕</button>
            </div>
          ))}
        </div>
        <div style={{ display:"flex", gap:9, marginBottom:18 }}>
          <input value={newCat} onChange={e=>setNewCat(e.target.value)} placeholder="Nueva categoría..." style={{ flex:1 }} onKeyDown={async e=>{if(e.key==="Enter"&&newCat.trim()){const u=[...cats,newCat.trim()];setCats(u);await ss("bk:cats",u);setNewCat("");}}}/>
          <button className="btn" onClick={async()=>{if(!newCat.trim())return;const u=[...cats,newCat.trim()];setCats(u);await ss("bk:cats",u);setNewCat("");}} style={{ background:"linear-gradient(135deg,#C8922A,#A06820)", color:"#FFF", borderRadius:10, padding:"10px 16px", border:"none", fontWeight:700 }}>+</button>
        </div>
        <button className="btn" onClick={()=>setShowCatMgr(false)} style={{ width:"100%", background:"rgba(255,255,255,.04)", color:"rgba(200,146,42,.4)", borderRadius:12, padding:"12px", border:"1px solid rgba(200,146,42,.12)" }}>Cerrar</button>
      </div>
    </div>
  );

  /* ═══════════════════════════════════════════════════════════
     CONTEXT MENU
  ═══════════════════════════════════════════════════════════ */
  const CtxMenu = () => !ctxMenu ? null : (
    <div onClick={e=>e.stopPropagation()} style={{ position:"fixed", top:ctxMenu.y, left:ctxMenu.x, background:"#0F0C08", border:"1px solid rgba(200,146,42,.25)", borderRadius:12, padding:6, zIndex:600, boxShadow:"0 8px 36px rgba(0,0,0,.8)", minWidth:160 }}>
      {[
        { l:"📖 Abrir",        a:()=>{openBook(ctxMenu.book);setCtxMenu(null);} },
        { l:"ℹ️ Detalles",     a:()=>{setDetailBook(ctxMenu.book);setCtxMenu(null);} },
        { l:"🗑 Eliminar",     a:()=>{ if(confirm(`¿Eliminar "${ctxMenu.book.title}"?`)) deleteBook(ctxMenu.book); }, danger:true },
      ].map(({l,a,danger})=>(
        <button key={l} className="btn" onClick={a} style={{ display:"block", width:"100%", textAlign:"left", padding:"10px 14px", color:danger?"rgba(220,80,80,.8)":"#C8922A", background:"transparent", borderRadius:8, fontSize:".86rem", fontWeight:500 }}>
          {l}
        </button>
      ))}
    </div>
  );

  /* ═══════════════════════════════════════════════════════════
     RENDER
  ═══════════════════════════════════════════════════════════ */
  return (
    <div onClick={()=>setCtxMenu(null)}>
      <style>{G}</style>
      {view === "library" && <Library/>}
      {view === "reader"  && cur && <Reader/>}

      {/* Modals */}
      {showUpload  && <UploadModal/>}
      {showCatMgr  && <CatModal/>}
      {detailBook  && view==="library" && <DetailModal/>}
      <CtxMenu/>
    </div>
  );
}
