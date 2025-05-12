// script.js

document.addEventListener('DOMContentLoaded', function () {
    console.log("Deprem Analiz Projesi: HTML DOM yüklendi. Tüm fonksiyonlar başlatılıyor.");

    // --- Harita Ayarları ---
    const map = L.map('map').setView([39.0, 35.0], 6);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        maxZoom: 18,
    }).addTo(map);
    // console.log("Leaflet haritası başarıyla yüklendi.");

    // --- Katman Grupları ---
    const earthquakeLayerGroup = L.layerGroup().addTo(map);
    const drawnItems = new L.FeatureGroup();
    map.addLayer(drawnItems);
    // console.log("Katman grupları oluşturuldu ve haritaya eklendi.");

    // --- Leaflet.draw Ayarları ---
    const drawControl = new L.Control.Draw({
        edit: { featureGroup: drawnItems, remove: true },
        draw: {
            polygon: false, polyline: false, circle: false, circlemarker: false, marker: false,
            rectangle: { shapeOptions: { color: '#007bff', fillOpacity: 0.1 } }
        }
    });
    map.addControl(drawControl);
    // console.log("Leaflet.draw kontrolleri haritaya eklendi.");

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
    // console.log("Filtreler için başlangıç tarihleri ayarlandı.");

    // --- MESAJ GÖSTERME FONKSİYONU ---
    let messageTimeout = null;

    function showMessage(message, type = 'info', duration = 4000) { // Otomatik gizleme için duration geri eklendi
        console.log(`---- showMessage BAŞLADI ----`);
        console.log(`Mesaj: "${message}", Tip: "${type}", Süre: ${duration}`);

        if (!messageContainer) {
            console.error("KRİTİK HATA: messageContainer HTML'de bulunamadı! ID'nin 'messageContainer' olduğundan emin olun.");
            alert(`[${type.toUpperCase()}] ${message} (HATA: Mesaj gösterme alanı bulunamadı!)`);
            return;
        }
        // console.log("messageContainer bulundu:", messageContainer); // Bu log azaltılabilir

        if (messageTimeout) {
            clearTimeout(messageTimeout);
        }

        messageContainer.textContent = message;
        messageContainer.className = 'message-container'; 
        messageContainer.classList.add(type);      
        messageContainer.classList.add('visible'); // CSS animasyonu için
        
        // console.log(`Mesaj konteynerinin içeriği ayarlandı: "${messageContainer.textContent}"`); // Bu log azaltılabilir
        // console.log(`Mesaj konteynerinin HTML sınıfları: "${messageContainer.className}"`); // Bu log azaltılabilir
        
        if (duration > 0) {
            messageTimeout = setTimeout(() => {
                messageContainer.classList.remove('visible');
                // İsteğe bağlı: Animasyon bittikten sonra display:none yap
                // messageContainer.addEventListener('transitionend', () => {
                //     if (!messageContainer.classList.contains('visible')) {
                //         messageContainer.style.display = 'none';
                //     }
                // }, { once: true });
            }, duration);
        }
        // console.log(`---- showMessage BİTTİ ----`); // Bu log azaltılabilir
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
            const coords = quake.geometry.coordinates;
            const props = quake.properties;
            if (!coords || coords.length < 2 || typeof coords[1] !== 'number' || typeof coords[0] !== 'number') return;

            const enlem = coords[1];
            const boylam = coords[0];
            const derinlik = (coords.length > 2 && coords[2] !== null) ? coords[2] : 'Bilinmiyor';
            const buyukluk = props.mag;
            const yer = props.place || 'Bilinmiyor';
            const zaman = props.time ? new Date(props.time).toLocaleString('tr-TR', { dateStyle: 'medium', timeStyle: 'medium' }) : 'Bilinmiyor';

            function getColor(d) {
                if (typeof d !== 'number' || isNaN(d)) return '#999';
                return d > 6 ? '#a50026' : d > 5 ? '#d73027' : d > 4 ? '#f46d43' : d > 3 ? '#fee090' : d > 2 ? '#abd9e9' : '#74add1';
            }
            function getRadius(mag) {
                if (typeof mag !== 'number' || isNaN(mag)) return 3;
                return Math.max(3, mag * 2.5);
            }

            const circleMarker = L.circleMarker([enlem, boylam], {
                radius: getRadius(buyukluk), fillColor: getColor(buyukluk), color: "#000", weight: 1, opacity: 1, fillOpacity: 0.7
            });
            circleMarker.bindPopup(
                `<b>Yer:</b> ${yer}<br><b>Büyüklük:</b> ${typeof buyukluk === 'number' ? buyukluk.toFixed(1) : 'N/A'} M<br>` +
                `<b>Derinlik:</b> ${typeof derinlik === 'number' ? derinlik.toFixed(1) : derinlik} km<br><b>Zaman:</b> ${zaman}`
            );
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
        // console.log("Metin istatistikleri güncellendi.");
    }

    // --- GRAFİK FONKSİYONLARI ---
    function formatDateToYMD(date) { return date.toISOString().split('T')[0]; }
    function getStartOfWeek(date) { const d = new Date(date); const day = d.getDay(); const diff = d.getDate() - day + (day === 0 ? -6 : 1); return new Date(d.setDate(diff)); }

    function createTimeSeriesChart(earthquakeDataFeatures, startDateStr, endDateStr) {
        const ctx = document.getElementById('monthlyChart').getContext('2d');
        if (timeSeriesChartInstance) {
            timeSeriesChartInstance.destroy();
            timeSeriesChartInstance = null; // Örneği sıfırla
        }

        if (!earthquakeDataFeatures || earthquakeDataFeatures.length === 0 || !startDateStr || !endDateStr) {
            ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
            ctx.font = "14px Arial"; ctx.fillStyle = "grey"; ctx.textAlign = "center";
            ctx.fillText("Zaman serisi için veri bulunamadı.", ctx.canvas.width / 2, ctx.canvas.height / 2);
            return;
        }
        const startDate = new Date(startDateStr); const endDate = new Date(endDateStr);
        const diffTime = Math.abs(endDate - startDate); const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
        let groupingMode = 'monthly', chartTitle = 'Aylık Deprem Sayıları', xAxisTitle = 'Ay';
        if (diffDays <= 31) { groupingMode = 'daily'; chartTitle = 'Günlük Deprem Sayıları'; xAxisTitle = 'Gün'; }
        else if (diffDays <= 182) { groupingMode = 'weekly'; chartTitle = 'Haftalık Deprem Sayıları'; xAxisTitle = 'Hafta Başlangıcı'; }
        
        const counts = {};
        earthquakeDataFeatures.forEach(quake => {
            const date = new Date(quake.properties.time); let key;
            if (groupingMode === 'daily') key = formatDateToYMD(date);
            else if (groupingMode === 'weekly') key = formatDateToYMD(getStartOfWeek(date));
            else key = `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}`;
            counts[key] = (counts[key] || 0) + 1;
        });
        const sortedKeys = Object.keys(counts).sort((a, b) => new Date(a) - new Date(b));
        const labels = sortedKeys; const dataPoints = sortedKeys.map(key => counts[key]);
        
        timeSeriesChartInstance = new Chart(ctx, {
            type: 'bar', data: { labels: labels, datasets: [{ label: 'Deprem Sayısı', data: dataPoints, backgroundColor: 'rgba(75, 192, 192, 0.6)', borderColor: 'rgba(75, 192, 192, 1)', borderWidth: 1 }] },
            options: { responsive: true, maintainAspectRatio: false, scales: { y: { beginAtZero: true, title: { display: true, text: 'Deprem Sayısı' } }, x: { title: { display: true, text: xAxisTitle } } }, plugins: { legend: { position: 'top' }, title: { display: true, text: chartTitle } } }
        });
        // console.log(`${chartTitle} grafiği oluşturuldu.`);
    }

    function createMagnitudeDistributionChart(earthquakeDataFeatures) {
        const ctx = document.getElementById('magnitudeChart').getContext('2d');
        if (magnitudeChartInstance) {
            magnitudeChartInstance.destroy();
            magnitudeChartInstance = null; // Örneği sıfırla
        }
        if (!earthquakeDataFeatures || earthquakeDataFeatures.length === 0) {
            ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height); ctx.font = "14px Arial"; ctx.fillStyle = "grey"; ctx.textAlign = "center";
            ctx.fillText("Büyüklük dağılımı için veri bulunamadı.", ctx.canvas.width / 2, ctx.canvas.height / 2); return;
        }
        const fixedLabels = ["3.0-3.9", "4.0-4.9", "5.0-5.9", "6.0-6.9", "7.0+", "Diğer (<3.0 veya tanımsız)"];
        const magnitudeRanges = {}; fixedLabels.forEach(label => magnitudeRanges[label] = 0);
        earthquakeDataFeatures.forEach((quake) => {
            const mag = quake.properties.mag;
            if (typeof mag !== 'number' || isNaN(mag)) { magnitudeRanges["Diğer (<3.0 veya tanımsız)"]++; }
            else if (mag < 3.0) { magnitudeRanges["Diğer (<3.0 veya tanımsız)"]++; }
            else if (mag < 4.0) { magnitudeRanges["3.0-3.9"]++; }
            else if (mag < 5.0) { magnitudeRanges["4.0-4.9"]++; }
            else if (mag < 6.0) { magnitudeRanges["5.0-5.9"]++; }
            else if (mag < 7.0) { magnitudeRanges["6.0-6.9"]++; }
            else { magnitudeRanges["7.0+"]++; }
        });
        const dataPoints = fixedLabels.map(label => magnitudeRanges[label]);
        // console.log("BÜYÜKLÜK DAĞILIMI - Labels:", fixedLabels, "DataPoints:", dataPoints); // Kritik log
        
        magnitudeChartInstance = new Chart(ctx, {
            type: 'bar', data: { labels: fixedLabels, datasets: [{ label: 'Deprem Sayısı', data: dataPoints, backgroundColor: ['rgba(255, 159, 64, 0.6)','rgba(255, 205, 86, 0.6)','rgba(75, 192, 192, 0.6)','rgba(54, 162, 235, 0.6)','rgba(153, 102, 255, 0.6)','rgba(201, 203, 207, 0.6)'], borderColor: ['rgba(255, 159, 64, 1)','rgba(255, 205, 86, 1)','rgba(75, 192, 192, 1)','rgba(54, 162, 235, 1)','rgba(153, 102, 255, 1)','rgba(201, 203, 207, 1)'], borderWidth: 1, minBarLength: 2 }] },
            options: { responsive: true, maintainAspectRatio: false, indexAxis: 'y', scales: { x: { beginAtZero: true, title: { display: true, text: 'Deprem Sayısı' }, grace: '5%' }, y: { ticks: { autoSkip: false } } }, plugins: { legend: { display: false }, title: { display: true, text: 'Büyüklük Dağılımı' } } }
        });
        // console.log("Büyüklük dağılım grafiği oluşturuldu.");
    }


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
        // Grafik ve mesaj temizliği API isteği öncesi
        if (timeSeriesChartInstance) { timeSeriesChartInstance.destroy(); timeSeriesChartInstance = null; }
        if (magnitudeChartInstance) { magnitudeChartInstance.destroy(); magnitudeChartInstance = null; }
        createTimeSeriesChart(null, startDateStr, endDateStr); // Canvas'ı temizle/ "veri yok" yazdır
        createMagnitudeDistributionChart(null); // Canvas'ı temizle/ "veri yok" yazdır
        if (messageContainer) messageContainer.style.display = 'none'; // Önceki mesajı temizle

        let apiMinLatitude, apiMaxLatitude, apiMinLongitude, apiMaxLongitude;
        if (selectedBounds) {
            apiMinLatitude = selectedBounds.getSouthWest().lat; apiMinLongitude = selectedBounds.getSouthWest().lng;
            apiMaxLatitude = selectedBounds.getNorthEast().lat; apiMaxLongitude = selectedBounds.getNorthEast().lng;
        } else {
            apiMinLatitude = 35.5; apiMaxLatitude = 42.5; apiMinLongitude = 25.5; apiMaxLongitude = 45.0;
        }
        // console.log(selectedBounds ? "Kullanıcının seçtiği alan kullanılacak." : "Varsayılan Türkiye sınırları kullanılacak.");

        const apiUrl = `https://earthquake.usgs.gov/fdsnws/event/1/query?format=geojson&starttime=${startDateStr}T00:00:00&endtime=${endDateStr}T23:59:59&minlatitude=${apiMinLatitude}&maxlatitude=${apiMaxLatitude}&minlongitude=${apiMinLongitude}&maxlongitude=${apiMaxLongitude}&minmagnitude=${minMagnitude}&orderby=time`;
        // console.log("API URL:", apiUrl);

        try {
            const response = await fetch(apiUrl);
            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`API'den Hata: ${response.status} ${response.statusText}. Detay: ${errorText}`);
            }
            const data = await response.json();
            const features = data.features || [];
            console.log("Toplam bulunan deprem sayısı (API'den):", features.length); // Bu log kalsın

            totalQuakesSpan.textContent = features.length.toString();
            displayEarthquakesOnMap(features);
            calculateAndDisplayStats(features);
            createTimeSeriesChart(features, startDateStr, endDateStr);
            createMagnitudeDistributionChart(features);

            if (features.length > 0) {
                showMessage(`${features.length} deprem başarıyla yüklendi ve gösteriliyor.`, "success");
            } else {
                showMessage("Belirtilen kriterlere uygun deprem bulunamadı.", "info");
            }

        } catch (error) {
            console.error("--- API İsteğinde veya Veri İşlemede Hata Oluştu ---", error); // Bu log kalsın
            totalQuakesSpan.textContent = "Hata!";
            maxMagnitudeQuakeSpan.textContent = "--"; avgMagnitudeSpan.textContent = "--";
            deepestQuakeSpan.textContent = "--"; shallowestQuakeSpan.textContent = "--";
            showMessage(`Veri çekme hatası: ${error.message}. Detaylar için konsolu kontrol edin.`, "error", 0); // Kalıcı hata mesajı
        } finally {
            fetchDataButton.disabled = false;
            fetchDataButton.classList.remove('loading');
            fetchDataButton.textContent = "Depremleri Getir";
        }
    });
});