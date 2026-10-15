import { PenTool, Spline, Waypoints } from 'lucide-react';
import type { ToolType } from '../types/papercut';

export const isVectorTool = (tool: ToolType) => tool === 'vector_pen' || tool === 'vector_edit' || tool === 'anchor_edit';

export function VectorModes({ tool, onSelect }: { tool: ToolType; onSelect: (tool: ToolType) => void }) {
  return <div role="group" aria-label="矢量绘图模式" className="flex items-center gap-1 shrink-0">
    {([
      ['vector_pen', '钢笔', '点击落点，按住拖动拉曲线；点击起点闭合，Enter 完成开放路径', PenTool],
      ['vector_edit', '节点', '编辑纸片、贴花、切口和笔迹的贝塞尔节点', Waypoints],
      ['anchor_edit', '极简模式', '沿用锚点微调，直接拖动切口顶点（A）', Spline],
    ] as const).map(([id, label, hint, Icon]) => <button key={id} aria-pressed={tool === id} title={hint} onClick={() => onSelect(id)}
      className={`h-7 px-2 border-b-2 flex items-center gap-1.5 text-xs ${tool === id ? 'border-(--ui-accent) text-(--ui-accent)' : 'border-transparent hover:bg-(--ui-hover) text-(--ui-text-2)'}`}>
      <Icon size={14}/>{label}
    </button>)}
  </div>;
}
