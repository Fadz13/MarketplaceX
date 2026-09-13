"use client";

import { useMemo, useState } from "react";

import {
  createPayment,
  markPaymentAsFailed,
  markPaymentAsPaid,
} from "@/lib/actions/payment";

import {
  getOrderDetail,
  updateOrderStatus,
} from "@/lib/actions/order";

import {
  type OrderStatus,
  ALLOWED_TRANSITIONS,
  ORDER_STATUS_COLORS,
} from "@/lib/order-status";

type Order = {
  id: string;
  order_number: string;
  status: OrderStatus;
  payment_status: string;
  subtotal: number;
  shipping_cost: number;
  discount_amount: number;
  platform_fee: number;
  total_amount: number;
  created_at: string;
  completed_at: string | null;
  buyer_id: string;
  item_count: number;
  total_quantity: number;
};

type OrderDetail = Awaited<
  ReturnType<typeof getOrderDetail>
>;

type Props = {
  orders: Order[];
};

const ITEMS_PER_PAGE = 10;

const STATUS_OPTIONS = [
  "all",
  ...Object.keys(ALLOWED_TRANSITIONS),
] as const;

const PAYMENT_METHODS = [
  "bank_transfer",
  "virtual_account",
  "e_wallet",
  "credit_card",
  "debit_card",
  "cod",
  "marketplace_credit",
] as const;

function formatPrice(value: number) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatStatus(status: string) {
  return status
    .replaceAll("_", " ")
    .replace(/\b\w/g, (char) =>
      char.toUpperCase(),
    );
}

function getStatusClass(status: string) {
  return (
    ORDER_STATUS_COLORS[status as OrderStatus] ??
    "bg-gray-100 text-gray-700"
  );
}

function getTransitionButtonClass(
  status: OrderStatus,
) {
  if (
    status === "cancelled" ||
    status === "refunded"
  ) {
    return "border-red-200 text-red-600 hover:bg-red-50";
  }

  if (status === "disputed") {
    return "border-orange-200 text-orange-600 hover:bg-orange-50";
  }

  if (status === "completed") {
    return "border-green-200 text-green-700 hover:bg-green-50";
  }

  return "border-gray-200 text-gray-700 hover:bg-gray-50";
}

