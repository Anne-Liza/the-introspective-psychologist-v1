import { Navigate } from "react-router";

import { useAuth } from "../context/AuthContext";

export function PermissionRoute({
  permission,
  children,
}: {
  permission: string;
  children: React.ReactNode;
}) {
  const { hasPermission, isLoading } = useAuth();

  if (isLoading) {
    return <div className="p-8 text-slate-600">Checking access...</div>;
  }

  if (!hasPermission(permission)) {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
}
