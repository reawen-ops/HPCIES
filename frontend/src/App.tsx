import "./App.css";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import MainPage from "./pages/Home/MainPage";
import LoginPage from "./pages/Login/LoginPage";
import RegisterPage from "./pages/Register/RegisterPage";
import { useAuth } from "./auth/AuthProvider";
import type { ReactElement } from "react";

function RequireAuth({ children }: { children: ReactElement }) {
  const { isLoading, isAuthenticated } = useAuth();
  if (isLoading) return <div />;
  if (!isAuthenticated) return <Navigate to="/register" replace />;
  return children;
}

function RedirectIfAuth({ children }: { children: ReactElement }) {
  const { isLoading, isAuthenticated } = useAuth();
  if (isLoading) return <div />;
  if (isAuthenticated) return <Navigate to="/" replace />;
  return children;
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route
          path="/"
          element={
            <RequireAuth>
              <MainPage />
            </RequireAuth>
          }
        />
        <Route
          path="/login"
          element={
            <RedirectIfAuth>
              <LoginPage />
            </RedirectIfAuth>
          }
        />
        <Route
          path="/register"
          element={
            <RedirectIfAuth>
              <RegisterPage />
            </RedirectIfAuth>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
