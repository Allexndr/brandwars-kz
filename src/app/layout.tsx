import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "BrandWars.kz",
  description: "Живая планета брендов Казахстана",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return children;
}
