const axios = require('axios');

async function checkApi() {
    try {
        const response = await axios.get('http://localhost:3000/api/employee-stats/7');
        console.log(JSON.stringify(response.data, null, 2));
    } catch (error) {
        console.error(error.message);
    }
}

checkApi();
