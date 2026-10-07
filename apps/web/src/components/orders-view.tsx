import Link from "next/link";
import { PageHeading, StatusBadge, TableScroll } from "@africacod/ui";
import { formatMoney } from "@africacod/shared/money";
import { operations, requireOrganization } from "@/lib/server";
import {
  operationalFiltersInput as orderFiltersInput,
  callbackTiming,
} from "@africacod/domain";
import { OperationForm } from "@/components/operation-form";
export async function OrdersView({
  searchParams,
  mode = "orders",
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
  mode?: "orders" | "confirmation" | "callbacks" | "fulfillment";
}) {
  const { session } = await requireOrganization();
  const query = await searchParams;
  const scalar = (name: string) =>
    typeof query[name] === "string" ? query[name] || undefined : undefined;
  const parsed = orderFiltersInput.safeParse({
    storeId: scalar("storeId"),
    marketId: scalar("marketId"),
    status: scalar("status"),
    dateFrom: scalar("dateFrom"),
    dateTo: scalar("dateTo"),
    search: scalar("search"),
    page: Number(scalar("page") ?? 1),
    confirmation: scalar("confirmation"),
    fulfillment: scalar("fulfillment"),
    shipment: scalar("shipment"),
    agent: scalar("agent"),
    callbacks:
      scalar("callbacks") ?? (mode === "callbacks" ? "all" : undefined),
  });
  const service = operations();
  const agents = await service.listAgents(session.user.id);
  const route =
    mode === "orders"
      ? "/orders"
      : mode === "fulfillment"
        ? "/fulfillment"
        : `/orders/${mode}`;
  const filter = parsed.success ? parsed.data : orderFiltersInput.parse({});
  if (mode === "fulfillment") filter.status = "confirmed";
  if (mode === "confirmation" && !filter.confirmation && !filter.status)
    filter.status = "new";
  const [result, stores] = await Promise.all([
    service.listOperationalOrders(session.user.id, filter),
    service.listStores(session.user.id),
  ]);
  const markets = (
    await Promise.all(
      stores.map((s) => service.listMarkets(session.user.id, s.id)),
    )
  ).flat();
  function pageUrl(page: number) {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(filter))
      if (value && key !== "page") params.set(key, String(value));
    params.set("page", String(page));
    return `${route}?${params}`;
  }
  return (
    <>
      <PageHeading
        eyebrow="OPERATIONS"
        title={
          mode === "orders"
            ? "Orders"
            : mode === "confirmation"
              ? "Confirmation queue"
              : mode === "callbacks"
                ? "Callbacks"
                : "Fulfillment"
        }
        description={
          mode === "confirmation"
            ? "Contact customers, record outcomes and schedule follow-ups."
            : mode === "callbacks"
              ? "Follow up on scheduled customer callbacks."
              : mode === "fulfillment"
                ? "Prepare confirmed orders and track shipment progress."
                : "Review customer orders, confirmation and fulfillment."
        }
      />
      {!parsed.success && (
        <p role="alert" className="form-error">
          Invalid filters. Showing all orders.
        </p>
      )}
      <nav className="workflow-nav" aria-label="Order workflows">
        <Link
          className="button button-outline"
          aria-current={mode === "orders" ? "page" : undefined}
          href="/orders"
        >
          All orders
        </Link>
        <Link
          className="button button-outline"
          aria-current={mode === "confirmation" ? "page" : undefined}
          href="/orders/confirmation"
        >
          Confirmation queue
        </Link>
        <Link
          className="button button-outline"
          aria-current={mode === "callbacks" ? "page" : undefined}
          href="/orders/callbacks"
        >
          Callbacks
        </Link>
        <Link
          className="button button-outline"
          aria-current={mode === "fulfillment" ? "page" : undefined}
          href="/fulfillment"
        >
          Fulfillment
        </Link>
      </nav>
      {(mode === "confirmation" || mode === "callbacks") && (
        <nav className="queue-tabs" aria-label="Confirmation states">
          {[
            ["Uncontacted", "uncontacted"],
            ["Attempted", "attempted"],
            ["Callbacks Due", "callback_due"],
            ["Confirmed", "confirmed"],
            ["Cancelled", "cancelled"],
          ].map(([label, value]) => (
            <Link
              key={value}
              aria-current={filter.confirmation === value ? "page" : undefined}
              href={`/orders/confirmation?confirmation=${value}`}
            >
              {label}
            </Link>
          ))}
        </nav>
      )}
      {mode === "fulfillment" && (
        <>
          <p className="preview-banner">
            Manual fulfillment is available. ShipCOD is a deterministic test
            adapter only; production API access is blocked.
          </p>
          <nav className="queue-tabs" aria-label="Fulfillment states">
            {[
              ["Awaiting setup", "none"],
              ["Ready", "ready"],
              ["Processing", "processing"],
              ["Failed", "failed"],
              ["Fulfilled", "fulfilled"],
            ].map(([label, value]) => (
              <Link
                key={value}
                aria-current={filter.fulfillment === value ? "page" : undefined}
                href={`/fulfillment?fulfillment=${value}`}
              >
                {label}
              </Link>
            ))}
          </nav>
        </>
      )}
      <section className="panel">
        <form className="catalog-filters" method="get">
          <label>
            Search
            <input
              name="search"
              defaultValue={filter.search}
              placeholder="Reference, customer or phone"
            />
          </label>
          <label>
            Store
            <select name="storeId" defaultValue={filter.storeId ?? ""}>
              <option value="">All stores</option>
              {stores.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Market
            <select name="marketId" defaultValue={filter.marketId ?? ""}>
              <option value="">All markets</option>
              {markets
                .filter((m) => !filter.storeId || m.storeId === filter.storeId)
                .map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.countryName}
                  </option>
                ))}
            </select>
          </label>
          <label>
            Status
            <select name="status" defaultValue={filter.status ?? ""}>
              <option value="">All statuses</option>
              <option value="new">New</option>
              <option value="confirmed">Confirmed</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </label>
          <label>
            Confirmation state
            <select
              name="confirmation"
              defaultValue={filter.confirmation ?? ""}
            >
              <option value="">All states</option>
              {[
                "uncontacted",
                "attempted",
                "callback_due",
                "confirmed",
                "cancelled",
              ].map((v) => (
                <option key={v} value={v}>
                  {v.replaceAll("_", " ")}
                </option>
              ))}
            </select>
          </label>
          <label>
            Fulfillment state
            <select name="fulfillment" defaultValue={filter.fulfillment ?? ""}>
              <option value="">All states</option>
              {[
                "none",
                "pending",
                "ready",
                "processing",
                "failed",
                "fulfilled",
                "cancelled",
              ].map((v) => (
                <option key={v} value={v}>
                  {v === "none" ? "Awaiting fulfillment" : v}
                </option>
              ))}
            </select>
          </label>
          <label>
            Shipment state
            <select name="shipment" defaultValue={filter.shipment ?? ""}>
              <option value="">All states</option>
              {[
                "none",
                "created",
                "shipped",
                "out_for_delivery",
                "delivery_failed",
                "delivered",
                "refused",
                "returned",
                "cancelled",
              ].map((v) => (
                <option key={v} value={v}>
                  {v.replaceAll("_", " ")}
                </option>
              ))}
            </select>
          </label>
          <label>
            Assigned agent
            <select name="agent" defaultValue={filter.agent ?? ""}>
              <option value="">All agents</option>
              <option value="unassigned">Unassigned</option>
              {agents.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Callbacks
            <select name="callbacks" defaultValue={filter.callbacks ?? ""}>
              <option value="">Any</option>
              <option value="due">Overdue / due now</option>
              <option value="upcoming">Upcoming</option>
              <option value="all">All scheduled callbacks</option>
            </select>
          </label>
          <label>
            From
            <input name="dateFrom" type="date" defaultValue={filter.dateFrom} />
          </label>
          <label>
            To
            <input name="dateTo" type="date" defaultValue={filter.dateTo} />
          </label>
          <button className="button button-green">Filter orders</button>
          <Link className="button button-outline" href={route}>
            Reset filters
          </Link>
        </form>
        {result.rows.length ? (
          <TableScroll label="Orders data table">
            <table className="markets-table orders-table">
              <thead>
                <tr>
                  {[
                    "Order / created",
                    "Store / market",
                    "Customer / phone",
                    "Product",
                    "Total",
                    "Order status",
                    "Confirmation / callback",
                    "Agent",
                    "Fulfillment / shipment",
                    "Actions",
                  ].map((h) => (
                    <th key={h}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {result.rows.map(
                  ({
                    order,
                    storeName,
                    productName,
                    confirmation,
                    nextCallbackAt,
                    agentName,
                    fulfillmentStatus,
                    fulfillmentMode,
                    shipmentProvider,
                    shipmentStatus,
                  }) => (
                    <tr key={order.id}>
                      <td>
                        <Link
                          className="text-link"
                          href={`/orders/${order.id}`}
                        >
                          {order.orderNumber}
                        </Link>
                        <div className="muted">
                          {order.createdAt
                            .toISOString()
                            .slice(0, 16)
                            .replace("T", " ")}{" "}
                          UTC
                        </div>
                      </td>
                      <td>
                        {storeName}
                        <div className="muted">{order.marketName}</div>
                      </td>
                      <td>
                        {order.customerName}
                        <div className="muted">{order.phone}</div>
                      </td>
                      <td>
                        {productName}
                        {order.duplicateSignal && (
                          <div className="muted">Possible repeat order</div>
                        )}
                      </td>
                      <td>{formatMoney(order.totalMinor, order.currency)}</td>
                      <td>
                        <StatusBadge status={order.status}>
                          {order.status}
                        </StatusBadge>
                      </td>
                      <td>
                        {confirmation.replaceAll("_", " ")}
                        {nextCallbackAt && (
                          <div className="muted">
                            {new Date(nextCallbackAt).toISOString()} ·{" "}
                            {callbackTiming(new Date(nextCallbackAt))}
                          </div>
                        )}
                      </td>
                      <td>{agentName ?? "Unassigned"}</td>
                      <td>
                        {fulfillmentStatus ?? "Not created"}
                        <div className="muted">
                          {fulfillmentMode === "provider"
                            ? "ShipCOD"
                            : "Manual"}
                        </div>
                        <div className="muted">
                          {shipmentProvider && `${shipmentProvider} · `}
                          {shipmentStatus ?? "No shipment"}
                        </div>
                      </td>
                      <td>
                        <Link
                          className="text-link"
                          href={`/orders/${order.id}`}
                        >
                          Open order
                        </Link>
                        {mode === "confirmation" && order.status === "new" && (
                          <>
                            <OperationForm
                              orderId={order.id}
                              intent="attempt"
                              label="No answer"
                              appearance="secondary"
                            >
                              <input
                                type="hidden"
                                name="outcome"
                                value="no_answer"
                              />
                            </OperationForm>
                            <OperationForm
                              orderId={order.id}
                              intent="attempt"
                              label="Confirm order"
                            >
                              <input
                                type="hidden"
                                name="outcome"
                                value="confirmed"
                              />
                            </OperationForm>
                            <Link
                              href={`/orders/${order.id}#callback`}
                              className="button button-outline button-small"
                            >
                              Callback
                            </Link>
                            <Link
                              href={`/orders/${order.id}#cancel-order`}
                              className="button button-danger button-small"
                            >
                              Cancel
                            </Link>
                          </>
                        )}
                        {mode === "fulfillment" && !fulfillmentStatus && (
                          <OperationForm
                            orderId={order.id}
                            intent="fulfillment"
                            label="Create fulfillment"
                          />
                        )}
                        {mode === "fulfillment" &&
                          fulfillmentMode === "manual" &&
                          ["ready", "processing"].includes(
                            fulfillmentStatus ?? "",
                          ) &&
                          !shipmentStatus && (
                            <OperationForm
                              orderId={order.id}
                              intent="shipment"
                              label="Create manual shipment"
                            />
                          )}
                      </td>
                    </tr>
                  ),
                )}
              </tbody>
            </table>
          </TableScroll>
        ) : (
          <div className="empty-state">
            <h3>
              {mode === "orders"
                ? "No orders match this view."
                : mode === "confirmation"
                  ? "Confirmation queue is clear."
                  : mode === "callbacks"
                    ? "No scheduled callbacks match."
                    : "No fulfillment work matches."}
            </h3>
            <p>
              {mode === "orders"
                ? "Publish your Store and Product Page to receive COD orders, or try different filters."
                : "Try another state or date range. New work will appear here when it is ready."}
            </p>
            <Link
              className="button button-outline"
              href={mode === "orders" ? "/stores" : "/orders"}
            >
              {mode === "orders" ? "View / Publish Store" : "View all orders"}
            </Link>
          </div>
        )}
        <div className="form-actions">
          <span className="pagination-summary">
            {result.total} orders · Page {result.page}
          </span>
          {result.page > 1 && (
            <Link
              className="button button-outline button-small"
              href={pageUrl(result.page - 1)}
            >
              Previous
            </Link>
          )}
          {result.page * result.pageSize < result.total && (
            <Link
              className="button button-outline button-small"
              href={pageUrl(result.page + 1)}
            >
              Next
            </Link>
          )}
        </div>
      </section>
    </>
  );
}
