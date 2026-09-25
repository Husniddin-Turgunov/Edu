"use client";

import Image from "next/image";
import Link from "next/link";
import { useRef, useState } from "react";
import { AppShell, PageHeader, type AppShellRole } from "@/components/ui";
import { updateOwnProfileAction, submitMentorRatingAction } from "@/db/actions";
import { useI18n, type MessageKey } from "@/lib/i18n";
import { localizeStaffText } from "@/lib/staff-localization";

type Profile = {
  name: string;
  login: string;
  password: string;
  role: string;
  participantKind?: string | null;
  jobTitle: string;
  department: string;
  avatarData: string | null;
  avatarHue: number;
  isActive: boolean;
};

function accountTypeKey(
  role: string,
  participantKind?: string | null,
): MessageKey {
  if (role === "manager") return "role_manager";
  if (role === "observer") return "role_observer";
  if (role === "admin") return "role_admin";
  if (participantKind === "employee") return "role_employee";
  if (participantKind === "intern") return "role_intern";
  if (participantKind === "candidate") return "role_candidate";
  return "role_participant";
}

function shellForProfile(profile: Profile): {
  role: AppShellRole;
  pathname: string;
} {
  if (profile.role === "manager") {
    return { role: "manager", pathname: "/observer/profile" };
  }
  if (profile.role === "observer") {
    return { role: "observer", pathname: "/observer/profile" };
  }
  if (profile.participantKind === "intern") {
    return { role: "intern", pathname: "/my/profile" };
  }
  return { role: "employee", pathname: "/my/profile" };
}

