// mobile/src/lib/viewings.ts

import { apiJson, apiFetch } from "./api";
import type {
  Viewing,
  ViewingsResponse,
  CreateViewingPayload,
  ViewingFilterType,
  ViewingSortOrder,
} from "../types/viewings";

// TMDB API configuration
const TMDB_IMAGE_BASE_URL = "https://image.tmdb.org/t/p/w342";

type FetchViewingsParams = {
  limit?: number;
  cursor?: string;
  sort?: ViewingSortOrder;
  type?: ViewingFilterType;
};

/**
 * Fetch viewings with pagination and filtering
 */
export async function fetchViewings(
  params: FetchViewingsParams = {}
): Promise<ViewingsResponse> {
  const { limit = 20, cursor, sort = "newest", type } = params;

  // Build query string
  const queryParams = new URLSearchParams();
  queryParams.append("limit", String(limit));
  queryParams.append("sort", sort === "newest" ? "desc" : "asc");
  if (cursor) queryParams.append("cursor", cursor);
  if (type && type !== "all") queryParams.append("type", type);

  const response = await apiJson<any>(`/viewings?${queryParams.toString()}`);

  // Transform backend response
  const items = (response.items || []).map((item: any) => ({
    id: String(item._id || item.id),
    userId: String(item.userId),
    type: item.type,
    tmdbId: String(item.tmdbId),
    seasonNumber: item.seasonNumber,
    episodeNumber: item.episodeNumber,
    rating: item.rating,
    comment: item.comment,
    watchedAt: item.watchedAt,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
  }));

  return {
    items,
    nextCursor: response.nextCursor || null,
    hasMore: response.hasMore || false,
    limit: response.limit || limit,
    sort: response.sort || "desc",
  };
}

/**
 * Create a new viewing
 */
export async function createViewing(
  payload: CreateViewingPayload
): Promise<{ id: string }> {
  const response = await apiJson<any>("/viewings", {
    method: "POST",
    body: JSON.stringify(payload),
  });

  return {
    id: String(response.id || response._id),
  };
}

/**
 * Delete a viewing
 */
export async function deleteViewing(id: string): Promise<void> {
  await apiFetch(`/viewings/${id}`, {
    method: "DELETE",
  });
}

/**
 * Fetch TMDB details for a title
 */
export async function fetchTMDBDetails(
  tmdbId: string,
  type: "movie" | "tv"
): Promise<{
  title: string;
  posterUrl?: string;
  year?: number;
  genres?: Array<{ id: number; name: string }>;
}> {
  try {
    const endpoint = type === "movie" ? "movie" : "tv";
    const response = await apiJson<any>(`/tmdb/${endpoint}/${tmdbId}`);

    const title =
      type === "movie" ? response.title : response.name || response.title;
    const year = response.release_date
      ? new Date(response.release_date).getFullYear()
      : response.first_air_date
      ? new Date(response.first_air_date).getFullYear()
      : undefined;
    const posterUrl = response.poster_path
      ? `${TMDB_IMAGE_BASE_URL}${response.poster_path}`
      : undefined;
    const genres = response.genres || [];

    return { title, posterUrl, year, genres };
  } catch {
    return { title: "Unknown Title" };
  }
}

/**
 * Enrich a viewing with TMDB metadata
 */
export async function enrichViewingWithTMDB(
  viewing: Viewing
): Promise<Viewing> {
  if (viewing.title) {
    // Already enriched
    return viewing;
  }

  const tmdbData = await fetchTMDBDetails(viewing.tmdbId, viewing.type);

  return {
    ...viewing,
    ...tmdbData,
  };
}

/**
 * Enrich multiple viewings with TMDB metadata in parallel
 */
export async function enrichViewingsWithTMDB(
  viewings: Viewing[]
): Promise<Viewing[]> {
  const enrichmentPromises = viewings.map((viewing) =>
    enrichViewingWithTMDB(viewing)
  );

  return Promise.all(enrichmentPromises);
}

/**
 * Group viewings by genre for Netflix-style browsing
 * Each viewing is placed in all its genres
 */
export async function groupViewingsByGenre(
  viewings: Viewing[]
): Promise<
  Array<{
    genreId: number;
    genreName: string;
    viewings: Viewing[];
  }>
> {
  // First, enrich viewings with TMDB data if needed
  const enrichedViewings = await enrichViewingsWithTMDB(viewings);

  // Create a map to group viewings by genre
  const genreMap = new Map<
    number,
    { genreId: number; genreName: string; viewings: Viewing[] }
  >();

  // Iterate through viewings and add them to their genre groups
  for (const viewing of enrichedViewings) {
    if (!viewing.genres || viewing.genres.length === 0) {
      // If no genres, add to "Uncategorized"
      const uncategorizedId = 0;
      if (!genreMap.has(uncategorizedId)) {
        genreMap.set(uncategorizedId, {
          genreId: uncategorizedId,
          genreName: "Uncategorized",
          viewings: [],
        });
      }
      genreMap.get(uncategorizedId)!.viewings.push(viewing);
    } else {
      // Add viewing to all its genres
      for (const genre of viewing.genres) {
        if (!genreMap.has(genre.id)) {
          genreMap.set(genre.id, {
            genreId: genre.id,
            genreName: genre.name,
            viewings: [],
          });
        }
        genreMap.get(genre.id)!.viewings.push(viewing);
      }
    }
  }

  // Convert map to array and sort by viewings count (most popular genres first)
  const genreGroups = Array.from(genreMap.values()).sort(
    (a, b) => b.viewings.length - a.viewings.length
  );

  return genreGroups;
}
