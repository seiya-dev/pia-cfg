import fs from 'fs';
import * as url from 'url';
const __filename = url.fileURLToPath(import.meta.url);
const __dirname = url.fileURLToPath(new URL('.', import.meta.url));

import YAML from 'yaml';
import ask from './modules/ask.js';
import req from './modules/req.js';
import { HttpsProxyAgent } from 'https-proxy-agent';

const ufiles = {
    api: __dirname + './config/api.yml',
    srv: __dirname + './config/servers_proxy.yml',
    usr: __dirname + './config/user_proxy.yml',
}

// set data
const data = {};

// load data
for(let k of Object.keys(ufiles)){
    const file = ufiles[k];
    if(!file.match(/\.yml$/)){
        continue;
    }
    try{
        data[k] = fs.readFileSync(file, 'utf8');
        data[k] = YAML.parse(data[k]);
    }
    catch(e){
        data[k] = {};
    }
}

// ---

await getStatus();
if(!data.usr.token){
    await getToken();
}
await getUser();
await testProxy();

// ---

async function getStatus(){
    const date = new Date().getTime();
    const url = data.api.prxStat + '?' + date;
    const rdata = await req(url);
    if(rdata.ok){
        const jdata = JSON.parse(rdata.res.body);
        console.log(jdata);
    }
    else{
        console.log(rdata);
    }
}

async function getToken(){
    const piaUser = await ask({
        type: 'input',
        message: 'PIA username (p#######)',
    });
    const piaPass = await ask({
        type: 'password',
        message: 'PIA password',
    });
    const rdata = await req(data.api.prxTokn, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', },
        body: JSON.stringify({ username: piaUser, password: piaPass, }),
        timeout: { request: 5000 },
    });
    if(rdata.ok){
        const jdata = JSON.parse(rdata.res.body);
        fs.writeFileSync(ufiles.usr, YAML.stringify(jdata));
    }
}

async function getUser(){
    const rdata = await req(data.api.usrStat, {
        headers: { 'Authorization': 'Token ' + data.usr.token, },
    });
    if(rdata.ok){
        const jdata = JSON.parse(rdata.res.body);
        console.log('Username     ', jdata.username);
        console.log('Days remained', jdata.days_remaining);
    }
}

async function testProxy(){
    const rdata = await req(data.api.prxList);
    if(rdata.ok){
        const jdata = JSON.parse(rdata.res.body);
        const pdata = [];
        for(const p of jdata){
            pdata.push({ cc: p.iso, dns: p.dns, ip: p.ping, });
        }
        
        jdata.sort((a, b) => {
            if(a.dns < b.dns){
                return -1;
            }
            if(a.dns > b.dns){
                return 1;
            }
            return 0;
        })
        fs.writeFileSync(ufiles.srv, YAML.stringify(jdata));
        
        const prxData = jdata.reverse()[0];
        const tokenUser = data.usr.token.substring(0, data.usr.token.length / 2);
        const tokenPass = data.usr.token.substring(data.usr.token.length / 2);
        const date = new Date().getTime();
        
        const testReq = await req(data.api.prxStat + '?' + date, {
            agent: { https: new HttpsProxyAgent(`https://${tokenUser}:${tokenPass}@${prxData.dns}/`) },
        });
        
        if(testReq.ok){
            console.log(JSON.parse(testReq.res.body));
        }
        else{
            console.log(testReq);
        }
    }
}

// ---
