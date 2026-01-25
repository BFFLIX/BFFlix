// mobile/src/components/circles/CreateCircleModal.tsx

import React, { useState } from "react";
import {
  View,
  Text,
  Modal,
  ScrollView,
  TextInput,
  Pressable,
  ActivityIndicator,
  StyleSheet,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { feedColors } from "../../styles/feedStyles";
import { createCircle } from "../../lib/feed";

type CreateCircleModalProps = {
  visible: boolean;
  onClose: () => void;
  onSuccess: () => void;
};

export function CreateCircleModal({
  visible,
  onClose,
  onSuccess,
}: CreateCircleModalProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [visibility, setVisibility] = useState<"public" | "private">("private");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<{ name?: string; description?: string }>({});

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const resetForm = () => {
    setName("");
    setDescription("");
    setVisibility("private");
    setErrors({});
  };

  const validate = (): boolean => {
    const newErrors: { name?: string; description?: string } = {};

    if (!name.trim()) {
      newErrors.name = "Circle name is required";
    } else if (name.trim().length < 1 || name.trim().length > 80) {
      newErrors.name = "Circle name must be between 1 and 80 characters";
    }

    if (description.trim().length > 240) {
      newErrors.description = "Description must be 240 characters or less";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) {
      return;
    }

    try {
      setIsSubmitting(true);

      await createCircle({
        name: name.trim(),
        description: description.trim() || undefined,
        visibility,
      });

      Alert.alert("Success", `Circle "${name.trim()}" has been created!`);
      resetForm();
      onSuccess();
    } catch (err: any) {
      Alert.alert(
        "Error",
        err?.message || "Failed to create circle. Please try again."
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={handleClose}
    >
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.container}>
          {/* Header */}
          <View style={styles.header}>
            <Pressable onPress={handleClose} hitSlop={8}>
              <Text style={styles.cancelButton}>Cancel</Text>
            </Pressable>
            <Text style={styles.title}>Create Circle</Text>
            <View style={{ width: 60 }} />
          </View>

          {/* Form Content */}
          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
          >
            {/* Circle Name */}
            <View style={styles.section}>
              <Text style={styles.label}>Circle Name *</Text>
              <TextInput
                style={[styles.input, errors.name && styles.inputError]}
                value={name}
                onChangeText={(text) => {
                  setName(text);
                  if (errors.name) setErrors((prev) => ({ ...prev, name: undefined }));
                }}
                placeholder="Enter circle name"
                placeholderTextColor={feedColors.textTertiary}
                maxLength={80}
              />
              {errors.name && (
                <Text style={styles.errorText}>{errors.name}</Text>
              )}
              <Text style={styles.charCount}>{name.length} / 80</Text>
            </View>

            {/* Description */}
            <View style={styles.section}>
              <Text style={styles.label}>Description (optional)</Text>
              <TextInput
                style={[
                  styles.textArea,
                  errors.description && styles.inputError,
                ]}
                value={description}
                onChangeText={(text) => {
                  setDescription(text);
                  if (errors.description)
                    setErrors((prev) => ({ ...prev, description: undefined }));
                }}
                placeholder="What's this circle about?"
                placeholderTextColor={feedColors.textTertiary}
                multiline
                maxLength={240}
                textAlignVertical="top"
              />
              {errors.description && (
                <Text style={styles.errorText}>{errors.description}</Text>
              )}
              <Text style={styles.charCount}>{description.length} / 240</Text>
            </View>

            {/* Visibility */}
            <View style={styles.section}>
              <Text style={styles.label}>Visibility</Text>
              <View style={styles.toggleRow}>
                <Pressable
                  onPress={() => setVisibility("private")}
                  style={[
                    styles.toggleButton,
                    visibility === "private" && styles.toggleButtonActive,
                  ]}
                >
                  <Ionicons
                    name="lock-closed"
                    size={18}
                    color={
                      visibility === "private"
                        ? "#fff"
                        : feedColors.textSecondary
                    }
                  />
                  <Text
                    style={[
                      styles.toggleButtonText,
                      visibility === "private" && styles.toggleButtonTextActive,
                    ]}
                  >
                    Private
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() => setVisibility("public")}
                  style={[
                    styles.toggleButton,
                    visibility === "public" && styles.toggleButtonActive,
                  ]}
                >
                  <Ionicons
                    name="globe"
                    size={18}
                    color={
                      visibility === "public" ? "#fff" : feedColors.textSecondary
                    }
                  />
                  <Text
                    style={[
                      styles.toggleButtonText,
                      visibility === "public" && styles.toggleButtonTextActive,
                    ]}
                  >
                    Public
                  </Text>
                </Pressable>
              </View>

              <View style={styles.infoBox}>
                <Ionicons name="information-circle-outline" size={16} color={feedColors.primary} />
                <Text style={styles.infoText}>
                  {visibility === "private"
                    ? "Only invited members can join. You'll get an invite code to share."
                    : "Anyone can find and join this circle. Perfect for communities!"}
                </Text>
              </View>
            </View>

            {/* Submit Button */}
            <View style={styles.section}>
              <Pressable
                onPress={handleSubmit}
                style={[
                  styles.submitButton,
                  isSubmitting && styles.submitButtonDisabled,
                ]}
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.submitButtonText}>Create Circle</Text>
                )}
              </Pressable>
            </View>
          </ScrollView>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: feedColors.background,
  },
  container: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: feedColors.border,
  },
  cancelButton: {
    fontSize: 16,
    color: feedColors.primary,
    fontWeight: "500",
  },
  title: {
    fontSize: 18,
    fontWeight: "700",
    color: feedColors.text,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  section: {
    marginBottom: 24,
  },
  label: {
    fontSize: 15,
    fontWeight: "600",
    color: feedColors.text,
    marginBottom: 8,
  },
  input: {
    backgroundColor: feedColors.backgroundSecondary,
    borderWidth: 1,
    borderColor: feedColors.border,
    borderRadius: 8,
    padding: 12,
    fontSize: 15,
    color: feedColors.text,
  },
  inputError: {
    borderColor: feedColors.error,
  },
  textArea: {
    backgroundColor: feedColors.backgroundSecondary,
    borderWidth: 1,
    borderColor: feedColors.border,
    borderRadius: 8,
    padding: 12,
    fontSize: 15,
    color: feedColors.text,
    minHeight: 100,
    textAlignVertical: "top",
  },
  charCount: {
    fontSize: 12,
    color: feedColors.textTertiary,
    marginTop: 4,
    textAlign: "right",
  },
  toggleRow: {
    flexDirection: "row",
    gap: 12,
  },
  toggleButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: feedColors.backgroundSecondary,
    borderWidth: 2,
    borderColor: feedColors.border,
    gap: 8,
  },
  toggleButtonActive: {
    backgroundColor: feedColors.primary,
    borderColor: feedColors.primary,
  },
  toggleButtonText: {
    fontSize: 15,
    fontWeight: "600",
    color: feedColors.textSecondary,
  },
  toggleButtonTextActive: {
    color: "#fff",
  },
  infoBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginTop: 12,
    padding: 12,
    backgroundColor: `${feedColors.primary}15`,
    borderRadius: 8,
    gap: 8,
  },
  infoText: {
    flex: 1,
    fontSize: 13,
    color: feedColors.textSecondary,
    lineHeight: 18,
  },
  submitButton: {
    backgroundColor: feedColors.primary,
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: "center",
  },
  submitButtonDisabled: {
    opacity: 0.5,
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#fff",
  },
  errorText: {
    fontSize: 13,
    color: feedColors.error,
    marginTop: 4,
  },
});
