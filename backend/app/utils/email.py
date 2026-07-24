import logging
import asyncio
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from app.config import settings

logger = logging.getLogger("wonderai")

def _send_smtp_sync(email: str, subject: str, body: str) -> bool:
    try:
        msg = MIMEMultipart("alternative")
        msg["Subject"] = subject
        msg["From"] = settings.SMTP_FROM or settings.SMTP_USER
        msg["To"] = email
        
        part = MIMEText(body, "plain")
        msg.attach(part)
        
        if settings.SMTP_USE_TLS:
            server = smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT, timeout=10)
            server.starttls()
        else:
            server = smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT, timeout=10)
            
        if settings.SMTP_USER and settings.SMTP_PASSWORD:
            server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
            
        server.sendmail(msg["From"], [email], msg.as_string())
        server.quit()
        logger.info(f"SMTP email successfully sent to {email}")
        return True
    except Exception as e:
        logger.error(f"Failed to send SMTP email to {email}: {e}")
        return False

async def send_otp_email(email: str, otp: str, purpose: str) -> bool:
    """
    Sends OTP email using SMTP if configured, or falls back to mock console output.
    purpose: 'register' or 'login'
    """
    if purpose == "register":
        action = "Registration Verification"
    elif purpose == "reset_password":
        action = "Password Reset"
    else:
        action = "Two-Factor Authentication (Login)"
        
    subject = f"Wonder AI - {action} Code"
    
    email_body = f"""Hello,

Your Wonder AI 6-digit verification code is: {otp}

This code will expire in 10 minutes. If you did not request this code, please ignore this email.

Best regards,
Wonder AI Team
"""
    
    # If SMTP is configured, attempt real email delivery asynchronously
    if settings.SMTP_HOST and settings.SMTP_USER:
        success = await asyncio.to_thread(_send_smtp_sync, email, subject, email_body)
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

