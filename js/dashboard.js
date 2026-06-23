import { doc, getDoc, collection, getDocs, query, orderBy } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { db } from "./firebase-config.js";
// --- [추가할 코드] 실시간 아바타 렌더링 엔진 ---
window.renderAvatar = function(studentId, mode) {
    const zone = document.getElementById("userAvatarZone");
    if (!zone) return;

    // 에러 발생 시 엑스박스 방지용 디폴트 이미지
    const fallbackPhoto = "https://via.placeholder.com/160?text=No+Photo";
    const fallbackCustom = "https://via.placeholder.com/160?text=No+Avatar";

    if (mode === 'custom') {
        // 추후 의상을 겹칠 것을 대비해 layer 구조로 작성 (현재는 기본 몸통만)
        zone.innerHTML = `
            <img src="./images/avatar/base_body.png" class="avatar-custom-layer" alt="도트 몸통" onerror="this.src='${fallbackCustom}'">
        `;
    } else {
        // 기본값: photo 모드
        zone.innerHTML = `
            <img src="./images/students/${studentId}.jpg" class="avatar-photo" alt="학생 사진" onerror="this.src='${fallbackPhoto}'">
        `;
    }
};
// -----------------------------------------------
window.fetchStudentData = async function(inputId, inputPw) {
    try {
        const docRef = doc(db, "students", inputId);
        const docSnap = await getDoc(docRef);

        if (!docSnap.exists()) { window.showSystemAlert("아이디 또는 비밀번호가 일치하지 않습니다.", true); return false; }

        const data = docSnap.data();
        const storedPw = data.PW ? String(data.PW) : "";
        const actualPw = storedPw !== "" ? storedPw : "1234";

        if (String(inputPw) !== actualPw) { window.showSystemAlert("아이디 또는 비밀번호가 일치하지 않습니다.", true); return false; }

        window.currentUserId = inputId;
        window.currentUserPw = inputPw;
        window.currentUserName = data.이름 || "이름없음";
        window.currentUserData = data; 

        const currentPoints = Number(data.포인트 || 0);
        const jobName = (data.직업명 || "무직").trim();

        document.getElementById("userName").textContent = window.currentUserName;
        document.getElementById("userJob").textContent = jobName;
        document.getElementById("userCredit").textContent = data.신용등급 || "1";
        document.getElementById("userBalance").textContent = currentPoints.toLocaleString();

        // [이곳에 한 줄 추가] Firestore에서 현재아바타모드 읽어와서 그리기
        const avatarMode = data.현재아바타모드 || 'photo';
        window.renderAvatar(inputId, avatarMode);
        
        const workBtn = document.getElementById("btn-work-start");
        workBtn.style.display = "none"; workBtn.onclick = null; workBtn.style.backgroundColor = "var(--primary)";

        if (jobName === "대통령") {
            workBtn.style.display = "block"; workBtn.style.backgroundColor = "#F08200"; 
            workBtn.innerText = "👑 최고 관리자 업무"; workBtn.onclick = () => window.openModal("president");
        } else if (jobName === "마트점장" || jobName === "마트운영자") {
            workBtn.style.display = "block"; workBtn.style.backgroundColor = "var(--mart-primary)";
            workBtn.onclick = () => window.openJobSection('mart-section');
        } else if (jobName === "은행원") {
            workBtn.style.display = "block"; workBtn.style.backgroundColor = "var(--bank-primary)";
            workBtn.onclick = () => window.openJobSection('bank-section');
        } else if (jobName === "펀드매니저") {
            workBtn.style.display = "block"; workBtn.style.backgroundColor = "var(--stock-primary)";
            workBtn.onclick = () => window.openJobSection('stock-section');
        }

        let totalSavings = 0; let savingHtml = "";
        const savingsData = data.적금; 

        if (!savingsData || typeof savingsData !== 'object' || Object.keys(savingsData).length === 0) { 
            savingHtml = `<div style="color:var(--text-sub); text-align:center; font-size:14px; padding:10px 0;">가입내역 없음</div>`; 
        } else {
            Object.keys(savingsData).forEach(key => {
                const svInfo = savingsData[key];
                const typeAmt = Number(svInfo.유형 || 0), currRound = Number(svInfo.현재회차 || 0), targetRound = Number(svInfo.목표회차 || 0);
                totalSavings += (typeAmt * currRound);
                savingHtml += `<div class="stock-item"><span style="font-weight:700; color:var(--text-main); font-size:14px;">${typeAmt}P상품</span><span style="color:var(--accent-teal); font-weight:700; font-size:14px;">${currRound}/${targetRound}회</span></div>`;
            });
        }
        document.getElementById("savingListContainer").innerHTML = savingHtml;

        let stockPrices = {};
        try {
            const sysStocksSnap = await getDocs(collection(db, "stocks"));
            sysStocksSnap.forEach(sDoc => { stockPrices[sDoc.id] = Number(sDoc.data().현재가 || 0); });
        } catch(e) {}

        let totalStocksValue = 0; let stockHtml = "";
        const userStocksData = data.보유주식;

        if (!userStocksData || typeof userStocksData !== 'object' || Object.keys(userStocksData).length === 0) { 
            stockHtml = `<div style="color:var(--text-sub); text-align:center; font-size:14px; padding:10px 0;">보유 주식 없음</div>`; 
        } else {
            Object.keys(userStocksData).forEach(sName => {
                const sQty = Number(userStocksData[sName] || 0);
                if (sQty > 0) {
                    const sCurrentPrice = stockPrices[sName] || 0;
                    totalStocksValue += (sQty * sCurrentPrice);
                    stockHtml += `<div class="stock-item"><span style="font-weight:700; color:var(--text-main); font-size:14px;">${sName} <span style="font-size:12px; font-weight:500; color:var(--text-sub); margin-left:4px;">${sCurrentPrice}P</span></span><span style="color:var(--primary); font-weight:700; font-size:14px;">${sQty}주</span></div>`;
                }
            });
            if(stockHtml === "") stockHtml = `<div style="color:var(--text-sub); text-align:center; font-size:14px; padding:10px 0;">보유 주식 없음</div>`;
        }
        document.getElementById("stockListContainer").innerHTML = stockHtml;

        const totalAssets = currentPoints + totalSavings + totalStocksValue;
        document.getElementById("asset-total-text").textContent = `총 자산: ${totalAssets.toLocaleString()} P`;
        const ptPct = totalAssets > 0 ? (currentPoints / totalAssets) * 100 : 0;
        const svPct = totalAssets > 0 ? (totalSavings / totalAssets) * 100 : 0;
        const stPct = totalAssets > 0 ? (totalStocksValue / totalAssets) * 100 : 0;
        document.getElementById("bar-pt").style.width = `${ptPct}%`; document.getElementById("bar-sv").style.width = `${svPct}%`; document.getElementById("bar-st").style.width = `${stPct}%`;
        document.getElementById("legend-pt").textContent = `🔵 포인트 (${ptPct.toFixed(0)}%)`; document.getElementById("legend-sv").textContent = `🟢 적금 (${svPct.toFixed(0)}%)`; document.getElementById("legend-st").textContent = `🟠 주식 (${stPct.toFixed(0)}%)`;

        return true; 
    } catch (error) { window.showSystemAlert("서버와 통신 중 오류가 발생했습니다.", true); return false; }
};

