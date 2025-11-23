import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "障害年金シミュレーター",
  description: "障害基礎年金・障害厚生年金の受給額を試算します",
};

export default function Layout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}

