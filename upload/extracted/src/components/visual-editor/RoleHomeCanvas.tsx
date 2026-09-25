"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import type {
  PageElement,
  RoleHomeDocument,
} from "@/lib/role-home";

const HANDLES = ["nw", "ne", "sw", "se"] as const;
type Handle = (typeof HANDLES)[number];

type DragState = {
  id: string;
  mode: "move" | Handle;
  startX: number;
  startY: number;
  orig: Pick<PageElement, "x" | "y" | "w" | "h">;
};

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function patchGeometry(
  orig: DragState["orig"],
  mode: DragState["mode"],
  dx: number,
  dy: number,
): Pick<PageElement, "x" | "y" | "w" | "h"> {
  if (mode === "move") {
    return {
      x: clamp(orig.x + dx, -20, 95),
      y: clamp(orig.y + dy, -20, 95),
      w: orig.w,
      h: orig.h,
    };
  }

  let { x, y, w, h } = orig;
  if (mode.includes("e")) w = orig.w + dx;
  if (mode.includes("s")) h = orig.h + dy;
  if (mode.includes("w")) {
    x = orig.x + dx;
    w = orig.w - dx;
  }
  if (mode.includes("n")) {
    y = orig.y + dy;
    h = orig.h - dy;
  }

  w = clamp(w, 4, 100);
  h = clamp(h, 4, 100);
  if (mode.includes("w")) x = orig.x + orig.w - w;
  if (mode.includes("n")) y = orig.y + orig.h - h;

  return {
    x: clamp(x, -20, 96),
    y: clamp(y, -20, 96),
    w,
    h,
  };
}

function ElementInner({
  element,
  interactive,
}: {
  element: PageElement;
  interactive: boolean;
}) {
  if (element.type === "text") {
    return (
      <div
        className="role-home-text"
        style={{
          fontSize: `${element.fontSize}px`,
          color: element.color,
          fontWeight: element.fontWeight,
          textAlign: element.align,
        }}
      >
        {element.content}
      </div>
    );
  }

  if (element.type === "image") {
    // eslint-disable-next-line @next/next/no-img-element
    return element.src ? (
      <img
        src={element.src}
        alt={element.alt || ""}
        draggable={false}
        style={{ objectFit: element.fit }}
      />
    ) : (
      <div className="role-home-placeholder">IMG</div>
    );
  }

  return element.src ? (
    <video
      src={element.src}
      controls={interactive}
      autoPlay={interactive && element.autoplay}
      muted={element.muted || element.autoplay}
      loop={element.loop}
      playsInline
      style={{ objectFit: element.fit }}
    />
  ) : (
    <div className="role-home-placeholder">VIDEO</div>
  );
}

export function RoleHomeCanvas({
  document,
  className,
  editable = false,
  selectedId = null,
  onSelect,
  onPatchElement,
}: {
  document: RoleHomeDocument;
  className?: string;
  editable?: boolean;
  selectedId?: string | null;
  onSelect?: (id: string | null) => void;
  onPatchElement?: (id: string, patch: Partial<PageElement>) => void;
}) {
  const boardRef = useRef<HTMLDivElement>(null);
  const [drag, setDrag] = useState<DragState | null>(null);
  const onPatchRef = useRef(onPatchElement);
  onPatchRef.current = onPatchElement;

  const finishDrag = useCallback(() => setDrag(null), []);

  useEffect(() => {
    if (!drag) return;
    const onMove = (event: PointerEvent) => {
      const board = boardRef.current;
      if (!board) return;
      const rect = board.getBoundingClientRect();
      const dx = ((event.clientX - drag.startX) / rect.width) * 100;
      const dy = ((event.clientY - drag.startY) / rect.height) * 100;
      onPatchRef.current?.(
        drag.id,
        patchGeometry(drag.orig, drag.mode, dx, dy),
      );
    };
    const onUp = () => finishDrag();
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };
  }, [drag, finishDrag]);

  const startDrag = (
    event: ReactPointerEvent,
    element: PageElement,
    mode: DragState["mode"],
  ) => {
    if (!editable) return;
    event.preventDefault();
    event.stopPropagation();
    onSelect?.(element.id);
    setDrag({
      id: element.id,
      mode,
      startX: event.clientX,
      startY: event.clientY,
      orig: { x: element.x, y: element.y, w: element.w, h: element.h },
    });
  };

  const sorted = [...document.elements].sort((a, b) => a.z - b.z);

  return (
    <div
      ref={boardRef}
      className={["role-home-artboard", className].filter(Boolean).join(" ")}
      style={{
        background: document.background || "#ffffff",
        aspectRatio: `${document.width} / ${document.height}`,
      }}
      onPointerDown={() => {
        if (editable) onSelect?.(null);
      }}
    >
      {sorted.map((element) => {
        const selected = editable && selectedId === element.id;
        return (
          <div
            key={element.id}
            className={
              selected ? "role-home-el role-home-el-selected" : "role-home-el"
            }
            style={{
              left: `${element.x}%`,
              top: `${element.y}%`,
              width: `${element.w}%`,
              height: `${element.h}%`,
              zIndex: element.z,
            }}
            onPointerDown={(event) => startDrag(event, element, "move")}
          >
            <ElementInner element={element} interactive={!editable} />
            {selected
              ? HANDLES.map((handle) => (
                  <button
                    key={handle}
                    type="button"
                    className={`role-home-handle role-home-handle-${handle}`}
                    aria-label={handle}
                    onPointerDown={(event) =>
                      startDrag(event, element, handle)
                    }
                  />
                ))
              : null}
          </div>
        );
      })}
    </div>
  );
}
