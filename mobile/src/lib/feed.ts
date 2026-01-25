// mobile/src/lib/feed.ts

import { apiJson, apiFetch } from "./api";
import type {
  FeedResponse,
  FeedPost,
  FeedComment,
  CommentsResponse,
  Circle,
  CirclesResponse,
  CreatePostPayload,
  TmdbSearchResult,
  TmdbSearchResponse,
  FeedScope,
  FeedSort,
  ServiceTag,
  CurrentUser,
  StreamingService,
} from "../types/feed";

// ============================================================
// FEED OPERATIONS
// ============================================================

export async function fetchFeed(params: {
  scope?: FeedScope;
  sort?: FeedSort;
  service?: string;
  cursor?: string;
  limit?: number;
}): Promise<FeedResponse> {
  const {
    scope = "all",
    sort = "smart",
    service,
    cursor,
    limit = 20,
  } = params;

  const queryParams = new URLSearchParams({
    scope,
    sort,
    limit: limit.toString(),
  });

  if (service && service !== "All services") {
    queryParams.append("service", service);
  }

  if (cursor) {
    queryParams.append("cursor", cursor);
  }

  return apiJson<FeedResponse>(`/feed?${queryParams.toString()}`);
}

// ============================================================
// POST OPERATIONS
// ============================================================

