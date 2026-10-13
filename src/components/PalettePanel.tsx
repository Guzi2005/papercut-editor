import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowDown, ArrowUp, Download, Lock, Plus, Trash2, Unlock, Upload } from 'lucide-react';
import type { PapercutProject } from '../types/papercut';
import { layerColors } from '../utils/color';
import {
  type ColorScheme, type ImageRegion, type PaletteSwatch, PALETTE_ROLES, PALETTE_STORAGE_KEY, PALETTE_DRAFT_PREFIX,
  colorLightness, createColorScheme, exportGpl, mapSchemeRoles, nearestPaletteMapping, normalizeColor,
  paletteDraftSnapshot, parsePaletteDrafts, parsePaletteFile, quantizePalette, replaceExtractedColors, schemeColorMapping, validateColorSchemes,
} from '../utils/palettes';

export interface PalettePanelProps {
  project: PapercutProject;
  selectedLayerIds: string[];
  onPick: (hex: string) => void;
  onApply: (mapping: Record<string, string>, scope: 'selection' | 'document') => void;
  onProjectPalettes: (palettes: ColorScheme[]) => void;
}
const button = 'px-2 py-1 border border-(--ui-border) hover:bg-(--ui-hover) disabled:opacity-35 disabled:cursor-default text-[11px]';
const field = 'min-w-0 bg-(--ui-input) border border-(--ui-border) px-1.5 py-1 text-[11px]';
const smallButton = 'p-1 text-(--ui-muted) hover:text-(--ui-text) hover:bg-(--ui-hover) disabled:opacity-30';
const schemeList = (project: PapercutProject): ColorScheme[] => {
  try { return validateColorSchemes((project as PapercutProject & { colorSchemes?: ColorScheme[] }).colorSchemes ?? []); } catch { return []; }
};
const initialScheme = (project: PapercutProject): ColorScheme => schemeList(project)[0] ?? createColorScheme(['#F3E5C8', '#285B70', '#B44638', '#F2C15C', '#243C35', '#F9F2DF'], '作品色彩方案');
const listColors = (project: PapercutProject, ids: string[]): string[] => [...new Set(ids.flatMap(id => project.layers[id] ? layerColors(project.layers[id]) : []))].slice(0, 128);
function download(text: string, name: string, mime = 'application/json') {
  const url = URL.createObjectURL(new Blob([text], { type: mime }));
  const a = document.createElement('a'); a.href = url; a.download = name.replace(/[<>:"/\\|?*\x00-\x1F]/g, '_'); a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** A compact sidebar; palette editing, image extraction and recolouring are distinct tasks. */
export const PalettePanel: React.FC<PalettePanelProps> = ({ project, selectedLayerIds, onPick, onApply, onProjectPalettes }) => {
  const recovery = useMemo(() => {
    try { const raw = localStorage.getItem(PALETTE_DRAFT_PREFIX + project.id); return raw ? parsePaletteDrafts(raw) : null; } catch { return null; }
  }, [project.id]);
  const [page, setPage] = useState<'scheme' | 'extract' | 'apply'>('scheme');
  const [draft, setDraft] = useState<ColorScheme>(() => recovery?.drafts.find(s => s.id === recovery.activeId) ?? initialScheme(project));
  const [library, setLibrary] = useState<ColorScheme[]>([]);
  const [draftShelf, setDraftShelf] = useState<ColorScheme[]>(() => recovery?.drafts ?? []);
  const [message, setMessage] = useState('');
  const [selected, setSelected] = useState<string | null>(null);
  const [gray, setGray] = useState(false);
  const [showOriginal, setShowOriginal] = useState(false);
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [pixels, setPixels] = useState<ImageData | null>(null);
  const [imageName, setImageName] = useState('');
  const [crop, setCrop] = useState<ImageRegion | null>(null);
  const [imageMode, setImageMode] = useState<'crop' | 'pick' | 'exclude'>('crop');
  const [excluded, setExcluded] = useState<string[]>([]);
  const [colorCount, setColorCount] = useState(8);
  const [mergeDistance, setMergeDistance] = useState(5);
  const [scope, setScope] = useState<'selection' | 'document'>('selection');
  const [mapMode, setMapMode] = useState<'source' | 'nearest' | 'role'>('source');
  const [sourceScheme, setSourceScheme] = useState('');
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const preview = useRef<HTMLCanvasElement>(null), imageFile = useRef<HTMLInputElement>(null), paletteFile = useRef<HTMLInputElement>(null);
  const imageLoad = useRef(0), cropStart = useRef<{ x: number; y: number } | null>(null);
  const draftCache = useRef(new Map<string, ColorScheme>());
  const recoveryState = useRef(paletteDraftSnapshot(draft, draftShelf));
  const recoveryFailed = useRef(false);
  recoveryState.current = paletteDraftSnapshot(draft, draftShelf);
  const saved = schemeList(project);
  const knownSchemes = useMemo(() => [...saved, ...library.filter(s => !saved.some(p => p.id === s.id)), ...draftShelf.filter(s => !saved.some(p => p.id === s.id) && !library.some(p => p.id === s.id))], [project, library, draftShelf]);
  const documentColors = useMemo(() => listColors(project, Object.keys(project.layers)), [project.layers]);
  const scopeColors = useMemo(() => scope === 'document' ? documentColors : listColors(project, selectedLayerIds), [scope, documentColors, project.layers, selectedLayerIds]);
  const selectedSwatch = draft.swatches.find(s => s.id === selected);
  const dirty = JSON.stringify(saved.find(s => s.id === draft.id)) !== JSON.stringify(draft);

  useEffect(() => {
    try { const raw = localStorage.getItem(PALETTE_STORAGE_KEY); if (raw) setLibrary(validateColorSchemes(JSON.parse(raw))); }
    catch { setMessage('本机色卡库无法读取；作品内的方案仍然可用。'); }
  }, []);
  useEffect(() => {
    setDraft(recovery?.drafts.find(s => s.id === recovery.activeId) ?? initialScheme(project)); setSelected(null); setMessage('');
    setDraftShelf(recovery?.drafts ?? []); draftCache.current = new Map((recovery?.drafts ?? []).map(s => [s.id, s])); recoveryFailed.current = false;
  }, [project.id]);
  useEffect(() => {
    const saveRecovery = () => {
      try { localStorage.setItem(PALETTE_DRAFT_PREFIX + project.id, JSON.stringify(recoveryState.current)); }
      catch { if (!recoveryFailed.current) { recoveryFailed.current = true; setMessage('色卡草稿无法自动备份，请保存到作品或导出 JSON。'); } }
    };
    const timer = window.setTimeout(saveRecovery, 350);
    return () => window.clearTimeout(timer);
  }, [draft, draftShelf, project.id]);
  useEffect(() => {
    const key = PALETTE_DRAFT_PREFIX + project.id;
    return () => { try { localStorage.setItem(key, JSON.stringify(recoveryState.current)); } catch { /* explicit project save remains available */ } };
  }, [project.id]);
  useEffect(() => {
    const canvas = preview.current; if (!canvas || !image || !pixels) return;
    canvas.width = pixels.width; canvas.height = pixels.height;
    const context = canvas.getContext('2d'); if (!context) return;
    context.putImageData(pixels, 0, 0);
    if (crop) {
      context.fillStyle = 'rgba(0,0,0,.38)'; context.beginPath(); context.rect(0, 0, canvas.width, canvas.height); context.rect(crop.x, crop.y, crop.width, crop.height); context.fill('evenodd');
      context.strokeStyle = '#FFFFFF'; context.lineWidth = Math.max(2, canvas.width / 220); context.strokeRect(crop.x, crop.y, crop.width, crop.height);
    }
    if (selectedSwatch?.sample && draft.source === imageName) {
      const { x, y } = selectedSwatch.sample; context.strokeStyle = '#FFFFFF'; context.lineWidth = 3; context.beginPath(); context.arc(x, y, Math.max(5, canvas.width / 80), 0, Math.PI * 2); context.stroke(); context.strokeStyle = '#111111'; context.lineWidth = 1; context.stroke();
    }
  }, [image, pixels, crop, selectedSwatch, page, draft.source, imageName]);
  useEffect(() => {
    const next = mapMode === 'nearest' ? nearestPaletteMapping(scopeColors, draft)
      : mapMode === 'role' ? mapSchemeRoles(knownSchemes.find(s => s.id === sourceScheme) ?? draft, draft) : schemeColorMapping(draft);
    setMapping(next);
  }, [draft, mapMode, scopeColors, sourceScheme, knownSchemes]);

  const editSwatch = (id: string, update: Partial<PaletteSwatch>) => setDraft(d => ({ ...d, swatches: d.swatches.map(s => s.id === id ? { ...s, ...update } : s) }));
  const rememberDraft = () => {
    draftCache.current.set(draft.id, structuredClone(draft));
    setDraftShelf(schemes => [...schemes.filter(s => s.id !== draft.id), draft].slice(-12));
  };
  const chooseScheme = (scheme: ColorScheme) => {
    rememberDraft(); setDraft(structuredClone(draftCache.current.get(scheme.id) ?? scheme)); setSelected(null); setMessage('');
  };
  const store = (schemes: ColorScheme[]) => {
    setLibrary(schemes);
    try { localStorage.setItem(PALETTE_STORAGE_KEY, JSON.stringify(schemes)); return true; }
    catch { setMessage('本机存储已满或不可用；请保存到作品或导出 JSON 备份。'); return false; }
  };
  const saveProject = (variant = false) => {
    const next = variant ? { ...draft, id: createColorScheme([]).id, name: `${draft.name} · 变体` } : draft;
    if (!next.swatches.length) { setMessage('请先添加颜色。'); return; }
    const rest = saved.filter(s => s.id !== next.id);
    if (rest.length >= 100) { setMessage('作品最多保存 100 组色彩方案。'); return; }
    onProjectPalettes([...rest, next]); draftCache.current.delete(next.id); setDraft(next); setMessage(variant ? '已保存变体到作品。' : '已保存到作品，随作品文件携带。');
  };
  const saveLibrary = () => {
    const rest = library.filter(s => s.id !== draft.id);
    if (rest.length >= 100) { setMessage('本机最多保存 100 组方案。'); return; }
    if (store([...rest, draft])) { draftCache.current.delete(draft.id); setMessage('已收藏到本机色卡库。'); }
  };
  const move = (index: number, delta: number) => setDraft(d => {
    const swatches = d.swatches.slice(); [swatches[index], swatches[index + delta]] = [swatches[index + delta], swatches[index]]; return { ...d, swatches };
  });
  const loadImage = (src: string, name: string) => {
    const ticket = ++imageLoad.current, img = new Image();
    img.onload = () => {
      if (ticket !== imageLoad.current) return;
      if (img.naturalWidth * img.naturalHeight > 64_000_000) { setMessage('参考图片过大，请缩小到 6400 万像素以内。'); return; }
      try {
        const canvas = document.createElement('canvas'), scale = Math.min(1, 1024 / Math.max(img.naturalWidth, img.naturalHeight));
        canvas.width = Math.max(1, Math.round(img.naturalWidth * scale)); canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
        const context = canvas.getContext('2d', { willReadFrequently: true }); if (!context) throw new Error('无法读取图片');
        context.drawImage(img, 0, 0, canvas.width, canvas.height);
        setPixels(context.getImageData(0, 0, canvas.width, canvas.height)); setImage(img); setImageName(name); setCrop(null); setExcluded([]); setPage('extract'); setMessage('拖动框选取色区域；可以切换为补取或排除颜色。');
      } catch { setMessage('图片无法取色，请使用本地 PNG、JPEG 或 WebP。'); }
    };
    img.onerror = () => { if (ticket === imageLoad.current) setMessage('图片读取失败。'); }; img.src = src;
  };
  const importImage = async (file?: File) => {
    if (!file) return;
    if (!file.type.startsWith('image/') || file.size > 20_000_000) { setMessage('请选择 20 MB 以内的图片。'); return; }
    const reader = new FileReader(); reader.onload = () => loadImage(String(reader.result), file.name); reader.onerror = () => setMessage('图片读取失败。'); reader.readAsDataURL(file);
  };
  const importPalettes = async (file?: File) => {
    if (!file) return;
    try {
      if (file.size > 1_000_000) throw new Error('色卡文件不能超过 1 MB');
      const imported = parsePaletteFile(await file.text(), file.name);
      const next = [...saved]; imported.forEach(s => { const index = next.findIndex(p => p.id === s.id); if (index >= 0) next[index] = s; else next.push(s); });
      if (next.length > 100) throw new Error('导入后超过 100 组色彩方案');
      onProjectPalettes(next); if (imported[0]) setDraft(imported[0]); setPage('scheme'); setMessage(`已导入 ${imported.length} 组色彩方案到作品。`);
    } catch (error) { setMessage(error instanceof Error ? error.message : '色卡导入失败。'); }
  };
  const extract = () => {
    if (!pixels) return;
    const colors = quantizePalette(pixels.data, pixels.width, pixels.height, colorCount, crop ?? undefined, { excludedColors: excluded, mergeDistance });
    if (!colors.length) { setMessage('区域中没有可用颜色，请调整区域或排除色。'); return; }
    setDraft(d => ({ ...replaceExtractedColors(d, colors), source: imageName })); setSelected(null); setPage('scheme'); setMessage(`提取了 ${colors.length} 个颜色，锁定色已保留；请保存方案。`);
  };
  const imagePoint = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = event.currentTarget.getBoundingClientRect(); return { x: Math.max(0, Math.min(event.currentTarget.width - 1, (event.clientX - rect.left) / rect.width * event.currentTarget.width)), y: Math.max(0, Math.min(event.currentTarget.height - 1, (event.clientY - rect.top) / rect.height * event.currentTarget.height)) };
  };
  const pickImage = (point: { x: number; y: number }) => {
    if (!pixels) return;
    const x = Math.floor(point.x), y = Math.floor(point.y), i = (y * pixels.width + x) * 4;
    if (pixels.data[i + 3] < 32) { setMessage('透明位置没有可用颜色。'); return; }
    const color = '#' + [...pixels.data.slice(i, i + 3)].map(v => v.toString(16).padStart(2, '0')).join('').toUpperCase();
    if (imageMode === 'exclude') { setExcluded(d => d.includes(color) ? d : [...d, color].slice(-16)); setMessage('相近颜色将在自动提取时排除。'); return; }
    const existing = draft.swatches.find(s => s.sourceHex === color);
    if (existing) { setSelected(existing.id); onPick(existing.hex); setMessage('此原色已在方案中，已选中对应制作色。'); return; }
    if (draft.swatches.length >= 64) { setMessage('每组方案最多 64 个颜色。'); return; }
    const swatch = createColorScheme([color]).swatches[0]; swatch.sample = { x, y }; swatch.name = '补取颜色'; swatch.role = 'accent';
    setDraft(d => ({ ...d, swatches: [...d.swatches, swatch], source: imageName })); setSelected(swatch.id); onPick(color); setMessage('已补取颜色，可在方案中命名并调整。');
  };
  const mappingRows = Object.entries(mapping).filter(([source]) => scopeColors.includes(source));
  const replacements = Object.fromEntries(mappingRows.filter(([source, target]) => source !== target));

  return <div className="flex flex-col h-full min-h-0 text-(--ui-text) text-[11px]" data-palette-panel>
    <header className="sticky top-0 z-10 bg-(--ui-panel) flex border-b border-(--ui-border) shrink-0" role="tablist" aria-label="色彩面板功能">
      {([['scheme', '方案'], ['extract', '参考取色'], ['apply', '换色']] as const).map(([id, label]) => <button key={id} role="tab" aria-selected={page === id} onClick={() => setPage(id)} className={`flex-1 py-2 border-b-2 ${page === id ? 'border-(--ui-accent) text-(--ui-text)' : 'border-transparent text-(--ui-muted) hover:bg-(--ui-hover)'}`}>{label}</button>)}
    </header>
    <div className="p-3 overflow-y-auto min-h-0 space-y-3">
      <div className="flex gap-1.5">
        <select aria-label="已有色彩方案" className={`${field} flex-1`} value={knownSchemes.some(s => s.id === draft.id) ? draft.id : ''} onChange={e => { const scheme = knownSchemes.find(s => s.id === e.target.value); if (scheme) chooseScheme(scheme); }}>
          <option value="">当前未保存方案</option><optgroup label="作品内">{saved.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</optgroup>
          <optgroup label="本机收藏">{library.filter(s => !saved.some(p => p.id === s.id)).map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</optgroup>
          <optgroup label="未保存草稿">{draftShelf.filter(s => !saved.some(p => p.id === s.id) && !library.some(p => p.id === s.id)).map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</optgroup>
        </select>
        <button className={smallButton} title="新建色彩方案" aria-label="新建色彩方案" onClick={() => { rememberDraft(); setDraft(createColorScheme(['#FFFFFF'], '新色彩方案')); setSelected(null); setPage('scheme'); }}><Plus size={14} /></button>
      </div>
      <div className="flex gap-1.5"><input aria-label="色彩方案名称" maxLength={120} className={`${field} flex-1`} value={draft.name} onChange={e => setDraft(d => ({ ...d, name: e.target.value }))} /><button className={button} onClick={() => saveProject()} disabled={!dirty}>{dirty ? '保存到作品' : '已保存'}</button></div>
      {page === 'scheme' && <>
        <div className="flex flex-wrap gap-1.5"><button className={button} disabled={!documentColors.length} onClick={() => { rememberDraft(); setDraft(createColorScheme(documentColors, `${project.name} · 用色`)); setMessage('已收集作品使用的图形颜色。'); }}>收集作品用色</button><button className={button} onClick={() => saveProject(true)}>另存变体</button><button className={button} onClick={saveLibrary}>收藏</button></div>
        <div className="grid grid-cols-8 gap-1" aria-label="方案色卡">{draft.swatches.map(s => <button key={s.id} className={`aspect-square border ${selected === s.id ? 'border-(--ui-accent) outline-1 outline-(--ui-accent)' : 'border-black/20'}`} style={{ backgroundColor: showOriginal ? s.sourceHex : s.hex, filter: gray ? 'grayscale(1)' : undefined }} title={`${s.name} · ${s.hex}`} aria-label={`使用 ${s.name} ${s.hex}`} onClick={() => { setSelected(s.id); onPick(showOriginal ? s.sourceHex : s.hex); }} />)}</div>
        <div className="flex justify-between gap-2 text-(--ui-muted)"><label className="flex items-center gap-1"><input type="checkbox" checked={gray} onChange={e => setGray(e.target.checked)} />灰度预览</label><label className="flex items-center gap-1"><input type="checkbox" checked={showOriginal} onChange={e => setShowOriginal(e.target.checked)} />显示参考原色</label></div>
        <div className="flex justify-between items-center border-b border-(--ui-border) pb-1 text-(--ui-muted)"><span>参考原色 → 制作色</span><button className={smallButton} onClick={() => setDraft(d => ({ ...d, swatches: d.swatches.slice().sort((a, b) => colorLightness(b.hex) - colorLightness(a.hex)) }))}>按明度排序</button></div>
        <div>{draft.swatches.map((s, index) => <div key={s.id} className={`py-2 border-b border-(--ui-border) ${selected === s.id ? 'border-l-2 border-l-(--ui-accent) pl-1.5' : ''}`}>
          <div className="flex gap-1 items-center">
            <button className="w-6 h-6 border border-black/20 shrink-0" style={{ backgroundColor: s.sourceHex }} title={`参考原色 ${s.sourceHex} · 点击使用`} aria-label={`使用参考原色 ${s.sourceHex}`} onClick={() => { setSelected(s.id); onPick(s.sourceHex); }} /><span className="text-(--ui-muted)">→</span>
            <input type="color" aria-label={`${s.name} 制作色`} value={s.hex} className="w-7 h-6 p-0 border-0 bg-transparent shrink-0 cursor-pointer" onChange={e => editSwatch(s.id, { hex: e.target.value.toUpperCase() })} />
            <input aria-label={`${s.name} 颜色值`} className={`${field} w-[70px] font-mono`} defaultValue={s.hex} key={s.hex} maxLength={7} onBlur={e => { const value = normalizeColor(e.target.value); if (value) editSwatch(s.id, { hex: value }); else e.target.value = s.hex; }} onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur(); }} />
            <input aria-label={`颜色 ${index + 1} 名称`} className={`${field} flex-1`} value={s.name} maxLength={80} onChange={e => editSwatch(s.id, { name: e.target.value })} />
          </div>
          <div className="mt-1 flex gap-1 items-center">
            <select aria-label={`${s.name} 用途`} className={`${field} flex-1`} value={PALETTE_ROLES.some(r => r.id === s.role) ? s.role : 'other'} onChange={e => editSwatch(s.id, { role: e.target.value })}>{PALETTE_ROLES.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}</select>
            <span className="w-9 text-right text-(--ui-muted) font-mono">{s.weight ? `${Math.round(s.weight * 100)}%` : '—'}</span>
            <button className={smallButton} title={s.locked ? '解除锁定：重新提取时可替换' : '锁定：重新提取时保留'} aria-label={`${s.name} ${s.locked ? '解除锁定' : '锁定'}`} aria-pressed={s.locked} onClick={() => editSwatch(s.id, { locked: !s.locked })}>{s.locked ? <Lock size={12} /> : <Unlock size={12} />}</button>
            <button className={smallButton} aria-label={`${s.name} 上移`} disabled={index === 0} onClick={() => move(index, -1)}><ArrowUp size={12} /></button><button className={smallButton} aria-label={`${s.name} 下移`} disabled={index === draft.swatches.length - 1} onClick={() => move(index, 1)}><ArrowDown size={12} /></button>
            <button className={smallButton} aria-label={`删除 ${s.name}`} disabled={draft.swatches.length <= 1} onClick={() => setDraft(d => ({ ...d, swatches: d.swatches.filter(c => c.id !== s.id) }))}><Trash2 size={12} /></button>
          </div>
        </div>)}</div>
        <button className={`${button} flex gap-1 items-center`} disabled={draft.swatches.length >= 64} onClick={() => setDraft(d => ({ ...d, swatches: [...d.swatches, createColorScheme(['#FFFFFF']).swatches[0]] }))}><Plus size={12} />添加颜色</button>
        <label className="block text-(--ui-muted)">参考来源<input aria-label="色彩方案参考来源" placeholder="地区、年代、图片来源等" maxLength={400} className={`${field} block w-full mt-1`} value={draft.source ?? ''} onChange={e => setDraft(d => ({ ...d, source: e.target.value || undefined }))} /></label>
        <details className="border-t border-(--ui-border) pt-2"><summary className="cursor-pointer text-(--ui-muted)">导入、导出与管理</summary><div className="flex flex-wrap gap-1.5 mt-2">
          <button className={button} onClick={() => paletteFile.current?.click()}><Upload size={12} className="inline mr-1" />JSON / GPL</button><button className={button} onClick={() => download(JSON.stringify({ version: 1, schemes: [draft] }, null, 2), `${draft.name}.json`)}><Download size={12} className="inline mr-1" />JSON</button><button className={button} onClick={() => download(exportGpl(draft), `${draft.name}.gpl`, 'text/plain')}>GPL</button>
          <button className={button} disabled={!saved.some(s => s.id === draft.id)} onClick={() => { onProjectPalettes(saved.filter(s => s.id !== draft.id)); setMessage('已从作品移除，当前草稿仍可保存。'); }}>从作品移除</button>
          <button className={button} disabled={!library.some(s => s.id === draft.id)} onClick={() => { if (store(library.filter(s => s.id !== draft.id))) setMessage('已取消本机收藏。'); }}>取消收藏</button>
        </div></details>
      </>}
      {page === 'extract' && <>
        <div className="flex gap-1.5"><button className={button} onClick={() => imageFile.current?.click()}>导入参考图片</button><button className={button} disabled={!project.reference?.src} onClick={() => project.reference && loadImage(project.reference.src, '作品参考图')}>使用作品参考图</button></div>
        {Object.values(project.fabricAssets??{}).length>0&&<select aria-label="从布料素材取色" className={`${field} w-full`} defaultValue="" onChange={e=>{const asset=project.fabricAssets?.[e.target.value];if(asset)loadImage(asset.src,asset.name);}}><option value="">从布料素材取色…</option>{Object.values(project.fabricAssets??{}).map(a=><option key={a.id} value={a.id}>{a.name}</option>)}</select>}
        {pixels && <>
          <div className="flex gap-1" role="group" aria-label="参考图操作">{([['crop', '框选区域'], ['pick', '补取颜色'], ['exclude', '排除颜色']] as const).map(([id, text]) => <button key={id} className={`${button} flex-1 ${imageMode === id ? 'border-(--ui-accent)' : ''}`} aria-pressed={imageMode === id} onClick={() => setImageMode(id)}>{text}</button>)}</div>
          <canvas ref={preview} className="w-full block touch-none border border-(--ui-border)" aria-label="参考图取色区域" style={{ cursor: imageMode === 'crop' ? 'crosshair' : 'copy' }} onPointerDown={e => {
            if (e.button !== 0) return; const point = imagePoint(e); if (imageMode !== 'crop') { pickImage(point); return; }
            e.currentTarget.setPointerCapture(e.pointerId); cropStart.current = point; setCrop({ ...point, width: 0, height: 0 });
          }} onPointerMove={e => { if (!cropStart.current) return; const point = imagePoint(e), start = cropStart.current; setCrop({ x: Math.min(point.x, start.x), y: Math.min(point.y, start.y), width: Math.abs(point.x - start.x), height: Math.abs(point.y - start.y) }); }} onPointerUp={e => { if (!cropStart.current) return; cropStart.current = null; if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId); setCrop(c => c && (c.width < 2 || c.height < 2) ? null : c); }} onPointerCancel={() => { cropStart.current = null; setCrop(null); }} />
          <div className="flex justify-between text-(--ui-muted)"><span>{crop ? `局部 ${Math.round(crop.width)} × ${Math.round(crop.height)}` : '整张图片'} · {imageName}</span><button onClick={() => setCrop(null)} className="hover:text-(--ui-text)">重置区域</button></div>
          {excluded.length > 0 && <div className="flex flex-wrap gap-1 items-center"><span className="text-(--ui-muted)">排除</span>{excluded.map(c => <button key={c} title={`移除排除色 ${c}`} aria-label={`移除排除色 ${c}`} className="w-5 h-5 border border-(--ui-border)" style={{ background: c }} onClick={() => setExcluded(d => d.filter(v => v !== c))} />)}</div>}
          <label className="flex gap-2 items-center"><span className="w-16">颜色数量</span><input type="range" aria-label="提取颜色数量" min={4} max={16} value={colorCount} className="flex-1" onChange={e => setColorCount(Number(e.target.value))} /><span className="w-5 font-mono">{colorCount}</span></label>
          <label className="flex gap-2 items-center"><span className="w-16">相近色合并</span><input type="range" aria-label="相近色合并程度" min={0} max={20} value={mergeDistance} className="flex-1" onChange={e => setMergeDistance(Number(e.target.value))} /><span className="w-5 font-mono">{mergeDistance}</span></label>
          <button className={`${button} w-full border-(--ui-accent)`} onClick={extract}>从区域提取 · 保留锁定色</button><p className="text-(--ui-muted) leading-relaxed">提取的是照片颜色；在“方案”中整理制作色与用途。框选可以避开背景，排除色会同时排除相近色。</p>
        </>}
        {!pixels && <p className="text-(--ui-muted) leading-relaxed">从照片或插画框选服饰、布料或装饰区域，再提取颜色。小面积的绣线和强调色可以手动补取。</p>}
      </>}
      {page === 'apply' && <>
        <div className="flex gap-1.5"><label className="flex-1 flex items-center gap-1">范围<select aria-label="换色应用范围" value={scope} className={`${field} flex-1`} onChange={e => setScope(e.target.value as typeof scope)}><option value="selection">选中图层</option><option value="document">整个作品</option></select></label></div>
        <select aria-label="颜色映射方式" value={mapMode} className={`${field} w-full`} onChange={e => setMapMode(e.target.value as typeof mapMode)}><option value="source">参考原色 → 制作色</option><option value="nearest">作品颜色 → 最相近的方案色</option><option value="role">旧方案 → 相同用途的新方案色</option></select>
        {mapMode === 'role' && <label className="flex gap-2 items-center">旧方案<select aria-label="换色原方案" value={sourceScheme} className={`${field} flex-1`} onChange={e => setSourceScheme(e.target.value)}><option value="">当前方案</option>{knownSchemes.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label>}
        <div className="text-(--ui-muted)">确认映射后应用，整次换色可以撤销。</div>
        <div className="border-y border-(--ui-border)">{mappingRows.map(([source, target]) => <div className="flex items-center gap-2 py-1.5" key={source}><span className="w-5 h-5 border border-black/20" style={{ background: source }} /><span className="font-mono text-[10px] w-[58px]">{source}</span><span>→</span><span className="w-5 h-5 border border-black/20" style={{ background: target }} /><select aria-label={`${source} 替换为`} className={`${field} flex-1`} value={target} onChange={e => setMapping(m => ({ ...m, [source]: e.target.value }))}><option value={source}>保持原色</option>{draft.swatches.filter(s => s.hex !== source).map(s => <option value={s.hex} key={s.id}>{s.name} · {s.hex}</option>)}</select></div>)}
          {!mappingRows.length && <p className="py-3 text-(--ui-muted)">{scope === 'selection' && !selectedLayerIds.length ? '先选择需要换色的图层。' : '没有匹配的原色；可以选择按相近色映射。'}</p>}
        </div>
        <button className={`${button} w-full border-(--ui-accent)`} disabled={!Object.keys(replacements).length || (scope === 'selection' && !selectedLayerIds.length)} onClick={() => { onApply(replacements, scope); setMessage(`已应用 ${Object.keys(replacements).length} 项颜色映射。`); }}>应用到{scope === 'selection' ? '选中图层' : '整个作品'} · {Object.keys(replacements).length} 色</button>
      </>}
      {message && <p role="status" className="border-t border-(--ui-border) pt-2 text-(--ui-muted) leading-relaxed">{message}</p>}
    </div>
    <input ref={imageFile} type="file" accept="image/png,image/jpeg,image/webp,image/avif" className="hidden" onChange={e => { void importImage(e.target.files?.[0]); e.target.value = ''; }} /><input ref={paletteFile} type="file" accept=".json,.gpl" className="hidden" onChange={e => { void importPalettes(e.target.files?.[0]); e.target.value = ''; }} />
  </div>;
};
