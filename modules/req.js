const getData = async (url, options = {}) => {
    const opts = options ?? {};
    
    const {
        method = 'GET',
        headers = {},
        body,
        searchParams,
    } = opts;
    
    let finalUrl = url;
    if (searchParams) {
        const u = new URL(url);
        const sp =
            searchParams instanceof URLSearchParams
            ? searchParams
            : new URLSearchParams(searchParams);
        for (const [k, v] of sp.entries()) u.searchParams.append(k, v);
        finalUrl = u.toString();
    }
    
    const finalHeaders =
        headers instanceof Headers ? headers : new Headers(headers);
    
    try {
        const res = await fetch(finalUrl, {
            method,
            headers: finalHeaders,
            body,
        });
        
        if (res.status === 400) {
            const error = new Error('HTTP 400');
            error.name = 'HTTPError';
            error.response = res;
            error.body_txt = await safeReadBody(res);
            return { ok: false, error };
        }
        
        if (!res.ok) {
            const statusMessage = res.statusText || '';
            console.log(`[ERROR] HTTPError ${res.status}: ${statusMessage}`);
            
            const maybeBody = await safeReadBody(res);
            // if (maybeBody) console.log(maybeBody);
            
            const error = new Error(`HTTP ${res.status}`);
            error.name = 'HTTPError';
            error.response = res;
            error.body_txt = maybeBody;
            return { ok: false, error };
        }
        
        res.body_txt = await safeReadBody(res);
        return { ok: true, res };
    } 
    catch (error) {
        console.log(`[ERROR] ${error.name}: ${error.code ?? error.message}`);
        return { ok: false, error };
    }
};

async function safeReadBody(res) {
    try {
        const text = await res.clone().text();
        return text || '{}';
    }
    catch {
        return '{}';
    }
}

export default getData;
