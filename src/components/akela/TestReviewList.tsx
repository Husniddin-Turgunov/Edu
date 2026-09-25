"use client";

/**
 * Test urinishini ko'rish (review) ro'yxati.
 *
 * Ilgari bu JSX `src/app/tests/[id]/page.tsx` ichida IKKI joyda (blocked ekran
 * modali va asosiy sahifa modali) nusxalanib yozilgan edi — natijada belgilar
 * (Siz / Noto'g'ri / To'g'ri) bir-biridan farq qilib qolgan edi. Endi ikkala
 * modal ham shu komponentdan foydalanadi.
 *
 * Ko'rsatiladi:
 *  - tanlangan javob  -> «Siz» badge (noto'g'ri bo'lsa qizil + «Noto'g'ri»)
 *  - to'g'ri javob    -> yashil «To'g'ri» badge
 *  - javob yo'q       -> sariq «Javob berilmagan» (javoblar saqlanmagan holat)
 *  - `review.answersTruncated` bo'lsa — yuqorida ogohlantirish (eski saqlash xatosi)
 */
export function TestReviewList({ review }: { review: any }) {
  if (!review?.questions?.length) return null;

  return (
    <div className="space-y-4" data-testid="review-questions">
      {/* Eski (kesilgan) saqlash xatosi: javoblarning bir qismi bazada yo'q */}
      {review.answersTruncated && (
        <div
          className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-xs font-semibold leading-relaxed text-amber-900"
          data-testid="review-truncated-warning"
        >
          Diqqat: bu urinish eski versiyada saqlangan — javoblarning (va ko&apos;rsatilgan
          savollarning) bir qismi bazaga yozilmagan. Saqlash xatosi tuzatildi, yangi urinishlarda
          hammasi to&apos;liq saqlanadi. Ko&apos;rinmayotgan javoblar «Javob berilmagan» deb belgilangan.
        </div>
      )}

      {review.questions.map((q: any, qi: number) => {
        const selected = q.selected;
        const selectedArr = Array.isArray(selected) ? selected : selected != null && selected !== "" ? [selected] : [];
        return (
          <div key={q.id} data-testid="review-question" className="rounded-2xl border border-neutral-200 bg-white p-4 ring-1 ring-neutral-100">
            <div className="mb-3 flex items-start gap-2.5">
              <span className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full bg-violet-600 text-xs font-bold text-white">{qi + 1}</span>
              <p className="text-sm font-bold leading-snug text-neutral-900 sm:text-base flex-1">{q.text}</p>
              {q.answerCorrect === true && (
                <span className="shrink-0 rounded-md bg-emerald-600 px-2 py-0.5 text-[10px] font-black uppercase text-white" data-testid="badge-question-correct">To&apos;g&apos;ri</span>
              )}
              {q.answerCorrect === false && (
                <span className="shrink-0 rounded-md bg-rose-600 px-2 py-0.5 text-[10px] font-black uppercase text-white" data-testid="badge-question-wrong">Noto&apos;g&apos;ri</span>
              )}
              {q.answerCorrect === null && (
                <span className="shrink-0 rounded-md bg-amber-100 px-2 py-0.5 text-[10px] font-black uppercase text-amber-800" data-testid="badge-question-unanswered">Javob berilmagan</span>
              )}
            </div>

            {q.type === "written" ? (
              <div className="space-y-2">
                <div className="rounded-xl bg-neutral-50 p-3">
                  <p className="text-[11px] font-bold uppercase tracking-wide text-neutral-400">Sizning javobingiz</p>
                  <p className="mt-1 whitespace-pre-wrap text-sm text-neutral-800" data-testid="review-written-answer">
                    {typeof selected === "string" && selected ? selected : "—"}
                  </p>
                </div>
                {review.revealCorrect && q.correctAnswer && (
                  <div className="rounded-xl bg-emerald-50 p-3 ring-1 ring-emerald-200">
                    <p className="text-[11px] font-bold uppercase tracking-wide text-emerald-600">To&apos;g&apos;ri javob</p>
                    <p className="mt-1 whitespace-pre-wrap text-sm text-emerald-900">{q.correctAnswer}</p>
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-2">
                {/* Foydalanuvchi tanlovi bo'lmasa (javob berilmagan yoki eski
                    urinishda saqlanmagan) — daraxt darajasidagi yashil
                    "To'g'ri" belgisi "hammasi to'g'ri" deb talqin qilinmasligi
                    uchun tanlov bloki ichida aniq amber ko'rsatma. */}
                {selectedArr.length === 0 && (
                  <div
                    className="flex items-center gap-2 rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-xs font-bold text-amber-900"
                    data-testid="badge-no-selection"
                  >
                    <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full border border-amber-400 text-[10px] font-black">?</span>
                    Siz bu savolga javob bermagansiz
                  </div>
                )}
                {q.choices.map((c: any) => {
                  const isSelected = selectedArr.some((s: string) => s === c.id || s === c.text || String(s) === String(c.order) || String(s) === String.fromCharCode(65 + (c.order ?? 0)));
                  const isCorrect = !!c.isCorrect;
                  let tone = "border-neutral-200 bg-white text-neutral-800";
                  if (isCorrect && isSelected) tone = "border-emerald-500 bg-emerald-100 text-emerald-900 ring-2 ring-emerald-500";
                  else if (isCorrect) tone = "border-emerald-500 bg-emerald-50 text-emerald-900 ring-1 ring-emerald-400";
                  else if (isSelected) tone = "border-rose-500 bg-rose-100 text-rose-900 ring-2 ring-rose-500";
                  return (
                    <div
                      key={c.id}
                      data-testid="review-choice"
                      data-selected={isSelected ? "1" : "0"}
                      data-correct={isCorrect ? "1" : "0"}
                      className={`flex items-start gap-2.5 rounded-xl border p-3 text-sm ${tone}`}
                    >
                      <span className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full border border-current/30 text-[11px] font-black opacity-80">
                        {c.order !== undefined ? String.fromCharCode(65 + c.order) : "•"}
                      </span>
                      <span className="flex-1 font-medium">{c.text}</span>
                      {isSelected && (
                        <span
                          className={`shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-black uppercase text-white ${isCorrect ? "bg-emerald-600" : "bg-rose-600"}`}
                          data-testid="badge-selected"
                        >
                          Siz
                        </span>
                      )}
                      {isSelected && !isCorrect && (
                        <span className="shrink-0 rounded-md bg-rose-700 px-1.5 py-0.5 text-[10px] font-black uppercase text-white" data-testid="badge-wrong">
                          Noto&apos;g&apos;ri
                        </span>
                      )}
                      {isCorrect && (
                        <span className="shrink-0 rounded-md bg-emerald-600 px-1.5 py-0.5 text-[10px] font-black uppercase text-white" data-testid="badge-correct">
                          To&apos;g&apos;ri
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {review.revealCorrect && q.explanation && (
              <p className="mt-3 rounded-xl bg-indigo-50 px-3 py-2 text-xs leading-relaxed text-indigo-900">{q.explanation}</p>
            )}
          </div>
        );
      })}
    </div>
  );
}

export default TestReviewList;
