import { doc, getDoc, collection, runTransaction } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { db } from "./firebase-config.js";

window.onBankCustomerSelect = async function() {
    const sId = document.getElementById("bankCustomerSelect").value;
    if(!sId) { document.getElementById("bankNewSavingDiv").style.display = "none"; document.getElementById("bankSavingsListCard").style.display = "none"; return; }
    document.getElementById("bankNewSavingDiv").style.display = "flex"; document.getElementById("bankSavingsListCard").style.display = "flex";
    await window.renderBankSavingsList(sId);
};

window.renderBankSavingsList = async function(sId) {
    const container = document.getElementById("bankSavingsListContainer");
    try {
        const stSnap = await getDoc(doc(db, "students", sId));
        const data = stSnap.data().적금;
        if(!data || typeof data !== 'object' || Object.keys(data).length === 0) {
            container.innerHTML = `<div style="text-align:center; padding:16px; color:var(--text-sub); font-size:14px; background:#F9FAFB; border-radius:12px;">가입된 적금이 없습니다.</div>`; return;
        }
        let html = '';
        Object.keys(data).forEach(key => {
            const sv = data[key]; const isMaturity = Number(sv.현재회차) >= Number(sv.목표회차);
            html += `<div class="bank-saving-row"><div><div style="font-weight:800; color:var(--bank-primary);">${sv.유형}P 상품</div><div style="font-size:13px; color:var(--text-sub); margin-top:2px;">진행: ${sv.현재회차} / ${sv.목표회차}회</div></div><div style="display:flex; gap:6px;"><button class="btn-bank-small" onclick="executeBankAction('${key}', 'deposit')" style="background:var(--primary); color:#fff;" ${isMaturity?'disabled':''}>납입</button><button class="btn-bank-small" onclick="executeBankAction('${key}', 'maturity')" style="background:#FF8A00; color:#fff;" ${!isMaturity?'disabled':''}>만기</button><button class="btn-bank-small" onclick="executeBankAction('${key}', 'cancel')" style="background:#E5E8EB; color:#333;">해지</button></div></div>`;
        });
        container.innerHTML = html;
    } catch(e) { container.innerHTML = `<div style="color:red; text-align:center;">오류 발생</div>`; }
};

window.executeBankCreate = async function() {
    const sId = document.getElementById("bankCustomerSelect").value;
    const typeAmt = Number(document.getElementById("newSavingType").value), tgtRnd = Number(document.getElementById("newSavingTarget").value);
    if(!sId) { window.showSystemAlert("고객을 선택해주세요.", true); return; }

    const todayStr = new Date().toLocaleString('ko-KR').split('오')[0].trim();
    const savingKey = `${typeAmt}_${tgtRnd}`;

    try {
        await runTransaction(db, async (t) => {
            const stRef = doc(db, "students", sId);
            const stSnap = await t.get(stRef);
            if(!stSnap.exists()) throw "학생 데이터 없음";

            let myRef = null, mySnap = null, myPerf = 0;
            if(sId !== window.currentUserId) {
                myRef = doc(db, "students", window.currentUserId);
                mySnap = await t.get(myRef);
                if(mySnap.exists()) myPerf = mySnap.data().성과급카운트 || 0;
            } else myPerf = stSnap.data().성과급카운트 || 0;
            if(myPerf < 30) myPerf++;
            
            const stData = stSnap.data();
            const cBal = Number(stData.포인트 || 0);
            const savingsData = stData.적금 || {};

            if(savingsData[savingKey]) throw "이미 동일한 유형과 목표회차의 적금에 가입되어 있습니다.";
            if(cBal < typeAmt) throw "잔액이 부족하여 적금에 가입할 수 없습니다.";

            savingsData[savingKey] = { 유형: typeAmt, 현재회차: 1, 목표회차: tgtRnd, 마지막납입일: todayStr };
            const detailStr = `${typeAmt}P 적금 신규가입 및 1회차 납입 (목표:${tgtRnd}회)`;
            const updatedTx = window.getUpdatedRecentTransactions(stData.최근거래, '적금납입', -typeAmt, detailStr);

            const stUpdateData = { 포인트: cBal - typeAmt, 적금: savingsData, 최근거래: updatedTx };
            if(sId === window.currentUserId) stUpdateData.성과급카운트 = myPerf; else if(myRef) t.update(myRef, { 성과급카운트: myPerf });

            t.update(stRef, stUpdateData);
            t.set(doc(collection(db, "logs")), window.createLogObject(sId, '적금납입', -typeAmt, '적금', detailStr));
        });
        window.showSystemAlert("신규 적금 가입이 완료되었습니다."); window.renderBankSavingsList(sId);
    } catch(e) { window.showSystemAlert(e, true); }
};

