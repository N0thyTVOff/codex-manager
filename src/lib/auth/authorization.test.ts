import { APIError } from "better-auth/api";
import { describe, expect, it } from "vitest";

import { assertAuthorizedGitHubProfile } from "./authorization";

describe("autorisation GitHub", () => {
  it("accepte uniquement l'identifiant numérique configuré", () => {
    expect(() => assertAuthorizedGitHubProfile({ id: 312060648 }, "312060648")).not.toThrow();
    expect(() => assertAuthorizedGitHubProfile({ id: "42" }, "312060648")).toThrow(APIError);
  });
});
