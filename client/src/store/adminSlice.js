import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import { api, normalizeError } from "../lib/axios";

export const fetchAdminStats = createAsyncThunk("admin/fetchStats", async (_arg, { rejectWithValue }) => {
  try {
    const res = await api.get("/admin/stats");
    return res.data.data;
  } catch (err) {
    return rejectWithValue(normalizeError(err));
  }
});

export const fetchAdminProducts = createAsyncThunk(
  "admin/fetchProducts",
  async (params = {}, { rejectWithValue }) => {
    try {
      const res = await api.get("/admin/products", { params });
      return res.data.data;
    } catch (err) {
      return rejectWithValue(normalizeError(err));
    }
  }
);

export const fetchAdminProduct = createAsyncThunk("admin/fetchProduct", async (id, { rejectWithValue }) => {
  try {
    const res = await api.get(`/admin/products/${id}`);
    return res.data.data;
  } catch (err) {
    return rejectWithValue(normalizeError(err));
  }
});

export const createAdminProduct = createAsyncThunk("admin/createProduct", async (body, { rejectWithValue }) => {
  try {
    const res = await api.post("/admin/products", body);
    return res.data.data;
  } catch (err) {
    return rejectWithValue(normalizeError(err));
  }
});

export const updateAdminProduct = createAsyncThunk(
  "admin/updateProduct",
  async ({ id, body }, { rejectWithValue }) => {
    try {
      const res = await api.put(`/admin/products/${id}`, body);
      return res.data.data;
    } catch (err) {
      return rejectWithValue(normalizeError(err));
    }
  }
);

export const mergeAdminProducts = createAsyncThunk(
  "admin/mergeProducts",
  async (body, { rejectWithValue }) => {
    try {
      const res = await api.post("/admin/products/merge", body);
      return res.data.data;
    } catch (err) {
      return rejectWithValue(normalizeError(err));
    }
  }
);

export const fetchAdminListings = createAsyncThunk("admin/fetchListings", async (params = {}, { rejectWithValue }) => {
  try {
    const res = await api.get("/admin/listings", { params });
    return res.data.data;
  } catch (err) {
    return rejectWithValue(normalizeError(err));
  }
});

export const updateAdminListing = createAsyncThunk(
  "admin/updateListing",
  async ({ id, body }, { rejectWithValue }) => {
    try {
      const res = await api.put(`/admin/listings/${id}`, body);
      return res.data.data;
    } catch (err) {
      return rejectWithValue(normalizeError(err));
    }
  }
);

export const attachAdminListing = createAsyncThunk(
  "admin/attachListing",
  async ({ id, productId }, { rejectWithValue }) => {
    try {
      const res = await api.post(`/admin/listings/${id}/attach`, { productId });
      return res.data.data;
    } catch (err) {
      return rejectWithValue(normalizeError(err));
    }
  }
);

export const deleteAdminListing = createAsyncThunk("admin/deleteListing", async (id, { rejectWithValue }) => {
  try {
    const res = await api.delete(`/admin/listings/${id}`);
    return { id, ...res.data.data };
  } catch (err) {
    return rejectWithValue(normalizeError(err));
  }
});

export const fetchAdminStores = createAsyncThunk("admin/fetchStores", async (_arg, { rejectWithValue }) => {
  try {
    const res = await api.get("/admin/stores");
    return res.data.data;
  } catch (err) {
    return rejectWithValue(normalizeError(err));
  }
});

export const createAdminStore = createAsyncThunk("admin/createStore", async (body, { rejectWithValue }) => {
  try {
    const res = await api.post("/admin/stores", body);
    return res.data.data;
  } catch (err) {
    return rejectWithValue(normalizeError(err));
  }
});

export const updateAdminStore = createAsyncThunk(
  "admin/updateStore",
  async ({ id, body }, { rejectWithValue }) => {
    try {
      const res = await api.put(`/admin/stores/${id}`, body);
      return res.data.data;
    } catch (err) {
      return rejectWithValue(normalizeError(err));
    }
  }
);

export const deleteAdminStore = createAsyncThunk("admin/deleteStore", async (id, { rejectWithValue }) => {
  try {
    const res = await api.delete(`/admin/stores/${id}`);
    return { id, ...res.data.data };
  } catch (err) {
    return rejectWithValue(normalizeError(err));
  }
});

