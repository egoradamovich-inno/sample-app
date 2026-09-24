import { apiClient } from '../client'
import type { ApprovalStatus, PaymentType } from '../../types/api'

export interface PurchaseApproval {
  id: string
  childProfileId: string
  childName: string
  // Included so the UI can defend-in-depth: only render Approve/Deny when this
  // matches the caller's own id, even though the list endpoint is already
  // parent-scoped server-side (GET /purchase-approvals, api-designer-spec.md).
  parentUserId: string
  eventOrPurchaseRef: string
  amount: number
  paymentType: PaymentType
  status: ApprovalStatus
  isExpired: boolean
  requestedAt: string
  expiresAt: string
}

export const purchaseApprovalsApi = {
  list: (): Promise<PurchaseApproval[]> => apiClient.get<PurchaseApproval[]>('/purchase-approvals').then((res) => res.data),

  approve: (id: string): Promise<PurchaseApproval> =>
    apiClient.post<PurchaseApproval>(`/purchase-approvals/${id}/approve`).then((res) => res.data),

  deny: (id: string, parentNotes?: string): Promise<PurchaseApproval> =>
    apiClient.post<PurchaseApproval>(`/purchase-approvals/${id}/deny`, { parentNotes }).then((res) => res.data),
}
