// src/components/accounts/AccountSettings.jsx
import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import useAccountsStore from '../../store/accountsStore';
import { Loader2, ArrowLeft, Save } from 'lucide-react';
import { ACCOUNT_TYPES, ACCOUNT_TYPE_LABELS } from '../../constants/accountTypes';

export default function AccountSettings() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { getAccountById, updateAccount, isLoading, error } = useAccountsStore();
  
  // Add account state
  const [account, setAccount] = useState(null);
  const [settings, setSettings] = useState({
    copyRatio: 1.0,
    maxPositionSize: 10,
    riskLimit: 2,
    allowedInstruments: []
  });
  const [accountType, setAccountType] = useState('');

  useEffect(() => {
    const currentAccount = getAccountById(id);
    if (currentAccount) {
      setAccount(currentAccount);  // Set the account state
      setAccountType(currentAccount.accountType); // Add this line to initialize account type
      if (currentAccount.settings) {
        setSettings(currentAccount.settings);
      }
    }
  }, [id, getAccountById]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await updateAccount(id, { 
        settings,
        accountType });
      navigate('/accounts');
    } catch (error) {
      console.error('Failed to update settings:', error);
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    );
  }

  // Add loading state for account
  if (!account) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    );
  }

  const handleSettingChange = (key, value) => {
    setSettings(prev => ({
      ...prev,
      [key]: value
    }));
  };

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-6">
        <button
          onClick={() => navigate('/accounts')}
          className="flex items-center text-gray-600 hover:text-gray-900"
        >
          <ArrowLeft className="w-5 h-5 mr-2" />
          Back to Accounts
        </button>
      </div>

      <div className="bg-white shadow rounded-lg">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">
            {account.accountType === ACCOUNT_TYPES.PARENT ? 'Parent' : 'Child'} Account Settings
          </h2>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Account Type Selection (NEW) */}
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Account Type
            </label>
            <select
              value={accountType}
              onChange={(e) => setAccountType(e.target.value)}
              className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md"
            >
              <option value={ACCOUNT_TYPES.PARENT}>{ACCOUNT_TYPE_LABELS[ACCOUNT_TYPES.PARENT]}</option>
              <option value={ACCOUNT_TYPES.CHILD}>{ACCOUNT_TYPE_LABELS[ACCOUNT_TYPES.CHILD]}</option>
            </select>
            <p className="mt-1 text-sm text-gray-500">
              {accountType === ACCOUNT_TYPES.PARENT 
                ? "Parent accounts can be copied from by child accounts" 
                : "Child accounts can copy trades from parent accounts"}
            </p>
            
            {account?.accountType !== accountType && (
              <div className="mt-2 p-3 bg-yellow-50 rounded text-sm text-yellow-800">
                <p className="font-medium">Warning:</p>
                {accountType === ACCOUNT_TYPES.PARENT 
                  ? "Changing to a parent account will remove any parent connection and disable copy trading." 
                  : "Changing to a child account will require setting up a parent connection."}
              </div>
            )}
          </div>

          {accountType === ACCOUNT_TYPES.CHILD && (
            <div>
              <label className="block text-sm font-medium text-gray-700">Copy Ratio</label>
              <div className="mt-1">
                <input
                  type="number"
                  step="0.1"
                  min="0.1"
                  max="10"
                  value={settings.copyRatio}
                  onChange={(e) => handleSettingChange('copyRatio', parseFloat(e.target.value))}
                  className="shadow-sm focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 rounded-md"
                />
                <p className="mt-1 text-sm text-gray-500">
                  Multiplier for position sizes relative to parent account trades (0.1x to 10x)
                </p>
              </div>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700">
              Maximum Position Size (%)
            </label>
            <div className="mt-1">
              <input
                type="number"
                min="1"
                max="100"
                value={settings.maxPositionSize}
                onChange={(e) => handleSettingChange('maxPositionSize', parseInt(e.target.value))}
                className="shadow-sm focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 rounded-md"
              />
              <p className="mt-1 text-sm text-gray-500">
                {account.accountType === ACCOUNT_TYPES.CHILD 
                  ? "Maximum position size as % of your account regardless of parent position"
                  : "Maximum position size as % of account balance to limit risk exposure per trade"}
              </p>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">
              Risk Limit (%)
            </label>
            <div className="mt-1">
              <input
                type="number"
                step="0.1"
                min="0.1"
                max="100"
                value={settings.riskLimit}
                onChange={(e) => handleSettingChange('riskLimit', parseFloat(e.target.value))}
                className="shadow-sm focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 rounded-md"
              />
              <p className="mt-1 text-sm text-gray-500">
                Maximum risk allowed per trade as % of account balance
              </p>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">
              Allowed Instruments
            </label>
            <div className="mt-1">
              <input
                type="text"
                value={settings.allowedInstruments.join(', ')}
                onChange={(e) => handleSettingChange('allowedInstruments', 
                  e.target.value.split(',').map(s => s.trim()).filter(Boolean)
                )}
                className="shadow-sm focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 rounded-md"
                placeholder="NIFTY, BANKNIFTY (comma separated)"
              />
              <p className="mt-1 text-sm text-gray-500">
                {account.accountType === ACCOUNT_TYPES.CHILD 
                  ? "Only copy trades for these instruments. Leave empty to copy all"
                  : "Specific instruments allowed for trading. Leave empty to allow all"}
              </p>
            </div>
          </div>

          <button
            type="submit"
            className="w-full py-2 px-4 bg-indigo-600 text-white rounded hover:bg-indigo-700"
          >
            Save Settings
          </button>
        </form>
      </div>
    </div>
  );
}