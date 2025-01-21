const pool = require('../config/database');
// Mengambil semua distributor
const getDistributors = async () => {
  const result = await pool.query('SELECT * FROM distributors');
  return result.rows;
};

// Menambahkan distributor baru
const addDistributor = async (name, category_id) => {
  await pool.query('INSERT INTO distributors (nama_distributor, id) VALUES ($1, $2)', [name, category_id]);
};

// Mengambil distributor berdasarkan ID
const getDistributorById = async (id) => {
  const result = await pool.query('SELECT * FROM distributors WHERE id = $1', [id]);
  return result.rows[0];
};

// Memperbarui distributor
const updateDistributor = async (id, name, category_id) => {
  await pool.query('UPDATE distributors SET nama_distributor = $1, id = $2 WHERE id = $3', [name, category_id, id]);
};

// Menghapus distributor
const deleteDistributor = async (id) => {
  await pool.query('DELETE FROM distributors WHERE id = $1', [id]);
};

module.exports = { getDistributors, addDistributor, getDistributorById, updateDistributor, deleteDistributor };
