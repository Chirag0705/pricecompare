import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import { login, clearAuthError } from "../store/authSlice";
import { fieldErrorsFrom } from "../lib/axios";
import { Field } from "../components/ui/Field";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";

export function LoginPage() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const location = useLocation();
  const { token, user, status, error } = useSelector((s) => s.auth);

  const from = location.state?.from?.pathname || "/";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  useEffect(() => {
    if (token && user) navigate(from, { replace: true });
  }, [token, user, navigate, from]);

  useEffect(() => {
    return () => dispatch(clearAuthError());
  }, [dispatch]);

  const fieldErrors = fieldErrorsFrom(error);
  const loading = status === "loading";

  function handleSubmit(e) {
    e.preventDefault();
    dispatch(login({ email: email.trim(), password }));
  }

  return (
    <div className="mx-auto flex max-w-md flex-col px-4 py-12 sm:py-20">
      <div className="mb-8 text-center">
        <h1 className="text-title-1 text-neutral-900">Welcome back</h1>
        <p className="mt-2 text-body-sm text-neutral-600">
          Sign in to access your wishlist and price alerts.
        </p>
      </div>

      <Card className="p-6 sm:p-8">
        {error && !error.details && (
          <div
            role="alert"
            className="mb-6 rounded-md border border-danger-100 bg-danger-50 px-4 py-3 text-body-sm font-medium text-danger-700"
          >
            {error.message}
          </div>
        )}

        <form onSubmit={handleSubmit} noValidate className="space-y-5">
          <Field
            label="Email"
            type="email"
            required
            autoComplete="email"
            inputMode="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            error={fieldErrors.email}
          />
          <Field
            label="Password"
            type="password"
            required
            autoComplete="current-password"
            placeholder="Your password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            error={fieldErrors.password}
          />
          <Button
            type="submit"
            loading={loading}
            disabled={loading}
            className="w-full"
          >
            {loading ? "Signing in…" : "Sign in"}
          </Button>
        </form>
      </Card>

      <p className="mt-6 text-center text-body-sm text-neutral-600">
        Don’t have an account?{" "}
        <Link
          to="/register"
          state={location.state}
          className="font-medium text-primary-600 hover:text-primary-700 hover:underline"
        >
          Create one
        </Link>
      </p>
    </div>
  );
}
