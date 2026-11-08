export type JobStatus =
  | 'accepted'
  | 'processing'
  | 'needs_review'
  | 'completed'
  | 'failed'
  | 'approved'
  | 'rejected'

export interface Extraction {
  request_type: string
  customer_name: string | null
  shipment_reference: string | null
  container_number: string | null
  origin: string | null
  destination: string | null
  cargo_description: string | null
  etd: string | null
  eta: string | null
  summary: string | null
}

export interface ValidationInfo {
  review_required: boolean
  missing_fields: string[]
  reasons: string[]
}

export interface ReviewInfo {
  review_id: string
  decision: 'approved' | 'rejected'
  corrections: Partial<Extraction>
  review_note: string | null
  reviewed_at: string
}

export interface JobRecord {
  record_id: string
  job_id: string
  request_type: string
  review_required: boolean
  extracted: Extraction
  /** Extracted values with approved reviewer corrections applied. */
  final: Extraction
  validation: ValidationInfo
  review: ReviewInfo | null
}

export interface Job {
  job_id: string
  email_id: string
  source: string
  status: JobStatus
  created_at: string
  updated_at: string
  error_code: string | null
  error_message: string | null
  record: JobRecord | null
}

export interface ReviewQueueItem {
  record_id: string
  job_id: string
  request_type: string
  created_at: string
  email_id: string
  extracted: Extraction
  validation: ValidationInfo
}

export interface ReviewDecisionPayload {
  record_id: string
  job_id: string
  decision: 'approved' | 'rejected'
  corrections: Partial<Extraction>
  review_note: string | null
}

export interface Metrics {
  total_jobs: number
  completed_without_review: number
  awaiting_review: number
  reviewed_approved: number
  reviewed_rejected: number
  failed: number
  in_progress: number
  classification_breakdown: Record<string, number>
  avg_processing_seconds: number | null
  duplicate_submissions: number
  /** Share of processed jobs needing no human review. This is NOT AI accuracy. */
  straight_through_rate: number | null
  human_review_rate: number | null
}

export interface RecordListItem {
  record_id: string
  job_id: string
  request_type: string
  review_required: boolean
  created_at: string
  status: JobStatus
  email_id: string
  source: string
  extracted: Extraction
  validation: ValidationInfo
}

export interface RecordList {
  total: number
  limit: number
  offset: number
  items: RecordListItem[]
}

export interface SubmitEmailPayload {
  job_id: string
  email_id: string
  source: 'dashboard'
  sender: string
  subject: string
  body: string
  received_at: string
  file?: File | null
}

