/**
 * =========================================================================
 * BOXHEAD: THE CORE v3.6 — Frontend Module: 05b_armory_and_upgrades.js
 * Armory Modal, Weapon Random Upgrades, Suit Stats & Economy (BP/Parts/Cores)
 * Zero-Loss Refactored Architecture (Shared Global Lexical Scope)
 * =========================================================================
 */
"use strict";

    // =========================================================================
    // 11. WEAPON UPGRADE (PURE RANDOM ROLL), SUIT UPGRADES & PER-WEAPON AMMO
    // =========================================================================
    function toggleUpgradeModal() {
      const modal = document.getElementById("upgrade-modal");
      if (!modal) return;
      const isHidden = modal.classList.contains("hidden");
      if (isHidden) {
        modal.classList.remove("hidden");
        try {
          renderUpgradeModal();
        } catch (e) {
          console.error("renderUpgradeModal error:", e);
        }
      } else {
        modal.classList.add("hidden");
      }
    }

    // [v3.3 강화 및 구매 시각 피드백 시스템]
    // 무기 개별 스탯, 슈트 강화 카드, 보급 버튼 구매 시 1.4초간 눈부신 테두리 발광(Glow) 효과 적용
    let upgradeHighlight = {
      type: null, // "stat" | "weapon" | "suit" | "supply"
      weaponIndex: -1,
      statKey: null,
      suitKey: null,
      supplyKey: null,
      expireTime: 0
    };

    function triggerUpgradeHighlight(type, opts = {}) {
      upgradeHighlight = {
        type,
        weaponIndex: opts.weaponIndex !== undefined ? opts.weaponIndex : -1,
        statKey: opts.statKey || null,
        suitKey: opts.suitKey || null,
        supplyKey: opts.supplyKey || null,
        expireTime: Date.now() + 1400
      };
      setTimeout(() => {
        if (Date.now() >= upgradeHighlight.expireTime) {
          const upgModal = document.getElementById("upgrade-modal");
          if (upgModal && !upgModal.classList.contains("hidden")) {
            renderUpgradeModal();
          }
        }
      }, 1450);
    }

    function areAllWeaponsUnlocked(player) {
      if (!player || !player.inventory) return false;
      return player.inventory.length >= WEAPONS.length && player.inventory.every(inv => inv && inv.unlocked);
    }

    function isLimitBreakStep(totalLv) {
      return false; // 기본 스탯 강화(Lv.1~50)는 변이 코어 없이 오직 BP만으로 자유롭게 가능!
    }

    function rollRandomWeaponUpgrade(player, wIdx) {
      const toastEl = document.getElementById("upg-roll-toast");
      if (!isPlayerNearArmory(player)) {
        if (toastEl) toastEl.textContent = "⛔ 무기고 반경 밖입니다! [🔧상시무기고] 앞(6.8m)으로 이동해 강화하세요.";
        return;
      }
      const inv = player.inventory[wIdx];
      if (!inv || !inv.unlocked) return;
      const statDefs = getWeaponStatDefs(wIdx);
      const secCap = getSectorMaxStatLv(); // 현재 섹터 진행도 (1~10)
      const maxTotalHere = Math.min(50, secCap * 8 + 2); // 섹터당 총 레벨 상한 대폭 완화 (S1=10, S2=18, S3=26, ..., S6+=50)

      if (inv.totalLv >= maxTotalHere) {
        if (toastEl) {
          toastEl.textContent = maxTotalHere >= 50
            ? `🏆 [${WEAPONS[wIdx].name}] 모든 스탯이 최종 한계(Lv.50 MAX)에 도달했습니다!`
            : `🔒 현재 섹터(${game.currentRoomIndex + 1}섹터) 총 레벨 상한(Lv.${maxTotalHere}/50)에 도달했습니다! 다음 섹터 진입 시 +5Lv 상한이 해금됩니다.`;
        }
        return;
      }

      // 각 개별 스탯은 섹터에 구애받지 않고 최대 Lv.10까지 자유롭게 강화 가능 (운 좋으면 1섹터에서도 단일스탯 5강 가능!)
      const available = statDefs.filter(st => inv.stats[st.key] < 10 && (!st.reqSector || (game.currentRoomIndex || 0) >= st.reqSector));
      if (available.length === 0) {
        if (toastEl) {
          toastEl.textContent = `🏆 [${WEAPONS[wIdx].name}] 현재 해금된 모든 스탯이 최대치(Lv.10)에 도달했습니다!`;
        }
        return;
      }

      const avgLv = Math.floor(inv.totalLv / 5);
      const cost = getUpgradeCost(wIdx, avgLv, inv.totalLv);

      if (game.bioPoints < cost) {
        if (toastEl) toastEl.textContent = `⚠️ BP가 부족합니다! (필요: ${cost.toLocaleString()} BP)`;
        return;
      }

      game.bioPoints -= cost;
      const chosen = available[Math.floor(Math.random() * available.length)];
      // 대성공(+2 Lv)은 섹터 총 상한(maxTotalHere)과 해당 스탯 최대치(Lv.10)를 모두 초과하지 않을 때만 발동!
      const canJackpot = (inv.totalLv + 2 <= maxTotalHere) && (inv.stats[chosen.key] + 2 <= 10);
      const isJackpot = canJackpot && (Math.random() < 0.18);
      const addLv = isJackpot ? 2 : 1;
      inv.stats[chosen.key] += addLv;
      inv.totalLv += addLv;
      triggerUpgradeHighlight("stat", { weaponIndex: wIdx, statKey: chosen.key });

      SoundFX.play("upgrade");
      if (toastEl) {
        let msg = isJackpot
          ? `🎉 ★대성공! [${WEAPONS[wIdx].name}] '${chosen.label}' +2 Lv 상승! (현재 총 Lv.${inv.totalLv}/${maxTotalHere} · 스탯 Lv.${inv.stats[chosen.key]}/10)`
          : `🎲 [${WEAPONS[wIdx].name}] '${chosen.label}' +1 Lv 랜덤 강화 완료! (현재 총 Lv.${inv.totalLv}/${maxTotalHere} · 스탯 Lv.${inv.stats[chosen.key]}/10)`;
        if (inv.totalLv >= 15 && !inv.tier1Special) {
          msg += " ➔ 🧬[15Lv 1차 특수개조] 가능!";
        } else if (inv.totalLv >= 30 && inv.tier1Special && !inv.awakened) {
          msg += " ➔ ★[30Lv 최종각성] 가능!";
        } else if (inv.totalLv >= 45) {
          msg += " ➔ ⚡[45Lv 초월 오버드라이브] 가동 중!";
        }
        toastEl.textContent = msg;
      }
      renderUpgradeModal();
      updateWeaponSlotsHUD();
    }

    // [v3.1 4인 스쿼드 실측 경제 역산 기반 코어 상점 가격]
    // - S1~S3 누적 수입(~6만 BP)의 30% -> 1차 코어 18,000 BP
    // - S4~S6 누적 수입(~29만 BP)의 28% -> 2차 코어 82,000 BP
    // - S7~S9 누적 수입(~87만 BP)의 25% -> 3차 코어 220,000 BP (3개 풀구매 시 총 320,000 BP 소모)
    function getNextShopCoreInfo() {
      const bought = game.shopCoresBought || 0;
      if (bought === 0) return { reqRoom: 2, cost: 18000, label: "1차 코어(3S+) 18,000BP" };
      if (bought === 1) return { reqRoom: 5, cost: 82000, label: "2차 코어(6S+) 82,000BP" };
      if (bought === 2) return { reqRoom: 8, cost: 220000, label: "3차 코어(9S+) 220,000BP" };
      return { reqRoom: 99, cost: 0, label: "상점 코어 매진(3/3)" };
    }

    // [v3.2 섹터 티어 연동 코어 추출 판매 환급 모델]
    // - 판매 시점의 현재 섹터에 맞춰 해당 섹터 상한 무기 1~2자루를 즉시 풀강할 수 있는 적정 규모의 BP를 환급합니다.
    // - 3섹터 코어를 아껴두었다가 9섹터에서 팔더라도 현재 섹터 티어(160,000 BP)로 온전히 보존되어 손해를 보지 않습니다!
    function getCoreSellRefundBp() {
      const s = Math.max(0, game.currentRoomIndex || 0);
      const sectorCorePrices = [
        3500,   // S1
        4500,   // S2
        6000,   // S3 (1차 중보 드랍 시점: 3섹터 총 15Lv 1~2자루 강화 자금)
        11000,  // S4
        20000,  // S5
        35000,  // S6 (2차 중보 드랍 시점: 6섹터 총 30Lv 강화 자금)
        60000,  // S7
        100000, // S8
        160000, // S9 (3차 중보 드랍 시점: 9섹터 총 45Lv 초월 자금)
        240000  // S10 (최종 10섹터: 총 50Lv MAX 도배 자금)
      ];
      return sectorCorePrices[Math.min(sectorCorePrices.length - 1, s)];
    }

    // [v3.1 3대 빌드 밸런스] 비코어(Pure Stat) 순수 스탯 마스터리 보너스:
    // 코어를 바르지 않은 무기는 15/30/45Lv 달성 시 강력한 깡딜+관통+공속+장갑무시 패시브가 자동 점등됨!
    function getPureStatMasteryBonus(inv) {
      if (!inv || inv.tier1Special || inv.awakened || inv.transcended) {
        return { dmgMult: 1.0, spdMult: 1.0, extraPierce: 0, armorIgnore: false, weakBonus: 0, label: "" };
      }
      if (inv.totalLv >= 45) {
        return {
          dmgMult: 2.15,
          spdMult: 1.20,
          extraPierce: 2,
          armorIgnore: true,
          weakBonus: 0.45,
          label: "💪순수45Lv(깡딜+115%·관통+2·공속+20%·장갑무시)"
        };
      }
      if (inv.totalLv >= 30) {
        return {
          dmgMult: 1.65,
          spdMult: 1.10,
          extraPierce: 1,
          armorIgnore: false,
          weakBonus: 0.25,
          label: "💪순수30Lv(깡딜+65%·관통+1·공속+10%)"
        };
      }
      if (inv.totalLv >= 15) {
        return {
          dmgMult: 1.30,
          spdMult: 1.0,
          extraPierce: 0,
          armorIgnore: false,
          weakBonus: 0,
          label: "💪순수15Lv(깡딜+30%)"
        };
      }
      return { dmgMult: 1.0, spdMult: 1.0, extraPierce: 0, armorIgnore: false, weakBonus: 0, label: "" };
    }

    function buyShopCoreSample(player) {
      const toastEl = document.getElementById("upg-roll-toast");
      if (!isPlayerNearArmory(player)) {
        if (toastEl) toastEl.textContent = "⛔ 소강기에 출현한 [🔧무기고] 반경 안에서만 변이 코어를 구매할 수 있습니다!";
        return;
      }
      const info = getNextShopCoreInfo();
      if ((game.shopCoresBought || 0) >= 3) {
        if (toastEl) toastEl.textContent = "ℹ️ 상점 한정 코어(3개)를 모두 구매했습니다!";
        return;
      }
      if (game.currentRoomIndex < info.reqRoom) {
        if (toastEl) toastEl.textContent = `🔒 이 코어는 섹터 ${info.reqRoom + 1} 진입 시 해금됩니다! (가격: ${info.cost} BP)`;
        return;
      }
      if (game.bioPoints < info.cost) {
        if (toastEl) toastEl.textContent = `⚠️ BP가 부족합니다! (필요: ${info.cost} BP)`;
        return;
      }
      game.bioPoints -= info.cost;
      game.shopCoresBought = (game.shopCoresBought || 0) + 1;
      game.coreSamples = (game.coreSamples || 0) + 1;
      triggerUpgradeHighlight("supply", { supplyKey: "btn-buy-core" });
      SoundFX.play("revive");
      if (toastEl) {
        toastEl.textContent = `🛒 [변이 코어] 구매 완료! (-${info.cost} BP · 보유 코어: ${game.coreSamples}개)`;
      }
      renderUpgradeModal();
      updateWeaponSlotsHUD();
    }

    function sellCoreSampleForBp(player) {
      const toastEl = document.getElementById("upg-roll-toast");
      if (!isPlayerNearArmory(player)) {
        if (toastEl) toastEl.textContent = "⛔ [🔧무기고] 반경 안에서만 변이 코어 추출 판매(환급)가 가능합니다!";
        return;
      }
      if ((game.coreSamples || 0) < 1) {
        if (toastEl) toastEl.textContent = "⚠️ 판매할 [🧬변이 코어]가 없습니다! (중간보스 처치로 획득 가능)";
        return;
      }
      if ((game.shopCoresBought || 0) > 0) {
        if (toastEl) toastEl.textContent = "⛔ 상점에서 코어를 구매한 이후에는 코어 차익 되팔기(추출 판매)가 제한됩니다!";
        return;
      }
      const refund = getCoreSellRefundBp();
      game.coreSamples--;
      game.coresSoldCount = (game.coresSoldCount || 0) + 1;
      game.bioPoints += refund;
      triggerUpgradeHighlight("supply", { supplyKey: "btn-sell-core" });
      SoundFX.play("upgrade");
      if (toastEl) {
        toastEl.textContent = `🧬 변이 코어 분해 판매 완료! 즉시 +${refund} BP 환급! (비코어 순수 스탯 강화 자금 확보)`;
      }
      renderUpgradeModal();
      updateWeaponSlotsHUD();
    }

    function unlockSpecialWeaponPerk(player, wIdx, tier) {
      const toastEl = document.getElementById("upg-roll-toast");
      if (!isPlayerNearArmory(player)) {
        if (toastEl) toastEl.textContent = "⛔ 무기고 반경 밖입니다! 소강기 [🔧무기고] 앞에서 특수강화를 진행하세요.";
        return;
      }
      const inv = player.inventory[wIdx];
      const w = WEAPONS[wIdx];
      if (!inv || !inv.unlocked) return;

      if (tier === 1) {
        if (inv.totalLv < 15 || inv.tier1Special) return;
        if ((game.coreSamples || 0) < 1) {
          if (toastEl) toastEl.textContent = "⚠️ [🧬변이 코어]가 부족합니다! 중간보스 드랍 또는 상점(3/6/9섹터)에서 확보하세요.";
          return;
        }
        game.coreSamples--;
        inv.tier1Special = true;
        SoundFX.play("revive");
        if (toastEl) toastEl.textContent = `🧬 [${w.name}] 15Lv 1차 코어개조 완료! (${w.tier1Name})`;
      } else if (tier === 2) {
        if (!inv.tier1Special) {
          if (toastEl) toastEl.textContent = "⚠️ 15Lv 1차 코어개조를 먼저 완료해야 30Lv 2차 각성을 진행할 수 있습니다!";
          return;
        }
        if (inv.totalLv < 30 || inv.awakened) return;
        if ((game.coreSamples || 0) < 1) {
          if (toastEl) toastEl.textContent = "⚠️ [🧬변이 코어]가 부족합니다!";
          return;
        }
        game.coreSamples--;
        inv.awakened = true;
        SoundFX.play("revive");
        if (toastEl) toastEl.textContent = `★ [${w.name}] 30Lv 2차 코어각성 완료! (${w.awakenName})`;
      } else if (tier === 3) {
        if (!inv.awakened) {
          if (toastEl) toastEl.textContent = "⚠️ 30Lv 2차 코어각성을 먼저 완료해야 45Lv 3차 초월을 진행할 수 있습니다!";
          return;
        }
        if (inv.totalLv < 45 || inv.transcended) return;
        if ((game.coreSamples || 0) < 1) {
          if (toastEl) toastEl.textContent = "⚠️ [🧬변이 코어]가 부족합니다!";
          return;
        }
        game.coreSamples--;
        inv.transcended = true;
        SoundFX.play("revive");
        if (toastEl) toastEl.textContent = `⚡ [${w.name}] 45Lv 3차 초월 코어각성 완료! (최종 화력 x1.55 · 공속+25% 오버클럭)`;
      }
      renderUpgradeModal();
      updateWeaponSlotsHUD();
    }

    function craftWeaponPart(player) {
      const toastEl = document.getElementById("upg-roll-toast");
      if (!isPlayerNearArmory(player)) {
        if (toastEl) toastEl.textContent = "⛔ [🔧무기고] 반경 안에서만 무기 부품 합성이 가능합니다!";
        return;
      }
      // [v3.3 무한 BP 차익 악용 원천 차단 1단계]
      if (areAllWeaponsUnlocked(player)) {
        if (toastEl) toastEl.textContent = "🔒 모든 무기(8종)가 이미 완벽 해금되었습니다! (부품 합성이 더 이상 필요하지 않습니다)";
        return;
      }
      const cost = getPartCraftCost();
      if (game.bioPoints < cost) {
        if (toastEl) toastEl.textContent = `⚠️ BP가 부족합니다! (⚙️ 무기 부품 1개 합성 필요: ${cost.toLocaleString()} BP)`;
        return;
      }
      game.bioPoints -= cost;
      game.partsCrafted = (game.partsCrafted || 0) + 1;
      game.weaponParts = (game.weaponParts || 0) + 1;
      triggerUpgradeHighlight("supply", { supplyKey: "btn-craft-part" });
      SoundFX.play("upgrade");
      if (toastEl) {
        toastEl.textContent = `⚙️ [무기 부품 합성] +1개 제작 완료! (-${cost.toLocaleString()} BP · 현재 보유 부품: ${game.weaponParts}개)`;
      }
      renderUpgradeModal();
      updateWeaponSlotsHUD();
    }

    // [v3.3 잉여 부품 분해 연구 자금 환전 모델 & 차익 방지 이중 락]
    // 8종 무기 전체 해금 완료 후에만 잉여 부품 환전이 가능하며, 환급액은 합성 비용의 75%로 책정되어 차익 거래 0% 보장!
    function getPartScrapRefundBp() {
      const craftCost = getPartCraftCost();
      return Math.round(craftCost * 0.75);
    }

    function scrapWeaponPartForBp(player) {
      const toastEl = document.getElementById("upg-roll-toast");
      if (!isPlayerNearArmory(player)) {
        if (toastEl) toastEl.textContent = "⛔ [🔧무기고] 반경 안에서만 부품 판매가 가능합니다!";
        return;
      }
      if ((game.weaponParts || 0) < 1) {
        if (toastEl) toastEl.textContent = "⚠️ 판매할 [⚙️무기 부품]이 없습니다!";
        return;
      }
      const refund = getPartScrapRefundBp();
      game.weaponParts--;
      game.bioPoints += refund;
      triggerUpgradeHighlight("supply", { supplyKey: "btn-scrap-part" });
      SoundFX.play("upgrade");
      if (toastEl) {
        toastEl.textContent = `⚙️ [무기 부품 판매] +${refund.toLocaleString()} BP 획득! (현재 부품: ${game.weaponParts}개)`;
      }
      renderUpgradeModal();
      updateWeaponSlotsHUD();
    }

    function upgradePlayerSuitStat(player, key) {
      const toastEl = document.getElementById("upg-roll-toast");
      if (!player || !SUIT_UPGRADE_DEFS[key]) return;
      if (!isPlayerNearArmory(player)) {
        if (toastEl) toastEl.textContent = "⛔ [🔧무기고] 반경 안에서만 신체·의료·기동 강화를 진행할 수 있습니다!";
        return;
      }
      if (!player.suitUpgrades) {
        player.suitUpgrades = { maxHp: 0, armorPlating: 0, medkitCap: 0, stimCap: 0, maxStamina: 0, staminaRegen: 0, dashCd: 0, bashCd: 0, syringe: 0 };
      }
      const def = SUIT_UPGRADE_DEFS[key];
      const curLv = player.suitUpgrades[key] || 0;
      if (curLv >= def.maxLv) {
        if (toastEl) toastEl.textContent = `🏆 [${def.name}] 이미 최대 레벨(Lv.${def.maxLv} MAX)입니다!`;
        return;
      }
      const reqRoom = def.reqRooms[curLv] || 0;
      if (game.currentRoomIndex < reqRoom) {
        if (toastEl) toastEl.textContent = `🔒 [${def.name} Lv.${curLv + 1}] 강화는 섹터 ${reqRoom + 1} 진입 시 해금됩니다!`;
        return;
      }
      const cost = def.costs[curLv] || 1000;
      const partCost = (def.partsCosts && def.partsCosts[curLv]) || 0;
      if (game.bioPoints < cost) {
        if (toastEl) toastEl.textContent = `⚠️ BP가 부족합니다! ([${def.name}] 강화 필요: ${cost.toLocaleString()} BP)`;
        return;
      }
      if ((game.weaponParts || 0) < partCost) {
        if (toastEl) toastEl.textContent = `⚠️ [⚙️무기 부품]이 부족합니다! ([${def.name}] 강화 필요: ⚙️부품 ${partCost}개)`;
        return;
      }

      game.bioPoints -= cost;
      if (partCost > 0) game.weaponParts -= partCost;
      player.suitUpgrades[key] = curLv + 1;

      if (key === "maxHp") {
        player.maxHp = getPlayerMaxHp(player);
        player.hp = Math.min(player.maxHp, player.hp + 25);
      } else if (key === "medkitCap") {
        player.medkits = Math.min(getPlayerMaxMedkits(player), player.medkits + 1);
      } else if (key === "stimCap") {
        player.stims = Math.min(getPlayerMaxStims(player), player.stims + 1);
      } else if (key === "maxStamina") {
        player.maxStamina = getPlayerMaxStamina(player);
        player.stamina = player.maxStamina;
      } else if (key === "syringe") {
        player.medkits = getPlayerMaxMedkits(player);
      }

      triggerUpgradeHighlight("suit", { suitKey: key });
      SoundFX.play(key === "syringe" ? "revive" : "upgrade");
      if (toastEl) {
        toastEl.textContent = key === "syringe"
          ? `💉 [나노 의료 주사기 특수개조] 완료! 이제 [Q] 자가 치료가 0.6초(무감속), [F] 아군 치료가 0.4초로 대폭 가속됩니다!`
          : `🧬 [${def.name}] Lv.${curLv + 1}/${def.maxLv} 강화 완료! (-${cost.toLocaleString()} BP${partCost > 0 ? ` · ⚙️-${partCost}` : ""})`;
      }
      renderUpgradeModal();
      updateWeaponSlotsHUD();
    }

    function buyAllAmmo(player) {
      const toastEl = document.getElementById("upg-roll-toast");
      const hasSupplyDrone = player.drone && player.drone.unlocked && player.drone.modules && player.drone.modules.supply && (player.drone.modules.supply.level || 0) >= 1;
      if (!isPlayerNearArmory(player) && !hasSupplyDrone) {
        if (toastEl) toastEl.textContent = "⛔ 탄약 일괄 보급은 [🔧상시무기고] 반경 안이거나 [📦원격보급드론]이 필요합니다!";
        return;
      }
      // 해금된 총기(1~5), 바리케이드(6), 폭약통(7) 중 탄약 보충이 필요한 항목이 있는지 확인
      const needsAmmo = player.inventory.some((inv, idx) => {
        if (!inv.unlocked || WEAPONS[idx].infinite) return false;
        return inv.ammo < getWeaponMaxAmmo(player, idx);
      });
      if (!needsAmmo) {
        if (toastEl) toastEl.textContent = "ℹ️ 모든 총기 및 설치물의 탄약이 이미 최대 적재량에 도달했습니다.";
        return;
      }
      const scaledCost = getSectorSupplyCost(320);
      if (game.bioPoints < scaledCost) {
        if (toastEl) toastEl.textContent = `⚠️ BP가 부족합니다! (전 탄약 일괄 보급: ${scaledCost.toLocaleString()} BP)`;
        return;
      }
      game.bioPoints -= scaledCost;
      let refilledCount = 0;
      player.inventory.forEach((inv, idx) => {
        if (!inv.unlocked || WEAPONS[idx].infinite) return;
        const maxA = getWeaponMaxAmmo(player, idx);
        if (inv.ammo < maxA) {
          const pack = (idx === 6) ? 5 : ((idx === 7) ? 4 : (WEAPONS[idx].packAmmo || 20));
          inv.ammo = Math.min(maxA, inv.ammo + pack);
          refilledCount++;
        }
      });
      triggerUpgradeHighlight("supply", { supplyKey: "btn-buy-all-ammo" });
      SoundFX.play("pickup");
      if (toastEl) toastEl.textContent = `📦 전 총기(+1팩) 및 설치물(방벽+5·폭통+4) 일괄 보충 완료! (-${scaledCost.toLocaleString()} BP)`;
      renderUpgradeModal();
      updateWeaponSlotsHUD();
    }

    function buyWeaponAmmo(player, wIdx) {
      buyAllAmmo(player);
    }

    function setSupplyBtnVisualState(btnId, canBuy, activeClasses) {
      const btn = document.getElementById(btnId);
      if (!btn) return;
      btn.disabled = !canBuy;
      const isSupplyHighlighted = (upgradeHighlight.type === "supply" && upgradeHighlight.supplyKey === btnId && Date.now() < upgradeHighlight.expireTime);
      const glowClass = isSupplyHighlighted ? "ring-4 ring-amber-400 border-amber-300 shadow-[0_0_22px_rgba(251,191,36,0.95)] animate-pulse" : "";
      if (canBuy) {
        btn.className = `p-2 rounded-xl ${activeClasses} text-left transition flex flex-col justify-between h-14 cursor-pointer ${glowClass}`;
      } else {
        btn.className = `p-2 rounded-xl bg-slate-800/90 border border-slate-700 text-slate-500 text-left transition flex flex-col justify-between h-14 opacity-60 cursor-not-allowed ${glowClass}`;
      }
    }

    function renderUpgradeModal() {
      const me = game.players[mySlotIndex];
      if (!me) return;

      const nearArmory = isPlayerNearArmory(me);
      const secCap = getSectorMaxStatLv();
      const maxTotalHere = Math.min(50, secCap * 8 + 2);

      const armoryBanner = document.getElementById("upg-armory-status");
      if (armoryBanner) {
        if (nearArmory) {
          armoryBanner.className = "h-9 px-3 rounded-xl bg-emerald-950/90 border border-emerald-400/50 text-xs font-bold text-emerald-200 flex items-center whitespace-normal break-keep";
          armoryBanner.textContent = `🟢 무기고 단말기 연결됨 [F] — S${game.currentRoomIndex + 1} 총 상한: Lv.${maxTotalHere}/50 (스탯당 최대 Lv.10 자유 강화)`;
        } else {
          armoryBanner.className = "h-9 px-3 rounded-xl bg-rose-950/90 border border-rose-400/50 text-xs font-bold text-rose-200 flex items-center whitespace-normal break-keep";
          armoryBanner.textContent = `🔴 무기고 반경 밖 — 외벽 [🛠️무기고] 단말기 앞(6.8m)에서 [F]로 이용 가능 (상한 Lv.${maxTotalHere}/50)`;
        }
      }

      document.getElementById("upg-bp-display").textContent = game.bioPoints.toLocaleString();
      document.getElementById("upg-parts-display").textContent = game.weaponParts;
      const coreEl = document.getElementById("upg-cores-display");
      if (coreEl) coreEl.textContent = game.coreSamples || 0;

      const shopInfo = getNextShopCoreInfo();
      const buyCoreLbl = document.getElementById("upg-buy-core-label");
      if (buyCoreLbl) buyCoreLbl.textContent = shopInfo.label;

      const sellCoreLbl = document.getElementById("upg-sell-core-label");
      if (sellCoreLbl) sellCoreLbl.textContent = `+${getCoreSellRefundBp().toLocaleString()} BP 환급 (보유:${game.coreSamples || 0})`;

      const partCost = getPartCraftCost();
      const craftPartLbl = document.getElementById("upg-craft-part-label");
      if (craftPartLbl) craftPartLbl.textContent = `${partCost.toLocaleString()} BP (보유:${game.weaponParts})`;

      const resCount = getResonanceCount(me);
      const pure15Count = me.inventory.filter(inv => inv.unlocked && !inv.tier1Special && inv.totalLv >= 15).length;
      const pure45Count = me.inventory.filter(inv => inv.unlocked && !inv.tier1Special && inv.totalLv >= 45).length;
      const resPct = resCount * 5 + pure15Count * 8 + pure45Count * 6;
      document.getElementById("upg-resonance-info").textContent =
        `무기공명: ${resCount}개 · 순수시너지: ${pure15Count}개 (전체화력 +${resPct}%)`;

      // 상단 6개 보급/합성/코어 버튼 가격 및 활성(컬러)/비활성(회색) 상태 동기화
      const hasSupplyDrone = me.drone && me.drone.unlocked && me.drone.modules && me.drone.modules.supply && (me.drone.modules.supply.level || 0) >= 1;
      const canOrderConsumable = nearArmory || hasSupplyDrone;

      const allAmmoCost = getSectorSupplyCost(320);
      const anyNeedsAmmo = me.inventory.some((inv, idx) => inv.unlocked && !WEAPONS[idx].infinite && inv.ammo < getWeaponMaxAmmo(me, idx));
      const buyAllAmmoLbl = document.getElementById("upg-buy-all-ammo-label");
      if (buyAllAmmoLbl) {
        buyAllAmmoLbl.textContent = anyNeedsAmmo ? `${allAmmoCost.toLocaleString()} BP (전 총기·설치물)` : "모든 탄약 만석 (100%)";
      }
      setSupplyBtnVisualState("btn-buy-all-ammo", canOrderConsumable && anyNeedsAmmo && game.bioPoints >= allAmmoCost, "bg-slate-900 hover:bg-emerald-950/80 border border-emerald-400/60");

      const medCost = getSectorSupplyCost(160);
      const maxMed = getPlayerMaxMedkits(me);
      const hasSyr = isPlayerSyringeUpgraded(me);
      const medTitle = document.getElementById("upg-buy-medkit-title");
      if (medTitle) medTitle.textContent = `${hasSyr ? "💉나노주사기" : "🩹구급키트"} (${me.medkits}/${maxMed})`;
      const btnMedPrice = document.getElementById("upg-buy-medkit-label");
      if (btnMedPrice) btnMedPrice.textContent = me.medkits >= maxMed ? `소지 상한 (${me.medkits}/${maxMed})` : `${medCost.toLocaleString()} BP`;
      setSupplyBtnVisualState("btn-buy-medkit", canOrderConsumable && me.medkits < maxMed && game.bioPoints >= medCost, "bg-slate-900 hover:bg-teal-950/80 border border-teal-400/60");

      const stimCost = getSectorSupplyCost(140);
      const maxStm = getPlayerMaxStims(me);
      const stimTitle = document.getElementById("upg-buy-stim-title");
      if (stimTitle) stimTitle.textContent = `💉스팀팩 (${me.stims}/${maxStm})`;
      const btnStimPrice = document.getElementById("upg-buy-stim-label");
      if (btnStimPrice) btnStimPrice.textContent = me.stims >= maxStm ? `소지 상한 (${me.stims}/${maxStm})` : `${stimCost.toLocaleString()} BP`;
      setSupplyBtnVisualState("btn-buy-stim", canOrderConsumable && me.stims < maxStm && game.bioPoints >= stimCost, "bg-slate-900 hover:bg-yellow-950/80 border border-yellow-400/60");

      setSupplyBtnVisualState("btn-craft-part", nearArmory && game.bioPoints >= partCost, "bg-indigo-950/85 hover:bg-indigo-900 border border-indigo-400/70");

      const scrapRefund = getPartScrapRefundBp();
      const scrapPartLbl = document.getElementById("upg-scrap-part-label");
      if (scrapPartLbl) scrapPartLbl.textContent = `+${scrapRefund.toLocaleString()} BP (보유:${game.weaponParts || 0})`;
      setSupplyBtnVisualState("btn-scrap-part", nearArmory && (game.weaponParts || 0) >= 1, "bg-amber-950/85 hover:bg-amber-900 border border-amber-400/70");

      const canBuyCore = nearArmory && (game.shopCoresBought || 0) < 3 && game.currentRoomIndex >= shopInfo.reqRoom && game.bioPoints >= shopInfo.cost;
      setSupplyBtnVisualState("btn-buy-core", canBuyCore, "bg-fuchsia-950/85 hover:bg-fuchsia-900 border border-fuchsia-400/70");

      const canSellCore = nearArmory && (game.coreSamples || 0) >= 1 && (game.shopCoresBought || 0) === 0;
      setSupplyBtnVisualState("btn-sell-core", canSellCore, "bg-cyan-950/85 hover:bg-cyan-900 border border-cyan-400/70");

      // ==================== 1) 9종 전술 신체 · 외골격 · 의료 · 기동 강화 (3대 전술 카테고리별 그룹화 렌더링) ====================
      const suitGrid = document.getElementById("upgrade-suit-grid");
      if (suitGrid) {
        suitGrid.innerHTML = "";
        if (!me.suitUpgrades) {
          me.suitUpgrades = { maxHp: 0, armorPlating: 0, medkitCap: 0, stimCap: 0, maxStamina: 0, staminaRegen: 0, dashCd: 0, bashCd: 0, sprintSpeed: 0, syringe: 0 };
        }

        const catSurvival = (typeof SUIT_CATEGORIES === "object" && SUIT_CATEGORIES.SURVIVAL) || { name: "💖 생존 & 방호 외골격", icon: "💖", desc: "체력 증강 및 피격 피해 감쇄", border: "border-rose-500/50", badge: "bg-rose-950/80 text-rose-300 border-rose-400/50" };
        const catMedical  = (typeof SUIT_CATEGORIES === "object" && SUIT_CATEGORIES.MEDICAL)  || { name: "🩹 의무 & 응급 보급",   icon: "🩹", desc: "구급키트/스팀팩 및 나노 주사기", border: "border-emerald-500/50", badge: "bg-emerald-950/80 text-emerald-300 border-emerald-400/50" };
        const catMobility = (typeof SUIT_CATEGORIES === "object" && SUIT_CATEGORIES.MOBILITY) || { name: "🏃 기동성 & 전술 기구", icon: "🏃", desc: "스태미너 및 점프/패링 특화", border: "border-cyan-500/50", badge: "bg-cyan-950/80 text-cyan-300 border-cyan-400/50" };

        const categoryGroups = [
          { groupDef: catSurvival, keys: ["maxHp", "armorPlating"] },
          { groupDef: catMedical,  keys: ["medkitCap", "stimCap", "syringe"] },
          { groupDef: catMobility, keys: ["maxStamina", "staminaRegen", "dashCd", "bashCd", "sprintSpeed"] }
        ];

        categoryGroups.forEach(cg => {
          const cat = cg.groupDef;
          const colEl = document.createElement("div");
          colEl.className = `rounded-2xl p-2.5 border ${cat.border} bg-slate-950/70 flex flex-col gap-2`;

          const headerEl = document.createElement("div");
          headerEl.className = "flex items-center justify-between pb-1.5 border-b border-slate-800/80";
          headerEl.innerHTML = `
            <div class="flex items-center gap-1.5 min-w-0">
              <span class="text-sm shrink-0">${cat.icon}</span>
              <span class="text-xs font-black text-white truncate">${cat.name}</span>
            </div>
            <span class="px-2 py-0.5 rounded text-[10px] font-bold border ${cat.badge} shrink-0">${cat.desc}</span>
          `;
          colEl.appendChild(headerEl);

          const listEl = document.createElement("div");
          listEl.className = "flex flex-col gap-2";

          cg.keys.forEach(sKey => {
            const def = SUIT_UPGRADE_DEFS[sKey];
            const curLv = me.suitUpgrades[sKey] || 0;
            const isMax = curLv >= def.maxLv;
            const reqRoom = isMax ? 0 : (def.reqRooms[curLv] || 0);
            const isRoomLocked = !isMax && game.currentRoomIndex < reqRoom;
            const cost = isMax ? 0 : (def.costs[curLv] || 1000);
            const partCost = isMax ? 0 : ((def.partsCosts && def.partsCosts[curLv]) || 0);
            const canUpg = nearArmory && !isMax && !isRoomLocked && game.bioPoints >= cost && (game.weaponParts || 0) >= partCost;

            let statNowText = "";
            if (sKey === "maxHp") statNowText = `최대 ${getPlayerMaxHp(me)} HP`;
            else if (sKey === "armorPlating") statNowText = `피해 ${Math.round(getPlayerDmgReduction(me) * 100)}% 경감`;
            else if (sKey === "medkitCap") statNowText = `최대 ${getPlayerMaxMedkits(me)}개 소지`;
            else if (sKey === "stimCap") statNowText = `최대 ${getPlayerMaxStims(me)}개 소지`;
            else if (sKey === "maxStamina") statNowText = `최대 ${getPlayerMaxStamina(me)} ST`;
            else if (sKey === "staminaRegen") statNowText = `초당 +${getPlayerStaminaRegen(me)}/s`;
            else if (sKey === "dashCd") statNowText = `점프 소모 ${getPlayerJumpStaminaCost(me)} ST`;
            else if (sKey === "bashCd") statNowText = `쿨 ${getPlayerBashCooldownMax(me).toFixed(2)}s · 반경 ${getPlayerBashRadius(me).toFixed(1)}m`;
            else if (sKey === "sprintSpeed") statNowText = `이동/질주 +${Math.round(getPlayerMoveSpeedBonus(me) * 100)}%`;
            else if (sKey === "syringe") statNowText = curLv > 0 ? "자가0.6s(무감속)·아군0.4s" : "기본: 자가2.8s·아군1.8s";

            const costText = `${cost.toLocaleString()}BP${partCost > 0 ? ` + ⚙️${partCost}개` : ""}`;
            const btnLabel = isMax
              ? `✔ MAX (Lv.${curLv}/${def.maxLv})`
              : isRoomLocked
                ? `🔒 ${reqRoom + 1}섹터 해금 (${costText})`
                : `강화 (${costText})`;

            const btnColorClass = canUpg
              ? (sKey === "syringe"
                  ? "bg-emerald-500 hover:bg-emerald-400 text-slate-950 border-emerald-300 shadow-md cursor-pointer"
                  : "bg-cyan-500 hover:bg-cyan-400 text-slate-950 border-cyan-300 shadow-md cursor-pointer")
              : "bg-slate-800 text-slate-500 border-slate-700 cursor-not-allowed opacity-60";

            const isSuitHighlighted = (upgradeHighlight.type === "suit" && upgradeHighlight.suitKey === sKey && Date.now() < upgradeHighlight.expireTime);
            const suitHighlightClass = isSuitHighlighted
              ? "ring-4 ring-cyan-400 border-cyan-300 shadow-[0_0_24px_rgba(34,211,238,0.95)] animate-pulse scale-[1.02] z-10"
              : "";

            const sCard = document.createElement("div");
            sCard.className = `rounded-xl p-2.5 border ${
              isMax ? "border-emerald-500/60 bg-emerald-950/25" :
              sKey === "syringe" ? "border-teal-400/50 bg-slate-900/95" :
              "border-slate-800 bg-slate-900/90"
            } flex flex-col justify-between gap-1.5 transition ${suitHighlightClass}`;

            sCard.innerHTML = `
              <div>
                <div class="flex items-center justify-between gap-1">
                  <span class="text-xs font-black text-white">${def.icon} ${def.name}</span>
                  <span class="px-1.5 py-0.5 rounded bg-slate-800 text-[10px] font-mono-code font-bold text-cyan-300 shrink-0">Lv.${curLv}/${def.maxLv}</span>
                </div>
                <div class="text-[11px] font-mono-code text-amber-300 font-bold mt-0.5">${statNowText}</div>
                <div class="text-[10px] text-slate-300 mt-0.5 leading-snug break-keep">${def.desc}</div>
              </div>
              <button type="button" data-suit-upg="${sKey}" ${!canUpg ? "disabled" : ""}
                      class="w-full py-1.5 px-2 rounded-lg border text-xs font-extrabold transition ${btnColorClass}">
                ${btnLabel}
              </button>
            `;
            listEl.appendChild(sCard);
          });

          colEl.appendChild(listEl);
          suitGrid.appendChild(colEl);
        });

        suitGrid.querySelectorAll("[data-suit-upg]").forEach(btn => {
          btn.addEventListener("click", () => {
            const sKey = btn.getAttribute("data-suit-upg");
            upgradePlayerSuitStat(me, sKey);
          });
        });
      }

      // ==================== 1b) 다목적 전술 드론 본체 해금 & 모듈 베이 그리드 렌더링 ====================
      const droneGrid = document.getElementById("upgrade-drone-grid");
      if (droneGrid) {
        droneGrid.innerHTML = "";
        if (!me.drone) {
          me.drone = {
            unlocked: false,
            animState: "IDLE",
            animTimer: 0,
            targetMateId: null,
            worldX: 0, worldY: 2.15, worldZ: 0,
            modules: {
              magnet: { level: 0, maxLevel: 4 },
              medi: { level: 0, maxLevel: 1, cooldown: 0, maxCooldown: 90.0, sectorRevivesUsed: 0 },
              interceptor: { level: 0, maxLevel: 4, cooldown: 0 },
              supply: { level: 0, maxLevel: 3 }
            }
          };
        }

        if (!me.drone.unlocked) {
          // [미해금 상태] 전술 드론 프레임 구매 유도 배너/버튼 렌더링
          const chassisCost = 900;
          const canBuyChassis = nearArmory && game.bioPoints >= chassisCost;
          const lockCard = document.createElement("div");
          lockCard.className = "col-span-1 md:col-span-3 rounded-2xl p-4 border border-indigo-500/50 bg-gradient-to-r from-slate-950 via-indigo-950/40 to-slate-950 flex flex-col md:flex-row items-center justify-between gap-4 shadow-xl";
          lockCard.innerHTML = `
            <div class="flex items-center gap-3.5">
              <div class="w-12 h-12 rounded-2xl bg-indigo-950 border border-indigo-400 flex items-center justify-center text-2xl shadow-inner shrink-0">
                🛸
              </div>
              <div>
                <div class="flex items-center gap-2">
                  <span class="text-sm font-black text-indigo-200">다목적 전술 드론 본체 프로토콜 해금</span>
                  <span class="text-[10px] font-mono-code font-bold px-2 py-0.5 rounded bg-rose-950 text-rose-300 border border-rose-800">미보유</span>
                </div>
                <div class="text-xs text-slate-300 mt-0.5 leading-snug break-keep">
                  해금 시 플레이어 어깨 상공에 전술 드론 3D 모델이 배치되며, <strong class="text-amber-300">자력 수거·원격 의무 소생·탄약 요격</strong> 모듈을 연구·장착할 수 있습니다.
                </div>
              </div>
            </div>
            <button type="button" id="btn-unlock-drone-chassis" ${!canBuyChassis ? "disabled" : ""}
                    class="w-full md:w-auto px-5 py-2.5 rounded-xl border text-xs font-black transition shrink-0 ${
                      canBuyChassis
                        ? "bg-indigo-600 hover:bg-indigo-500 border-indigo-300 text-white shadow-lg cursor-pointer animate-pulse"
                        : "bg-slate-900 border-slate-800 text-slate-500 cursor-not-allowed"
                    }">
              🛸 전술 드론 본체 구매 (${chassisCost} BP)
            </button>
          `;
          droneGrid.appendChild(lockCard);

          const buyBtn = lockCard.querySelector("#btn-unlock-drone-chassis");
          if (buyBtn) {
            buyBtn.addEventListener("click", () => unlockDroneChassis(me));
          }
        } else {
          // [해금 완료 상태] 3종 모듈 개별 연구·장착 베이 렌더링
          const modules = [
            {
              key: "magnet",
              name: "🧲 자력 수거 모듈",
              curLv: me.drone.modules.magnet.level || 0,
              maxLv: 4,
              costs: [0, 250, 500, 850, 1300],
              parts: [0, 0, 0, 1, 1],
              desc: "바닥의 탄약팩·부품·코어·회복약을 자석처럼 자동 견인 수거합니다.",
              getStat: (lv) => lv === 0 ? "비활성 (미장착)" : `수거 반경: ${[0, 4.0, 6.0, 8.0, 10.0][lv]}m`
            },
            {
              key: "interceptor",
              name: "🛡️ 탄약 요격 방어 모듈",
              curLv: me.drone.modules.interceptor.level || 0,
              maxLv: 4,
              costs: [0, 350, 600, 950, 1500],
              parts: [0, 0, 0, 1, 1],
              desc: "아군 오사(팀킬) 탄환이 플레이어에게 닿기 직전 고에너지 레이저로 즉시 요격 소멸시킵니다.",
              getStat: (lv) => lv === 0 ? "비활성 (미장착)" : `요격 쿨타임: ${[0, 6.0, 3.5, 1.8, 0.6][lv]}s`
            },
            {
              key: "medi",
              name: "💉 의무 나노 원격 소생",
              curLv: me.drone.modules.medi.level || 0,
              maxLv: 1,
              costs: [0, 700],
              parts: [0, 1],
              desc: "다운된 아군 발생 시 드론이 시체로 직접 비행하여 원격 소생 (HP 30 회복 & 독가스/산성/출혈 치료).",
              getStat: (lv) => lv === 0 ? "비활성 (미장착)" : `쿨 90s · 구급키트 1개 소모 · 섹터당 2회`
            },
            {
              key: "supply",
              name: "📦 원격 보급 모듈",
              curLv: (me.drone.modules.supply && me.drone.modules.supply.level) || 0,
              maxLv: 3,
              costs: [0, 450, 850, 1400],
              parts: [0, 0, 1, 1],
              desc: "무기고에 직접 가지 않아도 필드 어디서나 소모품(구급약/스팀팩/탄약)을 드론으로 즉시 원격 조달합니다.",
              getStat: (lv) => lv === 0 ? "비활성 (미장착)" : (lv === 1 ? "원격 주문 해금 (+20% 수수료)" : (lv === 2 ? "원격 정가 주문" : "정가 +15% 추가 보너스"))
            }
          ];

          modules.forEach(m => {
            const isMax = m.curLv >= m.maxLv;
            const nextLv = m.curLv + 1;
            const cost = isMax ? 0 : (m.costs[nextLv] || 500);
            const partReq = isMax ? 0 : (m.parts[nextLv] || 0);
            const hasParts = (game.weaponParts || 0) >= partReq;
            const canUpg = nearArmory && !isMax && game.bioPoints >= cost && hasParts;
            const dCard = document.createElement("div");
            dCard.className = "rounded-2xl p-2.5 border border-indigo-500/40 bg-slate-950/70 flex flex-col justify-between gap-2";
            dCard.innerHTML = `
              <div>
                <div class="flex items-center justify-between pb-1 border-b border-slate-800">
                  <span class="text-xs font-black text-indigo-300">${m.name}</span>
                  <span class="text-[10px] font-mono-code font-bold px-1.5 py-0.5 rounded ${
                    m.curLv === 0 ? "bg-slate-900 text-slate-400" : (isMax ? "bg-amber-950 text-amber-300" : "bg-indigo-950 text-indigo-300")
                  }">
                    ${isMax ? "MAX Lv." + m.maxLv : (m.curLv === 0 ? "미장착" : "Lv." + m.curLv + " / " + m.maxLv)}
                  </span>
                </div>
                <div class="text-[11px] font-mono-code font-bold ${m.curLv === 0 ? "text-slate-500" : "text-emerald-400"} mt-1">
                  ${m.getStat(m.curLv)}
                </div>
                <div class="text-[10px] text-slate-300 mt-1 leading-snug break-keep">${m.desc}</div>
              </div>
              <button type="button" data-drone-upg="${m.key}" ${!canUpg ? "disabled" : ""}
                      class="w-full py-1.5 px-2 rounded-lg border text-xs font-extrabold transition ${
                        isMax
                          ? "bg-slate-900 border-slate-700 text-slate-500 cursor-not-allowed"
                          : (canUpg ? "bg-indigo-900/90 hover:bg-indigo-800 border-indigo-400 text-indigo-100 cursor-pointer" : "bg-slate-900 border-slate-800 text-slate-500 cursor-not-allowed")
                      }">
                ${isMax ? "최대 레벨 도달" : (m.curLv === 0 ? `모듈 연구·장착 (${cost} BP${partReq > 0 ? ` + ⚙️${partReq}` : ""})` : `모듈 업그레이드 (${cost} BP${partReq > 0 ? ` + ⚙️${partReq}` : ""})`)}
              </button>
            `;
            droneGrid.appendChild(dCard);
          });

          droneGrid.querySelectorAll("[data-drone-upg]").forEach(btn => {
            btn.addEventListener("click", () => {
              const key = btn.getAttribute("data-drone-upg");
              upgradeDroneModule(me, key);
            });
          });
        }
      }

      // ==================== 2) 8종 무기 해금 및 랜덤 스탯 강화 그리드 렌더링 ====================
      const grid = document.getElementById("upgrade-weapons-grid");
      grid.innerHTML = "";

      WEAPONS.forEach((w, wIdx) => {
        const inv = me.inventory[wIdx];
        const statDefs = getWeaponStatDefs(wIdx);
        const isAllMax = statDefs.every(st => inv.stats[st.key] >= 10);
        const rollableDefs = statDefs.filter(st => !st.reqSector || (game.currentRoomIndex || 0) >= st.reqSector);
        const isSectorCapped = !isAllMax && (inv.totalLv >= maxTotalHere || rollableDefs.every(st => inv.stats[st.key] >= 10));
        const avgLv = Math.floor(inv.totalLv / 5);
        const rollCost = getUpgradeCost(wIdx, avgLv, inv.totalLv);
        const maxA = getWeaponMaxAmmo(me, wIdx);
        const canRollStat = nearArmory && inv.unlocked && !isAllMax && !isSectorCapped && game.bioPoints >= rollCost;

        const isWeaponHighlighted = (upgradeHighlight.type === "weapon" && upgradeHighlight.weaponIndex === wIdx && Date.now() < upgradeHighlight.expireTime);
        const weaponHighlightClass = isWeaponHighlighted
          ? "ring-4 ring-indigo-400 border-indigo-300 shadow-[0_0_24px_rgba(129,140,248,0.95)] animate-pulse scale-[1.01]"
          : "";

        const card = document.createElement("div");
        card.className = `rounded-2xl p-3.5 border ${
          inv.awakened ? "border-cyan-400/80 bg-slate-900/95" :
          inv.tier1Special ? "border-fuchsia-400/75 bg-slate-900/95" :
          inv.unlocked ? "border-slate-700/90 bg-slate-900/90" : "border-slate-800 bg-slate-950/75 opacity-85"
        } flex flex-col justify-between gap-2.5 transition ${weaponHighlightClass}`;

        let headerRight = "";
        if (!inv.unlocked) {
          const reqP = w.reqParts || 2;
          const reqBp = w.unlockBpCost || 0;
          const canUnlockW = nearArmory && game.weaponParts >= reqP && game.bioPoints >= reqBp;
          const unlockBtnClass = canUnlockW
            ? "bg-indigo-600 hover:bg-indigo-500 text-white border-indigo-400 shadow-md cursor-pointer"
            : "bg-slate-800 text-slate-500 border-slate-700 cursor-not-allowed opacity-60";
          headerRight = `
            <button type="button" data-unlock-weapon="${wIdx}" ${!canUnlockW ? "disabled" : ""}
                    class="px-3 py-1.5 rounded-xl border text-xs font-extrabold transition ${unlockBtnClass}">
              🔓 해금 (⚙️${reqP}개 + ${reqBp.toLocaleString()}BP)
            </button>
          `;
        } else {
          const ammoBtn = w.infinite
            ? `<span class="px-2.5 py-1 rounded-lg bg-slate-800 text-xs font-mono-code font-bold text-amber-300">∞ 무한탄</span>`
            : `<button type="button" data-buy-ammo="${wIdx}" title="클릭 시 전 탄약 일괄 보급"
                       class="px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 hover:border-emerald-400 text-xs font-mono-code font-extrabold text-slate-300 hover:text-emerald-300 transition cursor-pointer">
                 탄약: ${inv.ammo}/${maxA}
               </button>`;

          const btnLabel = isAllMax
            ? "MAX(Lv.50)"
            : (isSectorCapped ? `🔒섹터상한(Lv.${maxTotalHere})` : `🎲 랜덤강화 (${rollCost.toLocaleString()}BP)`);

          const basicBtnClass = canRollStat
            ? "bg-amber-500 hover:bg-amber-400 text-slate-950 border-amber-300 shadow-md cursor-pointer"
            : "bg-slate-800 text-slate-500 border-slate-700 cursor-not-allowed opacity-60";

          const basicBtn = `
            <button type="button" data-roll-w="${wIdx}" ${!canRollStat ? "disabled" : ""}
                    class="px-3 py-1 rounded-lg border text-xs font-extrabold transition ${basicBtnClass}">
              ${btnLabel}
            </button>
          `;

          headerRight = `
            <div class="flex flex-wrap items-center justify-end gap-1.5">
              ${ammoBtn}
              ${basicBtn}
            </div>
          `;
        }

        let specialRowHtml = "";
        if (inv.unlocked) {
          const pureBonus = getPureStatMasteryBonus(inv);
          let spBtn = "";
          if (!inv.tier1Special) {
            const canT1 = inv.totalLv >= 15 && nearArmory && (game.coreSamples || 0) >= 1;
            const t1Class = canT1
              ? "bg-fuchsia-500 hover:bg-fuchsia-400 text-slate-950 border-fuchsia-300 cursor-pointer"
              : "bg-slate-800 text-slate-500 border-slate-700 cursor-not-allowed opacity-60";
            spBtn = `
              <button type="button" data-sp1-w="${wIdx}" ${!canT1 ? "disabled" : ""}
                      class="px-2.5 py-1 rounded-lg border text-xs font-extrabold transition shrink-0 ${t1Class}">
                🧬 15Lv 1차개조 ${inv.totalLv < 15 ? `(Lv.${inv.totalLv}/15)` : "(코어1)"}
              </button>
            `;
          } else if (!inv.awakened) {
            const canT2 = inv.totalLv >= 30 && nearArmory && (game.coreSamples || 0) >= 1;
            const t2Class = canT2
              ? "bg-cyan-400 hover:bg-cyan-300 text-slate-950 border-cyan-200 cursor-pointer"
              : "bg-slate-800 text-slate-500 border-slate-700 cursor-not-allowed opacity-60";
            spBtn = `
              <button type="button" data-sp2-w="${wIdx}" ${!canT2 ? "disabled" : ""}
                      class="px-2.5 py-1 rounded-lg border text-xs font-extrabold transition shrink-0 ${t2Class}">
                ★ 30Lv 2차각성 ${inv.totalLv < 30 ? `(Lv.${inv.totalLv}/30)` : "(코어1)"}
              </button>
            `;
          } else if (!inv.transcended) {
            const canT3 = inv.totalLv >= 45 && nearArmory && (game.coreSamples || 0) >= 1;
            const t3Class = canT3
              ? "bg-amber-400 hover:bg-amber-300 text-slate-950 border-amber-200 cursor-pointer"
              : "bg-slate-800 text-slate-500 border-slate-700 cursor-not-allowed opacity-60";
            spBtn = `
              <button type="button" data-sp3-w="${wIdx}" ${!canT3 ? "disabled" : ""}
                      class="px-2.5 py-1 rounded-lg border text-xs font-extrabold transition shrink-0 ${t3Class}">
                ⚡ 45Lv 3차초월 ${inv.totalLv < 45 ? `(Lv.${inv.totalLv}/45)` : "(코어1)"}
              </button>
            `;
          } else {
            spBtn = `<span class="px-2.5 py-1 rounded-lg bg-amber-950 border border-amber-400 text-amber-200 text-xs font-extrabold shrink-0">⚡ 45Lv 3차초월 완성</span>`;
          }

          const pureBanner = pureBonus.label
            ? `<div class="text-emerald-300 font-extrabold leading-snug break-keep">✔ ${pureBonus.label}</div>`
            : `<div class="text-slate-400 leading-snug break-keep">• 비코어 순수스탯: 15Lv(+30%) · 30Lv(+65%&관통+1) · 45Lv(+115%&관통+2&장갑무시)</div>`;

          specialRowHtml = `
            <div class="flex items-center justify-between gap-2 pt-2 border-t border-slate-800 text-[11px]">
              <div class="space-y-0.5 min-w-0 flex-1">
                <div class="${inv.tier1Special ? 'text-fuchsia-300 font-bold' : 'text-slate-300'} leading-snug break-keep">
                  ${inv.tier1Special ? '✔' : '•'} <b>15Lv(코어)</b>: ${w.tier1Name}
                </div>
                <div class="${inv.awakened ? 'text-cyan-300 font-bold' : 'text-slate-300'} leading-snug break-keep">
                  ${inv.awakened ? '✔' : '•'} <b>30Lv(코어)</b>: ${w.awakenName} ${inv.transcended ? '(⚡45Lv 초월x1.55)' : ''}
                </div>
                ${pureBanner}
              </div>
              ${spBtn}
            </div>
          `;
        }

        let statsHtml = "";
        if (inv.unlocked) {
          statsHtml = `<div class="grid grid-cols-5 gap-1.5 pt-1">` + statDefs.map(st => {
            const curLv = inv.stats[st.key];
            const isSecLocked = Boolean(st.reqSector && (game.currentRoomIndex || 0) < st.reqSector);
            const isStatMax = curLv >= 10;
            const canClickStat = canRollStat && !isStatMax && !isSecLocked;
            const isStatHighlighted = (upgradeHighlight.type === "stat" && upgradeHighlight.weaponIndex === wIdx && upgradeHighlight.statKey === st.key && Date.now() < upgradeHighlight.expireTime);
            const statHighlightClass = isStatHighlighted
              ? "ring-4 ring-amber-400 border-amber-300 shadow-[0_0_24px_rgba(251,191,36,0.95)] animate-pulse scale-105 z-10"
              : "";
            const statBoxClass = canClickStat
              ? "border-amber-400/70 bg-slate-900 hover:bg-amber-950/40 text-slate-100 cursor-pointer"
              : "border-slate-700 bg-slate-800/80 text-slate-500 cursor-not-allowed opacity-65";
            const lvText = isSecLocked ? `🔒${st.reqSector + 1}섹터` : `Lv.${curLv}/10`;
            return `
              <button type="button" data-upg-w="${wIdx}" title="${st.desc}" ${!canClickStat ? "disabled" : ""}
                      class="p-1.5 rounded-xl border text-center transition ${statBoxClass} ${statHighlightClass}">
                <div class="text-[11px] font-bold ${canClickStat ? 'text-slate-100' : 'text-slate-400'} leading-tight">${st.label}</div>
                <div class="text-[9px] ${canClickStat ? 'text-amber-300' : 'text-slate-500'} leading-tight mt-0.5">${st.desc}</div>
                <div class="text-xs font-mono-code font-black ${isSecLocked ? 'text-rose-400' : (canClickStat ? 'text-cyan-300' : 'text-slate-400')} mt-0.5">${lvText}</div>
              </button>
            `;
          }).join("") + `</div>`;
        } else {
          statsHtml = `<div class="text-xs text-slate-300 py-2 leading-snug break-keep">${w.roleDesc}</div>`;
        }

        card.innerHTML = `
          <div class="flex flex-col gap-1.5">
            <div class="flex items-center justify-between gap-2">
              <div class="flex items-center gap-2 min-w-0">
                <span class="px-2 py-0.5 rounded-md bg-slate-800 text-amber-300 font-mono-code text-xs font-extrabold">${w.key}</span>
                <span class="text-sm font-black text-white truncate">${w.name}</span>
                <span class="px-2 py-0.5 rounded-md text-xs font-mono-code font-bold ${
                  inv.awakened ? "bg-cyan-500 text-slate-950" :
                  inv.tier1Special ? "bg-fuchsia-500 text-slate-950" : "bg-amber-500/20 text-amber-300"
                }">총 Lv.${inv.totalLv}/${maxTotalHere}</span>
              </div>
              ${headerRight}
            </div>
            ${specialRowHtml}
          </div>
          ${statsHtml}
        `;
        grid.appendChild(card);
      });

      grid.querySelectorAll("[data-unlock-weapon]").forEach(btn => {
        btn.addEventListener("click", () => {
          const toastEl = document.getElementById("upg-roll-toast");
          if (!isPlayerNearArmory(me)) {
            if (toastEl) toastEl.textContent = "⛔ 소강기 [🔧무기고] 반경 안에서만 신규 무기를 해금할 수 있습니다!";
            return;
          }
          const wIdx = parseInt(btn.getAttribute("data-unlock-weapon"), 10);
          const w = WEAPONS[wIdx];
          const inv = me.inventory[wIdx];
          const reqP = w.reqParts || 2;
          const reqBp = w.unlockBpCost || 0;
          if (game.weaponParts < reqP || game.bioPoints < reqBp) {
            if (toastEl) toastEl.textContent = `⚠️ 해금 자원이 부족합니다! (필요: ⚙️부품 ${reqP}개 + ${reqBp.toLocaleString()} BP)`;
            return;
          }
          game.weaponParts -= reqP;
          game.bioPoints -= reqBp;
          inv.unlocked = true;
          triggerUpgradeHighlight("weapon", { weaponIndex: wIdx });
          SoundFX.play("upgrade");
          if (toastEl) {
            toastEl.textContent = `🔓 [${w.name}] 설계도 해금 완료! (-⚙️부품 ${reqP}개, -${reqBp.toLocaleString()} BP)`;
          }
          renderUpgradeModal();
          updateWeaponSlotsHUD();
        });
      });

      grid.querySelectorAll("[data-buy-ammo]").forEach(btn => {
        btn.addEventListener("click", () => {
          buyAllAmmo(me);
        });
      });

      grid.querySelectorAll("[data-roll-w]").forEach(btn => {
        btn.addEventListener("click", () => {
          const wIdx = parseInt(btn.getAttribute("data-roll-w"), 10);
          rollRandomWeaponUpgrade(me, wIdx);
        });
      });

      grid.querySelectorAll("[data-upg-w]").forEach(btn => {
        btn.addEventListener("click", () => {
          const wIdx = parseInt(btn.getAttribute("data-upg-w"), 10);
          rollRandomWeaponUpgrade(me, wIdx);
        });
      });

      grid.querySelectorAll("[data-sp1-w]").forEach(btn => {
        btn.addEventListener("click", () => {
          const wIdx = parseInt(btn.getAttribute("data-sp1-w"), 10);
          unlockSpecialWeaponPerk(me, wIdx, 1);
        });
      });

      grid.querySelectorAll("[data-sp2-w]").forEach(btn => {
        btn.addEventListener("click", () => {
          const wIdx = parseInt(btn.getAttribute("data-sp2-w"), 10);
          unlockSpecialWeaponPerk(me, wIdx, 2);
        });
      });

      grid.querySelectorAll("[data-sp3-w]").forEach(btn => {
        btn.addEventListener("click", () => {
          const wIdx = parseInt(btn.getAttribute("data-sp3-w"), 10);
          unlockSpecialWeaponPerk(me, wIdx, 3);
        });
      });
    }
