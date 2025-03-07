// src/store/copyTradeStore.js
import { create } from 'zustand';
import axios from 'axios';
import useAccountsStore from './accountsStore';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api'
});

const useCopyTradeStore = create((set) => ({
  copyTrades: [],
  isLoading: false,
  error: null,

  fetchCopyTrades: async (accountId, type) => {
    try {
      set({ isLoading: true, error: null });
      
      // Get current JWT token from the accounts store
      const currentAccount = useAccountsStore.getState().currentAccount;
      if (!currentAccount?.tokens?.jwtToken) {
        throw new Error('No authentication token available');
      }
      
      const response = await api.get('/orders/copy-history', {
        params: { accountId, type },
        headers: {
          Authorization: `Bearer ${currentAccount.tokens.jwtToken}`,
          'X-API-Key': currentAccount.credentials?.apiKey || '' // Include API key if needed
        }
      });
      
      set({ 
        copyTrades: response.data.data,
        isLoading: false 
      });
    } catch (error) {
      console.error('Failed to fetch copy trades:', error);
      set({ 
        error: error.message, 
        isLoading: false 
      });
    }
  },
  
  clearCopyTrades: () => {
    set({ copyTrades: [] });
  }
}));

export default useCopyTradeStore;