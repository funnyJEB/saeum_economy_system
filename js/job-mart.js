import { doc, collection, getDocs, runTransaction } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { db } from "./firebase-config.js";

window.loadMartData = async function() {
    try {
        const itSnap = await getDocs(collection(db, "mart_items"));
        let itHtml = '<option value="">상품을 선택하세요</option>'; let tableHtml = ''; window.martItemsMap = {}; 
        if(itSnap.empty) { tableHtml = '<tr><td colspan="3" style="text-align:center;">등록된 상품이 없습니다.</td></tr>'; } 
        else {
            itSnap.forEach(d => {
                const item = d.data(); window.martItemsMap[d.id] = item;
                const price = Number(item.가격 || 0), stock = Number(item.마트재고량 || 0), name = item.물품명 || d.id;
                itHtml += `<option value="${d.id}">${name} (${price.toLocaleString()}P)</option>`;
                tableHtml += `<tr><td>${name}</td><td><b style="color:var(--mart-primary);">${price.toLocaleString()}P</b></td><td>${stock > 0 ? stock + '개' : '<span style="color:red;">품절</span>'}</td></tr>`;
            });
        }
        document.getElementById("martItemSelect").innerHTML = itHtml; document.getElementById("martInventoryTable").innerHTML = tableHtml;
        window.calculateMartTotal(); 
    } catch(e) {}
};

window.calculateMartTotal = function() {
    const itemId = document.getElementById("martItemSelect").value;
    let qty = parseInt(document.getElementById("martQty").value) || 1; 
    let total = (itemId && window.martItemsMap[itemId]) ? Number(window.martItemsMap[itemId].가격 || 0) * qty : 0;
    document.getElementById("martTotalPrice").innerText = `${total.toLocaleString()} P`;
};

window.executeMartPayment = async function() {
    const sId = document.getElementById("martCustomerSelect").value;
    const iId = document.getElementById("martItemSelect").value;
    let qty = parseInt(document.getElementById("martQty").value);
    if(!sId || !iId || isNaN(qty) || qty <= 0) { window.showSystemAlert("입력값을 확인해주세요.", true); return; }

    const btn = document.querySelector(".btn-mart-submit"); btn.disabled = true; btn.innerText = "처리 중...";
    try {
        await runTransaction(db, async (t) => {
            const stRef = doc(db, "students", sId), itRef = doc(db, "mart_items", iId);
            const stSnap = await t.get(stRef), itSnap = await t.get(itRef);
            if(!stSnap.exists() || !itSnap.exists()) throw "데이터 오류가 발생했습니다.";

            let myRef = null, mySnap = null, myPerf = 0;
            if(sId !== window.currentUserId) {
                myRef = doc(db, "students", window.currentUserId);
                mySnap = await t.get(myRef);
                if(mySnap.exists()) myPerf = mySnap.data().성과급카운트 || 0;
            } else myPerf = stSnap.data().성과급카운트 || 0; 
            
            if(myPerf < 30) myPerf++; 

            const stData = stSnap.data();
            const cBal = Number(stData.포인트 || 0), cStk = Number(itSnap.data().마트재고량 || 0);
            const price = Number(itSnap.data().가격 || 0), tAmt = price * qty, iName = itSnap.data().물품명 || iId;

            if(cBal < tAmt) throw "잔액이 부족합니다.";
            if(cStk < qty) throw "재고가 부족합니다.";

            const detailStr = `${iName} ${qty}개 구입`;
            const updatedTx = window.getUpdatedRecentTransactions(stData.최근거래, '마트결제', -tAmt, detailStr);

            const stUpdateData = { 포인트: cBal - tAmt, 최근거래: updatedTx };
            if(sId === window.currentUserId) stUpdateData.성과급카운트 = myPerf; 
            else if(myRef) t.update(myRef, { 성과급카운트: myPerf });

            t.update(stRef, stUpdateData);
            t.update(itRef, { 마트재고량: cStk - qty });
            t.set(doc(collection(db, "logs")), window.createLogObject(sId, '마트결제', -tAmt, '지출', detailStr));
        });
        window.showSystemAlert("결제가 성공적으로 완료되었습니다!");
        document.getElementById("martCustomerSelect").value = ""; document.getElementById("martItemSelect").value = ""; document.getElementById("martQty").value = "1";
        window.calculateMartTotal(); await window.loadMartData();
    } catch(e) { window.showSystemAlert(e, true); } 
    finally { btn.disabled = false; btn.innerText = "결제 승인하기"; }
};