window.stockChartInstance = null;
window.renderAllStocksChart = async function() {
    try {
        const stocksSnap = await getDocs(collection(db, "stocks"));
        let datasets = []; let allDatesSet = new Set(); let stockHistoryData = {};
        const colorPalette = ['#3182F6', '#F04452', '#00875A', '#F59E0B', '#8b5cf6', '#26C6DA']; let colorIdx = 0;

        for (const stockDoc of stocksSnap.docs) {
            const stockId = stockDoc.id;
            const historySnap = await getDocs(query(collection(db, `stocks/${stockId}/price_history`), orderBy("timestamp", "asc")));
            stockHistoryData[stockId] = [];

            historySnap.forEach(d => {
                const info = d.data(); let dateLabel = info.date;
                if (info.timestamp && typeof info.timestamp.toDate === 'function') {
                    const dt = info.timestamp.toDate(); dateLabel = `${dt.getMonth() + 1}/${dt.getDate()}`;
                } else if (!dateLabel) {
                    dateLabel = "과거";
                } else {
                    const parts = dateLabel.split('-'); if (parts.length === 3) dateLabel = `${parts[1]}/${parts[2]}`;
                }
                allDatesSet.add(dateLabel);
                stockHistoryData[stockId].push({ x: dateLabel, y: info.price });
            });

            datasets.push({
                label: stockId, data: stockHistoryData[stockId],
                borderColor: colorPalette[colorIdx % colorPalette.length],
                backgroundColor: 'transparent', borderWidth: 2.5, pointRadius: 3, tension: 0.15
            });
            colorIdx++;
        }

        const sortedLabels = Array.from(allDatesSet).sort((a, b) => {
            const arrA = a.split('/').map(Number), arrB = b.split('/').map(Number);
            return arrA[0] - arrB[0] || arrA[1] - arrB[1];
        });

        const ctx = document.getElementById('stockChartCanvas').getContext('2d');
        if (window.stockChartInstance) window.stockChartInstance.destroy();

        window.stockChartInstance = new Chart(ctx, {
            type: 'line', data: { labels: sortedLabels, datasets: datasets },
            options: {
                responsive: true, maintainAspectRatio: false,
                interaction: { mode: 'index', intersect: false },
                plugins: { legend: { position: 'top', labels: { font: { weight: 'bold' } } } },
                scales: { x: { grid: { display: false } }, y: { beginAtZero: false, ticks: { font: { weight: '600' } } } }
            }
        });
    } catch (e) {
        console.error(e); window.showSystemAlert('주식 전광판 차트를 불러오는 데 실패했습니다.', true);
    }
};
