import axios from "axios";
import { QueryClient } from "@tanstack/react-query";

export function shouldRetryQuery(
  failureCount: number,
  error: unknown,
) {
  if (axios.isAxiosError(error)) {
    const status = error.response?.status;

    if (status === 401 || status === 403) {
      return false;
    }
  }

  return failureCount < 1;
}

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: shouldRetryQuery,
      refetchOnWindowFocus: false,
    },
  },
});
