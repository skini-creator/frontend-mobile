import React, { useContext, useEffect, useState, useMemo, useCallback, useRef } from 'react';
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
import { fetchAllPayments, validatePayment, rejectPayment } from '../services/api';

export default function ComptableDashboard() {
  const { user, logout, token } = useContext(AuthContext);

  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPayment, setSelectedPayment] = useState(null);

  const [isRejecting, setIsRejecting] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');
  const [lastFetchError, setLastFetchError] = useState(null);

  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const parseStatusValue = useCallback((status) => {
    if (!status) return '';
    let val = status;
    if (typeof status === 'object') {
      val = status.value || status.name || status.status || String(status);
    }
    const cleanStr = String(val).toUpperCase().trim();

    if (cleanStr.includes('APPROV') || cleanStr.includes('VALID')) return 'APPROVED';
    if (cleanStr.includes('PEND') || cleanStr.includes('ATTENT')) return 'PENDING';
    if (cleanStr.includes('REJECT') || cleanStr.includes('REJET')) return 'REJECTED';

    return cleanStr;
  }, []);

  const fetchComptableData = useCallback(async (isInitial = false) => {
    try {
      console.log('[ComptableDashboard] 🔄 Récupération des paiements...');
      const response = await fetchAllPayments();

      if (!isMountedRef.current) return;

      let rawList = [];
      if (Array.isArray(response)) {
        rawList = response;
      } else if (response && Array.isArray(response.items)) {
        rawList = response.items;
      } else if (response && Array.isArray(response.data)) {
        rawList = response.data;
      }

      console.log(`[ComptableDashboard] ✅ ${rawList.length} paiements chargés.`);
      
      // On ne met à jour le state que si on reçoit un résultat valide
      if (Array.isArray(rawList)) {
        setPayments(rawList);
      }
      setLastFetchError(null);
    } catch (error) {
      console.error('[ComptableDashboard] ❌ Erreur fetch:', error);
      if (!isMountedRef.current) return;

      const errMsg = error.response?.data?.detail || error.message || 'Erreur de connexion';
      setLastFetchError(errMsg);
    } finally {
      if (isMountedRef.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    fetchComptableData(true);
  }, [fetchComptableData]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchComptableData(false);
  };

  const handleValidate = async (paymentId) => {
    try {
      setActionLoading(true);
      await validatePayment(paymentId);
      Alert.alert('Succès', 'Le paiement a été validé avec succès.');
      setSelectedPayment(null);
      await fetchComptableData(false);
    } catch (error) {
      console.error(error);
      Alert.alert('Erreur', error.response?.data?.detail || 'Échec de la validation.');
    } finally {
      if (isMountedRef.current) setActionLoading(false);
    }
  };

  const handleConfirmReject = async () => {
    const finalReason = rejectionReason.trim() || 'Référence introuvable';

    try {
      setActionLoading(true);
      await rejectPayment(selectedPayment.id, finalReason);
      
      Alert.alert('Information', `Paiement rejeté. Motif envoyé au parent : "${finalReason}"`);
      
      setIsRejecting(false);
      setRejectionReason('');
      setSelectedPayment(null);
      
      await fetchComptableData(false);
    } catch (error) {
      console.error('[ComptableDashboard] Erreur rejet:', error);
      Alert.alert('Erreur', error.response?.data?.detail || 'Échec du rejet.');
    } finally {
      if (isMountedRef.current) setActionLoading(false);
    }
  };

  const stats = useMemo(() => {
    if (!Array.isArray(payments) || payments.length === 0) {
      return { totalCollected: 0, totalCount: 0, pendingCount: 0 };
    }

    let totalCollected = 0;
    let pendingCount = 0;

    payments.forEach((item) => {
      const st = parseStatusValue(item.status);

      if (st === 'APPROVED') {
        let val = item.amount;
        if (typeof val === 'string') {
          val = parseFloat(val.replace(',', '.'));
        }
        val = Number(val);
        if (!isNaN(val)) {
          totalCollected += val;
        }
      } else if (st === 'PENDING') {
        pendingCount += 1;
      }
    });

    return { totalCollected, totalCount: payments.length, pendingCount };
  }, [payments, parseStatusValue]);

  const filteredPayments = useMemo(() => {
    if (!searchQuery.trim()) return payments;
    const query = searchQuery.toLowerCase();

    return payments.filter((item) => {
      const ref = (item.reference || '').toLowerCase();
      const studentName = (
        item.student_name ||
        item.student?.full_name ||
        `${item.student?.first_name || ''} ${item.student?.last_name || ''}`
      ).toLowerCase();
      const operator = (item.operator || '').toLowerCase();

      return ref.includes(query) || studentName.includes(query) || operator.includes(query);
    });
  }, [payments, searchQuery]);

  const getBadgeStyle = (rawStatus) => {
    const st = parseStatusValue(rawStatus);
    if (st === 'APPROVED') {
      return { badge: styles.badgeSuccess, text: styles.badgeTextSuccess, label: 'VALIDÉ' };
    }
    if (st === 'REJECTED') {
      return { badge: styles.badgeDanger, text: styles.badgeTextDanger, label: 'REJETÉ' };
    }
    return { badge: styles.badgeWarning, text: styles.badgeTextWarning, label: 'EN ATTENTE' };
  };

  return (
    <ScrollView
      style={styles.page}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      {/* En-tête */}
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>
            {user?.first_name ? `Bonjour ${user.first_name}` : 'Espace Comptabilité'}
          </Text>
          <Text style={styles.subtitle}>Validation des paiements et suivi financier</Text>
        </View>
        <Pressable
          style={styles.logoutButton}
          onPress={async () => {
            try {
              await logout();
            } catch (error) {
              console.warn('Échec de la déconnexion', error);
            }
          }}
        >
          <Text style={styles.logoutText}>Déconnexion</Text>
        </Pressable>
      </View>

      {/* Bannière d'erreur */}
      {lastFetchError && (
        <View style={styles.errorBanner}>
          <Text style={styles.errorBannerText}>
            ⚠️ Erreur de synchronisation : {lastFetchError}
          </Text>
          <Pressable style={styles.retryBtn} onPress={() => fetchComptableData(true)}>
            <Text style={styles.retryBtnText}>Réessayer</Text>
          </Pressable>
        </View>
      )}

      {/* Cartes KPI */}
      <View style={styles.kpiContainer}>
        <View style={styles.kpiCard}>
          <Text style={styles.kpiLabel}>Total Encaissé</Text>
          <Text style={styles.kpiValueSuccess}>
            {stats.totalCollected.toLocaleString('fr-FR')} FCFA
          </Text>
        </View>
        <View style={styles.kpiCard}>
          <Text style={styles.kpiLabel}>À Valider</Text>
          <Text style={styles.kpiValueWarning}>{stats.pendingCount}</Text>
        </View>
      </View>

      {/* Recherche */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Toutes les Transactions</Text>
        <TextInput
          style={styles.searchInput}
          placeholder="Rechercher par référence, élève..."
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
      </View>

      {/* Liste des paiements */}
      {loading && payments.length === 0 ? (
        <ActivityIndicator size="large" color="#2563eb" style={{ marginTop: 20 }} />
      ) : filteredPayments.length === 0 ? (
        <Text style={styles.emptyText}>Aucun paiement trouvé.</Text>
      ) : (
        <View style={styles.list}>
          {filteredPayments.map((item) => {
            const dateStr = item.payment_date
              ? new Date(item.payment_date).toLocaleDateString('fr-FR', {
                  day: '2-digit',
                  month: 'short',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })
              : 'N/A';

            const displayName =
              item.student_name ||
              item.student?.full_name ||
              (item.student?.first_name
                ? `${item.student.first_name} ${item.student.last_name || ''}`
                : null) ||
              `Élève #${item.student_account_id || item.student_id || item.id}`;

            const badgeConfig = getBadgeStyle(item.status);

            return (
              <Pressable
                key={item.id}
                style={styles.card}
                onPress={() => {
                  setSelectedPayment(item);
                  setIsRejecting(false);
                  setRejectionReason('');
                }}
              >
                <View style={styles.cardHeader}>
                  <Text style={styles.studentName}>{displayName}</Text>
                  <View style={[styles.badge, badgeConfig.badge]}>
                    <Text style={badgeConfig.text}>{badgeConfig.label}</Text>
                  </View>
                </View>

                <View style={styles.cardBody}>
                  <View>
                    <Text style={styles.amount}>
                      +{Number(item.amount || 0).toLocaleString('fr-FR')} FCFA
                    </Text>
                    <Text style={styles.dateText}>{dateStr}</Text>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={styles.refText}>{item.reference}</Text>
                    <Text style={styles.operatorText}>{item.operator || 'Mobile Money'}</Text>
                  </View>
                </View>
              </Pressable>
            );
          })}
        </View>
      )}

      {/* Modale de détail */}
      <Modal visible={!!selectedPayment} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Détails du Paiement</Text>

            {selectedPayment && (
              <View style={styles.modalBody}>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Élève :</Text>
                  <Text style={styles.detailValue}>
                    {selectedPayment.student_name ||
                      selectedPayment.student?.full_name ||
                      `Élève #${selectedPayment.student_account_id || selectedPayment.id}`}
                  </Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Référence :</Text>
                  <Text style={styles.detailValue}>{selectedPayment.reference}</Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Montant :</Text>
                  <Text style={styles.detailValueBold}>
                    {Number(selectedPayment.amount || 0).toLocaleString('fr-FR')} FCFA
                  </Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Opérateur :</Text>
                  <Text style={styles.detailValue}>{selectedPayment.operator || 'Mobile Money'}</Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Statut :</Text>
                  <Text style={styles.detailValue}>
                    {getBadgeStyle(selectedPayment.status).label}
                  </Text>
                </View>

                {selectedPayment.rejection_reason && (
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Raison du rejet :</Text>
                    <Text style={[styles.detailValue, { color: '#dc2626' }]}>
                      {selectedPayment.rejection_reason}
                    </Text>
                  </View>
                )}

                {isRejecting && (
                  <View style={styles.rejectContainer}>
                    <Text style={styles.rejectLabel}>Raison du rejet :</Text>
                    <TextInput
                      style={styles.rejectInput}
                      placeholder="Ex: Référence introuvable (par défaut)"
                      value={rejectionReason}
                      onChangeText={setRejectionReason}
                    />
                  </View>
                )}

                {parseStatusValue(selectedPayment.status) === 'PENDING' && (
                  <View style={{ marginTop: 15 }}>
                    {actionLoading ? (
                      <ActivityIndicator size="small" color="#2563eb" />
                    ) : isRejecting ? (
                      <View style={{ flexDirection: 'row', gap: 10 }}>
                        <Pressable
                          style={[styles.actionBtn, { backgroundColor: '#dc2626', flex: 1 }]}
                          onPress={handleConfirmReject}
                        >
                          <Text style={styles.actionBtnText}>Confirmer le Rejet</Text>
                        </Pressable>
                        <Pressable
                          style={[styles.actionBtn, { backgroundColor: '#94a3b8', flex: 1 }]}
                          onPress={() => setIsRejecting(false)}
                        >
                          <Text style={styles.actionBtnText}>Annuler</Text>
                        </Pressable>
                      </View>
                    ) : (
                      <View style={{ flexDirection: 'row', gap: 10 }}>
                        <Pressable
                          style={[styles.actionBtn, { backgroundColor: '#16a34a', flex: 1 }]}
                          onPress={() => handleValidate(selectedPayment.id)}
                        >
                          <Text style={styles.actionBtnText}>Valider</Text>
                        </Pressable>
                        <Pressable
                          style={[styles.actionBtn, { backgroundColor: '#dc2626', flex: 1 }]}
                          onPress={() => setIsRejecting(true)}
                        >
                          <Text style={styles.actionBtnText}>Rejeter</Text>
                        </Pressable>
                      </View>
                    )}
                  </View>
                )}
              </View>
            )}

            <Pressable
              style={styles.closeButton}
              onPress={() => {
                setSelectedPayment(null);
                setIsRejecting(false);
              }}
            >
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
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  title: { fontSize: 22, fontWeight: '700', color: '#1e293b' },
  subtitle: { fontSize: 13, color: '#64748b', marginTop: 2 },
  logoutButton: { paddingVertical: 8, paddingHorizontal: 12, borderRadius: 8, backgroundColor: '#fee2e2' },
  logoutText: { color: '#dc2626', fontWeight: '600', fontSize: 13 },
  errorBanner: {
    backgroundColor: '#fef2f2',
    borderColor: '#fca5a5',
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    marginBottom: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  errorBannerText: { color: '#991b1b', fontSize: 13, flex: 1 },
  retryBtn: { backgroundColor: '#dc2626', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 6 },
  retryBtnText: { color: '#fff', fontSize: 12, fontWeight: '600' },
  kpiContainer: { flexDirection: 'row', gap: 12, marginBottom: 20 },
  kpiCard: {
    flex: 1,
    padding: 16,
    backgroundColor: '#ffffff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  kpiLabel: { fontSize: 13, color: '#64748b', marginBottom: 4 },
  kpiValueSuccess: { fontSize: 18, fontWeight: '700', color: '#16a34a' },
  kpiValueWarning: { fontSize: 18, fontWeight: '700', color: '#d97706' },
  section: { marginBottom: 16 },
  sectionTitle: { fontSize: 18, fontWeight: '700', color: '#0f172a', marginBottom: 10 },
  searchInput: {
    height: 46,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 10,
    paddingHorizontal: 14,
    backgroundColor: '#ffffff',
  },
  list: { gap: 12 },
  card: {
    padding: 16,
    backgroundColor: '#ffffff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  studentName: { fontSize: 16, fontWeight: '600', color: '#0f172a' },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  badgeSuccess: { backgroundColor: '#dcfce7' },
  badgeTextSuccess: { color: '#15803d', fontWeight: '700', fontSize: 11 },
  badgeWarning: { backgroundColor: '#fef3c7' },
  badgeTextWarning: { color: '#b45309', fontWeight: '700', fontSize: 11 },
  badgeDanger: { backgroundColor: '#fee2e2' },
  badgeTextDanger: { color: '#b91c1c', fontWeight: '700', fontSize: 11 },
  cardBody: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  amount: { fontSize: 17, fontWeight: '700', color: '#0f172a' },
  dateText: { fontSize: 12, color: '#64748b', marginTop: 2 },
  refText: { fontSize: 13, fontWeight: '600', color: '#334155' },
  operatorText: { fontSize: 12, color: '#64748b', marginTop: 2 },
  emptyText: { color: '#64748b', textAlign: 'center', marginTop: 20, fontSize: 15 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 20 },
  modalContent: { backgroundColor: '#ffffff', borderRadius: 16, padding: 20 },
  modalTitle: { fontSize: 18, fontWeight: '700', marginBottom: 16, color: '#0f172a' },
  modalBody: { gap: 10, marginBottom: 20 },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  detailLabel: { fontSize: 14, color: '#64748b' },
  detailValue: { fontSize: 14, fontWeight: '600', color: '#0f172a' },
  detailValueBold: { fontSize: 16, fontWeight: '700', color: '#16a34a' },
  rejectContainer: { marginTop: 10 },
  rejectLabel: { fontSize: 13, fontWeight: '600', color: '#dc2626', marginBottom: 4 },
  rejectInput: {
    borderWidth: 1,
    borderColor: '#fca5a5',
    borderRadius: 8,
    padding: 10,
    backgroundColor: '#fff5f5',
    fontSize: 13,
  },
  actionBtn: { paddingVertical: 12, borderRadius: 10, alignItems: 'center' },
  actionBtnText: { color: '#ffffff', fontWeight: '700', fontSize: 14 },
  closeButton: { backgroundColor: '#e2e8f0', padding: 12, borderRadius: 10, alignItems: 'center' },
  closeButtonText: { fontWeight: '600', color: '#1e293b' },
});