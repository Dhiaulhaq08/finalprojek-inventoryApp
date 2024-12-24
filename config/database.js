const Pool = require("pg").Pool

const dotenv = require('dotenv');

dotenv.config();

const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
});

module.exports = pool;

function eksekusi(script_sql_dan_data) {
    return new Promise( (resolve, reject) => {
        db.query(script_sql_dan_data, function(errorSql, hasil) {
            if (errorSql) {
                reject(errorSql)
            } else {
                resolve(hasil)
            }
        })
    })
}



module.exports = pool , eksekusi;