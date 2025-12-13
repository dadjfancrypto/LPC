import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "家計のリスク分析",
  description: "保険で備えるリスク vs 貯蓄で備えるリスク",
};

export default function Layout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}

