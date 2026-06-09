"use client";

import { motion } from "framer-motion";

type Props = {
  status?: "idle" | "thinking" | "executing";
  small?: boolean;
};

export default function KuroMascot({
  status = "idle",
  small = false,
}: Props) {
  return (
    <div className="flex flex-col items-center">
      <motion.img
        src="/mascot/kuro_waving.gif"
        alt="Kuro"
        className={
          small
            ? "h-44 w-44 object-contain"
            : "h-[360px] w-[360px] object-contain"
        }
        animate={{
          y: status === "thinking" ? [0, -8, 0] : [0, -4, 0],
        }}
        transition={{
          repeat: Infinity,
          duration: 2,
        }}
      />

      <div className="mt-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs text-white/50">
        {status}
      </div>
    </div>
  );
}