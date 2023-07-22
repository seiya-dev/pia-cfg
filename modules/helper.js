const hlp = {};
hlp.maxPing = 9.999;

hlp.rname = (countryCode) => {
    return new Intl.DisplayNames(['en'], {type: 'region'}).of(countryCode);
};

hlp.sortById = (a, b) => {
    if(a.id < b.id){
        return -1;
    }
    if(a.id > b.id){
        return 1;
    }
    return 0;
};

hlp.sortByName = (a, b) => {
    if(a.name < b.name){
        return -1;
    }
    if(a.name > b.name){
        return 1;
    }
    return 0;
};

hlp.sortByValue = (a, b) => {
    if(a.value < b.value){
        return -1;
    }
    if(a.value > b.value){
        return 1;
    }
    return 0;
};

hlp.timePassed = (timePassed) => {
    const diffPassed = {
        s: timePassed % 60,
        m: Math.floor(timePassed / 60) % 60,
        h: Math.floor(timePassed / (60*60)) % 24,
        d: Math.floor(timePassed / (60*60*24)),
    };
    
    let timePassedStr = [
        diffPassed.d > 0 ? (diffPassed.d + 'd ').padStart(4, '0') : '',
        diffPassed.h > 0 ? (diffPassed.h + 'h ').padStart(4, '0') : '',
        diffPassed.m > 0 ? (diffPassed.m + 'm ').padStart(4, '0') : '',
        diffPassed.s > 0 ? (diffPassed.s + 's ').padStart(4, '0') : '',
    ].join('').trim().replace(/\s\s+/g, ' ');
    
    return timePassedStr == '' ? '0s' : timePassedStr;
};

hlp.convertCnId = (cc, cn) => {
    cn = `${cc}-${cn}`.replace(/_/g, '-');
    cn = cn.replace(/4?(\d+)$/, '-$1').split('-');
    cn = [...new Set(cn)].join('-');
    return cn;
};

hlp.getWgIpId = (ipStr) => {
    const wgIpId = typeof ipStr == 'string' ? ipStr.split('.').slice(0, -1) : '000.000.000'.split('.');
    return wgIpId.map(i => i.toString().padStart(3, '0'));
};

hlp.getIpLastDigit = (ipStr) => {
    return typeof ipStr == 'string' ? ipStr.split('.').reverse()[0].padStart(3, '0') : '000';
};

hlp.getIpRange = (ipArr) => {
    const firstIp = hlp.getIpLastDigit(ipArr[0]);
    const lastIp = hlp.getIpLastDigit(Array.from(new Set(ipArr)).reverse()[0]);
    return `${firstIp}-${lastIp}`;
};

hlp.makeIpArrSel = (wgIps) => {
    const ipList = Array.from(new Set(wgIps)).map((ip, i) => {
        return { value: i, name: ip };
    });
    ipList.unshift({ value: -1, name: '<-- Back to server list' });
    return ipList;
};

hlp.sleep = (time) => {
    return new Promise(resolve => setTimeout(resolve, time))
}

// end
export default hlp;
