import { ReactNode } from "react";
import { AccountProvider } from "@/components/AccountProvider";
import Shell from "@/components/Shell";

export default function ConsoleLayout({ children }: { children: ReactNode }) {
  return (
    <AccountProvider>
      <Shell>{children}</Shell>
    </AccountProvider>
  );
}
