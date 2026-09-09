// Cloudflare Pages Function: POST /api/auth/register
export async function onRequestPost(context) {
    try {
        const body = await context.request.json();
        const name = (body.name || '').trim();
        const email = (body.email || '').trim().toLowerCase();
        const phone = (body.phone || '').trim();
        const pass = String(body.password || '');

        if (!name || !email || !pass) {
            return new Response(JSON.stringify({
                success: false,
                message: 'All fields are required.'
            }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        const token = 'cf_tok_' + crypto.randomUUID();
        const role = email === 'greenhouse5014@gmail.com' ? 'admin' : 'member';

        return new Response(JSON.stringify({
            success: true,
            token: token,
            user: {
                id: 'usr_' + Math.random().toString(36).substring(2, 8),
                name: name,
                email: email,
                phone: phone,
                role: role
            }
        }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });
    } catch (e) {
        return new Response(JSON.stringify({
            success: false,
            message: 'Invalid registration request.'
        }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' }
        });
    }
}
