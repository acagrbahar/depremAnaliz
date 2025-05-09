// script.js

document.addEventListener('DOMContentLoaded', function () {
    console.log("Deprem Analiz Projesi: HTML DOM yüklendi. Adım 2 başlıyor.");

    // --- Harita Ayarları ---
    // Haritamızı 'map' id'li div'e yerleştiriyoruz.
    // Türkiye'nin genelini gösterecek bir merkez enlem-boylam ve zoom seviyesi belirliyoruz.
    // Örneğin, Türkiye'nin coğrafi merkezi yaklaşık olarak [39.0, 35.0] civarıdır.
    // Zoom seviyesi 6, Türkiye'nin tamamını iyi bir şekilde gösterir.
    const map = L.map('map').setView([39.0, 35.0], 6);

    // Harita katmanını (tile layer) ekliyoruz.
    // OpenStreetMap, ücretsiz ve popüler bir harita sağlayıcısıdır.
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        maxZoom: 18, // Maksimum yakınlaştırma seviyesi
    }).addTo(map);

    console.log("Leaflet haritası başarıyla yüklendi ve ayarlandı.");

    // --- Filtre Elemanlarına Erişim ---
    const startDateInput = document.getElementById('startDate');
    const endDateInput = document.getElementById('endDate');
    const minMagnitudeInput = document.getElementById('minMagnitude');
    const fetchDataButton = document.getElementById('fetchDataButton');
    const totalQuakesSpan = document.getElementById('totalQuakes'); // İstatistik için

    // --- Başlangıç Filtre Değerlerini Ayarlama (Öneri) ---
    // Sayfa yüklendiğinde tarih inputlarına varsayılan değerler atayalım.
    // Örneğin, bitiş tarihi bugün, başlangıç tarihi bugünden 1 ay öncesi olsun.
    const today = new Date();
    const oneMonthAgo = new Date(new Date().setDate(today.getDate() - 30)); // Bugünden 30 gün öncesi

    // Inputların 'value' özelliği YYYY-MM-DD formatında olmalı.
    endDateInput.value = today.toISOString().split('T')[0];
    startDateInput.value = oneMonthAgo.toISOString().split('T')[0];
    // Minimum büyüklük zaten HTML'de 4.0 olarak ayarlanmıştı.

    console.log("Filtre elemanlarına erişildi ve başlangıç tarihleri ayarlandı.");
    console.log("Varsayılan Başlangıç Tarihi:", startDateInput.value);
    console.log("Varsayılan Bitiş Tarihi:", endDateInput.value);

    // --- "Depremleri Getir" Butonu İçin Olay Dinleyici ---
    fetchDataButton.addEventListener('click', function() {
        const startDate = startDateInput.value;
        const endDate = endDateInput.value;
        const minMagnitude = parseFloat(minMagnitudeInput.value); // Sayısal değere çevir

        // Basit bir kontrol: Tarihlerin seçildiğinden emin olalım.
        if (!startDate || !endDate) {
            alert("Lütfen başlangıç ve bitiş tarihlerini seçin.");
            return;
        }

        // Büyüklük değerinin geçerli olduğundan emin olalım.
        if (isNaN(minMagnitude) || minMagnitude < 0 || minMagnitude > 10) {
            alert("Lütfen geçerli bir minimum büyüklük girin (0-10 arası).");
            return;
        }

        console.log("--- Deprem Verisi Çekme İsteği ---");
        console.log("Başlangıç Tarihi:", startDate);
        console.log("Bitiş Tarihi:", endDate);
        console.log("Minimum Büyüklük:", minMagnitude);
        totalQuakesSpan.textContent = "Yükleniyor..."; // Kullanıcıya geri bildirim

        // TODO (Sonraki Adımlar):
        // 1. Bu bilgilerle USGS API'sine istek yapacak fonksiyonu çağır.
        // 2. Gelen veriyi haritada gösterecek fonksiyonu çağır.
        // 3. Gelen veriden istatistikleri hesaplayıp gösterecek fonksiyonu çağır.
        alert(`API İsteği Yapılacak Parametreler:\nBaşlangıç: ${startDate}\nBitiş: ${endDate}\nMin. Büyüklük: ${minMagnitude}\n\n(Bu sadece bir uyarıdır, henüz API'ye bağlanılmadı.)`);
        // totalQuakesSpan.textContent = "Veri yok"; // API isteği sonrası güncellenecek
    });

});