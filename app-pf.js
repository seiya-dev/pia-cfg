import os from 'os';
import fs from 'fs';

// custom
import req from './modules/req.js';
import hlp from './modules/helper.js';
import genwgkeys from './modules/genkeys.js';
import { ufiles, data } from './modules/ufiles.js';

let test10net = false;
testIps();

if(!test10net){
    console.error(':error: Not private network!');
    throw new Error();
}

try{
    const getIp = await req('https://freeipapi.com/api/json');
    const extIp = JSON.parse(getIp.res.body_txt).ipAddress;
    console.info(':info: Your ExtIP:', extIp);
    const findSrv = data.srv.data.find(s => {
        for(const wi of s.ip_wg){
            if(wi == extIp){
                return true;
            }
        }
        return false;
    });
    
    // req url
    const reqUrl = `https://${extIp}:19999/getSignature`;
    
    // req options
    const reqOpts = {
        searchParams: {
            token: data.usr.token,
        },
        https: {
            certificateAuthority: fs.readFileSync(ufiles.crt),
        },
        headers: {
            Host: findSrv.cn,
        },
    };
    
    // do request
    console.log(':info: Getting signature...');
    const reqSign = await req(reqUrl, reqOpts);
    const signData = JSON.parse(reqSign.res.body_txt);
    const portData = JSON.parse(atob(signData.payload));
    console.log(`:info: Your srv url: http://${extIp}:${portData.port}/`);
    await bindPort(extIp, findSrv.cn, signData);
}
catch(e){
    console.error(':error:');
    console.log(e);
}

async function bindPort(extIp, cn, signData){
    // req url
    const reqUrl = `https://${extIp}:19999/bindPort`;
    
    // req options
    const reqOpts = {
        searchParams: {
            payload: signData.payload,
            signature: signData.signature,
        },
        https: {
            certificateAuthority: fs.readFileSync(ufiles.crt),
        },
        headers: {
            Host: cn,
        },
    };
    
    // do request
    const doBind = await req(reqUrl, reqOpts);
    console.log(JSON.parse(doBind.res.body_txt));
    
    await hlp.sleep(14*60*1000);
    await bindPort(extIp, cn, signData);
}

function testIps(){
    const ifaces = os.networkInterfaces();
    Object.keys(ifaces).forEach(ifname => {
        ifnames(ifaces, ifname);
    });
}

function ifnames(ifaces, ifname){
    ifaces[ifname].forEach(iface => {
        if('IPv4' !== iface.family){ return; }
        // console.log(iface);
        if(iface.address.match(/^10\.\d+\.\d+\.\d+$/)){
            test10net = iface.address;
            console.info(':info: Your IntIP:', test10net);
        }
    });
}
