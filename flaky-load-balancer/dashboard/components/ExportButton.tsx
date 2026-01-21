'use client';

import { useState, useRef } from 'react';
import { Download, Image, FileJson, ChevronDown } from 'lucide-react';
import { toPng } from 'html-to-image';
import { saveAs } from 'file-saver';
import { useDashboardStore } from '@/stores/dashboardStore';

interface ExportButtonProps {
  dashboardRef: React.RefObject<HTMLDivElement | null>;
}

export function ExportButton({ dashboardRef }: ExportButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const history = useDashboardStore((state) => state.history);
  const getCurrentSnapshot = useDashboardStore((state) => state.getCurrentSnapshot);
  const currentStrategy = useDashboardStore((state) => state.currentStrategy);

  const handleExportPng = async () => {
    if (!dashboardRef.current) return;

    setIsExporting(true);
    setIsOpen(false);

    try {
      const dataUrl = await toPng(dashboardRef.current, {
        backgroundColor: '#0f172a',
        pixelRatio: 2,
      });

      const timestamp = new Date().toISOString().slice(0, 19).replace(/[:-]/g, '');
      const filename = `flb-dashboard-${currentStrategy ?? 'unknown'}-${timestamp}.png`;

      saveAs(dataUrl, filename);
    } catch (error) {
      console.error('Failed to export PNG:', error);
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportJson = () => {
    setIsOpen(false);

    const snapshot = getCurrentSnapshot();
    if (!snapshot) return;

    const exportData = {
      exportedAt: new Date().toISOString(),
      strategy: currentStrategy,
      currentSnapshot: snapshot,
      historyLength: history.length,
      fullHistory: history,
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], {
      type: 'application/json',
    });

    const timestamp = new Date().toISOString().slice(0, 19).replace(/[:-]/g, '');
    const filename = `flb-metrics-${currentStrategy ?? 'unknown'}-${timestamp}.json`;

    saveAs(blob, filename);
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        disabled={isExporting}
        className="flex items-center gap-2 px-3 py-2 bg-slate-700 hover:bg-slate-600 rounded text-sm font-medium disabled:opacity-50"
      >
        <Download className="w-4 h-4" />
        Export
        <ChevronDown className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setIsOpen(false)} />
          <div className="absolute right-0 mt-2 w-48 bg-slate-700 rounded-lg shadow-lg z-20 overflow-hidden">
            <button
              onClick={handleExportPng}
              className="w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-600 text-left text-sm"
            >
              <Image className="w-4 h-4 text-blue-400" />
              <div>
                <p className="font-medium">Screenshot</p>
                <p className="text-xs text-slate-400">Export as PNG</p>
              </div>
            </button>
            <button
              onClick={handleExportJson}
              className="w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-600 text-left text-sm"
            >
              <FileJson className="w-4 h-4 text-green-400" />
              <div>
                <p className="font-medium">Data Export</p>
                <p className="text-xs text-slate-400">Export as JSON</p>
              </div>
            </button>
          </div>
        </>
      )}
    </div>
  );
}
