import axios from "axios";

export function contactSubmissionErrorMessage(error: unknown): string {
  if (axios.isAxiosError(error) && error.response?.status === 429) {
    return "Too many recent requests. Please wait a few minutes before trying again.";
  }

  return "Message failed to send. Please try again later.";
}
