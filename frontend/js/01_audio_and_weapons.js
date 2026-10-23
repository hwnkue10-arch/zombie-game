/**
 * =========================================================================
 * BOXHEAD: THE CORE v3.1 — Frontend Module: 01_audio_and_weapons.js
 * Zero-Loss Refactored Architecture (Shared Global Lexical Scope)
 * =========================================================================
 */
"use strict";


    // =========================================================================
    // 1. SYNTHESIZED SOUND ENGINE (Web Audio API)
    // =========================================================================
    const userSettings = {
      antiMotionSickness: true, // 기본값 ON: 이동 시 화면 기울임(카메라 회전) 완벽 고정
      cameraSmooth: false,      // 기본값 OFF: 카메라 딜레이 없이 즉시 추적하여 멀미 방지
      nicknameMode: "all",      // 'all' | 'me' | 'none'
      showWorldBadges: true,
      damageVignette: true,
      gfxQuality: "high",
      masterVolume: 0.80,
      mouseAim: true            // 마우스 커서 360° 조준 및 좌클릭 사격 지원
    };

    const SoundFX = {
      ctx: null,
      muted: false,
      lastPlayed: {},
      init() {
        if (!this.ctx) {
          const AudioCtx = window.AudioContext || window.webkitAudioContext;
          if (AudioCtx) this.ctx = new AudioCtx();
        }
        if (this.ctx && this.ctx.state === "suspended") {
          this.ctx.resume().catch(() => {});
        }
      },
      play(type) {
        if (this.muted || userSettings.masterVolume <= 0.01) return;
        const nowMs = performance.now();
        const minGap = (type === "uzi") ? 42 : (type === "pistol" || type === "rifle" ? 55 : 75);
        if (this.lastPlayed[type] && nowMs - this.lastPlayed[type] < minGap) return;
        this.lastPlayed[type] = nowMs;

        const volMult = userSettings.masterVolume;
        this.init();
        if (!this.ctx) return;
        const now = this.ctx.currentTime;
        try {
          if (type === "pistol" || type === "uzi" || type === "rifle") {
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.type = type === "uzi" ? "sawtooth" : "square";
            const startFreq = type === "pistol" ? 360 : (type === "uzi" ? 460 : 250);
            osc.frequency.setValueAtTime(startFreq, now);
            osc.frequency.exponentialRampToValueAtTime(55, now + 0.08);
            gain.gain.setValueAtTime(0.13 * volMult, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.085);
            osc.connect(gain); gain.connect(this.ctx.destination);
            osc.start(now); osc.stop(now + 0.09);
          } else if (type === "shotgun" || type === "explosion") {
            const dur = type === "explosion" ? 0.35 : 0.14;
            const bufferSize = Math.floor(this.ctx.sampleRate * dur);
            const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
            const data = buffer.getChannelData(0);
            for (let i = 0; i < bufferSize; i++) {
              data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.3));
            }
            const noise = this.ctx.createBufferSource();
            noise.buffer = buffer;
            const gain = this.ctx.createGain();
            gain.gain.setValueAtTime((type === "explosion" ? 0.34 : 0.22) * volMult, now);
            gain.gain.exponentialRampToValueAtTime(0.005, now + dur);
            noise.connect(gain); gain.connect(this.ctx.destination);
            noise.start(now);
          } else if (type === "railgun") {
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.type = "sawtooth";
            osc.frequency.setValueAtTime(1080, now);
            osc.frequency.exponentialRampToValueAtTime(100, now + 0.24);
            gain.gain.setValueAtTime(0.20 * volMult, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
            osc.connect(gain); gain.connect(this.ctx.destination);
            osc.start(now); osc.stop(now + 0.25);
          } else if (type === "pickup" || type === "revive" || type === "upgrade") {
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.type = "sine";
            osc.frequency.setValueAtTime(480, now);
            osc.frequency.exponentialRampToValueAtTime(980, now + 0.16);
            gain.gain.setValueAtTime(0.15 * volMult, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
            osc.connect(gain); gain.connect(this.ctx.destination);
            osc.start(now); osc.stop(now + 0.18);
          } else if (type === "alarm" || type === "heartbeat") {
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.type = type === "alarm" ? "sawtooth" : "sine";
            osc.frequency.setValueAtTime(type === "alarm" ? 560 : 80, now);
            osc.frequency.linearRampToValueAtTime(type === "alarm" ? 820 : 40, now + 0.24);
            gain.gain.setValueAtTime(0.22 * volMult, now);
            gain.gain.exponentialRampToValueAtTime(0.004, now + 0.25);
            osc.connect(gain); gain.connect(this.ctx.destination);
            osc.start(now); osc.stop(now + 0.26);
          }
        } catch (e) {}
      }
    };

    // =========================================================================
    // 2. 8 WEAPONS + 5-STAT UPGRADE SYSTEM + AWAKENING PERKS
    // =========================================================================
    // Ammo Pools: 'INF' (Infinite), 'LIGHT' (UZI/Shotgun), 'HEAVY' (Rifle/Grenade), 'ENERGY' (Railgun/Tactical)
    const WEAPONS = [
      {
        id: 0, key: "1", name: "전술 피스톨", eng: "Tactical Pistol",
        ammoType: "INF", infinite: true, startAmmo: 999, maxAmmo: 999, packAmmo: 0, packCost: 0, baseCost: 38,
        reqParts: 0, unlockBpCost: 0,
        fireRate: 0.18, damage: 44, speed: 44, spread: 0.02, pellets: 1,
        stun: 0.35, knockback: 0.85, weakMult: 2.2,
        color: 0xfacc15, sound: "pistol", unlockedAtStart: true,
        tier1Name: "할로우 포인트 (약점배율+0.6 · 관통+1 · 소형충격파)",
        awakenName: "아킴보 매그넘 (2연발 동시사격 + 대구경 관통 충격파)",
        roleDesc: "무한탄약 · 보스/중간보스 약점 2.2배 피해 · 기절 처형 시 탄약 드랍"
      },
      {
        id: 1, key: "2", name: "컴뱃 산탄총", eng: "Combat Shotgun",
        ammoType: "SHELL", infinite: false, startAmmo: 36, maxAmmo: 96, packAmmo: 24, packCost: 75, baseCost: 52,
        reqParts: 2, unlockBpCost: 600,
        fireRate: 0.52, damage: 30, speed: 36, spread: 0.28, pellets: 8,
        stun: 0.58, knockback: 2.7, weakMult: 1.15,
        color: 0xf97316, sound: "shotgun", unlockedAtStart: false,
        tier1Name: "소이 산탄 (산탄수+2 · 피격 적 3초 화상 지속피해)",
        awakenName: "드래곤 브레스 (피격 지점 3.5초 고열 화염장판 생성)",
        roleDesc: "전용 12게이지 산탄 사용 · 근접 군중 밀치기 및 기절 특화"
      },
      {
        id: 2, key: "3", name: "기관단총 UZI", eng: "Micro UZI",
        ammoType: "SMG", infinite: false, startAmmo: 160, maxAmmo: 420, packAmmo: 90, packCost: 75, baseCost: 52,
        reqParts: 2, unlockBpCost: 600,
        fireRate: 0.066, damage: 22, speed: 42, spread: 0.10, pellets: 1,
        stun: 0.18, knockback: 0.45, weakMult: 1.15,
        color: 0x38bdf8, sound: "uzi", unlockedAtStart: false,
        tier1Name: "정전기 탄환 (피격 시 인근 1마리 전이 스파크 +45% 피해)",
        awakenName: "쇼크 과부하 (인근 3마리 연쇄 감전 스파크 + 감전기절)",
        roleDesc: "전용 9mm 기관단총탄 사용 · 초고속 탄막 및 전이 스파크"
      },
      {
        id: 3, key: "4", name: "중화기 돌격소총", eng: "Heavy Rifle",
        ammoType: "RIFLE", infinite: false, startAmmo: 85, maxAmmo: 220, packAmmo: 45, packCost: 90, baseCost: 60,
        reqParts: 3, unlockBpCost: 1800,
        fireRate: 0.105, damage: 55, speed: 48, spread: 0.03, pellets: 1,
        stun: 0.32, knockback: 0.95, weakMult: 1.5,
        color: 0x4ade80, sound: "rifle", unlockedAtStart: false,
        tier1Name: "고폭 균열탄 (피격 시 반경 2.0m 소형 파편 폭발)",
        awakenName: "철갑 파편탄 (반경 3.8m 십자 파편 대폭발 + 장갑 100% 무시)",
        roleDesc: "전용 7.62mm 철갑소총탄 사용 · 장거리 고화력 주력 소총"
      },
      {
        id: 4, key: "5", name: "유탄발사기", eng: "Grenade Launcher",
        ammoType: "GRENADE", infinite: false, startAmmo: 14, maxAmmo: 40, packAmmo: 8, packCost: 100, baseCost: 68,
        reqParts: 3, unlockBpCost: 2400,
        fireRate: 0.70, damage: 195, speed: 26, spread: 0.04, pellets: 1,
        stun: 0.90, knockback: 3.5, explosiveRadius: 5.8, weakMult: 1.25,
        color: 0xf43f5e, sound: "shotgun", unlockedAtStart: false,
        tier1Name: "집속 파편탄 (폭발 반경+25% · 자탄 2발 추가 폭발 · 오사 35%감소)",
        awakenName: "확산 클러스터 (자탄 4발 연쇄 폭격 + 아군오사 70%감소)",
        roleDesc: "전용 40mm 유탄 사용 · 대규모 호드 폭격 및 보스 기둥 철거"
      },
      {
        id: 5, key: "6", name: "플라즈마 레일건", eng: "Plasma Railgun",
        ammoType: "CELL", infinite: false, startAmmo: 10, maxAmmo: 28, packAmmo: 6, packCost: 110, baseCost: 75,
        reqParts: 4, unlockBpCost: 4500,
        fireRate: 0.78, damage: 295, speed: 75, spread: 0.0, pellets: 1,
        stun: 1.15, knockback: 2.3, piercing: true, weakMult: 1.85,
        color: 0x22d3ee, sound: "railgun", unlockedAtStart: false,
        tier1Name: "과충전 이온빔 (빔 두께+35% · 1.5초 단기 전류 잔상)",
        awakenName: "초전도 플라즈마 (3.5초 고출력 전류장 생성 + 보스 2.2배 극딜)",
        roleDesc: "전용 플라즈마 셀 사용 · 일직선 전 적 관통 및 보스 극딜"
      },
      {
        id: 6, key: "7", name: "전술 바리케이드", eng: "Auto-Barricade",
        ammoType: "BARRICADE", infinite: false, startAmmo: 8, maxAmmo: 22, packAmmo: 5, packCost: 65, baseCost: 45,
        reqParts: 0, unlockBpCost: 0,
        fireRate: 0.38, damage: 38, speed: 0, spread: 0, pellets: 1,
        stun: 0.35, knockback: 0.7, placeType: "barricade",
        color: 0xa8a29e, sound: "pickup", unlockedAtStart: true,
        tier1Name: "고압 전류 철조망 (접근 좀비 반사딜 2배 + 1.2초마다 전기충격)",
        awakenName: "오토 센트리 포탑 (0.38초마다 주변 감염체 자동 사격 터렛 가동)",
        roleDesc: "전용 방벽 키트 사용 · 길목 봉쇄 및 전류/포탑 화력 지원"
      },
      {
        id: 7, key: "8", name: "적색 폭약통", eng: "Cryo-Barrel",
        ammoType: "BARREL", infinite: false, startAmmo: 6, maxAmmo: 18, packAmmo: 4, packCost: 75, baseCost: 48,
        reqParts: 0, unlockBpCost: 0,
        fireRate: 0.42, damage: 240, speed: 0, spread: 0, pellets: 1,
        stun: 1.25, knockback: 3.8, placeType: "barrel", explosiveRadius: 6.4,
        color: 0xef4444, sound: "pickup", unlockedAtStart: true,
        tier1Name: "냉각 가스통 (폭발 시 반경 5m 감염체 2.5초 급속 빙결)",
        awakenName: "극저온 연쇄 지뢰 (대폭발 + 5초간 극저온 빙결·산성 장판 생성)",
        roleDesc: "전용 폭약통 키트 사용 · 사격/근접 시 대폭발 및 빙결 유도"
      }
    ];

    // 무기별 맞춤형 5대 강화 스탯 정의 (피스톨은 탄약효율/사거리 제외, 장거리 총기는 사거리 제외, 바리케이드/폭약통은 전용 설치 스탯!)
    const WEAPON_STAT_POOLS = [
      // 0: 전술 피스톨 (무한탄약 -> 탄약효율 제외, 사거리 제외 -> 관통·약점치명·처형보급 특화)
      [
        { key: "atk", label: "대미지", desc: "화력 +25%" },
        { key: "spd", label: "연사력", desc: "공속 +16%" },
        { key: "stun", label: "저지력", desc: "넉백+경직 통합" },
        { key: "area", label: "관통력", desc: "관통+1·장갑무시" },
        { key: "knock", label: "약점·처형", desc: "보스배율·처형보급↑" }
      ],
      // 1: 컴뱃 산탄총 (근접 돌파 -> 사거리·탄수 및 탄약효율 포함)
      [
        { key: "atk", label: "산탄화력", desc: "화력 +25%" },
        { key: "spd", label: "펌프연사", desc: "공속 +15%" },
        { key: "area", label: "사거리·탄수", desc: "사거리+22%·산탄+1" },
        { key: "stun", label: "저지력", desc: "강력넉백+기절" },
        { key: "knock", label: "탄약효율", desc: "무소모확률 +11%" }
      ],
      // 2: 기관단총 UZI
      [
        { key: "atk", label: "대미지", desc: "화력 +25%" },
        { key: "spd", label: "초고속연사", desc: "공속 +16%" },
        { key: "area", label: "유효사거리", desc: "사거리·집탄 +22%" },
        { key: "stun", label: "저지력", desc: "경직+넉백 통합" },
        { key: "knock", label: "탄약효율", desc: "무소모확률 +11%" }
      ],
      // 3: 중화기 돌격소총 (기본 사거리 김 -> 사거리 제외, 관통력 + 탄약효율 탑재)
      [
        { key: "atk", label: "철갑화력", desc: "화력 +26%" },
        { key: "spd", label: "연사력", desc: "공속 +15%" },
        { key: "stun", label: "저지력", desc: "넉백+경직 통합" },
        { key: "area", label: "관통·장갑", desc: "관통+1·장갑무시" },
        { key: "knock", label: "탄약효율", desc: "무소모확률 +11%" }
      ],
      // 4: 유탄발사기
      [
        { key: "atk", label: "폭발화력", desc: "화력 +26%" },
        { key: "spd", label: "장전속도", desc: "공속 +15%" },
        { key: "area", label: "폭발반경", desc: "폭발범위 +22%" },
        { key: "stun", label: "충격파저지", desc: "광역기절+넉백" },
        { key: "knock", label: "탄약·안전", desc: "무소모+오사감소" }
      ],
      // 5: 플라즈마 레일건 (기본 사거리·관통 무제한 -> 빔두께 및 에너지효율 탑재)
      [
        { key: "atk", label: "코어출력", desc: "화력 +28%" },
        { key: "spd", label: "충전속도", desc: "공속 +16%" },
        { key: "area", label: "빔두께·전류", desc: "빔폭+25%·장판강화" },
        { key: "stun", label: "감전저지", desc: "장시간기절+넉백" },
        { key: "knock", label: "에너지효율", desc: "무소모확률 +11%" }
      ],
      // 6: 전술 바리케이드 (설치형 구조물 전용 5대 스탯!)
      [
        { key: "atk", label: "포탑·반사딜", desc: "터렛·가시화력 +35%" },
        { key: "spd", label: "내구도증폭", desc: "구조물체력 +160" },
        { key: "area", label: "방벽크기·사거리", desc: "크기·사거리 +22%" },
        { key: "stun", label: "충격파저지", desc: "접근좀비 기절·넉백" },
        { key: "knock", label: "설치효율", desc: "무소모확률 +12%" }
      ],
      // 7: 적색 폭약통 (설치형 지뢰 전용 5대 스탯!)
      [
        { key: "atk", label: "기폭화력", desc: "폭발피해 +30%" },
        { key: "spd", label: "설치·기폭성능", desc: "설치속도·빙결시간↑" },
        { key: "area", label: "유폭반경", desc: "폭발·빙결범위 +25%" },
        { key: "stun", label: "충격파저지", desc: "광역기절+대형넉백" },
        { key: "knock", label: "설치효율", desc: "무소모확률 +12%" }
      ]
    ];
    function getWeaponStatDefs(wIdx) {
      return WEAPON_STAT_POOLS[wIdx] || WEAPON_STAT_POOLS[0];
    }

    // 섹터별 스탯 최대 레벨 상한 계산 (총 10섹터 기준: 섹터 1 = 스탯당 1Lv(총 5Lv) ... 섹터 10 = 스탯당 10Lv(총 50Lv))
    function getSectorMaxStatLv() {
      const totalR = Math.max(1, game.totalRooms || 10);
      const curS = Math.min(totalR, (game.currentRoomIndex || 0) + 1);
      return Math.min(10, Math.max(1, Math.ceil((curS * 10) / totalR)));
    }

    // 티어별 지수+선형 하이브리드 강화 비용 곡선:
    // - 하위 레벨(Lv.0~3)은 저렴하여 후반 섹터에서 새 무기를 해금해도 즉시 현재 섹터 수준으로 캐치업(Catch-up) 가능!
    // - 상위 레벨(Lv.6~10)은 상위 섹터의 높은 BP 보상에 맞춰 스케일링되어 1섹터 꼼수 파밍으로 미리 다 찍는 것을 방지!
    // [v3.1 정밀 경제 스케일링] 섹터당 수천 마리 처치 수입(S1 ~8천 BP -> S9 ~38만 BP, 누적 ~122만 BP)에 맞춘 하이브리드 강화 비용 곡선
    // - 1자루 누적 강화비: Lv.15(S3)=~5,000 BP | Lv.30(S6)=~29,000 BP | Lv.45(S9)=~142,000 BP | Lv.50(S10 MAX)=~242,000 BP
    function getUpgradeCost(wIdx, currentStatLv, totalLv) {
      const base = WEAPONS[wIdx].baseCost;
      const mult = 3.2 * Math.pow(1.72, currentStatLv) + (totalLv * 0.15);
      return Math.max(50, Math.round((base * mult) / 10) * 10);
    }

    // 섹터 진행에 따라 좀비 마리당 획득 BP와 스폰량이 증가하므로, 탄약·회복템·설치물 보충 가격도 섹터 티어에 맞춰 자동 재조정!
    // S1(x1.0) -> S2(x1.5) -> S3(x2.2) -> S4(x3.2) -> S5(x4.5) -> S6(x6.2) -> S7(x8.5) -> S8(x11.2) -> S9+(x14.5)
    function getSectorSupplyMult() {
      const s = Math.max(0, game.currentRoomIndex || 0);
      const multTable = [1.0, 1.5, 2.2, 3.2, 4.5, 6.2, 8.5, 11.2, 14.5, 16.0];
      return multTable[Math.min(multTable.length - 1, s)];
    }

    function getSectorSupplyCost(baseCost) {
      return Math.round((baseCost * getSectorSupplyMult()) / 10) * 10;
    }

    // =========================================================================
    // [v3.2] 2b. 전술 슈트 · 의료 · 기동력 강화 시스템 (7종) 및 부품 합성 비용
    // =========================================================================
    const SUIT_UPGRADE_DEFS = [
      {
        key: "medkitCap",
        icon: "🩹",
        name: "구급상자 파우치 확장",
        desc: "구급상자[Q] 최대 소지 한도 +1개 증가 (기본 1개 ➔ 최대 4개 · 강화 시 즉시 +1 보충)",
        maxLv: 3,
        reqRooms: [1, 4, 7], // S2, S5, S8 해금 (0-indexed: 1, 4, 7)
        costs: [2200, 12000, 45000]
      },
      {
        key: "stimCap",
        icon: "⚡",
        name: "스팀팩 전술 벨트 확장",
        desc: "스팀팩[E] 최대 소지 한도 +1개 증가 (기본 1개 ➔ 최대 4개 · 강화 시 즉시 +1 보충)",
        maxLv: 3,
        reqRooms: [1, 4, 7], // S2, S5, S8 해금
        costs: [2500, 14000, 52000]
      },
      {
        key: "maxStamina",
        icon: "🫁",
        name: "인공 심폐기 (최대 스태미너)",
        desc: "전술 질주[Shift] 최대 스태미너 +25 증가 (기본 100 ➔ 최대 200 · 질주 지속시간 2배)",
        maxLv: 4,
        reqRooms: [0, 2, 4, 6], // S1, S3, S5, S7 해금
        costs: [900, 3800, 13500, 38000]
      },
      {
        key: "staminaRegen",
        icon: "🔋",
        name: "생체 대사 가속기 (스태미너 회복)",
        desc: "비질주 시 초당 스태미너 회복량 +5/s 증가 (기본 22/s ➔ 최대 42/s) 및 탈진 딜레이 단축",
        maxLv: 4,
        reqRooms: [0, 2, 4, 6], // S1, S3, S5, S7 해금
        costs: [900, 3800, 13500, 38000]
      },
      {
        key: "dashCd",
        icon: "🚀",
        name: "부스터 추진기 (점프·회피 쿨감)",
        desc: "전술 회피·점프 월담[Space] 재사용 대기시간 -0.35초 단축 (기본 3.2초 ➔ 최단 1.8초)",
        maxLv: 4,
        reqRooms: [0, 2, 5, 7], // S1, S3, S6, S8 해금
        costs: [1200, 4800, 18000, 48000]
      },
      {
        key: "bashCd",
        icon: "👊",
        name: "충격파 증폭기 (기절 밀치기 쿨감)",
        desc: "360° 기절 밀치기[V] 재사용 대기시간 -0.40초 단축 (기본 3.8초 ➔ 최단 2.2초) & 패링 반경 증가",
        maxLv: 4,
        reqRooms: [0, 2, 5, 7], // S1, S3, S6, S8 해금
        costs: [1200, 4800, 18000, 48000]
      },
      {
        key: "syringe",
        icon: "💉",
        name: "나노 의료 주사기 특수개조",
        desc: "[5섹터 해금] 구급상자를 주사기로 개조! 자가치료(2.8초➔0.6초 무감속)·아군치료(1.8초➔0.4초)·회복량 80HP",
        maxLv: 1,
        reqRooms: [4], // S5(중반) 해금
        costs: [38000],
        isSpecial: true
      }
    ];

    function getPlayerMaxMedkits(player) {
      const lv = (player && player.suitUpgrades && player.suitUpgrades.medkitCap) || 0;
      return 1 + lv;
    }

    function getPlayerMaxStims(player) {
      const lv = (player && player.suitUpgrades && player.suitUpgrades.stimCap) || 0;
      return 1 + lv;
    }

    function getPlayerMaxStamina(player) {
      const lv = (player && player.suitUpgrades && player.suitUpgrades.maxStamina) || 0;
      return 100 + lv * 25;
    }

    function getPlayerStaminaRegen(player) {
      const lv = (player && player.suitUpgrades && player.suitUpgrades.staminaRegen) || 0;
      return 22 + lv * 5;
    }

    function getPlayerDashCooldownMax(player) {
      const lv = (player && player.suitUpgrades && player.suitUpgrades.dashCd) || 0;
      return Math.max(1.6, 3.2 - lv * 0.35);
    }

    function getPlayerBashCooldownMax(player) {
      const lv = (player && player.suitUpgrades && player.suitUpgrades.bashCd) || 0;
      return Math.max(2.0, 3.8 - lv * 0.40);
    }

    function getPlayerBashRadius(player) {
      const lv = (player && player.suitUpgrades && player.suitUpgrades.bashCd) || 0;
      return 4.8 + lv * 0.35;
    }

    function isPlayerSyringeUpgraded(player) {
      return Boolean(player && player.suitUpgrades && player.suitUpgrades.syringe > 0);
    }

    function getPlayerSelfHealDuration(player) {
      return isPlayerSyringeUpgraded(player) ? 0.6 : 2.8;
    }

    function getPlayerAllyHealDuration(player) {
      return isPlayerSyringeUpgraded(player) ? 0.4 : 1.8;
    }

    function getPartCraftCost() {
      return getSectorSupplyCost(480);
    }

