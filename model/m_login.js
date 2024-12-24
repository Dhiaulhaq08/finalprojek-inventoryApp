const Pool = require("pg").Pool;
const config_database   = require('../config/database.js')
const pg               = config_database.pool
const eksekusi          = config_database.eksekusi

module.exports =
{
    cari_email: function(form_email) {
        let sqlSyntax = Pool.format(
            `SELECT * FROM users WHERE email = ?`,
            [form_email]
        )
        return eksekusi( sqlSyntax )
    }

}