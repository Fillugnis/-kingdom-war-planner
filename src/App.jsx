import { useState, useEffect, useRef, useCallback } from "react"

// ─── Supabase config ─────────────────────────────────────────────────────────
const SUPABASE_URL = "https://anqkxdjekunupmfljugm.supabase.co"
const SUPABASE_KEY = "sb_publishable_qKAsGfNncM2W-rWfMBfBhA_S3FRbbdq"

async function sbFetch(method, body) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/map_state?id=eq.1`, {
    method,
    headers: {
      "apikey": SUPABASE_KEY,
      "Authorization": `Bearer ${SUPABASE_KEY}`,
      "Content-Type": "application/json",
      "Prefer": method === "PATCH" ? "return=minimal" : "return=representation",
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  if (method === "PATCH") return true
  const data = await res.json()
  return data[0] || null
}

async function loadState() { return sbFetch("GET") }
async function saveState(state) { return sbFetch("PATCH", state) }

// ─── données initiales ────────────────────────────────────────────────────────
const CITIES_INITIAL = [
  { id: 1, name: "Kantan",  x: 620, y:  75 },
  { id: 2, name: "Gyou",    x: 458, y: 285 },
  { id: 3, name: "Retsubi", x: 390, y: 315 },
  { id: 4, name: "Gian",    x: 505, y: 195 },
  { id: 5, name: "Atsuyo",  x: 685, y: 325 },
  { id: 6, name: "Kanyou",  x: 128, y: 478 },
  { id: 7, name: "Heiyou",  x: 225, y: 355 },
  { id: 8, name: "Tonryuu", x: 470, y: 390 },
]
const FEATURES_INITIAL = [
  { id: 1, kind: "mountain", name: "Montagnes N.",    x: 130, y: 160, w: 160, h: 80 },
  { id: 2, kind: "plain",    name: "Grande Plaine",   x: 275, y: 470, w: 220, h: 90 },
  { id: 3, kind: "river",    name: "Rivière centrale",x: 330, y:   0, w:  70, h: 600 },
]
const HQ_INITIAL = [
  { id: 1, faction: "Qin",  name: "QG Ousen",  x: 150, y: 420 },
  { id: 2, faction: "Zhao", name: "QG Riboku", x: 600, y: 160 },
]
const INITIAL_ARMIES = [
  { id: 1, general: "Ousen",     faction: "Qin",  troops: 40000, x: 178, y: 368, color: "#1a4db0" },
  { id: 2, general: "Shin",      faction: "Qin",  troops:  8000, x: 290, y: 298, color: "#2a5ece" },
  { id: 3, general: "Riboku",    faction: "Zhao", troops: 30000, x: 558, y: 198, color: "#b02020" },
  { id: 4, general: "Shibashou", faction: "Zhao", troops: 20000, x: 622, y: 308, color: "#8a1818" },
]
const MOT_DE_PASSE = "étoiledefeu51"

const GEN_NAMES = ["Kanki","Mouten","Ouhon","Yotanwa","Heki","Tou","Renpa","Kousen","Bajio","Gakuhaku"]

function deepClone(v) { return JSON.parse(JSON.stringify(v)) }

const DEFAULT_STATE = {
  armies:      INITIAL_ARMIES,
  cities:      CITIES_INITIAL,
  features:    FEATURES_INITIAL,
  hqs:         HQ_INITIAL,
  current_day: 1,
  history:     [null, { armies: INITIAL_ARMIES, cities: CITIES_INITIAL, features: FEATURES_INITIAL, hqs: HQ_INITIAL }],
}

// ─── composant principal ──────────────────────────────────────────────────────
export default function App() {
  const svgRef        = useRef(null)
  const nextArmyId    = useRef(5)
  const nextCityId    = useRef(9)
  const nextFeatureId = useRef(4)
  const nextHqId      = useRef(3)

  const [loading, setLoading] = useState(true)
  const [editMode, setEditMode] = useState(false)
  const [saving,  setSaving]  = useState(false)

  const [view, setView] = useState({ x: 0, y: 0, scale: 1 })
  const viewRef         = useRef({ x: 0, y: 0, scale: 1 })
  const [dims, setDims] = useState({ w: 1200, h: 800 })

  const [armies,   setArmies]   = useState(deepClone(INITIAL_ARMIES))
  const [cities,   setCities]   = useState(deepClone(CITIES_INITIAL))
  const [features, setFeatures] = useState(deepClone(FEATURES_INITIAL))
  const [hqs,      setHqs]      = useState(deepClone(HQ_INITIAL))
  const [currentDay, setCurrentDay] = useState(1)

  const armiesRef   = useRef(deepClone(INITIAL_ARMIES))
  const citiesRef   = useRef(deepClone(CITIES_INITIAL))
  const featuresRef = useRef(deepClone(FEATURES_INITIAL))
  const hqsRef      = useRef(deepClone(HQ_INITIAL))
  const currentDayRef = useRef(1)
  const historyRef  = useRef([null, { armies: deepClone(INITIAL_ARMIES), cities: deepClone(CITIES_INITIAL), features: deepClone(FEATURES_INITIAL), hqs: deepClone(HQ_INITIAL) }])

  const [selected, setSelected] = useState({ type: null, id: null })
  const dragRef = useRef({ type: null, id: null, offX: 0, offY: 0 })
  const panRef  = useRef({ active: false, startX: 0, startY: 0, origX: 0, origY: 0 })

  useEffect(() => { viewRef.current = view },         [view])
  useEffect(() => { armiesRef.current = armies },     [armies])
  useEffect(() => { citiesRef.current = cities },     [cities])
  useEffect(() => { featuresRef.current = features }, [features])
  useEffect(() => { hqsRef.current = hqs },           [hqs])
  useEffect(() => { currentDayRef.current = currentDay }, [currentDay])

  // ── chargement initial depuis Supabase ──
  useEffect(() => {
    loadState().then(data => {
      if (data && data.armies && data.armies.length > 0) {
        setArmies(data.armies)
        setCities(data.cities)
        setFeatures(data.features)
        setHqs(data.hqs || HQ_INITIAL)
        setCurrentDay(data.current_day || 1)
        historyRef.current = data.history || DEFAULT_STATE.history
        // sync nextId refs
        const maxA = Math.max(...data.armies.map(a => a.id), 4)
        const maxC = Math.max(...data.cities.map(c => c.id), 8)
        const maxF = Math.max(...data.features.map(f => f.id), 3)
        const maxH = Math.max(...(data.hqs||[]).map(h => h.id), 2)
        nextArmyId.current    = maxA + 1
        nextCityId.current    = maxC + 1
        nextFeatureId.current = maxF + 1
        nextHqId.current      = maxH + 1
      }
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [])

  // ── sauvegarde Supabase ──
  async function persist(overrides = {}) {
    setSaving(true)
    await saveState({
      armies:      overrides.armies   ?? armiesRef.current,
      cities:      overrides.cities   ?? citiesRef.current,
      features:    overrides.features ?? featuresRef.current,
      hqs:         overrides.hqs      ?? hqsRef.current,
      current_day: overrides.current_day ?? currentDayRef.current,
      history:     overrides.history  ?? historyRef.current,
      updated_at:  new Date().toISOString(),
    })
    setSaving(false)
  }

  // ── resize ──
  useEffect(() => {
    function measure() {
      const el = svgRef.current?.parentElement
      if (!el) return
      setDims({ w: el.clientWidth, h: el.clientHeight })
    }
    measure()
    window.addEventListener("resize", measure)
    return () => window.removeEventListener("resize", measure)
  }, [])

  function screenToWorld(sx, sy) {
    const { x, y, scale } = viewRef.current
    return { x: (sx - x) / scale, y: (sy - y) / scale }
  }
  function applyZoom(factor, cx, cy) {
    setView(v => {
      const ns = Math.min(6, Math.max(0.15, v.scale * factor))
      return { x: cx + (v.x - cx) * factor, y: cy + (v.y - cy) * factor, scale: ns }
    })
  }
  function resetView() { setView({ x: 0, y: 0, scale: 1 }) }
  function isReplaying() { return currentDayRef.current < historyRef.current.length - 1 }

  const onMapMouseDown = useCallback(e => {
    if (e.target.closest?.("[data-node]")) return
    panRef.current = { active: true, startX: e.clientX, startY: e.clientY, origX: viewRef.current.x, origY: viewRef.current.y }
    setSelected({ type: null, id: null })
  }, [])

  const startDrag = useCallback((e, type, item) => {
    e.stopPropagation()
    if (isReplaying() || !editMode) return
    setSelected({ type, id: item.id })
    const rect = svgRef.current.getBoundingClientRect()
    const pt   = screenToWorld(e.clientX - rect.left, e.clientY - rect.top)
    dragRef.current = { type, id: item.id, offX: pt.x - item.x, offY: pt.y - item.y }
  }, [])

  useEffect(() => {
    function onMove(e) {
      if (dragRef.current.id !== null) {
        const rect = svgRef.current?.getBoundingClientRect()
        if (!rect) return
        const pt = screenToWorld(e.clientX - rect.left, e.clientY - rect.top)
        const nx = pt.x - dragRef.current.offX
        const ny = pt.y - dragRef.current.offY
        const t  = dragRef.current.type
        if (t === "army")    setArmies(p   => p.map(a => a.id === dragRef.current.id ? { ...a, x: nx, y: ny } : a))
        if (t === "city")    setCities(p   => p.map(c => c.id === dragRef.current.id ? { ...c, x: nx, y: ny } : c))
        if (t === "feature") setFeatures(p => p.map(f => f.id === dragRef.current.id ? { ...f, x: nx, y: ny } : f))
        if (t === "hq")      setHqs(p      => p.map(h => h.id === dragRef.current.id ? { ...h, x: nx, y: ny } : h))
        return
      }
      if (panRef.current.active) {
        setView(v => ({ ...v,
          x: panRef.current.origX + (e.clientX - panRef.current.startX),
          y: panRef.current.origY + (e.clientY - panRef.current.startY),
        }))
      }
    }
    function onUp() {
      // sauvegarde après chaque drag
      if (dragRef.current.id !== null) {
        setTimeout(() => persist(), 100)
      }
      dragRef.current = { type: null, id: null, offX: 0, offY: 0 }
      panRef.current.active = false
    }
    window.addEventListener("mousemove", onMove)
    window.addEventListener("mouseup",   onUp)
    return () => { window.removeEventListener("mousemove", onMove); window.removeEventListener("mouseup", onUp) }
  }, [])

  const onWheel = useCallback(e => {
    e.preventDefault()
    const rect = svgRef.current.getBoundingClientRect()
    applyZoom(e.deltaY < 0 ? 1.12 : 0.89, e.clientX - rect.left, e.clientY - rect.top)
  }, [])
  useEffect(() => {
    const el = svgRef.current?.parentElement
    if (!el) return
    el.addEventListener("wheel", onWheel, { passive: false })
    return () => el.removeEventListener("wheel", onWheel)
  }, [onWheel])

  // ── historique ──
  function saveSnapshot(day) {
    historyRef.current[day] = {
      armies:   deepClone(armiesRef.current),
      cities:   deepClone(citiesRef.current),
      features: deepClone(featuresRef.current),
      hqs:      deepClone(hqsRef.current),
    }
  }
  function nextDay() {
    const day = currentDayRef.current
    if (isReplaying()) historyRef.current = historyRef.current.slice(0, day + 1)
    saveSnapshot(day)
    const nd = day + 1
    historyRef.current[nd] = deepClone(historyRef.current[day])
    setCurrentDay(nd)
    setSelected({ type: null, id: null })
    persist({ current_day: nd, history: historyRef.current })
  }
  function goDay(d) {
    const max = historyRef.current.length - 1
    if (d < 1 || d > max) return
    const snap = historyRef.current[d]
    if (!snap) return
    setArmies(deepClone(snap.armies))
    setCities(deepClone(snap.cities))
    setFeatures(deepClone(snap.features))
    setHqs(deepClone(snap.hqs || hqsRef.current))
    setCurrentDay(d)
    setSelected({ type: null, id: null })
    persist({ current_day: d })
  }

  // ── ajouts ──
  function addArmy() {
    if (isReplaying() || !editMode) return
    const id = nextArmyId.current++
    const f  = id % 2 === 0 ? "Qin" : "Zhao"
    const a  = { id, faction: f, general: GEN_NAMES[Math.floor(Math.random()*GEN_NAMES.length)], troops: Math.floor(Math.random()*18000)+2000, x: 120+Math.random()*560, y: 80+Math.random()*440, color: f==="Qin"?"#1a4db0":"#b02020" }
    setArmies(p => { const n=[...p,a]; armiesRef.current=n; persist({armies:n}); return n })
  }
  function addCity() {
    if (isReplaying() || !editMode) return
    const id = nextCityId.current++
    const c  = { id, name: `Ville ${id}`, x: 200+Math.random()*400, y: 100+Math.random()*400 }
    setCities(p => { const n=[...p,c]; citiesRef.current=n; persist({cities:n}); return n })
  }
  function addFeature(kind) {
    if (isReplaying() || !editMode) return
    const id = nextFeatureId.current++
    const base = { mountain:{name:"Montagnes",w:160,h:80}, plain:{name:"Plaine",w:220,h:90}, river:{name:"Rivière",w:70,h:600} }[kind]
    const f = { id, kind, x:150+Math.random()*400, y:80+Math.random()*300, ...base }
    setFeatures(p => { const n=[...p,f]; featuresRef.current=n; persist({features:n}); return n })
  }
  function addHq(faction) {
    if (isReplaying() || !editMode) return
    const id = nextHqId.current++
    const h  = { id, faction, name:`QG ${id}`, x:150+Math.random()*500, y:100+Math.random()*400 }
    setHqs(p => { const n=[...p,h]; hqsRef.current=n; persist({hqs:n}); return n })
  }
  function deleteSelected() {
    if (isReplaying() || !editMode) return
    const { type, id } = selected
    if (!type) return
    if (type === "army")    setArmies(p   => { const n=p.filter(a=>a.id!==id); armiesRef.current=n;   persist({armies:n});   return n })
    if (type === "city")    setCities(p   => { const n=p.filter(c=>c.id!==id); citiesRef.current=n;   persist({cities:n});   return n })
    if (type === "feature") setFeatures(p => { const n=p.filter(f=>f.id!==id); featuresRef.current=n; persist({features:n}); return n })
    if (type === "hq")      setHqs(p      => { const n=p.filter(h=>h.id!==id); hqsRef.current=n;      persist({hqs:n});      return n })
    setSelected({ type: null, id: null })
  }
  function updateItem(type, id, field, value) {
    if (isReplaying() || !editMode) return
    const numFields = ["troops","x","y","w","h"]
    const v = numFields.includes(field) ? parseFloat(value)||0 : value
    if (type === "army") setArmies(p => {
      const n = p.map(a => {
        if (a.id !== id) return a
        const u = { ...a, [field]: v }
        if (field === "faction") u.color = v==="Qin"?"#1a4db0":"#b02020"
        return u
      })
      armiesRef.current = n; persist({armies:n}); return n
    })
    if (type === "city")    setCities(p   => { const n=p.map(c=>c.id===id?{...c,[field]:v}:c); citiesRef.current=n;   persist({cities:n});   return n })
    if (type === "feature") setFeatures(p => { const n=p.map(f=>f.id===id?{...f,[field]:v}:f); featuresRef.current=n; persist({features:n}); return n })
    if (type === "hq")      setHqs(p      => { const n=p.map(h=>h.id===id?{...h,[field]:v}:h); hqsRef.current=n;      persist({hqs:n});      return n })
  }

  // ── rendu terrain ──
  function renderFeature(f) {
    const isSel = selected.type==="feature" && selected.id===f.id
    const props = { key:f.id, "data-node":true, transform:`translate(${f.x},${f.y})`, style:{cursor:isReplaying()?"default":"grab"}, onMouseDown:e=>startDrag(e,"feature",f) }
    if (f.kind==="river") return (
      <g {...props}>
        <rect x={-f.w/2} y={0} width={f.w} height={f.h} fill="#4a7a9a" opacity="0.18"/>
        <path d="M0 0 Q40 100 18 210 Q-12 360 38 460 Q78 530 58 600" stroke="#4a7a9a" strokeWidth="7" fill="none" opacity="0.45"/>
        <path d="M0 0 Q40 100 18 210 Q-12 360 38 460 Q78 530 58 600" stroke="#7aaabf" strokeWidth="2.5" fill="none" opacity="0.35"/>
        {isSel && <rect x={-f.w/2} y={0} width={f.w} height={f.h} fill="none" stroke="#f0d020" strokeDasharray="5,4"/>}
        <text x={10} y={18} fontSize="11" fill="#0e2a3d" fontFamily="Georgia,serif">{f.name}</text>
      </g>
    )
    if (f.kind==="mountain") return (
      <g {...props}>
        <g fill="#7a5a20" opacity="0.5">
          <polygon points="-55,20 -35,-14 -15,20"/>
          <polygon points="-25,20 -5,-20 15,20"/>
          <polygon points="5,20 25,-12 45,20"/>
        </g>
        {isSel && <rect x={-f.w/2} y={-f.h/2} width={f.w} height={f.h} fill="none" stroke="#f0d020" strokeDasharray="5,4"/>}
        <text x={-f.w/2+4} y={f.h/2-5} fontSize="11" fill="#3f2d1b" fontFamily="Georgia,serif">{f.name}</text>
      </g>
    )
    return (
      <g {...props}>
        <ellipse cx={0} cy={0} rx={f.w/2} ry={f.h/2} fill="#7a8a50" opacity="0.18"/>
        <ellipse cx={-20} cy={5} rx={45} ry={18} fill="#8a9a60" opacity="0.25"/>
        {isSel && <ellipse cx={0} cy={0} rx={f.w/2} ry={f.h/2} fill="none" stroke="#f0d020" strokeDasharray="5,4"/>}
        <text x={-f.w/2+4} y={f.h/2-5} fontSize="11" fill="#3f2d1b" fontFamily="Georgia,serif">{f.name}</text>
      </g>
    )
  }

  // ── rendu QG ──
  function renderHq(h) {
    const isSel = selected.type==="hq" && selected.id===h.id
    const isQin = h.faction==="Qin"
    const col   = isQin?"#1a4db0":"#b02020"
    return (
      <g key={h.id} data-node transform={`translate(${h.x},${h.y})`}
         style={{ cursor: isReplaying()?"default":"grab" }}
         onMouseDown={e=>startDrag(e,"hq",h)}>
        <rect x="-32" y="-32" width="64" height="64" rx="4" fill="#000" opacity="0.25" transform="translate(2,2)"/>
        <rect x="-32" y="-32" width="64" height="64" rx="4" fill={col} opacity="0.9"
              stroke={isSel?"#f0d020":isQin?"#80a8ff":"#ff9090"} strokeWidth={isSel?2.5:1.5}/>
        <rect x="-32" y="-32" width="64" height="10" rx="4" fill={isQin?"#0a2a80":"#801010"} opacity="0.7"/>
        <rect x="-8"  y="-24" width="16" height="28" fill={isQin?"#2a5ece":"#c02020"} opacity="0.9"/>
        <rect x="-12" y="-28" width="6"  height="6"  fill={isQin?"#3a6ede":"#d03030"}/>
        <rect x="-2"  y="-28" width="6"  height="6"  fill={isQin?"#3a6ede":"#d03030"}/>
        <rect x="8"   y="-28" width="6"  height="6"  fill={isQin?"#3a6ede":"#d03030"}/>
        <rect x="-28" y="-18" width="10" height="18" fill={isQin?"#2a5ece":"#c02020"} opacity="0.8"/>
        <rect x="18"  y="-18" width="10" height="18" fill={isQin?"#2a5ece":"#c02020"} opacity="0.8"/>
        <line x1="0" y1="-28" x2="0" y2="-42" stroke={isQin?"#c0d8ff":"#ffc0c0"} strokeWidth="1.5"/>
        <polygon points="0,-42 10,-38 0,-34" fill={isQin?"#e0f0ff":"#ffd0d0"}/>
        <rect x="-30" y="18" width="60" height="14" fill="#1a1008" rx="2" opacity="0.85"/>
        <text textAnchor="middle" y="28" fontFamily="Georgia,serif" fontSize="9"
              fill={isQin?"#b8d4ff":"#ffc0c0"} fontWeight="bold">{h.name}</text>
      </g>
    )
  }

  const replay    = isReplaying()
  const maxDay    = historyRef.current.length - 1
  const transform = `translate(${view.x},${view.y}) scale(${view.scale})`
  const selItem   =
    selected.type==="army"    ? armies.find(a=>a.id===selected.id) :
    selected.type==="city"    ? cities.find(c=>c.id===selected.id) :
    selected.type==="feature" ? features.find(f=>f.id===selected.id) :
    selected.type==="hq"      ? hqs.find(h=>h.id===selected.id) : null

  if (loading) return (
    <div style={{ display:"flex", alignItems:"center", justifyContent:"center", height:"100vh", background:"#1a1208", color:"#e8c87a", fontFamily:"Georgia,serif", fontSize:20 }}>
      Chargement de la carte...
    </div>
  )

  return (
    <div style={S.root}>
      {/* ══ CARTE ══ */}
      <div style={S.mapWrap} onMouseDown={onMapMouseDown}>
        <svg ref={svgRef} width={dims.w} height={dims.h} viewBox={`0 0 ${dims.w} ${dims.h}`} style={{ display:"block" }}>
          <defs>
            <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
              <path d="M40 0L0 0 0 40" fill="none" stroke="#8a6a30" strokeWidth="0.4" opacity="0.5"/>
            </pattern>
            <pattern id="grid2" width="200" height="200" patternUnits="userSpaceOnUse">
              <path d="M200 0L0 0 0 200" fill="none" stroke="#7a5a20" strokeWidth="0.8" opacity="0.3"/>
            </pattern>
          </defs>
          <g transform={transform}>
            <rect x={-dims.w*10} y={-dims.h*10} width={dims.w*20} height={dims.h*20} fill="#c4a460"/>
            <rect x={-dims.w*10} y={-dims.h*10} width={dims.w*20} height={dims.h*20} fill="url(#grid)"/>
            <rect x={-dims.w*10} y={-dims.h*10} width={dims.w*20} height={dims.h*20} fill="url(#grid2)" opacity="0.4"/>
            {features.map(renderFeature)}
            <line x1="410" y1="-2000" x2="410" y2="2000" stroke="#3f2d1b" strokeWidth="3" strokeDasharray="10,6" opacity="0.45"/>
            <text x="80"  y="90" fontFamily="Georgia,serif" fontSize="52" fill="#3f2d1b" opacity="0.1" fontWeight="bold" letterSpacing="10">QIN</text>
            <text x="490" y="90" fontFamily="Georgia,serif" fontSize="52" fill="#3f2d1b" opacity="0.1" fontWeight="bold" letterSpacing="10">ZHAO</text>
            {hqs.map(renderHq)}
            {cities.map(c => {
              const isSel = selected.type==="city" && selected.id===c.id
              return (
                <g key={c.id} data-node transform={`translate(${c.x},${c.y})`}
                   style={{ cursor: isReplaying()?"default":"grab" }}
                   onMouseDown={e=>startDrag(e,"city",c)}>
                  <rect x="-28" y="-18" width="56" height="20" fill="#2a1a08" rx="2" opacity="0.8"/>
                  <text textAnchor="middle" y="-4" fontFamily="Georgia,serif" fontSize="10" fill="#d4b060">{c.name}</text>
                  <text textAnchor="middle" y="12" fontSize="13">⛩</text>
                  {isSel && <rect x="-30" y="-22" width="60" height="44" fill="none" stroke="#f0d020" strokeDasharray="5,4"/>}
                </g>
              )
            })}
            {armies.map(a => {
              const isQin = a.faction==="Qin"
              const isSel = selected.type==="army" && selected.id===a.id
              return (
                <g key={a.id} data-node transform={`translate(${a.x},${a.y})`}
                   style={{ cursor: replay?"default":"grab" }}
                   onMouseDown={e=>startDrag(e,"army",a)}>
                  <rect x="-53" y="-21" width="106" height="46" rx="5" fill="#000" opacity="0.3" transform="translate(2,2)"/>
                  <rect x="-53" y="-21" width="106" height="46" rx="5"
                        fill={replay?"#555":a.color} opacity={replay?0.7:1}
                        stroke={isSel?"#f0d020":isQin?"#80a8ff":"#ff9090"}
                        strokeWidth={isSel?2.5:1.5}/>
                  <rect x="-53" y="-21" width="106" height="8" rx="5"
                        fill={isQin?"#2a5ece":"#c02020"} opacity={replay?0.4:0.7}/>
                  <text x="-41" y="5"  fontSize="15">{isQin?"⚔":"🛡"}</text>
                  <text x="-22" y="-5" fontFamily="Georgia,serif" fontSize="11" fontWeight="bold"
                        fill={replay?"#bbb":isQin?"#b8d4ff":"#ffc0c0"}>{a.general}</text>
                  <text x="-22" y="9"  fontFamily="Georgia,serif" fontSize="9"
                        fill={replay?"#999":"#d0c070"}>{a.troops.toLocaleString("fr-FR")} soldats</text>
                </g>
              )
            })}
          </g>
        </svg>
      </div>

      {/* ══ SIDEBAR ══ */}
      <div style={S.sidebar}>
        <div style={S.sideHeader}>
          <div style={S.sideTitle}>⚔ CARTE DE GUERRE</div>
          <div style={S.dayLabel}>Jour {currentDay}</div>
          {saving && <div style={S.savingBadge}>💾 Sauvegarde...</div>}
          <button style={S.editBtn} onClick={() => {
            if (editMode) { setEditMode(false) }
            else {
              const pwd = prompt("Mot de passe :")
              if (pwd === MOT_DE_PASSE) setEditMode(true)
              else alert("Mot de passe incorrect")
            }
          }}>
            {editMode ? "✏️ Mode édition actif" : "🔒 Verrouillé — cliquer pour éditer"}
          </button>
        </div>

        <div style={S.sideBody}>
          <div style={{ marginBottom:8 }}>
            <div style={S.legRow}><div style={{ ...S.legDot, background:"#3a6ad4" }}/> Qin</div>
            <div style={S.legRow}><div style={{ ...S.legDot, background:"#c44040" }}/> Zhao</div>
          </div>

          <div style={S.zoomRow}>
            <button style={S.zBtn} onClick={() => applyZoom(1.2, dims.w/2, dims.h/2)}>＋</button>
            <button style={S.zBtn} onClick={() => applyZoom(0.833, dims.w/2, dims.h/2)}>－</button>
            <button style={{ ...S.zBtn, fontSize:11 }} onClick={resetView}>↺ Reset</button>
          </div>

          {/* navigation jours */}
          <div style={S.dayNav}>
            <button style={S.arrowBtn} onClick={() => goDay(currentDay-1)} disabled={currentDay<=1}>◀</button>
            <div style={S.dayInfo}>
              <div style={S.dayNum}>Jour {currentDay} / {maxDay}</div>
              {replay && <div style={S.replayBadge}>📜 Lecture</div>}
            </div>
            <button style={S.arrowBtn} onClick={() => goDay(currentDay+1)} disabled={currentDay>=maxDay}>▶</button>
          </div>

          <div style={S.tlDays}>
            {Array.from({ length: maxDay }, (_,i) => i+1).map(d => (
              <div key={d} style={{ ...S.tlDot, ...(d===currentDay?S.tlDotActive:{}) }}
                   onClick={() => goDay(d)} title={`Jour ${d}`}>{d}</div>
            ))}
          </div>

          <div style={S.divider}/>

          <div style={S.sectionTitle}>Armées</div>
          <button style={S.addBtn} onClick={addArmy} disabled={!editMode} style={{...S.addBtn, opacity:editMode?1:0.4, cursor:editMode?"pointer":"default"}}>＋ Armée</button>

          <div style={S.sectionTitle}>QG</div>
          <div style={{ display:"flex", gap:4 }}>
            <button style={{ ...S.addBtn, flex:1, color:"#7ab0ff" }} onClick={() => addHq("Qin")}>＋ QG Qin</button>
            <button style={{ ...S.addBtn, flex:1, color:"#ff9090" }} onClick={() => addHq("Zhao")}>＋ QG Zhao</button>
          </div>

          <div style={S.sectionTitle}>Carte</div>
          <button style={S.addBtn} onClick={addCity}>＋ Ville</button>
          <div style={{ display:"flex", gap:4, marginTop:4 }}>
            <button style={{ ...S.addBtn, flex:1 }} onClick={() => addFeature("mountain")}>⛰ Monta.</button>
            <button style={{ ...S.addBtn, flex:1 }} onClick={() => addFeature("plain")}>🌾 Plaine</button>
            <button style={{ ...S.addBtn, flex:1 }} onClick={() => addFeature("river")}>〰 Riv.</button>
          </div>

          {selItem && !replay && (
            <div style={{ marginTop:12 }}>
              <div style={S.divider}/>
              <div style={S.selTitle}>{{ army:"Armée", city:"Ville", feature:"Terrain", hq:"QG" }[selected.type]}</div>
              <button style={S.delBtnBig} onClick={deleteSelected}>🗑 Supprimer</button>
              {selected.type==="army" && <>
                <label style={S.lbl}>Général</label>
                <input style={S.inp} value={selItem.general} onChange={e=>updateItem("army",selItem.id,"general",e.target.value)}/>
                <label style={S.lbl}>Effectifs</label>
                <input style={S.inp} type="number" value={selItem.troops} onChange={e=>updateItem("army",selItem.id,"troops",e.target.value)}/>
                <label style={S.lbl}>Faction</label>
                <select style={S.inp} value={selItem.faction} onChange={e=>updateItem("army",selItem.id,"faction",e.target.value)}>
                  <option>Qin</option><option>Zhao</option>
                </select>
              </>}
              {selected.type==="hq" && <>
                <label style={S.lbl}>Nom</label>
                <input style={S.inp} value={selItem.name} onChange={e=>updateItem("hq",selItem.id,"name",e.target.value)}/>
                <label style={S.lbl}>Faction</label>
                <select style={S.inp} value={selItem.faction} onChange={e=>updateItem("hq",selItem.id,"faction",e.target.value)}>
                  <option>Qin</option><option>Zhao</option>
                </select>
              </>}
              {selected.type==="city" && <>
                <label style={S.lbl}>Nom</label>
                <input style={S.inp} value={selItem.name} onChange={e=>updateItem("city",selItem.id,"name",e.target.value)}/>
              </>}
              {selected.type==="feature" && <>
                <label style={S.lbl}>Nom</label>
                <input style={S.inp} value={selItem.name} onChange={e=>updateItem("feature",selItem.id,"name",e.target.value)}/>
                <label style={S.lbl}>Type</label>
                <select style={S.inp} value={selItem.kind} onChange={e=>updateItem("feature",selItem.id,"kind",e.target.value)}>
                  <option value="mountain">Montagne</option>
                  <option value="plain">Plaine</option>
                  <option value="river">Rivière</option>
                </select>
              </>}
            </div>
          )}
        </div>

        <div style={S.sideFoot}>
          <div style={{ display:"flex", gap:6, alignItems:"center" }}>
            <button style={{ ...S.arrowBtnLg, opacity:currentDay<=1?0.35:1 }}
                    onClick={() => goDay(currentDay-1)} disabled={currentDay<=1}>◀</button>
            <button style={S.nextDayBtn} onClick={nextDay}>Jour suivant ＋</button>
            <button style={{ ...S.arrowBtnLg, opacity:currentDay>=maxDay?0.35:1 }}
                    onClick={() => goDay(currentDay+1)} disabled={currentDay>=maxDay}>▶</button>
          </div>
        </div>
      </div>
    </div>
  )
}

const S = {
  root:        { display:"grid", gridTemplateColumns:"1fr 270px", height:"100vh", background:"#0d0d0d" },
  mapWrap:     { position:"relative", overflow:"hidden", borderRadius:"12px 0 0 12px", border:"3px solid #3f2d1b", borderRight:"none", background:"#c4a460", cursor:"grab" },
  sidebar:     { background:"#1a1208", borderRadius:"0 12px 12px 0", border:"3px solid #3f2d1b", display:"flex", flexDirection:"column", overflow:"hidden" },
  sideHeader:  { background:"#2d1f0a", padding:"12px 14px", borderBottom:"2px solid #5a3a1a", textAlign:"center" },
  sideTitle:   { fontSize:13, fontWeight:"bold", color:"#e8c87a", letterSpacing:2, fontFamily:"Georgia,serif" },
  dayLabel:    { fontSize:12, color:"#f0d070", marginTop:3, fontFamily:"Georgia,serif", fontWeight:"bold" },
  savingBadge: { fontSize:10, color:"#80c080", marginTop:3, fontFamily:"Georgia,serif" },
  sideBody:    { flex:1, overflowY:"auto", padding:"10px 12px" },
  sideFoot:    { padding:"10px 12px", borderTop:"2px solid #3a2510" },
  legRow:      { display:"flex", alignItems:"center", gap:6, fontSize:10, color:"#a08040", marginBottom:3, fontFamily:"Georgia,serif" },
  legDot:      { width:9, height:9, borderRadius:"50%" },
  zoomRow:     { display:"flex", gap:5, marginBottom:10 },
  zBtn:        { flex:1, padding:5, borderRadius:5, background:"#2d1f0a", border:"1px solid #5a3a1a", color:"#c8a030", fontSize:15, cursor:"pointer", fontFamily:"Georgia,serif" },
  dayNav:      { display:"flex", alignItems:"center", gap:6, background:"#2d1f0a", border:"1px solid #5a3a1a", borderRadius:8, padding:"6px 8px", marginBottom:6 },
  dayInfo:     { flex:1, textAlign:"center" },
  dayNum:      { fontSize:12, fontWeight:"bold", color:"#e8c87a", fontFamily:"Georgia,serif" },
  replayBadge: { fontSize:9, color:"#c87030", fontFamily:"Georgia,serif", marginTop:2 },
  arrowBtn:    { background:"#3a2810", border:"1px solid #6a4820", color:"#e8c87a", fontSize:18, width:34, height:34, borderRadius:6, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", padding:0 },
  tlDays:      { display:"flex", flexWrap:"wrap", gap:3, marginBottom:8 },
  tlDot:       { width:24, height:24, borderRadius:"50%", background:"#2d1f0a", border:"1.5px solid #5a3a1a", color:"#a08040", fontSize:9, fontFamily:"Georgia,serif", display:"flex", alignItems:"center", justifyContent:"center", cursor:"pointer" },
  tlDotActive: { background:"#8a5010", border:"1.5px solid #e8c87a", color:"#f0d890" },
  divider:     { borderTop:"1px solid #3a2510", margin:"8px 0" },
  sectionTitle:{ fontSize:10, color:"#8a6828", fontFamily:"Georgia,serif", letterSpacing:1, textTransform:"uppercase", marginBottom:4, marginTop:6 },
  addBtn:      { width:"100%", padding:"6px 8px", borderRadius:6, background:"#2d1f0a", border:"1.5px dashed #5a3a1a", color:"#a08040", fontSize:11, cursor:"pointer", fontFamily:"Georgia,serif" },
  selTitle:    { marginBottom:6, fontSize:12, fontWeight:"bold", color:"#e8c87a", fontFamily:"Georgia,serif" },
  delBtnBig:   { width:"100%", padding:6, borderRadius:6, background:"#3a1010", border:"1px solid #7a3030", color:"#f0a0a0", cursor:"pointer", marginBottom:8, fontSize:11, fontFamily:"Georgia,serif" },
  lbl:         { fontSize:10, color:"#a08040", display:"block", marginTop:5, marginBottom:2, fontFamily:"Georgia,serif" },
  inp:         { width:"100%", padding:"4px 7px", borderRadius:4, background:"#1a1208", border:"1px solid #5a3a1a", color:"#f0d890", fontSize:11, fontFamily:"Georgia,serif" },
  arrowBtnLg:  { background:"#2d1f0a", border:"1.5px solid #6a4820", color:"#e8c87a", fontSize:18, width:38, height:38, borderRadius:8, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", padding:0 },
  nextDayBtn:  { flex:1, padding:"8px 6px", borderRadius:8, background:"#3a2010", border:"1.5px solid #8a5020", color:"#e8c87a", fontSize:12, cursor:"pointer", fontFamily:"Georgia,serif", fontWeight:"bold" },
  editBtn:     { width:"100%", marginTop:6, padding:"5px 8px", borderRadius:5, background:"#1a1208", border:"1px solid #5a3a1a", color:"#a0c0a0", fontSize:10, cursor:"pointer", fontFamily:"Georgia,serif" },
}
