import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "死亡・障害発生確率調査",
  description: "死亡・障害の発生確率を調査します",
};

export default function Layout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}

