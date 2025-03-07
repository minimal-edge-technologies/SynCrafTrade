// src/services/api.js
import axios from 'axios';
import useAccountsStore from '../store/accountsStore';

const apiUrl = import.meta.env.VITE_API_URL || '/api';

const api = axios.create({
  baseURL: apiUrl
});

let isRefreshing = false;
let failedQueue = [];

const processQueue = (error, token = null) => {
  failedQueue.forEach(prom => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

// Request interceptor to add auth token and API key
api.interceptors.request.use((config) => {
  const requestId = Date.now().toString(36) + Math.random().toString(36).substr(2);
  config.headers['X-Request-ID'] = requestId;
  
  const currentAccount = useAccountsStore.getState().currentAccount;
  
  if (!currentAccount) {
    console.log(`[${requestId}] No current account found for request`);
    return Promise.reject(new Error('No account selected'));
  }

  // Add JWT token
  const token = currentAccount.tokens?.jwtToken;
  if (!token) {
    console.log(`[${requestId}] No JWT token found for request`);
    return Promise.reject(new Error('No authentication token available'));
  }

  // Add API key for orders and positions endpoints
  if (config.url?.includes('/orders') || config.url?.includes('/positions')) {
    const apiKey = currentAccount.credentials?.apiKey;
    console.log(`[${requestId}] API Key found:`, apiKey ? 'Yes' : 'No');

    if (!apiKey) {
      console.log(`[${requestId}] No API key available`);
      return Promise.reject(new Error('No API key available'));
    }
    config.headers['X-API-Key'] = apiKey;
  }

  console.log(`[${requestId}] Request to ${config.url}`);
  config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (response) => {
    const requestId = response.config.headers['X-Request-ID'];
    const dataCount = response.data?.data ? 
      (Array.isArray(response.data.data) ? response.data.data.length : 'object') : 
      'no data';
    console.log(`[${requestId}] Response ${response.status} from ${response.config.url}, data:`, dataCount);
    return response;
  },
  async (error) => {
    const originalRequest = error.config;
    
    if (error.response?.status === 401 && !originalRequest._retry) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then(token => {
            originalRequest.headers.Authorization = `Bearer ${token}`;
            return api(originalRequest);
          })
          .catch(err => Promise.reject(err));
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const currentAccount = useAccountsStore.getState().currentAccount;
        const refreshToken = currentAccount?.tokens?.refreshToken;
        
        if (!refreshToken) {
          throw new Error('No refresh token available');
        }

        try {
          const response = await refreshUserToken(refreshToken);
          const newToken = response.data.jwtToken;

          // Update account tokens in store
          await useAccountsStore.getState().updateAccount(currentAccount._id, {
            tokens: {
              jwtToken: newToken,
              refreshToken: response.data.refreshToken || currentAccount.tokens.refreshToken,
              feedToken: response.data.feedToken || currentAccount.tokens.feedToken,
              issuedAt: new Date()
            }
          });

          processQueue(null, newToken);
          originalRequest.headers.Authorization = `Bearer ${newToken}`;
          isRefreshing = false;
          return api(originalRequest);
        } catch (refreshError) {
          // Mark account as needing authentication
          await useAccountsStore.getState().updateAccount(currentAccount._id, {
            authStatus: 'REQUIRES_AUTH'
          });
          
          processQueue(refreshError);
          isRefreshing = false;
          throw refreshError;
        }
      } catch (authError) {
        processQueue(authError);
        isRefreshing = false;
        return Promise.reject(authError);
      }
    }

    return Promise.reject(error);
  }
);

export const loginToAngelOne = async (credentials) => {
  try {
    console.log('API: Sending login request');
    const response = await api.post('/auth/login', credentials);
    console.log('API: Received response:', response.data);
    return response.data;
  } catch (error) {
    console.error('API: Login request failed:', error.response?.data || error.message);
    throw error.response?.data || error.message;
  }
};

export const getOrders = async () => {
  try {
    console.log('[API] Starting orders fetch');
    const response = await api.get('/orders');
    console.log('[API] Orders fetch complete:', response.data);
    return response.data;
  } catch (error) {
    console.error('[API] Orders fetch failed:', error);
    throw error;
  }
};

export const getPositions = async () => {
  try {
    console.log('Fetching positions...');
    const response = await api.get('/positions');
    console.log('Positions response:', response.data);
    return response.data;
  } catch (error) {
    console.error('Failed to fetch positions:', error);
    throw error;
  }
};