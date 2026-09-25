/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import { AlertTriangle, CloudCheck } from 'lucide-react';

/** Brief banner at the top of the canvas after each save; errors stay until dismissed. */
export const SaveBanner: React.FC<{
  banner: { id: number; text: string; error?: boolean } | null;
  onDone: () => void;
}> = ({ banner, onDone }) => {
  const [shown, setShown] = useState(false);

  useEffect(() => {
    if (!banner) return;
    setShown(true);
    if (banner.error) return;
    const hide = window.setTimeout(() => setShown(false), 1800);
    const done = window.setTimeout(onDone, 2100);
    return () => {
      window.clearTimeout(hide);
      window.clearTimeout(done);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [banner?.id]);

  if (!banner) return null;
  return (
    <div className="absolute top-3 inset-x-0 z-40 flex justify-center pointer-events-none">
      <div
        role="status"
        onClick={banner.error ? onDone : undefined}
        className={`flex items-center gap-2 px-3 py-1.5 rounded-full border shadow-lg backdrop-blur-md text-[11px] transition-all duration-300 ${
          shown ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-2'
        } ${
          banner.error
            ? 'pointer-events-auto cursor-pointer bg-[#3A1414]/90 border-[#D23838]/70 text-[#FFB4B4]'
            : 'bg-(--ui-panel)/92 border-(--ui-border) text-(--ui-text)'
        }`}
        data-tip={banner.error ? '点击关闭' : undefined}
      >
        {banner.error ? <AlertTriangle className="w-3.5 h-3.5" /> : <CloudCheck className="w-3.5 h-3.5 text-[#438B6E]" />}
        {banner.text}
      </div>
    </div>
  );
};
