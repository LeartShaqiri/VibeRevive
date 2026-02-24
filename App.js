import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import LoginScreen       from './src/screens/LoginScreen';
import RegisterScreen    from './src/screens/RegisterScreen';
import ProfileSetupScreen from './src/screens/ProfileSetupScreen';
import HomeScreen        from './src/screens/HomeScreen';
import ChatScreen        from './src/screens/ChatScreen';
import CreateGroupScreen from './src/screens/CreateGroupScreen';
import GroupChatScreen   from './src/screens/GroupChatScreen';

const Stack = createStackNavigator();

export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <NavigationContainer>
          <StatusBar style="dark" />
          <Stack.Navigator
            initialRouteName="Login"
            screenOptions={{ headerShown: false, animation: 'slide_from_right' }}
          >
            <Stack.Screen name="Login"        component={LoginScreen}        />
            <Stack.Screen name="Register"     component={RegisterScreen}     />
            <Stack.Screen name="ProfileSetup" component={ProfileSetupScreen} />
            <Stack.Screen name="Home"         component={HomeScreen}         />
            <Stack.Screen name="Chat"         component={ChatScreen}         />
            <Stack.Screen name="CreateGroup"  component={CreateGroupScreen}  />
            <Stack.Screen name="GroupChat"    component={GroupChatScreen}    />
          </Stack.Navigator>
        </NavigationContainer>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}