import { EntitlementsService } from "./entitlements.service";

describe("EntitlementsService publishing rules", () => {
  const service = new EntitlementsService({} as never);

  function evalPublish(
    input: Parameters<EntitlementsService["evaluatePublishing"]>[0],
  ) {
    // Access private via bracket for unit focus
    return (
      service as unknown as {
        evaluatePublishing: typeof service["evaluatePublishing"];
      }
    ).evaluatePublishing(input);
  }

  it("allows active subscriptions", () => {
    expect(
      evalPublish({
        companyStatus: "ACTIVE",
        subscriptionStatus: "ACTIVE",
        trialEndsAt: null,
        graceEndsAt: null,
        periodEnd: new Date(Date.now() + 86400000),
      }).allowed,
    ).toBe(true);
  });

  it("blocks expired trials", () => {
    const result = evalPublish({
      companyStatus: "TRIAL",
      subscriptionStatus: "TRIALING",
      trialEndsAt: new Date(Date.now() - 1000),
      graceEndsAt: null,
      periodEnd: null,
    });
    expect(result.allowed).toBe(false);
    expect(result.reason).toMatch(/Trial expired/i);
  });

  it("allows grace window", () => {
    expect(
      evalPublish({
        companyStatus: "ACTIVE",
        subscriptionStatus: "PAST_DUE",
        trialEndsAt: null,
        graceEndsAt: new Date(Date.now() + 86400000),
        periodEnd: null,
      }).allowed,
    ).toBe(true);
  });
});