window.executeBankAction = async function(savingKey, action) {
    const sId = document.getElementById("bankCustomerSelect").value;
    if(!sId || !savingKey) return;
    const todayStr = new Date().toLocaleString('ko-KR').split('오')[0].trim();

    try {
        await runTransaction(db, async (t) => {
            const stRef = doc(db, "students", sId);
            const stSnap = await t.get(stRef);
            if(!stSnap.exists()) throw "데이터가 존재하지 않습니다.";

            let myRef = null, mySnap = null, myPerf = 0;
            if(sId !== window.currentUserId) {
                myRef = doc(db, "students", window.currentUserId);
                mySnap = await t.get(myRef);
                if(mySnap.exists()) myPerf = mySnap.data().성과급카운트 || 0;
            } else myPerf = stSnap.data().성과급카운트 || 0;
            if(myPerf < 30) myPerf++;
            
            const stData = stSnap.data();
            let currentBal = Number(stData.포인트 || 0), grade = Number(stData.신용등급 || 10);
            const savingsData = stData.적금 || {};
            
            if(!savingsData[savingKey]) throw "해당 적금 정보를 찾을 수 없습니다.";
            
            const svInfo = savingsData[savingKey];
            const typeAmt = Number(svInfo.유형 || 0), currRnd = Number(svInfo.현재회차 || 0), tgtRnd = Number(svInfo.목표회차 || 0);

            let stUpdateData = {};

            if(action === 'deposit') {
                if(svInfo.마지막납입일 === todayStr) throw "이미 오늘 해당 적금에 납입하셨습니다.";
                if(currentBal < typeAmt) throw "학생의 잔액이 부족합니다.";
                
                svInfo.현재회차 = currRnd + 1; svInfo.마지막납입일 = todayStr; savingsData[savingKey] = svInfo;
                const detailStr = `${typeAmt}P 적금 ${currRnd+1}회차 납입 (목표:${tgtRnd}회)`;
                const updatedTx = window.getUpdatedRecentTransactions(stData.최근거래, '적금납입', -typeAmt, detailStr);

                stUpdateData = { 포인트: currentBal - typeAmt, 적금: savingsData, 최근거래: updatedTx };
                t.set(doc(collection(db, "logs")), window.createLogObject(sId, '적금납입', -typeAmt, '적금', detailStr));
            } 
            else if(action === 'maturity') {
                if(currRnd < tgtRnd) throw "아직 만기 조건에 도달하지 않았습니다.";
                const rates = { '1-2': {4:0.07, 8:0.12, 12:0.15}, '3-4': {4:0.06, 8:0.11, 12:0.13}, '5-6': {4:0.05, 8:0.09, 12:0.11}, '7-8': {4:0.03, 8:0.06, 12:0.08}, '9-10': {4:0.01, 8:0.02, 12:0.04} };
                let gKey = '9-10'; if(grade<=2) gKey='1-2'; else if(grade<=4) gKey='3-4'; else if(grade<=6) gKey='5-6'; else if(grade<=8) gKey='7-8';
                const rate = (rates[gKey] && rates[gKey][tgtRnd]) ? rates[gKey][tgtRnd] : 0;
                
                const finalAmt = Math.floor((typeAmt * tgtRnd) * (1 + rate));
                delete savingsData[savingKey];
                const detailStr = `${typeAmt}P 적금 만기수령 (이율:${rate*100}%)`;
                const updatedTx = window.getUpdatedRecentTransactions(stData.최근거래, '적금해지', finalAmt, detailStr);

                stUpdateData = { 포인트: currentBal + finalAmt, 적금: savingsData, 최근거래: updatedTx };
                t.set(doc(collection(db, "logs")), window.createLogObject(sId, '적금해지', finalAmt, '적금', detailStr));
            }
            else if(action === 'cancel') {
                const refund = typeAmt * currRnd; delete savingsData[savingKey];
                const detailStr = `${typeAmt}P 적금 중도해지 원금반환`;
                const updatedTx = window.getUpdatedRecentTransactions(stData.최근거래, '적금해지', refund, detailStr);

                stUpdateData = { 포인트: currentBal + refund, 적금: savingsData, 최근거래: updatedTx };
                t.set(doc(collection(db, "logs")), window.createLogObject(sId, '적금해지', refund, '적금', detailStr));
            }

            if(sId === window.currentUserId) stUpdateData.성과급카운트 = myPerf; else if(myRef) t.update(myRef, { 성과급카운트: myPerf });
            t.update(stRef, stUpdateData);
        });
        window.showSystemAlert("은행 업무 처리가 완료되었습니다."); window.renderBankSavingsList(sId);
    } catch(e) { window.showSystemAlert(e, true); }
};