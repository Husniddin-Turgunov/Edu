"use client";

import { ExpandOnClick } from "@/components/ExpandOnClick";
import { RoleHomeCanvas } from "@/components/visual-editor/RoleHomeCanvas";
import { useI18n } from "@/lib/i18n";
import type { RoleHomeDocument } from "@/lib/role-home";

export function DeferredCanvas({
  document,
  className,
}: {
  document: RoleHomeDocument;
  className?: string;
}) {
  const { t } = useI18n();
  return (
    <ExpandOnClick hint={t("eh_visual_hint")} action={t("eh_visual_show")}>
      <RoleHomeCanvas document={document} className={className} />
    </ExpandOnClick>
  );
}
