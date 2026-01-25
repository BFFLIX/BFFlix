// mobile/src/components/feed/CommentInput.tsx

import React, { useState } from "react";
import { View, TextInput, Pressable, Text, ActivityIndicator } from "react-native";
import { feedStyles, feedColors } from "../../styles/feedStyles";

type CommentInputProps = {
  onSubmit: (text: string) => Promise<void>;
  isSubmitting?: boolean;
  placeholder?: string;
};

export function CommentInput({
  onSubmit,
  isSubmitting = false,
  placeholder = "Write a comment...",
}: CommentInputProps) {
  const [text, setText] = useState("");

  const handleSubmit = async () => {
    const trimmedText = text.trim();
    if (!trimmedText || isSubmitting) return;

    try {
      await onSubmit(trimmedText);
      setText(""); // Clear input on success
    } catch {
      // Error handling is done in parent component
    }
  };

  const canSubmit = text.trim().length > 0 && !isSubmitting;

  return (
    <View>
      {/* Comment Input */}
      <TextInput
        style={feedStyles.commentInput}
        value={text}
        onChangeText={setText}
        placeholder={placeholder}
        placeholderTextColor={feedColors.textTertiary}
        multiline
        maxLength={1000}
        editable={!isSubmitting}
      />

      {/* Action Buttons */}
      <View style={feedStyles.commentActions}>
        {/* Cancel Button */}
        {text.length > 0 && (
          <Pressable
            onPress={() => setText("")}
            style={[feedStyles.button, feedStyles.buttonSecondary]}
            disabled={isSubmitting}
          >
            <Text style={feedStyles.buttonText}>Cancel</Text>
          </Pressable>
        )}

        {/* Submit Button */}
        <Pressable
          onPress={handleSubmit}
          style={[
            feedStyles.button,
            feedStyles.buttonPrimary,
            !canSubmit && feedStyles.buttonDisabled,
          ]}
          disabled={!canSubmit}
        >
          {isSubmitting ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text style={feedStyles.buttonTextPrimary}>Post</Text>
          )}
        </Pressable>
      </View>
    </View>
  );
}
