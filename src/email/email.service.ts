import { Injectable, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import { ConfigService } from '@nestjs/config';
import { Config } from '../config';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private transporter: nodemailer.Transporter;
  private mailConfig: Config['mail'];
  private clientUrl: string;

  constructor(private configService: ConfigService<Config>) {
    this.mailConfig = this.configService.get('mail')!;
    this.clientUrl = this.configService.get('clientUrl')!;

    this.transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: this.mailConfig.user,
        pass: this.mailConfig.pass,
      },
    });
  }

  async sendPasswordResetEmail(email: string, token: string) {
    const resetLink = `${this.clientUrl}/reset-password?token=${token}`;

    const mailOptions = {
      from: `"No Reply" <${this.mailConfig.from}>`,
      to: email,
      subject: 'Password Reset Request',
      html: `
        <p>Hello!</p>
        <p>We received a request to reset your password.</p>
        <p>Click the link below to reset your password:</p>
        <a href="${resetLink}">${resetLink}</a>
        <p>If you did not request a password reset, please ignore this email.</p>
      `,
    };

    try {
      const info = await this.transporter.sendMail(mailOptions);
      this.logger.log(
        `Password reset email sent to ${email}. Message ID: ${info.messageId}`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to send password reset email to ${email}`,
        error.stack,
      );
      // It's better to not throw an error to the user, to prevent email enumeration attacks.
      // We just log it internally.
    }
  }
}
