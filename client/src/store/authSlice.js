import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import { api, normalizeError } from "../lib/axios";
import { getToken, setToken, clearToken } from "../lib/tokenStorage";

function extractUser(res) {
  return res.data?.data?.user ?? null;
}
function extractToken(res) {
  return res.data?.data?.token ?? null;
}

export const register = createAsyncThunk(
  "auth/register",
  async (payload, { rejectWithValue }) => {
    try {
      const res = await api.post("/auth/register", payload, {
        skipAuthHandler: true,
      });
      return { token: extractToken(res), user: extractUser(res) };
    } catch (err) {
      return rejectWithValue(normalizeError(err));
    }
  }
);

export const login = createAsyncThunk(
  "auth/login",
  async (payload, { rejectWithValue }) => {
    try {
      const res = await api.post("/auth/login", payload, {
        skipAuthHandler: true,
      });
      return { token: extractToken(res), user: extractUser(res) };
    } catch (err) {
      return rejectWithValue(normalizeError(err));
    }
  }
);

export const logout = createAsyncThunk("auth/logout", async () => {
  try {
    await api.post("/auth/logout");
  } catch {
    /* token discard is what matters; server logout is best-effort */
  }
});

export const fetchMe = createAsyncThunk(
  "auth/fetchMe",
  async (_, { rejectWithValue }) => {
    try {
      const res = await api.get("/auth/me", { skipAuthHandler: true });
      return extractUser(res);
    } catch (err) {
      return rejectWithValue(normalizeError(err));
    }
  }
);

export const updateProfile = createAsyncThunk(
  "auth/updateProfile",
  async (payload, { rejectWithValue }) => {
    try {
      const res = await api.put("/users/me", payload);
      return extractUser(res);
    } catch (err) {
      return rejectWithValue(normalizeError(err));
    }
  }
);

export const changePassword = createAsyncThunk(
  "auth/changePassword",
  async (payload, { rejectWithValue }) => {
    try {
      const res = await api.put("/users/me/password", payload);
      return { token: extractToken(res) };
    } catch (err) {
      return rejectWithValue(normalizeError(err));
    }
  }
);

const initialState = {
  user: null,
  token: getToken(),
  status: "idle",
  error: null,
  profileStatus: "idle",
  profileError: null,
  passwordStatus: "idle",
  passwordError: null,
};

const authSlice = createSlice({
  name: "auth",
  initialState,
  reducers: {
    sessionExpired(state) {
      state.user = null;
      state.token = null;
      state.status = "idle";
      clearToken();
    },
    clearAuthError(state) {
      state.error = null;
    },
    clearProfileFeedback(state) {
      state.profileStatus = "idle";
      state.profileError = null;
    },
    clearPasswordFeedback(state) {
      state.passwordStatus = "idle";
      state.passwordError = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(register.pending, (state) => {
        state.status = "loading";
        state.error = null;
      })
      .addCase(register.fulfilled, (state, action) => {
        state.status = "succeeded";
        state.user = action.payload.user;
        state.token = action.payload.token;
        setToken(action.payload.token);
      })
      .addCase(register.rejected, (state, action) => {
        state.status = "failed";
        state.error = action.payload;
      })
      .addCase(login.pending, (state) => {
        state.status = "loading";
        state.error = null;
      })
      .addCase(login.fulfilled, (state, action) => {
        state.status = "succeeded";
        state.user = action.payload.user;
        state.token = action.payload.token;
        setToken(action.payload.token);
      })
      .addCase(login.rejected, (state, action) => {
        state.status = "failed";
        state.error = action.payload;
      })
      .addCase(logout.fulfilled, (state) => {
        state.user = null;
        state.token = null;
        state.status = "idle";
        state.error = null;
        clearToken();
      })
      .addCase(fetchMe.pending, (state) => {
        if (!state.user) state.status = "loading";
      })
      .addCase(fetchMe.fulfilled, (state, action) => {
        state.user = action.payload;
        state.status = "succeeded";
      })
      .addCase(fetchMe.rejected, (state) => {
        state.user = null;
        state.token = null;
        state.status = "idle";
        clearToken();
      })
      .addCase(updateProfile.pending, (state) => {
        state.profileStatus = "loading";
        state.profileError = null;
      })
      .addCase(updateProfile.fulfilled, (state, action) => {
        state.profileStatus = "succeeded";
        state.user = action.payload;
      })
      .addCase(updateProfile.rejected, (state, action) => {
        state.profileStatus = "failed";
        state.profileError = action.payload;
      })
      .addCase(changePassword.pending, (state) => {
        state.passwordStatus = "loading";
        state.passwordError = null;
      })
      .addCase(changePassword.fulfilled, (state, action) => {
        state.passwordStatus = "succeeded";
        if (action.payload.token) {
          state.token = action.payload.token;
          setToken(action.payload.token);
        }
      })
      .addCase(changePassword.rejected, (state, action) => {
        state.passwordStatus = "failed";
        state.passwordError = action.payload;
      });
  },
});

export const {
  sessionExpired,
  clearAuthError,
  clearProfileFeedback,
  clearPasswordFeedback,
} = authSlice.actions;
export default authSlice.reducer;
