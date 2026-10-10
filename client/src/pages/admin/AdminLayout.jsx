import { NavLink, Outlet, Link } from "react-router-dom";

const sections = [
  { to: "/admin", label: "Dashboard", end: true },
  { to: "/admin/products", label: "Products" },
  { to: "/admin/listings", label: "Listings" },
  { to: "/admin/stores", label: "Stores" },
  { to: "/admin/categories", label: "Categories" },
  { to: "/admin/users", label: "Users" },
  { to: "/admin/prices", label: "Prices" },
  { to: "/admin/matching", label: "Matching" },
  { to: "/admin/jobs", label: "Jobs" },
  { to: "/admin/activity", label: "Activity" },
];

function navClass({ isActive }) {
  return [
    "inline-flex min-h-[44px] items-center rounded-md px-3 text-body-sm font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-500",
    isActive
      ? "bg-primary-50 text-primary-700"
      : "text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900",
  ].join(" ");
}

export function AdminLayout() {
  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
      <div className="flex flex-col gap-6 lg:flex-row lg:gap-8">
        <aside className="lg:w-52 lg:shrink-0">
          <div className="mb-3 flex items-center justify-between">
            <h1 className="text-title-3 font-semibold text-neutral-900">Admin</h1>
            <Link
              to="/"
              className="text-caption font-medium text-primary-600 hover:text-primary-700"
            >
              View site
            </Link>
          </div>
          <nav
            aria-label="Admin sections"
            className="-mx-1 flex gap-1 overflow-x-auto px-1 pb-2 lg:mx-0 lg:flex-col lg:overflow-visible lg:px-0 lg:pb-0"
          >
            {sections.map((s) => (
              <NavLink key={s.to} to={s.to} end={s.end} className={navClass}>
                {s.label}
              </NavLink>
            ))}
          </nav>
        </aside>
        <main className="min-w-0 flex-1">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
