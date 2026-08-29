import axios from 'axios';
import { Platform } from 'react-native';

// URL déployée de l'API FastAPI sur Vercel
const deployedBaseUrl = 'https://portail-scolaire.vercel.app';

// Instance Axios configurée directement sur Vercel
const api = axios.create({
  baseURL: deployedBaseUrl,
  headers: {
    'Content-Type': 'application/json',
    'Cache-Control': 'no-cache, no-store, must-revalidate',
    'Pragma': 'no-cache',
    'Expires': '0',
  },
});

let authToken = null;

/**
 * Configure ou supprime le token Bearer dans les en-têtes globaux
 */
export const setAuthToken = (token) => {
  authToken = token;
  if (token) {
    api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    console.log('[API] Token mis à jour dans les headers (longueur: ' + token.length + ')');
  } else {
    delete api.defaults.headers.common['Authorization'];
    console.log('[API] Token supprimé des headers');
  }
};

/**
 * Récupère le token actuel (pour debug/monitoring)
 */
export const getAuthToken = () => authToken;

// Intercepteur de requête pour réinjecter le token et désactiver le cache HTTP
api.interceptors.request.use(
  (config) => {
    if (authToken) {
      config.headers.Authorization = `Bearer ${authToken}`;
    } else {
      console.warn('[API] Requête sans token :', config.url);
    }
    
    // Ajout d'un paramètre timestamp aux requêtes GET pour forcer une réponse fraîche
    if (config.method === 'get') {
      config.params = {
        ...config.params,
        _t: new Date().getTime(),
      };
    }
    
    return config;
  },
  (error) => {
    console.error('[API] Erreur dans l\'intercepteur de requête :', error);
    return Promise.reject(error);
  }
);

// Intercepteur de réponse pour la gestion des erreurs HTTP
api.interceptors.response.use(
  (response) => {
    console.log('[API] Réponse réussie :', response.config.url);
    return response;
  },
  (error) => {
    if (error.response) {
      if (error.response.status === 401) {
        console.error('[API] Non autorisé (401) :', error.response.data);
      } else if (error.response.status === 403) {
        console.error('[API] Accès interdit (403) :', error.response.data);
      } else {
        console.error('[API] Erreur HTTP ' + error.response.status + ' :', error.response.data);
      }
    } else if (error.request) {
      console.error('[API] Pas de réponse du serveur :', error.request);
    } else {
      console.error('[API] Erreur de configuration :', error.message);
    }
    return Promise.reject(error);
  }
);

// ==========================================
// 1. AUTHENTIFICATION & PROFIL
// ==========================================

export const loginUser = async (credentials) => {
  const response = await api.post('/api/auth/login', credentials);
  return response.data;
};

export const fetchUserProfile = async () => {
  const response = await api.get('/api/users/me');
  return response.data;
};

// ==========================================
// 2. FINANCES & PAIEMENTS (Comptable / Admin / Parent)
// ==========================================

/**
 * Récupère les métriques globales des paiements (Total encaissé, En attente)
 */
export const fetchPaymentStats = async () => {
  const response = await api.get('/api/payments/stats');
  return response.data;
};

/**
 * Récupère la liste de tous les paiements (Réservé Admin & Comptable)
 */
export const fetchAllPayments = async () => {
  const response = await api.get('/api/payments');
  let data = response.data;
  
  console.log('[API] fetchAllPayments - response.data brut:', data);
  
  if (data && typeof data === 'object' && !Array.isArray(data)) {
    console.log('[API] Format wrapper détecté, extraction des données...');
    data = data.data || data.payments || data.items || [];
    console.log('[API] Après extraction:', data);
  }
  
  const result = Array.isArray(data) ? data : [];
  console.log('[API] ✅ fetchAllPayments retourne:', { isArray: Array.isArray(result), length: result.length, result });
  return result;
};

/**
 * Soumettre un nouveau versement (Statut PENDING par défaut)
 */
export const createPayment = async (paymentData) => {
  const response = await api.post('/api/payments', paymentData);
  return response.data;
};

/**
 * Validation d'un paiement par le Comptable (Passe le statut à APPROVED)
 */
export const validatePayment = async (paymentId) => {
  const cleanId = typeof paymentId === 'object' ? (paymentId?.id || paymentId?.payment_id || paymentId?._id) : paymentId;
  console.log('[API] Tentative de validation du paiement ID:', cleanId);

  // Tentative 1: PATCH /api/payments/{id}/validate avec corps JSON {}
  try {
    const response = await api.patch(`/api/payments/${cleanId}/validate`, {});
    return response.data;
  } catch (error1) {
    console.warn('[API] validatePayment (PATCH {}) a échoué (status ' + error1?.response?.status + '), tentative avec payload status...');

    // Tentative 2: PATCH /api/payments/{id}/validate avec { status: 'APPROVED' }
    try {
      const response = await api.patch(`/api/payments/${cleanId}/validate`, { status: 'APPROVED' });
      return response.data;
    } catch (error2) {
      console.warn('[API] validatePayment (PATCH status:APPROVED) a échoué, tentative POST...');

      // Tentative 3: POST /api/payments/{id}/validate
      try {
        const response = await api.post(`/api/payments/${cleanId}/validate`, {});
        return response.data;
      } catch (error3) {
        console.warn('[API] validatePayment (POST) a échoué, tentative PUT...');

        // Tentative 4: PUT /api/payments/{id}/validate
        try {
          const response = await api.put(`/api/payments/${cleanId}/validate`, {});
          return response.data;
        } catch (error4) {
          console.warn('[API] validatePayment (PUT) a échoué, tentative PATCH /api/payments/{id} direct...');

          // Tentative 5: PATCH /api/payments/{id} { status: 'APPROVED' }
          try {
            const response = await api.patch(`/api/payments/${cleanId}`, { status: 'APPROVED' });
            return response.data;
          } catch (error5) {
            console.error('[API] Toutes les tentatives de validation du paiement ont échoué.');
            throw error1;
          }
        }
      }
    }
  }
};

