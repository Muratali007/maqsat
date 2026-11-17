import { Nav } from "@/components/Nav";
import { getSession } from "@/lib/session";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  const { me } = await getSession();
  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      <Nav name={me.name ?? ""} />
      <main className="mx-auto w-full max-w-5xl flex-1 p-4 md:p-8">{children}</main>
    </div>
  );
}
