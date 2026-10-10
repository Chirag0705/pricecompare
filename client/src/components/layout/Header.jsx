import { useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import { logout } from "../../store/authSlice";
import { NotificationBell } from "./NotificationBell";
import { SearchAutocomplete } from "../search/SearchAutocomplete";

export function Header() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const location = useLocation();
  const { user, token } = useSelector((s) => s.auth);
  const isAuthed = Boolean(token && user);

  const initialQuery = new URLSearchParams(location.search).get("q") || "";
  const [query, setQuery] = useState(initialQuery);

  function handleLogout() {
    dispatch(logout()).then(() => navigate("/"));
  }

  function handleSearch(event) {
    event.preventDefault();
    const q = query.trim();
    navigate(q ? `/search?q=${encodeURIComponent(q)}` : "/search");
  }

  return (
    <header className="sticky top-0 z-40 border-b border-neutral-200 bg-white/80 backdrop-blur-lg backdrop-saturate-150">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-3 px-4 sm:px-6">
        <Link
          to="/"
          className="flex shrink-0 items-center gap-2 rounded-md px-1 py-1"
          aria-label="PriceCompare home"
        >
          <span
            className="flex h-8 w-8 items-center justify-center rounded-md bg-primary-500 text-white"
            aria-hidden="true"
          >
            <svg
              className="h-5 w-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          </span>
          <span className="hidden text-title-3 font-bold tracking-tight text-neutral-900 sm:inline">
            PriceCompare
          </span>
          <span className="sr-only sm:hidden">PriceCompare home</span>
        </Link>

        <form
          role="search"
          aria-label="Product search"
          onSubmit={handleSearch}
          className="hidden max-w-sm flex-1 sm:block"
        >
          <SearchAutocomplete
            id="header-search"
            value={query}
            onChange={setQuery}
            onSubmit={handleSearch}
            inputClassName="h-10"
          />
        </form>

        <nav
          aria-label="Main navigation"
          className="flex items-center gap-1 sm:gap-2"
        >
          {isAuthed ? (
            <>
              <Link
                to="/wishlist"
                className="inline-flex min-h-[44px] items-center rounded-md px-2 text-body-sm font-medium text-neutral-700 transition-colors hover:bg-neutral-100 hover:text-neutral-900 sm:px-3"
              >
                <span className="sm:hidden">Saved</span>
                <span className="hidden sm:inline">Wishlist</span>
              </Link>
              <Link
                to="/alerts"
                className="inline-flex min-h-[44px] items-center rounded-md px-2 text-body-sm font-medium text-neutral-700 transition-colors hover:bg-neutral-100 hover:text-neutral-900 sm:px-3"
              >
                Alerts
              </Link>
              <NotificationBell />
              <Link
                to="/profile"
                className="inline-flex min-h-[44px] items-center rounded-md px-2 text-body-sm font-medium text-neutral-700 transition-colors hover:bg-neutral-100 hover:text-neutral-900 sm:px-3"
              >
                <span className="max-w-[72px] truncate sm:max-w-[120px]">
                  {user.name}
                </span>
              </Link>
              <button
                type="button"
                onClick={handleLogout}
                className="inline-flex min-h-[44px] items-center rounded-md border border-neutral-300 bg-white px-3 text-body-sm font-medium text-neutral-900 transition-colors hover:bg-neutral-100 active:bg-neutral-200 sm:px-3.5"
              >
                Sign out
              </button>
            </>
          ) : (
            <>
              <Link
                to="/login"
                className="inline-flex min-h-[44px] items-center rounded-md px-3 text-body-sm font-medium text-neutral-700 transition-colors hover:bg-neutral-100 hover:text-neutral-900"
              >
                Sign in
              </Link>
              <Link
                to="/register"
                className="inline-flex min-h-[44px] items-center rounded-md bg-primary-500 px-3.5 text-body-sm font-medium text-white transition-colors hover:bg-primary-600 active:bg-primary-700"
              >
                Create account
              </Link>
            </>
          )}
        </nav>
      </div>

      <div className="border-t border-neutral-100 px-4 py-2 sm:hidden">
        <form
          role="search"
          aria-label="Product search (mobile)"
          onSubmit={handleSearch}
        >
          <SearchAutocomplete
            id="header-search-mobile"
            value={query}
            onChange={setQuery}
            onSubmit={handleSearch}
          />
        </form>
      </div>
    </header>
  );
}
