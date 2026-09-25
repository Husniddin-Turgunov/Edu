"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AppShell, PageHeader } from "@/components/ui";
import { RoleHomeCanvas } from "@/components/visual-editor/RoleHomeCanvas";
import {
  saveRoleHomePageAction,
  saveVisualContentPageAction,
} from "@/db/actions";
import {
  messageForLocale,
  useI18n,
  type Locale,
  type MessageKey,
} from "@/lib/i18n";
import {
  MAX_MEDIA_BYTES,
  ROLE_HOME_AUDIENCES,
  emptyRoleHomeDocument,
  isRoleHomeAudience,
  newElementId,
  type PageElement,
  type RoleHomeAudience,
  type RoleHomeDocument,
  type RoleHomePagesMap,
  type TextElement,
  type VisibilityPerson,
} from "@/lib/role-home";
import {
  INTERN_EDITOR_SECTIONS,
  VISUAL_LOCALES,
  onboardingVisualPageKey,
  type InternEditorSection,
  type OnboardingVisualPageKey,
} from "@/lib/onboarding-visual";

const ROLE_KEYS: Record<RoleHomeAudience, MessageKey> = {
  observer: "role_observer",
  manager: "role_manager",
  employee: "role_employee",
  intern: "role_intern",
};

const ONBOARDING_KEYS: Record<InternEditorSection, MessageKey> = {
  permanent: "design_permanent_view",
  welcome: "intern_intro_welcome_title",
  history: "intern_intro_history_title",
  about: "intern_intro_about_title",
  structure: "intern_intro_structure_title",
  rules: "intern_intro_rules_title",
};

const ONBOARDING_COPY: Record<
  InternEditorSection,
  { body: MessageKey; points: MessageKey[] }
> = {
  permanent: {
    body: "design_permanent_view_body",
    points: [
      "design_permanent_view_point_1",
      "design_permanent_view_point_2",
      "design_permanent_view_point_3",
    ],
  },
  welcome: {
    body: "intern_intro_welcome_body",
    points: [
      "intern_intro_welcome_point_1",
      "intern_intro_welcome_point_2",
      "intern_intro_welcome_point_3",
    ],
  },
  history: {
    body: "intern_intro_history_body",
    points: [
      "intern_intro_history_point_1",
      "intern_intro_history_point_2",
      "intern_intro_history_point_3",
    ],
  },
  about: {
    body: "intern_intro_about_body",
    points: [
      "intern_intro_about_point_1",
      "intern_intro_about_point_2",
      "intern_intro_about_point_3",
    ],
  },
  structure: {
    body: "intern_intro_structure_body",
    points: [
      "intern_intro_structure_point_1",
      "intern_intro_structure_point_2",
      "intern_intro_structure_point_3",
    ],
  },
  rules: {
    body: "intern_intro_rules_body",
    points: [
      "intern_intro_rules_point_1",
      "intern_intro_rules_point_2",
      "intern_intro_rules_point_3",
      "intern_intro_rules_point_4",
    ],
  },
};

function defaultOnboardingDocument(
  section: InternEditorSection,
  locale: Locale,
): RoleHomeDocument {
  const copy = ONBOARDING_COPY[section];
  return {
    ...emptyRoleHomeDocument(),
    elements: [
      {
        id: `default-${section}-${locale}-title`,
        type: "text",
        x: 7,
        y: 8,
        w: 86,
        h: 15,
        z: 1,
        content: messageForLocale(locale, ONBOARDING_KEYS[section]),
        fontSize: 44,
        color: "#1a1b2e",
        fontWeight: 800,
        align: "left",
      },
      {
        id: `default-${section}-${locale}-body`,
        type: "text",
        x: 7,
        y: 26,
        w: 86,
        h: 16,
        z: 2,
        content: messageForLocale(locale, copy.body),
        fontSize: 25,
        color: "#50546b",
        fontWeight: 400,
        align: "left",
      },
      {
        id: `default-${section}-${locale}-points`,
        type: "text",
        x: 9,
        y: 48,
        w: 82,
        h: 38,
        z: 3,
        content: copy.points
          .map((key) => `• ${messageForLocale(locale, key)}`)
          .join("\n"),
        fontSize: 23,
        color: "#1a1b2e",
        fontWeight: 600,
        align: "left",
      },
    ],
  };
}

