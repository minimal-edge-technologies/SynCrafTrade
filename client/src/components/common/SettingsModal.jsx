// src/components/common/SettingsModal.jsx
import { useState } from 'react';
import useAccountsStore from '../../store/accountsStore';
import { ACCOUNT_TYPES, ACCOUNT_TYPE_LABELS } from '../../constants/accountTypes';
import { X } from 'lucide-react';

export default function SettingsModal({ account, isOpen, onClose }) {
  const { updateAccount } = useAccountsStore();
  const [settings, setSettings] = useState(account.settings);
  const [accountType, setAccountType] = useState(account.accountType);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await updateAccount(account._id, { 
        settings,
        accountType // Include accountType in the update
      });
      onClose();
    } catch (error) {
      console.error('Failed to update settings:', error);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4">
        <div className="flex justify-between items-center p-6 border-b">
          <h2 className="text-xl font-semibold">Account Settings</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-500">
            <X className="w-6 h-6" />
          </button>
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
            <p className="mt-1 text-xs text-gray-500">
              {accountType === ACCOUNT_TYPES.PARENT 
                ? "Parent accounts can be copied from by child accounts" 
                : "Child accounts can copy trades from parent accounts"}
            </p>
            
            {account.accountType !== accountType && (
              <div className="mt-2 p-3 bg-yellow-50 rounded text-xs text-yellow-800">
                <p className="font-medium">Warning:</p>
                {accountType === ACCOUNT_TYPES.PARENT 
                  ? "Changing to a parent account will remove any parent connection and disable copy trading." 
                  : "Changing to a child account will require setting up a parent connection."}
              </div>
            )}
          </div>

          {/* Risk Management */}
          <div>
            <h3 className="text-lg font-medium mb-4">Risk Management</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Max Position Size (%)
                </label>
                <input
                  type="number"
                  min="1"
                  max="100"
                  value={settings.maxPositionSize}
                  onChange={(e) => setSettings(prev => ({
                    ...prev,
                    maxPositionSize: parseInt(e.target.value)
                  }))}
                  className="mt-1 shadow-sm focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 rounded-md"
                />
                <p className="mt-1 text-xs text-gray-500">
                  {accountType === ACCOUNT_TYPES.CHILD 
                    ? "Maximum position size as % of your account regardless of parent position"
                    : "Maximum position size as % of account balance"}
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Risk Limit (%)
                </label>
                <input
                  type="number"
                  step="0.1"
                  min="0.1"
                  max="100"
                  value={settings.riskLimit}
                  onChange={(e) => setSettings(prev => ({
                    ...prev,
                    riskLimit: parseFloat(e.target.value)
                  }))}
                  className="mt-1 shadow-sm focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 rounded-md"
                />
                <p className="mt-1 text-xs text-gray-500">
                  Maximum risk per trade as % of account balance
                </p>
              </div>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">
              Allowed Instruments
            </label>
            <input
              type="text"
              value={settings.allowedInstruments?.join(', ')}
              onChange={(e) => setSettings(prev => ({
                ...prev,
                allowedInstruments: e.target.value.split(',').map(s => s.trim()).filter(Boolean)
              }))}
              className="mt-1 shadow-sm focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 rounded-md"
              placeholder="NIFTY, BANKNIFTY (comma separated)"
            />
            <p className="mt-1 text-xs text-gray-500">
              {accountType === ACCOUNT_TYPES.CHILD 
                ? "Only copy trades for these instruments. Leave empty to copy all"
                : "Specific instruments allowed for trading. Leave empty to allow all"}
            </p>
          </div>

          {/* Copy Trading Settings (for Child accounts) */}
          {accountType === ACCOUNT_TYPES.CHILD && (
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Copy Ratio
              </label>
              <input
                type="number"
                step="0.1"
                min="0.1"
                max="10"
                value={settings.copyRatio}
                onChange={(e) => setSettings(prev => ({
                  ...prev,
                  copyRatio: parseFloat(e.target.value)
                }))}
                className="mt-1 shadow-sm focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 rounded-md"
              />
              <p className="mt-1 text-xs text-gray-500">
                Multiplier for position sizes relative to parent account trades (0.1x to 10x)
              </p>
            </div>
          )}

          <div className="pt-4 border-t flex justify-end">
            <button
              type="button"
              onClick={onClose}
              className="mr-3 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 rounded-md"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-md"
            >
              Save Changes
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}