import "./globals.css";
export const metadata = { title: "CulinaryBrief", description: "Chef-driven meal planning" };
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-dvh text-gray-900">
        <nav className="p-3 border-b flex gap-4">
          <a href="/planner" className="underline">Planner</a>
          <a href="/list" className="underline">Checklist</a>
        </nav>
        <main>{children}</main>
      </body>
    </html>
  );
}
