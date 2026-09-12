import type { Enums } from '@samudaya/supabase';
import {
  INVOICE_STATUS_LABEL,
  REQUEST_PRIORITY_LABEL,
  REQUEST_STATUS_LABEL,
  VISITOR_STATUS_LABEL,
} from '@samudaya/core';
import { Badge, type Tone } from './ui/badge';

const REQUEST_TONES: Record<Enums<'request_status'>, Tone> = {
  open: 'warning',
  acknowledged: 'info',
  in_progress: 'info',
  resolved: 'success',
  closed: 'neutral',
  rejected: 'danger',
};

const PRIORITY_TONES: Record<Enums<'request_priority'>, Tone> = {
  low: 'neutral',
  normal: 'neutral',
  high: 'warning',
  urgent: 'danger',
};

const VISITOR_TONES: Record<Enums<'visitor_status'>, Tone> = {
  expected: 'info',
  arrived: 'success',
  departed: 'neutral',
  denied: 'danger',
  expired: 'neutral',
  cancelled: 'neutral',
};

const INVOICE_TONES: Record<Enums<'invoice_status'>, Tone> = {
  draft: 'neutral',
  issued: 'info',
  partly_paid: 'warning',
  paid: 'success',
  overdue: 'danger',
  void: 'neutral',
};

export const RequestStatusBadge = ({ status }: { status: Enums<'request_status'> }) => (
  <Badge tone={REQUEST_TONES[status]}>{REQUEST_STATUS_LABEL[status]}</Badge>
);

export const PriorityBadge = ({ priority }: { priority: Enums<'request_priority'> }) =>
  // Normal is the default; a badge for it would be noise on every row.
  priority === 'normal' || priority === 'low' ? null : (
    <Badge tone={PRIORITY_TONES[priority]}>{REQUEST_PRIORITY_LABEL[priority]}</Badge>
  );

export const VisitorStatusBadge = ({ status }: { status: Enums<'visitor_status'> }) => (
  <Badge tone={VISITOR_TONES[status]}>{VISITOR_STATUS_LABEL[status]}</Badge>
);

export const InvoiceStatusBadge = ({ status }: { status: Enums<'invoice_status'> }) => (
  <Badge tone={INVOICE_TONES[status]}>{INVOICE_STATUS_LABEL[status]}</Badge>
);
