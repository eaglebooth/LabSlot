import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "LabSlot | Semantic equipment scheduling",
  description: "Sender-authorized laboratory equipment scheduling on GenLayer",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