export const fetchAdminCategories = createAsyncThunk("admin/fetchCategories", async (_arg, { rejectWithValue }) => {
  try {
    const res = await api.get("/admin/categories");
    return res.data.data;
  } catch (err) {
    return rejectWithValue(normalizeError(err));
  }
});

export const createAdminCategory = createAsyncThunk("admin/createCategory", async (body, { rejectWithValue }) => {
  try {
    const res = await api.post("/admin/categories", body);
    return res.data.data;
  } catch (err) {
    return rejectWithValue(normalizeError(err));
  }
});

export const updateAdminCategory = createAsyncThunk(
  "admin/updateCategory",
  async ({ id, body }, { rejectWithValue }) => {
    try {
      const res = await api.put(`/admin/categories/${id}`, body);
      return res.data.data;
    } catch (err) {
      return rejectWithValue(normalizeError(err));
    }
  }
);

export const deleteAdminCategory = createAsyncThunk("admin/deleteCategory", async (id, { rejectWithValue }) => {
  try {
    const res = await api.delete(`/admin/categories/${id}`);
    return { id, ...res.data.data };
  } catch (err) {
    return rejectWithValue(normalizeError(err));
  }
});

export const fetchAdminUsers = createAsyncThunk("admin/fetchUsers", async (params = {}, { rejectWithValue }) => {
  try {
    const res = await api.get("/admin/users", { params });
    return res.data.data;
  } catch (err) {
    return rejectWithValue(normalizeError(err));
  }
});

export const updateAdminUser = createAsyncThunk(
  "admin/updateUser",
  async ({ id, body }, { rejectWithValue }) => {
    try {
      const res = await api.patch(`/admin/users/${id}`, body);
      return res.data.data;
    } catch (err) {
      return rejectWithValue(normalizeError(err));
    }
  }
);

export const fetchAdminPrices = createAsyncThunk("admin/fetchPrices", async (params = {}, { rejectWithValue }) => {
  try {
    const res = await api.get("/admin/prices", { params });
    return res.data.data;
  } catch (err) {
    return rejectWithValue(normalizeError(err));
  }
});

export const fetchAdminPriceUpdates = createAsyncThunk(
  "admin/fetchPriceUpdates",
  async (params = {}, { rejectWithValue }) => {
    try {
      const res = await api.get("/admin/prices/updates", { params });
      return res.data.data;
    } catch (err) {
      return rejectWithValue(normalizeError(err));
    }
  }
);

export const fetchAdminIssues = createAsyncThunk("admin/fetchIssues", async (params = {}, { rejectWithValue }) => {
  try {
    const res = await api.get("/admin/data-issues", { params });
    return res.data.data;
  } catch (err) {
    return rejectWithValue(normalizeError(err));
  }
});

export const resolveAdminIssue = createAsyncThunk(
  "admin/resolveIssue",
  async ({ id, body }, { rejectWithValue }) => {
    try {
      const res = await api.patch(`/admin/data-issues/${id}`, body);
      return res.data.data;
    } catch (err) {
      return rejectWithValue(normalizeError(err));
    }
  }
);

export const fetchAdminJobs = createAsyncThunk("admin/fetchJobs", async (params = {}, { rejectWithValue }) => {
  try {
    const res = await api.get("/admin/sync/jobs", { params });
    return res.data.data;
  } catch (err) {
    return rejectWithValue(normalizeError(err));
  }
});

export const fetchAdminJob = createAsyncThunk("admin/fetchJob", async (id, { rejectWithValue }) => {
  try {
    const res = await api.get(`/admin/sync/jobs/${id}`);
    return res.data.data;
  } catch (err) {
    return rejectWithValue(normalizeError(err));
  }
});

export const triggerAdminSync = createAsyncThunk("admin/triggerSync", async (body, { rejectWithValue }) => {
  try {
    const res = await api.post("/admin/sync/jobs/trigger", body);
    return res.data.data;
  } catch (err) {
    return rejectWithValue(normalizeError(err));
  }
});

export const retryAdminJob = createAsyncThunk("admin/retryJob", async (id, { rejectWithValue }) => {
  try {
    const res = await api.post(`/admin/sync/jobs/${id}/retry`);
    return res.data.data;
  } catch (err) {
    return rejectWithValue(normalizeError(err));
  }
});

