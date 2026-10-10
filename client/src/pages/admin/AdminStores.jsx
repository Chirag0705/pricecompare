import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import {
  fetchAdminStores,
  createAdminStore,
  updateAdminStore,
  deleteAdminStore,
  clearAdminAction,
} from "../../store/adminSlice";
import { fieldErrorsFrom } from "../../lib/axios";
import { Skeleton } from "../../components/ui/Skeleton";
import { ErrorState } from "../../components/ui/ErrorState";
import { EmptyState } from "../../components/ui/EmptyState";
import {
  ActionBanner,
  ConfirmButton,
  StatusPill,
  inputClass,
  labelClass,
} from "../../components/admin/adminUI";

const emptyForm = {
  name: "",
  slug: "",
  domain: "",
  active: true,
  sortOrder: "0",
  paramStyle: "query",
  template: "",
};

function StoreForm({ initial, onSubmit, busy, onCancel }) {
  const [form, setForm] = useState(initial);
  const { action } = useSelector((s) => s.admin);
  const fieldErrors = fieldErrorsFrom(action.error);
  const set = (k) => (e) =>
    setForm((f) => ({ ...f, [k]: e.target.type === "checkbox" ? e.target.checked : e.target.value }));

  function submit(e) {
    e.preventDefault();
    const body = {
      name: form.name.trim(),
      slug: form.slug.trim(),
      domain: form.domain.trim(),
      active: form.active,
      sortOrder: Number(form.sortOrder) || 0,
      affiliateConfig: {
        paramStyle: form.paramStyle,
        template: form.template.trim(),
      },
    };
    onSubmit(body);
  }

  return (
    <form onSubmit={submit} className="grid gap-3 sm:grid-cols-2" aria-label="Store form">
      <div>
        <label htmlFor={`sf-name-${form.slug || "new"}`} className={labelClass}>
          Name <span className="text-danger-600" aria-hidden="true">*</span>
        </label>
        <input id={`sf-name-${form.slug || "new"}`} required value={form.name} onChange={set("name")} className={inputClass} />
        {fieldErrors.name && <p role="alert" className="mt-1 text-caption font-medium text-danger-700">{fieldErrors.name}</p>}
      </div>
      <div>
        <label htmlFor={`sf-slug-${form.slug || "new"}`} className={labelClass}>
          Slug <span className="text-danger-600" aria-hidden="true">*</span>
        </label>
        <input
          id={`sf-slug-${form.slug || "new"}`}
          required
          pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
          value={form.slug}
          onChange={set("slug")}
          className={inputClass}
          disabled={Boolean(initial.editing)}
        />
        {fieldErrors.slug && <p role="alert" className="mt-1 text-caption font-medium text-danger-700">{fieldErrors.slug}</p>}
      </div>
      <div className="sm:col-span-2">
        <label htmlFor={`sf-domain-${form.slug || "new"}`} className={labelClass}>
          Domain <span className="text-danger-600" aria-hidden="true">*</span>
        </label>
        <input id={`sf-domain-${form.slug || "new"}`} type="url" required value={form.domain} onChange={set("domain")} className={inputClass} placeholder="https://store.example.com" />
      </div>
      <div>
        <label htmlFor={`sf-style-${form.slug || "new"}`} className={labelClass}>Affiliate param style</label>
        <select id={`sf-style-${form.slug || "new"}`} value={form.paramStyle} onChange={set("paramStyle")} className={inputClass}>
          <option value="query">Query string</option>
          <option value="path">Path</option>
          <option value="none">None</option>
        </select>
      </div>
      <div>
        <label htmlFor={`sf-sort-${form.slug || "new"}`} className={labelClass}>Sort order</label>
        <input id={`sf-sort-${form.slug || "new"}`} type="number" min="0" value={form.sortOrder} onChange={set("sortOrder")} className={inputClass} />
      </div>
      <div className="sm:col-span-2">
        <label htmlFor={`sf-tpl-${form.slug || "new"}`} className={labelClass}>Affiliate template URL</label>
        <input
          id={`sf-tpl-${form.slug || "new"}`}
          value={form.template}
          onChange={set("template")}
          className={inputClass}
          placeholder="https://store.example.com/item?tag=your-tag"
        />
      </div>
      <label className="inline-flex min-h-[44px] items-center gap-2 text-body-sm text-neutral-700">
        <input type="checkbox" checked={form.active} onChange={set("active")} className="h-4 w-4 rounded border-neutral-300 text-primary-600 focus:ring-primary-500" />
        Active (enabled for public comparison)
      </label>
      <div className="flex items-end gap-2">
        <button
          type="submit"
          disabled={busy}
          className="inline-flex min-h-[44px] items-center rounded-md bg-primary-600 px-4 text-body-sm font-semibold text-white hover:bg-primary-700 disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-500"
        >
          {busy ? "Saving…" : initial.editing ? "Save store" : "Create store"}
        </button>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="inline-flex min-h-[44px] items-center rounded-md border border-neutral-300 bg-white px-4 text-body-sm font-medium hover:bg-neutral-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-500"
          >
            Cancel
          </button>
        )}
      </div>
    </form>
  );
}

