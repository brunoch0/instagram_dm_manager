"use client";

import { createContext, useContext, useEffect, useState, ReactNode } from "react";

export interface Account {
  id: string;
  unit_name: string;
  ig_username: string;
  ig_user_id: string | null;
  token_expires_at: string | null;
  active: boolean;
  has_token: boolean;
}

interface AccountContextValue {
  accounts: Account[];
  account: Account | null;
  setAccountId: (id: string) => void;
  reload: () => Promise<void>;
}

const AccountContext = createContext<AccountContextValue>({
  accounts: [],
  account: null,
  setAccountId: () => {},
  reload: async () => {},
});

export function useAccount() {
  return useContext(AccountContext);
}

export function AccountProvider({ children }: { children: ReactNode }) {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [accountId, setAccountIdState] = useState<string | null>(null);

  const reload = async () => {
    const res = await fetch("/api/accounts");
    const json = await res.json();
    const list: Account[] = json.accounts ?? [];
    setAccounts(list);
    const saved = localStorage.getItem("selected_account");
    if (saved && list.some((a) => a.id === saved)) {
      setAccountIdState(saved);
    } else if (list.length > 0) {
      setAccountIdState(list[0].id);
    }
  };

  useEffect(() => {
    reload();
  }, []);

  const setAccountId = (id: string) => {
    localStorage.setItem("selected_account", id);
    setAccountIdState(id);
  };

  const account = accounts.find((a) => a.id === accountId) ?? null;

  return (
    <AccountContext.Provider value={{ accounts, account, setAccountId, reload }}>
      {children}
    </AccountContext.Provider>
  );
}
