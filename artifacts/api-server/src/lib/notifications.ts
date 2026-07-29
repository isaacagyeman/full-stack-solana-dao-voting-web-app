/**
 * Notification Service
 * Handles sending email and SMS notifications to voters.
 *
 * Configure these environment variables to enable real delivery:
 *   EMAIL_PROVIDER=sendgrid|smtp|resend
 *   SENDGRID_API_KEY=...
 *   SENDER_EMAIL=noreply@yourapp.com
 *   SMS_PROVIDER=twilio
 *   TWILIO_ACCOUNT_SID=...
 *   TWILIO_AUTH_TOKEN=...
 *   TWILIO_PHONE_NUMBER=+1...
 *
 * Until configured, all sends are logged to console only.
 */

export interface VoterTokenPayload {
  recipientEmail: string;
  recipientPhone?: string;
  recipientName: string;
  orgName: string;
  electionTitle: string;
  orgAccessCode: string;
  voterToken: string;
}

export interface ResultsNotificationPayload {
  recipientEmail: string;
  recipientPhone?: string;
  recipientName: string;
  electionName: string;
  winner?: string;
  resultsUrl: string;
  timestamp: Date;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

async function sendEmailViaSendGrid(to: string, subject: string, html: string): Promise<void> {
  const apiKey = process.env.SENDGRID_API_KEY;
  const from = process.env.SENDER_EMAIL;
  if (!apiKey || !from) return; // not configured
  const resp = await fetch("https://api.sendgrid.com/v3/mail/send", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      personalizations: [{ to: [{ email: to }] }],
      from: { email: from },
      subject,
      content: [{ type: "text/html", value: html }],
    }),
  });
  if (!resp.ok) {
    const err = await resp.text();
    throw new Error(`SendGrid error ${resp.status}: ${err}`);
  }
}

async function sendSMSViaTwilio(to: string, body: string): Promise<void> {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_PHONE_NUMBER;
  if (!sid || !token || !from) return; // not configured
  const resp = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
    method: "POST",
    headers: {
      Authorization: "Basic " + Buffer.from(`${sid}:${token}`).toString("base64"),
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({ To: to, From: from, Body: body }).toString(),
  });
  if (!resp.ok) {
    const err = await resp.text();
    throw new Error(`Twilio error ${resp.status}: ${err}`);
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export class NotificationService {
  /**
   * Send a voter's unique token to them via email and/or SMS when an election is published.
   */
  static async sendVoterToken(payload: VoterTokenPayload): Promise<{ email: boolean; sms: boolean }> {
    const subject = `Your voting token for "${payload.electionTitle}"`;
    const html = `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;padding:20px">
        <h2 style="color:#2563eb">You're invited to vote</h2>
        <p>Dear ${payload.recipientName},</p>
        <p>You have been invited to participate in the election: <strong>${payload.electionTitle}</strong> for <strong>${payload.orgName}</strong>.</p>
        <p>To cast your vote, you will need:</p>
        <table style="border:1px solid #e2e8f0;border-radius:8px;padding:16px;background:#f8fafc;width:100%">
          <tr><td style="padding:6px"><strong>Organisation Access Code:</strong></td><td style="padding:6px;font-family:monospace;font-size:16px;color:#1e40af">${payload.orgAccessCode}</td></tr>
          <tr><td style="padding:6px"><strong>Your Personal Voting Token:</strong></td><td style="padding:6px;font-family:monospace;font-size:14px;color:#7c3aed;word-break:break-all">${payload.voterToken}</td></tr>
        </table>
        <p style="color:#ef4444"><strong>Important:</strong> This token is unique to you. Do not share it. It can only be used once.</p>
        <p>Steps to vote:</p>
        <ol>
          <li>Create an account or sign in at the platform</li>
          <li>Enter the organisation access code to join</li>
          <li>Enter your personal voting token when prompted to cast your vote</li>
        </ol>
      </div>`;
    const smsText =
      `VoteChain: You're invited to vote in "${payload.electionTitle}". ` +
      `Org code: ${payload.orgAccessCode} | Your token: ${payload.voterToken}. Do NOT share your token.`;

    let emailSent = false;
    let smsSent = false;

    try {
      await sendEmailViaSendGrid(payload.recipientEmail, subject, html);
      emailSent = true;
    } catch (err) {
      console.log(`[EMAIL] Token to ${payload.recipientEmail} — ${(err as Error).message ?? "not configured"}`);
    }

    if (payload.recipientPhone) {
      try {
        await sendSMSViaTwilio(payload.recipientPhone, smsText);
        smsSent = true;
      } catch (err) {
        console.log(`[SMS] Token to ${payload.recipientPhone} — ${(err as Error).message ?? "not configured"}`);
      }
    }

    // Always log to console for development visibility
    console.log(`[NOTIFY] Voter token dispatched to ${payload.recipientName} (${payload.recipientEmail}): ${payload.voterToken}`);

    return { email: emailSent, sms: smsSent };
  }

  /**
   * Notify a member that election results are available.
   */
  static async sendResultsNotification(
    payload: ResultsNotificationPayload
  ): Promise<{ success: boolean; error?: string }> {
    const subject = `Results: ${payload.electionName}`;
    const html = `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;padding:20px">
        <h2 style="color:#2563eb">Election Results</h2>
        <p>Dear ${payload.recipientName},</p>
        <p>The election <strong>${payload.electionName}</strong> has concluded.</p>
        ${payload.winner ? `<p style="font-size:18px;color:#16a34a"><strong>Winner: ${payload.winner}</strong></p>` : ""}
        <p><a href="${payload.resultsUrl}" style="background:#2563eb;color:white;padding:10px 20px;border-radius:6px;text-decoration:none">View Full Results</a></p>
        <p style="color:#64748b;font-size:12px">Sent at ${payload.timestamp.toLocaleString()}</p>
      </div>`;
    const smsText = `${payload.electionName} results are in${payload.winner ? `: Winner — ${payload.winner}` : ""}. View: ${payload.resultsUrl}`;

    try {
      await sendEmailViaSendGrid(payload.recipientEmail, subject, html);
    } catch (err) {
      console.log(`[EMAIL] Results to ${payload.recipientEmail}: ${(err as Error).message ?? "not configured"}`);
    }

    if (payload.recipientPhone) {
      try {
        await sendSMSViaTwilio(payload.recipientPhone, smsText);
      } catch (err) {
        console.log(`[SMS] Results to ${payload.recipientPhone}: ${(err as Error).message ?? "not configured"}`);
      }
    }

    console.log(`[NOTIFY] Results sent to ${payload.recipientName} (${payload.recipientEmail})`);
    return { success: true };
  }

  // Legacy: kept for backward compat
  static async send(payload: {
    recipientEmail: string;
    recipientPhone?: string;
    recipientName: string;
    channel: "email" | "sms" | "both";
    electionName: string;
    winner?: string;
    resultsUrl: string;
    timestamp: Date;
  }): Promise<void> {
    await this.sendResultsNotification({
      recipientEmail: payload.recipientEmail,
      recipientPhone: payload.recipientPhone,
      recipientName: payload.recipientName,
      electionName: payload.electionName,
      winner: payload.winner,
      resultsUrl: payload.resultsUrl,
      timestamp: payload.timestamp,
    });
  }
}
