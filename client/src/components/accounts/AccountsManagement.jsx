// src/components/accounts/AccountsManagement.jsx
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import useAccountsStore from '../../store/accountsStore';
import { Plus, Trash2, Settings, AlertCircle, ArrowRight } from 'lucide-react';
import { Loader2 } from 'lucide-react';
import { ACCOUNT_TYPES, ACCOUNT_TYPE_LABELS } from '../../constants/accountTypes';

export default function AccountsManagement() {
  const navigate = useNavigate();
  const { 
    accounts, 
    currentAccount,
    setCurrentAccount,
    isLoading, 
    error, 
    fetchAccounts,
    deleteAccount,
    updateAccount 
  } = useAccountsStore();

  useEffect(() => {
    fetchAccounts();
  }, [fetchAccounts]);

  const handleAccountTypeChange = async (accountId, newType) => {
    try {
      await updateAccount(accountId, { accountType: newType });
    } catch (error) {
      console.error('Failed to update account type:', error);
    }
  };

  const handleDeleteAccount = async (accountId) => {
    if (window.confirm('Are you sure you want to delete this account?')) {
      try {
        await deleteAccount(accountId);
      } catch (error) {
        console.error('Failed to delete account:', error);
      }
    }
  };

  const handleViewDashboard = (account) => {
    setCurrentAccount(account);
    navigate(`/accounts/${account._id}/details`);
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="w-8 h-8 animate-spin" />
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

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Trading Accounts</h1>
        <button
          onClick={() => navigate('/add-account')}
          className="flex items-center px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
        >
          <Plus className="w-5 h-5 mr-2" />
          Add Account
        </button>
      </div>

      <div className="bg-white shadow overflow-hidden sm:rounded-md">
        <ul className="divide-y divide-gray-200">
          {accounts.map((account) => (
            <li key={account._id} className="px-6 py-4">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center">
                    <h3 className="text-lg font-medium text-gray-900">
                      {account.name || account.clientCode}
                    </h3>
                    <span className={`ml-3 px-2.5 py-0.5 rounded-full text-xs font-medium
                      ${account.status === 'ACTIVE' ? 'bg-green-100 text-green-800' :
                        account.status === 'INACTIVE' ? 'bg-yellow-100 text-yellow-800' :
                        'bg-red-100 text-red-800'}`}>
                      {account.status}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-gray-500">Client Code: {account.clientCode}</p>
                </div>

                <div className="flex items-center space-x-4">
                  <select
                    value={account.accountType}
                    onChange={(e) => handleAccountTypeChange(account._id, e.target.value)}
                    className="block w-40 py-2 px-3 border border-gray-300 bg-white rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 text-sm"
                  >
                    <option value={ACCOUNT_TYPES.PARENT}>{ACCOUNT_TYPE_LABELS[ACCOUNT_TYPES.PARENT]}</option>
                    <option value={ACCOUNT_TYPES.CHILD}>{ACCOUNT_TYPE_LABELS[ACCOUNT_TYPES.CHILD]}</option>
                  </select>

                  <button
                    onClick={() => handleViewDashboard(account)}
                    className="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                  >
                    <ArrowRight className="w-4 h-4 mr-2" />
                    View Dashboard
                  </button>

                  <button
                    onClick={() => navigate(`/accounts/${account._id}/settings`)}
                    className="p-2 text-gray-400 hover:text-gray-500"
                  >
                    <Settings className="w-5 h-5" />
                  </button>

                  <button
                    onClick={() => handleDeleteAccount(account._id)}
                    className="p-2 text-red-400 hover:text-red-500"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {account.accountType === 'FOLLOWER' && account.settings && (
                <div className="mt-3 text-sm text-gray-500">
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <span className="font-medium">Copy Ratio:</span>{' '}
                      {account.settings.copyRatio || 1.0}x
                    </div>
                    <div>
                      <span className="font-medium">Max Position Size:</span>{' '}
                      {account.settings.maxPositionSize || 10}%
                    </div>
                    <div>
                      <span className="font-medium">Risk Limit:</span>{' '}
                      {account.settings.riskLimit || 2}%
                    </div>
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}