// modules
import fs from 'fs';
import path from 'path';
import { Agent } from 'undici';

// custom
import req from './modules/req.js';
import hlp from './modules/helper.js';
import genwgkeys from './modules/genkeys.js';
import { ufiles, data } from './modules/ufiles.js';

// npm modules
import { select } from '@inquirer/prompts';

// help function
import { getToken, updToken } from './modules/token.js';
import getServerList from './modules/servers.js';

// formats
import ini from 'ini';
import YAML from 'yaml';

// special list keys
const exitId = '-EXIT-';
const refreshServerList0Id = '-REFRESH-SERVER-LIST-';
const refreshServerList1Id = '-REFRESH-SERVER-LIST-NOPING-';
const reAddKeyId = '-RE-ADD-KEY-';
const backToRegListId = '-BACK-TO-REGION-LIST-';

// run app
await start();

// main app
async function start (){
    // user to tcfg
    const tcfg = data.usr;
    try{
        const tBuf = Buffer.from(tcfg.token, 'base64');
        if(tBuf.length != 92){
            console.log('[ERROR] Token has wrong length!');
            throw new Error('');
        }
        if(typeof tcfg.token_ttl != 'number' || !Number.isSafeInteger(tcfg.token_ttl)){
            console.log('[ERROR] Token TTL has wrong value!');
            throw new Error('');
        }
    }
    catch(e){
        tcfg.token = undefined;
    }
    // set token
    if(typeof tcfg.token != 'string'){
        const usrToken = await getToken(data.api.genToken, tcfg.pia_user, tcfg.pia_pass);
        if(usrToken.ok){
            data.usr.token = usrToken.res.data.token;
            data.usr.token_ttl = usrToken.res.ttl;
            fs.writeFileSync(ufiles.usr, YAML.stringify(data.usr));
            console.log('[INFO] Token was set!');
        }
        else{
            console.log('[ERROR] Token wasn\'t set!');
            return;
        }
    }
    // refresh token
    if(tcfg.token_ttl < Math.floor(Date.now()/1000)){
        const usrNewToken = await updToken(data.api.refToken, tcfg.token);
        if(usrNewToken.ok){
            data.usr.token = usrNewToken.res.data.token;
            data.usr.token_ttl = usrNewToken.res.ttl;
            fs.writeFileSync(ufiles.usr, YAML.stringify(data.usr));
            console.log('[INFO] Token was updated!');
        }
        else{
            console.log(usrNewToken);
            console.log('[WARN] Token was not updated!');
        }
    }
    // load servers
    await loadServerList(true);
    // start api
    await wgApiSelReg();
}

// servers data
async function loadServerList(skipPing, doRefresh){
    if(isNaN(data.reg.updated) || isNaN(data.srv.updated) || doRefresh){
        const dsrv = await getServerList(data.api.srvList, skipPing, data.reg, data.srv, data.wgi, data.wgp);
        if(!dsrv.ok){
            console.log(dsrv.error);
            return;
        }
        for(const t of Object.keys(dsrv.res)){
            data[t] = dsrv.res[t];
            fs.writeFileSync(ufiles[t], YAML.stringify(dsrv.res[t]));
        }
    }
}

// gen wg
async function wgApiSelReg(selReg = ''){
    const regListArr = [];
    if(!data.reg.data){
        data.reg.data = [];
    }
    for(let r of data.reg.data){
        const reg = {};
        reg.value = r.name.split(' ')[0].toLowerCase();
        reg.ping = data.wgp[r.id] || hlp.maxPing;
        reg.name = `${reg.value.toUpperCase()} ${hlp.rname(reg.value.toUpperCase())}`;
        
        const regSeq = regListArr.findIndex(cr => { return cr.value == reg.value; });
        if(regSeq > -1){
            if(regListArr[regSeq].ping == hlp.maxPing){
                reg.ping = hlp.maxPing;
            }
            else{
                reg.ping = (reg.ping + regListArr[regSeq].ping) / 2;
            }
            reg.ping = Number(reg.ping.toFixed(3));
            regListArr[regSeq] = reg;
        }
        else{
            regListArr.push(reg);
        }
    }
    
    regListArr.sort(hlp.sortByValue);
    regListArr.map(r => { r.name = `${r.ping.toFixed(3)} ${r.name}`; return r; });
    
    // re add key
    const reAddKeyTxt = '----- Re-add key to server';
    regListArr.unshift({ value: reAddKeyId, name: reAddKeyTxt, ping: -1 });
    
    // refresh server list
    data.srv.updated = !isNaN(data.srv.updated) ? data.srv.updated : 1;
    const timePassed = Math.floor(Date.now()/1000) - data.srv.updated;
    const timePassedStr = hlp.timePassed(timePassed);
    const refreshServerList0Txt = `----- Refresh server list [Last update: ${timePassedStr}]`;
    const refreshServerList1Txt = '----- Refresh server list [SKIP PING]';
    regListArr.unshift({ value: refreshServerList1Id, name: refreshServerList1Txt, ping: -2 });
    regListArr.unshift({ value: refreshServerList0Id, name: refreshServerList0Txt, ping: -3 });
    
    // exit
    regListArr.unshift({ value: exitId, name: '----- Close app', ping: -5 });
    
    // select region
    let curRegion = await select({
        message: 'Select PIA region',
        choices: regListArr,
        default: selReg,
        pageSize: 20,
    });
    
    if(curRegion == exitId){
        return;
    }
    
    if(curRegion == refreshServerList0Id){
        await loadServerList(false, true);
        await wgApiSelReg(refreshServerList0Id);
        return;
    }
    if(curRegion == refreshServerList1Id){
        await loadServerList(true, true);
        await wgApiSelReg(refreshServerList1Id);
        return;
    }
    
    if(curRegion == reAddKeyId){
        await wgFileList();
        return;
    }
    
    await wgApiSelServ(curRegion);
    return;
}

