/**
 * Sundgren Realty Contact Form Handler
 * Cloudflare Pages Function — POST /submit
 * Sends email via Google Gmail API using KillerGrowth Service Account
 */

const JSON_HEADERS = { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' };

export async function onRequestPost({ request, env }) {
  try {
    const form = await request.formData();
    const name     = form.get('name')     || '';
    const email    = form.get('email')    || '';
    const phone    = form.get('phone')    || '';
    const interest = form.get('interest') || '';
    const message  = form.get('message')  || '';
    const token    = form.get('cf-turnstile-response') || '';

    // Validate required fields
    if (!name || !email || !message) {
      return new Response(JSON.stringify({ ok: false, error: 'Missing required fields.' }), { status: 400, headers: JSON_HEADERS });
    }

    // Cloudflare Turnstile verification
    const turnstileSecret = env.TURNSTILE_SECRET;
    if (turnstileSecret) {
      const verifyRes = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: `secret=${encodeURIComponent(turnstileSecret)}&response=${encodeURIComponent(token)}`,
      });
      const verifyData = await verifyRes.json();
      if (!verifyData.success) {
        return new Response(JSON.stringify({ ok: false, error: 'Bot check failed.' }), { status: 400, headers: JSON_HEADERS });
      }
    }

    // Build email
    const toEmail   = 'realty@sundgren.com';
    const fromEmail = 'openclaw-agent@killergrowth.iam.gserviceaccount.com';
    const subject   = `New Website Inquiry from ${name}`;
    const body = [
      `New contact form submission from sundgrenrealty.com`,
      ``,
      `Name:     ${name}`,
      `Email:    ${email}`,
      `Phone:    ${phone || 'Not provided'}`,
      `Interest: ${interest || 'Not specified'}`,
      ``,
      `Message:`,
      message,
      ``,
      `---`,
      `Sent from sundgrenrealty.com contact form`,
    ].join('\n');

    const mimeHeaders = [
      `To: ${toEmail}`,
      `From: Sundgren Realty Website <${fromEmail}>`,
      email ? `Reply-To: ${name} <${email}>` : '',
      `Subject: ${subject}`,
      `Content-Type: text/plain; charset=utf-8`,
      ``,
      body,
    ].filter(Boolean).join('\r\n');

    const encoded = btoa(unescape(encodeURIComponent(mimeHeaders)))
      .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

    // Get access token from service account
    const privateKeyPem = env.GOOGLE_SA_PRIVATE_KEY
      ? env.GOOGLE_SA_PRIVATE_KEY.replace(/\\n/g, '\n')
      : '';

    if (!privateKeyPem) {
      return new Response(JSON.stringify({ ok: false, error: 'Server configuration error.' }), { status: 500, headers: JSON_HEADERS });
    }

    const now    = Math.floor(Date.now() / 1000);
    const jwtHeader  = btoa(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
    const jwtPayload = btoa(JSON.stringify({
      iss:   'openclaw-agent@killergrowth.iam.gserviceaccount.com',
      sub:   'tylerbrickley@killergrowth.com',
      scope: 'https://www.googleapis.com/auth/gmail.send',
      aud:   'https://oauth2.googleapis.com/token',
      iat:   now,
      exp:   now + 3600,
    })).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');

    const sigInput = `${jwtHeader}.${jwtPayload}`;

    // Import key and sign
    const keyData = privateKeyPem
      .replace(/-----BEGIN PRIVATE KEY-----/, '')
      .replace(/-----END PRIVATE KEY-----/, '')
      .replace(/\s/g, '');
    const binaryKey = Uint8Array.from(atob(keyData), c => c.charCodeAt(0));
    const cryptoKey = await crypto.subtle.importKey(
      'pkcs8', binaryKey.buffer,
      { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
      false, ['sign']
    );
    const sigBytes = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', cryptoKey, new TextEncoder().encode(sigInput));
    const sig = btoa(String.fromCharCode(...new Uint8Array(sigBytes))).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
    const jwt = `${sigInput}.${sig}`;

    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=${jwt}`,
    });
    const tokenData = await tokenRes.json();
    if (!tokenData.access_token) {
      return new Response(JSON.stringify({ ok: false, error: 'Auth error.' }), { status: 500, headers: JSON_HEADERS });
    }

    // Send email
    const gmailRes = await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/messages/send`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${tokenData.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ raw: encoded }),
      }
    );

    if (!gmailRes.ok) {
      const errText = await gmailRes.text();
      console.error('Gmail send error:', errText);
      return new Response(JSON.stringify({ ok: false, error: 'Failed to send email.' }), { status: 500, headers: JSON_HEADERS });
    }

    return new Response(JSON.stringify({ ok: true }), { status: 200, headers: JSON_HEADERS });

  } catch (err) {
    console.error('submit.js error:', err);
    return new Response(JSON.stringify({ ok: false, error: 'Server error.' }), { status: 500, headers: JSON_HEADERS });
  }
}

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type' } });
}
