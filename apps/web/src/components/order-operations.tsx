import {
  cancellationReasons,
  shipmentTransitions,
  fulfillmentTransitions,
  type OperationsService,
} from "@africacod/domain";
import { OperationForm } from "./operation-form";
type Detail = Awaited<ReturnType<OperationsService["getOperations"]>>;
export function OrderOperations({
  data,
  agents,
}: {
  data: Detail;
  agents: { id: string; name: string }[];
}) {
  const { order, fulfillment, shipment } = data;
  return (
    <>
      <section className="panel">
        <h2>Confirmation</h2>
        <p>
          Confirmation state:{" "}
          <strong data-testid="confirmation-state">{data.confirmation}</strong>
        </p>
        <p>
          Assigned agent:{" "}
          {agents.find((a) => a.id === order.assignedMembershipId)?.name ??
            "Unassigned"}
        </p>
        {data.nextCallbackAt && (
          <p>
            Next callback: {data.nextCallbackAt.toISOString()} ·{" "}
            {data.callbackTiming}
          </p>
        )}
        {order.status === "new" && (
          <>
            <OperationForm
              orderId={order.id}
              intent="assign"
              label="Save assignment"
            >
              <label>
                Assigned agent
                <select
                  name="agentId"
                  defaultValue={order.assignedMembershipId ?? ""}
                >
                  <option value="">Unassigned</option>
                  {agents.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                    </option>
                  ))}
                </select>
              </label>
            </OperationForm>
            <div className="operation-grid">
              <OperationForm
                orderId={order.id}
                intent="attempt"
                label="No answer"
              >
                <input type="hidden" name="outcome" value="no_answer" />
                <label>
                  Attempt note
                  <input name="note" maxLength={2000} />
                </label>
              </OperationForm>
              <OperationForm
                orderId={order.id}
                intent="attempt"
                label="Set callback"
              >
                <input type="hidden" name="outcome" value="callback" />
                <label>
                  Callback date and time (UTC)
                  <input type="datetime-local" name="nextCallbackAt" required />
                </label>
                <label>
                  Callback note
                  <input name="note" maxLength={2000} />
                </label>
              </OperationForm>
              <OperationForm
                orderId={order.id}
                intent="attempt"
                label="Confirm order"
              >
                <input type="hidden" name="outcome" value="confirmed" />
                <p>Accept this COD order. Shipment status remains separate.</p>
              </OperationForm>
              <OperationForm
                orderId={order.id}
                intent="attempt"
                label="Cancel order"
              >
                <input type="hidden" name="outcome" value="cancelled" />
                <label>
                  Cancellation reason
                  <select name="reason" required defaultValue="">
                    <option value="" disabled>
                      Choose a reason
                    </option>
                    {cancellationReasons.map((r) => (
                      <option key={r} value={r}>
                        {r.replaceAll("_", " ")}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Cancellation note
                  <input name="note" maxLength={2000} />
                </label>
              </OperationForm>
            </div>
          </>
        )}
        {order.confirmedAt && (
          <p>Confirmed: {order.confirmedAt.toISOString()}</p>
        )}
        {order.cancellationReason && (
          <p>
            Cancellation reason: {order.cancellationReason.replaceAll("_", " ")}
          </p>
        )}
        <h3>Attempts</h3>
        {data.attempts.length ? (
          data.attempts.map(({ attempt: a, agentName }) => (
            <p key={a.id}>
              <strong>{a.outcome}</strong> · {agentName} ·{" "}
              {a.attemptedAt.toISOString()}
              {a.note && <> · {a.note}</>}
              {a.nextCallbackAt && (
                <> · Callback {a.nextCallbackAt.toISOString()}</>
              )}
            </p>
          ))
        ) : (
          <p className="muted">No attempts recorded.</p>
        )}
      </section>
      <div className="order-summary">
        <section className="panel">
          <h2>Fulfillment</h2>
          <p>
            Mode: {fulfillment?.mode === "provider" ? "ShipCOD" : "Manual"} ·{" "}
            <strong data-testid="fulfillment-state">
              {fulfillment?.status ?? "Not created"}
            </strong>
          </p>
          {!fulfillment && order.status === "confirmed" && (
            <OperationForm
              orderId={order.id}
              intent="fulfillment"
              label="Create fulfillment"
            />
          )}
          {!fulfillment && order.status !== "confirmed" && (
            <p className="muted">
              Confirm this order before creating fulfillment.
            </p>
          )}
          {fulfillment?.mode === "manual" &&
            fulfillmentTransitions[fulfillment.status].map((target) => (
              <OperationForm
                key={target}
                orderId={order.id}
                intent="fulfillment-transition"
                label={`Fulfillment: ${target}`}
              >
                <input type="hidden" name="target" value={target} />
              </OperationForm>
            ))}
          <p className="muted">
            Fulfilled means a Shipment was created. It does not mean delivered.
          </p>
        </section>
        <section className="panel">
          <h2>Shipment</h2>
          {shipment ? (
            <>
              <p>
                {shipment.providerKey === "manual" ? "Manual" : "ShipCOD"} ·{" "}
                <strong data-testid="shipment-state">{shipment.status}</strong>
              </p>
              <p>Tracking: {shipment.trackingNumber ?? "Not provided"}</p>
              {shipment.trackingUrl && (
                <a
                  className="text-link"
                  href={shipment.trackingUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Open tracking
                </a>
              )}
              {shipment.providerKey === "manual" &&
                shipmentTransitions[shipment.status].map((target) => (
                  <OperationForm
                    key={target}
                    orderId={order.id}
                    intent="shipment-transition"
                    label={`Mark ${target.replaceAll("_", " ")}`}
                  >
                    <input
                      type="hidden"
                      name="shipmentId"
                      value={shipment.id}
                    />
                    <input type="hidden" name="target" value={target} />
                  </OperationForm>
                ))}
              {shipment.deliveredAt && (
                <p>Delivered: {shipment.deliveredAt.toISOString()}</p>
              )}
              {shipment.returnedAt && (
                <p>Returned: {shipment.returnedAt.toISOString()}</p>
              )}
            </>
          ) : fulfillment?.mode === "manual" &&
            ["pending", "ready", "processing"].includes(fulfillment.status) ? (
            <OperationForm
              orderId={order.id}
              intent="shipment"
              label="Create manual shipment"
            >
              <label>
                Tracking number (optional)
                <input name="trackingNumber" maxLength={120} />
              </label>
              <label>
                Tracking URL (optional)
                <input name="trackingUrl" type="url" maxLength={2000} />
              </label>
            </OperationForm>
          ) : (
            <p className="muted">
              Create a ready fulfillment before creating a shipment.
            </p>
          )}
        </section>
      </div>
    </>
  );
}
