import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useSelector } from "react-redux";
import { Spinner } from "../ui/Spinner";

export function RequireAuth() {
  const { token, user } = useSelector((state) => state.auth);
  const location = useLocation();

  if (!token) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }
  if (!user) {
    return (
      <div
        className="flex min-h-[50vh] items-center justify-center"
        role="status"
        aria-label="Checking session"
      >
        <Spinner size="lg" label="Checking session" />
      </div>
    );
  }
  return <Outlet />;
}

export function RequireAdmin() {
  const { token, user } = useSelector((state) => state.auth);
  const location = useLocation();

  if (!token) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }
  if (!user) {
    return (
      <div
        className="flex min-h-[50vh] items-center justify-center"
        role="status"
        aria-label="Checking session"
      >
        <Spinner size="lg" label="Checking session" />
      </div>
    );
  }
  if (user.role !== "admin") {
    return <Navigate to="/forbidden" replace />;
  }
  return <Outlet />;
}