export function OrdersClient({
  orders,
}: Props) {
  const [search, setSearch] =
    useState("");

  const [status, setStatus] =
    useState<
      (typeof STATUS_OPTIONS)[number]
    >("all");

  const [page, setPage] =
    useState(1);

  const [
    selectedOrderId,
    setSelectedOrderId,
  ] = useState<string | null>(null);

  const [detail, setDetail] =
    useState<OrderDetail | null>(null);

  const [
    loadingDetail,
    setLoadingDetail,
  ] = useState(false);

  const [
    detailError,
    setDetailError,
  ] = useState("");

  const [
    paymentMethod,
    setPaymentMethod,
  ] = useState<
    (typeof PAYMENT_METHODS)[number]
  >("bank_transfer");

  const [
    paymentChannel,
    setPaymentChannel,
  ] = useState("");

  const [
    transactionId,
    setTransactionId,
  ] = useState("");

  const [
    paymentActionPending,
    setPaymentActionPending,
  ] = useState(false);

  const [
    statusActionPending,
    setStatusActionPending,
  ] = useState(false);

  const [
    statusActionError,
    setStatusActionError,
  ] = useState("");

  const filteredOrders = useMemo(() => {
    const keyword =
      search.trim().toLowerCase();

    return orders.filter((order) => {
      const matchesSearch =
        !keyword ||
        order.order_number
          .toLowerCase()
          .includes(keyword);

      const matchesStatus =
        status === "all" ||
        order.status === status;

      return (
        matchesSearch &&
        matchesStatus
      );
    });
  }, [orders, search, status]);

  const totalPages = Math.max(
    1,
    Math.ceil(
      filteredOrders.length /
        ITEMS_PER_PAGE,
    ),
  );

  const currentPage = Math.min(
    page,
    totalPages,
  );

  const paginatedOrders =
    filteredOrders.slice(
      (currentPage - 1) *
        ITEMS_PER_PAGE,
      currentPage * ITEMS_PER_PAGE,
    );

  const start =
    filteredOrders.length === 0
      ? 0
      : (currentPage - 1) *
          ITEMS_PER_PAGE +
        1;

  const end = Math.min(
    currentPage * ITEMS_PER_PAGE,
    filteredOrders.length,
  );

  function handleSearch(
    value: string,
  ) {
    setSearch(value);
    setPage(1);
  }

  function handleStatus(
    value: (typeof STATUS_OPTIONS)[number],
  ) {
    setStatus(value);
    setPage(1);
  }

  async function handleOpenOrder(
    orderId: string,
  ) {
    setSelectedOrderId(orderId);
    setDetail(null);
    setDetailError("");
    setStatusActionError("");
    setLoadingDetail(true);

    try {
      const data =
        await getOrderDetail(orderId);

      setDetail(data);

      setPaymentMethod(
        "bank_transfer",
      );
      setPaymentChannel("");
      setTransactionId("");
    } catch (error) {
      setDetailError(
        error instanceof Error
          ? error.message
          : "Failed to load order detail.",
      );
    } finally {
      setLoadingDetail(false);
    }
  }

  async function refreshDetail() {
    if (!selectedOrderId) {
      return;
    }

    try {
      const data =
        await getOrderDetail(
          selectedOrderId,
        );

      setDetail(data);
    } catch (error) {
      setDetailError(
        error instanceof Error
          ? error.message
          : "Failed to refresh order detail.",
      );
    }
  }

  function handleCloseDetail() {
    setSelectedOrderId(null);
    setDetail(null);
    setDetailError("");
    setStatusActionError("");
  }

  async function handleCreatePayment() {
    if (!selectedOrderId) {
      return;
    }

    setPaymentActionPending(true);
    setDetailError("");

    try {
      const formData =
        new FormData();

      formData.set(
        "payment_method",
        paymentMethod,
      );

      formData.set(
        "payment_channel",
        paymentChannel,
      );

      formData.set(
        "transaction_id",
        transactionId,
      );

      await createPayment(
        selectedOrderId,
        formData,
      );

      await refreshDetail();
    } catch (error) {
      setDetailError(
        error instanceof Error
          ? error.message
          : "Failed to create payment.",
      );
    } finally {
      setPaymentActionPending(false);
    }
  }

  async function handleMarkPaid(
    paymentId: string,
  ) {
    setPaymentActionPending(true);
    setDetailError("");

    try {
      await markPaymentAsPaid(
        paymentId,
      );

      await refreshDetail();
    } catch (error) {
      setDetailError(
        error instanceof Error
          ? error.message
          : "Failed to mark payment as paid.",
      );
    } finally {
      setPaymentActionPending(false);
    }
  }

  async function handleMarkFailed(
    paymentId: string,
  ) {
    const confirmed =
      window.confirm(
        "Mark this payment as failed?",
      );

    if (!confirmed) {
      return;
    }

    setPaymentActionPending(true);
    setDetailError("");

    try {
      await markPaymentAsFailed(
        paymentId,
      );

      await refreshDetail();
    } catch (error) {
      setDetailError(
        error instanceof Error
          ? error.message
          : "Failed to mark payment as failed.",
      );
    } finally {
      setPaymentActionPending(false);
    }
  }

  async function handleUpdateOrderStatus(
    nextStatus: OrderStatus,
  ) {
    if (!selectedOrderId || !detail) {
      return;
    }

    setStatusActionPending(true);
    setStatusActionError("");

    const dangerousStatus =
      nextStatus === "cancelled" ||
      nextStatus === "refunded";

    if (dangerousStatus) {
      const confirmed =
        window.confirm(
          `Change order status to "${formatStatus(
            nextStatus,
          )}"?`,
        );

      if (!confirmed) {
        setStatusActionPending(false);
        return;
      }
    }

    try {
      await updateOrderStatus(
        selectedOrderId,
        nextStatus,
      );

      await refreshDetail();
    } catch (error) {
      setStatusActionError(
        error instanceof Error
          ? error.message
          : "Failed to update order status.",
      );
    } finally {
      setStatusActionPending(false);
    }
  }

  const availableTransitions =
    detail
      ? ALLOWED_TRANSITIONS[
          detail.order
            .status as OrderStatus
        ] ?? []
      : [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <input
          value={search}
          onChange={(event) =>
            handleSearch(
              event.target.value,
            )
          }
          placeholder="Search order number..."
          className="w-full max-w-md rounded-lg border px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-black"
        />

        <select
          value={status}
          onChange={(event) =>
            handleStatus(
              event.target
                .value as (typeof STATUS_OPTIONS)[number],
            )
          }
          className="rounded-lg border bg-white px-4 py-2 text-sm"
        >
          {STATUS_OPTIONS.map(
            (option) => (
              <option
                key={option}
                value={option}
              >
                {option === "all"
                  ? "All status"
                  : formatStatus(option)}
              </option>
            ),
          )}
        </select>
      </div>

      <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr className="border-b">
                <th className="px-4 py-3 text-left font-medium">
                  Order
                </th>

                <th className="px-4 py-3 text-left font-medium">
                  Status
                </th>

                <th className="px-4 py-3 text-left font-medium">
                  Payment
                </th>

                <th className="px-4 py-3 text-left font-medium">
                  Items
                </th>

                <th className="px-4 py-3 text-left font-medium">
                  Total
                </th>

                <th className="px-4 py-3 text-left font-medium">
                  Created
                </th>
              </tr>
            </thead>

            <tbody>
              {paginatedOrders.length ===
              0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className="py-12 text-center text-sm text-gray-500"
                  >
                    No orders found.
                  </td>
                </tr>
              ) : (
                paginatedOrders.map(
                  (order) => (
                    <tr
                      key={order.id}
                      className="border-b transition-colors hover:bg-gray-50"
                    >
                      <td className="px-4 py-3">
                        <div>
                          <button
                            type="button"
                            onClick={() =>
                              handleOpenOrder(
                                order.id,
                              )
                            }
                            className="font-semibold hover:underline"
                          >
                            {
                              order.order_number
                            }
                          </button>

                          <p className="text-xs text-gray-500">
                            {
                              order.buyer_id
                            }
                          </p>
                        </div>
                      </td>

                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${getStatusClass(
                            order.status,
                          )}`}
                        >
                          {formatStatus(
                            order.status,
                          )}
                        </span>
                      </td>

                      <td className="px-4 py-3">
                        {formatStatus(
                          order.payment_status,
                        )}
                      </td>

                      <td className="px-4 py-3">
                        <div>
                          <p className="font-medium">
                            {
                              order.item_count
                            }{" "}
                            item
                            {order.item_count !==
                            1
                              ? "s"
                              : ""}
                          </p>

                          <p className="text-xs text-gray-500">
                            {
                              order.total_quantity
                            }{" "}
                            qty
                          </p>
                        </div>
                      </td>

                      <td className="px-4 py-3 font-semibold">
                        {formatPrice(
                          order.total_amount,
                        )}
                      </td>

                      <td className="px-4 py-3 text-gray-600">
                        {new Date(
                          order.created_at,
                        ).toLocaleString(
                          "id-ID",
                        )}
                      </td>
                    </tr>
                  ),
                )
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">
          Showing {start}-{end} of{" "}
          {filteredOrders.length} orders
        </p>

        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={currentPage === 1}
            onClick={() =>
              setPage(
                (value) =>
                  value - 1,
              )
            }
            className="rounded-lg border px-3 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-40"
          >
            ← Previous
          </button>

          <div className="flex items-center gap-1">
            {Array.from(
              { length: totalPages },
              (_, index) =>
                index + 1,
            ).map((pageNumber) => (
              <button
                key={pageNumber}
                type="button"
                onClick={() =>
                  setPage(pageNumber)
                }
                className={`h-9 min-w-9 rounded-lg px-3 text-sm ${
                  currentPage ===
                  pageNumber
                    ? "bg-black text-white"
                    : "border hover:bg-gray-100"
                }`}
              >
                {pageNumber}
              </button>
            ))}
          </div>

          <button
            type="button"
            disabled={
              currentPage ===
              totalPages
            }
            onClick={() =>
              setPage(
                (value) =>
                  value + 1,
              )
            }
            className="rounded-lg border px-3 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-40"
          >
            Next →
          </button>
        </div>
      </div>

      {selectedOrderId && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={handleCloseDetail}
        >
          <div
            className="w-full max-w-4xl overflow-hidden rounded-2xl bg-white shadow-2xl"
            onClick={(event) =>
              event.stopPropagation()
            }
          >
            <div className="flex items-center justify-between border-b px-6 py-4">
              <div>
                <h2 className="text-xl font-bold">
                  Order Detail
                </h2>

                {detail?.order
                  .order_number && (
                  <p className="mt-1 text-sm text-gray-500">
                    {
                      detail.order
                        .order_number
                    }
                  </p>
                )}
              </div>

              <button
                type="button"
                onClick={
                  handleCloseDetail
                }
                className="rounded-lg border px-3 py-1.5 text-sm hover:bg-gray-100"
              >
                Close
              </button>
            </div>

            <div className="max-h-[80vh] overflow-y-auto p-6">
              {loadingDetail ? (
                <div className="py-12 text-center text-sm text-gray-500">
                  Loading order...
                </div>
              ) : detailError ? (
                <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {detailError}
                </div>
              ) : detail ? (
                <div className="space-y-6">
                  <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                    <div className="rounded-xl border p-4">
                      <p className="text-xs text-gray-500">
                        Status
                      </p>

                      <p className="mt-1 font-semibold">
                        {formatStatus(
                          detail.order
                            .status,
                        )}
                      </p>
                    </div>

                    <div className="rounded-xl border p-4">
                      <p className="text-xs text-gray-500">
                        Payment
                      </p>

                      <p className="mt-1 font-semibold">
                        {formatStatus(
                          detail.order
                            .payment_status,
                        )}
                      </p>
                    </div>

                    <div className="rounded-xl border p-4">
                      <p className="text-xs text-gray-500">
                        Items
                      </p>

                      <p className="mt-1 font-semibold">
                        {
                          detail.items
                            .length
                        }
                      </p>
                    </div>

                    <div className="rounded-xl border p-4">
                      <p className="text-xs text-gray-500">
                        Total
                      </p>

                      <p className="mt-1 font-semibold">
                        {formatPrice(
                          Number(
                            detail.order
                              .total_amount,
                          ),
                        )}
                      </p>
                    </div>
                  </div>

                  <div className="rounded-xl border p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <h3 className="text-sm font-semibold">
                          Order Status
                        </h3>

                        <p className="mt-1 text-xs text-gray-500">
                          Current status:{" "}
                          <span className="font-medium text-gray-700">
                            {formatStatus(
                              detail.order
                                .status,
                            )}
                          </span>
                        </p>
                      </div>
                    </div>

                    {statusActionError && (
                      <div className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                        {statusActionError}
                      </div>
                    )}

                    {availableTransitions.length ===
                    0 ? (
                      <div className="mt-4 rounded-lg border border-dashed p-4 text-sm text-gray-500">
                        No further status transitions are available.
                      </div>
                    ) : (
                      <div className="mt-4 flex flex-wrap gap-2">
                        {availableTransitions.map(
                          (nextStatus) => (
                            <button
                              key={nextStatus}
                              type="button"
                              onClick={() =>
                                void handleUpdateOrderStatus(
                                  nextStatus,
                                )
                              }
                              disabled={
                                statusActionPending ||
                                paymentActionPending
                              }
                              className={`rounded-lg border px-4 py-2 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-50 ${getTransitionButtonClass(
                                nextStatus,
                              )}`}
                            >
                              {statusActionPending
                                ? "Processing..."
                                : formatStatus(
                                    nextStatus,
                                  )}
                            </button>
                          ),
                        )}
                      </div>
                    )}
                  </div>

                  <div>
                    <h3 className="mb-3 text-sm font-semibold">
                      Order Items
                    </h3>

                    <div className="overflow-hidden rounded-xl border">
                      {detail.items
                        .length ===
                      0 ? (
                        <div className="p-6 text-center text-sm text-gray-500">
                          No order items.
                        </div>
                      ) : (
                        detail.items.map(
                          (item) => (
                            <div
                              key={item.id}
                              className="flex items-center gap-4 border-b p-4 last:border-0"
                            >
                              <div className="h-14 w-14 shrink-0 overflow-hidden rounded-lg border bg-gray-100">
                                {item.product_image_url ? (
                                  <img
                                    src={
                                      item.product_image_url
                                    }
                                    alt={
                                      item.product_name
                                    }
                                    className="h-full w-full object-cover"
                                  />
                                ) : (
                                  <div className="flex h-full w-full items-center justify-center text-[10px] text-gray-400">
                                    No img
                                  </div>
                                )}
                              </div>

                              <div className="min-w-0 flex-1">
                                <p className="font-semibold">
                                  {
                                    item.product_name
                                  }
                                </p>

                                <p className="text-xs text-gray-500">
                                  {
                                    item.variant_label ??
                                    "No variant"
                                  }
                                  {" · "}
                                  {item.sku_code ??
                                    "No SKU"}
                                </p>

                                <p className="mt-1 text-xs text-gray-500">
                                  {
                                    item.quantity
                                  }{" "}
                                  ×{" "}
                                  {formatPrice(
                                    Number(
                                      item.unit_price,
                                    ),
                                  )}
                                </p>
                              </div>

                              <p className="font-semibold">
                                {formatPrice(
                                  Number(
                                    item.subtotal,
                                  ),
                                )}
                              </p>
                            </div>
                          ),
                        )
                      )}
                    </div>
                  </div>

                  <div>
                    <h3 className="mb-3 text-sm font-semibold">
                      Payments
                    </h3>

                    {detail.payments.length ===
                    0 ? (
                      <div className="space-y-4">
                        <div className="rounded-xl border border-dashed p-6">
                          <p className="mb-4 text-sm font-medium">
                            No payment record yet.
                          </p>

                          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                            <div>
                              <label className="mb-1 block text-xs font-medium">
                                Payment Method
                              </label>

                              <select
                                value={
                                  paymentMethod
                                }
                                onChange={(
                                  event,
                                ) =>
                                  setPaymentMethod(
                                    event
                                      .target
                                      .value as (typeof PAYMENT_METHODS)[number],
                                  )
                                }
                                disabled={
                                  paymentActionPending
                                }
                                className="w-full rounded-lg border bg-white px-3 py-2 text-sm"
                              >
                                {PAYMENT_METHODS.map(
                                  (method) => (
                                    <option
                                      key={
                                        method
                                      }
                                      value={
                                        method
                                      }
                                    >
                                      {formatStatus(
                                        method,
                                      )}
                                    </option>
                                  ),
                                )}
                              </select>
                            </div>

                            <div>
                              <label className="mb-1 block text-xs font-medium">
                                Channel
                              </label>

                              <input
                                value={
                                  paymentChannel
                                }
                                onChange={(
                                  event,
                                ) =>
                                  setPaymentChannel(
                                    event
                                      .target
                                      .value,
                                  )
                                }
                                placeholder="Example: BCA"
                                disabled={
                                  paymentActionPending
                                }
                                className="w-full rounded-lg border px-3 py-2 text-sm"
                              />
                            </div>

                            <div>
                              <label className="mb-1 block text-xs font-medium">
                                Transaction ID
                              </label>

                              <input
                                value={
                                  transactionId
                                }
                                onChange={(
                                  event,
                                ) =>
                                  setTransactionId(
                                    event
                                      .target
                                      .value,
                                  )
                                }
                                placeholder="Optional"
                                disabled={
                                  paymentActionPending
                                }
                                className="w-full rounded-lg border px-3 py-2 text-sm"
                              />
                            </div>
                          </div>

                          <button
                            type="button"
                            onClick={
                              handleCreatePayment
                            }
                            disabled={
                              paymentActionPending
                            }
                            className="mt-4 rounded-lg bg-black px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800 disabled:opacity-50"
                          >
                            {paymentActionPending
                              ? "Creating..."
                              : "Create Payment"}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {detail.payments.map(
                          (payment) => (
                            <div
                              key={
                                payment.id
                              }
                              className="rounded-xl border p-4"
                            >
                              <div className="flex items-center justify-between gap-4">
                                <div>
                                  <p className="font-semibold">
                                    {formatStatus(
                                      payment.status,
                                    )}
                                  </p>

                                  <p className="mt-1 text-sm text-gray-500">
                                    {formatStatus(
                                      payment.payment_method,
                                    )}
                                    {payment.payment_channel
                                      ? ` · ${payment.payment_channel}`
                                      : ""}
                                  </p>
                                </div>

                                <p className="font-semibold">
                                  {formatPrice(
                                    Number(
                                      payment.amount,
                                    ),
                                  )}
                                </p>
                              </div>

                              {payment.transaction_id && (
                                <p className="mt-2 text-xs text-gray-500">
                                  Transaction:{" "}
                                  {
                                    payment.transaction_id
                                  }
                                </p>
                              )}

                              {payment.paid_at && (
                                <p className="mt-1 text-xs text-gray-500">
                                  Paid at:{" "}
                                  {new Date(
                                    payment.paid_at,
                                  ).toLocaleString(
                                    "id-ID",
                                  )}
                                </p>
                              )}

                              {payment.status ===
                                "pending" && (
                                <div className="mt-4 flex gap-2">
                                  <button
                                    type="button"
                                    onClick={() =>
                                      void handleMarkPaid(
                                        payment.id,
                                      )
                                    }
                                    disabled={
                                      paymentActionPending ||
                                      statusActionPending
                                    }
                                    className="rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
                                  >
                                    Mark as Paid
                                  </button>

                                  <button
                                    type="button"
                                    onClick={() =>
                                      void handleMarkFailed(
                                        payment.id,
                                      )
                                    }
                                    disabled={
                                      paymentActionPending ||
                                      statusActionPending
                                    }
                                    className="rounded-lg border px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
                                  >
                                    Mark as Failed
                                  </button>
                                </div>
                              )}
                            </div>
                          ),
                        )}
                      </div>
                    )}

                    {detail.paymentLogs.length >
                      0 && (
                      <div className="mt-4 rounded-xl bg-gray-50 p-4">
                        <h4 className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-500">
                          Payment History
                        </h4>

                        <div className="space-y-2">
                          {detail.paymentLogs.map(
                            (log) => (
                              <div
                                key={
                                  log.id
                                }
                                className="flex items-center justify-between gap-4 text-sm"
                              >
                                <span>
                                  {formatStatus(
                                    log.event,
                                  )}
                                </span>

                                <span className="text-xs text-gray-500">
                                  {new Date(
                                    log.created_at,
                                  ).toLocaleString(
                                    "id-ID",
                                  )}
                                </span>
                              </div>
                            ),
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="rounded-xl bg-gray-50 p-5">
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span>
                          Subtotal
                        </span>

                        <span>
                          {formatPrice(
                            Number(
                              detail.order
                                .subtotal,
                            ),
                          )}
                        </span>
                      </div>

                      <div className="flex justify-between">
                        <span>
                          Shipping
                        </span>

                        <span>
                          {formatPrice(
                            Number(
                              detail.order
                                .shipping_cost,
                            ),
                          )}
                        </span>
                      </div>

                      <div className="flex justify-between">
                        <span>
                          Discount
                        </span>

                        <span>
                          -
                          {formatPrice(
                            Number(
                              detail.order
                                .discount_amount,
                            ),
                          )}
                        </span>
                      </div>

                      <div className="flex justify-between">
                        <span>
                          Platform Fee
                        </span>

                        <span>
                          {formatPrice(
                            Number(
                              detail.order
                                .platform_fee,
                            ),
                          )}
                        </span>
                      </div>

                      <div className="flex justify-between border-t pt-3 text-base font-bold">
                        <span>
                          Total
                        </span>

                        <span>
                          {formatPrice(
                            Number(
                              detail.order
                                .total_amount,
                            ),
                          )}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}