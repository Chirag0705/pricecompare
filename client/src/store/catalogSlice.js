import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import { api, normalizeError } from "../lib/axios";
import { toggleWishlist } from "./userSlice";

function buildSearchQuery(params) {
  const query = {};
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === "") continue;
    query[key] = value;
  }
  return query;
}

export const fetchStores = createAsyncThunk(
  "catalog/fetchStores",
  async (_, { rejectWithValue }) => {
    try {
      const res = await api.get("/stores");
      return res.data.data.stores;
    } catch (err) {
      return rejectWithValue(normalizeError(err));
    }
  }
);

export const fetchCategories = createAsyncThunk(
  "catalog/fetchCategories",
  async (_, { rejectWithValue }) => {
    try {
      const res = await api.get("/categories");
      return res.data.data.categories;
    } catch (err) {
      return rejectWithValue(normalizeError(err));
    }
  }
);

export const fetchSearch = createAsyncThunk(
  "catalog/fetchSearch",
  async (params, { rejectWithValue }) => {
    try {
      const res = await api.get("/products/search", {
        params: buildSearchQuery(params),
      });
      return { ...res.data.data, params };
    } catch (err) {
      return rejectWithValue(normalizeError(err));
    }
  }
);

export const fetchProduct = createAsyncThunk(
  "catalog/fetchProduct",
  async (id, { rejectWithValue }) => {
    try {
      const res = await api.get(`/products/${id}`);
      return res.data.data;
    } catch (err) {
      return rejectWithValue(normalizeError(err));
    }
  }
);

export const fetchPriceHistory = createAsyncThunk(
  "catalog/fetchPriceHistory",
  async ({ id, days = 90 }, { rejectWithValue }) => {
    try {
      const res = await api.get(`/products/${id}/price-history`, {
        params: { days },
      });
      return res.data.data;
    } catch (err) {
      return rejectWithValue(normalizeError(err));
    }
  }
);

export const fetchSuggestions = createAsyncThunk(
  "catalog/fetchSuggestions",
  async (q, { rejectWithValue }) => {
    try {
      const res = await api.get("/products/suggestions", { params: { q } });
      return res.data.data.suggestions;
    } catch (err) {
      return rejectWithValue(normalizeError(err));
    }
  }
);

export const fetchRecommendations = createAsyncThunk(
  "catalog/fetchRecommendations",
  async (id, { rejectWithValue }) => {
    try {
      const res = await api.get(`/products/${id}/recommendations`);
      return res.data.data;
    } catch (err) {
      return rejectWithValue(normalizeError(err));
    }
  }
);

const initialState = {
  stores: { items: [], status: "idle", error: null },
  categories: { tree: [], status: "idle", error: null },
  search: {
    items: [],
    page: 1,
    limit: 12,
    total: 0,
    totalPages: 1,
    availableBrands: [],
    category: null,
    status: "idle",
    error: null,
    activeParams: null,
  },
  detail: {
    product: null,
    listings: [],
    summary: null,
    wishlisted: false,
    status: "idle",
    error: null,
    activeId: null,
  },
  history: {
    points: [],
    days: 90,
    status: "idle",
    error: null,
    activeId: null,
  },
  suggestions: {
    items: [],
    status: "idle",
    query: "",
  },
  recommendations: {
    related: [],
    trending: [],
    trendingFallback: false,
    status: "idle",
    error: null,
    activeId: null,
  },
};

