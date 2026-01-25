// mobile/src/hooks/useViewings.ts

import { useState, useCallback, useEffect } from "react";
import { Alert } from "react-native";
import type {
  Viewing,
  ViewingStats,
  ViewingFilterType,
  ViewingSortOrder,
} from "../types/viewings";
import {
  fetchViewings,
  deleteViewing,
  enrichViewingsWithTMDB,
} from "../lib/viewings";

export function useViewings() {
  const [viewings, setViewings] = useState<Viewing[]>([]);
  const [stats, setStats] = useState<ViewingStats>({
    total: 0,
    movies: 0,
    shows: 0,
    notes: 0,
  });
  const [hasMore, setHasMore] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | null>(null);

  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [typeFilter, setTypeFilter] = useState<ViewingFilterType>("all");
  const [sortOrder, setSortOrder] = useState<ViewingSortOrder>("newest");

  // Compute stats from viewings array
  const computeStats = useCallback((items: Viewing[]): ViewingStats => {
    return {
      total: items.length,
      movies: items.filter((v) => v.type === "movie").length,
      shows: items.filter((v) => v.type === "tv").length,
      notes: items.filter((v) => v.comment && v.comment.trim().length > 0)
        .length,
    };
  }, []);

  // Load initial viewings
  const loadInitial = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const response = await fetchViewings({
        limit: 20,
        sort: sortOrder,
        type: typeFilter,
      });

      // Enrich with TMDB data
      const enrichedItems = await enrichViewingsWithTMDB(response.items);

      setViewings(enrichedItems);
      setStats(computeStats(enrichedItems));
      setNextCursor(response.nextCursor);
      setHasMore(response.hasMore);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load viewings");
      setViewings([]);
      setStats({ total: 0, movies: 0, shows: 0, notes: 0 });
    } finally {
      setIsLoading(false);
    }
  }, [sortOrder, typeFilter, computeStats]);

  // Load more viewings (pagination)
  const loadMore = useCallback(async () => {
    if (!hasMore || isLoadingMore || !nextCursor) return;

    try {
      setIsLoadingMore(true);

      const response = await fetchViewings({
        limit: 20,
        cursor: nextCursor,
        sort: sortOrder,
        type: typeFilter,
      });

      // Enrich with TMDB data
      const enrichedItems = await enrichViewingsWithTMDB(response.items);

      const updatedViewings = [...viewings, ...enrichedItems];
      setViewings(updatedViewings);
      setStats(computeStats(updatedViewings));
      setNextCursor(response.nextCursor);
      setHasMore(response.hasMore);
    } catch {
      Alert.alert("Error", "Failed to load more viewings");
    } finally {
      setIsLoadingMore(false);
    }
  }, [
    hasMore,
    isLoadingMore,
    nextCursor,
    sortOrder,
    typeFilter,
    viewings,
    computeStats,
  ]);

  // Refresh viewings
  const refresh = useCallback(async () => {
    try {
      setIsRefreshing(true);

      const response = await fetchViewings({
        limit: 20,
        sort: sortOrder,
        type: typeFilter,
      });

      // Enrich with TMDB data
      const enrichedItems = await enrichViewingsWithTMDB(response.items);

      setViewings(enrichedItems);
      setStats(computeStats(enrichedItems));
      setNextCursor(response.nextCursor);
      setHasMore(response.hasMore);
      setError(null);
    } catch {
      Alert.alert("Error", "Failed to refresh viewings");
    } finally {
      setIsRefreshing(false);
    }
  }, [sortOrder, typeFilter, computeStats]);

  // Delete viewing with optimistic update
  const handleDeleteViewing = useCallback(
    async (id: string) => {
      // Show confirmation dialog
      Alert.alert(
        "Delete Viewing",
        "Are you sure you want to delete this viewing?",
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Delete",
            style: "destructive",
            onPress: async () => {
              // Optimistic update
              const originalViewings = [...viewings];
              const updatedViewings = viewings.filter((v) => v.id !== id);
              setViewings(updatedViewings);
              setStats(computeStats(updatedViewings));

              try {
                await deleteViewing(id);
              } catch {
                // Rollback on error
                setViewings(originalViewings);
                setStats(computeStats(originalViewings));
                Alert.alert("Error", "Failed to delete viewing");
              }
            },
          },
        ]
      );
    },
    [viewings, computeStats]
  );

  // Change type filter
  const changeTypeFilter = useCallback((type: ViewingFilterType) => {
    setTypeFilter(type);
  }, []);

  // Change sort order
  const changeSortOrder = useCallback((sort: ViewingSortOrder) => {
    setSortOrder(sort);
  }, []);

  // Load initial viewings on mount or when filters change
  useEffect(() => {
    loadInitial();
  }, [loadInitial]);

  return {
    // Data
    viewings,
    stats,
    hasMore,

    // State
    isLoading,
    isLoadingMore,
    isRefreshing,
    error,

    // Filters
    typeFilter,
    sortOrder,

    // Actions
    loadMore,
    refresh,
    deleteViewing: handleDeleteViewing,
    changeTypeFilter,
    changeSortOrder,
  };
}
