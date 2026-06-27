import { Resend } from "resend";
import {
  inviteEmailHtml,
  inviteEmailText,
  roleChangedEmailHtml,
  roleChangedEmailText,
} from "./email-templates";

// Lazy-init so the module doesn't crash at import if RESEND_API_KEY is missing
let _resend: Resend | null = null;

function getResend(): Resend | null {
  const key = process.env.RESEND_API_KEY;
  if (!key) return null;
  if (!_resend) _resend = new Resend(key);
  return _resend;
}

const FROM_ADDRESS =
  process.env.EMAIL_FROM ?? "DocEditor <noreply@yourdomain.com>";

/**
 * Send the email via Resend.
 * Silently logs a warning and returns when RESEND_API_KEY is not set
 * so the rest of the API call still succeeds.
 */
async function send(payload: {
  to: string;
  subject: string;
  html: string;
  text: string;
}): Promise<void> {
  const resend = getResend();
  if (!resend) {
    console.warn(
      "[email] RESEND_API_KEY not configured — skipping email to",
      payload.to,
    );
    return;
  }

  const { error } = await resend.emails.send({
    from: FROM_ADDRESS,
    to: payload.to,
    subject: payload.subject,
    html: payload.html,
    text: payload.text,
  });

  if (error) {
    // Non-fatal — log the error but don't throw so the API still returns 201
    console.error("[email] Failed to send to", payload.to, error);
  }
}

/* ────────────────────────────────────────────────────────── */

/**
 * Notify a newly-invited collaborator.
 */
export async function sendInviteEmail(options: {
  to: string;
  recipientName: string;
  inviterName: string;
  documentTitle: string;
  documentId: string;
  role: string;
}): Promise<void> {
  await send({
    to: options.to,
    subject: `${options.inviterName} invited you to "${options.documentTitle}"`,
    html: inviteEmailHtml(options),
    text: inviteEmailText(options),
  });
}

/**
 * Notify an existing member that their role was changed.
 */
export async function sendRoleChangedEmail(options: {
  to: string;
  recipientName: string;
  changedByName: string;
  documentTitle: string;
  documentId: string;
  oldRole: string;
  newRole: string;
}): Promise<void> {
  await send({
    to: options.to,
    subject: `Your role on "${options.documentTitle}" has changed`,
    html: roleChangedEmailHtml(options),
    text: roleChangedEmailText(options),
  });
}
