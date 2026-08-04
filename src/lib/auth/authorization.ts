import { APIError } from "better-auth/api";

interface GitHubProfile {
  readonly id: number | string;
}

export function assertAuthorizedGitHubProfile(
  profile: GitHubProfile,
  authorizedGitHubUserId: string,
): void {
  if (String(profile.id) !== authorizedGitHubUserId) {
    throw new APIError("FORBIDDEN", {
      message: "Ce coffre est réservé à son propriétaire.",
    });
  }
}