export function AdminStores() {
  const { id } = useParams();
  const dispatch = useDispatch();
  const { stores, action } = useSelector((s) => s.admin);
  const [showCreate, setShowCreate] = useState(false);
  const [editingId, setEditingId] = useState(id || null);

  const load = () => dispatch(fetchAdminStores());

  useEffect(() => {
    load();
    return () => dispatch(clearAdminAction());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dispatch]);

  useEffect(() => {
    if (id) setEditingId(id);
  }, [id]);

  useEffect(() => {
    if (!action.busy && action.message) {
      setShowCreate(false);
      load();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [action.message, action.busy]);

  function toForm(store) {
    return {
      name: store.name,
      slug: store.slug,
      domain: store.domain,
      active: store.active,
      sortOrder: String(store.sortOrder ?? 0),
      paramStyle: store.affiliateConfig?.paramStyle || "query",
      template: store.affiliateConfig?.template || "",
      editing: true,
    };
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-title-2 font-semibold text-neutral-900">Stores</h2>
          <p className="text-body-sm text-neutral-600">{stores.items.length} total</p>
        </div>
        <button
          type="button"
          onClick={() => setShowCreate((v) => !v)}
          aria-expanded={showCreate}
          className="inline-flex min-h-[44px] items-center rounded-md bg-primary-600 px-4 text-body-sm font-semibold text-white hover:bg-primary-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-500"
        >
          {showCreate ? "Close" : "New store"}
        </button>
      </div>

      <ActionBanner />

      {showCreate && (
        <div className="rounded-lg border border-neutral-200 bg-white p-4 shadow-soft">
          <h3 className="mb-3 text-headline text-neutral-900">Create store</h3>
          <StoreForm
            initial={emptyForm}
            busy={action.busy}
            onSubmit={(body) => dispatch(createAdminStore(body))}
          />
        </div>
      )}

      {stores.status === "loading" && !stores.items.length ? (
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-lg" />
          ))}
        </div>
      ) : stores.status === "failed" ? (
        <ErrorState message={stores.error?.message} onRetry={load} />
      ) : stores.items.length === 0 ? (
        <EmptyState title="No stores" description="Create the first store to start collecting listings." />
      ) : (
        <ul className="space-y-3">
          {stores.items.map((s) => (
            <li key={s._id} className="rounded-lg border border-neutral-200 bg-white p-4 shadow-soft">
              {editingId === s._id ? (
                <StoreForm
                  initial={toForm(s)}
                  busy={action.busy}
                  onCancel={() => setEditingId(null)}
                  onSubmit={(body) =>
                    dispatch(updateAdminStore({ id: s._id, body: { ...body, slug: undefined } }))
                  }
                />
              ) : (
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-headline font-semibold text-neutral-900">{s.name}</h3>
                      <StatusPill status={s.active ? "active" : "inactive"} />
                    </div>
                    <p className="mt-0.5 text-body-sm text-neutral-600">
                      <span className="font-mono text-caption">{s.slug}</span> · {s.domain}
                    </p>
                    <p className="text-caption text-neutral-500">
                      {s.listingCount ?? 0} listing(s) · affiliate:{" "}
                      {s.affiliateConfig?.template ? "configured" : "not configured"}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        dispatch(
                          updateAdminStore({ id: s._id, body: { active: !s.active } })
                        )
                      }
                      disabled={action.busy}
                      className="inline-flex min-h-[40px] items-center rounded-md border border-neutral-300 bg-white px-3 text-caption font-medium hover:bg-neutral-100 disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-500"
                    >
                      {s.active ? "Disable" : "Enable"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditingId(s._id)}
                      className="inline-flex min-h-[40px] items-center rounded-md border border-neutral-300 bg-white px-3 text-caption font-medium hover:bg-neutral-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-500"
                    >
                      Edit
                    </button>
                    <ConfirmButton
                      label="Delete"
                      description={`Delete store “${s.name}” (blocked if it has listings)`}
                      busy={action.busy}
                      onConfirm={async () => {
                        const result = await dispatch(deleteAdminStore(s._id));
                        if (deleteAdminStore.fulfilled.match(result)) load();
                      }}
                    />
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
