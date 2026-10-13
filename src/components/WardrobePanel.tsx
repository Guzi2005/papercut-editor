import { useEffect, useState } from 'react';
import { Check, Eye, EyeOff, Plus, Save, Trash2, X } from 'lucide-react';
import type { PapercutProject } from '../types/papercut';
import { InlineName } from './InlineName';
import { applyOutfit, assignWardrobeCategory, captureOutfit, setWardrobeItemVisible, wardrobeItemVisible, WARDROBE_CATEGORIES, type WardrobeCategory } from '../utils/wardrobe';

interface Props {
  project: PapercutProject;
  onUpdate: (project: PapercutProject) => void;
  onCreateTemplate: () => void;
}

const field = 'min-w-0 border-0 border-b border-(--ui-border) bg-transparent px-1 py-1 outline-none focus:border-(--ui-accent)';
const iconButton = 'p-1.5 text-(--ui-muted) hover:text-(--ui-strong) hover:bg-(--ui-hover) disabled:opacity-35';

export function WardrobePanel({ project, onUpdate, onCreateTemplate }: Props) {
  const [selectedOutfitId, setSelectedOutfitId] = useState('');
  const [classifyItemId, setClassifyItemId] = useState('');
  const [classifyCategory, setClassifyCategory] = useState<WardrobeCategory>('clothes');
  const [message, setMessage] = useState('');
  const [error, setError] = useState(false);
  const items = project.items ?? [];
  const outfits = project.outfits ?? [];
  const selectedOutfit = outfits.find(outfit => outfit.id === selectedOutfitId);
  const classifyItem = items.find(item => item.id === classifyItemId);
  const classified = items.filter(item => item.wardrobeCategory);

  useEffect(() => {
    setSelectedOutfitId(''); setClassifyItemId(''); setMessage(''); setError(false);
  }, [project.id]);

  function update(action: () => PapercutProject, success = '') {
    try {
      const next = action();
      if (next !== project) onUpdate(next);
      setError(false); setMessage(success);
    } catch (cause) {
      setError(true); setMessage(cause instanceof Error ? cause.message : '套装操作失败。');
    }
  }

  function saveOutfit() {
    if (outfits.length >= 100) { setError(true); setMessage('一个项目最多保存 100 套搭配，请先删除不再使用的套装。'); return; }
    update(() => {
      const outfit = captureOutfit(project, `套装 ${outfits.length + 1}`);
      setSelectedOutfitId(outfit.id);
      return { ...project, outfits: [...outfits, outfit] };
    }, '已保存当前搭配，双击名称可重命名。');
  }

  return <section aria-label="套装" className="space-y-3 text-[11px]">
    <header className="flex items-center justify-between">
      <h3 className="font-medium text-(--ui-strong)">套装部件</h3>
      <button type="button" aria-label="新建套装模板" data-tip="新建锁定素体和三类部件的画布" onClick={onCreateTemplate} className="flex items-center gap-1 px-1.5 py-1 text-(--ui-muted) hover:bg-(--ui-hover) hover:text-(--ui-strong)"><Plus size={13}/>新建模板</button>
    </header>
    <div className="space-y-2">
      {WARDROBE_CATEGORIES.map(category => {
        const categoryItems = items.filter(item => item.wardrobeCategory === category.id);
        return <section key={category.id} aria-label={category.name}>
          <h4 className="flex items-center gap-2 px-1 py-1 text-[10px] text-(--ui-muted)">{category.name}<span className="tabular-nums">{categoryItems.length}</span></h4>
          {categoryItems.length ? categoryItems.map(item => {
            const visible = wardrobeItemVisible(project, item);
            return <div key={item.id} className="flex items-center gap-1 hover:bg-(--ui-hover)">
              <button type="button" aria-label={`显示${category.name}：${item.name}`} aria-pressed={visible} data-tip={visible ? '隐藏部件' : '显示部件'} className={`${iconButton} ${visible ? '' : 'opacity-50'}`}
                onClick={() => update(() => setWardrobeItemVisible(project, item.id, !visible))}>{visible ? <Eye size={13}/> : <EyeOff size={13}/>}</button>
              <InlineName label={`${category.name}部件名称：${item.name}`} className="min-w-0 flex-1" value={item.name} maxLength={80} onCommit={name => update(() => ({ ...project, items: items.map(candidate => candidate.id === item.id ? { ...candidate, name } : candidate) }))}/>
              <button type="button" aria-label={`取消归类：${item.name}`} data-tip="取消归类，保留画布部件" onClick={() => update(() => assignWardrobeCategory(project, item.id, undefined))} className={iconButton}><X size={11}/></button>
            </div>;
          }) : <p className="px-1 py-1 text-[10px] text-(--ui-muted)">尚无部件</p>}
        </section>;
      })}
    </div>
    <details>
      <summary className="cursor-pointer text-(--ui-muted)">归类已有物件</summary>
      <div className="mt-2 flex items-center gap-1">
        <select aria-label="归类物件" value={classifyItem?.id ?? ''} onChange={event => setClassifyItemId(event.target.value)} className={`${field} flex-1`}>
          <option value="">选择画布物件</option>{items.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
        </select>
        <select aria-label="服装类别" value={classifyCategory} onChange={event => setClassifyCategory(event.target.value as WardrobeCategory)} className={`${field} w-16 shrink-0`}>
          {WARDROBE_CATEGORIES.map(category => <option key={category.id} value={category.id}>{category.name}</option>)}
        </select>
        <button type="button" aria-label="归入服装类别" data-tip="归入所选类别" disabled={!classifyItem} onClick={() => update(() => assignWardrobeCategory(project, classifyItem!.id, classifyCategory), '已归类。')} className={iconButton}><Check size={13}/></button>
      </div>
      {!items.length && <p className="pt-2 text-[10px] leading-relaxed text-(--ui-muted)">先在图层中将服装部件组成物件，再选择类别。</p>}
    </details>
    <div className="border-t border-(--ui-divider) pt-2">
      <header className="flex items-center justify-between">
        <h4 className="font-medium text-(--ui-strong)">套装搭配 <span className="ml-1 text-[10px] font-normal tabular-nums text-(--ui-muted)">{outfits.length}</span></h4>
        <button type="button" aria-label="保存当前套装搭配" data-tip="将当前可见部件保存为一套搭配" disabled={!classified.length || outfits.length >= 100} onClick={saveOutfit} className="flex items-center gap-1 px-1.5 py-1 text-(--ui-muted) hover:text-(--ui-strong) hover:bg-(--ui-hover) disabled:opacity-35"><Save size={13}/>保存当前</button>
      </header>
      <div aria-label="已保存套装" className="mt-1 max-h-64 overflow-y-auto">
        {outfits.map(outfit => <div key={outfit.id} onClick={() => setSelectedOutfitId(outfit.id)} className={`flex items-center gap-1 border-l-2 pl-1 ${selectedOutfitId === outfit.id ? 'border-(--ui-accent) bg-(--ui-hover)' : 'border-transparent hover:bg-(--ui-hover)'}`}>
          <InlineName label={`套装搭配名称：${outfit.name}`} className="min-w-0 flex-1" value={outfit.name} maxLength={80} onCommit={name => update(() => ({ ...project, outfits: outfits.map(candidate => candidate.id === outfit.id ? { ...candidate, name } : candidate) }))}/>
          <button type="button" aria-label={`应用套装：${outfit.name}`} data-tip="应用搭配" onClick={event => { event.stopPropagation(); setSelectedOutfitId(outfit.id); update(() => applyOutfit(project, outfit), `已应用“${outfit.name}”。`); }} className={iconButton}><Check size={13}/></button>
          <button type="button" aria-label={`删除套装搭配：${outfit.name}`} data-tip="删除搭配，保留画布部件" onClick={event => { event.stopPropagation(); update(() => ({ ...project, outfits: outfits.filter(candidate => candidate.id !== outfit.id) }), '已删除搭配，画布部件仍保留。'); if (selectedOutfitId === outfit.id) setSelectedOutfitId(''); }} className={iconButton}><Trash2 size={12}/></button>
        </div>)}
        {!outfits.length && <p className="px-1 py-2 text-[10px] text-(--ui-muted)">保存当前搭配，以后可一键试穿。</p>}
      </div>
      {selectedOutfit && <p className="pt-1 px-1 text-[10px] tabular-nums text-(--ui-muted)">衣服 {selectedOutfit.clothes.length} · 鞋子 {selectedOutfit.shoes.length} · 头饰 {selectedOutfit.headwear.length}</p>}
    </div>
    <details className="text-(--ui-muted)"><summary className="cursor-pointer">制作提示</summary><p className="pt-1 leading-relaxed">在主画布制作部件，按衣服、鞋子、头饰三类组合试穿。模板素体保持锁定，双击名称可编辑。</p></details>
    {message && <p role={error ? 'alert' : 'status'} className={`text-[11px] leading-relaxed ${error ? 'text-red-400' : 'text-(--ui-muted)'}`}>{message}</p>}
  </section>;
}
