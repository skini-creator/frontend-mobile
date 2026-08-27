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
} from '../services/api';

export default function AdminStudentDetailScreen({ studentId, onBack }) {
  const [student, setStudent] = useState(null);
  const [tuition, setTuition] = useState(null);
  const [parent, setParent] = useState(null);
  const [loading, setLoading] = useState(false);
  const [showTuitionModal, setShowTuitionModal] = useState(false);
  const [tuitionAmount, setTuitionAmount] = useState('');
  const [isSetting, setIsSetting] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      // Charger les données de l'élève
      const studentData = await getStudent(studentId);
      setStudent(studentData);

      // Charger la scolarité
      const tuitionData = await getStudentTuition(studentId);
      setTuition(tuitionData);

      // Charger les données du parent
      if (studentData.user_id) {
        try {
          const parentData = await getParent(studentData.user_id);
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
              <Text style={styles.infoValue}>{student.class_name || 'N/A'}</Text>
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
