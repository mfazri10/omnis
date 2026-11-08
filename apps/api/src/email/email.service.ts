import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import nodemailer from "nodemailer";
import type { Transporter } from "nodemailer";
import type { EmailSender } from "../auth/better-auth";

@Injectable()
export class EmailService {
  private readonly transporter: Transporter | null;
  private readonly from: string;

  constructor(config: ConfigService) {
    const host = config.get<string>("SMTP_HOST");
    const user = config.get<string>("SMTP_USER");
    const pass = config.get<string>("SMTP_PASS");
    this.transporter = host
      ? nodemailer.createTransport({
          host,
          port: config.get<number>("SMTP_PORT", 587),
          secure: config.get<string>("SMTP_SECURE", "false") === "true",
          auth: user && pass ? { user, pass } : undefined,
        })
      : null;
    this.from = config.get<string>("SMTP_FROM", "noreply@localhost");
  }

  asSender(): EmailSender {
    return (to, subject, html, text) => this.send(to, subject, html, text);
  }

  async send(
    to: string,
    subject: string,
    html: string,
    text: string,
  ): Promise<void> {
    if (!this.transporter) {
      console.log(`[email-stub] To: ${to}\nSubject: ${subject}\n\n${text}`);
      return;
    }
    await this.transporter.sendMail({
      from: this.from,
      to,
      subject,
      html,
      text,
    });
  }
}
