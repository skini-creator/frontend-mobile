import axios from 'axios';

// Instance de base Axios avec gestion stricte du cache
const api = axios.create({
  baseURL: 'http://localhost:8080',
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

// Intercepteur de requête pour garantir la réinjection du token et contourner le cache HTTP
api.interceptors.request.use(
  (config) => {
    // Toujours réinjecter le token depuis la variable globale
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

// Intercepteur de réponse pour intercepter les erreurs d'authentification (401/403)
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
  const response = await api.get('/api/auth/me');
  return response.data;
};

// ==========================================
// 2. FINANCES & PAIEMENTS (Comptable / Admin / Parent)
// ==========================================

/**
 * Récupère les métriques globales des paiements (Total encaissé, En attente)
 * Réservé Admin & Comptable
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
  const response = await api.patch(`/api/payments/${paymentId}/validate`);
  return response.data;
};

/**
 * Rejet d'un paiement par le Comptable avec motif (Passe le statut à REJECTED)
 * Gère à la fois les schémas JSON (reason, rejection_reason) et les query parameters
 */
export const rejectPayment = async (paymentId, reason) => {
  const cleanReason = typeof reason === 'string' ? reason.trim() : String(reason || '');

  try {
    // 1. Première tentative : Transmission en body JSON avec les clés Pydantic usuelles
    const response = await api.patch(`/api/payments/${paymentId}/reject`, {
      reason: cleanReason,
      rejection_reason: cleanReason,
    });
    return response.data;
  } catch (error) {
    // 2. Fallback si FastAPI attendait la raison en Query Parameter (?reason=...)
    if (error?.response?.status === 400 || error?.response?.status === 422) {
      console.warn('[API] Rejet en JSON échoué (400/422), tentative en Query Parameter...');
      const fallbackResponse = await api.patch(
        `/api/payments/${paymentId}/reject`,
        null,
        { params: { reason: cleanReason, rejection_reason: cleanReason } }
      );
      return fallbackResponse.data;
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

export const createParent = async (parentData) => {
  const response = await api.post('/api/admin/parents', parentData);
  return response.data;
};

export const createClass = async (classData) => {
  const response = await api.post('/api/admin/classes', classData);
  return response.data;
};

export const createStudent = async (studentData) => {
  const response = await api.post('/api/admin/students', studentData);
  return response.data;
};

export default api;