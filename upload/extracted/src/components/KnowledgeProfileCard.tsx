"use client";

import { useI18n, type MessageKey } from "@/lib/i18n";
import type { FitCode, KnowledgeProfile, SectionProfile } from "@/lib/scoring";

function fitKey(code: FitCode): MessageKey {
  switch (code) {
    case "strong":
      return "fit_strong";
    case "knowledge_ok":
      return "fit_knowledge_ok";
    case "aspiration_ok":
      return "fit_aspiration_ok";
    case "weak":
      return "fit_weak";
    case "knowledge_only":
      return "fit_knowledge_only";
    case "aspiration_only":
      return "fit_aspiration_only";
    default:
      return "fit_mixed";
  }
}

function SectionBlock({
  section,
  compact,
}: {
  section: SectionProfile;
  compact?: boolean;
}) {
  const { t } = useI18n();
  const pct = section.autoCount ? Math.round(section.pct * 100) : null;
  const kindLabel =
    section.kind === "aspiration" ? t("kind_aspiration") : t("kind_knowledge");
  const solved = section.items.filter((i) => i.correct === true);
  const missed = section.items.filter((i) => i.correct === false);
  const openItems = section.items.filter((i) => i.correct === null);

  return (
    <div className="section-profile">
      <div className="section-profile-head">
        <div>
          <strong>{section.name}</strong>
          <div className="muted">
            {kindLabel}
            {section.autoCount > 0
              ? ` · ${section.correctCount}/${section.autoCount} ${t("profile_solved")}`
              : null}
            {openItems.length
              ? ` · ${openItems.length} ${t("profile_open_count")}`
              : null}
          </div>
        </div>
        <strong>{pct === null ? "—" : `${pct}%`}</strong>
      </div>
      {pct !== null ? (
        <div className="profile-bar">
          <i
            style={{
              width: `${pct}%`,
              background: section.kind === "aspiration" ? "#2f9e6f" : "#3a7bd5",
            }}
          />
        </div>
      ) : null}
      {!compact ? (
        <div className="section-hits">
          {solved.length > 0 ? (
            <div>
              <h5>{t("profile_solved_list")}</h5>
              <ul>
                {solved.map((i) => (
                  <li key={i.id}>✓ {i.prompt}</li>
                ))}
              </ul>
            </div>
          ) : null}
          {missed.length > 0 ? (
            <div className="missed">
              <h5>{t("profile_missed_list")}</h5>
              <ul>
                {missed.map((i) => (
                  <li key={i.id}>✗ {i.prompt}</li>
                ))}
              </ul>
            </div>
          ) : null}
          {openItems.length > 0 ? (
            <div className="open-answers">
              <h5>{t("profile_open_list")}</h5>
              <ul>
                {openItems.map((i) => (
                  <li key={i.id}>
                    <div>{i.prompt}</div>
                    {i.answerPreview ? (
                      <div className="muted">{i.answerPreview}</div>
                    ) : (
                      <div className="muted">—</div>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

export function KnowledgeProfileCard({
  profile,
  compact = false,
}: {
  profile: KnowledgeProfile;
  compact?: boolean;
}) {
  const { t } = useI18n();
  const knowledgePct =
    profile.knowledgeScore == null
      ? null
      : Math.round(profile.knowledgeScore * 100);
  const aspirationPct =
    profile.aspirationScore == null
      ? null
      : Math.round(profile.aspirationScore * 100);

  const sections = Array.isArray(profile.sections) ? profile.sections : [];
  const autoCorrect = profile.autoCorrect ?? 0;
  const autoTotal = profile.autoTotal ?? 0;

  return (
    <div className={compact ? "knowledge-profile compact" : "knowledge-profile"}>
      {!compact ? <h3>{t("profile_title")}</h3> : null}

      <p className="profile-fit">{t(fitKey(profile.fitCode))}</p>
      {autoTotal > 0 ? (
        <p className="muted" style={{ marginTop: 0 }}>
          {t("profile_auto_score")}: {autoCorrect}/{autoTotal} ·{" "}
          {profile.overallScore}%
        </p>
      ) : null}

      <div className="profile-meters">
        {knowledgePct !== null ? (
          <div className="profile-meter">
            <span>{t("profile_knowledge")}</span>
            <strong>{knowledgePct}%</strong>
            <div className="profile-bar">
              <i style={{ width: `${knowledgePct}%` }} />
            </div>
          </div>
        ) : null}
        {aspirationPct !== null ? (
          <div className="profile-meter">
            <span>{t("profile_aspiration")}</span>
            <strong>{aspirationPct}%</strong>
            <div className="profile-bar practice">
              <i style={{ width: `${aspirationPct}%` }} />
            </div>
          </div>
        ) : null}
      </div>

      {profile.summary ? (
        <p className="profile-insight">{profile.summary}</p>
      ) : null}

      {sections.length > 0 ? (
        <div className="profile-sections">
          <h4>{t("profile_by_section")}</h4>
          {sections.map((s) => (
            <SectionBlock
              key={`${s.kind}-${s.name}`}
              section={s}
              compact={compact}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function parseProfileJson(
  raw: string | null | undefined,
): KnowledgeProfile | null {
  if (!raw || raw === "{}") return null;
  try {
    const p = JSON.parse(raw) as KnowledgeProfile;
    if (!p || typeof p.overallScore !== "number" || !p.levelCode) return null;
    return {
      ...p,
      strengths: Array.isArray(p.strengths) ? p.strengths : [],
      gaps: Array.isArray(p.gaps) ? p.gaps : [],
      sections: Array.isArray(p.sections) ? p.sections : [],
      knowledgeScore:
        typeof p.knowledgeScore === "number" ? p.knowledgeScore : null,
      aspirationScore:
        typeof p.aspirationScore === "number" ? p.aspirationScore : null,
      autoCorrect: typeof p.autoCorrect === "number" ? p.autoCorrect : 0,
      autoTotal: typeof p.autoTotal === "number" ? p.autoTotal : 0,
      fitCode: p.fitCode || "mixed",
      summary: p.summary || "",
    };
  } catch {
    return null;
  }
}
