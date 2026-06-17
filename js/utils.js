import { collection, getDocs, getDoc, doc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { db } from "./firebase-config.js";

window.currentUserId = null;
window.currentUserName = null;
window.currentUserPw = null; 
window.currentUserData = null; 

window.globalStudentsMap = {};
window.martItemsMap = {}; 
window.globalStocksMap = {};
window.globalBaseFee = 0.01; 

window.showSystemAlert = function(msg, isErr = false) {
    document.getElementById("systemAlertIcon").innerText = isErr ? "⚠️" : "✅";
    document.getElementById("systemAlertText").innerText = msg;
    document.getElementById("systemAlertModal").classList.add("active");
};
window.closeSystemAlert = function() { document.getElementById("systemAlertModal").classList.remove("active"); };

window.createLogObject = function(targetId, category, amount, type, detailStr) {
    return {
        일시: new Date(), 
        ID: targetId,
        항목: category,
        변동금액: Number(amount),
        유형: type,
        내용: `[담당:${window.currentUserName}] ${detailStr}`
    };
};

window.getUpdatedRecentTransactions = function(existingArr, category, amount, detailStr) {
    let arr = existingArr ? [...existingArr] : [];
    const newTxObj = {
        일시: new Date().toLocaleString('ko-KR'),
        항목: category,
        변동금액: Number(amount),
        내용: `[담당:${window.currentUserName}] ${detailStr}`
    };
    arr.unshift(newTxObj);
    if (arr.length > 10) arr = arr.slice(0, 10);
    return arr;
};

window.loadAllCustomers = async function() {
    const stSnap = await getDocs(collection(db, "students"));
    let stHtml = '<option value="">고객을 선택하세요</option>';
    window.globalStudentsMap = {};
    stSnap.forEach(d => {
        const s = d.data();
        if(s.이름) { window.globalStudentsMap[d.id] = s; stHtml += `<option value="${d.id}">${s.이름} (${d.id})</option>`; }
    });
    document.querySelectorAll('.customer-select').forEach(el => el.innerHTML = stHtml);
};

window.openJobSection = async function(sectionId) {
    window.closeModal(); document.getElementById("dashboard").style.display = "none"; document.getElementById(sectionId).style.display = "flex";
    await window.loadAllCustomers();
    if(sectionId === 'mart-section') await window.loadMartData();
    if(sectionId === 'bank-section') { document.getElementById("bankNewSavingDiv").style.display = "none"; document.getElementById("bankSavingsListCard").style.display = "none"; }
    if(sectionId === 'stock-section') { document.getElementById("ownedStocksCard").style.display = "none"; document.getElementById("buyStocksCard").style.display = "none"; await window.loadStockData(); }
};

window.closeJobSection = function(sectionId) {
    // dashboard.js의 fetchStudentData 호출
    if(window.fetchStudentData) window.fetchStudentData(window.currentUserId, window.currentUserPw);
    document.getElementById(sectionId).style.display = "none"; document.getElementById("dashboard").style.display = "flex";
};

// 팝업 개별 제어 맵퍼 
const modalContentMap = {
    president: { title: "👑 최고 관리자 업무", body: `<p style="color:var(--text-sub); margin-bottom:16px;">수행할 업무를 선택해주세요.</p><button class="modal-menu-btn" onclick="window.openJobSection('mart-section')">🛒 마트 결제 시스템 (POS)</button><button class="modal-menu-btn" onclick="window.openJobSection('bank-section')">🏦 은행 적금 관리 시스템</button><button class="modal-menu-btn" onclick="window.openJobSection('stock-section')">📈 주식 대행 거래 시스템</button>` },
    profile: { title: "⚙️ 프로필 설정", body: `<button class="modal-menu-btn" onclick="window.showSystemAlert('아바타 기능은 준비 중입니다.', true)">🖼️ 내 아바타 변경하기</button><button class="modal-menu-btn" onclick="openPwChangeModal()">🔒 접속 비밀번호 변경하기</button>` },
    mall: { title: "🛍️ 새움mall", body: `<p style="text-align:center; color:var(--text-sub); padding:10px 0;">준비중입니다.</p>` },
    auction: { title: "⚖️ 실시간 학급 경매장", body: `<p style="text-align:center; color:var(--text-sub); padding:10px 0;">준비중입니다.</p>` }
};

window.openModal = function(type) {
    if (type === 'history') {
        document.getElementById("modalTitle").innerHTML = "📜 최근 거래 내역 (최신 10개)";
        const txList = window.currentUserData?.최근거래 || [];
        if (txList.length === 0) { document.getElementById("modalBody").innerHTML = `<div style="text-align:center; color:var(--text-sub); padding:30px 0; font-size:15px;">조회된 최근 자산 변동 내역이 없습니다.</div>`;
        } else {
            let html = `<div style="display:flex; flex-direction:column; gap:14px;">`;
            txList.forEach(tx => {
                const isPositive = Number(tx.변동금액) >= 0; const amtColor = isPositive ? "var(--primary)" : "#F04452"; const amtSign = isPositive ? "+" : "";
                html += `<div style="border-bottom: 1px solid var(--sub-frame-border); padding-bottom: 10px;"><div style="display:flex; justify-content:space-between; font-size:13px; color:var(--text-sub); font-weight:600;"><span>${tx.일시}</span><span style="background:var(--sub-frame-bg); padding:2px 6px; border-radius:6px;">${tx.항목}</span></div><div style="display:flex; justify-content:space-between; align-items:baseline; margin-top:6px;"><span style="font-size:15px; font-weight:600; color:var(--text-main); max-width:70%; word-break:break-all;">${tx.내용}</span><span style="color:${amtColor}; font-weight:800; font-size:16px; white-space:nowrap;">${amtSign}${tx.변동금액.toLocaleString()} P</span></div></div>`;
            }); html += `</div>`; document.getElementById("modalBody").innerHTML = html;
        }
        document.getElementById("modalOverlay").classList.add("active"); document.body.style.overflow = "hidden"; return;
    }

    if (type === 'top5') {
        document.getElementById("modalTitle").innerHTML = "🏆 자산가 TOP 5";
        document.getElementById("modalBody").innerHTML = `<div style="text-align:center; color:var(--text-sub); padding:30px 0;">데이터를 불러오는 중...</div>`;
        document.getElementById("modalOverlay").classList.add("active"); document.body.style.overflow = "hidden";

        getDoc(doc(db, "system", "ranking")).then(snap => {
            if(snap.exists() && snap.data().top5_list) {
                let html = `<div style="display:flex; flex-direction:column; gap:14px;">`;
                snap.data().top5_list.forEach((st, i) => {
                    html += `
                    <div style="border-bottom: 1px solid var(--sub-frame-border); padding-bottom: 12px;">
                        <div style="display:flex; justify-content:space-between; align-items:baseline; margin-bottom:6px;">
                            <span style="font-size:16px; font-weight:800; color:var(--text-main);">${i+1}위. ${st.name}</span>
                            <span style="font-size:16px; font-weight:800; color:var(--warning);">${st.total.toLocaleString()} P</span>
                        </div>
                        <div class="asset-analysis-bar" style="margin-top:0;">
                            <div style="width:${st.pRatio}%; background:var(--primary);" title="현금"></div>
                            <div style="width:${st.sRatio}%; background:var(--accent-orange);" title="주식"></div>
                            <div style="width:${st.svRatio}%; background:var(--accent-teal);" title="적금"></div>
                        </div>
                        <div class="asset-legend" style="margin-top:6px;">
                            <span style="color:var(--primary);">현금 ${st.pRatio}%</span><span style="color:var(--accent-orange);">주식 ${st.sRatio}%</span><span style="color:var(--accent-teal);">적금 ${st.svRatio}%</span>
                        </div>
                    </div>`;
                });
                html += `</div>`; document.getElementById("modalBody").innerHTML = html;
            } else document.getElementById("modalBody").innerHTML = `<div style="text-align:center; color:var(--text-sub); padding:30px 0;">랭킹 데이터가 없습니다.</div>`;
        }).catch(e => { document.getElementById("modalBody").innerHTML = `<div style="text-align:center; color:var(--danger); padding:30px 0;">데이터 로딩 실패</div>`; });
        return;
    }

    if (type === 'stockInfo') {
        document.getElementById("modalTitle").innerHTML = "📊 실시간 주식시장 전광판";
        document.getElementById("modalBody").innerHTML = `
            <p style="color:var(--text-sub); font-size:13px; margin-bottom:12px;">* 시장에 상장된 전 종목의 시세 변동 추이를 동시에 비교할 수 있습니다.</p>
            <div style="width:100%; height:300px; background:var(--sub-frame-bg); border-radius:12px; padding:10px; border:1px solid var(--sub-frame-border);">
                <canvas id="stockChartCanvas"></canvas>
            </div>
        `;
        document.getElementById("modalOverlay").classList.add("active"); 
        document.body.style.overflow = "hidden";
        if(window.renderAllStocksChart) window.renderAllStocksChart();
        return;
    }

    const data = modalContentMap[type]; if (!data) return;
    document.getElementById("modalTitle").innerHTML = data.title; document.getElementById("modalBody").innerHTML = data.body;
    document.getElementById("modalOverlay").classList.add("active"); document.body.style.overflow = "hidden"; 
};

window.closeModal = function() { document.getElementById("modalOverlay").classList.remove("active"); document.body.style.overflow = ""; };