import fs from 'fs';
import * as url from 'url';
const __dirname = url.fileURLToPath(new URL('.', import.meta.url));

import YAML from 'yaml';
import ask from './modules/ask.js';
import req from './modules/req-got.js';
import ProxyAgent from 'proxy-agent';

const ufiles = {
    api: __dirname + './config/api.yml',
    usr: __dirname + './config/user_proxy.yml',
};

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
}

async function getToken(){
    const piaLogin = await ask({
        type: 'input',
        message: 'PIA Login',
    });
    const piaPass = await ask({
        type: 'password',
        message: 'PIA Pass.',
    });
    const rdata = await req(data.api.prxTokn, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', },
        body: JSON.stringify({ username: piaLogin, password: piaPass, }),
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
        console.log(jdata);
    }
}

async function testProxy(){
    const rdata = await req(data.api.prxList);
    if(rdata.ok){
        const jdata = JSON.parse(rdata.res.body);
        console.log(jdata[0]);
        const tokenUser = data.usr.token.substring(0, data.usr.token.length / 2);
        const tokenPass = data.usr.token.substring(data.usr.token.length / 2);
        const date = new Date().getTime();
        const testReq = await req(data.api.prxStat + '?' + date, {
            agent: { https: new ProxyAgent(`https://${tokenUser}:${tokenPass}@${jdata[0].dns}/`) },
        });
        if(testReq.ok){
            console.log(testReq.res.body);
        }
        else{
            console.log(testReq);
        }
    }
}
