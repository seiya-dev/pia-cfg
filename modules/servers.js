import req from './req.js';
import hlp from './helper.js';
const maxPing = hlp.maxPing;

async function getServerList(api, skipPing, _reg, _srv, _wgi, _wgp){
    const serverList = await req(api, {});
    if(!serverList.ok){
        return { ok: false, error: '[ERROR] Can\'t get server list!' };
    }
    
    // data
    const dsrv = serverList.res.body_txt.replace(/\r/g, '').split('\n');
    const jgrp = JSON.parse(dsrv[0]).groups;
    const jreg = JSON.parse(dsrv[0]).regions;
    
    // indexed data
    const ireg = [];
    const isrv = [];
    
    // extra data
    const iwgi = {};
    const iwgp = {};
    const iwgu = {};
    
    // index groups
    const igrp = Object.fromEntries(
        Object.keys(jgrp)
            .sort((a, b) => jgrp[a][0].name.localeCompare(jgrp[b][0].name))
            .map(g => [jgrp[g][0].name, jgrp[g][0].ports])
    );
    
    // add cc to region name jreg data
    for(let i in jreg){
        const r = jreg[i];
        jreg[i].name = (!r.name.match(/^\w{2} /i) ? r.country + ' ' : '') + r.name;
        const c_cc = r.name.split(' ')[0];
        jreg[i].c_id = (c_cc + '-' + hlp.rname(c_cc).replace(/&/g, '-').replace(/\s+/g, '')).toLowerCase();
    }
    
    // sort jreg by name
    jreg.sort(hlp.sortByName);
    
    console.log('[INFO] Indexing servers...');
    
    for(const r of jreg){
        const wreg = {};
        wreg.id = r.id;
        wreg.name = r.name;
        wreg.dns = r.dns;
        wreg.port_forward = r.port_forward;
        wreg.geo = r.geo;
        
        if(r.offline){
            console.log(`[WARN] "${wreg.name}" is offline...`);
            iwgp[r.id] = maxPing;
            ireg.push(wreg);
            continue;
        }
        
        const iregDup = ireg.find(cr => { return cr.dns == wreg.dns; });
        const metaSrv = r.servers.meta[0].ip;
        
        let latency = maxPing;
        let prevPing = maxPing;
        let prevPingText = '';
        
        if(iregDup){
            latency = iwgp[iregDup.id];
            console.log(`Got latency ${latency.toFixed(3)}s for region: ${r.name} [duplicate]`);
        }
        else{
            if(_wgp[r.id] && typeof _wgp[r.id] == 'number' && Math.sign(_wgp[r.id]) === 1 && _wgp[r.id] < maxPing){
                prevPing = _wgp[r.id];
            }
            
            if(!skipPing){
                const srvStatus = await req(`http://${metaSrv}:443`, {});
                latency = srvStatus.duration_ms;
                latency = isNaN(latency) ? maxPing : (latency/1000);
                latency = Number(latency.toFixed(3));
                latency = latency > maxPing ? maxPing : latency;
            }
            
            if(!skipPing && prevPing == latency){
                prevPing = maxPing;
            }
            
            if(skipPing){
                latency = prevPing;
                prevPing = maxPing;
            }
            
            if(!skipPing){
                prevPingText = prevPing != maxPing ? ` (was ${prevPing.toFixed(3)}s)` : '';
                console.log(`Got latency ${latency.toFixed(3)}s${prevPingText} for region: ${wreg.name}`);
            }
            
            iwgp[r.id] = latency;
            ireg.push(wreg);
        }
        
        const mtSrvs = r.servers.meta;
        const wgSrvs = r.servers.wg;
        
        for(let wgSrv of wgSrvs){
            const srv = {};
            srv.rid = wreg.id;
            // srv.name = wreg.name;
            
            const ip_meta = mtSrvs.find(w => { return w.cn == wgSrv.cn; });
            const ip_wg = wgSrvs.find(w => { return w.cn == wgSrv.cn; });
            
            const wgIpId = hlp.getWgIpId(ip_wg.ip);
            srv.id = hlp.convertCnId(r.c_id, wgSrv.cn);
            srv.id += '-' + wgIpId.join('-');
            
            if (!ip_meta || !ip_wg) {
                console.log(` - Can't find IP for server: ${srv.id}`);
                continue;
            }
            
            srv.cn = wgSrv.cn;
            srv.ip_meta = [ ip_meta.ip ];
            srv.ip_wg = [ ip_wg.ip ];
            srv.is_offline = false;
            iwgu[srv.id] = true;
            
            const isrvPrev = _srv.data?.find(cs => { return cs.id == srv.id; });
            
            if(srv.ip_meta.length > 0 && srv.ip_wg.length > 0){
                if(isrvPrev){
                    srv.ip_meta = [...new Set(srv.ip_meta.concat(isrvPrev.ip_meta))].sort(sortIps);
                    srv.ip_wg = [...new Set(srv.ip_wg.concat(isrvPrev.ip_wg))].sort(sortIps);
                    iwgi[srv.id] = srv.ip_wg.indexOf(ip_wg.ip);
                }
                isrv.push(srv);
            }
            else{
                console.log(` - Can't find IP for server: ${srv.id}`);
            }
            
        }
        
    }
    
    console.log('[INFO] Adding extra servers...');
    const prevSrv = _srv.data;
    
    if(prevSrv && prevSrv.length > 0){
        for(let s of prevSrv){
            const ifCurSrv = isrv.filter(cs => { return cs.id == s.id; });
            if(ifCurSrv.length > 0){
                continue;
            }
            
            let curReg, prevReg;
            let regOffline = false;
            curReg = ireg.find(cr => { return cr.id == s.rid; });
            prevReg = _reg.data?.find(cr => { return cr.id == s.rid; });
            
            // check if region exists
            if(!curReg && !prevReg){
                return { ok: false, error: `[ERROR] Can't found server ${s.name} in list!` };
            }
            
            if(curReg){
                const curJReg = jreg.find(cr => { return cr.id == curReg.id; });
                if(curJReg && curJReg.offline){
                    regOffline = curJReg.offline;
                }
            }
            
            // copy old to current
            if(!curReg && prevReg){
                curReg = prevReg;
                regOffline = true;
                ireg.push(curReg);
                iwgp[curReg.id] = _wgp[curReg.id] ? _wgp[curReg.id] : maxPing;
                console.log(`Latency was ${iwgp[curReg.id].toFixed(3)}s for region: ${curReg.name}`);
            }
            
            // recreate server
            const srv = {};
            srv.rid = curReg.id;
            // srv.name = curReg.name;
            
            srv.id = s.id;
            srv.cn = s.cn;
            
            srv.ip_meta = s.ip_meta.sort(sortIps);
            srv.ip_wg = s.ip_wg.sort(sortIps);
            iwgi[s.id] = isNaN(_wgi[s.id]) ? 0 : _wgi[s.id];
            iwgu[srv.id] = false;
            
            srv.is_offline = srv.is_offline ? srv.is_offline : regOffline;
            
            isrv.push(srv);
        }
    }
    
    // sorting
    ireg.sort(hlp.sortById);
    isrv.sort(hlp.sortById);
    
    // set update time
    const upd = Math.floor(Date.now()/1000);
    
    // return data
    return {
        ok: true,
        res: {
            grp: igrp,
            reg: {
                data: ireg,
                updated: upd,
            },
            srv: {
                data: isrv,
                updated: upd,
            },
            wgi: sortByKeys(iwgi),
            wgp: sortByKeys(iwgp),
            wgu: sortByKeys(iwgu),
        }
    };
}

function sortIps(a, b){
    const ip1 = a.split('.').map(e => parseInt(e));
    const ip2 = b.split('.').map(e => parseInt(e));
    if(ip1[0] != ip2[0] || ip1[1] != ip2[1] || ip1[2] != ip2[2]){
        console.log(`[WARN] SortIP Error: ${a} != ${b}`);
    }
    if(ip1[0] < ip2[0]){
        return -1;
    }
    if(ip1[0] > ip2[0]){
        return 1;
    }
    if(ip1[1] < ip2[1]){
        return -1;
    }
    if(ip1[1] > ip2[1]){
        return 1;
    }
    if(ip1[2] < ip2[2]){
        return -1;
    }
    if(ip1[2] > ip2[2]){
        return 1;
    }
    if(ip1[3] < ip2[3]){
        return -1;
    }
    if(ip1[3] > ip2[3]){
        return 1;
    }
    return 0;
}

function sortByKeys(wgData){
    return Object.keys(wgData).sort().reduce((obj, key) => {
        obj[key] = wgData[key];
        return obj;
    }, {});
}

export default getServerList;
