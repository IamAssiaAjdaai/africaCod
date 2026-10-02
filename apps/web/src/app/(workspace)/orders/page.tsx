import Link from "next/link";
import { PageHeading, Badge } from "@africacod/ui";
import { formatMoney } from "@africacod/shared/money";
import { storefront, requireOrganization } from "@/lib/server";
import { orderFiltersInput } from "@africacod/validation";
export default async function Orders({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
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
  });
  const service = storefront();
  const filter = parsed.success ? parsed.data : orderFiltersInput.parse({});
  const [result, stores] = await Promise.all([
    service.listOrders(session.user.id, filter),
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
    return `/orders?${params}`;
  }
  return (
    <>
      <PageHeading
        eyebrow="COMMERCE"
        title="Orders"
        description="Cash on delivery orders and their original commercial details."
      />
      {!parsed.success && (
        <p role="alert" className="form-error">
          Invalid filters. Showing all orders.
        </p>
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
              <option value="cancelled">Cancelled</option>
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
        </form>
        {result.rows.length ? (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  {[
                    "Order / created",
                    "Store / market",
                    "Customer / phone",
                    "Product",
                    "Total",
                    "Status",
                  ].map((h) => (
                    <th key={h}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {result.rows.map(({ order, storeName, productName }) => (
                  <tr key={order.id}>
                    <td>
                      <Link className="text-link" href={`/orders/${order.id}`}>
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
                      <Badge active={order.status === "new"}>
                        {order.status}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="empty-state">
            <h3>No orders yet.</h3>
            <p>Orders from your published product pages will appear here.</p>
          </div>
        )}
        <div className="form-actions">
          <span>
            {result.total} orders · Page {result.page}
          </span>
          {result.page > 1 && (
            <Link href={pageUrl(result.page - 1)}>Previous</Link>
          )}
          {result.page * result.pageSize < result.total && (
            <Link href={pageUrl(result.page + 1)}>Next</Link>
          )}
        </div>
      </section>
    </>
  );
}
