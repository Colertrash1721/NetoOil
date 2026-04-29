import logging
import os
import smtplib
from email.message import EmailMessage

logger = logging.getLogger(__name__)


def _smtp_configured() -> bool:
    return all(
        os.getenv(name)
        for name in ("SMTP_HOST", "SMTP_PORT", "SMTP_USER", "SMTP_PASS", "SMTP_FROM")
    )


def send_email(to_email: str | None, subject: str, body: str) -> bool:
    if not to_email or not _smtp_configured():
        return False

    message = EmailMessage()
    message["From"] = os.getenv("SMTP_FROM", "")
    message["To"] = to_email
    message["Subject"] = subject
    message.set_content(body)

    try:
        with smtplib.SMTP(os.getenv("SMTP_HOST", ""), int(os.getenv("SMTP_PORT", "587"))) as smtp:
            smtp.starttls()
            smtp.login(os.getenv("SMTP_USER", ""), os.getenv("SMTP_PASS", ""))
            smtp.send_message(message)
        return True
    except Exception:
        logger.exception("Unable to send alert email to %s", to_email)
        return False
