import React, { useState } from "react";
import { View } from "react-native";
import MarketOverviewScreen from "../screens/MarketOverviewScreen";
import { DrawgleBottomNavigation } from "./DrawgleBottomNavigation";

export default function AppShell() {
  const [activeTab, setActiveTab] = useState("markets");

  return (
    <View style={{ flex: 1 }}>
      <MarketOverviewScreen />
      <DrawgleBottomNavigation activeTab={activeTab} onTabPress={setActiveTab} />
    </View>
  );
}