async function wgFileList(selServ = ''){
    // read file list
    const wgFiles = fs.readdirSync(ufiles.output).filter(f => {
        if(f.match(/\.conf(\.dpapi)?$/)){
            return true;
        }
        return false;
    });
    
    // add back to reg list
    const wgSrv = [{ value: backToRegListId, name: '<-- Back to region list' }];
    
    // index wg files
    for(let wgFile of wgFiles){
        try{
            const wgCfg = ini.parse(fs.readFileSync(ufiles.output + `${wgFile}`, 'utf-8'));
            if(typeof wgCfg.Peer?.Endpoint == 'string' && wgCfg.Peer.Endpoint != ''){
                const wgIpAdress = wgCfg.Peer?.Endpoint?.split(':')[0];
                const subId = hlp.getIpLastDigit(wgIpAdress);
                // find srv by wg ip
                let srvData = data.srv.data?.find(s => {
                    return s.ip_wg.indexOf(wgIpAdress) > -1 ? true : false;
                });
                // skip file
                if(!srvData){
                    console.log(`[WARN] ${wgFile}: retrying search server in ranges...`);
                    const srvDataSearch = data.srv.data?.filter(s => { return s.id.match(hlp.getWgIpId(wgIpAdress).join('-')) ? true : false; });
                    if(srvDataSearch.length > 0){
                        for(const srvDataItem of srvDataSearch){
                            const srvRange = hlp.getIpRange(srvDataItem.ip_wg).split('-');
                            const srvIps = [...srvRange, subId].map(v => { return parseInt(v); });
                            if(srvIps[0] <= srvIps[2] && srvIps[1] >= srvIps[2]){
                                srvData = srvDataItem;
                            }
                        }
                    }
                    if(!srvData){
                        console.log(`[WARN] ${wgFile}: can't find server for ip ${wgIpAdress}`);
                        continue;
                    }
                }
                // search region
                const regData = data.reg.data?.find(r => { return  r.id == srvData.rid; });
                // add to data
                const s = {
                    reg: regData,
                    srv: srvData,
                    wgi: srvData.ip_wg.indexOf(wgIpAdress),
                    ini: wgCfg,
                };
                if(s.wgi < 0){
                    s.ip = wgIpAdress;
                }
                // add file to data
                s.file = wgFile;
                // name str
                const wgFilename = wgFile.replace(/\.conf$/, '');
                const wgIpId = hlp.getWgIpId(wgIpAdress).join('-');
                const wgRange = hlp.getIpRange(srvData.ip_wg);
                const srvName = `${regData.name} [${wgFilename} ${wgIpId} ${wgRange} ${subId}]`;
                // add to array
                wgSrv.push({
                    value: wgFile,
                    data: s,
                    name: srvName
                        + ( regData.geo ? ' [GEO]' : '' )
                        + ( data.wgu[srvData.id] ? ' [UPD]' : '' )
                        + ( srvData.is_offline ? ' [OFFLINE]' : '')
                });
            }
        }
        catch(e){
            console.log(`[ERROR] ${wgFile}: ${e}`);
        }
    }
    
    wgSrv.sort(hlp.sortByName);
    const curServer = await select({
        message: 'Select PIA server',
        choices: wgSrv,
        default: selServ,
        pageSize: 20,
    });
    
    const srvData = wgSrv.find(w => { return w.value == curServer; }).data;
    
    if(curServer == backToRegListId){
        await wgApiSelReg(reAddKeyId);
        return;
    }
    
    let privateKey;
    
    try{
        privateKey = srvData.ini?.Interface?.PrivateKey;
        privateKey = Buffer.from(privateKey, 'base64');
        privateKey = privateKey.toString('hex');
    }
    catch(e){
        console.log('[WARN] Can\'t parse private key for config!\n', e);
    }
    
    delete srvData.ini;
    await publishKey(reAddKeyId, curServer, srvData, privateKey);
    return;
}

