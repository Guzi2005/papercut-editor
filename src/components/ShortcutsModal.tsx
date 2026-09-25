/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { X, Keyboard } from 'lucide-react';

const SECTIONS: { title: string; rows: [string, string][] }[] = [
  {
    title: '工具',
    rows: [
      ['V', '选择 / 移动 / 缩放 / 旋转'],
      ['L 或 1', '柳叶笔'],
      ['G 或 2', '几何形'],
      ['K 或 3', '笔刀'],
      ['B 或 4', '手绘'],
      ['A 或 5', '锚点微调'],
    ],
  },
  {
    title: '落刀模式',
    rows: [
      ['C', '刻纸 (镂空)'],
      ['P', '贴花 (加纸)'],
      ['E', '剪除 (橡皮)'],
    ],
  },
  {
    title: '选择工具',
    rows: [
      ['Tab', '切换 整物件 / 单部件 选取'],
      ['Shift + 点击', '加选 / 减选'],
      ['Shift + 拖动', '锁定水平或垂直移动；旋转时 15° 吸附'],
      ['方向键', '微移 1px (Shift 10px)'],
      ['Delete', '删除选中部件'],
      ['Esc', '取消选择'],
      ['Alt + 点击', '任意工具下拾取画布上的图层'],
    ],
  },
  {
    title: '文件与视图',
    rows: [
      ['Ctrl + S', '保存 .weave.json 项目文件'],
      ['Ctrl + O', '打开项目文件'],
      ['Alt + N', '新建画布'],
      ['Ctrl + Z / Ctrl + Shift + Z', '撤销 / 重做'],
      ['空格 + 拖动', '平移画布'],
      ['Ctrl + 滚轮', '以光标为中心缩放'],
      ['+ / - / 0', '放大 / 缩小 / 100%'],
      ['?', '显示本面板'],
    ],
  },
];

export const ShortcutsModal: React.FC<{ onClose: () => void }> = ({ onClose }) => (
  <div
    className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-6"
    onClick={onClose}
  >
    <div
      className="bg-[#161B29] border border-[#2B364D] rounded-2xl w-full max-w-2xl p-5 shadow-2xl text-[#CAD0DB]"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex items-center justify-between pb-3 border-b border-[#263147]">
        <div className="flex items-center gap-2 text-[#FBFBFC] font-bold text-sm">
          <Keyboard className="w-4 h-4 text-[#2652D0]" />
          快捷键
        </div>
        <button onClick={onClose} className="p-1 rounded-lg hover:bg-[#232D42] text-[#7E8FB8] hover:text-white">
          <X className="w-4 h-4" />
        </button>
      </div>
      <div className="grid grid-cols-2 gap-x-6 gap-y-4 pt-4 text-xs">
        {SECTIONS.map((sec) => (
          <div key={sec.title}>
            <div className="text-[11px] font-semibold text-[#EB8E88] mb-1.5">{sec.title}</div>
            <div className="space-y-1">
              {sec.rows.map(([k, v]) => (
                <div key={k} className="flex items-center justify-between gap-3">
                  <span className="text-[#BAC5EB]">{v}</span>
                  <kbd className="shrink-0 px-1.5 py-0.5 rounded-md bg-[#0F131D] border border-[#2B364D] font-mono text-[10px] text-[#FBFBFC]">
                    {k}
                  </kbd>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  </div>
);
