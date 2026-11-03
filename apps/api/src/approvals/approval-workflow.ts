import { ApprovalStep, ApprovalWorkflow } from "@prisma/client";

export function requiredSteps(workflow: ApprovalWorkflow): ApprovalStep[] {
  switch (workflow) {
    case "COMPANY_THEN_PUBLISH":
      return ["COMPANY"];
    case "CLIENT_THEN_COMPANY":
      return ["CLIENT", "COMPANY"];
    case "CLIENT_THEN_PUBLISH":
    case "CLIENT_THEN_AUTO_SCHEDULE":
    default:
      return ["CLIENT"];
  }
}

export function nextStep(
  workflow: ApprovalWorkflow,
  completed: ApprovalStep[],
): ApprovalStep | null {
  const required = requiredSteps(workflow);
  for (const step of required) {
    if (!completed.includes(step)) return step;
  }
  return null;
}

export function autoScheduleOnFinalApproval(workflow: ApprovalWorkflow): boolean {
  return workflow === "CLIENT_THEN_AUTO_SCHEDULE";
}
