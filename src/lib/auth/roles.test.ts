import { describe, expect, it } from "vitest";
import { dashboardPathForRole, ROLE_LABEL } from "./roles";

describe("dashboardPathForRole", () => {
  it("maps each role to its own dashboard", () => {
    expect(dashboardPathForRole("farmer")).toBe("/farmer/dashboard");
    expect(dashboardPathForRole("restaurant")).toBe("/restaurant/dashboard");
    expect(dashboardPathForRole("driver")).toBe("/driver/dashboard");
    expect(dashboardPathForRole("admin")).toBe("/admin/dashboard");
  });
});

describe("ROLE_LABEL", () => {
  it("has a French label for every role", () => {
    expect(ROLE_LABEL.farmer).toBe("agriculteur");
    expect(ROLE_LABEL.restaurant).toBe("restaurant");
    expect(ROLE_LABEL.driver).toBe("livreur");
    expect(ROLE_LABEL.admin).toBe("administrateur");
  });
});
