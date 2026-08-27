import React from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { AuthProvider, useAuth } from './src/context/AuthContext';
import AdminDashboard from './src/screens/AdminDashboard';
import ComptableDashboard from './src/screens/ComptableDashboard';
import LoginScreen from './src/screens/LoginScreen';
import ParentDashboard from './src/screens/ParentDashboard';

function AppContent() {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#2563eb" />
        <Text style={styles.loadingText}>Chargement...</Text>
      </View>
    );
  }

  if (!user) {
    return <LoginScreen />;
  }

  const role = String(user.role || '').toUpperCase();

  if (role === 'ADMIN' || role === 'ADMINISTRATOR') {
    return <AdminDashboard />;
  }

  if (role === 'COMPTABLE' || role === 'ACCOUNTANT') {
    return <ComptableDashboard />;
  }

  return <ParentDashboard />;
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f8fafc',
  },
  loadingText: {
    marginTop: 12,
    color: '#475569',
  },
});