// src/components/common/AccountSelector.jsx
import useAccountsStore from '../../store/accountsStore';
import { ACCOUNT_TYPE_LABELS } from '../../constants/accountTypes';

export default function AccountSelector() {
  const { accounts, currentAccount, setCurrentAccount } = useAccountsStore();

  return (
    <div className="relative inline-block text-left">
      <select
        value={currentAccount?._id || ''}
        onChange={(e) => {
          const account = accounts.find(a => a._id === e.target.value);
          setCurrentAccount(account);
        }}
        className="block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md"
      >
        {accounts.map((account) => (
          <option key={account._id} value={account._id}>
            {account.name || account.clientCode} ({ACCOUNT_TYPE_LABELS[account.accountType]})
          </option>
        ))}
      </select>
    </div>
  );
}