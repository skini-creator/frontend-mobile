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
  FlatList,
} from 'react-native';
import { AuthContext } from '../context/AuthContext';
import {
  getStudents,
  createStudent,
  updateStudent,
  toggleStudentStatus,
  getParents,
  getClasses,
  getStudentTuition,
} from '../services/api';

export default function AdminStudentsScreen({ onBack, onSelectStudent }) {
  const { user } = useContext(AuthContext);
  const [students, setStudents] = useState([]);
  const [parents, setParents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState(null);

  // Champs du formulaire
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [parentId, setParentId] = useState('');
  const [classList, setClassList] = useState([]);
  const [classId, setClassId] = useState('');

  const loadStudents = async () => {
    setLoading(true);
    try {
      const data = await getStudents();
      const list = Array.isArray(data) ? data : (data?.data || data?.students || data?.items || []);
      setStudents(list);
    } catch (error) {
      console.error('Erreur:', error);
      Alert.alert('Erreur', 'Impossible de charger les élèves.');
    } finally {
      setLoading(false);
    }
  };

  const loadParents = async () => {
    try {
      const data = await getParents();
      const list = Array.isArray(data) ? data : (data?.data || data?.parents || data?.items || []);
      setParents(list);
    } catch (error) {
      console.error('Erreur:', error);
    }
  };

  const loadClasses = async () => {
    try {
      const data = await getClasses();
      const list = Array.isArray(data) ? data : (data?.data || data?.classes || data?.items || []);
      setClassList(list);
    } catch (error) {
      console.error('Erreur chargement classes:', error);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadStudents();
    await loadClasses();
    setRefreshing(false);
  };

  useEffect(() => {
    loadStudents();
    loadParents();
    loadClasses();
  }, []);

  const handleOpenModal = (student = null) => {
    if (student) {
      setEditingId(student.id);
      setFirstName(student.first_name || '');
      setLastName(student.last_name || '');
      setParentId(student.user_id?.toString() || student.parent_id?.toString() || '');
      const currentClass = student.class_id?.toString() || student.class_name || student.classe || student.class?.toString() || '';
      setClassId(currentClass);
    } else {
      setEditingId(null);
      setFirstName('');
      setLastName('');
      setParentId('');
      setClassId('');
    }
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!firstName.trim() || !lastName.trim() || (!editingId && !parentId.trim())) {
      Alert.alert('Erreur', 'Prénom, nom et parent sont obligatoires.');
      return;
    }

    if (!classId) {
      Alert.alert('Erreur', 'Veuillez sélectionner une classe.');
      return;
    }

    // Recherche résiliente de l'objet classe correspondante
    const selectedClassObj = classList.find(
      (c) =>
        String(c.id) === String(classId) ||
        String(c.name || c.class_name || c.label).toLowerCase() === String(classId).toLowerCase()
    );

    let numericClassId = selectedClassObj
      ? (typeof selectedClassObj.id === 'number' ? selectedClassObj.id : parseInt(selectedClassObj.id))
      : (!isNaN(Number(classId)) ? Number(classId) : null);

    let classNameStr = selectedClassObj
      ? (selectedClassObj.name || selectedClassObj.class_name || selectedClassObj.label)
      : String(classId);

    const basePayload = {
      first_name: firstName.trim(),
      last_name: lastName.trim(),
      class_name: classNameStr,
      classe: classNameStr,
      classroom: classNameStr,
      class_id: numericClassId || classId,
    };

    if (editingId) {
      try {
        await updateStudent(editingId, basePayload);
        Alert.alert('Succès', 'Élève modifié.');
        setShowModal(false);
        await loadStudents();
      } catch (error) {
        console.error('Erreur modification élève:', error);
        const detail = error?.response?.data?.detail || error?.response?.data?.message || 'Impossible de modifier l\'élève.';
        const msg = typeof detail === 'string' ? detail : JSON.stringify(detail);
        Alert.alert('Erreur', msg);
      }
    } else {
      try {
        const createPayload = {
          ...basePayload,
          parent_id: parentId.trim(),
          user_id: parentId.trim(),
        };
        await createStudent(createPayload);
        Alert.alert('Succès', 'Élève créé.');
        setShowModal(false);
        await loadStudents();
      } catch (error) {
        console.error('Erreur création élève:', error);
        const detail = error?.response?.data?.detail || error?.response?.data?.message || 'Impossible de créer l\'élève.';
        const msg = typeof detail === 'string' ? detail : JSON.stringify(detail);
        Alert.alert('Erreur', msg);
      }
    }
  };

  const handleToggleStatus = async (student) => {
    try {
      await toggleStudentStatus(student.id);
      Alert.alert('Succès', `Élève ${student.is_active ? 'désactivé' : 'réactivé'}.`);
      await loadStudents();
    } catch (error) {
      console.error('Erreur:', error);
      Alert.alert('Erreur', 'Impossible de modifier le statut.');
    }
  };

  const resolveClassName = (st) => {
    if (!st) return 'N/A';
    if (typeof st.class_name === 'string' && st.class_name.trim() && st.class_name !== 'N/A') return st.class_name;
    if (typeof st.class === 'string' && st.class.trim() && st.class !== 'N/A') return st.class;
    if (typeof st.classe === 'string' && st.classe.trim() && st.classe !== 'N/A') return st.classe;
    if (typeof st.classroom === 'string' && st.classroom.trim() && st.classroom !== 'N/A') return st.classroom;

    if (typeof st.class === 'object' && st.class !== null) {
      if (st.class.name) return st.class.name;
      if (st.class.class_name) return st.class.class_name;
      if (st.class.label) return st.class.label;
    }
    if (typeof st.class_info === 'object' && st.class_info !== null) {
      if (st.class_info.name) return st.class_info.name;
      if (st.class_info.class_name) return st.class_info.class_name;
      if (st.class_info.label) return st.class_info.label;
    }

    const classId = st.class_id || st.classId || st.class_info?.id || st.class?.id;
    if (classId !== undefined && classId !== null) {
      const match = classList.find((c) => String(c.id) === String(classId));
      if (match) {
        return match.name || match.class_name || match.label || `Classe ${match.id}`;
      }
      if (typeof classId === 'string' && classId.trim() && isNaN(Number(classId))) {
        return classId;
      }
    }

    return 'N/A';
  };

  const getParentName = (st) => {
    if (!st) return 'N/A';
    if (st.parent_name) return st.parent_name;
    if (typeof st.parent === 'string' && st.parent.trim()) return st.parent;
    if (typeof st.parent === 'object' && st.parent !== null) {
      if (st.parent.first_name || st.parent.last_name) {
        return `${st.parent.first_name || ''} ${st.parent.last_name || ''}`.trim();
      }
      if (st.parent.full_name) return st.parent.full_name;
      if (st.parent.name) return st.parent.name;
    }

    const userId = st.user_id || st.parent_id || st.parentId;
    const parent = parents.find((p) => String(p.id) === String(userId) || String(p.user_id) === String(userId));
    return parent ? `${parent.first_name || ''} ${parent.last_name || ''}`.trim() : 'N/A';
  };

  return (
    <View style={styles.container}>
      {/* En-tête */}
      <View style={styles.header}>
        <Pressable onPress={onBack}>
          <Text style={styles.backButton}>← Retour</Text>
        </Pressable>
        <View>
          <Text style={styles.title}>Gestion des Élèves</Text>
        </View>
      </View>

      {/* Bouton Ajouter */}
      <Pressable
        style={styles.addButton}
        onPress={() => handleOpenModal()}
      >
        <Text style={styles.addButtonText}>+ Ajouter un élève</Text>
      </Pressable>

      {/* Liste des élèves */}
      {loading && students.length === 0 ? (
        <ActivityIndicator size="large" color="#2563eb" style={{ marginTop: 20 }} />
      ) : students.length === 0 ? (
        <Text style={styles.emptyText}>Aucun élève enregistré.</Text>
      ) : (
        <ScrollView
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        >
          {students.map((student) => (
            <View key={student.id} style={styles.card}>
              <Pressable
                style={styles.cardContent}
                onPress={() => onSelectStudent && onSelectStudent(student)}
              >
                <Text style={styles.cardTitle}>
                  {student.first_name} {student.last_name}
                </Text>
                <Text style={styles.cardText}>Matricule: {student.matricule || 'N/A'}</Text>
                <Text style={styles.cardText}>Classe: {resolveClassName(student)}</Text>
                <Text style={styles.cardText}>
                  Parent: {getParentName(student)}
                </Text>
                <View style={styles.statusBadge}>
                  <Text
                    style={[
                      styles.statusText,
                      student.is_active ? styles.statusActive : styles.statusInactive,
                    ]}
                  >
                    {student.is_active ? 'ACTIF' : 'INACTIF'}
                  </Text>
                </View>
              </Pressable>

              <View style={styles.cardActions}>
                <Pressable
                  style={styles.detailButton}
                  onPress={() => onSelectStudent && onSelectStudent(student)}
                >
                  <Text style={styles.detailButtonText}>Détails</Text>
                </Pressable>
                <Pressable
                  style={styles.editButton}
                  onPress={() => handleOpenModal(student)}
                >
                  <Text style={styles.editButtonText}>Modifier</Text>
                </Pressable>
                <Pressable
                  style={[
                    styles.statusButton,
                    student.is_active ? styles.disableButton : styles.enableButton,
                  ]}
                  onPress={() => handleToggleStatus(student)}
                >
                  <Text style={styles.statusButtonText}>
                    {student.is_active ? 'Désactiver' : 'Réactiver'}
                  </Text>
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
                {editingId ? 'Modifier un élève' : 'Ajouter un élève'}
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

              {!editingId && (
                <>
                  <Text style={styles.label}>Parent*</Text>
                  <View style={styles.pickerContainer}>
                    <ScrollView
                      style={styles.picker}
                      nestedScrollEnabled={true}
                    >
                      {parents.map((parent) => (
                        <Pressable
                          key={parent.id}
                          style={[
                            styles.pickerItem,
                            parentId === parent.id.toString() && styles.pickerItemSelected,
                          ]}
                          onPress={() => setParentId(parent.id.toString())}
                        >
                          <Text
                            style={[
                              styles.pickerItemText,
                              parentId === parent.id.toString() && styles.pickerItemTextSelected,
                            ]}
                          >
                            {parent.first_name} {parent.last_name}
                          </Text>
                        </Pressable>
                      ))}
                    </ScrollView>
                  </View>
                </>
              )}

              <Text style={styles.label}>Classe (6ème à Terminale)*</Text>
              <View style={styles.pickerContainer}>
                <ScrollView style={styles.picker} nestedScrollEnabled={true}>
                  {Array.isArray(classList) && classList.length > 0 ? (
                    classList.map((cls) => {
                      const cId = String(cls.id ?? cls.name ?? '');
                      const cName = cls.name || cls.class_name || cls.label || `Classe ${cls.id}`;
                      const isSelected =
                        String(classId) === String(cls.id) ||
                        String(classId).toLowerCase() === String(cName).toLowerCase();
                      return (
                        <Pressable
                          key={cls.id || cName}
                          style={[styles.pickerItem, isSelected && styles.pickerItemSelected]}
                          onPress={() => setClassId(String(cls.id || cName))}
                        >
                          <Text style={[styles.pickerItemText, isSelected && styles.pickerItemTextSelected]}>
                            {cName}
                          </Text>
                        </Pressable>
                      );
                    })
                  ) : (
                    ['6ème A', '6ème B', '5ème A', '4ème A', '3ème A', '2nde C', '1ère D', 'Terminale C', 'Terminale D'].map((name, idx) => {
                      const isSelected = String(classId).toLowerCase() === String(name).toLowerCase();
                      return (
                        <Pressable
                          key={idx}
                          style={[styles.pickerItem, isSelected && styles.pickerItemSelected]}
                          onPress={() => setClassId(name)}
                        >
                          <Text style={[styles.pickerItemText, isSelected && styles.pickerItemTextSelected]}>
                            {name}
                          </Text>
                        </Pressable>
                      );
                    })
                  )}
                </ScrollView>
              </View>

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
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    overflow: 'hidden',
  },
  cardContent: {
    padding: 12,
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
    gap: 4,
    paddingHorizontal: 12,
    paddingBottom: 12,
  },
  detailButton: {
    flex: 1,
    padding: 8,
    backgroundColor: '#10b981',
    borderRadius: 6,
    alignItems: 'center',
  },
  detailButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
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
  pickerContainer: {
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 6,
    marginBottom: 12,
    maxHeight: 200,
  },
  picker: {
    maxHeight: 200,
  },
  pickerItem: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  pickerItemSelected: {
    backgroundColor: '#dbeafe',
  },
  pickerItemText: {
    fontSize: 14,
    color: '#64748b',
  },
  pickerItemTextSelected: {
    color: '#2563eb',
    fontWeight: '600',
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
});
