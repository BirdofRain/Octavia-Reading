import React, { useMemo, useState } from "react";
import {
  formatProgressExportJson,
  getProgressSaveModeLabel,
  parseProgressImportText,
  copyTextToClipboard,
} from "./lib/progressTransfer.js";

export function ProgressTransferPanel({ progress, cloud, onImportProgress }) {
  const saveMode = useMemo(() => getProgressSaveModeLabel(cloud), [cloud]);
  const exportJson = useMemo(() => formatProgressExportJson(progress), [progress]);

  const [showExport, setShowExport] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [importText, setImportText] = useState("");
  const [importError, setImportError] = useState(null);
  const [copyStatus, setCopyStatus] = useState(null);
  const [importStatus, setImportStatus] = useState(null);
  const [importing, setImporting] = useState(false);

  const handleCopy = async () => {
    const copied = await copyTextToClipboard(exportJson);
    setCopyStatus(copied ? "Copied!" : "Select the text below and copy manually (Ctrl+C).");
    window.setTimeout(() => setCopyStatus(null), 2500);
  };

  const handleImport = async () => {
    setImportError(null);
    setImportStatus(null);
    const result = parseProgressImportText(importText);
    if (!result.ok) {
      setImportError(result.error);
      return;
    }

    const ok = window.confirm(
      "Replace the current progress on this device with the pasted JSON?\n\nThis cannot be undone. If cloud sync is on, the new progress will be saved to your account too."
    );
    if (!ok) return;

    setImporting(true);
    console.log("[progress-repair] clicked", "json-import");
    try {
      const outcome = await onImportProgress(result.data);
      if (outcome?.ok === false) {
        setImportError(outcome?.error || outcome?.message || "Import failed.");
        return;
      }
      setImportError(null);
      setImportStatus(outcome?.message || "Progress imported and saved.");
    } catch (e) {
      console.error("[progress-repair] failed", e);
      setImportError(e?.message || "Import failed.");
      setImportStatus(null);
    } finally {
      setImporting(false);
    }
  };

  const saveModeStyles = {
    synced: "bg-emerald-100 text-emerald-900",
    local: "bg-slate-200 text-slate-800",
    fallback: "bg-amber-100 text-amber-900",
    unknown: "bg-slate-100 text-slate-700",
  };

  return (
    <section className="mt-6 rounded-[2rem] border-2 border-slate-900 bg-sky-50 p-5 shadow-[0_6px_0_rgba(15,23,42,1)]">
      <h2 className="text-2xl font-black">Progress backup for ChatGPT</h2>
      <p className="mt-1 font-semibold text-slate-700">
        Copy progress for Sam or Summer to paste into ChatGPT, or move progress between devices.
      </p>

      <div
        className={`mt-4 inline-flex flex-col rounded-2xl border-2 border-slate-900 px-4 py-2 ${saveModeStyles[saveMode.id] || saveModeStyles.unknown}`}
      >
        <span className="text-xs font-black uppercase tracking-wide">Save mode</span>
        <span className="text-lg font-black">{saveMode.label}</span>
        <span className="text-sm font-semibold">{saveMode.detail}</span>
      </div>

      <div className="mt-4 flex flex-wrap gap-3">
        <button
          type="button"
          onClick={() => {
            setShowExport((v) => !v);
            setShowImport(false);
          }}
          className="rq-button rounded-2xl border-2 border-slate-900 bg-white px-5 py-3 font-black shadow-[0_4px_0_rgba(15,23,42,1)]"
        >
          {showExport ? "Hide export" : "Export progress"}
        </button>
        <button
          type="button"
          onClick={() => {
            setShowImport((v) => !v);
            setShowExport(false);
            setImportError(null);
          }}
          className="rq-button rounded-2xl border-2 border-slate-900 bg-white px-5 py-3 font-black shadow-[0_4px_0_rgba(15,23,42,1)]"
        >
          {showImport ? "Hide import" : "Import progress"}
        </button>
      </div>

      {showExport && (
        <div className="mt-4 rounded-2xl border-2 border-slate-900 bg-white p-4 shadow-inner">
          <p className="text-sm font-bold text-slate-600">
            Includes child name, version, stars, XP/level, badges, rewards, daily log, and totals. No passwords.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={handleCopy}
              className="rq-button rounded-full border-2 border-slate-900 bg-sky-100 px-5 py-2 font-black shadow-[0_3px_0_rgba(15,23,42,1)]"
            >
              Copy JSON
            </button>
            {copyStatus && <span className="self-center text-sm font-bold text-emerald-800">{copyStatus}</span>}
          </div>
          <textarea
            readOnly
            value={exportJson}
            rows={14}
            className="mt-3 w-full rounded-xl border-2 border-slate-300 bg-slate-50 px-3 py-2 font-mono text-xs leading-relaxed"
            onFocus={(e) => e.target.select()}
          />
        </div>
      )}

      {(importStatus || importError) && (
        <div className="mt-4">
          {importStatus && (
            <p className="rounded-2xl border-2 border-emerald-700 bg-emerald-100 px-4 py-3 text-sm font-bold text-emerald-950" role="status">
              {importStatus}
            </p>
          )}
          {importError && (
            <p className="mt-2 rounded-2xl border-2 border-red-700 bg-red-100 px-4 py-3 text-sm font-bold text-red-950" role="alert">
              {importError}
            </p>
          )}
        </div>
      )}

      {showImport && (
        <div className="mt-4 rounded-2xl border-2 border-amber-700 bg-amber-50 p-4">
          <p className="font-black text-amber-950">Warning</p>
          <p className="mt-1 text-sm font-semibold text-amber-900">
            Import replaces current progress on this device. Older JSON versions are upgraded automatically.
          </p>
          <textarea
            value={importText}
            onChange={(e) => setImportText(e.target.value)}
            rows={12}
            placeholder="Paste exported JSON here…"
            className="mt-3 w-full rounded-xl border-2 border-slate-900 bg-white px-3 py-2 font-mono text-xs leading-relaxed"
          />
          <button
            type="button"
            onClick={handleImport}
            disabled={importing}
            className="rq-button mt-3 rounded-2xl border-2 border-slate-900 bg-white px-5 py-3 font-black shadow-[0_4px_0_rgba(15,23,42,1)] disabled:opacity-50"
          >
            {importing ? "Importing…" : "Replace progress from JSON"}
          </button>
        </div>
      )}
    </section>
  );
}
