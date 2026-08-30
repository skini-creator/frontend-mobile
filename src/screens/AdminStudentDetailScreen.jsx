import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Alert,
  TextInput,
  Modal,
} from 'react-native';
import {
  getStudent,
  getStudentTuition,
  setStudentTuition,
  updateStudentTuition,
  getParent,
  getClasses,
} from '../services/api';

export default function AdminStudentDetailScreen({ studentId, onBack }) {
  const [student, setStudent] = useState(null);
  const [tuition, setTuition] = useState(null);
  const [parent, setParent] = useState(null);
  const [classList, setClassList] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showTuitionModal, setShowTuitionModal] = useState(false);
  const [tuitionAmount, setTuitionAmount] = useState('');
  const [isSetting, setIsSetting] = useState(false);

  const resolveClassName = (st) => {
    if (!st) return 'N/A';
    if (typeof st.class_name === 'string' && st.class_name.trim()) return st.class_name;
    if (typeof st.class === 'string' && st.class.trim()) return st.class;
    if (typeof st.classe === 'string' && st.classe.trim()) return st.classe;
    if (typeof st.classroom === 'string' && st.classroom.trim()) return st.classroom;

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
    }

    return 'N/A';
  };

  const loadData = async () => {
    setLoading(true);
    try {
      const [studentData, tuitionData, classesData] = await Promise.all([
        getStudent(studentId),
        getStudentTuition(studentId).catch(() => null),
        getClasses().catch(() => []),
      ]);

      setStudent(studentData);
      setTuition(tuitionData);

      const list = Array.isArray(classesData)
        ? classesData
        : (classesData?.data || classesData?.classes || classesData?.items || []);
      setClassList(list);

      // Charger les données du parent
      const parentId = studentData.user_id || studentData.parent_id;
      if (parentId) {
        try {
          const parentData = await getParent(parentId);
          setParent(parentData);
        } catch (err) {
          console.warn('Parent introuvable');
        }
      }
    } catch (error) {
      console.error('Erreur:', error);
      Alert.alert('Erreur', 'Impossible de charger les données de l\'élève.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (studentId) {
      loadData();
    }
  }, [studentId]);

  const handleOpenTuitionModal = () => {
    setTuitionAmount(tuition?.total_amount?.toString() || '');
    setShowTuitionModal(true);
  };

  const handleSaveTuition = async () => {
    if (!tuitionAmount.trim()) {
      Alert.alert('Erreur', 'Veuillez entrer un montant.');
      return;
    }

    const amount = parseFloat(tuitionAmount);
    if (isNaN(amount) || amount < 0) {
      Alert.alert('Erreur', 'Montant invalide.');
      return;
    }

    setIsSetting(true);
    try {
      if (tuition && tuition.total_amount > 0) {
        // Mise à jour
        await updateStudentTuition(studentId, { total_amount: amount });
      } else {
        // Création
        await setStudentTuition(studentId, { total_amount: amount });
      }
      Alert.alert('Succès', 'Scolarité définie.');
      setShowTuitionModal(false);
      await loadData();
    } catch (error) {
      console.error('Erreur:', error);
      Alert.alert('Erreur', 'Impossible de définir la scolarité.');
    } finally {
      setIsSetting(false);
    }
  };

  if (loading || !student) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Pressable onPress={onBack}>
            <Text style={styles.backButton}>← Retour</Text>
          </Pressable>
        </View>
        <View style={styles.centerContent}>
          <ActivityIndicator size="large" color="#2563eb" />
        </View>
      </View>
    );
  }

  const balancePercentage = tuition && tuition.total_amount > 0
    ? Math.min(100, Math.round((tuition.paid_amount / tuition.total_amount) * 100))
    : 0;

  return (
    <View style={styles.container}>
      {/* En-tête */}
      <View style={styles.header}>
        <Pressable onPress={onBack}>
          <Text style={styles.backButton}>← Retour</Text>
        </Pressable>
        <Text style={styles.title}>Détail de l'élève</Text>
      </View>

      <ScrollView style={styles.content}>
        {/* Informations de base */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Informations personnelles</Text>
          <View style={styles.infoCard}>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Nom complet:</Text>
              <Text style={styles.infoValue}>
                {student.first_name} {student.last_name}
              </Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Matricule:</Text>
              <Text style={styles.infoValue}>{student.matricule || 'N/A'}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Classe:</Text>
              <Text style={styles.infoValue}>{resolveClassName(student)}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Parent:</Text>
              <Text style={styles.infoValue}>
                {parent
                  ? `${parent.first_name} ${parent.last_name}`
                  : 'N/A'}
              </Text>
            </View>
          </View>
        </View>

        {/* Situation financière */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Situation financière</Text>
            <Pressable
              style={styles.editTuitionButton}
              onPress={handleOpenTuitionModal}
            >
              <Text style={styles.editTuitionButtonText}>
                {tuition && tuition.total_amount > 0 ? 'Modifier' : 'Définir'}
              </Text>
            </Pressable>
          </View>

          {tuition && tuition.total_amount > 0 ? (
            <>
              <View style={styles.financialCard}>
                <View style={styles.financialRow}>
                  <Text style={styles.financialLabel}>Scolarité totale:</Text>
                  <Text style={styles.financialValue}>
                    {tuition.total_amount.toLocaleString('fr-FR')} FCFA
                  </Text>
                </View>
                <View style={styles.financialRow}>
                  <Text style={styles.financialLabel}>Montant payé:</Text>
                  <Text style={[styles.financialValue, styles.paidAmount]}>
                    {tuition.paid_amount.toLocaleString('fr-FR')} FCFA
                  </Text>
                </View>
                <View style={styles.financialRow}>
                  <Text style={styles.financialLabel}>Solde restant:</Text>
                  <Text style={[styles.financialValue, styles.remainingAmount]}>
                    {tuition.remaining_amount.toLocaleString('fr-FR')} FCFA
                  </Text>
                </View>

                {/* Barre de progression */}
                <View style={styles.progressContainer}>
                  <View style={[styles.progressBar, { width: `${balancePercentage}%` }]} />
                </View>
                <Text style={styles.progressText}>
                  {balancePercentage}% payé
                </Text>

                {/* Statut */}
                <View style={styles.statusContainer}>
                  <Text
                    style={[
                      styles.statusBadge,
                      tuition.status === 'SOLDE'
                        ? styles.statusSolde
                        : tuition.status === 'PARTIEL'
                        ? styles.statusPartiel
                        : styles.statusNonSolde,
                    ]}
                  >
                    {tuition.status === 'SOLDE'
                      ? '✓ SOLDE'
                      : tuition.status === 'PARTIEL'
                      ? '◐ PARTIEL'
                      : '✗ NON SOLDE'}
                  </Text>
                </View>
              </View>
            </>
          ) : (
            <View style={styles.emptyTuitionCard}>
              <Text style={styles.emptyTuitionText}>
                Aucune scolarité configurée pour cet élève.
              </Text>
              <Pressable
                style={styles.configureTuitionButton}
                onPress={handleOpenTuitionModal}
              >
                <Text style={styles.configureTuitionButtonText}>
                  Configurer la scolarité
                </Text>
              </Pressable>
            </View>
          )}
        </View>
      </ScrollView>

      {/* Modal Scolarité */}
      <Modal visible={showTuitionModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {tuition && tuition.total_amount > 0
                  ? 'Modifier la scolarité'
                  : 'Définir la scolarité'}
              </Text>
              <Pressable onPress={() => setShowTuitionModal(false)}>
                <Text style={styles.closeButton}>✕</Text>
              </Pressable>
            </View>

            <View style={styles.modalForm}>
              <Text style={styles.label}>Montant total de la scolarité (FCFA)*</Text>
              <TextInput
                style={styles.input}
                value={tuitionAmount}
                onChangeText={setTuitionAmount}
                placeholder="Ex: 300000"
                keyboardType="decimal-pad"
              />

              <Pressable
                style={styles.saveButton}
                onPress={handleSaveTuition}
                disabled={isSetting}
              >
                <Text style={styles.saveButtonText}>
                  {isSetting ? 'Enregistrement...' : 'Enregistrer'}
                </Text>
              </Pressable>
            </View>
          </View>
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
  content: {
    padding: 12,
  },
  centerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  section: {
    marginBottom: 20,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1e293b',
  },
  editTuitionButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#3b82f6',
    borderRadius: 4,
  },
  editTuitionButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  infoCard: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
    paddingBottomWidth: 1,
    paddingBottomColor: '#e2e8f0',
  },
  infoLabel: {
    fontSize: 13,
    fontWeight: '500',
    color: '#64748b',
  },
  infoValue: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1e293b',
    textAlign: 'right',
    flex: 1,
    marginLeft: 8,
  },
  financialCard: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  financialRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  financialLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#64748b',
  },
  financialValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1e293b',
  },
  paidAmount: {
    color: '#10b981',
  },
  remainingAmount: {
    color: '#ef4444',
  },
  progressContainer: {
    height: 8,
    backgroundColor: '#e2e8f0',
    borderRadius: 4,
    marginBottom: 8,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    backgroundColor: '#10b981',
    borderRadius: 4,
  },
  progressText: {
    fontSize: 12,
    color: '#64748b',
    marginBottom: 12,
  },
  statusContainer: {
    alignItems: 'center',
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 4,
    fontSize: 12,
    fontWeight: '600',
    overflow: 'hidden',
  },
  statusSolde: {
    backgroundColor: '#d1fae5',
    color: '#065f46',
  },
  statusPartiel: {
    backgroundColor: '#fef3c7',
    color: '#92400e',
  },
  statusNonSolde: {
    backgroundColor: '#fee2e2',
    color: '#991b1b',
  },
  emptyTuitionCard: {
    backgroundColor: '#fef9f3',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#fed7aa',
    borderStyle: 'dashed',
  },
  emptyTuitionText: {
    fontSize: 14,
    color: '#92400e',
    marginBottom: 12,
    textAlign: 'center',
  },
  configureTuitionButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#f59e0b',
    borderRadius: 6,
  },
  configureTuitionButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 13,
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
  modalForm: {
    marginBottom: 16,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1e293b',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 16,
    fontSize: 14,
    color: '#1e293b',
  },
  saveButton: {
    padding: 12,
    backgroundColor: '#2563eb',
    borderRadius: 6,
    alignItems: 'center',
  },
  saveButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
});
