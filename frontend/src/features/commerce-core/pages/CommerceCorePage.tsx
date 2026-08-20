import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { DataState } from "../../../components/data/DataState";
import { Button } from "../../../components/ui/Button";
import {
  createCommerceItem,
  deleteCommerceItem,
  deleteCommerceOrder,
  fetchCommerceItems,
  fetchCommerceOrders,
  updateCommerceItem,
  updateCommerceOrder,
} from "../lib/commerceCoreApi";

export function CommerceCorePage() {
  const queryClient = useQueryClient();

  const [showProductForm, setShowProductForm] = useState(false);
  const [editingProductId, setEditingProductId] = useState<string | null>(null);
  const [productName, setProductName] = useState("");
  const [productSlug, setProductSlug] = useState("");
  const [productPrice, setProductPrice] = useState("1");
  const [productType, setProductType] = useState("product");
  const [productStock, setProductStock] = useState("");
  const [productImageUrl, setProductImageUrl] = useState("");
  const [productPublished, setProductPublished] = useState(true);

  const itemsQuery = useQuery({
    queryKey: ["commerce-items"],
    queryFn: fetchCommerceItems,
  });

  const ordersQuery = useQuery({
    queryKey: ["commerce-orders"],
    queryFn: fetchCommerceOrders,
  });

  const createProductMutation = useMutation({
    mutationFn: createCommerceItem,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["commerce-items"] });
      setProductName("");
      setProductSlug("");
      setProductPrice("1");
      setProductType("product");
      setProductStock("");
      setProductImageUrl("");
      setProductPublished(true);
      setShowProductForm(false);
    },
  });

  const updateProductMutation = useMutation({
    mutationFn: updateCommerceItem,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["commerce-items"] });
      setEditingProductId(null);
      setShowProductForm(false);
      setProductName("");
      setProductSlug("");
      setProductPrice("1");
      setProductType("product");
      setProductStock("");
      setProductImageUrl("");
      setProductPublished(true);
    },
  });

  const deleteProductMutation = useMutation({
    mutationFn: deleteCommerceItem,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["commerce-items"] });
    },
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
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h3 className="text-xl font-semibold">Catalog items</h3>
            <p className="text-sm text-slate-500">
              Products, books, service packages, digital items, physical items, and custom items.
            </p>
          </div>

          <Button
            type="button"
            onClick={() => {
              if (showProductForm) {
                setShowProductForm(false);
                setEditingProductId(null);
              } else {
                setEditingProductId(null);
                setProductName("");
                setProductSlug("");
                setProductPrice("1");
                setProductType("product");
                setProductStock("");
                setProductImageUrl("");
                setProductPublished(true);
                setShowProductForm(true);
              }
            }}
          >
            {showProductForm ? "Cancel" : "+ Add product"}
          </Button>
        </div>

        {showProductForm ? (
          <form
            className="grid gap-4 rounded-2xl border bg-white p-6 shadow-sm md:grid-cols-2"
            onSubmit={(event) => {
              event.preventDefault();

              const data = {
                name: productName,
                slug: productSlug,
                item_type: productType,
                price_amount: productPrice,
                currency: "KES",
                stock_quantity: productStock.trim()
                  ? Number(productStock)
                  : null,
                image_url: productImageUrl.trim() || null,
                is_published: productPublished,
              };

              if (editingProductId) {
                updateProductMutation.mutate({
                  id: editingProductId,
                  data,
                });
              } else {
                createProductMutation.mutate(data);
              }
            }}
          >
            <label className="text-sm font-medium">
              Product name
              <input
                required
                value={productName}
                onChange={(event) => setProductName(event.target.value)}
                className="mt-1 w-full rounded-xl border p-3"
              />
            </label>

            <label className="text-sm font-medium">
              Slug
              <input
                required
                value={productSlug}
                onChange={(event) => setProductSlug(event.target.value)}
                placeholder="mpesa-sandbox-test"
                className="mt-1 w-full rounded-xl border p-3"
              />
            </label>

            <label className="text-sm font-medium">
              Price (KES)
              <input
                required
                min="0"
                step="1"
                type="number"
                value={productPrice}
                onChange={(event) => setProductPrice(event.target.value)}
                className="mt-1 w-full rounded-xl border p-3"
              />
            </label>

            <label className="text-sm font-medium">
              Product type
              <select
                value={productType}
                onChange={(event) => setProductType(event.target.value)}
                className="mt-1 w-full rounded-xl border p-3"
              >
                <option value="product">Product</option>
                <option value="physical">Physical</option>
                <option value="digital">Digital</option>
                <option value="package">Package</option>
                <option value="service">Service</option>
                <option value="custom">Custom</option>
              </select>
            </label>

            <label className="text-sm font-medium">
              Stock quantity
              <input
                min="0"
                type="number"
                value={productStock}
                onChange={(event) => setProductStock(event.target.value)}
                className="mt-1 w-full rounded-xl border p-3"
              />
            </label>

            <label className="text-sm font-medium">
              Image URL
              <input
                value={productImageUrl}
                onChange={(event) => setProductImageUrl(event.target.value)}
                className="mt-1 w-full rounded-xl border p-3"
              />
            </label>

            <label className="flex items-center gap-2 text-sm font-medium">
              <input
                type="checkbox"
                checked={productPublished}
                onChange={(event) => setProductPublished(event.target.checked)}
              />
              Publish immediately
            </label>

            <div className="md:col-span-2">
              <Button
                type="submit"
                disabled={createProductMutation.isPending}
              >
                {createProductMutation.isPending || updateProductMutation.isPending
                  ? "Saving…"
                  : editingProductId
                    ? "Save changes"
                    : "Create product"}
              </Button>
            </div>
          </form>
        ) : null}

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
                  <th className="p-4">Actions</th>
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
                    <td className="p-4">
                      <div className="flex flex-wrap gap-2">
                        <Button
                          type="button"
                          onClick={() => {
                            setEditingProductId(item.id);
                            setProductName(item.name);
                            setProductSlug(item.slug);
                            setProductPrice(item.price_amount);
                            setProductType(item.item_type);
                            setProductStock(
                              item.stock_quantity === null
                                ? ""
                                : String(item.stock_quantity),
                            );
                            setProductImageUrl(item.image_url || "");
                            setProductPublished(item.is_published);
                            setShowProductForm(true);
                          }}
                        >
                          Edit
                        </Button>

                        <Button
                          type="button"
                          onClick={() =>
                            updateProductMutation.mutate({
                              id: item.id,
                              data: {
                                is_published: !item.is_published,
                              },
                            })
                          }
                          disabled={updateProductMutation.isPending}
                        >
                          {item.is_published ? "Unpublish" : "Publish"}
                        </Button>

                        <Button
                          type="button"
                          onClick={() =>
                            deleteProductMutation.mutate(item.id)
                          }
                          disabled={deleteProductMutation.isPending}
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
                          disabled={
                            updateOrderMutation.isPending ||
                            order.status !== "paid" ||
                            order.fulfillment_status === "fulfilled"
                          }
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
