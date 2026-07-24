import React, { useState, useContext } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { AuthContext } from '../context/AuthContext';

export default function LoginScreen() {
  const { login } = useContext(AuthContext);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    // 1. Validation basique des champs
    if (!email.trim() || !password.trim()) {
      Alert.alert('Champs requis', 'Veuillez remplir votre adresse email et votre mot de passe.');
      return;
    }

    try {
      setLoading(true);
      
      // 2. Appel de la fonction login du contexte
      const userData = await login(email.trim(), password);

      console.log('Connexion réussie pour :', userData);
      // La redirection vers ComptableDashboard (ou ParentDashboard) 
      // est gérée automatiquement par App.js grâce au changement d'état du contexte.

    } catch (error) {
      console.error('Erreur de connexion :', error);
      Alert.alert(
        'Échec de la connexion',
        error.message || 'Identifiants incorrects ou problème réseau.'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <View style={styles.card}>
          {/* En-tête du formulaire */}
          <View style={styles.header}>
            <Text style={styles.title}>Portail Scolaire</Text>
            <Text style={styles.subtitle}>Connectez-vous à votre espace</Text>
          </View>

          {/* Formulaire */}
          <View style={styles.form}>
            {/* Champ Email */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Adresse Email</Text>
              <TextInput
                style={styles.input}
                placeholder="exemple@ecole.ga"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>

            {/* Champ Mot de passe */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Mot de passe</Text>
              <TextInput
                style={styles.input}
                placeholder="••••••••"
                value={password}
                onChangeText={setPassword}
                secureTextEntry
              />
            </View>

            {/* Bouton de Soumission */}
            <Pressable
              style={[styles.button, loading && styles.buttonDisabled]}
              onPress={handleLogin}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#ffffff" />
              ) : (
                <Text style={styles.buttonText}>Se connecter</Text>
              )}
            </Pressable>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    padding: 20,
  },
  card: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 24,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    // Ombre sous iOS / Web
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    // Ombre sous Android
    elevation: 3,
  },
  header: {
    alignItems: 'center',
    marginBottom: 24,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1e293b',
  },
  subtitle: {
    fontSize: 14,
    color: '#64748b',
    marginTop: 4,
  },
  form: {
    gap: 16,
  },
  inputGroup: {
    gap: 6,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: '#334155',
  },
  input: {
    height: 48,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 10,
    paddingHorizontal: 14,
    backgroundColor: '#f8fafc',
    fontSize: 15,
    color: '#0f172a',
  },
  button: {
    height: 48,
    backgroundColor: '#2563eb',
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
  },
  buttonDisabled: {
    backgroundColor: '#93c5fd',
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '700',
  },
});