
module.exports = {
    halaman_home : async function(req,res) { 
        try {
            const result = await client.query(`
              SELECT 
                lp.id,
                u.nama AS sender,
                p.nama_produk AS product_name,
                d.nama_distributor AS distributor,
                at.tujuan AS send_to,
                lp.tanggal_kirim
              FROM laporan_pengiriman lp
              JOIN users u ON lp.sender_id = u.id
              JOIN produk p ON lp.product_id = p.id
              JOIN distributor d ON lp.distributor_id = d.id
              JOIN added_to at ON lp.send_to_id = at.id
              ORDER BY lp.tanggal_kirim DESC
            `);
            
            const laporanData = result.rows;
            res.render('home', { laporan: laporanData });
        res.render('index')
    }catch (err) {
        console.error(err);
        res.status(500).send('Terjadi kesalahan pada server');
      }
}
}