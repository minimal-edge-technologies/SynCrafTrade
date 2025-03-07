// src/components/dashboard/CopyTradeHistory.jsx
import { useEffect } from 'react';
import useCopyTradeStore from '../../store/copyTradeStore';
import useAccountsStore from '../../store/accountsStore';
import { Loader2 } from 'lucide-react';

export default function CopyTradeHistory() {
  const { copyTrades, isLoading, error, fetchCopyTrades } = useCopyTradeStore();
  const { currentAccount, accounts } = useAccountsStore();

  useEffect(() => {
    if (currentAccount?._id) {
      // For parent accounts, show outgoing copies
      // For child accounts, show incoming copies
      const type = currentAccount.accountType === 'PARENT' ? 'parent' : 'child';
      fetchCopyTrades(currentAccount._id, type);
    }
    
    return () => useCopyTradeStore.getState().clearCopyTrades();
  }, [currentAccount?._id]);

  // Get account name by ID helper function
  const getAccountName = (accountId) => {
    const account = accounts.find(acc => acc._id === accountId);
    return account ? (account.name || account.clientCode) : 'Unknown Account';
  };

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

  return (
    <div className="bg-white rounded-lg shadow overflow-hidden">
      <div className="px-4 py-5 sm:px-6">
        <h3 className="text-lg font-medium leading-6 text-gray-900">
          {currentAccount?.accountType === 'PARENT' ? 'Copied Trades (Outgoing)' : 'Copied Trades (Incoming)'}
        </h3>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Time</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Symbol</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Quantity</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Price</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                {currentAccount?.accountType === 'PARENT' ? 'Copied To' : 'Copied From'}
              </th>
              <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {copyTrades.length === 0 ? (
              <tr>
                <td colSpan="7" className="px-6 py-4 text-center text-gray-500">
                  No copy trades found
                </td>
              </tr>
            ) : (
              copyTrades.map((trade) => (
                <tr key={`${trade.parentOrderId}-${trade.childOrderId}`}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {new Date(trade.createdAt).toLocaleString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {trade.symbol}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 py-1 text-xs rounded-full ${
                      trade.transactionType === 'BUY' 
                        ? 'bg-green-100 text-green-800'
                        : 'bg-red-100 text-red-800'
                    }`}>
                      {trade.transactionType}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-right">
                    {trade.quantity}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-right">
                    ₹{trade.price}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    {currentAccount?.accountType === 'PARENT' 
                      ? getAccountName(trade.childAccountId)
                      : getAccountName(trade.parentAccountId)
                    }
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-center">
                    <span className={`px-2 py-1 text-xs rounded-full ${
                      trade.status === 'PLACED' ? 'bg-green-100 text-green-800' :
                      trade.status === 'MODIFIED' ? 'bg-blue-100 text-blue-800' :
                      trade.status === 'CANCELLED' ? 'bg-gray-100 text-gray-800' :
                      'bg-yellow-100 text-yellow-800'
                    }`}>
                      {trade.status}
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