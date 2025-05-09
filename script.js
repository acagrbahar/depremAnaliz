// script.js

document.addEventListener('DOMContentLoaded', function () {
    console.log("Deprem Analiz Projesi: HTML DOM yüklendi. Leaflet.draw entegrasyonu ve harita fonksiyonları başlatılıyor.");

    // --- Harita Ayarları ---
    const map = L.map('map').setView([39.0, 35.0], 6); // Türkiye merkezi ve zoom
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        maxZoom: 18,
    }).addTo(map);
    console.log("Leaflet haritası başarıyla yüklendi.");

    // --- Deprem İşaretçileri İçin Katman Grubu ---
    // Bu grup, tüm deprem işaretçilerini bir arada tutacak ve kolayca temizlenmelerini sağlayacak.
    const earthquakeLayerGroup = L.layerGroup().addTo(map);
    console.log("Deprem işaretçileri için katman grubu oluşturuldu ve haritaya eklendi mi?", map.hasLayer(earthquakeLayerGroup));

    // --- Leaflet.draw Ayarları (Alan Seçimi İçin) ---
    const drawnItems = new L.FeatureGroup(); // Kullanıcının çizdiği şekilleri tutar
    map.addLayer(drawnItems); // Bu katman grubunu haritaya ekle

    const drawControl = new L.Control.Draw({
        edit: {
            featureGroup: drawnItems, // Düzenlenecek/silinecek şekiller bu gruptan olacak
            remove: true // Silme aracını aktif et
        },
        draw: { // Sadece dikdörtgen çizimine izin ver, diğerlerini kapat
            polygon: false,
            polyline: false,
            circle: false,
            circlemarker: false,
            marker: false,
            rectangle: {
                shapeOptions: { // Dikdörtgenin çizim stili
                    color: '#007bff', // Mavi
                    fillOpacity: 0.1
                }
            }
        }
    });
    map.addControl(drawControl); // Çizim kontrol araçlarını haritaya ekle
    console.log("Leaflet.draw kontrolleri haritaya eklendi.");
    console.log("drawControl nesnesi:", drawControl); // drawControl nesnesinin oluştuğunu kontrol et

    let selectedBounds = null; // Kullanıcının çizdiği alanı (dikdörtgenin sınırlarını) saklar

    // Bir şekil çizildiğinde (oluşturulduğunda) tetiklenecek olay
    map.on('draw:created', function (e) {
        const type = e.layerType,
              layer = e.layer;

        drawnItems.clearLayers(); // Önceki çizimleri temizle (sadece son çizim kalsın)
        drawnItems.addLayer(layer); // Yeni çizilen katmanı gruba ekle

        if (type === 'rectangle') {
            selectedBounds = layer.getBounds(); // Dikdörtgenin sınırlarını al
            console.log("Dikdörtgen çizildi. Sınırlar (BBox):", selectedBounds.toBBoxString());
            alert("Alan seçildi. 'Depremleri Getir' butonu artık bu alanı kullanacaktır.");
        }
    });

    // Bir şekil düzenlendiğinde tetiklenecek olay
    map.on('draw:edited', function (e) {
        const layers = e.layers;
        layers.eachLayer(function (layer) {
            if (layer instanceof L.Rectangle) { // Sadece dikdörtgenler için
                selectedBounds = layer.getBounds();
                console.log("Dikdörtgen düzenlendi. Yeni sınırlar (BBox):", selectedBounds.toBBoxString());
            }
        });
    });

    // Bir şekil silindiğinde tetiklenecek olay
    map.on('draw:deleted', function () {
        selectedBounds = null; // Seçili alanı sıfırla
        drawnItems.clearLayers(); // Haritadaki çizimi de temizle
        console.log("Çizim silindi. Seçili alan sıfırlandı.");
        alert("Seçili alan kaldırıldı. Filtreleme varsayılan Türkiye sınırlarına dönecektir.");
    });

    // --- Filtre Elemanlarına Erişim ---
    const startDateInput = document.getElementById('startDate');
    const endDateInput = document.getElementById('endDate');
    const minMagnitudeInput = document.getElementById('minMagnitude');
    const fetchDataButton = document.getElementById('fetchDataButton');
    const totalQuakesSpan = document.getElementById('totalQuakes');

    // --- Başlangıç Filtre Değerlerini Ayarlama ---
    const today = new Date();
    const thirtyDaysAgo = new Date(new Date().setDate(today.getDate() - 30)); // Son 30 gün
    endDateInput.value = today.toISOString().split('T')[0]; // YYYY-MM-DD formatı
    startDateInput.value = thirtyDaysAgo.toISOString().split('T')[0]; // YYYY-MM-DD formatı
    console.log("Filtre elemanlarına erişildi ve başlangıç tarihleri ayarlandı.");

    // --- Depremleri Haritada Gösterme Fonksiyonu ---
    function displayEarthquakesOnMap(earthquakeDataFeatures) {
        console.log("--- displayEarthquakesOnMap fonksiyonu ÇAĞRILDI ---");
        console.log("Gelen deprem verisi (ilk 3 örnek):", earthquakeDataFeatures ? earthquakeDataFeatures.slice(0, 3) : "Veri yok");
        console.log("earthquakeLayerGroup mevcut mu?", earthquakeLayerGroup ? "Evet" : "Hayır");

        if (!earthquakeLayerGroup) {
            console.error("KRİTİK HATA: earthquakeLayerGroup tanımlanmamış veya haritaya eklenmemiş!");
            return;
        }
        earthquakeLayerGroup.clearLayers(); // Önceki deprem işaretçilerini temizle
        console.log("Haritadaki eski deprem işaretçileri (earthquakeLayerGroup içindekiler) temizlendi.");

        if (!earthquakeDataFeatures || earthquakeDataFeatures.length === 0) {
            console.log("Haritada gösterilecek deprem verisi bulunamadı (fonksiyon içi kontrol).");
            return;
        }

        earthquakeDataFeatures.forEach((quake, index) => {
            console.log(`--- Döngü ${index + 1}. deprem işleniyor ---`);
            // Verinin kopyasını logla (orijinalini değiştirmemek veya döngüde sorun yaşamamak için)
            console.log("Ham deprem verisi (quake):", JSON.parse(JSON.stringify(quake)));

            const coordinates = quake.geometry.coordinates; // [boylam, enlem, derinlik]
            const properties = quake.properties;

            if (!coordinates || coordinates.length < 2) { // En az enlem ve boylam olmalı
                console.warn(`Deprem ${index + 1} için geçersiz koordinat verisi:`, coordinates);
                return; // Bu depremi atla, sonrakiyle devam et
            }
            if (!properties) {
                console.warn(`Deprem ${index + 1} için geçersiz özellik (properties) verisi.`);
                return; // Bu depremi atla
            }

            const enlem = coordinates[1]; // GeoJSON formatında 2. eleman enlemdir
            const boylam = coordinates[0]; // GeoJSON formatında 1. eleman boylamdır
            // Derinlik bilgisi bazen null olabilir veya olmayabilir
            const derinlik = (coordinates.length > 2 && coordinates[2] !== null) ? coordinates[2] : 'Bilinmiyor';
            const buyukluk = properties.mag;
            const yer = properties.place || 'Bilinmiyor';
            const zamanEpoch = properties.time; // Milisaniye cinsinden zaman
            const zaman = zamanEpoch ? new Date(zamanEpoch).toLocaleString('tr-TR', { dateStyle: 'medium', timeStyle: 'medium' }) : 'Bilinmiyor';

            console.log(`Alınan Değerler: Enlem=${enlem}, Boylam=${boylam}, Büyüklük=${buyukluk}, Derinlik=${derinlik}`);

            // Koordinatların ve büyüklüğün geçerli sayılar olduğundan emin olalım
            if (typeof enlem !== 'number' || typeof boylam !== 'number' || isNaN(enlem) || isNaN(boylam)) {
                console.warn(`Deprem ${index + 1} için geçersiz Enlem/Boylam değerleri: Enlem=${enlem}, Boylam=${boylam}`);
                return;
            }

            // Büyüklüğe göre renk
            function getColor(d) {
                if (typeof d !== 'number' || isNaN(d)) return '#999999'; // Tanımsız/geçersiz büyüklük için gri
                return d > 6  ? '#a50026' : // Koyu Kırmızı
                       d > 5  ? '#d73027' : // Kırmızı
                       d > 4  ? '#f46d43' : // Turuncu
                       d > 3  ? '#fee090' : // Açık Sarı
                       d > 2  ? '#abd9e9' : // Açık Mavi
                                  '#74add1'; // Mavi
            }

            // Büyüklüğe göre yarıçap
            function getRadius(mag) {
                if (typeof mag !== 'number' || isNaN(mag)) return 3; // Tanımsız/geçersiz büyüklük için min yarıçap
                return Math.max(3, mag * 2.5); // Minimum yarıçap 3, büyüklükle orantılı (değeri ayarlayabilirsiniz)
            }

            const markerOptions = {
                radius: getRadius(buyukluk),
                fillColor: getColor(buyukluk),
                color: "#000", // Dış çizgi rengi
                weight: 1,     // Dış çizgi kalınlığı
                opacity: 1,    // Dış çizgi opaklığı
                fillOpacity: 0.7 // Dolgu opaklığı
            };
            console.log(`Marker seçenekleri (Deprem ${index + 1}):`, markerOptions);

            try {
                const circleMarker = L.circleMarker([enlem, boylam], markerOptions); // Leaflet [enlem, boylam] sırasını bekler
                console.log(`CircleMarker (Deprem ${index + 1}) başarıyla oluşturuldu:`, circleMarker);

                circleMarker.bindPopup(
                    `<b>Yer:</b> ${yer}<br>` +
                    `<b>Büyüklük:</b> ${typeof buyukluk === 'number' ? buyukluk.toFixed(1) : 'N/A'} M<br>` +
                    `<b>Derinlik:</b> ${typeof derinlik === 'number' ? derinlik.toFixed(1) : derinlik} km<br>` +
                    `<b>Zaman:</b> ${zaman}`
                );
                circleMarker.addTo(earthquakeLayerGroup); // İşaretleyiciyi katman grubuna ekle
                console.log(`CircleMarker (Deprem ${index + 1}) haritaya (earthquakeLayerGroup) BAŞARIYLA EKLENDİ.`);
            } catch (markerError) {
                console.error(`Deprem ${index + 1} için marker oluşturma/ekleme sırasında HATA:`, markerError, "Kullanılan deprem verisi:", quake);
            }
        });
        console.log("--- displayEarthquakesOnMap fonksiyonu TAMAMLANDI ---");
    }

    // --- "Depremleri Getir" Butonu İçin Olay Dinleyici ---
    fetchDataButton.addEventListener('click', async function() {
        const startDate = startDateInput.value;
        const endDate = endDateInput.value;
        const minMagnitude = parseFloat(minMagnitudeInput.value);

        // Temel giriş doğrulamaları
        if (!startDate || !endDate) {
            alert("Lütfen başlangıç ve bitiş tarihlerini seçin.");
            return;
        }
        if (isNaN(minMagnitude) || minMagnitude < 0 || minMagnitude > 10) {
            alert("Lütfen geçerli bir minimum büyüklük girin (0-10 arası).");
            return;
        }

        // API için tarih formatı: YYYY-MM-DDTHH:mm:ss
        const startTime = `${startDate}T00:00:00`;
        const endTime = `${endDate}T23:59:59`; // Günün sonunu dahil et

        console.log("--- Deprem Verisi Çekme İsteği Başlatılıyor ---");
        totalQuakesSpan.textContent = "Yükleniyor...";
        if (earthquakeLayerGroup) { // earthquakeLayerGroup varsa (her zaman olmalı) eski işaretçileri temizle
            earthquakeLayerGroup.clearLayers();
        }

        let apiMinLatitude, apiMaxLatitude, apiMinLongitude, apiMaxLongitude;

        if (selectedBounds) { // Kullanıcı bir alan çizdiyse
            apiMinLatitude = selectedBounds.getSouthWest().lat;
            apiMinLongitude = selectedBounds.getSouthWest().lng;
            apiMaxLatitude = selectedBounds.getNorthEast().lat;
            apiMaxLongitude = selectedBounds.getNorthEast().lng;
            console.log("Kullanıcının seçtiği alan kullanılacak. Sınırlar:", `Lat: ${apiMinLatitude}-${apiMaxLatitude}, Lng: ${apiMinLongitude}-${apiMaxLongitude}`);
        } else { // Varsayılan Türkiye sınırları
            apiMinLatitude = 35.5;
            apiMaxLatitude = 42.5;
            apiMinLongitude = 25.5;
            apiMaxLongitude = 45.0;
            console.log("Varsayılan Türkiye sınırları kullanılacak.");
        }

        // USGS API URL'ini oluştur
        const apiUrl = `https://earthquake.usgs.gov/fdsnws/event/1/query?format=geojson&starttime=${startTime}&endtime=${endTime}&minlatitude=${apiMinLatitude}&maxlatitude=${apiMaxLatitude}&minlongitude=${apiMinLongitude}&maxlongitude=${apiMaxLongitude}&minmagnitude=${minMagnitude}&orderby=time`;
        console.log("API URL:", apiUrl);

        try {
            const response = await fetch(apiUrl); // API'ye istek gönder
            if (!response.ok) { // HTTP durumu başarılı değilse (200-299 dışındaysa)
                const errorText = await response.text(); // Sunucudan gelen hata metnini al
                throw new Error(`API'den Hata: ${response.status} ${response.statusText}. Detay: ${errorText}`);
            }
            const data = await response.json(); // Yanıtı JSON olarak işle
            console.log("--- API Yanıtı Başarıyla Alındı ---");
            console.log("Toplam bulunan deprem sayısı (API'den):", data.features ? data.features.length : 0);

            if (data.features && data.features.length > 0) {
                totalQuakesSpan.textContent = data.features.length.toString();
                console.log(">>> displayEarthquakesOnMap ÇAĞRILACAK. Veri sayısı:", data.features.length);
                displayEarthquakesOnMap(data.features); // Depremleri haritada göster
            } else {
                totalQuakesSpan.textContent = "0 (Veri bulunamadı)";
                console.log("Belirtilen kriterlere uygun deprem bulunamadı.");
                // Harita zaten temizlenmişti, tekrar temizlemeye gerek yok
            }
        } catch (error) {
            console.error("--- API İsteğinde veya Veri İşlemede Hata Oluştu ---");
            console.error(error);
            totalQuakesSpan.textContent = "Hata!";
            alert(`Veri çekme sırasında bir hata oluştu: ${error.message}\nLütfen konsolu kontrol edin.`);
            // Hata durumunda da harita temiz kalmalı (zaten başta temizleniyor)
        }
    });
});