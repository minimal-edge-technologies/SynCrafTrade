// src/store/authStore.js
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { loginToAngelOne, refreshUserToken } from '../services/api';

const useAuthStore = create(
  persist(
    (set, get) => ({
      accounts: [],
      currentAccount: null,
      isLoading: false,
      error: null,
 
      addAccount: async (credentials) => {
        try {
          set({ isLoading: true, error: null });
          const response = await loginToAngelOne(credentials);
          
          const newAccount = {
            id: credentials.clientCode, // Using clientCode as unique identifier
            profile: {
              ...response.data.profile,
              clientCode: credentials.clientCode,
              password: credentials.password, 
              totp: credentials.totp
            },
            tokens: {
              ...response.data.tokens,
              apiKey: credentials.apiKey
            },
            balance: response.data.balance,
          };

          set(state => ({
            accounts: [...state.accounts, newAccount],
            currentAccount: state.currentAccount || newAccount, // Set as current if none selected
            isLoading: false
          }));

          return newAccount;
        } catch (error) {
          set({ error: error.message, isLoading: false });
          throw error;
        }
      },

      removeAccount: (accountId) => {
        set(state => {
          const newAccounts = state.accounts.filter(acc => acc.id !== accountId);
          const newCurrentAccount = state.currentAccount?.id === accountId
            ? newAccounts[0] || null
            : state.currentAccount;

          return {
            accounts: newAccounts,
            currentAccount: newCurrentAccount
          };
        });
      },

      setCurrentAccount: (accountId) => {
        set(state => ({
          currentAccount: state.accounts.find(acc => acc.id === accountId) || state.currentAccount
        }));
      },

      // Keep these for compatibility with existing code
      get user() {
        return get().currentAccount?.profile || null;
      },

      get tokens() {
        return get().currentAccount?.tokens || null;
      },

      get balance() {
        return get().currentAccount?.balance || null;
      },
    }),
    {
      name: 'auth-storage',
      storage: createJSONStorage(() => localStorage)
    }
  )
);

export default useAuthStore;