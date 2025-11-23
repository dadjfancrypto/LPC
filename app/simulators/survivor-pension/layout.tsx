import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "遺族年金シミュレーター",
  description: "遺族基礎年金・遺族厚生年金の受給額を試算します",
};

export default function Layout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}

