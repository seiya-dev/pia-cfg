import got from 'got';

const getData = async (url, options) => {
    if(options && !options.headers){
        options.headers = {};
    }
    try{
        let res = await got(url, options);
        return {
            ok: true,
            res
        };
    }
    catch(error){
        if(error.response && error.response.statusCode && error.response.statusCode == 400){
            return {
                ok: false,
                error
            };
        }
        else if(error.response && error.response.statusCode && error.response.statusMessage){
            console.log(`[ERROR] ${error.name} ${error.response.statusCode}: ${error.response.statusMessage}`);
            if(error.response.body){
                console.log(error.response.body);
            }
        }
        else{
            console.log(`[ERROR] ${error.name}: ${error.code}`);
        }
        return {
            ok: false,
            error
        };
    }
};

export default getData;
