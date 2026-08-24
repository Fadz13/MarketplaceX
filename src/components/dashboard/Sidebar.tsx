import Link from "next/link";

export default function Sidebar() {
  return (
    <aside className="w-64 bg-slate-900 p-6 text-white">
      <h1 className="mb-8 text-2xl font-bold">
        MarketplaceX
      </h1>

      <nav className="space-y-3">
        <Link
          href="/dashboard"
          className="block hover:text-blue-400"
        >
          Dashboard
        </Link>

        <Link
          href="/dashboard/products"
          className="block hover:text-blue-400"
        >
          Products
        </Link>

        <Link
          href="/dashboard/categories"
          className="block hover:text-blue-400"
        >
          Categories
        </Link>

        <Link
          href="/dashboard/brands"
          className="block hover:text-blue-400"
        >
          Brands
        </Link>

        <Link
          href="/dashboard/orders"
          className="block hover:text-blue-400"
        >
          Orders
        </Link>

        <Link
          href="/dashboard/sellers"
          className="block hover:text-blue-400"
        >
          Sellers
        </Link>
<Link
  href="/dashboard/withdrawals"
  className="block hover:text-blue-400"
>
  Withdrawals
</Link>
        <Link
          href="/dashboard/users"
          className="block hover:text-blue-400"
        >
          Users
        </Link>
      </nav>
    </aside>
  );
}