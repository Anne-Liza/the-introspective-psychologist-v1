import { Navigate } from "react-router";

export function PublicAvailabilityRedirect() {
  return <Navigate to="/book" replace />;
}
