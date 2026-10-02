import { requireOrganization } from "@/lib/server";
import { Shell } from "@/components/shell";
export const dynamic = "force-dynamic";
export default async function WorkspaceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { session, organization } = await requireOrganization();
  return (
    <Shell user={session.user} organization={organization}>
      {children}
    </Shell>
  );
}
