import Link from "next/link";
import { PageHeading, Badge } from "@africacod/ui";
import { formatMoney } from "@africacod/shared/money";
import { ProviderOperations } from "@/components/provider-operations";
import { providers, providerTestMode, requireOrganization } from "@/lib/server";
import { OrderOperations } from "@/components/order-operations";
import { found } from "@/lib/catalog-pages";
export default async function OrderDetail({
  params,
}: {
  params: Promise<{ orderId: string }>;
}) {
  const { session } = await requireOrganization();
  const { orderId } = await params;
  const service = providers();
  const data = await found(service.getOperations(session.user.id, orderId));
  const [agents, integration] = await Promise.all([
    service.listAgents(session.user.id),
    service.integrationDetails(session.user.id, orderId),
  ]);
  const { order, items, attribution, store } = data;
  const timeline = [
    ...data.events.map((e) => ({
      id: e.id,
      at: e.createdAt,
      label: `Order event · ${e.message}`,
    })),
    ...data.attempts.map(({ attempt: a, agentName }) => ({
      id: a.id,
      at: a.attemptedAt,
      label: `Confirmation event · ${a.outcome} · ${agentName}`,
    })),
    ...data.fulfillmentEvents.map((e) => ({
      id: e.id,
      at: e.createdAt,
      label: `Fulfillment event · ${e.fromStatus ?? "none"} → ${e.toStatus}`,
    })),
    ...data.shipmentEvents.map((e) => ({
      id: e.id,
      at: e.occurredAt,
      label: `Shipment event · ${e.source === "poll" ? "ShipCOD" : "Manual"} · ${e.fromStatus ?? "none"} → ${e.toStatus}`,
    })),
  ].sort((a, b) => a.at.getTime() - b.at.getTime());
  return (
    <>
      <Link className="back-link" href="/orders">
        ← Orders
      </Link>
      <PageHeading
        eyebrow={`${store.name} · ${order.marketName}`}
        title={order.orderNumber}
        description={`${order.createdAt.toISOString()} · Cash on delivery`}
        action={
          <div className="order-header-actions">
            <span data-testid="order-commercial-status">
              <Badge active={order.status === "new"}>{order.status}</Badge>
            </span>
            <Badge active={data.shipment?.status === "delivered"}>
              Shipment:{" "}
              {data.shipment?.status.replaceAll("_", " ") ?? "Not created"}
            </Badge>
            <a
              className="button button-green"
              href={
                order.status === "new"
                  ? "#confirmation"
                  : !data.fulfillment
                    ? "#fulfillment"
                    : "#shipment"
              }
            >
              {order.status === "new"
                ? "Review confirmation"
                : !data.fulfillment
                  ? "Prepare fulfillment"
                  : "Review shipment"}
            </a>
          </div>
        }
      />
      {order.duplicateSignal && (
        <p className="preview-banner">
          Possible repeat order: the same phone ordered this product in this
          market within 24 hours. The order was accepted.
        </p>
      )}
      {(order.customFieldSnapshots.length > 0 ||
        order.whatsapp ||
        order.notes) && (
        <section className="panel" aria-label="Additional order details">
          <h2>Additional order details</h2>
          <dl className="order-custom-fields">
            {order.whatsapp && (
              <>
                <dt>WhatsApp</dt>
                <dd>{order.whatsapp}</dd>
              </>
            )}
            {order.notes && (
              <>
                <dt>Notes</dt>
                <dd>{order.notes}</dd>
              </>
            )}
            {order.customFieldSnapshots.map((field) => (
              <div key={field.id}>
                <dt>{field.label}</dt>
                <dd>{field.value}</dd>
              </div>
            ))}
          </dl>
          <p className="muted">
            Captured at checkout. Later Store field edits do not change these
            values.
          </p>
        </section>
      )}
      <nav className="section-nav" aria-label="Order sections">
        <a href="#customer">Customer & Address</a>
        <a href="#items">Items</a>
        <a href="#confirmation">Confirmation</a>
        <a href="#fulfillment">Fulfillment</a>
        <a href="#shipment">Shipment</a>
        <a href="#timeline">Timeline</a>
        <a href="#attribution">Attribution</a>
        <a href="#internal">Internal information</a>
      </nav>
      <div className="order-summary">
        <section id="customer" className="panel">
          <h2>Customer & delivery snapshot</h2>
          <p>
            <strong>{order.customerName}</strong>
            <br />
            {order.phone}
          </p>
          <p>
            {order.address}
            <br />
            {order.city}
            <br />
            {order.region}
            <br />
            {order.marketName} ({order.countryCode ?? "Custom market"})
          </p>
        </section>
        <section className="panel">
          <h2>Commercial totals</h2>
          <p>Subtotal: {formatMoney(order.subtotalMinor, order.currency)}</p>
          <p>
            Delivery fee: {formatMoney(order.shippingFeeMinor, order.currency)}
          </p>
          <p>
            <strong>
              Total: {formatMoney(order.totalMinor, order.currency)}
            </strong>
          </p>
          <p className="muted">
            Original checkout values, preserved when products or offers change.
          </p>
        </section>
      </div>
      <section id="items" className="panel">
        <h2>Items</h2>
        {items.map((item) => (
          <div key={item.id}>
            <h3>{item.productName}</h3>
            <p>
              {item.variantName ?? "No variant"} · SKU: {item.sku ?? "—"}
            </p>
            <p>
              {item.quantity} ×{" "}
              {formatMoney(item.unitPriceMinor, item.currency)} ={" "}
              <strong>{formatMoney(item.lineTotalMinor, item.currency)}</strong>
            </p>
          </div>
        ))}
      </section>
      <OrderOperations data={data} agents={agents} />
      <ProviderOperations info={integration} testMode={providerTestMode()} />
      <div className="order-summary">
        <section id="timeline" className="panel order-timeline">
          <h2>Timeline</h2>
          {timeline.map((event) => (
            <p key={event.id}>
              <strong>{event.label}</strong>
              <br />
              <span className="muted">{event.at.toISOString()}</span>
            </p>
          ))}
        </section>
        <section id="attribution" className="panel order-attribution">
          <h2>Attribution</h2>
          <dl>
            {attribution &&
              Object.entries(attribution)
                .filter(([key]) => !["orderId", "organizationId"].includes(key))
                .map(([key, value]) => (
                  <div key={key}>
                    <dt>{key}</dt>
                    <dd>{value ?? "—"}</dd>
                  </div>
                ))}
          </dl>
        </section>
      </div>
      <section id="internal" className="panel">
        <h2>Internal information</h2>
        <p className="muted">
          Private commercial snapshots for your operations. These values are not
          profit calculations.
        </p>
        {items.map((item) => (
          <p key={item.id}>
            {item.productName} · Unit cost snapshot:{" "}
            {item.unitCostMinor === null
              ? "Not configured"
              : formatMoney(item.unitCostMinor, item.currency)}
          </p>
        ))}
      </section>
    </>
  );
}
