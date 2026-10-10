import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import { register, clearAuthError } from "../store/authSlice";
import { fieldErrorsFrom } from "../lib/axios";
import { Field } from "../components/ui/Field";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";

export function RegisterPage() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const location = useLocation();
  const { token, user, status, error } = useSelector((s) => s.auth);

  const from = location.state?.from?.pathname || "/";

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [confirmError, setConfirmError] = useState(null);

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
    if (password !== confirm) {
      setConfirmError("Passwords do not match");
      return;
    }
    setConfirmError(null);
    dispatch(register({ name: name.trim(), email: email.trim(), password }));
  }

  return (
    <div className="mx-auto flex max-w-md flex-col px-4 py-12 sm:py-20">
      <div className="mb-8 text-center">
        <h1 className="text-title-1 text-neutral-900">Create your account</h1>
        <p className="mt-2 text-body-sm text-neutral-600">
          Save products, track prices, and never overpay.
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
            label="Name"
            required
            autoComplete="name"
            placeholder="Your full name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            error={fieldErrors.name}
          />
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
            autoComplete="new-password"
            placeholder="At least 8 characters"
            hint="At least 8 characters, with a letter and a number."
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            error={fieldErrors.password}
          />
          <Field
            label="Confirm password"
            type="password"
            required
            autoComplete="new-password"
            placeholder="Re-enter your password"
            value={confirm}
            onChange={(e) => {
              setConfirm(e.target.value);
              if (confirmError) setConfirmError(null);
            }}
            error={confirmError}
          />
          <Button
            type="submit"
            loading={loading}
            disabled={loading}
            className="w-full"
          >
            {loading ? "Creating account…" : "Create account"}
          </Button>
        </form>
      </Card>

      <p className="mt-6 text-center text-body-sm text-neutral-600">
        Already have an account?{" "}
        <Link
          to="/login"
          state={location.state}
          className="font-medium text-primary-600 hover:text-primary-700 hover:underline"
        >
          Sign in
        </Link>
      </p>
    </div>
  );
}
