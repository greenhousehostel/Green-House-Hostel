// Cloudflare Pages Function: POST /api/auth/login
export async function onRequestPost(context) {
    try {
        const body = await context.request.json();
        const email = (body.email || '').trim().toLowerCase();
        const pass = String(body.password || '');

        const ADMIN_EMAIL = 'greenhouse5014@gmail.com';
        const ADMIN_PASS = '957995xvi16';

        // Salted SHA256 check matching server.ps1
        const SALT = 'GHH_SECURE_SALT_v2_2026';
        const raw = `${SALT}:${email}:${pass}`;
        const encoder = new TextEncoder();
        const data = encoder.encode(raw);
        const hashBuffer = await crypto.subtle.digest('SHA-256', data);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

        const ADMIN_HASH = '19f10bfeea8e23f5260c860c5eb0824df0869bff7c17e55c35cdd62b0a8653ef';

        if (email === ADMIN_EMAIL && (pass === ADMIN_PASS || hashHex === ADMIN_HASH)) {
            const token = 'cf_tok_' + crypto.randomUUID();
            return new Response(JSON.stringify({
                success: true,
                token: token,
                user: {
                    id: 'usr_admin_1',
                    name: 'Green House Administrator',
                    email: ADMIN_EMAIL,
                    phone: '+880 1703-585853',
                    role: 'admin'
                }
            }), {
                status: 200,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        return new Response(JSON.stringify({
            success: false,
            message: 'Invalid email or password.'
        }), {
            status: 401,
            headers: { 'Content-Type': 'application/json' }
        });
    } catch (e) {
        return new Response(JSON.stringify({
            success: false,
            message: 'Malformed request body.'
        }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' }
        });
    }
}
