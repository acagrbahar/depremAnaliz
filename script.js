// script.js

document.addEventListener('DOMContentLoaded', function () {
    console.log("Deprem Analiz Projesi: HTML DOM yüklendi. Tüm fonksiyonlar başlatılıyor.");

    // --- Harita Ayarları ---
    const map = L.map('map').setView([39.0, 35.0], 6);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        maxZoom: 18,
    }).addTo(map);

    // --- Katman Grupları ---
    const earthquakeLayerGroup = L.layerGroup().addTo(map);
    const drawnItems = new L.FeatureGroup();
    map.addLayer(drawnItems);

    // --- Leaflet.draw Ayarları ---
    const drawControl = new L.Control.Draw({
        edit: { featureGroup: drawnItems, remove: true },
        draw: {
            polygon: false, polyline: false, circle: false, circlemarker: false, marker: false,
            rectangle: { shapeOptions: { color: '#007bff', fillOpacity: 0.1 } }
        }
    });
    map.addControl(drawControl);

    let selectedBounds = null;

    // --- DOM Elemanlarına Erişim ---
    const startDateInput = document.getElementById('startDate');
    const endDateInput = document.getElementById('endDate');
    const minMagnitudeInput = document.getElementById('minMagnitude');
    const fetchDataButton = document.getElementById('fetchDataButton');
    const totalQuakesSpan = document.getElementById('totalQuakes');
    const maxMagnitudeQuakeSpan = document.getElementById('maxMagnitudeQuake');
    const avgMagnitudeSpan = document.getElementById('avgMagnitude');
    const deepestQuakeSpan = document.getElementById('deepestQuake');
    const shallowestQuakeSpan = document.getElementById('shallowestQuake');
    const messageContainer = document.getElementById('messageContainer');
    console.log("Mesaj Konteyneri Erişimi (messageContainer DOM nesnesi):", messageContainer);

    let timeSeriesChartInstance = null;
    let magnitudeChartInstance = null;

    // --- Başlangıç Filtre Değerleri ---
    const today = new Date();
    const thirtyDaysAgo = new Date(new Date().setDate(today.getDate() - 30));
    endDateInput.value = today.toISOString().split('T')[0];
    startDateInput.value = thirtyDaysAgo.toISOString().split('T')[0];

    // --- MESAJ GÖSTERME FONKSİYONU (BASİTLEŞTİRİLDİ VE DETAYLI LOGLAR EKLENDİ) ---
    // let messageTimeout = null; // Otomatik gizleme kapalı olduğu için bu artık kullanılmıyor

    function showMessage(message, type = 'info', duration = 0) { // duration varsayılanı 0 (kalıcı) test için
        console.log(`---- showMessage BAŞLADI ----`);
        console.log(`Mesaj: "${message}", Tip: "${type}"`);

        if (!messageContainer) {
            console.error("KRİTİK HATA: messageContainer HTML'de bulunamadı! ID'nin 'messageContainer' olduğundan emin olun.");
            alert(`[${type.toUpperCase()}] ${message} (HATA: Mesaj gösterme alanı bulunamadı!)`);
            return;
        }
        console.log("messageContainer bulundu:", messageContainer);

        messageContainer.textContent = message;
        messageContainer.className = 'message-container'; // Temel sınıfı ayarla
        messageContainer.classList.add(type);      // Tip sınıfını ekle
        
        // ** CSS .visible sınıfını kullanarak göstermeyi deneyelim **
        messageContainer.style.display = ''; // display:none'ı kaldırır, CSS'teki .visible belirler
        messageContainer.classList.add('visible'); 
        
        console.log(`Mesaj konteynerinin içeriği ayarlandı: "${messageContainer.textContent}"`);
        console.log(`Mesaj konteynerinin HTML sınıfları: "${messageContainer.className}"`);
        
        setTimeout(() => {
            if (messageContainer && typeof window.getComputedStyle === 'function') {
                const styles = window.getComputedStyle(messageContainer);
                console.log(`Hesaplanan display: "${styles.display}", opacity: "${styles.opacity}", visibility: "${styles.visibility}", transform: "${styles.transform}"`);
            }
        }, 0);

        // Otomatik gizlemeyi test için devre dışı bırakıyoruz
        // if (duration > 0) { ... } 
        console.log(`---- showMessage BİTTİ (Mesajın şimdi CSS .visible ile görünür ve KALICI olması lazım) ----`);
    }

    // Çizim Olayları
    map.on('draw:created', function (e) {
        if (e.layerType === 'rectangle') {
            selectedBounds = e.layer.getBounds();
            drawnItems.clearLayers(); drawnItems.addLayer(e.layer);
            showMessage("Alan seçildi. Filtre bu alana göre uygulanacaktır.", "success");
        }
    });
    map.on('draw:edited', function (e) {
        e.layers.eachLayer(function (layer) {
            if (layer instanceof L.Rectangle) {
                selectedBounds = layer.getBounds();
                showMessage("Seçili alan güncellendi.", "success");
            }
        });
    });
    map.on('draw:deleted', function () {
        selectedBounds = null; drawnItems.clearLayers();
        showMessage("Seçili alan kaldırıldı. Varsayılan sınırlar kullanılacak.", "info");
    });

    // --- HARİTA FONKSİYONLARI ---
    function displayEarthquakesOnMap(earthquakeDataFeatures) {
        earthquakeLayerGroup.clearLayers();
        if (!earthquakeDataFeatures || earthquakeDataFeatures.length === 0) return;
        earthquakeDataFeatures.forEach((quake) => {
            const coords = quake.geometry.coordinates; const props = quake.properties;
            if (!coords || coords.length < 2 || typeof coords[1] !== 'number' || typeof coords[0] !== 'number') return;
            const enlem = coords[1]; const boylam = coords[0];
            const derinlik = (coords.length > 2 && coords[2] !== null) ? coords[2] : 'Bilinmiyor';
            const buyukluk = props.mag; const yer = props.place || 'Bilinmiyor';
            const zaman = props.time ? new Date(props.time).toLocaleString('tr-TR', { dateStyle: 'medium', timeStyle: 'medium' }) : 'Bilinmiyor';
            function getColor(d) { if (typeof d !== 'number' || isNaN(d)) return '#999'; return d > 6 ? '#a50026' : d > 5 ? '#d73027' : d > 4 ? '#f46d43' : d > 3 ? '#fee090' : d > 2 ? '#abd9e9' : '#74add1'; }
            function getRadius(mag) { if (typeof mag !== 'number' || isNaN(mag)) return 3; return Math.max(3, mag * 2.5); }
            const circleMarker = L.circleMarker([enlem, boylam], { radius: getRadius(buyukluk), fillColor: getColor(buyukluk), color: "#000", weight: 1, opacity: 1, fillOpacity: 0.7 });
            circleMarker.bindPopup(`<b>Yer:</b> ${yer}<br><b>Büyüklük:</b> ${typeof buyukluk === 'number' ? buyukluk.toFixed(1) : 'N/A'} M<br><b>Derinlik:</b> ${typeof derinlik === 'number' ? derinlik.toFixed(1) : derinlik} km<br><b>Zaman:</b> ${zaman}`);
            circleMarker.addTo(earthquakeLayerGroup);
        });
    }

    // --- İSTATİSTİK FONKSİYONLARI ---
    function calculateAndDisplayStats(earthquakeDataFeatures) {
        if (!earthquakeDataFeatures || earthquakeDataFeatures.length === 0) {
            maxMagnitudeQuakeSpan.textContent = "-- M, --"; avgMagnitudeSpan.textContent = "-- M";
            deepestQuakeSpan.textContent = "-- km, --"; shallowestQuakeSpan.textContent = "-- km, --"; return;
        }
        let maxMag = -Infinity, maxMagQDetails = "--", totalMag = 0, validMagCount = 0;
        let deepest = -Infinity, deepestQDetails = "--", shallowest = Infinity, shallowestQDetails = "--";
        earthquakeDataFeatures.forEach(quake => {
            const props = quake.properties; const coords = quake.geometry.coordinates;
            const mag = props.mag; const depth = (coords.length > 2 && coords[2] !== null) ? coords[2] : null;
            const place = props.place || 'Bilinmiyor'; const time = props.time ? new Date(props.time).toLocaleDateString('tr-TR') : '';
            if (typeof mag === 'number' && !isNaN(mag)) {
                totalMag += mag; validMagCount++;
                if (mag > maxMag) { maxMag = mag; maxMagQDetails = `${maxMag.toFixed(1)} M, ${place} (${time})`; }
            }
            if (typeof depth === 'number' && !isNaN(depth)) {
                if (depth > deepest) { deepest = depth; deepestQDetails = `${deepest.toFixed(1)} km, ${place} (${time})`; }
                if (depth < shallowest) { shallowest = depth; shallowestQDetails = `${shallowest.toFixed(1)} km, ${place} (${time})`; }
            }
        });
        const avgMag = validMagCount > 0 ? (totalMag / validMagCount) : 0;
        maxMagnitudeQuakeSpan.textContent = maxMag !== -Infinity ? maxMagQDetails : "--";
        avgMagnitudeSpan.textContent = validMagCount > 0 ? `${avgMag.toFixed(1)} M` : "--";
        deepestQuakeSpan.textContent = deepest !== -Infinity ? deepestQDetails : "--";
        shallowestQuakeSpan.textContent = shallowest !== Infinity ? shallowestQDetails : "--";
    }

    // --- GRAFİK FONKSİYONLARI ---
    function formatDateToYMD(date) { return date.toISOString().split('T')[0]; }
    function getStartOfWeek(date) { const d = new Date(date); const day = d.getDay(); const diff = d.getDate() - day + (day === 0 ? -6 : 1); return new Date(d.setDate(diff)); }
    function createTimeSeriesChart(earthquakeDataFeatures, startDateStr, endDateStr) { /* ... (içeriği aynı) ... */ }
    function createMagnitudeDistributionChart(earthquakeDataFeatures) { /* ... (içeriği aynı) ... */ }

    // --- ANA VERİ ÇEKME VE İŞLEME BUTONU ---
    fetchDataButton.addEventListener('click', async function() {
        const startDateStr = startDateInput.value;
        const endDateStr = endDateInput.value;
        const minMagnitude = parseFloat(minMagnitudeInput.value);

        if (!startDateStr || !endDateStr) {
            showMessage("Lütfen başlangıç ve bitiş tarihlerini seçin.", "error"); return;
        }
        if (isNaN(minMagnitude) || minMagnitude < 0 || minMagnitude > 10) {
            showMessage("Lütfen geçerli bir minimum büyüklük girin (0-10 arası).", "error"); return;
        }

        fetchDataButton.disabled = true;
        fetchDataButton.classList.add('loading');
        fetchDataButton.textContent = "Yükleniyor";

        totalQuakesSpan.textContent = "Yükleniyor...";
        maxMagnitudeQuakeSpan.textContent = "Yükleniyor..."; avgMagnitudeSpan.textContent = "Yükleniyor...";
        deepestQuakeSpan.textContent = "Yükleniyor..."; shallowestQuakeSpan.textContent = "Yükleniyor...";

        if (earthquakeLayerGroup) earthquakeLayerGroup.clearLayers();
        if (timeSeriesChartInstance) { timeSeriesChartInstance.destroy(); timeSeriesChartInstance = null; }
        if (magnitudeChartInstance) { magnitudeChartInstance.destroy(); magnitudeChartInstance = null; }
        createTimeSeriesChart(null, startDateStr, endDateStr);
        createMagnitudeDistributionChart(null);
        if (messageContainer) messageContainer.style.display = 'none';

        let apiMinLatitude, apiMaxLatitude, apiMinLongitude, apiMaxLongitude;
        if (selectedBounds) {
            apiMinLatitude = selectedBounds.getSouthWest().lat; apiMinLongitude = selectedBounds.getSouthWest().lng;
            apiMaxLatitude = selectedBounds.getNorthEast().lat; apiMaxLongitude = selectedBounds.getNorthEast().lng;
        } else {
            apiMinLatitude = 35.5; apiMaxLatitude = 42.5; apiMinLongitude = 25.5; apiMaxLongitude = 45.0;
        }

        const apiUrl = `https://earthquake.usgs.gov/fdsnws/event/1/query?format=geojson&starttime=${startDateStr}T00:00:00&endtime=${endDateStr}T23:59:59&minlatitude=${apiMinLatitude}&maxlatitude=${apiMaxLatitude}&minlongitude=${apiMinLongitude}&maxlongitude=${apiMaxLongitude}&minmagnitude=${minMagnitude}&orderby=time`;

        try {
            const response = await fetch(apiUrl);
            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`API'den Hata: ${response.status} ${response.statusText}. Detay: ${errorText}`);
            }
            const data = await response.json();
            const features = data.features || [];
            console.log("Toplam bulunan deprem sayısı (API'den):", features.length);

            totalQuakesSpan.textContent = features.length.toString();
            displayEarthquakesOnMap(features); // Bu ve diğer fonksiyonların tam içerikleri yukarıda olmalı
            calculateAndDisplayStats(features);
            createTimeSeriesChart(features, startDateStr, endDateStr);
            createMagnitudeDistributionChart(features);

            if (features.length > 0) {
                showMessage(`${features.length} deprem başarıyla yüklendi ve gösteriliyor.`, "success");
            } else {
                showMessage("Belirtilen kriterlere uygun deprem bulunamadı.", "info");
            }

        } catch (error) {
            console.error("--- API İsteğinde veya Veri İşlemede Hata Oluştu ---", error);
            totalQuakesSpan.textContent = "Hata!";
            maxMagnitudeQuakeSpan.textContent = "--"; avgMagnitudeSpan.textContent = "--";
            deepestQuakeSpan.textContent = "--"; shallowestQuakeSpan.textContent = "--";
            showMessage(`Veri çekme hatası: ${error.message}. Detaylar için konsolu kontrol edin.`, "error");
        } finally {
            fetchDataButton.disabled = false;
            fetchDataButton.classList.remove('loading');
            fetchDataButton.textContent = "Depremleri Getir";
        }
    });
});