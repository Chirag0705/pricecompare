import { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import {
  updateProfile,
  changePassword,
  clearProfileFeedback,
  clearPasswordFeedback,
} from "../store/authSlice";
import { fieldErrorsFrom } from "../lib/axios";
import { Field } from "../components/ui/Field";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { Badge } from "../components/ui/Badge";

export function ProfilePage() {
  const dispatch = useDispatch();
  const { user, profileStatus, profileError, passwordStatus, passwordError } =
    useSelector((s) => s.auth);

  const [name, setName] = useState(user?.name ?? "");
  const [email, setEmail] = useState(user?.email ?? "");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNew, setConfirmNew] = useState("");
  const [confirmError, setConfirmError] = useState(null);

  useEffect(() => {
    if (user) {
      setName(user.name);
      setEmail(user.email);
    }
  }, [user]);

  useEffect(() => {
    return () => {
      dispatch(clearProfileFeedback());
      dispatch(clearPasswordFeedback());
    };
  }, [dispatch]);

  const profileErrors = fieldErrorsFrom(profileError);
  const passwordErrors = fieldErrorsFrom(passwordError);
  const profileLoading = profileStatus === "loading";
  const passwordLoading = passwordStatus === "loading";

  function handleProfileSubmit(e) {
    e.preventDefault();
    dispatch(updateProfile({ name: name.trim(), email: email.trim() }));
  }

  function handlePasswordSubmit(e) {
    e.preventDefault();
    if (newPassword !== confirmNew) {
      setConfirmError("Passwords do not match");
      return;
    }
    setConfirmError(null);
    dispatch(
      changePassword({ currentPassword, newPassword })
    ).then((action) => {
      if (changePassword.fulfilled.match(action)) {
        setCurrentPassword("");
        setNewPassword("");
        setConfirmNew("");
      }
    });
  }

  if (!user) return null;

  return (
    <div className="mx-auto max-w-2xl px-4 py-12 sm:px-6 sm:py-16">
      <div className="mb-8">
        <h1 className="text-title-1 text-neutral-900">Profile</h1>
        <p className="mt-1 text-body-sm text-neutral-600">
          Manage your account details and password.
        </p>
      </div>

      <div className="space-y-6">
        <Card className="p-6 sm:p-8">
          <div className="mb-6 flex items-center justify-between gap-3">
            <h2 className="text-title-3 text-neutral-900">Account details</h2>
            <Badge tone={user.role === "admin" ? "primary" : "neutral"}>
              {user.role === "admin" ? "Administrator" : "Member"}
            </Badge>
          </div>

          <div aria-live="polite">
            {profileStatus === "succeeded" && (
              <p className="mb-5 rounded-md border border-success-100 bg-success-50 px-4 py-3 text-body-sm font-medium text-success-700">
                Profile updated successfully.
              </p>
            )}
            {profileStatus === "failed" && profileError && (
              <p
                role="alert"
                className="mb-5 rounded-md border border-danger-100 bg-danger-50 px-4 py-3 text-body-sm font-medium text-danger-700"
              >
                {profileError.message}
              </p>
            )}
          </div>

          <form onSubmit={handleProfileSubmit} noValidate className="space-y-5">
            <Field
              label="Name"
              required
              autoComplete="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              error={profileErrors.name}
            />
            <Field
              label="Email"
              type="email"
              required
              autoComplete="email"
              inputMode="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              error={profileErrors.email}
            />
            <div className="flex justify-end">
              <Button type="submit" loading={profileLoading}>
                Save changes
              </Button>
            </div>
          </form>
        </Card>

        <Card className="p-6 sm:p-8">
          <h2 className="mb-6 text-title-3 text-neutral-900">
            Change password
          </h2>

          <div aria-live="polite">
            {passwordStatus === "succeeded" && (
              <p className="mb-5 rounded-md border border-success-100 bg-success-50 px-4 py-3 text-body-sm font-medium text-success-700">
                Password updated. Other sessions have been signed out.
              </p>
            )}
            {passwordStatus === "failed" && passwordError && (
              <p
                role="alert"
                className="mb-5 rounded-md border border-danger-100 bg-danger-50 px-4 py-3 text-body-sm font-medium text-danger-700"
              >
                {passwordError.message}
              </p>
            )}
          </div>

          <form
            onSubmit={handlePasswordSubmit}
            noValidate
            className="space-y-5"
          >
            <Field
              label="Current password"
              type="password"
              required
              autoComplete="current-password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              error={passwordErrors.currentPassword}
            />
            <Field
              label="New password"
              type="password"
              required
              autoComplete="new-password"
              placeholder="At least 8 characters"
              hint="At least 8 characters, with a letter and a number."
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              error={passwordErrors.newPassword}
            />
            <Field
              label="Confirm new password"
              type="password"
              required
              autoComplete="new-password"
              value={confirmNew}
              onChange={(e) => {
                setConfirmNew(e.target.value);
                if (confirmError) setConfirmError(null);
              }}
              error={confirmError}
            />
            <div className="flex justify-end">
              <Button type="submit" loading={passwordLoading}>
                Update password
              </Button>
            </div>
          </form>
        </Card>
      </div>
    </div>
  );
}
