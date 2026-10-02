import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: {
    default: "AfricaCod — Commerce across borders",
    template: "%s | AfricaCod",
  },
  description:
    "A home for your cash-on-delivery business across African markets.",
};
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
