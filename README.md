# 🎮 Boxhead: The Core (v3.2)

Three.js 기반의 웹 브라우저 3D 탑다운 전술 생존 슈팅 게임입니다.  
클래식 박스헤드의 아케이드 감성을 현대적으로 계승하여, 최대 4인 실시간 코옵 멀티플레이, 절차적 10섹터 전장 생성, 4대 특성화 클래스, 무기/슈트 50강 강화 시스템, 동적 원소 해저드 및 보스 레이드를 제공합니다.

---

## 🛠️ 기술 스택 (Tech Stack)

![3D Engine](https://img.shields.io/badge/3D%20Engine-Three.js%20r128-000000?logo=three.js&logoColor=white)
![Language](https://img.shields.io/badge/Language-JavaScript%20(ES6+)-F7DF1E?logo=javascript&logoColor=black)
![Styling](https://img.shields.io/badge/Styling-Tailwind%20CSS-38B2AC?logo=tailwindcss&logoColor=white)
![Audio](https://img.shields.io/badge/Audio-Web%20Audio%20API-FF5722)
![Runtime](https://img.shields.io/badge/Runtime-Node.js%20%3E%3D16-339933?logo=nodedotjs&logoColor=white)
![Networking](https://img.shields.io/badge/Networking-WebSocket%20(RFC--6455)-E34F26?logo=socketdotio&logoColor=white)
![Architecture](https://img.shields.io/badge/Architecture-Zero--Dependency-4F46E5)
![Multiplayer](https://img.shields.io/badge/Multiplayer-4--Player%20Co--op-2563EB)
![License](https://img.shields.io/badge/License-MIT-brightgreen)

---

## ⚡ 실행 방법 (Getting Started)

Node.js(16.0 이상)가 설치되어 있다면 외부 패키지 설치(`npm install`) 없이도 즉시 실행할 수 있습니다.

### 1. 원클릭 실행 (Windows)
- 프로젝트 폴더의 `start.bat`을 더블 클릭합니다.
- 서버가 구동되며 웹 브라우저(`http://localhost:3000`)가 자동으로 열립니다.

### 2. 콘솔 명령어 실행
```bash
# 1. 서버 구동
node backend/server.js

# 2. 브라우저 접속
http://localhost:3000
```

### 3. 멀티플레이 접속 안내 (LAN / Hamachi)
- **방장 (Host)**: `start.bat` 실행 후 콘솔에 표시되는 로컬 IP 또는 가상 IP(Hamachi) 주소를 팀원에게 공유합니다.
- **참가자 (Client)**: 브라우저 주소창에 `http://[방장_IP]:3000`을 입력하고 대기실에서 **[접속]** 버튼을 클릭합니다.
