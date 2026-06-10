"use client";

import type { Recommendation } from "@/types/operation";

type RecommendationGridProps = {
  recommendations: Recommendation[];
  selectedId: string | null;
  onSelect: (id: string) => void;
};

function metadataToText(metadata?: string | string[]) {
  if (!metadata) return "";
  if (Array.isArray(metadata)) return metadata.join(" · ");
  return metadata;
}

export default function RecommendationGrid({
  recommendations,
  selectedId,
  onSelect,
}: RecommendationGridProps) {
  return (
    <div className="space-y-4">
      {recommendations.map((item) => {
        const selected = selectedId === item.id;

        if (item.flightDetails) {
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onSelect(item.id)}
              className={`w-full overflow-hidden rounded-[1.75rem] border text-left transition ${
                selected
                  ? "border-white bg-white text-black"
                  : "border-white/10 bg-white/[0.04] text-white hover:border-white/30 hover:bg-white/[0.08]"
              }`}
            >
              <div className="flex items-stretch gap-4 p-5">
                <div className="flex min-w-[145px] items-center gap-3">
                  <div
                    className={`h-10 w-10 rounded-full ${
                      selected ? "bg-black/10" : "bg-white/10"
                    }`}
                  />
                  <div>
                    <p className="text-base font-semibold">
                      {item.flightDetails.airline}
                    </p>
                    <p
                      className={`mt-1 text-xs ${
                        selected ? "text-black/45" : "text-white/40"
                      }`}
                    >
                      {item.kind || item.tag || "Trip.com"}
                    </p>
                  </div>
                </div>

                <div className="grid flex-1 grid-cols-[1fr_90px_1fr] items-center gap-4">
                  <div className="text-center">
                    <p className="text-3xl font-bold">
                      {item.flightDetails.departureTime}
                    </p>
                    <p
                      className={`mt-1 text-sm ${
                        selected ? "text-black/55" : "text-white/45"
                      }`}
                    >
                      {item.flightDetails.departureTerminal ||
                        item.flightDetails.route.split("→")[0]?.trim()}
                    </p>
                  </div>

                  <div className="text-center">
                    <p
                      className={`text-sm ${
                        selected ? "text-black/45" : "text-white/40"
                      }`}
                    >
                      {item.flightDetails.duration}
                    </p>
                    <div
                      className={`my-2 h-px w-full ${
                        selected ? "bg-black/20" : "bg-white/20"
                      }`}
                    />
                    <p
                      className={`text-xs ${
                        selected ? "text-black/45" : "text-white/40"
                      }`}
                    >
                      {item.flightDetails.stops}
                    </p>
                  </div>

                  <div className="text-center">
                    <p className="text-3xl font-bold">
                      {item.flightDetails.arrivalTime}
                    </p>
                    <p
                      className={`mt-1 text-sm ${
                        selected ? "text-black/55" : "text-white/45"
                      }`}
                    >
                      {item.flightDetails.arrivalTerminal ||
                        item.flightDetails.route.split("→")[1]?.trim()}
                    </p>
                  </div>
                </div>

                <div className="flex min-w-[145px] flex-col items-end justify-center">
                  <p className="text-3xl font-bold text-blue-500">
                    {item.flightDetails.price}
                  </p>
                  <p
                    className={`mt-1 text-sm ${
                      selected ? "text-black/50" : "text-white/45"
                    }`}
                  >
                    {item.flightDetails.route}
                  </p>
                  <div
                    className={`mt-3 rounded-xl px-4 py-2 text-sm font-semibold ${
                      selected
                        ? "bg-blue-600 text-white"
                        : "bg-blue-600 text-white"
                    }`}
                  >
                    Select
                  </div>
                </div>
              </div>
            </button>
          );
        }

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
            <span
              className={`text-xs uppercase tracking-[0.22em] ${
                selected ? "text-black/45" : "text-white/35"
              }`}
            >
              {item.kind || item.tag || metadataToText(item.metadata)}
            </span>

            <h3 className="mt-3 text-lg font-semibold">{item.title}</h3>

            <p
              className={`mt-2 text-sm leading-relaxed ${
                selected ? "text-black/60" : "text-white/45"
              }`}
            >
              {item.spotifyDetails ? item.spotifyDetails.mood : item.subtitle}
            </p>

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