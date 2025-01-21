const pool = require('../config/database');

// Mengambil semua kategori
const getCategories = async () => {
  const result = await pool.query('SELECT * FROM category');
  return result.rows;
};

// Menambahkan kategori baru
const addCategory = async (name) => {
  await pool.query('INSERT INTO category (nama_category) VALUES ($1)', [name]);
};

// Mengambil kategori berdasarkan ID
const getCategoryById = async (id) => {
  const result = await pool.query('SELECT * FROM category WHERE id = $1', [id]);
  return result.rows[0];
};

// Memperbarui kategori
const updateCategory = async (id, name) => {
  await pool.query('UPDATE category SET nama_category = $1 WHERE id = $2', [name, id]);
};

// Menghapus kategori
const deleteCategory = async (id) => {
  await pool.query('DELETE FROM category WHERE id = $1', [id]);
};

module.exports = { getCategories, addCategory, getCategoryById, updateCategory, deleteCategory };
