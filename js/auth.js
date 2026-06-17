import { doc, getDoc, updateDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { db } from "./firebase-config.js";

window.executeLogin = async function() {
    const inputId = document.getElementById("inputId").value.trim(), inputPw = document.getElementById("inputPw").value.trim();
    if (!inputId || !inputPw) { window.showSystemAlert("ID와 비밀번호를 모두 입력해주세요.", true); return; }
    const btn = document.querySelector(".btn-login"), originalText = btn.textContent; btn.textContent = "로그인 중..."; btn.disabled = true;
    
    // dashboard.js 의 fetchStudentData 호출
    if (window.fetchStudentData) {
        const isSuccess = await window.fetchStudentData(inputId, inputPw);
        if (isSuccess) { 
            document.getElementById("login-section").style.display = "none"; document.getElementById("dashboard").style.display = "flex"; 
        } else { 
            btn.textContent = originalText; btn.disabled = false; 
        }
    }
};

window.openPwChangeModal = function() {
    window.closeModal(); 
    document.getElementById("currentPwInput").value = ""; document.getElementById("newPwInput").value = ""; document.getElementById("confirmPwInput").value = "";
    document.getElementById("pwChangeModal").classList.add("active");
};

window.closePwChangeModal = function() { document.getElementById("pwChangeModal").classList.remove("active"); };

window.executePwChange = async function() {
    if (!window.currentUserId) return;
    const cur = document.getElementById("currentPwInput").value.trim(), n = document.getElementById("newPwInput").value.trim(), c = document.getElementById("confirmPwInput").value.trim();
    if (!cur || !n || !c) { window.showSystemAlert("모든 항목을 입력해주세요.", true); return; }
    if (n !== c) { window.showSystemAlert("새 비밀번호와 확인이 일치하지 않습니다.", true); return; }
    try {
        const docRef = doc(db, "students", window.currentUserId);
        const docSnap = await getDoc(docRef);
        if (!docSnap.exists()) return;
        const data = docSnap.data(), actualPw = (data.PW ? String(data.PW) : "1234");
        if (cur !== actualPw) { window.showSystemAlert("현재 비밀번호가 일치하지 않습니다.", true); return; }
        await updateDoc(docRef, { PW: n });
        window.showSystemAlert("비밀번호가 성공적으로 변경되었습니다."); window.closePwChangeModal(); 
    } catch (e) { window.showSystemAlert("시스템 오류가 발생했습니다.", true); }
};