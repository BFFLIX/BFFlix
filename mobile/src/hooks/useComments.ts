// mobile/src/hooks/useComments.ts

import { useState, useCallback } from "react";
import { Alert } from "react-native";
import type { FeedComment } from "../types/feed";
import { fetchComments, addComment, deleteComment } from "../lib/feed";

export function useComments(postId: string, currentUserId?: string, currentUserName?: string) {
  const [comments, setComments] = useState<FeedComment[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Fetch comments from API
  const fetch = useCallback(async () => {
    try {
      setIsLoading(true);
      const fetchedComments = await fetchComments(postId);
      setComments(fetchedComments);
    } catch {
      Alert.alert("Error", "Failed to load comments");
      setComments([]);
    } finally {
      setIsLoading(false);
    }
  }, [postId]);

  // Add a new comment
  const add = useCallback(
    async (text: string) => {
      if (!currentUserId) {
        Alert.alert("Error", "You must be logged in to comment");
        throw new Error("No current user");
      }

      try {
        setIsSubmitting(true);
        const response = await addComment(postId, text);

        // Construct full comment object from backend response + current user
        const newComment: FeedComment = {
          id: response.id,
          userId: currentUserId,
          userName: currentUserName || "You",
          text: text,
          createdAt: response.createdAt,
        };

        // Add comment to the list (append to end)
        setComments((prev) => [...prev, newComment]);
      } catch (error) {
        Alert.alert("Error", "Failed to post comment");
        throw error; // Re-throw so CommentInput can handle it
      } finally {
        setIsSubmitting(false);
      }
    },
    [postId, currentUserId, currentUserName]
  );

  // Delete a comment
  const remove = useCallback(
    async (commentId: string) => {
      try {
        // Optimistic update
        const originalComments = [...comments];
        setComments((prev) => prev.filter((c) => c.id !== commentId));

        await deleteComment(postId, commentId);
      } catch {
        Alert.alert("Error", "Failed to delete comment");

        // Rollback on error
        setComments(comments);
      }
    },
    [postId, comments]
  );

  // Refresh comments (useful after external updates)
  const refresh = useCallback(async () => {
    await fetch();
  }, [fetch]);

  return {
    comments,
    isLoading,
    isSubmitting,
    fetch,
    add,
    remove,
    refresh,
  };
}
