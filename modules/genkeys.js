import * as ed from '@noble/ed25519';
import { x25519 } from '@noble/curves/ed25519';

const genwgkeys = (privKey = '', pubKey = '') => {
    if(typeof privKey == 'string'){
        privKey = privKey.trim().toLowerCase();
    }
    if(typeof privKey == 'string' && privKey.match(/^[0-9a-f]{64}$/)){
        // privKey = privKey;
    }
    else{
        privKey = Buffer.from(ed.utils.randomPrivateKey()).toString('hex');
    }
    privKey = Buffer.from(privKey, 'hex');
    pubKey = Buffer.from(x25519.scalarMultBase(privKey));
    return {
        privateKey: privKey.toString('base64'),
        publicKey: pubKey.toString('base64'),
    };
};

export default genwgkeys;