export const fetchAdminAdapters = createAsyncThunk("admin/fetchAdapters", async (_arg, { rejectWithValue }) => {
  try {
    const res = await api.get("/admin/sync/adapters");
    return res.data.data;
  } catch (err) {
    return rejectWithValue(normalizeError(err));
  }
});

export const fetchAdminActivity = createAsyncThunk("admin/fetchActivity", async (params = {}, { rejectWithValue }) => {
  try {
    const res = await api.get("/admin/activity", { params });
    return res.data.data;
  } catch (err) {
    return rejectWithValue(normalizeError(err));
  }
});

function listState() {
  return { items: [], page: 1, limit: 25, total: 0, totalPages: 1, status: "idle", error: null };
}

function pending(state, key) {
  state[key].status = "loading";
  state[key].error = null;
}
function fulfilledList(state, key, payload) {
  state[key].status = "succeeded";
  state[key].items = payload.items ?? payload.products ?? payload.listings ?? payload.users ?? payload.jobs ?? payload.issues ?? payload.entries ?? payload.updates ?? [];
  state[key].page = payload.page ?? 1;
  state[key].limit = payload.limit ?? 25;
  state[key].total = payload.total ?? state[key].items.length;
  state[key].totalPages = payload.totalPages ?? 1;
}
function rejected(state, key, error) {
  state[key].status = "failed";
  state[key].error = error;
}

