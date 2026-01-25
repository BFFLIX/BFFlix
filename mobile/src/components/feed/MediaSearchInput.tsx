// mobile/src/components/feed/MediaSearchInput.tsx

import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  Image,
  ActivityIndicator,
  StyleSheet,
} from "react-native";
import { feedColors } from "../../styles/feedStyles";
import type { TmdbSearchResult } from "../../types/feed";
import { searchTMDB } from "../../lib/feed";

type MediaSearchInputProps = {
  mediaType: "movie" | "tv";
  onSelect: (result: TmdbSearchResult) => void;
  selectedId?: number;
};

export function MediaSearchInput({
  mediaType,
  onSelect,
  selectedId,
}: MediaSearchInputProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<TmdbSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showResults, setShowResults] = useState(false);

  // Debounced search effect
  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      setShowResults(false);
      return;
    }

    const timeoutId = setTimeout(async () => {
      try {
        setIsSearching(true);
        const searchResults = await searchTMDB(query);

        // Filter by media type
        const filtered = searchResults.filter((r) => {
          if (mediaType === "movie") {
            return r.media_type === "movie" || r.title;
          } else {
            return r.media_type === "tv" || r.name;
          }
        });

        setResults(filtered);
        setShowResults(true);
      } catch {
        setResults([]);
      } finally {
        setIsSearching(false);
      }
    }, 400); // 400ms debounce

    return () => clearTimeout(timeoutId);
  }, [query, mediaType]);

  const handleSelect = (result: TmdbSearchResult) => {
    const title = result.title || result.name || "Unknown";
    setQuery(title);
    setShowResults(false);
    onSelect(result);
  };

  const getYear = (result: TmdbSearchResult) => {
    const date = result.release_date || result.first_air_date;
    return date ? new Date(date).getFullYear().toString() : "";
  };

  const getPosterUrl = (posterPath: string | null) => {
    if (!posterPath) return null;
    return `https://image.tmdb.org/t/p/w92${posterPath}`;
  };

  return (
    <View style={styles.container}>
      {/* Search Input */}
      <TextInput
        style={styles.input}
        value={query}
        onChangeText={setQuery}
        placeholder={`Search for a ${mediaType === "movie" ? "movie" : "TV show"}...`}
        placeholderTextColor={feedColors.textTertiary}
        autoCapitalize="none"
        autoCorrect={false}
      />

      {/* Loading Indicator */}
      {isSearching && (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="small" color={feedColors.primary} />
        </View>
      )}

      {/* Search Results Dropdown */}
      {showResults && results.length > 0 && (
        <ScrollView
          style={styles.resultsContainer}
          nestedScrollEnabled
          keyboardShouldPersistTaps="handled"
        >
          {results.slice(0, 10).map((item) => {
            const title = item.title || item.name || "Unknown";
            const year = getYear(item);
            const posterUrl = getPosterUrl(item.poster_path);
            const isSelected = item.id === selectedId;

            return (
              <Pressable
                key={item.id.toString()}
                onPress={() => handleSelect(item)}
                style={[styles.resultItem, isSelected && styles.resultItemSelected]}
              >
                {/* Poster Thumbnail */}
                {posterUrl ? (
                  <Image
                    source={{ uri: posterUrl }}
                    style={styles.resultPoster}
                    resizeMode="cover"
                  />
                ) : (
                  <View style={[styles.resultPoster, styles.resultPosterPlaceholder]} />
                )}

                {/* Title & Year */}
                <View style={styles.resultInfo}>
                  <Text style={styles.resultTitle} numberOfLines={2}>
                    {title}
                  </Text>
                  {year && <Text style={styles.resultYear}>{year}</Text>}
                </View>
              </Pressable>
            );
          })}
        </ScrollView>
      )}

      {/* No Results Message */}
      {showResults && results.length === 0 && !isSearching && query.trim() && (
        <View style={styles.noResults}>
          <Text style={styles.noResultsText}>No results found</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
  },

  input: {
    backgroundColor: feedColors.background,
    borderWidth: 1,
    borderColor: feedColors.border,
    borderRadius: 8,
    padding: 12,
    fontSize: 15,
    color: feedColors.text,
  },

  loadingContainer: {
    position: "absolute",
    right: 12,
    top: 12,
  },

  resultsContainer: {
    marginTop: 8,
    backgroundColor: feedColors.cardBackground,
    borderWidth: 1,
    borderColor: feedColors.border,
    borderRadius: 8,
    maxHeight: 300,
  },

  resultItem: {
    flexDirection: "row",
    padding: 10,
    borderBottomWidth: 1,
    borderBottomColor: feedColors.borderLight,
  },

  resultItemSelected: {
    backgroundColor: feedColors.borderLight,
  },

  resultPoster: {
    width: 40,
    height: 60,
    borderRadius: 4,
    marginRight: 12,
  },

  resultPosterPlaceholder: {
    backgroundColor: feedColors.borderLight,
  },

  resultInfo: {
    flex: 1,
    justifyContent: "center",
  },

  resultTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: feedColors.text,
    marginBottom: 4,
  },

  resultYear: {
    fontSize: 12,
    color: feedColors.textSecondary,
  },

  noResults: {
    marginTop: 8,
    padding: 16,
    alignItems: "center",
  },

  noResultsText: {
    fontSize: 14,
    color: feedColors.textSecondary,
    fontStyle: "italic",
  },
});
