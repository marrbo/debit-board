// hooks/useFeedback.ts
"use client";

import { useContext } from "react";
import {
  FeedbackContext,
  type FeedbackApi,
} from "@/components/feedback/FeedbackProvider";

export function useFeedback(): FeedbackApi {
  const ctx = useContext(FeedbackContext);
  if (!ctx) {
    throw new Error("useFeedback must be used inside <FeedbackProvider>");
  }
  return ctx;
}