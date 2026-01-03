import React from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { AppProvider } from "./data/AppContext";
import { AppNavigator } from "./navigation/AppNavigator";

export const AppRoot = () => {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <AppProvider>
        <AppNavigator />
      </AppProvider>
    </GestureHandlerRootView>
  );
};
