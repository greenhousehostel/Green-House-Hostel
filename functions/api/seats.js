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
    return new Response(JSON.stringify(defaultSeatState), {
        status: 200,
        headers: {
            'Content-Type': 'application/json',
            'Cache-Control': 'no-cache'
        }
    });
}

export async function onRequestPost(context) {
    try {
        const body = await context.request.json();
        return new Response(JSON.stringify({ success: true, updated: true, data: body }), {
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
