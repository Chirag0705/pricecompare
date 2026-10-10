import { Link } from "react-router-dom";

export function NotFoundPage() {
  return (
    <div className="mx-auto flex max-w-6xl flex-col items-center justify-center px-4 py-24 text-center">
      <p className="text-caption font-semibold uppercase tracking-widest text-primary-600">
        404
      </p>
      <h1 className="mt-2 text-title-1 text-neutral-900">Page not found</h1>
      <p className="mt-2 max-w-sm text-body text-neutral-600">
        The page you are looking for doesn’t exist or may have moved.
      </p>
      <Link
        to="/"
        className="mt-8 inline-flex min-h-[44px] items-center rounded-md bg-primary-500 px-6 text-body-sm font-medium text-white transition-colors hover:bg-primary-600 active:bg-primary-700"
      >
        Go home
      </Link>
    </div>
  );
}
