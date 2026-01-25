
import { View, Text } from "react-native";

export default function ProfileScreen() {
  return (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 24 }}>
      <Text style={{ fontSize: 22, fontWeight: "600" }}>Profile</Text>
      <Text style={{ fontSize: 14, opacity: 0.7, marginTop: 8 }}>
        Profile placeholder. Next we'll load /me and show user info.
      </Text>
    </View>
  );
}
