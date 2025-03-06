// src/store/positionStore.js
import { create } from 'zustand';
import { getPositions } from '../services/api';

const usePositionStore = create((set) => ({
  positions: [],
  isLoading: false,
  error: null,

  updatePositions: (positions) => {
    // Handle various response formats
    let normalizedPositions;
    
    if (Array.isArray(positions)) {
      normalizedPositions = positions;
    } else if (positions?.data && Array.isArray(positions.data)) {
      normalizedPositions = positions.data;
    } else {
      normalizedPositions = [];
    }
    
    set({ positions: normalizedPositions });
  },

  fetchPositions: async () => {  
    try {
      set({ isLoading: true, error: null });
      const response = await getPositions();
      
      // Only update if we got a valid response
      if (response && response.success) {
        // Extract the positions array from response
        const positionsData = Array.isArray(response.data) ? response.data : [];
        set({ 
          positions: positionsData, 
          isLoading: false 
        });
        console.log('Positions updated in store:', positionsData.length);
      } else {
        set({ isLoading: false });
        console.warn('Invalid response from positions API:', response);
      }
    } catch (error) {
      console.error('Error fetching positions:', error);
      set({ 
        error: error.message,
        isLoading: false
      });
    }
  }
}));

export default usePositionStore;