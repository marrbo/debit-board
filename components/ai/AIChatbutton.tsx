"use client";

import { useState } from "react";
import { BotMessageSquare } from "lucide-react";
import AIChatModal from "./AIChatModal";

interface AIChatButtonProps {
  context?: string;
  title?: string;
}

export default function AIChatButton({
  context = "general",
  title = "Assistente IA",
}: AIChatButtonProps) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 group btn-ghost"
        title={title}
        aria-label={title}
      >
        <BotMessageSquare className="w-5 h-5" />
        <span className="hidden group-hover:inline whitespace-nowrap">
          Debit-Board AI
        </span>
      </button>
      <AIChatModal
        isOpen={open}
        onClose={() => setOpen(false)}
        context={context}
        title={title}
      />
    </>
  );
}
