/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { PapercutProject } from '../types/papercut';
import { generateSvgMarkup, downloadFile, exportToPng } from '../utils/svgExporter';
import {
  X,
  Download,
  Copy,
  Check,
  FileCode,
  Image as ImageIcon,
  Sparkles,
} from 'lucide-react';

interface ExportModalProps {
  project: PapercutProject;
  onClose: () => void;
}

export const ExportModal: React.FC<ExportModalProps> = ({ project, onClose }) => {
  const [activeTab, setActiveTab] = useState<'preview' | 'code'>('preview');
  const [includeBackground, setIncludeBackground] = useState(false);
  const [pngScale, setPngScale] = useState(2);
  const [isExportingPng, setIsExportingPng] = useState(false);
  const [copied, setCopied] = useState(false);

  const svgMarkup = generateSvgMarkup(project, {
    includeBackground,
    includePaperTexture: false,
  });

  const handleDownloadSvg = () => {
    const filename = `${project.name || 'cyber_papercut'}.svg`;
    downloadFile(svgMarkup, filename, 'image/svg+xml;charset=utf-8');
  };

  const handleCopyCode = async () => {
    try {
      await navigator.clipboard.writeText(svgMarkup);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy', err);
    }
  };

  const handleDownloadPng = async () => {
    setIsExportingPng(true);
    try {
      const dataUrl = await exportToPng(project, pngScale, includeBackground);
      const a = document.createElement('a');
      a.href = dataUrl;
      a.download = `${project.name || 'cyber_papercut'}@${pngScale}x.png`;
      a.click();
    } catch (e) {
      console.error(e);
    } finally {
      setIsExportingPng(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-6 animate-in fade-in duration-150">
      <div className="bg-(--ui-panel) border border-(--ui-border) rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl text-(--ui-text) overflow-hidden">
        {/* Modal Header */}
        <div className="h-14 px-6 border-b border-(--ui-border) flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-(--ui-accent) text-white flex items-center justify-center font-bold text-xs shadow-md shadow-blue-950/60 border border-(--ui-text-2)/40">
              SVG
            </div>
            <div>
              <h2 className="font-bold text-base text-(--ui-strong)">
                导出民俗剪纸矢量图
              </h2>
              <p className="text-xs text-(--ui-muted)">
                标准 SVG 矢量格式，兼容 Illustrator, Inkscape, Figma 与激光刻纸机
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Tabs */}
            <div className="flex items-center bg-(--ui-raised) rounded-xl p-0.5 border border-(--ui-border) text-xs">
              <button
                onClick={() => setActiveTab('preview')}
                className={`px-3 py-1 rounded-lg transition-colors ${
                  activeTab === 'preview'
                    ? 'bg-(--ui-accent) text-white font-medium shadow-sm'
                    : 'text-(--ui-muted) hover:text-(--ui-strong)'
                }`}
              >
                矢量预览
              </button>
              <button
                onClick={() => setActiveTab('code')}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-lg transition-colors ${
                  activeTab === 'code'
                    ? 'bg-(--ui-accent) text-white font-medium shadow-sm'
                    : 'text-(--ui-muted) hover:text-(--ui-strong)'
                }`}
              >
                <FileCode className="w-3.5 h-3.5" />
                <span>SVG 源码</span>
              </button>
            </div>

            <button
              onClick={onClose}
              className="p-1.5 rounded-xl hover:bg-(--ui-raised) text-(--ui-muted) hover:text-(--ui-strong) transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-hidden p-6 flex flex-col">
          {activeTab === 'preview' ? (
            <div className="flex-1 bg-slate-950/80 rounded-xl border border-slate-800/80 p-4 flex items-center justify-center overflow-auto min-h-[360px]">
              <div
                className="max-w-full max-h-[480px] drop-shadow-xl"
                dangerouslySetInnerHTML={{ __html: svgMarkup }}
              />
            </div>
          ) : (
            <div className="flex-1 relative bg-slate-950 rounded-xl border border-slate-800 overflow-hidden min-h-[360px]">
              <textarea
                readOnly
                value={svgMarkup}
                className="w-full h-full p-4 font-mono text-xs text-slate-300 bg-transparent resize-none outline-none leading-relaxed select-all"
              />
              <button
                onClick={handleCopyCode}
                className="absolute top-3 right-3 flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-xs font-medium text-(--ui-strong) rounded-lg border border-slate-700 shadow-md transition-colors"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? '已复制到剪贴板' : '复制代码'}</span>
              </button>
            </div>
          )}

          {/* Options & Action Footer */}
          <div className="mt-5 pt-4 border-t border-(--ui-border) flex items-center justify-between text-xs">
            <div className="flex items-center gap-6">
              <label className="flex items-center gap-2 cursor-pointer text-(--ui-text-2)">
                <input
                  type="checkbox"
                  checked={includeBackground}
                  onChange={(e) => setIncludeBackground(e.target.checked)}
                  className="rounded bg-(--ui-raised) border-(--ui-border) text-(--ui-accent) focus:ring-(--ui-accent)"
                />
                <span>包含底板案台色 (默认透明镂空底)</span>
              </label>

              <div className="flex items-center gap-2">
                <span className="text-(--ui-muted)">PNG分辨率:</span>
                <select
                  value={pngScale}
                  onChange={(e) => setPngScale(Number(e.target.value))}
                  className="bg-(--ui-raised) border border-(--ui-border) rounded-lg px-2 py-1 text-(--ui-strong) outline-none"
                >
                  <option value={1}>1x (标准尺寸)</option>
                  <option value={2}>2x (高清 2000px)</option>
                  <option value={4}>4x (超清打印级)</option>
                </select>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={handleCopyCode}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-(--ui-raised) hover:bg-(--ui-hover) text-(--ui-text-2) font-medium border border-(--ui-border) transition-colors"
              >
                {copied ? <Check className="w-4 h-4 text-[#438B6E]" /> : <Copy className="w-4 h-4" />}
                <span>{copied ? '已复制' : '复制 SVG 代码'}</span>
              </button>

              <button
                onClick={handleDownloadPng}
                disabled={isExportingPng}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-(--ui-raised) hover:bg-(--ui-hover) text-(--ui-text-2) font-medium border border-(--ui-border) transition-colors"
              >
                <ImageIcon className="w-4 h-4 text-(--ui-accent-2)" />
                <span>{isExportingPng ? '渲染中...' : '下载 PNG 图片'}</span>
              </button>

              <button
                onClick={handleDownloadSvg}
                className="flex items-center gap-2 px-5 py-2 rounded-xl bg-(--ui-accent) hover:bg-(--ui-accent-hover) text-white font-semibold shadow-lg shadow-blue-950/60 border border-(--ui-text-2)/40 transition-colors"
              >
                <Download className="w-4 h-4" />
                <span>下载 .SVG 矢量文件</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
