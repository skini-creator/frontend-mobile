import React, { useContext, useEffect, useState } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  ScrollView,
  TextInput,
  ActivityIndicator,
  Modal,
  Alert,
  RefreshControl,
} from 'react-native';
import { AuthContext } from '../context/AuthContext';
import { getParents, createParent, updateParent, deleteParent, getParentChildrenCount } from '../services/api';

export default function AdminParentsScreen({ onBack }) {
  const { user } = useContext(AuthContext);
  const [parents, setParents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [childrenCounts, setChildrenCounts] = useState({});

  // Champs du formulaire
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');

  const loadParents = async () => {
    setLoading(true);
    try {
      const data = await getParents();
      setParents(data || []);

      // Charger le nombre d'enfants pour chaque parent
      const counts = {};
      for (const parent of (data || [])) {
        try {
          const childCountData = await getParentChildrenCount(parent.id);
          counts[parent.id] = childCountData.children_count || 0;
        } catch (err) {
          counts[parent.id] = 0;
        }
      }
      setChildrenCounts(counts);
    } catch (error) {
      console.error('Erreur:', error);
      Alert.alert('Erreur', 'Impossible de charger les parents.');
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadParents();
    setRefreshing(false);
  };

  useEffect(() => {
    loadParents();
  }, []);

  const handleOpenModal = (parent = null) => {
    if (parent) {
      setEditingId(parent.id);
      setFirstName(parent.first_name || '');
      setLastName(parent.last_name || '');
      setEmail(parent.email || '');
      setPhone(parent.phone || '');
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
        await updateParent(editingId, payload);
        Alert.alert('Succès', 'Parent modifié.');
        setShowModal(false);
        await loadParents();
      } catch (error) {
        console.error('Erreur:', error);
        Alert.alert('Erreur', 'Impossible de modifier le parent.');
      }
    } else {
      // Création
      if (!password.trim()) {
        Alert.alert('Erreur', 'Le mot de passe est obligatoire.');
        return;
      }
      try {
        const payload = {
          first_name: firstName,
          last_name: lastName,
          email,
          phone,
          password,
          role: 'PARENT',
        };
        await createParent(payload);
        Alert.alert('Succès', 'Parent créé.');
        setShowModal(false);
        await loadParents();
      } catch (error) {
        console.error('Erreur:', error);
        const message = error?.response?.data?.detail || 'Impossible de créer le parent.';
        Alert.alert('Erreur', message);
      }
    }
  };

  const handleDeleteParent = (parent) => {
    Alert.alert(
      'Confirmer la suppression',
      `Voulez-vous vraiment supprimer le parent ${parent.first_name} ${parent.last_name} et tous ses enfants associés ?`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteParent(parent.id);
              Alert.alert('Succès', 'Parent et ses enfants supprimés avec succès.');
              await loadParents();
            } catch (error) {
              console.error('Erreur:', error);
              Alert.alert('Erreur', 'Impossible de supprimer le parent.');
            }
          },
        },
      ]
    );
  };

  return (
    <View style={styles.container}>
      {/* En-tête */}
      <View style={styles.header}>
        <Pressable onPress={onBack}>
          <Text style={styles.backButton}>← Retour</Text>
        </Pressable>
        <View>
          <Text style={styles.title}>Gestion des Parents</Text>
        </View>
      </View>

      {/* Bouton Ajouter */}
      <Pressable
        style={styles.addButton}
        onPress={() => handleOpenModal()}
      >
        <Text style={styles.addButtonText}>+ Ajouter un parent</Text>
      </Pressable>

      {/* Liste des parents */}
      {loading && parents.length === 0 ? (
        <ActivityIndicator size="large" color="#2563eb" style={{ marginTop: 20 }} />
      ) : parents.length === 0 ? (
        <Text style={styles.emptyText}>Aucun parent enregistré.</Text>
      ) : (
        <ScrollView
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        >
          {parents.map((parent) => (
            <View key={parent.id} style={styles.card}>
              <View style={styles.cardContent}>
                <Text style={styles.cardTitle}>
                  {parent.first_name} {parent.last_name}
                </Text>
                <Text style={styles.cardText}>Email: {parent.email}</Text>
                <Text style={styles.cardText}>Téléphone: {parent.phone || 'N/A'}</Text>
                <Text style={styles.cardText}>
                  Enfants: {childrenCounts[parent.id] || 0}
                </Text>
                <View style={styles.statusBadge}>
                  <Text
                    style={[
                      styles.statusText,
                      parent.is_active ? styles.statusActive : styles.statusInactive,
                    ]}
                  >
                    {parent.is_active ? 'ACTIF' : 'INACTIF'}
                  </Text>
                </View>
              </View>

              <View style={styles.cardActions}>
                <Pressable
                  style={styles.editButton}
                  onPress={() => handleOpenModal(parent)}
                >
                  <Text style={styles.editButtonText}>Modifier</Text>
                </Pressable>
                <Pressable
                  style={[styles.statusButton, styles.deleteButton]}
                  onPress={() => handleDeleteParent(parent)}
                >
                  <Text style={styles.deleteButtonText}>Supprimer</Text>
                </Pressable>
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
                {editingId ? 'Modifier un parent' : 'Ajouter un parent'}
              </Text>
              <Pressable onPress={() => setShowModal(false)}>
                <Text style={styles.closeButton}>✕</Text>
              </Pressable>
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

              <Pressable style={styles.saveButton} onPress={handleSave}>
                <Text style={styles.saveButtonText}>
                  {editingId ? 'Modifier' : 'Créer'}
                </Text>
              </Pressable>
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
  deleteButton: {
    backgroundColor: '#ef4444',
  },
  deleteButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#ffffff',
  },
});
