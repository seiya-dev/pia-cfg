// set modules
import fs from 'fs';
import path from 'path';
import url from 'url';
import YAML from 'yaml';

// dirname re-implement for mjs
const __dirname = url.fileURLToPath(new URL('.', import.meta.url));

// config paths
const ufiles = {
    // main
    api: './config/api.yml',
    crt: './modules/ca.rsa.4096.crt',
    usr: './config/user.yml',
    // srv
    grp: './config/groups.yml',
    reg: './config/regions.yml',
    srv: './config/servers.yml',
    wgi: './config/wgi.yml',
    wgp: './config/wgp.yml',
    wgu: './config/wgu.yml',
    // extra
    output: './output/',
};

// parse paths
for(let file of Object.keys(ufiles)){
    ufiles[file] = path.join(__dirname, '..', ufiles[file]);
}

// load data
const data = {};
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
        // console.log(e);
        data[k] = {};
    }
}

// home dir
ufiles.output_home = undefined;
const USERPROFILE = process.env.USERPROFILE;
const HOMEPATH = process.env.HOMEPATH;

// userdir
const upDir = path.join(USERPROFILE, './.wg-config/');
const hpDir = path.join(HOMEPATH, './.wg-config/');

// check path
if(fs.existsSync(upDir)){
    ufiles.output_home = upDir;
}
if(fs.existsSync(hpDir)){
    ufiles.output_home = hpDir;
}
if(data.usr.output && fs.existsSync(data.usr.output)){
    ufiles.output_home = data.usr.output;
}

// end
export { ufiles, data };
