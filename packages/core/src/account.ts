/**
 * The vocabulary of deleting your account, shared by both apps.
 *
 * Both stores require this path to exist, so both apps have one, and they had
 * better agree about what happened: the web page and the phone screen call the
 * same function and read its answer through the sentences below. A deletion
 * that reads as a refusal on one surface and a success on the other is worse
 * than either.
 */

/** The statuses public.delete_my_account() can return. */
export type DeleteAccountStatus = 'deleted' | 'last_committee' | 'unauthenticated';

/** Exactly one status means the account is gone. Anything else does not. */
export function isAccountDeleted(status: string): boolean {
  return status === 'deleted';
}

/**
 * What to tell somebody, given the status and whatever detail came with it.
 *
 * `last_committee` carries the societies that are holding them, because being
 * told "no" without being told what to do about it is how a deletion request
 * turns into a support email.
 */
export function deleteAccountMessage(status: string, detail?: string | null): string {
  switch (status as DeleteAccountStatus) {
    case 'deleted':
      return 'Your account has been deleted.';
    case 'last_committee':
      return detail
        ? `You are the last committee member of ${detail}. Make somebody else a committee member first, then delete your account.`
        : 'You are the last committee member of a society that still has members. Make somebody else a committee member first.';
    case 'unauthenticated':
      return 'Please sign in first.';
    default:
      return 'We could not delete your account. Please try again.';
  }
}

/**
 * What deletion does, in the order it matters to the person doing it.
 *
 * Kept here rather than written twice, because these lines are also the
 * Privacy Policy's promise and the Play Data Safety answer. Three copies of a
 * promise drift; one does not.
 */
export const DELETE_ACCOUNT_EFFECTS = [
  'Your profile, phone number and photo.',
  'Your membership of every society, your flat, and your join requests.',
  'Your votes, activity sign-ups, volunteer roles and suggestions.',
  'Your notifications, your WhatsApp link and your push notification tokens.',
] as const;

export const DELETE_ACCOUNT_KEPT = [
  'Contributions you made and bills you filed stay in the society ledger, with your name removed — a society’s accounts have to keep adding up after somebody leaves.',
  'A contribution can still show the flat it was made for.',
] as const;

/** The typed confirmation, so nobody deletes their account by mis-tapping. */
export const DELETE_ACCOUNT_CONFIRMATION = 'DELETE';

export function isDeleteConfirmed(typed: string): boolean {
  return typed.trim().toUpperCase() === DELETE_ACCOUNT_CONFIRMATION;
}
