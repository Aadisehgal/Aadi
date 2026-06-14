import React, { Suspense, lazy } from 'react';
import { View, ActivityIndicator, StyleSheet, Text } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useAuthStore } from '@stores/useAuthStore';
import { useSettingsStore } from '@stores/useSettingsStore';

const AuthScreen          = lazy(() => import('@screens/AuthScreen'));
const ChatScreen          = lazy(() => import('@screens/ChatScreen'));
const AvatarScreen        = lazy(() => import('@screens/AvatarScreen').catch(() => ({ default: () => <View style={{flex:1,backgroundColor:'#0f0f1a',justifyContent:'center',alignItems:'center'}}><Text style={{color:'#888'}}>Avatar unavailable</Text></View> })));
const SettingsScreen      = lazy(() => import('@screens/SettingsScreen'));
const MemoryScreen        = lazy(() => import('@screens/MemoryScreen'));
const DebugScreen         = lazy(() => import('@screens/DebugScreen'));
const NotesScreen         = lazy(() => import('@screens/NotesScreen'));
const RemindersScreen     = lazy(() => import('@screens/RemindersScreen'));
const DocumentScreen      = lazy(() => import('@screens/DocumentScreen'));
const ConversationsScreen = lazy(() => import('@screens/ConversationsScreen'));

function ScreenLoader() {
  return (
    <View style={styles.loader}>
      <ActivityIndicator color="#e94560" size="large" />
    </View>
  );
}

function LazyScreen({ Screen }: { Screen: React.LazyExoticComponent<() => React.JSX.Element> }) {
  return (
    <Suspense fallback={<ScreenLoader />}>
      <Screen />
    </Suspense>
  );
}

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

const MainTabs = () => {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: { backgroundColor: '#1a1a2e', borderTopColor: '#16213e' },
        tabBarActiveTintColor: '#e94560',
        tabBarInactiveTintColor: '#888',
        tabBarHideOnKeyboard: true,
        lazy: false,
      }}
    >
      <Tab.Screen name="Chat" options={{ tabBarLabel: 'Chat' }}>
        {() => <LazyScreen Screen={ChatScreen as React.LazyExoticComponent<() => React.JSX.Element>} />}
      </Tab.Screen>
      <Tab.Screen name="Convs" options={{ tabBarLabel: 'Chats' }}>
        {() => <LazyScreen Screen={ConversationsScreen as React.LazyExoticComponent<() => React.JSX.Element>} />}
      </Tab.Screen>
      <Tab.Screen name="Avatar" options={{ tabBarLabel: 'Avatar' }}>
        {() => <LazyScreen Screen={AvatarScreen as React.LazyExoticComponent<() => React.JSX.Element>} />}
      </Tab.Screen>
      <Tab.Screen name="Docs" options={{ tabBarLabel: 'Docs' }}>
        {() => <LazyScreen Screen={DocumentScreen as React.LazyExoticComponent<() => React.JSX.Element>} />}
      </Tab.Screen>
      <Tab.Screen name="Memory" options={{ tabBarLabel: 'Memory' }}>
        {() => <LazyScreen Screen={MemoryScreen as React.LazyExoticComponent<() => React.JSX.Element>} />}
      </Tab.Screen>
      <Tab.Screen name="Notes" options={{ tabBarLabel: 'Notes' }}>
        {() => <LazyScreen Screen={NotesScreen as React.LazyExoticComponent<() => React.JSX.Element>} />}
      </Tab.Screen>
      <Tab.Screen name="Settings" options={{ tabBarLabel: 'Settings' }}>
        {() => <LazyScreen Screen={SettingsScreen as React.LazyExoticComponent<() => React.JSX.Element>} />}
      </Tab.Screen>
    </Tab.Navigator>
  );
};

const AppNavigator = () => {
  const loadAuthState = useAuthStore((s) => s.loadAuthState);
  const loadSettings = useSettingsStore((s) => s.loadSettings);
  const authMode = useAuthStore((s) => s.authMode);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  React.useEffect(() => {
    loadAuthState();
    loadSettings();
  }, [loadAuthState, loadSettings]);

  const needsAuth = authMode !== 'guest' && !isAuthenticated;

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false, contentStyle: { flex: 1 } }}>
        {needsAuth ? (
          <Stack.Screen name="Auth">
            {() => <LazyScreen Screen={AuthScreen as React.LazyExoticComponent<() => React.JSX.Element>} />}
          </Stack.Screen>
        ) : (
          <>
            <Stack.Screen name="Main" component={MainTabs} />
            <Stack.Screen name="Debug">
              {() => <LazyScreen Screen={DebugScreen as React.LazyExoticComponent<() => React.JSX.Element>} />}
            </Stack.Screen>
            <Stack.Screen name="Reminders">
              {() => <LazyScreen Screen={RemindersScreen as React.LazyExoticComponent<() => React.JSX.Element>} />}
            </Stack.Screen>
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
};

const styles = StyleSheet.create({
  loader: {
    flex: 1,
    backgroundColor: '#0f0f1a',
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default AppNavigator;
