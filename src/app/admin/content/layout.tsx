import type { Metadata } from "next";
import type { ReactNode } from "react";
import { ContentTabs } from "./_components/content-tabs";

export const metadata: Metadata = { title: "Content" };

export default function ContentLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <ContentTabs />
      {children}
    </>
  );
}
