import { OrdersView } from "@/components/orders-view";
export default function Queue(props: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return <OrdersView {...props} mode="callbacks" />;
}
