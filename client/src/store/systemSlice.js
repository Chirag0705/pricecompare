import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import { api, normalizeError } from "../lib/axios";

export const fetchHealth = createAsyncThunk(
  "system/fetchHealth",
  async (_, { rejectWithValue }) => {
    try {
      const res = await api.get("/health");
      return res.data.data;
    } catch (err) {
      return rejectWithValue(normalizeError(err));
    }
  }
);

const systemSlice = createSlice({
  name: "system",
  initialState: {
    health: null,
    status: "idle",
    error: null,
  },
  reducers: {
    clearSystemError(state) {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchHealth.pending, (state) => {
        state.status = "loading";
        state.error = null;
      })
      .addCase(fetchHealth.fulfilled, (state, action) => {
        state.status = "succeeded";
        state.health = action.payload;
        state.error = null;
      })
      .addCase(fetchHealth.rejected, (state, action) => {
        state.status = "failed";
        state.error = action.payload;
      });
  },
});

export const { clearSystemError } = systemSlice.actions;
export default systemSlice.reducer;
