import React, { useContext } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { AuthProvider, AuthContext } from './src/context/AuthContext';
import LoginScreen from './src/screens/LoginScreen';
import ParentDashboard from './src/screens/ParentDashboard';
import AdminDashboard from './src/screens/AdminDashboard';
import ComptableDashboard from './src/screens/ComptableDashboard';
import { ActivityIndicator, View, StyleSheet, Platform } from 'react-native';

const Stack = createNativeStackNavigator();

function RoleBasedDashboard() {
  const { user } = useContext(AuthContext);

  if (!user) {
    return null;
  }

  switch (user.role?.toUpperCase()) {
    case 'ADMIN':
      return <AdminDashboard />;
    case 'COMPTABLE':
    case 'ACCOUNTANT':
      return <ComptableDashboard />;
    default:
      return <ParentDashboard />;
  }
}

function RootNavigator() {
  const { token, user, isLoading } = useContext(AuthContext);

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#2f6cb3" />
      </View>
    );
  }

  const isSignedIn = !!token && !!user;

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      {isSignedIn ? (
        <Stack.Screen name="Dashboard" component={RoleBasedDashboard} />
      ) : (
        <Stack.Screen name="Login" component={LoginScreen} />
      )}
    </Stack.Navigator>
  );
}

export default function App() {
  return (
    <AuthProvider>
      {/* 
        Le View enveloppant avec dataSet et className empêche Google Chrome 
        de traduire la page web et de détruire les noeuds DOM de React Native Web.
      */}
      <View 
        style={styles.rootContainer} 
        className="notranslate"
        dataSet={Platform.OS === 'web' ? { google: 'notranslate' } : undefined}
      >
        <NavigationContainer>
          <RootNavigator />
        </NavigationContainer>
      </View>
    </AuthProvider>
  );
}

const styles = StyleSheet.create({
  rootContainer: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
  },
});