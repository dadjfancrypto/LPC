import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "必要保障額シミュレーター",
  description: "万が一の際に必要な生活費や教育費を試算します",
};

export default function Layout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}

