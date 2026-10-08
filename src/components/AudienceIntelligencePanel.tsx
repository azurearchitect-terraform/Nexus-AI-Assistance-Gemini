import type { AudienceDecision } from "../lib/audienceIntelligence";

interface Props {
  decision: AudienceDecision | null;
  enabled: boolean;
  loading: boolean;
  isDarkMode: boolean;
  selectedAudiences: string[];
  onToggle: () => void;
  onApply: () => void;
  onAnalyze: () => void;
  onCustom: (persona: string) => void;
  onSuggestion: (id: string) => void;
}

export function AudienceIntelligencePanel({
  decision, enabled, loading, isDarkMode, selectedAudiences, onToggle, onApply, onAnalyze, onCustom, onSuggestion,
}: Props) {
  return (
    <section aria-label="Audience Intelligence" className={`mt-3 rounded-xl border p-3 text-xs ${
      isDarkMode ? "bg-white/5 border-white/15 text-white" : "bg-white border-slate-200 text-slate-900"
    }`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h4 className="font-bold">Audience Intelligence</h4>
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={enabled} onChange={onToggle} />
          Auto-select from JD
        </label>
      </div>
      <p className="mt-2 opacity-80" aria-live="polite">
        {loading ? "Analyzing the posting..." : decision
          ? decision.source === "rules" ? "Evidence-based rules fallback" : "AI + evidence-based guardrails"
          : "Paste a full job description to get reader suggestions."}
      </p>
      <p className="mt-1 opacity-80">Each selected audience generates its own resume version. Apply selects the primary and at most one closely matched secondary; other suggestions are opt-in.</p>
      {decision && (
        <>
          <div className="mt-2 flex flex-wrap gap-1">
            {[decision.signals.seniority.value, decision.signals.peopleManagement.value,
              ...decision.signals.platforms, decision.signals.orgScale.value]
              .filter((value) => value !== "not stated").map((value) => (
                <span key={value} className="rounded bg-emerald-500/15 px-2 py-1">{value}</span>
              ))}
          </div>
          <ol className="mt-3 space-y-3">
            {decision.audiences.map((pick, index) => (
              <li key={pick.id}>
                <div className="flex justify-between gap-2 font-semibold">
                  <span>{index === 0 ? "Primary: " : "Secondary: "}{pick.label}</span>
                  <span>{Math.round(pick.confidence * 100)}%</span>
                </div>
                <p className="mt-1 opacity-80">{pick.reason}</p>
                {pick.evidence.length > 0 && (
                  <details className="mt-1">
                    <summary className="cursor-pointer font-medium">JD evidence</summary>
                    {pick.evidence.map((quote, i) => <blockquote key={i} className="mt-1 border-l-2 border-emerald-500 pl-2 break-words">{quote}</blockquote>)}
                  </details>
                )}
                <button type="button" disabled={selectedAudiences.includes(pick.id)}
                  onClick={() => onSuggestion(pick.id)}
                  className="mt-2 rounded border px-2 py-1 font-medium disabled:opacity-60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-500">
                  {selectedAudiences.includes(pick.id) ? "Selected" : "Add this audience"}
                </button>
              </li>
            ))}
          </ol>
          {decision.warnings.map((warning) => <p key={warning} className="mt-2 text-amber-600 dark:text-amber-300">{warning}</p>)}
          {decision.customPersona && (
            <button type="button" onClick={() => onCustom(decision.customPersona!)}
              className="mt-2 rounded border px-3 py-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-500">
              Use as custom persona: {decision.customPersona}
            </button>
          )}
        </>
      )}
      <div className="mt-3 flex gap-2">
        <button type="button" disabled={!decision || loading} onClick={onApply}
          className="rounded bg-emerald-600 px-3 py-2 font-semibold text-white disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-500">
          Apply suggestion
        </button>
        <button type="button" disabled={loading} onClick={onAnalyze}
          className="rounded border px-3 py-2 font-semibold disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-500">
          Re-analyze
        </button>
      </div>
    </section>
  );
}
