export type OperationType = "flight" | "spotify" | "research" | "calendar" | "general";

export type RecommendationKind = "flight" | "spotify" | "standard";

export type FlightDetails = {
  route: string;
  airline: string;
  departureTime: string;
  arrivalTime: string;
  duration: string;
  stops: string;
  price: string;
  baggage: string;
  cabinBag: string;
  bookingNote: string;
  tripUrl: string;
};

export type SpotifyDetails = {
  mood: string;
  estimatedTracks: string;
  estimatedDuration: string;
  source: string;
  playlistName: string;
  tracks: string[];
};

export type Recommendation = {
  id: string;
  kind: RecommendationKind;
  title: string;
  subtitle: string;
  description: string;
  metadata: string;
  flightDetails?: FlightDetails;
  spotifyDetails?: SpotifyDetails;
  sourceUrl?: string;
};

export type Operation = {
  type: OperationType;
  userPrompt: string;
  recommendations: Recommendation[];
};