"use client";

import { Check, CircleDashed, Clock } from "lucide-react";
import type { OperationType } from "@/types/operation";

type OperationTimelineProps = {
  type?: OperationType;
  executing?: boolean;
  completed?: boolean;
};

export default function OperationTimeline({
  type = "general",
  executing = false,
  completed = false,
}: OperationTimelineProps) {
  const isSpotify = type === "spotify";

  const steps = isSpotify
    ? [
        {
          title: "Intent detected",
          description: "Kuro understands that the user wants a Spotify playlist.",
          status: "done",
        },
        {
          title: "Playlist planning",
          description: "Kuro prepares playlist mood, theme, duration, and song direction.",
          status: "done",
        },
        {
          title: "Approval layer",
          description: executing || completed
            ? "Human approval received. Spotify execution is allowed."
            : "Waiting for approval before creating anything in Spotify.",
          status: executing || completed ? "done" : "waiting",
        },
        {
          title: "Connecting Spotify",
          description: completed
            ? "Spotify connection completed."
            : executing
              ? "Connecting to the user's Spotify account."
              : "Kuro will connect only after approval.",
          status: completed ? "done" : executing ? "active" : "waiting",
        },
        {
          title: "Creating playlist",
          description: completed
            ? "Playlist created and tracks added."
            : executing
              ? "Searching tracks and building the playlist."
              : "Kuro will create the playlist safely after approval.",
          status: completed ? "done" : executing ? "active" : "waiting",
        },
      ]
    : [
        {
          title: "Intent detected",
          description: "Kuro understands what the user wants to accomplish.",
          status: "done",
        },
        {
          title: "Research Agent",
          description: executing
            ? "Research complete. Recommendations prepared."
            : "Searches live information and prepares recommendations.",
          status: executing || completed ? "done" : "active",
        },
        {
          title: "Approval Layer",
          description: executing || completed
            ? "Human approval received. Execution is allowed."
            : "Waits for human confirmation before taking action.",
          status: executing || completed ? "done" : "waiting",
        },
        {
          title: "Execution Agent",
          description: completed
            ? "Operation completed successfully."
            : executing
              ? "Executing the approved workflow safely."
              : "Executes only after approval.",
          status: completed ? "done" : executing ? "active" : "waiting",
        },
      ];

  return (
    <div className="mt-8 space-y-3">
      {steps.map((step) => (
        <div
          key={step.title}
          className="flex gap-4 rounded-3xl border border-white/10 bg-black/30 p-4"
        >
          <div className="mt-1">
            {step.status === "done" && (
              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-white text-black">
                <Check className="h-4 w-4" />
              </div>
            )}

            {step.status === "active" && (
              <div className="flex h-7 w-7 items-center justify-center rounded-full border border-white/30">
                <CircleDashed className="h-4 w-4 animate-spin text-white/70" />
              </div>
            )}

            {step.status === "waiting" && (
              <div className="flex h-7 w-7 items-center justify-center rounded-full border border-white/10">
                <Clock className="h-4 w-4 text-white/30" />
              </div>
            )}
          </div>

          <div>
            <p className="text-sm font-medium text-white/85">{step.title}</p>
            <p className="mt-1 text-xs leading-relaxed text-white/40">
              {step.description}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}