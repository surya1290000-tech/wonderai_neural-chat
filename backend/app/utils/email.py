"""
Email utility for sending OTPs.
This is currently mocked to print to the console for local testing.
To use fastapi-mail in production, you would configure ConnectionConfig here.
"""
import logging
from typing import Optional

logger = logging.getLogger("wonderai")

async def send_otp_email(email: str, otp: str, purpose: str) -> bool:
    """
    Mock email sender for OTPs.
    purpose: 'register' or 'login'
    """
    action = "Registration Verification" if purpose == "register" else "Two-Factor Authentication (Login)"
    
    email_body = f"""
    ====================================================
    MOCK EMAIL SENT TO: {email}
    SUBJECT: Wonder AI - {action} Code
    ====================================================
    Your 6-digit verification code is: {otp}
    
    This code will expire in 10 minutes.
    ====================================================
    """
    
    print(email_body)
    logger.info(f"Mock OTP email sent to {email} for {purpose}")
    
    return True
