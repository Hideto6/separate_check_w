"use client";

import { GroupProvider } from "@/contexts/GroupContext";
import AnonymousAuthGate from "@/components/features/auth/AnonymousAuthGate";

export default function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <GroupProvider>
      <AnonymousAuthGate>{children}</AnonymousAuthGate>
    </GroupProvider>
  );
}
