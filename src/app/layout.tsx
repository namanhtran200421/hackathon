import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "Melbourne Traffic Lab",
  description:
    "Run Melbourne traffic scenarios and explore how street closures change the network.",
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en-AU">
      <body>{children}</body>
    </html>
  );
}
