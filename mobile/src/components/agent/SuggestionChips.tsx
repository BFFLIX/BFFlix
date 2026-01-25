// mobile/src/components/agent/SuggestionChips.tsx

import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  Pressable,
  ScrollView,
  ActivityIndicator,
} from "react-native";
import { agentStyles } from "../../styles/agentStyles";
import { feedColors } from "../../styles/feedStyles";
import { fetchSuggestions } from "../../lib/agent";
import type { Suggestion } from "../../types/agent";

type SuggestionChipsProps = {
  onSelectSuggestion: (text: string) => void;
  disabled?: boolean;
};

export function SuggestionChips({
  onSelectSuggestion,
  disabled = false,
}: SuggestionChipsProps) {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadSuggestions();
  }, []);

  const loadSuggestions = async () => {
    try {
      setIsLoading(true);
      const data = await fetchSuggestions();
      setSuggestions(data);
    } catch {
      // Fail silently - suggestions are optional
      setSuggestions([]);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <View style={agentStyles.suggestionsContainer}>
        <View style={{ paddingHorizontal: 16 }}>
          <ActivityIndicator size="small" color={feedColors.primary} />
        </View>
      </View>
    );
  }

  if (suggestions.length === 0) {
    return null;
  }

  return (
    <View style={agentStyles.suggestionsContainer}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={agentStyles.suggestionsScrollContent}
      >
        {suggestions.map((suggestion) => (
          <Pressable
            key={suggestion.id}
            style={agentStyles.suggestionChip}
            onPress={() => onSelectSuggestion(suggestion.text)}
            disabled={disabled}
          >
            <Text style={agentStyles.suggestionChipText}>
              {suggestion.text}
            </Text>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}
