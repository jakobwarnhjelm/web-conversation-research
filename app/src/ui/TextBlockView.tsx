import { useEffect, useRef, useState } from "react";
import type { TextBlock } from "@tabflow/domain";
import { useServices } from "../state/services";
import { renderMarkdown } from "../lib/markdown";
import { BlockChrome } from "./BlockChrome";

/**
 * Textblock (F-TXT). Renderat läge som standard; klick → redigera; blur/Esc → rendera
 * (F-TXT-2). Cmd/Ctrl+Enter renderar också.
 */
export function TextBlockView({
  block,
  isFirst,
  isLast,
}: {
  block: TextBlock;
  isFirst: boolean;
  isLast: boolean;
}) {
  const { actions } = useServices();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(block.markdown);
  const taRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (editing) {
      setDraft(block.markdown);
      taRef.current?.focus();
    }
    // Öppna nyskapade tomma textblock direkt i redigeringsläge.
  }, [editing, block.markdown]);

  function commit() {
    if (draft !== block.markdown) actions.updateMarkdown(block.id, draft);
    setEditing(false);
  }

  return (
    <div className="block text-block">
      <div className="block-head">
        <span className="block-kind">Text</span>
        <BlockChrome block={block} isFirst={isFirst} isLast={isLast} />
      </div>
      {block.collapsed ? (
        <div className="collapsed-hint">…kollapsad text</div>
      ) : editing ? (
        <textarea
          ref={taRef}
          className="text-editor"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Escape") commit();
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) commit();
          }}
          placeholder="Skriv Markdown…"
        />
      ) : (
        <div
          className="markdown-body"
          onClick={() => setEditing(true)}
          dangerouslySetInnerHTML={{
            __html: block.markdown.trim()
              ? renderMarkdown(block.markdown)
              : "<p class='empty'>Tomt textblock — klicka för att skriva</p>",
          }}
        />
      )}
    </div>
  );
}
