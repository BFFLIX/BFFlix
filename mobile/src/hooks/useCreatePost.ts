// mobile/src/hooks/useCreatePost.ts

import { useState, useCallback, useEffect } from "react";
import { Alert } from "react-native";
import type { Circle, TmdbSearchResult, CreatePostPayload } from "../types/feed";
import { createPost, fetchCircles } from "../lib/feed";

type ValidationErrors = {
  media?: string;
  circles?: string;
  content?: string;
};

export function useCreatePost(onSuccess: () => void) {
  // Form fields
  const [mediaType, setMediaType] = useState<"movie" | "tv">("movie");
  const [selectedMedia, setSelectedMedia] = useState<TmdbSearchResult | null>(null);
  const [rating, setRating] = useState<number>(0);
  const [comment, setComment] = useState("");
  const [selectedCircleIds, setSelectedCircleIds] = useState<string[]>([]);
  const [watchedAt, setWatchedAt] = useState<Date | null>(null);
  const [seasonNumber, setSeasonNumber] = useState("");
  const [episodeNumber, setEpisodeNumber] = useState("");

  // Circles data
  const [circles, setCircles] = useState<Circle[]>([]);
  const [loadingCircles, setLoadingCircles] = useState(true);

  // Submission state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<ValidationErrors>({});

  // Load circles on mount
  useEffect(() => {
    (async () => {
      try {
        setLoadingCircles(true);
        const fetchedCircles = await fetchCircles();
        setCircles(fetchedCircles);
      } catch {
        Alert.alert("Error", "Failed to load your circles");
        setCircles([]);
      } finally {
        setLoadingCircles(false);
      }
    })();
  }, []);

  // Validation
  const validate = useCallback((): boolean => {
    const newErrors: ValidationErrors = {};

    // Must select a media item
    if (!selectedMedia) {
      newErrors.media = "Please search and select a movie or TV show";
    }

    // Must select at least one circle
    if (selectedCircleIds.length === 0) {
      newErrors.circles = "Please select at least one circle";
    }

    // Must have either rating or comment
    if (rating === 0 && !comment.trim()) {
      newErrors.content = "Please provide a rating or comment (or both)";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [selectedMedia, selectedCircleIds, rating, comment]);

  // Handle media selection
  const handleSelectMedia = useCallback((media: TmdbSearchResult) => {
    setSelectedMedia(media);
    setErrors((prev) => ({ ...prev, media: undefined }));
  }, []);

  // Handle media type change
  const handleMediaTypeChange = useCallback((type: "movie" | "tv") => {
    setMediaType(type);
    // Clear media selection when switching types
    setSelectedMedia(null);
    setSeasonNumber("");
    setEpisodeNumber("");
  }, []);

  // Handle circle selection change
  const handleCircleChange = useCallback((circleIds: string[]) => {
    setSelectedCircleIds(circleIds);
    setErrors((prev) => ({ ...prev, circles: undefined }));
  }, []);

  // Handle rating change
  const handleRatingChange = useCallback((newRating: number) => {
    setRating(newRating);
    setErrors((prev) => ({ ...prev, content: undefined }));
  }, []);

  // Handle comment change
  const handleCommentChange = useCallback((text: string) => {
    setComment(text);
    setErrors((prev) => ({ ...prev, content: undefined }));
  }, []);

  // Submit form
  const handleSubmit = useCallback(async () => {
    // Validate
    if (!validate()) {
      return;
    }

    try {
      setIsSubmitting(true);

      // Build payload
      const payload: CreatePostPayload = {
        type: mediaType,
        tmdbId: selectedMedia!.id.toString(),
        circles: selectedCircleIds,
      };

      // Add optional fields
      if (rating > 0) {
        payload.rating = rating;
      }

      if (comment.trim()) {
        payload.comment = comment.trim();
      }

      if (watchedAt) {
        payload.watchedAt = watchedAt.toISOString();
      }

      if (mediaType === "tv") {
        const season = parseInt(seasonNumber, 10);
        const episode = parseInt(episodeNumber, 10);

        if (!isNaN(season) && season > 0) {
          payload.seasonNumber = season;
        }

        if (!isNaN(episode) && episode > 0) {
          payload.episodeNumber = episode;
        }
      }

      // Submit to API
      await createPost(payload);

      // Success!
      Alert.alert("Success", "Your post has been created!");
      resetForm();
      onSuccess();
    } catch (error: any) {
      Alert.alert(
        "Error",
        error?.message || "Failed to create post. Please try again."
      );
    } finally {
      setIsSubmitting(false);
    }
  }, [
    validate,
    mediaType,
    selectedMedia,
    selectedCircleIds,
    rating,
    comment,
    watchedAt,
    seasonNumber,
    episodeNumber,
    onSuccess,
  ]);

  // Reset form
  const resetForm = useCallback(() => {
    setMediaType("movie");
    setSelectedMedia(null);
    setRating(0);
    setComment("");
    setSelectedCircleIds([]);
    setWatchedAt(null);
    setSeasonNumber("");
    setEpisodeNumber("");
    setErrors({});
  }, []);

  return {
    // Form state
    mediaType,
    selectedMedia,
    rating,
    comment,
    selectedCircleIds,
    watchedAt,
    seasonNumber,
    episodeNumber,

    // Circles
    circles,
    loadingCircles,

    // Validation
    errors,

    // Submission
    isSubmitting,

    // Handlers
    handleMediaTypeChange,
    handleSelectMedia,
    handleRatingChange,
    handleCommentChange,
    handleCircleChange,
    setWatchedAt,
    setSeasonNumber,
    setEpisodeNumber,
    handleSubmit,
    resetForm,
  };
}