const adminSlice = createSlice({
  name: "admin",
  initialState: {
    stats: { data: null, status: "idle", error: null },
    products: listState(),
    productDetail: { product: null, listings: [], status: "idle", error: null },
    listings: listState(),
    stores: { items: [], status: "idle", error: null },
    categories: { items: [], total: 0, status: "idle", error: null },
    users: listState(),
    prices: listState(),
    priceUpdates: listState(),
    issues: listState(),
    jobs: listState(),
    jobDetail: { job: null, status: "idle", error: null },
    adapters: { items: [], status: "idle", error: null },
    activity: listState(),
    action: { busy: false, error: null, message: null, kind: null },
  },
  reducers: {
    clearAdminAction(state) {
      state.action = { busy: false, error: null, message: null, kind: null };
    },
  },
  extraReducers: (builder) => {
    const startAction = (state) => {
      state.action = { busy: true, error: null, message: null, kind: null };
    };
    const okAction = (state, message) => {
      state.action = { busy: false, error: null, message, kind: null };
    };
    const errAction = (state, error) => {
      state.action = { busy: false, error, message: null, kind: null };
    };

    builder
      .addCase(fetchAdminStats.pending, (state) => {
        state.stats.status = "loading";
        state.stats.error = null;
      })
      .addCase(fetchAdminStats.fulfilled, (state, { payload }) => {
        state.stats.status = "succeeded";
        state.stats.data = payload;
      })
      .addCase(fetchAdminStats.rejected, (state, { payload }) => {
        state.stats.status = "failed";
        state.stats.error = payload;
      })

      .addCase(fetchAdminProducts.pending, (s) => pending(s, "products"))
      .addCase(fetchAdminProducts.fulfilled, (s, { payload }) => fulfilledList(s, "products", payload))
      .addCase(fetchAdminProducts.rejected, (s, { payload }) => rejected(s, "products", payload))

      .addCase(fetchAdminProduct.pending, (state) => {
        state.productDetail.status = "loading";
        state.productDetail.error = null;
      })
      .addCase(fetchAdminProduct.fulfilled, (state, { payload }) => {
        state.productDetail.status = "succeeded";
        state.productDetail.product = payload.product;
        state.productDetail.listings = payload.listings ?? [];
      })
      .addCase(fetchAdminProduct.rejected, (state, { payload }) => {
        state.productDetail.status = "failed";
        state.productDetail.error = payload;
      })

      .addCase(createAdminProduct.pending, startAction)
      .addCase(createAdminProduct.fulfilled, (state) => okAction(state, "Product created"))
      .addCase(createAdminProduct.rejected, (state, { payload }) => errAction(state, payload))

      .addCase(updateAdminProduct.pending, startAction)
      .addCase(updateAdminProduct.fulfilled, (state, { payload }) => {
        okAction(state, "Product saved");
        if (state.productDetail.product && String(state.productDetail.product._id) === String(payload.product._id)) {
          state.productDetail.product = payload.product;
        }
      })
      .addCase(updateAdminProduct.rejected, (state, { payload }) => errAction(state, payload))

      .addCase(mergeAdminProducts.pending, startAction)
      .addCase(mergeAdminProducts.fulfilled, (state, { payload }) => {
        const moved = payload.merged?.movedListings ?? 0;
        okAction(state, `Merge complete — ${moved} listing(s) moved`);
      })
      .addCase(mergeAdminProducts.rejected, (state, { payload }) => errAction(state, payload))

      .addCase(fetchAdminListings.pending, (s) => pending(s, "listings"))
      .addCase(fetchAdminListings.fulfilled, (s, { payload }) => fulfilledList(s, "listings", payload))
      .addCase(fetchAdminListings.rejected, (s, { payload }) => rejected(s, "listings", payload))

      .addCase(updateAdminListing.pending, startAction)
      .addCase(updateAdminListing.fulfilled, (state) => okAction(state, "Listing saved"))
      .addCase(updateAdminListing.rejected, (state, { payload }) => errAction(state, payload))

      .addCase(attachAdminListing.pending, startAction)
      .addCase(attachAdminListing.fulfilled, (state) => okAction(state, "Listing attached"))
      .addCase(attachAdminListing.rejected, (state, { payload }) => errAction(state, payload))

      .addCase(deleteAdminListing.pending, startAction)
      .addCase(deleteAdminListing.fulfilled, (state, { payload }) =>
        okAction(state, payload.archived ? "Listing archived (has price history)" : "Listing deleted")
      )
      .addCase(deleteAdminListing.rejected, (state, { payload }) => errAction(state, payload))

      .addCase(fetchAdminStores.pending, (state) => {
        state.stores.status = "loading";
        state.stores.error = null;
      })
      .addCase(fetchAdminStores.fulfilled, (state, { payload }) => {
        state.stores.status = "succeeded";
        state.stores.items = payload.stores ?? [];
      })
      .addCase(fetchAdminStores.rejected, (state, { payload }) => {
        state.stores.status = "failed";
        state.stores.error = payload;
      })

      .addCase(createAdminStore.pending, startAction)
      .addCase(createAdminStore.fulfilled, (state) => okAction(state, "Store created"))
      .addCase(createAdminStore.rejected, (state, { payload }) => errAction(state, payload))

      .addCase(updateAdminStore.pending, startAction)
      .addCase(updateAdminStore.fulfilled, (state, { payload }) => {
        okAction(state, "Store saved");
        const idx = state.stores.items.findIndex((s) => String(s._id) === String(payload.store._id));
        if (idx >= 0) state.stores.items[idx] = { ...state.stores.items[idx], ...payload.store };
      })
      .addCase(updateAdminStore.rejected, (state, { payload }) => errAction(state, payload))

      .addCase(deleteAdminStore.pending, startAction)
      .addCase(deleteAdminStore.fulfilled, (state) => okAction(state, "Store deleted"))
      .addCase(deleteAdminStore.rejected, (state, { payload }) => errAction(state, payload))

      .addCase(fetchAdminCategories.pending, (state) => {
        state.categories.status = "loading";
        state.categories.error = null;
      })
      .addCase(fetchAdminCategories.fulfilled, (state, { payload }) => {
        state.categories.status = "succeeded";
        state.categories.items = payload.categories ?? [];
        state.categories.total = payload.total ?? 0;
      })
      .addCase(fetchAdminCategories.rejected, (state, { payload }) => {
        state.categories.status = "failed";
        state.categories.error = payload;
      })

      .addCase(createAdminCategory.pending, startAction)
      .addCase(createAdminCategory.fulfilled, (state) => okAction(state, "Category created"))
      .addCase(createAdminCategory.rejected, (state, { payload }) => errAction(state, payload))

      .addCase(updateAdminCategory.pending, startAction)
      .addCase(updateAdminCategory.fulfilled, (state) => okAction(state, "Category saved"))
      .addCase(updateAdminCategory.rejected, (state, { payload }) => errAction(state, payload))

      .addCase(deleteAdminCategory.pending, startAction)
      .addCase(deleteAdminCategory.fulfilled, (state) => okAction(state, "Category deleted"))
      .addCase(deleteAdminCategory.rejected, (state, { payload }) => errAction(state, payload))

      .addCase(fetchAdminUsers.pending, (s) => pending(s, "users"))
      .addCase(fetchAdminUsers.fulfilled, (s, { payload }) => fulfilledList(s, "users", payload))
      .addCase(fetchAdminUsers.rejected, (s, { payload }) => rejected(s, "users", payload))

      .addCase(updateAdminUser.pending, startAction)
      .addCase(updateAdminUser.fulfilled, (state, { payload }) => {
        okAction(state, "User updated");
        const idx = state.users.items.findIndex((u) => String(u._id) === String(payload.user.id));
        if (idx >= 0) state.users.items[idx] = { ...state.users.items[idx], ...payload.user };
      })
      .addCase(updateAdminUser.rejected, (state, { payload }) => errAction(state, payload))

      .addCase(fetchAdminPrices.pending, (s) => pending(s, "prices"))
      .addCase(fetchAdminPrices.fulfilled, (s, { payload }) => fulfilledList(s, "prices", payload))
      .addCase(fetchAdminPrices.rejected, (s, { payload }) => rejected(s, "prices", payload))

      .addCase(fetchAdminPriceUpdates.pending, (s) => pending(s, "priceUpdates"))
      .addCase(fetchAdminPriceUpdates.fulfilled, (s, { payload }) => fulfilledList(s, "priceUpdates", payload))
      .addCase(fetchAdminPriceUpdates.rejected, (s, { payload }) => rejected(s, "priceUpdates", payload))

      .addCase(fetchAdminIssues.pending, (s) => pending(s, "issues"))
      .addCase(fetchAdminIssues.fulfilled, (s, { payload }) => fulfilledList(s, "issues", payload))
      .addCase(fetchAdminIssues.rejected, (s, { payload }) => rejected(s, "issues", payload))

      .addCase(resolveAdminIssue.pending, startAction)
      .addCase(resolveAdminIssue.fulfilled, (state) => okAction(state, "Issue updated"))
      .addCase(resolveAdminIssue.rejected, (state, { payload }) => errAction(state, payload))

      .addCase(fetchAdminJobs.pending, (s) => pending(s, "jobs"))
      .addCase(fetchAdminJobs.fulfilled, (s, { payload }) => fulfilledList(s, "jobs", payload))
      .addCase(fetchAdminJobs.rejected, (s, { payload }) => rejected(s, "jobs", payload))

      .addCase(fetchAdminJob.pending, (state) => {
        state.jobDetail.status = "loading";
        state.jobDetail.error = null;
      })
      .addCase(fetchAdminJob.fulfilled, (state, { payload }) => {
        state.jobDetail.status = "succeeded";
        state.jobDetail.job = payload.job;
      })
      .addCase(fetchAdminJob.rejected, (state, { payload }) => {
        state.jobDetail.status = "failed";
        state.jobDetail.error = payload;
      })

      .addCase(triggerAdminSync.pending, startAction)
      .addCase(triggerAdminSync.fulfilled, (state) => okAction(state, "Sync job triggered"))
      .addCase(triggerAdminSync.rejected, (state, { payload }) => errAction(state, payload))

      .addCase(retryAdminJob.pending, startAction)
      .addCase(retryAdminJob.fulfilled, (state) => okAction(state, "Retry job triggered"))
      .addCase(retryAdminJob.rejected, (state, { payload }) => errAction(state, payload))

      .addCase(fetchAdminAdapters.pending, (state) => {
        state.adapters.status = "loading";
      })
      .addCase(fetchAdminAdapters.fulfilled, (state, { payload }) => {
        state.adapters.status = "succeeded";
        state.adapters.items = payload.adapters ?? [];
      })
      .addCase(fetchAdminAdapters.rejected, (state, { payload }) => {
        state.adapters.status = "failed";
        state.adapters.error = payload;
      })

      .addCase(fetchAdminActivity.pending, (s) => pending(s, "activity"))
      .addCase(fetchAdminActivity.fulfilled, (s, { payload }) => fulfilledList(s, "activity", payload))
      .addCase(fetchAdminActivity.rejected, (s, { payload }) => rejected(s, "activity", payload));
  },
});

export const { clearAdminAction } = adminSlice.actions;
export default adminSlice.reducer;
