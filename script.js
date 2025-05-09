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

    // --- "Depremleri Getir" Butonu İçin GÜNCELLENMİŞ Olay Dinleyici ---
    fetchDataButton.addEventListener('click', async function() { // Fonksiyonu async olarak işaretliyoruz
        const startDate = startDateInput.value;
        const endDate = endDateInput.value;
        const minMagnitude = parseFloat(minMagnitudeInput.value);

        if (!startDate || !endDate) {
            alert("Lütfen başlangıç ve bitiş tarihlerini seçin.");
            return;
        }
        if (isNaN(minMagnitude) || minMagnitude < 0 || minMagnitude > 10) {
            alert("Lütfen geçerli bir minimum büyüklük girin (0-10 arası).");
            return;
        }

        // Tarih formatını USGS API'sinin beklediği şekilde (YYYY-MM-DDTHH:mm:ss) ayarlayalım.
        // Günün başlangıcı ve sonu için saatleri ekliyoruz.
        const startTime = `${startDate}T00:00:00`;
        // Bitiş tarihi için günün sonunu (23:59:59) almak daha doğru sonuçlar verebilir.
        const endTime = `${endDate}T23:59:59`;

        console.log("--- Deprem Verisi Çekme İsteği Başlatılıyor ---");
        console.log("Başlangıç Zamanı (API için):", startTime);
        console.log("Bitiş Zamanı (API için):", endTime);
        console.log("Minimum Büyüklük:", minMagnitude);
        totalQuakesSpan.textContent = "Yükleniyor...";

        // Türkiye için coğrafi sınırlar
        const minLatitude = 35.5;
        const maxLatitude = 42.5;
        const minLongitude = 25.5;
        const maxLongitude = 45.0;

        // USGS API Endpoint URL'i
        const apiUrl = `https://earthquake.usgs.gov/fdsnws/event/1/query?format=geojson&starttime=${startTime}&endtime=${endTime}&minlatitude=${minLatitude}&maxlatitude=${maxLatitude}&minlongitude=${minLongitude}&maxlongitude=${maxLongitude}&minmagnitude=${minMagnitude}&orderby=time`;

        console.log("API URL:", apiUrl);

        try {
            // Fetch API kullanarak veri çekme
            const response = await fetch(apiUrl); // await ile isteğin tamamlanmasını bekliyoruz

            if (!response.ok) { // HTTP durum kodu 200-299 aralığında değilse
                const errorText = await response.text(); // Sunucudan gelen hata mesajını oku
                throw new Error(`API'den Hata: ${response.status} ${response.statusText}. Detay: ${errorText}`);
            }

            const data = await response.json(); // Yanıtı JSON olarak işle

            console.log("--- API Yanıtı Başarıyla Alındı ---");
            console.log(data); // Gelen tüm veriyi konsola yazdır
            console.log("Toplam bulunan deprem sayısı (API'den):", data.features.length);

            if (data.features && data.features.length > 0) {
                totalQuakesSpan.textContent = data.features.length.toString();
                console.log("İlk depremin detayları:", data.features[0].properties);
                // TODO (Sonraki Adım 4): Bu 'data.features' dizisini haritada göstereceğiz.
                // TODO (Sonraki Adım 5): Bu veriden istatistikleri oluşturacağız.
            } else {
                totalQuakesSpan.textContent = "0 (Veri bulunamadı)";
                console.log("Belirtilen kriterlere uygun deprem bulunamadı.");
            }

        } catch (error) {
            console.error("--- API İsteğinde veya Veri İşlemede Hata Oluştu ---");
            console.error(error);
            totalQuakesSpan.textContent = "Hata!";
            alert(`Veri çekme sırasında bir hata oluştu: ${error.message}\nLütfen konsolu kontrol edin.`);
        }
    });

});