/**
 * Rejet d'un paiement par le Comptable avec motif (Passe le statut à REJECTED)
 */
export const rejectPayment = async (paymentId, reason) => {
  const cleanId = typeof paymentId === 'object' ? (paymentId?.id || paymentId?.payment_id || paymentId?._id) : paymentId;
  const cleanReason = typeof reason === 'string' ? reason.trim() : String(reason || '');

  try {
    const response = await api.patch(`/api/payments/${cleanId}/reject`, {
      reason: cleanReason,
      rejection_reason: cleanReason,
      status: 'REJECTED',
    });
    return response.data;
  } catch (error) {
    if (error?.response?.status === 400 || error?.response?.status === 422 || error?.response?.status === 405) {
      console.warn('[API] Rejet en JSON échoué (' + error?.response?.status + '), tentative en Query Parameter...');
      try {
        const fallbackResponse = await api.patch(
          `/api/payments/${cleanId}/reject`,
          null,
          { params: { reason: cleanReason, rejection_reason: cleanReason } }
        );
        return fallbackResponse.data;
      } catch (fallbackErr) {
        try {
          const postResp = await api.post(`/api/payments/${cleanId}/reject`, { reason: cleanReason });
          return postResp.data;
        } catch (postErr) {
          throw error;
        }
      }
    }
    throw error;
  }
};

/**
 * Récupère l'état du compte financier d'un élève
 */
export const fetchStudentAccount = async (studentId) => {
  const response = await api.get(`/api/payments/account/${studentId}`);
  return response.data;
};

/**
 * Récupère l'historique des paiements d'un élève
 */
export const fetchStudentPaymentHistory = async (studentId) => {
  const response = await api.get(`/api/payments/history/${studentId}`);
  return response.data;
};

// ==========================================
// 3. ADMINISTRATION (Admin)
// ==========================================


/**
 * Création d'un utilisateur générique (Admin)
 */
export const createUser = async (userData) => {
  try {
    const response = await api.post('/api/admin/users', userData);
    return response.data;
  } catch (error) {
    const role = (userData && userData.role) || '';
    if ((error?.response?.status === 400 || error?.response?.status === 422) && role.toUpperCase() === 'COMPTABLE') {
      const fallback = { ...userData, role: 'ACCOUNTANT' };
      const retryResp = await api.post('/api/admin/users', fallback);
      return retryResp.data;
    }
    throw error;
  }
};

export const createClass = async (classData) => {
  const response = await api.post('/api/admin/classes', classData);
  return response.data;
};

export const getClasses = async () => {
  const response = await api.get('/api/school/classes');
  return response.data;
};

export const createStudent = async (studentData) => {
  const response = await api.post('/api/students', studentData);
  return response.data;
};

export const getStudents = async () => {
  const response = await api.get('/api/students');
  return response.data;
};

export const getStudent = async (studentId) => {
  const response = await api.get(`/api/students/${studentId}`);
  return response.data;
};

export const updateStudent = async (studentId, studentData) => {
  const response = await api.put(`/api/students/${studentId}`, studentData);
  return response.data;
};

export const toggleStudentStatus = async (studentId) => {
  const response = await api.patch(`/api/students/${studentId}/status`);
  return response.data;
};

export const getStudentTuition = async (studentId) => {
  const response = await api.get(`/api/students/${studentId}/tuition`);
  return response.data;
};

export const setStudentTuition = async (studentId, tuitionData) => {
  const response = await api.post(`/api/students/${studentId}/tuition`, tuitionData);
  return response.data;
};

export const updateStudentTuition = async (studentId, tuitionData) => {
  const response = await api.put(`/api/students/${studentId}/tuition`, tuitionData);
  return response.data;
};

// ==========================================
// GESTION DES COMPTABLES
// ==========================================

export const createAccountant = async (accountantData) => {
  const response = await api.post('/api/users/accountants', accountantData);
  return response.data;
};

export const getAccountants = async () => {
  const response = await api.get('/api/users/accountants');
  return response.data;
};

export const getAccountant = async (accountantId) => {
  const response = await api.get(`/api/users/accountants/${accountantId}`);
  return response.data;
};

export const updateAccountant = async (accountantId, accountantData) => {
  const response = await api.put(`/api/users/accountants/${accountantId}`, accountantData);
  return response.data;
};

export const toggleAccountantStatus = async (accountantId) => {
  const response = await api.patch(`/api/users/accountants/${accountantId}/status`);
  return response.data;
};

// ==========================================
// GESTION DES PARENTS
// ==========================================

export const createParent = async (parentData) => {
  const response = await api.post('/api/users/parents', parentData);
  return response.data;
};

export const getParents = async () => {
  const response = await api.get('/api/users/parents');
  return response.data;
};

export const getParent = async (parentId) => {
  const response = await api.get(`/api/users/parents/${parentId}`);
  return response.data;
};

export const updateParent = async (parentId, parentData) => {
  const response = await api.put(`/api/users/parents/${parentId}`, parentData);
  return response.data;
};

export const toggleParentStatus = async (parentId) => {
  const response = await api.patch(`/api/users/parents/${parentId}/status`);
  return response.data;
};

export const getParentChildrenCount = async (parentId) => {
  const response = await api.get(`/api/users/parents/${parentId}/children-count`);
  return response.data;
};

export default api;