/**
 * Notification Service
 * Handles sending email and SMS notifications to voters
 * 
 * This is a stub implementation - in production, integrate with:
 * - Email: SendGrid, Mailgun, AWS SES
 * - SMS: Twilio, AWS SNS
 */

export interface NotificationPayload {
  recipientEmail: string;
  recipientPhone?: string;
  recipientName: string;
  channel: "email" | "sms" | "both";
  electionName: string;
  winner?: string;
  resultsUrl: string;
  timestamp: Date;
}

export class NotificationService {
  /**
   * Send email notification
   */
  static async sendEmail(payload: NotificationPayload): Promise<{ success: boolean; messageId?: string; error?: string }> {
    try {
      // Stub implementation - replace with actual email service
      console.log(`[EMAIL] Sending notification to ${payload.recipientEmail}`);
      console.log(`Subject: Results for ${payload.electionName}`);
      console.log(`Winner: ${payload.winner}`);
      console.log(`View Results: ${payload.resultsUrl}`);

      // In production, integrate with SendGrid:
      // const sgMail = require("@sendgrid/mail");
      // sgMail.setApiKey(process.env.SENDGRID_API_KEY);
      // const msg = {
      //   to: payload.recipientEmail,
      //   from: process.env.SENDER_EMAIL,
      //   subject: `Results: ${payload.electionName}`,
      //   html: this.generateEmailHTML(payload),
      // };
      // const [result] = await sgMail.send(msg);
      // return { success: true, messageId: result.headers["x-message-id"] };

      return { success: true, messageId: "stub-email-id" };
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : "Unknown error",
      };
    }
  }

  /**
   * Send SMS notification
   */
  static async sendSMS(payload: NotificationPayload): Promise<{ success: boolean; messageId?: string; error?: string }> {
    try {
      if (!payload.recipientPhone) {
        throw new Error("Phone number is required for SMS");
      }

      // Stub implementation - replace with actual SMS service
      console.log(`[SMS] Sending notification to ${payload.recipientPhone}`);
      console.log(`${payload.electionName}: Winner is ${payload.winner}. View results: ${payload.resultsUrl}`);

      // In production, integrate with Twilio:
      // const twilio = require("twilio");
      // const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
      // const message = await client.messages.create({
      //   body: this.generateSMSText(payload),
      //   from: process.env.TWILIO_PHONE_NUMBER,
      //   to: payload.recipientPhone,
      // });
      // return { success: true, messageId: message.sid };

      return { success: true, messageId: "stub-sms-id" };
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : "Unknown error",
      };
    }
  }

  /**
   * Send notification via preferred channel
   */
  static async send(payload: NotificationPayload): Promise<void> {
    if (payload.channel === "email" || payload.channel === "both") {
      await this.sendEmail(payload);
    }
    if ((payload.channel === "sms" || payload.channel === "both") && payload.recipientPhone) {
      await this.sendSMS(payload);
    }
  }

  /**
   * Generate HTML email content
   */
  private static generateEmailHTML(payload: NotificationPayload): string {
    return `
      <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background-color: #007bff; color: white; padding: 20px; text-align: center; }
            .content { padding: 20px; }
            .winner { font-size: 24px; color: #28a745; font-weight: bold; }
            .button { display: inline-block; background-color: #007bff; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>${payload.electionName} Results</h1>
            </div>
            <div class="content">
              <p>Dear ${payload.recipientName},</p>
              <p>The ${payload.electionName} has concluded. Here are the results:</p>
              <p class="winner">Winner: ${payload.winner || "Results available"}</p>
              <p><a href="${payload.resultsUrl}" class="button">View Full Results</a></p>
              <p>Thank you for participating!</p>
              <p>Sent at: ${payload.timestamp.toLocaleString()}</p>
            </div>
          </div>
        </body>
      </html>
    `;
  }

  /**
   * Generate SMS text
   */
  private static generateSMSText(payload: NotificationPayload): string {
    return `${payload.electionName} Results: ${payload.winner || "View results"}. ${payload.resultsUrl}`;
  }
}
