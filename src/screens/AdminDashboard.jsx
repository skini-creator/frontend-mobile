import React, { useContext, useEffect, useState, useMemo } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  ScrollView,
  TextInput,
  ActivityIndicator,
  Modal,
  RefreshControl,
} from 'react-native';
import { AuthContext } from '../context/AuthContext';
import { fetchAllPayments } from '../services/api';
import AdminAccountantsScreen from './AdminAccountantsScreen';
import AdminParentsScreen from './AdminParentsScreen';
import AdminStudentsScreen from './AdminStudentsScreen';
import AdminStudentDetailScreen from './AdminStudentDetailScreen';

export default function AdminDashboard() {
  const { user, logout } = useContext(AuthContext);

  const [activeTab, setActiveTab] = useState('payments'); // payments, accountants, parents, students
  const [selectedStudent, setSelectedStudent] = useState(null);

  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPayment, setSelectedPayment] = useState(null);

  // Normalise les valeurs de statut (Enum, objet ou string)
  const parseStatusValue = (status) => {
    if (!status) return '';
    if (typeof status === 'object') {
      return (status.value || status.name || String(status)).toUpperCase().trim();
    }
    return String(status).toUpperCase().trim();
  };

  // Charger la liste globale des paiements depuis l'API
  const fetchAdminData = async () => {
    try {
      const data = await fetchAllPayments();
      if (Array.isArray(data)) {
        setPayments(data);
      } else {
        setPayments([]);
      }
    } catch (error) {
      console.error('Erreur lors du chargement des paiements :', error);
    }
  };

  const loadData = async () => {
    setLoading(true);
    await fetchAdminData();
    setLoading(false);
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchAdminData();
    setRefreshing(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  // Calculs statistiques dynamiques (KPIs)
  const stats = useMemo(() => {
    if (!payments || !Array.isArray(payments) || payments.length === 0) {
      return { totalCollected: 0, totalCount: 0, pendingCount: 0 };
    }

    const approvedStatuses = ['APPROVED', 'VALIDE', 'VALIDÉ'];
    const pendingStatuses = ['PENDING', 'EN_ATTENTE', 'EN ATTENTE'];

    // Total Encaissé (Paiements approuvés)
    const totalCollected = payments.reduce((sum, item) => {
      const st = parseStatusValue(item.status);
      if (approvedStatuses.includes(st)) {
        let val = item.amount;
        if (typeof val === 'string') {
          val = parseFloat(val.replace(',', '.'));
        }
        val = Number(val);
        return sum + (isNaN(val) ? 0 : val);
      }
      return sum;
    }, 0);

    // Nombre de paiements en attente
    const pendingCount = payments.filter((p) => {
      const st = parseStatusValue(p.status);
      return pendingStatuses.includes(st);
    }).length;

    return { 
      totalCollected, 
      totalCount: payments.length,
      pendingCount
    };
  }, [payments]);

  // Filtrage par référence, nom de l'élève, classe ou opérateur
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
      const className = (item.class_name || '').toLowerCase();
      const operator = (item.operator || '').toLowerCase();

      return (
        ref.includes(query) ||
        studentName.includes(query) ||
        className.includes(query) ||
        operator.includes(query)
      );
    });
  }, [payments, searchQuery]);

  // Configuration visuelle des badges de statut
  const getBadgeStyle = (rawStatus) => {
    const st = parseStatusValue(rawStatus);
    if (['APPROVED', 'VALIDE', 'VALIDÉ'].includes(st)) {
      return { badge: styles.badgeSuccess, text: styles.badgeTextSuccess, label: 'VALIDÉ' };
    }
    if (['REJECTED', 'REJETE', 'REJETÉ'].includes(st)) {
      return { badge: styles.badgeDanger, text: styles.badgeTextDanger, label: 'REJETÉ' };
    }
    return { badge: styles.badgeWarning, text: styles.badgeTextWarning, label: 'EN ATTENTE' };
  };

  return (
    <View style={styles.container}>
      {/* Gestion du détail étudiant */}
      {selectedStudent && (
        <AdminStudentDetailScreen
          studentId={selectedStudent.id}
          onBack={() => setSelectedStudent(null)}
        />
      )}

      {/* Affichage normal du tableau de bord */}
      {!selectedStudent && (
        <>
          {/* En-tête */}
          <View style={styles.header}>
            <View>
              <Text style={styles.title}>
                {user?.first_name ? `Bonjour ${user.first_name}` : 'Espace Administration'}
              </Text>
              <Text style={styles.subtitle}>
                {activeTab === 'payments'
                  ? 'Surveillance financière et gestion des encaissements'
                  : activeTab === 'accountants'
                  ? 'Gestion des comptables'
                  : activeTab === 'parents'
                  ? 'Gestion des parents'
                  : 'Gestion des élèves'}
              </Text>
            </View>
            <Pressable style={styles.logoutButton} onPress={logout}>
              <Text style={styles.logoutText}>Déconnexion</Text>
            </Pressable>
          </View>

          {/* Onglets de navigation */}
          <View style={styles.tabContainer}>
            <Pressable
              style={[styles.tab, activeTab === 'payments' && styles.tabActive]}
              onPress={() => setActiveTab('payments')}
            >
              <Text
                style={[
                  styles.tabText,
                  activeTab === 'payments' && styles.tabTextActive,
                ]}
              >
                Paiements
              </Text>
            </Pressable>
            <Pressable
              style={[styles.tab, activeTab === 'accountants' && styles.tabActive]}
              onPress={() => setActiveTab('accountants')}
            >
              <Text
                style={[
                  styles.tabText,
                  activeTab === 'accountants' && styles.tabTextActive,
                ]}
              >
                Comptables
              </Text>
            </Pressable>
            <Pressable
              style={[styles.tab, activeTab === 'parents' && styles.tabActive]}
              onPress={() => setActiveTab('parents')}
            >
              <Text
                style={[
                  styles.tabText,
                  activeTab === 'parents' && styles.tabTextActive,
                ]}
              >
                Parents
              </Text>
            </Pressable>
            <Pressable
              style={[styles.tab, activeTab === 'students' && styles.tabActive]}
              onPress={() => setActiveTab('students')}
            >
              <Text
                style={[
                  styles.tabText,
                  activeTab === 'students' && styles.tabTextActive,
                ]}
              >
                Élèves
              </Text>
            </Pressable>
          </View>

          {/* Contenu par onglet */}
          {activeTab === 'payments' && renderPayments()}
          {activeTab === 'accountants' && (
            <AdminAccountantsScreen onBack={() => {}} />
          )}
          {activeTab === 'parents' && (
            <AdminParentsScreen onBack={() => {}} />
          )}
          {activeTab === 'students' && (
            <AdminStudentsScreen
              onBack={() => {}}
              onSelectStudent={setSelectedStudent}
            />
          )}
        </>
      )}
    </View>
  );

  function renderPayments() {
    return (
      <ScrollView
        style={styles.page}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {/* 2. Cartes KPI / Statistiques */}
        <View style={styles.kpiContainer}>
          <View style={styles.kpiCard}>
            <Text style={styles.kpiLabel}>Total Encaissé</Text>
            <Text style={styles.kpiValueSuccess}>
              {stats.totalCollected.toLocaleString('fr-FR')} FCFA
            </Text>
          </View>
          <View style={styles.kpiCard}>
            <Text style={styles.kpiLabel}>En attention</Text>
            <Text style={styles.kpiValueWarning}>{stats.pendingCount}</Text>
          </View>
          <View style={styles.kpiCard}>
            <Text style={styles.kpiLabel}>Reçus totaux</Text>
            <Text style={styles.kpiValue}>{stats.totalCount}</Text>
          </View>
        </View>

        {/* 3. Barre de recherche */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Paiements récents</Text>
          <TextInput
            style={styles.searchInput}
            placeholder="Rechercher par référence, élève, classe..."
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>

        {/* 4. Liste des paiements */}
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

              const displayClass = item.class_name ? ` • ${item.class_name}` : '';
              const badgeConfig = getBadgeStyle(item.status);

              return (
              <Pressable
                key={item.id}
                style={styles.card}
                onPress={() => setSelectedPayment(item)}
              >
                <View style={styles.cardHeader}>
                  <Text style={styles.studentName}>
                    {displayName}
                    <Text style={styles.className}>{displayClass}</Text>
                  </Text>
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
                    <Text style={styles.operatorText}>{item.operator || 'AIRTEL_MONEY'}</Text>
                  </View>
                </View>
              </Pressable>
            );
          })}
        </View>
      )}

      {/* 5. Modale de Détail du Paiement */}
      <Modal visible={!!selectedPayment} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Détails de la Transaction</Text>
            {selectedPayment && (
              <View style={styles.modalBody}>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Élève :</Text>
                  <Text style={styles.detailValue}>
                    {selectedPayment.student_name ||
                      selectedPayment.student?.full_name ||
                      `Élève #${selectedPayment.student_account_id}`}
                  </Text>
                </View>
                {selectedPayment.class_name && (
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Classe :</Text>
                    <Text style={styles.detailValue}>{selectedPayment.class_name}</Text>
                  </View>
                )}
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
                  <Text style={styles.detailValue}>{selectedPayment.operator}</Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Statut :</Text>
                  <Text style={styles.detailValue}>
                    {getBadgeStyle(selectedPayment.status).label}
                  </Text>
                </View>
                {selectedPayment.rejection_reason && (
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Motif de rejet :</Text>
                    <Text style={[styles.detailValue, { color: '#dc2626' }]}>
                      {selectedPayment.rejection_reason}
                    </Text>
                  </View>
                )}
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Date :</Text>
                  <Text style={styles.detailValue}>
                    {selectedPayment.payment_date
                      ? new Date(selectedPayment.payment_date).toLocaleString('fr-FR')
                      : 'N/A'}
                  </Text>
                </View>
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
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  // Onglets
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  tab: {
    flex: 1,
    paddingHorizontal: 12,
    paddingVertical: 14,
    alignItems: 'center',
    borderBottomWidth: 3,
    borderBottomColor: 'transparent',
  },
  tabActive: {
    borderBottomColor: '#2563eb',
  },
  tabText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#64748b',
  },
  tabTextActive: {
    color: '#2563eb',
    fontWeight: '600',
  },
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
  kpiContainer: { flexDirection: 'row', gap: 8, marginBottom: 20 },
  kpiCard: {
    flex: 1,
    padding: 12,
    backgroundColor: '#ffffff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  kpiLabel: { fontSize: 11, color: '#64748b', marginBottom: 4 },
  kpiValue: { fontSize: 16, fontWeight: '700', color: '#0f172a' },
  kpiValueSuccess: { fontSize: 15, fontWeight: '700', color: '#16a34a' },
  kpiValueWarning: { fontSize: 16, fontWeight: '700', color: '#d97706' },
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
  studentName: { fontSize: 15, fontWeight: '600', color: '#0f172a' },
  className: { fontSize: 13, color: '#64748b', fontWeight: '400' },
  
  // Badges
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  badgeSuccess: { backgroundColor: '#dcfce7' },
  badgeTextSuccess: { color: '#15803d', fontWeight: '700', fontSize: 11 },
  badgeWarning: { backgroundColor: '#fef3c7' },
  badgeTextWarning: { color: '#b45309', fontWeight: '700', fontSize: 11 },
  badgeDanger: { backgroundColor: '#fee2e2' },
  badgeTextDanger: { color: '#b91c1c', fontWeight: '700', fontSize: 11 },

  cardBody: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  amount: { fontSize: 16, fontWeight: '700', color: '#0f172a' },
  dateText: { fontSize: 12, color: '#64748b', marginTop: 2 },
  refText: { fontSize: 13, fontWeight: '600', color: '#334155' },
  operatorText: { fontSize: 12, color: '#64748b', marginTop: 2 },
  emptyText: { color: '#64748b', textAlign: 'center', marginTop: 20, fontSize: 15 },
  
  // Modale
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 20 },
  modalContent: { backgroundColor: '#ffffff', borderRadius: 16, padding: 20 },
  modalTitle: { fontSize: 18, fontWeight: '700', marginBottom: 16, color: '#0f172a' },
  modalBody: { gap: 10, marginBottom: 20 },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  detailLabel: { fontSize: 14, color: '#64748b' },
  detailValue: { fontSize: 14, fontWeight: '600', color: '#0f172a' },
  detailValueBold: { fontSize: 16, fontWeight: '700', color: '#16a34a' },
  closeButton: { backgroundColor: '#e2e8f0', padding: 12, borderRadius: 10, alignItems: 'center' },
  closeButtonText: { fontWeight: '600', color: '#1e293b' },
});