import {
  ChevronRight,
  Eye,
  History,
  Loader2,
  Trash2,
  UserRound,
} from "lucide-react";

type HistoryResult = {
  id: string;
  userId: string;
  score?: number | null;
  passed: boolean;
  startedAt?: string;
  completedAt?: string | null;
  createdAt?: string;
  user?: { name?: string | null; email?: string | null } | null;
};

type HistorySectionProps = {
  testId: string;
  history: HistoryResult[];
  selectedIds: string[];
  expandedIds: string[];
  reviews: Record<string, any>;
  loadingIds: string[];
  errorIds: string[];
  onSelect: (id: string) => void;
  onSelectAll: (checked: boolean) => void;
  onOpenSelected: () => void;
  onClearSelected: () => void;
  onCloseAll: () => void;
  onToggle: (result: HistoryResult) => void;
  onDeleteSelected?: () => void;
  deleting?: boolean;
};

export function HistorySection({
  history,
  selectedIds,
  expandedIds,
  reviews,
  loadingIds,
  errorIds,
  onSelect,
  onSelectAll,
  onOpenSelected,
  onClearSelected,
  onCloseAll,
  onToggle,
  onDeleteSelected,
  deleting,
}: HistorySectionProps) {
  return (
    <section className="overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm">
      <div className="border-b border-neutral-100 bg-gradient-to-r from-violet-50/80 to-indigo-50/50 px-5 py-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="flex items-center gap-2 text-sm font-black text-neutral-900">
              <span className="grid h-8 w-8 place-items-center rounded-xl bg-violet-600 text-white">
                <History className="h-4 w-4" />
              </span>
              Topshirganlar tarixi
              <span className="rounded-full bg-white px-2 py-0.5 text-xs text-violet-700 shadow-sm">{history.length}</span>
            </h3>
            <p className="mt-1 pl-10 text-xs text-neutral-500">Natijalarni belgilab, bir vaqtda ochib ko‘ring.</p>
          </div>

          {history.length > 0 && (
            <div className="flex flex-wrap items-center gap-2">
              <label className="mr-1 flex cursor-pointer items-center gap-2 rounded-lg border border-white bg-white/80 px-3 py-2 text-xs font-bold text-neutral-700 shadow-sm hover:bg-white">
                <input
                  type="checkbox"
                  checked={selectedIds.length === history.length}
                  onChange={(event) => onSelectAll(event.target.checked)}
                  className="h-4 w-4 accent-violet-600"
                />
                Hammasini tanlash
              </label>
              <button
                type="button"
                disabled={!selectedIds.length}
                onClick={onOpenSelected}
                className="flex items-center gap-1.5 rounded-lg bg-violet-600 px-3 py-2 text-xs font-bold text-white shadow-sm transition hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <Eye className="h-3.5 w-3.5" /> Tanlanganlarni ochish ({selectedIds.length})
              </button>
              <button type="button" disabled={!selectedIds.length} onClick={onClearSelected} className="rounded-lg border border-neutral-200 bg-white px-3 py-2 text-xs font-bold text-neutral-600 hover:bg-neutral-50 disabled:opacity-40">Tozalash</button>
              <button
                type="button"
                disabled={!selectedIds.length || deleting}
                onClick={onDeleteSelected}
                className="flex items-center gap-1.5 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-bold text-rose-600 transition hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-40"
                title="Tanlangan natijalarni o'chirish"
              >
                {deleting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                O'chirish ({selectedIds.length})
              </button>
              <button type="button" disabled={!expandedIds.length} onClick={onCloseAll} className="rounded-lg border border-neutral-200 bg-white px-3 py-2 text-xs font-bold text-neutral-600 hover:bg-neutral-50 disabled:opacity-40">Hammasini yopish</button>
            </div>
          )}
        </div>
      </div>

      {history.length === 0 ? (
        <div className="px-5 py-10 text-center text-sm text-neutral-500">Hozircha topshirilgan natija yo‘q</div>
      ) : (
        <div className="max-h-[520px] space-y-2.5 overflow-y-auto p-4">
          {history.slice(0, 50).map((result) => {
            const selected = selectedIds.includes(result.id);
            const expanded = expandedIds.includes(result.id);
            const review = reviews[result.id];
            const loading = loadingIds.includes(result.id);
            const errored = errorIds.includes(result.id);
            return (
              <article key={result.id} className={`overflow-hidden rounded-2xl border bg-white transition ${selected || expanded ? "border-violet-300 ring-2 ring-violet-100" : "border-neutral-200 hover:border-neutral-300"}`}>
                <div className={`flex flex-wrap items-center gap-3 px-3.5 py-3 sm:flex-nowrap ${selected || expanded ? "bg-violet-50/45" : "bg-white"}`}>
                  <input aria-label={`${result.user?.name || "Foydalanuvchi"} natijasini tanlash`} type="checkbox" checked={selected} onChange={() => onSelect(result.id)} className="h-4 w-4 shrink-0 accent-violet-600" />
                  <div className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl text-sm font-black text-white shadow-sm ${result.passed ? "bg-emerald-600" : "bg-rose-600"}`}>{result.score ?? 0}%</div>
                  <div className="min-w-[180px] flex-1">
                    <p className="flex items-center gap-1.5 truncate text-sm font-bold text-neutral-900"><UserRound className="h-3.5 w-3.5 text-neutral-400" />{result.user?.name || result.userId.slice(0, 8)}</p>
                    <p className="truncate text-xs text-neutral-500">{result.user?.email || result.userId}</p>
                  </div>
                  <span className={`rounded-full border px-2.5 py-1 text-[11px] font-bold ${result.passed ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-rose-200 bg-rose-50 text-rose-700"}`}>{result.passed ? "O‘tgan" : "Yiqilgan"}</span>
                  <span className="hidden text-xs text-neutral-500 sm:block">{new Date(result.completedAt || result.createdAt || result.startedAt || Date.now()).toLocaleString()}</span>
                  <button type="button" onClick={() => onToggle(result)} className="flex shrink-0 items-center gap-1.5 rounded-lg border border-neutral-200 bg-white px-3 py-2 text-xs font-bold text-neutral-700 hover:border-violet-300 hover:text-violet-700" aria-expanded={expanded}>
                    {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ChevronRight className={`h-3.5 w-3.5 transition-transform ${expanded ? "rotate-90" : ""}`} />} {expanded ? "Yopish" : "Ochish"}
                  </button>
                </div>
                {expanded && <HistoryDetails review={review} loading={loading} errored={errored} result={result} />}
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}

function HistoryDetails({ review, loading, errored, result }: { review: any; loading: boolean; errored: boolean; result: HistoryResult }) {
  return (
    <div className="border-t border-violet-100 bg-slate-50/80 p-4">
      {loading && <div className="flex items-center justify-center gap-2 py-7 text-xs font-semibold text-neutral-500"><Loader2 className="h-4 w-4 animate-spin text-violet-600" /> Natija yuklanmoqda...</div>}
      {errored && <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs font-semibold text-rose-700">Natija yuklanmadi. Qayta ochib ko‘ring.</div>}
      {review && (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {[
              { label: "Ball", value: `${review.result?.score ?? result.score ?? 0}%` },
              { label: "Holat", value: review.result?.passed ?? result.passed ? "O‘tgan" : "Yiqilgan" },
              { label: "Tugatilgan", value: new Date(review.result?.completedAt || result.completedAt).toLocaleDateString() },
              { label: "Savollar", value: review.questions?.length || "—" },
            ].map((item) => <div key={item.label} className="rounded-xl border border-neutral-200 bg-white px-3 py-2.5"><p className="text-[10px] font-bold uppercase tracking-wide text-neutral-400">{item.label}</p><p className="mt-1 truncate text-sm font-black text-neutral-800">{item.value}</p></div>)}
          </div>
          <div className="max-h-80 space-y-2 overflow-y-auto pr-1">
            {(review.questions || []).map((question: any, index: number) => (
              <QuestionReview key={question.id} question={question} index={index} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function QuestionReview({ question, index }: { question: any; index: number }) {
  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-3.5">
      <div className="flex items-start gap-2"><span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-violet-100 text-[11px] font-black text-violet-700">{index + 1}</span><p className="text-sm font-bold leading-snug text-neutral-800">{question.text}</p>{question.answerCorrect !== null && <span className={`ml-auto shrink-0 rounded-md px-2 py-0.5 text-[10px] font-black text-white ${question.answerCorrect ? "bg-emerald-600" : "bg-rose-600"}`}>{question.answerCorrect ? "To‘g‘ri" : "Xato"}</span>}</div>
      <div className="mt-2.5 grid gap-1.5">
        {question.choices?.map((choice: any, choiceIndex: number) => {
          const picked = Array.isArray(question.selected) ? question.selected.includes(choice.id) : question.selected === choice.id || String(question.selected) === String(choice.text);
          return <div key={choice.id} className={`flex items-center gap-2 rounded-lg border px-2.5 py-2 text-xs ${choice.isCorrect ? "border-emerald-200 bg-emerald-50 text-emerald-900" : picked ? "border-rose-200 bg-rose-50 text-rose-800" : "border-neutral-100 text-neutral-500"}`}><span className="font-black">{String.fromCharCode(65 + choiceIndex)}</span><span className="flex-1">{choice.text}</span>{picked && <span className="font-bold">Tanlangan</span>}</div>;
        })}
      </div>
      {question.type === "written" && <div className="mt-2 rounded-lg border border-amber-200 bg-amber-50 p-2.5 text-xs text-amber-900"><b>Javob:</b> {question.selected || "—"}<br /><b>To‘g‘ri javob:</b> {question.correctAnswer || "—"}</div>}
      {question.explanation && <p className="mt-2 rounded-lg bg-indigo-50 p-2 text-xs text-indigo-800"><b>Izoh:</b> {question.explanation}</p>}
    </div>
  );
}