async function wgApiSelServ(selReg = '', selServ = ''){
    // add back to reg list
    const serverListArr = [{ value: backToRegListId, name: '<-- Back to region list' }];
    
    // server list
    for(const s of data.srv.data){
        let regId = s.id.split('-')[0];
        
        if(s.ip_meta.length != 1){
            console.log(`[WARN] ${s.id} has not 1 meta server!`);
        }
        
        if(selReg == regId){
            const cs = {};
            cs.reg = data.reg.data?.find(r => { return  r.id == s.rid; });
            cs.srv = s;
            
            const wgRange = hlp.getIpRange(s.ip_wg);
            const subId = hlp.getIpLastDigit(s.ip_wg[data.wgi[s.id]]);
            
            // const streaming = s.name.match(/streaming/i) ? '-streaming' : '';
            // cs.file = `wg-pia-${s.id}-${subId}${streaming}.conf`;
            // console.log(cs.reg.geo, data.wgu[s.id], s.is_offline);
            
            serverListArr.push({
                value: s.id,
                data: cs,
                name: `${cs.reg.name} [${s.id} ${wgRange} ${subId}]`
                    + ( cs.reg.geo ? ' [GEO]' : '' )
                    + ( data.wgu[s.id] ? ' [UPD]' : '' )
                    + ( s.is_offline ? ' [OFFLINE]' : '')
            });
        }
    }
    
    serverListArr.sort(hlp.sortByName);
    const curServer = await select({
        message: 'Select PIA server',
        choices: serverListArr,
        default: selServ,
        pageSize: 20,
    });
    
    const srvData = serverListArr.find(w => { return w.value == curServer; }).data;
    
    if(curServer == backToRegListId){
        await wgApiSelReg(selReg);
        return;
    }
    
    await publishKey(selReg, curServer, srvData);
    return;
}

