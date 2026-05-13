(() => {
  const SLOT_HOURS = [0, 1, 2];

  function getSlotStatus(startedAt) {
    if (!startedAt) {
      return SLOT_HOURS.map(slot => ({ slot, available: false, unlocksAt: null }));
    }

    const start = new Date(startedAt).getTime();
    const now = Date.now();

    return SLOT_HOURS.map(slot => {
      const unlocksAt = new Date(start + slot * 3600000);
      return {
        slot,
        available: now >= unlocksAt.getTime(),
        unlocksAt
      };
    });
  }

  function assignRiddles(riddles, startedAt) {
    const slots = getSlotStatus(startedAt);
    return riddles.map((riddle, index) => {
      const slotInfo = slots[index] || { slot: index, available: true, unlocksAt: null };
      return {
        riddle,
        slot: slotInfo.slot,
        available: slotInfo.available,
        unlocksAt: slotInfo.unlocksAt
      };
    });
  }

  window.SDEnigme = {
    getSlotStatus,
    assignRiddles
  };
})();