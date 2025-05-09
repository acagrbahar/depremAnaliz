// script.js

document.addEventListener('DOMContentLoaded', function () {
    console.log("Deprem Analiz Projesi: HTML DOM yüklendi. Tüm fonksiyonlar başlatılıyor.");

    // --- Harita Ayarları ---
    const map = L.map('map').setView([39.0, 35.0], 6);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        maxZoom: 18,
    }).addTo(map);
    console.log("Leaflet haritası başarıyla yüklendi.");

    // --- Katman Grupları ---
    const earthquakeLayerGroup = L.layerGroup().addTo(map);
    const drawnItems = new L.FeatureGroup();
    map.addLayer(drawnItems);
    console.log("Katman grupları oluşturuldu ve haritaya eklendi.");

    // --- Leaflet.draw Ayarları ---
    const drawControl = new L.Control.Draw({
        edit: { featureGroup: drawnItems, remove: true },
        draw: {
            polygon: false, polyline: false, circle: false, circlemarker: false, marker: false,
            rectangle: { shapeOptions: { color: '#007bff', fillOpacity: 0.1 } }
        }
    });
    map.addControl(drawControl);
    console.log("Leaflet.draw kontrolleri haritaya eklendi.");

    let selectedBounds = null;

    // Çizim Olayları
    map.on('draw:created', function (e) {
        const layer = e.layer;
        drawnItems.clearLayers();
        drawnItems.addLayer(layer);
        if (e.layerType === 'rectangle') {
            selectedBounds = layer.getBounds();
            console.log("Dikdörtgen çizildi:", selectedBounds.toBBoxString());
            alert("Alan seçildi. Filtre bu alana göre uygulanacaktır.");
        }
    });
    map.on('draw:edited', function (e) {
        e.layers.eachLayer(function (layer) {
            if (layer instanceof L.Rectangle) {
                selectedBounds = layer.getBounds();
                console.log("Dikdörtgen düzenlendi:", selectedBounds.toBBoxString());
            }
        });
    });
    map.on('draw:deleted', function () {
        selectedBounds = null;
        drawnItems.clearLayers();
        console.log("Çizim silindi.");
        alert("Seçili alan kaldırıldı. Varsayılan sınırlar kullanılacak.");
    });

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
    let timeSeriesChartInstance = null;
    let magnitudeChartInstance = null;

    // --- Başlangıç Filtre Değerleri ---
    const today = new Date();
    const thirtyDaysAgo = new Date(new Date().setDate(today.getDate() - 30));
    endDateInput.value = today.toISOString().split('T')[0];
    startDateInput.value = thirtyDaysAgo.toISOString().split('T')[0];
    console.log("Filtreler için başlangıç tarihleri ayarlandı.");

    // --- HARİTA FONKSİYONLARI ---
    function displayEarthquakesOnMap(earthquakeDataFeatures) {
        console.log("displayEarthquakesOnMap çağrıldı.");
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
        // console.log(`${earthquakeDataFeatures.length} deprem haritada gösterildi.`);
    }

    // --- İSTATİSTİK FONKSİYONLARI ---
    function calculateAndDisplayStats(earthquakeDataFeatures) {
        console.log("calculateAndDisplayStats çağrıldı.");
        if (!earthquakeDataFeatures || earthquakeDataFeatures.length === 0) {
            maxMagnitudeQuakeSpan.textContent = "-- M, --";
            avgMagnitudeSpan.textContent = "-- M";
            deepestQuakeSpan.textContent = "-- km, --";
            shallowestQuakeSpan.textContent = "-- km, --";
            return;
        }

        let maxMag = -Infinity, maxMagQDetails = "--", totalMag = 0, validMagCount = 0;
        let deepest = -Infinity, deepestQDetails = "--", shallowest = Infinity, shallowestQDetails = "--";

        earthquakeDataFeatures.forEach(quake => {
            const props = quake.properties;
            const coords = quake.geometry.coordinates;
            const mag = props.mag;
            const depth = (coords.length > 2 && coords[2] !== null) ? coords[2] : null;
            const place = props.place || 'Bilinmiyor';
            const time = props.time ? new Date(props.time).toLocaleDateString('tr-TR') : '';

            if (typeof mag === 'number' && !isNaN(mag)) {
                totalMag += mag;
                validMagCount++;
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
        console.log("Metin istatistikleri güncellendi.");
    }

    // --- GRAFİK FONKSİYONLARI ---
    function formatDateToYMD(date) {
        return date.toISOString().split('T')[0];
    }
    function getStartOfWeek(date) {
        const d = new Date(date);
        const day = d.getDay();
        const diff = d.getDate() - day + (day === 0 ? -6 : 1);
        return new Date(d.setDate(diff));
    }

    function createTimeSeriesChart(earthquakeDataFeatures, startDateStr, endDateStr) {
        console.log("--- createTimeSeriesChart fonksiyonu ÇAĞRILDI ---");
        const ctx = document.getElementById('monthlyChart').getContext('2d');
        if (timeSeriesChartInstance) timeSeriesChartInstance.destroy();

        if (!earthquakeDataFeatures || earthquakeDataFeatures.length === 0 || !startDateStr || !endDateStr) {
            console.log("Zaman serisi grafiği için veri veya tarih aralığı bulunamadı.");
            ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
            ctx.font = "14px Arial"; ctx.fillStyle = "grey"; ctx.textAlign = "center";
            ctx.fillText("Zaman serisi verisi bulunamadı.", ctx.canvas.width / 2, ctx.canvas.height / 2);
            return;
        }

        const startDate = new Date(startDateStr);
        const endDate = new Date(endDateStr);
        const diffTime = Math.abs(endDate - startDate);
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;

        let groupingMode = 'monthly', chartTitle = 'Aylık Deprem Sayıları', xAxisTitle = 'Ay';
        if (diffDays <= 31) { groupingMode = 'daily'; chartTitle = 'Günlük Deprem Sayıları'; xAxisTitle = 'Gün'; }
        else if (diffDays <= 182) { groupingMode = 'weekly'; chartTitle = 'Haftalık Deprem Sayıları'; xAxisTitle = 'Hafta Başlangıcı'; }
        console.log(`Zaman aralığı: ${diffDays} gün. Gruplama modu: ${groupingMode}`);

        const counts = {};
        earthquakeDataFeatures.forEach(quake => {
            const date = new Date(quake.properties.time);
            let key;
            if (groupingMode === 'daily') key = formatDateToYMD(date);
            else if (groupingMode === 'weekly') key = formatDateToYMD(getStartOfWeek(date));
            else key = `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}`;
            counts[key] = (counts[key] || 0) + 1;
        });

        const sortedKeys = Object.keys(counts).sort((a, b) => new Date(a) - new Date(b));
        const labels = sortedKeys;
        const dataPoints = sortedKeys.map(key => counts[key]);

        timeSeriesChartInstance = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Deprem Sayısı', data: dataPoints,
                    backgroundColor: 'rgba(75, 192, 192, 0.6)', borderColor: 'rgba(75, 192, 192, 1)', borderWidth: 1
                }]
            },
            options: {
                responsive: true, maintainAspectRatio: false,
                scales: { y: { beginAtZero: true, title: { display: true, text: 'Deprem Sayısı' } }, x: { title: { display: true, text: xAxisTitle } } },
                plugins: { legend: { position: 'top' }, title: { display: true, text: chartTitle } }
            }
        });
        console.log(`${chartTitle} grafiği oluşturuldu.`);
    }

    // BÜYÜKLÜK DAĞILIM GRAFİĞİ - GÜNCELLENDİ
    function createMagnitudeDistributionChart(earthquakeDataFeatures) {
        console.log("--- createMagnitudeDistributionChart fonksiyonu ÇAĞRILDI ---");
        const ctx = document.getElementById('magnitudeChart').getContext('2d');
        if (magnitudeChartInstance) {
            magnitudeChartInstance.destroy();
            console.log("Mevcut büyüklük dağılım grafiği yok edildi.");
        }

        if (!earthquakeDataFeatures || earthquakeDataFeatures.length === 0) {
            console.log("Büyüklük dağılım grafiği için veri yok.");
            ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
            ctx.font = "14px Arial"; ctx.fillStyle = "grey"; ctx.textAlign = "center";
            ctx.fillText("Büyüklük dağılım verisi bulunamadı.", ctx.canvas.width / 2, ctx.canvas.height / 2);
            return;
        }

        console.log("Büyüklük dağılımı için gelen deprem sayısı:", earthquakeDataFeatures.length);

        // Sabit etiket sırası tanımla
        const fixedLabels = ["3.0-3.9", "4.0-4.9", "5.0-5.9", "6.0-6.9", "7.0+", "Diğer (<3.0 veya tanımsız)"];
        const magnitudeRanges = {};
        fixedLabels.forEach(label => magnitudeRanges[label] = 0); // Başlangıç değerlerini 0 yap

        let processedCount = 0;
        earthquakeDataFeatures.forEach((quake) => {
            const mag = quake.properties.mag;
            let categorized = false;
            if (typeof mag !== 'number' || isNaN(mag)) {
                magnitudeRanges["Diğer (<3.0 veya tanımsız)"]++;
                categorized = true;
            } else if (mag < 3.0) {
                magnitudeRanges["Diğer (<3.0 veya tanımsız)"]++;
                categorized = true;
            } else if (mag < 4.0) {
                magnitudeRanges["3.0-3.9"]++;
                categorized = true;
            } else if (mag < 5.0) {
                magnitudeRanges["4.0-4.9"]++;
                categorized = true;
            } else if (mag < 6.0) {
                magnitudeRanges["5.0-5.9"]++;
                categorized = true;
            } else if (mag < 7.0) {
                magnitudeRanges["6.0-6.9"]++;
                categorized = true;
            } else { // mag >= 7.0
                magnitudeRanges["7.0+"]++;
                categorized = true;
            }
            if(categorized) processedCount++;
        });

        console.log(`Toplam ${processedCount} deprem büyüklük aralıkları için işlendi.`);
        console.log("Hesaplanan Büyüklük Aralıkları (Sayımlar):", JSON.parse(JSON.stringify(magnitudeRanges)));

        // Veri noktalarını sabit etiket sırasına göre al
        const dataPoints = fixedLabels.map(label => magnitudeRanges[label]);

        console.log("Chart.js'e GİDEN Labels (Büyüklük Dağılımı):", JSON.stringify(fixedLabels));
        console.log("Chart.js'e GİDEN DataPoints (Büyüklük Dağılımı):", JSON.stringify(dataPoints));
        fixedLabels.forEach((label, i) => {
            console.log(`BÜYÜKLÜK GRAFİK VERİSİ -> Etiket: ${label}, Değer: ${dataPoints[i]}`);
        });

        magnitudeChartInstance = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: fixedLabels, // Sabit sıralı etiketleri kullan
                datasets: [{
                    label: 'Deprem Sayısı',
                    data: dataPoints,
                    backgroundColor: ['rgba(255, 159, 64, 0.6)','rgba(255, 205, 86, 0.6)','rgba(75, 192, 192, 0.6)','rgba(54, 162, 235, 0.6)','rgba(153, 102, 255, 0.6)','rgba(201, 203, 207, 0.6)'],
                    borderColor: ['rgba(255, 159, 64, 1)','rgba(255, 205, 86, 1)','rgba(75, 192, 192, 1)','rgba(54, 162, 235, 1)','rgba(153, 102, 255, 1)','rgba(201, 203, 207, 1)'],
                    borderWidth: 1,
                    minBarLength: 2 // Çok küçük değerlerin bile görünmesi için minimum çubuk uzunluğu
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                indexAxis: 'y',
                scales: {
                    x: {
                        beginAtZero: true,
                        title: { display: true, text: 'Deprem Sayısı' },
                        grace: '5%' // X ekseninin sonunda %5 boşluk bırakır
                    },
                    y: {
                        ticks: { autoSkip: false }
                    }
                },
                plugins: {
                    legend: { display: false },
                    title: { display: true, text: 'Büyüklük Dağılımı' }
                }
            }
        });
        console.log("Büyüklük dağılım grafiği oluşturuldu.");
        console.log("--- createMagnitudeDistributionChart fonksiyonu TAMAMLANDI ---");
    }


    // --- ANA VERİ ÇEKME VE İŞLEME BUTONU ---
    fetchDataButton.addEventListener('click', async function() {
        const startDateStr = startDateInput.value;
        const endDateStr = endDateInput.value;
        const minMagnitude = parseFloat(minMagnitudeInput.value);

        if (!startDateStr || !endDateStr) { alert("Lütfen başlangıç ve bitiş tarihlerini seçin."); return; }
        if (isNaN(minMagnitude) || minMagnitude < 0 || minMagnitude > 10) { alert("Lütfen geçerli bir minimum büyüklük girin (0-10 arası)."); return; }

        const startTime = `${startDateStr}T00:00:00`;
        const endTime = `${endDateStr}T23:59:59`;

        console.log("--- Deprem Verisi Çekme İsteği Başlatılıyor ---");
        totalQuakesSpan.textContent = "Yükleniyor...";
        maxMagnitudeQuakeSpan.textContent = "Yükleniyor..."; avgMagnitudeSpan.textContent = "Yükleniyor...";
        deepestQuakeSpan.textContent = "Yükleniyor..."; shallowestQuakeSpan.textContent = "Yükleniyor...";

        if (earthquakeLayerGroup) earthquakeLayerGroup.clearLayers();
        if (timeSeriesChartInstance) { timeSeriesChartInstance.destroy(); timeSeriesChartInstance = null; }
        if (magnitudeChartInstance) { magnitudeChartInstance.destroy(); magnitudeChartInstance = null; }
        createTimeSeriesChart(null, startDateStr, endDateStr);
        createMagnitudeDistributionChart(null);

        let apiMinLatitude, apiMaxLatitude, apiMinLongitude, apiMaxLongitude;
        if (selectedBounds) {
            apiMinLatitude = selectedBounds.getSouthWest().lat; apiMinLongitude = selectedBounds.getSouthWest().lng;
            apiMaxLatitude = selectedBounds.getNorthEast().lat; apiMaxLongitude = selectedBounds.getNorthEast().lng;
        } else {
            apiMinLatitude = 35.5; apiMaxLatitude = 42.5; apiMinLongitude = 25.5; apiMaxLongitude = 45.0;
        }
        console.log(selectedBounds ? "Kullanıcının seçtiği alan kullanılacak." : "Varsayılan Türkiye sınırları kullanılacak.");

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
            const features = data.features || [];
            console.log("Toplam bulunan deprem sayısı (API'den):", features.length);

            totalQuakesSpan.textContent = features.length.toString();
            displayEarthquakesOnMap(features);
            calculateAndDisplayStats(features);
            createTimeSeriesChart(features, startDateStr, endDateStr);
            createMagnitudeDistributionChart(features);

        } catch (error) {
            console.error("--- API İsteğinde veya Veri İşlemede Hata Oluştu ---", error);
            totalQuakesSpan.textContent = "Hata!";
            maxMagnitudeQuakeSpan.textContent = "--"; avgMagnitudeSpan.textContent = "--";
            deepestQuakeSpan.textContent = "--"; shallowestQuakeSpan.textContent = "--";
            alert(`Veri çekme sırasında bir hata oluştu: ${error.message}`);
        }
    });
});