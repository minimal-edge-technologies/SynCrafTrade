// src/components/positions/PositionsTable.jsx
import { useEffect, useRef } from 'react';
import usePositionStore from '../../store/positionStore';
import useAccountsStore from '../../store/accountsStore';
import { Loader2 } from 'lucide-react';

export default function PositionsTable() {
  const { positions, isLoading, error, fetchPositions: fetchPositionsFromStore } = usePositionStore();
  const { currentAccount } = useAccountsStore();

  // Use a ref to track if we've already fetched for this account
  const fetchedRef = useRef(false);

  useEffect(() => {
    // Reset fetch state when account changes
    fetchedRef.current = false;
    
    if (!currentAccount?.tokens?.jwtToken) return;

    const loadPositions = async () => {
      if (fetchedRef.current) return; // Skip if already fetched for this account
      
      try {
        console.log('Loading positions for:', currentAccount.clientCode, 'with ID:', currentAccount._id);
        fetchedRef.current = true; // Set this BEFORE the async call
        await fetchPositionsFromStore();
      } catch (err) {
        console.error('Error loading positions:', err);
        fetchedRef.current = false; // Reset on error so we can try again
      }
    };
    
    loadPositions();

    // No cleanup function that resets fetchedRef
  }, [currentAccount?._id, fetchPositionsFromStore]);

  if (!currentAccount) {
    return (
      <div className="text-center p-4">
        Please select an account to view positions
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex justify-center items-center p-8">
        <Loader2 className="w-6 h-6 animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-red-500 p-4">
        {error}
      </div>
    );
  }

  const positionsList = Array.isArray(positions) ? positions : [];

  return (
    <div className="bg-white rounded-lg shadow overflow-hidden">
      <div className="px-4 py-5 sm:px-6">
        <h3 className="text-lg font-medium leading-6 text-gray-900">Positions</h3>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Symbol</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Quantity</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Avg Price</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">LTP</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">P&L</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {positionsList.length === 0 ? (
              <tr>
                <td colSpan="5" className="px-6 py-4 text-center text-gray-500">
                  No positions found
                </td>
              </tr>
            ) : (
              positionsList.map((position) => (
                <tr key={`${position.symbol}-${position.quantity}`}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{position.symbol}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-right">{position.quantity}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-right">
                    {position.averagePrice ? `₹${position.averagePrice.toFixed(2)}` : '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-right">
                    {position.lastPrice ? `₹${position.lastPrice.toFixed(2)}` : '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-right">
                    <span className={position.pnl?.unrealized >= 0 ? 'text-green-600' : 'text-red-600'}>
                      ₹{position.pnl?.unrealized}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}