/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import { X, Gamepad2, Box, AlertTriangle, Download } from 'lucide-react';
import { PapercutProject } from '../types/papercut';
import {
  buildGodotExport,
  DEFAULT_GODOT_OPTIONS,
  GodotExportOptions,
  GodotExportResult,
  asciiSlug,
  loadPinyin,
} from '../utils/godotExport';
import { computeDepthTable, findItemOfLayer } from '../utils/projectOps';
import { downloadFile } from '../utils/svgExporter';

const OPTIONS_KEY = 'weave-godot-export-options';

function loadOptions(): GodotExportOptions {
  try {
    return { ...DEFAULT_GODOT_OPTIONS, ...JSON.parse(localStorage.getItem(OPTIONS_KEY) || '{}') };
  } catch {
    return DEFAULT_GODOT_OPTIONS;
  }
}

export const GodotExportModal: React.FC<{ project: PapercutProject; onClose: () => void }> = ({
  project,
  onClose,
}) => {
  const [opts, setOpts] = useState<GodotExportOptions>(loadOptions);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<[number, number]>([0, 0]);
  const [result, setResult] = useState<GodotExportResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [, setPinyinReady] = useState(false);

  useEffect(() => {
    loadPinyin().then(() => setPinyinReady(true));
  }, []);

  const items = project.items || [];
  const looseCount = Object.keys(project.layers).filter((id) => !findItemOfLayer(project, id)).length;
  const { slots } = computeDepthTable(project);
  const slug = asciiSlug(project.name, asciiSlug(project.id, 'papercut'));

  const update = (patch: Partial<GodotExportOptions>) => {
    const next = { ...opts, ...patch };
    setOpts(next);
    localStorage.setItem(OPTIONS_KEY, JSON.stringify(next));
  };

  const run = async () => {
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const res = await buildGodotExport(project, opts, (d, t) => setProgress([d, t]));
      setResult(res);
      downloadFile(res.zip as Uint8Array<ArrayBuffer>, `${slug}_godot.zip`, 'application/zip');
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const Toggle: React.FC<{ k: keyof GodotExportOptions; label: string; hint: string }> = ({ k, label, hint }) => (
    <label className="flex items-start gap-2 cursor-pointer">
      <input
        type="checkbox"
        checked={!!opts[k]}
        onChange={(e) => update({ [k]: e.target.checked } as Partial<GodotExportOptions>)}
        className="mt-0.5 accent-[#2652D0]"
      />
      <span>
        <span className="text-[#FBFBFC]">{label}</span>
        <span className="block text-[10px] text-[#7E8FB8]">{hint}</span>
      </span>
    </label>
  );

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-6" onClick={onClose}>
      <div
        className="bg-[#161B29] border border-[#2B364D] rounded-2xl w-full max-w-2xl shadow-2xl text-[#CAD0DB] text-xs overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="h-14 px-5 border-b border-[#2B364D] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-[#438B6E] text-white flex items-center justify-center">
              <Gamepad2 className="w-4 h-4" />
            </div>
            <div>
              <h2 className="font-bold text-sm text-[#FBFBFC]">导出到 Godot 4</h2>
              <p className="text-[10px] text-[#8E9FCA]">解压到项目根目录即可使用 · 每个物件一个 .tscn</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-xl hover:bg-[#1E2538] text-[#8E9FCA] hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 grid grid-cols-2 gap-5">
          <div className="space-y-3">
            <div>
              <label className="text-[10px] text-[#8E9FCA] block mb-1">导出位置 (Godot 资源路径)</label>
              <input
                value={opts.resRoot}
                onChange={(e) => update({ resRoot: e.target.value })}
                className="w-full bg-[#0F131D] border border-[#2B364D] rounded-lg px-2 py-1.5 text-white font-mono text-[11px] outline-none focus:border-[#2652D0]"
              />
              <div className="text-[10px] text-[#5E6E94] mt-1 font-mono truncate">
                → {opts.resRoot.replace(/\/+$/, '')}/{slug}/
              </div>
            </div>
            <div>
              <label className="text-[10px] text-[#8E9FCA] block mb-1">纹理倍率</label>
              <div className="flex gap-1">
                {([1, 2, 4] as const).map((s) => (
                  <button
                    key={s}
                    onClick={() => update({ textureScale: s })}
                    className={`flex-1 py-1 rounded-lg border ${
                      opts.textureScale === s ? 'bg-[#2652D0] border-[#2652D0] text-white' : 'bg-[#1C2335] border-[#2B364D] text-[#8E9FCA]'
                    }`}
                  >
                    @{s}x
                  </button>
                ))}
              </div>
              <div className="text-[10px] text-[#5E6E94] mt-1">Sprite2D 自动缩放回 1 单位 = 1 画布像素</div>
            </div>
            <Toggle k="bakeGrain" label="烘焙颗粒质感" hint="水粉颗粒写进 PNG" />
            <Toggle k="bakeShadow" label="烘焙纸影" hint="每个部件自带浅投影，纹理四周留 14px 边" />
            <Toggle k="includeLooseLayers" label="导出未归入物件的纸片" hint={`合并为「场景杂项」物件 (${looseCount} 张)`} />
            <Toggle k="includeHidden" label="包含隐藏的纸片" hint="默认只导出可见内容" />
          </div>

          <div className="space-y-3">
            <div className="rounded-xl bg-[#1A2031] border border-[#2B364D] p-3">
              <div className="text-[11px] font-semibold text-[#FBFBFC] mb-2">将生成</div>
              <div className="space-y-1 max-h-40 overflow-y-auto">
                {items.map((it) => (
                  <div key={it.id} className="flex items-center gap-1.5">
                    <Box className="w-3 h-3 text-[#EB8E88]" />
                    <span className="flex-1 truncate">{it.name}</span>
                    <span className="text-[10px] text-[#7E8FB8]">
                      {it.partIds.length} 部件 · {it.sockets.length} 挂点
                    </span>
                  </div>
                ))}
                {items.length === 0 && <div className="text-[10px] text-[#7E8FB8]">还没有物件：可在右侧「物件」页打组</div>}
              </div>
            </div>
            <div className="rounded-xl bg-[#1A2031] border border-[#2B364D] p-3">
              <div className="text-[11px] font-semibold text-[#FBFBFC] mb-2">深度层 → z_index</div>
              <div className="space-y-0.5 max-h-32 overflow-y-auto font-mono text-[10px]">
                {slots
                  .slice()
                  .reverse()
                  .map((sl) => (
                    <div key={sl.id} className="flex justify-between">
                      <span className="truncate font-sans">{sl.name}</span>
                      <span className="text-[#8E9FCA]">{sl.zBase}</span>
                    </div>
                  ))}
              </div>
            </div>
          </div>
        </div>

        {(error || result) && (
          <div className="px-5 pb-3">
            {error && (
              <div className="rounded-lg bg-red-950/50 border border-red-900 text-red-300 px-3 py-2 flex items-center gap-2">
                <AlertTriangle className="w-3.5 h-3.5" />
                {error}
              </div>
            )}
            {result && (
              <div className="rounded-lg bg-[#16302A] border border-[#438B6E]/60 text-[#BFE3D3] px-3 py-2">
                已导出 {result.itemCount} 个物件、{result.partCount} 个部件到 <span className="font-mono">{result.folder}</span>
                {result.warnings.length > 0 && (
                  <ul className="mt-1 text-[10px] text-[#E8C58A] list-disc pl-4">
                    {result.warnings.map((w) => (
                      <li key={w}>{w}</li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>
        )}

        <div className="px-5 py-3 border-t border-[#2B364D] flex items-center justify-between">
          <span className="text-[10px] text-[#5E6E94]">给物件加脚本请用「新建继承场景」，重新导出不会覆盖你的改动</span>
          <button
            onClick={run}
            disabled={busy}
            className="flex items-center gap-2 px-5 py-2 rounded-xl bg-[#438B6E] hover:bg-[#3A7A60] disabled:opacity-60 text-white font-semibold"
          >
            <Download className="w-4 h-4" />
            {busy ? `渲染中 ${progress[0]}/${progress[1]}` : '导出 .zip'}
          </button>
        </div>
      </div>
    </div>
  );
};
