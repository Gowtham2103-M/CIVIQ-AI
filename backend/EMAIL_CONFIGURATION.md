# Email Configuration Guide for CivicGuard

## Gmail Configuration (Recommended)

### Step 1: Set Up Gmail App Password

1. Go to [Google Account Security](https://myaccount.google.com/security)
2. Enable 2-Step Verification (if not already enabled)
3. Go back to Security settings
4. Scroll down to "App passwords"
5. Select "Mail" and "Windows Computer" (or your device)
6. Google will generate a 16-character password - copy it

### Step 2: Update .env File

Replace the placeholders in `backend/.env`:

```env
MAIL_SERVER=smtp.gmail.com
MAIL_PORT=587
MAIL_USE_TLS=True
MAIL_USERNAME=your-real-email@gmail.com
MAIL_PASSWORD=xxxx xxxx xxxx xxxx
```

**Important**: Use the 16-character password Google provided (spaces can be ignored)

### Step 3: Test Email Configuration

Run this test script to verify email is working:

```bash
cd backend
python -c "
from app import app, mail
from flask_mail import Message

with app.app_context():
    msg = Message(
        subject='Test Email',
        sender=app.config['MAIL_USERNAME'],
        recipients=['your-email@gmail.com']
    )
    msg.body = 'If you see this, email is configured correctly!'
    mail.send(msg)
    print('✅ Test email sent successfully!')
"
```

### Step 4: Restart Backend Server

After updating .env, restart the Flask backend:

```bash
# If using python
python app.py

# Or if using Flask CLI
flask run
```

## Troubleshooting

### Issue: "Email not configured"
- Check that MAIL_USERNAME does not contain "your_email"
- Check that MAIL_PASSWORD does not contain "your_gmail_app_password"
- Restart the backend server after updating .env

### Issue: "530 5.7.0 Must issue a STARTTLS command"
- Ensure `MAIL_USE_TLS=True` is set in .env
- This enables encryption for Gmail SMTP

### Issue: "535 5.7.8 Username and Password not accepted"
- You're using the wrong password
- Use the 16-character App Password from Google (not your regular password)
- Gmail blocks regular passwords for 3rd party apps for security

### Issue: "Connection timed out"
- Check firewall settings
- Try port 465 instead of 587 (requires MAIL_USE_TLS=False)
- Check internet connection

### View Email Logs

The backend logs will show:
- ✅ OTP email sent successfully to: user@example.com
- ⚠️ Email credentials are not properly configured

Check the terminal output after requesting password reset.

## Alternative Email Services

### Outlook/Hotmail SMTP:
```env
MAIL_SERVER=smtp-mail.outlook.com
MAIL_PORT=587
MAIL_USE_TLS=True
MAIL_USERNAME=your-email@outlook.com
MAIL_PASSWORD=your-password
```

### Office 365:
```env
MAIL_SERVER=smtp.office365.com
MAIL_PORT=587
MAIL_USE_TLS=True
MAIL_USERNAME=your-email@company.onmicrosoft.com
MAIL_PASSWORD=your-password
```

## Security Notes

- Never commit `.env` file to git
- Never share your App Password
- If compromised, regenerate App Password in Google Account Settings
- Use different email addresses for development and production
