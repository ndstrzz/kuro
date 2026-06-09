"use client";

import { ShieldCheck } from "lucide-react";

type ApprovalPanelProps = {
  selected: boolean;
  executing: boolean;
  onApprove: () => void;
};

export default function ApprovalPanel({
  selected,
  executing,
  onApprove,
}: ApprovalPanelProps) {
  return (
    <div className="mt-6 rounded-3xl border border-white/10 bg-black/35 p-5">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white text-black">
          <ShieldCheck className="h-5 w-5" />
        </div>

        <div className="flex-1">
          <p className="text-sm font-semibold text-white">Approval required</p>
          <p className="mt-1 text-xs leading-relaxed text-white/40">
            Kuro will not book, purchase, send, or submit anything until you approve.
          </p>
        </div>
      </div>

      <button
        disabled={!selected || executing}
        onClick={onApprove}
        className="mt-5 w-full rounded-full bg-white px-5 py-3 text-sm font-semibold text-black transition hover:scale-[1.01] disabled:cursor-not-allowed disabled:bg-white/20 disabled:text-white/35"
      >
        {executing ? "Executing..." : selected ? "Approve & Execute" : "Select an option first"}
      </button>
    </div>
  );
}