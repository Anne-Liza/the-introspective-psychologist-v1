export function invitationTokenFromUrl(hash: string, search: string) {
  const fragmentToken = new URLSearchParams(hash.replace(/^#/, "")).get(
    "token",
  );
  if (fragmentToken) return fragmentToken;

  // Backward compatibility for already-delivered invitations. The page still
  // removes the query string immediately after capturing it in memory.
  return new URLSearchParams(search).get("token") ?? "";
}

export function passwordRequirements(password: string) {
  return {
    hasMinimumLength: password.length >= 12,
    hasLetter: /[A-Za-z]/.test(password),
    hasNumber: /\d/.test(password),
  };
}

export function passwordMeetsRequirements(password: string) {
  return Object.values(passwordRequirements(password)).every(Boolean);
}
