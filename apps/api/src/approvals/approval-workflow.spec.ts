import {
  autoScheduleOnFinalApproval,
  nextStep,
  requiredSteps,
} from "./approval-workflow";

describe("approval-workflow", () => {
  it("maps workflow A to client only", () => {
    expect(requiredSteps("CLIENT_THEN_PUBLISH")).toEqual(["CLIENT"]);
    expect(nextStep("CLIENT_THEN_PUBLISH", ["CLIENT"])).toBeNull();
  });

  it("maps workflow C to client then company", () => {
    expect(requiredSteps("CLIENT_THEN_COMPANY")).toEqual(["CLIENT", "COMPANY"]);
    expect(nextStep("CLIENT_THEN_COMPANY", ["CLIENT"])).toBe("COMPANY");
    expect(nextStep("CLIENT_THEN_COMPANY", ["CLIENT", "COMPANY"])).toBeNull();
  });

  it("flags auto-schedule workflow", () => {
    expect(autoScheduleOnFinalApproval("CLIENT_THEN_AUTO_SCHEDULE")).toBe(true);
    expect(autoScheduleOnFinalApproval("CLIENT_THEN_PUBLISH")).toBe(false);
  });
});
