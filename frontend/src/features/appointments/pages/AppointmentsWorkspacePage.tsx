import { useAuth } from "../../auth/context/AuthContext";
import { AppointmentsPage } from "./AppointmentsPage";
import { MyAppointmentsPage } from "./MyAppointmentsPage";

export function AppointmentsWorkspacePage() {
  const { hasPermission } = useAuth();

  const canReadAll = hasPermission(
    "appointments.read",
  );

  const canReadOwn = hasPermission(
    "appointments.own.read",
  );

  if (canReadAll) {
    return <AppointmentsPage />;
  }

  if (canReadOwn) {
    return <MyAppointmentsPage />;
  }

  return null;
}
