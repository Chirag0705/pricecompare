import { useEffect, useMemo, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import {
  fetchAdminCategories,
  createAdminCategory,
  updateAdminCategory,
  deleteAdminCategory,
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

function flatten(nodes, depth = 0, out = []) {
  for (const n of nodes) {
    out.push({ ...n, depth });
    if (n.children?.length) flatten(n.children, depth + 1, out);
  }
  return out;
}

function CategoryForm({ initial, onSubmit, busy, onCancel }) {
  const [form, setForm] = useState(initial);
  const { action } = useSelector((s) => s.admin);
  const fieldErrors = fieldErrorsFrom(action.error);
  const set = (k) => (e) =>
    setForm((f) => ({ ...f, [k]: e.target.type === "checkbox" ? e.target.checked : e.target.value }));

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit({
          name: form.name.trim(),
          slug: form.slug.trim(),
          parent: form.parent || null,
          active: form.active,
          sortOrder: Number(form.sortOrder) || 0,
        });
      }}
      className="grid gap-3 sm:grid-cols-2"
      aria-label="Category form"
    >
      <div>
        <label htmlFor={`cf-name-${form.slug || "new"}`} className={labelClass}>
          Name <span className="text-danger-600" aria-hidden="true">*</span>
        </label>
        <input id={`cf-name-${form.slug || "new"}`} required value={form.name} onChange={set("name")} className={inputClass} />
        {fieldErrors.name && <p role="alert" className="mt-1 text-caption font-medium text-danger-700">{fieldErrors.name}</p>}
      </div>
      <div>
        <label htmlFor={`cf-slug-${form.slug || "new"}`} className={labelClass}>
          Slug <span className="text-danger-600" aria-hidden="true">*</span>
        </label>
        <input
          id={`cf-slug-${form.slug || "new"}`}
          required
          pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
          value={form.slug}
          onChange={set("slug")}
          className={inputClass}
          disabled={form.editing}
        />
        {fieldErrors.slug && <p role="alert" className="mt-1 text-caption font-medium text-danger-700">{fieldErrors.slug}</p>}
      </div>
      <div>
        <label htmlFor={`cf-parent-${form.slug || "new"}`} className={labelClass}>Parent</label>
        <select id={`cf-parent-${form.slug || "new"}`} value={form.parent} onChange={set("parent")} className={inputClass}>
          <option value="">None (top level)</option>
          {form.parentOptions
            .filter((o) => o.id !== form.id)
            .map((o) => (
              <option key={o.id} value={o.id}>{o.label}</option>
            ))}
        </select>
      </div>
      <div>
        <label htmlFor={`cf-sort-${form.slug || "new"}`} className={labelClass}>Sort order</label>
        <input id={`cf-sort-${form.slug || "new"}`} type="number" min="0" value={form.sortOrder} onChange={set("sortOrder")} className={inputClass} />
      </div>
      <label className="inline-flex min-h-[44px] items-center gap-2 text-body-sm text-neutral-700 sm:col-span-2">
        <input type="checkbox" checked={form.active} onChange={set("active")} className="h-4 w-4 rounded border-neutral-300 text-primary-600 focus:ring-primary-500" />
        Active (visible in navigation and browse)
      </label>
      <div className="flex items-end gap-2 sm:col-span-2">
        <button
          type="submit"
          disabled={busy}
          className="inline-flex min-h-[44px] items-center rounded-md bg-primary-600 px-4 text-body-sm font-semibold text-white hover:bg-primary-700 disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-500"
        >
          {busy ? "Saving…" : form.editing ? "Save category" : "Create category"}
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

export function AdminCategories() {
  const dispatch = useDispatch();
  const { categories, action } = useSelector((s) => s.admin);
  const [showCreate, setShowCreate] = useState(false);
  const [editingId, setEditingId] = useState(null);

  const load = () => dispatch(fetchAdminCategories());
  const flat = useMemo(() => flatten(categories.items), [categories.items]);
  const parentOptions = flat.map((c) => ({
    id: c._id,
    label: `${"  ".repeat(c.depth)}${c.name}`,
  }));

  useEffect(() => {
    load();
    return () => dispatch(clearAdminAction());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dispatch]);

  useEffect(() => {
    if (!action.busy && action.message) {
      setShowCreate(false);
      setEditingId(null);
      load();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [action.message, action.busy]);

  function renderNode(node, key) {
    if (editingId === node._id) {
      return (
        <li key={key} className="rounded-lg border border-primary-200 bg-primary-50/40 p-4">
          <CategoryForm
            busy={action.busy}
            initial={{
              name: node.name,
              slug: node.slug,
              parent: node.parent || "",
              active: node.active,
              sortOrder: String(node.sortOrder ?? 0),
              editing: true,
              id: node._id,
              parentOptions,
            }}
            onCancel={() => setEditingId(null)}
            onSubmit={(body) => dispatch(updateAdminCategory({ id: node._id, body }))}
          />
        </li>
      );
    }
    return (
      <li key={key} className="rounded-lg border border-neutral-200 bg-white p-3 shadow-soft">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div
            className="min-w-0"
            style={{ paddingLeft: `${Math.min(node.depth, 4) * 16}px` }}
          >
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-medium text-neutral-900">{node.name}</span>
              <span className="font-mono text-caption text-neutral-500">{node.slug}</span>
              {!node.active && <StatusPill status="inactive" />}
            </div>
            <p className="text-caption text-neutral-500">
              {node.productCount ?? 0} product(s) · {node.childCount ?? 0} subcategor{node.childCount === 1 ? "y" : "ies"}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setEditingId(node._id)}
              className="inline-flex min-h-[40px] items-center rounded-md border border-neutral-300 bg-white px-3 text-caption font-medium hover:bg-neutral-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-500"
            >
              Edit
            </button>
            <ConfirmButton
              label="Delete"
              description={`Delete “${node.name}” (blocked if it has products or subcategories)`}
              busy={action.busy}
              onConfirm={async () => {
                const result = await dispatch(deleteAdminCategory(node._id));
                if (deleteAdminCategory.fulfilled.match(result)) load();
              }}
            />
          </div>
        </div>
      </li>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-title-2 font-semibold text-neutral-900">Categories</h2>
          <p className="text-body-sm text-neutral-600">{categories.total} total</p>
        </div>
        <button
          type="button"
          onClick={() => setShowCreate((v) => !v)}
          aria-expanded={showCreate}
          className="inline-flex min-h-[44px] items-center rounded-md bg-primary-600 px-4 text-body-sm font-semibold text-white hover:bg-primary-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-500"
        >
          {showCreate ? "Close" : "New category"}
        </button>
      </div>

      <ActionBanner />

      {showCreate && (
        <div className="rounded-lg border border-neutral-200 bg-white p-4 shadow-soft">
          <h3 className="mb-3 text-headline text-neutral-900">Create category</h3>
          <CategoryForm
            busy={action.busy}
            initial={{
              name: "",
              slug: "",
              parent: "",
              active: true,
              sortOrder: "0",
              parentOptions,
            }}
            onSubmit={(body) => dispatch(createAdminCategory(body))}
          />
        </div>
      )}

      {categories.status === "loading" && !categories.items.length ? (
        <div className="space-y-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-12 rounded-lg" />
          ))}
        </div>
      ) : categories.status === "failed" ? (
        <ErrorState message={categories.error?.message} onRetry={load} />
      ) : flat.length === 0 ? (
        <EmptyState
          title="No categories yet"
          description="Create the first category to organize products."
        />
      ) : (
        <ul className="space-y-2">{flat.map((n) => renderNode(n, n._id))}</ul>
      )}
    </div>
  );
}
