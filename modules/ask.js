import inquirer from 'inquirer';

const ask = async (arr) => {
    try{
        if(!arr.name){
            arr.name = Math.random().toString(36).substring(8);
        }
        arr.message += ':';
        const result = await inquirer.prompt(arr);
        return result[arr.name];
    }
    catch(e) {
        throw new Error(e.message);
    }
};

export default ask;
