import React, { useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet, Alert } from 'react-native';
import { useAuth } from '../context/AuthContext';
import { createUser } from '../services/api';

export default function AdminCreateUserScreen() {
  const { user, logout } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [role, setRole] = useState('COMPTABLE');
  const [loading, setLoading] = useState(false);

  const handleCreateUser = async () => {
    if (!email.trim()) return Alert.alert('Erreur', "L'email est requis.");
    if (!password.trim()) return Alert.alert('Erreur', "Le mot de passe est requis.");
    if (!firstName.trim()) return Alert.alert('Erreur', "Le prénom est requis.");
    if (!lastName.trim()) return Alert.alert('Erreur', "Le nom est requis.");

    setLoading(true);
    const payload = {
      email: email.trim(),
      password: password.trim(),
      first_name: firstName.trim(),
      last_name: lastName.trim(),
      phone: phone.trim() || null,
      role,
    };

    try {
      console.log('[AdminCreateUser] Envoi création utilisateur', payload);
      await createUser(payload);
      Alert.alert('Succès', 'Utilisateur créé.');
      setEmail('');
      setPassword('');
      setFirstName('');
      setLastName('');
      setPhone('');
    } catch (err) {
      console.error('[AdminCreateUser] Erreur création:', err);
      let detail = 'Erreur lors de la création';
      if (typeof err?.response?.data?.detail === 'string') {
        detail = err.response.data.detail;
      } else if (err?.message) {
        detail = err.message;
      }
      Alert.alert('Erreur', detail);
    } finally {
      setLoading(false);
    }
  };

  // Sécurisation de l'affichage de l'utilisateur
  const userDisplay = typeof user?.email === 'string' 
    ? user.email 
    : typeof user?.first_name === 'string' 
      ? user.first_name 
      : 'Administrateur';

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Administration</Text>
        <Text style={styles.subtitle}>{userDisplay}</Text>
      </View>

      <View style={styles.form}>
        <Text style={styles.label}>Email</Text>
        <TextInput style={styles.input} value={email} onChangeText={setEmail} keyboardType="email-address" />

        <Text style={styles.label}>Mot de passe</Text>
        <TextInput style={styles.input} value={password} onChangeText={setPassword} secureTextEntry />

        <Text style={styles.label}>Prénom</Text>
        <TextInput style={styles.input} value={firstName} onChangeText={setFirstName} autoCapitalize="words" />

        <Text style={styles.label}>Nom</Text>
        <TextInput style={styles.input} value={lastName} onChangeText={setLastName} autoCapitalize="words" />

        <Text style={styles.label}>Téléphone</Text>
        <TextInput style={styles.input} value={phone} onChangeText={setPhone} keyboardType="phone-pad" />

        <Text style={styles.label}>Rôle</Text>
        <View style={styles.roleToggleRow}>
          <Pressable
            style={[styles.roleToggle, role === 'PARENT' ? styles.roleActive : null]}
            onPress={() => setRole('PARENT')}
          >
            <Text style={role === 'PARENT' ? styles.roleTextActive : styles.roleText}>Parent</Text>
          </Pressable>
          <Pressable
            style={[styles.roleToggle, role === 'COMPTABLE' ? styles.roleActive : null]}
            onPress={() => setRole('COMPTABLE')}
          >
            <Text style={role === 'COMPTABLE' ? styles.roleTextActive : styles.roleText}>Comptable</Text>
          </Pressable>
        </View>

        <Pressable style={styles.button} onPress={handleCreateUser} disabled={loading}>
          <Text style={styles.buttonText}>{loading ? 'En cours...' : 'Créer utilisateur'}</Text>
        </Pressable>

        <Pressable style={styles.logout} onPress={logout}>
          <Text style={styles.logoutText}>Déconnexion</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc', padding: 20 },
  header: { marginBottom: 20 },
  title: { fontSize: 22, fontWeight: '700', color: '#0f172a' },
  subtitle: { fontSize: 13, color: '#64748b', marginTop: 4 },
  form: { backgroundColor: '#fff', padding: 16, borderRadius: 10 },
  label: { fontSize: 13, color: '#64748b', marginTop: 8 },
  input: { height: 44, borderRadius: 8, borderWidth: 1, borderColor: '#e2e8f0', paddingHorizontal: 10, marginTop: 6 },
  roleToggleRow: { flexDirection: 'row', marginTop: 8 },
  roleToggle: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 8, borderWidth: 1, borderColor: '#e2e8f0', marginRight: 8 },
  roleActive: { backgroundColor: '#2563eb', borderColor: '#2563eb' },
  roleText: { color: '#0f172a', fontWeight: '600' },
  roleTextActive: { color: '#fff', fontWeight: '700' },
  button: { marginTop: 14, backgroundColor: '#2563eb', padding: 12, borderRadius: 8, alignItems: 'center' },
  buttonText: { color: '#fff', fontWeight: '700' },
  logout: { marginTop: 10, alignItems: 'center' },
  logoutText: { color: '#dc2626', fontWeight: '700' },
});