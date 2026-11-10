import { createWorkflow, WorkflowResponse } from "@medusajs/framework/workflows-sdk"
import { anonymizeCustomerStep, type AnonymizeCustomerInput } from "./steps/anonymize-customer"
import { refreshProductRatingStep } from "./steps/refresh-product-rating"

export const anonymizeCustomerWorkflowId = "reviews-anonymize-customer"

/** Runs when a customer is deleted (subscriber) or on demand from the Admin API. */
export const anonymizeCustomerWorkflow = createWorkflow(anonymizeCustomerWorkflowId, (input: AnonymizeCustomerInput) => {
  const result = anonymizeCustomerStep(input)
  refreshProductRatingStep({ product_ids: result.product_ids })
  return new WorkflowResponse(result)
})