const catalogSlice = createSlice({
  name: "catalog",
  initialState,
  reducers: {
    resetSearch(state) {
      state.search = { ...initialState.search };
    },
    clearSuggestions(state) {
      state.suggestions = { ...initialState.suggestions };
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchStores.pending, (state) => {
        state.stores.status = "loading";
        state.stores.error = null;
      })
      .addCase(fetchStores.fulfilled, (state, action) => {
        state.stores.status = "succeeded";
        state.stores.items = action.payload;
      })
      .addCase(fetchStores.rejected, (state, action) => {
        state.stores.status = "failed";
        state.stores.error = action.payload;
      })
      .addCase(fetchCategories.pending, (state) => {
        state.categories.status = "loading";
        state.categories.error = null;
      })
      .addCase(fetchCategories.fulfilled, (state, action) => {
        state.categories.status = "succeeded";
        state.categories.tree = action.payload;
      })
      .addCase(fetchCategories.rejected, (state, action) => {
        state.categories.status = "failed";
        state.categories.error = action.payload;
      })
      .addCase(fetchSearch.pending, (state, action) => {
        state.search.status = "loading";
        state.search.error = null;
        state.search.activeParams = action.meta.arg;
      })
      .addCase(fetchSearch.fulfilled, (state, action) => {
        state.search.status = "succeeded";
        Object.assign(state.search, {
          items: action.payload.items,
          page: action.payload.page,
          limit: action.payload.limit,
          total: action.payload.total,
          totalPages: action.payload.totalPages,
          availableBrands: action.payload.availableBrands,
          category: action.payload.category,
        });
      })
      .addCase(fetchSearch.rejected, (state, action) => {
        state.search.status = "failed";
        state.search.error = action.payload;
      })
      .addCase(fetchProduct.pending, (state, action) => {
        state.detail.status = "loading";
        state.detail.error = null;
        state.detail.activeId = action.meta.arg;
      })
      .addCase(fetchProduct.fulfilled, (state, action) => {
        state.detail.status = "succeeded";
        state.detail.product = action.payload.product;
        state.detail.listings = action.payload.listings;
        state.detail.summary = action.payload.summary;
        state.detail.wishlisted = Boolean(action.payload.wishlisted);
      })
      .addCase(toggleWishlist.fulfilled, (state, action) => {
        if (
          state.detail.product &&
          String(state.detail.product.id) === String(action.payload.productId)
        ) {
          state.detail.wishlisted = action.payload.wished;
        }
      })
      .addCase(fetchProduct.rejected, (state, action) => {
        state.detail.status = "failed";
        state.detail.error = action.payload;
      })
      .addCase(fetchPriceHistory.pending, (state, action) => {
        state.history.status = "loading";
        state.history.error = null;
        state.history.activeId = action.meta.arg.id;
      })
      .addCase(fetchPriceHistory.fulfilled, (state, action) => {
        state.history.status = "succeeded";
        state.history.points = action.payload.points;
        state.history.days = action.payload.days;
      })
      .addCase(fetchPriceHistory.rejected, (state, action) => {
        state.history.status = "failed";
        state.history.error = action.payload;
      })
      .addCase(fetchSuggestions.pending, (state, action) => {
        state.suggestions.status = "loading";
        state.suggestions.query = action.meta.arg;
      })
      .addCase(fetchSuggestions.fulfilled, (state, action) => {
        // Ignore stale responses if the query changed while in flight.
        if (state.suggestions.query !== action.meta.arg) return;
        state.suggestions.status = "succeeded";
        state.suggestions.items = action.payload;
      })
      .addCase(fetchSuggestions.rejected, (state, action) => {
        if (state.suggestions.query !== action.meta.arg) return;
        state.suggestions.status = "idle";
        state.suggestions.items = [];
      })
      .addCase(fetchRecommendations.pending, (state, action) => {
        state.recommendations.status = "loading";
        state.recommendations.error = null;
        state.recommendations.activeId = action.meta.arg;
      })
      .addCase(fetchRecommendations.fulfilled, (state, action) => {
        state.recommendations.status = "succeeded";
        state.recommendations.related = action.payload.related;
        state.recommendations.trending = action.payload.trending;
        state.recommendations.trendingFallback = Boolean(action.payload.trendingFallback);
      })
      .addCase(fetchRecommendations.rejected, (state, action) => {
        state.recommendations.status = "failed";
        state.recommendations.error = action.payload;
      });
  },
});

export const { resetSearch, clearSuggestions } = catalogSlice.actions;
export default catalogSlice.reducer;
