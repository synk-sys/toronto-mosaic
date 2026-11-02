import type { Metadata } from "next";
import { AdminApp } from "./AdminApp";

export const metadata: Metadata = { title: "Organizer dashboard", robots: { index: false } };

export default function AdminPage() {
  return <AdminApp />;
}
