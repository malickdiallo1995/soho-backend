const axios = require('axios');
const ENV_CONTENTS = process.env;

const cashOutTmoneyTg = async (fullName, phoneNumber, invoice_token) => {
    try {
        var payloads = {
            "name_t_money": fullName,
            "email_t_money": "",
            "phone_t_money": phoneNumber,
            "payment_token": invoice_token
        };
        const res = await axios.post(ENV_CONTENTS.PAYDUNYA_CASHOUT_BASE_URL + 'softpay/t-money-togo', payloads);
        return res.data;
    } catch (error) {
        throw new Error(JSON.stringify(error?.response?.data?? {"msg": error.message}));
    }

}

module.exports = {
    cashOutTmoneyTg
}