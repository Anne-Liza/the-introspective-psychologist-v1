import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { DataState } from "../../../components/data/DataState";
import { Button } from "../../../components/ui/Button";
import {
  deleteCommerceOrder,
  fetchCommerceItems,
  fetchCommerceOrders,
  updateCommerceOrder,
} from "../lib/commerceCoreApi";

export function CommerceCorePage() {
  const queryClient = useQueryClient();

  const itemsQuery = useQuery({
    queryKey: ["commerce-items"],
    queryFn: fetchCommerceItems,
  });

  const ordersQuery = useQuery({
    queryKey: ["commerce-orders"],
    queryFn: fetchCommerceOrders,
  });

  const updateOrderMutation = useMutation({
    mutationFn: updateCommerceOrder,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["commerce-orders"] });
    },
  });

  const deleteOrderMutation = useMutation({
    mutationFn: deleteCommerceOrder,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["commerce-orders"] });
    },
  });

  const itemState = itemsQuery.isLoading || itemsQuery.isError || !itemsQuery.data?.length;
  const orderState = ordersQuery.isLoading || ordersQuery.isError || !ordersQuery.data?.length;

  return (
    <div className="space-y-10">
      <div>
        <p className="text-sm font-medium text-slate-500">Store management</p>
        <h2 className="text-3xl font-bold">Products and Orders</h2>
        <p className="mt-2 text-slate-600">
          Manage products, session packages, resources, orders, pricing, and publishing status.
        </p>
      </div>

      <section className="space-y-4">
        <div>
          <h3 className="text-xl font-semibold">Catalog items</h3>
          <p className="text-sm text-slate-500">
            Products, books, service packages, digital items, physical items, and custom items.
          </p>
        </div>

        {itemState ? (
          <DataState isLoading={itemsQuery.isLoading} isError={itemsQuery.isError} empty={!itemsQuery.data?.length} />
        ) : (
          <div className="overflow-hidden rounded-2xl border bg-white shadow-sm">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-slate-600">
                <tr>
                  <th className="p-4">Item</th>
                  <th className="p-4">Type</th>
                  <th className="p-4">Price</th>
                  <th className="p-4">Published</th>
                </tr>
              </thead>
              <tbody>
                {itemsQuery.data?.map((item) => (
                  <tr className="border-t" key={item.id}>
                    <td className="p-4">
                      <div className="font-medium">{item.name}</div>
                      <div className="text-slate-500">{item.slug}</div>
                    </td>
                    <td className="p-4">{item.item_type}</td>
                    <td className="p-4">
                      {item.currency} {item.price_amount}
                    </td>
                    <td className="p-4">{item.is_published ? "Yes" : "No"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="space-y-4">
        <div>
          <h3 className="text-xl font-semibold">Orders</h3>
          <p className="text-sm text-slate-500">
            Pending-payment and admin-created orders. Payment attempts, receipts, and refunds belong to later modules.
          </p>
        </div>

        {orderState ? (
          <DataState isLoading={ordersQuery.isLoading} isError={ordersQuery.isError} empty={!ordersQuery.data?.length} />
        ) : (
          <div className="overflow-hidden rounded-2xl border bg-white shadow-sm">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-slate-600">
                <tr>
                  <th className="p-4">Order</th>
                  <th className="p-4">Customer</th>
                  <th className="p-4">Total</th>
                  <th className="p-4">Status</th>
                  <th className="p-4">Items</th>
                  <th className="p-4">Actions</th>
                </tr>
              </thead>
              <tbody>
                {ordersQuery.data?.map((order) => (
                  <tr className="border-t align-top" key={order.id}>
                    <td className="p-4">
                      <div className="font-medium">{order.order_number}</div>
                      <div className="text-slate-500">{order.source}</div>
                    </td>
                    <td className="p-4">
                      <div>{order.customer_name}</div>
                      <div className="text-slate-500">{order.customer_email}</div>
                    </td>
                    <td className="p-4">
                      {order.currency} {order.total_amount}
                    </td>
                    <td className="p-4">
                      <div>{order.status}</div>
                      <div className="text-slate-500">{order.fulfillment_status}</div>
                    </td>
                    <td className="p-4">
                      {order.items.map((item) => (
                        <div key={item.id}>
                          {item.quantity} × {item.item_name}
                        </div>
                      ))}
                    </td>
                    <td className="p-4">
                      <div className="flex flex-wrap gap-2">
                        <Button
                          type="button"
                          onClick={() =>
                            updateOrderMutation.mutate({
                              id: order.id,
                              data: { status: "paid" },
                            })
                          }
                          disabled={updateOrderMutation.isPending || order.status === "paid"}
                        >
                          Mark paid
                        </Button>
                        <Button
                          type="button"
                          onClick={() =>
                            updateOrderMutation.mutate({
                              id: order.id,
                              data: { fulfillment_status: "fulfilled" },
                            })
                          }
                          disabled={updateOrderMutation.isPending || order.fulfillment_status === "fulfilled"}
                        >
                          Fulfilled
                        </Button>
                        <Button
                          type="button"
                          onClick={() => deleteOrderMutation.mutate(order.id)}
                          disabled={deleteOrderMutation.isPending}
                        >
                          Delete
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
