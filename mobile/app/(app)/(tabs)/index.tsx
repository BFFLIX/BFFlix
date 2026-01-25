// mobile/app/(app)/(tabs)/index.tsx

import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  FlatList,
  ActivityIndicator,
  Pressable,
  RefreshControl,
} from "react-native";
import { feedStyles, feedColors } from "../../../src/styles/feedStyles";
import { FeedHeader } from "../../../src/components/feed/FeedHeader";
import { FeedPost } from "../../../src/components/feed/FeedPost";
import { CreatePostFAB } from "../../../src/components/feed/CreatePostFAB";
import { CreatePostModal } from "../../../src/components/feed/CreatePostModal";
import { useFeed } from "../../../src/hooks/useFeed";
import { fetchCurrentUser } from "../../../src/lib/feed";

export default function HomeScreen() {
  const [currentUserId, setCurrentUserId] = useState<string | undefined>();
  const [currentUserName, setCurrentUserName] = useState<string | undefined>();
  const [isCreateModalVisible, setIsCreateModalVisible] = useState(false);

  const {
    posts,
    hasMore,
    isLoading,
    isLoadingMore,
    isRefreshing,
    error,
    scope,
    sort,
    loadMore,
    refresh,
    handleLike,
    handleDelete,
    changeScope,
    changeSort,
  } = useFeed();

  // Fetch current user on mount
  useEffect(() => {
    (async () => {
      try {
        const user = await fetchCurrentUser();
        setCurrentUserId(user.id);
        setCurrentUserName(user.name);
      } catch (err) {
        console.error("Failed to fetch current user:", err);
      }
    })();
  }, []);

  // Handle post creation success
  const handlePostCreated = async () => {
    setIsCreateModalVisible(false);
    // Small delay to give backend time to process the post
    await new Promise(resolve => setTimeout(resolve, 500));
    await refresh(); // Refresh feed to show new post
  };

  // Loading state
  if (isLoading) {
    return (
      <View style={feedStyles.loadingContainer}>
        <ActivityIndicator size="large" color={feedColors.primary} />
        <Text style={feedStyles.emptyText}>Loading your feed...</Text>
      </View>
    );
  }

  // Error state
  if (error) {
    return (
      <View style={feedStyles.emptyContainer}>
        <Text style={feedStyles.emptyText}>Failed to load feed</Text>
        <Text style={[feedStyles.emptyText, { fontSize: 14, marginTop: 8 }]}>
          {error}
        </Text>
        <Pressable
          onPress={() => refresh()}
          style={[feedStyles.button, feedStyles.buttonPrimary, { marginTop: 16 }]}
        >
          <Text style={feedStyles.buttonTextPrimary}>Retry</Text>
        </Pressable>
      </View>
    );
  }

  // Empty state
  if (!posts || posts.length === 0) {
    return (
      <View style={feedStyles.container}>
        <FeedHeader
          activeTab={scope}
          sortOrder={sort}
          onTabChange={changeScope}
          onSortChange={changeSort}
        />
        <View style={feedStyles.emptyContainer}>
          <Text style={feedStyles.emptyText}>No posts yet</Text>
          <Text style={[feedStyles.emptyText, { fontSize: 14, marginTop: 8 }]}>
            Make your first post or join a circle to start your feed!
          </Text>
        </View>

        {/* Floating Action Button */}
        <CreatePostFAB onPress={() => setIsCreateModalVisible(true)} />

        {/* Create Post Modal */}
        <CreatePostModal
          visible={isCreateModalVisible}
          onClose={() => setIsCreateModalVisible(false)}
          onSuccess={handlePostCreated}
        />
      </View>
    );
  }

  return (
    <View style={feedStyles.container}>
      <FlatList
        data={posts}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <FeedPost
            post={item}
            currentUserId={currentUserId}
            currentUserName={currentUserName}
            onLike={handleLike}
            onDelete={handleDelete}
          />
        )}
        ListHeaderComponent={
          <FeedHeader
            activeTab={scope}
            sortOrder={sort}
            onTabChange={changeScope}
            onSortChange={changeSort}
          />
        }
        contentContainerStyle={feedStyles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={refresh}
            tintColor={feedColors.primary}
          />
        }
        ListFooterComponent={
          hasMore ? (
            <Pressable
              onPress={loadMore}
              style={feedStyles.loadMoreButton}
              disabled={isLoadingMore}
            >
              {isLoadingMore ? (
                <ActivityIndicator size="small" color={feedColors.primary} />
              ) : (
                <Text style={feedStyles.loadMoreText}>Load more</Text>
              )}
            </Pressable>
          ) : posts.length > 0 ? (
            <View style={{ padding: 20, alignItems: "center" }}>
              <Text style={{ color: feedColors.textTertiary, fontSize: 13 }}>
                You've reached the end
              </Text>
            </View>
          ) : null
        }
      />

      {/* Floating Action Button */}
      <CreatePostFAB onPress={() => setIsCreateModalVisible(true)} />

      {/* Create Post Modal */}
      <CreatePostModal
        visible={isCreateModalVisible}
        onClose={() => setIsCreateModalVisible(false)}
        onSuccess={handlePostCreated}
      />
    </View>
  );
}
