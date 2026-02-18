const FORBIDDEN_HEADERS = new Set([
    'host',
    'connection',
    'content-length',
    'transfer-encoding',
    'keep-alive',
    'upgrade',
    'proxy-connection',
    'te',
    'trailer',
]);

function safeHeaders(input = {}) {
    try {
        const h = input instanceof Headers ? input : new Headers(input);

        for (const k of Array.from(h.keys())) {
            if (FORBIDDEN_HEADERS.has(k.toLowerCase())) h.delete(k);
        }

        return h;
    }
    catch {
        return new Headers();
    }
}

async function safeReadBody(res) {
    try {
        const text = await res.clone().text();
        return text || '';
    }
    catch {
        return '';
    }
}

const getData = async (url, options = {}) => {
    const startedAt = Date.now();
    
    try {
        const opts = options ?? {};
        const {
            method = 'GET',
            headers = {},
            body,
            searchParams,
            dispatcher,
            signal,
            ...rest
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
        
        const finalHeaders = safeHeaders(headers);
        
        const finalBody =
            method === 'GET' || method === 'HEAD' ? undefined : body;
        
        const res = await fetch(finalUrl, {
            method,
            headers: finalHeaders,
            body: finalBody,
            dispatcher,
            signal,
            ...rest,
        });
        
        const body_txt = await safeReadBody(res);
        const duration_ms = Date.now() - startedAt;
        
        if (!res.ok) {
            const error = new Error(`HTTP ${res.status}`);
            error.name = 'HTTPError';
            error.response = res;
            error.body_txt = body_txt;
            return { ok: false, error, duration_ms };
        }
        
        res.body_txt = body_txt;
        return { ok: true, res };
    }
    catch (error) {
        return { ok: false, error };
    }
};

export default getData;
