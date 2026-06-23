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

// === 아바타 설정 모달 로직 ===
window.openAvatarChangeModal = function() {
    window.closeModal(); // 기존 프로필 메뉴 닫기
    
    // 현재 세션의 아바타 모드값을 읽어서 라디오 버튼 체크 (기본값 photo)
    const currentMode = window.currentUserData?.현재아바타모드 || 'photo';
    const radioBtn = document.querySelector(`input[name="avatarMode"][value="${currentMode}"]`);
    if(radioBtn) radioBtn.checked = true;
    
    document.getElementById("avatarChangeModal").classList.add("active");
};

window.closeAvatarChangeModal = function() {
    document.getElementById("avatarChangeModal").classList.remove("active");
};

window.executeAvatarChange = async function() {
    if (!window.currentUserId) return;
    
    // 선택된 라디오 버튼의 값 가져오기
    const selectedMode = document.querySelector('input[name="avatarMode"]:checked').value;
    const btn = document.querySelector("#avatarChangeModal .btn-login");
    const originalText = btn.textContent;
    btn.textContent = "저장 중...";
    btn.disabled = true;
    
    try {
        const docRef = doc(db, "students", window.currentUserId);
        
        // 1. 파이어베이스 데이터베이스 갱신
        await updateDoc(docRef, { 현재아바타모드: selectedMode });
        
        // 2. 현재 로컬 메모리(캐시) 동기화
        if (window.currentUserData) {
            window.currentUserData.현재아바타모드 = selectedMode;
        }
        
        // 3. UI 새로고침 없이 즉시 렌더링
        window.renderAvatar(window.currentUserId, selectedMode);
        
        window.showSystemAlert("아바타 형태가 성공적으로 변경되었습니다.");
        window.closeAvatarChangeModal();
    } catch (e) {
        console.error(e);
        window.showSystemAlert("아바타 변경 중 시스템 오류가 발생했습니다.", true);
    } finally {
        btn.textContent = originalText;
        btn.disabled = false;
    }
};
