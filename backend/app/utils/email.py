import logging
import asyncio
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from app.config import settings

logger = logging.getLogger("wonderai")

def _send_smtp_sync(email: str, subject: str, body_plain: str, body_html: str) -> bool:
    try:
        sender_email = settings.SMTP_FROM or settings.SMTP_USER
        msg = MIMEMultipart("alternative")
        msg["Subject"] = subject
        msg["From"] = sender_email
        msg["To"] = email
        
        msg.attach(MIMEText(body_plain, "plain"))
        msg.attach(MIMEText(body_html, "html"))
        
        port = int(settings.SMTP_PORT or 587)
        host = settings.SMTP_HOST or "smtp.gmail.com"
        
        if port == 465:
            server = smtplib.SMTP_SSL(host, port, timeout=12)
        else:
            server = smtplib.SMTP(host, port, timeout=12)
            server.ehlo()
            if settings.SMTP_USE_TLS:
                server.starttls()
                server.ehlo()
            
        if settings.SMTP_USER and settings.SMTP_PASSWORD:
            server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
            
        server.sendmail(sender_email, [email], msg.as_string())
        server.quit()
        logger.info(f"✉️ SMTP email successfully sent to {email}")
        return True
    except Exception as e:
        logger.error(f"❌ Failed to send SMTP email to {email}: {e}")
        return False

async def send_otp_email(email: str, otp: str, purpose: str) -> bool:
    """
    Sends OTP email using SMTP if configured, or falls back to mock console output.
    purpose: 'register', 'reset_password', or 'login'
    """
    if purpose == "register":
        action = "Registration Verification"
    elif purpose == "reset_password":
        action = "Password Reset"
    else:
        action = "Two-Factor Authentication (Login)"
        
    subject = f"Wonder AI - {action} Code: {otp}"
    
    email_plain = f"""Hello,

Your Wonder AI 6-digit verification code for {action} is: {otp}

This code will expire in 10 minutes. If you did not request this code, please ignore this email.

Best regards,
Wonder AI Team
"""

    email_html = f"""<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <style>
        body {{ font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #0c0c0c; color: #ececec; margin: 0; padding: 20px; }}
        .container {{ max-width: 500px; margin: 20px auto; background: #161616; border: 1px solid rgba(255,255,255,0.1); border-radius: 16px; padding: 32px; box-shadow: 0 10px 30px rgba(0,0,0,0.5); }}
        .logo {{ font-size: 24px; font-weight: 800; color: #d4845e; text-align: center; margin-bottom: 24px; letter-spacing: -0.5px; }}
        .title {{ font-size: 18px; font-weight: 600; text-align: center; margin-bottom: 12px; color: #ffffff; }}
        .otp-box {{ background: #232326; border: 1px dashed #d4845e; border-radius: 12px; padding: 16px; text-align: center; margin: 24px 0; }}
        .otp-code {{ font-size: 36px; font-weight: 800; letter-spacing: 8px; color: #d4845e; font-family: monospace; }}
        .text {{ font-size: 14px; color: #a0a0a0; line-height: 1.6; text-align: center; }}
        .footer {{ font-size: 12px; color: #666666; text-align: center; margin-top: 24px; border-top: 1px solid rgba(255,255,255,0.05); padding-top: 16px; }}
    </style>
</head>
<body>
    <div class="container">
        <div class="logo">⚡ Wonder AI</div>
        <div class="title">{action} Code</div>
        <p class="text">Use the 6-digit verification code below to complete your process:</p>
        <div class="otp-box">
            <div class="otp-code">{otp}</div>
        </div>
        <p class="text">This code will expire in <strong>10 minutes</strong>.<br>If you did not request this code, please ignore this email.</p>
        <div class="footer">
            &copy; 2026 Wonder AI. All rights reserved.
        </div>
    </div>
</body>
</html>
"""
    
    # If SMTP is configured, attempt real email delivery asynchronously
    if settings.SMTP_HOST and settings.SMTP_USER:
        success = await asyncio.to_thread(_send_smtp_sync, email, subject, email_plain, email_html)
        if success:
            return True
            
    # Mock / Fallback output
    mock_log = f"""
    ====================================================
    MOCK EMAIL SENT TO: {email}
    SUBJECT: {subject}
    ====================================================
    Your 6-digit verification code is: {otp}
    
    This code will expire in 10 minutes.
    ====================================================
    """
    print(mock_log)
    logger.info(f"Mock OTP email displayed for {email} ({purpose})")
    return True


