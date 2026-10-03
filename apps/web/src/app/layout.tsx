import type { Metadata } from "next";
import "@fontsource/geist/latin-400.css";
import "@fontsource/geist/latin-600.css";
import "@fontsource/inter/latin-400.css";
import "@fontsource/inter/latin-600.css";
import "@fontsource/poppins/latin-400.css";
import "@fontsource/poppins/latin-600.css";
import "@fontsource/roboto/latin-400.css";
import "@fontsource/roboto/latin-600.css";
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
