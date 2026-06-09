"use client";

import type { Recommendation } from "@/types/operation";

type RecommendationGridProps = {
  recommendations: Recommendation[];
  selectedId: string | null;
  onSelect: (id: string) => void;
};

export default function RecommendationGrid({
  recommendations,
  selectedId,
  onSelect,
}: RecommendationGridProps) {
  return (
    <div className="space-y-3">
      {recommendations.map((item) => {
        const selected = selectedId === item.id;
        const price = item.flightDetails?.price;

        return (
          <button
            key={item.id}
            type="button"
            onClick={() => onSelect(item.id)}
            className={`w-full rounded-3xl border p-5 text-left transition ${
              selected
                ? "border-white bg-white text-black"
                : "border-white/10 bg-white/[0.04] text-white hover:border-white/30 hover:bg-white/[0.08]"
            }`}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <span
                  className={`text-xs uppercase tracking-[0.22em] ${
                    selected ? "text-black/45" : "text-white/35"
                  }`}
                >
                  {item.metadata}
                </span>

                <h3 className="mt-3 text-lg font-semibold">{item.title}</h3>

                <p
                  className={`mt-2 text-sm leading-relaxed ${
                    selected ? "text-black/60" : "text-white/45"
                  }`}
                >
                  {item.flightDetails
                    ? `${item.flightDetails.airline} · ${item.flightDetails.departureTime}`
                    : item.spotifyDetails
                      ? item.spotifyDetails.mood
                      : item.subtitle}
                </p>
              </div>

              {price && (
                <div
                  className={`shrink-0 rounded-2xl px-4 py-3 text-right ${
                    selected ? "bg-black text-white" : "bg-white/10 text-white"
                  }`}
                >
                  <p className="text-[10px] uppercase tracking-[0.18em] opacity-50">
                    Price
                  </p>
                  <p className="mt-1 text-lg font-bold">{price}</p>
                </div>
              )}
            </div>

            {item.flightDetails && (
              <div
                className={`mt-4 grid gap-2 text-xs md:grid-cols-3 ${
                  selected ? "text-black/55" : "text-white/40"
                }`}
              >
                <p>Flight: {item.flightDetails.airline}</p>
                <p>Time: {item.flightDetails.departureTime}</p>
                <p>Source: Trip.com</p>
              </div>
            )}

            {item.spotifyDetails && (
              <div
                className={`mt-4 grid gap-2 text-xs md:grid-cols-3 ${
                  selected ? "text-black/55" : "text-white/40"
                }`}
              >
                <p>Tracks: {item.spotifyDetails.estimatedTracks}</p>
                <p>Duration: {item.spotifyDetails.estimatedDuration}</p>
                <p>Source: Spotify</p>
              </div>
            )}
          </button>
        );
      })}
    </div>
  );
}