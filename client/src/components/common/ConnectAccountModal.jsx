// src/components/common/ConnectAccountModal.jsx
import { useState } from 'react';
import useAccountsStore from '../../store/accountsStore';
import { X } from 'lucide-react';

export default function ConnectAccountModal({ isOpen, onClose, childAccount }) {
  const { accounts, updateAccount } = useAccountsStore();
  const [selectedParentId, setSelectedParentId] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const parentAccounts = accounts.filter(acc => acc.accountType === 'PARENT');

  const handleConnect = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      await updateAccount(childAccount._id, {
        parentAccount: selectedParentId
      });
      onClose();
    } catch (error) {
      console.error('Failed to connect accounts:', error);
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
        <div className="flex justify-between items-center p-6 border-b">
          <h2 className="text-xl font-semibold">Connect to Parent Account</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-500">
            <X className="w-6 h-6" />
          </button>
        </div>

        <form onSubmit={handleConnect} className="p-6">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Select Parent Account
              </label>
              <select
                value={selectedParentId}
                onChange={(e) => setSelectedParentId(e.target.value)}
                className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md"
                required
              >
                <option value="">Select an account...</option>
                {parentAccounts.map(account => (
                  <option key={account._id} value={account._id}>
                    {account.name || account.clientCode}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="mt-6 flex justify-end space-x-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 rounded-md"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isLoading || !selectedParentId}
              className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 rounded-md disabled:opacity-50"
            >
              {isLoading ? 'Connecting...' : 'Connect'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}