// src/components/accounts/AccountsPage.jsx
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import useAccountsStore from '../../store/accountsStore';
import { ACCOUNT_TYPES } from '../../constants/accountTypes';
import { Plus, Trash2, Settings, Eye, AlertCircle } from 'lucide-react';
import SettingsModal from '../common/SettingsModal';

export default function AccountsPage() {
  const navigate = useNavigate();
  const { accounts, deleteAccount, isLoading, error } = useAccountsStore();
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [selectedAccount, setSelectedAccount] = useState(null);

  const handleDeleteAccount = async (accountId) => {
    if (window.confirm('Are you sure you want to delete this account?')) {
      try {
        await deleteAccount(accountId);
      } catch (error) {
        console.error('Failed to delete account:', error);
      }
    }
  };

  const handleViewDetails = (accountId) => {
    navigate(`/account-details/${accountId}`);
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-64 text-red-500">
        <AlertCircle className="w-6 h-6 mr-2" />
        <span>{error}</span>
      </div>
    );
  }

  const openSettings = (account) => {
    setSelectedAccount(account);
    setIsSettingsOpen(true);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Trading Accounts</h1>
        <button
          onClick={() => navigate('/add-account')}
          className="flex items-center px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
        >
          <Plus className="w-5 h-5 mr-2" />
          Add Account
        </button>
      </div>

      <div className="bg-white shadow overflow-hidden sm:rounded-lg">
        {accounts.map((account) => (
          <div key={account._id} className="border-b border-gray-200">
            <div className="px-6 py-4">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center space-x-3">
                    <h3 className="text-lg font-medium text-gray-900">
                      {account.name || account.clientCode}
                    </h3>
                    {/* Add auth status indicator */}
                    <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium
                      ${account.authStatus === 'ACTIVE' 
                        ? 'bg-green-100 text-green-800' 
                        : account.authStatus === 'REQUIRES_AUTH'
                        ? 'bg-red-100 text-red-800'
                        : 'bg-yellow-100 text-yellow-800'}`}>
                      {account.authStatus === 'ACTIVE' ? 'Authenticated' : 
                      account.authStatus === 'REQUIRES_AUTH' ? 'Authentication Required' : 
                      'Disabled'}
                    </span>
                    <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium
                      ${account.accountType === ACCOUNT_TYPES.PARENT 
                        ? 'bg-purple-100 text-purple-800' 
                        : 'bg-blue-100 text-blue-800'}`}>
                      {account.accountType}
                    </span>
                    <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium
                      ${account.status === 'ACTIVE' 
                        ? 'bg-green-100 text-green-800' 
                        : 'bg-yellow-100 text-yellow-800'}`}>
                      {account.status}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-gray-500">Client Code: {account.clientCode}</p>
                </div>

                <div className="flex items-center space-x-4">
                <button
                  onClick={() => handleViewDetails(account._id)}
                  className="text-indigo-600 hover:text-indigo-900"
                >
                  <Eye className="w-5 h-5" />
                </button>
                <button
                    onClick={() => openSettings(account)}
                    className="text-gray-400 hover:text-gray-500"
                  >
                    <Settings className="w-5 h-5" />
                  </button>
                  <button
                    onClick={() => handleDeleteAccount(account._id)}
                    className="text-red-400 hover:text-red-500"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Account Details */}
              <div className="mt-4 grid grid-cols-3 gap-4 text-sm text-gray-500">
                <div>
                  <span className="font-medium">Net Balance:</span>{' '}
                  ₹{account.balance?.net || 0}
                </div>
                <div>
                  <span className="font-medium">Used Margin:</span>{' '}
                  ₹{account.balance?.used || 0}
                </div>
                <div>
                  <span className="font-medium">Available Margin:</span>{' '}
                  ₹{account.balance?.available || 0}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
      {/* Add Settings Modal */}
      {selectedAccount && (
        <SettingsModal 
          account={selectedAccount}
          isOpen={isSettingsOpen}
          onClose={() => {
            setIsSettingsOpen(false);
            setSelectedAccount(null);
          }}
        />
      )}

    </div>
  );
}