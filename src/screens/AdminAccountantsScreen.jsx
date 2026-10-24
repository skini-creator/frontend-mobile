import React, { useContext, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  ActivityIndicator,
  Modal,
  Alert,
  RefreshControl,
} from 'react-native';
import AnimatedButton from '../components/AnimatedButton';
import { AuthContext } from '../context/AuthContext';
import { getAccountants, createAccountant, updateAccountant, deleteAccountant } from '../services/api';

export default function AdminAccountantsScreen({ onBack }) {
  const { user } = useContext(AuthContext);
  const [accountants, setAccountants] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [deletingId, setDeletingId] = useState(null);

  // Champs du formulaire
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');

  const loadAccountants = async () => {
    setLoading(true);
    try {
      const data = await getAccountants();
      setAccountants(data || []);
    } catch (error) {
      console.error('Erreur:', error);
      Alert.alert('Erreur', 'Impossible de charger les comptables.');
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadAccountants();
    setRefreshing(false);
  };

  useEffect(() => {
    loadAccountants();
  }, []);

  const handleOpenModal = (accountant = null) => {
    if (accountant) {
      setEditingId(accountant.id);
      setFirstName(accountant.first_name || '');
      setLastName(accountant.last_name || '');
      setEmail(accountant.email || '');
      setPhone(accountant.phone || '');
      setPassword('');
    } else {
      setEditingId(null);
      setFirstName('');
      setLastName('');
      setEmail('');
      setPhone('');
      setPassword('');
    }
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!firstName.trim() || !lastName.trim() || !email.trim()) {
      Alert.alert('Erreur', 'Tous les champs sont obligatoires.');
      return;
    }

    setSaving(true);
    if (editingId) {
      // Modification
      try {
        const payload = {
          first_name: firstName,
          last_name: lastName,
          email,
          phone,
          password: password || undefined,
        };
        await updateAccountant(editingId, payload);
        Alert.alert('Succès', 'Comptable modifié.');
        setShowModal(false);
        await loadAccountants();
      } catch (error) {
        console.error('Erreur:', error);
        Alert.alert('Erreur', 'Impossible de modifier le comptable.');
      } finally {
        setSaving(false);
      }
    } else {
      // Création
      if (!password.trim()) {
        Alert.alert('Erreur', 'Le mot de passe est obligatoire.');
        setSaving(false);
        return;
      }
      try {
        const payload = {
          first_name: firstName,
          last_name: lastName,
          email,
          phone,
          password,
          role: 'COMPTABLE',
        };
        await createAccountant(payload);
        Alert.alert('Succès', 'Comptable créé.');
        setShowModal(false);
        await loadAccountants();
      } catch (error) {
        console.error('Erreur:', error);
        const message = error?.response?.data?.detail || 'Impossible de créer le comptable.';
        Alert.alert('Erreur', message);
      } finally {
        setSaving(false);
      }
    }
  };

  const handleDeleteAccountant = (accountant) => {
    Alert.alert(
      'Confirmer la suppression',
      `Voulez-vous vraiment supprimer définitivement le comptable ${accountant.first_name} ${accountant.last_name} ?`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer',
          style: 'destructive',
          onPress: async () => {
            setDeletingId(accountant.id);
            try {
              await deleteAccountant(accountant.id);
              Alert.alert('Succès', 'Comptable supprimé avec succès.');
              await loadAccountants();
            } catch (error) {
              console.error('Erreur:', error);
              Alert.alert('Erreur', 'Impossible de supprimer le comptable.');
            } finally {
              setDeletingId(null);
            }
          },
        },
      ]
    );
  };

  const handleToggleStatus = (accountant) => {
    handleDeleteAccountant(accountant);
  };

  return (
    <View style={styles.container}>
      {/* En-tête */}
      <View style={styles.header}>
        <AnimatedButton onPress={onBack}>
          <Text style={styles.backButton}>← Retour</Text>
        </AnimatedButton>
        <View>
          <Text style={styles.title}>Gestion des Comptables</Text>
        </View>
      </View>

      {/* Bouton Ajouter */}
      <AnimatedButton
        style={styles.addButton}
        onPress={() => handleOpenModal()}
      >
        <Text style={styles.addButtonText}>+ Ajouter un comptable</Text>
      </AnimatedButton>

      {/* Liste des comptables */}
      {loading && accountants.length === 0 ? (
        <ActivityIndicator size="large" color="#2563eb" style={{ marginTop: 20 }} />
      ) : accountants.length === 0 ? (
        <Text style={styles.emptyText}>Aucun comptable enregistré.</Text>
      ) : (
        <ScrollView
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        >
          {accountants.map((accountant) => (
            <View key={accountant.id} style={styles.card}>
              <View style={styles.cardContent}>
                <Text style={styles.cardTitle}>
                  {accountant.first_name} {accountant.last_name}
                </Text>
                <Text style={styles.cardText}>Email: {accountant.email}</Text>
                <Text style={styles.cardText}>Téléphone: {accountant.phone || 'N/A'}</Text>
                <View style={styles.statusBadge}>
                  <Text
                    style={[
                      styles.statusText,
                      accountant.is_active ? styles.statusActive : styles.statusInactive,
                    ]}
                  >
                    {accountant.is_active ? 'ACTIF' : 'INACTIF'}
                  </Text>
                </View>
              </View>

              <View style={styles.cardActions}>
                <AnimatedButton
                  style={styles.editButton}
                  onPress={() => handleOpenModal(accountant)}
                >
                  <Text style={styles.editButtonText}>Modifier</Text>
                </AnimatedButton>
                <AnimatedButton
                  style={[
                    styles.statusButton,
                    styles.deleteButton,
                  ]}
                  onPress={() => handleDeleteAccountant(accountant)}
                  disabled={deletingId === accountant.id}
                >
                  {deletingId === accountant.id ? (
                    <ActivityIndicator size="small" color="#ffffff" />
                  ) : (
                    <Text style={styles.deleteButtonText}>Supprimer</Text>
                  )}
                </AnimatedButton>
              </View>
            </View>
          ))}
        </ScrollView>
      )}

      {/* Modal Formulaire */}
      <Modal visible={showModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <ScrollView style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {editingId ? 'Modifier un comptable' : 'Ajouter un comptable'}
              </Text>
              <AnimatedButton onPress={() => setShowModal(false)}>
                <Text style={styles.closeButton}>✕</Text>
              </AnimatedButton>
            </View>

            <View style={styles.form}>
              <Text style={styles.label}>Prénom*</Text>
              <TextInput
                style={styles.input}
                value={firstName}
                onChangeText={setFirstName}
                placeholder="Ex: Jean"
              />

              <Text style={styles.label}>Nom*</Text>
              <TextInput
                style={styles.input}
                value={lastName}
                onChangeText={setLastName}
                placeholder="Ex: Dupont"
              />

              <Text style={styles.label}>Email*</Text>
              <TextInput
                style={styles.input}
                value={email}
                onChangeText={setEmail}
                placeholder="Email@exemple.com"
                keyboardType="email-address"
              />

              <Text style={styles.label}>Téléphone</Text>
              <TextInput
                style={styles.input}
                value={phone}
                onChangeText={setPhone}
                placeholder="+241..."
                keyboardType="phone-pad"
              />

              {!editingId && (
                <>
                  <Text style={styles.label}>Mot de passe*</Text>
                  <TextInput
                    style={styles.input}
                    value={password}
                    onChangeText={setPassword}
                    placeholder="Mot de passe sécurisé"
                    secureTextEntry
                  />
                </>
              )}

              {editingId && password && (
                <>
                  <Text style={styles.label}>Nouveau mot de passe (optionnel)</Text>
                  <TextInput
                    style={styles.input}
                    value={password}
                    onChangeText={setPassword}
                    placeholder="Laisser vide pour garder l'ancien"
                    secureTextEntry
                  />
                </>
              )}

              <AnimatedButton
                style={styles.saveButton}
                onPress={handleSave}
                disabled={saving}
              >
                {saving ? (
                  <ActivityIndicator size="small" color="#ffffff" />
                ) : (
                  <Text style={styles.saveButtonText}>
                    {editingId ? 'Modifier' : 'Créer'}
                  </Text>
                )}
              </AnimatedButton>
            </View>
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  header: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  backButton: {
    color: '#2563eb',
    marginBottom: 4,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1e293b',
  },
  addButton: {
    margin: 12,
    padding: 12,
    backgroundColor: '#2563eb',
    borderRadius: 6,
    alignItems: 'center',
  },
  addButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
  list: {
    padding: 12,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  cardContent: {
    marginBottom: 12,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1e293b',
    marginBottom: 4,
  },
  cardText: {
    fontSize: 13,
    color: '#64748b',
    marginBottom: 2,
  },
  statusBadge: {
    marginTop: 8,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    overflow: 'hidden',
  },
  statusActive: {
    backgroundColor: '#d1fae5',
    color: '#065f46',
  },
  statusInactive: {
    backgroundColor: '#fee2e2',
    color: '#991b1b',
  },
  cardActions: {
    flexDirection: 'row',
    gap: 8,
  },
  editButton: {
    flex: 1,
    padding: 8,
    backgroundColor: '#3b82f6',
    borderRadius: 6,
    alignItems: 'center',
  },
  editButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  statusButton: {
    flex: 1,
    padding: 8,
    borderRadius: 6,
    alignItems: 'center',
  },
  disableButton: {
    backgroundColor: '#fecaca',
  },
  enableButton: {
    backgroundColor: '#bfdbfe',
  },
  statusButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#1e293b',
  },
  emptyText: {
    fontSize: 14,
    color: '#64748b',
    textAlign: 'center',
    marginTop: 24,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
    paddingTop: 16,
    paddingHorizontal: 16,
    paddingBottom: 32,
    maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1e293b',
  },
  closeButton: {
    fontSize: 20,
    color: '#64748b',
  },
  form: {
    marginBottom: 16,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1e293b',
    marginBottom: 4,
  },
  input: {
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 12,
    fontSize: 14,
    color: '#1e293b',
  },
  saveButton: {
    padding: 12,
    backgroundColor: '#2563eb',
    borderRadius: 6,
    alignItems: 'center',
    marginTop: 12,
  },
  saveButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
  buttonLoadingDisabled: {
    opacity: 0.6,
  },
  deleteButton: {
    backgroundColor: '#ef4444',
  },
  deleteButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#ffffff',
  },
});
