import type { ProviderService } from "@africacod/domain";
import Link from "next/link";
import { OperationForm } from "./operation-form";
type Detail = Awaited<ReturnType<ProviderService["integrationDetails"]>>;
export function ProviderOperations({
  info,
  testMode,
}: {
  info: Detail;
  testMode: boolean;
}) {
  const { data, jobs, attempts, readiness } = info,
    { order, fulfillment, shipment } = data;
  const create = jobs.find((j) => j.operation === "create");
  return (
    <section className="panel">
      <h2>Provider fulfillment</h2>
      <p>
        ShipCOD ·{" "}
        {testMode
          ? "Deterministic test adapter — no live provider requests"
          : "Production BLOCKED pending API documentation"}
      </p>
      <Link
        className="text-link"
        href={`/apps/shipcod?storeId=${order.storeId}`}
      >
        Configure connection and mappings
      </Link>
      <h3>Handoff checks</h3>
      {Object.entries(readiness.checks).map(([key, value]) => (
        <p key={key}>
          {key}: {value ? "Ready" : "Required"}
        </p>
      ))}
      {testMode &&
        readiness.ready &&
        fulfillment &&
        ["ready", "failed"].includes(fulfillment.status) && (
          <OperationForm
            orderId={order.id}
            intent="provider-send"
            label={
              create?.status === "failed"
                ? "Retry ShipCOD handoff"
                : "Send to ShipCOD"
            }
          />
        )}
      {fulfillment?.mode === "provider" && !shipment && (
        <>
          {create && (
            <p data-testid="provider-job-state">
              Handoff: {create.status} · Attempts: {create.attemptCount}
            </p>
          )}
          {create?.lastError && <p role="alert">{create.lastError}</p>}
          {create &&
            ["pending", "failed", "cancelled"].includes(create.status) && (
              <OperationForm
                orderId={order.id}
                intent="provider-fallback"
                label="Use manual fulfillment"
              />
            )}
          {create?.status === "investigation" && (
            <p>
              Investigate the uncertain provider result before retrying or
              creating another shipment.
            </p>
          )}
        </>
      )}
      {shipment?.providerKey === "shipcod" && (
        <>
          <p>
            Provider: ShipCOD · External shipment ID:{" "}
            {shipment.providerShipmentId}
          </p>
          <p>
            Normalized status: {shipment.status} · Raw provider status:{" "}
            {shipment.providerRawStatus ?? "—"}
          </p>
          <p>Last sync: {shipment.lastSyncAt?.toISOString() ?? "Never"}</p>
          {shipment.integrationError && (
            <p role="alert">{shipment.integrationError}</p>
          )}
          {!["delivered", "returned", "cancelled"].includes(
            shipment.status,
          ) && (
            <>
              <OperationForm
                orderId={order.id}
                intent="provider-sync"
                label="Sync provider status"
              />
              {testMode && (
                <details>
                  <summary>Test adapter status controls</summary>
                  {[
                    "shipped",
                    "out_for_delivery",
                    "delivery_failed",
                    "delivered",
                    "refused",
                    "returned",
                    "unknown",
                  ].map((status) => (
                    <OperationForm
                      key={status}
                      orderId={order.id}
                      intent="provider-simulate"
                      label={`Simulate ${status.replaceAll("_", " ")}`}
                    >
                      <input
                        type="hidden"
                        name="rawStatus"
                        value={`mock_${status}`}
                      />
                    </OperationForm>
                  ))}
                </details>
              )}
            </>
          )}
          {jobs
            .filter((j) => j.operation === "poll")
            .map((j) => (
              <p key={j.id}>
                Synchronization: {j.status}
                {j.lastError && ` · ${j.lastError}`}
              </p>
            ))}
        </>
      )}
      {jobs.length > 0 && (
        <details>
          <summary>Provider job history</summary>
          {jobs.map((j) => (
            <p key={j.id}>
              {j.operation} · {j.status} · Attempts {j.attemptCount} ·{" "}
              {j.lastError ?? "No recorded error"}
            </p>
          ))}
        </details>
      )}
      {attempts.length > 0 && (
        <details>
          <summary>Integration attempts</summary>
          {attempts.map((a) => (
            <p key={a.id}>
              {a.operation} · {a.startedAt.toISOString()} →{" "}
              {a.finishedAt?.toISOString() ?? "In progress"} ·{" "}
              {a.success === null
                ? "Unacknowledged"
                : a.success
                  ? "Succeeded"
                  : "Failed"}{" "}
              · {a.safeError ?? a.responseIdentifier ?? "—"}
            </p>
          ))}
        </details>
      )}
      <Link className="text-link" href={`/orders/${order.id}`}>
        Refresh fulfillment
      </Link>
    </section>
  );
}
