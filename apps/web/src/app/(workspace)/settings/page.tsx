import { Building2, Mail, ShieldCheck, UserRound } from "lucide-react";
import { PageHeading } from "@africacod/ui";
import { requireOrganization } from "@/lib/server";
export default async function Settings() {
  const { session, organization } = await requireOrganization();
  return (
    <>
      <PageHeading
        eyebrow="YOUR WORKSPACE"
        title="Settings"
        description="Your account and organization details."
      />
      <section className="panel settings-panel">
        <div className="panel-heading">
          <UserRound size={20} />
          <h2>Your account</h2>
        </div>
        <dl className="settings-rows">
          <div>
            <dt>Full name</dt>
            <dd>{session.user.name}</dd>
          </div>
          <div>
            <dt>
              <Mail size={16} /> Email address
            </dt>
            <dd>{session.user.email}</dd>
          </div>
        </dl>
      </section>
      <section className="panel settings-panel">
        <div className="panel-heading">
          <Building2 size={20} />
          <h2>Organization</h2>
        </div>
        <dl className="settings-rows">
          <div>
            <dt>Organization name</dt>
            <dd>{organization.name}</dd>
          </div>
          <div>
            <dt>
              <ShieldCheck size={16} /> Your role
            </dt>
            <dd>{organization.role === "owner" ? "Owner" : "Admin"}</dd>
          </div>
        </dl>
        <p className="settings-note">
          Only members of your organization can access its stores and markets.
        </p>
      </section>
    </>
  );
}
