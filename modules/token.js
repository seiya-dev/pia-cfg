import { input, password } from '@inquirer/prompts';
import req from './req.js';

// gen token
async function getToken (api, pia_user, pia_pass) {
    pia_user = pia_user && typeof pia_user == 'string' ? pia_user : await input({
        message: 'PIA username (p#######)',
    });
    pia_pass = pia_pass && typeof pia_pass == 'string' ? pia_pass : await password({
        message: 'PIA password',
    });
    const authData = await req(api, {
        username: pia_user,
        password: pia_pass,
    });
    if(authData.ok){
        const token = {
            data: JSON.parse(authData.res.body_txt),
            ttl: Math.floor(Date.now()/1000) + 60*60*24,
        };
        return { ok: true, res: token };
    }
    return { ok: false, res: authData };
}

async function updToken (api, ptoken) {
    try{
        const query = '?' + new URLSearchParams({ oldToken: ptoken }).toString();
        const reqUpdToken = await req(api + query);
        const token = {
            data: JSON.parse(reqUpdToken.res.body_txt),
            ttl: Math.floor(Date.now()/1000) + 60*60*24,
        };
        return { ok: true, res: token };
    }
    catch(e){
        return { ok: false, res: e };
    }
}

export { getToken, updToken };
