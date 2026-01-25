// mobile/src/hooks/useCreateViewing.ts

import { useState, useCallback } from "react";
import type { TmdbSearchResult } from "../types/feed";
import { createViewing } from "../lib/viewings";

type ValidationErrors = {
  media?: string;
  ratingOrComment?: string;
  season?: string;
  comment?: string;
};

export function useCreateViewing(onSuccess: () => void) {
  // Form state
  const [type, setType] = useState<"movie" | "tv">("movie");
  const [selectedMedia, setSelectedMedia] = useState<TmdbSearchResult | null>(
    null
  );
  const [rating, setRating] = useState<number>(0);
  const [comment, setComment] = useState<string>("");
  const [watchedAt, setWatchedAt] = useState<string>(
    new Date().toISOString().split("T")[0]
  );
  const [seasonNumber, setSeasonNumber] = useState<string>("");
  const [episodeNumber, setEpisodeNumber] = useState<string>("");

  // State
  const [errors, setErrors] = useState<ValidationErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Validate form
  const validate = useCallback((): boolean => {
    const newErrors: ValidationErrors = {};

    // Must select a title
    if (!selectedMedia) {
      newErrors.media = "Please select a title";
    }

    // Rating OR comment required
    if (rating === 0 && !comment.trim()) {
      newErrors.ratingOrComment = "Please provide a rating or comment";
    }

    // Comment max 1000 chars
    if (comment.length > 1000) {
      newErrors.comment = "Comment must be 1000 characters or less";
    }

    // TV show: if episode, season is required
    if (type === "tv" && episodeNumber && !seasonNumber) {
      newErrors.season = "Season number is required when episode is provided";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [selectedMedia, rating, comment, type, episodeNumber, seasonNumber]);

  // Handle type change
  const handleTypeChange = useCallback((newType: "movie" | "tv") => {
    setType(newType);
    setSelectedMedia(null);
    setSeasonNumber("");
    setEpisodeNumber("");
  }, []);

  // Handle select media
  const handleSelectMedia = useCallback((media: TmdbSearchResult) => {
    setSelectedMedia(media);
    setErrors((prev) => ({ ...prev, media: undefined }));
  }, []);

  // Handle rating change
  const handleRatingChange = useCallback((newRating: number) => {
    setRating(newRating);
    setErrors((prev) => ({ ...prev, ratingOrComment: undefined }));
  }, []);

  // Handle comment change
  const handleCommentChange = useCallback((text: string) => {
    setComment(text);
    setErrors((prev) => ({
      ...prev,
      ratingOrComment: undefined,
      comment: undefined,
    }));
  }, []);

  // Handle watched at change
  const handleWatchedAtChange = useCallback((date: string) => {
    setWatchedAt(date);
  }, []);

  // Handle season change
  const handleSeasonChange = useCallback((num: string) => {
    setSeasonNumber(num);
    setErrors((prev) => ({ ...prev, season: undefined }));
  }, []);

  // Handle episode change
  const handleEpisodeChange = useCallback((num: string) => {
    setEpisodeNumber(num);
  }, []);

  // Handle submit
  const handleSubmit = useCallback(async () => {
    if (!validate()) {
      return;
    }

    if (!selectedMedia) {
      return;
    }

    try {
      setIsSubmitting(true);

      const payload = {
        type,
        tmdbId: String(selectedMedia.id),
        rating: rating > 0 ? rating : undefined,
        comment: comment.trim() || undefined,
        watchedAt: watchedAt ? new Date(watchedAt).toISOString() : undefined,
        seasonNumber: seasonNumber ? parseInt(seasonNumber, 10) : undefined,
        episodeNumber: episodeNumber ? parseInt(episodeNumber, 10) : undefined,
      };

      await createViewing(payload);

      // Success - reset form and call onSuccess
      resetForm();
      onSuccess();
    } catch (err) {
      setErrors({
        media: err instanceof Error ? err.message : "Failed to create viewing",
      });
    } finally {
      setIsSubmitting(false);
    }
  }, [
    validate,
    selectedMedia,
    type,
    rating,
    comment,
    watchedAt,
    seasonNumber,
    episodeNumber,
    onSuccess,
  ]);

  // Reset form
  const resetForm = useCallback(() => {
    setType("movie");
    setSelectedMedia(null);
    setRating(0);
    setComment("");
    setWatchedAt(new Date().toISOString().split("T")[0]);
    setSeasonNumber("");
    setEpisodeNumber("");
    setErrors({});
  }, []);

  return {
    // Form state
    type,
    selectedMedia,
    rating,
    comment,
    watchedAt,
    seasonNumber,
    episodeNumber,

    // State
    errors,
    isSubmitting,

    // Actions
    handleTypeChange,
    handleSelectMedia,
    handleRatingChange,
    handleCommentChange,
    handleWatchedAtChange,
    handleSeasonChange,
    handleEpisodeChange,
    handleSubmit,
    resetForm,
  };
}
