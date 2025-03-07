// src/components/accounts/AccountDetails.jsx
import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import useAccountsStore from '../../store/accountsStore';
import OrdersTable from '../orders/OrdersTable';
import PositionsTable from '../positions/PositionsTable';
import { LogOut, Wallet, TrendingUp, AlertCircle, Shield } from 'lucide-react';
import { ACCOUNT_TYPES, ACCOUNT_TYPE_LABELS } from '../../constants/accountTypes';
import ReauthenticationModal from '../auth/ReauthenticationModal';

export default function AccountDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const {
    currentAccount,
    error,
    setCurrentAccount,
    isLoading,
    fetchAccount 
  } = useAccountsStore();
  const [showAuthModal, setShowAuthModal] = useState(false);

  useEffect(() => {
    if (!id) return;

    const loadAccount = async () => {
      try {
        // Prevent reloading if we already have the correct account
        if (currentAccount?._id === id) {
          console.log('Account already loaded:', id);
          return;
        }
    
        console.log('Loading account details for:', id);
        const selectedAccount = await fetchAccount(id);
        if (selectedAccount) {
          console.log('Setting current account:', selectedAccount._id);
          setCurrentAccount(selectedAccount);
        } else {
          console.warn('Account not found, navigating back');
          navigate('/accounts');
        }
      } catch (error) {
        console.error('Failed to load account details:', error);
        navigate('/accounts');
      }
    };

    loadAccount();
  }, [id, currentAccount?._id]);

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

  if (!currentAccount) {
    return <div>Loading...</div>;
  }

  const balance = currentAccount.balance || {
    net: 0,
    used: 0,
    available: 0
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center">
              <h1 className="text-xl font-bold text-gray-900">Account Details</h1>
              <span className={`ml-4 px-2 py-1 ${currentAccount?.accountType === ACCOUNT_TYPES.PARENT
                  ? 'bg-purple-100 text-purple-800'
                  : 'bg-blue-100 text-blue-800'
                } rounded text-sm`}>
                {ACCOUNT_TYPE_LABELS[currentAccount.accountType]}
              </span>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-sm">
                <span className="text-gray-500 mr-2">Client Code:</span>
                <span className="font-medium">{currentAccount.clientCode}</span>
              </div>
              <span className="text-sm font-medium text-gray-900">{currentAccount.name}</span>
              {/* Add re-authentication button */}
              <button
                onClick={() => setShowAuthModal(true)}
                className={`flex items-center gap-2 px-3 py-1 text-sm rounded-md ${
                  currentAccount.authStatus === 'REQUIRES_AUTH'
                    ? 'text-red-600 hover:bg-red-50'
                    : 'text-indigo-600 hover:bg-indigo-50'
                }`}
              >
                <Shield className="w-4 h-4" />
                {currentAccount.authStatus === 'REQUIRES_AUTH' ? 'Re-authenticate' : 'Authentication'}
              </button>
              <button
                onClick={() => navigate('/accounts')}
                className="flex items-center gap-2 px-3 py-1 text-sm text-red-600 hover:bg-red-50 rounded-md"
              >
                <LogOut className="w-4 h-4" />
                Back to Accounts
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* Balance Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
          <div className="bg-white p-6 rounded-lg shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Available Balance</p>
                <p className="text-2xl font-bold">
                  ₹{balance.net.toLocaleString('en-IN')}
                </p>
              </div>
              <Wallet className="w-8 h-8 text-blue-500" />
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Used Margin</p>
                <p className="text-2xl font-bold">
                  ₹{balance.used.toLocaleString('en-IN')}
                </p>
              </div>
              <TrendingUp className="w-8 h-8 text-green-500" />
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Margin</p>
                <p className="text-2xl font-bold">
                  ₹{balance.available.toLocaleString('en-IN')}
                </p>
              </div>
              <Wallet className="w-8 h-8 text-purple-500" />
            </div>
          </div>
        </div>

        {/* Orders and Positions section */}
        <div className="space-y-6">
          <div className="bg-white shadow rounded-lg">
            <OrdersTable />
          </div>

          <div className="bg-white shadow rounded-lg">
            <PositionsTable />
          </div>
        </div>
        {showAuthModal && (
        <ReauthenticationModal
          isOpen={showAuthModal}
          onClose={() => setShowAuthModal(false)}
          account={currentAccount}
        />
      )}
      </div>
    </div>
  );
}