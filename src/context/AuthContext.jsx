import React, { createContext, useCallback, useEffect, useMemo, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import api, { setAuthToken } from '../services/api';

const AUTH_TOKEN_KEY = 'school_portal_token';
const AUTH_USER_KEY = 'school_portal_user';

export const AuthContext = createContext({
  user: null,
  token: null,
  login: async () => {},
  logout: async () => {},
  isLoading: true,
});

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  // 1. Restauration de la session au démarrage de l'application
  useEffect(() => {
    async function restoreSession() {
      try {
        // Utilisation de getItem pour une compatibilité Web/Mobile optimale
        const tokenValue = await AsyncStorage.getItem(AUTH_TOKEN_KEY);
        const userValue = await AsyncStorage.getItem(AUTH_USER_KEY);

        if (tokenValue) {
          setAuthToken(tokenValue);
          setToken(tokenValue);
        }

        if (userValue) {
          setUser(JSON.parse(userValue));
        }
      } catch (error) {
        console.warn('Unable to restore session', error);
      } finally {
        setIsLoading(false);
      }
    }

    restoreSession();
  }, []);

  // 2. Connexion utilisateur
  const login = async (email, password) => {
    try {
      const response = await api.post('/api/auth/login', { email, password });
      const data = response.data || {};
      const jwtToken = data.access_token || data.token || data.accessToken || null;
      const userData = data.user || { role: data.role || 'PARENT', email };

      if (!jwtToken) {
        throw new Error("Le token d'authentification est manquant.");
      }

      // Application immédiate dans l'instance Axios et l'état React
      setAuthToken(jwtToken);
      setToken(jwtToken);
      setUser(userData);

      // Persistance séparée (plus stable sur le web)
      await AsyncStorage.setItem(AUTH_TOKEN_KEY, jwtToken);
      await AsyncStorage.setItem(AUTH_USER_KEY, JSON.stringify(userData));

      return userData;
    } catch (error) {
      const message =
        error?.response?.data?.detail ||
        error?.response?.data?.message ||
        error.message;
      throw new Error(message || 'Erreur de connexion.');
    }
  };

  // 3. Déconnexion utilisateur
  const logout = async () => {
    try {
      // Réinitialisation d'abord du state et des entêtes API
      setToken(null);
      setUser(null);
      setAuthToken(null);

      // Suppression des clés une par une
      await AsyncStorage.removeItem(AUTH_TOKEN_KEY);
      await AsyncStorage.removeItem(AUTH_USER_KEY);
    } catch (error) {
      console.warn('Erreur lors de la déconnexion', error);
    }
  };

  // 4. Mémorisation de la valeur du contexte
  const value = useMemo(
    () => ({ user, token, login, logout, isLoading }),
    [user, token, isLoading]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}