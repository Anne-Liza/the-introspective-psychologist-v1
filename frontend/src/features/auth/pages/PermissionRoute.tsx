import { Navigate } from "react-router";

import { useAuth } from "../context/AuthContext";

export function PermissionRoute({
  permission,
  children,
}: {
  permission: string | string[];
  children: React.ReactNode;
}) {
  const { hasPermission, isLoading } = useAuth();

  if (isLoading) {
    return <div className="p-8 text-slate-600">Checking access...</div>;
  }

  const allowed = Array.isArray(permission)
    ? permission.some(hasPermission)
    : hasPermission(permission);

  if (!allowed) {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
}
