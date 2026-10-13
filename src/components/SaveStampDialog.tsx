import { useEffect, useMemo, useRef, useState } from 'react';
import { X } from 'lucide-react';
import type { PapercutProject } from '../types/papercut';
import type { BlockSelection } from '../utils/projectOps';
import { captureSelectedStamp, stampCaptureOmissions } from '../utils/materialCapture';
import { loadStampLibrary, saveStampLibrary, validateStampLibrary, type StampDefinition } from '../utils/stamps';
import {definitionForMode,ribbonTileSettings,type MotifMode} from '../utils/materialLibrary';
import {StampStrokePreview} from './StampPainter';

interface Props {
  project: PapercutProject;
  layerIds: string[];
  blockSelection?: BlockSelection;
  onSave: (definition: StampDefinition) => void;
  onClose: () => void;
  mode?:MotifMode;
}

export function SaveStampDialog({ project, layerIds, blockSelection, onSave, onClose,mode='stamp' }: Props) {
  const kind=mode==='ribbon'?'织带':'图章';
  const selectionKey = JSON.stringify(layerIds);
  const blockKey = blockSelection === undefined ? null : JSON.stringify(blockSelection);
  const initialName = layerIds.length === 1 ? project.layers[layerIds[0]]?.name || `新${kind}` : `新${kind}`;
  const [name, setName] = useState(initialName);
  const [error, setError] = useState('');
  const [acceptFlat, setAcceptFlat] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const capture = useMemo(() => {
    const ids = JSON.parse(selectionKey) as string[];
    const blocks = blockKey === null ? undefined : JSON.parse(blockKey) as BlockSelection;
    try { return { definition: captureSelectedStamp(project, ids, '', blocks), omissions: stampCaptureOmissions(project, ids, blocks), error: '' }; }
    catch (cause) { return { definition: null, omissions: [], error: cause instanceof Error ? cause.message : '图章创建失败。' }; }
  }, [project, selectionKey, blockKey]);

  useEffect(() => {
    const element = dialog.current;
    element?.showModal();
    return () => element?.close();
  }, []);

  function save() {
    if (!capture.definition || !name.trim() || (capture.omissions.length > 0 && !acceptFlat)) return;
    try {
      const definition = definitionForMode({ ...capture.definition, name: name.trim().slice(0, 80) },mode);
      const library = validateStampLibrary([...loadStampLibrary(), definition]);
      saveStampLibrary(library);
      onSave(library[library.length - 1]);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '保存失败，请检查浏览器存储空间。');
    }
  }

  return <dialog ref={dialog} aria-labelledby="save-stamp-title" onCancel={onClose}
    onClick={event => { if (event.target === event.currentTarget) onClose(); }}
    className="m-auto w-[min(420px,calc(100vw-32px))] max-h-[calc(100dvh-32px)] overflow-y-auto rounded-sm border border-(--ui-border-strong) bg-(--ui-panel) p-0 text-(--ui-text) shadow-2xl backdrop:bg-black/40">
    <form className="text-xs" onSubmit={event => { event.preventDefault(); save(); }}>
      <header className="flex items-center justify-between border-b border-(--ui-divider) px-4 py-3">
        <h2 id="save-stamp-title" className="text-sm font-semibold text-(--ui-strong)">收为{kind}</h2>
        <button type="button" aria-label="关闭收为图章" onClick={onClose} className="p-1 hover:bg-(--ui-hover)"><X size={16}/></button>
      </header>
      <div className="grid grid-cols-[120px_1fr] items-center gap-4 p-4">
        <svg aria-label={`${kind}预览`} viewBox={mode==='ribbon'?'0 0 140 60':'0 0 100 100'} className="block h-[120px] w-[120px]">
          {mode==='ribbon'&&capture.definition?<StampStrokePreview definition={capture.definition} settings={ribbonTileSettings(capture.definition)} points={[{x:-20,y:30},{x:160,y:30}]}/>:capture.definition?.parts.map(part => <path key={part.id} d={part.d} fill={part.color}/>)}
        </svg>
        <div className="min-w-0 space-y-3">
          <label className="block space-y-2"><span className="block text-(--ui-muted)">名称</span>
            <input autoFocus required maxLength={80} aria-label={`${kind}名称`} value={name} onChange={event => { setName(event.target.value); setError(''); }}
              className="w-full min-w-0 border border-(--ui-border) bg-(--ui-input) px-2 py-1.5 outline-none focus:border-(--ui-accent)"/>
          </label>
          <p className="text-[11px] leading-relaxed text-(--ui-muted)">保持原色与比例，原点位于图案中心。保存到素材库后可盖印或制作织带。</p>
          {capture.definition && <p className="text-[10px] tabular-nums text-(--ui-muted)">{blockSelection === undefined ? '选中图层' : '选中色块'} · {capture.definition.parts.length} 个可见色块</p>}
        </div>
      </div>
      <div className="space-y-2 px-4 pb-4">
        {capture.omissions.length > 0 && <div className="space-y-2 border-t border-(--ui-divider) pt-3">
          <p className="leading-relaxed text-(--ui-muted)">以下外观无法保留为矢量图章：{capture.omissions.join('、')}。原稿保持不变。</p>
          <label className="flex cursor-pointer items-center gap-2"><input type="checkbox" checked={acceptFlat} onChange={event => setAcceptFlat(event.target.checked)} className="accent-(--ui-accent)"/>按平面色块保存</label>
        </div>}
        <p className="text-[10px] text-(--ui-muted)">图章保存可编辑的矢量色块，不含纸纹与投影。</p>
        {(capture.error || error) && <p role="alert" className="leading-relaxed text-red-400">{capture.error || error}</p>}
      </div>
      <footer className="flex justify-end gap-2 border-t border-(--ui-divider) px-4 py-3">
        <button type="button" onClick={onClose} className="px-3 py-1.5 hover:bg-(--ui-hover)">取消</button>
        <button type="submit" disabled={!capture.definition || !name.trim() || (capture.omissions.length > 0 && !acceptFlat)}
          className="bg-(--ui-accent) px-4 py-1.5 text-white disabled:opacity-40">保存{kind}</button>
      </footer>
    </form>
  </dialog>;
}