async function publishKey(curRegion = '', curServer = '', curData = {}, privKey = ''){
    
    // console.log(curRegion, curServer, '\n', curData);
    const r = curData.reg;
    const s = curData.srv;
    
    // create keys
    privKey = privKey == '' ? data.usr.private_key : privKey;
    const wgkeys = genwgkeys(privKey);
    
    // select ip
    if(curRegion != reAddKeyId){
        const ipList = hlp.makeIpArrSel(s.ip_wg);
        const wgiDefault = isNaN(data.wgi[s.id]) ? 1 : data.wgi[s.id] + 1;
        
        curData.wgi = await select({
            type: 'list',
            message: 'Select IP address',
            choices: ipList,
            default: wgiDefault,
            pageSize: 20,
        });
        
        if(curData.wgi < 0){
            await wgApiSelServ(curRegion, curServer);
            return;
        }
        
        const fileId = hlp.convertCnId(s.id.split('-')[0], s.cn);
        const streaming = r.name.match(/streaming/i) ? '-streaming' : '';
        curData.file = `pia-${fileId}${streaming}.conf`;
    }
    
    // set server ip and host
    const serverMt = s.ip_meta[0];
    const serverIp = curData.ip || s.ip_wg[curData.wgi];
    const serverCn = s.cn;
    
    // additional data
    const isUpd = data.wgu[s.id];
    const isOffline = s.is_offline;
    const wgConfFn = curData.file;
    
    // req url
    const reqUrl = new URL(`https://${serverIp}:1337/addKey`);
    // req qs
    reqUrl.search = new URLSearchParams({
        pt: data.usr.token,
        pubkey: wgkeys.publicKey,
    }).toString();
    // req options
    const reqOpts = {
        method: "GET",
        headers: {
            Host: serverCn,
        },
        dispatcher: new Agent({
            connect: {
                ca: fs.readFileSync(ufiles.crt),
                servername: serverCn,
            },
        }),
    };
    
    // console.log(reqUrl);
    // console.log(reqOpts);
    
    // do request
    console.log('[INFO] Publishing key...');
    const reqKey = await fetch(reqUrl, reqOpts);
    
    // reqOpts.url = reqUrl;
    
    // {
    //     "status": "OK",
    //     "server_key": "sss...",
    //     "server_port": 1337,
    //     "server_ip": "84.17.60.215",
    //     "server_vip": "10.7.128.1",
    //     "peer_ip": "10.7.150.173",
    //     "peer_pubkey": "aaa...",
    //     "dns_servers": [
    //         "10.0.0.243",
    //         "10.0.0.242"
    //     ]
    // }
    
    if(reqKey.error){
        console.log('TODO: Rework reqKey.error');
        /*
        if(reqKey.error.name == 'RequestError' && reqKey.error.code == 'ETIMEDOUT'){
            console.log('[ERROR] Server is offline... Try another server.');
            
            if(!isUpd && !isOffline){
                const curIdx = data.srv.data.indexOf(curData.srv);
                data.srv.data[curIdx].is_offline = true;
                fs.writeFileSync(ufiles.srv, YAML.stringify(data.srv));
            }
            
            if(curRegion == reAddKeyId){
                await wgFileList(curServer);
                return;
            }
            
            await wgApiSelServ(curRegion, curServer);
            return;
        }
        
        console.log('[ERROR] Failed to add keys... Trying test server...');
        const srvStatus = await req(`http://${serverMt}:443`, {});
        
        if(!srvStatus.error){
            console.log('[INFO] Server is OK!');
        }
        
        console.log('[INFO] Try another server.');
        
        if(curRegion == reAddKeyId){
            await wgFileList(curServer);
            return;
        }
        
        await wgApiSelServ(curRegion, curServer);
        return;
        
        // console.log(reqKey.error.options);
        // console.log(wgkeys);
        // console.log([
        //     `"curl/curl" -v -G --connect-to "${serverCn}::${serverIp}:"`,
        //     `--cacert "${cfg.files.crt}" --data-urlencode "pt=${cfg.data.acc.token}"`,
        //     `--data-urlencode "pubkey=${wgkeys.publicKey}" "https://${serverCn}:1337/addKey"`,
        // ].join(' '));
        // wmic path win32_networkadapter where description="WindscribeWireguard" get ConfigManagerErrorCode
        */
    }
    else{
        const reqKeyBody = await reqKey.clone().text();
        const wgdata = JSON.parse(reqKeyBody);
        wgdata.address = `${wgdata.peer_ip}/32`;
        wgdata.endpoint = `${wgdata.server_ip}:${wgdata.server_port}`;
        console.log('[INFO] Generating configuration...');
        
        const wgconf = [];
        wgconf.push('[Interface]');
        wgconf.push(`PrivateKey = ${wgkeys.privateKey}`);
        wgconf.push(`Address = ${wgdata.address}`);
        wgconf.push(`DNS = ${wgdata.dns_servers.join(', ')}`);
        
        // amnezia parameters
        // wgconf.push('Jc = ...');
        // wgconf.push('Jmin = ...');
        // wgconf.push('Jmax = ...');
        wgconf.push('H1 = 1');
        wgconf.push('H2 = 2');
        wgconf.push('H3 = 3');
        wgconf.push('H4 = 4');
        //wgconf.push('I1 = <b 0x...>');
        wgconf.push('');

        wgconf.push('[Peer]');
        wgconf.push(`PublicKey = ${wgdata.server_key}`);
        wgconf.push(`Endpoint = ${wgdata.endpoint}`);
        // wgconf.push(`PresharedKey = `);
        wgconf.push('AllowedIPs = 0.0.0.0/1, 128.0.0.0/1'); 
        // 0.0.0.0/0 not work properly with some apps
        wgconf.push('PersistentKeepalive = 25');
        wgconf.push('');
        
        try{
            const wgCfg = ini.parse(fs.readFileSync(path.join(ufiles.output, wgConfFn), 'utf-8'));
            if(wgCfg.Interface.Address != `${wgdata.address}`){
                console.log(`[INFO] Interface Address was changed: ${wgCfg.Interface.Address} => ${wgdata.address}`);
            }
            if(wgCfg.Peer.Endpoint != `${wgdata.endpoint}`){
                console.log(`[INFO] Endpoint Address was changed ${wgCfg.Peer.Endpoint} => ${wgdata.endpoint}`);
            }
            if(wgCfg.Peer.PublicKey != `${wgdata.server_key}`){
                console.log(`[INFO] Server Key was changed ${wgCfg.Peer.PublicKey} => ${wgdata.server_key}`);
            }
        }
        catch(e){}
        
        console.log('[INFO] Saving...');
        fs.writeFileSync(path.join(ufiles.output, wgConfFn), wgconf.join('\n'));
        if(ufiles.output_home){
            fs.writeFileSync(path.join(ufiles.output_home, wgConfFn), wgconf.join('\n'));
        }
        
        if(curRegion == reAddKeyId){
            await wgFileList(curServer);
            return;
        }
        
        await wgApiSelServ(curRegion, curServer);
        return;
    }
    
}

/*
    get a token from the meta API located at 10.0.0.1 on port 443
    contact your gateway (the virtual IP of the OpenVPN server) on port 19999 to get payload/signature
    use payload/signature to bind port
    repeat step 3 every 15 minutes to keep port active
    payload_and_signature="$(curl -s -m 5 \
    --connect-to "uk-manchester.privacy.network::$PF_GATEWAY:" \
    -G --data-urlencode "token=${PIA_TOKEN}" \
    "https://uk-manchester.privacy.network:19999/getSignature")"
*/
