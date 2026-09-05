import { useRef, useState } from "react";
import ReactMarkdown from "react-markdown";

export default function MarkdownEditor() {
  const [markdown, setMarkdown] = useState("# Type your markdown here");
  const editorRef = useRef<HTMLTextAreaElement>(null);
  const previewRef = useRef<HTMLDivElement>(null);

  const handleScroll = (source: "editor" | "preview") => {
    const editor = editorRef.current;
    const preview = previewRef.current;
    if (!editor || !preview) return;

    if (source === "editor") {
      // Calculate how far the user has scrolled in the editor
      const percentage = editor.scrollTop / (editor.scrollHeight - editor.clientHeight);
      // Apply that exact percentage to the preview pane
      preview.scrollTop = percentage * (preview.scrollHeight - preview.clientHeight);
    } else {
      const percentage = preview.scrollTop / (preview.scrollHeight - preview.clientHeight);
      editor.scrollTop = percentage * (editor.scrollHeight - editor.clientHeight);
    }
  };

  return (
    <div style={{ display: "flex", height: "100vh", gap: "20px" }}>
      {/* Editor Pane */}
      <textarea
        ref={editorRef}
        value={markdown}
        onChange={(e) => setMarkdown(e.target.value)}
        onScroll={() => handleScroll("editor")}
        style={{ flex: 1, overflowY: "scroll", padding: "10px" }}
      />

      {/* Preview Pane */}
      <div
        ref={previewRef}
        onScroll={() => handleScroll("preview")}
        style={{ flex: 1, overflowY: "scroll", padding: "10px", border: "1px solid #ccc" }}
      >
        <ReactMarkdown>{markdown}</ReactMarkdown>
      </div>
    </div>
  );
}
