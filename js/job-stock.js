import { doc, getDoc, collection, getDocs, runTransaction } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { db } from "./firebase-config.js";

window.loadStockData = async function() {
    try {
        const sysStocksSnap = await getDocs(collection(db, "stocks"));
        window.globalStocksMap = {}; let itHtml = '<option value="">종목 선택</option>';
        sysStocksSnap.forEach(sDoc => { const item = sDoc.data(); window.globalStocksMap[sDoc.id] = item; itHtml += `<option value="${sDoc.id}">${sDoc.id}</option>`; });
        document.getElementById("stockItemSelect").innerHTML = itHtml; document.getElementById("stockBuyCurrentPrice").innerText = "0 P"; document.getElementById("stockBuyRemaining").innerText = "0 주";
        const setDoc = await getDoc(doc(db, "system", "settings"));
        window.globalBaseFee = (setDoc.exists() && setDoc.data().거래수수료율) ? Number(setDoc.data().거래수수료율) : 0.01;
    } catch(e) { console.error(e); }
};

window.onStockItemSelectChanged = function() {
    const sName = document.getElementById("stockItemSelect").value;
    if (sName && window.globalStocksMap[sName]) {
        const item = window.globalStocksMap[sName];
        document.getElementById("stockBuyCurrentPrice").innerText = `${Number(item.현재가 || 0).toLocaleString()} P`;
        document.getElementById("stockBuyRemaining").innerText = `${Number(item.현재고 || 0).toLocaleString()} 주`;
    } else {
        document.getElementById("stockBuyCurrentPrice").innerText = `0 P`; document.getElementById("stockBuyRemaining").innerText = `0 주`;
    }
};

window.onStockCustomerSelect = async function() {
    const sId = document.getElementById("stockCustomerSelect").value;
    if(!sId || !window.globalStudentsMap[sId]) {
        document.getElementById("stockBalanceDisplay").innerText = "고객 잔액: - P"; document.getElementById("ownedStocksCard").style.display = "none"; document.getElementById("buyStocksCard").style.display = "none"; return;
    }
    document.getElementById("ownedStocksCard").style.display = "flex"; document.getElementById("buyStocksCard").style.display = "flex";

    const st = window.globalStudentsMap[sId];
    const grade = Number(st.신용등급 || 10); let penalty = 0;
    if(grade>=9) penalty = 0.04; else if(grade>=7) penalty = 0.03; else if(grade>=5) penalty = 0.02; else if(grade>=3) penalty = 0.01;
    const finalFee = window.globalBaseFee + penalty;
    
    let feeDisplayNode = document.getElementById("stockFeeDisplay");
    if(!feeDisplayNode) { feeDisplayNode = document.createElement("span"); feeDisplayNode.id = "stockFeeDisplay"; feeDisplayNode.style.display = "none"; document.body.appendChild(feeDisplayNode); }
    feeDisplayNode.dataset.fee = finalFee;
    document.getElementById("stockBalanceDisplay").innerHTML = `고객 잔액: <b style="color:var(--stock-primary);">${Number(st.포인트||0).toLocaleString()} P</b> | 수수료율: ${(finalFee * 100).toFixed(1)}% (${grade}등급)`;
    await window.renderOwnedStocks(sId);
};

window.renderOwnedStocks = async function(sId) {
    const container = document.getElementById("ownedStocksContainer");
    try {
        const stSnap = await getDoc(doc(db, "students", sId)); const userStocksData = stSnap.data().보유주식 || {}; let html = '';
        Object.keys(userStocksData).forEach(sName => {
            const sQty = Number(userStocksData[sName] || 0);
            if (sQty > 0) {
                const sCurrentPrice = window.globalStocksMap[sName] ? Number(window.globalStocksMap[sName].현재가 || 0) : 0;
                html += `<div style="display:flex; justify-content:space-between; align-items:center; padding:12px 4px; border-bottom:1px solid var(--sub-frame-border); flex-wrap: wrap; gap: 8px;"><div style="display:flex; align-items:baseline; gap:8px; flex:1; min-width: 150px;"><span style="font-weight:800; color:var(--text-main); font-size:16px;">${sName}</span><span style="font-size:14px; color:var(--primary); font-weight:700;">보유: ${sQty}주</span><span style="font-size:13px; color:var(--text-sub); font-weight:600;">(현재가: ${sCurrentPrice}P)</span></div><div style="display:flex; gap:6px; align-items:center;"><input type="number" id="sellQty_${sName}" value="1" min="1" max="${sQty}" style="width:50px; padding:10px 4px; border-radius:10px; border:1px solid var(--sub-frame-border); text-align:center; font-weight:700; background-color: #F9FAFB; outline:none;"><button class="btn-stock-action" onclick="executeStockSell('${sName}')" style="background:var(--primary); padding:10px 14px;">매도</button></div></div>`;
            }
        });
        if(html === '') html = `<div style="text-align:center; color:var(--text-sub); font-size:14px; padding:10px 0;">보유한 주식이 없습니다.</div>`; container.innerHTML = html;
    } catch(e) { container.innerHTML = `<div style="color:red; text-align:center;">조회 오류</div>`; }
};

