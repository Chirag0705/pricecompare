import { useEffect } from "react";
import { Routes, Route } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import { AppShell } from "./components/layout/AppShell";
import { RequireAuth, RequireAdmin } from "./components/auth/guards";
import { fetchMe } from "./store/authSlice";
import { HomePage } from "./pages/HomePage";
import { SearchPage } from "./pages/SearchPage";
import { CategoryPage } from "./pages/CategoryPage";
import { ProductPage } from "./pages/ProductPage";
import { WishlistPage } from "./pages/WishlistPage";
import { AlertsPage } from "./pages/AlertsPage";
import { NotificationsPage } from "./pages/NotificationsPage";
import { LoginPage } from "./pages/LoginPage";
import { RegisterPage } from "./pages/RegisterPage";
import { ProfilePage } from "./pages/ProfilePage";
import { ForbiddenPage } from "./pages/ForbiddenPage";
import { AdminLayout } from "./pages/admin/AdminLayout";
import { AdminDashboard } from "./pages/admin/AdminDashboard";
import { AdminProducts } from "./pages/admin/AdminProducts";
import { AdminProductDetail } from "./pages/admin/AdminProductDetail";
import { AdminListings } from "./pages/admin/AdminListings";
import { AdminStores } from "./pages/admin/AdminStores";
import { AdminCategories } from "./pages/admin/AdminCategories";
import { AdminUsers } from "./pages/admin/AdminUsers";
import { AdminPrices } from "./pages/admin/AdminPrices";
import { AdminMatching } from "./pages/admin/AdminMatching";
import { AdminJobs } from "./pages/admin/AdminJobs";
import { AdminActivity } from "./pages/admin/AdminActivity";
import { NotFoundPage } from "./pages/NotFoundPage";

export default function App() {
  const dispatch = useDispatch();
  const { token, user } = useSelector((s) => s.auth);

  useEffect(() => {
    if (token && !user) {
      dispatch(fetchMe());
    }
  }, [dispatch, token, user]);

  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route index element={<HomePage />} />
        <Route path="/search" element={<SearchPage />} />
        <Route path="/category/:slug" element={<CategoryPage />} />
        <Route path="/product/:id" element={<ProductPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/forbidden" element={<ForbiddenPage />} />
        <Route element={<RequireAuth />}>
          <Route path="/wishlist" element={<WishlistPage />} />
          <Route path="/alerts" element={<AlertsPage />} />
          <Route path="/notifications" element={<NotificationsPage />} />
          <Route path="/profile" element={<ProfilePage />} />
        </Route>
        <Route element={<RequireAdmin />}>
          <Route path="/admin" element={<AdminLayout />}>
            <Route index element={<AdminDashboard />} />
            <Route path="products" element={<AdminProducts />} />
            <Route path="products/:id" element={<AdminProductDetail />} />
            <Route path="listings" element={<AdminListings />} />
            <Route path="stores" element={<AdminStores />} />
            <Route path="stores/:id" element={<AdminStores />} />
            <Route path="categories" element={<AdminCategories />} />
            <Route path="users" element={<AdminUsers />} />
            <Route path="prices" element={<AdminPrices />} />
            <Route path="matching" element={<AdminMatching />} />
            <Route path="jobs" element={<AdminJobs />} />
            <Route path="activity" element={<AdminActivity />} />
          </Route>
        </Route>
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}
