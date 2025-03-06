// src/components/dashboard/Dashboard.jsx
import { useState  } from 'react';
import { useNavigate } from 'react-router-dom';
import useAccountsStore from '../../store/accountsStore';
import { ACCOUNT_TYPES } from '../../constants/accountTypes';
import { Eye, Settings, Link, Activity, Users } from 'lucide-react';
import SettingsModal from '../common/SettingsModal';
import ConnectAccountModal from '../common/ConnectAccountModal';
import { Switch } from '@headlessui/react'

export default function Dashboard() {
  const navigate = useNavigate();
  const { accounts, isLoading } = useAccountsStore();
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [selectedAccount, setSelectedAccount] = useState(null);

  const openSettings = (account) => {
    setSelectedAccount(account);
    setIsSettingsOpen(true);
  };

  const parentAccounts = accounts.filter(acc => acc.accountType === ACCOUNT_TYPES.PARENT);
  const childAccounts = accounts.filter(acc => acc.accountType === ACCOUNT_TYPES.CHILD);

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      {/* Parent Accounts Section */}
      <div className="mb-8">
        <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
          Parent Accounts
          <span className="ml-2 px-2.5 py-0.5 text-xs font-medium bg-purple-100 text-purple-800 rounded-full">
            {parentAccounts.length}
          </span>
        </h2>

        <div className="grid gap-6">
          {parentAccounts.map(account => (
            <ParentAccountCard key={account._id} account={account} openSettings={openSettings} />
          ))}
          {parentAccounts.length === 0 && (
            <p className="text-gray-500 text-center py-4">No parent accounts found</p>
          )}
        </div>
      </div>

      {/* Child Accounts Section */}
      <div>
        <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
          Child Accounts
          <span className="ml-2 px-2.5 py-0.5 text-xs font-medium bg-blue-100 text-blue-800 rounded-full">
            {childAccounts.length}
          </span>
        </h2>

        <div className="grid gap-6">
          {childAccounts.map(account => (
            <ChildAccountCard key={account._id} account={account} openSettings={openSettings} />
          ))}
          {childAccounts.length === 0 && (
            <p className="text-gray-500 text-center py-4">No child accounts found</p>
          )}
        </div>
      </div>
      {/* Settings Modal */}
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

function ParentAccountCard({ account, openSettings }) {
    const navigate = useNavigate();
    const { accounts, updateAccount } = useAccountsStore();
  
    // Get connected child accounts
    const connectedChildren = accounts.filter(acc => 
      acc.accountType === ACCOUNT_TYPES.CHILD && acc.parentAccount === account._id
    );

    const handleViewDetails = (account) => {
      if (!account?._id) {
        console.error('Invalid account ID');
        return;
      }
      navigate(`/account-details/${account._id}`);
    };
  
    const handleChildToggle = async (childAccount) => {
      try {
        await updateAccount(childAccount._id, {
          copyTradingEnabled: !childAccount.copyTradingEnabled
        });
      } catch (error) {
        console.error('Failed to toggle child account:', error);
      }
    };
  
    return (
      <div className="bg-white rounded-lg shadow">
        <div className="p-6">
          {/* Header Section */}
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-medium text-gray-900">
                {account.name || account.clientCode}
              </h3>
              <div className="mt-1 flex items-center space-x-2">
                <span className="text-sm text-gray-500">
                  Balance: ₹{account.balance?.net || 0}
                </span>
                <span className="px-2.5 py-0.5 text-xs font-medium bg-purple-100 text-purple-800 rounded-full">
                  Parent Account
                </span>
              </div>
            </div>
            <div className="flex space-x-2">
            <button
                onClick={() => handleViewDetails(account)}
                className="p-2 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100"
              >
                <Eye className="w-5 h-5" />
              </button>
              <button
                onClick={() => openSettings(account)}
                className="p-2 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100"
              >
                <Settings className="w-5 h-5" />
              </button>
            </div>
          </div>
  
          {/* Trading Activity */}
          <div className="mt-4 grid grid-cols-3 gap-4">
            <div className="flex items-center space-x-2 text-sm text-gray-500">
              <Activity className="w-4 h-4" />
              <span>Active Positions: {account.positions?.length || 0}</span>
            </div>
            <div className="flex items-center space-x-2 text-sm text-gray-500">
              <Users className="w-4 h-4" />
              <span>Connected Children: {connectedChildren.length}</span>
            </div>
          </div>
  
          {/* Connected Child Accounts */}
          <div className="mt-4">
            <h4 className="text-sm font-medium text-gray-700">Connected Child Accounts</h4>
            <div className="mt-2 space-y-2">
              {connectedChildren.length === 0 ? (
                <div className="text-sm text-gray-500">No child accounts connected</div>
              ) : (
                <div className="divide-y divide-gray-100">
                  {connectedChildren.map(child => (
                    <div key={child._id} className="py-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                          <span className="text-sm font-medium">{child.name || child.clientCode}</span>
                          <span className="text-xs text-gray-500">({child.settings.copyRatio}x)</span>
                        </div>
                        <div className="flex items-center space-x-3">
                          <Switch
                            checked={child.copyTradingEnabled}
                            onChange={() => handleChildToggle(child)}
                            className={`${
                              child.copyTradingEnabled ? 'bg-green-500' : 'bg-gray-200'
                            } relative inline-flex h-5 w-10 items-center rounded-full`}
                          >
                            <span className="sr-only">Enable copy trading</span>
                            <span
                              className={`${
                                child.copyTradingEnabled ? 'translate-x-5' : 'translate-x-1'
                              } inline-block h-4 w-4 transform rounded-full bg-white transition`}
                            />
                          </Switch>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  function ChildAccountCard({ account, openSettings }) {
    const navigate = useNavigate();
    const { accounts, updateAccount } = useAccountsStore();
    const [isConnectModalOpen, setIsConnectModalOpen] = useState(false);
  
    const parentAccount = account.parentAccount 
      ? accounts.find(acc => acc._id === account.parentAccount) 
      : null;
  
    const handleCopyToggle = async () => {
      try {
        await updateAccount(account._id, {
          copyTradingEnabled: !account.copyTradingEnabled
        });
      } catch (error) {
        console.error('Failed to toggle copy trading:', error);
      }
    };

    const handleViewDetails = (account) => {
      if (!account?._id) {
        console.error('Invalid account ID');
        return;
      }
      navigate(`/account-details/${account._id}`);
    };
  
    const handleMultiplierChange = async (value) => {
      try {
        await updateAccount(account._id, {
          settings: {
            ...account.settings,
            copyRatio: parseFloat(value)
          }
        });
      } catch (error) {
        console.error('Failed to update multiplier:', error);
      }
    };
  
    return (
      <div className="bg-white rounded-lg shadow">
        <div className="p-6">
          {/* Header Section */}
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-medium text-gray-900">
                {account.name || account.clientCode}
              </h3>
              <div className="mt-1 flex items-center space-x-2">
                <span className="text-sm text-gray-500">
                  Balance: ₹{account.balance?.net || 0}
                </span>
                <span className={`px-2.5 py-0.5 text-xs font-medium ${
                  account.copyTradingEnabled && parentAccount
                    ? 'bg-green-100 text-green-800'
                    : 'bg-gray-100 text-gray-600'
                } rounded-full`}>
                  {account.copyTradingEnabled && parentAccount
                    ? 'Copying Active'
                    : 'Copying Inactive'}
                </span>
              </div>
            </div>
            <div className="flex items-center space-x-3">
              {parentAccount && (
                <div className="flex items-center space-x-2">
                  <label className="text-sm text-gray-600">Multiplier:</label>
                  <input
                    type="number"
                    value={account.settings?.copyRatio || 1}
                    onChange={(e) => handleMultiplierChange(e.target.value)}
                    className="w-20 px-2 py-1 text-sm border rounded"
                    step="0.1"
                    min="0.1"
                    max="10"
                  />
                </div>
              )}
              <button
                onClick={() => handleViewDetails(account)}
                className="p-2 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100"
              >
                <Eye className="w-5 h-5" />
              </button>
              <button
                onClick={() => openSettings(account)}
                className="p-2 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100"
              >
                <Settings className="w-5 h-5" />
              </button>
            </div>
          </div>
  
          {/* Copy Trading Status */}
          <div className="mt-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                {parentAccount ? (
                  <>
                    <Link className="w-4 h-4 text-green-500" />
                    <span className="text-sm">
                      Connected to: <span className="font-medium">{parentAccount.name || parentAccount.clientCode}</span>
                    </span>
                    <Switch
                      checked={account.copyTradingEnabled}
                      onChange={handleCopyToggle}
                      className={`${
                        account.copyTradingEnabled ? 'bg-green-500' : 'bg-gray-200'
                      } relative inline-flex h-6 w-11 items-center rounded-full`}
                    >
                      <span className="sr-only">Enable copy trading</span>
                      <span
                        className={`${
                          account.copyTradingEnabled ? 'translate-x-6' : 'translate-x-1'
                        } inline-block h-4 w-4 transform rounded-full bg-white transition`}
                      />
                    </Switch>
                  </>
                ) : (
                  <>
                    <Link className="w-4 h-4 text-gray-400" />
                    <span className="text-sm text-gray-500">Not connected to any parent account</span>
                  </>
                )}
              </div>
              <button
                onClick={() => setIsConnectModalOpen(true)}
                className="px-3 py-1 text-sm text-indigo-600 hover:bg-indigo-50 rounded-md"
              >
                {parentAccount ? 'Change Connection' : 'Connect'}
              </button>
            </div>
          </div>
  
          {/* Current Position Summary */}
          {parentAccount && account.copyTradingEnabled && (
            <div className="mt-4 bg-gray-50 rounded-md p-3">
              <div className="text-sm text-gray-600">
                <div className="flex items-center justify-between">
                  <span>Copying {account.positions?.length || 0} positions</span>
                  <span className="text-xs">
                    {account.settings?.copyRatio}x multiplier
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>
  
        <ConnectAccountModal
          isOpen={isConnectModalOpen}
          onClose={() => setIsConnectModalOpen(false)}
          childAccount={account}
        />
      </div>
    );
  }