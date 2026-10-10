import { configureStore } from "@reduxjs/toolkit";
import systemReducer from "./systemSlice";
import authReducer from "./authSlice";
import catalogReducer from "./catalogSlice";
import userReducer from "./userSlice";
import adminReducer from "./adminSlice";
import { setOnUnauthorized } from "../lib/axios";
import { sessionExpired } from "./authSlice";

export const store = configureStore({
  reducer: {
    system: systemReducer,
    auth: authReducer,
    catalog: catalogReducer,
    user: userReducer,
    admin: adminReducer,
  },
});

setOnUnauthorized(() => store.dispatch(sessionExpired()));