export async function createPost(
  payload: CreatePostPayload
): Promise<FeedPost> {
  return apiJson<FeedPost>("/posts", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function deletePost(postId: string): Promise<void> {
  await apiFetch(`/posts/${postId}`, {
    method: "DELETE",
  });
}

export async function likePost(postId: string): Promise<{ liked: boolean }> {
  return apiJson<{ liked: boolean }>(`/posts/${postId}/like`, {
    method: "POST",
  });
}

export async function unlikePost(postId: string): Promise<{ liked: boolean }> {
  return apiJson<{ liked: boolean }>(`/posts/${postId}/like`, {
    method: "DELETE",
  });
}

// ============================================================
// COMMENT OPERATIONS
// ============================================================

export async function fetchComments(
  postId: string,
  limit = 50
): Promise<FeedComment[]> {
  const response = await apiJson<any>(
    `/posts/${postId}/comments?limit=${limit}`
  );
  const items = response.items || [];

  // Transform backend response (_id -> id)
  return items.map((item: any) => ({
    id: String(item._id || item.id),
    userId: String(item.userId),
    text: item.text,
    createdAt: item.createdAt,
  }));
}

export async function addComment(
  postId: string,
  text: string
): Promise<{ id: string; createdAt: string }> {
  // Backend only returns { id, createdAt }
  return apiJson<{ id: string; createdAt: string }>(`/posts/${postId}/comments`, {
    method: "POST",
    body: JSON.stringify({ text }),
  });
}

export async function deleteComment(
  postId: string,
  commentId: string
): Promise<void> {
  await apiFetch(`/posts/${postId}/comments/${commentId}`, {
    method: "DELETE",
  });
}

// ============================================================
// TMDB SEARCH
// ============================================================

export async function searchTMDB(
  query: string,
  page = 1
): Promise<TmdbSearchResult[]> {
  if (!query.trim()) {
    return [];
  }

  const queryParams = new URLSearchParams({
    query: query.trim(),
    page: page.toString(),
  });

  const response = await apiJson<TmdbSearchResponse>(
    `/tmdb/search?${queryParams.toString()}`
  );

  return response.results || [];
}

// ============================================================
// CIRCLES
// ============================================================

export async function fetchCircles(): Promise<Circle[]> {
  const response = await apiJson<CirclesResponse>("/circles");
  return response.items || [];
}

export async function fetchMyCircles(page = 1, limit = 20): Promise<CirclesResponse> {
  const queryParams = new URLSearchParams({
    page: page.toString(),
    limit: limit.toString(),
  });
  return apiJson<CirclesResponse>(`/circles?${queryParams.toString()}`);
}

export async function fetchDiscoverCircles(page = 1, limit = 20, query?: string): Promise<CirclesResponse> {
  const queryParams = new URLSearchParams({
    page: page.toString(),
    limit: limit.toString(),
  });
  if (query) queryParams.append("q", query);
  return apiJson<CirclesResponse>(`/circles/discover/list?${queryParams.toString()}`);
}

export async function fetchCircleInvitations(): Promise<any> {
  return apiJson<any>("/circles/invitations/me");
}

export async function createCircle(data: {
  name: string;
  description?: string;
  visibility?: "public" | "private";
  avatarUrl?: string;
}): Promise<{ id: string }> {
  return apiJson<{ id: string }>("/circles", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function joinCircle(circleId: string, inviteCode?: string): Promise<{ ok: boolean }> {
  return apiJson<{ ok: boolean }>(`/circles/${circleId}/join`, {
    method: "POST",
    body: JSON.stringify({ inviteCode }),
  });
}

export async function leaveCircle(circleId: string): Promise<{ ok: boolean; deleted?: boolean }> {
  return apiJson<{ ok: boolean; deleted?: boolean }>(`/circles/${circleId}/leave`, {
    method: "POST",
  });
}

export async function fetchCircleDetails(circleId: string): Promise<Circle> {
  return apiJson<Circle>(`/circles/${circleId}`);
}

export async function fetchCircleMembers(circleId: string, page = 1, limit = 50): Promise<any> {
  const queryParams = new URLSearchParams({
    page: page.toString(),
    limit: limit.toString(),
  });
  return apiJson<any>(`/circles/${circleId}/members?${queryParams.toString()}`);
}

export async function inviteToCircle(circleId: string, usernameOrEmail: string): Promise<any> {
  return apiJson<any>(`/circles/${circleId}/invite`, {
    method: "POST",
    body: JSON.stringify({ usernameOrEmail }),
  });
}

export async function acceptInvite(circleId: string): Promise<{ message: string }> {
  return apiJson<{ message: string }>(`/circles/${circleId}/invite/accept`, {
    method: "POST",
  });
}

export async function declineInvite(circleId: string): Promise<{ message: string }> {
  return apiJson<{ message: string }>(`/circles/${circleId}/invite/decline`, {
    method: "POST",
  });
}

export async function removeCircleMember(circleId: string, userId: string): Promise<void> {
  await apiFetch(`/circles/${circleId}/members/${userId}`, {
    method: "DELETE",
  });
}

export async function promoteToModerator(circleId: string, userId: string): Promise<any> {
  return apiJson<any>(`/circles/${circleId}/mods/${userId}`, {
    method: "POST",
  });
}

export async function demoteModerator(circleId: string, userId: string): Promise<any> {
  return apiJson<any>(`/circles/${circleId}/mods/${userId}`, {
    method: "DELETE",
  });
}

export async function updateCircle(circleId: string, updates: {
  name?: string;
  description?: string;
  visibility?: "public" | "private";
}): Promise<Circle> {
  return apiJson<Circle>(`/circles/${circleId}`, {
    method: "PATCH",
    body: JSON.stringify(updates),
  });
}

export async function deleteCircle(circleId: string): Promise<void> {
  await apiFetch(`/circles/${circleId}`, {
    method: "DELETE",
  });
}

export async function fetchCirclePosts(circleId: string, page = 1, limit = 20): Promise<any> {
  const queryParams = new URLSearchParams({
    page: page.toString(),
    limit: limit.toString(),
  });
  return apiJson<any>(`/posts/circle/${circleId}?${queryParams.toString()}`);
}

export async function removePostFromCircle(postId: string, circleId: string): Promise<void> {
  await apiFetch(`/posts/${postId}/circles/${circleId}`, {
    method: "DELETE",
  });
}

// ============================================================
// USER
// ============================================================

export async function fetchCurrentUser(): Promise<CurrentUser> {
  const response = await apiJson<any>("/me");

  // Transform backend response (_id -> id)
  return {
    id: String(response._id || response.id),
    name: response.name,
    email: response.email,
    username: response.username,
    avatarUrl: response.avatarUrl,
    publicCircleShowcaseIds: response.publicCircleShowcaseIds || [],
  };
}

// ============================================================
// STREAMING SERVICES
// ============================================================

// Curated whitelist of mainstream streaming services base names
// This filters out obscure "Amazon Channel" services and niche platforms
const ALLOWED_SERVICE_BASE_NAMES = [
  // Top 7 mainstream household names (default popular in UI)
  "Netflix",
  "Hulu",
  "Prime Video",
  "Disney+",
  "Max",
  "Apple TV+",
  "Paramount+",
  // Secondary tier (searchable only - appear when user searches/selects)
  "Peacock",
  "YouTube",
  "Showtime",
  "Starz",
  "AMC+",
  "Crunchyroll",
  "Discovery+",
  "ESPN+",
  "BET+",
  "Cinemax",
  "MUBI",
  "Shudder",
  "Tubi",
  "Pluto TV",
];

// Normalize service names to base names (remove modifiers)
function normalizeServiceName(name: string): string {
  let normalized = name;

  // Remove common modifiers (but preserve + in names like Disney+, Apple TV+)
  const modifiers = [
    " with Ads",
    " with ads",
    " Ad-Supported",
    " Premium",
    " Package",
    " Subscription",
    " Plan",
    " (with Ads)",
    " (Ad-Supported)",
    " Amazon Channel",
  ];

  modifiers.forEach((modifier) => {
    normalized = normalized.replace(new RegExp(modifier, "gi"), "");
  });

  // Remove "Plus" only if it's not part of the core brand (Disney+, Apple TV+, etc.)
  // But remove "Hulu Plus", "Peacock Plus", etc.
  if (!normalized.includes("+")) {
    normalized = normalized.replace(/ Plus$/i, "");
  }

  // Clean up extra spaces and trim
  normalized = normalized.replace(/\s+/g, " ").trim();

  return normalized;
}

// Get base service name for matching
function getBaseServiceName(name: string): string {
  const normalized = normalizeServiceName(name);

  // Map common variations to base names
  const mappings: Record<string, string> = {
    "Amazon Prime Video": "Prime Video",
    "Prime": "Prime Video",
    "Disney Plus": "Disney+",
    "HBO Max": "Max",
    "Apple TV": "Apple TV+",
    "Paramount": "Paramount+",
    "YouTube TV": "YouTube",
    "YouTube Premium": "YouTube",
    "AMC": "AMC+",
    "ESPN": "ESPN+",
  };

  // Check if normalized name matches any mapping
  for (const [variant, baseName] of Object.entries(mappings)) {
    if (normalized.toLowerCase() === variant.toLowerCase() ||
        normalized.toLowerCase().includes(variant.toLowerCase())) {
      return baseName;
    }
  }

  return normalized;
}

// Filter function to remove unwanted services and normalize names
function filterMainstreamServices(services: StreamingService[]): StreamingService[] {
  const filtered: StreamingService[] = [];
  const seen = new Set<string>();

  for (const service of services) {
    const name = service.name || "";

    // Exclude Amazon Channel services (e.g., "Showtime Amazon Channel")
    if (name.includes("Amazon Channel")) {
      continue;
    }

    // Get base name
    const baseName = getBaseServiceName(name);

    // Check if base name is in allowed list
    const isAllowed = ALLOWED_SERVICE_BASE_NAMES.some((allowedName) =>
      baseName.toLowerCase() === allowedName.toLowerCase()
    );

    if (!isAllowed) {
      continue;
    }

    // Deduplicate - only keep first occurrence of each base name
    if (seen.has(baseName.toLowerCase())) {
      continue;
    }

    seen.add(baseName.toLowerCase());

    // Return service with normalized name
    filtered.push({
      ...service,
      name: baseName,
    });
  }

  return filtered;
}

// Fallback mock data for streaming services
// Top 7 mainstream household names - these are the default "popular" services shown in UI
const MOCK_STREAMING_SERVICES: StreamingService[] = [
  { _id: "netflix", name: "Netflix", displayPriority: 107 },
  { _id: "hulu", name: "Hulu", displayPriority: 106 },
  { _id: "disney", name: "Disney+", displayPriority: 105 },
  { _id: "prime", name: "Prime Video", displayPriority: 104 },
  { _id: "max", name: "Max", displayPriority: 103 },
  { _id: "appletv", name: "Apple TV+", displayPriority: 102 },
  { _id: "paramount", name: "Paramount+", displayPriority: 101 },
  // Secondary tier (searchable only - users can find and add these)
  { _id: "peacock", name: "Peacock", displayPriority: 20 },
  { _id: "youtube", name: "YouTube", displayPriority: 19 },
  { _id: "showtime", name: "Showtime", displayPriority: 18 },
  { _id: "starz", name: "Starz", displayPriority: 17 },
  { _id: "amc", name: "AMC+", displayPriority: 16 },
  { _id: "crunchyroll", name: "Crunchyroll", displayPriority: 15 },
  { _id: "discovery", name: "Discovery+", displayPriority: 14 },
  { _id: "espn", name: "ESPN+", displayPriority: 13 },
  { _id: "bet", name: "BET+", displayPriority: 12 },
  { _id: "cinemax", name: "Cinemax", displayPriority: 11 },
  { _id: "mubi", name: "MUBI", displayPriority: 10 },
  { _id: "shudder", name: "Shudder", displayPriority: 9 },
  { _id: "tubi", name: "Tubi", displayPriority: 8 },
  { _id: "pluto", name: "Pluto TV", displayPriority: 7 },
];

export async function fetchStreamingServices(): Promise<StreamingService[]> {
  try {
    const response = await apiJson<any>("/api/streaming-services");
    let rawServices: StreamingService[] = [];

    // Handle direct array response
    if (Array.isArray(response)) {
      rawServices = response;
    }
    // Handle object with items property
    else if (response && Array.isArray(response.items)) {
      rawServices = response.items;
    }
    // Handle object with data property
    else if (response && Array.isArray(response.data)) {
      rawServices = response.data;
    }
    // Handle object with services property
    else if (response && Array.isArray(response.services)) {
      rawServices = response.services;
    }
    else {
      return MOCK_STREAMING_SERVICES;
    }

    // Filter to only mainstream services
    const filteredServices = filterMainstreamServices(rawServices);

    // If filtering removed everything, fall back to mock data
    return filteredServices.length > 0 ? filteredServices : MOCK_STREAMING_SERVICES;
  } catch {
    return MOCK_STREAMING_SERVICES;
  }
}

export async function fetchUserStreamingServices(): Promise<StreamingService[]> {
  try {
    const response = await apiJson<any>("/api/users/me/streaming-services");
    let rawServices: StreamingService[] = [];

    // Handle direct array response
    if (Array.isArray(response)) {
      rawServices = response;
    }
    // Handle object with items property
    else if (response && Array.isArray(response.items)) {
      rawServices = response.items;
    }
    // Handle object with data property
    else if (response && Array.isArray(response.data)) {
      rawServices = response.data;
    }
    // Handle object with services property
    else if (response && Array.isArray(response.services)) {
      rawServices = response.services;
    }
    // Handle object with streamingServices property
    else if (response && Array.isArray(response.streamingServices)) {
      rawServices = response.streamingServices;
    }
    else {
      return [];
    }

    // Filter to only mainstream services (consistency with available services)
    const filteredServices = filterMainstreamServices(rawServices);
    return filteredServices;
  } catch {
    // Return empty array - user hasn't selected any services yet
    return [];
  }
}

export async function updateUserStreamingServices(serviceIds: string[]): Promise<void> {
  await apiJson("/api/users/me/streaming-services", {
    method: "PUT",
    body: JSON.stringify({ serviceIds }),
  });
}
