import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import { api, normalizeError } from "../lib/axios";

/* ---------- Wishlist ---------- */

export const fetchWishlist = createAsyncThunk(
  "user/fetchWishlist",
  async (_, { rejectWithValue }) => {
    try {
      const res = await api.get("/wishlist");
      return res.data.data;
    } catch (err) {
      return rejectWithValue(normalizeError(err));
    }
  }
);

export const toggleWishlist = createAsyncThunk(
  "user/toggleWishlist",
  async ({ productId, wished }, { rejectWithValue }) => {
    try {
      const res = wished
        ? await api.post(`/wishlist/${productId}`)
        : await api.delete(`/wishlist/${productId}`);
      return { productId, ...res.data.data };
    } catch (err) {
      return rejectWithValue(normalizeError(err));
    }
  }
);

/* ---------- Alerts ---------- */

export const fetchAlerts = createAsyncThunk(
  "user/fetchAlerts",
  async (_, { rejectWithValue }) => {
    try {
      const res = await api.get("/alerts");
      return res.data.data.alerts;
    } catch (err) {
      return rejectWithValue(normalizeError(err));
    }
  }
);

export const createAlert = createAsyncThunk(
  "user/createAlert",
  async ({ productId, targetPrice }, { rejectWithValue }) => {
    try {
      const res = await api.post("/alerts", {
        productId,
        targetPrice: Number(targetPrice),
      });
      return res.data.data;
    } catch (err) {
      return rejectWithValue(normalizeError(err));
    }
  }
);

export const patchAlert = createAsyncThunk(
  "user/patchAlert",
  async ({ id, ...body }, { rejectWithValue }) => {
    try {
      const res = await api.patch(`/alerts/${id}`, body);
      return res.data.data.alert;
    } catch (err) {
      return rejectWithValue(normalizeError(err));
    }
  }
);

export const deleteAlert = createAsyncThunk(
  "user/deleteAlert",
  async (id, { rejectWithValue }) => {
    try {
      await api.delete(`/alerts/${id}`);
      return id;
    } catch (err) {
      return rejectWithValue(normalizeError(err));
    }
  }
);

/* ---------- Notifications ---------- */

export const fetchNotifications = createAsyncThunk(
  "user/fetchNotifications",
  async (_, { rejectWithValue }) => {
    try {
      const res = await api.get("/notifications");
      return res.data.data;
    } catch (err) {
      return rejectWithValue(normalizeError(err));
    }
  }
);

export const fetchUnreadCount = createAsyncThunk(
  "user/fetchUnreadCount",
  async (_, { rejectWithValue }) => {
    try {
      const res = await api.get("/notifications/unread-count");
      return res.data.data.unreadCount;
    } catch (err) {
      return rejectWithValue(normalizeError(err));
    }
  }
);

export const markNotificationRead = createAsyncThunk(
  "user/markNotificationRead",
  async (id, { rejectWithValue }) => {
    try {
      await api.patch(`/notifications/${id}/read`);
      return id;
    } catch (err) {
      return rejectWithValue(normalizeError(err));
    }
  }
);

export const markAllNotificationsRead = createAsyncThunk(
  "user/markAllNotificationsRead",
  async (_, { rejectWithValue }) => {
    try {
      const res = await api.patch("/notifications/read-all");
      return res.data.data.updated;
    } catch (err) {
      return rejectWithValue(normalizeError(err));
    }
  }
);

const initialState = {
  wishlist: { items: [], total: 0, status: "idle", error: null, actionError: null },
  alerts: { items: [], status: "idle", error: null, actionError: null, lastResult: null },
  notifications: { items: [], unreadCount: 0, status: "idle", error: null },
};

const userSlice = createSlice({
  name: "user",
  initialState,
  reducers: {
    clearAlertResult(state) {
      state.alerts.lastResult = null;
    },
    clearWishlistActionError(state) {
      state.wishlist.actionError = null;
    },
  },
  extraReducers: (builder) => {
    builder
      // Wishlist
      .addCase(fetchWishlist.pending, (state) => {
        state.wishlist.status = "loading";
        state.wishlist.error = null;
      })
      .addCase(fetchWishlist.fulfilled, (state, action) => {
        state.wishlist.status = "succeeded";
        state.wishlist.items = action.payload.items;
        state.wishlist.total = action.payload.total;
      })
      .addCase(fetchWishlist.rejected, (state, action) => {
        state.wishlist.status = "failed";
        state.wishlist.error = action.payload;
      })
      .addCase(toggleWishlist.fulfilled, (state, action) => {
        const { productId, wished } = action.payload;
        if (!wished) {
          state.wishlist.items = state.wishlist.items.filter(
            (i) => i.product.id !== productId
          );
          state.wishlist.total = Math.max(0, state.wishlist.total - 1);
        }
        state.wishlist.actionError = null;
      })
      .addCase(toggleWishlist.rejected, (state, action) => {
        state.wishlist.actionError = action.payload;
      })
      // Alerts
      .addCase(fetchAlerts.pending, (state) => {
        state.alerts.status = "loading";
        state.alerts.error = null;
      })
      .addCase(fetchAlerts.fulfilled, (state, action) => {
        state.alerts.status = "succeeded";
        state.alerts.items = action.payload;
      })
      .addCase(fetchAlerts.rejected, (state, action) => {
        state.alerts.status = "failed";
        state.alerts.error = action.payload;
      })
      .addCase(createAlert.fulfilled, (state, action) => {
        state.alerts.lastResult = {
          triggeredNow: action.payload.triggeredNow,
          alreadyExists: action.payload.alreadyExists,
          targetPrice: action.payload.alert.targetPrice,
        };
        const existing = state.alerts.items.find((a) => a.id === action.payload.alert.id);
        if (!existing) state.alerts.items.unshift(action.payload.alert);
      })
      .addCase(patchAlert.fulfilled, (state, action) => {
        const idx = state.alerts.items.findIndex((a) => a.id === action.payload.id);
        if (idx >= 0) state.alerts.items[idx] = action.payload;
      })
      .addCase(deleteAlert.fulfilled, (state, action) => {
        state.alerts.items = state.alerts.items.filter((a) => a.id !== action.payload);
      })
      // Notifications
      .addCase(fetchNotifications.pending, (state) => {
        state.notifications.status = "loading";
        state.notifications.error = null;
      })
      .addCase(fetchNotifications.fulfilled, (state, action) => {
        state.notifications.status = "succeeded";
        state.notifications.items = action.payload.notifications;
        state.notifications.unreadCount = action.payload.unreadCount;
      })
      .addCase(fetchNotifications.rejected, (state, action) => {
        state.notifications.status = "failed";
        state.notifications.error = action.payload;
      })
      .addCase(fetchUnreadCount.fulfilled, (state, action) => {
        state.notifications.unreadCount = action.payload;
      })
      .addCase(markNotificationRead.fulfilled, (state, action) => {
        const n = state.notifications.items.find((i) => i.id === action.payload);
        if (n && !n.read) {
          n.read = true;
          state.notifications.unreadCount = Math.max(
            0,
            state.notifications.unreadCount - 1
          );
        }
      })
      .addCase(markAllNotificationsRead.fulfilled, (state) => {
        for (const n of state.notifications.items) n.read = true;
        state.notifications.unreadCount = 0;
      });
  },
});

export const { clearAlertResult, clearWishlistActionError } = userSlice.actions;
export default userSlice.reducer;
