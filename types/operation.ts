export type OperationType =
  | "spotify"
  | "playlist"
  | "trip"
  | "flight"
  | "research"
  | "calendar"
  | "general";

export type SpotifyDetails = {
  mood: string;
  estimatedTracks: string;
  estimatedDuration: string;
  source: string;
  playlistName: string;
  tracks: string[];
};

export type PlaylistDetails = {
  mood: string;
  duration: string;
  source: string;
  trackSeeds: string[];
  sources?: string[];
};

export type FlightDetails = {
  price: string;
  route: string;
  airline: string;
  departureTime: string;
  arrivalTime?: string;
  duration?: string;
  stops?: string;
  baggage?: string;
  cabinBag?: string;
  bookingNote?: string;
  tripUrl: string;
};

export type Recommendation = {
  id: string;
  kind?: string;
  title: string;
  subtitle?: string;
  description: string;
  metadata?: string | string[];
  tag?: string;
  tracks?: string[];
  spotifyDetails?: SpotifyDetails;
  playlistDetails?: PlaylistDetails;
  flightDetails?: FlightDetails;
};

export type Operation = {
  id?: string;
  type: OperationType;
  userPrompt: string;
  recommendations: Recommendation[];
};