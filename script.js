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
    const earthquakeLayerGroup = L.layerGroup().addTo(map);
    console.log("Deprem işaretçileri için katman grubu oluşturuldu ve haritaya eklendi mi?", map.hasLayer(earthquakeLayerGroup));

    // --- Leaflet.draw Ayarları (Alan Seçimi İçin) ---
    const drawnItems = new L.FeatureGroup();
    map.addLayer(drawnItems);

    const drawControl = new L.Control.Draw({
        edit: {
            featureGroup: drawnItems,
            remove: true
        },
        draw: {
            polygon: false, polyline: false, circle: false, circlemarker: false, marker: false,
            rectangle: {
                shapeOptions: { color: '#007bff', fillOpacity: 0.1 }
            }
        }
    });
    map.addControl(drawControl);
    console.log("Leaflet.draw kontrolleri haritaya eklendi.");
    console.log("drawControl nesnesi:", drawControl);

    let selectedBounds = null;

    map.on('draw:created', function (e) {
        const type = e.layerType, layer = e.layer;
        drawnItems.clearLayers();
        drawnItems.addLayer(layer);
        if (type === 'rectangle') {
            selectedBounds = layer.getBounds();
            console.log("Dikdörtgen çizildi. Sınırlar (BBox):", selectedBounds.toBBoxString());
            alert("Alan seçildi. 'Depremleri Getir' butonu artık bu alanı kullanacaktır.");
        }
    });

    map.on('draw:edited', function (e) {
        const layers = e.layers;
        layers.eachLayer(function (layer) {
            if (layer instanceof L.Rectangle) {
                selectedBounds = layer.getBounds();
                console.log("Dikdörtgen düzenlendi. Yeni sınırlar (BBox):", selectedBounds.toBBoxString());
            }
        });
    });

    map.on('draw:deleted', function () {
        selectedBounds = null;
        drawnItems.clearLayers();
        console.log("Çizim silindi. Seçili alan sıfırlandı.");
        alert("Seçili alan kaldırıldı. Filtreleme varsayılan Türkiye sınırlarına dönecektir.");
    });

    // --- Filtre ve İstatistik Elemanlarına Erişim ---
    const startDateInput = document.getElementById('startDate');
    const endDateInput = document.getElementById('endDate');
    const minMagnitudeInput = document.getElementById('minMagnitude');
    const fetchDataButton = document.getElementById('fetchDataButton');
    const totalQuakesSpan = document.getElementById('totalQuakes');
    // *** İSTATİSTİK SPAN'LARI İÇİN TANIMLAMALAR BURAYA TAŞINDI VE DOĞRU KAPSAMA ALINDI ***
    const maxMagnitudeQuakeSpan = document.getElementById('maxMagnitudeQuake');
    const avgMagnitudeSpan = document.getElementById('avgMagnitude');
    const deepestQuakeSpan = document.getElementById('deepestQuake');
    const shallowestQuakeSpan = document.getElementById('shallowestQuake');

    // --- Başlangıç Filtre Değerlerini Ayarlama ---
    const today = new Date();
    const thirtyDaysAgo = new Date(new Date().setDate(today.getDate() - 30));
    endDateInput.value = today.toISOString().split('T')[0];
    startDateInput.value = thirtyDaysAgo.toISOString().split('T')[0];
    console.log("Filtre elemanlarına erişildi ve başlangıç tarihleri ayarlandı.");

    // --- Depremleri Haritada Gösterme Fonksiyonu ---
    function displayEarthquakesOnMap(earthquakeDataFeatures) {
        console.log("--- displayEarthquakesOnMap fonksiyonu ÇAĞRILDI ---");
        // console.log("Gelen deprem verisi (ilk 3 örnek):", earthquakeDataFeatures ? earthquakeDataFeatures.slice(0, 3) : "Veri yok"); // Detaylı log, gerekirse açılabilir
        console.log("earthquakeLayerGroup mevcut mu?", earthquakeLayerGroup ? "Evet" : "Hayır");

        if (!earthquakeLayerGroup) {
            console.error("KRİTİK HATA: earthquakeLayerGroup tanımlanmamış veya haritaya eklenmemiş!");
            return;
        }
        earthquakeLayerGroup.clearLayers();
        console.log("Haritadaki eski deprem işaretçileri (earthquakeLayerGroup içindekiler) temizlendi.");

        if (!earthquakeDataFeatures || earthquakeDataFeatures.length === 0) {
            console.log("Haritada gösterilecek deprem verisi bulunamadı (fonksiyon içi kontrol).");
            return;
        }

        earthquakeDataFeatures.forEach((quake, index) => {
            // console.log(`--- Döngü ${index + 1}. deprem işleniyor ---`); // Çok fazla log üretebilir, kapalı tutulabilir
            // console.log("Ham deprem verisi (quake):", JSON.parse(JSON.stringify(quake))); // Detaylı log

            const coordinates = quake.geometry.coordinates;
            const properties = quake.properties;

            if (!coordinates || coordinates.length < 2) {
                console.warn(`Deprem ${index + 1} için geçersiz koordinat verisi:`, coordinates);
                return;
            }
            if (!properties) {
                console.warn(`Deprem ${index + 1} için geçersiz özellik (properties) verisi.`);
                return;
            }

            const enlem = coordinates[1];
            const boylam = coordinates[0];
            const derinlik = (coordinates.length > 2 && coordinates[2] !== null) ? coordinates[2] : 'Bilinmiyor';
            const buyukluk = properties.mag;
            const yer = properties.place || 'Bilinmiyor';
            const zamanEpoch = properties.time;
            const zaman = zamanEpoch ? new Date(zamanEpoch).toLocaleString('tr-TR', { dateStyle: 'medium', timeStyle: 'medium' }) : 'Bilinmiyor';

            // console.log(`Alınan Değerler: Enlem=${enlem}, Boylam=${boylam}, Büyüklük=${buyukluk}, Derinlik=${derinlik}`); // Detaylı log

            if (typeof enlem !== 'number' || typeof boylam !== 'number' || isNaN(enlem) || isNaN(boylam)) {
                console.warn(`Deprem ${index + 1} için geçersiz Enlem/Boylam değerleri: Enlem=${enlem}, Boylam=${boylam}`);
                return;
            }

            function getColor(d) {
                if (typeof d !== 'number' || isNaN(d)) return '#999999';
                return d > 6  ? '#a50026' : d > 5  ? '#d73027' : d > 4  ? '#f46d43' : d > 3  ? '#fee090' : d > 2  ? '#abd9e9' : '#74add1';
            }

            function getRadius(mag) {
                if (typeof mag !== 'number' || isNaN(mag)) return 3;
                return Math.max(3, mag * 2.5);
            }

            const markerOptions = {
                radius: getRadius(buyukluk), fillColor: getColor(buyukluk), color: "#000", weight: 1, opacity: 1, fillOpacity: 0.7
            };
            // console.log(`Marker seçenekleri (Deprem ${index + 1}):`, markerOptions); // Detaylı log

            try {
                const circleMarker = L.circleMarker([enlem, boylam], markerOptions);
                // console.log(`CircleMarker (Deprem ${index + 1}) başarıyla oluşturuldu:`, circleMarker); // Detaylı log
                circleMarker.bindPopup(
                    `<b>Yer:</b> ${yer}<br>` +
                    `<b>Büyüklük:</b> ${typeof buyukluk === 'number' ? buyukluk.toFixed(1) : 'N/A'} M<br>` +
                    `<b>Derinlik:</b> ${typeof derinlik === 'number' ? derinlik.toFixed(1) : derinlik} km<br>` +
                    `<b>Zaman:</b> ${zaman}`
                );
                circleMarker.addTo(earthquakeLayerGroup);
                // console.log(`CircleMarker (Deprem ${index + 1}) haritaya (earthquakeLayerGroup) BAŞARIYLA EKLENDİ.`); // Detaylı log
            } catch (markerError) {
                console.error(`Deprem ${index + 1} için marker oluşturma/ekleme sırasında HATA:`, markerError, "Kullanılan deprem verisi:", quake);
            }
        });
        console.log("--- displayEarthquakesOnMap fonksiyonu TAMAMLANDI ---");
    }

    // Fonksiyon: Temel istatistikleri hesaplar ve gösterir
    function calculateAndDisplayStats(earthquakeDataFeatures) {
        console.log("--- calculateAndDisplayStats fonksiyonu ÇAĞRILDI ---");

        if (!earthquakeDataFeatures || earthquakeDataFeatures.length === 0) {
            console.log("İstatistik hesaplamak için deprem verisi bulunamadı.");
            // Değişkenlerin doğru kapsamda tanımlandığından emin olarak erişim
            maxMagnitudeQuakeSpan.textContent = "-- M, --";
            avgMagnitudeSpan.textContent = "-- M";
            deepestQuakeSpan.textContent = "-- km, --";
            shallowestQuakeSpan.textContent = "-- km, --";
            return;
        }

        let maxMag = -Infinity;
        let maxMagQuakeDetails = "-- M, --";
        let totalMag = 0;
        let deepest = -Infinity;
        let deepestQuakeDetails = "-- km, --";
        let shallowest = Infinity;
        let shallowestQuakeDetails = "-- km, --";
        let validMagnitudeCount = 0;

        earthquakeDataFeatures.forEach(quake => {
            const properties = quake.properties;
            const coordinates = quake.geometry.coordinates;
            const magnitude = properties.mag;
            const depth = (coordinates.length > 2 && coordinates[2] !== null) ? coordinates[2] : null;
            const place = properties.place || 'Bilinmeyen yer';
            const time = properties.time ? new Date(properties.time).toLocaleDateString('tr-TR') : '';

            if (typeof magnitude === 'number' && !isNaN(magnitude)) {
                totalMag += magnitude;
                validMagnitudeCount++;
                if (magnitude > maxMag) {
                    maxMag = magnitude;
                    maxMagnitudeQuakeDetails = `${maxMag.toFixed(1)} M, ${place} (${time})`;
                }
            }

            if (typeof depth === 'number' && !isNaN(depth)) {
                if (depth > deepest) {
                    deepest = depth;
                    deepestQuakeDetails = `${deepest.toFixed(1)} km, ${place} (${time})`;
                }
                if (depth < shallowest) {
                    shallowest = depth;
                    shallowestQuakeDetails = `${shallowest.toFixed(1)} km, ${place} (${time})`;
                }
            }
        });

        const avgMag = validMagnitudeCount > 0 ? (totalMag / validMagnitudeCount) : 0;

        maxMagnitudeQuakeSpan.textContent = maxMag !== -Infinity ? maxMagnitudeQuakeDetails : "-- M, --";
        avgMagnitudeSpan.textContent = validMagnitudeCount > 0 ? `${avgMag.toFixed(1)} M` : "-- M";
        deepestQuakeSpan.textContent = deepest !== -Infinity ? deepestQuakeDetails : "-- km, --";
        shallowestQuakeSpan.textContent = shallowest !== Infinity ? shallowestQuakeDetails : "-- km, --";

        console.log("İstatistikler hesaplandı ve gösterildi:", {
            maxMag: maxMagnitudeQuakeDetails, avgMag: `${avgMag.toFixed(1)} M`,
            deepest: deepestQuakeDetails, shallowest: shallowestQuakeDetails
        });
        console.log("--- calculateAndDisplayStats fonksiyonu TAMAMLANDI ---");
    }

    // --- "Depremleri Getir" Butonu İçin Olay Dinleyici ---
    fetchDataButton.addEventListener('click', async function() {
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

        const startTime = `${startDate}T00:00:00`;
        const endTime = `${endDate}T23:59:59`;

        console.log("--- Deprem Verisi Çekme İsteği Başlatılıyor ---");
        totalQuakesSpan.textContent = "Yükleniyor...";
        // İstatistikleri de "Yükleniyor..." veya "--" olarak ayarla (artık doğru kapsamdaki değişkenler kullanılacak)
        maxMagnitudeQuakeSpan.textContent = "Yükleniyor...";
        avgMagnitudeSpan.textContent = "Yükleniyor...";
        deepestQuakeSpan.textContent = "Yükleniyor...";
        shallowestQuakeSpan.textContent = "Yükleniyor...";

        if (earthquakeLayerGroup) {
            earthquakeLayerGroup.clearLayers();
        }

        let apiMinLatitude, apiMaxLatitude, apiMinLongitude, apiMaxLongitude;

        if (selectedBounds) {
            apiMinLatitude = selectedBounds.getSouthWest().lat;
            apiMinLongitude = selectedBounds.getSouthWest().lng;
            apiMaxLatitude = selectedBounds.getNorthEast().lat;
            apiMaxLongitude = selectedBounds.getNorthEast().lng;
            console.log("Kullanıcının seçtiği alan kullanılacak. Sınırlar:", `Lat: ${apiMinLatitude}-${apiMaxLatitude}, Lng: ${apiMinLongitude}-${apiMaxLongitude}`);
        } else {
            apiMinLatitude = 35.5; apiMaxLatitude = 42.5; apiMinLongitude = 25.5; apiMaxLongitude = 45.0;
            console.log("Varsayılan Türkiye sınırları kullanılacak.");
        }

        const apiUrl = `https://earthquake.usgs.gov/fdsnws/event/1/query?format=geojson&starttime=${startTime}&endtime=${endTime}&minlatitude=${apiMinLatitude}&maxlatitude=${apiMaxLatitude}&minlongitude=${apiMinLongitude}&maxlongitude=${apiMaxLongitude}&minmagnitude=${minMagnitude}&orderby=time`;
        console.log("API URL:", apiUrl);

        try {
            const response = await fetch(apiUrl);
            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`API'den Hata: ${response.status} ${response.statusText}. Detay: ${errorText}`);
            }
            const data = await response.json();
            console.log("--- API Yanıtı Başarıyla Alındı ---");
            console.log("Toplam bulunan deprem sayısı (API'den):", data.features ? data.features.length : 0);

            if (data.features && data.features.length > 0) {
                totalQuakesSpan.textContent = data.features.length.toString();
                console.log(">>> displayEarthquakesOnMap ÇAĞRILACAK. Veri sayısı:", data.features.length);
                displayEarthquakesOnMap(data.features);
                console.log(">>> calculateAndDisplayStats ÇAĞRILACAK.");
                calculateAndDisplayStats(data.features);
            } else {
                totalQuakesSpan.textContent = "0 (Veri bulunamadı)";
                console.log("Belirtilen kriterlere uygun deprem bulunamadı.");
                calculateAndDisplayStats(null); // İstatistikleri temizle
            }
        } catch (error) {
            console.error("--- API İsteğinde veya Veri İşlemede Hata Oluştu ---");
            console.error(error);
            totalQuakesSpan.textContent = "Hata!";
            alert(`Veri çekme sırasında bir hata oluştu: ${error.message}\nLütfen konsolu kontrol edin.`);
            calculateAndDisplayStats(null); // Hata durumunda istatistikleri temizle
        }
    });
});