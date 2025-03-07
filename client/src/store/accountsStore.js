// src/store/accountsStore.js
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api'
});

const useAccountsStore = create(
  persist(
    (set, get) => ({
      accounts: [],
      currentAccount: null,
      isLoading: false,
      error: null,

      initialize: async () => {
        try {
          set({ isLoading: true, error: null });
          const response = await api.get('/accounts');
          set({ 
            accounts: response.data.data,
            isLoading: false 
          });
        } catch (error) {
          set({ error: error.message, isLoading: false });
        }
      },

      setCurrentAccount: (account) => {
        if (!account) {
          console.log('Clearing current account');
          set({ currentAccount: null });
          return;
        }
      
        // If account is an ID string, find the account object
        const accountToSet = typeof account === 'string' 
          ? get().accounts.find(acc => acc._id === account)
          : account;
      
        if (!accountToSet) {
          console.error('Account not found:', account);
          return;
        }
        
        console.log('Setting current account:', accountToSet._id, accountToSet.clientCode);
        set({ currentAccount: accountToSet });
      },


      fetchAccount: async (accountId) => {
        try {

          if (!accountId) {
            throw new Error('Account ID is required');
          }

          set({ isLoading: true, error: null });
          const response = await api.get(`/accounts/${accountId}`);
          const account = response.data.data;
          
          set(state => ({
            accounts: state.accounts.map(acc => 
              acc._id === accountId ? account : acc
            ),
            currentAccount: account,
            isLoading: false
          }));

          return account;
        } catch (error) {
          console.error('Failed to fetch account:', error);
          set({ 
            error: error.message, 
            isLoading: false 
          });
          throw error;
        }
      },


      addAccount: async (credentials) => {
        try {
          set({ isLoading: true, error: null });
          const response = await api.post('/accounts', credentials);
          const newAccount = response.data.data;

          if (!newAccount?._id) {
            throw new Error('Invalid account data received');
          }
          
          set(state => ({ 
            accounts: [...state.accounts, newAccount],
            currentAccount: newAccount, // Set new account as current
            isLoading: false 
          }));
          return newAccount;
        } catch (error) {
          console.error('Failed to add account:', error);
          set({ error: error.message, isLoading: false });
          throw error;
        }
      },

      updateAccount: async (accountId, updates) => {
        try {
          set({ isLoading: true, error: null });
          const response = await api.put(`/accounts/${accountId}`, updates);
          const updatedAccount = response.data.data;
          
          set(state => ({
            accounts: state.accounts.map(acc => 
              acc._id === accountId ? updatedAccount : acc
            ),
            currentAccount: state.currentAccount?._id === accountId ? updatedAccount : state.currentAccount,
            isLoading: false
          }));
        } catch (error) {
          set({ error: error.message, isLoading: false });
          throw error;
        }
      },

      updateBalance: (accountId, balance) => {
        set(state => ({
          accounts: state.accounts.map(acc => 
            acc._id === accountId ? { ...acc, balance } : acc
          ),
          currentAccount: state.currentAccount?._id === accountId ? 
            { ...state.currentAccount, balance } : state.currentAccount
        }));
      },
      reauthenticateAccount: async (accountId, password, totp) => {
        try {
          set({ isLoading: true, error: null });
          const response = await api.post('/auth/reauthenticate', {
            accountId,
            password,
            totp
          });
          
          if (response.data.success) {
            set(state => ({
              accounts: state.accounts.map(acc => 
                acc._id === accountId 
                  ? { ...acc, authStatus: 'ACTIVE', tokens: response.data.data.tokens } 
                  : acc
              ),
              currentAccount: state.currentAccount?._id === accountId 
                ? { ...state.currentAccount, authStatus: 'ACTIVE', tokens: response.data.data.tokens } 
                : state.currentAccount,
              isLoading: false
            }));
          }
          
          return response.data;
        } catch (error) {
          set({ 
            error: error.response?.data?.error || error.message, 
            isLoading: false 
          });
          throw error;
        }
      },    

      deleteAccount: async (accountId) => {
        try {
          set({ isLoading: true, error: null });
          await api.delete(`/accounts/${accountId}`);
          
          set(state => {
            const newAccounts = state.accounts.filter(acc => acc._id !== accountId);
            return {
              accounts: newAccounts,
              currentAccount: state.currentAccount?._id === accountId ? newAccounts[0] || null : state.currentAccount,
              isLoading: false
            };
          });
        } catch (error) {
          set({ error: error.message, isLoading: false });
          throw error;
        }
      },

      getAccountById: (accountId) => {
        return get().accounts.find(acc => acc._id === accountId);
      }
    }),
    {
      name: 'accounts-storage', 
      whitelist: [] 
    })
);

export default useAccountsStore;