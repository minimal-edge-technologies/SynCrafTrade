// src/store/orderStore.js
import { create } from 'zustand';
import { getOrders } from '../services/api';

const useOrderStore = create((set) => ({
  orders: [],
  parentChildRelations: new Map(),
  isLoading: false,
  error: null,

  // Add new order
  addOrder: (order) => {
    set(state => ({
      orders: [...state.orders, order]
    }));
  },

  updateOrders: (orders) => {
    // Handle various response formats
    let normalizedOrders;
    
    if (Array.isArray(orders)) {
      normalizedOrders = orders;
    } else if (orders?.data && Array.isArray(orders.data)) {
      normalizedOrders = orders.data;
    } else {
      normalizedOrders = [];
    }
    
    set({ orders: normalizedOrders });
  },
  

  fetchOrders: async () => {  
    try {
      set({ isLoading: true, error: null });
      const response = await getOrders();
      
      // Only update if we got a valid response
      if (response && response.success) {
        // Extract the orders array from response
        const ordersData = Array.isArray(response.data) ? response.data : [];
        set({ 
          orders: ordersData, 
          isLoading: false 
        });
        console.log('Orders updated in store:', ordersData.length);
      } else {
        set({ isLoading: false });
        console.warn('Invalid response from orders API:', response);
      }
    } catch (error) {
      console.error('Error fetching orders:', error);
      set({ 
        error: error.message,
        isLoading: false
      });
    }
  }
}));

export default useOrderStore;