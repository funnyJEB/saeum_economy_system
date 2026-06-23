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
    try {
        window.closeModal(); 
        
        // 현재 세션의 아바타 모드와 얼굴 타입을 읽어서 라디오 버튼 세팅 (기본값 설정)
        const currentMode = window.currentUserData?.현재아바타모드 || 'photo';
        const currentFace = window.currentUserData?.아바타얼굴 || 'typeA';
        
        const modeBtn = document.querySelector(`input[name="avatarMode"][value="${currentMode}"]`);
        if(modeBtn) modeBtn.checked = true;
        
        const faceBtn = document.querySelector(`input[name="avatarFace"][value="${currentFace}"]`);
        if(faceBtn) faceBtn.checked = true;
        
        window.toggleAvatarFaceSelect(); // 열릴 때 캐릭터 메뉴 표시 여부 체크
        document.getElementById("avatarChangeModal").classList.add("active");
    } catch (e) {
        console.error("모달 열기 에러:", e);
        window.showSystemAlert("창을 여는 중 오류가 발생했습니다. 새로고침 후 다시 시도해주세요.", true);
    }
};

window.closeAvatarChangeModal = function() {
    document.getElementById("avatarChangeModal").classList.remove("active");
};

// 캐릭터 선택 시에만 얼굴 선택창을 보여주는 토글 함수 (안전장치 추가)
window.toggleAvatarFaceSelect = function() {
    const selectedModeBtn = document.querySelector('input[name="avatarMode"]:checked');
    if (!selectedModeBtn) return; // 에러 방어: 아무것도 선택되지 않았을 때 자바스크립트 멈춤 방지

    const selectedMode = selectedModeBtn.value;
    const faceGroup = document.getElementById("avatarFaceGroup");
    
    if (selectedMode === 'custom') {
        faceGroup.style.display = "block";
    } else {
        faceGroup.style.display = "none";
    }
};

window.executeAvatarChange = async function() {
    if (!window.currentUserId) return;
    
    const selectedModeBtn = document.querySelector('input[name="avatarMode"]:checked');
    const selectedFaceBtn = document.querySelector('input[name="avatarFace"]:checked');
    
    // 에러 방어: 버튼이 제대로 체크되지 않은 상태에서 저장 시도 시 방어
    if (!selectedModeBtn || !selectedFaceBtn) {
        window.showSystemAlert("아바타 형태와 얼굴을 정확히 선택해주세요.", true);
        return;
    }

    const selectedMode = selectedModeBtn.value;
    const selectedFace = selectedFaceBtn.value;
    
    const btn = document.querySelector("#avatarChangeModal .btn-login");
    const originalText = btn.textContent;
    btn.textContent = "저장 중...";
    btn.disabled = true;
    
    try {
        const docRef = doc(db, "students", window.currentUserId);
        
        // 1. 파이어베이스 데이터베이스 갱신 ('아바타얼굴' 필드 사용)
        await updateDoc(docRef, { 
            현재아바타모드: selectedMode,
            아바타얼굴: selectedFace
        });
        
        // 2. 현재 로컬 메모리(캐시) 동기화
        if (window.currentUserData) {
            window.currentUserData.현재아바타모드 = selectedMode;
            window.currentUserData.아바타얼굴 = selectedFace;
        }
        
        // 3. UI 새로고침 없이 즉시 렌더링
        window.renderAvatar(window.currentUserId, selectedMode, selectedFace);
        
        window.showSystemAlert("아바타가 성공적으로 변경되었습니다.");
        window.closeAvatarChangeModal();
    } catch (e) {
        console.error(e);
        window.showSystemAlert("아바타 변경 중 시스템 오류가 발생했습니다.", true);
    } finally {
        btn.textContent = originalText;
        btn.disabled = false;
    }
};