type DesignPageKey = RoleHomeAudience | OnboardingVisualPageKey;
type DesignPagesMap = Record<DesignPageKey, RoleHomeDocument>;

const GEOMETRY_FIELDS: {
  key: "x" | "y" | "w" | "h";
  label: MessageKey;
  min: number;
  max: number;
}[] = [
  { key: "x", label: "design_position_x", min: -20, max: 100 },
  { key: "y", label: "design_position_y", min: -20, max: 100 },
  { key: "w", label: "design_element_width", min: 1, max: 100 },
  { key: "h", label: "design_element_height", min: 1, max: 100 },
];

function nextZ(elements: PageElement[]) {
  return elements.reduce((max, el) => Math.max(max, el.z), 0) + 1;
}

function cloneDocument(doc: RoleHomeDocument): RoleHomeDocument {
  return {
    ...doc,
    elements: doc.elements.map((el) => ({ ...el })),
  };
}

export function DesignEditorView({
  pages,
  onboardingPages,
  people,
}: {
  pages: RoleHomePagesMap;
  onboardingPages: Record<OnboardingVisualPageKey, RoleHomeDocument>;
  people: VisibilityPerson[];
}) {
  const { t } = useI18n();
  const fileRef = useRef<HTMLInputElement>(null);
  const [pageKey, setPageKey] = useState<DesignPageKey>(
    "intern-onboarding-permanent-ru",
  );
  const [onboardingLocale, setOnboardingLocale] =
    useState<(typeof VISUAL_LOCALES)[number]>("ru");
  const [personQuery, setPersonQuery] = useState("");
  const [peopleOpen, setPeopleOpen] = useState(false);
  const [drafts, setDrafts] = useState<DesignPagesMap>(() => {
    const combined = { ...pages, ...onboardingPages } as DesignPagesMap;
    for (const section of INTERN_EDITOR_SECTIONS) {
      for (const locale of VISUAL_LOCALES) {
        const key = onboardingVisualPageKey(section, locale);
        if (
          combined[key].elements.length === 0 &&
          combined[key].background === "#ffffff"
        ) {
          combined[key] = defaultOnboardingDocument(section, locale);
        }
      }
    }
    return Object.fromEntries(
      Object.entries(combined).map(([key, value]) => [
        key,
        cloneDocument(value),
      ]),
    ) as DesignPagesMap;
  });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [uploadKind, setUploadKind] = useState<"image" | "video">("image");
  const [busy, setBusy] = useState<"save" | "upload" | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const doc = drafts[pageKey] ?? emptyRoleHomeDocument();
  const isPermanentPage = pageKey.startsWith(
    "intern-onboarding-permanent-",
  );
  const selectedPeople = useMemo(() => {
    if (doc.visibleUserIds.length > 0) {
      return people.filter((person) =>
        doc.visibleUserIds.includes(person.id),
      );
    }
    return people.filter((person) =>
      doc.visibleTo.includes(person.audience),
    );
  }, [doc.visibleTo, doc.visibleUserIds, people]);
  const availablePeople = useMemo(() => {
    const selectedIds = new Set(selectedPeople.map((person) => person.id));
    const query = personQuery.trim().toLowerCase();
    return people.filter((person) => {
      if (selectedIds.has(person.id)) return false;
      if (!query) return true;
      return (
        person.name.toLowerCase().includes(query) ||
        person.meta.toLowerCase().includes(query)
      );
    });
  }, [people, personQuery, selectedPeople]);

  function setVisiblePeople(nextIds: number[]) {
    updateDoc((current) => ({
      ...current,
      visibleUserIds: nextIds,
      visibleTo: [],
    }));
  }
  const selected = useMemo(
    () => doc.elements.find((el) => el.id === selectedId) ?? null,
    [doc.elements, selectedId],
  );

  useEffect(() => {
    setSelectedId(null);
    setNotice(null);
    setError(null);
    setPersonQuery("");
    setPeopleOpen(false);
  }, [pageKey]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const tag = (event.target as HTMLElement | null)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      if (!selectedId) return;
      if (event.key === "Escape") {
        setSelectedId(null);
        return;
      }
      if (event.key === "Delete" || event.key === "Backspace") {
        event.preventDefault();
        updateDoc((current) => ({
          ...current,
          elements: current.elements.filter((el) => el.id !== selectedId),
        }));
        setSelectedId(null);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selectedId]);

  function updateDoc(mutator: (current: RoleHomeDocument) => RoleHomeDocument) {
    setDrafts((prev) => ({
      ...prev,
      [pageKey]: mutator(prev[pageKey] ?? emptyRoleHomeDocument()),
    }));
  }

  function patchElement(id: string, patch: Partial<PageElement>) {
    updateDoc((current) => ({
      ...current,
      elements: current.elements.map((el) =>
        el.id === id ? ({ ...el, ...patch } as PageElement) : el,
      ),
    }));
  }

  function addText() {
    const element: TextElement = {
      id: newElementId(),
      type: "text",
      x: 8,
      y: 10,
      w: 36,
      h: 14,
      z: nextZ(doc.elements),
      content: t("design_new_text"),
      fontSize: 32,
      color: "#1a1b2e",
      fontWeight: 700,
      align: "left",
    };
    updateDoc((current) => ({
      ...current,
      elements: [...current.elements, element],
    }));
    setSelectedId(element.id);
  }

  function requestMedia(kind: "image" | "video") {
    setUploadKind(kind);
    if (fileRef.current) {
      fileRef.current.value = "";
      fileRef.current.accept =
        kind === "image"
          ? "image/jpeg,image/png,image/webp,image/gif"
          : "video/mp4,video/webm,video/quicktime";
      fileRef.current.click();
    }
  }

  async function onFileChange(file: File | undefined) {
    if (!file) return;
    setError(null);
    setNotice(null);
    if (file.size > MAX_MEDIA_BYTES) {
      setError(t("design_file_too_large"));
      return;
    }
    setBusy("upload");
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("pageKey", pageKey);
      const response = await fetch("/api/design/upload", {
        method: "POST",
        body: formData,
      });
      const payload = (await response.json()) as { url?: string; error?: string };
      if (!response.ok || !payload.url) {
        throw new Error(payload.error || t("design_upload_error"));
      }
      const mediaUrl = payload.url;
      const element: PageElement =
        uploadKind === "image"
          ? {
              id: newElementId(),
              type: "image",
              x: 12,
              y: 18,
              w: 32,
              h: 36,
              z: nextZ(doc.elements),
              src: mediaUrl,
              alt: file.name,
              fit: "cover",
            }
          : {
              id: newElementId(),
              type: "video",
              x: 14,
              y: 22,
              w: 42,
              h: 36,
              z: nextZ(doc.elements),
              src: mediaUrl,
              autoplay: false,
              muted: true,
              loop: false,
              fit: "cover",
            };
      updateDoc((current) => ({
        ...current,
        elements: [...current.elements, element],
      }));
      setSelectedId(element.id);
    } catch (err) {
      setError((err as Error).message || t("design_upload_error"));
    } finally {
      setBusy(null);
    }
  }

  function duplicateSelected() {
    if (!selected) return;
    const copy = {
      ...selected,
      id: newElementId(),
      x: Math.min(90, selected.x + 4),
      y: Math.min(90, selected.y + 4),
      z: nextZ(doc.elements),
    } as PageElement;
    updateDoc((current) => ({
      ...current,
      elements: [...current.elements, copy],
    }));
    setSelectedId(copy.id);
  }

  function deleteSelected() {
    if (!selectedId) return;
    updateDoc((current) => ({
      ...current,
      elements: current.elements.filter((el) => el.id !== selectedId),
    }));
    setSelectedId(null);
  }

  function shiftLayer(direction: "front" | "back") {
    if (!selected) return;
    const zs = doc.elements.map((el) => el.z);
    const next =
      direction === "front"
        ? Math.max(...zs, 0) + 1
        : Math.min(...zs, 0) - 1;
    patchElement(selected.id, { z: next });
  }

  async function save() {
    setBusy("save");
    setError(null);
    setNotice(null);
    try {
      if (isRoleHomeAudience(pageKey)) {
        await saveRoleHomePageAction({
          audience: pageKey,
          document: drafts[pageKey],
        });
      } else {
        await saveVisualContentPageAction({
          pageKey,
          document: drafts[pageKey],
        });
      }
      setNotice(t("design_saved"));
    } catch (err) {
      setError((err as Error).message || t("design_save_error"));
    } finally {
      setBusy(null);
    }
  }

  return (
    <AppShell pathname="/design">
      <PageHeader title={t("design_title")} subtitle={t("design_subtitle")} />

      <div className="design-page-picker">
        <h2>{t("intern_company_menu_title")}</h2>
        <div className="design-roles" role="tablist">
          {VISUAL_LOCALES.map((locale) => (
            <button
              key={locale}
              type="button"
              className={
                onboardingLocale === locale
                  ? "btn btn-primary"
                  : "btn btn-ghost"
              }
              onClick={() => {
                setOnboardingLocale(locale);
                const currentSection =
                  INTERN_EDITOR_SECTIONS.find((section) =>
                    pageKey.includes(`intern-onboarding-${section}-`),
                  ) ?? "permanent";
                setPageKey(onboardingVisualPageKey(currentSection, locale));
              }}
            >
              {locale.toUpperCase()}
            </button>
          ))}
        </div>
        <div className="design-roles" role="tablist">
          {INTERN_EDITOR_SECTIONS.map((section) => {
            const key = onboardingVisualPageKey(section, onboardingLocale);
            return (
              <button
                key={section}
                type="button"
                role="tab"
                aria-selected={pageKey === key}
                className={
                  pageKey === key ? "btn btn-primary" : "btn btn-ghost"
                }
                onClick={() => setPageKey(key)}
              >
                {t(ONBOARDING_KEYS[section]).replace("{name}", "…")}
              </button>
            );
          })}
        </div>
        {pageKey.startsWith("intern-onboarding-") ? (
          <section className="panel design-audience-picker">
            <strong>{t("design_show_to")}</strong>
            <p className="muted design-audience-note">
              {isPermanentPage
                ? t("design_show_to_note_permanent")
                : t("design_show_to_note_once")}
            </p>
            <div className="design-audience-selected">
              <button
                type="button"
                className="design-audience-toggle"
                aria-expanded={peopleOpen}
                onClick={() => setPeopleOpen((value) => !value)}
              >
                <span className="design-audience-toggle-caret" aria-hidden>
                  {peopleOpen ? "▾" : "▸"}
                </span>
                <span className="design-audience-selected-label">
                  {t("design_show_to_now")}
                </span>
                <span className="design-audience-count">
                  {selectedPeople.length}
                </span>
              </button>
              {peopleOpen ? (
                selectedPeople.length === 0 ? (
                  <p className="muted design-audience-empty">
                    {t("design_show_to_empty")}
                  </p>
                ) : (
                  <ul className="design-audience-chips">
                    {selectedPeople.map((person) => (
                      <li key={person.id}>
                        <span className="design-audience-chip">
                          <span className="design-audience-chip-text">
                            <strong>{person.name}</strong>
                            {person.meta ? (
                              <small>{person.meta}</small>
                            ) : null}
                          </span>
                          <button
                            type="button"
                            className="design-audience-chip-remove"
                            aria-label={t("design_show_to_remove").replace(
                              "{role}",
                              person.name,
                            )}
                            onClick={() =>
                              setVisiblePeople(
                                selectedPeople
                                  .filter((item) => item.id !== person.id)
                                  .map((item) => item.id),
                              )
                            }
                          >
                            ×
                          </button>
                        </span>
                      </li>
                    ))}
                  </ul>
                )
              ) : null}
            </div>
            <div className="design-audience-add">
              <label>
                {t("design_show_to_add")}
                <input
                  type="search"
                  value={personQuery}
                  onChange={(event) => setPersonQuery(event.target.value)}
                  placeholder={t("design_show_to_search")}
                />
              </label>
              {availablePeople.length > 0 ? (
                <label>
                  {t("design_show_to_pick")}
                  <select
                    value=""
                    onChange={(event) => {
                      const nextId = Number(event.target.value);
                      if (!Number.isFinite(nextId) || nextId <= 0) return;
                      setVisiblePeople([
                        ...selectedPeople.map((person) => person.id),
                        nextId,
                      ]);
                      setPersonQuery("");
                    }}
                  >
                    <option value="">{t("design_show_to_pick")}</option>
                    {availablePeople.slice(0, 80).map((person) => (
                      <option key={person.id} value={person.id}>
                        {person.meta
                          ? `${person.name} — ${person.meta}`
                          : person.name}
                      </option>
                    ))}
                  </select>
                </label>
              ) : (
                <p className="muted design-audience-empty">
                  {personQuery.trim()
                    ? t("design_show_to_no_matches")
                    : t("design_show_to_all_added")}
                </p>
              )}
            </div>
          </section>
        ) : null}
        <details className="design-role-pages">
          <summary>{t("design_role_home_pages")}</summary>
          <div className="design-roles" role="tablist">
            {ROLE_HOME_AUDIENCES.map((role) => (
              <button
                key={role}
                type="button"
                role="tab"
                aria-selected={pageKey === role}
                className={
                  pageKey === role ? "btn btn-primary" : "btn btn-ghost"
                }
                onClick={() => setPageKey(role)}
              >
                {t(ROLE_KEYS[role])}
              </button>
            ))}
          </div>
        </details>
      </div>

      <div className="design-toolbar">
        <button type="button" className="btn btn-ghost" onClick={addText}>
          {t("design_add_text")}
        </button>
        <button
          type="button"
          className="btn btn-ghost"
          disabled={busy === "upload"}
          onClick={() => requestMedia("image")}
        >
          {t("design_add_image")}
        </button>
        <button
          type="button"
          className="btn btn-ghost"
          disabled={busy === "upload"}
          onClick={() => requestMedia("video")}
        >
          {t("design_add_video")}
        </button>
        <div className="design-size-fields">
          <label>
            {t("design_canvas_width")}
            <input
              type="number"
              min={320}
              max={3840}
              step={10}
              value={doc.width}
              onChange={(event) =>
                updateDoc((current) => ({
                  ...current,
                  width: Math.max(320, Number(event.target.value) || 1280),
                }))
              }
            />
          </label>
          <span>×</span>
          <label>
            {t("design_canvas_height")}
            <input
              type="number"
              min={240}
              max={2160}
              step={10}
              value={doc.height}
              onChange={(event) =>
                updateDoc((current) => ({
                  ...current,
                  height: Math.max(240, Number(event.target.value) || 720),
                }))
              }
            />
          </label>
        </div>
        <label className="design-bg-field">
          {t("design_bg")}
          <input
            type="color"
            value={
              /^#[0-9a-fA-F]{6}$/.test(doc.background)
                ? doc.background
                : "#ffffff"
            }
            onChange={(event) =>
              updateDoc((current) => ({
                ...current,
                background: event.target.value,
              }))
            }
          />
        </label>
        <button
          type="button"
          className="btn btn-primary"
          disabled={busy === "save"}
          onClick={() => void save()}
        >
          {busy === "save" ? t("design_saving") : t("design_save")}
        </button>
      </div>

      <input
        ref={fileRef}
        className="work-profile-photo-input"
        type="file"
        onChange={(event) => {
          const file = event.target.files?.[0];
          void onFileChange(file);
        }}
      />

      {busy === "upload" ? (
        <p className="muted">{t("design_uploading")}</p>
      ) : null}
      {notice ? <p className="design-notice">{notice}</p> : null}
      {error ? <p className="design-error">{error}</p> : null}

      <div className="design-workspace">
        <RoleHomeCanvas
          document={doc}
          editable
          selectedId={selectedId}
          onSelect={setSelectedId}
          onPatchElement={patchElement}
        />

        <aside className="panel design-inspector">
          {!selected ? (
            <p className="muted">{t("design_no_selection")}</p>
          ) : (
            <div className="stack-form">
              <div className="design-geometry">
                {GEOMETRY_FIELDS.map((field) => (
                  <label key={field.key}>
                    {t(field.label)} (%)
                    <input
                      type="number"
                      min={field.min}
                      max={field.max}
                      step={0.5}
                      value={Math.round(selected[field.key] * 10) / 10}
                      onChange={(event) =>
                        patchElement(selected.id, {
                          [field.key]: Math.min(
                            field.max,
                            Math.max(
                              field.min,
                              Number(event.target.value) || 0,
                            ),
                          ),
                        })
                      }
                    />
                  </label>
                ))}
              </div>
              <p className="muted design-pixel-size">
                {t("design_pixel_size")}:{" "}
                {Math.round((selected.w / 100) * doc.width)} ×{" "}
                {Math.round((selected.h / 100) * doc.height)} px · X{" "}
                {Math.round((selected.x / 100) * doc.width)}, Y{" "}
                {Math.round((selected.y / 100) * doc.height)}
              </p>
              {selected.type === "text" ? (
                <>
                  <label>
                    {t("design_text_content")}
                    <textarea
                      rows={4}
                      value={selected.content}
                      onChange={(event) =>
                        patchElement(selected.id, {
                          content: event.target.value,
                        })
                      }
                    />
                  </label>
                  <label>
                    {t("design_font_size")}
                    <input
                      type="number"
                      min={8}
                      max={220}
                      value={selected.fontSize}
                      onChange={(event) =>
                        patchElement(selected.id, {
                          fontSize: Number(event.target.value) || 16,
                        })
                      }
                    />
                  </label>
                  <label>
                    {t("design_color")}
                    <input
                      type="color"
                      value={
                        /^#[0-9a-fA-F]{6}$/.test(selected.color)
                          ? selected.color
                          : "#1a1b2e"
                      }
                      onChange={(event) =>
                        patchElement(selected.id, {
                          color: event.target.value,
                        })
                      }
                    />
                  </label>
                  <label>
                    {t("design_font_weight")}
                    <select
                      value={selected.fontWeight}
                      onChange={(event) =>
                        patchElement(selected.id, {
                          fontWeight: Number(event.target.value),
                        })
                      }
                    >
                      <option value={400}>{t("design_weight_normal")}</option>
                      <option value={600}>{t("design_weight_semibold")}</option>
                      <option value={700}>{t("design_weight_bold")}</option>
                      <option value={800}>{t("design_weight_extra")}</option>
                    </select>
                  </label>
                  <label>
                    {t("design_align")}
                    <select
                      value={selected.align}
                      onChange={(event) =>
                        patchElement(selected.id, {
                          align: event.target.value as TextElement["align"],
                        })
                      }
                    >
                      <option value="left">{t("design_align_left")}</option>
                      <option value="center">{t("design_align_center")}</option>
                      <option value="right">{t("design_align_right")}</option>
                    </select>
                  </label>
                </>
              ) : selected.type === "video" ? (
                <>
                  <label>
                    {t("design_media_fit")}
                    <select
                      value={selected.fit}
                      onChange={(event) =>
                        patchElement(selected.id, {
                          fit: event.target.value as
                            | "cover"
                            | "contain"
                            | "fill",
                        })
                      }
                    >
                      <option value="cover">{t("design_fit_cover")}</option>
                      <option value="contain">{t("design_fit_contain")}</option>
                      <option value="fill">{t("design_fit_fill")}</option>
                    </select>
                  </label>
                  <label className="design-check">
                    <input
                      type="checkbox"
                      checked={selected.autoplay}
                      onChange={(event) =>
                        patchElement(selected.id, {
                          autoplay: event.target.checked,
                          muted: event.target.checked ? true : selected.muted,
                        })
                      }
                    />
                    {t("design_autoplay")}
                  </label>
                  <label className="design-check">
                    <input
                      type="checkbox"
                      checked={selected.loop}
                      onChange={(event) =>
                        patchElement(selected.id, {
                          loop: event.target.checked,
                        })
                      }
                    />
                    {t("design_loop")}
                  </label>
                </>
              ) : (
                <label>
                  {t("design_media_fit")}
                  <select
                    value={selected.fit}
                    onChange={(event) =>
                      patchElement(selected.id, {
                        fit: event.target.value as
                          | "cover"
                          | "contain"
                          | "fill",
                      })
                    }
                  >
                    <option value="cover">{t("design_fit_cover")}</option>
                    <option value="contain">{t("design_fit_contain")}</option>
                    <option value="fill">{t("design_fit_fill")}</option>
                  </select>
                </label>
              )}

              <div className="design-inspector-actions">
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={duplicateSelected}
                >
                  {t("design_duplicate")}
                </button>
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() => shiftLayer("front")}
                >
                  {t("design_forward")}
                </button>
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() => shiftLayer("back")}
                >
                  {t("design_back")}
                </button>
                <button
                  type="button"
                  className="btn btn-danger"
                  onClick={deleteSelected}
                >
                  {t("design_delete")}
                </button>
              </div>
            </div>
          )}
        </aside>
      </div>
    </AppShell>
  );
}
