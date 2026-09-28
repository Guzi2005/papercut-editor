import { Spline, Waypoints } from 'lucide-react';
import type { ToolType } from '../types/papercut';

export const isVectorTool = (tool: ToolType) => tool === 'vector_edit' || tool === 'anchor_edit';

export function VectorModes({ tool, onSelect }: { tool: ToolType; onSelect: (tool: ToolType) => void }) {
  return <div role="group" aria-label="矢量绘图模式" className="flex items-center gap-1 shrink-0">
    {([
      ['anchor_edit', '极简模式', '沿用锚点微调，直接拖动切口顶点（A）', Spline],
      ['vector_edit', '精细模式', '编辑纸片、贴花、切口和笔迹的贝塞尔节点', Waypoints],
    ] as const).map(([id, label, hint, Icon]) => <button key={id} aria-pressed={tool === id} title={hint} onClick={() => onSelect(id)}
      className={`h-7 px-2 rounded-md flex items-center gap-1.5 text-xs ${tool === id ? 'bg-(--ui-accent) text-white' : 'hover:bg-(--ui-hover) text-(--ui-text-2)'}`}>
      <Icon size={14}/>{label}
    </button>)}
  </div>;
}
