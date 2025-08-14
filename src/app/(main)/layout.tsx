"use client";

import { GroupProvider } from "@/contexts/GroupContext";

export default function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <GroupProvider>{children}</GroupProvider>;
}
