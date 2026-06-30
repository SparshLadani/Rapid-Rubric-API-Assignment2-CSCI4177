import { createClient } from "@supabase/supabase-js";
import 'dotenv/config';
import ws from 'ws';

export const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { realtime: { transport: ws } }
);

export async function verifyTOken(req, res, next){
    const authHeader = req.headers.authorization;

    if(!authHeader || !authHeader.startsWith('Bearer ')){
        return res.status(401).json({
            error: { code: 'MISSING_TOKEN', message: 'Authorization header with Bearer token required.' }
        });
    }

    const token = authHeader.split(' ')[1];
    const {data: { user }, error } = await supabase.auth.getUser(token);

    if(error || !user){
        return res.status(401).json({
          error: { code: 'INVALID_TOKEN', message: 'Token is expired or invalid.' }
        });
    }

    req.user = user;
    next();
}

export function requireRole(...roles){
    return(req, res, next) => {
        const userRole = req.user?.user_metadata?.role;
        if(!roles.includes(userRole)){
            return res.status(403).json({
                error: {code: 'FORBIDDEN', message: `Access restricted to: ${roles.join(', ')}.`}
            });
        }
        next();
    };
}