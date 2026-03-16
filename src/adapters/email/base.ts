export interface EmailAdapter {
  /** Sends an OTP code for password reset. */
  sendOtp(to: string, otp: string): Promise<void>;

  /** Sends an email verification link. */
  sendVerification(to: string, url: string): Promise<void>;

  /** Returns true if the email service is reachable. */
  checkStatus(): Promise<boolean>;
}