window.executeStockBuy = async function() {
    const sId = document.getElementById("stockCustomerSelect").value, sName = document.getElementById("stockItemSelect").value, qty = parseInt(document.getElementById("stockBuyQty").value);
    if(!sId || !sName || isNaN(qty) || qty <= 0) { window.showSystemAlert("입력값을 확인해주세요.", true); return; }
    const feeRate = Number(document.getElementById("stockFeeDisplay").dataset.fee || 0);
    
    try {
        await runTransaction(db, async (t) => {
            const stRef = doc(db, "students", sId), stockRef = doc(db, "stocks", sName), mgrRef = doc(db, "students", window.currentUserId);
            const stSnap = await t.get(stRef), stkSnap = await t.get(stockRef), mgrSnap = await t.get(mgrRef);
            if(!stSnap.exists() || !stkSnap.exists() || !mgrSnap.exists()) throw "DB 자산 데이터 조회 오류";
            
            let myRef = null, mySnap = null, myPerf = 0;
            if(sId !== window.currentUserId) { myRef = doc(db, "students", window.currentUserId); mySnap = await t.get(myRef); if(mySnap.exists()) myPerf = mySnap.data().성과급카운트 || 0;
            } else myPerf = stSnap.data().성과급카운트 || 0;
            if(myPerf < 30) myPerf++;

            const stData = stSnap.data();
            const cBal = Number(stData.포인트 || 0), price = Number(stkSnap.data().현재가 || 0), globalStock = Number(stkSnap.data().현재고 || 0), feeAmt = Math.floor(price * qty * feeRate);
            const userStocksMap = stData.보유주식 || {}; let newUserStockQty = Number(userStocksMap[sName] || 0);
            const totalCost = (price * qty) + feeAmt;
            
            if(cBal < totalCost) throw `잔액이 부족합니다. (필요: ${totalCost}P)`;
            if(globalStock < qty) throw `시장 잔여 수량이 부족합니다.`;
            
            userStocksMap[sName] = newUserStockQty + qty;
            const detailStr = `${sName} ${qty}주 대행매수 (수수료:${(feeRate*100).toFixed(1)}%)`;
            const updatedTx = window.getUpdatedRecentTransactions(stData.최근거래, sName, -totalCost, detailStr);

            const stUpdateData = { 포인트: cBal - totalCost, 보유주식: userStocksMap, 최근거래: updatedTx };
            if(sId === window.currentUserId) stUpdateData.성과급카운트 = myPerf; else if(myRef) t.update(myRef, { 성과급카운트: myPerf });

            t.update(stRef, stUpdateData);
            t.update(stockRef, { 현재고: globalStock - qty });
            t.set(doc(collection(db, "logs")), window.createLogObject(sId, sName, -totalCost, 'buy', detailStr));
        });
        window.showSystemAlert("주식 매수가 완료되었습니다."); await window.loadStockData(); window.onStockItemSelectChanged(); window.renderOwnedStocks(sId);
    } catch(e) { window.showSystemAlert(e, true); }
};

window.executeStockSell = async function(sName) {
    const sId = document.getElementById("stockCustomerSelect").value, qty = parseInt(document.getElementById(`sellQty_${sName}`).value);
    if(!sId || isNaN(qty) || qty <= 0) { window.showSystemAlert("입력값을 확인해주세요.", true); return; }
    const feeRate = Number(document.getElementById("stockFeeDisplay").dataset.fee || 0);

    try {
        await runTransaction(db, async (t) => {
            const stRef = doc(db, "students", sId), stockRef = doc(db, "stocks", sName);
            const stSnap = await t.get(stRef), stkSnap = await t.get(stockRef);
            if(!stSnap.exists() || !stkSnap.exists()) throw "DB 자산 데이터 조회 오류";

            let myRef = null, mySnap = null, myPerf = 0;
            if(sId !== window.currentUserId) { myRef = doc(db, "students", window.currentUserId); mySnap = await t.get(myRef); if(mySnap.exists()) myPerf = mySnap.data().성과급카운트 || 0;
            } else myPerf = stSnap.data().성과급카운트 || 0;
            if(myPerf < 30) myPerf++;

            const stData = stSnap.data();
            const cBal = Number(stData.포인트 || 0), price = Number(stkSnap.data().현재가 || 0), globalStock = Number(stkSnap.data().현재고 || 0), feeAmt = Math.floor(price * qty * feeRate);
            const userStocksMap = stData.보유주식 || {}; let newUserStockQty = Number(userStocksMap[sName] || 0);
            const totalEarn = (price * qty) - feeAmt;
            
            if(newUserStockQty < qty) throw "보유 수량이 부족합니다.";
            if(newUserStockQty - qty === 0) delete userStocksMap[sName]; else userStocksMap[sName] = newUserStockQty - qty;

            const detailStr = `${sName} ${qty}주 대행매도 (수수료:${(feeRate*100).toFixed(1)}%)`;
            const updatedTx = window.getUpdatedRecentTransactions(stData.최근거래, sName, totalEarn, detailStr);

            const stUpdateData = { 포인트: cBal + totalEarn, 보유주식: userStocksMap, 최근거래: updatedTx };
            if(sId === window.currentUserId) stUpdateData.성과급카운트 = myPerf; else if(myRef) t.update(myRef, { 성과급카운트: myPerf });

            t.update(stRef, stUpdateData);
            // '현재고' 정확하게 수정 완료
            t.update(stockRef, { 현재고: globalStock + qty });
            t.set(doc(collection(db, "logs")), window.createLogObject(sId, sName, totalEarn, 'sell', detailStr));
        });
        window.showSystemAlert("주식 매도가 완료되었습니다."); await window.loadStockData(); window.onStockItemSelectChanged(); window.renderOwnedStocks(sId);
    } catch(e) { window.showSystemAlert(e, true); }
};