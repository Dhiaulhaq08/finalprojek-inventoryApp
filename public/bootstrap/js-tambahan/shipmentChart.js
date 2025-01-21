document.addEventListener('DOMContentLoaded', async () => {
    try {
        // Ambil data dari endpoint
        const response = await fetch('/chart');
        const data = await response.json();

        // Ekstrak data untuk grafik
        const labels = data.map(item => `${item.tanggal_kirim} (${item.nama_produk})`);
        const jumlahKirim = data.map(item => item.jumlah_kirim);

        // Konfigurasi Chart.js
        const ctx = document.getElementById('shipmentChart').getContext('2d');
        new Chart(ctx, {
            type: 'bar', // Bisa diganti dengan 'line', 'pie', dll.
            data: {
                labels: labels,
                datasets: [{
                    label: 'Jumlah Kirim',
                    data: jumlahKirim,
                    backgroundColor: 'rgba(75, 192, 192, 0.5)',
                    borderColor: 'rgba(75, 192, 192, 1)',
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                scales: {
                    y: {
                        beginAtZero: true
                    }
                },
                plugins: {
                    legend: {
                        display: true,
                        position: 'top',
                    },
                }
            }
        });
    } catch (error) {
        console.error('Error fetching shipment data:', error);
    }
});
