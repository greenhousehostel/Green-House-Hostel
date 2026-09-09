// Cloudflare Pages Function: GET /api/users
export async function onRequestGet(context) {
    return new Response(JSON.stringify({
        success: true,
        total: 2,
        activeSessions: 1,
        users: [
            {
                id: 'usr_admin_1',
                name: 'Green House Administrator',
                email: 'greenhouse5014@gmail.com',
                phone: '+880 1703-585853',
                role: 'admin',
                createdAt: '2026-08-16 20:35:39',
                lastLoginAt: 'Active Now'
            },
            {
                id: 'usr_449960',
                name: 'Tanvir Hasan',
                email: 'tanvir.student@gmail.com',
                phone: '+880 1711-223344',
                role: 'member',
                createdAt: '2026-08-16 20:37:22',
                lastLoginAt: '2026-08-16 20:37:22'
            }
        ]
    }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
    });
}
