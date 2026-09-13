/**
 * Words the product uses, in one place, so the website and the app say the
 * same thing. Plain English for residents first; no internal terms.
 */

export const COPY = {
  todo: 'To do',
  manage: 'Manage',
  money: 'Money',
  households: 'Households',
  societyCode: 'Society code',
  societySettings: 'Society settings',
  upiReference: 'UPI transaction ID (12 digits)',
  upiReferenceHint:
    'In your UPI app, open the payment and copy the 12-digit UPI transaction ID (also called UTR or UPI Ref No).',
  saveForLater: 'Save for later',
  publish: 'Publish',
  publishHint:
    'Publishing shows the event to every resident. Save for later keeps it visible only to staff and the committee.',
  moreOptions: 'More options',
  moreDetails: 'More details',
} as const;

export type TodoKind =
  | 'join_request'
  | 'payment_to_confirm'
  | 'bill_to_approve'
  | 'bill_sent_back'
  | 'campaign_to_review'
  | 'suggestion_to_review';

/** Section headings and action labels for the To do queue. */
export const TODO_KIND: Record<TodoKind, { section: string; action: string; emoji: string }> = {
  join_request: { section: 'New residents', action: 'Review', emoji: '🙋' },
  payment_to_confirm: { section: 'Payments to confirm', action: 'Confirm', emoji: '💰' },
  bill_to_approve: { section: 'Bills to approve', action: 'Approve', emoji: '🧾' },
  bill_sent_back: { section: 'Your bills sent back', action: 'Fix', emoji: '↩️' },
  campaign_to_review: { section: 'Campaigns to review', action: 'Review', emoji: '📣' },
  suggestion_to_review: { section: 'Suggestions to review', action: 'Review', emoji: '💡' },
};

export const TODO_ORDER: TodoKind[] = [
  'payment_to_confirm',
  'join_request',
  'bill_to_approve',
  'bill_sent_back',
  'campaign_to_review',
  'suggestion_to_review',
];

/** The event page's tabs, in order. */
export const EVENT_TABS = [
  { id: 'about', label: 'About' },
  { id: 'money', label: 'Money' },
  { id: 'activities', label: 'Activities' },
  { id: 'vote', label: 'Vote' },
] as const;
export type EventTab = (typeof EVENT_TABS)[number]['id'];

/** Default fund rule when the organiser doesn't open "More options". */
export const DEFAULT_FUND_RULE = 'general_fund' as const;

/** Generated web address for an event, e.g. "Deepavali 2026" → "deepavali-2026". */
export function eventSlug(name: string, suffix?: string): string {
  const base =
    name
      .toLowerCase()
      .normalize('NFKD')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 50) || 'event';
  return suffix ? `${base}-${suffix}`.slice(0, 60) : base;
}
