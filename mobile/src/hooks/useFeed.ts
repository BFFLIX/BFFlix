// mobile/src/hooks/useFeed.ts

import { useState, useEffect, useCallback } from "react";
import { Alert } from "react-native";
import type { FeedPost, FeedScope, FeedSort } from "../types/feed";
import { fetchFeed, likePost, unlikePost, deletePost } from "../lib/feed";
import { useAuth } from "../auth/AuthContext";

export function useFeed() {
  const { isAuthed, isReady } = useAuth();

  // Feed data
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);

  // Loading states
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Error state
  const [error, setError] = useState<string | null>(null);

  // Filter states
  const [scope, setScope] = useState<FeedScope>("all");
  const [sort, setSort] = useState<FeedSort>("smart");

  // Load initial feed
  const loadInitial = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const response = await fetchFeed({ scope, sort, limit: 20 });

      setPosts(response.items || []);
      setNextCursor(response.nextCursor || null);
      setHasMore(!!response.nextCursor);
    } catch (err: any) {
      setError(err?.message || "Failed to load feed");
      setPosts([]);
    } finally {
      setIsLoading(false);
    }
  }, [scope, sort]);

  // Load more posts (pagination)
  const loadMore = useCallback(async () => {
    if (!hasMore || !nextCursor || isLoadingMore) {
      return;
    }

    try {
      setIsLoadingMore(true);

      const response = await fetchFeed({
        scope,
        sort,
        cursor: nextCursor,
        limit: 20,
      });

      setPosts((prev) => [...prev, ...(response.items || [])]);
      setNextCursor(response.nextCursor || null);
      setHasMore(!!response.nextCursor);
    } catch {
      Alert.alert("Error", "Failed to load more posts");
    } finally {
      setIsLoadingMore(false);
    }
  }, [scope, sort, nextCursor, hasMore, isLoadingMore]);

  // Refresh feed (pull to refresh)
  const refresh = useCallback(async () => {
    try {
      setIsRefreshing(true);

      const response = await fetchFeed({ scope, sort, limit: 20 });

      setPosts(response.items || []);
      setNextCursor(response.nextCursor || null);
      setHasMore(!!response.nextCursor);
      setError(null);
    } catch {
      Alert.alert("Error", "Failed to refresh feed");
    } finally {
      setIsRefreshing(false);
    }
  }, [scope, sort]);

  // Handle like/unlike with optimistic updates
  const handleLike = useCallback(
    async (postId: string, currentLikedState: boolean) => {
      // Store original posts for rollback
      const originalPosts = [...posts];

      // Optimistic update
      setPosts((prev) =>
        prev.map((p) =>
          p.id === postId
            ? {
                ...p,
                likedByMe: !currentLikedState,
                likeCount: currentLikedState
                  ? p.likeCount - 1
                  : p.likeCount + 1,
              }
            : p
        )
      );

      try {
        // API call
        if (currentLikedState) {
          await unlikePost(postId);
        } else {
          await likePost(postId);
        }
      } catch {
        // Rollback on error
        setPosts(originalPosts);

        Alert.alert("Error", "Failed to update like");
      }
    },
    [posts]
  );

  // Handle delete post
  const handleDelete = useCallback(
    async (postId: string) => {
      try {
        // Optimistic update
        const originalPosts = [...posts];
        setPosts((prev) => prev.filter((p) => p.id !== postId));

        await deletePost(postId);
      } catch {
        // Rollback on error
        setPosts(posts);

        Alert.alert("Error", "Failed to delete post");
      }
    },
    [posts]
  );

  // Change scope (All/Circles/Mine)
  const changeScope = useCallback((newScope: FeedScope) => {
    setScope(newScope);
  }, []);

  // Change sort (Latest/Smart)
  const changeSort = useCallback((newSort: FeedSort) => {
    setSort(newSort);
  }, []);

  // Reload feed when filters change (only if authenticated and ready)
  useEffect(() => {
    if (isReady && isAuthed) {
      loadInitial();
    }
  }, [scope, sort, isReady, isAuthed, loadInitial]);

  return {
    // Data
    posts,
    hasMore,

    // Loading states
    isLoading,
    isLoadingMore,
    isRefreshing,

    // Error
    error,

    // Filters
    scope,
    sort,

    // Actions
    loadMore,
    refresh,
    handleLike,
    handleDelete,
    changeScope,
    changeSort,
  };
}
