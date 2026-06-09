"use client";

import { useState } from "react";

type SpotifyPlaylistButtonProps = {
  prompt?: string;
  playlistName?: string;
};

export default function SpotifyPlaylistButton({
  prompt = "Create a playlist for my upcoming seminar",
  playlistName = "Kuro AI Playlist",
}: SpotifyPlaylistButtonProps) {
  const [loading, setLoading] = useState(false);
  const [playlistUrl, setPlaylistUrl] = useState("");
  const [error, setError] = useState("");

  async function handleCreatePlaylist() {
    setLoading(true);
    setError("");
    setPlaylistUrl("");

    try {
      const response = await fetch("/api/spotify/create-playlist", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          prompt,
          playlistName,
        }),
      });

      const data = await response.json();

      if (response.status === 401 && data.needsAuth && data.authUrl) {
        window.location.href = data.authUrl;
        return;
      }

      if (!response.ok || !data.success) {
        throw new Error(data.error || "Failed to create playlist.");
      }

      setPlaylistUrl(data.playlistUrl);
    } catch (error) {
      console.error(error);
      setError("Could not create the playlist. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-3">
      <button
        onClick={handleCreatePlaylist}
        disabled={loading}
        className="rounded-full bg-white px-5 py-3 text-sm font-semibold text-black transition hover:bg-white/90 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {loading ? "Creating playlist..." : "Approve and Create Spotify Playlist"}
      </button>

      {playlistUrl && (
        <a
          href={playlistUrl}
          target="_blank"
          rel="noreferrer"
          className="block text-sm font-medium text-green-300 underline"
        >
          Open playlist on Spotify
        </a>
      )}

      {error && <p className="text-sm text-red-300">{error}</p>}
    </div>
  );
}