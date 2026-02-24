import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import LoginScreen        from './src/screens/LoginScreen';
import RegisterScreen     from './src/screens/RegisterScreen';
import ProfileSetupScreen from './src/screens/ProfileSetupScreen';
import HomeScreen         from './src/screens/HomeScreen';
import ChatScreen         from './src/screens/ChatScreen';
import CreateGroupScreen  from './src/screens/CreateGroupScreen';
import GroupChatScreen    from './src/screens/GroupChatScreen';

const Stack = createStackNavigator();

export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <NavigationContainer>
          <StatusBar style="dark" />
          <Stack.Navigator
            initialRouteName="Login"
            screenOptions={{
              headerShown: false,
              animation: 'slide_from_right',
              // Disable the gesture on all screens by default
              // We'll enable it only where we want it
              gestureEnabled: false,
            }}
          >
            {/* ── Auth screens — no back gesture, replaced when done ── */}
            <Stack.Screen
              name="Login"
              component={LoginScreen}
              options={{ gestureEnabled: false, animationTypeForReplace: 'pop' }}
            />
            <Stack.Screen
              name="Register"
              component={RegisterScreen}
              options={{ gestureEnabled: true }} // back to login is fine
            />
            <Stack.Screen
              name="ProfileSetup"
              component={ProfileSetupScreen}
              options={{ gestureEnabled: false }} // can't swipe back to register
            />

            {/* ── App screens — back gesture only within app ── */}
            <Stack.Screen
              name="Home"
              component={HomeScreen}
              options={{ gestureEnabled: false }} // no swipe back from home
            />
            <Stack.Screen
              name="Chat"
              component={ChatScreen}
              options={{ gestureEnabled: true }} // swipe back to Home ✓
            />
            <Stack.Screen
              name="CreateGroup"
              component={CreateGroupScreen}
              options={{ gestureEnabled: true }} // swipe back to Home ✓
            />
            <Stack.Screen
              name="GroupChat"
              component={GroupChatScreen}
              options={{ gestureEnabled: true }} // swipe back to Home ✓
            />
          </Stack.Navigator>
        </NavigationContainer>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}