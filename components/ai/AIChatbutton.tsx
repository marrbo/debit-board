"use client";

import { useState } from "react";
import { Bot } from "lucide-react";
import AIChatModal from "./AIChatModal";
import HeaderActions from "../PageHeader/HeaderActions";

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
      <HeaderActions
        tooltip={"Debit-Board AI"}
        color="brand"
        onClick={() => setOpen(true)}
        aria-haspopup="false"
        isActive={open}
      >
        <Bot className="w-5 h-5" />
      </HeaderActions>
      <AIChatModal
        isOpen={open}
        onClose={() => setOpen(false)}
        context={context}
        title={title}
      />
    </>
  );
}
