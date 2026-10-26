
const nodemailer = require('nodemailer');

if (!process.env.GMAIL_USER || !process.env.GMAIL_APP_PASSWORD) {
  throw new Error('Gmail SMTP credentials are not configured');
}

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_APP_PASSWORD
  }
});

const sendEmail = async ({ to, subject, html }) => {
  if (!to || !subject || !html) {
    throw new Error('Recipient, subject and email content are required');
  }

  const result = await transporter.sendMail({
    from: `BallotTrust <${process.env.GMAIL_USER}>`,
    to,
    subject,
    html
  });

  return {
    messageId: result.messageId
  };
};

module.exports = { sendEmail };
