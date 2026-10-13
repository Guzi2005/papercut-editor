import { useState } from 'react';
import { Plus, Trash2, X } from 'lucide-react';
import type { PapercutProject } from '../types/papercut';
import { applyOutfit, assignWardrobeCategory, captureOutfit, setWardrobeItemVisible, wardrobeItemVisible, WARDROBE_CATEGORIES, type WardrobeCategory } from '../utils/wardrobe';

interface Props {
  project: PapercutProject;
  onUpdate: (project: PapercutProject) => void;
  onCreateTemplate: () => void;
}

const field = 'w-full min-w-0 border border-(--ui-border) bg-(--ui-input) px-2 py-1.5 outline-none focus:border-(--ui-accent)';

export function WardrobePanel({ project, onUpdate, onCreateTemplate }: Props) {
  const [name, setName] = useState('');
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
    const outfit = captureOutfit(project, name);
    onUpdate({ ...project, outfits: [...outfits, outfit] });
    setSelectedOutfitId(outfit.id); setName(''); setError(false); setMessage(`已保存“${outfit.name}”。`);
  }

  return <section aria-label="套装" className="space-y-4 text-xs">
    <header className="flex items-center justify-between border-b border-(--ui-divider) pb-2">
      <h3 className="font-semibold text-(--ui-strong)">套装</h3>
      <button type="button" onClick={onCreateTemplate} className="flex items-center gap-1 px-1.5 py-1 hover:bg-(--ui-hover)"><Plus size={12}/>新建模板</button>
    </header>
    <p className="text-[11px] leading-relaxed text-(--ui-muted)">在主画布制作部件，按三类组合试穿。模板素体保持锁定。</p>
    <div className="space-y-3">
      {WARDROBE_CATEGORIES.map(category => {
        const categoryItems = items.filter(item => item.wardrobeCategory === category.id);
        return <fieldset key={category.id} className="border-b border-(--ui-divider) pb-2">
          <legend className="mb-1 font-medium text-(--ui-strong)">{category.name}<span className="ml-2 text-[10px] font-normal tabular-nums text-(--ui-muted)">{categoryItems.length}</span></legend>
          {categoryItems.length ? categoryItems.map(item => <div key={item.id} className="flex items-center gap-2 py-1 hover:bg-(--ui-hover)">
            <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-2 pl-1">
              <input type="checkbox" aria-label={`显示${category.name}：${item.name}`} checked={wardrobeItemVisible(project, item)}
                onChange={event => update(() => setWardrobeItemVisible(project, item.id, event.target.checked))} className="accent-(--ui-accent)"/>
              <span className="truncate" title={item.name}>{item.name}</span>
            </label>
            <button type="button" aria-label={`取消归类：${item.name}`} title="取消归类，保留画布部件" onClick={() => update(() => assignWardrobeCategory(project, item.id, undefined))} className="p-1 text-(--ui-muted) hover:text-(--ui-strong)"><X size={11}/></button>
          </div>) : <p className="py-1 text-[10px] text-(--ui-muted)">尚未归类部件</p>}
        </fieldset>;
      })}
    </div>
    <details>
      <summary className="cursor-pointer text-(--ui-muted)">物件归类</summary>
      <div className="mt-2 space-y-2">
        <select aria-label="归类物件" value={classifyItem?.id ?? ''} onChange={event => setClassifyItemId(event.target.value)} className={field}>
          <option value="">选择画布物件</option>{items.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
        </select>
        <div className="flex items-center gap-2">
          <select aria-label="服装类别" value={classifyCategory} onChange={event => setClassifyCategory(event.target.value as WardrobeCategory)} className={field}>
            {WARDROBE_CATEGORIES.map(category => <option key={category.id} value={category.id}>{category.name}</option>)}
          </select>
          <button type="button" disabled={!classifyItem} onClick={() => update(() => assignWardrobeCategory(project, classifyItem!.id, classifyCategory), '已归类。')} className="shrink-0 border border-(--ui-border) px-3 py-1.5 hover:bg-(--ui-hover) disabled:opacity-40">归入</button>
        </div>
        {!items.length && <p className="text-[10px] leading-relaxed text-(--ui-muted)">先在图层中将服装部件组成物件，再选择类别。</p>}
      </div>
    </details>
    <div className="space-y-2 border-t border-(--ui-divider) pt-3">
      <h4 className="font-medium text-(--ui-strong)">套装搭配</h4>
      <div className="flex items-center gap-2">
        <input aria-label="套装名称" placeholder="新套装" maxLength={80} value={name} onChange={event => setName(event.target.value)} className={field}/>
        <button type="button" disabled={!classified.length || outfits.length >= 100} onClick={saveOutfit} className="shrink-0 border border-(--ui-border) px-3 py-1.5 hover:bg-(--ui-hover) disabled:opacity-40">保存</button>
      </div>
      <select aria-label="已保存套装" value={selectedOutfit?.id ?? ''} onChange={event => setSelectedOutfitId(event.target.value)} className={field}>
        <option value="">选择已保存套装</option>{outfits.map(outfit => <option key={outfit.id} value={outfit.id}>{outfit.name}</option>)}
      </select>
      <div className="flex items-center justify-between">
        <span className="text-[10px] tabular-nums text-(--ui-muted)">{selectedOutfit ? `衣服 ${selectedOutfit.clothes.length} · 鞋子 ${selectedOutfit.shoes.length} · 头饰 ${selectedOutfit.headwear.length}` : `${outfits.length} 套搭配`}</span>
        <div className="flex items-center gap-1">
          <button type="button" disabled={!selectedOutfit} onClick={() => update(() => applyOutfit(project, selectedOutfit!), `已应用“${selectedOutfit?.name}”。`)} className="px-2 py-1 hover:bg-(--ui-hover) disabled:opacity-40">应用</button>
          <button type="button" aria-label="删除套装搭配" disabled={!selectedOutfit} onClick={() => update(() => ({ ...project, outfits: outfits.filter(outfit => outfit.id !== selectedOutfitId) }), '已删除搭配，画布部件仍保留。')} className="p-1.5 text-(--ui-muted) hover:bg-(--ui-hover) disabled:opacity-40"><Trash2 size={12}/></button>
        </div>
      </div>
    </div>
    {message && <p role={error ? 'alert' : 'status'} className={`text-[11px] leading-relaxed ${error ? 'text-red-400' : 'text-(--ui-muted)'}`}>{message}</p>}
  </section>;
}