export function WorkProfileView({
  profile,
  saved,
  mentorRating,
  managerName,
  mentorName,
}: {
  profile: Profile;
  saved: boolean;
  mentorRating?: {
    mentorUserId: number;
    mentorName: string;
    currentScore: number | null;
  } | null;
  managerName?: string | null;
  mentorName?: string | null;
}) {
  const { t, locale } = useI18n();
  const photoInputRef = useRef<HTMLInputElement>(null);
  const [editing, setEditing] = useState(false);
  const [photoPreview, setPhotoPreview] = useState(profile.avatarData);
  const [hue, setHue] = useState(profile.avatarHue);
  const [removePhoto, setRemovePhoto] = useState(false);

  const initials = profile.name
    .split(" ")
    .map((part) => part[0])
    .slice(0, 2)
    .join("");

  const shell = shellForProfile(profile);
  const liveHue = editing ? hue : profile.avatarHue;

  return (
    <AppShell pathname={shell.pathname} role={shell.role} themeHue={liveHue}>
      <PageHeader
        title={t("nav_profile")}
        action={
          <button
            type="button"
            className={
              editing
                ? "profile-gear-btn profile-gear-btn-active"
                : "profile-gear-btn"
            }
            aria-label={t("profile_edit")}
            title={t("profile_edit")}
            onClick={() => {
              setEditing((value) => !value);
              if (editing) {
                setPhotoPreview(profile.avatarData);
                setHue(profile.avatarHue);
                setRemovePhoto(false);
              }
            }}
          >
            <Image
              src="/profile-gear.png"
              alt=""
              width={22}
              height={22}
              className="profile-gear-icon"
              unoptimized
            />
          </button>
        }
      />

      {saved ? (
        <div className="profile-saved-notice">{t("profile_updated")}</div>
      ) : null}

      {!editing ? (
        <section className="panel work-profile">
          <div className="work-profile-summary">
            <div className="work-profile-avatar">
              {profile.avatarData ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={profile.avatarData} alt={profile.name} />
              ) : (
                <span>{initials}</span>
              )}
            </div>
            <div>
              <p className="work-profile-kicker">{t("profile_basic_info")}</p>
              <h2>{profile.name}</h2>
              <p>{profile.jobTitle}</p>
              <span className="work-profile-status">
                <i aria-hidden="true" />
                {profile.isActive
                  ? t("profile_status_active")
                  : t("portal_disabled")}
              </span>
            </div>
          </div>

          <dl className="work-profile-details">
            <div>
              <dt>{t("full_name")}</dt>
              <dd>{profile.name}</dd>
            </div>
            <div>
              <dt>{t("profile_job_title")}</dt>
              <dd>{profile.jobTitle}</dd>
            </div>
            <div>
              <dt>{t("profile_department")}</dt>
              <dd>{profile.department}</dd>
            </div>
            <div>
              <dt>{t("col_status")}</dt>
              <dd className="work-profile-status">
                <i aria-hidden="true" />
                {profile.isActive
                  ? t("profile_status_active")
                  : t("portal_disabled")}
              </dd>
            </div>
          </dl>

          {(managerName || mentorName) ? (
            <section className="layout-2" style={{ marginTop: 4 }}>
              <article className="panel">
                <h2 style={{ marginTop: 0 }}>{t("eh_start_manager")}</h2>
                <p>
                  <strong>
                    {managerName
                      ? localizeStaffText(managerName, locale, "name")
                      : t("eh_start_unknown")}
                  </strong>
                </p>
                <Link href="/my/mentor" className="btn btn-ghost">
                  {t("eh_mentor_contact")}
                </Link>
              </article>
              <article className="panel">
                <h2 style={{ marginTop: 0 }}>{t("eh_start_mentor")}</h2>
                <p>
                  <strong>
                    {mentorName
                      ? localizeStaffText(mentorName, locale, "name")
                      : t("eh_start_unknown")}
                  </strong>
                </p>
                <Link href="/my/mentor" className="btn btn-primary">
                  {t("eh_mentor_contact")}
                </Link>
              </article>
            </section>
          ) : null}
        </section>
      ) : (
        <section className="panel work-profile work-profile-editor">
          <form action={updateOwnProfileAction} className="stack-form">
            <div className="work-profile-summary">
              <div>
                <button
                  type="button"
                  className="work-profile-avatar work-profile-avatar-button"
                  onClick={() => photoInputRef.current?.click()}
                  title={t("profile_photo_click")}
                  aria-label={t("profile_photo_click")}
                >
                  {photoPreview && !removePhoto ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={photoPreview} alt={profile.name} />
                  ) : (
                    <span>{initials}</span>
                  )}
                </button>
                <p className="muted work-profile-avatar-hint">
                  {t("profile_photo_click")}
                </p>
                <input
                  ref={photoInputRef}
                  className="work-profile-photo-input"
                  name="photo"
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file) {
                      setRemovePhoto(false);
                      setPhotoPreview(URL.createObjectURL(file));
                    }
                  }}
                />
              </div>
              <div>
                <p className="work-profile-kicker">{t("profile_edit")}</p>
                <h2>{t("profile_editor_title")}</h2>
                <p className="muted">{t("profile_editor_note")}</p>
              </div>
            </div>

            <div className="work-profile-form-grid">
              <label>
                {t("full_name")}
                <input
                  name="displayName"
                  defaultValue={profile.name}
                  required
                />
              </label>
              <label>
                {t("profile_job_title")}
                <input
                  name="profileJobTitle"
                  defaultValue={profile.jobTitle}
                  required
                />
              </label>
              <label>
                {t("profile_department")}
                <input
                  name="profileDepartment"
                  defaultValue={profile.department}
                  required
                />
              </label>
              {/* Keep login for backend validation, but don't show it to the user. */}
              <input type="hidden" name="login" defaultValue={profile.login} />
              {/* Password is optional: when omitted/empty, it's not updated. */}
              <label>
                {t("profile_color")}
                <input
                  name="avatarHue"
                  type="range"
                  min={0}
                  max={359}
                  value={hue}
                  onChange={(event) => setHue(Number(event.target.value))}
                />
                <span className="field-hint">
                  {t("profile_color")}: {hue}°
                </span>
              </label>
            </div>

            {(profile.avatarData || photoPreview) && (
              <label className="profile-remove-photo">
                <input
                  type="checkbox"
                  name="removePhoto"
                  value="1"
                  checked={removePhoto}
                  onChange={(event) => {
                    setRemovePhoto(event.target.checked);
                    if (event.target.checked) {
                      setPhotoPreview(null);
                      if (photoInputRef.current) photoInputRef.current.value = "";
                    } else {
                      setPhotoPreview(profile.avatarData);
                    }
                  }}
                />
                {t("profile_remove_photo")}
              </label>
            )}

            <div className="work-profile-actions">
              <button type="submit" className="btn btn-primary">
                {t("profile_save")}
              </button>
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => {
                  setEditing(false);
                  setPhotoPreview(profile.avatarData);
                  setHue(profile.avatarHue);
                  setRemovePhoto(false);
                  if (photoInputRef.current) photoInputRef.current.value = "";
                }}
              >
                {t("profile_cancel")}
              </button>
            </div>
          </form>
        </section>
      )}

      {mentorRating ? (
        <section className="panel" style={{ marginTop: 16, maxWidth: 720 }}>
          <h2>
            {locale === "uz"
              ? "Mentorni baholash"
              : locale === "en"
                ? "Rate your mentor"
                : "Оценка наставника"}
          </h2>
          <p className="muted">{mentorRating.mentorName}</p>
          <form action={submitMentorRatingAction} className="stack-form">
            <input
              type="hidden"
              name="mentorUserId"
              value={mentorRating.mentorUserId}
            />
            <label>
              {locale === "uz" ? "Bahosi" : locale === "en" ? "Score" : "Оценка"}
              <select
                name="score"
                defaultValue={String(mentorRating.currentScore ?? 5)}
              >
                {[5, 4, 3, 2, 1].map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </select>
            </label>
            <label>
              {locale === "uz"
                ? "Izoh"
                : locale === "en"
                  ? "Comment"
                  : "Комментарий"}
              <textarea name="comment" rows={2} />
            </label>
            <button type="submit" className="btn btn-primary">
              {locale === "uz"
                ? "Yuborish"
                : locale === "en"
                  ? "Submit"
                  : "Отправить"}
            </button>
          </form>
        </section>
      ) : null}
    </AppShell>
  );
}

/** @deprecated use WorkProfileView */
export function ObserverProfileView(props: {
  profile: Profile;
  saved: boolean;
}) {
  return <WorkProfileView {...props} />;
}
