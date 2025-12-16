import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import React from "react";

export default function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { accessToken } = useAuth();
  const location = useLocation();
  if (!accessToken) {
    return <Navigate to="/signin" replace state={{ from: location }} />;
    }
  return <>{children}</>;
}
