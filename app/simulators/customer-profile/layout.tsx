import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "顧客プロフィール設定",
  description: "シミュレーションの前提条件となる家族構成や収入を設定します",
};

export default function Layout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}

