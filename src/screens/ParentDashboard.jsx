import React, { useContext, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
  Modal,
} from 'react-native';
import { AuthContext } from '../context/AuthContext';
import api, { createPayment, getClasses } from '../services/api';

export default function ParentDashboard() {
  const { user, logout } = useContext(AuthContext);
  const [childrenList, setChildrenList] = useState([]);
  const [selectedChild, setSelectedChild] = useState(null);
  const [account, setAccount] = useState(null);
  const [paymentHistory, setPaymentHistory] = useState([]);
  const [classesMap, setClassesMap] = useState({});

  // Formulaire de paiement
  const [paymentAmount, setPaymentAmount] = useState('');
  const [transactionRef, setTransactionRef] = useState('');
  const [operator, setOperator] = useState('AIRTEL_MONEY');

  // Modale Détail Paiement
  const [selectedPayment, setSelectedPayment] = useState(null);

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const title = useMemo(() => {
    if (user?.first_name || user?.name) {
      return `Bonjour ${user.first_name || user.name}`;
    }
    return 'Espace Parent';
  }, [user]);

  // Helper pour résoudre la classe de l'élève
  const resolveClassName = (student) => {
    if (!student) return 'N/A';
    if (student.class_name) return student.class_name;
    if (typeof student.class === 'string' && student.class.trim()) return student.class;
    if (typeof student.class === 'object' && student.class !== null) {
      if (student.class.name) return student.class.name;
      if (student.class.label) return student.class.label;
    }
    if (student.class_info?.name) return student.class_info.name;
    if (student.classe) return student.classe;
    if (student.classroom) return student.classroom;

    const classId = student.class_id || student.classId;
    if (classId && classesMap[String(classId)]) {
      return classesMap[String(classId)];
    }

    return 'N/A';
  };

  // Chargement initial de la liste des enfants et des classes de l'établissement
  useEffect(() => {
    async function initData() {
      setLoading(true);
      try {
        const [childrenRes, classesRes] = await Promise.allSettled([
          api.get('/api/students/my-children'),
          getClasses(),
        ]);

        let children = [];
        if (childrenRes.status === 'fulfilled') {
          const raw = childrenRes.value?.data;
          children = Array.isArray(raw) ? raw : (raw?.data || raw?.items || []);
        }
        setChildrenList(children);
        if (children.length > 0) {
          setSelectedChild(children[0]);
        }

        if (classesRes.status === 'fulfilled') {
          const rawClasses = classesRes.value;
          const classList = Array.isArray(rawClasses) ? rawClasses : (rawClasses?.data || rawClasses?.items || []);
          const map = {};
          classList.forEach((cls) => {
            if (cls.id) {
              map[String(cls.id)] = cls.name || cls.class_name || cls.label;
            }
          });
          setClassesMap(map);
        }
      } catch (error) {
        console.warn('[ParentDashboard] Erreur initialisation:', error);
        Alert.alert('Erreur', 'Impossible de récupérer la liste des enfants.');
      } finally {
        setLoading(false);
      }
    }

    initData();
  }, []);

  // Chargement du solde et de l'historique lors du changement d'enfant (Résilient & multi-endpoints)
  const loadAccountAndHistory = async () => {
    if (!selectedChild) {
      setAccount(null);
      setPaymentHistory([]);
      return;
    }

    setLoading(true);
    const studentId = selectedChild.id || selectedChild.student_id || selectedChild._id;

    try {
      const [accountRes, tuitionRes, historyRes] = await Promise.allSettled([
        api.get(`/api/payments/account/${studentId}`),
        api.get(`/api/students/${studentId}/tuition`),
        api.get(`/api/payments/history/${studentId}`),
      ]);

      let historyData = [];
      if (historyRes.status === 'fulfilled') {
        const rawHistory = historyRes.value?.data;
        historyData = Array.isArray(rawHistory)
          ? rawHistory
          : (rawHistory?.data || rawHistory?.payments || rawHistory?.items || []);
      }
      setPaymentHistory(historyData);

      let rawAccount = {};
      if (accountRes.status === 'fulfilled') {
        rawAccount = accountRes.value?.data?.data || accountRes.value?.data?.account || accountRes.value?.data || {};
      }
      let rawTuition = {};
      if (tuitionRes.status === 'fulfilled') {
        rawTuition = tuitionRes.value?.data?.data || tuitionRes.value?.data?.tuition || tuitionRes.value?.data || {};
      }

      // Extraction résiliente du montant total
      const totalAmount = Number(
        rawAccount.total_amount ?? rawAccount.total_tuition ?? rawAccount.total ?? rawAccount.montant_total ??
        rawTuition.total_amount ?? rawTuition.total_tuition ?? rawTuition.amount ?? 0
      );

      // Calcul dynamique des paiements déjà validés depuis l'historique
      const approvedPaidFromHistory = historyData
        .filter((item) => {
          const st = String(item.status || '').toUpperCase();
          return st.includes('APPROV') || st.includes('VALID');
        })
        .reduce((sum, item) => sum + (Number(item.amount) || 0), 0);

      const fetchedPaid = Number(
        rawAccount.paid_amount ?? rawAccount.total_paid ?? rawAccount.paid ?? rawAccount.montant_paye ??
        rawTuition.paid_amount ?? rawTuition.total_paid ?? rawTuition.paid ?? 0
      );

      const paidAmount = Math.max(fetchedPaid, approvedPaidFromHistory);

      let remainingAmount = Number(
        rawAccount.remaining_amount ?? rawAccount.balance ?? rawAccount.solde ?? rawAccount.remaining ??
        rawTuition.remaining_amount ?? rawTuition.balance ?? 0
      );

      if (remainingAmount <= 0 && totalAmount > 0) {
        remainingAmount = Math.max(0, totalAmount - paidAmount);
      }

      const accountStatus = rawAccount.status || rawTuition.status || (remainingAmount === 0 && totalAmount > 0 ? 'SOLDE' : 'EN_COURS');

      setAccount({
        total_amount: totalAmount,
        paid_amount: paidAmount,
        remaining_amount: remainingAmount,
        status: accountStatus,
      });
    } catch (error) {
      console.warn('[ParentDashboard] Erreur récupération données financières:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAccountAndHistory();
  }, [selectedChild]);

  // Soumission de la déclaration de paiement
  const handlePayment = async () => {
    const amount = parseFloat(paymentAmount.replace(',', '.'));

    if (!selectedChild) {
      Alert.alert('Sélection requise', 'Veuillez sélectionner un enfant.');
      return;
    }

    if (!amount || amount <= 0) {
      Alert.alert('Montant invalide', 'Veuillez saisir un montant valide.');
      return;
    }

    setSaving(true);
    try {
      const studentId = selectedChild.id || selectedChild.student_id || selectedChild._id;

      const resp = await createPayment({
        student_id: studentId,
        amount: amount,
        reference: transactionRef.trim() || undefined,
        payment_method: operator,
        operator: operator,
      });
      console.log('[ParentDashboard] Paiement déclaré:', resp);

      Alert.alert(
        'Déclaration envoyée',
        'Votre déclaration de paiement a bien été transmise. Elle sera validée sous peu par la comptabilité.'
      );
      setPaymentAmount('');
      setTransactionRef('');

      // Rafraîchissement des données
      await loadAccountAndHistory();
    } catch (error) {
      console.warn(error);
      const errorMessage =
        error?.response?.data?.detail || 'Impossible de déclarer le paiement.';
      Alert.alert('Erreur', typeof errorMessage === 'string' ? errorMessage : 'Erreur lors du paiement.');
    } finally {
      setSaving(false);
    }
  };

  // Helper pour l'affichage des badges de statut
  const getBadgeStyle = (status) => {
    switch (status) {
      case 'APPROVED':
      case 'VALIDE':
        return { badge: styles.badgeSuccess, text: styles.badgeTextSuccess, label: 'VALIDÉ' };
      case 'REJECTED':
      case 'REJETE':
        return { badge: styles.badgeDanger, text: styles.badgeTextDanger, label: 'REJETÉ' };
      default:
        return { badge: styles.badgeWarning, text: styles.badgeTextWarning, label: 'EN ATTENTE' };
    }
  };

  return (
    <ScrollView style={styles.page} contentContainerStyle={styles.content}>
      {/* 1. Entête */}
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.subtitle}>Portail Scolaire Parent</Text>
        </View>
        <Pressable style={styles.logoutButton} onPress={logout}>
          <Text style={styles.logoutText}>Déconnexion</Text>
        </Pressable>
      </View>

      {/* 2 & 3. Choix de l'enfant */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Mes enfants</Text>
        {loading && !childrenList.length ? (
          <ActivityIndicator size="small" color="#2563eb" />
        ) : childrenList.length === 0 ? (
          <Text style={styles.empty}>Aucun enfant rattaché à ce compte.</Text>
        ) : (
          <View style={styles.childList}>
            {childrenList.map((student) => {
              const studentId = student.id || student.student_id || student._id;
              const isSelected =
                selectedChild &&
                studentId === (selectedChild.id || selectedChild.student_id || selectedChild._id);

              const className = resolveClassName(student);

              return (
                <Pressable
                  key={studentId}
                  style={[styles.childCard, isSelected && styles.childCardSelected]}
                  onPress={() => setSelectedChild(student)}
                >
                  <Text style={[styles.childName, isSelected && styles.childNameSelected]}>
                    {student.full_name || `${student.first_name || ''} ${student.last_name || ''}`.trim()}
                  </Text>
                  <Text style={styles.childMeta}>
                    Classe : {className}
                    {student.matricule ? ` • Mat : ${student.matricule}` : ''}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        )}
      </View>

      {/* 4. Situation Financière */}
      {selectedChild && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Situation Financière</Text>
          {loading && account === null ? (
            <ActivityIndicator size="small" color="#2563eb" />
          ) : (
            <View style={styles.financialCard}>
              <View style={styles.financialRow}>
                <Text style={styles.financialLabel}>Montant Total :</Text>
                <Text style={styles.financialValue}>
                  {(account?.total_amount ?? 0).toLocaleString()} FCFA
                </Text>
              </View>
              <View style={styles.financialRow}>
                <Text style={styles.financialLabel}>Déjà Validé :</Text>
                <Text style={[styles.financialValue, { color: '#16a34a' }]}>
                  {(account?.paid_amount ?? 0).toLocaleString()} FCFA
                </Text>
              </View>
              <View style={[styles.financialRow, styles.financialRowBorder]}>
                <Text style={styles.financialLabelBold}>Solde Restant :</Text>
                <Text style={styles.financialValueBold}>
                  {(account?.remaining_amount ?? 0).toLocaleString()} FCFA
                </Text>
              </View>
              {account?.status && (
                <Text style={styles.statusBadge}>Statut Général : {account.status}</Text>
              )}
            </View>
          )}
        </View>
      )}

      {/* 5. Déclaration d'un Paiement */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Déclarer un paiement</Text>

        <View style={styles.operatorContainer}>
          <Pressable
            style={[styles.operatorButton, operator === 'AIRTEL_MONEY' && styles.operatorSelected]}
            onPress={() => setOperator('AIRTEL_MONEY')}
          >
            <Text style={[styles.operatorText, operator === 'AIRTEL_MONEY' && styles.operatorTextSelected]}>
              Airtel Money
            </Text>
          </Pressable>
          <Pressable
            style={[styles.operatorButton, operator === 'MOOV_MONEY' && styles.operatorSelected]}
            onPress={() => setOperator('MOOV_MONEY')}
          >
            <Text style={[styles.operatorText, operator === 'MOOV_MONEY' && styles.operatorTextSelected]}>
              Moov Money
            </Text>
          </Pressable>
        </View>

        <TextInput
          style={styles.input}
          placeholder="Montant (ex: 50000)"
          keyboardType="decimal-pad"
          value={paymentAmount}
          onChangeText={setPaymentAmount}
        />

        <TextInput
          style={styles.input}
          placeholder="Référence Transaction (ex: AM123456)"
          value={transactionRef}
          onChangeText={setTransactionRef}
        />

        <Pressable style={styles.button} onPress={handlePayment} disabled={saving}>
          <Text style={styles.buttonText}>{saving ? 'Transmission...' : 'Déclarer le paiement'}</Text>
        </Pressable>
      </View>

      {/* 6. Historique des Paiements */}
      {selectedChild && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Historique des déclarations</Text>
          {loading && paymentHistory.length === 0 ? (
            <ActivityIndicator size="small" color="#2563eb" />
          ) : paymentHistory.length === 0 ? (
            <Text style={styles.empty}>Aucun versement enregistré pour le moment.</Text>
          ) : (
            <View style={styles.historyList}>
              {paymentHistory.map((item) => {
                const badgeConfig = getBadgeStyle(item.status);

                return (
                  <Pressable
                    key={item.id}
                    style={styles.receiptCard}
                    onPress={() => setSelectedPayment(item)}
                  >
                    <View style={styles.receiptHeader}>
                      <Text style={styles.receiptRef}>{item.reference || `RÉF #${item.id}`}</Text>
                      <View style={[styles.badge, badgeConfig.badge]}>
                        <Text style={badgeConfig.text}>{badgeConfig.label}</Text>
                      </View>
                    </View>
                    <View style={styles.receiptBody}>
                      <Text style={styles.receiptAmount}>
                        +{Number(item.amount).toLocaleString()} FCFA
                      </Text>
                      <Text style={styles.receiptDate}>
                        {item.payment_date
                          ? new Date(item.payment_date).toLocaleDateString('fr-FR')
                          : 'N/A'}
                      </Text>
                    </View>
                  </Pressable>
                );
              })}
            </View>
          )}
        </View>
      )}

      {/* 7. Modale Détail d'un Paiement */}
      <Modal visible={!!selectedPayment} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Détail de la Déclaration</Text>
            {selectedPayment && (
              <View style={styles.modalBody}>
                <Text style={styles.modalText}>
                  <Text style={styles.bold}>Référence :</Text> {selectedPayment.reference || 'N/A'}
                </Text>
                <Text style={styles.modalText}>
                  <Text style={styles.bold}>Montant :</Text> {Number(selectedPayment.amount).toLocaleString()} FCFA
                </Text>
                <Text style={styles.modalText}>
                  <Text style={styles.bold}>Opérateur :</Text> {selectedPayment.operator || 'AIRTEL_MONEY'}
                </Text>
                <Text style={styles.modalText}>
                  <Text style={styles.bold}>Statut :</Text> {getBadgeStyle(selectedPayment.status).label}
                </Text>
                {selectedPayment.rejection_reason && (
                  <Text style={[styles.modalText, { color: '#dc2626' }]}>
                    <Text style={styles.bold}>Motif du rejet :</Text> {selectedPayment.rejection_reason}
                  </Text>
                )}
                <Text style={styles.modalText}>
                  <Text style={styles.bold}>Date :</Text>{' '}
                  {selectedPayment.payment_date
                    ? new Date(selectedPayment.payment_date).toLocaleString('fr-FR')
                    : 'N/A'}
                </Text>
              </View>
            )}
            <Pressable style={styles.closeButton} onPress={() => setSelectedPayment(null)}>
              <Text style={styles.closeButtonText}>Fermer</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#f8fafc' },
  content: { padding: 20, paddingBottom: 40 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  title: { fontSize: 24, fontWeight: '700', color: '#1e293b' },
  subtitle: { color: '#64748b', fontSize: 14 },
  logoutButton: { paddingVertical: 8, paddingHorizontal: 12, borderRadius: 8, backgroundColor: '#fee2e2' },
  logoutText: { color: '#dc2626', fontWeight: '600' },
  section: { marginBottom: 24 },
  sectionTitle: { fontSize: 18, fontWeight: '700', color: '#0f172a', marginBottom: 12 },
  childList: { gap: 10 },
  childCard: { padding: 14, borderRadius: 12, backgroundColor: '#ffffff', borderWidth: 1, borderColor: '#e2e8f0' },
  childCardSelected: { borderColor: '#2563eb', backgroundColor: '#eff6ff' },
  childName: { fontSize: 16, fontWeight: '600', color: '#0f172a' },
  childNameSelected: { color: '#1d4ed8' },
  childMeta: { marginTop: 4, color: '#64748b', fontSize: 13 },
  financialCard: { padding: 16, backgroundColor: '#ffffff', borderRadius: 12, borderWidth: 1, borderColor: '#e2e8f0' },
  financialRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  financialRowBorder: { borderTopWidth: 1, borderTopColor: '#f1f5f9', paddingTop: 8, marginTop: 4 },
  financialLabel: { color: '#64748b', fontSize: 14 },
  financialValue: { fontWeight: '600', fontSize: 15, color: '#0f172a' },
  financialLabelBold: { fontWeight: '700', color: '#0f172a', fontSize: 15 },
  financialValueBold: { fontWeight: '700', color: '#2563eb', fontSize: 18 },
  statusBadge: { marginTop: 8, fontSize: 12, color: '#475569', fontStyle: 'italic' },
  operatorContainer: { flexDirection: 'row', gap: 10, marginBottom: 12 },
  operatorButton: { flex: 1, padding: 12, borderRadius: 10, borderWidth: 1, borderColor: '#cbd5e1', alignItems: 'center' },
  operatorSelected: { backgroundColor: '#2563eb', borderColor: '#2563eb' },
  operatorText: { color: '#475569', fontWeight: '600' },
  operatorTextSelected: { color: '#ffffff' },
  input: { height: 48, borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 10, paddingHorizontal: 14, backgroundColor: '#ffffff', marginBottom: 12 },
  button: { height: 48, borderRadius: 10, backgroundColor: '#2563eb', justifyContent: 'center', alignItems: 'center' },
  buttonText: { color: '#ffffff', fontWeight: '600', fontSize: 15 },
  empty: { color: '#64748b', fontSize: 14 },
  historyList: { gap: 10 },
  receiptCard: { padding: 14, backgroundColor: '#ffffff', borderRadius: 10, borderWidth: 1, borderColor: '#e2e8f0' },
  receiptHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  receiptRef: { fontWeight: '700', color: '#1e293b' },
  
  // Badges
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  badgeSuccess: { backgroundColor: '#dcfce7' },
  badgeTextSuccess: { color: '#15803d', fontWeight: '700', fontSize: 11 },
  badgeWarning: { backgroundColor: '#fef3c7' },
  badgeTextWarning: { color: '#b45309', fontWeight: '700', fontSize: 11 },
  badgeDanger: { backgroundColor: '#fee2e2' },
  badgeTextDanger: { color: '#b91c1c', fontWeight: '700', fontSize: 11 },

  receiptBody: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  receiptAmount: { color: '#0f172a', fontWeight: '700', fontSize: 16 },
  receiptDate: { color: '#64748b', fontSize: 12 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 20 },
  modalContent: { backgroundColor: '#ffffff', borderRadius: 16, padding: 20 },
  modalTitle: { fontSize: 18, fontWeight: '700', marginBottom: 16, color: '#0f172a' },
  modalBody: { gap: 8, marginBottom: 20 },
  modalText: { fontSize: 15, color: '#334155' },
  bold: { fontWeight: '700' },
  closeButton: { backgroundColor: '#e2e8f0', padding: 12, borderRadius: 10, alignItems: 'center' },
  closeButtonText: { fontWeight: '600', color: '#1e293b' },
});