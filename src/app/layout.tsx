import type { Metadata } from "next";
import { Open_Sans } from "next/font/google";
import "./globals.css";

// Bold, tightly tracked headings in the style of Australian traffic-management signage.
const heading = Open_Sans({
  subsets: ["latin"],
  weight: ["600", "700", "800"],
  variable: "--font-heading",
  display: "swap",
});

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
    <html lang="en-AU" className={heading.variable}>
      <body>{children}</body>
    </html>
  );
}
