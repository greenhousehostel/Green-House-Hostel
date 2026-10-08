// Cloudflare Pages Function: /api/seats (GET and POST)
const defaultSeatState = {
    state: {
        "2": {
            "201": { "A": "available" },
            "203": { "A": "booked", "B": "booked", "C": "available" },
            "204": { "A": "booked", "B": "booked" },
            "208": { "A": "booked" },
            "210": { "A": "booked", "B": "booked" }
        },
        "3": {
            "302": { "A": "booked" },
            "303": { "A": "booked" }
        }
    },
    occupants: {
        "2": {
            "201": {},
            "203": { "A": { "name": "Tanvir Hasan", "phone": "+880 1711-223344", "notes": "BRAC University Student" } }
        }
    }
};

export async function onRequestGet(context) {
    let stateData = null;
    try {
        if (context.env && context.env.GHH_KV) {
            const stored = await context.env.GHH_KV.get('seat_state');
            if (stored) {
                stateData = JSON.parse(stored);
            }
        }
    } catch (e) {}
    
    if (!stateData) {
        stateData = defaultSeatState;
    }

    // Determine if user is admin via token
    const authHeader = context.request.headers.get('Authorization') || '';
    const isAdmin = authHeader === 'Bearer ghh_admin_secure_token_2026_KV';

    // If not admin, hide sensitive occupant data (phone, notes) like server.ps1 did
    if (!isAdmin && stateData.occupants) {
        const publicData = { state: stateData.state };
        return new Response(JSON.stringify(publicData), {
            status: 200,
            headers: {
                'Content-Type': 'application/json',
                'Cache-Control': 'no-cache'
            }
        });
    }

    return new Response(JSON.stringify(stateData), {
        status: 200,
        headers: {
            'Content-Type': 'application/json',
            'Cache-Control': 'no-cache'
        }
    });
}

export async function onRequestPost(context) {
    const authHeader = context.request.headers.get('Authorization');
    if (!authHeader || authHeader !== 'Bearer ghh_admin_secure_token_2026_KV') {
        return new Response(JSON.stringify({ success: false, message: 'Unauthorized: Admin token required.' }), {
            status: 403,
            headers: { 'Content-Type': 'application/json' }
        });
    }

    try {
        const text = await context.request.text();
        JSON.parse(text); // validate JSON

        if (context.env && context.env.GHH_KV) {
            await context.env.GHH_KV.put('seat_state', text);
        }

        return new Response(JSON.stringify({ success: true, updated: true }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });
    } catch (e) {
        return new Response(JSON.stringify({ success: false, message: 'Invalid seat data payload' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' }
        });
    }
}
